# Diablo II: Lord of Destruction — item/equipment research (legacy 1.14)

## Scope, provenance, and implementation status

Target: **original PC Diablo II + LoD, 1.14 legacy rules**, not Diablo II Resurrected (D2R), not non-expansion Diablo II, not PlugY/PD2/Rune Word Mod. Research only; no game implementation is supplied.

**Source hierarchy:** Arreat Summit for published legacy rules; extracted legacy text tables for exact numeric rows; reverse-engineering/community sources for engine behavior absent from the official site. The numeric appendices use the `fabd/diablo2` **1.13 extracted-data mirror**, commit `45112569deb9384738ccafe5c24ebbb71f41c7c9`, not a directly verified 1.14 MPQ. These are a well-matched legacy baseline, **not proof of binary-level 1.14 equivalence**. Some downloads used the mirror's cached `master` endpoint after pinned transport failures. Engineers should compare imported tables against legally obtained 1.14 game data before declaring 1:1 fidelity.

Data source directory: [legacy extraction](https://github.com/fabd/diablo2/tree/45112569deb9384738ccafe5c24ebbb71f41c7c9/code/d2_113_data). Raw pattern: `https://raw.githubusercontent.com/fabd/diablo2/45112569deb9384738ccafe5c24ebbb71f41c7c9/code/d2_113_data/<Table>.txt`. An accessible CDN alternative is `https://cdn.jsdelivr.net/gh/fabd/diablo2@45112569deb9384738ccafe5c24ebbb71f41c7c9/code/d2_113_data/<Table>.txt`.

**Rejected primary mirror:** `whipowill/d2-113c-txt` describes its files as original but its changelog makes gameplay fixes and enables Pattern/Plague. Do not mix those changed tables into this specification. No numeric appendix below uses that mirror's ancillary AutoMagic/Belts/Gamble files.

### Navigation

1. Equipment, storage, and dimensions
2. Quality, levels, affixes, ethereal, and durability
3. Base-item interpretation
4. Affix interpretation
5. Gems, runes, and sockets
6. Runewords
7. Unique and set interpretation
8. Cube and crafting
9. Consumables, gold, vendors, identification, gambling
10. Numeric appendices A–H: bases; type hierarchy; affixes; gems/runes; all runewords; all uniques; all sets; enabled Cube recipes
11. Verification gaps and sources

### Notation

`clvl` = character level; `mlvl` = monster level; `ilvl` = stored item generation level; `qlvl` = **base item's** quality level; `alvl` = affix eligibility level. Unique/set definition `lvl` is a different eligibility threshold, not base qlvl. `floor` applies to nonnegative quantities; `trunc` is integer truncation toward zero where signed intermediates matter. Legacy simulation is **25 frames/second**. Damage endpoints are inclusive; variable stat ranges are inclusive integer rolls unless a property specifies otherwise.

Appendices preserve the source property tuple `code(param;min;max)` beside decoded descriptions. Empty fields appear as `_`. A tuple's min/max can mean damage endpoints, chance/skill level, charges/skill level, or random stat bounds: **do not indiscriminately roll every min/max pair**. Property handlers are defined by `Properties.txt`, with stat representation in `ItemStatCost.txt`. Comment properties beginning `*` are not active bonuses and are omitted.

## 0.1 装备属性执行链审计（2026-11-17）

装备图鉴保留完整定义，不等于每个词缀能生效。执行必须贯通 `Properties → ItemStatCost → 来源／layer／激活条件 → 当前武器和技能 → 分通道战斗 → 事件／资源／状态`；目前扁平ItemMods并不足以承载套装条件、每级派生、聚气、触发和装备光环。

| 属性族 | 必须保留的语义及当前缺口 |
|---|---|
| Properties／ItemStatCost | funcs1…7的关联随机结果与副作用；statID、layer、value、source、activation；SaveBits／Encode不是伤害倍率 |
| 每级／百分比 | hp-perlevel的op参数3与AR-perlevel参数1不能统一除8；物品局部最大伤害与全局分开；百分比生命／法力不能乘全部最终桶 |
| 双倍伤害 | `deadly→item_deadlystrike`；skill9有效等级dm12；CS／支配／DS最多成功一次，排除未攻击副手，附加元素不翻倍 |
| 分通道／吸取 | 保留1⁄256；物抗后实际物理伤害且不超过目标可损生命才用于LL／ML；不含装备元素、毒、CB／OW，Life Tap独立 |
| CB | 命中事件、普通伤害前、当前HP比例；普通怪／Boss／玩家、近战／射击分别处理；正物抗减伤，负物抗不放大 |
| OW | 单一持续状态、200帧、归属与刷新；五段bits/frame，旧版汇编加数40；tick数／目标资格仍需1.14d对照 |
| 毒 | 最小／最大速率已是bits/frame，不再左移8；长度／源计数／技能覆盖分别保存；同物品词缀与镶嵌源归并有来源冲突，不套D2R结论 |
| 套装 | 不同部件而非装备件总数；add func0/1/2与Sets部分／全套分开；卸装、换组即撤销，不能重随机 |
| 触发／聚气／oskill | 同事件、技能、等级的概率合并；不同等级不简化取最高；固定触发／聚气不吃+skills；本职业oskill授予封顶+3，聚气不提供1.11后协同 |
| 装备光环 | 同持有者同装备光环等级相加，与原生同名光环不相加；owner、范围、状态、周期与佣兵重激活分开 |
| 时序 | IAS／FCR／FHR／FBR不同协议；武器速度／形态／技能序列／行动帧决定命中，统一cooldown不足以还原 |

首批独立样例：CS L1/2/3/20=16/25/32/68%；101伤害、75物抗=25.25点；100物理＋100火、LL10普通Drain100只吸10；目标剩3点不吸取超杀部分。大紫必须恢复70.5完整上限，小紫60.5上限恢复5420bits，不向整点取整。后续套装样例为Angelic Halo＋Wings、clvl20→AR240，两枚Halo不算两种部件；Sigon两件的LL与手套IAS卸装正确撤销。

版本证据：官方规则与经典FAQ可支持普通效果原则；D2MOO重建明确基于1.10f，函数注释的1.14d地址不证明语义实测一致，未固定master提交的重建只能作候选。项目本地运行提交是 `0edfaf6d006f2eb82857c066e07ce03614285981`，不是所有历史研究引用提交；本轮未在线核验提交历史，也未完成合法1.14d客户端比对。负数舍入、随机端点、经典ED＋min/max珠宝异常、毒源归并、OW刷新与事件先后仍明确待验。

资料：[官方特殊效果](https://classic.battle.net/diablo2exp/items/magic.shtml)、[CS／DS](https://www.mannm.org/d2library/faqtoids/cs_eng.html)、[生命与吸取](https://www.mannm.org/d2library/faqtoids/leben_eng.html)、[经典元素毒伤](https://www.mannm.org/d2library/faqtoids/eledam_eng.html)、[1.11b OW讨论](https://d2mods.info/forum/viewtopic.php?p=318933#318933)、[触发](https://www.mannm.org/d2library/faqtoids/ctc_eng.html)、[跨职业／聚气／光环](https://www.mannm.org/d2library/faqtoids/oskills_eng.html)。仅研究文字与自有规则实现，不复制原版程序或素材。

## 0.2 本职业技能、技能树与火焰技能修正（2026-11-17）

- 固定运行表的 `skill → item_singleskill`（func 22）是本职业授予，不是 oskill。零硬点可以由本职业单技能装备解锁；其他职业不能凭该属性施放或获得暖气回复。`allskills`、职业、技能树、火焰加成只提高已学习或已被本职业单技能装备授予的技能，不独立解锁。
- `skilltab → item_addskill_tab`（func 10）参数 0…20，按 ama、sor、nec、pal、bar、dru、ass 每职业三页编码；参数缺省为 0。运行保存键为 `skillTab:<职业>:<0基页码>`；21 种实际超大型护符前缀均验证映射及中文详情，技能树加成仍不能替代前置硬点。
- `fireskill → item_elemskill`（func 21，val 1）按 Skills.EType=`fire` 生效，不限法师。暖气、火焰支配的 EType 也是 fire；该等级处理不代表所有相关技能行为已实现。Leaf 的 +3 火焰技能可以提高刺客已经学习的火焰爆震，却不能给刺客授予 Leaf 的法师专属火弹／暖气／地狱之火。
- 装备也需人物达到当前需求等级才激活；接口允许对已装备底材镶嵌，若材料提高需求等级到人物等级以上，装备立即不贡献技能／属性，达到门槛后重新生效。护符需已鉴定、人物达到需求等级并位于背包才贡献属性；仓库、方块不贡献。生成技能树超大型护符的门槛为原始前缀 levelreq=42，不等同物品 ilvl 或词缀 alvl。
- 实际两孔短棍 Tir→Ral 制作 Leaf：无固有火弹的法师得到火弹 L6、暖气 L6（90%）；原有 +1 火弹的短棍得到火弹 L7。若暖气有 1 硬点则 L7（102%），装备软点不算火弹的火球协同。Leaf 的 `ac/lvl` 仍未实现；这不是所有 Leaf 属性或所有 Properties 完整还原。
- 不重新随机或静默重建历史存档物品。早先已保存为 `unsupported:fireskill`／`unsupported:skilltab` 的属性仍保留原记录，本批生成／制作的物品才写入新生效键；旧物品的全量重建仍待处理。角色 ID、装备 UID、符文顺序和硬点不由本次更新修改。

证据：[官方技能加成／协同规则](https://classic.battle.net/diablo2exp/skills/basics.shtml)、[官方 Leaf](https://classic.battle.net/diablo2exp/items/runewords-original.shtml)、[经典 Skills 字段指南 EType](https://d2mods.info/forum/kb/viewarticle?a=440)、[官方护符容器规则](https://classic.battle.net/diablo2exp/items/charms.shtml)，以及固定运行提交中的 Properties、ItemStatCost、Runes、MagicPrefix、Skills、SkillDesc。字段指南及官方网页不是合法 1.14d 客户端实测，不能据此宣称执行全面等价。

## 1. Equipment, storage, and dimensions

| Location | Legacy LoD rule |
|---|---|
| Head | One helm/circlet; class-specific Barbarian helm or Druid pelt requires its class |
| Neck | One amulet |
| Body | One body armor |
| Hands, set I | Right-hand weapon and left-hand weapon/shield/quiver as allowed |
| Hands, set II | Independent alternate pair; default `W` switches active pair |
| Gloves / belt / boots | One of each |
| Rings | Two independent ring slots |
| Inventory | **10 columns × 4 rows = 40 cells** |
| Personal stash | **6 × 8 = 48 cells** in LoD; non-expansion 6 × 4 is not the target; no shared tabs |
| Horadric Cube | Internal **3 × 4 = 12 cells**; the Cube itself occupies **2 × 2** inventory cells |
| Belt | Four columns; 1–4 rows depending on base |

Only the active hand pair contributes ordinary equipped bonuses. Switching away does not undo already applied timed buffs such as Battle Orders. A two-handed weapon occupies both hands logically; a bow/crossbow can use the appropriate quiver. Barbarians may wield two weapons and may use two-handed swords one-handed with their separate 1H damage values. Assassins may dual-wield claws, not arbitrary weapons. A shield may be paired with a one-handed weapon; strength/dexterity/class/level requirements must all be satisfied. Mercenary equipment availability is hireling-type-specific, not the full player paper doll.

| Belt base | Rows | Total potion/scroll cells |
|---|---:|---:|
| No belt | 1 | 4 |
| Sash, Light Belt | 2 | 8 |
| Belt, Heavy Belt | 3 | 12 |
| Plated Belt | 4 | 16 |
| Every exceptional or elite belt | 4 | 16 |

A belt cell holds one drinkable potion or usable scroll, not a stack of 16 potions. Consuming the bottom slot shifts the column down. Matching pickups fill available positions above the bottom matching item; otherwise they go to inventory. Removing a larger belt displaces excess contents to inventory/ground as space allows; do not silently delete them.

| Other base | Width × height | Stack/capacity |
|---|---|---|
| Ring, amulet, jewel, gem, rune, drinkable potion, loose scroll, key | 1 × 1 | Keys 12; other listed items do not stack, except scrolls inside tomes |
| Town Portal / Identify tome | 1 × 2 | 20 matching scrolls |
| Small / Large / Grand Charm | 1 × 1 / 1 × 2 / 1 × 3 | No stacking; active only in carried inventory, not stash or Cube |
| Arrow / bolt quiver | 1 × 3 | 350 arrows / 250 bolts |
| Horadric Cube | 2 × 2 | Internal 3 × 4 |

**Per-equipment-base dimensions, all tiers, are in Appendix A.** Do not infer dimensions only from item category: axes, shields, swords, staves and other categories contain multiple footprints. Items cannot rotate.

Sources: [basics](https://classic.battle.net/diablo2exp/basics/), `Inventory.txt`, `Weapons.txt`, `Armor.txt`, `Misc.txt`.

## 2. Item quality, levels, affixes, ethereal, durability

### 2.1 Quality versus independent flags

| Quality | Color | Properties |
|---|---|---|
| Low | White | Cracked/Crude/Damaged/Low Quality; reduced base damage/defense and durability |
| Normal | White; gray if ethereal/socketed | No random magic affixes; may retain staffmods/automods |
| Superior | White; gray if ethereal/socketed | Limited enhanced base stats, not a magic affix item |
| Magic | Blue | At most one prefix + one suffix |
| Rare | Yellow | At most three prefixes + three suffixes, group restrictions |
| Set | Green | Named set piece with fixed/variable piece and conditional set properties |
| Unique | Gold | Named unique definition; variable rolls are still possible |
| Crafted | Orange | Recipe-fixed properties plus up to four rare-eligible random affixes |

Ethereal and socketed are flags, **not additional quality tiers**. A runeword is a socketed normal/superior base plus rune-word properties, not magic quality. Quality is not an absolute power ordering: some magic affixes are unavailable to rares.

Low-quality weapon damage / armor defense: `floor(normal × 0.75)`; weapon minimum damage at least 1. Low-quality durability: `floor((normalDurability − 1)/3)`. Low quality does not naturally roll sockets or ethereal; Larzuk may socket it.

Superior armor: Enhanced Defense **5–15%**, maximum durability **+10–15%**, either or both. Superior weapon: Enhanced Damage **5–15%**, Attack Rating **+1–3**, maximum durability **+10–15%**; one or any two, not all three. When percentage ED cannot add even one damage point, the displayed superior damage bonus becomes +1 maximum damage. Superior bonuses do not occupy magic-affix slots.

### 2.2 Item level

Monster drops normally store `ilvl = mlvl`.

| Monster/source | Level rule |
|---|---|
| Normal difficulty ordinary monster | Its Normal `MonStats.txt` level; do not replace it universally with area level |
| Nightmare/Hell ordinary monster | Generally area level |
| Champion | Generally ordinary level +2 |
| Random unique and its minions | Generally ordinary level +3 |
| Superunique / act boss | Use its actual engine monster level; fixed-level bosses and special monsters are exceptions to blanket area-level arithmetic |
| Vendor equipment | Generally `clvl+5`; Normal act caps commonly 12/20/28/36/45; quest/vendor exceptional cases require runtime verification |
| Gambling | Uniform `clvl−5` through `clvl+4`, minimum 5, maximum 99 |
| Charsi imbue | `ilvl = min(99,clvl+4)`; input ilvl does not drive the new rare's affixes |
| Craft | `floor(clvl/2)+floor(inputIlvl/2)` |
| Cube reroll | Recipe-specific; see §8 |

Treasure class eligibility can upgrade with monster level but MF never changes the base-selection treasure class. Chests/racks have their own source-level rules; monster-derived ilvl is not a universal formula for every source.

### 2.3 Quality roll formula

Source: [Item Generation Tutorial / ItemRatio mechanics](https://d2mods.info/forum/viewtopic.php?t=30222), `ItemRatio.txt`, `TreasureClassEx.txt`.

Choose the LoD (`Version=1`) ItemRatio row by ordinary/class-specific and normal/exceptional-or-elite base. For an ordinary monster drop, quality attempts are **Unique → Set → Rare → Magic → Superior → Normal → Low**. These are conditional attempts, not independent fixed tier percentages.

For a quality `Q` among unique/set/rare/magic:

```text
D0 = (BaseChanceQ − trunc((ilvl − baseQlvl)/DivisorQ)) × 128

EMF(magic) = MF
EMF(unique) = floor(250×MF/(250+MF))  when MF > 10
EMF(set)    = floor(500×MF/(500+MF))  when MF > 10
EMF(rare)   = floor(600×MF/(600+MF))  when MF > 10
For MF <= 10, the reverse-engineering source specifies EMF = MF.

D1 = trunc(D0 × 100/(100+EMF))
D2 = max(D1, QualityMinQ)
D3 = D2 − trunc(D2 × TCQualityFactorQ/1024)

Roll integer R uniformly in [0,D3−1]; quality succeeds if R < 128.
For positive D3: P(success | earlier failures) = min(1,128/D3).
```

The TreasureClassEx quality factor is the **maximum factor encountered along the selected nested TC path**, not a sum. A factor of 1024 forces that quality check. Success still requires a legal unique/set definition; the quality check alone does not select a particular named item. Superior/normal use their base/divisor checks without MF, minimum or TC quality-factor adjustments. Nonpositive-denominator and RNG boundary behavior needs engine testing; do not call a negative denominator a negative probability.

| LoD ItemRatio row | Unique base/div/min | Set base/div/min | Rare base/div/min | Magic base/div/min | Superior base/div | Normal base/div |
|---|---|---|---|---|---|---|
| Ordinary normal | 400/1/6400 | 160/2/5600 | 100/2/3200 | 34/3/192 | 12/8 | 2/2 |
| Ordinary exceptional/elite | 400/1/6400 | 160/2/5600 | 100/2/3200 | 34/3/192 | 12/8 | 1/1 |
| Class-specific normal | 240/3/6400 | 120/3/5600 | 80/3/3200 | 17/6/192 | 9/8 | 2/2 |
| Class-specific exceptional/elite | 240/3/6400 | 120/3/5600 | 80/3/3200 | 17/6/192 | 9/8 | 1/1 |

Example: ordinary normal base qlvl=50, ilvl=85, MF=200, no TC quality factor. Unique D0=(400−35)×128=46720; EMF=111; D1=22142; D2=22142; success=128/22142 ≈0.5781%, conditional on reaching the check. This is not the overall chance of a particular unique from the monster.

Unique eligibility additionally depends on definition level, enabled flag, base match and game mode. Original offline single-player allows ladder-tagged uniques; a `ladder=1` unique is not excluded the way a `server=1` runeword is. The current pinned runtime has 383 eligible level≤99 unique candidates, including all 29 ladder-tagged rows; Annihilus and Hellfire Torch remain event definitions with no implemented offline event entry. Weighted selection uses definition rarity. Normally a given unique can only be generated once per game, unless its `nolimit` behavior allows otherwise; this does not forbid equipping two copies obtained in different games. Failed unique generation yields a rare with **3× normal durability**; failed set yields magic with **2× normal durability**. Ethereal failed unique durability is `floor(3×normalDur/2)+1`; ethereal failed set is `normalDur+1`. Durability cannot exceed 333. Indestructible/quantity bases do not gain meaningful durability this way.

MF diminishing returns example at MF=300: unique EMF=136; set=187; rare=200; magic=300. MF does not improve rune-drop/base-item odds and does not affect gambling quality.

### 2.4 Affix level, eligibility, and counts

General item-generation formula; do **not** substitute the outdated official magic-page shorthand `affix level <= ilvl+2`:

```text
I = max(min(storedIlvl,99), baseQlvl)    // temporary; does not rewrite stored ilvl
if magic_lvl > 0:
    alvl = min(99,I + magic_lvl)
else if I < 99 − floor(baseQlvl/2):
    alvl = I − floor(baseQlvl/2)
else:
    alvl = 2×I − 99
alvl = min(99,alvl)
```

Eligibility: active LoD affix; spawnable; positive frequency; minimum affix level ≤ alvl; any nonzero maximum level respected; allowed type and inherited type match; excluded type does not match; class restrictions respected; rare/crafted require `rare=1`; already used affix group excluded. Choose eligible rows by **frequency weight**, not uniformly by name. Same displayed affix name may have multiple levels, item types, ranges and rare eligibility: preserve separate rows. Group exclusions apply across prefix/suffix/automagic definitions; never deduplicate solely by displayed name.

| Quality | Affix count |
|---|---|
| Magic | Prefix only 25%; suffix only 50%; both 25%; max 1+1 |
| Rare equipment | Target 3–6, max 3 prefixes +3 suffixes; fewer can result if eligible groups are exhausted |
| Rare jewel | Max **4** affixes, still no more than 3 of either side |
| Crafted ilvl 1–30 | 1 random affix 40%; 2/3/4 each 20% |
| Crafted ilvl 31–50 | 2 random affixes 60%; 3/4 each 20% |
| Crafted ilvl 51–70 | 3 random affixes 80%; 4 at 20% |
| Crafted ilvl 71+ | Four random affixes guaranteed |

Rare count sources conflict: Arreat Summit says 2–6; legacy reverse-engineering reports an array `3,4,4,5,5,6` but explicitly says “IIRC”. That would imply 1/6,2/6,2/6,1/6 if sampled uniformly, **not a verified 1.14 probability specification**. Max 3+3 and rare-jewel max4 are the safe constraints; verify rare count RNG before implementing an exact distribution.

Required level ordinarily takes the maximum of base level requirement, affix requirements, staffmod requirements and inserted gem/rune/jewel requirements; class-specific exceptions and upgrades can add requirements. Crafted: `min(99,max(baseRequiredLevel, highestRandomAffixRequiredLevel +10 +3×numberOfRandomAffixes))`, with socketed content/staffmods considered separately. The recipe's rune is consumed, **not inserted**, and does not impose its rune required level on the craft. A four-affix craft with a highest affix req89 requires99. A high-ilvl craft is not automatically high-required-level if it rolls low-level affixes.

Circlet/Coronet/Tiara/Diadem magic levels are 3/8/13/18; Diadem qlvl85 means even ilvl1 uses effective I85 and reaches alvl99. See Appendix A for each base's exact `magic lvl`.

### 2.5 Staffmods and automods

Staffmods are innate individual-skill bonuses separate from random magic affixes. Applicable rods, Sorceress orbs, Necromancer heads, Barbarian helms, Druid pelts, and higher claw bases can have up to three individual skills, +1–3 each. `ItemTypes.StaffMods` and the `h2h`/`h2h2` distinction matter: not every claw base can spawn staffmods. Native skill bonuses remain class-only unless the definition is explicitly `oskill`. Normal/superior staffmods survive creation of a runeword.

Paladin shield automods: all resistance families **5–10 / 11–20 / 21–30 / 31–40 / 41–45**, or enhanced damage/AR families **10–20%/+15–30; 21–30%/+31–60; 31–40%/+61–80; 41–50%/+81–100; 51–65%/+101–121**. Amazon bow/spear/javelin automods provide +1–3 to the appropriate skill tab. Orbs have innate life/mana families. Complete automod probabilities, exact level bands, staffmod tier selection/retry restrictions and imbue staffmod boosts are **not recovered here**; do not replace them with generic uniformly chosen +skills. They require a pristine AutoMagic table plus engine validation.

### 2.6 Ethereal and durability

Natural ethereal chance is generally **5%** on eligible dropped equipment, independent of MF. Set items do not naturally spawn ethereal; inherently indestructible bases and bows/crossbows are excluded. Forced unique ethereal/indestructible properties override natural eligibility. Crafted items do not normally retain an ethereal input flag.

| Property | Ethereal rule |
|---|---|
| Weapon base damage | `floor(baseDamage × 3/2)`, before item Enhanced Damage |
| Armor base defense | `floor(baseDefense × 3/2)` |
| Strength requirement | −10, minimum0 |
| Weapon dexterity requirement | −10, minimum0 |
| Maximum durability | `floor(normalMaxDur/2)+1` |
| Repair | NPC/Cube cannot repair it; self-repair/replenish modifiers can operate; Zod can make it indestructible |
| Hirelings | Their equipped items do not lose durability |
| Vendor sale | Ethereal sold items disappear from stock; broken ethereal sells for1 gold |
| Imbue | Retains ethereal; does not convert nonethereal to ethereal |

Armor generated with intrinsic percentage Enhanced Defense uses **maximum base defense +1**, not a randomly rolled base defense. Nonethereal: `floor((maxBaseDefense+1)×(100+ED)/100)`. Ethereal: `floor(floor((maxBaseDefense+1)×3/2)×(100+ED)/100)`. Added flat defense comes afterward. This is not a license to re-max defense every time a rune/socket bonus is applied; upgraded armor re-rolls the new base defense rather than always applying max+1. Keep generation and subsequent modification paths distinct.

Legacy Cube socketing of eligible ethereal normal armor/helm/shield applies the ethereal defense multiplier a **second** time: `floor(floor(rolledBaseDefense×1.5)×1.5)` before other applicable defense additions. This “ebug” is part of the target and was removed in D2R. Larzuk does not apply it; weapons do not receive a second damage multiplier.

Durability loss: successful melee attacks have approximately **4%** chance to cost1 weapon durability; successful incoming melee hits have **10%** chance to cost1 equipped armor durability. Armor-selection weights with all slots present: body30%, head20%, shield20%, gloves10%, belt10%, boots10%; absent slots change the available selection. Ranged ammunition/throwing quantity is separate. Exact skill-specific wear, blocked-hit behavior, ethereal loss counters and renormalization need engine verification. At0 durability the item is broken and its equipped benefits do not function; indestructible items do not wear out. Maximum displayed durability cap333.

NPC repair can include skill charges. Partial repair is only for an unbroken item and uses carried gold; a broken item needs full repair. Cube Ort/Ral repair excludes ethereal (see §8). Replenish durability/quantity raw coefficient `p` means **one unit per `100/p` seconds**, not one unit every p seconds; e.g. Exile p25 repairs one durability per4s.

Ground cleanup timers: mundane equipment/runewords, consumables/ammunition/keys, Pandemonium keys/organs, essences/token approximately10min; magic/gems/runes20min; rare/set/unique/crafted30min. Picking up and dropping resets the timer. These are ground-item cleanup timers, not stash expiration.

Sources: [item basics](https://classic.battle.net/diablo2exp/items/basics.shtml), [legacy durability discussion](https://forums.d2jsp.org/topic.php?t=73913012&f=87), [rare count discussion](https://d2mods.info/forum/viewtopic.php?t=43793).

## 3. Base-item interpretation

Appendix A contains every spawnable equipment base in the legacy extraction, all normal/exceptional/elite tiers, plus six throwing-potion bases and the four circlet variants. It preserves codes and all three-tier mappings.

- Weapon columns distinguish 1H melee, 2H and thrown damage; throwing potions' actual elemental effects are in §9. Zero/blank unused damage modes are not a valid alternate attack.
- `speed` is the weapon speed modifier (WSM), **not IAS percent**; negative is faster. Translate into class/animation/skill breakpoints, not a universal attacks/second formula.
- `rangeadder+1` is nominal melee reach, not an automatic distance in yards. Strength/dexterity damage factors (`StrBonus`,`DexBonus`) are percentages used by weapon damage rules, not equipment requirements.
- Armor `speed` is the movement/stamina weight penalty field (normally0/5/10), not weapon WSM. Heavy body armor and shields can both affect movement. No universal “all armor slows5%”.
- Shield `block` is the base contribution, not the character's final block chance; class block bonuses and dexterity/level formula apply. Shield Smite and boot kick damage use their own columns. For generic shields, class base offsets are Paladin30, Amazon/Assassin/Barbarian25, Druid/Necromancer/Sorceress20 before increased blocking and dexterity scaling; class-specific Paladin shields use the same Paladin calculation.
- Zero `gemsockets` means unsocketable even if category wording sounds compatible. Socket count depends on base and ItemTypes ilvl cap (§5).
- Phase Blade has no durability and is naturally nonethereal. Upgrading an existing ethereal Dimensional Blade unique/rare into a Phase Blade can retain ethereal and yields a no-durability result.
- Staff/wand/scepter blunt damage carries innate **+50% damage to undead**, also clubs/maces/hammers as defined by the type hierarchy. This innate property is additional to named-item properties such as +200% damage to undead.
- A base qlvl does not by itself give a drop probability. Use treasure classes, area levels and source eligibility in the drop-system specification.

## 4. Magic prefix/suffix interpretation

Appendix C contains **all active positive-frequency LoD prefix/suffix rows** retained by the extraction, including weapons, armor, jewelry, jewels and charms. Main ED/defense/resistance/resource/attribute/caster/speed/MF/GF/leech/+skill families are therefore covered without omitting alternate item-type variants.

| Representative affix | Alvl | Required level | Group | Effect / eligibility |
|---|---:|---:|---:|---|
| Cruel, magic row | 51 | 43 | 105 | 201–300% ED; weapons excluding staff/wand/orb; not rare-eligible |
| Cruel, rare-enabled row | 56 | 48 | 105 | Same ED; lower frequency1 instead of5 |
| Godly, magic row | 45 | 38 | 101 | 101–200% Enhanced Defense; armor; not rare-eligible |
| Godly, rare-enabled row | 50 | 43 | 101 | Same defense, frequency1 instead of3 |
| Jeweler's | 55 | 47 | 122 | Four sockets, capped by base/type; weapons/shields/helms/body, throwing excluded; magic only |
| of the Apprentice | 5 | 3 | 9 | 10% FCR; rods/rings/amulets/orbs/circlets |

Type codes are not user-facing labels. Appendix B includes Equiv1/Equiv2 inheritance; use recursive membership. Examples: `armo` includes many worn armor categories; `tors` only body armor; `shld` is broad shields while `shie` is ordinary shields; `mace` is narrower than `blun`; `rod` is staff/wand/scepter, **not orb**. Class-only skills/skill-tab properties must not grant oskills to other classes.

Leech is percentage of qualifying physical attack damage, not spell/elemental damage; Nightmare/Hell effectiveness penalties and target drain effectiveness apply. Faster cast/hit recovery/block/attack/run-walk are distinct stats with animation breakpoints. Flat DR, percentage physical DR, MDR, resistances, absorb and maximum resistance are distinct layers; do not merge them into one defense value. Replenish Life `p` restores `25×p/256` HP/s; “+20” is not20HP/s.

## 5. Gems, runes, sockets

Appendix D contains all **35 gems** (Amethyst, Diamond, Emerald, Ruby, Sapphire, Topaz, Skull × Chipped/Flawed/Normal/Flawless/Perfect) and all **33 runes**, with required levels and three effect contexts. Body armor and helms use `helmMod`; shields use `shieldMod`; weapons use `weaponMod`. Rune effects are not the same in each location. Jewels apply their own rolled affixes.

Poison data is rate in **1/256 damage per frame**, plus length in frames. The approximate displayed total `rate×length/256` is not a new independent damage stat. Preserve raw rate/length through stacking and rounding; multiple poison sources require the poison engine's aggregation rules, not merely sum of displayed totals. Cold lengths are frames and can be modified by target/difficulty rules.

### 5.0 Compact gem matrix (all35)

Every sequence is **Chipped /Flawed /Normal /Flawless /Perfect**, required levels **1/5/12/15/18**. Each sequence contains five distinct gem definitions, not a variable roll. Appendix D retains exact component tuples.

| Gem | Weapon | Body/helm | Shield |
|---|---|---|---|
| Amethyst |AR40/60/80/100/150|Str3/4/6/8/10|Defense8/12/18/24/30|
| Sapphire |Cold1–3/3–5/4–7/6–10/10–14;length25/35/50/60/75frames|Mana10/17/24/31/38|ColdRes12/16/22/28/40%|
| Emerald |Approximately10/20/40/60/100poison;rate34/51/82/101/143per256perframe;length75/100/125/152/179frames|Dex3/4/6/8/10|PoisonRes12/16/22/28/40%|
| Ruby |Fire3–4/5–8/8–12/10–16/15–20|Life10/17/24/31/38|FireRes12/16/22/28/40%|
| Diamond |DamageUndead28/34/44/54/68%|AR20/40/60/80/100|AllRes6/8/11/14/19|
| Topaz |Lightning1–8/1–14/1–22/1–30/1–40|MF9/13/16/20/24%|LightningRes12/16/22/28/40%|
| Skull |LL2/2/3/3/4%;ML1/2/2/3/3%|ReplenishLife2/3/3/4/5;manaRegen8/8/12/12/19%|AttackerDamage4/8/12/16/20|

Emerald published durations often round to3/4/5/6/7seconds. Raw legacy lengths are3/4/5/**6.08/7.16**seconds; preserve152/179frames instead of replacing them with150/175. Poison tooltips round nominal damage; do not initialize a separate100damage stat from the Perfect Emerald summary.

### 5.1 Socket maximum

```text
Sbase = base.gemsockets
Stype = ItemTypes.MaxSock1  for ilvl 1–25
      = ItemTypes.MaxSock25 for ilvl 26–40
      = ItemTypes.MaxSock40 for ilvl 41+
Sallowed = min(Sbase,Stype)
```

The awkward MaxSock25/40 names designate their bands as above. Appendix A gives the final three band caps for each base; Appendix B gives original ItemTypes values. Global conventional maxima: weapons6, body armor4, helm3, shield4. Throwing weapons, gloves, boots, belts, rings and amulets cannot acquire functional sockets.

Naturally dropped socket counts additionally have difficulty caps Normal3/Nightmare4/Hell6. These caps do **not** apply to Larzuk/Cube in the same manner. A Normal Cow Crystal Sword ilvl28 can receive four Larzuk sockets even though natural Normal drops cannot have four; an ilvl41+ Crystal Sword receives six, not four.

| Socket operation | Result |
|---|---|
| Larzuk low/normal/superior unsocketed | Exactly Sallowed; quest difficulty irrelevant; ethereal allowed |
| Larzuk magic unsocketed | Random1–2, 50/50 if both allowed; cap by Sallowed |
| Larzuk rare/set/unique/crafted unsocketed | One |
| Already socketed | Cannot add sockets with Larzuk |
| Magic Mechanic's / Artisan's / Jeweler's | Affix sockets; capped by base/type; do not add Larzuk sockets afterward |
| Rare Mechanic's | Up to two, subject to caps |
| Intrinsic unique/set sockets | Definition-controlled; e.g. Griswold's Redemption3–4; do not apply a blanket rare/set/unique max1 to intrinsic sockets |
| Cube normal equipment socket recipe | Roll U uniformly1–6, then `sockets=min(U,Sallowed)` |

Cube probabilities: max4 →1/2/3 each1/6,4 at3/6; max3 →1/2 each1/6,3 at4/6; max2 →1 at1/6,2 at5/6. **All four categories roll1–6**, notwithstanding erroneous official text describing1–4/1–3 rolls. Cube normal socket recipes reject superior and low-quality bases; Larzuk accepts them.

Socket contents can increase required level. Hel + Town Portal scroll removes contents, **destroys** gems/runes/jewels, leaves sockets and original base properties intact, removes runeword activation. There is no extraction recipe returning inserted runes.

Sources: [socketed items](https://classic.battle.net/diablo2exp/items/socketeditems.shtml), [Larzuk quest reward](https://classic.battle.net/diablo2exp/quests/rewards.shtml), [Cube roll correction](https://diablo2.diablowiki.net/Horadric_Cube_Recipes).

## 6. Runewords

**78 active legacy words:** 24 original, 47 1.10-era, seven 1.11 class-themed body armors; all remain active in1.14. Appendix E gives every word, exact ordered runes, permitted/excluded ItemTypes, creation flag, minimum rune level, **all runeword-added stats and all context-specific rune stats**. Those two labeled components together are the complete magical stat specification; rune contributions are already included as a separate component, not missing and not to be added a second time. Base/superior/staffmod/automod properties are separate.

Requirements: nonmagic white/gray normal/superior base; ethereal allowed; exact number of sockets; exact rune order; all sockets filled; accepted base type. Magic/rare/crafted/set/unique never form a word. A failed attempt remains an item containing those runes; there is no automatic refund. The name's required level is at least the highest rune requirement and the base/staffmod requirement.

**23 server/ladder-only words:** Brand, Death, Destruction, Dragon, Dream, Edge, Faith, Fortitude, Grief, Harmony, Ice, Infinity, Insight, Last Wish, Lawbringer, Oath, Obedience, Phoenix, Pride, Rift, Spirit, Voice of Reason, Wrath. In unmodified legacy LoD, they cannot be created in single-player/Open/nonladder. Ladder-created items may transfer to nonladder on reset and remain usable. Cube recipes' `ladder` flags behave differently (§8). Enabling these words for browser offline play is an explicit compatibility deviation, not vanilla1.14.

**Seven1.11 words:** Bone, Enlightenment, Myth, Peace, Principle, Rain, Treachery. They are not creation-limited to the class receiving the +skills; any class can equip a qualifying body armor.

Key base traps: Insight permits legacy **polearms/staves**, not spears/bows/crossbows; Infinity/Pride/Obedience legacy **polearms**, not spears. Heart of the Oak permits staves and the narrow mace family (Mace/Morning Star/Flail and upgrades), not all blunt weapons; a staff can be four-socket but an orb is not a staff. Leaf/Memory likewise require staves, not orbs. Scepters are not the narrow mace family. Assassin claws do not mean arbitrary swords. Pattern and Plague are inactive in legacy1.14; Mosaic and later D2R words are absent.

Oskills normally grant use to other classes. If an oskill belongs to the wearer's native class, that oskill bonus is capped at+3; e.g. Barbarian Call to Arms cannot grant the full +6 Battle Orders roll as a native oskill bonus. Equipped aura skill levels, triggers, skill charges and oskills are different property handlers. Same aura from multiple equipped sources can combine under aura rules; do not infer behavior just by concatenating text.

Combined-stat sanity checks (before base innate stats): Spirit sword gets7%LL,1–50 lightning,3–14 cold over3s,+75 poison over5s plus word bonuses; Spirit shield gets cold/lightning/poison resist35 each, attacker damage14, **no fire resist**. Fortitude body gets DR7,+15def,+5maxlightres,ReplenishLife7; weapon gets+9minDamage,+50AR,+1lightRadius,+20%DS,+25%flee; both get the common word200%EDef/300%ED/25FCR/ChillingArmor/DTM/life/resists. Enigma includes8%DR and5%maxLife from Ber/Jah, not just the seven Runes.txt properties.

Sources: [original words](https://classic.battle.net/diablo2exp/items/runewords-original.shtml), [1.10](https://classic.battle.net/diablo2exp/items/runewords-110.shtml), [1.11](https://classic.battle.net/diablo2exp/items/runewords-111.shtml).

## 7. Unique/set item interpretation

Appendix F catalogs **every enabled unique definition** with name, base, definition level, required level, rarity, ladder/carry-one flags and **all active properties**, exceeding the requested40 iconic full specifications. Appendix G catalogs **every set and piece** and all baseline, per-piece conditional, global partial and global full properties, including the ten requested sets: Tal Rasha, Immortal King, Sigon, Angelic, Cleglaw, Arctic, Isenhart, Natalya, Trang-Oul, Griswold.

Defense, damage, requirements, footprint, speed, durability and base sockets come from Appendix A; named-item properties then modify them. A Unique/SetItems required level may override the lower base level, but cannot safely replace a higher requirement introduced by an upgrade/socket. Rarity is a weighting among eligible definitions of the same base, not a monster's drop probability.

Disabled/unimplemented rows (Constricting Ring, Merman's Speed, placeholders, old Crystal Sword Azurewrath, etc.) are excluded. Enabled Phase Blade Azurewrath is included. Internal names have misspellings: The Oculus appears as `The Occulus`, Griswold's Redemption as `Griswolds's Redemption`, Death's Fathom as `Deaths's Fathom`, etc.; stable row/code keys are retained alongside corrected display names where known. No D2R-only unique/set changes are imported.

Annihilus: +1allskills,+10–20allattributes,+10–20allres,+5–10%experience. Hellfire Torch: **+3 to one randomly selected class**, not+0–6skills; +10–20attributes/allres,+8lightRadius,5%castlevel10DiabloFirestorm onstriking,level30Hydra10charges. Legacy1.13/1.14 Torch trigger is5%, not the older25%. Gheed's Fortune:80–160%GF,20–40%MF,10–15%vendorreduction. Each has carry-one restrictions; ordinary inventory charm activation applies. Vanilla single-player does not have official Battle.net DClone/Pandemonium event access even though definitions exist in client data.

Ormus' Robes +3 random Sorceress skill uses ids36–60 (excludes level30skills); do not randomly choose any skill in the whole game. Rainbow Facet definitions differ by element and death versus level-up trigger; duplicate names in the catalog are intentionally separate rows.

### Set application without double counting

- Baseline `prop1..9` always belongs to the piece.
- For `add func=2`, per-piece `aprop1..5` activates at2/3/4/5/6 **distinct set pieces** respectively, and earlier thresholds remain active.
- Global `PCode2..5` rows are separately accumulated at their thresholds. `FCode1..8` adds only on full completion. Both per-piece and global bonuses apply.
- Official full-set summary text often repeats already active partial bonuses. Appendix G lists **incremental** bonuses; do not add the summary total on top.
- `add func=1` is the older companion-bitmask scheme, not the generic count mapping. Civerb's Ward requires explicit handling: +21–22mana with Civerb's Icon, **poisonres25–26%** with Civerb's Cudgel. With blank/0 `add func`, auxiliary properties are unconditional: Civerb's Cudgel's +1maxdamage/level and Trang-Oul's Claws' +25%poison skill damage belong to their baseline.
- Equipping two Angelic Halo rings does not count as two different pieces, but each ring receives its own active per-piece AR bonus when the set requirement is met. Count unique piece definitions for completion.
- Trang-Oul's complete set vampire morph changes the casting animation/breakpoints; do not retain ordinary Necromancer FCR behavior while only changing artwork.

Tal Rasha check: globals2piecesReplenishLife10;3piecesMF65;4piecesFHR25. Full **additional** +3Sorc,+150life,+50allres,+50defMissile,+150def,aura. Orb conditional2pieces+1Sorc;3pieces−15enemyFireRes;4pieces−15enemyLightningRes;5pieces+15%ColdSkillDamage. Body/belt/amulet conditional FCR is10 each at2/3/4 pieces respectively. Full set totals preserve the partial globals and piece thresholds.

Trang check: globals2pieces+18FireBall and15%manaRegen;3pieces+13FireWall andanother15%;4pieces+10Meteor andanother15%;fulladditional+3Nec,20%LL,+3FireMastery,+200def,+100mana,another15%manaRegen,allres50,vampirestate. Thus total mana regeneration from globals is60%, not15%. Skills are oskills; all partial bonuses remain active.

Sources: [sets index](https://classic.battle.net/diablo2exp/items/sets/), [Tal Rasha/Trang and expansion sets](https://classic.battle.net/diablo2exp/items/sets/sets7.shtml), [uniques index](https://classic.battle.net/diablo2exp/items/uniques.shtml), `UniqueItems.txt`, `SetItems.txt`, `Sets.txt`.

## 8. Horadric Cube and crafting

Appendix H includes the full enabled CubeMain recipe catalog, including all36 Hit Power/Blood/Caster/Safety recipes and all gem/rune upgrades. Original encoded inputs/outputs, level coefficients, restrictions and fixed-property tuples are preserved. The notes below explain the important runtime semantics missing from descriptions.

### 8.1 Socket, repair, unsocket recipes

| Input (plus unsocketed normal-quality equipment where specified) | Output |
|---|---|
| Ral + Amn + Perfect Amethyst + weapon |1–6roll capped to allowed sockets |
| Tal + Thul + Perfect Topaz + body armor |Same1–6roll capped |
| Ral + Thul + Perfect Sapphire + helm |Same1–6roll capped |
| Tal + Amn + Perfect Ruby + shield |Same1–6roll capped |
| Hel + Town Portal scroll + socketed item |Empty same sockets; all contents destroyed |
| Ort + nonethereal weapon |Repair/refill quantity; not charges |
| Ral + nonethereal armor |Repair; not charges |
| Ort + chipped gem + nonethereal weapon |Repair/refill and recharge |
| Ral + flawed gem + nonethereal armor |Repair and recharge |
| Eld + chipped gem + low-quality weapon |Normal-quality same base, new ilvl1 |
| El + chipped gem + low-quality armor |Normal-quality same base, new ilvl1 |
|3PerfectSkulls + StoneofJordan + unsocketed rare |Add1socket, base eligibility required |

Low-quality normalization re-creates normal quality and can alter innate properties; it does not preserve the original ilvl for subsequent sockets. It is a useful low-ilvl socket-cap path, not a free quality upgrade preserving every roll.

### 8.2 Base upgrades

| Quality/tier | Weapon ingredients | Armor ingredients | Added required level |
|---|---|---|---:|
| Unique normal→exceptional | Ral+Sol+PerfectEmerald | Tal+Shael+PerfectDiamond |+5 |
| Unique exceptional→elite | Lum+Pul+PerfectEmerald | Ko+Lem+PerfectDiamond |+7 |
| Rare normal→exceptional | Ort+Amn+PerfectSapphire | Ral+Thul+PerfectAmethyst |+5 |
| Rare exceptional→elite | Fal+Um+PerfectSapphire | Ko+Pul+PerfectAmethyst |+7 |

Properties/ethereal/sockets/socket contents are retained; base changes to mapped tier; new damage/defense/requirements/durability follow upgrade rules. Added level-requirement penalties accumulate (+12 for both stages), applied after the maximum underlying base/affix/item/socket requirement; do not replace the unique's stats with the higher tier unique definition. Unique elite upgrades are ladder-restricted online, **also enabled in vanilla single-player**, unlike ladder-only runewords. Rare upgrades work nonladder. Legacy has no set-upgrade recipes; those were introduced in D2R.

### 8.3 Rerolls and level rules

| Recipe | Result / stored ilvl |
|---|---|
|3PerfectGems(any including skulls)+magic item |New magic affixes, same base, `newIlvl=oldIlvl` |
|6PerfectSkulls+rare item |New rare, `floor(.4clvl)+floor(.4oldIlvl)`; repeated rolls can lower level |
|PerfectSkull+StoneofJordan+rare |New rare, `floor(.66clvl)+floor(.66oldIlvl)`, cap99 |
|3magic rings |Magic amulet, `floor(.75clvl)` |
|3magic amulets |Magic ring, `floor(.75clvl)` |
|3chipped gems+magic weapon |New magic weapon ilvl25,1–2sockets capped |
|3flawless gems+magic weapon |New magic weapon ilvl30,1–2sockets capped |
|3normal gems+socketed weapon |New magic weapon ilvl30,1–2sockets capped |
|Six different PerfectGems (not Skull)+magic amulet |Prismatic prefix allres16–20, ilvl50 |

Do not assume a magical charm reroll raises its ilvl to clvl. To roll a Grand Charm of Vita with41–45life requires ilvl91+ because that affix is alvl91; legacy Baal/Diablo/Nihlathak high-level charms are relevant.

### 8.4 Crafted item rules and family summary

Input **must be magic**, correct listed base family, one jewel(any quality), one specified rune, one specified perfect gem. Normal/exceptional/elite counterparts of the listed base work. Old magic affixes are erased; recipe fixed properties plus rare-eligible random affixes (§2.4) are generated. Fixed and random properties can add to the same displayed stat without sharing an affix slot. Output `ilvl=floor(.5clvl)+floor(.5inputIlvl)`. Jewel level and old jewel stats do not influence output rolls.

| Family | Perfect gem | Common fixed effects | Slot-specific effects |
|---|---|---|---|
| Hit Power | Sapphire |5%castlevel4FrostNova whenstruck; attacker damage3–7 (amulet3–10) |HelmdefMissile25–50;bootsdefMelee25–50;glovesKnockback;beltDTM5–10%;shieldICB5–10%;bodyFHR10–20%;amuletflee3–11%;ringdex1–5;weaponED35–60% |
| Blood | Ruby |Life10–20;LL1–3% (weapon/amulet1–4%) |HelmDS5–10%;bootsReplenishLife5–10;glovesCB5–10%;beltOW5–10%;shieldattacker damage4–7;bodylifeperDemonKill1–3;amuletFRW5–10%;ringstr1–5;weaponED35–60% |
| Caster | Amethyst |Mana10–20;manaRegen4–10% |HelmML1–4%;bootsmaxMana2–5%;gloves/bodymanaKill1–3;belt/amuletFCR5–10%;shieldICB5–10%;ringenergy1–5;weaponmaxMana1–5% |
| Safety | Emerald |MDR1–2;flatDR1–4 |Helm/boots/gloves/beltEDef10–30% + lightning/fire/cold/poisonres5–10%;shieldEDef10–30%+magicres5–10%;bodyEDef10–30%+HalfFreeze;amuletICB1–10%;ringvit1–5;weaponEDef5–10% |

See Appendix H for **exact bases and runes per all36 recipes**, not merely this summary. Hit Power weapon uses broad `blun` (includes rods and other blunt families), Blood weapon uses axes, Caster weapon uses rods(staff/wand/scepter, not orb), Safety weapon uses spears/javelins via appropriate type membership. Caster amulet can combine fixed5–10FCR with random10FCR suffix for maximum20FCR; caster belt maximum10FCR because ordinary belt random affixes do not add FCR.

### 8.5 Rune/gem upgrades and special recipes

Three same gems of same grade→one next grade, through Perfect, all seven types. El through Ort:3sameRunes→next, no gem. Thul→Amn→Sol→Shael→Dol use3runesthenChippedTopaz/Amethyst/Sapphire/Ruby. Dol→Hel and onward require the gem sequence in Appendix H. Pul and higher require **two** runes per upgrade. Recipes producing Hel and above have ladderflags in CubeMain; **single-player allows them**, online nonladder does not. Highest recipe2Cham+FlawlessEmerald→Zod. No rune downgrade.

Wirt'sLeg+TownPortalTome opens legacy Cow portal subject to quest/difficulty conditions. Killing Cow King can permanently affect that character's ability to reopen the portal in that difficulty; D2R removed that legacy restriction. Three terror/hate/destruction keys in Hell Harrogath create a mini-Uber portal;3organscreateUberTristram; online legacy realms only. Four essences create TokenofAbsolution; consumable resets skill/stat assignments. Appendix H retains these rows but client presence alone does not enable server-only events in unmodified single-player.

Sources: [Cube](https://classic.battle.net/diablo2exp/items/cube.shtml), [crafting](https://classic.battle.net/diablo2exp/items/crafteditems.shtml), [HitPower](https://classic.battle.net/diablo2exp/items/crafted/hitpower.shtml), [Blood](https://classic.battle.net/diablo2exp/items/crafted/blood.shtml), [Caster](https://classic.battle.net/diablo2exp/items/crafted/caster.shtml), [Safety](https://classic.battle.net/diablo2exp/items/crafted/safety.shtml).

## 9. Consumables, gold, economy

### 9.1 Healing and mana potions

Class totals below are official nominal restore amounts before chance to double and fixed-point/over-time rounding. Life/mana cannot exceed current maximum. **Healing lengths vary by tier** in Misc.txt; do not implement a universal7.68s duration.

| Healing | Code | Nec/Sorc/Druid | Amazon/Paladin/Assassin | Barbarian | Duration frames / seconds | Base cost |
|---|---|---:|---:|---:|---|---:|
| Minor |hp1|30|45|60|192 /7.68|30|
| Light |hp2|60|90|120|160 /6.40|75|
| Healing |hp3|100|150|200|171 /6.84|125|
| Greater |hp4|180|270|360|192 /7.68|250|
| Super |hp5|320|480|640|256 /10.24|500|

| Mana | Code | Barbarian | Amazon/Paladin/Assassin | Druid/Nec/Sorc | Duration frames / seconds | Base cost |
|---|---|---:|---:|---:|---|---:|
| Minor |mp1|20|30|40|128 /5.12|60|
| Light |mp2|40|60|80|128 /5.12|150|
| Mana |mp3|80|120|160|128 /5.12|250|
| Greater |mp4|150|225|300|128 /5.12|500|
| Super |mp5|250|375|500|128 /5.12|1000|

Repeated healing potions extend healing rather than stacking their full rates as independent instant effects. Precise different-tier overlap and rounding require frame-level testing. Mana potions similarly apply over time; rejuvenation is immediate. Hireling potion scaling and player attribute-double mechanics should not be conflated.

| Consumable | Effect | Length | Base cost |
|---|---|---|---:|
| Rejuvenation |Instant35%maximum life AND35%maximum mana|Instant|400|
| Full Rejuvenation |Instant100%life ANDmana|Instant|1500|
| Antidote |Cures poison;+50poisonRes,+10maxpoisonRes|750frames=30s|40|
| Thawing |Removes freeze/chill;+50coldRes,+10maxcoldRes|750frames=30s|25|
| Stamina |Restores stamina;unlimited stamina buff|750frames=30s|25|

Repeated antidote/thawing/stamina potions stack **duration**, not resistance magnitude. These buffs can be given to a hireling. Rejuvenations are not normal vendor-stock purchases; cost values are source economic fields, not a promise every vendor sells that item.

Chance to double potion restore: use vitality X for healing, energy X for mana. Official percent formulas: below200, evenX `(X−2)/4`; oddX `(X−1)^2/(4X)`; X≥200 `100×(X−101)/X`. Handle X=0/low values sensibly and verify discrete RNG boundaries; atX200 the result is49.5%, tending toward100%, not becoming100%at200. [Character basics](https://classic.battle.net/diablo2exp/basics/characters.shtml).

### 9.2 Throwing potions

| Potion | Code | Required level / qlvl | Effect |
|---|---|---|---|
| Fulminating |opl|0/4|5–15total:3–8fire +2–7physical |
| Exploding |opm|12/16|16–30total:8–18fire +8–12physical |
| Oil |ops|20/28|26–64total:13–34fire +13–30physical;4yardradius |
| Strangling Gas |gpl|6/8|24poison over2s |
| Choking Gas |gpm|16/20|72poison over2s |
| Rancid Gas |gps|24/32|96poison over2s |

Maximum stack25; Appendix A provides footprint/speed and raw damage fields. Treat splash/poison clouds as skills/missiles, not ordinary melee flat damage. Source: [potions](https://classic.battle.net/diablo2exp/items/potions.shtml).

### 9.3 Scrolls, tomes, keys, identify

Loose TP scroll base cost100; Identify80; TP tome base cost250; Identify tome200; each tome stores20scrolls and occupies1×2. Actual vendor tome price can include contained scrolls. Shift-right-click buying scrolls fills the first appropriate incomplete tome. Identifying consumes one scroll and reveals already generated properties; it does not reroll the item. Unidentified magical equipment cannot be equipped. Cain generally identifies for100gold per item if not rescued, free after the rescue reward; quest-state/vendor details should be tested.

One active Town Portal per character; recasting closes the old one. Returning through one's own portal from town closes it; party members may use it while party/quest conditions allow. Hostility closes a portal. Scroll/tome location and cast restrictions are legacy UI rules, not a generic teleport skill.

Keys have base cost45 and stack12. Locked chests consume a key; Assassin opens them without one. Keys inside the Cube do not count as carried usable keys. Pandemonium keys are different items and do not open ordinary locked chests.

### 9.4 Gold and vendors

Carry gold cap `10000×clvl`; stash gold cap**2,500,000**; level99combinedcap3,490,000. Gold does not occupy inventory cells. Realm death penalty is level percent, capped20%, assessed against carried+stash gold; remaining carried gold drops. Single-player protects stash and500goldperlevel; preserve this mode distinction.

| Maximum vendor payment for selling one item | Normal | Nightmare | Hell |
|---|---:|---:|---:|
| ActI |5000|30000|35000|
| ActII |10000|30000|35000|
| ActIII |15000|30000|35000|
| ActIV |20000|30000|35000|
| ActV |25000|30000|35000|

Vendors pay the same sale amount for the same item/difficulty/act caps; buying it back is more expensive. Repairing solely to improve resale does not improve net proceeds. Ethereal sold stock disappears. Vendor equipment refresh is tied to leaving town and other-player/timing rules (officially vendor idle4min when others remain in town), not merely closing the window. Hell ActI/II vendors do not broadly upgrade inventory to exceptional/elite except throwing weapons; do not provide an unrestricted best-base shop.

Pricing inputs: base `cost`; affix `multiply/add/divide`; unique/set `cost mult/cost add`; durability/quantity/charges and NPC difficulty factors; quest discounts and vendor-price-reduction stats. Appendix A/C/F preserves cost fields and §9.1 supplies potion base costs. **A complete exact buy/sell/repair/gamble price arithmetic engine has not been reconstructed**; no invented universal “sell for25%ofvalue” formula is specified. Edge reduces vendor prices15%; Gheed's10–15%; together maximum30%, including gambling, with rounding to verify. Radament quest gives an ActII10%price discount; do not assume all quest discounts are global.

### 9.5 Gambling

Source: [official gambling](https://classic.battle.net/diablo2exp/basics/gambling.shtml).

| Quality | Probability |
|---|---:|
| Unique |0.05%=1/2000|
| Set |0.10%=1/1000|
| Rare |10.00%|
| Magic |89.85%|

MF, player count, act and difficulty do not change quality. Each gamble rolls its ilvl independently `clvl−5…clvl+4`, bounded5–99. The displayed normal base can produce its exceptional/elite counterpart; not every class-specific type appears in gambling stock.

Published upgrade percentages, with negative chance clamped0:

```text
ExceptionalChancePercent = (ilvl − exceptionalBaseQlvl)×0.9 +1
EliteChancePercent       = (ilvl − eliteBaseQlvl)×0.33 +1
```

In units of1/10000 these are `90×(ilvl−exceptionalQlvl)+100` and `33×(ilvl−eliteQlvl)+100`, clamped to a valid probability range. **0.9% =90 per10000**, not9. The elite-versus-exceptional roll order/conditional denominator should be tested; do not simply add percentages as mutually exclusive final probabilities without confirming the algorithm.

Ring gamble price50,000; amulet63,000 before discounts. Other stock prices scale with clvl; source `gamble cost` fields are preserved but are not a complete level-price formula. Stock refresh requires legacy vendor interaction; D2R's dedicated refresh button/rebuy behavior is not part of this target.

For amulet baseqlvl1, magiclvl0, alvl follows ilvl. +2classskills affixalvl90: first possible ordinary gamble at **clvl86**, best rollilvl90; clvl95guaranteesilvl90+. Crafting atclvl93 with a self-gambled amulet: mininputilvl88; newilvl46+44=90, so +2class eligibility is guaranteed. Neither case guarantees that the +2affix actually rolls. Official pages claiming clvl84 use outdated +6/−3 descriptions and are not the target formula.

## Numeric appendices

The following tables are tabulations of the legacy source data, not generated game code. Original row numbers are **file line numbers including the header**, retained to disambiguate duplicate names. Codes, property tuples, level and type restrictions are the import keys. Blank-versus-zero distinctions are retained in raw tuples; explanatory display columns are secondary.


## Appendix A. Complete weapon and armor bases

All spawnable source rows. `Socket caps` = ilvl1–25 /26–40 /41+; `Str/Dex scaling` is the damage attribute coefficient, not the requirement. Tier names come from source mappings; circlets have nonstandard mapping. Source name is retained where corrected display spelling differs. All base ranges are before quality, ethereal, named-item and socket modifiers.

[Source Weapons.txt](https://cdn.jsdelivr.net/gh/fabd/diablo2@45112569deb9384738ccafe5c24ebbb71f41c7c9/code/d2_113_data/Weapons.txt).


### A.W. Axe (`axe`)

| Line | Name / code | Tier; class; type2 | 1H /2H /throw damage | Str /Dex req | Req lvl /qlvl | Dur /noDur | Max sockets; caps | W×H | WSM; rangeadder | Str/Dex scaling | Stack max | Magic lvl; automod group | Base cost /gamble cost | Normal /exceptional /elite |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2 | Hand Axe `hax` | normal; general; — | 3–6 / — / — | 0 /0 | 0 /3 | 28 /0 | 2; 2/2/2 | 1×3 | ;  | 100/ | — | 0; — | 170 /4510 | Hand Axe `hax` / Hatchet `9ha` / Tomahawk `7ha` |
| 3 | Axe `axe` | normal; general; — | 4–11 / — / — | 32 /0 | 0 /7 | 24 /0 | 4; 4/4/4 | 2×3 | 10; 1 | 100/ | — | 0; — | 403 /8821 | Axe `axe` / Cleaver `9ax` / Small Crescent `7ax` |
| 4 | Double Axe `2ax` | normal; general; — | 5–13 / — / — | 43 /0 | 0 /13 | 24 /0 | 5; 4/5/5 | 2×3 | 10; 1 | 100/ | — | 0; — | 873 /20349 | Double Axe `2ax` / Twin Axe `92a` / Ettin Axe `72a` |
| 5 | Military Pick `mpi` | normal; general; — | 7–11 / — / — | 49 /33 | 0 /19 | 26 /0 | 6; 4/5/6 | 2×3 | -10; 1 | 100/ | — | 0; — | 1421 /38999 | Military Pick `mpi` / Crowbill `9mp` / War Spike `7mp` |
| 6 | War Axe `wax` | normal; general; — | 10–18 / — / — | 67 /0 | 0 /25 | 26 /0 | 6; 4/5/6 | 2×3 | ; 2 | 100/ | — | 0; — | 2123 /68075 | War Axe `wax` / Naga `9wa` / Berserker Axe `7wa` |
| 7 | Large Axe `lax` | normal; general; — | — / 6–13 / — | 35 /0 | 0 /6 | 30 /0 | 4; 4/4/4 | 2×3 | -10; 1 | 100/ | — | 0; — | 354 /7624 | Large Axe `lax` / Military Axe `9la` / Feral Axe `7la` |
| 8 | Broad Axe `bax` | normal; general; — | — / 10–18 / — | 48 /0 | 0 /12 | 35 /0 | 5; 4/5/5 | 2×3 | ; 1 | 100/ | — | 0; — | 806 /18172 | Broad Axe `bax` / Bearded Axe `9ba` / Silver-edged Axe `7ba` |
| 9 | Battle Axe `btx` | normal; general; — | — / 12–32 / — | 54 /0 | 0 /17 | 40 /0 | 5; 4/5/5 | 2×3 | 10; 1 | 100/ | — | 0; — | 1262 /32454 | Battle Axe `btx` / Tabar `9bt` / Decapitator `7bt` |
| 10 | Great Axe `gax` | normal; general; — | — / 9–30 / — | 63 /39 | 0 /23 | 50 /0 | 6; 4/5/6 | 2×4 | -10; 2 | 100/ | — | 0; — | 1916 /58068 | Great Axe `gax` / Gothic Axe `9ga` / Champion Axe `7ga` |
| 11 | Giant Axe `gix` | normal; general; — | — / 22–45 / — | 70 /0 | 0 /27 | 50 /0 | 6; 4/5/6 | 2×3 | 10; 3 | 100/ | — | 0; — | 2410 /81070 | Giant Axe `gix` / Ancient Axe `9gi` / Glorious Axe `7gi` |
| 95 | Hatchet `9ha` | exceptional; general; — | 10–21 / — / — | 25 /25 | 19 /31 | 28 /0 | 2; 2/2/2 | 1×3 | ;  | 100/ | — | 0; — | 810 /43110 | Hand Axe `hax` / Hatchet `9ha` / Tomahawk `7ha` |
| 96 | Cleaver `9ax` | exceptional; general; — | 10–33 / — / — | 68 /0 | 22 /34 | 24 /0 | 4; 4/4/4 | 2×3 | 10; 1 | 100/ | — | 0; — | 1509 /70806 | Axe `axe` / Cleaver `9ax` / Small Crescent `7ax` |
| 97 | Twin Axe `92a` | exceptional; general; — | 13–38 / — / — | 85 /0 | 25 /39 | 24 /0 | 5; 4/5/5 | 2×3 | 10; 1 | 100/ | — | 0; — | 2919 /135841 | Double Axe `2ax` / Twin Axe `92a` / Ettin Axe `72a` |
| 98 | Crowbill `9mp` | exceptional; general; — | 14–34 / — / — | 94 /70 | 25 /43 | 26 /0 | 6; 4/5/6 | 2×3 | -10; 1 | 100/ | — | 0; — | 4563 /220209 | Military Pick `mpi` / Crowbill `9mp` / War Spike `7mp` |
| 99 | Naga `9wa` | exceptional; general; — | 16–45 / — / — | 121 /0 | 25 /48 | 26 /0 | 6; 4/5/6 | 2×3 | ; 2 | 100/ | — | 0; — | 6669 /346612 | War Axe `wax` / Naga `9wa` / Berserker Axe `7wa` |
| 100 | Military Axe `9la` | exceptional; general; — | — / 14–34 / — | 73 /0 | 22 /34 | 30 /0 | 4; 4/4/4 | 2×3 | -10; 1 | 100/ | — | 0; — | 1362 /65808 | Large Axe `lax` / Military Axe `9la` / Feral Axe `7la` |
| 101 | Bearded Axe `9ba` | exceptional; general; — | — / 21–49 / — | 92 /0 | 25 /38 | 35 /0 | 5; 4/5/5 | 2×3 | ; 1 | 100/ | — | 0; — | 2718 /124784 | Broad Axe `bax` / Bearded Axe `9ba` / Silver-edged Axe `7ba` |
| 102 | Tabar `9bt` | exceptional; general; — | — / 24–77 / — | 101 /0 | 25 /42 | 40 /0 | 5; 4/5/5 | 2×3 | 10; 1 | 100/ | — | 0; — | 4086 /195112 | Battle Axe `btx` / Tabar `9bt` / Decapitator `7bt` |
| 103 | Gothic Axe `9ga` | exceptional; general; — | — / 18–70 / — | 115 /79 | 25 /46 | 50 /0 | 6; 4/5/6 | 2×4 | -10; 2 | 100/ | — | 0; — | 6048 /303708 | Great Axe `gax` / Gothic Axe `9ga` / Champion Axe `7ga` |
| 104 | Ancient Axe `9gi` | exceptional; general; — | — / 43–85 / — | 125 /0 | 25 /51 | 50 /0 | 6; 4/5/6 | 2×3 | 10; 3 | 100/ | — | 0; — | 7530 /412030 | Giant Axe `gix` / Ancient Axe `9gi` / Glorious Axe `7gi` |
| 199 | Tomahawk `7ha` | elite; general; — | 33–58 / — / — | 125 /67 | 40 /54 | 28 /0 | 2; 2/2/2 | 1×3 | ;  | 100/ | — | 0; — | 14033 /787282 | Hand Axe `hax` / Hatchet `9ha` / Tomahawk `7ha` |
| 200 | Small Crescent `7ax` | elite; general; — | 38–60 / — / — | 115 /83 | 45 /61 | 24 /0 | 4; 4/4/4 | 2×3 | 10; 1 | 100/ | — | 0; — | 15781 /995641 | Axe `axe` / Cleaver `9ax` / Small Crescent `7ax` |
| 201 | Ettin Axe `72a` | elite; general; — | 33–66 / — / — | 145 /45 | 52 /70 | 24 /0 | 5; 4/5/5 | 2×3 | 10; 1 | 100/ | — | 0; — | 13496 /982220 | Double Axe `2ax` / Twin Axe `92a` / Ettin Axe `72a` |
| 202 | War Spike `7mp` | elite; general; — | 30–48 / — / — | 133 /54 | 59 /79 | 26 /0 | 6; 4/5/6 | 2×3 | -10; 1 | 100/ | — | 0; — | 16108 /1314532 | Military Pick `mpi` / Crowbill `9mp` / War Spike `7mp` |
| 203 | Berserker Axe `7wa` | elite; general; — | 24–71 / — / — | 138 /59 | 64 /85 | 26 /0 | 6; 4/5/6 | 2×3 | ; 2 | 100/ | — | 0; — | 15957 /1401345 | War Axe `wax` / Naga `9wa` / Berserker Axe `7wa` |
| 204 | Feral Axe `7la` | elite; general; — | — / 25–123 / — | 196 /0 | 42 /57 | 30 /0 | 4; 4/4/4 | 2×3 | -15; 2 | 100/ | — | 0; — | 17430 /1024510 | Large Axe `lax` / Military Axe `9la` / Feral Axe `7la` |
| 205 | Silver-edged Axe [source: Silver Edged Axe] `7ba` | elite; general; — | — / 62–110 / — | 166 /65 | 48 /65 | 35 /0 | 5; 4/5/5 | 2×3 | ; 2 | 100/ | — | 0; — | 18956 /1267140 | Broad Axe `bax` / Bearded Axe `9ba` / Silver-edged Axe `7ba` |
| 206 | Decapitator `7bt` | elite; general; — | — / 49–137 / — | 189 /33 | 54 /73 | 40 /0 | 5; 4/5/5 | 2×3 | 10; 2 | 100/ | — | 0; — | 16377 /1234521 | Battle Axe `btx` / Tabar `9bt` / Decapitator `7bt` |
| 207 | Champion Axe `7ga` | elite; general; — | — / 59–94 / — | 167 /59 | 61 /82 | 50 /0 | 6; 4/5/6 | 2×4 | -10; 2 | 100/ | — | 0; — | 19245 /1621590 | Great Axe `gax` / Gothic Axe `9ga` / Champion Axe `7ga` |
| 208 | Glorious Axe `7gi` | elite; general; — | — / 60–124 / — | 164 /55 | 66 /85 | 50 /0 | 6; 4/5/6 | 2×3 | 10; 3 | 100/ | — | 0; — | 18431 /1611635 | Giant Axe `gix` / Ancient Axe `9gi` / Glorious Axe `7gi` |

### A.W. Wand (`wand`)

| Line | Name / code | Tier; class; type2 | 1H /2H /throw damage | Str /Dex req | Req lvl /qlvl | Dur /noDur | Max sockets; caps | W×H | WSM; rangeadder | Str/Dex scaling | Stack max | Magic lvl; automod group | Base cost /gamble cost | Normal /exceptional /elite |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 12 | Wand `wnd` | normal; general; — | 2–4 / — / — | 0 /0 | 0 /2 | 15 /0 | 1; 1/1/1 | 1×2 | ;  | 100/ | — | 1; — | 205 /3910 | Wand `wnd` / Burnt Wand `9wn` / Polished Wand `7wn` |
| 13 | Yew Wand `ywn` | normal; general; — | 2–8 / — / — | 0 /0 | 0 /12 | 15 /0 | 1; 1/1/1 | 1×2 | 10;  | 100/ | — | 1; — | 745 /17440 | Yew Wand `ywn` / Petrified Wand `9yw` / Ghost Wand `7yw` |
| 14 | Bone Wand `bwn` | normal; general; — | 3–7 / — / — | 0 /0 | 0 /18 | 15 /0 | 2; 2/2/2 | 1×2 | -20;  | 100/ | — | 1; — | 1296 /34828 | Bone Wand `bwn` / Tomb Wand `9bw` / Lich Wand `7bw` |
| 15 | Grim Wand `gwn` | normal; general; — | 5–11 / — / — | 0 /0 | 0 /26 | 15 /0 | 2; 2/2/2 | 1×2 | ;  | 100/ | — | 1; — | 2098 /70048 | Grim Wand `gwn` / Grave Wand `9gw` / Unearthed Wand `7gw` |
| 105 | Burnt Wand `9wn` | exceptional; general; — | 8–18 / — / — | 25 /0 | 19 /31 | 15 /0 | 1; 1/1/1 | 1×2 | ;  | 100/ | — | 1; — | 915 /46365 | Wand `wnd` / Burnt Wand `9wn` / Polished Wand `7wn` |
| 106 | Petrified Wand `9yw` | exceptional; general; — | 8–24 / — / — | 25 /0 | 25 /38 | 15 /0 | 2; 2/2/2 | 1×2 | 10;  | 100/ | — | 1; — | 2535 /117830 | Yew Wand `ywn` / Petrified Wand `9yw` / Ghost Wand `7yw` |
| 107 | Tomb Wand `9bw` | exceptional; general; — | 10–22 / — / — | 25 /0 | 25 /43 | 15 /0 | 2; 2/2/2 | 1×2 | -20;  | 100/ | — | 1; — | 4188 /204084 | Bone Wand `bwn` / Tomb Wand `9bw` / Lich Wand `7bw` |
| 108 | Grave Wand `9gw` | exceptional; general; — | 13–29 / — / — | 25 /0 | 25 /49 | 15 /0 | 2; 2/2/2 | 1×2 | ;  | 100/ | — | 1; — | 6594 /350106 | Grim Wand `gwn` / Grave Wand `9gw` / Unearthed Wand `7gw` |
| 209 | Polished Wand `7wn` | elite; general; — | 18–33 / — / — | 25 /0 | 41 /55 | 22 /0 | 2; 2/2/2 | 1×2 | ;  | 100/ | — | 0; — | 9412 /547660 | Wand `wnd` / Burnt Wand `9wn` / Polished Wand `7wn` |
| 210 | Ghost Wand `7yw` | elite; general; — | 20–40 / — / — | 25 /0 | 48 /65 | 14 /0 | 2; 2/2/2 | 1×2 | 10;  | 100/ | — | 0; — | 8786 /606090 | Yew Wand `ywn` / Petrified Wand `9yw` / Ghost Wand `7yw` |
| 211 | Lich Wand `7bw` | elite; general; — | 10–31 / — / — | 25 /0 | 56 /75 | 17 /0 | 2; 2/2/2 | 1×2 | -20;  | 100/ | — | 0; — | 9208 /730600 | Bone Wand `bwn` / Tomb Wand `9bw` / Lich Wand `7bw` |
| 212 | Unearthed Wand `7gw` | elite; general; — | 22–28 / — / — | 25 /0 | 64 /86 | 18 /0 | 2; 2/2/2 | 1×2 | ;  | 100/ | — | 0; — | 7687 /706582 | Grim Wand `gwn` / Grave Wand `9gw` / Unearthed Wand `7gw` |

### A.W. Club (`club`)

| Line | Name / code | Tier; class; type2 | 1H /2H /throw damage | Str /Dex req | Req lvl /qlvl | Dur /noDur | Max sockets; caps | W×H | WSM; rangeadder | Str/Dex scaling | Stack max | Magic lvl; automod group | Base cost /gamble cost | Normal /exceptional /elite |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 16 | Club `clb` | normal; general; — | 1–6 / — / — | 0 /0 | 0 /1 | 24 /0 | 2; 2/2/2 | 1×3 | -10;  | 100/ | — | 0; — | 32 /3032 | Club `clb` / Cudgel `9cl` / Truncheon `7cl` |
| 20 | Spiked Club `spc` | normal; general; — | 5–8 / — / — | 0 /0 | 0 /4 | 36 /0 | 2; 2/2/2 | 1×3 | ; 1 | 100/ | — | 0; — | 225 /5400 | Spiked Club `spc` / Barbed Club `9sp` / Tyrant Club `7sp` |
| 109 | Cudgel `9cl` | exceptional; general; — | 6–21 / — / — | 25 /0 | 18 /30 | 24 /0 | 2; 2/2/2 | 1×3 | -10;  | 100/ | — | 0; — | 396 /29380 | Club `clb` / Cudgel `9cl` / Truncheon `7cl` |
| 113 | Barbed Club `9sp` | exceptional; general; — | 13–25 / — / — | 30 /0 | 20 /32 | 36 /0 | 3; 3/3/3 | 1×3 | ; 1 | 100/ | — | 0; — | 975 /49700 | Spiked Club `spc` / Barbed Club `9sp` / Tyrant Club `7sp` |
| 213 | Truncheon `7cl` | elite; general; — | 35–43 / — / — | 88 /43 | 39 /52 | 55 /0 | 2; 2/2/2 | 1×3 | -10;  | 100/ | — | 0; — | 1488 /105876 | Club `clb` / Cudgel `9cl` / Truncheon `7cl` |
| 217 | Tyrant Club `7sp` | elite; general; — | 32–58 / — / — | 133 /0 | 42 /57 | 65 /0 | 3; 3/3/3 | 1×3 | ; 1 | 100/ | — | 0; — | 6793 /418201 | Spiked Club `spc` / Barbed Club `9sp` / Tyrant Club `7sp` |

### A.W. Scepter (`scep`)

| Line | Name / code | Tier; class; type2 | 1H /2H /throw damage | Str /Dex req | Req lvl /qlvl | Dur /noDur | Max sockets; caps | W×H | WSM; rangeadder | Str/Dex scaling | Stack max | Magic lvl; automod group | Base cost /gamble cost | Normal /exceptional /elite |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 17 | Scepter `scp` | normal; general; — | 6–11 / — / — | 25 /0 | 0 /3 | 50 /0 | 2; 2/2/2 | 1×3 | ;  | 100/ | — | 0; — | 350 /5050 | Scepter `scp` / Rune Scepter `9sc` / Mighty Scepter `7sc` |
| 18 | Grand Scepter `gsc` | normal; general; — | 8–18 / — / — | 37 /0 | 0 /15 | 60 /0 | 3; 3/3/3 | 1×3 | 10; 1 | 100/ | — | 0; — | 1109 /26635 | Grand Scepter `gsc` / Holy Water Sprinkler `9qs` / Seraph Rod `7qs` |
| 19 | War Scepter `wsp` | normal; general; — | 10–17 / — / — | 55 /0 | 0 /21 | 70 /0 | 5; 3/5/5 | 2×3 | -10; 1 | 100/ | — | 0; — | 2323 /61783 | War Scepter `wsp` / Divine Scepter `9ws` / Caduceus `7ws` |
| 110 | Rune Scepter `9sc` | exceptional; general; — | 13–24 / — / — | 58 /0 | 19 /31 | 50 /0 | 2; 2/2/2 | 1×3 | ;  | 100/ | — | 0; — | 1350 /59850 | Scepter `scp` / Rune Scepter `9sc` / Mighty Scepter `7sc` |
| 111 | Holy Water Sprinkler `9qs` | exceptional; general; — | 14–36 / — / — | 76 /0 | 25 /40 | 60 /0 | 3; 3/3/3 | 1×3 | 10; 1 | 100/ | — | 0; — | 3627 /167580 | Grand Scepter `gsc` / Holy Water Sprinkler `9qs` / Seraph Rod `7qs` |
| 112 | Divine Scepter `9ws` | exceptional; general; — | 16–38 / — / — | 103 /0 | 25 /45 | 70 /0 | 5; 3/5/5 | 2×3 | -10; 1 | 100/ | — | 0; — | 7269 /352105 | War Scepter `wsp` / Divine Scepter `9ws` / Caduceus `7ws` |
| 214 | Mighty Scepter `7sc` | elite; general; — | 40–52 / — / — | 125 /65 | 46 /62 | 50 /0 | 2; 2/2/2 | 1×3 | ;  | 100/ | — | 0; — | 20199 /1285838 | Scepter `scp` / Rune Scepter `9sc` / Mighty Scepter `7sc` |
| 215 | Seraph Rod `7qs` | elite; general; — | 45–54 / — / — | 108 /69 | 57 /76 | 60 /0 | 3; 3/3/3 | 1×3 | 10; 1 | 100/ | — | 0; — | 23501 /1826576 | Grand Scepter `gsc` / Holy Water Sprinkler `9qs` / Seraph Rod `7qs` |
| 216 | Caduceus `7ws` | elite; general; — | 37–43 / — / — | 97 /70 | 66 /85 | 70 /0 | 5; 3/5/5 | 2×3 | -10; 1 | 100/ | — | 0; — | 22870 /1988950 | War Scepter `wsp` / Divine Scepter `9ws` / Caduceus `7ws` |

### A.W. Mace (`mace`)

| Line | Name / code | Tier; class; type2 | 1H /2H /throw damage | Str /Dex req | Req lvl /qlvl | Dur /noDur | Max sockets; caps | W×H | WSM; rangeadder | Str/Dex scaling | Stack max | Magic lvl; automod group | Base cost /gamble cost | Normal /exceptional /elite |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 21 | Mace `mac` | normal; general; — | 3–10 / — / — | 27 /0 | 0 /8 | 60 /0 | 2; 2/2/2 | 1×3 | ;  | 100/ | — | 0; — | 463 /10204 | Mace `mac` / Flanged Mace `9ma` / Reinforced Mace `7ma` |
| 22 | Morning Star `mst` | normal; general; — | 7–16 / — / — | 36 /0 | 0 /13 | 72 /0 | 3; 3/3/3 | 1×3 | 10; 1 | 100/ | — | 0; — | 844 /19972 | Morning Star `mst` / Jagged Star `9mt` / Devil Star `7mt` |
| 23 | Flail `fla` | normal; general; — | 1–24 / — / — | 41 /35 | 0 /19 | 30 /0 | 5; 3/4/5 | 2×3 | -10; 2 | 100/ | — | 0; — | 1412 /38828 | Flail `fla` / Knout `9fl` / Scourge `7fl` |
| 114 | Flanged Mace `9ma` | exceptional; general; — | 15–23 / — / — | 61 /0 | 23 /35 | 60 /0 | 2; 2/2/2 | 1×3 | ;  | 100/ | — | 0; — | 1689 /79115 | Mace `mac` / Flanged Mace `9ma` / Reinforced Mace `7ma` |
| 115 | Jagged Star `9mt` | exceptional; general; — | 20–31 / — / — | 74 /0 | 25 /39 | 72 /0 | 3; 3/3/3 | 1×3 | 10; 1 | 100/ | — | 0; — | 2832 /132448 | Morning Star `mst` / Jagged Star `9mt` / Devil Star `7mt` |
| 116 | Knout `9fl` | exceptional; general; — | 13–35 / — / — | 82 /73 | 25 /43 | 30 /0 | 5; 3/4/5 | 2×3 | -10; 2 | 100/ | — | 0; — | 4536 /219048 | Flail `fla` / Knout `9fl` / Scourge `7fl` |
| 218 | Reinforced Mace `7ma` | elite; general; — | 41–49 / — / — | 145 /46 | 47 /63 | 60 /0 | 2; 2/2/2 | 1×3 | ;  | 100/ | — | 0; — | 14765 /964195 | Mace `mac` / Flanged Mace `9ma` / Reinforced Mace `7ma` |
| 219 | Devil Star `7mt` | elite; general; — | 43–53 / — / — | 153 /44 | 52 /70 | 72 /0 | 3; 3/3/3 | 1×3 | 10; 1 | 100/ | — | 0; — | 15674 /1134680 | Morning Star `mst` / Jagged Star `9mt` / Devil Star `7mt` |
| 220 | Scourge `7fl` | elite; general; — | 3–80 / — / — | 125 /77 | 57 /76 | 65 /0 | 5; 3/4/5 | 2×3 | -10; 2 | 100/ | — | 0; — | 19532 /1524932 | Flail `fla` / Knout `9fl` / Scourge `7fl` |

### A.W. Hammer (`hamm`)

| Line | Name / code | Tier; class; type2 | 1H /2H /throw damage | Str /Dex req | Req lvl /qlvl | Dur /noDur | Max sockets; caps | W×H | WSM; rangeadder | Str/Dex scaling | Stack max | Magic lvl; automod group | Base cost /gamble cost | Normal /exceptional /elite |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 24 | War Hammer `whm` | normal; general; — | 19–29 / — / — | 53 /0 | 0 /25 | 55 /0 | 4; 3/4/4 | 2×3 | 20;  | 110/ | — | 0; — | 2081 /67025 | War Hammer `whm` / Battle Hammer `9wh` / Legendary Mallet `7wh` |
| 25 | Maul `mau` | normal; general; — | — / 30–43 / — | 69 /0 | 0 /21 | 60 /0 | 6; 3/4/6 | 2×4 | 10; 1 | 110/ | — | 0; — | 1670 /48070 | Maul `mau` / War Club `9m9` / Ogre Maul `7m7` |
| 26 | Great Maul `gma` | normal; general; — | — / 38–58 / — | 99 /0 | 0 /32 | 60 /0 | 6; 3/4/6 | 2×3 | 20; 2 | 110/ | — | 0; — | 3215 /121380 | Great Maul `gma` / Martel de Fer `9gm` / Thunder Maul `7gm` |
| 117 | Battle Hammer `9wh` | exceptional; general; — | 35–58 / — / — | 100 /0 | 25 /48 | 55 /0 | 4; 3/4/4 | 2×3 | 20;  | 110/ | — | 0; — | 6543 /340564 | War Hammer `whm` / Battle Hammer `9wh` / Legendary Mallet `7wh` |
| 118 | War Club `9m9` | exceptional; general; — | — / 53–78 / — | 124 /0 | 25 /45 | 60 /0 | 6; 3/4/6 | 2×4 | 10; 1 | 110/ | — | 0; — | 5310 /263950 | Maul `mau` / War Club `9m9` / Ogre Maul `7m7` |
| 119 | Martel de Fer `9gm` | exceptional; general; — | — / 61–99 / — | 169 /0 | 25 /53 | 60 /0 | 6; 3/4/6 | 2×3 | 20; 2 | 110/ | — | 0; — | 9945 /556085 | Great Maul `gma` / Martel de Fer `9gm` / Thunder Maul `7gm` |
| 221 | Legendary Mallet `7wh` | elite; general; — | 50–61 / — / — | 189 /0 | 61 /82 | 65 /0 | 4; 3/4/4 | 2×3 | 20; 1 | 110/ | — | 0; — | 14388 /1223316 | War Hammer `whm` / Battle Hammer `9wh` / Legendary Mallet `7wh` |
| 222 | Ogre Maul `7m7` | elite; general; — | — / 77–106 / — | 225 /0 | 51 /69 | 60 /0 | 6; 3/4/6 | 2×4 | 10; 1 | 110/ | — | 0; — | 12156 /875764 | Maul `mau` / War Club `9m9` / Ogre Maul `7m7` |
| 223 | Thunder Maul `7gm` | elite; general; — | — / 33–180 / — | 253 /0 | 65 /85 | 60 /0 | 6; 3/4/6 | 2×3 | 20; 2 | 110/ | — | 0; — | 17821 /1559785 | Great Maul `gma` / Martel de Fer `9gm` / Thunder Maul `7gm` |

### A.W. Sword (`swor`)

| Line | Name / code | Tier; class; type2 | 1H /2H /throw damage | Str /Dex req | Req lvl /qlvl | Dur /noDur | Max sockets; caps | W×H | WSM; rangeadder | Str/Dex scaling | Stack max | Magic lvl; automod group | Base cost /gamble cost | Normal /exceptional /elite |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 27 | Short Sword `ssd` | normal; general; — | 2–7 / — / — | 0 /0 | 0 /1 | 24 /0 | 2; 2/2/2 | 1×3 | ;  | 100/ | — | 0; — | 72 /3072 | Short Sword `ssd` / Gladius `9ss` / Falcata `7ss` |
| 28 | Scimitar `scm` | normal; general; — | 2–6 / — / — | 0 /21 | 0 /5 | 22 /0 | 2; 2/2/2 | 1×3 | -20;  | 100/ | — | 0; — | 274 /6370 | Scimitar `scm` / Cutlass `9sm` / Ataghan `7sm` |
| 29 | Sabre [source: Saber] `sbr` | normal; general; — | 3–8 / — / — | 25 /25 | 0 /8 | 32 /0 | 2; 2/2/2 | 1×3 | -10;  | 100/ | — | 0; — | 466 /10228 | Sabre `sbr` / Shamshir `9sb` / Elegant Blade `7sb` |
| 30 | Falchion `flc` | normal; general; — | 9–17 / — / — | 33 /0 | 0 /11 | 32 /0 | 2; 2/2/2 | 1×3 | 20;  | 100/ | — | 0; — | 683 /15513 | Falchion `flc` / Tulwar `9fc` / Hydra Edge `7fc` |
| 31 | Crystal Sword `crs` | normal; general; — | 5–15 / — / — | 43 /0 | 0 /11 | 20 /0 | 6; 3/4/6 | 2×3 | ; 1 | 100/ | — | 0; — | 2127 /31397 | Crystal Sword `crs` / Dimensional Blade `9cr` / Phase Blade `7cr` |
| 32 | Broad Sword `bsd` | normal; general; — | 7–14 / — / — | 48 /0 | 0 /15 | 32 /0 | 4; 3/4/4 | 2×3 | ;  | 100/ | — | 0; — | 1029 /25435 | Broad Sword `bsd` / Battle Sword `9bs` / Conquest Sword `7bs` |
| 33 | Long Sword `lsd` | normal; general; — | 3–19 / — / — | 55 /39 | 0 /20 | 44 /0 | 4; 3/4/4 | 2×3 | -10; 1 | 100/ | — | 0; — | 1520 /42900 | Long Sword `lsd` / Rune Sword `9ls` / Cryptic Sword `7ls` |
| 34 | War Sword `wsd` | normal; general; — | 8–20 / — / — | 71 /45 | 0 /27 | 44 /0 | 3; 3/3/3 | 1×3 | ; 1 | 100/ | — | 0; — | 1997 /69919 | War Sword `wsd` / Ancient Sword `9wd` / Mythical Sword `7wd` |
| 35 | Two-Handed Sword `2hs` | normal; general; — | 2–9 / 8–17 / — | 35 /27 | 0 /10 | 44 /0 | 3; 3/3/3 | 1×4 | ; 2 | 100/ | — | 0; — | 644 /13940 | Two-Handed Sword `2hs` / Espadon `92h` / Legend Sword `72h` |
| 36 | Claymore `clm` | normal; general; — | 5–12 / 13–30 / — | 47 /0 | 0 /17 | 50 /0 | 4; 3/4/4 | 1×4 | 10; 2 | 100/ | — | 0; — | 1262 /32454 | Claymore `clm` / Dacian Falx `9cm` / Highland Blade `7cm` |
| 37 | Giant Sword `gis` | normal; general; — | 3–16 / 9–28 / — | 56 /34 | 0 /21 | 50 /0 | 4; 3/4/4 | 1×4 | ; 2 | 100/ | — | 0; — | 1459 /43639 | Giant Sword `gis` / Tusk Sword `9gs` / Balrog Blade `7gs` |
| 38 | Bastard Sword `bsw` | normal; general; — | 7–19 / 20–28 / — | 62 /0 | 0 /24 | 40 /0 | 4; 3/4/4 | 1×4 | 10; 1 | 100/ | — | 0; — | 1971 /61804 | Bastard Sword `bsw` / Gothic Sword `9b9` / Champion Sword `7b7` |
| 39 | Flamberge `flb` | normal; general; — | 9–15 / 13–26 / — | 70 /49 | 0 /27 | 50 /0 | 5; 3/4/5 | 2×4 | -10; 2 | 100/ | — | 0; — | 2400 /80800 | Flamberge `flb` / Zweihander `9fb` / Colossal Sword `7fb` |
| 40 | Great Sword `gsd` | normal; general; — | 12–20 / 25–42 / — | 100 /60 | 0 /33 | 50 /0 | 6; 3/4/6 | 2×4 | 10; 2 | 100/ | — | 0; — | 3451 /132883 | Great Sword `gsd` / Executioner Sword `9gd` / Colossus Blade `7gd` |
| 120 | Gladius `9ss` | exceptional; general; — | 8–22 / — / — | 25 /0 | 18 /30 | 24 /0 | 2; 2/2/2 | 1×3 | ;  | 100/ | — | 0; — | 516 /32980 | Short Sword `ssd` / Gladius `9ss` / Falcata `7ss` |
| 121 | Cutlass `9sm` | exceptional; general; — | 8–21 / — / — | 25 /52 | 25 /43 | 22 /0 | 2; 2/2/2 | 1×3 | -30;  | 100/ | — | 0; — | 1122 /72246 | Scimitar `scm` / Cutlass `9sm` / Ataghan `7sm` |
| 122 | Shamshir `9sb` | exceptional; general; — | 10–24 / — / — | 58 /58 | 23 /35 | 32 /0 | 2; 2/2/2 | 1×3 | -10;  | 100/ | — | 0; — | 1698 /79430 | Sabre `sbr` / Shamshir `9sb` / Elegant Blade `7sb` |
| 123 | Tulwar `9fc` | exceptional; general; — | 16–35 / — / — | 70 /42 | 25 /37 | 32 /0 | 2; 2/2/2 | 1×3 | 20;  | 100/ | — | 0; — | 2349 /107913 | Falchion `flc` / Tulwar `9fc` / Hydra Edge `7fc` |
| 124 | Dimensional Blade `9cr` | exceptional; general; — | 13–35 / — / — | 85 /60 | 25 /37 | 20 /0 | 6; 3/4/6 | 2×3 | ; 1 | 100/ | — | 0; — | 6681 /268197 | Crystal Sword `crs` / Dimensional Blade `9cr` / Phase Blade `7cr` |
| 125 | Battle Sword `9bs` | exceptional; general; — | 16–34 / — / — | 92 /43 | 25 /40 | 32 /0 | 4; 3/4/4 | 2×3 | ;  | 100/ | — | 0; — | 3387 /157980 | Broad Sword `bsd` / Battle Sword `9bs` / Conquest Sword `7bs` |
| 126 | Rune Sword `9ls` | exceptional; general; — | 10–42 / — / — | 103 /79 | 25 /44 | 44 /0 | 4; 3/4/4 | 2×3 | -10; 1 | 100/ | — | 0; — | 4860 /238340 | Long Sword `lsd` / Rune Sword `9ls` / Cryptic Sword `7ls` |
| 127 | Ancient Sword `9wd` | exceptional; general; — | 18–43 / — / — | 127 /88 | 25 /49 | 44 /0 | 3; 3/3/3 | 1×3 | ; 1 | 100/ | — | 0; — | 6291 /335259 | War Sword `wsd` / Ancient Sword `9wd` / Mythical Sword `7wd` |
| 128 | Espadon `92h` | exceptional; general; — | 8–26 / 18–40 / — | 73 /61 | 25 /37 | 44 /0 | 3; 3/3/3 | 1×4 | ; 2 | 100/ | — | 0; — | 2232 /103584 | Two-Handed Sword `2hs` / Espadon `92h` / Legend Sword `72h` |
| 129 | Dacian Falx `9cm` | exceptional; general; — | 13–30 / 26–61 / — | 91 /20 | 25 /42 | 50 /0 | 4; 3/4/4 | 1×4 | 10; 2 | 100/ | — | 0; — | 4086 /195112 | Claymore `clm` / Dacian Falx `9cm` / Highland Blade `7cm` |
| 130 | Tusk Sword `9gs` | exceptional; general; — | 10–37 / 19–58 / — | 104 /71 | 25 /45 | 50 /0 | 4; 3/4/4 | 1×4 | ; 2 | 100/ | — | 0; — | 4677 /235465 | Giant Sword `gis` / Tusk Sword `9gs` / Balrog Blade `7gs` |
| 131 | Gothic Sword `9b9` | exceptional; general; — | 14–40 / 39–60 / — | 113 /20 | 25 /48 | 40 /0 | 4; 3/4/4 | 1×4 | 10; 1 | 100/ | — | 0; — | 6213 /324724 | Bastard Sword `bsw` / Gothic Sword `9b9` / Champion Sword `7b7` |
| 132 | Zweihander `9fb` | exceptional; general; — | 19–35 / 29–54 / — | 125 /94 | 25 /49 | 50 /0 | 5; 3/4/5 | 2×4 | -10; 2 | 100/ | — | 0; — | 7500 /394500 | Flamberge `flb` / Zweihander `9fb` / Colossal Sword `7fb` |
| 133 | Executioner Sword `9gd` | exceptional; general; — | 24–40 / 47–80 / — | 170 /110 | 25 /54 | 50 /0 | 6; 3/4/6 | 2×4 | 10; 2 | 100/ | — | 0; — | 10653 /604762 | Great Sword `gsd` / Executioner Sword `9gd` / Colossus Blade `7gd` |
| 224 | Falcata `7ss` | elite; general; — | 31–59 / — / — | 150 /88 | 42 /56 | 24 /0 | 2; 2/2/2 | 1×3 | ;  | 100/ | — | 0; — | 15680 /908580 | Short Sword `ssd` / Gladius `9ss` / Falcata `7ss` |
| 225 | Ataghan `7sm` | elite; general; — | 26–46 / — / — | 138 /95 | 45 /61 | 22 /0 | 2; 2/2/2 | 1×3 | -20;  | 100/ | — | 0; — | 16103 /1015283 | Scimitar `scm` / Cutlass `9sm` / Ataghan `7sm` |
| 226 | Elegant Blade `7sb` | elite; general; — | 33–45 / — / — | 109 /122 | 47 /63 | 32 /0 | 2; 2/2/2 | 1×3 | -10;  | 100/ | — | 0; — | 22785 /1469455 | Sabre `sbr` / Shamshir `9sb` / Elegant Blade `7sb` |
| 227 | Hydra Edge `7fc` | elite; general; — | 28–68 / — / — | 142 /105 | 51 /69 | 32 /0 | 2; 2/2/2 | 1×3 | 10;  | 100/ | — | 0; — | 18479 /1312051 | Falchion `flc` / Tulwar `9fc` / Hydra Edge `7fc` |
| 228 | Phase Blade `7cr` | elite; general; — | 31–35 / — / — | 25 /136 | 54 /73 | 0 /1 | 6; 3/4/6 | 2×3 | -30; 1 | 100/ | — | 0; — | 25680 /1913640 | Crystal Sword `crs` / Dimensional Blade `9cr` / Phase Blade `7cr` |
| 229 | Conquest Sword `7bs` | elite; general; — | 37–53 / — / — | 142 /112 | 58 /78 | 32 /0 | 4; 3/4/4 | 2×3 | ;  | 100/ | — | 0; — | 19044 /1526932 | Broad Sword `bsd` / Battle Sword `9bs` / Conquest Sword `7bs` |
| 230 | Cryptic Sword `7ls` | elite; general; — | 5–77 / — / — | 99 /109 | 61 /82 | 44 /0 | 4; 3/4/4 | 2×3 | -10; 1 | 100/ | — | 0; — | 14306 /1216592 | Long Sword `lsd` / Rune Sword `9ls` / Cryptic Sword `7ls` |
| 231 | Mythical Sword `7wd` | elite; general; — | 40–50 / — / — | 147 /124 | 66 /85 | 44 /0 | 3; 3/3/3 | 1×3 | ; 1 | 100/ | — | 0; — | 20187 /1760895 | War Sword `wsd` / Ancient Sword `9wd` / Mythical Sword `7wd` |
| 232 | Legend Sword `72h` | elite; general; — | 22–56 / 50–94 / — | 175 /100 | 44 /59 | 44 /0 | 3; 3/3/3 | 1×4 | -15; 2 | 100/ | — | 0; — | 23789 /1435551 | Two-Handed Sword `2hs` / Espadon `92h` / Legend Sword `72h` |
| 233 | Highland Blade `7cm` | elite; general; — | 22–62 / 67–96 / — | 171 /104 | 49 /66 | 50 /0 | 4; 3/4/4 | 1×4 | -5; 2 | 100/ | — | 0; — | 14391 /985306 | Claymore `clm` / Dacian Falx `9cm` / Highland Blade `7cm` |
| 234 | Balrog Blade `7gs` | elite; general; — | 15–75 / 55–118 / — | 185 /87 | 53 /71 | 50 /0 | 4; 3/4/4 | 1×4 | ; 2 | 100/ | — | 0; — | 16331 /1197501 | Giant Sword `gis` / Tusk Sword `9gs` / Balrog Blade `7gs` |
| 235 | Champion Sword `7b7` | elite; general; — | 24–54 / 71–83 / — | 163 /103 | 57 /77 | 40 /0 | 4; 3/4/4 | 1×4 | -10; 2 | 100/ | — | 0; — | 19939 /1576303 | Bastard Sword `bsw` / Gothic Sword `9b9` / Champion Sword `7b7` |
| 236 | Colossal Sword `7fb` | elite; general; — | 26–70 / 61–121 / — | 182 /95 | 60 /80 | 50 /0 | 5; 3/4/5 | 2×4 | 10; 2 | 100/ | — | 0; — | 24800 /2026500 | Flamberge `flb` / Zweihander `9fb` / Colossal Sword `7fb` |
| 237 | Colossus Blade `7gd` | elite; general; — | 25–65 / 58–115 / — | 189 /110 | 63 /85 | 50 /0 | 6; 3/4/6 | 2×4 | 5; 2 | 100/ | — | 0; — | 22259 /1937015 | Great Sword `gsd` / Executioner Sword `9gd` / Colossus Blade `7gd` |

### A.W. Knife (`knif`)

| Line | Name / code | Tier; class; type2 | 1H /2H /throw damage | Str /Dex req | Req lvl /qlvl | Dur /noDur | Max sockets; caps | W×H | WSM; rangeadder | Str/Dex scaling | Stack max | Magic lvl; automod group | Base cost /gamble cost | Normal /exceptional /elite |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 41 | Dagger `dgr` | normal; general; — | 1–4 / — / — | 0 /0 | 0 /3 | 16 /0 | 1; 1/1/1 | 1×2 | -20;  | 75/75 | — | 0; — | 60 /4180 | Dagger `dgr` / Poignard `9dg` / Bone Knife `7dg` |
| 42 | Dirk `dir` | normal; general; — | 3–9 / — / — | 0 /25 | 0 /9 | 20 /0 | 1; 1/1/1 | 1×2 | ;  | 75/75 | — | 0; — | 532 /11788 | Dirk `dir` / Rondel `9di` / Mithral Point `7di` |
| 43 | Kris [source: Kriss] `kri` | normal; general; — | 2–11 / — / — | 0 /45 | 0 /17 | 24 /0 | 3; 2/3/3 | 1×3 | -20;  | 75/75 | — | 0; — | 1227 /31859 | Kris `kri` / Cinquedeas `9kr` / Fanged Knife `7kr` |
| 44 | Blade `bld` | normal; general; — | 4–15 / — / — | 35 /51 | 0 /23 | 24 /0 | 2; 2/2/2 | 1×3 | -10;  | 75/75 | — | 0; — | 1764 /54572 | Blade `bld` / Stiletto `9bl` / Legend Spike `7bl` |
| 134 | Poignard `9dg` | exceptional; general; — | 6–18 / — / — | 25 /0 | 19 /31 | 16 /0 | 1; 1/1/1 | 1×2 | -20;  | 75/75 | — | 0; — | 480 /32880 | Dagger `dgr` / Poignard `9dg` / Bone Knife `7dg` |
| 135 | Rondel `9di` | exceptional; general; — | 10–26 / — / — | 25 /58 | 24 /36 | 20 /0 | 1; 1/1/1 | 1×2 | ;  | 75/75 | — | 0; — | 1896 /88756 | Dirk `dir` / Rondel `9di` / Mithral Point `7di` |
| 136 | Cinquedeas `9kr` | exceptional; general; — | 15–31 / — / — | 25 /88 | 25 /42 | 24 /0 | 3; 2/3/3 | 1×3 | -20;  | 75/75 | — | 0; — | 3981 /190702 | Kris `kri` / Cinquedeas `9kr` / Fanged Knife `7kr` |
| 137 | Stiletto [source: Stilleto] `9bl` | exceptional; general; — | 19–36 / — / — | 47 /97 | 25 /46 | 24 /0 | 2; 2/2/2 | 1×3 | -10;  | 75/75 | — | 0; — | 5592 /282732 | Blade `bld` / Stiletto `9bl` / Legend Spike `7bl` |
| 238 | Bone Knife `7dg` | elite; general; — | 23–49 / — / — | 38 /75 | 43 /58 | 26 /0 | 1; 1/1/1 | 1×2 | -20;  | 75/75 | — | 0; — | 12429 /752382 | Dagger `dgr` / Poignard `9dg` / Bone Knife `7dg` |
| 239 | Mithral Point `7di` | elite; general; — | 37–53 / — / — | 55 /98 | 52 /70 | 55 /0 | 1; 1/1/1 | 1×2 | ;  | 75/75 | — | 0; — | 17988 /1296660 | Dirk `dir` / Rondel `9di` / Mithral Point `7di` |
| 240 | Fanged Knife `7kr` | elite; general; — | 15–57 / — / — | 42 /86 | 62 /83 | 36 /0 | 3; 2/3/3 | 1×3 | -20;  | 75/75 | — | 0; — | 13729 /1183507 | Kris `kri` / Cinquedeas `9kr` / Fanged Knife `7kr` |
| 241 | Legend Spike `7bl` | elite; general; — | 31–47 / — / — | 65 /67 | 66 /85 | 47 /0 | 2; 2/2/2 | 1×3 | -10;  | 75/75 | — | 0; — | 16076 /1411460 | Blade `bld` / Stiletto `9bl` / Legend Spike `7bl` |

### A.W. Throwing Knife (`tkni`)

| Line | Name / code | Tier; class; type2 | 1H /2H /throw damage | Str /Dex req | Req lvl /qlvl | Dur /noDur | Max sockets; caps | W×H | WSM; rangeadder | Str/Dex scaling | Stack max | Magic lvl; automod group | Base cost /gamble cost | Normal /exceptional /elite |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 45 | Throwing Knife `tkf` | normal; general; — | 2–3 / — / 4–9 | 0 /21 | 0 /2 | 4 /0 | ; 0/0/0 | 1×2 | ;  | 75/75 | 160 | 0; — | 6 /3512 | Throwing Knife `tkf` / Battle Dart `9tk` / Flying Knife `7tk` |
| 47 | Balanced Knife `bkf` | normal; general; — | 1–8 / — / 6–11 | 0 /51 | 0 /13 | 8 /0 | ; 0/0/0 | 1×2 | -20;  | 75/75 | 160 | 0; — | 15 /9195 | Balanced Knife `bkf` / War Dart `9bk` / Winged Knife `7bk` |
| 138 | Battle Dart `9tk` | exceptional; general; — | 8–16 / — / 11–24 | 25 /52 | 19 /31 | 6 /0 | ; 0/0/0 | 1×2 | ;  | 75/75 | 160 | 0; — | 80 /20480 | Throwing Knife `tkf` / Battle Dart `9tk` / Flying Knife `7tk` |
| 140 | War Dart `9bk` | exceptional; general; — | 6–24 / — / 14–27 | 25 /97 | 25 /39 | 20 /0 | ; 0/0/0 | 1×2 | -20;  | 75/75 | 160 | 0; — | 100 /25900 | Balanced Knife `bkf` / War Dart `9bk` / Winged Knife `7bk` |
| 242 | Flying Knife `7tk` | elite; general; — | 23–54 / — / 23–54 | 48 /141 | 48 /64 | 6 /0 | ; 0/0/0 | 1×2 | ;  | 75/75 | 200 | 0; — | 215 /48260 | Throwing Knife `tkf` / Battle Dart `9tk` / Flying Knife `7tk` |
| 244 | Winged Knife `7bk` | elite; general; — | 27–35 / — / 23–39 | 45 /142 | 57 /77 | 20 /0 | ; 0/0/0 | 1×2 | -20;  | 75/75 | 200 | 0; — | 248 /60096 | Balanced Knife `bkf` / War Dart `9bk` / Winged Knife `7bk` |

### A.W. Throwing Axe (`taxe`)

| Line | Name / code | Tier; class; type2 | 1H /2H /throw damage | Str /Dex req | Req lvl /qlvl | Dur /noDur | Max sockets; caps | W×H | WSM; rangeadder | Str/Dex scaling | Stack max | Magic lvl; automod group | Base cost /gamble cost | Normal /exceptional /elite |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 46 | Throwing Axe `tax` | normal; general; — | 4–7 / — / 8–12 | 0 /40 | 0 /7 | 6 /0 | ; 0/0/0 | 1×2 | 10;  | 75/75 | 130 | 0; — | 11 /6077 | Throwing Axe `tax` / Francisca `9ta` / Flying Axe `7ta` |
| 48 | Balanced Axe `bal` | normal; general; — | 5–10 / — / 12–15 | 0 /57 | 0 /16 | 10 /0 | ; 0/0/0 | 2×3 | -10;  | 75/75 | 130 | 0; — | 35 /11060 | Balanced Axe `bal` / Hurlbat `9b8` / Winged Axe `7b8` |
| 139 | Francisca `9ta` | exceptional; general; — | 11–22 / — / 18–33 | 25 /80 | 22 /34 | 15 /0 | ; 0/0/0 | 1×2 | 10;  | 75/75 | 130 | 0; — | 90 /22560 | Throwing Axe `tax` / Francisca `9ta` / Flying Axe `7ta` |
| 141 | Hurlbat `9b8` | exceptional; general; — | 13–27 / — / 24–34 | 25 /106 | 25 /41 | 16 /0 | ; 0/0/0 | 2×3 | -10;  | 75/75 | 130 | 0; — | 110 /27510 | Balanced Axe `bal` / Hurlbat `9b8` / Winged Axe `7b8` |
| 243 | Flying Axe `7ta` | elite; general; — | 17–65 / — / 15–66 | 88 /108 | 42 /56 | 15 /0 | ; 0/0/0 | 1×2 | 10;  | 75/75 | 180 | 0; — | 230 /43380 | Throwing Axe `tax` / Francisca `9ta` / Flying Axe `7ta` |
| 245 | Winged Axe `7b8` | elite; general; — | 11–56 / — / 7–60 | 96 /122 | 60 /80 | 16 /0 | ; 0/0/0 | 2×3 | -10;  | 75/75 | 180 | 0; — | 251 /62580 | Balanced Axe `bal` / Hurlbat `9b8` / Winged Axe `7b8` |

### A.W. Javelin (`jave`)

| Line | Name / code | Tier; class; type2 | 1H /2H /throw damage | Str /Dex req | Req lvl /qlvl | Dur /noDur | Max sockets; caps | W×H | WSM; rangeadder | Str/Dex scaling | Stack max | Magic lvl; automod group | Base cost /gamble cost | Normal /exceptional /elite |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 49 | Javelin `jav` | normal; general; — | 1–5 / — / 6–14 | 0 /0 | 0 /1 | 2 /0 | ; 0/0/0 | 1×3 | -10; 2 | 75/75 | 60 | 0; — | 5 /3005 | Javelin `jav` / War Javelin `9ja` / Hyperion Javelin `7ja` |
| 50 | Pilum `pil` | normal; general; — | 4–9 / — / 7–20 | 0 /45 | 0 /10 | 3 /0 | ; 0/0/0 | 1×3 | ; 2 | 75/75 | 50 | 0; — | 18 /7680 | Pilum `pil` / Great Pilum `9pi` / Stygian Pilum `7pi` |
| 51 | Short Spear `ssp` | normal; general; — | 2–13 / — / 10–22 | 40 /40 | 0 /15 | 4 /0 | ; 0/0/0 | 1×3 | 10; 2 | 75/75 | 40 | 0; — | 24 /10360 | Short Spear `ssp` / Simbilan `9s9` / Balrog Spear `7s7` |
| 52 | Glaive `glv` | normal; general; — | 5–17 / — / 16–22 | 52 /35 | 0 /23 | 5 /0 | ; 0/0/0 | 1×4 | 20; 2 | 75/75 | 40 | 0; — | 36 /14828 | Glaive `glv` / Spiculum `9gl` / Ghost Glaive `7gl` |
| 53 | Throwing Spear `tsp` | normal; general; — | 5–15 / — / 12–30 | 0 /65 | 0 /29 | 6 /0 | ; 0/0/0 | 1×4 | -10; 2 | 75/75 | 80 | 0; — | 48 /18392 | Throwing Spear `tsp` / Harpoon `9ts` / Winged Harpoon `7ts` |
| 142 | War Javelin `9ja` | exceptional; general; — | 6–19 / — / 14–32 | 25 /25 | 18 /30 | 10 /0 | ; 0/0/0 | 1×3 | -10; 2 | 75/75 | 60 | 0; — | 120 /21100 | Javelin `jav` / War Javelin `9ja` / Hyperion Javelin `7ja` |
| 143 | Great Pilum `9pi` | exceptional; general; — | 11–26 / — / 16–42 | 25 /88 | 25 /37 | 12 /0 | ; 0/0/0 | 1×3 | ; 2 | 75/75 | 50 | 0; — | 125 /25625 | Pilum `pil` / Great Pilum `9pi` / Stygian Pilum `7pi` |
| 144 | Simbilan `9s9` | exceptional; general; — | 8–32 / — / 27–50 | 80 /80 | 25 /40 | 14 /0 | ; 0/0/0 | 1×3 | 10; 2 | 75/75 | 40 | 0; — | 135 /27900 | Short Spear `ssp` / Simbilan `9s9` / Balrog Spear `7s7` |
| 145 | Spiculum `9gl` | exceptional; general; — | 13–38 / — / 32–60 | 98 /73 | 25 /46 | 16 /0 | ; 0/0/0 | 1×4 | 20; 2 | 75/75 | 20 | 0; — | 145 /32170 | Glaive `glv` / Spiculum `9gl` / Ghost Glaive `7gl` |
| 146 | Harpoon `9ts` | exceptional; general; — | 13–35 / — / 18–54 | 25 /118 | 25 /51 | 18 /0 | ; 0/0/0 | 1×4 | -10; 2 | 75/75 | 80 | 0; — | 150 /35650 | Throwing Spear `tsp` / Harpoon `9ts` / Winged Harpoon `7ts` |
| 246 | Hyperion Javelin `7ja` | elite; general; — | 21–57 / — / 28–55 | 98 /123 | 40 /54 | 10 /0 | ; 0/0/0 | 1×3 | -10; 2 | 75/75 | 100 | 0; — | 211 /40894 | Javelin `jav` / War Javelin `9ja` / Hyperion Javelin `7ja` |
| 247 | Stygian Pilum `7pi` | elite; general; — | 14–64 / — / 21–75 | 118 /112 | 46 /62 | 12 /0 | ; 0/0/0 | 1×3 | ; 2 | 75/75 | 90 | 0; — | 220 /47140 | Pilum `pil` / Great Pilum `9pi` / Stygian Pilum `7pi` |
| 248 | Balrog Spear `7s7` | elite; general; — | 33–63 / — / 40–62 | 127 /95 | 53 /71 | 14 /0 | ; 0/0/0 | 1×3 | 10; 2 | 75/75 | 80 | 0; — | 232 /54472 | Short Spear `ssp` / Simbilan `9s9` / Balrog Spear `7s7` |
| 249 | Ghost Glaive `7gl` | elite; general; — | 19–60 / — / 30–85 | 89 /137 | 59 /79 | 16 /0 | ; 0/0/0 | 1×4 | 20; 2 | 75/75 | 75 | 0; — | 241 /61039 | Glaive `glv` / Spiculum `9gl` / Ghost Glaive `7gl` |
| 250 | Winged Harpoon `7ts` | elite; general; — | 27–35 / — / 11–77 | 76 /145 | 65 /85 | 18 /0 | ; 0/0/0 | 1×4 | -10; 2 | 75/75 | 80 | 0; — | 199 /61915 | Throwing Spear `tsp` / Harpoon `9ts` / Winged Harpoon `7ts` |

### A.W. Spear (`spea`)

| Line | Name / code | Tier; class; type2 | 1H /2H /throw damage | Str /Dex req | Req lvl /qlvl | Dur /noDur | Max sockets; caps | W×H | WSM; rangeadder | Str/Dex scaling | Stack max | Magic lvl; automod group | Base cost /gamble cost | Normal /exceptional /elite |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 54 | Spear `spr` | normal; general; — | — / 3–15 / — | 0 /20 | 0 /5 | 30 /0 | 3; 3/3/3 | 2×4 | -10; 3 | 100/ | — | 0; — | 300 /6500 | Spear `spr` / War Spear `9sr` / Hyperion Spear `7sr` |
| 55 | Trident `tri` | normal; general; — | — / 9–15 / — | 38 /24 | 0 /9 | 35 /0 | 4; 3/4/4 | 2×4 | ; 3 | 100/ | — | 0; — | 683 /13147 | Trident `tri` / Fuscina `9tr` / Stygian Pike `7tr` |
| 56 | Brandistock `brn` | normal; general; — | — / 7–17 / — | 40 /50 | 0 /16 | 28 /0 | 5; 3/4/5 | 2×4 | -20; 4 | 100/ | — | 0; — | 1162 /29092 | Brandistock `brn` / War Fork `9br` / Mancatcher `7br` |
| 57 | Spetum `spt` | normal; general; — | — / 15–23 / — | 54 /35 | 0 /20 | 28 /0 | 6; 3/4/6 | 2×4 | ; 4 | 100/ | — | 0; — | 1672 /45940 | Spetum `spt` / Yari `9st` / Ghost Spear `7st` |
| 58 | Pike `pik` | normal; general; — | — / 14–63 / — | 60 /45 | 0 /24 | 25 /0 | 6; 3/4/6 | 2×4 | 20; 4 | 100/ | — | 0; — | 2023 /63052 | Pike `pik` / Lance `9p9` / War Pike `7p7` |
| 147 | War Spear `9sr` | exceptional; general; — | — / 10–37 / — | 25 /25 | 21 /33 | 30 /0 | 3; 3/3/3 | 2×4 | -10; 3 | 100/ | — | 0; — | 1200 /58600 | Spear `spr` / War Spear `9sr` / Hyperion Spear `7sr` |
| 148 | Fuscina `9tr` | exceptional; general; — | — / 19–37 / — | 77 /25 | 24 /36 | 35 /0 | 4; 3/4/4 | 2×4 | ; 3 | 100/ | — | 0; — | 2349 /105064 | Trident `tri` / Fuscina `9tr` / Stygian Pike `7tr` |
| 149 | War Fork `9br` | exceptional; general; — | — / 16–40 / — | 80 /95 | 25 /41 | 28 /0 | 5; 3/4/5 | 2×4 | -20; 4 | 100/ | — | 0; — | 3786 /178226 | Brandistock `brn` / War Fork `9br` / Mancatcher `7br` |
| 150 | Yari `9st` | exceptional; general; — | — / 29–59 / — | 101 /0 | 25 /44 | 28 /0 | 6; 3/4/6 | 2×4 | ; 4 | 100/ | — | 0; — | 5316 /258404 | Spetum `spt` / Yari `9st` / Ghost Spear `7st` |
| 151 | Lance `9p9` | exceptional; general; — | — / 27–114 / — | 110 /88 | 25 /47 | 25 /0 | 6; 3/4/6 | 2×4 | 20; 4 | 100/ | — | 0; — | 6369 /325343 | Pike `pik` / Lance `9p9` / War Pike `7p7` |
| 251 | Hyperion Spear `7sr` | elite; general; — | — / 35–119 / — | 155 /120 | 43 /58 | 30 /0 | 3; 3/3/3 | 2×4 | -10; 3 | 100/ | — | 0; — | 15900 /953700 | Spear `spr` / War Spear `9sr` / Hyperion Spear `7sr` |
| 252 | Stygian Pike `7tr` | elite; general; — | — / 29–144 / — | 168 /97 | 49 /66 | 35 /0 | 4; 3/4/4 | 2×4 | ; 3 | 100/ | — | 0; — | 17347 /1180402 | Trident `tri` / Fuscina `9tr` / Stygian Pike `7tr` |
| 253 | Mancatcher `7br` | elite; general; — | — / 42–92 / — | 132 /134 | 55 /74 | 28 /0 | 5; 3/4/5 | 2×4 | -20; 4 | 100/ | — | 0; — | 14658 /1124192 | Brandistock `brn` / War Fork `9br` / Mancatcher `7br` |
| 254 | Ghost Spear `7st` | elite; general; — | — / 18–155 / — | 122 /163 | 62 /83 | 28 /0 | 6; 3/4/6 | 2×4 | ; 4 | 100/ | — | 0; — | 17248 /1475584 | Spetum `spt` / Yari `9st` / Ghost Spear `7st` |
| 255 | War Pike `7p7` | elite; general; — | — / 33–178 / — | 165 /106 | 66 /85 | 25 /0 | 6; 3/4/6 | 2×4 | 20; 4 | 100/ | — | 0; — | 16070 /1410950 | Pike `pik` / Lance `9p9` / War Pike `7p7` |

### A.W. Polearm (`pole`)

| Line | Name / code | Tier; class; type2 | 1H /2H /throw damage | Str /Dex req | Req lvl /qlvl | Dur /noDur | Max sockets; caps | W×H | WSM; rangeadder | Str/Dex scaling | Stack max | Magic lvl; automod group | Base cost /gamble cost | Normal /exceptional /elite |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 59 | Bardiche `bar` | normal; general; — | — / 1–27 / — | 40 /0 | 0 /5 | 50 /0 | 3; 3/3/3 | 2×4 | 10; 2 | 100/ | — | 0; — | 302 /6510 | Bardiche `bar` / Lochaber Axe `9b7` / Ogre Axe `7o7` |
| 60 | Voulge `vou` | normal; general; — | — / 6–21 / — | 50 /0 | 0 /11 | 50 /0 | 4; 3/4/4 | 2×4 | ; 2 | 100/ | — | 0; — | 611 /14721 | Voulge `vou` / Bill `9vo` / Colossus Voulge `7vo` |
| 61 | Scythe `scy` | normal; general; — | — / 8–20 / — | 41 /41 | 0 /15 | 65 /0 | 5; 3/4/5 | 2×4 | -10; 1 | 100/ | — | 0; — | 848 /22720 | Scythe `scy` / Battle Scythe `9s8` / Thresher `7s8` |
| 62 | Poleaxe `pax` | normal; general; — | — / 18–39 / — | 62 /0 | 0 /21 | 65 /0 | 5; 3/4/5 | 2×4 | 10; 3 | 100/ | — | 0; — | 1701 /48721 | Poleaxe `pax` / Partizan `9pa` / Cryptic Axe `7pa` |
| 63 | Halberd `hal` | normal; general; — | — / 12–45 / — | 75 /47 | 0 /29 | 55 /0 | 6; 3/4/6 | 2×4 | ; 4 | 100/ | — | 0; — | 2706 /95474 | Halberd `hal` / Bec-de-Corbin `9h9` / Great Poleaxe `7h7` |
| 64 | War Scythe `wsc` | normal; general; — | — / 15–36 / — | 80 /80 | 0 /34 | 55 /0 | 6; 3/4/6 | 2×4 | -10; 4 | 100/ | — | 0; — | 3388 /134692 | War Scythe `wsc` / Grim Scythe `9wc` / Giant Thresher `7wc` |
| 152 | Lochaber Axe `9b7` | exceptional; general; — | — / 6–58 / — | 80 /0 | 21 /33 | 50 /0 | 3; 3/3/3 | 2×4 | 10; 2 | 100/ | — | 0; — | 1206 /58798 | Bardiche `bar` / Lochaber Axe `9b7` / Ogre Axe `7o7` |
| 153 | Bill `9vo` | exceptional; general; — | — / 14–53 / — | 95 /0 | 25 /37 | 50 /0 | 4; 3/4/4 | 2×4 | ; 2 | 100/ | — | 0; — | 2133 /99921 | Voulge `vou` / Bill `9vo` / Colossus Voulge `7vo` |
| 154 | Battle Scythe `9s8` | exceptional; general; — | — / 18–45 / — | 82 /82 | 25 /40 | 65 /0 | 5; 3/4/5 | 2×4 | -10; 1 | 100/ | — | 0; — | 2844 /136260 | Scythe `scy` / Battle Scythe `9s8` / Thresher `7s8` |
| 155 | Partizan `9pa` | exceptional; general; — | — / 34–75 / — | 113 /67 | 23 /35 | 65 /0 | 5; 3/4/5 | 2×4 | 10; 3 | 100/ | — | 0; — | 5403 /209105 | Poleaxe `pax` / Partizan `9pa` / Cryptic Axe `7pa` |
| 156 | Bec-de-Corbin `9h9` | exceptional; general; — | — / 13–85 / — | 133 /91 | 25 /51 | 55 /0 | 6; 3/4/6 | 2×4 | ; 4 | 100/ | — | 0; — | 8418 /457318 | Halberd `hal` / Bec-de-Corbin `9h9` / Great Poleaxe `7h7` |
| 157 | Grim Scythe `9wc` | exceptional; general; — | — / 30–70 / — | 140 /140 | 25 /55 | 55 /0 | 6; 3/4/6 | 2×4 | -10; 4 | 100/ | — | 0; — | 10464 /605520 | War Scythe `wsc` / Grim Scythe `9wc` / Giant Thresher `7wc` |
| 256 | Ogre Axe `7o7` | elite; general; — | — / 28–145 / — | 195 /75 | 45 /60 | 50 /0 | 3; 3/3/3 | 2×4 | ; 2 | 100/ | — | 0; — | 9871 /624760 | Bardiche `bar` / Lochaber Axe `9b7` / Ogre Axe `7o7` |
| 257 | Colossus Voulge `7vo` | elite; general; — | — / 17–165 / — | 210 /55 | 48 /64 | 50 /0 | 4; 3/4/4 | 2×4 | 10; 2 | 100/ | — | 0; — | 12822 /855108 | Voulge `vou` / Bill `9vo` / Colossus Voulge `7vo` |
| 258 | Thresher `7s8` | elite; general; — | — / 12–141 / — | 152 /118 | 53 /71 | 65 /0 | 5; 3/4/5 | 2×4 | -10; 1 | 100/ | — | 0; — | 11086 /825106 | Scythe `scy` / Battle Scythe `9s8` / Thresher `7s8` |
| 259 | Cryptic Axe `7pa` | elite; general; — | — / 33–150 / — | 165 /103 | 59 /79 | 65 /0 | 5; 3/4/5 | 2×4 | 10; 3 | 100/ | — | 0; — | 16509 /1346211 | Poleaxe `pax` / Partizan `9pa` / Cryptic Axe `7pa` |
| 260 | Great Poleaxe `7h7` | elite; general; — | — / 46–127 / — | 179 /99 | 63 /84 | 55 /0 | 6; 3/4/6 | 2×4 | ; 4 | 100/ | — | 0; — | 21554 /1855036 | Halberd `hal` / Bec-de-Corbin `9h9` / Great Poleaxe `7h7` |
| 261 | Giant Thresher `7wc` | elite; general; — | — / 40–114 / — | 188 /140 | 66 /85 | 55 /0 | 6; 3/4/6 | 2×4 | -10; 4 | 100/ | — | 0; — | 17692 /1548820 | War Scythe `wsc` / Grim Scythe `9wc` / Giant Thresher `7wc` |

### A.W. Staff (`staf`)

| Line | Name / code | Tier; class; type2 | 1H /2H /throw damage | Str /Dex req | Req lvl /qlvl | Dur /noDur | Max sockets; caps | W×H | WSM; rangeadder | Str/Dex scaling | Stack max | Magic lvl; automod group | Base cost /gamble cost | Normal /exceptional /elite |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 65 | Short Staff `sst` | normal; general; — | — / 1–5 / — | 0 /0 | 0 /1 | 20 /0 | 2; 2/2/2 | 1×3 | -10; 1 | 100/ | — | 1; — | 168 /3168 | Short Staff `sst` / Jo Staff `8ss` / Walking Stick `6ss` |
| 66 | Long Staff `lst` | normal; general; — | — / 2–8 / — | 0 /0 | 0 /8 | 30 /0 | 3; 3/3/3 | 1×4 | ; 1 | 100/ | — | 1; — | 463 /10204 | Long Staff `lst` / Quarterstaff `8ls` / Stalagmite `6ls` |
| 67 | Gnarled Staff `cst` | normal; general; — | — / 4–12 / — | 0 /0 | 0 /12 | 35 /0 | 4; 4/4/4 | 1×4 | 10; 1 | 100/ | — | 1; — | 766 /17692 | Gnarled Staff `cst` / Cedar Staff `8cs` / Elder Staff `6cs` |
| 68 | Battle Staff `bst` | normal; general; — | — / 6–13 / — | 0 /0 | 0 /17 | 40 /0 | 4; 4/4/4 | 1×4 | ; 1 | 100/ | — | 1; — | 1223 /31791 | Battle Staff `bst` / Gothic Staff `8bs` / Shillelah `6bs` |
| 69 | War Staff `wst` | normal; general; — | — / 12–28 / — | 0 /0 | 0 /24 | 50 /0 | 6; 5/6/6 | 2×4 | 20; 1 | 100/ | — | 1; — | 1985 /62140 | War Staff `wst` / Rune Staff `8ws` / Archon Staff `6ws` |
| 158 | Jo Staff `8ss` | exceptional; general; — | — / 6–21 / — | 25 /0 | 18 /30 | 20 /0 | 2; 2/2/2 | 1×3 | -10; 1 | 100/ | — | 1; — | 804 /41620 | Short Staff `sst` / Jo Staff `8ss` / Walking Stick `6ss` |
| 159 | Quarterstaff `8ls` | exceptional; general; — | — / 8–26 / — | 25 /0 | 23 /35 | 30 /0 | 3; 3/3/3 | 1×4 | ; 1 | 100/ | — | 1; — | 1689 /79115 | Long Staff `lst` / Quarterstaff `8ls` / Stalagmite `6ls` |
| 160 | Cedar Staff `8cs` | exceptional; general; — | — / 11–32 / — | 25 /0 | 25 /38 | 35 /0 | 4; 4/4/4 | 1×4 | 10; 1 | 100/ | — | 1; — | 2598 /120224 | Gnarled Staff `cst` / Cedar Staff `8cs` / Elder Staff `6cs` |
| 161 | Gothic Staff `8bs` | exceptional; general; — | — / 14–34 / — | 25 /0 | 25 /42 | 40 /0 | 4; 4/4/4 | 1×4 | ; 1 | 100/ | — | 1; — | 3969 /190198 | Battle Staff `bst` / Gothic Staff `8bs` / Shillelah `6bs` |
| 162 | Rune Staff `8ws` | exceptional; general; — | — / 24–58 / — | 25 /0 | 25 /47 | 50 /0 | 6; 5/6/6 | 2×4 | 20; 1 | 100/ | — | 1; — | 6255 /319985 | War Staff `wst` / Rune Staff `8ws` / Archon Staff `6ws` |
| 262 | Walking Stick `6ss` | elite; general; — | — / 69–85 / — | 25 /0 | 43 /58 | 20 /0 | 2; 2/2/2 | 1×3 | -10; 1 | 100/ | — | 1; — | 8154 /504432 | Short Staff `sst` / Jo Staff `8ss` / Walking Stick `6ss` |
| 263 | Stalagmite `6ls` | elite; general; — | — / 75–107 / — | 63 /35 | 49 /66 | 30 /0 | 3; 3/3/3 | 1×4 | 10; 1 | 100/ | — | 1; — | 5367 /389722 | Long Staff `lst` / Quarterstaff `8ls` / Stalagmite `6ls` |
| 264 | Elder Staff `6cs` | elite; general; — | — / 80–93 / — | 44 /37 | 55 /74 | 35 /0 | 4; 4/4/4 | 1×4 | ; 1 | 100/ | — | 1; — | 9048 /709052 | Gnarled Staff `cst` / Cedar Staff `8cs` / Elder Staff `6cs` |
| 265 | Shillelah `6bs` | elite; general; — | — / 65–108 / — | 52 /27 | 62 /83 | 40 /0 | 4; 4/4/4 | 1×4 | ; 1 | 100/ | — | 1; — | 7986 /706838 | Battle Staff `bst` / Gothic Staff `8bs` / Shillelah `6bs` |
| 266 | Archon Staff `6ws` | elite; general; — | — / 83–99 / — | 34 /0 | 66 /85 | 26 /0 | 6; 5/6/6 | 2×4 | 10; 1 | 100/ | — | 1; — | 10001 /895085 | War Staff `wst` / Rune Staff `8ws` / Archon Staff `6ws` |

### A.W. Bow (`bow`)

| Line | Name / code | Tier; class; type2 | 1H /2H /throw damage | Str /Dex req | Req lvl /qlvl | Dur /noDur | Max sockets; caps | W×H | WSM; rangeadder | Str/Dex scaling | Stack max | Magic lvl; automod group | Base cost /gamble cost | Normal /exceptional /elite |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 70 | Short Bow `sbw` | normal; general; — | — / 1–4 / — | 0 /15 | 0 /1 | 20 /1 | 3; 3/3/3 | 2×3 | 5;  | /100 | — | 0; — | 100 /3100 | Short Bow `sbw` / Edge Bow `8sb` / Spider Bow `6sb` |
| 71 | Hunter's Bow `hbw` | normal; general; — | — / 2–6 / — | 0 /28 | 0 /5 | 32 /1 | 4; 3/4/4 | 2×3 | -10;  | /100 | — | 0; — | 350 /6750 | Hunter's Bow `hbw` / Razor Bow `8hb` / Blade Bow `6hb` |
| 72 | Long Bow `lbw` | normal; general; — | — / 3–10 / — | 22 /19 | 0 /8 | 28 /1 | 5; 3/4/5 | 2×4 | ;  | /100 | — | 0; — | 490 /10420 | Long Bow `lbw` / Cedar Bow `8lb` / Shadow Bow `6lb` |
| 73 | Composite Bow `cbw` | normal; general; — | — / 4–8 / — | 25 /35 | 0 /12 | 36 /1 | 4; 3/4/4 | 2×3 | -10;  | /100 | — | 0; — | 727 /17224 | Composite Bow `cbw` / Double Bow `8cb` / Great Bow `6cb` |
| 74 | Short Battle Bow `sbb` | normal; general; — | — / 5–11 / — | 30 /40 | 0 /18 | 40 /1 | 5; 3/4/5 | 2×3 | ;  | /100 | — | 0; — | 1045 /30310 | Short Battle Bow `sbb` / Short Siege Bow `8s8` / Diamond Bow `6s7` |
| 75 | Long Battle Bow `lbb` | normal; general; — | — / 3–18 / — | 40 /50 | 0 /23 | 44 /1 | 6; 3/4/6 | 2×4 | 10;  | /100 | — | 0; — | 1545 /49535 | Long Battle Bow `lbb` / Long Siege Bow `8l8` / Crusader Bow `6l7` |
| 76 | Short War Bow `swb` | normal; general; — | — / 6–14 / — | 35 /55 | 0 /27 | 48 /1 | 5; 3/4/5 | 2×3 | ;  | /100 | — | 0; — | 2500 /83500 | Short War Bow `swb` / Rune Bow `8sw` / Ward Bow `6sw` |
| 77 | Long War Bow `lwb` | normal; general; — | — / 3–23 / — | 50 /65 | 0 /31 | 55 /1 | 6; 3/4/6 | 2×4 | 10;  | /100 | — | 0; — | 3575 /128825 | Long War Bow `lwb` / Gothic Bow `8lw` / Hydra Bow `6lw` |
| 163 | Edge Bow `8sb` | exceptional; general; — | — / 6–19 / — | 25 /43 | 18 /30 | 20 /1 | 3; 3/3/3 | 2×3 | 5;  | /100 | — | 0; — | 600 /35500 | Short Bow `sbw` / Edge Bow `8sb` / Spider Bow `6sb` |
| 164 | Razor Bow `8hb` | exceptional; general; — | — / 8–22 / — | 25 /62 | 21 /33 | 32 /1 | 4; 3/4/4 | 2×3 | -10;  | /100 | — | 0; — | 1350 /63550 | Hunter's Bow `hbw` / Razor Bow `8hb` / Blade Bow `6hb` |
| 165 | Cedar Bow `8lb` | exceptional; general; — | — / 10–29 / — | 53 /49 | 23 /35 | 28 /1 | 5; 3/4/5 | 2×4 | ;  | /100 | — | 0; — | 1770 /81950 | Long Bow `lbw` / Cedar Bow `8lb` / Shadow Bow `6lb` |
| 166 | Double Bow `8cb` | exceptional; general; — | — / 11–26 / — | 58 /73 | 25 /39 | 36 /1 | 4; 3/4/4 | 2×3 | -10;  | /100 | — | 0; — | 2481 /118759 | Composite Bow `cbw` / Double Bow `8cb` / Great Bow `6cb` |
| 167 | Short Siege Bow `8s8` | exceptional; general; — | — / 13–30 / — | 65 /80 | 25 /43 | 40 /1 | 5; 3/4/5 | 2×3 | ;  | /100 | — | 0; — | 3435 /171705 | Short Battle Bow `sbb` / Short Siege Bow `8s8` / Diamond Bow `6s7` |
| 168 | Long Siege Bow `8l8` | exceptional; general; — | — / 10–42 / — | 80 /95 | 25 /46 | 44 /1 | 6; 3/4/6 | 2×4 | 10;  | /100 | — | 0; — | 4935 /252510 | Long Battle Bow `lbb` / Long Siege Bow `8l8` / Crusader Bow `6l7` |
| 169 | Rune Bow `8sw` | exceptional; general; — | — / 14–35 / — | 73 /103 | 25 /49 | 48 /1 | 5; 3/4/5 | 2×3 | ;  | /100 | — | 0; — | 7800 /409200 | Short War Bow `swb` / Rune Bow `8sw` / Ward Bow `6sw` |
| 170 | Gothic Bow `8lw` | exceptional; general; — | — / 10–50 / — | 95 /118 | 25 /52 | 55 /1 | 6; 3/4/6 | 2×4 | 10;  | /100 | — | 0; — | 11025 /601800 | Long War Bow `lwb` / Gothic Bow `8lw` / Hydra Bow `6lw` |
| 267 | Spider Bow `6sb` | elite; general; — | — / 23–50 / — | 64 /143 | 41 /55 | 20 /1 | 3; 3/3/3 | 2×3 | 5;  | /100 | — | 0; — | 21091 /1190005 | Short Bow `sbw` / Edge Bow `8sb` / Spider Bow `6sb` |
| 268 | Blade Bow `6hb` | elite; general; — | — / 21–41 / — | 76 /119 | 45 /60 | 32 /1 | 4; 3/4/4 | 2×3 | -10;  | /100 | — | 0; — | 21350 /1313500 | Hunter's Bow `hbw` / Razor Bow `8hb` / Blade Bow `6hb` |
| 269 | Shadow Bow `6lb` | elite; general; — | — / 15–59 / — | 52 /188 | 47 /63 | 28 /1 | 5; 3/4/5 | 2×4 | ;  | /100 | — | 0; — | 25610 /1647430 | Long Bow `lbw` / Cedar Bow `8lb` / Shadow Bow `6lb` |
| 270 | Great Bow `6cb` | elite; general; — | — / 12–52 / — | 121 /107 | 51 /68 | 36 /1 | 4; 3/4/4 | 2×3 | -10;  | /100 | — | 0; — | 17743 /1243024 | Composite Bow `cbw` / Double Bow `8cb` / Great Bow `6cb` |
| 271 | Diamond Bow `6s7` | elite; general; — | — / 33–40 / — | 89 /132 | 54 /72 | 40 /1 | 5; 3/4/5 | 2×3 | ;  | /100 | — | 0; — | 24605 /1810060 | Short Battle Bow `sbb` / Short Siege Bow `8s8` / Diamond Bow `6s7` |
| 272 | Crusader Bow `6l7` | elite; general; — | — / 15–63 / — | 97 /121 | 57 /77 | 44 /1 | 6; 3/4/6 | 2×4 | 10;  | /100 | — | 0; — | 18105 /1435085 | Long Battle Bow `lbb` / Long Siege Bow `8l8` / Crusader Bow `6l7` |
| 273 | Ward Bow `6sw` | elite; general; — | — / 20–53 / — | 72 /146 | 60 /80 | 48 /1 | 5; 3/4/5 | 2×3 | ;  | /100 | — | 0; — | 15042 /1245860 | Short War Bow `swb` / Rune Bow `8sw` / Ward Bow `6sw` |
| 274 | Hydra Bow `6lw` | elite; general; — | — / 10–68 / — | 134 /167 | 63 /85 | 55 /1 | 6; 3/4/6 | 2×4 | 10;  | /100 | — | 0; — | 19375 /1691875 | Long War Bow `lwb` / Gothic Bow `8lw` / Hydra Bow `6lw` |

### A.W. Crossbow (`xbow`)

| Line | Name / code | Tier; class; type2 | 1H /2H /throw damage | Str /Dex req | Req lvl /qlvl | Dur /noDur | Max sockets; caps | W×H | WSM; rangeadder | Str/Dex scaling | Stack max | Magic lvl; automod group | Base cost /gamble cost | Normal /exceptional /elite |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 78 | Light Crossbow `lxb` | normal; general; — | — / 6–9 / — | 21 /27 | 0 /6 | 30 /1 | 3; 3/3/3 | 2×3 | -10;  | /100 | — | 0; — | 803 /10318 | Light Crossbow `lxb` / Arbalest `8lx` / Pellet Bow `6lx` |
| 79 | Crossbow `mxb` | normal; general; — | — / 9–16 / — | 40 /33 | 0 /15 | 40 /1 | 4; 3/4/4 | 2×3 | ;  | /100 | — | 0; — | 2345 /45175 | Crossbow `mxb` / Siege Crossbow `8mx` / Gorgon Crossbow `6mx` |
| 80 | Heavy Crossbow `hxb` | normal; general; — | — / 14–26 / — | 60 /40 | 0 /24 | 50 /1 | 6; 3/4/6 | 2×4 | 10;  | /100 | — | 0; — | 4096 /112804 | Heavy Crossbow `hxb` / Ballista `8hx` / Colossus Crossbow `6hx` |
| 81 | Repeating Crossbow `rxb` | normal; general; — | — / 6–12 / — | 40 /50 | 0 /33 | 40 /1 | 5; 3/4/5 | 2×3 | -40;  | /100 | — | 0; — | 2739 /109387 | Repeating Crossbow `rxb` / Chu-Ko-Nu `8rx` / Demon Crossbow `6rx` |
| 171 | Arbalest `8lx` | exceptional; general; — | — / 14–27 / — | 52 /61 | 22 /34 | 30 /1 | 3; 3/3/3 | 2×3 | -10;  | /100 | — | 0; — | 2709 /111606 | Light Crossbow `lxb` / Arbalest `8lx` / Pellet Bow `6lx` |
| 172 | Siege Crossbow `8mx` | exceptional; general; — | — / 20–42 / — | 80 /70 | 25 /40 | 40 /1 | 4; 3/4/4 | 2×3 | ;  | /100 | — | 0; — | 7335 /315900 | Crossbow `mxb` / Siege Crossbow `8mx` / Gorgon Crossbow `6mx` |
| 173 | Ballista [source: Balista] `8hx` | exceptional; general; — | — / 33–55 / — | 110 /80 | 25 /47 | 50 /1 | 6; 3/4/6 | 2×4 | 10;  | /100 | — | 0; — | 12588 /617636 | Heavy Crossbow `hxb` / Ballista `8hx` / Colossus Crossbow `6hx` |
| 174 | Chu-Ko-Nu `8rx` | exceptional; general; — | — / 14–32 / — | 80 /95 | 25 /54 | 40 /1 | 5; 3/4/5 | 2×3 | -60;  | /100 | — | 0; — | 8517 /489418 | Repeating Crossbow `rxb` / Chu-Ko-Nu `8rx` / Demon Crossbow `6rx` |
| 275 | Pellet Bow `6lx` | elite; general; — | — / 28–73 / — | 83 /155 | 42 /57 | 30 /1 | 3; 3/3/3 | 2×3 | -10;  | /100 | — | 0; — | 19512 /1143184 | Light Crossbow `lxb` / Arbalest `8lx` / Pellet Bow `6lx` |
| 276 | Gorgon Crossbow `6mx` | elite; general; — | — / 25–87 / — | 117 /105 | 50 /67 | 40 /1 | 4; 3/4/4 | 2×3 | ;  | /100 | — | 0; — | 22305 /1530435 | Crossbow `mxb` / Siege Crossbow `8mx` / Gorgon Crossbow `6mx` |
| 277 | Colossus Crossbow `6hx` | elite; general; — | — / 32–91 / — | 163 /77 | 56 /75 | 50 /1 | 6; 3/4/6 | 2×4 | 10;  | /100 | — | 0; — | 26065 /1994875 | Heavy Crossbow `hxb` / Ballista `8hx` / Colossus Crossbow `6hx` |
| 278 | Demon Crossbow `6rx` | elite; general; — | — / 26–40 / — | 141 /98 | 63 /84 | 40 /1 | 5; 3/4/5 | 2×3 | -60;  | /100 | — | 0; — | 25851 /2215984 | Repeating Crossbow `rxb` / Chu-Ko-Nu `8rx` / Demon Crossbow `6rx` |

### A.W. Missile Potion (`tpot`)

| Line | Name / code | Tier; class; type2 | 1H /2H /throw damage | Str /Dex req | Req lvl /qlvl | Dur /noDur | Max sockets; caps | W×H | WSM; rangeadder | Str/Dex scaling | Stack max | Magic lvl; automod group | Base cost /gamble cost | Normal /exceptional /elite |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 82 | Rancid Gas Potion `gps` | consumable; general; — | 0–1 / — / — | 0 /0 | 24 /32 | 2 /1 | ; 0/0/0 | 1×1 | ;  | / | 25 | 0; — | 200 /0 | Rancid Gas Potion `gps` / — / — |
| 83 | Oil Potion `ops` | consumable; general; — | 0–1 / — / — | 0 /0 | 20 /28 | 2 /1 | ; 0/0/0 | 1×1 | ;  | / | 25 | 0; — | 150 /0 | Oil Potion `ops` / — / — |
| 84 | Choking Gas Potion `gpm` | consumable; general; — | 0–1 / — / — | 0 /0 | 16 /20 | 2 /1 | ; 0/0/0 | 1×1 | ;  | / | 25 | 0; — | 120 /0 | Choking Gas Potion `gpm` / — / — |
| 85 | Exploding Potion `opm` | consumable; general; — | 0–1 / — / — | 0 /0 | 12 /16 | 2 /1 | ; 0/0/0 | 1×1 | ;  | / | 25 | 0; — | 80 /0 | Exploding Potion `opm` / — / — |
| 86 | Strangling Gas Potion `gpl` | consumable; general; — | 0–1 / — / — | 0 /0 | 6 /8 | 2 /1 | ; 0/0/0 | 1×1 | ;  | / | 25 | 0; — | 40 /0 | Strangling Gas Potion `gpl` / — / — |
| 87 | Fulminating Potion `opl` | consumable; general; — | 0–1 / — / — | 0 /0 | 0 /4 | 2 /1 | ; 0/0/0 | 1×1 | ;  | / | 25 | 0; — | 24 /0 | Fulminating Potion `opl` / — / — |

### A.W. Hand to Hand (`h2h`)

| Line | Name / code | Tier; class; type2 | 1H /2H /throw damage | Str /Dex req | Req lvl /qlvl | Dur /noDur | Max sockets; caps | W×H | WSM; rangeadder | Str/Dex scaling | Stack max | Magic lvl; automod group | Base cost /gamble cost | Normal /exceptional /elite |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 178 | Katar `ktr` | normal; Assassin; — | 4–7 / — / — | 20 /20 | 0 /1 | 48 /0 | 2; 2/2/2 | 1×3 | -10; 1 | 75/75 | — | 0; — | 72 /3072 | Katar `ktr` / Quhab `9ar` / Suwayyah `7ar` |
| 179 | Wrist Blade `wrb` | normal; Assassin; — | 5–9 / — / — | 33 /33 | 0 /9 | 52 /0 | 2; 2/2/2 | 1×3 | ; 1 | 75/75 | — | 0; — | 220 /8980 | Wrist Blade `wrb` / Wrist Spike `9wb` / Wrist Sword `7wb` |
| 180 | Hatchet Hands `axf` | normal; Assassin; — | 2–15 / — / — | 37 /37 | 0 /12 | 56 /0 | 2; 2/2/2 | 1×3 | 10; 1 | 75/75 | — | 0; — | 466 /14092 | Hatchet Hands `axf` / Fascia `9xf` / War Fist `7xf` |
| 181 | Cestus `ces` | normal; Assassin; — | 7–15 / — / — | 42 /42 | 0 /15 | 72 /0 | 2; 2/2/2 | 1×3 | ; 1 | 75/75 | — | 0; — | 514 /17710 | Cestus `ces` / Hand Scythe `9cs` / Battle Cestus `7cs` |
| 182 | Claws `clw` | normal; Assassin; — | 8–15 / — / — | 46 /46 | 0 /18 | 64 /0 | 3; 2/3/3 | 1×3 | -10; 1 | 75/75 | — | 0; — | 683 /23794 | Claws `clw` / Greater Claws `9lw` / Feral Claws `7lw` |
| 183 | Blade Talons `btl` | normal; Assassin; — | 10–14 / — / — | 50 /50 | 0 /21 | 69 /0 | 3; 2/3/3 | 1×3 | -20; 1 | 75/75 | — | 0; — | 847 /30787 | Blade Talons `btl` / Greater Talons `9tw` / Runic Talons `7tw` |
| 184 | Scissors Katar `skr` | normal; Assassin; — | 9–17 / — / — | 55 /55 | 0 /24 | 68 /0 | 3; 2/3/3 | 1×3 | -10; 1 | 75/75 | — | 0; — | 1029 /39196 | Scissors Katar `skr` / Scissors Quhab `9qr` / Scissors Suwayyah `7qr` |
| 185 | Quhab `9ar` | exceptional; Assassin; — | 11–24 / — / — | 57 /57 | 21 /28 | 48 /0 | 3; 2/3/3 | 1×3 | ; 1 | 75/75 | — | 0; — | 2334 /81852 | Katar `ktr` / Quhab `9ar` / Suwayyah `7ar` |
| 186 | Wrist Spike `9wb` | exceptional; Assassin; — | 13–27 / — / — | 66 /66 | 24 /32 | 56 /0 | 2; 2/2/2 | 1×3 | -10; 1 | 75/75 | — | 0; — | 4203 /152996 | Wrist Blade `wrb` / Wrist Spike `9wb` / Wrist Sword `7wb` |
| 187 | Fascia `9xf` | exceptional; Assassin; — | 8–37 / — / — | 69 /69 | 27 /36 | 64 /0 | 2; 2/2/2 | 1×3 | 10; 1 | 75/75 | — | 0; — | 4203 /171808 | Hatchet Hands `axf` / Fascia `9xf` / War Fist `7xf` |

### A.W. Hand to Hand 2 (`h2h2`)

| Line | Name / code | Tier; class; type2 | 1H /2H /throw damage | Str /Dex req | Req lvl /qlvl | Dur /noDur | Max sockets; caps | W×H | WSM; rangeadder | Str/Dex scaling | Stack max | Magic lvl; automod group | Base cost /gamble cost | Normal /exceptional /elite |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 188 | Hand Scythe `9cs` | exceptional; Assassin; — | 16–37 / — / — | 73 /73 | 30 /41 | 72 /0 | 2; 2/2/2 | 1×3 | -10; 1 | 75/75 | — | 0; — | 2964 /144524 | Cestus `ces` / Hand Scythe `9cs` / Battle Cestus `7cs` |
| 189 | Greater Claws `9lw` | exceptional; Assassin; — | 18–37 / — / — | 76 /76 | 33 /45 | 52 /0 | 3; 2/3/3 | 1×3 | -20; 1 | 75/75 | — | 0; — | 5061 /252745 | Claws `clw` / Greater Claws `9lw` / Feral Claws `7lw` |
| 190 | Greater Talons `9tw` | exceptional; Assassin; — | 21–35 / — / — | 79 /79 | 37 /50 | 69 /0 | 3; 2/3/3 | 1×3 | -30; 1 | 75/75 | — | 0; — | 9291 /492050 | Blade Talons `btl` / Greater Talons `9tw` / Runic Talons `7tw` |
| 191 | Scissors Quhab `9qr` | exceptional; Assassin; — | 19–40 / — / — | 82 /82 | 40 /54 | 68 /0 | 3; 2/3/3 | 1×3 | ; 1 | 75/75 | — | 0; — | 14223 /797542 | Scissors Katar `skr` / Scissors Quhab `9qr` / Scissors Suwayyah `7qr` |
| 192 | Suwayyah `7ar` | elite; Assassin; — | 39–52 / — / — | 99 /99 | 44 /59 | 48 /0 | 3; 2/3/3 | 1×3 | ; 1 | 75/75 | — | 0; — | 16205 /988095 | Katar `ktr` / Quhab `9ar` / Suwayyah `7ar` |
| 193 | Wrist Sword `7wb` | elite; Assassin; — | 34–45 / — / — | 105 /105 | 46 /62 | 56 /0 | 3; 2/3/3 | 1×3 | -10; 1 | 75/75 | — | 0; — | 16996 /1087252 | Wrist Blade `wrb` / Wrist Spike `9wb` / Wrist Sword `7wb` |
| 194 | War Fist `7xf` | elite; Assassin; — | 44–53 / — / — | 108 /108 | 51 /68 | 64 /0 | 2; 2/2/2 | 1×3 | 10; 1 | 75/75 | — | 0; — | 15784 /1109812 | Hatchet Hands `axf` / Fascia `9xf` / War Fist `7xf` |
| 195 | Battle Cestus `7cs` | elite; Assassin; — | 36–42 / — / — | 110 /110 | 54 /73 | 72 /0 | 2; 2/2/2 | 1×3 | -10; 1 | 75/75 | — | 0; — | 15537 /1173201 | Cestus `ces` / Hand Scythe `9cs` / Battle Cestus `7cs` |
| 196 | Feral Claws `7lw` | elite; Assassin; — | 22–53 / — / — | 113 /113 | 58 /78 | 52 /0 | 3; 2/3/3 | 1×3 | -20; 1 | 75/75 | — | 0; — | 16035 /1292230 | Claws `clw` / Greater Claws `9lw` / Feral Claws `7lw` |
| 197 | Runic Talons `7tw` | elite; Assassin; — | 24–44 / — / — | 115 /115 | 60 /81 | 69 /0 | 3; 2/3/3 | 1×3 | -30; 1 | 75/75 | — | 0; — | 17396 /1452076 | Blade Talons `btl` / Greater Talons `9tw` / Runic Talons `7tw` |
| 198 | Scissors Suwayyah `7qr` | elite; Assassin; — | 40–51 / — / — | 118 /118 | 64 /85 | 68 /0 | 3; 2/3/3 | 1×3 | ; 1 | 75/75 | — | 0; — | 18002 /1575170 | Scissors Katar `skr` / Scissors Quhab `9qr` / Scissors Suwayyah `7qr` |

### A.W. Orb (`orb`)

| Line | Name / code | Tier; class; type2 | 1H /2H /throw damage | Str /Dex req | Req lvl /qlvl | Dur /noDur | Max sockets; caps | W×H | WSM; rangeadder | Str/Dex scaling | Stack max | Magic lvl; automod group | Base cost /gamble cost | Normal /exceptional /elite |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 279 | Eagle Orb `ob1` | normal; Sorceress; — | 2–5 / — / — | 0 /0 | 0 /1 | 20 /0 | 4; 2/3/3 | 1×2 | -10;  | 100/ | — | 1; 303 | 168 /3168 | Eagle Orb `ob1` / Glowing Orb `ob6` / Heavenly Stone `obb` |
| 280 | Sacred Globe `ob2` | normal; Sorceress; — | 3–8 / — / — | 0 /0 | 0 /8 | 30 /0 | 4; 2/3/3 | 1×2 | -10;  | 100/ | — | 1; 303 | 463 /10204 | Sacred Globe `ob2` / Crystalline Globe `ob7` / Eldritch Orb `obc` |
| 281 | Smoked Sphere `ob3` | normal; Sorceress; — | 4–10 / — / — | 0 /0 | 8 /12 | 35 /0 | 4; 2/3/3 | 1×2 | ;  | 100/ | — | 1; 303 | 766 /17692 | Smoked Sphere `ob3` / Cloudy Sphere `ob8` / Demon Heart `obd` |
| 282 | Clasped Orb `ob4` | normal; Sorceress; — | 5–12 / — / — | 0 /0 | 13 /17 | 40 /0 | 4; 2/3/3 | 1×2 | ;  | 100/ | — | 1; 303 | 1223 /31791 | Clasped Orb `ob4` / Sparkling Ball `ob9` / Vortex Orb `obe` |
| 283 | Dragon Stone `ob5` | normal; Sorceress; — | 8–18 / — / — | 0 /0 | 18 /24 | 50 /0 | 4; 2/3/3 | 1×3 | 10;  | 100/ | — | 1; 303 | 1985 /62140 | Dragon Stone `ob5` / Swirling Crystal `oba` / Dimensional Shard `obf` |
| 289 | Glowing Orb `ob6` | exceptional; Sorceress; — | 8–21 / — / — | 0 /0 | 24 /32 | 20 /0 | 4; 2/3/3 | 1×2 | -10;  | 100/ | — | 1; 303 | 804 /44228 | Eagle Orb `ob1` / Glowing Orb `ob6` / Heavenly Stone `obb` |
| 290 | Crystalline Globe `ob7` | exceptional; Sorceress; — | 10–26 / — / — | 0 /0 | 27 /37 | 30 /0 | 4; 2/3/3 | 1×2 | -10;  | 100/ | — | 1; 303 | 1689 /83493 | Sacred Globe `ob2` / Crystalline Globe `ob7` / Eldritch Orb `obc` |
| 291 | Cloudy Sphere `ob8` | exceptional; Sorceress; — | 11–29 / — / — | 0 /0 | 30 /41 | 35 /0 | 4; 2/3/3 | 1×2 | ;  | 100/ | — | 1; 303 | 2598 /129518 | Smoked Sphere `ob3` / Cloudy Sphere `ob8` / Demon Heart `obd` |
| 292 | Sparkling Ball `ob9` | exceptional; Sorceress; — | 13–32 / — / — | 0 /0 | 34 /46 | 40 /0 | 4; 2/3/3 | 1×2 | ;  | 100/ | — | 1; 303 | 3969 /208074 | Clasped Orb `ob4` / Sparkling Ball `ob9` / Vortex Orb `obe` |
| 293 | Swirling Crystal `oba` | exceptional; Sorceress; — | 18–42 / — / — | 0 /0 | 37 /50 | 50 /0 | 4; 2/3/3 | 1×3 | 10;  | 100/ | — | 1; 303 | 6255 /340250 | Dragon Stone `ob5` / Swirling Crystal `oba` / Dimensional Shard `obf` |
| 299 | Heavenly Stone `obb` | elite; Sorceress; — | 21–46 / — / — | 0 /0 | 44 /59 | 20 /0 | 4; 2/3/3 | 1×2 | -10;  | 100/ | — | 1; 303 | 21051 /1274009 | Eagle Orb `ob1` / Glowing Orb `ob6` / Heavenly Stone `obb` |
| 300 | Eldritch Orb `obc` | elite; Sorceress; — | 18–50 / — / — | 0 /0 | 50 /67 | 30 /0 | 4; 2/3/3 | 1×2 | -10;  | 100/ | — | 1; 303 | 19367 /1333589 | Sacred Globe `ob2` / Crystalline Globe `ob7` / Eldritch Orb `obc` |
| 301 | Demon Heart `obd` | elite; Sorceress; — | 23–55 / — / — | 0 /0 | 56 /75 | 35 /0 | 4; 2/3/3 | 1×2 | ;  | 100/ | — | 1; 303 | 22094 /1697050 | Smoked Sphere `ob3` / Cloudy Sphere `ob8` / Demon Heart `obd` |
| 302 | Vortex Orb `obe` | elite; Sorceress; — | 12–66 / — / — | 0 /0 | 63 /84 | 40 /0 | 4; 2/3/3 | 1×2 | ;  | 100/ | — | 1; 303 | 25207 /2161888 | Clasped Orb `ob4` / Sparkling Ball `ob9` / Vortex Orb `obe` |
| 303 | Dimensional Shard `obf` | elite; Sorceress; — | 30–53 / — / — | 0 /0 | 66 /85 | 50 /0 | 4; 2/3/3 | 1×3 | 10;  | 100/ | — | 1; 303 | 20065 /1750525 | Dragon Stone `ob5` / Swirling Crystal `oba` / Dimensional Shard `obf` |

### A.W. Amazon Bow (`abow`)

| Line | Name / code | Tier; class; type2 | 1H /2H /throw damage | Str /Dex req | Req lvl /qlvl | Dur /noDur | Max sockets; caps | W×H | WSM; rangeadder | Str/Dex scaling | Stack max | Magic lvl; automod group | Base cost /gamble cost | Normal /exceptional /elite |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 284 | Stag Bow `am1` | normal; Amazon; — | — / 7–12 / — | 30 /45 | 14 /18 | 48 /1 | 5; 3/4/5 | 2×4 | ;  | /100 | — | 0; 300 | 2500 /56500 | Stag Bow `am1` / Ashwood Bow `am6` / Matriarchal Bow `amb` |
| 285 | Reflex Bow `am2` | normal; Amazon; — | — / 9–19 / — | 35 /60 | 20 /27 | 55 /1 | 5; 3/4/5 | 2×4 | 10;  | /100 | — | 0; 300 | 3575 /112525 | Reflex Bow `am2` / Ceremonial Bow `am7` / Grand Matron Bow `amc` |
| 294 | Ashwood Bow `am6` | exceptional; Amazon; — | — / 16–29 / — | 56 /77 | 29 /39 | 48 /1 | 5; 3/4/5 | 2×4 | ;  | /100 | — | 0; 300 | 7800 /326200 | Stag Bow `am1` / Ashwood Bow `am6` / Matriarchal Bow `amb` |
| 295 | Ceremonial Bow `am7` | exceptional; Amazon; — | — / 19–41 / — | 73 /110 | 35 /47 | 55 /1 | 5; 3/4/5 | 2×4 | 10;  | /100 | — | 0; 300 | 11025 /544175 | Reflex Bow `am2` / Ceremonial Bow `am7` / Grand Matron Bow `amc` |
| 304 | Matriarchal Bow `amb` | elite; Amazon; — | — / 20–47 / — | 87 /187 | 39 /53 | 48 /1 | 5; 3/4/5 | 2×4 | -10;  | /100 | — | 0; 300 | 23700 /1285100 | Stag Bow `am1` / Ashwood Bow `am6` / Matriarchal Bow `amb` |
| 305 | Grand Matron Bow `amc` | elite; Amazon; — | — / 14–72 / — | 108 /152 | 58 /78 | 55 /1 | 5; 3/4/5 | 2×4 | 10;  | /100 | — | 0; 300 | 33375 /2644750 | Reflex Bow `am2` / Ceremonial Bow `am7` / Grand Matron Bow `amc` |

### A.W. Amazon Spear (`aspe`)

| Line | Name / code | Tier; class; type2 | 1H /2H /throw damage | Str /Dex req | Req lvl /qlvl | Dur /noDur | Max sockets; caps | W×H | WSM; rangeadder | Str/Dex scaling | Stack max | Magic lvl; automod group | Base cost /gamble cost | Normal /exceptional /elite |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 286 | Maiden Spear `am3` | normal; Amazon; — | — / 18–24 / — | 54 /40 | 14 /18 | 28 /0 | 6; 3/4/6 | 2×4 | ; 4 | 80/50 | — | 0; 302 | 1672 /41596 | Maiden Spear `am3` / Ceremonial Spear `am8` / Matriarchal Spear `amd` |
| 287 | Maiden Pike `am4` | normal; Amazon; — | — / 23–55 / — | 63 /52 | 20 /27 | 25 /0 | 6; 3/4/6 | 2×4 | 10; 4 | 80/50 | — | 0; 302 | 2023 /70621 | Maiden Pike `am4` / Ceremonial Pike `am9` / Matriarchal Pike `ame` |
| 296 | Ceremonial Spear `am8` | exceptional; Amazon; — | — / 34–51 / — | 101 /80 | 32 /43 | 28 /0 | 6; 3/4/6 | 2×4 | ; 4 | 80/50 | — | 0; 302 | 5316 /252588 | Maiden Spear `am3` / Ceremonial Spear `am8` / Matriarchal Spear `amd` |
| 297 | Ceremonial Pike `am9` | exceptional; Amazon; — | — / 42–101 / — | 115 /98 | 38 /51 | 25 /0 | 6; 3/4/6 | 2×4 | 20; 4 | 80/50 | — | 0; 302 | 6369 /352819 | Maiden Pike `am4` / Ceremonial Pike `am9` / Matriarchal Pike `ame` |
| 306 | Matriarchal Spear `amd` | elite; Amazon; — | — / 65–95 / — | 114 /142 | 45 /61 | 28 /0 | 6; 3/4/6 | 2×4 | ; 4 | 80/50 | — | 0; 302 | 16248 /1024128 | Maiden Spear `am3` / Ceremonial Spear `am8` / Matriarchal Spear `amd` |
| 307 | Matriarchal Pike `ame` | elite; Amazon; — | — / 37–153 / — | 132 /149 | 60 /81 | 25 /0 | 6; 3/4/6 | 2×4 | 20; 4 | 80/50 | — | 0; 302 | 19407 /1614967 | Maiden Pike `am4` / Ceremonial Pike `am9` / Matriarchal Pike `ame` |

### A.W. Amazon Javelin (`ajav`)

| Line | Name / code | Tier; class; type2 | 1H /2H /throw damage | Str /Dex req | Req lvl /qlvl | Dur /noDur | Max sockets; caps | W×H | WSM; rangeadder | Str/Dex scaling | Stack max | Magic lvl; automod group | Base cost /gamble cost | Normal /exceptional /elite |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 288 | Maiden Javelin `am5` | normal; Amazon; — | 8–14 / — / 6–22 | 33 /47 | 17 /23 | 6 /0 | ; 0/0/0 | 1×3 | -10; 2 | 80/50 | 80 | 0; 302 | 48 /15104 | Maiden Javelin `am5` / Ceremonial Javelin `ama` / Matriarchal Javelin `amf` |
| 298 | Ceremonial Javelin `ama` | exceptional; Amazon; — | 18–35 / — / 18–54 | 25 /109 | 26 /35 | 6 /0 | ; 0/0/0 | 1×3 | -10; 2 | 80/50 | 80 | 0; 302 | 444 /35540 | Maiden Javelin `am5` / Ceremonial Javelin `ama` / Matriarchal Javelin `amf` |
| 308 | Matriarchal Javelin [source: MatriarchalJavelin] `amf` | elite; Amazon; — | 30–54 / — / 35–66 | 107 /151 | 48 /65 | 6 /0 | ; 0/0/0 | 1×3 | -10; 2 | 80/50 | 80 | 0; 302 | 302 /54630 | Maiden Javelin `am5` / Ceremonial Javelin `ama` / Matriarchal Javelin `amf` |
[Source Armor.txt](https://cdn.jsdelivr.net/gh/fabd/diablo2@45112569deb9384738ccafe5c24ebbb71f41c7c9/code/d2_113_data/Armor.txt).


### A.A. Helm (`helm`)

| Line | Name /code | Tier; class | Defense | Str /Dex req | Req lvl /qlvl | Dur /noDur | Max sockets; caps | W×H | Weight speed | Block field | Smite or kick damage | Belt rows; raw belt id | Magic lvl; automod group | Base cost /gamble cost | Normal /exceptional /elite |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2 | Cap [source: Cap/hat] `cap` | normal; general | 3–5 | 0 /0 | 0 /1 | 12 /0 | 2; 2/2/2 | 2×2 | 0 | 0 | — | —; 0 | 0; — | 64 /3016 | Cap `cap` / War Hat `xap` / Shako `uap` |
| 3 | Skull Cap `skp` | normal; general | 8–11 | 15 /0 | 0 /5 | 18 /0 | 2; 2/2/2 | 2×2 | 0 | 0 | — | —; 0 | 0; — | 441 /5551 | Skull Cap `skp` / Sallet `xkp` / Hydraskull `ukp` |
| 4 | Helm `hlm` | normal; general | 15–18 | 26 /0 | 0 /11 | 24 /0 | 2; 2/2/2 | 2×2 | 0 | 0 | — | —; 0 | 0; — | 1558 /12284 | Helm `hlm` / Casque `xlm` / Armet `ulm` |
| 5 | Full Helm `fhl` | normal; general | 23–26 | 41 /0 | 0 /15 | 30 /0 | 2; 2/2/2 | 2×2 | 0 | 0 | — | —; 0 | 0; — | 3095 /21606 | Full Helm `fhl` / Basinet `xhl` / Giant Conch `uhl` |
| 6 | Great Helm `ghm` | normal; general | 30–35 | 63 /0 | 0 /23 | 40 /0 | 3; 2/2/3 | 2×2 | 0 | 0 | — | —; 0 | 0; — | 6177 /49517 | Great Helm `ghm` / Winged Helm `xhm` / Spired Helm `uhm` |
| 7 | Crown `crn` | normal; general | 25–45 | 55 /0 | 0 /29 | 50 /0 | 3; 2/2/3 | 2×2 | 0 | 0 | — | —; 0 | 0; — | 8345 /77501 | Crown `crn` / Grand Crown `xrn` / Corona `urn` |
| 8 | Mask `msk` | normal; general | 9–27 | 23 /0 | 0 /19 | 20 /0 | 3; 2/2/3 | 2×2 | 0 | 0 | — | —; 0 | 0; — | 2857 /25570 | Mask `msk` / Death Mask `xsk` / Demonhead `usk` |
| 45 | Bone Helm `bhm` | normal; general | 33–36 | 25 /0 | 0 /22 | 40 /0 | 2; 2/2/2 | 2×2 | 0 | 0 | — | —; 0 | 0; — | 6323 /48276 | Bone Helm `bhm` / Grim Helm `xh9` / Bone Visage `uh9` |
| 48 | War Hat `xap` | exceptional; general | 45–53 | 20 /0 | 22 /34 | 12 /0 | 2; 2/2/2 | 2×2 | 0 | 0 | — | —; 0 | 0; — | 13560 /82061 | Cap `cap` / War Hat `xap` / Shako `uap` |
| 49 | Sallet `xkp` | exceptional; general | 52–62 | 43 /0 | 25 /37 | 18 /0 | 2; 2/2/2 | 2×2 | 0 | 0 | — | —; 0 | 0; — | 17210 /113647 | Skull Cap `skp` / Sallet `xkp` / Hydraskull `ukp` |
| 50 | Casque `xlm` | exceptional; general | 63–72 | 59 /0 | 25 /42 | 24 /0 | 2; 2/2/2 | 2×2 | 0 | 0 | — | —; 0 | 0; — | 23075 /171804 | Helm `hlm` / Casque `xlm` / Armet `ulm` |
| 51 | Basinet `xhl` | exceptional; general | 75–84 | 82 /0 | 25 /45 | 30 /0 | 2; 2/2/2 | 2×2 | 0 | 0 | — | —; 0 | 0; — | 29083 /233910 | Full Helm `fhl` / Basinet `xhl` / Giant Conch `uhl` |
| 52 | Winged Helm `xhm` | exceptional; general | 85–98 | 115 /0 | 25 /51 | 40 /0 | 3; 2/2/3 | 2×2 | 0 | 0 | — | —; 0 | 0; — | 37846 /355900 | Great Helm `ghm` / Winged Helm `xhm` / Spired Helm `uhm` |
| 53 | Grand Crown `xrn` | exceptional; general | 78–113 | 103 /0 | 25 /55 | 50 /0 | 3; 2/2/3 | 2×2 | 0 | 0 | — | —; 0 | 0; — | 42458 /448816 | Crown `crn` / Grand Crown `xrn` / Corona `urn` |
| 54 | Death Mask `xsk` | exceptional; general | 54–86 | 55 /0 | 25 /48 | 20 /0 | 3; 2/2/3 | 2×2 | 0 | 0 | — | —; 0 | 0; — | 27190 /241184 | Mask `msk` / Death Mask `xsk` / Demonhead `usk` |
| 91 | Grim Helm `xh9` | exceptional; general | 60–125 | 58 /0 | 25 /50 | 40 /0 | 2; 2/2/2 | 2×2 | 0 | 0 | — | —; 0 | 0; — | 37683 /348947 | Bone Helm `bhm` / Grim Helm `xh9` / Bone Visage `uh9` |
| 119 | Shako `uap` | elite; general | 98–141 | 50 /0 | 43 /58 | 12 /0 | 2; 2/2/2 | 2×2 | 0 | 0 | — | —; 0 | 0; — | 56307 /503591 | Cap `cap` / War Hat `xap` / Shako `uap` |
| 120 | Hydraskull `ukp` | elite; general | 101–145 | 84 /0 | 47 /63 | 18 /0 | 2; 2/2/2 | 2×2 | 0 | 0 | — | —; 0 | 0; — | 62739 /568276 | Skull Cap `skp` / Sallet `xkp` / Hydraskull `ukp` |
| 121 | Armet `ulm` | elite; general | 105–149 | 109 /0 | 51 /68 | 24 /0 | 2; 2/2/2 | 2×2 | 0 | 0 | — | —; 0 | 0; — | 69940 /671703 | Helm `hlm` / Casque `xlm` / Armet `ulm` |
| 122 | Giant Conch `uhl` | elite; general | 110–154 | 142 /0 | 40 /54 | 30 /0 | 2; 2/2/2 | 2×2 | 0 | 0 | — | —; 0 | 0; — | 57806 /757863 | Full Helm `fhl` / Basinet `xhl` / Giant Conch `uhl` |
| 123 | Spired Helm `uhm` | elite; general | 114–159 | 192 /0 | 59 /79 | 40 /0 | 3; 2/2/3 | 2×2 | 0 | 0 | — | —; 0 | 0; — | 87168 /920880 | Great Helm `ghm` / Winged Helm `xhm` / Spired Helm `uhm` |
| 124 | Corona `urn` | elite; general | 111–165 | 174 /0 | 66 /85 | 50 /0 | 3; 2/2/3 | 2×2 | 0 | 0 | — | —; 0 | 0; — | 94770 /1042170 | Crown `crn` / Grand Crown `xrn` / Corona `urn` |
| 125 | Demonhead `usk` | elite; general | 101–154 | 102 /0 | 55 /74 | 20 /0 | 3; 2/2/3 | 2×2 | 0 | 0 | — | —; 0 | 0; — | 76578 /799703 | Mask `msk` / Death Mask `xsk` / Demonhead `usk` |
| 162 | Bone Visage `uh9` | elite; general | 100–157 | 106 /0 | 63 /84 | 40 /0 | 3; 2/2/3 | 2×2 | 0 | 0 | — | —; 0 | 0; — | 87274 /598161 | Bone Helm `bhm` / Grim Helm `xh9` / Bone Visage `uh9` |

### A.A. Armor (`tors`)

| Line | Name /code | Tier; class | Defense | Str /Dex req | Req lvl /qlvl | Dur /noDur | Max sockets; caps | W×H | Weight speed | Block field | Smite or kick damage | Belt rows; raw belt id | Magic lvl; automod group | Base cost /gamble cost | Normal /exceptional /elite |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 9 | Quilted Armor `qui` | normal; general | 8–11 | 12 /0 | 0 /1 | 20 /0 | 2; 2/2/2 | 2×3 | 0 | 0 | — | —; 0 | 0; — | 140 /3035 | Quilted Armor `qui` / Ghost Armor `xui` / Dusk Shroud `uui` |
| 10 | Leather Armor `lea` | normal; general | 14–17 | 15 /0 | 0 /3 | 24 /0 | 2; 2/2/2 | 2×3 | 0 | 0 | — | —; 0 | 0; — | 481 /4360 | Leather Armor `lea` / Serpentskin Armor `xea` / Wyrmhide `uea` |
| 11 | Hard Leather Armor `hla` | normal; general | 21–24 | 20 /0 | 0 /5 | 28 /0 | 2; 2/2/2 | 2×3 | 0 | 0 | — | —; 0 | 0; — | 1060 /6325 | Hard Leather Armor `hla` / Demonhide Armor `xla` / Scarab Husk `ula` |
| 12 | Studded Leather `stu` | normal; general | 32–35 | 27 /0 | 0 /8 | 32 /0 | 2; 2/2/2 | 2×3 | 0 | 0 | — | —; 0 | 0; — | 2385 /11270 | Studded Leather `stu` / Trellised Armor `xtu` / Wire Fleece `utu` |
| 13 | Ring Mail `rng` | normal; general | 45–48 | 36 /0 | 0 /11 | 26 /0 | 3; 3/3/3 | 2×3 | 5 | 0 | — | —; 0 | 0; — | 4428 /20177 | Ring Mail `rng` / Linked Mail `xng` / Diamond Mail `ung` |
| 14 | Scale Mail `scl` | normal; general | 57–60 | 44 /0 | 0 /13 | 36 /0 | 2; 2/2/2 | 2×3 | 10 | 0 | — | —; 0 | 0; — | 6508 /30151 | Scale Mail `scl` / Tigulated Mail `xcl` / Loricated Mail `ucl` |
| 15 | Chain Mail `chn` | normal; general | 72–75 | 48 /0 | 0 /15 | 45 /0 | 2; 2/2/2 | 2×3 | 5 | 0 | — | —; 0 | 0; — | 9360 /45100 | Chain Mail `chn` / Mesh Armor `xhn` / Boneweave `uhn` |
| 16 | Breast Plate `brs` | normal; general | 65–68 | 30 /0 | 0 /18 | 50 /0 | 3; 3/3/3 | 2×3 | 0 | 0 | — | —; 0 | 0; — | 10078 /56851 | Breast Plate `brs` / Cuirass `xrs` / Great Hauberk `urs` |
| 17 | Splint Mail `spl` | normal; general | 90–95 | 51 /0 | 0 /20 | 30 /0 | 2; 2/2/2 | 2×3 | 5 | 0 | — | —; 0 | 0; — | 15489 /89945 | Splint Mail `spl` / Russet Armor `xpl` / Balrog Skin `upl` |
| 18 | Plate Mail `plt` | normal; general | 108–116 | 65 /0 | 0 /24 | 60 /0 | 2; 2/2/2 | 2×3 | 10 | 0 | — | —; 0 | 0; — | 22335 /148510 | Plate Mail `plt` / Templar Coat `xlt` / Hellforged Plate `ult` |
| 19 | Field Plate `fld` | normal; general | 101–105 | 55 /0 | 0 /28 | 48 /0 | 2; 2/2/2 | 2×3 | 5 | 0 | — | —; 0 | 0; — | 23841 /183387 | Field Plate `fld` / Sharktooth Armor `xld` / Kraken Shell `uld` |
| 20 | Gothic Plate `gth` | normal; general | 128–135 | 70 /0 | 0 /32 | 55 /0 | 4; 3/4/4 | 2×3 | 5 | 0 | — | —; 0 | 0; — | 34646 /295668 | Gothic Plate `gth` / Embossed Plate `xth` / Lacquered Plate `uth` |
| 21 | Full Plate Mail `ful` | normal; general | 150–161 | 80 /0 | 0 /37 | 70 /0 | 4; 3/4/4 | 2×3 | 10 | 0 | — | —; 0 | 0; — | 47192 /457526 | Full Plate Mail `ful` / Chaos Armor `xul` / Shadow Plate `uul` |
| 22 | Ancient Armor `aar` | normal; general | 218–233 | 100 /0 | 0 /40 | 60 /0 | 4; 3/4/4 | 2×3 | 5 | 0 | — | —; 0 | 0; — | 73864 /761140 | Ancient Armor `aar` / Ornate Armor `xar` / Sacred Armor `uar` |
| 23 | Light Plate `ltp` | normal; general | 90–107 | 41 /0 | 0 /35 | 60 /0 | 3; 3/3/3 | 2×3 | 0 | 0 | — | —; 0 | 0; — | 28327 /267861 | Light Plate `ltp` / Mage Plate `xtp` / Archon Plate `utp` |
| 55 | Ghost Armor `xui` | exceptional; general | 102–117 | 38 /0 | 22 /34 | 20 /0 | 2; 2/2/2 | 2×3 | 0 | 0 | — | —; 0 | 0; — | 30552 /165635 | Quilted Armor `qui` / Ghost Armor `xui` / Dusk Shroud `uui` |
| 56 | Serpentskin Armor `xea` | exceptional; general | 111–126 | 43 /0 | 24 /36 | 24 /0 | 2; 2/2/2 | 2×3 | 0 | 0 | — | —; 0 | 0; — | 34960 /197896 | Leather Armor `lea` / Serpentskin Armor `xea` / Wyrmhide `uea` |
| 57 | Demonhide Armor `xla` | exceptional; general | 122–136 | 50 /0 | 25 /37 | 28 /0 | 2; 2/2/2 | 2×3 | 0 | 0 | — | —; 0 | 0; — | 39090 /236758 | Hard Leather Armor `hla` / Demonhide Armor `xla` / Scarab Husk `ula` |
| 58 | Trellised Armor `xtu` | exceptional; general | 138–153 | 61 /0 | 25 /40 | 32 /0 | 2; 2/2/2 | 2×3 | 0 | 0 | — | —; 0 | 0; — | 47582 /305707 | Studded Leather `stu` / Trellised Armor `xtu` / Wire Fleece `utu` |
| 59 | Linked Mail `xng` | exceptional; general | 158–172 | 74 /0 | 25 /42 | 26 /0 | 3; 3/3/3 | 2×3 | 5 | 0 | — | —; 0 | 0; — | 56600 /393748 | Ring Mail `rng` / Linked Mail `xng` / Diamond Mail `ung` |
| 60 | Tigulated Mail `xcl` | exceptional; general | 176–190 | 86 /0 | 25 /43 | 36 /0 | 3; 3/3/3 | 2×3 | 10 | 0 | — | —; 0 | 0; — | 64242 /473193 | Scale Mail `scl` / Tigulated Mail `xcl` / Loricated Mail `ucl` |
| 61 | Mesh Armor `xhn` | exceptional; general | 198–213 | 92 /0 | 25 /45 | 45 /0 | 3; 3/3/3 | 2×3 | 5 | 0 | — | —; 0 | 0; — | 75440 /574094 | Chain Mail `chn` / Mesh Armor `xhn` / Boneweave `uhn` |
| 62 | Cuirass `xrs` | exceptional; general | 188–202 | 65 /0 | 25 /47 | 50 /0 | 3; 3/3/3 | 2×3 | 0 | 0 | — | —; 0 | 0; — | 74719 /613456 | Breast Plate `brs` / Cuirass `xrs` / Great Hauberk `urs` |
| 63 | Russet Armor `xpl` | exceptional; general | 225–243 | 97 /0 | 25 /49 | 30 /0 | 3; 3/3/3 | 2×3 | 5 | 0 | — | —; 0 | 0; — | 93404 /788235 | Splint Mail `spl` / Russet Armor `xpl` / Balrog Skin `upl` |
| 64 | Templar Coat `xlt` | exceptional; general | 252–274 | 118 /0 | 25 /52 | 60 /0 | 3; 3/3/3 | 2×3 | 10 | 0 | — | —; 0 | 0; — | 111395 /1017928 | Plate Mail `plt` / Templar Coat `xlt` / Hellforged Plate `ult` |
| 65 | Sharktooth Armor `xld` | exceptional; general | 242–258 | 103 /0 | 25 /55 | 48 /0 | 3; 3/3/3 | 2×3 | 5 | 0 | — | —; 0 | 0; — | 111674 /1103159 | Field Plate `fld` / Sharktooth Armor `xld` / Kraken Shell `uld` |
| 66 | Embossed Plate `xth` | exceptional; general | 282–303 | 125 /0 | 25 /58 | 55 /0 | 4; 3/4/4 | 2×3 | 5 | 0 | — | —; 0 | 0; — | 137817 /1457493 | Gothic Plate `gth` / Embossed Plate `xth` / Lacquered Plate `uth` |
| 67 | Chaos Armor `xul` | exceptional; general | 315–342 | 140 /0 | 25 /61 | 70 /0 | 4; 3/4/4 | 2×3 | 10 | 0 | — | —; 0 | 0; — | 162672 /1888411 | Full Plate Mail `ful` / Chaos Armor `xul` / Shadow Plate `uul` |
| 68 | Ornate Armor `xar` | exceptional; general | 417–450 | 170 /0 | 25 /64 | 60 /0 | 4; 3/4/4 | 2×3 | 5 | 0 | — | —; 0 | 0; — | 225120 /2696482 | Ancient Armor `aar` / Ornate Armor `xar` / Sacred Armor `uar` |
| 69 | Mage Plate `xtp` | exceptional; general | 225–261 | 55 /0 | 25 /60 | 60 /0 | 3; 3/3/3 | 2×3 | 0 | 0 | — | —; 0 | 0; — | 118407 /1327498 | Light Plate `ltp` / Mage Plate `xtp` / Archon Plate `utp` |
| 126 | Dusk Shroud `uui` | elite; general | 361–467 | 77 /0 | 49 /65 | 20 /0 | 4; 3/4/4 | 2×3 | 0 | 0 | — | —; 0 | 0; — | 218357 /1685148 | Quilted Armor `qui` / Ghost Armor `xui` / Dusk Shroud `uui` |
| 127 | Wyrmhide `uea` | elite; general | 364–470 | 84 /0 | 50 /67 | 24 /0 | 4; 3/4/4 | 2×3 | 0 | 0 | — | —; 0 | 0; — | 226927 /1785276 | Leather Armor `lea` / Serpentskin Armor `xea` / Wyrmhide `uea` |
| 128 | Scarab Husk `ula` | elite; general | 369–474 | 95 /0 | 51 /68 | 28 /0 | 4; 3/4/4 | 2×3 | 0 | 0 | — | —; 0 | 0; — | 232573 /1891607 | Hard Leather Armor `hla` / Demonhide Armor `xla` / Scarab Husk `ula` |
| 129 | Wire Fleece `utu` | elite; general | 375–481 | 111 /0 | 53 /70 | 32 /0 | 4; 3/4/4 | 2×3 | 0 | 0 | — | —; 0 | 0; — | 243050 /2059887 | Studded Leather `stu` / Trellised Armor `xtu` / Wire Fleece `utu` |
| 130 | Diamond Mail `ung` | elite; general | 383–489 | 131 /0 | 54 /72 | 26 /0 | 4; 3/4/4 | 2×3 | 5 | 0 | — | —; 0 | 0; — | 254435 /2243423 | Ring Mail `rng` / Linked Mail `xng` / Diamond Mail `ung` |
| 131 | Loricated Mail `ucl` | elite; general | 390–496 | 149 /0 | 55 /73 | 36 /0 | 4; 3/4/4 | 2×3 | 10 | 0 | — | —; 0 | 0; — | 262166 /2382039 | Scale Mail `scl` / Tigulated Mail `xcl` / Loricated Mail `ucl` |
| 132 | Boneweave `uhn` | elite; general | 399–505 | 158 /0 | 47 /62 | 45 /0 | 4; 3/4/4 | 2×3 | 5 | 0 | — | —; 0 | 0; — | 227700 /2536340 | Chain Mail `chn` / Mesh Armor `xhn` / Boneweave `uhn` |
| 133 | Great Hauberk `urs` | elite; general | 395–501 | 118 /0 | 56 /75 | 50 /0 | 4; 3/4/4 | 2×3 | 0 | 0 | — | —; 0 | 0; — | 272206 /2676189 | Breast Plate `brs` / Cuirass `xrs` / Great Hauberk `urs` |
| 134 | Balrog Skin `upl` | elite; general | 410–517 | 165 /0 | 57 /76 | 30 /0 | 4; 3/4/4 | 2×3 | 5 | 0 | — | —; 0 | 0; — | 285351 /2882894 | Splint Mail `spl` / Russet Armor `xpl` / Balrog Skin `upl` |
| 135 | Hellforged Plate `ult` | elite; general | 421–530 | 196 /0 | 59 /78 | 60 /0 | 4; 3/4/4 | 2×3 | 10 | 0 | — | —; 0 | 0; — | 300130 /3197721 | Plate Mail `plt` / Templar Coat `xlt` / Hellforged Plate `ult` |
| 136 | Kraken Shell `uld` | elite; general | 417–523 | 174 /0 | 61 /81 | 48 /0 | 4; 3/4/4 | 2×3 | 5 | 0 | — | —; 0 | 0; — | 308015 /3411990 | Field Plate `fld` / Sharktooth Armor `xld` / Kraken Shell `uld` |
| 137 | Lacquered Plate `uth` | elite; general | 433–541 | 208 /0 | 62 /82 | 55 /0 | 4; 3/4/4 | 2×3 | 5 | 0 | — | —; 0 | 0; — | 323094 /3803464 | Gothic Plate `gth` / Embossed Plate `xth` / Lacquered Plate `uth` |
| 138 | Shadow Plate `uul` | elite; general | 446–557 | 230 /0 | 64 /83 | 70 /0 | 4; 3/4/4 | 2×3 | 10 | 0 | — | —; 0 | 0; — | 336644 /4274953 | Full Plate Mail `ful` / Chaos Armor `xul` / Shadow Plate `uul` |
| 139 | Sacred Armor `uar` | elite; general | 487–600 | 232 /0 | 66 /85 | 60 /0 | 4; 3/4/4 | 2×3 | 5 | 0 | — | —; 0 | 0; — | 373558 /4872212 | Ancient Armor `aar` / Ornate Armor `xar` / Sacred Armor `uar` |
| 140 | Archon Plate `utp` | elite; general | 410–524 | 103 /0 | 63 /84 | 60 /0 | 4; 3/4/4 | 2×3 | 0 | 0 | — | —; 0 | 0; — | 317526 /3851372 | Light Plate `ltp` / Mage Plate `xtp` / Archon Plate `utp` |

### A.A. Shield (`shie`)

| Line | Name /code | Tier; class | Defense | Str /Dex req | Req lvl /qlvl | Dur /noDur | Max sockets; caps | W×H | Weight speed | Block field | Smite or kick damage | Belt rows; raw belt id | Magic lvl; automod group | Base cost /gamble cost | Normal /exceptional /elite |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 24 | Buckler `buc` | normal; general | 4–6 | 12 /0 | 0 /1 | 12 /0 | 1; 1/1/1 | 2×2 | 0 | 0 | 1–3 | —; 0 | 0; — | 68 /3017 | Buckler `buc` / Defender `xuc` / Heater `uuc` |
| 25 | Small Shield `sml` | normal; general | 8–10 | 22 /0 | 0 /5 | 16 /0 | 2; 2/2/2 | 2×2 | 0 | 5 | 2–3 | —; 0 | 0; — | 410 /5512 | Small Shield `sml` / Round Shield `xml` / Luna `uml` |
| 26 | Large Shield `lrg` | normal; general | 12–14 | 34 /0 | 0 /11 | 24 /0 | 3; 3/3/3 | 2×3 | 5 | 12 | 2–4 | —; 0 | 0; — | 1214 /11338 | Large Shield `lrg` / Scutum `xrg` / Hyperion `urg` |
| 27 | Kite Shield `kit` | normal; general | 16–18 | 47 /0 | 0 /15 | 30 /0 | 3; 3/3/3 | 2×3 | 0 | 8 | 2–5 | —; 0 | 0; — | 2129 /17983 | Kite Shield `kit` / Dragon Shield `xit` / Monarch `uit` |
| 28 | Tower Shield `tow` | normal; general | 22–25 | 75 /0 | 0 /22 | 60 /0 | 3; 3/3/3 | 2×3 | 10 | 24 | 1–5 | —; 0 | 0; — | 4249 /36869 | Tower Shield `tow` / Pavise `xow` / Aegis `uow` |
| 29 | Gothic Shield `gts` | normal; general | 30–35 | 60 /0 | 0 /30 | 40 /0 | 3; 3/3/3 | 2×4 | 5 | 16 | 2–6 | —; 0 | 0; — | 8000 /77500 | Gothic Shield `gts` / Ancient Shield `xts` / Ward `uts` |
| 46 | Bone Shield `bsh` | normal; general | 10–30 | 25 /0 | 0 /19 | 40 /0 | 2; 2/2/2 | 2×3 | 0 | 20 | 3–6 | —; 0 | 0; — | 3175 /27081 | Bone Shield `bsh` / Grim Shield `xsh` / Troll Nest `ush` |
| 47 | Spiked Shield `spk` | normal; general | 15–25 | 30 /0 | 0 /11 | 40 /0 | 2; 2/2/2 | 2×3 | 0 | 10 | 5–9 | —; 0 | 0; — | 1890 /13197 | Spiked Shield `spk` / Barbed Shield `xpk` / Blade Barrier `upk` |
| 70 | Defender `xuc` | exceptional; general | 41–49 | 38 /0 | 22 /34 | 68 /0 | 1; 1/1/1 | 2×2 | 0 | 10 | 8–12 | —; 0 | 0; — | 12562 /77123 | Buckler `buc` / Defender `xuc` / Heater `uuc` |
| 71 | Round Shield `xml` | exceptional; general | 47–55 | 53 /0 | 25 /37 | 64 /0 | 2; 2/2/2 | 2×2 | 0 | 12 | 7–14 | —; 0 | 0; — | 15451 /103735 | Small Shield `sml` / Round Shield `xml` / Luna `uml` |
| 72 | Scutum `xrg` | exceptional; general | 53–61 | 71 /0 | 25 /42 | 62 /0 | 3; 3/3/3 | 2×3 | 5 | 14 | 11–15 | —; 0 | 0; — | 19537 /148359 | Large Shield `lrg` / Scutum `xrg` / Hyperion `urg` |
| 73 | Dragon Shield `xit` | exceptional; general | 59–67 | 91 /0 | 25 /45 | 76 /0 | 3; 3/3/3 | 2×3 | 0 | 18 | 15–24 | —; 0 | 0; — | 23094 /189944 | Kite Shield `kit` / Dragon Shield `xit` / Monarch `uit` |
| 74 | Pavise `xow` | exceptional; general | 68–78 | 133 /0 | 25 /50 | 72 /0 | 3; 3/3/3 | 2×3 | 10 | 24 | 10–17 | —; 0 | 0; — | 29550 /278500 | Tower Shield `tow` / Pavise `xow` / Aegis `uow` |
| 75 | Ancient Shield `xts` | exceptional; general | 80–93 | 110 /0 | 25 /56 | 80 /0 | 3; 3/3/3 | 2×4 | 5 | 16 | 12–16 | —; 0 | 0; — | 39220 /422340 | Gothic Shield `gts` / Ancient Shield `xts` / Ward `uts` |
| 92 | Grim Shield `xsh` | exceptional; general | 50–150 | 58 /0 | 25 /48 | 70 /0 | 2; 2/2/2 | 2×3 | 0 | 20 | 14–20 | —; 0 | 0; — | 39143 /337523 | Bone Shield `bsh` / Grim Shield `xsh` / Troll Nest `ush` |
| 93 | Barbed Shield `xpk` | exceptional; general | 58–78 | 65 /0 | 25 /42 | 55 /0 | 2; 2/2/2 | 2×3 | 0 | 17 | 18–35 | —; 0 | 0; — | 23155 /172324 | Spiked Shield `spk` / Barbed Shield `xpk` / Blade Barrier `upk` |
| 141 | Heater `uuc` | elite; general | 95–110 | 77 /0 | 43 /58 | 88 /0 | 2; 2/2/2 | 2×2 | 0 | 22 | 16–30 | —; 0 | 0; — | 48303 /385227 | Buckler `buc` / Defender `xuc` / Heater `uuc` |
| 142 | Luna `uml` | elite; general | 108–123 | 100 /0 | 45 /61 | 84 /0 | 2; 2/2/2 | 2×2 | 0 | 20 | 17–29 | —; 0 | 0; — | 57189 /436543 | Small Shield `sml` / Round Shield `xml` / Luna `uml` |
| 143 | Hyperion `urg` | elite; general | 119–135 | 127 /0 | 48 /64 | 82 /0 | 3; 3/3/3 | 2×3 | 5 | 24 | 14–32 | —; 0 | 0; — | 65914 /514278 | Large Shield `lrg` / Scutum `xrg` / Hyperion `urg` |
| 144 | Monarch `uit` | elite; general | 133–148 | 156 /0 | 54 /72 | 86 /0 | 4; 3/3/4 | 2×3 | 0 | 22 | 12–34 | —; 0 | 0; — | 81896 /576154 | Kite Shield `kit` / Dragon Shield `xit` / Monarch `uit` |
| 145 | Aegis `uow` | elite; general | 145–161 | 219 /0 | 59 /79 | 92 /0 | 4; 3/3/4 | 2×3 | 10 | 24 | 18–28 | —; 0 | 0; — | 97701 /693568 | Tower Shield `tow` / Pavise `xow` / Aegis `uow` |
| 146 | Ward `uts` | elite; general | 153–170 | 185 /0 | 63 /84 | 100 /0 | 4; 3/3/4 | 2×4 | 5 | 24 | 11–35 | —; 0 | 0; — | 109635 /856602 | Gothic Shield `gts` / Ancient Shield `xts` / Ward `uts` |
| 163 | Troll Nest `ush` | elite; general | 158–173 | 106 /0 | 57 /76 | 74 /0 | 3; 3/3/3 | 2×3 | 0 | 20 | 24–38 | —; 0 | 0; — | 101842 /586580 | Bone Shield `bsh` / Grim Shield `xsh` / Troll Nest `ush` |
| 164 | Blade Barrier `upk` | elite; general | 147–163 | 118 /0 | 51 /68 | 83 /0 | 3; 3/3/3 | 2×3 | 0 | 20 | 26–40 | —; 0 | 0; — | 85443 /413914 | Spiked Shield `spk` / Barbed Shield `xpk` / Blade Barrier `upk` |

### A.A. Gloves (`glov`)

| Line | Name /code | Tier; class | Defense | Str /Dex req | Req lvl /qlvl | Dur /noDur | Max sockets; caps | W×H | Weight speed | Block field | Smite or kick damage | Belt rows; raw belt id | Magic lvl; automod group | Base cost /gamble cost | Normal /exceptional /elite |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 30 | Leather Gloves [source: Gloves(L)] `lgl` | normal; general | 2–3 | 0 /0 | 0 /3 | 12 /0 | 0; 0/0/0 | 2×2 | 0 | 0 | — | —; 0 | 0; — | 80 /4060 | Leather Gloves `lgl` / Demonhide Gloves `xlg` / Bramble Mitts `ulg` |
| 31 | Heavy Gloves `vgl` | normal; general | 5–6 | 0 /0 | 0 /7 | 14 /0 | 0; 0/0/0 | 2×2 | 0 | 0 | — | —; 0 | 0; — | 352 /6616 | Heavy Gloves `vgl` / Sharkskin Gloves `xvg` / Vampirebone Gloves `uvg` |
| 32 | Chain Gloves [source: Bracers(M)] `mgl` | normal; general | 8–9 | 25 /0 | 0 /12 | 16 /0 | 0; 0/0/0 | 2×2 | 0 | 0 | — | —; 0 | 0; — | 859 /11077 | Chain Gloves `mgl` / Heavy Bracers `xmg` / Vambraces `umg` |
| 33 | Light Gauntlets `tgl` | normal; general | 9–11 | 45 /0 | 0 /20 | 18 /0 | 0; 0/0/0 | 2×2 | 0 | 0 | — | —; 0 | 0; — | 1635 /20675 | Light Gauntlets `tgl` / Battle Gauntlets `xtg` / Crusader Gauntlets `utg` |
| 34 | Gauntlets [source: Gaunlets(H)] `hgl` | normal; general | 12–15 | 60 /0 | 0 /27 | 24 /0 | 0; 0/0/0 | 2×2 | 0 | 0 | — | —; 0 | 0; — | 2964 /36007 | Gauntlets `hgl` / War Gauntlets `xhg` / Ogre Gauntlets `uhg` |
| 76 | Demonhide Gloves `xlg` | exceptional; general | 28–35 | 20 /0 | 21 /33 | 12 /0 | 0; 0/0/0 | 2×2 | 0 | 0 | — | —; 0 | 0; — | 8480 /64102 | Leather Gloves `lgl` / Demonhide Gloves `xlg` / Bramble Mitts `ulg` |
| 77 | Sharkskin Gloves `xvg` | exceptional; general | 33–39 | 20 /0 | 25 /39 | 14 /0 | 0; 0/0/0 | 2×2 | 0 | 0 | — | —; 0 | 0; — | 11420 /85063 | Heavy Gloves `vgl` / Sharkskin Gloves `xvg` / Vampirebone Gloves `uvg` |
| 78 | Heavy Bracers `xmg` | exceptional; general | 37–44 | 58 /0 | 25 /43 | 16 /0 | 0; 0/0/0 | 2×2 | 0 | 0 | — | —; 0 | 0; — | 14111 /114806 | Chain Gloves `mgl` / Heavy Bracers `xmg` / Vambraces `umg` |
| 79 | Battle Gauntlets `xtg` | exceptional; general | 39–47 | 88 /0 | 25 /49 | 18 /0 | 0; 0/0/0 | 2×2 | 0 | 0 | — | —; 0 | 0; — | 16913 /161025 | Light Gauntlets `tgl` / Battle Gauntlets `xtg` / Crusader Gauntlets `utg` |
| 80 | War Gauntlets `xhg` | exceptional; general | 43–53 | 110 /0 | 25 /54 | 24 /0 | 0; 0/0/0 | 2×2 | 0 | 0 | — | —; 0 | 0; — | 20900 /223744 | Gauntlets `hgl` / War Gauntlets `xhg` / Ogre Gauntlets `uhg` |
| 147 | Bramble Mitts `ulg` | elite; general | 54–62 | 50 /0 | 42 /57 | 12 /0 | 0; 0/0/0 | 2×2 | 0 | 0 | — | —; 0 | 0; — | 26920 /269938 | Leather Gloves `lgl` / Demonhide Gloves `xlg` / Bramble Mitts `ulg` |
| 148 | Vampirebone Gloves `uvg` | elite; general | 56–65 | 50 /0 | 47 /63 | 14 /0 | 0; 0/0/0 | 2×2 | 0 | 0 | — | —; 0 | 0; — | 30862 /306103 | Heavy Gloves `vgl` / Sharkskin Gloves `xvg` / Vampirebone Gloves `uvg` |
| 149 | Vambraces `umg` | elite; general | 59–67 | 106 /0 | 51 /69 | 16 /0 | 0; 0/0/0 | 2×2 | 0 | 0 | — | —; 0 | 0; — | 34964 /352152 | Chain Gloves `mgl` / Heavy Bracers `xmg` / Vambraces `umg` |
| 150 | Crusader Gauntlets `utg` | elite; general | 59–68 | 151 /0 | 57 /76 | 18 /0 | 0; 0/0/0 | 2×2 | 0 | 0 | — | —; 0 | 0; — | 39119 /420620 | Light Gauntlets `tgl` / Battle Gauntlets `xtg` / Crusader Gauntlets `utg` |
| 151 | Ogre Gauntlets `uhg` | elite; general | 62–71 | 185 /0 | 64 /85 | 24 /0 | 0; 0/0/0 | 2×2 | 0 | 0 | — | —; 0 | 0; — | 45481 /498191 | Gauntlets `hgl` / War Gauntlets `xhg` / Ogre Gauntlets `uhg` |

### A.A. Boots (`boot`)

| Line | Name /code | Tier; class | Defense | Str /Dex req | Req lvl /qlvl | Dur /noDur | Max sockets; caps | W×H | Weight speed | Block field | Smite or kick damage | Belt rows; raw belt id | Magic lvl; automod group | Base cost /gamble cost | Normal /exceptional /elite |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 35 | Boots [source: Leather Boots] `lbt` | normal; general | 2–3 | 0 /0 | 0 /3 | 12 /0 | 0; 0/0/0 | 2×2 | 0 | 0 | 3–8 | —; 0 | 0; — | 80 /4060 | Boots `lbt` / Demonhide Boots `xlb` / Wyrmhide Boots `ulb` |
| 36 | Heavy Boots `vbt` | normal; general | 5–6 | 18 /0 | 0 /7 | 14 /0 | 0; 0/0/0 | 2×2 | 0 | 0 | 4–10 | —; 0 | 0; — | 334 /6584 | Heavy Boots `vbt` / Sharkskin Boots `xvb` / Scarabshell Boots `uvb` |
| 37 | Chain Boots `mbt` | normal; general | 8–9 | 30 /0 | 0 /12 | 16 /0 | 0; 0/0/0 | 2×2 | 0 | 0 | 6–12 | —; 0 | 0; — | 854 /11062 | Chain Boots `mbt` / Mesh Boots `xmb` / Boneweave Boots `umb` |
| 38 | Light Plated Boots [source: Light Plate Boots] `tbt` | normal; general | 9–11 | 50 /0 | 0 /20 | 18 /0 | 0; 0/0/0 | 2×2 | 0 | 0 | 8–16 | —; 0 | 0; — | 1630 /20650 | Light Plated Boots `tbt` / Battle Boots `xtb` / Mirrored Boots `utb` |
| 39 | Greaves [source: Plate Boots] `hbt` | normal; general | 12–15 | 70 /0 | 0 /27 | 24 /0 | 0; 0/0/0 | 2×2 | 0 | 0 | 10–20 | —; 0 | 0; — | 2954 /35939 | Greaves `hbt` / War Boots `xhb` / Myrmidon Greaves `uhb` |
| 81 | Demonhide Boots `xlb` | exceptional; general | 28–35 | 20 /0 | 24 /36 | 12 /0 | 0; 0/0/0 | 2×2 | 0 | 0 | 26–46 | —; 0 | 0; — | 9230 /64102 | Boots `lbt` / Demonhide Boots `xlb` / Wyrmhide Boots `ulb` |
| 82 | Sharkskin Boots `xvb` | exceptional; general | 33–39 | 47 /0 | 25 /39 | 14 /0 | 0; 0/0/0 | 2×2 | 0 | 0 | 28–50 | —; 0 | 0; — | 11393 /84859 | Heavy Boots `vbt` / Sharkskin Boots `xvb` / Scarabshell Boots `uvb` |
| 83 | Mesh Boots `xmb` | exceptional; general | 37–44 | 65 /0 | 25 /43 | 16 /0 | 0; 0/0/0 | 2×2 | 0 | 0 | 23–52 | —; 0 | 0; — | 14103 /114742 | Chain Boots `mbt` / Mesh Boots `xmb` / Boneweave Boots `umb` |
| 84 | Battle Boots `xtb` | exceptional; general | 39–47 | 95 /0 | 25 /49 | 18 /0 | 0; 0/0/0 | 2×2 | 0 | 0 | 37–64 | —; 0 | 0; — | 16905 /160950 | Light Plated Boots `tbt` / Battle Boots `xtb` / Mirrored Boots `utb` |
| 85 | War Boots `xhb` | exceptional; general | 43–53 | 125 /0 | 25 /54 | 24 /0 | 0; 0/0/0 | 2×2 | 0 | 0 | 39–80 | —; 0 | 0; — | 20885 /223574 | Greaves `hbt` / War Boots `xhb` / Myrmidon Greaves `uhb` |
| 152 | Wyrmhide Boots `ulb` | elite; general | 54–62 | 50 /0 | 45 /60 | 12 /0 | 0; 0/0/0 | 2×2 | 0 | 0 | 65–100 | —; 0 | 0; — | 28315 /269938 | Boots `lbt` / Demonhide Boots `xlb` / Wyrmhide Boots `ulb` |
| 153 | Scarabshell Boots `uvb` | elite; general | 56–65 | 91 /0 | 49 /66 | 14 /0 | 0; 0/0/0 | 2×2 | 0 | 0 | 60–110 | —; 0 | 0; — | 32271 /305620 | Heavy Boots `vbt` / Sharkskin Boots `xvb` / Scarabshell Boots `uvb` |
| 154 | Boneweave Boots `umb` | elite; general | 59–67 | 118 /0 | 54 /72 | 16 /0 | 0; 0/0/0 | 2×2 | 0 | 0 | 69–118 | —; 0 | 0; — | 36456 /352010 | Chain Boots `mbt` / Mesh Boots `xmb` / Boneweave Boots `umb` |
| 155 | Mirrored Boots `utb` | elite; general | 59–68 | 163 /0 | 60 /81 | 18 /0 | 0; 0/0/0 | 2×2 | 0 | 0 | 50–145 | —; 0 | 0; — | 41658 /420465 | Light Plated Boots `tbt` / Battle Boots `xtb` / Mirrored Boots `utb` |
| 156 | Myrmidon Greaves `uhb` | elite; general | 62–71 | 208 /0 | 65 /85 | 24 /0 | 0; 0/0/0 | 2×2 | 0 | 0 | 83–149 | —; 0 | 0; — | 45459 /497859 | Greaves `hbt` / War Boots `xhb` / Myrmidon Greaves `uhb` |

### A.A. Belt (`belt`)

| Line | Name /code | Tier; class | Defense | Str /Dex req | Req lvl /qlvl | Dur /noDur | Max sockets; caps | W×H | Weight speed | Block field | Smite or kick damage | Belt rows; raw belt id | Magic lvl; automod group | Base cost /gamble cost | Normal /exceptional /elite |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 40 | Sash [source: Sash(L)] `lbl` | normal; general | 2–2 | 0 /0 | 0 /3 | 12 /0 | 0; 0/0/0 | 2×1 | 0 | 0 | — | 2; 1 | 0; — | 64 /4048 | Sash `lbl` / Demonhide Sash `zlb` / Spiderweb Sash `ulc` |
| 41 | Light Belt `vbl` | normal; general | 3–3 | 0 /0 | 0 /7 | 14 /0 | 0; 0/0/0 | 2×1 | 0 | 0 | — | 2; 4 | 0; — | 192 /6336 | Light Belt `vbl` / Sharkskin Belt `zvb` / Vampirefang Belt `uvc` |
| 42 | Belt [source: Belt(M)] `mbl` | normal; general | 5–5 | 25 /0 | 0 /12 | 16 /0 | 0; 0/0/0 | 2×1 | 0 | 0 | — | 3; 0 | 0; — | 495 /9985 | Belt `mbl` / Mesh Belt `zmb` / Mithril Coil `umc` |
| 43 | Heavy Belt `tbl` | normal; general | 6–6 | 45 /0 | 0 /20 | 18 /0 | 0; 0/0/0 | 2×1 | 0 | 0 | — | 3; 5 | 0; — | 963 /17315 | Heavy Belt `tbl` / Battle Belt `ztb` / Troll Belt `utc` |
| 44 | Plated Belt [source: Girdle(H)] `hbl` | normal; general | 8–11 | 60 /0 | 0 /27 | 24 /0 | 0; 0/0/0 | 2×1 | 0 | 0 | — | 4; 3 | 0; — | 2068 /29959 | Plated Belt `hbl` / War Belt `zhb` / Colossus Girdle `uhc` |
| 86 | Demonhide Sash `zlb` | exceptional; general | 29–34 | 20 /0 | 24 /36 | 12 /0 | 0; 0/0/0 | 2×1 | 0 | 0 | — | 4; 6 | 0; — | 9304 /64486 | Sash `lbl` / Demonhide Sash `zlb` / Spiderweb Sash `ulc` |
| 87 | Sharkskin Belt `zvb` | exceptional; general | 31–36 | 20 /0 | 25 /39 | 14 /0 | 0; 0/0/0 | 2×1 | 0 | 0 | — | 4; 6 | 0; — | 10700 /80809 | Light Belt `vbl` / Sharkskin Belt `zvb` / Vampirefang Belt `uvc` |
| 88 | Mesh Belt `zmb` | exceptional; general | 35–40 | 58 /0 | 25 /43 | 16 /0 | 0; 0/0/0 | 2×1 | 0 | 0 | — | 4; 6 | 0; — | 13143 /108261 | Belt `mbl` / Mesh Belt `zmb` / Mithril Coil `umc` |
| 89 | Battle Belt `ztb` | exceptional; general | 37–42 | 88 /0 | 25 /49 | 18 /0 | 0; 0/0/0 | 2×1 | 0 | 0 | — | 4; 6 | 0; — | 15713 /151185 | Heavy Belt `tbl` / Battle Belt `ztb` / Troll Belt `utc` |
| 90 | War Belt `zhb` | exceptional; general | 41–52 | 110 /0 | 25 /54 | 24 /0 | 0; 0/0/0 | 2×1 | 0 | 0 | — | 4; 6 | 0; — | 20350 /218512 | Plated Belt `hbl` / War Belt `zhb` / Colossus Girdle `uhc` |
| 157 | Spiderweb Sash `ulc` | elite; general | 55–62 | 50 /0 | 46 /61 | 12 /0 | 0; 0/0/0 | 2×1 | 0 | 0 | — | 4; 6 | 0; — | 28842 /270466 | Sash `lbl` / Demonhide Sash `zlb` / Spiderweb Sash `ulc` |
| 158 | Vampirefang Belt `uvc` | elite; general | 56–63 | 50 /0 | 51 /68 | 14 /0 | 0; 0/0/0 | 2×1 | 0 | 0 | — | 4; 6 | 0; — | 32656 /300879 | Light Belt `vbl` / Sharkskin Belt `zvb` / Vampirefang Belt `uvc` |
| 159 | Mithril Coil `umc` | elite; general | 58–65 | 106 /0 | 56 /75 | 16 /0 | 0; 0/0/0 | 2×1 | 0 | 0 | — | 4; 6 | 0; — | 37134 /345000 | Belt `mbl` / Mesh Belt `zmb` / Mithril Coil `umc` |
| 160 | Troll Belt `utc` | elite; general | 59–66 | 151 /0 | 62 /82 | 18 /0 | 0; 0/0/0 | 2×1 | 0 | 0 | — | 4; 6 | 0; — | 41183 /411380 | Heavy Belt `tbl` / Battle Belt `ztb` / Troll Belt `utc` |
| 161 | Colossus Girdle `uhc` | elite; general | 61–71 | 185 /0 | 67 /85 | 24 /0 | 0; 0/0/0 | 2×1 | 0 | 0 | — | 4; 6 | 0; — | 45051 /493775 | Plated Belt `hbl` / War Belt `zhb` / Colossus Girdle `uhc` |

### A.A. Pelt (`pelt`)

| Line | Name /code | Tier; class | Defense | Str /Dex req | Req lvl /qlvl | Dur /noDur | Max sockets; caps | W×H | Weight speed | Block field | Smite or kick damage | Belt rows; raw belt id | Magic lvl; automod group | Base cost /gamble cost | Normal /exceptional /elite |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 95 | Wolf Head `dr1` | normal; Druid | 8–11 | 16 /0 | 3 /4 | 20 /0 | 3; 2/3/3 | 2×2 | 0 | 0 | — | —; 0 | 0; — | 364 /4868 | Wolf Head `dr1` / Alpha Helm `dr6` / Blood Spirit `drb` |
| 96 | Hawk Helm `dr2` | normal; Druid | 4–15 | 20 /0 | 6 /8 | 20 /0 | 3; 2/3/3 | 2×2 | 0 | 0 | — | —; 0 | 0; — | 664 /7840 | Hawk Helm `dr2` / Griffon Headdress `dr7` / Sun Spirit `drc` |
| 97 | Antlers `dr3` | normal; Druid | 18–24 | 24 /0 | 12 /16 | 20 /0 | 3; 2/3/3 | 2×2 | 0 | 0 | — | —; 0 | 0; — | 2832 /21852 | Antlers `dr3` / Hunter's Guise `dr8` / Earth Spirit `drd` |
| 98 | Falcon Mask `dr4` | normal; Druid | 12–28 | 28 /0 | 15 /20 | 20 /0 | 3; 2/3/3 | 2×2 | 0 | 0 | — | —; 0 | 0; — | 3332 /29200 | Falcon Mask `dr4` / Sacred Feathers `dr9` / Sky Spirit `dre` |
| 99 | Spirit Mask `dr5` | normal; Druid | 22–35 | 30 /0 | 18 /24 | 20 /0 | 3; 2/3/3 | 2×2 | 0 | 0 | — | —; 0 | 0; — | 5670 /48550 | Spirit Mask `dr5` / Totemic Mask `dra` / Dream Spirit `drf` |
| 165 | Alpha Helm `dr6` | exceptional; Druid | 52–62 | 44 /0 | 26 /35 | 20 /0 | 3; 2/3/3 | 2×2 | 0 | 0 | — | —; 0 | 0; — | 16300 /82061 | Wolf Head `dr1` / Alpha Helm `dr6` / Blood Spirit `drb` |
| 166 | Griffon Headdress [source: Griffon Headress] `dr7` | exceptional; Druid | 46–68 | 50 /0 | 30 /40 | 20 /0 | 3; 2/3/3 | 2×2 | 0 | 0 | — | —; 0 | 0; — | 18564 /82062 | Hawk Helm `dr2` / Griffon Headdress `dr7` / Sun Spirit `drc` |
| 167 | Hunter's Guise `dr8` | exceptional; Druid | 67–81 | 56 /0 | 29 /46 | 20 /0 | 3; 2/3/3 | 2×2 | 0 | 0 | — | —; 0 | 0; — | 27768 /82063 | Antlers `dr3` / Hunter's Guise `dr8` / Earth Spirit `drd` |
| 168 | Sacred Feathers `dr9` | exceptional; Druid | 58–87 | 62 /0 | 32 /50 | 20 /0 | 3; 2/3/3 | 2×2 | 0 | 0 | — | —; 0 | 0; — | 29518 /82064 | Falcon Mask `dr4` / Sacred Feathers `dr9` / Sky Spirit `dre` |
| 169 | Totemic Mask `dra` | exceptional; Druid | 73–98 | 65 /0 | 41 /55 | 20 /0 | 3; 2/3/3 | 2×2 | 0 | 0 | — | —; 0 | 0; — | 38127 /82065 | Spirit Mask `dr5` / Totemic Mask `dra` / Dream Spirit `drf` |
| 185 | Blood Spirit [source: Blood Spirt] `drb` | elite; Druid | 101–145 | 86 /0 | 46 /62 | 20 /0 | 3; 2/3/3 | 2×2 | 0 | 0 | — | —; 0 | 0; — | 61755 /413914 | Wolf Head `dr1` / Alpha Helm `dr6` / Blood Spirit `drb` |
| 186 | Sun Spirit `drc` | elite; Druid | 98–147 | 95 /0 | 51 /69 | 20 /0 | 3; 2/3/3 | 2×2 | 0 | 0 | — | —; 0 | 0; — | 68617 /413915 | Hawk Helm `dr2` / Griffon Headdress `dr7` / Sun Spirit `drc` |
| 187 | Earth Spirit `drd` | elite; Druid | 107–152 | 104 /0 | 57 /76 | 20 /0 | 3; 2/3/3 | 2×2 | 0 | 0 | — | —; 0 | 0; — | 79730 /413916 | Antlers `dr3` / Hunter's Guise `dr8` / Earth Spirit `drd` |
| 188 | Sky Spirit `dre` | elite; Druid | 103–155 | 113 /0 | 62 /83 | 20 /0 | 3; 2/3/3 | 2×2 | 0 | 0 | — | —; 0 | 0; — | 86575 /413917 | Falcon Mask `dr4` / Sacred Feathers `dr9` / Sky Spirit `dre` |
| 189 | Dream Spirit `drf` | elite; Druid | 109–159 | 118 /0 | 66 /85 | 20 /0 | 3; 2/3/3 | 2×2 | 0 | 0 | — | —; 0 | 0; — | 92143 /413918 | Spirit Mask `dr5` / Totemic Mask `dra` / Dream Spirit `drf` |

### A.A. Primal Helm (`phlm`)

| Line | Name /code | Tier; class | Defense | Str /Dex req | Req lvl /qlvl | Dur /noDur | Max sockets; caps | W×H | Weight speed | Block field | Smite or kick damage | Belt rows; raw belt id | Magic lvl; automod group | Base cost /gamble cost | Normal /exceptional /elite |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 100 | Jawbone Cap `ba1` | normal; Barbarian | 10–15 | 25 /0 | 3 /4 | 25 /0 | 3; 2/3/3 | 2×2 | 0 | 0 | — | —; 0 | 0; — | 320 /4750 | Jawbone Cap `ba1` / Jawbone Visor `ba6` / Carnage Helm `bab` |
| 101 | Fanged Helm `ba2` | normal; Barbarian | 15–20 | 35 /0 | 6 /8 | 35 /0 | 3; 2/3/3 | 2×2 | 0 | 0 | — | —; 0 | 0; — | 750 /8250 | Fanged Helm `ba2` / Lion Helm `ba7` / Fury Visor `bac` |
| 102 | Horned Helm `ba3` | normal; Barbarian | 25–30 | 45 /0 | 12 /16 | 45 /0 | 3; 2/3/3 | 2×2 | 0 | 0 | — | —; 0 | 0; — | 2750 /20750 | Horned Helm `ba3` / Rage Mask `ba8` / Destroyer Helm `bad` |
| 103 | Assault Helmet `ba4` | normal; Barbarian | 30–35 | 55 /0 | 15 /20 | 50 /0 | 3; 2/3/3 | 2×2 | 0 | 0 | — | —; 0 | 0; — | 3420 /29360 | Assault Helmet `ba4` / Savage Helmet `ba9` / Conqueror Crown `bae` |
| 104 | Avenger Guard `ba5` | normal; Barbarian | 35–50 | 65 /0 | 18 /24 | 55 /0 | 3; 2/3/3 | 2×2 | 0 | 0 | — | —; 0 | 0; — | 5785 /49280 | Avenger Guard `ba5` / Slayer Guard `baa` / Guardian Crown `baf` |
| 170 | Jawbone Visor `ba6` | exceptional; Barbarian | 55–68 | 58 /0 | 25 /33 | 25 /0 | 3; 2/3/3 | 2×2 | 0 | 0 | — | —; 0 | 0; — | 16603 /82061 | Jawbone Cap `ba1` / Jawbone Visor `ba6` / Carnage Helm `bab` |
| 171 | Lion Helm `ba7` | exceptional; Barbarian | 63–75 | 73 /0 | 29 /38 | 35 /0 | 3; 2/3/3 | 2×2 | 0 | 0 | — | —; 0 | 0; — | 21378 /82062 | Fanged Helm `ba2` / Lion Helm `ba7` / Fury Visor `bac` |
| 172 | Rage Mask `ba8` | exceptional; Barbarian | 78–90 | 88 /0 | 29 /44 | 45 /0 | 3; 2/3/3 | 2×2 | 0 | 0 | — | —; 0 | 0; — | 30063 /82063 | Horned Helm `ba3` / Rage Mask `ba8` / Destroyer Helm `bad` |
| 173 | Savage Helmet `ba9` | exceptional; Barbarian | 85–98 | 103 /0 | 32 /49 | 50 /0 | 3; 2/3/3 | 2×2 | 0 | 0 | — | —; 0 | 0; — | 36398 /82064 | Assault Helmet `ba4` / Savage Helmet `ba9` / Conqueror Crown `bae` |
| 174 | Slayer Guard `baa` | exceptional; Barbarian | 93–120 | 118 /0 | 40 /54 | 55 /0 | 3; 2/3/3 | 2×2 | 0 | 0 | — | —; 0 | 0; — | 46633 /82065 | Avenger Guard `ba5` / Slayer Guard `baa` / Guardian Crown `baf` |
| 190 | Carnage Helm `bab` | elite; Barbarian | 102–147 | 106 /0 | 45 /60 | 25 /0 | 3; 2/3/3 | 2×2 | 0 | 0 | — | —; 0 | 0; — | 60650 /413918 | Jawbone Cap `ba1` / Jawbone Visor `ba6` / Carnage Helm `bab` |
| 191 | Fury Visor `bac` | elite; Barbarian | 105–150 | 129 /0 | 49 /66 | 35 /0 | 3; 2/3/3 | 2×2 | 0 | 0 | — | —; 0 | 0; — | 68211 /413919 | Fanged Helm `ba2` / Lion Helm `ba7` / Fury Visor `bac` |
| 192 | Destroyer Helm `bad` | elite; Barbarian | 111–156 | 151 /0 | 54 /73 | 45 /0 | 3; 2/3/3 | 2×2 | 0 | 0 | — | —; 0 | 0; — | 78881 /413920 | Horned Helm `ba3` / Rage Mask `ba8` / Destroyer Helm `bad` |
| 193 | Conqueror Crown [source: Conquerer Crown] `bae` | elite; Barbarian | 114–159 | 174 /0 | 60 /80 | 50 /0 | 3; 2/3/3 | 2×2 | 0 | 0 | — | —; 0 | 0; — | 88278 /413921 | Assault Helmet `ba4` / Savage Helmet `ba9` / Conqueror Crown `bae` |
| 194 | Guardian Crown `baf` | elite; Barbarian | 117–168 | 196 /0 | 65 /85 | 55 /0 | 3; 2/3/3 | 2×2 | 0 | 0 | — | —; 0 | 0; — | 97844 /413922 | Avenger Guard `ba5` / Slayer Guard `baa` / Guardian Crown `baf` |

### A.A. Auric Shields (`ashd`)

| Line | Name /code | Tier; class | Defense | Str /Dex req | Req lvl /qlvl | Dur /noDur | Max sockets; caps | W×H | Weight speed | Block field | Smite or kick damage | Belt rows; raw belt id | Magic lvl; automod group | Base cost /gamble cost | Normal /exceptional /elite |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 105 | Targe `pa1` | normal; Paladin | 8–12 | 16 /0 | 3 /4 | 20 /0 | 4; 3/4/4 | 2×2 | 0 | 10 | 2–6 | —; 0 | 0; 304 | 384 /6317 | Targe `pa1` / Akaran Targe `pa6` / Sacred Targe `pab` |
| 106 | Rondache `pa2` | normal; Paladin | 10–18 | 26 /0 | 6 /8 | 30 /0 | 4; 3/4/4 | 2×2 | 0 | 15 | 2–8 | —; 0 | 0; 304 | 982 /10517 | Rondache `pa2` / Akaran Rondache `pa7` / Sacred Rondache `pac` |
| 107 | Heraldic Shield `pa3` | normal; Paladin | 16–26 | 40 /0 | 12 /16 | 40 /0 | 4; 3/4/4 | 2×4 | 0 | 20 | 3–9 | —; 0 | 0; 304 | 2816 /21240 | Heraldic Shield `pa3` / Protector Shield `pa8` / Kurast Shield `pad` |
| 108 | Aerin Shield `pa4` | normal; Paladin | 26–36 | 50 /0 | 15 /20 | 50 /0 | 4; 3/4/4 | 2×4 | 0 | 22 | 4–10 | —; 0 | 0; 304 | 5158 /43557 | Aerin Shield `pa4` / Gilded Shield `pa9` / Zakarum Shield `pae` |
| 109 | Crown Shield `pa5` | normal; Paladin | 30–40 | 65 /0 | 18 /24 | 60 /0 | 4; 3/4/4 | 2×2 | 0 | 25 | 4–12 | —; 0 | 0; 304 | 6935 /82075 | Crown Shield `pa5` / Royal Shield `paa` / Vortex Shield `paf` |
| 175 | Akaran Targe `pa6` | exceptional; Paladin | 101–125 | 44 /0 | 26 /35 | 20 /0 | 4; 3/4/4 | 2×2 | 0 | 10 | 12–16 | —; 0 | 0; 304 | 32500 /82065 | Targe `pa1` / Akaran Targe `pa6` / Sacred Targe `pab` |
| 176 | Akaran Rondache `pa7` | exceptional; Paladin | 113–137 | 59 /0 | 30 /40 | 30 /0 | 4; 3/4/4 | 2×2 | 0 | 15 | 15–20 | —; 0 | 0; 304 | 40941 /82066 | Rondache `pa2` / Akaran Rondache `pa7` / Sacred Rondache `pac` |
| 177 | Protector Shield `pa8` | exceptional; Paladin | 129–153 | 69 /0 | 34 /46 | 40 /0 | 4; 3/4/4 | 2×4 | 0 | 20 | 18–24 | —; 0 | 0; 304 | 52947 /82067 | Heraldic Shield `pa3` / Protector Shield `pa8` / Kurast Shield `pad` |
| 178 | Gilded Shield [source: Guilded Shield] `pa9` | exceptional; Paladin | 144–168 | 89 /0 | 38 /51 | 50 /0 | 4; 3/4/4 | 2×4 | 0 | 22 | 20–28 | —; 0 | 0; 304 | 64807 /82068 | Aerin Shield `pa4` / Gilded Shield `pa9` / Zakarum Shield `pae` |
| 179 | Royal Shield `paa` | exceptional; Paladin | 156–181 | 114 /0 | 41 /55 | 60 /0 | 4; 3/4/4 | 2×2 | 0 | 25 | 24–32 | —; 0 | 0; 304 | 75374 /82069 | Crown Shield `pa5` / Royal Shield `paa` / Vortex Shield `paf` |
| 195 | Sacred Targe `pab` | elite; Paladin | 126–158 | 86 /0 | 47 /63 | 45 /0 | 4; 3/4/4 | 2×2 | 0 | 30 | 22–70 | —; 0 | 0; 304 | 72618 /82065 | Targe `pa1` / Akaran Targe `pa6` / Sacred Targe `pab` |
| 196 | Sacred Rondache `pac` | elite; Paladin | 138–164 | 109 /0 | 52 /70 | 68 /0 | 4; 3/4/4 | 2×2 | 0 | 28 | 35–58 | —; 0 | 0; 304 | 85659 /82066 | Rondache `pa2` / Akaran Rondache `pa7` / Sacred Rondache `pac` |
| 197 | Kurast Shield [source: Ancient Shield] `pad` | elite; Paladin | 154–172 | 124 /0 | 55 /74 | 55 /0 | 4; 3/4/4 | 2×4 | 0 | 25 | 10–82 | —; 0 | 0; 304 | 97676 /82067 | Heraldic Shield `pa3` / Protector Shield `pa8` / Kurast Shield `pad` |
| 198 | Zakarum Shield `pae` | elite; Paladin | 169–193 | 142 /0 | 61 /82 | 65 /0 | 4; 3/4/4 | 2×4 | 0 | 22 | 46–46 | —; 0 | 0; 304 | 120042 /82068 | Aerin Shield `pa4` / Gilded Shield `pa9` / Zakarum Shield `pae` |
| 199 | Vortex Shield `paf` | elite; Paladin | 182–225 | 148 /0 | 66 /85 | 90 /0 | 4; 3/4/4 | 2×2 | 0 | 19 | 5–87 | —; 0 | 0; 304 | 139860 /82069 | Crown Shield `pa5` / Royal Shield `paa` / Vortex Shield `paf` |

### A.A. Voodoo Heads (`head`)

| Line | Name /code | Tier; class | Defense | Str /Dex req | Req lvl /qlvl | Dur /noDur | Max sockets; caps | W×H | Weight speed | Block field | Smite or kick damage | Belt rows; raw belt id | Magic lvl; automod group | Base cost /gamble cost | Normal /exceptional /elite |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 110 | Preserved Head `ne1` | normal; Necromancer | 2–5 | 12 /0 | 3 /4 | 20 /0 | 2; 2/2/2 | 2×2 | 0 | 3 | — | —; 0 | 0; 305 | 128 /4628 | Preserved Head `ne1` / Mummified Trophy `ne6` / Minion Skull `neb` |
| 111 | Zombie Head `ne2` | normal; Necromancer | 4–8 | 14 /0 | 6 /8 | 20 /0 | 2; 2/2/2 | 2×2 | 0 | 5 | — | —; 0 | 0; 305 | 418 /7336 | Zombie Head `ne2` / Fetish Trophy `ne7` / Hellspawn Skull `neg` |
| 112 | Unraveller Head `ne3` | normal; Necromancer | 6–10 | 18 /0 | 12 /16 | 20 /0 | 2; 2/2/2 | 2×2 | 0 | 8 | — | —; 0 | 0; 305 | 1070 /14780 | Unraveller Head `ne3` / Sexton Trophy `ne8` / Overseer Skull `ned` |
| 113 | Gargoyle Head `ne4` | normal; Necromancer | 10–16 | 20 /0 | 15 /20 | 20 /0 | 2; 2/2/2 | 2×2 | 0 | 10 | — | —; 0 | 0; 305 | 2164 /23320 | Gargoyle Head `ne4` / Cantor Trophy `ne9` / Succubae Skull `nee` |
| 114 | Demon Head `ne5` | normal; Necromancer | 15–20 | 25 /0 | 18 /24 | 20 /0 | 2; 2/2/2 | 2×2 | 0 | 12 | — | —; 0 | 0; 305 | 3475 /35350 | Demon Head `ne5` / Hierophant Trophy `nea` / Bloodlord Skull `nef` |
| 180 | Mummified Trophy `ne6` | exceptional; Necromancer | 38–48 | 38 /0 | 24 /33 | 20 /0 | 2; 2/2/2 | 2×2 | 0 | 3 | — | —; 0 | 0; 305 | 11590 /82069 | Preserved Head `ne1` / Mummified Trophy `ne6` / Minion Skull `neb` |
| 181 | Fetish Trophy `ne7` | exceptional; Necromancer | 41–52 | 41 /0 | 29 /39 | 20 /0 | 2; 2/2/2 | 2×2 | 0 | 5 | — | —; 0 | 0; 305 | 14839 /82070 | Zombie Head `ne2` / Fetish Trophy `ne7` / Hellspawn Skull `neg` |
| 182 | Sexton Trophy `ne8` | exceptional; Necromancer | 44–55 | 47 /0 | 33 /45 | 20 /0 | 2; 2/2/2 | 2×2 | 0 | 8 | — | —; 0 | 0; 305 | 18169 /82071 | Unraveller Head `ne3` / Sexton Trophy `ne8` / Overseer Skull `ned` |
| 183 | Cantor Trophy `ne9` | exceptional; Necromancer | 50–64 | 50 /0 | 36 /49 | 20 /0 | 2; 2/2/2 | 2×2 | 0 | 10 | — | —; 0 | 0; 305 | 22750 /82072 | Gargoyle Head `ne4` / Cantor Trophy `ne9` / Succubae Skull `nee` |
| 184 | Hierophant Trophy [source: Heirophant Trophy] `nea` | exceptional; Necromancer | 58–70 | 58 /0 | 40 /54 | 20 /0 | 2; 2/2/2 | 2×2 | 0 | 12 | — | —; 0 | 0; 305 | 27993 /82073 | Demon Head `ne5` / Hierophant Trophy `nea` / Bloodlord Skull `nef` |
| 200 | Minion Skull `neb` | elite; Necromancer | 95–139 | 77 /0 | 44 /59 | 20 /0 | 2; 2/2/2 | 2×2 | 0 | 3 | — | —; 0 | 0; 305 | 56131 /82069 | Preserved Head `ne1` / Mummified Trophy `ne6` / Minion Skull `neb` |
| 201 | Hellspawn Skull `neg` | elite; Necromancer | 96–141 | 82 /0 | 50 /67 | 20 /0 | 2; 2/2/2 | 2×2 | 0 | 5 | — | —; 0 | 0; 305 | 64437 /82070 | Zombie Head `ne2` / Fetish Trophy `ne7` / Hellspawn Skull `neg` |
| 202 | Overseer Skull `ned` | elite; Necromancer | 98–142 | 91 /0 | 49 /66 | 20 /0 | 2; 2/2/2 | 2×2 | 0 | 8 | — | —; 0 | 0; 305 | 64122 /82071 | Unraveller Head `ne3` / Sexton Trophy `ne8` / Overseer Skull `ned` |
| 203 | Succubae Skull `nee` | elite; Necromancer | 100–146 | 95 /0 | 60 /81 | 20 /0 | 2; 2/2/2 | 2×2 | 0 | 10 | — | —; 0 | 0; 305 | 80462 /82072 | Gargoyle Head `ne4` / Cantor Trophy `ne9` / Succubae Skull `nee` |
| 204 | Bloodlord Skull `nef` | elite; Necromancer | 103–148 | 106 /0 | 65 /85 | 20 /0 | 2; 2/2/2 | 2×2 | 0 | 12 | — | —; 0 | 0; 305 | 86238 /82073 | Demon Head `ne5` / Hierophant Trophy `nea` / Bloodlord Skull `nef` |

### A.A. Circlet (`circ`)

| Line | Name /code | Tier; class | Defense | Str /Dex req | Req lvl /qlvl | Dur /noDur | Max sockets; caps | W×H | Weight speed | Block field | Smite or kick damage | Belt rows; raw belt id | Magic lvl; automod group | Base cost /gamble cost | Normal /exceptional /elite |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 115 | Circlet `ci0` | normal; general | 20–30 | 0 /0 | 16 /24 | 35 /0 | 2; 1/2/2 | 2×2 | 0 | 0 | — | —; 0 | 3; — | 12000 /85625 | Circlet `ci0` / Tiara `ci2` / Diadem `ci3` |
| 116 | Coronet `ci1` | normal; general | 30–40 | 0 /0 | 39 /52 | 30 /0 | 2; 1/2/2 | 2×2 | 0 | 0 | — | —; 0 | 8; — | 23000 /171250 | Coronet `ci1` / Tiara `ci2` / Diadem `ci3` |
| 117 | Tiara `ci2` | exceptional; general | 40–50 | 0 /0 | 52 /70 | 25 /0 | 3; 1/2/3 | 2×2 | 0 | 0 | — | —; 0 | 13; — | 35000 /700000 | Coronet `ci1` / Tiara `ci2` / Diadem `ci3` |
| 118 | Diadem `ci3` | elite; general | 50–60 | 0 /0 | 64 /85 | 20 /0 | 3; 1/2/3 | 2×2 | 0 | 0 | — | —; 0 | 18; — | 58000 /1382500 | Coronet `ci1` / Tiara `ci2` / Diadem `ci3` |

## Appendix B. Complete ItemTypes inheritance and socket bands

[Source ItemTypes.txt](https://cdn.jsdelivr.net/gh/fabd/diablo2@45112569deb9384738ccafe5c24ebbb71f41c7c9/code/d2_113_data/ItemTypes.txt).

| Line | Type /code | Equiv1 /Equiv2 | Class | MaxSock1 /25 /40 | StaffMods | Repair | BodyLoc1 /2 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 4 | Shield `shie` | shld /— | — | 3 /3 /4 | — | 1 | rarm /larm |
| 5 | Armor `tors` | armo /— | — | 3 /4 /6 | — | 1 | tors /tors |
| 6 | Gold `gold` | misc /— | — | 0 /0 /0 | — | 0 | — /— |
| 7 | Bow Quiver `bowq` | misl /— | — | 0 /0 /0 | — | 0 | rarm /larm |
| 8 | Crossbow Quiver `xboq` | misl /— | — | 0 /0 /0 | — | 0 | rarm /larm |
| 9 | Player Body Part `play` | misc /— | — | 0 /0 /0 | — | 0 | — /— |
| 10 | Herb `herb` | misc /— | — | 0 /0 /0 | — | 0 | — /— |
| 11 | Potion `poti` | misc /— | — | 0 /0 /0 | — | 0 | — /— |
| 12 | Ring `ring` | misc /— | — | 0 /0 /0 | — | 0 | rrin /lrin |
| 13 | Elixir `elix` | misc /— | — | 0 /0 /0 | — | 0 | — /— |
| 14 | Amulet `amul` | misc /— | — | 0 /0 /0 | — | 0 | neck /neck |
| 15 | Charm `char` | misc /— | — | 0 /0 /0 | — | 0 | — /— |
| 17 | Boots `boot` | armo /— | — | 0 /0 /0 | — | 1 | feet /feet |
| 18 | Gloves `glov` | armo /— | — | 0 /0 /0 | — | 1 | glov /glov |
| 20 | Book `book` | misc /— | — | 0 /0 /0 | — | 0 | — /— |
| 21 | Belt `belt` | armo /— | — | 0 /0 /0 | — | 1 | belt /belt |
| 22 | Gem `gem` | sock /— | — | 0 /0 /0 | — | 0 | — /— |
| 23 | Torch `torc` | misc /— | — | 0 /0 /0 | — | 0 | — /— |
| 24 | Scroll `scro` | misc /— | — | 0 /0 /0 | — | 0 | — /— |
| 26 | Scepter `scep` | rod /— | — | 3 /5 /6 | pal | 1 | rarm /larm |
| 27 | Wand `wand` | rod /— | — | 2 /2 /2 | nec | 1 | rarm /larm |
| 28 | Staff `staf` | rod /— | — | 5 /6 /6 | sor | 1 | rarm /larm |
| 29 | Bow `bow` | miss /— | — | 3 /4 /6 | — | 0 | rarm /larm |
| 30 | Axe `axe` | mele /— | — | 4 /5 /6 | — | 1 | rarm /larm |
| 31 | Club `club` | blun /— | — | 3 /4 /6 | — | 1 | rarm /larm |
| 32 | Sword `swor` | mele /— | — | 3 /4 /6 | — | 1 | rarm /larm |
| 33 | Hammer `hamm` | blun /— | — | 3 /4 /6 | — | 1 | rarm /larm |
| 34 | Knife `knif` | mele /— | — | 2 /3 /3 | — | 1 | rarm /larm |
| 35 | Spear `spea` | mele /— | — | 3 /4 /6 | — | 1 | rarm /larm |
| 36 | Polearm `pole` | mele /— | — | 3 /4 /6 | — | 1 | rarm /larm |
| 37 | Crossbow `xbow` | miss /— | — | 3 /4 /6 | — | 1 | rarm /larm |
| 38 | Mace `mace` | blun /— | — | 3 /4 /6 | — | 1 | rarm /larm |
| 39 | Helm `helm` | armo /— | — | 2 /2 /3 | — | 1 | head /head |
| 40 | Missile Potion `tpot` | thro /— | — | 0 /0 /0 | — | 0 | rarm /larm |
| 41 | Quest `ques` | — /— | — | 0 /0 /0 | — | 0 | — /— |
| 42 | Body Part `body` | misc /— | — | 0 /0 /0 | — | 0 | — /— |
| 43 | Key `key` | misc /— | — | 0 /0 /0 | — | 0 | — /— |
| 44 | Throwing Knife `tkni` | comb /knif | — | 0 /0 /0 | — | 1 | rarm /larm |
| 45 | Throwing Axe `taxe` | comb /axe | — | 0 /0 /0 | — | 1 | rarm /larm |
| 46 | Javelin `jave` | comb /spea | — | 0 /0 /0 | — | 1 | rarm /larm |
| 47 | Weapon `weap` | — /— | — | 0 /0 /0 | — | 0 | — /— |
| 48 | Melee Weapon `mele` | weap /— | — | 0 /0 /0 | — | 0 | — /— |
| 49 | Missile Weapon `miss` | weap /— | — | 0 /0 /0 | — | 0 | — /— |
| 50 | Thrown Weapon `thro` | weap /— | — | 0 /0 /0 | — | 0 | — /— |
| 51 | Combo Weapon `comb` | mele /thro | — | 0 /0 /0 | — | 0 | — /— |
| 52 | Any Armor `armo` | — /— | — | 0 /0 /0 | — | 0 | — /— |
| 53 | Any Shield `shld` | armo /seco | — | 0 /0 /0 | — | 0 | — /— |
| 54 | Miscellaneous `misc` | — /— | — | 0 /0 /0 | — | 0 | — /— |
| 55 | Socket Filler `sock` | misc /— | — | 0 /0 /0 | — | 0 | — /— |
| 56 | Second Hand `seco` | — /— | — | 0 /0 /0 | — | 0 | — /— |
| 57 | Staves And Rods `rod` | blun /— | — | 0 /0 /0 | — | 0 | — /— |
| 58 | Missile `misl` | misc /— | — | 0 /0 /0 | — | 0 | — /— |
| 59 | Blunt `blun` | mele /— | — | 0 /0 /0 | — | 0 | — /— |
| 61 | Jewel `jewl` | sock /— | — | 0 /0 /0 | — | 0 | — /— |
| 62 | Class Specific `clas` | — /— | — | 0 /0 /0 | — | 0 | — /— |
| 63 | Amazon Item `amaz` | clas /— | Amazon | 0 /0 /0 | — | 0 | — /— |
| 64 | Barbarian Item `barb` | clas /— | Barbarian | 0 /0 /0 | — | 0 | — /— |
| 65 | Necromancer Item `necr` | clas /— | Necromancer | 0 /0 /0 | — | 0 | — /— |
| 66 | Paladin Item `pala` | clas /— | Paladin | 0 /0 /0 | — | 0 | — /— |
| 67 | Sorceress Item `sorc` | clas /— | Sorceress | 0 /0 /0 | — | 0 | — /— |
| 68 | Assassin Item `assn` | clas /— | Assassin | 0 /0 /0 | — | 0 | — /— |
| 69 | Druid Item `drui` | clas /— | Druid | 0 /0 /0 | — | 0 | — /— |
| 70 | Hand to Hand `h2h` | mele /assn | Assassin | 2 /3 /3 | — | 1 | rarm /larm |
| 71 | Orb `orb` | weap /sorc | Sorceress | 2 /3 /3 | sor | 1 | rarm /larm |
| 72 | Voodoo Heads `head` | shld /necr | Necromancer | 2 /3 /3 | nec | 1 | rarm /larm |
| 73 | Auric Shields `ashd` | shld /pala | Paladin | 3 /4 /4 | — | 1 | rarm /larm |
| 74 | Primal Helm `phlm` | helm /barb | Barbarian | 2 /3 /3 | bar | 1 | head /head |
| 75 | Pelt `pelt` | helm /drui | Druid | 2 /3 /3 | dru | 1 | head /head |
| 76 | Cloak `cloa` | tors /assn | Assassin | 0 /0 /0 | ass | 1 | tors /tors |
| 77 | Rune `rune` | sock /— | — | 0 /0 /0 | — | 0 | — /— |
| 78 | Circlet `circ` | helm /— | — | 1 /2 /3 | — | 1 | head /head |
| 79 | Healing Potion `hpot` | poti /— | — | 0 /0 /0 | — | 0 | — /— |
| 80 | Mana Potion `mpot` | poti /— | — | 0 /0 /0 | — | 0 | — /— |
| 81 | Rejuv Potion `rpot` | hpot /mpot | — | 0 /0 /0 | — | 0 | — /— |
| 82 | Stamina Potion `spot` | poti /— | — | 0 /0 /0 | — | 0 | — /— |
| 83 | Antidote Potion `apot` | poti /— | — | 0 /0 /0 | — | 0 | — /— |
| 84 | Thawing Potion `wpot` | poti /— | — | 0 /0 /0 | — | 0 | — /— |
| 85 | Small Charm `scha` | char /— | — | 0 /0 /0 | — | 0 | — /— |
| 86 | Medium Charm `mcha` | char /— | — | 0 /0 /0 | — | 0 | — /— |
| 87 | Large Charm `lcha` | char /— | — | 0 /0 /0 | — | 0 | — /— |
| 88 | Amazon Bow `abow` | bow /amaz | Amazon | 3 /4 /5 | — | 0 | rarm /larm |
| 89 | Amazon Spear `aspe` | spea /amaz | Amazon | 3 /4 /6 | — | 1 | rarm /larm |
| 90 | Amazon Javelin `ajav` | jave /amaz | Amazon | 0 /0 /0 | — | 1 | rarm /larm |
| 91 | Hand to Hand 2 `h2h2` | h2h /— | Assassin | 2 /3 /3 | ass | 1 | rarm /larm |
| 92 | Magic Bow Quiv `mboq` | bowq /— | — | 0 /0 /0 | — | 0 | rarm /larm |
| 93 | Magic Xbow Quiv `mxbq` | xboq /— | — | 0 /0 /0 | — | 0 | rarm /larm |
| 94 | Chipped Gem `gem0` | gem /— | — | 0 /0 /0 | — | 0 | — /— |
| 95 | Flawed Gem `gem1` | gem /— | — | 0 /0 /0 | — | 0 | — /— |
| 96 | Standard Gem `gem2` | gem /— | — | 0 /0 /0 | — | 0 | — /— |
| 97 | Flawless Gem `gem3` | gem /— | — | 0 /0 /0 | — | 0 | — /— |
| 98 | Perfect Gem `gem4` | gem /— | — | 0 /0 /0 | — | 0 | — /— |
| 99 | Amethyst `gema` | gem /— | — | 0 /0 /0 | — | 0 | — /— |
| 100 | Diamond `gemd` | gem /— | — | 0 /0 /0 | — | 0 | — /— |
| 101 | Emerald `geme` | gem /— | — | 0 /0 /0 | — | 0 | — /— |
| 102 | Ruby `gemr` | gem /— | — | 0 /0 /0 | — | 0 | — /— |
| 103 | Sapphire `gems` | gem /— | — | 0 /0 /0 | — | 0 | — /— |
| 104 | Topaz `gemt` | gem /— | — | 0 /0 /0 | — | 0 | — /— |
| 105 | Skull `gemz` | gem /— | — | 0 /0 /0 | — | 0 | — /— |

## Appendix C. All active LoD magic prefixes and suffixes

Filter: version1or100, spawnable1, frequency>0. Old classic version0 rows and unused zero-frequency entries are excluded. Affix group IDs remain separate from row IDs. Level is minimum alvl; MaxLevel blank/0 means no upper restriction. `Rare`1 also makes the affix eligible for crafts. Allowed/excluded sets inherit through Appendix B. Class columns preserve source restrictions.

[Source MagicPrefix.txt](https://cdn.jsdelivr.net/gh/fabd/diablo2@45112569deb9384738ccafe5c24ebbb71f41c7c9/code/d2_113_data/MagicPrefix.txt).


### MagicPrefix

| Line | Name | Version | Alvl /MaxLevel | Req lvl; class /class req | Frequency | Group | Rare | Allowed types | Excluded types | Modifiers /raw tuples | Price divide /multiply /add |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 121 | Stout | 100 | 1 /— | 1; 0:—/— | 4 | 101 | 1 | lcha | — | +3-5 Defense<br>RAW: `ac(_;3;5)` | 0 /0 /0 |
| 122 | Stout | 100 | 7 /— | 5; 0:—/— | 4 | 101 | 1 | lcha | — | +6-9 Defense<br>RAW: `ac(_;6;9)` | 0 /0 /0 |
| 123 | Stout | 100 | 12 /— | 9; 0:—/— | 4 | 101 | 1 | lcha | — | +10-12 Defense<br>RAW: `ac(_;10;12)` | 0 /0 /0 |
| 124 | Burly | 100 | 17 /— | 12; 0:—/— | 4 | 101 | 1 | lcha | — | +13-15 Defense<br>RAW: `ac(_;13;15)` | 0 /0 /0 |
| 125 | Burly | 100 | 22 /— | 16; 0:—/— | 4 | 101 | 1 | lcha | — | +16-22 Defense<br>RAW: `ac(_;16;22)` | 0 /0 /0 |
| 126 | Burly | 100 | 27 /— | 20; 0:—/— | 4 | 101 | 1 | lcha | — | +23-30 Defense<br>RAW: `ac(_;23;30)` | 0 /0 /0 |
| 127 | Stalwart | 100 | 32 /— | 24; 0:—/— | 4 | 101 | 0 | lcha | — | +33-40 Defense<br>RAW: `ac(_;33;40)` | 0 /0 /0 |
| 128 | Stalwart | 100 | 37 /— | 29; 0:—/— | 4 | 101 | 0 | lcha | — | +44-50 Defense<br>RAW: `ac(_;44;50)` | 0 /0 /0 |
| 129 | Stalwart | 100 | 42 /— | 34; 0:—/— | 4 | 101 | 0 | lcha | — | +60-100 Defense<br>RAW: `ac(_;60;100)` | 0 /0 /0 |
| 130 | Stout | 100 | 1 /— | 1; 0:—/— | 4 | 101 | 1 | mcha | — | +2-3 Defense<br>RAW: `ac(_;2;3)` | 0 /0 /0 |
| 131 | Stout | 100 | 14 /— | 10; 0:—/— | 4 | 101 | 1 | mcha | — | +4-6 Defense<br>RAW: `ac(_;4;6)` | 0 /0 /0 |
| 132 | Stout | 100 | 20 /— | 15; 0:—/— | 4 | 101 | 1 | mcha | — | +8-12 Defense<br>RAW: `ac(_;8;12)` | 0 /0 /0 |
| 133 | Burly | 100 | 26 /— | 19; 0:—/— | 4 | 101 | 1 | mcha | — | +13-18 Defense<br>RAW: `ac(_;13;18)` | 0 /0 /0 |
| 134 | Burly | 100 | 32 /— | 24; 0:—/— | 4 | 101 | 1 | mcha | — | +20-30 Defense<br>RAW: `ac(_;20;30)` | 0 /0 /0 |
| 135 | Stalwart | 100 | 38 /— | 30; 0:—/— | 4 | 101 | 0 | mcha | — | +30-40 Defense<br>RAW: `ac(_;30;40)` | 0 /0 /0 |
| 136 | Stalwart | 100 | 45 /— | 37; 0:—/— | 4 | 101 | 0 | mcha | — | +45-60 Defense<br>RAW: `ac(_;45;60)` | 0 /0 /0 |
| 137 | Stout | 100 | 1 /— | 1; 0:—/— | 4 | 101 | 1 | scha | — | +1 Defense<br>RAW: `ac(_;1;1)` | 0 /0 /0 |
| 138 | Stout | 100 | 21 /— | 15; 0:—/— | 4 | 101 | 1 | scha | — | +4-8 Defense<br>RAW: `ac(_;4;8)` | 0 /0 /0 |
| 139 | Burly | 100 | 36 /— | 28; 0:—/— | 4 | 101 | 1 | scha | — | +15-20 Defense<br>RAW: `ac(_;15;20)` | 0 /0 /0 |
| 140 | Stalwart | 100 | 48 /— | 40; 0:—/— | 4 | 101 | 0 | scha | — | +20-30 Defense<br>RAW: `ac(_;20;30)` | 0 /0 /0 |
| 141 | Blanched | 100 | 1 /— | 1; 0:—/— | 4 | 101 | 1 | jewl | — | +5-8 Defense<br>RAW: `ac(_;5;8)` | 0 /0 /0 |
| 142 | Eburin | 100 | 16 /— | 12; 0:—/— | 4 | 101 | 1 | jewl | — | +9-20 Defense<br>RAW: `ac(_;9;20)` | 0 /0 /0 |
| 143 | Bone | 100 | 32 /— | 24; 0:—/— | 4 | 101 | 1 | jewl | — | +21-40 Defense<br>RAW: `ac(_;21;40)` | 0 /0 /0 |
| 144 | Ivory | 100 | 64 /— | 56; 0:—/— | 4 | 101 | 0 | jewl | — | +41-64 Defense<br>RAW: `ac(_;41;64)` | 0 /0 /0 |
| 145 | Sturdy | 1 | 1 /— | 1; 0:—/— | 9 | 101 | 1 | armo | — | 10-20% Enhanced Defense<br>RAW: `ac%(_;10;20)` | 0 /0 /0 |
| 146 | Sturdy | 1 | 4 /— | 3; 0:—/— | 9 | 101 | 1 | armo | — | 21-30% Enhanced Defense<br>RAW: `ac%(_;21;30)` | 0 /0 /0 |
| 147 | Strong | 1 | 9 /— | 6; 0:—/— | 8 | 101 | 1 | armo | — | 31-40% Enhanced Defense<br>RAW: `ac%(_;31;40)` | 0 /0 /0 |
| 148 | Glorious | 1 | 19 /— | 14; 0:—/— | 8 | 101 | 1 | armo | — | 41-50% Enhanced Defense<br>RAW: `ac%(_;41;50)` | 0 /0 /0 |
| 149 | Blessed | 1 | 25 /— | 18; 0:—/— | 7 | 101 | 1 | armo | — | 51-65% Enhanced Defense<br>RAW: `ac%(_;51;65)` | 0 /0 /0 |
| 150 | Saintly | 1 | 31 /— | 23; 0:—/— | 7 | 101 | 1 | armo | — | 66-80% Enhanced Defense<br>RAW: `ac%(_;66;80)` | 0 /0 /0 |
| 151 | Holy | 1 | 36 /— | 27; 0:—/— | 6 | 101 | 1 | armo | — | 81-100% Enhanced Defense<br>RAW: `ac%(_;81;100)` | 0 /0 /0 |
| 152 | Godly | 100 | 45 /— | 38; 0:—/— | 3 | 101 | 0 | armo | — | 101-200% Enhanced Defense<br>RAW: `ac%(_;101;200)` | 0 /0 /0 |
| 168 | Scarlet | 100 | 8 /— | 6; 0:—/— | 4 | 103 | 1 | jewl | — | +1-4 to Minimum Damage<br>RAW: `dmg-min(_;1;4)` | 0 /0 /0 |
| 169 | Crimson | 100 | 38 /— | 30; 0:—/— | 4 | 103 | 1 | jewl | — | +5-8 to Minimum Damage<br>RAW: `dmg-min(_;5;8)` | 0 /0 /0 |
| 185 | Carbuncle | 100 | 12 /— | 9; 0:—/— | 4 | 104 | 1 | jewl | — | +1-5 to Maximum Damage<br>RAW: `dmg-max(_;1;5)` | 0 /0 /0 |
| 186 | Carmine | 100 | 35 /— | 27; 0:—/— | 4 | 104 | 1 | jewl | — | +6-9 to Maximum Damage<br>RAW: `dmg-max(_;6;9)` | 0 /0 /0 |
| 187 | Vermillion | 100 | 58 /— | 50; 0:—/— | 4 | 104 | 0 | jewl | — | +11-15 to Maximum Damage<br>RAW: `dmg-max(_;11;15)` | 0 /0 /0 |
| 188 | Jagged | 1 | 1 /— | 1; 0:—/— | 9 | 105 | 1 | weap, circ | staf, wand, orb | 10-20% Enhanced Damage<br>RAW: `dmg%(_;10;20)` | 0 /0 /0 |
| 189 | Deadly | 1 | 5 /— | 3; 0:—/— | 9 | 105 | 1 | weap, circ | staf, wand, orb | 21-30% Enhanced Damage<br>RAW: `dmg%(_;21;30)` | 0 /0 /0 |
| 190 | Vicious | 1 | 8 /— | 6; 0:—/— | 8 | 105 | 1 | weap | staf, wand, orb | 31-40% Enhanced Damage<br>RAW: `dmg%(_;31;40)` | 0 /0 /0 |
| 191 | Brutal | 1 | 14 /— | 10; 0:—/— | 8 | 105 | 1 | weap | staf, wand, orb | 41-50% Enhanced Damage<br>RAW: `dmg%(_;41;50)` | 0 /0 /0 |
| 192 | Massive | 1 | 20 /— | 15; 0:—/— | 7 | 105 | 1 | weap | staf, wand, orb | 51-65% Enhanced Damage<br>RAW: `dmg%(_;51;65)` | 0 /0 /0 |
| 193 | Savage | 1 | 26 /— | 19; 0:—/— | 7 | 105 | 1 | weap | staf, wand, orb | 66-80% Enhanced Damage<br>RAW: `dmg%(_;66;80)` | 0 /0 /0 |
| 194 | Merciless | 1 | 32 /— | 24; 0:—/— | 6 | 105 | 1 | weap | staf, wand, orb | 81-100% Enhanced Damage<br>RAW: `dmg%(_;81;100)` | 0 /0 /0 |
| 195 | Ferocious | 100 | 41 /— | 33; 0:—/— | 6 | 105 | 1 | weap | staf, wand, orb | 101-200% Enhanced Damage<br>RAW: `dmg%(_;101;200)` | 0 /0 /0 |
| 196 | Cruel | 100 | 51 /— | 43; 0:—/— | 5 | 105 | 0 | weap | staf, wand, orb | 201-300% Enhanced Damage<br>RAW: `dmg%(_;201;300)` | 0 /0 /0 |
| 197 | Cinnabar | 100 | 1 /— | 1; 0:—/— | 4 | 105 | 1 | jewl | — | 5-10% Enhanced Damage<br>RAW: `dmg%(_;5;10)` | 0 /0 /0 |
| 198 | Rusty | 100 | 13 /— | 9; 0:—/— | 4 | 105 | 1 | jewl | — | 11-20% Enhanced Damage<br>RAW: `dmg%(_;11;20)` | 0 /0 /0 |
| 199 | Realgar | 100 | 45 /— | 37; 0:—/— | 4 | 105 | 1 | jewl | — | 21-30% Enhanced Damage<br>RAW: `dmg%(_;21;30)` | 0 /0 /0 |
| 200 | Ruby | 100 | 66 /— | 58; 0:—/— | 4 | 105 | 0 | jewl | — | 31-40% Enhanced Damage<br>RAW: `dmg%(_;31;40)` | 0 /0 /0 |
| 201 | Vulpine | 1 | 9 /— | 6; 0:—/— | 3 | 107 | 1 | shld, amul, orb, staf | — | 7-12% Damage Taken Goes To Mana<br>RAW: `dmg-to-mana(_;7;12)` | 0 /0 /0 |
| 202 | Dun | 100 | 7 /— | 5; 0:—/— | 3 | 107 | 1 | jewl | — | 7-12% Damage Taken Goes To Mana<br>RAW: `dmg-to-mana(_;7;12)` | 0 /0 /0 |
| 203 | Tireless | 1 | 6 /— | 4; 0:—/— | 4 | 108 | 1 | boot | — | Heal Stamina Plus 25%<br>RAW: `regen-stam(_;25;25)` | 0 /0 /0 |
| 204 | Tireless | 100 | 14 /— | 10; 0:—/— | 4 | 108 | 1 | boot | — | Heal Stamina Plus 50%<br>RAW: `regen-stam(_;50;50)` | 0 /0 /0 |
| 205 | Brown | 100 | 39 /— | 31; 0:—/— | 4 | 108 | 1 | jewl | — | Heal Stamina Plus 10-15%<br>RAW: `regen-stam(_;10;15)` | 0 /0 /0 |
| 206 | Rugged | 100 | 1 /— | 1; 0:—/— | 4 | 109 | 1 | lcha | — | +12-24 Maximum Stamina<br>RAW: `stam(_;12;24)` | 0 /0 /0 |
| 207 | Rugged | 100 | 7 /— | 5; 0:—/— | 4 | 109 | 1 | lcha | — | +25-36 Maximum Stamina<br>RAW: `stam(_;25;36)` | 0 /0 /0 |
| 208 | Rugged | 100 | 21 /— | 15; 0:—/— | 4 | 109 | 1 | lcha | — | +37-50 Maximum Stamina<br>RAW: `stam(_;37;50)` | 0 /0 /0 |
| 209 | Rugged | 100 | 1 /— | ; 0:—/— | 4 | 109 | 1 | mcha | — | +8-16 Maximum Stamina<br>RAW: `stam(_;8;16)` | 0 /0 /0 |
| 210 | Rugged | 100 | 7 /— | 5; 0:—/— | 4 | 109 | 1 | mcha | — | +17-25 Maximum Stamina<br>RAW: `stam(_;17;25)` | 0 /0 /0 |
| 211 | Rugged | 100 | 21 /— | 15; 0:—/— | 4 | 109 | 1 | mcha | — | +26-32 Maximum Stamina<br>RAW: `stam(_;26;32)` | 0 /0 /0 |
| 212 | Rugged | 100 | 1 /— | ; 0:—/— | 4 | 109 | 1 | scha | — | +4-8 Maximum Stamina<br>RAW: `stam(_;4;8)` | 0 /0 /0 |
| 213 | Rugged | 100 | 21 /— | 15; 0:—/— | 4 | 109 | 1 | scha | — | +9-16 Maximum Stamina<br>RAW: `stam(_;9;16)` | 0 /0 /0 |
| 214 | Rugged | 1 | 1 /— | 1; 0:—/— | 4 | 109 | 1 | boot, glov, belt, ring, amul, circ | — | +5-10 Maximum Stamina<br>RAW: `stam(_;5;10)` | 0 /0 /0 |
| 215 | Rugged | 1 | 8 /— | 6; 0:—/— | 4 | 109 | 1 | boot, belt | — | +11-20 Maximum Stamina<br>RAW: `stam(_;11;20)` | 0 /0 /0 |
| 216 | Rugged | 1 | 8 /— | 6; 0:—/— | 4 | 109 | 1 | ring, amul, circ | — | +11-20 Maximum Stamina<br>RAW: `stam(_;11;20)` | 0 /0 /0 |
| 217 | Vigorous | 100 | 16 /— | 12; 0:—/— | 4 | 109 | 1 | boot, belt | — | +21-30 Maximum Stamina<br>RAW: `stam(_;21;30)` | 0 /0 /0 |
| 218 | Chestnut | 100 | 1 /— | 1; 0:—/— | 4 | 109 | 1 | jewl | — | +10-15 Maximum Stamina<br>RAW: `stam(_;10;15)` | 0 /0 /0 |
| 219 | Maroon | 100 | 17 /— | 12; 0:—/— | 4 | 109 | 1 | jewl | — | +16-25 Maximum Stamina<br>RAW: `stam(_;16;25)` | 0 /0 /0 |
| 220 | Bronze | 100 | 1 /— | 1; 0:—/— | 4 | 110 | 1 | lcha | — | +6-12 to Attack Rating<br>RAW: `att(_;6;12)` | 0 /0 /0 |
| 221 | Bronze | 100 | 7 /— | 5; 0:—/— | 4 | 110 | 1 | lcha | — | +13-27 to Attack Rating<br>RAW: `att(_;13;27)` | 0 /0 /0 |
| 222 | Bronze | 100 | 13 /— | 9; 0:—/— | 4 | 110 | 1 | lcha | — | +28-42 to Attack Rating<br>RAW: `att(_;28;42)` | 0 /0 /0 |
| 223 | Iron | 100 | 19 /— | 14; 0:—/— | 4 | 110 | 1 | lcha | — | +43-57 to Attack Rating<br>RAW: `att(_;43;57)` | 0 /0 /0 |
| 224 | Iron | 100 | 25 /— | 18; 0:—/— | 4 | 110 | 1 | lcha | — | +58-72 to Attack Rating<br>RAW: `att(_;58;72)` | 0 /0 /0 |
| 225 | Iron | 100 | 31 /— | 23; 0:—/— | 4 | 110 | 1 | lcha | — | +73-87 to Attack Rating<br>RAW: `att(_;73;87)` | 0 /0 /0 |
| 226 | Steel | 100 | 37 /— | 29; 0:—/— | 4 | 110 | 0 | lcha | — | +88-102 to Attack Rating<br>RAW: `att(_;88;102)` | 0 /0 /0 |
| 227 | Steel | 100 | 43 /— | 35; 0:—/— | 4 | 110 | 0 | lcha | — | +103-117 to Attack Rating<br>RAW: `att(_;103;117)` | 0 /0 /0 |
| 228 | Steel | 100 | 49 /— | 41; 0:—/— | 4 | 110 | 0 | lcha | — | +118-132 to Attack Rating<br>RAW: `att(_;118;132)` | 0 /0 /0 |
| 229 | Bronze | 100 | 1 /— | 1; 0:—/— | 4 | 110 | 1 | mcha | — | +4-8 to Attack Rating<br>RAW: `att(_;4;8)` | 0 /0 /0 |
| 230 | Bronze | 100 | 7 /— | 5; 0:—/— | 4 | 110 | 1 | mcha | — | +6-12 to Attack Rating<br>RAW: `att(_;6;12)` | 0 /0 /0 |
| 231 | Bronze | 100 | 16 /— | 12; 0:—/— | 4 | 110 | 1 | mcha | — | +13-25 to Attack Rating<br>RAW: `att(_;13;25)` | 0 /0 /0 |
| 232 | Iron | 100 | 25 /— | 18; 0:—/— | 4 | 110 | 1 | mcha | — | +26-38 to Attack Rating<br>RAW: `att(_;26;38)` | 0 /0 /0 |
| 233 | Iron | 100 | 34 /— | 26; 0:—/— | 4 | 110 | 1 | mcha | — | +39-51 to Attack Rating<br>RAW: `att(_;39;51)` | 0 /0 /0 |
| 234 | Steel | 100 | 43 /— | 36; 0:—/— | 4 | 110 | 0 | mcha | — | +52-64 to Attack Rating<br>RAW: `att(_;52;64)` | 0 /0 /0 |
| 235 | Steel | 100 | 52 /— | 44; 0:—/— | 4 | 110 | 0 | mcha | — | +65-77 to Attack Rating<br>RAW: `att(_;65;77)` | 0 /0 /0 |
| 236 | Bronze | 100 | 1 /— | 1; 0:—/— | 4 | 110 | 1 | scha | — | +2-4 to Attack Rating<br>RAW: `att(_;2;4)` | 0 /0 /0 |
| 237 | Bronze | 100 | 21 /— | 15; 0:—/— | 4 | 110 | 1 | scha | — | +6-12 to Attack Rating<br>RAW: `att(_;6;12)` | 0 /0 /0 |
| 238 | Iron | 100 | 39 /— | 31; 0:—/— | 4 | 110 | 1 | scha | — | +13-24 to Attack Rating<br>RAW: `att(_;13;24)` | 0 /0 /0 |
| 239 | Steel | 100 | 57 /— | 49; 0:—/— | 4 | 110 | 0 | scha | — | +25-36 to Attack Rating<br>RAW: `att(_;25;36)` | 0 /0 /0 |
| 240 | Bronze | 1 | 1 /— | 1; 0:—/— | 8 | 110 | 1 | weap, ring, glov, amul, circ | staf, wand, orb | +10-20 to Attack Rating<br>RAW: `att(_;10;20)` | 0 /0 /0 |
| 241 | Iron | 1 | 4 /— | 3; 0:—/— | 8 | 110 | 1 | weap, ring, circ | staf, wand, orb | +21-40 to Attack Rating<br>RAW: `att(_;21;40)` | 0 /0 /0 |
| 242 | Steel | 1 | 8 /— | 6; 0:—/— | 7 | 110 | 1 | weap, ring, circ | staf, wand, orb | +41-60 to Attack Rating<br>RAW: `att(_;41;60)` | 0 /0 /0 |
| 243 | Silver | 1 | 12 /— | 9; 0:—/— | 7 | 110 | 1 | weap, ring, circ | staf, wand, orb | +61-80 to Attack Rating<br>RAW: `att(_;61;80)` | 0 /0 /0 |
| 244 | Gold | 1 | 17 /— | 12; 0:—/— | 6 | 110 | 1 | weap, ring, circ | staf, wand, orb | +81-100 to Attack Rating<br>RAW: `att(_;81;100)` | 0 /0 /0 |
| 245 | Platinum | 1 | 22 /— | 16; 0:—/— | 6 | 110 | 1 | weap, ring, circ | staf, wand, orb | +101-120 to Attack Rating<br>RAW: `att(_;101;120)` | 0 /0 /0 |
| 246 | Meteoric | 1 | 27 /— | 20; 0:—/— | 5 | 110 | 1 | weap | staf, wand, orb | +121-150 to Attack Rating<br>RAW: `att(_;121;150)` | 0 /0 /0 |
| 247 | Strange | 100 | 32 /— | 24; 0:—/— | 5 | 110 | 1 | weap | staf, wand, orb | +151-300 to Attack Rating<br>RAW: `att(_;151;300)` | 0 /0 /0 |
| 248 | Weird | 100 | 37 /— | 27; 0:—/— | 4 | 110 | 0 | weap | staf, wand, orb | +301-450 to Attack Rating<br>RAW: `att(_;301;450)` | 0 /0 /0 |
| 249 | Nickel | 100 | 1 /— | 1; 0:—/— | 4 | 110 | 1 | jewl | — | +10-20 to Attack Rating<br>RAW: `att(_;10;20)` | 0 /0 /0 |
| 250 | Tin | 100 | 8 /— | 6; 0:—/— | 4 | 110 | 1 | jewl | — | +21-40 to Attack Rating<br>RAW: `att(_;21;40)` | 0 /0 /0 |
| 251 | Silver | 100 | 25 /— | 18; 0:—/— | 4 | 110 | 1 | jewl | — | +41-60 to Attack Rating<br>RAW: `att(_;41;60)` | 0 /0 /0 |
| 252 | Argent | 100 | 44 /— | 36; 0:—/— | 4 | 110 | 0 | jewl | — | +61-100 to Attack Rating<br>RAW: `att(_;61;100)` | 0 /0 /0 |
| 253 | Fine | 100 | 15 /— | 11; 0:—/— | 4 | 111 | 1 | lcha | — | +10-20 to Attack Rating; +1-3 to Maximum Damage<br>RAW: `att(_;10;20); dmg-max(_;1;3)` | 0 /0 /0 |
| 254 | Fine | 100 | 22 /— | 16; 0:—/— | 4 | 111 | 1 | lcha | — | +21-48 to Attack Rating; +4-6 to Maximum Damage<br>RAW: `att(_;21;48); dmg-max(_;4;6)` | 0 /0 /0 |
| 255 | Sharp | 100 | 29 /— | 21; 0:—/— | 4 | 111 | 1 | lcha | — | +49-76 to Attack Rating; +7-10 to Maximum Damage<br>RAW: `att(_;49;76); dmg-max(_;7;10)` | 0 /0 /0 |
| 256 | Fine | 100 | 19 /— | 14; 0:—/— | 4 | 111 | 1 | mcha | — | +10-20 to Attack Rating; +1-3 to Maximum Damage<br>RAW: `att(_;10;20); dmg-max(_;1;3)` | 0 /0 /0 |
| 257 | Sharp | 100 | 28 /— | 21; 0:—/— | 4 | 111 | 1 | mcha | — | +21-48 to Attack Rating; +4-6 to Maximum Damage<br>RAW: `att(_;21;48); dmg-max(_;4;6)` | 0 /0 /0 |
| 258 | Fine | 100 | 28 /— | 21; 0:—/— | 4 | 111 | 0 | scha | — | +10-20 to Attack Rating; +1-3 to Maximum Damage<br>RAW: `att(_;10;20); dmg-max(_;1;3)` | 0 /0 /0 |
| 259 | Sharp | 1 | 5 /— | 3; 0:—/— | 9 | 111 | 1 | weap | staf, wand, orb | +10-20 to Attack Rating; 10-20% Enhanced Damage<br>RAW: `att(_;10;20); dmg%(_;10;20)` | 0 /0 /0 |
| 260 | Fine | 1 | 12 /— | 9; 0:—/— | 9 | 111 | 1 | weap | staf, wand, orb | +21-40 to Attack Rating; 21-30% Enhanced Damage<br>RAW: `att(_;21;40); dmg%(_;21;30)` | 0 /0 /0 |
| 261 | Warrior's | 1 | 19 /— | 13; 0:—/— | 8 | 111 | 1 | weap | staf, wand, orb | +41-60 to Attack Rating; 31-40% Enhanced Damage<br>RAW: `att(_;41;60); dmg%(_;31;40)` | 0 /0 /0 |
| 262 | Soldier's | 1 | 27 /— | 19; 0:—/— | 8 | 111 | 1 | weap | staf, wand, orb | +61-80 to Attack Rating; 41-50% Enhanced Damage<br>RAW: `att(_;61;80); dmg%(_;41;50)` | 0 /0 /0 |
| 263 | Knight's | 1 | 38 /— | 30; 0:—/— | 7 | 111 | 1 | weap | staf, wand, orb | +81-100 to Attack Rating; 51-65% Enhanced Damage<br>RAW: `att(_;81;100); dmg%(_;51;65)` | 0 /0 /0 |
| 264 | Lord's | 1 | 47 /— | 39; 0:—/— | 6 | 111 | 1 | weap | staf, wand, orb | +101-120 to Attack Rating; 66-80% Enhanced Damage<br>RAW: `att(_;101;120); dmg%(_;66;80)` | 0 /0 /0 |
| 265 | King's | 1 | 56 /— | 48; 0:—/— | 5 | 111 | 1 | weap | staf, wand, orb | +121-150 to Attack Rating; 81-100% Enhanced Damage<br>RAW: `att(_;121;150); dmg%(_;81;100)` | 0 /0 /0 |
| 266 | Master's | 100 | 56 /— | 48; 0:—/— | 5 | 111 | 1 | weap | staf, wand, orb | +151-250 to Attack Rating; 101-150% Enhanced Damage<br>RAW: `att(_;151;250); dmg%(_;101;150)` | 0 /0 /0 |
| 267 | Grandmaster's | 100 | 69 /— | 61; 0:—/— | 4 | 111 | 0 | weap | staf, wand, orb | +251-300 to Attack Rating; 151-200% Enhanced Damage<br>RAW: `att(_;251;300); dmg%(_;151;200)` | 0 /0 /0 |
| 268 | Glimmering | 1 | 1 /— | 1; 0:—/— | 1 | 112 | 1 | armo, wand, staf, ring, amul, orb | — | +1 to Light Radius<br>RAW: `light(_;1;1)` | 0 /0 /0 |
| 269 | Glowing | 1 | 6 /— | 4; 0:—/— | 1 | 112 | 1 | armo, wand, staf, ring, amul, orb | — | +2 to Light Radius<br>RAW: `light(_;2;2)` | 0 /0 /0 |
| 270 | Bright | 100 | 1 /— | 1; 0:—/— | 1 | 112 | 1 | jewl | — | +1 to Light Radius; +10 to Attack Rating<br>RAW: `light(_;1;1); att(_;10;10)` | 0 /0 /0 |
| 271 | Screaming | 100 | 10 /— | 7; 0:—/— | 3 | 113 | 1 | weap | miss, swor, axe, pole, spea | Hit Causes Monster to Flee 25% (raw /128 chance)<br>RAW: `howl(_;32;32)` | 0 /0 /0 |
| 272 | Howling | 1 | 16 /— | 12; 0:—/— | 3 | 113 | 1 | weap | miss, swor, axe, pole, spea | Hit Causes Monster to Flee 50% (raw /128 chance)<br>RAW: `howl(_;64;64)` | 0 /0 /0 |
| 273 | Wailing | 100 | 20 /— | 13; 0:—/— | 3 | 113 | 1 | weap | miss, swor, axe, pole, spea | Hit Causes Monster to Flee 100% (raw /128 chance)<br>RAW: `howl(_;128;128)` | 0 /0 /0 |
| 274 | Screaming | 100 | 10 /— | 7; 0:—/— | 4 | 113 | 1 | miss | — | Hit Causes Monster to Flee 12% (raw /128 chance)<br>RAW: `howl(_;16;16)` | 0 /0 /0 |
| 275 | Howling | 100 | 16 /— | 12; 0:—/— | 4 | 113 | 1 | miss | — | Hit Causes Monster to Flee 18% (raw /128 chance)<br>RAW: `howl(_;24;24)` | 0 /0 /0 |
| 276 | Wailing | 100 | 24 /— | 18; 0:—/— | 4 | 113 | 0 | miss | — | Hit Causes Monster to Flee 25% (raw /128 chance)<br>RAW: `howl(_;32;32)` | 0 /0 /0 |
| 277 | Lucky | 100 | 21 /— | ; 0:—/— | 4 | 114 | 1 | lcha | — | 1-4% Better Chance of Getting Magic Items<br>RAW: `mag%(_;1;4)` | 0 /0 /0 |
| 278 | Lucky | 100 | 38 /— | ; 0:—/— | 4 | 114 | 0 | lcha | — | 5-7% Better Chance of Getting Magic Items<br>RAW: `mag%(_;5;7)` | 0 /0 /0 |
| 279 | Lucky | 100 | 55 /— | ; 0:—/— | 4 | 114 | 0 | lcha | — | 8-12% Better Chance of Getting Magic Items<br>RAW: `mag%(_;8;12)` | 0 /0 /0 |
| 280 | Lucky | 100 | 34 /— | ; 0:—/— | 4 | 114 | 1 | mcha | — | 1% Better Chance of Getting Magic Items<br>RAW: `mag%(_;1;1)` | 0 /0 /0 |
| 281 | Lucky | 100 | 53 /— | ; 0:—/— | 4 | 114 | 0 | mcha | — | 2-3% Better Chance of Getting Magic Items<br>RAW: `mag%(_;2;3)` | 0 /0 /0 |
| 282 | Lucky | 100 | 51 /— | ; 0:—/— | 4 | 114 | 0 | mcha | — | 4-6% Better Chance of Getting Magic Items<br>RAW: `mag%(_;4;6)` | 0 /0 /0 |
| 283 | Felicitous | 100 | 5 /— | 3; 0:—/— | 4 | 114 | 1 | ring, amul, circ | — | 5-10% Better Chance of Getting Magic Items<br>RAW: `mag%(_;5;10)` | 0 /0 /0 |
| 284 | Fortuitous | 1 | 12 /— | 8; 0:—/— | 4 | 114 | 0 | ring, amul, circ | — | 11-15% Better Chance of Getting Magic Items<br>RAW: `mag%(_;11;15)` | 0 /0 /0 |
| 285 | Emerald | 100 | 16 /— | 12; 0:—/— | 4 | 114 | 1 | jewl | — | 3-7% Better Chance of Getting Magic Items<br>RAW: `mag%(_;3;7)` | 0 /0 /0 |
| 286 | Lizard's | 100 | 1 /— | 1; 0:—/— | 4 | 115 | 1 | lcha | — | +3-7 to Mana<br>RAW: `mana(_;3;7)` | 0 /0 /0 |
| 287 | Lizard's | 100 | 7 /— | 5; 0:—/— | 4 | 115 | 1 | lcha | — | +8-13 to Mana<br>RAW: `mana(_;8;13)` | 0 /0 /0 |
| 288 | Lizard's | 100 | 13 /— | 9; 0:—/— | 4 | 115 | 1 | lcha | — | +14-20 to Mana<br>RAW: `mana(_;14;20)` | 0 /0 /0 |
| 289 | Snake's | 100 | 19 /— | 14; 0:—/— | 4 | 115 | 1 | lcha | — | +21-26 to Mana<br>RAW: `mana(_;21;26)` | 0 /0 /0 |
| 290 | Snake's | 100 | 25 /— | 18; 0:—/— | 4 | 115 | 1 | lcha | — | +27-33 to Mana<br>RAW: `mana(_;27;33)` | 0 /0 /0 |
| 291 | Snake's | 100 | 31 /— | 23; 0:—/— | 4 | 115 | 1 | lcha | — | +34-39 to Mana<br>RAW: `mana(_;34;39)` | 0 /0 /0 |
| 292 | Serpent's | 100 | 37 /— | 29; 0:—/— | 4 | 115 | 1 | lcha | — | +40-46 to Mana<br>RAW: `mana(_;40;46)` | 0 /0 /0 |
| 293 | Serpent's | 100 | 43 /— | 35; 0:—/— | 4 | 115 | 1 | lcha | — | +47-52 to Mana<br>RAW: `mana(_;47;52)` | 0 /0 /0 |
| 294 | Serpent's | 100 | 49 /— | 41; 0:—/— | 4 | 115 | 1 | lcha | — | +53-59 to Mana<br>RAW: `mana(_;53;59)` | 0 /0 /0 |
| 295 | Lizard's | 100 | 1 /— | 1; 0:—/— | 4 | 115 | 1 | mcha | — | +2-4 to Mana<br>RAW: `mana(_;2;4)` | 0 /0 /0 |
| 296 | Lizard's | 100 | 9 /— | 6; 0:—/— | 4 | 115 | 1 | mcha | — | +5-7 to Mana<br>RAW: `mana(_;5;7)` | 0 /0 /0 |
| 297 | Lizard's | 100 | 17 /— | 12; 0:—/— | 4 | 115 | 1 | mcha | — | +8-12 to Mana<br>RAW: `mana(_;8;12)` | 0 /0 /0 |
| 298 | Snake's | 100 | 25 /— | 18; 0:—/— | 4 | 115 | 1 | mcha | — | +13-18 to Mana<br>RAW: `mana(_;13;18)` | 0 /0 /0 |
| 299 | Snake's | 100 | 33 /— | 25; 0:—/— | 4 | 115 | 1 | mcha | — | +19-23 to Mana<br>RAW: `mana(_;19;23)` | 0 /0 /0 |
| 300 | Serpent's | 100 | 41 /— | 33; 0:—/— | 4 | 115 | 1 | mcha | — | +24-29 to Mana<br>RAW: `mana(_;24;29)` | 0 /0 /0 |
| 301 | Serpent's | 100 | 49 /— | 41; 0:—/— | 4 | 115 | 1 | mcha | — | +30-34 to Mana<br>RAW: `mana(_;30;34)` | 0 /0 /0 |
| 302 | Lizard's | 100 | 16 /— | 12; 0:—/— | 4 | 115 | 1 | scha | — | +1-2 to Mana<br>RAW: `mana(_;1;2)` | 0 /0 /0 |
| 303 | Lizard's | 100 | 16 /— | 12; 0:—/— | 4 | 115 | 1 | scha | — | +3-7 to Mana<br>RAW: `mana(_;3;7)` | 0 /0 /0 |
| 304 | Snake's | 100 | 32 /— | 24; 0:—/— | 4 | 115 | 1 | scha | — | +8-12 to Mana<br>RAW: `mana(_;8;12)` | 0 /0 /0 |
| 305 | Serpent's | 100 | 48 /— | 40; 0:—/— | 4 | 115 | 0 | scha | — | +13-17 to Mana<br>RAW: `mana(_;13;17)` | 0 /0 /0 |
| 306 | Lizard's | 1 | 3 /— | 2; 0:—/— | 4 | 115 | 1 | armo, ring, amul, rod, orb | boot, glov | +3-5 to Mana<br>RAW: `mana(_;3;5)` | 0 /0 /0 |
| 307 | Snake's | 1 | 6 /— | 4; 0:—/— | 4 | 115 | 1 | shld, rod, belt, ring, amul, circ | — | +5-10 to Mana<br>RAW: `mana(_;5;10)` | 0 /0 /0 |
| 308 | Serpent's | 1 | 14 /— | 10; 0:—/— | 3 | 115 | 1 | shld, rod, belt, ring, amul, circ | — | +11-20 to Mana<br>RAW: `mana(_;11;20)` | 0 /0 /0 |
| 309 | Serpent's | 1 | 37 /— | 27; 0:—/— | 2 | 115 | 1 | tors, boot, glov, weap, orb | rod | +11-20 to Mana<br>RAW: `mana(_;11;20)` | 0 /0 /0 |
| 310 | Drake's | 1 | 20 /— | 15; 0:—/— | 2 | 115 | 1 | rod, ring, amul, orb, circ | — | +21-30 to Mana<br>RAW: `mana(_;21;30)` | 0 /0 /0 |
| 311 | Dragon's | 1 | 24 /— | 18; 0:—/— | 2 | 115 | 1 | rod, ring, amul, orb, circ | — | +31-40 to Mana<br>RAW: `mana(_;31;40)` | 0 /0 /0 |
| 312 | Dragon's | 1 | 52 /— | 39; 0:—/— | 2 | 115 | 1 | tors, boot, glov | — | +31-40 to Mana<br>RAW: `mana(_;31;40)` | 0 /0 /0 |
| 313 | Wyrm's | 1 | 30 /— | 22; 0:—/— | 2 | 115 | 1 | rod, ring, amul, orb, circ | — | +41-60 to Mana<br>RAW: `mana(_;41;60)` | 0 /0 /0 |
| 314 | Great Wyrm's | 100 | 37 /— | 29; 0:—/— | 2 | 115 | 1 | rod, ring, amul, orb, circ | — | +61-90 to Mana<br>RAW: `mana(_;61;90)` | 0 /0 /0 |
| 315 | Bahamut's | 100 | 45 /— | 37; 0:—/— | 2 | 115 | 0 | rod, ring, amul, orb, circ | — | +91-120 to Mana<br>RAW: `mana(_;91;120)` | 0 /0 /0 |
| 316 | Zircon | 100 | 3 /— | 2; 0:—/— | 2 | 115 | 1 | jewl | — | +5-10 to Mana<br>RAW: `mana(_;5;10)` | 0 /0 /0 |
| 317 | Jacinth | 100 | 17 /— | 12; 0:—/— | 2 | 115 | 1 | jewl | — | +11-15 to Mana<br>RAW: `mana(_;11;15)` | 0 /0 /0 |
| 318 | Turquoise | 100 | 29 /— | 21; 0:—/— | 2 | 115 | 0 | jewl | — | +16-20 to Mana<br>RAW: `mana(_;16;20)` | 0 /0 /0 |
| 319 | Shimmering | 100 | 8 /13 | 6; 0:—/— | 1 | 116 | 0 | lcha | — | All Resistances +3-6<br>RAW: `res-all(_;3;6)` | 0 /1280 /500 |
| 320 | Shimmering | 100 | 14 /34 | 10; 0:—/— | 1 | 116 | 0 | lcha | — | All Resistances +8-12<br>RAW: `res-all(_;8;12)` | 0 /1280 /1500 |
| 321 | Shimmering | 100 | 35 /— | 27; 0:—/— | 1 | 116 | 0 | lcha | — | All Resistances +13-15<br>RAW: `res-all(_;13;15)` | 0 /1280 /5000 |
| 322 | Shimmering | 100 | 17 /33 | 12; 0:—/— | 1 | 116 | 0 | mcha | — | All Resistances +3-5<br>RAW: `res-all(_;3;5)` | 0 /1280 /1500 |
| 323 | Shimmering | 100 | 34 /— | 26; 0:—/— | 1 | 116 | 0 | mcha | — | All Resistances +6-8<br>RAW: `res-all(_;6;8)` | 0 /1280 /5000 |
| 324 | Shimmering | 100 | 33 /— | 25; 0:—/— | 1 | 116 | 0 | scha | — | All Resistances +3-5<br>RAW: `res-all(_;3;5)` | 0 /1280 /10000 |
| 325 | Shimmering | 100 | 6 /— | 4; 0:—/— | 5 | 116 | 1 | shld | — | All Resistances +3-7<br>RAW: `res-all(_;3;7)` | 0 /1280 /500 |
| 326 | Rainbow | 100 | 18 /— | 13; 0:—/— | 5 | 116 | 1 | shld | — | All Resistances +8-11<br>RAW: `res-all(_;8;11)` | 0 /1280 /2000 |
| 327 | Scintillating | 100 | 28 /— | 21; 0:—/— | 5 | 116 | 1 | shld | — | All Resistances +12-15<br>RAW: `res-all(_;12;15)` | 0 /1280 /4000 |
| 328 | Prismatic | 1 | 39 /— | 31; 0:—/— | 4 | 116 | 1 | shld | — | All Resistances +16-20<br>RAW: `res-all(_;16;20)` | 0 /1280 /8000 |
| 329 | Chromatic | 100 | 50 /— | 42; 0:—/— | 4 | 116 | 0 | shld | — | All Resistances +21-30<br>RAW: `res-all(_;21;30)` | 0 /1280 /16000 |
| 330 | Shimmering | 100 | 8 /— | 6; 0:—/— | 5 | 116 | 1 | amul, circ | — | All Resistances +3-7<br>RAW: `res-all(_;3;7)` | 0 /1280 /3000 |
| 331 | Rainbow | 100 | 21 /— | 15; 0:—/— | 5 | 116 | 1 | amul, circ | — | All Resistances +8-11<br>RAW: `res-all(_;8;11)` | 0 /1280 /6000 |
| 332 | Scintillating | 100 | 34 /— | 25; 0:—/— | 5 | 116 | 1 | amul, circ | — | All Resistances +12-15<br>RAW: `res-all(_;12;15)` | 0 /1280 /12000 |
| 333 | Prismatic | 1 | 42 /— | 31; 0:—/— | 4 | 116 | 1 | amul, circ | — | All Resistances +16-20<br>RAW: `res-all(_;16;20)` | 0 /1280 /24000 |
| 334 | Chromatic | 100 | 55 /— | 41; 0:—/— | 3 | 116 | 0 | amul, circ | — | All Resistances +21-30<br>RAW: `res-all(_;21;30)` | 0 /1280 /32000 |
| 335 | Shimmering | 100 | 45 /— | 37; 0:—/— | 3 | 116 | 1 | ring | — | All Resistances +3-7<br>RAW: `res-all(_;3;7)` | 0 /1280 /4000 |
| 336 | Rainbow | 100 | 56 /— | 48; 0:—/— | 2 | 116 | 1 | ring | — | All Resistances +8-11<br>RAW: `res-all(_;8;11)` | 0 /1280 /8000 |
| 337 | Scintillating | 100 | 67 /— | 59; 0:—/— | 2 | 116 | 0 | ring | — | All Resistances +12-15<br>RAW: `res-all(_;12;15)` | 0 /1280 /16000 |
| 338 | Shimmering | 100 | 16 /— | 12; 0:—/— | 1 | 116 | 1 | jewl | — | All Resistances +5-10<br>RAW: `res-all(_;5;10)` | 0 /1280 /3000 |
| 339 | Scintillating | 100 | 34 /— | 26; 0:—/— | 1 | 116 | 0 | jewl | — | All Resistances +11-15<br>RAW: `res-all(_;11;15)` | 0 /1280 /8000 |
| 340 | Azure | 100 | 1 /— | 1; 0:—/— | 2 | 117 | 1 | lcha | — | Cold Resist +7-15%<br>RAW: `res-cold(_;7;15)` | 0 /0 /0 |
| 341 | Lapis | 100 | 10 /— | 7; 0:—/— | 2 | 117 | 1 | lcha | — | Cold Resist +16-20%<br>RAW: `res-cold(_;16;20)` | 0 /0 /0 |
| 342 | Cobalt | 100 | 20 /— | 15; 0:—/— | 2 | 117 | 1 | lcha | — | Cold Resist +21-25%<br>RAW: `res-cold(_;21;25)` | 0 /0 /0 |
| 343 | Sapphire | 100 | 30 /— | 22; 0:—/— | 2 | 117 | 0 | lcha | — | Cold Resist +26-30%<br>RAW: `res-cold(_;26;30)` | 0 /0 /0 |
| 344 | Azure | 100 | 1 /— | 1; 0:—/— | 2 | 117 | 1 | mcha | — | Cold Resist +4-7%<br>RAW: `res-cold(_;4;7)` | 0 /0 /0 |
| 345 | Lapis | 100 | 16 /— | 12; 0:—/— | 2 | 117 | 1 | mcha | — | Cold Resist +8-10%<br>RAW: `res-cold(_;8;10)` | 0 /0 /0 |
| 346 | Cobalt | 100 | 25 /— | 18; 0:—/— | 2 | 117 | 1 | mcha | — | Cold Resist +11-12%<br>RAW: `res-cold(_;11;12)` | 0 /0 /0 |
| 347 | Sapphire | 100 | 35 /— | 27; 0:—/— | 2 | 117 | 0 | mcha | — | Cold Resist +13-15%<br>RAW: `res-cold(_;13;15)` | 0 /0 /0 |
| 348 | Azure | 100 | 1 /— | 1; 0:—/— | 2 | 117 | 1 | scha | — | Cold Resist +3-5%<br>RAW: `res-cold(_;3;5)` | 0 /0 /0 |
| 349 | Lapis | 100 | 14 /— | 10; 0:—/— | 2 | 117 | 1 | scha | — | Cold Resist +6-7%<br>RAW: `res-cold(_;6;7)` | 0 /0 /0 |
| 350 | Cobalt | 100 | 27 /— | 20; 0:—/— | 2 | 117 | 1 | scha | — | Cold Resist +8-9%<br>RAW: `res-cold(_;8;9)` | 0 /0 /0 |
| 351 | Sapphire | 100 | 40 /— | 32; 0:—/— | 2 | 117 | 0 | scha | — | Cold Resist +10-11%<br>RAW: `res-cold(_;10;11)` | 0 /0 /0 |
| 352 | Azure | 1 | 5 /— | 3; 0:—/— | 2 | 117 | 1 | armo, weap, ring, amul, orb, circ | — | Cold Resist +5-10%<br>RAW: `res-cold(_;5;10)` | 0 /0 /0 |
| 353 | Lapis | 1 | 12 /— | 9; 0:—/— | 4 | 117 | 1 | armo, ring, amul, orb, circ | — | Cold Resist +11-20%<br>RAW: `res-cold(_;11;20)` | 0 /0 /0 |
| 354 | Lapis | 1 | 35 /— | 26; 0:—/— | 2 | 117 | 1 | weap | orb | Cold Resist +11-20%<br>RAW: `res-cold(_;11;20)` | 0 /0 /0 |
| 355 | Cobalt | 1 | 18 /— | 13; 0:—/— | 3 | 117 | 1 | armo, ring, amul, orb, circ | — | Cold Resist +21-30%<br>RAW: `res-cold(_;21;30)` | 0 /0 /0 |
| 356 | Cobalt | 1 | 55 /— | 41; 0:—/— | 2 | 117 | 1 | weap | orb | Cold Resist +21-30%<br>RAW: `res-cold(_;21;30)` | 0 /0 /0 |
| 357 | Sapphire | 1 | 25 /— | 18; 0:—/— | 3 | 117 | 1 | rod, boot, amul, orb, circ | — | Cold Resist +31-40%<br>RAW: `res-cold(_;31;40)` | 0 /0 /0 |
| 358 | Lapis Lazuli | 100 | 2 /— | 1; 0:—/— | 4 | 117 | 1 | jewl | — | Cold Resist +5-15%<br>RAW: `res-cold(_;5;15)` | 0 /0 /0 |
| 359 | Sapphire | 100 | 19 /— | 14; 0:—/— | 4 | 117 | 1 | jewl | — | Cold Resist +16-30%<br>RAW: `res-cold(_;16;30)` | 0 /0 /0 |
| 360 | Crimson | 100 | 1 /— | 1; 0:—/— | 2 | 118 | 1 | lcha | — | Fire Resist +7-15%<br>RAW: `res-fire(_;7;15)` | 0 /0 /0 |
| 361 | Russet | 100 | 10 /— | 7; 0:—/— | 2 | 118 | 1 | lcha | — | Fire Resist +16-20%<br>RAW: `res-fire(_;16;20)` | 0 /0 /0 |
| 362 | Garnet | 100 | 20 /— | 15; 0:—/— | 2 | 118 | 1 | lcha | — | Fire Resist +21-25%<br>RAW: `res-fire(_;21;25)` | 0 /0 /0 |
| 363 | Ruby | 100 | 30 /— | 22; 0:—/— | 2 | 118 | 0 | lcha | — | Fire Resist +26-30%<br>RAW: `res-fire(_;26;30)` | 0 /0 /0 |
| 364 | Crimson | 100 | 1 /— | 1; 0:—/— | 2 | 118 | 1 | mcha | — | Fire Resist +4-7%<br>RAW: `res-fire(_;4;7)` | 0 /0 /0 |
| 365 | Russet | 100 | 16 /— | 12; 0:—/— | 2 | 118 | 1 | mcha | — | Fire Resist +8-10%<br>RAW: `res-fire(_;8;10)` | 0 /0 /0 |
| 366 | Garnet | 100 | 25 /— | 18; 0:—/— | 2 | 118 | 1 | mcha | — | Fire Resist +11-12%<br>RAW: `res-fire(_;11;12)` | 0 /0 /0 |
| 367 | Ruby | 100 | 35 /— | 27; 0:—/— | 2 | 118 | 0 | mcha | — | Fire Resist +13-15%<br>RAW: `res-fire(_;13;15)` | 0 /0 /0 |
| 368 | Crimson | 100 | 1 /— | 1; 0:—/— | 2 | 118 | 1 | scha | — | Fire Resist +3-5%<br>RAW: `res-fire(_;3;5)` | 0 /0 /0 |
| 369 | Russet | 100 | 14 /— | 10; 0:—/— | 2 | 118 | 1 | scha | — | Fire Resist +6-7%<br>RAW: `res-fire(_;6;7)` | 0 /0 /0 |
| 370 | Garnet | 100 | 27 /— | 20; 0:—/— | 2 | 118 | 0 | scha | — | Fire Resist +8-9%<br>RAW: `res-fire(_;8;9)` | 0 /0 /0 |
| 371 | Ruby | 100 | 40 /— | 32; 0:—/— | 2 | 118 | 1 | scha | — | Fire Resist +10-11%<br>RAW: `res-fire(_;10;11)` | 0 /0 /0 |
| 372 | Russet | 1 | 12 /— | 9; 0:—/— | 4 | 118 | 1 | armo, ring, amul, orb, circ | — | Fire Resist +11-20%<br>RAW: `res-fire(_;11;20)` | 0 /0 /0 |
| 373 | Russet | 1 | 35 /— | 26; 0:—/— | 1 | 118 | 1 | weap | orb | Fire Resist +11-20%<br>RAW: `res-fire(_;11;20)` | 0 /0 /0 |
| 374 | Garnet | 1 | 18 /— | 13; 0:—/— | 3 | 118 | 1 | armo, ring, amul, orb, circ | — | Fire Resist +21-30%<br>RAW: `res-fire(_;21;30)` | 0 /0 /0 |
| 375 | Garnet | 1 | 55 /— | 41; 0:—/— | 1 | 118 | 1 | weap | orb | Fire Resist +21-30%<br>RAW: `res-fire(_;21;30)` | 0 /0 /0 |
| 376 | Ruby | 1 | 25 /— | 18; 0:—/— | 3 | 118 | 1 | rod, boot, amul, orb, circ | — | Fire Resist +31-40%<br>RAW: `res-fire(_;31;40)` | 0 /0 /0 |
| 377 | Garnet | 100 | 2 /— | 1; 0:—/— | 4 | 117 | 1 | jewl | — | Fire Resist +5-15%<br>RAW: `res-fire(_;5;15)` | 0 /0 /0 |
| 378 | Ruby | 100 | 18 /— | 13; 0:—/— | 4 | 117 | 1 | jewl | — | Fire Resist +16-30%<br>RAW: `res-fire(_;16;30)` | 0 /0 /0 |
| 379 | Tangerine | 100 | 1 /— | 1; 0:—/— | 2 | 119 | 1 | lcha | — | Lightning Resist +7-15%<br>RAW: `res-ltng(_;7;15)` | 0 /0 /0 |
| 380 | Ocher | 100 | 10 /— | 7; 0:—/— | 2 | 119 | 1 | lcha | — | Lightning Resist +16-20%<br>RAW: `res-ltng(_;16;20)` | 0 /0 /0 |
| 381 | Coral | 100 | 20 /— | 15; 0:—/— | 2 | 119 | 1 | lcha | — | Lightning Resist +21-25%<br>RAW: `res-ltng(_;21;25)` | 0 /0 /0 |
| 382 | Amber | 100 | 30 /— | 22; 0:—/— | 2 | 119 | 0 | lcha | — | Lightning Resist +26-30%<br>RAW: `res-ltng(_;26;30)` | 0 /0 /0 |
| 383 | Tangerine | 100 | 1 /— | 1; 0:—/— | 2 | 119 | 1 | mcha | — | Lightning Resist +4-7%<br>RAW: `res-ltng(_;4;7)` | 0 /0 /0 |
| 384 | Ocher | 100 | 16 /— | 12; 0:—/— | 2 | 119 | 1 | mcha | — | Lightning Resist +8-10%<br>RAW: `res-ltng(_;8;10)` | 0 /0 /0 |
| 385 | Coral | 100 | 25 /— | 18; 0:—/— | 2 | 119 | 1 | mcha | — | Lightning Resist +11-12%<br>RAW: `res-ltng(_;11;12)` | 0 /0 /0 |
| 386 | Amber | 100 | 35 /— | 27; 0:—/— | 2 | 119 | 0 | mcha | — | Lightning Resist +13-15%<br>RAW: `res-ltng(_;13;15)` | 0 /0 /0 |
| 387 | Tangerine | 100 | 1 /— | 1; 0:—/— | 2 | 119 | 1 | scha | — | Lightning Resist +3-5%<br>RAW: `res-ltng(_;3;5)` | 0 /0 /0 |
| 388 | Ocher | 100 | 14 /— | 10; 0:—/— | 2 | 119 | 1 | scha | — | Lightning Resist +6-7%<br>RAW: `res-ltng(_;6;7)` | 0 /0 /0 |
| 389 | Coral | 100 | 27 /— | 20; 0:—/— | 2 | 119 | 1 | scha | — | Lightning Resist +8-9%<br>RAW: `res-ltng(_;8;9)` | 0 /0 /0 |
| 390 | Amber | 100 | 40 /— | 32; 0:—/— | 2 | 119 | 0 | scha | — | Lightning Resist +10-11%<br>RAW: `res-ltng(_;10;11)` | 0 /0 /0 |
| 391 | Tangerine | 1 | 5 /— | 3; 0:—/— | 4 | 119 | 1 | armo, weap, ring, amul, orb, circ | — | Lightning Resist +5-10%<br>RAW: `res-ltng(_;5;10)` | 0 /0 /0 |
| 392 | Ocher | 1 | 12 /— | 9; 0:—/— | 4 | 119 | 1 | armo, ring, amul, orb, circ | — | Lightning Resist +11-20%<br>RAW: `res-ltng(_;11;20)` | 0 /0 /0 |
| 393 | Ocher | 1 | 35 /— | 26; 0:—/— | 1 | 119 | 1 | weap | orb | Lightning Resist +11-20%<br>RAW: `res-ltng(_;11;20)` | 0 /0 /0 |
| 394 | Coral | 1 | 18 /— | 13; 0:—/— | 3 | 119 | 1 | armo, ring, amul, orb, circ | — | Lightning Resist +21-30%<br>RAW: `res-ltng(_;21;30)` | 0 /0 /0 |
| 395 | Coral | 1 | 55 /— | 41; 0:—/— | 1 | 119 | 1 | weap | orb | Lightning Resist +21-30%<br>RAW: `res-ltng(_;21;30)` | 0 /0 /0 |
| 396 | Amber | 1 | 25 /— | 18; 0:—/— | 3 | 119 | 1 | rod, boot, amul, orb, circ | — | Lightning Resist +31-40%<br>RAW: `res-ltng(_;31;40)` | 0 /0 /0 |
| 397 | Camphor | 100 | 2 /— | 1; 0:—/— | 4 | 117 | 1 | jewl | — | Lightning Resist +5-15%<br>RAW: `res-ltng(_;5;15)` | 0 /0 /0 |
| 398 | Ambergris | 100 | 19 /— | 14; 0:—/— | 4 | 117 | 1 | jewl | — | Lightning Resist +16-30%<br>RAW: `res-ltng(_;16;30)` | 0 /0 /0 |
| 399 | Beryl | 100 | 1 /— | 1; 0:—/— | 2 | 120 | 1 | lcha | — | Poison Resist +7-15%<br>RAW: `res-pois(_;7;15)` | 0 /0 /0 |
| 400 | Viridian | 100 | 10 /— | 7; 0:—/— | 2 | 120 | 1 | lcha | — | Poison Resist +16-20%<br>RAW: `res-pois(_;16;20)` | 0 /0 /0 |
| 401 | Jade | 100 | 20 /— | 15; 0:—/— | 2 | 120 | 1 | lcha | — | Poison Resist +21-25%<br>RAW: `res-pois(_;21;25)` | 0 /0 /0 |
| 402 | Emerald | 100 | 30 /— | 22; 0:—/— | 2 | 120 | 0 | lcha | — | Poison Resist +26-30%<br>RAW: `res-pois(_;26;30)` | 0 /0 /0 |
| 403 | Beryl | 100 | 1 /— | 1; 0:—/— | 2 | 120 | 1 | mcha | — | Poison Resist +4-7%<br>RAW: `res-pois(_;4;7)` | 0 /0 /0 |
| 404 | Viridian | 100 | 16 /— | 12; 0:—/— | 2 | 120 | 1 | mcha | — | Poison Resist +8-10%<br>RAW: `res-pois(_;8;10)` | 0 /0 /0 |
| 405 | Jade | 100 | 25 /— | 18; 0:—/— | 2 | 120 | 1 | mcha | — | Poison Resist +11-12%<br>RAW: `res-pois(_;11;12)` | 0 /0 /0 |
| 406 | Emerald | 100 | 35 /— | 27; 0:—/— | 2 | 120 | 0 | mcha | — | Poison Resist +13-15%<br>RAW: `res-pois(_;13;15)` | 0 /0 /0 |
| 407 | Beryl | 100 | 1 /— | 1; 0:—/— | 2 | 120 | 1 | scha | — | Poison Resist +3-5%<br>RAW: `res-pois(_;3;5)` | 0 /0 /0 |
| 408 | Viridian | 100 | 14 /— | 10; 0:—/— | 2 | 120 | 1 | scha | — | Poison Resist +6-7%<br>RAW: `res-pois(_;6;7)` | 0 /0 /0 |
| 409 | Jade | 100 | 27 /— | 20; 0:—/— | 2 | 120 | 1 | scha | — | Poison Resist +8-9%<br>RAW: `res-pois(_;8;9)` | 0 /0 /0 |
| 410 | Emerald | 100 | 40 /— | 32; 0:—/— | 2 | 120 | 0 | scha | — | Poison Resist +10-11%<br>RAW: `res-pois(_;10;11)` | 0 /0 /0 |
| 411 | Beryl | 1 | 5 /— | 3; 0:—/— | 4 | 120 | 1 | armo, weap, ring, amul, orb, circ | — | Poison Resist +5-10%<br>RAW: `res-pois(_;5;10)` | 0 /0 /0 |
| 412 | Viridian | 1 | 12 /— | 9; 0:—/— | 4 | 120 | 1 | armo, ring, amul, orb, circ | — | Poison Resist +11-20%<br>RAW: `res-pois(_;11;20)` | 0 /0 /0 |
| 413 | Viridian | 1 | 35 /— | 26; 0:—/— | 1 | 120 | 1 | weap | orb | Poison Resist +11-20%<br>RAW: `res-pois(_;11;20)` | 0 /0 /0 |
| 414 | Jade | 1 | 18 /— | 13; 0:—/— | 3 | 120 | 1 | armo, ring, amul, orb, circ | — | Poison Resist +21-30%<br>RAW: `res-pois(_;21;30)` | 0 /0 /0 |
| 415 | Jade | 1 | 55 /— | 41; 0:—/— | 1 | 120 | 1 | weap | orb | Poison Resist +21-30%<br>RAW: `res-pois(_;21;30)` | 0 /0 /0 |
| 416 | Emerald | 1 | 25 /— | 18; 0:—/— | 3 | 120 | 1 | rod, boot, amul, orb, circ | — | Poison Resist +31-40%<br>RAW: `res-pois(_;31;40)` | 0 /0 /0 |
| 417 | Beryl | 100 | 2 /— | 1; 0:—/— | 4 | 117 | 1 | jewl | — | Poison Resist +5-15%<br>RAW: `res-pois(_;5;15)` | 0 /0 /0 |
| 418 | Jade | 100 | 19 /— | 14; 0:—/— | 4 | 117 | 1 | jewl | — | Poison Resist +16-30%<br>RAW: `res-pois(_;16;30)` | 0 /0 /0 |
| 419 | Triumphant | 1 | 3 /— | 2; 0:—/— | 4 | 121 | 1 | weap, ring, circ | — | +1 to Mana after each Kill<br>RAW: `mana-kill(_;1;1)` | 0 /0 /0 |
| 420 | Victorious | 100 | 17 /— | 12; 0:—/— | 4 | 121 | 1 | weap, circ | — | +2-5 to Mana after each Kill<br>RAW: `mana-kill(_;2;5)` | 0 /0 /0 |
| 421 | Aureolin | 100 | 22 /— | 16; 0:—/— | 4 | 121 | 1 | jewl | — | +1-3 to Mana after each Kill<br>RAW: `mana-kill(_;1;3)` | 0 /0 /0 |
| 422 | Mechanist's | 100 | 10 /— | 7; 0:—/— | 3 | 122 | 1 | weap, shld, helm, tors, circ | thro | Socketed (1-2)<br>RAW: `sock(_;1;2)` | 0 /0 /0 |
| 423 | Artificer's | 100 | 33 /— | 25; 0:—/— | 2 | 122 | 0 | weap, shld, helm, tors | thro | Socketed (3)<br>RAW: `sock(3;_;_)` | 0 /0 /0 |
| 424 | Jeweler's | 100 | 55 /— | 47; 0:—/— | 1 | 122 | 0 | weap, shld, helm, tors | thro | Socketed (4)<br>RAW: `sock(4;_;_)` | 0 /0 /0 |
| 425 | Assamic | 100 | 3 /— | 1; 0:—/— | 2 | 123 | 1 | weap, circ | wand, orb | +25-50 to Attack Rating against Demons; +10-25% Damage to Demons<br>RAW: `att-demon(_;25;50); dmg-demon(_;10;25)` | 0 /0 /0 |
| 426 | Arcadian | 100 | 15 /— | 11; 0:—/— | 2 | 123 | 1 | weap, circ | wand, orb | +51-100 to Attack Rating against Demons; +26-50% Damage to Demons<br>RAW: `att-demon(_;51;100); dmg-demon(_;26;50)` | 0 /0 /0 |
| 427 | Unearthly | 100 | 25 /— | 18; 0:—/— | 1 | 123 | 1 | weap | wand, orb | +101-150 to Attack Rating against Demons; +51-100% Damage to Demons<br>RAW: `att-demon(_;101;150); dmg-demon(_;51;100)` | 0 /0 /0 |
| 428 | Astral | 100 | 35 /— | 26; 0:—/— | 1 | 123 | 1 | weap | wand, orb | +151-200 to Attack Rating against Demons; +101-150% Damage to Demons<br>RAW: `att-demon(_;151;200); dmg-demon(_;101;150)` | 0 /0 /0 |
| 429 | Elysian | 100 | 45 /— | 33; 0:—/— | 1 | 123 | 1 | weap | wand, orb | +201-300 to Attack Rating against Demons; +151-200% Damage to Demons<br>RAW: `att-demon(_;201;300); dmg-demon(_;151;200)` | 0 /0 /0 |
| 430 | Celestial | 100 | 55 /— | 41; 0:—/— | 1 | 123 | 0 | weap | wand, orb | +301-400 to Attack Rating against Demons; +201-300% Damage to Demons<br>RAW: `att-demon(_;301;400); dmg-demon(_;201;300)` | 0 /0 /0 |
| 431 | Diamond | 100 | 26 /— | 19; 0:—/— | 1 | 123 | 1 | jewl | — | +25-50 to Attack Rating against Demons; +25-40% Damage to Demons<br>RAW: `att-demon(_;25;50); dmg-demon(_;25;40)` | 0 /0 /0 |
| 432 | Fletcher's | 100 | 50 /— | 42; ama:—/— | 1 | 125 | 0 | lcha | — | +1 to Bow and Crossbow (Amazon) Skills<br>RAW: `skilltab(0;1;1)` | 0 /0 /0 |
| 433 | Acrobat's | 100 | 50 /— | 42; ama:—/— | 1 | 125 | 0 | lcha | — | +1 to Passive and Magic (Amazon) Skills<br>RAW: `skilltab(1;1;1)` | 0 /0 /0 |
| 434 | Harpoonist's | 100 | 50 /— | 42; ama:—/— | 1 | 125 | 0 | lcha | — | +1 to Javelin and Spear (Amazon) Skills<br>RAW: `skilltab(2;1;1)` | 0 /0 /0 |
| 435 | Fletcher's | 100 | 20 /— | 15; ama:—/— | 1 | 125 | 1 | miss, glov | — | +1 to Bow and Crossbow (Amazon) Skills<br>RAW: `skilltab(0;1;1)` | 0 /0 /0 |
| 436 | Bowyer's | 100 | 40 /— | 30; ama:—/— | 1 | 125 | 1 | miss, glov | — | +2 to Bow and Crossbow (Amazon) Skills<br>RAW: `skilltab(0;2;2)` | 0 /0 /0 |
| 437 | Archer's | 100 | 60 /— | 45; ama:—/— | 1 | 125 | 0 | miss, glov | — | +3 to Bow and Crossbow (Amazon) Skills<br>RAW: `skilltab(0;3;3)` | 0 /0 /0 |
| 438 | Acrobat's | 100 | 20 /— | 15; ama:—/— | 1 | 125 | 1 | glov, amul, circ | — | +1 to Passive and Magic (Amazon) Skills<br>RAW: `skilltab(1;1;1)` | 0 /0 /0 |
| 439 | Gymnast's | 100 | 40 /— | 30; ama:—/— | 1 | 125 | 1 | glov, amul, circ | — | +2 to Passive and Magic (Amazon) Skills<br>RAW: `skilltab(1;2;2)` | 0 /0 /0 |
| 440 | Athlete's | 100 | 60 /— | 45; ama:—/— | 1 | 125 | 0 | glov, amul, circ | — | +3 to Passive and Magic (Amazon) Skills<br>RAW: `skilltab(1;3;3)` | 0 /0 /0 |
| 441 | Harpoonist's | 100 | 20 /— | 15; ama:—/— | 1 | 125 | 1 | spea, glov | — | +1 to Javelin and Spear (Amazon) Skills<br>RAW: `skilltab(2;1;1)` | 0 /0 /0 |
| 442 | Spearmaiden's | 100 | 40 /— | 30; ama:—/— | 1 | 125 | 1 | spea, glov | — | +2 to Javelin and Spear (Amazon) Skills<br>RAW: `skilltab(2;2;2)` | 0 /0 /0 |
| 443 | Lancer's | 100 | 60 /— | 45; ama:—/— | 1 | 125 | 0 | spea, glov | — | +3 to Javelin and Spear (Amazon) Skills<br>RAW: `skilltab(2;3;3)` | 0 /0 /0 |
| 444 | Burning | 100 | 50 /— | 42; sor:—/— | 1 | 125 | 1 | lcha | — | +1 to Fire (Sorceress) Skills<br>RAW: `skilltab(3;1;1)` | 0 /0 /0 |
| 445 | Sparking | 100 | 50 /— | 42; sor:—/— | 1 | 125 | 1 | lcha | — | +1 to Lightning (Sorceress) Skills<br>RAW: `skilltab(4;1;1)` | 0 /0 /0 |
| 446 | Chilling | 100 | 50 /— | 42; sor:—/— | 1 | 125 | 1 | lcha | — | +1 to Cold (Sorceress) Skills<br>RAW: `skilltab(5;1;1)` | 0 /0 /0 |
| 447 | Burning | 100 | 20 /— | 15; sor:—/— | 1 | 125 | 1 | staff, orb, amul, circ | — | +1 to Fire (Sorceress) Skills<br>RAW: `skilltab(3;1;1)` | 0 /0 /0 |
| 448 | Blazing | 100 | 40 /— | 30; sor:—/— | 1 | 125 | 1 | staff, orb, amul, circ | — | +2 to Fire (Sorceress) Skills<br>RAW: `skilltab(3;2;2)` | 0 /0 /0 |
| 449 | Volcanic | 100 | 60 /— | 45; sor:—/— | 1 | 125 | 0 | staff, orb, amul, circ | — | +3 to Fire (Sorceress) Skills<br>RAW: `skilltab(3;3;3)` | 0 /0 /0 |
| 450 | Sparking | 100 | 20 /— | 15; sor:—/— | 1 | 125 | 1 | staff, orb, amul, circ | — | +1 to Lightning (Sorceress) Skills<br>RAW: `skilltab(4;1;1)` | 0 /0 /0 |
| 451 | Charged | 100 | 40 /— | 30; sor:—/— | 1 | 125 | 1 | staff, orb, amul, circ | — | +2 to Lightning (Sorceress) Skills<br>RAW: `skilltab(4;2;2)` | 0 /0 /0 |
| 452 | Powered | 100 | 60 /— | 45; sor:—/— | 1 | 125 | 0 | staff, orb, amul, circ | — | +3 to Lightning (Sorceress) Skills<br>RAW: `skilltab(4;3;3)` | 0 /0 /0 |
| 453 | Chilling | 100 | 20 /— | 15; sor:—/— | 1 | 125 | 1 | staff, orb, amul, circ | — | +1 to Cold (Sorceress) Skills<br>RAW: `skilltab(5;1;1)` | 0 /0 /0 |
| 454 | Freezing | 100 | 40 /— | 30; sor:—/— | 1 | 125 | 1 | staff, orb, amul, circ | — | +2 to Cold (Sorceress) Skills<br>RAW: `skilltab(5;2;2)` | 0 /0 /0 |
| 455 | Glacial | 100 | 60 /— | 45; sor:—/— | 1 | 125 | 0 | staff, orb, amul, circ | — | +3 to Cold (Sorceress) Skills<br>RAW: `skilltab(5;3;3)` | 0 /0 /0 |
| 456 | Hexing | 100 | 50 /— | 42; nec:—/— | 1 | 125 | 1 | lcha | — | +1 to Curses (Necromancer) Skills<br>RAW: `skilltab(6;1;1)` | 0 /0 /0 |
| 457 | Fungal | 100 | 50 /— | 42; nec:—/— | 1 | 125 | 1 | lcha | — | +1 to Poison and Bone (Necromancer) Skills<br>RAW: `skilltab(7;1;1)` | 0 /0 /0 |
| 458 | Graverobber's | 100 | 50 /— | 42; nec:—/— | 1 | 125 | 1 | lcha | — | +1 to Summoning (Necromancer) Skills<br>RAW: `skilltab(8;1;1)` | 0 /0 /0 |
| 459 | Hexing | 100 | 20 /— | 15; nec:—/— | 1 | 125 | 1 | wand, head, amul, circ | — | +1 to Curses (Necromancer) Skills<br>RAW: `skilltab(6;1;1)` | 0 /0 /0 |
| 460 | Blighting | 100 | 40 /— | 30; nec:—/— | 1 | 125 | 1 | wand, head, amul, circ | — | +2 to Curses (Necromancer) Skills<br>RAW: `skilltab(6;2;2)` | 0 /0 /0 |
| 461 | Accursed | 100 | 60 /— | 45; nec:—/— | 1 | 125 | 0 | wand, head, amul, circ | — | +3 to Curses (Necromancer) Skills<br>RAW: `skilltab(6;3;3)` | 0 /0 /0 |
| 462 | Fungal | 100 | 20 /— | 15; nec:—/— | 1 | 125 | 1 | wand, head, amul, knif, circ | tkni | +1 to Poison and Bone (Necromancer) Skills<br>RAW: `skilltab(7;1;1)` | 0 /0 /0 |
| 463 | Noxious | 100 | 40 /— | 30; nec:—/— | 1 | 125 | 1 | wand, head, amul, knif, circ | tkni | +2 to Poison and Bone (Necromancer) Skills<br>RAW: `skilltab(7;2;2)` | 0 /0 /0 |
| 464 | Venomous | 100 | 60 /— | 45; nec:—/— | 1 | 125 | 0 | wand, head, amul, knif, circ | tkni | +3 to Poison and Bone (Necromancer) Skills<br>RAW: `skilltab(7;3;3)` | 0 /0 /0 |
| 465 | Graverobber's | 100 | 20 /— | 15; nec:—/— | 1 | 125 | 1 | wand, head, amul, circ | — | +1 to Summoning (Necromancer) Skills<br>RAW: `skilltab(8;1;1)` | 0 /0 /0 |
| 466 | Vodoun | 100 | 40 /— | 30; nec:—/— | 1 | 125 | 1 | wand, head, amul, circ | — | +2 to Summoning (Necromancer) Skills<br>RAW: `skilltab(8;2;2)` | 0 /0 /0 |
| 467 | Golemlord's | 100 | 60 /— | 45; nec:—/— | 1 | 125 | 0 | wand, head, amul, circ | — | +3 to Summoning (Necromancer) Skills<br>RAW: `skilltab(8;3;3)` | 0 /0 /0 |
| 468 | Lion Branded | 100 | 50 /— | 42; pal:—/— | 1 | 125 | 1 | lcha | — | +1 to Combat (Paladin) Skills<br>RAW: `skilltab(9;1;1)` | 0 /0 /0 |
| 469 | Captain's | 100 | 50 /— | 42; pal:—/— | 1 | 125 | 1 | lcha | — | +1 to Offensive Auras (Paladin) Skills<br>RAW: `skilltab(10;1;1)` | 0 /0 /0 |
| 470 | Preserver's | 100 | 50 /— | 42; pal:—/— | 1 | 125 | 1 | lcha | — | +1 to Defensive Auras (Paladin) Skills<br>RAW: `skilltab(11;1;1)` | 0 /0 /0 |
| 471 | Lion Branded | 100 | 20 /— | 15; pal:—/— | 1 | 125 | 1 | scep, swor, mace, shld, ashd, amul, circ | — | +1 to Combat (Paladin) Skills<br>RAW: `skilltab(9;1;1)` | 0 /0 /0 |
| 472 | Hawk Branded | 100 | 40 /— | 30; pal:—/— | 1 | 125 | 1 | scep, swor, mace, shld, ashd, amul, circ | — | +2 to Combat (Paladin) Skills<br>RAW: `skilltab(9;2;2)` | 0 /0 /0 |
| 473 | Rose Branded | 100 | 60 /— | 45; pal:—/— | 1 | 125 | 0 | scep, swor, mace, shld, ashd, amul, circ | — | +3 to Combat (Paladin) Skills<br>RAW: `skilltab(9;3;3)` | 0 /0 /0 |
| 474 | Captain's | 100 | 20 /— | 15; pal:—/— | 1 | 125 | 1 | scep, swor, mace, shld, ashd, amul, circ | — | +1 to Offensive Auras (Paladin) Skills<br>RAW: `skilltab(10;1;1)` | 0 /0 /0 |
| 475 | Commander's | 100 | 40 /— | 30; pal:—/— | 1 | 125 | 1 | scep, swor, mace, shld, ashd, amul, circ | — | +2 to Offensive Auras (Paladin) Skills<br>RAW: `skilltab(10;2;2)` | 0 /0 /0 |
| 476 | Marshal's | 100 | 60 /— | 45; pal:—/— | 1 | 125 | 0 | scep, swor, mace, shld, ashd, amul, circ | — | +3 to Offensive Auras (Paladin) Skills<br>RAW: `skilltab(10;3;3)` | 0 /0 /0 |
| 477 | Preserver's | 100 | 20 /— | 15; pal:—/— | 1 | 125 | 1 | shld, ashd, amul, circ | — | +1 to Defensive Auras (Paladin) Skills<br>RAW: `skilltab(11;1;1)` | 0 /0 /0 |
| 478 | Warder's | 100 | 40 /— | 30; pal:—/— | 1 | 125 | 1 | shld, ashd, amul, circ | — | +2 to Defensive Auras (Paladin) Skills<br>RAW: `skilltab(11;2;2)` | 0 /0 /0 |
| 479 | Guardian's | 100 | 60 /— | 45; pal:—/— | 1 | 125 | 0 | shld, ashd, amul, circ | — | +3 to Defensive Auras (Paladin) Skills<br>RAW: `skilltab(11;3;3)` | 0 /0 /0 |
| 480 | Expert's | 100 | 50 /— | 42; bar:—/— | 1 | 125 | 1 | lcha | — | +1 to Combat (Barbarian) Skills<br>RAW: `skilltab(12;1;1)` | 0 /0 /0 |
| 481 | Fanatic | 100 | 50 /— | 42; bar:—/— | 1 | 125 | 1 | lcha | — | +1 to Masteries (Barbarian) Skills<br>RAW: `skilltab(13;1;1)` | 0 /0 /0 |
| 482 | Sounding | 100 | 50 /— | 42; bar:—/— | 1 | 125 | 1 | lcha | — | +1 to Warcries (Barbarian) Skills<br>RAW: `skilltab(14;1;1)` | 0 /0 /0 |
| 483 | Expert's | 100 | 20 /— | 15; bar:—/— | 1 | 125 | 1 | phlm, weap, helm | miss, rod | +1 to Combat (Barbarian) Skills<br>RAW: `skilltab(12;1;1)` | 0 /0 /0 |
| 484 | Veteran's | 100 | 40 /— | 30; bar:—/— | 1 | 125 | 1 | phlm, weap, helm | miss, rod | +2 to Combat (Barbarian) Skills<br>RAW: `skilltab(12;2;2)` | 0 /0 /0 |
| 485 | Master's | 100 | 60 /— | 45; bar:—/— | 1 | 125 | 0 | phlm, weap, helm | miss, rod | +3 to Combat (Barbarian) Skills<br>RAW: `skilltab(12;3;3)` | 0 /0 /0 |
| 486 | Fanatic | 100 | 20 /— | 15; bar:—/— | 1 | 125 | 1 | phlm, weap, amul | miss, rod | +1 to Masteries (Barbarian) Skills<br>RAW: `skilltab(13;1;1)` | 0 /0 /0 |
| 487 | Raging | 100 | 40 /— | 30; bar:—/— | 1 | 125 | 1 | phlm, weap, amul | miss, rod | +2 to Masteries (Barbarian) Skills<br>RAW: `skilltab(13;2;2)` | 0 /0 /0 |
| 488 | Furious | 100 | 60 /— | 45; bar:—/— | 1 | 125 | 0 | phlm, weap, amul | miss, rod | +3 to Masteries (Barbarian) Skills<br>RAW: `skilltab(13;3;3)` | 0 /0 /0 |
| 489 | Sounding | 100 | 20 /— | 15; bar:—/— | 1 | 125 | 1 | phlm, weap, amul | miss, rod | +1 to Warcries (Barbarian) Skills<br>RAW: `skilltab(14;1;1)` | 0 /0 /0 |
| 490 | Resonant | 100 | 40 /— | 30; bar:—/— | 1 | 125 | 1 | phlm, weap, amul | miss, rod | +2 to Warcries (Barbarian) Skills<br>RAW: `skilltab(14;2;2)` | 0 /0 /0 |
| 491 | Echoing | 100 | 60 /— | 45; bar:—/— | 1 | 125 | 0 | phlm, weap, amul | miss, rod | +3 to Warcries (Barbarian) Skills<br>RAW: `skilltab(14;3;3)` | 0 /0 /0 |
| 492 | Trainer's | 100 | 50 /— | 42; dru:—/— | 1 | 125 | 1 | lcha | — | +1 to Summoning (Druid) Skills<br>RAW: `skilltab(15;1;1)` | 0 /0 /0 |
| 493 | Spiritual | 100 | 50 /— | 42; dru:—/— | 1 | 125 | 1 | lcha | — | +1 to Shape Shifting (Druid) Skills<br>RAW: `skilltab(16;1;1)` | 0 /0 /0 |
| 494 | Nature's | 100 | 50 /— | 42; dru:—/— | 1 | 125 | 1 | lcha | — | +1 to Elemental (Druid) Skills<br>RAW: `skilltab(17;1;1)` | 0 /0 /0 |
| 495 | Trainer's | 100 | 20 /— | 15; dru:—/— | 1 | 125 | 1 | club, pelt, amul, circ | — | +1 to Summoning (Druid) Skills<br>RAW: `skilltab(15;1;1)` | 0 /0 /0 |
| 496 | Caretaker's | 100 | 40 /— | 30; dru:—/— | 1 | 125 | 1 | club, pelt, amul, circ | — | +2 to Summoning (Druid) Skills<br>RAW: `skilltab(15;2;2)` | 0 /0 /0 |
| 497 | Keeper's | 100 | 60 /— | 45; dru:—/— | 1 | 125 | 0 | club, pelt, amul, circ | — | +3 to Summoning (Druid) Skills<br>RAW: `skilltab(15;3;3)` | 0 /0 /0 |
| 498 | Spiritual | 100 | 20 /— | 15; dru:—/— | 1 | 125 | 1 | club, pelt, amul, circ | — | +1 to Shape Shifting (Druid) Skills<br>RAW: `skilltab(16;1;1)` | 0 /0 /0 |
| 499 | Feral | 100 | 40 /— | 30; dru:—/— | 1 | 125 | 1 | club, pelt, amul, circ | — | +2 to Shape Shifting (Druid) Skills<br>RAW: `skilltab(16;2;2)` | 0 /0 /0 |
| 500 | Communal | 100 | 60 /— | 45; dru:—/— | 1 | 125 | 0 | club, pelt, amul, circ | — | +3 to Shape Shifting (Druid) Skills<br>RAW: `skilltab(16;3;3)` | 0 /0 /0 |
| 501 | Nature's | 100 | 20 /— | 15; dru:—/— | 1 | 125 | 1 | club, pelt, amul, circ | — | +1 to Elemental (Druid) Skills<br>RAW: `skilltab(17;1;1)` | 0 /0 /0 |
| 502 | Terra's | 100 | 40 /— | 30; dru:—/— | 1 | 125 | 1 | club, pelt, amul, circ | — | +2 to Elemental (Druid) Skills<br>RAW: `skilltab(17;2;2)` | 0 /0 /0 |
| 503 | Gaea's | 100 | 60 /— | 45; dru:—/— | 1 | 125 | 0 | club, pelt, amul, circ | — | +3 to Elemental (Druid) Skills<br>RAW: `skilltab(17;3;3)` | 0 /0 /0 |
| 504 | Entrapping | 100 | 50 /— | 42; ass:—/— | 1 | 125 | 1 | lcha | — | +1 to Traps (Assassin) Skills<br>RAW: `skilltab(18;1;1)` | 0 /0 /0 |
| 505 | Mentalist's | 100 | 50 /— | 42; ass:—/— | 1 | 125 | 1 | lcha | — | +1 to Shadow Disciplines (Assassin) Skills<br>RAW: `skilltab(19;1;1)` | 0 /0 /0 |
| 506 | Shogukusha's | 100 | 50 /— | 42; ass:—/— | 1 | 125 | 1 | lcha | — | +1 to Martial Arts (Assassin) Skills<br>RAW: `skilltab(20;1;1)` | 0 /0 /0 |
| 507 | Entrapping | 100 | 20 /— | 15; ass:—/— | 1 | 125 | 1 | h2h, amul, circ | — | +1 to Traps (Assassin) Skills<br>RAW: `skilltab(18;1;1)` | 0 /0 /0 |
| 508 | Trickster's | 100 | 40 /— | 30; ass:—/— | 1 | 125 | 1 | h2h, amul, circ | — | +2 to Traps (Assassin) Skills<br>RAW: `skilltab(18;2;2)` | 0 /0 /0 |
| 509 | Cunning | 100 | 60 /— | 45; ass:—/— | 1 | 125 | 0 | h2h, amul, circ | — | +3 to Traps (Assassin) Skills<br>RAW: `skilltab(18;3;3)` | 0 /0 /0 |
| 510 | Mentalist's | 100 | 20 /— | 15; ass:—/— | 1 | 125 | 1 | h2h, amul, helm, circ | — | +1 to Shadow Disciplines (Assassin) Skills<br>RAW: `skilltab(19;1;1)` | 0 /0 /0 |
| 511 | Psychic | 100 | 40 /— | 30; ass:—/— | 1 | 125 | 1 | h2h, amul, helm, circ | — | +2 to Shadow Disciplines (Assassin) Skills<br>RAW: `skilltab(19;2;2)` | 0 /0 /0 |
| 512 | Shadow | 100 | 60 /— | 45; ass:—/— | 1 | 125 | 0 | h2h, amul, helm, circ | — | +3 to Shadow Disciplines (Assassin) Skills<br>RAW: `skilltab(19;3;3)` | 0 /0 /0 |
| 513 | Shogukusha's | 100 | 20 /— | 15; ass:—/— | 1 | 125 | 1 | h2h, amul, glov, circ | — | +1 to Martial Arts (Assassin) Skills<br>RAW: `skilltab(20;1;1)` | 0 /0 /0 |
| 514 | Sensei's | 100 | 40 /— | 30; ass:—/— | 1 | 125 | 1 | h2h, amul, glov, circ | — | +2 to Martial Arts (Assassin) Skills<br>RAW: `skilltab(20;2;2)` | 0 /0 /0 |
| 515 | Kenshi's | 100 | 60 /— | 45; ass:—/— | 1 | 125 | 0 | h2h, amul, glov, circ | — | +3 to Martial Arts (Assassin) Skills<br>RAW: `skilltab(20;3;3)` | 0 /0 /0 |
| 522 | Paleocene | 100 | 30 /— | 22; 0:—/— | 4 | 101 | 1 | tors | — | +3 Defense per clvl (floor after scaling)<br>RAW: `ac/lvl(24;_;_)` | 0 /0 /0 |
| 523 | Paleocene | 100 | 30 /— | 22; 0:—/— | 3 | 101 | 1 | glov, boot, belt, shld | — | +0.5 Defense per clvl (floor after scaling)<br>RAW: `ac/lvl(4;_;_)` | 0 /0 /0 |
| 528 | Trump | 100 | 50 /— | 37; 0:—/— | 7 | 111 | 1 | weap | staf, wand, orb | +0.5 Maximum Damage per clvl (floor after scaling); +16.5 Attack Rating per clvl (floor after scaling)<br>RAW: `dmg/lvl(4;_;_); att/lvl(33;_;_)` | 0 /0 /0 |
| 533 | Gritty | 100 | 50 /— | 37; 0:—/— | 7 | 105 | 1 | weap | staf, wand, orb | +0.75 Maximum Damage per clvl (floor after scaling)<br>RAW: `dmg/lvl(6;_;_)` | 0 /0 /0 |
| 539 | Hawkeye | 100 | 35 /— | 26; 0:—/— | 7 | 111 | 0 | weap | staf, wand, orb | +6 Attack Rating per clvl (floor after scaling)<br>RAW: `att/lvl(12;_;_)` | 0 /0 /0 |
| 541 | Visionary | 100 | 25 /— | 18; 0:—/— | 1 | 111 | 1 | helm, miss | — | +0.25 % AR per clvl (floor after scaling)<br>RAW: `att%/lvl(2;_;_)` | 0 /0 /0 |
| 542 | Mnemonic | 100 | 25 /— | 18; 0:—/— | 1 | 115 | 1 | helm | — | +0.75 Mana per clvl (floor after scaling)<br>RAW: `mana/lvl(6;_;_)` | 0 /0 /0 |
| 543 | Snowflake | 100 | 25 /— | 18; 0:—/— | 3 | 137 | 1 | weap, circ | — | (cold length 25 frames); +6-9 min cold dmg; +19-30 max cold dmg<br>RAW: `cold-len(_;25;25); cold-min(_;6;9); cold-max(_;19;30)` | 0 /0 /0 |
| 544 | Shivering | 100 | 35 /— | 26; 0:—/— | 2 | 137 | 1 | weap | — | (cold length 50 frames); +10-15 min cold dmg; +31-45 max cold dmg<br>RAW: `cold-len(_;50;50); cold-min(_;10;15); cold-max(_;31;45)` | 0 /0 /0 |
| 545 | Boreal | 100 | 50 /— | 40; 0:—/— | 1 | 137 | 1 | weap | — | (cold length 75 frames); +16-23 min cold dmg; +46-90 max cold dmg<br>RAW: `cold-len(_;75;75); cold-min(_;16;23); cold-max(_;46;90)` | 0 /0 /0 |
| 546 | Hibernal | 100 | 70 /— | 60; 0:—/— | 1 | 137 | 1 | weap | — | (cold length 100 frames); +24-45 min cold dmg; +91-140 max cold dmg<br>RAW: `cold-len(_;100;100); cold-min(_;24;45); cold-max(_;91;140)` | 0 /0 /0 |
| 547 | Ember | 100 | 25 /— | 18; 0:—/— | 3 | 138 | 1 | weap, circ | — | +16-25 min fire dmg; +31-60 max fire dmg<br>RAW: `fire-min(_;16;25); fire-max(_;31;60)` | 0 /0 /0 |
| 548 | Smoldering | 100 | 35 /— | 26; 0:—/— | 2 | 138 | 1 | weap | — | +26-50 min fire dmg; +61-90 max fire dmg<br>RAW: `fire-min(_;26;50); fire-max(_;61;90)` | 0 /0 /0 |
| 549 | Smoking | 100 | 47 /— | 37; 0:—/— | 1 | 138 | 1 | weap | — | +51-80 min fire dmg; +91-130 max fire dmg<br>RAW: `fire-min(_;51;80); fire-max(_;91;130)` | 0 /0 /0 |
| 550 | Flaming | 100 | 61 /— | 51; 0:—/— | 1 | 138 | 1 | weap | — | +81-120 min fire dmg; +131-180 max fire dmg<br>RAW: `fire-min(_;81;120); fire-max(_;131;180)` | 0 /0 /0 |
| 551 | Scorching | 100 | 77 /— | 67; 0:—/— | 1 | 138 | 1 | weap | — | +121-170 min fire dmg; +181-240 max fire dmg<br>RAW: `fire-min(_;121;170); fire-max(_;181;240)` | 0 /0 /0 |
| 552 | Static | 100 | 25 /— | 18; 0:—/— | 3 | 139 | 1 | weap, circ | — | +1 min ltng dmg; +49-120 max ltng dmg<br>RAW: `ltng-min(_;1;1); ltng-max(_;49;120)` | 0 /0 /0 |
| 553 | Glowing | 100 | 34 /— | 25; 0:—/— | 2 | 139 | 1 | weap | — | +1 min ltng dmg; +121-180 max ltng dmg<br>RAW: `ltng-min(_;1;1); ltng-max(_;121;180)` | 0 /0 /0 |
| 554 | Buzzing | 100 | 46 /— | 36; 0:—/— | 1 | 139 | 1 | weap | — | +1 min ltng dmg; +181-260 max ltng dmg<br>RAW: `ltng-min(_;1;1); ltng-max(_;181;260)` | 0 /0 /0 |
| 555 | Arcing | 100 | 60 /— | 50; 0:—/— | 1 | 139 | 1 | weap | — | +1 min ltng dmg; +261-360 max ltng dmg<br>RAW: `ltng-min(_;1;1); ltng-max(_;261;360)` | 0 /0 /0 |
| 556 | Shocking | 100 | 76 /— | 66; 0:—/— | 1 | 139 | 1 | weap | — | +1 min ltng dmg; +361-480 max ltng dmg<br>RAW: `ltng-min(_;1;1); ltng-max(_;361;480)` | 0 /0 /0 |
| 557 | Septic | 100 | 1 /— | 1; 0:—/— | 3 | 140 | 1 | weap, circ | — | Approx. 6.05469 Poison Damage over 2s; authoritative rate 31–31/256 per frame<br>RAW: `dmg-pois(50;31;31)` | 0 /0 /0 |
| 558 | Envenomed | 100 | 10 /— | 7; 0:—/— | 2 | 140 | 1 | weap | — | Approx. 12.0117 Poison Damage over 3s; authoritative rate 41–41/256 per frame<br>RAW: `dmg-pois(75;41;41)` | 0 /0 /0 |
| 559 | Corosive | 100 | 20 /— | 15; 0:—/— | 1 | 140 | 1 | weap | — | Approx. 80.0781 Poison Damage over 4s; authoritative rate 205–205/256 per frame<br>RAW: `dmg-pois(100;205;205)` | 0 /0 /0 |
| 560 | Toxic | 100 | 35 /— | 26; 0:—/— | 1 | 140 | 1 | weap | — | Approx. 150.391 Poison Damage over 5s; authoritative rate 308–308/256 per frame<br>RAW: `dmg-pois(125;308;308)` | 0 /0 /0 |
| 561 | Pestilent | 100 | 50 /— | 37; 0:—/— | 1 | 140 | 0 | weap | — | Approx. 275.391 Poison Damage over 6s; authoritative rate 470–470/256 per frame<br>RAW: `dmg-pois(150;470;470)` | 0 /0 /0 |
| 562 | Maiden's | 1 | 36 /— | 27; ama:—/— | 4 | 125 | 1 | amul, circ | — | +1 to Amazon Skill Levels<br>RAW: `ama(_;1;1)` | 0 /0 /0 |
| 563 | Valkyrie's | 1 | 90 /— | 67; ama:—/— | 2 | 125 | 1 | amul, circ | — | +2 to Amazon Skill Levels<br>RAW: `ama(_;2;2)` | 0 /0 /0 |
| 564 | Maiden's | 1 | 30 /— | 22; ama:—/— | 4 | 125 | 1 | miss, spea | — | +1 to Amazon Skill Levels<br>RAW: `ama(_;1;1)` | 0 /0 /0 |
| 565 | Valkyrie's | 1 | 50 /— | 42; ama:—/— | 2 | 125 | 1 | miss, spea | — | +2 to Amazon Skill Levels<br>RAW: `ama(_;2;2)` | 0 /0 /0 |
| 566 | Monk's | 1 | 36 /— | 27; pal:—/— | 4 | 125 | 1 | amul, circ | — | +1 to Paladin Skill Levels<br>RAW: `pal(_;1;1)` | 0 /0 /0 |
| 567 | Priest's | 1 | 90 /— | 67; pal:—/— | 2 | 125 | 1 | amul, circ | — | +2 to Paladin Skill Levels<br>RAW: `pal(_;2;2)` | 0 /0 /0 |
| 568 | Monk's | 1 | 30 /— | 22; pal:—/— | 4 | 125 | 1 | scep, ashd | — | +1 to Paladin Skill Levels<br>RAW: `pal(_;1;1)` | 0 /0 /0 |
| 569 | Priest's | 1 | 50 /— | 42; pal:—/— | 2 | 125 | 1 | scep, ashd | — | +2 to Paladin Skill Levels<br>RAW: `pal(_;2;2)` | 0 /0 /0 |
| 570 | Monk's | 1 | 35 /— | 27; pal:—/— | 4 | 125 | 1 | swor, mace, hamm, shld | — | +1 to Paladin Skill Levels<br>RAW: `pal(_;1;1)` | 0 /0 /0 |
| 571 | Priest's | 1 | 65 /— | 58; pal:—/— | 2 | 125 | 1 | swor, mace, hamm, shld | — | +2 to Paladin Skill Levels<br>RAW: `pal(_;2;2)` | 0 /0 /0 |
| 572 | Summoner's | 1 | 36 /— | 27; nec:—/— | 4 | 125 | 1 | amul, circ | — | +1 to Necromancer Skill Levels<br>RAW: `nec(_;1;1)` | 0 /0 /0 |
| 573 | Necromancer's | 1 | 90 /— | 67; nec:—/— | 2 | 125 | 1 | amul, circ | — | +2 to Necromancer Skill Levels<br>RAW: `nec(_;2;2)` | 0 /0 /0 |
| 574 | Summoner's | 1 | 30 /— | 22; nec:—/— | 4 | 125 | 1 | wand, knif, head | — | +1 to Necromancer Skill Levels<br>RAW: `nec(_;1;1)` | 0 /0 /0 |
| 575 | Necromancer's | 1 | 50 /— | 42; nec:—/— | 2 | 125 | 1 | wand, knif, head | — | +2 to Necromancer Skill Levels<br>RAW: `nec(_;2;2)` | 0 /0 /0 |
| 576 | Angel's | 1 | 36 /— | 27; sor:—/— | 4 | 125 | 1 | amul, circ | — | +1 to Sorceress Skill Levels<br>RAW: `sor(_;1;1)` | 0 /0 /0 |
| 577 | Arch-Angel's | 1 | 90 /— | 67; sor:—/— | 2 | 125 | 1 | amul, circ | — | +2 to Sorceress Skill Levels<br>RAW: `sor(_;2;2)` | 0 /0 /0 |
| 578 | Angel's | 1 | 30 /— | 22; sor:—/— | 4 | 125 | 1 | staf, orb | — | +1 to Sorceress Skill Levels<br>RAW: `sor(_;1;1)` | 0 /0 /0 |
| 579 | Arch-Angel's | 1 | 50 /— | 42; sor:—/— | 2 | 125 | 1 | staf, orb | — | +2 to Sorceress Skill Levels<br>RAW: `sor(_;2;2)` | 0 /0 /0 |
| 580 | Slayer's | 1 | 36 /— | 27; bar:—/— | 4 | 125 | 1 | amul, circ | — | +1 to Barbarian Skill Levels<br>RAW: `bar(_;1;1)` | 0 /0 /0 |
| 581 | Berserker's | 1 | 90 /— | 67; bar:—/— | 2 | 125 | 1 | amul, circ | — | +2 to Barbarian Skill Levels<br>RAW: `bar(_;2;2)` | 0 /0 /0 |
| 582 | Slayer's | 1 | 30 /— | 22; bar:—/— | 4 | 125 | 1 | tkni, axe, spea, club, swor, hamm, mace | jave | +1 to Barbarian Skill Levels<br>RAW: `bar(_;1;1)` | 0 /0 /0 |
| 583 | Berserker's | 1 | 50 /— | 42; bar:—/— | 1 | 125 | 1 | tkni, axe, spea, club, swor, hamm, mace | jave | +2 to Barbarian Skill Levels<br>RAW: `bar(_;2;2)` | 0 /0 /0 |
| 584 | Slayer's | 100 | 30 /— | 22; bar:—/— | 4 | 125 | 1 | phlm | — | +1 to Barbarian Skill Levels<br>RAW: `bar(_;1;1)` | 0 /0 /0 |
| 585 | Berserker's | 100 | 50 /— | 42; bar:—/— | 2 | 125 | 1 | phlm | — | +2 to Barbarian Skill Levels<br>RAW: `bar(_;2;2)` | 0 /0 /0 |
| 586 | Shaman's | 100 | 36 /— | 27; dru:—/— | 4 | 125 | 1 | amul, circ | — | +1 to Druid Skill Levels<br>RAW: `dru(_;1;1)` | 0 /0 /0 |
| 587 | Hierophant's | 100 | 90 /— | 67; dru:—/— | 2 | 125 | 1 | amul, circ | — | +2 to Druid Skill Levels<br>RAW: `dru(_;2;2)` | 0 /0 /0 |
| 588 | Shaman's | 100 | 30 /— | 22; dru:—/— | 4 | 125 | 1 | club, pelt | — | +1 to Druid Skill Levels<br>RAW: `dru(_;1;1)` | 0 /0 /0 |
| 589 | Hierophant's | 100 | 50 /— | 42; dru:—/— | 2 | 125 | 1 | club, pelt | — | +2 to Druid Skill Levels<br>RAW: `dru(_;2;2)` | 0 /0 /0 |
| 590 | Magekiller's | 100 | 36 /— | 27; ass:—/— | 4 | 125 | 1 | amul, circ | — | +1 to Assassin Skill Levels<br>RAW: `ass(_;1;1)` | 0 /0 /0 |
| 591 | Witch-hunter's | 100 | 90 /— | 67; ass:—/— | 2 | 125 | 1 | amul, circ | — | +2 to Assassin Skill Levels<br>RAW: `ass(_;2;2)` | 0 /0 /0 |
| 592 | Magekiller's | 100 | 30 /— | 22; ass:—/— | 4 | 125 | 1 | h2h | — | +1 to Assassin Skill Levels<br>RAW: `ass(_;1;1)` | 0 /0 /0 |
| 593 | Witch-hunter's | 100 | 50 /— | 42; ass:—/— | 2 | 125 | 1 | h2h | — | +2 to Assassin Skill Levels<br>RAW: `ass(_;2;2)` | 0 /0 /0 |
| 594 | Compact | 100 | 1 /— | 1; 0:—/— | 6 | 141 | 1 | thro | — | Increased Stack Size +20-40<br>RAW: `stack(_;20;40)` | 0 /0 /0 |
| 595 | Thin | 100 | 17 /— | 12; 0:—/— | 5 | 141 | 1 | thro | — | Increased Stack Size +41-80<br>RAW: `stack(_;41;80)` | 0 /0 /0 |
| 596 | Dense | 100 | 38 /— | 30; 0:—/— | 4 | 141 | 1 | thro | — | Increased Stack Size +81-120<br>RAW: `stack(_;81;120)` | 0 /0 /0 |
| 597 | Consecrated | 100 | 1 /— | 1; 0:—/— | 4 | 142 | 1 | weap | wand, orb | +25-75 to Attack Rating against Undead; +25-75% Damage to Undead<br>RAW: `att-undead(_;25;75); dmg-undead(_;25;75)` | 0 /0 /0 |
| 598 | Pure | 100 | 15 /— | 11; 0:—/— | 3 | 142 | 1 | weap | wand, orb | +76-175 to Attack Rating against Undead; +76-125% Damage to Undead<br>RAW: `att-undead(_;76;175); dmg-undead(_;76;125)` | 0 /0 /0 |
| 599 | Sacred | 100 | 25 /— | 18; 0:—/— | 2 | 142 | 1 | weap | wand, orb | +175-250 to Attack Rating against Undead; +126-200% Damage to Undead<br>RAW: `att-undead(_;175;250); dmg-undead(_;126;200)` | 0 /0 /0 |
| 600 | Hallowed | 100 | 35 /— | 27; 0:—/— | 1 | 142 | 1 | weap | wand, orb | +251-325 to Attack Rating against Undead; +201-275% Damage to Undead<br>RAW: `att-undead(_;251;325); dmg-undead(_;201;275)` | 0 /0 /0 |
| 601 | Divine | 100 | 45 /— | 37; 0:—/— | 1 | 142 | 0 | weap | wand, orb | +326-450 to Attack Rating against Undead; +276-350% Damage to Undead<br>RAW: `att-undead(_;326;450); dmg-undead(_;276;350)` | 0 /0 /0 |
| 602 | Pearl | 100 | 18 /— | 13; 0:—/— | 1 | 142 | 1 | jewl | — | +25-50 to Attack Rating against Undead; +25-50% Damage to Undead<br>RAW: `att-undead(_;25;50); dmg-undead(_;25;50)` | 0 /0 /0 |
| 603 | Crimson | 1 | 5 /— | 3; 0:—/— | 4 | 118 | 1 | armo, ring, amul, orb, circ, weap | — | Fire Resist +5-10%<br>RAW: `res-fire(_;5;10)` | 0 /0 /0 |
| 604 | Red | 100 | 15 /— | 11; 0:—/— | 4 | 103 | 1 | lcha | — | +1 to Minimum Damage<br>RAW: `dmg-min(_;1;1)` | 0 /0 /0 |
| 605 | Sanguinary | 100 | 45 /— | 37; 0:—/— | 4 | 103 | 1 | lcha | — | +2 to Minimum Damage<br>RAW: `dmg-min(_;2;2)` | 0 /0 /0 |
| 606 | Bloody | 100 | 75 /— | 67; 0:—/— | 4 | 103 | 0 | lcha | — | +3 to Minimum Damage<br>RAW: `dmg-min(_;3;3)` | 0 /0 /0 |
| 607 | Red | 100 | 30 /— | 22; 0:—/— | 4 | 103 | 1 | mcha | — | +1 to Minimum Damage<br>RAW: `dmg-min(_;1;1)` | 0 /0 /0 |
| 608 | Sanguinary | 100 | 60 /— | 52; 0:—/— | 4 | 103 | 0 | mcha | — | +2 to Minimum Damage<br>RAW: `dmg-min(_;2;2)` | 0 /0 /0 |
| 609 | Red | 100 | 90 /— | 82; 0:—/— | 4 | 103 | 1 | scha | — | +1 to Minimum Damage<br>RAW: `dmg-min(_;1;1)` | 0 /0 /0 |
| 610 | Jagged | 100 | 7 /— | 5; 0:—/— | 4 | 104 | 1 | lcha | — | +1 to Maximum Damage<br>RAW: `dmg-max(_;1;1)` | 0 /0 /0 |
| 611 | Forked | 100 | 37 /— | 29; 0:—/— | 4 | 104 | 1 | lcha | — | +2 to Maximum Damage<br>RAW: `dmg-max(_;2;2)` | 0 /0 /0 |
| 612 | Serrated | 100 | 67 /— | 59; 0:—/— | 4 | 104 | 0 | lcha | — | +3 to Maximum Damage<br>RAW: `dmg-max(_;3;3)` | 0 /0 /0 |
| 613 | Jagged | 100 | 22 /— | 16; 0:—/— | 4 | 104 | 1 | mcha | — | +1 to Maximum Damage<br>RAW: `dmg-max(_;1;1)` | 0 /0 /0 |
| 614 | Forked | 100 | 52 /— | 44; 0:—/— | 4 | 104 | 0 | mcha | — | +2 to Maximum Damage<br>RAW: `dmg-max(_;2;2)` | 0 /0 /0 |
| 615 | Jagged | 100 | 81 /— | 73; 0:—/— | 4 | 104 | 1 | scha | — | +1 to Maximum Damage<br>RAW: `dmg-max(_;1;1)` | 0 /0 /0 |
| 616 | Snowflake | 100 | 9 /— | 6; 0:—/— | 2 | 137 | 1 | lcha | — | (cold length 25 frames); +1 min cold dmg; +2-3 max cold dmg<br>RAW: `cold-len(_;25;25); cold-min(_;1;1); cold-max(_;2;3)` | 0 /0 /0 |
| 617 | Shivering | 100 | 15 /— | 11; 0:—/— | 1 | 137 | 1 | lcha | — | (cold length 25 frames); +2-4 min cold dmg; +4-8 max cold dmg<br>RAW: `cold-len(_;25;25); cold-min(_;2;4); cold-max(_;4;8)` | 0 /0 /0 |
| 618 | Boreal | 100 | 30 /— | 22; 0:—/— | 1 | 137 | 1 | lcha | — | (cold length 25 frames); +5-7 min cold dmg; +9-15 max cold dmg<br>RAW: `cold-len(_;25;25); cold-min(_;5;7); cold-max(_;9;15)` | 0 /0 /0 |
| 619 | Hibernal | 100 | 45 /— | 38; 0:—/— | 1 | 137 | 0 | lcha | — | (cold length 25 frames); +8-13 min cold dmg; +16-25 max cold dmg<br>RAW: `cold-len(_;25;25); cold-min(_;8;13); cold-max(_;16;25)` | 0 /0 /0 |
| 620 | Snowflake | 100 | 18 /— | 13; 0:—/— | 2 | 137 | 1 | mcha | — | (cold length 25 frames); +2-3 min cold dmg; +3-5 max cold dmg<br>RAW: `cold-len(_;25;25); cold-min(_;2;3); cold-max(_;3;5)` | 0 /0 /0 |
| 621 | Shivering | 100 | 29 /— | 21; 0:—/— | 1 | 137 | 1 | mcha | — | (cold length 25 frames); +4-5 min cold dmg; +6-10 max cold dmg<br>RAW: `cold-len(_;25;25); cold-min(_;4;5); cold-max(_;6;10)` | 0 /0 /0 |
| 622 | Boreal | 100 | 49 /— | 41; 0:—/— | 1 | 137 | 1 | mcha | — | (cold length 25 frames); +6-10 min cold dmg; +11-20 max cold dmg<br>RAW: `cold-len(_;25;25); cold-min(_;6;10); cold-max(_;11;20)` | 0 /0 /0 |
| 623 | Hibernal | 100 | 69 /— | 61; 0:—/— | 1 | 137 | 0 | mcha | — | (cold length 25 frames); +11-15 min cold dmg; +21-30 max cold dmg<br>RAW: `cold-len(_;25;25); cold-min(_;11;15); cold-max(_;21;30)` | 0 /0 /0 |
| 624 | Snowflake | 100 | 27 /— | 20; 0:—/— | 2 | 137 | 1 | scha | — | (cold length 25 frames); +1-2 min cold dmg; +2-4 max cold dmg<br>RAW: `cold-len(_;25;25); cold-min(_;1;2); cold-max(_;2;4)` | 0 /0 /0 |
| 625 | Shivering | 100 | 42 /— | 34; 0:—/— | 1 | 137 | 1 | scha | — | (cold length 25 frames); +3-4 min cold dmg; +5-8 max cold dmg<br>RAW: `cold-len(_;25;25); cold-min(_;3;4); cold-max(_;5;8)` | 0 /0 /0 |
| 626 | Boreal | 100 | 66 /— | 58; 0:—/— | 1 | 137 | 1 | scha | — | (cold length 25 frames); +5-7 min cold dmg; +9-14 max cold dmg<br>RAW: `cold-len(_;25;25); cold-min(_;5;7); cold-max(_;9;14)` | 0 /0 /0 |
| 627 | Hibernal | 100 | 91 /— | 83; 0:—/— | 1 | 137 | 0 | scha | — | (cold length 25 frames); +8-10 min cold dmg; +15-20 max cold dmg<br>RAW: `cold-len(_;25;25); cold-min(_;8;10); cold-max(_;15;20)` | 0 /0 /0 |
| 628 | Ember | 100 | 5 /— | 3; 0:—/— | 2 | 138 | 1 | lcha | — | +1 min fire dmg; +2-3 max fire dmg<br>RAW: `fire-min(_;1;1); fire-max(_;2;3)` | 0 /0 /0 |
| 629 | Smoldering | 100 | 15 /— | 11; 0:—/— | 1 | 138 | 1 | lcha | — | +2-3 min fire dmg; +4-7 max fire dmg<br>RAW: `fire-min(_;2;3); fire-max(_;4;7)` | 0 /0 /0 |
| 630 | Smoking | 100 | 28 /— | 21; 0:—/— | 1 | 138 | 1 | lcha | — | +4-7 min fire dmg; +8-19 max fire dmg<br>RAW: `fire-min(_;4;7); fire-max(_;8;19)` | 0 /0 /0 |
| 631 | Flaming | 100 | 43 /— | 35; 0:—/— | 1 | 138 | 0 | lcha | — | +8-18 min fire dmg; +20-36 max fire dmg<br>RAW: `fire-min(_;8;18); fire-max(_;20;36)` | 0 /0 /0 |
| 632 | Ember | 100 | 13 /— | 9; 0:—/— | 2 | 138 | 1 | mcha | — | +1 min fire dmg; +2-3 max fire dmg<br>RAW: `fire-min(_;1;1); fire-max(_;2;3)` | 0 /0 /0 |
| 633 | Smoldering | 100 | 27 /— | 20; 0:—/— | 1 | 138 | 1 | mcha | — | +2-3 min fire dmg; +4-12 max fire dmg<br>RAW: `fire-min(_;2;3); fire-max(_;4;12)` | 0 /0 /0 |
| 634 | Smoking | 100 | 47 /— | 39; 0:—/— | 1 | 138 | 1 | mcha | — | +4-9 min fire dmg; +13-27 max fire dmg<br>RAW: `fire-min(_;4;9); fire-max(_;13;27)` | 0 /0 /0 |
| 635 | Flaming | 100 | 67 /— | 59; 0:—/— | 1 | 138 | 0 | mcha | — | +10-27 min fire dmg; +28-43 max fire dmg<br>RAW: `fire-min(_;10;27); fire-max(_;28;43)` | 0 /0 /0 |
| 636 | Ember | 100 | 21 /— | 15; 0:—/— | 2 | 138 | 1 | scha | — | +1 min fire dmg; +2-3 max fire dmg<br>RAW: `fire-min(_;1;1); fire-max(_;2;3)` | 0 /0 /0 |
| 637 | Smoldering | 100 | 40 /— | 32; 0:—/— | 1 | 138 | 1 | scha | — | +2-3 min fire dmg; +4-10 max fire dmg<br>RAW: `fire-min(_;2;3); fire-max(_;4;10)` | 0 /0 /0 |
| 638 | Smoking | 100 | 64 /— | 56; 0:—/— | 1 | 138 | 1 | scha | — | +4-9 min fire dmg; +11-19 max fire dmg<br>RAW: `fire-min(_;4;9); fire-max(_;11;19)` | 0 /0 /0 |
| 639 | Flaming | 100 | 89 /— | 81; 0:—/— | 1 | 138 | 0 | scha | — | +10-19 min fire dmg; +20-29 max fire dmg<br>RAW: `fire-min(_;10;19); fire-max(_;20;29)` | 0 /0 /0 |
| 640 | Static | 100 | 7 /— | 5; 0:—/— | 2 | 139 | 1 | lcha | — | +1 min ltng dmg; +4-5 max ltng dmg<br>RAW: `ltng-min(_;1;1); ltng-max(_;4;5)` | 0 /0 /0 |
| 641 | Glowing | 100 | 14 /— | 10; 0:—/— | 1 | 139 | 1 | lcha | — | +1 min ltng dmg; +6-17 max ltng dmg<br>RAW: `ltng-min(_;1;1); ltng-max(_;6;17)` | 0 /0 /0 |
| 642 | Arcing | 100 | 29 /— | 21; 0:—/— | 1 | 139 | 1 | lcha | — | +1 min ltng dmg; +18-44 max ltng dmg<br>RAW: `ltng-min(_;1;1); ltng-max(_;18;44)` | 0 /0 /0 |
| 643 | Shocking | 100 | 44 /— | 36; 0:—/— | 1 | 139 | 0 | lcha | — | +1 min ltng dmg; +45-79 max ltng dmg<br>RAW: `ltng-min(_;1;1); ltng-max(_;45;79)` | 0 /0 /0 |
| 644 | Static | 100 | 14 /— | 10; 0:—/— | 2 | 139 | 1 | mcha | — | +1 min ltng dmg; +5-9 max ltng dmg<br>RAW: `ltng-min(_;1;1); ltng-max(_;5;9)` | 0 /0 /0 |
| 645 | Glowing | 100 | 28 /— | 20; 0:—/— | 1 | 139 | 1 | mcha | — | +1 min ltng dmg; +10-26 max ltng dmg<br>RAW: `ltng-min(_;1;1); ltng-max(_;10;26)` | 0 /0 /0 |
| 646 | Arcing | 100 | 48 /— | 40; 0:—/— | 1 | 139 | 1 | mcha | — | +1 min ltng dmg; +27-58 max ltng dmg<br>RAW: `ltng-min(_;1;1); ltng-max(_;27;58)` | 0 /0 /0 |
| 647 | Shocking | 100 | 68 /— | 60; 0:—/— | 1 | 139 | 0 | mcha | — | +1 min ltng dmg; +59-90 max ltng dmg<br>RAW: `ltng-min(_;1;1); ltng-max(_;59;90)` | 0 /0 /0 |
| 648 | Static | 100 | 23 /— | 17; 0:—/— | 2 | 139 | 1 | scha | — | +1 min ltng dmg; +6-11 max ltng dmg<br>RAW: `ltng-min(_;1;1); ltng-max(_;6;11)` | 0 /0 /0 |
| 649 | Glowing | 100 | 41 /— | 33; 0:—/— | 1 | 139 | 1 | scha | — | +1 min ltng dmg; +12-24 max ltng dmg<br>RAW: `ltng-min(_;1;1); ltng-max(_;12;24)` | 0 /0 /0 |
| 650 | Arcing | 100 | 65 /— | 57; 0:—/— | 1 | 139 | 1 | scha | — | +1 min ltng dmg; +25-43 max ltng dmg<br>RAW: `ltng-min(_;1;1); ltng-max(_;25;43)` | 0 /0 /0 |
| 651 | Shocking | 100 | 90 /— | 82; 0:—/— | 1 | 139 | 0 | scha | — | +1 min ltng dmg; +44-71 max ltng dmg<br>RAW: `ltng-min(_;1;1); ltng-max(_;44;71)` | 0 /0 /0 |
| 652 | Septic | 100 | 1 /— | 1; 0:—/— | 2 | 140 | 1 | lcha | — | Approx. 5.27344 Poison Damage over 3s; authoritative rate 18–18/256 per frame<br>RAW: `dmg-pois(75;18;18)` | 0 /0 /0 |
| 653 | Envenomed | 100 | 12 /— | 9; 0:—/— | 1 | 140 | 1 | lcha | — | Approx. 15.2344 Poison Damage over 4s; authoritative rate 39–39/256 per frame<br>RAW: `dmg-pois(100;39;39)` | 0 /0 /0 |
| 654 | Toxic | 100 | 27 /— | 20; 0:—/— | 1 | 140 | 1 | lcha | — | Approx. 50.293 Poison Damage over 5s; authoritative rate 103–103/256 per frame<br>RAW: `dmg-pois(125;103;103)` | 0 /0 /0 |
| 655 | Pestilent | 100 | 42 /— | 34; 0:—/— | 1 | 140 | 0 | lcha | — | Approx. 100.195 Poison Damage over 6s; authoritative rate 171–171/256 per frame<br>RAW: `dmg-pois(150;171;171)` | 0 /0 /0 |
| 656 | Septic | 100 | 9 /— | 6; 0:—/— | 2 | 140 | 1 | mcha | — | Approx. 10.2539 Poison Damage over 3s; authoritative rate 35–35/256 per frame<br>RAW: `dmg-pois(75;35;35)` | 0 /0 /0 |
| 657 | Envenomed | 100 | 26 /— | 19; 0:—/— | 1 | 140 | 1 | mcha | — | Approx. 30.0781 Poison Damage over 4s; authoritative rate 77–77/256 per frame<br>RAW: `dmg-pois(100;77;77)` | 0 /0 /0 |
| 658 | Toxic | 100 | 46 /— | 38; 0:—/— | 1 | 140 | 1 | mcha | — | Approx. 90.332 Poison Damage over 5s; authoritative rate 185–185/256 per frame<br>RAW: `dmg-pois(125;185;185)` | 0 /0 /0 |
| 659 | Pestilent | 100 | 66 /— | 58; 0:—/— | 1 | 140 | 0 | mcha | — | Approx. 175.195 Poison Damage over 6s; authoritative rate 299–299/256 per frame<br>RAW: `dmg-pois(150;299;299)` | 0 /0 /0 |
| 660 | Septic | 100 | 18 /— | 13; 0:—/— | 2 | 140 | 1 | scha | — | Approx. 15.2344 Poison Damage over 3s; authoritative rate 52–52/256 per frame<br>RAW: `dmg-pois(75;52;52)` | 0 /0 /0 |
| 661 | Envenomed | 100 | 39 /— | 31; 0:—/— | 1 | 140 | 1 | scha | — | Approx. 50 Poison Damage over 4s; authoritative rate 128–128/256 per frame<br>RAW: `dmg-pois(100;128;128)` | 0 /0 /0 |
| 662 | Toxic | 100 | 63 /— | 55; 0:—/— | 1 | 140 | 1 | scha | — | Approx. 100.098 Poison Damage over 5s; authoritative rate 205–205/256 per frame<br>RAW: `dmg-pois(125;205;205)` | 0 /0 /0 |
| 663 | Pestilent | 100 | 88 /— | 80; 0:—/— | 1 | 140 | 0 | scha | — | Approx. 175.195 Poison Damage over 6s; authoritative rate 299–299/256 per frame<br>RAW: `dmg-pois(150;299;299)` | 0 /0 /0 |
| 664 | Tireless | 1 | 1 /5 | 1; 0:—/— | 4 | 108 | 1 | boot | — | Heal Stamina Plus 10%<br>RAW: `regen-stam(_;10;10)` | 0 /0 /0 |
| 665 | Lizard's | 1 | 1 /2 | 1; 0:—/— | 4 | 115 | 1 | armo, ring, amul, rod, orb | boot, glov | +1-2 to Mana<br>RAW: `mana(_;1;2)` | 0 /0 /0 |
| 666 | Azure | 1 | 1 /4 | 1; 0:—/— | 3 | 117 | 1 | armo, ring, amul, orb, circ | — | Cold Resist +5%<br>RAW: `res-cold(_;5;5)` | 0 /0 /0 |
| 667 | Crimson | 1 | 1 /4 | 1; 0:—/— | 3 | 118 | 1 | armo, ring, amul, orb, circ | — | Fire Resist +5%<br>RAW: `res-fire(_;5;5)` | 0 /0 /0 |
| 668 | Tangerine | 1 | 1 /4 | 1; 0:—/— | 3 | 119 | 1 | armo, ring, amul, orb, circ | — | Lightning Resist +5%<br>RAW: `res-ltng(_;5;5)` | 0 /0 /0 |
| 669 | Beryl | 1 | 1 /4 | 1; 0:—/— | 3 | 120 | 1 | armo, ring, amul, orb, circ | — | Poison Resist +5%<br>RAW: `res-pois(_;5;5)` | 0 /0 /0 |
| 670 | Godly | 100 | 50 /— | 43; 0:—/— | 1 | 101 | 1 | armo | — | 101-200% Enhanced Defense<br>RAW: `ac%(_;101;200)` | 0 /0 /0 |
| 671 | Cruel | 100 | 56 /— | 48; 0:—/— | 1 | 105 | 1 | weap | staf, wand, orb | 201-300% Enhanced Damage<br>RAW: `dmg%(_;201;300)` | 0 /0 /0 |
[Source MagicSuffix.txt](https://cdn.jsdelivr.net/gh/fabd/diablo2@45112569deb9384738ccafe5c24ebbb71f41c7c9/code/d2_113_data/MagicSuffix.txt).


### MagicSuffix

| Line | Name | Version | Alvl /MaxLevel | Req lvl; class /class req | Frequency | Group | Rare | Allowed types | Excluded types | Modifiers /raw tuples | Price divide /multiply /add |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 117 | of Health | 1 | 7 /— | 5; 0:—/— | 4 | 1 | 1 | tors, shld, ring, amul, circ | — | Damage Reduced by 1<br>RAW: `red-dmg(_;1;1)` | 0 /0 /0 |
| 118 | of Protection | 1 | 18 /— | 13; 0:—/— | 4 | 1 | 1 | ring, amul, circ | — | Damage Reduced by 2<br>RAW: `red-dmg(_;2;2)` | 0 /0 /0 |
| 119 | of Absorption | 1 | 26 /— | 19; 0:—/— | 4 | 1 | 1 | amul, circ | — | Damage Reduced by 3<br>RAW: `red-dmg(_;3;3)` | 0 /0 /0 |
| 120 | of Life | 1 | 35 /— | 26; 0:—/— | 4 | 1 | 1 | amul, circ | — | Damage Reduced by 4<br>RAW: `red-dmg(_;4;4)` | 0 /0 /0 |
| 121 | of Life Everlasting | 100 | 45 /— | 37; 0:—/— | 4 | 1 | 0 | amul, circ | — | Damage Reduced by 10-25<br>RAW: `red-dmg(_;10;25)` | 0 /0 /0 |
| 122 | of Protection | 1 | 24 /— | 18; 0:—/— | 4 | 1 | 1 | tors, shld, circ | — | Damage Reduced by 2<br>RAW: `red-dmg(_;2;2)` | 0 /0 /0 |
| 123 | of Absorption | 1 | 32 /— | 24; 0:—/— | 4 | 1 | 1 | tors, shld, circ | — | Damage Reduced by 3<br>RAW: `red-dmg(_;3;3)` | 0 /0 /0 |
| 124 | of Life | 1 | 41 /— | 33; 0:—/— | 4 | 1 | 1 | tors, shld, circ | — | Damage Reduced by 4-7<br>RAW: `red-dmg(_;4;7)` | 0 /0 /0 |
| 125 | of Anima | 100 | 51 /— | 43; 0:—/— | 4 | 1 | 0 | tors, shld, circ | — | Damage Reduced by 8-15<br>RAW: `red-dmg(_;8;15)` | 0 /0 /0 |
| 126 | of Warding | 1 | 7 /— | 5; 0:—/— | 4 | 2 | 1 | tors, shld, ring, amul, orb, circ | — | Magic Damage Reduced by 1<br>RAW: `red-mag(_;1;1)` | 0 /0 /0 |
| 127 | of the Sentinel | 1 | 18 /— | 12; 0:—/— | 4 | 2 | 1 | ring, amul, orb, circ | — | Magic Damage Reduced by 2<br>RAW: `red-mag(_;2;2)` | 0 /0 /0 |
| 128 | of Guarding | 1 | 26 /— | 19; 0:—/— | 4 | 2 | 1 | amul, orb, circ | — | Magic Damage Reduced by 3<br>RAW: `red-mag(_;3;3)` | 0 /0 /0 |
| 129 | of Negation | 100 | 42 /— | 35; 0:—/— | 4 | 2 | 0 | amul, orb, circ | — | Magic Damage Reduced by 4-6<br>RAW: `red-mag(_;4;6)` | 0 /0 /0 |
| 130 | of the Sentinel | 1 | 24 /— | 18; 0:—/— | 4 | 2 | 1 | tors, shld, circ | — | Magic Damage Reduced by 2<br>RAW: `red-mag(_;2;2)` | 0 /0 /0 |
| 131 | of Guarding | 1 | 32 /— | 24; 0:—/— | 4 | 2 | 1 | tors, shld, circ | — | Magic Damage Reduced by 3<br>RAW: `red-mag(_;3;3)` | 0 /0 /0 |
| 132 | of Negation | 100 | 41 /— | 33; 0:—/— | 4 | 2 | 0 | tors, shld, circ | — | Magic Damage Reduced by 4-6<br>RAW: `red-mag(_;4;6)` | 0 /0 /0 |
| 160 | of Piercing | 1 | 25 /— | 18; 0:—/— | 2 | 4 | 1 | rod, knif, h2h | — | Ignore Target's Defense<br>RAW: `ignore-ac(_;1;1)` | 0 /0 /0 |
| 163 | of Thorns | 1 | 14 /— | 10; 0:—/— | 4 | 6 | 1 | tors, shld, belt, circ | — | Attacker Takes Damage of 1-3<br>RAW: `thorns(_;1;3)` | 0 /0 /0 |
| 164 | of Spikes | 1 | 21 /— | 15; 0:—/— | 4 | 6 | 1 | tors, shld, belt, circ | — | Attacker Takes Damage of 4-6<br>RAW: `thorns(_;4;6)` | 0 /0 /0 |
| 165 | of Razors | 100 | 34 /— | 26; 0:—/— | 4 | 6 | 1 | tors, shld, circ | — | Attacker Takes Damage of 7-9<br>RAW: `thorns(_;7;9)` | 0 /0 /0 |
| 166 | of Swords | 100 | 47 /— | 39; 0:—/— | 4 | 6 | 0 | tors, shld, circ | — | Attacker Takes Damage of 10-20<br>RAW: `thorns(_;10;20)` | 0 /0 /0 |
| 167 | of Malice | 100 | 37 /— | 29; 0:—/— | 4 | 6 | 1 | jewl | — | Attacker Takes Damage of 1-5<br>RAW: `thorns(_;1;5)` | 0 /0 /0 |
| 168 | of Readiness | 1 | 5 /— | 3; 0:—/— | 6 | 7 | 1 | weap | wand, orb | +10% Increased Attack Speed<br>RAW: `swing1(_;10;10)` | 0 /0 /0 |
| 169 | of Alacrity | 1 | 25 /— | 17; 0:—/— | 6 | 7 | 1 | weap | wand, orb | +20% Increased Attack Speed<br>RAW: `swing2(_;20;20)` | 0 /0 /0 |
| 170 | of Swiftness | 1 | 34 /— | 26; 0:—/— | 6 | 7 | 1 | mele | wand, staf, orb | +30% Increased Attack Speed<br>RAW: `swing2(_;30;30)` | 0 /0 /0 |
| 171 | of Quickness | 1 | 46 /— | 38; 0:—/— | 5 | 7 | 1 | mele | wand, staf, orb | +40% Increased Attack Speed<br>RAW: `swing3(_;40;40)` | 0 /0 /0 |
| 172 | of Alacrity | 100 | 43 /— | 35; 0:—/— | 4 | 7 | 1 | glov | — | +20% Increased Attack Speed<br>RAW: `swing2(_;20;20)` | 0 /0 /0 |
| 173 | of Fervor | 100 | 39 /— | 31; 0:—/— | 4 | 7 | 0 | jewl | — | +15% Increased Attack Speed<br>RAW: `swing1(_;15;15)` | 0 /0 /0 |
| 174 | of Blocking | 1 | 1 /— | 1; 0:—/— | 7 | 8 | 1 | shld | — | 10% Increased Chance of Blocking; +15% Faster Block Rate<br>RAW: `block(_;10;10); block2(_;15;15)` | 0 /0 /0 |
| 175 | of Deflecting | 1 | 11 /— | 8; 0:—/— | 6 | 8 | 1 | shld | — | 20% Increased Chance of Blocking; +30% Faster Block Rate<br>RAW: `block(_;20;20); block2(_;30;30)` | 0 /0 /0 |
| 176 | of the Apprentice | 1 | 5 /— | 3; 0:—/— | 6 | 9 | 1 | rod, ring, amul, orb, circ | — | +10% Faster Cast Rate<br>RAW: `cast1(_;10;10)` | 0 /0 /0 |
| 177 | of the Magus | 1 | 29 /— | 21; 0:—/— | 5 | 9 | 1 | rod, orb, circ | scep | +20% Faster Cast Rate<br>RAW: `cast3(_;20;20)` | 0 /0 /0 |
| 178 | of Frost | 1 | 4 /— | 3; 0:—/— | 5 | 10 | 1 | weap | wand, orb | +1 min cold dmg; +1-2 max cold dmg; (cold length 50 frames)<br>RAW: `cold-min(_;1;1); cold-max(_;1;2); cold-len(_;50;50)` | 0 /0 /0 |
| 179 | of the Icicle | 100 | 13 /— | 9; 0:—/— | 4 | 10 | 1 | weap | wand, orb | +1 min cold dmg; +3-4 max cold dmg; (cold length 75 frames)<br>RAW: `cold-min(_;1;1); cold-max(_;3;4); cold-len(_;75;75)` | 0 /0 /0 |
| 180 | of the Glacier | 1 | 27 /— | 20; 0:—/— | 3 | 10 | 1 | weap | wand, orb | +2-4 min cold dmg; +4-15 max cold dmg; (cold length 100 frames)<br>RAW: `cold-min(_;2;4); cold-max(_;4;15); cold-len(_;100;100)` | 0 /0 /0 |
| 181 | of Winter | 100 | 45 /— | 37; 0:—/— | 2 | 10 | 1 | mele | wand, orb | +5-9 min cold dmg; +16-50 max cold dmg; (cold length 150 frames)<br>RAW: `cold-min(_;5;9); cold-max(_;16;50); cold-len(_;150;150)` | 0 /0 /0 |
| 182 | of Frost | 1 | 55 /— | 41; 0:—/— | 2 | 10 | 1 | belt, amul | — | +1 min cold dmg; +3-6 max cold dmg; (cold length 50 frames)<br>RAW: `cold-min(_;1;1); cold-max(_;3;6); cold-len(_;50;50)` | 0 /0 /0 |
| 183 | of Frigidity | 100 | 16 /— | 12; 0:—/— | 2 | 10 | 1 | jewl | — | +1 min cold dmg; +3-5 max cold dmg; (cold length 50 frames)<br>RAW: `cold-min(_;1;1); cold-max(_;3;5); cold-len(_;50;50)` | 0 /0 /0 |
| 184 | of Warmth | 1 | 10 /— | 7; 0:—/— | 4 | 11 | 1 | shld, boot, glov, ring, amul, circ, orb | — | Half Freeze Duration<br>RAW: `half-freeze(_;1;1)` | 0 /0 /0 |
| 185 | of Flame | 1 | 4 /— | 3; 0:—/— | 5 | 12 | 1 | weap | wand, orb | +1 min fire dmg; +2-5 max fire dmg<br>RAW: `fire-min(_;1;1); fire-max(_;2;5)` | 0 /0 /0 |
| 186 | of Fire | 1 | 15 /— | 11; 0:—/— | 4 | 12 | 1 | weap | wand, orb | +1-4 min fire dmg; +6-11 max fire dmg<br>RAW: `fire-min(_;1;4); fire-max(_;6;11)` | 0 /0 /0 |
| 187 | of Burning | 1 | 25 /— | 18; 0:—/— | 3 | 12 | 1 | weap | wand, orb | +5-9 min fire dmg; +10-20 max fire dmg<br>RAW: `fire-min(_;5;9); fire-max(_;10;20)` | 0 /0 /0 |
| 188 | of Incineration | 100 | 43 /— | 35; 0:—/— | 2 | 12 | 1 | mele | wand, orb | +10-20 min fire dmg; +21-75 max fire dmg<br>RAW: `fire-min(_;10;20); fire-max(_;21;75)` | 0 /0 /0 |
| 189 | of Flame | 100 | 40 /— | 30; 0:—/— | 2 | 12 | 1 | glov, ring, amul | — | +1 min fire dmg; +2-6 max fire dmg<br>RAW: `fire-min(_;1;1); fire-max(_;2;6)` | 0 /0 /0 |
| 190 | of Passion | 100 | 15 /— | 11; 0:—/— | 2 | 12 | 1 | jewl | — | +1-3 min fire dmg; +6-10 max fire dmg<br>RAW: `fire-min(_;1;3); fire-max(_;6;10)` | 0 /0 /0 |
| 191 | of Shock | 1 | 4 /— | 3; 0:—/— | 5 | 13 | 1 | weap | wand, orb | +1 min ltng dmg; +6-8 max ltng dmg<br>RAW: `ltng-min(_;1;1); ltng-max(_;6;8)` | 0 /0 /0 |
| 192 | of Lightning | 1 | 15 /— | 11; 0:—/— | 4 | 13 | 1 | weap | wand, orb | +1 min ltng dmg; +9-16 max ltng dmg<br>RAW: `ltng-min(_;1;1); ltng-max(_;9;16)` | 0 /0 /0 |
| 193 | of Thunder | 1 | 25 /— | 18; 0:—/— | 3 | 13 | 1 | weap | wand, orb | +1 min ltng dmg; +17-40 max ltng dmg<br>RAW: `ltng-min(_;1;1); ltng-max(_;17;40)` | 0 /0 /0 |
| 194 | of Storms | 100 | 34 /— | 26; 0:—/— | 2 | 13 | 1 | mele | wand, orb | +1-6 min ltng dmg; +41-120 max ltng dmg<br>RAW: `ltng-min(_;1;6); ltng-max(_;41;120)` | 0 /0 /0 |
| 195 | of Shock | 100 | 50 /— | 37; 0:—/— | 2 | 13 | 1 | boot, ring, amul | — | +1 min ltng dmg; +11-23 max ltng dmg<br>RAW: `ltng-min(_;1;1); ltng-max(_;11;23)` | 0 /0 /0 |
| 196 | of Ennui | 100 | 15 /— | 11; 0:—/— | 2 | 13 | 1 | jewl | — | +1 min ltng dmg; +10-20 max ltng dmg<br>RAW: `ltng-min(_;1;1); ltng-max(_;10;20)` | 0 /0 /0 |
| 197 | of Craftsmanship | 1 | 1 /— | 1; 0:—/— | 8 | 14 | 1 | weap, ring, amul | wand, staf, orb | +1 to Maximum Damage<br>RAW: `dmg-max(_;1;1)` | 0 /0 /0 |
| 198 | of Quality | 1 | 4 /— | 3; 0:—/— | 8 | 14 | 1 | weap | wand, staf, orb | +2 to Maximum Damage<br>RAW: `dmg-max(_;2;2)` | 0 /0 /0 |
| 199 | of Maiming | 1 | 7 /— | 5; 0:—/— | 7 | 14 | 1 | weap | wand, staf, orb | +3-4 to Maximum Damage<br>RAW: `dmg-max(_;3;4)` | 0 /0 /0 |
| 200 | of Slaying | 1 | 11 /— | 8; 0:—/— | 7 | 14 | 1 | weap | wand, staf, orb | +5-7 to Maximum Damage<br>RAW: `dmg-max(_;5;7)` | 0 /0 /0 |
| 201 | of Gore | 1 | 14 /— | 10; 0:—/— | 6 | 14 | 1 | weap | wand, staf, orb | +8-10 to Maximum Damage<br>RAW: `dmg-max(_;8;10)` | 0 /0 /0 |
| 202 | of Carnage | 1 | 19 /— | 14; 0:—/— | 6 | 14 | 1 | weap | wand, staf, orb | +11-14 to Maximum Damage<br>RAW: `dmg-max(_;11;14)` | 0 /0 /0 |
| 203 | of Slaughter | 1 | 25 /— | 18; 0:—/— | 5 | 14 | 1 | weap | wand, staf, orb | +15-20 to Maximum Damage<br>RAW: `dmg-max(_;15;20)` | 0 /0 /0 |
| 204 | of Butchery | 100 | 35 /— | 27; 0:—/— | 5 | 14 | 0 | weap | wand, staf, orb | +21-40 to Maximum Damage<br>RAW: `dmg-max(_;21;40)` | 0 /0 /0 |
| 205 | of Evisceration | 100 | 45 /— | 37; 0:—/— | 4 | 14 | 0 | weap | wand, staf, orb | +41-63 to Maximum Damage<br>RAW: `dmg-max(_;41;63)` | 0 /0 /0 |
| 206 | of Maiming | 1 | 42 /— | 34; 0:—/— | 4 | 14 | 1 | shld, ring, amul | — | +3-4 to Maximum Damage<br>RAW: `dmg-max(_;3;4)` | 0 /0 /0 |
| 207 | of Craftsmanship | 100 | 1 /7 | 1; 0:—/— | 4 | 14 | 1 | circ | — | +1-2 to Maximum Damage<br>RAW: `dmg-max(_;1;2)` | 0 /0 /0 |
| 208 | of Craftsmanship | 100 | 8 /14 | 6; 0:—/— | 4 | 14 | 1 | circ | — | +2-3 to Maximum Damage<br>RAW: `dmg-max(_;2;3)` | 0 /0 /0 |
| 209 | of Craftsmanship | 100 | 15 /— | 11; 0:—/— | 4 | 14 | 1 | circ | — | +4-5 to Maximum Damage<br>RAW: `dmg-max(_;4;5)` | 0 /0 /0 |
| 210 | of Quality | 100 | 23 /29 | 17; 0:—/— | 4 | 14 | 1 | circ | — | +6-7 to Maximum Damage<br>RAW: `dmg-max(_;6;7)` | 0 /0 /0 |
| 211 | of Quality | 100 | 30 /— | 22; 0:—/— | 4 | 14 | 1 | circ | — | +7-8 to Maximum Damage<br>RAW: `dmg-max(_;7;8)` | 0 /0 /0 |
| 212 | of Maiming | 100 | 37 /44 | 29; 0:—/— | 4 | 14 | 0 | circ | — | +9-10 to Maximum Damage<br>RAW: `dmg-max(_;9;10)` | 0 /0 /0 |
| 213 | of Maiming | 100 | 45 /— | 37; 0:—/— | 4 | 14 | 0 | circ | — | +11-12 to Maximum Damage<br>RAW: `dmg-max(_;11;12)` | 0 /0 /0 |
| 222 | of Ire | 100 | 4 /— | 3; 0:—/— | 4 | 14 | 1 | jewl | — | +2-5 to Maximum Damage<br>RAW: `dmg-max(_;2;5)` | 0 /0 /0 |
| 223 | of Wrath | 100 | 11 /— | 8; 0:—/— | 4 | 14 | 1 | jewl | — | +6-9 to Maximum Damage<br>RAW: `dmg-max(_;6;9)` | 0 /0 /0 |
| 224 | of Carnage | 100 | 25 /— | 18; 0:—/— | 4 | 14 | 0 | jewl | — | +11-15 to Maximum Damage<br>RAW: `dmg-max(_;11;15)` | 0 /0 /0 |
| 225 | of Worth | 1 | 1 /— | 1; 0:—/— | 8 | 15 | 1 | weap | staf, wand, orb | +1-2 to Minimum Damage<br>RAW: `dmg-min(_;1;2)` | 0 /0 /0 |
| 226 | of Measure | 1 | 12 /— | 9; 0:—/— | 7 | 15 | 1 | weap | staf, wand, orb | +3-4 to Minimum Damage<br>RAW: `dmg-min(_;3;4)` | 0 /0 /0 |
| 227 | of Excellence | 1 | 24 /— | 18; 0:—/— | 6 | 15 | 1 | weap | staf, wand, orb | +5-8 to Minimum Damage<br>RAW: `dmg-min(_;5;8)` | 0 /0 /0 |
| 228 | of Performance | 1 | 48 /— | 40; 0:—/— | 5 | 15 | 1 | weap | staf, wand, orb | +9-14 to Minimum Damage<br>RAW: `dmg-min(_;9;14)` | 0 /0 /0 |
| 229 | of Transcendence | 100 | 76 /— | 68; 0:—/— | 4 | 15 | 1 | weap | staf, wand, orb | +15-20 to Minimum Damage<br>RAW: `dmg-min(_;15;20)` | 0 /0 /0 |
| 230 | of Worth | 1 | 15 /— | 11; 0:—/— | 4 | 15 | 1 | ring, amul, circ | — | +2-3 to Minimum Damage<br>RAW: `dmg-min(_;2;3)` | 0 /0 /0 |
| 231 | of Measure | 1 | 37 /— | 29; 0:—/— | 4 | 15 | 1 | ring, amul, circ | — | +4-5 to Minimum Damage<br>RAW: `dmg-min(_;4;5)` | 0 /0 /0 |
| 232 | of Excellence | 1 | 59 /— | 51; 0:—/— | 4 | 15 | 1 | ring, amul, circ | — | +6-9 to Minimum Damage<br>RAW: `dmg-min(_;6;9)` | 0 /0 /0 |
| 233 | of Performance | 100 | 81 /— | 73; 0:—/— | 4 | 15 | 0 | ring, amul, circ | — | +10-13 to Minimum Damage<br>RAW: `dmg-min(_;10;13)` | 0 /0 /0 |
| 234 | of Joyfulness | 100 | 5 /— | 3; 0:—/— | 4 | 15 | 1 | jewl | — | +1-4 to Minimum Damage<br>RAW: `dmg-min(_;1;4)` | 0 /0 /0 |
| 235 | of Bliss | 100 | 43 /— | 37; 0:—/— | 4 | 15 | 1 | jewl | — | +5-10 to Minimum Damage<br>RAW: `dmg-min(_;5;10)` | 0 /0 /0 |
| 236 | of Blight | 1 | 5 /— | 3; 0:—/— | 5 | 16 | 1 | weap, circ | rod, orb | Approx. 7.03125 Poison Damage over 3s; authoritative rate 24–24/256 per frame<br>RAW: `dmg-pois(75;24;24)` | 0 /0 /0 |
| 237 | of Venom | 1 | 15 /— | 11; 0:—/— | 4 | 16 | 1 | weap, circ | rod, orb | Approx. 21.0938 Poison Damage over 4s; authoritative rate 54–54/256 per frame<br>RAW: `dmg-pois(100;54;54)` | 0 /0 /0 |
| 238 | of Pestilence | 1 | 25 /— | 18; 0:—/— | 3 | 16 | 1 | weap, circ | rod, orb | Approx. 50.293 Poison Damage over 5s; authoritative rate 103–103/256 per frame<br>RAW: `dmg-pois(125;103;103)` | 0 /0 /0 |
| 239 | of Anthrax | 100 | 33 /— | 25; 0:—/— | 2 | 16 | 1 | weap | rod, orb | Approx. 100.195 Poison Damage over 6s; authoritative rate 171–171/256 per frame<br>RAW: `dmg-pois(150;171;171)` | 0 /0 /0 |
| 240 | of Blight | 100 | 45 /— | 33; 0:—/— | 2 | 16 | 1 | ring, amul | — | Approx. 50.0977 Poison Damage over 3s; authoritative rate 171–171/256 per frame<br>RAW: `dmg-pois(75;171;171)` | 0 /0 /0 |
| 241 | of Envy | 100 | 1 /— | 1; 0:—/— | 2 | 16 | 1 | jewl | — | Approx. 20.1172 Poison Damage over 2s; authoritative rate 103–103/256 per frame<br>RAW: `dmg-pois(50;103;103)` | 0 /0 /0 |
| 242 | of Dexterity | 1 | 1 /— | 1; 0:—/— | 4 | 17 | 1 | amul, miss, circ | — | +1-2 to Dexterity<br>RAW: `dex(_;1;2)` | 0 /0 /0 |
| 243 | of Skill | 1 | 11 /— | 8; 0:—/— | 3 | 17 | 1 | amul, miss, circ | — | +3-5 to Dexterity<br>RAW: `dex(_;3;5)` | 0 /0 /0 |
| 244 | of Accuracy | 1 | 27 /— | 20; 0:—/— | 3 | 17 | 1 | amul, miss, circ | — | +6-9 to Dexterity<br>RAW: `dex(_;6;9)` | 0 /0 /0 |
| 245 | of Precision | 1 | 43 /— | 35; 0:—/— | 3 | 17 | 1 | amul, miss, circ | — | +10-15 to Dexterity<br>RAW: `dex(_;10;15)` | 0 /0 /0 |
| 246 | of Perfection | 1 | 59 /— | 51; 0:—/— | 3 | 17 | 1 | amul, miss, circ | — | +16-20 to Dexterity<br>RAW: `dex(_;16;20)` | 0 /0 /0 |
| 247 | of Nirvana | 100 | 72 /— | 64; 0:—/— | 3 | 17 | 0 | amul, miss, circ | — | +21-30 to Dexterity<br>RAW: `dex(_;21;30)` | 0 /0 /0 |
| 248 | of Dexterity | 1 | 6 /— | 4; 0:—/— | 4 | 17 | 1 | ring, glov | — | +1-2 to Dexterity<br>RAW: `dex(_;1;2)` | 0 /0 /0 |
| 249 | of Skill | 1 | 22 /— | 16; 0:—/— | 3 | 17 | 1 | ring, glov | — | +3-5 to Dexterity<br>RAW: `dex(_;3;5)` | 0 /0 /0 |
| 250 | of Accuracy | 1 | 39 /— | 31; 0:—/— | 3 | 17 | 1 | ring, glov | — | +6-9 to Dexterity<br>RAW: `dex(_;6;9)` | 0 /0 /0 |
| 251 | of Precision | 1 | 56 /— | 48; 0:—/— | 3 | 17 | 1 | ring, glov | — | +10-15 to Dexterity<br>RAW: `dex(_;10;15)` | 0 /0 /0 |
| 252 | of Perfection | 100 | 75 /— | 67; 0:—/— | 3 | 17 | 0 | ring, glov | — | +16-20 to Dexterity<br>RAW: `dex(_;16;20)` | 0 /0 /0 |
| 253 | of Dexterity | 1 | 13 /— | 9; 0:—/— | 3 | 17 | 1 | tors, boot | glov | +2-3 to Dexterity<br>RAW: `dex(_;2;3)` | 0 /0 /0 |
| 254 | of Skill | 1 | 34 /— | 26; 0:—/— | 3 | 17 | 1 | tors, boot | glov | +4-5 to Dexterity<br>RAW: `dex(_;4;5)` | 0 /0 /0 |
| 255 | of Accuracy | 1 | 46 /— | 38; 0:—/— | 3 | 17 | 1 | tors, boot | glov | +6-9 to Dexterity<br>RAW: `dex(_;6;9)` | 0 /0 /0 |
| 256 | of Precision | 100 | 60 /— | 52; 0:—/— | 3 | 17 | 0 | tors, boot | glov | +10-15 to Dexterity<br>RAW: `dex(_;10;15)` | 0 /0 /0 |
| 257 | of Dexterity | 100 | 1 /— | 1; 0:—/— | 4 | 31 | 1 | lcha | — | +3-4 to Dexterity<br>RAW: `dex(_;3;4)` | 0 /0 /0 |
| 258 | of Dexterity | 100 | 3 /— | 2; 0:—/— | 4 | 31 | 1 | mcha | — | +2-3 to Dexterity<br>RAW: `dex(_;2;3)` | 0 /0 /0 |
| 259 | of Dexterity | 100 | 7 /— | 5; 0:—/— | 4 | 31 | 1 | scha | — | +1 to Dexterity<br>RAW: `dex(_;1;1)` | 0 /0 /0 |
| 260 | of Dexterity | 100 | 14 /— | 10; 0:—/— | 4 | 31 | 1 | lcha | — | +5-6 to Dexterity<br>RAW: `dex(_;5;6)` | 0 /0 /0 |
| 261 | of Dexterity | 100 | 18 /— | 13; 0:—/— | 4 | 31 | 1 | mcha | — | +4-5 to Dexterity<br>RAW: `dex(_;4;5)` | 0 /0 /0 |
| 262 | of Dexterity | 100 | 22 /— | 16; 0:—/— | 4 | 31 | 1 | scha | — | +2 to Dexterity<br>RAW: `dex(_;2;2)` | 0 /0 /0 |
| 263 | of Daring | 100 | 7 /— | 5; 0:—/— | 3 | 17 | 1 | jewl | — | +1-3 to Dexterity<br>RAW: `dex(_;1;3)` | 0 /0 /0 |
| 264 | of Balance | 1 | 5 /— | 3; 0:—/— | 4 | 18 | 1 | armo | glov | +10% Faster Hit Recovery<br>RAW: `balance1(_;10;10)` | 0 /0 /0 |
| 265 | of Equilibrium | 1 | 9 /— | 6; 0:—/— | 4 | 18 | 1 | tors, belt, shld | — | +17% Faster Hit Recovery<br>RAW: `balance2(_;17;17)` | 0 /0 /0 |
| 266 | of Stability | 1 | 18 /— | 13; 0:—/— | 4 | 18 | 1 | tors, belt | — | +24% Faster Hit Recovery<br>RAW: `balance3(_;24;24)` | 0 /0 /0 |
| 267 | of Balance | 100 | 1 /— | 1; 0:—/— | 4 | 18 | 1 | lcha | — | +12% Faster Hit Recovery<br>RAW: `balance3(_;12;12)` | 0 /0 /0 |
| 268 | of Balance | 100 | 19 /— | 14; 0:—/— | 4 | 18 | 1 | mcha | — | +8% Faster Hit Recovery<br>RAW: `balance2(_;8;8)` | 0 /0 /0 |
| 269 | of Balance | 100 | 37 /— | 29; 0:—/— | 4 | 18 | 1 | scha | — | +5% Faster Hit Recovery<br>RAW: `balance1(_;5;5)` | 0 /0 /0 |
| 270 | of Truth | 100 | 44 /— | 36; 0:—/— | 4 | 18 | 1 | jewl | — | +7% Faster Hit Recovery<br>RAW: `balance1(_;7;7)` | 0 /0 /0 |
| 271 | of Regeneration | 1 | 10 /— | 7; 0:—/— | 4 | 19 | 1 | scep, belt, ring, amul, circ | — | Replenish Life +3-5<br>RAW: `regen(_;3;5)` | 0 /0 /0 |
| 272 | of Regeneration | 1 | 40 /— | 30; 0:—/— | 4 | 19 | 1 | shld, glov | — | Replenish Life +3-5<br>RAW: `regen(_;3;5)` | 0 /0 /0 |
| 273 | of Regeneration | 1 | 70 /— | 52; 0:—/— | 4 | 19 | 1 | tors, weap, boot | scep | Replenish Life +3-5<br>RAW: `regen(_;3;5)` | 0 /0 /0 |
| 274 | of Regrowth | 1 | 17 /— | 12; 0:—/— | 4 | 19 | 1 | scep, amul, circ | — | Replenish Life +6-10<br>RAW: `regen(_;6;10)` | 0 /0 /0 |
| 275 | of Regrowth | 1 | 55 /— | 41; 0:—/— | 4 | 19 | 1 | belt, ring | — | Replenish Life +6-9<br>RAW: `regen(_;6;9)` | 0 /0 /0 |
| 276 | of Revivification | 100 | 38 /— | 30; 0:—/— | 4 | 19 | 0 | scep, amul, circ | — | Replenish Life +11-15<br>RAW: `regen(_;11;15)` | 0 /0 /0 |
| 277 | of Honor | 100 | 47 /— | 35; 0:—/— | 4 | 19 | 1 | jewl | — | Replenish Life +1-4<br>RAW: `regen(_;1;4)` | 0 /0 /0 |
| 278 | of Vileness | 1 | 9 /— | 6; 0:—/— | 3 | 20 | 1 | mele | rod, orb | Prevent Monster Heal<br>RAW: `noheal(_;1;1)` | 0 /0 /0 |
| 279 | of Greed | 1 | 1 /— | 1; 0:—/— | 4 | 21 | 1 | ring, amul, circ | — | 25-40% Extra Gold from Monsters<br>RAW: `gold%(_;25;40)` | 0 /0 /0 |
| 280 | of Wealth | 1 | 17 /— | 12; 0:—/— | 4 | 21 | 1 | boot, glov, belt, amul, circ | — | 41-80% Extra Gold from Monsters<br>RAW: `gold%(_;41;80)` | 0 /0 /0 |
| 281 | of Greed | 100 | 1 /— | 1; 0:—/— | 4 | 21 | 1 | lcha | — | 10-20% Extra Gold from Monsters<br>RAW: `gold%(_;10;20)` | 0 /0 /0 |
| 282 | of Greed | 100 | 7 /— | 5; 0:—/— | 4 | 21 | 1 | lcha | — | 21-30% Extra Gold from Monsters<br>RAW: `gold%(_;21;30)` | 0 /0 /0 |
| 283 | of Greed | 100 | 19 /— | 14; 0:—/— | 4 | 21 | 1 | lcha | — | 31-40% Extra Gold from Monsters<br>RAW: `gold%(_;31;40)` | 0 /0 /0 |
| 284 | of Greed | 100 | 1 /— | 5; 0:—/— | 4 | 21 | 1 | mcha | — | 5-10% Extra Gold from Monsters<br>RAW: `gold%(_;5;10)` | 0 /0 /0 |
| 285 | of Greed | 100 | 20 /— | 15; 0:—/— | 4 | 21 | 1 | mcha | — | 11-22% Extra Gold from Monsters<br>RAW: `gold%(_;11;22)` | 0 /0 /0 |
| 286 | of Greed | 100 | 1 /— | 15; 0:—/— | 4 | 21 | 1 | scha | — | 5-10% Extra Gold from Monsters<br>RAW: `gold%(_;5;10)` | 0 /0 /0 |
| 287 | of Avarice | 100 | 1 /— | 1; 0:—/— | 4 | 21 | 1 | jewl | — | 10-30% Extra Gold from Monsters<br>RAW: `gold%(_;10;30)` | 0 /0 /0 |
| 288 | of Chance | 1 | 12 /— | 9; 0:—/— | 4 | 22 | 1 | boot, glov, ring, amul, circ | — | 5-15% Better Chance of Getting Magic Items<br>RAW: `mag%(_;5;15)` | 0 /0 /0 |
| 289 | of Fortune | 1 | 16 /— | 12; 0:—/— | 4 | 22 | 1 | boot, glov, amul, circ | — | 16-25% Better Chance of Getting Magic Items<br>RAW: `mag%(_;16;25)` | 0 /0 /0 |
| 290 | of Fortune | 1 | 42 /— | 31; 0:—/— | 4 | 22 | 0 | ring | — | 16-25% Better Chance of Getting Magic Items<br>RAW: `mag%(_;16;25)` | 0 /0 /0 |
| 291 | of Luck | 100 | 26 /— | 19; 0:—/— | 4 | 22 | 0 | boot, amul, circ | — | 26-35% Better Chance of Getting Magic Items<br>RAW: `mag%(_;26;35)` | 0 /0 /0 |
| 292 | of Fortune | 100 | 31 /— | 18; 0:—/— | 3 | 22 | 1 | scha | — | 3-5% Better Chance of Getting Magic Items<br>RAW: `mag%(_;3;5)` | 0 /0 /0 |
| 293 | of Good Luck | 100 | 47 /— | 33; 0:—/— | 2 | 22 | 0 | scha | — | 6-7% Better Chance of Getting Magic Items<br>RAW: `mag%(_;6;7)` | 0 /0 /0 |
| 294 | of Prosperity | 100 | 26 /— | 19; 0:—/— | 2 | 22 | 1 | jewl | — | 5-10% Better Chance of Getting Magic Items<br>RAW: `mag%(_;5;10)` | 0 /0 /0 |
| 295 | of Energy | 1 | 1 /— | 1; 0:—/— | 4 | 23 | 1 | amul, orb, circ, wand, staf | — | +1-3 to Energy<br>RAW: `enr(_;1;3)` | 0 /0 /0 |
| 296 | of the Mind | 1 | 7 /— | 3; 0:—/— | 4 | 23 | 1 | amul, orb, circ, wand, staf | — | +4-6 to Energy<br>RAW: `enr(_;4;6)` | 0 /0 /0 |
| 297 | of Brilliance | 1 | 13 /— | 9; 0:—/— | 3 | 23 | 1 | amul, orb, circ, wand, staf | — | +7-10 to Energy<br>RAW: `enr(_;7;10)` | 0 /0 /0 |
| 298 | of Sorcery | 1 | 21 /— | 16; 0:—/— | 3 | 23 | 1 | amul, orb, circ, wand, staf | — | +11-15 to Energy<br>RAW: `enr(_;11;15)` | 0 /0 /0 |
| 299 | of Wizardry | 1 | 31 /— | 23; 0:—/— | 3 | 23 | 1 | amul, orb, circ, wand, staf | — | +16-20 to Energy<br>RAW: `enr(_;16;20)` | 0 /0 /0 |
| 300 | of Enlightenment | 100 | 41 /— | 33; 0:—/— | 3 | 23 | 0 | amul, orb, circ, wand, staf | — | +21-30 to Energy<br>RAW: `enr(_;21;30)` | 0 /0 /0 |
| 301 | of Energy | 1 | 7 /— | 5; 0:—/— | 4 | 23 | 1 | ring | — | +1-3 to Energy<br>RAW: `enr(_;1;3)` | 0 /0 /0 |
| 302 | of the Mind | 1 | 13 /— | 9; 0:—/— | 3 | 23 | 1 | ring | — | +4-6 to Energy<br>RAW: `enr(_;4;6)` | 0 /0 /0 |
| 303 | of Brilliance | 1 | 21 /— | 16; 0:—/— | 3 | 23 | 1 | ring | — | +7-10 to Energy<br>RAW: `enr(_;7;10)` | 0 /0 /0 |
| 304 | of Sorcery | 1 | 31 /— | 23; 0:—/— | 3 | 23 | 1 | ring | — | +11-15 to Energy<br>RAW: `enr(_;11;15)` | 0 /0 /0 |
| 305 | of Wizardry | 100 | 41 /— | 33; 0:—/— | 3 | 23 | 0 | ring | — | +16-20 to Energy<br>RAW: `enr(_;16;20)` | 0 /0 /0 |
| 306 | of Energy | 1 | 4 /— | 3; 0:—/— | 3 | 23 | 1 | helm, scep | — | +1-3 to Energy<br>RAW: `enr(_;1;3)` | 0 /0 /0 |
| 307 | of the Mind | 1 | 10 /— | 7; 0:—/— | 3 | 23 | 1 | helm, scep | — | +4-6 to Energy<br>RAW: `enr(_;4;6)` | 0 /0 /0 |
| 308 | of Brilliance | 1 | 16 /— | 12; 0:—/— | 3 | 23 | 1 | helm, scep | — | +7-10 to Energy<br>RAW: `enr(_;7;10)` | 0 /0 /0 |
| 309 | of Sorcery | 100 | 26 /— | 21; 0:—/— | 3 | 23 | 0 | helm, scep | — | +11-15 to Energy<br>RAW: `enr(_;11;15)` | 0 /0 /0 |
| 310 | of Knowledge | 100 | 9 /— | 6; 0:—/— | 3 | 23 | 1 | jewl | — | +1-5 to Energy<br>RAW: `enr(_;1;5)` | 0 /0 /0 |
| 311 | of the Bear | 1 | 8 /— | 6; 0:—/— | 3 | 24 | 1 | mele | — | Knockback<br>RAW: `knock(_;1;1)` | 0 /0 /0 |
| 312 | of Light | 1 | 6 /— | 4; 0:—/— | 1 | 25 | 1 | armo, rod, ring, amul | — | +1 to Light Radius; +15 to Attack Rating<br>RAW: `light(_;1;1); att(_;15;15)` | 0 /0 /0 |
| 313 | of Radiance | 1 | 15 /— | 11; 0:—/— | 1 | 25 | 1 | rod, miss, ring, amul, helm | — | +3 to Light Radius; +30 to Attack Rating<br>RAW: `light(_;3;3); att(_;30;30)` | 0 /0 /0 |
| 314 | of the Sun | 1 | 17 /— | 12; 0:—/— | 1 | 25 | 1 | rod, miss, glov, ring, amul, helm | — | +5 to Light Radius; 5% Bonus to Attack Rating<br>RAW: `light(_;5;5); att%(_;5;5)` | 0 /0 /0 |
| 315 | of the Jackal | 1 | 1 /— | 1; 0:—/— | 3 | 26 | 1 | tors, belt, amul, phlm, circ | — | +1-5 to Life<br>RAW: `hp(_;1;5)` | 0 /0 /0 |
| 316 | of the Fox | 1 | 7 /— | 5; 0:—/— | 3 | 26 | 1 | tors, belt, amul, phlm, circ | — | +6-10 to Life<br>RAW: `hp(_;6;10)` | 0 /0 /0 |
| 317 | of the Wolf | 1 | 15 /— | 11; 0:—/— | 3 | 26 | 1 | tors, belt, amul, phlm, circ | — | +11-20 to Life<br>RAW: `hp(_;11;20)` | 0 /0 /0 |
| 318 | of the Tiger | 1 | 20 /— | 15; 0:—/— | 3 | 26 | 1 | tors, belt, amul, phlm, circ | — | +21-30 to Life<br>RAW: `hp(_;21;30)` | 0 /0 /0 |
| 319 | of the Mammoth | 1 | 25 /— | 18; 0:—/— | 3 | 26 | 1 | tors, belt, amul, phlm, circ | — | +31-40 to Life<br>RAW: `hp(_;31;40)` | 0 /0 /0 |
| 320 | of the Colosuss | 1 | 30 /— | 22; 0:—/— | 3 | 26 | 1 | tors, belt, amul, phlm, circ | — | +41-60 to Life<br>RAW: `hp(_;41;60)` | 0 /0 /0 |
| 321 | of the Squid | 100 | 40 /— | 30; 0:—/— | 3 | 26 | 0 | tors, belt, amul, phlm, circ | — | +61-80 to Life<br>RAW: `hp(_;61;80)` | 0 /0 /0 |
| 322 | of the Whale | 100 | 50 /— | 37; 0:—/— | 3 | 26 | 0 | tors, belt, amul, phlm, circ | — | +81-100 to Life<br>RAW: `hp(_;81;100)` | 0 /0 /0 |
| 323 | of the Jackal | 100 | 4 /— | 3; 0:—/— | 3 | 26 | 1 | shld, pelt | — | +1-5 to Life<br>RAW: `hp(_;1;5)` | 0 /0 /0 |
| 324 | of the Fox | 100 | 11 /— | 8; 0:—/— | 3 | 26 | 1 | shld, pelt | — | +6-10 to Life<br>RAW: `hp(_;6;10)` | 0 /0 /0 |
| 325 | of the Wolf | 100 | 27 /— | 20; 0:—/— | 3 | 26 | 1 | shld, pelt | — | +11-20 to Life<br>RAW: `hp(_;11;20)` | 0 /0 /0 |
| 326 | of the Tiger | 100 | 43 /— | 35; 0:—/— | 3 | 26 | 1 | shld, pelt | — | +21-30 to Life<br>RAW: `hp(_;21;30)` | 0 /0 /0 |
| 327 | of the Mammoth | 100 | 59 /— | 51; 0:—/— | 3 | 26 | 1 | shld, pelt | — | +31-40 to Life<br>RAW: `hp(_;31;40)` | 0 /0 /0 |
| 328 | of the Colosuss | 100 | 75 /— | 67; 0:—/— | 3 | 26 | 0 | shld, pelt | — | +41-60 to Life<br>RAW: `hp(_;41;60)` | 0 /0 /0 |
| 329 | of the Jackal | 1 | 8 /— | 6; 0:—/— | 3 | 26 | 1 | club, hamm, mace, ring, helm | — | +1-5 to Life<br>RAW: `hp(_;1;5)` | 0 /0 /0 |
| 330 | of the Fox | 1 | 17 /— | 13; 0:—/— | 3 | 26 | 1 | club, hamm, mace, ring, helm | — | +6-10 to Life<br>RAW: `hp(_;6;10)` | 0 /0 /0 |
| 331 | of the Wolf | 1 | 34 /— | 26; 0:—/— | 3 | 26 | 1 | club, hamm, mace, ring, helm | — | +11-20 to Life<br>RAW: `hp(_;11;20)` | 0 /0 /0 |
| 332 | of the Tiger | 1 | 51 /— | 43; 0:—/— | 3 | 26 | 1 | club, hamm, mace, ring, helm | — | +21-30 to Life<br>RAW: `hp(_;21;30)` | 0 /0 /0 |
| 333 | of the Mammoth | 1 | 68 /— | 60; 0:—/— | 3 | 26 | 1 | club, hamm, mace, ring, helm | — | +31-40 to Life<br>RAW: `hp(_;31;40)` | 0 /0 /0 |
| 334 | of Life | 100 | 1 /— | 1; 0:—/— | 4 | 26 | 1 | lcha | — | +5-10 to Life<br>RAW: `hp(_;5;10)` | 0 /0 /0 |
| 335 | of Life | 100 | 9 /— | 6; 0:—/— | 4 | 26 | 1 | lcha | — | +11-15 to Life<br>RAW: `hp(_;11;15)` | 0 /0 /0 |
| 336 | of Life | 100 | 19 /— | 14; 0:—/— | 4 | 26 | 1 | lcha | — | +16-20 to Life<br>RAW: `hp(_;16;20)` | 0 /0 /0 |
| 337 | of Substinence | 100 | 31 /— | 23; 0:—/— | 4 | 26 | 1 | lcha | — | +21-25 to Life<br>RAW: `hp(_;21;25)` | 0 /0 /0 |
| 338 | of Substinence | 100 | 45 /— | 37; 0:—/— | 4 | 26 | 1 | lcha | — | +26-30 to Life<br>RAW: `hp(_;26;30)` | 0 /0 /0 |
| 339 | of Substinence | 100 | 61 /— | 53; 0:—/— | 4 | 26 | 1 | lcha | — | +31-35 to Life<br>RAW: `hp(_;31;35)` | 0 /0 /0 |
| 340 | of Vita | 100 | 77 /— | 69; 0:—/— | 4 | 26 | 0 | lcha | — | +36-40 to Life<br>RAW: `hp(_;36;40)` | 0 /0 /0 |
| 341 | of Vita | 100 | 91 /— | 83; 0:—/— | 4 | 26 | 0 | lcha | — | +41-45 to Life<br>RAW: `hp(_;41;45)` | 0 /0 /0 |
| 342 | of Vita | 100 | 110 /— | 97; 0:—/— | 4 | 26 | 0 | lcha | — | +46-50 to Life<br>RAW: `hp(_;46;50)` | 0 /0 /0 |
| 343 | of Life | 100 | 1 /— | 9; 0:—/— | 4 | 26 | 1 | mcha | — | +6-10 to Life<br>RAW: `hp(_;6;10)` | 0 /0 /0 |
| 344 | of Life | 100 | 12 /— | 9; 0:—/— | 4 | 26 | 1 | mcha | — | +11-15 to Life<br>RAW: `hp(_;11;15)` | 0 /0 /0 |
| 345 | of Substinence | 100 | 26 /— | 19; 0:—/— | 4 | 26 | 1 | mcha | — | +16-20 to Life<br>RAW: `hp(_;16;20)` | 0 /0 /0 |
| 346 | of Substinence | 100 | 42 /— | 34; 0:—/— | 4 | 26 | 1 | mcha | — | +21-25 to Life<br>RAW: `hp(_;21;25)` | 0 /0 /0 |
| 347 | of Vita | 100 | 58 /— | 50; 0:—/— | 4 | 26 | 0 | mcha | — | +26-30 to Life<br>RAW: `hp(_;26;30)` | 0 /0 /0 |
| 348 | of Vita | 100 | 74 /— | 66; 0:—/— | 4 | 26 | 0 | mcha | — | +31-35 to Life<br>RAW: `hp(_;31;35)` | 0 /0 /0 |
| 349 | of Life | 100 | 1 /— | 14; 0:—/— | 4 | 26 | 1 | scha | — | +5-10 to Life<br>RAW: `hp(_;5;10)` | 0 /0 /0 |
| 350 | of Substinence | 100 | 23 /— | 17; 0:—/— | 4 | 26 | 1 | scha | — | +11-15 to Life<br>RAW: `hp(_;11;15)` | 0 /0 /0 |
| 351 | of Vita | 100 | 47 /— | 39; 0:—/— | 4 | 26 | 0 | scha | — | +16-20 to Life<br>RAW: `hp(_;16;20)` | 0 /0 /0 |
| 352 | of Spirit | 100 | 1 /— | 1; 0:—/— | 4 | 26 | 1 | jewl | — | +3-8 to Life<br>RAW: `hp(_;3;8)` | 0 /0 /0 |
| 353 | of Hope | 100 | 45 /— | 37; 0:—/— | 4 | 26 | 0 | jewl | — | +9-20 to Life<br>RAW: `hp(_;9;20)` | 0 /0 /0 |
| 354 | of the Leech | 1 | 6 /— | 4; 0:—/— | 7 | 27 | 1 | weap | orb | 4-5% Life Stolen per Hit<br>RAW: `lifesteal(_;4;5)` | 0 /0 /0 |
| 355 | of the Locust | 1 | 20 /— | 15; 0:—/— | 7 | 27 | 1 | mele | orb | 6-7% Life Stolen per Hit<br>RAW: `lifesteal(_;6;7)` | 0 /0 /0 |
| 356 | of the Lamprey | 100 | 55 /— | 43; 0:—/— | 7 | 27 | 1 | mele | orb | 8-9% Life Stolen per Hit<br>RAW: `lifesteal(_;8;9)` | 0 /0 /0 |
| 357 | of the Leech | 1 | 14 /— | 10; 0:—/— | 4 | 27 | 1 | ring, circ | — | 3-4% Life Stolen per Hit<br>RAW: `lifesteal(_;3;4)` | 0 /0 /0 |
| 358 | of the Locust | 1 | 47 /— | 35; 0:—/— | 4 | 27 | 1 | ring, circ | — | 5-6% Life Stolen per Hit<br>RAW: `lifesteal(_;5;6)` | 0 /0 /0 |
| 359 | of the Lamprey | 100 | 77 /— | 65; 0:—/— | 4 | 27 | 1 | ring, circ | — | 7-8% Life Stolen per Hit<br>RAW: `lifesteal(_;7;8)` | 0 /0 /0 |
| 360 | of the Leech | 1 | 34 /— | 26; 0:—/— | 4 | 27 | 1 | glov | — | 3% Life Stolen per Hit<br>RAW: `lifesteal(_;3;3)` | 0 /0 /0 |
| 361 | of the Bat | 1 | 7 /— | 4; 0:—/— | 7 | 28 | 1 | weap | orb | 4-5% Mana Stolen per Hit<br>RAW: `manasteal(_;4;5)` | 0 /0 /0 |
| 362 | of the Wraith | 1 | 21 /— | 16; 0:—/— | 7 | 28 | 1 | mele | — | 6-7% Mana Stolen per Hit<br>RAW: `manasteal(_;6;7)` | 0 /0 /0 |
| 363 | of the Vampire | 100 | 56 /— | 48; 0:—/— | 7 | 28 | 1 | mele | — | 8-9% Mana Stolen per Hit<br>RAW: `manasteal(_;8;9)` | 0 /0 /0 |
| 364 | of the Bat | 1 | 15 /— | 11; 0:—/— | 4 | 28 | 1 | amul, circ | — | 3-4% Mana Stolen per Hit<br>RAW: `manasteal(_;3;4)` | 0 /0 /0 |
| 365 | of the Wraith | 1 | 58 /— | 40; 0:—/— | 4 | 28 | 1 | amul, circ | — | 5-6% Mana Stolen per Hit<br>RAW: `manasteal(_;5;6)` | 0 /0 /0 |
| 366 | of the Vampire | 100 | 78 /— | 66; 0:—/— | 4 | 28 | 1 | amul, circ | — | 7-8% Mana Stolen per Hit<br>RAW: `manasteal(_;7;8)` | 0 /0 /0 |
| 367 | of the Bat | 1 | 35 /— | 27; 0:—/— | 4 | 28 | 1 | glov | — | 3% Mana Stolen per Hit<br>RAW: `manasteal(_;3;3)` | 0 /0 /0 |
| 368 | of Defiance | 1 | 25 /— | 18; 0:—/— | 2 | 29 | 1 | tors, shld, amul, circ | — | Poison Length Reduced by 75%<br>RAW: `res-pois-len(_;75;75)` | 0 /0 /0 |
| 369 | of Amelioration | 1 | 18 /— | 13; 0:—/— | 3 | 29 | 1 | tors, shld, amul, circ | — | Poison Length Reduced by 50%<br>RAW: `res-pois-len(_;50;50)` | 0 /0 /0 |
| 370 | of Remedy | 100 | 7 /— | 5; 0:—/— | 3 | 29 | 1 | armo, ring, amul, circ | — | Poison Length Reduced by 25%<br>RAW: `res-pois-len(_;25;25)` | 0 /0 /0 |
| 371 | of Simplicity | 1 | 25 /— | 18; 0:—/— | 2 | 30 | 1 | tors, weap, shld | rod, orb | Requirements -30%<br>RAW: `ease(_;-30;-30)` | 0 /0 /0 |
| 372 | of Ease | 1 | 15 /— | 11; 0:—/— | 3 | 30 | 1 | tors, weap, shld | rod, orb | Requirements -20%<br>RAW: `ease(_;-20;-20)` | 0 /0 /0 |
| 373 | of Freedom | 100 | 1 /— | 1; 0:—/— | 3 | 30 | 1 | jewl | — | Requirements -15%<br>RAW: `ease(_;-15;-15)` | 0 /0 /0 |
| 374 | of Strength | 1 | 1 /— | 1; 0:—/— | 4 | 31 | 1 | amul, belt, club, hamm, circ | — | +1-2 to Strength<br>RAW: `str(_;1;2)` | 0 /0 /0 |
| 375 | of Might | 1 | 10 /— | 8; 0:—/— | 3 | 31 | 1 | amul, belt, club, hamm, circ | — | +3-5 to Strength<br>RAW: `str(_;3;5)` | 0 /0 /0 |
| 376 | of the Ox | 1 | 26 /— | 19; 0:—/— | 3 | 31 | 1 | amul, belt, club, hamm, circ | — | +6-9 to Strength<br>RAW: `str(_;6;9)` | 0 /0 /0 |
| 377 | of the Giant | 1 | 42 /— | 34; 0:—/— | 3 | 31 | 1 | amul, belt, club, hamm, circ | — | +10-15 to Strength<br>RAW: `str(_;10;15)` | 0 /0 /0 |
| 378 | of the Titan | 1 | 58 /— | 50; 0:—/— | 3 | 31 | 1 | amul, belt, club, hamm, circ | — | +16-20 to Strength<br>RAW: `str(_;16;20)` | 0 /0 /0 |
| 379 | of Atlus | 100 | 71 /— | 63; 0:—/— | 3 | 31 | 1 | amul, belt, club, hamm, circ | — | +21-30 to Strength<br>RAW: `str(_;21;30)` | 0 /0 /0 |
| 380 | of Strength | 1 | 5 /— | 3; 0:—/— | 4 | 31 | 1 | ring, scep, mace, tors | — | +1-2 to Strength<br>RAW: `str(_;1;2)` | 0 /0 /0 |
| 381 | of Might | 1 | 21 /— | 15; 0:—/— | 3 | 31 | 1 | ring, scep, mace, tors | — | +3-5 to Strength<br>RAW: `str(_;3;5)` | 0 /0 /0 |
| 382 | of the Ox | 1 | 38 /— | 30; 0:—/— | 3 | 31 | 1 | ring, scep, mace, tors | — | +6-9 to Strength<br>RAW: `str(_;6;9)` | 0 /0 /0 |
| 383 | of the Giant | 1 | 55 /— | 47; 0:—/— | 3 | 31 | 1 | ring, scep, mace, tors | — | +10-15 to Strength<br>RAW: `str(_;10;15)` | 0 /0 /0 |
| 384 | of the Titan | 100 | 74 /— | 66; 0:—/— | 3 | 31 | 1 | ring, scep, mace, tors | — | +16-20 to Strength<br>RAW: `str(_;16;20)` | 0 /0 /0 |
| 385 | of Strength | 1 | 12 /— | 8; 0:—/— | 3 | 31 | 1 | mele, glov, shld | blun | +1-2 to Strength<br>RAW: `str(_;1;2)` | 0 /0 /0 |
| 386 | of Might | 1 | 33 /— | 25; 0:—/— | 3 | 31 | 1 | mele, glov, shld | blun | +3-5 to Strength<br>RAW: `str(_;3;5)` | 0 /0 /0 |
| 387 | of the Ox | 1 | 45 /— | 37; 0:—/— | 3 | 31 | 1 | mele, glov, shld | blun | +6-9 to Strength<br>RAW: `str(_;6;9)` | 0 /0 /0 |
| 388 | of the Giant | 100 | 59 /— | 51; 0:—/— | 3 | 31 | 1 | mele, glov | blun | +10-15 to Strength<br>RAW: `str(_;10;15)` | 0 /0 /0 |
| 389 | of Strength | 100 | 1 /— | 1; 0:—/— | 4 | 31 | 1 | lcha | — | +3-4 to Strength<br>RAW: `str(_;3;4)` | 0 /0 /0 |
| 390 | of Strength | 100 | 3 /— | 2; 0:—/— | 4 | 31 | 1 | mcha | — | +2-3 to Strength<br>RAW: `str(_;2;3)` | 0 /0 /0 |
| 391 | of Strength | 100 | 7 /— | 5; 0:—/— | 4 | 31 | 1 | scha | — | +1 to Strength<br>RAW: `str(_;1;1)` | 0 /0 /0 |
| 392 | of Strength | 100 | 14 /— | 10; 0:—/— | 4 | 31 | 1 | lcha | — | +5-6 to Strength<br>RAW: `str(_;5;6)` | 0 /0 /0 |
| 393 | of Strength | 100 | 18 /— | 13; 0:—/— | 4 | 31 | 1 | mcha | — | +4-5 to Strength<br>RAW: `str(_;4;5)` | 0 /0 /0 |
| 394 | of Strength | 100 | 22 /— | 16; 0:—/— | 4 | 31 | 1 | scha | — | +2 to Strength<br>RAW: `str(_;2;2)` | 0 /0 /0 |
| 395 | of Virility | 100 | 18 /— | 13; 0:—/— | 4 | 31 | 1 | jewl | — | +1-4 to Strength<br>RAW: `str(_;1;4)` | 0 /0 /0 |
| 396 | of Pacing | 1 | 12 /— | 8; 0:—/— | 3 | 35 | 1 | boot, circ | — | +10% Faster Run/Walk<br>RAW: `move1(_;10;10)` | 0 /0 /0 |
| 397 | of Haste | 1 | 22 /— | 16; 0:—/— | 4 | 35 | 1 | boot, circ | — | +20% Faster Run/Walk<br>RAW: `move2(_;20;20)` | 0 /0 /0 |
| 398 | of Speed | 1 | 37 /— | 29; 0:—/— | 4 | 35 | 1 | boot, circ | — | +30% Faster Run/Walk<br>RAW: `move3(_;30;30)` | 0 /0 /0 |
| 399 | of Traveling | 100 | 65 /— | 57; 0:—/— | 4 | 35 | 0 | boot | — | +30% Faster Run/Walk; 80-90% Slower Stamina Drain<br>RAW: `move3(_;30;30); stamdrain(_;80;90)` | 0 /0 /0 |
| 400 | of Acceleration | 100 | 51 /— | 43; 0:—/— | 4 | 35 | 0 | boot | — | +40% Faster Run/Walk<br>RAW: `move3(_;40;40)` | 0 /0 /0 |
| 401 | of Inertia | 100 | 19 /— | 14; 0:—/— | 4 | 35 | 1 | lcha | — | +7% Faster Run/Walk<br>RAW: `move3(_;7;7)` | 0 /0 /0 |
| 402 | of Inertia | 100 | 24 /— | 18; 0:—/— | 4 | 35 | 1 | mcha | — | +5% Faster Run/Walk<br>RAW: `move2(_;5;5)` | 0 /0 /0 |
| 403 | of Inertia | 100 | 35 /— | 27; 0:—/— | 4 | 35 | 0 | scha | — | +3% Faster Run/Walk<br>RAW: `move1(_;3;3)` | 0 /0 /0 |
| 404 | of Self-Repair | 100 | 3 /— | 1; 0:—/— | 3 | 37 | 1 | weap, armo | thro, miss | Repairs 1 Durability every 33.3333s (rate 3)<br>RAW: `rep-dur(3;_;_)` | 0 /0 /0 |
| 405 | of Fast Repair | 100 | 20 /— | 12; 0:—/— | 2 | 37 | 1 | weap, armo | thro, miss | Repairs 1 Durability every 20s (rate 5)<br>RAW: `rep-dur(5;_;_)` | 0 /0 /0 |
| 406 | of Ages | 100 | 50 /— | 42; 0:—/— | 1 | 39 | 0 | weap, armo | thro, miss | Indestructible<br>RAW: `indestruct(_;_;_)` | 0 /0 /0 |
| 407 | of Replenishing | 100 | 5 /— | 3; 0:—/— | 6 | 39 | 1 | thro | — | Replenishes 1 Quantity every 20s (rate 5)<br>RAW: `rep-quant(5;_;_)` | 0 /0 /0 |
| 408 | of Propogation | 100 | 24 /— | 18; 0:—/— | 5 | 39 | 1 | thro | — | Replenishes 1 Quantity every 10s (rate 10)<br>RAW: `rep-quant(10;_;_)` | 0 /0 /0 |
| 409 | of the Kraken | 100 | 20 /— | 1; 0:—/— | 1 | 41 | 0 | tors, amul, pelt, phlm | — | +0.75 Life per clvl (floor after scaling)<br>RAW: `hp/lvl(6;_;_)` | 0 /0 /0 |
| 410 | of Memory | 100 | 20 /— | 1; 0:—/— | 1 | 41 | 0 | circ, amul, pelt | — | +0.75 Mana per clvl (floor after scaling)<br>RAW: `mana/lvl(6;_;_)` | 0 /0 /0 |
| 411 | of the Elephant | 100 | 37 /— | 7; 0:—/— | 2 | 41 | 0 | circ, pelt | — | +0.5 Life per clvl (floor after scaling); +0.25 Mana per clvl (floor after scaling)<br>RAW: `hp/lvl(4;_;_); mana/lvl(2;_;_)` | 0 /0 /0 |
| 420 | of Firebolts | 100 | 16 /— | 12; 0:—/— | 1 | 44 | 1 | weap | miss | 10% Chance to cast level 8 Fire Bolt on striking<br>RAW: `hit-skill(36;10;8)` | 0 /0 /0 |
| 421 | of Firebolts | 100 | 6 /— | 4; 0:—/— | 1 | 44 | 1 | weap | miss | 5% Chance to cast level 3 Fire Bolt on attack<br>RAW: `att-skill(36;5;3)` | 0 /0 /0 |
| 422 | of Firebolts | 100 | 20 /— | 15; 0:—/— | 1 | 44 | 1 | weap | miss | 10% Chance to cast level 4 Fire Bolt on attack<br>RAW: `att-skill(36;10;4)` | 0 /0 /0 |
| 423 | of Charged Shield | 100 | 6 /— | 4; 0:—/— | 1 | 44 | 1 | armo, ring, amul | — | 10% Chance to cast level 3 Charged Bolt when struck<br>RAW: `gethit-skill(38;10;3)` | 0 /0 /0 |
| 424 | of Charged Shield | 100 | 16 /— | 12; 0:—/— | 1 | 44 | 1 | armo, ring, amul | — | 12% Chance to cast level 4 Charged Bolt when struck<br>RAW: `gethit-skill(38;12;4)` | 0 /0 /0 |
| 425 | of Charged Shield | 100 | 26 /— | 19; 0:—/— | 1 | 44 | 1 | armo, ring, amul | — | 14% Chance to cast level 5 Charged Bolt when struck<br>RAW: `gethit-skill(38;14;5)` | 0 /0 /0 |
| 426 | of Icebolt | 100 | 6 /— | 4; 0:—/— | 1 | 44 | 1 | weap | miss | 5% Chance to cast level 3 Ice Bolt on attack<br>RAW: `att-skill(39;5;3)` | 0 /0 /0 |
| 430 | of Frost Shield | 100 | 12 /— | 9; 0:—/— | 1 | 44 | 1 | armo, amul | — | 5% Chance to cast level 3 Frost Nova when struck<br>RAW: `gethit-skill(44;5;3)` | 0 /0 /0 |
| 434 | of Nova | 100 | 18 /— | 13; 0:—/— | 1 | 44 | 1 | weap | miss | 10% Chance to cast level 3 Nova on striking<br>RAW: `hit-skill(48;10;3)` | 0 /0 /0 |
| 435 | of Nova | 100 | 28 /— | 21; 0:—/— | 1 | 44 | 1 | weap | miss | 12% Chance to cast level 4 Nova on striking<br>RAW: `hit-skill(48;12;4)` | 0 /0 /0 |
| 436 | of Nova Shield | 100 | 18 /— | 13; 0:—/— | 1 | 44 | 1 | armo, ring | — | 10% Chance to cast level 3 Nova when struck<br>RAW: `gethit-skill(48;10;3)` | 0 /0 /0 |
| 437 | of Nova Shield | 100 | 28 /— | 21; 0:—/— | 1 | 44 | 1 | armo, ring | — | 12% Chance to cast level 4 Nova when struck<br>RAW: `gethit-skill(48;12;4)` | 0 /0 /0 |
| 438 | of Nova Shield | 100 | 38 /— | 28; 0:—/— | 1 | 44 | 1 | armo, ring | — | 14% Chance to cast level 5 Nova when struck<br>RAW: `gethit-skill(48;14;5)` | 0 /0 /0 |
| 439 | of Lightning | 100 | 18 /— | 13; 0:—/— | 1 | 44 | 1 | weap | miss | 5% Chance to cast level 3 Lightning on attack<br>RAW: `att-skill(49;5;3)` | 0 /0 /0 |
| 444 | of Chain Lightning | 100 | 25 /— | 18; 0:—/— | 1 | 44 | 1 | weap, ring, amul | miss | 5% Chance to cast level 3 Chain Lightning on attack<br>RAW: `att-skill(53;5;3)` | 0 /0 /0 |
| 445 | of Chain Lightning | 100 | 35 /— | 26; 0:—/— | 1 | 44 | 1 | weap, ring, amul | miss | 8% Chance to cast level 3 Chain Lightning on attack<br>RAW: `att-skill(53;8;3)` | 0 /0 /0 |
| 446 | of Chain Lightning | 100 | 45 /— | 33; 0:—/— | 1 | 44 | 1 | weap, ring, amul | miss | 8% Chance to cast level 5 Chain Lightning on attack<br>RAW: `att-skill(53;8;5)` | 0 /0 /0 |
| 456 | of Hydra Shield | 100 | 40 /— | 30; 0:—/— | 1 | 44 | 1 | amul | — | 10% Chance to cast level 3 Hydra when struck<br>RAW: `gethit-skill(62;10;3)` | 0 /0 /0 |
| 460 | of Magic Arrows | 100 | 12 /— | 11; 0:ama/1 | 1 | 44 | 1 | miss, abow | — | Level -10 Magic Arrow (-30 Charges)<br>RAW: `charged(6;-30;-10)` | 0 /0 /0 |
| 463 | of Fire Arrows | 100 | 40 /— | 32; 0:ama/3 | 1 | 44 | 1 | glov | — | Level -6 Fire Arrow (-20 Charges)<br>RAW: `charged(7;-20;-6)` | 0 /0 /0 |
| 464 | of Inner Sight | 100 | 18 /— | 14; 0:ama/2 | 1 | 44 | 1 | amul, amaz, circ | — | Level -6 Inner Sight (-30 Charges)<br>RAW: `charged(8;-30;-6)` | 0 /0 /0 |
| 465 | of Inner Sight | 100 | 50 /— | 42; 0:ama/5 | 1 | 44 | 1 | glov | — | Level -4 Inner Sight (-20 Charges)<br>RAW: `charged(8;-20;-4)` | 0 /0 /0 |
| 468 | of Cold Arrows | 100 | 15 /— | 16; 0:ama/6 | 1 | 44 | 1 | miss, abow | — | Level -8 Cold Arrow (-30 Charges)<br>RAW: `charged(11;-30;-8)` | 0 /0 /0 |
| 469 | of Cold Arrows | 100 | 47 /— | 39; 0:ama/9 | 1 | 44 | 1 | glov | — | Level -5 Cold Arrow (-20 Charges)<br>RAW: `charged(11;-20;-5)` | 0 /0 /0 |
| 470 | of Multiple Shot | 100 | 18 /— | 19; 0:ama/6 | 1 | 44 | 1 | miss, abow | — | Level -8 Multiple Shot (-30 Charges)<br>RAW: `charged(12;-30;-8)` | 0 /0 /0 |
| 471 | of Multiple Shot | 100 | 63 /— | 55; 0:ama/12 | 1 | 44 | 1 | glov | — | Level -4 Multiple Shot (-20 Charges)<br>RAW: `charged(12;-20;-4)` | 0 /0 /0 |
| 472 | of Power Strike | 100 | 12 /— | 13; 0:ama/6 | 1 | 44 | 1 | spea, aspe | — | Level -6 Power Strike (-60 Charges)<br>RAW: `charged(14;-60;-6)` | 0 /0 /0 |
| 473 | of Power Strike | 100 | 55 /— | 47; 0:ama/9 | 1 | 44 | 1 | glov | — | Level -4 Power Strike (-20 Charges)<br>RAW: `charged(14;-20;-4)` | 0 /0 /0 |
| 476 | of Exploding Arrows | 100 | 30 /— | 26; 0:ama/12 | 1 | 44 | 1 | miss, abow | — | Level -6 Exploding Arrow (-30 Charges)<br>RAW: `charged(16;-30;-6)` | 0 /0 /0 |
| 477 | of Exploding Arrows | 100 | 69 /— | 61; 0:ama/17 | 1 | 44 | 1 | glov | — | Level -4 Exploding Arrow (-20 Charges)<br>RAW: `charged(16;-20;-4)` | 0 /0 /0 |
| 484 | of Ice Arrows | 100 | 36 /— | 28; 0:ama/18 | 1 | 44 | 1 | miss, abow | — | Level -5 Ice Arrow (-30 Charges)<br>RAW: `charged(21;-30;-5)` | 0 /0 /0 |
| 485 | of Ice Arrows | 100 | 72 /— | 64; 0:ama/22 | 1 | 44 | 1 | glov | — | Level -3 Ice Arrow (-20 Charges)<br>RAW: `charged(21;-20;-3)` | 0 /0 /0 |
| 488 | of Charged Strike | 100 | 33 /— | 25; 0:ama/18 | 1 | 44 | 1 | spea, aspe | — | Level -5 Charged Strike (-60 Charges)<br>RAW: `charged(24;-60;-5)` | 0 /0 /0 |
| 489 | of Charged Strike | 100 | 68 /— | 60; 0:ama/21 | 1 | 44 | 1 | glov | — | Level -3 Charged Strike (-20 Charges)<br>RAW: `charged(24;-20;-3)` | 0 /0 /0 |
| 496 | of Freezing Arrows | 100 | 50 /— | 42; 0:ama/30 | 1 | 44 | 1 | miss, abow | — | Level -4 Freezing Arrow (-30 Charges)<br>RAW: `charged(31;-30;-4)` | 0 /0 /0 |
| 497 | of Freezing Arrows | 100 | 94 /— | 86; 0:ama/33 | 1 | 44 | 1 | glov | — | Level -2 Freezing Arrow (-20 Charges)<br>RAW: `charged(31;-20;-2)` | 0 /0 /0 |
| 498 | of Lightning Strike | 100 | 47 /— | 39; 0:ama/30 | 1 | 44 | 1 | spea, aspe | — | Level -4 Lightning Strike (-60 Charges)<br>RAW: `charged(34;-60;-4)` | 0 /0 /0 |
| 499 | of Lightning Strike | 100 | 90 /— | 82; 0:ama/32 | 1 | 44 | 1 | glov | — | Level -2 Lightning Strike (-20 Charges)<br>RAW: `charged(34;-20;-2)` | 0 /0 /0 |
| 502 | of Fire Bolts | 100 | 7 /— | 7; 0:sor/1 | 1 | 44 | 1 | staf, orb | — | Level -10 Fire Bolt (-30 Charges)<br>RAW: `charged(36;-30;-10)` | 0 /0 /0 |
| 503 | of Fire Bolts | 100 | 14 /— | 14; 0:sor/1 | 1 | 44 | 1 | swor, ring, circ | — | Level -6 Fire Bolt (-20 Charges)<br>RAW: `charged(36;-20;-6)` | 0 /0 /0 |
| 504 | of Charged Bolts | 100 | 7 /— | 7; 0:sor/1 | 1 | 44 | 1 | staf, orb | — | Level -10 Charged Bolt (-30 Charges)<br>RAW: `charged(38;-30;-10)` | 0 /0 /0 |
| 505 | of Charged Bolts | 100 | 14 /— | 14; 0:sor/1 | 1 | 44 | 1 | hamm, mace, scep, ring, circ | — | Level -6 Charged Bolt (-20 Charges)<br>RAW: `charged(38;-20;-6)` | 0 /0 /0 |
| 506 | of Ice Bolts | 100 | 7 /— | 7; 0:sor/1 | 1 | 44 | 1 | staf, orb | — | Level -10 Ice Bolt (-30 Charges)<br>RAW: `charged(39;-30;-10)` | 0 /0 /0 |
| 507 | of Ice Bolts | 100 | 14 /— | 14; 0:sor/1 | 1 | 44 | 1 | knif | — | Level -6 Ice Bolt (-20 Charges)<br>RAW: `charged(39;-20;-6)` | 0 /0 /0 |
| 512 | of Telekinesis | 100 | 12 /— | 12; 0:sor/6 | 1 | 44 | 1 | staf, orb | — | Level -8 Telekinesis (-30 Charges)<br>RAW: `charged(43;-30;-8)` | 0 /0 /0 |
| 513 | of Telekinesis | 100 | 24 /— | 24; 0:sor/6 | 1 | 44 | 1 | hamm, mace, scep, ring, circ | — | Level -5 Telekinesis (-20 Charges)<br>RAW: `charged(43;-20;-5)` | 0 /0 /0 |
| 514 | of Frost Novas | 100 | 12 /— | 12; 0:sor/6 | 1 | 44 | 1 | staf, orb | — | Level -8 Frost Nova (-30 Charges)<br>RAW: `charged(44;-30;-8)` | 0 /0 /0 |
| 515 | of Frost Novas | 100 | 24 /— | 24; 0:sor/6 | 1 | 44 | 1 | knif, amul, circ | — | Level -5 Frost Nova (-20 Charges)<br>RAW: `charged(44;-20;-5)` | 0 /0 /0 |
| 516 | of Ice Blasts | 100 | 12 /— | 12; 0:sor/6 | 1 | 44 | 1 | staf, orb | — | Level -8 Ice Blast (-30 Charges)<br>RAW: `charged(45;-30;-8)` | 0 /0 /0 |
| 517 | of Ice Blasts | 100 | 24 /— | 24; 0:sor/6 | 1 | 44 | 1 | hamm, mace, scep, ring, circ | — | Level -5 Ice Blast (-20 Charges)<br>RAW: `charged(45;-20;-5)` | 0 /0 /0 |
| 520 | of Fire Balls | 100 | 18 /— | 18; 0:sor/12 | 1 | 44 | 1 | staf, orb | — | Level -7 Fire Ball (-30 Charges)<br>RAW: `charged(47;-30;-7)` | 0 /0 /0 |
| 521 | of Fire Balls | 100 | 36 /— | 36; 0:sor/12 | 1 | 44 | 1 | spea, wand | — | Level -4 Fire Ball (-20 Charges)<br>RAW: `charged(47;-20;-4)` | 0 /0 /0 |
| 522 | of Novas | 100 | 18 /— | 18; 0:sor/12 | 1 | 44 | 1 | staf, orb | — | Level -7 Nova (-30 Charges)<br>RAW: `charged(48;-30;-7)` | 0 /0 /0 |
| 523 | of Novas | 100 | 36 /— | 36; 0:sor/12 | 1 | 44 | 1 | shld | — | Level -4 Nova (-20 Charges)<br>RAW: `charged(48;-20;-4)` | 0 /0 /0 |
| 524 | of Lightning | 100 | 18 /— | 18; 0:sor/12 | 1 | 44 | 1 | staf, orb | — | Level -7 Lightning (-30 Charges)<br>RAW: `charged(49;-30;-7)` | 0 /0 /0 |
| 525 | of Lightning | 100 | 36 /— | 36; 0:sor/12 | 1 | 44 | 1 | axe, hamm | — | Level -4 Lightning (-20 Charges)<br>RAW: `charged(49;-20;-4)` | 0 /0 /0 |
| 530 | of Enchantment | 100 | 24 /— | 24; 0:sor/18 | 1 | 44 | 1 | staf, orb | — | Level -3 Enchant (-20 Charges)<br>RAW: `charged(52;-20;-3)` | 0 /0 /0 |
| 531 | of Enchantment | 100 | 48 /— | 48; 0:sor/18 | 1 | 44 | 1 | mele | — | Level -1 Enchant (-10 Charges)<br>RAW: `charged(52;-10;-1)` | 0 /0 /0 |
| 532 | of Chain Lightning | 100 | 24 /— | 24; 0:sor/18 | 1 | 44 | 1 | staf, orb | — | Level -6 Chain Lightning (-30 Charges)<br>RAW: `charged(53;-30;-6)` | 0 /0 /0 |
| 533 | of Chain Lightning | 100 | 48 /— | 48; 0:sor/18 | 1 | 44 | 1 | spea | — | Level -3 Chain Lightning (-20 Charges)<br>RAW: `charged(53;-20;-3)` | 0 /0 /0 |
| 534 | of Teleportation | 100 | 24 /— | 24; 0:sor/18 | 1 | 44 | 1 | staf, orb | — | Level -6 Teleport (-30 Charges)<br>RAW: `charged(54;-30;-6)` | 0 /0 /0 |
| 535 | of Teleportation | 100 | 48 /— | 48; 0:sor/18 | 1 | 44 | 1 | amul, circ | — | Level -3 Teleport (-20 Charges)<br>RAW: `charged(54;-20;-3)` | 0 /0 /0 |
| 536 | of Glacial Spikes | 100 | 24 /— | 24; 0:sor/18 | 1 | 44 | 1 | staf, orb | — | Level -6 Glacial Spike (-30 Charges)<br>RAW: `charged(55;-30;-6)` | 0 /0 /0 |
| 537 | of Glacial Spikes | 100 | 48 /— | 48; 0:sor/18 | 1 | 44 | 1 | knif | — | Level -3 Glacial Spike (-20 Charges)<br>RAW: `charged(55;-20;-3)` | 0 /0 /0 |
| 538 | of Meteors | 100 | 30 /— | 30; 0:sor/24 | 1 | 44 | 1 | staf, orb | — | Level -5 Meteor (-30 Charges)<br>RAW: `charged(56;-30;-5)` | 0 /0 /0 |
| 539 | of Meteors | 100 | 60 /— | 60; 0:sor/24 | 1 | 44 | 1 | knif, club | — | Level -2 Meteor (-20 Charges)<br>RAW: `charged(56;-20;-2)` | 0 /0 /0 |
| 544 | of Blizzards | 100 | 30 /— | 30; 0:sor/24 | 1 | 44 | 1 | staf, orb | — | Level -5 Blizzard (-30 Charges)<br>RAW: `charged(59;-30;-5)` | 0 /0 /0 |
| 545 | of Blizzards | 100 | 60 /— | 60; 0:sor/24 | 1 | 44 | 1 | knif | — | Level -2 Blizzard (-20 Charges)<br>RAW: `charged(59;-20;-2)` | 0 /0 /0 |
| 550 | of Frozen Orbs | 100 | 36 /— | 36; 0:sor/30 | 1 | 44 | 1 | staf, orb | — | Level -3 Frozen Orb (-30 Charges)<br>RAW: `charged(64;-30;-3)` | 0 /0 /0 |
| 551 | of Frozen Orbs | 100 | 72 /— | 72; 0:sor/30 | 1 | 44 | 1 | knif | — | Level -1 Frozen Orb (-20 Charges)<br>RAW: `charged(64;-20;-1)` | 0 /0 /0 |
| 554 | of Teeth | 100 | 7 /— | 7; 0:nec/1 | 1 | 44 | 1 | wand, knif, head | — | Level -10 Teeth (-60 Charges)<br>RAW: `charged(67;-60;-10)` | 0 /0 /0 |
| 555 | of Teeth | 100 | 14 /— | 14; 0:nec/1 | 1 | 44 | 1 | swor | — | Level -6 Teeth (-20 Charges)<br>RAW: `charged(67;-20;-6)` | 0 /0 /0 |
| 560 | of Dim Vision | 100 | 12 /— | 12; 0:nec/6 | 1 | 44 | 1 | wand, knif, head | — | Level -8 Dim Vision (-60 Charges)<br>RAW: `charged(71;-60;-8)` | 0 /0 /0 |
| 561 | of Dim Vision | 100 | 24 /— | 24; 0:nec/6 | 1 | 44 | 1 | ring, circ | — | Level -5 Dim Vision (-20 Charges)<br>RAW: `charged(71;-20;-5)` | 0 /0 /0 |
| 562 | of Weaken | 100 | 12 /— | 12; 0:nec/6 | 1 | 44 | 1 | wand, knif, head | — | Level -8 Weaken (-60 Charges)<br>RAW: `charged(72;-60;-8)` | 0 /0 /0 |
| 563 | of Weaken | 100 | 24 /— | 24; 0:nec/6 | 1 | 44 | 1 | glov | — | Level -5 Weaken (-20 Charges)<br>RAW: `charged(72;-20;-5)` | 0 /0 /0 |
| 564 | of Poison Dagger | 100 | 12 /— | 12; 0:nec/6 | 1 | 44 | 1 | knif, head | — | Level -8 Poison Dagger (-60 Charges)<br>RAW: `charged(73;-60;-8)` | 0 /0 /0 |
| 565 | of Poison Dagger | 100 | 24 /— | 24; 0:nec/6 | 1 | 44 | 1 | glov, ring, circ | — | Level -5 Poison Dagger (-20 Charges)<br>RAW: `charged(73;-20;-5)` | 0 /0 /0 |
| 572 | of Terror | 100 | 18 /— | 18; 0:nec/12 | 1 | 44 | 1 | wand, knif, head | — | Level -7 Terror (-60 Charges)<br>RAW: `charged(77;-60;-7)` | 0 /0 /0 |
| 573 | of Terror | 100 | 36 /— | 36; 0:nec/12 | 1 | 44 | 1 | shld | — | Level -4 Terror (-20 Charges)<br>RAW: `charged(77;-20;-4)` | 0 /0 /0 |
| 578 | of Confusion | 100 | 24 /— | 24; 0:nec/18 | 1 | 44 | 1 | wand, knif, head | — | Level -6 Confuse (-60 Charges)<br>RAW: `charged(81;-60;-6)` | 0 /0 /0 |
| 579 | of Confusion | 100 | 48 /— | 48; 0:nec/18 | 1 | 44 | 1 | ring, circ | — | Level -3 Confuse (-20 Charges)<br>RAW: `charged(81;-20;-3)` | 0 /0 /0 |
| 580 | of Life Tap | 100 | 24 /— | 24; 0:nec/18 | 1 | 44 | 1 | wand, knif, head | — | Level -6 Life Tap (-60 Charges)<br>RAW: `charged(82;-60;-6)` | 0 /0 /0 |
| 581 | of Life Tap | 100 | 48 /— | 48; 0:nec/18 | 1 | 44 | 1 | axe | — | Level -3 Life Tap (-20 Charges)<br>RAW: `charged(82;-20;-3)` | 0 /0 /0 |
| 584 | of Bone Spears | 100 | 24 /— | 24; 0:nec/18 | 1 | 44 | 1 | wand, knif, head | — | Level -6 Bone Spear (-60 Charges)<br>RAW: `charged(84;-60;-6)` | 0 /0 /0 |
| 585 | of Bone Spears | 100 | 48 /— | 48; 0:nec/18 | 1 | 44 | 1 | spea | — | Level -3 Bone Spear (-20 Charges)<br>RAW: `charged(84;-20;-3)` | 0 /0 /0 |
| 588 | of Attraction | 100 | 30 /— | 30; 0:nec/24 | 1 | 44 | 1 | wand, knif, head | — | Level -5 Attract (-60 Charges)<br>RAW: `charged(86;-60;-5)` | 0 /0 /0 |
| 589 | of Attraction | 100 | 60 /— | 60; 0:nec/24 | 1 | 44 | 1 | ring, amul, circ | — | Level -2 Attract (-20 Charges)<br>RAW: `charged(86;-20;-2)` | 0 /0 /0 |
| 596 | of Lower Resistance | 100 | 36 /— | 36; 0:nec/30 | 1 | 44 | 1 | wand, knif, head | — | Level -3 Lower Resist (-60 Charges)<br>RAW: `charged(91;-60;-3)` | 0 /0 /0 |
| 597 | of Lower Resistance | 100 | 72 /— | 72; 0:nec/30 | 1 | 44 | 1 | staf | — | Level -1 Lower Resist (-20 Charges)<br>RAW: `charged(91;-20;-1)` | 0 /0 /0 |
| 598 | of Poison Novas | 100 | 36 /— | 36; 0:nec/30 | 1 | 44 | 1 | wand, knif, head | — | Level -3 Poison Nova (-60 Charges)<br>RAW: `charged(92;-60;-3)` | 0 /0 /0 |
| 599 | of Poison Novas | 100 | 72 /— | 72; 0:nec/30 | 1 | 44 | 1 | glov | — | Level -1 Poison Nova (-20 Charges)<br>RAW: `charged(92;-20;-1)` | 0 /0 /0 |
| 600 | of Bone Spirits | 100 | 36 /— | 36; 0:nec/30 | 1 | 44 | 1 | wand, knif, head | — | Level -3 Bone Spirit (-60 Charges)<br>RAW: `charged(93;-60;-3)` | 0 /0 /0 |
| 601 | of Bone Spirits | 100 | 72 /— | 72; 0:nec/30 | 1 | 44 | 1 | amul, circ | — | Level -1 Bone Spirit (-20 Charges)<br>RAW: `charged(93;-20;-1)` | 0 /0 /0 |
| 606 | of Sacrifice | 100 | 7 /— | 7; 0:pal/1 | 1 | 44 | 1 | scep, ashd | — | Level -10 Sacrifice (-30 Charges)<br>RAW: `charged(96;-30;-10)` | 0 /0 /0 |
| 607 | of Sacrifice | 100 | 14 /— | 14; 0:pal/1 | 1 | 44 | 1 | mele | scep | Level -6 Sacrifice (-20 Charges)<br>RAW: `charged(96;-20;-6)` | 0 /0 /0 |
| 608 | of Holy Bolts | 100 | 12 /— | 12; 0:pal/6 | 1 | 44 | 1 | scep, ashd | — | Level -8 Holy Bolt (-30 Charges)<br>RAW: `charged(101;-30;-8)` | 0 /0 /0 |
| 609 | of Holy Bolts | 100 | 24 /— | 24; 0:pal/6 | 1 | 44 | 1 | amul, circ | — | Level -5 Holy Bolt (-20 Charges)<br>RAW: `charged(101;-20;-5)` | 0 /0 /0 |
| 610 | of Zeal | 100 | 18 /— | 18; 0:pal/12 | 1 | 44 | 1 | scep, ashd | — | Level -7 Zeal (-30 Charges)<br>RAW: `charged(106;-30;-7)` | 0 /0 /0 |
| 611 | of Zeal | 100 | 36 /— | 36; 0:pal/12 | 1 | 44 | 1 | mele | scep | Level -4 Zeal (-20 Charges)<br>RAW: `charged(106;-20;-4)` | 0 /0 /0 |
| 612 | of Vengeance | 100 | 24 /— | 24; 0:pal/18 | 1 | 44 | 1 | scep, ashd | — | Level -6 Vengeance (-30 Charges)<br>RAW: `charged(111;-30;-6)` | 0 /0 /0 |
| 613 | of Vengeance | 100 | 48 /— | 48; 0:pal/18 | 1 | 44 | 1 | swor, axe | — | Level -3 Vengeance (-20 Charges)<br>RAW: `charged(111;-20;-3)` | 0 /0 /0 |
| 614 | of Blessed Hammers | 100 | 24 /— | 24; 0:pal/18 | 1 | 44 | 1 | scep, ashd | — | Level -6 Blessed Hammer (-30 Charges)<br>RAW: `charged(112;-30;-6)` | 0 /0 /0 |
| 615 | of Blessed Hammers | 100 | 48 /— | 48; 0:pal/18 | 1 | 44 | 1 | hamm | — | Level -3 Blessed Hammer (-20 Charges)<br>RAW: `charged(112;-20;-3)` | 0 /0 /0 |
| 620 | of Bashing | 100 | 7 /— | 7; 0:bar/1 | 1 | 44 | 1 | phlm | — | Level -10 Bash (-60 Charges)<br>RAW: `charged(126;-60;-10)` | 0 /0 /0 |
| 621 | of Bashing | 100 | 14 /— | 14; 0:bar/1 | 1 | 44 | 1 | mele | staf, wand, orb | Level -6 Bash (-20 Charges)<br>RAW: `charged(126;-20;-6)` | 0 /0 /0 |
| 630 | of Stunning | 100 | 18 /— | 18; 0:bar/12 | 1 | 44 | 1 | phlm | staf, wand, orb | Level -7 Stun (-60 Charges)<br>RAW: `charged(139;-60;-7)` | 0 /0 /0 |
| 631 | of Stunning | 100 | 36 /— | 36; 0:bar/12 | 1 | 44 | 1 | mele | — | Level -4 Stun (-20 Charges)<br>RAW: `charged(139;-20;-4)` | 0 /0 /0 |
| 634 | of Concentration | 100 | 24 /— | 24; 0:bar/18 | 1 | 44 | 1 | phlm | — | Level -6 Concentrate (-60 Charges)<br>RAW: `charged(144;-60;-6)` | 0 /0 /0 |
| 635 | of Concentration | 100 | 48 /— | 48; 0:bar/18 | 1 | 44 | 1 | mele | staf, wand, orb | Level -3 Concentrate (-20 Charges)<br>RAW: `charged(144;-20;-3)` | 0 /0 /0 |
| 640 | of Grim Ward | 100 | 30 /— | 30; 0:bar/24 | 1 | 44 | 1 | phlm | — | Level -5 Grim Ward (-60 Charges)<br>RAW: `charged(150;-60;-5)` | 0 /0 /0 |
| 641 | of Grim Ward | 100 | 60 /— | 60; 0:bar/24 | 1 | 44 | 1 | amul | — | Level -2 Grim Ward (-20 Charges)<br>RAW: `charged(150;-20;-2)` | 0 /0 /0 |
| 646 | of Firestorms | 100 | 7 /— | 7; 0:dru/1 | 1 | 44 | 1 | club | — | Level -10 Firestorm (-30 Charges)<br>RAW: `charged(225;-30;-10)` | 0 /0 /0 |
| 647 | of Firestorms | 100 | 14 /— | 14; 0:dru/1 | 1 | 44 | 1 | staf | — | Level -6 Firestorm (-20 Charges)<br>RAW: `charged(225;-20;-6)` | 0 /0 /0 |
| 650 | of Eruption | 100 | 18 /— | 18; 0:dru/12 | 1 | 44 | 1 | club | — | Level -7 Eruption (-30 Charges)<br>RAW: `charged(234;-30;-7)` | 0 /0 /0 |
| 651 | of Eruption | 100 | 36 /— | 36; 0:dru/12 | 1 | 44 | 1 | staf | — | Level -4 Eruption (-20 Charges)<br>RAW: `charged(234;-20;-4)` | 0 /0 /0 |
| 654 | of Twister | 100 | 24 /— | 24; 0:dru/18 | 1 | 44 | 1 | club | — | Level -6 Twister (-30 Charges)<br>RAW: `charged(240;-30;-6)` | 0 /0 /0 |
| 655 | of Twister | 100 | 48 /— | 48; 0:dru/18 | 1 | 44 | 1 | amul, circ | — | Level -3 Twister (-20 Charges)<br>RAW: `charged(240;-20;-3)` | 0 /0 /0 |
| 656 | of Volcano | 100 | 30 /— | 30; 0:dru/24 | 1 | 44 | 1 | club | — | Level -6 Volcano (-30 Charges)<br>RAW: `charged(244;-30;-6)` | 0 /0 /0 |
| 657 | of Volcano | 100 | 60 /— | 60; 0:dru/24 | 1 | 44 | 1 | hamm | — | Level -3 Volcano (-20 Charges)<br>RAW: `charged(244;-20;-3)` | 0 /0 /0 |
| 658 | of Tornado | 100 | 30 /— | 30; 0:dru/24 | 1 | 44 | 1 | club | — | Level -5 Tornado (-30 Charges)<br>RAW: `charged(245;-30;-5)` | 0 /0 /0 |
| 659 | of Tornado | 100 | 60 /— | 60; 0:dru/24 | 1 | 44 | 1 | amul, circ | — | Level -2 Tornado (-20 Charges)<br>RAW: `charged(245;-20;-2)` | 0 /0 /0 |
| 664 | of Damage Amplification | 100 | 3 /— | ; 0:—/— | 1 | 44 | 1 | weap | orb | 5% Chance to cast level 1 Amplify Damage on striking<br>RAW: `hit-skill(66;5;1)` | 0 /0 /0 |
| 665 | of the Icicle | 100 | 37 /— | 29; 0:—/— | 2 | 10 | 1 | jewl | — | +2-3 min cold dmg; +6-10 max cold dmg; (cold length 50 frames)<br>RAW: `cold-min(_;2;3); cold-max(_;6;10); cold-len(_;50;50)` | 0 /0 /0 |
| 666 | of the Glacier | 100 | 58 /— | 50; 0:—/— | 2 | 10 | 0 | jewl | — | +4-5 min cold dmg; +11-15 max cold dmg; (cold length 50 frames)<br>RAW: `cold-min(_;4;5); cold-max(_;11;15); cold-len(_;50;50)` | 0 /0 /0 |
| 667 | of Fire | 100 | 36 /— | 28; 0:—/— | 2 | 12 | 1 | jewl | — | +4-10 min fire dmg; +11-30 max fire dmg<br>RAW: `fire-min(_;4;10); fire-max(_;11;30)` | 0 /0 /0 |
| 668 | of Burning | 100 | 57 /— | 49; 0:—/— | 2 | 12 | 1 | jewl | — | +11-25 min fire dmg; +31-50 max fire dmg<br>RAW: `fire-min(_;11;25); fire-max(_;31;50)` | 0 /0 /0 |
| 669 | of Lightning | 100 | 36 /— | 28; 0:—/— | 2 | 13 | 1 | jewl | — | +1 min ltng dmg; +21-60 max ltng dmg<br>RAW: `ltng-min(_;1;1); ltng-max(_;21;60)` | 0 /0 /0 |
| 670 | of Thunder | 100 | 57 /— | 49; 0:—/— | 2 | 13 | 1 | jewl | — | +1 min ltng dmg; +61-100 max ltng dmg<br>RAW: `ltng-min(_;1;1); ltng-max(_;61;100)` | 0 /0 /0 |
| 671 | of Daring | 100 | 19 /— | 14; 0:—/— | 3 | 17 | 1 | jewl | — | +4-6 to Dexterity<br>RAW: `dex(_;4;6)` | 0 /0 /0 |
| 672 | of Daring | 100 | 36 /— | 28; 0:—/— | 3 | 17 | 1 | jewl | — | +7-9 to Dexterity<br>RAW: `dex(_;7;9)` | 0 /0 /0 |
| 673 | of Knowledge | 100 | 24 /— | 18; 0:—/— | 3 | 23 | 1 | jewl | — | +4-6 to Energy<br>RAW: `enr(_;4;6)` | 0 /0 /0 |
| 674 | of Knowledge | 100 | 41 /— | 33; 0:—/— | 3 | 23 | 1 | jewl | — | +7-9 to Energy<br>RAW: `enr(_;7;9)` | 0 /0 /0 |
| 675 | of Virility | 100 | 33 /— | 25; 0:—/— | 4 | 31 | 1 | jewl | — | +5-6 to Strength<br>RAW: `str(_;5;6)` | 0 /0 /0 |
| 676 | of Virility | 100 | 50 /— | 42; 0:—/— | 4 | 31 | 1 | jewl | — | +7-9 to Strength<br>RAW: `str(_;7;9)` | 0 /0 /0 |
| 677 | of Readiness | 1 | 20 /— | 15; 0:—/— | 2 | 7 | 1 | glov | — | +10% Increased Attack Speed<br>RAW: `swing1(_;10;10)` | 0 /0 /0 |
| 678 | of Craftsmanship | 100 | 1 /— | 1; 0:—/— | 4 | 14 | 1 | lcha | — | +1 to Maximum Damage<br>RAW: `dmg-max(_;1;1)` | 0 /0 /0 |
| 679 | of Quality | 100 | 41 /— | 33; 0:—/— | 4 | 14 | 1 | lcha | — | +2 to Maximum Damage<br>RAW: `dmg-max(_;2;2)` | 0 /0 /0 |
| 680 | of Maiming | 100 | 71 /— | 63; 0:—/— | 4 | 14 | 0 | lcha | — | +3-4 to Maximum Damage<br>RAW: `dmg-max(_;3;4)` | 0 /0 /0 |
| 681 | of Craftsmanship | 100 | 26 /— | 19; 0:—/— | 4 | 14 | 1 | mcha | — | +1 to Maximum Damage<br>RAW: `dmg-max(_;1;1)` | 0 /0 /0 |
| 682 | of Quality | 100 | 56 /— | 48; 0:—/— | 4 | 14 | 0 | mcha | — | +2 to Maximum Damage<br>RAW: `dmg-max(_;2;2)` | 0 /0 /0 |
| 683 | of Craftsmanship | 100 | 85 /— | 77; 0:—/— | 4 | 14 | 1 | scha | — | +1 to Maximum Damage<br>RAW: `dmg-max(_;1;1)` | 0 /0 /0 |
| 684 | of Blight | 100 | 1 /— | 1; 0:—/— | 2 | 16 | 1 | lcha | — | Approx. 6.15234 Poison Damage over 3s; authoritative rate 21–21/256 per frame<br>RAW: `dmg-pois(75;21;21)` | 0 /0 /0 |
| 685 | of Venom | 100 | 6 /— | 4; 0:—/— | 1 | 16 | 1 | lcha | — | Approx. 15.2344 Poison Damage over 4s; authoritative rate 39–39/256 per frame<br>RAW: `dmg-pois(100;39;39)` | 0 /0 /0 |
| 686 | of Pestilence | 100 | 14 /— | 10; 0:—/— | 1 | 16 | 1 | lcha | — | Approx. 25.3906 Poison Damage over 5s; authoritative rate 52–52/256 per frame<br>RAW: `dmg-pois(125;52;52)` | 0 /0 /0 |
| 687 | of Anthrax | 100 | 21 /— | 15; 0:—/— | 1 | 16 | 0 | lcha | — | Approx. 50.3906 Poison Damage over 6s; authoritative rate 86–86/256 per frame<br>RAW: `dmg-pois(150;86;86)` | 0 /0 /0 |
| 688 | of Blight | 100 | 5 /— | 3; 0:—/— | 2 | 16 | 1 | mcha | — | Approx. 6.15234 Poison Damage over 3s; authoritative rate 21–21/256 per frame<br>RAW: `dmg-pois(75;21;21)` | 0 /0 /0 |
| 689 | of Venom | 100 | 13 /— | 9; 0:—/— | 1 | 16 | 1 | mcha | — | Approx. 15.2344 Poison Damage over 4s; authoritative rate 39–39/256 per frame<br>RAW: `dmg-pois(100;39;39)` | 0 /0 /0 |
| 690 | of Pestilence | 100 | 23 /— | 17; 0:—/— | 1 | 16 | 1 | mcha | — | Approx. 25.3906 Poison Damage over 5s; authoritative rate 52–52/256 per frame<br>RAW: `dmg-pois(125;52;52)` | 0 /0 /0 |
| 691 | of Anthrax | 100 | 33 /— | 25; 0:—/— | 1 | 16 | 0 | mcha | — | Approx. 50.3906 Poison Damage over 6s; authoritative rate 86–86/256 per frame<br>RAW: `dmg-pois(150;86;86)` | 0 /0 /0 |
| 692 | of Blight | 100 | 9 /— | 6; 0:—/— | 2 | 16 | 1 | scha | — | Approx. 6.15234 Poison Damage over 3s; authoritative rate 21–21/256 per frame<br>RAW: `dmg-pois(75;21;21)` | 0 /0 /0 |
| 693 | of Venom | 100 | 20 /— | 15; 0:—/— | 1 | 16 | 1 | scha | — | Approx. 15.2344 Poison Damage over 4s; authoritative rate 39–39/256 per frame<br>RAW: `dmg-pois(100;39;39)` | 0 /0 /0 |
| 694 | of Pestilence | 100 | 32 /— | 24; 0:—/— | 1 | 16 | 1 | scha | — | Approx. 25.3906 Poison Damage over 5s; authoritative rate 52–52/256 per frame<br>RAW: `dmg-pois(125;52;52)` | 0 /0 /0 |
| 695 | of Anthrax | 100 | 44 /— | 36; 0:—/— | 1 | 16 | 0 | scha | — | Approx. 50.3906 Poison Damage over 6s; authoritative rate 86–86/256 per frame<br>RAW: `dmg-pois(150;86;86)` | 0 /0 /0 |
| 696 | of Frost | 100 | 5 /— | 3; 0:—/— | 2 | 10 | 1 | lcha | — | +1 min cold dmg; +2 max cold dmg; (cold length 25 frames)<br>RAW: `cold-min(_;1;1); cold-max(_;2;2); cold-len(_;25;25)` | 0 /0 /0 |
| 697 | of the Icicle | 100 | 8 /— | 6; 0:—/— | 1 | 10 | 1 | lcha | — | +2 min cold dmg; +3-4 max cold dmg; (cold length 25 frames)<br>RAW: `cold-min(_;2;2); cold-max(_;3;4); cold-len(_;25;25)` | 0 /0 /0 |
| 698 | of the Glacier | 100 | 15 /— | 11; 0:—/— | 1 | 10 | 1 | lcha | — | +3 min cold dmg; +5-7 max cold dmg; (cold length 25 frames)<br>RAW: `cold-min(_;3;3); cold-max(_;5;7); cold-len(_;25;25)` | 0 /0 /0 |
| 699 | of Winter | 100 | 23 /— | 17; 0:—/— | 1 | 10 | 0 | lcha | — | +4-6 min cold dmg; +8-11 max cold dmg; (cold length 25 frames)<br>RAW: `cold-min(_;4;6); cold-max(_;8;11); cold-len(_;25;25)` | 0 /0 /0 |
| 700 | of Frost | 100 | 9 /— | 6; 0:—/— | 2 | 10 | 1 | mcha | — | +1 min cold dmg; +2-3 max cold dmg; (cold length 25 frames)<br>RAW: `cold-min(_;1;1); cold-max(_;2;3); cold-len(_;25;25)` | 0 /0 /0 |
| 701 | of the Icicle | 100 | 15 /— | 11; 0:—/— | 1 | 10 | 1 | mcha | — | +2 min cold dmg; +4-5 max cold dmg; (cold length 25 frames)<br>RAW: `cold-min(_;2;2); cold-max(_;4;5); cold-len(_;25;25)` | 0 /0 /0 |
| 702 | of the Glacier | 100 | 25 /— | 18; 0:—/— | 1 | 10 | 1 | mcha | — | +3 min cold dmg; +6-8 max cold dmg; (cold length 25 frames)<br>RAW: `cold-min(_;3;3); cold-max(_;6;8); cold-len(_;25;25)` | 0 /0 /0 |
| 703 | of Winter | 100 | 35 /— | 27; 0:—/— | 1 | 10 | 0 | mcha | — | +4-6 min cold dmg; +9-12 max cold dmg; (cold length 25 frames)<br>RAW: `cold-min(_;4;6); cold-max(_;9;12); cold-len(_;25;25)` | 0 /0 /0 |
| 704 | of Frost | 100 | 14 /— | 10; 0:—/— | 2 | 10 | 1 | scha | — | +1 min cold dmg; +2 max cold dmg; (cold length 25 frames)<br>RAW: `cold-min(_;1;1); cold-max(_;2;2); cold-len(_;25;25)` | 0 /0 /0 |
| 705 | of the Icicle | 100 | 21 /— | 15; 0:—/— | 1 | 10 | 1 | scha | — | +2 min cold dmg; +3-4 max cold dmg; (cold length 25 frames)<br>RAW: `cold-min(_;2;2); cold-max(_;3;4); cold-len(_;25;25)` | 0 /0 /0 |
| 706 | of the Glacier | 100 | 33 /— | 25; 0:—/— | 1 | 10 | 1 | scha | — | +3 min cold dmg; +5-6 max cold dmg; (cold length 25 frames)<br>RAW: `cold-min(_;3;3); cold-max(_;5;6); cold-len(_;25;25)` | 0 /0 /0 |
| 707 | of Winter | 100 | 46 /— | 38; 0:—/— | 1 | 10 | 0 | scha | — | +4-5 min cold dmg; +7-9 max cold dmg; (cold length 25 frames)<br>RAW: `cold-min(_;4;5); cold-max(_;7;9); cold-len(_;25;25)` | 0 /0 /0 |
| 708 | of Flame | 100 | 3 /— | 2; 0:—/— | 2 | 12 | 1 | lcha | — | +1 min fire dmg; +2 max fire dmg<br>RAW: `fire-min(_;1;1); fire-max(_;2;2)` | 0 /0 /0 |
| 709 | of Fire | 100 | 8 /— | 6; 0:—/— | 1 | 12 | 1 | lcha | — | +1-2 min fire dmg; +3 max fire dmg<br>RAW: `fire-min(_;1;2); fire-max(_;3;3)` | 0 /0 /0 |
| 710 | of Burning | 100 | 14 /— | 10; 0:—/— | 1 | 12 | 1 | lcha | — | +2-3 min fire dmg; +4-7 max fire dmg<br>RAW: `fire-min(_;2;3); fire-max(_;4;7)` | 0 /0 /0 |
| 711 | of Incineration | 100 | 22 /— | 16; 0:—/— | 1 | 12 | 0 | lcha | — | +4-7 min fire dmg; +8-14 max fire dmg<br>RAW: `fire-min(_;4;7); fire-max(_;8;14)` | 0 /0 /0 |
| 712 | of Flame | 100 | 7 /— | 5; 0:—/— | 2 | 12 | 1 | mcha | — | +1 min fire dmg; +2 max fire dmg<br>RAW: `fire-min(_;1;1); fire-max(_;2;2)` | 0 /0 /0 |
| 713 | of Fire | 100 | 14 /— | 10; 0:—/— | 1 | 12 | 1 | mcha | — | +2 min fire dmg; +3-5 max fire dmg<br>RAW: `fire-min(_;2;2); fire-max(_;3;5)` | 0 /0 /0 |
| 714 | of Burning | 100 | 24 /— | 18; 0:—/— | 1 | 12 | 1 | mcha | — | +3-5 min fire dmg; +6-11 max fire dmg<br>RAW: `fire-min(_;3;5); fire-max(_;6;11)` | 0 /0 /0 |
| 715 | of Incineration | 100 | 34 /— | 26; 0:—/— | 1 | 12 | 0 | mcha | — | +6-10 min fire dmg; +12-17 max fire dmg<br>RAW: `fire-min(_;6;10); fire-max(_;12;17)` | 0 /0 /0 |
| 716 | of Flame | 100 | 11 /— | 8; 0:—/— | 2 | 12 | 1 | scha | — | +1 min fire dmg; +2 max fire dmg<br>RAW: `fire-min(_;1;1); fire-max(_;2;2)` | 0 /0 /0 |
| 717 | of Fire | 100 | 20 /— | 15; 0:—/— | 1 | 12 | 1 | scha | — | +2 min fire dmg; +3-4 max fire dmg<br>RAW: `fire-min(_;2;2); fire-max(_;3;4)` | 0 /0 /0 |
| 718 | of Burning | 100 | 32 /— | 24; 0:—/— | 1 | 12 | 1 | scha | — | +3-4 min fire dmg; +5-8 max fire dmg<br>RAW: `fire-min(_;3;4); fire-max(_;5;8)` | 0 /0 /0 |
| 719 | of Incineration | 100 | 45 /— | 37; 0:—/— | 1 | 12 | 0 | scha | — | +5-7 min fire dmg; +9-13 max fire dmg<br>RAW: `fire-min(_;5;7); fire-max(_;9;13)` | 0 /0 /0 |
| 720 | of Shock | 100 | 4 /— | 3; 0:—/— | 2 | 13 | 1 | lcha | — | +1 min ltng dmg; +2-3 max ltng dmg<br>RAW: `ltng-min(_;1;1); ltng-max(_;2;3)` | 0 /0 /0 |
| 721 | of Lightning | 100 | 7 /— | 5; 0:—/— | 1 | 13 | 1 | lcha | — | +1 min ltng dmg; +4-7 max ltng dmg<br>RAW: `ltng-min(_;1;1); ltng-max(_;4;7)` | 0 /0 /0 |
| 722 | of Thunder | 100 | 15 /— | 11; 0:—/— | 1 | 13 | 1 | lcha | — | +1 min ltng dmg; +8-21 max ltng dmg<br>RAW: `ltng-min(_;1;1); ltng-max(_;8;21)` | 0 /0 /0 |
| 723 | of Storms | 100 | 22 /— | 16; 0:—/— | 1 | 13 | 0 | lcha | — | +1 min ltng dmg; +22-33 max ltng dmg<br>RAW: `ltng-min(_;1;1); ltng-max(_;22;33)` | 0 /0 /0 |
| 724 | of Shock | 100 | 7 /— | 5; 0:—/— | 2 | 13 | 1 | mcha | — | +1 min ltng dmg; +3-5 max ltng dmg<br>RAW: `ltng-min(_;1;1); ltng-max(_;3;5)` | 0 /0 /0 |
| 725 | of Lightning | 100 | 14 /— | 10; 0:—/— | 1 | 13 | 1 | mcha | — | +1 min ltng dmg; +6-13 max ltng dmg<br>RAW: `ltng-min(_;1;1); ltng-max(_;6;13)` | 0 /0 /0 |
| 726 | of Thunder | 100 | 24 /— | 18; 0:—/— | 1 | 13 | 1 | mcha | — | +1 min ltng dmg; +14-25 max ltng dmg<br>RAW: `ltng-min(_;1;1); ltng-max(_;14;25)` | 0 /0 /0 |
| 727 | of Storms | 100 | 34 /— | 26; 0:—/— | 1 | 13 | 0 | mcha | — | +1 min ltng dmg; +26-38 max ltng dmg<br>RAW: `ltng-min(_;1;1); ltng-max(_;26;38)` | 0 /0 /0 |
| 728 | of Shock | 100 | 12 /— | 9; 0:—/— | 2 | 13 | 1 | scha | — | +1 min ltng dmg; +3-6 max ltng dmg<br>RAW: `ltng-min(_;1;1); ltng-max(_;3;6)` | 0 /0 /0 |
| 729 | of Lightning | 100 | 21 /— | 15; 0:—/— | 1 | 13 | 1 | scha | — | +1 min ltng dmg; +7-10 max ltng dmg<br>RAW: `ltng-min(_;1;1); ltng-max(_;7;10)` | 0 /0 /0 |
| 730 | of Thunder | 100 | 33 /— | 25; 0:—/— | 1 | 13 | 1 | scha | — | +1 min ltng dmg; +11-18 max ltng dmg<br>RAW: `ltng-min(_;1;1); ltng-max(_;11;18)` | 0 /0 /0 |
| 731 | of Storms | 100 | 45 /— | 37; 0:—/— | 1 | 13 | 0 | scha | — | +1 min ltng dmg; +19-28 max ltng dmg<br>RAW: `ltng-min(_;1;1); ltng-max(_;19;28)` | 0 /0 /0 |
| 732 | of Dexterity | 1 | 1 /12 | 1; 0:—/— | 4 | 17 | 1 | boot, glov | — | +1 to Dexterity<br>RAW: `dex(_;1;1)` | 0 /0 /0 |
| 733 | of Dexterity | 1 | 1 /5 | 1; 0:—/— | 4 | 17 | 1 | ring | — | +1 to Dexterity<br>RAW: `dex(_;1;1)` | 0 /0 /0 |
| 734 | of Strength | 1 | 1 /11 | 1; 0:—/— | 4 | 31 | 1 | glov | — | +1 to Strength<br>RAW: `str(_;1;1)` | 0 /0 /0 |
| 735 | of Strength | 1 | 1 /4 | 1; 0:—/— | 4 | 31 | 1 | ring | — | +1 to Strength<br>RAW: `str(_;1;1)` | 0 /0 /0 |
| 736 | of Thorns | 1 | 1 /13 | 1; 0:—/— | 4 | 6 | 1 | tors, belt, shld | — | Attacker Takes Damage of 1<br>RAW: `thorns(_;1;1)` | 0 /0 /0 |
| 737 | of Frost | 1 | 1 /3 | 1; 0:—/— | 4 | 10 | 1 | weap | staf, wand, orb | Adds 1-1 Cold Damage (1s chill)<br>RAW: `dmg-cold(25;1;1)` | 0 /0 /0 |
| 738 | of Flame | 1 | 1 /3 | 1; 0:—/— | 4 | 12 | 1 | weap | staf, wand, orb | Adds 1-2 Fire Damage<br>RAW: `dmg-fire(_;1;2)` | 0 /0 /0 |
| 739 | of Blight | 1 | 1 /4 | 1; 0:—/— | 4 | 16 | 1 | weap | scep, staf, orb | Approx. 1.5625 Poison Damage over 2s; authoritative rate 8–8/256 per frame<br>RAW: `dmg-pois(50;8;8)` | 0 /0 /0 |
| 740 | of Shock | 1 | 1 /3 | 1; 0:—/— | 4 | 13 | 1 | weap | staf, wand, orb | Adds 1-3 Lightning Damage<br>RAW: `dmg-ltng(_;1;3)` | 0 /0 /0 |
| 741 | of Regeneration | 1 | 1 /9 | 1; 0:—/— | 3 | 19 | 1 | amul, circ | — | Replenish Life +2<br>RAW: `regen(_;2;2)` | 0 /0 /0 |
| 742 | of Energy | 1 | 1 /4 | 1; 0:—/— | 4 | 23 | 1 | amul, orb, circ, wand, staf, helm, ring | — | +1 to Energy<br>RAW: `enr(_;1;1)` | 0 /0 /0 |
| 743 | of Light | 1 | 1 /5 | 1; 0:—/— | 4 | 25 | 1 | ring, amul | — | +1 to Light Radius; +10 to Attack Rating<br>RAW: `light(_;1;1); att(_;10;10)` | 0 /0 /0 |
| 744 | of the Leech | 100 | 24 /— | 20; 0:—/— | 2 | 27 | 1 | amul | — | 2-3% Life Stolen per Hit<br>RAW: `lifesteal(_;2;3)` | 0 /0 /0 |
| 745 | of the Locust | 100 | 57 /— | 45; 0:—/— | 2 | 27 | 1 | amul | — | 4-5% Life Stolen per Hit<br>RAW: `lifesteal(_;4;5)` | 0 /0 /0 |
| 746 | of the Lamprey | 100 | 85 /— | 73; 0:—/— | 2 | 27 | 1 | amul | — | 6% Life Stolen per Hit<br>RAW: `lifesteal(_;6;6)` | 0 /0 /0 |
| 747 | of the Bat | 1 | 25 /— | 21; 0:—/— | 2 | 28 | 1 | ring | — | 2-3% Mana Stolen per Hit<br>RAW: `manasteal(_;2;3)` | 0 /0 /0 |
| 748 | of the Wraith | 1 | 58 /— | 46; 0:—/— | 2 | 28 | 1 | ring | — | 4-5% Mana Stolen per Hit<br>RAW: `manasteal(_;4;5)` | 0 /0 /0 |
| 749 | of the Vampire | 100 | 86 /— | 74; 0:—/— | 2 | 28 | 1 | ring | — | 6% Mana Stolen per Hit<br>RAW: `manasteal(_;6;6)` | 0 /0 /0 |

## Appendix D. All gems and runes

[Source Gems.txt](https://cdn.jsdelivr.net/gh/fabd/diablo2@45112569deb9384738ccafe5c24ebbb71f41c7c9/code/d2_113_data/Gems.txt).

[Source Misc.txt](https://cdn.jsdelivr.net/gh/fabd/diablo2@45112569deb9384738ccafe5c24ebbb71f41c7c9/code/d2_113_data/Misc.txt).

Each context column lists exact effect tuples. Helm/body use the same context. Required levels come from Misc.txt. Gem grade "standard" in internal data means the unqualified normal gem. Approximate poison totals are explanatory only; raw rates and frame lengths are authoritative.


### D.1. 35 gems

| Line | Name /code | Req lvl | Weapon | Body /helm | Shield |
| --- | --- | --- | --- | --- | --- |
| 2 | Chipped Amethyst `gcv` | 1 | +40 to Attack Rating<br>RAW: `att(0;40;40)` | +3 to Strength<br>RAW: `str(0;3;3)` | +8 Defense<br>RAW: `ac(0;8;8)` |
| 3 | Flawed Amethyst `gfv` | 5 | +60 to Attack Rating<br>RAW: `att(0;60;60)` | +4 to Strength<br>RAW: `str(0;4;4)` | +12 Defense<br>RAW: `ac(0;12;12)` |
| 4 | Amethyst `gsv` | 12 | +80 to Attack Rating<br>RAW: `att(0;80;80)` | +6 to Strength<br>RAW: `str(0;6;6)` | +18 Defense<br>RAW: `ac(0;18;18)` |
| 5 | Flawless Amethyst `gzv` | 15 | +100 to Attack Rating<br>RAW: `att(0;100;100)` | +8 to Strength<br>RAW: `str(0;8;8)` | +24 Defense<br>RAW: `ac(0;24;24)` |
| 6 | Perfect Amethyst `gpv` | 18 | +150 to Attack Rating<br>RAW: `att(0;150;150)` | +10 to Strength<br>RAW: `str(0;10;10)` | +30 Defense<br>RAW: `ac(0;30;30)` |
| 7 | Chipped Sapphire `gcb` | 1 | +1 min cold dmg; +3 max cold dmg; (cold length 25 frames)<br>RAW: `cold-min(0;1;1); cold-max(0;3;3); cold-len(0;25;25)` | +10 to Mana<br>RAW: `mana(0;10;10)` | Cold Resist +12%<br>RAW: `res-cold(0;12;12)` |
| 8 | Flawed Sapphire `gfb` | 5 | +3 min cold dmg; +5 max cold dmg; (cold length 35 frames)<br>RAW: `cold-min(0;3;3); cold-max(0;5;5); cold-len(0;35;35)` | +17 to Mana<br>RAW: `mana(0;17;17)` | Cold Resist +16%<br>RAW: `res-cold(0;16;16)` |
| 9 | Sapphire `gsb` | 12 | +4 min cold dmg; +7 max cold dmg; (cold length 50 frames)<br>RAW: `cold-min(0;4;4); cold-max(0;7;7); cold-len(0;50;50)` | +24 to Mana<br>RAW: `mana(0;24;24)` | Cold Resist +22%<br>RAW: `res-cold(0;22;22)` |
| 10 | Flawless Sapphire `glb` | 15 | +6 min cold dmg; +10 max cold dmg; (cold length 60 frames)<br>RAW: `cold-min(0;6;6); cold-max(0;10;10); cold-len(0;60;60)` | +31 to Mana<br>RAW: `mana(0;31;31)` | Cold Resist +28%<br>RAW: `res-cold(0;28;28)` |
| 11 | Perfect Sapphire `gpb` | 18 | +10 min cold dmg; +14 max cold dmg; (cold length 75 frames)<br>RAW: `cold-min(0;10;10); cold-max(0;14;14); cold-len(0;75;75)` | +38 to Mana<br>RAW: `mana(0;38;38)` | Cold Resist +40%<br>RAW: `res-cold(0;40;40)` |
| 12 | Chipped Emerald `gcg` | 1 | +34 pois-min (rate units1/256damage/frame); +34 pois-max (rate units1/256damage/frame); (poison length 75 frames)<br>RAW: `pois-min(0;34;34); pois-max(0;34;34); pois-len(0;75;75)` | +3 to Dexterity<br>RAW: `dex(0;3;3)` | Poison Resist +12%<br>RAW: `res-pois(0;12;12)` |
| 13 | Flawed Emerald `gfg` | 5 | +51 pois-min (rate units1/256damage/frame); +51 pois-max (rate units1/256damage/frame); (poison length 100 frames)<br>RAW: `pois-min(0;51;51); pois-max(0;51;51); pois-len(0;100;100)` | +4 to Dexterity<br>RAW: `dex(0;4;4)` | Poison Resist +16%<br>RAW: `res-pois(0;16;16)` |
| 14 | Emerald `gsg` | 12 | +82 pois-min (rate units1/256damage/frame); +82 pois-max (rate units1/256damage/frame); (poison length 125 frames)<br>RAW: `pois-min(0;82;82); pois-max(0;82;82); pois-len(0;125;125)` | +6 to Dexterity<br>RAW: `dex(0;6;6)` | Poison Resist +22%<br>RAW: `res-pois(0;22;22)` |
| 15 | Flawless Emerald `glg` | 15 | +101 pois-min (rate units1/256damage/frame); +101 pois-max (rate units1/256damage/frame); (poison length 152 frames)<br>RAW: `pois-min(0;101;101); pois-max(0;101;101); pois-len(0;152;152)` | +8 to Dexterity<br>RAW: `dex(0;8;8)` | Poison Resist +28%<br>RAW: `res-pois(0;28;28)` |
| 16 | Perfect Emerald `gpg` | 18 | +143 pois-min (rate units1/256damage/frame); +143 pois-max (rate units1/256damage/frame); (poison length 179 frames)<br>RAW: `pois-min(0;143;143); pois-max(0;143;143); pois-len(0;179;179)` | +10 to Dexterity<br>RAW: `dex(0;10;10)` | Poison Resist +40%<br>RAW: `res-pois(0;40;40)` |
| 17 | Chipped Ruby `gcr` | 1 | +3 min fire dmg; +4 max fire dmg<br>RAW: `fire-min(0;3;3); fire-max(0;4;4)` | +10 to Life<br>RAW: `hp(0;10;10)` | Fire Resist +12%<br>RAW: `res-fire(0;12;12)` |
| 18 | Flawed Ruby `gfr` | 5 | +5 min fire dmg; +8 max fire dmg<br>RAW: `fire-min(0;5;5); fire-max(0;8;8)` | +17 to Life<br>RAW: `hp(0;17;17)` | Fire Resist +16%<br>RAW: `res-fire(0;16;16)` |
| 19 | Ruby `gsr` | 12 | +8 min fire dmg; +12 max fire dmg<br>RAW: `fire-min(0;8;8); fire-max(0;12;12)` | +24 to Life<br>RAW: `hp(0;24;24)` | Fire Resist +22%<br>RAW: `res-fire(0;22;22)` |
| 20 | Flawless Ruby `glr` | 15 | +10 min fire dmg; +16 max fire dmg<br>RAW: `fire-min(0;10;10); fire-max(0;16;16)` | +31 to Life<br>RAW: `hp(0;31;31)` | Fire Resist +28%<br>RAW: `res-fire(0;28;28)` |
| 21 | Perfect Ruby `gpr` | 18 | +15 min fire dmg; +20 max fire dmg<br>RAW: `fire-min(0;15;15); fire-max(0;20;20)` | +38 to Life<br>RAW: `hp(0;38;38)` | Fire Resist +40%<br>RAW: `res-fire(0;40;40)` |
| 22 | Chipped Diamond `gcw` | 1 | +28% Damage to Undead<br>RAW: `dmg-undead(0;28;28)` | +20 to Attack Rating<br>RAW: `att(0;20;20)` | All Resistances +6<br>RAW: `res-all(0;6;6)` |
| 23 | Flawed Diamond `gfw` | 5 | +34% Damage to Undead<br>RAW: `dmg-undead(0;34;34)` | +40 to Attack Rating<br>RAW: `att(0;40;40)` | All Resistances +8<br>RAW: `res-all(0;8;8)` |
| 24 | Diamond `gsw` | 12 | +44% Damage to Undead<br>RAW: `dmg-undead(0;44;44)` | +60 to Attack Rating<br>RAW: `att(0;60;60)` | All Resistances +11<br>RAW: `res-all(0;11;11)` |
| 25 | Flawless Diamond `glw` | 15 | +54% Damage to Undead<br>RAW: `dmg-undead(0;54;54)` | +80 to Attack Rating<br>RAW: `att(0;80;80)` | All Resistances +14<br>RAW: `res-all(0;14;14)` |
| 26 | Perfect Diamond `gpw` | 18 | +68% Damage to Undead<br>RAW: `dmg-undead(0;68;68)` | +100 to Attack Rating<br>RAW: `att(0;100;100)` | All Resistances +19<br>RAW: `res-all(0;19;19)` |
| 27 | Chipped Topaz `gcy` | 1 | +1 min ltng dmg; +8 max ltng dmg<br>RAW: `ltng-min(0;1;1); ltng-max(0;8;8)` | 9% Better Chance of Getting Magic Items<br>RAW: `mag%(0;9;9)` | Lightning Resist +12%<br>RAW: `res-ltng(0;12;12)` |
| 28 | Flawed Topaz `gfy` | 5 | +1 min ltng dmg; +14 max ltng dmg<br>RAW: `ltng-min(0;1;1); ltng-max(0;14;14)` | 13% Better Chance of Getting Magic Items<br>RAW: `mag%(0;13;13)` | Lightning Resist +16%<br>RAW: `res-ltng(0;16;16)` |
| 29 | Topaz `gsy` | 12 | +1 min ltng dmg; +22 max ltng dmg<br>RAW: `ltng-min(0;1;1); ltng-max(0;22;22)` | 16% Better Chance of Getting Magic Items<br>RAW: `mag%(0;16;16)` | Lightning Resist +22%<br>RAW: `res-ltng(0;22;22)` |
| 30 | Flawless Topaz `gly` | 15 | +1 min ltng dmg; +30 max ltng dmg<br>RAW: `ltng-min(0;1;1); ltng-max(0;30;30)` | 20% Better Chance of Getting Magic Items<br>RAW: `mag%(0;20;20)` | Lightning Resist +28%<br>RAW: `res-ltng(0;28;28)` |
| 31 | Perfect Topaz `gpy` | 18 | +1 min ltng dmg; +40 max ltng dmg<br>RAW: `ltng-min(0;1;1); ltng-max(0;40;40)` | 24% Better Chance of Getting Magic Items<br>RAW: `mag%(0;24;24)` | Lightning Resist +40%<br>RAW: `res-ltng(0;40;40)` |
| 32 | Chipped Skull `skc` | 1 | 1% Mana Stolen per Hit; 2% Life Stolen per Hit<br>RAW: `manasteal(0;1;1); lifesteal(0;2;2)` | Replenish Life +2; Regenerate Mana 8%<br>RAW: `regen(0;2;2); regen-mana(0;8;8)` | Attacker Takes Damage of 4<br>RAW: `thorns(0;4;4)` |
| 33 | Flawed Skull `skf` | 5 | 2% Mana Stolen per Hit; 2% Life Stolen per Hit<br>RAW: `manasteal(0;2;2); lifesteal(0;2;2)` | Replenish Life +3; Regenerate Mana 8%<br>RAW: `regen(0;3;3); regen-mana(0;8;8)` | Attacker Takes Damage of 8<br>RAW: `thorns(0;8;8)` |
| 34 | Skull `sku` | 12 | 2% Mana Stolen per Hit; 3% Life Stolen per Hit<br>RAW: `manasteal(0;2;2); lifesteal(0;3;3)` | Replenish Life +3; Regenerate Mana 12%<br>RAW: `regen(0;3;3); regen-mana(0;12;12)` | Attacker Takes Damage of 12<br>RAW: `thorns(0;12;12)` |
| 35 | Flawless Skull `skl` | 15 | 3% Mana Stolen per Hit; 3% Life Stolen per Hit<br>RAW: `manasteal(0;3;3); lifesteal(0;3;3)` | Replenish Life +4; Regenerate Mana 12%<br>RAW: `regen(0;4;4); regen-mana(0;12;12)` | Attacker Takes Damage of 16<br>RAW: `thorns(0;16;16)` |
| 36 | Perfect Skull `skz` | 18 | 3% Mana Stolen per Hit; 4% Life Stolen per Hit<br>RAW: `manasteal(0;3;3); lifesteal(0;4;4)` | Replenish Life +5; Regenerate Mana 19%<br>RAW: `regen(0;5;5); regen-mana(0;19;19)` | Attacker Takes Damage of 20<br>RAW: `thorns(0;20;20)` |

### D.2. 33 runes

| Line | Name /code | Req lvl | Weapon | Body /helm | Shield |
| --- | --- | --- | --- | --- | --- |
| 38 | El Rune `r01` | 11 | +1 to Light Radius; +50 to Attack Rating<br>RAW: `light(_;1;1); att(_;50;50)` | +1 to Light Radius; +15 Defense<br>RAW: `light(_;1;1); ac(_;15;15)` | +1 to Light Radius; +15 Defense<br>RAW: `light(_;1;1); ac(_;15;15)` |
| 39 | Eld Rune `r02` | 11 | +50 to Attack Rating against Undead; +75% Damage to Undead<br>RAW: `att-undead(_;50;50); dmg-undead(_;75;75)` | 15% Slower Stamina Drain<br>RAW: `stamdrain(_;15;15)` | 7% Increased Chance of Blocking<br>RAW: `block(_;7;7)` |
| 40 | Tir Rune `r03` | 13 | +2 to Mana after each Kill<br>RAW: `mana-kill(_;2;2)` | +2 to Mana after each Kill<br>RAW: `mana-kill(_;2;2)` | +2 to Mana after each Kill<br>RAW: `mana-kill(_;2;2)` |
| 41 | Nef Rune `r04` | 13 | Knockback<br>RAW: `knock(_;1;1)` | +30 Defense vs. Missile<br>RAW: `ac-miss(_;30;30)` | +30 Defense vs. Missile<br>RAW: `ac-miss(_;30;30)` |
| 42 | Eth Rune `r05` | 15 | -25% Target Defense<br>RAW: `reduce-ac(_;25;25)` | Regenerate Mana 15%<br>RAW: `regen-mana(_;15;15)` | Regenerate Mana 15%<br>RAW: `regen-mana(_;15;15)` |
| 43 | Ith Rune `r06` | 15 | +9 to Maximum Damage<br>RAW: `dmg-max(_;9;9)` | 15% Damage Taken Goes To Mana<br>RAW: `dmg-to-mana(_;15;15)` | 15% Damage Taken Goes To Mana<br>RAW: `dmg-to-mana(_;15;15)` |
| 44 | Tal Rune `r07` | 17 | Approx. 75.1953 Poison Damage over 5s; authoritative rate 154–154/256 per frame<br>RAW: `dmg-pois(125;154;154)` | Poison Resist +30%<br>RAW: `res-pois(_;30;30)` | Poison Resist +35%<br>RAW: `res-pois(_;35;35)` |
| 45 | Ral Rune `r08` | 19 | Adds 5-30 Fire Damage<br>RAW: `dmg-fire(_;5;30)` | Fire Resist +30%<br>RAW: `res-fire(_;30;30)` | Fire Resist +35%<br>RAW: `res-fire(_;35;35)` |
| 46 | Ort Rune `r09` | 21 | Adds 1-50 Lightning Damage<br>RAW: `dmg-ltng(_;1;50)` | Lightning Resist +30%<br>RAW: `res-ltng(_;30;30)` | Lightning Resist +35%<br>RAW: `res-ltng(_;35;35)` |
| 47 | Thul Rune `r10` | 23 | Adds 3-14 Cold Damage (3s chill)<br>RAW: `dmg-cold(75;3;14)` | Cold Resist +30%<br>RAW: `res-cold(_;30;30)` | Cold Resist +35%<br>RAW: `res-cold(_;35;35)` |
| 48 | Amn Rune `r11` | 25 | 7% Life Stolen per Hit<br>RAW: `lifesteal(_;7;7)` | Attacker Takes Damage of 14<br>RAW: `thorns(_;14;14)` | Attacker Takes Damage of 14<br>RAW: `thorns(_;14;14)` |
| 49 | Sol Rune `r12` | 27 | +9 to Minimum Damage<br>RAW: `dmg-min(_;9;9)` | Damage Reduced by 7<br>RAW: `red-dmg(_;7;7)` | Damage Reduced by 7<br>RAW: `red-dmg(_;7;7)` |
| 50 | Shael Rune `r13` | 29 | +20% Increased Attack Speed<br>RAW: `swing2(_;20;20)` | +20% Faster Hit Recovery<br>RAW: `balance2(_;20;20)` | +20% Faster Block Rate<br>RAW: `block2(_;20;20)` |
| 51 | Dol Rune `r14` | 31 | Hit Causes Monster to Flee 25% (raw /128 chance)<br>RAW: `howl(_;32;32)` | Replenish Life +7<br>RAW: `regen(_;7;7)` | Replenish Life +7<br>RAW: `regen(_;7;7)` |
| 52 | Hel Rune `r15` | 0 | Requirements -20%<br>RAW: `ease(_;-20;-20)` | Requirements -15%<br>RAW: `ease(_;-15;-15)` | Requirements -15%<br>RAW: `ease(_;-15;-15)` |
| 53 | Io Rune `r16` | 35 | +10 to Vitality<br>RAW: `vit(_;10;10)` | +10 to Vitality<br>RAW: `vit(_;10;10)` | +10 to Vitality<br>RAW: `vit(_;10;10)` |
| 54 | Lum Rune `r17` | 37 | +10 to Energy<br>RAW: `enr(_;10;10)` | +10 to Energy<br>RAW: `enr(_;10;10)` | +10 to Energy<br>RAW: `enr(_;10;10)` |
| 55 | Ko Rune `r18` | 39 | +10 to Dexterity<br>RAW: `dex(_;10;10)` | +10 to Dexterity<br>RAW: `dex(_;10;10)` | +10 to Dexterity<br>RAW: `dex(_;10;10)` |
| 56 | Fal Rune `r19` | 41 | +10 to Strength<br>RAW: `str(_;10;10)` | +10 to Strength<br>RAW: `str(_;10;10)` | +10 to Strength<br>RAW: `str(_;10;10)` |
| 57 | Lem Rune `r20` | 43 | 75% Extra Gold from Monsters<br>RAW: `gold%(_;75;75)` | 50% Extra Gold from Monsters<br>RAW: `gold%(_;50;50)` | 50% Extra Gold from Monsters<br>RAW: `gold%(_;50;50)` |
| 58 | Pul Rune `r21` | 45 | +100 to Attack Rating against Demons; +75% Damage to Demons<br>RAW: `att-demon(_;100;100); dmg-demon(_;75;75)` | 30% Enhanced Defense<br>RAW: `ac%(_;30;30)` | 30% Enhanced Defense<br>RAW: `ac%(_;30;30)` |
| 59 | Um Rune `r22` | 47 | 25% Chance of Open Wounds<br>RAW: `openwounds(_;25;25)` | All Resistances +15<br>RAW: `res-all(_;15;15)` | All Resistances +22<br>RAW: `res-all(_;22;22)` |
| 60 | Mal Rune `r23` | 49 | Prevent Monster Heal<br>RAW: `noheal(_;1;1)` | Magic Damage Reduced by 7<br>RAW: `red-mag(_;7;7)` | Magic Damage Reduced by 7<br>RAW: `red-mag(_;7;7)` |
| 61 | Ist Rune `r24` | 51 | 30% Better Chance of Getting Magic Items<br>RAW: `mag%(_;30;30)` | 25% Better Chance of Getting Magic Items<br>RAW: `mag%(_;25;25)` | 25% Better Chance of Getting Magic Items<br>RAW: `mag%(_;25;25)` |
| 62 | Gul Rune `r25` | 53 | 20% Bonus to Attack Rating<br>RAW: `att%(_;20;20)` | +5% to Maximum Poison Resist<br>RAW: `res-pois-max(_;5;5)` | +5% to Maximum Poison Resist<br>RAW: `res-pois-max(_;5;5)` |
| 63 | Vex Rune `r26` | 55 | 7% Mana Stolen per Hit<br>RAW: `manasteal(_;7;7)` | +5% to Maximum Fire Resist<br>RAW: `res-fire-max(_;5;5)` | +5% to Maximum Fire Resist<br>RAW: `res-fire-max(_;5;5)` |
| 64 | Ohm Rune `r27` | 57 | 50% Enhanced Damage<br>RAW: `dmg%(_;50;50)` | +5% to Maximum Cold Resist<br>RAW: `res-cold-max(_;5;5)` | +5% to Maximum Cold Resist<br>RAW: `res-cold-max(_;5;5)` |
| 65 | Lo Rune `r28` | 59 | 20% Deadly Strike<br>RAW: `deadly(_;20;20)` | +5% to Maximum Lightning Resist<br>RAW: `res-ltng-max(_;5;5)` | +5% to Maximum Lightning Resist<br>RAW: `res-ltng-max(_;5;5)` |
| 66 | Sur Rune `r29` | 61 | Hit Blinds Target +1<br>RAW: `stupidity(_;1;1)` | Increase Maximum Mana 5%<br>RAW: `mana%(_;5;5)` | +50 to Mana<br>RAW: `mana(_;50;50)` |
| 67 | Ber Rune `r30` | 63 | 20% Chance of Crushing Blow<br>RAW: `crush(_;20;20)` | Damage Reduced by 8%<br>RAW: `red-dmg%(_;8;8)` | Damage Reduced by 8%<br>RAW: `red-dmg%(_;8;8)` |
| 68 | Jah Rune `r31` | 65 | Ignore Target's Defense<br>RAW: `ignore-ac(_;1;1)` | Increase Maximum Life 5%<br>RAW: `hp%(_;5;5)` | +50 to Life<br>RAW: `hp(_;50;50)` |
| 69 | Cham Rune `r32` | 67 | Freezes Target +3<br>RAW: `freeze(_;3;3)` | Cannot Be Frozen<br>RAW: `nofreeze(_;1;1)` | Cannot Be Frozen<br>RAW: `nofreeze(_;1;1)` |
| 70 | Zod Rune `r33` | 69 | Indestructible<br>RAW: `indestruct(_;1;1)` | Indestructible<br>RAW: `indestruct(_;1;1)` | Indestructible<br>RAW: `indestruct(_;1;1)` |

## Appendix E. All 78 active legacy runewords — complete additive specification

[Source Runes.txt](https://cdn.jsdelivr.net/gh/fabd/diablo2@45112569deb9384738ccafe5c24ebbb71f41c7c9/code/d2_113_data/Runes.txt).

**Complete word stats = column "Word-added" + ONE appropriate "Socketed rune contributions" context.** These are separated intentionally to prevent the common Runes.txt-only omission and double-counting. Rune contributions list each rune individually; matching stats add under normal item-stat rules. No stats have been omitted to meet a forty-word cutoff. Highest rune req is a minimum; higher base/staffmod requirements still apply. `server1` means legacy ladder-only creation, not single-player creation. All allowed/excluded types are literal source codes resolved by Appendix B.

| Line | Displayed name /internal key | Ordered runes /sockets | Allowed /excluded types | Highest rune req | server | Word-added properties (all) | Socketed rune contributions by context |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2 | Ancient's Pledge /`Runeword1` | Ral → Ort → Tal /3 | shld /— | 21 | 0 | Cold Resist +30%; All Resistances +13; 50% Enhanced Defense; 10% Damage Taken Goes To Mana<br>RAW: `res-cold(_;30;30); res-all(_;13;13); ac%(_;50;50); dmg-to-mana(_;10;10)` | **SHIELD**: Ral Rune: Fire Resist +35%<br>RAW: `res-fire(_;35;35)`; Ort Rune: Lightning Resist +35%<br>RAW: `res-ltng(_;35;35)`; Tal Rune: Poison Resist +35%<br>RAW: `res-pois(_;35;35)` |
| 3 | Black /`Runeword6` | Thul → Io → Nef /3 | club, hamm, mace /— | 35 | 0 | 40% Chance of Crushing Blow; 120% Enhanced Damage; +15% Increased Attack Speed; Magic Damage Reduced by 2; +200 to Attack Rating; Level 4 Corpse Explosion (12 Charges)<br>RAW: `crush(_;40;40); dmg%(_;120;120); swing2(_;15;15); red-mag(_;2;2); att(_;200;200); charged(74;12;4)` | **WEAPON**: Thul Rune: Adds 3-14 Cold Damage (3s chill)<br>RAW: `dmg-cold(75;3;14)`; Io Rune: +10 to Vitality<br>RAW: `vit(_;10;10)`; Nef Rune: Knockback<br>RAW: `knock(_;1;1)` |
| 4 | Fury /`Runeword44` | Jah → Gul → Eth /3 | mele /— | 65 | 0 | 209% Enhanced Damage; +40% Increased Attack Speed; Prevent Monster Heal; 66% Chance of Open Wounds; 6% Life Stolen per Hit; 33% Deadly Strike; +5 to Frenzy (native class only)<br>RAW: `dmg%(_;209;209); swing2(_;40;40); noheal(_;1;1); openwounds(_;66;66); lifesteal(_;6;6); deadly(_;33;33); skill(147;5;5)` | **WEAPON**: Jah Rune: Ignore Target's Defense<br>RAW: `ignore-ac(_;1;1)`; Gul Rune: 20% Bonus to Attack Rating<br>RAW: `att%(_;20;20)`; Eth Rune: -25% Target Defense<br>RAW: `reduce-ac(_;25;25)` |
| 5 | Holy Thunder /`Runeword54` | Eth → Ral → Ort → Tal /4 | scep /— | 21 | 0 | 60% Enhanced Damage; Adds 20-60 Lightning Damage; +10 to Maximum Damage; Lightning Resist +60%; +5% to Maximum Lightning Resist; +3 to Holy Shock (native class only); Level 7 Chain Lightning (60 Charges)<br>RAW: `dmg%(_;60;60); dmg-ltng(_;20;60); dmg-max(_;10;10); res-ltng(_;60;60); res-ltng-max(_;5;5); skill(118;3;3); charged(53;60;7)` | **WEAPON**: Eth Rune: -25% Target Defense<br>RAW: `reduce-ac(_;25;25)`; Ral Rune: Adds 5-30 Fire Damage<br>RAW: `dmg-fire(_;5;30)`; Ort Rune: Adds 1-50 Lightning Damage<br>RAW: `dmg-ltng(_;1;50)`; Tal Rune: Approx. 75.1953 Poison Damage over 5s; authoritative rate 154–154/256 per frame<br>RAW: `dmg-pois(125;154;154)` |
| 6 | Honor /`Runeword55` | Amn → El → Ith → Tir → Sol /5 | mele /— | 27 | 0 | 160% Enhanced Damage; Replenish Life +10; +1 to All Skills; +200 to Attack Rating; 25% Deadly Strike; +10 to Strength<br>RAW: `dmg%(_;160;160); regen(_;10;10); allskills(_;1;1); att(_;200;200); deadly(_;25;25); str(_;10;10)` | **WEAPON**: Amn Rune: 7% Life Stolen per Hit<br>RAW: `lifesteal(_;7;7)`; El Rune: +1 to Light Radius; +50 to Attack Rating<br>RAW: `light(_;1;1); att(_;50;50)`; Ith Rune: +9 to Maximum Damage<br>RAW: `dmg-max(_;9;9)`; Tir Rune: +2 to Mana after each Kill<br>RAW: `mana-kill(_;2;2)`; Sol Rune: +9 to Minimum Damage<br>RAW: `dmg-min(_;9;9)` |
| 7 | King's Grace /`Runeword65` | Amn → Ral → Thul /3 | swor, scep /— | 25 | 0 | 100% Enhanced Damage; +150 to Attack Rating; +100% Damage to Demons; +50% Damage to Undead; +100 to Attack Rating against Demons; +100 to Attack Rating against Undead<br>RAW: `dmg%(_;100;100); att(_;150;150); dmg-demon(_;100;100); dmg-undead(_;50;50); att-demon(_;100;100); att-undead(_;100;100)` | **WEAPON**: Amn Rune: 7% Life Stolen per Hit<br>RAW: `lifesteal(_;7;7)`; Ral Rune: Adds 5-30 Fire Damage<br>RAW: `dmg-fire(_;5;30)`; Thul Rune: Adds 3-14 Cold Damage (3s chill)<br>RAW: `dmg-cold(75;3;14)` |
| 8 | Leaf /`Runeword72` | Tir → Ral /2 | staf /— | 19 | 0 | +3 to Fire Skills; +2 Defense per clvl (floor after scaling); Cold Resist +33%; +3 to Inferno (native class only); +3 to Fire Bolt (native class only); +3 to Warmth (native class only)<br>RAW: `fireskill(_;3;3); ac/lvl(_;16;16); res-cold(_;33;33); skill(41;3;3); skill(36;3;3); skill(37;3;3)` | **WEAPON**: Tir Rune: +2 to Mana after each Kill<br>RAW: `mana-kill(_;2;2)`; Ral Rune: Adds 5-30 Fire Damage<br>RAW: `dmg-fire(_;5;30)` |
| 9 | Lionheart /`Runeword74` | Hel → Lum → Fal /3 | tors /— | 41 | 0 | +15 to Strength; +20 to Vitality; +15 to Dexterity; 20% Enhanced Damage; +50 to Life; All Resistances +30<br>RAW: `str(_;15;15); vit(_;20;20); dex(_;15;15); dmg%(_;20;20); hp(_;50;50); res-all(_;30;30)` | **BODY/HELM**: Hel Rune: Requirements -15%<br>RAW: `ease(_;-15;-15)`; Lum Rune: +10 to Energy<br>RAW: `enr(_;10;10)`; Fal Rune: +10 to Strength<br>RAW: `str(_;10;10)` |
| 10 | Lore /`Runeword75` | Ort → Sol /2 | helm /— | 27 | 0 | +10 to Energy; +1 to All Skills; +2 to Light Radius; +2 to Mana after each Kill<br>RAW: `enr(_;10;10); allskills(_;1;1); light(_;2;2); mana-kill(_;2;2)` | **BODY/HELM**: Ort Rune: Lightning Resist +30%<br>RAW: `res-ltng(_;30;30)`; Sol Rune: Damage Reduced by 7<br>RAW: `red-dmg(_;7;7)` |
| 11 | Malice /`Runeword81` | Ith → El → Eth /3 | mele /— | 15 | 0 | 100% Chance of Open Wounds; -100 to Monster Defense Per Hit; Prevent Monster Heal; 33% Enhanced Damage; -1 to Light Radius; Replenish Life -5<br>RAW: `openwounds(_;100;100); dmg-ac(_;-100;-100); noheal(_;1;1); dmg%(_;33;33); light(_;-1;-1); regen(_;-5;-5)` | **WEAPON**: Ith Rune: +9 to Maximum Damage<br>RAW: `dmg-max(_;9;9)`; El Rune: +1 to Light Radius; +50 to Attack Rating<br>RAW: `light(_;1;1); att(_;50;50)`; Eth Rune: -25% Target Defense<br>RAW: `reduce-ac(_;25;25)` |
| 12 | Melody /`Runeword82` | Shael → Ko → Nef /3 | miss /— | 39 | 0 | 50% Enhanced Damage; +3 to Bow and Crossbow (Amazon) Skills; +3 to Critical Strike (native class only); +3 to Dodge (native class only); +3 to Slow Missiles (native class only); +300% Damage to Undead<br>RAW: `dmg%(_;50;50); skilltab(0;3;3); skill(9;3;3); skill(13;3;3); skill(17;3;3); dmg-undead(_;300;300)` | **WEAPON**: Shael Rune: +20% Increased Attack Speed<br>RAW: `swing2(_;20;20)`; Ko Rune: +10 to Dexterity<br>RAW: `dex(_;10;10)`; Nef Rune: Knockback<br>RAW: `knock(_;1;1)` |
| 13 | Memory /`Runeword83` | Lum → Io → Sol → Eth /4 | staf /— | 37 | 0 | Increase Maximum Mana 20%; Magic Damage Reduced by 7; 50% Enhanced Defense; +33% Faster Cast Rate; +3 to Sorceress Skill Levels; +3 to Energy Shield (native class only); +2 to Static Field (native class only)<br>RAW: `mana%(_;20;20); red-mag(_;7;7); ac%(_;50;50); cast2(_;33;33); sor(_;3;3); skill(58;3;3); skill(42;2;2)` | **WEAPON**: Lum Rune: +10 to Energy<br>RAW: `enr(_;10;10)`; Io Rune: +10 to Vitality<br>RAW: `vit(_;10;10)`; Sol Rune: +9 to Minimum Damage<br>RAW: `dmg-min(_;9;9)`; Eth Rune: -25% Target Defense<br>RAW: `reduce-ac(_;25;25)` |
| 14 | Nadir /`Runeword88` | Nef → Tir /2 | helm /— | 13 | 0 | 50% Enhanced Defense; +10 Defense; -3 to Light Radius; Level 13 Cloak of Shadows (9 Charges); -33% Extra Gold from Monsters; +5 to Strength<br>RAW: `ac%(_;50;50); ac(_;10;10); light(_;-3;-3); charged(264;9;13); gold%(_;-33;-33); str(_;5;5)` | **BODY/HELM**: Nef Rune: +30 Defense vs. Missile<br>RAW: `ac-miss(_;30;30)`; Tir Rune: +2 to Mana after each Kill<br>RAW: `mana-kill(_;2;2)` |
| 15 | Radiance /`Runeword116` | Nef → Sol → Ith /3 | helm /— | 27 | 0 | +5 to Light Radius; +10 to Energy; +10 to Vitality; Magic Damage Reduced by 3; +33 to Mana; 75% Enhanced Defense<br>RAW: `light(_;5;5); enr(_;10;10); vit(_;10;10); red-mag(_;3;3); mana(_;33;33); ac%(_;75;75)` | **BODY/HELM**: Nef Rune: +30 Defense vs. Missile<br>RAW: `ac-miss(_;30;30)`; Sol Rune: Damage Reduced by 7<br>RAW: `red-dmg(_;7;7)`; Ith Rune: 15% Damage Taken Goes To Mana<br>RAW: `dmg-to-mana(_;15;15)` |
| 16 | Rhyme /`Runeword120` | Shael → Eth /2 | shld /— | 29 | 0 | +20% Faster Block Rate; 20% Increased Chance of Blocking; All Resistances +25; Cannot Be Frozen; 50% Extra Gold from Monsters; 25% Better Chance of Getting Magic Items<br>RAW: `block2(_;20;20); block(_;20;20); res-all(_;25;25); nofreeze(_;1;1); gold%(_;50;50); mag%(_;25;25)` | **SHIELD**: Shael Rune: +20% Faster Block Rate<br>RAW: `block2(_;20;20)`; Eth Rune: Regenerate Mana 15%<br>RAW: `regen-mana(_;15;15)` |
| 17 | Silence /`Runeword126` | Dol → Eld → Hel → Ist → Tir → Vex /6 | weap /— | 55 | 0 | 4% Mana Stolen per Hit; Hit Blinds Target +33; 200% Enhanced Damage; +20% Increased Attack Speed; All Resistances +75; +2 to All Skills; +20% Faster Hit Recovery<br>RAW: `manasteal(_;4;4); stupidity(_;33;33); dmg%(_;200;200); swing2(_;20;20); res-all(_;75;75); allskills(_;2;2); balance2(_;20;20)` | **WEAPON**: Dol Rune: Hit Causes Monster to Flee 25% (raw /128 chance)<br>RAW: `howl(_;32;32)`; Eld Rune: +50 to Attack Rating against Undead; +75% Damage to Undead<br>RAW: `att-undead(_;50;50); dmg-undead(_;75;75)`; Hel Rune: Requirements -20%<br>RAW: `ease(_;-20;-20)`; Ist Rune: 30% Better Chance of Getting Magic Items<br>RAW: `mag%(_;30;30)`; Tir Rune: +2 to Mana after each Kill<br>RAW: `mana-kill(_;2;2)`; Vex Rune: 7% Mana Stolen per Hit<br>RAW: `manasteal(_;7;7)` |
| 18 | Smoke /`Runeword128` | Nef → Lum /2 | tors /— | 37 | 0 | +250 Defense vs. Missile; 75% Enhanced Defense; All Resistances +50; +20% Faster Hit Recovery; -1 to Light Radius; Level 6 Weaken (18 Charges)<br>RAW: `ac-miss(_;250;250); ac%(_;75;75); res-all(_;50;50); balance2(_;20;20); light(_;-1;-1); charged(72;18;6)` | **BODY/HELM**: Nef Rune: +30 Defense vs. Missile<br>RAW: `ac-miss(_;30;30)`; Lum Rune: +10 to Energy<br>RAW: `enr(_;10;10)` |
| 19 | Stealth /`Runeword133` | Tal → Eth /2 | tors /— | 17 | 0 | Magic Damage Reduced by 3; +6 to Dexterity; +15 Maximum Stamina; +25% Faster Run/Walk; +25% Faster Cast Rate; +25% Faster Hit Recovery<br>RAW: `red-mag(_;3;3); dex(_;6;6); stam(_;15;15); move2(_;25;25); cast2(_;25;25); balance2(_;25;25)` | **BODY/HELM**: Tal Rune: Poison Resist +30%<br>RAW: `res-pois(_;30;30)`; Eth Rune: Regenerate Mana 15%<br>RAW: `regen-mana(_;15;15)` |
| 20 | Steel /`Runeword134` | Tir → El /2 | swor, axe, mace /— | 13 | 0 | +25% Increased Attack Speed; +3 to Minimum Damage; +3 to Maximum Damage; 50% Chance of Open Wounds; 20% Enhanced Damage<br>RAW: `swing2(_;25;25); dmg-min(_;3;3); dmg-max(_;3;3); openwounds(_;50;50); dmg%(_;20;20)` | **WEAPON**: Tir Rune: +2 to Mana after each Kill<br>RAW: `mana-kill(_;2;2)`; El Rune: +1 to Light Radius; +50 to Attack Rating<br>RAW: `light(_;1;1); att(_;50;50)` |
| 21 | Strength /`Runeword139` | Amn → Tir /2 | mele /— | 25 | 0 | +20 to Strength; 35% Enhanced Damage; +10 to Vitality; 25% Chance of Crushing Blow<br>RAW: `str(_;20;20); dmg%(_;35;35); vit(_;10;10); crush(_;25;25)` | **WEAPON**: Amn Rune: 7% Life Stolen per Hit<br>RAW: `lifesteal(_;7;7)`; Tir Rune: +2 to Mana after each Kill<br>RAW: `mana-kill(_;2;2)` |
| 22 | Venom /`Runeword154` | Tal → Dol → Mal /3 | weap /— | 49 | 0 | Approx. 213.281 Poison Damage over 7s; authoritative rate 312–312/256 per frame; Ignore Target's Defense; Level 15 Poison Explosion (27 Charges); Level 13 Poison Nova (11 Charges); 7% Mana Stolen per Hit<br>RAW: `dmg-pois(175;312;312); ignore-ac(_;1;1); charged(83;27;15); charged(92;11;13); manasteal(_;7;7)` | **WEAPON**: Tal Rune: Approx. 75.1953 Poison Damage over 5s; authoritative rate 154–154/256 per frame<br>RAW: `dmg-pois(125;154;154)`; Dol Rune: Hit Causes Monster to Flee 25% (raw /128 chance)<br>RAW: `howl(_;32;32)`; Mal Rune: Prevent Monster Heal<br>RAW: `noheal(_;1;1)` |
| 23 | Wealth /`Runeword160` | Lem → Ko → Tir /3 | tors /— | 43 | 0 | 250% Extra Gold from Monsters; 100% Better Chance of Getting Magic Items<br>RAW: `gold%(_;250;250); mag%(_;100;100)` | **BODY/HELM**: Lem Rune: 50% Extra Gold from Monsters<br>RAW: `gold%(_;50;50)`; Ko Rune: +10 to Dexterity<br>RAW: `dex(_;10;10)`; Tir Rune: +2 to Mana after each Kill<br>RAW: `mana-kill(_;2;2)` |
| 24 | White /`Runeword162` | Dol → Io /2 | wand /— | 35 | 0 | +3 to Poison and Bone (Necromancer) Skills; Magic Damage Reduced by 4; +20% Faster Cast Rate; +13 to Mana; +3 to Bone Armor (native class only); +2 to Bone Spear (native class only); +4 to Skeleton Mastery (native class only)<br>RAW: `skilltab(7;3;3); red-mag(_;4;4); cast2(_;20;20); mana(_;13;13); skill(68;3;3); skill(84;2;2); skill(69;4;4)` | **WEAPON**: Dol Rune: Hit Causes Monster to Flee 25% (raw /128 chance)<br>RAW: `howl(_;32;32)`; Io Rune: +10 to Vitality<br>RAW: `vit(_;10;10)` |
| 25 | Zephyr /`Runeword170` | Ort → Eth /2 | miss /— | 21 | 0 | +25% Faster Run/Walk; +25% Increased Attack Speed; 33% Enhanced Damage; +66 to Attack Rating; 7% Chance to cast level 1 Twister when struck; +25 Defense<br>RAW: `move2(_;25;25); swing2(_;25;25); dmg%(_;33;33); att(_;66;66); gethit-skill(240;7;1); ac(_;25;25)` | **WEAPON**: Ort Rune: Adds 1-50 Lightning Damage<br>RAW: `dmg-ltng(_;1;50)`; Eth Rune: -25% Target Defense<br>RAW: `reduce-ac(_;25;25)` |
| 26 | Chains of Honor /`Runeword14` [source: Bound by Duty] | Dol → Um → Ber → Ist /4 | tors /— | 63 | 0 | All Resistances +50; 70% Enhanced Defense; +200% Damage to Demons; +100% Damage to Undead; 8% Life Stolen per Hit; +2 to All Skills; +20 to Strength<br>RAW: `res-all(_;50;50); ac%(_;70;70); dmg-demon(_;200;200); dmg-undead(_;100;100); lifesteal(_;8;8); allskills(_;2;2); str(_;20;20)` | **BODY/HELM**: Dol Rune: Replenish Life +7<br>RAW: `regen(_;7;7)`; Um Rune: All Resistances +15<br>RAW: `res-all(_;15;15)`; Ber Rune: Damage Reduced by 8%<br>RAW: `red-dmg%(_;8;8)`; Ist Rune: 25% Better Chance of Getting Magic Items<br>RAW: `mag%(_;25;25)` |
| 27 | Bramble /`Runeword9` | Ral → Ohm → Sur → Eth /4 | tors /— | 61 | 0 | +50% Faster Hit Recovery; +300 Defense; Level 15-21 Thorns Aura When Equipped; +13 Life after each Kill; +25-50% to Poison Skill Damage; Poison Resist +100%; Level 13 Spirit of Barbs (33 Charges)<br>RAW: `balance2(_;50;50); ac(_;300;300); aura(Thorns;15;21); heal-kill(_;13;13); extra-pois(_;25;50); res-pois(_;100;100); charged(Spirit of Barbs;33;13)` | **BODY/HELM**: Ral Rune: Fire Resist +30%<br>RAW: `res-fire(_;30;30)`; Ohm Rune: +5% to Maximum Cold Resist<br>RAW: `res-cold-max(_;5;5)`; Sur Rune: Increase Maximum Mana 5%<br>RAW: `mana%(_;5;5)`; Eth Rune: Regenerate Mana 15%<br>RAW: `regen-mana(_;15;15)` |
| 28 | Breath of the Dying /`Runeword11` | Vex → Hel → El → Eld → Zod → Eth /6 | weap /— | 69 | 0 | +60% Increased Attack Speed; +125% Damage to Undead; 12-15% Life Stolen per Hit; Prevent Monster Heal; 50% Chance to cast level 20 Poison Nova when you Kill an Enemy; 350-400% Enhanced Damage; +30 to All Attributes<br>RAW: `swing2(_;60;60); dmg-undead(_;125;125); lifesteal(_;12;15); noheal(_;1;1); kill-skill(Poison Nova;50;20); dmg%(_;350;400); all-stats(_;30;30)` | **WEAPON**: Vex Rune: 7% Mana Stolen per Hit<br>RAW: `manasteal(_;7;7)`; Hel Rune: Requirements -20%<br>RAW: `ease(_;-20;-20)`; El Rune: +1 to Light Radius; +50 to Attack Rating<br>RAW: `light(_;1;1); att(_;50;50)`; Eld Rune: +50 to Attack Rating against Undead; +75% Damage to Undead<br>RAW: `att-undead(_;50;50); dmg-undead(_;75;75)`; Zod Rune: Indestructible<br>RAW: `indestruct(_;1;1)`; Eth Rune: -25% Target Defense<br>RAW: `reduce-ac(_;25;25)` |
| 29 | Call to Arms /`Runeword13` | Amn → Ral → Mal → Ist → Ohm /5 | weap /— | 57 | 0 | +40% Increased Attack Speed; 200-240% Enhanced Damage; +1 to All Skills; +2-6 to Battle Command (oskill); +1-6 to Battle Orders (oskill); +1-4 to Battle Cry (oskill); Replenish Life +12<br>RAW: `swing2(_;40;40); dmg%(_;200;240); allskills(_;1;1); oskill(Battle Command;2;6); oskill(Battle Orders;1;6); oskill(Battle Cry;1;4); regen(_;12;12)` | **WEAPON**: Amn Rune: 7% Life Stolen per Hit<br>RAW: `lifesteal(_;7;7)`; Ral Rune: Adds 5-30 Fire Damage<br>RAW: `dmg-fire(_;5;30)`; Mal Rune: Prevent Monster Heal<br>RAW: `noheal(_;1;1)`; Ist Rune: 30% Better Chance of Getting Magic Items<br>RAW: `mag%(_;30;30)`; Ohm Rune: 50% Enhanced Damage<br>RAW: `dmg%(_;50;50)` |
| 30 | Crescent Moon /`Runeword17` | Shael → Um → Tir /3 | axe, swor, pole /— | 47 | 0 | -35% to Enemy Lightning Resistance; Ignore Target's Defense; 180-220% Enhanced Damage; +9-11 Magic Absorb; Level 18 Summon Spirit Wolf (30 Charges); 7% Chance to cast level 13 Static Field on striking; 10% Chance to cast level 17 Chain Lightning on striking<br>RAW: `pierce-ltng(_;35;35); ignore-ac(_;1;1); dmg%(_;180;220); abs-mag(_;9;11); charged(Summon Spirit Wolf;30;18); hit-skill(Static Field;7;13); hit-skill(Chain Lightning;10;17)` | **WEAPON**: Shael Rune: +20% Increased Attack Speed<br>RAW: `swing2(_;20;20)`; Um Rune: 25% Chance of Open Wounds<br>RAW: `openwounds(_;25;25)`; Tir Rune: +2 to Mana after each Kill<br>RAW: `mana-kill(_;2;2)` |
| 31 | Delirium /`Runeword22` | Lem → Ist → Io /3 | helm /— | 51 | 0 | 11% Chance to cast level 18 Confuse on striking; Level 17 Attract (60 Charges); 14% Chance to cast level 13 Terror when struck; +261 Defense; 6% Chance to cast level 14 Mind Blast when struck; 1% Chance to cast level 50 Delerium Change when struck; +2 to All Skills<br>RAW: `hit-skill(Confuse;11;18); charged(Attract;60;17); gethit-skill(Terror;14;13); ac(_;261;261); gethit-skill(Mind Blast;6;14); gethit-skill(Delerium Change;1;50); allskills(_;2;2)` | **BODY/HELM**: Lem Rune: 50% Extra Gold from Monsters<br>RAW: `gold%(_;50;50)`; Ist Rune: 25% Better Chance of Getting Magic Items<br>RAW: `mag%(_;25;25)`; Io Rune: +10 to Vitality<br>RAW: `vit(_;10;10)` |
| 32 | Doom /`Runeword26` [source: Doomsayer] | Hel → Ohm → Um → Lo → Cham /5 | axe, pole, hamm /— | 67 | 0 | 280-320% Enhanced Damage; Level 12 Holy Freeze Aura When Equipped; +45% Increased Attack Speed; Prevent Monster Heal; -40-60% to Enemy Cold Resistance; +2 to All Skills; 5% Chance to cast level 18 Volcano on striking<br>RAW: `dmg%(_;280;320); aura(Holy Freeze;12;12); swing2(_;45;45); noheal(_;1;1); pierce-cold(_;40;60); allskills(_;2;2); hit-skill(Volcano;5;18)` | **WEAPON**: Hel Rune: Requirements -20%<br>RAW: `ease(_;-20;-20)`; Ohm Rune: 50% Enhanced Damage<br>RAW: `dmg%(_;50;50)`; Um Rune: 25% Chance of Open Wounds<br>RAW: `openwounds(_;25;25)`; Lo Rune: 20% Deadly Strike<br>RAW: `deadly(_;20;20)`; Cham Rune: Freezes Target +3<br>RAW: `freeze(_;3;3)` |
| 33 | Enigma /`Runeword33` | Jah → Ith → Ber /3 | tors /— | 65 | 0 | +750-775 Defense; +14 Life after each Kill; +45% Faster Run/Walk; +0.75 Strength per clvl (floor after scaling); +2 to All Skills; +1 % Magic Find per clvl (floor after scaling); +1 to Teleport (oskill)<br>RAW: `ac(_;750;775); heal-kill(_;14;14); move2(_;45;45); str/lvl(6;_;_); allskills(_;2;2); mag%/lvl(8;_;_); oskill(Teleport;1;1)` | **BODY/HELM**: Jah Rune: Increase Maximum Life 5%<br>RAW: `hp%(_;5;5)`; Ith Rune: 15% Damage Taken Goes To Mana<br>RAW: `dmg-to-mana(_;15;15)`; Ber Rune: Damage Reduced by 8%<br>RAW: `red-dmg%(_;8;8)` |
| 34 | Stone /`Runeword137` | Shael → Um → Pul → Lum /4 | tors /— | 47 | 0 | 220-260% Enhanced Defense; Level 16 Clay Golem (16 Charges); +300 Defense vs. Missile; Level 16 Molten Boulder (80 Charges); +16 to Strength; +16 to Vitality; +40% Faster Hit Recovery<br>RAW: `ac%(_;220;260); charged(Clay Golem;16;16); ac-miss(_;300;300); charged(Molten Boulder;80;16); str(_;16;16); vit(_;16;16); balance2(_;40;40)` | **BODY/HELM**: Shael Rune: +20% Faster Hit Recovery<br>RAW: `balance2(_;20;20)`; Um Rune: All Resistances +15<br>RAW: `res-all(_;15;15)`; Pul Rune: 30% Enhanced Defense<br>RAW: `ac%(_;30;30)`; Lum Rune: +10 to Energy<br>RAW: `enr(_;10;10)` |
| 35 | Eternity /`Runeword36` | Amn → Ber → Ist → Sol → Sur /5 | mele /— | 63 | 0 | 260-310% Enhanced Damage; Indestructible; Slows Target by 33%; Level 8 Revive (88 Charges); Replenish Life +16; Regenerate Mana 16%; Cannot Be Frozen<br>RAW: `dmg%(_;260;310); indestruct(_;1;1); slow(_;33;33); charged(Revive;88;8); regen(_;16;16); regen-mana(_;16;16); nofreeze(_;1;1)` | **WEAPON**: Amn Rune: 7% Life Stolen per Hit<br>RAW: `lifesteal(_;7;7)`; Ber Rune: 20% Chance of Crushing Blow<br>RAW: `crush(_;20;20)`; Ist Rune: 30% Better Chance of Getting Magic Items<br>RAW: `mag%(_;30;30)`; Sol Rune: +9 to Minimum Damage<br>RAW: `dmg-min(_;9;9)`; Sur Rune: Hit Blinds Target +1<br>RAW: `stupidity(_;1;1)` |
| 36 | Exile /`Runeword37` [source: Exile's Path] | Vex → Ohm → Ist → Dol /4 | pala /— | 57 | 0 | +30% Faster Block Rate; Freezes Target +1; 220-260% Enhanced Defense; Level 13-16 Defiance Aura When Equipped; +2 to Offensive Auras (Paladin) Skills; 15% Chance to cast level 5 Life Tap on striking; Repairs 1 Durability every 4s (rate 25)<br>RAW: `block2(_;30;30); freeze(_;1;1); ac%(_;220;260); aura(Defiance;13;16); skilltab(10;2;2); hit-skill(Life Tap;15;5); rep-dur(25;_;_)` | **SHIELD**: Vex Rune: +5% to Maximum Fire Resist<br>RAW: `res-fire-max(_;5;5)`; Ohm Rune: +5% to Maximum Cold Resist<br>RAW: `res-cold-max(_;5;5)`; Ist Rune: 25% Better Chance of Getting Magic Items<br>RAW: `mag%(_;25;25)`; Dol Rune: Replenish Life +7<br>RAW: `regen(_;7;7)` |
| 37 | Famine /`Runeword39` | Fal → Ohm → Ort → Jah /4 | axe, hamm /— | 65 | 0 | 270-320% Enhanced Damage; 12% Life Stolen per Hit; +30% Increased Attack Speed; Prevent Monster Heal; Adds 180-200 Magic Damage; Adds 50-200 Fire/Lightning/Cold Damage (cold dur 100 frames); Ethereal (cannot be repaired)<br>RAW: `dmg%(_;270;320); lifesteal(_;12;12); swing2(_;30;30); noheal(_;1;1); dmg-mag(_;180;200); dmg-elem(100;50;200); ethereal(_;1;1)` | **WEAPON**: Fal Rune: +10 to Strength<br>RAW: `str(_;10;10)`; Ohm Rune: 50% Enhanced Damage<br>RAW: `dmg%(_;50;50)`; Ort Rune: Adds 1-50 Lightning Damage<br>RAW: `dmg-ltng(_;1;50)`; Jah Rune: Ignore Target's Defense<br>RAW: `ignore-ac(_;1;1)` |
| 38 | Hand of Justice /`Runeword48` | Sur → Cham → Amn → Lo /4 | weap /— | 67 | 0 | +33% Increased Attack Speed; 280-330% Enhanced Damage; Level 16 Holy Fire Aura When Equipped; 100% Chance to cast level 36 Blaze when you Level-Up; 100% Chance to cast level 48 Meteor when you Die; Ignore Target's Defense; -20% to Enemy Fire Resistance<br>RAW: `swing2(_;33;33); dmg%(_;280;330); aura(Holy Fire;16;16); levelup-skill(Blaze;100;36); death-skill(Meteor;100;48); ignore-ac(_;1;1); pierce-fire(_;20;20)` | **WEAPON**: Sur Rune: Hit Blinds Target +1<br>RAW: `stupidity(_;1;1)`; Cham Rune: Freezes Target +3<br>RAW: `freeze(_;3;3)`; Amn Rune: 7% Life Stolen per Hit<br>RAW: `lifesteal(_;7;7)`; Lo Rune: 20% Deadly Strike<br>RAW: `deadly(_;20;20)` |
| 39 | Heart of the Oak /`Runeword51` | Ko → Vex → Pul → Thul /4 | staf, mace /— | 55 | 0 | +40% Faster Cast Rate; Level 4 Oak Sage (25 Charges); Increase Maximum Mana 15%; +3 to All Skills; Replenish Life +20; All Resistances +30-40; Level 14 Raven (60 Charges)<br>RAW: `cast2(_;40;40); charged(Oak Sage;25;4); mana%(_;15;15); allskills(_;3;3); regen(_;20;20); res-all(_;30;40); charged(Raven;60;14)` | **WEAPON**: Ko Rune: +10 to Dexterity<br>RAW: `dex(_;10;10)`; Vex Rune: 7% Mana Stolen per Hit<br>RAW: `manasteal(_;7;7)`; Pul Rune: +100 to Attack Rating against Demons; +75% Damage to Demons<br>RAW: `att-demon(_;100;100); dmg-demon(_;75;75)`; Thul Rune: Adds 3-14 Cold Damage (3s chill)<br>RAW: `dmg-cold(75;3;14)` |
| 40 | Kingslayer /`Runeword66` | Mal → Um → Gul → Fal /4 | swor, axe /— | 53 | 0 | +30% Increased Attack Speed; 230-270% Enhanced Damage; -25% Target Defense; 33% Chance of Crushing Blow; 25% Chance of Open Wounds; +1 to Vengeance (oskill); 40% Extra Gold from Monsters<br>RAW: `swing2(_;30;30); dmg%(_;230;270); reduce-ac(_;25;25); crush(_;33;33); openwounds(_;25;25); oskill(Vengeance;1;1); gold%(_;40;40)` | **WEAPON**: Mal Rune: Prevent Monster Heal<br>RAW: `noheal(_;1;1)`; Um Rune: 25% Chance of Open Wounds<br>RAW: `openwounds(_;25;25)`; Gul Rune: 20% Bonus to Attack Rating<br>RAW: `att%(_;20;20)`; Fal Rune: +10 to Strength<br>RAW: `str(_;10;10)` |
| 41 | Passion /`Runeword95` | Dol → Ort → Eld → Lem /4 | weap /— | 43 | 0 | 160-210% Enhanced Damage; +1 to Zeal (oskill); 50-80% Bonus to Attack Rating; +1 to Berserk (oskill); +25% Increased Attack Speed; Level 3 Heart of Wolverine (12 Charges); Hit Blinds Target +10<br>RAW: `dmg%(_;160;210); oskill(Zeal;1;1); att%(_;50;80); oskill(Berserk;1;1); swing2(_;25;25); charged(Heart of Wolverine;12;3); stupidity(_;10;10)` | **WEAPON**: Dol Rune: Hit Causes Monster to Flee 25% (raw /128 chance)<br>RAW: `howl(_;32;32)`; Ort Rune: Adds 1-50 Lightning Damage<br>RAW: `dmg-ltng(_;1;50)`; Eld Rune: +50 to Attack Rating against Undead; +75% Damage to Undead<br>RAW: `att-undead(_;50;50); dmg-undead(_;75;75)`; Lem Rune: 75% Extra Gold from Monsters<br>RAW: `gold%(_;75;75)` |
| 42 | Gloom /`Runeword45` | Fal → Um → Pul /3 | tors /— | 47 | 0 | 170-230% Enhanced Defense; All Resistances +30; 15% Chance to cast level 3 Dim Vision when struck; +10% Faster Hit Recovery; 5% Damage Taken Goes To Mana; -3 to Light Radius; Half Freeze Duration<br>RAW: `ac%(_;170;230); res-all(_;30;30); gethit-skill(Dim Vision;15;3); balance2(_;10;10); dmg-to-mana(_;5;5); light(_;-3;-3); half-freeze(_;1;1)` | **BODY/HELM**: Fal Rune: +10 to Strength<br>RAW: `str(_;10;10)`; Um Rune: All Resistances +15<br>RAW: `res-all(_;15;15)`; Pul Rune: 30% Enhanced Defense<br>RAW: `ac%(_;30;30)` |
| 43 | Sanctuary /`Runeword122` | Ko → Ko → Mal /3 | shld /— | 49 | 0 | 20% Increased Chance of Blocking; +20% Faster Block Rate; 130-160% Enhanced Defense; +250 Defense vs. Missile; All Resistances +50-70; +20% Faster Hit Recovery; Level 12 Slow Missiles (60 Charges)<br>RAW: `block(_;20;20); block2(_;20;20); ac%(_;130;160); ac-miss(_;250;250); res-all(_;50;70); balance2(_;20;20); charged(Slow Missiles;60;12)` | **SHIELD**: Ko Rune: +10 to Dexterity<br>RAW: `dex(_;10;10)`; Ko Rune: +10 to Dexterity<br>RAW: `dex(_;10;10)`; Mal Rune: Magic Damage Reduced by 7<br>RAW: `red-mag(_;7;7)` |
| 44 | Chaos /`Runeword16` | Fal → Ohm → Um /3 | h2h /— | 57 | 0 | +15 Life after each Demon Kill; 240-290% Enhanced Damage; Adds 216-471 Magic Damage; +1 to Whirlwind (oskill); +35% Increased Attack Speed; 9% Chance to cast level 11 Frozen Orb on striking; 11% Chance to cast level 9 Charged Bolt on striking<br>RAW: `demon-heal(_;15;15); dmg%(_;240;290); dmg-mag(_;216;471); oskill(Whirlwind;1;1); swing2(_;35;35); hit-skill(Frozen Orb;9;11); hit-skill(Charged Bolt;11;9)` | **WEAPON**: Fal Rune: +10 to Strength<br>RAW: `str(_;10;10)`; Ohm Rune: 50% Enhanced Damage<br>RAW: `dmg%(_;50;50)`; Um Rune: 25% Chance of Open Wounds<br>RAW: `openwounds(_;25;25)` |
| 45 | Beast /`Runeword4` [source: The Beast] | Ber → Tir → Um → Mal → Lum /5 | axe, scep, hamm /— | 63 | 0 | +40% Increased Attack Speed; Level 9 Fanaticism Aura When Equipped; 240-270% Enhanced Damage; +25-40 to Strength; Level 13 Summon Grizzly (5 Charges); +3 to Werebear (oskill); +3 to Lycanthropy (oskill)<br>RAW: `swing2(_;40;40); aura(Fanaticism;9;9); dmg%(_;240;270); str(_;25;40); charged(Summon Grizzly;5;13); oskill(Wearbear;3;3); oskill(Shape Shifting;3;3)` | **WEAPON**: Ber Rune: 20% Chance of Crushing Blow<br>RAW: `crush(_;20;20)`; Tir Rune: +2 to Mana after each Kill<br>RAW: `mana-kill(_;2;2)`; Um Rune: 25% Chance of Open Wounds<br>RAW: `openwounds(_;25;25)`; Mal Rune: Prevent Monster Heal<br>RAW: `noheal(_;1;1)`; Lum Rune: +10 to Energy<br>RAW: `enr(_;10;10)` |
| 51 | Spirit /`Runeword130` | Tal → Thul → Ort → Amn /4 | swor, shld /— | 25 | 1 | +55% Faster Hit Recovery; +89-112 to Mana; +250 Defense vs. Missile; +22 to Vitality; +25-35% Faster Cast Rate; +3-8 Magic Absorb; +2 to All Skills<br>RAW: `balance3(_;55;55); mana(_;89;112); ac-miss(_;250;250); vit(_;22;22); cast3(_;25;35); abs-mag(_;3;8); allskills(_;2;2)` | **WEAPON**: Tal Rune: Approx. 75.1953 Poison Damage over 5s; authoritative rate 154–154/256 per frame<br>RAW: `dmg-pois(125;154;154)`; Thul Rune: Adds 3-14 Cold Damage (3s chill)<br>RAW: `dmg-cold(75;3;14)`; Ort Rune: Adds 1-50 Lightning Damage<br>RAW: `dmg-ltng(_;1;50)`; Amn Rune: 7% Life Stolen per Hit<br>RAW: `lifesteal(_;7;7)`<br>**SHIELD**: Tal Rune: Poison Resist +35%<br>RAW: `res-pois(_;35;35)`; Thul Rune: Cold Resist +35%<br>RAW: `res-cold(_;35;35)`; Ort Rune: Lightning Resist +35%<br>RAW: `res-ltng(_;35;35)`; Amn Rune: Attacker Takes Damage of 14<br>RAW: `thorns(_;14;14)` |
| 52 | Splendor /`Runeword131` | Eth → Lum /2 | shld /— | 37 | 0 | +3 to Light Radius; 50% Extra Gold from Monsters; 20% Better Chance of Getting Magic Items; 60-100% Enhanced Defense; +20% Faster Block Rate; +10% Faster Cast Rate; +1 to All Skills<br>RAW: `light(_;3;3); gold%(_;50;50); mag%(_;20;20); ac%(_;60;100); block2(_;20;20); cast2(_;10;10); allskills(_;1;1)` | **SHIELD**: Eth Rune: Regenerate Mana 15%<br>RAW: `regen-mana(_;15;15)`; Lum Rune: +10 to Energy<br>RAW: `enr(_;10;10)` |
| 55 | Duress /`Runeword30` | Shael → Um → Thul /3 | tors /— | 47 | 0 | Adds 37-133 Cold Damage (2s chill); 10-20% Enhanced Damage; 150-200% Enhanced Defense; +20% Faster Hit Recovery; 33% Chance of Open Wounds; 15% Chance of Crushing Blow; -20% Slower Stamina Drain<br>RAW: `dmg-cold(50;37;133); dmg%(_;10;20); ac%(_;150;200); balance2(_;20;20); openwounds(_;33;33); crush(_;15;15); stamdrain(_;-20;-20)` | **BODY/HELM**: Shael Rune: +20% Faster Hit Recovery<br>RAW: `balance2(_;20;20)`; Um Rune: All Resistances +15<br>RAW: `res-all(_;15;15)`; Thul Rune: Cold Resist +30%<br>RAW: `res-cold(_;30;30)` |
| 61 | Oath /`Runeword91` | Shael → Pul → Mal → Lum /4 | swor, axe, mace /— | 49 | 1 | 210-340% Enhanced Damage; +30% Increased Attack Speed; 30% Chance to cast level 20 Bone Spirit on striking; Level 17 Iron Golem (14 Charges); Level 16 Heart of Wolverine (20 Charges); +10-15 Magic Absorb; Indestructible<br>RAW: `dmg%(_;210;340); swing1(_;30;30); hit-skill(Bone Spirit;30;20); charged(IronGolem;14;17); charged(Heart of Wolverine;20;16); abs-mag(_;10;15); indestruct(_;1;1)` | **WEAPON**: Shael Rune: +20% Increased Attack Speed<br>RAW: `swing2(_;20;20)`; Pul Rune: +100 to Attack Rating against Demons; +75% Damage to Demons<br>RAW: `att-demon(_;100;100); dmg-demon(_;75;75)`; Mal Rune: Prevent Monster Heal<br>RAW: `noheal(_;1;1)`; Lum Rune: +10 to Energy<br>RAW: `enr(_;10;10)` |
| 62 | Obedience /`Runeword92` | Hel → Ko → Thul → Eth → Fal /5 | pole /— | 41 | 1 | 370% Enhanced Damage; 40% Chance of Crushing Blow; 30% Chance to cast level 21 enchant when you Kill an Enemy; -25% to Enemy Fire Resistance; +200-300 Defense; +40% Faster Hit Recovery; All Resistances +20-30<br>RAW: `dmg%(_;370;370); crush(_;40;40); kill-skill(enchant;30;21); pierce-fire(_;25;25); ac(_;200;300); balance3(_;40;40); res-all(_;20;30)` | **WEAPON**: Hel Rune: Requirements -20%<br>RAW: `ease(_;-20;-20)`; Ko Rune: +10 to Dexterity<br>RAW: `dex(_;10;10)`; Thul Rune: Adds 3-14 Cold Damage (3s chill)<br>RAW: `dmg-cold(75;3;14)`; Eth Rune: -25% Target Defense<br>RAW: `reduce-ac(_;25;25)`; Fal Rune: +10 to Strength<br>RAW: `str(_;10;10)` |
| 65 | Harmony /`Runeword49` | Tir → Ith → Sol → Ko /4 | miss /— | 39 | 1 | 200-275% Enhanced Damage; Adds 55-160 Fire/Lightning/Cold Damage (cold dur  frames); Level 20 Revive (25 Charges); Level 10 Vigor Aura When Equipped; +2-6 to Valkyrie (oskill); Regenerate Mana 20%; +2 to Light Radius<br>RAW: `dmg%(_;200;275); dmg-elem(_;55;160); charged(Revive;25;20); aura(Vigor;10;10); oskill(Valkyrie;2;6); regen-mana(_;20;20); light(_;2;2)` | **WEAPON**: Tir Rune: +2 to Mana after each Kill<br>RAW: `mana-kill(_;2;2)`; Ith Rune: +9 to Maximum Damage<br>RAW: `dmg-max(_;9;9)`; Sol Rune: +9 to Minimum Damage<br>RAW: `dmg-min(_;9;9)`; Ko Rune: +10 to Dexterity<br>RAW: `dex(_;10;10)` |
| 68 | Fortitude /`Runeword41` | El → Sol → Dol → Lo /4 | weap, tors /— | 59 | 1 | 200% Enhanced Defense; 300% Enhanced Damage; +25% Faster Cast Rate; 20% Chance to cast level 15 Chilling Armor when struck; 12% Damage Taken Goes To Mana; +1–1.5 Life per clvl (floor after scaling); All Resistances +25-30<br>RAW: `ac%(_;200;200); dmg%(_;300;300); cast3(_;25;25); gethit-skill(Chilling Armor;20;15); dmg-to-mana(_;12;12); hp/lvl(_;8;12); res-all(_;25;30)` | **WEAPON**: El Rune: +1 to Light Radius; +50 to Attack Rating<br>RAW: `light(_;1;1); att(_;50;50)`; Sol Rune: +9 to Minimum Damage<br>RAW: `dmg-min(_;9;9)`; Dol Rune: Hit Causes Monster to Flee 25% (raw /128 chance)<br>RAW: `howl(_;32;32)`; Lo Rune: 20% Deadly Strike<br>RAW: `deadly(_;20;20)`<br>**BODY/HELM**: El Rune: +1 to Light Radius; +15 Defense<br>RAW: `light(_;1;1); ac(_;15;15)`; Sol Rune: Damage Reduced by 7<br>RAW: `red-dmg(_;7;7)`; Dol Rune: Replenish Life +7<br>RAW: `regen(_;7;7)`; Lo Rune: +5% to Maximum Lightning Resist<br>RAW: `res-ltng-max(_;5;5)` |
| 72 | Faith /`Runeword38` | Ohm → Jah → Lem → Eld /4 | miss /— | 65 | 1 | 280% Enhanced Damage; 300% Bonus to Attack Rating; Adds 120-120 Fire Damage; All Resistances +15; Level 12-15 fanaticism Aura When Equipped; 10% Reanimate as Returned (monsterid1); +1-2 to All Skills<br>RAW: `dmg%(_;280;280); att%(_;300;300); dmg-fire(_;120;120); res-all(_;15;15); aura(fanaticism;12;15); reanimate(1;10;10); allskills(_;1;2)` | **WEAPON**: Ohm Rune: 50% Enhanced Damage<br>RAW: `dmg%(_;50;50)`; Jah Rune: Ignore Target's Defense<br>RAW: `ignore-ac(_;1;1)`; Lem Rune: 75% Extra Gold from Monsters<br>RAW: `gold%(_;75;75)`; Eld Rune: +50 to Attack Rating against Undead; +75% Damage to Undead<br>RAW: `att-undead(_;50;50); dmg-undead(_;75;75)` |
| 78 | Bone /`Runeword8` | Sol → Um → Um /3 | tors /— | 47 | 0 | 15% Chance to cast level 10 Bone Spear on striking; 15% Chance to cast level 10 Bone Armor when struck; +2 to Necromancer Skill Levels; +100-150 to Mana<br>RAW: `hit-skill(Bone Spear;15;10); gethit-skill(Bone Armor;15;10); nec(_;2;2); mana(_;100;150)` | **BODY/HELM**: Sol Rune: Damage Reduced by 7<br>RAW: `red-dmg(_;7;7)`; Um Rune: All Resistances +15<br>RAW: `res-all(_;15;15)`; Um Rune: All Resistances +15<br>RAW: `res-all(_;15;15)` |
| 79 | Brand /`Runeword10` | Jah → Lo → Mal → Gul /4 | miss /— | 65 | 1 | 260-340% Enhanced Damage; +280-330% Damage to Demons; 100% Chance to cast level 18 Bone Spear on striking; 35% Chance to cast level 14 Amplify Damage when struck; Knockback; Prevent Monster Heal; Fires Explosive Arrows or Bolts (level 15)<br>RAW: `dmg%(_;260;340); dmg-demon(_;280;330); hit-skill(Bone Spear;100;18); gethit-skill(Amplify Damage;35;14); knock(_;1;1); noheal(_;1;1); explosivearrow(_;15;15)` | **WEAPON**: Jah Rune: Ignore Target's Defense<br>RAW: `ignore-ac(_;1;1)`; Lo Rune: 20% Deadly Strike<br>RAW: `deadly(_;20;20)`; Mal Rune: Prevent Monster Heal<br>RAW: `noheal(_;1;1)`; Gul Rune: 20% Bonus to Attack Rating<br>RAW: `att%(_;20;20)` |
| 85 | Death /`Runeword20` | Hel → El → Vex → Ort → Gul /5 | swor, axe /— | 55 | 1 | 300-385% Enhanced Damage; +0.5 % Deadly Strike per clvl (floor after scaling); Level 22 Blood Golem (15 Charges); 25% Chance to cast level 18 Glacial Spike on attack; 100% Chance to cast level 44 Chain Lightning when you Die; 50% Chance of Crushing Blow; Indestructible<br>RAW: `dmg%(_;300;385); deadly/lvl(4;_;_); charged(BloodGolem;15;22); att-skill(Glacial Spike;25;18); death-skill(Chain Lightning;100;44); crush(_;50;50); indestruct(_;1;1)` | **WEAPON**: Hel Rune: Requirements -20%<br>RAW: `ease(_;-20;-20)`; El Rune: +1 to Light Radius; +50 to Attack Rating<br>RAW: `light(_;1;1); att(_;50;50)`; Vex Rune: 7% Mana Stolen per Hit<br>RAW: `manasteal(_;7;7)`; Ort Rune: Adds 1-50 Lightning Damage<br>RAW: `dmg-ltng(_;1;50)`; Gul Rune: 20% Bonus to Attack Rating<br>RAW: `att%(_;20;20)` |
| 90 | Destruction /`Runeword25` | Vex → Lo → Ber → Jah → Ko /5 | pole, swor /— | 65 | 1 | 350% Enhanced Damage; Adds 100-180 Magic Damage; 5% Chance to cast level 23 Molten Boulder on striking; 100% Chance to cast level 45 Meteor when you Die; 15% Chance to cast level 22 Nova on attack; 23% Chance to cast level 12 Volcano on striking; Prevent Monster Heal<br>RAW: `dmg%(_;350;350); dmg-mag(_;100;180); hit-skill(Molten Boulder;5;23); death-skill(Meteor;100;45); att-skill(Nova;15;22); hit-skill(Volcano;23;12); noheal(_;1;1)` | **WEAPON**: Vex Rune: 7% Mana Stolen per Hit<br>RAW: `manasteal(_;7;7)`; Lo Rune: 20% Deadly Strike<br>RAW: `deadly(_;20;20)`; Ber Rune: 20% Chance of Crushing Blow<br>RAW: `crush(_;20;20)`; Jah Rune: Ignore Target's Defense<br>RAW: `ignore-ac(_;1;1)`; Ko Rune: +10 to Dexterity<br>RAW: `dex(_;10;10)` |
| 91 | Dragon /`Runeword27` | Sur → Lo → Sol /3 | tors, shld /— | 61 | 1 | +360 Defense; +230 Defense vs. Missile; +0.375 Strength per clvl (floor after scaling); 12% Chance to cast level 15 Hydra on striking; 20% Chance to cast level 18 Venom when struck; Level 14 Holy Fire Aura When Equipped; +3-5 to All Attributes<br>RAW: `ac(_;360;360); ac-miss(_;230;230); str/lvl(3;_;_); hit-skill(Hydra;12;15); gethit-skill(Venom;20;18); aura(Holy Fire;14;14); all-stats(_;3;5)` | **BODY/HELM**: Sur Rune: Increase Maximum Mana 5%<br>RAW: `mana%(_;5;5)`; Lo Rune: +5% to Maximum Lightning Resist<br>RAW: `res-ltng-max(_;5;5)`; Sol Rune: Damage Reduced by 7<br>RAW: `red-dmg(_;7;7)`<br>**SHIELD**: Sur Rune: +50 to Mana<br>RAW: `mana(_;50;50)`; Lo Rune: +5% to Maximum Lightning Resist<br>RAW: `res-ltng-max(_;5;5)`; Sol Rune: Damage Reduced by 7<br>RAW: `red-dmg(_;7;7)` |
| 93 | Dream /`Runeword29` | Io → Jah → Pul /3 | helm, shld /— | 65 | 1 | +150-220 Defense; 10% Chance to cast level 15 Confuse when struck; +0.625 Mana per clvl (floor after scaling); All Resistances +5-20; +20-30% Faster Hit Recovery; Level 15 Holy Shock Aura When Equipped; 12-25% Better Chance of Getting Magic Items<br>RAW: `ac(_;150;220); gethit-skill(Confuse;10;15); mana/lvl(5;_;_); res-all(_;5;20); balance3(_;20;30); aura(Holy Shock;15;15); mag%(_;12;25)` | **BODY/HELM**: Io Rune: +10 to Vitality<br>RAW: `vit(_;10;10)`; Jah Rune: Increase Maximum Life 5%<br>RAW: `hp%(_;5;5)`; Pul Rune: 30% Enhanced Defense<br>RAW: `ac%(_;30;30)`<br>**SHIELD**: Io Rune: +10 to Vitality<br>RAW: `vit(_;10;10)`; Jah Rune: +50 to Life<br>RAW: `hp(_;50;50)`; Pul Rune: 30% Enhanced Defense<br>RAW: `ac%(_;30;30)` |
| 95 | Edge /`Runeword31` | Tir → Tal → Amn /3 | miss /— | 25 | 1 | +320-380% Damage to Demons; +280% Damage to Undead; +35% Increased Attack Speed; Prevent Monster Heal; Level 15 Thorns Aura When Equipped; +5-10 to All Attributes; Reduces All Vendor Prices 15%<br>RAW: `dmg-demon(_;320;380); dmg-undead(_;280;280); swing2(_;35;35); noheal(_;1;1); aura(Thorns;15;15); all-stats(_;5;10); cheap(_;15;15)` | **WEAPON**: Tir Rune: +2 to Mana after each Kill<br>RAW: `mana-kill(_;2;2)`; Tal Rune: Approx. 75.1953 Poison Damage over 5s; authoritative rate 154–154/256 per frame<br>RAW: `dmg-pois(125;154;154)`; Amn Rune: 7% Life Stolen per Hit<br>RAW: `lifesteal(_;7;7)` |
| 96 | Enlightenment /`Runeword34` | Pul → Ral → Sol /3 | tors /— | 45 | 0 | 5% Chance to cast level 15 Fire Ball on striking; 5% Chance to cast level 15 Blaze when struck; +2 to Sorceress Skill Levels; +1 to Warmth (oskill)<br>RAW: `hit-skill(Fire Ball;5;15); gethit-skill(Blaze;5;15); sor(_;2;2); oskill(Warmth;1;1)` | **BODY/HELM**: Pul Rune: 30% Enhanced Defense<br>RAW: `ac%(_;30;30)`; Ral Rune: Fire Resist +30%<br>RAW: `res-fire(_;30;30)`; Sol Rune: Damage Reduced by 7<br>RAW: `red-dmg(_;7;7)` |
| 102 | Ice /`Runeword59` | Amn → Shael → Jah → Lo /4 | miss /— | 65 | 1 | 140-210% Enhanced Damage; Level 18 Holy Freeze Aura When Equipped; +25-30% to Cold Skill Damage; 25% Chance to cast level 22 Frost Nova on striking; 100% Chance to cast level 40 Blizzard when you Level-Up; -20% to Enemy Cold Resistance; +3.125 % Extra Gold per clvl (floor after scaling)<br>RAW: `dmg%(_;140;210); aura(Holy Freeze;18;18); extra-cold(_;25;30); hit-skill(Frost Nova;25;22); levelup-skill(Blizzard;100;40); pierce-cold(_;20;20); gold%/lvl(25;_;_)` | **WEAPON**: Amn Rune: 7% Life Stolen per Hit<br>RAW: `lifesteal(_;7;7)`; Shael Rune: +20% Increased Attack Speed<br>RAW: `swing2(_;20;20)`; Jah Rune: Ignore Target's Defense<br>RAW: `ignore-ac(_;1;1)`; Lo Rune: 20% Deadly Strike<br>RAW: `deadly(_;20;20)` |
| 103 | Infinity /`Runeword60` | Ber → Mal → Ber → Ist /4 | pole /— | 63 | 1 | 255-325% Enhanced Damage; +35% Faster Run/Walk; +0.5 Vitality per clvl (floor after scaling); Level 12 Conviction Aura When Equipped; 50% Chance to cast level 20 Chain Lightning when you Kill an Enemy; -45-55% to Enemy Lightning Resistance; Level 21 Cyclone Armor (30 Charges)<br>RAW: `dmg%(_;255;325); move3(_;35;35); vit/lvl(4;_;_); aura(Conviction;12;12); kill-skill(Chain Lightning;50;20); pierce-ltng(_;45;55); charged(Cyclone Armor;30;21)` | **WEAPON**: Ber Rune: 20% Chance of Crushing Blow<br>RAW: `crush(_;20;20)`; Mal Rune: Prevent Monster Heal<br>RAW: `noheal(_;1;1)`; Ber Rune: 20% Chance of Crushing Blow<br>RAW: `crush(_;20;20)`; Ist Rune: 30% Better Chance of Getting Magic Items<br>RAW: `mag%(_;30;30)` |
| 105 | Insight /`Runeword62` | Ral → Tir → Tal → Sol /4 | pole, staf /— | 27 | 1 | 200-260% Enhanced Damage; 180-250% Bonus to Attack Rating; 23% Better Chance of Getting Magic Items; +1-6 to Critical Strike (oskill); +35% Faster Cast Rate; Level 12-17 Meditation Aura When Equipped; +5 to All Attributes<br>RAW: `dmg%(_;200;260); att%(_;180;250); mag%(_;23;23); oskill(Critical Strike;1;6); cast2(_;35;35); aura(Meditation;12;17); all-stats(_;5;5)` | **WEAPON**: Ral Rune: Adds 5-30 Fire Damage<br>RAW: `dmg-fire(_;5;30)`; Tir Rune: +2 to Mana after each Kill<br>RAW: `mana-kill(_;2;2)`; Tal Rune: Approx. 75.1953 Poison Damage over 5s; authoritative rate 154–154/256 per frame<br>RAW: `dmg-pois(125;154;154)`; Sol Rune: +9 to Minimum Damage<br>RAW: `dmg-min(_;9;9)` |
| 109 | Last Wish /`Runeword69` | Jah → Mal → Jah → Sur → Jah → Ber /6 | swor, hamm, axe /— | 65 | 1 | 330-375% Enhanced Damage; 20% Chance to cast level 20 Charged Bolt on attack; 10% Chance to cast level 18 Life Tap on striking; 6% Chance to cast level 11 Fade when struck; 40-50% Chance of Crushing Blow; +0.5 % Magic Find per clvl (floor after scaling); Level 17 Might Aura When Equipped<br>RAW: `dmg%(_;330;375); att-skill(Charged Bolt;20;20); hit-skill(Life Tap;10;18); gethit-skill(Fade;6;11); crush(_;40;50); mag%/lvl(4;_;_); aura(Might;17;17)` | **WEAPON**: Jah Rune: Ignore Target's Defense<br>RAW: `ignore-ac(_;1;1)`; Mal Rune: Prevent Monster Heal<br>RAW: `noheal(_;1;1)`; Jah Rune: Ignore Target's Defense<br>RAW: `ignore-ac(_;1;1)`; Sur Rune: Hit Blinds Target +1<br>RAW: `stupidity(_;1;1)`; Jah Rune: Ignore Target's Defense<br>RAW: `ignore-ac(_;1;1)`; Ber Rune: 20% Chance of Crushing Blow<br>RAW: `crush(_;20;20)` |
| 111 | Lawbringer /`Runeword71` | Amn → Lem → Ko /3 | swor, hamm, scep /— | 43 | 1 | Adds 130-180 Cold Damage; Adds 150-210 Fire Damage; Level 16-18 Sanctuary Aura When Equipped; 20% Chance to cast level 15 Decrepify on striking; +200-250 Defense vs. Missile; Slain Monsters Rest in Peace; -50% Target Defense<br>RAW: `dmg-cold(_;130;180); dmg-fire(_;150;210); aura(Sanctuary;16;18); hit-skill(Decrepify;20;15); ac-miss(_;200;250); rip(_;1;1); reduce-ac(_;50;50)` | **WEAPON**: Amn Rune: 7% Life Stolen per Hit<br>RAW: `lifesteal(_;7;7)`; Lem Rune: 75% Extra Gold from Monsters<br>RAW: `gold%(_;75;75)`; Ko Rune: +10 to Dexterity<br>RAW: `dex(_;10;10)` |
| 119 | Myth /`Runeword87` | Hel → Amn → Nef /3 | tors /— | 25 | 0 | 10% Chance to cast level 1 Taunt on striking; 3% Chance to cast level 1 Howl when struck; +2 to Barbarian Skill Levels; Replenish Life +10<br>RAW: `hit-skill(Taunt;10;1); gethit-skill(Howl;3;1); bar(_;2;2); regen(_;10;10)` | **BODY/HELM**: Hel Rune: Requirements -15%<br>RAW: `ease(_;-15;-15)`; Amn Rune: Attacker Takes Damage of 14<br>RAW: `thorns(_;14;14)`; Nef Rune: +30 Defense vs. Missile<br>RAW: `ac-miss(_;30;30)` |
| 122 | Peace /`Runeword98` | Shael → Thul → Amn /3 | tors /— | 29 | 0 | 2% Chance to cast level 15 Valkyrie on striking; 4% Chance to cast level 5 Slow Missiles when struck; +2 to Amazon Skill Levels; +2 to Critical Strike (oskill)<br>RAW: `hit-skill(Valkyrie;2;15); gethit-skill(Slow Missiles;4;5); ama(_;2;2); oskill(Critical Strike;2;2)` | **BODY/HELM**: Shael Rune: +20% Faster Hit Recovery<br>RAW: `balance2(_;20;20)`; Thul Rune: Cold Resist +30%<br>RAW: `res-cold(_;30;30)`; Amn Rune: Attacker Takes Damage of 14<br>RAW: `thorns(_;14;14)` |
| 126 | Phoenix /`Runeword103` | Vex → Vex → Lo → Jah /4 | weap, shld /— | 65 | 1 | 350-400% Enhanced Damage; +350-400 Defense vs. Missile; 40% Chance to cast level 22 Firestorm on striking; 100% Chance to cast level 40 Blaze when you Level-Up; -28% to Enemy Fire Resistance; Level 10-15 Redemption Aura When Equipped; +15-21 Fire Absorb<br>RAW: `dmg%(_;350;400); ac-miss(_;350;400); hit-skill(Firestorm;40;22); levelup-skill(Blaze;100;40); pierce-fire(_;28;28); aura(Redemption;10;15); abs-fire(_;15;21)` | **WEAPON**: Vex Rune: 7% Mana Stolen per Hit<br>RAW: `manasteal(_;7;7)`; Vex Rune: 7% Mana Stolen per Hit<br>RAW: `manasteal(_;7;7)`; Lo Rune: 20% Deadly Strike<br>RAW: `deadly(_;20;20)`; Jah Rune: Ignore Target's Defense<br>RAW: `ignore-ac(_;1;1)`<br>**SHIELD**: Vex Rune: +5% to Maximum Fire Resist<br>RAW: `res-fire-max(_;5;5)`; Vex Rune: +5% to Maximum Fire Resist<br>RAW: `res-fire-max(_;5;5)`; Lo Rune: +5% to Maximum Lightning Resist<br>RAW: `res-ltng-max(_;5;5)`; Jah Rune: +50 to Life<br>RAW: `hp(_;50;50)` |
| 132 | Pride /`Runeword109` | Cham → Sur → Io → Lo /4 | pole /— | 67 | 1 | +1 % Dmg to Demons per clvl (floor after scaling); Adds 50-280 Lightning Damage; 260-300% Bonus to Attack Rating; Level 16-20 Concentration Aura When Equipped; 25% Chance to cast level 17 Fire Wall when struck; Replenish Life +8; +1.875 % Extra Gold per clvl (floor after scaling)<br>RAW: `dmg-dem/lvl(8;_;_); dmg-ltng(_;50;280); att%(_;260;300); aura(Concentration;16;20); gethit-skill(Fire Wall;25;17); regen(_;8;8); gold%/lvl(15;_;_)` | **WEAPON**: Cham Rune: Freezes Target +3<br>RAW: `freeze(_;3;3)`; Sur Rune: Hit Blinds Target +1<br>RAW: `stupidity(_;1;1)`; Io Rune: +10 to Vitality<br>RAW: `vit(_;10;10)`; Lo Rune: 20% Deadly Strike<br>RAW: `deadly(_;20;20)` |
| 133 | Principle /`Runeword110` | Ral → Gul → Eld /3 | tors /— | 53 | 0 | 100% Chance to cast level 5 Holy Bolt on striking; +2 to Paladin Skill Levels; +100-150 to Life; +50% Damage to Undead<br>RAW: `hit-skill(Holy Bolt;100;5); pal(_;2;2); hp(_;100;150); dmg-undead(_;50;50)` | **BODY/HELM**: Ral Rune: Fire Resist +30%<br>RAW: `res-fire(_;30;30)`; Gul Rune: +5% to Maximum Poison Resist<br>RAW: `res-pois-max(_;5;5)`; Eld Rune: 15% Slower Stamina Drain<br>RAW: `stamdrain(_;15;15)` |
| 135 | Prudence /`Runeword112` | Mal → Tir /2 | tors /— | 49 | 0 | 140-170% Enhanced Defense; Magic Damage Reduced by 10; Damage Reduced by 3; All Resistances +25-35; +25% Faster Hit Recovery; Repairs 1 Durability every 4s (rate 25); +1 to Light Radius<br>RAW: `ac%(_;140;170); red-mag(_;10;10); red-dmg(_;3;3); res-all(_;25;35); balance2(_;25;25); rep-dur(25;_;_); light(_;1;1)` | **BODY/HELM**: Mal Rune: Magic Damage Reduced by 7<br>RAW: `red-mag(_;7;7)`; Tir Rune: +2 to Mana after each Kill<br>RAW: `mana-kill(_;2;2)` |
| 139 | Rain /`Runeword117` | Ort → Mal → Ith /3 | tors /— | 49 | 0 | 5% Chance to cast level 15 Twister on striking; 5% Chance to cast level 15 Cyclone Armor when struck; +2 to Druid Skill Levels; +100-150 to Mana<br>RAW: `hit-skill(Twister;5;15); gethit-skill(Cyclone Armor;5;15); dru(_;2;2); mana(_;100;150)` | **BODY/HELM**: Ort Rune: Lightning Resist +30%<br>RAW: `res-ltng(_;30;30)`; Mal Rune: Magic Damage Reduced by 7<br>RAW: `red-mag(_;7;7)`; Ith Rune: 15% Damage Taken Goes To Mana<br>RAW: `dmg-to-mana(_;15;15)` |
| 142 | Rift /`Runeword121` | Hel → Ko → Lem → Gul /4 | pole, scep /— | 53 | 1 | Adds 160-250 Magic Damage; Adds 60-180 Fire Damage; 38% Damage Taken Goes To Mana; 20% Chance to cast level 16 Tornado on striking; 16% Chance to cast level 21 Frozen Orb on attack; Level 15 Iron Maiden (40 Charges); +5-10 to All Attributes<br>RAW: `dmg-mag(_;160;250); dmg-fire(_;60;180); dmg-to-mana(_;38;38); hit-skill(Tornado;20;16); att-skill(Frozen Orb;16;21); charged(Iron Maiden;40;15); all-stats(_;5;10)` | **WEAPON**: Hel Rune: Requirements -20%<br>RAW: `ease(_;-20;-20)`; Ko Rune: +10 to Dexterity<br>RAW: `dex(_;10;10)`; Lem Rune: 75% Extra Gold from Monsters<br>RAW: `gold%(_;75;75)`; Gul Rune: 20% Bonus to Attack Rating<br>RAW: `att%(_;20;20)` |
| 150 | Treachery /`Runeword148` | Shael → Thul → Lem /3 | tors /— | 43 | 0 | 25% Chance to cast level 15 Venom on striking; 5% Chance to cast level 15 Fade when struck; +2 to Assassin Skill Levels; +45% Increased Attack Speed<br>RAW: `hit-skill(Venom;25;15); gethit-skill(Fade;5;15); ass(_;2;2); swing2(_;45;45)` | **BODY/HELM**: Shael Rune: +20% Faster Hit Recovery<br>RAW: `balance2(_;20;20)`; Thul Rune: Cold Resist +30%<br>RAW: `res-cold(_;30;30)`; Lem Rune: 50% Extra Gold from Monsters<br>RAW: `gold%(_;50;50)` |
| 162 | Grief /`Runeword47` [source: Widowmaker] | Eth → Tir → Lo → Mal → Ral /5 | swor, axe /— | 59 | 1 | +1.875 % Dmg to Demons per clvl (floor after scaling); +340-400 Damage (adds min/max); +30-40% Increased Attack Speed; 35% Chance to cast level 15 Venom on striking; -20-25% to Enemy Poison Resistance; Ignore Target's Defense; +10-15 Life after each Kill<br>RAW: `dmg-dem/lvl(15;_;_); dmg(_;340;400); swing3(_;30;40); hit-skill(Venom;35;15); pierce-pois(_;20;25); ignore-ac(_;1;1); heal-kill(_;10;15)` | **WEAPON**: Eth Rune: -25% Target Defense<br>RAW: `reduce-ac(_;25;25)`; Tir Rune: +2 to Mana after each Kill<br>RAW: `mana-kill(_;2;2)`; Lo Rune: 20% Deadly Strike<br>RAW: `deadly(_;20;20)`; Mal Rune: Prevent Monster Heal<br>RAW: `noheal(_;1;1)`; Ral Rune: Adds 5-30 Fire Damage<br>RAW: `dmg-fire(_;5;30)` |
| 163 | Wind /`Runeword163` | Sur → El /2 | mele /— | 61 | 0 | 120-160% Enhanced Damage; +40% Increased Attack Speed; +20% Faster Run/Walk; -50% Target Defense; 10% Chance to cast level 9 Tornado on striking; Level 13 Twister (127 Charges); +15% Faster Hit Recovery<br>RAW: `dmg%(_;120;160); swing2(_;40;40); move2(_;20;20); reduce-ac(_;50;50); hit-skill(245;10;9); charged(240;127;13); balance2(_;15;15)` | **WEAPON**: Sur Rune: Hit Blinds Target +1<br>RAW: `stupidity(_;1;1)`; El Rune: +1 to Light Radius; +50 to Attack Rating<br>RAW: `light(_;1;1); att(_;50;50)` |
| 165 | Voice of Reason /`Runeword99` [source: Winter] | Lem → Ko → El → Eld /4 | swor, mace /— | 43 | 1 | +220-350% Damage to Demons; +280-300% Damage to Undead; Adds 100-220 Cold Damage; -24% to Enemy Cold Resistance; 18% Chance to cast level 20 Ice Blast on striking; 15% Chance to cast level 13 Frozen Orb on striking; Cannot Be Frozen<br>RAW: `dmg-demon(_;220;350); dmg-undead(_;280;300); dmg-cold(_;100;220); pierce-cold(_;24;24); hit-skill(Ice Blast;18;20); hit-skill(Frozen Orb;15;13); nofreeze(_;1;1)` | **WEAPON**: Lem Rune: 75% Extra Gold from Monsters<br>RAW: `gold%(_;75;75)`; Ko Rune: +10 to Dexterity<br>RAW: `dex(_;10;10)`; El Rune: +1 to Light Radius; +50 to Attack Rating<br>RAW: `light(_;1;1); att(_;50;50)`; Eld Rune: +50 to Attack Rating against Undead; +75% Damage to Undead<br>RAW: `att-undead(_;50;50); dmg-undead(_;75;75)` |
| 169 | Wrath /`Runeword168` | Pul → Lum → Ber → Mal /4 | miss /— | 63 | 1 | +300% Damage to Demons; +250-300% Damage to Undead; Adds 41-240 Lightning Damage; Adds 85-120 Magic Damage; 5% Chance to cast level 10 Life Tap on striking; 30% Chance to cast level 1 decrepify on striking; Cannot Be Frozen<br>RAW: `dmg-demon(_;300;300); dmg-undead(_;250;300); dmg-ltng(_;41;240); dmg-mag(_;85;120); hit-skill(Life Tap;5;10); hit-skill(decrepify;30;1); nofreeze(_;1;1)` | **WEAPON**: Pul Rune: +100 to Attack Rating against Demons; +75% Damage to Demons<br>RAW: `att-demon(_;100;100); dmg-demon(_;75;75)`; Lum Rune: +10 to Energy<br>RAW: `enr(_;10;10)`; Ber Rune: 20% Chance of Crushing Blow<br>RAW: `crush(_;20;20)`; Mal Rune: Prevent Monster Heal<br>RAW: `noheal(_;1;1)` |

### E.1. Forty important runewords — merged full modifier reference

All modifiers below include socketed runes, with identical scalar handlers and speed-stat aliases merged. Do **not** add rune stats again. Base/superior/staffmod/automod bonuses are not included. Raw tuples in the preceding table remain authoritative, particularly for correlated variable rolls, per-level coefficients, triggers and poison. Allres and additional specific resistances remain separately labeled rather than pretending their shared variable roll is four independent rolls.

| Word /context | Complete merged modifiers, excluding base innate properties |
| --- | --- |
| Ancient's Pledge /Shield | Cold Resist +30%; All Resistances +13; 50% Enhanced Defense; 10% Damage Taken Goes To Mana; Fire Resist +35%; Lightning Resist +35%; Poison Resist +35% |
| Honor /Weapon | 160% Enhanced Damage; Replenish Life +10; +1 to All Skills; +250 to Attack Rating; 25% Deadly Strike; +10 to Strength; 7% Life Stolen per Hit; +1 to Light Radius; +9 to Maximum Damage; +2 to Mana after each Kill; +9 to Minimum Damage |
| Leaf /Weapon | +3 to Fire Skills; +2 Defense per clvl (floor after scaling); Cold Resist +33%; +3 to Inferno (native class only); +3 to Fire Bolt (native class only); +3 to Warmth (native class only); +2 to Mana after each Kill; Adds 5-30 Fire Damage |
| Lore /Helm | +10 to Energy; +1 to All Skills; +2 to Light Radius; +2 to Mana after each Kill; Lightning Resist +30%; Damage Reduced by 7 |
| Memory /Weapon | Increase Maximum Mana 20%; Magic Damage Reduced by 7; 50% Enhanced Defense; +33% Faster Cast Rate; +3 to Sorceress Skill Levels; +3 to Energy Shield (native class only); +2 to Static Field (native class only); +10 to Energy; +10 to Vitality; +9 to Minimum Damage; -25% Target Defense |
| Rhyme /Shield | +40% Faster Block Rate; 20% Increased Chance of Blocking; All Resistances +25; Cannot Be Frozen; 50% Extra Gold from Monsters; 25% Better Chance of Getting Magic Items; Regenerate Mana 15% |
| Smoke /Body Armor | +280 Defense vs. Missile; 75% Enhanced Defense; All Resistances +50; +20% Faster Hit Recovery; -1 to Light Radius; Level 6 Weaken (18 Charges); +10 to Energy |
| Stealth /Body Armor | Magic Damage Reduced by 3; +6 to Dexterity; +15 Maximum Stamina; +25% Faster Run/Walk; +25% Faster Cast Rate; +25% Faster Hit Recovery; Poison Resist +30%; Regenerate Mana 15% |
| Strength /Weapon | +20 to Strength; 35% Enhanced Damage; +10 to Vitality; 25% Chance of Crushing Blow; 7% Life Stolen per Hit; +2 to Mana after each Kill |
| White /Weapon | +3 to Poison and Bone (Necromancer) Skills; Magic Damage Reduced by 4; +20% Faster Cast Rate; +13 to Mana; +3 to Bone Armor (native class only); +2 to Bone Spear (native class only); +4 to Skeleton Mastery (native class only); Hit Causes Monster to Flee 25% (raw /128 chance); +10 to Vitality |
| Chains of Honor /Body Armor | All Resistances +65; 70% Enhanced Defense; +200% Damage to Demons; +100% Damage to Undead; 8% Life Stolen per Hit; +2 to All Skills; +20 to Strength; Replenish Life +7; Damage Reduced by 8%; 25% Better Chance of Getting Magic Items |
| Breath of the Dying /Weapon | +60% Increased Attack Speed; +200% Damage to Undead; 12-15% Life Stolen per Hit; Prevent Monster Heal; 50% Chance to cast level 20 Poison Nova when you Kill an Enemy; 350-400% Enhanced Damage; +30 to All Attributes; 7% Mana Stolen per Hit; Requirements -20%; +1 to Light Radius; +50 to Attack Rating; +50 to Attack Rating against Undead; Indestructible; -25% Target Defense |
| Call to Arms /Weapon | +40% Increased Attack Speed; 250-290% Enhanced Damage; +1 to All Skills; +2-6 to Battle Command (oskill); +1-6 to Battle Orders (oskill); +1-4 to Battle Cry (oskill); Replenish Life +12; 7% Life Stolen per Hit; Adds 5-30 Fire Damage; Prevent Monster Heal; 30% Better Chance of Getting Magic Items |
| Crescent Moon /Weapon | -35% to Enemy Lightning Resistance; Ignore Target's Defense; 180-220% Enhanced Damage; +9-11 Magic Absorb; Level 18 Summon Spirit Wolf (30 Charges); 7% Chance to cast level 13 Static Field on striking; 10% Chance to cast level 17 Chain Lightning on striking; +20% Increased Attack Speed; 25% Chance of Open Wounds; +2 to Mana after each Kill |
| Doom /Weapon | 330-370% Enhanced Damage; Level 12 Holy Freeze Aura When Equipped; +45% Increased Attack Speed; Prevent Monster Heal; -40-60% to Enemy Cold Resistance; +2 to All Skills; 5% Chance to cast level 18 Volcano on striking; Requirements -20%; 25% Chance of Open Wounds; 20% Deadly Strike; Freezes Target +3 |
| Enigma /Body Armor | +750-775 Defense; +14 Life after each Kill; +45% Faster Run/Walk; +0.75 Strength per clvl (floor after scaling); +2 to All Skills; +1 % Magic Find per clvl (floor after scaling); +1 to Teleport (oskill); Increase Maximum Life 5%; 15% Damage Taken Goes To Mana; Damage Reduced by 8% |
| Stone /Body Armor | 250-290% Enhanced Defense; Level 16 Clay Golem (16 Charges); +300 Defense vs. Missile; Level 16 Molten Boulder (80 Charges); +16 to Strength; +16 to Vitality; +60% Faster Hit Recovery; All Resistances +15; +10 to Energy |
| Exile /Shield | +30% Faster Block Rate; Freezes Target +1; 220-260% Enhanced Defense; Level 13-16 Defiance Aura When Equipped; +2 to Offensive Auras (Paladin) Skills; 15% Chance to cast level 5 Life Tap on striking; Repairs 1 Durability every 4s (rate 25); +5% to Maximum Fire Resist; +5% to Maximum Cold Resist; 25% Better Chance of Getting Magic Items; Replenish Life +7 |
| Heart of the Oak /Weapon | +40% Faster Cast Rate; Level 4 Oak Sage (25 Charges); Increase Maximum Mana 15%; +3 to All Skills; Replenish Life +20; All Resistances +30-40; Level 14 Raven (60 Charges); +10 to Dexterity; 7% Mana Stolen per Hit; +100 to Attack Rating against Demons; +75% Damage to Demons; Adds 3-14 Cold Damage (3s chill) |
| Sanctuary /Shield | 20% Increased Chance of Blocking; +20% Faster Block Rate; 130-160% Enhanced Defense; +250 Defense vs. Missile; All Resistances +50-70; +20% Faster Hit Recovery; Level 12 Slow Missiles (60 Charges); +20 to Dexterity; Magic Damage Reduced by 7 |
| Beast /Weapon | +40% Increased Attack Speed; Level 9 Fanaticism Aura When Equipped; 240-270% Enhanced Damage; +25-40 to Strength; Level 13 Summon Grizzly (5 Charges); +3 to Werebear (oskill); +3 to Lycanthropy (oskill); 20% Chance of Crushing Blow; +2 to Mana after each Kill; 25% Chance of Open Wounds; Prevent Monster Heal; +10 to Energy |
| Spirit /Weapon | +55% Faster Hit Recovery; +89-112 to Mana; +250 Defense vs. Missile; +22 to Vitality; +25-35% Faster Cast Rate; +3-8 Magic Absorb; +2 to All Skills; Approx. 75.1953 Poison Damage over 5s; authoritative rate 154–154/256 per frame; Adds 3-14 Cold Damage (3s chill); Adds 1-50 Lightning Damage; 7% Life Stolen per Hit |
| Spirit /Shield | +55% Faster Hit Recovery; +89-112 to Mana; +250 Defense vs. Missile; +22 to Vitality; +25-35% Faster Cast Rate; +3-8 Magic Absorb; +2 to All Skills; Poison Resist +35%; Cold Resist +35%; Lightning Resist +35%; Attacker Takes Damage of 14 |
| Duress /Body Armor | Adds 37-133 Cold Damage (2s chill); 10-20% Enhanced Damage; 150-200% Enhanced Defense; +40% Faster Hit Recovery; 33% Chance of Open Wounds; 15% Chance of Crushing Blow; -20% Slower Stamina Drain; All Resistances +15; Cold Resist +30% |
| Oath /Weapon | 210-340% Enhanced Damage; +50% Increased Attack Speed; 30% Chance to cast level 20 Bone Spirit on striking; Level 17 Iron Golem (14 Charges); Level 16 Heart of Wolverine (20 Charges); +10-15 Magic Absorb; Indestructible; +100 to Attack Rating against Demons; +75% Damage to Demons; Prevent Monster Heal; +10 to Energy |
| Obedience /Weapon | 370% Enhanced Damage; 40% Chance of Crushing Blow; 30% Chance to cast level 21 enchant when you Kill an Enemy; -25% to Enemy Fire Resistance; +200-300 Defense; +40% Faster Hit Recovery; All Resistances +20-30; Requirements -20%; +10 to Dexterity; Adds 3-14 Cold Damage (3s chill); -25% Target Defense; +10 to Strength |
| Harmony /Weapon | 200-275% Enhanced Damage; Adds 55-160 Fire/Lightning/Cold Damage (cold dur  frames); Level 20 Revive (25 Charges); Level 10 Vigor Aura When Equipped; +2-6 to Valkyrie (oskill); Regenerate Mana 20%; +2 to Light Radius; +2 to Mana after each Kill; +9 to Maximum Damage; +9 to Minimum Damage; +10 to Dexterity |
| Fortitude /Weapon | 200% Enhanced Defense; 300% Enhanced Damage; +25% Faster Cast Rate; 20% Chance to cast level 15 Chilling Armor when struck; 12% Damage Taken Goes To Mana; +1–1.5 Life per clvl (floor after scaling); All Resistances +25-30; +1 to Light Radius; +50 to Attack Rating; +9 to Minimum Damage; Hit Causes Monster to Flee 25% (raw /128 chance); 20% Deadly Strike |
| Fortitude /Body Armor | 200% Enhanced Defense; 300% Enhanced Damage; +25% Faster Cast Rate; 20% Chance to cast level 15 Chilling Armor when struck; 12% Damage Taken Goes To Mana; +1–1.5 Life per clvl (floor after scaling); All Resistances +25-30; +1 to Light Radius; +15 Defense; Damage Reduced by 7; Replenish Life +7; +5% to Maximum Lightning Resist |
| Faith /Weapon | 330% Enhanced Damage; 300% Bonus to Attack Rating; Adds 120-120 Fire Damage; All Resistances +15; Level 12-15 fanaticism Aura When Equipped; 10% Reanimate as Returned (monsterid1); +1-2 to All Skills; Ignore Target's Defense; 75% Extra Gold from Monsters; +50 to Attack Rating against Undead; +75% Damage to Undead |
| Death /Weapon | 300-385% Enhanced Damage; +0.5 % Deadly Strike per clvl (floor after scaling); Level 22 Blood Golem (15 Charges); 25% Chance to cast level 18 Glacial Spike on attack; 100% Chance to cast level 44 Chain Lightning when you Die; 50% Chance of Crushing Blow; Indestructible; Requirements -20%; +1 to Light Radius; +50 to Attack Rating; 7% Mana Stolen per Hit; Adds 1-50 Lightning Damage; 20% Bonus to Attack Rating |
| Dragon /Body Armor | +360 Defense; +230 Defense vs. Missile; +0.375 Strength per clvl (floor after scaling); 12% Chance to cast level 15 Hydra on striking; 20% Chance to cast level 18 Venom when struck; Level 14 Holy Fire Aura When Equipped; +3-5 to All Attributes; Increase Maximum Mana 5%; +5% to Maximum Lightning Resist; Damage Reduced by 7 |
| Dragon /Shield | +360 Defense; +230 Defense vs. Missile; +0.375 Strength per clvl (floor after scaling); 12% Chance to cast level 15 Hydra on striking; 20% Chance to cast level 18 Venom when struck; Level 14 Holy Fire Aura When Equipped; +3-5 to All Attributes; +50 to Mana; +5% to Maximum Lightning Resist; Damage Reduced by 7 |
| Dream /Helm | +150-220 Defense; 10% Chance to cast level 15 Confuse when struck; +0.625 Mana per clvl (floor after scaling); All Resistances +5-20; +20-30% Faster Hit Recovery; Level 15 Holy Shock Aura When Equipped; 12-25% Better Chance of Getting Magic Items; +10 to Vitality; Increase Maximum Life 5%; 30% Enhanced Defense |
| Dream /Shield | +150-220 Defense; 10% Chance to cast level 15 Confuse when struck; +0.625 Mana per clvl (floor after scaling); All Resistances +5-20; +20-30% Faster Hit Recovery; Level 15 Holy Shock Aura When Equipped; 12-25% Better Chance of Getting Magic Items; +10 to Vitality; +50 to Life; 30% Enhanced Defense |
| Ice /Weapon | 140-210% Enhanced Damage; Level 18 Holy Freeze Aura When Equipped; +25-30% to Cold Skill Damage; 25% Chance to cast level 22 Frost Nova on striking; 100% Chance to cast level 40 Blizzard when you Level-Up; -20% to Enemy Cold Resistance; +3.125 % Extra Gold per clvl (floor after scaling); 7% Life Stolen per Hit; +20% Increased Attack Speed; Ignore Target's Defense; 20% Deadly Strike |
| Infinity /Weapon | 255-325% Enhanced Damage; +35% Faster Run/Walk; +0.5 Vitality per clvl (floor after scaling); Level 12 Conviction Aura When Equipped; 50% Chance to cast level 20 Chain Lightning when you Kill an Enemy; -45-55% to Enemy Lightning Resistance; Level 21 Cyclone Armor (30 Charges); 40% Chance of Crushing Blow; Prevent Monster Heal; 30% Better Chance of Getting Magic Items |
| Insight /Weapon | 200-260% Enhanced Damage; 180-250% Bonus to Attack Rating; 23% Better Chance of Getting Magic Items; +1-6 to Critical Strike (oskill); +35% Faster Cast Rate; Level 12-17 Meditation Aura When Equipped; +5 to All Attributes; Adds 5-30 Fire Damage; +2 to Mana after each Kill; Approx. 75.1953 Poison Damage over 5s; authoritative rate 154–154/256 per frame; +9 to Minimum Damage |
| Last Wish /Weapon | 330-375% Enhanced Damage; 20% Chance to cast level 20 Charged Bolt on attack; 10% Chance to cast level 18 Life Tap on striking; 6% Chance to cast level 11 Fade when struck; 60-70% Chance of Crushing Blow; +0.5 % Magic Find per clvl (floor after scaling); Level 17 Might Aura When Equipped; Ignore Target's Defense; Prevent Monster Heal; Hit Blinds Target +1 |
| Lawbringer /Weapon | Adds 130-180 Cold Damage; Adds 150-210 Fire Damage; Level 16-18 Sanctuary Aura When Equipped; 20% Chance to cast level 15 Decrepify on striking; +200-250 Defense vs. Missile; Slain Monsters Rest in Peace; -50% Target Defense; 7% Life Stolen per Hit; 75% Extra Gold from Monsters; +10 to Dexterity |
| Phoenix /Weapon | 350-400% Enhanced Damage; +350-400 Defense vs. Missile; 40% Chance to cast level 22 Firestorm on striking; 100% Chance to cast level 40 Blaze when you Level-Up; -28% to Enemy Fire Resistance; Level 10-15 Redemption Aura When Equipped; +15-21 Fire Absorb; 14% Mana Stolen per Hit; 20% Deadly Strike; Ignore Target's Defense |
| Phoenix /Shield | 350-400% Enhanced Damage; +350-400 Defense vs. Missile; 40% Chance to cast level 22 Firestorm on striking; 100% Chance to cast level 40 Blaze when you Level-Up; -28% to Enemy Fire Resistance; Level 10-15 Redemption Aura When Equipped; +15-21 Fire Absorb; +10% to Maximum Fire Resist; +5% to Maximum Lightning Resist; +50 to Life |
| Pride /Weapon | +1 % Dmg to Demons per clvl (floor after scaling); Adds 50-280 Lightning Damage; 260-300% Bonus to Attack Rating; Level 16-20 Concentration Aura When Equipped; 25% Chance to cast level 17 Fire Wall when struck; Replenish Life +8; +1.875 % Extra Gold per clvl (floor after scaling); Freezes Target +3; Hit Blinds Target +1; +10 to Vitality; 20% Deadly Strike |
| Treachery /Body Armor | 25% Chance to cast level 15 Venom on striking; 5% Chance to cast level 15 Fade when struck; +2 to Assassin Skill Levels; +45% Increased Attack Speed; +20% Faster Hit Recovery; Cold Resist +30%; 50% Extra Gold from Monsters |
| Grief /Weapon | +1.875 % Dmg to Demons per clvl (floor after scaling); +340-400 Damage (adds min/max); +30-40% Increased Attack Speed; 35% Chance to cast level 15 Venom on striking; -20-25% to Enemy Poison Resistance; Ignore Target's Defense; +10-15 Life after each Kill; -25% Target Defense; +2 to Mana after each Kill; 20% Deadly Strike; Prevent Monster Heal; Adds 5-30 Fire Damage |

## Appendix F. Complete enabled unique catalog and full properties

[Source UniqueItems.txt](https://cdn.jsdelivr.net/gh/fabd/diablo2@45112569deb9384738ccafe5c24ebbb71f41c7c9/code/d2_113_data/UniqueItems.txt).

All active properties, not only selected iconic uniques. Internal names and line IDs are retained. Includes enabled quest uniques: those are explicitly marked **quest**, not ordinary random drops. Rainbow Facet variants have one displayed name but different tuples. Join base code to Appendix A/Misc for base numbers; `lvl` is the unique eligibility level. Ladder-only uniques are available in vanilla single-player; online nonladder creation is restricted. Carry1 restricts simultaneous carried copies where applicable, not every unique in this list.

| Line | Displayed name [source key if different] | Base /code | Definition lvl /req lvl | Rarity; ladder; nolimit; carry1 | Cost mult /add | All properties /raw |
| --- | --- | --- | --- | --- | --- | --- |
| 2 | The Gnasher | Hand Axe `hax` | 7 /5 | 1; 0; 0; 0 | 5 /5000 | +8 to Strength; 50% Chance of Open Wounds; 20% Chance of Crushing Blow; 60-70% Enhanced Damage<br>RAW: `str(_;8;8); openwounds(_;50;50); crush(_;20;20); dmg%(_;60;70)` |
| 3 | Deathspade | Axe `axe` | 12 /9 | 1; 0; 0; 0 | 5 /5000 | Hit Blinds Target +1; +8 to Minimum Damage; 15% Bonus to Attack Rating; +4 to Mana after each Kill; 60-70% Enhanced Damage<br>RAW: `stupidity(_;1;1); dmg-min(_;8;8); att%(_;15;15); mana-kill(_;4;4); dmg%(_;60;70)` |
| 4 | Bladebone | Double Axe `2ax` | 20 /15 | 1; 0; 0; 0 | 5 /5000 | +100% Damage to Undead; +40 to Attack Rating against Undead; +20% Increased Attack Speed; +20 Defense; +8 min fire dmg; +12 max fire dmg; 30-50% Enhanced Damage<br>RAW: `dmg-undead(_;100;100); att-undead(_;40;40); swing2(_;20;20); ac(_;20;20); fire-min(_;8;8); fire-max(_;12;12); dmg%(_;30;50)` |
| 5 | Skull Splitter [source: Mindrend] | Military Pick `mpi` | 28 /21 | 1; 0; 0; 0 | 5 /5000 | Hit Blinds Target +2; Regenerate Mana 20%; +1 min ltng dmg; +12-15 max ltng dmg; +50-100 to Attack Rating; 60-100% Enhanced Damage; 15% Chance of Open Wounds<br>RAW: `stupidity(_;2;2); regen-mana(_;20;20); ltng-min(_;1;1); ltng-max(_;12;15); att(_;50;100); dmg%(_;60;100); openwounds(_;15;15)` |
| 6 | Rakescar | War Axe `wax` | 36 /27 | 1; 0; 0; 0 | 5 /5000 | +128 pois-min (rate units1/256damage/frame); +128 pois-max (rate units1/256damage/frame); (poison length 75 frames); +50 to Attack Rating; Poison Resist +50%; 75-150% Enhanced Damage; +30% Increased Attack Speed<br>RAW: `pois-min(_;128;128); pois-max(_;128;128); pois-len(_;75;75); att(_;50;50); res-pois(_;50;50); dmg%(_;75;150); swing2(_;30;30)` |
| 7 | Axe of Fechmar [source: Fechmars Axe] | Large Axe `lax` | 11 /8 | 1; 0; 0; 0 | 5 /5000 | 70-90% Enhanced Damage; Freezes Target +3; Cold Resist +50%; +2 to Light Radius<br>RAW: `dmg%(_;70;90); freeze(_;3;3); res-cold(_;50;50); light(_;2;2)` |
| 8 | Goreshovel | Broad Axe `bax` | 19 /14 | 1; 0; 0; 0 | 5 /5000 | +30% Increased Attack Speed; +25 to Strength; 60% Chance of Open Wounds; 40-50% Enhanced Damage; +9 to Maximum Damage<br>RAW: `swing3(_;30;30); str(_;25;25); openwounds(_;60;60); dmg%(_;40;50); dmg-max(_;9;9)` |
| 9 | The Chieftain [source: The Chieftan] | Battle Axe `btx` | 26 /19 | 1; 0; 0; 0 | 5 /5000 | 100% Enhanced Damage; All Resistances +10-20; +6 to Mana after each Kill; +20% Increased Attack Speed; Adds 1-40 Lightning Damage<br>RAW: `dmg%(_;100;100); res-all(_;10;20); mana-kill(_;6;6); swing2(_;20;20); dmg-ltng(_;1;40)` |
| 10 | Brainhew | Great Axe `gax` | 34 /25 | 1; 0; 0; 0 | 5 /5000 | +14 to Minimum Damage; +25 to Mana; +4 to Light Radius; 10-13% Mana Stolen per Hit; 50-80% Enhanced Damage; Adds 15-35 Fire Damage<br>RAW: `dmg-min(_;14;14); mana(_;25;25); light(_;4;4); manasteal(_;10;13); dmg%(_;50;80); dmg-fire(_;15;35)` |
| 11 | The Humongous | Giant Axe `gix` | 39 /29 | 1; 0; 0; 0 | 5 /5000 | +20-30 to Strength; +8 to Minimum Damage; +15-25 to Maximum Damage; 33% Chance of Crushing Blow; Requirements 20%; 80-120% Enhanced Damage<br>RAW: `str(_;20;30); dmg-min(_;8;8); dmg-max(_;15;25); crush(_;33;33); ease(_;20;20); dmg%(_;80;120)` |
| 12 | Torch of Iro [source: Iros Torch] | Wand `wnd` | 7 /5 | 1; 0; 0; 0 | 5 /5000 | +1 to Necromancer Skill Levels; 6% Life Stolen per Hit; Adds 5-9 Fire Damage; +3 to Light Radius; +10 to Energy; Regenerate Mana 5%<br>RAW: `nec(_;1;1); lifesteal(_;6;6); dmg-fire(_;5;9); light(_;3;3); enr(_;10;10); regen-mana(_;5;5)` |
| 13 | Maelstrom [source: Maelstromwrath] | Yew Wand `ywn` | 19 /14 | 1; 0; 0; 0 | 5 /5000 | +1 min ltng dmg; +9 max ltng dmg; Lightning Resist +40%; +13 to Mana; +30% Faster Cast Rate; +1-3 to Corpse Explosion (native class only); +1-3 to Terror (native class only); +1-3 to Amplify Damage (native class only); +1-3 to Iron Maiden (native class only)<br>RAW: `ltng-min(_;1;1); ltng-max(_;9;9); res-ltng(_;40;40); mana(_;13;13); cast2(_;30;30); skill(74;1;3); skill(77;1;3); skill(66;1;3); skill(76;1;3)` |
| 14 | Gravenspine | Bone Wand `bwn` | 27 /20 | 1; 0; 0; 0 | 5 /5000 | +10 to Strength; +10 to Dexterity; +4 min cold dmg; +8 max cold dmg; (cold length 75 frames); 5% Mana Stolen per Hit; +2 to Necromancer Skill Levels; +25-50 to Mana<br>RAW: `str(_;10;10); dex(_;10;10); cold-min(_;4;4); cold-max(_;8;8); cold-len(_;75;75); manasteal(_;5;5); nec(_;2;2); mana(_;25;50)` |
| 15 | Ume's Lament [source: Umes Lament] | Grim Wand `gwn` | 38 /28 | 1; 0; 0; 0 | 5 /5000 | +2 to Necromancer Skill Levels; +40 to Mana; +20% Faster Cast Rate; Hit Causes Monster to Flee 50% (raw /128 chance); +3 to Terror (native class only); +2 to Decrepify (native class only)<br>RAW: `nec(_;2;2); mana(_;40;40); cast2(_;20;20); howl(_;64;64); skill(77;3;3); skill(87;2;2)` |
| 16 | Felloak | Club `clb` | 4 /3 | 1; 0; 0; 0 | 5 /5000 | Lightning Resist +60%; Fire Resist +20%; Knockback; +6 min fire dmg; +8 max fire dmg; 70-80% Enhanced Damage<br>RAW: `res-ltng(_;60;60); res-fire(_;20;20); knock(_;1;1); fire-min(_;6;6); fire-max(_;8;8); dmg%(_;70;80)` |
| 17 | Knell Striker | Scepter `scp` | 7 /5 | 1; 0; 0; 0 | 5 /5000 | 25% Chance of Crushing Blow; Fire Resist +20%; Poison Resist +20%; +15 to Mana; +35 to Attack Rating; 70-80% Enhanced Damage<br>RAW: `crush(_;25;25); res-fire(_;20;20); res-pois(_;20;20); mana(_;15;15); att(_;35;35); dmg%(_;70;80)` |
| 18 | Rusthandle | Grand Scepter `gsc` | 23 /17 | 1; 0; 0; 0 | 5 /5000 | +1 to Paladin Skill Levels; Adds 3–7 Physical Damage (paired endpoints); Magic Damage Reduced by 1; 8% Life Stolen per Hit; 50-60% Enhanced Damage; +50-60% Damage to Undead; +1-3 to Vengeance (native class only); +3 to Thorns (native class only)<br>RAW: `pal(_;1;1); dmg-norm(_;3;7); red-mag(_;1;1); lifesteal(_;8;8); dmg%(_;50;60); dmg-undead(_;50;60); skill(111;1;3); skill(103;3;3)` |
| 19 | Stormeye | War Scepter `wsp` | 31 /23 | 1; 0; 0; 0 | 5 /5000 | Adds 1-6 Lightning Damage; Adds 3-5 Cold Damage (3s chill); Replenish Life +10; 80-120% Enhanced Damage; +3-5 to Resist Lightning (native class only); +3 to Holy Shock (native class only); +1 to Fist of the Heavens (native class only)<br>RAW: `dmg-ltng(_;1;6); dmg-cold(75;3;5); regen(_;10;10); dmg%(_;80;120); skill(110;3;5); skill(118;3;3); skill(121;1;1)` |
| 20 | Stoutnail | Spiked Club `spc` | 7 /5 | 1; 0; 0; 0 | 5 /5000 | Attacker Takes Damage of 3-10; 100% Enhanced Damage; +7 to Vitality; Magic Damage Reduced by 2<br>RAW: `thorns(_;3;10); dmg%(_;100;100); vit(_;7;7); red-mag(_;2;2)` |
| 21 | Crushflange | Mace `mac` | 12 /9 | 1; 0; 0; 0 | 5 /5000 | +15 to Strength; Knockback; +2 to Light Radius; Fire Resist +50%; 50-60% Enhanced Damage; 33% Chance of Crushing Blow<br>RAW: `str(_;15;15); knock(_;1;1); light(_;2;2); res-fire(_;50;50); dmg%(_;50;60); crush(_;33;33)` |
| 22 | Bloodrise | Morning Star `mst` | 20 /15 | 1; 0; 0; 0 | 5 /5000 | 120% Enhanced Damage; 50% Bonus to Attack Rating; 25% Chance of Open Wounds; +2 to Light Radius; +10% Increased Attack Speed; +3 to Sacrifice (native class only); 5% Life Stolen per Hit<br>RAW: `dmg%(_;120;120); att%(_;50;50); openwounds(_;25;25); light(_;2;2); swing1(_;10;10); skill(96;3;3); lifesteal(_;5;5)` |
| 23 | The General's Tan Do Li Ga [source: The Generals Tan Do Li Ga] | Flail `fla` | 28 /21 | 1; 0; 0; 0 | 5 /5000 | +1 to Minimum Damage; +20 to Maximum Damage; Slows Target by 50%; +25 Defense; 5% Mana Stolen per Hit; 50-60% Enhanced Damage; +20% Increased Attack Speed<br>RAW: `dmg-min(_;1;1); dmg-max(_;20;20); slow(_;50;50); ac(_;25;25); manasteal(_;5;5); dmg%(_;50;60); swing2(_;20;20)` |
| 24 | Ironstone | War Hammer `whm` | 36 /27 | 1; 0; 0; 0 | 5 /5000 | +100-150 to Attack Rating; 100-150% Enhanced Damage; +1 min ltng dmg; +10 max ltng dmg; +10 to Strength<br>RAW: `att(_;100;150); dmg%(_;100;150); ltng-min(_;1;1); ltng-max(_;10;10); str(_;10;10)` |
| 25 | Bonesnap [source: Bonesob] | Maul `mau` | 32 /24 | 1; 0; 0; 0 | 5 /5000 | 200-300% Enhanced Damage; 40% Chance of Crushing Blow; Fire Resist +30%; Cold Resist +30%; +50% Damage to Undead<br>RAW: `dmg%(_;200;300); crush(_;40;40); res-fire(_;30;30); res-cold(_;30;30); dmg-undead(_;50;50)` |
| 26 | Steeldriver | Great Maul `gma` | 39 /29 | 1; 0; 0; 0 | 5 /5000 | Requirements -50%; +40% Increased Attack Speed; Heal Stamina Plus 25%; 150-250% Enhanced Damage<br>RAW: `ease(_;-50;-50); swing3(_;40;40); regen-stam(_;25;25); dmg%(_;150;250)` |
| 27 | Rixot's Keen [source: Rixots Keen] | Short Sword `ssd` | 3 /2 | 1; 0; 0; 0 | 5 /5000 | +5 to Minimum Damage; 20% Bonus to Attack Rating; +2 to Light Radius; 25% Chance of Crushing Blow; +25 Defense; 100% Enhanced Damage<br>RAW: `dmg-min(_;5;5); att%(_;20;20); light(_;2;2); crush(_;25;25); ac(_;25;25); dmg%(_;100;100)` |
| 28 | Blood Crescent | Scimitar `scm` | 10 /7 | 1; 0; 0; 0 | 5 /5000 | All Resistances +15; 60-80% Enhanced Damage; +15 to Life; +4 to Light Radius; 33% Chance of Open Wounds; +15% Increased Attack Speed; 15% Life Stolen per Hit<br>RAW: `res-all(_;15;15); dmg%(_;60;80); hp(_;15;15); light(_;4;4); openwounds(_;33;33); swing2(_;15;15); lifesteal(_;15;15)` |
| 29 | Skewer of Krintiz [source: Krintizs Skewer] | Sabre `sbr` | 14 /10 | 1; 0; 0; 0 | 5 /5000 | Ignore Target's Defense; +10 to Strength; +10 to Dexterity; 7% Mana Stolen per Hit; 50% Enhanced Damage; Adds 3–7 Physical Damage (paired endpoints)<br>RAW: `ignore-ac(_;1;1); str(_;10;10); dex(_;10;10); manasteal(_;7;7); dmg%(_;50;50); dmg-norm(_;3;7)` |
| 30 | Gleamscythe | Falchion `flc` | 18 /13 | 1; 0; 0; 0 | 5 /5000 | +3 to Light Radius; +30 to Mana; +20 Defense; +20% Increased Attack Speed; 60-100% Enhanced Damage; Adds 3-5 Cold Damage (2s chill)<br>RAW: `light(_;3;3); mana(_;30;30); ac(_;20;20); swing2(_;20;20); dmg%(_;60;100); dmg-cold(50;3;5)` |
| 32 | Griswold's Edge [source: Griswolds Edge] | Broad Sword `bsd` | 23 /17 | 1; 0; 0; 0 | 5 /5000 | +10-12 min fire dmg; +15-25 max fire dmg; +100 to Attack Rating; +10% Increased Attack Speed; Knockback; 80-120% Enhanced Damage; +12 to Strength<br>RAW: `fire-min(_;10;12); fire-max(_;15;25); att(_;100;100); swing1(_;10;10); knock(_;1;1); dmg%(_;80;120); str(_;12;12)` |
| 33 | Hellplague | Long Sword `lsd` | 30 /22 | 1; 0; 0; 0 | 5 /5000 | 5% Mana Stolen per Hit; 5% Life Stolen per Hit; +48 pois-min (rate units1/256damage/frame); +96 pois-max (rate units1/256damage/frame); (poison length 150 frames); 70-80% Enhanced Damage; Adds 25-75 Fire Damage; +2 to Fire Skills<br>RAW: `manasteal(_;5;5); lifesteal(_;5;5); pois-min(_;48;48); pois-max(_;96;96); pois-len(_;150;150); dmg%(_;70;80); dmg-fire(_;25;75); fireskill(_;2;2)` |
| 34 | Culwen's Point [source: Culwens Point] | War Sword `wsd` | 39 /29 | 1; 0; 0; 0 | 5 /5000 | +1 to All Skills; Poison Length Reduced by 50%; +20% Faster Hit Recovery; +20% Increased Attack Speed; +60 to Attack Rating; 70-80% Enhanced Damage<br>RAW: `allskills(_;1;1); res-pois-len(_;50;50); balance2(_;20;20); swing2(_;20;20); att(_;60;60); dmg%(_;70;80)` |
| 35 | Shadowfang | Two-Handed Sword `2hs` | 16 /12 | 1; 0; 0; 0 | 5 /5000 | 9% Mana Stolen per Hit; Cold Resist +20%; -2 to Light Radius; Adds 10-30 Cold Damage (6s chill); 100% Enhanced Damage; 9% Life Stolen per Hit<br>RAW: `manasteal(_;9;9); res-cold(_;20;20); light(_;-2;-2); dmg-cold(150;10;30); dmg%(_;100;100); lifesteal(_;9;9)` |
| 36 | Soulflay | Claymore `clm` | 26 /19 | 1; 0; 0; 0 | 5 /5000 | 4-10% Mana Stolen per Hit; 4% Life Stolen per Hit; 70-100% Enhanced Damage; All Resistances +5; +10% Increased Attack Speed<br>RAW: `manasteal(_;4;10); lifesteal(_;4;4); dmg%(_;70;100); res-all(_;5;5); swing2(_;10;10)` |
| 37 | Kinemil's Awl [source: Kinemils Awl] | Giant Sword `gis` | 31 /23 | 1; 0; 0; 0 | 5 /5000 | +100-150 to Attack Rating; +20 to Mana; +6 min fire dmg; +20-40 max fire dmg; 80-100% Enhanced Damage; +6 to Holy Fire (native class only)<br>RAW: `att(_;100;150); mana(_;20;20); fire-min(_;6;6); fire-max(_;20;40); dmg%(_;80;100); skill(102;6;6)` |
| 38 | Blacktongue | Bastard Sword `bsw` | 35 /26 | 1; 0; 0; 0 | 5 /5000 | Approx. 112.5 Poison Damage over 6s; authoritative rate 192–192/256 per frame; Prevent Monster Heal; +50 to Attack Rating; Poison Resist +50%; 50-60% Enhanced Damage<br>RAW: `dmg-pois(150;192;192); noheal(_;1;1); att(_;50;50); res-pois(_;50;50); dmg%(_;50;60)` |
| 39 | Ripsaw | Flamberge `flb` | 35 /26 | 1; 0; 0; 0 | 5 /5000 | 80% Chance of Open Wounds; +15 to Maximum Damage; 6% Mana Stolen per Hit; 80-100% Enhanced Damage<br>RAW: `openwounds(_;80;80); dmg-max(_;15;15); manasteal(_;6;6); dmg%(_;80;100)` |
| 40 | The Patriarch | Great Sword `gsd` | 39 /29 | 1; 0; 0; 0 | 5 /5000 | Damage Reduced by 3; Magic Damage Reduced by 3; Hit Blinds Target +1; 100% Extra Gold from Monsters; 100-120% Enhanced Damage; +10 to Strength<br>RAW: `red-dmg(_;3;3); red-mag(_;3;3); stupidity(_;1;1); gold%(_;100;100); dmg%(_;100;120); str(_;10;10)` |
| 41 | Gull | Dagger `dgr` | 6 /4 | 1; 0; 0; 0 | 5 /5000 | +1 to Minimum Damage; +15 to Maximum Damage; 100% Better Chance of Getting Magic Items; -5 to Mana<br>RAW: `dmg-min(_;1;1); dmg-max(_;15;15); mag%(_;100;100); mana(_;-5;-5)` |
| 42 | The Diggler | Dirk `dir` | 15 /11 | 1; 0; 0; 0 | 5 /5000 | +10 to Dexterity; 50% Enhanced Damage; +30% Increased Attack Speed; Cold Resist +25%; Fire Resist +25%; Ignore Target's Defense<br>RAW: `dex(_;10;10); dmg%(_;50;50); swing3(_;30;30); res-cold(_;25;25); res-fire(_;25;25); ignore-ac(_;1;1)` |
| 43 | The Jade Tan Do | Kris `kri` | 26 /19 | 1; 0; 0; 0 | 5 /5000 | +100-150 to Attack Rating; Cannot Be Frozen; Approx. 179.688 Poison Damage over 4s; authoritative rate 460–460/256 per frame; Poison Resist +95%; +20% to Maximum Poison Resist<br>RAW: `att(_;100;150); nofreeze(_;1;1); dmg-pois(100;460;460); res-pois(_;95;95); res-pois-max(_;20;20)` |
| 44 | Spectral Shard [source: Irices Shard] | Blade `bld` | 34 /25 | 1; 0; 0; 0 | 5 /5000 | +50% Faster Cast Rate; +50 to Mana; +55 to Attack Rating; All Resistances +10<br>RAW: `cast3(_;50;50); mana(_;50;50); att(_;55;55); res-all(_;10;10)` |
| 45 | The Dragon Chang | Spear `spr` | 11 /8 | 1; 0; 0; 0 | 5 /5000 | +35 to Attack Rating; +10 to Minimum Damage; +2 to Light Radius; +100% Damage to Undead; Adds 3-6 Fire Damage<br>RAW: `att(_;35;35); dmg-min(_;10;10); light(_;2;2); dmg-undead(_;100;100); dmg-fire(_;3;6)` |
| 46 | Razortine | Trident `tri` | 16 /12 | 1; 0; 0; 0 | 5 /5000 | Slows Target by 25%; -50% Target Defense; +15 to Strength; +8 to Dexterity; +30% Increased Attack Speed; 30-50% Enhanced Damage<br>RAW: `slow(_;25;25); reduce-ac(_;50;50); str(_;15;15); dex(_;8;8); swing2(_;30;30); dmg%(_;30;50)` |
| 47 | Bloodthief | Brandistock `brn` | 23 /17 | 1; 0; 0; 0 | 5 /5000 | 35% Chance of Open Wounds; +10 to Strength; 8-12% Life Stolen per Hit; +26 to Life; 50-70% Enhanced Damage<br>RAW: `openwounds(_;35;35); str(_;10;10); lifesteal(_;8;12); hp(_;26;26); dmg%(_;50;70)` |
| 48 | Lance of Yaggai | Spetum `spt` | 30 /22 | 1; 0; 0; 0 | 5 /5000 | Attacker Takes Damage of 8; +1 min ltng dmg; +60 max ltng dmg; All Resistances +15; +40% Increased Attack Speed<br>RAW: `thorns(_;8;8); ltng-min(_;1;1); ltng-max(_;60;60); res-all(_;15;15); swing2(_;40;40)` |
| 49 | The Tannr Gorerod | Pike `pik` | 36 /27 | 1; 0; 0; 0 | 5 /5000 | +23 min fire dmg; +54 max fire dmg; +15% to Maximum Fire Resist; +30 to Life; +60 to Attack Rating; +3 to Light Radius; Fire Resist +15%; 80-100% Enhanced Damage<br>RAW: `fire-min(_;23;23); fire-max(_;54;54); res-fire-max(_;15;15); hp(_;30;30); att(_;60;60); light(_;3;3); res-fire(_;15;15); dmg%(_;80;100)` |
| 50 | Dimoak's Hew [source: Dimoaks Hew] | Bardiche `bar` | 11 /8 | 1; 0; 0; 0 | 5 /5000 | +15 to Dexterity; 100% Enhanced Damage; +20% Increased Attack Speed; -8 Defense<br>RAW: `dex(_;15;15); dmg%(_;100;100); swing2(_;20;20); ac(_;-8;-8)` |
| 51 | Steelgoad | Voulge `vou` | 19 /14 | 1; 0; 0; 0 | 5 /5000 | Hit Causes Monster to Flee 75% (raw /128 chance); 30% Deadly Strike; +30 to Attack Rating; All Resistances +5; 60-80% Enhanced Damage; +20-40 Maximum Durability<br>RAW: `howl(_;96;96); deadly(_;30;30); att(_;30;30); res-all(_;5;5); dmg%(_;60;80); dur(_;20;40)` |
| 52 | Soul Harvest | Scythe `scy` | 26 /19 | 1; 0; 0; 0 | 5 /5000 | 30% Chance of Open Wounds; +45 to Attack Rating; All Resistances +20; 50-90% Enhanced Damage; 10% Mana Stolen per Hit; +5 to Energy<br>RAW: `openwounds(_;30;30); att(_;45;45); res-all(_;20;20); dmg%(_;50;90); manasteal(_;10;10); enr(_;5;5)` |
| 53 | The Battlebranch | Poleaxe `pax` | 34 /25 | 1; 0; 0; 0 | 5 /5000 | +30% Increased Attack Speed; +10 to Dexterity; 50-70% Enhanced Damage; +50-100 to Attack Rating; 7% Life Stolen per Hit<br>RAW: `swing3(_;30;30); dex(_;10;10); dmg%(_;50;70); att(_;50;100); lifesteal(_;7;7)` |
| 54 | Woestave | Halberd `hal` | 38 /28 | 1; 0; 0; 0 | 5 /5000 | Slows Target by 50%; 50% Chance of Open Wounds; Hit Blinds Target +3; -50 to Monster Defense Per Hit; Freezes Target +1; -3 to Light Radius; Prevent Monster Heal; 20-40% Enhanced Damage<br>RAW: `slow(_;50;50); openwounds(_;50;50); stupidity(_;3;3); dmg-ac(_;-50;-50); freeze(_;1;1); light(_;-3;-3); noheal(_;1;1); dmg%(_;20;40)` |
| 55 | The Grim Reaper | War Scythe `wsc` | 39 /29 | 1; 0; 0; 0 | 5 /5000 | 100% Deadly Strike; Prevent Monster Heal; 5% Mana Stolen per Hit; 20% Enhanced Damage; +15 to Minimum Damage<br>RAW: `deadly(_;100;100); noheal(_;1;1); manasteal(_;5;5); dmg%(_;20;20); dmg-min(_;15;15)` |
| 56 | Bane Ash | Short Staff `sst` | 7 /5 | 1; 0; 0; 0 | 5 /5000 | +4 min fire dmg; +6 max fire dmg; Fire Resist +50%; +30 to Mana; +20% Increased Attack Speed; 50-60% Enhanced Damage; +5 to Fire Bolt (native class only); +2 to Warmth (native class only)<br>RAW: `fire-min(_;4;4); fire-max(_;6;6); res-fire(_;50;50); mana(_;30;30); swing2(_;20;20); dmg%(_;50;60); skill(36;5;5); skill(37;2;2)` |
| 57 | Serpent Lord | Long Staff `lst` | 12 /9 | 1; 0; 0; 0 | 5 /5000 | Approx. 11.7188 Poison Damage over 3s; authoritative rate 40–40/256 per frame; Poison Resist +50%; -1 to Light Radius; +10 to Mana; 30-40% Enhanced Damage; 100% Mana Stolen per Hit; -50% Target Defense<br>RAW: `dmg-pois(75;40;40); res-pois(_;50;50); light(_;-1;-1); mana(_;10;10); dmg%(_;30;40); manasteal(_;100;100); reduce-ac(_;50;50)` |
| 58 | Spire of Lazarus [source: Lazarus Spire] | Gnarled Staff `cst` | 24 /18 | 1; 0; 0; 0 | 5 /5000 | Lightning Resist +75%; Damage Reduced by 5; +15 to Energy; +1 to Chain Lightning (native class only); +2 to Lightning (native class only); +3 to Static Field (native class only); Regenerate Mana 43%; Adds 1-28 Lightning Damage; +1 to Sorceress Skill Levels<br>RAW: `res-ltng(_;75;75); red-dmg(_;5;5); enr(_;15;15); skill(53;1;1); skill(49;2;2); skill(42;3;3); regen-mana(_;43;43); dmg-ltng(_;1;28); sor(_;1;1)` |
| 59 | The Salamander | Battle Staff `bst` | 28 /21 | 1; 0; 0; 0 | 5 /5000 | Adds 15-32 Fire Damage; Fire Resist +30%; +1 to Fire Wall (native class only); +2 to Fire Ball (native class only); +3 to Warmth (native class only); +2 to Fire Skills<br>RAW: `dmg-fire(_;15;32); res-fire(_;30;30); skill(51;1;1); skill(47;2;2); skill(37;3;3); fireskill(_;2;2)` |
| 60 | The Iron Jang Bong | War Staff `wst` | 38 /28 | 1; 0; 0; 0 | 5 /5000 | +30 Defense; +20% Faster Cast Rate; 100% Enhanced Damage; 50% Bonus to Attack Rating; +2 to Nova (native class only); +2 to Blaze (native class only); +3 to Frost Nova (native class only); +2 to Sorceress Skill Levels<br>RAW: `ac(_;30;30); cast3(_;20;20); dmg%(_;100;100); att%(_;50;50); skill(48;2;2); skill(46;2;2); skill(44;3;3); sor(_;2;2)` |
| 61 | Pluckeye | Short Bow `sbw` | 10 /7 | 1; 0; 0; 0 | 5 /5000 | +28 to Attack Rating; 100% Enhanced Damage; +10 to Life; +2 to Light Radius; 3% Mana Stolen per Hit; +2 to Mana after each Kill<br>RAW: `att(_;28;28); dmg%(_;100;100); hp(_;10;10); light(_;2;2); manasteal(_;3;3); mana-kill(_;2;2)` |
| 62 | Witherstring | Hunter's Bow `hbw` | 18 /13 | 1; 0; 0; 0 | 5 /5000 | +30% Increased Attack Speed; +1 to Minimum Damage; +3 to Maximum Damage; +50 to Attack Rating; Fires Magic Arrows (level 3); 40-50% Enhanced Damage<br>RAW: `swing3(_;30;30); dmg-min(_;1;1); dmg-max(_;3;3); att(_;50;50); magicarrow(_;3;3); dmg%(_;40;50)` |
| 63 | Rimeraven | Long Bow `lbw` | 20 /15 | 1; 0; 0; 0 | 5 /5000 | 50% Bonus to Attack Rating; +3 to Dexterity; Fires Explosive Arrows or Bolts (level 3); +3 to Strength; 60-70% Enhanced Damage<br>RAW: `att%(_;50;50); dex(_;3;3); explosivearrow(_;3;3); str(_;3;3); dmg%(_;60;70)` |
| 64 | Raven Claw [source: Piercerib] | Composite Bow `cbw` | 27 /20 | 1; 0; 0; 0 | 5 /5000 | All Resistances +10; 30% Deadly Strike; +60 to Attack Rating; +100% Damage to Undead; 40-60% Enhanced Damage; +50% Increased Attack Speed<br>RAW: `res-all(_;10;10); deadly(_;30;30); att(_;60;60); dmg-undead(_;100;100); dmg%(_;40;60); swing2(_;50;50)` |
| 65 | Rogue's Bow [source: Pullspite] | Short Battle Bow `sbb` | 34 /25 | 1; 0; 0; 0 | 5 /5000 | Adds 1-30 Lightning Damage; +8 to Strength; +28 to Attack Rating; 25% Chance to Pierce; Lightning Resist +25%; 70-90% Enhanced Damage<br>RAW: `dmg-ltng(_;1;30); str(_;8;8); att(_;28;28); pierce(_;25;25); res-ltng(_;25;25); dmg%(_;70;90)` |
| 66 | Wizendraw | Long Battle Bow `lbb` | 35 /26 | 1; 0; 0; 0 | 5 /5000 | Fires Magic Arrows (level 5); +30 to Mana; +20% Increased Attack Speed; Cold Resist +26%; +50-100 to Attack Rating; 70-80% Enhanced Damage; +15 to Energy; -20-35% to Enemy Cold Resistance<br>RAW: `magicarrow(_;5;5); mana(_;30;30); swing2(_;20;20); res-cold(_;26;26); att(_;50;100); dmg%(_;70;80); enr(_;15;15); pierce-cold(_;20;35)` |
| 67 | Hellclap | Short War Bow `swb` | 36 /27 | 1; 0; 0; 0 | 5 /5000 | +10% Increased Attack Speed; +15 min fire dmg; +30-50 max fire dmg; +50-75 to Attack Rating; Fire Resist +40%; +12 to Dexterity; 70-90% Enhanced Damage; +1 to Fire Skills<br>RAW: `swing1(_;10;10); fire-min(_;15;15); fire-max(_;30;50); att(_;50;75); res-fire(_;40;40); dex(_;12;12); dmg%(_;70;90); fireskill(_;1;1)` |
| 68 | Blastbark | Long War Bow `lwb` | 38 /28 | 1; 0; 0; 0 | 5 /5000 | 70-130% Enhanced Damage; +5 to Strength; +1 to Amazon Skill Levels; 3% Mana Stolen per Hit; +2 to Exploding Arrow (native class only)<br>RAW: `dmg%(_;70;130); str(_;5;5); ama(_;1;1); manasteal(_;3;3); skill(16;2;2)` |
| 69 | Leadcrow | Light Crossbow `lxb` | 12 /9 | 1; 0; 0; 0 | 5 /5000 | +10 to Dexterity; +10 to Life; 70% Enhanced Damage; Poison Resist +30%; 25% Deadly Strike; +40 to Attack Rating<br>RAW: `dex(_;10;10); hp(_;10;10); dmg%(_;70;70); res-pois(_;30;30); deadly(_;25;25); att(_;40;40)` |
| 70 | Ichorsting | Crossbow `mxb` | 24 /18 | 1; 0; 0; 0 | 5 /5000 | Approx. 29.8828 Poison Damage over 3s; authoritative rate 102–102/256 per frame; +20 to Dexterity; 50% Chance to Pierce; +50 to Attack Rating; 50% Enhanced Damage; +20% Increased Attack Speed<br>RAW: `dmg-pois(75;102;102); dex(_;20;20); pierce(_;50;50); att(_;50;50); dmg%(_;50;50); swing2(_;20;20)` |
| 71 | Hellcast | Heavy Crossbow `hxb` | 36 /27 | 1; 0; 0; 0 | 5 /5000 | Fires Explosive Arrows or Bolts (level 5); +15% to Maximum Fire Resist; Fire Resist +15%; +70 to Attack Rating; +20% Increased Attack Speed; 70-80% Enhanced Damage; Adds 15-35 Fire Damage<br>RAW: `explosivearrow(_;5;5); res-fire-max(_;15;15); res-fire(_;15;15); att(_;70;70); swing2(_;20;20); dmg%(_;70;80); dmg-fire(_;15;35)` |
| 72 | Doomslinger [source: Doomspittle] | Repeating Crossbow `rxb` | 38 /28 | 1; 0; 0; 0 | 5 /5000 | +1 to Amazon Skill Levels; 35% Chance to Pierce; +30% Increased Attack Speed; +15 to Life; 60-100% Enhanced Damage<br>RAW: `ama(_;1;1); pierce(_;35;35); swing3(_;30;30); hp(_;15;15); dmg%(_;60;100)` |
| 73 | War Bonnet | Cap `cap` **QUEST** | 4 /3 | 1; 0; 0; 0 | 5 /5000 | +15 to Life; +30 to Attack Rating; 30% Enhanced Damage; +15 to Mana; +14 Defense<br>RAW: `hp(_;15;15); att(_;30;30); dmg%(_;30;30); mana(_;15;15); ac(_;14;14)` |
| 74 | Tarnhelm | Skull Cap `skp` **QUEST** | 20 /15 | 1; 0; 0; 0 | 5 /5000 | 75% Extra Gold from Monsters; 25-50% Better Chance of Getting Magic Items; +1 to All Skills<br>RAW: `gold%(_;75;75); mag%(_;25;50); allskills(_;1;1)` |
| 75 | Coif of Glory | Helm `hlm` **QUEST** | 19 /14 | 1; 0; 0; 0 | 5 /5000 | Attacker Takes Lightning Damage of 7; Hit Blinds Target +1; Lightning Resist +15%; +100 Defense vs. Missile; +10 Defense<br>RAW: `light-thorns(_;7;7); stupidity(_;1;1); res-ltng(_;15;15); ac-miss(_;100;100); ac(_;10;10)` |
| 76 | Duskdeep | Full Helm `fhl` **QUEST** | 23 /17 | 1; 0; 0; 0 | 5 /5000 | -2 to Light Radius; All Resistances +15; Damage Reduced by 7; +8 to Maximum Damage; +10-20 Defense; 30-50% Enhanced Defense<br>RAW: `light(_;-2;-2); res-all(_;15;15); red-dmg(_;7;7); dmg-max(_;8;8); ac(_;10;20); ac%(_;30;50)` |
| 77 | Wormskull | Bone Helm `bhm` **QUEST** | 28 /21 | 1; 0; 0; 0 | 5 /5000 | +1 to Necromancer Skill Levels; 5% Life Stolen per Hit; +10 to Mana; Poison Resist +25%; Approx. 79.6875 Poison Damage over 8s; authoritative rate 102–102/256 per frame<br>RAW: `nec(_;1;1); lifesteal(_;5;5); mana(_;10;10); res-pois(_;25;25); dmg-pois(200;102;102)` |
| 78 | Howltusk | Great Helm `ghm` **QUEST** | 34 /25 | 1; 0; 0; 0 | 5 /5000 | Magic Damage Reduced by 2; Attacker Takes Damage of 3; 80% Enhanced Defense; 35% Damage Taken Goes To Mana; Knockback; Hit Causes Monster to Flee 25% (raw /128 chance)<br>RAW: `red-mag(_;2;2); thorns(_;3;3); ac%(_;80;80); dmg-to-mana(_;35;35); knock(_;1;1); howl(_;33;33)` |
| 79 | Undead Crown | Crown `crn` **QUEST** | 39 /29 | 1; 0; 0; 0 | 5 /5000 | 5% Life Stolen per Hit; +40 Defense; Poison Resist +50%; Half Freeze Duration; 30-60% Enhanced Defense; +50% Damage to Undead; +50-100 to Attack Rating against Undead; +3 to Skeleton Mastery (native class only)<br>RAW: `lifesteal(_;5;5); ac(_;40;40); res-pois(_;50;50); half-freeze(_;1;1); ac%(_;30;60); dmg-undead(_;50;50); att-undead(_;50;100); skill(69;3;3)` |
| 80 | The Face of Horror | Mask `msk` **QUEST** | 27 /20 | 1; 0; 0; 0 | 5 /5000 | Hit Causes Monster to Flee 50% (raw /128 chance); +20 to Strength; All Resistances +10; +50% Damage to Undead; +25 Defense<br>RAW: `howl(_;64;64); str(_;20;20); res-all(_;10;10); dmg-undead(_;50;50); ac(_;25;25)` |
| 81 | Greyform | Quilted Armor `qui` **QUEST** | 10 /7 | 1; 0; 0; 0 | 5 /5000 | Magic Damage Reduced by 3; Cold Resist +20%; Fire Resist +20%; +10 to Dexterity; 5% Life Stolen per Hit; +20 Defense<br>RAW: `red-mag(_;3;3); res-cold(_;20;20); res-fire(_;20;20); dex(_;10;10); lifesteal(_;5;5); ac(_;20;20)` |
| 82 | Blinkbat's Form [source: Blinkbats Form] | Leather Armor `lea` **QUEST** | 16 /12 | 1; 0; 0; 0 | 5 /5000 | +50 Defense vs. Missile; +10% Faster Run/Walk; +25 Defense; +3 min fire dmg; +6 max fire dmg; +40% Faster Hit Recovery<br>RAW: `ac-miss(_;50;50); move2(_;10;10); ac(_;25;25); fire-min(_;3;3); fire-max(_;6;6); balance2(_;40;40)` |
| 83 | The Centurion | Hard Leather Armor `hla` **QUEST** | 19 /14 | 1; 0; 0; 0 | 5 /5000 | +30 Defense; +50 to Attack Rating; Damage Reduced by 2; +15 to Life; +15 to Mana; +15 Maximum Stamina; Replenish Life +5; 25% Slower Stamina Drain<br>RAW: `ac(_;30;30); att(_;50;50); red-dmg(_;2;2); hp(_;15;15); mana(_;15;15); stam(_;15;15); regen(_;5;5); stamdrain(_;25;25)` |
| 84 | Twitchthroe | Studded Leather `stu` **QUEST** | 22 /16 | 1; 0; 0; 0 | 5 /5000 | +20% Increased Attack Speed; +10 to Dexterity; 25% Increased Chance of Blocking; +25 Defense; +10 to Strength; +20% Faster Hit Recovery<br>RAW: `swing2(_;20;20); dex(_;10;10); block(_;25;25); ac(_;25;25); str(_;10;10); balance2(_;20;20)` |
| 85 | Darkglow | Ring Mail `rng` **QUEST** | 19 /14 | 1; 0; 0; 0 | 5 /5000 | +20 to Attack Rating; +5% to All Maximum Resistances; +3 to Light Radius; +50 Defense vs. Melee; All Resistances +10; 70-100% Enhanced Defense<br>RAW: `att(_;20;20); res-all-max(_;5;5); light(_;3;3); ac-hth(_;50;50); res-all(_;10;10); ac%(_;70;100)` |
| 86 | Hawkmail | Scale Mail `scl` **QUEST** | 20 /15 | 1; 0; 0; 0 | 5 /5000 | 80-100% Enhanced Defense; +15% to Maximum Cold Resist; Cold Resist +15%; Cannot Be Frozen; +10% Faster Run/Walk<br>RAW: `ac%(_;80;100); res-cold-max(_;15;15); res-cold(_;15;15); nofreeze(_;1;1); move2(_;10;10)` |
| 87 | Sparking Mail | Chain Mail `chn` **QUEST** | 23 /17 | 1; 0; 0; 0 | 5 /5000 | 75-85% Enhanced Defense; Adds 1-20 Lightning Damage; Attacker Takes Lightning Damage of 10-14; Lightning Resist +30%<br>RAW: `ac%(_;75;85); dmg-ltng(_;1;20); light-thorns(_;10;14); res-ltng(_;30;30)` |
| 88 | Venom Ward [source: Venomsward] | Breast Plate `brs` **QUEST** | 27 /20 | 1; 0; 0; 0 | 5 /5000 | +15% to Maximum Poison Resist; Poison Length Reduced by 50%; Poison Resist +90%; +2 to Light Radius; 60-100% Enhanced Defense<br>RAW: `res-pois-max(_;15;15); res-pois-len(_;50;50); res-pois(_;90;90); light(_;2;2); ac%(_;60;100)` |
| 89 | Iceblink | Splint Mail `spl` **QUEST** | 30 /22 | 1; 0; 0; 0 | 5 /5000 | Freezes Target +1; Cold Resist +30%; +4 to Light Radius; Magic Damage Reduced by 1; 70-80% Enhanced Defense<br>RAW: `freeze(_;1;1); res-cold(_;30;30); light(_;4;4); red-mag(_;1;1); ac%(_;70;80)` |
| 90 | Boneflesh | Plate Mail `plt` **QUEST** | 35 /26 | 1; 0; 0; 0 | 5 /5000 | 5% Life Stolen per Hit; 100-120% Enhanced Defense; +35 to Attack Rating; 25% Chance of Open Wounds<br>RAW: `lifesteal(_;5;5); ac%(_;100;120); att(_;35;35); openwounds(_;25;25)` |
| 91 | Rockfleece | Field Plate `fld` **QUEST** | 38 /28 | 1; 0; 0; 0 | 5 /5000 | Requirements -10%; 100-130% Enhanced Defense; Damage Reduced by 10%; Damage Reduced by 5; +5 to Strength<br>RAW: `ease(_;-10;-10); ac%(_;100;130); red-dmg%(_;10;10); red-dmg(_;5;5); str(_;5;5)` |
| 92 | Rattlecage | Gothic Plate `gth` **QUEST** | 39 /29 | 1; 0; 0; 0 | 5 /5000 | Hit Causes Monster to Flee 40% (raw /128 chance); +45 to Attack Rating; 25% Chance of Crushing Blow; +200 Defense<br>RAW: `howl(_;52;52); att(_;45;45); crush(_;25;25); ac(_;200;200)` |
| 93 | Goldskin | Full Plate Mail `ful` **QUEST** | 38 /28 | 1; 0; 0; 0 | 5 /5000 | 120-150% Enhanced Defense; All Resistances +35; Attacker Takes Damage of 10; +2 to Light Radius; 100% Extra Gold from Monsters<br>RAW: `ac%(_;120;150); res-all(_;35;35); thorns(_;10;10); light(_;2;2); gold%(_;100;100)` |
| 94 | Silks of the Victor [source: Victors Silk] | Ancient Armor `aar` **QUEST** | 38 /28 | 1; 0; 0; 0 | 5 /5000 | 5% Mana Stolen per Hit; +1 to All Skills; +2 to Light Radius; 100-120% Enhanced Defense<br>RAW: `manasteal(_;5;5); allskills(_;1;1); light(_;2;2); ac%(_;100;120)` |
| 95 | Heavenly Garb | Light Plate `ltp` **QUEST** | 39 /29 | 1; 0; 0; 0 | 5 /5000 | 100% Enhanced Defense; All Resistances +10; Regenerate Mana 25%; +15 to Energy; +50% Damage to Undead; +100 to Attack Rating against Undead<br>RAW: `ac%(_;100;100); res-all(_;10;10); regen-mana(_;25;25); enr(_;15;15); dmg-undead(_;50;50); att-undead(_;100;100)` |
| 96 | Pelta Lunata | Buckler `buc` **QUEST** | 3 /2 | 1; 0; 0; 0 | 5 /5000 | +30 Defense; +10 to Vitality; +2 to Strength; +10 to Energy; 30-40% Enhanced Defense; 20% Increased Chance of Blocking; +40% Faster Block Rate; +8-12 Maximum Durability<br>RAW: `ac(_;30;30); vit(_;10;10); str(_;2;2); enr(_;10;10); ac%(_;30;40); block(_;20;20); block2(_;40;40); dur(_;8;12)` |
| 97 | Umbral Disk | Small Shield `sml` **QUEST** | 12 /9 | 1; 0; 0; 0 | 5 /5000 | Hit Blinds Target +1; +10 to Dexterity; +30 Defense; +20 to Life; -2 to Light Radius; 40-50% Enhanced Defense; 30% Increased Chance of Blocking; +10-15 Maximum Durability<br>RAW: `stupidity(_;1;1); dex(_;10;10); ac(_;30;30); hp(_;20;20); light(_;-2;-2); ac%(_;40;50); block(_;30;30); dur(_;10;15)` |
| 98 | Stormguild | Large Shield `lrg` **QUEST** | 18 /13 | 1; 0; 0; 0 | 5 /5000 | Magic Damage Reduced by 1; Lightning Resist +25%; +30 Defense; Adds 1-6 Lightning Damage; 50-60% Enhanced Defense; 30% Increased Chance of Blocking; Attacker Takes Lightning Damage of 3; +10-15 Maximum Durability<br>RAW: `red-mag(_;1;1); res-ltng(_;25;25); ac(_;30;30); dmg-ltng(_;1;6); ac%(_;50;60); block(_;30;30); light-thorns(_;3;3); dur(_;10;15)` |
| 99 | Wall of the Eyeless | Bone Shield `bsh` **QUEST** | 27 /20 | 1; 0; 0; 0 | 5 /5000 | +5 to Mana after each Kill; 3% Mana Stolen per Hit; +20% Faster Cast Rate; Poison Resist +20%; 30-40% Enhanced Defense; +10 Defense<br>RAW: `mana-kill(_;5;5); manasteal(_;3;3); cast2(_;20;20); res-pois(_;20;20); ac%(_;30;40); ac(_;10;10)` |
| 100 | Swordback Hold | Spiked Shield `spk` **QUEST** | 20 /15 | 1; 0; 0; 0 | 5 /5000 | Attacker Takes Damage of 5; 20% Increased Chance of Blocking; 50% Chance of Open Wounds; (cosmetic bloody); 30-60% Enhanced Defense; Attacker Takes Damage of 5; +10 Defense<br>RAW: `thorns(_;5;5); block(_;20;20); openwounds(_;50;50); bloody(_;3;5); ac%(_;30;60); thorns(_;5;5); ac(_;10;10)` |
| 101 | Steelclash | Kite Shield `kit` **QUEST** | 23 /17 | 1; 0; 0; 0 | 5 /5000 | 25% Increased Chance of Blocking; +1 to Paladin Skill Levels; Damage Reduced by 3; +3 to Light Radius; 60-100% Enhanced Defense; +20% Faster Block Rate; All Resistances +15; +20 Defense; +15-20 Maximum Durability<br>RAW: `block(_;25;25); pal(_;1;1); red-dmg(_;3;3); light(_;3;3); ac%(_;60;100); block2(_;20;20); res-all(_;15;15); ac(_;20;20); dur(_;15;20)` |
| 102 | Bverrit Keep | Tower Shield `tow` **QUEST** | 26 /19 | 1; 0; 0; 0 | 5 /5000 | +30 Defense; Fire Resist +75%; +5 to Strength; Magic Damage Reduced by 5; 80-120% Enhanced Defense; 10% Increased Chance of Blocking; +80-100 Maximum Durability<br>RAW: `ac(_;30;30); res-fire(_;75;75); str(_;5;5); red-mag(_;5;5); ac%(_;80;120); block(_;10;10); dur(_;80;100)` |
| 103 | The Ward | Gothic Shield `gts` **QUEST** | 35 /26 | 1; 0; 0; 0 | 5 /5000 | +40 Defense; Magic Damage Reduced by 2; +10 to Strength; 10% Increased Chance of Blocking; 100% Enhanced Defense; All Resistances +30-50<br>RAW: `ac(_;40;40); red-mag(_;2;2); str(_;10;10); block(_;10;10); ac%(_;100;100); res-all(_;30;50)` |
| 104 | The Hand of Broc | Leather Gloves `lgl` **QUEST** | 7 /5 | 1; 0; 0; 0 | 5 /5000 | 3% Mana Stolen per Hit; 3% Life Stolen per Hit; Poison Resist +10%; +20 to Mana; +10 Defense; 10-20% Enhanced Defense<br>RAW: `manasteal(_;3;3); lifesteal(_;3;3); res-pois(_;10;10); mana(_;20;20); ac(_;10;10); ac%(_;10;20)` |
| 105 | Bloodfist | Heavy Gloves `vgl` **QUEST** | 12 /9 | 1; 0; 0; 0 | 5 /5000 | +5 to Minimum Damage; +40 to Life; +30% Faster Hit Recovery; +10 Defense; 10-20% Enhanced Defense; +10% Increased Attack Speed<br>RAW: `dmg-min(_;5;5); hp(_;40;40); balance2(_;30;30); ac(_;10;10); ac%(_;10;20); swing2(_;10;10)` |
| 106 | Chance Guards | Chain Gloves `mgl` **QUEST** | 20 /15 | 1; 0; 0; 0 | 5 /5000 | 200% Extra Gold from Monsters; 25-40% Better Chance of Getting Magic Items; +25 to Attack Rating; +15 Defense; +2 to Light Radius; 20-30% Enhanced Defense<br>RAW: `gold%(_;200;200); mag%(_;25;40); att(_;25;25); ac(_;15;15); light(_;2;2); ac%(_;20;30)` |
| 107 | Magefist | Light Gauntlets `tgl` **QUEST** | 31 /23 | 1; 0; 0; 0 | 5 /5000 | +20% Faster Cast Rate; Regenerate Mana 25%; +1 to Fire Skills; Adds 1-6 Fire Damage; +10 Defense; 20-30% Enhanced Defense<br>RAW: `cast3(_;20;20); regen-mana(_;25;25); fireskill(_;1;1); dmg-fire(_;1;6); ac(_;10;10); ac%(_;20;30)` |
| 108 | Frostburn | Gauntlets `hgl` **QUEST** | 39 /29 | 1; 0; 0; 0 | 5 /5000 | +30 Defense; 5% Enhanced Damage; Increase Maximum Mana 40%; Adds 1-6 Cold Damage (2s chill); 10-20% Enhanced Defense<br>RAW: `ac(_;30;30); dmg%(_;5;5); mana%(_;40;40); dmg-cold(50;1;6); ac%(_;10;20)` |
| 109 | Hotspur | Boots `lbt` **QUEST** | 7 /5 | 1; 0; 0; 0 | 5 /5000 | +15% to Maximum Fire Resist; +15 to Life; Adds 3-6 Fire Damage; +6 Defense; Fire Resist +45%; 10-20% Enhanced Defense<br>RAW: `res-fire-max(_;15;15); hp(_;15;15); dmg-fire(_;3;6); ac(_;6;6); res-fire(_;45;45); ac%(_;10;20)` |
| 110 | Gorefoot | Heavy Boots `vbt` **QUEST** | 12 /9 | 1; 0; 0; 0 | 5 /5000 | (cosmetic bloody); +20% Faster Run/Walk; 2% Mana Stolen per Hit; Attacker Takes Damage of 2; +12 Defense; 20-30% Enhanced Defense; +2 to Leap (native class only)<br>RAW: `bloody(_;3;5); move2(_;20;20); manasteal(_;2;2); thorns(_;2;2); ac(_;12;12); ac%(_;20;30); skill(132;2;2)` |
| 111 | Treads of Cthon | Chain Boots `mbt` **QUEST** | 20 /15 | 1; 0; 0; 0 | 5 /5000 | +30% Faster Run/Walk; +50 Defense vs. Missile; 50% Slower Stamina Drain; +10 to Life; +12 Defense; 30-40% Enhanced Defense<br>RAW: `move2(_;30;30); ac-miss(_;50;50); stamdrain(_;50;50); hp(_;10;10); ac(_;12;12); ac%(_;30;40)` |
| 112 | Goblin Toe | Light Plated Boots `tbt` **QUEST** | 30 /22 | 1; 0; 0; 0 | 5 /5000 | 25% Chance of Crushing Blow; Damage Reduced by 1; Magic Damage Reduced by 1; +15 Defense; -1 to Light Radius; 50-60% Enhanced Defense<br>RAW: `crush(_;25;25); red-dmg(_;1;1); red-mag(_;1;1); ac(_;15;15); light(_;-1;-1); ac%(_;50;60)` |
| 113 | Tearhaunch | Greaves `hbt` **QUEST** | 39 /29 | 1; 0; 0; 0 | 5 /5000 | +35 Defense; +5 to Strength; +5 to Dexterity; +20% Faster Run/Walk; All Resistances +10; 60-80% Enhanced Defense; +2 to Vigor (native class only)<br>RAW: `ac(_;35;35); str(_;5;5); dex(_;5;5); move2(_;20;20); res-all(_;10;10); ac%(_;60;80); skill(115;2;2)` |
| 114 | Lenymo [source: Lenyms Cord] | Sash `lbl` **QUEST** | 10 /7 | 1; 0; 0; 0 | 5 /5000 | +15 to Mana; Regenerate Mana 30%; All Resistances +5; +1 to Light Radius<br>RAW: `mana(_;15;15); regen-mana(_;30;30); res-all(_;5;5); light(_;1;1)` |
| 115 | Snakecord | Light Belt `vbl` **QUEST** | 16 /12 | 1; 0; 0; 0 | 5 /5000 | Approx. 11.7188 Poison Damage over 3s; authoritative rate 40–40/256 per frame; Poison Resist +25%; +10 Defense; 20-30% Enhanced Defense; Replenish Life +5; Poison Length Reduced by 50%<br>RAW: `dmg-pois(75;40;40); res-pois(_;25;25); ac(_;10;10); ac%(_;20;30); regen(_;5;5); res-pois-len(_;50;50)` |
| 116 | Nightsmoke | Belt `mbl` **QUEST** | 27 /20 | 1; 0; 0; 0 | 5 /5000 | All Resistances +10; 50% Damage Taken Goes To Mana; +20 to Mana; Damage Reduced by 2; +15 Defense; 30-50% Enhanced Defense<br>RAW: `res-all(_;10;10); dmg-to-mana(_;50;50); mana(_;20;20); red-dmg(_;2;2); ac(_;15;15); ac%(_;30;50)` |
| 117 | Goldwrap | Heavy Belt `tbl` **QUEST** | 36 /27 | 1; 0; 0; 0 | 5 /5000 | 30% Better Chance of Getting Magic Items; +2 to Light Radius; +25 Defense; +10% Increased Attack Speed; 40-60% Enhanced Defense; 50-80% Extra Gold from Monsters<br>RAW: `mag%(_;30;30); light(_;2;2); ac(_;25;25); swing2(_;10;10); ac%(_;40;60); gold%(_;50;80)` |
| 118 | Bladebuckle | Plated Belt `hbl` **QUEST** | 39 /29 | 1; 0; 0; 0 | 5 /5000 | Attacker Takes Damage of 8; +30 Defense; Damage Reduced by 3; +5 to Strength; +10 to Dexterity; 80-100% Enhanced Defense; +30% Faster Hit Recovery<br>RAW: `thorns(_;8;8); ac(_;30;30); red-dmg(_;3;3); str(_;5;5); dex(_;10;10); ac%(_;80;100); balance2(_;30;30)` |
| 119 | Nokozan Relic | amulet `amu` | 14 /10 | 20; 0; 0; 0 | 5 /5000 | Adds 3-6 Fire Damage; +10% to Maximum Fire Resist; Fire Resist +50%; +3 to Light Radius; +20% Faster Hit Recovery<br>RAW: `dmg-fire(_;3;6); res-fire-max(_;10;10); res-fire(_;50;50); light(_;3;3); balance2(_;20;20)` |
| 120 | The Eye of Etlich | amulet `amu` | 20 /15 | 5; 0; 0; 0 | 5 /5000 | +10-40 Defense vs. Missile; +1-5 to Light Radius; +1 to All Skills; 3-7% Life Stolen per Hit; +1-2 min cold dmg; +3-5 max cold dmg; (cold length 50-250 frames)<br>RAW: `ac-miss(_;10;40); light(_;1;5); allskills(_;1;1); lifesteal(_;3;7); cold-min(_;1;2); cold-max(_;3;5); cold-len(_;50;250)` |
| 121 | The Mahim-Oak Curio | amulet `amu` | 34 /25 | 10; 0; 0; 0 | 5 /5000 | +10 to Dexterity; +10 to Strength; +10 to Energy; +10 to Vitality; +10 Defense; 10% Bonus to Attack Rating; All Resistances +10; 10% Enhanced Defense<br>RAW: `dex(_;10;10); str(_;10;10); enr(_;10;10); vit(_;10;10); ac(_;10;10); att%(_;10;10); res-all(_;10;10); ac%(_;10;10)` |
| 122 | Nagelring | ring `rin` | 10 /7 | 15; 0; 0; 0 | 5 /5000 | Magic Damage Reduced by 3; Attacker Takes Damage of 3; +50-75 to Attack Rating; 15-30% Better Chance of Getting Magic Items<br>RAW: `red-mag(_;3;3); thorns(_;3;3); att(_;50;75); mag%(_;15;30)` |
| 123 | Manald Heal | ring `rin` | 20 /15 | 15; 0; 0; 0 | 5 /5000 | 4-7% Mana Stolen per Hit; Replenish Life +5-8; +20 to Life; Regenerate Mana 20%<br>RAW: `manasteal(_;4;7); regen(_;5;8); hp(_;20;20); regen-mana(_;20;20)` |
| 124 | The Stone of Jordan | ring `rin` | 39 /29 | 1; 0; 0; 0 | 5 /5000 | +20 to Mana; Increase Maximum Mana 25%; +1 min ltng dmg; +1 to All Skills; +12 max ltng dmg<br>RAW: `mana(_;20;20); mana%(_;25;25); ltng-min(_;1;1); allskills(_;1;1); ltng-max(_;12;12)` |
| 125 | Amulet of the Viper | viper amulet `vip` **QUEST** | 0 /0 | 1; 0; 0; 0 | 5 /5000 | +10 to Mana; Poison Resist +25%; +10 to Life<br>RAW: `mana(_;10;10); res-pois(_;25;25); hp(_;10;10)` |
| 126 | Staff of Kings | Staff of the Kings `msf` **QUEST** | 0 /0 | 1; 0; 0; 0 | 5 /5000 | All Resistances +10; +50% Increased Attack Speed<br>RAW: `res-all(_;10;10); swing3(_;50;50)` |
| 127 | Horadric Staff | Horadric Staff `hst` **QUEST** | 0 /0 | 1; 0; 0; 0 | 5 /5000 | +10 to Mana; Poison Resist +25%; +10 to Life; All Resistances +10; +50% Increased Attack Speed<br>RAW: `mana(_;10;10); res-pois(_;25;25); hp(_;10;10); res-all(_;10;10); swing3(_;50;50)` |
| 128 | Hellforge Hammer [source: Hell Forge Hammer] | Hellforge Hammer `hfh` **QUEST** | 0 /0 | 1; 0; 0; 0 | 5 /5000 | +5 min fire dmg; +20 max fire dmg; Fire Resist +40%; +35 Defense<br>RAW: `fire-min(_;5;5); fire-max(_;20;20); res-fire(_;40;40); ac(_;35;35)` |
| 129 | Khalim's Flail [source: KhalimFlail] | KhalimFlail `qf1` **QUEST** | 0 /0 | 1; 0; 0; 0 | 5 /5000 | +1 min ltng dmg; +20 max ltng dmg; +50% Increased Attack Speed; +40 to Attack Rating<br>RAW: `ltng-min(_;1;1); ltng-max(_;20;20); swing3(_;50;50); att(_;40;40)` |
| 130 | Khalim's Will [source: SuperKhalimFlail] | SuperKhalimFlail `qf2` **QUEST** | 0 /0 | 1; 0; 0; 0 | 5 /5000 | +1 min ltng dmg; +40 max ltng dmg; +50% Increased Attack Speed; +40 to Attack Rating; 6% Mana Stolen per Hit; 6% Life Stolen per Hit<br>RAW: `ltng-min(_;1;1); ltng-max(_;40;40); swing3(_;50;50); att(_;40;40); manasteal(_;6;6); lifesteal(_;6;6)` |
| 132 | Coldkill | Hatchet `9ha` | 44 /36 | 1; 0; 0; 0 | 5 /5000 | Adds 40-40 Cold Damage (2s chill); Cold Resist +15%; +15% to Maximum Cold Resist; +30% Increased Attack Speed; 10% Chance to cast level 10 Ice Blast on striking; 10% Chance to cast level 5 Frost Nova when struck; 150-190% Enhanced Damage<br>RAW: `dmg-cold(50;40;40); res-cold(_;15;15); res-cold-max(_;15;15); swing3(_;30;30); hit-skill(45;10;10); gethit-skill(44;10;5); dmg%(_;150;190)` |
| 133 | Butcher's Pupil | Cleaver `9ax` | 47 /39 | 1; 0; 0; 0 | 5 /5000 | 35% Deadly Strike; 25% Chance of Open Wounds; 150-200% Enhanced Damage; Indestructible; +30% Increased Attack Speed; Adds 30–50 Physical Damage (paired endpoints)<br>RAW: `deadly(_;35;35); openwounds(_;25;25); dmg%(_;150;200); indestruct(_;1;1); swing3(_;30;30); dmg-norm(_;30;50)` |
| 134 | Islestrike | Twin Axe `92a` | 51 /43 | 1; 0; 0; 0 | 5 /5000 | +2 to Druid Skill Levels; +10 to Strength; +10 to Dexterity; +10 to Vitality; +10 to Energy; +50 Defense vs. Missile; 25% Chance of Crushing Blow; 170-190% Enhanced Damage; +1 to Maul (native class only); +1 to Fury (native class only)<br>RAW: `dru(_;2;2); str(_;10;10); dex(_;10;10); vit(_;10;10); enr(_;10;10); ac-miss(_;50;50); crush(_;25;25); dmg%(_;170;190); skill(233;1;1); skill(248;1;1)` |
| 135 | Pompe's Wrath | Crowbill `9mp` | 53 /45 | 1; 0; 0; 0 | 5 /5000 | 4% Chance to cast level 8 Volcano on striking; Slows Target by 50%; Adds 35-150 Fire Damage; Knockback; 140-170% Enhanced Damage<br>RAW: `hit-skill(244;4;8); slow(_;50;50); dmg-fire(_;35;150); knock(_;1;1); dmg%(_;140;170)` |
| 136 | Guardian Naga | Naga `9wa` | 56 /48 | 1; 0; 0; 0 | 5 /5000 | 5% Chance to cast level 8 Poison Nova on striking; Attacker Takes Damage of 15; Poison Resist +30%; 150-180% Enhanced Damage; Approx. 250 Poison Damage over 10s; authoritative rate 256–256/256 per frame; +20 to Maximum Damage<br>RAW: `hit-skill(92;5;8); thorns(_;15;15); res-pois(_;30;30); dmg%(_;150;180); dmg-pois(250;256;256); dmg-max(_;20;20)` |
| 137 | Warlord's Trust | Military Axe `9la` | 43 /35 | 1; 0; 0; 0 | 5 /5000 | +75 Defense; Replenish Life +20; +0.5 Vitality per clvl (floor after scaling); All Resistances +10; Repairs 1 Durability every 4s (rate 25); 175% Enhanced Damage<br>RAW: `ac(_;75;75); regen(_;20;20); vit/lvl(4;_;_); res-all(_;10;10); rep-dur(25;_;_); dmg%(_;175;175)` |
| 138 | Spellsteel | Bearded Axe `9ba` | 47 /39 | 1; 0; 0; 0 | 5 /5000 | Requirements -60%; +100 to Mana; Magic Damage Reduced by 12-15; +10% Faster Cast Rate; 165% Enhanced Damage; Regenerate Mana 25%; Level 1 Teleport (20 Charges); Level 3 Decrepify (30 Charges); Level 10 Holy Bolt (100 Charges); Level 12 Firestorm (60 Charges)<br>RAW: `ease(_;-60;-60); mana(_;100;100); red-mag(_;12;15); cast1(_;10;10); dmg%(_;165;165); regen-mana(_;25;25); charged(54;20;1); charged(87;30;3); charged(101;100;10); charged(225;60;12)` |
| 139 | Stormrider | Tabar `9bt` | 49 /41 | 1; 0; 0; 0 | 5 /5000 | 5% Chance to cast level 10 Chain Lightning on striking; 10% Chance to cast level 0 Charged Bolt on striking; Adds 1-200 Lightning Damage; Adds 35–75 Physical Damage (paired endpoints); 100% Enhanced Damage; +50 Maximum Durability; Attacker Takes Lightning Damage of 15; 15% Chance to cast level 5 Charged Bolt when struck<br>RAW: `hit-skill(53;5;10); hit-skill(38;10;0); dmg-ltng(_;1;200); dmg-norm(_;35;75); dmg%(_;100;100); dur(_;50;50); light-thorns(_;15;15); gethit-skill(38;15;5)` |
| 140 | Boneslayer Blade | Gothic Axe `9ga` | 50 /42 | 1; 0; 0; 0 | 5 /5000 | +5 AR vs Undead per clvl (floor after scaling); +2.5 % Dmg to Undead per clvl (floor after scaling); +8 to Strength; +20% Increased Attack Speed; 35% Bonus to Attack Rating; 180-220% Enhanced Damage; Level 20 Holy Bolt (200 Charges); 50% Chance to cast level 0 Holy Bolt when struck<br>RAW: `att-und/lvl(10;_;_); dmg-und/lvl(20;_;_); str(_;8;8); swing2(_;20;20); att%(_;35;35); dmg%(_;180;220); charged(101;200;20); gethit-skill(101;50;0)` |
| 141 | The Minotaur [source: The Minataur] | Ancient Axe `9gi` | 53 /45 | 1; 0; 0; 0 | 5 /5000 | Hit Blinds Target +2; Half Freeze Duration; +15-20 to Strength; Slows Target by 50%; 30% Chance of Crushing Blow; Adds 20–30 Physical Damage (paired endpoints); 140-200% Enhanced Damage<br>RAW: `stupidity(_;2;2); half-freeze(_;1;1); str(_;15;20); slow(_;50;50); crush(_;30;30); dmg-norm(_;20;30); dmg%(_;140;200)` |
| 142 | Suicide Branch | Burnt Wand `9wn` | 41 /33 | 1; 0; 0; 0 | 5 /5000 | Attacker Takes Damage of 25; +50% Faster Cast Rate; All Resistances +10; Increase Maximum Mana 10%; +40 to Life; +1 to All Skills<br>RAW: `thorns(_;25;25); cast2(_;50;50); res-all(_;10;10); mana%(_;10;10); hp(_;40;40); allskills(_;1;1)` |
| 143 | Carin Shard | Petrified Wand `9yw` | 43 /35 | 1; 0; 0; 0 | 5 /5000 | +1.25 Life per clvl (floor after scaling); +10% Faster Cast Rate; +1.25 Mana per clvl (floor after scaling); +30% Faster Hit Recovery; Replenish Life +5; +1 to Necromancer Skill Levels; +2 to Summoning (Necromancer) Skills<br>RAW: `hp/lvl(10;_;_); cast2(_;10;10); mana/lvl(10;_;_); balance2(_;30;30); regen(_;5;5); nec(_;1;1); skilltab(8;2;2)` |
| 144 | Arm of King Leoric | Tomb Wand `9bw` | 44 /36 | 1; 0; 0; 0 | 5 /5000 | +2 to Summoning (Necromancer) Skills; 5% Chance to cast level 10 Bone Spirit when struck; +1.25 Mana per clvl (floor after scaling); 10% Chance to cast level 2 Bone Prison when struck; +10% Faster Cast Rate; +2 to Poison and Bone (Necromancer) Skills; +2 to Terror (native class only); +2 to Raise Skeletal Mage (native class only); +3 to Skeleton Mastery (native class only); +3 to Raise Skeleton (native class only)<br>RAW: `skilltab(8;2;2); gethit-skill(93;5;10); mana/lvl(10;_;_); gethit-skill(88;10;2); cast1(_;10;10); skilltab(7;2;2); skill(77;2;2); skill(80;2;2); skill(69;3;3); skill(70;3;3)` |
| 145 | Blackhand Key | Grave Wand `9gw` | 49 /41 | 1; 0; 0; 0 | 5 /5000 | +1 to Curses (Necromancer) Skills; 20% Damage Taken Goes To Mana; +50 to Life; -2 to Light Radius; +30% Faster Cast Rate; Fire Resist +37%; +2 to Necromancer Skill Levels; Level 13 Grim Ward (30 Charges)<br>RAW: `skilltab(6;1;1); dmg-to-mana(_;20;20); hp(_;50;50); light(_;-2;-2); cast3(_;30;30); res-fire(_;37;37); nec(_;2;2); charged(150;30;13)` |
| 146 | Dark Clan Crusher | Cudgel `9cl` | 42 /34 | 1; 0; 0; 0 | 5 /5000 | +2 to Druid Skill Levels; +200% Damage to Demons; +200 to Attack Rating against Demons; 195% Enhanced Damage; 20-25% Bonus to Attack Rating; +15 Life after each Demon Kill<br>RAW: `dru(_;2;2); dmg-demon(_;200;200); att-demon(_;200;200); dmg%(_;195;195); att%(_;20;25); demon-heal(_;15;15)` |
| 147 | Zakarum's Hand | Rune Scepter `9sc` | 45 /37 | 1; 0; 0; 0 | 5 /5000 | 8% Mana Stolen per Hit; Ignore Target's Defense; Regenerate Mana 10%; Heal Stamina Plus 15%; 6% Chance to cast level 5 Blizzard on striking; 180-220% Enhanced Damage; +30% Increased Attack Speed; +2 to Holy Freeze (native class only); +2 to Holy Shock (native class only)<br>RAW: `manasteal(_;8;8); ignore-ac(_;1;1); regen-mana(_;10;10); regen-stam(_;15;15); hit-skill(59;6;5); dmg%(_;180;220); swing2(_;30;30); skill(114;2;2); skill(118;2;2)` |
| 148 | The Fetid Sprinkler | Holy Water Sprinkler `9qs` | 46 /38 | 1; 0; 0; 0 | 5 /5000 | +2 to Paladin Skill Levels; 5% Chance to cast level 1 Decrepify on striking; 10% Chance to cast level 1 Confuse on striking; Approx. 159.766 Poison Damage over 4s; authoritative rate 409–409/256 per frame; 160-190% Enhanced Damage; +150-200 to Attack Rating; Adds 15–25 Physical Damage (paired endpoints)<br>RAW: `pal(_;2;2); hit-skill(87;5;1); hit-skill(81;10;1); dmg-pois(100;409;409); dmg%(_;160;190); att(_;150;200); dmg-norm(_;15;25)` |
| 149 | Hand of Blessed Light | Divine Scepter `9ws` | 50 /42 | 1; 0; 0; 0 | 5 /5000 | +2 to Paladin Skill Levels; 130-160% Enhanced Damage; 100% Bonus to Attack Rating; +50 Defense; Regenerate Mana 15%; +4 to Light Radius; Adds 20–45 Physical Damage (paired endpoints); +4 to Holy Bolt (native class only); +2 to Fist of the Heavens (native class only); 5% Chance to cast level 4 Fist of the Heavens on striking<br>RAW: `pal(_;2;2); dmg%(_;130;160); att%(_;100;100); ac(_;50;50); regen-mana(_;15;15); light(_;4;4); dmg-norm(_;20;45); skill(101;4;4); skill(121;2;2); hit-skill(121;5;4)` |
| 150 | Fleshrender | Barbed Club `9sp` | 46 /38 | 1; 0; 0; 0 | 5 /5000 | 25% Chance of Open Wounds; Prevent Monster Heal; 20% Chance of Crushing Blow; 20% Deadly Strike; Adds 35–50 Physical Damage (paired endpoints); 130-200% Enhanced Damage; +1 to Druid Skill Levels; +2 to Shape Shifting (Druid) Skills; +20 Maximum Durability<br>RAW: `openwounds(_;25;25); noheal(_;1;1); crush(_;20;20); deadly(_;20;20); dmg-norm(_;35;50); dmg%(_;130;200); dru(_;1;1); skilltab(16;2;2); dur(_;20;20)` |
| 151 | Sureshrill Frost | Flanged Mace `9ma` | 47 /39 | 1; 0; 0; 0 | 5 /5000 | Adds 63-112 Cold Damage (5s chill); Cannot Be Frozen; 150-180% Enhanced Damage; Adds 5–10 Physical Damage (paired endpoints); Freezes Target +3; Level 9 Frozen Orb (50 Charges)<br>RAW: `dmg-cold(125;63;112); nofreeze(_;1;1); dmg%(_;150;180); dmg-norm(_;5;10); freeze(_;3;3); charged(64;50;9)` |
| 152 | Moonfall | Jagged Star `9mt` | 50 /42 | 1; 0; 0; 0 | 5 /5000 | 5% Chance to cast level 6 Meteor on striking; Adds 55-115 Fire Damage; Magic Damage Reduced by 9-12; 120-150% Enhanced Damage; +2 to Light Radius; Level 11 Meteor (60 Charges); Adds 10–15 Physical Damage (paired endpoints)<br>RAW: `hit-skill(56;5;6); dmg-fire(_;55;115); red-mag(_;9;12); dmg%(_;120;150); light(_;2;2); charged(56;60;11); dmg-norm(_;10;15)` |
| 153 | Baezil's Vortex | Knout `9fl` | 53 /45 | 1; 0; 0; 0 | 5 /5000 | 5% Chance to cast level 8 Nova on striking; Adds 1-150 Lightning Damage; +100 to Mana; Lightning Resist +25%; 160-200% Enhanced Damage; +20% Increased Attack Speed; Level 15 Nova (80 Charges)<br>RAW: `hit-skill(48;5;8); dmg-ltng(_;1;150); mana(_;100;100); res-ltng(_;25;25); dmg%(_;160;200); swing2(_;20;20); charged(48;80;15)` |
| 154 | Earthshaker | Battle Hammer `9wh` | 51 /43 | 1; 0; 0; 0 | 5 /5000 | 5% Chance to cast level 7 Eruption on striking; Knockback; +30% Increased Attack Speed; 180% Enhanced Damage; Hit Blinds Target +1; +3 to Elemental (Druid) Skills; +50 Maximum Durability<br>RAW: `hit-skill(234;5;7); knock(_;1;1); swing3(_;30;30); dmg%(_;180;180); stupidity(_;1;1); skilltab(17;3;3); dur(_;50;50)` |
| 155 | Bloodtree Stump | War Club `9m9` | 56 /48 | 1; 0; 0; 0 | 5 /5000 | 50% Chance of Crushing Blow; 180-220% Enhanced Damage; All Resistances +20; +25 to Strength; +2 to Masteries (Barbarian) Skills; +3 to Mace Mastery (native class only); +40 Maximum Durability<br>RAW: `crush(_;50;50); dmg%(_;180;220); res-all(_;20;20); str(_;25;25); skilltab(13;2;2); skill(129;3;3); dur(_;40;40)` |
| 156 | The Gavel of Pain | Martel de Fer `9gm` | 53 /45 | 1; 0; 0; 0 | 5 /5000 | 5% Chance to cast level 1 Amplify Damage on striking; 5% Chance to cast level 1 Iron Maiden when struck; Attacker Takes Damage of 26; Indestructible; Adds 12–30 Physical Damage (paired endpoints); 130-160% Enhanced Damage; Level 8 Amplify Damage (3 Charges)<br>RAW: `hit-skill(66;5;1); gethit-skill(76;5;1); thorns(_;26;26); indestruct(_;1;1); dmg-norm(_;12;30); dmg%(_;130;160); charged(66;3;8)` |
| 157 | Bloodletter | Gladius `9ss` | 38 /30 | 1; 0; 0; 0 | 5 /5000 | Adds 12–45 Physical Damage (paired endpoints); +90 to Attack Rating; 8% Life Stolen per Hit; 10% Slower Stamina Drain; +20% Increased Attack Speed; 140% Enhanced Damage; +2-4 to Sword Mastery (native class only); +1-3 to Whirlwind (native class only); +30 Maximum Durability<br>RAW: `dmg-norm(_;12;45); att(_;90;90); lifesteal(_;8;8); stamdrain(_;10;10); swing2(_;20;20); dmg%(_;140;140); skill(127;2;4); skill(151;1;3); dur(_;30;30)` |
| 158 | Coldsteel Eye | Cutlass `9sm` | 39 /31 | 1; 0; 0; 0 | 5 /5000 | Hit Blinds Target +1; Slows Target by 30%; 50% Deadly Strike; +50 Maximum Durability; 200-250% Enhanced Damage; +20% Increased Attack Speed; 6% Mana Stolen per Hit<br>RAW: `stupidity(_;1;1); slow(_;30;30); deadly(_;50;50); dur(_;50;50); dmg%(_;200;250); swing2(_;20;20); manasteal(_;6;6)` |
| 159 | Hexfire | Shamshir `9sb` | 41 /33 | 1; 0; 0; 0 | 5 /5000 | Level 6 Hydra (36 Charges); Ignore Target's Defense; Fire Resist +25%; +10% to Maximum Fire Resist; Adds 35–40 Physical Damage (paired endpoints); 140-160% Enhanced Damage; +3 to Fire Skills<br>RAW: `charged(62;36;6); ignore-ac(_;1;1); res-fire(_;25;25); res-fire-max(_;10;10); dmg-norm(_;35;40); dmg%(_;140;160); fireskill(_;3;3)` |
| 160 | Blade of Ali Baba | Tulwar `9fc` | 43 /35 | 1; 0; 0; 0 | 5 /5000 | Socketed (3); +2.5 % Extra Gold per clvl (floor after scaling); +1 % Magic Find per clvl (floor after scaling); +15 to Mana; 60-120% Enhanced Damage; +5-15 to Dexterity<br>RAW: `sock(3;_;_); gold%/lvl(20;_;_); mag%/lvl(8;_;_); mana(_;15;15); dmg%(_;60;120); dex(_;5;15)` |
| 161 | Ginther's Rift | Dimensional Blade `9cr` | 45 /37 | 1; 0; 0; 0 | 5 /5000 | Magic Damage Reduced by 7-12; +30% Increased Attack Speed; Repairs 1 Durability every 5s (rate 20); +40 Maximum Durability; Adds 50-120 Magic Damage; 100-150% Enhanced Damage<br>RAW: `red-mag(_;7;12); swing2(_;30;30); rep-dur(20;_;_); dur(_;40;40); dmg-mag(_;50;120); dmg%(_;100;150)` |
| 162 | Headstriker | Battle Sword `9bs` | 47 /39 | 1; 0; 0; 0 | 5 /5000 | Prevent Monster Heal; +15 to Strength; +1.5 % Deadly Strike per clvl (floor after scaling); +1 Maximum Damage per clvl (floor after scaling); 150% Enhanced Damage<br>RAW: `noheal(_;1;1); str(_;15;15); deadly/lvl(12;_;_); dmg/lvl(8;_;_); dmg%(_;150;150)` |
| 163 | Plague Bearer | Rune Sword `9ls` | 49 /41 | 1; 0; 0; 0 | 5 /5000 | 5% Chance to cast level 4 Poison Nova on striking; Approx. 300 Poison Damage over 8s; authoritative rate 384–384/256 per frame; Adds 10–45 Physical Damage (paired endpoints); 150% Enhanced Damage; Poison Resist +45%; +5 to Rabies (native class only)<br>RAW: `hit-skill(92;5;4); dmg-pois(200;384;384); dmg-norm(_;10;45); dmg%(_;150;150); res-pois(_;45;45); skill(238;5;5)` |
| 164 | The Atlantean [source: The Atlantian] | Ancient Sword `9wd` | 50 /42 | 1; 0; 0; 0 | 5 /5000 | +100 Maximum Durability; +75 Defense; +16 to Strength; +12 to Dexterity; +8 to Vitality; 200-250% Enhanced Damage; +2 to Paladin Skill Levels; 50% Bonus to Attack Rating<br>RAW: `dur(_;100;100); ac(_;75;75); str(_;16;16); dex(_;12;12); vit(_;8;8); dmg%(_;200;250); pal(_;2;2); att%(_;50;50)` |
| 165 | Crainte Vomir | Espadon `92h` | 50 /42 | 1; 0; 0; 0 | 5 /5000 | Slows Target by 35%; -70 to Monster Defense Per Hit; +20% Faster Run/Walk; Damage Reduced by 10%; 160-200% Enhanced Damage; +50% Increased Attack Speed<br>RAW: `slow(_;35;35); dmg-ac(_;-70;-70); move2(_;20;20); red-dmg%(_;10;10); dmg%(_;160;200); swing3(_;50;50)` |
| 166 | Bing Sz Wang | Dacian Falx `9cm` | 51 /43 | 1; 0; 0; 0 | 5 /5000 | Requirements -30%; Adds 50-140 Cold Damage (3s chill); +20 to Strength; Freezes Target +2; 5% Chance to cast level 3 Frozen Orb on striking; 130-160% Enhanced Damage<br>RAW: `ease(_;-30;-30); dmg-cold(75;50;140); str(_;20;20); freeze(_;2;2); hit-skill(64;5;3); dmg%(_;130;160)` |
| 167 | The Vile Husk | Tusk Sword `9gs` | 52 /44 | 1; 0; 0; 0 | 5 /5000 | 6% Chance to cast level 1 Amplify Damage on striking; +7.5 % Dmg to Undead per clvl (floor after scaling); Poison Resist +50%; Approx. 249.609 Poison Damage over 6s; authoritative rate 426–426/256 per frame; 150-200% Enhanced Damage; +10 AR vs Undead per clvl (floor after scaling)<br>RAW: `hit-skill(66;6;1); dmg-und/lvl(60;_;_); res-pois(_;50;50); dmg-pois(150;426;426); dmg%(_;150;200); att-und/lvl(20;_;_)` |
| 168 | Cloudcrack | Gothic Sword `9b9` | 53 /45 | 1; 0; 0; 0 | 5 /5000 | 6% Chance to cast level 7 Fist of the Heavens on striking; Adds 1-240 Lightning Damage; +30 Defense; +2 to Light Radius; +10% to Maximum Lightning Resist; 150-200% Enhanced Damage; Attacker Takes Lightning Damage of 15; +2 to Offensive Auras (Paladin) Skills; +2 to Defensive Auras (Paladin) Skills<br>RAW: `hit-skill(121;6;7); dmg-ltng(_;1;240); ac(_;30;30); light(_;2;2); res-ltng-max(_;10;10); dmg%(_;150;200); light-thorns(_;15;15); skilltab(10;2;2); skilltab(11;2;2)` |
| 169 | Todesfaelle Flamme | Zweihander `9fb` | 54 /46 | 1; 0; 0; 0 | 5 /5000 | Adds 50-200 Fire Damage; Fire Resist +40%; +10 Fire Absorb; 10% Chance to cast level 6 Fire Ball on attack; 120-160% Enhanced Damage; Level 10 Enchant (45 Charges); Level 10 Fire Wall (20 Charges)<br>RAW: `dmg-fire(_;50;200); res-fire(_;40;40); abs-fire(_;10;10); att-skill(47;10;6); dmg%(_;120;160); charged(52;45;10); charged(51;20;10)` |
| 170 | Swordguard | Executioner Sword `9gd` | 55 /48 | 1; 0; 0; 0 | 5 /5000 | Requirements -50%; +5 Defense per clvl (floor after scaling); All Resistances +10-20; +100 Defense vs. Missile; 30% Damage Taken Goes To Mana; 170-180% Enhanced Damage; +200 Defense vs. Melee; +20% Faster Hit Recovery; 20% Increased Chance of Blocking<br>RAW: `ease(_;-50;-50); ac/lvl(40;_;_); res-all(_;10;20); ac-miss(_;100;100); dmg-to-mana(_;30;30); dmg%(_;170;180); ac-hth(_;200;200); balance2(_;20;20); block(_;20;20)` |
| 171 | Spineripper | Poignard `9dg` | 40 /32 | 1; 0; 0; 0 | 5 /5000 | Ignore Target's Defense; 8% Life Stolen per Hit; Prevent Monster Heal; +15% Increased Attack Speed; +10 to Dexterity; 200-240% Enhanced Damage; Adds 15–27 Physical Damage (paired endpoints); +1 to Necromancer Skill Levels<br>RAW: `ignore-ac(_;1;1); lifesteal(_;8;8); noheal(_;1;1); swing3(_;15;15); dex(_;10;10); dmg%(_;200;240); dmg-norm(_;15;27); nec(_;1;1)` |
| 172 | Heart Carver | Rondel `9di` | 44 /36 | 1; 0; 0; 0 | 5 /5000 | 35% Deadly Strike; Ignore Target's Defense; Adds 15–35 Physical Damage (paired endpoints); 190-240% Enhanced Damage; +4 to Find Potion (native class only); +4 to Find Item (native class only); +4 to Grim Ward (native class only)<br>RAW: `deadly(_;35;35); ignore-ac(_;1;1); dmg-norm(_;15;35); dmg%(_;190;240); skill(131;4;4); skill(142;4;4); skill(150;4;4)` |
| 173 | Blackbog's Sharp | Cinquedeas `9kr` | 46 /38 | 1; 0; 0; 0 | 5 /5000 | Slows Target by 50%; +50 Defense; Adds 15–45 Physical Damage (paired endpoints); +30% Increased Attack Speed; Approx. 488.281 Poison Damage over 10s; authoritative rate 500–500/256 per frame; +5 to Poison Dagger (native class only); +4 to Poison Explosion (native class only); +4 to Poison Nova (native class only)<br>RAW: `slow(_;50;50); ac(_;50;50); dmg-norm(_;15;45); swing3(_;30;30); dmg-pois(250;500;500); skill(73;5;5); skill(83;4;4); skill(92;4;4)` |
| 174 | Stormspike | Stiletto `9bl` | 49 /41 | 1; 0; 0; 0 | 5 /5000 | Adds 1-120 Lightning Damage; Attacker Takes Lightning Damage of 20; 25% Chance to cast level 3 Charged Bolt when struck; 150% Enhanced Damage; +1 % Lightning Resist per clvl (floor after scaling)<br>RAW: `dmg-ltng(_;1;120); light-thorns(_;20;20); gethit-skill(38;25;3); dmg%(_;150;150); res-ltng/lvl(8;_;_)` |
| 175 | The Impaler | War Spear `9sr` | 39 /31 | 1; 0; 0; 0 | 5 /5000 | Ignore Target's Defense; +150 to Attack Rating; +20% Increased Attack Speed; 40% Chance of Open Wounds; Prevent Monster Heal; 140-170% Enhanced Damage; +5 to Impale (native class only); +3 to Power Strike (native class only)<br>RAW: `ignore-ac(_;1;1); att(_;150;150); swing2(_;20;20); openwounds(_;40;40); noheal(_;1;1); dmg%(_;140;170); skill(19;5;5); skill(14;3;3)` |
| 176 | Kelpie Snare | Fuscina `9tr` | 41 /33 | 1; 0; 0; 0 | 5 /5000 | Slows Target by 75%; Fire Resist +50%; +1.25 Life per clvl (floor after scaling); Adds 30–50 Physical Damage (paired endpoints); +10 to Strength; 140-180% Enhanced Damage<br>RAW: `slow(_;75;75); res-fire(_;50;50); hp/lvl(10;_;_); dmg-norm(_;30;50); str(_;10;10); dmg%(_;140;180)` |
| 177 | Soulfeast Tine | War Fork `9br` | 43 /35 | 1; 0; 0; 0 | 5 /5000 | Requirements -20%; 7% Life Stolen per Hit; 7% Mana Stolen per Hit; 20% Slower Stamina Drain; 150-190% Enhanced Damage; +150-250 to Attack Rating; +15 Maximum Durability<br>RAW: `ease(_;-20;-20); lifesteal(_;7;7); manasteal(_;7;7); stamdrain(_;20;20); dmg%(_;150;190); att(_;150;250); dur(_;15;15)` |
| 178 | Hone Sundan | Yari `9st` | 45 /37 | 1; 0; 0; 0 | 5 /5000 | Socketed (3); Adds 20–40 Physical Damage (paired endpoints); 45% Chance of Crushing Blow; Repairs 1 Durability every 10s (rate 10); 160-200% Enhanced Damage<br>RAW: `sock(3;_;_); dmg-norm(_;20;40); crush(_;45;45); rep-dur(10;_;_); dmg%(_;160;200)` |
| 179 | Spire of Honor | Lance `9p9` | 47 /39 | 1; 0; 0; 0 | 5 /5000 | 25% Bonus to Attack Rating; +3 to Light Radius; Replenish Life +20; +20% Faster Hit Recovery; Adds 20–40 Physical Damage (paired endpoints); +1.5 % Dmg to Demons per clvl (floor after scaling); 150-200% Enhanced Damage; +3 to Combat (Paladin) Skills; 25% Enhanced Defense<br>RAW: `att%(_;25;25); light(_;3;3); regen(_;20;20); balance2(_;20;20); dmg-norm(_;20;40); dmg-dem/lvl(12;_;_); dmg%(_;150;200); skilltab(9;3;3); ac%(_;25;25)` |
| 180 | The Meat Scraper | Lochaber Axe `9b7` | 49 /41 | 1; 0; 0; 0 | 5 /5000 | 150-200% Enhanced Damage; +30% Increased Attack Speed; 10% Life Stolen per Hit; 50% Chance of Open Wounds; 25% Better Chance of Getting Magic Items; +3 to Masteries (Barbarian) Skills<br>RAW: `dmg%(_;150;200); swing2(_;30;30); lifesteal(_;10;10); openwounds(_;50;50); mag%(_;25;25); skilltab(13;3;3)` |
| 181 | Blackleach Blade | Bill `9vo` | 50 /42 | 1; 0; 0; 0 | 5 /5000 | Requirements -25%; 5% Chance to cast level 5 Weaken on striking; -2 to Light Radius; 8% Life Stolen per Hit; +1.25 Maximum Damage per clvl (floor after scaling); 100-140% Enhanced Damage<br>RAW: `ease(_;-25;-25); hit-skill(72;5;5); light(_;-2;-2); lifesteal(_;8;8); dmg/lvl(10;_;_); dmg%(_;100;140)` |
| 182 | Athena's Wrath | Battle Scythe `9s8` | 50 /42 | 1; 0; 0; 0 | 5 /5000 | +1-3 to Druid Skill Levels; +15 to Dexterity; +30% Increased Attack Speed; +1 Life per clvl (floor after scaling); +1 Maximum Damage per clvl (floor after scaling); 150-180% Enhanced Damage<br>RAW: `dru(_;1;3); dex(_;15;15); swing2(_;30;30); hp/lvl(8;_;_); dmg/lvl(8;_;_); dmg%(_;150;180)` |
| 183 | Pierre Tombale Couant | Partizan `9pa` | 51 /43 | 1; 0; 0; 0 | 5 /5000 | 55% Deadly Strike; +3 to Barbarian Skill Levels; +30% Faster Hit Recovery; 6% Mana Stolen per Hit; Adds 12–20 Physical Damage (paired endpoints); 160-220% Enhanced Damage; +100-200 to Attack Rating<br>RAW: `deadly(_;55;55); bar(_;3;3); balance2(_;30;30); manasteal(_;6;6); dmg-norm(_;12;20); dmg%(_;160;220); att(_;100;200)` |
| 184 | Husoldal Evo | Bec-de-Corbin `9h9` | 52 /44 | 1; 0; 0; 0 | 5 /5000 | Replenish Life +20; +200-250 to Attack Rating; Prevent Monster Heal; Adds 20–32 Physical Damage (paired endpoints); 160-200% Enhanced Damage; +20% Increased Attack Speed<br>RAW: `regen(_;20;20); att(_;200;250); noheal(_;1;1); dmg-norm(_;20;32); dmg%(_;160;200); swing2(_;20;20)` |
| 185 | Grim's Burning Dead | Grim Scythe `9wc` | 52 /45 | 1; 0; 0; 0 | 5 /5000 | Adds 131-232 Fire Damage; Fire Resist +45%; 140-180% Enhanced Damage; Attacker Takes Damage of 8; Requirements -50%; +3 to Necromancer Skill Levels; -50% Target Defense; 20% Enhanced Defense; +200-250 to Attack Rating<br>RAW: `dmg-fire(_;131;232); res-fire(_;45;45); dmg%(_;140;180); thorns(_;8;8); ease(_;-50;-50); nec(_;3;3); reduce-ac(_;50;50); ac%(_;20;20); att(_;200;250)` |
| 186 | Razorswitch | Jo Staff `8ss` | 36 /28 | 1; 0; 0; 0 | 5 /5000 | +30% Faster Cast Rate; Attacker Takes Damage of 15; +175 to Mana; +80 to Life; Magic Damage Reduced by 15; All Resistances +50; +1 to All Skills<br>RAW: `cast3(_;30;30); thorns(_;15;15); mana(_;175;175); hp(_;80;80); red-mag(_;15;15); res-all(_;50;50); allskills(_;1;1)` |
| 187 | Ribcracker | Quarterstaff `8ls` | 39 /31 | 1; 0; 0; 0 | 5 /5000 | Adds 30–65 Physical Damage (paired endpoints); 200-300% Enhanced Damage; 50% Chance of Crushing Blow; +15 to Dexterity; +100 Defense; 100% Enhanced Defense; +50% Faster Hit Recovery; +50% Increased Attack Speed; +100 Maximum Durability<br>RAW: `dmg-norm(_;30;65); dmg%(_;200;300); crush(_;50;50); dex(_;15;15); ac(_;100;100); ac%(_;100;100); balance2(_;50;50); swing2(_;50;50); dur(_;100;100)` |
| 188 | Chromatic Ire | Cedar Staff `8cs` | 43 /35 | 1; 0; 0; 0 | 5 /5000 | +3 to Sorceress Skill Levels; All Resistances +20-40; +20% Faster Cast Rate; Attacker Takes Lightning Damage of 20; Increase Maximum Life 20-25%; +1 to Fire Mastery (native class only); +1 to Lightning Mastery (native class only); +1 to Cold Mastery (native class only)<br>RAW: `sor(_;3;3); res-all(_;20;40); cast1(_;20;20); light-thorns(_;20;20); hp%(_;20;25); skill(61;1;1); skill(63;1;1); skill(65;1;1)` |
| 189 | Warpspear | Gothic Staff `8bs` | 47 /39 | 1; 0; 0; 0 | 5 /5000 | +3 to Sorceress Skill Levels; Ignore Target's Defense; +3 to Teleport (native class only); +3 to Telekinesis (native class only); +3 to Energy Shield (native class only); +250 Defense vs. Missile<br>RAW: `sor(_;3;3); ignore-ac(_;1;1); skill(54;3;3); skill(43;3;3); skill(58;3;3); ac-miss(_;250;250)` |
| 190 | Skullcollector | Rune Staff `8ws` | 49 /41 | 1; 0; 0; 0 | 5 /5000 | Increase Maximum Mana 20%; +20 to Mana after each Kill; +2 to All Skills; +1 % Magic Find per clvl (floor after scaling)<br>RAW: `mana%(_;20;20); mana-kill(_;20;20); allskills(_;2;2); mag%/lvl(8;_;_)` |
| 191 | Skystrike | Edge Bow `8sb` | 36 /28 | 1; 0; 0; 0 | 5 /5000 | Adds 1-250 Lightning Damage; +100 to Attack Rating; +10 to Energy; +30% Increased Attack Speed; 150-200% Enhanced Damage; 2% Chance to cast level 6 Meteor on striking; +1 to Amazon Skill Levels<br>RAW: `dmg-ltng(_;1;250); att(_;100;100); enr(_;10;10); swing3(_;30;30); dmg%(_;150;200); hit-skill(56;2;6); ama(_;1;1)` |
| 192 | Riphook | Razor Bow `8hb` | 39 /31 | 1; 0; 0; 0 | 5 /5000 | 30% Chance of Open Wounds; 180-220% Enhanced Damage; Slows Target by 30%; +35 to Mana; +30% Increased Attack Speed; 7-10% Life Stolen per Hit<br>RAW: `openwounds(_;30;30); dmg%(_;180;220); slow(_;30;30); mana(_;35;35); swing2(_;30;30); lifesteal(_;7;10)` |
| 193 | Kuko Shakaku | Cedar Bow `8lb` | 41 /33 | 1; 0; 0; 0 | 5 /5000 | +3 to Immolation Arrow (native class only); Fires Explosive Arrows or Bolts (level 7); 150-180% Enhanced Damage; 50% Chance to Pierce; Adds 40-180 Fire Damage; +3 to Bow and Crossbow (Amazon) Skills<br>RAW: `skill(27;3;3); explosivearrow(_;7;7); dmg%(_;150;180); pierce(_;50;50); dmg-fire(_;40;180); skilltab(0;3;3)` |
| 194 | Endlesshail | Double Bow `8cb` | 44 /36 | 1; 0; 0; 0 | 5 /5000 | Cold Resist +35%; +40 to Mana; +50 Defense vs. Missile; +3-5 to Strafe (native class only); 180-220% Enhanced Damage; Adds 15-30 Cold Damage (3s chill)<br>RAW: `res-cold(_;35;35); mana(_;40;40); ac-miss(_;50;50); skill(26;3;5); dmg%(_;180;220); dmg-cold(75;15;30)` |
| 195 | Witchwild String [source: Whichwild String] | Short Siege Bow `8s8` | 47 /39 | 1; 0; 0; 0 | 5 /5000 | 2% Chance to cast level 5 Amplify Damage on striking; All Resistances +40; +1 % Deadly Strike per clvl (floor after scaling); 150-170% Enhanced Damage; Fires Magic Arrows (level 20); Socketed (2)<br>RAW: `hit-skill(66;2;5); res-all(_;40;40); deadly/lvl(8;_;_); dmg%(_;150;170); magicarrow(_;20;20); sock(2;_;_)` |
| 196 | Cliffkiller | Long Siege Bow `8l8` | 49 /41 | 1; 0; 0; 0 | 5 /5000 | +2 to Amazon Skill Levels; 190-230% Enhanced Damage; +80 Defense vs. Missile; Knockback; +50 to Life; +5-10 to Minimum Damage; +20-30 to Maximum Damage<br>RAW: `ama(_;2;2); dmg%(_;190;230); ac-miss(_;80;80); knock(_;1;1); hp(_;50;50); dmg-min(_;5;10); dmg-max(_;20;30)` |
| 197 | Magewrath | Rune Bow `8sw` | 51 /43 | 1; 0; 0; 0 | 5 /5000 | 15% Mana Stolen per Hit; Magic Damage Reduced by 9-13; +3 to Guided Arrow (native class only); +200-250 to Attack Rating; +10 to Dexterity; Hit Blinds Target +1; Adds 25–50 Physical Damage (paired endpoints); 120-150% Enhanced Damage; +1 to Amazon Skill Levels<br>RAW: `manasteal(_;15;15); red-mag(_;9;13); skill(22;3;3); att(_;200;250); dex(_;10;10); stupidity(_;1;1); dmg-norm(_;25;50); dmg%(_;120;150); ama(_;1;1)` |
| 198 | Goldstrike Arch [source: Godstrike Arch] | Gothic Bow `8lw` | 54 /46 | 1; 0; 0; 0 | 5 /5000 | 200-250% Enhanced Damage; 100-150% Bonus to Attack Rating; +100-200% Damage to Undead; +100-200% Damage to Demons; 5% Chance to cast level 7 Fist of the Heavens on striking; +50% Increased Attack Speed; Replenish Life +12<br>RAW: `dmg%(_;200;250); att%(_;100;150); dmg-undead(_;100;200); dmg-demon(_;100;200); hit-skill(121;5;7); swing2(_;50;50); regen(_;12;12)` |
| 199 | Langer Briser | Arbalest `8lx` | 40 /32 | 1; 0; 0; 0 | 5 /5000 | Knockback; 170-200% Enhanced Damage; 30-60% Better Chance of Getting Magic Items; +30 to Life; +10-30 to Maximum Damage; 33% Chance of Open Wounds; Adds 1-212 Lightning Damage<br>RAW: `knock(_;1;1); dmg%(_;170;200); mag%(_;30;60); hp(_;30;30); dmg-max(_;10;30); openwounds(_;33;33); dmg-ltng(_;1;212)` |
| 200 | Pus Spitter [source: Pus Spiter] | Siege Crossbow `8mx` | 44 /36 | 1; 0; 0; 0 | 5 /5000 | Approx. 150 Poison Damage over 8s; authoritative rate 192–192/256 per frame; 4% Chance to cast level 1 Lower Resist on striking; +2 to Necromancer Skill Levels; Requirements -60%; 9% Chance to cast level 6 Poison Nova when struck; +10% Increased Attack Speed; 150-220% Enhanced Damage; +5 Attack Rating per clvl (floor after scaling)<br>RAW: `dmg-pois(200;192;192); hit-skill(91;4;1); nec(_;2;2); ease(_;-60;-60); gethit-skill(92;9;6); swing2(_;10;10); dmg%(_;150;220); att/lvl(10;_;_)` |
| 201 | Buriza-Do Kyanon | Ballista `8hx` | 59 /41 | 1; 0; 0; 0 | 5 /5000 | 100% Chance to Pierce; +35 to Dexterity; +75-150 Defense; +2.5 Maximum Damage per clvl (floor after scaling); +80% Increased Attack Speed; 150-200% Enhanced Damage; Freezes Target +3; Adds 32-196 Cold Damage (8s chill)<br>RAW: `pierce(_;100;100); dex(_;35;35); ac(_;75;150); dmg/lvl(20;_;_); swing2(_;80;80); dmg%(_;150;200); freeze(_;3;3); dmg-cold(200;32;196)` |
| 202 | Demon Machine | Chu-Ko-Nu `8rx` | 57 /49 | 1; 0; 0; 0 | 5 /5000 | +321 Defense; +36 to Mana; 66% Chance to Pierce; Fires Explosive Arrows or Bolts (level 6); +66 to Maximum Damage; 123% Enhanced Damage; +632 to Attack Rating<br>RAW: `ac(_;321;321); mana(_;36;36); pierce(_;66;66); explosivearrow(_;6;6); dmg-max(_;66;66); dmg%(_;123;123); att(_;632;632)` |
| 204 | Peasant Crown [source: Peasent Crown] | War Hat `xap` **QUEST** | 36 /28 | 1; 0; 0; 0 | 3 /5000 | +20 to Energy; +20 to Vitality; +1 to All Skills; +15% Faster Run/Walk; Replenish Life +6-12; 100% Enhanced Defense<br>RAW: `enr(_;20;20); vit(_;20;20); allskills(_;1;1); move2(_;15;15); regen(_;6;12); ac%(_;100;100)` |
| 205 | Rockstopper | Sallet `xkp` **QUEST** | 39 /31 | 1; 0; 0; 0 | 3 /5000 | Lightning Resist +20-40%; Damage Reduced by 10%; +30% Faster Hit Recovery; 160-220% Enhanced Defense; Fire Resist +20-50%; Cold Resist +20-40%; +15 to Vitality<br>RAW: `res-ltng(_;20;40); red-dmg%(_;10;10); balance2(_;30;30); ac%(_;160;220); res-fire(_;20;50); res-cold(_;20;40); vit(_;15;15)` |
| 206 | Stealskull | Casque `xlm` **QUEST** | 43 /35 | 1; 0; 0; 0 | 3 /5000 | 5% Mana Stolen per Hit; 5% Life Stolen per Hit; +10% Faster Hit Recovery; +10% Increased Attack Speed; 200-240% Enhanced Defense; 30-50% Better Chance of Getting Magic Items<br>RAW: `manasteal(_;5;5); lifesteal(_;5;5); balance2(_;10;10); swing2(_;10;10); ac%(_;200;240); mag%(_;30;50)` |
| 207 | Darksight Helm | Basinet `xhl` **QUEST** | 46 /38 | 1; 0; 0; 0 | 3 /5000 | -4 to Light Radius; +2 Defense per clvl (floor after scaling); Cannot Be Frozen; 5% Mana Stolen per Hit; 6% Chance to cast level 3 Dim Vision when struck; Level 5 Cloak of Shadows (30 Charges); Fire Resist +20-40%<br>RAW: `light(_;-4;-4); ac/lvl(16;_;_); nofreeze(_;1;1); manasteal(_;5;5); gethit-skill(71;6;3); charged(264;30;5); res-fire(_;20;40)` |
| 208 | Valkyrie Wing [source: Valkiry Wing] | Winged Helm `xhm` **QUEST** | 52 /44 | 1; 0; 0; 0 | 3 /5000 | 150-200% Enhanced Defense; +20% Faster Run/Walk; +20% Faster Hit Recovery; +1-2 to Amazon Skill Levels; +2-4 to Mana after each Kill<br>RAW: `ac%(_;150;200); move2(_;20;20); balance2(_;20;20); ama(_;1;2); mana-kill(_;2;4)` |
| 209 | Crown of Thieves | Grand Crown `xrn` **QUEST** | 57 /49 | 1; 0; 0; 0 | 3 /5000 | +25 to Dexterity; 9-12% Life Stolen per Hit; +50 to Life; +35 to Mana; Fire Resist +33%; 160-200% Enhanced Defense; 80-100% Extra Gold from Monsters<br>RAW: `dex(_;25;25); lifesteal(_;9;12); hp(_;50;50); mana(_;35;35); res-fire(_;33;33); ac%(_;160;200); gold%(_;80;100)` |
| 210 | Blackhorn's Face | Death Mask `xsk` **QUEST** | 49 /41 | 1; 0; 0; 0 | 3 /5000 | Attacker Takes Lightning Damage of 25; Slows Target by 20%; Prevent Monster Heal; +20 Lightning Absorb; Lightning Resist +15%; 180-220% Enhanced Defense<br>RAW: `light-thorns(_;25;25); slow(_;20;20); noheal(_;1;1); abs-ltng(_;20;20); res-ltng(_;15;15); ac%(_;180;220)` |
| 211 | Vampire Gaze [source: Vampiregaze] | Grim Helm `xh9` **QUEST** | 49 /41 | 1; 0; 0; 0 | 3 /5000 | 6-8% Mana Stolen per Hit; 6-8% Life Stolen per Hit; 15% Slower Stamina Drain; Damage Reduced by 15-20%; Magic Damage Reduced by 10-15; 100% Enhanced Defense; Adds 6-22 Cold Damage (4s chill)<br>RAW: `manasteal(_;6;8); lifesteal(_;6;8); stamdrain(_;15;15); red-dmg%(_;15;20); red-mag(_;10;15); ac%(_;100;100); dmg-cold(100;6;22)` |
| 212 | The Spirit Shroud | Ghost Armor `xui` **QUEST** | 36 /28 | 1; 0; 0; 0 | 3 /5000 | Cannot Be Frozen; +1 to All Skills; Magic Damage Reduced by 7-11; Replenish Life +10; 150% Enhanced Defense<br>RAW: `nofreeze(_;1;1); allskills(_;1;1); red-mag(_;7;11); regen(_;10;10); ac%(_;150;150)` |
| 213 | Skin of the Vipermagi | Serpentskin Armor `xea` **QUEST** | 37 /29 | 1; 0; 0; 0 | 3 /5000 | 120% Enhanced Defense; All Resistances +20-35; +30% Faster Cast Rate; Magic Damage Reduced by 9-13; +1 to All Skills<br>RAW: `ac%(_;120;120); res-all(_;20;35); cast3(_;30;30); red-mag(_;9;13); allskills(_;1;1)` |
| 214 | Skin of the Flayed One [source: Skin of the Flayerd One] | Demonhide Armor `xla` **QUEST** | 39 /31 | 1; 0; 0; 0 | 3 /5000 | Repairs 1 Durability every 10s (rate 10); Replenish Life +15-25; +30 Maximum Durability; 5-7% Life Stolen per Hit; 150-190% Enhanced Defense; Attacker Takes Damage of 15<br>RAW: `rep-dur(10;_;_); regen(_;15;25); dur(_;30;30); lifesteal(_;5;7); ac%(_;150;190); thorns(_;15;15)` |
| 215 | Iron Pelt [source: Ironpelt] | Trellised Armor `xtu` **QUEST** | 41 /33 | 1; 0; 0; 0 | 3 /5000 | +125 Maximum Durability; +25 to Life; Magic Damage Reduced by 10-16; Damage Reduced by 15-20; +3 Defense per clvl (floor after scaling); 50-100% Enhanced Defense<br>RAW: `dur(_;125;125); hp(_;25;25); red-mag(_;10;16); red-dmg(_;15;20); ac/lvl(24;_;_); ac%(_;50;100)` |
| 216 | Spirit Forge [source: Spiritforge] | Linked Mail `xng` **QUEST** | 43 /35 | 1; 0; 0; 0 | 3 /5000 | +4 to Light Radius; +1.25 Life per clvl (floor after scaling); Adds 20-65 Fire Damage; Fire Resist +5%; 120-160% Enhanced Defense; +15 to Strength; Socketed (2)<br>RAW: `light(_;4;4); hp/lvl(10;_;_); dmg-fire(_;20;65); res-fire(_;5;5); ac%(_;120;160); str(_;15;15); sock(2;_;_)` |
| 217 | Crow Caw | Tigulated Mail `xcl` **QUEST** | 45 /37 | 1; 0; 0; 0 | 3 /5000 | 35% Chance of Open Wounds; 150-180% Enhanced Defense; +15 to Dexterity; +15% Faster Hit Recovery; +15% Increased Attack Speed<br>RAW: `openwounds(_;35;35); ac%(_;150;180); dex(_;15;15); balance2(_;15;15); swing2(_;15;15)` |
| 218 | Shaftstop | Mesh Armor `xhn` **QUEST** | 46 /38 | 1; 0; 0; 0 | 3 /5000 | +250 Defense vs. Missile; Damage Reduced by 30%; +60 to Life; 180-220% Enhanced Defense<br>RAW: `ac-miss(_;250;250); red-dmg%(_;30;30); hp(_;60;60); ac%(_;180;220)` |
| 219 | Duriel's Shell | Cuirass `xrs` **QUEST** | 49 /41 | 1; 0; 0; 0 | 3 /5000 | +15 to Strength; +1.25 Defense per clvl (floor after scaling); +1 Life per clvl (floor after scaling); 160-200% Enhanced Defense; Fire Resist +20%; Lightning Resist +20%; Poison Resist +20%; Cold Resist +50%; Cannot Be Frozen; +100 Maximum Durability<br>RAW: `str(_;15;15); ac/lvl(10;_;_); hp/lvl(8;_;_); ac%(_;160;200); res-fire(_;20;20); res-ltng(_;20;20); res-pois(_;20;20); res-cold(_;50;50); nofreeze(_;1;1); dur(_;100;100)` |
| 220 | Skullder's Ire | Russet Armor `xpl` **QUEST** | 50 /42 | 1; 0; 0; 0 | 3 /5000 | +1 to All Skills; +1.25 % Magic Find per clvl (floor after scaling); 160-200% Enhanced Defense; +60 Maximum Durability; Magic Damage Reduced by 10; Repairs 1 Durability every 5s (rate 20)<br>RAW: `allskills(_;1;1); mag%/lvl(10;_;_); ac%(_;160;200); dur(_;60;60); red-mag(_;10;10); rep-dur(20;_;_)` |
| 221 | Guardian Angel | Templar Coat `xlt` **QUEST** | 53 /45 | 1; 0; 0; 0 | 3 /5000 | +4 to Light Radius; +1 to Paladin Skill Levels; 180-200% Enhanced Defense; +30% Faster Block Rate; +15% to All Maximum Resistances; +2.5 AR vs Demons per clvl (floor after scaling); 20% Increased Chance of Blocking<br>RAW: `light(_;4;4); pal(_;1;1); ac%(_;180;200); block2(_;30;30); res-all-max(_;15;15); att-dem/lvl(5;_;_); block(_;20;20)` |
| 222 | Toothrow | Sharktooth Armor `xld` **QUEST** | 56 /48 | 1; 0; 0; 0 | 3 /5000 | Attacker Takes Damage of 20-40; +40-60 Defense; +10 to Strength; 40% Chance of Open Wounds; Fire Resist +15%; 160-220% Enhanced Defense; +15 Maximum Durability<br>RAW: `thorns(_;20;40); ac(_;40;60); str(_;10;10); openwounds(_;40;40); res-fire(_;15;15); ac%(_;160;220); dur(_;15;15)` |
| 223 | Atma's Wail | Embossed Plate `xth` **QUEST** | 59 /51 | 1; 0; 0; 0 | 3 /5000 | +15 to Dexterity; Replenish Life +10; Increase Maximum Mana 15%; +30% Faster Hit Recovery; +2 Defense per clvl (floor after scaling); +50 Maximum Durability; 120-160% Enhanced Defense; 20% Better Chance of Getting Magic Items<br>RAW: `dex(_;15;15); regen(_;10;10); mana%(_;15;15); balance2(_;30;30); ac/lvl(16;_;_); dur(_;50;50); ac%(_;120;160); mag%(_;20;20)` |
| 224 | Black Hades | Chaos Armor `xul` **QUEST** | 61 /53 | 1; 0; 0; 0 | 3 /5000 | -2 to Light Radius; +200-250 to Attack Rating against Demons; Half Freeze Duration; Socketed (3); 140-200% Enhanced Defense; +30-60% Damage to Demons<br>RAW: `light(_;-2;-2); att-demon(_;200;250); half-freeze(_;1;1); sock(3;_;_); ac%(_;140;200); dmg-demon(_;30;60)` |
| 225 | Corpsemourn | Ornate Armor `xar` **QUEST** | 63 /55 | 1; 0; 0; 0 | 3 /5000 | +8 to Strength; +10 to Vitality; Cold Resist +35%; 6% Chance to cast level 2 Iron Maiden when struck; 150-180% Enhanced Defense; Adds 12-36 Fire Damage; Level 5 Corpse Explosion (40 Charges)<br>RAW: `str(_;8;8); vit(_;10;10); res-cold(_;35;35); gethit-skill(76;6;2); ac%(_;150;180); dmg-fire(_;12;36); charged(74;40;5)` |
| 226 | Que-Hegan's Wisdom [source: Que-Hegan's Wisdon] | Mage Plate `xtp` **QUEST** | 59 /51 | 1; 0; 0; 0 | 3 /5000 | +20% Faster Cast Rate; +3 to Mana after each Kill; Magic Damage Reduced by 6-10; +15 to Energy; +20% Faster Hit Recovery; 140-160% Enhanced Defense; +1 to All Skills<br>RAW: `cast2(_;20;20); mana-kill(_;3;3); red-mag(_;6;10); enr(_;15;15); balance2(_;20;20); ac%(_;140;160); allskills(_;1;1)` |
| 227 | Visceratuant | Defender `xuc` **QUEST** | 36 /28 | 1; 0; 0; 0 | 3 /5000 | +1 to Sorceress Skill Levels; +30% Faster Block Rate; 30% Increased Chance of Blocking; 100-150% Enhanced Defense; Attacker Takes Lightning Damage of 10<br>RAW: `sor(_;1;1); block2(_;30;30); block(_;30;30); ac%(_;100;150); light-thorns(_;10;10)` |
| 228 | Moser's Blessed Circle [source: Mosers Blessed Circle] | Round Shield `xml` **QUEST** | 39 /31 | 1; 0; 0; 0 | 3 /5000 | All Resistances +25; 25% Increased Chance of Blocking; Socketed (2); 180-220% Enhanced Defense; +30% Faster Block Rate<br>RAW: `res-all(_;25;25); block(_;25;25); sock(2;_;_); ac%(_;180;220); block2(_;30;30)` |
| 229 | Stormchaser | Scutum `xrg` **QUEST** | 43 /35 | 1; 0; 0; 0 | 3 /5000 | Adds 1-60 Lightning Damage; 20% Increased Chance of Blocking; Half Freeze Duration; Lightning Resist +50%; +150 to Attack Rating; 160-220% Enhanced Defense; +10% Faster Block Rate; 4% Chance to cast level 6 Blizzard when struck; 4% Chance to cast level 5 Tornado when struck<br>RAW: `dmg-ltng(_;1;60); block(_;20;20); half-freeze(_;1;1); res-ltng(_;50;50); att(_;150;150); ac%(_;160;220); block2(_;10;10); gethit-skill(59;4;6); gethit-skill(245;4;5)` |
| 230 | Tiamat's Rebuke | Dragon Shield `xit` **QUEST** | 46 /38 | 1; 0; 0; 0 | 3 /5000 | Adds 27-53 Cold Damage (6s chill); Adds 35-95 Fire Damage; Adds 1-120 Lightning Damage; All Resistances +25-35; 140-200% Enhanced Defense; 5% Chance to cast level 9 Frost Nova when struck; 5% Chance to cast level 7 Nova when struck; 3% Chance to cast level 6 Hydra when struck; +40 Maximum Durability<br>RAW: `dmg-cold(150;27;53); dmg-fire(_;35;95); dmg-ltng(_;1;120); res-all(_;25;35); ac%(_;140;200); gethit-skill(44;5;9); gethit-skill(48;5;7); gethit-skill(62;3;6); dur(_;40;40)` |
| 231 | Gerke's Sanctuary [source: Kerke's Sanctuary] | Pavise `xow` **QUEST** | 52 /44 | 1; 0; 0; 0 | 3 /5000 | Damage Reduced by 11-16; Magic Damage Reduced by 14-18; Replenish Life +15; 180-240% Enhanced Defense; +100 Maximum Durability; 30% Increased Chance of Blocking; All Resistances +20-30<br>RAW: `red-dmg(_;11;16); red-mag(_;14;18); regen(_;15;15); ac%(_;180;240); dur(_;100;100); block(_;30;30); res-all(_;20;30)` |
| 232 | Radament's Sphere [source: Radimant's Sphere] | Ancient Shield `xts` **QUEST** | 58 /50 | 1; 0; 0; 0 | 3 /5000 | Approx. 79.6875 Poison Damage over 4s; authoritative rate 204–204/256 per frame; 5% Chance to cast level 5 Poison Nova when struck; Poison Resist +75%; 160-200% Enhanced Defense; 20% Increased Chance of Blocking; +20% Faster Block Rate; Level 6 Poison Explosion (40 Charges); +20 Maximum Durability<br>RAW: `dmg-pois(100;204;204); gethit-skill(92;5;5); res-pois(_;75;75); ac%(_;160;200); block(_;20;20); block2(_;20;20); charged(83;40;6); dur(_;20;20)` |
| 233 | Lidless Wall | Grim Shield `xsh` **QUEST** | 49 /41 | 1; 0; 0; 0 | 3 /5000 | +1 to Light Radius; +1 to All Skills; +20% Faster Cast Rate; +3-5 to Mana after each Kill; 80-130% Enhanced Defense; +10 to Energy; Increase Maximum Mana 10%<br>RAW: `light(_;1;1); allskills(_;1;1); cast2(_;20;20); mana-kill(_;3;5); ac%(_;80;130); enr(_;10;10); mana%(_;10;10)` |
| 234 | Lance Guard | Barbed Shield `xpk` **QUEST** | 43 /35 | 1; 0; 0; 0 | 3 /5000 | +50 to Life; +30% Faster Hit Recovery; 15% Damage Taken Goes To Mana; Attacker Takes Damage of 47; 70-120% Enhanced Defense; 20% Deadly Strike<br>RAW: `hp(_;50;50); balance2(_;30;30); dmg-to-mana(_;15;15); thorns(_;47;47); ac%(_;70;120); deadly(_;20;20)` |
| 235 | Venom Grip | Demonhide Gloves `xlg` **QUEST** | 37 /29 | 1; 0; 0; 0 | 5 /5000 | Poison Resist +30%; +5% to Maximum Poison Resist; Approx. 59.7656 Poison Damage over 4s; authoritative rate 153–153/256 per frame; 5% Chance of Crushing Blow; 5% Life Stolen per Hit; +15-25 Defense; 130-160% Enhanced Defense<br>RAW: `res-pois(_;30;30); res-pois-max(_;5;5); dmg-pois(100;153;153); crush(_;5;5); lifesteal(_;5;5); ac(_;15;25); ac%(_;130;160)` |
| 236 | Gravepalm | Sharkskin Gloves `xvg` **QUEST** | 39 /32 | 1; 0; 0; 0 | 5 /5000 | +10 to Energy; +10 to Strength; +100-200% Damage to Undead; +100-200 to Attack Rating against Undead; 140-180% Enhanced Defense<br>RAW: `enr(_;10;10); str(_;10;10); dmg-undead(_;100;200); att-undead(_;100;200); ac%(_;140;180)` |
| 237 | Ghoulhide | Heavy Bracers `xmg` **QUEST** | 44 /36 | 1; 0; 0; 0 | 5 /5000 | +8 AR vs Undead per clvl (floor after scaling); +2 % Dmg to Undead per clvl (floor after scaling); 4-5% Mana Stolen per Hit; +20 to Life; 150-190% Enhanced Defense<br>RAW: `att-und/lvl(16;_;_); dmg-und/lvl(16;_;_); manasteal(_;4;5); hp(_;20;20); ac%(_;150;190)` |
| 238 | Lava Gout [source: Lavagout] | Battle Gauntlets `xtg` **QUEST** | 50 /42 | 1; 0; 0; 0 | 5 /5000 | Fire Resist +24%; Half Freeze Duration; 2% Chance to cast level 10 Enchant on striking; +20% Increased Attack Speed; 150-200% Enhanced Defense; Adds 13-46 Fire Damage; +20 Maximum Durability<br>RAW: `res-fire(_;24;24); half-freeze(_;1;1); hit-skill(52;2;10); swing2(_;20;20); ac%(_;150;200); dmg-fire(_;13;46); dur(_;20;20)` |
| 239 | Hellmouth | War Gauntlets `xhg` **QUEST** | 55 /47 | 1; 0; 0; 0 | 5 /5000 | Adds 15-72 Fire Damage; +15 Fire Absorb; 150-200% Enhanced Defense; +15 Maximum Durability; 2% Chance to cast level 4 Meteor on striking; 4% Chance to cast level 12 Firestorm on striking<br>RAW: `dmg-fire(_;15;72); abs-fire(_;15;15); ac%(_;150;200); dur(_;15;15); hit-skill(56;2;4); hit-skill(225;4;12)` |
| 240 | Infernostride | Demonhide Boots `xlb` **QUEST** | 37 /29 | 1; 0; 0; 0 | 5 /5000 | Adds 12-33 Fire Damage; +20% Faster Run/Walk; +10% to Maximum Fire Resist; Fire Resist +30%; +2 to Light Radius; 120-150% Enhanced Defense; 40-70% Extra Gold from Monsters; +15 Defense; 5% Chance to cast level 8 Blaze when struck<br>RAW: `dmg-fire(_;12;33); move2(_;20;20); res-fire-max(_;10;10); res-fire(_;30;30); light(_;2;2); ac%(_;120;150); gold%(_;40;70); ac(_;15;15); gethit-skill(46;5;8)` |
| 241 | Waterwalk | Sharkskin Boots `xvb` **QUEST** | 40 /32 | 1; 0; 0; 0 | 5 /5000 | +100 Defense vs. Missile; +20% Faster Run/Walk; +15 to Dexterity; 180-210% Enhanced Defense; +45-65 to Life; +40 Maximum Stamina; +5% to Maximum Fire Resist; Heal Stamina Plus 50%<br>RAW: `ac-miss(_;100;100); move2(_;20;20); dex(_;15;15); ac%(_;180;210); hp(_;45;65); stam(_;40;40); res-fire-max(_;5;5); regen-stam(_;50;50)` |
| 242 | Silkweave | Mesh Boots `xmb` **QUEST** | 44 /36 | 1; 0; 0; 0 | 5 /5000 | 150-190% Enhanced Defense; +5 to Mana after each Kill; +200 Defense vs. Missile; Increase Maximum Mana 10%; +30% Faster Run/Walk<br>RAW: `ac%(_;150;190); mana-kill(_;5;5); ac-miss(_;200;200); mana%(_;10;10); move2(_;30;30)` |
| 243 | War Traveler [source: Wartraveler] | Battle Boots `xtb` **QUEST** | 50 /42 | 1; 0; 0; 0 | 5 /5000 | +10 to Vitality; +10 to Strength; 30-50% Better Chance of Getting Magic Items; +30 Maximum Durability; +25% Faster Run/Walk; 150-190% Enhanced Defense; Adds 15–25 Physical Damage (paired endpoints); Attacker Takes Damage of 5-10; 40% Slower Stamina Drain<br>RAW: `vit(_;10;10); str(_;10;10); mag%(_;30;50); dur(_;30;30); move2(_;25;25); ac%(_;150;190); dmg-norm(_;15;25); thorns(_;5;10); stamdrain(_;40;40)` |
| 244 | Gore Rider [source: Gorerider] | War Boots `xhb` **QUEST** | 55 /47 | 1; 0; 0; 0 | 5 /5000 | Requirements -25%; 15% Deadly Strike; +30% Faster Run/Walk; 15% Chance of Crushing Blow; 10% Chance of Open Wounds; 160-200% Enhanced Defense; +10 Maximum Durability; +20 Maximum Stamina<br>RAW: `ease(_;-25;-25); deadly(_;15;15); move2(_;30;30); crush(_;15;15); openwounds(_;10;10); ac%(_;160;200); dur(_;10;10); stam(_;20;20)` |
| 245 | String of Ears | Demonhide Sash `zlb` **QUEST** | 37 /29 | 1; 0; 0; 0 | 5 /5000 | Magic Damage Reduced by 10-15; Damage Reduced by 10-15%; 6-8% Life Stolen per Hit; 150-180% Enhanced Defense; +15 Defense; +10 Maximum Durability<br>RAW: `red-mag(_;10;15); red-dmg%(_;10;15); lifesteal(_;6;8); ac%(_;150;180); ac(_;15;15); dur(_;10;10)` |
| 246 | Razortail | Sharkskin Belt `zvb` **QUEST** | 39 /32 | 1; 0; 0; 0 | 5 /5000 | +1 Attacker Takes Damage per clvl (floor after scaling); +15 to Dexterity; 33% Chance to Pierce; +15 Defense; 120-150% Enhanced Defense; +10 to Maximum Damage<br>RAW: `thorns/lvl(8;_;_); dex(_;15;15); pierce(_;33;33); ac(_;15;15); ac%(_;120;150); dmg-max(_;10;10)` |
| 247 | Gloomstrap | Mesh Belt `zmb` **QUEST** | 45 /36 | 1; 0; 0; 0 | 5 /5000 | -3 to Light Radius; Increase Maximum Mana 15%; 5% Mana Stolen per Hit; 120-150% Enhanced Defense; +15 to Vitality; Regenerate Mana 15%<br>RAW: `light(_;-3;-3); mana%(_;15;15); manasteal(_;5;5); ac%(_;120;150); vit(_;15;15); regen-mana(_;15;15)` |
| 248 | Snowclash | Battle Belt `ztb` **QUEST** | 49 /42 | 1; 0; 0; 0 | 5 /5000 | 5% Chance to cast level 0 Blizzard when struck; +15 Cold Absorb; +15% to Maximum Cold Resist; Adds 13-21 Cold Damage (3s chill); 130-170% Enhanced Defense; +2 to Blizzard (native class only); +3 to Glacial Spike (native class only); +2 to Chilling Armor (native class only)<br>RAW: `gethit-skill(59;5;0); abs-cold(_;15;15); res-cold-max(_;15;15); dmg-cold(75;13;21); ac%(_;130;170); skill(59;2;2); skill(55;3;3); skill(60;2;2)` |
| 249 | Thundergod's Vigor [source: Thudergod's Vigor] | War Belt `zhb` **QUEST** | 55 /47 | 1; 0; 0; 0 | 5 /5000 | 5% Chance to cast level 7 Fist of the Heavens when struck; Adds 1-50 Lightning Damage; +10% to Maximum Lightning Resist; +20 Lightning Absorb; 160-200% Enhanced Defense; +20 to Vitality; +20 to Strength; +3 to Lightning Strike (native class only); +3 to Lightning Fury (native class only)<br>RAW: `gethit-skill(121;5;7); dmg-ltng(_;1;50); res-ltng-max(_;10;10); abs-ltng(_;20;20); ac%(_;160;200); vit(_;20;20); str(_;20;20); skill(34;3;3); skill(35;3;3)` |
| 251 | Harlequin Crest | Shako `uap` **QUEST** | 69 /62 | 1; 0; 0; 0 | 3 /5000 | +2 to All Skills; +1.5 Life per clvl (floor after scaling); +1.5 Mana per clvl (floor after scaling); 50% Better Chance of Getting Magic Items; Damage Reduced by 10%; +2 to Strength; +2 to Dexterity; +2 to Vitality; +2 to Energy<br>RAW: `allskills(_;2;2); hp/lvl(12;_;_); mana/lvl(12;_;_); mag%(_;50;50); red-dmg%(_;10;10); str(_;2;2); dex(_;2;2); vit(_;2;2); enr(_;2;2)` |
| 252 | Veil of Steel | Spired Helm `uhm` **QUEST** | 77 /73 | 1; 0; 0; 0 | 3 /5000 | All Resistances +50; 60% Enhanced Defense; +15 to Strength; +15 to Vitality; -4 to Light Radius; +20 Maximum Durability; +140 Defense<br>RAW: `res-all(_;50;50); ac%(_;60;60); str(_;15;15); vit(_;15;15); light(_;-4;-4); dur(_;20;20); ac(_;140;140)` |
| 253 | The Gladiator's Bane | Wire Fleece `utu` **QUEST** | 85 /85 | 1; 0; 0; 0 | 3 /5000 | 150-200% Enhanced Defense; Magic Damage Reduced by 15-20; Damage Reduced by 15-20; Attacker Takes Damage of 20; Poison Length Reduced by 50%; +103 Maximum Durability; +30% Faster Hit Recovery; +50 Defense; Cannot Be Frozen<br>RAW: `ac%(_;150;200); red-mag(_;15;20); red-dmg(_;15;20); thorns(_;20;20); res-pois-len(_;50;50); dur(_;103;103); balance2(_;30;30); ac(_;50;50); nofreeze(_;1;1)` |
| 254 | Arkaine's Valor | Balrog Skin `upl` **QUEST** | 85 /85 | 1; 0; 0; 0 | 3 /5000 | 150-180% Enhanced Defense; +30% Faster Hit Recovery; +1-2 to All Skills; Damage Reduced by 10-15; +0.5 Vitality per clvl (floor after scaling)<br>RAW: `ac%(_;150;180); balance2(_;30;30); allskills(_;1;2); red-dmg(_;10;15); vit/lvl(4;_;_)` |
| 255 | Blackoak Shield | Luna `uml` **QUEST** | 67 /61 | 1; 0; 0; 0 | 3 /5000 | +0.5 Dexterity per clvl (floor after scaling); 160-200% Enhanced Defense; +0.625 Cold Absorb per clvl (floor after scaling); 4% Chance to cast level 5 Weaken when struck; +45 Maximum Durability; +1.25 Life per clvl (floor after scaling); +50% Faster Block Rate; Half Freeze Duration<br>RAW: `dex/lvl(4;_;_); ac%(_;160;200); abs-cold/lvl(5;_;_); gethit-skill(72;4;5); dur(_;45;45); hp/lvl(10;_;_); block2(_;50;50); half-freeze(_;1;1)` |
| 256 | Stormshield | Monarch `uit` **QUEST** | 77 /73 | 1; 0; 0; 0 | 3 /5000 | +3.75 Defense per clvl (floor after scaling); Damage Reduced by 35%; +30 to Strength; Indestructible; +35% Faster Block Rate; Lightning Resist +25%; 25% Increased Chance of Blocking; Cold Resist +60%; Attacker Takes Lightning Damage of 10<br>RAW: `ac/lvl(30;_;_); red-dmg%(_;35;35); str(_;30;30); indestruct(_;1;1); block2(_;35;35); res-ltng(_;25;25); block(_;25;25); res-cold(_;60;60); light-thorns(_;10;10)` |
| 257 | Hellslayer | Decapitator `7bt` | 71 /66 | 1; 0; 0; 0 | 5 /5000 | +0.5 Strength per clvl (floor after scaling); +0.5 Vitality per clvl (floor after scaling); +3 % Enhanced Max Damage per clvl (floor after scaling); Adds 150-250 Fire Damage; +25 to Life; 100% Enhanced Damage; 10% Chance to cast level 0 Fire Ball on attack<br>RAW: `str/lvl(4;_;_); vit/lvl(4;_;_); dmg%/lvl(24;_;_); dmg-fire(_;150;250); hp(_;25;25); dmg%(_;100;100); att-skill(47;10;0)` |
| 258 | Messerschmidt's Reaver | Champion Axe `7ga` | 75 /70 | 1; 0; 0; 0 | 5 /5000 | +2.5 % Enhanced Max Damage per clvl (floor after scaling); 200% Enhanced Damage; +15 to Strength; +15 to Dexterity; +15 to Vitality; +15 to Energy; Adds 20-240 Fire Damage; +25 Maximum Durability; 100% Bonus to Attack Rating<br>RAW: `dmg%/lvl(20;_;_); dmg%(_;200;200); str(_;15;15); dex(_;15;15); vit(_;15;15); enr(_;15;15); dmg-fire(_;20;240); dur(_;25;25); att%(_;100;100)` |
| 259 | Baranar's Star | Devil Star `7mt` | 70 /65 | 1; 0; 0; 0 | 5 /5000 | 200% Bonus to Attack Rating; 200% Enhanced Damage; +15 to Dexterity; +15 to Strength; +50% Increased Attack Speed; +100 Maximum Durability; Adds 1-200 Lightning Damage; Adds 1-200 Fire Damage; Adds 1-200 Cold Damage<br>RAW: `att%(_;200;200); dmg%(_;200;200); dex(_;15;15); str(_;15;15); swing2(_;50;50); dur(_;100;100); dmg-ltng(_;1;200); dmg-fire(_;1;200); dmg-cold(_;1;200)` |
| 260 | Schaefer's Hammer | Legendary Mallet `7wh` | 83 /79 | 1; 0; 0; 0 | 5 /5000 | 20% Chance to cast level 10 Static Field on striking; +50 to Life; +8 Attack Rating per clvl (floor after scaling); Lightning Resist +75%; +20% Increased Attack Speed; +2 Maximum Damage per clvl (floor after scaling); Indestructible; 100-130% Enhanced Damage; +1 to Light Radius; Adds 50-200 Lightning Damage<br>RAW: `hit-skill(42;20;10); hp(_;50;50); att/lvl(16;_;_); res-ltng(_;75;75); swing2(_;20;20); dmg/lvl(16;_;_); indestruct(_;1;1); dmg%(_;100;130); light(_;1;1); dmg-ltng(_;50;200)` |
| 261 | The Cranium Basher | Thunder Maul `7gm` | 85 /87 | 1; 0; 0; 0 | 5 /5000 | +20% Increased Attack Speed; Indestructible; +25 to Strength; All Resistances +25; 75% Chance of Crushing Blow; Adds 20–20 Physical Damage (paired endpoints); 200-240% Enhanced Damage; 4% Chance to cast level 1 Amplify Damage on striking<br>RAW: `swing2(_;20;20); indestruct(_;1;1); str(_;25;25); res-all(_;25;25); crush(_;75;75); dmg-norm(_;20;20); dmg%(_;200;240); hit-skill(66;4;1)` |
| 262 | Lightsabre | Phase Blade `7cr` | 66 /58 | 5; 0; 0; 0 | 5 /5000 | +7 to Light Radius; 5% Chance to cast level 0 Chain Lightning on attack; Ignore Target's Defense; Lightning Absorb +25%; +20% Increased Attack Speed; Adds 60-120 Magic Damage; Adds 1-200 Lightning Damage; 5-7% Mana Stolen per Hit; 150-200% Enhanced Damage; Adds 10–30 Physical Damage (paired endpoints)<br>RAW: `light(_;7;7); att-skill(53;5;0); ignore-ac(1;1;1); abs-ltng%(_;25;25); swing2(_;20;20); dmg-mag(_;60;120); dmg-ltng(_;1;200); manasteal(_;5;7); dmg%(_;150;200); dmg-norm(_;10;30)` |
| 263 | Doombringer | Champion Sword `7b7` | 75 /69 | 1; 0; 0; 0 | 5 /5000 | Increase Maximum Life 20%; 180-250% Enhanced Damage; 40% Bonus to Attack Rating; Indestructible; Adds 30–100 Physical Damage (paired endpoints); 8% Chance to cast level 3 Weaken on striking; 5-7% Life Stolen per Hit<br>RAW: `hp%(_;20;20); dmg%(_;180;250); att%(_;40;40); indestruct(_;1;1); dmg-norm(_;30;100); hit-skill(72;8;3); lifesteal(_;5;7)` |
| 264 | The Grandfather | Colossus Blade `7gd` | 85 /81 | 1; 0; 0; 0 | 5 /5000 | +20 to Strength; +20 to Dexterity; +20 to Vitality; +20 to Energy; 50% Bonus to Attack Rating; +80 to Life; +2.5 Maximum Damage per clvl (floor after scaling); Indestructible; 150-250% Enhanced Damage<br>RAW: `str(_;20;20); dex(_;20;20); vit(_;20;20); enr(_;20;20); att%(_;50;50); hp(_;80;80); dmg/lvl(20;_;_); indestruct(_;1;1); dmg%(_;150;250)` |
| 265 | Wizardspike | Bone Knife `7dg` | 69 /61 | 1; 0; 0; 0 | 5 /5000 | +2 Mana per clvl (floor after scaling); Regenerate Mana 15%; Increase Maximum Mana 15%; All Resistances +75; Indestructible; +50% Faster Cast Rate<br>RAW: `mana/lvl(16;_;_); regen-mana(_;15;15); mana%(_;15;15); res-all(_;75;75); indestruct(_;1;1); cast3(_;50;50)` |
| 267 | Stormspire | Giant Thresher `7wc` | 78 /70 | 1; 0; 0; 0 | 5 /5000 | Lightning Resist +50%; 5% Chance to cast level 5 Chain Lightning when struck; 150-250% Enhanced Damage; +10 to Strength; 2% Chance to cast level 0 Charged Bolt when struck; +30% Increased Attack Speed; Indestructible; Adds 1-237 Lightning Damage; Attacker Takes Lightning Damage of 27<br>RAW: `res-ltng(_;50;50); gethit-skill(53;5;5); dmg%(_;150;250); str(_;10;10); gethit-skill(38;2;0); swing2(_;30;30); indestruct(_;1;1); dmg-ltng(_;1;237); light-thorns(_;27;27)` |
| 268 | Eaglehorn | Crusader Bow `6l7` | 77 /69 | 1; 0; 0; 0 | 5 /5000 | Ignore Target's Defense; +6 Attack Rating per clvl (floor after scaling); +2 % Enhanced Max Damage per clvl (floor after scaling); 200% Enhanced Damage; +1 to Amazon Skill Levels; +25 to Dexterity<br>RAW: `ignore-ac(_;1;1); att/lvl(12;_;_); dmg%/lvl(16;_;_); dmg%(_;200;200); ama(_;1;1); dex(_;25;25)` |
| 269 | Windforce | Hydra Bow `6lw` | 80 /73 | 1; 0; 0; 0 | 5 /5000 | +5 to Dexterity; +3.125 Maximum Damage per clvl (floor after scaling); Heal Stamina Plus 30%; 6-8% Mana Stolen per Hit; Knockback; 250% Enhanced Damage; +20% Increased Attack Speed; +10 to Strength<br>RAW: `dex(_;5;5); dmg/lvl(25;_;_); regen-stam(_;30;30); manasteal(_;6;8); knock(_;1;1); dmg%(_;250;250); swing2(_;20;20); str(_;10;10)` |
| 271 | Bul-Kathos' Wedding Band [source: Bul Katho's Wedding Band] | ring `rin` | 66 /58 | 1; 0; 0; 0 | 5 /5000 | +0.5 Life per clvl (floor after scaling); +1 to All Skills; 3-5% Life Stolen per Hit; +50 Maximum Stamina<br>RAW: `hp/lvl(4;_;_); allskills(_;1;1); lifesteal(_;3;5); stam(_;50;50)` |
| 272 | The Cat's Eye | amulet `amu` | 58 /50 | 5; 0; 0; 0 | 5 /5000 | +30% Faster Run/Walk; +20% Increased Attack Speed; +100 Defense; +100 Defense vs. Missile; +25 to Dexterity<br>RAW: `move2(_;30;30); swing2(_;20;20); ac(_;100;100); ac-miss(_;100;100); dex(_;25;25)` |
| 273 | The Rising Sun | amulet `amu` | 73 /65 | 5; 0; 0; 0 | 5 /5000 | +0.75 Fire Absorb per clvl (floor after scaling); +4 to Light Radius; 2% Chance to cast level 0 Meteor when struck; Adds 24-48 Fire Damage; +2 to Fire Skills; Replenish Life +10<br>RAW: `abs-fire/lvl(6;_;_); light(_;4;4); gethit-skill(56;2;0); dmg-fire(_;24;48); fireskill(_;2;2); regen(_;10;10)` |
| 274 | Crescent Moon | amulet `amu` | 58 /50 | 5; 0; 0; 0 | 5 /5000 | 11-15% Mana Stolen per Hit; Magic Damage Reduced by 10; 10% Damage Taken Goes To Mana; -2 to Light Radius; +45 to Mana; 3-6% Life Stolen per Hit<br>RAW: `manasteal(_;11;15); red-mag(_;10;10); dmg-to-mana(_;10;10); light(_;-2;-2); mana(_;45;45); lifesteal(_;3;6)` |
| 275 | Mara's Kaleidoscope | amulet `amu` | 80 /67 | 5; 0; 0; 0 | 5 /5000 | +2 to All Skills; All Resistances +20-30; +5 to Strength; +5 to Dexterity; +5 to Vitality; +5 to Energy<br>RAW: `allskills(_;2;2); res-all(_;20;30); str(_;5;5); dex(_;5;5); vit(_;5;5); enr(_;5;5)` |
| 276 | Atma's Scarab | amulet `amu` | 60 /60 | 5; 0; 0; 0 | 5 /5000 | Approx. 39.8438 Poison Damage over 4s; authoritative rate 102–102/256 per frame; Poison Resist +75%; +3 to Light Radius; Attacker Takes Damage of 5; 5% Chance to cast level 2 Amplify Damage on striking; 20% Bonus to Attack Rating<br>RAW: `dmg-pois(100;102;102); res-pois(_;75;75); light(_;3;3); thorns(_;5;5); hit-skill(66;5;2); att%(_;20;20)` |
| 277 | Dwarf Star | ring `rin` | 53 /45 | 10; 0; 0; 0 | 5 /5000 | 100% Extra Gold from Monsters; +40 Maximum Stamina; Heal Stamina Plus 15%; +40 to Life; Magic Damage Reduced by 12-15; Fire Absorb +15%<br>RAW: `gold%(_;100;100); stam(_;40;40); regen-stam(_;15;15); hp(_;40;40); red-mag(_;12;15); abs-fire%(_;15;15)` |
| 278 | Raven Frost | ring `rin` | 53 /45 | 10; 0; 0; 0 | 5 /5000 | Cannot Be Frozen; Adds 15-45 Cold Damage (4s chill); Cold Absorb +20%; +40 to Mana; +15-20 to Dexterity; +150-250 to Attack Rating<br>RAW: `nofreeze(_;1;1); dmg-cold(100;15;45); abs-cold%(_;20;20); mana(_;40;40); dex(_;15;20); att(_;150;250)` |
| 279 | Highlord's Wrath | amulet `amu` | 73 /65 | 5; 0; 0; 0 | 5 /5000 | Lightning Resist +35%; Adds 1-30 Lightning Damage; +20% Increased Attack Speed; +1 to All Skills; +0.375 % Deadly Strike per clvl (floor after scaling); Attacker Takes Lightning Damage of 15<br>RAW: `res-ltng(_;35;35); dmg-ltng(_;1;30); swing2(_;20;20); allskills(_;1;1); deadly/lvl(3;_;_); light-thorns(_;15;15)` |
| 280 | Saracen's Chance | amulet `amu` | 55 /47 | 5; 0; 0; 0 | 5 /5000 | All Resistances +15-25; 10% Chance to cast level 2 Iron Maiden when struck; +12 to Strength; +12 to Dexterity; +12 to Energy; +12 to Vitality<br>RAW: `res-all(_;15;25); gethit-skill(76;10;2); str(_;12;12); dex(_;12;12); enr(_;12;12); vit(_;12;12)` |
| 282 | Arreat's Face | Slayer Guard `baa` **QUEST** | 50 /42 | 1; 0; 0; 0 | 5 /5000 | +2 to Barbarian Skill Levels; +2 to Combat (Barbarian) Skills; 150-200% Enhanced Defense; +30% Faster Hit Recovery; 20% Bonus to Attack Rating; +20 to Strength; +20 to Dexterity; 3-6% Life Stolen per Hit; All Resistances +30<br>RAW: `bar(_;2;2); skilltab(12;2;2); ac%(_;150;200); balance2(_;30;30); att%(_;20;20); str(_;20;20); dex(_;20;20); lifesteal(_;3;6); res-all(_;30;30)` |
| 283 | Homunculus | Hierophant Trophy `nea` **QUEST** | 50 /42 | 1; 0; 0; 0 | 5 /5000 | +2 to Necromancer Skill Levels; +2 to Curses (Necromancer) Skills; 150-200% Enhanced Defense; +30% Faster Block Rate; 40% Increased Chance of Blocking; +20 to Energy; Regenerate Mana 33%; +5 to Mana after each Kill; All Resistances +40<br>RAW: `nec(_;2;2); skilltab(6;2;2); ac%(_;150;200); block2(_;30;30); block(_;40;40); enr(_;20;20); regen-mana(_;33;33); mana-kill(_;5;5); res-all(_;40;40)` |
| 284 | Titan's Revenge | Ceremonial Javelin `ama` | 50 /42 | 1; 0; 0; 0 | 5 /5000 | +2 to Amazon Skill Levels; +2 to Javelin and Spear (Amazon) Skills; 150-200% Enhanced Damage; +30% Faster Run/Walk; Replenishes 1 Quantity every 3.33333s (rate 30); +20 to Strength; +20 to Dexterity; 5-9% Life Stolen per Hit; Adds 25–50 Physical Damage (paired endpoints); Increased Stack Size +60<br>RAW: `ama(_;2;2); skilltab(2;2;2); dmg%(_;150;200); move2(_;30;30); rep-quant(30;_;_); str(_;20;20); dex(_;20;20); lifesteal(_;5;9); dmg-norm(_;25;50); stack(_;60;60)` |
| 285 | Lycander's Aim | Ceremonial Bow `am7` | 50 /42 | 1; 0; 0; 0 | 5 /5000 | +2 to Amazon Skill Levels; +2 to Bow and Crossbow (Amazon) Skills; 150-200% Enhanced Damage; +20% Increased Attack Speed; 20% Enhanced Defense; +20 to Dexterity; +20 to Energy; 5-8% Mana Stolen per Hit; Adds 25–50 Physical Damage (paired endpoints)<br>RAW: `ama(_;2;2); skilltab(0;2;2); dmg%(_;150;200); swing2(_;20;20); ac%(_;20;20); dex(_;20;20); enr(_;20;20); manasteal(_;5;8); dmg-norm(_;25;50)` |
| 286 | Lycander's Flank | Ceremonial Pike `am9` | 50 /42 | 1; 0; 0; 0 | 5 /5000 | +2 to Amazon Skill Levels; +2 to Javelin and Spear (Amazon) Skills; 150-200% Enhanced Damage; +30% Increased Attack Speed; 20% Enhanced Defense; +20 to Strength; +20 to Vitality; 5-9% Life Stolen per Hit; Adds 25–50 Physical Damage (paired endpoints)<br>RAW: `ama(_;2;2); skilltab(2;2;2); dmg%(_;150;200); swing2(_;30;30); ac%(_;20;20); str(_;20;20); vit(_;20;20); lifesteal(_;5;9); dmg-norm(_;25;50)` |
| 287 | The Oculus | Swirling Crystal `oba` | 50 /42 | 1; 0; 0; 0 | 5 /5000 | +3 to Sorceress Skill Levels; 25% Chance to cast level 1 Teleport when struck; All Resistances +20; +30% Faster Cast Rate; 20% Enhanced Defense; +20 to Vitality; +20 to Energy; +5 to Mana after each Kill; 50% Better Chance of Getting Magic Items<br>RAW: `sor(_;3;3); gethit-skill(54;25;1); res-all(_;20;20); cast2(_;30;30); ac%(_;20;20); vit(_;20;20); enr(_;20;20); mana-kill(_;5;5); mag%(_;50;50)` |
| 288 | Herald of Zakarum | Gilded Shield `pa9` **QUEST** | 50 /42 | 1; 0; 0; 0 | 5 /5000 | +2 to Paladin Skill Levels; +2 to Combat (Paladin) Skills; 150-200% Enhanced Defense; +30% Faster Block Rate; 30% Increased Chance of Blocking; +20 to Strength; +20 to Vitality; 20% Bonus to Attack Rating; All Resistances +50<br>RAW: `pal(_;2;2); skilltab(9;2;2); ac%(_;150;200); block2(_;30;30); block(_;30;30); str(_;20;20); vit(_;20;20); att%(_;20;20); res-all(_;50;50)` |
| 289 | Bartuc's Cut-Throat [source: Cutthroat1] | Greater Talons `9tw` | 50 /42 | 1; 0; 0; 0 | 5 /5000 | +2 to Assassin Skill Levels; +1 to Martial Arts (Assassin) Skills; 150-200% Enhanced Damage; +30% Faster Hit Recovery; 20% Bonus to Attack Rating; +20 to Strength; +20 to Dexterity; 5-9% Life Stolen per Hit; Adds 25–50 Physical Damage (paired endpoints)<br>RAW: `ass(_;2;2); skilltab(20;1;1); dmg%(_;150;200); balance2(_;30;30); att%(_;20;20); str(_;20;20); dex(_;20;20); lifesteal(_;5;9); dmg-norm(_;25;50)` |
| 290 | Jalal's Mane | Totemic Mask `dra` **QUEST** | 50 /42 | 1; 0; 0; 0 | 5 /5000 | +2 to Druid Skill Levels; +2 to Shape Shifting (Druid) Skills; 150-200% Enhanced Defense; +30% Faster Hit Recovery; 20% Bonus to Attack Rating; +20 to Strength; +20 to Energy; +5 to Mana after each Kill; All Resistances +30<br>RAW: `dru(_;2;2); skilltab(16;2;2); ac%(_;150;200); balance2(_;30;30); att%(_;20;20); str(_;20;20); enr(_;20;20); mana-kill(_;5;5); res-all(_;30;30)` |
| 291 | The Scalper | Francisca `9ta` | 65 /57 | 1; 0; 0; 0 | 5 /5000 | Replenishes 1 Quantity every 3.33333s (rate 30); 150-200% Enhanced Damage; 25% Bonus to Attack Rating; +20% Increased Attack Speed; 33% Chance of Open Wounds; 4-6% Life Stolen per Hit; +4 to Mana after each Kill<br>RAW: `rep-quant(30;_;_); dmg%(_;150;200); att%(_;25;25); swing2(_;20;20); openwounds(_;33;33); lifesteal(_;4;6); mana-kill(_;4;4)` |
| 292 | Bloodmoon | Elegant Blade `7sb` | 69 /61 | 1; 0; 0; 0 | 5 /5000 | 210-260% Enhanced Damage; 10-15% Life Stolen per Hit; Level 15 Blood Golem (9 Charges); +7-13 Life after each Kill; 50% Chance of Open Wounds<br>RAW: `dmg%(_;210;260); lifesteal(_;10;15); charged(BloodGolem;9;15); heal-kill(_;7;13); openwounds(_;50;50)` |
| 293 | Djinn Slayer [source: Djinnslayer] | Ataghan `7sm` | 73 /65 | 1; 1; 0; 0 | 5 /5000 | 190-240% Enhanced Damage; Adds 250-500 Fire Damage; +100-150% Damage to Demons; +200-300 to Attack Rating against Demons; +3-7 Lightning Absorb; 3-6% Mana Stolen per Hit; Socketed (1-2)<br>RAW: `dmg%(_;190;240); dmg-fire(_;250;500); dmg-demon(_;100;150); att-demon(_;200;300); abs-ltng(_;3;7); manasteal(_;3;6); sock(_;1;2)` |
| 294 | Deathbit | Battle Dart `9tk` | 52 /44 | 1; 0; 0; 0 | 5 /5000 | 40% Deadly Strike; 130-180% Enhanced Damage; +200-450 to Attack Rating; 7-9% Life Stolen per Hit; 4-6% Mana Stolen per Hit; Replenishes 1 Quantity every 4s (rate 25)<br>RAW: `deadly(_;40;40); dmg%(_;130;180); att(_;200;450); lifesteal(_;7;9); manasteal(_;4;6); rep-quant(25;_;_)` |
| 295 | Warshrike | Winged Knife `7bk` | 83 /75 | 1; 1; 0; 0 | 5 /5000 | 200-250% Enhanced Damage; 50% Chance to Pierce; +30% Increased Attack Speed; 50% Deadly Strike; Replenishes 1 Quantity every 3.33333s (rate 30); 25% Chance to cast level 9 Nova on striking<br>RAW: `dmg%(_;200;250); pierce(_;50;50); swing2(_;30;30); deadly(_;50;50); rep-quant(30;_;_); hit-skill(Nova;25;9)` |
| 296 | Gut Siphon [source: Gutsiphon] | Demon Crossbow `6rx` | 79 /71 | 1; 0; 0; 0 | 5 /5000 | 160-220% Enhanced Damage; 33% Chance to Pierce; 12-18% Life Stolen per Hit; Slows Target by 25%; 33% Chance of Open Wounds<br>RAW: `dmg%(_;160;220); pierce(_;33;33); lifesteal(_;12;18); slow(_;25;25); openwounds(_;33;33)` |
| 297 | Razor's Edge [source: Razoredge] | Tomahawk `7ha` | 75 /67 | 1; 0; 0; 0 | 5 /5000 | 175-225% Enhanced Damage; +40% Increased Attack Speed; -33% Target Defense; 50% Deadly Strike; 50% Chance of Open Wounds<br>RAW: `dmg%(_;175;225); swing2(_;40;40); reduce-ac(_;33;33); deadly(_;50;50); openwounds(_;50;50)` |
| 299 | Demonlimb | Tyrant Club `7sp` | 71 /63 | 1; 0; 0; 0 | 5 /5000 | 180-230% Enhanced Damage; Adds 222-333 Fire Damage; 7-13% Life Stolen per Hit; Level 23 Enchant (20 Charges); Repairs 1 Durability every 20s (rate 5); +123% Damage to Demons; Fire Resist +15-20%<br>RAW: `dmg%(_;180;230); dmg-fire(_;222;333); lifesteal(_;7;13); charged(Enchant;20;23); rep-dur(5;_;_); dmg-demon(_;123;123); res-fire(_;15;20)` |
| 300 | Steel Shade [source: Steelshade] | Armet `ulm` **QUEST** | 70 /62 | 1; 0; 0; 0 | 5 /5000 | 100-130% Enhanced Defense; +5-11 Fire Absorb; 4-8% Mana Stolen per Hit; Replenish Life +10-18<br>RAW: `ac%(_;100;130); abs-fire(_;5;11); manasteal(_;4;8); regen(_;10;18)` |
| 301 | Tomb Reaver | Cryptic Axe `7pa` | 86 /84 | 1; 1; 0; 0 | 5 /5000 | +60% Increased Attack Speed; +4 to Light Radius; 200-280% Enhanced Damage; +150-230% Damage to Undead; 50-80% Better Chance of Getting Magic Items; All Resistances +30-50; +250-350 to Attack Rating against Undead; 10% Reanimate as Returned (monsterid1); +10-14 Life after each Kill; Socketed (1-3)<br>RAW: `swing2(_;60;60); light(_;4;4); dmg%(_;200;280); dmg-undead(_;150;230); mag%(_;50;80); res-all(_;30;50); att-undead(_;250;350); reanimate(1;10;10); heal-kill(_;10;14); sock(_;1;3)` |
| 302 | Death's Web [source: Deaths's Web] | Unearthed Wand `7gw` | 74 /66 | 1; 0; 0; 0 | 5 /5000 | +2 to All Skills; -40-50% to Enemy Poison Resistance; +7-12 Life after each Kill; +7-12 to Mana after each Kill; +1-2 to Poison and Bone (Necromancer) Skills<br>RAW: `allskills(_;2;2); pierce-pois(_;40;50); heal-kill(_;7;12); mana-kill(_;7;12); skilltab(7;1;2)` |
| 303 | Nature's Peace | ring `rin` | 77 /69 | 3; 1; 0; 0 | 5 /5000 | Prevent Monster Heal; Slain Monsters Rest in Peace; Damage Reduced by 7-11; Poison Resist +20-30%; Level 5 Oak Sage (27 Charges)<br>RAW: `noheal(_;1;1); rip(_;1;1); red-dmg(_;7;11); res-pois(_;20;30); charged(Oak Sage;27;5)` |
| 304 | Azurewrath | Phase Blade `7cr` | 87 /85 | 1; 1; 0; 0 | 5 /5000 | Adds 250-500 Magic Damage; 230-270% Enhanced Damage; Level 10-13 Sanctuary Aura When Equipped; Adds 250-500 Cold Damage (10s chill); +30% Increased Attack Speed; +5-10 to All Attributes; +3 to Light Radius; +1 to All Skills<br>RAW: `dmg-mag(_;250;500); dmg%(_;230;270); aura(Sanctuary;10;13); dmg-cold(250;250;500); swing2(_;30;30); all-stats(_;5;10); light(_;3;3); allskills(_;1;1)` |
| 305 | Seraph's Hymn | amulet `amu` | 73 /65 | 3; 1; 0; 0 | 5 /5000 | +2 to All Skills; +1-2 to Defensive Auras (Paladin) Skills; +25-50% Damage to Demons; +25-50% Damage to Undead; +150-250 to Attack Rating against Demons; +150-250 to Attack Rating against Undead; +2 to Light Radius<br>RAW: `allskills(_;2;2); skilltab(11;1;2); dmg-demon(_;25;50); dmg-undead(_;25;50); att-demon(_;150;250); att-undead(_;150;250); light(_;2;2)` |
| 307 | Fleshripper | Fanged Knife `7kr` | 76 /68 | 1; 0; 0; 0 | 5 /5000 | 200-300% Enhanced Damage; -50% Target Defense; Prevent Monster Heal; 25% Chance of Crushing Blow; 50% Chance of Open Wounds; 33% Deadly Strike; Slows Target by 20%<br>RAW: `dmg%(_;200;300); reduce-ac(_;50;50); noheal(_;1;1); crush(_;25;25); openwounds(_;50;50); deadly(_;33;33); slow(_;20;20)` |
| 309 | Horizon's Tornado | Scourge `7fl` | 72 /64 | 5; 0; 0; 0 | 5 /5000 | 230-280% Enhanced Damage; +50% Increased Attack Speed; Slows Target by 20%; 20% Chance to cast level 15 Tornado on striking; Requirements -20%<br>RAW: `dmg%(_;230;280); swing2(_;50;50); slow(_;20;20); hit-skill(Tornado;20;15); ease(_;-20;-20)` |
| 310 | Stone Crusher | Legendary Mallet `7wh` | 76 /68 | 4; 0; 0; 0 | 5 /5000 | 280-320% Enhanced Damage; +20-30 to Strength; 40% Chance of Crushing Blow; -25% Target Defense; -100 to Monster Defense Per Hit; +10-30 Damage (adds min/max)<br>RAW: `dmg%(_;280;320); str(_;20;30); crush(_;40;40); reduce-ac(_;25;25); dmg-ac(_;-100;-100); dmg(_;10;30)` |
| 311 | Jade Talon [source: Jadetalon] | Wrist Sword `7wb` | 74 /66 | 1; 0; 0; 0 | 5 /5000 | 190-240% Enhanced Damage; 10-15% Mana Stolen per Hit; All Resistances +40-50; +30% Faster Hit Recovery; +1-2 to Shadow Disciplines (Assassin) Skills; +1-2 to Martial Arts (Assassin) Skills<br>RAW: `dmg%(_;190;240); manasteal(_;10;15); res-all(_;40;50); balance2(_;30;30); skilltab(19;1;2); skilltab(20;1;2)` |
| 312 | Shadow Dancer [source: Shadowdancer] | Myrmidon Greaves `uhb` **QUEST** | 79 /71 | 1; 1; 0; 0 | 5 /5000 | 70-100% Enhanced Defense; +30% Faster Run/Walk; +30% Faster Hit Recovery; +15-25 to Dexterity; +1-2 to Shadow Disciplines (Assassin) Skills; Requirements -20%<br>RAW: `ac%(_;70;100); move2(_;30;30); balance2(_;30;30); dex(_;15;25); skilltab(19;1;2); ease(_;-20;-20)` |
| 313 | Cerebus' Bite [source: Cerebus] | Blood Spirit `drb` **QUEST** | 71 /63 | 1; 1; 0; 0 | 5 /5000 | 130-140% Enhanced Defense; +2-4 to Shape Shifting (Druid) Skills; 7-10% Life Stolen per Hit; 60-120% Bonus to Attack Rating; 33% Chance of Open Wounds; +1-2 to feral rage (native class only)<br>RAW: `ac%(_;130;140); skilltab(16;2;4); lifesteal(_;7;10); att%(_;60;120); openwounds(_;33;33); skill(feral rage;1;2)` |
| 314 | Tyrael's Might | Sacred Armor `uar` **QUEST** | 87 /84 | 1; 1; 0; 0 | 5 /5000 | Requirements -100%; Indestructible; 120-150% Enhanced Defense; Slain Monsters Rest in Peace; +50-100% Damage to Demons; Cannot Be Frozen; +20% Faster Run/Walk; All Resistances +20-30; +20-30 to Strength<br>RAW: `ease(_;-100;-100); indestruct(_;1;1); ac%(_;120;150); rip(_;1;1); dmg-demon(_;50;100); nofreeze(_;1;1); move2(_;20;20); res-all(_;20;30); str(_;20;30)` |
| 315 | Soul Drainer [source: Souldrain] | Vambraces `umg` **QUEST** | 82 /74 | 1; 0; 0; 0 | 5 /5000 | 90-120% Enhanced Defense; 4-7% Mana Stolen per Hit; 4-7% Life Stolen per Hit; 8% Chance to cast level 3 Weaken on striking; -50 to Monster Defense Per Hit<br>RAW: `ac%(_;90;120); manasteal(_;4;7); lifesteal(_;4;7); hit-skill(Weaken;8;3); dmg-ac(_;-50;-50)` |
| 316 | Rune Master [source: Runemaster] | Ettin Axe `72a` | 80 /72 | 1; 1; 0; 0 | 5 /5000 | 220-270% Enhanced Damage; Socketed (3-5); +5% to Maximum Cold Resist; Cannot Be Frozen<br>RAW: `dmg%(_;220;270); sock(_;3;5); res-cold-max(_;5;5); nofreeze(_;1;1)` |
| 317 | Death Cleaver [source: Deathcleaver] | Berserker Axe `7wa` | 78 /70 | 1; 1; 0; 0 | 5 /5000 | 230-280% Enhanced Damage; 66% Deadly Strike; -33% Target Defense; +40% Increased Attack Speed; +6-9 Life after each Kill<br>RAW: `dmg%(_;230;280); deadly(_;66;66); reduce-ac(_;33;33); swing2(_;40;40); heal-kill(_;6;9)` |
| 318 | Executioner's Justice | Glorious Axe `7gi` | 83 /75 | 1; 1; 0; 0 | 5 /5000 | 240-290% Enhanced Damage; 25% Chance of Crushing Blow; -33% Target Defense; 50% Chance to cast level 6 Decrepify when you Kill an Enemy; +30% Increased Attack Speed<br>RAW: `dmg%(_;240;290); crush(_;25;25); reduce-ac(_;33;33); kill-skill(Decrepify;50;6); swing2(_;30;30)` |
| 319 | Stoneraven | Matriarchal Spear `amd` | 72 /64 | 1; 1; 0; 0 | 5 /5000 | 230-280% Enhanced Damage; Adds 101-187 Magic Damage; All Resistances +30-50; +400-600 Defense; +1-3 to Javelin and Spear (Amazon) Skills<br>RAW: `dmg%(_;230;280); dmg-mag(_;101;187); res-all(_;30;50); ac(_;400;600); skilltab(2;1;3)` |
| 320 | Leviathan | Kraken Shell `uld` **QUEST** | 73 /65 | 1; 1; 0; 0 | 5 /5000 | 170-200% Enhanced Defense; +100-150 Defense; Damage Reduced by 15-25%; +40-50 to Strength; Indestructible<br>RAW: `ac%(_;170;200); ac(_;100;150); red-dmg%(_;15;25); str(_;40;50); indestruct(_;1;1)` |
| 322 | Wisp Projector [source: Wisp] | ring `rin` | 84 /76 | 1; 0; 0; 0 | 5 /5000 | Lightning Absorb +10-20%; 10% Chance to cast level 16 Lightning on striking; 10-20% Better Chance of Getting Magic Items; Level 2 Oak Sage (15 Charges); Level 5 Heart of Wolverine (13 Charges); Level 7 Spirit of Barbs (11 Charges)<br>RAW: `abs-ltng%(_;10;20); hit-skill(Lightning;10;16); mag%(_;10;20); charged(Oak Sage;15;2); charged(Heart of Wolverine;13;5); charged(Spirit of Barbs;11;7)` |
| 323 | Gargoyle's Bite | Winged Harpoon `7ts` | 78 /70 | 1; 0; 0; 0 | 5 /5000 | 180-230% Enhanced Damage; Replenishes 1 Quantity every 3.33333s (rate 30); Approx. 292.969 Poison Damage over 10s; authoritative rate 300–300/256 per frame; 9-15% Life Stolen per Hit; Level 11 Plague Javelin (60 Charges)<br>RAW: `dmg%(_;180;230); rep-quant(30;_;_); dmg-pois(250;300;300); lifesteal(_;9;15); charged(Plague Javelin;60;11)` |
| 324 | Lacerator | Winged Axe `7b8` | 76 /68 | 1; 0; 0; 0 | 5 /5000 | 150-210% Enhanced Damage; Replenishes 1 Quantity every 4s (rate 25); +30% Increased Attack Speed; Prevent Monster Heal; 33% Chance of Open Wounds; Hit Causes Monster to Flee 50% (raw /128 chance); 33% Chance to cast level 3 Amplify Damage on striking<br>RAW: `dmg%(_;150;210); rep-quant(25;_;_); swing2(_;30;30); noheal(_;1;1); openwounds(_;33;33); howl(_;64;64); hit-skill(Amplify Damage;33;3)` |
| 325 | Mang Song's Lesson | Archon Staff `6ws` | 86 /82 | 1; 1; 0; 0 | 5 /5000 | +5 to All Skills; -7-15% to Enemy Fire Resistance; -7-15% to Enemy Lightning Resistance; -7-15% to Enemy Cold Resistance; Regenerate Mana 10%; +30% Faster Cast Rate<br>RAW: `allskills(_;5;5); pierce-fire(_;7;15); pierce-ltng(_;7;15); pierce-cold(_;7;15); regen-mana(_;10;10); cast2(_;30;30)` |
| 326 | Viperfork | Mancatcher `7br` | 79 /71 | 1; 0; 0; 0 | 5 /5000 | 190-240% Enhanced Damage; Approx. 325.195 Poison Damage over 10s; authoritative rate 333–333/256 per frame; +50% Increased Attack Speed; +200-250 to Attack Rating; 15% Chance to cast level 9 Poison Explosion on striking; Poison Resist +30-50%<br>RAW: `dmg%(_;190;240); dmg-pois(250;333;333); swing2(_;50;50); att(_;200;250); hit-skill(Poison Explosion;15;9); res-pois(_;30;50)` |
| 327 | Ethereal Edge | Silver-edged Axe `7ba` | 82 /74 | 1; 0; 0; 0 | 5 /5000 | 150-180% Enhanced Damage; +25% Increased Attack Speed; +10-12 Fire Absorb; +150-200% Damage to Demons; +5-10 Life after each Demon Kill; +270-350 to Attack Rating; Ethereal (cannot be repaired); Indestructible<br>RAW: `dmg%(_;150;180); swing2(_;25;25); abs-fire(_;10;12); dmg-demon(_;150;200); demon-heal(_;5;10); att(_;270;350); ethereal(_;1;1); indestruct(_;1;1)` |
| 328 | Demonhorn's Edge | Destroyer Helm `bad` **QUEST** | 69 /61 | 1; 1; 0; 0 | 5 /5000 | 120-160% Enhanced Defense; +10% Increased Attack Speed; 3-6% Life Stolen per Hit; Attacker Takes Damage of 55-77; +1-3 to Combat (Barbarian) Skills; +1-3 to Masteries (Barbarian) Skills; +1-3 to Warcries (Barbarian) Skills<br>RAW: `ac%(_;120;160); swing2(_;10;10); lifesteal(_;3;6); thorns(_;55;77); skilltab(12;1;3); skilltab(13;1;3); skilltab(14;1;3)` |
| 329 | The Reaper's Toll | Thresher `7s8` | 83 /75 | 1; 1; 0; 0 | 5 /5000 | 190-240% Enhanced Damage; 33% Chance to cast level 1 Decrepify on striking; Ignore Target's Defense; 11-15% Life Stolen per Hit; Requirements -25%; 33% Deadly Strike; Adds 4-44 Cold Damage<br>RAW: `dmg%(_;190;240); hit-skill(Decrepify;33;1); ignore-ac(_;1;1); lifesteal(_;11;15); ease(_;-25;-25); deadly(_;33;33); dmg-cold(_;4;44)` |
| 330 | Spirit Keeper [source: Spiritkeeper] | Earth Spirit `drd` **QUEST** | 75 /67 | 1; 0; 0; 0 | 5 /5000 | 170-190% Enhanced Defense; +20% Faster Hit Recovery; +9-14 Lightning Absorb; Fire Resist +30-40%; Cold Absorb +15-25%; +10% to Maximum Poison Resist; +1-2 to Druid Skill Levels<br>RAW: `ac%(_;170;190); balance2(_;20;20); abs-ltng(_;9;14); res-fire(_;30;40); abs-cold%(_;15;25); res-pois-max(_;10;10); dru(_;1;2)` |
| 331 | Hellrack | Colossus Crossbow `6hx` | 84 /76 | 1; 0; 0; 0 | 5 /5000 | 180-230% Enhanced Damage; Adds 63-324 Fire/Lightning/Cold Damage (cold dur 33 frames); +20% Increased Attack Speed; 100-150% Bonus to Attack Rating; Socketed (2); Level 18 Immolation Arrow (150 Charges)<br>RAW: `dmg%(_;180;230); dmg-elem(33;63;324); swing2(_;20;20); att%(_;100;150); sock(_;2;2); charged(Immolation Arrow;150;18)` |
| 332 | Alma Negra | Sacred Rondache `pac` **QUEST** | 85 /77 | 1; 0; 0; 0 | 5 /5000 | 180-210% Enhanced Defense; +30% Faster Block Rate; +1-2 to Paladin Skill Levels; 20% Increased Chance of Blocking; Magic Damage Reduced by 5-9; 40-75% Bonus to Attack Rating; 40-75% Enhanced Damage<br>RAW: `ac%(_;180;210); block2(_;30;30); pal(_;1;2); block(_;20;20); red-mag(_;5;9); att%(_;40;75); dmg%(_;40;75)` |
| 333 | Darkforce Spawn [source: Darkforge Spawn] | Bloodlord Skull `nef` **QUEST** | 72 /64 | 1; 1; 0; 0 | 5 /5000 | 140-180% Enhanced Defense; +30% Faster Cast Rate; Increase Maximum Mana 10%; +1-3 to Curses (Necromancer) Skills; +1-3 to Poison and Bone (Necromancer) Skills; +1-3 to Summoning (Necromancer) Skills<br>RAW: `ac%(_;140;180); cast2(_;30;30); mana%(_;10;10); skilltab(6;1;3); skilltab(7;1;3); skilltab(8;1;3)` |
| 334 | Widowmaker | Ward Bow `6sw` | 73 /65 | 1; 1; 0; 0 | 5 /5000 | 150-200% Enhanced Damage; 33% Deadly Strike; Ignore Target's Defense; Fires Magic Arrows (level 11); +3-5 to Guided Arrow (oskill)<br>RAW: `dmg%(_;150;200); deadly(_;33;33); ignore-ac(_;1;1); magicarrow(_;11;11); oskill(Guided Arrow;3;5)` |
| 335 | Bloodraven's Charge | Matriarchal Bow `amb` | 79 /71 | 1; 0; 0; 0 | 5 /5000 | 180-230% Enhanced Damage; 200-300% Bonus to Attack Rating; Fires Explosive Arrows or Bolts (level 13); +2-4 to Bow and Crossbow (Amazon) Skills; Level 5 Revive (30 Charges)<br>RAW: `dmg%(_;180;230); att%(_;200;300); explosivearrow(_;13;13); skilltab(0;2;4); charged(Revive;30;5)` |
| 336 | Ghostflame | Legend Spike `7bl` | 70 /62 | 1; 0; 0; 0 | 5 /5000 | 190-240% Enhanced Damage; Ignore Target's Defense; Adds 108 Magic Damage; 10-15% Mana Stolen per Hit; Ethereal (cannot be repaired); Indestructible; +2 to Light Radius<br>RAW: `dmg%(_;190;240); ignore-ac(_;1;1); dmg-mag(_;108;108); manasteal(_;10;15); ethereal(_;1;1); indestruct(_;1;1); light(_;2;2)` |
| 337 | Shadow Killer [source: Shadowkiller] | Battle Cestus `7cs` | 85 /78 | 1; 1; 0; 0 | 5 /5000 | 170-220% Enhanced Damage; -25% Target Defense; Freezes Target +2; +10-15 to Mana after each Kill; 33% Chance to cast level 8 Frost Nova on striking; Ethereal (cannot be repaired); Indestructible<br>RAW: `dmg%(_;170;220); reduce-ac(_;25;25); freeze(_;2;2); mana-kill(_;10;15); hit-skill(Frost Nova;33;8); ethereal(_;1;1); indestruct(_;1;1)` |
| 338 | Gimmershred | Flying Axe `7ta` | 78 /70 | 1; 0; 0; 0 | 5 /5000 | 160-210% Enhanced Damage; Adds 218-483 Fire Damage; Adds 176-397 Cold Damage (4s chill); Adds 29-501 Lightning Damage; Increased Stack Size +60; +30% Increased Attack Speed<br>RAW: `dmg%(_;160;210); dmg-fire(_;218;483); dmg-cold(100;176;397); dmg-ltng(_;29;501); stack(_;60;60); swing2(_;30;30)` |
| 339 | Griffon's Eye | Diadem `ci3` **QUEST** | 84 /76 | 1; 1; 0; 0 | 5 /5000 | +100-200 Defense; +25% Faster Cast Rate; +1 to All Skills; +10-15% to Lightning Skill Damage; -15-20% to Enemy Lightning Resistance<br>RAW: `ac(_;100;200); cast2(_;25;25); allskills(_;1;1); extra-ltng(_;10;15); pierce-ltng(_;15;20)` |
| 340 | Windhammer | Ogre Maul `7m7` | 76 /68 | 1; 0; 0; 0 | 5 /5000 | 180-230% Enhanced Damage; 50% Chance of Crushing Blow; +60% Increased Attack Speed; 33% Chance to cast level 22 Twister on striking<br>RAW: `dmg%(_;180;230); crush(_;50;50); swing2(_;60;60); hit-skill(Twister;33;22)` |
| 341 | Thunderstroke | Matriarchal Javelin `amf` | 77 /69 | 1; 1; 0; 0 | 5 /5000 | 150-200% Enhanced Damage; Adds 1-511 Lightning Damage; 20% Chance to cast level 14 Lightning on striking; +15% Increased Attack Speed; -15% to Enemy Lightning Resistance; +3 to Lightning Bolt (native class only); +2-4 to Javelin and Spear (Amazon) Skills<br>RAW: `dmg%(_;150;200); dmg-ltng(_;1;511); hit-skill(Lightning;20;14); swing2(_;15;15); pierce-ltng(_;15;15); skill(Lightning Bolt;3;3); skilltab(2;2;4)` |
| 343 | Demon's Arch | Balrog Spear `7s7` | 76 /68 | 1; 0; 0; 0 | 5 /5000 | 160-210% Enhanced Damage; Adds 232-323 Fire Damage; 6-12% Life Stolen per Hit; Replenishes 1 Quantity every 3.33333s (rate 30); +30% Increased Attack Speed; Adds 23-333 Lightning Damage<br>RAW: `dmg%(_;160;210); dmg-fire(_;232;323); lifesteal(_;6;12); rep-quant(30;_;_); swing2(_;30;30); dmg-ltng(_;23;333)` |
| 344 | Boneflame | Succubae Skull `nee` **QUEST** | 80 /72 | 1; 0; 0; 0 | 3 /5000 | 120-150% Enhanced Defense; +20% Faster Run/Walk; 15% Chance to cast level 3 Terror when struck; +2-3 to Necromancer Skill Levels; All Resistances +20-30<br>RAW: `ac%(_;120;150); move2(_;20;20); gethit-skill(Terror;15;3); nec(_;2;3); res-all(_;20;30)` |
| 345 | Steel Pillar [source: Steelpillar] | War Pike `7p7` | 77 /69 | 1; 0; 0; 0 | 3 /5000 | 210-260% Enhanced Damage; +25% Increased Attack Speed; -20% Target Defense; 50-80% Enhanced Defense; Indestructible; 25% Chance of Crushing Blow<br>RAW: `dmg%(_;210;260); swing2(_;25;25); reduce-ac(_;20;20); ac%(_;50;80); indestruct(_;1;1); crush(_;25;25)` |
| 346 | Nightwing's Veil | Spired Helm `uhm` **QUEST** | 75 /67 | 1; 0; 0; 0 | 3 /5000 | 90-120% Enhanced Defense; +2 to All Skills; +10-20 to Dexterity; +5-9 Cold Absorb; Half Freeze Duration; +8-15% to Cold Skill Damage; Requirements -50%<br>RAW: `ac%(_;90;120); allskills(_;2;2); dex(_;10;20); abs-cold(_;5;9); half-freeze(_;1;1); extra-cold(_;8;15); ease(_;-50;-50)` |
| 347 | Crown of Ages | Corona `urn` **QUEST** | 86 /82 | 1; 0; 0; 0 | 3 /5000 | +30% Faster Hit Recovery; All Resistances +20-30; +1 to All Skills; +100-150 Defense; Indestructible; Damage Reduced by 10-15%; 50% Enhanced Defense; Socketed (1-2)<br>RAW: `balance2(_;30;30); res-all(_;20;30); allskills(_;1;1); ac(_;100;150); indestruct(_;1;1); red-dmg%(_;10;15); ac%(_;50;50); sock(_;1;2)` |
| 348 | Andariel's Visage | Demonhead `usk` **QUEST** | 85 /83 | 1; 1; 0; 0 | 3 /5000 | 100-150% Enhanced Defense; Poison Resist +70%; +2 to All Skills; +10% to Maximum Poison Resist; +20% Increased Attack Speed; +25-30 to Strength; 15% Chance to cast level 15 Poison Nova when struck; Level 3 Venom (20 Charges); 8-10% Life Stolen per Hit; Fire Resist -30%<br>RAW: `ac%(_;100;150); res-pois(_;70;70); allskills(_;2;2); res-pois-max(_;10;10); swing2(_;20;20); str(_;25;30); gethit-skill(92;15;15); charged(278;20;3); lifesteal(_;8;10); res-fire(_;-30;-30)` |
| 350 | Dragonscale | Zakarum Shield `pae` **QUEST** | 84 /80 | 1; 0; 0; 0 | 3 /5000 | 170-200% Enhanced Defense; Fire Absorb +10-20%; +5% to Maximum Fire Resist; +15-25 to Strength; Adds 211-371 Fire Damage; +10 to Hydra (oskill); +15% to Fire Skill Damage<br>RAW: `ac%(_;170;200); abs-fire%(_;10;20); res-fire-max(_;5;5); str(_;15;25); dmg-fire(_;211;371); oskill(Hydra;10;10); extra-fire(_;15;15)` |
| 351 | Steel Carapace [source: Steel Carapice] | Shadow Plate `uul` **QUEST** | 74 /66 | 1; 0; 0; 0 | 3 /5000 | 190-220% Enhanced Defense; +20% Faster Hit Recovery; Damage Reduced by 9-14; Cold Resist +40-60%; Regenerate Mana 10-15%; Repairs 1 Durability every 20s (rate 5); 8% Chance to cast level 6 Iron Maiden when struck<br>RAW: `ac%(_;190;220); balance2(_;20;20); red-dmg(_;9;14); res-cold(_;40;60); regen-mana(_;10;15); rep-dur(5;_;_); gethit-skill(Iron Maiden;8;6)` |
| 352 | Medusa's Gaze | Aegis `uow` **QUEST** | 84 /76 | 1; 0; 0; 0 | 3 /5000 | 150-180% Enhanced Defense; Slows Target by 20%; 10% Chance to cast level 7 Lower Resist when struck; 5-9% Life Stolen per Hit; 100% Chance to cast level 44 Nova when you Die; Cold Resist +40-80%<br>RAW: `ac%(_;150;180); slow(_;20;20); gethit-skill(Lower Resist;10;7); lifesteal(_;5;9); death-skill(Nova;100;44); res-cold(_;40;80)` |
| 353 | Ravenlore | Sky Spirit `dre` **QUEST** | 82 /74 | 1; 0; 0; 0 | 3 /5000 | 120-150% Enhanced Defense; All Resistances +15-25; +3 to Elemental (Druid) Skills; +20-30 to Energy; -10-20% to Enemy Fire Resistance; +7 to Raven (native class only)<br>RAW: `ac%(_;120;150); res-all(_;15;25); skilltab(17;3;3); enr(_;20;30); pierce-fire(_;10;20); skill(Raven;7;7)` |
| 354 | Boneshade | Lich Wand `7bw` | 84 /79 | 1; 0; 0; 0 | 3 /5000 | +2 to Necromancer Skill Levels; +25% Faster Cast Rate; +4-5 to Teeth (native class only); +4-5 to Bone Armor (native class only); +2-3 to Bone Spear (native class only); +1-2 to Bone Spirit (native class only); +2-3 to Bone Wall (native class only)<br>RAW: `nec(_;2;2); cast2(_;25;25); skill(Teeth;4;5); skill(Bone Armor;4;5); skill(Bone Spear;2;3); skill(Bone Spirit;1;2); skill(Bone Wall;2;3)` |
| 356 | Flamebellow | Balrog Blade `7gs` | 79 /71 | 1; 0; 0; 0 | 3 /5000 | 170-240% Enhanced Damage; Adds 233-482 Fire Damage; +3 to Fire Skills; Fire Absorb +20-30%; 12% Chance to cast level 16 Firestorm on striking; +10-20 to Strength; +5-10 to Vitality; +12-18 to Inferno (oskill)<br>RAW: `dmg%(_;170;240); dmg-fire(_;233;482); fireskill(_;3;3); abs-fire%(_;20;30); hit-skill(Firestorm;12;16); str(_;10;20); vit(_;5;10); oskill(Inferno;12;18)` |
| 357 | Death's Fathom [source: Fathom] | Dimensional Shard `obf` | 81 /73 | 1; 1; 0; 0 | 3 /5000 | +3 to Sorceress Skill Levels; +15-30% to Cold Skill Damage; +20% Faster Cast Rate; Fire Resist +25-40%; Lightning Resist +25-40%<br>RAW: `sor(_;3;3); extra-cold(_;15;30); cast2(_;20;20); res-fire(_;25;40); res-ltng(_;25;40)` |
| 358 | Wolfhowl | Fury Visor `bac` **QUEST** | 85 /79 | 1; 0; 0; 0 | 3 /5000 | 120-150% Enhanced Defense; +2-3 to Warcries (Barbarian) Skills; +8-15 to Strength; +8-15 to Dexterity; +8-15 to Vitality; +3-6 to Werewolf (oskill); Level 15 Summon Dire Wolf (18 Charges); +3-6 to Lycanthropy (oskill); +3-6 to Feral Rage (oskill)<br>RAW: `ac%(_;120;150); skilltab(14;2;3); str(_;8;15); dex(_;8;15); vit(_;8;15); oskill(Wearwolf;3;6); charged(Summon Fenris;18;15); oskill(Shape Shifting;3;6); oskill(Feral Rage;3;6)` |
| 359 | Spirit Ward | Ward `uts` **QUEST** | 76 /68 | 1; 0; 0; 0 | 3 /5000 | 130-180% Enhanced Defense; +6-11 Cold Absorb; All Resistances +30-40; 20-30% Increased Chance of Blocking; +25% Faster Block Rate; 5% Chance to cast level 8 Fade when struck<br>RAW: `ac%(_;130;180); abs-cold(_;6;11); res-all(_;30;40); block(_;20;30); block2(_;25;25); gethit-skill(Fade;5;8)` |
| 360 | Kira's Guardian | Tiara `ci2` **QUEST** | 85 /77 | 1; 1; 0; 0 | 3 /5000 | +50-120 Defense; All Resistances +50-70; Cannot Be Frozen; +20% Faster Hit Recovery<br>RAW: `ac(_;50;120); res-all(_;50;70); nofreeze(_;1;1); balance2(_;20;20)` |
| 361 | Ormus' Robes | Dusk Shroud `uui` **QUEST** | 83 /75 | 1; 0; 0; 0 | 3 /5000 | +10-20 Defense; +20% Faster Cast Rate; +10-15% to Fire Skill Damage; +10-15% to Cold Skill Damage; +10-15% to Lightning Skill Damage; Regenerate Mana 10-15%; +3 to a random skill (ids 36-60)<br>RAW: `ac(_;10;20); cast2(_;20;20); extra-fire(_;10;15); extra-cold(_;10;15); extra-ltng(_;10;15); regen-mana(_;10;15); skill-rand(3;36;60)` |
| 362 | Gheed's Fortune | Charm Large `cm3` | 70 /62 | 1; 1; 0; 1 | 3 /5000 | 20-40% Better Chance of Getting Magic Items; 80-160% Extra Gold from Monsters; Reduces All Vendor Prices 10-15%<br>RAW: `mag%(_;20;40); gold%(_;80;160); cheap(_;10;15)` |
| 363 | Stormlash | Scourge `7fl` | 86 /82 | 1; 0; 0; 0 | 3 /5000 | 240-300% Enhanced Damage; +30% Increased Attack Speed; 15% Chance to cast level 10 Static Field on striking; 20% Chance to cast level 18 Tornado on striking; Adds 1-473 Lightning Damage; Attacker Takes Lightning Damage of 30; 33% Chance of Crushing Blow; +3-9 Lightning Absorb<br>RAW: `dmg%(_;240;300); swing2(_;30;30); hit-skill(Static Field;15;10); hit-skill(Tornado;20;18); dmg-ltng(_;1;473); light-thorns(_;30;30); crush(_;33;33); abs-ltng(_;3;9)` |
| 364 | Halaberd's Reign | Conqueror Crown `bae` **QUEST** | 85 /77 | 1; 0; 0; 0 | 3 /5000 | 140-170% Enhanced Defense; +1 to Masteries (Barbarian) Skills; +2 to Barbarian Skill Levels; +20% Faster Hit Recovery; Replenish Life +15-23; +1-2 to Battle Orders (native class only); +1-2 to Battle Command (native class only)<br>RAW: `ac%(_;140;170); skilltab(13;1;1); bar(_;2;2); balance2(_;20;20); regen(_;15;23); skill(Battle Orders;1;2); skill(Battle Command;1;2)` |
| 366 | Spike Thorn | Blade Barrier `upk` **QUEST** | 78 /70 | 1; 0; 0; 0 | 5 /5000 | 120-150% Enhanced Defense; +1.375 Attacker Takes Damage per clvl (floor after scaling); +250 Maximum Durability; +30% Faster Hit Recovery; Damage Reduced by 15-20%; Socketed (1)<br>RAW: `ac%(_;120;150); thorns/lvl(11;_;_); dur(_;250;250); balance2(_;30;30); red-dmg%(_;15;20); sock(_;1;1)` |
| 367 | Dracul's Grasp | Vampirebone Gloves `uvg` **QUEST** | 84 /76 | 1; 0; 0; 0 | 5 /5000 | 90-120% Enhanced Defense; 7-10% Life Stolen per Hit; 25% Chance of Open Wounds; 5% Chance to cast level 10 Life Tap on striking; +5-10 Life after each Kill; +10-15 to Strength<br>RAW: `ac%(_;90;120); lifesteal(_;7;10); openwounds(_;25;25); hit-skill(Life Tap;5;10); heal-kill(_;5;10); str(_;10;15)` |
| 368 | Frostwind | Cryptic Sword `7ls` | 78 /70 | 1; 0; 0; 0 | 5 /5000 | 180-230% Enhanced Damage; Freezes Target +4; Half Freeze Duration; Adds 237-486 Cold Damage (6s chill); +25% Increased Attack Speed; Cold Absorb +7-15%; +7-14 to Arctic Blast (oskill)<br>RAW: `dmg%(_;180;230); freeze(_;4;4); half-freeze(_;1;1); dmg-cold(150;237;486); swing2(_;25;25); abs-cold%(_;7;15); oskill(Arctic Blast;7;14)` |
| 369 | Templar's Might | Sacred Armor `uar` **QUEST** | 82 /74 | 8; 0; 0; 0 | 5 /5000 | 170-220% Enhanced Defense; +20% Faster Hit Recovery; +250-300 Defense vs. Missile; +40-50 Maximum Stamina; +10-15 to Strength; +10-15 to Vitality; +1-2 to Offensive Auras (Paladin) Skills<br>RAW: `ac%(_;170;220); balance2(_;20;20); ac-miss(_;250;300); stam(_;40;50); str(_;10;15); vit(_;10;15); skilltab(10;1;2)` |
| 370 | Eschuta's Temper [source: Eschuta's temper] | Eldritch Orb `obc` | 80 /72 | 1; 0; 0; 0 | 5 /5000 | +1-3 to Sorceress Skill Levels; +40% Faster Cast Rate; +10-20% to Fire Skill Damage; +10-20% to Lightning Skill Damage; +20-30 to Energy<br>RAW: `sor(_;1;3); cast2(_;40;40); extra-fire(_;10;20); extra-ltng(_;10;20); enr(_;20;30)` |
| 371 | Firelizard's Talons | Feral Claws `7lw` | 75 /67 | 1; 0; 0; 0 | 5 /5000 | 200-270% Enhanced Damage; +15% Increased Attack Speed; +1-3 to Martial Arts (Assassin) Skills; Adds 236-480 Fire Damage; Fire Resist +40-70%; +1-2 to Wake of Fire (native class only); +1-2 to Inferno Sentry (native class only)<br>RAW: `dmg%(_;200;270); swing2(_;15;15); skilltab(20;1;3); dmg-fire(_;236;480); res-fire(_;40;70); skill(Wake of Fire Sentry;1;2); skill(Inferno Sentry;1;2)` |
| 372 | Sandstorm Trek | Scarabshell Boots `uvb` **QUEST** | 72 /64 | 1; 0; 0; 0 | 5 /5000 | 140-170% Enhanced Defense; +20% Faster Run/Walk; +20% Faster Hit Recovery; +1 Max Stamina per clvl (floor after scaling); 50% Slower Stamina Drain; Poison Resist +40-70%; Repairs 1 Durability every 20s (rate 5); +10-15 to Strength; +10-15 to Vitality<br>RAW: `ac%(_;140;170); move2(_;20;20); balance2(_;20;20); stam/lvl(8;_;_); stamdrain(_;50;50); res-pois(_;40;70); rep-dur(5;_;_); str(_;10;15); vit(_;10;15)` |
| 373 | Marrowwalk | Boneweave Boots `umb` **QUEST** | 74 /66 | 1; 0; 0; 0 | 5 /5000 | 170-200% Enhanced Defense; +20% Faster Run/Walk; Level 33 Bone Prison (13 Charges); Level 12 Life Tap (10 Charges); Heal Stamina Plus 10%; Regenerate Mana 10%; Half Freeze Duration; +10-20 to Strength; +17 to Dexterity; +1-2 to Skeleton Mastery (native class only)<br>RAW: `ac%(_;170;200); move2(_;20;20); charged(Bone Prison;13;33); charged(Life Tap;10;12); regen-stam(_;10;10); regen-mana(_;10;10); half-freeze(_;1;1); str(_;10;20); dex(_;17;17); skill(Skeleton Mastery;1;2)` |
| 374 | Heaven's Light | Mighty Scepter `7sc` | 69 /61 | 1; 1; 0; 0 | 5 /5000 | 250-300% Enhanced Damage; +20% Increased Attack Speed; -33% Target Defense; +3 to Light Radius; +15-20 Life after each Demon Kill; 33% Chance of Crushing Blow; Socketed (1-3); +2-3 to Paladin Skill Levels<br>RAW: `dmg%(_;250;300); swing2(_;20;20); reduce-ac(_;33;33); light(_;3;3); demon-heal(_;15;20); crush(_;33;33); sock(_;1;3); pal(_;2;3)` |
| 376 | Arachnid Mesh | Spiderweb Sash `ulc` **QUEST** | 87 /80 | 1; 0; 0; 0 | 5 /5000 | 90-120% Enhanced Defense; +20% Faster Cast Rate; Level 3 Venom (11 Charges); +1 to All Skills; Slows Target by 10%; Increase Maximum Mana 5%<br>RAW: `ac%(_;90;120); cast2(_;20;20); charged(Venom;11;3); allskills(_;1;1); slow(_;10;10); mana%(_;5;5)` |
| 377 | Nosferatu's Coil | Vampirefang Belt `uvc` **QUEST** | 68 /51 | 1; 0; 0; 0 | 5 /5000 | +15 to Strength; +2 to Mana after each Kill; Slows Target by 10%; 5-7% Life Stolen per Hit; +10% Increased Attack Speed; -3 to Light Radius<br>RAW: `str(_;15;15); mana-kill(_;2;2); slow(_;10;10); lifesteal(_;5;7); swing2(_;10;10); light(_;-3;-3)` |
| 378 | Metalgrid | amulet `amu` | 85 /81 | 2; 1; 0; 0 | 5 /5000 | +300-350 Defense; All Resistances +25-35; +400-450 to Attack Rating; Level 22 Iron Golem (11 Charges); Level 12 Iron Maiden (20 Charges)<br>RAW: `ac(_;300;350); res-all(_;25;35); att(_;400;450); charged(IronGolem;11;22); charged(Iron Maiden;20;12)` |
| 379 | Verdugo's Hearty Cord | Mithril Coil `umc` **QUEST** | 71 /63 | 1; 0; 0; 0 | 5 /5000 | 90-140% Enhanced Defense; +30-40 to Vitality; +100-120 Maximum Stamina; +10% Faster Hit Recovery; Damage Reduced by 10-15%; Replenish Life +10-13<br>RAW: `ac%(_;90;140); vit(_;30;40); stam(_;100;120); balance2(_;10;10); red-dmg%(_;10;15); regen(_;10;13)` |
| 381 | Carrion Wind | ring `rin` | 68 /60 | 3; 0; 0; 0 | 3 /5000 | +100-160 Defense vs. Missile; 6-9% Life Stolen per Hit; Poison Resist +55%; 10% Chance to cast level 10 Poison Nova when struck; Level 21 Plague Poppy (15 Charges); 8% Chance to cast level 13 Twister on striking; 10% Damage Taken Goes To Mana<br>RAW: `ac-miss(_;100;160); lifesteal(_;6;9); res-pois(_;55;55); gethit-skill(Poison Nova;10;10); charged(Plague Poppy;15;21); hit-skill(Twister;8;13); dmg-to-mana(_;10;10)` |
| 382 | Giant Skull [source: Giantskull] | Bone Visage `uh9` **QUEST** | 73 /65 | 1; 0; 0; 0 | 3 /5000 | +250-320 Defense; +25-35 to Strength; 10% Chance of Crushing Blow; Socketed (1-2); Knockback<br>RAW: `ac(_;250;320); str(_;25;35); crush(_;10;10); sock(_;1;2); knock(_;1;1)` |
| 383 | Astreon's Iron Ward [source: Ironward] | Caduceus `7ws` | 68 /60 | 1; 0; 0; 0 | 3 /5000 | 240-290% Enhanced Damage; Slows Target by 25%; 150-200% Bonus to Attack Rating; +10% Increased Attack Speed; Adds 80-240 Magic Damage; Damage Reduced by 4-7; +40-85 Damage (adds min/max); +2-4 to Combat (Paladin) Skills; 33% Chance of Crushing Blow<br>RAW: `dmg%(_;240;290); slow(_;25;25); att%(_;150;200); swing2(_;10;10); dmg-mag(_;80;240); red-dmg(_;4;7); dmg(_;40;85); skilltab(9;2;4); crush(_;33;33)` |
| 384 | Annihilus | Charm Small `cm1` | 110 /70 | 1; 0; 0; 1 | 3 /5000 | +1 to All Skills; +10-20 to All Attributes; All Resistances +10-20; +5-10% to Experience Gained<br>RAW: `allskills(_;1;1); all-stats(_;10;20); res-all(_;10;20); addxp(_;5;10)` |
| 385 | Arioc's Needle | Hyperion Spear `7sr` | 85 /81 | 1; 0; 0; 0 | 3 /5000 | 180-230% Enhanced Damage; Approx. 393.555 Poison Damage over 10s; authoritative rate 403–403/256 per frame; 50% Deadly Strike; Ignore Target's Defense; +2-4 to All Skills; +30% Increased Attack Speed<br>RAW: `dmg%(_;180;230); dmg-pois(250;403;403); deadly(_;50;50); ignore-ac(_;1;1); allskills(_;2;4); swing2(_;30;30)` |
| 386 | Cranebeak | War Spike `7mp` | 71 /63 | 1; 0; 0; 0 | 3 /5000 | 240-300% Enhanced Damage; Adds 1-305 Lightning Damage; +40% Increased Attack Speed; -25% Target Defense; 20-50% Better Chance of Getting Magic Items; Level 8 Raven (15 Charges)<br>RAW: `dmg%(_;240;300); dmg-ltng(_;1;305); swing2(_;40;40); reduce-ac(_;25;25); mag%(_;20;50); charged(Raven;15;8)` |
| 387 | Nord's Tenderizer | Truncheon `7cl` | 76 /68 | 1; 0; 0; 0 | 3 /5000 | 270-330% Enhanced Damage; Freezes Target +2-4; +25% Increased Attack Speed; Level 16 Blizzard (12 Charges); 150-180% Bonus to Attack Rating; Cold Absorb +5-15%; Adds 205-455 Cold Damage (5s chill)<br>RAW: `dmg%(_;270;330); freeze(_;2;4); swing2(_;25;25); charged(Blizzard;12;16); att%(_;150;180); abs-cold%(_;5;15); dmg-cold(125;205;455)` |
| 388 | Earthshifter | Thunder Maul `7gm` | 77 /69 | 1; 0; 0; 0 | 3 /5000 | 250-300% Enhanced Damage; 25% Chance to cast level 14 Eruption on striking; 33% Chance of Crushing Blow; +10% Increased Attack Speed; Level 14 Volcano (30 Charges); +7 to Elemental (Druid) Skills; +10% Faster Cast Rate<br>RAW: `dmg%(_;250;300); hit-skill(Eruption;25;14); crush(_;33;33); swing2(_;10;10); charged(Volcano;30;14); skilltab(17;7;7); cast2(_;10;10)` |
| 389 | Wraithflight | Ghost Glaive `7gl` | 84 /76 | 1; 1; 0; 0 | 3 /5000 | 150-190% Enhanced Damage; Replenishes 1 Quantity every 2.5s (rate 40); 9-13% Life Stolen per Hit; +15 to Mana after each Kill; Ethereal (cannot be repaired)<br>RAW: `dmg%(_;150;190); rep-quant(40;_;_); lifesteal(_;9;13); mana-kill(_;15;15); ethereal(_;1;1)` |
| 390 | Bonehew | Ogre Axe `7o7` | 72 /64 | 1; 0; 0; 0 | 3 /5000 | 270-320% Enhanced Damage; +30% Increased Attack Speed; Level 14 Corpse Explosion (30 Charges); 50% Chance to cast level 16 Bone Spear on striking; Prevent Monster Heal; Socketed (2)<br>RAW: `dmg%(_;270;320); swing2(_;30;30); charged(Corpse Explosion;30;14); hit-skill(Bone Spear;50;16); noheal(_;1;1); sock(_;2;2)` |
| 391 | Ondal's Wisdom | Elder Staff `6cs` | 74 /66 | 1; 0; 0; 0 | 3 /5000 | +45% Faster Cast Rate; +40-50 to Energy; +2-4 to All Skills; +450-550 Defense; +5% to Experience Gained; Magic Damage Reduced by 5-8<br>RAW: `cast2(_;45;45); enr(_;40;50); allskills(_;2;4); ac(_;450;550); addxp(_;5;5); red-mag(_;5;8)` |
| 392 | The Redeemer [source: The Reedeemer] | Mighty Scepter `7sc` | 80 /72 | 1; 0; 0; 0 | 3 /5000 | 250-300% Enhanced Damage; +200-250% Damage to Demons; +2 to Paladin Skill Levels; Requirements -60%; +2-4 to Redemption (native class only); +2-4 to Holy Bolt (native class only); +3 to Light Radius; -33% Target Defense; +60-120 Damage (adds min/max)<br>RAW: `dmg%(_;250;300); dmg-demon(_;200;250); pal(_;2;2); ease(_;-60;-60); skill(Redemption;2;4); skill(Holy Bolt;2;4); light(_;3;3); reduce-ac(_;33;33); dmg(_;60;120)` |
| 393 | Head Hunter's Glory [source: Headhunter's Glory] | Troll Nest `ush` **QUEST** | 83 /75 | 1; 0; 0; 0 | 3 /5000 | +320-420 Defense; +300-350 Defense vs. Missile; Poison Resist +30-40%; Socketed (1-3); Fire Resist +20-30%; +5-7 Life after each Kill<br>RAW: `ac(_;320;420); ac-miss(_;300;350); res-pois(_;30;40); sock(_;1;3); res-fire(_;20;30); heal-kill(_;5;7)` |
| 394 | Steelrend | Ogre Gauntlets `uhg` **QUEST** | 78 /70 | 1; 0; 0; 0 | 3 /5000 | +170-210 Defense; +15-20 to Strength; 30-60% Enhanced Damage; 10% Chance of Crushing Blow<br>RAW: `ac(_;170;210); str(_;15;20); dmg%(_;30;60); crush(_;10;10)` |
| 395 | Rainbow Facet | Jewel `jew` | 85 /49 | 1; 0; 0; 0 | 3 /5000 | Adds 1-74 Lightning Damage; -3-5% to Enemy Lightning Resistance; +3-5% to Lightning Skill Damage; 100% Chance to cast level 47 Chain Lightning when you Die<br>RAW: `dmg-ltng(_;1;74); pierce-ltng(_;3;5); extra-ltng(_;3;5); death-skill(Chain Lightning;100;47)` |
| 396 | Rainbow Facet | Jewel `jew` | 85 /49 | 1; 0; 0; 0 | 3 /5000 | Adds 24-38 Cold Damage (0.12s chill); -3-5% to Enemy Cold Resistance; +3-5% to Cold Skill Damage; 100% Chance to cast level 37 Blizzard when you Die<br>RAW: `dmg-cold(3;24;38); pierce-cold(_;3;5); extra-cold(_;3;5); death-skill(Blizzard;100;37)` |
| 397 | Rainbow Facet | Jewel `jew` | 85 /49 | 1; 0; 0; 0 | 3 /5000 | Adds 17-45 Fire Damage; -3-5% to Enemy Fire Resistance; +3-5% to Fire Skill Damage; 100% Chance to cast level 31 Meteor when you Die<br>RAW: `dmg-fire(_;17;45); pierce-fire(_;3;5); extra-fire(_;3;5); death-skill(Meteor;100;31)` |
| 398 | Rainbow Facet | Jewel `jew` | 85 /49 | 1; 0; 0; 0 | 3 /5000 | Approx. 36.5234 Poison Damage over 2s; authoritative rate 187–187/256 per frame; -3-5% to Enemy Poison Resistance; +3-5% to Poison Skill Damage; 100% Chance to cast level 51 Poison Nova when you Die<br>RAW: `dmg-pois(50;187;187); pierce-pois(_;3;5); extra-pois(_;3;5); death-skill(Poison Nova;100;51)` |
| 399 | Rainbow Facet | Jewel `jew` | 85 /49 | 1; 0; 0; 0 | 3 /5000 | Adds 1-74 Lightning Damage; -3-5% to Enemy Lightning Resistance; +3-5% to Lightning Skill Damage; 100% Chance to cast level 41 Nova when you Level-Up<br>RAW: `dmg-ltng(_;1;74); pierce-ltng(_;3;5); extra-ltng(_;3;5); levelup-skill(Nova;100;41)` |
| 400 | Rainbow Facet | Jewel `jew` | 85 /49 | 1; 0; 0; 0 | 3 /5000 | Adds 24-38 Cold Damage (0.12s chill); -3-5% to Enemy Cold Resistance; +3-5% to Cold Skill Damage; 100% Chance to cast level 43 Frost Nova when you Level-Up<br>RAW: `dmg-cold(3;24;38); pierce-cold(_;3;5); extra-cold(_;3;5); levelup-skill(Frost Nova;100;43)` |
| 401 | Rainbow Facet | Jewel `jew` | 85 /49 | 1; 0; 0; 0 | 3 /5000 | Adds 17-45 Fire Damage; -3-5% to Enemy Fire Resistance; +3-5% to Fire Skill Damage; 100% Chance to cast level 29 Blaze when you Level-Up<br>RAW: `dmg-fire(_;17;45); pierce-fire(_;3;5); extra-fire(_;3;5); levelup-skill(Blaze;100;29)` |
| 402 | Rainbow Facet | Jewel `jew` | 85 /49 | 1; 0; 0; 0 | 3 /5000 | Approx. 36.5234 Poison Damage over 2s; authoritative rate 187–187/256 per frame; -3-5% to Enemy Poison Resistance; +3-5% to Poison Skill Damage; 100% Chance to cast level 23 Venom when you Level-Up<br>RAW: `dmg-pois(50;187;187); pierce-pois(_;3;5); extra-pois(_;3;5); levelup-skill(Venom;100;23)` |
| 403 | Hellfire Torch | Charm Medium `cm2` | 110 /75 | 1; 0; 0; 1 | 3 /5000 | +3 to Skill Levels of one random class (ids0–6); +10-20 to All Attributes; All Resistances +10-20; +8 to Light Radius; 5% Chance to cast level 10 Diablo Firestorm on striking; Level 30 Hydra (10 Charges)<br>RAW: `randclassskill(_;0;6); all-stats(_;10;20); res-all(_;10;20); light(_;8;8); hit-skill(197;5;10); charged(Hydra;10;30)` |

## Appendix G. All 32 complete sets, all 127 pieces, incremental bonuses

[Source SetItems.txt](https://cdn.jsdelivr.net/gh/fabd/diablo2@45112569deb9384738ccafe5c24ebbb71f41c7c9/code/d2_113_data/SetItems.txt).

[Source Sets.txt](https://cdn.jsdelivr.net/gh/fabd/diablo2@45112569deb9384738ccafe5c24ebbb71f41c7c9/code/d2_113_data/Sets.txt).

Includes all ten requested full sets and the remainder. `add func=2`: auxiliary index1/2/3/4/5 corresponds to2/3/4/5/6 distinct pieces. `add func=0/blank`: auxiliary properties always active and included in baseline below. `add func=1` companion-specific: Civerb's Ward handled explicitly. Global partial and full properties are incremental, **not summary totals**. Full-completion state/aura tuples are retained as visual/animation state identifiers; Trang state affects animation mechanics. Base values come from Appendix A; no implied set-upgrade recipes.


### G. Civerb's Vestments (3 pieces)

| Piece /source key | Base /code | Req lvl; definition lvl | Baseline properties /raw | Per-piece conditional properties /raw | add func; rarity; price mult/add |
| --- | --- | --- | --- | --- | --- |
| Civerb's Ward | Large Shield `lrg` | 9; 13 | +15 Defense; 15% Increased Chance of Blocking<br>RAW: `ac(_;15;15); block(_;15;15)` | **with Civerb's Icon**: +21-22 to Mana<br>RAW: `mana(_;21;22)`<br>**with Civerb's Cudgel**: Poison Resist +25-26%<br>RAW: `res-pois(_;25;26)` | 1; 7; 5/2500 |
| Civerb's Icon | amulet `amu` | 9; 13 | Regenerate Mana 40%; Replenish Life +4<br>RAW: `regen-mana(_;40;40); regen(_;4;4)` | **2 distinct pieces**: Cold Resist +25%<br>RAW: `res-cold(_;25;25)`<br>**3 distinct pieces**: +25 Defense<br>RAW: `ac(_;25;25)` | 2; 7; 5/2500 |
| Civerb's Cudgel | Grand Scepter `gsc` | 9; 13 | +75 to Attack Rating; +17-23 to Maximum Damage; +1 Maximum Damage per clvl (floor after scaling)<br>RAW: `att(_;75;75); dmg-max(_;17;23); dmg/lvl(8;_;_)` | — | 0; 7; 5/2500 |

| Global threshold | Additional properties /raw |
| --- | --- |
| 2 distinct pieces | Fire Resist +15%<br>RAW: `res-fire(_;15;15)` |
| All 3 distinct pieces; add to earlier thresholds | +15 to Strength; +200% Damage to Undead; Lightning Resist +25%<br>RAW: `str(0;15;15); dmg-undead(0;200;200); res-ltng(0;25;25)` |

### G. Hsarus' Defense (3 pieces)

| Piece /source key | Base /code | Req lvl; definition lvl | Baseline properties /raw | Per-piece conditional properties /raw | add func; rarity; price mult/add |
| --- | --- | --- | --- | --- | --- |
| Hsarus' Iron Heel | Chain Boots `mbt` | 3; 4 | Fire Resist +25%; +20% Faster Run/Walk<br>RAW: `res-fire(_;25;25); move2(_;20;20)` | **2 distinct pieces**: +10 Attack Rating per clvl (floor after scaling)<br>RAW: `att/lvl(20;_;_)` | 2; 7; 5/2500 |
| Hsarus' Iron Fist | Buckler `buc` | 3; 4 | Damage Reduced by 2; +10 to Strength<br>RAW: `red-dmg(_;2;2); str(_;10;10)` | **2 distinct pieces**: +2.5 Defense per clvl (floor after scaling)<br>RAW: `ac/lvl(20;_;_)` | 2; 7; 5/2500 |
| Hsarus' Iron Stay | Belt `mbl` | 3; 4 | Cold Resist +20%; +20 to Life<br>RAW: `res-cold(_;20;20); hp(_;20;20)` | **2 distinct pieces**: +2.5 Defense per clvl (floor after scaling)<br>RAW: `ac/lvl(20;_;_)` | 2; 7; 5/2500 |

| Global threshold | Additional properties /raw |
| --- | --- |
| 2 distinct pieces | Attacker Takes Damage of 5<br>RAW: `thorns(_;5;5)` |
| All 3 distinct pieces; add to earlier thresholds | +5 to Maximum Damage; Cannot Be Frozen; Lightning Resist +25%<br>RAW: `dmg-max(0;5;5); nofreeze(0;1;1); res-ltng(0;25;25)` |

### G. Cleglaw's Brace (3 pieces)

| Piece /source key | Base /code | Req lvl; definition lvl | Baseline properties /raw | Per-piece conditional properties /raw | add func; rarity; price mult/add |
| --- | --- | --- | --- | --- | --- |
| Cleglaw's Tooth | Long Sword `lsd` | 4; 6 | 30% Bonus to Attack Rating; 50% Deadly Strike<br>RAW: `att%(_;30;30); deadly(_;50;50)` | **2 distinct pieces**: +1.25 Maximum Damage per clvl (floor after scaling)<br>RAW: `dmg/lvl(10;_;_)` | 2; 7; 5/2500 |
| Cleglaw's Claw | Small Shield `sml` | 4; 6 | +17 Defense; Poison Length Reduced by 75%<br>RAW: `ac(_;17;17); res-pois-len(_;75;75)` | **2 distinct pieces**: All Resistances +15<br>RAW: `res-all(_;15;15)` | 2; 7; 5/2500 |
| Cleglaw's Pincers | Chain Gloves `mgl` | 4; 6 | Knockback; Slows Target by 25%<br>RAW: `knock(_;1;1); slow(_;25;25)` | **2 distinct pieces**: +10 Attack Rating per clvl (floor after scaling)<br>RAW: `att/lvl(20;_;_)` | 2; 7; 5/2500 |

| Global threshold | Additional properties /raw |
| --- | --- |
| 2 distinct pieces | +50 Defense<br>RAW: `ac(_;50;50)` |
| All 3 distinct pieces; add to earlier thresholds | +50 Defense; 6% Mana Stolen per Hit; 35% Chance of Crushing Blow; +20% Increased Attack Speed<br>RAW: `ac(0;50;50); manasteal(0;6;6); crush(0;35;35); swing2(_;20;20)` |

### G. Iratha's Finery (4 pieces)

| Piece /source key | Base /code | Req lvl; definition lvl | Baseline properties /raw | Per-piece conditional properties /raw | add func; rarity; price mult/add |
| --- | --- | --- | --- | --- | --- |
| Iratha's Collar | amulet `amu` | 15; 21 | Poison Resist +30%; Poison Length Reduced by 75%<br>RAW: `res-pois(_;30;30); res-pois-len(_;75;75)` | **2 distinct pieces**: All Resistances +15<br>RAW: `res-all(_;15;15)` | 2; 7; 5/2500 |
| Iratha's Cuff | Light Gauntlets `tgl` | 15; 21 | Cold Resist +30%; Half Freeze Duration<br>RAW: `res-cold(_;30;30); half-freeze(_;1;1)` | **2 distinct pieces**: +20% Increased Attack Speed<br>RAW: `swing2(_;20;20)` | 2; 7; 5/2500 |
| Iratha's Coil | Crown `crn` | 15; 21 | Fire Resist +30%; Lightning Resist +30%<br>RAW: `res-fire(_;30;30); res-ltng(_;30;30)` | **2 distinct pieces**: +2 Defense per clvl (floor after scaling)<br>RAW: `ac/lvl(16;_;_)` | 2; 7; 5/2500 |
| Iratha's Cord | Heavy Belt `tbl` | 15; 21 | +25 Defense; +5 to Minimum Damage<br>RAW: `ac(_;25;25); dmg-min(_;5;5)` | **2 distinct pieces**: +10 to Dexterity<br>RAW: `dex(_;10;10)` | 2; 7; 5/2500 |

| Global threshold | Additional properties /raw |
| --- | --- |
| 2 distinct pieces | +50 Defense<br>RAW: `ac(_;50;50)` |
| 3 distinct pieces | +20% Faster Run/Walk<br>RAW: `move2(_;20;20)` |
| All 4 distinct pieces; add to earlier thresholds | All Resistances +20; +10% to Maximum Fire Resist; +10% to Maximum Cold Resist; +10% to Maximum Lightning Resist; +10% to Maximum Poison Resist; +15 to Dexterity<br>RAW: `res-all(0;20;20); res-fire-max(0;10;10); res-cold-max(0;10;10); res-ltng-max(0;10;10); res-pois-max(0;10;10); dex(0;15;15)` |

### G. Isenhart's Armory (4 pieces)

| Piece /source key | Base /code | Req lvl; definition lvl | Baseline properties /raw | Per-piece conditional properties /raw | add func; rarity; price mult/add |
| --- | --- | --- | --- | --- | --- |
| Isenhart's Lightbrand | Broad Sword `bsd` | 8; 11 | +10 to Minimum Damage; +20% Increased Attack Speed<br>RAW: `dmg-min(_;10;10); swing2(_;20;20)` | **2 distinct pieces**: +5 Attack Rating per clvl (floor after scaling)<br>RAW: `att/lvl(10;_;_)` | 2; 7; 5/2500 |
| Isenhart's Parry | Gothic Shield `gts` | 8; 11 | +40 Defense; Attacker Takes Lightning Damage of 4<br>RAW: `ac(_;40;40); light-thorns(_;4;4)` | **2 distinct pieces**: All Resistances +8<br>RAW: `res-all(_;8;8)` | 2; 7; 5/2500 |
| Isenhart's Case | Breast Plate `brs` | 8; 11 | +40 Defense; Magic Damage Reduced by 2<br>RAW: `ac(_;40;40); red-mag(_;2;2)` | **2 distinct pieces**: +2 Defense per clvl (floor after scaling)<br>RAW: `ac/lvl(16;_;_)` | 2; 7; 5/2500 |
| Isenhart's Horns | Full Helm `fhl` | 8; 11 | +6 to Dexterity; Damage Reduced by 2<br>RAW: `dex(_;6;6); red-dmg(_;2;2)` | **2 distinct pieces**: All Resistances +8<br>RAW: `res-all(_;8;8)` | 2; 7; 5/2500 |

| Global threshold | Additional properties /raw |
| --- | --- |
| 2 distinct pieces | +10 to Strength<br>RAW: `str(_;10;10)` |
| 3 distinct pieces | +10 to Dexterity<br>RAW: `dex(_;10;10)` |
| All 4 distinct pieces; add to earlier thresholds | 5% Life Stolen per Hit; All Resistances +10; 35% Bonus to Attack Rating; 30% Increased Chance of Blocking; +20% Faster Run/Walk<br>RAW: `lifesteal(0;5;5); res-all(0;10;10); att%(0;35;35); block(_;30;30); move2(_;20;20)` |

### G. Vidala's Rig (4 pieces)

| Piece /source key | Base /code | Req lvl; definition lvl | Baseline properties /raw | Per-piece conditional properties /raw | add func; rarity; price mult/add |
| --- | --- | --- | --- | --- | --- |
| Vidala's Barb | Long Battle Bow `lbb` | 14; 19 | +1 min ltng dmg; +20 max ltng dmg<br>RAW: `ltng-min(_;1;1); ltng-max(_;20;20)` | **2 distinct pieces**: +8 Attack Rating per clvl (floor after scaling)<br>RAW: `att/lvl(16;_;_)` | 2; 7; 5/2500 |
| Vidala's Fetlock | Light Plated Boots `tbt` | 14; 19 | +150 Maximum Stamina; +30% Faster Run/Walk<br>RAW: `stam(_;150;150); move3(_;30;30)` | **2 distinct pieces**: All Resistances +8<br>RAW: `res-all(_;8;8)` | 2; 7; 5/2500 |
| Vidala's Ambush | Leather Armor `lea` | 14; 19 | +50 Defense; +11 to Dexterity<br>RAW: `ac(_;50;50); dex(_;11;11)` | **2 distinct pieces**: Fire Resist +24%<br>RAW: `res-fire(_;24;24)`<br>**3 distinct pieces**: +2.5 Defense per clvl (floor after scaling)<br>RAW: `ac/lvl(20;_;_)` | 2; 7; 5/2500 |
| Vidala's Snare | amulet `amu` | 14; 19 | +15 to Life; Cold Resist +20%<br>RAW: `hp(_;15;15); res-cold(_;20;20)` | **2 distinct pieces**: 50% Better Chance of Getting Magic Items<br>RAW: `mag%(_;50;50)` | 2; 7; 5/2500 |

| Global threshold | Additional properties /raw |
| --- | --- |
| 2 distinct pieces | +75 to Attack Rating<br>RAW: `att(_;75;75)` |
| 3 distinct pieces | +15 to Dexterity<br>RAW: `dex(_;15;15)` |
| All 4 distinct pieces; add to earlier thresholds | Adds 15-20 Cold Damage (2s chill); Freezes Target +1; 50% Chance to Pierce; +10 to Strength<br>RAW: `dmg-cold(50;15;20); freeze(0;1;1); pierce(0;50;50); str(_;10;10)` |

### G. Milabrega's Regalia (4 pieces)

| Piece /source key | Base /code | Req lvl; definition lvl | Baseline properties /raw | Per-piece conditional properties /raw | add func; rarity; price mult/add |
| --- | --- | --- | --- | --- | --- |
| Milabrega's Orb | Kite Shield `kit` | 17; 23 | 20% Better Chance of Getting Magic Items; +25 Defense<br>RAW: `mag%(_;20;20); ac(_;25;25)` | **2 distinct pieces**: +50 to Life<br>RAW: `hp(_;50;50)`<br>**3 distinct pieces**: 50% Enhanced Defense<br>RAW: `ac%(_;50;50)` | 2; 7; 5/2500 |
| Milabrega's Rod | War Scepter `wsp` | 17; 23 | +1 to Paladin Skill Levels; 50% Enhanced Damage; +2 to Light Radius<br>RAW: `pal(_;1;1); dmg%(_;50;50); light(_;2;2)` | — | 0; 7; 5/2500 |
| Milabrega's Diadem | Crown `crn` | 17; 23 | +15 to Life; +15 to Mana<br>RAW: `hp(_;15;15); mana(_;15;15)` | **2 distinct pieces**: Cold Resist +40%<br>RAW: `res-cold(_;40;40)` | 2; 7; 5/2500 |
| Milabrega's Robe | Ancient Armor `aar` | 17; 23 | Attacker Takes Damage of 3; Damage Reduced by 2<br>RAW: `thorns(_;3;3); red-dmg(_;2;2)` | **2 distinct pieces**: 100% Enhanced Defense<br>RAW: `ac%(_;100;100)` | 2; 7; 5/2500 |

| Global threshold | Additional properties /raw |
| --- | --- |
| 2 distinct pieces | +75 to Attack Rating<br>RAW: `att(_;75;75)` |
| 3 distinct pieces | +125 to Attack Rating<br>RAW: `att(_;125;125)` |
| All 4 distinct pieces; add to earlier thresholds | 8% Life Stolen per Hit; +2 to Paladin Skill Levels; 10% Mana Stolen per Hit; Poison Resist +15%<br>RAW: `lifesteal(0;8;8); pal(0;2;2); manasteal(0;10;10); res-pois(0;15;15)` |

### G. Cathan's Traps (5 pieces)

| Piece /source key | Base /code | Req lvl; definition lvl | Baseline properties /raw | Per-piece conditional properties /raw | add func; rarity; price mult/add |
| --- | --- | --- | --- | --- | --- |
| Cathan's Rule | Battle Staff `bst` | 11; 15 | +1 to Fire Skills; +10 max fire dmg<br>RAW: `fireskill(_;1;1); fire-max(_;10;10)` | **2 distinct pieces**: +50 to Mana<br>RAW: `mana(_;50;50)`<br>**3 distinct pieces**: All Resistances +10<br>RAW: `res-all(_;10;10)` | 2; 7; 5/2500 |
| Cathan's Mesh | Chain Mail `chn` | 11; 15 | +15 Defense; Requirements -50%<br>RAW: `ac(_;15;15); ease(_;-50;-50)` | **2 distinct pieces**: Attacker Takes Damage of 5<br>RAW: `thorns(_;5;5)`<br>**3 distinct pieces**: Fire Resist +30%<br>RAW: `res-fire(_;30;30)` | 2; 7; 5/2500 |
| Cathan's Visage | Mask `msk` | 11; 15 | +20 to Mana; Cold Resist +25%<br>RAW: `mana(_;20;20); res-cold(_;25;25)` | **2 distinct pieces**: +2 Defense per clvl (floor after scaling)<br>RAW: `ac/lvl(16;_;_)` | 2; 7; 5/2500 |
| Cathan's Sigil | amulet `amu` | 11; 15 | +10% Faster Hit Recovery; Attacker Takes Lightning Damage of 5<br>RAW: `balance1(_;10;10); light-thorns(_;5;5)` | **2 distinct pieces**: +50 to Attack Rating<br>RAW: `att(_;50;50)`<br>**3 distinct pieces**: 25% Better Chance of Getting Magic Items<br>RAW: `mag%(_;25;25)` | 2; 7; 5/2500 |
| Cathan's Seal | ring `rin` | 11; 15 | 6% Life Stolen per Hit; Damage Reduced by 2<br>RAW: `lifesteal(_;6;6); red-dmg(_;2;2)` | **2 distinct pieces**: +10 to Strength<br>RAW: `str(_;10;10)` | 2; 7; 5/2500 |

| Global threshold | Additional properties /raw |
| --- | --- |
| 2 distinct pieces | Adds 15-20 Fire Damage<br>RAW: `dmg-fire(_;15;20)` |
| 3 distinct pieces | Lightning Resist +25%<br>RAW: `res-ltng(_;25;25)` |
| All 5 distinct pieces; add to earlier thresholds | +60 to Attack Rating; Magic Damage Reduced by 3; All Resistances +25; +10% Faster Cast Rate; +20 to Mana<br>RAW: `att(0;60;60); red-mag(0;3;3); res-all(0;25;25); cast1(0;10;10); mana(0;20;20)` |

### G. Tancred's Battlegear (5 pieces)

| Piece /source key | Base /code | Req lvl; definition lvl | Baseline properties /raw | Per-piece conditional properties /raw | add func; rarity; price mult/add |
| --- | --- | --- | --- | --- | --- |
| Tancred's Crowbill | Military Pick `mpi` | 20; 27 | +75 to Attack Rating; 80% Enhanced Damage<br>RAW: `att(_;75;75); dmg%(_;80;80)` | **2 distinct pieces**: +20 to Mana<br>RAW: `mana(_;20;20)`<br>**3 distinct pieces**: +20% Increased Attack Speed<br>RAW: `swing2(_;20;20)` | 2; 7; 5/2500 |
| Tancred's Spine | Full Plate Mail `ful` | 20; 27 | +40 to Life; +15 to Strength<br>RAW: `hp(_;40;40); str(_;15;15)` | **2 distinct pieces**: +2 Defense per clvl (floor after scaling)<br>RAW: `ac/lvl(16;_;_)` | 2; 7; 5/2500 |
| Tancred's Hobnails | Boots `lbt` | 20; 27 | Heal Stamina Plus 25%; +10 to Dexterity<br>RAW: `regen-stam(_;25;25); dex(_;10;10)` | **2 distinct pieces**: +30% Faster Run/Walk<br>RAW: `move3(_;30;30)`<br>**3 distinct pieces**: +10 to Strength<br>RAW: `str(_;10;10)` | 2; 7; 5/2500 |
| Tancred's Weird | amulet `amu` | 20; 27 | Damage Reduced by 2; Magic Damage Reduced by 1<br>RAW: `red-dmg(_;2;2); red-mag(_;1;1)` | **2 distinct pieces**: 78% Better Chance of Getting Magic Items<br>RAW: `mag%(_;78;78)`<br>**3 distinct pieces**: +60 to Attack Rating<br>RAW: `att(_;60;60)` | 2; 7; 5/2500 |
| Tancred's Skull | Bone Helm `bhm` | 20; 27 | 10% Enhanced Damage; +40 to Attack Rating<br>RAW: `dmg%(_;10;10); att(_;40;40)` | **2 distinct pieces**: All Resistances +10<br>RAW: `res-all(_;10;10)` | 2; 7; 5/2500 |

| Global threshold | Additional properties /raw |
| --- | --- |
| 2 distinct pieces | Adds 15-15 Lightning Damage<br>RAW: `dmg-ltng(_;15;15)` |
| 3 distinct pieces | 5% Life Stolen per Hit<br>RAW: `lifesteal(_;5;5)` |
| All 5 distinct pieces; add to earlier thresholds | 75% Extra Gold from Monsters; All Resistances +10; Slows Target by 35%; 5% Mana Stolen per Hit<br>RAW: `gold%(0;75;75); res-all(0;10;10); slow(0;35;35); manasteal(0;5;5)` |

### G. Sigon's Complete Steel (6 pieces)

| Piece /source key | Base /code | Req lvl; definition lvl | Baseline properties /raw | Per-piece conditional properties /raw | add func; rarity; price mult/add |
| --- | --- | --- | --- | --- | --- |
| Sigon's Gage | Gauntlets `hgl` | 6; 9 | +10 to Strength; +20 to Attack Rating<br>RAW: `str(_;10;10); att(_;20;20)` | **2 distinct pieces**: +30% Increased Attack Speed<br>RAW: `swing3(_;30;30)` | 2; 7; 5/2500 |
| Sigon's Visor | Great Helm `ghm` | 6; 9 | +30 to Mana; +25 Defense<br>RAW: `mana(_;30;30); ac(_;25;25)` | **2 distinct pieces**: +8 Attack Rating per clvl (floor after scaling)<br>RAW: `att/lvl(16;_;_)` | 2; 7; 5/2500 |
| Sigon's Shelter | Gothic Plate `gth` | 6; 9 | 25% Enhanced Defense; Lightning Resist +30%<br>RAW: `ac%(_;25;25); res-ltng(_;30;30)` | **2 distinct pieces**: Attacker Takes Damage of 20<br>RAW: `thorns(_;20;20)` | 2; 7; 5/2500 |
| Sigon's Sabot | Greaves `hbt` | 6; 9 | +20% Faster Run/Walk; Cold Resist +40%<br>RAW: `move2(_;20;20); res-cold(_;40;40)` | **2 distinct pieces**: +50 to Attack Rating<br>RAW: `att(_;50;50)`<br>**3 distinct pieces**: 50% Better Chance of Getting Magic Items<br>RAW: `mag%(_;50;50)` | 2; 7; 5/2500 |
| Sigon's Wrap | Plated Belt `hbl` | 6; 9 | Fire Resist +20%; +20 to Life<br>RAW: `res-fire(_;20;20); hp(_;20;20)` | **2 distinct pieces**: +2 Defense per clvl (floor after scaling)<br>RAW: `ac/lvl(16;_;_)` | 2; 7; 5/2500 |
| Sigon's Guard | Tower Shield `tow` | 6; 9 | +1 to All Skills; 20% Increased Chance of Blocking<br>RAW: `allskills(_;1;1); block(_;20;20)` | — | 2; 7; 5/2500 |

| Global threshold | Additional properties /raw |
| --- | --- |
| 2 distinct pieces | 10% Life Stolen per Hit<br>RAW: `lifesteal(_;10;10)` |
| 3 distinct pieces | +100 Defense<br>RAW: `ac(_;100;100)` |
| All 6 distinct pieces; add to earlier thresholds | Fire Resist +12%; Attacker Takes Damage of 12; Damage Reduced by 7; +24 max fire dmg; +20 to Mana<br>RAW: `res-fire(0;12;12); thorns(0;12;12); red-dmg(0;7;7); fire-max(0;24;24); mana(_;20;20)` |

### G. Infernal Tools (3 pieces)

| Piece /source key | Base /code | Req lvl; definition lvl | Baseline properties /raw | Per-piece conditional properties /raw | add func; rarity; price mult/add |
| --- | --- | --- | --- | --- | --- |
| Infernal Cranium | Cap `cap` | 5; 7 | All Resistances +10; 20% Damage Taken Goes To Mana<br>RAW: `res-all(_;10;10); dmg-to-mana(_;20;20)` | **2 distinct pieces**: +2 Defense per clvl (floor after scaling)<br>RAW: `ac/lvl(16;_;_)` | 2; 7; 5/2500 |
| Infernal Torch | Grim Wand `gwn` | 5; 7 | +8 to Minimum Damage; +1 to Necromancer Skill Levels<br>RAW: `dmg-min(_;8;8); nec(_;1;1)` | **2 distinct pieces**: +10 Attack Rating per clvl (floor after scaling)<br>RAW: `att/lvl(20;_;_)` | 2; 7; 5/2500 |
| Infernal Sign | Heavy Belt `tbl` | 5; 7 | +25 Defense; +20 to Life<br>RAW: `ac(_;25;25); hp(_;20;20)` | **2 distinct pieces**: Poison Resist +25%<br>RAW: `res-pois(_;25;25)`<br>**3 distinct pieces**: Half Freeze Duration<br>RAW: `half-freeze(_;1;1)` | 2; 7; 5/2500 |

| Global threshold | Additional properties /raw |
| --- | --- |
| 2 distinct pieces | Approx. 7.8125 Poison Damage over 3.2s; authoritative rate 25–25/256 per frame<br>RAW: `dmg-pois(80;25;25)` |
| 3 distinct pieces | +10 to Mana<br>RAW: `mana(_;10;10)` |
| All 3 distinct pieces; add to earlier thresholds | 20% Bonus to Attack Rating; +1 to Necromancer Skill Levels; 20% Chance of Open Wounds; 6% Mana Stolen per Hit<br>RAW: `att%(0;20;20); nec(0;1;1); openwounds(0;20;20); manasteal(_;6;6)` |

### G. Berserker's Arsenal (3 pieces)

Internal set key: `Berserker's Garb`.

| Piece /source key | Base /code | Req lvl; definition lvl | Baseline properties /raw | Per-piece conditional properties /raw | add func; rarity; price mult/add |
| --- | --- | --- | --- | --- | --- |
| Berserker's Headgear | Helm `hlm` | 3; 5 | +15 Defense; Fire Resist +25%<br>RAW: `ac(_;15;15); res-fire(_;25;25)` | **2 distinct pieces**: +8 Attack Rating per clvl (floor after scaling)<br>RAW: `att/lvl(16;_;_)` | 2; 7; 5/2500 |
| Berserker's Hauberk | Splint Mail `spl` | 3; 5 | Magic Damage Reduced by 2; +1 to Barbarian Skill Levels<br>RAW: `red-mag(_;2;2); bar(_;1;1)` | **2 distinct pieces**: +3 Defense per clvl (floor after scaling)<br>RAW: `ac/lvl(24;_;_)` | 2; 7; 5/2500 |
| Berserker's Hatchet | Double Axe `2ax` | 3; 5 | 30% Bonus to Attack Rating; 5% Mana Stolen per Hit<br>RAW: `att%(_;30;30); manasteal(_;5;5)` | **2 distinct pieces**: 50% Enhanced Damage<br>RAW: `dmg%(_;50;50)` | 2; 7; 5/2500 |

| Global threshold | Additional properties /raw |
| --- | --- |
| 2 distinct pieces | +50 to Life<br>RAW: `hp(_;50;50)` |
| All 3 distinct pieces; add to earlier thresholds | Poison Length Reduced by 75%; +16 pois-min (rate units1/256damage/frame); +32 pois-max (rate units1/256damage/frame); (poison length 75 frames); +75 Defense<br>RAW: `res-pois-len(0;75;75); pois-min(0;16;16); pois-max(0;32;32); pois-len(0;75;75); ac(_;75;75)` |

### G. Death's Disguise (3 pieces)

| Piece /source key | Base /code | Req lvl; definition lvl | Baseline properties /raw | Per-piece conditional properties /raw | add func; rarity; price mult/add |
| --- | --- | --- | --- | --- | --- |
| Death's Hand | Leather Gloves `lgl` | 6; 8 | Poison Resist +50%; Poison Length Reduced by 75%<br>RAW: `res-pois(_;50;50); res-pois-len(_;75;75)` | **2 distinct pieces**: +30% Increased Attack Speed<br>RAW: `swing3(_;30;30)` | 2; 7; 5/2500 |
| Death's Guard | Sash `lbl` | 6; 8 | +20 Defense; Cannot Be Frozen<br>RAW: `ac(_;20;20); nofreeze(_;1;1)` | **2 distinct pieces**: All Resistances +15<br>RAW: `res-all(_;15;15)` | 2; 7; 5/2500 |
| Death's Touch | War Sword `wsd` | 6; 8 | 25% Enhanced Damage; 4% Life Stolen per Hit<br>RAW: `dmg%(_;25;25); lifesteal(_;4;4)` | **2 distinct pieces**: Adds 25-75 Cold Damage (3s chill)<br>RAW: `dmg-cold(75;25;75)` | 2; 7; 5/2500 |

| Global threshold | Additional properties /raw |
| --- | --- |
| 2 distinct pieces | 8% Life Stolen per Hit<br>RAW: `lifesteal(_;8;8)` |
| All 3 distinct pieces; add to earlier thresholds | 40% Bonus to Attack Rating; +10 to Minimum Damage; All Resistances +25<br>RAW: `att%(0;40;40); dmg-min(0;10;10); res-all(0;25;25)` |

### G. Angelic Raiment (4 pieces)

Internal set key: `Angelical Raiment`.

| Piece /source key | Base /code | Req lvl; definition lvl | Baseline properties /raw | Per-piece conditional properties /raw | add func; rarity; price mult/add |
| --- | --- | --- | --- | --- | --- |
| Angelic Sickle | Sabre `sbr` | 12; 17 | +75 to Attack Rating; +250% Damage to Undead<br>RAW: `att(_;75;75); dmg-undead(_;250;250)` | **2 distinct pieces**: 75% Enhanced Damage<br>RAW: `dmg%(_;75;75)`<br>**3 distinct pieces**: +30% Increased Attack Speed<br>RAW: `swing3(_;30;30)` | 2; 7; 5/2500 |
| Angelic Mantle | Ring Mail `rng` | 12; 17 | Damage Reduced by 3; 40% Enhanced Defense<br>RAW: `red-dmg(_;3;3); ac%(_;40;40)` | **2 distinct pieces**: +150 Defense<br>RAW: `ac(_;150;150)`<br>**3 distinct pieces**: Fire Resist +50%<br>RAW: `res-fire(_;50;50)` | 2; 7; 5/2500 |
| Angelic Halo | ring `rin` | 12; 17 | Replenish Life +6; +20 to Life<br>RAW: `regen(_;6;6); hp(_;20;20)` | **2 distinct pieces**: +12 Attack Rating per clvl (floor after scaling)<br>RAW: `att/lvl(24;_;_)`<br>**3 distinct pieces**: 50% Better Chance of Getting Magic Items<br>RAW: `mag%(_;50;50)` | 2; 3; 5/2500 |
| Angelic Wings | amulet `amu` | 12; 17 | +3 to Light Radius; 20% Damage Taken Goes To Mana<br>RAW: `light(_;3;3); dmg-to-mana(_;20;20)` | **2 distinct pieces**: +75 to Life<br>RAW: `hp(_;75;75)`<br>**3 distinct pieces**: +1 to All Skills<br>RAW: `allskills(_;1;1)` | 2; 7; 5/2500 |

| Global threshold | Additional properties /raw |
| --- | --- |
| 2 distinct pieces | +10 to Dexterity<br>RAW: `dex(_;10;10)` |
| 3 distinct pieces | +50 to Mana<br>RAW: `mana(_;50;50)` |
| All 4 distinct pieces; add to earlier thresholds | All Resistances +25; Half Freeze Duration; 40% Better Chance of Getting Magic Items; Regenerate Mana 8%<br>RAW: `res-all(0;25;25); half-freeze(0;1;1); mag%(0;40;40); regen-mana(_;8;8)` |

### G. Arctic Gear (4 pieces)

| Piece /source key | Base /code | Req lvl; definition lvl | Baseline properties /raw | Per-piece conditional properties /raw | add func; rarity; price mult/add |
| --- | --- | --- | --- | --- | --- |
| Arctic Horn | Short War Bow `swb` | 2; 3 | 20% Bonus to Attack Rating; 50% Enhanced Damage<br>RAW: `att%(_;20;20); dmg%(_;50;50)` | **2 distinct pieces**: +8 Attack Rating per clvl (floor after scaling)<br>RAW: `att/lvl(16;_;_)`<br>**3 distinct pieces**: Adds 20-30 Cold Damage (3s chill)<br>RAW: `dmg-cold(75;20;30)` | 2; 7; 5/2500 |
| Arctic Furs | Quilted Armor `qui` | 2; 3 | 275-325% Enhanced Defense; All Resistances +10<br>RAW: `ac%(_;275;325); res-all(_;10;10)` | **2 distinct pieces**: +3 Defense per clvl (floor after scaling)<br>RAW: `ac/lvl(24;_;_)`<br>**3 distinct pieces**: Cold Resist +15%<br>RAW: `res-cold(_;15;15)` | 2; 7; 5/2500 |
| Arctic Binding | Light Belt `vbl` | 2; 3 | Cold Resist +40%; +30 Defense<br>RAW: `res-cold(_;40;40); ac(_;30;30)` | **2 distinct pieces**: 40% Better Chance of Getting Magic Items<br>RAW: `mag%(_;40;40)`<br>**3 distinct pieces**: Cold Resist +10%<br>RAW: `res-cold(_;10;10)` | 2; 7; 5/2500 |
| Arctic Mitts | Light Gauntlets `tgl` | 2; 3 | +20 to Life; +10% Increased Attack Speed<br>RAW: `hp(_;20;20); swing1(_;10;10)` | **2 distinct pieces**: +50 to Attack Rating<br>RAW: `att(_;50;50)`<br>**3 distinct pieces**: +10 to Dexterity<br>RAW: `dex(_;10;10)` | 2; 7; 5/2500 |

| Global threshold | Additional properties /raw |
| --- | --- |
| 2 distinct pieces | +5 to Strength<br>RAW: `str(_;5;5)` |
| 3 distinct pieces | +50 to Life<br>RAW: `hp(_;50;50)` |
| All 4 distinct pieces; add to earlier thresholds | +6 min cold dmg; +14 max cold dmg; (cold length 100 frames); Cannot Be Frozen<br>RAW: `cold-min(0;6;6); cold-max(0;14;14); cold-len(0;100;100); nofreeze(0;1;1)` |

### G. Arcanna's Tricks (4 pieces)

| Piece /source key | Base /code | Req lvl; definition lvl | Baseline properties /raw | Per-piece conditional properties /raw | add func; rarity; price mult/add |
| --- | --- | --- | --- | --- | --- |
| Arcanna's Sign | amulet `amu` | 15; 20 | +15 to Mana; Regenerate Mana 20%<br>RAW: `mana(_;15;15); regen-mana(_;20;20)` | **2 distinct pieces**: 50% Better Chance of Getting Magic Items<br>RAW: `mag%(_;50;50)`<br>**3 distinct pieces**: Fire Resist +20%<br>RAW: `res-fire(_;20;20)` | 2; 1; 5/2500 |
| Arcanna's Deathwand | War Staff `wst` | 15; 20 | +1 to Sorceress Skill Levels; 25% Deadly Strike<br>RAW: `sor(_;1;1); deadly(_;25;25)` | **2 distinct pieces**: +50 to Mana<br>RAW: `mana(_;50;50)`<br>**3 distinct pieces**: Regenerate Mana 5%<br>RAW: `regen-mana(_;5;5)` | 2; 7; 5/2500 |
| Arcanna's Head | Skull Cap `skp` | 15; 20 | Replenish Life +4; Attacker Takes Damage of 2<br>RAW: `regen(_;4;4); thorns(_;2;2)` | **2 distinct pieces**: +3 Defense per clvl (floor after scaling)<br>RAW: `ac/lvl(24;_;_)`<br>**3 distinct pieces**: Lightning Resist +15%<br>RAW: `res-ltng(_;15;15)` | 2; 7; 5/2500 |
| Arcanna's Flesh | Light Plate `ltp` | 15; 20 | +2 to Light Radius; Damage Reduced by 3<br>RAW: `light(_;2;2); red-dmg(_;3;3)` | **2 distinct pieces**: +100 Defense<br>RAW: `ac(_;100;100)`<br>**3 distinct pieces**: +10 to Energy<br>RAW: `enr(_;10;10)` | 2; 7; 5/2500 |

| Global threshold | Additional properties /raw |
| --- | --- |
| 2 distinct pieces | +25 to Mana<br>RAW: `mana(_;25;25)` |
| 3 distinct pieces | +50 to Life<br>RAW: `hp(_;50;50)` |
| All 4 distinct pieces; add to earlier thresholds | +20% Faster Cast Rate; 5% Mana Stolen per Hit; +25 to Mana<br>RAW: `cast3(0;20;20); manasteal(0;5;5); mana(0;25;25)` |

### G. Natalya's Odium (4 pieces)

| Piece /source key | Base /code | Req lvl; definition lvl | Baseline properties /raw | Per-piece conditional properties /raw | add func; rarity; price mult/add |
| --- | --- | --- | --- | --- | --- |
| Natalya's Totem | Grim Helm `xh9` | 59; 22 | +135-175 Defense; +20-30 to Dexterity; +10-20 to Strength; All Resistances +10-20; Magic Damage Reduced by 3<br>RAW: `ac(_;135;175); dex(_;20;30); str(_;10;20); res-all(_;10;20); red-mag(_;3;3)` | — | 0; 7; 5/5000 |
| Natalya's Mark | Scissors Suwayyah `7qr` | 79; 22 | +40% Increased Attack Speed; 200% Enhanced Damage; Ignore Target's Defense; Adds 50-50 Cold Damage (4s chill); Adds 12-17 Fire Damage; +200% Damage to Undead; +200% Damage to Demons<br>RAW: `swing3(_;40;40); dmg%(_;200;200); ignore-ac(_;1;1); dmg-cold(100;50;50); dmg-fire(_;12;17); dmg-undead(_;200;200); dmg-demon(_;200;200)` | — | 0; 7; 5/5000 |
| Natalya's Shadow | Loricated Mail `ucl` | 73; 22 | +150-225 Defense; +1 Life per clvl (floor after scaling); +2 to Shadow Disciplines (Assassin) Skills; Poison Length Reduced by 75%; Poison Resist +25%; Socketed (1-3)<br>RAW: `ac(_;150;225); hp/lvl(8;_;_); skilltab(19;2;2); res-pois-len(_;75;75); res-pois(_;25;25); sock(_;1;3)` | — | 0; 7; 5/5000 |
| Natalya's Soul | Mesh Boots `xmb` | 25; 22 | +75-125 Defense; +40% Faster Run/Walk; +0.25 % Heal Stamina per clvl (floor after scaling); +50 Maximum Durability; Cold Resist +15-25%; Lightning Resist +15-25%<br>RAW: `ac(_;75;125); move3(_;40;40); regen-stam/lvl(2;_;_); dur(_;50;50); res-cold(_;15;25); res-ltng(_;15;25)` | — | 0; 7; 5/5000 |

| Global threshold | Additional properties /raw |
| --- | --- |
| 2 distinct pieces | Magic Damage Reduced by 15<br>RAW: `red-mag(_;15;15)` |
| 3 distinct pieces | +200 Defense<br>RAW: `ac(_;200;200)` |
| 4 distinct pieces | Poison Resist +20%<br>RAW: `res-pois(_;20;20)` |
| All 4 distinct pieces; add to earlier thresholds | All Resistances +50; +3 to Assassin Skill Levels; +150 Defense; 14% Life Stolen per Hit; 14% Mana Stolen per Hit; Damage Reduced by 30%; (fade state)<br>RAW: `res-all(_;50;50); ass(_;3;3); ac(_;150;150); lifesteal(_;14;14); manasteal(_;14;14); red-dmg%(_;30;30); fade(_;1;1)` |

### G. Aldur's Watchtower (4 pieces)

| Piece /source key | Base /code | Req lvl; definition lvl | Baseline properties /raw | Per-piece conditional properties /raw | add func; rarity; price mult/add |
| --- | --- | --- | --- | --- | --- |
| Aldur's Stony Gaze | Hunter's Guise `dr8` | 36; 29 | +90 Defense; Regenerate Mana 17%; +5 to Light Radius; +25% Faster Hit Recovery; Cold Resist +40-50%; Socketed (2)<br>RAW: `ac(_;90;90); regen-mana(_;17;17); light(_;5;5); balance3(_;25;25); res-cold(_;40;50); sock(_;2;2)` | **2 distinct pieces**: +15 to Energy<br>RAW: `enr(_;15;15)`<br>**3 distinct pieces**: +15 to Energy<br>RAW: `enr(_;15;15)`<br>**4 distinct pieces**: +15 to Energy<br>RAW: `enr(_;15;15)` | 2; 7; 5/5000 |
| Aldur's Deception | Shadow Plate `uul` | 76; 29 | +300 Defense; +1 to Shape Shifting (Druid) Skills; +20 to Strength; +15 to Dexterity; Lightning Resist +40-50%; Requirements -50%; +1 to Elemental (Druid) Skills<br>RAW: `ac(_;300;300); skilltab(16;1;1); str(_;20;20); dex(_;15;15); res-ltng(_;40;50); ease(_;-50;-50); skilltab(17;1;1)` | **2 distinct pieces**: +15 to Vitality<br>RAW: `vit(_;15;15)`<br>**3 distinct pieces**: +15 to Vitality<br>RAW: `vit(_;15;15)`<br>**4 distinct pieces**: +15 to Vitality<br>RAW: `vit(_;15;15)` | 2; 7; 5/5000 |
| Aldur's Rhythm [source: Aldur's Gauntlet] | Jagged Star `9mt` | 42; 29 | Adds 40–62 Physical Damage (paired endpoints); Adds 50-75 Lightning Damage; 10% Life Stolen per Hit; +30% Increased Attack Speed; +200% Damage to Demons; 5% Mana Stolen per Hit; Socketed (2-5)<br>RAW: `dmg-norm(_;40;62); dmg-ltng(_;50;75); lifesteal(_;10;10); swing3(_;30;30); dmg-demon(_;200;200); manasteal(_;5;5); sock(_;2;5)` | **2 distinct pieces**: +15 to Strength<br>RAW: `str(_;15;15)`<br>**3 distinct pieces**: +15 to Strength<br>RAW: `str(_;15;15)`<br>**4 distinct pieces**: +15 to Strength<br>RAW: `str(_;15;15)` | 2; 7; 5/5000 |
| Aldur's Advance | Battle Boots `xtb` | 45; 29 | Indestructible; Heal Stamina Plus 32%; +50 to Life; 10% Damage Taken Goes To Mana; +40% Faster Run/Walk; +180 Maximum Stamina; Fire Resist +40-50%<br>RAW: `indestruct(_;1;1); regen-stam(_;32;32); hp(_;50;50); dmg-to-mana(_;10;10); move3(_;40;40); stam(_;180;180); res-fire(_;40;50)` | **2 distinct pieces**: +15 to Dexterity<br>RAW: `dex(_;15;15)`<br>**3 distinct pieces**: +15 to Dexterity<br>RAW: `dex(_;15;15)`<br>**4 distinct pieces**: +15 to Dexterity<br>RAW: `dex(_;15;15)` | 2; 7; 5/5000 |

| Global threshold | Additional properties /raw |
| --- | --- |
| 2 distinct pieces | 150% Bonus to Attack Rating<br>RAW: `att%(_;150;150)` |
| 3 distinct pieces | 50% Better Chance of Getting Magic Items<br>RAW: `mag%(_;50;50)` |
| 4 distinct pieces | 10% Life Stolen per Hit<br>RAW: `lifesteal(_;10;10)` |
| All 4 distinct pieces; add to earlier thresholds | All Resistances +50; +3 to Druid Skill Levels; +150 Defense; 10% Mana Stolen per Hit; +150 to Mana; 350% Enhanced Damage; (visual state fullsetgeneric)<br>RAW: `res-all(_;50;50); dru(_;3;3); ac(_;150;150); manasteal(_;10;10); mana(_;150;150); dmg%(_;350;350); state(fullsetgeneric;1;1)` |

### G. Immortal King (6 pieces)

| Piece /source key | Base /code | Req lvl; definition lvl | Baseline properties /raw | Per-piece conditional properties /raw | add func; rarity; price mult/add |
| --- | --- | --- | --- | --- | --- |
| Immortal King's Will | Avenger Guard `ba5` | 47; 37 | +125 Defense; 37% Extra Gold from Monsters; +2 to Warcries (Barbarian) Skills; +4 to Light Radius; 25-40% Better Chance of Getting Magic Items; Socketed (2)<br>RAW: `ac(_;125;125); gold%(_;37;37); skilltab(14;2;2); light(_;4;4); mag%(_;25;40); sock(_;2;2)` | — | 0; 7; 5/5000 |
| Immortal King's Soul Cage | Sacred Armor `uar` | 76; 37 | +400 Defense; 5% Chance to cast level 5 Enchant when struck; +2 to Combat (Barbarian) Skills; Poison Resist +50%<br>RAW: `ac(_;400;400); gethit-skill(52;5;5); skilltab(12;2;2); res-pois(_;50;50)` | **2 distinct pieces**: +25% Faster Hit Recovery<br>RAW: `balance2(_;25;25)`<br>**3 distinct pieces**: Cold Resist +40%<br>RAW: `res-cold(_;40;40)`<br>**4 distinct pieces**: Fire Resist +40%<br>RAW: `res-fire(_;40;40)`<br>**5 distinct pieces**: Lightning Resist +40%<br>RAW: `res-ltng(_;40;40)`<br>**6 distinct pieces**: 50% Enhanced Defense<br>RAW: `ac%(_;50;50)` | 2; 7; 5/5000 |
| Immortal King's Detail | War Belt `zhb` | 29; 37 | +36 Defense; Fire Resist +28%; Lightning Resist +31%; +25 to Strength<br>RAW: `ac(_;36;36); res-fire(_;28;28); res-ltng(_;31;31); str(_;25;25)` | **2 distinct pieces**: +105 Defense<br>RAW: `ac(_;105;105)`<br>**3 distinct pieces**: +25% Faster Hit Recovery<br>RAW: `balance2(_;25;25)`<br>**4 distinct pieces**: 100% Enhanced Defense<br>RAW: `ac%(_;100;100)`<br>**5 distinct pieces**: Damage Reduced by 20%<br>RAW: `red-dmg%(_;20;20)`<br>**6 distinct pieces**: +2 to Masteries (Barbarian) Skills<br>RAW: `skilltab(13;2;2)` | 2; 7; 5/5000 |
| Immortal King's Forge | War Gauntlets `xhg` | 30; 37 | +65 Defense; +20 to Strength; +20 to Dexterity; 12% Chance to cast level 4 Charged Bolt when struck<br>RAW: `ac(_;65;65); str(_;20;20); dex(_;20;20); gethit-skill(38;12;4)` | **2 distinct pieces**: +25% Increased Attack Speed<br>RAW: `swing2(_;25;25)`<br>**3 distinct pieces**: +120 Defense<br>RAW: `ac(_;120;120)`<br>**4 distinct pieces**: 10% Life Stolen per Hit<br>RAW: `lifesteal(_;10;10)`<br>**5 distinct pieces**: 10% Mana Stolen per Hit<br>RAW: `manasteal(_;10;10)`<br>**6 distinct pieces**: Freezes Target +2<br>RAW: `freeze(_;2;2)` | 2; 7; 5/5000 |
| Immortal King's Pillar | War Boots `xhb` | 31; 37 | +75 Defense; +40% Faster Run/Walk; +110 to Attack Rating; +44 to Life<br>RAW: `ac(_;75;75); move3(_;40;40); att(_;110;110); hp(_;44;44)` | **2 distinct pieces**: 25% Better Chance of Getting Magic Items<br>RAW: `mag%(_;25;25)`<br>**3 distinct pieces**: +2 to Combat (Barbarian) Skills<br>RAW: `skilltab(12;2;2)`<br>**4 distinct pieces**: +160 Defense<br>RAW: `ac(_;160;160)`<br>**5 distinct pieces**: Half Freeze Duration<br>RAW: `half-freeze(_;1;1)` | 2; 7; 5/5000 |
| Immortal King's Stone Crusher | Ogre Maul `7m7` | 76; 37 | Indestructible; +40% Increased Attack Speed; +200% Damage to Demons; +200% Damage to Undead; 35-40% Chance of Crushing Blow; 200% Enhanced Damage; Socketed (2)<br>RAW: `indestruct(_;1;1); swing3(_;40;40); dmg-demon(_;200;200); dmg-undead(_;200;200); crush(_;35;40); dmg%(_;200;200); sock(_;2;2)` | **2 distinct pieces**: Adds 211-397 Fire Damage<br>RAW: `dmg-fire(_;211;397)`<br>**3 distinct pieces**: Adds 7-477 Lightning Damage<br>RAW: `dmg-ltng(_;7;477)`<br>**4 distinct pieces**: Adds 127-364 Cold Damage (6s chill)<br>RAW: `dmg-cold(150;127;364)`<br>**5 distinct pieces**: Approx. 204.492 Poison Damage over 6s; authoritative rate 349–349/256 per frame<br>RAW: `dmg-pois(150;349;349)`<br>**6 distinct pieces**: Adds 250-361 Magic Damage<br>RAW: `dmg-mag(_;250;361)` | 2; 7; 5/5000 |

| Global threshold | Additional properties /raw |
| --- | --- |
| 2 distinct pieces | +50 to Attack Rating<br>RAW: `att(_;50;50)` |
| 3 distinct pieces | +75 to Attack Rating<br>RAW: `att(_;75;75)` |
| 4 distinct pieces | +125 to Attack Rating<br>RAW: `att(_;125;125)` |
| 5 distinct pieces | +200 to Attack Rating<br>RAW: `att(_;200;200)` |
| All 6 distinct pieces; add to earlier thresholds | All Resistances +50; +3 to Barbarian Skill Levels; +150 to Life; Magic Damage Reduced by 10; (visual state fullsetgeneric)<br>RAW: `res-all(_;50;50); bar(_;3;3); hp(_;150;150); red-mag(_;10;10); state(fullsetgeneric;1;1)` |

### G. Tal Rasha's Wrappings (5 pieces)

| Piece /source key | Base /code | Req lvl; definition lvl | Baseline properties /raw | Per-piece conditional properties /raw | add func; rarity; price mult/add |
| --- | --- | --- | --- | --- | --- |
| Tal Rasha's Fine-Spun Cloth [source: Tal Rasha's Fire-Spun Cloth] | Mesh Belt `zmb` | 53; 26 | Requirements -20%; +30 to Mana; +20 to Dexterity; 37% Damage Taken Goes To Mana; 10-15% Better Chance of Getting Magic Items<br>RAW: `ease(_;-20;-20); mana(_;30;30); dex(_;20;20); dmg-to-mana(_;37;37); mag%(_;10;15)` | **2 distinct pieces**: +60 Defense<br>RAW: `ac(_;60;60)`<br>**3 distinct pieces**: +10% Faster Cast Rate<br>RAW: `cast2(_;10;10)` | 2; 7; 5/5000 |
| Tal Rasha's Adjudication | amulet `amu` | 67; 26 | Lightning Resist +33%; +2 to Sorceress Skill Levels; +50 to Life; Adds 3-32 Lightning Damage; +42 to Mana<br>RAW: `res-ltng(_;33;33); sor(_;2;2); hp(_;50;50); dmg-ltng(_;3;32); mana(_;42;42)` | **4 distinct pieces**: +10% Faster Cast Rate<br>RAW: `cast2(_;10;10)` | 2; 1; 5/5000 |
| Tal Rasha's Lidless Eye | Swirling Crystal `oba` | 65; 26 | +57 to Life; +77 to Mana; +10 to Energy; +20% Faster Cast Rate; +1-2 to Fire Mastery (native class only); +1-2 to Lightning Mastery (native class only); +1-2 to Cold Mastery (native class only)<br>RAW: `hp(_;57;57); mana(_;77;77); enr(_;10;10); cast3(_;20;20); skill(Fire Mastery;1;2); skill(Lightning Mastery;1;2); skill(Cold Mastery;1;2)` | **2 distinct pieces**: +1 to Sorceress Skill Levels<br>RAW: `sor(_;1;1)`<br>**3 distinct pieces**: -15% to Enemy Fire Resistance<br>RAW: `pierce-fire(_;15;15)`<br>**4 distinct pieces**: -15% to Enemy Lightning Resistance<br>RAW: `pierce-ltng(_;15;15)`<br>**5 distinct pieces**: +15% to Cold Skill Damage<br>RAW: `extra-cold(_;15;15)` | 2; 7; 5/5000 |
| Tal Rasha's Guardianship [source: Tal Rasha's Howling Wind] | Lacquered Plate `uth` | 71; 26 | Requirements -60%; Magic Damage Reduced by 15; 88% Better Chance of Getting Magic Items; Cold Resist +40%; Fire Resist +40%; Lightning Resist +40%; +400 Defense<br>RAW: `ease(_;-60;-60); red-mag(_;15;15); mag%(_;88;88); res-cold(_;40;40); res-fire(_;40;40); res-ltng(_;40;40); ac(_;400;400)` | **2 distinct pieces**: +10% Faster Cast Rate<br>RAW: `cast2(_;10;10)` | 2; 7; 5/5000 |
| Tal Rasha's Horadric Crest | Death Mask `xsk` | 66; 26 | +30 to Mana; +60 to Life; +45 Defense; All Resistances +15; 10% Life Stolen per Hit; 10% Mana Stolen per Hit<br>RAW: `mana(_;30;30); hp(_;60;60); ac(_;45;45); res-all(_;15;15); lifesteal(_;10;10); manasteal(_;10;10)` | — | 0; 7; 5/5000 |

| Global threshold | Additional properties /raw |
| --- | --- |
| 2 distinct pieces | Replenish Life +10<br>RAW: `regen(_;10;10)` |
| 3 distinct pieces | 65% Better Chance of Getting Magic Items<br>RAW: `mag%(_;65;65)` |
| 4 distinct pieces | +25% Faster Hit Recovery<br>RAW: `balance2(_;25;25)` |
| All 5 distinct pieces; add to earlier thresholds | All Resistances +50; +3 to Sorceress Skill Levels; +150 Defense; +150 to Life; +50 Defense vs. Missile; (visual state fullsetgeneric)<br>RAW: `res-all(_;50;50); sor(_;3;3); ac(_;150;150); hp(_;150;150); ac-miss(_;50;50); state(fullsetgeneric;1;1)` |

### G. Griswold's Legacy (4 pieces)

| Piece /source key | Base /code | Req lvl; definition lvl | Baseline properties /raw | Per-piece conditional properties /raw | add func; rarity; price mult/add |
| --- | --- | --- | --- | --- | --- |
| Griswold's Valor | Corona `urn` | 69; 44 | 50-75% Enhanced Defense; +0.25 Cold Absorb per clvl (floor after scaling); Socketed (2); Requirements -40%; 20-30% Better Chance of Getting Magic Items; All Resistances +5<br>RAW: `ac%(_;50;75); abs-cold/lvl(_;2;2); sock(_;2;2); ease(_;-40;-40); mag%(_;20;30); res-all(_;5;5)` | **2 distinct pieces**: +2 to Offensive Auras (Paladin) Skills<br>RAW: `skilltab(10;2;2)` | 2; 7; 5/5000 |
| Griswold's Heart | Ornate Armor `xar` | 45; 44 | +500 Defense; +2 to Defensive Auras (Paladin) Skills; Socketed (3); +20 to Strength; Requirements -40%<br>RAW: `ac(_;500;500); skilltab(11;2;2); sock(_;3;3); str(_;20;20); ease(_;-40;-40)` | — | 0; 7; 5/5000 |
| Griswold's Redemption [source: Griswolds's Redemption] | Caduceus `7ws` | 53; 44 | 200-240% Enhanced Damage; +40% Increased Attack Speed; +200% Damage to Undead; Requirements -20%; Socketed (3-4)<br>RAW: `dmg%(_;200;240); swing2(_;40;40); dmg-undead(_;200;200); ease(_;-20;-20); sock(_;3;4)` | **2 distinct pieces**: +2 to Combat (Paladin) Skills<br>RAW: `skilltab(9;2;2)`<br>**3 distinct pieces**: Adds 10–20 Physical Damage (paired endpoints)<br>RAW: `dmg-norm(_;10;20)`<br>**4 distinct pieces**: Adds 10–20 Physical Damage (paired endpoints)<br>RAW: `dmg-norm(_;10;20)` | 2; 7; 5/5000 |
| Griswold's Honor | Vortex Shield `paf` | 68; 44 | +108 Defense; Socketed (3); +65% Faster Block Rate; 20% Increased Chance of Blocking; All Resistances +45<br>RAW: `ac(_;108;108); sock(3;_;_); block2(_;65;65); block(_;20;20); res-all(_;45;45)` | — | 0; 7; 5/5000 |

| Global threshold | Additional properties /raw |
| --- | --- |
| 2 distinct pieces | +20 to Strength<br>RAW: `str(_;20;20)` |
| 3 distinct pieces | +30 to Dexterity<br>RAW: `dex(_;30;30)` |
| All 4 distinct pieces; add to earlier thresholds | All Resistances +50; +3 to Paladin Skill Levels; +200 to Attack Rating; +150 to Life; (visual state fullsetgeneric); +30% Faster Hit Recovery<br>RAW: `res-all(_;50;50); pal(_;3;3); att(_;200;200); hp(_;150;150); state(fullsetgeneric;1;1); balance2(_;30;30)` |

### G. Trang-Oul's Avatar (5 pieces)

| Piece /source key | Base /code | Req lvl; definition lvl | Baseline properties /raw | Per-piece conditional properties /raw | add func; rarity; price mult/add |
| --- | --- | --- | --- | --- | --- |
| Trang-Oul's Guise | Bone Visage `uh9` | 65; 32 | +80-100 Defense; +25% Faster Hit Recovery; Attacker Takes Damage of 20; +150 to Mana; Replenish Life +5<br>RAW: `ac(_;80;100); balance2(_;25;25); thorns(_;20;20); mana(_;150;150); regen(_;5;5)` | — | 0; 7; 5/5000 |
| Trang-Oul's Scales | Chaos Armor `xul` | 49; 32 | Requirements -40%; +100 Defense vs. Missile; Poison Resist +40%; +2 to Summoning (Necromancer) Skills; +40% Faster Run/Walk; 150% Enhanced Defense<br>RAW: `ease(_;-40;-40); ac-miss(_;100;100); res-pois(_;40;40); skilltab(8;2;2); move3(_;40;40); ac%(_;150;150)` | **3 distinct pieces**: Lightning Resist +50%<br>RAW: `res-ltng(_;50;50)`<br>**5 distinct pieces**: Damage Reduced by 25%<br>RAW: `red-dmg%(_;25;25)` | 2; 7; 5/5000 |
| Trang-Oul's Wing | Cantor Trophy `ne9` | 54; 32 | +125 Defense; +25 to Strength; +15 to Dexterity; Fire Resist +38-45%; 30% Increased Chance of Blocking; Poison Resist +40%; +2 to Poison and Bone (Necromancer) Skills<br>RAW: `ac(_;125;125); str(_;25;25); dex(_;15;15); res-fire(_;38;45); block(_;30;30); res-pois(_;40;40); skilltab(7;2;2)` | **3 distinct pieces**: -25% to Enemy Poison Resistance<br>RAW: `pierce-pois(_;25;25)`<br>**4 distinct pieces**: Replenish Life +15<br>RAW: `regen(_;15;15)` | 2; 7; 5/5000 |
| Trang-Oul's Claws | Heavy Bracers `xmg` | 45; 32 | +30 Defense; +20% Faster Cast Rate; Cold Resist +30%; +2 to Curses (Necromancer) Skills; +25% to Poison Skill Damage<br>RAW: `ac(_;30;30); cast3(_;20;20); res-cold(_;30;30); skilltab(6;2;2); extra-pois(_;25;25)` | — | 0; 7; 5/5000 |
| Trang-Oul's Girth | Troll Belt `utc` | 47; 32 | +75-100 Defense; +30 Maximum Stamina; Replenish Life +5; +66 to Life; Cannot Be Frozen; Requirements -40%; +25-50 to Mana<br>RAW: `ac(_;75;100); stam(_;30;30); regen(_;5;5); hp(_;66;66); nofreeze(_;1;1); ease(_;-40;-40); mana(_;25;50)` | **3 distinct pieces**: Cold Resist +40%<br>RAW: `res-cold(_;40;40)` | 2; 7; 5/5000 |

| Global threshold | Additional properties /raw |
| --- | --- |
| 2 distinct pieces | Regenerate Mana 15%; +18 to Fire Ball (oskill)<br>RAW: `regen-mana(_;15;15); oskill(Fire Ball;18;18)` |
| 3 distinct pieces | Regenerate Mana 15%; +13 to Fire Wall (oskill)<br>RAW: `regen-mana(_;15;15); oskill(Fire Wall;13;13)` |
| 4 distinct pieces | Regenerate Mana 15%; +10 to Meteor (oskill)<br>RAW: `regen-mana(_;15;15); oskill(Meteor;10;10)` |
| All 5 distinct pieces; add to earlier thresholds | All Resistances +50; +3 to Necromancer Skill Levels; +100 to Mana; +200 Defense; (visual state monsterset); Regenerate Mana 15%; +3 to Fire Mastery (oskill); 20% Life Stolen per Hit<br>RAW: `res-all(_;50;50); nec(_;3;3); mana(_;100;100); ac(_;200;200); state(monsterset;1;1); regen-mana(_;15;15); oskill(Fire Mastery;3;3); lifesteal(_;20;20)` |

### G. M'avina's Battle Hymn (5 pieces)

| Piece /source key | Base /code | Req lvl; definition lvl | Baseline properties /raw | Per-piece conditional properties /raw | add func; rarity; price mult/add |
| --- | --- | --- | --- | --- | --- |
| M'avina's True Sight | Diadem `ci3` | 59; 21 | +150 Defense; Replenish Life +10; +30% Increased Attack Speed; +25 to Mana<br>RAW: `ac(_;150;150); regen(_;10;10); swing2(_;30;30); mana(_;25;25)` | **2 distinct pieces**: +1 to All Skills<br>RAW: `allskills(_;1;1)`<br>**3 distinct pieces**: 50% Bonus to Attack Rating<br>RAW: `att%(_;50;50)`<br>**4 distinct pieces**: All Resistances +25<br>RAW: `res-all(_;25;25)` | 2; 7; 5/5000 |
| M'avina's Embrace | Kraken Shell `uld` | 70; 21 | 10% Chance to cast level 3 Glacial Spike when struck; Requirements -30%; Magic Damage Reduced by 5-12; +2 to Passive and Magic (Amazon) Skills; +4 Defense per clvl (floor after scaling); +350 Defense<br>RAW: `gethit-skill(55;10;3); ease(_;-30;-30); red-mag(_;5;12); skilltab(1;2;2); ac/lvl(32;_;_); ac(_;350;350)` | **3 distinct pieces**: +30% Faster Hit Recovery<br>RAW: `balance2(_;30;30)` | 2; 7; 5/5000 |
| M'avina's Icy Clutch | Battle Gauntlets `xtg` | 32; 21 | +45-50 Defense; Adds 6-18 Cold Damage (6s chill); Half Freeze Duration; 56% Extra Gold from Monsters; +10 to Strength; +15 to Dexterity<br>RAW: `ac(_;45;50); dmg-cold(150;6;18); half-freeze(_;1;1); gold%(_;56;56); str(_;10;10); dex(_;15;15)` | **4 distinct pieces**: Adds 131-252 Cold Damage (4s chill)<br>RAW: `dmg-cold(100;131;252)`<br>**5 distinct pieces**: +20% to Cold Skill Damage<br>RAW: `extra-cold(_;20;20)` | 2; 7; 5/5000 |
| M'avina's Tenet | Sharkskin Belt `zvb` | 45; 21 | +50 Defense; +20% Faster Run/Walk; 5% Mana Stolen per Hit; +5 to Light Radius<br>RAW: `ac(_;50;50); move2(_;20;20); manasteal(_;5;5); light(_;5;5)` | **4 distinct pieces**: All Resistances +25<br>RAW: `res-all(_;25;25)` | 2; 7; 5/5000 |
| M'avina's Caster | Grand Matron Bow `amc` | 70; 21 | 188% Enhanced Damage; +40% Increased Attack Speed; Fires Magic Arrows (level 1); +50 to Attack Rating<br>RAW: `dmg%(_;188;188); swing3(_;40;40); magicarrow(_;1;1); att(_;50;50)` | **2 distinct pieces**: Adds 114-377 Magic Damage<br>RAW: `dmg-mag(_;114;377)`<br>**3 distinct pieces**: 10% Chance to cast level 15 Nova on striking<br>RAW: `hit-skill(Nova;10;15)`<br>**4 distinct pieces**: +2 to Bow and Crossbow (Amazon) Skills<br>RAW: `skilltab(0;2;2)` | 2; 7; 5/5000 |

| Global threshold | Additional properties /raw |
| --- | --- |
| 2 distinct pieces | +20 to Strength<br>RAW: `str(_;20;20)` |
| 3 distinct pieces | +30 to Dexterity<br>RAW: `dex(_;30;30)` |
| All 5 distinct pieces; add to earlier thresholds | All Resistances +50; +3 to Amazon Skill Levels; +100 Defense; +100 to Attack Rating; 100% Better Chance of Getting Magic Items; (visual state fullsetgeneric)<br>RAW: `res-all(_;50;50); ama(_;3;3); ac(_;100;100); att(_;100;100); mag%(_;100;100); state(fullsetgeneric;1;1)` |

### G. The Disciple (5 pieces)

| Piece /source key | Base /code | Req lvl; definition lvl | Baseline properties /raw | Per-piece conditional properties /raw | add func; rarity; price mult/add |
| --- | --- | --- | --- | --- | --- |
| Telling of Beads | amulet `amu` | 30; 39 | Poison Resist +35-50%; +1 to All Skills; Cold Resist +18%; Attacker Takes Damage of 8-10<br>RAW: `res-pois(_;35;50); allskills(_;1;1); res-cold(_;18;18); thorns(_;8;10)` | — | 0; 1; 5/5000 |
| Laying of Hands | Bramble Mitts `ulg` | 63; 39 | +25 Defense; +20% Increased Attack Speed; Fire Resist +50%; +350% Damage to Demons; 10% Chance to cast level 3 Holy Bolt on striking<br>RAW: `ac(_;25;25); swing2(_;20;20); res-fire(_;50;50); dmg-demon(_;350;350); hit-skill(101;10;3)` | — | 0; 7; 5/5000 |
| Rite of Passage | Demonhide Boots `xlb` | 29; 39 | +25 Defense; +30% Faster Run/Walk; Half Freeze Duration; +15-25 Maximum Stamina<br>RAW: `ac(_;25;25); move3(_;30;30); half-freeze(_;1;1); stam(_;15;25)` | — | 0; 7; 5/5000 |
| Dark Adherent [source: Spiritual Custodian] | Dusk Shroud `uui` | 43; 39 | +305-415 Defense; Fire Resist +24%; 25% Chance to cast level 3 Nova when struck; Approx. 24.4141–34.1797 Poison Damage over 2s; authoritative rate 125–175/256 per frame<br>RAW: `ac(_;305;415); res-fire(_;24;24); gethit-skill(48;25;3); dmg-pois(50;125;175)` | — | 0; 7; 5/5000 |
| Credendum | Mithril Coil `umc` | 65; 39 | +50 Defense; +10 to Strength; +10 to Dexterity; All Resistances +15<br>RAW: `ac(_;50;50); str(_;10;10); dex(_;10;10); res-all(_;15;15)` | — | 0; 7; 5/5000 |

| Global threshold | Additional properties /raw |
| --- | --- |
| 2 distinct pieces | +150 Defense<br>RAW: `ac(_;150;150)` |
| 3 distinct pieces | Approx. 21.9727 Poison Damage over 3s; authoritative rate 75–75/256 per frame<br>RAW: `dmg-pois(75;75;75)` |
| 4 distinct pieces | +10 to Strength<br>RAW: `str(_;10;10)` |
| 5 distinct pieces | +10 to Dexterity<br>RAW: `dex(_;10;10)` |
| All 5 distinct pieces; add to earlier thresholds | All Resistances +50; +2 to All Skills; +100 to Mana<br>RAW: `res-all(_;50;50); allskills(_;2;2); mana(_;100;100)` |

### G. Heaven's Brethren (4 pieces)

| Piece /source key | Base /code | Req lvl; definition lvl | Baseline properties /raw | Per-piece conditional properties /raw | add func; rarity; price mult/add |
| --- | --- | --- | --- | --- | --- |
| Dangoon's Teaching | Reinforced Mace `7ma` | 68; 55 | +1.5 Maximum Damage per clvl (floor after scaling); +40% Increased Attack Speed; 10% Chance to cast level 3 Frost Nova on striking; Adds 20-30 Fire Damage<br>RAW: `dmg/lvl(12;_;_); swing3(_;40;40); hit-skill(44;10;3); dmg-fire(_;20;30)` | — | 0; 7; 5/5000 |
| Taebaek's Glory [source: Heaven's Taebaek] | Ward `uts` | 81; 55 | +50 Defense; +100 to Mana; Lightning Resist +30%; Attacker Takes Damage of 30; Indestructible; 25% Increased Chance of Blocking; +30% Faster Block Rate<br>RAW: `ac(_;50;50); mana(_;100;100); res-ltng(_;30;30); thorns(_;30;30); indestruct(_;1;1); block(_;25;25); block3(_;30;30)` | — | 0; 7; 5/5000 |
| Haemosu's Adamant [source: Haemosu's Adament] | Cuirass `xrs` | 44; 55 | +500 Defense; +35 Defense vs. Missile; +75 to Life; +40 Defense vs. Melee; Requirements -20%<br>RAW: `ac(_;500;500); ac-miss(_;35;35); hp(_;75;75); ac-hth(_;40;40); ease(_;-20;-20)` | — | 0; 7; 5/5000 |
| Ondal's Almighty | Spired Helm `uhm` | 69; 55 | +50 Defense; Requirements -40%; 10% Chance to cast level 3 Weaken on striking; +10 to Strength; +15 to Dexterity; +24% Faster Hit Recovery<br>RAW: `ac(_;50;50); ease(_;-40;-40); hit-skill(72;10;3); str(_;10;10); dex(_;15;15); balance3(_;24;24)` | — | 0; 7; 5/5000 |

| Global threshold | Additional properties /raw |
| --- | --- |
| 2 distinct pieces | Heal Stamina Plus 50%<br>RAW: `regen-stam(_;50;50)` |
| 3 distinct pieces | Replenish Life +20<br>RAW: `regen(_;20;20)` |
| 4 distinct pieces | Adds 30-30 Fire Damage<br>RAW: `dmg-fire(_;30;30)` |
| All 4 distinct pieces; add to earlier thresholds | All Resistances +50; +2 to All Skills; Cannot Be Frozen; +5 to Light Radius<br>RAW: `res-all(_;50;50); allskills(_;2;2); nofreeze(_;1;1); light(_;5;5)` |

### G. Orphan's Call (4 pieces)

| Piece /source key | Base /code | Req lvl; definition lvl | Baseline properties /raw | Per-piece conditional properties /raw | add func; rarity; price mult/add |
| --- | --- | --- | --- | --- | --- |
| Guillaume's Face | Winged Helm `xhm` | 34; 41 | 120% Enhanced Defense; +30% Faster Hit Recovery; 35% Chance of Crushing Blow; 15% Deadly Strike; +15 to Strength<br>RAW: `ac%(_;120;120); balance3(_;30;30); crush(_;35;35); deadly(_;15;15); str(_;15;15)` | — | 0; 7; 5/5000 |
| Wilhelm's Pride | Battle Belt `ztb` | 42; 41 | 75% Enhanced Defense; 5% Mana Stolen per Hit; Cold Resist +10%; 5% Life Stolen per Hit<br>RAW: `ac%(_;75;75); manasteal(_;5;5); res-cold(_;10;10); lifesteal(_;5;5)` | — | 0; 7; 5/5000 |
| Magnus' Skin | Sharkskin Gloves `xvg` | 37; 41 | 50% Enhanced Defense; Fire Resist +15%; +20% Increased Attack Speed; +3 to Light Radius; +100 to Attack Rating<br>RAW: `ac%(_;50;50); res-fire(_;15;15); swing2(_;20;20); light(_;3;3); att(_;100;100)` | — | 0; 7; 5/5000 |
| Whitstan's Guard [source: Wihtstan's Guard] | Round Shield `xml` | 29; 41 | 175% Enhanced Defense; +40% Faster Block Rate; 55% Increased Chance of Blocking; Half Freeze Duration; +5 to Light Radius<br>RAW: `ac%(_;175;175); block3(_;40;40); block(_;55;55); half-freeze(_;1;1); light(_;5;5)` | — | 0; 7; 5/5000 |

| Global threshold | Additional properties /raw |
| --- | --- |
| 2 distinct pieces | +35 to Life<br>RAW: `hp(_;35;35)` |
| 3 distinct pieces | Attacker Takes Damage of 5<br>RAW: `thorns(_;5;5)` |
| 4 distinct pieces | +100 Defense<br>RAW: `ac(_;100;100)` |
| All 4 distinct pieces; add to earlier thresholds | +50 to Life; +10 to Dexterity; +20 to Strength; +100 Defense; All Resistances +15; 80% Better Chance of Getting Magic Items<br>RAW: `hp(_;50;50); dex(_;10;10); str(_;20;20); ac(_;100;100); res-all(_;15;15); mag%(0;80;80)` |

### G. Hwanin's Majesty (4 pieces)

| Piece /source key | Base /code | Req lvl; definition lvl | Baseline properties /raw | Per-piece conditional properties /raw | add func; rarity; price mult/add |
| --- | --- | --- | --- | --- | --- |
| Hwanin's Splendor | Grand Crown `xrn` | 45; 28 | Replenish Life +20; Magic Damage Reduced by 10; Cold Resist +37%; 100% Enhanced Defense<br>RAW: `regen(_;20;20); red-mag(_;10;10); res-cold(_;37;37); ac%(_;100;100)` | — | 0; 7; 5/5000 |
| Hwanin's Refuge | Tigulated Mail `xcl` | 30; 28 | +200 Defense; Poison Resist +27%; +100 to Life; 10% Chance to cast level 3 Static Field when struck<br>RAW: `ac(_;200;200); res-pois(_;27;27); hp(_;100;100); gethit-skill(42;10;3)` | — | 0; 7; 5/5000 |
| Hwanin's Seal | Belt `mbl` | 35; 28 | Adds 3-33 Lightning Damage; Prevent Monster Heal; +1.5 Defense per clvl (floor after scaling); 12% Damage Taken Goes To Mana<br>RAW: `dmg-ltng(_;3;33); noheal(_;1;1); ac/lvl(12;_;_); dmg-to-mana(_;12;12)` | — | 0; 7; 5/5000 |
| Hwanin's Justice | Bill `9vo` | 28; 28 | +330 to Attack Rating; Indestructible; 10% Chance to cast level 3 Ice Blast on striking; +40% Increased Attack Speed; 200% Enhanced Damage; Adds 5-25 Lightning Damage<br>RAW: `att(_;330;330); indestruct(_;1;1); hit-skill(45;10;3); swing3(_;40;40); dmg%(_;200;200); dmg-ltng(_;5;25)` | — | 0; 7; 5/5000 |

| Global threshold | Additional properties /raw |
| --- | --- |
| 2 distinct pieces | +100 Defense<br>RAW: `ac(_;100;100)` |
| 3 distinct pieces | +200 Defense<br>RAW: `ac(_;200;200)` |
| All 4 distinct pieces; add to earlier thresholds | +2 to All Skills; 20% Life Stolen per Hit; +30% Faster Run/Walk; All Resistances +30<br>RAW: `allskills(_;2;2); lifesteal(_;20;20); move3(_;30;30); res-all(_;30;30)` |

### G. Sazabi's Grand Tribute (3 pieces)

| Piece /source key | Base /code | Req lvl; definition lvl | Baseline properties /raw | Per-piece conditional properties /raw | add func; rarity; price mult/add |
| --- | --- | --- | --- | --- | --- |
| Sazabi's Cobalt Redeemer | Cryptic Sword `7ls` | 73; 34 | 150% Enhanced Damage; Adds 25-35 Cold Damage (2s chill); +40% Increased Attack Speed; +318% Damage to Demons; Indestructible; +15 to Dexterity; +5 to Strength<br>RAW: `dmg%(_;150;150); dmg-cold(50;25;35); swing3(_;40;40); dmg-demon(_;318;318); indestruct(_;1;1); dex(_;15;15); str(_;5;5)` | — | 0; 7; 5/5000 |
| Sazabi's Ghost Liberator | Balrog Skin `upl` | 67; 34 | +400 Defense; +30% Faster Hit Recovery; +25 to Strength; +300 to Attack Rating against Demons; +50-75 to Life<br>RAW: `ac(_;400;400); balance3(_;30;30); str(_;25;25); att-demon(_;300;300); hp(_;50;75)` | — | 0; 7; 5/5000 |
| Sazabi's Mental Sheath | Basinet `xhl` | 43; 34 | +100 Defense; +1 to All Skills; Fire Resist +15-20%; Lightning Resist +15-20%<br>RAW: `ac(_;100;100); allskills(_;1;1); res-fire(_;15;20); res-ltng(_;15;20)` | — | 0; 7; 5/5000 |

| Global threshold | Additional properties /raw |
| --- | --- |
| 2 distinct pieces | +40% Faster Run/Walk<br>RAW: `move3(_;40;40)` |
| All 3 distinct pieces; add to earlier thresholds | All Resistances +30; 15% Life Stolen per Hit; Increase Maximum Life 27%<br>RAW: `res-all(_;30;30); lifesteal(_;15;15); hp%(_;27;27)` |

### G. Bul-Kathos' Children (2 pieces)

| Piece /source key | Base /code | Req lvl; definition lvl | Baseline properties /raw | Per-piece conditional properties /raw | add func; rarity; price mult/add |
| --- | --- | --- | --- | --- | --- |
| Bul-Kathos' Sacred Charge | Colossus Blade `7gd` | 61; 50 | 35% Chance of Crushing Blow; All Resistances +20; +20% Increased Attack Speed; Knockback; 200% Enhanced Damage<br>RAW: `crush(_;35;35); res-all(_;20;20); swing2(_;20;20); knock(_;1;1); dmg%(_;200;200)` | — | 0; 7; 5/5000 |
| Bul-Kathos' Tribal Guardian | Mythical Sword `7wd` | 54; 50 | Fire Resist +50%; Approx. 49.8047 Poison Damage over 2s; authoritative rate 255–255/256 per frame; +20% Increased Attack Speed; +20 to Strength; 200% Enhanced Damage<br>RAW: `res-fire(_;50;50); dmg-pois(50;255;255); swing2(_;20;20); str(_;20;20); dmg%(_;200;200)` | — | 0; 7; 5/5000 |

| Global threshold | Additional properties /raw |
| --- | --- |
| All 2 distinct pieces; add to earlier thresholds | Adds 20-20 Fire Damage; +2 to All Skills; +200 to Attack Rating; +25 Defense; +200% Damage to Undead; +200% Damage to Demons<br>RAW: `dmg-fire(_;20;20); allskills(_;2;2); att(_;200;200); ac(_;25;25); dmg-undead(_;200;200); dmg-demon(_;200;200)` |

### G. Cow King's Leathers (3 pieces)

| Piece /source key | Base /code | Req lvl; definition lvl | Baseline properties /raw | Per-piece conditional properties /raw | add func; rarity; price mult/add |
| --- | --- | --- | --- | --- | --- |
| Cow King's Horns | War Hat `xap` | 25; 20 | +75 Defense; Half Freeze Duration; 35% Damage Taken Goes To Mana; Attacker Takes Damage of 10<br>RAW: `ac(_;75;75); half-freeze(_;1;1); dmg-to-mana(_;35;35); thorns(_;10;10)` | — | 0; 7; 5/5000 |
| Cow King's Hide | Studded Leather `stu` | 18; 20 | All Resistances +18; 60% Enhanced Defense; +30 to Life; 18% Chance to cast level 5 Chain Lightning when struck<br>RAW: `res-all(_;18;18); ac%(_;60;60); hp(_;30;30); gethit-skill(53;18;5)` | — | 0; 7; 5/5000 |
| Cow King's Hoofs | Heavy Boots `vbt` | 13; 20 | +25-35 Defense; +30% Faster Run/Walk; 25% Better Chance of Getting Magic Items; +20 to Dexterity; Adds 25-35 Fire Damage<br>RAW: `ac(_;25;35); move3(_;30;30); mag%(_;25;25); dex(_;20;20); dmg-fire(_;25;35)` | — | 0; 7; 5/5000 |

| Global threshold | Additional properties /raw |
| --- | --- |
| 2 distinct pieces | Poison Resist +25%<br>RAW: `res-pois(_;25;25)` |
| All 3 distinct pieces; add to earlier thresholds | +100 Maximum Stamina; +20 to Strength; 100% Extra Gold from Monsters; 100% Better Chance of Getting Magic Items; 25% Chance to cast level 5 Static Field when struck; +30% Increased Attack Speed<br>RAW: `stam(_;100;100); str(_;20;20); gold%(_;100;100); mag%(_;100;100); gethit-skill(42;25;5); swing3(_;30;30)` |

### G. Naj's Ancient Vestige (3 pieces)

Internal set key: `Naj's Ancient Set`.

| Piece /source key | Base /code | Req lvl; definition lvl | Baseline properties /raw | Per-piece conditional properties /raw | add func; rarity; price mult/add |
| --- | --- | --- | --- | --- | --- |
| Naj's Puzzler | Elder Staff `6cs` | 78; 43 | +35 to Energy; 150% Enhanced Damage; Level 11 Teleport (69 Charges); +30% Faster Cast Rate; Adds 6-45 Lightning Damage; +70 to Mana; +1 to All Skills<br>RAW: `enr(_;35;35); dmg%(_;150;150); charged(54;69;11); cast3(_;30;30); dmg-ltng(_;6;45); mana(_;70;70); allskills(_;1;1)` | — | 0; 7; 5/5000 |
| Naj's Light Plate | Hellforged Plate `ult` | 71; 43 | Requirements -60%; +65 to Life; All Resistances +25; 45% Damage Taken Goes To Mana; +1 to All Skills; +300 Defense<br>RAW: `ease(_;-60;-60); hp(_;65;65); res-all(_;25;25); dmg-to-mana(_;45;45); allskills(_;1;1); ac(_;300;300)` | — | 0; 7; 5/5000 |
| Naj's Circlet | Circlet `ci0` | 28; 43 | +75 Defense; Adds 25-35 Fire Damage; +5 to Light Radius; +15 to Strength; 12% Chance to cast level 5 Chain Lightning when struck<br>RAW: `ac(_;75;75); dmg-fire(_;25;35); Light(_;5;5); str(_;15;15); gethit-skill(53;12;5)` | — | 0; 7; 5/5000 |

| Global threshold | Additional properties /raw |
| --- | --- |
| 2 distinct pieces | +175 Defense<br>RAW: `ac(_;175;175)` |
| All 3 distinct pieces; add to earlier thresholds | +1 to All Skills; Replenish Life +10; +15 to Dexterity; All Resistances +50; +20 to Strength; +100 to Mana<br>RAW: `allskills(_;1;1); regen(_;10;10); dex(_;15;15); res-all(_;50;50); str(_;20;20); mana(_;100;100)` |

### G. Sander's Folly (4 pieces)

Internal set key: `McAuley's Folly`.

| Piece /source key | Base /code | Req lvl; definition lvl | Baseline properties /raw | Per-piece conditional properties /raw | add func; rarity; price mult/add |
| --- | --- | --- | --- | --- | --- |
| Sander's Paragon [source: McAuley's Paragon] | Cap `cap` | 25; 20 | 35% Better Chance of Getting Magic Items; Attacker Takes Damage of 8; +1 Defense per clvl (floor after scaling)<br>RAW: `mag%(_;35;35); thorns(_;8;8); ac/lvl(8;_;_)` | — | 0; 3; 5/5000 |
| Sander's Riprap [source: McAuley's Riprap] | Heavy Boots `vbt` | 20; 20 | +40% Faster Run/Walk; +100 to Attack Rating; +5 to Strength; +10 to Dexterity<br>RAW: `move3(_;40;40); att(_;100;100); str(_;5;5); dex(_;10;10)` | — | 0; 7; 5/5000 |
| Sander's Taboo [source: McAuley's Taboo] | Heavy Gloves `vgl` | 28; 20 | +20-25 Defense; +20% Increased Attack Speed; +40 to Life; Approx. 8.78906–10.5469 Poison Damage over 3s; authoritative rate 30–36/256 per frame<br>RAW: `ac(_;20;25); swing2(_;20;20); hp(_;40;40); dmg-pois(75;30;36)` | — | 0; 7; 5/5000 |
| Sander's Superstition [source: McAuley's Superstition] | Bone Wand `bwn` | 25; 20 | 75% Enhanced Damage; +25 to Mana; 8% Mana Stolen per Hit; +20% Faster Cast Rate; Adds 25-75 Cold Damage (2s chill)<br>RAW: `dmg%(2;75;75); mana(_;25;25); manasteal(_;8;8); cast3(_;20;20); dmg-cold(50;25;75)` | — | 0; 7; 5/5000 |

| Global threshold | Additional properties /raw |
| --- | --- |
| 2 distinct pieces | +50 Defense<br>RAW: `ac(_;50;50)` |
| 3 distinct pieces | +75 to Attack Rating<br>RAW: `att(_;75;75)` |
| All 4 distinct pieces; add to earlier thresholds | +1 to All Skills; 50% Better Chance of Getting Magic Items; +50 to Mana; 4% Life Stolen per Hit<br>RAW: `allskills(_;1;1); mag%(_;50;50); mana(_;50;50); lifesteal(_;4;4)` |

## Appendix H. Every enabled Cube recipe, with all 36 crafts and all upgrades

[Source CubeMain.txt](https://cdn.jsdelivr.net/gh/fabd/diablo2@45112569deb9384738ccafe5c24ebbb71f41c7c9/code/d2_113_data/CubeMain.txt).

Recipe descriptions in the source are comments; **encoded input/output fields control behavior**. Input base families accept mapped exceptional/elite counterparts where recipe matching allows it. `mag/rar/uni/crf/nor/low` = magic/rare/unique/crafted/normal/low; `bas/exc/eli` = normal/exceptional/elite tier; `nos` unsocketed; `qty=N` consumed quantity; `usetype` rebuilds the same base type, `useitem` modifies the existing item. `mod` retains properties for base upgrades; `rep/rch/uns` repair/recharge/empty sockets. An explicit positive `lvl` fixes output ilvl; otherwise percentage fields `plvl,ilvl` mean separately floored clvl/input-ilvl contributions, capped99; all-zero level handling is recipe/engine-specific (normalizing low quality gives ilvl1). Empty min-difficulty means no explicit difficulty restriction in this row. Cube ladderflag1 works in single-player as well as online ladder, unlike runeword serverflag1.


### H.1. All 36 crafting recipes

| Line /family-slot | Complete ingredients (magic base +jewel +rune +perfect gem) | Fixed properties /raw | Output level /encoded result |
| --- | --- | --- | --- |
| 66 hitpower helm | Full Helm / Basinet / Giant Conch [mag, upg] (`fhl,mag,upg`)<br>Jewel (`jew`)<br>Ith Rune (`r06`)<br>Perfect Sapphire (`gpb`) | 5% Chance to cast level 4 Frost Nova when struck; Attacker Takes Damage of 3-7; +25-50 Defense vs. Missile<br>RAW: `gethit-skill(44;5;4); thorns(_;3;7); ac-miss(_;25;50)` | lvl=0; plvl=50%; ilvl=50%; `usetype,crf` |
| 67 hitpower boots | Chain Boots / Mesh Boots / Boneweave Boots [mag, upg] (`mbt,mag,upg`)<br>Jewel (`jew`)<br>Ral Rune (`r08`)<br>Perfect Sapphire (`gpb`) | 5% Chance to cast level 4 Frost Nova when struck; Attacker Takes Damage of 3-7; +25-60 Defense vs. Melee<br>RAW: `gethit-skill(44;5;4); thorns(_;3;7); ac-hth(_;25;60)` | lvl=0; plvl=50%; ilvl=50%; `usetype,crf` |
| 68 hitpower gloves | Chain Gloves / Heavy Bracers / Vambraces [mag, upg] (`mgl,mag,upg`)<br>Jewel (`jew`)<br>Ort Rune (`r09`)<br>Perfect Sapphire (`gpb`) | 5% Chance to cast level 4 Frost Nova when struck; Attacker Takes Damage of 3-7; Knockback<br>RAW: `gethit-skill(44;5;4); thorns(_;3;7); knock(_;1;1)` | lvl=0; plvl=50%; ilvl=50%; `usetype,crf` |
| 69 hitpower belt | Heavy Belt / Battle Belt / Troll Belt [mag, upg] (`tbl,mag,upg`)<br>Jewel (`jew`)<br>Tal Rune (`r07`)<br>Perfect Sapphire (`gpb`) | 5% Chance to cast level 4 Frost Nova when struck; Attacker Takes Damage of 3-7; 5-10% Damage Taken Goes To Mana<br>RAW: `gethit-skill(44;5;4); thorns(_;3;7); dmg-to-mana(_;5;10)` | lvl=0; plvl=50%; ilvl=50%; `usetype,crf` |
| 70 hitpower shield | Gothic Shield / Ancient Shield / Ward [mag, upg] (`gts,mag,upg`)<br>Jewel (`jew`)<br>Eth Rune (`r05`)<br>Perfect Sapphire (`gpb`) | 5% Chance to cast level 4 Frost Nova when struck; Attacker Takes Damage of 3-10; 5-10% Increased Chance of Blocking<br>RAW: `gethit-skill(44;5;4); thorns(_;3;10); block(_;5;10)` | lvl=0; plvl=50%; ilvl=50%; `usetype,crf` |
| 71 hitpower body | Field Plate / Sharktooth Armor / Kraken Shell [mag, upg] (`fld,mag,upg`)<br>Jewel (`jew`)<br>Nef Rune (`r04`)<br>Perfect Sapphire (`gpb`) | 5% Chance to cast level 4 Frost Nova when struck; Attacker Takes Damage of 3-10; +10-20% Faster Hit Recovery<br>RAW: `gethit-skill(44;5;4); thorns(_;3;10); balance1(_;10;20)` | lvl=0; plvl=50%; ilvl=50%; `usetype,crf` |
| 72 hitpower amulet | Amulet family [mag] (`amul,mag`)<br>Jewel (`jew`)<br>Thul Rune (`r10`)<br>Perfect Sapphire (`gpb`) | 5% Chance to cast level 4 Frost Nova when struck; Attacker Takes Damage of 3-10; Hit Causes Monster to Flee 3–11% (raw /128 chance)<br>RAW: `gethit-skill(44;5;4); thorns(_;3;10); howl(_;5;15)` | lvl=0; plvl=50%; ilvl=50%; `usetype,crf` |
| 73 hitpower ring | Ring family [mag] (`ring,mag`)<br>Jewel (`jew`)<br>Amn Rune (`r11`)<br>Perfect Sapphire (`gpb`) | 5% Chance to cast level 4 Frost Nova when struck; Attacker Takes Damage of 3-6; +1-5 to Dexterity<br>RAW: `gethit-skill(44;5;4); thorns(_;3;6); dex(_;1;5)` | lvl=0; plvl=50%; ilvl=50%; `usetype,crf` |
| 74 hitpower weapon | Blunt family [mag] (`blun,mag`)<br>Jewel (`jew`)<br>Tir Rune (`r03`)<br>Perfect Sapphire (`gpb`) | 5% Chance to cast level 4 Frost Nova when struck; Attacker Takes Damage of 3-7; 35-60% Enhanced Damage<br>RAW: `gethit-skill(44;5;4); thorns(_;3;7); dmg%(_;35;60)` | lvl=0; plvl=50%; ilvl=50%; `usetype,crf` |
| 75 blood helm | Helm / Casque / Armet [mag, upg] (`hlm,mag,upg`)<br>Jewel (`jew`)<br>Ral Rune (`r08`)<br>Perfect Ruby (`gpr`) | 1-3% Life Stolen per Hit; +10-20 to Life; 5-10% Deadly Strike<br>RAW: `lifesteal(_;1;3); hp(_;10;20); deadly(_;5;10)` | lvl=0; plvl=50%; ilvl=50%; `usetype,crf` |
| 76 blood boots | Light Plated Boots / Battle Boots / Mirrored Boots [mag, upg] (`tbt,mag,upg`)<br>Jewel (`jew`)<br>Eth Rune (`r05`)<br>Perfect Ruby (`gpr`) | 1-3% Life Stolen per Hit; +10-20 to Life; Replenish Life +5-10<br>RAW: `lifesteal(_;1;3); hp(_;10;20); regen(_;5;10)` | lvl=0; plvl=50%; ilvl=50%; `usetype,crf` |
| 77 blood gloves | Heavy Gloves / Sharkskin Gloves / Vampirebone Gloves [mag, upg] (`vgl,mag,upg`)<br>Jewel (`jew`)<br>Nef Rune (`r04`)<br>Perfect Ruby (`gpr`) | 1-3% Life Stolen per Hit; +10-20 to Life; 5-10% Chance of Crushing Blow<br>RAW: `lifesteal(_;1;3); hp(_;10;20); crush(_;5;10)` | lvl=0; plvl=50%; ilvl=50%; `usetype,crf` |
| 78 blood belt | Belt / Mesh Belt / Mithril Coil [mag, upg] (`mbl,mag,upg`)<br>Jewel (`jew`)<br>Tal Rune (`r07`)<br>Perfect Ruby (`gpr`) | 1-3% Life Stolen per Hit; +10-20 to Life; 5-10% Chance of Open Wounds<br>RAW: `lifesteal(_;1;3); hp(_;10;20); openwounds(_;5;10)` | lvl=0; plvl=50%; ilvl=50%; `usetype,crf` |
| 79 blood shield | Spiked Shield / Barbed Shield / Blade Barrier [mag, upg] (`spk,mag,upg`)<br>Jewel (`jew`)<br>Ith Rune (`r06`)<br>Perfect Ruby (`gpr`) | 1-3% Life Stolen per Hit; +10-20 to Life; Attacker Takes Damage of 4-7<br>RAW: `lifesteal(_;1;3); hp(_;10;20); thorns(_;4;7)` | lvl=0; plvl=50%; ilvl=50%; `usetype,crf` |
| 80 blood body | Plate Mail / Templar Coat / Hellforged Plate [mag, upg] (`plt,mag,upg`)<br>Jewel (`jew`)<br>Thul Rune (`r10`)<br>Perfect Ruby (`gpr`) | 1-3% Life Stolen per Hit; +10-20 to Life; +1-3 Life after each Demon Kill<br>RAW: `lifesteal(_;1;3); hp(_;10;20); demon-heal(_;1;3)` | lvl=0; plvl=50%; ilvl=50%; `usetype,crf` |
| 81 blood amulet | Amulet family [mag] (`amul,mag`)<br>Jewel (`jew`)<br>Amn Rune (`r11`)<br>Perfect Ruby (`gpr`) | 1-4% Life Stolen per Hit; +10-20 to Life; +5-10% Faster Run/Walk<br>RAW: `lifesteal(_;1;4); hp(_;10;20); move1(_;5;10)` | lvl=0; plvl=50%; ilvl=50%; `usetype,crf` |
| 82 blood ring | Ring family [mag] (`ring,mag`)<br>Jewel (`jew`)<br>Sol Rune (`r12`)<br>Perfect Ruby (`gpr`) | 1-3% Life Stolen per Hit; +10-20 to Life; +1-5 to Strength<br>RAW: `lifesteal(_;1;3); hp(_;10;20); str(_;1;5)` | lvl=0; plvl=50%; ilvl=50%; `usetype,crf` |
| 83 blood weapon | Axe / Cleaver / Small Crescent [mag] (`axe,mag`)<br>Jewel (`jew`)<br>Ort Rune (`r09`)<br>Perfect Ruby (`gpr`) | 1-4% Life Stolen per Hit; +10-20 to Life; 35-60% Enhanced Damage<br>RAW: `lifesteal(_;1;4); hp(_;10;20); dmg%(_;35;60)` | lvl=0; plvl=50%; ilvl=50%; `usetype,crf` |
| 84 caster helm | Mask / Death Mask / Demonhead [mag, upg] (`msk,mag,upg`)<br>Jewel (`jew`)<br>Nef Rune (`r04`)<br>Perfect Amethyst (`gpv`) | Regenerate Mana 4-10%; +10-20 to Mana; 1-4% Mana Stolen per Hit<br>RAW: `regen-mana(_;4;10); mana(_;10;20); manasteal(_;1;4)` | lvl=0; plvl=50%; ilvl=50%; `usetype,crf` |
| 85 caster boots | Boots / Demonhide Boots / Wyrmhide Boots [mag, upg] (`lbt,mag,upg`)<br>Jewel (`jew`)<br>Thul Rune (`r10`)<br>Perfect Amethyst (`gpv`) | Regenerate Mana 4-10%; +10-20 to Mana; Increase Maximum Mana 2-5%<br>RAW: `regen-mana(_;4;10); mana(_;10;20); mana%(_;2;5)` | lvl=0; plvl=50%; ilvl=50%; `usetype,crf` |
| 86 caster gloves | Leather Gloves / Demonhide Gloves / Bramble Mitts [mag, upg] (`lgl,mag,upg`)<br>Jewel (`jew`)<br>Ort Rune (`r09`)<br>Perfect Amethyst (`gpv`) | Regenerate Mana 4-10%; +10-20 to Mana; +1-3 to Mana after each Kill<br>RAW: `regen-mana(_;4;10); mana(_;10;20); mana-kill(_;1;3)` | lvl=0; plvl=50%; ilvl=50%; `usetype,crf` |
| 87 caster belt | Light Belt / Sharkskin Belt / Vampirefang Belt [mag, upg] (`vbl,mag,upg`)<br>Jewel (`jew`)<br>Ith Rune (`r06`)<br>Perfect Amethyst (`gpv`) | Regenerate Mana 4-10%; +10-20 to Mana; +5-10% Faster Cast Rate<br>RAW: `regen-mana(_;4;10); mana(_;10;20); cast1(_;5;10)` | lvl=0; plvl=50%; ilvl=50%; `usetype,crf` |
| 88 caster shield | Small Shield / Round Shield / Luna [mag, upg] (`sml,mag,upg`)<br>Jewel (`jew`)<br>Eth Rune (`r05`)<br>Perfect Amethyst (`gpv`) | Regenerate Mana 4-10%; +10-20 to Mana; 5-10% Increased Chance of Blocking<br>RAW: `regen-mana(_;4;10); mana(_;10;20); block(_;5;10)` | lvl=0; plvl=50%; ilvl=50%; `usetype,crf` |
| 89 caster body | Light Plate / Mage Plate / Archon Plate [mag, upg] (`ltp,mag,upg`)<br>Jewel (`jew`)<br>Tal Rune (`r07`)<br>Perfect Amethyst (`gpv`) | Regenerate Mana 4-10%; +10-20 to Mana; +1-3 to Mana after each Kill<br>RAW: `regen-mana(_;4;10); mana(_;10;20); mana-kill(_;1;3)` | lvl=0; plvl=50%; ilvl=50%; `usetype,crf` |
| 90 caster amulet | Amulet family [mag] (`amul,mag`)<br>Jewel (`jew`)<br>Ral Rune (`r08`)<br>Perfect Amethyst (`gpv`) | Regenerate Mana 4-10%; +10-20 to Mana; +5-10% Faster Cast Rate<br>RAW: `regen-mana(_;4;10); mana(_;10;20); cast1(_;5;10)` | lvl=0; plvl=50%; ilvl=50%; `usetype,crf` |
| 91 caster ring | Ring family [mag] (`ring,mag`)<br>Jewel (`jew`)<br>Amn Rune (`r11`)<br>Perfect Amethyst (`gpv`) | Regenerate Mana 4-10%; +10-20 to Mana; +1-5 to Energy<br>RAW: `regen-mana(_;4;10); mana(_;10;20); enr(_;1;5)` | lvl=0; plvl=50%; ilvl=50%; `usetype,crf` |
| 92 caster weapon | Staves And Rods family [mag] (`rod,mag`)<br>Jewel (`jew`)<br>Tir Rune (`r03`)<br>Perfect Amethyst (`gpv`) | Regenerate Mana 4-10%; +10-20 to Mana; Increase Maximum Mana 1-5%<br>RAW: `regen-mana(_;4;10); mana(_;10;20); mana%(_;1;5)` | lvl=0; plvl=50%; ilvl=50%; `usetype,crf` |
| 93 safety helm | Crown / Grand Crown / Corona [mag, upg] (`crn,mag,upg`)<br>Jewel (`jew`)<br>Ith Rune (`r06`)<br>Perfect Emerald (`gpg`) | Damage Reduced by 1-4; Magic Damage Reduced by 1-2; Lightning Resist +5-10%; 10-30% Enhanced Defense<br>RAW: `red-dmg(_;1;4); red-mag(_;1;2); res-ltng(_;5;10); ac%(_;10;30)` | lvl=0; plvl=50%; ilvl=50%; `usetype,crf` |
| 94 safety boots | Greaves / War Boots / Myrmidon Greaves [mag, upg] (`hbt,mag,upg`)<br>Jewel (`jew`)<br>Ort Rune (`r09`)<br>Perfect Emerald (`gpg`) | Damage Reduced by 1-4; Magic Damage Reduced by 1-2; Fire Resist +5-10%; 10-30% Enhanced Defense<br>RAW: `red-dmg(_;1;4); red-mag(_;1;2); res-fire(_;5;10); ac%(_;10;30)` | lvl=0; plvl=50%; ilvl=50%; `usetype,crf` |
| 95 safety gloves | Gauntlets / War Gauntlets / Ogre Gauntlets [mag, upg] (`hgl,mag,upg`)<br>Jewel (`jew`)<br>Ral Rune (`r08`)<br>Perfect Emerald (`gpg`) | Damage Reduced by 1-4; Magic Damage Reduced by 1-2; Cold Resist +5-10%; 10-30% Enhanced Defense<br>RAW: `red-dmg(_;1;4); red-mag(_;1;2); res-cold(_;5;10); ac%(_;10;30)` | lvl=0; plvl=50%; ilvl=50%; `usetype,crf` |
| 96 safety belt | Sash / Demonhide Sash / Spiderweb Sash [mag, upg] (`lbl,mag,upg`)<br>Jewel (`jew`)<br>Tal Rune (`r07`)<br>Perfect Emerald (`gpg`) | Damage Reduced by 1-4; Magic Damage Reduced by 1-2; Poison Resist +5-10%; 10-30% Enhanced Defense<br>RAW: `red-dmg(_;1;4); red-mag(_;1;2); res-pois(_;5;10); ac%(_;10;30)` | lvl=0; plvl=50%; ilvl=50%; `usetype,crf` |
| 97 safety shield | Kite Shield / Dragon Shield / Monarch [mag, upg] (`kit,mag,upg`)<br>Jewel (`jew`)<br>Nef Rune (`r04`)<br>Perfect Emerald (`gpg`) | Damage Reduced by 1-4; Magic Damage Reduced by 1-2; Magic Resist +5-10%; 10-30% Enhanced Defense<br>RAW: `red-dmg(_;1;4); red-mag(_;1;2); res-mag(_;5;10); ac%(_;10;30)` | lvl=0; plvl=50%; ilvl=50%; `usetype,crf` |
| 98 safety body | Breast Plate / Cuirass / Great Hauberk [mag, upg] (`brs,mag,upg`)<br>Jewel (`jew`)<br>Eth Rune (`r05`)<br>Perfect Emerald (`gpg`) | Damage Reduced by 1-4; Magic Damage Reduced by 1-2; Half Freeze Duration; 10-30% Enhanced Defense<br>RAW: `red-dmg(_;1;4); red-mag(_;1;2); half-freeze(_;1;1); ac%(_;10;30)` | lvl=0; plvl=50%; ilvl=50%; `usetype,crf` |
| 99 safety amulet | Amulet family [mag] (`amul,mag`)<br>Jewel (`jew`)<br>Thul Rune (`r10`)<br>Perfect Emerald (`gpg`) | Damage Reduced by 1-4; Magic Damage Reduced by 1-2; 1-10% Increased Chance of Blocking<br>RAW: `red-dmg(_;1;4); red-mag(_;1;2); block(_;1;10)` | lvl=0; plvl=50%; ilvl=50%; `usetype,crf` |
| 100 safety ring | Ring family [mag] (`ring,mag`)<br>Jewel (`jew`)<br>Amn Rune (`r11`)<br>Perfect Emerald (`gpg`) | Damage Reduced by 1-4; Magic Damage Reduced by 1-2; +1-5 to Vitality<br>RAW: `red-dmg(_;1;4); red-mag(_;1;2); vit(_;1;5)` | lvl=0; plvl=50%; ilvl=50%; `usetype,crf` |
| 101 safety weapon | Spear family [mag] (`spea,mag`)<br>Jewel (`jew`)<br>Sol Rune (`r12`)<br>Perfect Emerald (`gpg`) | Damage Reduced by 1-4; Magic Damage Reduced by 1-2; 5-10% Enhanced Defense<br>RAW: `red-dmg(_;1;4); red-mag(_;1;2); ac%(_;5;10)` | lvl=0; plvl=50%; ilvl=50%; `usetype,crf` |

### H.2. Remaining enabled recipes (gem/rune progression included)

| Line | Source description | Ingredients /encoded matching | Output /level fields | ladder; min diff; version; class; op/param/value | Fixed mods (chance if nonblank) /raw |
| --- | --- | --- | --- | --- | --- |
| 2 | Staff of Kings + Viper amulet -> Horadric Staff | Staff of the Kings (`msf`) + viper amulet (`vip`) | hst [lvl=0,plvl=0%,ilvl=0%] | 0; —; 0; —; 28/—/— | — |
| 3 | Khalim Flail + Khalim Heart + Khalim Eye + Khalim Brain -> Super Khalim Flail | KhalimFlail (`qf1`) + KhalimHeart (`qhr`) + KhalimEye (`qey`) + KhalimBrain (`qbr`) | qf2 [lvl=0,plvl=0%,ilvl=0%] | 0; —; 0; —; 28/—/— | — |
| 4 | 1 Wirt's leg + 1 town portal book -> portal to cow lvl | Wirt's Leg (`leg`) + Town Portal Book (`tbk`) | Cow Portal [lvl=0,plvl=0%,ilvl=0%] | 0; —; 0; —; 28/—/— | — |
| 5 | 3 health potions + 3 mana potions + 1 standard gem -> full rejuvenate potion | Healing Potion family [qty=3] (`hpot,qty=3`) + Mana Potion family [qty=3] (`mpot,qty=3`) + Standard Gem family (`gem2`) | rvl [lvl=0,plvl=0%,ilvl=0%] | 0; —; 0; —; —/—/— | — |
| 6 | 3 health potions +  3 mana potions + 1 chipped gem -> rejuvenate potion | Healing Potion family [qty=3] (`hpot,qty=3`) + Mana Potion family [qty=3] (`mpot,qty=3`) + Chipped Gem family (`gem0`) | rvs [lvl=0,plvl=0%,ilvl=0%] | 0; —; 0; —; —/—/— | — |
| 7 | 3 small rejuvs -> one large | Rejuv Potion [qty=3] (`rvs,qty=3`) | rvl [lvl=0,plvl=0%,ilvl=0%] | 0; —; 0; —; —/—/— | — |
| 8 | 1 perfect gem of each type + 1 amulet -> prismatic amulet | amulet [mag] (`amu,mag`) + Perfect Amethyst (`gpv`) + Perfect Topaz (`gpy`) + Perfect Sapphire (`gpb`) + Perfect Emerald (`gpg`) + Perfect Ruby (`gpr`) + Perfect Diamond (`gpw`) | amu,mag,pre=331 [lvl=50,plvl=0%,ilvl=0%] | 0; —; 0; —; —/—/— | — |
| 9 | 1 ring + 1 perfect ruby + 1 exploding potions -> garnet ring | ring [mag] (`rin,mag`) + Perfect Ruby (`gpr`) + Exploding Potion (`opm`) | rin,mag,pre=372 [lvl=30,plvl=0%,ilvl=0%] | 0; —; 0; —; —/—/— | — |
| 10 | 1 ring + 1 perfect sapphire + 1 thawing potions-> cobalt ring | ring [mag] (`rin,mag`) + Perfect Sapphire (`gpb`) + Thawing Potion (`wms`) | rin,mag,pre=353 [lvl=30,plvl=0%,ilvl=0%] | 0; —; 0; —; —/—/— | — |
| 11 | 1 ring + 1 perfect topaz + 1 rejuvenation -> coral ring | ring [mag] (`rin,mag`) + Perfect Topaz (`gpy`) + Rejuv Potion (`rvs`) | rin,mag,pre=392 [lvl=30,plvl=0%,ilvl=0%] | 0; —; 0; —; —/—/— | — |
| 12 | 1 ring + 1 emerald + 1 antidote potions -> jade ring | ring [mag] (`rin,mag`) + Perfect Emerald (`gpg`) + Antidote Potion (`yps`) | rin,mag,pre=412 [lvl=30,plvl=0%,ilvl=0%] | 0; —; 0; —; —/—/— | — |
| 13 | 1 axe + 1 dagger -> throwing axe | Axe (`axe`) + Knife family (`knif`) | tax,nor [lvl=0,plvl=0%,ilvl=0%] | 0; —; 0; —; —/—/— | — |
| 14 | 1 spear + 1 arrow quiver -> javelins | Spear family (`spea`) + Arrows (`aqv`) | jav,nor [lvl=0,plvl=0%,ilvl=0%] | 0; —; 0; —; —/—/— | — |
| 15 | 3 rings -> amulet | ring [mag, qty=3] (`rin,mag,qty=3`) | amu,mag [lvl=0,plvl=75%,ilvl=0%] | 0; —; 0; —; —/—/— | — |
| 16 | 3 amulets -> ring | amulet [mag, qty=3] (`amu,mag,qty=3`) | rin,mag [lvl=0,plvl=75%,ilvl=0%] | 0; —; 0; —; —/—/— | — |
| 17 | "3 standard gems + 1 socketed weapon ->  magic, socketable weapon" | Weapon family [sock] (`weap,sock`) + Standard Gem family [qty=3] (`gem2,qty=3`) | usetype,mag [lvl=30,plvl=0%,ilvl=60%] | 0; —; 0; —; —/—/— | Socketed (1-2)<br>RAW: `sock(_;1;2)` |
| 18 | "3 flawless gems + 1 magic weapon -> socketed, magic weapon" | Weapon family [mag] (`weap,mag`) + Flawless Gem family [qty=3] (`gem3,qty=3`) | usetype,mag [lvl=30,plvl=0%,ilvl=60%] | 0; —; 0; —; —/—/— | Socketed (1-2)<br>RAW: `sock(_;1;2)` |
| 19 | 1 magic small shield + 1 spiked club + 2 skulls -> shield of spikes | Any Shield family [mag] (`shld,mag`) + Skull family [qty=2] (`gemz,qty=2`) + Spiked Club (`spc`) | usetype,mag,suf=162 [lvl=30,plvl=0%,ilvl=60%] | 0; —; 0; —; —/—/— | — |
| 20 | 4 health potion + 1 ruby + 1 magic sword -> sword of the leech | Sword family [mag] (`swor,mag`) + Ruby family (`gemr`) + Healing Potion family [qty=4] (`hpot,qty=4`) | usetype,mag,suf=352 [lvl=30,plvl=0%,ilvl=60%] | 0; —; 0; —; —/—/— | — |
| 21 | 1 diamond + 1 kriss + 1 staff + 1 belt -> savage polearm | Kris (`kri`) + Diamond family (`gemd`) + Staff family (`staf`) + Belt family (`belt`) | pole,mag,pre=191 [lvl=50,plvl=0%,ilvl=60%] | 0; —; 0; —; —/—/— | — |
| 22 | 1 strangling gas potion + 1 health potion -> antidote potion | Strangling Gas Potion (`gpl`) + Healing Potion family (`hpot`) | yps [lvl=0,plvl=0%,ilvl=0%] | 0; —; 0; —; —/—/— | — |
| 23 | 2 arrows -> bolts | Arrows [qty=2] (`aqv,qty=2`) | cqv [lvl=0,plvl=0%,ilvl=0%] | 0; —; 0; —; —/—/— | — |
| 24 | 2 bolts -> arrows | Bolts [qty=2] (`cqv,qty=2`) | aqv [lvl=0,plvl=0%,ilvl=0%] | 0; —; 0; —; —/—/— | — |
| 25 | 3 chipped amethysts -> flawed amethyst | Chipped Amethyst [qty=3] (`gcv,qty=3`) | gfv [lvl=0,plvl=0%,ilvl=0%] | 0; —; 0; —; —/—/— | — |
| 26 | 3 flawed amethysts -> standard amethyst | Flawed Amethyst [qty=3] (`gfv,qty=3`) | gsv [lvl=0,plvl=0%,ilvl=0%] | 0; —; 0; —; —/—/— | — |
| 27 | 3 standard amethysts -> flawless amethyst | Amethyst [qty=3] (`gsv,qty=3`) | gzv [lvl=0,plvl=0%,ilvl=0%] | 0; —; 0; —; —/—/— | — |
| 28 | 3 flawless amethysts -> perfect amethyst | Flawless Amethyst [qty=3] (`gzv,qty=3`) | gpv [lvl=0,plvl=0%,ilvl=0%] | 0; —; 0; —; —/—/— | — |
| 29 | 3 chipped rubies -> flawed ruby | Chipped Ruby [qty=3] (`gcr,qty=3`) | gfr [lvl=0,plvl=0%,ilvl=0%] | 0; —; 0; —; —/—/— | — |
| 30 | 3 flawed rubies -> standard ruby | Flawed Ruby [qty=3] (`gfr,qty=3`) | gsr [lvl=0,plvl=0%,ilvl=0%] | 0; —; 0; —; —/—/— | — |
| 31 | 3 standard rubies -> flawless ruby | Ruby [qty=3] (`gsr,qty=3`) | glr [lvl=0,plvl=0%,ilvl=0%] | 0; —; 0; —; —/—/— | — |
| 32 | 3 flawless rubies -> perfect ruby | Flawless Ruby [qty=3] (`glr,qty=3`) | gpr [lvl=0,plvl=0%,ilvl=0%] | 0; —; 0; —; —/—/— | — |
| 33 | 3 chipped sapphires -> flawed sapphire | Chipped Sapphire [qty=3] (`gcb,qty=3`) | gfb [lvl=0,plvl=0%,ilvl=0%] | 0; —; 0; —; —/—/— | — |
| 34 | 3 flawed sapphires -> standard sapphire | Flawed Sapphire [qty=3] (`gfb,qty=3`) | gsb [lvl=0,plvl=0%,ilvl=0%] | 0; —; 0; —; —/—/— | — |
| 35 | 3 standard sapphires -> flawless sapphire | Sapphire [qty=3] (`gsb,qty=3`) | glb [lvl=0,plvl=0%,ilvl=0%] | 0; —; 0; —; —/—/— | — |
| 36 | 3 flawless sapphires -> perfect sapphire | Flawless Sapphire [qty=3] (`glb,qty=3`) | gpb [lvl=0,plvl=0%,ilvl=0%] | 0; —; 0; —; —/—/— | — |
| 37 | 3 chipped topazes -> flawed topaz | Chipped Topaz [qty=3] (`gcy,qty=3`) | gfy [lvl=0,plvl=0%,ilvl=0%] | 0; —; 0; —; —/—/— | — |
| 38 | 3 flawed topazes -> standard topaz | Flawed Topaz [qty=3] (`gfy,qty=3`) | gsy [lvl=0,plvl=0%,ilvl=0%] | 0; —; 0; —; —/—/— | — |
| 39 | 3 standard topazes -> flawless topaz | Topaz [qty=3] (`gsy,qty=3`) | gly [lvl=0,plvl=0%,ilvl=0%] | 0; —; 0; —; —/—/— | — |
| 40 | 3 flawless topazes -> perfect topaz | Flawless Topaz [qty=3] (`gly,qty=3`) | gpy [lvl=0,plvl=0%,ilvl=0%] | 0; —; 0; —; —/—/— | — |
| 41 | 3 chipped emeralds -> flawed emerald | Chipped Emerald [qty=3] (`gcg,qty=3`) | gfg [lvl=0,plvl=0%,ilvl=0%] | 0; —; 0; —; —/—/— | — |
| 42 | 3 flawed emeralds -> standard emerald | Flawed Emerald [qty=3] (`gfg,qty=3`) | gsg [lvl=0,plvl=0%,ilvl=0%] | 0; —; 0; —; —/—/— | — |
| 43 | 3 standard emeralds -> flawless emerald | Emerald [qty=3] (`gsg,qty=3`) | glg [lvl=0,plvl=0%,ilvl=0%] | 0; —; 0; —; —/—/— | — |
| 44 | 3 flawless emeralds -> perfect emerald | Flawless Emerald [qty=3] (`glg,qty=3`) | gpg [lvl=0,plvl=0%,ilvl=0%] | 0; —; 0; —; —/—/— | — |
| 45 | 3 chipped diamonds -> flawed diamond | Chipped Diamond [qty=3] (`gcw,qty=3`) | gfw [lvl=0,plvl=0%,ilvl=0%] | 0; —; 0; —; —/—/— | — |
| 46 | 3 flawed diamonds -> standard diamond | Flawed Diamond [qty=3] (`gfw,qty=3`) | gsw [lvl=0,plvl=0%,ilvl=0%] | 0; —; 0; —; —/—/— | — |
| 47 | 3 standard diamonds -> flawless diamond | Diamond [qty=3] (`gsw,qty=3`) | glw [lvl=0,plvl=0%,ilvl=0%] | 0; —; 0; —; —/—/— | — |
| 48 | 3 flawless diamonds -> perfect diamond | Flawless Diamond [qty=3] (`glw,qty=3`) | gpw [lvl=0,plvl=0%,ilvl=0%] | 0; —; 0; —; —/—/— | — |
| 49 | 3 chipped skulls -> flawed skull | Chipped Skull [qty=3] (`skc,qty=3`) | skf [lvl=0,plvl=0%,ilvl=0%] | 0; —; 0; —; —/—/— | — |
| 50 | 3 flawed skulls -> standard skull | Flawed Skull [qty=3] (`skf,qty=3`) | sku [lvl=0,plvl=0%,ilvl=0%] | 0; —; 0; —; —/—/— | — |
| 51 | 3 standard skulls -> flawless skull | Skull [qty=3] (`sku,qty=3`) | skl [lvl=0,plvl=0%,ilvl=0%] | 0; —; 0; —; —/—/— | — |
| 52 | 3 flawless skulls -> perfect skull | Flawless Skull [qty=3] (`skl,qty=3`) | skz [lvl=0,plvl=0%,ilvl=0%] | 0; —; 0; —; —/—/— | — |
| 53 | 3 rune 01 -> rune 02 | El Rune [qty=3] (`r01,qty=3`) | r02 [lvl=0,plvl=0%,ilvl=0%] | 0; —; 100; —; —/—/— | — |
| 54 | 3 rune 02 -> rune 03 | Eld Rune [qty=3] (`r02,qty=3`) | r03 [lvl=0,plvl=0%,ilvl=0%] | 0; —; 100; —; —/—/— | — |
| 55 | 3 rune 03 -> rune 04 | Tir Rune [qty=3] (`r03,qty=3`) | r04 [lvl=0,plvl=0%,ilvl=0%] | 0; —; 100; —; —/—/— | — |
| 56 | 3 rune 04 -> rune 05 | Nef Rune [qty=3] (`r04,qty=3`) | r05 [lvl=0,plvl=0%,ilvl=0%] | 0; —; 100; —; —/—/— | — |
| 57 | 3 rune 05 -> rune 06 | Eth Rune [qty=3] (`r05,qty=3`) | r06 [lvl=0,plvl=0%,ilvl=0%] | 0; —; 100; —; —/—/— | — |
| 58 | 3 rune 06 -> rune 07 | Ith Rune [qty=3] (`r06,qty=3`) | r07 [lvl=0,plvl=0%,ilvl=0%] | 0; —; 100; —; —/—/— | — |
| 59 | 3 rune 07 -> rune 08 | Tal Rune [qty=3] (`r07,qty=3`) | r08 [lvl=0,plvl=0%,ilvl=0%] | 0; —; 100; —; —/—/— | — |
| 60 | 3 rune 08 -> rune 09 | Ral Rune [qty=3] (`r08,qty=3`) | r09 [lvl=0,plvl=0%,ilvl=0%] | 0; —; 100; —; —/—/— | — |
| 61 | 3 rune 09 -> rune 10 | Ort Rune [qty=3] (`r09,qty=3`) | r10 [lvl=0,plvl=0%,ilvl=0%] | 0; —; 100; —; —/—/— | — |
| 62 | 3 perfect gems + 1 magic item -> magic item | any [mag] (`any,mag`) + Perfect Gem family [qty=3] (`gem4,qty=3`) | usetype,mag [lvl=0,plvl=0%,ilvl=100%] | 0; —; 100; —; —/—/— | — |
| 63 | 6 perfect skulls + 1 rare item -> 1 low level rare item | any [rar] (`any,rar`) + Perfect Skull [qty=6] (`skz,qty=6`) | usetype,rar [lvl=0,plvl=40%,ilvl=40%] | 0; —; 0; —; —/—/— | — |
| 64 | 1 perfect skull + 1 rare item + soj -> 1 high level rare item | any [rar] (`any,rar`) + Perfect Skull (`skz`) + The Stone of Jordan (`The Stone of Jordan`) | usetype,rar [lvl=0,plvl=66%,ilvl=66%] | 0; —; 0; —; —/—/— | — |
| 65 | 3 perfect skull + 1 rare item + stone of jordan-> add 1 socket to rare | any [rar, nos] (`any,rar,nos`) + Perfect Skull [qty=3] (`skz,qty=3`) + The Stone of Jordan (`The Stone of Jordan`) | useitem,sock=1 [lvl=0,plvl=0%,ilvl=0%] | 0; —; 0; —; —/—/— | — |
| 102 | 3 rune 10 + 1 chipped topaz -> rune 11 | Thul Rune [qty=3] (`r10,qty=3`) + Chipped Topaz (`gcy`) | r11 [lvl=0,plvl=0%,ilvl=0%] | 0; —; 100; —; —/—/— | — |
| 103 | 3 rune 11 + 1 chipped amethyst -> rune 12 | Amn Rune [qty=3] (`r11,qty=3`) + Chipped Amethyst (`gcv`) | r12 [lvl=0,plvl=0%,ilvl=0%] | 0; —; 100; —; —/—/— | — |
| 104 | 3 rune 12 + 1 chipped sapphire -> rune 13 | Sol Rune [qty=3] (`r12,qty=3`) + Chipped Sapphire (`gcb`) | r13 [lvl=0,plvl=0%,ilvl=0%] | 0; —; 100; —; —/—/— | — |
| 105 | 3 rune 13 + 1 chipped ruby -> rune 14 | Shael Rune [qty=3] (`r13,qty=3`) + Chipped Ruby (`gcr`) | r14 [lvl=0,plvl=0%,ilvl=0%] | 0; —; 100; —; —/—/— | — |
| 106 | 3 rune 14 + 1 chipped emerald -> rune 15 | Dol Rune [qty=3] (`r14,qty=3`) + Chipped Emerald (`gcg`) | r15 [lvl=0,plvl=0%,ilvl=0%] | 1; —; 100; —; —/—/— | — |
| 107 | 3 rune 15 + 1 chipped diamond -> rune 16 | Hel Rune [qty=3] (`r15,qty=3`) + Chipped Diamond (`gcw`) | r16 [lvl=0,plvl=0%,ilvl=0%] | 1; —; 100; —; —/—/— | — |
| 108 | 3 rune 16 + 1 flawed topaz -> rune 17 | Io Rune [qty=3] (`r16,qty=3`) + Flawed Topaz (`gfy`) | r17 [lvl=0,plvl=0%,ilvl=0%] | 1; —; 100; —; —/—/— | — |
| 109 | 3 rune 17 + 1 flawed amethyst -> rune 18 | Lum Rune [qty=3] (`r17,qty=3`) + Flawed Amethyst (`gfv`) | r18 [lvl=0,plvl=0%,ilvl=0%] | 1; —; 100; —; —/—/— | — |
| 110 | 3 rune 18 + 1 flawed sapphire -> rune 19 | Ko Rune [qty=3] (`r18,qty=3`) + Flawed Sapphire (`gfb`) | r19 [lvl=0,plvl=0%,ilvl=0%] | 1; —; 100; —; —/—/— | — |
| 111 | 3 rune 19 + 1 flawed ruby -> rune 20 | Fal Rune [qty=3] (`r19,qty=3`) + Flawed Ruby (`gfr`) | r20 [lvl=0,plvl=0%,ilvl=0%] | 1; —; 100; —; —/—/— | — |
| 112 | 3 rune 20 + 1 flawed emerald -> rune 21 | Lem Rune [qty=3] (`r20,qty=3`) + Flawed Emerald (`gfg`) | r21 [lvl=0,plvl=0%,ilvl=0%] | 1; —; 100; —; —/—/— | — |
| 113 | 2 rune 21 + 1 flawed diamond -> rune 22 | Pul Rune [qty=2] (`r21,qty=2`) + Flawed Diamond (`gfw`) | r22 [lvl=0,plvl=0%,ilvl=0%] | 1; —; 100; —; —/—/— | — |
| 114 | 2 rune 22 + 1 standard topaz -> rune 23 | Um Rune [qty=2] (`r22,qty=2`) + Topaz (`gsy`) | r23 [lvl=0,plvl=0%,ilvl=0%] | 1; —; 100; —; —/—/— | — |
| 115 | 2 rune 23 + 1 standard amethyst -> rune 24 | Mal Rune [qty=2] (`r23,qty=2`) + Amethyst (`gsv`) | r24 [lvl=0,plvl=0%,ilvl=0%] | 1; —; 100; —; —/—/— | — |
| 116 | 2 rune 24 + 1 standard sapphire -> rune 25 | Ist Rune [qty=2] (`r24,qty=2`) + Sapphire (`gsb`) | r25 [lvl=0,plvl=0%,ilvl=0%] | 1; —; 100; —; —/—/— | — |
| 117 | 2 rune 25 + 1 standard ruby -> rune 26 | Gul Rune [qty=2] (`r25,qty=2`) + Ruby (`gsr`) | r26 [lvl=0,plvl=0%,ilvl=0%] | 1; —; 100; —; —/—/— | — |
| 118 | 2 rune 26 + 1 standard emerald -> rune 27 | Vex Rune [qty=2] (`r26,qty=2`) + Emerald (`gsg`) | r27 [lvl=0,plvl=0%,ilvl=0%] | 1; —; 100; —; —/—/— | — |
| 119 | 2 rune 27 + 1 standard diamond -> rune 28 | Ohm Rune [qty=2] (`r27,qty=2`) + Diamond (`gsw`) | r28 [lvl=0,plvl=0%,ilvl=0%] | 1; —; 100; —; —/—/— | — |
| 120 | 2 rune 28 + 1 flawless topaz -> rune 29 | Lo Rune [qty=2] (`r28,qty=2`) + Flawless Topaz (`gly`) | r29 [lvl=0,plvl=0%,ilvl=0%] | 1; —; 100; —; —/—/— | — |
| 121 | 2 rune 29 + 1 flawless amethyst -> rune 30 | Sur Rune [qty=2] (`r29,qty=2`) + Flawless Amethyst (`gzv`) | r30 [lvl=0,plvl=0%,ilvl=0%] | 1; —; 100; —; —/—/— | — |
| 122 | 2 rune 30 + 1 flawless sapphire -> rune 31 | Ber Rune [qty=2] (`r30,qty=2`) + Flawless Sapphire (`glb`) | r31 [lvl=0,plvl=0%,ilvl=0%] | 1; —; 100; —; —/—/— | — |
| 123 | 2 rune 31 + 1 flawless ruby -> rune 32 | Jah Rune [qty=2] (`r31,qty=2`) + Flawless Ruby (`glr`) | r32 [lvl=0,plvl=0%,ilvl=0%] | 1; —; 100; —; —/—/— | — |
| 124 | 2 rune 32 + 1 flawless emerald -> rune 33 | Cham Rune [qty=2] (`r32,qty=2`) + Flawless Emerald (`glg`) | r33 [lvl=0,plvl=0%,ilvl=0%] | 1; —; 100; —; —/—/— | — |
| 125 | r07 + r10 + 1 perfect topaz + normal torso -> socketed torso | Armor family [nor, nos] (`tors,nor,nos`) + Tal Rune (`r07`) + Thul Rune (`r10`) + Perfect Topaz (`gpy`) | useitem [lvl=0,plvl=0%,ilvl=0%] | 0; —; 100; —; —/—/— | Socketed (1-6)<br>RAW: `sock(_;1;6)` |
| 126 | r08 + r11 + 1 perfect amethyst + normal weapon -> socketed weapon | Weapon family [nor, nos] (`weap,nor,nos`) + Ral Rune (`r08`) + Amn Rune (`r11`) + Perfect Amethyst (`gpv`) | useitem [lvl=0,plvl=0%,ilvl=0%] | 0; —; 100; —; —/—/— | Socketed (1-6)<br>RAW: `sock(_;1;6)` |
| 127 | r08 + r10 + 1 perfect sapphire + normal helm -> socketed helm | Helm family [nor, nos] (`helm,nor,nos`) + Ral Rune (`r08`) + Thul Rune (`r10`) + Perfect Sapphire (`gpb`) | useitem [lvl=0,plvl=0%,ilvl=0%] | 0; —; 100; —; —/—/— | Socketed (1-6)<br>RAW: `sock(_;1;6)` |
| 128 | r07 + r11 + 1 perfect ruby + normal shield -> socketed shield | Any Shield family [nor, nos] (`shld,nor,nos`) + Tal Rune (`r07`) + Amn Rune (`r11`) + Perfect Ruby (`gpr`) | useitem [lvl=0,plvl=0%,ilvl=0%] | 0; —; 100; —; —/—/— | Socketed (1-6)<br>RAW: `sock(_;1;6)` |
| 129 | r02 + 1 chipped gem + low weapon -> normal weapon | Weapon family [low] (`weap,low`) + Eld Rune (`r02`) + Chipped Gem family (`gem0`) | usetype,nor [lvl=0,plvl=0%,ilvl=0%] | 0; —; 100; —; —/—/— | — |
| 130 | r01 + 1 chipped gem + low armor -> normal armor | Any Armor family [low] (`armo,low`) + El Rune (`r01`) + Chipped Gem family (`gem0`) | usetype,nor [lvl=0,plvl=0%,ilvl=0%] | 0; —; 100; —; —/—/— | — |
| 131 | r08 + r12 + perfect emerald + basic unique weapon -> exceptional unique weapon | Weapon family [bas, uni] (`weap,bas,uni`) + Ral Rune (`r08`) + Sol Rune (`r12`) + Perfect Emerald (`gpg`) | useitem,mod,exc [lvl=0,plvl=0%,ilvl=0%] | 0; —; 100; —; —/—/— | Required Level penalty +5<br>RAW: `levelreq(_;5;5)` |
| 132 | r07 + r13 + perfect diamond + basic unique armor -> exceptional unique armor | Any Armor family [bas, uni] (`armo,bas,uni`) + Tal Rune (`r07`) + Shael Rune (`r13`) + Perfect Diamond (`gpw`) | useitem,mod,exc [lvl=0,plvl=0%,ilvl=0%] | 0; —; 100; —; —/—/— | Required Level penalty +5<br>RAW: `levelreq(_;5;5)` |
| 133 | r17 + r21 + perfect emerald + exceptional unique weapon -> elite unique weapon | Weapon family [exc, uni] (`weap,exc,uni`) + Lum Rune (`r17`) + Pul Rune (`r21`) + Perfect Emerald (`gpg`) | useitem,mod,eli [lvl=0,plvl=0%,ilvl=0%] | 1; —; 100; —; —/—/— | Required Level penalty +7<br>RAW: `levelreq(_;7;7)` |
| 134 | r18 + r20 + perfect diamond + exceptional unique armor -> elite unique armor | Any Armor family [exc, uni] (`armo,exc,uni`) + Ko Rune (`r18`) + Lem Rune (`r20`) + Perfect Diamond (`gpw`) | useitem,mod,eli [lvl=0,plvl=0%,ilvl=0%] | 1; —; 100; —; —/—/— | Required Level penalty +7<br>RAW: `levelreq(_;7;7)` |
| 135 | r09 + r11 + perfect sapphire + basic rare weapon -> exceptional rare weapon | Weapon family [bas, rar] (`weap,bas,rar`) + Ort Rune (`r09`) + Amn Rune (`r11`) + Perfect Sapphire (`gpb`) | useitem,mod,exc [lvl=0,plvl=0%,ilvl=0%] | 0; —; 100; —; —/—/— | Required Level penalty +5<br>RAW: `levelreq(_;5;5)` |
| 136 | r08 + r10 + perfect amethyst + basic rare armor -> exceptional rare armor | Any Armor family [bas, rar] (`armo,bas,rar`) + Ral Rune (`r08`) + Thul Rune (`r10`) + Perfect Amethyst (`gpv`) | useitem,mod,exc [lvl=0,plvl=0%,ilvl=0%] | 0; —; 100; —; —/—/— | Required Level penalty +5<br>RAW: `levelreq(_;5;5)` |
| 137 | r19 + r22 + perfect sapphire + exceptional rare weapon -> elite rare weapon | Weapon family [exc, rar] (`weap,exc,rar`) + Fal Rune (`r19`) + Um Rune (`r22`) + Perfect Sapphire (`gpb`) | useitem,mod,eli [lvl=0,plvl=0%,ilvl=0%] | 0; —; 100; —; —/—/— | Required Level penalty +7<br>RAW: `levelreq(_;7;7)` |
| 138 | r18 + r21 + perfect amethyst + exceptional rare armor -> elite rare armor | Any Armor family [exc, rar] (`armo,exc,rar`) + Ko Rune (`r18`) + Pul Rune (`r21`) + Perfect Amethyst (`gpv`) | useitem,mod,eli [lvl=0,plvl=0%,ilvl=0%] | 0; —; 100; —; —/—/— | Required Level penalty +7<br>RAW: `levelreq(_;7;7)` |
| 139 | r09 + weapon -> repair | Weapon family [noe] (`weap,noe`) + Ort Rune (`r09`) | useitem,rep,qty=255 [lvl=0,plvl=0%,ilvl=0%] | 0; —; 100; —; —/—/— | — |
| 140 | r08 + armor -> repair | Any Armor family [noe] (`armo,noe`) + Ral Rune (`r08`) | useitem,rep,qty=255 [lvl=0,plvl=0%,ilvl=0%] | 0; —; 100; —; —/—/— | — |
| 141 | r09 + weapon + chipped gem -> repair + recharge | Weapon family [noe] (`weap,noe`) + Ort Rune (`r09`) + Chipped Gem family (`gem0`) | useitem,rep,rch,qty=255 [lvl=0,plvl=0%,ilvl=0%] | 0; —; 100; —; —/—/— | — |
| 142 | r08 + armor + flawed gem -> repair + recharge | Any Armor family [noe] (`armo,noe`) + Ral Rune (`r08`) + Flawed Gem family (`gem1`) | useitem,rep,rch,qty=255 [lvl=0,plvl=0%,ilvl=0%] | 0; —; 100; —; —/—/— | — |
| 143 | r15 + tsc + any socketed item -> unsocket (destroy gems) | any [sock] (`any,sock`) + Hel Rune (`r15`) + Town Portal Scroll (`tsc`) | useitem,uns [lvl=0,plvl=0%,ilvl=0%] | 0; —; 100; —; —/—/— | — |
| 149 | "3 chipped gems + 1 magic weapon -> socketed, magic weapon" | Weapon family [mag] (`weap,mag`) + Chipped Gem family [qty=3] (`gem0,qty=3`) | usetype,mag [lvl=25,plvl=0%,ilvl=50%] | 0; —; 0; —; —/—/— | Socketed (1-2)<br>RAW: `sock(_;1;2)` |
| 150 | Pandemonium key | Pandemonium Key 1 (`pk1`) + Pandemonium Key 2 (`pk2`) + Pandemonium Key 3 (`pk3`) | Pandemonium Portal [lvl=0,plvl=0%,ilvl=0%] | 0; —; 100; —; 28/—/— | — |
| 151 | Pandemonium Finale key | Diablo's Horn (`dhn`) + Baal's Eye (`bey`) + Mephisto's Brain (`mbr`) | Pandemonium Finale Portal [lvl=0,plvl=0%,ilvl=0%] | 0; —; 100; —; 28/—/— | — |
| 152 | Token of Absolution | Twisted Essence of Suffering (`tes`) + Charged Essense of Hatred (`ceh`) + Burning Essence of Terror (`bet`) + Festering Essence of Destruction (`fed`) | toa [lvl=0,plvl=0%,ilvl=0%] | 0; —; 100; —; —/—/— | — |

## Appendix I. Property-handler and stat representation reference

The research does not reimplement the property engine. The following links and special-unit rules are necessary to turn raw tuples into correct JSON/TS records:

[Source Properties.txt](https://cdn.jsdelivr.net/gh/fabd/diablo2@45112569deb9384738ccafe5c24ebbb71f41c7c9/code/d2_113_data/Properties.txt).

[Source ItemStatCost.txt](https://cdn.jsdelivr.net/gh/fabd/diablo2@45112569deb9384738ccafe5c24ebbb71f41c7c9/code/d2_113_data/ItemStatCost.txt).

[Source Skills.txt](https://cdn.jsdelivr.net/gh/fabd/diablo2@45112569deb9384738ccafe5c24ebbb71f41c7c9/code/d2_113_data/Skills.txt).

[Source SkillDesc.txt](https://cdn.jsdelivr.net/gh/fabd/diablo2@45112569deb9384738ccafe5c24ebbb71f41c7c9/code/d2_113_data/SkillDesc.txt).

| Handler family | Interpretation |
| --- | --- |
| ordinary scalar | min/max = inclusive rolled stat bounds; parameter may select stat/skill |
| dmg-fire/cold/ltng/mag/norm | min and max are paired damage endpoints, not a roll selecting one common value; cold parameter is length in frames |
| dmg | single rolled value applied as the special flat item_normaldamage stat (Grief); not the same handler as ordinary +min/+max or ED |
| dmg-pois /pois-min/max | rate in1/256damage/frame; parameter length frames when combined poison handler |
| skill /skilltab /classcode | native class skill /tab /class-level bonus; use Skills IDs and skill-tab index |
| oskill | grants use to other classes; native-class bonus capped+3 |
| hit/gethit/att/kill/death/levelup-skill | parameter=skill; min=trigger chance%; max=skill level |
| charged | parameter=skill; min=max charges; max=skill level |
| aura | parameter=aura skill; min/max=rolled equipped aura level |
| randclassskill | Torch handler function36 has Properties.val1=3; min0/max6 select class id, not bonus range |
| skill-rand | Ormus: parameter=+3bonus; min36/max60 are candidate skill IDs |
| per-level | normally parameter coefficient/8 ×clvl; AR-family coefficient/2; if parameter blank, min/max can supply a variable coefficient (Fortitude8–12 =>1–1.5Life/clvl) |
| rep-dur /rep-quant | parameter coefficient p gives1unit every100/p seconds |
| howl | raw chance units /128; displayed percent floors100×raw/128; Dol32=>25% |
| sock | fixed count may live in parameter; otherwise min/max count; generation clamps by base/type where applicable |
| state /reanimate | state IDs need engine/state mapping; reanimate parameter monster ID; not an extra random scalar |
| comments | Property code beginning* is a disabled comment; do not activate it by stripping* |

## Coverage audit and unresolved fidelity checks

| Requested coverage | Delivered |
|---|---|
| Equipment/storage | All slots and weapon swapping; inventory10×4; LoD stash6×8; Cube3×4; belt rows; per-base footprints |
| Base catalogs | **291 equipment weapon bases +6 throwing potions;202 armor bases**, all tiers, numeric damage/defense/requirements/qlvl/durability/sockets/size/speed and mappings |
| Affixes | **501 prefixes +466 suffixes** meeting active LoD filters, all requested main families, eligibility/groups/rarity weights/price fields and raw modifiers |
| Socketables | **35 gems +33 runes**, three contexts, required levels, raw poison/cold length data |
| Runewords | **78** complete additive specifications; all word properties plus every rune contribution for every allowed context;23 ladder creation restrictions |
| Uniques | **385 enabled definitions**, including six quest uniques and eight Rainbow Facet variants; all names/bases/properties, far beyond40 iconic examples |
| Sets | **32 sets /127 pieces**, baseline and conditional piece stats, incremental global partial/full stats; all10 requested sets complete |
| Cube | **146 enabled recipes**, including all36 crafts, gem/rune progression, sockets/repair/unsocket/upgrades/rerolls/quest-event recipes |
| Consumables/economics | Class-specific healing/mana amounts and per-tier frame durations; rejuvenation/resistance/stamina buffs; scrolls/tomes/keys/gold; vendor caps; gambling quality/ilvl/base-upgrade formulas |

**Still incomplete or not binary-verified; do not silently guess:**

1. **Exact1.14 extraction comparison:** tables are a1.13 legacy mirror. Normalized headers and display-name aliases are research conveniences; retain code and line identifiers when comparing against1.14.
2. **Affix-generation runtime:** exact rare count distribution, RNG boundaries and failed-pick behavior; pristine AutoMagic row levels/weights; staffmod skill-tier probabilities, rejected-skill retries and imbue bonuses. Numeric automod ranges are described but the complete automod table is not supplied.
3. **Drop/runtime engine:** source levels for all chests/racks and special monsters; quality nonpositive-denominator cases; natural socket-count distribution beyond verified caps; exact1.14 behavior of once-per-game unique bookkeeping and special direct event drops. Annihilus/Torch definition lvl110 is intentional: direct event generation is not a normal ilvl99 quality roll.
4. **Combat representation:** full animation breakpoint tables, skill-specific weapon wear, blocked-hit durability, poison-source aggregation/truncation, advanced damage/defense calculation order and state-ID behavior are not a combat-engine implementation. Preserve raw tuples. Trang full-set vampire animation and legacy ethereal Cube-defense bug are explicitly part of this target.
5. **Economy/consumable runtime:** exact vendor buy/sell/repair and level-scaled gambling cost arithmetic, all quest discount scopes, exceptional-vs-elite gamble roll order, potion double RNG and mixed-tier overlap. Supplied base costs and caps are exact table/published values, not substitute price formulas.
6. **Platform/game mode:** ladder-only runewords versus single-player-enabled ladder Cube recipes, online event availability, legacy Cow King restriction and no shared stash must be explicit configuration decisions. Enabling all words offline is a deviation. No D2R-only words, set upgrades, new base compatibility, stash expansion or ebug fix should be imported.

The raw tuple tables allow engineers to import numerical definitions without relying on human-summary rounding. Values explicitly labeled approximate/unverified require regression tests against a legal legacy1.14 installation before a1:1 claim.

## Sources

### Primary published legacy rules

- [Arreat Summit item basics](https://classic.battle.net/diablo2exp/items/basics.shtml): qualities, ethereal, superior, durability, cleanup.
- [Arreat Summit basics/storage/gold/tomes/belt](https://classic.battle.net/diablo2exp/basics/).
- [Arreat Summit base weapons and armor](https://classic.battle.net/diablo2exp/items/weaponsandarmor.shtml).
- [Arreat Summit socketed items](https://classic.battle.net/diablo2exp/items/socketeditems.shtml).
- [Arreat Summit Larzuk and other quest rewards](https://classic.battle.net/diablo2exp/quests/rewards.shtml).
- [Arreat Summit gems](https://classic.battle.net/diablo2exp/items/gems.shtml) and [runes](https://classic.battle.net/diablo2exp/items/runes.shtml).
- [Arreat Summit magic item rules](https://classic.battle.net/diablo2exp/items/magic.shtml) and [affix tables](https://classic.battle.net/diablo2exp/items/magic/). Warning: the former's ilvl+2/+6−3 descriptions are outdated for this target.
- [Original runewords](https://classic.battle.net/diablo2exp/items/runewords-original.shtml), [1.10 runewords](https://classic.battle.net/diablo2exp/items/runewords-110.shtml), [1.11 runewords](https://classic.battle.net/diablo2exp/items/runewords-111.shtml).
- [Unique index](https://classic.battle.net/diablo2exp/items/uniques.shtml), [set index](https://classic.battle.net/diablo2exp/items/sets/), [sets1](https://classic.battle.net/diablo2exp/items/sets/sets1.shtml), [sets2/Civerb companion rules](https://classic.battle.net/diablo2exp/items/sets/sets2.shtml), [sets7/Tal/Trang](https://classic.battle.net/diablo2exp/items/sets/sets7.shtml).
- [Horadric Cube](https://classic.battle.net/diablo2exp/items/cube.shtml), [crafted item formulas](https://classic.battle.net/diablo2exp/items/crafteditems.shtml), [Hit Power recipes](https://classic.battle.net/diablo2exp/items/crafted/hitpower.shtml), [Blood recipes](https://classic.battle.net/diablo2exp/items/crafted/blood.shtml), [Caster recipes](https://classic.battle.net/diablo2exp/items/crafted/caster.shtml), [Safety recipes](https://classic.battle.net/diablo2exp/items/crafted/safety.shtml).
- [Potions](https://classic.battle.net/diablo2exp/items/potions.shtml), [character/potion double mechanics](https://classic.battle.net/diablo2exp/basics/characters.shtml), [vendor pricing caps](https://classic.battle.net/diablo2exp/basics/vendors.shtml), [gambling](https://classic.battle.net/diablo2exp/basics/gambling.shtml).

### Extracted game-table evidence

- [fabd legacy1.13 extraction at pinned commit](https://github.com/fabd/diablo2/tree/45112569deb9384738ccafe5c24ebbb71f41c7c9/code/d2_113_data): Weapons, Armor, Misc, ItemTypes, ItemRatio, MagicPrefix, MagicSuffix, Gems, Runes, UniqueItems, SetItems, Sets, CubeMain, Inventory, Properties, ItemStatCost, Skills, SkillDesc. Each appendix links its individual source file. This is third-party extracted Blizzard game data, not official distribution or a verified1.14 release.
- [Weapons.txt](https://cdn.jsdelivr.net/gh/fabd/diablo2@45112569deb9384738ccafe5c24ebbb71f41c7c9/code/d2_113_data/Weapons.txt), [Armor.txt](https://cdn.jsdelivr.net/gh/fabd/diablo2@45112569deb9384738ccafe5c24ebbb71f41c7c9/code/d2_113_data/Armor.txt), [ItemRatio.txt](https://cdn.jsdelivr.net/gh/fabd/diablo2@45112569deb9384738ccafe5c24ebbb71f41c7c9/code/d2_113_data/ItemRatio.txt), [Inventory.txt](https://cdn.jsdelivr.net/gh/fabd/diablo2@45112569deb9384738ccafe5c24ebbb71f41c7c9/code/d2_113_data/Inventory.txt).

### Reverse-engineering / corroboration and access limitations

- [Phrozen Keep Item Generation Tutorial discussion](https://d2mods.info/forum/viewtopic.php?t=30222): quality denominator/MF/TC-factor mechanics.
- [Phrozen Keep rare-affix count discussion](https://d2mods.info/forum/viewtopic.php?t=43793): constraints and tentative3,4,4,5,5,6 array; not treated as exact1.14 RNG proof.
- [Diablo Wiki Cube recipes](https://diablo2.diablowiki.net/Horadric_Cube_Recipes): search-result corroboration of1–6socket rolls; full fetch blocked403, independently confirmed by CubeMain mod min1/max6 for all four recipes.
- [Diablo Wiki crafted items](https://diablo2.diablowiki.net/Crafted_Items): search-result corroboration of required-level surcharge; not mistaken for a fully fetched source.
- [Diablo2.io normal-body socket recipe](https://diablo2.io/recipes/recipe-add-sockets-to-normal-body-armor-t3313.html): legacy ebug/superior limitations; separate D2R behavior from original LoD.
- [Legacy durability discussion](https://forums.d2jsp.org/topic.php?t=73913012&f=87), [Amazon Basin durability](https://www.theamazonbasin.com/wiki/index.php/Durability): search snippets corroborated melee armor10% and selection weights; full fetches blocked/timed out, hence advanced wear cases remain qualified.

Research compiled from retrieved published pages and extracted tables; no game code or additional project files were authored for this deliverable.
