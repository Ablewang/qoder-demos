# Diablo II: Lord of Destruction 1.14 — combat, monsters, experience and drops

## Scope, confidence and version boundary

Research specification for **original LoD expansion rules, patch 1.14**, not Diablo II: Resurrected and not non-expansion Diablo II. No game code is included. Research checked 17 November 2026.

**Confidence labels:**

- **Established:** supported by classic technical analysis, original-era tests and/or inspected classic data. Still requires regression tests against the target executable for byte-exact reproduction.
- **Data:** a value inspected in the pinned pre-D2R mirror described below; provenance is not a certified 1.14 MPQ extraction.
- **Provisional / blocker:** source conflict, incomplete arithmetic or unverified executable behavior. Do not silently turn these into production constants.

Use a **25 Hz simulation**. Life, mana and damage frequently use **1/256-point fixed-point units** (“bits”); animation durations use frames. `floor` means round downward; `trunc` means integer truncation toward zero; they differ for negative values. `clamp(x,a,b)` bounds x. Percentages in equations are percentage points unless explicitly written as fractions. Formula stages must not be merged when intermediate rounding is specified. Browser rendering rate is independent of simulation rate.

### Data provenance and authoritative hierarchy

The inspected mirror is blizzhackers/d2data at **commit `e35dcd6c014b`, 1 March 2021**, before D2R release. Its JSON files are a useful classic-LoD candidate dataset, **not proven byte-for-byte 1.14 MPQ contents**. Its current `master` is D2R data and contains newer treasure classes; do not use it for this project. JSON omits many zero fields. `SumItems`, `TotalProb` and `DropChance` are comments/annotations, not runtime inputs [TC-guide].

| Original table | Pinned candidate mirror | Role |
|---|---|---|
| CharStats.txt | [charstats.json][D-char] | Class constants, growth, run drain |
| DifficultyLevels.txt | [difficultylevels.json][D-diff] | Resistance/leech/skill and difficulty modifiers |
| MonStats.txt | [monstats.json][D-mon] | Monster type factors, resistances, drain, regeneration, flags |
| MonLvl.txt | [MonLvl.json][D-lvl] | Level-dependent base statistics |
| Levels.txt | [Levels.json][D-area] | Area levels and spawn selections |
| Experience.txt | [experience.json][D-exp] | Player thresholds and high-level ratios |
| TreasureClassEx.txt | [TreasureClassEx.json][D-tc] | Recursive weighted drops |
| ItemRatio.txt | [itemratio.json][D-ratio] | Quality denominators, divisors and minima |
| MonUMod.txt | [monumod.json][D-mod] | Modifier eligibility and constants |
| SuperUniques.txt | [SuperUniques.json][D-su] | Fixed encounters, modifiers, minions and TCs |
| MonProp.txt | [MonProp.json][D-prop] | Additional monster properties |
| Weapons.txt | [weapons.json][D-weap] | Weapon damage and attribute coefficients |
| Hireling.txt | [hireling.json][D-hire] | Mercenary difficulty/type/level-bracket growth |

本项目当前运行数据另固定到1.14d分支 `0edfaf6d006f2eb82857c066e07ce03614285981`，见 `../REFERENCE-CATALOG.md` 与 `../../src/data/provenance.json`。上面的2021候选提交是这份历史研究的来源，不能当作当前运行提交。本轮本地哈希核对只证明文件与provenance一致；在线提交来源与合法原版客户端的行为对照仍未完成。

Production needs a licensed original 1.14 installation's merged data and executable validation. Also required outside the inspected subset: Armor, ItemTypes, UniqueItems, SetItems, MagicPrefix/Suffix, ItemStatCost, Skills, Missiles, MonStats2 and AnimData. Text tables alone do not define all hardcoded rules.

**Exclude D2R changes:** Terror Zones, sunders, newly raised level-85 areas, modern Cold Mastery/sunder penalties, Amazon bows on Act I mercenaries, dual-wield/Frenzy Act V mercenaries and modern blade-skill rebalancing. Historical melee Mana Burn ×256 and Anya resistance death-bug reports require target-1.14d validation before treating them as required behavior; neither is currently reproduced or certified here. Preserve original mode restrictions per system: ladder-tagged uniques and cube recipes are not automatically realm-only, while server-tagged runewords and realm-only events remain separate. An offline H5 game is not automatically equivalent to Battle.net.

---

## 0.1 本轮执行状态与独立预期（2026-11-17）

已接通的是**普通近战主攻击武器路径**，不是全技能战斗管线。以下预期由原始字段和经典公式独立计算，单元测试验证派生属性、真实镶嵌与引擎帧循环；未做合法 1.14d 客户端逐帧对照。

| 项目 | 已实现及手算预期 | 仍未对齐 |
|---|---|---|
| CS/DS | CS 使用技能 9 的 dm12；先检查 CS，失败后检查 DS，最多一次物理 2×。101 物理、75 抗且翻倍，再加 10 火伤得到 60.5 总损失 | 武器支配级联、技能转换、射击/投掷、双手交替；当前 RNG 顺序未证明与 1.14d 完全一致 |
| 攻击来源 | 当前主攻击武器、适用非武器装备及已鉴定背包护符；另一武器、备用组、破损或未鉴定魔法属性不计入附伤/DS | 逐技能上下文、局部/层级全属性解释、全部特殊授予 |
| 元素 | 火、冰、闪电、魔法独立受抗，不被 CS/DS 翻倍；物品冰冷时长读取原始帧数及目标 coldeffect | 毒速率/时长/覆盖、Venom、冻结、减速幅度与动作状态 |
| 1/256 抗伤 | `floor(floor(max(0,D)×256)×(100−max(−100,R))/100)/256`；R≥100 为 0；101 在 75 抗后为 25.25 | 完整减伤/吸收/能量护盾/破免顺序，负 ED 与随机端点的原版细节 |
| 吸取 | 只取受抗后的实际物理生命损失，最多目标剩余生命。3 HP、10% 普通吸取为 76/256；零 Drain 的骷髅不能吸取 | 经典重建算式尚需目标客户端核验；Life Tap、PvP、全技能资格及事件阶段 |
| 法力回复 | 暖气 `30+12×(L−1)%` 与装备 regen-mana 相加；每帧 `floor(floor(maxMana×256/3000)×(100+加成)/100)/256`。900 法力、L20 暖气每秒 26.5625；另加 Eth 15% 时每帧 283/256 | 全状态属性层、全部百分比资源桶及动作生命周期 |
| 紫药 | 最大值与派生属性共用；全紫到达死灵 18 级生命 70.5；小紫按 1/256 保留 35% | 全属性/状态资源上限、原版完整药水关键回复和覆盖 |
| 火球 | skill47.srvmissile→Missiles.sHitPar1=4；距命中点 3.5 子格目标受到爆炸伤害 | 客户端 cHitPar1=3 不可当伤害半径；当前圆形距离与撞墙爆炸仍近似 |

CB、OW、装备毒、受击恢复/格挡动作、所有触发事件、专属怪物 AI 以及五幕任务掉落资格仍是后续工作。133 项测试全部通过，类型检查及生产构建通过；数据哈希或测试通过不等于原版完整性证明。技能与装备研究分别记录了字段、版本来源、争议和后续独立测试样例。

## 1. Attack Rating, defense and chance to hit

Sources: [Arreat characters][Characters], [hit mechanics][Hit], [classic AR reference][AR], [classic defense guide][Defense].

### 1.1 Hit probability

For an ordinary attack requiring an AR check:

`HitPercent = clamp(200 × AR/(AR + Defense) × attackerLevel/(attackerLevel + defenderLevel), 5, 95)`

The two factors are independent: AR versus defense, and attacker versus defender level. The displayed percentage is not a damage multiplier. Skills/missiles with an always-hit or no-to-hit flag do not use this equation. Smite is an important exception. Collision and shield blocking are separate checks.

**Examples:**

- AR 4,000, defense 2,000, attacker level 80, defender 85: `200 × 4000/6000 × 80/165 = 64.6464…%` before integer engine handling.
- Equal level and equal AR/defense: 50%.
- Defense 0 and equal levels: raw 100%, capped 95%.
- Level 10 attacker against level 90 defender with defense 0: 20%, not 95%.

**Running-player exception:** an attack's AR check cannot fail against a running character: **100% for the hit check**, not “set defense to zero and cap at 95%.” Block is still possible at one-third its stationary chance. Walking preserves ordinary defense/block. Apply only to the appropriate running unit/state [Hit].

### 1.2 Class base AR and Dexterity

`BaseAR = 5 × (Dexterity − 7) + ToHitFactor`

| Class | ToHitFactor | Starting Dex | Starting base AR |
|---|---:|---:|---:|
| Amazon | +5 | 25 | 95 |
| Assassin | +15 | 20 | 80 |
| Barbarian | +20 | 20 | 85 |
| Druid | +5 | 20 | 70 |
| Necromancer | −10 | 25 | 80 |
| Paladin | +20 | 20 | 85 |
| Sorceress | −15 | 25 | 75 |

Every additional Dexterity contributes **5 flat AR** before percentage bonuses. Arreat's prose calls the class constant a “level” bonus; it belongs in **base AR**, not the level term of the hit equation [AR][D-char].

Typical ordinary-attack composition:

`AR = floor((BaseAR + applicable flat item/skill AR) × (100 + sum applicable %AR)/100)`

Use only the active attacking weapon's local AR/leech/damage properties; do not apply the other weapon's bonuses universally. Demon/undead conditionals are target-dependent. Skill-specific AR and special shrine interactions need their actual stat functions rather than an assumed single generic modifier.

Example: Paladin Dex 150: `5×143+20=735`; +500 flat AR and +200% AR give `1235×3=3705`.

### 1.3 Defense construction and defense-reduction modifiers

Ordinary character base defense includes `floor(Dex/4) + equipment defense + applicable flat defense`. Local armor ED is resolved on each item before global defense bonuses. Global percentage defense bonuses such as Shout, Iron Skin and Holy Shield normally add together.

- Ethereal armor: base defense ×1.5, rounded down.
- Armor generated with local enhanced defense normally uses **maximum base defense +1**, rather than a random base-defense roll, before local ED. Do not confuse this with global skill ED.
- Example: Chance Guards' base maximum 9 becomes 10; +30% local ED gives 13, then +15 defense gives **28**.
- Inner Sight's flat subtraction acts on base defense before percentage defense bonuses. Stone Skin doubles monster base defense first.
- Defense versus missiles/melee is conditional and added at its own late stage.
- Berserk sets the character's defense to zero during its penalty state.
- Defense reduces probability of being hit; it never subtracts hit-point damage.

| Modifier | Important exclusions/effect |
|---|---|
| Ignore Target Defense | Does not work against players, mercenaries, Champions, Uniques, Super Uniques or act bosses; works against ordinary minions. Level factor and 5–95 cap remain. |
| −% Target Defense from items | Half effectiveness against players, mercenaries, Super Uniques and act bosses. Full effectiveness against ordinary Champions, random Uniques and their minions. |

Do not equate item −% Target Defense with Conviction's defense function or with flat Inner Sight.

---

## 2. Physical damage and defensive processing

Sources: [classic physical FAQ][Physical], [damage mechanics][Damage], [Arreat damage/attributes][Characters], [special item effects][Magic], [critical-hit FAQ][Critical], [weapon data][D-weap].

### 2.1 Ordinary weapon damage order

This is the ordinary weapon-attack specification, **not** a universal equation for kicks, Smite, Vengeance, spell damage or every projectile.

1. Select weapon base min/max; use melee versus thrown endpoints as appropriate.
2. Apply ethereal ×1.5 to base endpoints, rounding down.
3. Apply weapon-local ED, including superior/socket ED on that weapon; round local endpoints.
4. Add applicable flat minimum/maximum damage from equipment and charms. Item `Damage +X`, e.g. Grief, adds X to both ordinary physical endpoints.
5. Apply summed off-weapon ED: attribute contribution, skill/mastery ED, auras, non-weapon item ED, applicable damage versus demons/undead, and hostile damage debuffs.
6. Successful player Critical Strike/Deadly Strike doubles physical damage **once**.
7. Apply skill conversion from physical to magic/elemental, where applicable.
8. Add separately sourced elemental damage; do not double all added elements with player CS/DS.
9. Apply skill weapon-damage fractions and unit-type damage modifiers at their skill-specific stages.
10. Apply defender mitigation by damage type.

For an integer-endpoint illustration:

`LocalMin = floor(floor(BaseMin × EtherealFactor) × (100 + WeaponED)/100)`

`WMin = LocalMin + FlatMin + DamagePlus`

`OffED = AttributeED + SkillED + AuraED + NonWeaponED + ConditionalED − DebuffED`

`PhysicalMin ≈ WMin × (100 + OffED)/100` and equivalently for max.

The `≈` warns that damage after the local item stage can retain **1/256-point precision**. Exact RNG endpoint selection, signed ED clamps and intermediate skill-specific fixed-point floors require original combat functions. Do not round every later stage to whole life merely because the character panel does.

**Worked example, with integral values:** base weapon 20–30, ethereal, +200% weapon ED, +10 min/+20 max, Str 150 ordinary melee, +100% skill ED, +50% aura ED:

- Ethereal: 30–45.
- Local ED: 90–135.
- Flat additions: 100–155.
- Off-weapon ED: 150+100+50=300%; physical **400–620**.
- CS/DS success: **800–1,240**, before conversion and target mitigation.

Weapon ED and off-weapon ED are separate factors. Most off-weapon bonuses are **summed**, not multiplied one after another. The inherent blunt-weapon **+50% damage to undead is off-weapon ED**, even when displayed on the weapon.

**Min/max endpoint repair:** if calculated maximum is not greater than minimum, repair the final maximum to minimum+1 at the appropriate late stage. Classic example: weapon 40–50, +11 minimum, +100% off-weapon ED internally yields 102–100, repaired to **102–103**, not 102–104 [Physical].

### 2.2 Attribute coefficients

`AttributeED = floor((Str × StrBonus + Dex × DexBonus)/100)`

Here the table's coefficients are `Weapons.txt` values; 100 means +1% ED per attribute point [D-weap].

| Weapon/use | StrBonus | DexBonus | Consequence |
|---|---:|---:|---|
| Ordinary melee weapons | 100 | 0 | +1% per Str |
| Hammers | 110 | 0 | +1.1% per Str, then truncate percent |
| Daggers | 75 | 75 | +0.75% per Str and Dex |
| Claws | 75 | 75 | Same |
| Regular throwing knives/axes/**regular javelins** | 75 | 75 | Applies to their melee and thrown use |
| Bows/crossbows | 0 | 100 | +1% per Dex |
| Amazon-only spears/javelins | 80 | 50 | +0.8% Str and +0.5% Dex |
| Shield component of Smite | 100 | 0 | Skill-specific shield damage formula |
| Boot component of kicks | 120 | 0 | Complete kick formula also has a separate Str+Dex term |

**Implementation trap:** Javelin/Pilum/War Javelin and their regular upgrades are **75/75**, not 100/0. Maiden/Ceremonial/Matriarchal Javelin are **80/50**. Hammer Str 157 gives `floor(172.7)=172%` attribute ED.

### 2.3 Skill exceptions

| Skill/mechanic | Classic exception |
|---|---|
| Vengeance | Elemental damage derives from eligible weapon damage after local ED and ordinary flat min/max. Excludes Grief `Damage +X`, off-weapon ED and CS/DS from its elemental base. |
| Berserk | Physical is doubled by eligible CS/DS before conversion to magic; fully converted damage cannot ordinary-leech. |
| Smite | Shield base damage + Holy Shield + eligible `Damage +X`, then its own ED. Ordinary weapon min/max, ordinary leech and CS/DS do not apply. Life Tap does work. |
| Kicks | Separate character/boot formula; no ordinary player CS/DS. Do not use the ordinary weapon equation. Complete kick fixed-point formula remains a blocker here. |
| Multiple Shot / Strafe / Lightning Bolt | Classic weapon fraction 3/4. |
| Blade Fury, one-handed weapon | 3/4 weapon fraction. |
| Blade Sentinel / Blade Fury, two-handed weapon | 3/8 weapon fraction. |
| Blade Shield | 1/4 weapon fraction. |

Skill-specific on-hit effects, poison-length anomalies and projectile flags must be resolved from classic Skills/Missiles functions. **Off-weapon jewels combining ED with +min/+max have classic bugs**: the clean formula above is not a specification for those combinations. Impale and other flagged attacks need their own critical eligibility. Arreat's claim that Sacrifice cannot CS/DS conflicts with classic technical descriptions of ordinary attacks; treat that exclusion as unverified, not established [Magic][Critical].

### 2.4 Critical Strike and Deadly Strike

For one eligible CS probability C and DS probability D:

`P(double physical) = C + (1−C)D = 1−(1−C)(1−D)`

C and D are fractions. A failed first check allows the next; a successful check prevents another player doubling. Mastery critical, oskill Critical Strike and item DS are not simply added together.

Example: CS 60%, DS 30%: `0.6+0.4×0.3=72%`; expected physical multiplier `1.72`, never an ordinary player 4× hit.

**Monster Crit is a different system.** Many MonStats rows have `Crit=5`; this can double non-physical monster damage and death-explosion damage as well. Inspected mercenary rows have zero/omitted Crit for Acts I–III and **Crit 5 for Act V**. Do not apply modern “all mercenaries have 5% crit” summaries to classic data. Exact interaction of Act V inherent Crit with item DS, including any 4× outcome, needs executable validation [Critical][D-mon].

### 2.5 Crushing Blow

Roll eligible CB on a successful hit; summed probability is effectively capped at 100%. CB damage is applied **before the ordinary attack damage**, based on current life [Magic].

| Target | Melee loss fraction | Ranged loss fraction |
|---|---:|---:|
| Ordinary monster | 1/4 | 1/8 |
| Champion / Unique / boss | 1/8 | 1/16 |
| Player / mercenary | 1/10 | 1/20 |

For a monster whose game-count life multiplier is `G=(players+1)/2`:

`CBLoss ≈ CurrentLife × fraction / G × (1−max(PhysicalResistance,0)/100)`

Clamp an immune/fully resisted result to zero. **Negative physical resistance does not amplify CB.** Exact fixed-point division order remains to be tested. CB does not supply ordinary life/mana leech and is not player CS/DS doubled.

Example: boss current life 100,000 in a players-3 game (`G=2`), melee CB, physical resistance 50%: `100000/8/2×0.5=3125` life removed; ordinary attack damage follows. Amp taking its resistance below zero removes positive CB resistance but does not give CB a negative-resistance bonus.

### 2.6 Open Wounds

Duration **200 frames = 8 seconds**. Attacker character level L determines negative regeneration in bits/frame [Magic]:

| Attacker L | Bits/frame |
|---|---|
| 1–15 | `9L + 31` |
| 16–30 | `18L − 104` |
| 31–45 | `27L − 374` |
| 46–60 | `36L − 779` |
| 61–99 | `45L − 1319` |

`LifeLossPerSecond = BitsPerFrame × 25/256`

- Player target: /4 for melee, /8 for ranged.
- Boss/Champion/Unique: /2 according to Arreat; exact engine target-class predicates require confirmation.
- It is negative life regeneration, not ordinary physical hit damage; physical resistance does not scale it like a weapon hit.
- It prevents regeneration and does not run as multiple parallel stacked wounds. Exact refresh/overwrite ownership behavior is not fully resolved here.

Level 70: `(3150−1319)×25/256=178.80859375` life/s; 8 seconds gives 1,430.46875 against an unpenalized target. Level 90: 266.69921875 life/s, total 2,133.59375. Apply target penalties separately.

### 2.7 Physical resistance, flat DR, MDR and absorption

Ordinary physical damage uses flat physical reduction before physical resistance:

`D1 = max(Dphysical − FlatDR,0)`

`D2 = D1 × (100−EffectivePhysicalResist)/100`

Player/mercenary effective positive physical resistance (“Damage Reduced by %”) is capped at **50%**, with a negative floor of −100%. Stored overstack still matters against curses. Monsters use their own MonStats resistance and are **not** subject to the player's 50% cap. **There is no universal +50% Hell monster physical resistance in LoD 1.10+.**

Amplify Damage subtracts 100 percentage points; Decrepify subtracts 50. Against an originally physically immune monster these curse reductions operate at **one-fifth**, as described in §3.

Example: 500 physical damage, flat DR 20, effective DR 50% gives 240. The same target after Amp, with stored DR 50%, has −50% effective resistance and receives 720.

**MDR** subtracts independently from magic, fire, lightning and cold components, **not poison**. Typical defensive sequence [Damage][Physical]:

`Energy Shield → Bone Armor/Cyclone Armor → flat DR/MDR → resistances → % absorb → flat absorb`

Each shield only handles its permitted damage types. Percentage absorption is capped at **40% per type**. Absorb heals before its damage subtraction; healing is clipped by maximum life, so at full life it does not provide a second healing benefit.

Example without other defenses: 100 fire damage after resistance, 20% absorb, sufficiently missing life: heal 20 and reduce the hit to 80, net loss 60; at full life, healing is wasted and life loss is 80.

**Blockers:** cross-type PDR/MDR overflow bug, exact PvP/unit damage matrix, Energy Shield rounding and skill armor interactions are not fully reconstructed. Do not implement overflow as a generic intentional transfer between elements.

---

## 3. Elemental/magic damage, resistance and immunity

Sources: [Arreat resistances][Resists], [Paladin offense][PalOff], [Necromancer curses][Curses], [resistance reference][Resistance], [damage mechanics][Damage].

### 3.1 Player and mercenary resistance

`StoredResist = item + skill + quest bonuses + other states + DifficultyPenalty`

`EffectiveResist = clamp(StoredResist, −100, min(75 + MaxResistBonuses,95))`

| Type | Normal penalty | Nightmare | Hell | Default positive cap |
|---|---:|---:|---:|---:|
| Fire / lightning / cold / poison | 0 | −40 | −100 | 75%; absolute raised cap 95% |
| Magic | 0 | 0 | 0 | No ordinary elemental penalty; rare explicit sources, e.g. Safety shield |
| Physical | 0 | 0 | 0 | 50% for player/mercenary |

Resistance cannot be treated as “75 minus difficulty penalty”; the penalty is subtracted from stored bonuses **before** the maximum cap. Monsters do not receive the player resistance penalty or default 75% cap.

`DamageAfterResistance = DamageBeforeResistance × (100−EffectiveResist)/100`

Example: 1,000 fire damage at 75% resistance →250; at 95%→50; at −100%→2,000. A player with +175% fire resistance in Hell has 75% effective; +250% has 150 stored but only 75 effective unless maximum resistance is raised.

Anya supplies +10 all elemental resistances per difficulty, total +30. **Classic death bug:** after dying, the quest resistance bonus is lost until leaving/rejoining even though the panel may continue showing it. A 1:1 recreation must decide the precise target build behavior through testing, not copy D2R's corrected UI/state assumptions.

Poison resistance changes poison **rate**; poison length reduction is separate (§4.5). Cold resistance changes cold damage and cold duration (§4.4).

### 3.2 Conviction, Lower Resist and item pierce

| Source | Types affected | Can break original immunity? |
|---|---|---|
| Conviction | Fire, lightning, cold; separately reduces defense | Yes, resistance reduction at 1/5 |
| Lower Resist | Fire, lightning, cold, poison | Yes, at 1/5 |
| −enemy elemental resistance, facets, Cold Mastery | Their specified element | **No**; full item/mastery reduction can apply after classic immunity is broken |
| Amplify Damage / Decrepify | Physical | Yes, at 1/5 |
| Ordinary source | Magic | No generic magic-immunity breaker |

Conviction resistance reduction magnitude:

`C(s) = min(25 + 5s,150)`

Level 1 −30%, level 20 −125%, level 25+ −150%. Radius 13 1/3 yards. Its **defense** reduction is a different diminishing function: levels 1–20 give −49, −56, −61, −66, −70, −73, −75, −77, −79, −80, −82, −83, −85, −86, −86, −88, −88, −89, −89, −90%. Use the classic skill function for higher levels [PalOff].

Lower Resist magnitude:

`LR(s) = min(25 + floor(45 × floor(110s/(s+6))/100),70)`

| Skill level | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Reduction | 31 | 37 | 41 | 44 | 47 | 49 | 51 | 52 | 54 | 55 |
| Skill level | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 |
| Reduction | 56 | 57 | 58 | 59 | 60 | 61 | 61 | 61 | 62 | 62 |

Radius `(2s+12)/3` yards; duration `20+2(s−1)` seconds [Curses].

### 3.3 Original immunity pipeline

An originally immune resistance is ≥100. For that type:

1. Apply eligible immunity breakers at one-fifth strength.
2. If resistance remains ≥100, damage is immune; ordinary item pierce/Cold Mastery cannot help.
3. If it drops below 100, the eligible item/mastery pierce can apply at full strength in classic LoD.
4. Breakers remain reduced for the originally immune resistance; do **not** restore their remaining four-fifths immediately after a successful break.
5. Clamp applicable final negative resistance at −100.

**Examples avoiding disputed multi-source truncation:**

- Lightning resistance 110, Conviction −150: reduced by 30 to 80; item pierce −20 makes 60; 1,000 lightning deals 400.
- Resistance 130, Conviction −150: becomes 100, still immune; item −100 resistance is ignored.
- Nonimmune resistance 75, Conviction −125 and item −20: final −70; 1,000 deals 1,700.
- Physical resistance 119, Amp: 119−20=99, broken. At 120 it remains immune. Decrepify alone breaks up to 109, not 110.

**Blocker:** exact combined Conviction+Lower Resist truncation/ordering near the 100 boundary needs original-code validation; individual versus summed fifths can differ by one point. Sanctuary's owner-only physical interaction with undead is a special case, not a general immunity breaker. Original Cold Mastery must not acquire D2R's sunder-era one-fifth rule.

Spell damage needs skill-specific base damage, hard-point synergies and mastery functions. Most synergies use **hard points**, not equipment-granted levels. Enchant/auras' melee mastery double-application and exceptions are not sufficiently reconstructed here to provide one universal spell equation.

---

## 4. Blocking, recovery, crowd control, poison and leech

### 4.1 Shield blocking

Sources: [block mechanics][Block], [Arreat characters][Characters], [blocking tables][Blocking].

`BlockRaw = shield intrinsic block + class BlockFactor + increased chance of blocking + Holy Shield bonus`

`ChanceToBlock = clamp(floor(BlockRaw × (Dex−15)/(2×clvl)),0,75)`

While running, divide stationary CTB by 3 with integer handling: maximum **25%**. To reach stationary 75%:

`DexNeeded = 15 + ceil(150×clvl/BlockRaw)`

| Class | BlockFactor |
|---|---:|
| Paladin | 30 |
| Amazon / Assassin / Barbarian | 25 |
| Druid / Necromancer / Sorceress | 20 |

Example level 80, BlockRaw 75, Dex 175: `floor(75×160/160)=75%`; running 25%. With Dex 100: `floor(75×85/160)=39%`; running integer result 13%.

Shield displayed block values below already include class BlockFactor. Do **not** add it twice. Columns are Amazon/Assassin/Barbarian, Druid/Necromancer/Sorceress, Paladin.

| Normal shield | A/A/B | D/N/S | P | Exceptional | A/A/B | D/N/S | P | Elite | A/A/B | D/N/S | P |
|---|---:|---:|---:|---|---:|---:|---:|---|---:|---:|---:|
| Buckler | 25 | 20 | 30 | Defender | 35 | 30 | 40 | Heater | 47 | 42 | 52 |
| Small | 30 | 25 | 35 | Round | 37 | 32 | 42 | Luna | 45 | 40 | 50 |
| Large | 37 | 32 | 42 | Scutum | 39 | 34 | 44 | Hyperion | 49 | 44 | 54 |
| Spiked | 35 | 30 | 40 | Barbed | 42 | 37 | 47 | Blade Barrier | 45 | 40 | 50 |
| Kite | 33 | 28 | 38 | Dragon | 43 | 38 | 48 | Monarch | 47 | 42 | 52 |
| Bone | 45 | 40 | 50 | Grim | 45 | 40 | 50 | Troll Nest | 45 | 40 | 50 |
| Tower | 49 | 44 | 54 | Pavise | 49 | 44 | 54 | Aegis | 49 | 44 | 54 |
| Gothic | 41 | 36 | 46 | Ancient | 41 | 36 | 46 | Ward | 49 | 44 | 54 |

Paladin shield displayed totals: Targe/Akaran Targe 40; Rondache/Akaran Rondache 45; Heraldic/Protector 50; Aerin/Gilded 52; Crown/Royal 55; Sacred Targe 60; Sacred Rondache 58; Kurast 55; Zakarum 52; Vortex 49. Necromancer head totals in base-order within each tier: 23,25,28,30,32.

A successful block negates the blockable hit's damage; many spells are unblockable. Smite is unblockable. Mercenaries **cannot block**, including Act III shield users. Assassin Weapon Block is its own skill check and does not function walking/running in classic LoD. Amazon avoidance and Weapon Block require separate eligible states; do not treat every spell as shield-blockable.

Act boss shield-block chances [Block]:

| Boss | Normal | Nightmare | Hell |
|---|---:|---:|---:|
| Andariel | 0 | 20 | 40 |
| Duriel | 0 | 25 | 50 |
| Mephisto | 20 | 40 | 50 |
| Diablo | 25 | 40 | 50 |
| Baal | 40 | 45 | 55 |

#### Faster Block Rate

`EFBR = floor(120×FBR/(120+FBR))`; Holy Shield adds 50 to effective block rate.

`Frames = ceil(256×BlockBase / floor(AnimationSpeed×(50+EFBR)/100)) − 1`

| Form | BlockBase | AnimationSpeed |
|---|---:|---:|
| Amazon ordinary / Assassin / Paladin | 3 | 256 |
| Amazon one-handed swinging weapon | 3 | 88 |
| Barbarian | 4 | 256 |
| Human Druid / Necromancer | 6 | 256 |
| Werewolf / Sorceress | 5 | 256 |
| Werebear | 5 | 200 |

Threshold lists are minimum FBR for the corresponding frame count, left to right [Block][Breakpoints]:

| Form | FBR thresholds | Frames |
|---|---|---|
| Amazon ordinary / Assassin / Paladin | 0,13,32,86,600 | 5,4,3,2,1 |
| Paladin with Holy Shield | 0,86 | 2,1 |
| Barbarian | 0,9,20,42,86,280 | 7,6,5,4,3,2 |
| Human Druid / Necromancer | 0,6,13,20,32,52,86,174,600 | 11 down to 3 |
| Sorceress / Werewolf | 0,7,15,27,48,86,200 | 9 down to 3 |
| Werebear | 0,5,10,16,27,40,65,109,223 | 12 down to 4 |
| Amazon one-handed swinging | 0,4,6,11,15,23,29,40,56,80,120,200,480 | 17 down to 5 |

Paladin 50 FBR: EFBR 35 →3-frame block, or 2 with Holy Shield. Blocking animation is not evidence of blanket invulnerability for its duration; action interruption and block-lock behavior need state-machine validation.

### 4.2 Hit recovery: do not use the 1/12 shortcut

**Established classic correction:** “damage greater than 1/12 maximum life always triggers recovery” is not the 1.10+ rule. Original technical FAQ cites independent code analysis [FHR].

Let `T=MaxLife/16` for ordinary eligible damage, or `MaxLife/8` for specified projectile flags. Compare actual damage applied, in fixed-point units:

| Damage | Hit-recovery probability before unit/state exclusions |
|---|---:|
| `<T` | 0% |
| `T ≤ D < 2T` | **37.5%** |
| `2T ≤ D < 4T` | **75%** |
| `D ≥ 4T` | **100%** |

The 37.5% is a 50% continuation check followed by 75%, not a missing 50% tier. Damage below one life, poison-only damage, dead/frozen units and units without eligible GetHit animation do not use ordinary recovery. Exact equality tests and integer T should be verified against the selected build.

Example max life 1,600, divisor 16: under 100 no recovery; 100–199 →37.5%; 200–399 →75%; 400+ →100%.

**Divisor-8 examples:** ordinary arrows/bolts and thrown weapons; Magic Arrow, Multiple Shot, Strafe, Guided Arrow, Immolation Arrow impact, Poison/Plague Javelin impact, Bone Spear, Blade Fury, quill spikes, monster arrows/javelins/darts, Ancient axes and viper Bone Spear. Use the complete Missiles flag list in [FHR]; poison cloud/DoT is not its impact.

`EFHR = floor(120×FHR/(120+FHR))`

`RecoveryFrames = ceil(256×GetHitBase / floor(AnimSpeed×(50+EFHR)/100)) − 1`

| Class/form | GetHitBase | AnimSpeed |
|---|---:|---:|
| Amazon | 6 | 256 |
| Assassin / Barbarian / ordinary Paladin | 5 | 256 |
| Human Druid / Necromancer | 7 | 256 |
| Human Druid, one-handed swinging | 7 | 248 |
| Werewolf | 4 | 256 |
| Werebear | 5 | 184 |
| Sorceress | 8 | 256 |
| Paladin relevant two-handed staff/spear/polearm/axe/hammer animation | 5 | 192 |
| Rogue / Act II / Act III mercenary | 6 / 8 / 9 | 256 |
| Act V mercenary | Nominal 5 | **No ordinary GetHit animation** |

| Form | FHR thresholds | Recovery frames |
|---|---|---|
| Amazon | 0,6,13,20,32,52,86,174,600 | 11 down to 3 |
| Assassin / Barbarian / ordinary Paladin | 0,7,15,27,48,86,200 | 9 down to 3 |
| Necromancer / ordinary human Druid | 0,5,10,16,26,39,56,86,152,377 | 13 down to 4 |
| Sorceress | 0,5,9,14,20,30,42,60,86,142,280 | 15 down to 5 |
| Werewolf | 0,9,20,42,86,280 | 7 down to 2 |
| Werebear | 0,5,10,16,24,37,54,86,152,360 | 13 down to 4 |
| Human Druid, one-handed swinging | 0,3,7,13,19,29,42,63,99,174,456 | 14 down to 4 |
| Paladin special two-handed animation | 0,3,7,13,20,32,48,75,129,280 | 13 down to 4 |

Sources using only “spears/staves” abbreviate the Paladin animation grouping; classify by actual animation, not English weapon label. Trang-Oul vampire and other transformed units require their AnimData values.

GetHit exclusions include Diablo/clone, Baal/clone, Griswold, Suicide Minions, Act V mercenaries, golems, Druid spirits/vines/ravens and static objects. These are examples, not a substitute for per-unit flags [FHR].

### 4.3 Stun and knockback

Sources: [crowd control][CC], [classic recovery analysis][FHR], [Arreat monster bonuses][MonBonus].

**Stun:** cap **250 frames = 10 seconds**. Ordinary monsters/minions can be immobilized; Champions/Unique/Super Unique have about 10% application chance with full eligible duration. Act bosses/static immune units cannot simply be immobilized. Players are not immobilized by stun stars; later eligible hits can force recovery irrespective of ordinary damage thresholds. New stun duration replaces old duration even when shorter. Unit GetHit capability remains relevant.

**Item Knockback:** monster size 1/2/3 chance = **100%/50%/25%**. Displacement up to three subtiles, about two yards, subject to obstacles. Skill chances are separate: Bash/Smite/Charge 100%, Telekinesis 35%, Molten Boulder 50% where eligible.

Dead/frozen or flag-immune units are not knocked back. Examples: act bosses, Ancients, Griswold, Izual, Nihlathak, Coldworm, Act V mercenaries and golems. Original FAQ distinguishes use of GetHit-like animation from a **separate recovery proc**; do not automatically schedule a second independent hit-recovery event on every knockback just because a modern guide says it “forces recovery.”

### 4.4 Chill, freeze and other slows

- Equipment cold lengths add; a new chill generally replaces old chill only when its duration is at least the old remaining duration.
- Player-applied cold length against monsters is full/half/quarter in Normal/Nightmare/Hell, then target cold-resistance and applicable duration modifiers.
- `Length ≈ SourceLength × DifficultyLengthFactor × (100−ColdResist)/100`, subject to immunity, flags and minimum/floor handling.
- Half Freeze Duration is a boolean halving, not repeated multiplicative halves from every item. Cannot Be Frozen prevents ordinary chill/freeze duration, not cold damage.
- Player chill applies −50 movement/attack-animation speed stats; this is **not necessarily half final attacks per second** after animation-speed math.
- Monster slow effectiveness comes from **MonStats `coldeffect`, `coldeffect(N)`, `coldeffect(H)`**, not a universal −50%. Fallen: −50/−40/−33; Baal −15 across difficulties; zero-effect targets cannot be ordinarily chilled/slowed by these cold effects [D-mon].
- Champions/Uniques downgrade freeze to chill; ordinary minions can freeze; act bosses cannot freeze.
- Chilled corpses have 20% shatter chance. Arreat says fully frozen corpses always shatter; modern summaries sometimes say 20% for both. **Frozen-corpse probability is a validation blocker**, not a resolved shared constant.
- Holy Freeze slow ignores Cannot Be Frozen and ordinary cold immunity, but zero cold-effect targets remain special.
- Slows Target item effect: cap about 90% on ordinary monsters, 50% on elites/bosses/players/mercenaries/pets, duration 30 seconds. Its interaction with Decrepify, Holy Freeze and animation caps must follow distinct speed stats; do not multiply all final velocities naively.

### 4.5 Poison rate, duration and application

Sources: [poison mechanics][Poison], [Arreat resistances][Resists], [classic damage discussion][Physical].

Represent poison as **rate in bits/frame** and **length in frames**, not rounded displayed “damage over seconds.”

`UnresistedPoisonDamage = Rate × Length /256`

For ordinary item poison:

- Rates add across sources.
- Lengths average across counted poison sources.
- Prefix+suffix on one item combine rates and lengths as **one item source**; individual socketed poison gems/jewels are separate sources.
- Example rates 100 and 200 bits/frame, lengths 100 and 200 frames: total rate 300, mean length 150 →175.78125 life over 6 seconds before resistance.
- Venom caps ordinary item-poison contribution length at **10 frames = 0.4 seconds**. It does not compress all formerly displayed item damage into 0.4 seconds. Venom adds its own rate.
- Poison Dagger and poison javelin skills have special rate/length mixing; modern Multi/Strafe/blade poison-fraction/length bugs require classic confirmation.

Poison is not parallel additive DoTs. Existing poison and incoming poison compare rates; stronger/equal applications can replace the rate/duration state. Player/mercenary/pet reapplication and monster hit-frame/overwrite behavior must not be inferred from MMO stacking models. Exact monster overwrite rules, weaker-poison first-frame damage and interference from other damage ticks are not fully verified here.

Resistance separates rate and duration:

`EffectiveRate ≈ Rate × (100−PoisonResist)/100`

`EffectiveLength ≈ Length × (100−PLR)/100`

PLR (Poison Length Reduced by %) has its **own** 0/−40/−100 difficulty penalties, maximum 75%, floor −100. Poison resistance changes rate, **not length**. −Enemy Poison Resistance can reduce both poison resistance and PLR after immunity is broken; Lower Resist changes poison resistance but does not directly lower PLR. Snapshot source effects at application.

Example: raw 1,000 poison over 10 seconds. Poison resist 50%, PLR 0 →500 over 10s. Same rate with PLR −100 →1,000 over 20s. Add eligible −20 enemy poison resistance: poison resistance becomes30%, but PLR is already at its −100 floor, so duration stays20s and total becomes1,400. From PLR −40 instead, the additional−20 would make PLR −60 and duration16s. Retain fixed-point precision rather than the rounded panel values.

Poison DoT leaves a player at at least one life, while qualifying impact damage can kill. Poison can kill monsters, mercenaries and pets. Classic experiments also identify <1-life monster death distinctions between poison and direct damage [MonTests]. Poison and Open Wounds inhibit regeneration.

Cleansing reduces remaining poison/curse duration on periodic pulses (about every two seconds):

`Reduction(s) = min(30 + floor(60×floor(110s/(s+6))/100),90)%`

Antidote effects, skill poison mixing and pulse-exact state timing require separate skill/item functions. Do not confuse 5 seconds (125 frames) with 175 frames in rounded modern poison tables.

### 4.6 Life/mana leech and Life Tap

Sources: [classic life FAQ][LifeFAQ], [Arreat characters][Characters], [life/mana mechanics][LifeMana], [difficulty data][D-diff].

Only qualifying **physical attack damage actually applied** supplies ordinary life/mana leech. Elemental/magic conversion, spells, CB and OW do not supply it.

`RecoveredLife ≈ AppliedPhysicalAttackDamage × LifeLeech/100 × MonsterDrain/100 / DifficultyDivisor`

Mana is analogous. Difficulty divisors are **1, 2, 3**, not 1,2,4:

| Difficulty | Leech retained |
|---|---:|
| Normal | 100% |
| Nightmare | 50% |
| Hell | 33 1/3% |

`Drain`, `Drain(N)`, `Drain(H)` are an additional target-specific multiplier in MonStats. Zero means unleechable; not all undead have zero drain. Only the attacking weapon's local leech applies.

Example: 900 physical dealt, 10% LL, monster drain 50, Hell → `900×0.10×0.50/3=15` life. With 1% LL, drain 100, Hell →3 life. **Do not first floor 1%/3 to zero**: classic source explicitly confirms 1% leech still works [LifeFAQ]. Exact fixed-point multiply/divide order is not fully proven here.

Do not apply a skill's weapon fraction twice to already fraction-adjusted physical damage based on a modern abbreviated leech formula. Smite cannot ordinary-leech; Berserk and Lightning Bolt's fully converted components cannot ordinary-leech.

**Life Tap:** approximately **50% of qualifying physical attack damage**, bypassing ordinary difficulty and monster drain penalties; works with Smite. Same 900 applied physical can yield 450 life, rather than 15. It is not ordinary LL and does not make elemental damage leechable.

---

## 5. Life, mana and stamina pools and regeneration

Sources: [Arreat characters][Characters], [classic life FAQ][LifeFAQ], [classic stamina FAQ][StaminaFAQ], [life/mana mechanics][LifeMana], [run/walk mechanics][RunWalk], [damage regeneration][Regen], [class data][D-char].

### 5.1 Class growth

Starting life/mana/stamina already include starting attributes. Per-Vit/per-Energy values apply to **additional** attributes; do not count starting attributes twice.

| Class | Start life | Life/level | Life/Vit | Start mana | Mana/level | Mana/Energy | Start stamina | Stam/level | Stam/Vit |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Amazon | 50 | 2 | 3 | 15 | 1.5 | 1.5 | 84 | 1 | 1 |
| Assassin | 50 | 2 | 3 | 25 | 1.5 | 1.75 | 95 | 1.25 | 1.25 |
| Barbarian | 55 | 2 | 4 | 10 | 1 | 1 | 92 | 1 | 1 |
| Druid | 55 | 1.5 | 2 | 20 | 2 | 2 | 84 | 1 | 1 |
| Necromancer | 45 | 1.5 | 2 | 25 | 2 | 2 | 79 | 1 | 1 |
| Paladin | 55 | 2 | 3 | 15 | 1.5 | 1.5 | 89 | 1 | 1 |
| Sorceress | 40 | 1 | 2 | 35 | 2 | 2 | 74 | 1 | 1 |

Maximum-life percentage effects apply to start life, level growth, **hard-point Vitality**, ordinary flat life and eligible quest life. Item Vitality and life-per-character-level are not boosted by the same % maximum-life stage. Mana/Energy has analogous exclusions. Preserve quarter-point class growth in fixed-point units. Stamina can include additional item Vitality; do not carry the life-% exclusion into its basic pool calculation.

### 5.2 Natural life regeneration and Replenish Life

Players have **zero natural life regeneration**. Replenish Life stat R is R bits/frame:

`LifePerSecond = 25R/256`

R=20 →1.953125 life/s; R=40 →3.90625. Negative values drain life (e.g. Malice). Prayer, potions, healing skills and life-per-kill are separate effects, not this passive regeneration constant.

### 5.3 Mana regeneration: retain the nested floors

The classic character table's base refill parameter is 120 seconds. Arreat's actual arithmetic:

`BaseBitsPerFrame = floor(256×MaxMana/(25×120))`

`BitsPerFrame = floor(BaseBitsPerFrame×(100+SumManaRegenerationPercent)/100)`

`ManaPerSecond = 25×BitsPerFrame/256`

Warmth, Meditation and item mana-regeneration percentages add in the regeneration-percent stat. Higher maximum mana also raises base regeneration. “Full in 120 seconds” is only nominal because of integer rounding.

**Example:** MaxMana 900; Warmth level 20 +258%, no other bonuses: base `floor(230400/3000)=76`; modified `floor(76×358/100)=272`; **26.5625 mana/s**. Do not move the percentage inside the first floor.

### 5.4 Monster/mercenary regeneration

`RegenBitsPerFrame = floor(MaxLifeBits × DamageRegen/4096)`

`LifePerSecond = RegenBitsPerFrame ×25/256`

| Unit examples | DamageRegen | Nominal fraction of maximum life/s |
|---|---:|---:|
| Many ordinary monsters | 2 | 1.220703125% |
| Act I/II/III mercenary | 4 | 2.44140625% |
| Act V mercenary | 10 | 6.103515625% |

No regeneration if the computed rate is under one bit/frame. Act bosses may explicitly have zero natural regeneration; do not give every boss ordinary monster regen. Poison/OW inhibit it. Prevent Monster Heal nominal duration is 80 minutes with important boss and attacker-type exclusions; the exact mercenary/Über restrictions need their original flags, not a generic “works on everything.”

Damage prevents regeneration on damage frames. A modern Basin revision describes an additional seven-frame inhibition in online LoD; **online versus single-player timing remains a blocker** pending original server/client verification [Regen]. Teleport-modifier healing is a separate effect, not regeneration.

### 5.5 Stamina regeneration

For S maximum stamina and H Heal Stamina %:

`IdleBitsPerFrame = floor(S×(100+H)/100)`

`WalkingBitsPerFrame = floor(floor(S/2)×(100+H)/100)`

`StaminaPerSecond = BitsPerFrame×25/256`

Without bonuses nominal full refill is 10.24s idle, 20.48s walking, with rounding. There is no regeneration during attacking/casting. Example S=167, H=52: walking `floor(83×1.52)=126` bits/frame →**12.3046875 stamina/s**.

Level-up, entering a game, healing NPCs and stamina potions refill stamina. A well restores 50%. Stamina potion supplies 30 seconds of no drain; repeated drinks add duration.

### 5.6 Running drain and movement: partially unresolved

The classic FAQ and modern run/walk guide publish a common body-armor drain expression:

`DrainBitsPerFrame ≈ floor(40 × (1+floor(ArmorPenalty/10)) × (100−SlowerStaminaDrain)/100)`

Modern guide adds a minimum one bit/frame. Under that formula: light/medium body armor drain 40 bits/frame =3.90625/s; heavy armor 80 =7.8125/s. Speed itself does not increase drain. Town running does not consume stamina.

**Two blockers prevent treating 40 as a universal 1.14 constant:**

1. Inspected CharStats has `RunDrain=20` for six classes but **15 for Assassin**. This suggests a class-sensitive stage (possibly 2×RunDrain), but no original code proof was obtained. Do not erase that difference or assert the inference as verified.
2. Arreat includes combined armor/shield penalty in its prose; the modern guide says body armor only. The classic FAQ only enumerates body armor. Test medium armor + medium shield and Assassin versus another class before fixing the drain function.

Stamina-shrine duration also differs between sources (classic FAQ about three minutes versus modern table 244 seconds); exact duration needs Shrines data/build validation.

Movement itself [RunWalk]: base walk 6 yards/s, run 9; equipment FRW uses diminishing returns, skill FRW is direct:

`EffectiveItemFRW = floor(150×ItemFRW/(150+ItemFRW))`

`SpeedBonus = EffectiveItemFRW + SkillFRW − BodyArmorPenalty − ShieldPenalty − applicable slows`

`WalkSpeed = max(6×(100+SpeedBonus)/100,1.5)`

`RunSpeed = max(9+6×SpeedBonus/100,1.5)`

Body armor and shield movement penalties are individually light 0, medium 5, heavy 10. Item FRW 100 gives 60 effective: without other modifiers walk 9.6, run 12.6 yards/s, not run 14.4.

---

## 6. Experience, level-ups, death, gold and corpses

Sources: [Arreat experience][Experience], [Basin experience][BasinXP], [classic experience FAQ][ExpFAQ], [classic monster tests][MonTests], [character death rules][Characters], [Experience data][D-exp].

### 6.1 Monster experience and operation order

For ordinary ratio-scaled monsters:

`BaseXP = floor(MonLvl[baseMonsterLevel].L-XP[difficulty] × MonStats.Exp[difficulty]/100)`

Then apply player-count bonus `(players+1)/2`, eligible monster XP bonus, party bonus/share, per-kill ceiling, character-versus-monster level adjustment, clvl ExpRatio, then Experience Gained bonuses.

**Do not use elite-boosted level for base XP lookup.** Champion/Unique bonuses are applied separately. This differs from damage/AR level lookup (§7). Champion XP ×3, Berserker ×5, Unique/minion ×5; act bosses use their own data rather than automatic Unique ×5.

Only qualifying kills award XP. Mercenary/pet kills give owner XP without stealing a share; returned damage can award it. Resurrected monsters generally do not award XP a second time, but Reanimated Horde is an important exception described by Basin. Spawner-created creatures and static objects have explicit exceptions; do not award all MonStats rows XP indiscriminately [BasinXP].

**Ceiling:** after party share, XP from a kill is capped at **8,388,607**, before later level penalties/bonuses. This causes solo Hell Baal XP to stop increasing at players 3, and Hell Diablo at players 7 [BasinXP].

### 6.2 Level-difference coefficients: use /256, not rounded percentages

Let Δ=`monsterLevel−characterLevel` for the level-adjustment stage.

| Δ | Character <25: coefficient /256 | Exact retained % |
|---|---:|---:|
| ≥+10 | 5 | 1.953125 |
| +9 | 38 | 14.84375 |
| +8 | 92 | 35.9375 |
| +7 | 174 | 67.96875 |
| +6 | 225 | 87.890625 |
| −5 through +5 | 256 | 100 |
| −6 | 207 | 80.859375 |
| −7 | 159 | 62.109375 |
| −8 | 110 | 42.96875 |
| −9 | 61 | 23.828125 |
| ≤−10 | 13 | 5.078125 |

For **clvl ≥25**:

- Higher-level monster: multiply by `clvl/mlvl`.
- Equal through five levels lower: full XP.
- Six/nine/ten+ lower: the same 207/159/110/61/13 coefficients.
- Then apply the independent high-character-level ratio below.

**Integer order from Basin:** for XP >1,048,576, level-ratio operations divide first (`floor(XP/mlvl)×clvl`, or `floor(XP/256)×coefficient`); at smaller amounts multiply first then divide. Preserve the branch at the threshold.

**Level-identity conflict:** classic 2010 experiments report using **base monster level** for the level ratio as well as base XP; the current Basin XP page says **modified elite level**, and even lists Berserker +3 unlike Arreat's Champion +2. Base XP lookup is strongly supported as base-level. **The elite level used in XP penalties is not claimed resolved here**; target-build tests near the +5/+6 and −9/−10 boundaries are required. Hit chance/drop ilvl use modified level.

### 6.3 High-character-level penalties

`HighLevelFactor = ExpRatio[clvl]/1024`

| clvl | Ratio | Retained % | clvl | Ratio | Retained % | clvl | Ratio | Retained % |
|---|---:|---:|---|---:|---:|---|---:|---:|
| 70 | 976 | 95.3125 | 80 | 496 | 48.4375 | 90 | 61 | 5.95703125 |
| 71 | 928 | 90.625 | 81 | 448 | 43.75 | 91 | 46 | 4.4921875 |
| 72 | 880 | 85.9375 | 82 | 400 | 39.0625 | 92 | 35 | 3.41796875 |
| 73 | 832 | 81.25 | 83 | 352 | 34.375 | 93 | 26 | 2.5390625 |
| 74 | 784 | 76.5625 | 84 | 304 | 29.6875 | 94 | 20 | 1.953125 |
| 75 | 736 | 71.875 | 85 | 256 | 25 | 95 | 15 | 1.46484375 |
| 76 | 688 | 67.1875 | 86 | 192 | 18.75 | 96 | 11 | 1.07421875 |
| 77 | 640 | 62.5 | 87 | 144 | 14.0625 | 97 | 8 | 0.78125 |
| 78 | 592 | 57.8125 | 88 | 108 | 10.546875 | 98 | 6 | 0.5859375 |
| 79 | 544 | 53.125 | 89 | 81 | 7.91015625 | 99 | 5 | Already max level |

Below 70 ratio is 1024. According to the technical XP page, divide-first versus multiply-first threshold for this stage is **2,097,152**: below it `floor(XP×Ratio/1024)`, at/above it `floor(XP/1024)×Ratio`. Even the ratio-1024 stage can discard low bits at sufficiently high XP; do not optimize it away indiscriminately [BasinXP].

Examples after earlier XP stages:

- clvl 20 killing ordinary mlvl 30 with 10,000 XP: `floor(10000×5/256)=195`, not 200.
- clvl 80, ordinary mlvl 85, XP 100,000: level factor `floor(100000×80/85)=94117`; high factor `floor(94117×496/1024)=45587`.
- clvl 90 against ordinary mlvl 85, XP 100,000: no lower-monster penalty at −5; high factor →5,957.
- Same character against ordinary mlvl 84: `floor(100000×207/256)=80859`, then `floor(80859×61/1024)=4816`.

Experience Shrine +50%, Annihilus +5–10%, Ondal's Wisdom +5% are final Experience Gained modifiers, not extra party members or MF.

### 6.4 Party sharing: 1.14 is not exactly +35%

Classic 1.11+ uses **87/256 =33.984375% per additional qualifying nearby party member**, not exact 35%. 1.10 used 89/256; Arreat's “35%” is a rounded/outdated summary [BasinXP].

Radius **53 1/3 yards** around the killer; when a mercenary/pet kills, measure from its owner. Only qualifying nearby party members receive a share; not everyone in the same act. Approximate “two screens” is insufficient for exact geometry.

Without signed overflow:

`PartyBonus = floor((Members−1)×XP×87/256)`

`PartyPool = XP + PartyBonus`

Distribute according to `clvl / sum(clvl of qualifying nearby members)`, with the original divide/multiply order and floors. The exact share operation described in Basin divides pool by summed levels before multiplying character level; fractional rounding is therefore material.

Example XP 10,000, nearby party levels 40 and 60: bonus `floor(10000×87/256)=3398`; pool13,398; divide-first `floor(13398/100)=133`; shares 5,320 and 7,980 before each character's own penalties. A rational presentation 40%/60% would give different integers; do not preserve the remainder by assumption.

**Classic signed 32-bit overflow matters:** the intermediate `(Members−1)×XP×87` can overflow; Basin documents the notorious Baal-wave XP bug and an `abs`/signed calculation. A faithful emulator needs the original signed-width behavior, not arbitrary precision and not a smooth 35% factor. Exact sign/absolute/division sequence remains a validation blocker.

Mercenary XP is separately computed and does not reduce player party shares. Mercenaries receive XP from themselves/owner/owner's pets, not another party member's kills.

### 6.5 Player thresholds and level-ups

Maximum player level **99**. Each level grants **5 stat points and 1 skill point**, class life/mana/stamina growth, and full resource refill.

**Data index trap:** in the inspected mirror, row `Level=1` contains 500, the XP to **enter level 2**. Threshold to enter level L is class XP from **row L−1**, while `ExpRatio` is indexed by current clvl. Row98 is max-level threshold 3,520,485,254; row99's 3,837,739,017 is not the required threshold for level99.

| Enter level | Total XP | Enter level | Total XP |
|---|---:|---|---:|
| 1 | 0 | 80 | 681,027,665 |
| 2 | 500 | 85 | 1,050,299,747 |
| 10 | 57,715 | 90 | 1,618,470,619 |
| 20 | 537,513 | 91 | 1,764,543,065 |
| 25 | 1,640,359 | 92 | 1,923,762,030 |
| 30 | 4,663,553 | 93 | 2,097,310,703 |
| 40 | 17,270,791 | 94 | 2,286,478,756 |
| 50 | 47,116,709 | 95 | 2,492,671,933 |
| 60 | 117,772,849 | 96 | 2,717,422,497 |
| 70 | 285,041,630 | 97 | 2,962,400,612 |
| 71 | 311,105,466 | 98 | 3,229,426,756 |
| 72 | 339,515,048 | 99 | 3,520,485,254 |

Use the complete table, not an invented closed-form growth equation [D-exp].

### 6.6 Death XP, gold and corpse recovery

Death XP loss is 0%/5%/10% in Normal/Nightmare/Hell of the **XP required between current and next level**, not total accumulated XP. Clamp loss to current-level threshold; no de-leveling. Recovering the corpse at the death location in the same game returns **75% of actually lost XP**. Save/exit and collecting the town corpse returns **none**.

Example level90 gap: `1764543065−1618470619=146072446`. Hell nominal loss `floor(0.10×146072446)=14607244`, unless current XP above threshold is smaller. In-world retrieval restores approximately10,955,433 (75%), leaving3,651,811 lost. Repeated deaths have repeated penalties; record actual loss per corpse.

**Gold [Characters]:**

- Multiplayer penalty `min(clvl,20)%` of carried **plus stash** gold. Deduct carried first, then stash if needed; remaining carried gold falls on the ground.
- Single-player stash is protected; 500 carried gold per character level is exempt from death loss. Exact interaction of that exemption with the penalty arithmetic remains to be verified.
- Example multiplayer clvl30, carried10,000 and stash90,000: penalty20,000; carried10,000 consumed and stash10,000 consumed; no carried remainder drops.
- Single-player clvl10 carrying5,000 illustrates its protected carried allowance. There is no D2R shared stash.

**Corpses:** equipped gear remains on the body; unequipped inventory remains with the living character. Retrieval re-equips items when requirements/space allow, otherwise moves eligible items to inventory or leaves them on the body. Allow up to16 corpses; on a subsequent death beyond the corpse limit equipped items can drop publicly. Only owner or authorized party looting may retrieve corpse equipment.

Arreat distinguishes persistence modes: on a realm, only the corpse with the **highest NPC-gold-value equipment** persists after save/exit; Open/single-player retains **oldest corpse**, not automatically the “best” one. Rejoin places that corpse in town; no XP restoration, and ground gold is lost. Re-equipping replacement gear before recovering original bodies is dangerous and must not be simplified into automatic inventory merging. Hardcore death is permanent.

---

## 7. Area levels, monster scaling and elite modifiers

Sources: [Arreat monster basics][MonBasics], [Arreat modifier tables][MonBonus], [classic empirical monster analysis][MonTests], [classic boss FAQ][BossFAQ], [MonStats/MonLvl/Levels/SuperUniques][D-mon][D-lvl][D-area][D-su].

### 7.1 Separate base level, effective level and stat lookup level

- Normal ordinary monster base level usually comes from `MonStats.Level`, **not area level**.
- Nightmare/Hell ordinary base level generally comes from `Levels.MonLvl2Ex/MonLvl3Ex`.
- Champions normally +2 effective level; Unique/minion +3.
- Act bosses retain their fixed MonStats levels. Other `boss`, `noRatio`, quest and Super Unique cases require their own flags; do not promote every gold-name enemy by +3 or set every one to area level.
- Ordinary Super Uniques can follow area-derived level rules while keeping fixed TCs. **“All Super Uniques have fixed level” and “all can TC-upgrade” are both unsafe.**

**Crucial classic stat distinction [MonTests]:**

| Statistic/function | Champion | Unique/minion |
|---|---|---|
| Defense MonLvl lookup | Base level | Base level |
| Maximum-life MonLvl lookup | Base level | Base level |
| Base-XP MonLvl lookup | Base level | Base level |
| AR MonLvl lookup | Base+2 | Base+3 |
| Damage MonLvl lookup | Base+2 | Base+3 |
| Hit chance attacker/defender level | Effective level | Effective level |
| Item drop ilvl | Effective level | Effective level |
| XP level-penalty identity | Conflicting evidence; see §6.2 | Same blocker |

Use **`L-` expansion columns** in MonLvl, with the corresponding difficulty suffix, for ordinary LoD statistics. Non-expansion columns are not interchangeable; doll death damage is a documented special exception.

Typical base statistics:

`LifeEndpoint = floor(MonLvl[base].L-HP[d] × MonStats.HPEndpoint[d]/100)`

`Defense = floor(MonLvl[base].L-AC[d] × MonStats.AC[d]/100)`

`AR = floor(MonLvl[effective].L-TH[d] × MonStats.AttackTH[d]/100)`

`DamageEndpoint = floor(MonLvl[effective].L-DM[d] × MonStats.AttackDamageEndpoint[d]/100)`

`BaseXP = floor(MonLvl[base].L-XP[d] × MonStats.Exp[d]/100)`

Use attack A1/A2/skill parameters separately. Missing/omitted JSON zero is zero, not “reuse Normal.” `noRatio` units need their special direct-stat interpretation.

### 7.2 MonLvl anchor table

Each tuple is **[HP, damage, AR, defense, XP]** from expansion `L-` columns, before MonStats percentage factors [D-lvl]. The full original table is required for intermediate levels.

| Level | Normal | Nightmare | Hell |
|---|---|---|---|
| 1 | [7,2,8,6,30] | [107,3,108,108,78] | [1107,4,216,173,117] |
| 10 | [35,7,89,60,120] | [164,9,270,216,312] | [1376,13,558,331,468] |
| 20 | [73,13,199,120,300] | [228,17,450,336,779] | [1676,24,938,507,1169] |
| 30 | [134,19,309,180,659] | [320,25,630,456,1709] | [1976,35,1318,683,2564] |
| 40 | [215,25,419,240,1297] | [661,33,810,576,3365] | [2276,46,1698,859,5048] |
| 50 | [310,31,529,300,2317] | [1003,41,990,696,6618] | [2576,57,2078,1035,9927] |
| 60 | [418,37,639,360,3357] | [1344,49,1170,816,11964] | [3307,68,2458,1211,17946] |
| 67 | [501,41,716,402,4085] | [1583,55,1296,900,17822] | [4112,76,2724,1334,26733] |
| 70 | [539,43,749,420,4397] | [1685,57,1350,936,20540] | [4457,80,2838,1387,30810] |
| 80 | [673,49,859,480,5437] | [2027,65,1530,1056,29600] | [5607,91,3218,1563,44400] |
| 85 | [746,52,914,510,5957] | [2197,69,1620,1116,34130] | [6182,96,3408,1651,51195] |
| 88 | [790,54,947,528,6269] | [2300,72,1674,1152,36848] | [6527,100,3522,1704,55272] |
| 90 | [821,55,969,540,6477] | [2368,73,1710,1176,38660] | [6757,102,3598,1739,57990] |
| 99 | [964,60,1068,594,7413] | [2675,80,1872,1284,46814] | [7792,111,3940,1898,70221] |

### 7.3 Player-count scaling and rounding

Life and XP player multiplier:

`G = (players+1)/2`, players1–8 →1,1.5,2,2.5,3,3.5,4,4.5.

Life player-count is determined when spawned; changing /players does not retroactively rescale existing monsters. Ordinary monster AR/damage can gain **6.25% per additional player** in Nightmare/Hell Ladder and single-player, according to classic technical tests. Do **not** indiscriminately apply that to Normal, non-ladder realms, every skill/missile damage source or enchantment damage [MonTests]. Resistances are not generically raised with players.

**Life rounding:** base life is whole-point floored; player scaling is again whole-point floored; elite life multiplier then acts in bits [MonTests]:

`BasePoints = floor(MonLvlHP × MonStatsHP/100)`

`GamePoints = floor(BasePoints × G)`

`FinalLifeBits = floor(GamePoints ×256 × EliteLifeMultiplier)`

The final elite stage can preserve half/quarter points, unlike a floor to whole life after every factor.

Example Nightmare base999 HP, players1, Champion ×2.5: **2,497.5 actual life**, panel2497. Base749, players2 gives `floor(749×1.5)=1123`, not1123.5, before elite multiplication.

### 7.4 Elite life, XP and Champion variants

| Kind | Life multiplier N / NM / H | XP multiplier | Effective level boost |
|---|---|---:|---:|
| Normal | 1 / 1 / 1 | 1 | 0 |
| Minion | 2 / 1.75 / 1.5 | 5 | +3 |
| Random Unique | 4 / 3 / 2 | 5 | +3 |
| Standard Champion | 3 / 2.5 / 2 | 3 | +2 |
| Berserker | 0.75 / 0.625 / 0.5 | 5 | Normally +2; conflicting current XP table noted |
| Possessed | 6 / 5 / 4 | 3 | +2 |
| Ghostly / Fanatic | 3 / 2.5 / 2 | 3 | +2 |

20% of random elite packs are Champion,80% Unique. Champions spawn2–4: all but one ordinary Champions; the final slot has equal chance of five Champion subtypes. Uniques normally3–6 minions. Random Unique modifiers typically1/2/3 in N/NM/H, subject to eligibility. Super Uniques add difficulty-dependent random modifiers to preset modifiers rather than discarding presets [MonBonus].

| Champion subtype | Damage bonus N/NM/H | AR bonus N/NM/H | Other effects |
|---|---|---|---|
| Standard | +90/+75/+66% | +67/+56/+49% | +20 movement-speed stat |
| Ghostly | Same | Same | Physical resistance **set80%**, even if “Immune to Physical” label remains; cold damage33–50% of appropriate MonLvl damage base; cold length150 frames |
| Fanatic | Same | Same | +100 movement-speed stat; −70% defense, not flat−70 defense or AR |
| Berserker | +270/+225/+198% | +270/+225/+198% | Quarter Champion life; XP×5; no verified general IAS bonus |
| Possessed | Same as standard | Same | Double Champion life; +20 movement; uncursable except Battle Cry/Cloak of Shadows stat effects |

No general Champion attack-speed increase was measured in classic tests. Ghostly “half speed”/−33 movement claims conflict with empirical tests showing ordinary movement; **Ghostly speed remains a blocker**. Champion ED is halved again for Willowisp melee physical damage since1.13.

**Monster example:** Hell Blood Moor Fallen base level67. HPEndpoints25–55%, defense70%, Exp65%, attack damage45–90%, AR90%: life1028–2261, defense933, ordinary damage34–68, AR2451, XP17376 before other modifiers. Resistances include fire100, cold40, physical15; Drain75, DamageRegen2. Its Unique version does **not** recompute HP/defense/base XP at70, but its AR/damage use70 and its hit/drop level is70 [D-mon][D-lvl].

### 7.5 Full ordinary random Unique modifier list

Read MonUMod eligibility/exclusions and modifier order, not just names. Its `constants` descriptions are independent columns, **not** a one-to-one description of the modifier ID on the same row [D-mod].

| Modifier | Established classic effect | Minion effect / restrictions |
|---|---|---|
| Extra Strong | Unique ED+135/+112/+99%; AR+90/+75/+66% N/NM/H | ED+67/+56/+49%; AR+45/+37/+33%. Aura ED adds to same ED stat; Willowisp melee ED halved again. |
| Extra Fast | +100 movement-speed stat | Same; not automatic attack IAS. Requires movable unit. |
| Cursed | 75% on qualifying attack/missile hit to cast Amp at `floor(mlvl/5)+1` | Not a blanket minion curse proc. |
| Cold Enchanted | Cold66–100% of relevant MonLvl damage base; cold resist+75; cold length`100+5mlvl` frames; death coldunique nova level`floor(mlvl/2)` | NM/H minion cold33–50%; Normal minions may apply cold length without cold damage, especially missiles. |
| Fire Enchanted | Fire66–100% MonLvl damage base; fire resist+75; death physical/fire explosion | NM/H minion fire33–50%; explosion details below. |
| Lightning Enchanted | Lightning66–100% MonLvl damage base; lightning resist+75; eight lightunique bolts on eligible hit/recovery, level`floor(mlvl/2)`, damage`2s−1` each | NM/H minion lightning33–50%; excluded for Sand Leapers. |
| Magic Resistant | Cold,fire,lightning +40 in that order, only if each prior resistance<100 | Cannot be randomly selected Normal; can be fixed on Super Unique. Does **not** raise magic resistance. |
| Mana Burn | Mana damage66–100% MonLvl damage base; magic resist+20 | NM/H minion mana33–50%; difficulty negative resistance multiplies mana damage1.4/2; **melee bug×256**. Crit does not generally double mana damage. |
| Multishot | Triples eligible missiles | Not all monster types/missiles; isMelee/nomultishot/NoMultiShot flags exclude it. Does not triple LE bolts in1.10+. |
| Spectral Hit | Each attack adds random magic/fire/lightning/cold/poison66–100% MonLvl damage base; cold/poison40 frames | Minions do not receive the random elemental hit. Resistance amount conflicting; see below. |
| Stone Skin | Physical resist+50; base defense×2 before global percentages | Unique-only defense increase; do not inherit everything to minions. |
| Teleportation | Teleports under low-life/AI conditions, usually below30% or close-range pressure for ranged AI | Healing amount/function **unknown**; do not invent a full heal. Requires eligible movable/teleportable unit. |
| Aura Enchanted | Paladin aura at levels in next table | Allies receive applicable aura; aura owner Fanaticism uses party ED, not player self ED. |

Enchantment added damage is based on **MonLvl damage**, not “take fully ED-enhanced physical weapon damage and add66–100%.” It does not grow with player-count physical scaling, while applicable monster Crit can double elemental damage [MonTests].

**Spectral Hit resistance conflict:** updated Arreat lists +40 cold/fire/lightning if prior resistance<75; the classic2010 analysis lists **+20** under the same condition. This is an explicit blocker requiring MonUMod constant/function validation, not a choice justified by newer publication alone. The two-immunity limit and ordered application are established.

Aura selection, minimum level1:

| Aura | Skill level |
|---|---|
| Might / Holy Fire | `max(floor(mlvl/6),1)` |
| Blessed Aim | `max(floor(mlvl/5),1)` |
| Holy Freeze | `max(floor(mlvl/7),1)` |
| Holy Shock / Conviction / Fanaticism | `max(floor(mlvl/8),1)` |

Holy Shock requires mlvl≥20. Might ED `40+10(s−1)`; Blessed Aim AR`75+15(s−1)`; Fanaticism player self ED`50+17(s−1)`, party ED`floor(selfED/2)` and AR`40+5(s−1)`. Aura skill damage/IAS/slow functions must come from classic Skills, not approximated linear tables [PalOff].

**Resistance assignment:** applied in displayed modifier order; skip a resistance increase that would create a third immunity or raise an existing immunity when already at least two. Magic Resistant/Spectral Hit apply cold,then fire,then lightning. A modifier's visible presence does not prove every resistance component was applied.

#### Fire Enchanted death explosion and classic combined-enchantment bugs

Maximum base life H is that of an ordinary monster at the **Unique effective level**, without player-count or elite-life factors. Approximate ranges after1.13 reduction [MonBonus][MonTests]:

| Difficulty | Physical component | Equal fire component | Combined | Radius |
|---|---|---|---|---|
| Normal | 5.625–9.375% H | Same | 11.25–18.75% H | 2 2/3 yd |
| Nightmare | 3.5–5.833…% H | Same | 7–11.666…% H | 3 1/3 yd |
| Hell | 0.375–0.625% H | Same | 0.75–1.25% H | 4 yd |

The technical derivation contains integer/random stages, e.g. base max-life, DifficultyLevels CE factor50/35/20, a60–100% roll, split factors, Hell-only quarter reduction and1.13 reductions3/4,2/3,1/2. **These decimal bounds are not a verified exact RNG function.** Crit can double damage; shield/Weapon Block and Avoid/Evade can apply; player level difference, player count and ordinary monster ED do not scale it.

Classic bugs documented [BossFAQ]: FE+CE can trigger each death effect twice; FE+LE can trigger invisible fire explosion during recovery; CE+LE can trigger invisible cold nova; all three can combine these behaviors. The lethal Nightmare FE history and exact1.13/1.14 callback ordering need executable regression tests, not accidental D2R fixes.

**Doll explosion special case:** uses **non-expansion HP columns** in MonLvl even in LoD, effective elite level, no elite/player-count life multiplier, physical damage only, Crit can double, shield block applies. Do not reuse the living monster's actual max-life pool [MonTests].

### 7.6 Super Uniques, minions and hardcoded modifiers

SuperUniques provides base class, preset `Mod1/2/3`, minion bounds and fixed difficulty TCs. Spawn placement/localization matters; some of its66 rows are unused and must not all spawn. `MonStats.boss` and `primeevil` are separate classifications. The five act bosses, quest bosses and Putrid Defilers are not just random Unique packs [BossFAQ].

Representative and active fixed modifiers inspected in [D-su]; minion numbers are table bounds, not a promise that collision/AI always places every one:

| Encounter | Fixed modifiers | Minions |
|---|---|---:|
| Bishibosh | Magic Resistant, Fire Enchanted | 2 |
| Bonebreak | Extra Strong, Magic Resistant | 5 |
| Coldcrow | Cold Enchanted | 4 |
| Rakanishu | Lightning Enchanted, Extra Fast | 8 |
| Treehead WoodFist | Extra Strong, Extra Fast | 2 |
| Griswold | Cursed | 0 |
| Countess | Fire Enchanted | 6 |
| Pitspawn Fouldog | Cursed, Cold Enchanted | 4 |
| Bone Ash | Magic Resistant, Extra Strong, Cold Enchanted | 0 |
| Radament | Extra Fast | 3 |
| Bloodwitch | Extra Strong, Cursed | 5 |
| Fangskin | Lightning Enchanted, Extra Fast | 4 |
| Beetleburst | Magic Resistant | 3 |
| Creeping Feature | Extra Strong, Cold Enchanted | 5 |
| Coldworm | Cold Enchanted, Magic Resistant | 0 |
| Fire Eye | Fire Enchanted, Extra Fast | 3 |
| Dark Elder | Extra Fast, Magic Resistant | 4 |
| Summoner | Extra Strong, Extra Fast internal presets | 0 |
| Ancient Kaa | Mana Burn, Extra Strong, Lightning Enchanted | 3 |
| Smith | Extra Strong | 0 |
| Witch Doctor Endugu | Magic Resistant, Fire Enchanted | 6 |
| Stormtree | Extra Fast, Lightning Enchanted | 4 |
| Battlemaid Sarina | Extra Fast, Spectral Hit | 9 |
| Icehawk Riftwing | Cold Enchanted, Teleportation | 7 |
| Ismail | Extra Fast, Cursed | 2 |
| Geleb | Extra Strong, Fire Enchanted | 2 |
| Bremm | Aura Enchanted, Lightning Enchanted | 2 |
| Toorc | Cold Enchanted, Stone Skin | 0 |
| Wyand | Mana Burn, Teleportation | 0 |
| Maffer | Extra Strong, Extra Fast | 0 |
| Infector of Souls | Extra Fast, Spectral Hit | 9 |
| Lord De Seis | Extra Strong, Aura; internal thief preset | 5 |
| Grand Vizier | Extra Strong, Fire Enchanted | 9 |
| Cow King | Magic Resistant, Lightning Enchanted | 6 |
| Corpsefire | Spectral Hit | 5 |
| Hephasto | Spectral Hit, Aura Enchanted | 0 |
| Shenk | Extra Strong | 0 |
| Bonesaw Breaker | Extra Strong, Magic Resistant | 5 |
| Dac Farren | Cold Enchanted | 4 |
| Eldritch | Extra Fast; internal random-name preset | 8 |
| Eyeback | Extra Strong, Extra Fast | 2 |
| Thresh Socket | Cursed | 0 |
| Pindleskin | **Fire Enchanted** | 6 |
| Snapchip Shatter | Cursed, Cold Enchanted | 4 |
| Frozenstein | Cold Enchanted, Mana Burn | 5–6 |
| Nihlathak | Quest AI/functions, no ordinary preset Mod fields | 0 |
| Colenzo / Achmel / Bartuc / Ventar / Lister | Fire / fixed poison-hit / Lightning / Extra Fast / Spectral respectively | 5 / 3 / 5 / 8 / 5 |

Poison Enchanted is **not an ordinary random Unique modifier**. Achmel's poison-hit and Coldworm's poison cloud require their fixed skills/functions. Exact poison-enchantment formulas, internal thief/death/quest functions and all inactive-row behavior remain outside verified coverage. “Full modifier list” above means the complete ordinary random gameplay list, not all engine MonUMod IDs are fully decoded.

### 7.7 Act bosses

| Boss | Fixed level N/NM/H | Hell physical | Fire | Lightning | Cold | Poison | Magic | Hell drain |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| Andariel | 12/49/75 | 66 | −50 | 66 | 66 | 66 | 0 | 33 |
| Duriel | 22/55/88 | 50 | 75 | 75 | 95 | 75 | 33 | 100 |
| Mephisto | 26/59/87 | 20 | 75 | 75 | 75 | 75 | 50 | 0 |
| Diablo | 40/62/94 | 45 | 50 | 50 | 50 | 50 | 0 | 0 |
| Baal | 60/75/99 | 50 | 50 | 50 | 50 | 50 | 0 | 20 |

All five inspected act-boss rows are `primeevil=1`, including Andariel/Duriel; that flag is not synonymous with story “Prime Evils.” Baal HP factor6336%: Hell base `floor(7792×6336/100)=493701` at players1. Do not use Catacombs4 area73 as Hell Andariel's level: she is75. A historical quality example using78 does not override the actual row [D-mon].

### 7.8 Original LoD area-level tables

Numbers are **area levels N/NM/H**, not guaranteed Normal monster levels or act-boss levels [D-area][ExpFAQ]. Grouped rows have identical values. Towns and unused map rows are omitted. Preserve original internal level IDs when localizing.

#### Act I

| Area | N | NM | H |
|---|---:|---:|---:|
| Blood Moor | 1 | 36 | 67 |
| Cold Plains | 2 | 36 | 68 |
| Stony Field | 4 | 37 | 68 |
| Dark Wood | 5 | 38 | 68 |
| Black Marsh | 6 | 38 | 69 |
| Tamoe Highland | 8 | 39 | 69 |
| Den of Evil | 1 | 36 | 79 |
| Cave1 / Cave2 | 2 / 2 | 36 / 37 | 77 / 78 |
| Underground Passage1 / 2 | 4 / 4 | 37 / 38 | 69 / 83 |
| Hole1 / 2 | 5 / 5 | 38 / 39 | 80 / 81 |
| Pit1 / 2 | 7 / 7 | 39 / 40 | 85 / 85 |
| Burial Grounds | 3 | 36 | 80 |
| Crypt / Mausoleum | 3 / 3 | 37 / 37 | 83 / 85 |
| Tower Cellar1–5 | 7 each | 38,39,40,41,42 | 75,76,77,78,79 |
| Monastery Gate | 8 | 40 | 70 |
| Outer Cloister / Barracks | 9 | 40 | 70 |
| Jail1–3 | 10 | 41 | 71 |
| Inner Cloister | 10 | 41 | 72 |
| Cathedral | 11 | 42 | 72 |
| Catacombs1 | 11 | 42 | 72 |
| Catacombs2 | 11 | 42 | 73 |
| Catacombs3–4 | 12 | 43 | 73 |
| Tristram | 6 | 39 | 76 |
| Secret Cow Level | 28 | 64 | 81 |

#### Act II

| Area | N | NM | H |
|---|---:|---:|---:|
| Rocky Waste | 14 | 43 | 75 |
| Dry Hills | 15 | 44 | 76 |
| Far Oasis | 16 | 45 | 76 |
| Lost City | 17 | 46 | 77 |
| Valley of Snakes | 18 | 46 | 77 |
| Canyon of the Magi | 16 | 48 | 79 |
| Sewers1–2 / 3 | 13 / 14 | 43 / 44 | 74 / 75 |
| Harem and Palace Cellar1–2 | 13 | 47 | 78 |
| Palace Cellar3 | 13 | 48 | 78 |
| Stony Tomb1 / 2 | 12 / 12 | 44 / 44 | **78 / 79** |
| Halls of the Dead1 / 2 / 3 | 12 / 13 / 13 | 44 / 45 / 45 | 79 / 81 / 82 |
| Claw Viper Temple1 / 2 | 14 / 14 | 47 / 47 | 82 / 83 |
| Maggot Lair1–2 / 3 | 17 / 17 | 45 / 46 | 84 / 85 |
| Ancient Tunnels | 17 | 46 | 85 |
| Tal Rasha's seven tombs / Duriel's Lair area | 17 | 49 | 80 |
| Arcane Sanctuary | 14 | 48 | 79 |

Stony Tomb is not D2R's newly raised85. Duriel remains fixed boss level88 in Hell despite area80.

#### Act III

| Area | N | NM | H |
|---|---:|---:|---:|
| Spider Forest | 21 | 49 | 79 |
| Great Marsh | 21 | 50 | 80 |
| Flayer Jungle | 22 | 50 | 80 |
| Lower Kurast | 22 | 52 | 80 |
| Kurast Bazaar | 22 | 52 | 81 |
| Upper Kurast | 23 | 52 | 81 |
| Kurast Causeway | 24 | 53 | 81 |
| Travincal | 24 | 54 | 82 |
| Arachnid Lair / Spider Cavern | 21 | 50 | 79 |
| Swampy Pit1 / 2 / 3 | 21 each | 51 each | 80 / 81 / 82 |
| Flayer Dungeon1 / 2 / 3 | 22 each | 51 each | 81 / 82 / 83 |
| Sewers1 / 2 | 23 / 24 | 52 / 53 | 84 / 85 |
| Ruined Temple / Disused Fane / Forgotten Reliquary | 23 | 53 | 84 |
| Forgotten Temple / Ruined Fane / Disused Reliquary | 24 | 54 | 85 |
| Durance of Hate1–3 | 25 | 55 | 83 |

#### Acts IV–V

| Area | N | NM | H |
|---|---:|---:|---:|
| Outer Steppes | 26 | 56 | 82 |
| Plains of Despair | 26 | 56 | 83 |
| City of the Damned | 27 | 57 | 84 |
| River of Flame | 27 | 57 | 85 |
| Chaos Sanctuary | 28 | 58 | 85 |
| Bloody Foothills | 24 | 58 | 80 |
| Frigid Highlands | 25 | 59 | 81 |
| Arreat Plateau | 26 | 60 | 81 |
| Crystalline Passage | 29 | 61 | 82 |
| Frozen River / Glacial Trail | 29 | 61 | 83 |
| Drifter Cavern | 29 | 61 | 84 |
| Frozen Tundra | 27 | 60 | 81 |
| Ancients' Way | 29 | 62 | 82 |
| Icy Cellar | 29 | 62 | 83 |
| Arreat Summit | 37 | 68 | 87 |
| Nihlathak's Temple | 32 | 63 | 83 |
| Halls of Anguish | 33 | 63 | 83 |
| Halls of Pain | 34 | 64 | 84 |
| Halls of Vaught | 36 | 64 | 84 |
| Abaddon / Pit of Acheron / Infernal Pit | 39 each | 60 / 61 / 62 | 81 / 82 / 83 |
| Worldstone Keep1 / 2 / 3 | 39 / 40 / 42 | 65 / 65 / 66 | 85 each |
| Throne of Destruction / Worldstone Chamber | 43 | 66 | 85 |
| Matron's Den / Forgotten Sands / Furnace of Pain / Über Tristram | Not ordinarily accessible | Not ordinarily accessible | 83 |

Über areas require original realm/event mode access rules; their boss level110 is not their area level83. No Terror Zones.

---

## 8. Treasure classes, item quality, MF/GF, quests and runes

Sources: [classic TC guide][TC-guide], [ItemRatio code analysis][Quality], [classic item-generation tutorial][ItemGen], [NoDrop formula quotation][NoDrop], [pinned TC data][D-tc], [ItemRatio data][D-ratio], [Hellforge][Forge].

### 8.1 Recursive treasure-class structure

A TC row has its name, optional group/level, Picks, quality modifiers, NoDrop and up to10 item-or-child-TC entries with integer weights. Treat it as a recursive graph, not a flat “monster item rarity” table.

- **Positive Picks:** independent weighted attempts from NoDrop and entries; an empty result consumes its attempt. A selected child TC executes its own Picks.
- **Negative Picks:** deterministic ordered entry invocations/counts, using Prob fields as quantities and `abs(Picks)` as the selection budget. Countess−2 invokes its item child then its rune child once each; each child's own picks still run.
- Ordinary monster drop processing has a **six actual-item cap**. Act boss7 attempts stop after6 real items. A potion/gold/key/rune consumes an actual-item slot where applicable.
- NoDrop is a weight, not a percent and not an automatic retry after every failure.
- Nested quality manipulators inherit the **largest factor seen per quality along the selected path**, not sum, first-only or last-only [Quality].

Champion/Unique special roots also include potion branches: do not flatten only the visible equip child and omit potions. Some quest skills/chests use additional routines beyond ordinary monster TC handling.

### 8.2 NoDrop and nearby-party weighting

Let `S = sum(Prob1…Prob10)` for actual entries, `N = original NoDrop`.

`q = N/(N+S)`

`e = trunc(1 + AdditionalPlayers/2 + ClosePartiedOtherPlayers/2)`

AdditionalPlayers means all other game players; nearby partied players appear in that total **and** the extra close-party term. Equivalently, each nearby party companion contributes1, each other game player contributes1/2 before final truncation. A sole killer starts at1 [NoDrop][ItemGen].

`NewNoDrop = floor(S / (1/q^e −1)) = floor(S×q^e/(1−q^e))`

Then re-roll using original entry weights and **NewNoDrop**; final empty probability is `NewNoDrop/(NewNoDrop+S)`, not exactly `q^e` after integer truncation. If N=0, keep0; handle q=0 without division by zero.

Solo `/players1…8` exponent table: **1,1,2,2,3,3,4,4**. The simulated extra players are not nearby party members. /players settings help only TCs with nonzero NoDrop, not every Unique's item count.

**Worked example:** Act1(H)H2HA: Picks1, N100; gold21,equipment16,junk21,good2; S60, q5/8.

| Solo setting | e | NewNoDrop | Actual empty probability |
|---|---:|---:|---:|
| players1–2 | 1 | 100 | 100/160=62.5% |
| players3–4 | 2 | 38 | 38/98=38.7755102% |
| players5–6 | 3 | 19 | 19/79=24.0506329% |
| players7–8 | 4 | **10** | 10/70=14.2857143% |

At e2: `floor(60×(5/8)^2/(1−(5/8)^2))=floor(38.4615…)=38`. With eight truly nearby partied players e8 gives1, not the solo players8 result10.

**Important source arithmetic trap:** an older worked tutorial displays11 for this example at e4; the quoted floor formula with N100,S60 yields **10**. Exact executable floating/integer implementation and close-party eligibility radius should be validated; do not copy the inconsistent worked numeral. XP radius53 1/3 yards is not automatically proof that the drop routine uses identical coordinates.

Player-count life scaling is spawn-time; NoDrop determination uses drop-time player/party conditions. Keep these separate.

### 8.3 Armor/weapons TC tiers, upgrade groups and ilvl

Auto-generated `armoN`/`weapN` group bases by **base-item quality level** in three-level intervals:

`Tier = 3×ceil(BaseQLvl/3)`

TC3 qlvl1–3; TC6 qlvl4–6; …TC87 qlvl85–87. Runtime autoTC names can exist through99, but original obtainable base equipment tops out at87. They are generated using ItemTypes TreasureClass/type-equivalence relationships rather than all appearing as explicit rows in TreasureClassEx [TC-guide].

- TC tier is **not monster level**, item ilvl or unique variant's qlvl.
- NM/H eligible TCs can upgrade within their own nonzero **group**, by group's level thresholds. Do not select the globally largest TC or upgrade fixed group0 boss/Super Unique roots by arbitrary area level.
- Example: a qlvl85 base belongs inTC87; an ilvl88 monster may generate it only if its selected TC path reaches the right base TC.
- AutoTC member weights come from item-type rarity, not a verified uniform distribution. Exact inheritance/weight construction is a blocker; do not assign every sword/claw/class item weight1 by assumption.
- Normal/exceptional/elite bases are selected through TCs. Do not add an unrelated10% “upgrade to elite” roll after a final base is selected.

Monster-drop `ilvl` normally equals the monster's **effective level**, including elite bonus. Base qlvl, unique/set minimum level and affix level are different concepts. TC access alone does not ensure a unique of that base is eligible.

For an ordinary affix-level calculation, the classic tutorial describes: raise ilvl to at least base qlvl, cap99; if magic_lvl>0, affix level=ilvl+magic_lvl; otherwise below `99−floor(qlvl/2)` use `ilvl−floor(qlvl/2)`, else `2ilvl−99`; cap affix level99. Full affix/group and staffmod generation is beyond this combat/drop report and must use the actual item-generation routines [ItemGen].

### 8.4 Quality chain and exact ItemRatio stages

**Unique → Set → Rare → Magic → Superior/High Quality → Normal → Low Quality.** These are sequential conditional tests, not independent final rarity weights [Quality].

Choose expansion **Version1** ItemRatio row, correct exceptional/elite (`Uber`) and class-specific flags.

For quality Q in Unique/Set/Rare/Magic:

1. `D0 = (BaseQ − trunc((ilvl−baseQLvl)/DivisorQ))×128`
2. `D1 = trunc(D0×100/(100+EffectiveMFQ))`
3. `D2 = max(D1,QualityMinQ)`
4. `D3 = D2 − trunc(D2×MaxTCQualityFactorQ/1024)`
5. Roll an integer0…D3−1; succeed if `<128`. D3≤128 makes the test guaranteed; factor1024 produces a special guaranteed-test case, not an invalid generic random bound.

Order matters: MF first, minimum clamp next, TC factor **last**. A lower denominator is better. Signed truncation matters if ilvl−base qlvl is negative. Superior/Normal tests do not use MF, these quality minima or TC quality factors. Their negative-denominator/low-quality edge behavior remains a code-validation blocker.

| ItemRatio row (Version1) | Unique Base/Div/Min | Set | Rare | Magic | HiQuality Base/Div | Normal Base/Div |
|---|---|---|---|---|---|---|
| Nonclass normal | 400/1/6400 | 160/2/5600 | 100/2/3200 | 34/3/192 | 12/8 | 2/2 |
| Nonclass exceptional/elite | Same | Same | Same | Same | 12/8 | 1/1 |
| Class-specific normal | 240/3/6400 | 120/3/5600 | 80/3/3200 | 17/6/192 | 9/8 | 2/2 |
| Class-specific exceptional/elite | Same | Same | Same | Same | 9/8 | 1/1 |

**Worked example:** nonclass elite base qlvl80, monster ilvl85, MF300, TC Unique factor800:

- Unique EMF `floor(300×250/550)=136`.
- D0 `(400−5)×128=50560`.
- D1 `floor(50560×100/236)=21423`.
- D2=max(21423,6400)=21423.
- D3 `21423−floor(21423×800/1024)=4687`.
- Conditional successful unique-quality roll `128/4687=2.73095797%`.

This is **not** final chance of a named unique per kill: multiply base-TC path chances, NoDrop and picks, then account for variant eligibility/rarity. If the Unique test fails, next Set test is conditional on that failure.

### 8.5 Magic Find diminishing returns

Magic EMF=MF. Unique/Set/Rare use factors250/500/600:

`EffectiveMF = floor(MF×Factor/(MF+Factor))` **when MF>10**; the classic code analysis reports MF≤10 remains unchanged [Quality]. Do not replace MF with MF+100 inside this diminishing function.

| MF | Unique EMF | Set EMF | Rare EMF | Magic EMF |
|---|---:|---:|---:|---:|
| 0 | 0 | 0 | 0 | 0 |
| 10 | 10 | 10 | 10 | 10 |
| 100 | 71 | 83 | 85 | 100 |
| 300 | 136 | 187 | 200 | 300 |
| 500 | 166 | 250 | 272 | 500 |

MF changes quality tests, **not NoDrop, rune probability, base TC access or item quantity**. Mercenary kill uses owner+merc MF; player kill uses player MF alone. MF on the owner is not lost when a pet gets the kill. Gold Find has analogous owner+merc handling on mercenary kills.

Successful Unique/Set quality selects an eligible variant of the selected base using its level, rarity, enabled/version/ladder/mode flags. A unique may be restricted from spawning again within one game. If no eligible variant can be generated:

- Failed unique availability → **Rare with3× durability**, not continued Set test.
- Failed set availability → **Magic with2× durability**, not continued Rare test.
- On non-durable items the downgrade's durability signature is invisible.

Not every blue item from a boss is proof of a failed Set; trace the quality path.

### 8.6 Inspected boss and Countess TCs

Notation U/S/R/M is TC quality factor, not literal final probability [D-tc].

| Root, representative difficulty | Picks | NoDrop | U/S/R/M | Entries and weights |
|---|---:|---:|---|---|
| Normal Andariel regular | 7 | 19 | 983/983/983/1024 | gold×1280:11,Act2EquipA:19,Junk:15,Good:3 |
| Normal Andariel quest | 7 | 19 | **995/995/1024/1024** | Equip:19,Good:3 |
| Hell Baal regular | 7 | 15 | 983/983/983/1024 | gold×2048:5,Act5(H)EquipB:52,Junk:5,Good:3,festering essence:1 |
| Hell Baal quest | 7 | 15 | 993/993/1024/1024 | Equip:52,Good:3,festering essence:1 |
| Hell Countess root | −2 | 0/omitted | 883/883/983/1024 | CountessItem(H):1,CountessRune(H):1 |
| Hell Countess item child | 5 | 19 | Inherit root | gold×2048:11,Act1(H)EquipC:19,Act2(H)Junk:15,Act2(H)Good:3,Terror key:1 |
| Hell Countess rune child | 3 | 5 | Inherit root | Runes12:15 |

LoD1.13+ Baal's festering essence is legitimate; newer D2R Ancient Statue/Herald/Desecrated entries are not. Quest TC improves quality restrictions but **does not guarantee a unique**.

Countess item child executes first. Five successful ordinary items leave only one of six slots for the special rune child. Therefore more players can **reduce special rune yield**, even though they reduce NoDrop. Special rune attempts each have players1 success15/20=75%, but up to3 attempts and the global remaining-slot cap are coupled. “Countess always drops a rune” is false.

Special rune maximums: Normal Ral (`Runes4`), Nightmare Io (`Runes8`), Hell Ist (`Runes12`). Hell ordinary item child can reach **Lo** through Act2(H)Good→Runes14, separate from special Ist ceiling. Do not label Lo a special Countess rune. Key/event generation depends on original game mode.

### 8.7 Quest drops and Andariel bug

Act boss ordinary versus first-quest TCs depend on quest state and MonStats quest fields (`TCQuestId`, `TCQuestCP`, TreasureClass4 variants). Implement quest state, not a global “first kill ever” counter.

The familiar classic **Andariel quest-drop bug** is preserved by completing the relevant first-kill NPC/travel sequence in the same game, commonly documented as talking to Warriv and traveling to Act II before exiting. Exact whether merely talking to any NPC suffices, Duriel's related quest flag behavior, and killer versus game-creator flag checks for other bosses are **not resolved to executable precision here** [BossFAQ]. Do not make all bosses permanently quest-drop or rely on D2R's automatically corrected Andariel behavior.

### 8.8 Gold Find and gold quantities

`GoldAfterGF = floor(BaseGoldPile×(100+GoldFindPercent)/100)`

Gold Find is linear, not MF diminishing returns. Example base1,000, GF200 →3,000. Mercenary kill with ownerGF200 and mercGF100 →4,000. It increases pile amount, not gold-entry selection probability.

Classic forum sources interpret TC `gld,mul=X` as **X/1024**, e.g.1280→1.25 and2048→2 [GoldMul]. Some modern articles give a different divisor; do not import them uncritically. **Base gold random formula, stacking/order of TC mul and GF, minimum pile and integer overflow remain blockers**. The expression above assumes a known pre-GF base pile; it does not specify how that pile is rolled from monster level/difficulty.

### 8.9 Complete classic1.13+ rune TC ladder

All rows Picks1,NoDrop0. Rune pairs have weights3 and2; lower TC carries the large fallback weight [D-tc].

| TC | First rune:weight | Second rune:weight | Fallback:weight | Total |
|---|---|---|---|---:|
| Runes1 | El:3 | Eld:2 | None | 5 |
| Runes2 | Tir:3 | Nef:2 | Runes1:2 | 7 |
| Runes3 | Eth:3 | Ith:2 | Runes2:5 | 10 |
| Runes4 | Tal:3 | Ral:2 | Runes3:7 | 12 |
| Runes5 | Ort:3 | Thul:2 | Runes4:12 | 17 |
| Runes6 | Amn:3 | Sol:2 | Runes5:22 | 27 |
| Runes7 | Shael:3 | Dol:2 | Runes6:45 | 50 |
| Runes8 | Hel:3 | Io:2 | Runes7:90 | 95 |
| Runes9 | Lum:3 | Ko:2 | Runes8:180 | 185 |
| Runes10 | Fal:3 | Lem:2 | Runes9:360 | 365 |
| Runes11 | Pul:3 | Um:2 | Runes10:720 | 725 |
| Runes12 | Mal:3 | Ist:2 | Runes11:1066 | 1071 |
| Runes13 | Gul:3 | Vex:2 | Runes12:1519 | 1524 |
| Runes14 | Ohm:3 | Lo:2 | Runes13:2170 | 2175 |
| Runes15 | Sur:3 | Ber:2 | Runes14:2941 | 2946 |
| Runes16 | Jah:3 | Cham:2 | Runes15:3957 | 3962 |
| Runes17 | Zod:1 | None | Runes16:5170 | 5171 |

Examples, **conditional on already selecting the named rune TC**:

- `P(El | Runes2) = (2/7)×(3/5)=6/35`.
- `P(Ist | Runes12)=2/1071`, about1 in535.5.
- `P(Zod | Runes17)=1/5171`, about0.0193386192%.
- `P(Jah | Runes17)=(5170/5171)×(3/3962)`, about1 in1320.9221.
- `P(Ber | Runes17)=(5170/5171)×(3957/3962)×(2/2946)`, about1 in1475.1465.

Act5(H)Good has weights jewelry60,chipped4,flawed10,normal14,flawless28,Runes17:14; sum130. Thus one selection from **that Good TC**, not an entire monster kill, gives `P(Zod)=14/(130×5171)`, about1 in48,016.43.

A complete per-monster rune probability must multiply/sum **all recursive parent paths**, NoDrop and pick behavior. `1−(1−p)^k` is valid only for k independent attempts with unchanged p and no relevant cap/branch dependency; Countess and boss six-slot caps violate simplistic use. No uniform “high rune chance” exists.

#### Hellforge

One rune uniformly chosen among11, **each1/11**, independent of MF [Forge]:

| Difficulty | Inclusive rune range |
|---|---|
| Normal | El–Amn |
| Nightmare | Sol–Um |
| Hell | Hel–Gul |

Also one perfect,two flawless,one normal gem. Party quest completion can consume every allied player's quest while adding perfect gems, **not one rune per player**; original party/act restrictions matter.

#### Chests, superchests and other sources

Normal chests, locked chests, sparkly chests, superchests, racks, Find Item and quest/event drops are **not all the monster algorithm**. Superchest fixed drop patterns/forced qualities and MF exceptions are not reconstructed in this report. Therefore the rune TC ladder and monster formulas do not establish exact Lower Kurast superchest rates or all rack probabilities. Those are explicit incomplete areas, not permission to reuse monster Picks blindly.

---

## 9. Difficulty comparison and mercenaries

Sources: [Arreat difficulty][Difficulty], [Arreat hirelings][Hirelings], [Hireling file guide][HireGuide], [pinned difficulty and mercenary data][D-diff][D-hire], [classic life/critical/boss FAQs][LifeFAQ][Critical][BossFAQ].

### 9.1 Cross-difficulty constants

| Mechanic | Normal | Nightmare | Hell | Notes |
|---|---:|---:|---:|---|
| Player/merc elemental resistance penalty | 0 | −40 | −100 | F/C/L/P, not magic/physical |
| PLR difficulty penalty | 0 | −40 | −100 | Separate duration stat |
| Ordinary leech divisor | 1 | 2 | 3 | Then monster drain |
| Monster skill-level bonus | 0 | +3 | +7 | Applicable monster skill functions |
| Player cold/freeze and eligible AI-curse duration | 1 | 1/2 | 1/4 | Target and skill exceptions |
| Random Unique acquired modifier count | 1 | 2 | 3 | Super Unique presets/eligibility separate |
| Champion/Unique damage-bonus scaling constant | 90 | 75 | 66 | Scales modifier ED/AR as specified, not all monster damage |
| Mercenary attack damage against act boss | 50% | 35% | 25% | CB is separate; exact unit matrix validation needed |
| Static Field minimum target-life fraction | 0 | 1/3 | 1/2 | Resist/immune behavior still applies |
| Monster CE damage-percent field | 50 | 35 | 20 | FE/dolls/Nihlathak skill callbacks have additional factors |
| Death XP penalty of current-level gap | 0 | 5% | 10% | No de-leveling |
| Hellforge range | El–Amn | Sol–Um | Hel–Gul | Equal1/11 |
| Countess special maximum | Ral | Io | Ist | Ordinary Hell TC can reach Lo |

Monster HP/AR/defense/damage/XP/resistances come from **different difficulty columns**, not one universal Nightmare/Hell multiplier. Guest monsters, area populations, immunities and skill AI can also differ. Player-count damage scaling is mode/difficulty/source-specific (§7.3).

### 9.2 Original mercenary types, equipment and auras

| Act | Variants/skills | Original equipment |
|---|---|---|
| I Rogue | Fire Arrow + Inner Sight, or Cold Arrow + Inner Sight | Bow, helm, body armor; **no crossbow or Amazon-only bow** |
| II Desert | Jab + hired-difficulty aura | Polearm/spear including appropriate javelin eligibility, helm, body armor; use original WType/type-equivalence |
| III Iron Wolf | Cold: Ice Blast/Glacial Spike/Frozen Armor; Lightning: Charged Bolt/Lightning; Fire: Inferno/Fire Ball | Sword, shield, helm, body armor |
| IV | No mercenary available | — |
| V Barbarian | Bash/Stun | One sword, helm (including Barbarian helm), body armor; **no dual-wield/Frenzy** |

Act II aura is determined by **difficulty/type hired**, not the current game difficulty:

| Type | Hired Normal/Hell | Hired Nightmare |
|---|---|---|
| Combat | Prayer | Thorns |
| Defensive | Defiance | Holy Freeze |
| Offensive | Blessed Aim | Might |

Classic Normal-hired mercenaries generally have better same-level stats than NM/H hires. Starting low and manually leveling does **not** provide a separate training bonus when compared with a higher-level hire from the same difficulty/type table. Their relevant row follows level brackets and original hired ID [D-hire].

Mercenaries: no durability loss; poison can kill; no player-like death XP loss; unlimited mana means +mana/Energy/mana leech are not useful as a player resource system. +Vitality does not supply ordinary mercenary life growth. Act III shields cannot block. Max level98 and cannot exceed owner level. Resurrection cost capped50,000; exact cost function not obtained.

### 9.3 Hireling growth: use brackets, not a single slope

Hireling.txt Version100 is expansion; Difficulty1/2/3 specifies hiring difficulty. Id/subtype can have multiple `Level` threshold rows. The highest applicable threshold supplies that bracket's base statistics and growth; exact cross-difficulty Share selection and fractional rounding need original function validation [HireGuide].

| Act II Normal example | Bracket at9 | Bracket at43 | Bracket at75 |
|---|---:|---:|---:|
| HP | 120 | 630 | 1430 |
| HP/Lvl | 15 | 25 | 40 |
| Defense | 45 | 419 | 1027 |
| Def/Lvl | 11 | 19 | 28 |
| Str | 57 | 117 | 173 |
| Str/Lvl raw | 14 | 14 | 14 |
| Dex | 40 | 91 | 139 |
| Dex/Lvl raw | 12 | 12 | 12 |
| AR | 20 | 428 | 1196 |
| AR/Lvl | 12 | 24 | 36 |
| Damage min–max | 7–14 | 24–31 | 48–55 |
| Dmg/Lvl raw | 4 | 6 | 8 |
| Resist raw | 18 | 86 | 142 |
| Resist/Lvl raw | 8 | 7 | 4 |

HP/defense illustrate per-bracket linear integer growth: level9→43 Normal HP `120+34×15=630`, defense`45+34×11=419`. At75 the slope changes again. NM level75 HP1367,defense985,Str169,Dex135; Hell hire at75 HP1230,defense887,Str165,Dex131. Normal at75 HP1430,defense1027,Str173,Dex139.

The file guide explicitly states **Dmg/Lvl and Resist/Lvl are eighths**. Raw Str/Dex and skill growth units cannot be assumed whole points; inspected values imply fractional growth, but exact units/rounding are not fully established here. Do not apply `Str +=14` every level or pretend every field uses the same denominator. Aura skill-level caps and activation AI need their exact bracket functions.

Mercenary experience threshold for next level from current L:

`Threshold(L+1) = ExpPerLevel × L² × (L+1)`

This is a **cumulative threshold**, not necessarily the per-level gap. Example Act II Normal Exp/Lvl110 atL10:121,000 threshold for level11. Merc XP is separate from owner's and does not subtract owner XP. Earlier pre1.11 guides' per-kill caps1/64 and1/192 changed in1.11; exact1.14 own-kill versus owner-kill scaling/cap is unresolved, so do not import old limits [HireGuide][ExpFAQ].

### 9.4 Unit-damage source conflicts

Arreat says act bosses deal10× damage to mercenaries; modern damage tables report a different primeevil multiplier, often2× to mercenaries and4× to pets. Classic FAQ says mercenaries/pets deal50/35/25% to act bosses, while modern tables distinguish summons differently. These are **not reconciled here**.

Use the clearly supported DifficultyLevels mercenary outgoing fields as data, but **block final act-boss-versus-mercenary/pet and summon-versus-boss damage matrices until original1.14 code/tests confirm**. Likewise mercenary→player PvP penalty and inherent Crit/DS stacking must be validated independently. A claim of complete1:1 fidelity is not justified by picking one conflicting web table.

---

## 10. Implementation handoff: verified anchors and explicit blockers

### High-value established anchors

- Ordinary hit equation, class AR constants, +5AR/Dex, running hit-check exception, CTB/Dex/level formula and block caps.
- Separation of local weapon ED and summed off-weapon ED; correct regular versus Amazon javelin coefficients; player CS/DS cannot stack to4×.
- CB current-life fractions, player-count divisor and positive-only physical resistance; OW piecewise rate/duration.
- Elemental difficulty penalties/caps, eligible immunity breakers and one-fifth rule; Hell leech divisor**3** with additional Drain and nonzero1% leech.
- Classic probabilistic FHR tiers, **not1/12 always-recovery**, and25Hz/fixed-point mana regeneration nested floors.
- Exact XP /256 level coefficients and /1024 high-level ratios, threshold-row offset, party87/256 and per-kill ceiling.
- Distinct elite stat lookup levels: HP/defense/base XP at base level, AR/damage at effective level.
- Original area/act-boss levels; fixed-point elite HP; classic Mana Burn bug and classic mercenary types.
- Recursive TCs, NoDrop integer reweighting, six-item cap, max nested quality factors, ItemRatio quality stages/MF and complete classic rune ladder.

### Remaining fidelity blockers — do not silently guess

| Priority | Blocker | Required validation |
|---|---|---|
| P0 | Actual1.14 MPQ/executable provenance | Extract merged original tables; checksum/version and mode identification |
| P0 | Elite XP level-penalty identity and party overflow/share floors | Controlled clvl/mlvl boundary kills; signed32-bit function trace |
| P0 | Unit damage matrix for act bosses/mercenaries/pets/PvP | Original callbacks and controlled damage tests |
| P0 | AutoTC member weighting/upgrade exceptions and drop RNG/cap order | ItemTypes and TC-generation functions; full per-monster drop oracle |
| P1 | Exact stamina class drain and shield weight | Assassin comparison; light/medium/heavy armor+shield combinations |
| P1 | Spectral Hit+20/+40 resistance conflict, Ghostly movement | Original modifier functions and controlled resistance/speed tests |
| P1 | Gold base roll and mul/GF order | Original gold-generation function; deterministic seed comparison |
| P1 | FE exact random endpoints and FE/LE/CE callbacks | Original1.14 death/GetHit callbacks, Nightmare regression cases |
| P1 | ED+min/max off-weapon jewel and MDR-overflow bugs | Damage-stat assembly order and mixed-type test cases |
| P1 | Poison overwrite/mixing/tick interruption, freeze shatter | Skills/Missiles state functions, monster/player/merc distinctions |
| P1 | Combined immunity-breaker integer order | Resistance100 boundary tests with non-divisible reductions |
| P1 | Quest-drop flags / exact Andariel/Duriel persistence | Killer/game-creator quest matrix and NPC/exit sequences |
| P1 | Mercenary fractional growth, skill caps, XP and resurrection cost | Hireling function and bracket/mode tests |
| P2 | Teleport healing, PMH exclusions, online regen delay | Modifier/unit callbacks and original realm versus offline tests |
| P2 | Kicks, Enchant/aura mastery exceptions, complete skill fractions | Original Skills/Missiles functions rather than generic damage shortcut |
| P2 | Chests/superchests/racks/Find Item/event drop rates | Source-specific routines and original mode/seed patterns |

This document covers all nine requested subject areas, but is **not a certification that every edge case is fully specified**. It deliberately retains source conflicts and unknowns so engineers do not implement newer D2R rules or unverified folklore as1.14 behavior.

## Sources

Reference links below are cited throughout. Original-era technical analyses often correct Arreat's rounded/outdated prose; current Maxroll/Basin pages must be filtered for D2R-only additions. Unfetched/blocked classic tutorial content was used only where search-indexed or quoted by accessible sources, not treated as independently verified full text.

[Characters]: https://classic.battle.net/diablo2exp/basics/characters.shtml
[Hit]: https://maxroll.gg/d2/resources/hit-chance-mechanics
[AR]: https://diablo-archive.fandom.com/wiki/Attack_Rating_(Diablo_II)
[Defense]: https://diablo2.diablowiki.net/Guide:Defense_101_v1.11,_by_Alecz
[Physical]: https://www.mannm.org/d2library/faqtoids/physd_eng.html
[Damage]: https://maxroll.gg/d2/resources/damage-calculation
[Magic]: https://classic.battle.net/diablo2exp/items/magic.shtml
[Critical]: https://www.mannm.org/d2library/faqtoids/cs_eng.html
[Resists]: https://classic.battle.net/diablo2exp/basics/resistances.shtml
[PalOff]: https://classic.battle.net/diablo2exp/skills/paladin-offense.shtml
[Curses]: https://classic.battle.net/diablo2exp/skills/necromancer-curses.shtml
[Resistance]: https://diablo2.diablowiki.net/Resistance
[Block]: https://maxroll.gg/d2/resources/block-mechanics
[Blocking]: https://diablo2.diablowiki.net/Blocking
[Breakpoints]: https://asgardpvp.com/guides/bp/
[FHR]: https://www.mannm.org/d2library/faqtoids/fhr_eng.html
[CC]: https://maxroll.gg/d2/resources/crowd-control
[Poison]: https://maxroll.gg/d2/resources/poison-damage
[LifeFAQ]: https://www.mannm.org/d2library/faqtoids/leben_eng.html
[LifeMana]: https://maxroll.gg/d2/resources/life-mana-mechanics
[StaminaFAQ]: https://www.mannm.org/d2library/faqtoids/stamina_eng.html
[RunWalk]: https://maxroll.gg/d2/resources/run-walk-mechanics
[Regen]: https://www.theamazonbasin.com/wiki/index.php/Damage_regeneration
[Experience]: https://classic.battle.net/diablo2exp/basics/experience.shtml
[BasinXP]: https://www.theamazonbasin.com/wiki/index.php/Experience
[ExpFAQ]: https://www.mannm.org/d2library/faqtoids/exp_eng.html
[MonBasics]: https://classic.battle.net/diablo2exp/monsters/basics.shtml
[MonBonus]: https://classic.battle.net/diablo2exp/monsters/bonus.shtml
[MonTests]: https://www.theamazonbasin.com/forums/index.php?/forums/topic/118104-monster-bonuses-death-damage-and-corpse-explosion/
[BossFAQ]: https://www.mannm.org/d2library/faqtoids/boss_eng.html
[TC-guide]: https://d2mods.info/forum/viewtopic.php?t=34804
[Quality]: https://d2mods.info/forum/viewtopic.php?t=30222
[ItemGen]: https://diablo2.diablowiki.net/Item_Generation_Tutorial
[NoDrop]: https://d2mods.info/forum/viewtopic.php?t=67310
[GoldMul]: https://d2mods.info/forum/viewtopic.php?t=28319
[Forge]: https://www.theamazonbasin.com/wiki/index.php/Hell%27s_Forge
[Difficulty]: https://classic.battle.net/diablo2exp/basics/difficulty.shtml
[Hirelings]: https://classic.battle.net/diablo2exp/basics/hirelings.shtml
[HireGuide]: https://d2mods.info/forum/kb/viewarticle?a=285
[D-char]: https://raw.githubusercontent.com/blizzhackers/d2data/e35dcd6c014b/json/charstats.json
[D-diff]: https://raw.githubusercontent.com/blizzhackers/d2data/e35dcd6c014b/json/difficultylevels.json
[D-mon]: https://raw.githubusercontent.com/blizzhackers/d2data/e35dcd6c014b/json/monstats.json
[D-lvl]: https://raw.githubusercontent.com/blizzhackers/d2data/e35dcd6c014b/json/MonLvl.json
[D-area]: https://raw.githubusercontent.com/blizzhackers/d2data/e35dcd6c014b/json/Levels.json
[D-exp]: https://raw.githubusercontent.com/blizzhackers/d2data/e35dcd6c014b/json/experience.json
[D-tc]: https://raw.githubusercontent.com/blizzhackers/d2data/e35dcd6c014b/json/TreasureClassEx.json
[D-ratio]: https://raw.githubusercontent.com/blizzhackers/d2data/e35dcd6c014b/json/itemratio.json
[D-mod]: https://raw.githubusercontent.com/blizzhackers/d2data/e35dcd6c014b/json/monumod.json
[D-su]: https://raw.githubusercontent.com/blizzhackers/d2data/e35dcd6c014b/json/SuperUniques.json
[D-prop]: https://raw.githubusercontent.com/blizzhackers/d2data/e35dcd6c014b/json/MonProp.json
[D-weap]: https://raw.githubusercontent.com/blizzhackers/d2data/e35dcd6c014b/json/weapons.json
[D-hire]: https://raw.githubusercontent.com/blizzhackers/d2data/e35dcd6c014b/json/hireling.json

Additional verification leads: [Phrozen original recovery code analysis](https://d2mods.info/forum/viewtopic.php?t=47619), [MonLvl file guide](https://d2mods.info/forum/kb/viewarticle?a=354), [classic party overflow analysis](https://planetdiablo.eu/forum/threads/der-exp-bug-2-welle-eine-analyse.1175441/), [Silospen drop calculator](https://dropcalc.silospen.com/). These are leads/oracles, not proof that every unresolved issue above has been independently validated.
