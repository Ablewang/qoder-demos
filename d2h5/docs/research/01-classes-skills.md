# Diablo II: Lord of Destruction 1.14d — Characters and Skills

Research date: 2026-11-17. Scope: original expansion rules, **not** the non-expansion Classic game mode, and **not** Resurrected 2.4+ balance changes. Seven classes, 21 trees, 210 class skills. No game code accompanies this research.

## 0. Authority, units, and how to import this report

**Use the numeric engine records and formulas as the source of truth, not the rounded Arreat Summit display tables.** The latter sometimes already include one hard point in prerequisite synergies: e.g. Fire Ball's unsynergized base is 6–14, whereas Summit prints 6–15; Blizzard's unsynergized base is 45–75 per shard, whereas Summit prints 51–86 with its three prerequisite synergies and incorrectly labels this “Damage per Second.” Do not apply synergies twice. Summon damage can similarly include mandatory mastery prerequisites or randomized equipment.

Primary numeric source: [blizzhackers/d2data **1.14d** branch](https://github.com/blizzhackers/d2data/tree/1.14d), pinned to commit `0edfaf6d006f2eb82857c066e07ce03614285981`. **Never import its master branch**, which now contains modern D2R changes and an eighth class. The 210 skill records' overlapping, nonempty fields were independently compared against [fabd's original 1.13 Skills.txt](https://github.com/fabd/diablo2/blob/master/code/d2_113_data/Skills.txt): no value differences after stripping JSON wrapper quotes. That confirms the mirror predates D2R balance changes; it does not prove executable hardcoded behavior from data alone.

Direct pinned data references:

- [Skills.txt-derived JSON](https://raw.githubusercontent.com/blizzhackers/d2data/0edfaf6d006f2eb82857c066e07ce03614285981/json/skills.json)
- [SkillDesc.txt-derived JSON](https://raw.githubusercontent.com/blizzhackers/d2data/0edfaf6d006f2eb82857c066e07ce03614285981/json/skilldesc.json)
- [CharStats.txt-derived JSON](https://raw.githubusercontent.com/blizzhackers/d2data/0edfaf6d006f2eb82857c066e07ce03614285981/json/charstats.json)
- [Experience.txt-derived JSON](https://raw.githubusercontent.com/blizzhackers/d2data/0edfaf6d006f2eb82857c066e07ce03614285981/json/experience.json)
- [Missiles.txt-derived JSON](https://raw.githubusercontent.com/blizzhackers/d2data/0edfaf6d006f2eb82857c066e07ce03614285981/json/Missiles.json)
- [MonStats.txt-derived JSON](https://raw.githubusercontent.com/blizzhackers/d2data/0edfaf6d006f2eb82857c066e07ce03614285981/json/monstats.json)
- [Skill calculation token dictionary](https://raw.githubusercontent.com/blizzhackers/d2data/0edfaf6d006f2eb82857c066e07ce03614285981/json/skillcalc.json)

### Formula and numeric conventions

| Symbol / field | Exact interpretation |
|---|---|
| `L`, `lvl` | Effective skill level, including applicable item and temporary bonuses. |
| `H`, `blvl` | Allocated hard points only. Normal synergy coefficients multiply this, not effective levels. |
| `ulvl` | Unit/character level, not skill level. |
| `parN` | The corresponding numeric `ParamN` in the same skill record. Missing numeric fields in this filtered mirror normally mean zero; missing references mean no reference. |
| `ln12`, `ln34`, `ln56`, `ln78` | `ParamA + (L−1)×ParamB`, with pairs (1,2), (3,4), (5,6), (7,8). The mirror's token-comment shorthand `a+lvl*b` is imprecise; game values use `L−1`. |
| `dm12`, etc. | Diminishing return: `a + trunc((b−a) × min(100, trunc(110×L/(L+6))) / 100)`. Integer truncation at the inner percentage matters. E.g. Dodge's (10,65) produces 18% at L1, not 17%. Verify high-level saturation with executable if extending unusual levels. |
| `skill('Name'.lvl/blvl/parN)` | Cross-skill effective level / hard level / parameter. Names are internal English identifiers, **not always UI names**. |
| Five damage increments | Levels **2–8**, **9–16**, **17–22**, **23–28**, **29+**. For base `B` and increments `a…e`: `B + a×min(L−1,7) + b×clamp(L−8,0,8) + c×clamp(L−16,0,6) + d×clamp(L−22,0,6) + e×max(L−28,0)`. Apply separately to minimum and maximum. |
| `HitShift` | Converts raw damage to 1/256-HP integers: `raw × 2^HitShift`; actual HP damage is that /256. Thus raw `HitShift=7` means ×0.5 HP, 8 means ×1 HP. Retain fixed-point precision until the appropriate engine rounding stage. |
| Poison E damage | A **rate per frame**, not total damage: `totalHP = rawRate × 2^HitShift × lengthFrames / 256`; DPS is rateHP×25. Poison damage and length synergies must be applied to their separate fields. |
| Continuous flame / ground damage | Often E damage is damage per frame or per missile collision, not an entire cast. Missile density, collision cooldown, and server functions govern actual DPS. Do not multiply every skill's damage by 25 indiscriminately. |
| `ELen`, `ELevLen1…3` | Length in frames. Three increments correspond to **2–8**, **9–16**, **17+**, unlike the five damage brackets. Apply `ELenSymPerCalc` to length when present. |
| `EDmgSymPerCalc`, `DmgSymPerCalc` | Percent bonus to elemental/data-channel or physical skill damage respectively. Normally `(100+sum bonuses)/100`, not the product of independent synergy percentages. Some effects use `calcN` instead. |
| `edmn`, `edmx` | Computed elemental/data-channel min/max; `edns`, `edxs` are their 1/256-unit versions. Can represent healing or absorption if the skill has no damage type. |
| `SrcDam` | Weapon-damage participation in **128ths**: 128=100%, 96=75%, 64=50%, 32=25%. Zero does not by itself mean a melee attack deals no weapon damage; many attacks implement this in their server function. |
| Radius / distance | Engine ranges are commonly subtiles; **1 subtile = 2/3 yard**. Auras typically use this conversion. Some missile/radius parameters are implementation-specific; retain the raw parameter and the Summit yard display separately. |
| Timing | Simulation is **25 frames/second**, 1 frame = 0.04 s. `delay`, `perdelay`, `auralencalc`, missile `Range` lengths use frames unless specifically documented otherwise. |

For reproducibility, each skill section below separates (a) metadata and exact mana expression; (b) unsynergized base channels with all five increments; (c) nonzero parameters and engine calculation expressions; (d) named synergy display lines; (e) the published L1–20 UI sequences. Missile-owned channels and summoned monster base records are included where referenced. These are research data, **not** an implemented interpreter or a complete reverse engineering of server-function IDs.

## 0.1 完整技能执行审计（2026-11-17）

210 行定义不是 210 个可玩技能。本轮开始时白名单仅 5 个主动、4 个被动；即使白名单中的火球、火焰爆震和传送，其碰撞、投掷行动帧、城镇许可及宠物迁移也未完全还原。下面是各树必须拥有的独立行为，不能用通用投射物、瞬时范围伤害或通用近战召唤物替代。

| 职业／技能树 | 真实执行的最低行为集合 |
|---|---|
| 亚马逊／弓弩 | 武器参与与物理转换、扇形多重箭、扫射序列、追踪、冻结爆炸、持续地火、箭矢消费 |
| 亚马逊／被动与魔法 | 暴击、三种闪避、命中、穿刺、减益、慢速飞弹、诱饵、女武神装备与独立属性 |
| 亚马逊／标枪长矛 | 多击／序列、武器与元素双通道、耐久／数量、连锁分裂、毒云 |
| 法师／火焰 | 单弹／爆炸、地火／火墙、地狱火、陨石落地与残火、附魔、九头蛇、暖气、火支配 |
| 法师／闪电 | 曲折电弹、专用施法断点、穿透／连锁、新星、静态百分比、心灵传动、传送、雷云、能量护盾 |
| 法师／冰冷 | 冰弹／冻结溅射、三冰甲不同反击、冰新星、随机暴风雪、冰封球旋转及终点爆发、支配减抗 |
| 死灵／诅咒 | 互斥／覆盖、属性／AI改变、反伤／吸血、免疫破除、目标资格和持续帧 |
| 死灵／毒骨 | 骨牙扇形、骨矛穿透、骨魂追踪、毒匕首／云／新星、尸爆双通道、骨甲吸收、骨墙／牢碰撞 |
| 死灵／召唤 | 尸体消费、骷髅与法师上限、石魔互斥、钢铁石魔物品消费与保存、复生原怪AI、支配及抵抗 |
| 圣骑／战斗 | 牺牲自损、盾击特殊命中与物品例外、圣光弹友军治疗、白热序列、冲锋、复仇、螺旋锤、转换、天堂之拳分支 |
| 圣骑／攻击光环 | 属性／速度、反伤、脉冲与武器元素同时生效、圣冰特殊缓速、庇护不死怪特例、信念破免 |
| 圣骑／防御光环 | 治疗／回蓝、缩短状态、最高抗性、活力／防御、救赎尸体消费；自身和盟友目标分开 |
| 野蛮／战斗 | 重击／击昏／击退、双武器、双投、狂乱状态、跳跃、旋风移动采样、狂战士转换 |
| 野蛮／支配 | 按攻击武器类型过滤命中／增强／暴击；投掷与近战支配不混用；耐力、防御、速度、抵抗 |
| 野蛮／呐喊 | 互斥／覆盖、AI恐惧／嘲弄、战争狂嗥伤害与昏迷、寻找药剂／物品TC重投、残酷吓阻 |
| 德鲁伊／召唤 | 乌鸦致盲与攻击次数、三藤尸体／资源行为、三灵光环、狼熊互斥、有效等级相互协同 |
| 德鲁伊／变形 | 两形态、变形术、行动序列、蓄积、狂犬传播、焰爪、饥饿、震波、狂怒 |
| 德鲁伊／元素 | 火流、滚石击退及物理火双伤、地裂／火山控制器、旋风吸收、风弹、新星／飓风、末日雨 |
| 刺客／陷阱 | 火焰爆震抛物落地、雷网、刃巡逻／持续投掷、五哨塔上限及射击次数、尸爆、刀盾周期 |
| 刺客／影子 | 利爪支配／格挡、双通道战锤、速度／消解互斥、毒牙、斗篷、心灵爆震转换、战士镜像与大师自主AI |
| 刺客／武学 | 三阶蓄气并存、选定阶段释放、踢击／双爪序列、龙尾爆炸、传送踢、终结消费蓄气 |

本轮直接核对固定表的三个入口：`skills.Id=9` 的 `passivestat1=passive_critical_strike / passivecalc1=dm12 / Param1=5 / Param2=80`，得 L1=16%、L20=68%；`Id=37` 的 `manarecoverybonus / ln12 / 30 / 12`，得暖气 L20=258%；`Missiles.Missile=fireball` 的服务器 `sHitPar1=4` 是伤害半径，客户端 `cHitPar1=3` 是视觉爆炸半径，不能互换。

回蓝每帧为 `floor(floor(256×maxMana/3000)×(100+总回复%)/100)/256`；暖气与装备回复相加。900 法力、L20 暖气得到每帧 272/256、每秒 26.5625，不是近似式的 26.85。暴击、支配暴击、致命攻击依次失败后再判定，成功只翻倍一次；武器转换前的物理部分可翻倍，元素附加、法术与盾击不得套用普通攻击规则。

最低依赖顺序：25Hz／1⁄256与多通道单位 → 行动帧和打断 → 状态与事件 → 技能 start/do → 飞弹移动／命中／NextDelay与子控制器 → 宠物与佣兵AI。尚需核实 States、Events、PetTypes、MonStats2、MonEquip、MonProp、AnimData／COF及硬编码序列；函数编号不是已实现的行为。不得为扩白名单直接开放尚无运行链的技能。

资料：[Skills字段](https://d2mods.info/forum/kb/viewarticle?a=440)、[Missiles字段](https://d2mods.info/forum/kb/viewarticle?a=364)、[飞弹命中函数](https://d2mods.info/forum/viewtopic.php?f=122&t=29595)、[旧版回蓝及吸蓝](https://www.mannm.org/d2library/faqtoids/mana_eng.html)、[暴击／致命攻击](https://www.mannm.org/d2library/faqtoids/cs_eng.html)、[官方角色公式](https://classic.battle.net/diablo2exp/basics/characters.shtml)。本轮未完成合法1.14d客户端逐技能对照；也未在线审计反编译项目，不将这些资料冒称为完整程序验证。

## 0.2 装备有效技能等级修正（2026-11-17）

本职业单技能 `item_singleskill` 仅解锁该职业技能，不能当作跨职业 oskill。已有硬点或本职业单技能授予后，所有技能／职业／当前页技能树加成相加；`item_elemskill` 的火焰加成按原始 EType=fire 参与，包含暖气，且可提高其他职业原生火焰技能。装备加成不会独立解锁、替代前置硬点或进入 `.blvl` 协同。21 类技能树按职业×三页映射，护符需求等级、鉴定及容器条件共同决定是否激活。

手算回归：火弹 H1＋火球 H1，火焰软点 +3、火焰树 +2 → 两技能 L6，但火球协同仍为 16%；火弹原始端点 `(6+5×3,12+5×3)×128` 经 16% 协同为 3118／4008 bits。火球硬点增加为 H2 后才变为 3548／4561 bits。无硬点、无固有技能的 Leaf 法杖给法师火弹 L6；再加有效 Burning 护符为 L7，最低火弹 12 点经过目标 25 火抗为 9，法力成本仍 2.5。暖气 H1＋Leaf 单技能 3＋火焰 3＋Burning 树 1 为 L8，即 114%，再加头盔 Eth 15% 为 129%；换到空武器组，火弹无授予降为 0、不能继续施放，暖气保留 H1＋护符 1。

实现边界仍为 11 个白名单技能（5 主动、6 被动），没有扩展专用技能行为或补齐 oskill。证据及历史物品未重建的存档边界见 [装备研究 §0.2](02-items.md)。

## 1. Starting characters

Starting life = base Vitality + `hpadd` (30), **not** base Vitality multiplied by the per-point gain. Starting mana = base Energy. Starting life/stamina/mana already include the starting attributes; do not add those attributes' gains again. Per-level and per-attribute increments in CharStats.txt are in quarters; all values here are converted to actual points.

| Class | Str | Dex | Vit | Ene | Life | Stamina | Mana | Life/level | Stamina/level | Mana/level | Life/+Vit | Stamina/+Vit | Mana/+Ene | BlockFactor |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Amazon | 20 | 25 | 20 | 15 | 50 | 84 | 15 | 2 | 1 | 1.5 | 3 | 1 | 1.5 | 25 |
| Sorceress | 10 | 25 | 10 | 35 | 40 | 74 | 35 | 1 | 1 | 2 | 2 | 1 | 2 | 20 |
| Necromancer | 15 | 25 | 15 | 25 | 45 | 79 | 25 | 1.5 | 1 | 2 | 2 | 1 | 2 | 20 |
| Paladin | 25 | 20 | 25 | 15 | 55 | 89 | 15 | 2 | 1 | 1.5 | 3 | 1 | 1.5 | 30 |
| Barbarian | 30 | 20 | 25 | 10 | 55 | 92 | 10 | 2 | 1 | 1 | 4 | 1 | 1 | 25 |
| Druid | 15 | 20 | 25 | 20 | 55 | 84 | 20 | 1.5 | 1 | 2 | 2 | 1 | 2 | 20 |
| Assassin | 20 | 20 | 20 | 25 | 50 | 95 | 25 | 2 | 1.25 | 1.5 | 3 | 1.25 | 1.75 | 25 |

| Class | Equipped starting items | Additional starting inventory | Base movement |
|---|---|---|---|
| Amazon | Javelin (`jav`), Buckler (`buc`) | 4 minor healing potions (`hp1`), 1 Town Portal scroll (`tsc`), 1 Identify scroll (`isc`) | WalkVelocity 6, RunVelocity 9 |
| Sorceress | Short Staff (`sst`), **+1 Fire Bolt staffmod**; no shield | Same consumables | 6 / 9 |
| Necromancer | Wand (`wnd`), **+1 Raise Skeleton staffmod**; no shield | Same consumables | 6 / 9 |
| Paladin | Short Sword (`ssd`), Buckler | Same consumables | 6 / 9 |
| Barbarian | Hand Axe (`hax`), Buckler | Same consumables | 6 / 9 |
| Druid | Club (`clb`), Buckler | Same consumables | 6 / 9 |
| Assassin | Katar (`ktr`), Buckler | Same consumables | 6 / 9 |

Javelin stack quantity and initial durability are item-generation details, not the `item1count=1` entry (which means one stack). No armor, helm, boots, gloves, jewelry, or belt is granted by these records. All classes have Attack, Throw and Unsummon; item-granted starting spells are not allocated hard points. Assassin opens ordinary locked chests without keys.

All seven use the same baseline walk/run fields; Assassin's raw `RunDrain=15` versus 20 for the others is also worth preserving. These are engine velocity units, not H5 pixels. Medium/heavy body armor and shields contribute 5/10 movement penalties respectively; skill FRW is not subject to item FRW diminishing returns. [Character basics](http://classic.battle.net/diablo2exp/basics/characters.shtml).

**Shield blocking:** without a shield (or Weapon Block), a class's BlockFactor is not a standalone block chance. Let `B = shield.block + class.BlockFactor + increased_chance_of_blocking + HolyShield_block_bonus`; then stationary/walking chance = `clamp(trunc(B×(Dex−15)/(2×clvl)),0,75)`. Cap the **final chance**, not `B`. Buckler's item block is 5, so its class display bases are 30 Amazon/Barbarian/Assassin, 35 Paladin, 25 Druid; Sorceress/Necromancer would be 25 if equipped. Running gives one-third of the calculated chance, maximum 25%, and ordinary defense is ineffective while running. Assassin Weapon Block is a separate skill chance, not the shield/Dex formula; it does not work while walking/running and can block many blockable spell missiles.

## 2. Leveling, point budgets, quests, and respec

- Start at character level **1**, zero experience, zero allocatable level-up points. Cap **99**; 98 level-ups.
- Each level-up: **5 attribute points and 1 skill point**, plus class automatic life/stamina/mana increases. Points may be saved.
- Skill investment cap: **20 hard points per skill** and `H ≤ clvl−requiredLevel+1`. A tier-30 skill can first reach H20 at clvl49. Each immediate prerequisite needs at least one **hard** point; prerequisite closures are included below.
- Level-up total at 99: **490 stat points, 98 skill points**. All three difficulties' relevant quest rewards add **15 stat points and 12 skill points**: maximum **505 allocatable stat points, 110 skill points**, excluding starting attributes.

| Quest | Act | Reward per difficulty | Total over Normal/Nightmare/Hell |
|---|---|---|---|
| Den of Evil | I | +1 skill point; one Akara stat/skill respec | +3 skills; 3 respecs |
| Radament's Lair | II | Book of Skill: +1 skill point | +3 skills |
| Lam Esen's Tome | III | +5 stat points | +15 stats |
| The Fallen Angel (Izual) | IV | +2 skill points | +6 skills |
| The Golden Bird | III | Potion of Life: permanent +20 life | +60 life (not Vitality or allocatable stats) |
| Prison of Ice (Anya) | V | Scroll of Resistance: permanent +10 all elemental resistance | +30 fire/cold/lightning/poison resist (not magic/physical) |

Original LoD retains the historical Anya death bug: after dying, her resistance bonus can be lost until leaving/rejoining despite the character display. Keep this separate from data-table values and verify against 1.14d if reproducing bugs. Other quest rewards (socketing, imbue, personalization, items, titles) are outside the point budget.

Akara respec is available once per difficulty after Den of Evil. Tokens of Absolution allow additional respecs: cube Twisted Essence of Suffering (Hell Andariel/Duriel), Charged Essence of Hatred (Mephisto), Burning Essence of Terror (Diablo), Festering Essence of Destruction (Baal). Respec returns allocated stat/skill points; quest-earned permanent life/resistance is not refunded. [Skill basics](http://classic.battle.net/diablo2exp/skills/basics.shtml).

### Full experience thresholds, levels 1–99

The table below is **cumulative XP required to enter the indicated level**, not XP earned during that level. `to next` is the difference between adjacent cumulative thresholds. Experience.txt's `Level=1` row stores **500, the threshold for character level 2**: blindly using its row label as the entered level creates an off-by-one error. All seven classes share the same thresholds. Sources: [Arreat Summit levels](http://classic.battle.net/diablo2exp/basics/levels.shtml) and pinned Experience.txt above.

| Character level | Cumulative XP to enter | XP to next |
| --- | --- | --- |
| 1 | 0 | 500 |
| 2 | 500 | 1000 |
| 3 | 1500 | 2250 |
| 4 | 3750 | 4125 |
| 5 | 7875 | 6300 |
| 6 | 14175 | 8505 |
| 7 | 22680 | 10206 |
| 8 | 32886 | 11510 |
| 9 | 44396 | 13319 |
| 10 | 57715 | 14429 |
| 11 | 72144 | 18036 |
| 12 | 90180 | 22545 |
| 13 | 112725 | 28181 |
| 14 | 140906 | 35226 |
| 15 | 176132 | 44033 |
| 16 | 220165 | 55042 |
| 17 | 275207 | 68801 |
| 18 | 344008 | 86002 |
| 19 | 430010 | 107503 |
| 20 | 537513 | 134378 |
| 21 | 671891 | 167973 |
| 22 | 839864 | 209966 |
| 23 | 1049830 | 262457 |
| 24 | 1312287 | 328072 |
| 25 | 1640359 | 410090 |
| 26 | 2050449 | 512612 |
| 27 | 2563061 | 640765 |
| 28 | 3203826 | 698434 |
| 29 | 3902260 | 761293 |
| 30 | 4663553 | 829810 |
| 31 | 5493363 | 904492 |
| 32 | 6397855 | 985897 |
| 33 | 7383752 | 1074627 |
| 34 | 8458379 | 1171344 |
| 35 | 9629723 | 1276765 |
| 36 | 10906488 | 1391674 |
| 37 | 12298162 | 1516924 |
| 38 | 13815086 | 1653448 |
| 39 | 15468534 | 1802257 |
| 40 | 17270791 | 1964461 |
| 41 | 19235252 | 2141263 |
| 42 | 21376515 | 2333976 |
| 43 | 23710491 | 2544034 |
| 44 | 26254525 | 2772997 |
| 45 | 29027522 | 3022566 |
| 46 | 32050088 | 3294598 |
| 47 | 35344686 | 3591112 |
| 48 | 38935798 | 3914311 |
| 49 | 42850109 | 4266600 |
| 50 | 47116709 | 4650593 |
| 51 | 51767302 | 5069147 |
| 52 | 56836449 | 5525370 |
| 53 | 62361819 | 6022654 |
| 54 | 68384473 | 6564692 |
| 55 | 74949165 | 7155515 |
| 56 | 82104680 | 7799511 |
| 57 | 89904191 | 8501467 |
| 58 | 98405658 | 9266598 |
| 59 | 107672256 | 10100593 |
| 60 | 117772849 | 11009646 |
| 61 | 128782495 | 12000515 |
| 62 | 140783010 | 13080560 |
| 63 | 153863570 | 14257811 |
| 64 | 168121381 | 15541015 |
| 65 | 183662396 | 16939705 |
| 66 | 200602101 | 18464279 |
| 67 | 219066380 | 20126064 |
| 68 | 239192444 | 21937409 |
| 69 | 261129853 | 23911777 |
| 70 | 285041630 | 26063836 |
| 71 | 311105466 | 28409582 |
| 72 | 339515048 | 30966444 |
| 73 | 370481492 | 33753424 |
| 74 | 404234916 | 36791232 |
| 75 | 441026148 | 40102443 |
| 76 | 481128591 | 43711663 |
| 77 | 524840254 | 47645713 |
| 78 | 572485967 | 51933826 |
| 79 | 624419793 | 56607872 |
| 80 | 681027665 | 61702579 |
| 81 | 742730244 | 67255812 |
| 82 | 809986056 | 73308835 |
| 83 | 883294891 | 79906630 |
| 84 | 963201521 | 87098226 |
| 85 | 1050299747 | 94937067 |
| 86 | 1145236814 | 103481403 |
| 87 | 1248718217 | 112794729 |
| 88 | 1361512946 | 122946255 |
| 89 | 1484459201 | 134011418 |
| 90 | 1618470619 | 146072446 |
| 91 | 1764543065 | 159218965 |
| 92 | 1923762030 | 173548673 |
| 93 | 2097310703 | 189168053 |
| 94 | 2286478756 | 206193177 |
| 95 | 2492671933 | 224750564 |
| 96 | 2717422497 | 244978115 |
| 97 | 2962400612 | 267026144 |
| 98 | 3229426756 | 291058498 |
| 99 | 3520485254 | — |


## 3. General skill mechanics and animation breakpoints

### +skills, hard points, damage types, and legacy behavior

- +All Skills, +Class Skills and +Tree Skills increase already-known skills; staffmods grant the named skill even at H0. Neither substitutes for hard-point prerequisites. Effective levels may exceed 20. Battle Command gives +1 and Skill Shrine +2 temporarily.
- Oskills work across classes. For a class that owns the skill, total oskill contribution is capped at +3; separate +All Skills still stacks. Charges and chance-to-cast use their listed skill level and do not normally grant hard-point synergies. Do not reproduce the obsolete pre-1.11 charged-skill synergy bug.
- Most synergies use hard points (`.blvl`). **Read the actual formula:** Skeleton Mastery, Golem Mastery, Summon Resist, Prayer's healing carried by Cleansing/Meditation, and Druid animal summoning mutual bonuses use effective levels where the formulas say `.lvl`. Those are not interchangeable with ordinary +% hard-point damage synergies.
- Six ordinary damage types: physical, magic, fire, lightning, cold, poison. Fire/cold/lightning deal instant or repeated collision damage; poison stores rate + length. Magic is not “elemental” for all-resistance, Conviction or Lower Resist. Life/mana steal normally requires qualifying physical weapon damage; Berserk's converted magic cannot leech.
- Normal elemental resist cap is 75% (increased maximum can reach 95%), minimum effective resistance −100%. Difficulty resistance penalties are 0 / −40 / −100. Immunity is resistance ≥100. Against an immune monster, Conviction/Lower Resist (their supported elements) and Amplify Damage/Decrepify (physical) have only **1/5 effectiveness** for breaking immunity. Original Cold Mastery and item −enemy resistance cannot independently break immunity.
- Cold chill/freeze lengths are frames, reduced to **1/2 in Nightmare, 1/4 in Hell**, also affected by target cold resistance and cold effectiveness. Chill slows; freeze immobilizes eligible ordinary monsters. Bosses/champions and various types cannot be fully frozen. Cannot Be Frozen prevents ordinary chill/freeze, not the special Holy Freeze aura slow. Do not hardcode one universal 50% monster slow: use MonStats cold-effectiveness fields and skill-specific effects.
- Poison total displayed damage is rate×duration. Recasting Poison Nova does **not** create independently stacking 2-second damage streams; the poison application/overwrite rules compare rates. Item poison sources ordinarily add rates and average their lengths; skill-plus-item combinations and projectile-specific behavior are special cases. Venom's attack poison uses **10 frames = 0.4 seconds**, truncating ordinary item poison to that length; Poison Dagger/Javelin skill interactions are exceptional, not a blanket replacement rule. Poison resistance reduces rate; Poison Length Reduced changes duration separately and has Nightmare/Hell penalties. Preserve rate and length independently; do not apply cold's 1/2 and 1/4 duration penalties to poison. Detailed mixed-source poison merging remains an executable-verification item, not a guessed generic stacking model.
- Timed skills in original LoD share the casting-delay lockout; FCR shortens their casting animation, **not the listed cooldown**. Preserve each skill's `delay` in frames. Do not adopt D2R's independent cooldown changes.
- Attack animations use IAS, not FCR: Amazon arrows/javelins, Paladin weapon skills, Barbarian melee, Assassin trap placement and martial arts. Assassin Mind Blast/Cloak and ordinary caster spells use cast animations. Druid Shock Wave uses a cast animation while transformed; most elemental spells and Teleport cannot be cast in wereforms in original LoD (Armageddon is an important exception).
- Original summon exclusivity: Necromancer one golem, but skeleton warriors, mages and revives may coexist. Druid one animal group (**Spirit Wolves OR Dire Wolves OR Grizzly**, not all three), one spirit, one vine; ravens can coexist. Assassin one Shadow Warrior OR Shadow Master; stationary sentry traps share a five-trap cap. Original Hydra has its **1.6-second delay and 10-second life**; do not substitute the D2R no-delay rules.

### Reading breakpoint tables

Each cell lists `required percentage:animation frames`; select the **largest threshold ≤ equipped value**. Stats between thresholds do nothing. Logic is always 25 FPS regardless of browser rendering FPS. These are normal legacy animations, not D2R's altered recovery-lockout behavior. Extremely high mathematical thresholds are included even if unattainable with normal equipment.

Sources: [legacy LoD tables](https://asgardpvp.com/guides/bp/), [Diablo Wiki table reference](https://diablo2.diablowiki.net/Breakpoints), and [cross-check of standard class/form tables](https://steamcommunity.com/sharedfiles/filedetails/?id=3669140110). The last source is modern; only unchanged animation values are used here, no eighth class or new mechanics. See the uncertainty note for Paladin spear/staff and vampire-form recovery.

### Faster Cast Rate (FCR)

| Class / form / skill | FCR%:frames |
| --- | --- |
| Amazon | 0:19, 7:18, 14:17, 22:16, 32:15, 48:14, 68:13, 99:12, 152:11 |
| Sorceress; normal spells | 0:13, 9:12, 20:11, 37:10, 63:9, 105:8, 200:7 |
| Sorceress; Lightning / Chain Lightning | 0:19, 7:18, 15:17, 23:16, 35:15, 52:14, 78:13, 117:12, 194:11 |
| Necromancer; human | 0:15, 9:14, 18:13, 30:12, 48:11, 75:10, 125:9 |
| Necromancer; Trang-Oul vampire | 0:23, 6:22, 11:21, 18:20, 24:19, 35:18, 48:17, 65:16, 86:15, 120:14, 180:13 |
| Paladin | 0:15, 9:14, 18:13, 30:12, 48:11, 75:10, 125:9 |
| Barbarian | 0:13, 9:12, 20:11, 37:10, 63:9, 105:8, 200:7 |
| Druid; human | 0:18, 4:17, 10:16, 19:15, 30:14, 46:13, 68:12, 99:11, 163:10 |
| Druid; werewolf | 0:16, 6:15, 14:14, 26:13, 40:12, 60:11, 95:10, 157:9 |
| Druid; werebear | 0:16, 7:15, 15:14, 26:13, 40:12, 63:11, 99:10, 163:9 |
| Assassin; casts (not trap-laying) | 0:16, 8:15, 16:14, 27:13, 42:12, 65:11, 102:10, 174:9 |


### Faster Hit Recovery (FHR)

| Class / form / weapon | FHR%:frames |
| --- | --- |
| Amazon | 0:11, 6:10, 13:9, 20:8, 32:7, 52:6, 86:5, 174:4, 600:3 |
| Sorceress | 0:15, 5:14, 9:13, 14:12, 20:11, 30:10, 42:9, 60:8, 86:7, 142:6, 280:5, 1480:4 |
| Necromancer; human | 0:13, 5:12, 10:11, 16:10, 26:9, 39:8, 56:7, 86:6, 152:5, 377:4 |
| Necromancer; vampire (partial legacy table) | 0:17, 2:16, 6:15, 10:14, 16:13, 24:12, 34:11, 48:10, 72:9, 117:8; later thresholds unverified |
| Paladin; ordinary weapon modes | 0:9, 7:8, 15:7, 27:6, 48:5, 86:4, 200:3, 4680:2 |
| Paladin; spear/staff (disputed 5-frame threshold) | 0:13, 3:12, 7:11, 13:10, 20:9, 32:8, 48:7, 75:6, 120 or 129:5, 280:4 |
| Barbarian / Assassin | 0:9, 7:8, 15:7, 27:6, 48:5, 86:4, 200:3, 4680:2 |
| Druid; human, one-handed swinging weapon | 0:14, 3:13, 7:12, 13:11, 19:10, 29:9, 42:8, 63:7, 99:6, 174:5, 456:4 |
| Druid; human, other weapon modes | 0:13, 5:12, 10:11, 16:10, 26:9, 39:8, 56:7, 86:6, 152:5, 377:4 |
| Druid; werewolf | 0:7, 9:6, 20:5, 42:4, 86:3, 280:2 |
| Druid; werebear | 0:13, 5:12, 10:11, 16:10, 24:9, 37:8, 54:7, 86:6, 152:5, 360:4 |


Hit recovery is not triggered by every successful hit. Legacy damage-threshold tables distinguish missile hit flags: common thresholds are 1/16, 1/8, 1/4 maximum life with 37.5%, 75%, 100% recovery probability; Bone Spear/other special missiles can use 1/8, 1/4, 1/2 instead. Stun state, knockback, animation uninterruptibility and missile `GetHit`/`HitFlags` affect this. Do not infer a universal “damage > 1/12 life” rule from simplified guides. Exact hit-flag dispatch needs executable validation.


### Faster Block Rate (FBR)

| Class / form / weapon | FBR%:frames |
| --- | --- |
| Amazon; one-handed swinging weapon | 0:17, 4:16, 6:15, 11:14, 15:13, 23:12, 29:11, 40:10, 56:9, 80:8, 120:7, 200:6, 480:5 |
| Amazon; other modes (including javelin/dagger) | 0:5, 13:4, 32:3, 86:2, 600:1 |
| Sorceress | 0:9, 7:8, 15:7, 27:6, 48:5, 86:4, 200:3, 4680:2 |
| Necromancer; human | 0:11, 6:10, 13:9, 20:8, 32:7, 52:6, 86:5, 174:4, 600:3 |
| Paladin; no Holy Shield | 0:5, 13:4, 32:3, 86:2, 600:1 |
| Paladin; Holy Shield | 0:2, 86:1 |
| Barbarian | 0:7, 9:6, 20:5, 42:4, 86:3, 280:2 |
| Druid; human | 0:11, 6:10, 13:9, 20:8, 32:7, 52:6, 86:5, 174:4, 600:3 |
| Druid; werewolf | 0:9, 7:8, 15:7, 27:6, 48:5, 86:4, 200:3 |
| Druid; werebear | 0:12, 5:11, 10:10, 16:9, 27:8, 40:7, 65:6, 109:5, 223:4 |
| Assassin; shield and Weapon Block | 0:5, 13:4, 32:3, 86:2, 600:1 |
| Necromancer; vampire | Separate monster-form block animation; not independently verified here. Do not silently use human timings. |


One-handed swinging mode includes axes, clubs, maces, scepters, swords, orbs, wands and throwing axes; it is not synonymous with every one-handed weapon. FBR changes animation length, not chance to block.

### IAS / attack speed basics (legacy)

`itemEIAS = floor(120×IAS/(120+IAS))`; then combine skill attack-speed bonus, weapon speed modifier and applicable slow: `totalEIAS = itemEIAS + skillEIAS − WSM − slow`. Standard attack-animation speed is bounded (normally −85…+75 EIAS); special sequences/wereforms have their own handling. Negative WSM is a faster weapon. WSM is not a percentage to add to raw IAS before diminishing returns.

For a regular animation: `AnimRate = floor(AnimationSpeed×(100+totalEIAS)/100)`; `framesPerCycle = ceil((FramesPerDirection−1−StartingFrame)×256/AnimRate)`; attacks/second = 25/framesPerCycle. Read action flags to determine **when the hit occurs**, not just the end of the animation. Characters, weapon classes, dual wield modes, kick attacks and multi-hit sequences need separate animation records. [Legacy animation parameters and formula](https://www.theamazonbasin.com/wiki/index.php/Attack_speed), [legacy IAS calculator](https://d2.lc/IAS/).

- Dual wield WSM depends on equipped primary-hand state: normal `(leftWSM+rightWSM)/2`; legacy opposite-primary handling can introduce `−leftWSM+rightWSM` adjustment. Do not import D2R's fixes or treat dual wield as two independently timed single-hand attacks.
- Original Whirlwind uses **weapon IAS only**, not off-weapon IAS or Fanaticism. First checks are at frames 4 and 8. Let `S=WSM−weaponIAS`. One-handed weapons and two-handed swords: `S>15:12f; 10<S≤15:10f; −10<S≤10:8f; −34<S≤−10:6f; S≤−34:4f`. Other two-handed weapons: `S>15:14f; 0<S≤15:12f; −10<S≤0:10f; −30<S≤−10:8f; −60<S≤−30:6f; S≤−60:4f`. Dual-wield selection and range checks still matter. These are [the original Arreat Summit rules](http://classic.battle.net/diablo2exp/skills/barbarian-combatskills.shtml), not D2R 2.4.3+ Whirlwind.
- Original wereform attack speed has weapon-IAS and form/animation-specific rules: do not reuse the ordinary EIAS equation for Fury, Maul or Fire Claws. Use a calculator explicitly set to **legacy LoD** and record weapon, form, skill and action timing as test vectors.
- Assassin trap laying uses IAS/WSM (commonly max 9 frames), while Blade Fury is its own fixed sequence. Zeal/Fury/Jab/Fend/Strafe use multiple hit/action frames and rollback; a single universal “frames per attack” misses the first/last swing.

## 4. Skill catalogue: all seven classes

The immediate prerequisites are the actual `reqskill1/2` edges. The additional closure is every upstream hard-point prerequisite, useful for build-point accounting. Class skill IDs are stable data keys; names in formulas are kept exactly as the game data names them. Every tree has ten skills.

**Base channels below are before synergy, mastery, items and enemy mitigation.** An E channel with no EType may encode healing, stat magnitude or absorption, not damage. “HP equivalent” is the unrounded fixed-point conversion; do not floor each bracket increment independently. Published L1–20 tables are a cross-check, not a replacement for these base formulas.

## 4.1. Amazon

### Bow and Crossbow Skills

Source display tables: [Arreat Summit — Bow and Crossbow Skills](http://classic.battle.net/diablo2exp/skills/amazon-bow.shtml). Exact fields: pinned Skills.txt / SkillDesc.txt / Missiles.txt listed in §0.


| ID | Skill | Required clvl | Immediate prerequisites | Type | Mana expression |
| --- | --- | --- | --- | --- | --- |
| 6 | Magic Arrow | 1 | None | active | `(12 − 1×(L−1))×0.125; ≤0 needs no mana (signed raw value retained)` |
| 7 | Fire Arrow | 1 | None | active | `max(1, (24 + 1×(L−1))×0.125)` |
| 11 | Cold Arrow | 6 | None | active | `max(1, (28 + 1×(L−1))×0.125)` |
| 12 | Multiple Shot | 6 | Magic Arrow | active | `max(1, (4 + 1×(L−1))×1)` |
| 16 | Exploding Arrow | 12 | Fire Arrow, Multiple Shot | active | `max(1, (10 + 1×(L−1))×0.5)` |
| 21 | Ice Arrow | 18 | Cold Arrow | active | `max(1, (16 + 1×(L−1))×0.25)` |
| 22 | Guided Arrow | 18 | Cold Arrow, Multiple Shot | active | `max(1, (32 − 1×(L−1))×0.25)` |
| 26 | Strafe | 24 | Guided Arrow | active | `max(1, (11)×1)` |
| 27 | Immolation Arrow | 24 | Exploding Arrow | active | `max(1, (12 + 1×(L−1))×0.5)` |
| 31 | Freezing Arrow | 30 | Ice Arrow | active | `max(1, (18 + 1×(L−1))×0.5)` |


#### Magic Arrow — ID 6


| Property | Value |
| --- | --- |
| Tree | Bow and Crossbow Skills |
| Required character level | 1 |
| Immediate prerequisites | None |
| All upstream prerequisites | None |
| Type | active |
| Internal data name | `Magic Arrow` |
| Mana | `(12 − 1×(L−1))×0.125; ≤0 needs no mana (signed raw value retained)` |
| Animation / source-damage field | `A1; SrcDam=128 /128` |
| itypea1 | `miss` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| Physical (raw) | 1–1 | 1–1 | 1–1 | 1–1 | 1–1 | 1–1 |
| Physical (HP equivalent / see channel role; ×1) | 1–1 | 1–1 | 1–1 | 1–1 | 1–1 | 1–1 |
| Physical unsynergized L20 | 20–20 | — | — | — | — | — |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| ToHit (+% AR for usual attacks) | `10 + 9×(L−1)` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| descline1 (formatter 1) | `10` | — |
| Converts %d%% Physical Damage to Magic Damage | `1+(lvl-1)*1` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Mana Cost | L1–20: `1.5, 1.3, 1.2, 1.1, 1.0, 0.8, 0.7, 0.6, 0.5, 0.3, 0.2, 0.1, 0, -0.1, -0.2, -0.3, -0.5, -0.6, -0.7, -0.8` |
| Converts X% Physical Damage To Magic Damage | L1–20: `1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20` |
| +X% To Attack Rating | L1–20: `10, 19, 28, 37, 46, 55, 64, 73, 82, 91, 100, 109, 118, 127, 136, 145, 154, 163, 172, 181` |
| Damage +X | L1–20: `1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20` |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **magicarrow** (Missiles ID 27): `pSrvDoFunc`=`1`; `pSrvDmgFunc`=`1`; `DmgCalc1`=`dl12`; `dParam1`=`1`; `dParam2`=`1`; `Vel`=`24`; `MaxVel`=`24`; `Range`=`40`; `CollideType`=`3`; `CollideKill`=`1`; `LastCollide`=`1`; `Size`=`1`; `GetHit`=`1`; `Skill`=`Magic Arrow`; `ResultFlags`=`4`; `EType`=`mag`.


Component **teethexplode** (Missiles ID 204): `pSrvDoFunc`=`1`; `Range`=`13`.




#### Fire Arrow — ID 7


| Property | Value |
| --- | --- |
| Tree | Bow and Crossbow Skills |
| Required character level | 1 |
| Immediate prerequisites | None |
| All upstream prerequisites | None |
| Type | active |
| Internal data name | `Fire Arrow` |
| Mana | `max(1, (24 + 1×(L−1))×0.125)` |
| Animation / source-damage field | `A1; SrcDam=128 /128` |
| itypea1 | `miss` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / fire (raw) | 1–4 | 2–2 | 3–3 | 6–7 | 12–14 | 24–27 |
| E / fire (HP equivalent / see channel role; ×1) | 1–4 | 2–2 | 3–3 | 6–7 | 12–14 | 24–27 |
| E / fire unsynergized L20 | 63–70 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par8 | 12 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| EDmgSymPerCalc | `(skill('Exploding Arrow'.blvl)) * par8` |
| ToHit (+% AR for usual attacks) | `10 + 9×(L−1)` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Converts %d%% Physical Damage to Elemental Damage | `3+(lvl-1)*2` | — |
| Exploding Arrow / Fire Damage per Level | `par8` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Fire Arrow Receives Bonuses From
- Exploding Arrow: +12% Fire Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Mana Cost | L1–20: `3, 3.1, 3.2, 3.3, 3.5, 3.6, 3.7, 3.8, 4, 4.1, 4.2, 4.3, 4.5, 4.6, 4.7, 4.8, 5, 5.1, 5.2, 5.3` |
| Fire Damage | L1–20: `1-4, 3-6, 5-8, 7-10, 9-12, 11-14, 13-16, 15-18, 18-21, 21-24, 24-27, 27-30, 30-33, 33-36, 36-39, 39-42, 45-49, 51-56, 57-63, 63-70` |
| Converts X% Physical Damage / To Elemental Damage | L1–20: `3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31, 33, 35, 37, 39, 41` |
| +X% To Attack Rating | L1–20: `10, 19, 28, 37, 46, 55, 64, 73, 82, 91, 100, 109, 118, 127, 136, 145, 154, 163, 172, 181` |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **firearrow** (Missiles ID 12): `pSrvDoFunc`=`1`; `pSrvDmgFunc`=`1`; `DmgCalc1`=`dl12`; `dParam1`=`3`; `dParam2`=`2`; `Vel`=`24`; `MaxVel`=`24`; `Range`=`40`; `CollideType`=`3`; `CollideKill`=`1`; `LastCollide`=`1`; `Size`=`1`; `GetHit`=`1`; `MissileSkill`=`1`; `Skill`=`Fire Arrow`; `ResultFlags`=`4`; `EType`=`fire`.


Component **fireexplode** (Missiles ID 29): `Range`=`12`; `CollideKill`=`1`; `LastCollide`=`1`; `Size`=`1`; `GetHit`=`1`; `ResultFlags`=`4`; `HitShift`=`8`.




#### Cold Arrow — ID 11


| Property | Value |
| --- | --- |
| Tree | Bow and Crossbow Skills |
| Required character level | 6 |
| Immediate prerequisites | None |
| All upstream prerequisites | None |
| Type | active |
| Internal data name | `Cold Arrow` |
| Mana | `max(1, (28 + 1×(L−1))×0.125)` |
| Animation / source-damage field | `A1; SrcDam=128 /128` |
| itypea1 | `miss` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / cold (raw) | 6–8 | 4–4 | 5–5 | 8–9 | 16–17 | 42–44 |
| E / cold (HP equivalent / see channel role; ×0.5) | 3–4 | 2–2 | 2.5–2.5 | 4–4.5 | 8–8.5 | 21–22 |
| E / cold unsynergized L20 | 53–56 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par8 | 12 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| EDmgSymPerCalc | `(skill('Ice Arrow'.blvl)) * par8` |
| ToHit (+% AR for usual attacks) | `10 + 9×(L−1)` |
| E length: frames, L1; increments L2–8 / L9–16 / L17+ | `100; 30 / 30 / 30` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Converts %d%% Physical Damage to Elemental Damage | `3+(lvl-1)*2` | — |
| Ice Arrow / Cold Damage per Level | `par8` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Cold Arrow Receives Bonuses From
- Ice Arrow: +12% Cold Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Mana Cost | L1–20: `3.5, 3.6, 3.7, 3.8, 4, 4.1, 4.2, 4.3, 4.5, 4.6, 4.7, 4.8, 5, 5.1, 5.2, 5.3, 5.5, 5.6, 5.7, 5.8` |
| Cold Damage | L1–20: `3-4, 5-6, 7-8, 9-10, 11-12, 13-14, 15-16, 17-18, 19-20, 22-23, 24-25, 27-28, 29-30, 32-33, 34-35, 37-38, 41-42, 45-47, 49-51, 53-56` |
| Cold Length (seconds) | L1–20: `4, 5.2, 6.4, 7.6, 8.8, 10, 11.2, 12.4, 13.6, 14.8, 16, 17.2, 18.4, 19.6, 20.8, 22, 23.2, 24.4, 25.6, 26.8` |
| Converts X% Physical Damage / To Elemental Damage | L1–20: `3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31, 33, 35, 37, 39, 41` |
| +% To Attack Rating | L1–20: `10, 19, 28, 37, 46, 55, 64, 73, 82, 91, 100, 109, 118, 127, 136, 145, 154, 163, 172, 181` |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **coldarrow** (Missiles ID 40): `pSrvDoFunc`=`1`; `pSrvDmgFunc`=`1`; `DmgCalc1`=`dl12`; `dParam1`=`3`; `dParam2`=`2`; `Vel`=`24`; `MaxVel`=`24`; `Range`=`20`; `CollideType`=`3`; `CollideKill`=`1`; `LastCollide`=`1`; `Size`=`1`; `GetHit`=`1`; `MissileSkill`=`1`; `Skill`=`Cold Arrow`; `ResultFlags`=`4`; `EType`=`cold`.


Component **iceexplode** (Missiles ID 30): `Range`=`16`; `CollideKill`=`1`; `LastCollide`=`1`; `Size`=`1`; `GetHit`=`1`; `ResultFlags`=`4`; `HitShift`=`8`.




#### Multiple Shot — ID 12


| Property | Value |
| --- | --- |
| Tree | Bow and Crossbow Skills |
| Required character level | 6 |
| Immediate prerequisites | Magic Arrow |
| All upstream prerequisites | Magic Arrow |
| Type | active |
| Internal data name | `Multiple Shot` |
| Mana | `max(1, (4 + 1×(L−1))×1)` |
| Animation / source-damage field | `A1; SrcDam=96 /128` |
| itypea1 | `miss` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 2 | number of arrows to fire |
| par2 | 1 | additional arrows per level |
| par3 | 1 | Acivation frame of arrows. |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| calc1 — # missiles | `min(24,ln12)` |
| calc2 — activation frame | `par3` |
| calc3 — triggered | `2` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| arrows | `min(24,ln12)` | — |
| Weapon Damage | `3` | `4` |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Mana Cost | L1–20: `4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23` |
| # of Arrows | L1–20: `2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21` |
| Constant / source label | Damage -25% |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **multipleshotarrow** (Missiles ID 213): `pSrvDoFunc`=`1`; `Vel`=`24`; `MaxVel`=`24`; `Range`=`50`; `CollideType`=`3`; `CollideKill`=`1`; `LastCollide`=`1`; `NextHit`=`1`; `NextDelay`=`4`; `Size`=`1`; `GetHit`=`1`; `ResultFlags`=`4`; `HitShift`=`8`; `SrcDamage`=`96`.


Component **multipleshotbolt** (Missiles ID 214): `pSrvDoFunc`=`1`; `Vel`=`24`; `MaxVel`=`24`; `Range`=`50`; `CollideType`=`3`; `CollideKill`=`1`; `LastCollide`=`1`; `NextHit`=`1`; `NextDelay`=`4`; `Size`=`1`; `GetHit`=`1`; `ResultFlags`=`4`; `HitShift`=`8`; `SrcDamage`=`96`.




#### Exploding Arrow — ID 16


| Property | Value |
| --- | --- |
| Tree | Bow and Crossbow Skills |
| Required character level | 12 |
| Immediate prerequisites | Fire Arrow, Multiple Shot |
| All upstream prerequisites | Fire Arrow, Magic Arrow, Multiple Shot |
| Type | active |
| Internal data name | `Exploding Arrow` |
| Mana | `max(1, (10 + 1×(L−1))×0.5)` |
| Animation / source-damage field | `A1; SrcDam=128 /128` |
| itypea1 | `miss` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / fire (raw) | 2–6 | 5–5 | 7–8 | 9–11 | 12–14 | 20–23 |
| E / fire (HP equivalent / see channel role; ×1) | 2–6 | 5–5 | 7–8 | 9–11 | 12–14 | 20–23 |
| E / fire unsynergized L20 | 129–149 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par8 | 12 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| EDmgSymPerCalc | `(skill('Fire Arrow'.blvl)) * par8` |
| ToHit (+% AR for usual attacks) | `20 + 9×(L−1)` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Fire Arrow / Fire Damage per Level | `par8` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Exploding Arrow Receives Bonuses From
- Fire Arrow: +12% Fire Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Mana Cost | L1–20: `5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14, 14.5` |
| Fire Damage | L1–20: `2-6, 7-11, 12-16, 17-21, 22-26, 27-31, 32-36, 37-41, 44-49, 51-57, 58-65, 65-73, 72-81, 79-89, 86-97, 93-105, 102-116, 111-127, 120-138, 129-149` |
| +% To Attack Rating | L1–20: `20, 29, 38, 47, 56, 65, 74, 83, 92, 101, 110, 119, 128, 137, 146, 155, 164, 173, 182, 191` |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **explodingarrow** (Missiles ID 41): `pSrvDoFunc`=`1`; `pSrvHitFunc`=`4`; `Vel`=`24`; `MaxVel`=`24`; `Range`=`40`; `CollideType`=`3`; `CollideKill`=`1`; `LastCollide`=`1`; `Size`=`1`; `GetHit`=`1`; `SrcDamage`=`128`; `EType`=`fire`; `HitSubMissile1`=`explodingarrowexp2`.


Component **explodingarrowexp** (Missiles ID 42): `Range`=`16`; `CollideKill`=`1`; `LastCollide`=`1`; `Size`=`1`; `GetHit`=`1`; `ResultFlags`=`4`.


Component **explodingarrowexp2** (Missiles ID 656): `pSrvDoFunc`=`1`; `pSrvHitFunc`=`1`; `sHitPar1`=`5`; `Range`=`1`; `CollideType`=`3`; `CollideKill`=`1`; `Size`=`1`; `GetHit`=`1`; `MissileSkill`=`1`; `Skill`=`Exploding Arrow`; `ResultFlags`=`5`; `HitFlags`=`2`; `HitShift`=`8`; `EType`=`fire`.


Component **fireexplosion2** (Missiles ID 265): `pSrvDoFunc`=`1`; `Range`=`12`; `CollideKill`=`1`; `LastCollide`=`1`; `Size`=`1`; `GetHit`=`1`; `ResultFlags`=`4`; `HitShift`=`8`.




#### Ice Arrow — ID 21


| Property | Value |
| --- | --- |
| Tree | Bow and Crossbow Skills |
| Required character level | 18 |
| Immediate prerequisites | Cold Arrow |
| All upstream prerequisites | Cold Arrow |
| Type | active |
| Internal data name | `Ice Arrow` |
| Mana | `max(1, (16 + 1×(L−1))×0.25)` |
| Animation / source-damage field | `A1; SrcDam=128 /128` |
| itypea1 | `miss` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / cold (raw) | 6–10 | 6–6 | 12–13 | 18–19 | 26–27 | 36–38 |
| E / cold (HP equivalent / see channel role; ×1) | 6–10 | 6–6 | 12–13 | 18–19 | 26–27 | 36–38 |
| E / cold unsynergized L20 | 216–232 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par7 | 5 | length synergy |
| par8 | 8 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| EDmgSymPerCalc | `(skill('Cold Arrow'.blvl))*par8` |
| ELenSymPerCalc | `(skill('Freezing Arrow'.blvl)) * par7` |
| ToHit (+% AR for usual attacks) | `20 + 9×(L−1)` |
| E length: frames, L1; increments L2–8 / L9–16 / L17+ | `50; 5 / 5 / 5` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Freezes for | `edln` | — |
| Cold Arrow / Cold Damage per Level | `par8` | — |
| Freezing Arrow / Freeze Length per Level | `par7` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Ice Arrow Receives Bonuses From
- Cold Arrow: +8% Cold Damage Per Level
- Freezing Arrow: +5% Cold Length Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Mana Cost | L1–20: `4, 4.2, 4.5, 4.7, 5, 5.2, 5.5, 5.7, 6, 6.2, 6.5, 6.7, 7, 7.2, 7.5, 7.7, 8, 8.2, 8.5, 8.7` |
| Freeze (seconds) | L1–20: `2, 2.2, 2.4, 2.6, 2.8, 3, 3.2, 3.4, 3.6, 3.8, 4, 4.2, 4.4, 4.6, 4.8, 5, 5.2, 5.4, 5.6, 5.8` |
| Cold Damage | L1–20: `6-10, 12-16, 18-22, 24-28, 30-34, 36-40, 42-46, 48-52, 60-65, 72-78, 84-91, 96-104, 108-117, 120-130, 132-143, 144-156, 162-175, 180-194, 198-213, 216-232` |
| +X% To Attack Rating | L1–20: `20, 29, 38, 47, 56, 65, 74, 83, 92, 101, 110, 119, 128, 137, 146, 155, 164, 173, 182, 191` |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **icearrow** (Missiles ID 28): `pSrvDoFunc`=`1`; `pSrvDmgFunc`=`2`; `dParam1`=`100`; `Vel`=`24`; `MaxVel`=`24`; `Range`=`40`; `CollideType`=`3`; `CollideKill`=`1`; `LastCollide`=`1`; `Size`=`1`; `GetHit`=`1`; `Skill`=`Ice Arrow`; `ResultFlags`=`4`.


Component **iceexplode** (Missiles ID 30): `Range`=`16`; `CollideKill`=`1`; `LastCollide`=`1`; `Size`=`1`; `GetHit`=`1`; `ResultFlags`=`4`; `HitShift`=`8`.




#### Guided Arrow — ID 22


| Property | Value |
| --- | --- |
| Tree | Bow and Crossbow Skills |
| Required character level | 18 |
| Immediate prerequisites | Cold Arrow, Multiple Shot |
| All upstream prerequisites | Cold Arrow, Magic Arrow, Multiple Shot |
| Type | active |
| Internal data name | `Guided Arrow` |
| Mana | `max(1, (32 − 1×(L−1))×0.25)` |
| Animation / source-damage field | `A1; SrcDam=128 /128` |
| itypea1 | `miss` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par3 | 0 | Damage percent |
| par4 | 5 | damage % per level |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| calc1 — + dmg% | `ln34` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Damage: / percent | `ln34` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Mana Cost | L1–20: `8, 7.7, 7.5, 7.2, 7, 6.7, 6.5, 6.2, 6, 5.7, 5.5, 5.2, 5, 4.7, 4.5, 4.2, 4, 3.7, 3.5, 3.2` |
| Damage +% | L1–20: `0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95` |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **guidedarrow** (Missiles ID 86): `pSrvDoFunc`=`7`; `pSrvHitFunc`=`10`; `Param1`=`5`; `Param2`=`15`; `Vel`=`24`; `MaxVel`=`24`; `Range`=`128`; `CollideType`=`3`; `CollideKill`=`1`; `Size`=`1`; `GetHit`=`1`; `Skill`=`Guided Arrow`; `ResultFlags`=`4`.




#### Strafe — ID 26


| Property | Value |
| --- | --- |
| Tree | Bow and Crossbow Skills |
| Required character level | 24 |
| Immediate prerequisites | Guided Arrow |
| All upstream prerequisites | Cold Arrow, Magic Arrow, Multiple Shot, Guided Arrow |
| Type | active |
| Internal data name | `Strafe` |
| Mana | `max(1, (11)×1)` |
| Animation / source-damage field | `A1; SrcDam=96 /128` |
| itypea1 | `miss` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 5 | Damage increase |
| par2 | 5 | Damage increase per level |
| par3 | 4 | Base Shots to take (+1 per level) |
| par4 | 10 | Max shots to take |
| par5 | 35 | Radius |
| par6 | 50 | % frame rollback |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurarangecalc | `par5` |
| calc1 — #missiles | `min(par3 + lvl - 1, par4)` |
| calc2 — damage % | `ln12` |
| calc3 — min # missiles | `2+lvl/4` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Damage: / percent | `ln12` | — |
| Attacks up to / targets | `min(lvl+par3,par4)` | — |
| Weapon Damage | `3` | `4` |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 11 |
| Attacks up to | L1–20: `5, 6, 7, 8, 9, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10` |
| Damage +% | L1–20: `5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100` |
| Constant / source label | 3/4 Weapon Damage |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **strafearrow** (Missiles ID 682): `pSrvDoFunc`=`1`; `Vel`=`24`; `MaxVel`=`24`; `Range`=`50`; `CollideType`=`3`; `CollideKill`=`1`; `LastCollide`=`1`; `NextHit`=`1`; `NextDelay`=`4`; `Size`=`1`; `GetHit`=`1`; `ResultFlags`=`4`; `HitShift`=`8`; `SrcDamage`=`96`.


Component **strafebolt** (Missiles ID 683): `pSrvDoFunc`=`1`; `Vel`=`24`; `MaxVel`=`24`; `Range`=`50`; `CollideType`=`3`; `CollideKill`=`1`; `LastCollide`=`1`; `NextHit`=`1`; `NextDelay`=`4`; `Size`=`1`; `GetHit`=`1`; `ResultFlags`=`4`; `HitShift`=`8`; `SrcDamage`=`96`.


Component **multipleshotarrow** (Missiles ID 213): `pSrvDoFunc`=`1`; `Vel`=`24`; `MaxVel`=`24`; `Range`=`50`; `CollideType`=`3`; `CollideKill`=`1`; `LastCollide`=`1`; `NextHit`=`1`; `NextDelay`=`4`; `Size`=`1`; `GetHit`=`1`; `ResultFlags`=`4`; `HitShift`=`8`; `SrcDamage`=`96`.


Component **multipleshotbolt** (Missiles ID 214): `pSrvDoFunc`=`1`; `Vel`=`24`; `MaxVel`=`24`; `Range`=`50`; `CollideType`=`3`; `CollideKill`=`1`; `LastCollide`=`1`; `NextHit`=`1`; `NextDelay`=`4`; `Size`=`1`; `GetHit`=`1`; `ResultFlags`=`4`; `HitShift`=`8`; `SrcDamage`=`96`.




#### Immolation Arrow — ID 27


| Property | Value |
| --- | --- |
| Tree | Bow and Crossbow Skills |
| Required character level | 24 |
| Immediate prerequisites | Exploding Arrow |
| All upstream prerequisites | Fire Arrow, Magic Arrow, Multiple Shot, Exploding Arrow |
| Type | active |
| Internal data name | `Immolation Arrow` |
| Mana | `max(1, (12 + 1×(L−1))×0.5)` |
| Animation / source-damage field | `A1; SrcDam=128 /128` |
| Shared casting delay | 25 frames = 1 seconds |
| itypea1 | `miss` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / fire (raw) | 12–23 | 12–12 | 23–23 | 34–34 | 36–36 | 38–38 |
| E / fire (HP equivalent / see channel role; ×1) | 12–23 | 12–12 | 23–23 | 34–34 | 36–36 | 38–38 |
| E / fire unsynergized L20 | 416–427 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 3 | Fire disc radius |
| par2 | 4 | Radial Damage Radius |
| par8 | 10 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| calc1 — fire disc radius | `par1` |
| calc2 — damage radius | `par2` |
| EDmgSymPerCalc | `(skill('Exploding Arrow'.blvl)) * par8` |
| ToHit (+% AR for usual attacks) | `30 + 9×(L−1)` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Attack: / percent | `toht` | — |
| Fire Arrow / Average Fire Damage per Second per Level | `5` | — |
| Exploding Arrow / Fire Damage per Level | `par8` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Immolation Arrow Receives Bonuses From
- Fire Arrow: +5% Average Fire Damage Per Second Per Level
- Exploding Arrow: +10% Fire Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Mana Cost | L1–20: `6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14, 14.5, 15, 15.5` |
| Explosive Damage | L1–20: `13-25, 26-38, 39-51, 52-64, 66-78, 79-91, 92-104, 105-117, 130-143, 156-168, 181-193, 206-218, 232-244, 257-269, 282-294, 308-320, 345-357, 382-394, 420-432, 457-469` |
| Constant / source label | Fire Duration 4 Seconds |
| Average Fire Damage Per Second | L1–20: `8-10, 14-16, 19-22, 26-29, 32-35, 38-41, 44-46, 51-53, 57-59, 63-65, 69-71, 76-78, 82-84, 87-90, 93-96, 100-103, 106-108, 107-110, 112-114, 118-120` |
| +X% To Attack Rating | L1–20: `30, 39, 48, 57, 66, 75, 84, 93, 102, 111, 120, 129, 138, 147, 156, 165, 174, 183, 192, 201` |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **immolationarrow** (Missiles ID 85): `pSrvDoFunc`=`1`; `pSrvHitFunc`=`9`; `Param1`=`3`; `Vel`=`24`; `MaxVel`=`24`; `Range`=`40`; `CollideType`=`3`; `CollideKill`=`1`; `LastCollide`=`1`; `Size`=`1`; `GetHit`=`1`; `Skill`=`Immolation Arrow`; `ResultFlags`=`5`; `HitFlags`=`2`; `EType`=`fire`; `HitSubMissile1`=`immolationfire`.


Component **immolationfire** (Missiles ID 230): `pSrvDoFunc`=`5`; `pSrvDmgFunc`=`3`; `dParam1`=`19`; `Range`=`100`; `CollideType`=`3`; `Size`=`1`; `HitShift`=`2`; `EType`=`fire`; `EDmgSymPerCalc`=`skill('Fire Arrow'.blvl) * 5`; `DamageRate`=`41`.


| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / fire (raw) | 7–9 | 5–5 | 5–5 | 5–5 | 5–5 | 5–5 |
| E / fire (HP equivalent / see channel role; ×0.015625) | 0.109375–0.140625 | 0.078125–0.078125 | 0.078125–0.078125 | 0.078125–0.078125 | 0.078125–0.078125 | 0.078125–0.078125 |
| E / fire unsynergized L20 | 1.59375–1.625 | — | — | — | — | — |


Component **firewall** (Missiles ID 69): `pSrvDoFunc`=`5`; `pSrvDmgFunc`=`3`; `sHitPar1`=`19`; `dParam1`=`19`; `Range`=`90`; `CollideType`=`3`; `Size`=`1`; `Skill`=`Fire Wall`; `DamageRate`=`41`.


Component **firesmall** (Missiles ID 104): `pSrvDoFunc`=`1`; `Range`=`90`; `LevRange`=`25`; `CollideType`=`3`; `Size`=`1`; `EType`=`fire`.


| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / fire (raw) | 1–1 | 1–1 | 1–1 | 1–1 | 1–1 | 1–1 |
| E / fire (HP equivalent / see channel role; ×0.00390625) | 0.00390625–0.00390625 | 0.00390625–0.00390625 | 0.00390625–0.00390625 | 0.00390625–0.00390625 | 0.00390625–0.00390625 | 0.00390625–0.00390625 |
| E / fire unsynergized L20 | 0.078125–0.078125 | — | — | — | — | — |


Component **firemedium** (Missiles ID 105): `pSrvDoFunc`=`1`; `Range`=`90`; `LevRange`=`25`; `CollideType`=`3`; `Size`=`1`; `EType`=`fire`.


| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / fire (raw) | 2–2 | 2–2 | 2–2 | 2–2 | 2–2 | 2–2 |
| E / fire (HP equivalent / see channel role; ×0.00390625) | 0.0078125–0.0078125 | 0.0078125–0.0078125 | 0.0078125–0.0078125 | 0.0078125–0.0078125 | 0.0078125–0.0078125 | 0.0078125–0.0078125 |
| E / fire unsynergized L20 | 0.15625–0.15625 | — | — | — | — | — |




#### Freezing Arrow — ID 31


| Property | Value |
| --- | --- |
| Tree | Bow and Crossbow Skills |
| Required character level | 30 |
| Immediate prerequisites | Ice Arrow |
| All upstream prerequisites | Cold Arrow, Ice Arrow |
| Type | active |
| Internal data name | `Freezing Arrow` |
| Mana | `max(1, (18 + 1×(L−1))×0.5)` |
| Animation / source-damage field | `A1; SrcDam=128 /128` |
| itypea1 | `miss` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / cold (raw) | 40–50 | 10–10 | 15–15 | 20–20 | 22–22 | 24–24 |
| E / cold (HP equivalent / see channel role; ×1) | 40–50 | 10–10 | 15–15 | 20–20 | 22–22 | 24–24 |
| E / cold unsynergized L20 | 310–320 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 5 | Radius of impact |
| par7 | 5 | length synergy |
| par8 | 12 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| calc1 — damage radius | `par1` |
| EDmgSymPerCalc | `(skill('Cold Arrow'.blvl))*par8` |
| ELenSymPerCalc | `(skill('Ice Arrow'.blvl)) * par7` |
| ToHit (+% AR for usual attacks) | `40 + 9×(L−1)` |
| E length: frames, L1; increments L2–8 / L9–16 / L17+ | `50; 0 / 0 / 0` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Freezes for | `edln` | — |
| Attack: / percent | `toht` | — |
| Radius: | `par1` | — |
| Cold Arrow / Cold Damage per Level | `par8` | — |
| Ice Arrow / Freeze Length per Level | `par7` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Freezing Arrow Receives Bonuses From
- Cold Arrow: +12% Cold Damage Per Level
- Ice Arrow: +5% Freeze Length Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Mana Cost | L1–20: `9, 9.5, 10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14, 14.5, 15, 15.5, 16, 16.5, 17, 17.5, 18, 18.5` |
| Cold Damage | L1–20: `40-50, 50-60, 60-70, 70-80, 80-90, 90-100, 100-110, 110-120, 125-135, 140-150, 155-165, 170-180, 185-195, 200-210, 215-225, 230-240, 250-260, 270-280, 290-300, 310-320` |
| +X% To Attack Rating | L1–20: `40, 49, 58, 67, 76, 85, 94, 103, 112, 121, 130, 139, 148, 157, 166, 175, 184, 193, 202, 211` |
| Constant / source label | Duration: 2 seconds |
| Constant / source label | Radius: 3.3 Yards |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **freezingarrow** (Missiles ID 87): `pSrvDoFunc`=`1`; `pSrvHitFunc`=`4`; `Vel`=`24`; `MaxVel`=`24`; `Range`=`40`; `CollideType`=`3`; `CollideKill`=`1`; `LastCollide`=`1`; `Size`=`1`; `GetHit`=`1`; `ResultFlags`=`4`; `HitFlags`=`5`; `HitShift`=`8`; `SrcDamage`=`128`; `HitSubMissile1`=`freezingarrowexp3`.


Component **freezingarrowexp3** (Missiles ID 657): `pSrvDoFunc`=`1`; `pSrvHitFunc`=`1`; `sHitPar1`=`5`; `Range`=`1`; `CollideType`=`3`; `CollideKill`=`1`; `Size`=`1`; `GetHit`=`1`; `MissileSkill`=`1`; `Skill`=`Freezing Arrow`; `ResultFlags`=`5`; `HitFlags`=`2`; `HitShift`=`8`; `EType`=`frze`.


Component **freezingarrowexp1** (Missiles ID 88): `pSrvDoFunc`=`1`; `Range`=`16`; `CollideKill`=`1`; `LastCollide`=`1`; `Size`=`1`; `GetHit`=`1`; `ResultFlags`=`4`; `HitShift`=`8`.


Component **freezingarrowexp2** (Missiles ID 89): `pSrvDoFunc`=`1`; `Range`=`16`; `CollideKill`=`1`; `LastCollide`=`1`; `Size`=`1`; `GetHit`=`1`; `ResultFlags`=`4`; `HitShift`=`8`.




### Passive and Magic Skills

Source display tables: [Arreat Summit — Passive and Magic Skills](http://classic.battle.net/diablo2exp/skills/amazon-passive.shtml). Exact fields: pinned Skills.txt / SkillDesc.txt / Missiles.txt listed in §0.


| ID | Skill | Required clvl | Immediate prerequisites | Type | Mana expression |
| --- | --- | --- | --- | --- | --- |
| 8 | Inner Sight | 1 | None | active | `max(1, (10)×0.5)` |
| 9 | Critical Strike | 1 | None | passive | `0` |
| 13 | Dodge | 6 | None | passive | `0` |
| 17 | Slow Missiles | 12 | Inner Sight | active | `max(1, (10)×0.5)` |
| 18 | Avoid | 12 | Dodge | passive | `0` |
| 23 | Penetrate | 18 | Critical Strike | passive | `0` |
| 28 | Decoy | 24 | Slow Missiles | summon / active | `max(1, (76 − 3×(L−1))×0.25)` |
| 29 | Evade | 24 | Avoid | passive | `0` |
| 32 | Valkyrie | 30 | Decoy, Evade | summon / active | `max(1, (25 + 1×(L−1))×1)` |
| 33 | Pierce | 30 | Penetrate | passive | `0` |


#### Inner Sight — ID 8


| Property | Value |
| --- | --- |
| Tree | Passive and Magic Skills |
| Required character level | 1 |
| Immediate prerequisites | None |
| All upstream prerequisites | None |
| Type | active |
| Internal data name | `Inner Sight` |
| Mana | `max(1, (10)×0.5)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |
| aurafilter | `34179` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / data-channel (healing/stat; not necessarily damage) (raw) | 40–0 | 25–0 | 45–0 | 60–0 | 80–0 | 100–0 |
| E / data-channel (healing/stat; not necessarily damage) (HP equivalent / see channel role; ×1) | 40–0 | 25–0 | 45–0 | 60–0 | 80–0 | 100–0 |
| E / data-channel (healing/stat; not necessarily damage) unsynergized L20 | 815–0 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 40 | base monster ac |
| par2 | 25 | monster ac/lvl |
| par3 | 200 | duration |
| par4 | 100 | duration per level |
| par5 | 20 | radius of effect |
| par6 | 0 | radius per level |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurastat1: armorclass | `-edmn` |
| aurarangecalc | `ln56` |
| auralencalc | `ln34` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Radius: | `ln56` | — |
| Enemy Defense: | `-edmn` | — |
| Duration: | `ln34` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 5 |
| Radius (yards) | 1 source values: `13.3` |
| Duration (seconds) | L1–20: `8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 68, 72, 76, 80, 84` |
| Enemy Defense -X | L1–20: `40, 65, 90, 115, 140, 165, 190, 215, 260, 305, 350, 395, 440, 485, 530, 575, 635, 695, 755, 815` |


#### Critical Strike — ID 9


| Property | Value |
| --- | --- |
| Tree | Passive and Magic Skills |
| Required character level | 1 |
| Immediate prerequisites | None |
| All upstream prerequisites | None |
| Type | passive |
| Internal data name | `Critical Strike` |
| Mana | `0` |
| Animation / source-damage field | `no active animation; SrcDam=0 /128` |
| itypea1 | `spea` |
| itypea2 | `miss` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 5 | min % to do double damage |
| par2 | 80 | max % to do double damage |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| passivestat1: passive_critical_strike | `dm12` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| percent chance | `dm12` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Chance to 2x Damage % | L1–20: `16, 25, 32, 38, 42, 46, 49, 51, 54, 56, 58, 59, 61, 62, 63, 65, 65, 66, 67, 68` |


#### Dodge — ID 13


| Property | Value |
| --- | --- |
| Tree | Passive and Magic Skills |
| Required character level | 6 |
| Immediate prerequisites | None |
| All upstream prerequisites | None |
| Type | passive |
| Internal data name | `Dodge` |
| Mana | `0` |
| Animation / source-damage field | `S1; SrcDam=0 /128` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 10 | min % dodge |
| par2 | 65 | max % dodge |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| passivestat1: passive_dodge | `dm12` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| percent chance | `dm12` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Chance to Dodge Melee % | L1–20: `18, 24, 29, 34, 37, 40, 42, 44, 46, 47, 49, 50, 51, 52, 52, 54, 54, 55, 55, 56` |


#### Slow Missiles — ID 17


| Property | Value |
| --- | --- |
| Tree | Passive and Magic Skills |
| Required character level | 12 |
| Immediate prerequisites | Inner Sight |
| All upstream prerequisites | Inner Sight |
| Type | active |
| Internal data name | `Slow Missiles` |
| Mana | `max(1, (10)×0.5)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |
| aurafilter | `50563` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 33 | % velocity for missiles |
| par2 | 0 | % velocity per level |
| par3 | 300 | duration |
| par4 | 150 | duration per level |
| par5 | 20 | radius of effect |
| par6 | 0 | radius per level |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurastat1: skill_handofathena | `ln12` |
| aurarangecalc | `ln56` |
| auralencalc | `ln34` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Radius: | `ln56` | — |
| Ranged attacks slowed to / percent | `ln12` | — |
| Duration: | `ln34` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 5 |
| Duration (seconds) | L1–20: `12, 18, 24, 30, 36, 42, 48, 54, 60, 66, 72, 78, 84, 90, 96, 102, 108, 114, 120, 126` |
| Constant / source label | Radius (yards): 13.3 |
| Constant / source label | Enemy Ranged Attacks Slowed 33% |


#### Avoid — ID 18


| Property | Value |
| --- | --- |
| Tree | Passive and Magic Skills |
| Required character level | 12 |
| Immediate prerequisites | Dodge |
| All upstream prerequisites | Dodge |
| Type | passive |
| Internal data name | `Avoid` |
| Mana | `0` |
| Animation / source-damage field | `S1; SrcDam=0 /128` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 15 | min % avoid |
| par2 | 75 | max % avoid |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| passivestat1: passive_avoid | `dm12` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| percent chance | `dm12` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Chance to Dodge Missile % | L1–20: `24, 31, 36, 41, 45, 48, 50, 52, 54, 55, 57, 58, 60, 61, 61, 63, 63, 64, 64, 65` |


#### Penetrate — ID 23


| Property | Value |
| --- | --- |
| Tree | Passive and Magic Skills |
| Required character level | 18 |
| Immediate prerequisites | Critical Strike |
| All upstream prerequisites | Critical Strike |
| Type | passive |
| Internal data name | `Penetrate` |
| Mana | `0` |
| Animation / source-damage field | `no active animation; SrcDam=0 /128` |
| itypea1 | `spea` |
| itypea2 | `miss` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 35 | add % to hit with missiles base |
| par2 | 10 | add % to hit with missiles/level |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| passivestat1: item_tohit_percent | `ln12` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| To Attack Rating: / percent | `ln12` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| % Bonus to Attack Rating | L1–20: `35, 45, 55, 65, 75, 85, 95, 105, 115, 125, 135, 145, 155, 165, 175, 185, 195, 205, 215, 225` |


#### Decoy — ID 28


| Property | Value |
| --- | --- |
| Tree | Passive and Magic Skills |
| Required character level | 24 |
| Immediate prerequisites | Slow Missiles |
| All upstream prerequisites | Inner Sight, Slow Missiles |
| Type | summon / active |
| Internal data name | `Dopplezon` |
| Mana | `max(1, (76 − 3×(L−1))×0.25)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |
| pettype | `dopplezon` |
| summon | `dopplezon` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 250 | duration of decoy |
| par2 | 125 | duration per level |
| par3 | 50 | percent hitpoints of caster |
| par4 | 10 | hp % bonus per level |
| par7 | 4 | resistances |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurastat1: fireresist | `min(lvl*par7,85)` |
| aurastat2: lightresist | `min(lvl*par7,85)` |
| aurastat3: coldresist | `min(lvl*par7,85)` |
| aurastat4: poisonresist | `min(lvl*par7,85)` |
| petmax | `1` |
| calc1 — bonus hp% | `lvl*par4` |
| calc2 — duration | `ln12` |
| calc3 — %hp of caster | `par3` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Duration: | `ln12` | — |
| Life: / percent | `lvl*par4` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Mana Cost | L1–20: `19, 18, 17, 16, 16, 15, 14, 13, 13, 12, 11.5, 10.7, 10, 9.2, 8.5, 7.7, 7, 6.2, 5.5, 4.7` |
| Duration | L1–20: `10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105` |
| Life +% | L1–20: `10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200` |


**Summon base monster record** — seed values, NOT the final buffed summon. Apply this skill's HP/damage/AR calculations, mastery, summon level, difficulty and generated equipment; absent difficulty HP fields can be supplied by hardcoded handling.

| MonStats field | Value |
| --- | --- |
| Id | `dopplezon` |
| AI | `Idle` |
| Velocity | `9` |
| Run | `9` |
| aidel | `15` |
| aidel(N) | `15` |
| aidel(H) | `15` |
| noRatio | `1` |
| minHP | `10` |
| maxHP | `10` |
| AC | `141` |
| AC(N) | `152` |
| AC(H) | `164` |


#### Evade — ID 29


| Property | Value |
| --- | --- |
| Tree | Passive and Magic Skills |
| Required character level | 24 |
| Immediate prerequisites | Avoid |
| All upstream prerequisites | Dodge, Avoid |
| Type | passive |
| Internal data name | `Evade` |
| Mana | `0` |
| Animation / source-damage field | `S1; SrcDam=0 /128` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 10 | min % evade |
| par2 | 65 | max % evade |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| passivestat1: passive_evade | `dm12` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| percent chance | `dm12` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Chance to Dodge Any Attack% | L1–20: `18, 24, 29, 34, 37, 40, 42, 44, 46, 47, 49, 50, 51, 52, 52, 54, 54, 55, 55, 56` |


#### Valkyrie — ID 32


| Property | Value |
| --- | --- |
| Tree | Passive and Magic Skills |
| Required character level | 30 |
| Immediate prerequisites | Decoy, Evade |
| All upstream prerequisites | Inner Sight, Slow Missiles, Decoy, Dodge, Avoid, Evade |
| Type | summon / active |
| Internal data name | `Valkyrie` |
| Mana | `max(1, (25 + 1×(L−1))×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |
| Shared casting delay | 150 frames = 6 seconds |
| pettype | `valkyrie` |
| summon | `valkyrie` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 20 | % hitpoints more per level |
| par2 | 25 | str per level |
| par3 | 10 | % AC increase per level |
| par4 | 12 | dex per level |
| par5 | 25 | Magic Item level |
| par6 | 3 | Magic Item level per level |
| par7 | 2 | resistances |
| par8 | 20 | hp synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurastat1: strength | `lvl * par2` |
| aurastat2: dexterity | `lvl * par4` |
| aurastat3: fireresist | `min((lvl+skill('Dopplezon'.blvl))*par7,85)` |
| aurastat4: lightresist | `min((lvl+skill('Dopplezon'.blvl))*par7,85)` |
| aurastat5: coldresist | `min((lvl+skill('Dopplezon'.blvl))*par7,85)` |
| aurastat6: poisonresist | `min((lvl+skill('Dopplezon'.blvl))*par7,85)` |
| passivestat1: item_armor_percent | `par3 * (lvl - 1)` |
| passivestat2: tohit | `toht` |
| sumskill1: dodge | `skill('Dodge'.blvl)` |
| sumskill2: avoid | `skill('Avoid'.blvl)` |
| sumskill3: Evade | `skill('Evade'.blvl)` |
| sumskill4: Critical Strike | `skill('Critical Strike'.blvl)` |
| petmax | `1` |
| calc1 — bonus hp% | `par1 * (lvl - 1) + skill('Dopplezon'.blvl) * par8` |
| calc2 — itemlevel | `ln56` |
| ToHitCalc | `40*lvl+40*skill('Penetrate'.blvl)` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Defense Bonus: / percent | `(lvl-1)*par3` | — |
| Attack: | `toht` | — |
| Damage: / percent | `par2*(lvl-1)` | — |
| descline5 (formatter 13) | `par1 * (lvl - 1) + skill('Dopplezon'.blvl) * par8` | — |
| Decoy / Life per Level | `par8` | — |
| Penetrate / Attack Rating per Level | `40` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Valkyrie Receives Bonuses From
- Decoy: +20% Life Per Level
- Penetrate: +40 Attack Rating Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Mana Cost | L1–20: `25, 26, 27, 28, 29, 30, 31, 32, 32, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44` |
| Hit Points | L1–20: `528, 616, 704, 792, 880, 968, 1056, 1144, 1232, 1320, 1408, 1496, 1584, 1672, 1760, 1848, 1936, 2024, 2112, 2200` |
| % Damage | L1–20: `0, 25, 50, 75, 100, 125, 150, 175, 200, 225, 250, 275, 300, 325, 350, 375, 400, 425, 450, 475` |
| % Attack | L1–20: `40, 80, 120, 160, 200, 240, 280, 320, 360, 400, 440, 480, 520, 560, 600, 640, 680, 720, 760, 800` |
| % Defense Bonus | L1–20: `0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190` |


**Summon base monster record** — seed values, NOT the final buffed summon. Apply this skill's HP/damage/AR calculations, mastery, summon level, difficulty and generated equipment; absent difficulty HP fields can be supplied by hardcoded handling.

| MonStats field | Value |
| --- | --- |
| Id | `valkyrie` |
| AI | `NecroPet` |
| Velocity | `11` |
| Run | `11` |
| aidel | `6` |
| aidel(N) | `6` |
| aidel(H) | `6` |
| aip1 | `85` |
| aip1(N) | `85` |
| aip1(H) | `85` |
| noRatio | `1` |
| minHP | `400` |
| maxHP | `480` |
| AC | `141` |
| A1MinD | `9` |
| A1MaxD | `24` |
| A1TH | `250` |
| A2MinD | `18` |
| A2MaxD | `37` |
| A2TH | `250` |
| AC(N) | `152` |
| A1MinD(N) | `13` |
| A1MaxD(N) | `35` |
| A1TH(N) | `300` |
| A2MinD(N) | `26` |
| A2MaxD(N) | `53` |
| A2TH(N) | `300` |
| AC(H) | `164` |
| A1MinD(H) | `16` |
| A1MaxD(H) | `41` |
| A1TH(H) | `350` |
| A2MinD(H) | `31` |
| A2MaxD(H) | `62` |
| A2TH(H) | `350` |


#### Pierce — ID 33


| Property | Value |
| --- | --- |
| Tree | Passive and Magic Skills |
| Required character level | 30 |
| Immediate prerequisites | Penetrate |
| All upstream prerequisites | Critical Strike, Penetrate |
| Type | passive |
| Internal data name | `Pierce` |
| Mana | `0` |
| Animation / source-damage field | `no active animation; SrcDam=0 /128` |
| itypea1 | `miss` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 10 | min % chance |
| par2 | 100 | max % chance |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| passivestat1: skill_pierce | `dm12` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| percent chance | `dm12` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Chance Missiles Pass through Target % | L1–20: `23, 34, 42, 49, 55, 59, 63, 65, 69, 71, 73, 75, 77, 79, 80, 82, 82, 83, 84, 85` |


### Javelin and Spear Skills

Source display tables: [Arreat Summit — Javelin and Spear Skills](http://classic.battle.net/diablo2exp/skills/amazon-javelin.shtml). Exact fields: pinned Skills.txt / SkillDesc.txt / Missiles.txt listed in §0.


| ID | Skill | Required clvl | Immediate prerequisites | Type | Mana expression |
| --- | --- | --- | --- | --- | --- |
| 10 | Jab | 1 | None | active | `max(1, (8 + 1×(L−1))×0.25)` |
| 14 | Power Strike | 6 | Jab | active | `max(1, (8 + 1×(L−1))×0.25)` |
| 15 | Poison Javelin | 6 | None | active | `max(1, (16 + 1×(L−1))×0.25)` |
| 19 | Impale | 12 | Jab | active | `max(1, (3)×1)` |
| 20 | Lightning Bolt | 12 | Poison Javelin | active | `max(1, (24 + 1×(L−1))×0.25)` |
| 24 | Charged Strike | 18 | Power Strike, Lightning Bolt | active | `max(1, (16 + 1×(L−1))×0.25)` |
| 25 | Plague Javelin | 18 | Lightning Bolt | active | `max(1, (14 + 1×(L−1))×0.5) per continuous debit; see startmana/server routine` |
| 30 | Fend | 24 | Impale | active | `max(1, (5)×1)` |
| 34 | Lightning Strike | 30 | Charged Strike | active | `max(1, (9)×1)` |
| 35 | Lightning Fury | 30 | Plague Javelin | active | `max(1, (20 + 1×(L−1))×0.5)` |


#### Jab — ID 10


| Property | Value |
| --- | --- |
| Tree | Javelin and Spear Skills |
| Required character level | 1 |
| Immediate prerequisites | None |
| All upstream prerequisites | None |
| Type | active |
| Internal data name | `Jab` |
| Mana | `max(1, (8 + 1×(L−1))×0.25)` |
| Animation / source-damage field | `SQ; SrcDam=128 /128` |
| itypea1 | `spea` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par3 | -15 | Percent damage base |
| par4 | 3 | Percent damage per level |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| calc1 — dmg% | `ln34` |
| ToHit (+% AR for usual attacks) | `10 + 9×(L−1)` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Damage: / percent | `ln34` | — |
| Attack: / percent | `toht` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Mana Cost | L1–20: `2, 2.2, 2.5, 2.7, 3, 3.2, 3.5, 3.7, 4, 4.2, 4.5, 4.7, 5, 5.2, 5.5, 5.7, 6, 6.2, 6.5, 6.7` |
| Attack +% | L1–20: `10, 19, 28, 37, 46, 55, 64, 73, 82, 91, 100, 109, 118, 127, 136, 145, 154, 163, 172, 181` |
| Damage +% | L1–20: `-15, -12, -9, -6, -3, 0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36, 39, 42` |


#### Power Strike — ID 14


| Property | Value |
| --- | --- |
| Tree | Javelin and Spear Skills |
| Required character level | 6 |
| Immediate prerequisites | Jab |
| All upstream prerequisites | Jab |
| Type | active |
| Internal data name | `Power Strike` |
| Mana | `max(1, (8 + 1×(L−1))×0.25)` |
| Animation / source-damage field | `A1; SrcDam=128 /128` |
| itypea1 | `spea` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / ltng (raw) | 1–16 | 0–18 | 0–36 | 0–54 | 0–72 | 0–90 |
| E / ltng (HP equivalent / see channel role; ×1) | 1–16 | 0–18 | 0–36 | 0–54 | 0–72 | 0–90 |
| E / ltng unsynergized L20 | 1–646 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par8 | 10 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| EDmgSymPerCalc | `(skill('Lightning Strike'.blvl)+skill('Lightning Bolt'.blvl)+skill('Charged Strike'.blvl)+skill('Lightning Fury'.blvl)) * par8` |
| ToHit (+% AR for usual attacks) | `20 + 12×(L−1)` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Lightning Bolt / Lightning Damage per Level | `par8` | — |
| Charged Strike / Lightning Damage per Level | `par8` | — |
| Lightning Strike / Lightning Damage per Level | `par8` | — |
| Lightning Fury / Lightning Damage per Level | `par8` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Power Strike Receives Bonuses From:
- Lightning Bolt: +10% Lightning Damage Per Level
- Charged Strike: +10% Lightning Damage Per Level
- Lightning Strike: +10% Lightning Damage Per Level
- Lightning Fury: +10% Lightning Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Mana Cost | L1–20: `2, 2.2, 2.5, 2.7, 3, 3.2, 3.5, 3.7, 4, 4.2, 4.5, 4.7, 5, 5.2, 5.5, 5.7, 6, 6.2, 6.5, 6.7` |
| Attack +% | L1–20: `20, 32, 44, 56, 68, 80, 92, 104, 116, 128, 140, 152, 164, 176, 188, 200, 212, 224, 236, 248` |
| Lightning Damage | L1–20: `1-16, 1-34, 1-52, 1-70, 1-88, 1-106, 1-124, 1-142, 1-178, 1-214, 1-250, 1-286, 1-322, 1-358, 1-394, 1-430, 1-484, 1-538, 1-592, 1-646` |


#### Poison Javelin — ID 15


| Property | Value |
| --- | --- |
| Tree | Javelin and Spear Skills |
| Required character level | 6 |
| Immediate prerequisites | None |
| All upstream prerequisites | None |
| Type | active |
| Internal data name | `Poison Javelin` |
| Mana | `max(1, (16 + 1×(L−1))×0.25)` |
| Animation / source-damage field | `TH; SrcDam=128 /128` |
| Shared casting delay | 15 frames = 0.6 seconds |
| itypea1 | `jave` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / pois (raw) | 32–48 | 16–16 | 32–36 | 48–52 | 64–68 | 96–84 |
| E / pois (rate HP/frame; ×0.00390625) | 0.125–0.1875 | 0.0625–0.0625 | 0.125–0.140625 | 0.1875–0.203125 | 0.25–0.265625 | 0.375–0.328125 |
| E / pois unsynergized L20 | 2.3125–2.5625 | — | — | — | — | — |
| Poison total HP, L1 / L20 (no item/synergy) | 25–37.5 / 2659.375–2946.875 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par8 | 12 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| EDmgSymPerCalc | `(skill('Plague Javelin'.blvl)) * par8` |
| E length: frames, L1; increments L2–8 / L9–16 / L17+ | `200; 50 / 50 / 50` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Plague Javelin / Poison Damage per Level | `par8` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Poison Javelin Receives Bonuses From:
- Plague Javelin: +12% Poison Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Mana Cost | L1–20: `4, 4.2, 4.5, 4.7, 5, 5.2, 5.5, 5.7, 6, 6.2, 6.5, 6.7, 7, 7.2, 7.5, 7.7, 8, 8.2, 8.5, 8.7` |
| Poison Damage | L1–20: `25-37, 46-62, 75-93, 109-131, 150-175, 196-225, 250-281, 309-343, 412-459, 528-589, 656-732, 796-890, 950-1062, 1115-1248, 1293-1448, 1484-1662, 1750-1953, 2034-2264, 2337-2595, 2659-2946` |
| Duration (Over X seconds) | L1–20: `8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46` |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **poisonjav** (Missiles ID 38): `pSrvDoFunc`=`2`; `Vel`=`24`; `MaxVel`=`24`; `Range`=`25`; `CollideType`=`3`; `CollideKill`=`1`; `LastCollide`=`1`; `Size`=`1`; `GetHit`=`1`; `Skill`=`Poison Javelin`; `ResultFlags`=`4`; `SubMissile1`=`poisonjavcloud`.


Component **poisonjavcloud** (Missiles ID 39): `pSrvDoFunc`=`3`; `Param1`=`2`; `Param2`=`4`; `Range`=`60`; `CollideType`=`3`; `LastCollide`=`1`; `Size`=`2`; `Skill`=`Poison Javelin`; `SrcDamage`=`-1`.


Component **poisonpuff** (Missiles ID 141): `pSrvDoFunc`=`1`; `Vel`=`1`; `MaxVel`=`15`; `Range`=`25`; `LastCollide`=`1`; `Size`=`1`; `GetHit`=`1`; `ResultFlags`=`4`; `HitShift`=`8`.




#### Impale — ID 19


| Property | Value |
| --- | --- |
| Tree | Javelin and Spear Skills |
| Required character level | 12 |
| Immediate prerequisites | Jab |
| All upstream prerequisites | Jab |
| Type | active |
| Internal data name | `Impale` |
| Mana | `max(1, (3)×1)` |
| Animation / source-damage field | `SQ; SrcDam=128 /128` |
| itypea1 | `spea` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 300 | Percent damage |
| par2 | 25 | % damage per level |
| par3 | 0 | % chance durability loss delta min |
| par4 | 30 | % chance durability loss delta max |
| par5 | 1 | durability loss |
| par6 | 50 | % max chance durability loss |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| calc1 — dm% | `ln12` |
| calc2 — dur loss chance | `par6-dm34` |
| calc3 — dur loss | `par5` |
| ToHit (+% AR for usual attacks) | `100 + 25×(L−1)` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Chance of losing durability: / percent | `par6-dm34` | — |
| Attack: / percent | `toht` | — |
| Damage: / percent | `ln12` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 3 |
| Attack Mod % | L1–20: `100, 125, 150, 175, 200, 225, 250, 275, 300, 325, 350, 375, 400, 425, 450, 475, 500, 525, 550, 575` |
| Weapon Durability % | L1–20: `46, 42, 40, 37, 35, 34, 33, 32, 31, 30, 29, 29, 28, 27, 27, 26, 26, 26, 26, 25` |
| Damage +% | L1–20: `300, 325, 350, 375, 400, 425, 450, 475, 500, 525, 550, 575, 600, 625, 650, 675, 700, 725, 750, 775` |


#### Lightning Bolt — ID 20


| Property | Value |
| --- | --- |
| Tree | Javelin and Spear Skills |
| Required character level | 12 |
| Immediate prerequisites | Poison Javelin |
| All upstream prerequisites | Poison Javelin |
| Type | active |
| Internal data name | `Lightning Bolt` |
| Mana | `max(1, (24 + 1×(L−1))×0.25)` |
| Animation / source-damage field | `TH; SrcDam=96 /128` |
| itypea1 | `jave` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / ltng (raw) | 1–40 | 0–12 | 0–18 | 0–28 | 0–48 | 0–88 |
| E / ltng (HP equivalent / see channel role; ×1) | 1–40 | 0–12 | 0–18 | 0–28 | 0–48 | 0–88 |
| E / ltng unsynergized L20 | 1–380 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par8 | 3 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| EDmgSymPerCalc | `(skill('Lightning Strike'.blvl)+skill('Power Strike'.blvl)+skill('Charged Strike'.blvl)+skill('Lightning Fury'.blvl)) * par8` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Converts %d%% Physical Damage to Elemental Damage | `100` | — |
| Weapon Damage | `3` | `4` |
| Power Strike / Lightning Damage per Level | `par8` | — |
| Charged Strike / Lightning Damage per Level | `par8` | — |
| Lightning Strike / Lightning Damage per Level | `par8` | — |
| Lightning Fury / Lightning Damage per Level | `par8` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Lightning Bolt Receives Bonuses From
- Power Strike: +3% Lightning Damage Per Level
- Charged Strike: +3% Lightning Damage Per Level
- Lightning Strike: +3% Lightning Damage Per Level
- Lightning Fury: +3% Lightning Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Mana Cost | L1–20: `6, 6.2, 6.5, 6.7, 7, 7.2, 7.5, 7.7, 8, 8.2, 8.5, 8.7, 9, 9.2, 9.5, 9.7, 10, 10.2, 10.5, 10.7` |
| Lightning Damage | L1–20: `1-40, 1-52, 1-64, 1-76, 1-88, 1-100, 1-112, 1-124, 1-142, 1-160, 1-178, 1-196, 1-214, 1-232, 1-250, 1-268, 1-296, 1-324, 1-352, 1-380` |
| Constant / source label | Converts 100% Physical Damage To Elemental Damage |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **lightningjavelin** (Missiles ID 205): `pSrvDoFunc`=`1`; `pSrvDmgFunc`=`12`; `DmgCalc1`=`dl12`; `dParam1`=`100`; `Vel`=`30`; `MaxVel`=`30`; `Range`=`25`; `CollideType`=`3`; `CollideKill`=`1`; `LastCollide`=`1`; `Size`=`2`; `GetHit`=`1`; `Skill`=`Lightning Bolt`; `ResultFlags`=`4`; `EType`=`ltng`.




#### Charged Strike — ID 24


| Property | Value |
| --- | --- |
| Tree | Javelin and Spear Skills |
| Required character level | 18 |
| Immediate prerequisites | Power Strike, Lightning Bolt |
| All upstream prerequisites | Jab, Power Strike, Poison Javelin, Lightning Bolt |
| Type | active |
| Internal data name | `Charged Strike` |
| Mana | `max(1, (16 + 1×(L−1))×0.25)` |
| Animation / source-damage field | `A1; SrcDam=0 /128` |
| itypea1 | `spea` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / ltng (raw) | 1–30 | 0–12 | 0–16 | 0–20 | 0–24 | 0–28 |
| E / ltng (HP equivalent / see channel role; ×1) | 1–30 | 0–12 | 0–16 | 0–20 | 0–24 | 0–28 |
| E / ltng unsynergized L20 | 1–322 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 3 | Bolts to send out |
| par2 | 5 | Additional bolts per N levels |
| par8 | 10 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| calc1 — # bolts | `par1+lvl/par2` |
| EDmgSymPerCalc | `(skill('Lightning Strike'.blvl)+skill('Lightning Bolt'.blvl)+skill('Power Strike'.blvl)+skill('Lightning Fury'.blvl)) * par8` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Releases / charged bolts | `par1 + lvl/par2` | — |
| Power Strike / Lightning Damage per Level | `par8` | — |
| Lightning Bolt / Lightning Damage per Level | `par8` | — |
| Lightning Strike / Lightning Damage per Level | `par8` | — |
| Lightning Fury / Lightning Damage per Level | `par8` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Charged Strike Receives Bonuses From
- Power Strike: +10% Lightning Damage Per Level
- Lightning Bolt: +10% Lightning Damage Per Level
- Lightning Strike: +10% Lightning Damage Per Level
- Lightning Fury: +10% Lightning Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Mana Cost | L1–20: `4, 4.2, 4.5, 4.7, 5, 5.2, 5.5, 5.7, 6, 6.2, 6.5, 6.7, 7, 7.2, 7.5, 7.7, 8, 8.2, 8.5, 8.7` |
| Damage | L1–20: `1-30, 1-42, 1-54, 1-66, 1-78, 1-90, 1-102, 1-114, 1-130, 1-146, 1-162, 1-178, 1-194, 1-210, 1-226, 1-242, 1-262, 1-282, 1-302, 1-322` |
| # of Bolts Released | L1–20: `3, 3, 3, 3, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 7` |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **chargedstrikebolt** (Missiles ID 215): `pSrvDoFunc`=`1`; `Vel`=`12`; `MaxVel`=`12`; `Range`=`98`; `CollideType`=`3`; `CollideKill`=`1`; `LastCollide`=`1`; `Size`=`1`; `GetHit`=`1`; `Skill`=`Charged Strike`; `ResultFlags`=`4`; `HitShift`=`8`.




#### Plague Javelin — ID 25


| Property | Value |
| --- | --- |
| Tree | Javelin and Spear Skills |
| Required character level | 18 |
| Immediate prerequisites | Lightning Bolt |
| All upstream prerequisites | Poison Javelin, Lightning Bolt |
| Type | active |
| Internal data name | `Plague Javelin` |
| Mana | `max(1, (14 + 1×(L−1))×0.5) per continuous debit; see startmana/server routine` |
| Animation / source-damage field | `TH; SrcDam=128 /128` |
| Shared casting delay | 100 frames = 4 seconds |
| usemanaondo | `1` |
| itypea1 | `jave` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / pois (raw) | 10–16 | 6–6 | 12–12 | 20–20 | 40–40 | 60–60 |
| E / pois (rate HP/frame; ×0.03125) | 0.3125–0.5 | 0.1875–0.1875 | 0.375–0.375 | 0.625–0.625 | 1.25–1.25 | 1.875–1.875 |
| E / pois unsynergized L20 | 7.125–7.3125 | — | — | — | — | — |
| Poison total HP, L1 / L20 (no item/synergy) | 23.4375–37.5 / 1888.125–1937.8125 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par8 | 10 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| EDmgSymPerCalc | `(skill('Poison Javelin'.blvl))*par8` |
| ToHit (+% AR for usual attacks) | `30 + 9×(L−1)` |
| E length: frames, L1; increments L2–8 / L9–16 / L17+ | `75; 10 / 10 / 10` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Attack: / percent | `toht` | — |
| Poison Javelin / Poison Damage per Level | `par8` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Plague Javelin Receives Bonuses From
- Poison Javelin: +10% Poison Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Mana Cost | L1–20: `7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12, 13, 13, 13, 14, 14.5, 15, 15.5, 16, 16.5` |
| Damage | L1–20: `23-37, 42-58, 65-83, 91-111, 122-143, 156-179, 194-219, 235-262, 310-339, 391-422, 481-514, 578-612, 682-718, 794-833, 913-953, 1040-1082, 1233-1277, 1439-1485, 1657-1705, 1888-1937` |
| Duration (Over X seconds) | L1–20: `3, 3.4, 3.8, 4.2, 4.6, 5, 5.4, 5.8, 6.2, 6.6, 7, 7.4, 7.8, 8.2, 8.6, 9, 9.4, 9.8, 10.2, 10.6` |
| Attack +X% | L1–20: `30, 39, 48, 57, 66, 75, 84, 93, 102, 111, 120, 129, 138, 147, 156, 165, 174, 183, 192, 201` |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **plaguejavelin** (Missiles ID 43): `pSrvDoFunc`=`3`; `pSrvHitFunc`=`2`; `sHitPar1`=`1`; `sHitPar2`=`2`; `sHitPar3`=`3`; `Vel`=`24`; `MaxVel`=`24`; `Range`=`15`; `CollideType`=`3`; `CollideKill`=`1`; `LastCollide`=`1`; `Size`=`1`; `GetHit`=`1`; `Skill`=`Plague Javelin`; `ResultFlags`=`4`; `SubMissile1`=`plaguejavcloud`; `HitSubMissile1`=`plaguejavcloud`.


Component **plaguejavcloud** (Missiles ID 221): `pSrvDoFunc`=`3`; `Param1`=`2`; `Param2`=`4`; `Range`=`60`; `CollideType`=`3`; `LastCollide`=`1`; `Size`=`2`; `Skill`=`Plague Javelin`; `SrcDamage`=`-1`.


Component **poisonpuff** (Missiles ID 141): `pSrvDoFunc`=`1`; `Vel`=`1`; `MaxVel`=`15`; `Range`=`25`; `LastCollide`=`1`; `Size`=`1`; `GetHit`=`1`; `ResultFlags`=`4`; `HitShift`=`8`.




#### Fend — ID 30


| Property | Value |
| --- | --- |
| Tree | Javelin and Spear Skills |
| Required character level | 24 |
| Immediate prerequisites | Impale |
| All upstream prerequisites | Jab, Impale |
| Type | active |
| Internal data name | `Fend` |
| Mana | `max(1, (5)×1)` |
| Animation / source-damage field | `A1; SrcDam=128 /128` |
| itypea1 | `spea` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 1 | additional target/level |
| par2 | 60 | % frame rollback |
| par3 | 70 | % damage percent |
| par4 | 10 | damage % per level |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| calc1 — max targets | `12` |
| calc2 — damage % | `ln34` |
| ToHit (+% AR for usual attacks) | `40 + 10×(L−1)` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Damage: / percent | `ln34` | — |
| Attack Bonus: / percent | `toht` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 5 |
| Attack +% | L1–20: `40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 210, 220, 230` |
| Damage +% | L1–20: `70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 210, 220, 230, 240, 250, 260` |


#### Lightning Strike — ID 34


| Property | Value |
| --- | --- |
| Tree | Javelin and Spear Skills |
| Required character level | 30 |
| Immediate prerequisites | Charged Strike |
| All upstream prerequisites | Jab, Power Strike, Poison Javelin, Lightning Bolt, Charged Strike |
| Type | active |
| Internal data name | `Lightning Strike` |
| Mana | `max(1, (9)×1)` |
| Animation / source-damage field | `A1; SrcDam=0 /128` |
| itypea1 | `spea` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / ltng (raw) | 1–25 | 0–10 | 0–15 | 0–20 | 0–25 | 0–30 |
| E / ltng (HP equivalent / see channel role; ×1) | 1–25 | 0–10 | 0–15 | 0–20 | 0–25 | 0–30 |
| E / ltng unsynergized L20 | 1–295 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 20 | radius of jump to next target |
| par3 | 2 | Target hits |
| par4 | 1 | Target hits per level |
| par8 | 8 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurarangecalc | `par1` |
| calc1 — radius | `20` |
| calc2 — hits | `ln34` |
| EDmgSymPerCalc | `(skill('Charged Strike'.blvl)+skill('Lightning Bolt'.blvl)+skill('Power Strike'.blvl)+skill('Lightning Fury'.blvl)) * par8` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| hits | `ln34` | — |
| Power Strike / Lightning Damage per Level | `par8` | — |
| Lightning Bolt / Lightning Damage per Level | `par8` | — |
| Charged Strike / Lightning Damage per Level | `par8` | — |
| Lightning Fury / Lightning Damage per Level | `par8` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Lightning Strike Receives Bonuses From
- Power Strike: +8% Lightning Damage Per Level
- Lightning Bolt: +8% Lightning Damage Per Level
- Charged Strike: +8% Lightning Damage Per Level
- Lightning Fury: +8% Lightning Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 9 |
| Lightning Damage | L1–20: `1-25, 1-35, 1-45, 1-55, 1-65, 1-75, 1-85, 1-95, 1-110, 1-125, 1-140, 1-155, 1-170, 1-185, 1-200, 1-215, 1-235, 1-255, 1-275, 1-295` |
| Hits | L1–20: `2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21` |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **lightningstrike** (Missiles ID 232): `pSrvDoFunc`=`1`; `pSrvHitFunc`=`12`; `Vel`=`30`; `MaxVel`=`30`; `Range`=`25`; `CollideType`=`3`; `CollideKill`=`1`; `LastCollide`=`1`; `NextHit`=`1`; `NextDelay`=`4`; `Size`=`2`; `GetHit`=`1`; `Skill`=`Lightning Strike`; `ResultFlags`=`4`; `HitShift`=`8`; `EType`=`ltng`.


| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / ltng (raw) | 8–0 | 0–0 | 0–0 | 0–0 | 0–0 | 0–0 |
| E / ltng (HP equivalent / see channel role; ×1) | 8–0 | 0–0 | 0–0 | 0–0 | 0–0 | 0–0 |
| E / ltng unsynergized L20 | 8–0 | — | — | — | — | — |


Component **lightninghit** (Missiles ID 99): `pSrvDoFunc`=`1`; `Range`=`12`; `Size`=`1`; `HitShift`=`8`; `EType`=`ltng`.


| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / ltng (raw) | 2–5 | 2–2 | 2–2 | 2–2 | 2–2 | 2–2 |
| E / ltng (HP equivalent / see channel role; ×1) | 2–5 | 2–2 | 2–2 | 2–2 | 2–2 | 2–2 |
| E / ltng unsynergized L20 | 40–43 | — | — | — | — | — |




#### Lightning Fury — ID 35


| Property | Value |
| --- | --- |
| Tree | Javelin and Spear Skills |
| Required character level | 30 |
| Immediate prerequisites | Plague Javelin |
| All upstream prerequisites | Poison Javelin, Lightning Bolt, Plague Javelin |
| Type | active |
| Internal data name | `Lightning Fury` |
| Mana | `max(1, (20 + 1×(L−1))×0.5)` |
| Animation / source-damage field | `TH; SrcDam=128 /128` |
| aurafilter | `42371` |
| itypea1 | `jave` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / ltng (raw) | 1–40 | 0–20 | 0–30 | 0–40 | 0–50 | 0–50 |
| E / ltng (HP equivalent / see channel role; ×1) | 1–40 | 0–20 | 0–30 | 0–40 | 0–50 | 0–50 |
| E / ltng unsynergized L20 | 1–580 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 2 | lightning spells from target |
| par2 | 1 | extra spells/level |
| par3 | 15 | Target search radius |
| par8 | 1 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurarangecalc | `par3` |
| calc1 — num targets | `ln12` |
| EDmgSymPerCalc | `(skill('Charged Strike'.blvl)+skill('Lightning Bolt'.blvl)+skill('Power Strike'.blvl)+skill('Lightning Strike'.blvl)) * par8` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Releases / bolts | `ln12` | — |
| Power Strike / Lightning Damage per Level | `par8` | — |
| Lightning Bolt / Lightning Damage per Level | `par8` | — |
| Charged Strike / Lightning Damage per Level | `par8` | — |
| Lightning Strike / Lightning Damage per Level | `par8` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Lightning Fury Receives Bonuses From
- Power Strike: +1% Lightning Damage Per Level
- Lightning Bolt: +1% Lightning Damage Per Level
- Charged Strike: +1% Lightning Damage Per Level
- Lightning Strike: +1% Lightning Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Mana Cost | L1–20: `10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14, 14.5, 15, 15.5, 16, 16.5, 17, 17.5, 18, 18.5, 19, 19.5` |
| Lightning Damage | L1–20: `1-40, 1-60, 1-80, 1-100, 1-120, 1-140, 1-160, 1-180, 1-210, 1-240, 1-270, 1-300, 1-330, 1-360, 1-390, 1-420, 1-460, 1-500, 1-540, 1-580` |
| Number of Bolts | L1–20: `2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21` |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **lightningfury** (Missiles ID 206): `pSrvDoFunc`=`1`; `pSrvHitFunc`=`20`; `Vel`=`30`; `MaxVel`=`30`; `Range`=`25`; `CollideType`=`3`; `CollideKill`=`1`; `LastCollide`=`1`; `Size`=`2`; `GetHit`=`1`; `Skill`=`Lightning Fury`; `ResultFlags`=`4`; `HitSubMissile1`=`furylightning`.


Component **furylightning** (Missiles ID 231): `pSrvDoFunc`=`1`; `Vel`=`30`; `MaxVel`=`30`; `Range`=`25`; `CollideType`=`3`; `LastCollide`=`1`; `Size`=`2`; `GetHit`=`1`; `Skill`=`Lightning Fury`; `ResultFlags`=`4`; `SrcDamage`=`-1`.




## 4.2. Sorceress

### Fire Spells

Source display tables: [Arreat Summit — Fire Spells](http://classic.battle.net/diablo2exp/skills/sorceress-fire.shtml). Exact fields: pinned Skills.txt / SkillDesc.txt / Missiles.txt listed in §0.


| ID | Skill | Required clvl | Immediate prerequisites | Type | Mana expression |
| --- | --- | --- | --- | --- | --- |
| 36 | Fire Bolt | 1 | None | active | `max(1, (5)×0.5)` |
| 37 | Warmth | 1 | None | passive | `0` |
| 41 | Inferno | 6 | None | active | `(36 + 1×(L−1))×0.015625 per continuous debit; see startmana/server routine` |
| 46 | Blaze | 12 | Inferno | active | `max(1, (22 + 1×(L−1))×0.5)` |
| 47 | Fire Ball | 12 | Fire Bolt | active | `max(1, (10 + 1×(L−1))×0.5)` |
| 51 | Fire Wall | 18 | Blaze | active | `max(1, (22 + 1×(L−1))×1)` |
| 52 | Enchant | 18 | Warmth, Fire Ball | active | `max(1, (25 + 1×(L−1))×1)` |
| 56 | Meteor | 24 | Fire Ball, Fire Wall | active | `max(1, (34 + 1×(L−1))×0.5)` |
| 61 | Fire Mastery | 30 | None | passive | `0` |
| 62 | Hydra | 30 | Enchant | summon / active | `max(1, (40 + 1×(L−1))×0.5)` |


#### Fire Bolt — ID 36


| Property | Value |
| --- | --- |
| Tree | Fire Spells |
| Required character level | 1 |
| Immediate prerequisites | None |
| All upstream prerequisites | None |
| Type | active |
| Internal data name | `Fire Bolt` |
| Mana | `max(1, (5)×0.5)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / fire (raw) | 6–12 | 3–3 | 4–6 | 8–10 | 18–20 | 54–56 |
| E / fire (HP equivalent / see channel role; ×0.5) | 3–6 | 1.5–1.5 | 2–3 | 4–5 | 9–10 | 27–28 |
| E / fire unsynergized L20 | 45.5–60.5 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par8 | 16 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| EDmgSymPerCalc | `(skill('Fire Ball'.blvl)+skill('Meteor'.blvl))*par8` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Fire Ball / Fire Damage per Level | `par8` | — |
| Meteor / Fire Damage per Level | `par8` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Fire Bolt Receives Bonuses From
- Fire Ball: +16% Fire Damage Per Level
- Meteor: +16% Fire Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 2.5 |
| Damage | L1–20: `3-6, 4-7, 6-9, 7-10, 9-12, 10-13, 12-15, 13-16, 15-19, 17-22, 19-25, 21-28, 23-31, 25-34, 27-37, 29-40, 33-45, 37-50, 41-55, 45-60` |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **firebolt** (Missiles ID 58): `pSrvDoFunc`=`1`; `Vel`=`20`; `MaxVel`=`20`; `Range`=`50`; `CollideType`=`3`; `CollideKill`=`1`; `LastCollide`=`1`; `Size`=`1`; `GetHit`=`1`; `Skill`=`Fire Bolt`; `ResultFlags`=`4`.


Component **fireexplode** (Missiles ID 29): `Range`=`12`; `CollideKill`=`1`; `LastCollide`=`1`; `Size`=`1`; `GetHit`=`1`; `ResultFlags`=`4`; `HitShift`=`8`.




#### Warmth — ID 37


| Property | Value |
| --- | --- |
| Tree | Fire Spells |
| Required character level | 1 |
| Immediate prerequisites | None |
| All upstream prerequisites | None |
| Type | passive |
| Internal data name | `Warmth` |
| Mana | `0` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 30 | increase in mana recovery |
| par2 | 12 | additional increase/level |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| passivestat1: manarecoverybonus | `ln12` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| percent | `ln12` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| % | L1–20: `30, 42, 54, 66, 78, 90, 102, 114, 126, 138, 150, 162, 174, 186, 198, 210, 222, 234, 246, 258` |


#### Inferno — ID 41


| Property | Value |
| --- | --- |
| Tree | Fire Spells |
| Required character level | 6 |
| Immediate prerequisites | None |
| All upstream prerequisites | None |
| Type | active |
| Internal data name | `Inferno` |
| Mana | `(36 + 1×(L−1))×0.015625 per continuous debit; see startmana/server routine` |
| Animation / source-damage field | `SQ; SrcDam=0 /128` |
| startmana | `6` |
| repeat | `1` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / fire (raw) | 32–64 | 24–24 | 26–27 | 28–29 | 32–33 | 36–37 |
| E / fire (HP equivalent / see channel role; ×0.015625) | 0.5–1 | 0.375–0.375 | 0.40625–0.421875 | 0.4375–0.453125 | 0.5–0.515625 | 0.5625–0.578125 |
| E / fire unsynergized L20 | 8.125–8.8125 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 20 | base ranged (doubled) |
| par2 | 3 | level range (doubled) |
| par3 | 6 | Min Mana to start casting |
| par8 | 13 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurarangecalc | `ln12/4-2` |
| calc1 — range | `ln12/2` |
| calc2 — frames if monster | `20` |
| EDmgSymPerCalc | `(skill('Warmth'.blvl))*par8` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Mana Cost: / per second | `mps` | — |
| Range: | `ln12/4` | — |
| Minimum Mana Required to Cast: | `par3` | — |
| Warmth / Fire Damage per Level | `par8` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Inferno Receives Bonuses From
- Warmth: +13% Fire Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Mana Cost | L1–20: `7, 7, 7, 7, 7, 8, 8, 8, 8, 8, 8, 9, 9, 9, 9, 9, 10, 10, 10, 10` |
| Damage (per sec) | L1–20: `12-25, 21-34, 31-43, 40-53, 50-62, 59-71, 68-81, 78-90, 88-101, 98-111, 108-122, 118-132, 128-143, 139-153, 149-164, 159-175, 170-186, 181-197, 192-208, 203-220` |
| Range (yards) | L1–20: `3.3, 3.3, 4, 4.6, 5.3, 5.3, 6, 6.6, 7.3, 7.3, 8, 8.6, 9.3, 9.3, 10, 10.6, 11.3, 11.3, 12, 12.6` |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **infernoflame1** (Missiles ID 60): `pSrvDoFunc`=`1`; `Param1`=`8`; `Param2`=`7`; `Vel`=`12`; `MaxVel`=`12`; `Range`=`30`; `CollideType`=`3`; `LastCollide`=`1`; `Size`=`1`; `GetHit`=`1`; `Skill`=`Inferno`; `ResultFlags`=`4`; `DamageRate`=`82`.


Component **infernoflame2** (Missiles ID 61): `pSrvDoFunc`=`1`; `Param1`=`8`; `Param2`=`7`; `Vel`=`12`; `MaxVel`=`12`; `Range`=`30`; `CollideType`=`3`; `LastCollide`=`1`; `Size`=`1`; `GetHit`=`1`; `Skill`=`Inferno`; `ResultFlags`=`4`; `DamageRate`=`82`.




#### Blaze — ID 46


| Property | Value |
| --- | --- |
| Tree | Fire Spells |
| Required character level | 12 |
| Immediate prerequisites | Inferno |
| All upstream prerequisites | Inferno |
| Type | active |
| Internal data name | `Blaze` |
| Mana | `max(1, (22 + 1×(L−1))×0.5)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / fire (raw) | 4–8 | 2–2 | 3–3 | 4–4 | 6–6 | 9–9 |
| E / fire (HP equivalent / see channel role; ×0.0625) | 0.25–0.5 | 0.125–0.125 | 0.1875–0.1875 | 0.25–0.25 | 0.375–0.375 | 0.5625–0.5625 |
| E / fire unsynergized L20 | 3.625–3.875 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 50 | Min Frames |
| par2 | 500 | Max Frames |
| par7 | 1 | damage synergy |
| par8 | 4 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| auralencalc | `dm12` |
| EDmgSymPerCalc | `skill('Warmth'.blvl)*par8+skill('Fire Wall'.blvl)*par7` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Warmth / Fire Damage per Level | `par8` | — |
| Fire Wall / Fire Damage per Level | `par7` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Blaze Receives Bonuses From:
- Warmth: +4% Fire Damage Per Level
- Fire Wall: +1% Fire Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Mana Cost | L1–20: `11, 11.5, 12, 12, 13, 13, 14, 14, 15, 15, 16, 16, 17, 17, 18, 18, 19, 19, 20, 20` |
| Damage | L1–20: `18-37, 28-46, 37-56, 46-65, 56-75, 65-84, 75-93, 84-103, 98-117, 112-131, 126-145, 140-159, 154-173, 168-187, 182-201, 196-215, 215-234, 234-253, 253-271, 271-290` |
| Duration (seconds) | L1–20: `4.6, 5.6, 6.6, 7.6, 8.6, 9.6, 10.6, 11.6, 12.6, 13.6, 14.6, 15.6, 16.6, 17.6, 18.6, 19.6, 20.6, 21.6, 22.6, 23.6` |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **blaze** (Missiles ID 67): `pSrvDoFunc`=`5`; `pSrvHitFunc`=`8`; `pSrvDmgFunc`=`3`; `sHitPar1`=`19`; `dParam1`=`19`; `Range`=`90`; `LevRange`=`25`; `CollideType`=`3`; `Size`=`1`; `Skill`=`Blaze`.


Component **firewall** (Missiles ID 69): `pSrvDoFunc`=`5`; `pSrvDmgFunc`=`3`; `sHitPar1`=`19`; `dParam1`=`19`; `Range`=`90`; `CollideType`=`3`; `Size`=`1`; `Skill`=`Fire Wall`; `DamageRate`=`41`.


Component **firesmall** (Missiles ID 104): `pSrvDoFunc`=`1`; `Range`=`90`; `LevRange`=`25`; `CollideType`=`3`; `Size`=`1`; `EType`=`fire`.


| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / fire (raw) | 1–1 | 1–1 | 1–1 | 1–1 | 1–1 | 1–1 |
| E / fire (HP equivalent / see channel role; ×0.00390625) | 0.00390625–0.00390625 | 0.00390625–0.00390625 | 0.00390625–0.00390625 | 0.00390625–0.00390625 | 0.00390625–0.00390625 | 0.00390625–0.00390625 |
| E / fire unsynergized L20 | 0.078125–0.078125 | — | — | — | — | — |


Component **firemedium** (Missiles ID 105): `pSrvDoFunc`=`1`; `Range`=`90`; `LevRange`=`25`; `CollideType`=`3`; `Size`=`1`; `EType`=`fire`.


| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / fire (raw) | 2–2 | 2–2 | 2–2 | 2–2 | 2–2 | 2–2 |
| E / fire (HP equivalent / see channel role; ×0.00390625) | 0.0078125–0.0078125 | 0.0078125–0.0078125 | 0.0078125–0.0078125 | 0.0078125–0.0078125 | 0.0078125–0.0078125 | 0.0078125–0.0078125 |
| E / fire unsynergized L20 | 0.15625–0.15625 | — | — | — | — | — |




#### Fire Ball — ID 47


| Property | Value |
| --- | --- |
| Tree | Fire Spells |
| Required character level | 12 |
| Immediate prerequisites | Fire Bolt |
| All upstream prerequisites | Fire Bolt |
| Type | active |
| Internal data name | `Fire Ball` |
| Mana | `max(1, (10 + 1×(L−1))×0.5)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / fire (raw) | 12–28 | 13–15 | 23–25 | 28–30 | 33–35 | 38–40 |
| E / fire (HP equivalent / see channel role; ×0.5) | 6–14 | 6.5–7.5 | 11.5–12.5 | 14–15 | 16.5–17.5 | 19–20 |
| E / fire unsynergized L20 | 199.5–226.5 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par8 | 14 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| EDmgSymPerCalc | `(skill('Fire Bolt'.blvl)+skill('Meteor'.blvl))*par8` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Fire Bolt / Fire Damage per Level | `par8` | — |
| Meteor / Fire Damage per Level | `par8` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Fire Ball Receives Bonuses From
- Fire Bolt: +14% Fire Damage Per Level
- Meteor: +14% Fire Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Mana Cost | L1–20: `5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14, 14.5` |
| Damage | L1–20: `6-15, 14-24, 21-33, 29-41, 36-50, 43-58, 51-67, 58-75, 71-90, 84-104, 98-118, 111-132, 124-147, 137-161, 150-175, 163-189, 179-206, 195-224, 211-241, 227-258` |
| Constant / source label | Radius (yards): 1 |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **fireball** (Missiles ID 62): `pSrvDoFunc`=`1`; `pSrvHitFunc`=`1`; `sHitPar1`=`4`; `Vel`=`20`; `MaxVel`=`20`; `Range`=`50`; `CollideType`=`3`; `CollideKill`=`1`; `LastCollide`=`1`; `Size`=`1`; `GetHit`=`1`; `Skill`=`Fire Ball`; `ResultFlags`=`5`; `HitFlags`=`2`; `EType`=`fire`.


Component **explodingarrowexp** (Missiles ID 42): `Range`=`16`; `CollideKill`=`1`; `LastCollide`=`1`; `Size`=`1`; `GetHit`=`1`; `ResultFlags`=`4`.


Component **fireexplosion2** (Missiles ID 265): `pSrvDoFunc`=`1`; `Range`=`12`; `CollideKill`=`1`; `LastCollide`=`1`; `Size`=`1`; `GetHit`=`1`; `ResultFlags`=`4`; `HitShift`=`8`.




#### Fire Wall — ID 51


| Property | Value |
| --- | --- |
| Tree | Fire Spells |
| Required character level | 18 |
| Immediate prerequisites | Blaze |
| All upstream prerequisites | Inferno, Blaze |
| Type | active |
| Internal data name | `Fire Wall` |
| Mana | `max(1, (22 + 1×(L−1))×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |
| Shared casting delay | 35 frames = 1.4 seconds |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / fire (raw) | 15–20 | 9–9 | 14–14 | 21–21 | 21–21 | 21–21 |
| E / fire (HP equivalent / see channel role; ×0.0625) | 0.9375–1.25 | 0.5625–0.5625 | 0.875–0.875 | 1.3125–1.3125 | 1.3125–1.3125 | 1.3125–1.3125 |
| E / fire unsynergized L20 | 17.125–17.4375 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par7 | 1 | damage synergy |
| par8 | 4 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| EDmgSymPerCalc | `(skill('Warmth'.blvl)*par8+skill('Inferno'.blvl)*par7` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Warmth / Fire Damage per Level | `par8` | — |
| Inferno / Fire Damage per Level | `par7` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Fire Wall Receives Bonuses From:
- Warmth: +4% Fire Damage Per Level
- Inferno: +1% Fire Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Mana Cost | L1–20: `22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41` |
| Damage per Second | L1–20: `70-94, 113-137, 156-179, 198-222, 241-264, 283-307, 323-346, 369-392, 435-459, 501-525, 568-591, 634-658, 700-724, 766-790, 833-856, 899-923, 998-1022, 1098-1121, 1197-1221, 1296-1320` |
| Radius (yards) | L1–20: `4, 6, 7, 8, 10, 11, 12, 14, 15, 16, 18, 19, 20, 22, 23, 24, 26, 27, 28, 30` |
| Constant / source label | Duration: 3.6 Seconds |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **firewallmaker** (Missiles ID 68): `pSrvDoFunc`=`6`; `Vel`=`12`; `MaxVel`=`12`; `Range`=`7`; `LevRange`=`2`; `CollideType`=`8`; `LastCollide`=`1`; `Size`=`1`; `HitShift`=`8`; `SubMissile1`=`firewall`.


Component **firewall** (Missiles ID 69): `pSrvDoFunc`=`5`; `pSrvDmgFunc`=`3`; `sHitPar1`=`19`; `dParam1`=`19`; `Range`=`90`; `CollideType`=`3`; `Size`=`1`; `Skill`=`Fire Wall`; `DamageRate`=`41`.


Component **firesmall** (Missiles ID 104): `pSrvDoFunc`=`1`; `Range`=`90`; `LevRange`=`25`; `CollideType`=`3`; `Size`=`1`; `EType`=`fire`.


| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / fire (raw) | 1–1 | 1–1 | 1–1 | 1–1 | 1–1 | 1–1 |
| E / fire (HP equivalent / see channel role; ×0.00390625) | 0.00390625–0.00390625 | 0.00390625–0.00390625 | 0.00390625–0.00390625 | 0.00390625–0.00390625 | 0.00390625–0.00390625 | 0.00390625–0.00390625 |
| E / fire unsynergized L20 | 0.078125–0.078125 | — | — | — | — | — |


Component **firemedium** (Missiles ID 105): `pSrvDoFunc`=`1`; `Range`=`90`; `LevRange`=`25`; `CollideType`=`3`; `Size`=`1`; `EType`=`fire`.


| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / fire (raw) | 2–2 | 2–2 | 2–2 | 2–2 | 2–2 | 2–2 |
| E / fire (HP equivalent / see channel role; ×0.00390625) | 0.0078125–0.0078125 | 0.0078125–0.0078125 | 0.0078125–0.0078125 | 0.0078125–0.0078125 | 0.0078125–0.0078125 | 0.0078125–0.0078125 |
| E / fire unsynergized L20 | 0.15625–0.15625 | — | — | — | — | — |




#### Enchant — ID 52


| Property | Value |
| --- | --- |
| Tree | Fire Spells |
| Required character level | 18 |
| Immediate prerequisites | Warmth, Fire Ball |
| All upstream prerequisites | Warmth, Fire Bolt, Fire Ball |
| Type | active |
| Internal data name | `Enchant` |
| Mana | `max(1, (25 + 1×(L−1))×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / fire (raw) | 16–20 | 3–5 | 7–9 | 11–13 | 15–17 | 19–21 |
| E / fire (HP equivalent / see channel role; ×0.5) | 8–10 | 1.5–2.5 | 3.5–4.5 | 5.5–6.5 | 7.5–8.5 | 9.5–10.5 |
| E / fire unsynergized L20 | 68.5–89.5 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 3600 | duration |
| par2 | 600 | duration per level |
| par3 | 33 | missile pct |
| par8 | 9 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurastat1: firemindam | `enma` |
| aurastat2: firemaxdam | `exma` |
| aurastat3: item_tohit_percent | `toht` |
| auralencalc | `ln12` |
| EDmgSymPerCalc | `(skill('Warmth'.blvl))*par8` |
| ToHit (+% AR for usual attacks) | `20 + 9×(L−1)` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Attack Bonus: / percent | `toht` | — |
| Duration: | `ln12` | — |
| Warmth / Fire Damage per Level | `par8` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Enchant Receives Bonuses From
- Warmth: +9% Fire Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Mana Cost | L1–20: `25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44` |
| Damage | L1–20: `8-10, 10-13, 11-16, 13-19, 15-21, 16-24, 18-27, 20-29, 23-34, 27-39, 31-44, 35-49, 39-54, 43-59, 46-64, 50-69, 56-76, 62-83, 68-90, 74-97` |
| Duration (seconds) | L1–20: `144, 168, 192, 216, 240, 264, 288, 312, 336, 360, 384, 408, 432, 456, 480, 504, 528, 552, 576, 600` |
| Attack Rating +% | L1–20: `20%, 29%, 38%, 47%, 56%, 65%, 74%, 83%, 92%, 101%, 110%, 119%, 128%, 137%, 146%, 155%, 164%, 173%, 182%, 191%` |


#### Meteor — ID 56


| Property | Value |
| --- | --- |
| Tree | Fire Spells |
| Required character level | 24 |
| Immediate prerequisites | Fire Ball, Fire Wall |
| All upstream prerequisites | Fire Bolt, Fire Ball, Inferno, Blaze, Fire Wall |
| Type | active |
| Internal data name | `Meteor` |
| Mana | `max(1, (34 + 1×(L−1))×0.5)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |
| Shared casting delay | 30 frames = 1.2 seconds |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / fire (raw) | 80–100 | 23–25 | 39–41 | 79–81 | 81–83 | 83–85 |
| E / fire (HP equivalent / see channel role; ×1) | 80–100 | 23–25 | 39–41 | 79–81 | 81–83 | 83–85 |
| E / fire unsynergized L20 | 869–927 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 6 | radius of explosion |
| par2 | 0 | radius per level |
| par3 | 30 | Frames of fire |
| par4 | 15 | Frames of fire per level |
| par8 | 5 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurarangecalc | `ln12` |
| calc1 — radius | `ln12` |
| EDmgSymPerCalc | `(skill('Fire Bolt'.blvl)+skill('Fire Ball'.blvl))*par8` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Radius: | `ln12` | — |
| Fire Bolt / Fire Damage per Level | `par8` | — |
| Fire Ball / Fire Damage per Level | `par8` | — |
| Inferno / Average Fire Damage per Second per Level | `3` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Meteor Receives Bonuses From
- Fire Bolt: +5% Fire Damage Per Level
- Fire Ball: +5% Fire Damage Per Level
- Inferno: +3% Average Fire Damage Per Second Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Mana Cost | L1–20: `17, 17, 18, 18, 19, 19, 20, 20, 21, 21, 22, 22, 23, 23, 24, 24, 25, 25, 26, 26` |
| Fire Damage | L1–20: `88-110, 113-137, 138-165, 163-192, 189-220, 214-247, 239-275, 265-302, 308-347, 350-392, 393-437, 436-482, 479-528, 522-573, 565-618, 608-663, 696-752, 782-841, 869-930, 955-1019` |
| Fire Damage per second | L1–20: `35-58, 44-67, 53-77, 63-89, 72-98, 84-107, 93-117, 103-126, 114-138, 126-150, 138-164, 150-175, 164-187, 175-199, 187-210, 199-222, 213-236, 227-253, 243-267, 257-281` |
| Constant / source label | Radius 4 yards |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **meteorcenter** (Missiles ID 101): `pSrvDoFunc`=`1`; `pSrvHitFunc`=`14`; `sHitPar2`=`1`; `Range`=`60`; `LastCollide`=`1`; `Size`=`1`; `GetHit`=`1`; `Skill`=`Meteor`; `ResultFlags`=`5`; `HitFlags`=`2`; `HitShift`=`8`; `HitSubMissile1`=`meteorfire`.


Component **meteorfire** (Missiles ID 240): `pSrvDoFunc`=`5`; `pSrvDmgFunc`=`3`; `dParam1`=`19`; `Range`=`90`; `CollideType`=`3`; `Size`=`2`; `HitShift`=`3`; `EType`=`fire`; `EDmgSymPerCalc`=`skill('Inferno'.blvl)*3`; `DamageRate`=`41`.


| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / fire (raw) | 15–25 | 4–4 | 5–5 | 6–6 | 6–6 | 6–6 |
| E / fire (HP equivalent / see channel role; ×0.03125) | 0.46875–0.78125 | 0.125–0.125 | 0.15625–0.15625 | 0.1875–0.1875 | 0.1875–0.1875 | 0.1875–0.1875 |
| E / fire unsynergized L20 | 3.34375–3.65625 | — | — | — | — | — |


Component **meteor** (Missiles ID 100): `Range`=`60`; `CollideKill`=`1`; `LastCollide`=`1`.


Component **meteortail** (Missiles ID 102): `Range`=`60`; `CollideKill`=`1`; `LastCollide`=`1`; `HitShift`=`8`.


Component **meteorexplode** (Missiles ID 103): `pSrvDoFunc`=`1`; `Param1`=`2`; `Range`=`16`; `LastCollide`=`1`; `Size`=`1`; `GetHit`=`1`; `ResultFlags`=`4`; `HitShift`=`8`.


Component **whitelightmissile** (Missiles ID 154): `pSrvDoFunc`=`1`; `Range`=`10`; `LevRange`=`10`; `LastCollide`=`1`.


Component **firemedium** (Missiles ID 105): `pSrvDoFunc`=`1`; `Range`=`90`; `LevRange`=`25`; `CollideType`=`3`; `Size`=`1`; `EType`=`fire`.


| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / fire (raw) | 2–2 | 2–2 | 2–2 | 2–2 | 2–2 | 2–2 |
| E / fire (HP equivalent / see channel role; ×0.00390625) | 0.0078125–0.0078125 | 0.0078125–0.0078125 | 0.0078125–0.0078125 | 0.0078125–0.0078125 | 0.0078125–0.0078125 | 0.0078125–0.0078125 |
| E / fire unsynergized L20 | 0.15625–0.15625 | — | — | — | — | — |


Component **firesmall** (Missiles ID 104): `pSrvDoFunc`=`1`; `Range`=`90`; `LevRange`=`25`; `CollideType`=`3`; `Size`=`1`; `EType`=`fire`.


| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / fire (raw) | 1–1 | 1–1 | 1–1 | 1–1 | 1–1 | 1–1 |
| E / fire (HP equivalent / see channel role; ×0.00390625) | 0.00390625–0.00390625 | 0.00390625–0.00390625 | 0.00390625–0.00390625 | 0.00390625–0.00390625 | 0.00390625–0.00390625 | 0.00390625–0.00390625 |
| E / fire unsynergized L20 | 0.078125–0.078125 | — | — | — | — | — |




#### Fire Mastery — ID 61


| Property | Value |
| --- | --- |
| Tree | Fire Spells |
| Required character level | 30 |
| Immediate prerequisites | None |
| All upstream prerequisites | None |
| Type | passive |
| Internal data name | `Fire Mastery` |
| Mana | `0` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 30 | % Damage bonus |
| par2 | 7 | % Damage bonus per level |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| passivestat1: passive_fire_mastery | `ln12` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Fire Damage: / percent | `ln12` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Fire Damage Increase % | L1–20: `30, 37, 44, 51, 58, 65, 72, 79, 86, 93, 100, 107, 114, 121, 128, 135, 142, 149, 156, 163` |


#### Hydra — ID 62


| Property | Value |
| --- | --- |
| Tree | Fire Spells |
| Required character level | 30 |
| Immediate prerequisites | Enchant |
| All upstream prerequisites | Warmth, Fire Bolt, Fire Ball, Enchant |
| Type | summon / active |
| Internal data name | `Hydra` |
| Mana | `max(1, (40 + 1×(L−1))×0.5)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |
| Shared casting delay | 40 frames = 1.6 seconds |
| pettype | `hydra` |
| summon | `hydra1` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / fire (raw) | 28–39 | 11–13 | 15–17 | 19–21 | 23–25 | 27–29 |
| E / fire (HP equivalent / see channel role; ×0.5) | 14–19.5 | 5.5–6.5 | 7.5–8.5 | 9.5–10.5 | 11.5–12.5 | 13.5–14.5 |
| E / fire unsynergized L20 | 150.5–175 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 250 | duration |
| par2 | 0 | additional duration/level |
| par8 | 3 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| passivestat1: passive_fire_mastery | `stat('passive_fire_mastery'.accr)` |
| passivestat2: passive_fire_pierce | `stat('passive_fire_pierce'.accr)` |
| sumskill1: HydraMissile | `lvl` |
| sumskill2: Fire Bolt | `skill('Fire Bolt'.blvl)` |
| sumskill3: Fire Ball | `skill('Fire Ball'.blvl)` |
| petmax | `99` |
| EDmgSymPerCalc | `(skill('Fire Bolt'.blvl) + skill('Fire Ball'.blvl))*par8` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Duration: | `ln12` | — |
| Fire Bolt / Fire Damage per Level | `par8` | — |
| Fire Ball / Fire Damage per Level | `par8` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Hydra Receives Bonuses From
- Fire Bolt: +3% Fire Damage Per Level
- Fire Ball: +3% Fire Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Mana Cost | L1–20: `20, 20, 21, 21, 22, 22, 23, 23, 24, 24, 25, 25, 26, 26, 27, 27, 28, 28, 29, 29` |
| Damage | L1–20: `14-19, 20-27, 26-34, 32-41, 38-48, 43-55, 49-62, 55-68, 63-77, 71-86, 79-95, 87-104, 95-113, 103-122, 111-131, 119-140, 129-152, 139-163, 149-174, 159-185` |
| Constant / source label | Duration: 10 Seconds |


**Summon base monster record** — seed values, NOT the final buffed summon. Apply this skill's HP/damage/AR calculations, mastery, summon level, difficulty and generated equipment; absent difficulty HP fields can be supplied by hardcoded handling.

| MonStats field | Value |
| --- | --- |
| Id | `hydra1` |
| AI | `Hydra` |
| aidel | `15` |
| aidel(N) | `15` |
| aidel(H) | `15` |
| Skill1 | `HydraMissile` |
| Sk1mode | `A1` |
| Sk1lvl | `1` |


### Lightning Spells

Source display tables: [Arreat Summit — Lightning Spells](http://classic.battle.net/diablo2exp/skills/sorceress-lightning.shtml). Exact fields: pinned Skills.txt / SkillDesc.txt / Missiles.txt listed in §0.


| ID | Skill | Required clvl | Immediate prerequisites | Type | Mana expression |
| --- | --- | --- | --- | --- | --- |
| 38 | Charged Bolt | 1 | None | active | `max(1, (24 + 4×(L−1))×0.125)` |
| 42 | Static Field | 6 | None | active | `max(1, (9)×1)` |
| 43 | Telekinesis | 6 | None | active | `max(1, (7)×1)` |
| 48 | Nova | 12 | Static Field | active | `max(1, (15 + 1×(L−1))×1)` |
| 49 | Lightning | 12 | Charged Bolt | active | `max(1, (16 + 1×(L−1))×0.5)` |
| 53 | Chain Lightning | 18 | Lightning | active | `max(1, (9 + 1×(L−1))×1)` |
| 54 | Teleport | 18 | Telekinesis | active | `max(1, (24 − 1×(L−1))×1)` |
| 57 | Thunder Storm | 24 | Nova, Chain Lightning | active | `max(1, (19)×1)` |
| 58 | Energy Shield | 24 | Teleport, Chain Lightning | active | `max(1, (5)×1)` |
| 63 | Lightning Mastery | 30 | None | passive | `0` |


#### Charged Bolt — ID 38


| Property | Value |
| --- | --- |
| Tree | Lightning Spells |
| Required character level | 1 |
| Immediate prerequisites | None |
| All upstream prerequisites | None |
| Type | active |
| Internal data name | `Charged Bolt` |
| Mana | `max(1, (24 + 4×(L−1))×0.125)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / ltng (raw) | 4–8 | 1–1 | 1–1 | 2–2 | 3–3 | 4–4 |
| E / ltng (HP equivalent / see channel role; ×0.5) | 2–4 | 0.5–0.5 | 0.5–0.5 | 1–1 | 1.5–1.5 | 2–2 |
| E / ltng unsynergized L20 | 13.5–15.5 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 3 | Bolts to send out |
| par2 | 1 | Additional bolts per level |
| par8 | 6 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| calc1 — # bolts | `min(24,ln12)` |
| EDmgSymPerCalc | `(skill('Lightning'.blvl))*par8` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| bolts | `min(24,ln12)` | — |
| Lightning / Lightning Damage per Level | `par8` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Charged Bolt Receives Bonuses From
- Lightning: +6% Lightning Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Mana Cost | L1–20: `3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12, 12` |
| Damage | L1–20: `2-4, 2-4, 3-5, 3-5, 4-6, 4-6, 5-7, 5-7, 6-8, 6-8, 7-9, 7-9, 8-10, 8-10, 9-11, 9-11, 10-12, 11-13, 12-14, 13-15` |
| # of Bolts | L1–20: `3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22` |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **chargedbolt** (Missiles ID 56): `pSrvDoFunc`=`1`; `Vel`=`12`; `MaxVel`=`12`; `Range`=`98`; `CollideType`=`3`; `CollideKill`=`1`; `LastCollide`=`1`; `Size`=`1`; `GetHit`=`1`; `Skill`=`Charged Bolt`; `ResultFlags`=`4`.




#### Static Field — ID 42


| Property | Value |
| --- | --- |
| Tree | Lightning Spells |
| Required character level | 6 |
| Immediate prerequisites | None |
| All upstream prerequisites | None |
| Type | active |
| Internal data name | `Static Field` |
| Mana | `max(1, (9)×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |
| aurafilter | `34691` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 5 | Base radius of effect. |
| par2 | 1 | Level radius bonus. |
| par3 | 0 | Minimum Damage. |
| par4 | 25 | Percent Damage. |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurarangecalc | `ln12` |
| calc1 — damage % | `par4` |
| calc2 — min damage | `par3` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Radius: | `ln12` | — |
| Weakens Enemies by / percent | `par4` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 9 |
| Radius (yards) | L1–20: `3.3, 4, 4.6, 5.3, 6, 6.6, 7.3, 8, 8.6, 9.3, 10, 10.6, 11.3, 12, 12.6, 13.3, 14, 14.6, 15.3, 16` |
| Constant / source label | Damage: 25% |


#### Telekinesis — ID 43


| Property | Value |
| --- | --- |
| Tree | Lightning Spells |
| Required character level | 6 |
| Immediate prerequisites | None |
| All upstream prerequisites | None |
| Type | active |
| Internal data name | `Telekinesis` |
| Mana | `max(1, (7)×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / ltng (raw) | 1–2 | 1–1 | 1–1 | 1–1 | 1–1 | 1–1 |
| E / ltng (HP equivalent / see channel role; ×1) | 1–2 | 1–1 | 1–1 | 1–1 | 1–1 | 1–1 |
| E / ltng unsynergized L20 | 20–21 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 25 | On-screen cast range. |
| par2 | 35 | Chance to knockback/stun. |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurarangecalc | `par1` |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 7 |
| Damage | L1–20: `1-2, 2-3, 3-4, 4-5, 5-6, 6-7, 7-8, 8-9, 9-10, 10-11, 11-12, 12-13, 13-14, 14-15, 15-16, 16-17, 17-18, 18-19, 19-20, 20-21` |


#### Nova — ID 48


| Property | Value |
| --- | --- |
| Tree | Lightning Spells |
| Required character level | 12 |
| Immediate prerequisites | Static Field |
| All upstream prerequisites | Static Field |
| Type | active |
| Internal data name | `Nova` |
| Mana | `max(1, (15 + 1×(L−1))×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / ltng (raw) | 1–20 | 6–8 | 7–9 | 8–10 | 9–11 | 10–12 |
| E / ltng (HP equivalent / see channel role; ×1) | 1–20 | 6–8 | 7–9 | 8–10 | 9–11 | 10–12 |
| E / ltng unsynergized L20 | 131–188 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 12 | number of missiles |
| par2 | 4 | additional missiles per level |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Mana Cost | L1–20: `15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34` |
| Lightning Damage | L1–20: `1-20, 7-28, 13-36, 19-44, 25-52, 31-60, 37-68, 43-76, 50-85, 57-94, 64-103, 71-112, 78-121, 85-130, 92-139, 99-148, 107-158, 115-168, 123-178, 131-188` |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **nova** (Missiles ID 90): `pSrvDoFunc`=`1`; `Vel`=`24`; `MaxVel`=`24`; `Range`=`13`; `CollideType`=`3`; `LastCollide`=`1`; `NextHit`=`1`; `NextDelay`=`4`; `Size`=`1`; `GetHit`=`1`; `Skill`=`Nova`; `ResultFlags`=`4`.




#### Lightning — ID 49


| Property | Value |
| --- | --- |
| Tree | Lightning Spells |
| Required character level | 12 |
| Immediate prerequisites | Charged Bolt |
| All upstream prerequisites | Charged Bolt |
| Type | active |
| Internal data name | `Lightning` |
| Mana | `max(1, (16 + 1×(L−1))×0.5)` |
| Animation / source-damage field | `SQ; SrcDam=0 /128` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / ltng (raw) | 1–40 | 0–8 | 0–12 | 0–20 | 0–28 | 0–36 |
| E / ltng (HP equivalent / see channel role; ×1) | 1–40 | 0–8 | 0–12 | 0–20 | 0–28 | 0–36 |
| E / ltng unsynergized L20 | 1–272 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 10 | minimum damage |
| par2 | 20 | max damage |
| par3 | 4 | increase in dam/level (min & max) |
| par8 | 8 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| EDmgSymPerCalc | `(skill('Charged Bolt'.blvl)+skill('Chain Lightning'.blvl)+skill('Nova'.blvl))*par8` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Charged Bolt / Lightning Damage per Level | `par8` | — |
| Nova / Lightning Damage per Level | `par8` | — |
| Chain Lightning / Lightning Damage per Level | `par8` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Lightning Receives Bonuses From
- Charged Bolt: +8% Lightning Damage Per Level
- Nova: +8% Lightning Damage Per Level
- Chain Lightning: +8% Lightning Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Mana Cost | L1–20: `8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12, 12, 13, 13, 14, 14, 15, 15, 16, 16, 17, 17` |
| Damage | L1–20: `1-43, 1-51, 1-60, 1-69, 1-77, 1-86, 1-95, 1-103, 1-116, 1-129, 1-142, 1-155, 1-168, 1-181, 1-194, 1-207, 1-228, 1-250, 1-272, 1-293` |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **lightningbolt** (Missiles ID 98): `pSrvDoFunc`=`1`; `Vel`=`30`; `MaxVel`=`30`; `Range`=`25`; `CollideType`=`3`; `LastCollide`=`1`; `Size`=`2`; `GetHit`=`1`; `Skill`=`Lightning`; `ResultFlags`=`4`.


Component **lightninghit** (Missiles ID 99): `pSrvDoFunc`=`1`; `Range`=`12`; `Size`=`1`; `HitShift`=`8`; `EType`=`ltng`.


| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / ltng (raw) | 2–5 | 2–2 | 2–2 | 2–2 | 2–2 | 2–2 |
| E / ltng (HP equivalent / see channel role; ×1) | 2–5 | 2–2 | 2–2 | 2–2 | 2–2 | 2–2 |
| E / ltng unsynergized L20 | 40–43 | — | — | — | — | — |




#### Chain Lightning — ID 53


| Property | Value |
| --- | --- |
| Tree | Lightning Spells |
| Required character level | 18 |
| Immediate prerequisites | Lightning |
| All upstream prerequisites | Charged Bolt, Lightning |
| Type | active |
| Internal data name | `Chain Lightning` |
| Mana | `max(1, (9 + 1×(L−1))×1)` |
| Animation / source-damage field | `SQ; SrcDam=0 /128` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / ltng (raw) | 1–40 | 0–11 | 0–13 | 0–15 | 0–15 | 0–15 |
| E / ltng (HP equivalent / see channel role; ×1) | 1–40 | 0–11 | 0–13 | 0–15 | 0–15 | 0–15 |
| E / ltng unsynergized L20 | 1–281 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 20 | radius of jump to next target |
| par3 | 26 | bolts (5ths) |
| par4 | 1 | bolts per level (5ths) |
| par5 | 5 | 5ths |
| par8 | 4 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurarangecalc | `par1` |
| calc1 — # hits | `ln34 / 5` |
| EDmgSymPerCalc | `(skill('Charged Bolt'.blvl)+skill('Lightning'.blvl)+skill('Nova'.blvl))*par8` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| hits | `ln34/par5` | — |
| Charged Bolt / Lightning Damage per Level | `par8` | — |
| Nova / Lightning Damage per Level | `par8` | — |
| Lightning / Lightning Damage per Level | `par8` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Chain Lightning Receives Bonuses From
- Charged Bolt: +4% Lightning Damage Per Level
- Nova: +4% Lightning Damage Per Level
- Lightning: +4% Lightning Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Mana Cost | L1–20: `9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28` |
| Damage | L1–20: `1-40, 1-51, 1-62, 1-73, 1-84, 1-95, 1-106, 1-117, 1-130, 1-143, 1-156, 1-169, 1-182, 1-195, 1-208, 1-221, 1-236, 1-251, 1-266, 1-281` |
| Hits # Targets | L1–20: `5, 5, 5, 5, 6, 6, 6, 6, 6, 7, 7, 7, 7, 7, 8, 8, 8, 8, 8, 9` |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **chainlightning** (Missiles ID 93): `pSrvDoFunc`=`1`; `pSrvHitFunc`=`12`; `Vel`=`30`; `MaxVel`=`30`; `Range`=`25`; `CollideType`=`3`; `CollideKill`=`1`; `LastCollide`=`1`; `NextHit`=`1`; `NextDelay`=`4`; `Size`=`2`; `GetHit`=`1`; `Skill`=`Chain Lightning`; `ResultFlags`=`4`.


Component **lightninghit** (Missiles ID 99): `pSrvDoFunc`=`1`; `Range`=`12`; `Size`=`1`; `HitShift`=`8`; `EType`=`ltng`.


| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / ltng (raw) | 2–5 | 2–2 | 2–2 | 2–2 | 2–2 | 2–2 |
| E / ltng (HP equivalent / see channel role; ×1) | 2–5 | 2–2 | 2–2 | 2–2 | 2–2 | 2–2 |
| E / ltng unsynergized L20 | 40–43 | — | — | — | — | — |




#### Teleport — ID 54


| Property | Value |
| --- | --- |
| Tree | Lightning Spells |
| Required character level | 18 |
| Immediate prerequisites | Telekinesis |
| All upstream prerequisites | Telekinesis |
| Type | active |
| Internal data name | `Teleport` |
| Mana | `max(1, (24 − 1×(L−1))×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Mana Cost | L1–20: `24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5` |


#### Thunder Storm — ID 57


| Property | Value |
| --- | --- |
| Tree | Lightning Spells |
| Required character level | 24 |
| Immediate prerequisites | Nova, Chain Lightning |
| All upstream prerequisites | Static Field, Nova, Charged Bolt, Lightning, Chain Lightning |
| Type | active |
| Internal data name | `Thunder Storm` |
| Mana | `max(1, (19)×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |
| perdelay | `(100-dm56) * par4/100 + par3` |
| periodic | `1` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / ltng (raw) | 1–100 | 10–10 | 10–10 | 11–11 | 11–11 | 11–11 |
| E / ltng (HP equivalent / see channel role; ×1) | 1–100 | 10–10 | 10–10 | 11–11 | 11–11 | 11–11 |
| E / ltng unsynergized L20 | 195–294 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 800 | duration |
| par2 | 200 | additional duration/level |
| par3 | 25 | minimum repeat time |
| par4 | 100 | repeat time factor |
| par5 | 0 | min % repeat time |
| par6 | 100 | max % repeat time |
| par7 | 17 | radius |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| auralencalc | `ln12` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Duration: | `ln12` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 19 |
| Damage | L1–20: `1-100, 11-110, 21-120, 31-130, 41-140, 51-150, 61-160, 71-170, 81-180, 91-190, 101-200, 111-210, 121-220, 131-230, 141-240, 151-250, 162-261, 173-272, 184-283, 195-294` |
| Duration (seconds) | L1–20: `32, 40, 48, 56, 64, 72, 80, 88, 96, 104, 112, 120, 128, 136, 144, 152, 160, 168, 176, 184` |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **thunderstorm1** (Missiles ID 166): `pSrvDoFunc`=`3`; `Vel`=`2`; `MaxVel`=`2`; `Range`=`9`; `CollideType`=`3`; `Size`=`3`; `GetHit`=`1`; `Skill`=`Thunder Storm`; `ResultFlags`=`4`.




#### Energy Shield — ID 58


| Property | Value |
| --- | --- |
| Tree | Lightning Spells |
| Required character level | 24 |
| Immediate prerequisites | Teleport, Chain Lightning |
| All upstream prerequisites | Telekinesis, Teleport, Charged Bolt, Lightning, Chain Lightning |
| Type | active |
| Internal data name | `Energy Shield` |
| Mana | `max(1, (5)×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / data-channel (healing/stat; not necessarily damage) (raw) | 20–0 | 5–0 | 2–0 | 1–0 | 1–0 | 1–0 |
| E / data-channel (healing/stat; not necessarily damage) (HP equivalent / see channel role; ×1) | 20–0 | 5–0 | 2–0 | 1–0 | 1–0 | 1–0 |
| E / data-channel (healing/stat; not necessarily damage) unsynergized L20 | 75–0 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 3600 | duration |
| par2 | 1500 | additional duration/level |
| par5 | 32 | Mana Damage mult in sixteenths |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| auralencalc | `ln12` |
| calc1 — damage absorption | `min(edmn,95)` |
| calc2 — ratio | `par5-skill('Telekinesis'.blvl)` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Absorbs / percent | `min(edmn,95)` | — |
| Duration: | `ln12` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Energy Shield Receives Bonuses From


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 5 |
| Absorbs % Damage | L1–20: `20, 25, 30, 35, 40, 45, 50, 55, 57, 59, 61, 63, 65, 67, 69, 71, 72, 73, 74, 75` |
| Duration (seconds) | L1–20: `144, 204, 264, 324, 384, 444, 504, 564, 624, 684, 744, 804, 864, 924, 984, 1044, 1104, 1164, 1224, 1284` |


#### Lightning Mastery — ID 63


| Property | Value |
| --- | --- |
| Tree | Lightning Spells |
| Required character level | 30 |
| Immediate prerequisites | None |
| All upstream prerequisites | None |
| Type | passive |
| Internal data name | `Lightning Mastery` |
| Mana | `0` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 50 | % Damage bonus |
| par2 | 12 | % Damage bonus per level |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| passivestat1: passive_ltng_mastery | `ln12` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Lightning Damage: / percent | `ln12` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Lightning Damage +% | L1–20: `50, 62, 74, 86, 98, 110, 122, 134, 146, 158, 170, 182, 194, 206, 218, 230, 242, 254, 266, 278` |


### Cold Spells

Source display tables: [Arreat Summit — Cold Spells](http://classic.battle.net/diablo2exp/skills/sorceress-cold.shtml). Exact fields: pinned Skills.txt / SkillDesc.txt / Missiles.txt listed in §0.


| ID | Skill | Required clvl | Immediate prerequisites | Type | Mana expression |
| --- | --- | --- | --- | --- | --- |
| 39 | Ice Bolt | 1 | None | active | `max(1, (3)×1)` |
| 40 | Frozen Armor | 1 | None | active | `max(1, (7)×1)` |
| 44 | Frost Nova | 6 | None | active | `max(1, (9 + 1×(L−1))×1)` |
| 45 | Ice Blast | 6 | Ice Bolt | active | `max(1, (12 + 1×(L−1))×0.5)` |
| 50 | Shiver Armor | 12 | Ice Blast, Frozen Armor | active | `max(1, (11)×1)` |
| 55 | Glacial Spike | 18 | Ice Blast | active | `max(1, (20 + 1×(L−1))×0.5)` |
| 59 | Blizzard | 24 | Frost Nova, Glacial Spike | active | `max(1, (23 + 1×(L−1))×1)` |
| 60 | Chilling Armor | 24 | Shiver Armor | active | `max(1, (17)×1)` |
| 64 | Frozen Orb | 30 | Blizzard | active | `max(1, (50 + 1×(L−1))×0.5)` |
| 65 | Cold Mastery | 30 | None | passive | `0` |


#### Ice Bolt — ID 39


| Property | Value |
| --- | --- |
| Tree | Cold Spells |
| Required character level | 1 |
| Immediate prerequisites | None |
| All upstream prerequisites | None |
| Type | active |
| Internal data name | `Ice Bolt` |
| Mana | `max(1, (3)×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / cold (raw) | 6–10 | 2–3 | 4–5 | 6–7 | 8–9 | 10–11 |
| E / cold (HP equivalent / see channel role; ×0.5) | 3–5 | 1–1.5 | 2–2.5 | 3–3.5 | 4–4.5 | 5–5.5 |
| E / cold unsynergized L20 | 38–49.5 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par8 | 15 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| EDmgSymPerCalc | `(skill('Frost Nova'.blvl)+skill('Ice Blast'.blvl)+skill('Glacial Spike'.blvl)+skill('Blizzard'.blvl)+skill('Frozen Orb'.blvl))*par8` |
| E length: frames, L1; increments L2–8 / L9–16 / L17+ | `150; 35 / 35 / 35` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Frost Nova / Cold Damage per Level | `par8` | — |
| Ice Blast / Cold Damage per Level | `par8` | — |
| Glacial Spike / Cold Damage per Level | `par8` | — |
| Blizzard / Cold Damage per Level | `par8` | — |
| Frozen Orb / Cold Damage per Level | `par8` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Ice Bolt Receives Bonuses From
- Frost Nova: +15% Cold Damage Per Level
- Ice Blast: +15% Cold Damage Per Level
- Glacial Spike: +15% Cold Damage Per Level
- Blizzard: +15% Cold Damage Per Level
- Frozen Orb: +15% Cold Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 3 |
| Damage | L1–20: `3-5, 4-6, 5-8, 6-9, 7-11, 8-12, 9-14, 10-15, 12-18, 14-20, 16-23, 18-25, 20-28, 22-30, 24-33, 26-36, 29-39, 32-42, 35-46, 38-49` |
| Cold Length (seconds) | L1–20: `6, 7.4, 8.8, 10.2, 11.6, 13, 14.4, 15.8, 17.2, 18.6, 20, 21, 22.8, 24.2, 25.6, 27, 28.4, 29.8, 31.2, 32.6` |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **icebolt** (Missiles ID 59): `pSrvDoFunc`=`1`; `Vel`=`12`; `MaxVel`=`12`; `Range`=`50`; `CollideType`=`3`; `CollideKill`=`1`; `LastCollide`=`1`; `Size`=`1`; `GetHit`=`1`; `Skill`=`Ice Bolt`; `ResultFlags`=`4`.


Component **iceexplode** (Missiles ID 30): `Range`=`16`; `CollideKill`=`1`; `LastCollide`=`1`; `Size`=`1`; `GetHit`=`1`; `ResultFlags`=`4`; `HitShift`=`8`.




#### Frozen Armor — ID 40


| Property | Value |
| --- | --- |
| Tree | Cold Spells |
| Required character level | 1 |
| Immediate prerequisites | None |
| All upstream prerequisites | None |
| Type | active |
| Internal data name | `Frozen Armor` |
| Mana | `max(1, (7)×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 30 | % AC base |
| par2 | 5 | % AC per level |
| par3 | 3000 | Duration |
| par4 | 300 | Duration per level |
| par5 | 30 | Freeze Frames |
| par6 | 3 | Freeze Frames per level |
| par7 | 250 | duration synergy |
| par8 | 5 | freeze synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurastat1: skill_armor_percent | `ln12` |
| auralencalc | `ln34+(skill('Shiver Armor'.blvl)+skill('Chilling Armor'.blvl))*par7` |
| calc1 — freeze length | `ln56*(100+((skill('Shiver Armor'.blvl)+skill('Chilling Armor'.blvl))*par8))/100` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Freezes for | `ln56*(100+((skill('Shiver Armor'.blvl)+skill('Chilling Armor'.blvl))*par8))/100` | — |
| Duration: | `ln34+(skill('Shiver Armor'.blvl)+skill('Chilling Armor'.blvl))*par7` | — |
| Defense Bonus: / percent | `ln12` | — |
| Shiver Armor / Seconds per Level | `(par7 + 12)/25` | — |
| Shiver Armor / Freeze Length per Level | `par8` | — |
| Chilling Armor / Seconds per Level | `(par7 + 12)/25` | — |
| Chilling Armor / Freeze Length per Level | `par8` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Frozen Armor Receives Bonuses From
- Shiver Armor: +10 Seconds Per Level
- Shiver Armor: +5% Freeze Length Per Level
- Chilling Armor: +10 Seconds Per Level
- Chilling Armor: +5% Freeze Length Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 7 |
| Defense Bonus % | L1–20: `30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120, 125` |
| Duration (seconds) | L1–20: `120, 132, 144, 156, 168, 180, 192, 204, 216, 228, 240, 252, 264, 276, 288, 300, 312, 324, 336, 348` |
| Freeze Length (seconds) | L1–20: `1.2, 1.3, 1.4, 1.5, 1.6, 1.8, 1.9, 2, 2.1, 2.2, 2.4, 2.5, 2.6, 2.7, 2.8, 3, 3.1, 3.2, 3.3, 3.4` |


#### Frost Nova — ID 44


| Property | Value |
| --- | --- |
| Tree | Cold Spells |
| Required character level | 6 |
| Immediate prerequisites | None |
| All upstream prerequisites | None |
| Type | active |
| Internal data name | `Frost Nova` |
| Mana | `max(1, (9 + 1×(L−1))×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / cold (raw) | 4–8 | 4–5 | 6–7 | 8–9 | 10–11 | 12–13 |
| E / cold (HP equivalent / see channel role; ×0.5) | 2–4 | 2–2.5 | 3–3.5 | 4–4.5 | 5–5.5 | 6–6.5 |
| E / cold unsynergized L20 | 56–67.5 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 9 | radius of freeze |
| par2 | 3 | additional radius/level |
| par8 | 10 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| EDmgSymPerCalc | `(skill('Blizzard'.blvl)+skill('Frozen Orb'.blvl))*par8` |
| E length: frames, L1; increments L2–8 / L9–16 / L17+ | `200; 25 / 25 / 25` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Blizzard / Cold Damage per Level | `par8` | — |
| Frozen Orb / Cold Damage per Level | `par8` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Frost Nova Receives Bonuses From
- Blizzard: +10% Cold Damage Per Level
- Frozen Orb: +10% Cold Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Mana Cost | L1–20: `9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28` |
| Cold Damage | L1–20: `2-4, 4-6, 6-9, 8-11, 10-14, 12-16, 14-19, 16-21, 19-25, 22-28, 25-32, 28-35, 31-39, 34-42, 37-46, 40-49, 44-54, 48-58, 52-63, 56-67` |
| Cold Length (seconds) | L1–20: `8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27` |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **frostnova** (Missiles ID 119): `pSrvDoFunc`=`1`; `Vel`=`24`; `MaxVel`=`24`; `Range`=`14`; `CollideType`=`3`; `LastCollide`=`1`; `NextHit`=`1`; `NextDelay`=`4`; `Size`=`1`; `GetHit`=`1`; `Skill`=`Frost Nova`; `ResultFlags`=`4`.




#### Ice Blast — ID 45


| Property | Value |
| --- | --- |
| Tree | Cold Spells |
| Required character level | 6 |
| Immediate prerequisites | Ice Bolt |
| All upstream prerequisites | Ice Bolt |
| Type | active |
| Internal data name | `Ice Blast` |
| Mana | `max(1, (12 + 1×(L−1))×0.5)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / cold (raw) | 16–24 | 14–15 | 28–29 | 42–43 | 56–57 | 70–71 |
| E / cold (HP equivalent / see channel role; ×0.5) | 8–12 | 7–7.5 | 14–14.5 | 21–21.5 | 28–28.5 | 35–35.5 |
| E / cold unsynergized L20 | 253–266.5 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 75 | Duration of freeze |
| par2 | 5 | additional duration/level |
| par7 | 10 | freeze synergy |
| par8 | 8 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| EDmgSymPerCalc | `(skill('Ice Bolt'.blvl)+skill('Blizzard'.blvl)+skill('Frozen Orb'.blvl))*par8` |
| ELenSymPerCalc | `(skill('Glacial Spike'.blvl))*par7` |
| E length: frames, L1; increments L2–8 / L9–16 / L17+ | `75; 5 / 5 / 5` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Freezes for | `edln` | — |
| Ice Bolt / Cold Damage per Level | `par8` | — |
| Glacial Spike / Freeze Length per Level | `par7` | — |
| Blizzard / Cold Damage per Level | `par8` | — |
| Frozen Orb / Cold Damage per Level | `par8` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Ice Blast Receives Bonuses From
- Ice Bolt: +8% Cold Damage Per Level
- Glacial Spike: +10% Freeze Length Per Level
- Blizzard: +8% Cold Damage Per Level
- Frozen Orb: +8% Cold Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Mana Cost | L1–20: `6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12, 12, 13, 13, 14, 14, 15, 15` |
| Cold Damage | L1–20: `8-12, 16-21, 23-29, 31-37, 38-45, 46-53, 54-61, 61-69, 76-85, 91-100, 106-116, 122-132, 137-147, 152-163, 167-179, 182-194, 205-218, 227-241, 250-264, 273-287` |
| Freeze Length (seconds) | L1–20: `3, 3.2, 3.4, 3.6, 3.8, 4, 4.2, 4.4, 4.6, 4.8, 5, 5.2, 5.4, 5.6, 5.8, 6, 6.2, 6.4, 6.6, 6.8` |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **iceblast** (Missiles ID 91): `pSrvDoFunc`=`1`; `pSrvDmgFunc`=`4`; `Param1`=`4`; `Vel`=`12`; `MaxVel`=`12`; `Range`=`50`; `CollideType`=`3`; `CollideKill`=`1`; `LastCollide`=`1`; `Size`=`1`; `GetHit`=`1`; `Skill`=`Ice Blast`; `ResultFlags`=`4`.


Component **freezingarrowexp1** (Missiles ID 88): `pSrvDoFunc`=`1`; `Range`=`16`; `CollideKill`=`1`; `LastCollide`=`1`; `Size`=`1`; `GetHit`=`1`; `ResultFlags`=`4`; `HitShift`=`8`.




#### Shiver Armor — ID 50


| Property | Value |
| --- | --- |
| Tree | Cold Spells |
| Required character level | 12 |
| Immediate prerequisites | Ice Blast, Frozen Armor |
| All upstream prerequisites | Ice Bolt, Ice Blast, Frozen Armor |
| Type | active |
| Internal data name | `Shiver Armor` |
| Mana | `max(1, (11)×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / cold (raw) | 12–16 | 4–5 | 6–7 | 8–9 | 10–11 | 12–13 |
| E / cold (HP equivalent / see channel role; ×0.5) | 6–8 | 2–2.5 | 3–3.5 | 4–4.5 | 5–5.5 | 6–6.5 |
| E / cold unsynergized L20 | 60–71.5 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 45 | % AC base |
| par2 | 6 | % AC per level |
| par3 | 3000 | Duration |
| par4 | 300 | duration per level |
| par7 | 250 | duration synergy |
| par8 | 9 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurastat1: skill_armor_percent | `ln12` |
| auralencalc | `ln34+(skill('Frozen Armor'.blvl)+skill('Chilling Armor'.blvl))*par7` |
| EDmgSymPerCalc | `(skill('Frozen Armor'.blvl)+skill('Chilling Armor'.blvl))*par8` |
| E length: frames, L1; increments L2–8 / L9–16 / L17+ | `100; 0 / 25 / 50` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Defense Bonus: / percent | `ln12` | — |
| Duration: | `ln34+(skill('Frozen Armor'.blvl)+skill('Chilling Armor'.blvl))*par7` | — |
| Frozen Armor / Seconds per Level | `(par7 + 12)/25` | — |
| Frozen Armor / Cold Damage per Level | `par8` | — |
| Chilling Armor / Seconds per Level | `(par7 + 12)/25` | — |
| Chilling Armor / Cold Damage per Level | `par8` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Shiver Armor Receives Bonuses From
- Frozen Armor: +10 Seconds Per Level
- Frozen Armor: +9% Cold Damage Per Level
- Chilling Armor: +10 Seconds Per Level
- Chilling Armor: +9% Cold Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 11 |
| Defense Bonus % | L1–20: `45, 51, 57, 63, 69, 75, 81, 87, 93, 99, 105, 111, 117, 123, 129, 135, 141, 147, 153, 159` |
| Damage | L1–20: `6-8, 8-11, 10-14, 13-16, 15-19, 17-22, 19-25, 21-27, 25-31, 28-35, 31-39, 34-43, 38-46, 41-50, 44-54, 47-58, 52-63, 56-68, 61-73, 65-77` |
| Duration (seconds) | L1–20: `130, 142, 154, 166, 178, 190, 202, 214, 226, 238, 250, 262, 274, 286, 298, 310, 322, 334, 346, 358` |
| Constant / source label | Cold Length: 4 Seconds |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **sparkle** (Missiles ID 212): `pSrvDoFunc`=`1`; `Vel`=`4`; `MaxVel`=`4`; `Range`=`30`; `CollideType`=`3`; `CollideKill`=`1`; `LastCollide`=`1`; `Size`=`1`; `GetHit`=`1`; `ResultFlags`=`4`; `HitShift`=`8`; `EType`=`pois`.


| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / pois (raw) | 2–6 | 2–2 | 2–2 | 2–2 | 2–2 | 2–2 |
| E / pois (rate HP/frame; ×1) | 2–6 | 2–2 | 2–2 | 2–2 | 2–2 | 2–2 |
| E / pois unsynergized L20 | 40–44 | — | — | — | — | — |




#### Glacial Spike — ID 55


| Property | Value |
| --- | --- |
| Tree | Cold Spells |
| Required character level | 18 |
| Immediate prerequisites | Ice Blast |
| All upstream prerequisites | Ice Bolt, Ice Blast |
| Type | active |
| Internal data name | `Glacial Spike` |
| Mana | `max(1, (20 + 1×(L−1))×0.5)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / cold (raw) | 32–48 | 14–15 | 26–27 | 28–29 | 30–31 | 32–33 |
| E / cold (HP equivalent / see channel role; ×0.5) | 16–24 | 7–7.5 | 13–13.5 | 14–14.5 | 15–15.5 | 16–16.5 |
| E / cold unsynergized L20 | 225–242.5 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 4 | radius |
| par2 | 0 | radius per level |
| par3 | 50 | freeze frames |
| par4 | 3 | freeze frames per level |
| par7 | 3 | freeze synergy |
| par8 | 5 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurarangecalc | `ln12` |
| auralencalc | `ln34 * (100 + skill('Blizzard'.blvl) * par7) / 100` |
| EDmgSymPerCalc | `(skill('Ice Bolt'.blvl)+skill('Ice Blast'.blvl)+skill('Frozen Orb'.blvl))*par8` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Freezes for | `ln34 * (100 + skill('Blizzard'.blvl) * par7) / 100` | — |
| Radius: | `ln12` | — |
| Ice Bolt / Cold Damage per Level | `par8` | — |
| Ice Blast / Cold Damage per Level | `par8` | — |
| Blizzard / Freeze Length per Level | `par7` | — |
| Frozen Orb / Cold Damage per Level | `par8` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Glacial Spike Receives Bonuses From
- Ice Bolt: +5% Cold Damage Per Level
- Ice Blast: +5% Cold Damage Per Level
- Blizzard: +3% Freeze Length Per Level
- Frozen Orb: +5% Cold Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Mana Cost | L1–20: `10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14, 14.5, 15, 15.5, 16, 16.5, 17, 17.5, 18, 18.5, 19, 19.5` |
| Damage | L1–20: `17-26, 25-34, 33-42, 40-51, 48-59, 56-67, 63-75, 71-84, 85-99, 100-113, 114-128, 128-143, 143-158, 157-173, 171-188, 185-202, 201-218, 216-234, 232-250, 247-266` |
| Freeze Length (seconds) | L1–20: `2, 2.1, 2.2, 2.3, 2.4, 2.6, 2.7, 2.8, 2.9, 3, 3.2, 3.3, 3.4, 3.5, 3.6, 3.8, 3.9, 4, 4.1, 4.2` |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **glacialspike** (Missiles ID 96): `pSrvDoFunc`=`1`; `pSrvHitFunc`=`13`; `Vel`=`16`; `MaxVel`=`16`; `Range`=`40`; `CollideType`=`3`; `CollideKill`=`1`; `LastCollide`=`1`; `Size`=`1`; `GetHit`=`1`; `Skill`=`Glacial Spike`; `ResultFlags`=`5`; `HitFlags`=`2`; `EType`=`frze`.


Component **freezingarrowexp1** (Missiles ID 88): `pSrvDoFunc`=`1`; `Range`=`16`; `CollideKill`=`1`; `LastCollide`=`1`; `Size`=`1`; `GetHit`=`1`; `ResultFlags`=`4`; `HitShift`=`8`.


Component **freezingarrowexp2** (Missiles ID 89): `pSrvDoFunc`=`1`; `Range`=`16`; `CollideKill`=`1`; `LastCollide`=`1`; `Size`=`1`; `GetHit`=`1`; `ResultFlags`=`4`; `HitShift`=`8`.




#### Blizzard — ID 59


| Property | Value |
| --- | --- |
| Tree | Cold Spells |
| Required character level | 24 |
| Immediate prerequisites | Frost Nova, Glacial Spike |
| All upstream prerequisites | Frost Nova, Ice Bolt, Ice Blast, Glacial Spike |
| Type | active |
| Internal data name | `Blizzard` |
| Mana | `max(1, (23 + 1×(L−1))×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |
| Shared casting delay | 45 frames = 1.8 seconds |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / cold (raw) | 45–75 | 15–16 | 30–31 | 45–46 | 55–56 | 65–66 |
| E / cold (HP equivalent / see channel role; ×1) | 45–75 | 15–16 | 30–31 | 45–46 | 55–56 | 65–66 |
| E / cold unsynergized L20 | 570–619 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 7 | radius |
| par3 | 4 | Missile delay |
| par4 | 0 | Change duration in Missiles.xls |
| par8 | 5 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| calc1 — radius | `par1` |
| calc2 — frequency | `par3` |
| EDmgSymPerCalc | `(skill('Ice Bolt'.blvl)+skill('Ice Blast'.blvl)+skill('Glacial Spike'.blvl))*par8` |
| E length: frames, L1; increments L2–8 / L9–16 / L17+ | `100; 0 / 0 / 0` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Ice Bolt / Cold Damage per Level | `par8` | — |
| Ice Blast / Cold Damage per Level | `par8` | — |
| Glacial Spike / Cold Damage per Level | `par8` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Blizzard Receives Bonuses From
- Ice Bolt: +5% Cold Damage Per Level
- Ice Blast: +5% Cold Damage Per Level
- Glacial Spike: +5% Cold Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Mana Cost | L1–20: `23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42` |
| Damage per Second | L1–20: `51-86, 69-104, 86-123, 103-141, 120-159, 138-178, 155-196, 172-215, 207-250, 241-286, 276-322, 310-357, 345-393, 379-428, 414-464, 448-500, 500-553, 552-606, 603-658, 655-711` |
| Constant / source label | Duration: 4 Seconds |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **blizzardcenter** (Missiles ID 158): `pSrvDoFunc`=`10`; `Range`=`100`; `LastCollide`=`1`; `Size`=`1`; `HitShift`=`8`; `SubMissile1`=`blizzard1`.


Component **blizzard1** (Missiles ID 159): `pSrvDoFunc`=`3`; `Range`=`9`; `CollideType`=`3`; `LastCollide`=`1`; `Size`=`2`; `GetHit`=`1`; `Skill`=`Blizzard`; `ResultFlags`=`4`.


Component **blizzardexplode1** (Missiles ID 163): `pSrvDoFunc`=`1`; `Range`=`6`; `CollideKill`=`1`; `LastCollide`=`1`; `Size`=`1`; `GetHit`=`1`; `ResultFlags`=`4`; `HitShift`=`8`.


Component **blizzardexplode3** (Missiles ID 165): `pSrvDoFunc`=`1`; `Range`=`6`; `CollideKill`=`1`; `LastCollide`=`1`; `Size`=`1`; `GetHit`=`1`; `ResultFlags`=`4`; `HitShift`=`8`.


Component **blizzard4** (Missiles ID 162): `pSrvDoFunc`=`3`; `Range`=`9`; `CollideType`=`3`; `LastCollide`=`1`; `Size`=`2`; `GetHit`=`1`; `Skill`=`Blizzard`; `ResultFlags`=`4`.




#### Chilling Armor — ID 60


| Property | Value |
| --- | --- |
| Tree | Cold Spells |
| Required character level | 24 |
| Immediate prerequisites | Shiver Armor |
| All upstream prerequisites | Ice Bolt, Ice Blast, Frozen Armor, Shiver Armor |
| Type | active |
| Internal data name | `Chilling Armor` |
| Mana | `max(1, (17)×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / cold (raw) | 8–12 | 2–3 | 4–5 | 6–7 | 8–9 | 10–11 |
| E / cold (HP equivalent / see channel role; ×0.5) | 4–6 | 1–1.5 | 2–2.5 | 3–3.5 | 4–4.5 | 5–5.5 |
| E / cold unsynergized L20 | 39–50.5 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 45 | % AC Bonus |
| par2 | 5 | % AC bonus per level |
| par3 | 3600 | duration |
| par4 | 150 | duration per level |
| par7 | 250 | duration synergy |
| par8 | 7 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurastat1: skill_armor_percent | `ln12` |
| auralencalc | `ln34+(skill('Frozen Armor'.blvl)+skill('Shiver Armor'.blvl))*par7` |
| EDmgSymPerCalc | `(skill('Frozen Armor'.blvl)+skill('Shiver Armor'.blvl))*par8` |
| E length: frames, L1; increments L2–8 / L9–16 / L17+ | `100; 0 / 25 / 25` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Duration: | `ln34+(skill('Frozen Armor'.blvl)+skill('Shiver Armor'.blvl))*par7` | — |
| Defense Bonus: / percent | `ln12` | — |
| Frozen Armor / Seconds per Level | `(par7 + 12)/25` | — |
| Frozen Armor / Cold Damage per Level | `par8` | — |
| Shiver Armor / Seconds per Level | `(par7 + 12)/25` | — |
| Shiver Armor / Cold Damage per Level | `par8` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Chilling Armor Receives Bonuses From
- Frozen Armor: +10 Seconds Per Level
- Frozen Armor: +7% Cold Damage Per Level
- Shiver Armor: +10 Seconds Per Level
- Shiver Armor: +7% Cold Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 17 |
| Defense Bonus % | L1–20: `45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120, 125, 130, 135, 140` |
| Damage | L1–20: `4-6, 5-8, 6-10, 7-11, 9-13, 10-15, 11-17, 12-18, 14-21, 17-24, 19-27, 21-30, 22-33, 26-35, 28-38, 30-41, 34-45, 37-49, 41-53, 44-57` |
| Duration (seconds) | L1–20: `164, 170, 176, 182, 188, 194, 200, 206, 212, 218, 224, 230, 236, 242, 248, 254, 260, 266, 272, 278` |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **chillingarmorbolt** (Missiles ID 264): `pSrvDoFunc`=`1`; `Vel`=`18`; `MaxVel`=`18`; `Range`=`25`; `CollideType`=`3`; `CollideKill`=`1`; `LastCollide`=`1`; `Size`=`1`; `GetHit`=`1`; `Skill`=`Chilling Armor`; `ResultFlags`=`4`; `HitShift`=`8`.




#### Frozen Orb — ID 64


| Property | Value |
| --- | --- |
| Tree | Cold Spells |
| Required character level | 30 |
| Immediate prerequisites | Blizzard |
| All upstream prerequisites | Frost Nova, Ice Bolt, Ice Blast, Glacial Spike, Blizzard |
| Type | active |
| Internal data name | `Frozen Orb` |
| Mana | `max(1, (50 + 1×(L−1))×0.5)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |
| Shared casting delay | 25 frames = 1 seconds |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / cold (raw) | 80–90 | 20–21 | 24–25 | 28–29 | 29–30 | 30–31 |
| E / cold (HP equivalent / see channel role; ×0.5) | 40–45 | 10–10.5 | 12–12.5 | 14–14.5 | 14.5–15 | 15–15.5 |
| E / cold unsynergized L20 | 262–276.5 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par8 | 2 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| EDmgSymPerCalc | `(skill('Ice Bolt'.blvl))*par8` |
| E length: frames, L1; increments L2–8 / L9–16 / L17+ | `200; 25 / 25 / 25` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Ice Bolt / Cold Damage per Level | `par8` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Frozen Orb Receives Bonuses From
- Ice Bolt: +2% Cold Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Mana Cost | L1–20: `25, 25, 26, 26, 27, 27, 28, 28, 29, 29, 30, 30, 31, 31, 32, 32, 33, 33, 34, 34` |
| Cold Damage | L1–20: `40-45, 50-55, 60-65, 70-75, 80-85, 90-95, 100-105, 110-115, 122-127, 134-139, 146-151, 158-163, 170-175, 182-187, 194-199, 206-211, 220-225, 234-239, 248-253, 262-267` |
| Cold Length (seconds) | L1–20: `8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27` |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **frozenorb** (Missiles ID 260): `pSrvDoFunc`=`15`; `pSrvHitFunc`=`29`; `Param1`=`1`; `Param2`=`19`; `sHitPar1`=`4`; `Vel`=`10`; `MaxVel`=`10`; `Range`=`30`; `CollideType`=`3`; `LastCollide`=`1`; `Size`=`1`; `GetHit`=`1`; `ResultFlags`=`4`; `HitShift`=`8`; `SubMissile1`=`frozenorbbolt`; `HitSubMissile1`=`frozenorbnova`.


Component **frozenorbbolt** (Missiles ID 261): `pSrvDoFunc`=`1`; `Vel`=`18`; `MaxVel`=`18`; `Range`=`25`; `CollideType`=`3`; `CollideKill`=`1`; `LastCollide`=`1`; `Size`=`1`; `GetHit`=`1`; `Skill`=`Frozen Orb`; `ResultFlags`=`4`; `HitShift`=`8`.


Component **frozenorbnova** (Missiles ID 262): `pSrvDoFunc`=`16`; `Param1`=`6`; `Param2`=`2`; `Vel`=`24`; `MaxVel`=`24`; `Range`=`25`; `CollideType`=`3`; `CollideKill`=`1`; `LastCollide`=`1`; `Size`=`1`; `GetHit`=`1`; `Skill`=`Frozen Orb`; `ResultFlags`=`4`; `HitShift`=`8`.




#### Cold Mastery — ID 65


| Property | Value |
| --- | --- |
| Tree | Cold Spells |
| Required character level | 30 |
| Immediate prerequisites | None |
| All upstream prerequisites | None |
| Type | passive |
| Internal data name | `Cold Mastery` |
| Mana | `0` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 20 | lower resist |
| par2 | 5 | lower resist per level |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| passivestat1: passive_cold_pierce | `ln12` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| percent | `ln12` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Enemy Resistance -% | L1–20: `20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115` |


## 4.3. Necromancer

### Curses

Source display tables: [Arreat Summit — Curses](http://classic.battle.net/diablo2exp/skills/necromancer-curses.shtml). Exact fields: pinned Skills.txt / SkillDesc.txt / Missiles.txt listed in §0.


| ID | Skill | Required clvl | Immediate prerequisites | Type | Mana expression |
| --- | --- | --- | --- | --- | --- |
| 66 | Amplify Damage | 1 | None | active | `max(1, (4)×1)` |
| 71 | Dim Vision | 6 | None | active | `max(1, (9)×1)` |
| 72 | Weaken | 6 | Amplify Damage | active | `max(1, (4)×1)` |
| 76 | Iron Maiden | 12 | Amplify Damage | active | `max(1, (5)×1)` |
| 77 | Terror | 12 | Weaken | active | `max(1, (7)×1)` |
| 81 | Confuse | 18 | Dim Vision | active | `max(1, (13)×1)` |
| 82 | Life Tap | 18 | Iron Maiden | active | `max(1, (9)×1)` |
| 86 | Attract | 24 | Confuse | active | `max(1, (17)×1)` |
| 87 | Decrepify | 24 | Terror | active | `max(1, (11)×1)` |
| 91 | Lower Resist | 30 | Life Tap, Decrepify | active | `max(1, (22)×1)` |


#### Amplify Damage — ID 66


| Property | Value |
| --- | --- |
| Tree | Curses |
| Required character level | 1 |
| Immediate prerequisites | None |
| All upstream prerequisites | None |
| Type | active |
| Internal data name | `Amplify Damage` |
| Mana | `max(1, (4)×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |
| aurafilter | `3` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 3 | radius |
| par2 | 1 | radius per level |
| par3 | 200 | duration |
| par4 | 75 | additional duration/level |
| par5 | 100 | % additional damage taken |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurastat1: damageresist | `-par5` |
| aurarangecalc | `ln12` |
| auralencalc | `ln34` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Duration: | `ln34` | — |
| Radius: | `ln12` | — |
| Damage Taken: / percent | `par5` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 4 |
| Radius (yards) | L1–20: `2, 2.6, 3.3, 4, 4.6, 5.3, 6, 6.6, 7.3, 8, 8.6, 9.3, 10, 10.6, 11.3, 12, 12.6, 13.3, 14, 14.6` |
| Duration (seconds) | L1–20: `8, 11, 14, 17, 20, 23, 26, 29, 32, 35, 38, 41, 44, 47, 50, 53, 56, 59, 62, 65` |
| Constant / source label | Damage Taken +100% |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **curseamplifydamage** (Missiles ID 181): `pSrvDoFunc`=`1`; `Range`=`20`; `LastCollide`=`1`; `Size`=`1`; `HitShift`=`8`.


Component **cursecast** (Missiles ID 147): `pSrvDoFunc`=`1`; `Vel`=`3`; `MaxVel`=`5`; `Range`=`20`; `LastCollide`=`1`; `Size`=`1`; `HitShift`=`8`.




#### Dim Vision — ID 71


| Property | Value |
| --- | --- |
| Tree | Curses |
| Required character level | 6 |
| Immediate prerequisites | None |
| All upstream prerequisites | None |
| Type | active |
| Internal data name | `Dim Vision` |
| Mana | `max(1, (9)×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |
| aurafilter | `2` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 4 | radius |
| par2 | 1 | radius per level |
| par3 | 175 | duration |
| par4 | 50 | additional duration/level |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurarangecalc | `ln12` |
| auralencalc | `ln34` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Duration: | `ln34` | — |
| Radius: | `ln12` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 9 |
| Radius (yards) | L1–20: `2.6, 3.3, 4, 4.6, 5.3, 6, 6.6, 7.3, 8, 8.6, 9.3, 10, 10.6, 11.3, 12, 12.6, 13.3, 14, 14.6, 15.3` |
| Duration N (seconds) | L1–20: `7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31, 33, 35, 37, 39, 41, 43, 45` |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **cursedimvision** (Missiles ID 182): `pSrvDoFunc`=`1`; `Range`=`20`; `LastCollide`=`1`; `Size`=`1`; `HitShift`=`8`.


Component **cursecast** (Missiles ID 147): `pSrvDoFunc`=`1`; `Vel`=`3`; `MaxVel`=`5`; `Range`=`20`; `LastCollide`=`1`; `Size`=`1`; `HitShift`=`8`.




#### Weaken — ID 72


| Property | Value |
| --- | --- |
| Tree | Curses |
| Required character level | 6 |
| Immediate prerequisites | Amplify Damage |
| All upstream prerequisites | Amplify Damage |
| Type | active |
| Internal data name | `Weaken` |
| Mana | `max(1, (4)×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |
| aurafilter | `3` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 9 | radius |
| par2 | 1 | radius per level |
| par3 | 350 | duration |
| par4 | 60 | additional duration/level |
| par5 | 33 | % damage target can do |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurastat1: damagepercent | `-par5` |
| aurarangecalc | `ln12` |
| auralencalc | `ln34` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Duration: | `ln34` | — |
| Radius: | `ln12` | — |
| Target's Damage: / percent | `-par5` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 4 |
| Radius (yards) | L1–20: `6, 6.6, 7.3, 8, 8.6, 9.3, 10, 10.6, 11.3, 12, 12.6, 13.3, 14, 14.6, 15.3, 16, 16.6, 17.3, 18, 18.6` |
| Duration (seconds) | L1–20: `14, 16.4, 18.8, 21.2, 23.6, 26, 28.4, 30.8, 33.2, 35.6, 38, 40.4, 42.8, 45.2, 47.6, 50, 52.4, 54.8, 57.2, 59.6` |
| Constant / source label | Target's Damage -33% |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **curseweaken** (Missiles ID 183): `pSrvDoFunc`=`1`; `Range`=`20`; `LastCollide`=`1`; `Size`=`1`; `HitShift`=`8`.


Component **cursecast** (Missiles ID 147): `pSrvDoFunc`=`1`; `Vel`=`3`; `MaxVel`=`5`; `Range`=`20`; `LastCollide`=`1`; `Size`=`1`; `HitShift`=`8`.




#### Iron Maiden — ID 76


| Property | Value |
| --- | --- |
| Tree | Curses |
| Required character level | 12 |
| Immediate prerequisites | Amplify Damage |
| All upstream prerequisites | Amplify Damage |
| Type | active |
| Internal data name | `Iron Maiden` |
| Mana | `max(1, (5)×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |
| aurafilter | `3` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 7 | radius |
| par2 | 0 | radius per level |
| par3 | 300 | duration |
| par4 | 60 | additional duration/level |
| par5 | 200 | % damage returned to accursed |
| par6 | 25 | % additional returned/level |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurarangecalc | `ln12` |
| auralencalc | `ln34` |
| calc1 — % damage to return | `ln56` |
| calc2 — % damage to return vs. players | `ln56/4` |
| calc3 — % damage to return other | `ln56/4` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Radius: | `ln12` | — |
| Duration: | `ln34` | — |
| percent damage returned | `ln56` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 5 |
| % Damage Returned | L1–20: `200, 225, 250, 275, 300, 325, 350, 375, 400, 425, 450, 475, 500, 525, 550, 575, 600, 625, 650, 675` |
| Duration (seconds) | L1–20: `12, 14.4, 16.8, 19.2, 21.6, 24, 26.4, 28.8, 31.2, 33.6, 36, 38.4, 40.8, 43.2, 45.6, 48, 50.4, 52.8, 55.2, 57.6` |
| Constant / source label | Radius (yards): 4.6 |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **curseironmaiden** (Missiles ID 184): `pSrvDoFunc`=`1`; `Range`=`20`; `LastCollide`=`1`; `Size`=`1`; `HitShift`=`8`.


Component **cursecast** (Missiles ID 147): `pSrvDoFunc`=`1`; `Vel`=`3`; `MaxVel`=`5`; `Range`=`20`; `LastCollide`=`1`; `Size`=`1`; `HitShift`=`8`.




#### Terror — ID 77


| Property | Value |
| --- | --- |
| Tree | Curses |
| Required character level | 12 |
| Immediate prerequisites | Weaken |
| All upstream prerequisites | Amplify Damage, Weaken |
| Type | active |
| Internal data name | `Terror` |
| Mana | `max(1, (7)×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |
| aurafilter | `2` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 4 | radius |
| par2 | 0 | radius per level |
| par3 | 200 | duration |
| par4 | 25 | additional duration/level |
| par5 | 24 | Distance to run |
| par6 | 2 | Distance per level |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurarangecalc | `ln12` |
| auralencalc | `ln34` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Duration: | `ln34` | — |
| Radius: | `ln12` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 7 |
| Duration (seconds) | L1–20: `8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27` |
| Constant / source label | Radius (yards): 2.6 |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **curseterror** (Missiles ID 185): `pSrvDoFunc`=`1`; `Range`=`20`; `LastCollide`=`1`; `Size`=`1`; `HitShift`=`8`.


Component **cursecast** (Missiles ID 147): `pSrvDoFunc`=`1`; `Vel`=`3`; `MaxVel`=`5`; `Range`=`20`; `LastCollide`=`1`; `Size`=`1`; `HitShift`=`8`.




#### Confuse — ID 81


| Property | Value |
| --- | --- |
| Tree | Curses |
| Required character level | 18 |
| Immediate prerequisites | Dim Vision |
| All upstream prerequisites | Dim Vision |
| Type | active |
| Internal data name | `Confuse` |
| Mana | `max(1, (13)×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |
| aurafilter | `2` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 6 | radius |
| par2 | 1 | radius per level |
| par3 | 250 | duration |
| par4 | 50 | additional duration/level |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurarangecalc | `ln12` |
| auralencalc | `ln34` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Duration: | `ln34` | — |
| Radius: | `ln12` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 13 |
| Radius (yards) | L1–20: `4, 4.6, 5.3, 6, 6.6, 7.3, 8, 8.6, 9.3, 10, 10.6, 11.3, 12, 12.6, 13.3, 14, 14.6, 15.3, 16, 16.6` |
| Duration (seconds) | L1–20: `10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46, 48` |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **curseconfuse** (Missiles ID 188): `pSrvDoFunc`=`1`; `Range`=`20`; `LastCollide`=`1`; `Size`=`1`; `HitShift`=`8`.


Component **cursecast** (Missiles ID 147): `pSrvDoFunc`=`1`; `Vel`=`3`; `MaxVel`=`5`; `Range`=`20`; `LastCollide`=`1`; `Size`=`1`; `HitShift`=`8`.




#### Life Tap — ID 82


| Property | Value |
| --- | --- |
| Tree | Curses |
| Required character level | 18 |
| Immediate prerequisites | Iron Maiden |
| All upstream prerequisites | Amplify Damage, Iron Maiden |
| Type | active |
| Internal data name | `Life Tap` |
| Mana | `max(1, (9)×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |
| aurafilter | `3` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 4 | radius |
| par2 | 1 | radius per level |
| par3 | 400 | duration |
| par4 | 60 | additional duration/level |
| par5 | 50 | % damage healed |
| par6 | 0 | % additional heal/level |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurarangecalc | `ln12` |
| auralencalc | `ln34` |
| calc1 — hp % returned | `ln56` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Duration: | `ln34` | — |
| Radius: | `ln12` | — |
| Heals: / percent of attack damage | `ln56` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 9 |
| Radius (yards) | L1–20: `2.6, 3.3, 4, 4.6, 5.3, 6, 6.6, 7.3, 8, 8.6, 9.3, 10, 10.6, 11.3, 12, 12.6, 13.3, 14, 14.6, 15.3` |
| Duration (seconds) | L1–20: `16, 18.4, 20.8, 23.2, 25.6, 28, 30.4, 32.8, 35.2, 37.6, 40, 42.4, 44.8, 47.2, 49.6, 52, 54.4, 56.8, 59.2, 61.6` |
| Constant / source label | Attacker gets Healed 50% of Attack Damage |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **cursereversevampire** (Missiles ID 187): `pSrvDoFunc`=`1`; `Range`=`20`; `LastCollide`=`1`; `Size`=`1`; `HitShift`=`8`.


Component **cursecast** (Missiles ID 147): `pSrvDoFunc`=`1`; `Vel`=`3`; `MaxVel`=`5`; `Range`=`20`; `LastCollide`=`1`; `Size`=`1`; `HitShift`=`8`.




#### Attract — ID 86


| Property | Value |
| --- | --- |
| Tree | Curses |
| Required character level | 24 |
| Immediate prerequisites | Confuse |
| All upstream prerequisites | Dim Vision, Confuse |
| Type | active |
| Internal data name | `Attract` |
| Mana | `max(1, (17)×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |
| aurafilter | `2` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 9 | radius |
| par2 | 0 | radius per level |
| par3 | 300 | duration |
| par4 | 90 | additional duration/level |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurarangecalc | `ln12` |
| auralencalc | `ln34` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Duration: | `ln34` | — |
| Radius: | `ln12` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 17 |
| Duration (seconds) | L1–20: `12, 15.6, 19.2, 22.8, 26.4, 30, 33.6, 37.2, 40.8, 44.4, 48, 51.6, 55.2, 58.8, 62.4, 66, 69.6, 73.2, 76.8, 80.4` |
| Constant / source label | Radius (yards): 6 |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **curseattract** (Missiles ID 186): `pSrvDoFunc`=`1`; `Range`=`20`; `LastCollide`=`1`; `Size`=`1`; `HitShift`=`8`.


Component **cursecast** (Missiles ID 147): `pSrvDoFunc`=`1`; `Vel`=`3`; `MaxVel`=`5`; `Range`=`20`; `LastCollide`=`1`; `Size`=`1`; `HitShift`=`8`.




#### Decrepify — ID 87


| Property | Value |
| --- | --- |
| Tree | Curses |
| Required character level | 24 |
| Immediate prerequisites | Terror |
| All upstream prerequisites | Amplify Damage, Weaken, Terror |
| Type | active |
| Internal data name | `Decrepify` |
| Mana | `max(1, (11)×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |
| aurafilter | `3` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 6 | radius |
| par2 | 0 | radius per level |
| par3 | 100 | duration |
| par4 | 15 | additional duration/level |
| par5 | -50 | "% slowed, -dam, -dam resist" |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurastat1: velocitypercent | `par5` |
| aurastat2: damagepercent | `par5` |
| aurastat3: damageresist | `par5` |
| aurastat4: attackrate | `par5` |
| aurarangecalc | `ln12` |
| auralencalc | `ln34` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Duration: | `ln34` | — |
| Radius: | `ln12` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 11 |
| Duration (seconds) | L1–20: `4, 4.6, 5.2, 5.8, 6.4, 7, 7.6, 8.2, 8.8, 9.4, 10, 10.6, 11.2, 11.8, 12.4, 13, 13.6, 14.2, 14.8, 15.4` |
| Constant / source label | Radius 4 (yards) |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **cursedecrepify** (Missiles ID 189): `pSrvDoFunc`=`1`; `Range`=`20`; `LastCollide`=`1`; `Size`=`1`; `HitShift`=`8`.


Component **cursecast** (Missiles ID 147): `pSrvDoFunc`=`1`; `Vel`=`3`; `MaxVel`=`5`; `Range`=`20`; `LastCollide`=`1`; `Size`=`1`; `HitShift`=`8`.




#### Lower Resist — ID 91


| Property | Value |
| --- | --- |
| Tree | Curses |
| Required character level | 30 |
| Immediate prerequisites | Life Tap, Decrepify |
| All upstream prerequisites | Amplify Damage, Iron Maiden, Life Tap, Weaken, Terror, Decrepify |
| Type | active |
| Internal data name | `Lower Resist` |
| Mana | `max(1, (22)×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |
| aurafilter | `3` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 7 | radius |
| par2 | 1 | radius per level |
| par3 | 500 | duration |
| par4 | 50 | additional duration/level |
| par5 | 25 | min % resist lower |
| par6 | 70 | max % resist lower |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurastat1: fireresist | `-dm56` |
| aurastat2: lightresist | `-dm56` |
| aurastat3: coldresist | `-dm56` |
| aurastat4: poisonresist | `-dm56` |
| aurarangecalc | `ln12` |
| auralencalc | `ln34` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Resist All: / percent | `-dm56` | — |
| Duration: | `ln34` | — |
| Radius: | `ln12` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 22 |
| Radius (yards) | L1–20: `4.6, 5.3, 6, 6.6, 7.3, 8, 8.6, 9.3, 10, 10.6, 11.3, 12, 12.6, 13.3, 14, 14.6, 15.3, 16, 16.6, 17.3` |
| Duration (seconds) | L1–20: `20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46, 48, 50, 52, 54, 56, 58` |
| Resist All -% | L1–20: `31, 37, 41, 44, 47, 49, 51, 52, 54, 55, 56, 57, 58, 59, 60, 61, 61, 61, 62, 62` |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **curselowerresist** (Missiles ID 190): `pSrvDoFunc`=`1`; `Range`=`20`; `LastCollide`=`1`; `Size`=`1`; `HitShift`=`8`.


Component **cursecast** (Missiles ID 147): `pSrvDoFunc`=`1`; `Vel`=`3`; `MaxVel`=`5`; `Range`=`20`; `LastCollide`=`1`; `Size`=`1`; `HitShift`=`8`.




### Poison and Bone Spells

Source display tables: [Arreat Summit — Poison and Bone Spells](http://classic.battle.net/diablo2exp/skills/necromancer-poison.shtml). Exact fields: pinned Skills.txt / SkillDesc.txt / Missiles.txt listed in §0.


| ID | Skill | Required clvl | Immediate prerequisites | Type | Mana expression |
| --- | --- | --- | --- | --- | --- |
| 67 | Teeth | 1 | None | active | `max(1, (6 + 1×(L−1))×0.5)` |
| 68 | Bone Armor | 1 | None | active | `max(1, (11 + 1×(L−1))×1)` |
| 73 | Poison Dagger | 6 | None | active | `max(1, (12 + 1×(L−1))×0.25)` |
| 74 | Corpse Explosion | 6 | Teeth | active | `max(1, (15 + 1×(L−1))×1)` |
| 78 | Bone Wall | 12 | Bone Armor | summon / active | `max(1, (17)×1)` |
| 83 | Poison Explosion | 18 | Poison Dagger, Corpse Explosion | active | `max(1, (8)×1)` |
| 84 | Bone Spear | 18 | Corpse Explosion | active | `max(1, (28 + 1×(L−1))×0.25)` |
| 88 | Bone Prison | 24 | Bone Wall, Bone Spear | summon / active | `max(1, (27 − 1×(L−1))×1)` |
| 92 | Poison Nova | 30 | Poison Explosion | active | `max(1, (20)×1)` |
| 93 | Bone Spirit | 30 | Bone Spear | active | `max(1, (24 + 1×(L−1))×0.5)` |


#### Teeth — ID 67


| Property | Value |
| --- | --- |
| Tree | Poison and Bone Spells |
| Required character level | 1 |
| Immediate prerequisites | None |
| All upstream prerequisites | None |
| Type | active |
| Internal data name | `Teeth` |
| Mana | `max(1, (6 + 1×(L−1))×0.5)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / mag (raw) | 4–8 | 2–2 | 2–3 | 3–4 | 4–5 | 5–6 |
| E / mag (HP equivalent / see channel role; ×0.5) | 2–4 | 1–1 | 1–1.5 | 1.5–2 | 2–2.5 | 2.5–3 |
| E / mag unsynergized L20 | 23–31 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 2 | number of missiles |
| par2 | 1 | additional missiles/level |
| par3 | 0 | Acivation frame of teeth |
| par8 | 15 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| calc1 — # missiles | `min(ln12,24)` |
| calc2 — activation frame | `par3` |
| EDmgSymPerCalc | `(skill('Bone Wall'.blvl)+skill('Bone Prison'.blvl)+skill('Bone Spear'.blvl)+skill('Bone Spirit'.blvl))*par8` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| teeth | `min(ln12,24)` | — |
| Bone Wall / Magic Damage per Level | `par8` | — |
| Bone Spear / Magic Damage per Level | `par8` | — |
| Bone Prison / Magic Damage per Level | `par8` | — |
| Bone Spirit / Magic Damage per Level | `par8` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Teeth Receives Bonuses From:
- Bone Wall: +15% Magic Damage Per Level
- Bone Spear: +15% Magic Damage Per Level
- Bone Prison: +15% Magic Damage Per Level
- Bone Spirit: +15% Magic Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Mana Cost | L1–20: `3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12, 12.5` |
| Damage | L1–20: `2-4, 3-5, 4-6, 5-7, 6-8, 7-9, 8-10, 9-11, 10-12, 11-14, 12-15, 13-17, 14-18, 15-20, 16-21, 17-23, 18-25, 20-27, 21-29, 23-31` |
| # of Teeth | L1–20: `2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21` |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **teeth** (Missiles ID 114): `pSrvDoFunc`=`1`; `Vel`=`16`; `MaxVel`=`16`; `Range`=`50`; `CollideType`=`3`; `CollideKill`=`1`; `LastCollide`=`1`; `NextHit`=`1`; `NextDelay`=`4`; `Size`=`1`; `GetHit`=`1`; `Skill`=`Teeth`; `ResultFlags`=`4`.


Component **teethexplode** (Missiles ID 204): `pSrvDoFunc`=`1`; `Range`=`13`.


Component **bonecast** (Missiles ID 218): `Range`=`20`; `HitShift`=`8`.




#### Bone Armor — ID 68


| Property | Value |
| --- | --- |
| Tree | Poison and Bone Spells |
| Required character level | 1 |
| Immediate prerequisites | None |
| All upstream prerequisites | None |
| Type | active |
| Internal data name | `Bone Armor` |
| Mana | `max(1, (11 + 1×(L−1))×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 20 | damage absorbed |
| par2 | 10 | additional absorbed/level |
| par8 | 15 | absorb synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurastat1: bonearmor | `(ln12 + (skill('Bone Wall'.blvl) + skill('Bone Prison'.blvl)) * par8)*256` |
| aurastat2: bonearmormax | `(ln12 + (skill('Bone Wall'.blvl) + skill('Bone Prison'.blvl)) * par8)*256` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Absorbs / damage | `(ln12 + (skill('Bone Wall'.blvl) + skill('Bone Prison'.blvl)) * par8)` | — |
| Bone Wall / Damage Absorbed per Level | `par8` | — |
| Bone Prison / Damage Absorbed per Level | `par8` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Bone Armor Receives Bonuses From:
- Bone Wall: +15 Damage Absorbed Per Level
- Bone Prison: +15 Damage Absorbed Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Mana Cost | L1–20: `11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30` |
| Damage Shield | L1–20: `20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 210` |


#### Poison Dagger — ID 73


| Property | Value |
| --- | --- |
| Tree | Poison and Bone Spells |
| Required character level | 6 |
| Immediate prerequisites | None |
| All upstream prerequisites | None |
| Type | active |
| Internal data name | `Poison Dagger` |
| Mana | `max(1, (12 + 1×(L−1))×0.25)` |
| Animation / source-damage field | `A1; SrcDam=128 /128` |
| itypea1 | `knif` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / pois (raw) | 18–40 | 10–10 | 15–15 | 20–20 | 23–23 | 26–26 |
| E / pois (rate HP/frame; ×0.0078125) | 0.140625–0.3125 | 0.078125–0.078125 | 0.1171875–0.1171875 | 0.15625–0.15625 | 0.1796875–0.1796875 | 0.203125–0.203125 |
| E / pois unsynergized L20 | 2.25–2.421875 | — | — | — | — | — |
| Poison total HP, L1 / L20 (no item/synergy) | 7.03125–15.625 / 540–581.25 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par8 | 20 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| EDmgSymPerCalc | `(skill('Poison Explosion'.blvl)+skill('Poison Nova'.blvl))*par8` |
| ToHit (+% AR for usual attacks) | `30 + 20×(L−1)` |
| E length: frames, L1; increments L2–8 / L9–16 / L17+ | `50; 10 / 10 / 10` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Attack: / percent | `toht` | — |
| Poison Explosion / Poison Damage per Level | `par8` | — |
| Poison Nova / Poison Damage per Level | `par8` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Poison Dagger Receives Bonuses From:
- Poison Explosion: +20% Poison Damage Per Level
- Poison Nova: +20% Poison Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Mana Cost | L1–20: `3, 3.2, 3.5, 3.7, 4.0, 4.2, 4.5, 4.7, 5.0, 5.2, 5.5, 5.7, 6.0, 6.2, 6.5, 6.7, 7.0, 7.2, 7.5, 7.7` |
| Poison Damage | L1–20: `7-15, 13-23, 20-32, 30-43, 40-56, 53-70, 67-85, 82-103, 104-126, 129-153, 155-181, 185-212, 216-245, 250-281, 286-319, 325-359, 374-410, 426-464, 481-521, 540-581` |
| Over X sec. | L1–20: `2, 2.4, 2.8, 3.2, 3.6, 4, 4.4, 4.8, 5.2, 5.6, 6, 6.4, 6.8, 7.2, 7.6, 8, 8.4, 8.8, 9.2, 9.6` |
| Attack Rating Bonus % | L1–20: `30, 50, 70, 90, 110, 130, 150, 170, 190, 210, 230, 250, 270, 290, 310, 330, 350, 370, 390, 410` |


#### Corpse Explosion — ID 74


| Property | Value |
| --- | --- |
| Tree | Poison and Bone Spells |
| Required character level | 6 |
| Immediate prerequisites | Teeth |
| All upstream prerequisites | Teeth |
| Type | active |
| Internal data name | `Corpse Explosion` |
| Mana | `max(1, (15 + 1×(L−1))×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 70 | % of base monster HP min damage |
| par2 | 120 | % of base monster HP max damage |
| par3 | 8 | radius (half squares) |
| par4 | 1 | additional radius/level (half squares) |
| par5 | 50 | % damage to do as elemental |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurarangecalc | `ln34` |
| calc1 — % target hp min damage | `par1` |
| calc2 — % target hp max damage | `par2` |
| calc3 — % damage to do as elemental | `par5` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Radius: | `ln34` | — |
| Damage: / percent of corpse Life | `par1` | `par2` |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Mana Cost | L1–20: `15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34` |
| Radius (yards) | L1–20: `2.6, 3, 3.3, 3.6, 4, 4.3, 4.6, 5, 5.3, 5.6, 6, 6.3, 6.6, 7, 7.3, 7.6, 8, 8.3, 8.6, 9` |
| Constant / source label | 70-120% of Corpse Hit Points |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **corpseexplosion** (Missiles ID 115): `pSrvDoFunc`=`1`; `Range`=`13`; `LastCollide`=`1`; `Size`=`1`; `GetHit`=`1`; `Skill`=`Corpse Explosion`; `ResultFlags`=`4`; `HitShift`=`8`; `SubMissile1`=`bigblood1`; `SubMissile2`=`bigblood2`.


Component **bigblood1** (Missiles ID 20): `Vel`=`3`; `MaxVel`=`3`; `Range`=`128`; `CollideKill`=`1`; `LastCollide`=`1`; `Size`=`1`; `HitShift`=`8`.


Component **bigblood2** (Missiles ID 21): `Vel`=`4`; `MaxVel`=`4`; `Range`=`128`; `CollideKill`=`1`; `LastCollide`=`1`; `Size`=`1`; `HitShift`=`8`.


Component **explodingarrowexp** (Missiles ID 42): `Range`=`16`; `CollideKill`=`1`; `LastCollide`=`1`; `Size`=`1`; `GetHit`=`1`; `ResultFlags`=`4`.


Component **redlightmissile** (Missiles ID 151): `pSrvDoFunc`=`1`; `Range`=`10`; `LevRange`=`10`; `LastCollide`=`1`.




#### Bone Wall — ID 78


| Property | Value |
| --- | --- |
| Tree | Poison and Bone Spells |
| Required character level | 12 |
| Immediate prerequisites | Bone Armor |
| All upstream prerequisites | Bone Armor |
| Type | summon / active |
| Internal data name | `Bone Wall` |
| Mana | `max(1, (17)×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |
| summon | `bonewall` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 25 | % additional HP per level |
| par2 | 600 | MAX duration |
| par3 | 8 | Max Monsters per wall |
| par4 | 0 | "Level, max monsters per wall" |
| par8 | 10 | life synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| calc1 — hp % adjustment | `(par1 * (lvl-1)) + ((skill('Bone Armor'.blvl)+skill('Bone Prison'.blvl))*par8)` |
| calc2 — # of walls - 1 | `par34` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Duration: | `par2` | — |
| descline3 (formatter 13) | `(par1 * (lvl-1)) + ((skill('Bone Armor'.blvl)+skill('Bone Prison'.blvl))*par8)` | — |
| Bone Armor / Life per Level | `par8` | — |
| Bone Prison / Life per Level | `par8` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Bone Wall Receives Bonuses From:
- Bone Armor: +10% Life Per Level
- Bone Prison: +10% Life Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 17 |
| Normal Hit Points | L1–20: `20, 25, 30, 35, 39, 44, 49, 54, 58, 63, 68, 73, 77, 82, 87, 92, 96, 101, 106, 111` |
| Constant / source label | Duration (seconds): 24 |


**Summon base monster record** — seed values, NOT the final buffed summon. Apply this skill's HP/damage/AR calculations, mastery, summon level, difficulty and generated equipment; absent difficulty HP fields can be supplied by hardcoded handling.

| MonStats field | Value |
| --- | --- |
| Id | `bonewall` |
| AI | `BoneWall` |
| Level | `7` |
| Level(N) | `40` |
| Level(H) | `73` |
| aidel | `15` |
| aidel(N) | `15` |
| aidel(H) | `15` |
| Skill1 | `Bone Wall` |
| Sk1mode | `NU` |
| ResCo | `70` |
| ResPo | `70` |
| ResCo(N) | `90` |
| ResPo(N) | `200` |
| ResDm(H) | `50` |
| ResCo(H) | `90` |
| ResPo(H) | `200` |
| noRatio | `1` |
| minHP | `19` |
| maxHP | `19` |
| AC | `35` |
| AC(N) | `174` |
| AC(H) | `334` |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **bonewallmaker** (Missiles ID 207): `pSrvDoFunc`=`13`; `Vel`=`12`; `MaxVel`=`12`; `Range`=`7`; `LevRange`=`2`; `CollideType`=`8`; `LastCollide`=`1`; `Size`=`1`; `HitShift`=`8`.




#### Poison Explosion — ID 83


| Property | Value |
| --- | --- |
| Tree | Poison and Bone Spells |
| Required character level | 18 |
| Immediate prerequisites | Poison Dagger, Corpse Explosion |
| All upstream prerequisites | Poison Dagger, Teeth, Corpse Explosion |
| Type | active |
| Internal data name | `Poison Explosion` |
| Mana | `max(1, (8)×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / pois (raw) | 8–24 | 2–2 | 4–4 | 6–6 | 8–8 | 10–10 |
| E / pois (rate HP/frame; ×0.0625) | 0.5–1.5 | 0.125–0.125 | 0.25–0.25 | 0.375–0.375 | 0.5–0.5 | 0.625–0.625 |
| E / pois unsynergized L20 | 4.875–5.875 | — | — | — | — | — |
| Poison total HP, L1 / L20 (no item/synergy) | 25–75 / 1170–1410 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par8 | 15 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurarangecalc | `ln34` |
| EDmgSymPerCalc | `(skill('Poison Dagger'.blvl)+skill('Poison Nova'.blvl))*par8` |
| E length: frames, L1; increments L2–8 / L9–16 / L17+ | `50; 10 / 10 / 10` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Poison Dagger / Poison Damage per Level | `par8` | — |
| Poison Nova / Poison Damage per Level | `par8` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Poison Explosion Receives Bonuses From:
- Poison Dagger: +15% Poison Damage Per Level
- Poison Nova: +15% Poison Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 8 |
| Poison Damage | L1–20: `28-86, 43-112, 60-140, 80-172, 103-206, 129-244, 158-284, 189-327, 242-392, 301-462, 366-539, 436-620, 512-708, 594-801, 682-901, 775-1006, 905-1146, 1043-1295, 1189-1454, 1345-1620` |
| Over X sec. | L1–20: `2, 2.4, 2.8, 3.2, 3.6, 4, 4.4, 4.8, 5.2, 5.6, 6, 6.4, 6.8, 7.2, 7.6, 8, 8.4, 8.8, 9.2, 9.6` |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **poisonexplosioncloud** (Missiles ID 217): `pSrvDoFunc`=`3`; `Param1`=`2`; `Param2`=`4`; `Range`=`60`; `CollideType`=`3`; `LastCollide`=`1`; `Size`=`2`; `Skill`=`Poison Explosion`; `HitShift`=`8`.


Component **poisonpuff** (Missiles ID 141): `pSrvDoFunc`=`1`; `Vel`=`1`; `MaxVel`=`15`; `Range`=`25`; `LastCollide`=`1`; `Size`=`1`; `GetHit`=`1`; `ResultFlags`=`4`; `HitShift`=`8`.


Component **poisoncorpseexplosion** (Missiles ID 116): `pSrvDoFunc`=`1`; `Range`=`13`; `LastCollide`=`1`; `Size`=`1`; `HitShift`=`8`.


Component **greenlightmissile** (Missiles ID 152): `pSrvDoFunc`=`1`; `Range`=`10`; `LevRange`=`10`; `LastCollide`=`1`.




#### Bone Spear — ID 84


| Property | Value |
| --- | --- |
| Tree | Poison and Bone Spells |
| Required character level | 18 |
| Immediate prerequisites | Corpse Explosion |
| All upstream prerequisites | Teeth, Corpse Explosion |
| Type | active |
| Internal data name | `Bone Spear` |
| Mana | `max(1, (28 + 1×(L−1))×0.25)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / mag (raw) | 16–24 | 8–8 | 9–9 | 12–13 | 18–19 | 24–25 |
| E / mag (HP equivalent / see channel role; ×1) | 16–24 | 8–8 | 9–9 | 12–13 | 18–19 | 24–25 |
| E / mag unsynergized L20 | 192–204 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par8 | 7 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| EDmgSymPerCalc | `(skill('Bone Wall'.blvl)+skill('Bone Prison'.blvl)+skill('Teeth'.blvl)+skill('Bone Spirit'.blvl))*par8` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Teeth / Magic Damage per Level | `par8` | — |
| Bone Wall / Magic Damage per Level | `par8` | — |
| Bone Prison / Magic Damage per Level | `par8` | — |
| Bone Spirit / Magic Damage per Level | `par8` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Bone Spear Receives Bonuses From:
- Teeth: +7% Magic Damage Per Level
- Bone Wall: +7% Magic Damage Per Level
- Bone Prison: +7% Magic Damage Per Level
- Bone Spirit: +7% Magic Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Mana Cost | L1–20: `7, 7.2, 7.5, 7.7, 8, 8.2, 8.5, 8.7, 9, 9.2, 9.5, 9.7, 10, 10.2, 10.5, 10.7, 11, 11.2, 11.5, 11.7` |
| Damage | L1–20: `17-25, 25-34, 34-42, 42-51, 51-59, 59-68, 68-77, 77-85, 86-95, 96-104, 105-114, 115-124, 125-133, 134-143, 144-153, 154-162, 166-176, 179-190, 192-204, 205-218` |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **bonespear** (Missiles ID 192): `pSrvDoFunc`=`1`; `Vel`=`24`; `MaxVel`=`24`; `Range`=`40`; `CollideType`=`3`; `LastCollide`=`1`; `Size`=`1`; `GetHit`=`1`; `Skill`=`Bone Spear`; `ResultFlags`=`4`; `HitShift`=`8`.


Component **bonespearexplode** (Missiles ID 216): `pSrvDoFunc`=`1`; `Range`=`13`; `HitShift`=`8`.


Component **bonespeartrail** (Missiles ID 248): `Range`=`8`; `HitShift`=`8`.


Component **teethexplode** (Missiles ID 204): `pSrvDoFunc`=`1`; `Range`=`13`.


Component **bonecast** (Missiles ID 218): `Range`=`20`; `HitShift`=`8`.




#### Bone Prison — ID 88


| Property | Value |
| --- | --- |
| Tree | Poison and Bone Spells |
| Required character level | 24 |
| Immediate prerequisites | Bone Wall, Bone Spear |
| All upstream prerequisites | Bone Armor, Bone Wall, Teeth, Corpse Explosion, Bone Spear |
| Type | summon / active |
| Internal data name | `Bone Prison` |
| Mana | `max(1, (27 − 1×(L−1))×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |
| summon | `bonewall` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 25 | % additional HP per level |
| par2 | 600 | MAX duration |
| par8 | 8 | life synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| calc1 — hp % adjustment | `(par1 * (lvl-1)) + ((skill('Bone Armor'.blvl)+skill('Bone Wall'.blvl))*par8)` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Duration: | `par2` | — |
| descline3 (formatter 13) | `(par1 * (lvl-1)) + ((skill('Bone Armor'.blvl)+skill('Bone Wall'.blvl))*par8)` | — |
| Bone Armor / Life per Level | `par8` | — |
| Bone Wall / Life per Level | `par8` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Bone Prison Receives Bonuses From:
- Bone Armor: +8% Life Per Level
- Bone Wall: +8% Life Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Mana Cost | L1–20: `27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8` |
| Normal Hit Points | L1–20: `22, 26, 31, 36, 41, 45, 50, 55, 60, 64, 69, 74, 79, 83, 88, 93, 98, 102, 107, 112` |
| Constant / source label | Duration (seconds): 24 |


**Summon base monster record** — seed values, NOT the final buffed summon. Apply this skill's HP/damage/AR calculations, mastery, summon level, difficulty and generated equipment; absent difficulty HP fields can be supplied by hardcoded handling.

| MonStats field | Value |
| --- | --- |
| Id | `bonewall` |
| AI | `BoneWall` |
| Level | `7` |
| Level(N) | `40` |
| Level(H) | `73` |
| aidel | `15` |
| aidel(N) | `15` |
| aidel(H) | `15` |
| Skill1 | `Bone Wall` |
| Sk1mode | `NU` |
| ResCo | `70` |
| ResPo | `70` |
| ResCo(N) | `90` |
| ResPo(N) | `200` |
| ResDm(H) | `50` |
| ResCo(H) | `90` |
| ResPo(H) | `200` |
| noRatio | `1` |
| minHP | `19` |
| maxHP | `19` |
| AC | `35` |
| AC(N) | `174` |
| AC(H) | `334` |


#### Poison Nova — ID 92


| Property | Value |
| --- | --- |
| Tree | Poison and Bone Spells |
| Required character level | 30 |
| Immediate prerequisites | Poison Explosion |
| All upstream prerequisites | Poison Dagger, Teeth, Corpse Explosion, Poison Explosion |
| Type | active |
| Internal data name | `Poison Nova` |
| Mana | `max(1, (20)×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / pois (raw) | 16–29 | 4–4 | 6–6 | 9–9 | 14–14 | 16–16 |
| E / pois (rate HP/frame; ×0.0625) | 1–1.8125 | 0.25–0.25 | 0.375–0.375 | 0.5625–0.5625 | 0.875–0.875 | 1–1 |
| E / pois unsynergized L20 | 8–8.8125 | — | — | — | — | — |
| Poison total HP, L1 / L20 (no item/synergy) | 50–90.625 / 400–440.625 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par8 | 10 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| EDmgSymPerCalc | `(skill('Poison Dagger'.blvl)+skill('Poison Explosion'.blvl))*par8` |
| E length: frames, L1; increments L2–8 / L9–16 / L17+ | `50; 0 / 0 / 0` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Poison Dagger / Poison Damage per Level | `par8` | — |
| Poison Explosion / Poison Damage per Level | `par8` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Poison Nova Receives Bonuses From:
- Poison Dagger: +10% Poison Damage Per Level
- Poison Explosion: +10% Poison Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 20 |
| Poison Damage | L1–20: `52-93, 67-108, 82-123, 97-138, 112-153, 127-168, 142-183, 157-198, 176-217, 194-236, 213-254, 232-273, 251-292, 269-311, 288-329, 307-348, 337-378, 367-408, 397-438, 427-468` |
| Constant / source label | Over 2 Seconds |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **poisonnova** (Missiles ID 118): `pSrvDoFunc`=`1`; `Vel`=`12`; `MaxVel`=`12`; `Range`=`30`; `CollideType`=`3`; `CollideKill`=`1`; `LastCollide`=`1`; `NextHit`=`1`; `NextDelay`=`4`; `Size`=`1`; `Skill`=`Poison Nova`; `HitShift`=`8`.




#### Bone Spirit — ID 93


| Property | Value |
| --- | --- |
| Tree | Poison and Bone Spells |
| Required character level | 30 |
| Immediate prerequisites | Bone Spear |
| All upstream prerequisites | Teeth, Corpse Explosion, Bone Spear |
| Type | active |
| Internal data name | `Bone Spirit` |
| Mana | `max(1, (24 + 1×(L−1))×0.5)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / mag (raw) | 20–30 | 16–17 | 17–18 | 18–19 | 19–20 | 20–21 |
| E / mag (HP equivalent / see channel role; ×1) | 20–30 | 16–17 | 17–18 | 18–19 | 19–20 | 20–21 |
| E / mag unsynergized L20 | 340–369 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par8 | 6 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| EDmgSymPerCalc | `(skill('Bone Wall'.blvl)+skill('Bone Prison'.blvl)+skill('Teeth'.blvl)+skill('Bone Spear'.blvl))*par8` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Teeth / Magic Damage per Level | `par8` | — |
| Bone Wall / Magic Damage per Level | `par8` | — |
| Bone Spear / Magic Damage per Level | `par8` | — |
| Bone Prison / Magic Damage per Level | `par8` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Bone Spirit Receives Bonuses From:
- Teeth: +6% Magic Damage Per Level
- Bone Wall: +6% Magic Damage Per Level
- Bone Spear: +6% Magic Damage Per Level
- Bone Prison: +6% Magic Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Mana Cost | L1–20: `12, 12.5, 13, 13.5, 14, 14.5, 15, 15.5, 16, 16.5, 17, 17.5, 18, 18.5, 19, 19.5, 20, 20.5, 21, 21.5` |
| Damage | L1–20: `22-33, 40-52, 58-71, 76-90, 94-109, 112-128, 129-147, 147-166, 166-187, 185-207, 204-227, 224-247, 243-267, 262-287, 281-308, 300-328, 320-349, 340-370, 360-392, 380-413` |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **bonespirit** (Missiles ID 193): `pSrvDoFunc`=`7`; `pSrvHitFunc`=`10`; `Param1`=`5`; `Param2`=`15`; `Vel`=`12`; `MaxVel`=`12`; `Range`=`128`; `CollideType`=`3`; `CollideKill`=`1`; `Size`=`1`; `GetHit`=`1`; `Skill`=`Bone Spirit`; `ResultFlags`=`4`; `HitShift`=`8`.


Component **bonespiritexplode** (Missiles ID 327): `pSrvDoFunc`=`1`; `Range`=`12`.




### Summoning Spells

Source display tables: [Arreat Summit — Summoning Spells](http://classic.battle.net/diablo2exp/skills/necromancer-summoning.shtml). Exact fields: pinned Skills.txt / SkillDesc.txt / Missiles.txt listed in §0.


| ID | Skill | Required clvl | Immediate prerequisites | Type | Mana expression |
| --- | --- | --- | --- | --- | --- |
| 69 | Skeleton Mastery | 1 | Raise Skeleton | passive | `0` |
| 70 | Raise Skeleton | 1 | None | summon / active | `max(1, (6 + 1×(L−1))×1)` |
| 75 | Clay Golem | 6 | None | summon / active | `max(1, (15 + 3×(L−1))×1)` |
| 79 | Golem Mastery | 12 | Clay Golem | passive | `0` |
| 80 | Raise Skeletal Mage | 12 | Raise Skeleton | summon / active | `max(1, (8 + 1×(L−1))×1)` |
| 85 | Blood Golem | 18 | Clay Golem | summon / active | `max(1, (25 + 4×(L−1))×1)` |
| 89 | Summon Resist | 24 | Golem Mastery | passive | `0` |
| 90 | Iron Golem | 24 | Blood Golem | summon / active | `max(1, (35)×1)` |
| 94 | Fire Golem | 30 | Iron Golem | summon / active | `max(1, (50 + 10×(L−1))×1)` |
| 95 | Revive | 30 | Raise Skeletal Mage, Iron Golem | summon / active | `max(1, (45)×1)` |


#### Skeleton Mastery — ID 69


| Property | Value |
| --- | --- |
| Tree | Summoning Spells |
| Required character level | 1 |
| Immediate prerequisites | Raise Skeleton |
| All upstream prerequisites | Raise Skeleton |
| Type | passive |
| Internal data name | `Skeleton Mastery` |
| Mana | `0` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 8 | additional hit points/level |
| par2 | 2 | additional damage per level |
| par3 | 5 | hp% per level for revive |
| par4 | 10 | dmg% per level for revive |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Monsters: / Damage: | `lvl*par4` | — |
| Monsters: / Life: | `lvl*par3` | — |
| Magi: / Life: | `lvl*par1` | — |
| Skeletons: / Damage: | `lvl*par2` | — |
| Skeletons: / Life: | `lvl*par1` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Skeleton Life | L1–20: `8, 16, 24, 32, 40, 48, 56, 64, 72, 80, 88, 96, 104, 112, 120, 128, 136, 144, 152, 160` |
| Skeleton Damage | L1–20: `+2, +4, +6, +8, +10, +12, +14, +16, +18, +20, +22, +24, +26, +28, +30, +32, +34, +36, +38, +40` |
| Monster Life +% | L1–20: `5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100` |
| Monster Damage +% | L1–20: `10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200` |
| Constant / source label | Improved Missile Damage past Level 2 |


#### Raise Skeleton — ID 70


| Property | Value |
| --- | --- |
| Tree | Summoning Spells |
| Required character level | 1 |
| Immediate prerequisites | None |
| All upstream prerequisites | None |
| Type | summon / active |
| Internal data name | `Raise Skeleton` |
| Mana | `max(1, (6 + 1×(L−1))×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |
| pettype | `skeleton` |
| summon | `necroskeleton` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / data-channel (healing/stat; not necessarily damage) (raw) | 0–0 | 0–0 | 1–0 | 2–0 | 3–0 | 4–0 |
| E / data-channel (healing/stat; not necessarily damage) (HP equivalent / see channel role; ×1) | 0–0 | 0–0 | 1–0 | 2–0 | 3–0 | 4–0 |
| E / data-channel (healing/stat; not necessarily damage) unsynergized L20 | 16–0 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 5 | % chance of shield |
| par2 | 50 | hp%/lvl |
| par3 | 7 | dmg%/lvl |
| par4 | 15 | to hit/lvl |
| par5 | 15 | ac/lvl |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurastat1: damagepercent | `((lvl < 4) ? 0 : ((lvl-3)*par3))` |
| aurastat2: tohit | `(lvl+skill('Skeleton Mastery'.lvl))*par4` |
| aurastat3: armorclass | `(lvl+skill('Skeleton Mastery'.lvl))*par5` |
| passivestat1: maxhp | `skill('Skeleton Mastery'.lvl) * skill('Skeleton Mastery'.par1) * 256` |
| passivestat2: item_normaldamage | `skill('Skeleton Mastery'.lvl) * skill('Skeleton Mastery'.par2) + edmn` |
| petmax | `(lvl < 4) ?lvl:(2+lvl/3)` |
| calc1 — hp % adjustment | `(lvl < 4) ? 0 : (par2 * (lvl - 3))` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| skeleton total / skeleton magi | `(lvl < 4) ?lvl:(2+lvl/3)` | — |
| descline3 (formatter 13) | `(lvl < 4) ? 0 : (par2 * (lvl - 3))` | `skill('Skeleton Mastery'.lvl) * skill('Skeleton Mastery'.par1)` |
| Defense: | `5+(lvl+skill('Skeleton Mastery'.lvl))*par5` | — |
| Attack: | `5+(lvl+skill('Skeleton Mastery'.lvl))*par4` | — |
| Damage: / percent | `((lvl < 4) ? 0 : ((lvl-3)*par3))` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Raise Skeleton Receives Bonuses From


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| # of Skeletons | L1–20: `1, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6, 7, 7, 7, 8, 8, 8` |
| Mana Cost | L1–20: `6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25` |
| Damage | L1–20: `1 - 2, 1 - 2, 1 - 2, 1 - 2, 1 - 2, 1 - 2, 1 - 2, 2 - 4, 4 - 5, 6 - 7, 8 - 9, 10 - 11, 12 - 14, 14 - 16, 17 - 19, 21 - 23, 26 - 28, 31 - 33, 37 - 39, 37 - 39` |
| Attack Bonus | L1–20: `20, 35, 50, 65, 80, 95, 110, 125, 140, 155, 170, 185, 200, 215, 230, 245, 260, 275, 290, 305` |
| Defense | L1–20: `20, 35, 50, 65, 80, 95, 110, 125, 140, 155, 170, 185, 200, 215, 230, 245, 260, 275, 290, 305` |
| Hit Points | 1 source values: `{[('Skill level'-3)*0.5)+1.0]*'Base Life'} / / Base Life: / Norm: 21 / Nigh: 30 / Hell: 42` |


**Summon base monster record** — seed values, NOT the final buffed summon. Apply this skill's HP/damage/AR calculations, mastery, summon level, difficulty and generated equipment; absent difficulty HP fields can be supplied by hardcoded handling.

| MonStats field | Value |
| --- | --- |
| Id | `necroskeleton` |
| AI | `NecroPet` |
| Velocity | `13` |
| Run | `15` |
| aidel | `15` |
| aidel(N) | `15` |
| aidel(H) | `15` |
| aip1 | `60` |
| aip1(N) | `60` |
| aip1(H) | `60` |
| aip2 | `75` |
| aip2(N) | `75` |
| aip2(H) | `75` |
| aip3 | `15` |
| aip3(N) | `15` |
| aip3(H) | `15` |
| aip4 | `50` |
| aip4(N) | `50` |
| aip4(H) | `50` |
| noRatio | `1` |
| minHP | `21` |
| maxHP | `21` |
| AC | `5` |
| A1MinD | `1` |
| A1MaxD | `2` |
| A1TH | `5` |
| A2MinD | `1` |
| A2MaxD | `2` |
| A2TH | `5` |
| AC(N) | `5` |
| A1MinD(N) | `1` |
| A1MaxD(N) | `2` |
| A1TH(N) | `4` |
| A2MinD(N) | `1` |
| A2MaxD(N) | `2` |
| A2TH(N) | `4` |
| AC(H) | `6` |
| A1MinD(H) | `1` |
| A1MaxD(H) | `2` |
| A1TH(H) | `6` |
| A2MinD(H) | `1` |
| A2MaxD(H) | `2` |
| A2TH(H) | `6` |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **corpseexplosion** (Missiles ID 115): `pSrvDoFunc`=`1`; `Range`=`13`; `LastCollide`=`1`; `Size`=`1`; `GetHit`=`1`; `Skill`=`Corpse Explosion`; `ResultFlags`=`4`; `HitShift`=`8`; `SubMissile1`=`bigblood1`; `SubMissile2`=`bigblood2`.


Component **bigblood1** (Missiles ID 20): `Vel`=`3`; `MaxVel`=`3`; `Range`=`128`; `CollideKill`=`1`; `LastCollide`=`1`; `Size`=`1`; `HitShift`=`8`.


Component **bigblood2** (Missiles ID 21): `Vel`=`4`; `MaxVel`=`4`; `Range`=`128`; `CollideKill`=`1`; `LastCollide`=`1`; `Size`=`1`; `HitShift`=`8`.




#### Clay Golem — ID 75


| Property | Value |
| --- | --- |
| Tree | Summoning Spells |
| Required character level | 6 |
| Immediate prerequisites | None |
| All upstream prerequisites | None |
| Type | summon / active |
| Internal data name | `Clay Golem` |
| Mana | `max(1, (15 + 3×(L−1))×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |
| pettype | `golem` |
| summon | `ClayGolem` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 35 | % HP bonus per level |
| par2 | 35 | % Damage bonus per level |
| par3 | 0 | slow effect min |
| par4 | 75 | slow effect max |
| par8 | 20 | clay golem attack synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurastat1: item_slow | `dm34` |
| passivestat1: velocitypercent | `skill('Golem Mastery'.dm34)` |
| passivestat2: tohit | `skill('Golem Mastery'.ln56) + (lvl*par8)` |
| passivestat3: damagepercent | `par2 * (lvl - 1) + (skill('FireGolem'.blvl)*skill('FireGolem'.par8))` |
| passivestat4: armorclass | `skill('IronGolem'.blvl)*skill('IronGolem'.par8)` |
| petmax | `1` |
| calc1 — hp % adjustment | `(100+(par1 * (lvl - 1)))*(100+skill('Golem Mastery'.ln12) + (skill('BloodGolem'.blvl)*skill('BloodGolem'.par8)))/100-100` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Slows Enemies: / percent | `dm34` | — |
| Attack Bonus: | `lvl*par8` | — |
| descline5 (formatter 13) | `(100+(par1 * (lvl - 1)))*(100+skill('Golem Mastery'.ln12) + (skill('BloodGolem'.blvl)*skill('BloodGolem'.par8)))/100-100` | — |
| Defense: | `100+skill('IronGolem'.lvl)*skill('IronGolem'.par8)` | — |
| Attack: | `40 + skill('Golem Mastery'.ln56) + (lvl*par8)` | — |
| Blood Golem / Life per Level | `skill('BloodGolem'.par8)` | — |
| Iron Golem / Defense per Level | `skill('IronGolem'.par8)` | — |
| Fire Golem / Damage per Level | `skill('FireGolem'.par8)` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Clay Golem Receives Bonuses From
- Blood Golem: +5% Life Per Level
- Iron Golem: +35 Defense Per Level
- Fire Golem: +6% Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Mana Cost | L1–20: `15, 18, 21, 24, 27, 30, 33, 36, 39, 42, 45, 48, 51, 54, 57, 60, 63, 66, 69, 72` |
| Damage | L1–20: `2-5, 2-6, 3-8, 4-10, 4-12, 5-13, 6-15, 6-17, 7-19, 8-20, 9-22, 9-24, 10-26, 11-27, 11-29, 12-31, 13-33, 13-34, 14-36, 15-38` |
| Hit Points | L1–20: `100, 135, 170, 205, 240, 275, 310, 345, 380, 415, 450, 485, 520, 555, 590, 625, 660, 695, 730, 765` |
| Attack Bonus | L1–20: `80, 100, 120, 140, 160, 180, 200, 220, 240, 260, 280, 300, 320, 340, 360, 380, 400, 420, 440, 440` |
| Slows Enemies % | L1–20: `11, 20, 27, 33, 37, 41, 44, 46, 49, 51, 53, 54, 56, 57, 58, 60, 60, 61, 62, 63` |
| Constant / source label | Defense: 20 |


**Summon base monster record** — seed values, NOT the final buffed summon. Apply this skill's HP/damage/AR calculations, mastery, summon level, difficulty and generated equipment; absent difficulty HP fields can be supplied by hardcoded handling.

| MonStats field | Value |
| --- | --- |
| Id | `claygolem` |
| AI | `NecroPet` |
| Velocity | `8` |
| Run | `8` |
| aidel | `15` |
| aidel(N) | `15` |
| aidel(H) | `15` |
| aip1 | `85` |
| aip1(N) | `85` |
| aip1(H) | `85` |
| ResDm | `25` |
| ResLi | `20` |
| ResCo | `50` |
| ResDm(N) | `25` |
| ResLi(N) | `20` |
| ResCo(N) | `50` |
| ResDm(H) | `25` |
| ResLi(H) | `20` |
| ResCo(H) | `50` |
| noRatio | `1` |
| minHP | `100` |
| maxHP | `100` |
| AC | `100` |
| A1MinD | `2` |
| A1MaxD | `5` |
| A1TH | `40` |
| A2MinD | `4` |
| A2MaxD | `7` |
| A2TH | `40` |
| AC(N) | `100` |
| A1MinD(N) | `2` |
| A1MaxD(N) | `6` |
| A1TH(N) | `66` |
| A2MinD(N) | `5` |
| A2MaxD(N) | `10` |
| A2TH(N) | `66` |
| AC(H) | `100` |
| A1MinD(H) | `3` |
| A1MaxD(H) | `7` |
| A1TH(H) | `92` |
| A2MinD(H) | `6` |
| A2MaxD(H) | `11` |
| A2TH(H) | `92` |


#### Golem Mastery — ID 79


| Property | Value |
| --- | --- |
| Tree | Summoning Spells |
| Required character level | 12 |
| Immediate prerequisites | Clay Golem |
| All upstream prerequisites | Clay Golem |
| Type | passive |
| Internal data name | `Golem Mastery` |
| Mana | `0` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 20 | % HP bonus per level |
| par2 | 20 | % HP bonus per level |
| par3 | 0 | min velocity increase |
| par4 | 40 | max velocity increase |
| par5 | 25 | to hit |
| par6 | 25 | to hit/lvl |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Walk/Run Speed: / percent | `dm34` | — |
| Attack Bonus: | `ln56` | — |
| Life: / percent | `lvl*par1` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Hit Points +% | L1–20: `20, 40, 60, 80, 100, 120, 140, 160, 180, 200, 220, 240, 260, 280, 300, 320, 340, 360, 380, 400` |
| Velocity Increase +% | L1–20: `6, 10, 14, 17, 20, 22, 23, 24, 26, 27, 28, 29, 30, 30, 31, 32, 32, 32, 33, 33` |
| Attack Bonus +X | L1–20: `25, 50, 75, 100, 125, 150, 175, 200, 225, 250, 275, 300, 325, 350, 375, 400, 425, 450, 475, 500` |


#### Raise Skeletal Mage — ID 80

**Mage-specific supplemental data** (the Summit heading calls this skill simply “Skeletal Mage”):

| Effect | Exact legacy value / progression |
|---|---|
| Number at L1–20 | 1, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6, 7, 7, 7, 8, 8, 8 |
| Mana | `8+(L−1)`; L20=27 |
| Base life by difficulty (Summit) | Normal 61, Nightmare 88, Hell 123; Skeleton Mastery adds 8 life per effective level; Raise Mage HP bonus is `7×max(L−3,0)%`. Exact additive/multiplicative order is a summon-server-function concern; preserve both terms. |
| Defense added by skill/mastery | `(L + SkeletonMasteryEffectiveLevel)×10`; source UI's isolated bonus is 10…200 at L1…20. |
| Relative missile skill level R | `SkeletonMasteryEffectiveLevel + (L<4 ? 0 : trunc((L−2)/2))`. Thus Mastery20/Mage20 gives R29; Mastery40/Mage40 gives R59. |
| Element selection | Random poison/cold/fire/lightning mage on summoning; cannot select element through skill targeting. |

The following four **Missiles.txt** records, IDs 208–211 (`necromage1…4`), own the elemental damage. Use **R**, not the allocated Raise Mage level, in their brackets. The Summit mage damage table has bracket-boundary errors (e.g. R16) and its poison column prints a raw rate-like number, not integrated poison damage. Prefer these exact records:

| Missile / channel | Raw base min–max at R1 | Δ R2–8 | Δ R9–16 | Δ R17–22 | Δ R23–28 | Δ R29+ | HitShift | R20 unsynergized result |
|---|---|---|---|---|---|---|---:|---|
| necromage1 poison rate | 6–6 | 1–1 | 2–2 | 4–4 | 6–6 | 8–8 | 0 | 45/256 HP per frame; duration 5250f; total 922.8515625 HP before resistance/length reduction |
| necromage2 cold | 1–4 | 1–1 | 2–2 | 3–3 | 4–4 | 5–5 | 8 | 36–39 cold damage; base cold length `25×R` frames |
| necromage3 fire | 2–6 | 2–2 | 3–3 | 5–5 | 7–7 | 9–9 | 8 | 60–64 fire damage |
| necromage4 lightning | 1–7 | 1–3 | 1–5 | 1–8 | 1–11 | 1–14 | 8 | 20–100 lightning damage |

Poison length is `500+250×(R−1)` frames = `20+10×(R−1)` seconds; R1 total poison is `6×500/256 = 11.71875 HP`, **not 6 total HP**. Cold duration follows difficulty/target modifiers. Skeleton Mastery changes R, not a separate % multiplier on these elemental channels. [Source page](http://classic.battle.net/diablo2exp/skills/necromancer-summoning.shtml), pinned Missiles.txt in §0.


| Property | Value |
| --- | --- |
| Tree | Summoning Spells |
| Required character level | 12 |
| Immediate prerequisites | Raise Skeleton |
| All upstream prerequisites | Raise Skeleton |
| Type | summon / active |
| Internal data name | `Raise Skeletal Mage` |
| Mana | `max(1, (8 + 1×(L−1))×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |
| pettype | `skeletonmage` |
| summon | `necromage` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par2 | 7 | hp%/lvl |
| par5 | 10 | ac/lvl |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurastat1: armorclass | `(lvl+skill('Skeleton Mastery'.lvl))*par5` |
| passivestat1: maxhp | `skill('Skeleton Mastery'.lvl) * skill('Skeleton Mastery'.par1) * 256` |
| sumskill1: NecromageMissile | `skill('Skeleton Mastery'.lvl) + ((lvl < 4)?0:((lvl-2)/2))` |
| petmax | `(lvl < 4) ?lvl:(2+lvl/3)` |
| calc1 — hp % adjustment | `(lvl < 4) ? 0 : (par2 * (lvl - 3))` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| skeleton mage / skeleton magi | `(lvl < 4) ?lvl:(2+lvl/3)` | — |
| Defense: | `(lvl+skill('Skeleton Mastery'.lvl))*par5` | — |
| descline4 (formatter 13) | — | `skill('Skeleton Mastery'.lvl) * skill('Skeleton Mastery'.par1)` |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Summon base monster record** — seed values, NOT the final buffed summon. Apply this skill's HP/damage/AR calculations, mastery, summon level, difficulty and generated equipment; absent difficulty HP fields can be supplied by hardcoded handling.

| MonStats field | Value |
| --- | --- |
| Id | `necromage` |
| AI | `NecroPet` |
| Velocity | `12` |
| Run | `14` |
| aidel | `15` |
| aidel(N) | `15` |
| aidel(H) | `15` |
| aip1 | `80` |
| aip1(N) | `80` |
| aip1(H) | `80` |
| aip2 | `75` |
| aip2(N) | `75` |
| aip2(H) | `75` |
| aip3 | `15` |
| aip3(N) | `15` |
| aip3(H) | `15` |
| aip4 | `50` |
| aip4(N) | `50` |
| aip4(H) | `50` |
| Skill1 | `NecromageMissile` |
| Sk1mode | `A1` |
| Sk1lvl | `1` |
| noRatio | `1` |
| minHP | `61` |
| maxHP | `61` |
| AC | `24` |
| A1MinD | `1` |
| A1MaxD | `2` |
| A1TH | `5` |
| A2MinD | `1` |
| A2MaxD | `2` |
| A2TH | `5` |
| AC(N) | `26` |
| A1MinD(N) | `1` |
| A1MaxD(N) | `2` |
| A1TH(N) | `4` |
| A2MinD(N) | `1` |
| A2MaxD(N) | `2` |
| A2TH(N) | `4` |
| AC(H) | `28` |
| A1MinD(H) | `1` |
| A1MaxD(H) | `2` |
| A1TH(H) | `6` |
| A2MinD(H) | `1` |
| A2MaxD(H) | `2` |
| A2TH(H) | `6` |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **corpseexplosion** (Missiles ID 115): `pSrvDoFunc`=`1`; `Range`=`13`; `LastCollide`=`1`; `Size`=`1`; `GetHit`=`1`; `Skill`=`Corpse Explosion`; `ResultFlags`=`4`; `HitShift`=`8`; `SubMissile1`=`bigblood1`; `SubMissile2`=`bigblood2`.


Component **bigblood1** (Missiles ID 20): `Vel`=`3`; `MaxVel`=`3`; `Range`=`128`; `CollideKill`=`1`; `LastCollide`=`1`; `Size`=`1`; `HitShift`=`8`.


Component **bigblood2** (Missiles ID 21): `Vel`=`4`; `MaxVel`=`4`; `Range`=`128`; `CollideKill`=`1`; `LastCollide`=`1`; `Size`=`1`; `HitShift`=`8`.




#### Blood Golem — ID 85


| Property | Value |
| --- | --- |
| Tree | Summoning Spells |
| Required character level | 18 |
| Immediate prerequisites | Clay Golem |
| All upstream prerequisites | Clay Golem |
| Type | summon / active |
| Internal data name | `BloodGolem` |
| Mana | `max(1, (25 + 4×(L−1))×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |
| pettype | `golem` |
| summon | `BloodGolem` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 75 | min % life stolen |
| par2 | 150 | max % life stolen |
| par3 | 30 | % stolen life xfer to caster |
| par4 | 35 | %additional golem damage per level |
| par5 | 0 | % damage on golem xfered to caster |
| par6 | 25 | % caster healing xfered to golem |
| par8 | 5 | blood golem life synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| passivestat1: velocitypercent | `skill('Golem Mastery'.dm34)` |
| passivestat2: tohit | `skill('Golem Mastery'.ln56)+skill('Clay Golem'.blvl)*skill('Clay Golem'.par8)` |
| passivestat3: damagepercent | `par4 * (lvl - 1) + (skill('FireGolem'.blvl)*skill('FireGolem'.par8))` |
| passivestat4: armorclass | `skill('IronGolem'.blvl)*skill('IronGolem'.par8)` |
| petmax | `1` |
| calc1 — hp % adjustment | `skill('Golem Mastery'.ln12)` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Converts / percent damage to life | `dm12` | — |
| Defense: | `120+skill('IronGolem'.lvl)*skill('IronGolem'.par8)` | — |
| Attack: | `60 + skill('Golem Mastery'.ln56)+skill('Clay Golem'.blvl)*skill('Clay Golem'.par8)` | — |
| dsc2line3 (formatter 13) | `skill('Golem Mastery'.ln12)` | — |
| Clay Golem / Attack Rating per Level | `skill('Clay Golem'.par8)` | — |
| Iron Golem / Defense per Level | `skill('IronGolem'.par8)` | — |
| Fire Golem / Damage per Level | `skill('FireGolem'.par8)` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Blood Golem Receives Bonuses From:
- Clay Golem: +20 Attack Rating Per Level
- Iron Golem: +35 Defense Per Level
- Fire Golem: +6% Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Mana Cost | L1–20: `25, 29, 33, 37, 41, 45, 49, 53, 57, 61, 65, 69, 73, 77, 81, 85, 89, 93, 97, 101` |
| Damage | L1–20: `6-16, 8-21, 10-27, 12-32, 14-38, 16-44, 18-49, 20-55, 22-60, 24-66, 27-72, 29-77, 31-83, 33-88, 35-94, 37-100, 39-105, 41-111, 43-116, 45-122` |
| Heal Convert Damage to Life % | L1–20: `86, 95, 102, 108, 112, 116, 119, 121, 124, 126, 128, 129, 131, 132, 133, 135, 135, 136, 137, 138` |
| Constant / source label | Hit Points 201 |
| Constant / source label | Defense: 80 |


**Summon base monster record** — seed values, NOT the final buffed summon. Apply this skill's HP/damage/AR calculations, mastery, summon level, difficulty and generated equipment; absent difficulty HP fields can be supplied by hardcoded handling.

| MonStats field | Value |
| --- | --- |
| Id | `bloodgolem` |
| AI | `NecroPet` |
| Velocity | `9` |
| Run | `9` |
| aidel | `15` |
| aidel(N) | `15` |
| aidel(H) | `15` |
| aip1 | `90` |
| aip1(N) | `90` |
| aip1(H) | `90` |
| Skill1 | `BloodGolem` |
| Sk1mode | `NU` |
| ResMa | `20` |
| ResPo | `20` |
| ResMa(N) | `20` |
| ResPo(N) | `20` |
| ResMa(H) | `20` |
| ResPo(H) | `20` |
| noRatio | `1` |
| minHP | `201` |
| maxHP | `201` |
| AC | `120` |
| A1MinD | `6` |
| A1MaxD | `16` |
| A1TH | `60` |
| A2MinD | `12` |
| A2MaxD | `24` |
| A2TH | `60` |
| AC(N) | `120` |
| A1MinD(N) | `9` |
| A1MaxD(N) | `23` |
| A1TH(N) | `104` |
| A2MinD(N) | `17` |
| A2MaxD(N) | `35` |
| A2TH(N) | `104` |
| AC(H) | `120` |
| A1MinD(H) | `10` |
| A1MaxD(H) | `27` |
| A1TH(H) | `148` |
| A2MinD(H) | `20` |
| A2MaxD(H) | `41` |
| A2TH(H) | `148` |


#### Summon Resist — ID 89


| Property | Value |
| --- | --- |
| Tree | Summoning Spells |
| Required character level | 24 |
| Immediate prerequisites | Golem Mastery |
| All upstream prerequisites | Clay Golem, Golem Mastery |
| Type | passive |
| Internal data name | `Summon Resist` |
| Mana | `0` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 20 | min % resist |
| par2 | 75 | max % resist |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| passivestat1: passive_summon_resist | `dm12` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Resist All: / percent | `dm12` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Resist All % | L1–20: `28, 34, 39, 44, 47, 50, 52, 54, 56, 57, 59, 60, 61, 62, 62, 64, 64, 65, 65, 66` |


#### Iron Golem — ID 90


| Property | Value |
| --- | --- |
| Tree | Summoning Spells |
| Required character level | 24 |
| Immediate prerequisites | Blood Golem |
| All upstream prerequisites | Clay Golem, Blood Golem |
| Type | summon / active |
| Internal data name | `IronGolem` |
| Mana | `max(1, (35)×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |
| pettype | `golem` |
| summon | `IronGolem` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 150 | % thorns damage back (level 2) |
| par2 | 15 | % thorns damage back per level |
| par8 | 35 | iron golem armor synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurastat1: thorns_percent | `ln12` |
| aurastat2: fade | `16` |
| passivestat1: velocitypercent | `skill('Golem Mastery'.dm34)` |
| passivestat2: tohit | `skill('Golem Mastery'.ln56)+skill('Clay Golem'.blvl)*skill('Clay Golem'.par8)` |
| passivestat3: armorclass | `lvl*par8` |
| passivestat4: damagepercent | `(skill('FireGolem'.blvl)*skill('FireGolem'.par8))` |
| petmax | `1` |
| calc1 — hp % adjustment | `skill('Golem Mastery'.ln12) + (skill('BloodGolem'.blvl)*skill('BloodGolem'.par8))` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Defense Bonus: | `lvl*par8` | — |
| percent damage returned | `ln12` | — |
| Defense: | `140+lvl*par8` | — |
| Attack: | `80 + skill('Golem Mastery'.ln56)+skill('Clay Golem'.blvl)*skill('Clay Golem'.par8)` | — |
| dsc2line4 (formatter 13) | `skill('Golem Mastery'.ln12) + (skill('BloodGolem'.blvl)*skill('BloodGolem'.par8))` | — |
| Clay Golem / Attack Rating per Level | `skill('Clay Golem'.par8)` | — |
| Blood Golem / Life per Level | `skill('BloodGolem'.par8)` | — |
| Fire Golem / Damage per Level | `skill('FireGolem'.par8)` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Iron Golem Receives Bonuses From:
- Clay Golem: +20 Attack Rating Per Level
- Blood Golem: +5% Life Per Level
- Fire Golem: +6% Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Thorns % | L1–20: `150, 150, 165, 180, 195, 210, 225, 240, 255, 270, 285, 300, 315, 330, 345, 360, 375, 390, 405, 420` |
| Attack | 1 source values: `100` |
| Defense | L1–20: `190, 225, 260, 295, 330, 365, 400, 435, 470, 505, 540, 575, 610, 645, 680, 715, 750, 785, 820, 855` |
| Defense Bonus | L1–20: `35, 70, 105, 140, 175, 210, 245, 280, 315, 350, 385, 420, 455, 490, 525, 560, 595, 630, 665, 700` |
| Constant / source label | Mana Cost: 35 |
| Constant / source label | Damage: 7-19/11-30/12-33 |
| Constant / source label | Hit Points: 321 |


**Summon base monster record** — seed values, NOT the final buffed summon. Apply this skill's HP/damage/AR calculations, mastery, summon level, difficulty and generated equipment; absent difficulty HP fields can be supplied by hardcoded handling.

| MonStats field | Value |
| --- | --- |
| Id | `irongolem` |
| AI | `NecroPet` |
| Velocity | `9` |
| Run | `9` |
| aidel | `15` |
| aidel(N) | `15` |
| aidel(H) | `15` |
| aip1 | `90` |
| aip1(N) | `90` |
| aip1(H) | `90` |
| ResLi | `50` |
| ResPo | `100` |
| ResLi(N) | `50` |
| ResPo(N) | `100` |
| ResLi(H) | `50` |
| ResPo(H) | `100` |
| noRatio | `1` |
| minHP | `306` |
| maxHP | `306` |
| AC | `140` |
| A1MinD | `7` |
| A1MaxD | `19` |
| A1TH | `80` |
| A2MinD | `15` |
| A2MaxD | `29` |
| A2TH | `80` |
| AC(N) | `140` |
| A1MinD(N) | `11` |
| A1MaxD(N) | `30` |
| A1TH(N) | `138` |
| A2MinD(N) | `23` |
| A2MaxD(N) | `45` |
| A2TH(N) | `138` |
| AC(H) | `140` |
| A1MinD(H) | `12` |
| A1MaxD(H) | `33` |
| A1TH(H) | `197` |
| A2MinD(H) | `25` |
| A2MaxD(H) | `49` |
| A2TH(H) | `197` |


#### Fire Golem — ID 94


| Property | Value |
| --- | --- |
| Tree | Summoning Spells |
| Required character level | 30 |
| Immediate prerequisites | Iron Golem |
| All upstream prerequisites | Clay Golem, Blood Golem, Iron Golem |
| Type | summon / active |
| Internal data name | `FireGolem` |
| Mana | `max(1, (50 + 10×(L−1))×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |
| pettype | `golem` |
| summon | `FireGolem` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / fire (raw) | 10–27 | 9–10 | 10–11 | 11–12 | 12–13 | 13–14 |
| E / fire (HP equivalent / see channel role; ×1) | 10–27 | 9–10 | 10–11 | 11–12 | 12–13 | 13–14 |
| E / fire unsynergized L20 | 197–233 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 25 | min % fire absorbtion |
| par2 | 100 | max % fire absorbtion |
| par3 | 100 | % damage increase |
| par4 | 35 | % damage increase per level |
| par5 | 8 | Holy Fire Aura level |
| par6 | 1 | Plus Holy Fire Aura level |
| par8 | 6 | fire golem damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurastat1: fireresist | `100 - dm12` |
| aurastat2: item_absorbfire_percent | `dm12` |
| aurastat3: firemindam | `edmn` |
| aurastat4: firemaxdam | `edmx` |
| passivestat1: velocitypercent | `skill('Golem Mastery'.dm34)` |
| passivestat2: tohit | `skill('Golem Mastery'.ln56)+skill('Clay Golem'.blvl)*skill('Clay Golem'.par8)` |
| passivestat3: armorclass | `skill('IronGolem'.blvl)*skill('IronGolem'.par8)` |
| sumskill1: holy fire | `min(ln56,30)` |
| petmax | `1` |
| calc1 — hp % adjustment | `skill('Golem Mastery'.ln12) + (skill('BloodGolem'.blvl)*skill('BloodGolem'.par8))` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Holy Fire | `sklvl('Holy Fire'.ln56.edmn)` | `sklvl('Holy Fire'.ln56.edmx)` |
| descline3 (formatter 41) | `edmn+sklvl('Holy Fire'.ln56.edmn)*sklvl('Holy Fire'.ln56.par5)` | `edmx+sklvl('Holy Fire'.ln56.edmx)*sklvl('Holy Fire'.ln56.par5)` |
| Absorbs / percent fire damage | `dm12` | — |
| Defense: | `200+skill('IronGolem'.lvl)*skill('IronGolem'.par8)` | — |
| Attack: | `120 + skill('Golem Mastery'.ln56)+skill('Clay Golem'.blvl)*skill('Clay Golem'.par8)` | — |
| dsc2line3 (formatter 13) | `skill('Golem Mastery'.ln12) + (skill('BloodGolem'.blvl)*skill('BloodGolem'.par8))` | — |
| Clay Golem / Attack Rating per Level | `skill('Clay Golem'.par8)` | — |
| Blood Golem / Life per Level | `skill('BloodGolem'.par8)` | — |
| Iron Golem / Defense per Level | `skill('IronGolem'.par8)` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Fire Golem Receives Bonuses From:
- Clay Golem: +20 Attack Rating Per Level
- Blood Golem: +5% Life Per Level
- Iron Golem: +35 Defense Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Mana Cost | L1–20: `50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 210, 220, 230, 240` |
| Fire Damage | L1–20: `44 - 90, 59 - 106, 74 - 122, 89 - 138, 104 - 154, 119 - 170, 134 - 186, 149 - 202, 165 - 219, 187 - 242, 203 - 259, 225 - 282, 241 - 299, 263 - 322, 279 - 339, 307 - 368, 330 - 392, 359 - 422, 382 - 446, 411 - 476` |
| Holy Fire | L1–20: `4 - 6, 5 - 7, 6 - 8, 7 - 9, 8 - 10, 9 - 11, 10 - 12, 11 - 13, 12 - 14, 14 - 16, 15 - 17, 17 - 19, 18 - 20, 20 - 22, 21 - 23, 24 - 26, 26 - 28, 29 - 31, 31 - 33, 34 - 36` |
| Absorbs Fire Damage to Hit Point % | L1–20: `36, 45, 52, 58, 62, 66, 69, 71, 74, 76, 78, 79, 81, 82, 83, 85, 85, 86, 87, 88` |
| Constant / source label | Hit Points: 328(Norm)/643(Night)/1063(H) |
| Constant / source label | Defense: 235 |
| Constant / source label | Attack Rating: 140 |


**Summon base monster record** — seed values, NOT the final buffed summon. Apply this skill's HP/damage/AR calculations, mastery, summon level, difficulty and generated equipment; absent difficulty HP fields can be supplied by hardcoded handling.

| MonStats field | Value |
| --- | --- |
| Id | `firegolem` |
| AI | `NecroPet` |
| Velocity | `10` |
| Run | `10` |
| aidel | `15` |
| aidel(N) | `15` |
| aidel(H) | `15` |
| aip1 | `90` |
| aip1(N) | `90` |
| aip1(H) | `90` |
| ResFi | `100` |
| ResFi(N) | `100` |
| ResFi(H) | `100` |
| noRatio | `1` |
| minHP | `313` |
| maxHP | `313` |
| AC | `200` |
| A1MinD | `10` |
| A1MaxD | `27` |
| A1TH | `120` |
| A2MinD | `21` |
| A2MaxD | `41` |
| A2TH | `120` |
| AC(N) | `200` |
| A1MinD(N) | `15` |
| A1MaxD(N) | `39` |
| A1TH(N) | `209` |
| A2MinD(N) | `30` |
| A2MaxD(N) | `60` |
| A2TH(N) | `209` |
| AC(H) | `200` |
| A1MinD(H) | `18` |
| A1MaxD(H) | `47` |
| A1TH(H) | `298` |
| A2MinD(H) | `35` |
| A2MaxD(H) | `71` |
| A2TH(H) | `298` |
| El1Mode | `A1` |
| El1Type | `fire` |
| El1Pct | `80` |
| El1MinD | `5` |
| El1MaxD | `10` |
| El1Pct(N) | `80` |
| El1Pct(H) | `80` |


#### Revive — ID 95


| Property | Value |
| --- | --- |
| Tree | Summoning Spells |
| Required character level | 30 |
| Immediate prerequisites | Raise Skeletal Mage, Iron Golem |
| All upstream prerequisites | Raise Skeleton, Raise Skeletal Mage, Clay Golem, Blood Golem, Iron Golem |
| Type | summon / active |
| Internal data name | `Revive` |
| Mana | `max(1, (45)×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |
| pettype | `revive` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 200 | additional hp percent |
| par3 | 4500 | Duration |
| par4 | 0 | additional duration/level |
| par5 | 50 | Velocity bonus for revived |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurastat1: damagepercent | `skill('Skeleton Mastery'.lvl) * skill('Skeleton Mastery'.par4)` |
| passivestat1: velocitypercent | `par5` |
| petmax | `lvl` |
| calc1 — hp % adjustment | `par1+skill('Skeleton Mastery'.lvl) * skill('Skeleton Mastery'.par3)` |
| calc2 — duration | `ln34` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Monsters: | `lvl` | — |
| Damage: / percent | `skill('Skeleton Mastery'.lvl) * skill('Skeleton Mastery'.par4)` | — |
| Life: / percent | `par1 + skill('Skeleton Mastery'.lvl) * skill('Skeleton Mastery'.par3)` | — |
| Duration: | `ln34` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Revive Receives Bonuses From:


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 45 |
| # of Monsters | L1–20: `1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20` |
| Constant / source label | HP (Original Creature +200%) |
| Constant / source label | Duration: 180 Seconds |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **revivemedium** (Missiles ID 269): `Range`=`25`; `HitShift`=`8`.


Component **revivesmall** (Missiles ID 268): `Range`=`25`; `HitShift`=`8`.


Component **revivelarge** (Missiles ID 270): `Range`=`25`; `HitShift`=`8`.




## 4.4. Paladin

### Combat Skills

Source display tables: [Arreat Summit — Combat Skills](http://classic.battle.net/diablo2exp/skills/paladin-combat.shtml). Exact fields: pinned Skills.txt / SkillDesc.txt / Missiles.txt listed in §0.


| ID | Skill | Required clvl | Immediate prerequisites | Type | Mana expression |
| --- | --- | --- | --- | --- | --- |
| 96 | Sacrifice | 1 | None | active | `0` |
| 97 | Smite | 1 | None | active | `max(1, (2)×1)` |
| 101 | Holy Bolt | 6 | None | active | `max(1, (32 + 1×(L−1))×0.0625)` |
| 106 | Zeal | 12 | Sacrifice | active | `max(1, (2)×1)` |
| 107 | Charge | 12 | Smite | active | `max(1, (9)×1)` |
| 111 | Vengeance | 18 | Zeal | active | `max(1, (16 + 1×(L−1))×0.25)` |
| 112 | Blessed Hammer | 18 | Holy Bolt | active | `max(1, (20 + 1×(L−1))×0.25)` |
| 116 | Conversion | 24 | Vengeance | active | `max(1, (4)×1)` |
| 117 | Holy Shield | 24 | Charge, Blessed Hammer | active | `max(1, (35)×1)` |
| 121 | Fist of the Heavens | 30 | Blessed Hammer, Conversion | active | `max(1, (25)×1)` |


#### Sacrifice — ID 96


| Property | Value |
| --- | --- |
| Tree | Combat Skills |
| Required character level | 1 |
| Immediate prerequisites | None |
| All upstream prerequisites | None |
| Type | active |
| Internal data name | `Sacrifice` |
| Mana | `0` |
| Animation / source-damage field | `A1; SrcDam=128 /128` |
| itypea1 | `mele` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 180 | Percent damage |
| par2 | 15 | percent damage per level |
| par3 | 8 | percent damage to self |
| par7 | 5 | damage synergy |
| par8 | 15 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| calc1 — damage % | `ln12+skill('Redemption'.blvl)*par8+skill('Fanaticism'.blvl)*par7` |
| calc2 — damage self % | `par3` |
| ToHit (+% AR for usual attacks) | `20 + 7×(L−1)` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Damage: / percent | `ln12+skill('Redemption'.blvl)*par8+skill('Fanaticism'.blvl)*par7` | — |
| To Attack Rating: / percent | `toht` | — |
| percent / damage to Self | `par3` | — |
| Redemption / Damage per Level | `par8` | — |
| Fanaticism / Damage per Level | `par7` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Sacrifice Receives Bonuses From:
- Redemption: +15% Damage Per Level
- Fanaticism: +5% Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Damage to Self: 8% |
| Attack Rating +% | L1–20: `20, 27, 34, 41, 48, 55, 62, 69, 76, 83, 90, 97, 104, 111, 118, 125, 132, 139, 146, 153` |
| Damage % | L1–20: `180, 195, 210, 225, 240, 255, 270, 285, 300, 315, 330, 345, 360, 375, 390, 405, 420, 435, 450, 465` |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **blood1** (Missiles ID 18): `Vel`=`3`; `MaxVel`=`3`; `Range`=`128`; `CollideKill`=`1`; `LastCollide`=`1`; `Size`=`1`; `HitShift`=`8`.




#### Smite — ID 97


| Property | Value |
| --- | --- |
| Tree | Combat Skills |
| Required character level | 1 |
| Immediate prerequisites | None |
| All upstream prerequisites | None |
| Type | active |
| Internal data name | `Smite` |
| Mana | `max(1, (2)×1)` |
| Animation / source-damage field | `S1; SrcDam=0 /128` |
| itypea1 | `shld` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 15 | Stun Length |
| par2 | 5 | additional frames/level |
| par3 | 15 | Percent bonus damage |
| par4 | 15 | percent damage per level |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| calc1 — damage % | `ln34` |
| calc2 — stunlen | `min(250,ln12)` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Stun Length: | `min(250,ln12)` | — |
| Damage: / percent | `ln34` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 2 |
| Damage +% | L1–20: `15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 195, 210, 225, 240, 255, 270, 285, 300` |
| Stun (seconds) | L1–20: `0.6, 0.8, 1.0, 1.2, 1.4, 1.6, 1.8, 2.0, 2.2, 2.4, 2.6, 2.8, 3.0, 3.2, 3.4, 3.6, 3.8, 4.0, 4.2, 4.4` |


#### Holy Bolt — ID 101


| Property | Value |
| --- | --- |
| Tree | Combat Skills |
| Required character level | 6 |
| Immediate prerequisites | None |
| All upstream prerequisites | None |
| Type | active |
| Internal data name | `Holy Bolt` |
| Mana | `max(1, (32 + 1×(L−1))×0.0625)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / mag (raw) | 8–16 | 8–8 | 10–11 | 13–15 | 16–18 | 20–23 |
| E / mag (HP equivalent / see channel role; ×1) | 8–16 | 8–8 | 10–11 | 13–15 | 16–18 | 20–23 |
| E / mag unsynergized L20 | 196–220 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 1 | min hitpoints healed |
| par2 | 2 | hitpoints healed per level |
| par3 | 6 | max hitpoints healed |
| par4 | 4 | hitpoints healed per level |
| par7 | 15 | heal synergy |
| par8 | 50 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| calc1 — min heal | `ln12 * (100 + skill('Prayer'.blvl) * par7) / 100` |
| calc2 — max heal | `ln34 * (100 + skill('Prayer'.blvl) * par7) / 100` |
| EDmgSymPerCalc | `(skill('Blessed Hammer'.blvl)+skill('Fist of the Heavens'.blvl))*par8` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Heals: | `ln12 * (100 + skill('Prayer'.blvl) * par7) / 100` | `ln34 * (100 + skill('Prayer'.blvl) * par7) / 100` |
| Blessed Hammer / Magic Damage per Level | `par8` | — |
| Fist of the Heavens / Magic Damage per Level | `par8` | — |
| Prayer / Life Healed per Level | `par7` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Holy Bolt Receives Bonuses From
- Blessed Hammer: +50% Magic Damage Per Level
- Fist of the Heavens: +50% Magic Damage Per Level
- Prayer: +15% Life Healed Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Mana Cost | L1–20: `2, 2, 2.1, 2.1, 2.2, 2.3, 2.3, 2.4, 2.5, 2.5, 2.6, 2.6, 2.7, 2.8, 2.8, 2.9, 3, 3, 3.1, 3.1` |
| Magic Damage | L1–20: `8-16, 16-24, 24-32, 32-40, 40-48, 48-56, 56-64, 64-72, 74-83, 84-94, 94-105, 104-116, 114-127, 124-138, 134-149, 144-160, 157-175, 170-190, 183-205, 196-220` |
| Healing | L1–20: `1-6, 3-10, 5-14, 7-18, 9-22, 11-26, 13-30, 15-34, 17-38, 19-42, 21-46, 23-50, 25-54, 27-58, 29-62, 31-66, 33-70, 35-74, 37-78, 39-82` |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **holybolt** (Missiles ID 55): `pSrvDoFunc`=`1`; `pSrvHitFunc`=`7`; `sHitPar1`=`1`; `sHitPar2`=`1`; `Vel`=`20`; `MaxVel`=`20`; `Range`=`50`; `CollideType`=`3`; `CollideKill`=`1`; `LastCollide`=`1`; `Size`=`1`; `GetHit`=`1`; `Skill`=`Holy Bolt`; `ResultFlags`=`4`.


Component **teethexplode** (Missiles ID 204): `pSrvDoFunc`=`1`; `Range`=`13`.




#### Zeal — ID 106


| Property | Value |
| --- | --- |
| Tree | Combat Skills |
| Required character level | 12 |
| Immediate prerequisites | Sacrifice |
| All upstream prerequisites | Sacrifice |
| Type | active |
| Internal data name | `Zeal` |
| Mana | `max(1, (2)×1)` |
| Animation / source-damage field | `A1; SrcDam=128 /128` |
| itypea1 | `mele` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par2 | 100 | % frame rollback |
| par3 | 0 | % damage percent |
| par4 | 6 | damage % per level |
| par5 | 2 | Targets |
| par6 | 5 | Max targets |
| par8 | 12 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| calc1 — max targets | `min((par5 + lvl -1), par6)` |
| calc2 — damage % | `((lvl < 5) ? 0 : ((lvl-4) * par4) )+skill('Sacrifice'.blvl)*par8` |
| ToHit (+% AR for usual attacks) | `10 + 10×(L−1)` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| hits | `min((par5 + lvl -1), par6)` | — |
| Damage: / percent | `((lvl < 5) ? 0 : ((lvl-4) * par4) )+skill('Sacrifice'.blvl)*par8` | — |
| Attack Bonus: / percent | `toht` | — |
| Sacrifice / Damage per Level | `par8` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Zeal Receives Bonuses From:
- Sacrifice: +12% Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 2 |
| Attack +% | L1–20: `10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200` |
| Number of Hits | L1–20: `2, 3, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5` |
| Damage +% | L1–20: `0, 0, 0, 0, 6, 12, 18, 24, 30, 36, 42, 48, 54, 60, 66, 72, 78, 84, 90, 96` |


#### Charge — ID 107


| Property | Value |
| --- | --- |
| Tree | Combat Skills |
| Required character level | 12 |
| Immediate prerequisites | Smite |
| All upstream prerequisites | Smite |
| Type | active |
| Internal data name | `Charge` |
| Mana | `max(1, (9)×1)` |
| Animation / source-damage field | `SQ; SrcDam=128 /128` |
| itypea1 | `mele` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 150 | percent increase in velocity |
| par2 | 0 | ? |
| par3 | 100 | plus % damage |
| par4 | 25 | plus % dam per level |
| par5 | 2 | Trails |
| par6 | 0 | ? |
| par8 | 20 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| calc1 — damage % | `ln34+(skill('Vigor'.blvl)+skill('Might'.blvl))*par8` |
| ToHit (+% AR for usual attacks) | `50 + 15×(L−1)` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Attack: / percent | `toht` | — |
| Damage: / percent | `ln34+(skill('Vigor'.blvl)+skill('Might'.blvl))*par8` | — |
| Vigor / Damage per Level | `par8` | — |
| Might / Damage per Level | `par8` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Charge Receives Bonuses From:
- Vigor: +20% Damage Per Level
- Might: +20% Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 9 |
| Damage +% | L1–20: `100, 125, 150, 175, 200, 225, 250, 275, 300, 325, 350, 375, 400, 425, 450, 475, 500, 525, 550, 575` |
| Attack Mod +% | L1–20: `50, 65, 80, 95, 110, 125, 140, 155, 170, 185, 200, 215, 230, 245, 260, 275, 290, 305, 320, 335` |


#### Vengeance — ID 111


| Property | Value |
| --- | --- |
| Tree | Combat Skills |
| Required character level | 18 |
| Immediate prerequisites | Zeal |
| All upstream prerequisites | Sacrifice, Zeal |
| Type | active |
| Internal data name | `Vengeance` |
| Mana | `max(1, (16 + 1×(L−1))×0.25)` |
| Animation / source-damage field | `A1; SrcDam=128 /128` |
| itypea1 | `mele` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 70 | percent damage |
| par2 | 6 | percent damage per level |
| par3 | 0 | ? |
| par4 | 0 | ? |
| par5 | 0 | ? |
| par6 | 0 | ? |
| par7 | 2 | damage synergy |
| par8 | 10 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| calc1 — fire damage% | `ln12+skill('Resist Fire'.blvl)*par8+skill('Salvation'.blvl)*par7` |
| calc2 — cold damage% | `ln12+skill('Resist Cold'.blvl)*par8+skill('Salvation'.blvl)*par7` |
| calc3 — ltng damage% | `ln12+skill('Resist Lightning'.blvl)*par8+skill('Salvation'.blvl)*par7` |
| ToHit (+% AR for usual attacks) | `20 + 10×(L−1)` |
| E length: frames, L1; increments L2–8 / L9–16 / L17+ | `30; 15 / 15 / 15` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Attack: / percent | `toht` | — |
| Lightning Damage: / percent | `ln12+skill('Resist Lightning'.blvl)*par8+skill('Salvation'.blvl)*par7` | — |
| Cold Damage: / percent | `ln12+skill('Resist Cold'.blvl)*par8+skill('Salvation'.blvl)*par7` | — |
| Fire Damage: / percent | `ln12+skill('Resist Fire'.blvl)*par8+skill('Salvation'.blvl)*par7` | — |
| Attack Bonus: / percent | `ln34` | — |
| Resist Fire / Fire Damage per Level | `par8` | — |
| Resist Cold / Cold Damage per Level | `par8` | — |
| Resist Lightning / Lightning Damage per Level | `par8` | — |
| Salvation / Elemental Damage per Level | `par7` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Vengeance Receives Bonuses From
- Resist Fire: +10% Fire Damage Per Level
- Resist Cold: +10% Cold Damage Per Level
- Resist Lightning: +10% Lightning Damage Per Level
- Salvation: +2% Elemental Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Mana Cost | L1–20: `4, 4.2, 4.5, 4.7, 5, 5.2, 5.5, 5.7, 6, 6.2, 6.5, 6.7, 7, 7.2, 7.5, 7.7, 8, 8.2, 8.5, 8.7` |
| Cold Length | L1–20: `1.2, 1.8, 2.4, 3.0, 3.6, 4.2, 4.8, 5.4, 6.0, 6.6, 7.2, 7.8, 8.4, 9.0, 9.6, 10.2, 10.8, 11.4, 12.0, 12.6` |
| Elem Damage +% | L1–20: `70, 76, 82, 88, 94, 100, 106, 112, 118, 124, 130, 136, 142, 148, 154, 160, 166, 172, 178, 184` |
| Attack Bonus +% | L1–20: `20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 210` |


#### Blessed Hammer — ID 112


| Property | Value |
| --- | --- |
| Tree | Combat Skills |
| Required character level | 18 |
| Immediate prerequisites | Holy Bolt |
| All upstream prerequisites | Holy Bolt |
| Type | active |
| Internal data name | `Blessed Hammer` |
| Mana | `max(1, (20 + 1×(L−1))×0.25)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / mag (raw) | 12–16 | 8–8 | 10–10 | 12–12 | 13–13 | 14–14 |
| E / mag (HP equivalent / see channel role; ×1) | 12–16 | 8–8 | 10–10 | 12–12 | 13–13 | 14–14 |
| E / mag unsynergized L20 | 196–200 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 4 | Concentration influence in 8ths |
| par2 | 0 | ? |
| par3 | 0 | ? |
| par4 | 0 | ? |
| par5 | 0 | ? |
| par6 | 0 | ? |
| par8 | 14 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| EDmgSymPerCalc | `(skill('Vigor'.blvl)+skill('Blessed Aim'.blvl))*par8` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Blessed Aim / Magic Damage per Level | `par8` | — |
| Vigor / Magic Damage per Level | `par8` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Blessed Hammer Receives Bonuses From:
- Blessed Aim: +14% Magic Damage Per Level
- Vigor: +14% Magic Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Mana Cost | L1–20: `5, 5.2, 5.5, 5.7, 6, 6.2, 6.5, 6.7, 7, 7.2, 7.5, 7.7, 8, 8.2, 8.5, 8.7, 9, 9.2, 9.5, 9.7` |
| Damage | L1–20: `12-16, 20-24, 28-32, 36-40, 44-48, 52-56, 60-64, 68-72, 78-82, 88-92, 98-102, 108-112, 118-122, 128-132, 138-142, 148-152, 160-164, 172-176, 184-188, 196-200` |
| Constant / source label | 150% Damage To Undead |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **blessedhammer** (Missiles ID 92): `pSrvDoFunc`=`1`; `pSrvDmgFunc`=`5`; `dParam1`=`50`; `dParam2`=`50`; `Vel`=`18`; `MaxVel`=`30`; `Range`=`120`; `CollideType`=`3`; `LastCollide`=`1`; `Size`=`1`; `GetHit`=`1`; `Skill`=`Blessed Hammer`; `ResultFlags`=`4`; `EType`=`mag`.




#### Conversion — ID 116


| Property | Value |
| --- | --- |
| Tree | Combat Skills |
| Required character level | 24 |
| Immediate prerequisites | Vengeance |
| All upstream prerequisites | Sacrifice, Zeal, Vengeance |
| Type | active |
| Internal data name | `Conversion` |
| Mana | `max(1, (4)×1)` |
| Animation / source-damage field | `A1; SrcDam=128 /128` |
| itypea1 | `mele` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 400 | duration of conversion (frames) |
| par2 | 0 | additional frames/level |
| par3 | 0 | min % chance convert |
| par4 | 50 | max % chance convert |
| par5 | 0 | ? |
| par6 | 0 | ? |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| auralencalc | `ln12` |
| calc1 — chance to convert | `dm34` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Duration: | `ln12` | — |
| Chance to convert: / percent | `dm34` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 4 |
| Chance to Convert % | L1–20: `7, 13, 18, 22, 25, 27, 29, 31, 33, 34, 35, 36, 37, 38, 39, 40, 40, 41, 41, 42` |
| Constant / source label | Duration 16 Seconds |


#### Holy Shield — ID 117


| Property | Value |
| --- | --- |
| Tree | Combat Skills |
| Required character level | 24 |
| Immediate prerequisites | Charge, Blessed Hammer |
| All upstream prerequisites | Smite, Charge, Holy Bolt, Blessed Hammer |
| Type | active |
| Internal data name | `Holy Shield` |
| Mana | `max(1, (35)×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |
| itypea1 | `shld` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| Physical (raw) | 3–6 | 2–2 | 3–3 | 4–4 | 4–4 | 4–4 |
| Physical (HP equivalent / see channel role; ×1) | 3–6 | 2–2 | 3–3 | 4–4 | 4–4 | 4–4 |
| Physical unsynergized L20 | 57–60 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 750 | duration of shield |
| par2 | 625 | duration/level |
| par3 | 25 | AC bonus |
| par4 | 15 | AC bonus per level |
| par5 | 10 | min % ToBlock Add |
| par6 | 40 | max % ToBlockAdd |
| par8 | 15 | armor synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurastat1: toblock | `dm56` |
| aurastat2: — | `ln34+skill('Defiance'.blvl)*par8` |
| auralencalc | `ln12` |
| calc1 — ac bonus to shield | `ln34+skill('Defiance'.blvl)*par8` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Successful Blocking: / percent | `dm56` | — |
| Defense Bonus: / percent | `ln34+skill('Defiance'.blvl)*par8` | — |
| Duration: | `ln12` | — |
| Defiance / Defense per Level | `par8` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Holy Shield Receives Bonuses From
- Defiance: +15% Defense Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 35 |
| Duration (seconds) | L1–20: `30, 55, 80, 105, 130, 155, 180, 205, 230, 255, 280, 305, 330, 355, 380, 405, 430, 455, 480, 505` |
| Defense +% | L1–20: `25, 40, 55, 70, 85, 100, 115, 130, 145, 160, 175, 190, 205, 220, 235, 250, 265, 280, 295, 310` |
| Successful Blocking +% | L1–20: `14, 18, 20, 23, 25, 26, 27, 28, 29, 30, 31, 31, 32, 33, 33, 34, 34, 34, 34, 35` |
| Smite Damage + | L1–20: `3-6, 5-8, 7-10, 9-12, 11-14, 13-16, 15-18, 17-20, 20-23, 23-26, 26-29, 29-32, 32-35, 35-38, 38-41, 41-44, 45-48, 49-52, 53-56, 57-60` |


#### Fist of the Heavens — ID 121


| Property | Value |
| --- | --- |
| Tree | Combat Skills |
| Required character level | 30 |
| Immediate prerequisites | Blessed Hammer, Conversion |
| All upstream prerequisites | Holy Bolt, Blessed Hammer, Sacrifice, Zeal, Vengeance, Conversion |
| Type | active |
| Internal data name | `Fist of the Heavens` |
| Mana | `max(1, (25)×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |
| Shared casting delay | 25 frames = 1 seconds |
| aurafilter | `42375` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / ltng (raw) | 150–200 | 15–15 | 30–30 | 45–45 | 55–55 | 65–65 |
| E / ltng (HP equivalent / see channel role; ×1) | 150–200 | 15–15 | 30–30 | 45–45 | 55–55 | 65–65 |
| E / ltng unsynergized L20 | 675–725 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 6 | holy bolts to release |
| par2 | 1 | holy bolts per level |
| par3 | 1 | min hitpoints healed |
| par4 | 2 | hitpoints healed per level |
| par5 | 6 | max hitpoints healed |
| par6 | 2 | hitpoints healed per level |
| par8 | 7 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurarangecalc | `20` |
| calc1 — min heal | `ln34` |
| calc2 — max heal | `ln56` |
| calc4 — # bolts | `ln12` |
| EDmgSymPerCalc | `skill('Holy Shock'.blvl)*par8` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Holy Bolt / Holy Bolt Damage per Level | `15` | — |
| Holy Shock / Lightning Damage per Level | `par8` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Fist of the Heavens Receives Bonuses From
- Holy Bolt: +15% Holy Bolt Damage Per Level
- Holy Shock: +7% Lightning Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 25 |
| Lightning Damage | L1–20: `150-200, 165-215, 180-230, 195-245, 210-260, 225-275, 240-290, 255-305, 285-335, 315-365, 345-395, 375-425, 405-455, 435-485, 465-515, 495-545, 540-590, 585-635, 630-680, 675-725` |
| Holy Bolt Damage | L1–20: `40-50, 46-56, 52-62, 58-68, 64-74, 70-80, 76-86, 82-92, 92-102, 102-112, 112-122, 122-132, 132-142, 142-152, 152-162, 162-172, 178-188, 194-204, 210-220, 226-236` |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **fistoftheheavensdelay** (Missiles ID 233): `pSrvDoFunc`=`1`; `pSrvHitFunc`=`22`; `Range`=`10`; `GetHit`=`1`; `Skill`=`Fist of the Heavens`; `ResultFlags`=`4`; `HitShift`=`8`; `HitSubMissile1`=`fistoftheheavensbolt`.


Component **fistoftheheavensbolt** (Missiles ID 234): `pSrvDoFunc`=`1`; `pSrvHitFunc`=`7`; `sHitPar1`=`1`; `sHitPar2`=`1`; `Vel`=`12`; `MaxVel`=`12`; `Range`=`50`; `CollideType`=`3`; `CollideKill`=`1`; `LastCollide`=`1`; `NextDelay`=`4`; `Size`=`1`; `GetHit`=`1`; `ResultFlags`=`4`; `HitShift`=`8`; `EType`=`mag`; `EDmgSymPerCalc`=`skill('Holy Bolt'.blvl) * 15`.


| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / mag (raw) | 40–50 | 6–6 | 10–10 | 16–16 | 32–32 | 48–48 |
| E / mag (HP equivalent / see channel role; ×1) | 40–50 | 6–6 | 10–10 | 16–16 | 32–32 | 48–48 |
| E / mag unsynergized L20 | 226–236 | — | — | — | — | — |


Component **teethexplode** (Missiles ID 204): `pSrvDoFunc`=`1`; `Range`=`13`.




### Offensive Auras

Source display tables: [Arreat Summit — Offensive Auras](http://classic.battle.net/diablo2exp/skills/paladin-offense.shtml). Exact fields: pinned Skills.txt / SkillDesc.txt / Missiles.txt listed in §0.


| ID | Skill | Required clvl | Immediate prerequisites | Type | Mana expression |
| --- | --- | --- | --- | --- | --- |
| 98 | Might | 1 | None | aura | `0` |
| 102 | Holy Fire | 6 | Might | aura | `0` |
| 103 | Thorns | 6 | None | aura | `0` |
| 108 | Blessed Aim | 12 | Might | aura | `0` |
| 113 | Concentration | 18 | Blessed Aim | aura | `0` |
| 114 | Holy Freeze | 18 | Holy Fire | aura | `0` |
| 118 | Holy Shock | 24 | Holy Freeze | aura | `0` |
| 119 | Sanctuary | 24 | Thorns, Holy Freeze | aura | `max(1, (1)×1) per aura debit / 50 frames` |
| 122 | Fanaticism | 30 | Concentration | aura | `0` |
| 123 | Conviction | 30 | Sanctuary | aura | `0` |


#### Might — ID 98


| Property | Value |
| --- | --- |
| Tree | Offensive Auras |
| Required character level | 1 |
| Immediate prerequisites | None |
| All upstream prerequisites | None |
| Type | aura |
| Internal data name | `Might` |
| Mana | `0` |
| Animation / source-damage field | `no active animation; SrcDam=0 /128` |
| perdelay | `50` |
| aurafilter | `73731` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 16 | radius |
| par2 | 2 | additional radius per level |
| par3 | 40 | % additional damage |
| par4 | 10 | % additional damage/level |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurastat1: damagepercent | `ln34` |
| aurarangecalc | `ln12` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Damage: / percent | `ln34` | — |
| Radius: | `ln12` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Radius (yards) | L1–20: `10.6, 12, 13.3, 14.6, 16, 17.3, 18.6, 20, 21.3, 22.6, 24, 25.3, 26.6, 28, 29.3, 30.6, 32, 33.3, 34.6, 36` |
| Damage +% | L1–20: `40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 210, 220, 230` |


#### Holy Fire — ID 102


| Property | Value |
| --- | --- |
| Tree | Offensive Auras |
| Required character level | 6 |
| Immediate prerequisites | Might |
| All upstream prerequisites | Might |
| Type | aura |
| Internal data name | `Holy Fire` |
| Mana | `0` |
| Animation / source-damage field | `no active animation; SrcDam=0 /128` |
| perdelay | `50` |
| aurafilter | `42883` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / fire (raw) | 2–6 | 1–1 | 2–2 | 3–3 | 5–5 | 7–7 |
| E / fire (HP equivalent / see channel role; ×0.5) | 1–3 | 0.5–0.5 | 1–1 | 1.5–1.5 | 2.5–2.5 | 3.5–3.5 |
| E / fire unsynergized L20 | 18.5–20.5 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 6 | radius |
| par2 | 1 | additional radius per level |
| par5 | 6 | damage to attack multiplier |
| par7 | 6 | damage synergy |
| par8 | 18 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| passivestat1: firemindam | `enms*par5/256` |
| passivestat2: firemaxdam | `exms*par5/256` |
| aurarangecalc | `ln12` |
| EDmgSymPerCalc | `skill('Resist Fire'.blvl)*par8+skill('Salvation'.blvl)*par7` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Fire Damage: | `edns` | `edxs` |
| Fire Damage: / to your attack | `edns*par5/256` | `edxs*par5/256` |
| Radius: | `ln12` | — |
| Resist Fire / Fire Damage per Level | `par8` | — |
| Salvation / Fire Damage per Level | `par7` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Holy Fire Receives Bonuses From
- Resist Fire: +18% Fire Damage Per Level
- Salvation: +6% Fire Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Radius (yards) | L1–20: `4, 4.6, 5.3, 6, 6.6, 7.3, 8, 8.6, 9.3, 10, 10.6, 11.3, 12, 12.6, 13.3, 14, 14.6, 15.3, 16, 16.6` |
| Fire Damage | L1–20: `1-3, 1.5-3.5, 2.5-4.5, 3-5, 4-6, 4.5-6.5, 5.5-7.5, 6-8, 7-9, 8.5-10.5, 9-11, 10-12, 11-13, 12-14, 13-15, 14-16, 15-17, 16-18, 17-20, 18-21` |
| Fire Damage Added To Attack | L1–20: `6-18, 10-22, 15-27, 19-31, 24-36, 28-40, 33-45, 37-49, 43-55, 49-61, 55-67, 61-73, 67-79, 73-85, 79-91, 85-97, 91-105, 97-112, 103-120, 109-127` |


#### Thorns — ID 103


| Property | Value |
| --- | --- |
| Tree | Offensive Auras |
| Required character level | 6 |
| Immediate prerequisites | None |
| All upstream prerequisites | None |
| Type | aura |
| Internal data name | `Thorns` |
| Mana | `0` |
| Animation / source-damage field | `no active animation; SrcDam=0 /128` |
| perdelay | `50` |
| aurafilter | `73731` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 16 | radius |
| par2 | 2 | additional radius per level |
| par3 | 250 | % damage bounced back |
| par4 | 40 | % additional bounce back/level |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurastat1: thorns_percent | `ln34` |
| aurarangecalc | `ln12` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| percent damage returned | `ln34` | — |
| Radius: | `ln12` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Radius (yards) | L1–20: `10.6, 12, 13.3, 14.6, 16, 17.3, 18.6, 20, 21.3, 22.6, 24, 25.3, 26.6, 28, 29.3, 30.6, 32, 33.3, 34.6, 36` |
| Damage Return +% | L1–20: `250, 290, 330, 370, 410, 450, 490, 530, 570, 610, 650, 690, 730, 770, 810, 850, 890, 930, 970, 1010` |


#### Blessed Aim — ID 108


| Property | Value |
| --- | --- |
| Tree | Offensive Auras |
| Required character level | 12 |
| Immediate prerequisites | Might |
| All upstream prerequisites | Might |
| Type | aura |
| Internal data name | `Blessed Aim` |
| Mana | `0` |
| Animation / source-damage field | `no active animation; SrcDam=0 /128` |
| perdelay | `50` |
| aurafilter | `73731` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 16 | radius |
| par2 | 2 | additional radius per level |
| par3 | 75 | % attack# bonus |
| par4 | 15 | % additional attack# bonus |
| par5 | 0 | ? |
| par6 | 0 | ? |
| par8 | 5 | passive to hit bonus |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurastat1: item_tohit_percent | `ln34` |
| passivestat1: item_tohit_percent | `skill('Blessed Aim'.blvl) * par8` |
| aurarangecalc | `ln12` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Attack: / percent | `ln34` | — |
| Radius: | `ln12` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Radius (yards) | L1–20: `10.6, 12, 13.3, 14.6, 16, 17.3, 18.6, 20, 21.3, 22.6, 24, 25.3, 26.6, 28, 29.3, 30.6, 32, 33.3, 34.6, 36` |
| Attack +% | L1–20: `75, 90, 105, 120, 135, 150, 165, 180, 195, 210, 225, 240, 255, 270, 285, 300, 315, 330, 345, 360` |


#### Concentration — ID 113


| Property | Value |
| --- | --- |
| Tree | Offensive Auras |
| Required character level | 18 |
| Immediate prerequisites | Blessed Aim |
| All upstream prerequisites | Might, Blessed Aim |
| Type | aura |
| Internal data name | `Concentration` |
| Mana | `0` |
| Animation / source-damage field | `no active animation; SrcDam=0 /128` |
| perdelay | `50` |
| aurafilter | `73731` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 16 | radius |
| par2 | 2 | additional radius per level |
| par3 | 60 | % additional damage |
| par4 | 15 | $ additional damage/level |
| par5 | 20 | percent chance that attack will not be interrupted |
| par6 | 0 | ? |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurastat1: damagepercent | `ln34` |
| aurastat2: skill_concentration | `par5` |
| aurarangecalc | `ln12` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Damage: / percent | `ln34` | — |
| Chance uninterruptable / percent | `par5` | — |
| Radius: | `ln12` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Uninterrupt Chance: 20% |
| Radius (yards) | L1–20: `10.6, 12, 13.3, 14.6, 16, 17.3, 18.6, 20, 21.3, 22.6, 24, 25.3, 26.6, 28, 29.3, 30.6, 32, 33.3, 34.6, 36` |
| Damage +% | L1–20: `60, 75, 90, 105, 120, 135, 150, 165, 180, 195, 210, 225, 240, 255, 270, 285, 300, 315, 330, 345` |


#### Holy Freeze — ID 114


| Property | Value |
| --- | --- |
| Tree | Offensive Auras |
| Required character level | 18 |
| Immediate prerequisites | Holy Fire |
| All upstream prerequisites | Might, Holy Fire |
| Type | aura |
| Internal data name | `Holy Freeze` |
| Mana | `0` |
| Animation / source-damage field | `no active animation; SrcDam=0 /128` |
| perdelay | `50` |
| aurafilter | `303747` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / cold (raw) | 2–3 | 1–1 | 2–2 | 3–3 | 4–4 | 5–5 |
| E / cold (HP equivalent / see channel role; ×1) | 2–3 | 1–1 | 2–2 | 3–3 | 4–4 | 5–5 |
| E / cold unsynergized L20 | 37–38 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 6 | radius |
| par2 | 1 | additional radius per level |
| par3 | 25 | min% slowing |
| par4 | 60 | max% slowing |
| par5 | 5 | damage to attack multiplier |
| par6 | 0 | ? |
| par7 | 7 | damage synergy |
| par8 | 15 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurastat1: velocitypercent | `-dm34` |
| aurastat2: attackrate | `-dm34` |
| aurastat3: other_animrate | `-dm34` |
| passivestat1: coldmindam | `enms*par5/256` |
| passivestat2: coldmaxdam | `exms*par5/256` |
| aurarangecalc | `ln12` |
| EDmgSymPerCalc | `skill('Resist Cold'.blvl)*par8+skill('Salvation'.blvl)*par7` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Enemies slowed / percent | `dm34` | — |
| Cold Damage: / to your attack | `edns*par5/256` | `edxs*par5/256` |
| Radius: | `ln12` | — |
| Resist Cold / Cold Damage per Level | `par8` | — |
| Salvation / Cold Damage per Level | `par7` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Holy Freeze Receives Bonuses From
- Resist Cold: +15% Cold Damage Per Level
- Salvation: +7% Cold Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Radius (yards) | L1–20: `4, 4.6, 5.3, 6, 6.6, 7.3, 8, 8.6, 9.3, 10, 10.6, 11.3, 12, 12.6, 13.3, 14, 14.6, 15.3, 16, 16.6` |
| Slowed By % | L1–20: `30, 34, 37, 40, 42, 44, 45, 46, 48, 48, 49, 50, 51, 51, 52, 53, 53, 53, 54, 54` |
| Cold Damage | L1–20: `2-3, 3-4, 4-5, 5-6, 6-7, 7-8, 8-9, 9-10, 11-12, 13-14, 15-16, 17-18, 19-20, 21-22, 23-24, 25-26, 28-29, 31-32, 34-35, 37-38` |
| Cold Damage +X To Your Attack | L1–20: `10-15, 15-20, 20-25, 25-30, 30-35, 35-40, 40-45, 45-50, 55-60, 65-70, 75-80, 85-90, 95-100, 105-110, 115-120, 125-130, 140-145, 155-160, 170-175, 185-190` |


#### Holy Shock — ID 118


| Property | Value |
| --- | --- |
| Tree | Offensive Auras |
| Required character level | 24 |
| Immediate prerequisites | Holy Freeze |
| All upstream prerequisites | Might, Holy Fire, Holy Freeze |
| Type | aura |
| Internal data name | `Holy Shock` |
| Mana | `0` |
| Animation / source-damage field | `no active animation; SrcDam=0 /128` |
| perdelay | `50` |
| aurafilter | `42883` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / ltng (raw) | 1–10 | 0–6 | 0–8 | 0–10 | 0–12 | 0–15 |
| E / ltng (HP equivalent / see channel role; ×1) | 1–10 | 0–6 | 0–8 | 0–10 | 0–12 | 0–15 |
| E / ltng unsynergized L20 | 1–156 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 6 | radius |
| par2 | 1 | additional radius per level |
| par5 | 6 | damage to attack multiplier |
| par6 | 0 | ? |
| par7 | 4 | damage synergy |
| par8 | 12 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| passivestat1: lightmindam | `1` |
| passivestat2: lightmaxdam | `exms*par5/256` |
| aurarangecalc | `ln12` |
| EDmgSymPerCalc | `skill('Resist Lightning'.blvl)*par8+skill('Salvation'.blvl)*par7` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Lightning Damage: / to your attack | `1` | `edxs*par5/256` |
| Radius: | `ln12` | — |
| Resist Lightning / Lightning Damage per Level | `par8` | — |
| Salvation / Lightning Damage per Level | `par7` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Bonuses To Holy Shock
- Resist Lightning: +12% Lightning Damage Per Level
- Salvation: +4% Lightning Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Radius X Yards | L1–20: `4, 4.6, 5.3, 6, 6.6, 7.3, 8, 8.6, 9.3, 10, 10.6, 11.3, 12, 12.6, 13.3, 14, 14.6, 15.3, 16, 16.6` |
| Lightning Damage Added To Attack | L1–20: `1-60, 1-96, 1-132, 1-168, 1-204, 1-240, 1-276, 1-312, 1-360, 1-408, 1-456, 1-504, 1-552, 1-600, 1-648, 1-696, 1-756, 1-816, 1-876, 1-936` |
| Lightning Damage To Nearby Monsters | L1–20: `1-10, 1-16, 1-22, 1-28, 1-34, 1-40, 1-46, 1-52, 1-60, 1-68, 1-76, 1-84, 1-92, 1-100, 1-108, 1-116, 1-126, 1-136, 1-146, 1-156` |


#### Sanctuary — ID 119


| Property | Value |
| --- | --- |
| Tree | Offensive Auras |
| Required character level | 24 |
| Immediate prerequisites | Thorns, Holy Freeze |
| All upstream prerequisites | Thorns, Might, Holy Fire, Holy Freeze |
| Type | aura |
| Internal data name | `Sanctuary` |
| Mana | `max(1, (1)×1) per aura debit / 50 frames` |
| Animation / source-damage field | `no active animation; SrcDam=0 /128` |
| perdelay | `50` |
| aurafilter | `59270` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / mag (raw) | 8–16 | 4–4 | 4–5 | 5–6 | 5–6 | 6–7 |
| E / mag (HP equivalent / see channel role; ×1) | 8–16 | 4–4 | 4–5 | 5–6 | 5–6 | 6–7 |
| E / mag unsynergized L20 | 88–108 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 5 | radius |
| par2 | 1 | additional radius per level |
| par3 | 150 | % damage to undead |
| par4 | 30 | % damage per level |
| par5 | 100 | att vs. undead |
| par6 | 50 | att vs. undead per level |
| par8 | 7 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurastat1: item_undeaddamage_percent | `ln34` |
| aurastat2: item_undead_tohit | `ln56` |
| aurastat3: skill_bypass_undead | `1` |
| aurarangecalc | `ln12` |
| EDmgSymPerCalc | `skill('Cleansing'.blvl)*par8` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Damage to Undead / percent | `ln34` | — |
| Radius: | `ln12` | — |
| Cleansing / Magic Damage per Level | `par8` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Sanctuary Receives Bonuses From
- Cleansing: +7% Magic Damage Per Level to knockback effect only


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Radius (Yards) | L1–20: `3.3, 4, 4.6, 5.3, 6, 6.6, 7.3, 8, 8.6, 9.3, 10, 10.6, 11.3, 12, 12.6, 13.3, 14, 14.6, 15.3, 16` |
| Magic Damage | L1–20: `8-16, 12-20, 16-24, 20-28, 24-32, 28-36, 32-40, 36-44, 40-49, 44-54, 48-59, 52-64, 56-69, 60-74, 64-79, 68-84, 73-90, 78-96, 83-102, 88-108` |
| Damage +X% To Melee Attacks vs Undead | L1–20: `150, 180, 210, 240, 270, 300, 330, 360, 390, 420, 450, 480, 510, 540, 570, 600, 630, 660, 690, 720` |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **sanctuarybolt** (Missiles ID 57): `pSrvDoFunc`=`1`; `Range`=`14`; `Size`=`1`.




#### Fanaticism — ID 122


| Property | Value |
| --- | --- |
| Tree | Offensive Auras |
| Required character level | 30 |
| Immediate prerequisites | Concentration |
| All upstream prerequisites | Might, Blessed Aim, Concentration |
| Type | aura |
| Internal data name | `Fanaticism` |
| Mana | `0` |
| Animation / source-damage field | `no active animation; SrcDam=0 /128` |
| perdelay | `50` |
| aurafilter | `73731` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 11 | radius |
| par2 | 1 | additional radius per level |
| par3 | 10 | min% boost |
| par4 | 40 | max% boost |
| par5 | 50 | % damage boost |
| par6 | 17 | % damage bonus per level |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurastat1: attackrate | `dm34` |
| aurastat2: item_tohit_percent | `toht` |
| aurastat3: damagepercent | `ln56/2` |
| passivestat1: damagepercent | `ln56` |
| aurarangecalc | `ln12` |
| ToHit (+% AR for usual attacks) | `40 + 5×(L−1)` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Attack: / percent | `toht` | — |
| Attack Speed: / percent | `dm34` | — |
| Your Damage: / percent | `ln56` | — |
| Party Damage: / percent | `ln56/2` | — |
| Radius: | `ln12` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Radius (Yards) | L1–20: `7.3, 8, 8.6, 9.3, 10, 10.6, 11.3, 12, 12.6, 13.3, 14, 14.6, 15.3, 16, 16.6, 17.3, 18, 18.6, 19.3, 20` |
| Party Damage +% | L1–20: `25, 33, 42, 50, 59, 67, 76, 84, 93, 101, 110, 118, 127, 135, 144, 152, 161, 169, 178, 186` |
| Your Damage +% | L1–20: `50, 67, 84, 101, 118, 135, 152, 169, 186, 203, 220, 237, 254, 271, 288, 305, 322, 339, 356, 373` |
| Attack Speed +% | L1–20: `14, 18, 20, 23, 25, 26, 27, 28, 29, 30, 31, 31, 32, 33, 33, 34, 34, 34, 34, 35` |
| Attack +% | L1–20: `40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120, 125, 130, 135` |


#### Conviction — ID 123


| Property | Value |
| --- | --- |
| Tree | Offensive Auras |
| Required character level | 30 |
| Immediate prerequisites | Sanctuary |
| All upstream prerequisites | Thorns, Might, Holy Fire, Holy Freeze, Sanctuary |
| Type | aura |
| Internal data name | `Conviction` |
| Mana | `0` |
| Animation / source-damage field | `no active animation; SrcDam=0 /128` |
| perdelay | `50` |
| aurafilter | `42371` |
| itypea1 | `mele` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 20 | radius |
| par2 | 0 | additional radius per level |
| par3 | 30 | % resist reduction |
| par4 | 5 | % resist reduction per level |
| par5 | 40 | min % AC reduction |
| par6 | 100 | max % AC reduction |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurastat1: skill_armor_percent | `-dm56` |
| aurastat2: fireresist | `-min(ln34,150)` |
| aurastat3: coldresist | `-min(ln34,150)` |
| aurastat4: lightresist | `-min(ln34,150)` |
| aurarangecalc | `ln12` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Resistances: / percent | `-min(ln34,150)` | — |
| Defense: / percent | `-dm56` | — |
| Radius: | `ln12` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Radius 13.3 Yards |
| Defense -% | L1–20: `49, 56, 61, 66, 70, 73, 75, 77, 79, 80, 82, 83, 85, 86, 86, 88, 88, 89, 89, 90` |
| Maximum Resist -% | L1–20: `30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120, 125` |


### Defensive Auras

Source display tables: [Arreat Summit — Defensive Auras](http://classic.battle.net/diablo2exp/skills/paladin-defense.shtml). Exact fields: pinned Skills.txt / SkillDesc.txt / Missiles.txt listed in §0.


| ID | Skill | Required clvl | Immediate prerequisites | Type | Mana expression |
| --- | --- | --- | --- | --- | --- |
| 99 | Prayer | 1 | None | aura | `max(1, (16 + 3×(L−1))×0.0625) per aura debit / 50 frames` |
| 100 | Resist Fire | 1 | None | aura | `0` |
| 104 | Defiance | 6 | None | aura | `0` |
| 105 | Resist Cold | 6 | None | aura | `0` |
| 109 | Cleansing | 12 | Prayer | aura | `0` |
| 110 | Resist Lightning | 12 | None | aura | `0` |
| 115 | Vigor | 18 | Cleansing, Defiance | aura | `0` |
| 120 | Meditation | 24 | Cleansing | aura | `0` |
| 124 | Redemption | 30 | Vigor | aura | `0` |
| 125 | Salvation | 30 | None | aura | `0` |


#### Prayer — ID 99


| Property | Value |
| --- | --- |
| Tree | Defensive Auras |
| Required character level | 1 |
| Immediate prerequisites | None |
| All upstream prerequisites | None |
| Type | aura |
| Internal data name | `Prayer` |
| Mana | `max(1, (16 + 3×(L−1))×0.0625) per aura debit / 50 frames` |
| Animation / source-damage field | `no active animation; SrcDam=0 /128` |
| perdelay | `50` |
| aurafilter | `73731` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / data-channel (healing/stat; not necessarily damage) (raw) | 2–0 | 1–0 | 1–0 | 2–0 | 2–0 | 3–0 |
| E / data-channel (healing/stat; not necessarily damage) (HP equivalent / see channel role; ×1) | 2–0 | 1–0 | 1–0 | 2–0 | 2–0 | 3–0 |
| E / data-channel (healing/stat; not necessarily damage) unsynergized L20 | 25–0 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 16 | radius |
| par2 | 2 | additional radius per level |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurastat1: hitpoints | `edns` |
| aurarangecalc | `ln12` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Heals: | `edmn` | — |
| Radius: | `ln12` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Radius (yards) | L1–20: `10.6, 12, 13.3, 14.6, 16, 17.3, 18.6, 20, 21.3, 22.6, 24, 25.3, 26.6, 28, 29.3, 30.6, 32, 33.3, 34.6, 36` |
| Healing | L1–20: `2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 19, 21, 23, 25` |
| Mana Cost | L1–20: `1, 1.1, 1.3, 1.5, 1.7, 1.9, 2.1, 2.3, 2.5, 2.6, 2.8, 3, 3.2, 3.4, 3.6, 3.8, 4, 4.1, 4.3, 4.5` |


#### Resist Fire — ID 100


| Property | Value |
| --- | --- |
| Tree | Defensive Auras |
| Required character level | 1 |
| Immediate prerequisites | None |
| All upstream prerequisites | None |
| Type | aura |
| Internal data name | `Resist Fire` |
| Mana | `0` |
| Animation / source-damage field | `no active animation; SrcDam=0 /128` |
| perdelay | `50` |
| aurafilter | `73731` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 16 | radius |
| par2 | 2 | additional radius per level |
| par3 | 35 | min % resist |
| par4 | 150 | max % resist |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurastat1: fireresist | `dm34` |
| aurastat2: maxfireresist | `skill('Resist Fire'.blvl)` |
| passivestat1: maxfireresist | `skill('Resist Fire'.blvl)/2` |
| aurarangecalc | `ln12` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Resist Fire: / percent | `dm34` | — |
| Radius: | `ln12` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Radius (yards) | L1–20: `10.6, 12, 13.3, 14.6, 16, 17.3, 18.6, 20, 21.3, 22.6, 24, 25.3, 26.6, 28, 29.3, 30.6, 32, 33.3, 34.6, 36` |
| Resist Fire +% | L1–20: `52, 66, 76, 85, 92, 98, 102, 106, 110, 113, 116, 118, 121, 123, 124, 127, 128, 129, 130, 131` |
| +X% To Maximum Fire Res. | L1–20: `1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20` |


#### Defiance — ID 104


| Property | Value |
| --- | --- |
| Tree | Defensive Auras |
| Required character level | 6 |
| Immediate prerequisites | None |
| All upstream prerequisites | None |
| Type | aura |
| Internal data name | `Defiance` |
| Mana | `0` |
| Animation / source-damage field | `no active animation; SrcDam=0 /128` |
| perdelay | `50` |
| aurafilter | `73731` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 16 | radius |
| par2 | 2 | additional radius per level |
| par3 | 70 | % additional AC |
| par4 | 10 | % additional AC/level |
| par5 | 0 | ? |
| par6 | 0 | ? |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurastat1: skill_armor_percent | `ln34` |
| aurarangecalc | `ln12` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Defense Bonus: / percent | `ln34` | — |
| Radius: | `ln12` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Radius (yards) | L1–20: `10.6, 12, 13.3, 14.6, 16, 17.3, 18.6, 20, 21.3, 22.6, 24, 25.3, 26.6, 28, 29.3, 30.6, 32, 33.3, 34.6, 36` |
| Defense +% | L1–20: `70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 210, 220, 230, 240, 250, 260` |


#### Resist Cold — ID 105


| Property | Value |
| --- | --- |
| Tree | Defensive Auras |
| Required character level | 6 |
| Immediate prerequisites | None |
| All upstream prerequisites | None |
| Type | aura |
| Internal data name | `Resist Cold` |
| Mana | `0` |
| Animation / source-damage field | `no active animation; SrcDam=0 /128` |
| perdelay | `50` |
| aurafilter | `73731` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 16 | radius |
| par2 | 2 | additional radius per level |
| par3 | 35 | min % resist |
| par4 | 150 | max % resist |
| par5 | 0 | ? |
| par6 | 0 | ? |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurastat1: coldresist | `dm34` |
| aurastat2: maxcoldresist | `skill('Resist Cold'.blvl)` |
| passivestat1: maxcoldresist | `skill('Resist Cold'.blvl)/2` |
| aurarangecalc | `ln12` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Resist Cold: / percent | `dm34` | — |
| Radius: | `ln12` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Radius (yards) | L1–20: `7.3, 8.6, 10, 11.3, 12.6, 14, 15.3, 16.6, 18, 19.3, 20.6, 22, 23.3, 24.6, 26, 27.3, 28.3, 30, 31.3, 32.6` |
| Resist Cold +% | L1–20: `52, 66, 76, 85, 92, 98, 102, 106, 110, 113, 116, 118, 121, 123, 124, 127, 128, 129, 130, 131` |
| +X% To Maximum Cold Res. | L1–20: `1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20` |


#### Cleansing — ID 109


| Property | Value |
| --- | --- |
| Tree | Defensive Auras |
| Required character level | 12 |
| Immediate prerequisites | Prayer |
| All upstream prerequisites | Prayer |
| Type | aura |
| Internal data name | `Cleansing` |
| Mana | `0` |
| Animation / source-damage field | `no active animation; SrcDam=0 /128` |
| perdelay | `50` |
| aurafilter | `73731` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 16 | radius |
| par2 | 2 | additional radius per level |
| par3 | 30 | min % reduction |
| par4 | 90 | max % reduction |
| par5 | 0 | ? |
| par6 | 0 | ? |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurastat1: item_poisonlengthresist | `100-dm34` |
| aurastat2: hitpoints | `skill('Prayer'.edns)` |
| aurarangecalc | `ln12` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Heals: | `skill('Prayer'.edmn)` | — |
| Duration reduced by / percent | `dm34` | — |
| Radius: | `ln12` | — |
| Prayer / Life Healed Every 2 Seconds | `skill('Prayer'.edmn)` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Bonuses To Cleansing


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Radius (yards) | L1–20: `10.6, 12, 13.3, 14.6, 16, 17.3, 18.6, 20, 21.3, 22.6, 24, 25.3, 26.6, 28, 29.3, 30.6, 32, 33.3, 34.6, 36` |
| Duration Reduction | L1–20: `39, 46, 51, 56, 60, 63, 65, 67, 69, 70, 72, 73, 75, 76, 76, 78, 78, 79, 79, 80` |


#### Resist Lightning — ID 110


| Property | Value |
| --- | --- |
| Tree | Defensive Auras |
| Required character level | 12 |
| Immediate prerequisites | None |
| All upstream prerequisites | None |
| Type | aura |
| Internal data name | `Resist Lightning` |
| Mana | `0` |
| Animation / source-damage field | `no active animation; SrcDam=0 /128` |
| perdelay | `50` |
| aurafilter | `73731` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 16 | radius |
| par2 | 2 | additional radius per level |
| par3 | 35 | min % resist |
| par4 | 150 | max % resist |
| par5 | 0 | ? |
| par6 | 0 | ? |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurastat1: lightresist | `dm34` |
| aurastat2: maxlightresist | `skill('Resist Lightning'.blvl)` |
| passivestat1: maxlightresist | `skill('Resist Lightning'.blvl)/2` |
| aurarangecalc | `ln12` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Resist Lightning: / percent | `dm34` | — |
| Radius: | `ln12` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Radius (yards) | L1–20: `10.6, 12, 13.3, 14.6, 16, 17.3, 18.6, 20, 21.3, 22.6, 24, 25.3, 26.6, 28, 29.3, 30.6, 32, 33.3, 34.6, 36` |
| Resist Lightning +% | L1–20: `52, 66, 76, 85, 92, 98, 102, 106, 110, 113, 116, 118, 121, 123, 124, 127, 128, 129, 130, 131` |
| +X% To Maximum Light Res. | L1–20: `1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20` |


#### Vigor — ID 115


| Property | Value |
| --- | --- |
| Tree | Defensive Auras |
| Required character level | 18 |
| Immediate prerequisites | Cleansing, Defiance |
| All upstream prerequisites | Prayer, Cleansing, Defiance |
| Type | aura |
| Internal data name | `Vigor` |
| Mana | `0` |
| Animation / source-damage field | `no active animation; SrcDam=0 /128` |
| perdelay | `50` |
| aurafilter | `73731` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 16 | radius |
| par2 | 3 | additional radius per level |
| par3 | 50 | % faster stamina recovery and max stamina |
| par4 | 25 | % additional stamina recovery and max stamina |
| par5 | 7 | min % speed increase |
| par6 | 50 | max % speed increase |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurastat1: staminarecoverybonus | `ln34` |
| aurastat2: skill_staminapercent | `ln34` |
| aurastat3: velocitypercent | `dm56` |
| aurarangecalc | `ln12` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Stamina Recovery Rate: / percent | `ln34` | — |
| Stamina Bonus: / percent | `ln34` | — |
| Velocity: / percent | `dm56` | — |
| Radius: | `ln12` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Radius (yards) | L1–20: `10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46, 48` |
| Walk Run Speed +% | L1–20: `13, 18, 22, 25, 28, 30, 32, 33, 35, 36, 37, 38, 39, 40, 40, 41, 41, 42, 42, 43` |
| Max Stam Recovery +% | L1–20: `50, 75, 100, 125, 150, 175, 200, 225, 250, 275, 300, 325, 350, 375, 400, 425, 450, 475, 500, 525` |
| Incr Stamina Recovery +% | L1–20: `50, 75, 100, 125, 150, 175, 200, 225, 250, 275, 300, 325, 350, 375, 400, 425, 450, 475, 500, 525` |


#### Meditation — ID 120


| Property | Value |
| --- | --- |
| Tree | Defensive Auras |
| Required character level | 24 |
| Immediate prerequisites | Cleansing |
| All upstream prerequisites | Prayer, Cleansing |
| Type | aura |
| Internal data name | `Meditation` |
| Mana | `0` |
| Animation / source-damage field | `no active animation; SrcDam=0 /128` |
| perdelay | `50` |
| aurafilter | `73729` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 16 | radius |
| par2 | 2 | additional radius per level |
| par3 | 300 | % boost to mana recovery |
| par4 | 25 | % additional boost/level |
| par5 | 0 | ? |
| par6 | 0 | ? |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurastat1: manarecoverybonus | `ln34` |
| aurastat2: hitpoints | `skill('Prayer'.edns)` |
| aurarangecalc | `ln12` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Heals: | `skill('Prayer'.edmn)` | — |
| Mana Recovery Rate: / percent | `ln34` | — |
| Radius: | `ln12` | — |
| Prayer / Life Healed Every 2 Seconds | `skill('Prayer'.edmn)` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Bonuses To Meditation


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Radius (yards) | L1–20: `7.3, 8.6, 10, 11.3, 12.6, 14, 15.3, 16.6, 18, 19.3, 20.6, 22, 23.3, 24.6, 26, 27.3, 28.3, 30, 31.3, 32.6` |
| Mana Recovery +% | L1–20: `300, 325, 350, 375, 400, 425, 450, 475, 500, 525, 550, 575, 600, 625, 650, 675, 700, 725, 750, 775` |


#### Redemption — ID 124


| Property | Value |
| --- | --- |
| Tree | Defensive Auras |
| Required character level | 30 |
| Immediate prerequisites | Vigor |
| All upstream prerequisites | Prayer, Cleansing, Defiance, Vigor |
| Type | aura |
| Internal data name | `Redemption` |
| Mana | `0` |
| Animation / source-damage field | `no active animation; SrcDam=0 /128` |
| perdelay | `50` |
| aurafilter | `4354` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 16 | radius |
| par2 | 0 | additional radius per level |
| par3 | 10 | min % chance redeem |
| par4 | 100 | max % chance redeem |
| par5 | 25 | HP and mana gained |
| par6 | 5 | HP and mana gained/level |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurarangecalc | `ln12` |
| calc1 — chance to redeem | `dm34` |
| calc2 — hp gain | `ln56` |
| calc3 — mana gain | `ln56` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Life/Mana Recovered: / points | `ln56` | — |
| Chance to redeem soul: / percent | `dm34` | — |
| Radius: | `ln12` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Radius (yards) | 1 source values: `10.6` |
| Chance to Redeem +% | L1–20: `23, 34, 42, 49, 55, 59, 63, 65, 69, 71, 73, 75, 77, 79, 80, 82, 82, 83, 84, 85` |
| HP/Mana Recovery (points) | L1–20: `25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120` |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **redemption** (Missiles ID 173): `pSrvDoFunc`=`1`; `Range`=`18`; `LastCollide`=`1`; `Size`=`1`; `HitShift`=`8`.




#### Salvation — ID 125


| Property | Value |
| --- | --- |
| Tree | Defensive Auras |
| Required character level | 30 |
| Immediate prerequisites | None |
| All upstream prerequisites | None |
| Type | aura |
| Internal data name | `Salvation` |
| Mana | `0` |
| Animation / source-damage field | `no active animation; SrcDam=0 /128` |
| perdelay | `50` |
| aurafilter | `73731` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 16 | radius |
| par2 | 2 | additional radius per level |
| par3 | 50 | min % resist |
| par4 | 120 | max % resist |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurastat1: fireresist | `dm34` |
| aurastat2: coldresist | `dm34` |
| aurastat3: lightresist | `dm34` |
| aurarangecalc | `ln12` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Resist All: / percent | `dm34` | — |
| Radius: | `ln12` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Radius (yards) | L1–20: `10.6, 12, 13.3, 14.6, 16, 17.3, 18.6, 20, 21.3, 22.6, 24, 25.3, 26.6, 28, 29.3, 30.6, 32, 33.3, 34.6, 36` |
| Resist Lightning/Cold/Fire % | L1–20: `60, 68, 75, 80, 85, 88, 91, 93, 96, 97, 99, 101, 102, 103, 104, 106, 106, 107, 108, 108` |


## 4.5. Barbarian

### Combat Skills

Source display tables: [Arreat Summit — Combat Skills](http://classic.battle.net/diablo2exp/skills/barbarian-combatskills.shtml). Exact fields: pinned Skills.txt / SkillDesc.txt / Missiles.txt listed in §0.


| ID | Skill | Required clvl | Immediate prerequisites | Type | Mana expression |
| --- | --- | --- | --- | --- | --- |
| 126 | Bash | 1 | None | active | `max(1, (2)×1)` |
| 132 | Leap | 6 | None | active | `max(1, (2)×1)` |
| 133 | Double Swing | 6 | Bash | active | `(8 − 1×(L−1))×0.125; ≤0 needs no mana (signed raw value retained)` |
| 139 | Stun | 12 | Bash | active | `max(1, (2)×1)` |
| 140 | Double Throw | 12 | Double Swing | active | `max(1, (1)×1)` |
| 143 | Leap Attack | 18 | Leap | active | `max(1, (9)×1)` |
| 144 | Concentrate | 18 | Stun | active | `max(1, (2)×1)` |
| 147 | Frenzy | 24 | Double Throw | active | `max(1, (3)×0.5)` |
| 151 | Whirlwind | 30 | Leap Attack, Concentrate | active | `max(1, (25 + 1×(L−1))×0.5)` |
| 152 | Berserk | 30 | Concentrate | active | `max(1, (4)×1)` |


#### Bash — ID 126


| Property | Value |
| --- | --- |
| Tree | Combat Skills |
| Required character level | 1 |
| Immediate prerequisites | None |
| All upstream prerequisites | None |
| Type | active |
| Internal data name | `Bash` |
| Mana | `max(1, (2)×1)` |
| Animation / source-damage field | `A1; SrcDam=128 /128` |
| itypea1 | `mele` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 50 | Damage % base |
| par2 | 5 | Damage % per level |
| par3 | 1 | Min Damage |
| par4 | 1 | Min Damager per level |
| par7 | 5 | to hit synergy |
| par8 | 5 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| calc1 — damage% | `ln12+skill('Stun'.blvl)*par8` |
| calc2 — post dmg add | `ln34` |
| ToHitCalc | `15+lvl*5+skill('Concentrate'.blvl)*par7` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Damage: | `ln34` | — |
| Damage: / percent | `clc1` | — |
| Attack: / percent | `toht` | — |
| Stun / Damage per Level | `par8` | — |
| Concentrate / Attack Rating per Level | `par7` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Bash Receives Bonuses From
- Stun: +5% Damage Per Level
- Concentrate: +5% Attack Rating Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 2 |
| Damage | L1–20: `+1, +2, +3, +4, +5, +6, +7, +8, +9, +10, +11, +12, +13, +14, +15, +16, +17, +18, +19, +20` |
| Damage +% | L1–20: `50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120, 125, 130, 135, 140, 145` |
| Attack +% | L1–20: `20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115` |


#### Leap — ID 132


| Property | Value |
| --- | --- |
| Tree | Combat Skills |
| Required character level | 6 |
| Immediate prerequisites | None |
| All upstream prerequisites | None |
| Type | active |
| Internal data name | `Leap` |
| Mana | `max(1, (2)×1)` |
| Animation / source-damage field | `SQ; SrcDam=0 /128` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 4 | min distance |
| par2 | 30 | max distance |
| par3 | 4 | Knockback range |
| par4 | 1 | knockback range per level |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurarangecalc | `dm12` |
| calc1 — knockback radius | `ln34` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Radius: | `dm12` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 2 |
| Radius (yards) | L1–20: `4.6, 7.3, 8.6, 10, 11.3, 12, 12.6, 13.3, 14, 14, 14.6, 14.6, 15.3, 16, 16, 16, 16.6, 16.6, 16.6, 16.6` |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **leapknockback** (Missiles ID 346): `pSrvDoFunc`=`1`; `Range`=`2`; `CollideType`=`3`; `Size`=`2`; `ResultFlags`=`8`; `HitShift`=`8`.




#### Double Swing — ID 133


| Property | Value |
| --- | --- |
| Tree | Combat Skills |
| Required character level | 6 |
| Immediate prerequisites | Bash |
| All upstream prerequisites | Bash |
| Type | active |
| Internal data name | `Double Swing` |
| Mana | `(8 − 1×(L−1))×0.125; ≤0 needs no mana (signed raw value retained)` |
| Animation / source-damage field | `SQ; SrcDam=128 /128` |
| itypea1 | `mele` |
| itypeb1 | `mele` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 50 | Attack rate bonus |
| par5 | 50 | Attack rate bonus |
| par8 | 10 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| calc1 — damage% | `skill('Bash'.blvl)*par8` |
| calc3 — attack rate bonus | `par5` |
| ToHit (+% AR for usual attacks) | `15 + 5×(L−1)` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Mana Cost: | `usmc/128` | — |
| Attack: / percent | `toht` | — |
| Damage: / percent | `clc1` | — |
| Bash / Damage per Level | `par8` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Double Swing Receives Bonuses From
- Bash: +10% Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Mana Cost | L1–20: `1.0, 0.8, 0.7, 0.6, 0.5, 0.3, 0.2, 0.1, 0, -0.1, -0.2, -0.3, -0.5, -0.6, -0.7, -0.8, -1.0, -1.1, -1.2, -1.3` |
| Attack +% | L1–20: `15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110` |


#### Stun — ID 139


| Property | Value |
| --- | --- |
| Tree | Combat Skills |
| Required character level | 12 |
| Immediate prerequisites | Bash |
| All upstream prerequisites | Bash |
| Type | active |
| Internal data name | `Stun` |
| Mana | `max(1, (2)×1)` |
| Animation / source-damage field | `A1; SrcDam=128 /128` |
| itypea1 | `mele` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 30 | Frames the target is stunned |
| par2 | 5 | additional frames/level |
| par6 | 5 | stun synergy |
| par7 | 5 | to hit synergy |
| par8 | 8 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| calc1 | `skill('Bash'.blvl)*par8` |
| ToHitCalc | `10+lvl*5+skill('Concentrate'.blvl)*par7` |
| ELenSymPerCalc | `skill('War Cry'.blvl)*par6` |
| E length: frames, L1; increments L2–8 / L9–16 / L17+ | `30; 5 / 5 / 2` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Duration: | `min(250,edln)` | — |
| Attack: / percent | `toht` | — |
| Damage: / percent | `clc1` | — |
| Bash / Damage per Level | `par8` | — |
| Concentrate / Attack Rating per Level | `par7` | — |
| War Cry / Duration per Level | `par6` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Stun Receives Bonuses From
- Bash: +8% Damage Per Level
- Concentrate: +5% Attack Rating Per Level
- War Cry: +5% Duration Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 2 |
| Attack +% | L1–20: `15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110` |
| Duration (seconds) | L1–20: `1.2, 1.4, 1.6, 1.8, 2.0, 2.2, 2.4, 2.6, 2.8, 3.0, 3.2, 3.4, 3.6, 3.8, 4.0, 4.2, 4.2, 4.3, 4.4, 4.5` |


#### Double Throw — ID 140


| Property | Value |
| --- | --- |
| Tree | Combat Skills |
| Required character level | 12 |
| Immediate prerequisites | Double Swing |
| All upstream prerequisites | Bash, Double Swing |
| Type | active |
| Internal data name | `Double Throw` |
| Mana | `max(1, (1)×1)` |
| Animation / source-damage field | `SQ; SrcDam=128 /128` |
| itypea1 | `thro` |
| itypeb1 | `thro` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 0 | ? |
| par2 | 0 | ? |
| par8 | 8 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| calc1 — damage% | `skill('Double Swing'.blvl)*par8` |
| ToHit (+% AR for usual attacks) | `20 + 10×(L−1)` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Mana Cost: | `usmc/128` | — |
| Damage: / percent | `clc1` | — |
| Double Swing / Damage per Level | `par8` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Double Throw Receives Bonuses From
- Double Swing: +8% Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 2 |
| Attack +% | L1–20: `20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 210` |


#### Leap Attack — ID 143


| Property | Value |
| --- | --- |
| Tree | Combat Skills |
| Required character level | 18 |
| Immediate prerequisites | Leap |
| All upstream prerequisites | Leap |
| Type | active |
| Internal data name | `Leap Attack` |
| Mana | `max(1, (9)×1)` |
| Animation / source-damage field | `SQ; SrcDam=128 /128` |
| itypea1 | `mele` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 4 | min distance |
| par2 | 30 | max distance |
| par3 | 100 | Min % damage bonus |
| par4 | 30 | % damage bonus |
| par5 | 4 | Knockback range |
| par6 | 2 | knockback range per level |
| par8 | 10 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| calc1 | `ln34+skill('Leap'.blvl)*par8` |
| ToHit (+% AR for usual attacks) | `50 + 15×(L−1)` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Attack: / percent | `toht` | — |
| Damage: / percent | `clc1` | — |
| Leap / Damage per Level | `par8` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Leap Attack Receives Bonuses From:
- Leap: +10% Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 9 |
| Attack +% | L1–20: `50, 65, 80, 95, 110, 125, 140, 155, 170, 185, 200, 215, 230, 245, 260, 275, 290, 305, 320, 335` |
| Damage +% | L1–20: `100, 130, 160, 190, 220, 250, 280, 310, 340, 370, 400, 430, 460, 490, 520, 550, 580, 610, 640, 670` |


#### Concentrate — ID 144


| Property | Value |
| --- | --- |
| Tree | Combat Skills |
| Required character level | 18 |
| Immediate prerequisites | Stun |
| All upstream prerequisites | Bash, Stun |
| Type | active |
| Internal data name | `Concentrate` |
| Mana | `max(1, (2)×1)` |
| Animation / source-damage field | `A1; SrcDam=128 /128` |
| itypea1 | `mele` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 70 | Damage % base |
| par2 | 5 | Damage % per level |
| par3 | 100 | % AC bonus |
| par4 | 10 | % AC bonus per level |
| par7 | 10 | damage synergy |
| par8 | 5 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurastat1: skill_armor_percent | `ln34` |
| calc1 — damage% | `ln12+skill('Bash'.blvl)*par8+skill('Battle Orders'.blvl)*par7` |
| calc4 — convert% | `skill('Berserk'.blvl)` |
| ToHit (+% AR for usual attacks) | `60 + 10×(L−1)` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Damage: / percent | `clc1` | — |
| Attack: / percent | `toht` | — |
| Defense Bonus: / percent | `ln34` | — |
| Magic Damage: / percent | `clc4` | — |
| Bash / Damage per Level | `par8` | — |
| Battle Orders / Damage per Level | `par7` | — |
| Berserk / Magic Damage per Level | `1` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Concentrate Receives Bonuses From
- Bash: +5% Damage Per Level
- Battle Orders: +10% Damage Per Level
- Berserk: +1% Magic Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 2 |
| Defense +% | L1–20: `100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 210, 220, 230, 240, 250, 260, 270, 280, 290` |
| Attack +% | L1–20: `60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 210, 220, 230, 240, 250` |
| Damage +% | L1–20: `70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120, 125, 130, 135, 140, 145, 150, 155, 160, 165` |


#### Frenzy — ID 147


| Property | Value |
| --- | --- |
| Tree | Combat Skills |
| Required character level | 24 |
| Immediate prerequisites | Double Throw |
| All upstream prerequisites | Bash, Double Swing, Double Throw |
| Type | active |
| Internal data name | `Frenzy` |
| Mana | `max(1, (3)×0.5)` |
| Animation / source-damage field | `SQ; SrcDam=128 /128` |
| itypea1 | `mele` |
| itypeb1 | `mele` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 90 | Damage % base |
| par2 | 5 | Damage % per level |
| par3 | 20 | min % run speed increase |
| par4 | 200 | max % run speed increase |
| par5 | 0 | min % attack speed increase |
| par6 | 50 | max % attack speed increase |
| par7 | 150 | duration |
| par8 | 8 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurastat1: velocitypercent | `dm34` |
| aurastat2: attackrate | `dm56` |
| auralencalc | `par7` |
| calc1 — damage% | `ln12+(skill('Double Swing'.blvl) + skill('Taunt'.blvl))*par8` |
| calc4 — convert% | `skill('Berserk'.blvl)` |
| ToHit (+% AR for usual attacks) | `100 + 7×(L−1)` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Mana Cost: | `usmc/128` | — |
| Walk/Run Speed: / percent | `15*(par4-par3)/100+par3` | `dm34` |
| Attack Speed: / percent | `15*(par6-par5)/100+par5` | `dm56` |
| Attack: / percent | `toht` | — |
| Damage: / percent | `clc1` | — |
| Duration: | `par7` | — |
| Magic Damage: / percent | `clc4` | — |
| Double Swing / Damage per Level | `par8` | — |
| Taunt / Damage per Level | `par8` | — |
| Berserk / Magic Damage per Level | `1` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Frenzy Receives Bonuses From
- Double Swing: +8% Damage Per Level
- Taunt: +8% Damage Per Level
- Berserk: +1% Magic Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 3 |
| Damage +% | L1–20: `90, 95, 100, 105, 110, 115, 120, 125, 130, 135, 140, 145, 150, 155, 160, 165, 170, 175, 180, 185` |
| Attack +% | L1–20: `100, 107, 114, 121, 128, 135, 142, 149, 156, 163, 170, 177, 184, 191, 198, 205, 212, 219, 226, 233` |
| Attack Speed +% | L1–20: `7, 7-13, 7-18, 7-22, 7-25, 7-27, 7-29, 7-31, 7-33, 7-34, 7-35, 7-36, 7-37, 7-38, 7-39, 7-40, 7-40, 7-41, 7-41, 7-42` |
| Walk/Run Speed +% | L1–20: `47, 47-68, 47-84, 47-99, 47-110, 47-119, 47-126, 47-131, 47-138, 47-142, 47-147, 47-151, 47-155, 47-158, 47-160, 47-164, 47-165, 47-167, 47-169, 47-171` |
| Constant / source label | Duration: 6 sec. |


#### Whirlwind — ID 151


| Property | Value |
| --- | --- |
| Tree | Combat Skills |
| Required character level | 30 |
| Immediate prerequisites | Leap Attack, Concentrate |
| All upstream prerequisites | Leap, Leap Attack, Bash, Stun, Concentrate |
| Type | active |
| Internal data name | `Whirlwind` |
| Mana | `max(1, (25 + 1×(L−1))×0.5)` |
| Animation / source-damage field | `SQ; SrcDam=128 /128` |
| itypea1 | `mele` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | -50 | Damage percent per attack |
| par2 | 8 | Damage percent per level |
| par3 | 1 | Attacks per tick |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| calc1 — damage% | `ln12` |
| ToHit (+% AR for usual attacks) | `0 + 5×(L−1)` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Attack: / percent | `toht` | — |
| Damage: / percent | `clc1` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Mana Cost | L1–20: `12.5, 13, 13.5, 14, 14.5, 15, 15.5, 16, 16.5, 17, 17.5, 18, 18.5, 19, 19.5, 20, 20.5, 21, 21.5, 22` |
| Damage % | L1–20: `-50, -42, -34, -26, -18, -10, -2, +6, +14, +22, +30, +38, +46, +54, +62, +70, +78, +86, +94, +102` |
| Attack +% | L1–20: `0, +5, +10, +15, +20, +25, +30, +35, +40, +45, +50, +55, +60, +65, +70, +75, +80, +85, +90, +95` |


#### Berserk — ID 152


| Property | Value |
| --- | --- |
| Tree | Combat Skills |
| Required character level | 30 |
| Immediate prerequisites | Concentrate |
| All upstream prerequisites | Bash, Stun, Concentrate |
| Type | active |
| Internal data name | `Berserk` |
| Mana | `max(1, (4)×1)` |
| Animation / source-damage field | `A1; SrcDam=128 /128` |
| itypea1 | `mele` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 150 | Damage % base |
| par2 | 15 | Damage % per level |
| par3 | 25 | min vulnerable duration |
| par4 | 75 | max vulerable duration |
| par5 | 0 | damage resist bonus |
| par8 | 10 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurastat1: damageresist | `par5` |
| aurastat2: armor_override_percent | `-100` |
| auralencalc | `par4-min(((110*lvl)/(lvl+6)*(par4-par3)/100),(par4-par3))` |
| calc1 — damage% | `ln12+(skill('Howl'.blvl) + skill('Shout'.blvl))*par8` |
| calc2 — duration | `par4-min(((110*lvl)/(lvl+6)*(par4-par3)/100),(par4-par3))` |
| calc4 — convert% | `100` |
| ToHit (+% AR for usual attacks) | `100 + 15×(L−1)` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Duration: | `par4-min(((110*lvl)/(lvl+6)*(par4-par3)/100),(par4-par3))` | — |
| Magic Damage: / percent | `clc1` | — |
| Attack: / percent | `toht` | — |
| Howl / Damage per Level | `par8` | — |
| Shout / Damage per Level | `par8` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Berserk Receives Bonuses From
- Howl: +10% Magic Damage Per Level
- Shout: +10% Magic Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 4 |
| Attack Rating +% | L1–20: `100, 115, 130, 145, 160, 175, 190, 205, 220, 235, 250, 265, 280, 295, 310, 325, 340, 355, 370, 385` |
| Magic Damage +% | L1–20: `150, 165, 180, 195, 210, 225, 240, 255, 270, 285, 300, 315, 330, 345, 360, 375, 390, 405, 420, 435` |
| Duration (seconds) | L1–20: `2.7, 2.4, 2.2, 2.1, 2.0, 1.9, 1.8, 1.7, 1.6, 1.6, 1.6, 1.5, 1.5, 1.4, 1.4, 1.4, 1.4, 1.3, 1.3, 1.3` |


### Combat Masteries

Source display tables: [Arreat Summit — Combat Masteries](http://classic.battle.net/diablo2exp/skills/barbarian-combatmasteries.shtml). Exact fields: pinned Skills.txt / SkillDesc.txt / Missiles.txt listed in §0.


| ID | Skill | Required clvl | Immediate prerequisites | Type | Mana expression |
| --- | --- | --- | --- | --- | --- |
| 127 | Sword Mastery | 1 | None | passive | `0` |
| 128 | Axe Mastery | 1 | None | passive | `0` |
| 129 | Mace Mastery | 1 | None | passive | `0` |
| 134 | Pole Arm Mastery | 6 | None | passive | `0` |
| 135 | Throwing Mastery | 6 | None | passive | `0` |
| 136 | Spear Mastery | 6 | None | passive | `0` |
| 141 | Increased Stamina | 12 | None | passive | `0` |
| 145 | Iron Skin | 18 | None | passive | `0` |
| 148 | Increased Speed | 24 | Increased Stamina | passive | `0` |
| 153 | Natural Resistance | 30 | Iron Skin | passive | `0` |


#### Sword Mastery — ID 127


| Property | Value |
| --- | --- |
| Tree | Combat Masteries |
| Required character level | 1 |
| Immediate prerequisites | None |
| All upstream prerequisites | None |
| Type | passive |
| Internal data name | `Sword Mastery` |
| Mana | `0` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 28 | Attack % base |
| par2 | 8 | Attack % per level |
| par3 | 28 | Damage % base |
| par4 | 5 | damage % per level |
| par5 | 0 | critical% |
| par6 | 35 | critical% |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| passivestat1: passive_mastery_melee_th | `ln12` |
| passivestat2: passive_mastery_melee_dmg | `ln34` |
| passivestat3: passive_mastery_melee_crit | `dm56` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| %d Percent Chance of Critical Strike | `macr` | — |
| Attack: / percent | `math` | — |
| Damage: / percent | `madm` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Damage +% | L1–20: `28, 33, 38, 43, 48, 53, 58, 63, 68, 73, 78, 83, 88, 93, 98, 103, 108, 113, 118, 123` |
| Attack +% | L1–20: `28, 36, 44, 52, 60, 68, 76, 84, 92, 100, 108, 116, 124, 132, 140, 148, 156, 164, 172, 180` |
| Chance for Critical Strike % | L1–20: `5, 9, 12, 15, 17, 19, 20, 21, 23, 23, 24, 25, 26, 26, 27, 28, 28, 28, 29, 29` |


#### Axe Mastery — ID 128


| Property | Value |
| --- | --- |
| Tree | Combat Masteries |
| Required character level | 1 |
| Immediate prerequisites | None |
| All upstream prerequisites | None |
| Type | passive |
| Internal data name | `Axe Mastery` |
| Mana | `0` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 28 | Attack % base |
| par2 | 8 | Attack % per level |
| par3 | 28 | Damage % base |
| par4 | 5 | damage % per level |
| par5 | 0 | critical% |
| par6 | 35 | critical% |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| passivestat1: passive_mastery_melee_th | `ln12` |
| passivestat2: passive_mastery_melee_dmg | `ln34` |
| passivestat3: passive_mastery_melee_crit | `dm56` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| %d Percent Chance of Critical Strike | `macr` | — |
| Attack: / percent | `math` | — |
| Damage: / percent | `madm` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Damage +% | L1–20: `28, 33, 38, 43, 48, 53, 58, 63, 68, 73, 78, 83, 88, 93, 98, 103, 108, 113, 118, 123` |
| Attack +% | L1–20: `28, 36, 44, 52, 60, 68, 76, 84, 92, 100, 108, 116, 124, 132, 140, 148, 156, 164, 172, 180` |
| Chance for Critical Strike % | L1–20: `5, 9, 12, 15, 17, 19, 20, 21, 23, 23, 24, 25, 26, 26, 27, 28, 28, 28, 29, 29` |


#### Mace Mastery — ID 129


| Property | Value |
| --- | --- |
| Tree | Combat Masteries |
| Required character level | 1 |
| Immediate prerequisites | None |
| All upstream prerequisites | None |
| Type | passive |
| Internal data name | `Mace Mastery` |
| Mana | `0` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 28 | Attack % base |
| par2 | 8 | Attack % per level |
| par3 | 28 | Damage % base |
| par4 | 5 | damage % per level |
| par5 | 0 | critical% |
| par6 | 35 | critical% |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| passivestat1: passive_mastery_melee_th | `ln12` |
| passivestat2: passive_mastery_melee_dmg | `ln34` |
| passivestat3: passive_mastery_melee_crit | `dm56` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| %d Percent Chance of Critical Strike | `macr` | — |
| Attack: / percent | `math` | — |
| Damage: / percent | `madm` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Damage +% | L1–20: `28, 33, 38, 43, 48, 53, 58, 63, 68, 73, 78, 83, 88, 93, 98, 103, 108, 113, 118, 123` |
| Attack +% | L1–20: `28, 36, 44, 52, 60, 68, 76, 84, 92, 100, 108, 116, 124, 132, 140, 148, 156, 164, 172, 180` |
| Chance for Critical Strike % | L1–20: `5, 9, 12, 15, 17, 19, 20, 21, 23, 23, 24, 25, 26, 26, 27, 28, 28, 28, 29, 29` |


#### Pole Arm Mastery — ID 134


| Property | Value |
| --- | --- |
| Tree | Combat Masteries |
| Required character level | 6 |
| Immediate prerequisites | None |
| All upstream prerequisites | None |
| Type | passive |
| Internal data name | `Pole Arm Mastery` |
| Mana | `0` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 30 | Attack % base |
| par2 | 8 | Attack % per level |
| par3 | 28 | Damage % base |
| par4 | 5 | damage % per level |
| par5 | 0 | critical% |
| par6 | 35 | critical% |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| passivestat1: passive_mastery_melee_th | `ln12` |
| passivestat2: passive_mastery_melee_dmg | `ln34` |
| passivestat3: passive_mastery_melee_crit | `dm56` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| %d Percent Chance of Critical Strike | `macr` | — |
| Attack: / percent | `math` | — |
| Damage: / percent | `madm` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Damage +% | L1–20: `28, 33, 38, 43, 48, 53, 58, 63, 68, 73, 78, 83, 88, 93, 98, 103, 108, 113, 118, 123` |
| Attack +% | L1–20: `30, 38, 46, 54, 62, 70, 78, 86, 94, 102, 110, 118, 126, 134, 142, 150, 158, 166, 174, 182` |
| Chance for Critical Strike % | L1–20: `5, 9, 12, 15, 17, 19, 20, 21, 23, 23, 24, 25, 26, 26, 27, 28, 28, 28, 29, 29` |


#### Throwing Mastery — ID 135


| Property | Value |
| --- | --- |
| Tree | Combat Masteries |
| Required character level | 6 |
| Immediate prerequisites | None |
| All upstream prerequisites | None |
| Type | passive |
| Internal data name | `Throwing Mastery` |
| Mana | `0` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 30 | Attack % base |
| par2 | 8 | Attack % per level |
| par3 | 28 | Damage % base |
| par4 | 5 | damage % per level |
| par5 | 0 | critical% |
| par6 | 35 | critical% |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| passivestat1: passive_mastery_throw_th | `ln12` |
| passivestat2: passive_mastery_throw_dmg | `ln34` |
| passivestat3: passive_mastery_throw_crit | `dm56` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| %d Percent Chance of Critical Strike | `macr` | — |
| Attack: / percent | `math` | — |
| Damage: / percent | `madm` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Damage +% | L1–20: `28, 33, 38, 43, 48, 53, 58, 63, 68, 73, 78, 83, 88, 93, 98, 103, 108, 113, 118, 123` |
| Attack +% | L1–20: `30, 38, 46, 54, 62, 70, 78, 86, 94, 102, 110, 118, 126, 134, 142, 150, 158, 166, 174, 182` |
| Chance for Critical Strike % | L1–20: `5, 9, 12, 15, 17, 19, 20, 21, 23, 23, 24, 25, 26, 26, 27, 28, 28, 28, 29, 29` |


#### Spear Mastery — ID 136


| Property | Value |
| --- | --- |
| Tree | Combat Masteries |
| Required character level | 6 |
| Immediate prerequisites | None |
| All upstream prerequisites | None |
| Type | passive |
| Internal data name | `Spear Mastery` |
| Mana | `0` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 30 | Attack % base |
| par2 | 8 | Attack % per level |
| par3 | 28 | Damage % base |
| par4 | 5 | damage % per level |
| par5 | 0 | critical% |
| par6 | 35 | critical% |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| passivestat1: passive_mastery_melee_th | `ln12` |
| passivestat2: passive_mastery_melee_dmg | `ln34` |
| passivestat3: passive_mastery_melee_crit | `dm56` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| %d Percent Chance of Critical Strike | `macr` | — |
| Attack: / percent | `math` | — |
| Damage: / percent | `madm` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Damage +% | L1–20: `28, 33, 38, 43, 48, 53, 58, 63, 68, 73, 78, 83, 88, 93, 98, 103, 108, 113, 118, 123` |
| Attack +% | L1–20: `30, 38, 46, 54, 62, 70, 78, 86, 94, 102, 110, 118, 126, 134, 142, 150, 158, 166, 174, 182` |
| Chance for Critical Strike % | L1–20: `5, 9, 12, 15, 17, 19, 20, 21, 23, 23, 24, 25, 26, 26, 27, 28, 28, 28, 29, 29` |


#### Increased Stamina — ID 141


| Property | Value |
| --- | --- |
| Tree | Combat Masteries |
| Required character level | 12 |
| Immediate prerequisites | None |
| All upstream prerequisites | None |
| Type | passive |
| Internal data name | `Increased Stamina` |
| Mana | `0` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 30 | % stamina increase |
| par2 | 15 | % stamina increase per level |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| passivestat1: skill_passive_staminapercent | `ln12` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Stamina Bonus: / percent | `ln12` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Stamina Bonus % | L1–20: `30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 195, 210, 225, 240, 255, 270, 285, 300, 315` |


#### Iron Skin — ID 145


| Property | Value |
| --- | --- |
| Tree | Combat Masteries |
| Required character level | 18 |
| Immediate prerequisites | None |
| All upstream prerequisites | None |
| Type | passive |
| Internal data name | `Iron Skin` |
| Mana | `0` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 30 | % AC bonus |
| par2 | 10 | % AC bonus per level |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| passivestat1: skill_armor_percent | `ln12` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| percent | `ln12` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Increase Defense Rating % | L1–20: `30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 210, 220` |


#### Increased Speed — ID 148


| Property | Value |
| --- | --- |
| Tree | Combat Masteries |
| Required character level | 24 |
| Immediate prerequisites | Increased Stamina |
| All upstream prerequisites | Increased Stamina |
| Type | passive |
| Internal data name | `Increased Speed` |
| Mana | `0` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 7 | min % speed increase |
| par2 | 50 | max % speed increase |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| passivestat1: velocitypercent | `dm12` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Walk/Run Speed: / percent | `dm12` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Walk/Run Speed Bonus % | L1–20: `13, 18, 22, 25, 28, 30, 32, 33, 35, 36, 37, 38, 39, 40, 40, 41, 41, 42, 42, 43` |


#### Natural Resistance — ID 153


| Property | Value |
| --- | --- |
| Tree | Combat Masteries |
| Required character level | 30 |
| Immediate prerequisites | Iron Skin |
| All upstream prerequisites | Iron Skin |
| Type | passive |
| Internal data name | `Natural Resistance` |
| Mana | `0` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 0 | min % resistance bonus |
| par2 | 80 | max % resistance bonus |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| passivestat1: fireresist | `dm12` |
| passivestat2: lightresist | `dm12` |
| passivestat3: coldresist | `dm12` |
| passivestat4: poisonresist | `dm12` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Resistances: / percent | `dm12` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Increase All Resistances % | L1–20: `12, 21, 28, 35, 40, 44, 47, 49, 52, 54, 56, 58, 60, 61, 62, 64, 64, 65, 66, 67` |


### Warcries

Source display tables: [Arreat Summit — Warcries](http://classic.battle.net/diablo2exp/skills/barbarian-warcries.shtml). Exact fields: pinned Skills.txt / SkillDesc.txt / Missiles.txt listed in §0.


| ID | Skill | Required clvl | Immediate prerequisites | Type | Mana expression |
| --- | --- | --- | --- | --- | --- |
| 130 | Howl | 1 | None | active | `max(1, (4)×1)` |
| 131 | Find Potion | 1 | None | active | `max(1, (2)×1)` |
| 137 | Taunt | 6 | Howl | active | `max(1, (3)×1)` |
| 138 | Shout | 6 | Howl | active | `max(1, (6)×1)` |
| 142 | Find Item | 12 | Find Potion | active | `max(1, (7)×1)` |
| 146 | Battle Cry | 18 | Taunt | active | `max(1, (5)×1)` |
| 149 | Battle Orders | 24 | Shout | active | `max(1, (7)×1)` |
| 150 | Grim Ward | 24 | Find Item | active | `max(1, (4)×1)` |
| 154 | War Cry | 30 | Battle Cry, Battle Orders | active | `max(1, (10 + 1×(L−1))×1)` |
| 155 | Battle Command | 30 | Battle Orders | active | `max(1, (11)×1)` |


#### Howl — ID 130


| Property | Value |
| --- | --- |
| Tree | Warcries |
| Required character level | 1 |
| Immediate prerequisites | None |
| All upstream prerequisites | None |
| Type | active |
| Internal data name | `Howl` |
| Mana | `max(1, (4)×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 2 | Velocity/level increase |
| par2 | 1 | Plev+Slev+n |
| par3 | 24 | Distance to retreat |
| par4 | 5 | Distance per level |
| par5 | 75 | Time to retreat |
| par6 | 25 | Time per level |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| calc1 — velocity adder | `par1 * (lvl-1)` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Enemy runs for | `ln56` | — |
| Enemy runs up to | `ln34` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 4 |
| Enemy Runs (yards) | L1–20: `16, 19.3, 22.6, 26, 29.3, 32.6, 36, 39.3, 42.6, 46, 49.3, 52.6, 56, 59.3, 62.6, 66, 69.3, 72.6, 76, 79.3` |
| Enemy runs (seconds) | L1–20: `3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22` |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **howl** (Missiles ID 148): `pSrvDoFunc`=`1`; `pSrvHitFunc`=`17`; `Vel`=`12`; `MaxVel`=`12`; `Range`=`12`; `CollideType`=`3`; `LastCollide`=`1`; `Size`=`1`.




#### Find Potion — ID 131


| Property | Value |
| --- | --- |
| Tree | Warcries |
| Required character level | 1 |
| Immediate prerequisites | None |
| All upstream prerequisites | None |
| Type | active |
| Internal data name | `Find Potion` |
| Mana | `max(1, (2)×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 0 | min chance to find heart |
| par2 | 100 | max chance to find heart |
| par3 | 30 | Chance of finding a mana potion |
| par4 | 10 | Chance of finding rejuv |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| calc1 — chance | `dm12` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| percent chance | `dm12` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Life and Mana Act 1:(Normal) Light Healing/Mana / Act 1 (Night): Greater Healing/Mana / Act 1 (Hell): Super Healing/Mana / Act 2: (Normal) Healing/Mana / Act 2: (Night) Greater Healing/Super Mana / Act 2: (Hell) Super Healing/Mana / Act 3: (Norm) Greater Healing/Mana / Act 3: (Night) Super Healing/Mana / Act 3: (Hell) Super Healing/Mana / Act 4 (Norm): Greater Healing/Mana / Act 4 (Night): Super Healing/Mana / Act 4: (Hell) Super Healing/Mana / Act 5: (Norm) Greater Healing/Mana / Act 5 (Night): Super Healing/Mana / Act 5: (Hell) Super Healing/Mana / | 1 source values: `Rejuvenation Act 1: Rejuvenation Potions / Act 1: (Night/Hell) Full Rejuvenation Potions / Act 2: (Norm) Rejuvenation Potions / Act 2: (Night/Hell) Full Rejuvenation Potions / Act 3: (Norm/Night/Hell) Full Rejuvenation Potions / Act 4 (Norm/Night/Hell): Full Rejuvenation Potions / Act 5:(Norm/Night/Hell) Full Rejuvenation Potions` |
| Constant / source label | Mana Cost: 2 |
| Chance to Find % | L1–20: `15, 27, 36, 44, 50, 55, 59, 62, 66, 68, 71, 73, 75, 77, 78, 80, 81, 82, 83, 84` |


#### Taunt — ID 137


| Property | Value |
| --- | --- |
| Tree | Warcries |
| Required character level | 6 |
| Immediate prerequisites | Howl |
| All upstream prerequisites | Howl |
| Type | active |
| Internal data name | `Taunt` |
| Mana | `max(1, (3)×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |
| aurafilter | `34179` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | -5 | % to hit for target |
| par2 | -2 | % to hit/level |
| par3 | -5 | % damage for target |
| par4 | -2 | % damage/level |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurastat1: item_tohit_percent | `ln12` |
| aurastat2: damagepercent | `ln34` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Target's Attack: / percent | `ln12` | — |
| Target's Damage: / percent | `ln34` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 3 |
| Target's Damage Decrease % | L1–20: `5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31, 33, 35, 37, 39, 41, 43` |
| Target's Attack Rating Decrease % | L1–20: `5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31, 33, 35, 37, 39, 41, 43` |


#### Shout — ID 138


| Property | Value |
| --- | --- |
| Tree | Warcries |
| Required character level | 6 |
| Immediate prerequisites | Howl |
| All upstream prerequisites | Howl |
| Type | active |
| Internal data name | `Shout` |
| Mana | `max(1, (6)×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 100 | % AC bonus for friendlies |
| par2 | 10 | % AC bonus per level |
| par3 | 500 | duration |
| par4 | 250 | duration/level |
| par8 | 125 | duration synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurastat1: skill_armor_percent | `ln12` |
| auralencalc | `ln34+(skill('Battle Orders'.blvl)+skill('Battle Command'.blvl))*par8` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Duration: | `len` | — |
| Defense: / percent | `ln12` | — |
| Battle Orders / Seconds per Level | `par8/25` | — |
| Battle Command / Seconds per Level | `par8/25` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Shout Receives Bonuses From
- Battle Orders: +5 Seconds Per Level
- Battle Command: +5 Seconds Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 6 |
| Defense Bonus % | L1–20: `100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 210, 220, 230, 240, 250, 260, 270, 280, 290` |
| Duration (seconds) | L1–20: `20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 210` |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **shout** (Missiles ID 149): `pSrvDoFunc`=`1`; `pSrvHitFunc`=`18`; `Param1`=`2`; `Vel`=`30`; `MaxVel`=`30`; `Range`=`15`; `CollideType`=`3`; `Size`=`1`.




#### Find Item — ID 142


| Property | Value |
| --- | --- |
| Tree | Warcries |
| Required character level | 12 |
| Immediate prerequisites | Find Potion |
| All upstream prerequisites | Find Potion |
| Type | active |
| Internal data name | `Find Item` |
| Mana | `max(1, (7)×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 5 | min chance to find heart |
| par2 | 60 | max chance to find heart |
| par3 | 30 | % chance high quality |
| par4 | 5 | % chance magic item |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| calc1 — chance | `dm12` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| percent chance | `dm12` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 7 |
| Chance to Find % | L1–20: `13, 19, 24, 29, 32, 35, 37, 39, 41, 42, 44, 45, 46, 47, 47, 49, 49, 50, 50, 51` |


#### Battle Cry — ID 146


| Property | Value |
| --- | --- |
| Tree | Warcries |
| Required character level | 18 |
| Immediate prerequisites | Taunt |
| All upstream prerequisites | Howl, Taunt |
| Type | active |
| Internal data name | `Battle Cry` |
| Mana | `max(1, (5)×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |
| aurafilter | `98304` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 300 | duration |
| par2 | 60 | duration/level |
| par3 | -50 | % AC bonus |
| par4 | -2 | % AC bonus per level |
| par5 | -25 | $ damage bonus |
| par6 | -1 | % damage bonus per level |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurastat1: skill_armor_percent | `ln34` |
| aurastat2: damagepercent | `ln56` |
| auralencalc | `ln12` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Damage: / percent | `ln56` | — |
| Defense: / percent | `ln34` | — |
| Duration: | `ln12` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 5 |
| Duration (seconds) | L1–20: `12, 14.4, 16.8, 19.2, 21.6, 24, 26.4, 28.8, 31.2, 33.6, 36, 38.4, 40.8, 43.2, 45.6, 48, 50.4, 52.8, 55.2, 57.6` |
| Target Defense -% | L1–20: `50, 52, 54, 56, 58, 60, 62, 64, 66, 68, 70, 72, 74, 76, 78, 80, 82, 84, 86, 88` |
| Target Damage -% | L1–20: `25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44` |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **battlecry** (Missiles ID 219): `pSrvDoFunc`=`1`; `pSrvHitFunc`=`21`; `Vel`=`12`; `MaxVel`=`12`; `Range`=`12`; `CollideType`=`3`; `LastCollide`=`1`; `NextHit`=`1`; `NextDelay`=`4`; `Size`=`1`.




#### Battle Orders — ID 149


| Property | Value |
| --- | --- |
| Tree | Warcries |
| Required character level | 24 |
| Immediate prerequisites | Shout |
| All upstream prerequisites | Howl, Shout |
| Type | active |
| Internal data name | `Battle Orders` |
| Mana | `max(1, (7)×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 750 | duration |
| par2 | 250 | duration/level |
| par3 | 35 | Base % increase |
| par4 | 3 | Increase per level |
| par8 | 125 | duration synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurastat1: item_maxmana_percent | `ln34` |
| aurastat2: item_maxhp_percent | `ln34` |
| aurastat3: skill_staminapercent | `ln34` |
| auralencalc | `ln12+(skill('Shout'.blvl)+skill('Battle Command'.blvl))*par8` |
| ToHit (+% AR for usual attacks) | `50 + 10×(L−1)` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Max Mana: / percent | `ln34` | — |
| Max Life: / percent | `ln34` | — |
| Max Stamina: / percent | `ln34` | — |
| Duration: | `len` | — |
| Shout / Seconds per Level | `par8/25` | — |
| Battle Command / Seconds per Level | `par8/25` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Battle Orders Receives Bonuses From:
- Shout: +5 Seconds Per Level
- Battle Command: +5 Seconds Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 7 |
| Duration (seconds) | L1–20: `35, 45, 55, 65, 75, 85, 95, 105, 115, 125, 135, 145, 155, 165, 175, 185, 195, 205, 215, 225` |
| Stamina/Life/Mana Increase % | L1–20: `35, 38, 41, 44, 47, 50, 53, 56, 59, 62, 65, 68, 71, 74, 77, 80, 83, 86, 89, 92` |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **battleorders** (Missiles ID 237): `pSrvDoFunc`=`1`; `pSrvHitFunc`=`18`; `Vel`=`30`; `MaxVel`=`30`; `Range`=`15`; `CollideType`=`3`; `LastCollide`=`1`; `NextHit`=`1`; `NextDelay`=`4`; `Size`=`1`.




#### Grim Ward — ID 150


| Property | Value |
| --- | --- |
| Tree | Warcries |
| Required character level | 24 |
| Immediate prerequisites | Find Item |
| All upstream prerequisites | Find Potion, Find Item |
| Type | active |
| Internal data name | `Grim Ward` |
| Mana | `max(1, (4)×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |
| aurafilter | `2` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 3 | radius |
| par2 | 1 | radius/level |
| par3 | 1000 | duration |
| par4 | 0 | duration/level |
| par5 | 10 | Distance to run |
| par6 | 60 | Monster scare duration |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurarangecalc | `ln12` |
| auralencalc | `par6` |
| calc1 — ward duration | `ln34` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Radius: | `ln12` | — |
| Duration: | `ln34` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 4 |
| Radius | L1–20: `2, 2.6, 3.3, 4, 4.6, 5.3, 6, 6.6, 7.3, 8, 8.6, 9.3, 10, 10.6, 11.3, 12, 12.6, 13.3, 14, 14.6` |
| Constant / source label | Duration 40 |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **grimwardmediumstart** (Missiles ID 252): `pSrvDoFunc`=`1`; `pSrvHitFunc`=`26`; `Range`=`8`; `Size`=`1`; `HitShift`=`8`; `HitSubMissile1`=`grimwardmedium`.


Component **grimwardmedium** (Missiles ID 253): `pSrvDoFunc`=`14`; `pSrvHitFunc`=`27`; `Param1`=`6`; `Param2`=`30`; `sHitPar1`=`-1`; `Range`=`200`; `Size`=`1`; `HitShift`=`8`.


Component **grimwardmediumstop** (Missiles ID 254): `pSrvDoFunc`=`1`; `Range`=`9`; `Size`=`1`; `HitShift`=`8`.


Component **grimwardsmallstart** (Missiles ID 249): `pSrvDoFunc`=`1`; `pSrvHitFunc`=`26`; `Range`=`5`; `Size`=`1`; `HitShift`=`8`; `HitSubMissile1`=`grimwardsmall`.


Component **grimwardsmall** (Missiles ID 250): `pSrvDoFunc`=`14`; `pSrvHitFunc`=`27`; `Param1`=`6`; `Param2`=`30`; `sHitPar1`=`-1`; `Range`=`200`; `Size`=`1`; `HitShift`=`8`.


Component **grimwardsmallstop** (Missiles ID 251): `pSrvDoFunc`=`1`; `Range`=`9`; `Size`=`1`; `HitShift`=`8`.


Component **grimwardlargestart** (Missiles ID 255): `pSrvDoFunc`=`1`; `pSrvHitFunc`=`26`; `Range`=`8`; `Size`=`1`; `HitShift`=`8`; `HitSubMissile1`=`grimwardlarge`.


Component **grimwardlarge** (Missiles ID 256): `pSrvDoFunc`=`14`; `pSrvHitFunc`=`27`; `Param1`=`6`; `Param2`=`30`; `Range`=`200`; `Size`=`1`; `HitShift`=`8`.


Component **grimwardlargestop** (Missiles ID 257): `pSrvDoFunc`=`1`; `Range`=`9`; `Size`=`1`; `HitShift`=`8`.




#### War Cry — ID 154


| Property | Value |
| --- | --- |
| Tree | Warcries |
| Required character level | 30 |
| Immediate prerequisites | Battle Cry, Battle Orders |
| All upstream prerequisites | Howl, Taunt, Battle Cry, Shout, Battle Orders |
| Type | active |
| Internal data name | `War Cry` |
| Mana | `max(1, (10 + 1×(L−1))×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| Physical (raw) | 20–30 | 6–6 | 7–7 | 8–8 | 9–9 | 10–10 |
| Physical (HP equivalent / see channel role; ×1) | 20–30 | 6–6 | 7–7 | 8–8 | 9–9 | 10–10 |
| Physical unsynergized L20 | 150–160 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 25 | stun length |
| par2 | 5 | stun length per level |
| par8 | 6 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| DmgSymPerCalc | `(skill('Howl'.blvl)+skill('Taunt'.blvl)+skill('Battle Cry'.blvl))*par8` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Stun Length: | `min(250,ln12)` | — |
| Howl / Damage per Level | `par8` | — |
| Taunt / Damage per Level | `par8` | — |
| Battle Cry / Damage per Level | `par8` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- War Cry Receives Bonuses From
- Howl: +6% Damage Per Level
- Taunt: +6% Damage Per Level
- Battle Cry: +6% Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Mana Cost | L1–20: `10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29` |
| Damage | L1–20: `20-30, 26-32, 32-42, 38-48, 44-54, 50-60, 56-66, 62-72, 69-79, 76-86, 83-93, 90-100, 97-107, 104-114, 111-121, 118-128, 126-136, 134-144, 142-152, 150-160` |
| Stun Length (seconds) | L1–20: `1, 1.2, 1.4, 1.6, 1.8, 2, 2.2, 2.4, 2.6, 2.8, 3, 3.2, 3.4, 3.6, 3.8, 4, 4.2, 4.4, 4.6, 4.8` |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **warcry** (Missiles ID 235): `pSrvDoFunc`=`1`; `pSrvDmgFunc`=`7`; `Vel`=`12`; `MaxVel`=`12`; `Range`=`16`; `CollideType`=`3`; `LastCollide`=`1`; `NextHit`=`1`; `NextDelay`=`6`; `Size`=`1`; `GetHit`=`1`; `Skill`=`War Cry`; `ResultFlags`=`4`.




#### Battle Command — ID 155


| Property | Value |
| --- | --- |
| Tree | Warcries |
| Required character level | 30 |
| Immediate prerequisites | Battle Orders |
| All upstream prerequisites | Howl, Shout, Battle Orders |
| Type | active |
| Internal data name | `Battle Command` |
| Mana | `max(1, (11)×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 125 | duration |
| par2 | 250 | duration/level |
| par8 | 125 | duration synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurastat1: item_allskills | `1` |
| auralencalc | `ln12+(skill('Shout'.blvl)+skill('Battle Orders'.blvl))*par8` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Duration: | `len` | — |
| Shout / Seconds per Level | `par8/25` | — |
| Battle Orders / Seconds per Level | `par8/25` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Battle Command Receives Bonuses From:
- Shout: +5 Seconds Per Level
- Battle Orders: +5 Seconds Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 11 |
| Duration (seconds) | L1–20: `15, 25, 35, 45, 55, 65, 75, 85, 95, 105, 115, 125, 135, 145, 155, 165, 175, 185, 195, 205` |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **battlecommand** (Missiles ID 236): `pSrvDoFunc`=`1`; `pSrvHitFunc`=`18`; `Vel`=`30`; `MaxVel`=`30`; `Range`=`15`; `CollideType`=`3`; `LastCollide`=`1`; `NextHit`=`1`; `NextDelay`=`4`; `Size`=`1`.




## 4.6. Druid

### Summoning Skills

Source display tables: [Arreat Summit — Summoning Skills](http://classic.battle.net/diablo2exp/skills/druid-summoning.shtml). Exact fields: pinned Skills.txt / SkillDesc.txt / Missiles.txt listed in §0.


| ID | Skill | Required clvl | Immediate prerequisites | Type | Mana expression |
| --- | --- | --- | --- | --- | --- |
| 221 | Raven | 1 | None | summon / active | `max(1, (6)×1)` |
| 222 | Poison Creeper | 1 | None | summon / active | `max(1, (8)×1)` |
| 226 | Oak Sage | 6 | None | summon / active | `max(1, (15 + 1×(L−1))×1)` |
| 227 | Summon Spirit Wolf | 6 | Raven | summon / active | `max(1, (15)×1)` |
| 231 | Carrion Vine | 12 | Poison Creeper | summon / active | `max(1, (10)×1)` |
| 236 | Heart of Wolverine | 18 | Oak Sage | summon / active | `max(1, (20 + 1×(L−1))×1)` |
| 237 | Summon Dire Wolf | 18 | Oak Sage, Summon Spirit Wolf | summon / active | `max(1, (20)×1)` |
| 241 | Solar Creeper | 24 | Carrion Vine | summon / active | `max(1, (14 + 1×(L−1))×1)` |
| 246 | Spirit of Barbs | 30 | Heart of Wolverine | summon / active | `max(1, (25 + 1×(L−1))×1)` |
| 247 | Summon Grizzly | 30 | Summon Dire Wolf | summon / active | `max(1, (40)×1)` |


#### Raven — ID 221


| Property | Value |
| --- | --- |
| Tree | Summoning Skills |
| Required character level | 1 |
| Immediate prerequisites | None |
| All upstream prerequisites | None |
| Type | summon / active |
| Internal data name | `Raven` |
| Mana | `max(1, (6)×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |
| pettype | `raven` |
| summon | `druidhawk` |
| restrict | `1` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| Physical (raw) | 2–4 | 1–1 | 1–1 | 1–1 | 1–1 | 1–1 |
| Physical (HP equivalent / see channel role; ×1) | 2–4 | 1–1 | 1–1 | 1–1 | 1–1 | 1–1 |
| Physical unsynergized L20 | 21–23 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | -2 | monster level = your level + this + SkillLevel |
| par2 | 5 | Max ravens |
| par3 | 0 | ? |
| par4 | 0 | ? |
| par5 | 12 | Attacks |
| par6 | 1 | Attacks per level |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| petmax | `min(lvl,par2)` |
| calc2 — raven lvl | `ulvl + par1 + lvl` |
| ToHit (+% AR for usual attacks) | `100 + 15×(L−1)` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Ravens: | `min(lvl,par2)` | — |
| hits | `ln56` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 6 |
| Ravens | L1–20: `1, 2, 3, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5` |
| Hits | L1–20: `12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31` |
| Damage | L1–20: `2-4, 3-5, 4-6, 5-7, 6-8, 7-9, 8-10, 9-11, 10-12, 11-13, 12-14, 13-15, 14-16, 15-17, 16-18, 17-19, 18-20, 19-21, 20-22, 21-23` |


**Summon base monster record** — seed values, NOT the final buffed summon. Apply this skill's HP/damage/AR calculations, mastery, summon level, difficulty and generated equipment; absent difficulty HP fields can be supplied by hardcoded handling.

| MonStats field | Value |
| --- | --- |
| Id | `druidhawk` |
| AI | `Raven` |
| Velocity | `10` |
| Run | `20` |
| aidel | `15` |
| aidel(N) | `15` |
| aidel(H) | `15` |
| aip1 | `10` |
| aip1(N) | `10` |
| aip1(H) | `10` |
| aip2 | `6` |
| aip2(N) | `6` |
| aip2(H) | `6` |
| aip3 | `5` |
| aip3(N) | `5` |
| aip3(H) | `5` |
| aip4 | `75` |
| aip4(N) | `75` |
| aip4(H) | `75` |
| aip5 | `35` |
| aip5(N) | `35` |
| aip5(H) | `35` |
| Skill1 | `Raven` |
| Sk1mode | `NU` |
| SkillDamage | `Raven` |
| noRatio | `1` |
| minHP | `20` |
| maxHP | `32` |
| AC | `25` |
| AC(N) | `25` |
| AC(H) | `25` |


#### Poison Creeper — ID 222


| Property | Value |
| --- | --- |
| Tree | Summoning Skills |
| Required character level | 1 |
| Immediate prerequisites | None |
| All upstream prerequisites | None |
| Type | summon / active |
| Internal data name | `Plague Poppy` |
| Mana | `max(1, (8)×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |
| pettype | `vine` |
| summon | `plaguepoppy` |
| restrict | `1` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / pois (raw) | 12–16 | 7–7 | 12–12 | 15–15 | 17–17 | 19–19 |
| E / pois (rate HP/frame; ×0.00390625) | 0.046875–0.0625 | 0.02734375–0.02734375 | 0.046875–0.046875 | 0.05859375–0.05859375 | 0.06640625–0.06640625 | 0.07421875–0.07421875 |
| E / pois unsynergized L20 | 0.84765625–0.86328125 | — | — | — | — | — |
| Poison total HP, L1 / L20 (no item/synergy) | 4.6875–6.25 / 84.765625–86.328125 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 3 | Number of vines |
| par2 | 1 | vines per level |
| par3 | 25 | % more hitpoints per level |
| par4 | 0 | ? |
| par5 | 0 | ? |
| par6 | 0 | ? |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| sumskill1: Vine Attack | `lvl` |
| petmax | `1` |
| calc1 — hp % | `par3 * (lvl-1)` |
| calc2 — vine lvl | `ulvl * 3 / 4 + lvl` |
| E length: frames, L1; increments L2–8 / L9–16 / L17+ | `100; 0 / 0 / 0` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| descline3 (formatter 13) | `(lvl-1)*par3` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 8 |
| Life | L1–20: `50, 62, 75, 87, 100, 112, 125, 137, 150, 162, 175, 187, 200, 212, 225, 237, 250, 262, 275, 287` |
| Poison Damage Over 4 Seconds | L1–20: `4-6, 7-8, 10-11, 12-14, 15-17, 18-19, 21-22, 23-25, 28-30, 33-34, 37-39, 42-44, 47-48, 51-53, 56-58, 61-62, 67-68, 73-74, 78-80, 84-86` |


**Summon base monster record** — seed values, NOT the final buffed summon. Apply this skill's HP/damage/AR calculations, mastery, summon level, difficulty and generated equipment; absent difficulty HP fields can be supplied by hardcoded handling.

| MonStats field | Value |
| --- | --- |
| Id | `plaguepoppy` |
| AI | `Vines` |
| Velocity | `7` |
| Run | `7` |
| aidel | `15` |
| aidel(N) | `15` |
| aidel(H) | `15` |
| aip1 | `100` |
| aip1(N) | `100` |
| aip1(H) | `100` |
| aip2 | `20` |
| aip2(N) | `20` |
| aip2(H) | `20` |
| aip3 | `25` |
| aip3(N) | `25` |
| aip3(H) | `25` |
| aip4 | `10` |
| aip4(N) | `10` |
| aip4(H) | `10` |
| aip5 | `35` |
| aip5(N) | `35` |
| aip5(H) | `35` |
| Skill1 | `Vine Attack` |
| Sk1mode | `S1` |
| Sk1lvl | `1` |
| noRatio | `1` |
| minHP | `42` |
| maxHP | `58` |
| AC | `25` |
| AC(N) | `25` |
| AC(H) | `25` |


#### Oak Sage — ID 226


| Property | Value |
| --- | --- |
| Tree | Summoning Skills |
| Required character level | 6 |
| Immediate prerequisites | None |
| All upstream prerequisites | None |
| Type | summon / active |
| Internal data name | `Oak Sage` |
| Mana | `max(1, (15 + 1×(L−1))×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |
| pettype | `totem` |
| summon | `oaksage` |
| restrict | `1` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 30 | % hitpoints more per level |
| par2 | 5 | % hitpoint bonus per level |
| par3 | 250 | duration of aura |
| par4 | 0 | ? |
| par5 | 0 | ? |
| par6 | 0 | ? |
| par7 | 30 | radius |
| par8 | 2 | radius/lvl |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| passivestat1: poisonresist | `100` |
| passivestat2: maxpoisonresist | `100` |
| sumskill1: Oak Sage Aura | `lvl` |
| petmax | `1` |
| calc1 — hp adj | `(lvl-1)*par1` |
| calc2 — totem lvl | `ulvl` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Radius: | `ln78` | — |
| Life: / percent | `ln12` | — |
| descline4 (formatter 13) | `(lvl-1)*par1` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Mana Cost | L1–20: `15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34` |
| Life | L1–20: `60, 78, 96, 114, 132, 150, 168, 186, 204, 222, 240, 258, 276, 294, 312, 330, 348, 366, 384, 402` |
| Life +% | L1–20: `30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120, 125` |
| Radius X Yards | L1–20: `20, 21.3, 22.6, 24, 25.3, 26.6, 28, 29.3, 30.6, 32, 33.3, 34.6, 36, 37.3, 38.6, 40, 41.3, 42.6, 44, 45.3` |


**Summon base monster record** — seed values, NOT the final buffed summon. Apply this skill's HP/damage/AR calculations, mastery, summon level, difficulty and generated equipment; absent difficulty HP fields can be supplied by hardcoded handling.

| MonStats field | Value |
| --- | --- |
| Id | `oaksage` |
| AI | `Totem` |
| Velocity | `6` |
| Run | `6` |
| aidel | `15` |
| aidel(N) | `15` |
| aidel(H) | `15` |
| aip1 | `20` |
| aip1(N) | `20` |
| aip1(H) | `20` |
| aip2 | `30` |
| aip2(N) | `30` |
| aip2(H) | `30` |
| aip3 | `30` |
| aip3(N) | `30` |
| aip3(H) | `30` |
| aip4 | `20` |
| aip4(N) | `20` |
| aip4(H) | `20` |
| ResMa | `25` |
| ResFi | `25` |
| ResLi | `25` |
| ResCo | `25` |
| ResPo | `70` |
| ResDm(N) | `100` |
| ResMa(N) | `25` |
| ResFi(N) | `25` |
| ResLi(N) | `25` |
| ResCo(N) | `25` |
| ResPo(N) | `100` |
| ResMa(H) | `25` |
| ResFi(H) | `25` |
| ResLi(H) | `25` |
| ResCo(H) | `25` |
| ResPo(H) | `100` |
| noRatio | `1` |
| minHP | `56` |
| maxHP | `64` |
| AC | `49` |
| AC(N) | `49` |
| AC(H) | `49` |


#### Summon Spirit Wolf — ID 227


| Property | Value |
| --- | --- |
| Tree | Summoning Skills |
| Required character level | 6 |
| Immediate prerequisites | Raven |
| All upstream prerequisites | Raven |
| Type | summon / active |
| Internal data name | `Summon Spirit Wolf` |
| Mana | `max(1, (15)×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |
| pettype | `spiritwolf` |
| summon | `spiritwolf` |
| restrict | `1` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| Physical (raw) | 2–6 | 1–1 | 2–2 | 4–4 | 5–5 | 8–8 |
| Physical (HP equivalent / see channel role; ×1) | 2–6 | 1–1 | 2–2 | 4–4 | 5–5 | 8–8 |
| Physical unsynergized L20 | 41–45 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 50 | % feral add to attack |
| par2 | 25 | % feral attack per level |
| par3 | 5 | max wolves |
| par4 | 7 | defense points per level |
| par5 | 50 | % defense bonus |
| par6 | 10 | % defense bonus per level |
| par7 | 0 | resist |
| par8 | 5 | resist/lvl |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurastat1: fireresist | `min(ln78,85)` |
| aurastat2: coldresist | `min(ln78,85)` |
| aurastat3: lightresist | `min(ln78,85)` |
| aurastat4: poisonresist | `min(ln78,85)` |
| passivestat1: item_armor_percent | `(par4 * lvl) + ln56` |
| passivestat2: tohit | `ln12` |
| passivestat3: damagepercent | `skill('Summon Grizzly'.ln12)` |
| petmax | `min(lvl,par3)` |
| calc1 — hp % | `skill('Summon Fenris'.ln12)` |
| calc2 — pet lvl | `ulvl` |
| ToHit (+% AR for usual attacks) | `75 + 20×(L−1)` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Defense: / percent | `ln56` | — |
| Attack: / percent | `ln12` | — |
| Wolves: | `min(lvl,par3)` | — |
| descline4 (formatter 9) | `skill('Summon Grizzly'.ln12)` | — |
| dsc2line1 (formatter 13) | `(skill('summon fenris'.lvl) > 0) ? skill('summon fenris'.ln12) : 0` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Summon Spirit Wolf Receives Bonuses From


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 15 |
| Wolves | L1–20: `1, 2, 3, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5` |
| Damage | L1–20: `2-6, 3-7, 4-8, 6-9, 7-10, 8-12, 9-13, 10-14, 13-16, 15-19, 18-21, 20-24, 22-26, 25-28, 27-31, 30-33, 34-38, 39-43, 44-48, 49-52` |
| Passive Attack Rating Bonus +% | L1–20: `50, 75, 100, 125, 150, 175, 200, 225, 250, 275, 300, 325, 350, 375, 400, 425, 450, 475, 500, 550` |
| Passive Defense Bonus +% | L1–20: `50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 210, 220, 230, 240` |
| Constant / source label | Life: 71 |


**Summon base monster record** — seed values, NOT the final buffed summon. Apply this skill's HP/damage/AR calculations, mastery, summon level, difficulty and generated equipment; absent difficulty HP fields can be supplied by hardcoded handling.

| MonStats field | Value |
| --- | --- |
| Id | `spiritwolf` |
| AI | `DruidWolf` |
| Velocity | `5` |
| Run | `10` |
| aidel | `15` |
| aidel(N) | `15` |
| aidel(H) | `15` |
| aip1 | `22` |
| aip1(N) | `22` |
| aip1(H) | `22` |
| aip2 | `20` |
| aip2(N) | `20` |
| aip2(H) | `20` |
| aip3 | `14` |
| aip3(N) | `14` |
| aip3(H) | `14` |
| aip4 | `20` |
| aip4(N) | `20` |
| aip4(H) | `20` |
| aip5 | `26` |
| aip5(N) | `26` |
| aip5(H) | `26` |
| Skill1 | `Teleport 2` |
| Sk1mode | `S1` |
| Sk1lvl | `1` |
| SkillDamage | `Summon Spirit Wolf` |
| noRatio | `1` |
| minHP | `60` |
| maxHP | `82` |
| AC | `67` |
| A1TH | `50` |
| AC(N) | `67` |
| A1TH(N) | `50` |
| AC(H) | `67` |
| A1TH(H) | `50` |


#### Carrion Vine — ID 231


| Property | Value |
| --- | --- |
| Tree | Summoning Skills |
| Required character level | 12 |
| Immediate prerequisites | Poison Creeper |
| All upstream prerequisites | Poison Creeper |
| Type | summon / active |
| Internal data name | `Cycle of Life` |
| Mana | `max(1, (10)×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |
| pettype | `vine` |
| summon | `cycleoflife` |
| restrict | `1` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 10 | Radius |
| par2 | 0 | Life steal moved --> |
| par3 | 25 | % more hitpoints per level |
| par4 | 0 | ? |
| par5 | 3 | min % life steal |
| par6 | 12 | max % life steal |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| sumskill1: Vine Attack | `lvl` |
| sumskill2: CorpseCycler | `lvl` |
| petmax | `1` |
| calc1 — hp % | `par3 * (lvl-1)` |
| calc2 — vine lvl | `ulvl * 3 / 4 + lvl` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Heals: / percent | `dm56` | — |
| descline3 (formatter 13) | `(lvl-1)*par3` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 10 |
| Life | L1–20: `95, 118, 142, 166, 190, 213, 237, 261, 285, 308, 332, 356, 380, 403, 427, 451, 475, 498, 522, 546` |
| Heals % | L1–20: `4, 5, 6, 6, 7, 7, 8, 8, 8, 9, 9, 9, 9, 9, 10, 10, 10, 10, 10, 10` |


**Summon base monster record** — seed values, NOT the final buffed summon. Apply this skill's HP/damage/AR calculations, mastery, summon level, difficulty and generated equipment; absent difficulty HP fields can be supplied by hardcoded handling.

| MonStats field | Value |
| --- | --- |
| Id | `cycleoflife` |
| AI | `CycleOfLife` |
| Velocity | `7` |
| Run | `7` |
| aidel | `15` |
| aidel(N) | `15` |
| aidel(H) | `15` |
| aip1 | `50` |
| aip1(N) | `50` |
| aip1(H) | `50` |
| aip2 | `20` |
| aip2(N) | `20` |
| aip2(H) | `20` |
| aip3 | `25` |
| aip3(N) | `25` |
| aip3(H) | `25` |
| aip4 | `10` |
| aip4(N) | `10` |
| aip4(H) | `10` |
| aip5 | `35` |
| aip5(N) | `35` |
| aip5(H) | `35` |
| Skill1 | `CorpseCycler` |
| Sk1mode | `S1` |
| Sk1lvl | `1` |
| noRatio | `1` |
| minHP | `80` |
| maxHP | `110` |
| AC | `92` |
| AC(N) | `92` |
| AC(H) | `92` |


#### Heart of Wolverine — ID 236


| Property | Value |
| --- | --- |
| Tree | Summoning Skills |
| Required character level | 18 |
| Immediate prerequisites | Oak Sage |
| All upstream prerequisites | Oak Sage |
| Type | summon / active |
| Internal data name | `Heart of Wolverine` |
| Mana | `max(1, (20 + 1×(L−1))×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |
| pettype | `totem` |
| summon | `heartofwolverine` |
| restrict | `1` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 25 | bonus hitpoints per level |
| par2 | 3 | Bonus Level |
| par3 | 25 | % attack rating bonus |
| par4 | 7 | % attack rating bonus per lvl |
| par5 | 20 | % damage increase |
| par6 | 7 | % damage increase per level |
| par7 | 30 | radius |
| par8 | 2 | radius/lvl |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| passivestat1: poisonresist | `100` |
| passivestat2: maxpoisonresist | `100` |
| sumskill1: Wolverine Aura | `lvl` |
| petmax | `1` |
| calc1 — hp adj | `(lvl-1)*par1` |
| calc2 — totem lvl | `ulvl` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Radius: | `ln78` | — |
| Attack: / percent | `ln34` | — |
| Damage: / percent | `ln56` | — |
| descline5 (formatter 13) | `(lvl-1)*par1` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Mana Cost | L1–20: `20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39` |
| Life | L1–20: `136, 170, 204, 238, 272, 306, 340, 374, 408, 442, 476, 510, 544, 578, 612, 646, 680, 714, 748, 782` |
| Damage +% | L1–20: `20, 27, 34, 41, 48, 55, 62, 69, 76, 83, 90, 97, 104, 111, 118, 125, 132, 139, 146, 153` |
| Attack Rating +% | L1–20: `25, 32, 39, 46, 53, 60, 67, 74, 81, 88, 95, 102, 109, 116, 123, 130, 137, 144, 151, 158` |
| Radius X Yards | L1–20: `20, 21.3, 22.6, 24, 25.3, 26.6, 28, 29.3, 30.6, 32, 33.3, 34.6, 36, 37.3, 38.6, 40, 41.3, 42.6, 44, 45.3` |


**Summon base monster record** — seed values, NOT the final buffed summon. Apply this skill's HP/damage/AR calculations, mastery, summon level, difficulty and generated equipment; absent difficulty HP fields can be supplied by hardcoded handling.

| MonStats field | Value |
| --- | --- |
| Id | `heartofwolverine` |
| AI | `Totem` |
| Velocity | `6` |
| Run | `6` |
| aidel | `15` |
| aidel(N) | `15` |
| aidel(H) | `15` |
| aip1 | `20` |
| aip1(N) | `20` |
| aip1(H) | `20` |
| aip2 | `30` |
| aip2(N) | `30` |
| aip2(H) | `30` |
| aip3 | `30` |
| aip3(N) | `30` |
| aip3(H) | `30` |
| aip4 | `20` |
| aip4(N) | `20` |
| aip4(H) | `20` |
| ResMa | `25` |
| ResFi | `25` |
| ResLi | `25` |
| ResCo | `25` |
| ResPo | `70` |
| ResDm(N) | `100` |
| ResMa(N) | `25` |
| ResFi(N) | `25` |
| ResLi(N) | `25` |
| ResCo(N) | `25` |
| ResPo(N) | `100` |
| ResMa(H) | `25` |
| ResFi(H) | `25` |
| ResLi(H) | `25` |
| ResCo(H) | `25` |
| ResPo(H) | `100` |
| noRatio | `1` |
| minHP | `128` |
| maxHP | `144` |
| AC | `123` |
| AC(N) | `123` |
| AC(H) | `123` |


#### Summon Dire Wolf — ID 237


| Property | Value |
| --- | --- |
| Tree | Summoning Skills |
| Required character level | 18 |
| Immediate prerequisites | Oak Sage, Summon Spirit Wolf |
| All upstream prerequisites | Oak Sage, Raven, Summon Spirit Wolf |
| Type | summon / active |
| Internal data name | `Summon Fenris` |
| Mana | `max(1, (20)×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |
| pettype | `fenris` |
| summon | `fenris` |
| restrict | `1` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| Physical (raw) | 7–12 | 2–2 | 3–3 | 6–6 | 8–9 | 11–13 |
| Physical (HP equivalent / see channel role; ×1) | 7–12 | 2–2 | 3–3 | 6–6 | 8–9 | 11–13 |
| Physical unsynergized L20 | 69–74 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 50 | % feral hitpoints |
| par2 | 25 | % feral hitpoints per level |
| par3 | 3 | max fenri |
| par4 | 500 | rage duration - see fenris rage |
| par5 | 100 | % damage with rage - see fenris rage |
| par6 | 4 | defense points per level |
| par7 | 0 | resist |
| par8 | 5 | resist/lvl |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurastat1: fireresist | `min(ln78,85)` |
| aurastat2: coldresist | `min(ln78,85)` |
| aurastat3: lightresist | `min(ln78,85)` |
| aurastat4: poisonresist | `min(ln78,85)` |
| passivestat1: item_armor_percent | `(par6 * lvl) + skill('Summon Spirit Wolf'.ln56)` |
| passivestat2: tohit | `skill('Summon Spirit Wolf'.ln12)` |
| passivestat3: damagepercent | `skill('Summon Grizzly'.ln12)` |
| petmax | `min(lvl,par3)` |
| calc1 — hp% | `ln12` |
| calc2 — pet lvl | `ulvl` |
| ToHit (+% AR for usual attacks) | `150 + 20×(L−1)` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Life: / percent | `ln12` | — |
| Wolves: | `min(lvl,par3)` | — |
| descline3 (formatter 9) | `skill('Summon Grizzly'.ln12)` | — |
| descline4 (formatter 13) | `ln12` | — |
| Defense: / percent | `skill('Summon Spirit Wolf'.ln56)` | — |
| Attack: / percent | `skill('Summon Spirit Wolf'.ln12)` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Summon Dire Wolf Receives Bonuses From:


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 20 |
| Wolves | L1–20: `1, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3` |
| Passive Life % Bonus To Bears and Wolves | L1–20: `50, 75, 100, 125, 150, 175, 200, 225, 250, 275, 300, 325, 350, 375, 400, 425, 450, 475, 500, 525` |
| Damage | L1–20: `7-12, 9-14, 11-16, 13-18, 15-20, 17-22, 19-24, 21-26, 24-29, 27-32, 30-35, 33-38, 36-41, 39-44, 42-47, 45-50, 51-56, 57-62, 63-68, 69-74` |
| Constant / source label | Life 114 |


**Summon base monster record** — seed values, NOT the final buffed summon. Apply this skill's HP/damage/AR calculations, mastery, summon level, difficulty and generated equipment; absent difficulty HP fields can be supplied by hardcoded handling.

| MonStats field | Value |
| --- | --- |
| Id | `fenris` |
| AI | `DruidWolf` |
| Velocity | `5` |
| Run | `10` |
| aidel | `15` |
| aidel(N) | `15` |
| aidel(H) | `15` |
| aip1 | `22` |
| aip1(N) | `22` |
| aip1(H) | `22` |
| aip2 | `20` |
| aip2(N) | `20` |
| aip2(H) | `20` |
| aip3 | `25` |
| aip3(N) | `25` |
| aip3(H) | `25` |
| aip4 | `24` |
| aip4(N) | `24` |
| aip4(H) | `24` |
| aip5 | `30` |
| aip5(N) | `30` |
| aip5(H) | `30` |
| Skill1 | `fenris rage` |
| Sk1mode | `A1` |
| Sk1lvl | `1` |
| Skill2 | `Teleport 2` |
| Sk2mode | `S1` |
| Sk2lvl | `1` |
| SkillDamage | `Summon Fenris` |
| noRatio | `1` |
| minHP | `98` |
| maxHP | `130` |
| AC | `116` |
| A1TH | `150` |
| AC(N) | `116` |
| A1TH(N) | `150` |
| AC(H) | `116` |
| A1TH(H) | `150` |


#### Solar Creeper — ID 241


| Property | Value |
| --- | --- |
| Tree | Summoning Skills |
| Required character level | 24 |
| Immediate prerequisites | Carrion Vine |
| All upstream prerequisites | Poison Creeper, Carrion Vine |
| Type | summon / active |
| Internal data name | `Vines` |
| Mana | `max(1, (14 + 1×(L−1))×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |
| pettype | `vine` |
| summon | `vinecreature` |
| restrict | `1` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 3 | Number of vines |
| par2 | 1 | vines per level |
| par3 | 20 | % more hitpoints per level |
| par4 | 0 | Mana steal moved --> |
| par5 | 1 | min % mana steal |
| par6 | 8 | max % mana steal |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| sumskill1: Vine Attack | `lvl` |
| sumskill2: VineCycler | `lvl` |
| petmax | `1` |
| calc1 — hp % | `par3 * (lvl-1)` |
| calc2 — vine lvl | `ulvl * 3 / 4 + lvl` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Mana Recovery Rate: / percent | `dm56` | — |
| descline4 (formatter 13) | `(lvl-1)*par3` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Mana Cost | L1–20: `14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33` |
| Life | L1–20: `165, 198, 231, 264, 297, 330, 363, 396, 429, 462, 495, 528, 561, 594, 627, 660, 693, 726, 759, 792` |
| Mana Recovery Rate % | L1–20: `2, 2, 3, 4, 4, 4, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6` |


**Summon base monster record** — seed values, NOT the final buffed summon. Apply this skill's HP/damage/AR calculations, mastery, summon level, difficulty and generated equipment; absent difficulty HP fields can be supplied by hardcoded handling.

| MonStats field | Value |
| --- | --- |
| Id | `vinecreature` |
| AI | `CycleOfLife` |
| Velocity | `7` |
| Run | `7` |
| aidel | `15` |
| aidel(N) | `15` |
| aidel(H) | `15` |
| aip1 | `50` |
| aip1(N) | `50` |
| aip1(H) | `50` |
| aip2 | `20` |
| aip2(N) | `20` |
| aip2(H) | `20` |
| aip3 | `25` |
| aip3(N) | `25` |
| aip3(H) | `25` |
| aip4 | `10` |
| aip4(N) | `10` |
| aip4(H) | `10` |
| aip5 | `35` |
| aip5(N) | `35` |
| aip5(H) | `35` |
| Skill1 | `VineCycler` |
| Sk1mode | `S1` |
| Sk1lvl | `1` |
| noRatio | `1` |
| minHP | `138` |
| maxHP | `192` |
| AC | `165` |
| AC(N) | `165` |
| AC(H) | `165` |


#### Spirit of Barbs — ID 246


| Property | Value |
| --- | --- |
| Tree | Summoning Skills |
| Required character level | 30 |
| Immediate prerequisites | Heart of Wolverine |
| All upstream prerequisites | Oak Sage, Heart of Wolverine |
| Type | summon / active |
| Internal data name | `Spirit of Barbs` |
| Mana | `max(1, (25 + 1×(L−1))×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |
| pettype | `totem` |
| summon | `spiritofbarbs` |
| restrict | `1` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 25 | % hitpoints more per level |
| par2 | 0 | Bonus Level |
| par3 | 50 | % thorns damage back |
| par4 | 20 | % thorns damage back per level |
| par7 | 30 | radius |
| par8 | 2 | radius/lvl |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| passivestat1: poisonresist | `100` |
| passivestat2: maxpoisonresist | `100` |
| sumskill1: Barbs Aura | `lvl` |
| petmax | `1` |
| calc1 — hp adj | `(lvl-1)*par1` |
| calc2 — totem lvl | `ulvl` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Radius: | `ln78` | — |
| percent damage returned | `ln34` | — |
| descline4 (formatter 13) | `(lvl-1)*par1` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Mana Cost | L1–20: `25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44` |
| Life | L1–20: `213, 266, 319, 372, 426, 479, 532, 585, 639, 692, 745, 798, 852, 905, 958, 1011, 1065, 1118, 1171, 1224` |
| % Damage Returned | L1–20: `50, 70, 90, 110, 130, 150, 170, 190, 210, 230, 250, 270, 290, 310, 330, 350, 370, 390, 410, 430` |
| Radius X Yards | L1–20: `20, 21.3, 22.6, 24, 25.3, 26.6, 28, 29.3, 30.6, 32, 33.3, 34.6, 36, 37.3, 38.6, 40, 41.3, 42.6, 44, 45.3` |


**Summon base monster record** — seed values, NOT the final buffed summon. Apply this skill's HP/damage/AR calculations, mastery, summon level, difficulty and generated equipment; absent difficulty HP fields can be supplied by hardcoded handling.

| MonStats field | Value |
| --- | --- |
| Id | `spiritofbarbs` |
| AI | `Totem` |
| Velocity | `6` |
| Run | `6` |
| aidel | `15` |
| aidel(N) | `15` |
| aidel(H) | `15` |
| aip1 | `20` |
| aip1(N) | `20` |
| aip1(H) | `20` |
| aip2 | `30` |
| aip2(N) | `30` |
| aip2(H) | `30` |
| aip3 | `30` |
| aip3(N) | `30` |
| aip3(H) | `30` |
| aip4 | `20` |
| aip4(N) | `20` |
| aip4(H) | `20` |
| ResMa | `25` |
| ResFi | `25` |
| ResLi | `25` |
| ResCo | `25` |
| ResPo | `70` |
| ResDm(N) | `100` |
| ResMa(N) | `25` |
| ResFi(N) | `25` |
| ResLi(N) | `25` |
| ResCo(N) | `25` |
| ResPo(N) | `100` |
| ResMa(H) | `25` |
| ResFi(H) | `25` |
| ResLi(H) | `25` |
| ResCo(H) | `25` |
| ResPo(H) | `100` |
| noRatio | `1` |
| minHP | `200` |
| maxHP | `226` |
| AC | `196` |
| AC(N) | `196` |
| AC(H) | `196` |


#### Summon Grizzly — ID 247


| Property | Value |
| --- | --- |
| Tree | Summoning Skills |
| Required character level | 30 |
| Immediate prerequisites | Summon Dire Wolf |
| All upstream prerequisites | Oak Sage, Raven, Summon Spirit Wolf, Summon Dire Wolf |
| Type | summon / active |
| Internal data name | `Summon Grizzly` |
| Mana | `max(1, (40)×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |
| pettype | `grizzly` |
| summon | `druidbear` |
| restrict | `1` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| Physical (raw) | 30–60 | 10–10 | 15–15 | 20–20 | 26–26 | 30–30 |
| Physical (HP equivalent / see channel role; ×1) | 30–60 | 10–10 | 15–15 | 20–20 | 26–26 | 30–30 |
| Physical unsynergized L20 | 300–330 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 25 | % feral add to damage |
| par2 | 10 | % feral damage per level |
| par7 | 0 | resist |
| par8 | 5 | resist/lvl |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurastat1: fireresist | `min(ln78,85)` |
| aurastat2: coldresist | `min(ln78,85)` |
| aurastat3: lightresist | `min(ln78,85)` |
| aurastat4: poisonresist | `min(ln78,85)` |
| passivestat1: damagepercent | `ln12` |
| passivestat2: tohit | `skill('Summon Spirit Wolf'.ln12)` |
| passivestat3: item_armor_percent | `skill('Summon Spirit Wolf'.ln56)` |
| petmax | `1` |
| calc1 — hp % | `skill('Summon Fenris'.ln12)` |
| calc2 — pet lvl | `ulvl` |
| ToHit (+% AR for usual attacks) | `300 + 20×(L−1)` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Damage: / percent | `ln12` | — |
| descline2 (formatter 9) | `ln12` | — |
| Defense: / percent | `skill('Summon Spirit Wolf'.ln56)` | — |
| Attack: / percent | `skill('Summon Spirit Wolf'.ln12)` | — |
| dsc2line3 (formatter 13) | `skill('summon fenris'.ln12)` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Summon Grizzly Receives Bonuses From


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 40 |
| Damage | L1–20: `37-75, 54-94, 72-116, 93-139, 115-165, 140-192, 166-222, 195-253, 235-297, 279-344, 326-393, 376-446, 428-502, 484-561, 543-622, 605-687, 684-769, 767-855, 854-945, 945-1039` |
| Passive % Damage Bonus To Wolves and Bears | L1–20: `25, 35, 45, 55, 65, 75, 85, 95, 105, 115, 125, 135, 145, 155, 165, 175, 185, 195, 205, 215` |
| Constant / source label | Life: 650 |


**Summon base monster record** — seed values, NOT the final buffed summon. Apply this skill's HP/damage/AR calculations, mastery, summon level, difficulty and generated equipment; absent difficulty HP fields can be supplied by hardcoded handling.

| MonStats field | Value |
| --- | --- |
| Id | `druidbear` |
| AI | `DruidBear` |
| Velocity | `5` |
| Run | `9` |
| aidel | `15` |
| aidel(N) | `15` |
| aidel(H) | `15` |
| aip1 | `15` |
| aip1(N) | `15` |
| aip1(H) | `15` |
| aip2 | `40` |
| aip2(N) | `40` |
| aip2(H) | `40` |
| aip3 | `50` |
| aip3(N) | `50` |
| aip3(H) | `50` |
| Skill1 | `BearSmite` |
| Sk1mode | `seq_bearsmite` |
| Sk1lvl | `1` |
| SkillDamage | `Summon Grizzly` |
| noRatio | `1` |
| minHP | `550` |
| maxHP | `750` |
| AC | `245` |
| A1TH | `300` |
| AC(N) | `245` |
| A1TH(N) | `300` |
| AC(H) | `245` |
| A1TH(H) | `300` |


### Shape Shifting Skills

Source display tables: [Arreat Summit — Shape Shifting Skills](http://classic.battle.net/diablo2exp/skills/druid-shapeshifting.shtml). Exact fields: pinned Skills.txt / SkillDesc.txt / Missiles.txt listed in §0.


| ID | Skill | Required clvl | Immediate prerequisites | Type | Mana expression |
| --- | --- | --- | --- | --- | --- |
| 223 | Werewolf | 1 | None | active | `max(1, (15)×1)` |
| 224 | Lycanthropy | 1 | Werewolf | passive | `0` |
| 228 | Werebear | 6 | None | active | `max(1, (15)×1)` |
| 232 | Feral Rage | 12 | Werewolf | active | `max(1, (3)×1)` |
| 233 | Maul | 12 | Werebear | active | `max(1, (3)×1)` |
| 238 | Rabies | 18 | Feral Rage | active | `max(1, (10)×1)` |
| 239 | Fire Claws | 18 | Feral Rage, Maul | active | `max(1, (4)×1)` |
| 242 | Hunger | 24 | Fire Claws | active | `max(1, (3)×1)` |
| 243 | Shock Wave | 24 | Maul | active | `max(1, (7)×1)` |
| 248 | Fury | 30 | Rabies | active | `max(1, (4)×1)` |


#### Werewolf — ID 223


| Property | Value |
| --- | --- |
| Tree | Shape Shifting Skills |
| Required character level | 1 |
| Immediate prerequisites | None |
| All upstream prerequisites | None |
| Type | active |
| Internal data name | `Wearwolf` |
| Mana | `max(1, (15)×1)` |
| Animation / source-damage field | `SC; SrcDam=128 /128` |
| Shared casting delay | 25 frames = 1 seconds |
| restrict | `1` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 25 | % stamina increase |
| par2 | 25 | % hitpoints increase |
| par3 | 10 | % min speed increase |
| par4 | 80 | % max speed increase |
| par5 | 0 | ? |
| par6 | 0 | ? |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurastat1: skill_staminapercent | `par1` |
| aurastat2: attackrate | `dm34` |
| aurastat3: item_tohit_percent | `toht` |
| aurastat4: item_maxhp_percent | `par2+skill('Shape Shifting'.ln34)` |
| auralencalc | `1000+skill('Shape Shifting'.ln12)` |
| ToHit (+% AR for usual attacks) | `50 + 15×(L−1)` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Attack Speed: / percent | `dm34` | — |
| To Attack Rating: / percent | `toht` | — |
| Duration: | `1000+skill('shape shifting'.ln12)` | — |
| Stamina Bonus: / percent | `par1` | — |
| Life: / percent | `par2+skill('shape shifting'.ln34)` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Werewolf Receives Bonuses From:


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 15 |
| Constant / source label | Duration: 40 Seconds |
| Attack Speed +% | L1–20: `20, 28, 35, 40, 45, 48, 51, 53, 56, 57, 59, 61, 62, 63, 64, 66, 66, 67, 68, 68` |
| Attack Rating +% | L1–20: `50, 65, 80, 95, 110, 125, 140, 155, 170, 185, 200, 215, 230, 245, 260, 275, 290, 305, 320, 335` |
| Constant / source label | Life +25% |
| Constant / source label | Stamina: +25% |


#### Lycanthropy — ID 224


| Property | Value |
| --- | --- |
| Tree | Shape Shifting Skills |
| Required character level | 1 |
| Immediate prerequisites | Werewolf |
| All upstream prerequisites | Werewolf |
| Type | passive |
| Internal data name | `Shape Shifting` |
| Mana | `0` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 1000 | Base duration of all forms |
| par2 | 500 | Bonus duration per level |
| par3 | 20 | % base hitpoint bonus |
| par4 | 5 | % hitpoints per level |
| par5 | 0 | ? |
| par6 | 0 | ? |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Duration: | `ln12` | — |
| Max Life: / percent | `ln34` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Max Life +% | L1–20: `20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115` |
| Duration +X Seconds | L1–20: `40, 60, 80, 100, 120, 140, 160, 180, 200, 220, 240, 260, 280, 300, 320, 340, 360, 380, 400, 420` |


#### Werebear — ID 228


| Property | Value |
| --- | --- |
| Tree | Shape Shifting Skills |
| Required character level | 6 |
| Immediate prerequisites | None |
| All upstream prerequisites | None |
| Type | active |
| Internal data name | `Wearbear` |
| Mana | `max(1, (15)×1)` |
| Animation / source-damage field | `SC; SrcDam=128 /128` |
| Shared casting delay | 25 frames = 1 seconds |
| restrict | `1` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 55 | % Base bonus damage |
| par2 | 8 | % bonus damage per level |
| par3 | 25 | % increase armorclass |
| par4 | 6 | % armor class per level |
| par5 | 75 | % Base bonus hitpoints |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurastat1: damagepercent | `ln12` |
| aurastat2: skill_armor_percent | `ln34` |
| aurastat3: item_maxhp_percent | `par5 + skill('Shape Shifting'.ln34)` |
| auralencalc | `1000+skill('Shape Shifting'.ln12)` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Defense: / percent | `ln34` | — |
| Damage: / percent | `ln12` | — |
| Duration: | `1000+skill('shape shifting'.ln12)` | — |
| Life: / percent | `par5 + skill('Shape Shifting'.ln34)` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Werebear Receives Bonuses From


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 15 |
| Constant / source label | Duration: 40 Seconds |
| Damage +% | L1–20: `55, 63, 71, 79, 87, 95, 103, 111, 119, 127, 135, 143, 151, 159, 167, 175, 183, 191, 199, 207` |
| Defense +% | L1–20: `25, 31, 37, 43, 49, 55, 61, 67, 73, 79, 85, 91, 97, 103, 109, 115, 121, 127, 133, 139` |
| Constant / source label | Life +75% |


#### Feral Rage — ID 232


| Property | Value |
| --- | --- |
| Tree | Shape Shifting Skills |
| Required character level | 12 |
| Immediate prerequisites | Werewolf |
| All upstream prerequisites | Werewolf |
| Type | active |
| Internal data name | `Feral Rage` |
| Mana | `max(1, (3)×1)` |
| Animation / source-damage field | `A1; SrcDam=128 /128` |
| restrict | `2` |
| State1 | `wolf` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 500 | duration |
| par2 | 4 | % life steal per hit |
| par3 | 10 | Min Speed boost |
| par4 | 70 | Max Speed boost |
| par5 | 50 | % damage increase |
| par6 | 5 | % damage increase per level |
| par7 | 2 | Levels per charge |
| par8 | 3 | Min charge |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurastat1: velocitypercent | `dm34` |
| aurastat2: lifedrainmindam | `par2 * lvl` |
| aurastat3: lifedrainmaxdam | `par2 * lvl` |
| auralencalc | `par1` |
| calc1 — dmg% | `ln56` |
| calc2 | `lvl/par7 + par8` |
| ToHit (+% AR for usual attacks) | `20 + 10×(L−1)` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Attack: / percent | `toht` | — |
| Damage: / percent | `ln56` | — |
| Life Steal: / percent | `4` | `par2 * lvl + 8` |
| Walk/Run Speed: / percent | `19` | `((110*(par8+lvl/par7)) * (par4-par3))/(100 * ((par8+lvl/par7)+6)) + par3` |
| Duration: | `par1` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 3 |
| Constant / source label | Duration: 20 Seconds |
| Damage +% | L1–20: `50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120, 125, 130, 135, 140, 145` |
| Attack +% | L1–20: `20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 210` |
| Life Steal % | L1–20: `4-12, 4-16, 4-20, 4-24, 4-28, 4-32, 4-36, 4-40, 4-44, 4-48, 4-52, 4-56, 4-60, 4-64, 4-68, 4-72, 4-76, 4-80, 4-84, 4-88` |
| Walk/Run Speed +% | L1–20: `19-31, 19-36, 19-36, 19-40, 19-40, 19-43, 19-43, 19-45, 19-45, 19-47, 19-47, 19-49, 19-49, 19-50, 19-50, 19-52, 19-52, 19-53, 19-53, 19-55` |


#### Maul — ID 233


| Property | Value |
| --- | --- |
| Tree | Shape Shifting Skills |
| Required character level | 12 |
| Immediate prerequisites | Werebear |
| All upstream prerequisites | Werebear |
| Type | active |
| Internal data name | `Maul` |
| Mana | `max(1, (3)×1)` |
| Animation / source-damage field | `A1; SrcDam=128 /128` |
| restrict | `2` |
| State1 | `bear` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par3 | 20 | damage per charge |
| par4 | 500 | duration |
| par5 | 10 | min stun duration |
| par6 | 100 | max stun duration |
| par7 | 2 | Levels per charge |
| par8 | 3 | Min charge |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurastat1: damagepercent | `lvl*par3` |
| aurastat2: stunlength | `dm56` |
| auralencalc | `par4` |
| calc2 | `lvl/par7 + par8` |
| ToHit (+% AR for usual attacks) | `20 + 10×(L−1)` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Attack: / percent | `toht` | — |
| Damage: / percent | `par3` | `par3 * (lvl/par7+par8)` |
| Stun Length: | `dm56` | — |
| Duration: | `par4` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 3 |
| Constant / source label | Duration: 20 Seconds |
| Damage +% | L1–20: `20-60, 20-80, 20-80, 20-100, 20-100, 20-120, 20-120, 20-140, 20-140, 20-160, 20-160, 20-180, 20-180, 20-200, 20-200, 20-220, 20-220, 20-240, 20-240, 20-260` |
| Attack +% | L1–20: `20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 210` |
| Stun Length (Seconds) | L1–20: `0.9, 1.3, 1.6, 1.9, 2.2, 2.3, 2.5, 2.6, 2.7, 2.8, 2.9, 3, 3, 3.1, 3.2, 3.2, 3.2, 3.3, 3.3, 3.4` |


#### Rabies — ID 238


| Property | Value |
| --- | --- |
| Tree | Shape Shifting Skills |
| Required character level | 18 |
| Immediate prerequisites | Feral Rage |
| All upstream prerequisites | Werewolf, Feral Rage |
| Type | active |
| Internal data name | `Rabies` |
| Mana | `max(1, (10)×1)` |
| Animation / source-damage field | `S3; SrcDam=0 /128` |
| restrict | `2` |
| State1 | `wolf` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / pois (raw) | 6–14 | 4–4 | 5–5 | 7–7 | 11–11 | 16–16 |
| E / pois (rate HP/frame; ×0.03125) | 0.1875–0.4375 | 0.125–0.125 | 0.15625–0.15625 | 0.21875–0.21875 | 0.34375–0.34375 | 0.5–0.5 |
| E / pois unsynergized L20 | 3.1875–3.4375 | — | — | — | — | — |
| Poison total HP, L1 / L20 (no item/synergy) | 18.75–43.75 / 924.375–996.875 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par8 | 18 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| EDmgSymPerCalc | `(skill('Plague Poppy'.blvl))*par8` |
| ToHit (+% AR for usual attacks) | `50 + 7×(L−1)` |
| E length: frames, L1; increments L2–8 / L9–16 / L17+ | `100; 10 / 10 / 10` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Attack: / percent | `toht` | — |
| Poison Creeper / Poison Damage per Level | `par8` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Rabies Receives Bonuses From
- Poison Creeper: +18% Poison Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 10 |
| Poison Damage Over... | L1–20: `18-43, 34-61, 52-82, 73-105, 96-131, 121-159, 150-190, 180-223, 219-264, 261-308, 306-356, 354-406, 405-460, 460-517, 517-577, 578-640, 658-723, 742-810, 831-901, 924-996` |
| ... X Seconds | L1–20: `4, 4.4, 4.8, 5.2, 5.6, 6, 6.4, 6.8, 7.2, 7.6, 8, 8.4, 8.8, 9.2, 9.6, 10, 10.4, 10.8, 11.2, 11.6` |
| Attack +% | L1–20: `50, 57, 64, 71, 78, 85, 92, 99, 106, 113, 120, 127, 134, 141, 148, 155, 162, 169, 176, 183` |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **rabiesplague** (Missiles ID 515): `pSrvDoFunc`=`30`; `Param1`=`4`; `Param2`=`7`; `Range`=`10`; `LevRange`=`5`; `CollideType`=`3`; `Size`=`3`; `HitShift`=`8`; `SubMissile1`=`rabiescontagion`.


Component **rabiescontagion** (Missiles ID 516): `pSrvDoFunc`=`1`; `pSrvHitFunc`=`53`; `pSrvDmgFunc`=`11`; `Vel`=`5`; `MaxVel`=`5`; `Range`=`20`; `CollideType`=`3`; `LastCollide`=`1`; `Size`=`1`; `Skill`=`Rabies`; `HitShift`=`8`.




#### Fire Claws — ID 239


| Property | Value |
| --- | --- |
| Tree | Shape Shifting Skills |
| Required character level | 18 |
| Immediate prerequisites | Feral Rage, Maul |
| All upstream prerequisites | Werewolf, Feral Rage, Werebear, Maul |
| Type | active |
| Internal data name | `Fire Claws` |
| Mana | `max(1, (4)×1)` |
| Animation / source-damage field | `A1; SrcDam=128 /128` |
| restrict | `2` |
| State1 | `wolf` |
| State2 | `bear` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / fire (raw) | 15–20 | 8–8 | 12–12 | 20–22 | 24–26 | 30–34 |
| E / fire (HP equivalent / see channel role; ×1) | 15–20 | 8–8 | 12–12 | 20–22 | 24–26 | 30–34 |
| E / fire unsynergized L20 | 247–260 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par8 | 22 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| EDmgSymPerCalc | `(skill('Firestorm'.blvl)+skill('Molten Boulder'.blvl)+skill('Volcano'.blvl)+skill('Eruption'.blvl))*par8` |
| ToHit (+% AR for usual attacks) | `50 + 15×(L−1)` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Attack: / percent | `toht` | — |
| Firestorm / Fire Damage per Level | `par8` | — |
| Molten Boulder / Fire Damage per Level | `par8` | — |
| Fissure / Fire Damage per Level | `par8` | — |
| Volcano / Fire Damage per Level | `par8` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Fire Claws Receives Bonuses From
- Firestorm: +22% Fire Damage Per Level
- Molten Boulder: +22% Fire Damage Per Level
- Fissure: +22% Fire Damage Per Level
- Volcano: +22% Fire Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 4 |
| Fire Damage | L1–20: `15-20, 23-28, 31-36, 39-44, 47-52, 55-60, 63-68, 71-76, 83-88, 95-100, 107-112, 119-124, 131-136, 143-148, 155-160, 167-172, 187-194, 207-216, 227-238, 247-260` |
| Attack +% | L1–20: `50, 65, 80, 95, 110, 125, 140, 155, 170, 185, 200, 215, 230, 245, 260, 275, 290, 305, 320, 335` |


#### Hunger — ID 242


| Property | Value |
| --- | --- |
| Tree | Shape Shifting Skills |
| Required character level | 24 |
| Immediate prerequisites | Fire Claws |
| All upstream prerequisites | Werewolf, Feral Rage, Werebear, Maul, Fire Claws |
| Type | active |
| Internal data name | `Hunger` |
| Mana | `max(1, (3)×1)` |
| Animation / source-damage field | `S3; SrcDam=128 /128` |
| restrict | `2` |
| State1 | `wolf` |
| State2 | `bear` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 50 | min % life steal |
| par2 | 200 | max % life steal |
| par3 | 50 | min % mana steal |
| par4 | 200 | max % mana steal |
| par5 | -75 | % damage penalty |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| calc1 — dmg% | `par5` |
| calc2 — lifesteal | `dm12` |
| calc3 — manasteal | `dm34` |
| ToHit (+% AR for usual attacks) | `50 + 10×(L−1)` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Attack: / percent | `toht` | — |
| Mana Steal: / percent | `dm34` | — |
| Life Steal: / percent | `dm12` | — |
| Damage: / percent | `par5` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 3 |
| Constant / source label | Damage: -75% |
| Attack +% | L1–20: `50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 210, 220, 230, 240` |
| Life Steal % | L1–20: `72, 90, 104, 116, 125, 132, 138, 143, 149, 152, 156, 159, 162, 165, 167, 170, 171, 173, 174, 176` |
| Mana Steal % | L1–20: `72, 90, 104, 116, 125, 132, 138, 143, 149, 152, 156, 159, 162, 165, 167, 170, 171, 173, 174, 176` |


#### Shock Wave — ID 243


| Property | Value |
| --- | --- |
| Tree | Shape Shifting Skills |
| Required character level | 24 |
| Immediate prerequisites | Maul |
| All upstream prerequisites | Werebear, Maul |
| Type | active |
| Internal data name | `Shock Wave` |
| Mana | `max(1, (7)×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |
| restrict | `2` |
| State1 | `bear` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| Physical (raw) | 10–20 | 3–3 | 5–5 | 7–7 | 7–7 | 7–7 |
| Physical (HP equivalent / see channel role; ×1) | 10–20 | 3–3 | 5–5 | 7–7 | 7–7 | 7–7 |
| Physical unsynergized L20 | 99–109 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 40 | stun length |
| par2 | 15 | stun length per level |
| par8 | 5 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| calc1 — # missiles | `5` |
| DmgSymPerCalc | `skill('Maul'.blvl)*par8` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Stun Length: | `ln12` | — |
| Maul / Damage per Level | `par8` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Shock Wave Receives Bonuses From
- Maul: +5% Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 7 |
| Damage | L1–20: `10-21, 13-24, 16-27, 19-30, 23-33, 26-36, 29-39, 32-43, 37-48, 43-53, 48-58, 53-64, 58-69, 64-74, 69-79, 74-85, 81-92, 89-99, 96-107, 103-114` |
| Stun Length (Seconds) | L1–20: `1.6, 2.2, 2.8, 3.4, 4, 4.6, 5.2, 5.8, 6.4, 7, 7.6, 8.2, 8.8, 9.4, 10, 10.6, 11.2, 11.8, 12.4, 13` |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **shockwave** (Missiles ID 511): `pSrvDoFunc`=`1`; `pSrvDmgFunc`=`7`; `Vel`=`20`; `MaxVel`=`20`; `Range`=`14`; `CollideType`=`3`; `LastCollide`=`1`; `NextHit`=`1`; `NextDelay`=`4`; `Size`=`1`; `GetHit`=`1`; `Skill`=`Shock Wave`; `ResultFlags`=`4`.




#### Fury — ID 248


| Property | Value |
| --- | --- |
| Tree | Shape Shifting Skills |
| Required character level | 30 |
| Immediate prerequisites | Rabies |
| All upstream prerequisites | Werewolf, Feral Rage, Rabies |
| Type | active |
| Internal data name | `Fury` |
| Mana | `max(1, (4)×1)` |
| Animation / source-damage field | `A1; SrcDam=128 /128` |
| restrict | `2` |
| State1 | `wolf` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par2 | 100 | % frame rollback |
| par3 | 100 | % damage percent |
| par4 | 17 | damage % per level |
| par5 | 2 | Targets |
| par6 | 5 | Max targets |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| calc1 — max targets | `min((par5 + lvl -1), par6)` |
| calc2 — damage % | `ln34` |
| ToHit (+% AR for usual attacks) | `50 + 7×(L−1)` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Damage: / percent | `ln34` | — |
| Attack Bonus: / percent | `toht` | — |
| hits | `min((par5+lvl-1),par6)` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 4 |
| Attack +% | L1–20: `50, 57, 64, 71, 78, 85, 92, 99, 106, 113, 120, 127, 134, 141, 148, 155, 162, 169, 176, 183` |
| Damage +% | L1–20: `100, 117, 134, 151, 168, 185, 202, 219, 236, 253, 270, 287, 304, 321, 338, 355, 372, 389, 406, 423` |
| Hits | L1–20: `2, 3, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5` |


### Elemental Skills

Source display tables: [Arreat Summit — Elemental Skills](http://classic.battle.net/diablo2exp/skills/druid-elemental.shtml). Exact fields: pinned Skills.txt / SkillDesc.txt / Missiles.txt listed in §0.


| ID | Skill | Required clvl | Immediate prerequisites | Type | Mana expression |
| --- | --- | --- | --- | --- | --- |
| 225 | Firestorm | 1 | None | active | `max(1, (4)×1)` |
| 229 | Molten Boulder | 6 | Firestorm | active | `max(1, (20 + 1×(L−1))×0.5)` |
| 230 | Arctic Blast | 6 | None | active | `(24 + 1×(L−1))×0.015625 per continuous debit; see startmana/server routine` |
| 234 | Fissure | 12 | Molten Boulder | active | `max(1, (15)×1)` |
| 235 | Cyclone Armor | 12 | Arctic Blast | active | `max(1, (5 + 1×(L−1))×1)` |
| 240 | Twister | 18 | Cyclone Armor | active | `max(1, (7)×1)` |
| 244 | Volcano | 24 | Fissure | active | `max(1, (25)×1)` |
| 245 | Tornado | 24 | Twister | active | `max(1, (10)×1)` |
| 249 | Armageddon | 30 | Volcano, Hurricane | active | `max(1, (35)×1)` |
| 250 | Hurricane | 30 | Tornado | active | `max(1, (30)×1)` |


#### Firestorm — ID 225


| Property | Value |
| --- | --- |
| Tree | Elemental Skills |
| Required character level | 1 |
| Immediate prerequisites | None |
| All upstream prerequisites | None |
| Type | active |
| Internal data name | `Firestorm` |
| Mana | `max(1, (4)×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |
| Shared casting delay | 15 frames = 0.6 seconds |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / fire (raw) | 3–6 | 3–3 | 5–6 | 7–8 | 14–15 | 21–23 |
| E / fire (HP equivalent / see channel role; ×0.015625) | 0.046875–0.09375 | 0.046875–0.046875 | 0.078125–0.09375 | 0.109375–0.125 | 0.21875–0.234375 | 0.328125–0.359375 |
| E / fire unsynergized L20 | 1.4375–1.671875 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 3 | Number of missiles |
| par2 | 0 | Number of missiles per level |
| par3 | 0 | ? |
| par4 | 0 | ? |
| par5 | 0 | ? |
| par6 | 0 | ? |
| par8 | 23 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| calc1 — # missiles | `ln12` |
| EDmgSymPerCalc | `(skill('Molten Boulder'.blvl)+skill('Eruption'.blvl))*par8` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Molten Boulder / Fire Damage per Level | `par8` | — |
| Fissure / Fire Damage per Level | `par8` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Firestorm Receives Bonuses From
- Molten Boulder: +23% Fire Damage Per Level
- Fissure: +23% Fire Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 4 |
| Average Fire Damage Per Second | L1–20: `3-7, 7-10, 10-14, 14-17, 17-21, 21-24, 24-28, 28-31, 32-36, 37-41, 42-45, 46-50, 51-55, 56-59, 60-64, 65-69, 71-76, 77-83, 83-90, 89-97` |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **firestormmaker** (Missiles ID 458): `pSrvDoFunc`=`23`; `Vel`=`8`; `MaxVel`=`8`; `Range`=`40`; `CollideType`=`8`; `LastCollide`=`1`; `Size`=`2`; `SubMissile1`=`firestorm`.


Component **firestorm** (Missiles ID 457): `pSrvDoFunc`=`1`; `Range`=`15`; `CollideType`=`3`; `Size`=`2`; `Skill`=`Firestorm`; `DamageRate`=`41`.


Component **firesmall** (Missiles ID 104): `pSrvDoFunc`=`1`; `Range`=`90`; `LevRange`=`25`; `CollideType`=`3`; `Size`=`1`; `EType`=`fire`.


| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / fire (raw) | 1–1 | 1–1 | 1–1 | 1–1 | 1–1 | 1–1 |
| E / fire (HP equivalent / see channel role; ×0.00390625) | 0.00390625–0.00390625 | 0.00390625–0.00390625 | 0.00390625–0.00390625 | 0.00390625–0.00390625 | 0.00390625–0.00390625 | 0.00390625–0.00390625 |
| E / fire unsynergized L20 | 0.078125–0.078125 | — | — | — | — | — |


Component **firemedium** (Missiles ID 105): `pSrvDoFunc`=`1`; `Range`=`90`; `LevRange`=`25`; `CollideType`=`3`; `Size`=`1`; `EType`=`fire`.


| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / fire (raw) | 2–2 | 2–2 | 2–2 | 2–2 | 2–2 | 2–2 |
| E / fire (HP equivalent / see channel role; ×0.00390625) | 0.0078125–0.0078125 | 0.0078125–0.0078125 | 0.0078125–0.0078125 | 0.0078125–0.0078125 | 0.0078125–0.0078125 | 0.0078125–0.0078125 |
| E / fire unsynergized L20 | 0.15625–0.15625 | — | — | — | — | — |




#### Molten Boulder — ID 229


| Property | Value |
| --- | --- |
| Tree | Elemental Skills |
| Required character level | 6 |
| Immediate prerequisites | Firestorm |
| All upstream prerequisites | Firestorm |
| Type | active |
| Internal data name | `Molten Boulder` |
| Mana | `max(1, (20 + 1×(L−1))×0.5)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |
| Shared casting delay | 50 frames = 2 seconds |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| Physical (raw) | 6–12 | 4–5 | 7–8 | 10–11 | 13–14 | 16–17 |
| Physical (HP equivalent / see channel role; ×1) | 6–12 | 4–5 | 7–8 | 10–11 | 13–14 | 16–17 |
| Physical unsynergized L20 | 130–155 | — | — | — | — | — |
| E / fire (raw) | 6–12 | 4–5 | 7–8 | 10–11 | 13–14 | 16–17 |
| E / fire (HP equivalent / see channel role; ×1) | 6–12 | 4–5 | 7–8 | 10–11 | 13–14 | 16–17 |
| E / fire unsynergized L20 | 130–155 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 7 | Explosion Radius |
| par7 | 10 | phys damage synergy |
| par8 | 8 | fire damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurarangecalc | `par1` |
| DmgSymPerCalc | `skill('Volcano'.blvl)*par7` |
| EDmgSymPerCalc | `skill('Firestorm'.blvl)*par8` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Volcano / Damage per Level | `par7` | — |
| Firestorm / Fire Damage per Level | `par8` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Molten Boulder Receives Bonuses From
- Volcano: +10% Damage Per Level
- Firestorm: +8% Fire Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Mana Cost | L1–20: `10, 10.5, 11, 11.5, 12, 12, 13, 13, 14, 14, 15, 15, 16, 16, 17, 17, 18, 18, 19, 19` |
| Damage | L1–20: `6-12, 6-12, 10-17, 14-22, 18-27, 22-32, 26-37, 30-42, 34-47, 41-55, 48-63, 55-71, 62-79, 69-87, 76-95, 83-103, 90-111, 100-122, 110-133, 120-144` |
| Fire Damage | L1–20: `6-12, 6-12, 10-18, 15-23, 19-29, 23-34, 28-39, 32-45, 36-50, 44-59, 51-68, 59-76, 66-85, 74-93, 82-102, 89-111, 97-119, 108-131, 118-143, 129-155` |
| Average Fire Damage Per Second | L1–20: `11-16, 19-24, 28-32, 36-41, 44-49, 52-57, 60-65, 69-73, 79-84, 90-94, 100-105, 111-116, 121-126, 132-137, 142-147, 153-158, 166-171, 179-183, 192-196, 205-209` |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **moltenboulderemerge** (Missiles ID 453): `pSrvDoFunc`=`1`; `pSrvHitFunc`=`48`; `Param1`=`3`; `Vel`=`3`; `MaxVel`=`3`; `Range`=`5`; `CollideType`=`8`; `LastCollide`=`1`; `Size`=`2`; `HitSubMissile1`=`moltenboulder`.


Component **moltenboulder** (Missiles ID 452): `pSrvDoFunc`=`6`; `pSrvHitFunc`=`47`; `pSrvDmgFunc`=`14`; `Param1`=`3`; `sHitPar2`=`1`; `dParam1`=`1`; `dParam2`=`50`; `Vel`=`4`; `MaxVel`=`4`; `Range`=`100`; `CollideType`=`8`; `CollideKill`=`1`; `Size`=`2`; `GetHit`=`1`; `Skill`=`Molten Boulder`; `ResultFlags`=`5`; `HitFlags`=`2`; `SubMissile1`=`moltenboulderfirepath`; `HitSubMissile1`=`moltenboulderfirepath`.


Component **moltenboulderfirepath** (Missiles ID 455): `pSrvDoFunc`=`5`; `Range`=`37`; `CollideType`=`8`; `Size`=`2`; `HitShift`=`2`; `EType`=`fire`; `EDmgSymPerCalc`=`skill('Firestorm'.blvl)*8`; `DamageRate`=`41`.


| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / fire (raw) | 10–14 | 6–6 | 7–7 | 8–8 | 9–9 | 10–10 |
| E / fire (HP equivalent / see channel role; ×0.015625) | 0.15625–0.21875 | 0.09375–0.09375 | 0.109375–0.109375 | 0.125–0.125 | 0.140625–0.140625 | 0.15625–0.15625 |
| E / fire unsynergized L20 | 2.1875–2.25 | — | — | — | — | — |


Component **firewall** (Missiles ID 69): `pSrvDoFunc`=`5`; `pSrvDmgFunc`=`3`; `sHitPar1`=`19`; `dParam1`=`19`; `Range`=`90`; `CollideType`=`3`; `Size`=`1`; `Skill`=`Fire Wall`; `DamageRate`=`41`.


Component **firesmall** (Missiles ID 104): `pSrvDoFunc`=`1`; `Range`=`90`; `LevRange`=`25`; `CollideType`=`3`; `Size`=`1`; `EType`=`fire`.


| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / fire (raw) | 1–1 | 1–1 | 1–1 | 1–1 | 1–1 | 1–1 |
| E / fire (HP equivalent / see channel role; ×0.00390625) | 0.00390625–0.00390625 | 0.00390625–0.00390625 | 0.00390625–0.00390625 | 0.00390625–0.00390625 | 0.00390625–0.00390625 | 0.00390625–0.00390625 |
| E / fire unsynergized L20 | 0.078125–0.078125 | — | — | — | — | — |


Component **firemedium** (Missiles ID 105): `pSrvDoFunc`=`1`; `Range`=`90`; `LevRange`=`25`; `CollideType`=`3`; `Size`=`1`; `EType`=`fire`.


| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / fire (raw) | 2–2 | 2–2 | 2–2 | 2–2 | 2–2 | 2–2 |
| E / fire (HP equivalent / see channel role; ×0.00390625) | 0.0078125–0.0078125 | 0.0078125–0.0078125 | 0.0078125–0.0078125 | 0.0078125–0.0078125 | 0.0078125–0.0078125 | 0.0078125–0.0078125 |
| E / fire unsynergized L20 | 0.15625–0.15625 | — | — | — | — | — |


Component **moltenboulderexplode** (Missiles ID 454): `Range`=`13`; `Size`=`2`.


Component **moltenboulder-flyingrocks** (Missiles ID 456): `Range`=`16`; `CollideType`=`8`; `LastCollide`=`1`; `Size`=`1`.




#### Arctic Blast — ID 230


| Property | Value |
| --- | --- |
| Tree | Elemental Skills |
| Required character level | 6 |
| Immediate prerequisites | None |
| All upstream prerequisites | None |
| Type | active |
| Internal data name | `Arctic Blast` |
| Mana | `(24 + 1×(L−1))×0.015625 per continuous debit; see startmana/server routine` |
| Animation / source-damage field | `SQ; SrcDam=0 /128` |
| startmana | `6` |
| repeat | `1` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / cold (raw) | 21–40 | 16–16 | 18–19 | 20–21 | 24–25 | 29–31 |
| E / cold (HP equivalent / see channel role; ×0.015625) | 0.328125–0.625 | 0.25–0.25 | 0.28125–0.296875 | 0.3125–0.328125 | 0.375–0.390625 | 0.453125–0.484375 |
| E / cold unsynergized L20 | 5.578125–6.0625 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 35 | base ranged (doubled) |
| par2 | 2 | level range (doubled) |
| par3 | 4 | Min Mana to start casting |
| par8 | 15 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurarangecalc | `ln12/4-2` |
| calc1 — range | `ln12/2` |
| calc2 — frames if monster | `20` |
| EDmgSymPerCalc | `(skill('Cyclone Armor'.blvl)+skill('Hurricane'.blvl))*par8` |
| E length: frames, L1; increments L2–8 / L9–16 / L17+ | `100; 15 / 15 / 15` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Mana Cost: / per second | `mps` | — |
| Range: | `ln12/4` | — |
| Minimum Mana Required to Cast: | `par3` | — |
| Hurricane / Cold Damage per Level | `par8` | — |
| Cyclone Armor / Cold Damage per Level | `par8` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Arctic Blast Receives Bonuses From:
- Hurricane: +15% Cold Damage Per Level
- Cyclone Armor: +15% Cold Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Mana Cost | L1–20: `4, 5, 6, 7, 7, 8, 9, 10, 10, 11, 12, 13, 14, 14, 15, 16, 17, 17, 18, 19` |
| Constant / source label | Minimum Mana Cost: 4 |
| Cold Damage Per Second | L1–20: `8-15, 14-21, 20-28, 26-34, 33-40, 39-46, 45-53, 51-59, 58-66, 66-74, 73-81, 80-89, 87-96, 94-103, 101-111, 108-118, 116-126, 123-135, 131-143, 139-151` |
| Cold Length (seconds) | L1–20: `4, 4.6, 5.2, 5.8, 6.4, 7, 7.6, 8.2, 8.8, 9.4, 10, 10.6, 11.2, 11.8, 12.4, 13, 13.6, 14.2, 14.8, 15.4` |
| Range (yards) | L1–20: `5.3, 6, 6, 6.6, 6.6, 7.3, 7.3, 8, 8, 8.6, 8.6, 9.3, 9.3, 10, 10, 10.6, 10.6, 11.3, 11.3, 12` |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **arcticblast1** (Missiles ID 459): `pSrvDoFunc`=`1`; `Param1`=`8`; `Param2`=`7`; `Vel`=`12`; `MaxVel`=`12`; `Range`=`30`; `CollideType`=`3`; `LastCollide`=`1`; `Size`=`1`; `GetHit`=`1`; `Skill`=`Arctic Blast`; `ResultFlags`=`4`; `DamageRate`=`41`.


Component **arcticblast2** (Missiles ID 460): `pSrvDoFunc`=`1`; `Param1`=`8`; `Param2`=`7`; `Vel`=`12`; `MaxVel`=`12`; `Range`=`30`; `CollideType`=`3`; `LastCollide`=`1`; `Size`=`1`; `GetHit`=`1`; `Skill`=`Arctic Blast`; `ResultFlags`=`4`; `DamageRate`=`41`.




#### Fissure — ID 234


| Property | Value |
| --- | --- |
| Tree | Elemental Skills |
| Required character level | 12 |
| Immediate prerequisites | Molten Boulder |
| All upstream prerequisites | Firestorm, Molten Boulder |
| Type | active |
| Internal data name | `Eruption` |
| Mana | `max(1, (15)×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |
| Shared casting delay | 50 frames = 2 seconds |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / fire (raw) | 15–25 | 6–6 | 12–12 | 16–16 | 18–19 | 22–23 |
| E / fire (HP equivalent / see channel role; ×1) | 15–25 | 6–6 | 12–12 | 16–16 | 18–19 | 22–23 |
| E / fire unsynergized L20 | 217–227 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 7 | radius |
| par2 | 6 | Missile delay |
| par3 | 0 | Change duration in Missiles.xls |
| par8 | 12 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| calc1 — radius | `par1` |
| calc2 — frequency | `par2` |
| EDmgSymPerCalc | `(skill('Firestorm'.blvl)+skill('Volcano'.blvl))*par8` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Firestorm / Fire Damage per Level | `par8` | — |
| Volcano / Fire Damage per Level | `par8` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Fissure Receives Bonuses From:
- Firestorm: +12% Fire Damage Per Level
- Volcano: +12% Fire Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 15 |
| Fire Damage | L1–20: `15-25, 21-31, 27-37, 33-43, 39-49, 45-55, 51-61, 57-67, 69-79, 81-91, 93-103, 105-115, 117-127, 129-139, 141-151, 153-163, 165-175, 177-187, 189-199, 201-211` |
| Constant / source label | Duration: 3.2 Seconds |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **erruption center** (Missiles ID 461): `pSrvDoFunc`=`25`; `Range`=`80`; `LastCollide`=`1`; `Size`=`1`; `SubMissile1`=`erruption crack 1`.


Component **erruption crack 1** (Missiles ID 462): `pSrvDoFunc`=`1`; `pSrvDmgFunc`=`8`; `Range`=`84`; `CollideType`=`3`; `LastCollide`=`1`; `NextHit`=`1`; `NextDelay`=`5`; `Size`=`3`; `GetHit`=`1`; `Skill`=`Eruption`.


Component **erruption smoke 1** (Missiles ID 464): `pSrvDoFunc`=`1`; `Range`=`84`.




#### Cyclone Armor — ID 235


| Property | Value |
| --- | --- |
| Tree | Elemental Skills |
| Required character level | 12 |
| Immediate prerequisites | Arctic Blast |
| All upstream prerequisites | Arctic Blast |
| Type | active |
| Internal data name | `Cyclone Armor` |
| Mana | `max(1, (5 + 1×(L−1))×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 40 | damage absorbed |
| par2 | 12 | additional absorbed/level |
| par8 | 7 | absorb synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurastat1: bonearmor | `(ln12*(100+(skill('Twister'.blvl)+skill('Tornado'.blvl)+skill('Hurricane'.blvl))*par8)/100)*256` |
| aurastat2: bonearmormax | `(ln12*(100+(skill('Twister'.blvl)+skill('Tornado'.blvl)+skill('Hurricane'.blvl))*par8)/100)*256` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Absorbs / damage | `(ln12*(100+(skill('Twister'.blvl)+skill('Tornado'.blvl)+skill('Hurricane'.blvl))*par8)/100)` | — |
| Twister / Damage per Level | `par8` | — |
| Tornado / Damage per Level | `par8` | — |
| Hurricane / Damage per Level | `par8` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Cyclone Receives Bonuses From
- Twister: +7% Damage Per Level
- Tornado: +7% Damage Per Level
- Hurricane: +7% Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Mana Cost | L1–20: `5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24` |
| Damage Absorbed | L1–20: `40, 52, 64, 76, 88, 100, 112, 124, 136, 148, 160, 172, 184, 196, 208, 220, 232, 244, 256, 268` |


#### Twister — ID 240


| Property | Value |
| --- | --- |
| Tree | Elemental Skills |
| Required character level | 18 |
| Immediate prerequisites | Cyclone Armor |
| All upstream prerequisites | Arctic Blast, Cyclone Armor |
| Type | active |
| Internal data name | `Twister` |
| Mana | `max(1, (7)×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| Physical (raw) | 12–16 | 4–4 | 7–7 | 10–11 | 13–14 | 16–17 |
| Physical (HP equivalent / see channel role; ×0.5) | 6–8 | 2–2 | 3.5–3.5 | 5–5.5 | 6.5–7 | 8–8.5 |
| Physical unsynergized L20 | 68–72 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 3 | Number of twisters |
| par2 | 10 | Frames the target is stunned |
| par8 | 10 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| calc1 — # missiles | `par1` |
| DmgSymPerCalc | `(skill('Tornado'.blvl)+skill('Hurricane'.blvl))*par8` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Stun Length: | `par2` | — |
| Tornado / Damage per Level | `par8` | — |
| Hurricane / Damage per Level | `par8` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Twister Receives Bonuses From:
- Tornado: +10% Damage Per Level
- Hurricane: +10% Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 7 |
| Damage | L1–20: `6-8, 8-10, 10-12, 12-14, 14-16, 16-18, 18-20, 20-22, 23-25, 27-29, 30-32, 34-36, 37-39, 41-43, 44-46, 48-50, 52-54, 57-59, 61-63, 66-68` |
| Constant / source label | Stun Length 0.4 Seconds |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **twister** (Missiles ID 477): `pSrvDoFunc`=`1`; `pSrvDmgFunc`=`9`; `Vel`=`10`; `MaxVel`=`10`; `Range`=`50`; `CollideType`=`3`; `NextHit`=`1`; `NextDelay`=`25`; `Size`=`2`; `GetHit`=`1`; `Skill`=`Twister`; `ResultFlags`=`4`.




#### Volcano — ID 244


| Property | Value |
| --- | --- |
| Tree | Elemental Skills |
| Required character level | 24 |
| Immediate prerequisites | Fissure |
| All upstream prerequisites | Firestorm, Molten Boulder, Fissure |
| Type | active |
| Internal data name | `Volcano` |
| Mana | `max(1, (25)×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |
| Shared casting delay | 100 frames = 4 seconds |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| Physical (raw) | 8–10 | 2–2 | 4–4 | 6–6 | 8–8 | 10–10 |
| Physical (HP equivalent / see channel role; ×1) | 8–10 | 2–2 | 4–4 | 6–6 | 8–8 | 10–10 |
| Physical unsynergized L20 | 78–80 | — | — | — | — | — |
| E / fire (raw) | 8–10 | 2–2 | 4–4 | 6–6 | 8–8 | 11–13 |
| E / fire (HP equivalent / see channel role; ×1) | 8–10 | 2–2 | 4–4 | 6–6 | 8–8 | 11–13 |
| E / fire unsynergized L20 | 78–80 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 12 | debris range |
| par2 | 2 | delay between debris |
| par7 | 12 | damage synergy |
| par8 | 12 | fire damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurarangecalc | `par1` |
| calc4 — damage delay | `par2` |
| DmgSymPerCalc | `skill('Molten Boulder'.blvl)*par7` |
| EDmgSymPerCalc | `(skill('Eruption'.blvl)+skill('Armageddon'.blvl))*par8` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Molten Boulder / Damage per Level | `par7` | — |
| Fissure / Fire Damage per Level | `par8` | — |
| Armageddon / Fire Damage per Level | `par8` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Volcano Receives Bonuses From:
- Molten Boulder: +12% Damage Per Level
- Fissure: +12% Fire Damage Per Level
- Armageddon: +12% Fire Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 25 |
| Damage | L1–20: `8-10, 8-11, 11-13, 13-15, 15-17, 17-20, 20-22, 22-24, 24-26, 29-31, 33-35, 38-40, 42-44, 47-49, 51-53, 56-58, 60-62, 67-69, 73-76, 80-82` |
| Fire Damage | L1–20: `8-11, 11-13, 13-15, 15-17, 17-20, 20-22, 22-24, 24-26, 29-31, 33-35, 38-40, 42-44, 47-49, 51-53, 56-58, 60-62, 67-69, 73-76, 80-82, 87-89` |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **volcano** (Missiles ID 479): `pSrvDoFunc`=`28`; `Param3`=`2`; `Param4`=`128`; `Param5`=`30`; `Range`=`150`; `CollideType`=`3`; `NextHit`=`1`; `NextDelay`=`10`; `Size`=`3`; `GetHit`=`1`; `Skill`=`Volcano`; `ResultFlags`=`4`; `SubMissile1`=`volcano debris 2`.


Component **volcano debris 2** (Missiles ID 481): `pSrvDoFunc`=`1`; `pSrvHitFunc`=`51`; `Vel`=`14`; `MaxVel`=`14`; `Range`=`16`; `GetHit`=`1`; `HitSubMissile1`=`volcano small fire`.


Component **volcano small fire** (Missiles ID 483): `pSrvDoFunc`=`1`; `Range`=`18`; `CollideType`=`3`; `LastCollide`=`1`; `NextHit`=`1`; `NextDelay`=`5`; `Size`=`2`; `GetHit`=`1`; `Skill`=`Volcano`; `ResultFlags`=`4`; `HitShift`=`8`.


Component **volcano explosion** (Missiles ID 482): `pSrvDoFunc`=`1`; `Range`=`18`.


Component **volcano overlay fire** (Missiles ID 480): `pSrvDoFunc`=`1`; `Range`=`150`; `CollideType`=`3`; `Size`=`3`.




#### Tornado — ID 245


| Property | Value |
| --- | --- |
| Tree | Elemental Skills |
| Required character level | 24 |
| Immediate prerequisites | Twister |
| All upstream prerequisites | Arctic Blast, Cyclone Armor, Twister |
| Type | active |
| Internal data name | `Tornado` |
| Mana | `max(1, (10)×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |
| aurafilter | `42371` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| Physical (raw) | 25–35 | 8–8 | 14–15 | 20–21 | 24–25 | 28–29 |
| Physical (HP equivalent / see channel role; ×1) | 25–35 | 8–8 | 14–15 | 20–21 | 24–25 | 28–29 |
| Physical unsynergized L20 | 273–295 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 15 | Frame delay between damage |
| par2 | 3 | Radius of damage |
| par8 | 9 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurarangecalc | `par2` |
| calc1 — # missiles | `1` |
| calc4 — damage delay | `par1` |
| DmgSymPerCalc | `(skill('Cyclone Armor'.blvl)+skill('Twister'.blvl)+skill('Hurricane'.blvl))*par8` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Cyclone Armor / Damage per Level | `par8` | — |
| Twister / Damage per Level | `par8` | — |
| Hurricane / Damage per Level | `par8` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Tornado Receives Bonuses From:
- Cyclone Armor: +9% Damage Per Level
- Twister: +9% Damage Per Level
- Hurricane: +9% Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 10 |
| Damage | L1–20: `25-35, 29-41, 38-50, 48-60, 57-69, 67-79, 76-88, 86-97, 95-107, 112-125, 128-142, 145-160, 161-178, 178-195, 194-213, 211-231, 227-248, 251-273, 274-298, 298-323` |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **tornado** (Missiles ID 478): `pSrvDoFunc`=`27`; `Vel`=`8`; `MaxVel`=`8`; `Range`=`75`; `CollideType`=`3`; `LastCollide`=`1`; `NextHit`=`1`; `NextDelay`=`25`; `Size`=`3`; `GetHit`=`1`; `Skill`=`Tornado`; `ResultFlags`=`5`; `HitFlags`=`2`.




#### Armageddon — ID 249


| Property | Value |
| --- | --- |
| Tree | Elemental Skills |
| Required character level | 30 |
| Immediate prerequisites | Volcano, Hurricane |
| All upstream prerequisites | Firestorm, Molten Boulder, Fissure, Volcano, Arctic Blast, Cyclone Armor, Twister, Tornado, Hurricane |
| Type | active |
| Internal data name | `Armageddon` |
| Mana | `max(1, (35)×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |
| Shared casting delay | 150 frames = 6 seconds |
| restrict | `1` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| Physical (raw) | 4–16 | 4–4 | 6–7 | 8–9 | 10–12 | 12–14 |
| Physical (HP equivalent / see channel role; ×1) | 4–16 | 4–4 | 6–7 | 8–9 | 10–12 | 12–14 |
| Physical unsynergized L20 | 112–136 | — | — | — | — | — |
| E / fire (raw) | 25–75 | 15–16 | 20–22 | 25–27 | 31–34 | 38–40 |
| E / fire (HP equivalent / see channel role; ×1) | 25–75 | 15–16 | 20–22 | 25–27 | 31–34 | 38–40 |
| E / fire unsynergized L20 | 390–471 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 250 | base duration |
| par2 | 0 | duration per level |
| par3 | 8 | radius to drop meteors |
| par4 | 8 | frame delay between rocks |
| par7 | 50 | duration synergy |
| par8 | 14 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurarangecalc | `par3` |
| auralencalc | `ln12 + skill('Eruption'.blvl) * par7` |
| EDmgSymPerCalc | `(skill('Firestorm'.blvl)+skill('Molten Boulder'.blvl)+skill('Volcano'.blvl))*par8` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Radius: | `par3` | — |
| Duration: | `ln12 + skill('Eruption'.blvl) * par7` | — |
| Fissure / Seconds per Level | `2` | — |
| Firestorm / Fire Damage per Level | `par8` | — |
| Molten Boulder / Fire Damage per Level | `par8` | — |
| Volcano / Fire Damage per Level | `par8` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Armageddon Receives Bonuses From:
- Fissure: +2 Second Per Level
- Firestorm: +14% Fire Damage Per Level
- Molten Boulder: +14% Fire Damage Per Level
- Volcano: +14% Fire Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 35 |
| Constant / source label | Duration: 10 Seconds |
| Fire Damage | L1–20: `25-75, 40-91, 55-107, 70-123, 85-139, 100-155, 115-171, 130-187, 150-209, 170-231, 190-253, 210-275, 230-297, 250-319, 270-341, 290-363, 315-390, 340-417, 365-444, 390-471` |
| Constant / source label | Radius 5.3 Yards |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **armageddoncontrol** (Missiles ID 577): `pSrvDoFunc`=`1`; `pSrvHitFunc`=`56`; `sHitPar1`=`3`; `Range`=`25`; `Skill`=`Armageddon`; `ResultFlags`=`5`; `HitFlags`=`2`; `HitShift`=`8`; `EType`=`fire`; `HitSubMissile1`=`armageddonfire`.


Component **armageddonfire** (Missiles ID 623): `pSrvDoFunc`=`1`; `Range`=`37`; `CollideType`=`8`; `Size`=`2`; `HitShift`=`2`; `EType`=`fire`; `EDmgSymPerCalc`=`(skill('Firestorm'.blvl)+skill('Molten Boulder'.blvl)+skill('Volcano'.blvl))*7`; `DamageRate`=`41`.


| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / fire (raw) | 10–14 | 6–6 | 7–7 | 8–8 | 9–9 | 10–10 |
| E / fire (HP equivalent / see channel role; ×0.015625) | 0.15625–0.21875 | 0.09375–0.09375 | 0.109375–0.109375 | 0.125–0.125 | 0.140625–0.140625 | 0.15625–0.15625 |
| E / fire unsynergized L20 | 2.1875–2.25 | — | — | — | — | — |


Component **armageddontail** (Missiles ID 579): `pSrvDoFunc`=`1`; `Range`=`25`; `HitShift`=`8`.


Component **armageddonrock** (Missiles ID 578): `pSrvDoFunc`=`1`; `Range`=`25`; `HitShift`=`8`.


Component **armageddonexplosion** (Missiles ID 580): `pSrvDoFunc`=`1`; `Param1`=`5`; `Range`=`16`; `CollideType`=`3`; `LastCollide`=`1`; `Size`=`3`; `GetHit`=`1`; `ResultFlags`=`4`; `HitShift`=`8`.




#### Hurricane — ID 250


| Property | Value |
| --- | --- |
| Tree | Elemental Skills |
| Required character level | 30 |
| Immediate prerequisites | Tornado |
| All upstream prerequisites | Arctic Blast, Cyclone Armor, Twister, Tornado |
| Type | active |
| Internal data name | `Hurricane` |
| Mana | `max(1, (30)×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |
| Shared casting delay | 150 frames = 6 seconds |
| aurafilter | `42883` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / cold (raw) | 25–50 | 7–7 | 10–10 | 12–12 | 14–14 | 16–16 |
| E / cold (HP equivalent / see channel role; ×1) | 25–50 | 7–7 | 10–10 | 12–12 | 14–14 | 16–16 |
| E / cold unsynergized L20 | 202–227 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 250 | base duration |
| par2 | 0 | duration per level |
| par3 | 9 | radius |
| par4 | 20 | frames per hit search |
| par7 | 50 | duration synergy |
| par8 | 9 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurarangecalc | `par3` |
| auralencalc | `ln12 + skill('Cyclone Armor'.blvl) * par7` |
| EDmgSymPerCalc | `(skill('Twister'.blvl)+skill('Tornado'.blvl))*par8` |
| E length: frames, L1; increments L2–8 / L9–16 / L17+ | `50; 0 / 0 / 0` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Radius: | `par3` | — |
| Duration: | `ln12 + skill('Cyclone Armor'.blvl) * par7` | — |
| Cyclone Armor / Seconds per Level | `2` | — |
| Twister / Damage per Level | `par8` | — |
| Tornado / Damage per Level | `par8` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Hurricane Receives Bonuses From:
- Cyclone Armor: +2 Second Per Level
- Twister: +9% Damage Per Level
- Tornado: +9% Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 30 |
| Constant / source label | Duration: 10 Seconds |
| Cold Damage | L1–20: `25-50, 32-57, 39-64, 46-71, 53-78, 60-85, 67-92, 74-99, 84-109, 94-119, 104-129, 114-139, 124-149, 134-159, 144-169, 154-179, 181-211, 195-225, 210-239, 224-253` |
| Constant / source label | Radius 6 Yards |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **hurricaneswoosh** (Missiles ID 581): `pSrvDoFunc`=`1`; `Vel`=`20`; `MaxVel`=`20`; `Range`=`22`; `HitShift`=`8`.


Component **hurricanerock** (Missiles ID 583): `pSrvDoFunc`=`1`; `Vel`=`18`; `MaxVel`=`18`; `Range`=`20`; `HitShift`=`8`.


Component **hurricanetree** (Missiles ID 585): `pSrvDoFunc`=`1`; `Vel`=`18`; `MaxVel`=`18`; `Range`=`20`; `HitShift`=`8`.




## 4.7. Assassin

### Traps

Source display tables: [Arreat Summit — Traps](http://classic.battle.net/diablo2exp/skills/assassin-traps.shtml). Exact fields: pinned Skills.txt / SkillDesc.txt / Missiles.txt listed in §0.


| ID | Skill | Required clvl | Immediate prerequisites | Type | Mana expression |
| --- | --- | --- | --- | --- | --- |
| 251 | Fire Blast | 1 | None | active | `max(1, (24 + 1×(L−1))×0.125)` |
| 256 | Shock Web | 6 | Fire Blast | active | `max(1, (6)×1)` |
| 257 | Blade Sentinel | 6 | None | summon / active | `max(1, (7)×1)` |
| 261 | Charged Bolt Sentry | 12 | Shock Web | summon / active | `max(1, (13)×1)` |
| 262 | Wake of Fire | 12 | Fire Blast | summon / active | `max(1, (13)×1)` |
| 266 | Blade Fury | 18 | Blade Sentinel, Wake of Fire | active | `(8 + 1×(L−1))×0.125 per continuous debit; see startmana/server routine` |
| 271 | Lightning Sentry | 24 | Charged Bolt Sentry | summon / active | `max(1, (20)×1)` |
| 272 | Wake of Inferno | 24 | Wake of Fire | summon / active | `max(1, (20)×1)` |
| 276 | Death Sentry | 30 | Lightning Sentry | summon / active | `max(1, (20)×1)` |
| 277 | Blade Shield | 30 | Blade Fury | active | `max(1, (27 + 2×(L−1))×1)` |


#### Fire Blast — ID 251


| Property | Value |
| --- | --- |
| Tree | Traps |
| Required character level | 1 |
| Immediate prerequisites | None |
| All upstream prerequisites | None |
| Type | active |
| Internal data name | `Fire Trauma` |
| Mana | `max(1, (24 + 1×(L−1))×0.125)` |
| Animation / source-damage field | `S2; SrcDam=0 /128` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / fire (raw) | 6–8 | 3–5 | 8–11 | 20–24 | 38–44 | 58–66 |
| E / fire (HP equivalent / see channel role; ×0.5) | 3–4 | 1.5–2.5 | 4–5.5 | 10–12 | 19–22 | 29–33 |
| E / fire unsynergized L20 | 85.5–113.5 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 5 | radius |
| par8 | 9 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurarangecalc | `par1` |
| EDmgSymPerCalc | `(skill('Shock Field'.blvl) + skill('Death Sentry'.blvl) + skill('Charged Bolt Sentry'.blvl) + skill('Lightning Sentry'.blvl) + skill('Wake of Fire Sentry'.blvl) + skill('Inferno Sentry'.blvl)) * par8` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Radius: | `par1` | — |
| Shock Web / Fire Damage per Level | `par8` | — |
| Charged Bolt Sentry / Fire Damage per Level | `par8` | — |
| Wake of Fire / Fire Damage per Level | `par8` | — |
| Lightning Sentry / Fire Damage per Level | `par8` | — |
| Wake of Inferno / Fire Damage per Level | `par8` | — |
| Death Sentry / Fire Damage per Level | `par8` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Fire Blast Receives Bonuses From
- Shock Web: +9% Fire Damage Per Level
- Charged Bolt Sentry: +9% Fire Damage Per Level
- Wake of Fire: +9% Fire Damage Per Level
- Lightning Sentry: +9% Fire Damage Per Level
- Wake of Inferno: +9% Fire Damage Per Level
- Death Sentry: +9% Fire Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Mana Cost | L1–20: `3, 3.1, 3.2, 3.3, 3.5, 3.6, 3.7, 3.8, 4, 4.1, 4.2, 4.3, 4.5, 4.6, 4.7, 4.8, 5, 5.1, 5.2, 5.3` |
| Fire Damage | L1–20: `3-4, 4-6, 6-9, 7-11, 9-14, 10-16, 12-19, 13-21, 17-27, 21-32, 25-38, 29-43, 33-49, 37-54, 41-60, 45-65, 55-77, 65-89, 75-101, 85-113` |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **bomb in air** (Missiles ID 385): `pSrvDoFunc`=`1`; `pSrvHitFunc`=`36`; `Vel`=`12`; `MaxVel`=`12`; `Range`=`50`; `CollideType`=`6`; `LastCollide`=`1`; `Size`=`1`; `HitShift`=`8`; `HitSubMissile1`=`bomb on ground`.


Component **bomb on ground** (Missiles ID 386): `pSrvDoFunc`=`1`; `pSrvHitFunc`=`3`; `Range`=`5`; `CollideType`=`6`; `CollideKill`=`1`; `LastCollide`=`1`; `Size`=`1`; `GetHit`=`1`; `Skill`=`Fire Trauma`; `ResultFlags`=`5`; `HitFlags`=`2`; `HitShift`=`8`.


Component **bomb explosion** (Missiles ID 387): `pSrvDoFunc`=`1`; `Range`=`20`; `CollideType`=`3`; `Size`=`1`; `GetHit`=`1`; `ResultFlags`=`5`; `HitFlags`=`2`; `HitShift`=`8`.




#### Shock Web — ID 256


| Property | Value |
| --- | --- |
| Tree | Traps |
| Required character level | 6 |
| Immediate prerequisites | Fire Blast |
| All upstream prerequisites | Fire Blast |
| Type | active |
| Internal data name | `Shock Field` |
| Mana | `max(1, (6)×1)` |
| Animation / source-damage field | `S2; SrcDam=0 /128` |
| Shared casting delay | 15 frames = 0.6 seconds |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / ltng (raw) | 2–20 | 0–6 | 0–12 | 0–20 | 0–30 | 0–42 |
| E / ltng (HP equivalent / see channel role; ×0.5) | 1–10 | 0–3 | 0–6 | 0–10 | 0–15 | 0–21 |
| E / ltng unsynergized L20 | 1–119 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 6 | Number of missiles |
| par2 | 4 | Levels per missile |
| par8 | 11 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurarangecalc | `(par1+lvl/par2+skill('Fire Trauma'.blvl)/3)/4+1` |
| prgcalc1 | `par1+lvl/par2+skill('Fire Trauma'.blvl)/3` |
| EDmgSymPerCalc | `(skill('Charged Bolt Sentry'.blvl) + skill('Lightning Sentry'.blvl) + skill('Death Sentry'.blvl)) * par8` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Lightning Damage: / per second | `edmn` | `edmx` |
| Spikes: | `par1+lvl/par2+skill('Fire Trauma'.blvl)/3` | — |
| Fire Blast / +1 Missile per %d Levels | `3` | — |
| Charged Bolt Sentry / Lightning Damage per Level | `par8` | — |
| Lightning Sentry / Lightning Damage per Level | `par8` | — |
| Death Sentry / Lightning Damage per Level | `par8` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Shock Web Receives Bonuses From
- Charged Bolt Sentry: +11% Lightning Damage Per Level
- Lightning Sentry: +11% Lightning Damage Per Level
- Death Sentry: +11% Lightning Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 6 |
| Spikes | L1–20: `6, 6, 6, 7, 7, 7, 7, 8, 8, 8, 8, 9, 9, 9, 9, 10, 10, 10, 10, 11` |
| Lightning Damage | L1–20: `1-10, 1-13, 1-16, 1-19, 1-22, 1-25, 1-28, 1-31, 1-37, 1-43, 1-49, 1-55, 1-61, 1-67, 1-73, 1-79, 1-89, 1-99, 1-109, 1-119` |
| Constant / source label | Duration: 3.6 sec. |
| Constant / source label | Fire Blast: +1 Missile Per 3 Levels |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **shock field in air** (Missiles ID 388): `pSrvDoFunc`=`1`; `pSrvHitFunc`=`36`; `Vel`=`12`; `MaxVel`=`12`; `Range`=`50`; `CollideType`=`6`; `LastCollide`=`1`; `Size`=`1`; `HitShift`=`8`; `HitSubMissile1`=`shock field on ground`.


Component **shock field on ground** (Missiles ID 389): `pSrvDoFunc`=`1`; `Range`=`90`; `CollideType`=`3`; `NextHit`=`1`; `NextDelay`=`25`; `Size`=`2`; `Skill`=`Shock Field`; `HitShift`=`8`.




#### Blade Sentinel — ID 257


| Property | Value |
| --- | --- |
| Tree | Traps |
| Required character level | 6 |
| Immediate prerequisites | None |
| All upstream prerequisites | None |
| Type | summon / active |
| Internal data name | `Blade Sentinel` |
| Mana | `max(1, (7)×1)` |
| Animation / source-damage field | `S2; SrcDam=48 /128` |
| Shared casting delay | 50 frames = 2 seconds |
| pettype | `assassintrap` |
| summon | `bladecreeper` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| Physical (raw) | 6–10 | 3–3 | 4–4 | 5–5 | 5–5 | 5–5 |
| Physical (HP equivalent / see channel role; ×1) | 6–10 | 3–3 | 4–4 | 5–5 | 5–5 | 5–5 |
| Physical unsynergized L20 | 79–83 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 100 | duration |
| par2 | 12 | duration per level |
| par3 | 5 | Total number assassin traps |
| par4 | 3 | Total number pet traps |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| passivestat1: tohit | `lvl*5` |
| sumskill1: Blade Sentinel | `lvl` |
| petmax | `5` |
| calc4 — duration | `ln12` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Weapon Damage | `3` | `8` |
| Duration: | `ln12` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 7 |
| Duration X Seconds | L1–20: `4, 4.4, 4.9, 5.4, 5.9, 6.4, 6.8, 7.3, 7.8, 8.3, 8.8, 9.2, 9.7, 10.2, 10.7, 11.2, 11.6, 12.1, 12.6, 13.1` |
| Damage | L1–20: `6-10, 9-13, 12-16, 15-19, 18-22, 21-25, 24-28, 27-31, 31-35, 35-39, 39-43, 43-47, 47-51, 51-55, 55-59, 59-63, 64-68, 69-73, 74-78, 79-83` |
| Constant / source label | +3/8 Weapon Damage |


**Summon base monster record** — seed values, NOT the final buffed summon. Apply this skill's HP/damage/AR calculations, mastery, summon level, difficulty and generated equipment; absent difficulty HP fields can be supplied by hardcoded handling.

| MonStats field | Value |
| --- | --- |
| Id | `bladecreeper` |
| AI | `BladeCreeper` |
| Velocity | `10` |
| Run | `10` |
| aidel | `15` |
| aidel(N) | `15` |
| aidel(H) | `15` |
| Skill1 | `Blade Sentinel` |
| Sk1mode | `A1` |
| Sk1lvl | `1` |
| noRatio | `1` |
| minHP | `100` |
| maxHP | `100` |
| AC | `100` |
| AC(N) | `100` |
| AC(H) | `100` |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **blade creeper** (Missiles ID 392): `pSrvDoFunc`=`20`; `pSrvHitFunc`=`37`; `Range`=`10`; `LevRange`=`5`; `CollideType`=`3`; `NextHit`=`1`; `NextDelay`=`25`; `Size`=`3`; `GetHit`=`1`; `Skill`=`Blade Sentinel`; `ResultFlags`=`4`; `HitShift`=`8`.




#### Charged Bolt Sentry — ID 261


| Property | Value |
| --- | --- |
| Tree | Traps |
| Required character level | 12 |
| Immediate prerequisites | Shock Web |
| All upstream prerequisites | Fire Blast, Shock Web |
| Type | summon / active |
| Internal data name | `Charged Bolt Sentry` |
| Mana | `max(1, (13)×1)` |
| Animation / source-damage field | `S2; SrcDam=0 /128` |
| pettype | `assassintrap` |
| summon | `chargeboltsentry` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / ltng (raw) | 2–14 | 0–6 | 0–8 | 0–12 | 0–14 | 0–16 |
| E / ltng (HP equivalent / see channel role; ×0.5) | 1–7 | 0–3 | 0–4 | 0–6 | 0–7 | 0–8 |
| E / ltng unsynergized L20 | 1–84 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 5 | Shots fired |
| par3 | 5 | Bolts to send out |
| par4 | 0 | Bolts to send out per level |
| par8 | 6 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| sumskill1: BoltSentry | `lvl` |
| sumskill2: Fire Trauma | `skill('Fire Trauma'.blvl)` |
| sumskill3: Shock Field | `skill('Shock Field'.blvl)` |
| sumskill4: Lightning Sentry | `skill('Lightning Sentry'.blvl)` |
| sumskill5: Death Sentry | `skill('Death Sentry'.blvl)` |
| petmax | `5` |
| calc4 — shots fired | `par1 + skill('Lightning Sentry'.blvl)/4` |
| EDmgSymPerCalc | `(skill('Fire Trauma'.blvl) + skill('Lightning Sentry'.blvl) + skill('Death Sentry'.blvl)) * par8` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Releases / charged bolts | `ln34 + skill('Shock Field'.blvl)/3` | — |
| Shoots / Times | `par1 + skill('Lightning Sentry'.blvl)/4` | — |
| Shock Web / +1 Bolt per %d Levels | `3` | — |
| Lightning Sentry / +1 Shot per %d Levels | `4` | — |
| Fire Blast / Lightning Damage per Level | `par8` | — |
| Lightning Sentry / Lightning Damage per Level | `par8` | — |
| Death Sentry / Lightning Damage per Level | `par8` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Charged Bolt Sentry Receives Bonuses From
- Fire Blast: +6% Lightning Damage Per Level
- Lightning Sentry: +6% Lightning Damage Per Level
- Death Sentry: +6% Lightning Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 13 |
| Damage | L1–20: `1-7, 1-10, 1-13, 1-16, 1-20, 1-23, 1-26, 1-29, 1-33, 1-38, 1-42, 1-46, 1-50, 1-55, 1-59, 1-63, 1-69, 1-76, 1-82, 1-89` |
| Constant / source label | Releases 5 Charged Bolts |
| Constant / source label | Shoots: 5 times |
| Constant / source label | Shock Web: +1 Bolt Per 3 Levels |
| Constant / source label | Lightning Sentry: +1 Shot Per 4 Levels |


**Summon base monster record** — seed values, NOT the final buffed summon. Apply this skill's HP/damage/AR calculations, mastery, summon level, difficulty and generated equipment; absent difficulty HP fields can be supplied by hardcoded handling.

| MonStats field | Value |
| --- | --- |
| Id | `chargeboltsentry` |
| AI | `AssassinSentry` |
| aidel | `15` |
| aidel(N) | `15` |
| aidel(H) | `15` |
| aip1 | `100` |
| aip1(N) | `100` |
| aip1(H) | `100` |
| aip2 | `10` |
| aip2(N) | `10` |
| aip2(H) | `10` |
| aip3 | `15` |
| aip3(N) | `15` |
| aip3(H) | `15` |
| aip4 | `25` |
| aip4(N) | `25` |
| aip4(H) | `25` |
| Skill1 | `BoltSentry` |
| Sk1mode | `seq_chargesentry` |
| Sk1lvl | `1` |
| Skill2 | `Shock Field` |
| Sk2mode | `S1` |
| noRatio | `1` |
| minHP | `100` |
| maxHP | `100` |
| AC | `100` |
| AC(N) | `100` |
| AC(H) | `100` |


#### Wake of Fire — ID 262


| Property | Value |
| --- | --- |
| Tree | Traps |
| Required character level | 12 |
| Immediate prerequisites | Fire Blast |
| All upstream prerequisites | Fire Blast |
| Type | summon / active |
| Internal data name | `Wake of Fire Sentry` |
| Mana | `max(1, (13)×1)` |
| Animation / source-damage field | `S2; SrcDam=0 /128` |
| pettype | `assassintrap` |
| summon | `wakeofdestruction` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / fire (raw) | 5–10 | 2–2 | 3–3 | 5–6 | 7–8 | 9–10 |
| E / fire (HP equivalent / see channel role; ×1) | 5–10 | 2–2 | 3–3 | 5–6 | 7–8 | 9–10 |
| E / fire unsynergized L20 | 63–72 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 5 | Shots fired |
| par8 | 8 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| sumskill1: Wake Of Destruction Sentry | `lvl` |
| sumskill2: Fire Trauma | `skill('Fire Trauma'.blvl)` |
| sumskill3: Inferno Sentry | `skill('Inferno Sentry'.blvl)` |
| petmax | `5` |
| EDmgSymPerCalc | `(skill('Fire Trauma'.blvl) + skill('Inferno Sentry'.blvl)) * par8` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Shoots / Times | `par1` | — |
| Fire Blast / Fire Damage per Level | `par8` | — |
| Wake of Inferno / Fire Damage per Level | `par8` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Wake of Fire Receives Bonuses From
- Fire Blast: +8% Fire Damage Per Level
- Wake of Inferno: +8% Fire Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 13 |
| Fire Damage | L1–20: `5-10, 7-12, 9-15, 11-17, 14-19, 16-21, 18-23, 20-25, 23-29, 27-32, 30-35, 33-38, 36-42, 39-45, 43-48, 46-51, 51-58, 57-64, 62-71, 68-77` |
| Constant / source label | Shoots 5 Times |


**Summon base monster record** — seed values, NOT the final buffed summon. Apply this skill's HP/damage/AR calculations, mastery, summon level, difficulty and generated equipment; absent difficulty HP fields can be supplied by hardcoded handling.

| MonStats field | Value |
| --- | --- |
| Id | `wakeofdestruction` |
| AI | `AssassinSentry` |
| aidel | `15` |
| aidel(N) | `15` |
| aidel(H) | `15` |
| aip1 | `100` |
| aip1(N) | `100` |
| aip1(H) | `100` |
| aip2 | `10` |
| aip2(N) | `10` |
| aip2(H) | `10` |
| aip3 | `15` |
| aip3(N) | `15` |
| aip3(H) | `15` |
| aip4 | `15` |
| aip4(N) | `15` |
| aip4(H) | `15` |
| Skill1 | `Wake Of Destruction Sentry` |
| Sk1mode | `S2` |
| Sk1lvl | `1` |
| noRatio | `1` |
| minHP | `100` |
| maxHP | `100` |
| AC | `100` |
| AC(N) | `100` |
| AC(H) | `100` |
| El1MinD | `5` |
| El1MaxD | `10` |


#### Blade Fury — ID 266


| Property | Value |
| --- | --- |
| Tree | Traps |
| Required character level | 18 |
| Immediate prerequisites | Blade Sentinel, Wake of Fire |
| All upstream prerequisites | Blade Sentinel, Fire Blast, Wake of Fire |
| Type | active |
| Internal data name | `Blade Fury` |
| Mana | `(8 + 1×(L−1))×0.125 per continuous debit; see startmana/server routine` |
| Animation / source-damage field | `SQ; SrcDam=96 /128` |
| startmana | `6` |
| repeat | `1` |
| usemanaondo | `1` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| Physical (raw) | 8–10 | 3–3 | 5–5 | 8–8 | 8–8 | 8–8 |
| Physical (HP equivalent / see channel role; ×1) | 8–10 | 3–3 | 5–5 | 8–8 | 8–8 | 8–8 |
| Physical unsynergized L20 | 101–103 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 0 | "Don't Use, missile range mod" |
| par2 | 0 | "Don't Use, missile range mod" |
| par3 | 3 | Min Mana to start casting |
| par4 | 5 | Frame delay between blades |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| prgcalc1 | `par4` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Mana Cost: / per blade | `usmc` | `10` |
| Weapon Damage | `3` | `4` |
| Minimum Mana Required to Cast: | `par3` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Minimum Mana Required To Cast: 3 |
| Mana Cost Per Blade | L1–20: `1, 1.1, 1.2, 1.3, 1.5, 1.6, 1.7, 1.8, 2, 2.1, 2.2, 2.3, 2.5, 2.6, 2.7, 2.8, 3, 3.1, 3.2, 3.3` |
| Damage Per Blade | L1–20: `8-10, 11-13, 14-16, 17-19, 20-22, 23-25, 26-28, 29-31, 34-36, 39-41, 44-46, 49-51, 54-56, 59-61, 64-66, 69-71, 77-79, 85-87, 93-95, 101-103` |
| Constant / source label | +3/4 Weapon Damage |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **bladefragment1** (Missiles ID 506): `pSrvDoFunc`=`1`; `Vel`=`22`; `MaxVel`=`22`; `Range`=`40`; `CollideType`=`3`; `CollideKill`=`1`; `Size`=`1`; `GetHit`=`1`; `Skill`=`Blade Fury`; `ResultFlags`=`4`.


Component **bladefragment2** (Missiles ID 508): `pSrvDoFunc`=`1`; `Vel`=`22`; `MaxVel`=`22`; `Range`=`33`; `CollideType`=`3`; `CollideKill`=`1`; `Size`=`1`; `GetHit`=`1`; `Skill`=`Blade Fury`; `ResultFlags`=`4`; `HitShift`=`8`.




#### Lightning Sentry — ID 271


| Property | Value |
| --- | --- |
| Tree | Traps |
| Required character level | 24 |
| Immediate prerequisites | Charged Bolt Sentry |
| All upstream prerequisites | Fire Blast, Shock Web, Charged Bolt Sentry |
| Type | summon / active |
| Internal data name | `Lightning Sentry` |
| Mana | `max(1, (20)×1)` |
| Animation / source-damage field | `S2; SrcDam=0 /128` |
| pettype | `assassintrap` |
| summon | `lightningsentry` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / ltng (raw) | 1–20 | 0–10 | 0–16 | 0–24 | 0–34 | 0–44 |
| E / ltng (HP equivalent / see channel role; ×1) | 1–20 | 0–10 | 0–16 | 0–24 | 0–34 | 0–44 |
| E / ltng unsynergized L20 | 1–314 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 10 | Shots fired |
| par8 | 12 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| sumskill1: sentry lightning | `lvl` |
| sumskill2: Shock Field | `skill('Shock Field'.blvl)` |
| sumskill3: Charged Bolt Sentry | `skill('Charged Bolt Sentry'.blvl)` |
| sumskill4: Death Sentry | `skill('Death Sentry'.blvl)` |
| petmax | `5` |
| EDmgSymPerCalc | `(skill('Shock Field'.blvl) + skill('Charged Bolt Sentry'.blvl) + skill('Death Sentry'.blvl))*par8` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Shoots / Times | `par1` | — |
| Shock Web / Lightning Damage per Level | `par8` | — |
| Charged Bolt Sentry / Lightning Damage per Level | `par8` | — |
| Death Sentry / Lightning Damage per Level | `par8` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Lightning Sentry Receives Bonuses From
- Shock Web: +12% Lightning Damage Per Level
- Charged Bolt Sentry: +12% Lightning Damage Per Level
- Death Sentry: +12% Lightning Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 20 |
| Lightning Damage | L1–20: `1-24, 1-37, 1-49, 1-62, 1-74, 1-86, 1-99, 1-111, 1-131, 1-151, 1-171, 1-190, 1-210, 1-230, 1-250, 1-270, 1-300, 1-329, 1-359, 1-389` |
| Constant / source label | Shoots 10 Times |


**Summon base monster record** — seed values, NOT the final buffed summon. Apply this skill's HP/damage/AR calculations, mastery, summon level, difficulty and generated equipment; absent difficulty HP fields can be supplied by hardcoded handling.

| MonStats field | Value |
| --- | --- |
| Id | `lightningsentry` |
| AI | `AssassinSentry` |
| aidel | `15` |
| aidel(N) | `15` |
| aidel(H) | `15` |
| aip1 | `100` |
| aip1(N) | `100` |
| aip1(H) | `100` |
| aip2 | `10` |
| aip2(N) | `10` |
| aip2(H) | `10` |
| aip3 | `15` |
| aip3(N) | `15` |
| aip3(H) | `15` |
| aip4 | `25` |
| aip4(N) | `25` |
| aip4(H) | `25` |
| Skill1 | `sentry lightning` |
| Sk1mode | `seq_chargesentry` |
| Sk1lvl | `1` |
| noRatio | `1` |
| minHP | `100` |
| maxHP | `100` |
| AC | `100` |
| AC(N) | `100` |
| AC(H) | `100` |


#### Wake of Inferno — ID 272


| Property | Value |
| --- | --- |
| Tree | Traps |
| Required character level | 24 |
| Immediate prerequisites | Wake of Fire |
| All upstream prerequisites | Fire Blast, Wake of Fire |
| Type | summon / active |
| Internal data name | `Inferno Sentry` |
| Mana | `max(1, (20)×1)` |
| Animation / source-damage field | `S2; SrcDam=0 /128` |
| pettype | `assassintrap` |
| summon | `infernosentry` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / fire (raw) | 20–50 | 17–19 | 21–23 | 26–28 | 32–34 | 39–41 |
| E / fire (HP equivalent / see channel role; ×0.0625) | 1.25–3.125 | 1.0625–1.1875 | 1.3125–1.4375 | 1.625–1.75 | 2–2.125 | 2.4375–2.5625 |
| E / fire unsynergized L20 | 25.6875–29.9375 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 10 | Shots fired |
| par7 | 10 | synergy damage bonus |
| par8 | 7 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| sumskill1: mon inferno sentry | `lvl` |
| sumskill2: Fire Trauma | `skill('Fire Trauma'.blvl)` |
| sumskill3: Wake of Fire Sentry | `skill('Wake of Fire Sentry'.blvl)` |
| sumskill4: Death Sentry | `skill('Death Sentry'.blvl)` |
| petmax | `5` |
| EDmgSymPerCalc | `(skill('Fire Trauma'.blvl) + skill('Death Sentry'.blvl)) * par7 + skill('Wake of Fire Sentry'.blvl)*par8` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Fire Damage: | `edns*25/768` | `edxs*25/768` |
| Shoots / Times | `par1` | — |
| Wake of Fire / Yards per Level | — | `5` |
| Fire Blast / Fire Damage per Level | `par7` | — |
| Wake of Fire / Fire Damage per Level | `par8` | — |
| Death Sentry / Fire Damage per Level | `par7` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Wake of Inferno Receives Bonuses From
- Wake of Fire: +0.5 Yards Per Level
- Fire Blast: +10% Fire Damage Per Level
- Wake of Fire: +7% Fire Damage Per Level
- Death Sentry: +10% Fire Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 20 |
| Fire Damage Per Second | L1–20: `12-30, 22-42, 32-53, 43-65, 53-76, 63-88, 74-99, 84-111, 97-125, 110-139, 123-153, 135-167, 148-181, 161-195, 174-209, 187-223, 202-240, 218-257, 234-274, 250-291` |
| Constant / source label | Shoots 10 Times |


**Summon base monster record** — seed values, NOT the final buffed summon. Apply this skill's HP/damage/AR calculations, mastery, summon level, difficulty and generated equipment; absent difficulty HP fields can be supplied by hardcoded handling.

| MonStats field | Value |
| --- | --- |
| Id | `infernosentry` |
| AI | `AssassinSentry` |
| aidel | `15` |
| aidel(N) | `15` |
| aidel(H) | `15` |
| aip1 | `100` |
| aip1(N) | `100` |
| aip1(H) | `100` |
| aip2 | `10` |
| aip2(N) | `10` |
| aip2(H) | `10` |
| aip3 | `15` |
| aip3(N) | `15` |
| aip3(H) | `15` |
| aip4 | `13` |
| aip4(N) | `13` |
| aip4(H) | `13` |
| Skill1 | `mon inferno sentry` |
| Sk1mode | `seq_infernosentry` |
| Sk1lvl | `1` |
| Skill2 | `Wake of Fire Sentry` |
| Sk2mode | `S1` |
| noRatio | `1` |
| minHP | `100` |
| maxHP | `100` |
| AC | `100` |
| AC(N) | `100` |
| AC(H) | `100` |


#### Death Sentry — ID 276


| Property | Value |
| --- | --- |
| Tree | Traps |
| Required character level | 30 |
| Immediate prerequisites | Lightning Sentry |
| All upstream prerequisites | Fire Blast, Shock Web, Charged Bolt Sentry, Lightning Sentry |
| Type | summon / active |
| Internal data name | `Death Sentry` |
| Mana | `max(1, (20)×1)` |
| Animation / source-damage field | `S2; SrcDam=0 /128` |
| pettype | `assassintrap` |
| summon | `deathsentry` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / ltng (raw) | 1–50 | 0–8 | 0–14 | 0–22 | 0–28 | 0–34 |
| E / ltng (HP equivalent / see channel role; ×1) | 1–50 | 0–8 | 0–14 | 0–22 | 0–28 | 0–34 |
| E / ltng unsynergized L20 | 1–306 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 5 | Shots fired |
| par8 | 12 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| sumskill1: mon death sentry | `lvl` |
| sumskill2: death sentry ltng | `lvl` |
| sumskill3: Fire Trauma | `skill('Fire Trauma'.blvl)` |
| sumskill4: Lightning Sentry | `skill('Lightning Sentry'.blvl)` |
| petmax | `5` |
| EDmgSymPerCalc | `(skill('Lightning Sentry'.blvl))*par8` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Radius: | `skill('mon death sentry'.par3) + skill('mon death sentry'.par4) * (lvl - 1)` | — |
| Shoots / Times | `par1 + skill('Fire Trauma'.blvl)/3` | — |
| Corpse Explosion Damage: / percent of corpse Life | `skill('mon death sentry'.par1)` | `skill('mon death sentry'.par2)` |
| Fire Blast / +1 Shot per %d Levels | `3` | — |
| Lightning Sentry / Lightning Damage per Level | `par8` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Death Sentry Receives Bonuses From
- Lightning Sentry: +12% Lightning Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 20 |
| Lightning Damage | L1–20: `1-56, 1-64, 1-73, 1-82, 1-91, 1-100, 1-109, 1-118, 1-134, 1-150, 1-165, 1-181, 1-197, 1-212, 1-228, 1-244, 1-268, 1-293, 1-318, 1-342` |
| Corpse Explosion Radius (yards) | L1–20: `3.3, 3.6, 4, 4.3, 4.6, 5, 5.3, 5.6, 6, 6.3, 6.6, 7, 7.3, 7.6, 8, 8.3, 8.6, 9, 9.3, 9.6` |
| Constant / source label | Damage: 40-80% Of Corpse Life |
| Constant / source label | Shoots: 5 Times |
| Constant / source label | Fire Blast: +1 Shot Per 3 Levels |


**Summon base monster record** — seed values, NOT the final buffed summon. Apply this skill's HP/damage/AR calculations, mastery, summon level, difficulty and generated equipment; absent difficulty HP fields can be supplied by hardcoded handling.

| MonStats field | Value |
| --- | --- |
| Id | `deathsentry` |
| AI | `DeathSentry` |
| aidel | `15` |
| aidel(N) | `15` |
| aidel(H) | `15` |
| aip1 | `30` |
| aip1(N) | `30` |
| aip1(H) | `30` |
| aip3 | `50` |
| aip3(N) | `50` |
| aip3(H) | `50` |
| aip4 | `16` |
| aip4(N) | `16` |
| aip4(H) | `16` |
| Skill1 | `mon death sentry` |
| Sk1mode | `seq_chargesentry` |
| Sk1lvl | `1` |
| Skill2 | `death sentry ltng` |
| Sk2mode | `seq_chargesentry` |
| Sk2lvl | `1` |
| noRatio | `1` |
| minHP | `100` |
| maxHP | `100` |
| AC | `100` |
| AC(N) | `100` |
| AC(H) | `100` |


#### Blade Shield — ID 277


| Property | Value |
| --- | --- |
| Tree | Traps |
| Required character level | 30 |
| Immediate prerequisites | Blade Fury |
| All upstream prerequisites | Blade Sentinel, Fire Blast, Wake of Fire, Blade Fury |
| Type | active |
| Internal data name | `Blade Shield` |
| Mana | `max(1, (27 + 2×(L−1))×1)` |
| Animation / source-damage field | `SC; SrcDam=32 /128` |
| perdelay | `par3` |
| periodic | `1` |
| aurafilter | `33667` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| Physical (raw) | 1–30 | 5–5 | 6–6 | 7–7 | 7–7 | 7–7 |
| Physical (HP equivalent / see channel role; ×1) | 1–30 | 5–5 | 6–6 | 7–7 | 7–7 | 7–7 |
| Physical unsynergized L20 | 112–141 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 500 | duration |
| par2 | 125 | duration per level |
| par3 | 25 | delay |
| par4 | 6 | radius to attack in |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurarangecalc | `par4` |
| auralencalc | `ln12` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Duration: | `ln12` | — |
| Weapon Damage | `1` | `4` |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Mana Cost | L1–20: `27, 29, 31, 33, 35, 37, 39, 41, 43, 45, 47, 49, 51, 53, 55, 57, 59, 61, 63, 65` |
| Duration (seconds) | L1–20: `20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115` |
| Damage | L1–20: `1-30, 6-35, 11-40, 16-45, 21-50, 26-55, 31-60, 36-65, 42-71, 48-77, 54-83, 60-89, 66-95, 72-101, 78-107, 84-113, 91-120, 98-127, 105-134, 112-141` |
| Constant / source label | +1/4 Weapon Damage |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **blade shield attachment** (Missiles ID 553): `pSrvDoFunc`=`1`; `Range`=`500`; `LevRange`=`100`.


Component **blade shield missile** (Missiles ID 552): `pSrvDoFunc`=`1`; `Vel`=`18`; `MaxVel`=`30`; `Range`=`100`; `CollideType`=`3`; `LastCollide`=`1`; `Size`=`1`; `GetHit`=`1`; `Skill`=`Blade Fury`; `ResultFlags`=`4`.




### Shadow Disciplines

Source display tables: [Arreat Summit — Shadow Disciplines](http://classic.battle.net/diablo2exp/skills/assassin-shadow.shtml). Exact fields: pinned Skills.txt / SkillDesc.txt / Missiles.txt listed in §0.


| ID | Skill | Required clvl | Immediate prerequisites | Type | Mana expression |
| --- | --- | --- | --- | --- | --- |
| 252 | Claw Mastery | 1 | None | passive | `0` |
| 253 | Psychic Hammer | 1 | None | active | `max(1, (16 + 1×(L−1))×0.25)` |
| 258 | Burst of Speed | 6 | Claw Mastery | active | `max(1, (10)×1)` |
| 263 | Weapon Block | 12 | Claw Mastery | passive | `0` |
| 264 | Cloak of Shadows | 12 | Psychic Hammer | active | `max(1, (13)×1)` |
| 267 | Fade | 18 | Burst of Speed | active | `max(1, (10)×1)` |
| 268 | Shadow Warrior | 18 | Cloak of Shadows, Weapon Block | summon / active | `max(1, (54 + 1×(L−1))×0.5)` |
| 273 | Mind Blast | 24 | Cloak of Shadows | active | `max(1, (15)×1)` |
| 278 | Venom | 30 | Fade | active | `max(1, (12)×1)` |
| 279 | Shadow Master | 30 | Shadow Warrior | summon / active | `max(1, (70 + 1×(L−1))×0.5)` |


#### Claw Mastery — ID 252


| Property | Value |
| --- | --- |
| Tree | Shadow Disciplines |
| Required character level | 1 |
| Immediate prerequisites | None |
| All upstream prerequisites | None |
| Type | passive |
| Internal data name | `Claw Mastery` |
| Mana | `0` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |
| itypea1 | `h2h` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 30 | Attack rating bonus percent |
| par2 | 10 | Percent attack rating per level |
| par3 | 35 | % damage percent |
| par4 | 4 | damage % per level |
| par5 | 0 | critical% |
| par6 | 25 | critical% |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| passivestat1: passive_mastery_melee_th | `ln12` |
| passivestat2: passive_mastery_melee_dmg | `ln34` |
| passivestat3: passive_mastery_melee_crit | `dm56` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| %d Percent Chance of Critical Strike | `macr` | — |
| Attack: / percent | `math` | — |
| Damage: / percent | `madm` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Attack Rating +% | L1–20: `30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 210, 220` |
| Damage Bonus +% | L1–20: `35, 39, 43, 47, 51, 55, 59, 63, 67, 71, 75, 79, 83, 87, 91, 95, 99, 103, 107, 111` |
| X% Chance of Critical Strike | L1–20: `3, 6, 9, 11, 12, 13, 14, 15, 16, 17, 17, 18, 18, 19, 19, 20, 20, 20, 20, 21` |


#### Psychic Hammer — ID 253


| Property | Value |
| --- | --- |
| Tree | Shadow Disciplines |
| Required character level | 1 |
| Immediate prerequisites | None |
| All upstream prerequisites | None |
| Type | active |
| Internal data name | `Psychic Hammer` |
| Mana | `max(1, (16 + 1×(L−1))×0.25)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| Physical (raw) | 2–6 | 2–3 | 3–4 | 4–5 | 5–6 | 6–7 |
| Physical (HP equivalent / see channel role; ×0.5) | 1–3 | 1–1.5 | 1.5–2 | 2–2.5 | 2.5–3 | 3–3.5 |
| Physical unsynergized L20 | 28–39.5 | — | — | — | — | — |
| E / mag (raw) | 2–6 | 2–3 | 3–4 | 4–5 | 5–6 | 6–7 |
| E / mag (HP equivalent / see channel role; ×0.5) | 1–3 | 1–1.5 | 1.5–2 | 2–2.5 | 2.5–3 | 3–3.5 |
| E / mag unsynergized L20 | 28–39.5 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 100 | knockback % vs. monster |
| par3 | 50 | min knockback% vs. unique |
| par4 | 100 | max knockback% vs. unique |
| par5 | 25 | min knockback% vs. boss |
| par6 | 99 | max knockback% vs. boss |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| calc1 — knockback% vs. monster | `par1` |
| calc2 — knockback% vs. unique | `dm34` |
| calc3 — knockback% vs. boss | `dm56` |
| calc4 — knockback% vs. player | `dm56` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| descline1 (formatter 1) | `100` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Mana Cost | L1–20: `4, 4.2, 4.5, 4.7, 5, 5.2, 5.5, 5.7, 6, 6.2, 6.5, 6.7, 7, 7.2, 7.5, 7.7, 8, 8.2, 8.5, 8.7` |
| Damage | L1–20: `2-5, 3-6, 4-7, 5-8, 6-9, 7-10, 8-11, 9-12, 10-13, 12-15, 13-16, 15-18, 16-19, 18-21, 19-22, 21-24, 23-26, 25-28, 27-30, 29-32` |
| Magic Damage | L1–20: `2-5, 3-6, 4-7, 5-8, 6-9, 7-10, 8-11, 9-12, 10-13, 12-15, 13-16, 15-18, 16-19, 18-21, 19-22, 21-24, 23-26, 25-28, 27-30, 29-32` |


#### Burst of Speed — ID 258


| Property | Value |
| --- | --- |
| Tree | Shadow Disciplines |
| Required character level | 6 |
| Immediate prerequisites | Claw Mastery |
| All upstream prerequisites | Claw Mastery |
| Type | active |
| Internal data name | `Quickness` |
| Mana | `max(1, (10)×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 15 | % min increased walk speed |
| par2 | 70 | % max increased walk speed |
| par3 | 15 | min % increased attack speed |
| par4 | 60 | max % increased attack speed |
| par5 | 3000 | duration |
| par6 | 300 | duration per level |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurastat1: velocitypercent | `dm12` |
| aurastat2: attackrate | `dm34` |
| auralencalc | `ln56` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Duration: | `ln56` | — |
| Walk/Run Speed: / percent | `dm12` | — |
| Attack Speed: / percent | `dm34` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 10 |
| Attack Speed Bonus +% | L1–20: `21, 27, 31, 34, 37, 41, 42, 44, 44, 45, 46, 47, 49, 50, 51, 51, 51, 52, 52, 52` |
| Run/Walk Speed Bonus +% | L1–20: `23, 29, 34, 39, 42, 45, 47, 49, 51, 52, 54, 55, 56, 57, 57, 59, 59, 60, 60, 61` |
| Duration in Seconds | L1–20: `120, 132, 144, 156, 168, 180, 192, 204, 216, 228, 240, 252, 264, 276, 288, 300, 312, 324, 336, 348` |


#### Weapon Block — ID 263


| Property | Value |
| --- | --- |
| Tree | Shadow Disciplines |
| Required character level | 12 |
| Immediate prerequisites | Claw Mastery |
| All upstream prerequisites | Claw Mastery |
| Type | passive |
| Internal data name | `Weapon Block` |
| Mana | `0` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |
| itypea1 | `h2h` |
| itypeb1 | `h2h` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 20 | min block % |
| par2 | 65 | max block % |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| passivestat1: passive_weaponblock | `dm12` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| percent chance | `dm12` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Chance To Block +% | L1–20: `26, 32, 36, 39, 42, 44, 46, 47, 49, 50, 51, 52, 53, 54, 55, 56, 56, 56, 57, 57` |


#### Cloak of Shadows — ID 264


| Property | Value |
| --- | --- |
| Tree | Shadow Disciplines |
| Required character level | 12 |
| Immediate prerequisites | Psychic Hammer |
| All upstream prerequisites | Psychic Hammer |
| Type | active |
| Internal data name | `Cloak of Shadows` |
| Mana | `max(1, (13)×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |
| aurafilter | `57347` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 30 | min radius of effect |
| par2 | 30 | max radius of effect |
| par3 | 200 | duration |
| par4 | 25 | Duration per level |
| par5 | 15 | percent armor decrease |
| par6 | 3 | percent decrease per level |
| par7 | 10 | percent armor bonus |
| par8 | 3 | percent armor bonus per level |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurastat1: skill_armor_percent | `-min(ln56,95)` |
| passivestat1: item_armor_percent | `ln78` |
| aurarangecalc | `dm12` |
| auralencalc | `ln34` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Enemy Defense: / percent | `-min(ln56,95)` | — |
| Defense Bonus: / percent | `ln78` | — |
| Duration: | `ln34` | — |
| Range: | `dm12` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 13 |
| Constant / source label | Range: 20 (yards) |
| Defense Bonus +X% | L1–20: `10, 13, 16, 19, 22, 25, 28, 31, 34, 37, 40, 43, 46, 49, 52, 55, 58, 61, 64, 67` |
| Enemy Defense -X% | L1–20: `15, 18, 21, 24, 27, 30, 33, 36, 39, 42, 45, 48, 51, 54, 57, 60, 63, 66, 69, 72` |
| Duration X Seconds | L1–20: `8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27` |


#### Fade — ID 267


| Property | Value |
| --- | --- |
| Tree | Shadow Disciplines |
| Required character level | 18 |
| Immediate prerequisites | Burst of Speed |
| All upstream prerequisites | Claw Mastery, Burst of Speed |
| Type | active |
| Internal data name | `Fade` |
| Mana | `max(1, (10)×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 10 | min Elemental resistance |
| par2 | 75 | max elemental resist |
| par3 | 40 | min curse length reduction |
| par4 | 90 | max curse length reduction |
| par5 | 3000 | duration |
| par6 | 300 | Duration per level |
| par7 | 1 | damage resist % |
| par8 | 1 | damage resist % per level |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurastat1: fireresist | `dm12` |
| aurastat2: coldresist | `dm12` |
| aurastat3: lightresist | `dm12` |
| aurastat4: poisonresist | `dm12` |
| aurastat5: curse_resistance | `dm34` |
| aurastat6: damageresist | `ln78` |
| passivestat1: fade | `2` |
| auralencalc | `ln56` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Duration: | `ln56` | — |
| Resist All: / percent | `dm12` | — |
| Reduces curse duration by / percent | `dm34` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 10 |
| Curse Duration Reduced By % | L1–20: `47, 53, 58, 62, 65, 67, 69, 71, 73, 74, 75, 76, 77, 78, 79, 80, 80, 81, 81, 82` |
| Resist All +% | L1–20: `19, 27, 33, 38, 42, 45, 47, 50, 52, 54, 56, 57, 58, 60, 60, 62, 62, 63, 63, 64` |
| Duration in Seconds | L1–20: `120, 132, 144, 156, 168, 180, 192, 204, 216, 228, 240, 252, 264, 276, 288, 300, 312, 324, 336, 348` |
| Physical Resist +X% | L1–20: `1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20` |


#### Shadow Warrior — ID 268


| Property | Value |
| --- | --- |
| Tree | Shadow Disciplines |
| Required character level | 18 |
| Immediate prerequisites | Cloak of Shadows, Weapon Block |
| All upstream prerequisites | Psychic Hammer, Cloak of Shadows, Claw Mastery, Weapon Block |
| Type | summon / active |
| Internal data name | `Shadow Warrior` |
| Mana | `max(1, (54 + 1×(L−1))×0.5)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |
| Shared casting delay | 150 frames = 6 seconds |
| pettype | `shadowwarrior` |
| summon | `shadowwarrior` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 15 | Plus % HP per level |
| par2 | 40 | plus to hit per level |
| par3 | 12 | Plus % AC per level |
| par4 | 0 | ? |
| par5 | 18 | base item quality level |
| par6 | 2 | item quality per level |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurastat1: tohit | `lvl*par2` |
| aurastat2: skill_armor_percent | `lvl*par3` |
| aurastat3: strength | `lvl*10` |
| aurastat4: dexterity | `lvl*10` |
| passivestat1: fireresist | `min(lvl*4,75)` |
| passivestat2: coldresist | `min(lvl*4,75)` |
| passivestat3: lightresist | `min(lvl*4,75)` |
| passivestat4: poisonresist | `min(lvl*4,75)` |
| petmax | `1` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Defense Bonus: / percent | `(lvl-1)*par3` | — |
| Attack: | `lvl*par2` | — |
| descline4 (formatter 13) | `(lvl-1)*par1` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Mana Cost | L1–20: `27, 27, 28, 28, 29, 29, 30, 30, 31, 31, 32, 32, 33, 33, 34, 34, 35, 35, 36, 36` |
| Life | L1–20: `376, 432, 488, 545, 601, 658, 714, 770, 827, 883, 940, 996, 1052, 1109, 1165, 1222, 1278, 1334, 1391, 1447` |
| Attack Rating +% | L1–20: `40, 80, 120, 160, 200, 240, 280, 320, 360, 400, 440, 480, 520, 560, 600, 640, 680, 720, 760, 800` |
| Defense +% | L1–20: `-, 12, 24, 36, 48, 60, 72, 84, 96, 108, 120, 132, 144, 156, 168, 180, 192, 204, 216, 228` |


**Summon base monster record** — seed values, NOT the final buffed summon. Apply this skill's HP/damage/AR calculations, mastery, summon level, difficulty and generated equipment; absent difficulty HP fields can be supplied by hardcoded handling.

| MonStats field | Value |
| --- | --- |
| Id | `shadowwarrior` |
| AI | `ShadowWarrior` |
| aidel | `15` |
| aidel(N) | `15` |
| aidel(H) | `15` |
| aip1 | `40` |
| aip1(N) | `40` |
| aip1(H) | `40` |
| aip2 | `30` |
| aip2(N) | `30` |
| aip2(H) | `30` |
| aip3 | `60` |
| aip3(N) | `60` |
| aip3(H) | `60` |
| aip4 | `1` |
| aip4(N) | `1` |
| aip4(H) | `1` |
| aip8 | `268` |
| aip8(N) | `5` |
| aip8(H) | `64` |
| Skill1 | `Fists of Fire` |
| Sk1mode | `seq_swtigerfist` |
| Sk1lvl | `1` |
| Skill2 | `Blade Fury` |
| Sk2mode | `seq_swbladefury` |
| Sk2lvl | `1` |
| Skill3 | `Blades of Ice` |
| Sk3mode | `seq_swtigerfist` |
| Sk3lvl | `1` |
| Skill4 | `Dragon Claw` |
| Sk4mode | `seq_swtigerfist` |
| Sk4lvl | `1` |
| Skill5 | `Dragon Flight` |
| Sk5mode | `seq_swdragonflight` |
| Sk5lvl | `1` |
| Skill6 | `Claws of Thunder` |
| Sk6mode | `seq_swtigerfist` |
| Sk6lvl | `1` |
| Skill7 | `Attack` |
| Sk7mode | `A2` |
| Sk7lvl | `1` |
| ResDm | `40` |
| ResDm(N) | `40` |
| ResDm(H) | `40` |
| noRatio | `1` |
| minHP | `376` |
| maxHP | `376` |
| AC | `196` |
| A1TH | `163` |
| A2TH | `163` |
| AC(N) | `196` |
| A1TH(N) | `243` |
| A2TH(N) | `243` |
| AC(H) | `196` |
| A1TH(H) | `323` |
| A2TH(H) | `323` |


#### Mind Blast — ID 273


| Property | Value |
| --- | --- |
| Tree | Shadow Disciplines |
| Required character level | 24 |
| Immediate prerequisites | Cloak of Shadows |
| All upstream prerequisites | Psychic Hammer, Cloak of Shadows |
| Type | active |
| Internal data name | `Mind Blast` |
| Mana | `max(1, (15)×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |
| aurafilter | `33667` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| Physical (raw) | 10–20 | 2–2 | 5–5 | 8–8 | 8–8 | 8–8 |
| Physical (HP equivalent / see channel role; ×1) | 10–20 | 2–2 | 5–5 | 8–8 | 8–8 | 8–8 |
| Physical unsynergized L20 | 96–106 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 50 | length of stun |
| par2 | 5 | additional lengh of stun |
| par3 | 150 | conversion length min |
| par4 | 100 | conversion length random range |
| par5 | 15 | chance for conversion |
| par6 | 40 | max chance for conversion |
| par7 | 4 | radius |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurarangecalc | `par7` |
| E length: frames, L1; increments L2–8 / L9–16 / L17+ | `50; 5 / 5 / 5` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Chance to convert: / percent | `dm56` | — |
| Stun Length: | `min(250,edln)` | — |
| Duration: | `par3` | `par3+par4` |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 15 |
| Constant / source label | Duration: 6-10 Seconds |
| Damage | L1–20: `10-20, 12-22, 14-24, 16-26, 18-28, 20-30, 22-32, 24-34, 29-39, 34-44, 39-49, 44-54, 49-59, 54-64, 59-69, 64-74, 72-82, 80-90, 88-98, 96-106` |
| Chance To Convert % | L1–20: `18, 21, 24, 26, 27, 28, 29, 30, 31, 32, 32, 33, 33, 34, 34, 35, 35, 35, 35, 36` |
| Stun Length X Sec. | L1–20: `2, 2.2, 2.4, 2.6, 2.8, 3, 3.2, 3.4, 3.6, 3.8, 4, 4.2, 4.4, 4.6, 4.8, 5, 5.2, 5.4, 5.6, 5.8` |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **mindblast center** (Missiles ID 576): `pSrvDoFunc`=`1`; `Range`=`10`.


Component **mindblast hit** (Missiles ID 551): `pSrvDoFunc`=`1`; `Range`=`10`.




#### Venom — ID 278


| Property | Value |
| --- | --- |
| Tree | Shadow Disciplines |
| Required character level | 30 |
| Immediate prerequisites | Fade |
| All upstream prerequisites | Claw Mastery, Burst of Speed, Fade |
| Type | active |
| Internal data name | `Venom` |
| Mana | `max(1, (12)×1)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / pois (raw) | 24–32 | 6–6 | 8–8 | 10–10 | 12–12 | 14–14 |
| E / pois (rate HP/frame; ×0.25) | 6–8 | 1.5–1.5 | 2–2 | 2.5–2.5 | 3–3 | 3.5–3.5 |
| E / pois unsynergized L20 | 42.5–44.5 | — | — | — | — | — |
| Poison total HP, L1 / L20 (no item/synergy) | 60–80 / 425–445 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 3000 | duration |
| par2 | 100 | duration per level |
| par3 | 0 | ? |
| par4 | 0 | ? |
| par5 | 0 | ? |
| par6 | 0 | ? |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurastat1: poisonmindam | `enms` |
| aurastat2: poisonmaxdam | `exms` |
| aurastat3: skill_poison_override_length | `edma` |
| auralencalc | `ln12` |
| E length: frames, L1; increments L2–8 / L9–16 / L17+ | `10; 0 / 0 / 0` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Duration: | `ln12` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 12 |
| Poison Damage over 0.4 Seconds | L1–20: `60-80, 75-95, 90-110, 105-125, 120-140, 135-155, 150-170, 165-185, 185-205, 205-225, 225-245, 245-265, 265-285, 285-305, 305-325, 325-345, 350-370, 375-395, 400-420, 425-445` |
| Duration in Seconds | L1–20: `120, 124, 128, 132, 136, 140, 144, 148, 152, 156, 160, 164, 168, 172, 176, 180, 184, 188, 192, 196` |


#### Shadow Master — ID 279


| Property | Value |
| --- | --- |
| Tree | Shadow Disciplines |
| Required character level | 30 |
| Immediate prerequisites | Shadow Warrior |
| All upstream prerequisites | Psychic Hammer, Cloak of Shadows, Claw Mastery, Weapon Block, Shadow Warrior |
| Type | summon / active |
| Internal data name | `Shadow Master` |
| Mana | `max(1, (70 + 1×(L−1))×0.5)` |
| Animation / source-damage field | `SC; SrcDam=0 /128` |
| Shared casting delay | 150 frames = 6 seconds |
| pettype | `shadowwarrior` |
| summon | `shadowmaster` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 15 | Pluse % HP per level |
| par2 | 40 | plus to hit per level |
| par3 | 5 | Min % resist all |
| par4 | 90 | Max % resist all |
| par5 | 24 | base item quality level |
| par6 | 3 | item quality per level |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurastat1: tohit | `lvl*par2` |
| aurastat2: strength | `lvl*10` |
| aurastat3: dexterity | `lvl*10` |
| passivestat1: fireresist | `dm34` |
| passivestat2: coldresist | `dm34` |
| passivestat3: lightresist | `dm34` |
| passivestat4: poisonresist | `dm34` |
| petmax | `1` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Resist All: / percent | `((110*(lvl-1))/(lvl+5)*(par4-par3))/100+par3` | — |
| Attack: | `lvl*par2` | — |
| descline4 (formatter 13) | `(lvl-1)*par1` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Mana Cost | L1–20: `35, 35, 36, 36, 37, 37, 38, 38, 39, 39, 40, 40, 41, 41, 42, 42, 43, 43, 44, 44` |
| Life | L1–20: `376, 432, 488, 545, 601, 658, 714, 770, 827, 883, 940, 996, 1052, 1109, 1165, 1222, 1278, 1334, 1391, 1447` |
| Attack Rating +X | L1–20: `40, 80, 120, 160, 200, 240, 280, 320, 360, 400, 440, 480, 520, 560, 600, 640, 680, 720, 760, 800` |
| Resist All +% | L1–20: `5, 17, 27, 35, 42, 47, 51, 55, 57, 61, 62, 65, 67, 68, 70, 71, 73, 73, 74, 75` |


**Summon base monster record** — seed values, NOT the final buffed summon. Apply this skill's HP/damage/AR calculations, mastery, summon level, difficulty and generated equipment; absent difficulty HP fields can be supplied by hardcoded handling.

| MonStats field | Value |
| --- | --- |
| Id | `shadowmaster` |
| AI | `ShadowMaster` |
| aidel | `15` |
| aidel(N) | `15` |
| aidel(H) | `15` |
| aip1 | `20` |
| aip1(N) | `10` |
| aip1(H) | `10` |
| aip2 | `20` |
| aip2(N) | `36` |
| aip2(H) | `36` |
| aip3 | `60` |
| aip3(N) | `60` |
| aip3(H) | `60` |
| aip8 | `279` |
| Skill1 | `Fists of Fire` |
| Sk1mode | `seq_swtigerfist` |
| Sk1lvl | `1` |
| Skill2 | `Blade Fury` |
| Sk2mode | `seq_swbladefury` |
| Sk2lvl | `1` |
| Skill3 | `Blades of Ice` |
| Sk3mode | `seq_swtigerfist` |
| Sk3lvl | `1` |
| Skill4 | `Dragon Claw` |
| Sk4mode | `seq_swtigerfist` |
| Sk4lvl | `1` |
| Skill5 | `Dragon Flight` |
| Sk5mode | `seq_swdragonflight` |
| Sk5lvl | `1` |
| Skill6 | `Claws of Thunder` |
| Sk6mode | `seq_swtigerfist` |
| Sk6lvl | `1` |
| Skill7 | `Attack` |
| Sk7mode | `A2` |
| Sk7lvl | `1` |
| ResDm | `40` |
| ResDm(N) | `40` |
| ResDm(H) | `40` |
| noRatio | `1` |
| minHP | `376` |
| maxHP | `376` |
| AC | `196` |
| A1TH | `163` |
| A2TH | `163` |
| AC(N) | `196` |
| A1TH(N) | `243` |
| A2TH(N) | `243` |
| AC(H) | `196` |
| A1TH(H) | `323` |
| A2TH(H) | `323` |


### Martial Arts

Source display tables: [Arreat Summit — Martial Arts](http://classic.battle.net/diablo2exp/skills/assassin-martialarts.shtml). Exact fields: pinned Skills.txt / SkillDesc.txt / Missiles.txt listed in §0.


| ID | Skill | Required clvl | Immediate prerequisites | Type | Mana expression |
| --- | --- | --- | --- | --- | --- |
| 254 | Tiger Strike | 1 | None | active | `max(1, (1)×1)` |
| 255 | Dragon Talon | 1 | None | active | `max(1, (6)×1)` |
| 259 | Fists of Fire | 6 | None | active | `max(1, (2)×1)` |
| 260 | Dragon Claw | 6 | Dragon Talon | active | `max(1, (2)×1)` |
| 265 | Cobra Strike | 12 | Tiger Strike | active | `max(1, (2)×1)` |
| 269 | Claws of Thunder | 18 | Fists of Fire | active | `max(1, (4)×1)` |
| 270 | Dragon Tail | 18 | Dragon Claw | active | `max(1, (10)×1)` |
| 274 | Blades of Ice | 24 | Claws of Thunder | active | `max(1, (3)×1)` |
| 275 | Dragon Flight | 24 | Dragon Tail | active | `max(1, (15)×1)` |
| 280 | Phoenix Strike | 30 | Cobra Strike, Blades of Ice | active | `max(1, (4)×1)` |


#### Tiger Strike — ID 254


| Property | Value |
| --- | --- |
| Tree | Martial Arts |
| Required character level | 1 |
| Immediate prerequisites | None |
| All upstream prerequisites | None |
| Type | active |
| Internal data name | `Tiger Strike` |
| Mana | `max(1, (1)×1)` |
| Animation / source-damage field | `A1; SrcDam=128 /128` |
| itypea1 | `mele` |
| progressive | `1` |
| prgdam | `1` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 100 | % Damage bonus |
| par2 | 20 | % damage per level |
| par3 | 375 | duration |
| par4 | 50 | tohit bonus for each charge-up |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurastat1: progressive_damage | `(server routine)` |
| aurastat2: progressive_tohit | `par4` |
| auralencalc | `par3` |
| calc1 — progressive damage | `ln12` |
| ToHit (+% AR for usual attacks) | `15 + 7×(L−1)` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Attack: / percent | `toht` | — |
| Charge 3 - / percent damage | `3*ln12` | — |
| Charge 2 - / percent damage | `2*ln12` | — |
| Charge 1 - / percent damage | `ln12` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 1 |
| Attack +% | L1–20: `15, 22, 29, 36, 43, 50, 57, 64, 71, 78, 85, 92, 99, 106, 113, 120, 127, 134, 141, 148` |
| Charge 1 Damage +% | L1–20: `100, 120, 140, 160, 180, 200, 220, 240, 260, 280, 300, 320, 340, 360, 380, 400, 420, 440, 460, 480` |
| Charge 2 Damage +% | L1–20: `200, 240, 280, 320, 360, 400, 440, 480, 520, 560, 600, 640, 680, 720, 760, 800, 840, 880, 920, 960` |
| Charge 3 Damage +% | L1–20: `300, 360, 420, 480, 540, 600, 660, 720, 780, 840, 900, 960, 1020, 1080, 1140, 1200, 1260, 1320, 1380, 1440` |


#### Dragon Talon — ID 255


| Property | Value |
| --- | --- |
| Tree | Martial Arts |
| Required character level | 1 |
| Immediate prerequisites | None |
| All upstream prerequisites | None |
| Type | active |
| Internal data name | `Dragon Talon` |
| Mana | `max(1, (6)×1)` |
| Animation / source-damage field | `KK; SrcDam=0 /128` |
| finishing | `1` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 5 | Percent damage |
| par2 | 7 | percent damage per level |
| par3 | 50 | min knockback% vs. unique |
| par4 | 100 | max knockback% vs. unique |
| par5 | 25 | min knockback% vs. boss |
| par6 | 99 | max knockback% vs. boss |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| calc1 — number of kicks | `lvl/6+1` |
| calc2 — knockback% vs. unique | `dm34` |
| calc3 — knockback% vs. boss | `dm56` |
| calc4 — knockback% vs. player | `dm56` |
| ToHit (+% AR for usual attacks) | `20 + 35×(L−1)` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Attack: / percent | `toht` | — |
| Kick Damage: / percent | `ln12` | — |
| Kick / Kicks | `lvl/6+1` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 6 |
| Number of Kicks | L1–20: `1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4` |
| Kick Damage +% | L1–20: `5, 12, 19, 26, 33, 40, 47, 54, 61, 68, 75, 82, 89, 96, 103, 110, 117, 124, 131, 138` |
| Attack Rating +% | L1–20: `20, 55, 90, 125, 160, 195, 230, 265, 300, 335, 370, 405, 440, 475, 510, 545, 580, 615, 650, 685` |


#### Fists of Fire — ID 259


| Property | Value |
| --- | --- |
| Tree | Martial Arts |
| Required character level | 6 |
| Immediate prerequisites | None |
| All upstream prerequisites | None |
| Type | active |
| Internal data name | `Fists of Fire` |
| Mana | `max(1, (2)×1)` |
| Animation / source-damage field | `SQ; SrcDam=128 /128` |
| itypea1 | `h2h` |
| progressive | `1` |
| prgdam | `4` |
| prgstack | `1` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / fire (raw) | 6–10 | 5–5 | 10–11 | 20–22 | 30–33 | 40–44 |
| E / fire (HP equivalent / see channel role; ×1) | 6–10 | 5–5 | 10–11 | 20–22 | 30–33 | 40–44 |
| E / fire unsynergized L20 | 201–221 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 4 | Radius of explosion |
| par2 | 4 | Radius of firewall fragments |
| par3 | 375 | duration |
| par4 | 50 | tohit bonus for each charge-up |
| par8 | 12 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurastat1: progressive_fire | `(server routine)` |
| aurastat2: progressive_tohit | `par4` |
| auralencalc | `par3` |
| calc1 — convert to fire% | `lvl*3` |
| prgcalc2 | `par1` |
| prgcalc3 | `par2` |
| EDmgSymPerCalc | `(skill('Royal Strike'.blvl)) * par8` |
| ToHit (+% AR for usual attacks) | `15 + 7×(L−1)` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Attack: / percent | `toht` | — |
| fire damage: / Charge 3 - | `m1eo*50/256` | `m1ey*50/256` |
| fire damage radius: / Charge 2 - | `par1` | — |
| Phoenix Strike / Fire Damage per Level | `par8` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Fists Of Fire Receives Bonuses From
- Phoenix Strike: +12% Fire Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 2 |
| Attack +% | L1–20: `15, 22, 29, 36, 43, 50, 57, 64, 71, 78, 85, 92, 99, 106, 113, 120, 127, 134, 141, 148` |
| Fire Damage: Charge 1 | L1–20: `6-10, 11-15, 16-20, 21-25, 26-30, 31-35, 36-40, 41-45, 51-56, 61-67, 71-78, 81-89, 91-100, 101-111, 111-122, 121-133, 141-155, 161-177, 181-199, 201-221` |
| Charge 2: Fire Radius | 1 source values: `2.6 Yards` |
| Charge 3 Fire Damage Per Second | L1–20: `9-15, 17-23, 25-31, 32-39, 40-46, 48-54, 56-62, 64-70, 79-85, 95-101, 110-117, 126-132, 142-148, 157-164, 173-179, 189-195, 214-221, 239-248, 264-275, 289-301` |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **fistsoffirefirewall** (Missiles ID 557): `pSrvDoFunc`=`1`; `Range`=`64`; `CollideType`=`8`; `Size`=`2`; `HitShift`=`3`; `EType`=`fire`; `EDmgSymPerCalc`=`(skill('Royal Strike'.blvl)) * 6`.


| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / fire (raw) | 6–10 | 5–5 | 10–10 | 16–17 | 22–24 | 30–32 |
| E / fire (HP equivalent / see channel role; ×0.03125) | 0.1875–0.3125 | 0.15625–0.15625 | 0.3125–0.3125 | 0.5–0.53125 | 0.6875–0.75 | 0.9375–1 |
| E / fire unsynergized L20 | 5.78125–6.03125 | — | — | — | — | — |


Component **fistsoffireexplode** (Missiles ID 556): `pSrvDoFunc`=`1`; `Range`=`16`; `CollideKill`=`1`; `LastCollide`=`1`; `Size`=`1`; `GetHit`=`1`; `ResultFlags`=`4`; `HitShift`=`8`.




#### Dragon Claw — ID 260


| Property | Value |
| --- | --- |
| Tree | Martial Arts |
| Required character level | 6 |
| Immediate prerequisites | Dragon Talon |
| All upstream prerequisites | Dragon Talon |
| Type | active |
| Internal data name | `Dragon Claw` |
| Mana | `max(1, (2)×1)` |
| Animation / source-damage field | `SQ; SrcDam=128 /128` |
| itypea1 | `h2h` |
| itypeb1 | `h2h` |
| finishing | `1` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 50 | % Damage bonus |
| par2 | 5 | % damage per level |
| par8 | 4 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| calc1 — damage% | `ln12 + skill('Claw Mastery'.blvl)*par8` |
| ToHit (+% AR for usual attacks) | `40 + 25×(L−1)` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Attack: / percent | `toht` | — |
| Damage: / percent | `ln12 + (skill('Claw Mastery'.blvl)) * par8` | — |
| Claw Mastery / Damage per Level | `par8` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Dragon Claw Receives Bonuses From
- Claw Mastery: +4% Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 2 |
| Damage +% | L1–20: `50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120, 125, 130, 135, 140, 145` |
| Attack +% | L1–20: `40, 65, 90, 115, 140, 165, 190, 215, 240, 265, 290, 315, 340, 365, 390, 415, 440, 465, 490, 515` |


#### Cobra Strike — ID 265


| Property | Value |
| --- | --- |
| Tree | Martial Arts |
| Required character level | 12 |
| Immediate prerequisites | Tiger Strike |
| All upstream prerequisites | Tiger Strike |
| Type | active |
| Internal data name | `Cobra Strike` |
| Mana | `max(1, (2)×1)` |
| Animation / source-damage field | `A1; SrcDam=128 /128` |
| itypea1 | `mele` |
| progressive | `1` |
| prgdam | `2` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 40 | Base percent life steal |
| par2 | 5 | Percent life steal per level |
| par3 | 375 | duration |
| par4 | 50 | tohit bonus for each charge-up |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurastat1: progressive_steal | `(server routine)` |
| aurastat2: progressive_tohit | `par4` |
| auralencalc | `par3` |
| ToHit (+% AR for usual attacks) | `15 + 7×(L−1)` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Attack: / percent | `toht` | — |
| Charge 3 - / percent life and mana stealing | `2*ln12` | — |
| Charge 2 - / percent life and mana stealing | `ln12` | — |
| Charge 1 - / percent life stealing | `ln12` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 2 |
| Attack Rating +% | L1–20: `15, 22, 29, 36, 43, 50, 57, 64, 71, 78, 85, 92, 99, 106, 113, 120, 127, 134, 141, 148` |
| Charge 1: Life Stealing % | L1–20: `40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120, 125, 130, 135` |
| Charge 2: Life and Mana Stealing % | L1–20: `40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120, 125, 130, 135` |
| Charge 3: Life and Mana Stealing % | L1–20: `80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 210, 220, 230, 240, 250, 260, 270` |


#### Claws of Thunder — ID 269


| Property | Value |
| --- | --- |
| Tree | Martial Arts |
| Required character level | 18 |
| Immediate prerequisites | Fists of Fire |
| All upstream prerequisites | Fists of Fire |
| Type | active |
| Internal data name | `Claws of Thunder` |
| Mana | `max(1, (4)×1)` |
| Animation / source-damage field | `SQ; SrcDam=128 /128` |
| itypea1 | `h2h` |
| progressive | `1` |
| prgdam | `4` |
| prgstack | `1` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / ltng (raw) | 1–80 | 0–20 | 0–40 | 0–60 | 0–80 | 0–100 |
| E / ltng (HP equivalent / see channel role; ×1) | 1–80 | 0–20 | 0–40 | 0–60 | 0–80 | 0–100 |
| E / ltng unsynergized L20 | 1–780 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 4 | skip |
| par3 | 375 | duration |
| par4 | 50 | tohit bonus for each charge-up |
| par8 | 8 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurastat1: progressive_lightning | `(server routine)` |
| aurastat2: progressive_tohit | `par4` |
| auralencalc | `par3` |
| prgcalc3 | `par1` |
| EDmgSymPerCalc | `(skill('Royal Strike'.blvl)) * par8` |
| ToHit (+% AR for usual attacks) | `15 + 7×(L−1)` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Attack: / percent | `toht` | — |
| Charge 3 - / charged bolt damage: | `m3en` | `m3ex` |
| Charge 2 - / nova damage: | `m2en` | `m2ex` |
| Phoenix Strike / Lightning Damage per Level | `par8` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Claws of Thunder Receives Bonuses From
- Phoenix Strike: +8% Lightning Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 4 |
| Attack Rating +% | L1–20: `15, 22, 29, 36, 43, 50, 57, 64, 71, 78, 85, 92, 99, 106, 113, 120, 127, 134, 141, 148` |
| Charge 1 Lightning Damage | L1–20: `1-80, 1-100, 1-120, 1-140, 1-160, 1-180, 1-200, 1-220, 1-260, 1-300, 1-340, 1-380, 1-420, 1-460, 1-500, 1-540, 1-600, 1-660, 1-720, 1-780` |
| Charge 2 Nova Damage | L1–20: `1-30, 1-45, 1-60, 1-75, 1-90, 1-105, 1-120, 1-135, 1-160, 1-185, 1-210, 1-235, 1-260, 1-285, 1-310, 1-335, 1-370, 1-405, 1-440, 1-475` |
| Charge 3 Charged Bolt Damage | L1–20: `1-40, 1-60, 1-80, 1-100, 1-120, 1-140, 1-160, 1-180, 1-220, 1-260, 1-300, 1-340, 1-380, 1-420, 1-460, 1-500, 1-560, 1-620, 1-680, 1-740` |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **clawsofthundernova** (Missiles ID 559): `pSrvDoFunc`=`1`; `Vel`=`24`; `MaxVel`=`24`; `Range`=`13`; `CollideType`=`3`; `LastCollide`=`1`; `NextHit`=`1`; `NextDelay`=`4`; `Size`=`1`; `GetHit`=`1`; `ResultFlags`=`4`; `HitShift`=`8`; `EType`=`ltng`; `EDmgSymPerCalc`=`(skill('Royal Strike'.blvl)) * 8`.


| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / ltng (raw) | 1–30 | 0–15 | 0–25 | 0–35 | 0–45 | 0–65 |
| E / ltng (HP equivalent / see channel role; ×1) | 1–30 | 0–15 | 0–25 | 0–35 | 0–45 | 0–65 |
| E / ltng unsynergized L20 | 1–475 | — | — | — | — | — |


Component **clawsofthunderbolt** (Missiles ID 558): `pSrvDoFunc`=`1`; `Vel`=`12`; `MaxVel`=`12`; `Range`=`98`; `CollideType`=`3`; `CollideKill`=`1`; `LastCollide`=`1`; `NextHit`=`1`; `NextDelay`=`4`; `Size`=`1`; `GetHit`=`1`; `ResultFlags`=`4`; `HitShift`=`8`; `EType`=`ltng`; `EDmgSymPerCalc`=`(skill('Royal Strike'.blvl)) * 8`.


| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / ltng (raw) | 1–40 | 0–20 | 0–40 | 0–60 | 0–80 | 0–100 |
| E / ltng (HP equivalent / see channel role; ×1) | 1–40 | 0–20 | 0–40 | 0–60 | 0–80 | 0–100 |
| E / ltng unsynergized L20 | 1–740 | — | — | — | — | — |




#### Dragon Tail — ID 270


| Property | Value |
| --- | --- |
| Tree | Martial Arts |
| Required character level | 18 |
| Immediate prerequisites | Dragon Claw |
| All upstream prerequisites | Dragon Talon, Dragon Claw |
| Type | active |
| Internal data name | `Dragon Tail` |
| Mana | `max(1, (10)×1)` |
| Animation / source-damage field | `KK; SrcDam=0 /128` |
| finishing | `1` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 50 | Percent area damage min |
| par2 | 10 | percent area damage per level |
| par3 | 6 | Radius |
| par4 | -40 | Attack rate penalty |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurarangecalc | `par3` |
| calc1 — damage% | `ln12` |
| ToHit (+% AR for usual attacks) | `20 + 15×(L−1)` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Attack: / percent | `toht` | — |
| fire damage: / percent | `ln12` | — |
| Radius: | `par3` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 10 |
| Fire Damage +% | L1–20: `50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 210, 220, 230, 240` |
| Attack +% | L1–20: `20, 35, 50, 65, 80, 95, 110, 125, 140, 155, 170, 185, 200, 215, 230, 245, 260, 275, 290, 305` |
| Constant / source label | 4 (yards) |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **dragontail missile** (Missiles ID 533): `pSrvDoFunc`=`1`; `Range`=`16`; `CollideKill`=`1`; `LastCollide`=`1`; `Size`=`1`; `HitShift`=`8`.




#### Blades of Ice — ID 274


| Property | Value |
| --- | --- |
| Tree | Martial Arts |
| Required character level | 24 |
| Immediate prerequisites | Claws of Thunder |
| All upstream prerequisites | Fists of Fire, Claws of Thunder |
| Type | active |
| Internal data name | `Blades of Ice` |
| Mana | `max(1, (3)×1)` |
| Animation / source-damage field | `SQ; SrcDam=128 /128` |
| aurafilter | `34571` |
| itypea1 | `h2h` |
| progressive | `1` |
| prgdam | `4` |
| prgstack | `1` |


**Unsynergized skill-owned channels and five damage brackets:**

| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / cold (raw) | 15–35 | 8–8 | 10–10 | 20–22 | 30–32 | 40–42 |
| E / cold (HP equivalent / see channel role; ×1) | 15–35 | 8–8 | 10–10 | 20–22 | 30–32 | 40–42 |
| E / cold unsynergized L20 | 231–259 | — | — | — | — | — |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 6 | Second level radius |
| par2 | 3 | Third level radius |
| par3 | 375 | duration |
| par4 | 50 | tohit bonus for each charge-up |
| par5 | 1 | freeze length divisor |
| par8 | 8 | damage synergy |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurastat1: progressive_cold | `(server routine)` |
| aurastat2: progressive_tohit | `par4` |
| auralencalc | `par3` |
| prgcalc2 | `par1` |
| prgcalc3 | `par2` |
| EDmgSymPerCalc | `(skill('Royal Strike'.blvl)) * par8` |
| ToHit (+% AR for usual attacks) | `15 + 7×(L−1)` |
| E length: frames, L1; increments L2–8 / L9–16 / L17+ | `100; 10 / 10 / 10` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Attack: / percent | `toht` | — |
| freeze duration: / Charge 3 - | `edln` | — |
| cold damage radius: / Charge 2 - | `par1` | — |
| cold damage: / Charge 1 - | `par1` | — |
| Phoenix Strike / Cold Damage per Level | `par8` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Blades Of Ice Receives Bonuses From
- Phoenix Strike: +8% Cold Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 3 |
| Attack Rating +% | L1–20: `15, 22, 29, 36, 43, 50, 57, 64, 71, 78, 85, 92, 99, 106, 113, 120, 127, 134, 141, 148` |
| Charge 1 Cold Damage | L1–20: `15-35, 23-43, 31-51, 39-59, 47-67, 55-75, 63-83, 71-91, 81-101, 91-111, 101-121, 111-131, 121-141, 131-151, 141-161, 151-171, 171-193, 191-215, 211-237, 231-259` |
| Charge 2 Cold Radius | 1 source values: `4 (yards)` |
| Charge 3 Freeze Duration in seconds | L1–20: `4, 4.4, 4.8, 5.2, 5.6, 6, 6.4, 6.8, 7.2, 7.6, 8, 8.4, 8.8, 9.2, 9.6, 10, 10.4, 10.8, 11.2, 11.6` |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **bladesoficecubes** (Missiles ID 561): `pSrvDoFunc`=`1`; `pSrvDmgFunc`=`10`; `Range`=`30`; `CollideType`=`3`; `LastCollide`=`1`; `Size`=`1`; `HitShift`=`8`; `EType`=`frze`; `ELen`=`100`; `ELevLen1`=`10`; `ELevLen2`=`10`; `ELevLen3`=`10`.


| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / frze (raw) | 1–1 | 0–0 | 0–0 | 0–0 | 0–0 | 0–0 |
| E / frze (HP equivalent / see channel role; ×1) | 1–1 | 0–0 | 0–0 | 0–0 | 0–0 | 0–0 |
| E / frze unsynergized L20 | 1–1 | — | — | — | — | — |


Component **bladesoficeexplode** (Missiles ID 560): `pSrvDoFunc`=`1`; `Range`=`16`; `CollideKill`=`1`; `LastCollide`=`1`; `Size`=`1`; `GetHit`=`1`; `ResultFlags`=`4`; `HitShift`=`8`.




#### Dragon Flight — ID 275


| Property | Value |
| --- | --- |
| Tree | Martial Arts |
| Required character level | 24 |
| Immediate prerequisites | Dragon Tail |
| All upstream prerequisites | Dragon Talon, Dragon Claw, Dragon Tail |
| Type | active |
| Internal data name | `Dragon Flight` |
| Mana | `max(1, (15)×1)` |
| Animation / source-damage field | `SQ; SrcDam=0 /128` |
| Shared casting delay | 25 frames = 1 seconds |
| finishing | `1` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 100 | % Damage bonus |
| par2 | 25 | % damage per level |
| par7 | 27 | range |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurarangecalc | `par7` |
| ToHit (+% AR for usual attacks) | `60 + 25×(L−1)` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Attack: / percent | `toht` | — |
| Kick Damage: / percent | `ln12` | — |


**Synergies:** no separate named percentage synergy block on the source page; any mastery/shared-skill dependencies are in the exact effect formulas above.


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 15 |
| Attack Rating +% | L1–20: `100, 120, 140, 160, 180, 200, 220, 240, 260, 280, 300, 320, 340, 360, 380, 400, 420, 440, 460, 480` |
| Kick Damage +% | L1–20: `100, 125, 150, 175, 200, 225, 250, 275, 300, 325, 350, 375, 400, 425, 450, 475, 500, 525, 550, 575` |


#### Phoenix Strike — ID 280


| Property | Value |
| --- | --- |
| Tree | Martial Arts |
| Required character level | 30 |
| Immediate prerequisites | Cobra Strike, Blades of Ice |
| All upstream prerequisites | Tiger Strike, Cobra Strike, Fists of Fire, Claws of Thunder, Blades of Ice |
| Type | active |
| Internal data name | `Royal Strike` |
| Mana | `max(1, (4)×1)` |
| Animation / source-damage field | `A1; SrcDam=128 /128` |
| itypea1 | `mele` |
| progressive | `1` |


**Parameters (zero shown when the documented parameter has no value):**

| Token | Value | Engine comment / role |
| --- | --- | --- |
| par1 | 8 | radius of jump to next target |
| par2 | 6 | radius of meteor explosion |
| par3 | 30 | Frames of fire |
| par4 | 15 | Frames of fire per level |
| par5 | 16 | chaos ice bolts |
| par6 | 10 | chain lightning skip |
| par7 | 25 | to hit bonus per charge up |


**Core effect, radius, duration, summon and synergy calculations:**

| Effect / field | Exact expression / values |
| --- | --- |
| aurastat1: progressive_other | `(server routine)` |
| aurastat2: progressive_tohit | `par7` |
| aurarangecalc | `par1` |
| auralencalc | `375` |
| calc1 | `par2` |
| prgcalc2 | `par6` |
| prgcalc3 | `par5` |
| ToHit (+% AR for usual attacks) | `15 + 7×(L−1)` |


**Descriptor effect / named synergy formulas** (text formatting may concatenate % labels; constants are exact):

| Named source / effect | Formula A | Formula B |
| --- | --- | --- |
| Attack: / percent | `toht` | — |
| Charge 3 - / chaos ice bolt damage: | `m3en` | `m3ex` |
| Charge 2 - / chain lightning damage: | `m2en` | `m2ex` |
| Fire Explosion Damage: / per second | `miss('royalstrikemeteorfire'.edns)*75/256` | `miss('royalstrikemeteorfire'.edxs)*75/256` |
| Charge 1 - / meteor damage: | `m1en` | `m1ex` |
| Fists of Fire / Fire Damage per Level | `10` | — |
| Fists of Fire / Average Fire Damage per Second per Level | `6` | — |
| Claws of Thunder / Lightning Damage per Level | `13` | — |
| Blades of Ice / Cold Damage per Level | `10` | — |


**Published synergy lines** (hard points unless the engine expression explicitly uses `.lvl`):

- Phoenix Strike Receives Bonuses From:
- Fists of Fire: +10% Fire Damage Per Level
- Fists of Fire: +6% Average Fire Damage Per Second Per Level
- Claws of Thunder: +13% Lightning Damage Per Level
- Blades of Ice: +10% Cold Damage Per Level


**Published UI sequences / constants** — entries marked L1–20 correspond in order to L=1…20. Damage may include mandatory prerequisite synergies; units/rounding follow the source, including known misleading labels.

| Published statistic | Values |
| --- | --- |
| Constant / source label | Mana Cost: 4 |
| Attack Rating +% | L1–20: `15, 22, 29, 36, 43, 50, 57, 64, 71, 78, 85, 92, 99, 106, 113, 120, 127, 134, 141, 148` |
| Charge 1 Meteor Damage | L1–20: `22-44, 33-55, 44-66, 55-77, 66-88, 77-99, 88-110, 99-121, 119-144, 140-157, 161-190, 182-213, 203-236, 224-259, 245-282, 266-305, 298-342, 330-378, 361-414, 393-451` |
| Charge 2 Chain Lightning Damage | L1–20: `1-45, 1-67, 1-90, 1-113, 1-135, 1-158, 1-180, 1-203, 1-248, 1-293, 1-339, 1-384, 1-429, 1-474, 1-519, 1-565, 1-632, 1-700, 1-768, 1-836` |
| Charge 3 Chaos Ice Bolt Damage | L1–20: `17-35, 22-39, 26-44, 30-48, 35-52, 39-57, 44-61, 48-66, 57-74, 66-83, 74-92, 83-101, 92-110, 101-118, 110-127, 118-136, 132-150, 145-165, 158-179, 171-193` |
| Fire Explosion Damage (per sec) | L1–20: `14-23, 25-35, 37-49, 51-60, 63-72, 75-86, 89-98, 100-110, 126-135, 150-159, 175-185, 199-210, 225-234, 250-260, 274-283, 300-309, 339-351, 379-393, 419-435, 459-478` |


**Missile components** — direct/descriptor references plus sub-missiles. Weapon inheritance, collision overlap and rate limits are not implied by a raw damage range.


Component **royalstrikemeteorcenter** (Missiles ID 564): `pSrvDoFunc`=`1`; `pSrvHitFunc`=`4`; `sHitPar1`=`1`; `Range`=`60`; `LastCollide`=`1`; `Size`=`1`; `HitShift`=`8`; `SubMissile1`=`royalstrikemeteor`; `HitSubMissile1`=`royalstrikemeteor`.


Component **royalstrikemeteor** (Missiles ID 563): `pSrvHitFunc`=`14`; `sHitPar1`=`6`; `sHitPar2`=`1`; `Range`=`60`; `CollideKill`=`1`; `LastCollide`=`1`; `ResultFlags`=`5`; `HitFlags`=`2`; `HitShift`=`8`; `EType`=`fire`; `EDmgSymPerCalc`=`(skill('Fists of Fire'.blvl)) * 10`; `HitSubMissile1`=`royalstrikemeteorfire`.


| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / fire (raw) | 20–40 | 10–10 | 19–21 | 29–33 | 38–42 | 46–50 |
| E / fire (HP equivalent / see channel role; ×1) | 20–40 | 10–10 | 19–21 | 29–33 | 38–42 | 46–50 |
| E / fire unsynergized L20 | 358–410 | — | — | — | — | — |


Component **royalstrikemeteorfire** (Missiles ID 567): `pSrvDoFunc`=`1`; `Range`=`37`; `CollideType`=`8`; `Size`=`2`; `HitShift`=`3`; `EType`=`fire`; `EDmgSymPerCalc`=`(skill('Fists of Fire'.blvl)) * 6`.


| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / fire (raw) | 6–10 | 5–5 | 10–10 | 16–17 | 22–24 | 30–32 |
| E / fire (HP equivalent / see channel role; ×0.03125) | 0.1875–0.3125 | 0.15625–0.15625 | 0.3125–0.3125 | 0.5–0.53125 | 0.6875–0.75 | 0.9375–1 |
| E / fire unsynergized L20 | 5.78125–6.03125 | — | — | — | — | — |


Component **royalstrikemeteortail** (Missiles ID 565): `Range`=`60`; `CollideKill`=`1`; `LastCollide`=`1`; `HitShift`=`8`.


Component **royalstrikemeteorexplode** (Missiles ID 566): `pSrvDoFunc`=`1`; `Param1`=`2`; `Range`=`16`; `LastCollide`=`1`; `Size`=`1`; `GetHit`=`1`; `ResultFlags`=`4`; `HitShift`=`8`.


Component **whitelightmissile** (Missiles ID 154): `pSrvDoFunc`=`1`; `Range`=`10`; `LevRange`=`10`; `LastCollide`=`1`.


Component **firemedium** (Missiles ID 105): `pSrvDoFunc`=`1`; `Range`=`90`; `LevRange`=`25`; `CollideType`=`3`; `Size`=`1`; `EType`=`fire`.


| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / fire (raw) | 2–2 | 2–2 | 2–2 | 2–2 | 2–2 | 2–2 |
| E / fire (HP equivalent / see channel role; ×0.00390625) | 0.0078125–0.0078125 | 0.0078125–0.0078125 | 0.0078125–0.0078125 | 0.0078125–0.0078125 | 0.0078125–0.0078125 | 0.0078125–0.0078125 |
| E / fire unsynergized L20 | 0.15625–0.15625 | — | — | — | — | — |


Component **firesmall** (Missiles ID 104): `pSrvDoFunc`=`1`; `Range`=`90`; `LevRange`=`25`; `CollideType`=`3`; `Size`=`1`; `EType`=`fire`.


| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / fire (raw) | 1–1 | 1–1 | 1–1 | 1–1 | 1–1 | 1–1 |
| E / fire (HP equivalent / see channel role; ×0.00390625) | 0.00390625–0.00390625 | 0.00390625–0.00390625 | 0.00390625–0.00390625 | 0.00390625–0.00390625 | 0.00390625–0.00390625 | 0.00390625–0.00390625 |
| E / fire unsynergized L20 | 0.078125–0.078125 | — | — | — | — | — |


Component **royalstrikechainlightning** (Missiles ID 568): `pSrvDoFunc`=`1`; `pSrvHitFunc`=`*12`; `Vel`=`30`; `MaxVel`=`30`; `Range`=`60`; `CollideType`=`3`; `NextHit`=`1`; `NextDelay`=`4`; `Size`=`2`; `GetHit`=`1`; `ResultFlags`=`4`; `HitShift`=`8`; `EType`=`ltng`; `EDmgSymPerCalc`=`(skill('Claws of Thunder'.blvl))*13`.


| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / ltng (raw) | 1–40 | 0–20 | 0–40 | 0–60 | 0–80 | 0–100 |
| E / ltng (HP equivalent / see channel role; ×1) | 1–40 | 0–20 | 0–40 | 0–60 | 0–80 | 0–100 |
| E / ltng unsynergized L20 | 1–740 | — | — | — | — | — |


Component **lightninghit** (Missiles ID 99): `pSrvDoFunc`=`1`; `Range`=`12`; `Size`=`1`; `HitShift`=`8`; `EType`=`ltng`.


| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / ltng (raw) | 2–5 | 2–2 | 2–2 | 2–2 | 2–2 | 2–2 |
| E / ltng (HP equivalent / see channel role; ×1) | 2–5 | 2–2 | 2–2 | 2–2 | 2–2 | 2–2 |
| E / ltng unsynergized L20 | 40–43 | — | — | — | — | — |


Component **royalstrikechaosice** (Missiles ID 569): `pSrvDoFunc`=`35`; `pSrvDmgFunc`=`2`; `Param1`=`3`; `dParam1`=`100`; `Vel`=`16`; `MaxVel`=`16`; `Range`=`40`; `CollideType`=`3`; `CollideKill`=`1`; `LastCollide`=`1`; `NextHit`=`1`; `NextDelay`=`4`; `Size`=`1`; `GetHit`=`1`; `ResultFlags`=`4`; `HitShift`=`8`; `EType`=`cold`; `EDmgSymPerCalc`=`(skill('Blades of Ice'.blvl))*10`; `ELen`=`100`; `ELevLen1`=`10`; `ELevLen2`=`15`; `ELevLen3`=`20`.


| Channel | Base L1 / named endpoint | Δ L2–8 | Δ L9–16 | Δ L17–22 | Δ L23–28 | Δ L29+ |
| --- | --- | --- | --- | --- | --- | --- |
| E / cold (raw) | 16–32 | 4–4 | 8–8 | 12–13 | 20–21 | 28–29 |
| E / cold (HP equivalent / see channel role; ×1) | 16–32 | 4–4 | 8–8 | 12–13 | 20–21 | 28–29 |
| E / cold unsynergized L20 | 156–176 | — | — | — | — | — |

## 5. Coverage, validation and outstanding verification

Coverage validation passed: **7 classes, 21 trees with 10 skills each, 210 distinct class skill IDs, and 99 ordered cumulative experience thresholds**. All XP-to-next differences were checked; level 99 starts at **3,520,485,254 XP**. The catalogue supplies skill identities, tier levels, prerequisite edges/closures, types, mana expressions, five-bracket base channels where data-owned, radius/duration/effect formulas, named synergy coefficients, missile dependencies and available published L1–20 sequences. Formula fields are research inputs, **not** a finished implementation.

Outstanding areas must not be guessed into a purported 1:1 build:

1. **Hardcoded server routines:** summon final HP/equipment/stat ordering, projectile collision density, Inferno/Arctic Blast damage bugs, NextDelay overlap, multi-hit rollback/action timing, charge release, corpse eligibility and summon AI. IDs and data parameters are included, but their executable behavior is not fully decoded here.
2. **Poison and rounding:** mixed item/skill poison merging, poison overwrite details, negative mana debit behavior for Magic Arrow/Double Swing, and exact target cold effectiveness/length rounding.
3. **Paladin spear/staff FHR:** the 5-frame threshold is printed as **129** in some legacy archives and **120** in others. Both are explicitly marked pending original animation-arithmetic verification. This exception is for equipped spear/staff mode, not every two-handed weapon.
4. **Necromancer vampire:** high-end recovery and separate block animations have partial legacy tables; the [d2.lc archive](https://d2.lc/BP/) has empty-cell alignment that was not independently resolved. Normal-form seven-class tables are complete.
5. **Source UI inaccuracies:** prerequisite synergies embedded in damage, Blizzard per-shard damage labelled DPS, skeletal mage damage bracket boundaries, rounded/occasionally mistyped mana/ranges. Engine records take precedence; mage-specific corrections appear in its skill section.
6. **Legacy behavior:** exact attack-speed sequences, legacy dual-wield/wereform handling, immunity dispatch and historical bugs require original-client tests. Do not silently adopt D2R fixes or claim data-table inspection fully validates the simulation.

For acceptance tests, compare original 1.14d at effective levels **1/8/9/16/17/20/22/23/28/29**, with all synergies separately at H0/H1/H20. Distinguish item-enabled H0 from legal hard-point builds. Measure hit timing in simulation frames and raw fixed-point HP deltas, not only character-screen numbers.

### Additional source index

Pinned numeric tables and their provenance are linked in §0; every tree links its Arreat Summit page. Common-mechanics references:

- [Arreat skill basics](http://classic.battle.net/diablo2exp/skills/basics.shtml) and [class basics and blocking](http://classic.battle.net/diablo2exp/basics/characters.shtml).
- [Legacy breakpoint archive](https://d2.lc/BP/) and [legacy LoD breakpoint guide](https://asgardpvp.com/guides/bp/).
- [Animation mathematics](https://www.theamazonbasin.com/wiki/index.php/Attack_speed).
- [Cold length reference](https://www.theamazonbasin.com/wiki/index.php/Cold_Damage) and [legacy poison calculation reference](https://www.purediablo.com/strategy/diablo-2-guide-calculating-poison-damage-v1-10). These were partly accessible through search snippets; unresolved mixed-source rules above are intentionally not asserted as fully verified.



