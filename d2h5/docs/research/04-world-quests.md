# Diablo II: Lord of Destruction — world, quests, NPCs, monsters and game flow

## 0. Scope, version discipline and evidence

**Target:** original PC Diablo II: Lord of Destruction, 1.14-era expansion rules; not the non-expansion game and not Diablo II: Resurrected (D2R). Research only; no game implementation. N/NM/H means Normal/Nightmare/Hell. Area IDs are original `Levels.txt` IDs. Numbers are one-player values unless stated otherwise.

Evidence classes used below:

- **S:** documented by Blizzard's Arreat Summit, with occasional explicitly identified stale documentation.
- **T:** transcribed from an original-LoD/pre-D2R TXT-derived snapshot.
- **D:** derived from that snapshot, not independently verified against the 1.14 executable. These are research estimates, **not production-ready exact constants**.
- **U:** unresolved; preserve as an explicit validation task rather than inventing a value.

The pinned data snapshot is `blizzhackers/d2data`, commit **e35dcd6c014b134b60f0473e3fdb212863c17f2f**, dated 2021-03-01. Repository provenance says the data originate in `d2_patch.mpq`; the exact source patch is not specified. It predates D2R but is **not proven byte-identical to 1.14**. Do not use current `master`: it contains modern D2R changes. Exact numerical fidelity ultimately requires extracting the user's original 1.14 MPQ and checking engine-generated values.

### Primary data references

| Ref | Source URL | Use |
|---|---|---|
| T-L | [Pinned Levels.json](https://cdn.jsdelivr.net/gh/blizzhackers/d2data@e35dcd6c014b134b60f0473e3fdb212863c17f2f/json/Levels.json) | All 136 nonzero area IDs, expansion alvl, waypoint indices, generation type, sizes, spawn candidates |
| T-M | [Pinned monstats.json](https://cdn.jsdelivr.net/gh/blizzhackers/d2data@e35dcd6c014b134b60f0473e3fdb212863c17f2f/json/monstats.json) | Monster IDs, families, AI, attacks, resistances, level/stat factors |
| T-ML | [Pinned MonLvl.json](https://cdn.jsdelivr.net/gh/blizzhackers/d2data@e35dcd6c014b134b60f0473e3fdb212863c17f2f/json/MonLvl.json) | Level-dependent HP, damage, defense, AR and XP scaling |
| T-SU | [Pinned SuperUniques.json](https://cdn.jsdelivr.net/gh/blizzhackers/d2data@e35dcd6c014b134b60f0473e3fdb212863c17f2f/json/SuperUniques.json) | Fixed modifiers, minion counts, class IDs, treasure classes |
| T-MZ | [Pinned LvlMaze.json](https://cdn.jsdelivr.net/gh/blizzhackers/d2data@e35dcd6c014b134b60f0473e3fdb212863c17f2f/json/LvlMaze.json) | Maze room counts and room dimensions |
| T-H | [Pinned hireling.json](https://cdn.jsdelivr.net/gh/blizzhackers/d2data@e35dcd6c014b134b60f0473e3fdb212863c17f2f/json/hireling.json) | Expansion mercenary rows, breakpoints, raw stats, skills and costs |
| T-O | [Pinned objects.json](https://cdn.jsdelivr.net/gh/blizzhackers/d2data@e35dcd6c014b134b60f0473e3fdb212863c17f2f/json/objects.json) | Object classes; requires preset-placement data too |
| T-B | [Pinned monumod.json](https://cdn.jsdelivr.net/gh/blizzhackers/d2data@e35dcd6c014b134b60f0473e3fdb212863c17f2f/json/monumod.json) | Unique modifier IDs |

**Import hazards:** `MonLvl1Ex/MonLvl2Ex/MonLvl3Ex`, not `MonLvl1/2/3`, are expansion area levels. JSON monster rows have numeric outer keys: join by each row's `Id`. Missing zero-valued fields are not necessarily false: Rogue Encampment's omitted waypoint index is **0**, not “no waypoint.” `Vis0…Vis7` are only part of the topology: they omit outdoor seams and scripted portals. Repeated `Vis` entries mean possible entrance orientations, not duplicated dungeons. Internal English names must be normalized; examples are Spider Cave → Arachnid Lair, Rigid Highlands → Frigid Highlands, Chaos Sanctum → Chaos Sanctuary, Halls of Death's Calling → Halls of Pain, Hell1/2/3 → Abaddon/Pit of Acheron/Infernal Pit.

**Explicitly exclude D2R mechanics:** Terror Zones, Sunder charms, quick-cast as a default control model, shared stash, permanent Anya portal, removal of Cow King lockout, expanded Rogue equipment, and dual-wield/Frenzy Barbarian mercenaries.

## 0.1 完整战役可达性审计（2026-11-17）

**当前不是五幕可玩后再补细节，而是第一幕部分闭环、正常主线硬停第二幕。**安达利尔→瓦瑞夫东行可以运行；到鲁高因后，方块／法杖材料和配方缺失，王宫门永久关闭，无法正常到达神秘避难所、真墓、都瑞尔及第三幕。第三至第五幕缺口被此前置阻断遮蔽。测试手动解锁五幕后验证地图连通，不等于角色正常能通关。

当前运行提交是1.14d分支 `0edfaf6d006f2eb82857c066e07ce03614285981`，不是上方历史研究引用的 `e35dcd6c…`。本轮本地 Levels／MonStats／SuperUniques／TC／Objects／Hireling 等哈希与provenance相符，但未完成在线提交历史和合法原版客户端的版本语义验证。

| 幕／任务 | 正常阶段与奖励 | 当前执行缺口 |
|---|---|---|
| A1邪恶洞窟 | 全部应计怪物清除，包括复活者→阿卡拉；技能点与洗点权 | 主环成立；2026-11-18 已修复复活怪再次给 XP/掉落及巫师互相复活，完整首幕仍待实际验收 |
| A1血鸟 | 指定血鸟→卡夏；免费随机罗格与招聘 | 只有旗标，无佣兵实体；8级免任务招聘未形成闭环 |
| A1凯恩 | 树卷轴→解读→五石顺序→红门→笼子→回报 | 对象和NPC链缺失，崔斯特瑞姆入口关闭 |
| A1女伯爵 | 塔五层击杀；信用、首杀宝藏、双TC | 信用成立，根TC未取超级暗金专用记录 |
| A1马勒斯 | 架上取锤→恰西→等级≥8合法底材注入 | 对象、交付、服务缺失；不能要求先杀铁匠 |
| A1安达利尔 | 击杀→瓦瑞夫→第二幕；任务掉落 | 东行成立，毒攻击、任务TC及历史旗标待补 |
| A2罗达门特 | 击杀→技能书拾取使用→亚特玛；技能点、九折 | 无书、信用与折扣 |
| A2法杖 | 死亡之殿方块→虫洞杖身→蛇殿护符→合成→真墓插孔 | 材料、配方、插孔缺失，主线硬阻断 |
| A2太阳 | 失落城市黑暗→祭坛→NPC许可／恢复日光 | 王宫门永久关闭，主线硬阻断 |
| A2避难所 | 王宫→红门→日记／真墓符号→峡谷红门 | 前置已堵，日记和峡谷门缺失 |
| A2召唤者 | 指定召唤者击杀→剧情信用 | 无信用和专属AI |
| A2七墓 | 真墓法杖→都瑞尔→泰瑞尔→杰海因→马席夫 | 真墓与旅行缺失；不能加20级通用旅行门槛 |
| A3黄金鸟 | 合格怪玉像→凯恩／马席夫→艾柯制药→喝药 | 专属掉落、交换、消费缺失 |
| A3吉德宾 | 祭坛→守卫→匕首→奥玛斯／艾席拉 | 触发和奖励链缺失；不得覆盖已有佣兵 |
| A3克林姆 | 眼／脑／心＋连枷→合成→装备→毁宝珠并消耗 | 材料／配方和门禁缺失 |
| A3古书 | 残破神殿取书→艾柯；5属性点 | 对象、交付缺失 |
| A3神殿 | 指定高阶议会→剧情信用 | 有怪不等于有任务执行 |
| A3墨菲斯托 | 击杀→灵魂石→桥／红门→第四幕 | 掉落、跨幕脚本缺失 |
| A4衣卒尔 | 击杀→灵魂→泰瑞尔；2技能点 | 无灵魂及奖励链 |
| A4熔炉 | 海法斯特锤→装备→灵魂石→敲击；4宝石＋1符文 | 物品／消费／奖励事务缺失；符文池El–Amn／Sol–Um／Hel–Gul |
| A4Diablo | 五封印→三组首领→Diablo→泰瑞尔→第五幕 | 脚本首领被生成排除，Diablo遭遇未生成 |
| A5Shenk | 击杀→拉苏克一次打孔 | 信用和服务缺失；品质／ilvl上限要分别判断 |
| A5救援 | 三笼15人→夸尔凯克；Ral＋Ort＋Tal、招聘 | 囚笼／士兵／状态缺失；失败可新局重试 |
| A5Anya | 冰封→马拉药→解冻→双方奖励／抗性卷轴 | 对象、药品、动态NPC和奖励缺失 |
| A5Nihlathak | 三厅→击杀→安雅刻名 | 尸爆AI和服务缺失；旧红门关闭要同时满足任务与Pain WP |
| A5先祖 | 20/40/60信用门槛→祭坛→连续三人→WSK | 首领与入口缺失；TP／离场／死亡重置，XP最多一个等级跨度 |
| A5巴尔 | 王座清场→五波→巴尔撤退→真身→结局 | 波次与入口缺失；引离王座亦须按原版判定，假身不记信用 |

三难度验收必须走新角色正常路线，不注入解锁旗标。任务／WP／幕权限按难度持久，奖励合计12技能点、15属性点、60生命、30四系抗性；支线不得无故强制为旅行前提。方块为角色持有物，不每难度复制发放。

其他关键依赖：

- 地图按maze／preset／outdoor分流；Levels尺寸不是可行走矩形。DS1布局／对象／路径与DT1三元图块键、5×5子格标志职责分开，使用原创合法场景验证；二值墙地和导入Objects函数号不足以完成门、封印、祭坛。
- 本局对象和触发状态与个人奖励权分开；蓝门保存所有者和返回点，新蓝门只替换本人蓝门，不能删静态红门。满包／无效输入不得吞任务物品或消耗一次性服务。
- 超级暗金优先专用TC，Boss在结算前判断任务掉落。Countess的负Picks根先普通物品、再专属符文，总上限6；专属符文不是保底三枚。复活怪不得重复给XP。
- Boss需专属元素、选择、召唤与死亡事件；都瑞尔即使表有Charge字段，官方说明也不调用它。精英强化、死亡爆炸、诅咒和受击电弹不能只存字符串。
- 四类佣兵有装备／XP／AI／药水／死亡／付费复活持久链；A2光环由招聘难度固定，不跟随当前难度变。旧罗格非亚马逊弓、A5单剑，不套D2R双持。
- SC多尸体及装备条件、同局75%死亡XP返还、SP仓库金币与每级500保护、HC永久死亡均缺。Realm保存最高装备价值尸体，Open／SP保存最旧，不自动合并。
- 离线应有同难度巴尔完成后牛场、牛王锁门、Hell精华与赦免徽章；Clone／毁灭与Pandemonium／火炬是原版realm活动，不是离线战役漏做项目。钥匙表存在不证明离线事件可开启，其1.14d实际掉落条件保留待验。

资料：[官方五幕任务](https://classic.battle.net/diablo2exp/quests/)、[任务奖励](https://classic.battle.net/diablo2exp/quests/rewards.shtml)、[官方角色／尸体／金币](https://classic.battle.net/diablo2exp/basics/characters.shtml)、[雇佣兵](https://classic.battle.net/diablo2exp/basics/hirelings.shtml)、[女伯爵TC](https://www.theamazonbasin.com/wiki/index.php/The_Forgotten_Tower)、[牛场](https://classic.battle.net/diablo2exp/quests/cow.shtml)、[Clone边界](https://classic.battle.net/diablo2exp/monsters/act5-uberdiablo.shtml)、[DT1格式](https://d2mods.info/forum/kb/viewarticle?a=40)、[DS1旧版加载器](https://d2mods.info/forum/viewtopic.php?p=46314)。格式研究含旧版／未解字段，不冒称全位义已1.14d验证。

## 1. World and connectivity

### 1.1 Reading the area tables

`WP` marks all **39 waypoints**, distributed 9/9/9/3/9. Other areas have none. All towns are safe fixed presets, with a private stash and town waypoint. Alvl `0` is a raw noncombat/transit value, not a level-zero encounter requirement.

Layout notation:

- **O WxH:** randomized outdoor tile composition within a nominal generation envelope. Landmarks, boundaries and exits obey act-specific rules.
- **P WxH:** preset geometry; may choose a preset variant, orientation or object arrangement. Not synonymous with every pixel being identical each game.
- **M r×WxH:** randomized maze with approximately `r` ordinary rooms of that dimension; `rN/rNM/rH` if different. Quest, entrance, exit and special rooms can be additional.
- Dimensions are **generation-grid/tile units, not screen pixels or guaranteed walkable floor area**. Ordinary maze entries often specify a 200×200 envelope; do not render a filled 200×200 dungeon. Exact walkable area depends on DS1/preset geometry, room merging and corridors. Outdoor size fields below are estimates, not full reconstruction specifications.
- A level can have an outdoor generator with effectively fixed landmarks: notably Travincal, Kurast Causeway and the final Chaos Sanctuary structure.

Sources: T-L, T-MZ; Blizzard maps [Act I](https://classic.battle.net/diablo2exp/maps/act1.shtml), [Act II](https://classic.battle.net/diablo2exp/maps/act2.shtml), [Act III](https://classic.battle.net/diablo2exp/maps/act3.shtml), [Act IV](https://classic.battle.net/diablo2exp/maps/act4.shtml), [Act V](https://classic.battle.net/diablo2exp/maps/act5.shtml); [Dungeon randomization](https://classic.battle.net/diablo2exp/basics/index.shtml).

### 1.2 Act I — Rogue Encampment / wilderness and monastery

Main route, bidirectional ordinary exits:

```text
1 Rogue Encampment — 2 Blood Moor — 3 Cold Plains — 4 Stony Field
— 10 Underground Passage 1 — 5 Dark Wood — 6 Black Marsh — 7 Tamoe Highland
— 26 Monastery Gate — 27 Outer Cloister — 28 Barracks — 29 Jail 1
— 30 Jail 2 — 31 Jail 3 — 32 Inner Cloister — 33 Cathedral
— 34 Catacombs 1 — 35 Catacombs 2 — 36 Catacombs 3 — 37 Catacombs 4
Branches:
2 — 8 Den of Evil
3 — 9 Cave 1 — 13 Cave 2
3 — 17 Burial Grounds — {18 Crypt, 19 Mausoleum}
10 — 14 Underground Passage 2
6 — 11 Hole 1 — 15 Hole 2
6 — 20 Forgotten Tower — 21 Cellar 1 — 22 Cellar 2 — 23 Cellar 3 — 24 Cellar 4 — 25 Cellar 5
7 — 12 Pit 1 — 16 Pit 2
4 --Cairn Stones red portal--> 38 Tristram
1 --Cube cow red portal--> 39 Moo Moo Farm
37 --Andariel quest + Warriv--> 40 Lut Gholein
```

| ID | Area | WP | Alvl N/NM/H | Layout / size estimate |
|---|---|---|---|---|
| 1 | Rogue Encampment | WP | 0/0/0 | P 56×40; town |
| 2 | Blood Moor | — | 1/36/67 | O 80×80; grass, paths, houses |
| 3 | Cold Plains | WP | 2/36/68 | O 80×80; grass and camps |
| 4 | Stony Field | WP | 4/37/68 | O 80×80; stone field, Cairn landmark |
| 5 | Dark Wood | WP | 5/38/68 | O 80×80; forest, Tree of Inifuss |
| 6 | Black Marsh | WP | 6/38/69 | O 80×80; marsh, tower |
| 7 | Tamoe Highland | — | 8/39/69 | O 80×80; wilderness |
| 8 | Den of Evil | — | 1/36/79 | M special cave, 24×24 room basis; merging/additions make “one room” misleading |
| 9 | Cave Level 1 | — | 2/36/77 | M 4×24×24; caves |
| 10 | Underground Passage Level 1 | — | 4/37/69 | M 6×24×24; two main exits |
| 11 | Hole Level 1 | — | 5/38/80 | M 4×24×24 |
| 12 | Pit Level 1 | — | 7/39/85 | M 4×24×24 |
| 13 | Cave Level 2 | — | 2/37/78 | P 24×24; treasure terminus |
| 14 | Underground Passage Level 2 | — | 4/38/83 | P 24×24 |
| 15 | Hole Level 2 | — | 5/39/81 | P 24×24 |
| 16 | Pit Level 2 | — | 7/40/85 | P 24×24 |
| 17 | Burial Grounds | — | 3/36/80 | O 40×48; cemetery landmark |
| 18 | Crypt | — | 3/37/83 | M 12/24/36×8×8; tomb |
| 19 | Mausoleum | — | 3/37/85 | M 12/24/36×8×8; tomb |
| 20 | Forgotten Tower | — | 0/0/0 | P 8×8; surface-to-cellar entry |
| 21 | Tower Cellar Level 1 | — | 7/38/75 | M 6/12/24×8×8 |
| 22 | Tower Cellar Level 2 | — | 7/39/76 | M 6/12/20×8×8 |
| 23 | Tower Cellar Level 3 | — | 7/40/77 | M 6/12/16×8×8 |
| 24 | Tower Cellar Level 4 | — | 7/41/78 | M 6/12/12×8×8 |
| 25 | Tower Cellar Level 5 | — | 7/42/79 | P 30×30; Countess room; preset variants |
| 26 | Monastery Gate | — | 8/40/70 | P 64×18 |
| 27 | Outer Cloister | WP | 9/40/70 | P 56×40; courtyard variants |
| 28 | Barracks | — | 9/40/70 | M 10×10×14; Smith/Malus room |
| 29 | Jail Level 1 | WP | 10/41/71 | M 12×12×12 |
| 30 | Jail Level 2 | — | 10/41/71 | M 14×12×12 |
| 31 | Jail Level 3 | — | 10/41/71 | M 16×12×12 |
| 32 | Inner Cloister | WP | 10/41/72 | P 18×20 |
| 33 | Cathedral | — | 11/42/72 | P 28×34 |
| 34 | Catacombs Level 1 | — | 11/42/72 | M 12×12×12 |
| 35 | Catacombs Level 2 | WP | 11/42/73 | M 14×12×12 |
| 36 | Catacombs Level 3 | — | 12/43/73 | M 16×12×12 |
| 37 | Catacombs Level 4 | — | 12/43/73 | P 22×31; Andariel |
| 38 | Tristram | — | 6/39/76 | P 43×48; ruined town |
| 39 | Moo Moo Farm / Secret Cow Level | — | 28/64/81 | O 80×80; fences, Cow King enclosure |

### 1.3 Act II — Lut Gholein / desert, tombs and Arcane Sanctuary

```text
40 Lut Gholein — 41 Rocky Waste — 42 Dry Hills — 43 Far Oasis
— 44 Lost City — 45 Valley of Snakes — 58 Claw Viper Temple 1 — 61 Temple 2
40 — 47 Sewers 1 — 48 Sewers 2 — 49 Sewers 3 (two town entrances to 47)
41 — 55 Stony Tomb 1 — 59 Stony Tomb 2
42 — 56 Halls of the Dead 1 — 57 Halls 2 — 60 Halls 3
43 — 62 Maggot Lair 1 — 63 Lair 2 — 64 Lair 3
44 — 65 Ancient Tunnels
40 --palace permission--> 50 Harem 1 — 51 Harem 2 — 52 Palace Cellar 1
— 53 Cellar 2 — 54 Cellar 3 --fixed portal--> 74 Arcane Sanctuary
74 --Horazon journal red portal--> 46 Canyon of the Magi
46 — {66,67,68,69,70,71,72: seven Tal Rasha's Tombs}
One seed-selected true tomb --staff/orifice wall opening--> 73 Duriel's Lair
73 --Tyrael/Jerhyn/Meshif quest sequence--> 75 Kurast Docks
```

The seven tomb IDs all display “Tal Rasha's Tomb”; **do not permanently assign the true tomb to a particular ID**. The quest log/journal identifies the rune for that game's true tomb; false tombs remain explorable.

| ID | Area | WP | Alvl N/NM/H | Layout / size estimate |
|---|---|---|---|---|
| 40 | Lut Gholein | WP | 0/0/0 | P 56×56; town |
| 41 | Rocky Waste | — | 14/43/75 | O 80×80; desert |
| 42 | Dry Hills | WP | 15/44/76 | O 80×80 |
| 43 | Far Oasis | WP | 16/45/76 | O 80×80 |
| 44 | Lost City | WP | 17/46/77 | O 80×80; ruined settlement |
| 45 | Valley of Snakes | — | 18/46/77 | O 32×32; small terminal desert |
| 46 | Canyon of the Magi | WP | 16/48/79 | O 80×80; seven symbol entrances |
| 47 | Sewers Level 1 | — | 13/43/74 | M 6×12×12 |
| 48 | Sewers Level 2 | WP | 13/43/74 | M 12×12×12 |
| 49 | Sewers Level 3 | — | 14/44/75 | M 14×12×12; Radament |
| 50 | Harem Level 1 | — | 0/0/0 | P 16×19; palace transit |
| 51 | Harem Level 2 | — | 13/47/78 | M 4×16×16; palace rooms |
| 52 | Palace Cellar Level 1 | WP | 13/47/78 | M 4×16×16 |
| 53 | Palace Cellar Level 2 | — | 13/47/78 | M 4×16×16 |
| 54 | Palace Cellar Level 3 | — | 13/48/78 | M 4×16×16; Arcane portal landmark |
| 55 | Stony Tomb Level 1 | — | 12/44/78 | M 4×16×16 |
| 56 | Halls of the Dead Level 1 | — | 12/44/79 | M 6×16×16 |
| 57 | Halls of the Dead Level 2 | WP | 13/45/81 | M 6×16×16 |
| 58 | Claw Viper Temple Level 1 | — | 14/47/82 | M 12×16×16 |
| 59 | Stony Tomb Level 2 | — | 12/44/79 | M 4×16×16 |
| 60 | Halls of the Dead Level 3 | — | 13/45/82 | M 6×16×16; Cube chest |
| 61 | Claw Viper Temple Level 2 | — | 14/47/83 | M 6×16×16 plus fixed altar room |
| 62 | Maggot Lair Level 1 | — | 17/45/84 | M 18×10×10; extremely narrow tunnels |
| 63 | Maggot Lair Level 2 | — | 17/45/84 | M 14×10×10 |
| 64 | Maggot Lair Level 3 | — | 17/46/85 | M 10×10×10; queen/chest room |
| 65 | Ancient Tunnels | — | 17/46/85 | M 10×12×12 |
| 66 | Tal Rasha's Tomb, internal tomb 1 | — | 17/49/80 | M 6×16×16 baseline plus special rooms |
| 67 | Tal Rasha's Tomb, internal tomb 2 | — | 17/49/80 | Same |
| 68 | Tal Rasha's Tomb, internal tomb 3 | — | 17/49/80 | Same |
| 69 | Tal Rasha's Tomb, internal tomb 4 | — | 17/49/80 | Same |
| 70 | Tal Rasha's Tomb, internal tomb 5 | — | 17/49/80 | Same |
| 71 | Tal Rasha's Tomb, internal tomb 6 | — | 17/49/80 | Same |
| 72 | Tal Rasha's Tomb, internal tomb 7 | — | 17/49/80 | Same |
| 73 | Duriel's Lair | — | 17/49/80 | P 32×47; boss chamber |
| 74 | Arcane Sanctuary | WP | 14/48/79 | M 61×12×12; four characteristic arms, one journal terminus |

### 1.4 Act III — Kurast Docks / jungle and Zakarum city

```text
75 Kurast Docks — 76 Spider Forest — jungle connections to 77 Great Marsh / 78 Flayer Jungle
78 Flayer Jungle — 79 Lower Kurast — 80 Kurast Bazaar — 81 Upper Kurast
— 82 Kurast Causeway — 83 Travincal --Compelling Orb--> 100 Durance 1 — 101 Durance 2 — 102 Durance 3
76 — {84 Arachnid Lair, 85 Spider Cavern}
78 — 86 Swampy Pit 1 — 87 Pit 2 — 90 Pit 3
78 — 88 Flayer Dungeon 1 — 89 Dungeon 2 — 91 Dungeon 3
80 — {94 Ruined Temple, 95 Disused Fane, 92 Sewers 1}
81 — {96 Forgotten Reliquary, 97 Forgotten Temple, 92 Sewers 1}
92 --sewer lever / trapdoor--> 93 Sewers 2
82 — {98 Ruined Fane, 99 Disused Reliquary}
102 --Mephisto red portal--> 103 Pandemonium Fortress
```

**Jungle generation caveat:** Great Marsh is not reliably a mandatory serial stop between Spider Forest and Flayer Jungle. Seeds can offer a direct Spider Forest–Flayer Jungle connection and make Great Marsh an optional branch, or require traversal through the marsh. Preserve seed-dependent adjacency rather than forcing `76→77→78` for every map. Exact jungle-block attachment algorithm remains U.

**Quest pitfall:** Khalim's Eye is in **Spider Cavern (85)**, not Arachnid Lair (84). Lam Esen's Tome is always in **Ruined Temple (94)**, not randomly in any of the six temples.

| ID | Area | WP | Alvl N/NM/H | Layout / size estimate |
|---|---|---|---|---|
| 75 | Kurast Docks | WP | 0/0/0 | P 64×48; dock town |
| 76 | Spider Forest | WP | 21/49/79 | O 64×192; jungle blocks, river, bridges |
| 77 | Great Marsh | WP | 21/50/80 | O 64×192; marsh/jungle |
| 78 | Flayer Jungle | WP | 22/50/80 | O 64×192; village/Gidbinn landmark |
| 79 | Lower Kurast | WP | 22/52/80 | O 80×64; ruined houses and huts |
| 80 | Kurast Bazaar | WP | 22/52/81 | O 80×64; urban ruins |
| 81 | Upper Kurast | WP | 23/52/81 | O 80×64 |
| 82 | Kurast Causeway | — | 24/53/81 | O 48×16; largely preset bridge/causeway |
| 83 | Travincal | WP | 24/54/82 | O 64×64; fixed temple/Council landmarks |
| 84 | Arachnid Lair | — | 21/50/79 | M 4×16×16 |
| 85 | Spider Cavern | — | 21/50/79 | M 4×16×16 |
| 86 | Swampy Pit Level 1 | — | 21/51/80 | M 4×14×14 |
| 87 | Swampy Pit Level 2 | — | 21/51/81 | M 4×14×14 |
| 88 | Flayer Dungeon Level 1 | — | 22/51/81 | M 4×14×14 |
| 89 | Flayer Dungeon Level 2 | — | 22/51/82 | M 4×14×14 |
| 90 | Swampy Pit Level 3 | — | 21/51/82 | P 40×40 |
| 91 | Flayer Dungeon Level 3 | — | 22/51/83 | P 40×40; Endugu/brain chest |
| 92 | Sewers Level 1 | — | 23/52/84 | M 32×12×12; two surface entrances |
| 93 | Sewers Level 2 | — | 24/53/85 | P 18×22; heart chest |
| 94 | Ruined Temple | — | 23/53/84 | P 24×24; Sarina/Tome |
| 95 | Disused Fane | — | 23/53/84 | P 24×24 |
| 96 | Forgotten Reliquary | — | 23/53/84 | P 24×24 |
| 97 | Forgotten Temple | — | 24/54/85 | P 24×24 |
| 98 | Ruined Fane | — | 24/54/85 | P 24×24 |
| 99 | Disused Reliquary | — | 24/54/85 | P 24×24 |
| 100 | Durance of Hate Level 1 | — | 25/55/83 | M 10/16/16×12×12 |
| 101 | Durance of Hate Level 2 | WP | 25/55/83 | M 12/48/48×12×12; major NM/H size increase |
| 102 | Durance of Hate Level 3 | — | 25/55/83 | P 41×29; Council, moat, Mephisto |

### 1.5 Act IV — Pandemonium Fortress / outer Hell

```text
103 Pandemonium Fortress — 104 Outer Steppes — 105 Plains of Despair
— 106 City of the Damned — 107 River of Flame — 108 Chaos Sanctuary
105: Izual landmark; 107: Hellforge/Hephasto landmark, not a separate level
108 --Diablo quest + Tyrael portal--> 109 Harrogath
```

| ID | Area | WP | Alvl N/NM/H | Layout / size estimate |
|---|---|---|---|---|
| 103 | Pandemonium Fortress | WP | 0/0/0 | P 32×24; town |
| 104 | Outer Steppes | — | 26/56/82 | O 80×64; rocky Hell wilderness |
| 105 | Plains of Despair | — | 26/56/83 | O 64×80 |
| 106 | City of the Damned | WP | 27/57/84 | O 80×64; ruined city, River stairs |
| 107 | River of Flame | WP | 27/57/85 | M 6×24×24; lava platforms, Hellforge |
| 108 | Chaos Sanctuary | — | 28/58/85 | Outdoor generator, nominal 120×120; fixed central geometry, variable wing/seal presets |

### 1.6 Act V — Harrogath / siege, ice caves and Worldstone

```text
109 Harrogath — 110 Bloody Foothills — 111 Frigid Highlands — 112 Arreat Plateau
— 113 Crystalline Passage — 115 Glacial Trail — 117 Frozen Tundra
— 118 The Ancients' Way — 120 Arreat Summit --Ancients quest--> 128 Worldstone Keep 1
— 129 Keep 2 — 130 Keep 3 — 131 Throne of Destruction --Baal portal--> 132 Worldstone Chamber
111 --red portal--> 125 Abaddon
112 --red portal--> 126 Pit of Acheron
117 --red portal--> 127 Infernal Pit
113 — 114 Frozen River; 115 — 116 Drifter Cavern; 118 — 119 Icy Cellar
109 --Anya red portal--> 121 Nihlathak's Temple — 122 Halls of Anguish
— 123 Halls of Pain — 124 Halls of Vaught
```

| ID | Area | WP | Alvl N/NM/H | Layout / size estimate |
|---|---|---|---|---|
| 109 | Harrogath | WP | 0/0/0 | P 40×40; fortified town |
| 110 | Bloody Foothills | — | 24/58/80 | O 240×48; long siege slope, barricades |
| 111 | Frigid Highlands | WP | 25/59/81 | O; runtime-composed sizes (`-1` in table), forts/cages |
| 112 | Arreat Plateau | WP | 26/60/81 | O; runtime-composed sizes, barricades |
| 113 | Crystalline Passage | WP | 29/61/82 | M 10×16×16; ice caves |
| 114 | Frozen River | — | 29/61/83 | M special 64×64 cave piece; Anya island |
| 115 | Glacial Trail | WP | 29/61/83 | M 10×16×16 |
| 116 | Drifter Cavern | — | 29/61/84 | M special 32×32 cave piece |
| 117 | Frozen Tundra | WP | 27/60/81 | O 128×80; siege wilderness |
| 118 | The Ancients' Way | WP | 29/62/82 | M 15×16×16 |
| 119 | Icy Cellar | — | 29/62/83 | M special 32×32 cave piece |
| 120 | Arreat Summit | — | 37/68/87 | P 20×28; altar/statues; no usable TP during trial |
| 121 | Nihlathak's Temple | — | 32/63/83 | P 22×27; Pindleskin; preset undead |
| 122 | Halls of Anguish | — | 33/63/83 | M 4×40×40; 80×80 envelope |
| 123 | Halls of Pain | WP | 34/64/84 | M 4×40×40; characteristic layout variants |
| 124 | Halls of Vaught | — | 36/64/84 | P 84×84; four arms, Nihlathak selected arm |
| 125 | Abaddon | — | 39/60/81 | M 3×24×24; Hell-style side dungeon |
| 126 | Pit of Acheron | — | 39/61/82 | M 3×24×24 |
| 127 | Infernal Pit | — | 39/62/83 | M 3×24×24 |
| 128 | Worldstone Keep Level 1 | — | 39/65/85 | M 9×16×16 |
| 129 | Worldstone Keep Level 2 | WP | 40/65/85 | M 9×16×16 |
| 130 | Worldstone Keep Level 3 | — | 42/66/85 | M 9×16×16 |
| 131 | Throne of Destruction | — | 43/66/85 | P 40×52; Baal wave arena |
| 132 | Worldstone Chamber | — | 43/66/85 | P 55×55; Baal boss |

### 1.7 Optional original realm events — not default single-player content

These existed before D2R but were restricted to appropriate original Battle.net realm games. Implement only if reproducing that ruleset; do not silently enable them in original single-player mode.

| ID/event | Area / access | Alvl fields N/NM/H | Layout | Boss / reward |
|---|---|---|---|---|
| 133 | Matron's Den; Hell Harrogath key portal | 50/75/83; only H access | M 12/24/36×8×8 fields; H used | Lilith → Diablo's Horn |
| 134 | Forgotten Sands; Hell key portal | 50/75/83; only H access | O 80×80 | Uber Duriel → Baal's Eye |
| 135 | Furnace of Pain; Hell key portal | 50/75/83; only H access | M 3×24×24 | Uber Izual → Mephisto's Brain |
| 136 | Uber Tristram; cube three organs in Hell Harrogath | 50/75/83; only H access | P 43×48 | Uber Mephisto/Diablo/Baal → one Hellfire Torch and Standard of Heroes drops |
| World Event | Hell game, replacing a spawned superunique; not a new area ID | Boss level 110 | Existing map | Diablo Clone → Annihilus |

Keys of Terror/Hate/Destruction come from Hell Countess/Summoner/Nihlathak in the supported event mode. Cube one of each key per mini-portal; three keysets and all three mini-portals in the same game avoid rerolling the same destination. Cube Horn+Eye+Brain to open Uber Tristram. These are not three additional Act V quests. Sources: [Pandemonium Event](https://classic.battle.net/diablo2exp/quests/pandemonium.shtml), [Uber Diablo](https://classic.battle.net/diablo2exp/monsters/act5-uberdiablo.shtml), T-L. Original realm trigger thresholds/server selection are outside the verified core catalogue.

## 2. All 27 quests

Quest IDs below are human-readable act/slot keys, not a claim about binary save bit offsets. Rewards repeat independently per difficulty unless stated otherwise. Quests are state machines, not a single `completed` boolean: distinguish discovery, objective completion, reward pending/claimed, game eligibility and travel permissions. Multiplayer quest credit depends on party, location and the game's existing quest state; the exhaustive original credit matrix remains U.

Sources: Blizzard quest pages [A1](https://classic.battle.net/diablo2exp/quests/act1.shtml), [A2](https://classic.battle.net/diablo2exp/quests/act2.shtml), [A3](https://classic.battle.net/diablo2exp/quests/act3.shtml), [A4](https://classic.battle.net/diablo2exp/quests/act4.shtml), [A5](https://classic.battle.net/diablo2exp/quests/act5.shtml), [rewards](https://classic.battle.net/diablo2exp/quests/rewards.shtml), [quest basics](https://classic.battle.net/diablo2exp/quests/basic.shtml).

| Key | Quest | Giver / trigger | Objectives and ordered steps | Boss | Reward / progression |
|---|---|---|---|---|---|
| A1Q1 | Den of Evil | Akara; enter Den | Kill every required monster in Den; remaining counter appears near completion; return to Akara | Corpsefire plus entire cave population | **+1 skill point; one stat/skill respec** at Akara per difficulty |
| A1Q2 | Sisters' Burial Grounds | Kashya | Cold Plains → Burial Grounds; kill Blood Raven; return | Blood Raven | Free Rogue Scout; hiring access |
| A1Q3 | The Search for Cain | Akara | Tree of Inifuss in Dark Wood → scroll; Akara decodes; activate five Stony Field Cairn Stones in decoded order; enter Tristram; free Cain from cage; return | Griswold is an obstacle, not required objective | Cain's free identification that difficulty; Akara ring. Exact ring quality/affix generation is U |
| A1Q4 | The Forgotten Tower | Moldy Tome in Stony Field or tower discovery | Black Marsh → tower → five cellars; kill Countess; treasure room | The Countess | Treasure and rune drops; no skill/stat reward |
| A1Q5 | Tools of the Trade | Charsi | Barracks; retrieve Horadric Malus from stand; return; choose eligible item for imbue | The Smith guards Malus; retrieving object is objective | **One rare-item imbue**, minimum character level 8 |
| A1Q6 | Sisters to the Slaughter | Cain / Act I progression | Reach Catacombs 4; kill Andariel; speak to Warriv and travel east | Andariel | Act II access |
| A2Q1 | Radament's Lair | Atma | Three sewer levels; kill Radament; pick up and consume Book of Skill; return to Atma | Radament | **+1 skill point** from book; **10% NPC-price discount** in Act II |
| A2Q2 | The Horadric Staff | Cain after Horadric Scroll | Radament-area chest → scroll; Halls of Dead 3 → Cube if not already owned; Maggot Lair 3 → Staff of Kings; Viper Temple 2 → Amulet of the Viper; cube staff+amulet; insert completed staff in true tomb orifice | Coldworm/Fangskin guard components | Persistent Horadric Cube; opens Duriel access; no independent stat reward |
| A2Q3 | Tainted Sun | Enter Lost City; Drognan | Darkness event; Viper Temple 2; destroy altar, recover amulet; speak with relevant town NPCs | Fangskin | Sunlight restored; palace/quest progression |
| A2Q4 | Arcane Sanctuary | Drognan/Jerhyn; palace progression | Harem and three palace cellars; use Arcane portal; locate/read Horazon's journal | Summoner at journal platform | Journal reveals true tomb symbol and opens Canyon portal; no independent numeric reward |
| A2Q5 | The Summoner | Encounter Summoner | Kill Summoner in Arcane; speak with Cain / read journal | The Summoner | Completion/portal permission for tomb progression; no skill/stat reward |
| A2Q6 | The Seven Tombs | Jerhyn; staff/journal progression | Identify true tomb; staff/orifice; kill Duriel; speak to Tyrael behind chamber; return; Jerhyn authorizes voyage; Meshif sails | Duriel | Act III access. **No universal character-level-20 travel gate** |
| A3Q1 | The Golden Bird | First eligible figurine drop; Cain/Meshif/Alkor | Eligible unique monster drops Jade Figurine; Cain directs to Meshif; Meshif exchanges for Golden Bird; Alkor prepares potion; collect and drink | No fixed boss | **Potion of Life: permanent +20 life** |
| A3Q2 | Blade of the Old Religion | Hratli / Gidbinn discovery | Activate Gidbinn shrine in Flayer Jungle; kill spawned unique; retrieve dagger; return to Ormus; speak to Asheara/Ormus | Scripted Gidbinn guardian | Ormus rare ring; free Iron Wolf/hireling-related reward. Exact no-existing-merc condition is U |
| A3Q3 | Khalim's Will | Cain | Eye: Spider Cavern chest; Brain: Flayer Dungeon 3 chest; Heart: Sewers 2 chest; Flail: Travincal Council; cube four pieces → Khalim's Will; equip and smash Compelling Orb | Council; component guardians | Durance entrance opens; Khalim's Will consumed; no independent stat reward |
| A3Q4 | Lam Esen's Tome | Alkor | Find Tome in **Ruined Temple, Kurast Bazaar**; return | Battlemaid Sarina guards temple | **+5 attribute points** |
| A3Q5 | The Blackened Temple | Ormus / entering Travincal | Kill High Council in Travincal; speak with Cain/Ormus as required | Ismail, Geleb, Toorc and Council group | Council quest completion and Durance portal permission; no separate skill/stat reward |
| A3Q6 | The Guardian | Ormus | Three Durance levels; kill Mephisto; collect soulstone; cross bridge/use red portal | Mephisto | Act IV access; Mephisto's Soulstone for Hellforge |
| A4Q1 | The Fallen Angel | Tyrael | Plains of Despair; defeat Izual; speak to freed spirit, then Tyrael | Izual | **+2 skill points** |
| A4Q2 | Hell's Forge | Cain | River of Flame; kill Hephasto; take/equip Hellforge Hammer; place Mephisto soulstone on forge; strike forge | Hephasto the Armorer | **1 normal gem + 2 flawless gems + 1 perfect gem**, skulls included; **one rune** from difficulty-specific pool below |
| A4Q3 | Terror's End | Tyrael | Open all five Chaos seals; kill three seal bosses/packs; Diablo spawns; kill him; Tyrael opens Act V travel portal | Vizier, De Seis, Infector, Diablo | Act V access; no skill/stat reward |
| A5Q1 | Siege on Harrogath | Larzuk | Bloody Foothills; kill Shenk; return | Shenk the Overseer | **One socketing service**; shop-discount reward documented, exact discount scope/value U |
| A5Q2 | Rescue on Mount Arreat | Qual-Kehk | Frigid Highlands; break gates of three cages; rescue **15 Barbarians**; return | No mandatory named boss | **Ral + Ort + Tal**; Act V Barbarian hiring unlock. Soldier deaths can require retry in new game |
| A5Q3 | Prison of Ice | Malah | Frozen River; find/talk to frozen Anya; Malah gives thawing potion; use at Anya; collect rewards from Malah and Anya | Frozenstein nearby | Malah scroll: **permanent +10 fire/cold/lightning/poison resistance**; Anya class-specific rare; red temple portal |
| A5Q4 | Betrayal of Harrogath | Anya | Temple → Halls of Anguish → Pain → Vaught; kill Nihlathak; return | Nihlathak | **One personalize/name inscription** on eligible weapon/armor; repairs/recharges item |
| A5Q5 | Rite of Passage | Qual-Kehk / Summit altar | Activate altar; defeat Talic/Madawc/Korlic in one uninterrupted trial; do not leave or open TP | Three Ancients | **XP 1,400,000 / 20,000,000 / 40,000,000**, subject to cap below; WSK access |
| A5Q6 | Eve of Destruction | Qual-Kehk / Baal progression | Throne: clear room; defeat five waves; Baal retreats; enter Chamber; kill real Baal | Colenzo, Achmel, Bartuc, Ventar, Lister; Baal | Difficulty completion, next difficulty unlock and title; ending sequence |

### 2.1 Exact reward rules and persistence

| System | Classic behavior |
|---|---|
| Accumulated quest bonuses | Per difficulty: 4 skill points, 5 attributes, 20 life, 10 elemental/poison resist. Across three difficulties: **12 skills, 15 attributes, 60 life, 30 resists**. Respec, imbue, socket and personalize each available once per difficulty |
| Akara respec | Unspent reward can be used later. Resets allocated attributes/skills; separate from repeatable Token of Absolution respec. Token recipe uses four types of **Hell boss essences**: Andariel/Duriel share Twisted Essence of Suffering; Mephisto Charged Hatred; Diablo Burning Terror; Baal Festering Destruction |
| Imbue | Eligible unsocketed, nonmagical base equipment → rare. No jewelry/charms; item must be eligible for rare generation. Commonly documented output ilvl = clvl+4; **exact quality/ethereal/staffmod handling and formula need 1.14 validation** |
| Larzuk, nonmagic | Maximum sockets allowed by **base type and item level**, not simply “maximum for current difficulty.” Low/normal/superior and ethereal bases can qualify; socket cap depends on item data/ilvl bands |
| Larzuk, magic | 1 or 2 sockets with equal selection chance, limited by the base's allowed cap |
| Larzuk, rare/set/unique/crafted | 1 socket if socketable; cannot add to already socketed item; unsocketable types rejected |
| Hellforge Normal | Uniform rune selection from **El, Eld, Tir, Nef, Eth, Ith, Tal, Ral, Ort, Thul, Amn** |
| Hellforge Nightmare | Uniform selection from **Sol, Shael, Dol, Hel, Io, Lum, Ko, Fal, Lem, Pul, Um** |
| Hellforge Hell | Uniform selection from **Hel, Io, Lum, Ko, Fal, Lem, Pul, Um, Mal, Ist, Gul** |
| Hellforge multiplayer | Do not multiply the rune reward blindly by eligible party size. Shared quest credit/gem generation can consume multiple characters' quest opportunities; full allocation matrix U |
| Ancients minimum levels | **20 / 40 / 60** for completion credit. Each must meet requirement; no arbitrary minimum-level gate on ordinary act-boss travel |
| Ancients XP cap | Reward is at most the XP span needed for one character-level advancement; excess base reward discarded. It is not boosted by player count, Experience Shrine, Annihilus or Ondal's Wisdom |
| Anya death bug | Original LoD can lose applied Anya quest resistance bonuses after softcore death until leaving/rejoining, while the character screen still displays them. Treat this as a classic compatibility issue; do not copy D2R's fix |
| Anya portal closure | Legacy portal closes after **both** Nihlathak quest completion and activation of Halls of Pain WP. Either alone is insufficient. WP remains a route into halls. This is not the D2R always-open portal |
| Unclaimed item services | Imbue/socket/personalize need not be used when earned; difficulty-specific pending service persists across games |

Sources: [Rewards](https://classic.battle.net/diablo2exp/quests/rewards.shtml), [Act V](https://classic.battle.net/diablo2exp/quests/act5.shtml), [classic Anya bug report](https://us.forums.blizzard.com/en/d2r/t/d2-massive-diablo-ii-bug-list/389), [legacy portal condition discussion](https://www.reddit.com/r/Diablo/comments/pur6xo/info_for_all_the_pindle_portal_stays_open_now/). The two community bug/portal references are corroboration, not primary executable specifications.

## 3. Town NPCs, services and travel

Inventories below are **categories**, not a claim that every weapon base is sold at every level. Actual shop stock varies with NPC, difficulty, character level, act restrictions, `Weapons/Armor/Misc.txt` vendor columns and refresh rules. Repair is a distinct service: a weapon seller is not automatically a repairer. Gambling generates items rather than selling ordinary shop stock.

Sources: Blizzard NPCs [A1](https://classic.battle.net/diablo2exp/npcs/act1.shtml), [A2](https://classic.battle.net/diablo2exp/npcs/act2.shtml), [A3](https://classic.battle.net/diablo2exp/npcs/act3.shtml), [A4](https://classic.battle.net/diablo2exp/npcs/act4.shtml), [A5](https://classic.battle.net/diablo2exp/npcs/act5.shtml); [vendors](https://classic.battle.net/diablo2exp/basics/vendors.shtml), [gambling](https://classic.battle.net/diablo2exp/basics/gambling.shtml).

| Act | NPC | Trade categories | Repair | Gamble | Heal | Other |
|---|---|---|---|---|---|---|
| I | Akara | Wands, staves, scepters, potions, scrolls, tomes, keys | — | — | Yes | Den/respec, Cain quest, ring |
| I | Charsi | Weapons, armor, arrows/bolts | Yes | — | — | Malus and imbue |
| I | Gheed | Weapons, armor, ammunition, keys | — | Yes | — | Merchant dialogue |
| I | Kashya | — | — | — | — | Rogue hiring/resurrection; Blood Raven |
| I | Deckard Cain | — | — | — | — | Identify after rescue |
| I | Warriv | — | — | — | — | Travel east to Lut Gholein after Andariel |
| II | Atma | — | — | — | Yes | Radament quest / discount |
| II | Fara | Armor, weapons, ammunition | Yes | — | Yes | Blacksmith |
| II | Drognan | Wands, staves, scepters, tomes, scrolls, potions | — | — | — | Tainted Sun / Arcane dialogue |
| II | Elzix | Armor, weapons, ammunition | **No** | Yes | — | Innkeeper |
| II | Lysander | Potions, keys | — | — | — | Apothecary |
| II | Greiz | — | — | — | — | Desert hiring/resurrection |
| II | Cain | — | — | — | — | Identify and staff instructions |
| II | Geglash | — | — | — | — | Dialogue only |
| II | Jerhyn | — | — | — | — | Palace permission; authorizes Meshif voyage; not a ferry himself |
| II | Kaelan | — | — | — | — | Palace guard, blocks entry by quest state |
| II | Meshif | — | — | — | — | Sail east to Kurast after Duriel/Tyrael/Jerhyn sequence |
| II | Warriv | — | — | — | — | Travel west to Rogue Encampment |
| III | Alkor | Potions | — | Yes | — | Golden Bird/life potion; Tome/stat reward |
| III | Asheara | Armor, weapons, ammunition | — | — | — | Iron Wolf hiring/resurrection |
| III | Hratli | Armor, weapons, ammunition, keys | Yes | — | — | Gidbinn-related dialogue |
| III | Ormus | Armor, caster weapons, potions, scrolls, tomes | — | — | Yes | Gidbinn rare ring / progression |
| III | Cain | — | — | — | — | Identify; Khalim instructions |
| III | Meshif | — | — | — | — | Sail west to Lut Gholein; figurine/bird exchange |
| III | Natalya | — | — | — | — | Dialogue; availability changes with progression |
| IV | Halbu | Armor, weapons, ammunition | Yes | — | — | Blacksmith |
| IV | Jamella | Armor, weapons/caster weapons, potions, scrolls, tomes | — | Yes | Yes | Merchant |
| IV | Cain | — | — | — | — | Identify; Hellforge instructions |
| IV | Tyrael | — | — | — | — | Any merc resurrection; Izual reward; Act V portal after Diablo |
| V | Larzuk | Armor, weapons, ammunition | Yes | — | — | Shenk/socket service |
| V | Malah | Armor, caster weapons, potions, keys, scrolls, tomes | — | — | Yes | Anya potion and resistance scroll |
| V | Nihlathak | — | — | Yes | — | Early town NPC; disappears during Anya/Nihlathak progression |
| V | Anya | Armor, katars, throwing weapons, keys, arrows | — | Yes | — | Available after rescue; rare reward, personalize, red portal |
| V | Qual-Kehk | — | — | — | — | Barbarian hiring/resurrection after rescue |
| V | Cain | — | — | — | — | Identify |

Nonresident actors: **Flavie** guards the Blood Moor/Cold Plains border; **Hadriel** guards the River/Chaos approach; **Izual's spirit** appears after his defeat; **Tyrael in Duriel's Lair** provides story exit, and **Tyrael in the Worldstone Chamber** appears in the ending. Do not create their ordinary town shop services.

### 3.1 Shared services and town object placement

| System | Required behavior / placement evidence |
|---|---|
| Stash | One private character stash shared across that character's acts/difficulties, not across characters. Original LoD stash 6×8 item grid; no D2R shared tabs. Gold cap 2,500,000 in 1.13+; safe persistent storage |
| Town waypoint | Fixed town preset object; automatically accessible town destination as progression permits. Field WP must be clicked individually; not party-shared |
| Placement by act | Rogue Encampment, Lut Gholein, Kurast Docks, Pandemonium Fortress and Harrogath each have stash near the starting/town-service region and a fixed town WP. **Exact object grid coordinates, portal landing tiles and NPC spawn coordinates are U**; use original town DS1 presets, not guessed screen positions |
| Cain | Identifies eligible unidentified carried items; does not identify items left in stash. Cube contents supported. Rescue enables free service; if skipped, Rogues eventually rescue him but he charges **100 gold/item** for that difficulty |
| Healers | Town healing restores life/mana/stamina and removes appropriate harmful states; also heals merc. Do not charge for the ordinary healing service |
| Repair | Restores durability and, where appropriate, charges; repair cost depends on item. Merc equipment never consumes durability. Ethereal player equipment normally cannot be repaired |
| Shops | Re-entering/refreshing the relevant game/area changes randomized stock under original rules. Infinite consumables versus generated equipment are different stock types; full vendor ilvl/cap table U |
| Gambling | Dedicated gamble list; price depends on item and level. Original gamble quality odds and base-upgrade odds should be sourced in item-system research; do not assume shop ilvl formula |
| Act travel | A1→A2 Warriv; A2→A3 Meshif with Jerhyn approval; A3→A4 Mephisto red portal; A4→A5 Tyrael. Activated WPs permit later cross-act travel without replaying cinematics |

Source: [Basics: stash, TP, WP](https://classic.battle.net/diablo2exp/basics/index.shtml), NPC pages above.

## 4. Mercenaries

### 4.1 Types, skills, equipment and unlocks

| Act / recruiter | Classic type | Skills | Equipment slots / restrictions | Unlock |
|---|---|---|---|---|
| I / Kashya | Rogue Scout, fire or cold | Inner Sight + Fire Arrow / Cold Arrow | Helm, body armor, ordinary bow; **no crossbow, no Amazon-only bow** in original LoD | Blood Raven reliably unlocks. Summit pages disagree about nonquest fallback threshold, level 8 vs 9: U |
| II / Greiz | Desert Guard, combat/defensive/offensive | Jab + aura determined by hire difficulty | Helm, body armor, spear/polearm/javelin melee weapon; no shield, no thrown-javelin AI | Act II hiring access |
| III / Asheara | Iron Wolf, fire/cold/lightning | Fire: Inferno/Fire Ball. Cold: Glacial Spike/Ice Blast/Frozen Armor. Lightning: Charged Bolt/Lightning | Helm, body armor, sword, shield; primarily caster AI | Act III access; Gidbinn reward conditions separately apply |
| IV / Tyrael | No native hireling type | Existing merc retained | Existing equipment/type | Resurrection service only |
| V / Qual-Kehk | Barbarian | Bash, Stun | Helm including Barbarian-class helm, body armor, **one sword**; not D2R dual-wield/Frenzy | Rescue on Mount Arreat |

| Desert category | Hired in Normal | Hired in Nightmare | Hired in Hell |
|---|---|---|---|
| Combat | Prayer | Thorns | Prayer |
| Defensive | Defiance | Holy Freeze | Defiance |
| Offensive | Blessed Aim | Might | Blessed Aim |

Hire difficulty determines the aura permanently; bringing a Normal Prayer merc into Nightmare does not convert him to Thorns. Aura activation is AI-driven, not guaranteed immediately upon spawn.

### 4.2 Raw expansion stat rows — not literal per-level increments

T-H has separate original/non-expansion rows and expansion rows (`Version=100`). Use the expansion rows. The following are **base row constants at the first breakpoint**, not guaranteed visible statistics of the random merc offered by an NPC. Normal recruits start with more favorable native stat rows than equivalent higher-difficulty hires in the classic system.

| Normal-hire family | Row level | Raw Gold | HP / HPPerLvl | Defense / DefPerLvl | Strength / StrPerLvl | Dexterity / DexPerLvl | AR / ARPerLvl | Damage / DmgPerLvl | Resist / ResistPerLvl | Later Normal row breakpoints |
|---|---|---|---|---|---|---|---|---|---|---|
| Rogue fire | 3 | 100 | 45 / 9 | 15 / 8 | 35 / 10 | 45 / 16 | 10 / 12 | 1–3 / 2 | 0 / 8 | 36, 67 |
| Rogue cold | 3 | 150 | Same | Same | Same | Same | Same | Same | Same | 36, 67 |
| Desert all three | 9 | 350 | 120 / 15 | 45 / 11 | 57 / 14 | 40 / 12 | 20 / 12 | 7–14 / 4 | 18 / 8 | 43, 75 |
| Iron Wolf fire/lightning | 15 | 1000 | 160 / 9 | 80 / 5 | 49 / 10 | 40 / 8 | 15 / 12 | 1–7 / 4 | 25 / 7 | 49, 79 |
| Iron Wolf cold | 15 | 1500 | Same | Same | Same | Same | Same | Same | Same | 49, 79 |
| Barbarian | 28 | 9000 | 288 / 18 | 180 / 10 | 101 / 15 | 63 / 10 | 150 / 20 | 16–20 / 6 | 56 / 7 | 58, 80 |

Additional raw hire cost fields, **not final displayed prices**:

| Type | NM Gold field | H Gold field |
|---|---|---|
| Rogue fire/cold | 6000 / 7500 | 12500 / 14000 |
| Desert | 7900 | 15000 |
| Iron fire/cold/lightning | 9500 / 12000 / 10000 | 21000 / 27000 / 21000 |
| Barbarian | 18000 | 32000 |

**Do not interpret raw `StrPerLvl=10` as +10 Strength every level.** Several fields are fractional fixed-point increments; skill `LvlPerLvl` is also encoded rather than literal skill levels per ten character levels. Denominators, offsets, rounding, resistance difficulty penalties/caps, complete hiring level range and the price calculation remain U. Preserve all row fields and breakpoint rules from T-H rather than fitting one linear formula to this excerpt. `Level=3/9/15/28` is a table baseline, not a hard character-level requirement to enter each act.

### 4.3 Persistence, XP, healing and resurrection

| System | Classic rule |
|---|---|
| Limit | One hireling per character; travels between acts, difficulties and games |
| Replacement | Hiring a new merc permanently replaces old one. Remove equipment first or it is lost |
| Death | Equipment, XP and level retained for resurrection; owner death kills merc too |
| Revival | Recruiters and Act IV Tyrael revive existing merc of any act type; fee increases with level and is capped at **50,000 gold**. Exact hardcoded formula U |
| XP | Gains from own kills, owner kills and owner's summons; not unrelated party members' kills. Does not subtract from player's XP |
| Level ceiling | Cannot level above owner. Summit states maximum **98**; exact 1.14 maximum/edge cases need validation before hardcoding |
| Healing | Regeneration, town healer, well, level-up, fed healing/rejuvenation potions. Shift+1–4 feeds from belt; potion can also be given directly |
| Mana | Mercs do not consume mana for skills; mana potions and Energy/Mana modifiers do not help them |
| Gear | Strength/Dexterity/level requirements apply; durability never decreases, making ethereal gear valuable. Owner's general bonuses do not automatically transfer |
| Damage scaling | Mercenary boss damage and boss-versus-merc multipliers differ by difficulty; complete exact combat table U |

Source: [Arreat Summit hirelings](https://classic.battle.net/diablo2exp/basics/hirelings.shtml), T-H.

## 5. Monster families, AI and ordinary stats

### 5.1 Families and behavior catalogue

The following summarizes family behavior; it is **not** a replacement for per-ID attack/AI parameters. Many families cross acts. Appendix A lists actual area candidate IDs, including Act V guest variants. A family can contain melee and ranged variants with different AI. Undead/demon/animal are damage-bonus classifications, not mutually inferred from appearance.

| Family / translated variants | Main acts | IDs / AI anchors | Behavior and special abilities |
|---|---|---|---|
| Fallen, Carver, Devilkin, Dark One, Warped One | I; V waves/guests | `fallen*`, `Fallen` | Pack melee, flee after nearby ally death; resurrectable by shaman; repeated resurrection is not an unlimited XP/loot source |
| Corresponding Fallen Shamans | I; V | `fallenshaman*`, `FallenShaman` | Ranged fire missiles; raise matching Fallen corpses; shaman group spawning adds monsters beyond area candidate list |
| Zombie, Hungry Dead, Ghoul, Drowned Carcass, Plague Bearer | I–III | `zombie*`, `Zombie` | Slow pursuing undead melee; variant elemental/poison traits; usable corpses |
| Skeleton, Returned, Bone Warrior, Burning Dead, Horror | I–III; V guests | `skeleton*`, `Skeleton` | Undead melee; no ordinary life/mana leech on skeletons; can be raised by greater mummies |
| Skeleton archers / elemental mages | I–III; V guests | `sk_archer*`, `skmage_fire/ltng/cold/pois*` | Bow volleys or element-specific missiles; different IDs for damage element |
| Quill Rat, Spike Fiend, Thorn Beast, Razor Spine | I; V guests | `quillrat*`, `QuillRat` | Ranged quills, stronger volley behavior; melee when engaged; NM/H can add variant elemental damage |
| Gargantuan Beast, Brute, Yeti, Crusher, Wailing Beast | I–III | `brute*`, `Brute` | Large melee, heavy hits; navigation/door capability varies |
| Corrupt Rogue, Dark Hunter, Vile Hunter, Dark Stalker, Black Rogue, Flesh Hunter | I; III temples; V guests | `corruptrogue*` | Fast melee; separate bow and spearwoman IDs `cr_archer*`, `cr_lancer*` |
| Goatmen: Flesh/Blood/Moon/Night/Death Clan | I–II; V guests | `goatman*` | Aggressive melee, packs; family/variant resistance differences |
| Blood Hawk/Foul Crow and nests | I; III; V guests | `foulcrow*`, `crownest*` | Flying attackers; stationary nests spawn birds until destroyed |
| Tainted/Misshapen/Disfigured and kin | I; IV; V guests | `bighead*`, `Bighead` | Melee plus lightning projectile; not identical to Willowisp beam AI |
| Giant spiders: Arach/Sand/Frost/Poison/Flame types | I–III; V guests | `arach*` | Melee/poison; retreat/engage behavior, strong elemental variant defenses |
| Wraith/Ghost/Specter/Apparition/Dark Shape | I–III; V guests | `wraith*`, `Wraith` | Phasing/flying movement, drain/mana threat; often physical immune in Hell; avoid drops outside walkable floor |
| Vampires: Ghoul Lord/Night Lord/Dark Lord/Blood Lord | I–III; V guests | `vampire*`, `Vampire` | Fire Ball, Fire Wall, Meteor; caster spacing. Distinct from Act V Frenzy `bloodlord*` |
| Flying Scimitar, Gargoyle Trap | I–II | dedicated IDs / static AI | Animated weapon or fixed projectile trap; special corpse/loot rules |
| Leapers: Sand/Desert/Tomb/Cave and kin | II–IV; V guests | `sandleaper*`, `SandLeaper` | Jump, attack, disengage; low mass, swarm pressure |
| Dung Soldier, Death Beetle, Scarab, Steel/Bone Scarab | II; III temples; V guests | `scarab*`, `Scarab` | Jab/melee; emits Charged Bolts when hit; regeneration differs by subtype |
| Sand/Rock/Devourer maggots, eggs, young | II; IV; V guests | `sandmaggot*`, egg/young IDs | Poison spit, burrow, lay eggs; young add population; queen is special stationary breeder |
| Carrion Bird/Undead Scavenger and vulture kin | II–III; V | `vulture*` | Flying approach/landing attack; corpse interaction |
| Itchies/Black Locust/Hell Swarm and kin | II–III; V | `swarm*` | Insect swarms; stamina-drain threat, substantial physical resistance |
| Sabre Cat / Huntress / Night Tiger / Hell Cat; spear/potion slingers | II; V guests | `pantherwoman*`, `slinger*` | Melee cats or thrown spears/exploding/poison potions; do not merge ranged and melee stats |
| Mummy/Decayed One/Embalmed/Preserved Dead/Cadaver | II–III; V guests | `mummy*`, `Mummy` | Slow undead melee; poison/death-cloud attacks |
| Hollow One/Guardian/Unraveler/Horadrim Ancient | II–III; V | `unraveler*`, `Unraveler` | Resurrect allied undead; ranged magic missiles; poison melee. Some Hell variants magic immune |
| Sand Raider/Marauder/Invader/Infidel/Assailant | II–III; V guests | `sandraider*`, `SandRaider` | Fast multiarmed melee sequences; variant elemental additions |
| Claw/Pit Viper/Salamander/Tomb Viper/Serpent Magus | II–III; V | `clawviper*`, `ClawViper` | Charge/knockback and ranged elemental attacks by subtype. Legacy Halls of Vaught Tomb Viper poison-cloud physical tick bug requires separate validation |
| Bat Demon/Desert Wing/Fiend/Gloombat/Blood Diver | II–IV; V guests | `batdemon*` | Flying approach, melee/lightning-oriented subtype behavior |
| Dune Beast/Rock Dweller/Jungle Hunter and kin | II–III; V guests | `baboon*`, `Baboon` | Agile melee/pack behavior |
| Blunderbore/Gorbelly/Mauler/Urdar | II–IV; V guests | `blunderbore*` | Huge melee, stun/Crushing Blow threat; useful Revives |
| Fetish/Flayer/Soul Killer/Stygian Doll | I late caves; III; V | `fetish*`, `Fetish` | Very fast small melee, group attacks |
| Blow Pipe Fetish | III; V | `fetishblow*` | Ranged blowgun missiles |
| Fetish Shamans | III; V | `fetishshaman*` | Inferno, resurrect fetish; death releases lower fetish stage |
| Undead Bone Fetish/Bone Flayer/Soul Killer/Stygian Doll | III; V | `bonefetish*` | Fast melee; **physical death explosion** threatens nearby players; not ordinary living fetishes |
| Giant Mosquito/Sucker/Feeder/Blood Wing | III | `mosquito*` | Flying melee, stamina drain |
| Bog Creature/Swamp Dweller/Slime Prince | III | `frogdemon*` | Emerges from water, attacks/spits, submerges |
| Thorned Hulk/Bramble Hulk/Thrasher | III; V guests | `thornhulk*` | Heavy melee, Frenzy-like attack pressure |
| Gloam/Swamp Ghost/Burning Soul/Black Soul | III–IV; V | `willowisp*`, `WillOWisp` | Invisible approach, long piercing lightning beams; exceptional danger with Conviction |
| Zealot/Faithful and Sexton/Cantor/Hierophant | III; V guests | `zealot*`, `cantor*` | Zealot melee; priests heal allied monsters and cast ranged spells; quest state affects city behavior |
| Council Member | III; V wave | `councilmember*`, `baalhighpriest` | Melee, Hydra, healing; unique modifiers multiply group danger |
| Vile Mother/Flesh Spawner/Stygian Hag and offspring | IV; V guests | `vilemother*` | Produces young attackers; parent and offspring are separate records |
| Finger Mage/Doom Caster/Strangler/Storm Caster | IV; V guests | `fingermage*` | Flying ranged homing/draining spells |
| Regurgitator/Grotesque/Corpulent/Maw Fiend | IV; V guests | `regurgitator*` | Consumes corpses, spits corpse projectiles; corpse economy interaction |
| Doom/Abyss/Oblivion Knights | IV; V guests | `doomknight*`, `dkmag*` | Melee knight / caster knight variants; curses and Bone Spirit. **Oblivion Knight Iron Maiden removed in 1.13**, do not reproduce old melee reflect curse |
| Balrog/Pit Lord/Venom Lord and kin | IV; V | `megademon*`, `venomlord` | Heavy melee and Inferno; high fire resistance/immunity |
| Enslaved/Slayer/Ice Boar/Fire Boar/Hell Spawn | V | `minion*`, `Minion` | Melee; Overseer can whip into faster/frenzied or suicide forms |
| Suicide Minions | V | `suicideminion*` | Runs to target, self-detonates; not ordinary minion attack |
| Overseer/Lasher/Overlord/Blood Boss/Hell Whip | V | `overseer*`, `Overseer` | Whips minions, buffs/transforms them; melee threat |
| Demon Imp and kin | V | `imp*`, `Imp` | Teleport/ranged fire; mounts siege beasts/towers and attacks from them |
| Siege Beast/Crush Beast/Blood Bringer | V | `siegebeast*` | Large melee; can host mounted imp attacks |
| Death Mauler and kin | V | `deathmauler*` | Ground/tendril ranged strikes plus melee |
| Frozen Horror/Glacial Monstrosity/Frozen Terror | V | `frozenhorror*`, `FrozenHorror` | Arctic Blast and melee; strong cold defenses |
| Abominable/Snow Drifter/Frozen Abyss/Frozen Scourge | V | `snowyeti*` | Large cold melee |
| Rot Walker/Reanimated Horde/Prowling Dead/Unholy Corpse/Defiled Warrior | V | `reanimatedhorde*`, `ReanimatedHorde` | Charge; corpses can reanimate; temple corpses initially rise from ground |
| Succubus/Vile Temptress/Stygian Fury and witches | V | `succubus*`, `succubuswitch*` | Blood-star missiles; Defense/Blood Mana curses according to life/mana conditions |
| Moon Lord/Night Lord/Blood Lord/Death Lord/Hell Lord | V | `bloodlord*`, `BloodLord` | Dual-weapon **Frenzy** melee; distinct from vampire Blood Lords |
| Putrid Defiler/Fetid Defiler/Rancid Defiler | V | `putriddefiler*` | Infects allies, produces Pain Worm stage on infected monster death |
| Minion of Destruction | V Baal wave | `baalminion*` | Knockback/stun/heavy melee; special wave pack |
| Hell Bovine | Secret Cow Level | `hellbovine` | Dense, hard-hitting polearm melee packs; Cow King special |
| Barricades/doors/towers/catapults | V | object-like monster IDs | Destructible blockers/static attacks; do not treat all as normal loot/XP monsters |

Sources: [Monster index and act bestiaries](https://classic.battle.net/diablo2exp/monsters/), [monster basics](https://classic.battle.net/diablo2exp/monsters/basics.shtml), T-M, T-L.

### 5.2 Representative Normal one-player base stats

`A1` means the ordinary first attack only, not every missile/skill the monster can use. AR = Attack Rating; Def = defense; XP = base kill XP before character-level/party penalties. **S** rows reproduce Summit or legacy Basin tables; **D** rows are integer-truncated snapshot calculations, explicitly provisional. Do not conflate alvl with Normal native monster level: an Enslaved can be native level 31 in an alvl-24 area.

| Monster / ID | Evidence | Native N level | HP | A1 damage | A1 AR | Def | XP | Important additional data |
|---|---|---|---|---|---|---|---|---|
| Fallen / `fallen1` | S | 1 | 1–4 | 1–2 | 8 | 5 | 18 | Flee/raise; Hell fire resist 100 |
| Carver / `fallen2` | S | 5 | 4–9 | 2–4 | 31 | 25 | 42 | Hell fire resist 110 |
| Devilkin / `fallen3` | S | 7 | 4–12 | 2–5 | 52 | 35 | 53 | Hell fire resist 120 |
| Dark One / `fallen4` | S | 10 | 8–19 | 3–7 | 80 | 50 | 72 | Hell fire resist 125 |
| Zombie / `zombie1` | S | 1 | 7–12 | 1–3 | 8 | 5 | 33 | A2 2–3, AR8; poison resist N50; block3 |
| Gargantuan Beast / `brute1` | legacy Basin | 2 | 11–19 | 2–3 | 12 | 10 | 48 | A2 3–4 |
| Fallen Shaman / `fallenshaman1` | legacy Basin | 2 | 5–9 | 1–3 | 12 | 10 | 32 | Fire resist25; separate ranged fire1–4 skill |
| Quill Rat / `quillrat1` | S | 1 | 1–5 | 1–2 | 8 | 5 | 21 | Separate A2/projectile values; do not use A1 for quill damage |
| Dung Soldier / `scarab1` | S | 14 | 32–53 | 5–15 | 125 | 70 | 211 | A2 5–12; Charged Bolts/Jab |
| Death Beetle / `scarab2` | S | 16 | 38–62 | 6–17 | 145 | 80 | 256 | Regenerates faster; lightning/poison additions |
| Flayer / `fetish3` | D | 22 | ≈55–89 | ≈10–15 | ≈207 | ≈112 | ≈286 | Melee, not blowgun or undead doll |
| Gloam / `willowisp1` | D | 21 | ≈34–67 | ≈5–21 | ≈197 | ≈107 | ≈244 | A1 excludes dangerous lightning beam; N physical40/lightning50 |
| Balrog / `megademon1` | D | 24 | ≈179–215 | ≈8–15 | ≈303 | ≈145 | ≈566 | N fire70; Inferno separately |
| Enslaved / `minion1` | D | 31 | ≈269–337 | ≈15–19 | ≈483 | ≈187 | ≈1179 | Hell cold130 in this record |
| Rot Walker / `reanimatedhorde1` | D | 31 | ≈163–242 | ≈6–17 | ≈444 | ≈199 | ≈903 | N poison70; charge/reanimation |
| Frozen Horror / `frozenhorror1` | D | 37 | ≈541–720 | ≈14–22 | ≈486 | ≈224 | ≈2562 | N cold75; Arctic Blast separately |

Sources: [Fallen](https://classic.battle.net/diablo2exp/monsters/act1-fallen.shtml), [Zombie](https://classic.battle.net/diablo2exp/monsters/act1-zombie.shtml), [Spike Fiend](https://classic.battle.net/diablo2exp/monsters/act1-spikefiend.shtml), [Scarab Demon](https://classic.battle.net/diablo2exp/monsters/act2-scarabdemon.shtml), [legacy Den tables, revised 2012](https://www.theamazonbasin.com/wiki/index.php/Den_of_Evil_(area)), T-M/T-ML.

### 5.3 Scaling, resistance and immunity rules

| Topic | Original LoD rule |
|---|---|
| Ordinary monster levels | Normal generally uses monster's native `MonStats.Level`, not area alvl. NM/H ordinary populations use area expansion alvl; bosses/fixed special monsters have exceptions |
| Stat factors | Ratio-scaled `minHP/maxHP`, attack damage, AR, AC and XP fields are percentage factors of level tables, **not direct HP/damage**. Normal uses lower-case `minHP/maxHP`; NM/H fields are `MinHP(N/H)/MaxHP(N/H)` with different capitalization |
| Life calculation caution | Preserve original integer/fixed-point operations. Rounding every factor to nearest integer produces wrong boss values. Floor-only estimates can also differ for some expansion monsters. Validate before treating generated tables as exact |
| Elite levels | Champions +2; unique/superunique and minions +3. HP/defense scaling lookup is not simply recalculated from displayed elite level in all cases; e.g. Corpsefire HP derives from native N/area NM-H base stats |
| Elite HP multiplier | Summit: minions ×2/1.75/1.5; champions ×3/2.5/2; uniques ×4/3/2 in N/NM/H. **Conflict:** legacy Basin Den page gives Normal minion ×3. 1.14 oracle required for this minion discrepancy |
| Elite XP | Other champions ×3; Berserker ×5; unique/minions ×5. Player level difference and high-level XP penalties apply later |
| Monster regeneration | `DamageRegen` and skills determine regeneration; poison/Open Wounds/Prevent Monster Heal interactions and applicability differ. Do not blanket-enable PMH on every boss or mercenary hit |
| Resistance fields | Physical, magic, fire, lightning, cold and poison independent. Immunity at **100 or greater**; negative resistance increases damage. Never infer all Hell monsters have the same immunity |
| Example Hell base values | `fallen1`: physical15/fire100/cold40; `zombie1`: physical50/cold120/poison75; `scarab1`: physical50/lightning100; `fetish3`: fire33/lightning33/cold100/poison50; `willowisp1`: physical60/lightning100; `frozenhorror1`: physical25/lightning33/cold150/poison33. These are per-ID T values, not universal family constants |
| Immunity breaking | Conviction affects fire/cold/lightning, not poison/magic/physical. Lower Resist affects fire/cold/lightning/poison, not physical/magic. Against an immune resistance these operate at **1/5 effectiveness**; resistance must fall below100 |
| Classic physical breaking | Amplify Damage normally −100 physical resist; Decrepify −50; against physical immunity reductions are penalized to one fifth. Thus Amp breaks base physical100 to80, but not base120 to100 |
| Item −enemy resist / Cold Mastery | Cannot independently break immunity in classic LoD. After immunity is broken by an eligible effect, their normal nonimmune reduction can apply. No Sunder/D2R Cold Mastery penalty model |
| Unique resistance mods | Applied in displayed order; resistance bonuses do not create a third immunity or increase one of two existing immunities. Extra mods can turn single-immunity Hell monsters dual immune |
| Player count | Spawn-time HP/XP factor `(players+1)/2`, 1–8 players; not retroactively applied to spawned monsters. `/players X` is original SP/open/TCP-IP tooling, not a closed-realm command |
| Leech | Scaled by difficulty and monster `Drain`; physical damage/resistance matters. Zero-drain targets, notably some bosses/undead, are not ordinary leech sources |
| Control immunity | Ordinary monsters can be frozen/stunned/AI-controlled where flags permit. Champions/uniques generally chill rather than freeze and have limited stun/AI interaction. Act bosses cannot be frozen/stunned/converted; slow effects are not all identical |

Sources: [Monster basics](https://classic.battle.net/diablo2exp/monsters/basics.shtml), [bonuses](https://classic.battle.net/diablo2exp/monsters/bonus.shtml), [boss rules](https://classic.battle.net/diablo2exp/monsters/bosses.shtml), [Conviction](https://classic.battle.net/diablo2exp/skills/paladin-offense.shtml#conviction), [Lower Resist/physical curses](https://classic.battle.net/diablo2exp/skills/necromancer-curses.shtml), [Cold Mastery](https://diablo.fandom.com/wiki/Cold_Mastery).

### 5.4 Unique modifiers that affect encounter implementation

| Modifier | Relevant exact/near-exact classic behavior |
|---|---|
| Extra Strong | Unique damage +135/+112/+99%, AR +90/+75/+66%; minion damage +67/+56/+49%, AR +45/+37/+33%, N/NM/H |
| Extra Fast | +100 movement-speed modifier, unique/minions; not simply “double every animation speed” |
| Cursed | 75% on-hit chance to apply Amplify Damage, skill level `floor(mlvl/5)+1` |
| Fire/Cold/Lightning Enchanted | +75 corresponding resist; added elemental damage; FE death explosion, CE death nova, LE triggered bolts |
| Lightning Enchanted | Hit/recovery emits 8 bolts; bolt level `floor(mlvl/2)`; per-bolt damage `2×level−1` |
| Cold Enchanted | Death Frost Nova level `floor(mlvl/2)`; radius/skill damage need skill tables |
| Fire Enchanted death | Uses ordinary monster maximum base life, not elite/player-scaled HP: combined physical/fire percentages N11.25–18.75%, NM7–11.66%, H0.75–1.25%; radii 2⅔ / 3⅓ / 4 yards, per Summit updated bonus page |
| Magic Resistant | +40 fire/cold/lightning when applicable to preexisting nonimmune resist; not a random Normal modifier |
| Spectral Hit | Random magic/fire/lightning/cold/poison attack additions. **Source conflict:** updated Summit says +40 elemental resist if below75, while legacy Corpsefire Basin table shows +20. Preserve T modifier and validate actual 1.14 application |
| Stone Skin | +50 physical resist, doubles base defense; common source of Hell physical immunity |
| Mana Burn | +20 magic resist and mana damage; classic melee mana-damage bug can multiply mana damage by256 |
| Teleport | Low-life / ranged-target proximity behavior; generic unique may regain life, whereas Baal teleport does not heal |
| Aura Enchanted | Might/Holy Fire `floor(mlvl/6)`; Blessed Aim `/5`; Holy Freeze `/7`; Holy Shock/Conviction/Fanaticism `/8`; minimum1, Holy Shock requires mlvl20. De Seis uses fixed Fanaticism |
| Nightmare/Hell additions | Typical superunique gains +1/+2 random modifier. Among specially handled bosses only Griswold/Radament/Nihlathak receive random unique bonuses; do not attach random mods to all act bosses |
| Champion variants | Champion, Ghostly, Fanatic, Berserker, Possessed have different HP/damage/movement/cursing rules; Possessed cannot be cursed; not five cosmetic color swaps |

Source: [Monster bonuses](https://classic.battle.net/diablo2exp/monsters/bonus.shtml), [superuniques](https://classic.battle.net/diablo2exp/monsters/super.shtml), T-B/T-SU.

## 6. Superuniques and bosses

Abbreviations: ES Extra Strong; EF Extra Fast; FE/CE/LE elemental enchanted; MR Magic Resistant; MB Mana Burn; SS Stone Skin; SH Spectral Hit; AE Aura Enchanted; C Cursed; TP Teleport. Minion counts below are T-SU dedicated entourage counts; summoned offspring, preset guards and surrounding ordinary monsters are additional. Minions usually share the base family, not necessarily the boss's every modifier.

### 6.1 Act bosses and special fixed-stat bosses

**HP evidence:** S = dedicated Summit table, V = corroborated legacy database/search, D = provisional extraction. Values are base one-player life before any supported extra modifiers. Do **not** multiply specially handled bosses again by the ordinary unique multiplier.

| Boss / location | Level N/NM/H | HP N / NM / H | Abilities, entourage and notable drops |
|---|---|---|---|
| Andariel / Catacombs 4 | 12/49/75 | **S 1,024 / 24,800 / 60,031** | Poison spray/cloud, melee; no formal minion pack. Fire resist **−50 all difficulties**. Act quest drop; Hell Suffering essence |
| Duriel / Duriel's Lair | 22/55/88 | **S 3,995 / 55,799 / 84,524** | Holy Freeze5/5/6, Jab, Smite/knockback; **does not use Charge** per Summit. No minions; frequently TP-scroll-heavy drops; Hell Suffering essence |
| Mephisto / Durance 3 | 26/59/87 | **S 6,036 / 74,547 / 94,320** | Lightning, Charged Bolt, poison nova, skull missile, Frost Nova, Blizzard. Surrounding Council/vampires not formal minions; soulstone; Hell Hatred essence |
| Diablo / Chaos Sanctuary | 40/62/94 | **S 13,818 / 90,749 / 113,812** | Fire Nova/Wall/Firestorm, cold touch, Bone Prison, Charge, red lightning hose **half physical/half lightning**; seal spawn sequence; Hell Terror essence |
| Baal / Worldstone Chamber | 60/75/99 | **S 26,484 / 117,596 / 493,701** | Teleport, clone, tentacles, Hoarfrost knockback, Incineration Nova, Mana Rift, curses; clone not quest target; Hell Destruction essence |
| Blood Raven / Burial Grounds | 10/43/88 | **V 113 / 9,832 / 57,829** | Fire arrows, evasive archer AI, raises Hungry Dead; no random unique bonuses. Quest merc reward, ordinary boss loot |
| Griswold / Tristram | 5/39/84 | **S 103 / 3,812 / 36,887** | Cursed melee; knockback immunity except special Sanctuary interaction; no formal minions; Cain rescue does not require killing him |
| Radament / Sewers 3 | 19/52/86 displayed | **V 278 / 4,840 / 29,760** | EF, poison/magic attacks, resurrection; 3 skeleton-type dedicated minions plus nearby undead. Book of Skill; Horadric Scroll in nearby chest |
| The Summoner / Arcane Sanctuary | 18/55/80 base table | **D ≈82–109 / 1,290–1,642 / 6,168–7,850** | Fire Wall/Glacial Spike/caster behavior; journal platform. Hell Key of Hate in event mode; fixed-stat exception, do not apply generic ×4/3/2 blindly |
| The Smith / Barracks | 10/42/79 base table | **D ≈101 / 2,916–3,280 / 21,968–24,714** | ES heavy melee; guards Malus stand; no formal minions |
| Izual / Plains of Despair | 29/60/86 | **D ≈11,946 / 41,812 / 57,366** | Cold melee/Frost Nova; very high HP; Tyrael grants2 skill points, boss does not drop skill book |
| Hephasto / River of Flame | 25/60/88 base table | **D ≈760 / 10,213 / 49,605** | SH+AE raw SU modifiers; high elemental defenses; Hammer quest drop; no formal minions |
| Nihlathak / Halls of Vaught | 68/73/95 displayed | **S 911 / 3,218 / 13,345** | Summon Minion, Minion Frenzy, Corpse Explosion, Arctic Blast, Teleport; no fixed entourage count. Hell Key of Destruction in event mode |
| Talic / Arreat Summit | 37/68/87 | **S 950–1,140 / 9,702–12,936 / 38,472–64,120** | Whirlwind; fire enchanted/fire immunity in Hell; no ordinary item drops |
| Madawc / Arreat Summit | 37/68/87 | **950–1140 / 9702–12936 / 38472–64120** | Double Throw, Shout; baseline Hell lightning resistance100; no ordinary item drops; [S-Madawc](https://classic.battle.net/diablo2exp/monsters/act5-madawc.shtml) |
| Korlic / Arreat Summit | 37/68/87 | **950–1140 / 9702–12936 / 38472–64120** | Leap Attack; baseline Hell cold resistance150; no ordinary item drops; [S-Korlic](https://classic.battle.net/diablo2exp/monsters/act5-korlic.shtml) |

Dedicated Summit sources: [Andariel](https://classic.battle.net/diablo2exp/monsters/act1-andariel.shtml), [Duriel](https://classic.battle.net/diablo2exp/monsters/act2-duriel.shtml), [Mephisto](https://classic.battle.net/diablo2exp/monsters/act3-mephisto.shtml), [Diablo](https://classic.battle.net/diablo2exp/monsters/act4-diablo.shtml), [Baal](https://classic.battle.net/diablo2exp/monsters/act5-baal.shtml), [Griswold](https://classic.battle.net/diablo2exp/monsters/act1-griswold.shtml), [Nihlathak](https://classic.battle.net/diablo2exp/monsters/act5-nihlathak.shtml), [Talic](https://classic.battle.net/diablo2exp/monsters/act5-talic.shtml), [Madawc](https://classic.battle.net/diablo2exp/monsters/act5-madawc.shtml), [Korlic](https://classic.battle.net/diablo2exp/monsters/act5-korlic.shtml). Corroboration: [legacy Blood Raven](https://diablo2.diablowiki.net/Blood_Raven), [legacy Radament](https://diablo2.diablowiki.net/Radament). Several dedicated boss-page level values differ from raw underlying MonStats levels by the +3 special-unit display bonus; preserve this distinction.

Boss combat exception: Ignore Target Defense ineffective; item −target-defense half effective on bosses. Crushing Blow uses half the ordinary current-life fraction: melee **1/8**, ranged **1/16**, before physical resistance and other scaling. Specific drain/chill/block resistances vary by boss, e.g. Mephisto has zero drain effectiveness in NM/H.

### 6.2 Remaining spawned superuniques

**Life column marked D is approximate:** calculated with native Normal/area NM-H HP factors and ×4/3/2, integer truncation. The method reproduces legacy Corpsefire and Pindleskin NM/H examples but some Normal expansion rows differ by several life points, and some special spawns need fixed-level exceptions. Do not round-trip D rows into exact 1.14 constants. Random HP-altering modifiers/player count can change realized life. Pindleskin's independently documented Normal range is used instead of the mismatching derived range.

| Act | Name / base ID | Location ID | Fixed mods / minions | HP N / NM / H | Behavior / notable drop |
|---|---|---|---|---|---|
| I | Corpsefire / `zombie1` | 8 | SH; 5 Zombies | **V 28–48 / 1,653–2,361 / 11,532–16,476** | Den clearance; slow melee |
| I | Bishibosh / `fallenshaman1` | 3 | MR+FE; 2 shaman minions plus Fallen | D ≈20–36 / 864–1,416 / 4,648–7,608 | Resurrect/fire missiles |
| I | Bonebreaker / `skeleton1` | 18 | ES+MR; 5 Skeletons | D ≈28–44 / 1,173–1,677 / 8,332–11,904 | Crypt melee; internal SU `Bonebreak` |
| I | Coldcrow / `cr_archer1` | 9 | CE; 4 Dark Rangers | D ≈52–76 / 864–1,494 / 5,788–9,996 | Cold archer |
| I | Rakanishu / `fallen2` | 4 | LE+EF; 8 Carvers | D ≈16–36 / 417–921 / 2,112–4,648 | Cairn Stones; flee and bolts |
| I | Treehead Woodfist / `brute2` | 5 | ES+EF; 2 Brutes | D ≈92–152 / 2,577–3,735 / 12,258–17,752 | Tree of Inifuss guardian |
| I | The Countess / `corruptrogue3` | 25 | FE; 6 Dark Stalkers | D ≈72–120 / 1,311–2,187 / 6,590–10,984 | Special rune drop; Hell Key of Terror in event mode |
| I | Pitspawn Fouldog / `bighead2` | 30 | C+CE; 4 Disfigured | D ≈96–184 / 1,356–2,505 / 5,942–10,972 | Lightning-projectile family |
| I | Bone Ash / `skmage_pois3` | 33 | MR+ES+CE; 0 | D ≈108–152 / 1,200–1,749 / 5,154–7,498 | Skeleton mage; internal `Boneash` |
| Cow | The Cow King / `hellbovine` | 39 | MR+LE; 6 cows | D ≈636–1,368 / 9,768–11,988 / 25,176–30,898 | Creation-lockout quest semantics; quest kill8 stamina potions |
| II | Creeping Feature / `mummy2` | 59 | ES+CE; 5 Decayed Ones | D ≈140–324 / 2,391–3,345 / 10,984–15,376 | Internal `Leatherarm` |
| II | Blood Witch the Wild / `pantherwoman1` | 60 | ES+C; 5 Huntresses | D ≈108–184 / 1,497–2,496 / 7,004–11,674 | Cube chest guard |
| II | Beetleburst / `scarab2` | 43 | MR; 3 beetles | D ≈152–248 / 1,746–2,745 / 7,204–11,322 | Hit-triggered bolts; translated subtype varies by source |
| II | Coldworm the Burrower / `maggotqueen1` | 64 | CE+MR; 0 formal | D ≈228–372 / 5,721–7,020 / 27,200–33,382 | Static queen, spawned young; staff chest |
| II | Fire Eye / `sandraider3` | 54 | FE+EF; 3 Invaders | D ≈344–540 / 3,786–5,049 / 14,516–19,356 | Palace Arcane portal guard |
| II | Dark Elder / `zombie5` | 44 | EF+MR; 4 Plague Bearers | D ≈260–460 / 2,730–3,900 / 11,050–15,786 | Lost City |
| II | Fangskin / `clawviper3` | 61 | LE+EF; 4 vipers | D ≈168–276 / 2,025–2,970 / 8,928–13,094 | Viper altar guardian |
| II | Ancient Kaa the Soulless / `unraveler3` | one of66–72 | MB+ES+LE; 3 Unravelers | D ≈560–688 / 4,935–6,096 / 19,062–23,548 | Resurrection/caster; raw Mod1=25 is **Mana Burn**, not MR |
| III | Sszark the Burning / `arach4` | 85 | ES+C; 5 Flame Spiders | D ≈504–644 / 4,512–5,715 / 16,476–20,868 | Internal `Web Mage the Burning`; Eye chest |
| III | Witch Doctor Endugu / `fetishshaman4` | 91 | MR+FE; 6 Soul Killer Shamans | D ≈244–400 / 2,022–3,264 / 7,736–12,498 | Inferno/raise; released fetish stage; brain chest |
| III | Stormtree / `thornhulk3` | 79 entrance | EF+LE; 4 Thrashers | D ≈544–880 / 6,102–7,389 / 21,306–25,792 | Flayer-to-Lower transition |
| III | Battlemaid Sarina / `corruptrogue5` | 94 | EF+SH; 9 Flesh Hunters | D ≈228–380 / 1,989–3,315 / 7,280–12,134 | Tome guardian; internal `Sarina the Battlemaid` |
| III | Icehawk Riftwing / `batdemon3` | 92 | CE+TP; 7 Gloombats | D ≈144–504 / 2,247–3,534 / 8,492–13,346 | Sewer lever vicinity |
| III | Ismail Vilehand / `councilmember1` | 83 | EF+C; 2 Council | D ≈764–1,524 / 6,834–11,958 / 23,348–40,858 | Hydra/heal/melee; Council quest/flail |
| III | Geleb Flamefinger / `councilmember2` | 83 | ES+FE; 2 Council | Same D as Ismail | Fire death threat |
| III | Toorc Icefist / `councilmember1` | 83 | CE+SS; 0 dedicated | Same D as Ismail | Nearby Council still present; possible dual immunity |
| III | Bremm Sparkfist / `councilmember3` | 102 | AE+LE; 2 Council | D ≈764–1,524 / 7,038–12,315 / 23,808–41,664 | Durance Council; aura threat |
| III | Wyand Voidbringer / `councilmember2` | 102 | MB+TP; 0 dedicated | Same D as Bremm | Internal `Wyand Voidfinger` |
| III | Maffer Dragonhand / `councilmember3` | 102 | ES+EF; 0 dedicated | Same D as Bremm | Durance Council |
| IV | Grand Vizier of Chaos / `fingermage3` | 108 | ES+FE; 9 Storm Casters | D ≈812–1,120 / 3,060–4,209 / 9,890–13,600 | Seal boss |
| IV | Lord De Seis / `doomknight3` | 108 | ES+AE(Fanaticism); 5 Doom Knights | D ≈696–916 / 4,593–5,742 / 14,836–18,546 | Caster seal boss; obsolete raw thief Mod24 must not enable old potion theft |
| IV | Infector of Souls / `megademon3` | 108 | EF+SH; 9 Venom Lords | D ≈1,020–1,220 / 8,037–9,570 / 25,964–30,910 | Inferno rush; seal boss |
| V | Dac Farren / `imp3` | 110 | CE; 4 Demon Gremlins | D ≈296–428 / 1,722–2,487 / 5,046–7,288 | Imp teleport/caster |
| V | Shenk the Overseer / `overseer1` | 110 | ES; 0 formal | D ≈2,400 / 5,742–7,272 / 16,820–21,306 | Many scripted Enslaved nearby; socket quest; internal `Siege Boss` |
| V | Eldritch the Rectifier / `minion1` | 111 | EF; 8 Enslaved | D ≈1,076–1,348 / 3,927–4,908 / 11,444–14,304 | Near waypoint; internal `Megaflow Rectifier` |
| V | Eyeback the Unleashed / `deathmauler1` | 111 | ES+EF; 2 Death Maulers | D ≈736–912 / 4,515–5,694 / 13,160–16,592 | Ground attacks |
| V | Sharptooth Slayer / `overseer3` | 111 | EF; 3 Overlords | D ≈2,756 / 5,889–7,461 / 17,166–21,742 | Internal `Sharp Tooth Sayer` |
| V | Thresh Socket / `siegebeast3` | 112 | C; 0 | D ≈3,000 / 14,514–16,932 / 41,198–48,064 | Cave entrance; internal spelling `Threash Socket` |
| V | Frozenstein / `snowyeti4` | 114 | CE+MB; 5–6 Frozen Scourges | D ≈1,836–2,216 / 6,411–8,685 / 18,450–24,998 | Anya guard |
| V | Bonesaw Breaker / `reanimatedhorde2` | 115 | ES+MR; 5 Reanimated Horde | D ≈720–1,080 / 4,548–5,583 / 13,094–16,070 | Charge/reanimation |
| V | Snapchip Shatter / `frozenhorror1` | 119 | C+CE; 4 Frozen Creepers | D ≈2,164–2,880 / 8,046–9,741 / 22,616–27,378 | Cold breath |
| V | Pindleskin / `reanimatedhorde5` | 121 | FE; 6 Defiled Warriors | **V 1,068–1,592 / 4,773–5,859 / 13,094–16,070** | Charge/reanimation; TC87 access in Hell but mlvl86 excludes qlvl87 uniques such as Tyrael's Might, Azurewrath, Arachnid Mesh |
| V wave1 | Colenzo the Annihilator / `fallenshaman5` | 131 | FE; 5 Warped Ones plus shaman spawn logic | D ≈556–920 / 2,553–4,182 / 6,800–11,126 | Raise/fire; internal `Baal Subject 1` |
| V wave2 | Achmel the Cursed / `unraveler5` | 131 | Special poison Mod23; 3 greater mummies plus preset skeleton mages | D ≈1,648–2,020 / 7,899–9,756 / 21,018–25,964 | Poison/resurrection; internal `Baal Subject 2` |
| V wave3 | Bartuc the Bloody / `baalhighpriest` | 131 | LE; 5 Council | D ≈1,632–3,256 / 10,221–12,546 / 27,200–33,382 | Hydra/heal; internal `Baal Subject 3` |
| V wave4 | Ventar the Unholy / `venomlord` | 131 | EF; 8 Venom Lords | D ≈1,632–3,256 / 13,941–16,263 / 37,092–43,274 | Inferno; internal `Baal Subject 4` |
| V wave5 | Lister the Tormentor / `baalminion1` | 131 | SH; 5 Minions of Destruction | D ≈6,852–9,580 / 19,980–22,305 / 53,164–59,346 | Stun/knockback; internal `Baal Subject 5` |

Sources: T-SU/T-M/T-ML; Blizzard superuniques [A1](https://classic.battle.net/diablo2exp/monsters/act1-superuniques.shtml), [A2](https://classic.battle.net/diablo2exp/monsters/act2-superuniques.shtml), [A3](https://classic.battle.net/diablo2exp/monsters/act3-superuniques.shtml), [A4](https://classic.battle.net/diablo2exp/monsters/act4-superuniques.shtml), [A5](https://classic.battle.net/diablo2exp/monsters/act5-superuniques.shtml); [legacy Corpsefire](https://www.theamazonbasin.com/wiki/index.php/Den_of_Evil_(area)), [legacy Pindleskin](https://diablo2.diablowiki.net/Pindleskin). A modern corroborating Pindleskin page gives NM minimum4,776 while legacy sources give4,773; this discrepancy is not silently “corrected.”

**Unused records are not encounters:** Flamespike the Crawler was removed from LoD ordinary spawning. Winged Death, The Tormentor, Taintbreeder, Riftwraith the Cannibal, Axe Dweller, Anodized Elite, Vinvear Molech, Magma Torquer and Blaze Ripper occur in source records but should not be spawned merely because a table row exists. Script/preset placement must authorize a spawn.

### 6.3 Loot-specific rules

| Encounter | Drop behavior to preserve |
|---|---|
| Ordinary superuniques | Fixed superunique treasure class, distinct from random-unique/champion TC. Usually good item drops, but no blanket guaranteed named unique item |
| Countess | Separate ordinary item and special rune drops; special rune caps **Ral / Io / Ist** N/NM/H. Ordinary TC can also drop runes up to **Nef / Ko / Lo** (Normal `Countess Item→Act 2 Good→Runes 2`; not Ral, which is its special-rune cap). Higher player count can reduce opportunities for special rune drops by filling the item-drop limit; not “more players always more Countess runes” |
| Act bosses | First eligible quest drop differs from repeat kill drops. Quest credit and drop eligibility not identical. Andariel's original persistent quest-drop bug requires precise same-game travel state; full flag algorithm U |
| Ancients | No ordinary item treasure drops; XP quest reward is separate from their tiny kill XP |
| Pindleskin | Hell TC87 access does not imply every unique item: monster level86 excludes qlvl87 unique checks |
| Keys | Optional event-mode boss drops; not guaranteed. Exact probabilities and player-count NoDrop changes require TreasureClassEx import |
| Uber rewards | Torch/Annihilus are special event drops, not generic act-boss loot. Diablo Clone documented HP642,700, level110; Uber boss H life roughly650,000–660,000; full six-boss stat/minion tables U |

Sources: T-SU, [Cow Level](https://classic.battle.net/diablo2exp/quests/cow.shtml), [Countess](https://classic.battle.net/diablo2exp/monsters/act1-superuniques.shtml), [Uber Diablo](https://classic.battle.net/diablo2exp/monsters/act5-uberdiablo.shtml).

## 7. Shrines and interactable objects

### 7.1 All 19 active shrine types

Durations are seconds; recharge is minutes, `0` means no recharge. Recharge does not mean the buff persists until then. All effects below are S from [Arreat Summit shrines](https://classic.battle.net/diablo2exp/shrines.shtml).

| Shrine | Effect | Duration | Recharge |
|---|---|---|---|
| Mana Recharge | +400% mana regeneration | 96 | 5 |
| Armor | +100% defense | 96 | 5 |
| Combat | +200% Attack Rating and +200% minimum/maximum damage | 96 | 5 |
| Resist Fire | +75 fire resistance; does not independently raise max resist cap | 144 | 5 |
| Resist Cold | +75 cold resistance | 144 | 5 |
| Resist Lightning | +75 lightning resistance | 144 | 5 |
| Resist Poison | +75 poison resistance | 144 | 5 |
| Skill | +2 skill levels to already available learned/item-granted skills; does not unlock every unlearned skill | 96 | 5 |
| Stamina | Unlimited stamina | 192 | 5 |
| Experience | +50% monster-kill XP; not quest XP | 144 | 0 |
| Refilling | Refill life and mana | Instant | 2 |
| Health | Refill life | Instant | 2 |
| Mana | Refill mana | Instant | 2 |
| Portal | Creates portal to current act town | Instant | 0 |
| Fire | Nearby players/monsters lose half **current** life; fireball effect | Instant | 0 |
| Monster | Nearest eligible monster becomes unique or champion | Instant | 0 |
| Gem | Upgrade an eligible unsocketed inventory gem/skull by one quality, or produce chipped gem if none | Instant | 0 |
| Exploding | Gives5–10 exploding potions and throws5 | Instant | 0 |
| Poison | Gives5–10 poison gas potions, poison ring; hidden poison-duration protection documented | Instant | 0 |

Timed shrine buffs replace each other and can overwrite/be overwritten by curses. Instant-resource shrines are not all interchangeable with timed buff states; state-removal behavior must be checked per type. Gem selection wording conflicts between “random” and an oldest-inventory-item footnote: isolate the intended gem when testing; exact selection algorithm U.

### 7.2 Ordinary objects and quest objects

| Object | Interaction / implementation-relevant behavior |
|---|---|
| Ordinary / locked chest | Click once to open, randomized treasure via object TC; locked chest consumes key except Assassin's lock-opening ability; trapped variants can damage player. Open state lasts for current game only |
| Super/special/sparkly chest | Distinct drop routines, often multiple drop attempts and preset positions; not “ordinary chest with extra Magic Find.” Exact treasure patterns/NoDrop need original object/TC code |
| Barrel, urn, basket, corpse, skeleton, hollow log, loose rock | Break/search; possible loot and traps; collision and repeatability depend on object class |
| Weapon / armor rack | Produces appropriate equipment base; map seed and approach/order can bias repeated single-player rack results. Item quality/eligible bases use rack-specific logic |
| Well | Two half-resource charges replenish life/mana/stamina; removes poison/curses; heals merc/minions fully. Recharge interval U |
| Doors / gates / barricades | Open/close or destroy; modify collision/pathfinding. Act V cage gates are objective triggers, not generic door loot |
| Tree of Inifuss | Quest interaction yields scroll; guards around tree; not a normal chest |
| Cairn Stones | Five uniquely marked stones, order from Akara-decoded scroll, seed-dependent sequence; opens Tristram red portal. Do not hardcode one universal sequence |
| Cain's cage | Click frees Cain; story teleport/reward state |
| Wirt's body | Tristram body, conventionally upper-left landmark; Wirt's Leg and gold; leg carries difficulty context |
| Horadric Malus stand | Barracks object holds quest hammer; can take without necessarily killing Smith |
| Radament chest | Horadric Scroll; Book of Skill is Radament quest drop, not this chest |
| Halls of Dead chest | Horadric Cube; persistent character object, not recrafted every difficulty |
| Maggot Lair chest | Staff of Kings |
| Viper altar | Destroy/interact: Amulet of the Viper; restores sun quest state |
| Horazon journal | True tomb symbol / red Canyon portal |
| Horadric Orifice | Accept completed staff; wall destruction opens Duriel entrance |
| Gidbinn shrine | Trigger guardian; dropped Gidbinn advances quest |
| Khalim component chests | Eye/Brain/Heart at the exact listed dungeon levels |
| Compelling Orb | Must be struck with equipped Khalim's Will for the ordinary route; opens Durance and consumes quest weapon |
| Lam Esen Tome pedestal | Ruined Temple fixed quest object |
| Hellforge | Place soulstone, equip/use Hammer, strike; quest gem/rune routine, not ordinary chest |
| Chaos seals | Five switches, three with boss groups; all seal conditions plus bosses trigger Diablo |
| Frozen Anya | Dialogue/item-use stages; Malah potion required |
| Ancients altar / statues | Activates three encounter units; TP/exit resets unfinished trial; completed quest allows WSK entry |
| Baal Chamber portal | Scripted red portal after waves; separate from player's blue TP |

Object references: [Basics](https://classic.battle.net/diablo2exp/basics/index.shtml), [quest pages](https://classic.battle.net/diablo2exp/quests/), T-O. **Exact chest/rack loot routines, well timers and object placement coordinates are not fully resolved here.**

### 7.3 Town Portal and waypoint rules

| System | Classic mechanic |
|---|---|
| Blue TP | Scroll or tome creates portal from field to **current act town**, not geographically closest town across acts; consumes one scroll; a tome holds20 |
| One portal per caster | Casting new TP removes caster's old TP. Owner returning from town through own portal closes it; party members using it do not consume it |
| Multiplayer access | Blue TP use restricted to party members. Hostility closes/restricts applicable portals. Red story/Cow portals are not automatically equivalent to party-owned blue TP |
| Persistence | TPs belong to the game instance, not character save; disappear on new game |
| Quest blocking | Other-player TPs into palace/Arcane, Canyon/tombs, Durance and WSK have quest permission checks. WSK requires Ancients credit; classic Durance rush permits entry after Council quest even if that character did not personally smash Orb |
| Cow portal exception | Cow page explicitly says anyone can enter its red portal. A generic Basics list says Cow Level is blocked by completion quest; **prioritize specific red-Cow behavior and distinguish it from blue-TP blocking** |
| TP safety | No invulnerability guarantee on emergence; enemies can camp field landing. Diablo can Bone Prison portal |
| WP activation | Click field waypoint; save individual discovery per difficulty; party activation not shared |
| WP transport | Click any activated WP, select another activated destination/act; no scroll cost. Town WPs exist in all five acts; changing difficulty does not merge discovery lists |
| Summit | Opening a TP during unfinished Ancients encounter resets statues/trial and rerolls modifiers; must defeat all without leaving |

Source: [TP/WP basics](https://classic.battle.net/diablo2exp/basics/index.shtml), [Act V quest](https://classic.battle.net/diablo2exp/quests/act5.shtml), [specific Cow rules](https://classic.battle.net/diablo2exp/quests/cow.shtml).

### 7.4 Secret Cow Level — legacy Cow King lockout, precisely

1. To **create** the red portal, complete Baal's quest in that difficulty, return to **Rogue Encampment**, and transmute **Wirt's Leg + Tome of Town Portal** in the Cube. The tome need not be full. Leg/difficulty validation must be preserved; exact mismatched-leg UI response U.
2. Anyone may **enter** the red Cow portal; creating permission is separate from entering permission.
3. Define the killer as the character delivering the killing blow, including that character's hireling/minion ownership.
4. If the killer is a **pre-opener** (has not completed Baal in that difficulty), or an **ex-opener** (already lost Cow creation ability), killing the King does **not** update anybody's Cow King completion state.
5. If the killer is a **cow-quester** (Baal complete, Cow King not yet complete), all pre-openers and cow-questers **inside the Cow Level at that instant** receive the Cow King completion/lockout. **Party membership is irrelevant.** Characters outside are unaffected.
6. Affected characters permanently lose **creation** ability in that difficulty, but can still enter a portal made by another character. Lockout is not account-wide and not all-difficulty.
7. First eligible King quest kill drops **8 stamina potions**. Do not import D2R's removal of lockout.

Authoritative source: [Arreat Summit Cow Level, including kingslayer/pre-opener/ex-opener definitions](https://classic.battle.net/diablo2exp/quests/cow.shtml).

## 8. Character creation, progression, save/death and UI

### 8.1 Game flow and gates

| Stage/system | Original LoD behavior |
|---|---|
| Creation | Seven classes: Amazon, Assassin, Barbarian, Druid, Necromancer, Paladin, Sorceress; fixed class sex, player name; expansion/softcore-hardcore and realm ladder mode as supported. A non-expansion character is a different ruleset, not the target |
| Start | Level1 Normal, Rogue Encampment; class-specific starting gear and initial attack/skill loadout need CharacterStats/starting-item data |
| Difficulty unlock | Baal quest completion in Normal unlocks Nightmare; NM Baal unlocks Hell. Already unlocked lower difficulties remain selectable; quest/WP state independent per difficulty |
| Act progression | Andariel→Warriv; Duriel→Tyrael→Jerhyn→Meshif; Mephisto red portal; Diablo→Tyrael; Ancients→WSK; Baal→difficulty completion. Most side quests optional |
| Hard level gates | Ancients20/40/60 for credit. Do not turn suggested leveling ranges into universal act-entry gates |
| Classic rushing | Original multiplayer quest sharing and TP checks allow skips, e.g. Council-credit Durance access without personally collecting Khalim parts. A strict mandatory-27-quest campaign is not 1:1 classic behavior |
| NM/H penalties | Player elemental/poison resistance penalties −40/−100; monster stats, immunities, boss behavior and map size change. Not merely scaling Normal HP |
| Multiplayer limits | Maximum8 players. Quest eligibility can be closed for a game even when a character has not completed it; display “cannot complete this quest in this game” separately |
| Save & Exit | Saves character progression/items/skills/quest flags/WPs/merc; next new game begins in town of saved act. Field TP, ground drops, opened-object states and living monster damage are not persistent world entities |
| Monster reset | New game respawns monster population and named superuniques/act bosses; completed personal quest/reward flags remain. Leaving and rejoining the **same still-running multiplayer game** does not reset its world |
| Single-player maps | Same difficulty generally retains character's map seed/layout between new games while monsters/objects repopulate. Changing difficulty rerolls maps. Distinguish map persistence from world-entity persistence |
| Multiplayer maps | Generated per new game; all players in that game share map geometry, not personal reveal/WP progress |
| Ending | Baal death, Tyrael/dialogue/red portal/cinematic flow and title; expansion completion target is Baal, not Diablo |

Sources: [Characters](https://classic.battle.net/diablo2exp/basics/characters.shtml), [difficulty](https://classic.battle.net/diablo2exp/basics/difficulty.shtml), [quests](https://classic.battle.net/diablo2exp/quests/), [controls](https://classic.battle.net/diablo2exp/basics/controls.shtml), [Basics](https://classic.battle.net/diablo2exp/basics/index.shtml). Map-seed save implementation and the full multiplayer credit matrix require original-save/engine validation.

### 8.2 Death, hardcore and titles

| System | Rule |
|---|---|
| Softcore death | Equipped items remain on corpse; character respawns in town without corpse equipment. Recover same-game corpse to re-equip when requirements/space permit; hireling dead |
| XP loss | No ordinary Normal death XP penalty; NM5% / H10% of current-to-next-level XP span; cannot lose an attained level. Recovering corpse in same game restores75% of XP lost |
| Save-exit corpse | Retained corpse appears in town next game. Realm retains the highest equipment-gold-value corpse; Open/single-player retains the oldest corpse, not a merge. Maximum16 corpses; further equipped items may fall to ground. Exact valuation/tie/overflow behavior still needs client tests |
| Gold death | Penalty depends on level, capped20%; carried gold remainder drops. SP stash/exempt-gold behavior differs from multiplayer; do not use one blanket deduction rule |
| Hardcore | One life, permanent death; no resurrection/save rollback as normal gameplay. Living party members can loot corpse gear only if corpse-loot permission was granted; stash/backpack not automatically recoverable. Dead character remains viewable/deletable |
| HC creation availability | **1.13 removed the prerequisite to create hardcore characters**, so 1.14 should not require finishing Normal first. Summit Hardcore page retains stale old prerequisite text |
| Separation | Hardcore and softcore characters do not share a game; original ladder/nonladder/expansion mode separations also apply |

| Difficulty completed | Softcore male/female LoD title | Hardcore LoD title |
|---|---|---|
| Normal | Slayer | Destroyer |
| Nightmare | Champion | Conqueror |
| Hell | Patriarch / Matriarch | Guardian |

Do not use non-expansion Sir/Dame/Lord/Lady/Baron/Baroness titles. Sources: [Hardcore](https://classic.battle.net/diablo2exp/basics/hardcore.shtml), [XP](https://classic.battle.net/diablo2exp/basics/experience.shtml), [1.13 patch notes](https://diablo2.diablowiki.net/Patch_notes_v1.01-1.13c), [1.13 patch mirror](https://diablo-archive.fandom.com/wiki/Patch_1.13_(Diablo_II)). Patch-note search excerpts corroborate HC removal; mirrors were not consistently fetchable.

### 8.3 Original UI and default control model

| UI/control | Required layout / default behavior |
|---|---|
| Bottom HUD | Red Life orb lower-left; blue Mana orb lower-right; left/right action icons, four belt columns between; stamina and XP bars, run/walk toggle and mini-panel buttons |
| Belt | Four columns,1–4 rows according to equipped belt; number keys1–4 consume bottom item of column, higher item falls into slot; hover/tilde expands belt |
| Left/right mouse | Selected left and right skills/actions execute with respective mouse button. Some skills only assignable on right. Holding button repeats appropriate action; targeting/pathing rules depend on skill |
| Skill hotkeys | **F1–F8 default skill selection**, not instant casting. Select skill icon/palette and assign key; original configurable system supports more slots (up to16); do not substitute modern quick-cast |
| Shift | Stand still when attacking/casting, subject to selected skill; Shift+1–4 gives potion to merc |
| Alt | Show ground item labels while held; original default is not persistent D2R item-label toggle |
| Tab | Automap overlay; game continues while map open |
| V | Switch full/corner-map presentation as configured; exact automap options/position persistence require control config |
| R | Toggle walk/run |
| Ctrl | Temporary run modifier under original control setup |
| W | Swap two weapon sets; associated left/right skill choices can differ between sets |
| I / C / T / Q / O | Inventory / character / skill tree / quest log / mercenary panel |
| S | Skill selection palette |
| Z | Party/portrait display control |
| Tilde (`~`) | Expand/collapse belt; **do not assume B is default belt key** |
| Esc | Menu/close panel; Save & Exit. Single-player pause differs from live multiplayer |
| Inventory geometry | Inventory10×4; Cube3×4 interior; equipment slots and mouse-held cursor item separate from backpack |
| Running combat | Defense checks effectively bypassed while running; shield block reduced to one third (75% cap becomes25%). Walking restores ordinary defense/block behavior; stamina drains running |
| Resolution / art | Original LoD supports legacy640×480/800×600 presentation; browser scaling may change rendering, but preserve information/interaction layout rather than importing D2R UI |

Source: [Controls](https://classic.battle.net/diablo2exp/basics/controls.shtml), [Basics: belt](https://classic.battle.net/diablo2exp/basics/index.shtml), [Characters](https://classic.battle.net/diablo2exp/basics/characters.shtml). Keybindings are user-configurable; treat the table as baseline, not mandatory immutable keys.

## Appendix A. Area-to-monster candidate pools

Source: **T-L**, joined to **T-M** by exact monster ID. This appendix intentionally retains internal IDs; localized names can collide, especially Act V guests. `NumMon` is the raw number of candidate families selected for the area, not the number of individual monsters. Repeated candidates are preserved, not deduplicated. `=N` means the `nmon` NM/H candidate list equals Normal, **not** that stats are identical. Candidate pools exclude many preset bosses, spawned minions, traps, quest actors and scripted waves; see section6 for these. `umon` unique-candidate fields, density, group ranges and special preset placement must also be imported for exact population generation.

| Area ID | NumMon | Normal candidates | Nightmare/Hell candidates |
|---|---|---|---|
| 1 | 0 | — | =N |
| 2 | 3 | zombie1, fallen1, quillrat1 | =N |
| 3 | 3 | brute1, corruptrogue1, fallenshaman1, cr_lancer1 | =N |
| 4 | 3 | skeleton1, zombie2, crownest1, goatman1, cr_archer1 | =N |
| 5 | 3 | fallen2, corruptrogue2, quillrat2, cr_lancer2, sk_archer1 | =N |
| 6 | 3 | crownest2, skeleton2, brute2, goatman2, fallenshaman2, cr_archer2 | =N |
| 7 | 3 | corruptrogue3, quillrat3, cr_lancer3, sk_archer2, skmage_fire1 | =N |
| 8 | 3 | zombie1, brute1, fallenshaman1 | =N |
| 9 | 3 | skeleton1, zombie2, cr_archer1 | =N |
| 10 | 3 | bighead3, fallen2, corruptrogue2, sk_archer1 | =N |
| 11 | 3 | bighead3, fallen2, brute2, cr_archer2 | =N |
| 12 | 3 | skeleton3, fallen3, corruptrogue3, cr_archer3 | =N |
| 13 | 3 | skeleton1, zombie2, cr_archer1 | =N |
| 14 | 3 | bighead3, fallen2, corruptrogue2, sk_archer1 | =N |
| 15 | 3 | bighead3, fallen2, brute2, cr_archer2 | =N |
| 16 | 3 | skeleton3, fallen3, corruptrogue3, cr_archer3 | =N |
| 17 | 3 | skeleton1, zombie2 | =N |
| 18 | 3 | skeleton1, zombie2 | =N |
| 19 | 3 | skeleton1, zombie2 | =N |
| 20 | 0 | — | =N |
| 21 | 3 | fallen3, wraith1, goatman3, cr_archer3 | =N |
| 22 | 3 | fallen3, wraith1, goatman3, cr_archer3 | =N |
| 23 | 3 | fallen3, wraith1, goatman3, cr_archer3 | =N |
| 24 | 3 | fallen3, wraith1, goatman3, cr_archer3 | =N |
| 25 | 3 | fallen3, wraith1, goatman3, cr_archer3 | =N |
| 26 | 3 | bighead4, corruptrogue3, sk_archer2, skmage_ltng1 | =N |
| 27 | 3 | brute3, corruptrogue4, fallenshaman3, quillrat4 | =N |
| 28 | 3 | corruptrogue4, goatman5, fallenshaman3, sk_archer3, skmage_fire2 | =N |
| 29 | 3 | fallen4, wraith2, goatman5, sk_archer3, skmage_fire2 | =N |
| 30 | 3 | fallen4, wraith2, goatman5, sk_archer3, skmage_fire2 | =N |
| 31 | 3 | fallen4, wraith2, goatman5, sk_archer3, skmage_ltng2 | =N |
| 32 | 3 | fallen4, cr_archer4, skmage_ltng2 | =N |
| 33 | 3 | bighead2, wraith2, fallenshaman4 | =N |
| 34 | 3 | bighead2, fallenshaman4, fetish1 | =N |
| 35 | 3 | bighead2, fallenshaman4, arach1 | =N |
| 36 | 3 | zombie3, bighead1, vampire5 | =N |
| 37 | 3 | zombie3, bighead1 | =N |
| 38 | 3 | skeleton2, goatman2, fallenshaman2, sk_archer1 | =N |
| 39 | 3 | hellbovine, hellbovine, hellbovine | =N |
| 40 | 0 | — | =N |
| 41 | 3 | sandleaper1, pantherwoman1, scarab1, vulture1, slinger1 | =N |
| 42 | 3 | sandleaper2, pantherwoman2, vulture2, slinger5 | =N |
| 43 | 3 | crownest3, sandmaggot1, swarm1, scarab2, vulture2 | =N |
| 44 | 3 | zombie5, sandraider2, sandleaper3, pantherwoman3, slinger6 | =N |
| 45 | 3 | clawviper2, clawviper2, clawviper3, clawviper3, mummy3, unraveler2 | =N |
| 46 | 3 | brute4, sandmaggot3, pantherwoman4, scarab4, slinger4 | =N |
| 47 | 3 | skeleton4, sandraider1, mummy1, sk_archer4 | =N |
| 48 | 3 | skeleton4, sandraider1, mummy1, sk_archer4 | =N |
| 49 | 3 | skeleton4, pantherwoman1, mummy1, skmage_fire3 | =N |
| 50 | 0 | — | =N |
| 51 | 3 | sandraider3, baboon1, sk_archer5, blunderbore1, skmage_cold4 | =N |
| 52 | 3 | sandraider3, baboon1, sk_archer5, blunderbore1, skmage_fire4 | =N |
| 53 | 3 | sandraider3, baboon1, sk_archer5, blunderbore1, skmage_pois4 | =N |
| 54 | 3 | sandraider3, baboon1, sk_archer5, blunderbore1, skmage_ltng4 | =N |
| 55 | 3 | skeleton5, scarab1, skmage_ltng3 | =N |
| 56 | 3 | mummy2, unraveler1, unraveler1, batdemon1, slinger2 | =N |
| 57 | 3 | mummy2, unraveler1, unraveler1, batdemon1, slinger2 | =N |
| 58 | 3 | clawviper2, clawviper2, clawviper3, clawviper3, mummy3, unraveler2 | =N |
| 59 | 3 | skeleton5, scarab1, skmage_pois3 | =N |
| 60 | 3 | mummy2, unraveler1, unraveler1, batdemon1, slinger2 | =N |
| 61 | 3 | clawviper2, clawviper2, clawviper3, clawviper3, mummy3, unraveler2 | =N |
| 62 | 3 | sandmaggot1, sandmaggot2, swarm2, scarab2, scarab3 | =N |
| 63 | 3 | sandmaggot1, sandmaggot2, swarm2, scarab2, scarab3 | =N |
| 64 | 3 | sandmaggot1, sandmaggot2, swarm2, scarab2, scarab3 | =N |
| 65 | 3 | zombie5, sandraider3, mummy3, skmage_ltng4 | =N |
| 66 | 3 | wraith4, scarab4, mummy4, unraveler3, unraveler3, vampire1, blunderbore2 | =N |
| 67 | 3 | wraith4, scarab4, mummy4, unraveler3, unraveler3, vampire1, blunderbore2 | =N |
| 68 | 3 | wraith4, scarab4, mummy4, unraveler3, unraveler3, vampire1, blunderbore2 | =N |
| 69 | 3 | wraith4, scarab4, mummy4, unraveler3, unraveler3, vampire1, blunderbore2 | =N |
| 70 | 3 | wraith4, scarab4, mummy4, unraveler3, unraveler3, vampire1, blunderbore2 | =N |
| 71 | 3 | wraith4, scarab4, mummy4, unraveler3, unraveler3, vampire1, blunderbore2 | =N |
| 72 | 3 | wraith4, scarab4, mummy4, unraveler3, unraveler3, vampire1, blunderbore2 | =N |
| 73 | 3 | wraith4, scarab4, mummy4, unraveler3, unraveler3, vampire1, blunderbore2 | =N |
| 74 | 3 | wraith3, goatman4, vampire1 | =N |
| 75 | 0 | — | =N |
| 76 | 3 | baboon3, mosquito1, thornhulk1, fetish2, fetishblow2, foulcrow4 | =N |
| 77 | 3 | frogdemon1, frogdemon2, thornhulk2, zombie4, fetishshaman2, willowisp1 | =N |
| 78 | 3 | fetish3, fetishshaman3, fetish4, fetishshaman4, vulture4, frogdemon3, fetishblow3 | =N |
| 79 | 3 | baboon4, sandleaper4, vulture3, zealot1 | =N |
| 80 | 3 | thornhulk3, swarm4, zealot2, cantor1 | =N |
| 81 | 3 | vulture4, zealot3, cantor2, thornhulk3 | =N |
| 82 | 3 | sandraider4, baboon5, cantor3 | =N |
| 83 | 3 | cantor3, cantor3, vampire2 | =N |
| 84 | 3 | arach3, arach4, batdemon2, sandmaggot4, arach3 | =N |
| 85 | 3 | arach3, arach4, batdemon2, sandmaggot4, arach3 | =N |
| 86 | 3 | mummy4, bonefetish4, batdemon2, willowisp1, bonefetish5 | =N |
| 87 | 3 | bonefetish4, zombie4, batdemon2, willowisp1, bonefetish5 | =N |
| 88 | 3 | fetish3, fetishshaman3, fetish4, fetishshaman4, batdemon3, wraith5, fetishblow3, bonefetish3 | =N |
| 89 | 3 | fetish3, fetishshaman3, fetish4, fetishshaman4, batdemon3, wraith5, fetishblow3, bonefetish3 | =N |
| 90 | 3 | bonefetish4, bonefetish5, batdemon2, willowisp1 | =N |
| 91 | 3 | fetish3, fetishshaman3, fetish4, fetishshaman4, batdemon3, wraith5, fetishblow3, bonefetish3 | =N |
| 92 | 3 | mummy4, mosquito2, batdemon3, unraveler4, bonefetish4 | =N |
| 93 | 3 | mummy4, unraveler4, mosquito4, frogdemon3, bonefetish4 | =N |
| 94 | 3 | brute5, corruptrogue5, arach5, vampire2 | =N |
| 95 | 3 | brute5, corruptrogue5, arach5, vampire2 | =N |
| 96 | 3 | brute5, corruptrogue5, arach5, vampire2 | =N |
| 97 | 3 | clawviper5, scarab5, batdemon4, cr_archer5 | =N |
| 98 | 3 | clawviper5, scarab5, batdemon4, cr_archer5 | =N |
| 99 | 3 | clawviper5, scarab5, batdemon4, cr_archer5 | =N |
| 100 | 3 | mummy5, vampire3, blunderbore3, bonefetish5 | =N |
| 101 | 3 | mummy5, vampire3, blunderbore3, bonefetish5 | =N |
| 102 | 3 | vampire4, vampire4 | =N |
| 103 | 0 | — | =N |
| 104 | 3 | sandleaper5, vilemother1, fingermage1, regurgitator1, doomknight1, megademon3 | =N |
| 105 | 3 | willowisp3, vilemother1, fingermage1, regurgitator1, doomknight1, megademon3 | =N |
| 106 | 3 | bighead5, batdemon5, vilemother2, fingermage2, regurgitator2, doomknight2, megademon2 | =N |
| 107 | 3 | sandmaggot5, blunderbore4, vilemother3, fingermage2, regurgitator3, doomknight2, megademon2 | =N |
| 108 | 3 | fingermage3, doomknight3, megademon3 | =N |
| 109 | 0 | — | =N |
| 110 | 2 | minion1, deathmauler1, overseer1, imp1, sk_archer6, quillrat6, bighead6 | minion1, deathmauler1, overseer1, imp1, sk_archer6, quillrat6, foulcrow5, vulture5, thornhulk5, slinger7 |
| 111 | 3 | imp1, siegebeast2 | imp3, siegebeast1, minion2, deathmauler2, sk_archer6, cr_archer6, cr_lancer6, slinger8, blunderbore5, overseer2 |
| 112 | 3 | overseer2, minion2 | deathmauler3, minion4, siegebeast3, overseer5, imp3, slinger9, skmage_ltng5, skmage_fire5, goatman7, fallenshaman6 |
| 113 | 3 | frozenhorror1, succubus3, bloodlord1 | snowyeti1, frozenhorror1, succubus1, bloodlord3, sandraider7, sandleaper6, skmage_cold5, cr_archer7, wraith6, clawviper6 |
| 114 | 3 | snowyeti2, succubus5, reanimatedhorde1 | snowyeti1, frozenhorror1, succubus6, reanimatedhorde1, succubuswitch6, willowisp5, skmage_cold5, cr_lancer7, wraith6, clawviper6 |
| 115 | 3 | deathmauler3, reanimatedhorde2, frozenhorror2 | snowyeti1, frozenhorror1, reanimatedhorde1, skeleton6, wraith7, batdemon6, skmage_cold5, bloodlord6, skeleton6, clawviper7 |
| 116 | 3 | snowyeti1, succubus2 | snowyeti2, succubus6, frozenhorror2, bighead6, goatman7, cr_archer7, skmage_cold5, wraith6, bloodlord6, sandraider7 |
| 117 | 3 | siegebeast2, imp4 | siegebeast2, imp2, deathmauler4, minion5, succubus5, sk_archer7, vulture5, skmage_ltng5, goatman10, pantherwoman6 |
| 118 | 3 | frozenhorror3, deathmauler3, bloodlord1 | frozenhorror2, snowyeti2, bloodlord7, fallenshaman6, quillrat7, cr_lancer7, skmage_cold5, cr_lancer7, reanimatedhorde2, bighead6 |
| 119 | 3 | snowyeti4, succubus3, reanimatedhorde3 | snowyeti2, succubus4, bloodlord7, frozenhorror2, clawviper7, bonefetish5, willowisp5, batdemon6, wraith6, succubuswitch6 |
| 120 | 3 | ancientbarb1, ancientbarb2, ancientbarb3 | =N |
| 121 | 0 | — | =N |
| 122 | 3 | reanimatedhorde3, bloodlord2 | reanimatedhorde3, bloodlord2, deathmauler5, skeleton7, sandleaper7, fallenshaman7, scarab6, fetish6, skmage_pois5, baboon7 |
| 123 | 3 | reanimatedhorde4, deathmauler2, putriddefiler1 | bloodlord2, sandraider7, baboon8, goatman9, quillrat8, unraveler6, fetishblow6, cantor5, vilemother4, sandmaggot6 |
| 124 | 3 | minion6, succubus4, putriddefiler2 | minion9, succubus4, putriddefiler2, reanimatedhorde3, wraith6, arach6, sk_archer9, fetishshaman6, baboon6, clawviper9 |
| 125 | 3 | bloodlord3, imp2 | bloodlord3, imp6, megademon4, succubus7, succubuswitch7, fallenshaman8, sk_archer10, bonefetish6, fingermage4, minion10 |
| 126 | 3 | bloodlord2, overseer3 | bloodlord3, imp6, megademon4, succubus7, clawviper8, blunderbore6, unraveler7, skmage_fire6, goatman8, regurgitator4 |
| 127 | 3 | imp4, overseer4 | imp7, overseer4, megademon4, clawviper8, bloodlord2, succubuswitch5, vampire6, fetishblow7, reanimatedhorde6, dkmag1 |
| 128 | 3 | reanimatedhorde5, succubuswitch2, putriddefiler3 | reanimatedhorde6, succubuswitch8, putriddefiler3, sandraider9, bloodlord5, cr_lancer8, vilemother5, cantor6, vampire7, fetishshaman8 |
| 129 | 3 | suicideminion6, minion7 | suicideminion6, minion11, fetish8, batdemon7, clawviper10, mummy6, skmage_pois6, unraveler8, scarab7, willowisp6 |
| 130 | 3 | bloodlord5, imp5, putriddefiler4 | bloodlord5, imp5, putriddefiler4, fingermage5, dkmag2, fetishblow8, skmage_ltng6, wraith8, succubus4, overseer4 |
| 131 | 3 | bloodlord5, succubuswitch3 | bloodlord5, succubuswitch5, bonefetish7, sandraider10, willowisp7, vampire8, megademon5, unraveler9, dkmag2, clawviper10 |
| 132 | 0 | — | =N |
| 133 | 3 | succubus8, succubuswitch9, corruptrogue6, cr_archer8, cr_lancer8 | =N; event access H only |
| 134 | 3 | swarm5, sandmaggot7, arach7, scarab8 | =N; event access H only |
| 135 | 3 | overseer6, dkmag3, megademon6, imp8 | =N; event access H only |
| 136 | 0 | — | =N; scripted Uber bosses/minions, H only |

**Population interpretation:** area73 has inherited tomb candidate fields but Duriel's actual arena population is script-controlled; area120's three candidates are the Ancients trial, not three randomly selected ordinary species. Area121's empty fields do not mean an empty temple: Pindleskin and reanimating corpses are preset. Area132's empty fields do not remove Baal/clone/tentacles. Similarly area136 uses scripted Uber population.

## 9. Incomplete or uncertain items / validation priorities

| Priority | Unresolved item | Why it matters / next evidence needed |
|---|---|---|
| P0 | Exact 1.14 table provenance | Extract original1.14 MPQ and diff against pinned pre-D2R snapshot; modern master is unsafe |
| P0 | Superunique/boss life calculation and D rows | Confirm integer/fixed-point operations, Normal expansion differences, special level overrides. Many D rows are estimates, not verified1.14 HP |
| P0 | Elite minion HP and Spectral Hit resistance conflicts | Summit vs legacy Basin differ; executable tests decide, not prose majority vote |
| P0 | Mercenary formulas | Exact stat/skill fractional units, level offsets/ceilings, random hire level/price and resurrection formula; raw Gold not displayed price |
| P0 | Multiplayer quest/TP credit state machine | Full party/location/game-creation eligibility and rushing edge cases, including Hellforge reward allocation |
| P1 | Town/preset coordinates and jungle generator | Stash/WP/portal/NPC exact coordinates, DS1 placement, special rooms and seed-dependent Act III adjacency |
| P1 | Exact shop inventories | Base-item eligibility/ilvl caps, vendor refresh rules, item pricing and discount scope |
| P1 | Loot engine | TC group upgrading, NoDrop, boss quest-drop flags, chest/rack patterns, keys and Andariel quest-drop bug |
| P1 | Legacy bugs | Anya resistance-state application, Halls of Vaught Tomb Viper cloud damage, Mana Burn, FE interactions; decide explicitly whether fidelity includes these |
| P1 | Quest reward item generation | Cain/Akara ring quality, Gidbinn existing-merc condition, imbue ilvl/ethereal/staffmod details, Larzuk discount |
| P1 | Save/death details | Multi-corpse valuation/ties, item overflow/cursor behavior, exact map reroll triggers; avoid item loss caused by invented merge rules |
| P2 | Optional realm events | Full six Uber boss stats/spawn AI and original Diablo Clone server trigger; not necessary for original single-player campaign but required for realm1:1 |
| P2 | Object/control edge cases | Well recharge, instant-shrine state removal, gem selection algorithm, exact automap controls and saved options |

The complete five-act area catalogue, all27 quests, NPC roster, mercenary archetypes, monster-family behavior, candidate spawn pools, major encounters,19 shrines and core progression/UI rules are provided. **This document is a research specification with explicit gaps, not a claim of complete executable-level1:1 verification.**
