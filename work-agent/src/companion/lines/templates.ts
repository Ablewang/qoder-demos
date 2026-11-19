export type LineEvent = 'first' | 'pet' | 'poke' | 'drag' | 'drop' | 'morning' | 'offwork' | 'notice' | 'remember' | 'forgotten' | 'quiet' | 'restored' | 'quiet_end' | 'unknown' | 'credential' | 'help' | 'not_found' | 'about_empty';
export interface LineTemplate { text: string; tags?: string[]; tone?: string }
export type LineStyles = Record<'terse' | 'normal' | 'chatty', LineTemplate[]>;
const line = (text: string, tags?: string[], tone?: string): LineTemplate => ({ text, tags, tone });
const simple = (terse: string[], normal: string[], chatty: string[]): LineStyles => ({ terse: terse.map((x) => line(x)), normal: normal.map((x) => line(x)), chatty: chatty.map((x) => line(x)) });

export const LINES: Record<LineEvent, LineStyles> = {
  first: simple(['我是{name}。', '{name}，到岗。'], ['{addressUser}好，我是{name}，以后就在桌面陪你了。', '有事我会举牌子，右键菜单能看通知。'], ['新桌面！{addressUser}你好呀，我是{name}～摸头、戳戳、拖来拖去都可以，有事我举小牌子。{catchphrase}']),
  pet: { terse: [line('嗯。'), line('舒服。'), line('就一下。', ['傲娇'])], normal: [line('再往左一点点～', ['俏皮']), line('摸归摸，活别停。', ['毒舌']), line('被摸头了，心情变软。', ['温柔'])], chatty: [line('好舒服！今天第 {count} 次啦！', ['元气']), line('头顶好像长出小花了……{catchphrase}', ['呆萌', '俏皮'])] },
  poke: { terse: [line('在。'), line('扁了。', ['傲娇'])], normal: [line('我在我在，戳戳会弹回来。'), line('戳我不如戳那个待办。', ['毒舌'])], chatty: [line('哎呀被戳扁了……弹回来！', ['俏皮']), line('戳吧戳吧，反正会弹回来。', ['佛系'])] },
  drag: { terse: [line('哇。')], normal: [line('抱紧耳麦！'), line('去哪都行。', ['佛系'])], chatty: [line('飞起来啦，慢点慢点，耳麦要掉了！', ['俏皮'])] },
  drop: { terse: [line('到。')], normal: [line('这儿视野不错。'), line('就位，我趴这儿。', ['靠谱'])], chatty: [line('落地成功！这个窗口边软软的，我就趴这儿啦。{catchphrase}')] },
  morning: { terse: [line('早。')], normal: [line('早，{addressUser}。有 {unread} 条未读。'), line('早，先喝口水再开工。', ['爱操心'])], chatty: [line('早上好呀{addressUser}！小球我擦干净了，有 {unread} 条未读等你看～')] },
  offwork: { terse: [line('到点了。')], normal: [line('到下班时间了，{addressUser}。'), line('没做完的说一句“记住：…”，明天我还在。', ['爱操心'])], chatty: [line('下班啦！今天辛苦了，伸个懒腰再走～', ['元气']), line('活是干不完的，明天见。', ['佛系'])] },
  notice: { terse: [line('有新通知。')], normal: [line('{addressUser}，有件事：'), line('又来活了：', ['毒舌']), line('这条可能要留意：', undefined, 'concern')], chatty: [line('叮！来了一条通知，事实都在下面：'), line('这条跟你有关，慢慢看：', undefined, 'care')] },
  remember: simple(['记下了。'], ['记住了，不对可以点撤销。'], ['小本本记好啦！想改类型或撤销都在下面。']),
  forgotten: simple(['删了。'], ['忘掉了，文件和索引里都删干净了。'], ['已经彻底忘掉了，文件和索引都没留。想再记就说“记住”。']),
  quiet: simple(['安静。'], ['好，我安静 {duration}，有事先攒着，结束后一起说。'], ['收到，我缩成一小团安静 {duration}，通知先帮你攒着，结束后一次说清楚。']),
  restored: simple(['回来了。'], ['后台恢复了，办公功能重新上线；离线期间我没处理任何事。'], ['我醒啦！刚才后台断了，这段时间我什么都没同步、没记，现在恢复正常～']),
  quiet_end: simple(['安静期间来了 {count} 条。'], ['安静期间来了 {count} 条。'], ['安静期间来了 {count} 条。']),
  unknown: simple(['这个我还不会，现在只会记事、提醒、勿扰和查通知。'], ['这个我还不会，现在只会记事、提醒、勿扰和查通知。'], ['这个我还不会，现在只会记事、提醒、勿扰和查通知。']),
  credential: simple(['这看起来像密码或密钥，我不记这种东西。'], ['这看起来像密码或密钥，我不记这种东西。'], ['这看起来像密码或密钥，我不记这种东西。']),
  help: simple(['现在只会记事、提醒、勿扰和查通知。'], ['现在只会记事、提醒、勿扰和查通知。'], ['现在只会记事、提醒、勿扰和查通知。']),
  not_found: simple(['没找到相关记忆。'], ['没找到相关记忆。'], ['没找到相关记忆。']),
  about_empty: simple(['关于这件事我还没记过什么。'], ['关于这件事我还没记过什么。'], ['关于这件事我还没记过什么。']),
};

export const FALLBACK_LINES: Record<LineEvent, string[]> = {
  first: ['我是{name}。', '{name}，到岗。', '{name}来了。', '{name}在这里。', '你好，我是{name}。', '以后一起工作。'],
  pet: ['嗯。', '舒服。', '很舒服。', '谢谢摸头。', '眯一会儿眼。', '被摸头啦。'],
  poke: ['在。', '弹回来了。', '我在这里。', '收到戳戳。', '晃了一下。', '戳到了。'],
  drag: ['哇。', '抱紧耳麦。', '被拖起来啦。', '悬空了。', '慢一点。', '轻轻放下就好。'],
  drop: ['到。', '就位。', '落地了。', '趴好了。', '就在这里。', '安稳着陆。'],
  morning: ['早。', '早上好。', '早，{addressUser}。', '新的一天到了。', '早安。', '今天也一起工作。'],
  offwork: ['到点了。', '下班时间到了。', '可以歇一歇了。', '今天辛苦了。', '伸个懒腰吧。', '到下班时间了。'],
  notice: ['有新通知。', '新通知到了。', '通知已收到。', '有一条通知。', '这里有条新通知。', '新通知在这里。'],
  remember: ['记下了。', '记住了。', '已记在本子里。', '这条已经记下。', '记忆已保存。', '已记录，可在记忆里查看。'],
  forgotten: ['删了。', '忘掉了。', '这条已删除。', '文件和索引里已删除。', '已从记忆中删除。', '这条已经忘掉。'],
  quiet: ['安静。', '好，先安静。', '通知先攒着。', '我先安静下来。', '安静模式已开启。', '结束后再一起说。'],
  restored: ['回来了。', '后台恢复了。', '本地功能恢复了。', '办公功能重新上线。', '后台重新连接了。', '我醒了，本地功能可用了。'],
  quiet_end: ['安静期间来了 {count} 条。', '安静时收到 {count} 条通知。', '安静期间有 {count} 条新通知。', '这段安静时间来了 {count} 条。', '攒了 {count} 条通知。', '安静期间收到通知 {count} 条。'],
  unknown: ['这个我还不会，现在只会记事、提醒、勿扰和查通知。', '还听不懂这句；现在只会记事、提醒、勿扰和查通知。', '这句还不会，只支持记事、提醒、勿扰和查通知。', '本地模式只会记事、提醒、勿扰和查通知。', '暂时不会这个；可以记事、提醒、勿扰和查通知。', '这件事还不会；现在能记事、提醒、勿扰和查通知。'],
  credential: ['这看起来像密码或密钥，我不记这种东西。', '像是密码或密钥，不能记录。', '疑似凭证，不写进记忆。', '这类凭证不能记。', '看起来是凭证，记忆不会保存。', '密码和密钥不进入记忆。'],
  help: ['现在只会记事、提醒、勿扰和查通知。', '可以说记住、提醒我、勿扰或有什么通知。', '本地指令在下面。', '支持记事、提醒、安静和查看通知。', '指令清单请看帮助。', '本地模式，不调用模型。'],
  not_found: ['没找到相关记忆。', '检索没有命中。', '暂时没有匹配的记忆。', '没有找到这条。', '记忆里还没找到。', '这次没有匹配结果。'],
  about_empty: ['关于这件事我还没记过什么。', '没有相关记忆。', '这件事还没记过。', '检索没有找到相关内容。', '本子里没有匹配内容。', '还没有这方面的记录。'],
};

export const EVENT_EMOJI: Record<LineEvent, string> = { first: '👋', pet: '❤️', poke: '🫧', drag: '🎈', drop: '🐾', morning: '☀️', offwork: '🍵', notice: '🔔', remember: '📒', forgotten: '🍃', quiet: '🌙', restored: '🌤️', quiet_end: '🔔', unknown: '🌱', credential: '🔒', help: '📒', not_found: '📒', about_empty: '📒' };
