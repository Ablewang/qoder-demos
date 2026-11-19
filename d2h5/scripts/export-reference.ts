import { writeFileSync, readFileSync } from 'node:fs';
import { CLASSES, SKILLS, EXPERIENCE, num, text, rawRows } from '../src/catalog';
import { BASE_ITEMS, getBase, itemName, RUNES, RUNEWORDS } from '../src/items';
import { CATALOG_CATEGORIES, EQUIPMENT_CATALOG } from '../src/equipment-catalog';
import { AREAS, QUESTS, NPCS } from '../src/world';
import type { RawRow } from '../src/types';

const date = new Date().toISOString().slice(0, 10);
const provenance = JSON.parse(readFileSync(new URL('../src/data/provenance.json', import.meta.url), 'utf8')) as Record<string, {commit: string; rows: number; url: string; sha256: string; storedSha256: string}>;
const cell = (value: unknown) => String(value ?? '—').replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ');
const table = (headers: string[], rows: unknown[][]) => [headers, headers.map(() => '---'), ...rows].map(row => `| ${row.map(cell).join(' | ')} |`).join('\n');
const propertyFields = (row: RawRow) => Object.fromEntries(Object.entries(row).filter(([key]) => /^(?:prop\d+|par\d+|min\d+|max\d+|a(?:prop|par|min|max)\d+[ab]|[pf](?:code|param|min|max)\d+[ab]?|mod\d+(?:code|param|min|max)|t1(?:code|param|min|max)\d+|(?:weapon|helm|shield)mod\d+(?:code|param|min|max))$/i.test(key)));
const properties = (row: RawRow) => JSON.stringify(propertyFields(row));
const rawLink = (name: string) => `[${name}.json](../src/data/raw/${name}.json)`;
const className = (id?: string) => CLASSES.find(c => c.id === id)?.name ?? '不限';
const skillName = (id: number) => SKILLS.find(s => s.id === id)?.name ?? String(id);
const runeName = (code: string) => RUNES.find(r => r.code === code)?.name ?? code;
const baseNames = new Map(['weapons', 'armor', 'misc'].flatMap(name => rawRows(name)).map(row => [text(row, 'code'), row]));
const gemName = (row: RawRow) => getBase(text(row, 'code'))?.name ?? itemName(text(baseNames.get(text(row, 'code')) ?? {}, 'namestr', text(row, 'code')));
const setNameKeys = new Map(rawRows('Sets').map(row => [text(row, 'index'), text(row, 'name', text(row, 'index'))]));
const wordSourceNames = new Map(Object.entries(JSON.parse(readFileSync(new URL('../src/data/raw/Runes.json', import.meta.url), 'utf8')) as Record<string, RawRow>).map(([name, row]) => [Number(row.lineNumber), name]));
const areaName = (id: number) => AREAS.find(a => a.id === id)?.name ?? String(id);
const activeQuestIds = new Set(['a1q1', 'a1q2', 'a1q4', 'a1q6']);
const services: Record<string, string> = {trade:'交易', heal:'治疗', repair:'维修', identify:'鉴定', gamble:'赌博', hire:'雇佣', resurrect:'复活佣兵', travel:'旅行'};
const enabledWords = rawRows('Runes').filter(r => num(r, 'complete') === 1);
const gems = rawRows('gems').filter(r => text(r, 'code') && !/^r\d{2}$/.test(text(r, 'code')));
const core: string[] = [
  '# 全量规则目录与数据索引',
  `生成日期：${date}。这是当前本地固定数据的查询快照，不是功能完成证明。`,
  '返回 [文档入口](README.md) · [中文玩法总手册](GAME-DESIGN.md) · [装备、词缀与配方全量目录](ITEM-CATALOG.md)。',
  '## 阅读说明',
  '- 技能的“已接入”仅指当前白名单行为，仍可能有碰撞和动画近似；其余只收录数据，不可绑定施放。',
  '- 区域等级是地图资料，不等于普通难度每只怪物等级；区域邻接也不等于无条件开放。',
  '- 任务奖励列是原版目标，只有标记了当前触发的条目具备首版步骤实现；仍须看手册的奖励限制。',
  '- NPC 服务为基础声明。基德赌博已执行；其他 NPC 的赌博、雇佣及佣兵复活声明仍不代表引擎已执行，实际服务受任务/当前上下文控制。',
  '- 符文之语只说明序列/底材和规则匹配是否启用，不保证每种触发、光环、充能或特殊属性已经生效。',
  '- 物品显示名称采用固定 zhCN 字符串；编号、名称键、英文原名和 code 保留为原始身份，数值与 JSON 元组不作翻译。缺失历史译名与重复的未完成名称键明确标记，不臆造名称。',
  '## 七职业初始属性',
  table(['职业','ID','英文','力量','敏捷','体力','精力','生命','法力','耐力','初始武器代码'], CLASSES.map(c => [c.name,c.id,c.english,c.strength,c.dexterity,c.vitality,c.energy,c.life,c.mana,c.stamina,c.weapon])),
  '## 七职业成长',
  table(['职业','每级生命','每级法力','每级耐力','每体力生命','每体力耐力','每精力法力','命中常数','格挡职业常数'], CLASSES.map(c => [c.name,c.lifePerLevel,c.manaPerLevel,c.staminaPerLevel,c.lifePerVitality,c.staminaPerVitality,c.manaPerEnergy,c.arFactor,c.blockFactor])),
  `## 全部 ${SKILLS.length} 个职业技能`,
  '普通攻击 ID 0 不包含在 210 个职业技能中。需求等级列是首点等级；后续硬点还受需求等级＋已有硬点的限制。',
];
for (const c of CLASSES) {
  core.push(`### ${c.name}（${c.english}）`);
  for (let tree = 0; tree < c.trees.length; tree++) {
    const skills = SKILLS.filter(s => s.classId === c.id && s.tree === tree).sort((a,b) => a.row-b.row || a.column-b.column || a.id-b.id);
    core.push(`#### ${c.name} · ${c.trees[tree]}`, table(['ID','技能','英文键','首点等级','硬点前置','当前状态','说明'], skills.map(s => [s.id,s.name,s.key,s.level,s.prerequisites.map(skillName).join('、') || '无',s.supported ? '已接入，详见手册边界' : '仅数据，不可施放',s.description])));
  }
}
core.push('## 1–99 级累计经验阈值', '这里的阈值表示进入该等级所需累计经验，不是从上一等级升级所需经验；99 级没有下一等级。', table(['等级','累计经验','距离下一级'], Array.from({length:99}, (_,i) => { const level=i+1; return [level,EXPERIENCE[level],level===99 ? '满级' : EXPERIENCE[level+1]-EXPERIENCE[level]]; })));
core.push(`## 五幕 ${QUESTS.length} 项任务`, table(['任务ID','幕','序号','名称','目标步骤','原版奖励目标','当前触发'], QUESTS.map(q => [q.id,q.act,q.number,q.name,q.description,q.reward,activeQuestIds.has(q.id) ? '部分/主要步骤已接入，见手册' : '仅定义，完整流程未接入'])));
core.push(`## 全部 ${AREAS.length} 个区域`, '邻接列只列 AreaDef 的普通邻接；脚本传送门、任务门槛和旅行例外请查世界研究与手册。含原版服务器事件区域目录；离线首版没有完整事件入口。');
for (let act=1;act<=5;act++) core.push(`### 第 ${act} 幕区域`, table(['ID','名称','英文','普通/噩梦/地狱区域等级','城镇','传送点','地形','普通邻接','怪物候选代码'], AREAS.filter(a=>a.act===act).map(a=>[a.id,a.name,a.english,a.levels.join(' / '),a.town?'是':'否',a.waypoint?'有':'无',a.style,a.connections.map(id=>`${id} ${areaName(id)}`).join('、') || '—',a.monsters.join(', ') || '无'])));
core.push('## 全部 39 个传送点', '必须点击激活，不是进地图自动获得；初始罗格营地已激活。', table(['幕','区域ID','传送点'], AREAS.filter(a=>a.waypoint).map(a=>[a.act,a.id,a.name])));
core.push('## NPC 基础声明与条件说明', table(['ID','名称','幕','基础服务声明','描述'], Object.values(NPCS).map(n=>[n.id,n.name,n.act,n.services.map(s=>services[s]??s).join('、') || '无',n.description])));
core.push(`## ${RUNES.length} 个符文`, '镶嵌属性的武器/头盔护甲/盾位置分别保留 weaponMod/helmMod/shieldMod 原始字段；不同位置不可混用。', table(['编号','代码','中文显示名称','原始英文名称','装备需求等级','镶嵌原始属性字段'], RUNES.map(r=>[r.number,r.code,r.name,getBase(r.code)?.english,r.level,properties(rawRows('gems').find(g=>text(g,'code')===r.code) ?? {})])));
core.push(`## ${gems.length} 个宝石条目及镶嵌原始属性`, 'weaponMod 为武器位置，helmMod 为头盔/护甲位置，shieldMod 为盾牌位置；属性代码和参数直接保留原始数值，完整解释见装备研究。', table(['代码','中文名称','原始英文名称','镶嵌属性字段'], gems.map(r=>[text(r,'code'),gemName(r),text(r,'name'),properties(r)])));
core.push(`## 原版启用的 ${enabledWords.length} 个符文之语`, `当前离线规则匹配启用 ${RUNEWORDS.length} 个：55 个 LoD 离线定义加 D2R 边缘覆盖，其余 22 个保留服务器限制。下面的 itype/etype 是原始物品类型，须按 ItemTypes 继承判断，不能仅按外观判断。`, table(['中文显示名称','英文身份','原始英文名称（Rune Name）','原始名称键（Name）','符文顺序（中文 / code）','孔数','允许类型','排除类型','原始server','当前离线匹配','原始额外属性'], enabledWords.map(r=>{const codes=Array.from({length:6},(_,i)=>text(r,`Rune${i+1}`)).filter(Boolean); const allowed=Array.from({length:6},(_,i)=>text(r,`itype${i+1}`)).filter(Boolean); const excluded=Array.from({length:3},(_,i)=>text(r,`etype${i+1}`)).filter(Boolean); const current=RUNEWORDS.find(w=>text(w.raw,'Name')===text(r,'Name')); return [itemName(text(r,'Name')),current?.name ?? wordSourceNames.get(num(r,'lineNumber')),r['Rune Name'],text(r,'Name'),codes.map(code=>`${runeName(code)} (${code})`).join(' → '),codes.length,allowed.join(', '),excluded.join(', ') || '无',num(r,'server'),current?'启用匹配':'禁用匹配',properties(r)];})));
core.push('## 33 张原始数据表与来源', '原始下载 sha256 与规范化本地文件 storedSha256 不同，均存储在 provenance.json；这里只展示本地文件校验值。固定提交不是原版可执行文件全部行为的证明。', table(['表','原始行数','固定提交','本地SHA-256','数据文件','原始来源'], Object.entries(provenance).map(([name,p])=>[name,p.rows,p.commit,p.storedSha256,rawLink(name),`[来源](${p.url})`])), '完整来源记录：[provenance.json](../src/data/provenance.json)。', '## 更新方式', '在项目目录执行 `npx --no-install tsx scripts/export-reference.ts`。此命令只从当前本地数据重新导出目录，不修改游戏规则，不从网络更新数据。');

const itemDoc: string[] = [
  '# 装备、词缀与配方全量目录',
  `生成日期：${date}。来源是当前固定 1.14d 提交的本地目录与原始表。`,
  '返回 [文档入口](README.md) · [中文玩法总手册](GAME-DESIGN.md) · [职业与世界全量目录](REFERENCE-CATALOG.md)。',
  '## 阅读说明',
  '- 底材目录是生成物品的基础；不代表每一底材可由当前地图或商人获得。',
  '- 暗金、套装、词缀和配方保留原始定义。版本、启用、天梯、物品类型、等级与实际处理器仍会限制生成/使用。',
  '- 原始属性代码并不保证已执行。当前解释器只覆盖一部分 Properties；触发、光环、充能、每级属性、套装组合等仍有缺口。',
  '- 全量方块配方表是原版目标。首版只支持手册列出的配方子集，而且方块任务取得流程尚未完成。',
  '- 行数包括原始表里的禁用、历史或不可随机生成条目，不能等同可掉落物品数量。',
  '- 名称列采用固定 zhCN 显示译名；原始英文身份、名称键与 code 单独保留，缺失的历史名称及未完成重复键明确标记。',
  '- 原始参数列用 JSON 保存字段名，避免中文翻译把代码、负数、范围或函数表达式改错。',
  `## 全部 ${EQUIPMENT_CATALOG.length} 条装备身份定义`,
  '点击游戏顶部“图鉴”或按 L 查阅完整原始定义、搜索名称/code、翻页和查看实现状态；每页 24 项。只读，不生成装备，不改变角色或 IndexedDB 保存内容。',
  table(['分类','定义数'], CATALOG_CATEGORIES.map(category => [category.label,EQUIPMENT_CATALOG.filter(entry=>entry.kind===category.kind).length])),
  '388 条暗金中 385 条原始启用，383 条在等级 99 内满足当前选取条件，含全部 29 条 ladder 标记；原版离线单人不排除这些暗金。毁灭/地狱火炬的事件入口仍未实现。这与符文之语的 server=1 限制是不同规则；23 个原始服务器定义中只有边缘按 D2R 离线覆盖启用，其余 22 个仍禁用。',
  `## ${BASE_ITEMS.length} 个归一化底材`,
  '尺寸是背包格数；伤害和防御是底材值，未叠加品质、无形、词缀或角色属性；最大孔数仍受 ilvl/类型上限限制。',
];
for (const [name,list] of [['武器底材',BASE_ITEMS.filter(b=>b.slot==='weapon')],['护甲及配饰底材',BASE_ITEMS.filter(b=>b.slot && b.slot!=='weapon')],['其他底材与消耗品',BASE_ITEMS.filter(b=>!b.slot)]] as const) itemDoc.push(`### ${name}（${list.length}）`, table(['代码','中文显示名称','原始英文名称','名称键（namestr）','类型','槽位','格数','伤害','防御','力量/敏捷','需求等级','qlvl','最大孔','耐久','双手','职业限制'], list.map(b=>[b.code,b.name,b.english,text(b.raw,'namestr'),b.type,b.slot ?? '—',`${b.width}×${b.height}`,`${b.minDamage}–${b.maxDamage}`,`${b.defenseMin}–${b.defenseMax}`,`${b.strength} / ${b.dexterity}`,b.requiredLevel,b.qlvl,b.maxSockets,b.durability,b.twoHanded?'是':'否',className(b.classId)])));
const runtimeBases = new Set(BASE_ITEMS.map(base=>base.code));
const historicalBases = EQUIPMENT_CATALOG.filter(entry=>entry.kind==='base' && !runtimeBases.has(entry.code));
itemDoc.push(`## 原始底材中的 ${historicalBases.length} 个仅定义条目`, '与上述 635 个运行底材合计 659 个原始底材；历史/不可生成定义仍保留，不暗中丢弃。', table(['身份','中文显示名称 / 缺失标记','原始英文名称','名称键（namestr）','代码','状态','完整原始字段'], historicalBases.map(entry=>[entry.id,entry.name,text(entry.raw,'name'),text(entry.raw,'namestr'),entry.code,entry.status,JSON.stringify(entry.raw)])));
const uniques = EQUIPMENT_CATALOG.filter(entry=>entry.kind==='unique');
itemDoc.push(`## 暗金定义索引（${uniques.length} 条）`, table(['稳定身份','中文显示名称','原始英文身份（index）','底材代码','enabled','ladder','version','生成等级','需求等级','rarity','状态','属性字段'], uniques.map(entry=>{const r=entry.raw;return [entry.id,itemName(text(r,'index')),text(r,'index'),text(r,'code'),num(r,'enabled'),num(r,'ladder'),num(r,'version'),num(r,'lvl'),num(r,'lvl req'),num(r,'rarity'),entry.status,properties(r)];})));
const sets = rawRows('Sets').filter(r=>text(r,'index'));
itemDoc.push(`## 套装整体定义（${sets.length} 条）`, '组合奖励处理器尚未完成。完整组合属性字段查原始 Sets 表，不把原始字段展示冒充奖励已经生效。', table(['中文显示名称','原始英文身份（index）','原始名称键（name）','version','完整原始数据'],sets.map(r=>[itemName(text(r,'name',text(r,'index'))),text(r,'index'),text(r,'name'),num(r,'version'),JSON.stringify(r)])));
const setItems = rawRows('SetItems').filter(r=>text(r,'index') && text(r,'item'));
itemDoc.push(`## 套装单件定义（${setItems.length} 条）`, table(['中文显示名称','原始英文身份（index）','所属套装（中文）','原始套装身份','底材代码','生成等级','需求等级','rarity','固定属性字段'],setItems.map(r=>[itemName(text(r,'index')),text(r,'index'),itemName(setNameKeys.get(text(r,'set')) ?? text(r,'set')),text(r,'set'),text(r,'item'),num(r,'lvl'),num(r,'lvl req'),num(r,'rarity'),properties(r)])));
for (const name of ['MagicPrefix','MagicSuffix']) {
  const rows=rawRows(name).filter(r=>text(r,'Name'));
  itemDoc.push(`## ${name==='MagicPrefix'?'魔法前缀':'魔法后缀'}定义（${rows.length} 条）`, table(['中文显示名称','原始英文名称键（Name）','version','spawnable','rare','level','maxlevel','levelreq','group','frequency','允许类型','排除类型','属性字段'],rows.map(r=>[itemName(text(r,'Name')),text(r,'Name'),num(r,'version'),num(r,'spawnable'),num(r,'rare'),num(r,'level'),num(r,'maxlevel'),num(r,'levelreq'),num(r,'group'),num(r,'frequency'),Array.from({length:7},(_,i)=>text(r,`itype${i+1}`)).filter(Boolean).join(', '),Array.from({length:5},(_,i)=>text(r,`etype${i+1}`)).filter(Boolean).join(', ') || '无',properties(r)])));
}
const wordDefinitions=EQUIPMENT_CATALOG.filter(entry=>entry.kind==='runeword');
itemDoc.push(`## 全部符文之语原始身份（${wordDefinitions.length} 条）`, '含 78 个完成及 91 个未完成定义；完成定义有 55 个 LoD 离线匹配加 1 个 D2R 边缘覆盖启用，另外 22 个 server=1 仍禁用。原始 null、同名未完成行、全部条件和参数不丢失。',table(['稳定身份','中文显示名称 / 未完成标记','原始英文索引身份','原始英文名称（Rune Name）','原始名称键（Name）','状态','完整原始字段'],wordDefinitions.map(entry=>[entry.id,entry.name,wordSourceNames.get(num(entry.raw,'lineNumber')),entry.raw['Rune Name'],text(entry.raw,'Name'),entry.status,JSON.stringify(entry.raw)])));
const cube=EQUIPMENT_CATALOG.filter(entry=>entry.kind==='cube');
itemDoc.push(`## 全部方块配方定义（${cube.length} 条，其中 146 启用）`, '该表不是首版支持配方清单。description、启用/版本/天梯标志、材料表达式、全部输出与额外属性保留；lvl/plvl/ilvl 的含义见装备研究。',table(['稳定身份','描述','enabled','version','ladder','输入数','材料表达式','主输出','lvl / plvl / ilvl','完整原始字段'],cube.map(entry=>{const r=entry.raw;return [entry.id,text(r,'description'),num(r,'enabled'),num(r,'version'),num(r,'ladder'),num(r,'numinputs'),Array.from({length:7},(_,i)=>text(r,`input ${i+1}`)).filter(Boolean).join(' + '),text(r,'output'),`${num(r,'lvl')} / ${num(r,'plvl')} / ${num(r,'ilvl')}`,JSON.stringify(r)];})));
itemDoc.push('## 完整字段及属性映射', '- [Properties 原始属性映射](../src/data/raw/Properties.json)', '- [ItemStatCost 原始统计与保存字段](../src/data/raw/ItemStatCost.json)', '- [ItemTypes 类型继承与孔数限制](../src/data/raw/ItemTypes.json)', '- [TreasureClassEx 掉落递归表](../src/data/raw/TreasureClassEx.json)', '- [ItemRatio 品质判定参数](../src/data/raw/itemratio.json)', '- [完整暗金原始定义](../src/data/raw/UniqueItems.json)', '- [完整套装单件及条件奖励字段](../src/data/raw/SetItems.json)', '- [完整方块输出字段](../src/data/raw/cubemain.json)', '- [全部 33 张表与来源/校验值](REFERENCE-CATALOG.md)', '- [装备详细研究与全部附表](research/02-items.md)', '## 更新方式', '在项目目录执行 `npx --no-install tsx scripts/export-reference.ts`，重新导出本地数据快照。');
writeFileSync(new URL('../docs/REFERENCE-CATALOG.md', import.meta.url), `${core.join('\n\n')}\n`);
writeFileSync(new URL('../docs/ITEM-CATALOG.md', import.meta.url), `${itemDoc.join('\n\n')}\n`);
console.log(JSON.stringify({skills:SKILLS.length,areas:AREAS.length,waypoints:AREAS.filter(a=>a.waypoint).length,quests:QUESTS.length,runes:RUNES.length,gems:gems.length,runewords:enabledWords.length,offlineRunewords:RUNEWORDS.length,bases:BASE_ITEMS.length,uniques:uniques.length,sets:sets.length,setItems:setItems.length,prefixes:rawRows('MagicPrefix').filter(r=>text(r,'Name')).length,suffixes:rawRows('MagicSuffix').filter(r=>text(r,'Name')).length,cube:cube.length,tables:Object.keys(provenance).length},null,2));
