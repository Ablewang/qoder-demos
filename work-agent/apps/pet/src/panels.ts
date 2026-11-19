import type { Api } from './api.ts';
import type { ClientSettings } from './settings.ts';
import { personaDefaults, quietExplanation, deleteExplanation } from './settings.ts';
import type { CardAction, ChatResponse, CompanionSettings, LocalCard, MemoryItem, MemoryListResponse, NoticeRecord, Persona, PersonaView, PetState, PetUtterance } from '../../../src/contracts/index.ts';
import { el, button, factsNode, field, input, select, check, dialog, showError } from './dom.ts';
import { bridge } from './bridge.ts';
import { createPet } from './pet.ts';
export type PanelKind = 'notices' | 'memory' | 'chat' | 'settings' | 'onboarding' | 'help';
export interface PanelModel {
  api: Api; state: PetState; persona: PersonaView; settings: CompanionSettings; local: ClientSettings; notices: NoticeRecord[]; localUtterances: PetUtterance[];
  open(kind: PanelKind): Promise<void>; close(): void;
  quiet(mode: 'dnd' | 'demo' | 'off', minutes?: number): Promise<void>;
  saveLocal(patch: Partial<ClientSettings>): Promise<void>;
}
export class Panels {
  kind: PanelKind = 'notices';
  noticeDetailOpen = false;
  private content: HTMLElement;
  private noticeTab = 'unread';
  private memoryLayer = 'profile';
  private conversationId?: string;
  private chatNodes: HTMLElement[] = [];
  private displayGeneration = 0;
  private pageRevision = 0;
  private pendingUsers = new Set<HTMLElement>();
  constructor(readonly root: HTMLElement, private model: PanelModel) {
    root.className = 'panel'; this.content = el('section', undefined, 'panel-content');
  }
  async show(kind: PanelKind): Promise<void> {
    this.kind = kind; this.noticeDetailOpen = false; this.pageRevision++;
    const header = el('header'); header.append(el('strong', { notices: '通知中心', memory: '记忆', chat: '聊天', settings: '设置', onboarding: '首次见面', help: '本地帮助' }[kind]), button('×', () => this.model.close()));
    const nav = el('nav', undefined, 'panel-nav');
    if (kind !== 'onboarding') for (const [id, label] of [['notices','通知'],['chat','聊天'],['memory','记忆'],['settings','设置']] as const) nav.append(button(label, () => this.model.open(id)));
    this.content.replaceChildren(); this.root.replaceChildren(header, nav, this.content);
    if (this.model.state.activity === 'offline') this.content.append(el('p', '办公功能离线，请先唤醒后台', 'muted'));
    try {
      if (kind === 'notices') await this.notices();
      if (kind === 'memory') await this.memory();
      if (kind === 'chat') this.chat();
      if (kind === 'settings') this.settings();
      if (kind === 'onboarding') this.onboarding();
      if (kind === 'help') this.help();
    } catch (error) { showError(error instanceof Error ? error.message : '办公功能离线'); }
  }
  private async noticeOp(id: string, op: 'read' | 'snooze' | 'dismiss', minutes?: number): Promise<void> {
    const record = await this.model.api.request<NoticeRecord>(`/notices/${encodeURIComponent(id)}/${op}`, 'POST', op === 'snooze' ? { minutes: minutes || 15 } : undefined);
    this.model.notices = this.model.notices.filter(n => n.id !== id).concat(record); await this.show('notices');
  }
  private async notices(): Promise<void> {
    const tabs = el('div', undefined, 'tabs');
    for (const [id, title] of [['unread','未读'],['all','全部'],['snoozed','稍后']]) tabs.append(button(title, () => { this.noticeTab = id; return this.show('notices'); }, this.noticeTab === id ? 'selected' : ''));
    this.content.append(tabs, button('全部标为已读', async () => { for (const n of this.model.notices.filter(n => n.status === 'unread')) await this.model.api.request(`/notices/${encodeURIComponent(n.id)}/read`, 'POST'); await this.model.api.resync(); await this.show('notices'); }));
    const decision = el('details'); decision.append(el('summary', '待你决定'), el('p', '暂无。先行版不会替你执行任何操作。')); this.content.append(decision);
    const items = this.model.notices.filter(n => this.noticeTab === 'all' || n.status === this.noticeTab).sort((a,b) => b.updatedAt-a.updatedAt);
    for (const record of items) {
      const card = el('article', undefined, 'notice card'); const notice = record.notice;
      card.dataset.noticeId = record.id;
      card.append(button(notice.sensitivity === 'secret' ? '一条机密通知' : notice.title, () => this.noticeDetail(record), 'title-button'));
      if (notice.sensitivity !== 'secret') card.append(factsNode(notice.facts, 2));
      const status = { unread:'未读', read:'已读', snoozed:`稍后到 ${new Date(record.snoozedUntil || 0).toLocaleTimeString([], { hour:'2-digit',minute:'2-digit' })}`, dismissed:'已忽略' }[record.status];
      card.append(el('small', `${notice.kind.startsWith('dev.') ? '测试 · ' : ''}${new Date(record.createdAt).toLocaleString()} · ${status}`, 'muted')); this.content.append(card);
    }
    if (!items.length) this.content.append(el('p', '这里还没有通知', 'muted'));
    if(this.model.localUtterances.length){this.content.append(el('h3','完整台词（仅本次运行）'));for(const u of this.model.localUtterances)this.content.append(el('p',u.text));}
  }
  private async noticeDetail(record: NoticeRecord): Promise<void> {
    this.noticeDetailOpen = true;
    record = await this.model.api.request<NoticeRecord>(`/notices/${encodeURIComponent(record.id)}/read`, 'POST');
    this.model.notices = this.model.notices.filter(item => item.id !== record.id).concat(record);
    const n = record.notice; this.content.replaceChildren(button('← 返回列表', () => this.show('notices')), el('h2', n.title), factsNode(n.facts));
    this.content.append(el('h3','为什么提醒'), el('p',n.why || '来源没有说明'), el('h3','依据'));
    if (n.kind.startsWith('dev.')) this.content.append(el('p','开发测试通知，没有外部依据'));
    else if (n.kind.startsWith('companion.')) this.content.append(el('p','团子本地记录'));
    else if (n.evidence.length) for (const evidence of n.evidence) this.content.append(el('p', `${evidence.kind}: ${evidence.id}`));
    else this.content.append(el('p','来源没有说明'));
    this.content.append(el('h3','下一步'),el('p',n.nextStep || '来源没有说明'),el('p',n.body || ''));
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate()+1); tomorrow.setHours(9,30,0,0);
    for (const [minutes,label] of [[15,'稍后 15 分钟'],[60,'稍后 1 小时'],[Math.ceil((tomorrow.getTime()-Date.now())/60000), '稍后 明天 09:30']] as const) {
      const btn=button(label, () => this.noticeOp(record.id,'snooze',minutes));
      if(minutes>1440){btn.disabled=true;btn.title='超出当前协议的 24 小时上限，请先选其他稍后时长';}
      this.content.append(btn);
    }
    this.content.append(button('忽略',() => this.noticeOp(record.id,'dismiss')));
    const link = button('打开链接',() => {}); link.disabled = true; link.title = '数据源未接入'; this.content.append(link);
  }
  private async memory(): Promise<void> {
    const generation = this.displayGeneration, revision = this.pageRevision;
    const current = () => generation === this.displayGeneration && revision === this.pageRevision;
    const tabs = el('div',undefined,'tabs');
    for (const [layer,label] of [['profile','画像'],['long_term','长期'],['journal','日记']]) tabs.append(button(label,() => {this.memoryLayer=layer;return this.show('memory');},this.memoryLayer===layer?'selected':''));
    this.content.append(tabs);
    let path = `/memory?layer=${this.memoryLayer}&limit=200`;
    if (this.memoryLayer === 'journal') {
      const date = input(new Date().toLocaleDateString('en-CA'),10,'date'); this.content.append(field('日期',date),button('查看这天',async () => { const result = await this.model.api.request<MemoryListResponse>(`/memory/journal?date=${date.value}`); if(current())this.renderMemories(result.items); }));
      path = `/memory/journal?date=${date.value}`;
    } else this.content.append(button('+ 新增',() => this.memoryEditor()));
    const result = await this.model.api.request<MemoryListResponse>(path);
    if(!current())return;
    this.renderMemories(result.items);
    this.content.append(button('在文件夹中打开',() => bridge.folder()),el('p','手写无标记的行只会导入为事实；改成规则请用面板。','muted'));
  }
  private renderMemories(items: MemoryItem[]): void {
    this.content.querySelector('.memory-list')?.remove(); const list = el('div',undefined,'memory-list');
    for (const item of items) {
      const row = el('article',undefined,'card memory-item'); row.dataset.memoryId=item.id;
      const expired = item.validUntil !== undefined && item.validUntil <= Date.now(); if (expired) row.classList.add('expired');
      row.append(el('p',item.text,'memory-text'));
      const origin = item.origin.kind === 'user' ? item.origin.evidenceType==='message' ? '你在聊天里说的' : '你手动添加的' : item.origin.kind==='companion' ? '团子自己记的' : '外部事实';
      row.append(el('small', `${item.kind} · ${origin} · ${new Date(item.createdAt).toLocaleString()}${item.sensitivity==='confidential'?' · 敏感':''}${item.validUntil?` · ${expired?'已过期':'有效期'} ${new Date(item.validUntil).toLocaleString()}`:''}`, 'muted'));
      if (item.kind !== 'episode') row.append(button('编辑',() => this.memoryEditor(item)),button(item.kind==='rule'?'改成事实':'改成规则',async () => {await this.model.api.request(`/memory/${encodeURIComponent(item.id)}/retype`,'POST',{kind:item.kind==='rule'?'fact':'rule'});await this.show('memory');}));
      row.append(button('删除',() => dialog(deleteExplanation,'删除',async () => {await this.model.api.request(`/memory/${encodeURIComponent(item.id)}`,'DELETE');await this.show('memory');}),'danger'));
      list.append(row);
    }
    if (this.memoryLayer==='journal' && items.length) list.append(button('删除这一天',() => dialog(deleteExplanation,'删除',async () => {for(const item of items) await this.model.api.request(`/memory/${encodeURIComponent(item.id)}`,'DELETE');await this.show('memory');}),'danger'));
    if (!items.length) list.append(el('p','这一页还没有记忆','muted')); this.content.append(list);
  }
  private memoryEditor(item?: MemoryItem): void {
    const text = el('textarea'); text.value=item?.text||'';text.minLength=2;text.maxLength=200;
    const kind = select([['rule','规则'],['fact','事实']],item?.kind || (this.memoryLayer==='profile'?'rule':'fact'));
    const until=input(item?.validUntil?localDateTime(item.validUntil):'',30,'datetime-local'); const confidential=check(item?.sensitivity==='confidential');
    const form = el('form',undefined,'editor');form.append(field('原文（2–200 字）',text),field('类型',kind),field('有效期',until),field('敏感（仅面板显示）',confidential),button('保存',async () => {
      if (Array.from(text.value.trim()).length<2 || Array.from(text.value).length>200) {showError('原文需要 2–200 字');return;}
      const validUntil=until.value?new Date(until.value).getTime():undefined;
      if (item) {
        await this.model.api.request(`/memory/${encodeURIComponent(item.id)}`,'PATCH',{text:text.value,sensitivity:confidential.checked?'confidential':'normal',validUntil:validUntil??null});
        if (kind.value!==item.kind) await this.model.api.request(`/memory/${encodeURIComponent(item.id)}/retype`,'POST',{kind:kind.value});
      } else await this.model.api.request('/memory','POST',{text:text.value,kind:kind.value,layer:kind.value==='rule'?'profile':'long_term',sensitivity:confidential.checked?'confidential':'normal',validUntil});
      await this.show('memory');
    }),button('取消',() => this.show('memory')));this.content.replaceChildren(form);
  }
  private chat(): void {
    this.content.append(el('p','本地模式：我还没接上脑子（模型），只听得懂下面这些话。','local-mode'));
    const history=el('div',undefined,'chat-history');history.append(...this.chatNodes);this.content.append(history);
    const message=input('',400);message.placeholder='记住 周五下午不排会';message.setAttribute('aria-label','聊天输入');
    const send=async () => {if(!message.value.trim())return;const value=message.value;message.value='';const user=el('p',value,'chat-user');history.append(user);this.chatNodes.push(user);
      const generation=this.displayGeneration;this.pendingUsers.add(user);
      try {
        const response=await this.model.api.request<ChatResponse>('/chat','POST',{message:value,conversationId:this.conversationId});
        if(generation!==this.displayGeneration||user.dataset.invalidated==='true')return;
        this.conversationId=response.conversationId;
        const memoryIds=JSON.stringify([...new Set(response.chunks.flatMap(chunk=>chunk.kind==='memory'?[chunk.itemId]:chunk.kind==='card'?[...(chunk.card.items||[]).map(item=>item.id),...(chunk.card.actions||[]).flatMap(action=>'memoryId' in action?[action.memoryId]:[])]:[]))]);
        user.dataset.memoryIds=memoryIds;
        for(const chunk of response.chunks) {let node:HTMLElement|undefined;if(chunk.kind==='text')node=el('p',chunk.text,'chat-answer');if(chunk.kind==='error')node=el('p',chunk.message,'error');if(chunk.kind==='card')node=this.localCard(chunk.card);if(node){node.dataset.memoryIds=memoryIds;history.append(node);this.chatNodes.push(node);}}history.scrollTop=history.scrollHeight;
      } catch(error) {if(generation===this.displayGeneration&&user.dataset.invalidated!=='true')throw error;}
      finally {this.pendingUsers.delete(user);}
    };
    const form=el('form');form.append(message,button('发送',send));form.addEventListener('submit',e=>{e.preventDefault();void send().catch(()=>showError('办公功能离线'));});
    message.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();void send().catch(()=>showError('办公功能离线'));}});
    this.content.append(form);const shortcuts=el('div',undefined,'shortcuts');
    for(const [label,value] of [['记住…','记住 '],['我记得什么','你记得什么'],['提醒我…','30 分钟后提醒我'],['勿扰','勿扰 1 小时'],['有什么通知','有什么通知'],['帮助','你会什么']])shortcuts.append(button(label,()=>{message.value=value;message.focus();}));this.content.append(shortcuts);
  }
  private localCard(card: LocalCard): HTMLElement {
    const node=el('article',undefined,'card local-card');node.dataset.sensitivity=card.sensitivity;
    node.dataset.memoryIds=JSON.stringify([...(card.items||[]).map(item=>item.id),...(card.actions||[]).flatMap(action=>'memoryId' in action?[action.memoryId]:[])]);
    const reminder=card.actions?.find(action=>action.action==='reminder_cancel');
    if(reminder?.action==='reminder_cancel')node.dataset.reminderId=reminder.reminderId;
    node.append(el('h3',card.title));if(card.facts)node.append(factsNode(card.facts));
    for(const item of card.items||[])node.append(el('p',item.text,'memory-text'),el('small',[item.kind,item.note].filter(Boolean).join(' · '),'muted'));
    for(const action of card.actions||[]) {
      const btn=button(action.label,async()=>{
        if(node.dataset.invalidated==='true')return;
        const generation=this.displayGeneration;
        const current=()=>generation===this.displayGeneration&&node.dataset.invalidated!=='true';
        try {
          const oldId='memoryId' in action?action.memoryId:undefined;const newId=await this.cardAction(action,current);
          if(!current())return;
          if(newId&&oldId)for(const sibling of card.actions||[])if('memoryId' in sibling&&sibling.memoryId===oldId)sibling.memoryId=newId;
          if(action.action==='memory_retype'&&card.facts){const type=card.facts.find(fact=>fact.label==='类型');if(type){type.value=action.kind;node.querySelector('dl')?.replaceWith(factsNode(card.facts));}}
          btn.disabled=true;
        } catch(error) {if(current())throw error;}
      });
      if(action.action==='memory_undo' && card.undoUntil) {const ms=card.undoUntil-Date.now();if(ms<=0)btn.disabled=true;else setTimeout(()=>{btn.disabled=true;btn.title='撤销已过期，请去记忆面板删除';},ms);}
      node.append(btn);
    }
    return node;
  }
  invalidateMemoryDisplay(): void {
    this.displayGeneration++; this.pageRevision++;
    for(const node of this.chatNodes) {
      const pending=this.pendingUsers.has(node);
      if(!pending&&!(JSON.parse(node.dataset.memoryIds||'[]') as string[]).length)continue;
      node.replaceChildren(el('p',pending?'连接已刷新，本次回复未展示，请先查看记忆或提醒':'连接已刷新，记忆请重新查询'));
      node.dataset.memoryIds='[]';node.dataset.invalidated='true';
    }
    if(this.kind==='memory')this.content.replaceChildren(el('p','连接已刷新，记忆请重新查询','muted'));
  }
  eraseMemory(id: string): void {
    for (const node of this.chatNodes) if ((JSON.parse(node.dataset.memoryIds||'[]') as string[]).includes(id)) {
      node.replaceChildren(el('p',node.classList.contains('chat-user')?'相关记忆输入已删除':'记忆已遗忘，请重新查询'));
      node.dataset.memoryIds='[]';node.dataset.invalidated='true';
    }
  }
  eraseReminder(id: string): void {
    for (const node of this.chatNodes) if (node.dataset.reminderId === id) {node.replaceChildren(el('p','提醒已取消'));node.dataset.invalidated='true';}
  }
  private async cardAction(action: CardAction, current: () => boolean): Promise<string | void> {
    if(action.action==='open_panel'){await this.model.open(action.panel);return;}
    if(action.action==='quiet'){await this.model.quiet(action.mode,action.minutes);return;}
    if(action.action==='memory_forget') {dialog(action.confirm || deleteExplanation,'确认忘掉',async()=>{if(!current())return;try{await this.model.api.request(`/memory/${encodeURIComponent(action.memoryId)}`,'DELETE');if(current())this.content.append(el('p','忘掉了，文件和索引里都删干净了。'));}catch(error){if(current())throw error;}});return;}
    if(action.action==='memory_undo'){await this.model.api.request(`/memory/${encodeURIComponent(action.memoryId)}`,'DELETE');return;}
    if(action.action==='memory_retype'){const item=await this.model.api.request<MemoryItem>(`/memory/${encodeURIComponent(action.memoryId)}/retype`,'POST',{kind:action.kind});return item.id;}
    if(action.action==='reminder_cancel')await this.model.api.request(`/reminders/${encodeURIComponent(action.reminderId)}`,'DELETE');
  }
  private help(): void {this.content.append(el('p','左键只和团子玩：轻点、双击、摸头、拖拽；右键菜单打开通知、聊天、记忆和设置。'),el('p','我只会本地记事、提醒、勿扰和查通知。数据源、模型和对外执行尚未接入。'),el('p','记住… / 忘掉… / 你记得什么 / 30 分钟后提醒我… / 勿扰 1 小时 / 有什么通知'));}
  private settings(): void {
    const groups=el('div',undefined,'settings-groups');this.content.append(groups);
    const group=(title:string):HTMLElement=>{const node=el('details');node.append(el('summary',title));groups.append(node);return node;};
    const persona=group('人格');this.personaEditor(persona);
    const appearance=group('外观');const size=select([['96','小 96'],['112','中 112'],['128','大 128']],String(this.model.local.size));
    size.onchange=()=>void this.model.saveLocal({size:Number(size.value) as ClientSettings['size']});appearance.append(field('大小',size),el('p','拖到哪里就留在哪里，不自动吸附或跟随窗口。','muted'));
    for(const [id,label] of [['headset_mint','耳麦薄荷绿'],['headset_sakura','耳麦樱花粉'],['nightcap','睡帽'],['ball_yarn','毛线球'],['act_read_notebook','翻小本子']]) {
      const box=check(this.model.local.decorations.includes(id));box.disabled=!this.model.state.growth.unlocked.includes(id);box.onchange=()=>void this.model.saveLocal({decorations:box.checked?[...this.model.local.decorations,id]:this.model.local.decorations.filter(x=>x!==id)});appearance.append(field(`${label}${box.disabled?'（尚未解锁）':''}`,box));
    }
    const disturbance=group('打扰');disturbance.append(el('p',quietExplanation,'muted'));
    for(const [label,minutes] of [['勿扰 30 分钟',30],['勿扰 1 小时',60],['勿扰 2 小时',120],['勿扰到下班',this.untilWorkEnd()],['勿扰直到关闭',undefined]] as const)disturbance.append(button(label,()=>this.model.quiet('dnd',minutes)));
    disturbance.append(button('演示模式（隐藏团子）',()=>this.model.quiet('demo')),button('取消勿扰',()=>this.model.quiet('off')));
    const shortcut=input(this.model.local.shortcut,80);disturbance.append(field('演示快捷键',shortcut),button('保存快捷键',async()=>{await bridge.shortcut(shortcut.value);await this.model.saveLocal({shortcut:shortcut.value});}));
    const badge=check(this.model.local.badgeInQuiet);badge.onchange=()=>void this.model.saveLocal({badgeInQuiet:badge.checked});disturbance.append(field('勿扰时显示角标（演示始终隐藏）',badge));
    const settings=this.model.settings;
    const save=async(patch:Partial<CompanionSettings>)=>{this.model.settings=await this.model.api.request<CompanionSettings>('/pet/settings','PUT',patch);};
    const cap=select([['0','0'],['1','1'],['2','2'],['3','3']],String(settings.dailyBubbleCap));cap.onchange=()=>void save({dailyBubbleCap:Number(cap.value)});disturbance.append(field('每日主动气泡上限',cap));
    for(const [key,label] of [['offworkReminder','下班提醒'],['discloseConfidentialInBubble','气泡披露敏感通知'],['sleepAfterWork','下班后睡觉']] as const){const box=check(settings[key]);box.onchange=()=>void save({[key]:box.checked});disturbance.append(field(label,box));}
    const start=input(settings.workHours.start,5,'time'),end=input(settings.workHours.end,5,'time'),days=input(settings.workHours.days.join(','),20);
    disturbance.append(field('工作日（0=周日，逗号分隔）',days),field('上班',start),field('下班',end),button('保存工作时间',()=>save({workHours:{days:days.value.split(',').map(Number).filter(n=>Number.isInteger(n)&&n>=0&&n<=6),start:start.value,end:end.value}})));
    const fun=group('自娱');const frequency=select([['off','关'],['low','低（10–15 分钟）'],['medium','中（3–6 分钟）']],this.model.local.entertainment);frequency.onchange=()=>void this.model.saveLocal({entertainment:frequency.value as ClientSettings['entertainment']});fun.append(field('频率',frequency));
    const audio=group('音频');const enabled=check(this.model.state.audio.enabled);const volume=input(String(this.model.state.audio.volume),4,'range');volume.min='0';volume.max='1';volume.step='.01';
    const saveAudio=async()=>{this.model.state=await this.model.api.request<PetState>('/pet/audio','PUT',{enabled:enabled.checked,volume:Number(volume.value)});};enabled.onchange=()=>void saveAudio();volume.oninput=()=>void saveAudio();
    audio.append(el('p','默认无声音。启用后点播放，合成本机原创轻柔循环，不联网。','muted'),field('真实音频',enabled),field('音量（默认 30%）',volume),button('播放',()=>bridge.send('audio-command','play')),button('暂停',()=>bridge.send('audio-command','pause')),button('静音',()=>bridge.send('audio-command','mute')));
    const memory=group('记忆');memory.append(button('打开记忆目录',()=>bridge.folder()),button('重建索引',async()=>{await this.model.api.request('/memory/reindex','POST');showError('索引已重建');}),el('p','只通过后台请求重建，不直接读取记忆文件。','muted'));
    const dev=group('开发');const accept=check(settings.acceptDevNotices);accept.onchange=()=>void save({acceptDevNotices:accept.checked});dev.append(field('接收开发测试通知',accept),el('p','窗口几何：macOS 实现尚待桌面验收；共享屏幕识别：未知。','muted'));
    if(window.__PET_TEST__)dev.append(button('成长快进（测试构建）',()=>bridge.send('test-growth',true)));
    groups.append(el('p','开机自启：后续版本','muted'));
  }
  untilWorkEnd(): number {const [h,m]=this.model.settings.workHours.end.split(':').map(Number);const date=new Date();date.setHours(h,m,0,0);return Math.max(1,Math.ceil((date.getTime()-Date.now())/60000));}
  private personaEditor(root: HTMLElement): void {
    const p=structuredClone(this.model.persona.persona);const form=el('div');this.personaFields(form,p);
    form.append(button('保存人格',async()=>{if(!this.validatePersona(p))return;this.model.persona=await this.model.api.request<PersonaView>('/pet/persona','PUT',p);showError('人格已保存');}));root.append(form);
  }
  private validatePersona(p:Persona):boolean {
    if(!p.name.trim()||!p.addressUser.trim()||p.traits.length>6||p.traits.some(t=>Array.from(t).length>6)||p.catchphrases.length>3||p.catchphrases.some(t=>Array.from(t).length>12)||p.taboos.length>5||p.taboos.some(t=>Array.from(t).length>20)){showError('请检查名字、性格、口头禅和禁忌的数量与长度');return false;}return true;
  }
  private personaFields(root:HTMLElement,p:Persona,step?:number):void {
    const add=(n:number,label:string,node:HTMLElement)=>{if(step===undefined||step===n)root.append(field(label,node));};
    const name=input(p.name,8);name.oninput=()=>{p.name=name.value;};add(1,'名字（1–8 字）',name);
    const address=select([['你','你'],['老板','老板'],['同学','同学'],['custom','自定义']],['你','老板','同学'].includes(p.addressUser)?p.addressUser:'custom');const custom=input(p.addressUser,6);address.onchange=()=>{if(address.value!=='custom'){p.addressUser=address.value;custom.value=p.addressUser;}};custom.oninput=()=>{p.addressUser=custom.value;address.value='custom';};add(2,'怎么称呼你',address);add(2,'自定义称呼（1–6 字）',custom);
    const presets=['靠谱','元气','佛系','毒舌','爱操心','温柔','傲娇','呆萌'];const traits=el('div',undefined,'trait-options');
    for(const trait of presets){const box=check(p.traits.includes(trait));box.onchange=()=>{if(box.checked&&p.traits.filter(t=>presets.includes(t)).length>=3){box.checked=false;showError('预设性格最多选 3 个');return;}p.traits=box.checked?[...p.traits,trait]:p.traits.filter(t=>t!==trait);};traits.append(field(trait,box));}add(3,'性格（选 1–3 个）',traits);
    const extra=input(p.traits.filter(t=>!presets.includes(t)).join('，'),24);extra.oninput=()=>{p.traits=[...p.traits.filter(t=>presets.includes(t)),...split(extra.value).slice(0,3)];};add(3,'自定义性格（最多 3 个，每个 6 字）',extra);
    if(step===undefined||step===3)root.append(el('p','自定义性格会记在档案里，等以后接上模型才会影响说话。','muted'));
    const style=select([['terse','简短'],['normal','正常'],['chatty','话多']],p.speakingStyle.verbosity),emoji=check(p.speakingStyle.emoji),formality=select([['casual','随意'],['neutral','平实']],p.speakingStyle.formality);
    const preview=el('p','再往左一点点～','preview-line');const updatePreview=()=>{preview.textContent=p.speakingStyle.verbosity==='terse'?'舒服。':p.speakingStyle.verbosity==='chatty'?'被摸头了，心情变软。好舒服！':'再往左一点点～';};style.onchange=()=>{p.speakingStyle.verbosity=style.value as Persona['speakingStyle']['verbosity'];updatePreview();};emoji.onchange=()=>{p.speakingStyle.emoji=emoji.checked;};formality.onchange=()=>{p.speakingStyle.formality=formality.value as Persona['speakingStyle']['formality'];};add(4,'说话风格',style);add(4,'带 emoji',emoji);add(4,'语气',formality);if(step===undefined||step===4)root.append(preview);
    const phrases=input(p.catchphrases.join('，'),40);phrases.oninput=()=>{p.catchphrases=split(phrases.value);};add(5,'口头禅（0–3 条，每条 12 字）',phrases);
    const taboos=input(p.taboos.join('，'),104);taboos.oninput=()=>{p.taboos=split(taboos.value);};add(6,'禁忌（0–5 条）',taboos);if(step===undefined||step===6)root.append(button('别叫我胖',()=>{p.taboos=[...p.taboos,'别叫我胖'];taboos.value=p.taboos.join('，');}),button('别开加班的玩笑',()=>{p.taboos=[...p.taboos,'别开加班的玩笑'];taboos.value=p.taboos.join('，');}),el('p','只能挡住包含这些词的话。','muted'));
    if(step===undefined){const desc=el('textarea');desc.maxLength=2000;desc.value=p.description;desc.oninput=()=>{p.description=desc.value;};root.append(field('自由描述（Markdown，纯文本）',desc));}
  }
  private onboarding():void {
    const p=structuredClone(personaDefaults);let step=0;const draw=()=>{
      this.content.replaceChildren();const preview=createPet();preview.dataset.action=step===0?'drop_land':'idle_breathe';this.content.append(preview,el('p',step===0?'嗨，我是一只还没有名字的团子。':`第 ${step}/8 步`));
      const done=async()=>{if(!this.validatePersona(p))return;this.model.persona=await this.model.api.request<PersonaView>('/pet/persona','PUT',p);await this.model.open('notices');};
      if(step===0){this.content.append(button('给我取名',()=>{step=1;draw();}),button('先用默认',()=>{step=8;draw();}));return;}
      if(step<=6){this.personaFields(this.content,p,step);this.content.append(button('下一步',()=>{step++;draw();}),button('跳过',()=>{step++;draw();}));return;}
      if(step===7){this.content.append(el('p','不看屏幕内容；听歌默认没有声音；右键或菜单栏可以“勿扰”和“演示模式（一键隐藏）”；记忆随时能看、能改、能删。'),button('知道了',()=>{step=8;draw();}));return;}
      this.content.append(el('p',`我是${p.name}，以后就趴在${p.addressUser}窗口边。`),button('完成',done));
      if(p.name===personaDefaults.name && p.addressUser===personaDefaults.addressUser && step===8)void done();
    };draw();
  }
}
function split(s:string):string[]{return s.split(/[,，\n]/).map(v=>v.trim()).filter(Boolean);}
function localDateTime(ms:number):string{const date=new Date(ms);const local=new Date(ms-date.getTimezoneOffset()*60000);return local.toISOString().slice(0,16);}
