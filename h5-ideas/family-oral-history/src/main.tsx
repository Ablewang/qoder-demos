import { render } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { api, downloadArchive, json, type Notice } from './api';
import { ActionBar } from './ActionBar';
import { Answer, VoicePlayer, waitForRecordingSave } from './Answer';
import { deleteDraft, listDrafts } from './drafts';
import { questions, stages, starters, type Question } from './questions';
import type { AccessLinks, Ask, CreatedFamily, Snapshot, Stage, Story } from './shared';
import './style.css';

function readEntry() {
  const incoming = new URLSearchParams(location.hash.slice(1));
  return incoming.get('s') ? { token: incoming.get('s')!, kind: 'storyteller' as const } : incoming.get('j') ? { token: incoming.get('j')!, kind: 'listener' as const } : null;
}
type EntryRoute = NonNullable<ReturnType<typeof readEntry>>;
const roleNames = { organizer: '家族管理者', storyteller: '讲述人', listener: '提问与收听' };
type LinkState = { listener: AccessLinks | null; storyteller: AccessLinks | null };

function App() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState<'ask' | 'answer' | 'wall' | 'settings'>('ask');
  const [feedback, setFeedback] = useState<{ text: string; kind: 'status' | 'error' } | null>(null);
  const routeEpoch = useRef(0);
  const operationEpoch = useRef(0);
  const currentRoute = routeEpoch.current;
  const notice: Notice = (text, kind = 'error') => {
    if (currentRoute === routeEpoch.current) setFeedback(text ? { text, kind } : null);
  };
  function changePage(next: typeof page) {
    routeEpoch.current++;
    setFeedback((current) => current?.kind === 'error' ? current : null);
    setPage(next); window.scrollTo(0, 0);
  }
  useEffect(() => {
    if (feedback?.kind !== 'status') return;
    const timer = setTimeout(() => setFeedback((current) => current === feedback ? null : current), 5000);
    return () => clearTimeout(timer);
  }, [feedback]);
  const [created, setCreated] = useState<CreatedFamily | null>(null);
  const [recoveredCode, setRecoveredCode] = useState('');
  const [links, setLinks] = useState<LinkState>({ listener: null, storyteller: null });
  const [entry, setEntry] = useState(readEntry);
  useEffect(() => {
    const changed = () => {
      routeEpoch.current++;
      setFeedback((current) => current?.kind === 'error' ? current : null);
      setEntry(readEntry());
    };
    window.addEventListener('hashchange', changed);
    window.addEventListener('popstate', changed);
    changed();
    return () => { window.removeEventListener('hashchange', changed); window.removeEventListener('popstate', changed); };
  }, []);
  async function refresh() {
    const route = routeEpoch.current;
    const next = await api<Snapshot>('/session');
    if (route !== routeEpoch.current) return;
    if (snapshot && (snapshot.member.id !== next.member.id || snapshot.family.id !== next.family.id)) {
      routeEpoch.current++; operationEpoch.current++;
      setFeedback(null); setCreated(null); setRecoveredCode(''); setLinks({ listener: null, storyteller: null });
      setPage(next.member.role === 'storyteller' ? 'answer' : 'wall');
    }
    setSnapshot(next);
  }
  useEffect(() => { void api<Snapshot>('/session').then((next) => { setSnapshot(next); setPage(next.member.role === 'storyteller' ? 'answer' : 'wall'); }).catch((error: Error & { status?: number }) => { if (error.status !== 401) setFeedback({ text: error.message, kind: 'error' }); }).finally(() => setLoading(false)); }, []);
  async function operate(action: () => Promise<unknown>, success?: string) {
    const route = routeEpoch.current;
    const operation = ++operationEpoch.current;
    setFeedback(null);
    try {
      await action(); await refresh();
      if (success && route === routeEpoch.current && operation === operationEpoch.current) setFeedback({ text: success, kind: 'status' });
    } catch (error) {
      if (route === routeEpoch.current && operation === operationEpoch.current) setFeedback({ text: (error as Error).message, kind: 'error' });
    }
  }
  function enter(next: Snapshot) {
    setSnapshot(next); setEntry(null); setPage(next.member.role === 'storyteller' ? 'answer' : 'wall');
    routeEpoch.current++;
    history.replaceState(null, '', location.pathname); setFeedback(null); window.scrollTo(0, 0);
  }
  return <div class={`shell${snapshot?.member.role === 'storyteller' ? ' storyteller-mode' : ''}${snapshot && !entry && !loading ? ' in-family' : ''}`}>
    <header class="masthead"><button class="brand" aria-label="回到故事目录" onClick={() => changePage('wall')}>然后呢<span>家族口述记录</span></button><span class="local-tag">本地内测 · 不公开</span></header>
    {feedback && <div class={`message ${feedback.kind === 'status' ? 'status-toast' : 'error-message'}`} role={feedback.kind === 'status' ? 'status' : 'alert'} aria-live={feedback.kind === 'status' ? 'polite' : 'assertive'}><span>{feedback.text}</span><button aria-label="收起提示" onClick={() => setFeedback(null)}>×</button></div>}
    {loading ? <main><p>正在打开家里的故事…</p></main> : entry ? <Entry key={`${entry.kind}:${entry.token}`} entry={entry} notice={notice} onEnter={(next) => { if (currentRoute !== routeEpoch.current) return; setCreated(null); setRecoveredCode(''); setLinks({ listener: null, storyteller: null }); enter(next); }} onCancel={() => { routeEpoch.current++; setFeedback((current) => current?.kind === 'error' ? current : null); setEntry(null); history.replaceState(null, '', location.pathname); }} /> : !snapshot ? <Welcome notice={notice} onCreated={(result) => { setCreated(result); setLinks({ listener: result.invite, storyteller: result.storyteller }); enter(result.snapshot); setPage('ask'); }} onEnter={(next, code) => { setCreated(null); setRecoveredCode(code || ''); setLinks({ listener: null, storyteller: null }); enter(next); if (code) setPage('settings'); }} onEntry={(next) => { routeEpoch.current++; setFeedback((current) => current?.kind === 'error' ? current : null); setEntry(next); }} /> : <>
      <div class="family-strip"><span class="family-seal" aria-hidden="true">{snapshot.family.storytellerName.slice(0, 1)}</span><div><strong>{snapshot.family.name}</strong><span>{snapshot.member.name} · {roleNames[snapshot.member.role]}</span></div><button class="quiet refresh-button" aria-label="刷新家里消息" onClick={() => void refresh().catch((error: Error) => notice(error.message))}>刷新</button></div>
      <nav aria-label="家族页面" class="tabs">
        <button aria-current={page === 'wall' ? 'page' : undefined} class={page === 'wall' ? 'selected' : ''} onClick={() => changePage('wall')}>故事目录</button>
        {snapshot.member.role !== 'storyteller' && <button aria-current={page === 'ask' ? 'page' : undefined} class={page === 'ask' ? 'selected' : ''} onClick={() => changePage('ask')}>问一件事</button>}
        {snapshot.member.role !== 'listener' && <button aria-current={page === 'answer' ? 'page' : undefined} class={page === 'answer' ? 'selected' : ''} onClick={() => changePage('answer')}>{snapshot.member.role === 'organizer' ? '当面代录' : '说一段往事'}</button>}
        <button aria-current={page === 'settings' ? 'page' : undefined} class={page === 'settings' ? 'selected' : ''} onClick={() => changePage('settings')}>家族权限</button>
      </nav>
      <main>
        {page === 'ask' && <AskPage snapshot={snapshot} recoveryCode={created?.recoveryCode || ''} notice={notice} onRecord={() => changePage('answer')} onAsk={(data) => operate(() => json('/asks', data), '问题已放在讲述人面前。不催，想说时再说。')} />}
        {page === 'answer' && <AnswerPage key={`${snapshot.family.id}:${snapshot.member.id}`} snapshot={snapshot} notice={notice} onSent={async () => { await refresh(); }} onSkip={(id) => operate(() => json(`/asks/${id}/skip`, {}), '已跳过这题，不用解释为什么。')} />}
        {page === 'wall' && <Wall snapshot={snapshot} notice={notice} operate={operate} />}
        {page === 'settings' && <Settings snapshot={snapshot} recoveryCode={created?.recoveryCode || recoveredCode} links={links} onLinks={(kind, value) => setLinks((current) => ({ ...current, [kind]: value }))} notice={notice} operate={operate} onLogout={async () => { await json('/logout', {}); setSnapshot(null); setCreated(null); setRecoveredCode(''); setLinks({ listener: null, storyteller: null }); setFeedback({ text: '已退出这个浏览器，已发送的故事仍在家族里。', kind: 'status' }); }} />}
      </main>
    </>}
    <footer>仅本机共享内测 · 不读取微信聊天<br />微信和真实手机录音／播放尚未验证；不是可直接上线的服务。</footer>
  </div>;
}

function Welcome({ notice, onCreated, onEnter, onEntry }: { notice: Notice; onCreated: (c: CreatedFamily) => void; onEnter: (s: Snapshot, recoveryCode?: string) => void; onEntry: (e: EntryRoute) => void }) {
  const [name, setName] = useState(''); const [organizerName, setOrganizerName] = useState(''); const [storytellerName, setStorytellerName] = useState('');
  const [busy, setBusy] = useState(false); const [invite, setInvite] = useState(''); const [recovery, setRecovery] = useState(false); const [familyId, setFamilyId] = useState(''); const [code, setCode] = useState('');
  async function create(event: Event) {
    event.preventDefault();
    if (![name, organizerName, storytellerName].every((v) => v.trim())) { notice('请写上家族名、你的称呼和讲述人的称呼。'); return; }
    setBusy(true);
    try { onCreated(await json<CreatedFamily>('/families', { name, organizerName, storytellerName })); }
    catch (error) { notice((error as Error).message); } finally { setBusy(false); }
  }
  async function recover(event: Event) {
    event.preventDefault(); setBusy(true);
    try {
      const result = await json<{ snapshot: Snapshot; recoveryCode: string }>('/organizer/recover', { familyId, code });
      onEnter(result.snapshot, result.recoveryCode);
    } catch (error) { notice((error as Error).message); } finally { setBusy(false); }
  }
  return <main class="welcome"><div class="page-heading"><p class="eyebrow">一位家人 · 原声与文字</p><h1>建立家族目录</h1><p class="intro">先约定谁来讲、谁能听。每段讲述都由讲述人确认后留下。</p></div>
    <section class="ledger-section create-section"><div class="section-heading"><span class="section-number">01</span><h2>{storytellerName.trim() ? `${storytellerName.trim()}的讲述` : '谁来讲，谁来记录'}</h2></div><form noValidate onSubmit={(event) => void create(event)}>
      <label>讲述人的称呼<input aria-label="讲述人的称呼" value={storytellerName} maxLength={30} placeholder="例如：外婆" onInput={(e) => setStorytellerName(e.currentTarget.value)} /></label>
      <div class="two-fields"><label>你的称呼<input aria-label="你的称呼" value={organizerName} maxLength={30} placeholder="例如：小禾" onInput={(e) => setOrganizerName(e.currentTarget.value)} /></label><label>家族名<input aria-label="家族名" value={name} maxLength={40} placeholder="例如：林家的声音" onInput={(e) => setName(e.currentTarget.value)} /></label></div>
      <p class="helper">你负责管理邀请；讲述人可以跳题、删除自己的内容。只向获准加入的家人开放，不公开搜索。</p><button class="primary full" disabled={busy}>{busy ? '正在建立…' : '创建家族，保存原声'}</button>
    </form></section>
    <details class="entry-option"><summary>已有目录？用家人的邀请进入</summary><label>粘贴完整邀请链接<input aria-label="完整邀请链接" type="text" value={invite} onInput={(e) => setInvite(e.currentTarget.value)} /></label><button class="secondary full" onClick={() => {
      try { const url = new URL(invite); if (url.origin !== location.origin) throw new Error(); const hash = new URLSearchParams(url.hash.slice(1)); const s = hash.get('s'); const j = hash.get('j'); if (!s && !j) throw new Error(); onEntry({ token: (s || j)!, kind: s ? 'storyteller' : 'listener' }); }
      catch { notice('请粘贴这个本地站点生成的完整邀请链接。'); }
    }}>查看邀请说明</button></details>
    <button class="quiet recovery-toggle" aria-expanded={recovery} onClick={() => setRecovery(!recovery)}>管理者换设备／恢复访问</button>
    {recovery && <section class="ledger-section"><h2>使用独立恢复码</h2><form onSubmit={(e) => void recover(e)}><label>家族编号<input aria-label="家族编号" value={familyId} onInput={(e) => setFamilyId(e.currentTarget.value)} /></label><label>管理者恢复码<input aria-label="管理者恢复码" type="password" autoComplete="off" value={code} onInput={(e) => setCode(e.currentTarget.value)} /></label><p class="helper">昵称和六位加入码不能恢复管理权限。恢复会撤销旧管理者会话，恢复码仅能用一次。</p><button class="secondary full" disabled={busy}>恢复管理访问</button></form></section>}
  </main>;
}

function Entry({ entry, notice, onEnter, onCancel }: { entry: EntryRoute; notice: Notice; onEnter: (s: Snapshot) => void; onCancel: () => void }) {
  const [info, setInfo] = useState<{ familyName: string; storytellerName: string } | null>(null);
  const [name, setName] = useState(''); const [passcode, setPasscode] = useState(''); const [agreed, setAgreed] = useState(false); const [busy, setBusy] = useState(false);
  useEffect(() => {
    let current = true;
    void json<{ familyName: string; storytellerName: string }>('/preview-invite', entry).then((result) => { if (current) setInfo(result); }).catch((error: Error) => { if (current) notice(error.message); });
    return () => { current = false; };
  }, [entry.token, entry.kind]);
  async function join(event: Event) {
    event.preventDefault();
    if (!agreed) { notice('请先确认你了解这些故事会保存给谁听。'); return; }
    if (entry.kind === 'listener' && (!name.trim() || !passcode.trim())) { notice('请写上自己的称呼和家人另行告诉你的六位加入码。'); return; }
    setBusy(true);
    try { onEnter(await json<Snapshot>(entry.kind === 'storyteller' ? '/storyteller-session' : '/join', entry.kind === 'storyteller' ? { token: entry.token, consent: true } : { token: entry.token, passcode, name })); }
    catch (error) { notice((error as Error).message); } finally { setBusy(false); }
  }
  return <main class="invitation"><div class="page-heading"><p class="eyebrow">家人留给你的邀请 · {entry.kind === 'storyteller' ? '讲述人入口' : '提问与收听入口'}</p><h1>{info?.storytellerName ? `${info.storytellerName}的讲述` : '正在核对邀请…'}</h1><p class="intro">{info?.familyName || '正在打开家族目录'}</p></div><section class="ledger-section"><h2>{entry.kind === 'storyteller' ? '由你决定讲什么、留给谁' : '加入后，听原声、问一件事'}</h2><p class="helper">内容保存到这台电脑，只有已加入这个家族的人能听。讲述人可以跳题、删除自己内容；管理者可管理全家内容。已下载的副本无法收回。</p>
    <form noValidate onSubmit={(event) => void join(event)}>{entry.kind === 'listener' && <><label>你的称呼<input aria-label="你的称呼" maxLength={30} value={name} onInput={(e) => setName(e.currentTarget.value)} /></label><label>六位加入码<input aria-label="六位加入码" inputMode="numeric" autoComplete="off" maxLength={6} value={passcode} onInput={(e) => setPasscode(e.currentTarget.value)} /></label></>}
      <label class="check"><input aria-label="同意家族保存与分享说明" type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.currentTarget.checked)} /><span>我了解并同意上述保存和家族内分享方式。不读取微信聊天。</span></label><button class="primary full" disabled={busy || !info}>{busy ? '正在进入…' : entry.kind === 'storyteller' ? '我知道了，进入说故事' : '同意并加入家族'}</button>
    </form><button class="quiet full" onClick={onCancel}>暂不进入</button></section></main>;
}

function RecoveryKeep({ familyId, code, notice, collapsible = false }: { familyId: string; code: string; notice: Notice; collapsible?: boolean }) {
  const [open, setOpen] = useState(true);
  const toggled = useRef(false);
  const reopen = useRef<HTMLButtonElement>(null); const collapse = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (toggled.current) (open ? collapse : reopen).current?.focus(); }, [open]);
  function toggle(next: boolean) { toggled.current = true; setOpen(next); }
  async function copy() {
    try {
      await navigator.clipboard.writeText(`家族编号：${familyId}\n管理者恢复码：${code}`);
      notice('已复制。请存在只有你能看的地方，别发到家族群。', 'status');
    } catch { notice('浏览器没有允许复制，请长按上面的编号和恢复码自行复制。'); }
  }
  if (!open) return <div class="keep-collapsed"><span>恢复信息已收起，关掉页面前仍可再看。</span><button ref={reopen} class="quiet" aria-expanded={false} aria-controls="keep-card" onClick={() => toggle(true)}>再看一次</button></div>;
  return <section id="keep-card" class="keep-card" aria-labelledby="keep-title"><div class="keep-head"><h2 id="keep-title">私下保管恢复信息</h2><span>仅本次显示</span></div>
    <dl class="keep-values"><div><dt>家族编号</dt><dd class="keep-family-id">{familyId}</dd></div><div><dt>管理者恢复码</dt><dd class="keep-code">{code}</dd></div></dl>
    <p class="helper">{collapsible ? '换设备凭这两项恢复，码只用一次。勿发家族群，丢失不能靠昵称或加入码找回。' : '换设备时凭这两项恢复管理权限，恢复码只能用一次。别发到家族群；丢失后不能靠昵称或加入码找回。'}</p>
    <div class="keep-actions"><button class="secondary" onClick={copy}>复制这两项</button>{collapsible && <button ref={collapse} class="quiet" aria-label="记好了，先收起" aria-expanded={true} aria-controls="keep-card" onClick={() => toggle(false)}>先收起</button>}</div></section>;
}

function AskPage({ snapshot, recoveryCode, notice, onRecord, onAsk }: { snapshot: Snapshot; recoveryCode: string; notice: Notice; onRecord: () => void; onAsk: (d: { text: string; stage: Stage; depth: string }) => Promise<void> }) {
  const [stage, setStage] = useState<Stage>('童年'); const [libraryStage, setLibraryStage] = useState<Stage>('童年'); const [picked, setPicked] = useState<Question | null>(null); const [custom, setCustom] = useState(''); const [deep, setDeep] = useState(false); const [busy, setBusy] = useState(false);
  async function submit() {
    const text = custom.trim() || picked?.text || '';
    if (!text) { notice('先选一题，或写下你想问的一件事。'); return; }
    setBusy(true); await onAsk({ text, stage: custom.trim() ? stage : picked!.stage, depth: custom.trim() ? (deep ? 'deep' : 'gentle') : picked!.depth }); setBusy(false);
  }
  const pending = snapshot.asks.filter((a) => a.status === 'pending' && !a.parentStoryId);
  const name = snapshot.family.storytellerName;
  const outgoing = custom.trim() || picked?.text || '';
  const library = questions.filter((q) => q.stage === libraryStage);
  const option = (q: Question, index: number, withStage: boolean) => <button aria-pressed={picked?.id === q.id && !custom} class={`question-option ${picked?.id === q.id && !custom ? 'selected' : ''}`} onClick={() => { setPicked(q); setCustom(''); setStage(q.stage); setDeep(q.depth === 'deep'); }} key={q.id}><span class="section-number">{String(index + 1).padStart(2, '0')}</span><span><strong>{q.text}</strong><small>{withStage ? `${q.stage} · ` : ''}{q.depth === 'deep' ? '深一点 · 可跳过' : '轻松聊聊'}</small></span></button>;
  return <div class="ask-page"><div class="page-heading ask-heading"><h1>想问{name}什么？</h1><p class="intro">挑一件小事开头。{name}可以跳过，也可以想说时再说。</p></div>
    {recoveryCode && snapshot.member.role === 'organizer' && <RecoveryKeep familyId={snapshot.family.id} code={recoveryCode} notice={notice} collapsible />}
    {pending.length > 0 && <section class="note pending-question"><strong>待回答 · {pending.length}题</strong><p>{pending[0].text}</p><span>讲述人可以跳过，也可以稍后回答。</span>{snapshot.member.role === 'organizer' && <button class="quiet proxy-link" onClick={onRecord}>在{name}身边？去当面代录</button>}</section>}
    <section class="starter-questions" aria-labelledby="starter-title"><h2 id="starter-title" class="list-title">从一件小事问起</h2><div class="question-grid">{starters.map((q, index) => option(q, index, true))}</div></section>
    <details class="question-library"><summary>按人生阶段翻更多题</summary><label class="library-stage">翻到<select aria-label="按阶段翻题" value={libraryStage} onChange={(e) => setLibraryStage(e.currentTarget.value as Stage)}>{stages.map((s) => <option value={s} key={s}>{s}</option>)}</select></label>{library.length ? <div class="question-grid">{library.map((q, index) => option(q, index, false))}</div> : <p class="helper">这个阶段还没有现成的题，可以自己写一题。</p>}</details>
    <details class="ask-editor"><summary>自己写一题</summary><label>想问的问题<textarea aria-label="想问的问题" maxLength={120} rows={3} value={custom} placeholder="第一份工资，你先买了什么？" onInput={(e) => { setCustom(e.currentTarget.value); setPicked(null); }} /></label><div class="two-fields"><label>这件事在<select aria-label="问题阶段" value={stage} onChange={(e) => { setStage(e.currentTarget.value as Stage); setPicked(null); }}>{stages.map((s) => <option value={s} key={s}>{s}</option>)}</select></label><label class="check"><input type="checkbox" checked={deep} onChange={(e) => setDeep(e.currentTarget.checked)} /><span>可能触及难过的往事<br /><small>标为深一点，仍可跳过</small></span></label></div></details>
    {outgoing && <p class="selected-question">将送出：{outgoing}</p>}
    <ActionBar><p class="action-hint">{outgoing ? '只送去这道题，不催回答' : '先选一题，或写下想问的一件事'}</p><button class="primary full" disabled={busy} onClick={() => void submit()}>{busy ? '正在送去…' : '把这个问题送给家人'}</button></ActionBar>
  </div>;
}

function AnswerPage({ snapshot, notice, onSent, onSkip }: { snapshot: Snapshot; notice: Notice; onSent: () => Promise<void>; onSkip: (id: string) => Promise<void> }) {
  const pending = snapshot.asks.filter((ask) => ask.status === 'pending');
  const [chosen, setChosen] = useState<string | null>(null);
  const [answerState, setAnswerState] = useState<'ready' | 'recording' | 'draft'>('ready');
  const ask = pending.find((a) => a.id === chosen) || pending[0] || null;
  const previous = snapshot.stories.find((s) => s.id === ask?.parentStoryId);
  const continuationQuestions = previous?.followups.filter((f) => ask?.followupIds.includes(f.id)) || [];
  return <div class={`elder answer-state-${answerState}`}>
    {pending.length > 1 && <label class="question-switch">待回答 · {pending.length}题<select aria-label="选择待回答问题" disabled={answerState !== 'ready'} value={ask?.id} onChange={(e) => setChosen(e.currentTarget.value)}>{pending.map((a) => <option value={a.id} key={a.id}>{a.parentStoryId ? '接着讲 · ' : ''}{a.text}</option>)}</select></label>}
    <section class="elder-question"><p class="eyebrow">{ask ? `${snapshot.members.find((member) => member.id === ask.askedBy)?.name || '家人'}想问${snapshot.family.storytellerName}${ask.parentStoryId ? ' · 接着讲' : ''}` : `${snapshot.family.storytellerName} · 自由讲述`}</p><h1>{continuationQuestions.length ? continuationQuestions.map((f) => f.text).join('；') : ask?.text || '想起了哪段往事？'}</h1>
      {previous && <details class="continuation-context" open={answerState === 'ready'}><summary>接着这段：{previous.question}</summary>{previous.type === 'text' && <p class="original-fragment">{previous.text.slice(0, 160)}{previous.text.length > 160 ? '…' : ''}</p>}<ul>{continuationQuestions.map((f) => <li key={f.id}>{f.name}：{f.text}</li>)}</ul>{previous.type === 'audio' && <details><summary>试听上一段原声</summary><VoicePlayer src={`/api/stories/${previous.id}/audio`} label="上一段原声" title={`${snapshot.family.storytellerName} · 上一段`} duration={previous.duration || 0} onError={() => notice('上一段原声暂时播不了，请刷新核对访问权限。')} /></details>}</details>}
      {ask && answerState === 'ready' && <button class="quiet skip-question" onClick={() => void onSkip(ask.id)}>这题不想说，跳过</button>}
      {ask?.depth === 'deep' && <p class="helper">这题涉及深一点的往事，由你决定说不说。</p>}
    </section><Answer snapshot={snapshot} ask={ask} onSent={onSent} notice={notice} onStateChange={setAnswerState} />
  </div>;
}

function Wall({ snapshot, notice, operate }: { snapshot: Snapshot; notice: Notice; operate: (a: () => Promise<unknown>, m?: string) => Promise<void> }) {
  const [stage, setStage] = useState<Stage | '全部'>('全部');
  const stories = [...snapshot.stories].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const byId = new Map(stories.map((s) => [s.id, s]));
  const visible = new Set<string>();
  for (const story of stories.filter((s) => stage === '全部' || s.stage === stage)) {
    let current: Story | undefined = story;
    while (current) { visible.add(current.id); current = current.parentStoryId ? byId.get(current.parentStoryId) : undefined; }
  }
  const ordered: { story: Story; depth: number }[] = [];
  function append(story: Story, depth: number) {
    ordered.push({ story, depth });
    for (const child of stories.filter((s) => s.parentStoryId === story.id)) append(child, depth + 1);
  }
  for (const root of stories.filter((s) => !s.parentStoryId || !byId.has(s.parentStoryId))) append(root, 0);
  const ordinals = new Map(ordered.map(({ story }, i) => [story.id, i + 1]));
  return <div class="directory-page"><div class="page-heading directory-heading"><h1>{snapshot.family.storytellerName}的讲述</h1><p class="directory-receipt">{stories.length}段留存 · {stories.filter((s) => s.type === 'audio').length}段原声 · 仅已加入的家人可听</p></div>
    <div class="directory-filter"><label>翻到<select aria-label="筛选故事阶段" value={stage} onChange={(e) => setStage(e.currentTarget.value as Stage | '全部')}>{(['全部', ...stages] as const).map((s) => <option key={s} value={s}>{s === '全部' ? '全部往事' : s}</option>)}</select></label></div>
    {!visible.size && <section class="empty"><span class="section-number">—</span><h2>{stories.length ? '这个阶段还没有讲述' : '尚未留下讲述'}</h2><p>问题送去后，{snapshot.family.storytellerName}可以说一段或写一点。只有确认发送的内容会出现在目录里。</p></section>}
    <div class="story-list">{ordered.filter(({ story }) => visible.has(story.id)).map(({ story, depth }) => <StoryEntry key={story.id} story={story} depth={depth} ordinal={ordinals.get(story.id)!} parentOrdinal={story.parentStoryId ? ordinals.get(story.parentStoryId) : undefined} contextOnly={stage !== '全部' && story.stage !== stage} snapshot={snapshot} notice={notice} operate={operate} />)}</div>
  </div>;
}

function StoryEntry({ story, depth, ordinal, parentOrdinal, contextOnly, snapshot, notice, operate }: { story: Story; depth: number; ordinal: number; parentOrdinal?: number; contextOnly: boolean; snapshot: Snapshot; notice: Notice; operate: (a: () => Promise<unknown>, m?: string) => Promise<void> }) {
  const [followup, setFollowup] = useState(''); const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const parent = snapshot.stories.find((s) => s.id === story.parentStoryId);
  async function act(action: () => Promise<unknown>, message?: string) { setBusy(true); await operate(action, message); setBusy(false); }
  const askedBy = snapshot.members.find((m) => m.id === snapshot.asks.find((a) => a.id === story.askId)?.askedBy)?.name;
  return <article id={`story-${story.id}`} class={`story-entry${parent ? ' story-continuation' : ''}`} data-story-id={story.id} data-parent-id={story.parentStoryId || ''} data-depth={depth} style={{ '--story-depth': Math.min(depth, 2) }}><span class="story-index" aria-label={`第${ordinal}段`}>{parent && <span class="branch-mark" aria-hidden="true">↳</span>}{String(ordinal).padStart(2, '0')}</span><div class="story-content">
    {parent && <p class="parent-label"><button class="quiet" onClick={() => document.getElementById(`story-${parent.id}`)?.scrollIntoView({ block: 'start' })}>接着第{String(parentOrdinal).padStart(2, '0')}段</button><span>{parent.question}</span></p>}
    <div class="story-meta"><span>{askedBy ? `${askedBy}问` : '自己想起的往事'}{contextOnly ? ' · 上文' : ''}</span><time dateTime={story.createdAt}>{new Date(story.createdAt).toLocaleDateString('zh-CN')}</time></div><h2>{story.question}</h2><p class="story-attribution">{snapshot.family.storytellerName} · {story.type === 'audio' ? '原声' : '亲述文字'} · {story.stage}{story.recordedById !== story.storytellerId ? ` · ${story.recordedBy}知情代录` : ''}</p>
    {story.type === 'audio' ? <VoicePlayer src={`/api/stories/${story.id}/audio`} label="故事原声" title={`${snapshot.family.storytellerName} · 第${ordinal}段`} duration={story.duration || 0} onError={() => notice('原声暂时播不了：权限可能已撤销，或浏览器不支持这个格式。请刷新核对；不能保证微信里通播。')} /> : story.text.length > 240 ? <><p class="story-text text-excerpt">{story.text.slice(0, 240)}…</p><details class="story-fulltext"><summary>展开讲述全文</summary><p class="story-text">{story.text}</p></details></> : <p class="story-text">{story.text}</p>}
    {snapshot.member.role !== 'storyteller' && <div class="story-response"><button aria-pressed={story.myThen} class={`then-button ${story.myThen ? 'selected' : ''}`} disabled={busy} onClick={() => void act(() => json(`/stories/${story.id}/then`, { active: !story.myThen }, 'PUT'), story.myThen ? '已收回这次想听更多。' : '已告诉讲述人：我还想听，接着讲。')}>然后呢{story.thenCount ? ` · ${story.thenCount}位家人想听` : '，还想听'}<span aria-hidden="true">↗</span></button>{!!story.thenNames.length && <p class="helper">{story.thenNames.join('、')}想听更多。不是播放次数。</p>}</div>}
    {!!story.followups.length && <details class="followup-history"><summary>家人的追问 · {story.followups.length}条{story.followups.every((f) => f.answered) ? ' · 已接着讲' : ''}</summary><ul class="followups">{story.followups.map((f) => <li key={f.id}><strong>{f.name}</strong><span>{f.text}</span><small>{f.answered ? '已接着讲' : '等愿意时再说'}</small>{(f.memberId === snapshot.member.id || snapshot.member.role === 'organizer') && <button class="quiet" disabled={busy} onClick={() => void act(() => api(`/followups/${f.id}`, { method: 'DELETE' }), '已删除这条追问。')}>删除我的追问</button>}</li>)}</ul></details>}
    {snapshot.member.role !== 'storyteller' && <button class="quiet followup-toggle" aria-expanded={editing} aria-controls={`followup-${story.id}`} onClick={() => setEditing(!editing)}>{editing ? '收起追问编辑' : '写一个具体追问'}</button>}
    {snapshot.member.role !== 'storyteller' && editing && <form id={`followup-${story.id}`} noValidate class="followup-form" onSubmit={(event) => { event.preventDefault(); if (!followup.trim()) { notice('写下一件你还想知道的事，空追问不会发送。'); return; } void act(async () => { const result = await json(`/stories/${story.id}/followups`, { text: followup }); setFollowup(''); setEditing(false); return result; }, '追问已送去，讲述人可以接着讲。'); }}><label>还想问什么<textarea aria-label="还想问什么" rows={2} maxLength={120} value={followup} onInput={(event) => setFollowup(event.currentTarget.value)} placeholder="例如：那后来，你又见到那位朋友了吗？" /></label><button class="secondary" disabled={busy}>送去一个追问</button></form>}
    {story.canDelete && <div class="story-manage" role="group" aria-label="管理这段故事"><span aria-hidden="true">管理</span><button class="danger quiet" disabled={busy} onClick={() => { if (confirm('删除这段原声或文字及相关追问？家族里将不可再访问，但不能收回别人已下载的副本。')) void act(() => api(`/stories/${story.id}`, { method: 'DELETE' }), '已删除这段故事及服务端原声文件。已下载的副本不能收回。'); }}>删除这段故事</button></div>}
  </div></article>;
}

function Links({ kind, access, notice }: { kind: 'listener' | 'storyteller'; access: AccessLinks; notice: Notice }) {
  const url = `${location.origin}/#${kind === 'listener' ? 'j' : 's'}=${encodeURIComponent(access.token)}`;
  return <div class="access-card"><h3>{kind === 'listener' ? '提问／收听邀请' : '讲述人专属入口'}</h3><label>完整邀请链接<input readOnly aria-label={kind === 'listener' ? '收听邀请链接' : '讲述人邀请链接'} value={url} onFocus={(e) => e.currentTarget.select()} /></label><button class="secondary" onClick={() => void navigator.clipboard.writeText(url).then(() => notice('已复制。请私下给对应家人，链接持有人可能进入家族。', 'status')).catch(() => notice('浏览器没有允许复制，请长按上面的链接自行复制。'))}>复制入口</button>{access.passcode && <p>另行告诉家人六位加入码：<strong class="passcode">{access.passcode}</strong></p>}<p class="helper">链接不是公开分享卡。{kind === 'listener' ? '加入码只辅助新成员入场，不赋予管理权限。' : '仅给讲述人，不转发给其他人。'}</p></div>;
}

function Settings({ snapshot, recoveryCode, links, onLinks, notice, operate, onLogout }: { snapshot: Snapshot; recoveryCode: string; links: LinkState; onLinks: (kind: keyof LinkState, value: AccessLinks | null) => void; notice: Notice; operate: (a: () => Promise<unknown>, m?: string) => Promise<void>; onLogout: () => Promise<void> }) {
  const { listener, storyteller } = links; const [busy, setBusy] = useState(false);
  async function rotate(kind: 'listener' | 'storyteller') {
    if (!confirm(kind === 'listener' ? '换一份新收听邀请？旧链接不能再加入，但已加入的家人仍能听；需撤销成员才能阻止旧成员。' : '换一份讲述人入口？旧入口和讲述人的旧登录会话都会失效。')) return;
    setBusy(true);
    try { const access = await json<AccessLinks>('/invites/new', { kind }); onLinks(kind, access); notice('已生成新入口。旧入口已失效。', 'status'); }
    catch (error) { notice((error as Error).message); } finally { setBusy(false); }
  }
  async function removeMine() {
    if (!confirm('删除你本人提交的故事、提问和追问？不会删除其他家人已经提交的答案；已导出的副本无法收回。')) return;
    await operate(async () => {
      await waitForRecordingSave();
      await api('/content/mine', { method: 'DELETE' });
      for (const draft of await listDrafts(snapshot.member.id, snapshot.family.id)) await deleteDraft(draft.id);
    }, '本人内容已删除，本机未发送草稿也已清理；其他人的答案保留。');
  }
  return <div class="settings-page"><div class="page-heading"><p class="eyebrow">{snapshot.family.storytellerName}的讲述 · {snapshot.member.name}以{roleNames[snapshot.member.role]}身份进入</p><h1>家族权限</h1><p class="intro">邀请、保存与删除都在这里。家族内可听不等于可以公开转发。</p></div>
    {snapshot.member.role === 'organizer' && <>
      {recoveryCode && <RecoveryKeep familyId={snapshot.family.id} code={recoveryCode} notice={notice} />}
      <section class="ledger-section"><h2>给家人的入口</h2>{listener && <Links kind="listener" access={listener} notice={notice} />}<button class="secondary full" disabled={busy} onClick={() => void rotate('listener')}>生成新收听邀请，旧链接作废</button>{storyteller && <Links kind="storyteller" access={storyteller} notice={notice} />}<button class="secondary full" disabled={busy} onClick={() => void rotate('storyteller')}>生成新讲述人入口，撤销旧会话</button></section>
      <section class="ledger-section"><h2>家族成员</h2><p class="helper">撤销成员会禁止其会话及私有音频访问，无法收回已经缓冲、下载的内容。撤销收听成员也会使当前收听邀请失效，防止用旧链接再加入；其他已加入成员不受影响。重新邀请请生成新链接。</p><ul class="members">{snapshot.members.map((m) => <li key={m.id}><div><strong>{m.name}</strong><small>{roleNames[m.role]} · {m.revoked ? '已撤销' : '可以进入'}</small></div>{m.id !== snapshot.member.id && !m.revoked && <button class="danger secondary" onClick={() => { if (confirm(`撤销${m.name}的所有访问？`)) void operate(async () => { const result = await json(`/members/${m.id}/revoke`, {}); onLinks(m.role === 'listener' ? 'listener' : 'storyteller', null); return result; }, '已撤销这个成员的服务端访问，其旧邀请也已失效。'); }}>撤销访问</button>}</li>)}</ul></section>
    </>}
    <section class="ledger-section"><h2>导出与删除</h2><p>{snapshot.member.role === 'organizer' ? '管理者可以导出家族内容、管理全家故事；“删除本人内容”仍只删除自己的提交。' : snapshot.member.role === 'storyteller' ? '可导出和删除自己的讲述，包括家人知情代录的本人原声。' : '可导出和删除自己的提问、追问；不能删除讲述人的答案。'}</p><p class="helper">导出是JSON原始档案，内含原声数据，不是年度书或ZIP。请保存在你自己信任的地方，导出副本不再受撤销权限控制。</p><button class="secondary full" onClick={() => void downloadArchive().then(() => notice('已下载原始档案，请妥善保管。', 'status')).catch((error: Error) => notice(error.message))}>导出我有权保存的内容</button><button class="danger secondary full" onClick={() => void removeMine()}>删除本人内容与本机草稿</button></section>
    <section class="ledger-section"><h2>本地内测的真实边界</h2><p>故事和录音存放在运行服务的这台电脑。浏览器只通过登录后的私有接口取音频，不提供公开文件目录。</p><p>这台电脑的拥有者仍能读取磁盘文件。本地HTTP登录、磁盘权限、服务端隔离不是公网生产安全保证。没有云备份、转写或微信聊天读取。</p><p>本机草稿只在此浏览器暂存，清除缓存或存储故障可能丢失；确认发送后才在服务端持久化。不要把真实家庭隐私用作测试。</p></section>
    <button class="quiet full" onClick={() => void onLogout().catch((error: Error) => notice(error.message))}>退出此浏览器的家族访问</button>
  </div>;
}

render(<App />, document.getElementById('app')!);
