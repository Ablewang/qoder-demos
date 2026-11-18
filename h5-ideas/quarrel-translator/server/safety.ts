import type { SafetyCategory, Translation } from '../src/contract.js';

// This finite precheck leaves quoted and negated statements to the model.
function clauses(text: string): string[] {
  return text
    .normalize('NFKC')
    .replace(/“[^”]*”|「[^」]*」|『[^』]*』|‘[^’]*’|"[^"\n]*"|'[^'\n]*'|`[^`]*`/gu, ' ')
    .split(/[，,。.!！?？;；\n]/u)
    .map((part) => part.trim().replace(/^(?:但是|可是|但|反正|所以|而且)\s*/u, ''))
    .filter((part) => part.length > 0 && !/^(?:据|新闻|报道|小说|电影|例如|比如|引用|转述|他(?:们)?说|她(?:们)?说|对方说|有人说|不是说|并不是说)/u.test(part));
}

export function localSafety(text: string, relation: string): SafetyCategory | undefined {
  const parts = clauses(text);
  for (const [index, part] of parts.entries()) {
    if (/^(?:我(?:现在|真的|也|已经|实在|再也|今晚|今天|打算|决定|就|要|想要|受不了|不如|准备)*\s*)?(?:不想活(?:了|下去)|活不下去(?:了)?|想(?:要)?(?:自杀|死(?![你他她它我]))|要(?:自杀|割腕|跳楼)|准备(?:自杀|割腕|跳楼)|决定(?:自杀|割腕|跳楼))/u.test(part)
      || /^我(?:现在|今晚|今天)?(?:要|准备|打算)(?:吃药自杀|吞药自杀|结束自己的生命)/u.test(part)) {
      return 'self_harm';
    }
    if (/^(?:如果)?你(?:敢|要是)?再(?:对我)?(?:动手|打我|打我一顿|殴打我)\s*我(?:就|会|要|一定|马上|立刻)?(?:报警|找警察)/u.test(`${part}${parts[index + 1] ?? ''}`)
      || /^(?:他|她|你|对方)(?:又|正在|一直|刚刚|刚才)?(?:打我|殴打我|掐我脖子)(?:了|呢|还|把|让|导致|$)/u.test(part)
      || /^我(?:正在|一直|又)?(?:被家暴|被(?:他|她|对方)(?:打|殴打|掐脖子))/u.test(part)) {
      return 'violence_to_user';
    }
    const planned = /(?:今晚|今天|明天|现在|马上|等会|一会|\d{1,2}点)/u.test(part)
      && /(?:刀|枪|汽油|毒药|锤子|斧头)/u.test(part)
      && /(?:杀(?:死|了)?(?:你|他|她|对方|孩子)|砍(?:死|伤|你|他|她)|捅(?:死|伤|你|他|她)|烧死|毒死|打死)/u.test(part)
      && /^(?:(?:今晚|今天|明天|现在|马上|等会|一会|\d{1,2}点)\s*)?我(?:要|会|打算|准备|决定|今晚|今天|明天|现在|马上|等会|一会|带|拿|用)/u.test(part)
      && !/^我(?:今晚|今天|明天|现在)?(?:不会|不想|不打算|不准备|不可能|没有|不)/u.test(part);
    if (planned) return relation === 'child' || /孩子/u.test(part) ? 'abuse' : 'threat_to_other';
    if (!/(?:不要|不想|不愿|不打算|不能|别).{0,6}(?:让|控制|操控)/u.test(part)
      && /^(?:帮我|教我|替我|怎么(?:说|做)|如何(?:说|做)|我要|我想|写(?:一段|一句)?(?:话术|话)).{0,60}(?:让(?:他|她|对方).{0,15}(?:愧疚到|内疚到|(?:愧疚|内疚)$|不敢离开|不敢走|离不开我)|控制(?:他|她|对方)|操控(?:他|她|对方)|用自杀威胁|骗(?:他|她|对方).{0,10}(?:服从|留下))/u.test(part)) {
      return 'manipulation';
    }
  }
  return undefined;
}

export function ambiguousThreat(text: string): boolean {
  return clauses(text).some((part) => !/^(?:我)?(?:并|真的|绝对)?(?:不会|不想|没有|不打算|不可能|不准备)/u.test(part)
    && !/^(?:他|她|对方)(?:并)?(?:没有|没|不会)(?:说|想)/u.test(part)
    && /(?:真想掐死你|弄死你|杀了你|掐死你|同归于尽|你去死)/u.test(part));
}

// A finite fail-closed output check, with known false positives and omissions.
// Check every visible field, not just the selected rewrite. Never partly render.
export function unsafeTranslation(result: Translation): boolean {
  const fields = [result.note, result.heard_as, result.tip,
    ...Object.values(result.real_meaning), ...Object.values(result.rewrites)];
  return fields.some((value) => /(?:你去死|杀(?:死|了)你|弄死你|掐死你|打死你|同归于尽|割腕|自杀|跳楼|再.{0,12}就不要你了|不听话.{0,12}(?:打|不要)|让.{0,10}(?:愧疚到|内疚到|离不开我)|你不.{0,20}我就.{0,12}(?:死|伤害|曝光)|不配活|都是你的错|废物|贱人)/u.test(value)
    || /<\/?[a-z][^>]*>|javascript\s*:|\bon\w+\s*=/iu.test(value));
}
