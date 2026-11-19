import { createHash } from 'node:crypto';
import { ContractError, DEFAULT_SETTINGS, OWNER, SENSITIVITY_RANK } from '../contracts/index.ts';
import type { Actor, AuditWriter, ChatChunk, CompanionService, CompanionSettings, GrowthSnapshot, LocalCard, MemoryItem, MemoryModule, Notice, NoticeRecord, NoticeSink, PetActivity, PetInteraction, PetState, PetUtterance, Persona, QuietSignal, Reminder, StorageService, StreamEvent } from '../contracts/index.ts';
import { createPersonaStore } from './persona.ts';
import { createLineSelector, safeAssistantText } from './lines.ts';
import type { LineEvent } from './lines/templates.ts';
import { looksLikeCredential, memoryValidity, normalizeCommand, parseReminder } from './commands.ts';

interface NoticeAccess extends NoticeSink { list(options?: { status?: 'unread' | 'read' | 'snoozed' | 'dismissed'; limit?: number }): NoticeRecord[]; get(id: string): NoticeRecord; summary(): { unread: number; alert: boolean } }
interface ReminderAccess { create(text: string, dueAt: number): Reminder }
export interface CompanionModule extends CompanionService {
  personaView(): { persona: Persona; firstRun: boolean };
  settings(): CompanionSettings;
  updateSettings(patch: Partial<CompanionSettings>, by: Actor): CompanionSettings;
  onNotice(record: NoticeRecord, delivery: { bubble: boolean; repeat: boolean; created: boolean }): void;
  onNoticeAction(action: 'read' | 'snooze' | 'dismiss'): void;
  onMemoryChange(change: 'created' | 'updated' | 'forgotten'): void;
  progress(value: PetState['progress'] | null): void;
  quietSignals(): QuietSignal[];
  onClientConnected(): void;
  tick(): void;
  start(): void;
  stop(): void;
}

const semanticMap: Partial<Record<PetActivity, string>> = { idle: 'idle_breathe', sleeping: 'sleep', working: 'working', alert: 'sign_hold', happy: 'happy_bounce', concerned: 'worried', caring: 'caring', quiet: 'quiet_curl', waiting_auth: 'wait_auth', offline: 'offline_sleep' };
const toneActivity: Record<Notice['tone'], PetActivity> = { neutral: 'alert', good_news: 'happy', concern: 'concerned', care: 'caring' };
const dayKey = (now: number) => { const d = new Date(now); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const clock = (now: number) => new Date(now).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });

export function createCompanionModule(deps: { storage: StorageService; audit: AuditWriter; memory: MemoryModule; notices: NoticeAccess; reminders: ReminderAccess; companionDir: string; now(): number; newId(prefix: string): string; registerMessage(): string; emit(event: StreamEvent): void; random?: () => number; onError?(): void }): CompanionModule {
  const { storage, now } = deps;
  const sql = `CREATE TABLE comp_values (key TEXT PRIMARY KEY, value TEXT NOT NULL); CREATE TABLE comp_daily (date TEXT PRIMARY KEY, counts_json TEXT NOT NULL, bubbles INTEGER NOT NULL DEFAULT 0, affinity INTEGER NOT NULL DEFAULT 0, interacted INTEGER NOT NULL DEFAULT 0, offwork INTEGER NOT NULL DEFAULT 0); CREATE TABLE comp_delivery (notice_id TEXT PRIMARY KEY, emitted INTEGER NOT NULL DEFAULT 0, dismissed INTEGER NOT NULL DEFAULT 0, queued INTEGER NOT NULL DEFAULT 0, low INTEGER NOT NULL DEFAULT 0); CREATE TABLE comp_utterances (id TEXT PRIMARY KEY, notice_id TEXT, event TEXT NOT NULL, at INTEGER NOT NULL);`;
  storage.registerMigrations('companion', ['comp_'], [{ version: 1, checksum: createHash('sha256').update(sql).digest('hex'), apply: (tx) => { tx.run(sql); } }]);
  const getValue = <T>(key: string, fallback: T): T => storage.transaction((tx) => { const row = tx.get('SELECT value FROM comp_values WHERE key = ?', [key]); return row ? JSON.parse(String(row.value)) as T : structuredClone(fallback); });
  const putValue = (key: string, value: unknown) => storage.transaction((tx) => tx.run('INSERT INTO comp_values VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, JSON.stringify(value)]));
  const personaStore = createPersonaStore(deps);
  const selectLine = createLineSelector(deps.random);
  let settings = getValue('settings', DEFAULT_SETTINGS);
  let growth = getValue<GrowthSnapshot>('growth', { level: 1, stats: { companionDays: 0, affinity: 0 }, unlocked: [] });
  let signals = getValue<QuietSignal[]>('user_quiet', []);
  let audio = { ...getValue('audio', { enabled: false, volume: 0.3 }), playing: false };
  let expression: PetState['expression'];
  let transient: PetActivity = 'idle';
  let progress: PetState['progress'];
  let lastInteraction = now();
  let lastState = '';
  let updatedAt = now();
  let timer: NodeJS.Timeout | undefined;
  let running = false;
  let greetedClient = false;
  const throttles = new Map<string, number>(getValue<Array<[string, number]>>('throttles', []));
  const dismissedRecently = (event: string) => throttles.has(`dismiss:${event}`) && now() - throttles.get(`dismiss:${event}`)! < 1800_000;
  let quietCheckpoint = now();
  let quietRemainder = 0;
  const measureQuiet = () => {
    if (isQuiet()) {
      quietRemainder += Math.max(0, now() - quietCheckpoint);
      const minutes = Math.floor(quietRemainder / 60_000);
      if (minutes) { count('quietMinutes', minutes); quietRemainder %= 60_000; }
    }
    quietCheckpoint = now();
  };
  const utterances = new Map<string, { noticeId?: string; event: string }>();
  const ensureDay = () => {
    const date = dayKey(now());
    const previous = getValue('journal_day', date);
    if (previous !== date) flushJournal(previous, false);
    putValue('journal_day', date);
    storage.transaction((tx) => tx.run('INSERT OR IGNORE INTO comp_daily (date, counts_json) VALUES (?, ?)', [date, '{}']));
    return date;
  };
  const count = (key: string, amount = 1) => {
    const date = ensureDay();
    storage.transaction((tx) => {
      const row = tx.get('SELECT counts_json FROM comp_daily WHERE date = ?', [date])!;
      const counts = JSON.parse(String(row.counts_json)) as Record<string, number>;
      counts[key] = (counts[key] ?? 0) + amount;
      tx.run('UPDATE comp_daily SET counts_json = ? WHERE date = ?', [JSON.stringify(counts), date]);
    });
  };
  function flushJournal(date: string, shutdown: boolean) {
    const row = storage.transaction((tx) => tx.get('SELECT counts_json FROM comp_daily WHERE date = ?', [date]));
    if (!row) return;
    const counts = JSON.parse(String(row.counts_json)) as Record<string, number>;
    if (!Object.values(counts).some((n) => n > 0)) return;
    const labels: Record<string, string> = { pet: '摸头', poke: '戳', feed: '喂零食', play: '玩一会儿', notice: '收到通知', read: '已读', snooze: '稍后', dismiss: '忽略', remembered: '新记住', forgotten: '忘掉', quietMinutes: '安静分钟', unlock: '解锁' };
    const text = Object.entries(counts).filter(([key, value]) => labels[key] && value > 0).map(([key, value]) => `${labels[key]} ${value}`).join('、') + (shutdown ? `；截至 ${clock(now())}` : '；全天');
    const hash = createHash('sha256').update(JSON.stringify(counts)).digest('hex');
    if (getValue(`journal_hash:${date}`, '') === hash) return;
    deps.memory.appendJournal(date, { text, origin: { kind: 'companion', evidence: [] }, sensitivity: 'normal' });
    putValue(`journal_hash:${date}`, hash);
  }
  const isQuiet = () => signals.some((s) => s.reasons.length > 0);
  const workEnd = () => { const d = new Date(now()); const [h, m] = settings.workHours.end.split(':').map(Number); d.setHours(h, m, 0, 0); return d.getTime(); };
  const afterWork = () => !settings.workHours.days.includes(new Date(now()).getDay()) || now() >= workEnd();
  const visibleNotices = () => deps.notices.list({ status: 'unread', limit: 1000 });
  const emitState = () => {
    const next = api.state();
    const fingerprint = JSON.stringify({ ...next, updatedAt: 0 });
    if (fingerprint !== lastState) { lastState = fingerprint; updatedAt = now(); deps.emit({ type: 'pet.state', data: { state: { ...next, updatedAt } } }); }
  };
  const animate = (activity: PetActivity, animation?: string) => { if (isQuiet()) return; transient = activity; expression = { activityId: activity, animationId: animation ?? semanticMap[activity]!, startedAt: now() }; emitState(); schedule(); };
  const capacity = (high = false, user = false) => {
    if (isQuiet()) return false;
    if (high || user) return true;
    const date = ensureDay();
    const bubbles = storage.transaction((tx) => Number(tx.get('SELECT bubbles FROM comp_daily WHERE date = ?', [date])!.bubbles));
    if (bubbles >= settings.dailyBubbleCap) return false;
    storage.transaction((tx) => tx.run('UPDATE comp_daily SET bubbles = bubbles + 1 WHERE date = ?', [date]));
    return true;
  };
  const emitUtterance = (text: string, event: string, extra: Partial<PetUtterance> = {}): PetUtterance | null => {
    text = safeAssistantText(text, api.persona());
    if (!text || isQuiet()) return null;
    const utterance: PetUtterance = { id: deps.newId('utt'), sensitivity: 'normal', text: [...text].slice(0, 40).join(''), expiresAt: now() + (extra.quickActions?.length ? 20_000 : extra.facts?.length ? 15_000 : 8000), ...extra };
    utterances.set(utterance.id, { noticeId: utterance.ref?.noticeId, event });
    storage.transaction((tx) => tx.run('INSERT INTO comp_utterances VALUES (?, ?, ?, ?)', [utterance.id, utterance.ref?.noticeId ?? null, event, now()]));
    if (utterances.size > 1000) utterances.delete(utterances.keys().next().value!);
    deps.emit({ type: 'pet.utterance', data: { utterance } });
    if ([...text].length > 40) void deps.notices.submit({ kind: 'companion.line', title: '团子的完整台词', facts: [], body: text, sensitivity: utterance.sensitivity, evidence: [], tone: 'neutral', urgency: 'low', channels: ['console'], dedupeKey: `line:${utterance.id}` }, { kind: 'system', component: 'companion' }).catch(() => deps.onError?.());
    return utterance;
  };
  const line = (event: LineEvent, options: Parameters<typeof selectLine>[2] = {}) => selectLine(event, api.persona(), options);
  const bubbleNotice = (record: NoticeRecord, user = false, repeat = false, prefix?: string): PetUtterance | null => {
    const flag = storage.transaction((tx) => tx.get('SELECT * FROM comp_delivery WHERE notice_id = ?', [record.id]));
    if (!flag || Number(flag.dismissed) || (Number(flag.emitted) && !repeat) || record.status !== 'unread' || record.notice.sensitivity === 'secret') return null;
    const notice = record.notice;
    const confidential = notice.sensitivity === 'confidential' && !settings.discloseConfidentialInBubble;
    const selected = confidential ? '有一条敏感通知' : line('notice', { tone: notice.tone, card: true });
    if (!selected) return null;
    const text = safeAssistantText(prefix ? `${prefix} ${selected}` : selected, api.persona());
    if (!text || !capacity(record.notice.urgency === 'high', user)) return null;
    const activity = toneActivity[notice.tone];
    animate(activity);
    storage.transaction((tx) => tx.run('UPDATE comp_delivery SET emitted = 1, queued = 0, low = 0 WHERE notice_id = ?', [record.id]));
    return emitUtterance(text, 'notice', { sensitivity: notice.sensitivity, animation: semanticMap[activity], ref: { noticeId: record.id }, ...(!confidential ? { facts: [{ label: '标题', value: notice.title }, ...structuredClone(notice.facts)] } : {}), quickActions: [{ label: '查看', open: 'notice', notice: { noticeId: record.id, op: 'read' } }, { label: '稍后', notice: { noticeId: record.id, op: 'snooze' } }] });
  };
  const flushQuiet = (): boolean => {
    const ids = storage.transaction((tx) => tx.all('SELECT notice_id FROM comp_delivery WHERE queued = 1 AND dismissed = 0'));
    const records = ids.flatMap((row) => { try { return [deps.notices.get(String(row.notice_id))]; } catch { return []; } }).filter((r) => r.status === 'unread' && r.notice.sensitivity !== 'secret');
    storage.transaction((tx) => tx.run('UPDATE comp_delivery SET queued = 0, emitted = CASE WHEN low = 0 THEN 1 ELSE emitted END WHERE queued = 1'));
    if (!records.length) return false;
    const text = safeAssistantText(line('quiet_end', { card: true, values: { count: records.length } }) || `安静期间来了 ${records.length} 条。`, api.persona());
    if (!text || !capacity()) return false;
    const sensitivity = records.reduce<Notice['sensitivity']>((sens, r) => SENSITIVITY_RANK[r.notice.sensitivity] > SENSITIVITY_RANK[sens] ? r.notice.sensitivity : sens, 'normal');
    const facts = records.slice(0, 3).map((r) => ({ label: '标题', value: r.notice.sensitivity === 'confidential' && !settings.discloseConfidentialInBubble ? '有一条敏感通知' : r.notice.title }));
    return emitUtterance(text, 'quiet_end', { sensitivity, facts, animation: 'sign_hold', quickActions: [{ label: '查看', open: 'notice' }] }) !== null;
  };
  const grow = (interaction: boolean, affinity: boolean) => {
    const date = ensureDay();
    const delta = storage.transaction((tx) => {
      const row = tx.get('SELECT interacted, affinity FROM comp_daily WHERE date = ?', [date])!;
      const days = interaction && !Number(row.interacted) ? 1 : 0;
      const points = affinity && Number(row.affinity) < 20 ? 1 : 0;
      tx.run('UPDATE comp_daily SET interacted = MAX(interacted, ?), affinity = affinity + ? WHERE date = ?', [interaction ? 1 : 0, points, date]);
      return { days, points };
    });
    growth.stats.companionDays += delta.days;
    growth.stats.affinity += delta.points;
    const conditions: [string, boolean][] = [['headset_mint', growth.stats.companionDays >= 3], ['ball_yarn', growth.stats.affinity >= 30], ['act_read_notebook', growth.stats.companionDays >= 7], ['nightcap', growth.stats.companionDays >= 14], ['headset_sakura', growth.stats.affinity >= 100]];
    for (const [id, unlocked] of conditions) {
      if (!unlocked || growth.unlocked.includes(id)) continue;
      growth.unlocked.push(id);
      count('unlock');
      void deps.notices.submit({ kind: 'companion.milestone', title: '解锁了新的装饰或动作', facts: [{ label: '解锁', value: id }, { label: '陪伴天数', value: growth.stats.companionDays }, { label: '默契', value: growth.stats.affinity }], sensitivity: 'normal', evidence: [], tone: 'good_news', urgency: 'low', dedupeKey: `milestone:${id}` }, { kind: 'system', component: 'companion' }).catch(() => deps.onError?.());
    }
    growth.level = growth.unlocked.length + 1;
    putValue('growth', growth);
  };
  const schedule = () => {
    if (timer) clearTimeout(timer);
    if (!running) return;
    const deadlines = [now() + 60_000, ...signals.flatMap((s) => s.expiresAt !== undefined ? [s.expiresAt] : []), ...(expression ? [expression.startedAt + 8000] : [])];
    timer = setTimeout(() => { api.tick(); }, Math.max(1, Math.min(...deadlines.filter((t) => t > now())) - now()));
    timer.unref();
  };
  const api: CompanionModule = {
    persona: () => personaStore.view().persona,
    personaView: () => personaStore.view(),
    updatePersona(patch, by) {
      const wasFirst = personaStore.view().firstRun;
      const persona = personaStore.update(patch, by);
      deps.emit({ type: 'persona.updated', data: { persona } });
      if (wasFirst) emitUtterance(line('first'), 'first', { animation: 'drop_land' });
      return persona;
    },
    settings: () => structuredClone(settings),
    updateSettings(patch, by) {
      if (by.kind !== 'user' || by.personId !== OWNER || !patch || typeof patch !== 'object') throw new ContractError('rejected', 'settings require owner');
      const next = { ...settings, ...patch };
      const wh = next.workHours;
      if (Object.keys(patch).some((k) => !(k in DEFAULT_SETTINGS)) || !Number.isInteger(next.dailyBubbleCap) || next.dailyBubbleCap < 0 || next.dailyBubbleCap > 3 || ['offworkReminder', 'acceptDevNotices', 'discloseConfidentialInBubble', 'sleepAfterWork'].some((k) => typeof next[k as keyof CompanionSettings] !== 'boolean') || !wh || !Array.isArray(wh.days) || wh.days.some((d) => !Number.isInteger(d) || d < 0 || d > 6) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(wh.start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(wh.end) || wh.start >= wh.end) throw new ContractError('bad_request', 'invalid settings fields');
      settings = structuredClone(next); putValue('settings', settings);
      deps.audit.append({ id: deps.newId('audit'), at: now(), actor: by, kind: 'config', refs: {}, summary: 'settings.updated', outcome: 'ok' });
      deps.emit({ type: 'settings.updated', data: { settings: api.settings() } }); emitState(); schedule();
      return api.settings();
    },
    state() {
      const summary = deps.notices.summary();
      const reasons = [...new Set(signals.flatMap((s) => s.reasons))];
      const activeExpression = !isQuiet() && expression && now() < expression.startedAt + 8000 ? expression : undefined;
      const activity: PetActivity = isQuiet() ? 'quiet' : progress ? 'working' : summary.alert ? 'alert' : activeExpression ? transient : settings.sleepAfterWork && afterWork() && now() - lastInteraction >= 600_000 ? 'sleeping' : 'idle';
      return { activity, badge: { proposals: 0, notices: summary.unread, authRequests: 0 }, quietReasons: reasons, ...(activeExpression ? { expression: activeExpression } : {}), audio: { ...audio, playing: isQuiet() ? false : audio.playing }, growth: structuredClone(growth), ...(progress ? { progress } : {}), updatedAt };
    },
    quietSignals: () => structuredClone(signals),
    onClientConnected() {
      if (greetedClient) return;
      greetedClient = true;
      if (!personaStore.view().firstRun) emitUtterance(line('restored'), 'restored', { animation: 'drop_land' });
    },
    setQuiet(signal) {
      measureQuiet();
      const before = isQuiet();
      signals = signals.filter((s) => s.source !== signal.source);
      signals.push(structuredClone(signal));
      putValue('user_quiet', signals.filter((s) => s.source === 'user'));
      if (isQuiet()) { expression = undefined; transient = 'idle'; audio.playing = false; }
      if (before && !isQuiet()) { emitState(); flushQuiet(); }
      emitState(); schedule();
    },
    setAudio(value, by) {
      if (by.kind !== 'user' || by.personId !== OWNER) throw new ContractError('rejected', 'audio requires owner');
      if (typeof value.enabled !== 'boolean' || !Number.isFinite(value.volume) || value.volume < 0 || value.volume > 1) throw new ContractError('bad_request', 'invalid audio fields');
      audio = { ...value, playing: value.enabled && !isQuiet() && audio.playing }; putValue('audio', value); emitState();
    },
    onNotice(record, delivery) {
      ensureDay();
      storage.transaction((tx) => tx.run('INSERT OR IGNORE INTO comp_delivery (notice_id) VALUES (?)', [record.id]));
      if (delivery.created) count('notice');
      if (record.status !== 'unread') { storage.transaction((tx) => tx.run('UPDATE comp_delivery SET queued = 0, low = 0 WHERE notice_id = ?', [record.id])); emitState(); return; }
      if (!delivery.bubble || record.notice.sensitivity === 'secret' || (record.notice.channels !== undefined && !record.notice.channels.includes('pet')))  { emitState(); return; }
      if (isQuiet()) storage.transaction((tx) => tx.run('UPDATE comp_delivery SET queued = 1 WHERE notice_id = ? AND dismissed = 0', [record.id]));
      else if (record.notice.urgency === 'low') storage.transaction((tx) => tx.run('UPDATE comp_delivery SET low = 1 WHERE notice_id = ?', [record.id]));
      else bubbleNotice(record, false, delivery.repeat);
      emitState();
    },
    onNoticeAction(action) { count(action); grow(false, action === 'read' || action === 'snooze'); emitState(); },
    onMemoryChange(change) { if (change === 'created') count('remembered'); if (change === 'forgotten') count('forgotten'); },
    progress(value) { progress = value ?? undefined; emitState(); },
    async onInteraction(event: PetInteraction) {
      const date = ensureDay();
      const firstToday = !Number(storage.transaction((tx) => tx.get('SELECT interacted FROM comp_daily WHERE date = ?', [date])!.interacted));
      if (event.kind !== 'hover' && event.kind !== 'utterance_dismissed') { grow(true, ['pet', 'poke', 'feed', 'play'].includes(event.kind)); lastInteraction = now(); }
      if (event.kind === 'utterance_dismissed') {
        const saved = storage.transaction((tx) => tx.get('SELECT notice_id, event FROM comp_utterances WHERE id = ?', [event.id]));
        const known = utterances.get(event.id) ?? (saved ? { noticeId: saved.notice_id === null ? undefined : String(saved.notice_id), event: String(saved.event) } : undefined);
        if (known?.noticeId) storage.transaction((tx) => tx.run('UPDATE comp_delivery SET dismissed = 1, queued = 0, low = 0 WHERE notice_id = ?', [known.noticeId!]));
        else if (known) throttles.set(`dismiss:${known.event}`, now());
        putValue('throttles', [...throttles]);
        return null;
      }
      if (event.kind === 'audio_play' || event.kind === 'audio_pause') { audio.playing = event.kind === 'audio_play' && audio.enabled && !isQuiet(); emitState(); return null; }
      let which: LineEvent | undefined;
      let animation: string | undefined;
      let activity: PetActivity = 'happy';
      let delay = 0;
      if (event.kind === 'pet') { count('pet'); which = 'pet'; delay = 600_000; animation = 'pet_squint'; }
      if (event.kind === 'poke') { count('poke'); which = 'poke'; delay = 30_000; animation = event.times >= 6 ? 'poke_pout' : 'poke_wobble'; }
      if (event.kind === 'drag_start') { which = 'drag'; delay = 30_000; animation = 'drag_hold'; }
      if (event.kind === 'drop') { if (event.screenEdge === 'top') which = 'drop'; animation = 'drop_land'; }
      if (event.kind === 'feed') { count('feed'); animation = 'eat_snack'; }
      if (event.kind === 'play') { count('play'); animation = event.activityId; }
      if (event.kind === 'hover') return null;
      if (animation) animate(activity, animation);
      let result: PetUtterance | null = null;
      if (which && !dismissedRecently(which) && (!throttles.has(`${date}:${which}`) || now() - throttles.get(`${date}:${which}`)! >= delay)) {
        throttles.set(`${date}:${which}`, now());
        putValue('throttles', [...throttles]);
        const counts = storage.transaction((tx) => JSON.parse(String(tx.get('SELECT counts_json FROM comp_daily WHERE date = ?', [date])!.counts_json))) as Record<string, number>;
        result = emitUtterance(line(which, { values: { count: counts.pet ?? 0 } }), which, { animation });
      }
      if (!result && firstToday && new Date(now()).getHours() < 12 && !['click', 'double_click'].includes(event.kind)) result = emitUtterance(line('morning', { values: { unread: deps.notices.summary().unread } }), 'morning');
      emitState(); schedule(); return result;
    },
    async *chat(message, conversationId) {
      const id = conversationId ?? deps.newId('conversation');
      const evidenceId = deps.registerMessage();
      ensureDay(); grow(true, false); lastInteraction = now();
      const text = normalizeCommand(message, api.persona().name);
      const chunks: ChatChunk[] = [];
      const sayText = (text: string) => { const safe = safeAssistantText(text, api.persona()); if (safe) chunks.push({ kind: 'text', text: safe }); };
      const say = (event: LineEvent) => sayText(line(event, { card: true }) || LITERAL[event] || '现在只会记事、提醒、勿扰和查通知。');
      const card = (value: LocalCard) => chunks.push({ kind: 'card', card: value });
      const memoryCard = (title: string, items: MemoryItem[], forget: boolean) => card({ title, sensitivity: items.reduce<Notice['sensitivity']>((s, item) => SENSITIVITY_RANK[item.sensitivity] > SENSITIVITY_RANK[s] ? item.sensitivity : s, 'normal'), items: items.map((m) => ({ id: m.id, text: m.text, kind: m.kind })), actions: forget ? items.map((m) => ({ label: '确认忘掉', action: 'memory_forget', memoryId: m.id, confirm: '删除后文件和索引不可恢复；电脑自己的备份团子管不到。' })) : [{ label: '打开记忆', action: 'open_panel', panel: 'memory' }] });
      const remember = /^(?:记住|记一下|帮我记住)[: ,]?(.+)$/u.exec(text);
      const forget = /^(?:忘掉|忘记|别记)[: ,]?(.+)$/u.exec(text);
      const about = /^你记得(?:关于)?(.+?)(?:的事)?(?:吗|么)?[?？]?$/u.exec(text);
      const reminder = parseReminder(text, now());
      if (looksLikeCredential(message)) say('credential');
      else if (remember) {
        const original = remember[1].trim();
        if ([...original].length < 2 || [...original].length > 200) throw new ContractError('bad_request', 'invalid memory text length');
        const kind = /不要|别|禁止|必须|总是|每次|以后|优先|尽量|只在|不排/.test(original) ? 'rule' : 'fact';
        const until = memoryValidity(original, now());
        const item = deps.memory.remember({ text: original, kind, layer: kind === 'rule' ? 'profile' : 'long_term', sensitivity: 'normal', origin: { kind: 'user', evidenceId, evidenceType: 'message' }, ...(until ? { validUntil: until } : {}) });
        say('remember');
        card({ title: '记住了', sensitivity: item.sensitivity, facts: [{ label: '原文', value: item.text }, { label: '类型', value: item.kind }, { label: '有效期', value: item.validUntil ?? '长期' }], actions: [{ label: '撤销', action: 'memory_undo', memoryId: item.id }, { label: kind === 'rule' ? '改成事实' : '改成规则', action: 'memory_retype', memoryId: item.id, kind: kind === 'rule' ? 'fact' : 'rule' }], undoUntil: now() + 20_000 });
        chunks.push({ kind: 'memory', itemId: item.id, change: 'remembered' });
      } else if (forget) {
        const items = deps.memory.search(forget[1].trim(), { limit: 5 });
        if (!items.length) { say('not_found'); card({ title: '未找到记忆', facts: [{ label: '检索', value: forget[1].trim() }], sensitivity: 'normal', actions: [{ label: '打开记忆', action: 'open_panel', panel: 'memory' }] }); }
        else memoryCard('确认忘掉', items, true);
      } else if (/^你(?:都)?记(?:得|住了)什么[?？]?$/.test(text)) {
        const items = deps.memory.list({ includeExpired: false, limit: 1000 }).filter((m) => m.kind !== 'episode');
        memoryCard('我记得的内容', items.slice(0, 5), false);
        const last = chunks.at(-1); if (last?.kind === 'card') last.card.facts = [{ label: '规则', value: items.filter((m) => m.kind === 'rule').length }, { label: '事实', value: items.filter((m) => m.kind === 'fact').length }];
      } else if (about) {
        const items = deps.memory.search(about[1].trim(), { limit: 5 });
        if (!items.length) say('about_empty');
        memoryCard('相关记忆', items, false);
      } else if (reminder) {
        const item = deps.reminders.create(reminder.text, reminder.dueAt);
        card({ title: '提醒已设定', sensitivity: 'normal', facts: [{ label: '时间', value: new Date(item.dueAt).toLocaleString('zh-CN') }, { label: '内容', value: item.text }], actions: [{ label: '取消', action: 'reminder_cancel', reminderId: item.id }] });
      } else if (/^(?:取消勿扰|取消安静)$/.test(text)) { api.setQuiet({ source: 'user', reasons: [], detection: 'known' }); sayText('勿扰已取消。'); }
      else if (/^(?:勿扰|安静)(?:\s*\d+\s*(?:分钟|小时))?$|^安静到下班$/.test(text)) {
        const duration = /^(?:勿扰|安静)\s*(\d+)\s*(分钟|小时)$/.exec(text);
        const expiresAt = text === '安静到下班' ? workEnd() : duration ? now() + Number(duration[1]) * (duration[2] === '小时' ? 3600_000 : 60_000) : undefined;
        if (expiresAt !== undefined && expiresAt <= now()) throw new ContractError('bad_request', 'quiet expiry must be in the future');
        api.setQuiet({ source: 'user', reasons: ['user_dnd'], detection: 'known', ...(expiresAt ? { expiresAt } : {}) });
        sayText(line('quiet', { card: true, values: { duration: duration ? `${duration[1]} ${duration[2]}` : text === '安静到下班' ? '到下班' : '直到你关闭' } }) || '好，我先安静。');
      } else if (/^(?:有什么通知|几条未读)$/.test(text)) {
        const unread = visibleNotices();
        card({ title: '未读通知', sensitivity: unread.reduce<Notice['sensitivity']>((sens, r) => SENSITIVITY_RANK[r.notice.sensitivity] > SENSITIVITY_RANK[sens] ? r.notice.sensitivity : sens, 'normal'), facts: [{ label: '未读', value: deps.notices.summary().unread }, ...unread.slice(0, 3).map((r) => ({ label: '标题', value: r.notice.sensitivity === 'secret' ? '一条机密通知' : r.notice.sensitivity === 'confidential' ? '有一条敏感通知' : r.notice.title }))], actions: [{ label: '打开通知中心', action: 'open_panel', panel: 'notices' }] });
      } else if (/^(?:你是谁|你叫什么|你会什么)$/.test(text)) { card({ title: '关于团子', sensitivity: 'normal', facts: [{ label: '名字', value: api.persona().name }, { label: '性格', value: api.persona().traits.join('、') }, { label: '本地指令', value: '记住、忘掉、你记得什么、提醒、勿扰、通知、陪伴、时间、帮助' }] }); }
      else if (/^(?:陪伴几天了|我们多熟了)$/.test(text)) card({ title: '陪伴', sensitivity: 'normal', facts: [{ label: '陪伴天数', value: growth.stats.companionDays }, { label: '默契', value: growth.stats.affinity }] });
      else if (/^(?:现在几点|今天几号)$/.test(text)) card({ title: '本机时间', sensitivity: 'normal', facts: [{ label: '时间', value: new Date(now()).toLocaleString('zh-CN') }] });
      else { say(text === '帮助' ? 'help' : 'unknown'); card({ title: '本地模式', sensitivity: 'normal', facts: [{ label: '指令', value: '记住、忘掉、你记得什么、关于、提醒、勿扰、通知、陪伴、时间、帮助' }], actions: [{ label: '帮助', action: 'open_panel', panel: 'help' }] }); }
      for (const chunk of chunks) yield chunk;
      yield { kind: 'done', conversationId: id };
      emitState(); schedule();
    },
    tick() {
      measureQuiet();
      const before = isQuiet();
      const expired = signals.filter((s) => s.expiresAt !== undefined && s.expiresAt <= now());
      signals = signals.flatMap((s) => s.expiresAt === undefined || s.expiresAt > now() ? [s] : s.source === 'user' ? [] : [{ ...s, detection: 'unknown' as const, expiresAt: undefined }]);
      if (expired.some((s) => s.source === 'user')) putValue('user_quiet', signals.filter((s) => s.source === 'user'));
      if (before && !isQuiet()) emitState();
      const quietSummaryEmitted = before && !isQuiet() && flushQuiet();
      const date = ensureDay();
      storage.transaction((tx) => tx.run('DELETE FROM comp_utterances WHERE at < ?', [now() - 30 * 24 * 3600_000]));
      const row = storage.transaction((tx) => tx.get('SELECT offwork FROM comp_daily WHERE date = ?', [date])!);
      if (settings.offworkReminder && settings.workHours.days.includes(new Date(now()).getDay()) && now() >= workEnd() && !Number(row.offwork)) {
        storage.transaction((tx) => tx.run('UPDATE comp_daily SET offwork = 1 WHERE date = ?', [date]));
        if (!quietSummaryEmitted && !dismissedRecently('offwork')) {
          const text = line('offwork');
          if (text && capacity()) { animate('caring', 'stretch'); emitUtterance(text, 'offwork', { animation: 'caring' }); }
        }
      }
      emitState(); schedule();
    },
    start() { running = true; api.tick(); },
    stop() { running = false; if (timer) clearTimeout(timer); measureQuiet(); flushJournal(dayKey(now()), true); },
  };
  const LITERAL: Partial<Record<LineEvent, string>> = { remember: '记下了。', forgotten: '删了。', credential: '这看起来像密码或密钥，我不记这种东西。', not_found: '没找到相关记忆。', about_empty: '关于这件事我还没记过什么。' };
  return api;
}
