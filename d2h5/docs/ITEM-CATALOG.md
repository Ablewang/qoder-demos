# 装备、词缀与配方全量目录

生成日期：2026-11-17。来源是当前固定 1.14d 提交的本地目录与原始表。

返回 [文档入口](README.md) · [中文玩法总手册](GAME-DESIGN.md) · [职业与世界全量目录](REFERENCE-CATALOG.md)。

## 阅读说明

- 底材目录是生成物品的基础；不代表每一底材可由当前地图或商人获得。

- 暗金、套装、词缀和配方保留原始定义。版本、启用、天梯、物品类型、等级与实际处理器仍会限制生成/使用。

- 原始属性代码并不保证已执行。当前解释器只覆盖一部分 Properties；触发、光环、充能、每级属性、套装组合等仍有缺口。

- 全量方块配方表是原版目标。首版只支持手册列出的配方子集，而且方块任务取得流程尚未完成。

- 行数包括原始表里的禁用、历史或不可随机生成条目，不能等同可掉落物品数量。

- 原始参数列用 JSON 保存字段名，避免中文翻译把代码、负数、范围或函数表达式改错。

## 全部 2971 条装备身份定义

点击游戏顶部“图鉴”或按 L 查阅完整原始定义、搜索名称/code、翻页和查看实现状态；每页 24 项。只读，不生成装备，不改变角色或 IndexedDB 保存内容。

| 分类 | 定义数 |
| --- | --- |
| 底材 | 659 |
| 暗金装备 | 388 |
| 套装单件 | 127 |
| 套装组合 | 32 |
| 符文之语 | 169 |
| 符文 | 33 |
| 宝石 | 35 |
| 魔法前缀 | 636 |
| 魔法后缀 | 741 |
| 方块配方 | 151 |

388 条暗金中 385 条原始启用，383 条在等级 99 内满足当前选取条件，含全部 29 条 ladder 标记；原版离线单人不排除这些暗金。毁灭/地狱火炬的事件入口仍未实现。这与符文之语的 server=1 限制是不同规则；23 个原始服务器定义中只有边缘按 D2R 离线覆盖启用，其余 22 个仍禁用。

## 635 个归一化底材

尺寸是背包格数；伤害和防御是底材值，未叠加品质、无形、词缀或角色属性；最大孔数仍受 ilvl/类型上限限制。

### 武器底材（306）

| 代码 | 名称 | 英文 | 类型 | 槽位 | 格数 | 伤害 | 防御 | 力量/敏捷 | 需求等级 | qlvl | 最大孔 | 耐久 | 双手 | 职业限制 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2ax | 双刃斧 | Double Axe | axe | weapon | 2×3 | 5–13 | 0–0 | 43 / 0 | 0 | 13 | 5 | 24 | 否 | 不限 |
| 2hs | 双手剑 | Two-Handed Sword | swor | weapon | 1×4 | 8–17 | 0–0 | 35 / 27 | 0 | 10 | 3 | 44 | 是 | 不限 |
| 6bs | Shillelah | Shillelah | staf | weapon | 1×4 | 65–108 | 0–0 | 52 / 27 | 62 | 83 | 4 | 40 | 是 | 不限 |
| 6cb | Great Bow | Great Bow | bow | weapon | 2×3 | 12–52 | 0–0 | 121 / 107 | 51 | 68 | 4 | 0 | 是 | 不限 |
| 6cs | Elder Staff | Elder Staff | staf | weapon | 1×4 | 80–93 | 0–0 | 44 / 37 | 55 | 74 | 4 | 35 | 是 | 不限 |
| 6hb | Blade Bow | Blade Bow | bow | weapon | 2×3 | 21–41 | 0–0 | 76 / 119 | 45 | 60 | 4 | 0 | 是 | 不限 |
| 6hx | Colossus Crossbow | Colossus Crossbow | xbow | weapon | 2×4 | 32–91 | 0–0 | 163 / 77 | 56 | 75 | 6 | 0 | 是 | 不限 |
| 6l7 | Crusader Bow | Crusader Bow | bow | weapon | 2×4 | 15–63 | 0–0 | 97 / 121 | 57 | 77 | 6 | 0 | 是 | 不限 |
| 6lb | Shadow Bow | Shadow Bow | bow | weapon | 2×4 | 15–59 | 0–0 | 52 / 188 | 47 | 63 | 5 | 0 | 是 | 不限 |
| 6ls | Stalagmite | Stalagmite | staf | weapon | 1×4 | 75–107 | 0–0 | 63 / 35 | 49 | 66 | 3 | 30 | 是 | 不限 |
| 6lw | Hydra Bow | Hydra Bow | bow | weapon | 2×4 | 10–68 | 0–0 | 134 / 167 | 63 | 85 | 6 | 0 | 是 | 不限 |
| 6lx | Pellet Bow | Pellet Bow | xbow | weapon | 2×3 | 28–73 | 0–0 | 83 / 155 | 42 | 57 | 3 | 0 | 是 | 不限 |
| 6mx | Gorgon Crossbow | Gorgon Crossbow | xbow | weapon | 2×3 | 25–87 | 0–0 | 117 / 105 | 50 | 67 | 4 | 0 | 是 | 不限 |
| 6rx | Demon Crossbow | Demon Crossbow | xbow | weapon | 2×3 | 26–40 | 0–0 | 141 / 98 | 63 | 84 | 5 | 0 | 是 | 不限 |
| 6s7 | Diamond Bow | Diamond Bow | bow | weapon | 2×3 | 33–40 | 0–0 | 89 / 132 | 54 | 72 | 5 | 0 | 是 | 不限 |
| 6sb | Spider Bow | Spider Bow | bow | weapon | 2×3 | 23–50 | 0–0 | 64 / 143 | 41 | 55 | 3 | 0 | 是 | 不限 |
| 6ss | Walking Stick | Walking Stick | staf | weapon | 1×3 | 69–85 | 0–0 | 25 / 0 | 43 | 58 | 2 | 20 | 是 | 不限 |
| 6sw | Ward Bow | Ward Bow | bow | weapon | 2×3 | 20–53 | 0–0 | 72 / 146 | 60 | 80 | 5 | 0 | 是 | 不限 |
| 6ws | Archon Staff | Archon Staff | staf | weapon | 2×4 | 83–99 | 0–0 | 34 / 0 | 66 | 85 | 6 | 26 | 是 | 不限 |
| 72a | Ettin Axe | Ettin Axe | axe | weapon | 2×3 | 33–66 | 0–0 | 145 / 45 | 52 | 70 | 5 | 24 | 否 | 不限 |
| 72h | Legend Sword | Legend Sword | swor | weapon | 1×4 | 50–94 | 0–0 | 175 / 100 | 44 | 59 | 3 | 44 | 是 | 不限 |
| 7ar | Suwayyah | Suwayyah | h2h2 | weapon | 1×3 | 39–52 | 0–0 | 99 / 99 | 44 | 59 | 3 | 48 | 否 | 刺客 |
| 7ax | Small Crescent | Small Crescent | axe | weapon | 2×3 | 38–60 | 0–0 | 115 / 83 | 45 | 61 | 4 | 24 | 否 | 不限 |
| 7b7 | Champion Sword | Champion Sword | swor | weapon | 1×4 | 71–83 | 0–0 | 163 / 103 | 57 | 77 | 4 | 40 | 是 | 不限 |
| 7b8 | Winged Axe | Winged Axe | taxe | weapon | 2×3 | 11–56 | 0–0 | 96 / 122 | 60 | 80 | 0 | 16 | 否 | 不限 |
| 7ba | Silver Edged Axe | Silver Edged Axe | axe | weapon | 2×3 | 62–110 | 0–0 | 166 / 65 | 48 | 65 | 5 | 35 | 是 | 不限 |
| 7bk | Winged Knife | Winged Knife | tkni | weapon | 1×2 | 27–35 | 0–0 | 45 / 142 | 57 | 77 | 0 | 20 | 否 | 不限 |
| 7bl | Legend Spike | Legend Spike | knif | weapon | 1×3 | 31–47 | 0–0 | 65 / 67 | 66 | 85 | 2 | 47 | 否 | 不限 |
| 7br | Mancatcher | Mancatcher | spea | weapon | 2×4 | 42–92 | 0–0 | 132 / 134 | 55 | 74 | 5 | 28 | 是 | 不限 |
| 7bs | Conquest Sword | Conquest Sword | swor | weapon | 2×3 | 37–53 | 0–0 | 142 / 112 | 58 | 78 | 4 | 32 | 否 | 不限 |
| 7bt | Decapitator | Decapitator | axe | weapon | 2×3 | 49–137 | 0–0 | 189 / 33 | 54 | 73 | 5 | 40 | 是 | 不限 |
| 7bw | Lich Wand | Lich Wand | wand | weapon | 1×2 | 10–31 | 0–0 | 25 / 0 | 56 | 75 | 2 | 17 | 否 | 不限 |
| 7cl | Truncheon | Truncheon | club | weapon | 1×3 | 35–43 | 0–0 | 88 / 43 | 39 | 52 | 2 | 55 | 否 | 不限 |
| 7cm | Highland Blade | Highland Blade | swor | weapon | 1×4 | 67–96 | 0–0 | 171 / 104 | 49 | 66 | 4 | 50 | 是 | 不限 |
| 7cr | Phase Blade | Phase Blade | swor | weapon | 2×3 | 31–35 | 0–0 | 25 / 136 | 54 | 73 | 6 | 0 | 否 | 不限 |
| 7cs | Battle Cestus | Battle Cestus | h2h2 | weapon | 1×3 | 36–42 | 0–0 | 110 / 110 | 54 | 73 | 2 | 72 | 否 | 刺客 |
| 7dg | Bone Knife | Bone Knife | knif | weapon | 1×2 | 23–49 | 0–0 | 38 / 75 | 43 | 58 | 1 | 26 | 否 | 不限 |
| 7di | Mithral Point | Mithral Point | knif | weapon | 1×2 | 37–53 | 0–0 | 55 / 98 | 52 | 70 | 1 | 55 | 否 | 不限 |
| 7fb | Colossal Sword | Colossal Sword | swor | weapon | 2×4 | 61–121 | 0–0 | 182 / 95 | 60 | 80 | 5 | 50 | 是 | 不限 |
| 7fc | Hydra Edge | Hydra Edge | swor | weapon | 1×3 | 28–68 | 0–0 | 142 / 105 | 51 | 69 | 2 | 32 | 否 | 不限 |
| 7fl | Scourge | Scourge | mace | weapon | 2×3 | 3–80 | 0–0 | 125 / 77 | 57 | 76 | 5 | 65 | 否 | 不限 |
| 7ga | Champion Axe | Champion Axe | axe | weapon | 2×4 | 59–94 | 0–0 | 167 / 59 | 61 | 82 | 6 | 50 | 是 | 不限 |
| 7gd | Colossus Blade | Colossus Blade | swor | weapon | 2×4 | 58–115 | 0–0 | 189 / 110 | 63 | 85 | 6 | 50 | 是 | 不限 |
| 7gi | Glorious Axe | Glorious Axe | axe | weapon | 2×3 | 60–124 | 0–0 | 164 / 55 | 66 | 85 | 6 | 50 | 是 | 不限 |
| 7gl | Ghost Glaive | Ghost Glaive | jave | weapon | 1×4 | 19–60 | 0–0 | 89 / 137 | 59 | 79 | 0 | 16 | 否 | 不限 |
| 7gm | Thunder Maul | Thunder Maul | hamm | weapon | 2×3 | 33–180 | 0–0 | 253 / 0 | 65 | 85 | 6 | 60 | 是 | 不限 |
| 7gs | Balrog Blade | Balrog Blade | swor | weapon | 1×4 | 55–118 | 0–0 | 185 / 87 | 53 | 71 | 4 | 50 | 是 | 不限 |
| 7gw | Unearthed Wand | Unearthed Wand | wand | weapon | 1×2 | 22–28 | 0–0 | 25 / 0 | 64 | 86 | 2 | 18 | 否 | 不限 |
| 7h7 | Great Poleaxe | Great Poleaxe | pole | weapon | 2×4 | 46–127 | 0–0 | 179 / 99 | 63 | 84 | 6 | 55 | 是 | 不限 |
| 7ha | Tomahawk | Tomahawk | axe | weapon | 1×3 | 33–58 | 0–0 | 125 / 67 | 40 | 54 | 2 | 28 | 否 | 不限 |
| 7ja | Hyperion Javelin | Hyperion Javelin | jave | weapon | 1×3 | 21–57 | 0–0 | 98 / 123 | 40 | 54 | 0 | 10 | 否 | 不限 |
| 7kr | Fanged Knife | Fanged Knife | knif | weapon | 1×3 | 15–57 | 0–0 | 42 / 86 | 62 | 83 | 3 | 36 | 否 | 不限 |
| 7la | Feral Axe | Feral Axe | axe | weapon | 2×3 | 25–123 | 0–0 | 196 / 0 | 42 | 57 | 4 | 30 | 是 | 不限 |
| 7ls | Cryptic Sword | Cryptic Sword | swor | weapon | 2×3 | 5–77 | 0–0 | 99 / 109 | 61 | 82 | 4 | 44 | 否 | 不限 |
| 7lw | Feral Claws | Feral Claws | h2h2 | weapon | 1×3 | 22–53 | 0–0 | 113 / 113 | 58 | 78 | 3 | 52 | 否 | 刺客 |
| 7m7 | Ogre Maul | Ogre Maul | hamm | weapon | 2×4 | 77–106 | 0–0 | 225 / 0 | 51 | 69 | 6 | 60 | 是 | 不限 |
| 7ma | Reinforced Mace | Reinforced Mace | mace | weapon | 1×3 | 41–49 | 0–0 | 145 / 46 | 47 | 63 | 2 | 60 | 否 | 不限 |
| 7mp | War Spike | War Spike | axe | weapon | 2×3 | 30–48 | 0–0 | 133 / 54 | 59 | 79 | 6 | 26 | 否 | 不限 |
| 7mt | Devil Star | Devil Star | mace | weapon | 1×3 | 43–53 | 0–0 | 153 / 44 | 52 | 70 | 3 | 72 | 否 | 不限 |
| 7o7 | Ogre Axe | Ogre Axe | pole | weapon | 2×4 | 28–145 | 0–0 | 195 / 75 | 45 | 60 | 3 | 50 | 是 | 不限 |
| 7p7 | War Pike | War Pike | spea | weapon | 2×4 | 33–178 | 0–0 | 165 / 106 | 66 | 85 | 6 | 25 | 是 | 不限 |
| 7pa | Cryptic Axe | Cryptic Axe | pole | weapon | 2×4 | 33–150 | 0–0 | 165 / 103 | 59 | 79 | 5 | 65 | 是 | 不限 |
| 7pi | Stygian Pilum | Stygian Pilum | jave | weapon | 1×3 | 14–64 | 0–0 | 118 / 112 | 46 | 62 | 0 | 12 | 否 | 不限 |
| 7qr | Scissors Suwayyah | Scissors Suwayyah | h2h2 | weapon | 1×3 | 40–51 | 0–0 | 118 / 118 | 64 | 85 | 3 | 68 | 否 | 刺客 |
| 7qs | Seraph Rod | Seraph Rod | scep | weapon | 1×3 | 45–54 | 0–0 | 108 / 69 | 57 | 76 | 3 | 60 | 否 | 不限 |
| 7s7 | Balrog Spear | Balrog Spear | jave | weapon | 1×3 | 33–63 | 0–0 | 127 / 95 | 53 | 71 | 0 | 14 | 否 | 不限 |
| 7s8 | Thresher | Thresher | pole | weapon | 2×4 | 12–141 | 0–0 | 152 / 118 | 53 | 71 | 5 | 65 | 是 | 不限 |
| 7sb | Elegant Blade | Elegant Blade | swor | weapon | 1×3 | 33–45 | 0–0 | 109 / 122 | 47 | 63 | 2 | 32 | 否 | 不限 |
| 7sc | Mighty Scepter | Mighty Scepter | scep | weapon | 1×3 | 40–52 | 0–0 | 125 / 65 | 46 | 62 | 2 | 50 | 否 | 不限 |
| 7sm | Ataghan | Ataghan | swor | weapon | 1×3 | 26–46 | 0–0 | 138 / 95 | 45 | 61 | 2 | 22 | 否 | 不限 |
| 7sp | Tyrant Club | Tyrant Club | club | weapon | 1×3 | 32–58 | 0–0 | 133 / 0 | 42 | 57 | 3 | 65 | 否 | 不限 |
| 7sr | Hyperion Spear | Hyperion Spear | spea | weapon | 2×4 | 35–119 | 0–0 | 155 / 120 | 43 | 58 | 3 | 30 | 是 | 不限 |
| 7ss | Falcata | Falcata | swor | weapon | 1×3 | 31–59 | 0–0 | 150 / 88 | 42 | 56 | 2 | 24 | 否 | 不限 |
| 7st | Ghost Spear | Ghost Spear | spea | weapon | 2×4 | 18–155 | 0–0 | 122 / 163 | 62 | 83 | 6 | 28 | 是 | 不限 |
| 7ta | Flying Axe | Flying Axe | taxe | weapon | 1×2 | 17–65 | 0–0 | 88 / 108 | 42 | 56 | 0 | 15 | 否 | 不限 |
| 7tk | Flying Knife | Flying Knife | tkni | weapon | 1×2 | 23–54 | 0–0 | 48 / 141 | 48 | 64 | 0 | 6 | 否 | 不限 |
| 7tr | Stygian Pike | Stygian Pike | spea | weapon | 2×4 | 29–144 | 0–0 | 168 / 97 | 49 | 66 | 4 | 35 | 是 | 不限 |
| 7ts | Winged Harpoon | Winged Harpoon | jave | weapon | 1×4 | 27–35 | 0–0 | 76 / 145 | 65 | 85 | 0 | 18 | 否 | 不限 |
| 7tw | Runic Talons | Runic Talons | h2h2 | weapon | 1×3 | 24–44 | 0–0 | 115 / 115 | 60 | 81 | 3 | 69 | 否 | 刺客 |
| 7vo | Colossus Voulge | Colossus Voulge | pole | weapon | 2×4 | 17–165 | 0–0 | 210 / 55 | 48 | 64 | 4 | 50 | 是 | 不限 |
| 7wa | Berserker Axe | Berserker Axe | axe | weapon | 2×3 | 24–71 | 0–0 | 138 / 59 | 64 | 85 | 6 | 26 | 否 | 不限 |
| 7wb | Wrist Sword | Wrist Sword | h2h2 | weapon | 1×3 | 34–45 | 0–0 | 105 / 105 | 46 | 62 | 3 | 56 | 否 | 刺客 |
| 7wc | Giant Thresher | Giant Thresher | pole | weapon | 2×4 | 40–114 | 0–0 | 188 / 140 | 66 | 85 | 6 | 55 | 是 | 不限 |
| 7wd | Mythical Sword | Mythical Sword | swor | weapon | 1×3 | 40–50 | 0–0 | 147 / 124 | 66 | 85 | 3 | 44 | 否 | 不限 |
| 7wh | Legendary Mallet | Legendary Mallet | hamm | weapon | 2×3 | 50–61 | 0–0 | 189 / 0 | 61 | 82 | 4 | 65 | 否 | 不限 |
| 7wn | Polished Wand | Polished Wand | wand | weapon | 1×2 | 18–33 | 0–0 | 25 / 0 | 41 | 55 | 2 | 22 | 否 | 不限 |
| 7ws | Caduceus | Caduceus | scep | weapon | 2×3 | 37–43 | 0–0 | 97 / 70 | 66 | 85 | 5 | 70 | 否 | 不限 |
| 7xf | War Fist | War Fist | h2h2 | weapon | 1×3 | 44–53 | 0–0 | 108 / 108 | 51 | 68 | 2 | 64 | 否 | 刺客 |
| 7yw | Ghost Wand | Ghost Wand | wand | weapon | 1×2 | 20–40 | 0–0 | 25 / 0 | 48 | 65 | 2 | 14 | 否 | 不限 |
| 8bs | Gothic Staff | Gothic Staff | staf | weapon | 1×4 | 14–34 | 0–0 | 25 / 0 | 25 | 42 | 4 | 40 | 是 | 不限 |
| 8cb | Double Bow | Double Bow | bow | weapon | 2×3 | 11–26 | 0–0 | 58 / 73 | 25 | 39 | 4 | 0 | 是 | 不限 |
| 8cs | Cedar Staff | Cedar Staff | staf | weapon | 1×4 | 11–32 | 0–0 | 25 / 0 | 25 | 38 | 4 | 35 | 是 | 不限 |
| 8hb | Razor Bow | Razor Bow | bow | weapon | 2×3 | 8–22 | 0–0 | 25 / 62 | 21 | 33 | 4 | 0 | 是 | 不限 |
| 8hx | Balista | Balista | xbow | weapon | 2×4 | 33–55 | 0–0 | 110 / 80 | 25 | 47 | 6 | 0 | 是 | 不限 |
| 8l8 | Long Siege Bow | Long Siege Bow | bow | weapon | 2×4 | 10–42 | 0–0 | 80 / 95 | 25 | 46 | 6 | 0 | 是 | 不限 |
| 8lb | Cedar Bow | Cedar Bow | bow | weapon | 2×4 | 10–29 | 0–0 | 53 / 49 | 23 | 35 | 5 | 0 | 是 | 不限 |
| 8ls | Quarterstaff | Quarterstaff | staf | weapon | 1×4 | 8–26 | 0–0 | 25 / 0 | 23 | 35 | 3 | 30 | 是 | 不限 |
| 8lw | Gothic Bow | Gothic Bow | bow | weapon | 2×4 | 10–50 | 0–0 | 95 / 118 | 25 | 52 | 6 | 0 | 是 | 不限 |
| 8lx | Arbalest | Arbalest | xbow | weapon | 2×3 | 14–27 | 0–0 | 52 / 61 | 22 | 34 | 3 | 0 | 是 | 不限 |
| 8mx | Siege Crossbow | Siege Crossbow | xbow | weapon | 2×3 | 20–42 | 0–0 | 80 / 70 | 25 | 40 | 4 | 0 | 是 | 不限 |
| 8rx | Chu-Ko-Nu | Chu-Ko-Nu | xbow | weapon | 2×3 | 14–32 | 0–0 | 80 / 95 | 25 | 54 | 5 | 0 | 是 | 不限 |
| 8s8 | Short Siege Bow | Short Siege Bow | bow | weapon | 2×3 | 13–30 | 0–0 | 65 / 80 | 25 | 43 | 5 | 0 | 是 | 不限 |
| 8sb | Edge Bow | Edge Bow | bow | weapon | 2×3 | 6–19 | 0–0 | 25 / 43 | 18 | 30 | 3 | 0 | 是 | 不限 |
| 8ss | Jo Staff | Jo Staff | staf | weapon | 1×3 | 6–21 | 0–0 | 25 / 0 | 18 | 30 | 2 | 20 | 是 | 不限 |
| 8sw | Rune Bow | Rune Bow | bow | weapon | 2×3 | 14–35 | 0–0 | 73 / 103 | 25 | 49 | 5 | 0 | 是 | 不限 |
| 8ws | Rune Staff | Rune Staff | staf | weapon | 2×4 | 24–58 | 0–0 | 25 / 0 | 25 | 47 | 6 | 50 | 是 | 不限 |
| 92a | Twin Axe | Twin Axe | axe | weapon | 2×3 | 13–38 | 0–0 | 85 / 0 | 25 | 39 | 5 | 24 | 否 | 不限 |
| 92h | Espadon | Espadon | swor | weapon | 1×4 | 18–40 | 0–0 | 73 / 61 | 25 | 37 | 3 | 44 | 是 | 不限 |
| 9ar | Quhab | Quhab | h2h | weapon | 1×3 | 11–24 | 0–0 | 57 / 57 | 21 | 28 | 3 | 48 | 否 | 刺客 |
| 9ax | Cleaver | Cleaver | axe | weapon | 2×3 | 10–33 | 0–0 | 68 / 0 | 22 | 34 | 4 | 24 | 否 | 不限 |
| 9b7 | Lochaber Axe | Lochaber Axe | pole | weapon | 2×4 | 6–58 | 0–0 | 80 / 0 | 21 | 33 | 3 | 50 | 是 | 不限 |
| 9b8 | Hurlbat | Hurlbat | taxe | weapon | 2×3 | 13–27 | 0–0 | 25 / 106 | 25 | 41 | 0 | 16 | 否 | 不限 |
| 9b9 | Gothic Sword | Gothic Sword | swor | weapon | 1×4 | 39–60 | 0–0 | 113 / 20 | 25 | 48 | 4 | 40 | 是 | 不限 |
| 9ba | Bearded Axe | Bearded Axe | axe | weapon | 2×3 | 21–49 | 0–0 | 92 / 0 | 25 | 38 | 5 | 35 | 是 | 不限 |
| 9bk | War Dart | War Dart | tkni | weapon | 1×2 | 6–24 | 0–0 | 25 / 97 | 25 | 39 | 0 | 20 | 否 | 不限 |
| 9bl | Stilleto | Stilleto | knif | weapon | 1×3 | 19–36 | 0–0 | 47 / 97 | 25 | 46 | 2 | 24 | 否 | 不限 |
| 9br | War Fork | War Fork | spea | weapon | 2×4 | 16–40 | 0–0 | 80 / 95 | 25 | 41 | 5 | 28 | 是 | 不限 |
| 9bs | Battle Sword | Battle Sword | swor | weapon | 2×3 | 16–34 | 0–0 | 92 / 43 | 25 | 40 | 4 | 32 | 否 | 不限 |
| 9bt | Tabar | Tabar | axe | weapon | 2×3 | 24–77 | 0–0 | 101 / 0 | 25 | 42 | 5 | 40 | 是 | 不限 |
| 9bw | Tomb Wand | Tomb Wand | wand | weapon | 1×2 | 10–22 | 0–0 | 25 / 0 | 25 | 43 | 2 | 15 | 否 | 不限 |
| 9cl | Cudgel | Cudgel | club | weapon | 1×3 | 6–21 | 0–0 | 25 / 0 | 18 | 30 | 2 | 24 | 否 | 不限 |
| 9cm | Dacian Falx | Dacian Falx | swor | weapon | 1×4 | 26–61 | 0–0 | 91 / 20 | 25 | 42 | 4 | 50 | 是 | 不限 |
| 9cr | Dimensional Blade | Dimensional Blade | swor | weapon | 2×3 | 13–35 | 0–0 | 85 / 60 | 25 | 37 | 6 | 20 | 否 | 不限 |
| 9cs | Hand Scythe | Hand Scythe | h2h2 | weapon | 1×3 | 16–37 | 0–0 | 73 / 73 | 30 | 41 | 2 | 72 | 否 | 刺客 |
| 9dg | Poignard | Poignard | knif | weapon | 1×2 | 6–18 | 0–0 | 25 / 0 | 19 | 31 | 1 | 16 | 否 | 不限 |
| 9di | Rondel | Rondel | knif | weapon | 1×2 | 10–26 | 0–0 | 25 / 58 | 24 | 36 | 1 | 20 | 否 | 不限 |
| 9fb | Zweihander | Zweihander | swor | weapon | 2×4 | 29–54 | 0–0 | 125 / 94 | 25 | 49 | 5 | 50 | 是 | 不限 |
| 9fc | Tulwar | Tulwar | swor | weapon | 1×3 | 16–35 | 0–0 | 70 / 42 | 25 | 37 | 2 | 32 | 否 | 不限 |
| 9fl | Knout | Knout | mace | weapon | 2×3 | 13–35 | 0–0 | 82 / 73 | 25 | 43 | 5 | 30 | 否 | 不限 |
| 9ga | Gothic Axe | Gothic Axe | axe | weapon | 2×4 | 18–70 | 0–0 | 115 / 79 | 25 | 46 | 6 | 50 | 是 | 不限 |
| 9gd | Executioner Sword | Executioner Sword | swor | weapon | 2×4 | 47–80 | 0–0 | 170 / 110 | 25 | 54 | 6 | 50 | 是 | 不限 |
| 9gi | Ancient Axe | Ancient Axe | axe | weapon | 2×3 | 43–85 | 0–0 | 125 / 0 | 25 | 51 | 6 | 50 | 是 | 不限 |
| 9gl | Spiculum | Spiculum | jave | weapon | 1×4 | 13–38 | 0–0 | 98 / 73 | 25 | 46 | 0 | 16 | 否 | 不限 |
| 9gm | Martel de Fer | Martel de Fer | hamm | weapon | 2×3 | 61–99 | 0–0 | 169 / 0 | 25 | 53 | 6 | 60 | 是 | 不限 |
| 9gs | Tusk Sword | Tusk Sword | swor | weapon | 1×4 | 19–58 | 0–0 | 104 / 71 | 25 | 45 | 4 | 50 | 是 | 不限 |
| 9gw | Grave Wand | Grave Wand | wand | weapon | 1×2 | 13–29 | 0–0 | 25 / 0 | 25 | 49 | 2 | 15 | 否 | 不限 |
| 9h9 | Bec-de-Corbin | Bec-de-Corbin | pole | weapon | 2×4 | 13–85 | 0–0 | 133 / 91 | 25 | 51 | 6 | 55 | 是 | 不限 |
| 9ha | Hatchet | Hatchet | axe | weapon | 1×3 | 10–21 | 0–0 | 25 / 25 | 19 | 31 | 2 | 28 | 否 | 不限 |
| 9ja | War Javelin | War Javelin | jave | weapon | 1×3 | 6–19 | 0–0 | 25 / 25 | 18 | 30 | 0 | 10 | 否 | 不限 |
| 9kr | Cinquedeas | Cinquedeas | knif | weapon | 1×3 | 15–31 | 0–0 | 25 / 88 | 25 | 42 | 3 | 24 | 否 | 不限 |
| 9la | Military Axe | Military Axe | axe | weapon | 2×3 | 14–34 | 0–0 | 73 / 0 | 22 | 34 | 4 | 30 | 是 | 不限 |
| 9ls | Rune Sword | Rune Sword | swor | weapon | 2×3 | 10–42 | 0–0 | 103 / 79 | 25 | 44 | 4 | 44 | 否 | 不限 |
| 9lw | Greater Claws | Greater Claws | h2h2 | weapon | 1×3 | 18–37 | 0–0 | 76 / 76 | 33 | 45 | 3 | 52 | 否 | 刺客 |
| 9m9 | War Club | War Club | hamm | weapon | 2×4 | 53–78 | 0–0 | 124 / 0 | 25 | 45 | 6 | 60 | 是 | 不限 |
| 9ma | Flanged Mace | Flanged Mace | mace | weapon | 1×3 | 15–23 | 0–0 | 61 / 0 | 23 | 35 | 2 | 60 | 否 | 不限 |
| 9mp | Crowbill | Crowbill | axe | weapon | 2×3 | 14–34 | 0–0 | 94 / 70 | 25 | 43 | 6 | 26 | 否 | 不限 |
| 9mt | Jagged Star | Jagged Star | mace | weapon | 1×3 | 20–31 | 0–0 | 74 / 0 | 25 | 39 | 3 | 72 | 否 | 不限 |
| 9p9 | Lance | Lance | spea | weapon | 2×4 | 27–114 | 0–0 | 110 / 88 | 25 | 47 | 6 | 25 | 是 | 不限 |
| 9pa | Partizan | Partizan | pole | weapon | 2×4 | 34–75 | 0–0 | 113 / 67 | 23 | 35 | 5 | 65 | 是 | 不限 |
| 9pi | Great Pilum | Great Pilum | jave | weapon | 1×3 | 11–26 | 0–0 | 25 / 88 | 25 | 37 | 0 | 12 | 否 | 不限 |
| 9qr | Scissors Quhab | Scissors Quhab | h2h2 | weapon | 1×3 | 19–40 | 0–0 | 82 / 82 | 40 | 54 | 3 | 68 | 否 | 刺客 |
| 9qs | Holy Water Sprinkler | Holy Water Sprinkler | scep | weapon | 1×3 | 14–36 | 0–0 | 76 / 0 | 25 | 40 | 3 | 60 | 否 | 不限 |
| 9s8 | Battle Scythe | Battle Scythe | pole | weapon | 2×4 | 18–45 | 0–0 | 82 / 82 | 25 | 40 | 5 | 65 | 是 | 不限 |
| 9s9 | Simbilan | Simbilan | jave | weapon | 1×3 | 8–32 | 0–0 | 80 / 80 | 25 | 40 | 0 | 14 | 否 | 不限 |
| 9sb | Shamshir | Shamshir | swor | weapon | 1×3 | 10–24 | 0–0 | 58 / 58 | 23 | 35 | 2 | 32 | 否 | 不限 |
| 9sc | Rune Scepter | Rune Scepter | scep | weapon | 1×3 | 13–24 | 0–0 | 58 / 0 | 19 | 31 | 2 | 50 | 否 | 不限 |
| 9sm | Cutlass | Cutlass | swor | weapon | 1×3 | 8–21 | 0–0 | 25 / 52 | 25 | 43 | 2 | 22 | 否 | 不限 |
| 9sp | Barbed Club | Barbed Club | club | weapon | 1×3 | 13–25 | 0–0 | 30 / 0 | 20 | 32 | 3 | 36 | 否 | 不限 |
| 9sr | War Spear | War Spear | spea | weapon | 2×4 | 10–37 | 0–0 | 25 / 25 | 21 | 33 | 3 | 30 | 是 | 不限 |
| 9ss | Gladius | Gladius | swor | weapon | 1×3 | 8–22 | 0–0 | 25 / 0 | 18 | 30 | 2 | 24 | 否 | 不限 |
| 9st | Yari | Yari | spea | weapon | 2×4 | 29–59 | 0–0 | 101 / 0 | 25 | 44 | 6 | 28 | 是 | 不限 |
| 9ta | Francisca | Francisca | taxe | weapon | 1×2 | 11–22 | 0–0 | 25 / 80 | 22 | 34 | 0 | 15 | 否 | 不限 |
| 9tk | Battle Dart | Battle Dart | tkni | weapon | 1×2 | 8–16 | 0–0 | 25 / 52 | 19 | 31 | 0 | 6 | 否 | 不限 |
| 9tr | Fuscina | Fuscina | spea | weapon | 2×4 | 19–37 | 0–0 | 77 / 25 | 24 | 36 | 4 | 35 | 是 | 不限 |
| 9ts | Harpoon | Harpoon | jave | weapon | 1×4 | 13–35 | 0–0 | 25 / 118 | 25 | 51 | 0 | 18 | 否 | 不限 |
| 9tw | Greater Talons | Greater Talons | h2h2 | weapon | 1×3 | 21–35 | 0–0 | 79 / 79 | 37 | 50 | 3 | 69 | 否 | 刺客 |
| 9vo | Bill | Bill | pole | weapon | 2×4 | 14–53 | 0–0 | 95 / 0 | 25 | 37 | 4 | 50 | 是 | 不限 |
| 9wa | Naga | Naga | axe | weapon | 2×3 | 16–45 | 0–0 | 121 / 0 | 25 | 48 | 6 | 26 | 否 | 不限 |
| 9wb | Wrist Spike | Wrist Spike | h2h | weapon | 1×3 | 13–27 | 0–0 | 66 / 66 | 24 | 32 | 2 | 56 | 否 | 刺客 |
| 9wc | Grim Scythe | Grim Scythe | pole | weapon | 2×4 | 30–70 | 0–0 | 140 / 140 | 25 | 55 | 6 | 55 | 是 | 不限 |
| 9wd | Ancient Sword | Ancient Sword | swor | weapon | 1×3 | 18–43 | 0–0 | 127 / 88 | 25 | 49 | 3 | 44 | 否 | 不限 |
| 9wh | Battle Hammer | Battle Hammer | hamm | weapon | 2×3 | 35–58 | 0–0 | 100 / 0 | 25 | 48 | 4 | 55 | 否 | 不限 |
| 9wn | Burnt Wand | Burnt Wand | wand | weapon | 1×2 | 8–18 | 0–0 | 25 / 0 | 19 | 31 | 1 | 15 | 否 | 不限 |
| 9ws | Divine Scepter | Divine Scepter | scep | weapon | 2×3 | 16–38 | 0–0 | 103 / 0 | 25 | 45 | 5 | 70 | 否 | 不限 |
| 9xf | Fascia | Fascia | h2h | weapon | 1×3 | 8–37 | 0–0 | 69 / 69 | 27 | 36 | 2 | 64 | 否 | 刺客 |
| 9yw | Petrified Wand | Petrified Wand | wand | weapon | 1×2 | 8–24 | 0–0 | 25 / 0 | 25 | 38 | 2 | 15 | 否 | 不限 |
| am1 | Stag Bow | Stag Bow | abow | weapon | 2×4 | 7–12 | 0–0 | 30 / 45 | 14 | 18 | 5 | 0 | 是 | 亚马逊 |
| am2 | Reflex Bow | Reflex Bow | abow | weapon | 2×4 | 9–19 | 0–0 | 35 / 60 | 20 | 27 | 5 | 0 | 是 | 亚马逊 |
| am3 | Maiden Spear | Maiden Spear | aspe | weapon | 2×4 | 18–24 | 0–0 | 54 / 40 | 14 | 18 | 6 | 28 | 是 | 亚马逊 |
| am4 | Maiden Pike | Maiden Pike | aspe | weapon | 2×4 | 23–55 | 0–0 | 63 / 52 | 20 | 27 | 6 | 25 | 是 | 亚马逊 |
| am5 | Maiden Javelin | Maiden Javelin | ajav | weapon | 1×3 | 8–14 | 0–0 | 33 / 47 | 17 | 23 | 0 | 6 | 否 | 亚马逊 |
| am6 | Ashwood Bow | Ashwood Bow | abow | weapon | 2×4 | 16–29 | 0–0 | 56 / 77 | 29 | 39 | 5 | 0 | 是 | 亚马逊 |
| am7 | Ceremonial Bow | Ceremonial Bow | abow | weapon | 2×4 | 19–41 | 0–0 | 73 / 110 | 35 | 47 | 5 | 0 | 是 | 亚马逊 |
| am8 | Ceremonial Spear | Ceremonial Spear | aspe | weapon | 2×4 | 34–51 | 0–0 | 101 / 80 | 32 | 43 | 6 | 28 | 是 | 亚马逊 |
| am9 | Ceremonial Pike | Ceremonial Pike | aspe | weapon | 2×4 | 42–101 | 0–0 | 115 / 98 | 38 | 51 | 6 | 25 | 是 | 亚马逊 |
| ama | Ceremonial Javelin | Ceremonial Javelin | ajav | weapon | 1×3 | 18–35 | 0–0 | 25 / 109 | 26 | 35 | 0 | 6 | 否 | 亚马逊 |
| amb | Matriarchal Bow | Matriarchal Bow | abow | weapon | 2×4 | 20–47 | 0–0 | 87 / 187 | 39 | 53 | 5 | 0 | 是 | 亚马逊 |
| amc | Grand Matron Bow | Grand Matron Bow | abow | weapon | 2×4 | 14–72 | 0–0 | 108 / 152 | 58 | 78 | 5 | 0 | 是 | 亚马逊 |
| amd | Matriarchal Spear | Matriarchal Spear | aspe | weapon | 2×4 | 65–95 | 0–0 | 114 / 142 | 45 | 61 | 6 | 28 | 是 | 亚马逊 |
| ame | Matriarchal Pike | Matriarchal Pike | aspe | weapon | 2×4 | 37–153 | 0–0 | 132 / 149 | 60 | 81 | 6 | 25 | 是 | 亚马逊 |
| amf | MatriarchalJavelin | MatriarchalJavelin | ajav | weapon | 1×3 | 30–54 | 0–0 | 107 / 151 | 48 | 65 | 0 | 6 | 否 | 亚马逊 |
| axe | 斧 | Axe | axe | weapon | 2×3 | 4–11 | 0–0 | 32 / 0 | 0 | 7 | 4 | 24 | 否 | 不限 |
| axf | 斧手 | Hatchet Hands | h2h | weapon | 1×3 | 2–15 | 0–0 | 37 / 37 | 0 | 12 | 2 | 56 | 否 | 刺客 |
| bal | 平衡斧 | Balanced Axe | taxe | weapon | 2×3 | 5–10 | 0–0 | 0 / 57 | 0 | 16 | 0 | 10 | 否 | 不限 |
| bar | 大砍刀 | Bardiche | pole | weapon | 2×4 | 1–27 | 0–0 | 40 / 0 | 0 | 5 | 3 | 50 | 是 | 不限 |
| bax | 阔斧 | Broad Axe | axe | weapon | 2×3 | 10–18 | 0–0 | 48 / 0 | 0 | 12 | 5 | 35 | 是 | 不限 |
| bkf | 平衡飞刀 | Balanced Knife | tkni | weapon | 1×2 | 1–8 | 0–0 | 0 / 51 | 0 | 13 | 0 | 8 | 否 | 不限 |
| bld | 短刀 | Blade | knif | weapon | 1×3 | 4–15 | 0–0 | 35 / 51 | 0 | 23 | 2 | 24 | 否 | 不限 |
| brn | 叉 | Brandistock | spea | weapon | 2×4 | 7–17 | 0–0 | 40 / 50 | 0 | 16 | 5 | 28 | 是 | 不限 |
| bsd | 阔剑 | Broad Sword | swor | weapon | 2×3 | 7–14 | 0–0 | 48 / 0 | 0 | 15 | 4 | 32 | 否 | 不限 |
| bst | 战斗法杖 | Battle Staff | staf | weapon | 1×4 | 6–13 | 0–0 | 0 / 0 | 0 | 17 | 4 | 40 | 是 | 不限 |
| bsw | 巨剑 | Bastard Sword | swor | weapon | 1×4 | 20–28 | 0–0 | 62 / 0 | 0 | 24 | 4 | 40 | 是 | 不限 |
| btl | 刃爪 | Blade Talons | h2h | weapon | 1×3 | 10–14 | 0–0 | 50 / 50 | 0 | 21 | 3 | 69 | 否 | 刺客 |
| btx | 战斗斧 | Battle Axe | axe | weapon | 2×3 | 12–32 | 0–0 | 54 / 0 | 0 | 17 | 5 | 40 | 是 | 不限 |
| bwn | 骨杖 | Bone Wand | wand | weapon | 1×2 | 3–7 | 0–0 | 0 / 0 | 0 | 18 | 2 | 15 | 否 | 不限 |
| cbw | 组合弓 | Composite Bow | bow | weapon | 2×3 | 4–8 | 0–0 | 25 / 35 | 0 | 12 | 4 | 0 | 是 | 不限 |
| ces | 腰刀 | Cestus | h2h | weapon | 1×3 | 7–15 | 0–0 | 42 / 42 | 0 | 15 | 2 | 72 | 否 | 刺客 |
| clb | 木棒 | Club | club | weapon | 1×3 | 1–6 | 0–0 | 0 / 0 | 0 | 1 | 2 | 24 | 否 | 不限 |
| clm | 双刃大刀 | Claymore | swor | weapon | 1×4 | 13–30 | 0–0 | 47 / 0 | 0 | 17 | 4 | 50 | 是 | 不限 |
| clw | 爪 | Claws | h2h | weapon | 1×3 | 8–15 | 0–0 | 46 / 46 | 0 | 18 | 3 | 64 | 否 | 刺客 |
| crs | 水晶剑 | Crystal Sword | swor | weapon | 2×3 | 5–15 | 0–0 | 43 / 0 | 0 | 11 | 6 | 20 | 否 | 不限 |
| cst | 多节棍 | Gnarled Staff | staf | weapon | 1×4 | 4–12 | 0–0 | 0 / 0 | 0 | 12 | 4 | 35 | 是 | 不限 |
| d33 | decoy dagger | decoy dagger | knif | weapon | 1×2 | 1–2 | 0–0 | 15 / 20 | 0 | 0 | 0 | 10 | 否 | 不限 |
| dgr | 匕首 | Dagger | knif | weapon | 1×2 | 1–4 | 0–0 | 0 / 0 | 0 | 3 | 1 | 16 | 否 | 不限 |
| dir | 长匕首 | Dirk | knif | weapon | 1×2 | 3–9 | 0–0 | 0 / 25 | 0 | 9 | 1 | 20 | 否 | 不限 |
| fla | 连枷 | Flail | mace | weapon | 2×3 | 1–24 | 0–0 | 41 / 35 | 0 | 19 | 5 | 30 | 否 | 不限 |
| flb | 双手饰剑 | Flamberge | swor | weapon | 2×4 | 13–26 | 0–0 | 70 / 49 | 0 | 27 | 5 | 50 | 是 | 不限 |
| flc | 弯形大刀 | Falchion | swor | weapon | 1×3 | 9–17 | 0–0 | 33 / 0 | 0 | 11 | 2 | 32 | 否 | 不限 |
| g33 | Gidbinn | Gidbinn | knif | weapon | 1×2 | 3–7 | 0–0 | 15 / 25 | 0 | 0 | 0 | 30 | 否 | 不限 |
| gax | 卓越之斧 | Great Axe | axe | weapon | 2×4 | 9–30 | 0–0 | 63 / 39 | 0 | 23 | 6 | 50 | 是 | 不限 |
| gis | 大剑 | Giant Sword | swor | weapon | 1×4 | 9–28 | 0–0 | 56 / 34 | 0 | 21 | 4 | 50 | 是 | 不限 |
| gix | 大斧 | Giant Axe | axe | weapon | 2×3 | 22–45 | 0–0 | 70 / 0 | 0 | 27 | 6 | 50 | 是 | 不限 |
| glv | 大长刀 | Glaive | jave | weapon | 1×4 | 5–17 | 0–0 | 52 / 35 | 0 | 23 | 0 | 5 | 否 | 不限 |
| gma | 卓越巨棍 | Great Maul | hamm | weapon | 2×3 | 38–58 | 0–0 | 99 / 0 | 0 | 32 | 6 | 60 | 是 | 不限 |
| gpl | Strangling Gas Potion | Strangling Gas Potion | tpot | weapon | 1×1 | 0–1 | 0–0 | 0 / 0 | 6 | 8 | 0 | 0 | 否 | 不限 |
| gpm | Choking Gas Potion | Choking Gas Potion | tpot | weapon | 1×1 | 0–1 | 0–0 | 0 / 0 | 16 | 20 | 0 | 0 | 否 | 不限 |
| gps | Rancid Gas Potion | Rancid Gas Potion | tpot | weapon | 1×1 | 0–1 | 0–0 | 0 / 0 | 24 | 32 | 0 | 0 | 否 | 不限 |
| gsc | 雄伟权杖 | Grand Scepter | scep | weapon | 1×3 | 8–18 | 0–0 | 37 / 0 | 0 | 15 | 3 | 60 | 否 | 不限 |
| gsd | 卓越之剑 | Great Sword | swor | weapon | 2×4 | 25–42 | 0–0 | 100 / 60 | 0 | 33 | 6 | 50 | 是 | 不限 |
| gwn | 冷酷之杖 | Grim Wand | wand | weapon | 1×2 | 5–11 | 0–0 | 0 / 0 | 0 | 26 | 2 | 15 | 否 | 不限 |
| hal | 长柄战斧 | Halberd | pole | weapon | 2×4 | 12–45 | 0–0 | 75 / 47 | 0 | 29 | 6 | 55 | 是 | 不限 |
| hax | 手斧 | Hand Axe | axe | weapon | 1×3 | 3–6 | 0–0 | 0 / 0 | 0 | 3 | 2 | 28 | 否 | 不限 |
| hbw | 猎弓 | Hunter's Bow | bow | weapon | 2×3 | 2–6 | 0–0 | 0 / 28 | 0 | 5 | 4 | 0 | 是 | 不限 |
| hdm | Horadric Malus | Horadric Malus | hamm | weapon | 1×2 | 6–15 | 0–0 | 15 / 15 | 0 | 0 | 0 | 55 | 否 | 不限 |
| hfh | Hellforge Hammer | Hellforge Hammer | hamm | weapon | 2×3 | 6–15 | 0–0 | 0 / 0 | 0 | 0 | 5 | 55 | 否 | 不限 |
| hst | Horadric Staff | Horadric Staff | staf | weapon | 1×4 | 12–20 | 0–0 | 30 / 0 | 0 | 0 | 0 | 50 | 是 | 不限 |
| hxb | 重十字弓 | Heavy Crossbow | xbow | weapon | 2×4 | 14–26 | 0–0 | 60 / 40 | 0 | 24 | 6 | 0 | 是 | 不限 |
| jav | 标枪 | Javelin | jave | weapon | 1×3 | 1–5 | 0–0 | 0 / 0 | 0 | 1 | 0 | 2 | 否 | 不限 |
| kri | 波形刀 | Kriss | knif | weapon | 1×3 | 2–11 | 0–0 | 0 / 45 | 0 | 17 | 3 | 24 | 否 | 不限 |
| ktr | 拳剑 | Katar | h2h | weapon | 1×3 | 4–7 | 0–0 | 20 / 20 | 0 | 1 | 2 | 48 | 否 | 刺客 |
| lax | 巨斧 | Large Axe | axe | weapon | 2×3 | 6–13 | 0–0 | 35 / 0 | 0 | 6 | 4 | 30 | 是 | 不限 |
| lbb | 长战斗弓 | Long Battle Bow | bow | weapon | 2×4 | 3–18 | 0–0 | 40 / 50 | 0 | 23 | 6 | 0 | 是 | 不限 |
| lbw | 长弓 | Long Bow | bow | weapon | 2×4 | 3–10 | 0–0 | 22 / 19 | 0 | 8 | 5 | 0 | 是 | 不限 |
| leg | Wirt's Leg | Wirt's Leg | club | weapon | 1×3 | 2–8 | 0–0 | 0 / 0 | 0 | 0 | 3 | 66 | 否 | 不限 |
| lsd | 长剑 | Long Sword | swor | weapon | 2×3 | 3–19 | 0–0 | 55 / 39 | 0 | 20 | 4 | 44 | 否 | 不限 |
| lst | 长棍 | Long Staff | staf | weapon | 1×4 | 2–8 | 0–0 | 0 / 0 | 0 | 8 | 3 | 30 | 是 | 不限 |
| lwb | 长战争弓 | Long War Bow | bow | weapon | 2×4 | 3–23 | 0–0 | 50 / 65 | 0 | 31 | 6 | 0 | 是 | 不限 |
| lxb | 轻十字弓 | Light Crossbow | xbow | weapon | 2×3 | 6–9 | 0–0 | 21 / 27 | 0 | 6 | 3 | 0 | 是 | 不限 |
| mac | 钉头锤 | Mace | mace | weapon | 1×3 | 3–10 | 0–0 | 27 / 0 | 0 | 8 | 2 | 60 | 否 | 不限 |
| mau | 大木棍 | Maul | hamm | weapon | 2×4 | 30–43 | 0–0 | 69 / 0 | 0 | 21 | 6 | 60 | 是 | 不限 |
| mpi | 军用锹 | Military Pick | axe | weapon | 2×3 | 7–11 | 0–0 | 49 / 33 | 0 | 19 | 6 | 26 | 否 | 不限 |
| msf | Staff of the Kings | Staff of the Kings | staf | weapon | 1×3 | 10–15 | 0–0 | 25 / 0 | 0 | 0 | 0 | 45 | 是 | 不限 |
| mst | 流星锤 | Morning Star | mace | weapon | 1×3 | 7–16 | 0–0 | 36 / 0 | 0 | 13 | 3 | 72 | 否 | 不限 |
| mxb | 十字弓 | Crossbow | xbow | weapon | 2×3 | 9–16 | 0–0 | 40 / 33 | 0 | 15 | 4 | 0 | 是 | 不限 |
| ob1 | 鹰之法珠 | Eagle Orb | orb | weapon | 1×2 | 2–5 | 0–0 | 0 / 0 | 0 | 1 | 4 | 20 | 否 | 法师 |
| ob2 | 神圣天球 | Sacred Globe | orb | weapon | 1×2 | 3–8 | 0–0 | 0 / 0 | 0 | 8 | 4 | 30 | 否 | 法师 |
| ob3 | 烟雾之球 | Smoked Sphere | orb | weapon | 1×2 | 4–10 | 0–0 | 0 / 0 | 8 | 12 | 4 | 35 | 否 | 法师 |
| ob4 | 握扣法珠 | Clasped Orb | orb | weapon | 1×2 | 5–12 | 0–0 | 0 / 0 | 13 | 17 | 4 | 40 | 否 | 法师 |
| ob5 | 杰瑞德之石 | Dragon Stone | orb | weapon | 1×3 | 8–18 | 0–0 | 0 / 0 | 18 | 24 | 4 | 50 | 否 | 法师 |
| ob6 | Glowing Orb | Glowing Orb | orb | weapon | 1×2 | 8–21 | 0–0 | 0 / 0 | 24 | 32 | 4 | 20 | 否 | 法师 |
| ob7 | Crystalline Globe | Crystalline Globe | orb | weapon | 1×2 | 10–26 | 0–0 | 0 / 0 | 27 | 37 | 4 | 30 | 否 | 法师 |
| ob8 | Cloudy Sphere | Cloudy Sphere | orb | weapon | 1×2 | 11–29 | 0–0 | 0 / 0 | 30 | 41 | 4 | 35 | 否 | 法师 |
| ob9 | Sparkling Ball | Sparkling Ball | orb | weapon | 1×2 | 13–32 | 0–0 | 0 / 0 | 34 | 46 | 4 | 40 | 否 | 法师 |
| oba | Swirling Crystal | Swirling Crystal | orb | weapon | 1×3 | 18–42 | 0–0 | 0 / 0 | 37 | 50 | 4 | 50 | 否 | 法师 |
| obb | Heavenly Stone | Heavenly Stone | orb | weapon | 1×2 | 21–46 | 0–0 | 0 / 0 | 44 | 59 | 4 | 20 | 否 | 法师 |
| obc | Eldritch Orb | Eldritch Orb | orb | weapon | 1×2 | 18–50 | 0–0 | 0 / 0 | 50 | 67 | 4 | 30 | 否 | 法师 |
| obd | Demon Heart | Demon Heart | orb | weapon | 1×2 | 23–55 | 0–0 | 0 / 0 | 56 | 75 | 4 | 35 | 否 | 法师 |
| obe | Vortex Orb | Vortex Orb | orb | weapon | 1×2 | 12–66 | 0–0 | 0 / 0 | 63 | 84 | 4 | 40 | 否 | 法师 |
| obf | Dimensional Shard | Dimensional Shard | orb | weapon | 1×3 | 30–53 | 0–0 | 0 / 0 | 66 | 85 | 4 | 50 | 否 | 法师 |
| opl | Fulminating Potion | Fulminating Potion | tpot | weapon | 1×1 | 0–1 | 0–0 | 0 / 0 | 0 | 4 | 0 | 0 | 否 | 不限 |
| opm | Exploding Potion | Exploding Potion | tpot | weapon | 1×1 | 0–1 | 0–0 | 0 / 0 | 12 | 16 | 0 | 0 | 否 | 不限 |
| ops | Oil Potion | Oil Potion | tpot | weapon | 1×1 | 0–1 | 0–0 | 0 / 0 | 20 | 28 | 0 | 0 | 否 | 不限 |
| pax | 长柄战斧 | Poleaxe | pole | weapon | 2×4 | 18–39 | 0–0 | 62 / 0 | 0 | 21 | 5 | 65 | 是 | 不限 |
| pik | 矛 | Pike | spea | weapon | 2×4 | 14–63 | 0–0 | 60 / 45 | 0 | 24 | 6 | 25 | 是 | 不限 |
| pil | 短标枪 | Pilum | jave | weapon | 1×3 | 4–9 | 0–0 | 0 / 45 | 0 | 10 | 0 | 3 | 否 | 不限 |
| qf1 | KhalimFlail | KhalimFlail | mace | weapon | 2×3 | 1–15 | 0–0 | 41 / 35 | 0 | 0 | 3 | 30 | 否 | 不限 |
| qf2 | SuperKhalimFlail | SuperKhalimFlail | mace | weapon | 2×3 | 1–15 | 0–0 | 0 / 0 | 0 | 0 | 3 | 30 | 否 | 不限 |
| rxb | 连射十字弓 | Repeating Crossbow | xbow | weapon | 2×3 | 6–12 | 0–0 | 40 / 50 | 0 | 33 | 5 | 0 | 是 | 不限 |
| sbb | 短战斗弓 | Short Battle Bow | bow | weapon | 2×3 | 5–11 | 0–0 | 30 / 40 | 0 | 18 | 5 | 0 | 是 | 不限 |
| sbr | 军刀 | Saber | swor | weapon | 1×3 | 3–8 | 0–0 | 25 / 25 | 0 | 8 | 2 | 32 | 否 | 不限 |
| sbw | 短弓 | Short Bow | bow | weapon | 2×3 | 1–4 | 0–0 | 0 / 15 | 0 | 1 | 3 | 0 | 是 | 不限 |
| scm | 弯刀 | Scimitar | swor | weapon | 1×3 | 2–6 | 0–0 | 0 / 21 | 0 | 5 | 2 | 22 | 否 | 不限 |
| scp | 权杖 | Scepter | scep | weapon | 1×3 | 6–11 | 0–0 | 25 / 0 | 0 | 3 | 2 | 50 | 否 | 不限 |
| scy | 镰刀 | Scythe | pole | weapon | 2×4 | 8–20 | 0–0 | 41 / 41 | 0 | 15 | 5 | 65 | 是 | 不限 |
| skr | 剪咬剑 | Scissors Katar | h2h | weapon | 1×3 | 9–17 | 0–0 | 55 / 55 | 0 | 24 | 3 | 68 | 否 | 刺客 |
| spc | 狼牙棒 | Spiked Club | club | weapon | 1×3 | 5–8 | 0–0 | 0 / 0 | 0 | 4 | 2 | 36 | 否 | 不限 |
| spr | 长矛 | Spear | spea | weapon | 2×4 | 3–15 | 0–0 | 0 / 20 | 0 | 5 | 3 | 30 | 是 | 不限 |
| spt | 大战戟 | Spetum | spea | weapon | 2×4 | 15–23 | 0–0 | 54 / 35 | 0 | 20 | 6 | 28 | 是 | 不限 |
| ssd | 短剑 | Short Sword | swor | weapon | 1×3 | 2–7 | 0–0 | 0 / 0 | 0 | 1 | 2 | 24 | 否 | 不限 |
| ssp | 短矛 | Short Spear | jave | weapon | 1×3 | 2–13 | 0–0 | 40 / 40 | 0 | 15 | 0 | 4 | 否 | 不限 |
| sst | 短棍 | Short Staff | staf | weapon | 1×3 | 1–5 | 0–0 | 0 / 0 | 0 | 1 | 2 | 20 | 是 | 不限 |
| swb | 短战争弓 | Short War Bow | bow | weapon | 2×3 | 6–14 | 0–0 | 35 / 55 | 0 | 27 | 5 | 0 | 是 | 不限 |
| tax | 飞斧 | Throwing Axe | taxe | weapon | 1×2 | 4–7 | 0–0 | 0 / 40 | 0 | 7 | 0 | 6 | 否 | 不限 |
| tkf | 飞刀 | Throwing Knife | tkni | weapon | 1×2 | 2–3 | 0–0 | 0 / 21 | 0 | 2 | 0 | 4 | 否 | 不限 |
| tri | 三叉戟 | Trident | spea | weapon | 2×4 | 9–15 | 0–0 | 38 / 24 | 0 | 9 | 4 | 35 | 是 | 不限 |
| tsp | 飞矛 | Throwing Spear | jave | weapon | 1×4 | 5–15 | 0–0 | 0 / 65 | 0 | 29 | 0 | 6 | 否 | 不限 |
| vou | 钩镰枪 | Voulge | pole | weapon | 2×4 | 6–21 | 0–0 | 50 / 0 | 0 | 11 | 4 | 50 | 是 | 不限 |
| wax | 战斧 | War Axe | axe | weapon | 2×3 | 10–18 | 0–0 | 67 / 0 | 0 | 25 | 6 | 26 | 否 | 不限 |
| whm | 战锤 | War Hammer | hamm | weapon | 2×3 | 19–29 | 0–0 | 53 / 0 | 0 | 25 | 4 | 55 | 否 | 不限 |
| wnd | 法杖 | Wand | wand | weapon | 1×2 | 2–4 | 0–0 | 0 / 0 | 0 | 2 | 1 | 15 | 否 | 不限 |
| wrb | 腕刃 | Wrist Blade | h2h | weapon | 1×3 | 5–9 | 0–0 | 33 / 33 | 0 | 9 | 2 | 52 | 否 | 刺客 |
| wsc | 巨战镰刀 | War Scythe | pole | weapon | 2×4 | 15–36 | 0–0 | 80 / 80 | 0 | 34 | 6 | 55 | 是 | 不限 |
| wsd | 巨战之剑 | War Sword | swor | weapon | 1×3 | 8–20 | 0–0 | 71 / 45 | 0 | 27 | 3 | 44 | 否 | 不限 |
| wsp | 战争权杖 | War Scepter | scep | weapon | 2×3 | 10–17 | 0–0 | 55 / 0 | 0 | 21 | 5 | 70 | 否 | 不限 |
| wst | 巨战法杖 | War Staff | staf | weapon | 2×4 | 12–28 | 0–0 | 0 / 0 | 0 | 24 | 6 | 50 | 是 | 不限 |
| ywn | 紫杉之杖 | Yew Wand | wand | weapon | 1×2 | 2–8 | 0–0 | 0 / 0 | 0 | 12 | 1 | 15 | 否 | 不限 |

### 护甲及配饰底材（207）

| 代码 | 名称 | 英文 | 类型 | 槽位 | 格数 | 伤害 | 防御 | 力量/敏捷 | 需求等级 | qlvl | 最大孔 | 耐久 | 双手 | 职业限制 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| aar | 古代装甲 | Ancient Armor | tors | body | 2×3 | 0–0 | 218–233 | 100 / 0 | 0 | 40 | 4 | 60 | 否 | 不限 |
| ba1 | Jawbone Cap | Jawbone Cap | phlm | head | 2×2 | 0–0 | 10–15 | 25 / 0 | 3 | 4 | 3 | 25 | 否 | 野蛮人 |
| ba2 | Fanged Helm | Fanged Helm | phlm | head | 2×2 | 0–0 | 15–20 | 35 / 0 | 6 | 8 | 3 | 35 | 否 | 野蛮人 |
| ba3 | Horned Helm | Horned Helm | phlm | head | 2×2 | 0–0 | 25–30 | 45 / 0 | 12 | 16 | 3 | 45 | 否 | 野蛮人 |
| ba4 | Assault Helmet | Assault Helmet | phlm | head | 2×2 | 0–0 | 30–35 | 55 / 0 | 15 | 20 | 3 | 50 | 否 | 野蛮人 |
| ba5 | Avenger Guard | Avenger Guard | phlm | head | 2×2 | 0–0 | 35–50 | 65 / 0 | 18 | 24 | 3 | 55 | 否 | 野蛮人 |
| ba6 | Jawbone Visor | Jawbone Visor | phlm | head | 2×2 | 0–0 | 55–68 | 58 / 0 | 25 | 33 | 3 | 25 | 否 | 野蛮人 |
| ba7 | Lion Helm | Lion Helm | phlm | head | 2×2 | 0–0 | 63–75 | 73 / 0 | 29 | 38 | 3 | 35 | 否 | 野蛮人 |
| ba8 | Rage Mask | Rage Mask | phlm | head | 2×2 | 0–0 | 78–90 | 88 / 0 | 29 | 44 | 3 | 45 | 否 | 野蛮人 |
| ba9 | Savage Helmet | Savage Helmet | phlm | head | 2×2 | 0–0 | 85–98 | 103 / 0 | 32 | 49 | 3 | 50 | 否 | 野蛮人 |
| baa | Slayer Guard | Slayer Guard | phlm | head | 2×2 | 0–0 | 93–120 | 118 / 0 | 40 | 54 | 3 | 55 | 否 | 野蛮人 |
| bab | Carnage Helm | Carnage Helm | phlm | head | 2×2 | 0–0 | 102–147 | 106 / 0 | 45 | 60 | 3 | 25 | 否 | 野蛮人 |
| bac | Fury Visor | Fury Visor | phlm | head | 2×2 | 0–0 | 105–150 | 129 / 0 | 49 | 66 | 3 | 35 | 否 | 野蛮人 |
| bad | Destroyer Helm | Destroyer Helm | phlm | head | 2×2 | 0–0 | 111–156 | 151 / 0 | 54 | 73 | 3 | 45 | 否 | 野蛮人 |
| bae | Conquerer Crown | Conquerer Crown | phlm | head | 2×2 | 0–0 | 114–159 | 174 / 0 | 60 | 80 | 3 | 50 | 否 | 野蛮人 |
| baf | Guardian Crown | Guardian Crown | phlm | head | 2×2 | 0–0 | 117–168 | 196 / 0 | 65 | 85 | 3 | 55 | 否 | 野蛮人 |
| bhm | 白骨头盔 | Bone Helm | helm | head | 2×2 | 0–0 | 33–36 | 25 / 0 | 0 | 22 | 2 | 40 | 否 | 不限 |
| brs | 胸甲 | Breast Plate | tors | body | 2×3 | 0–0 | 65–68 | 30 / 0 | 0 | 18 | 3 | 50 | 否 | 不限 |
| bsh | 白骨盾牌 | Bone Shield | shie | offhand | 2×3 | 3–6 | 10–30 | 25 / 0 | 0 | 19 | 2 | 40 | 否 | 不限 |
| buc | 小圆盾 | Buckler | shie | offhand | 2×2 | 1–3 | 4–6 | 12 / 0 | 0 | 1 | 1 | 12 | 否 | 不限 |
| cap | 帽子 | Cap/hat | helm | head | 2×2 | 0–0 | 3–5 | 0 / 0 | 0 | 1 | 2 | 12 | 否 | 不限 |
| chn | 锁子甲 | Chain Mail | tors | body | 2×3 | 0–0 | 72–75 | 48 / 0 | 0 | 15 | 2 | 45 | 否 | 不限 |
| ci0 | 头环 | Circlet | circ | head | 2×2 | 0–0 | 20–30 | 0 / 0 | 16 | 24 | 2 | 35 | 否 | 不限 |
| ci1 | 宝冠 | Coronet | circ | head | 2×2 | 0–0 | 30–40 | 0 / 0 | 39 | 52 | 2 | 30 | 否 | 不限 |
| ci2 | 三重冠 | Tiara | circ | head | 2×2 | 0–0 | 40–50 | 0 / 0 | 52 | 70 | 3 | 25 | 否 | 不限 |
| ci3 | 权冠 | Diadem | circ | head | 2×2 | 0–0 | 50–60 | 0 / 0 | 64 | 85 | 3 | 20 | 否 | 不限 |
| crn | 皇冠 | Crown | helm | head | 2×2 | 0–0 | 25–45 | 55 / 0 | 0 | 29 | 3 | 50 | 否 | 不限 |
| dr1 | Wolf Head | Wolf Head | pelt | head | 2×2 | 0–0 | 8–11 | 16 / 0 | 3 | 4 | 3 | 20 | 否 | 德鲁伊 |
| dr2 | Hawk Helm | Hawk Helm | pelt | head | 2×2 | 0–0 | 4–15 | 20 / 0 | 6 | 8 | 3 | 20 | 否 | 德鲁伊 |
| dr3 | Antlers | Antlers | pelt | head | 2×2 | 0–0 | 18–24 | 24 / 0 | 12 | 16 | 3 | 20 | 否 | 德鲁伊 |
| dr4 | Falcon Mask | Falcon Mask | pelt | head | 2×2 | 0–0 | 12–28 | 28 / 0 | 15 | 20 | 3 | 20 | 否 | 德鲁伊 |
| dr5 | Spirit Mask | Spirit Mask | pelt | head | 2×2 | 0–0 | 22–35 | 30 / 0 | 18 | 24 | 3 | 20 | 否 | 德鲁伊 |
| dr6 | Alpha Helm | Alpha Helm | pelt | head | 2×2 | 0–0 | 52–62 | 44 / 0 | 26 | 35 | 3 | 20 | 否 | 德鲁伊 |
| dr7 | Griffon Headress | Griffon Headress | pelt | head | 2×2 | 0–0 | 46–68 | 50 / 0 | 30 | 40 | 3 | 20 | 否 | 德鲁伊 |
| dr8 | Hunter's Guise | Hunter's Guise | pelt | head | 2×2 | 0–0 | 67–81 | 56 / 0 | 29 | 46 | 3 | 20 | 否 | 德鲁伊 |
| dr9 | Sacred Feathers | Sacred Feathers | pelt | head | 2×2 | 0–0 | 58–87 | 62 / 0 | 32 | 50 | 3 | 20 | 否 | 德鲁伊 |
| dra | Totemic Mask | Totemic Mask | pelt | head | 2×2 | 0–0 | 73–98 | 65 / 0 | 41 | 55 | 3 | 20 | 否 | 德鲁伊 |
| drb | Blood Spirt | Blood Spirt | pelt | head | 2×2 | 0–0 | 101–145 | 86 / 0 | 46 | 62 | 3 | 20 | 否 | 德鲁伊 |
| drc | Sun Spirit | Sun Spirit | pelt | head | 2×2 | 0–0 | 98–147 | 95 / 0 | 51 | 69 | 3 | 20 | 否 | 德鲁伊 |
| drd | Earth Spirit | Earth Spirit | pelt | head | 2×2 | 0–0 | 107–152 | 104 / 0 | 57 | 76 | 3 | 20 | 否 | 德鲁伊 |
| dre | Sky Spirit | Sky Spirit | pelt | head | 2×2 | 0–0 | 103–155 | 113 / 0 | 62 | 83 | 3 | 20 | 否 | 德鲁伊 |
| drf | Dream Spirit | Dream Spirit | pelt | head | 2×2 | 0–0 | 109–159 | 118 / 0 | 66 | 85 | 3 | 20 | 否 | 德鲁伊 |
| fhl | 高级头盔 | Full Helm | helm | head | 2×2 | 0–0 | 23–26 | 41 / 0 | 0 | 15 | 2 | 30 | 否 | 不限 |
| fld | 实战铠甲 | Field Plate | tors | body | 2×3 | 0–0 | 101–105 | 55 / 0 | 0 | 28 | 2 | 48 | 否 | 不限 |
| ful | 高级战甲 | Full Plate Mail | tors | body | 2×3 | 0–0 | 150–161 | 80 / 0 | 0 | 37 | 4 | 70 | 否 | 不限 |
| ghm | 卓越头盔 | Great Helm | helm | head | 2×2 | 0–0 | 30–35 | 63 / 0 | 0 | 23 | 3 | 40 | 否 | 不限 |
| gth | 哥德战甲 | Gothic Plate | tors | body | 2×3 | 0–0 | 128–135 | 70 / 0 | 0 | 32 | 4 | 55 | 否 | 不限 |
| gts | 哥德盾牌 | Gothic Shield | shie | offhand | 2×4 | 2–6 | 30–35 | 60 / 0 | 0 | 30 | 3 | 40 | 否 | 不限 |
| hbl | 金属扣带 | Girdle(H) | belt | belt | 2×1 | 0–0 | 8–11 | 60 / 0 | 0 | 27 | 0 | 24 | 否 | 不限 |
| hbt | 护胫 | Plate Boots | boot | boots | 2×2 | 10–20 | 12–15 | 70 / 0 | 0 | 27 | 0 | 24 | 否 | 不限 |
| hgl | 铁手套 | Gaunlets(H) | glov | gloves | 2×2 | 0–0 | 12–15 | 60 / 0 | 0 | 27 | 0 | 24 | 否 | 不限 |
| hla | 硬皮甲 | Hard Leather Armor | tors | body | 2×3 | 0–0 | 21–24 | 20 / 0 | 0 | 5 | 2 | 28 | 否 | 不限 |
| hlm | 头盔 | Helm | helm | head | 2×2 | 0–0 | 15–18 | 26 / 0 | 0 | 11 | 2 | 24 | 否 | 不限 |
| kit | 轻盾 | Kite Shield | shie | offhand | 2×3 | 2–5 | 16–18 | 47 / 0 | 0 | 15 | 3 | 30 | 否 | 不限 |
| lbl | 饰带 | Sash(L) | belt | belt | 2×1 | 0–0 | 2–2 | 0 / 0 | 0 | 3 | 0 | 12 | 否 | 不限 |
| lbt | 皮靴 | Leather Boots | boot | boots | 2×2 | 3–8 | 2–3 | 0 / 0 | 0 | 3 | 0 | 12 | 否 | 不限 |
| lea | 皮甲 | Leather Armor | tors | body | 2×3 | 0–0 | 14–17 | 15 / 0 | 0 | 3 | 2 | 24 | 否 | 不限 |
| lgl | 皮手套 | Gloves(L) | glov | gloves | 2×2 | 0–0 | 2–3 | 0 / 0 | 0 | 3 | 0 | 12 | 否 | 不限 |
| lrg | 大盾牌 | Large Shield | shie | offhand | 2×3 | 2–4 | 12–14 | 34 / 0 | 0 | 11 | 3 | 24 | 否 | 不限 |
| ltp | 轻型装甲 | Light Plate | tors | body | 2×3 | 0–0 | 90–107 | 41 / 0 | 0 | 35 | 3 | 60 | 否 | 不限 |
| mbl | 扣带 | Belt(M) | belt | belt | 2×1 | 0–0 | 5–5 | 25 / 0 | 0 | 12 | 0 | 16 | 否 | 不限 |
| mbt | 锁链靴 | Chain Boots | boot | boots | 2×2 | 6–12 | 8–9 | 30 / 0 | 0 | 12 | 0 | 16 | 否 | 不限 |
| mgl | 锁链手套 | Bracers(M) | glov | gloves | 2×2 | 0–0 | 8–9 | 25 / 0 | 0 | 12 | 0 | 16 | 否 | 不限 |
| msk | 面具 | Mask | helm | head | 2×2 | 0–0 | 9–27 | 23 / 0 | 0 | 19 | 3 | 20 | 否 | 不限 |
| ne1 | Preserved Head | Preserved Head | head | offhand | 2×2 | 0–0 | 2–5 | 12 / 0 | 3 | 4 | 2 | 20 | 否 | 死灵法师 |
| ne2 | Zombie Head | Zombie Head | head | offhand | 2×2 | 0–0 | 4–8 | 14 / 0 | 6 | 8 | 2 | 20 | 否 | 死灵法师 |
| ne3 | Unraveller Head | Unraveller Head | head | offhand | 2×2 | 0–0 | 6–10 | 18 / 0 | 12 | 16 | 2 | 20 | 否 | 死灵法师 |
| ne4 | Gargoyle Head | Gargoyle Head | head | offhand | 2×2 | 0–0 | 10–16 | 20 / 0 | 15 | 20 | 2 | 20 | 否 | 死灵法师 |
| ne5 | Demon Head | Demon Head | head | offhand | 2×2 | 0–0 | 15–20 | 25 / 0 | 18 | 24 | 2 | 20 | 否 | 死灵法师 |
| ne6 | Mummified Trophy | Mummified Trophy | head | offhand | 2×2 | 0–0 | 38–48 | 38 / 0 | 24 | 33 | 2 | 20 | 否 | 死灵法师 |
| ne7 | Fetish Trophy | Fetish Trophy | head | offhand | 2×2 | 0–0 | 41–52 | 41 / 0 | 29 | 39 | 2 | 20 | 否 | 死灵法师 |
| ne8 | Sexton Trophy | Sexton Trophy | head | offhand | 2×2 | 0–0 | 44–55 | 47 / 0 | 33 | 45 | 2 | 20 | 否 | 死灵法师 |
| ne9 | Cantor Trophy | Cantor Trophy | head | offhand | 2×2 | 0–0 | 50–64 | 50 / 0 | 36 | 49 | 2 | 20 | 否 | 死灵法师 |
| nea | Heirophant Trophy | Heirophant Trophy | head | offhand | 2×2 | 0–0 | 58–70 | 58 / 0 | 40 | 54 | 2 | 20 | 否 | 死灵法师 |
| neb | Minion Skull | Minion Skull | head | offhand | 2×2 | 0–0 | 95–139 | 77 / 0 | 44 | 59 | 2 | 20 | 否 | 死灵法师 |
| ned | Overseer Skull | Overseer Skull | head | offhand | 2×2 | 0–0 | 98–142 | 91 / 0 | 49 | 66 | 2 | 20 | 否 | 死灵法师 |
| nee | Succubae Skull | Succubae Skull | head | offhand | 2×2 | 0–0 | 100–146 | 95 / 0 | 60 | 81 | 2 | 20 | 否 | 死灵法师 |
| nef | Bloodlord Skull | Bloodlord Skull | head | offhand | 2×2 | 0–0 | 103–148 | 106 / 0 | 65 | 85 | 2 | 20 | 否 | 死灵法师 |
| neg | Hellspawn Skull | Hellspawn Skull | head | offhand | 2×2 | 0–0 | 96–141 | 82 / 0 | 50 | 67 | 2 | 20 | 否 | 死灵法师 |
| pa1 | Targe | Targe | ashd | offhand | 2×2 | 2–6 | 8–12 | 16 / 0 | 3 | 4 | 4 | 20 | 否 | 圣骑士 |
| pa2 | Rondache | Rondache | ashd | offhand | 2×2 | 2–8 | 10–18 | 26 / 0 | 6 | 8 | 4 | 30 | 否 | 圣骑士 |
| pa3 | Heraldic Shield | Heraldic Shield | ashd | offhand | 2×4 | 3–9 | 16–26 | 40 / 0 | 12 | 16 | 4 | 40 | 否 | 圣骑士 |
| pa4 | Aerin Shield | Aerin Shield | ashd | offhand | 2×4 | 4–10 | 26–36 | 50 / 0 | 15 | 20 | 4 | 50 | 否 | 圣骑士 |
| pa5 | Crown Shield | Crown Shield | ashd | offhand | 2×2 | 4–12 | 30–40 | 65 / 0 | 18 | 24 | 4 | 60 | 否 | 圣骑士 |
| pa6 | Akaran Targe | Akaran Targe | ashd | offhand | 2×2 | 12–16 | 101–125 | 44 / 0 | 26 | 35 | 4 | 20 | 否 | 圣骑士 |
| pa7 | Akaran Rondache | Akaran Rondache | ashd | offhand | 2×2 | 15–20 | 113–137 | 59 / 0 | 30 | 40 | 4 | 30 | 否 | 圣骑士 |
| pa8 | Protector Shield | Protector Shield | ashd | offhand | 2×4 | 18–24 | 129–153 | 69 / 0 | 34 | 46 | 4 | 40 | 否 | 圣骑士 |
| pa9 | Guilded Shield | Guilded Shield | ashd | offhand | 2×4 | 20–28 | 144–168 | 89 / 0 | 38 | 51 | 4 | 50 | 否 | 圣骑士 |
| paa | Royal Shield | Royal Shield | ashd | offhand | 2×2 | 24–32 | 156–181 | 114 / 0 | 41 | 55 | 4 | 60 | 否 | 圣骑士 |
| pab | Sacred Targe | Sacred Targe | ashd | offhand | 2×2 | 22–70 | 126–158 | 86 / 0 | 47 | 63 | 4 | 45 | 否 | 圣骑士 |
| pac | Sacred Rondache | Sacred Rondache | ashd | offhand | 2×2 | 35–58 | 138–164 | 109 / 0 | 52 | 70 | 4 | 68 | 否 | 圣骑士 |
| pad | Ancient Shield | Ancient Shield | ashd | offhand | 2×4 | 10–82 | 154–172 | 124 / 0 | 55 | 74 | 4 | 55 | 否 | 圣骑士 |
| pae | Zakarum Shield | Zakarum Shield | ashd | offhand | 2×4 | 46–46 | 169–193 | 142 / 0 | 61 | 82 | 4 | 65 | 否 | 圣骑士 |
| paf | Vortex Shield | Vortex Shield | ashd | offhand | 2×2 | 5–87 | 182–225 | 148 / 0 | 66 | 85 | 4 | 90 | 否 | 圣骑士 |
| plt | 铠甲 | Plate Mail | tors | body | 2×3 | 0–0 | 108–116 | 65 / 0 | 0 | 24 | 2 | 60 | 否 | 不限 |
| qui | 布甲 | Quilted Armor | tors | body | 2×3 | 0–0 | 8–11 | 12 / 0 | 0 | 1 | 2 | 20 | 否 | 不限 |
| rng | 环甲 | Ring Mail | tors | body | 2×3 | 0–0 | 45–48 | 36 / 0 | 0 | 11 | 3 | 26 | 否 | 不限 |
| scl | 鳞甲 | Scale Mail | tors | body | 2×3 | 0–0 | 57–60 | 44 / 0 | 0 | 13 | 2 | 36 | 否 | 不限 |
| skp | 骷髅帽 | Skull Cap | helm | head | 2×2 | 0–0 | 8–11 | 15 / 0 | 0 | 5 | 2 | 18 | 否 | 不限 |
| sml | 小盾牌 | Small Shield | shie | offhand | 2×2 | 2–3 | 8–10 | 22 / 0 | 0 | 5 | 2 | 16 | 否 | 不限 |
| spk | 尖刺盾牌 | Spiked Shield | shie | offhand | 2×3 | 5–9 | 15–25 | 30 / 0 | 0 | 11 | 2 | 40 | 否 | 不限 |
| spl | 板甲 | Splint Mail | tors | body | 2×3 | 0–0 | 90–95 | 51 / 0 | 0 | 20 | 2 | 30 | 否 | 不限 |
| stu | 镶嵌甲 | Studded Leather | tors | body | 2×3 | 0–0 | 32–35 | 27 / 0 | 0 | 8 | 2 | 32 | 否 | 不限 |
| tbl | 重扣带 | Heavy Belt | belt | belt | 2×1 | 0–0 | 6–6 | 45 / 0 | 0 | 20 | 0 | 18 | 否 | 不限 |
| tbt | 轻型金属靴 | Light Plate Boots | boot | boots | 2×2 | 8–16 | 9–11 | 50 / 0 | 0 | 20 | 0 | 18 | 否 | 不限 |
| tgl | 轻型铁手套 | Light Gauntlets | glov | gloves | 2×2 | 0–0 | 9–11 | 45 / 0 | 0 | 20 | 0 | 18 | 否 | 不限 |
| tow | 塔盾 | Tower Shield | shie | offhand | 2×3 | 1–5 | 22–25 | 75 / 0 | 0 | 22 | 3 | 60 | 否 | 不限 |
| uap | Shako | Shako | helm | head | 2×2 | 0–0 | 98–141 | 50 / 0 | 43 | 58 | 2 | 12 | 否 | 不限 |
| uar | Sacred Armor | Sacred Armor | tors | body | 2×3 | 0–0 | 487–600 | 232 / 0 | 66 | 85 | 4 | 60 | 否 | 不限 |
| ucl | Loricated Mail | Loricated Mail | tors | body | 2×3 | 0–0 | 390–496 | 149 / 0 | 55 | 73 | 4 | 36 | 否 | 不限 |
| uea | Wyrmhide | Wyrmhide | tors | body | 2×3 | 0–0 | 364–470 | 84 / 0 | 50 | 67 | 4 | 24 | 否 | 不限 |
| uh9 | Bone Visage | Bone Visage | helm | head | 2×2 | 0–0 | 100–157 | 106 / 0 | 63 | 84 | 3 | 40 | 否 | 不限 |
| uhb | Myrmidon Greaves | Myrmidon Greaves | boot | boots | 2×2 | 83–149 | 62–71 | 208 / 0 | 65 | 85 | 0 | 24 | 否 | 不限 |
| uhc | Colossus Girdle | Colossus Girdle | belt | belt | 2×1 | 0–0 | 61–71 | 185 / 0 | 67 | 85 | 0 | 24 | 否 | 不限 |
| uhg | Ogre Gauntlets | Ogre Gauntlets | glov | gloves | 2×2 | 0–0 | 62–71 | 185 / 0 | 64 | 85 | 0 | 24 | 否 | 不限 |
| uhl | Giant Conch | Giant Conch | helm | head | 2×2 | 0–0 | 110–154 | 142 / 0 | 40 | 54 | 2 | 30 | 否 | 不限 |
| uhm | Spired Helm | Spired Helm | helm | head | 2×2 | 0–0 | 114–159 | 192 / 0 | 59 | 79 | 3 | 40 | 否 | 不限 |
| uhn | Boneweave | Boneweave | tors | body | 2×3 | 0–0 | 399–505 | 158 / 0 | 47 | 62 | 4 | 45 | 否 | 不限 |
| uit | Monarch | Monarch | shie | offhand | 2×3 | 12–34 | 133–148 | 156 / 0 | 54 | 72 | 4 | 86 | 否 | 不限 |
| ukp | Hydraskull | Hydraskull | helm | head | 2×2 | 0–0 | 101–145 | 84 / 0 | 47 | 63 | 2 | 18 | 否 | 不限 |
| ula | Scarab Husk | Scarab Husk | tors | body | 2×3 | 0–0 | 369–474 | 95 / 0 | 51 | 68 | 4 | 28 | 否 | 不限 |
| ulb | Wyrmhide Boots | Wyrmhide Boots | boot | boots | 2×2 | 65–100 | 54–62 | 50 / 0 | 45 | 60 | 0 | 12 | 否 | 不限 |
| ulc | Spiderweb Sash | Spiderweb Sash | belt | belt | 2×1 | 0–0 | 55–62 | 50 / 0 | 46 | 61 | 0 | 12 | 否 | 不限 |
| uld | Kraken Shell | Kraken Shell | tors | body | 2×3 | 0–0 | 417–523 | 174 / 0 | 61 | 81 | 4 | 48 | 否 | 不限 |
| ulg | Bramble Mitts | Bramble Mitts | glov | gloves | 2×2 | 0–0 | 54–62 | 50 / 0 | 42 | 57 | 0 | 12 | 否 | 不限 |
| ulm | Armet | Armet | helm | head | 2×2 | 0–0 | 105–149 | 109 / 0 | 51 | 68 | 2 | 24 | 否 | 不限 |
| ult | Hellforged Plate | Hellforged Plate | tors | body | 2×3 | 0–0 | 421–530 | 196 / 0 | 59 | 78 | 4 | 60 | 否 | 不限 |
| umb | Boneweave Boots | Boneweave Boots | boot | boots | 2×2 | 69–118 | 59–67 | 118 / 0 | 54 | 72 | 0 | 16 | 否 | 不限 |
| umc | Mithril Coil | Mithril Coil | belt | belt | 2×1 | 0–0 | 58–65 | 106 / 0 | 56 | 75 | 0 | 16 | 否 | 不限 |
| umg | Vambraces | Vambraces | glov | gloves | 2×2 | 0–0 | 59–67 | 106 / 0 | 51 | 69 | 0 | 16 | 否 | 不限 |
| uml | Luna | Luna | shie | offhand | 2×2 | 17–29 | 108–123 | 100 / 0 | 45 | 61 | 2 | 84 | 否 | 不限 |
| ung | Diamond Mail | Diamond Mail | tors | body | 2×3 | 0–0 | 383–489 | 131 / 0 | 54 | 72 | 4 | 26 | 否 | 不限 |
| uow | Aegis | Aegis | shie | offhand | 2×3 | 18–28 | 145–161 | 219 / 0 | 59 | 79 | 4 | 92 | 否 | 不限 |
| upk | Blade Barrier | Blade Barrier | shie | offhand | 2×3 | 26–40 | 147–163 | 118 / 0 | 51 | 68 | 3 | 83 | 否 | 不限 |
| upl | Balrog Skin | Balrog Skin | tors | body | 2×3 | 0–0 | 410–517 | 165 / 0 | 57 | 76 | 4 | 30 | 否 | 不限 |
| urg | Hyperion | Hyperion | shie | offhand | 2×3 | 14–32 | 119–135 | 127 / 0 | 48 | 64 | 3 | 82 | 否 | 不限 |
| urn | Corona | Corona | helm | head | 2×2 | 0–0 | 111–165 | 174 / 0 | 66 | 85 | 3 | 50 | 否 | 不限 |
| urs | Great Hauberk | Great Hauberk | tors | body | 2×3 | 0–0 | 395–501 | 118 / 0 | 56 | 75 | 4 | 50 | 否 | 不限 |
| ush | Troll Nest | Troll Nest | shie | offhand | 2×3 | 24–38 | 158–173 | 106 / 0 | 57 | 76 | 3 | 74 | 否 | 不限 |
| usk | Demonhead | Demonhead | helm | head | 2×2 | 0–0 | 101–154 | 102 / 0 | 55 | 74 | 3 | 20 | 否 | 不限 |
| utb | Mirrored Boots | Mirrored Boots | boot | boots | 2×2 | 50–145 | 59–68 | 163 / 0 | 60 | 81 | 0 | 18 | 否 | 不限 |
| utc | Troll Belt | Troll Belt | belt | belt | 2×1 | 0–0 | 59–66 | 151 / 0 | 62 | 82 | 0 | 18 | 否 | 不限 |
| utg | Crusader Gauntlets | Crusader Gauntlets | glov | gloves | 2×2 | 0–0 | 59–68 | 151 / 0 | 57 | 76 | 0 | 18 | 否 | 不限 |
| uth | Lacquered Plate | Lacquered Plate | tors | body | 2×3 | 0–0 | 433–541 | 208 / 0 | 62 | 82 | 4 | 55 | 否 | 不限 |
| utp | Archon Plate | Archon Plate | tors | body | 2×3 | 0–0 | 410–524 | 103 / 0 | 63 | 84 | 4 | 60 | 否 | 不限 |
| uts | Ward | Ward | shie | offhand | 2×4 | 11–35 | 153–170 | 185 / 0 | 63 | 84 | 4 | 100 | 否 | 不限 |
| utu | Wire Fleece | Wire Fleece | tors | body | 2×3 | 0–0 | 375–481 | 111 / 0 | 53 | 70 | 4 | 32 | 否 | 不限 |
| uuc | Heater | Heater | shie | offhand | 2×2 | 16–30 | 95–110 | 77 / 0 | 43 | 58 | 2 | 88 | 否 | 不限 |
| uui | Dusk Shroud | Dusk Shroud | tors | body | 2×3 | 0–0 | 361–467 | 77 / 0 | 49 | 65 | 4 | 20 | 否 | 不限 |
| uul | Shadow Plate | Shadow Plate | tors | body | 2×3 | 0–0 | 446–557 | 230 / 0 | 64 | 83 | 4 | 70 | 否 | 不限 |
| uvb | Scarabshell Boots | Scarabshell Boots | boot | boots | 2×2 | 60–110 | 56–65 | 91 / 0 | 49 | 66 | 0 | 14 | 否 | 不限 |
| uvc | Vampirefang Belt | Vampirefang Belt | belt | belt | 2×1 | 0–0 | 56–63 | 50 / 0 | 51 | 68 | 0 | 14 | 否 | 不限 |
| uvg | Vampirebone Gloves | Vampirebone Gloves | glov | gloves | 2×2 | 0–0 | 56–65 | 50 / 0 | 47 | 63 | 0 | 14 | 否 | 不限 |
| vbl | 轻扣带 | Light Belt | belt | belt | 2×1 | 0–0 | 3–3 | 0 / 0 | 0 | 7 | 0 | 14 | 否 | 不限 |
| vbt | 重靴 | Heavy Boots | boot | boots | 2×2 | 4–10 | 5–6 | 18 / 0 | 0 | 7 | 0 | 14 | 否 | 不限 |
| vgl | 重手套 | Heavy Gloves | glov | gloves | 2×2 | 0–0 | 5–6 | 0 / 0 | 0 | 7 | 0 | 14 | 否 | 不限 |
| xap | War Hat | War Hat | helm | head | 2×2 | 0–0 | 45–53 | 20 / 0 | 22 | 34 | 2 | 12 | 否 | 不限 |
| xar | Ornate Armor | Ornate Armor | tors | body | 2×3 | 0–0 | 417–450 | 170 / 0 | 25 | 64 | 4 | 60 | 否 | 不限 |
| xcl | Tigulated Mail | Tigulated Mail | tors | body | 2×3 | 0–0 | 176–190 | 86 / 0 | 25 | 43 | 3 | 36 | 否 | 不限 |
| xea | Serpentskin Armor | Serpentskin Armor | tors | body | 2×3 | 0–0 | 111–126 | 43 / 0 | 24 | 36 | 2 | 24 | 否 | 不限 |
| xh9 | Grim Helm | Grim Helm | helm | head | 2×2 | 0–0 | 60–125 | 58 / 0 | 25 | 50 | 2 | 40 | 否 | 不限 |
| xhb | War Boots | War Boots | boot | boots | 2×2 | 39–80 | 43–53 | 125 / 0 | 25 | 54 | 0 | 24 | 否 | 不限 |
| xhg | War Gauntlets | War Gauntlets | glov | gloves | 2×2 | 0–0 | 43–53 | 110 / 0 | 25 | 54 | 0 | 24 | 否 | 不限 |
| xhl | Basinet | Basinet | helm | head | 2×2 | 0–0 | 75–84 | 82 / 0 | 25 | 45 | 2 | 30 | 否 | 不限 |
| xhm | Winged Helm | Winged Helm | helm | head | 2×2 | 0–0 | 85–98 | 115 / 0 | 25 | 51 | 3 | 40 | 否 | 不限 |
| xhn | Mesh Armor | Mesh Armor | tors | body | 2×3 | 0–0 | 198–213 | 92 / 0 | 25 | 45 | 3 | 45 | 否 | 不限 |
| xit | Dragon Shield | Dragon Shield | shie | offhand | 2×3 | 15–24 | 59–67 | 91 / 0 | 25 | 45 | 3 | 76 | 否 | 不限 |
| xkp | Sallet | Sallet | helm | head | 2×2 | 0–0 | 52–62 | 43 / 0 | 25 | 37 | 2 | 18 | 否 | 不限 |
| xla | Demonhide Armor | Demonhide Armor | tors | body | 2×3 | 0–0 | 122–136 | 50 / 0 | 25 | 37 | 2 | 28 | 否 | 不限 |
| xlb | Demonhide Boots | Demonhide Boots | boot | boots | 2×2 | 26–46 | 28–35 | 20 / 0 | 24 | 36 | 0 | 12 | 否 | 不限 |
| xld | Sharktooth Armor | Sharktooth Armor | tors | body | 2×3 | 0–0 | 242–258 | 103 / 0 | 25 | 55 | 3 | 48 | 否 | 不限 |
| xlg | Demonhide Gloves | Demonhide Gloves | glov | gloves | 2×2 | 0–0 | 28–35 | 20 / 0 | 21 | 33 | 0 | 12 | 否 | 不限 |
| xlm | Casque | Casque | helm | head | 2×2 | 0–0 | 63–72 | 59 / 0 | 25 | 42 | 2 | 24 | 否 | 不限 |
| xlt | Templar Coat | Templar Coat | tors | body | 2×3 | 0–0 | 252–274 | 118 / 0 | 25 | 52 | 3 | 60 | 否 | 不限 |
| xmb | Mesh Boots | Mesh Boots | boot | boots | 2×2 | 23–52 | 37–44 | 65 / 0 | 25 | 43 | 0 | 16 | 否 | 不限 |
| xmg | Heavy Bracers | Heavy Bracers | glov | gloves | 2×2 | 0–0 | 37–44 | 58 / 0 | 25 | 43 | 0 | 16 | 否 | 不限 |
| xml | Round Shield | Round Shield | shie | offhand | 2×2 | 7–14 | 47–55 | 53 / 0 | 25 | 37 | 2 | 64 | 否 | 不限 |
| xng | Linked Mail | Linked Mail | tors | body | 2×3 | 0–0 | 158–172 | 74 / 0 | 25 | 42 | 3 | 26 | 否 | 不限 |
| xow | Pavise | Pavise | shie | offhand | 2×3 | 10–17 | 68–78 | 133 / 0 | 25 | 50 | 3 | 72 | 否 | 不限 |
| xpk | Barbed Shield | Barbed Shield | shie | offhand | 2×3 | 18–35 | 58–78 | 65 / 0 | 25 | 42 | 2 | 55 | 否 | 不限 |
| xpl | Russet Armor | Russet Armor | tors | body | 2×3 | 0–0 | 225–243 | 97 / 0 | 25 | 49 | 3 | 30 | 否 | 不限 |
| xrg | Scutum | Scutum | shie | offhand | 2×3 | 11–15 | 53–61 | 71 / 0 | 25 | 42 | 3 | 62 | 否 | 不限 |
| xrn | Grand Crown | Grand Crown | helm | head | 2×2 | 0–0 | 78–113 | 103 / 0 | 25 | 55 | 3 | 50 | 否 | 不限 |
| xrs | Cuirass | Cuirass | tors | body | 2×3 | 0–0 | 188–202 | 65 / 0 | 25 | 47 | 3 | 50 | 否 | 不限 |
| xsh | Grim Shield | Grim Shield | shie | offhand | 2×3 | 14–20 | 50–150 | 58 / 0 | 25 | 48 | 2 | 70 | 否 | 不限 |
| xsk | Death Mask | Death Mask | helm | head | 2×2 | 0–0 | 54–86 | 55 / 0 | 25 | 48 | 3 | 20 | 否 | 不限 |
| xtb | Battle Boots | Battle Boots | boot | boots | 2×2 | 37–64 | 39–47 | 95 / 0 | 25 | 49 | 0 | 18 | 否 | 不限 |
| xtg | Battle Gauntlets | Battle Gauntlets | glov | gloves | 2×2 | 0–0 | 39–47 | 88 / 0 | 25 | 49 | 0 | 18 | 否 | 不限 |
| xth | Embossed Plate | Embossed Plate | tors | body | 2×3 | 0–0 | 282–303 | 125 / 0 | 25 | 58 | 4 | 55 | 否 | 不限 |
| xtp | Mage Plate | Mage Plate | tors | body | 2×3 | 0–0 | 225–261 | 55 / 0 | 25 | 60 | 3 | 60 | 否 | 不限 |
| xts | Ancient Shield | Ancient Shield | shie | offhand | 2×4 | 12–16 | 80–93 | 110 / 0 | 25 | 56 | 3 | 80 | 否 | 不限 |
| xtu | Trellised Armor | Trellised Armor | tors | body | 2×3 | 0–0 | 138–153 | 61 / 0 | 25 | 40 | 2 | 32 | 否 | 不限 |
| xuc | Defender | Defender | shie | offhand | 2×2 | 8–12 | 41–49 | 38 / 0 | 22 | 34 | 1 | 68 | 否 | 不限 |
| xui | Ghost Armor | Ghost Armor | tors | body | 2×3 | 0–0 | 102–117 | 38 / 0 | 22 | 34 | 2 | 20 | 否 | 不限 |
| xul | Chaos Armor | Chaos Armor | tors | body | 2×3 | 0–0 | 315–342 | 140 / 0 | 25 | 61 | 4 | 70 | 否 | 不限 |
| xvb | Sharkskin Boots | Sharkskin Boots | boot | boots | 2×2 | 28–50 | 33–39 | 47 / 0 | 25 | 39 | 0 | 14 | 否 | 不限 |
| xvg | Sharkskin Gloves | Sharkskin Gloves | glov | gloves | 2×2 | 0–0 | 33–39 | 20 / 0 | 25 | 39 | 0 | 14 | 否 | 不限 |
| zhb | War Belt | War Belt | belt | belt | 2×1 | 0–0 | 41–52 | 110 / 0 | 25 | 54 | 0 | 24 | 否 | 不限 |
| zlb | Demonhide Sash | Demonhide Sash | belt | belt | 2×1 | 0–0 | 29–34 | 20 / 0 | 24 | 36 | 0 | 12 | 否 | 不限 |
| zmb | Mesh Belt | Mesh Belt | belt | belt | 2×1 | 0–0 | 35–40 | 58 / 0 | 25 | 43 | 0 | 16 | 否 | 不限 |
| ztb | Battle Belt | Battle Belt | belt | belt | 2×1 | 0–0 | 37–42 | 88 / 0 | 25 | 49 | 0 | 18 | 否 | 不限 |
| zvb | Sharkskin Belt | Sharkskin Belt | belt | belt | 2×1 | 0–0 | 31–36 | 20 / 0 | 25 | 39 | 0 | 14 | 否 | 不限 |
| amu | 项链 | amulet | amul | neck | 1×1 | 0–0 | 0–0 | 0 / 0 | 0 | 1 | 1 | 0 | 否 | 不限 |
| aqv | 箭矢 | Arrows | bowq | offhand | 1×3 | 0–0 | 0–0 | 0 / 0 | 0 | 0 | 0 | 0 | 否 | 不限 |
| cqv | 弩矢 | Bolts | xboq | offhand | 1×3 | 0–0 | 0–0 | 0 / 0 | 0 | 0 | 0 | 0 | 否 | 不限 |
| rin | 戒指 | ring | ring | ring1 | 1×1 | 0–0 | 0–0 | 0 / 0 | 0 | 1 | 1 | 0 | 否 | 不限 |
| vip | viper amulet | viper amulet | amul | neck | 1×1 | 0–0 | 0–0 | 0 / 0 | 0 | 15 | 0 | 0 | 否 | 不限 |

### 其他底材与消耗品（122）

| 代码 | 名称 | 英文 | 类型 | 槽位 | 格数 | 伤害 | 防御 | 力量/敏捷 | 需求等级 | qlvl | 最大孔 | 耐久 | 双手 | 职业限制 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ass | Book of Skill | Book of Skill | ques | — | 2×2 | 0–0 | 0–0 | 0 / 0 | 0 | 0 | 0 | 0 | 否 | 不限 |
| bbb | lam esen's tome | lam esen's tome | ques | — | 2×2 | 0–0 | 0–0 | 0 / 0 | 0 | 0 | 0 | 0 | 否 | 不限 |
| bet | Burning Essence of Terror | Burning Essence of Terror | ques | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 0 | 0 | 0 | 0 | 否 | 不限 |
| bey | Baal's Eye | Baal's Eye | ques | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 0 | 0 | 0 | 0 | 否 | 不限 |
| bkd | deciphered Bark Scroll | deciphered Bark Scroll | ques | — | 2×2 | 0–0 | 0–0 | 0 / 0 | 0 | 0 | 0 | 0 | 否 | 不限 |
| bks | Bark Scroll | Bark Scroll | ques | — | 2×2 | 0–0 | 0–0 | 0 / 0 | 0 | 0 | 0 | 0 | 否 | 不限 |
| box | 赫拉迪克方块 | Horadric Cube | ques | — | 2×2 | 0–0 | 0–0 | 0 / 0 | 0 | 0 | 0 | 0 | 否 | 不限 |
| ceh | Charged Essense of Hatred | Charged Essense of Hatred | ques | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 0 | 0 | 0 | 0 | 否 | 不限 |
| cm1 | 小护身符 | Charm Small | scha | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 0 | 28 | 0 | 0 | 否 | 不限 |
| cm2 | 大护身符 | Charm Medium | mcha | — | 1×2 | 0–0 | 0–0 | 0 / 0 | 0 | 14 | 0 | 0 | 否 | 不限 |
| cm3 | 超大型护身符 | Charm Large | lcha | — | 1×3 | 0–0 | 0–0 | 0 / 0 | 0 | 1 | 0 | 0 | 否 | 不限 |
| dhn | Diablo's Horn | Diablo's Horn | ques | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 0 | 0 | 0 | 0 | 否 | 不限 |
| elx | elixir | elixir | elix | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 0 | 21 | 0 | 0 | 否 | 不限 |
| fed | Festering Essence of Destruction | Festering Essence of Destruction | ques | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 0 | 0 | 0 | 0 | 否 | 不限 |
| g34 | gold bird | gold bird | ques | — | 1×2 | 0–0 | 0–0 | 0 / 0 | 0 | 0 | 0 | 0 | 否 | 不限 |
| gcb | Chipped Saphire | Chipped Saphire | gems | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 1 | 0 | 0 | 0 | 否 | 不限 |
| gcg | Chipped Emerald | Chipped Emerald | geme | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 1 | 0 | 0 | 0 | 否 | 不限 |
| gcr | 碎裂的红宝石 | Chipped Ruby | gemr | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 1 | 0 | 0 | 0 | 否 | 不限 |
| gcv | 碎裂的紫宝石 | Chipped Amethyst | gema | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 1 | 0 | 0 | 0 | 否 | 不限 |
| gcw | Chipped Diamond | Chipped Diamond | gemd | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 1 | 0 | 0 | 0 | 否 | 不限 |
| gcy | Chipped Topaz | Chipped Topaz | gemt | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 1 | 0 | 0 | 0 | 否 | 不限 |
| gfb | Flawed Saphire | Flawed Saphire | gems | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 5 | 0 | 0 | 0 | 否 | 不限 |
| gfg | Flawed Emerald | Flawed Emerald | geme | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 5 | 0 | 0 | 0 | 否 | 不限 |
| gfr | 裂开的红宝石 | Flawed Ruby | gemr | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 5 | 0 | 0 | 0 | 否 | 不限 |
| gfv | 裂开的紫宝石 | Flawed Amethyst | gema | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 5 | 0 | 0 | 0 | 否 | 不限 |
| gfw | Flawed Diamond | Flawed Diamond | gemd | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 5 | 0 | 0 | 0 | 否 | 不限 |
| gfy | Flawed Topaz | Flawed Topaz | gemt | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 5 | 0 | 0 | 0 | 否 | 不限 |
| glb | Flawless Saphire | Flawless Saphire | gems | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 15 | 0 | 0 | 0 | 否 | 不限 |
| gld | 金币 | gold | gold | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 0 | 0 | 0 | 0 | 否 | 不限 |
| glg | Flawless Emerald | Flawless Emerald | geme | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 15 | 0 | 0 | 0 | 否 | 不限 |
| glr | 无瑕疵的红宝石 | Flawless Ruby | gemr | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 15 | 0 | 0 | 0 | 否 | 不限 |
| glw | Flawless Diamond | Flawless Diamond | gemd | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 15 | 0 | 0 | 0 | 否 | 不限 |
| gly | Flawless Topaz | Flawless Topaz | gemt | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 15 | 0 | 0 | 0 | 否 | 不限 |
| gpb | Perfect Saphire | Perfect Saphire | gems | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 18 | 0 | 0 | 0 | 否 | 不限 |
| gpg | Perfect Emerald | Perfect Emerald | geme | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 18 | 0 | 0 | 0 | 否 | 不限 |
| gpr | 完美的红宝石 | Perfect Ruby | gemr | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 18 | 0 | 0 | 0 | 否 | 不限 |
| gpv | 完美的紫宝石 | Perfect Amethyst | gema | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 18 | 0 | 0 | 0 | 否 | 不限 |
| gpw | Perfect Diamond | Perfect Diamond | gemd | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 18 | 0 | 0 | 0 | 否 | 不限 |
| gpy | Perfect Topaz | Perfect Topaz | gemt | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 18 | 0 | 0 | 0 | 否 | 不限 |
| gsb | Saphire | Saphire | gems | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 12 | 0 | 0 | 0 | 否 | 不限 |
| gsg | Emerald | Emerald | geme | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 12 | 0 | 0 | 0 | 否 | 不限 |
| gsr | 红宝石 | Ruby | gemr | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 12 | 0 | 0 | 0 | 否 | 不限 |
| gsv | 紫宝石 | Amethyst | gema | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 12 | 0 | 0 | 0 | 否 | 不限 |
| gsw | Diamond | Diamond | gemd | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 12 | 0 | 0 | 0 | 否 | 不限 |
| gsy | Topaz | Topaz | gemt | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 12 | 0 | 0 | 0 | 否 | 不限 |
| gzv | 无瑕疵的紫宝石 | Flawless Amethyst | gema | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 15 | 0 | 0 | 0 | 否 | 不限 |
| hp1 | 微型治疗药水 | Lesser Healing Potion | hpot | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 0 | 0 | 0 | 0 | 否 | 不限 |
| hp2 | 轻型治疗药水 | Light Healing Potion | hpot | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 0 | 0 | 0 | 0 | 否 | 不限 |
| hp3 | 治疗药水 | Healing Potion | hpot | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 0 | 0 | 0 | 0 | 否 | 不限 |
| hp4 | 强效治疗药水 | Strong Healing Potion | hpot | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 0 | 0 | 0 | 0 | 否 | 不限 |
| hp5 | 超级治疗药水 | Greater Healing Potion | hpot | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 0 | 0 | 0 | 0 | 否 | 不限 |
| ibk | 辨识之书 | Identify Book | book | — | 1×2 | 0–0 | 0–0 | 0 / 0 | 0 | 0 | 0 | 0 | 否 | 不限 |
| ice | Maguffin | Maguffin | ques | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 0 | 0 | 0 | 0 | 否 | 不限 |
| isc | 辨识卷轴 | Identify Scroll | scro | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 0 | 0 | 0 | 0 | 否 | 不限 |
| j34 | jade figurine | jade figurine | ques | — | 1×2 | 0–0 | 0–0 | 0 / 0 | 0 | 0 | 0 | 0 | 否 | 不限 |
| jew | 珠宝 | Jewel | jewl | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 0 | 1 | 0 | 0 | 否 | 不限 |
| key | 钥匙 | Skeleton Key | key | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 0 | 0 | 0 | 0 | 否 | 不限 |
| luv | Mephisto Key | Mephisto Key | key | — | 1×2 | 0–0 | 0–0 | 0 / 0 | 0 | 0 | 0 | 0 | 否 | 不限 |
| mbr | Mephisto's Brain | Mephisto's Brain | ques | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 0 | 0 | 0 | 0 | 否 | 不限 |
| mp1 | 微型法力药水 | Lesser Mana Potion | mpot | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 0 | 0 | 0 | 0 | 否 | 不限 |
| mp2 | 轻型法力药水 | Light Mana Potion | mpot | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 0 | 0 | 0 | 0 | 否 | 不限 |
| mp3 | 法力药水 | Mana Potion | mpot | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 0 | 0 | 0 | 0 | 否 | 不限 |
| mp4 | 强效法力药水 | Strong Mana Potion | mpot | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 0 | 0 | 0 | 0 | 否 | 不限 |
| mp5 | 超级法力药水 | Greater Mana Potion | mpot | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 0 | 0 | 0 | 0 | 否 | 不限 |
| mss | Mephisto SoulStone | Mephisto SoulStone | ques | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 0 | 0 | 0 | 0 | 否 | 不限 |
| pk1 | Pandemonium Key 1 | Pandemonium Key 1 | ques | — | 1×2 | 0–0 | 0–0 | 0 / 0 | 0 | 0 | 0 | 0 | 否 | 不限 |
| pk2 | Pandemonium Key 2 | Pandemonium Key 2 | ques | — | 1×2 | 0–0 | 0–0 | 0 / 0 | 0 | 0 | 0 | 0 | 否 | 不限 |
| pk3 | Pandemonium Key 3 | Pandemonium Key 3 | ques | — | 1×2 | 0–0 | 0–0 | 0 / 0 | 0 | 0 | 0 | 0 | 否 | 不限 |
| qbr | KhalimBrain | KhalimBrain | ques | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 0 | 0 | 0 | 0 | 否 | 不限 |
| qey | KhalimEye | KhalimEye | ques | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 0 | 0 | 0 | 0 | 否 | 不限 |
| qhr | KhalimHeart | KhalimHeart | ques | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 0 | 0 | 0 | 0 | 否 | 不限 |
| r01 | 艾尔符文 | El Rune | rune | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 11 | 11 | 0 | 0 | 否 | 不限 |
| r02 | 艾德符文 | Eld Rune | rune | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 11 | 11 | 0 | 0 | 否 | 不限 |
| r03 | 特尔符文 | Tir Rune | rune | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 13 | 13 | 0 | 0 | 否 | 不限 |
| r04 | 那夫符文 | Nef Rune | rune | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 13 | 13 | 0 | 0 | 否 | 不限 |
| r05 | 爱斯符文 | Eth Rune | rune | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 15 | 15 | 0 | 0 | 否 | 不限 |
| r06 | 伊司符文 | Ith Rune | rune | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 15 | 15 | 0 | 0 | 否 | 不限 |
| r07 | 塔尔符文 | Tal Rune | rune | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 17 | 17 | 0 | 0 | 否 | 不限 |
| r08 | 拉尔符文 | Ral Rune | rune | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 19 | 19 | 0 | 0 | 否 | 不限 |
| r09 | 欧特符文 | Ort Rune | rune | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 21 | 21 | 0 | 0 | 否 | 不限 |
| r10 | 书尔符文 | Thul Rune | rune | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 23 | 23 | 0 | 0 | 否 | 不限 |
| r11 | 安姆符文 | Amn Rune | rune | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 25 | 25 | 0 | 0 | 否 | 不限 |
| r12 | 索尔符文 | Sol Rune | rune | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 27 | 27 | 0 | 0 | 否 | 不限 |
| r13 | 夏符文 | Shael Rune | rune | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 29 | 29 | 0 | 0 | 否 | 不限 |
| r14 | 多尔符文 | Dol Rune | rune | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 31 | 31 | 0 | 0 | 否 | 不限 |
| r15 | 海尔符文 | Hel Rune | rune | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 0 | 33 | 0 | 0 | 否 | 不限 |
| r16 | 埃欧符文 | Io Rune | rune | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 35 | 35 | 0 | 0 | 否 | 不限 |
| r17 | 卢姆符文 | Lum Rune | rune | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 37 | 37 | 0 | 0 | 否 | 不限 |
| r18 | 科符文 | Ko Rune | rune | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 39 | 39 | 0 | 0 | 否 | 不限 |
| r19 | 法尔符文 | Fal Rune | rune | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 41 | 41 | 0 | 0 | 否 | 不限 |
| r20 | 蓝姆符文 | Lem Rune | rune | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 43 | 43 | 0 | 0 | 否 | 不限 |
| r21 | 普尔符文 | Pul Rune | rune | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 45 | 45 | 0 | 0 | 否 | 不限 |
| r22 | 乌姆符文 | Um Rune | rune | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 47 | 47 | 0 | 0 | 否 | 不限 |
| r23 | 马尔符文 | Mal Rune | rune | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 49 | 49 | 0 | 0 | 否 | 不限 |
| r24 | 伊司特符文 | Ist Rune | rune | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 51 | 51 | 0 | 0 | 否 | 不限 |
| r25 | 古尔符文 | Gul Rune | rune | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 53 | 53 | 0 | 0 | 否 | 不限 |
| r26 | 伐克斯符文 | Vex Rune | rune | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 55 | 55 | 0 | 0 | 否 | 不限 |
| r27 | 欧姆符文 | Ohm Rune | rune | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 57 | 57 | 0 | 0 | 否 | 不限 |
| r28 | 罗符文 | Lo Rune | rune | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 59 | 59 | 0 | 0 | 否 | 不限 |
| r29 | 瑟符文 | Sur Rune | rune | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 61 | 61 | 0 | 0 | 否 | 不限 |
| r30 | 贝符文 | Ber Rune | rune | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 63 | 63 | 0 | 0 | 否 | 不限 |
| r31 | 乔符文 | Jah Rune | rune | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 65 | 65 | 0 | 0 | 否 | 不限 |
| r32 | 查姆符文 | Cham Rune | rune | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 67 | 67 | 0 | 0 | 否 | 不限 |
| r33 | 萨德符文 | Zod Rune | rune | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 69 | 69 | 0 | 0 | 否 | 不限 |
| rvl | 全面回复活力药水 | Full Rejuv Potion | rpot | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 0 | 0 | 0 | 0 | 否 | 不限 |
| rvs | 回复活力药水 | Rejuv Potion | rpot | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 0 | 0 | 0 | 0 | 否 | 不限 |
| skc | 碎裂的骷髅 | Chipped Skull | gemz | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 1 | 0 | 0 | 0 | 否 | 不限 |
| skf | 裂开的骷髅 | Flawed Skull | gemz | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 5 | 0 | 0 | 0 | 否 | 不限 |
| skl | 无瑕疵的骷髅 | Flawless Skull | gemz | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 15 | 0 | 0 | 0 | 否 | 不限 |
| sku | 骷髅 | Skull | gemz | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 12 | 0 | 0 | 0 | 否 | 不限 |
| skz | 完美的骷髅 | Perfect Skull | gemz | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 18 | 0 | 0 | 0 | 否 | 不限 |
| std | Standard | Standard | ques | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 90 | 90 | 0 | 0 | 否 | 不限 |
| tbk | 城镇传送之书 | Town Portal Book | book | — | 1×2 | 0–0 | 0–0 | 0 / 0 | 0 | 0 | 0 | 0 | 否 | 不限 |
| tes | Twisted Essence of Suffering | Twisted Essence of Suffering | ques | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 0 | 0 | 0 | 0 | 否 | 不限 |
| toa | Token of Absolution | Token of Absolution | ques | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 0 | 0 | 0 | 0 | 否 | 不限 |
| tr1 | Scroll of Horadric Quest Info | Scroll of Horadric Quest Info | ques | — | 2×2 | 0–0 | 0–0 | 0 / 0 | 0 | 0 | 0 | 0 | 否 | 不限 |
| tr2 | Scroll of Malah - Boost Resistances | Scroll of Malah - Boost Resistances | ques | — | 2×2 | 0–0 | 0–0 | 0 / 0 | 0 | 0 | 0 | 0 | 否 | 不限 |
| tsc | 城镇传送卷轴 | Town Portal Scroll | scro | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 0 | 0 | 0 | 0 | 否 | 不限 |
| vps | 耐力药水 | Stamina Potion | spot | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 0 | 0 | 0 | 0 | 否 | 不限 |
| wms | 解冻药水 | Thawing Potion | wpot | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 0 | 0 | 0 | 0 | 否 | 不限 |
| xyz | scroll of self resurrect | scroll of self resurrect | ques | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 0 | 0 | 0 | 0 | 否 | 不限 |
| yps | 解毒药水 | Antidote Potion | apot | — | 1×1 | 0–0 | 0–0 | 0 / 0 | 0 | 0 | 0 | 0 | 否 | 不限 |

## 原始底材中的 24 个仅定义条目

与上述 635 个运行底材合计 659 个原始底材；历史/不可生成定义仍保留，不暗中丢弃。

| 身份 | 名称 | 代码 | 状态 | 完整原始字段 |
| --- | --- | --- | --- | --- |
| base:0sc | Scroll | 0sc | 运行时底材未纳入（历史或不可生成条目）；仅定义，未接入执行 | {"name":"Scroll","*name":"Scroll","version":100,"spawnable":1,"nodurability":1,"cost":100,"code":"0sc","alternategfx":"rsc","namestr":"0sc","component":16,"invwidth":1,"invheight":1,"flippyfile":"flprsc","invfile":"invrsc","TMogType":"xxx","useable":1,"type":"scro","dropsound":"item_scroll","dropsfxframe":10,"usesound":"item_scroll","transtbl":5,"spellicon":-1,"BetterGem":"non","CharsiMagicLvl":255,"GheedMagicLvl":255,"AkaraMagicLvl":255,"FaraMagicLvl":255,"LysanderMagicLvl":255,"DrognanMagicLvl":255,"HraltiMagicLvl":255,"AlkorMagicLvl":255,"OrmusMagicLvl":255,"ElzixMagicLvl":255,"AshearaMagicLvl":255,"CainMagicLvl":255,"HalbuMagicLvl":255,"MalahMagicLvl":255,"LarzukMagicLvl":255,"DrehyaMagicLvl":255,"JamellaMagicLvl":255,"NightmareUpgrade":"xxx","HellUpgrade":"xxx","expansion":1,"lineNumber":138} |
| base:bpl | Large Blue Potion | bpl | 运行时底材未纳入（历史或不可生成条目）；仅定义，未接入执行 | {"name":"Large Blue Potion","*name":"Large Blue Potion","compactsave":1,"version":100,"rarity":1,"nodurability":1,"cost":100,"code":"bpl","alternategfx":"bpl","namestr":"bpl","component":16,"invwidth":1,"invheight":1,"flippyfile":"flpbpl","invfile":"invbpl","TMogType":"xxx","useable":1,"type":"mpot","dropsound":"item_potion","dropsfxframe":14,"usesound":"item_potion_drink","transtbl":5,"stackable":1,"minstack":5,"maxstack":10,"spellicon":-1,"BetterGem":"non","CharsiMagicLvl":255,"GheedMagicLvl":255,"AkaraMagicLvl":255,"FaraMagicLvl":255,"LysanderMagicLvl":255,"DrognanMagicLvl":255,"HraltiMagicLvl":255,"AlkorMagicLvl":255,"OrmusMagicLvl":255,"ElzixMagicLvl":255,"AshearaMagicLvl":255,"CainMagicLvl":255,"HalbuMagicLvl":255,"MalahMagicLvl":255,"LarzukMagicLvl":255,"DrehyaMagicLvl":255,"JamellaMagicLvl":255,"NightmareUpgrade":"xxx","HellUpgrade":"xxx","expansion":1,"lineNumber":102} |
| base:bps | Small Blue Potion | bps | 运行时底材未纳入（历史或不可生成条目）；仅定义，未接入执行 | {"name":"Small Blue Potion","*name":"Small Blue Potion","compactsave":1,"version":100,"rarity":1,"nodurability":1,"cost":100,"code":"bps","alternategfx":"bps","namestr":"bps","component":16,"invwidth":1,"invheight":1,"flippyfile":"flpbps","invfile":"invbps","TMogType":"xxx","useable":1,"type":"mpot","dropsound":"item_potion","dropsfxframe":14,"usesound":"item_potion_drink","transtbl":5,"stackable":1,"minstack":5,"maxstack":10,"spellicon":-1,"BetterGem":"non","CharsiMagicLvl":255,"GheedMagicLvl":255,"AkaraMagicLvl":255,"FaraMagicLvl":255,"LysanderMagicLvl":255,"DrognanMagicLvl":255,"HraltiMagicLvl":255,"AlkorMagicLvl":255,"OrmusMagicLvl":255,"ElzixMagicLvl":255,"AshearaMagicLvl":255,"CainMagicLvl":255,"HalbuMagicLvl":255,"MalahMagicLvl":255,"LarzukMagicLvl":255,"DrehyaMagicLvl":255,"JamellaMagicLvl":255,"NightmareUpgrade":"xxx","HellUpgrade":"xxx","expansion":1,"lineNumber":101} |
| base:brz | Not used | brz | 运行时底材未纳入（历史或不可生成条目）；仅定义，未接入执行 | {"name":"Not used","*name":"Brain","rarity":1,"nodurability":1,"cost":60,"code":"brz","alternategfx":"brz","namestr":"brz","component":16,"invwidth":1,"invheight":1,"flippyfile":"flpbrnz","invfile":"invbrnz","Transmogrify":1,"TMogType":"opm","TMogMin":1,"TMogMax":1,"type":"body","dropsound":"item_monsterguts","dropsfxframe":14,"usesound":"item_monsterguts","transtbl":5,"spellicon":-1,"BetterGem":"non","CharsiMagicLvl":255,"GheedMagicLvl":255,"AkaraMagicLvl":255,"FaraMagicLvl":255,"LysanderMagicLvl":255,"DrognanMagicLvl":255,"HraltiMagicLvl":255,"AlkorMagicLvl":255,"OrmusMagicLvl":255,"ElzixMagicLvl":255,"AshearaMagicLvl":255,"CainMagicLvl":255,"HalbuMagicLvl":255,"MalahMagicLvl":255,"LarzukMagicLvl":255,"DrehyaMagicLvl":255,"JamellaMagicLvl":255,"NightmareUpgrade":"xxx","HellUpgrade":"xxx","lineNumber":24} |
| base:ear | Player Ear | ear | 运行时底材未纳入（历史或不可生成条目）；仅定义，未接入执行 | {"name":"Player Ear","*name":"Player Ear","compactsave":1,"rarity":1,"nodurability":1,"code":"ear","alternategfx":"ear","namestr":"ear","component":16,"invwidth":1,"invheight":1,"flippyfile":"flpear","invfile":"invear","TMogType":"xxx","type":"play","dropsound":"item_monsterguts","dropsfxframe":14,"usesound":"item_monsterguts","transtbl":5,"spellicon":-1,"BetterGem":"non","CharsiMagicLvl":255,"GheedMagicLvl":255,"AkaraMagicLvl":255,"FaraMagicLvl":255,"LysanderMagicLvl":255,"DrognanMagicLvl":255,"HraltiMagicLvl":255,"AlkorMagicLvl":255,"OrmusMagicLvl":255,"ElzixMagicLvl":255,"AshearaMagicLvl":255,"CainMagicLvl":255,"HalbuMagicLvl":255,"MalahMagicLvl":255,"LarzukMagicLvl":255,"DrehyaMagicLvl":255,"JamellaMagicLvl":255,"NightmareUpgrade":"xxx","HellUpgrade":"xxx","lineNumber":48} |
| base:eyz | Not used | eyz | 运行时底材未纳入（历史或不可生成条目）；仅定义，未接入执行 | {"name":"Not used","*name":"Eye","rarity":1,"nodurability":1,"cost":45,"code":"eyz","alternategfx":"eyz","namestr":"eyz","component":16,"invwidth":1,"invheight":1,"flippyfile":"flpeye","invfile":"inveye","Transmogrify":1,"TMogType":"mpo","type":"body","dropsound":"item_monsterguts","dropsfxframe":14,"usesound":"item_monsterguts","transtbl":5,"spellicon":-1,"BetterGem":"non","CharsiMagicLvl":255,"GheedMagicLvl":255,"AkaraMagicLvl":255,"FaraMagicLvl":255,"LysanderMagicLvl":255,"DrognanMagicLvl":255,"HraltiMagicLvl":255,"AlkorMagicLvl":255,"OrmusMagicLvl":255,"ElzixMagicLvl":255,"AshearaMagicLvl":255,"CainMagicLvl":255,"HalbuMagicLvl":255,"MalahMagicLvl":255,"LarzukMagicLvl":255,"DrehyaMagicLvl":255,"JamellaMagicLvl":255,"NightmareUpgrade":"xxx","HellUpgrade":"xxx","lineNumber":26} |
| base:flg | Not used | flg | 运行时底材未纳入（历史或不可生成条目）；仅定义，未接入执行 | {"name":"Not used","*name":"Flag","rarity":1,"nodurability":1,"cost":98,"code":"flg","alternategfx":"flg","namestr":"flg","component":16,"invwidth":1,"invheight":1,"flippyfile":"flpflag","invfile":"invflag","TMogType":"xxx","type":"body","dropsound":"item_lightarmor","dropsfxframe":12,"usesound":"item_lightarmor","transtbl":5,"spellicon":-1,"BetterGem":"non","CharsiMagicLvl":255,"GheedMagicLvl":255,"AkaraMagicLvl":255,"FaraMagicLvl":255,"LysanderMagicLvl":255,"DrognanMagicLvl":255,"HraltiMagicLvl":255,"AlkorMagicLvl":255,"OrmusMagicLvl":255,"ElzixMagicLvl":255,"AshearaMagicLvl":255,"CainMagicLvl":255,"HalbuMagicLvl":255,"MalahMagicLvl":255,"LarzukMagicLvl":255,"DrehyaMagicLvl":255,"JamellaMagicLvl":255,"NightmareUpgrade":"xxx","HellUpgrade":"xxx","lineNumber":29} |
| base:fng | Not used | fng | 运行时底材未纳入（历史或不可生成条目）；仅定义，未接入执行 | {"name":"Not used","*name":"Fang","rarity":1,"nodurability":1,"cost":80,"code":"fng","alternategfx":"fng","namestr":"fng","component":16,"invwidth":1,"invheight":1,"flippyfile":"flpfang","invfile":"invfang","Transmogrify":1,"TMogType":"key","TMogMin":1,"TMogMax":1,"type":"body","dropsound":"item_monsterbone","dropsfxframe":12,"usesound":"item_monsterbone","transtbl":5,"spellicon":-1,"BetterGem":"non","CharsiMagicLvl":255,"GheedMagicLvl":255,"AkaraMagicLvl":255,"FaraMagicLvl":255,"LysanderMagicLvl":255,"DrognanMagicLvl":255,"HraltiMagicLvl":255,"AlkorMagicLvl":255,"OrmusMagicLvl":255,"ElzixMagicLvl":255,"AshearaMagicLvl":255,"CainMagicLvl":255,"HalbuMagicLvl":255,"MalahMagicLvl":255,"LarzukMagicLvl":255,"DrehyaMagicLvl":255,"JamellaMagicLvl":255,"NightmareUpgrade":"xxx","HellUpgrade":"xxx","lineNumber":30} |
| base:hpf | Full Healing Potion | hpf | 运行时底材未纳入（历史或不可生成条目）；仅定义，未接入执行 | {"name":"Full Healing Potion","*name":"Full Healing Potion","compactsave":1,"rarity":2,"nodurability":1,"cost":150,"code":"hpf","alternategfx":"hpo","namestr":"hpf","component":16,"invwidth":1,"invheight":1,"flippyfile":"flprpl","invfile":"invrpl","TMogType":"xxx","useable":1,"type":"hpot","dropsound":"item_potion","dropsfxframe":14,"usesound":"item_potion_drink","transtbl":5,"belt":1,"autobelt":1,"spellicon":-1,"BetterGem":"non","CharsiMagicLvl":255,"GheedMagicLvl":255,"AkaraMagicLvl":255,"FaraMagicLvl":255,"LysanderMagicLvl":255,"DrognanMagicLvl":255,"HraltiMagicLvl":255,"AlkorMagicLvl":255,"OrmusMagicLvl":255,"ElzixMagicLvl":255,"AshearaMagicLvl":255,"CainMagicLvl":255,"HalbuMagicLvl":255,"MalahMagicLvl":255,"LarzukMagicLvl":255,"DrehyaMagicLvl":255,"JamellaMagicLvl":255,"NightmareUpgrade":"xxx","HellUpgrade":"xxx","PermStoreItem":1,"multibuy":1,"lineNumber":3} |
| base:hpo | Healing Potion | hpo | 运行时底材未纳入（历史或不可生成条目）；仅定义，未接入执行 | {"name":"Healing Potion","*name":"Healing Potion","compactsave":1,"rarity":1,"nodurability":1,"cost":30,"code":"hpo","alternategfx":"hpo","namestr":"hpo","component":16,"invwidth":1,"invheight":1,"flippyfile":"flprps","invfile":"invrps","TMogType":"xxx","useable":1,"type":"hpot","dropsound":"item_potion","dropsfxframe":14,"usesound":"item_potion_drink","transtbl":5,"belt":1,"autobelt":1,"spellicon":-1,"BetterGem":"non","CharsiMagicLvl":255,"GheedMagicLvl":255,"AkaraMagicLvl":255,"FaraMagicLvl":255,"LysanderMagicLvl":255,"DrognanMagicLvl":255,"HraltiMagicLvl":255,"AlkorMagicLvl":255,"OrmusMagicLvl":255,"ElzixMagicLvl":255,"AshearaMagicLvl":255,"CainMagicLvl":255,"HalbuMagicLvl":255,"MalahMagicLvl":255,"LarzukMagicLvl":255,"DrehyaMagicLvl":255,"JamellaMagicLvl":255,"NightmareUpgrade":"xxx","HellUpgrade":"xxx","PermStoreItem":1,"multibuy":1,"lineNumber":1} |
| base:hrb | herb | hrb | 运行时底材未纳入（历史或不可生成条目）；仅定义，未接入执行 | {"name":"herb","*name":"herb","version":100,"level":3,"rarity":3,"nodurability":1,"cost":75,"code":"hrb","alternategfx":"hrb","namestr":"hrb","component":16,"invwidth":1,"invheight":1,"flippyfile":"flphrb","invfile":"invhrb","TMogType":"xxx","useable":1,"type":"herb","dropsound":"item_herb","dropsfxframe":12,"usesound":"item_herb","transtbl":5,"belt":1,"spellicon":-1,"pSpell":9,"state":"innersight","len":1000,"stat1":"velocitypercent","calc1":25,"BetterGem":"non","CharsiMagicLvl":255,"GheedMagicLvl":255,"AkaraMagicLvl":255,"FaraMagicLvl":255,"LysanderMagicLvl":255,"DrognanMagicLvl":255,"HraltiMagicLvl":255,"AlkorMagicLvl":255,"OrmusMagicLvl":255,"ElzixMagicLvl":255,"AshearaMagicLvl":255,"CainMagicLvl":255,"HalbuMagicLvl":255,"MalahMagicLvl":255,"LarzukMagicLvl":255,"DrehyaMagicLvl":255,"JamellaMagicLvl":255,"NightmareUpgrade":"xxx","HellUpgrade":"xxx","expansion":1,"lineNumber":95} |
| base:hrn | Not used | hrn | 运行时底材未纳入（历史或不可生成条目）；仅定义，未接入执行 | {"name":"Not used","*name":"Horn","rarity":1,"nodurability":1,"cost":48,"code":"hrn","alternategfx":"hrn","namestr":"hrn","component":16,"invwidth":1,"invheight":1,"flippyfile":"flphorn","invfile":"invhorn","Transmogrify":1,"TMogType":"aqv","TMogMin":10,"TMogMax":40,"type":"body","dropsound":"item_monsterbone","dropsfxframe":12,"usesound":"item_monsterbone","transtbl":5,"spellicon":-1,"BetterGem":"non","CharsiMagicLvl":255,"GheedMagicLvl":255,"AkaraMagicLvl":255,"FaraMagicLvl":255,"LysanderMagicLvl":255,"DrognanMagicLvl":255,"HraltiMagicLvl":255,"AlkorMagicLvl":255,"OrmusMagicLvl":255,"ElzixMagicLvl":255,"AshearaMagicLvl":255,"CainMagicLvl":255,"HalbuMagicLvl":255,"MalahMagicLvl":255,"LarzukMagicLvl":255,"DrehyaMagicLvl":255,"JamellaMagicLvl":255,"NightmareUpgrade":"xxx","HellUpgrade":"xxx","lineNumber":27} |
| base:hrt | Not used | hrt | 运行时底材未纳入（历史或不可生成条目）；仅定义，未接入执行 | {"name":"Not used","*name":"Heart","rarity":1,"nodurability":1,"cost":60,"code":"hrt","alternategfx":"hrt","namestr":"hrt","component":16,"invwidth":1,"invheight":1,"flippyfile":"flphrt","invfile":"invhrt","Transmogrify":1,"TMogType":"hpo","type":"body","dropsound":"item_monsterguts","dropsfxframe":14,"usesound":"item_monsterguts","transtbl":5,"spellicon":-1,"BetterGem":"non","CharsiMagicLvl":255,"GheedMagicLvl":255,"AkaraMagicLvl":255,"FaraMagicLvl":255,"LysanderMagicLvl":255,"DrognanMagicLvl":255,"HraltiMagicLvl":255,"AlkorMagicLvl":255,"OrmusMagicLvl":255,"ElzixMagicLvl":255,"AshearaMagicLvl":255,"CainMagicLvl":255,"HalbuMagicLvl":255,"MalahMagicLvl":255,"LarzukMagicLvl":255,"DrehyaMagicLvl":255,"JamellaMagicLvl":255,"NightmareUpgrade":"xxx","HellUpgrade":"xxx","lineNumber":23} |
| base:jaw | Not used | jaw | 运行时底材未纳入（历史或不可生成条目）；仅定义，未接入执行 | {"name":"Not used","*name":"Jawbone","rarity":1,"nodurability":1,"cost":75,"code":"jaw","alternategfx":"jaw","namestr":"jaw","component":16,"invwidth":1,"invheight":1,"flippyfile":"flpjaw","invfile":"invjaw","Transmogrify":1,"TMogType":"cqv","TMogMin":10,"TMogMax":40,"type":"body","dropsound":"item_monsterbone","dropsfxframe":12,"usesound":"item_monsterbone","transtbl":5,"spellicon":-1,"BetterGem":"non","CharsiMagicLvl":255,"GheedMagicLvl":255,"AkaraMagicLvl":255,"FaraMagicLvl":255,"LysanderMagicLvl":255,"DrognanMagicLvl":255,"HraltiMagicLvl":255,"AlkorMagicLvl":255,"OrmusMagicLvl":255,"ElzixMagicLvl":255,"AshearaMagicLvl":255,"CainMagicLvl":255,"HalbuMagicLvl":255,"MalahMagicLvl":255,"LarzukMagicLvl":255,"DrehyaMagicLvl":255,"JamellaMagicLvl":255,"NightmareUpgrade":"xxx","HellUpgrade":"xxx","lineNumber":25} |
| base:mpf | Full Mana Potion | mpf | 运行时底材未纳入（历史或不可生成条目）；仅定义，未接入执行 | {"name":"Full Mana Potion","*name":"Full Mana Potion","compactsave":1,"rarity":2,"nodurability":1,"cost":150,"code":"mpf","alternategfx":"mpo","namestr":"mpf","component":16,"invwidth":1,"invheight":1,"flippyfile":"flpbpl","invfile":"invbpl","TMogType":"xxx","useable":1,"type":"mpot","dropsound":"item_potion","dropsfxframe":14,"usesound":"item_potion_drink","transtbl":5,"belt":1,"spellicon":-1,"BetterGem":"non","CharsiMagicLvl":255,"GheedMagicLvl":255,"AkaraMagicLvl":255,"FaraMagicLvl":255,"LysanderMagicLvl":255,"DrognanMagicLvl":255,"HraltiMagicLvl":255,"AlkorMagicLvl":255,"OrmusMagicLvl":255,"ElzixMagicLvl":255,"AshearaMagicLvl":255,"CainMagicLvl":255,"HalbuMagicLvl":255,"MalahMagicLvl":255,"LarzukMagicLvl":255,"DrehyaMagicLvl":255,"JamellaMagicLvl":255,"NightmareUpgrade":"xxx","HellUpgrade":"xxx","PermStoreItem":1,"multibuy":1,"lineNumber":4} |
| base:mpo | Mana Potion | mpo | 运行时底材未纳入（历史或不可生成条目）；仅定义，未接入执行 | {"name":"Mana Potion","*name":"Mana Potion","compactsave":1,"rarity":1,"nodurability":1,"cost":30,"code":"mpo","alternategfx":"mpo","namestr":"mpo","component":16,"invwidth":1,"invheight":1,"flippyfile":"flpbps","invfile":"invbps","TMogType":"xxx","useable":1,"type":"mpot","dropsound":"item_potion","dropsfxframe":14,"usesound":"item_potion_drink","transtbl":5,"belt":1,"spellicon":-1,"BetterGem":"non","CharsiMagicLvl":255,"GheedMagicLvl":255,"AkaraMagicLvl":255,"FaraMagicLvl":255,"LysanderMagicLvl":255,"DrognanMagicLvl":255,"HraltiMagicLvl":255,"AlkorMagicLvl":255,"OrmusMagicLvl":255,"ElzixMagicLvl":255,"AshearaMagicLvl":255,"CainMagicLvl":255,"HalbuMagicLvl":255,"MalahMagicLvl":255,"LarzukMagicLvl":255,"DrehyaMagicLvl":255,"JamellaMagicLvl":255,"NightmareUpgrade":"xxx","HellUpgrade":"xxx","PermStoreItem":1,"multibuy":1,"lineNumber":2} |
| base:qll | Not used | qll | 运行时底材未纳入（历史或不可生成条目）；仅定义，未接入执行 | {"name":"Not used","*name":"Quill","rarity":1,"nodurability":1,"cost":32,"code":"qll","alternategfx":"qll","namestr":"qll","component":16,"invwidth":1,"invheight":1,"flippyfile":"flpquil","invfile":"invquil","Transmogrify":1,"TMogType":"aqv","TMogMin":10,"TMogMax":40,"type":"body","dropsound":"item_monsterbone","dropsfxframe":12,"usesound":"item_monsterbone","transtbl":5,"spellicon":-1,"BetterGem":"non","CharsiMagicLvl":255,"GheedMagicLvl":255,"AkaraMagicLvl":255,"FaraMagicLvl":255,"LysanderMagicLvl":255,"DrognanMagicLvl":255,"HraltiMagicLvl":255,"AlkorMagicLvl":255,"OrmusMagicLvl":255,"ElzixMagicLvl":255,"AshearaMagicLvl":255,"CainMagicLvl":255,"HalbuMagicLvl":255,"MalahMagicLvl":255,"LarzukMagicLvl":255,"DrehyaMagicLvl":255,"JamellaMagicLvl":255,"NightmareUpgrade":"xxx","HellUpgrade":"xxx","lineNumber":31} |
| base:rpl | Large Red Potion | rpl | 运行时底材未纳入（历史或不可生成条目）；仅定义，未接入执行 | {"name":"Large Red Potion","*name":"Large Red Potion","compactsave":1,"version":100,"rarity":1,"nodurability":1,"cost":100,"code":"rpl","alternategfx":"rpl","namestr":"rpl","component":16,"invwidth":1,"invheight":1,"flippyfile":"flprpl","invfile":"invrpl","TMogType":"xxx","useable":1,"type":"hpot","dropsound":"item_potion","dropsfxframe":14,"usesound":"item_potion_drink","transtbl":5,"stackable":1,"minstack":5,"maxstack":10,"spellicon":-1,"BetterGem":"non","CharsiMagicLvl":255,"GheedMagicLvl":255,"AkaraMagicLvl":255,"FaraMagicLvl":255,"LysanderMagicLvl":255,"DrognanMagicLvl":255,"HraltiMagicLvl":255,"AlkorMagicLvl":255,"OrmusMagicLvl":255,"ElzixMagicLvl":255,"AshearaMagicLvl":255,"CainMagicLvl":255,"HalbuMagicLvl":255,"MalahMagicLvl":255,"LarzukMagicLvl":255,"DrehyaMagicLvl":255,"JamellaMagicLvl":255,"NightmareUpgrade":"xxx","HellUpgrade":"xxx","expansion":1,"lineNumber":100} |
| base:rps | Small Red Potion | rps | 运行时底材未纳入（历史或不可生成条目）；仅定义，未接入执行 | {"name":"Small Red Potion","*name":"Small Red Potion","compactsave":1,"version":100,"rarity":1,"nodurability":1,"cost":100,"code":"rps","alternategfx":"rps","namestr":"rps","component":16,"invwidth":1,"invheight":1,"flippyfile":"flprps","invfile":"invrps","TMogType":"xxx","useable":1,"type":"hpot","dropsound":"item_potion","dropsfxframe":14,"usesound":"item_potion_drink","transtbl":5,"stackable":1,"minstack":5,"maxstack":10,"spellicon":-1,"BetterGem":"non","CharsiMagicLvl":255,"GheedMagicLvl":255,"AkaraMagicLvl":255,"FaraMagicLvl":255,"LysanderMagicLvl":255,"DrognanMagicLvl":255,"HraltiMagicLvl":255,"AlkorMagicLvl":255,"OrmusMagicLvl":255,"ElzixMagicLvl":255,"AshearaMagicLvl":255,"CainMagicLvl":255,"HalbuMagicLvl":255,"MalahMagicLvl":255,"LarzukMagicLvl":255,"DrehyaMagicLvl":255,"JamellaMagicLvl":255,"NightmareUpgrade":"xxx","HellUpgrade":"xxx","expansion":1,"lineNumber":99} |
| base:scz | Not used | scz | 运行时底材未纳入（历史或不可生成条目）；仅定义，未接入执行 | {"name":"Not used","*name":"Scalp","rarity":1,"nodurability":1,"cost":40,"code":"scz","alternategfx":"scz","namestr":"scz","component":16,"invwidth":1,"invheight":1,"flippyfile":"flpscp","invfile":"invscp","Transmogrify":1,"TMogType":"hpf","type":"body","dropsound":"item_monsterguts","dropsfxframe":14,"usesound":"item_monsterguts","transtbl":5,"spellicon":-1,"BetterGem":"non","CharsiMagicLvl":255,"GheedMagicLvl":255,"AkaraMagicLvl":255,"FaraMagicLvl":255,"LysanderMagicLvl":255,"DrognanMagicLvl":255,"HraltiMagicLvl":255,"AlkorMagicLvl":255,"OrmusMagicLvl":255,"ElzixMagicLvl":255,"AshearaMagicLvl":255,"CainMagicLvl":255,"HalbuMagicLvl":255,"MalahMagicLvl":255,"LarzukMagicLvl":255,"DrehyaMagicLvl":255,"JamellaMagicLvl":255,"NightmareUpgrade":"xxx","HellUpgrade":"xxx","lineNumber":33} |
| base:sol | Not used | sol | 运行时底材未纳入（历史或不可生成条目）；仅定义，未接入执行 | {"name":"Not used","*name":"Soul","rarity":1,"nodurability":1,"cost":100,"code":"sol","alternategfx":"sol","namestr":"sol","component":16,"invwidth":1,"invheight":1,"flippyfile":"flpsple","invfile":"invsple","Transmogrify":1,"TMogType":"mpo","type":"body","dropsound":"item_rare","dropsfxframe":12,"transtbl":5,"spellicon":-1,"BetterGem":"non","CharsiMagicLvl":255,"GheedMagicLvl":255,"AkaraMagicLvl":255,"FaraMagicLvl":255,"LysanderMagicLvl":255,"DrognanMagicLvl":255,"HraltiMagicLvl":255,"AlkorMagicLvl":255,"OrmusMagicLvl":255,"ElzixMagicLvl":255,"AshearaMagicLvl":255,"CainMagicLvl":255,"HalbuMagicLvl":255,"MalahMagicLvl":255,"LarzukMagicLvl":255,"DrehyaMagicLvl":255,"JamellaMagicLvl":255,"NightmareUpgrade":"xxx","HellUpgrade":"xxx","lineNumber":32} |
| base:spe | Not used | spe | 运行时底材未纳入（历史或不可生成条目）；仅定义，未接入执行 | {"name":"Not used","*name":"Spleen","rarity":1,"nodurability":1,"cost":85,"code":"spe","alternategfx":"spe","namestr":"spe","component":16,"invwidth":1,"invheight":1,"flippyfile":"flpsple","invfile":"invsple","Transmogrify":1,"TMogType":"gps","TMogMin":1,"TMogMax":1,"type":"body","dropsound":"item_monsterguts","dropsfxframe":14,"usesound":"item_monsterguts","transtbl":5,"spellicon":-1,"BetterGem":"non","CharsiMagicLvl":255,"GheedMagicLvl":255,"AkaraMagicLvl":255,"FaraMagicLvl":255,"LysanderMagicLvl":255,"DrognanMagicLvl":255,"HraltiMagicLvl":255,"AlkorMagicLvl":255,"OrmusMagicLvl":255,"ElzixMagicLvl":255,"AshearaMagicLvl":255,"CainMagicLvl":255,"HalbuMagicLvl":255,"MalahMagicLvl":255,"LarzukMagicLvl":255,"DrehyaMagicLvl":255,"JamellaMagicLvl":255,"NightmareUpgrade":"xxx","HellUpgrade":"xxx","lineNumber":34} |
| base:tal | Not used | tal | 运行时底材未纳入（历史或不可生成条目）；仅定义，未接入执行 | {"name":"Not used","*name":"Tail","rarity":1,"nodurability":1,"cost":63,"code":"tal","alternategfx":"tal","namestr":"tal","component":16,"invwidth":1,"invheight":1,"flippyfile":"flptail","invfile":"invtail","Transmogrify":1,"TMogType":"vps","type":"body","dropsound":"item_monsterguts","dropsfxframe":14,"usesound":"item_monsterguts","transtbl":5,"spellicon":-1,"BetterGem":"non","CharsiMagicLvl":255,"GheedMagicLvl":255,"AkaraMagicLvl":255,"FaraMagicLvl":255,"LysanderMagicLvl":255,"DrognanMagicLvl":255,"HraltiMagicLvl":255,"AlkorMagicLvl":255,"OrmusMagicLvl":255,"ElzixMagicLvl":255,"AshearaMagicLvl":255,"CainMagicLvl":255,"HalbuMagicLvl":255,"MalahMagicLvl":255,"LarzukMagicLvl":255,"DrehyaMagicLvl":255,"JamellaMagicLvl":255,"NightmareUpgrade":"xxx","HellUpgrade":"xxx","lineNumber":28} |
| base:tch | Torch | tch | 运行时底材未纳入（历史或不可生成条目）；仅定义，未接入执行 | {"name":"Torch","*name":"Torch","compactsave":1,"nodurability":1,"cost":50,"code":"tch","alternategfx":"bsh","namestr":"tch","component":7,"invwidth":1,"invheight":2,"flippyfile":"flptrch","invfile":"invtrch","TMogType":"xxx","type":"torc","dropsound":"item_staff","dropsfxframe":12,"usesound":"item_staff","transparent":1,"transtbl":3,"lightradius":6,"minstack":2,"maxstack":10,"spellicon":-1,"BetterGem":"non","CharsiMagicLvl":255,"GheedMagicLvl":255,"AkaraMagicLvl":255,"FaraMagicLvl":255,"LysanderMagicLvl":255,"DrognanMagicLvl":255,"HraltiMagicLvl":255,"AlkorMagicLvl":255,"OrmusMagicLvl":255,"ElzixMagicLvl":255,"AshearaMagicLvl":255,"CainMagicLvl":255,"HalbuMagicLvl":255,"MalahMagicLvl":255,"LarzukMagicLvl":255,"DrehyaMagicLvl":255,"JamellaMagicLvl":255,"NightmareUpgrade":"xxx","HellUpgrade":"xxx","lineNumber":19} |

## 暗金定义索引（388 条）

| 稳定身份 | 名称/index | 底材 | enabled | ladder | version | 生成等级 | 需求等级 | rarity | 状态 | 属性字段 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| unique:0 | The Gnasher | hax | 1 | 0 | 0 | 7 | 5 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"str","min1":8,"max1":8,"prop2":"openwounds","min2":50,"max2":50,"prop3":"crush","min3":20,"max3":20,"prop4":"dmg%","min4":60,"max4":70} |
| unique:1 | Deathspade | axe | 1 | 0 | 0 | 12 | 9 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"stupidity","min1":1,"max1":1,"prop2":"dmg-min","min2":8,"max2":8,"prop3":"att%","min3":15,"max3":15,"prop4":"mana-kill","min4":4,"max4":4,"prop5":"dmg%","min5":60,"max5":70} |
| unique:2 | Bladebone | 2ax | 1 | 0 | 0 | 20 | 15 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg-undead","min1":100,"max1":100,"prop2":"att-undead","min2":40,"max2":40,"prop3":"swing2","min3":20,"max3":20,"prop4":"ac","min4":20,"max4":20,"prop5":"fire-min","min5":8,"max5":8,"prop6":"fire-max","min6":12,"max6":12,"prop7":"dmg%","min7":30,"max7":50} |
| unique:3 | Mindrend | mpi | 1 | 0 | 0 | 28 | 21 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"stupidity","min1":2,"max1":2,"prop2":"regen-mana","min2":20,"max2":20,"prop3":"ltng-min","min3":1,"max3":1,"prop4":"ltng-max","min4":12,"max4":15,"prop5":"att","min5":50,"max5":100,"prop6":"dmg%","min6":60,"max6":100,"prop7":"openwounds","min7":15,"max7":15} |
| unique:4 | Rakescar | wax | 1 | 0 | 0 | 36 | 27 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"pois-min","min1":128,"max1":128,"prop2":"pois-max","min2":128,"max2":128,"prop3":"pois-len","min3":75,"max3":75,"prop4":"att","min4":50,"max4":50,"prop5":"res-pois","min5":50,"max5":50,"prop6":"dmg%","min6":75,"max6":150,"prop7":"swing2","min7":30,"max7":30} |
| unique:5 | Fechmars Axe | lax | 1 | 0 | 0 | 11 | 8 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg%","min1":70,"max1":90,"prop2":"freeze","min2":3,"max2":3,"prop3":"res-cold","min3":50,"max3":50,"prop4":"light","min4":2,"max4":2} |
| unique:6 | Goreshovel | bax | 1 | 0 | 0 | 19 | 14 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"swing3","min1":30,"max1":30,"prop2":"str","min2":25,"max2":25,"prop3":"openwounds","min3":60,"max3":60,"prop4":"dmg%","min4":40,"max4":50,"prop5":"dmg-max","min5":9,"max5":9} |
| unique:7 | The Chieftan | btx | 1 | 0 | 0 | 26 | 19 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg%","min1":100,"max1":100,"prop2":"res-all","min2":10,"max2":20,"prop3":"mana-kill","min3":6,"max3":6,"prop4":"swing2","min4":20,"max4":20,"prop5":"dmg-ltng","min5":1,"max5":40} |
| unique:8 | Brainhew | gax | 1 | 0 | 0 | 34 | 25 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg-min","min1":14,"max1":14,"prop2":"mana","min2":25,"max2":25,"prop3":"light","min3":4,"max3":4,"prop4":"manasteal","min4":10,"max4":13,"prop5":"dmg%","min5":50,"max5":80,"prop6":"dmg-fire","min6":15,"max6":35} |
| unique:9 | The Humongous | gix | 1 | 0 | 0 | 39 | 29 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"str","min1":20,"max1":30,"prop2":"dmg-min","min2":8,"max2":8,"prop3":"dmg-max","min3":15,"max3":25,"prop4":"crush","min4":33,"max4":33,"prop5":"ease","min5":20,"max5":20,"prop6":"dmg%","min6":80,"max6":120} |
| unique:10 | Iros Torch | wnd | 1 | 0 | 0 | 7 | 5 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"nec","min1":1,"max1":1,"prop2":"lifesteal","min2":6,"max2":6,"prop3":"dmg-fire","min3":5,"max3":9,"prop4":"light","min4":3,"max4":3,"prop5":"enr","min5":10,"max5":10,"prop6":"regen-mana","min6":5,"max6":5} |
| unique:11 | Maelstromwrath | ywn | 1 | 0 | 0 | 19 | 14 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ltng-min","min1":1,"max1":1,"prop2":"ltng-max","min2":9,"max2":9,"prop3":"res-ltng","min3":40,"max3":40,"prop4":"mana","min4":13,"max4":13,"prop5":"cast2","min5":30,"max5":30,"prop6":"skill","par6":74,"min6":1,"max6":3,"prop7":"skill","par7":77,"min7":1,"max7":3,"prop8":"skill","par8":66,"min8":1,"max8":3,"prop9":"skill","par9":76,"min9":1,"max9":3} |
| unique:12 | Gravenspine | bwn | 1 | 0 | 0 | 27 | 20 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"str","min1":10,"max1":10,"prop2":"dex","min2":10,"max2":10,"prop3":"cold-min","min3":4,"max3":4,"prop4":"cold-max","min4":8,"max4":8,"prop5":"cold-len","min5":75,"max5":75,"prop6":"manasteal","min6":5,"max6":5,"prop7":"nec","min7":2,"max7":2,"prop8":"mana","min8":25,"max8":50} |
| unique:13 | Umes Lament | gwn | 1 | 0 | 0 | 38 | 28 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"nec","min1":2,"max1":2,"prop2":"mana","min2":40,"max2":40,"prop3":"cast2","min3":20,"max3":20,"prop4":"howl","min4":64,"max4":64,"prop5":"skill","par5":77,"min5":3,"max5":3,"prop6":"skill","par6":87,"min6":2,"max6":2} |
| unique:14 | Felloak | clb | 1 | 0 | 0 | 4 | 3 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"res-ltng","min1":60,"max1":60,"prop2":"res-fire","min2":20,"max2":20,"prop3":"knock","min3":1,"max3":1,"prop4":"fire-min","min4":6,"max4":6,"prop5":"fire-max","min5":8,"max5":8,"prop6":"dmg%","min6":70,"max6":80} |
| unique:15 | Knell Striker | scp | 1 | 0 | 0 | 7 | 5 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"crush","min1":25,"max1":25,"prop2":"res-fire","min2":20,"max2":20,"prop3":"res-pois","min3":20,"max3":20,"prop4":"mana","min4":15,"max4":15,"prop5":"att","min5":35,"max5":35,"prop6":"dmg%","min6":70,"max6":80} |
| unique:16 | Rusthandle | gsc | 1 | 0 | 0 | 23 | 17 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"pal","min1":1,"max1":1,"prop2":"dmg-norm","min2":3,"max2":7,"prop3":"red-mag","min3":1,"max3":1,"prop4":"lifesteal","min4":8,"max4":8,"prop5":"dmg%","min5":50,"max5":60,"prop6":"dmg-undead","min6":50,"max6":60,"prop7":"skill","par7":111,"min7":1,"max7":3,"prop8":"skill","par8":103,"min8":3,"max8":3} |
| unique:17 | Stormeye | wsp | 1 | 0 | 0 | 31 | 23 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg-ltng","min1":1,"max1":6,"prop2":"dmg-cold","par2":75,"min2":3,"max2":5,"prop3":"regen","min3":10,"max3":10,"prop4":"dmg%","min4":80,"max4":120,"prop5":"skill","par5":110,"min5":3,"max5":5,"prop6":"skill","par6":118,"min6":3,"max6":3,"prop7":"skill","par7":121,"min7":1,"max7":1} |
| unique:18 | Stoutnail | spc | 1 | 0 | 0 | 7 | 5 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"thorns","min1":3,"max1":10,"prop2":"dmg%","min2":100,"max2":100,"prop3":"vit","min3":7,"max3":7,"prop4":"red-mag","min4":2,"max4":2} |
| unique:19 | Crushflange | mac | 1 | 0 | 0 | 12 | 9 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"str","min1":15,"max1":15,"prop2":"knock","min2":1,"max2":1,"prop3":"light","min3":2,"max3":2,"prop4":"res-fire","min4":50,"max4":50,"prop5":"dmg%","min5":50,"max5":60,"prop6":"crush","min6":33,"max6":33} |
| unique:20 | Bloodrise | mst | 1 | 0 | 0 | 20 | 15 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg%","min1":120,"max1":120,"prop2":"att%","min2":50,"max2":50,"prop3":"openwounds","min3":25,"max3":25,"prop4":"light","min4":2,"max4":2,"prop5":"swing1","min5":10,"max5":10,"prop6":"skill","par6":96,"min6":3,"max6":3,"prop7":"lifesteal","min7":5,"max7":5} |
| unique:21 | The Generals Tan Do Li Ga | fla | 1 | 0 | 0 | 28 | 21 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg-min","min1":1,"max1":1,"prop2":"dmg-max","min2":20,"max2":20,"prop3":"slow","min3":50,"max3":50,"prop4":"ac","min4":25,"max4":25,"prop5":"manasteal","min5":5,"max5":5,"prop6":"dmg%","min6":50,"max6":60,"prop7":"swing2","min7":20,"max7":20} |
| unique:22 | Ironstone | whm | 1 | 0 | 0 | 36 | 27 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"att","min1":100,"max1":150,"prop2":"dmg%","min2":100,"max2":150,"prop3":"ltng-min","min3":1,"max3":1,"prop4":"ltng-max","min4":10,"max4":10,"prop5":"str","min5":10,"max5":10,"prop6":"*enr","min6":-5,"max6":-5} |
| unique:23 | Bonesob | mau | 1 | 0 | 0 | 32 | 24 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg%","min1":200,"max1":300,"prop2":"crush","min2":40,"max2":40,"prop3":"res-fire","min3":30,"max3":30,"prop4":"res-cold","min4":30,"max4":30,"prop5":"dmg-undead","min5":50,"max5":50} |
| unique:24 | Steeldriver | gma | 1 | 0 | 0 | 39 | 29 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ease","min1":-50,"max1":-50,"prop2":"swing3","min2":40,"max2":40,"prop3":"regen-stam","min3":25,"max3":25,"prop4":"dmg%","min4":150,"max4":250} |
| unique:25 | Rixots Keen | ssd | 1 | 0 | 0 | 3 | 2 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg-min","min1":5,"max1":5,"prop2":"att%","min2":20,"max2":20,"prop3":"light","min3":2,"max3":2,"prop4":"crush","min4":25,"max4":25,"prop5":"ac","min5":25,"max5":25,"prop6":"dmg%","min6":100,"max6":100} |
| unique:26 | Blood Crescent | scm | 1 | 0 | 0 | 10 | 7 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"res-all","min1":15,"max1":15,"prop2":"dmg%","min2":60,"max2":80,"prop3":"hp","min3":15,"max3":15,"prop4":"light","min4":4,"max4":4,"prop5":"openwounds","min5":33,"max5":33,"prop6":"swing2","min6":15,"max6":15,"prop7":"lifesteal","min7":15,"max7":15} |
| unique:27 | Krintizs Skewer | sbr | 1 | 0 | 0 | 14 | 10 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ignore-ac","min1":1,"max1":1,"prop2":"str","min2":10,"max2":10,"prop3":"dex","min3":10,"max3":10,"prop4":"manasteal","min4":7,"max4":7,"prop5":"dmg%","min5":50,"max5":50,"prop6":"dmg-norm","min6":3,"max6":7} |
| unique:28 | Gleamscythe | flc | 1 | 0 | 0 | 18 | 13 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"light","min1":3,"max1":3,"prop2":"mana","min2":30,"max2":30,"prop3":"ac","min3":20,"max3":20,"prop4":"swing2","min4":20,"max4":20,"prop5":"dmg%","min5":60,"max5":100,"prop6":"dmg-cold","par6":50,"min6":3,"max6":5} |
| unique:29 | Azurewrath | crs | 0 | 0 | 0 | 18 | 13 | 1 | 原始禁用（enabled≠1）；仅定义，未接入执行 | {"prop1":"deadly","min1":50,"max1":50,"prop2":"mag%","min2":10,"max2":10,"prop3":"dmg-cold","par3":100,"min3":3,"max3":6,"prop4":"dmg%","min4":100,"max4":100,"prop5":"dur","min5":25,"max5":25,"prop6":"dmg-mag","min6":5,"max6":10} |
| unique:30 | Griswolds Edge | bsd | 1 | 0 | 0 | 23 | 17 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"fire-min","min1":10,"max1":12,"prop2":"fire-max","min2":15,"max2":25,"prop3":"att","min3":100,"max3":100,"prop4":"swing1","min4":10,"max4":10,"prop5":"knock","min5":1,"max5":1,"prop6":"dmg%","min6":80,"max6":120,"prop7":"str","min7":12,"max7":12} |
| unique:31 | Hellplague | lsd | 1 | 0 | 0 | 30 | 22 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"manasteal","min1":5,"max1":5,"prop2":"lifesteal","min2":5,"max2":5,"prop3":"pois-min","min3":48,"max3":48,"prop4":"pois-max","min4":96,"max4":96,"prop5":"pois-len","min5":150,"max5":150,"prop6":"dmg%","min6":70,"max6":80,"prop7":"dmg-fire","min7":25,"max7":75,"prop8":"fireskill","min8":2,"max8":2} |
| unique:32 | Culwens Point | wsd | 1 | 0 | 0 | 39 | 29 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"allskills","min1":1,"max1":1,"prop2":"res-pois-len","min2":50,"max2":50,"prop3":"balance2","min3":20,"max3":20,"prop4":"swing2","min4":20,"max4":20,"prop5":"att","min5":60,"max5":60,"prop6":"dmg%","min6":70,"max6":80} |
| unique:33 | Shadowfang | 2hs | 1 | 0 | 0 | 16 | 12 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"manasteal","min1":9,"max1":9,"prop2":"res-cold","min2":20,"max2":20,"prop3":"light","min3":-2,"max3":-2,"prop4":"dmg-cold","par4":150,"min4":10,"max4":30,"prop5":"dmg%","min5":100,"max5":100,"prop6":"lifesteal","min6":9,"max6":9} |
| unique:34 | Soulflay | clm | 1 | 0 | 0 | 26 | 19 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"manasteal","min1":4,"max1":10,"prop2":"lifesteal","min2":4,"max2":4,"prop3":"dmg%","min3":70,"max3":100,"prop4":"res-all","min4":5,"max4":5,"prop5":"swing2","min5":10,"max5":10} |
| unique:35 | Kinemils Awl | gis | 1 | 0 | 0 | 31 | 23 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"att","min1":100,"max1":150,"prop2":"mana","min2":20,"max2":20,"prop3":"fire-min","min3":6,"max3":6,"prop4":"fire-max","min4":20,"max4":40,"prop5":"dmg%","min5":80,"max5":100,"prop6":"skill","par6":102,"min6":6,"max6":6} |
| unique:36 | Blacktongue | bsw | 1 | 0 | 0 | 35 | 26 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg-pois","par1":150,"min1":192,"max1":192,"prop2":"noheal","min2":1,"max2":1,"prop3":"att","min3":50,"max3":50,"prop4":"res-pois","min4":50,"max4":50,"prop5":"dmg%","min5":50,"max5":60,"prop6":"*hp","min6":-10,"max6":-10} |
| unique:37 | Ripsaw | flb | 1 | 0 | 0 | 35 | 26 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"openwounds","min1":80,"max1":80,"prop2":"dmg-max","min2":15,"max2":15,"prop3":"manasteal","min3":6,"max3":6,"prop4":"dmg%","min4":80,"max4":100} |
| unique:38 | The Patriarch | gsd | 1 | 0 | 0 | 39 | 29 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"red-dmg","min1":3,"max1":3,"prop2":"red-mag","min2":3,"max2":3,"prop3":"stupidity","min3":1,"max3":1,"prop4":"gold%","min4":100,"max4":100,"prop5":"dmg%","min5":100,"max5":120,"prop6":"str","min6":10,"max6":10} |
| unique:39 | Gull | dgr | 1 | 0 | 0 | 6 | 4 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg-min","min1":1,"max1":1,"prop2":"dmg-max","min2":15,"max2":15,"prop3":"mag%","min3":100,"max3":100,"prop4":"mana","min4":-5,"max4":-5} |
| unique:40 | The Diggler | dir | 1 | 0 | 0 | 15 | 11 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dex","min1":10,"max1":10,"prop2":"dmg%","min2":50,"max2":50,"prop3":"swing3","min3":30,"max3":30,"prop4":"res-cold","min4":25,"max4":25,"prop5":"res-fire","min5":25,"max5":25,"prop6":"ignore-ac","min6":1,"max6":1} |
| unique:41 | The Jade Tan Do | kri | 1 | 0 | 0 | 26 | 19 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"att","min1":100,"max1":150,"prop2":"nofreeze","min2":1,"max2":1,"prop3":"dmg-pois","par3":100,"min3":460,"max3":460,"prop4":"res-pois","min4":95,"max4":95,"prop5":"res-pois-max","min5":20,"max5":20} |
| unique:42 | Irices Shard | bld | 1 | 0 | 0 | 34 | 25 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"cast3","min1":50,"max1":50,"prop2":"mana","min2":50,"max2":50,"prop3":"att","min3":55,"max3":55,"prop4":"res-all","min4":10,"max4":10} |
| unique:43 | The Dragon Chang | spr | 1 | 0 | 0 | 11 | 8 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"att","min1":35,"max1":35,"prop2":"dmg-min","min2":10,"max2":10,"prop3":"light","min3":2,"max3":2,"prop4":"dmg-undead","min4":100,"max4":100,"prop5":"dmg-fire","min5":3,"max5":6} |
| unique:44 | Razortine | tri | 1 | 0 | 0 | 16 | 12 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"slow","min1":25,"max1":25,"prop2":"reduce-ac","min2":50,"max2":50,"prop3":"str","min3":15,"max3":15,"prop4":"dex","min4":8,"max4":8,"prop5":"swing2","min5":30,"max5":30,"prop6":"dmg%","min6":30,"max6":50} |
| unique:45 | Bloodthief | brn | 1 | 0 | 0 | 23 | 17 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"openwounds","min1":35,"max1":35,"prop2":"str","min2":10,"max2":10,"prop3":"lifesteal","min3":8,"max3":12,"prop4":"hp","min4":26,"max4":26,"prop5":"dmg%","min5":50,"max5":70} |
| unique:46 | Lance of Yaggai | spt | 1 | 0 | 0 | 30 | 22 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"thorns","min1":8,"max1":8,"prop2":"ltng-min","min2":1,"max2":1,"prop3":"ltng-max","min3":60,"max3":60,"prop4":"res-all","min4":15,"max4":15,"prop5":"swing2","min5":40,"max5":40} |
| unique:47 | The Tannr Gorerod | pik | 1 | 0 | 0 | 36 | 27 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"fire-min","min1":23,"max1":23,"prop2":"fire-max","min2":54,"max2":54,"prop3":"res-fire-max","min3":15,"max3":15,"prop4":"hp","min4":30,"max4":30,"prop5":"att","min5":60,"max5":60,"prop6":"light","min6":3,"max6":3,"prop7":"res-fire","min7":15,"max7":15,"prop8":"dmg%","min8":80,"max8":100} |
| unique:48 | Dimoaks Hew | bar | 1 | 0 | 0 | 11 | 8 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dex","min1":15,"max1":15,"prop2":"dmg%","min2":100,"max2":100,"prop3":"swing2","min3":20,"max3":20,"prop4":"ac","min4":-8,"max4":-8} |
| unique:49 | Steelgoad | vou | 1 | 0 | 0 | 19 | 14 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"howl","min1":96,"max1":96,"prop2":"deadly","min2":30,"max2":30,"prop3":"att","min3":30,"max3":30,"prop4":"res-all","min4":5,"max4":5,"prop5":"dmg%","min5":60,"max5":80,"prop6":"dur","min6":20,"max6":40} |
| unique:50 | Soul Harvest | scy | 1 | 0 | 0 | 26 | 19 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"openwounds","min1":30,"max1":30,"prop2":"att","min2":45,"max2":45,"prop3":"res-all","min3":20,"max3":20,"prop4":"dmg%","min4":50,"max4":90,"prop5":"manasteal","min5":10,"max5":10,"prop6":"enr","min6":5,"max6":5} |
| unique:51 | The Battlebranch | pax | 1 | 0 | 0 | 34 | 25 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"swing3","min1":30,"max1":30,"prop2":"dex","min2":10,"max2":10,"prop3":"dmg%","min3":50,"max3":70,"prop4":"att","min4":50,"max4":100,"prop5":"lifesteal","min5":7,"max5":7} |
| unique:52 | Woestave | hal | 1 | 0 | 0 | 38 | 28 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"slow","min1":50,"max1":50,"prop2":"openwounds","min2":50,"max2":50,"prop3":"stupidity","min3":3,"max3":3,"prop4":"dmg-ac","min4":-50,"max4":-50,"prop5":"freeze","min5":1,"max5":1,"prop6":"light","min6":-3,"max6":-3,"prop7":"noheal","min7":1,"max7":1,"prop8":"dmg%","min8":20,"max8":40,"prop9":"*enr","min9":-30,"max9":-30} |
| unique:53 | The Grim Reaper | wsc | 1 | 0 | 0 | 39 | 29 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"deadly","min1":100,"max1":100,"prop2":"noheal","min2":1,"max2":1,"prop3":"manasteal","min3":5,"max3":5,"prop4":"dmg%","min4":20,"max4":20,"prop5":"dmg-min","min5":15,"max5":15,"prop6":"*hp","min6":-20,"max6":-20} |
| unique:54 | Bane Ash | sst | 1 | 0 | 0 | 7 | 5 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"fire-min","min1":4,"max1":4,"prop2":"fire-max","min2":6,"max2":6,"prop3":"res-fire","min3":50,"max3":50,"prop4":"mana","min4":30,"max4":30,"prop5":"swing2","min5":20,"max5":20,"prop6":"dmg%","min6":50,"max6":60,"prop7":"skill","par7":36,"min7":5,"max7":5,"prop8":"skill","par8":37,"min8":2,"max8":2} |
| unique:55 | Serpent Lord | lst | 1 | 0 | 0 | 12 | 9 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg-pois","par1":75,"min1":40,"max1":40,"prop2":"res-pois","min2":50,"max2":50,"prop3":"light","min3":-1,"max3":-1,"prop4":"mana","min4":10,"max4":10,"prop5":"dmg%","min5":30,"max5":40,"prop6":"manasteal","min6":100,"max6":100,"prop7":"reduce-ac","min7":50,"max7":50} |
| unique:56 | Lazarus Spire | cst | 1 | 0 | 0 | 24 | 18 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"res-ltng","min1":75,"max1":75,"prop2":"red-dmg","min2":5,"max2":5,"prop3":"enr","min3":15,"max3":15,"prop4":"skill","par4":53,"min4":1,"max4":1,"prop5":"skill","par5":49,"min5":2,"max5":2,"prop6":"skill","par6":42,"min6":3,"max6":3,"prop7":"regen-mana","min7":43,"max7":43,"prop8":"dmg-ltng","min8":1,"max8":28,"prop9":"sor","min9":1,"max9":1} |
| unique:57 | The Salamander | bst | 1 | 0 | 0 | 28 | 21 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg-fire","min1":15,"max1":32,"prop2":"res-fire","min2":30,"max2":30,"prop3":"skill","par3":51,"min3":1,"max3":1,"prop4":"skill","par4":47,"min4":2,"max4":2,"prop5":"skill","par5":37,"min5":3,"max5":3,"prop6":"fireskill","min6":2,"max6":2} |
| unique:58 | The Iron Jang Bong | wst | 1 | 0 | 0 | 38 | 28 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ac","min1":30,"max1":30,"prop2":"cast3","min2":20,"max2":20,"prop3":"dmg%","min3":100,"max3":100,"prop4":"att%","min4":50,"max4":50,"prop5":"skill","par5":48,"min5":2,"max5":2,"prop6":"skill","par6":46,"min6":2,"max6":2,"prop7":"skill","par7":44,"min7":3,"max7":3,"prop8":"sor","min8":2,"max8":2} |
| unique:59 | Pluckeye | sbw | 1 | 0 | 0 | 10 | 7 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"att","min1":28,"max1":28,"prop2":"dmg%","min2":100,"max2":100,"prop3":"hp","min3":10,"max3":10,"prop4":"light","min4":2,"max4":2,"prop5":"manasteal","min5":3,"max5":3,"prop6":"mana-kill","min6":2,"max6":2} |
| unique:60 | Witherstring | hbw | 1 | 0 | 0 | 18 | 13 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"swing3","min1":30,"max1":30,"prop2":"dmg-min","min2":1,"max2":1,"prop3":"dmg-max","min3":3,"max3":3,"prop4":"att","min4":50,"max4":50,"prop5":"magicarrow","min5":3,"max5":3,"prop6":"dmg%","min6":40,"max6":50} |
| unique:61 | Rimeraven | lbw | 1 | 0 | 0 | 20 | 15 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"att%","min1":50,"max1":50,"prop2":"dex","min2":3,"max2":3,"prop3":"explosivearrow","min3":3,"max3":3,"prop4":"str","min4":3,"max4":3,"prop5":"dmg%","min5":60,"max5":70} |
| unique:62 | Piercerib | cbw | 1 | 0 | 0 | 27 | 20 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"res-all","min1":10,"max1":10,"prop2":"deadly","min2":30,"max2":30,"prop3":"att","min3":60,"max3":60,"prop4":"dmg-undead","min4":100,"max4":100,"prop5":"dmg%","min5":40,"max5":60,"prop6":"swing2","min6":50,"max6":50} |
| unique:63 | Pullspite | sbb | 1 | 0 | 0 | 34 | 25 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg-ltng","min1":1,"max1":30,"prop2":"str","min2":8,"max2":8,"prop3":"att","min3":28,"max3":28,"prop4":"pierce","min4":25,"max4":25,"prop5":"res-ltng","min5":25,"max5":25,"prop6":"dmg%","min6":70,"max6":90} |
| unique:64 | Wizendraw | lbb | 1 | 0 | 0 | 35 | 26 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"magicarrow","min1":5,"max1":5,"prop2":"mana","min2":30,"max2":30,"prop3":"swing2","min3":20,"max3":20,"prop4":"res-cold","min4":26,"max4":26,"prop5":"att","min5":50,"max5":100,"prop6":"dmg%","min6":70,"max6":80,"prop7":"enr","min7":15,"max7":15,"prop8":"pierce-cold","min8":20,"max8":35} |
| unique:65 | Hellclap | swb | 1 | 0 | 0 | 36 | 27 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"swing1","min1":10,"max1":10,"prop2":"fire-min","min2":15,"max2":15,"prop3":"fire-max","min3":30,"max3":50,"prop4":"att","min4":50,"max4":75,"prop5":"res-fire","min5":40,"max5":40,"prop6":"dex","min6":12,"max6":12,"prop7":"dmg%","min7":70,"max7":90,"prop8":"fireskill","min8":1,"max8":1} |
| unique:66 | Blastbark | lwb | 1 | 0 | 0 | 38 | 28 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg%","min1":70,"max1":130,"prop2":"str","min2":5,"max2":5,"prop3":"ama","min3":1,"max3":1,"prop4":"manasteal","min4":3,"max4":3,"prop5":"skill","par5":16,"min5":2,"max5":2} |
| unique:67 | Leadcrow | lxb | 1 | 0 | 0 | 12 | 9 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dex","min1":10,"max1":10,"prop2":"hp","min2":10,"max2":10,"prop3":"dmg%","min3":70,"max3":70,"prop4":"res-pois","min4":30,"max4":30,"prop5":"deadly","min5":25,"max5":25,"prop6":"att","min6":40,"max6":40} |
| unique:68 | Ichorsting | mxb | 1 | 0 | 0 | 24 | 18 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg-pois","par1":75,"min1":102,"max1":102,"prop2":"dex","min2":20,"max2":20,"prop3":"pierce","min3":50,"max3":50,"prop4":"att","min4":50,"max4":50,"prop5":"dmg%","min5":50,"max5":50,"prop6":"swing2","min6":20,"max6":20} |
| unique:69 | Hellcast | hxb | 1 | 0 | 0 | 36 | 27 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"explosivearrow","min1":5,"max1":5,"prop2":"res-fire-max","min2":15,"max2":15,"prop3":"res-fire","min3":15,"max3":15,"prop4":"att","min4":70,"max4":70,"prop5":"swing2","min5":20,"max5":20,"prop6":"dmg%","min6":70,"max6":80,"prop7":"dmg-fire","min7":15,"max7":35} |
| unique:70 | Doomspittle | rxb | 1 | 0 | 0 | 38 | 28 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ama","min1":1,"max1":1,"prop2":"pierce","min2":35,"max2":35,"prop3":"swing3","min3":30,"max3":30,"prop4":"hp","min4":15,"max4":15,"prop5":"dmg%","min5":60,"max5":100} |
| unique:71 | War Bonnet | cap | 1 | 0 | 0 | 4 | 3 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"hp","min1":15,"max1":15,"prop2":"att","min2":30,"max2":30,"prop3":"dmg%","min3":30,"max3":30,"prop4":"mana","min4":15,"max4":15,"prop5":"ac","min5":14,"max5":14} |
| unique:72 | Tarnhelm | skp | 1 | 0 | 0 | 20 | 15 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"gold%","min1":75,"max1":75,"prop2":"mag%","min2":25,"max2":50,"prop3":"allskills","min3":1,"max3":1} |
| unique:73 | Coif of Glory | hlm | 1 | 0 | 0 | 19 | 14 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"light-thorns","min1":7,"max1":7,"prop2":"stupidity","min2":1,"max2":1,"prop3":"res-ltng","min3":15,"max3":15,"prop4":"ac-miss","min4":100,"max4":100,"prop5":"ac","min5":10,"max5":10} |
| unique:74 | Duskdeep | fhl | 1 | 0 | 0 | 23 | 17 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"light","min1":-2,"max1":-2,"prop2":"res-all","min2":15,"max2":15,"prop3":"red-dmg","min3":7,"max3":7,"prop4":"dmg-max","min4":8,"max4":8,"prop5":"ac","min5":10,"max5":20,"prop6":"ac%","min6":30,"max6":50} |
| unique:75 | Wormskull | bhm | 1 | 0 | 0 | 28 | 21 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"nec","min1":1,"max1":1,"prop2":"lifesteal","min2":5,"max2":5,"prop3":"mana","min3":10,"max3":10,"prop4":"res-pois","min4":25,"max4":25,"prop5":"dmg-pois","par5":200,"min5":102,"max5":102} |
| unique:76 | Howltusk | ghm | 1 | 0 | 0 | 34 | 25 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"red-mag","min1":2,"max1":2,"prop2":"thorns","min2":3,"max2":3,"prop3":"ac%","min3":80,"max3":80,"prop4":"dmg-to-mana","min4":35,"max4":35,"prop5":"knock","min5":1,"max5":1,"prop6":"howl","min6":33,"max6":33} |
| unique:77 | Undead Crown | crn | 1 | 0 | 0 | 39 | 29 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"lifesteal","min1":5,"max1":5,"prop2":"ac","min2":40,"max2":40,"prop3":"res-pois","min3":50,"max3":50,"prop4":"half-freeze","min4":1,"max4":1,"prop5":"ac%","min5":30,"max5":60,"prop6":"dmg-undead","min6":50,"max6":50,"prop7":"att-undead","min7":50,"max7":100,"prop8":"skill","par8":69,"min8":3,"max8":3} |
| unique:78 | The Face of Horror | msk | 1 | 0 | 0 | 27 | 20 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"howl","min1":64,"max1":64,"prop2":"str","min2":20,"max2":20,"prop3":"res-all","min3":10,"max3":10,"prop4":"dmg-undead","min4":50,"max4":50,"prop5":"ac","min5":25,"max5":25} |
| unique:79 | Greyform | qui | 1 | 0 | 0 | 10 | 7 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"red-mag","min1":3,"max1":3,"prop2":"res-cold","min2":20,"max2":20,"prop3":"res-fire","min3":20,"max3":20,"prop4":"dex","min4":10,"max4":10,"prop5":"lifesteal","min5":5,"max5":5,"prop6":"ac","min6":20,"max6":20} |
| unique:80 | Blinkbats Form | lea | 1 | 0 | 0 | 16 | 12 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ac-miss","min1":50,"max1":50,"prop2":"move2","min2":10,"max2":10,"prop3":"ac","min3":25,"max3":25,"prop4":"fire-min","min4":3,"max4":3,"prop5":"fire-max","min5":6,"max5":6,"prop6":"balance2","min6":40,"max6":40} |
| unique:81 | The Centurion | hla | 1 | 0 | 0 | 19 | 14 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ac","min1":30,"max1":30,"prop2":"att","min2":50,"max2":50,"prop3":"red-dmg","min3":2,"max3":2,"prop4":"hp","min4":15,"max4":15,"prop5":"mana","min5":15,"max5":15,"prop6":"stam","min6":15,"max6":15,"prop7":"regen","min7":5,"max7":5,"prop8":"stamdrain","min8":25,"max8":25} |
| unique:82 | Twitchthroe | stu | 1 | 0 | 0 | 22 | 16 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"swing2","min1":20,"max1":20,"prop2":"dex","min2":10,"max2":10,"prop3":"block","min3":25,"max3":25,"prop4":"ac","min4":25,"max4":25,"prop5":"str","min5":10,"max5":10,"prop6":"balance2","min6":20,"max6":20} |
| unique:83 | Darkglow | rng | 1 | 0 | 0 | 19 | 14 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"att","min1":20,"max1":20,"prop2":"res-all-max","min2":5,"max2":5,"prop3":"light","min3":3,"max3":3,"prop4":"ac-hth","min4":50,"max4":50,"prop5":"res-all","min5":10,"max5":10,"prop6":"ac%","min6":70,"max6":100} |
| unique:84 | Hawkmail | scl | 1 | 0 | 0 | 20 | 15 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ac%","min1":80,"max1":100,"prop2":"res-cold-max","min2":15,"max2":15,"prop3":"res-cold","min3":15,"max3":15,"prop4":"nofreeze","min4":1,"max4":1,"prop5":"move2","min5":10,"max5":10} |
| unique:85 | Sparking Mail | chn | 1 | 0 | 0 | 23 | 17 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ac%","min1":75,"max1":85,"prop2":"dmg-ltng","min2":1,"max2":20,"prop3":"light-thorns","min3":10,"max3":14,"prop4":"res-ltng","min4":30,"max4":30} |
| unique:86 | Venomsward | brs | 1 | 0 | 0 | 27 | 20 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"res-pois-max","min1":15,"max1":15,"prop2":"res-pois-len","min2":50,"max2":50,"prop3":"res-pois","min3":90,"max3":90,"prop4":"light","min4":2,"max4":2,"prop5":"ac%","min5":60,"max5":100} |
| unique:87 | Iceblink | spl | 1 | 0 | 0 | 30 | 22 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"freeze","min1":1,"max1":1,"prop2":"res-cold","min2":30,"max2":30,"prop3":"light","min3":4,"max3":4,"prop4":"red-mag","min4":1,"max4":1,"prop5":"ac%","min5":70,"max5":80} |
| unique:88 | Boneflesh | plt | 1 | 0 | 0 | 35 | 26 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"lifesteal","min1":5,"max1":5,"prop2":"ac%","min2":100,"max2":120,"prop3":"att","min3":35,"max3":35,"prop4":"openwounds","min4":25,"max4":25} |
| unique:89 | Rockfleece | fld | 1 | 0 | 0 | 38 | 28 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ease","min1":-10,"max1":-10,"prop2":"ac%","min2":100,"max2":130,"prop3":"red-dmg%","min3":10,"max3":10,"prop4":"red-dmg","min4":5,"max4":5,"prop5":"str","min5":5,"max5":5} |
| unique:90 | Rattlecage | gth | 1 | 0 | 0 | 39 | 29 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"howl","min1":52,"max1":52,"prop2":"att","min2":45,"max2":45,"prop3":"crush","min3":25,"max3":25,"prop4":"ac","min4":200,"max4":200} |
| unique:91 | Goldskin | ful | 1 | 0 | 0 | 38 | 28 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ac%","min1":120,"max1":150,"prop2":"res-all","min2":35,"max2":35,"prop3":"thorns","min3":10,"max3":10,"prop4":"light","min4":2,"max4":2,"prop5":"gold%","min5":100,"max5":100} |
| unique:92 | Victors Silk | aar | 1 | 0 | 0 | 38 | 28 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"manasteal","min1":5,"max1":5,"prop2":"allskills","min2":1,"max2":1,"prop3":"light","min3":2,"max3":2,"prop4":"ac%","min4":100,"max4":120} |
| unique:93 | Heavenly Garb | ltp | 1 | 0 | 0 | 39 | 29 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ac%","min1":100,"max1":100,"prop2":"res-all","min2":10,"max2":10,"prop3":"regen-mana","min3":25,"max3":25,"prop4":"enr","min4":15,"max4":15,"prop5":"dmg-undead","min5":50,"max5":50,"prop6":"att-undead","min6":100,"max6":100} |
| unique:94 | Pelta Lunata | buc | 1 | 0 | 0 | 3 | 2 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ac","min1":30,"max1":30,"prop2":"vit","min2":10,"max2":10,"prop3":"str","min3":2,"max3":2,"prop4":"enr","min4":10,"max4":10,"prop5":"ac%","min5":30,"max5":40,"prop6":"block","min6":20,"max6":20,"prop7":"block2","min7":40,"max7":40,"prop8":"dur","min8":8,"max8":12} |
| unique:95 | Umbral Disk | sml | 1 | 0 | 0 | 12 | 9 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"stupidity","min1":1,"max1":1,"prop2":"dex","min2":10,"max2":10,"prop3":"ac","min3":30,"max3":30,"prop4":"hp","min4":20,"max4":20,"prop5":"light","min5":-2,"max5":-2,"prop6":"ac%","min6":40,"max6":50,"prop7":"block","min7":30,"max7":30,"prop8":"dur","min8":10,"max8":15} |
| unique:96 | Stormguild | lrg | 1 | 0 | 0 | 18 | 13 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"red-mag","min1":1,"max1":1,"prop2":"res-ltng","min2":25,"max2":25,"prop3":"ac","min3":30,"max3":30,"prop4":"dmg-ltng","min4":1,"max4":6,"prop5":"ac%","min5":50,"max5":60,"prop6":"block","min6":30,"max6":30,"prop7":"light-thorns","min7":3,"max7":3,"prop8":"dur","min8":10,"max8":15} |
| unique:97 | Wall of the Eyeless | bsh | 1 | 0 | 0 | 27 | 20 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"mana-kill","min1":5,"max1":5,"prop2":"manasteal","min2":3,"max2":3,"prop3":"cast2","min3":20,"max3":20,"prop4":"res-pois","min4":20,"max4":20,"prop5":"ac%","min5":30,"max5":40,"prop6":"ac","min6":10,"max6":10} |
| unique:98 | Swordback Hold | spk | 1 | 0 | 0 | 20 | 15 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"thorns","min1":5,"max1":5,"prop2":"block","min2":20,"max2":20,"prop3":"openwounds","min3":50,"max3":50,"prop4":"bloody","min4":3,"max4":5,"prop5":"ac%","min5":30,"max5":60,"prop6":"thorns","min6":5,"max6":5,"prop7":"ac","min7":10,"max7":10} |
| unique:99 | Steelclash | kit | 1 | 0 | 0 | 23 | 17 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"block","min1":25,"max1":25,"prop2":"pal","min2":1,"max2":1,"prop3":"red-dmg","min3":3,"max3":3,"prop4":"light","min4":3,"max4":3,"prop5":"ac%","min5":60,"max5":100,"prop6":"block2","min6":20,"max6":20,"prop7":"res-all","min7":15,"max7":15,"prop8":"ac","min8":20,"max8":20,"prop9":"dur","min9":15,"max9":20} |
| unique:100 | Bverrit Keep | tow | 1 | 0 | 0 | 26 | 19 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ac","min1":30,"max1":30,"prop2":"res-fire","min2":75,"max2":75,"prop3":"str","min3":5,"max3":5,"prop4":"red-mag","min4":5,"max4":5,"prop5":"ac%","min5":80,"max5":120,"prop6":"block","min6":10,"max6":10,"prop7":"dur","min7":80,"max7":100} |
| unique:101 | The Ward | gts | 1 | 0 | 0 | 35 | 26 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ac","min1":40,"max1":40,"prop2":"red-mag","min2":2,"max2":2,"prop3":"str","min3":10,"max3":10,"prop4":"block","min4":10,"max4":10,"prop5":"ac%","min5":100,"max5":100,"prop6":"res-all","min6":30,"max6":50} |
| unique:102 | The Hand of Broc | lgl | 1 | 0 | 0 | 7 | 5 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"manasteal","min1":3,"max1":3,"prop2":"lifesteal","min2":3,"max2":3,"prop3":"res-pois","min3":10,"max3":10,"prop4":"mana","min4":20,"max4":20,"prop5":"ac","min5":10,"max5":10,"prop6":"ac%","min6":10,"max6":20} |
| unique:103 | Bloodfist | vgl | 1 | 0 | 0 | 12 | 9 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg-min","min1":5,"max1":5,"prop2":"hp","min2":40,"max2":40,"prop3":"balance2","min3":30,"max3":30,"prop4":"ac","min4":10,"max4":10,"prop5":"ac%","min5":10,"max5":20,"prop6":"swing2","min6":10,"max6":10} |
| unique:104 | Chance Guards | mgl | 1 | 0 | 0 | 20 | 15 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"gold%","min1":200,"max1":200,"prop2":"mag%","min2":25,"max2":40,"prop3":"att","min3":25,"max3":25,"prop4":"ac","min4":15,"max4":15,"prop5":"light","min5":2,"max5":2,"prop6":"ac%","min6":20,"max6":30} |
| unique:105 | Magefist | tgl | 1 | 0 | 0 | 31 | 23 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"cast3","min1":20,"max1":20,"prop2":"regen-mana","min2":25,"max2":25,"prop3":"fireskill","min3":1,"max3":1,"prop4":"dmg-fire","min4":1,"max4":6,"prop5":"ac","min5":10,"max5":10,"prop6":"ac%","min6":20,"max6":30} |
| unique:106 | Frostburn | hgl | 1 | 0 | 0 | 39 | 29 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ac","min1":30,"max1":30,"prop2":"dmg%","min2":5,"max2":5,"prop3":"mana%","min3":40,"max3":40,"prop4":"dmg-cold","par4":50,"min4":1,"max4":6,"prop5":"ac%","min5":10,"max5":20} |
| unique:107 | Hotspur | lbt | 1 | 0 | 0 | 7 | 5 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"res-fire-max","min1":15,"max1":15,"prop2":"hp","min2":15,"max2":15,"prop3":"dmg-fire","min3":3,"max3":6,"prop4":"ac","min4":6,"max4":6,"prop5":"res-fire","min5":45,"max5":45,"prop6":"ac%","min6":10,"max6":20} |
| unique:108 | Gorefoot | vbt | 1 | 0 | 0 | 12 | 9 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"bloody","min1":3,"max1":5,"prop2":"move2","min2":20,"max2":20,"prop3":"manasteal","min3":2,"max3":2,"prop4":"thorns","min4":2,"max4":2,"prop5":"ac","min5":12,"max5":12,"prop6":"ac%","min6":20,"max6":30,"prop7":"skill","par7":132,"min7":2,"max7":2} |
| unique:109 | Treads of Cthon | mbt | 1 | 0 | 0 | 20 | 15 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"move2","min1":30,"max1":30,"prop2":"ac-miss","min2":50,"max2":50,"prop3":"stamdrain","min3":50,"max3":50,"prop4":"hp","min4":10,"max4":10,"prop5":"ac","min5":12,"max5":12,"prop6":"ac%","min6":30,"max6":40} |
| unique:110 | Goblin Toe | tbt | 1 | 0 | 0 | 30 | 22 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"crush","min1":25,"max1":25,"prop2":"red-dmg","min2":1,"max2":1,"prop3":"red-mag","min3":1,"max3":1,"prop4":"ac","min4":15,"max4":15,"prop5":"light","min5":-1,"max5":-1,"prop6":"ac%","min6":50,"max6":60} |
| unique:111 | Tearhaunch | hbt | 1 | 0 | 0 | 39 | 29 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ac","min1":35,"max1":35,"prop2":"str","min2":5,"max2":5,"prop3":"dex","min3":5,"max3":5,"prop4":"move2","min4":20,"max4":20,"prop5":"res-all","min5":10,"max5":10,"prop6":"ac%","min6":60,"max6":80,"prop7":"skill","par7":115,"min7":2,"max7":2} |
| unique:112 | Lenyms Cord | lbl | 1 | 0 | 0 | 10 | 7 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"mana","min1":15,"max1":15,"prop2":"regen-mana","min2":30,"max2":30,"prop3":"res-all","min3":5,"max3":5,"prop4":"light","min4":1,"max4":1} |
| unique:113 | Snakecord | vbl | 1 | 0 | 0 | 16 | 12 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg-pois","par1":75,"min1":40,"max1":40,"prop2":"res-pois","min2":25,"max2":25,"prop3":"ac","min3":10,"max3":10,"prop4":"ac%","min4":20,"max4":30,"prop5":"regen","min5":5,"max5":5,"prop6":"res-pois-len","min6":50,"max6":50} |
| unique:114 | Nightsmoke | mbl | 1 | 0 | 0 | 27 | 20 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"res-all","min1":10,"max1":10,"prop2":"dmg-to-mana","min2":50,"max2":50,"prop3":"mana","min3":20,"max3":20,"prop4":"red-dmg","min4":2,"max4":2,"prop5":"ac","min5":15,"max5":15,"prop6":"ac%","min6":30,"max6":50} |
| unique:115 | Goldwrap | tbl | 1 | 0 | 0 | 36 | 27 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"mag%","min1":30,"max1":30,"prop2":"light","min2":2,"max2":2,"prop3":"ac","min3":25,"max3":25,"prop4":"swing2","min4":10,"max4":10,"prop5":"ac%","min5":40,"max5":60,"prop6":"gold%","min6":50,"max6":80} |
| unique:116 | Bladebuckle | hbl | 1 | 0 | 0 | 39 | 29 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"thorns","min1":8,"max1":8,"prop2":"ac","min2":30,"max2":30,"prop3":"red-dmg","min3":3,"max3":3,"prop4":"str","min4":5,"max4":5,"prop5":"dex","min5":10,"max5":10,"prop6":"ac%","min6":80,"max6":100,"prop7":"balance2","min7":30,"max7":30} |
| unique:117 | Nokozan Relic | amu | 1 | 0 | 0 | 14 | 10 | 20 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg-fire","min1":3,"max1":6,"prop2":"res-fire-max","min2":10,"max2":10,"prop3":"res-fire","min3":50,"max3":50,"prop4":"light","min4":3,"max4":3,"prop5":"balance2","min5":20,"max5":20} |
| unique:118 | The Eye of Etlich | amu | 1 | 0 | 0 | 20 | 15 | 5 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ac-miss","min1":10,"max1":40,"prop2":"light","min2":1,"max2":5,"prop3":"allskills","min3":1,"max3":1,"prop4":"lifesteal","min4":3,"max4":7,"prop5":"cold-min","min5":1,"max5":2,"prop6":"cold-max","min6":3,"max6":5,"prop7":"cold-len","min7":50,"max7":250} |
| unique:119 | The Mahim-Oak Curio | amu | 1 | 0 | 0 | 34 | 25 | 10 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dex","min1":10,"max1":10,"prop2":"str","min2":10,"max2":10,"prop3":"enr","min3":10,"max3":10,"prop4":"vit","min4":10,"max4":10,"prop5":"ac","min5":10,"max5":10,"prop6":"att%","min6":10,"max6":10,"prop7":"res-all","min7":10,"max7":10,"prop8":"ac%","min8":10,"max8":10} |
| unique:120 | Nagelring | rin | 1 | 0 | 0 | 10 | 7 | 15 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"red-mag","min1":3,"max1":3,"prop2":"thorns","min2":3,"max2":3,"prop3":"att","min3":50,"max3":75,"prop4":"mag%","min4":15,"max4":30} |
| unique:121 | Manald Heal | rin | 1 | 0 | 0 | 20 | 15 | 15 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"manasteal","min1":4,"max1":7,"prop2":"regen","min2":5,"max2":8,"prop3":"hp","min3":20,"max3":20,"prop4":"regen-mana","min4":20,"max4":20} |
| unique:122 | The Stone of Jordan | rin | 1 | 0 | 0 | 39 | 29 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"mana","min1":20,"max1":20,"prop2":"mana%","min2":25,"max2":25,"prop3":"ltng-min","min3":1,"max3":1,"prop4":"allskills","min4":1,"max4":1,"prop5":"ltng-max","min5":12,"max5":12} |
| unique:123 | Amulet of the Viper | vip | 1 | 0 | 0 | 0 | 0 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"mana","min1":10,"max1":10,"prop2":"res-pois","min2":25,"max2":25,"prop3":"hp","min3":10,"max3":10} |
| unique:124 | Staff of Kings | msf | 1 | 0 | 0 | 0 | 0 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"res-all","min1":10,"max1":10,"prop2":"swing3","min2":50,"max2":50} |
| unique:125 | Horadric Staff | hst | 1 | 0 | 0 | 0 | 0 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"mana","min1":10,"max1":10,"prop2":"res-pois","min2":25,"max2":25,"prop3":"hp","min3":10,"max3":10,"prop4":"res-all","min4":10,"max4":10,"prop5":"swing3","min5":50,"max5":50} |
| unique:126 | Hell Forge Hammer | hfh | 1 | 0 | 0 | 0 | 0 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"fire-min","min1":5,"max1":5,"prop2":"fire-max","min2":20,"max2":20,"prop3":"res-fire","min3":40,"max3":40,"prop4":"ac","min4":35,"max4":35} |
| unique:127 | KhalimFlail | qf1 | 1 | 0 | 0 | 0 | 0 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ltng-min","min1":1,"max1":1,"prop2":"ltng-max","min2":20,"max2":20,"prop3":"swing3","min3":50,"max3":50,"prop4":"att","min4":40,"max4":40} |
| unique:128 | SuperKhalimFlail | qf2 | 1 | 0 | 0 | 0 | 0 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ltng-min","min1":1,"max1":1,"prop2":"ltng-max","min2":40,"max2":40,"prop3":"swing3","min3":50,"max3":50,"prop4":"att","min4":40,"max4":40,"prop5":"manasteal","min5":6,"max5":6,"prop6":"lifesteal","min6":6,"max6":6} |
| unique:130 | Coldkill | 9ha | 1 | 0 | 100 | 44 | 36 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg-cold","par1":50,"min1":40,"max1":40,"prop2":"res-cold","min2":15,"max2":15,"prop3":"res-cold-max","min3":15,"max3":15,"prop4":"swing3","min4":30,"max4":30,"prop5":"hit-skill","par5":45,"min5":10,"max5":10,"prop6":"gethit-skill","par6":44,"min6":10,"max6":5,"prop7":"dmg%","min7":150,"max7":190} |
| unique:131 | Butcher's Pupil | 9ax | 1 | 0 | 100 | 47 | 39 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"deadly","min1":35,"max1":35,"prop2":"openwounds","min2":25,"max2":25,"prop3":"dmg%","min3":150,"max3":200,"prop4":"indestruct","min4":1,"max4":1,"prop5":"swing3","min5":30,"max5":30,"prop6":"dmg-norm","min6":30,"max6":50} |
| unique:132 | Islestrike | 92a | 1 | 0 | 100 | 51 | 43 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dru","min1":2,"max1":2,"prop2":"str","min2":10,"max2":10,"prop3":"dex","min3":10,"max3":10,"prop4":"vit","min4":10,"max4":10,"prop5":"enr","min5":10,"max5":10,"prop6":"ac-miss","min6":50,"max6":50,"prop7":"crush","min7":25,"max7":25,"prop8":"dmg%","min8":170,"max8":190,"prop9":"skill","par9":233,"min9":1,"max9":1,"prop10":"skill","par10":248,"min10":1,"max10":1} |
| unique:133 | Pompe's Wrath | 9mp | 1 | 0 | 100 | 53 | 45 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"hit-skill","par1":244,"min1":4,"max1":8,"prop2":"slow","min2":50,"max2":50,"prop3":"dmg-fire","min3":35,"max3":150,"prop4":"knock","min4":1,"max4":1,"prop5":"dmg%","min5":140,"max5":170} |
| unique:134 | Guardian Naga | 9wa | 1 | 0 | 100 | 56 | 48 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"hit-skill","par1":92,"min1":5,"max1":8,"prop2":"thorns","min2":15,"max2":15,"prop3":"res-pois","min3":30,"max3":30,"prop4":"dmg%","min4":150,"max4":180,"prop5":"dmg-pois","par5":250,"min5":256,"max5":256,"prop6":"dmg-max","min6":20,"max6":20} |
| unique:135 | Warlord's Trust | 9la | 1 | 0 | 100 | 43 | 35 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ac","min1":75,"max1":75,"prop2":"regen","min2":20,"max2":20,"prop3":"vit/lvl","par3":4,"prop4":"res-all","min4":10,"max4":10,"prop5":"rep-dur","par5":25,"prop6":"dmg%","min6":175,"max6":175} |
| unique:136 | Spellsteel | 9ba | 1 | 0 | 100 | 47 | 39 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ease","min1":-60,"max1":-60,"prop2":"mana","min2":100,"max2":100,"prop3":"red-mag","min3":12,"max3":15,"prop4":"cast1","min4":10,"max4":10,"prop5":"dmg%","min5":165,"max5":165,"prop6":"regen-mana","min6":25,"max6":25,"prop7":"charged","par7":54,"min7":20,"max7":1,"prop8":"charged","par8":87,"min8":30,"max8":3,"prop9":"charged","par9":101,"min9":100,"max9":10,"prop10":"charged","par10":225,"min10":60,"max10":12} |
| unique:137 | Stormrider | 9bt | 1 | 0 | 100 | 49 | 41 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"hit-skill","par1":53,"min1":5,"max1":10,"prop2":"hit-skill","par2":38,"min2":10,"prop3":"dmg-ltng","min3":1,"max3":200,"prop4":"dmg-norm","min4":35,"max4":75,"prop5":"dmg%","min5":100,"max5":100,"prop6":"dur","min6":50,"max6":50,"prop7":"light-thorns","min7":15,"max7":15,"prop8":"gethit-skill","par8":38,"min8":15,"max8":5} |
| unique:138 | Boneslayer Blade | 9ga | 1 | 0 | 100 | 50 | 42 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"att-und/lvl","par1":10,"prop2":"dmg-und/lvl","par2":20,"prop3":"str","min3":8,"max3":8,"prop4":"swing2","min4":20,"max4":20,"prop5":"att%","min5":35,"max5":35,"prop6":"dmg%","min6":180,"max6":220,"prop7":"charged","par7":101,"min7":200,"max7":20,"prop8":"gethit-skill","par8":101,"min8":50} |
| unique:139 | The Minataur | 9gi | 1 | 0 | 100 | 53 | 45 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"stupidity","min1":2,"max1":2,"prop2":"half-freeze","min2":1,"max2":1,"prop3":"str","min3":15,"max3":20,"prop4":"slow","min4":50,"max4":50,"prop5":"crush","min5":30,"max5":30,"prop6":"dmg-norm","min6":20,"max6":30,"prop7":"dmg%","min7":140,"max7":200} |
| unique:140 | Suicide Branch | 9wn | 1 | 0 | 100 | 41 | 33 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"thorns","min1":25,"max1":25,"prop2":"cast2","min2":50,"max2":50,"prop3":"res-all","min3":10,"max3":10,"prop4":"mana%","min4":10,"max4":10,"prop5":"hp","min5":40,"max5":40,"prop6":"allskills","min6":1,"max6":1} |
| unique:141 | Carin Shard | 9yw | 1 | 0 | 100 | 43 | 35 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"hp/lvl","par1":10,"prop2":"cast2","min2":10,"max2":10,"prop3":"mana/lvl","par3":10,"prop4":"balance2","min4":30,"max4":30,"prop5":"regen","min5":5,"max5":5,"prop6":"nec","min6":1,"max6":1,"prop7":"skilltab","par7":8,"min7":2,"max7":2} |
| unique:142 | Arm of King Leoric | 9bw | 1 | 0 | 100 | 44 | 36 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"skilltab","par1":8,"min1":2,"max1":2,"prop2":"gethit-skill","par2":93,"min2":5,"max2":10,"prop3":"mana/lvl","par3":10,"prop4":"gethit-skill","par4":88,"min4":10,"max4":2,"prop5":"cast1","min5":10,"max5":10,"prop6":"skilltab","par6":7,"min6":2,"max6":2,"prop7":"skill","par7":77,"min7":2,"max7":2,"prop8":"skill","par8":80,"min8":2,"max8":2,"prop9":"skill","par9":69,"min9":3,"max9":3,"prop10":"skill","par10":70,"min10":3,"max10":3} |
| unique:143 | Blackhand Key | 9gw | 1 | 0 | 100 | 49 | 41 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"skilltab","par1":6,"min1":1,"max1":1,"prop2":"dmg-to-mana","min2":20,"max2":20,"prop3":"hp","min3":50,"max3":50,"prop4":"light","min4":-2,"max4":-2,"prop5":"cast3","min5":30,"max5":30,"prop6":"res-fire","min6":37,"max6":37,"prop7":"nec","min7":2,"max7":2,"prop8":"charged","par8":150,"min8":30,"max8":13} |
| unique:144 | Dark Clan Crusher | 9cl | 1 | 0 | 100 | 42 | 34 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dru","min1":2,"max1":2,"prop2":"dmg-demon","min2":200,"max2":200,"prop3":"att-demon","min3":200,"max3":200,"prop4":"dmg%","min4":195,"max4":195,"prop5":"att%","min5":20,"max5":25,"prop6":"demon-heal","min6":15,"max6":15} |
| unique:145 | Zakarum's Hand | 9sc | 1 | 0 | 100 | 45 | 37 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"manasteal","min1":8,"max1":8,"prop2":"ignore-ac","min2":1,"max2":1,"prop3":"regen-mana","min3":10,"max3":10,"prop4":"regen-stam","min4":15,"max4":15,"prop5":"hit-skill","par5":59,"min5":6,"max5":5,"prop6":"dmg%","min6":180,"max6":220,"prop7":"swing2","min7":30,"max7":30,"prop8":"skill","par8":114,"min8":2,"max8":2,"prop9":"skill","par9":118,"min9":2,"max9":2} |
| unique:146 | The Fetid Sprinkler | 9qs | 1 | 0 | 100 | 46 | 38 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"pal","min1":2,"max1":2,"prop2":"hit-skill","par2":87,"min2":5,"max2":1,"prop3":"hit-skill","par3":81,"min3":10,"max3":1,"prop4":"dmg-pois","par4":100,"min4":409,"max4":409,"prop5":"dmg%","min5":160,"max5":190,"prop6":"att","min6":150,"max6":200,"prop7":"dmg-norm","min7":15,"max7":25} |
| unique:147 | Hand of Blessed Light | 9ws | 1 | 0 | 100 | 50 | 42 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"pal","min1":2,"max1":2,"prop2":"dmg%","min2":130,"max2":160,"prop3":"att%","min3":100,"max3":100,"prop4":"ac","min4":50,"max4":50,"prop5":"regen-mana","min5":15,"max5":15,"prop6":"light","min6":4,"max6":4,"prop7":"dmg-norm","min7":20,"max7":45,"prop8":"skill","par8":101,"min8":4,"max8":4,"prop9":"skill","par9":121,"min9":2,"max9":2,"prop10":"hit-skill","par10":121,"min10":5,"max10":4} |
| unique:148 | Fleshrender | 9sp | 1 | 0 | 100 | 46 | 38 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"openwounds","min1":25,"max1":25,"prop2":"noheal","min2":1,"max2":1,"prop3":"crush","min3":20,"max3":20,"prop4":"deadly","min4":20,"max4":20,"prop5":"dmg-norm","min5":35,"max5":50,"prop6":"dmg%","min6":130,"max6":200,"prop7":"dru","min7":1,"max7":1,"prop8":"skilltab","par8":16,"min8":2,"max8":2,"prop9":"dur","min9":20,"max9":20} |
| unique:149 | Sureshrill Frost | 9ma | 1 | 0 | 100 | 47 | 39 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg-cold","par1":125,"min1":63,"max1":112,"prop2":"nofreeze","min2":1,"max2":1,"prop3":"dmg%","min3":150,"max3":180,"prop4":"dmg-norm","min4":5,"max4":10,"prop5":"freeze","min5":3,"max5":3,"prop6":"charged","par6":64,"min6":50,"max6":9} |
| unique:150 | Moonfall | 9mt | 1 | 0 | 100 | 50 | 42 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"hit-skill","par1":56,"min1":5,"max1":6,"prop2":"dmg-fire","min2":55,"max2":115,"prop3":"red-mag","min3":9,"max3":12,"prop4":"dmg%","min4":120,"max4":150,"prop5":"light","min5":2,"max5":2,"prop6":"charged","par6":56,"min6":60,"max6":11,"prop7":"dmg-norm","min7":10,"max7":15} |
| unique:151 | Baezil's Vortex | 9fl | 1 | 0 | 100 | 53 | 45 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"hit-skill","par1":48,"min1":5,"max1":8,"prop2":"dmg-ltng","min2":1,"max2":150,"prop3":"mana","min3":100,"max3":100,"prop4":"res-ltng","min4":25,"max4":25,"prop5":"dmg%","min5":160,"max5":200,"prop6":"swing2","min6":20,"max6":20,"prop7":"charged","par7":48,"min7":80,"max7":15} |
| unique:152 | Earthshaker | 9wh | 1 | 0 | 100 | 51 | 43 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"hit-skill","par1":234,"min1":5,"max1":7,"prop2":"knock","min2":1,"max2":1,"prop3":"swing3","min3":30,"max3":30,"prop4":"dmg%","min4":180,"max4":180,"prop5":"stupidity","min5":1,"max5":1,"prop6":"skilltab","par6":17,"min6":3,"max6":3,"prop7":"dur","min7":50,"max7":50} |
| unique:153 | Bloodtree Stump | 9m9 | 1 | 0 | 100 | 56 | 48 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"crush","min1":50,"max1":50,"prop2":"dmg%","min2":180,"max2":220,"prop3":"res-all","min3":20,"max3":20,"prop4":"str","min4":25,"max4":25,"prop5":"skilltab","par5":13,"min5":2,"max5":2,"prop6":"skill","par6":129,"min6":3,"max6":3,"prop7":"dur","min7":40,"max7":40} |
| unique:154 | The Gavel of Pain | 9gm | 1 | 0 | 100 | 53 | 45 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"hit-skill","par1":66,"min1":5,"max1":1,"prop2":"gethit-skill","par2":76,"min2":5,"max2":1,"prop3":"thorns","min3":26,"max3":26,"prop4":"indestruct","min4":1,"max4":1,"prop5":"dmg-norm","min5":12,"max5":30,"prop6":"dmg%","min6":130,"max6":160,"prop7":"charged","par7":66,"min7":3,"max7":8} |
| unique:155 | Bloodletter | 9ss | 1 | 0 | 100 | 38 | 30 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg-norm","min1":12,"max1":45,"prop2":"att","min2":90,"max2":90,"prop3":"lifesteal","min3":8,"max3":8,"prop4":"stamdrain","min4":10,"max4":10,"prop5":"swing2","min5":20,"max5":20,"prop6":"dmg%","min6":140,"max6":140,"prop7":"skill","par7":127,"min7":2,"max7":4,"prop8":"skill","par8":151,"min8":1,"max8":3,"prop9":"dur","min9":30,"max9":30} |
| unique:156 | Coldsteel Eye | 9sm | 1 | 0 | 100 | 39 | 31 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"stupidity","min1":1,"max1":1,"prop2":"slow","min2":30,"max2":30,"prop3":"deadly","min3":50,"max3":50,"prop4":"dur","min4":50,"max4":50,"prop5":"dmg%","min5":200,"max5":250,"prop6":"swing2","min6":20,"max6":20,"prop7":"manasteal","min7":6,"max7":6} |
| unique:157 | Hexfire | 9sb | 1 | 0 | 100 | 41 | 33 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"charged","par1":62,"min1":36,"max1":6,"prop2":"ignore-ac","min2":1,"max2":1,"prop3":"res-fire","min3":25,"max3":25,"prop4":"res-fire-max","min4":10,"max4":10,"prop5":"dmg-norm","min5":35,"max5":40,"prop6":"dmg%","min6":140,"max6":160,"prop7":"fireskill","min7":3,"max7":3} |
| unique:158 | Blade of Ali Baba | 9fc | 1 | 0 | 100 | 43 | 35 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"sock","par1":3,"prop2":"gold%/lvl","par2":20,"prop3":"mag%/lvl","par3":8,"prop4":"mana","min4":15,"max4":15,"prop5":"dmg%","min5":60,"max5":120,"prop6":"dex","min6":5,"max6":15} |
| unique:159 | Ginther's Rift | 9cr | 1 | 0 | 100 | 45 | 37 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"red-mag","min1":7,"max1":12,"prop2":"swing2","min2":30,"max2":30,"prop3":"rep-dur","par3":20,"prop4":"dur","min4":40,"max4":40,"prop5":"dmg-mag","min5":50,"max5":120,"prop6":"dmg%","min6":100,"max6":150} |
| unique:160 | Headstriker | 9bs | 1 | 0 | 100 | 47 | 39 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"noheal","min1":1,"max1":1,"prop2":"str","min2":15,"max2":15,"prop3":"deadly/lvl","par3":12,"prop4":"dmg/lvl","par4":8,"prop5":"dmg%","min5":150,"max5":150} |
| unique:161 | Plague Bearer | 9ls | 1 | 0 | 100 | 49 | 41 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"hit-skill","par1":92,"min1":5,"max1":4,"prop2":"dmg-pois","par2":200,"min2":384,"max2":384,"prop3":"dmg-norm","min3":10,"max3":45,"prop4":"dmg%","min4":150,"max4":150,"prop5":"res-pois","min5":45,"max5":45,"prop6":"skill","par6":238,"min6":5,"max6":5} |
| unique:162 | The Atlantian | 9wd | 1 | 0 | 100 | 50 | 42 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dur","min1":100,"max1":100,"prop2":"ac","min2":75,"max2":75,"prop3":"str","min3":16,"max3":16,"prop4":"dex","min4":12,"max4":12,"prop5":"vit","min5":8,"max5":8,"prop6":"dmg%","min6":200,"max6":250,"prop7":"pal","min7":2,"max7":2,"prop8":"att%","min8":50,"max8":50} |
| unique:163 | Crainte Vomir | 92h | 1 | 0 | 100 | 50 | 42 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"slow","min1":35,"max1":35,"prop2":"dmg-ac","min2":-70,"max2":-70,"prop3":"move2","min3":20,"max3":20,"prop4":"red-dmg%","min4":10,"max4":10,"prop5":"dmg%","min5":160,"max5":200,"prop6":"swing3","min6":50,"max6":50} |
| unique:164 | Bing Sz Wang | 9cm | 1 | 0 | 100 | 51 | 43 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ease","min1":-30,"max1":-30,"prop2":"dmg-cold","par2":75,"min2":50,"max2":140,"prop3":"str","min3":20,"max3":20,"prop4":"freeze","min4":2,"max4":2,"prop5":"hit-skill","par5":64,"min5":5,"max5":3,"prop6":"dmg%","min6":130,"max6":160} |
| unique:165 | The Vile Husk | 9gs | 1 | 0 | 100 | 52 | 44 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"hit-skill","par1":66,"min1":6,"max1":1,"prop2":"dmg-und/lvl","par2":60,"prop3":"res-pois","min3":50,"max3":50,"prop4":"dmg-pois","par4":150,"min4":426,"max4":426,"prop5":"dmg%","min5":150,"max5":200,"prop6":"att-und/lvl","par6":20} |
| unique:166 | Cloudcrack | 9b9 | 1 | 0 | 100 | 53 | 45 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"hit-skill","par1":121,"min1":6,"max1":7,"prop2":"dmg-ltng","min2":1,"max2":240,"prop3":"ac","min3":30,"max3":30,"prop4":"light","min4":2,"max4":2,"prop5":"res-ltng-max","min5":10,"max5":10,"prop6":"dmg%","min6":150,"max6":200,"prop7":"light-thorns","min7":15,"max7":15,"prop8":"skilltab","par8":10,"min8":2,"max8":2,"prop9":"skilltab","par9":11,"min9":2,"max9":2} |
| unique:167 | Todesfaelle Flamme | 9fb | 1 | 0 | 100 | 54 | 46 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg-fire","min1":50,"max1":200,"prop2":"res-fire","min2":40,"max2":40,"prop3":"abs-fire","min3":10,"max3":10,"prop4":"att-skill","par4":47,"min4":10,"max4":6,"prop5":"dmg%","min5":120,"max5":160,"prop6":"charged","par6":52,"min6":45,"max6":10,"prop7":"charged","par7":51,"min7":20,"max7":10} |
| unique:168 | Swordguard | 9gd | 1 | 0 | 100 | 55 | 48 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ease","min1":-50,"max1":-50,"prop2":"ac/lvl","par2":40,"prop3":"res-all","min3":10,"max3":20,"prop4":"ac-miss","min4":100,"max4":100,"prop5":"dmg-to-mana","min5":30,"max5":30,"prop6":"dmg%","min6":170,"max6":180,"prop7":"ac-hth","min7":200,"max7":200,"prop8":"balance2","min8":20,"max8":20,"prop9":"block","min9":20,"max9":20} |
| unique:169 | Spineripper | 9dg | 1 | 0 | 100 | 40 | 32 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ignore-ac","min1":1,"max1":1,"prop2":"lifesteal","min2":8,"max2":8,"prop3":"noheal","min3":1,"max3":1,"prop4":"swing3","min4":15,"max4":15,"prop5":"dex","min5":10,"max5":10,"prop6":"dmg%","min6":200,"max6":240,"prop7":"dmg-norm","min7":15,"max7":27,"prop8":"nec","min8":1,"max8":1} |
| unique:170 | Heart Carver | 9di | 1 | 0 | 100 | 44 | 36 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"deadly","min1":35,"max1":35,"prop2":"ignore-ac","min2":1,"max2":1,"prop3":"dmg-norm","min3":15,"max3":35,"prop4":"dmg%","min4":190,"max4":240,"prop5":"skill","par5":131,"min5":4,"max5":4,"prop6":"skill","par6":142,"min6":4,"max6":4,"prop7":"skill","par7":150,"min7":4,"max7":4} |
| unique:171 | Blackbog's Sharp | 9kr | 1 | 0 | 100 | 46 | 38 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"slow","min1":50,"max1":50,"prop2":"ac","min2":50,"max2":50,"prop3":"dmg-norm","min3":15,"max3":45,"prop4":"swing3","min4":30,"max4":30,"prop5":"dmg-pois","par5":250,"min5":500,"max5":500,"prop6":"skill","par6":73,"min6":5,"max6":5,"prop7":"skill","par7":83,"min7":4,"max7":4,"prop8":"skill","par8":92,"min8":4,"max8":4} |
| unique:172 | Stormspike | 9bl | 1 | 0 | 100 | 49 | 41 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg-ltng","min1":1,"max1":120,"prop2":"light-thorns","min2":20,"max2":20,"prop3":"gethit-skill","par3":38,"min3":25,"max3":3,"prop4":"dmg%","min4":150,"max4":150,"prop5":"res-ltng/lvl","par5":8} |
| unique:173 | The Impaler | 9sr | 1 | 0 | 100 | 39 | 31 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ignore-ac","min1":1,"max1":1,"prop2":"att","min2":150,"max2":150,"prop3":"swing2","min3":20,"max3":20,"prop4":"openwounds","min4":40,"max4":40,"prop5":"noheal","min5":1,"max5":1,"prop6":"dmg%","min6":140,"max6":170,"prop7":"skill","par7":19,"min7":5,"max7":5,"prop8":"skill","par8":14,"min8":3,"max8":3} |
| unique:174 | Kelpie Snare | 9tr | 1 | 0 | 100 | 41 | 33 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"slow","min1":75,"max1":75,"prop2":"res-fire","min2":50,"max2":50,"prop3":"hp/lvl","par3":10,"prop4":"dmg-norm","min4":30,"max4":50,"prop5":"str","min5":10,"max5":10,"prop6":"dmg%","min6":140,"max6":180} |
| unique:175 | Soulfeast Tine | 9br | 1 | 0 | 100 | 43 | 35 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ease","min1":-20,"max1":-20,"prop2":"lifesteal","min2":7,"max2":7,"prop3":"manasteal","min3":7,"max3":7,"prop4":"stamdrain","min4":20,"max4":20,"prop5":"dmg%","min5":150,"max5":190,"prop6":"att","min6":150,"max6":250,"prop7":"dur","min7":15,"max7":15} |
| unique:176 | Hone Sundan | 9st | 1 | 0 | 100 | 45 | 37 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"sock","par1":3,"prop2":"dmg-norm","min2":20,"max2":40,"prop3":"crush","min3":45,"max3":45,"prop4":"rep-dur","par4":10,"prop5":"dmg%","min5":160,"max5":200} |
| unique:177 | Spire of Honor | 9p9 | 1 | 0 | 100 | 47 | 39 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"att%","min1":25,"max1":25,"prop2":"light","min2":3,"max2":3,"prop3":"regen","min3":20,"max3":20,"prop4":"balance2","min4":20,"max4":20,"prop5":"dmg-norm","min5":20,"max5":40,"prop6":"dmg-dem/lvl","par6":12,"prop7":"dmg%","min7":150,"max7":200,"prop8":"skilltab","par8":9,"min8":3,"max8":3,"prop9":"ac%","min9":25,"max9":25} |
| unique:178 | The Meat Scraper | 9b7 | 1 | 0 | 100 | 49 | 41 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg%","min1":150,"max1":200,"prop2":"swing2","min2":30,"max2":30,"prop3":"lifesteal","min3":10,"max3":10,"prop4":"openwounds","min4":50,"max4":50,"prop5":"mag%","min5":25,"max5":25,"prop6":"skilltab","par6":13,"min6":3,"max6":3} |
| unique:179 | Blackleach Blade | 9vo | 1 | 0 | 100 | 50 | 42 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ease","min1":-25,"max1":-25,"prop2":"hit-skill","par2":72,"min2":5,"max2":5,"prop3":"light","min3":-2,"max3":-2,"prop4":"lifesteal","min4":8,"max4":8,"prop5":"dmg/lvl","par5":10,"prop6":"dmg%","min6":100,"max6":140} |
| unique:180 | Athena's Wrath | 9s8 | 1 | 0 | 100 | 50 | 42 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dru","min1":1,"max1":3,"prop2":"dex","min2":15,"max2":15,"prop3":"swing2","min3":30,"max3":30,"prop4":"hp/lvl","par4":8,"prop5":"dmg/lvl","par5":8,"prop6":"dmg%","min6":150,"max6":180} |
| unique:181 | Pierre Tombale Couant | 9pa | 1 | 0 | 100 | 51 | 43 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"deadly","min1":55,"max1":55,"prop2":"bar","min2":3,"max2":3,"prop3":"balance2","min3":30,"max3":30,"prop4":"manasteal","min4":6,"max4":6,"prop5":"dmg-norm","min5":12,"max5":20,"prop6":"dmg%","min6":160,"max6":220,"prop7":"att","min7":100,"max7":200} |
| unique:182 | Husoldal Evo | 9h9 | 1 | 0 | 100 | 52 | 44 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"regen","min1":20,"max1":20,"prop2":"att","min2":200,"max2":250,"prop3":"noheal","min3":1,"max3":1,"prop4":"dmg-norm","min4":20,"max4":32,"prop5":"dmg%","min5":160,"max5":200,"prop6":"swing2","min6":20,"max6":20} |
| unique:183 | Grim's Burning Dead | 9wc | 1 | 0 | 100 | 52 | 45 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg-fire","min1":131,"max1":232,"prop2":"res-fire","min2":45,"max2":45,"prop3":"dmg%","min3":140,"max3":180,"prop4":"thorns","min4":8,"max4":8,"prop5":"ease","min5":-50,"max5":-50,"prop6":"nec","min6":3,"max6":3,"prop7":"reduce-ac","min7":50,"max7":50,"prop8":"ac%","min8":20,"max8":20,"prop9":"att","min9":200,"max9":250} |
| unique:184 | Razorswitch | 8ss | 1 | 0 | 100 | 36 | 28 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"cast3","min1":30,"max1":30,"prop2":"thorns","min2":15,"max2":15,"prop3":"mana","min3":175,"max3":175,"prop4":"hp","min4":80,"max4":80,"prop5":"red-mag","min5":15,"max5":15,"prop6":"res-all","min6":50,"max6":50,"prop7":"allskills","min7":1,"max7":1} |
| unique:185 | Ribcracker | 8ls | 1 | 0 | 100 | 39 | 31 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg-norm","min1":30,"max1":65,"prop2":"dmg%","min2":200,"max2":300,"prop3":"crush","min3":50,"max3":50,"prop4":"dex","min4":15,"max4":15,"prop5":"ac","min5":100,"max5":100,"prop6":"ac%","min6":100,"max6":100,"prop7":"balance2","min7":50,"max7":50,"prop8":"swing2","min8":50,"max8":50,"prop9":"dur","min9":100,"max9":100} |
| unique:186 | Chromatic Ire | 8cs | 1 | 0 | 100 | 43 | 35 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"sor","min1":3,"max1":3,"prop2":"res-all","min2":20,"max2":40,"prop3":"cast1","min3":20,"max3":20,"prop4":"light-thorns","min4":20,"max4":20,"prop5":"hp%","min5":20,"max5":25,"prop6":"skill","par6":61,"min6":1,"max6":1,"prop7":"skill","par7":63,"min7":1,"max7":1,"prop8":"skill","par8":65,"min8":1,"max8":1} |
| unique:187 | Warpspear | 8bs | 1 | 0 | 100 | 47 | 39 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"sor","min1":3,"max1":3,"prop2":"ignore-ac","min2":1,"max2":1,"prop3":"skill","par3":54,"min3":3,"max3":3,"prop4":"skill","par4":43,"min4":3,"max4":3,"prop5":"skill","par5":58,"min5":3,"max5":3,"prop6":"ac-miss","min6":250,"max6":250,"prop7":"*hit-skill","par7":54,"min7":50,"max7":1,"prop8":"*gethit-skill","par8":54,"min8":25,"max8":1} |
| unique:188 | Skullcollector | 8ws | 1 | 0 | 100 | 49 | 41 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"mana%","min1":20,"max1":20,"prop2":"mana-kill","min2":20,"max2":20,"prop3":"allskills","min3":2,"max3":2,"prop4":"mag%/lvl","par4":8} |
| unique:189 | Skystrike | 8sb | 1 | 0 | 100 | 36 | 28 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg-ltng","min1":1,"max1":250,"prop2":"att","min2":100,"max2":100,"prop3":"enr","min3":10,"max3":10,"prop4":"swing3","min4":30,"max4":30,"prop5":"dmg%","min5":150,"max5":200,"prop6":"hit-skill","par6":56,"min6":2,"max6":6,"prop7":"ama","min7":1,"max7":1} |
| unique:190 | Riphook | 8hb | 1 | 0 | 100 | 39 | 31 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"openwounds","min1":30,"max1":30,"prop2":"dmg%","min2":180,"max2":220,"prop3":"slow","min3":30,"max3":30,"prop4":"mana","min4":35,"max4":35,"prop5":"swing2","min5":30,"max5":30,"prop6":"lifesteal","min6":7,"max6":10} |
| unique:191 | Kuko Shakaku | 8lb | 1 | 0 | 100 | 41 | 33 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"skill","par1":27,"min1":3,"max1":3,"prop2":"explosivearrow","min2":7,"max2":7,"prop3":"dmg%","min3":150,"max3":180,"prop4":"pierce","min4":50,"max4":50,"prop5":"dmg-fire","min5":40,"max5":180,"prop6":"skilltab","min6":3,"max6":3} |
| unique:192 | Endlesshail | 8cb | 1 | 0 | 100 | 44 | 36 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"res-cold","min1":35,"max1":35,"prop2":"mana","min2":40,"max2":40,"prop3":"ac-miss","min3":50,"max3":50,"prop4":"skill","par4":26,"min4":3,"max4":5,"prop5":"dmg%","min5":180,"max5":220,"prop6":"dmg-cold","par6":75,"min6":15,"max6":30} |
| unique:193 | Whichwild String | 8s8 | 1 | 0 | 100 | 47 | 39 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"hit-skill","par1":66,"min1":2,"max1":5,"prop2":"res-all","min2":40,"max2":40,"prop3":"deadly/lvl","par3":8,"prop4":"dmg%","min4":150,"max4":170,"prop5":"magicarrow","min5":20,"max5":20,"prop6":"sock","par6":2} |
| unique:194 | Cliffkiller | 8l8 | 1 | 0 | 100 | 49 | 41 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ama","min1":2,"max1":2,"prop2":"dmg%","min2":190,"max2":230,"prop3":"ac-miss","min3":80,"max3":80,"prop4":"knock","min4":1,"max4":1,"prop5":"hp","min5":50,"max5":50,"prop6":"dmg-min","min6":5,"max6":10,"prop7":"dmg-max","min7":20,"max7":30} |
| unique:195 | Magewrath | 8sw | 1 | 0 | 100 | 51 | 43 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"manasteal","min1":15,"max1":15,"prop2":"red-mag","min2":9,"max2":13,"prop3":"skill","par3":22,"min3":3,"max3":3,"prop4":"att","min4":200,"max4":250,"prop5":"dex","min5":10,"max5":10,"prop6":"stupidity","min6":1,"max6":1,"prop7":"dmg-norm","min7":25,"max7":50,"prop8":"dmg%","min8":120,"max8":150,"prop9":"ama","min9":1,"max9":1} |
| unique:196 | Godstrike Arch | 8lw | 1 | 0 | 100 | 54 | 46 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg%","min1":200,"max1":250,"prop2":"att%","min2":100,"max2":150,"prop3":"dmg-undead","min3":100,"max3":200,"prop4":"dmg-demon","min4":100,"max4":200,"prop5":"hit-skill","par5":121,"min5":5,"max5":7,"prop6":"swing2","min6":50,"max6":50,"prop7":"regen","min7":12,"max7":12} |
| unique:197 | Langer Briser | 8lx | 1 | 0 | 100 | 40 | 32 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"knock","min1":1,"max1":1,"prop2":"dmg%","min2":170,"max2":200,"prop3":"mag%","min3":30,"max3":60,"prop4":"hp","min4":30,"max4":30,"prop5":"dmg-max","min5":10,"max5":30,"prop6":"openwounds","min6":33,"max6":33,"prop7":"dmg-ltng","min7":1,"max7":212} |
| unique:198 | Pus Spiter | 8mx | 1 | 0 | 100 | 44 | 36 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg-pois","par1":200,"min1":192,"max1":192,"prop2":"hit-skill","par2":91,"min2":4,"max2":1,"prop3":"nec","min3":2,"max3":2,"prop4":"ease","min4":-60,"max4":-60,"prop5":"gethit-skill","par5":92,"min5":9,"max5":6,"prop6":"swing2","min6":10,"max6":10,"prop7":"dmg%","min7":150,"max7":220,"prop8":"att/lvl","par8":10} |
| unique:199 | Buriza-Do Kyanon | 8hx | 1 | 0 | 100 | 59 | 41 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"pierce","min1":100,"max1":100,"prop2":"dex","min2":35,"max2":35,"prop3":"ac","min3":75,"max3":150,"prop4":"dmg/lvl","par4":20,"prop5":"swing2","min5":80,"max5":80,"prop6":"dmg%","min6":150,"max6":200,"prop7":"freeze","min7":3,"max7":3,"prop8":"dmg-cold","par8":200,"min8":32,"max8":196} |
| unique:200 | Demon Machine | 8rx | 1 | 0 | 100 | 57 | 49 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ac","min1":321,"max1":321,"prop2":"mana","min2":36,"max2":36,"prop3":"pierce","min3":66,"max3":66,"prop4":"explosivearrow","min4":6,"max4":6,"prop5":"dmg-max","min5":66,"max5":66,"prop6":"dmg%","min6":123,"max6":123,"prop7":"att","min7":632,"max7":632} |
| unique:202 | Peasent Crown | xap | 1 | 0 | 100 | 36 | 28 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"enr","min1":20,"max1":20,"prop2":"vit","min2":20,"max2":20,"prop3":"allskills","min3":1,"max3":1,"prop4":"move2","min4":15,"max4":15,"prop5":"regen","min5":6,"max5":12,"prop6":"ac%","min6":100,"max6":100} |
| unique:203 | Rockstopper | xkp | 1 | 0 | 100 | 39 | 31 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"res-ltng","min1":20,"max1":40,"prop2":"red-dmg%","min2":10,"max2":10,"prop3":"balance2","min3":30,"max3":30,"prop4":"ac%","min4":160,"max4":220,"prop5":"res-fire","min5":20,"max5":50,"prop6":"res-cold","min6":20,"max6":40,"prop7":"vit","min7":15,"max7":15} |
| unique:204 | Stealskull | xlm | 1 | 0 | 100 | 43 | 35 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"manasteal","min1":5,"max1":5,"prop2":"lifesteal","min2":5,"max2":5,"prop3":"balance2","min3":10,"max3":10,"prop4":"swing2","min4":10,"max4":10,"prop5":"ac%","min5":200,"max5":240,"prop6":"mag%","min6":30,"max6":50} |
| unique:205 | Darksight Helm | xhl | 1 | 0 | 100 | 46 | 38 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"light","min1":-4,"max1":-4,"prop2":"ac/lvl","par2":16,"prop3":"nofreeze","min3":1,"max3":1,"prop4":"manasteal","min4":5,"max4":5,"prop5":"gethit-skill","par5":71,"min5":6,"max5":3,"prop6":"charged","par6":264,"min6":30,"max6":5,"prop7":"res-fire","min7":20,"max7":40} |
| unique:206 | Valkiry Wing | xhm | 1 | 0 | 100 | 52 | 44 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ac%","min1":150,"max1":200,"prop2":"move2","min2":20,"max2":20,"prop3":"balance2","min3":20,"max3":20,"prop4":"ama","min4":1,"max4":2,"prop5":"mana-kill","min5":2,"max5":4} |
| unique:207 | Crown of Thieves | xrn | 1 | 0 | 100 | 57 | 49 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dex","min1":25,"max1":25,"prop2":"lifesteal","min2":9,"max2":12,"prop3":"hp","min3":50,"max3":50,"prop4":"mana","min4":35,"max4":35,"prop5":"res-fire","min5":33,"max5":33,"prop6":"ac%","min6":160,"max6":200,"prop7":"gold%","min7":80,"max7":100} |
| unique:208 | Blackhorn's Face | xsk | 1 | 0 | 100 | 49 | 41 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"light-thorns","min1":25,"max1":25,"prop2":"slow","min2":20,"max2":20,"prop3":"noheal","min3":1,"max3":1,"prop4":"abs-ltng","min4":20,"max4":20,"prop5":"res-ltng","min5":15,"max5":15,"prop6":"ac%","min6":180,"max6":220} |
| unique:209 | Vampiregaze | xh9 | 1 | 0 | 100 | 49 | 41 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"manasteal","min1":6,"max1":8,"prop2":"lifesteal","min2":6,"max2":8,"prop3":"stamdrain","min3":15,"max3":15,"prop4":"red-dmg%","min4":15,"max4":20,"prop5":"red-mag","min5":10,"max5":15,"prop6":"ac%","min6":100,"max6":100,"prop7":"dmg-cold","par7":100,"min7":6,"max7":22} |
| unique:210 | The Spirit Shroud | xui | 1 | 0 | 100 | 36 | 28 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"nofreeze","min1":1,"max1":1,"prop2":"allskills","min2":1,"max2":1,"prop3":"red-mag","min3":7,"max3":11,"prop4":"regen","min4":10,"max4":10,"prop5":"ac%","min5":150,"max5":150} |
| unique:211 | Skin of the Vipermagi | xea | 1 | 0 | 100 | 37 | 29 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ac%","min1":120,"max1":120,"prop2":"res-all","min2":20,"max2":35,"prop3":"cast3","min3":30,"max3":30,"prop4":"red-mag","min4":9,"max4":13,"prop5":"allskills","min5":1,"max5":1} |
| unique:212 | Skin of the Flayerd One | xla | 1 | 0 | 100 | 39 | 31 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"rep-dur","par1":10,"prop2":"regen","min2":15,"max2":25,"prop3":"dur","min3":30,"max3":30,"prop4":"lifesteal","min4":5,"max4":7,"prop5":"ac%","min5":150,"max5":190,"prop6":"thorns","min6":15,"max6":15} |
| unique:213 | Ironpelt | xtu | 1 | 0 | 100 | 41 | 33 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dur","min1":125,"max1":125,"prop2":"hp","min2":25,"max2":25,"prop3":"red-mag","min3":10,"max3":16,"prop4":"red-dmg","min4":15,"max4":20,"prop5":"ac/lvl","par5":24,"prop6":"ac%","min6":50,"max6":100} |
| unique:214 | Spiritforge | xng | 1 | 0 | 100 | 43 | 35 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"light","min1":4,"max1":4,"prop2":"hp/lvl","par2":10,"prop3":"dmg-fire","min3":20,"max3":65,"prop4":"res-fire","min4":5,"max4":5,"prop5":"ac%","min5":120,"max5":160,"prop6":"str","min6":15,"max6":15,"prop7":"sock","par7":2} |
| unique:215 | Crow Caw | xcl | 1 | 0 | 100 | 45 | 37 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"openwounds","min1":35,"max1":35,"prop2":"ac%","min2":150,"max2":180,"prop3":"dex","min3":15,"max3":15,"prop4":"balance2","min4":15,"max4":15,"prop5":"swing2","min5":15,"max5":15,"prop6":"*charged","par6":221,"min6":3,"max6":5} |
| unique:216 | Shaftstop | xhn | 1 | 0 | 100 | 46 | 38 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ac-miss","min1":250,"max1":250,"prop2":"red-dmg%","min2":30,"max2":30,"prop3":"hp","min3":60,"max3":60,"prop4":"ac%","min4":180,"max4":220} |
| unique:217 | Duriel's Shell | xrs | 1 | 0 | 100 | 49 | 41 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"str","min1":15,"max1":15,"prop2":"ac/lvl","par2":10,"prop3":"hp/lvl","par3":8,"prop4":"ac%","min4":160,"max4":200,"prop5":"res-fire","min5":20,"max5":20,"prop6":"res-ltng","min6":20,"max6":20,"prop7":"res-pois","min7":20,"max7":20,"prop8":"res-cold","min8":50,"max8":50,"prop9":"nofreeze","min9":1,"max9":1,"prop10":"dur","min10":100,"max10":100} |
| unique:218 | Skullder's Ire | xpl | 1 | 0 | 100 | 50 | 42 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"allskills","min1":1,"max1":1,"prop2":"mag%/lvl","par2":10,"prop3":"ac%","min3":160,"max3":200,"prop4":"dur","min4":60,"max4":60,"prop5":"red-mag","min5":10,"max5":10,"prop6":"rep-dur","par6":20,"prop7":"*vit","min7":-10,"max7":-10,"prop8":"*enr","min8":-10,"max8":-10} |
| unique:219 | Guardian Angel | xlt | 1 | 0 | 100 | 53 | 45 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"light","min1":4,"max1":4,"prop2":"pal","min2":1,"max2":1,"prop3":"ac%","min3":180,"max3":200,"prop4":"block2","min4":30,"max4":30,"prop5":"res-all-max","min5":15,"max5":15,"prop6":"att-dem/lvl","par6":5,"prop7":"block","min7":20,"max7":20} |
| unique:220 | Toothrow | xld | 1 | 0 | 100 | 56 | 48 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"thorns","min1":20,"max1":40,"prop2":"ac","min2":40,"max2":60,"prop3":"str","min3":10,"max3":10,"prop4":"openwounds","min4":40,"max4":40,"prop5":"res-fire","min5":15,"max5":15,"prop6":"ac%","min6":160,"max6":220,"prop7":"dur","min7":15,"max7":15} |
| unique:221 | Atma's Wail | xth | 1 | 0 | 100 | 59 | 51 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dex","min1":15,"max1":15,"prop2":"regen","min2":10,"max2":10,"prop3":"mana%","min3":15,"max3":15,"prop4":"balance2","min4":30,"max4":30,"prop5":"ac/lvl","par5":16,"prop6":"dur","min6":50,"max6":50,"prop7":"ac%","min7":120,"max7":160,"prop8":"mag%","min8":20,"max8":20} |
| unique:222 | Black Hades | xul | 1 | 0 | 100 | 61 | 53 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"light","min1":-2,"max1":-2,"prop2":"att-demon","min2":200,"max2":250,"prop3":"half-freeze","min3":1,"max3":1,"prop4":"sock","par4":3,"prop5":"ac%","min5":140,"max5":200,"prop6":"dmg-demon","min6":30,"max6":60} |
| unique:223 | Corpsemourn | xar | 1 | 0 | 100 | 63 | 55 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"str","min1":8,"max1":8,"prop2":"vit","min2":10,"max2":10,"prop3":"res-cold","min3":35,"max3":35,"prop4":"gethit-skill","par4":76,"min4":6,"max4":2,"prop5":"ac%","min5":150,"max5":180,"prop6":"dmg-fire","min6":12,"max6":36,"prop7":"charged","par7":74,"min7":40,"max7":5} |
| unique:224 | Que-Hegan's Wisdon | xtp | 1 | 0 | 100 | 59 | 51 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"cast2","min1":20,"max1":20,"prop2":"mana-kill","min2":3,"max2":3,"prop3":"red-mag","min3":6,"max3":10,"prop4":"enr","min4":15,"max4":15,"prop5":"balance2","min5":20,"max5":20,"prop6":"ac%","min6":140,"max6":160,"prop7":"allskills","min7":1,"max7":1} |
| unique:225 | Visceratuant | xuc | 1 | 0 | 100 | 36 | 28 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"sor","min1":1,"max1":1,"prop2":"block2","min2":30,"max2":30,"prop3":"block","min3":30,"max3":30,"prop4":"ac%","min4":100,"max4":150,"prop5":"light-thorns","min5":10,"max5":10} |
| unique:226 | Mosers Blessed Circle | xml | 1 | 0 | 100 | 39 | 31 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"res-all","min1":25,"max1":25,"prop2":"block","min2":25,"max2":25,"prop3":"sock","par3":2,"prop4":"ac%","min4":180,"max4":220,"prop5":"block2","min5":30,"max5":30} |
| unique:227 | Stormchaser | xrg | 1 | 0 | 100 | 43 | 35 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg-ltng","min1":1,"max1":60,"prop2":"block","min2":20,"max2":20,"prop3":"half-freeze","min3":1,"max3":1,"prop4":"res-ltng","min4":50,"max4":50,"prop5":"att","min5":150,"max5":150,"prop6":"ac%","min6":160,"max6":220,"prop7":"block2","min7":10,"max7":10,"prop8":"gethit-skill","par8":59,"min8":4,"max8":6,"prop9":"gethit-skill","par9":245,"min9":4,"max9":5} |
| unique:228 | Tiamat's Rebuke | xit | 1 | 0 | 100 | 46 | 38 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg-cold","par1":150,"min1":27,"max1":53,"prop2":"dmg-fire","min2":35,"max2":95,"prop3":"dmg-ltng","min3":1,"max3":120,"prop4":"res-all","min4":25,"max4":35,"prop5":"ac%","min5":140,"max5":200,"prop6":"gethit-skill","par6":44,"min6":5,"max6":9,"prop7":"gethit-skill","par7":48,"min7":5,"max7":7,"prop8":"gethit-skill","par8":62,"min8":3,"max8":6,"prop9":"dur","min9":40,"max9":40} |
| unique:229 | Kerke's Sanctuary | xow | 1 | 0 | 100 | 52 | 44 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"red-dmg","min1":11,"max1":16,"prop2":"red-mag","min2":14,"max2":18,"prop3":"regen","min3":15,"max3":15,"prop4":"ac%","min4":180,"max4":240,"prop5":"dur","min5":100,"max5":100,"prop6":"block","min6":30,"max6":30,"prop7":"res-all","min7":20,"max7":30} |
| unique:230 | Radimant's Sphere | xts | 1 | 0 | 100 | 58 | 50 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg-pois","par1":100,"min1":204,"max1":204,"prop2":"gethit-skill","par2":92,"min2":5,"max2":5,"prop3":"res-pois","min3":75,"max3":75,"prop4":"ac%","min4":160,"max4":200,"prop5":"block","min5":20,"max5":20,"prop6":"block2","min6":20,"max6":20,"prop7":"charged","par7":83,"min7":40,"max7":6,"prop8":"dur","min8":20,"max8":20} |
| unique:231 | Lidless Wall | xsh | 1 | 0 | 100 | 49 | 41 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"light","min1":1,"max1":1,"prop2":"allskills","min2":1,"max2":1,"prop3":"cast2","min3":20,"max3":20,"prop4":"mana-kill","min4":3,"max4":5,"prop5":"ac%","min5":80,"max5":130,"prop6":"enr","min6":10,"max6":10,"prop7":"mana%","min7":10,"max7":10} |
| unique:232 | Lance Guard | xpk | 1 | 0 | 100 | 43 | 35 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"hp","min1":50,"max1":50,"prop2":"balance2","min2":30,"max2":30,"prop3":"dmg-to-mana","min3":15,"max3":15,"prop4":"thorns","min4":47,"max4":47,"prop5":"ac%","min5":70,"max5":120,"prop6":"deadly","min6":20,"max6":20} |
| unique:233 | Venom Grip | xlg | 1 | 0 | 100 | 37 | 29 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"res-pois","min1":30,"max1":30,"prop2":"res-pois-max","min2":5,"max2":5,"prop3":"dmg-pois","par3":100,"min3":153,"max3":153,"prop4":"crush","min4":5,"max4":5,"prop5":"lifesteal","min5":5,"max5":5,"prop6":"ac","min6":15,"max6":25,"prop7":"ac%","min7":130,"max7":160} |
| unique:234 | Gravepalm | xvg | 1 | 0 | 100 | 39 | 32 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"enr","min1":10,"max1":10,"prop2":"str","min2":10,"max2":10,"prop3":"dmg-undead","min3":100,"max3":200,"prop4":"att-undead","min4":100,"max4":200,"prop5":"ac%","min5":140,"max5":180} |
| unique:235 | Ghoulhide | xmg | 1 | 0 | 100 | 44 | 36 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"att-und/lvl","par1":16,"prop2":"dmg-und/lvl","par2":16,"prop3":"manasteal","min3":4,"max3":5,"prop4":"hp","min4":20,"max4":20,"prop5":"ac%","min5":150,"max5":190} |
| unique:236 | Lavagout | xtg | 1 | 0 | 100 | 50 | 42 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"res-fire","min1":24,"max1":24,"prop2":"half-freeze","min2":1,"max2":1,"prop3":"hit-skill","par3":52,"min3":2,"max3":10,"prop4":"swing2","min4":20,"max4":20,"prop5":"ac%","min5":150,"max5":200,"prop6":"dmg-fire","min6":13,"max6":46,"prop7":"dur","min7":20,"max7":20} |
| unique:237 | Hellmouth | xhg | 1 | 0 | 100 | 55 | 47 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg-fire","min1":15,"max1":72,"prop2":"abs-fire","min2":15,"max2":15,"prop3":"ac%","min3":150,"max3":200,"prop4":"dur","min4":15,"max4":15,"prop5":"hit-skill","par5":56,"min5":2,"max5":4,"prop6":"hit-skill","par6":225,"min6":4,"max6":12} |
| unique:238 | Infernostride | xlb | 1 | 0 | 100 | 37 | 29 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg-fire","min1":12,"max1":33,"prop2":"move2","min2":20,"max2":20,"prop3":"res-fire-max","min3":10,"max3":10,"prop4":"res-fire","min4":30,"max4":30,"prop5":"light","min5":2,"max5":2,"prop6":"ac%","min6":120,"max6":150,"prop7":"gold%","min7":40,"max7":70,"prop8":"ac","min8":15,"max8":15,"prop9":"gethit-skill","par9":46,"min9":5,"max9":8} |
| unique:239 | Waterwalk | xvb | 1 | 0 | 100 | 40 | 32 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ac-miss","min1":100,"max1":100,"prop2":"move2","min2":20,"max2":20,"prop3":"dex","min3":15,"max3":15,"prop4":"ac%","min4":180,"max4":210,"prop5":"hp","min5":45,"max5":65,"prop6":"stam","min6":40,"max6":40,"prop7":"res-fire-max","min7":5,"max7":5,"prop8":"regen-stam","min8":50,"max8":50} |
| unique:240 | Silkweave | xmb | 1 | 0 | 100 | 44 | 36 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ac%","min1":150,"max1":190,"prop2":"mana-kill","min2":5,"max2":5,"prop3":"ac-miss","min3":200,"max3":200,"prop4":"mana%","min4":10,"max4":10,"prop5":"move2","min5":30,"max5":30} |
| unique:241 | Wartraveler | xtb | 1 | 0 | 100 | 50 | 42 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"vit","min1":10,"max1":10,"prop2":"str","min2":10,"max2":10,"prop3":"mag%","min3":30,"max3":50,"prop4":"dur","min4":30,"max4":30,"prop5":"move2","min5":25,"max5":25,"prop6":"ac%","min6":150,"max6":190,"prop7":"dmg-norm","min7":15,"max7":25,"prop8":"thorns","min8":5,"max8":10,"prop9":"stamdrain","min9":40,"max9":40} |
| unique:242 | Gorerider | xhb | 1 | 0 | 100 | 55 | 47 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ease","min1":-25,"max1":-25,"prop2":"deadly","min2":15,"max2":15,"prop3":"move2","min3":30,"max3":30,"prop4":"crush","min4":15,"max4":15,"prop5":"openwounds","min5":10,"max5":10,"prop6":"ac%","min6":160,"max6":200,"prop7":"dur","min7":10,"max7":10,"prop8":"stam","min8":20,"max8":20} |
| unique:243 | String of Ears | zlb | 1 | 0 | 100 | 37 | 29 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"red-mag","min1":10,"max1":15,"prop2":"red-dmg%","min2":10,"max2":15,"prop3":"lifesteal","min3":6,"max3":8,"prop4":"ac%","min4":150,"max4":180,"prop5":"ac","min5":15,"max5":15,"prop6":"dur","min6":10,"max6":10} |
| unique:244 | Razortail | zvb | 1 | 0 | 100 | 39 | 32 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"thorns/lvl","par1":8,"prop2":"dex","min2":15,"max2":15,"prop3":"pierce","min3":33,"max3":33,"prop4":"ac","min4":15,"max4":15,"prop5":"ac%","min5":120,"max5":150,"prop6":"dmg-max","min6":10,"max6":10} |
| unique:245 | Gloomstrap | zmb | 1 | 0 | 100 | 45 | 36 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"light","min1":-3,"max1":-3,"prop2":"mana%","min2":15,"max2":15,"prop3":"manasteal","min3":5,"max3":5,"prop4":"ac%","min4":120,"max4":150,"prop5":"vit","min5":15,"max5":15,"prop6":"regen-mana","min6":15,"max6":15} |
| unique:246 | Snowclash | ztb | 1 | 0 | 100 | 49 | 42 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"gethit-skill","par1":59,"min1":5,"prop2":"abs-cold","min2":15,"max2":15,"prop3":"res-cold-max","min3":15,"max3":15,"prop4":"dmg-cold","par4":75,"min4":13,"max4":21,"prop5":"ac%","min5":130,"max5":170,"prop6":"skill","par6":59,"min6":2,"max6":2,"prop7":"skill","par7":55,"min7":3,"max7":3,"prop8":"skill","par8":60,"min8":2,"max8":2} |
| unique:247 | Thudergod's Vigor | zhb | 1 | 0 | 100 | 55 | 47 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"gethit-skill","par1":121,"min1":5,"max1":7,"prop2":"dmg-ltng","min2":1,"max2":50,"prop3":"res-ltng-max","min3":10,"max3":10,"prop4":"abs-ltng","min4":20,"max4":20,"prop5":"ac%","min5":160,"max5":200,"prop6":"vit","min6":20,"max6":20,"prop7":"str","min7":20,"max7":20,"prop8":"skill","par8":34,"min8":3,"max8":3,"prop9":"skill","par9":35,"min9":3,"max9":3} |
| unique:249 | Harlequin Crest | uap | 1 | 0 | 100 | 69 | 62 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"allskills","min1":2,"max1":2,"prop2":"hp/lvl","par2":12,"prop3":"mana/lvl","par3":12,"prop4":"mag%","min4":50,"max4":50,"prop5":"red-dmg%","min5":10,"max5":10,"prop6":"str","min6":2,"max6":2,"prop7":"dex","min7":2,"max7":2,"prop8":"vit","min8":2,"max8":2,"prop9":"enr","min9":2,"max9":2} |
| unique:250 | Veil of Steel | uhm | 1 | 0 | 100 | 77 | 73 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"res-all","min1":50,"max1":50,"prop2":"ac%","min2":60,"max2":60,"prop3":"str","min3":15,"max3":15,"prop4":"vit","min4":15,"max4":15,"prop5":"light","min5":-4,"max5":-4,"prop6":"dur","min6":20,"max6":20,"prop7":"ac","min7":140,"max7":140,"prop8":"*mana","min8":-30,"max8":-30} |
| unique:251 | The Gladiator's Bane | utu | 1 | 0 | 100 | 85 | 85 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ac%","min1":150,"max1":200,"prop2":"red-mag","min2":15,"max2":20,"prop3":"red-dmg","min3":15,"max3":20,"prop4":"thorns","min4":20,"max4":20,"prop5":"res-pois-len","min5":50,"max5":50,"prop6":"dur","min6":103,"max6":103,"prop7":"balance2","min7":30,"max7":30,"prop8":"ac","min8":50,"max8":50,"prop9":"nofreeze","min9":1,"max9":1} |
| unique:252 | Arkaine's Valor | upl | 1 | 0 | 100 | 85 | 85 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ac%","min1":150,"max1":180,"prop2":"balance2","min2":30,"max2":30,"prop3":"allskills","min3":1,"max3":2,"prop4":"red-dmg","min4":10,"max4":15,"prop5":"vit/lvl","par5":4} |
| unique:253 | Blackoak Shield | uml | 1 | 0 | 100 | 67 | 61 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dex/lvl","par1":4,"prop2":"ac%","min2":160,"max2":200,"prop3":"abs-cold/lvl","par3":5,"prop4":"gethit-skill","par4":72,"min4":4,"max4":5,"prop5":"dur","min5":45,"max5":45,"prop6":"hp/lvl","par6":10,"prop7":"block2","min7":50,"max7":50,"prop8":"half-freeze","min8":1,"max8":1} |
| unique:254 | Stormshield | uit | 1 | 0 | 100 | 77 | 73 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ac/lvl","par1":30,"prop2":"red-dmg%","min2":35,"max2":35,"prop3":"str","min3":30,"max3":30,"prop4":"indestruct","min4":1,"max4":1,"prop5":"block2","min5":35,"max5":35,"prop6":"res-ltng","min6":25,"max6":25,"prop7":"block","min7":25,"max7":25,"prop8":"res-cold","min8":60,"max8":60,"prop9":"light-thorns","min9":10,"max9":10} |
| unique:255 | Hellslayer | 7bt | 1 | 0 | 100 | 71 | 66 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"str/lvl","par1":4,"prop2":"vit/lvl","par2":4,"prop3":"dmg%/lvl","par3":24,"prop4":"dmg-fire","min4":150,"max4":250,"prop5":"hp","min5":25,"max5":25,"prop6":"dmg%","min6":100,"max6":100,"prop7":"att-skill","par7":47,"min7":10,"prop8":"*mana","min8":-25,"max8":-25} |
| unique:256 | Messerschmidt's Reaver | 7ga | 1 | 0 | 100 | 75 | 70 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg%/lvl","par1":20,"prop2":"dmg%","min2":200,"max2":200,"prop3":"str","min3":15,"max3":15,"prop4":"dex","min4":15,"max4":15,"prop5":"vit","min5":15,"max5":15,"prop6":"enr","min6":15,"max6":15,"prop7":"dmg-fire","min7":20,"max7":240,"prop8":"dur","min8":25,"max8":25,"prop9":"att%","min9":100,"max9":100} |
| unique:257 | Baranar's Star | 7mt | 1 | 0 | 100 | 70 | 65 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"att%","min1":200,"max1":200,"prop2":"dmg%","min2":200,"max2":200,"prop3":"dex","min3":15,"max3":15,"prop4":"str","min4":15,"max4":15,"prop5":"swing2","min5":50,"max5":50,"prop6":"dur","min6":100,"max6":100,"prop7":"dmg-ltng","min7":1,"max7":200,"prop8":"dmg-fire","min8":1,"max8":200,"prop9":"dmg-cold","min9":1,"max9":200} |
| unique:258 | Schaefer's Hammer | 7wh | 1 | 0 | 100 | 83 | 79 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"hit-skill","par1":42,"min1":20,"max1":10,"prop2":"hp","min2":50,"max2":50,"prop3":"att/lvl","par3":16,"prop4":"res-ltng","min4":75,"max4":75,"prop5":"swing2","min5":20,"max5":20,"prop6":"dmg/lvl","par6":16,"prop7":"indestruct","min7":1,"max7":1,"prop8":"dmg%","min8":100,"max8":130,"prop9":"light","min9":1,"max9":1,"prop10":"dmg-ltng","min10":50,"max10":200} |
| unique:259 | The Cranium Basher | 7gm | 1 | 0 | 100 | 85 | 87 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"swing2","min1":20,"max1":20,"prop2":"indestruct","min2":1,"max2":1,"prop3":"str","min3":25,"max3":25,"prop4":"res-all","min4":25,"max4":25,"prop5":"crush","min5":75,"max5":75,"prop6":"dmg-norm","min6":20,"max6":20,"prop7":"dmg%","min7":200,"max7":240,"prop8":"hit-skill","par8":66,"min8":4,"max8":1,"prop9":"*mana","min9":-30,"max9":-30} |
| unique:260 | Lightsabre | 7cr | 1 | 0 | 100 | 66 | 58 | 5 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"light","min1":7,"max1":7,"prop2":"att-skill","par2":53,"min2":5,"prop3":"ignore-ac","par3":1,"min3":1,"max3":1,"prop4":"abs-ltng%","min4":25,"max4":25,"prop5":"swing2","min5":20,"max5":20,"prop6":"dmg-mag","min6":60,"max6":120,"prop7":"dmg-ltng","min7":1,"max7":200,"prop8":"manasteal","min8":5,"max8":7,"prop9":"dmg%","min9":150,"max9":200,"prop10":"dmg-norm","min10":10,"max10":30} |
| unique:261 | Doombringer | 7b7 | 1 | 0 | 100 | 75 | 69 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"hp%","min1":20,"max1":20,"prop2":"dmg%","min2":180,"max2":250,"prop3":"att%","min3":40,"max3":40,"prop4":"indestruct","min4":1,"max4":1,"prop5":"dmg-norm","min5":30,"max5":100,"prop6":"hit-skill","par6":72,"min6":8,"max6":3,"prop7":"lifesteal","min7":5,"max7":7} |
| unique:262 | The Grandfather | 7gd | 1 | 0 | 100 | 85 | 81 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"str","min1":20,"max1":20,"prop2":"dex","min2":20,"max2":20,"prop3":"vit","min3":20,"max3":20,"prop4":"enr","min4":20,"max4":20,"prop5":"att%","min5":50,"max5":50,"prop6":"hp","min6":80,"max6":80,"prop7":"dmg/lvl","par7":20,"prop8":"indestruct","min8":1,"max8":1,"prop9":"dmg%","min9":150,"max9":250} |
| unique:263 | Wizardspike | 7dg | 1 | 0 | 100 | 69 | 61 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"mana/lvl","par1":16,"prop2":"regen-mana","min2":15,"max2":15,"prop3":"mana%","min3":15,"max3":15,"prop4":"res-all","min4":75,"max4":75,"prop5":"indestruct","min5":1,"max5":1,"prop6":"cast3","min6":50,"max6":50} |
| unique:264 | Constricting Ring | rin | 0 | 0 | 100 | 95 | 95 | 1 | 原始禁用（enabled≠1）；仅定义，未接入执行 | {"prop1":"res-all","min1":100,"max1":100,"prop2":"regen","min2":-30,"max2":-30,"prop3":"mag%","min3":100,"max3":100,"prop4":"res-all-max","min4":15,"max4":15} |
| unique:265 | Stormspire | 7wc | 1 | 0 | 100 | 78 | 70 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"res-ltng","min1":50,"max1":50,"prop2":"gethit-skill","par2":53,"min2":5,"max2":5,"prop3":"dmg%","min3":150,"max3":250,"prop4":"str","min4":10,"max4":10,"prop5":"gethit-skill","par5":38,"min5":2,"prop6":"swing2","min6":30,"max6":30,"prop7":"indestruct","min7":1,"max7":1,"prop8":"dmg-ltng","min8":1,"max8":237,"prop9":"light-thorns","min9":27,"max9":27,"prop10":"*enr","min10":-10,"max10":-10} |
| unique:266 | Eaglehorn | 6l7 | 1 | 0 | 100 | 77 | 69 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ignore-ac","min1":1,"max1":1,"prop2":"att/lvl","par2":12,"prop3":"dmg%/lvl","par3":16,"prop4":"dmg%","min4":200,"max4":200,"prop5":"ama","min5":1,"max5":1,"prop6":"dex","min6":25,"max6":25} |
| unique:267 | Windforce | 6lw | 1 | 0 | 100 | 80 | 73 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dex","min1":5,"max1":5,"prop2":"dmg/lvl","par2":25,"prop3":"regen-stam","min3":30,"max3":30,"prop4":"manasteal","min4":6,"max4":8,"prop5":"knock","min5":1,"max5":1,"prop6":"dmg%","min6":250,"max6":250,"prop7":"swing2","min7":20,"max7":20,"prop8":"str","min8":10,"max8":10} |
| unique:269 | Bul Katho's Wedding Band | rin | 1 | 0 | 100 | 66 | 58 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"hp/lvl","par1":4,"prop2":"allskills","min2":1,"max2":1,"prop3":"lifesteal","min3":3,"max3":5,"prop4":"stam","min4":50,"max4":50} |
| unique:270 | The Cat's Eye | amu | 1 | 0 | 100 | 58 | 50 | 5 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"move2","min1":30,"max1":30,"prop2":"swing2","min2":20,"max2":20,"prop3":"ac","min3":100,"max3":100,"prop4":"ac-miss","min4":100,"max4":100,"prop5":"dex","min5":25,"max5":25} |
| unique:271 | The Rising Sun | amu | 1 | 0 | 100 | 73 | 65 | 5 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"abs-fire/lvl","par1":6,"prop2":"light","min2":4,"max2":4,"prop3":"gethit-skill","par3":56,"min3":2,"prop4":"dmg-fire","min4":24,"max4":48,"prop5":"fireskill","min5":2,"max5":2,"prop6":"regen","min6":10,"max6":10} |
| unique:272 | Crescent Moon | amu | 1 | 0 | 100 | 58 | 50 | 5 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"manasteal","min1":11,"max1":15,"prop2":"red-mag","min2":10,"max2":10,"prop3":"dmg-to-mana","min3":10,"max3":10,"prop4":"light","min4":-2,"max4":-2,"prop5":"mana","min5":45,"max5":45,"prop6":"lifesteal","min6":3,"max6":6} |
| unique:273 | Mara's Kaleidoscope | amu | 1 | 0 | 100 | 80 | 67 | 5 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"allskills","min1":2,"max1":2,"prop2":"res-all","min2":20,"max2":30,"prop3":"str","min3":5,"max3":5,"prop4":"dex","min4":5,"max4":5,"prop5":"vit","min5":5,"max5":5,"prop6":"enr","min6":5,"max6":5} |
| unique:274 | Atma's Scarab | amu | 1 | 0 | 100 | 60 | 60 | 5 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg-pois","par1":100,"min1":102,"max1":102,"prop2":"res-pois","min2":75,"max2":75,"prop3":"light","min3":3,"max3":3,"prop4":"thorns","min4":5,"max4":5,"prop5":"hit-skill","par5":66,"min5":5,"max5":2,"prop6":"att%","min6":20,"max6":20} |
| unique:275 | Dwarf Star | rin | 1 | 0 | 100 | 53 | 45 | 10 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"gold%","min1":100,"max1":100,"prop2":"stam","min2":40,"max2":40,"prop3":"regen-stam","min3":15,"max3":15,"prop4":"hp","min4":40,"max4":40,"prop5":"red-mag","min5":12,"max5":15,"prop6":"abs-fire%","min6":15,"max6":15} |
| unique:276 | Raven Frost | rin | 1 | 0 | 100 | 53 | 45 | 10 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"nofreeze","min1":1,"max1":1,"prop2":"dmg-cold","par2":100,"min2":15,"max2":45,"prop3":"abs-cold%","min3":20,"max3":20,"prop4":"mana","min4":40,"max4":40,"prop5":"dex","min5":15,"max5":20,"prop6":"att","min6":150,"max6":250} |
| unique:277 | Highlord's Wrath | amu | 1 | 0 | 100 | 73 | 65 | 5 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"res-ltng","min1":35,"max1":35,"prop2":"dmg-ltng","min2":1,"max2":30,"prop3":"swing2","min3":20,"max3":20,"prop4":"allskills","min4":1,"max4":1,"prop5":"deadly/lvl","par5":3,"prop6":"light-thorns","min6":15,"max6":15} |
| unique:278 | Saracen's Chance | amu | 1 | 0 | 100 | 55 | 47 | 5 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"res-all","min1":15,"max1":25,"prop2":"gethit-skill","par2":76,"min2":10,"max2":2,"prop3":"str","min3":12,"max3":12,"prop4":"dex","min4":12,"max4":12,"prop5":"enr","min5":12,"max5":12,"prop6":"vit","min6":12,"max6":12} |
| unique:280 | Arreat's Face | baa | 1 | 0 | 100 | 50 | 42 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"bar","min1":2,"max1":2,"prop2":"skilltab","par2":12,"min2":2,"max2":2,"prop3":"ac%","min3":150,"max3":200,"prop4":"balance2","min4":30,"max4":30,"prop5":"att%","min5":20,"max5":20,"prop6":"str","min6":20,"max6":20,"prop7":"dex","min7":20,"max7":20,"prop8":"lifesteal","min8":3,"max8":6,"prop9":"res-all","min9":30,"max9":30} |
| unique:281 | Homunculus | nea | 1 | 0 | 100 | 50 | 42 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"nec","min1":2,"max1":2,"prop2":"skilltab","par2":6,"min2":2,"max2":2,"prop3":"ac%","min3":150,"max3":200,"prop4":"block2","min4":30,"max4":30,"prop5":"block","min5":40,"max5":40,"prop6":"enr","min6":20,"max6":20,"prop7":"regen-mana","min7":33,"max7":33,"prop8":"mana-kill","min8":5,"max8":5,"prop9":"res-all","min9":40,"max9":40} |
| unique:282 | Titan's Revenge | ama | 1 | 0 | 100 | 50 | 42 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ama","min1":2,"max1":2,"prop2":"skilltab","par2":2,"min2":2,"max2":2,"prop3":"dmg%","min3":150,"max3":200,"prop4":"move2","min4":30,"max4":30,"prop5":"rep-quant","par5":30,"prop6":"str","min6":20,"max6":20,"prop7":"dex","min7":20,"max7":20,"prop8":"lifesteal","min8":5,"max8":9,"prop9":"dmg-norm","min9":25,"max9":50,"prop10":"stack","min10":60,"max10":60} |
| unique:283 | Lycander's Aim | am7 | 1 | 0 | 100 | 50 | 42 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ama","min1":2,"max1":2,"prop2":"skilltab","min2":2,"max2":2,"prop3":"dmg%","min3":150,"max3":200,"prop4":"swing2","min4":20,"max4":20,"prop5":"ac%","min5":20,"max5":20,"prop6":"dex","min6":20,"max6":20,"prop7":"enr","min7":20,"max7":20,"prop8":"manasteal","min8":5,"max8":8,"prop9":"dmg-norm","min9":25,"max9":50} |
| unique:284 | Lycander's Flank | am9 | 1 | 0 | 100 | 50 | 42 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ama","min1":2,"max1":2,"prop2":"skilltab","par2":2,"min2":2,"max2":2,"prop3":"dmg%","min3":150,"max3":200,"prop4":"swing2","min4":30,"max4":30,"prop5":"ac%","min5":20,"max5":20,"prop6":"str","min6":20,"max6":20,"prop7":"vit","min7":20,"max7":20,"prop8":"lifesteal","min8":5,"max8":9,"prop9":"dmg-norm","min9":25,"max9":50} |
| unique:285 | The Oculus | oba | 1 | 0 | 100 | 50 | 42 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"sor","min1":3,"max1":3,"prop2":"gethit-skill","par2":54,"min2":25,"max2":1,"prop3":"res-all","min3":20,"max3":20,"prop4":"cast2","min4":30,"max4":30,"prop5":"ac%","min5":20,"max5":20,"prop6":"vit","min6":20,"max6":20,"prop7":"enr","min7":20,"max7":20,"prop8":"mana-kill","min8":5,"max8":5,"prop9":"mag%","min9":50,"max9":50} |
| unique:286 | Herald of Zakarum | pa9 | 1 | 0 | 100 | 50 | 42 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"pal","min1":2,"max1":2,"prop2":"skilltab","par2":9,"min2":2,"max2":2,"prop3":"ac%","min3":150,"max3":200,"prop4":"block2","min4":30,"max4":30,"prop5":"block","min5":30,"max5":30,"prop6":"str","min6":20,"max6":20,"prop7":"vit","min7":20,"max7":20,"prop8":"att%","min8":20,"max8":20,"prop9":"res-all","min9":50,"max9":50} |
| unique:287 | Cutthroat1 | 9tw | 1 | 0 | 100 | 50 | 42 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ass","min1":2,"max1":2,"prop2":"skilltab","par2":20,"min2":1,"max2":1,"prop3":"dmg%","min3":150,"max3":200,"prop4":"balance2","min4":30,"max4":30,"prop5":"att%","min5":20,"max5":20,"prop6":"str","min6":20,"max6":20,"prop7":"dex","min7":20,"max7":20,"prop8":"lifesteal","min8":5,"max8":9,"prop9":"dmg-norm","min9":25,"max9":50} |
| unique:288 | Jalal's Mane | dra | 1 | 0 | 100 | 50 | 42 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dru","min1":2,"max1":2,"prop2":"skilltab","par2":16,"min2":2,"max2":2,"prop3":"ac%","min3":150,"max3":200,"prop4":"balance2","min4":30,"max4":30,"prop5":"att%","min5":20,"max5":20,"prop6":"str","min6":20,"max6":20,"prop7":"enr","min7":20,"max7":20,"prop8":"mana-kill","min8":5,"max8":5,"prop9":"res-all","min9":30,"max9":30} |
| unique:289 | The Scalper | 9ta | 1 | 0 | 100 | 65 | 57 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"rep-quant","par1":30,"prop2":"dmg%","min2":150,"max2":200,"prop3":"att%","min3":25,"max3":25,"prop4":"swing2","min4":20,"max4":20,"prop5":"openwounds","min5":33,"max5":33,"prop6":"lifesteal","min6":4,"max6":6,"prop7":"mana-kill","min7":4,"max7":4} |
| unique:290 | Bloodmoon | 7sb | 1 | 0 | 100 | 69 | 61 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg%","min1":210,"max1":260,"prop2":"lifesteal","min2":10,"max2":15,"prop3":"charged","par3":"BloodGolem","min3":9,"max3":15,"prop4":"heal-kill","min4":7,"max4":13,"prop5":"openwounds","min5":50,"max5":50} |
| unique:291 | Djinnslayer | 7sm | 1 | 1 | 100 | 73 | 65 | 1 | 运行时候选，受等级与稀有度限制；天梯标记不限制原版离线暗金生成；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg%","min1":190,"max1":240,"prop2":"dmg-fire","min2":250,"max2":500,"prop3":"dmg-demon","min3":100,"max3":150,"prop4":"att-demon","min4":200,"max4":300,"prop5":"abs-ltng","min5":3,"max5":7,"prop6":"manasteal","min6":3,"max6":6,"prop7":"sock","min7":1,"max7":2} |
| unique:292 | Deathbit | 9tk | 1 | 0 | 100 | 52 | 44 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"deadly","min1":40,"max1":40,"prop2":"dmg%","min2":130,"max2":180,"prop3":"att","min3":200,"max3":450,"prop4":"lifesteal","min4":7,"max4":9,"prop5":"manasteal","min5":4,"max5":6,"prop6":"rep-quant","par6":25} |
| unique:293 | Warshrike | 7bk | 1 | 1 | 100 | 83 | 75 | 1 | 运行时候选，受等级与稀有度限制；天梯标记不限制原版离线暗金生成；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg%","min1":200,"max1":250,"prop2":"pierce","min2":50,"max2":50,"prop3":"swing2","min3":30,"max3":30,"prop4":"deadly","min4":50,"max4":50,"prop5":"rep-quant","par5":30,"prop6":"hit-skill","par6":"Nova","min6":25,"max6":9} |
| unique:294 | Gutsiphon | 6rx | 1 | 0 | 100 | 79 | 71 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg%","min1":160,"max1":220,"prop2":"pierce","min2":33,"max2":33,"prop3":"lifesteal","min3":12,"max3":18,"prop4":"slow","min4":25,"max4":25,"prop5":"openwounds","min5":33,"max5":33} |
| unique:295 | Razoredge | 7ha | 1 | 0 | 100 | 75 | 67 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg%","min1":175,"max1":225,"prop2":"swing2","min2":40,"max2":40,"prop3":"reduce-ac","min3":33,"max3":33,"prop4":"deadly","min4":50,"max4":50,"prop5":"openwounds","min5":50,"max5":50} |
| unique:297 | Demonlimb | 7sp | 1 | 0 | 100 | 71 | 63 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg%","min1":180,"max1":230,"prop2":"dmg-fire","min2":222,"max2":333,"prop3":"lifesteal","min3":7,"max3":13,"prop4":"charged","par4":"Enchant","min4":20,"max4":23,"prop5":"rep-dur","par5":5,"prop6":"dmg-demon","min6":123,"max6":123,"prop7":"res-fire","min7":15,"max7":20} |
| unique:298 | Steelshade | ulm | 1 | 0 | 100 | 70 | 62 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ac%","min1":100,"max1":130,"prop2":"abs-fire","min2":5,"max2":11,"prop3":"manasteal","min3":4,"max3":8,"prop4":"regen","min4":10,"max4":18} |
| unique:299 | Tomb Reaver | 7pa | 1 | 1 | 100 | 86 | 84 | 1 | 运行时候选，受等级与稀有度限制；天梯标记不限制原版离线暗金生成；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"swing2","min1":60,"max1":60,"prop2":"light","min2":4,"max2":4,"prop3":"dmg%","min3":200,"max3":280,"prop4":"dmg-undead","min4":150,"max4":230,"prop5":"mag%","min5":50,"max5":80,"prop6":"res-all","min6":30,"max6":50,"prop7":"att-undead","min7":250,"max7":350,"prop8":"reanimate","par8":1,"min8":10,"max8":10,"prop9":"heal-kill","min9":10,"max9":14,"prop10":"sock","min10":1,"max10":3} |
| unique:300 | Deaths's Web | 7gw | 1 | 0 | 100 | 74 | 66 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"allskills","min1":2,"max1":2,"prop2":"pierce-pois","min2":40,"max2":50,"prop3":"heal-kill","min3":7,"max3":12,"prop4":"mana-kill","min4":7,"max4":12,"prop5":"skilltab","par5":7,"min5":1,"max5":2} |
| unique:301 | Nature's Peace | rin | 1 | 1 | 100 | 77 | 69 | 3 | 运行时候选，受等级与稀有度限制；天梯标记不限制原版离线暗金生成；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"noheal","min1":1,"max1":1,"prop2":"rip","min2":1,"max2":1,"prop3":"red-dmg","min3":7,"max3":11,"prop4":"res-pois","min4":20,"max4":30,"prop5":"charged","par5":"Oak Sage","min5":27,"max5":5} |
| unique:302 | Azurewrath | 7cr | 1 | 1 | 100 | 87 | 85 | 1 | 运行时候选，受等级与稀有度限制；天梯标记不限制原版离线暗金生成；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg-mag","min1":250,"max1":500,"prop2":"dmg%","min2":230,"max2":270,"prop3":"aura","par3":"Sanctuary","min3":10,"max3":13,"prop4":"dmg-cold","par4":250,"min4":250,"max4":500,"prop5":"swing2","min5":30,"max5":30,"prop6":"all-stats","min6":5,"max6":10,"prop7":"light","min7":3,"max7":3,"prop8":"allskills","min8":1,"max8":1} |
| unique:303 | Seraph's Hymn | amu | 1 | 1 | 100 | 73 | 65 | 3 | 运行时候选，受等级与稀有度限制；天梯标记不限制原版离线暗金生成；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"allskills","min1":2,"max1":2,"prop2":"skilltab","par2":11,"min2":1,"max2":2,"prop3":"dmg-demon","min3":25,"max3":50,"prop4":"dmg-undead","min4":25,"max4":50,"prop5":"att-demon","min5":150,"max5":250,"prop6":"att-undead","min6":150,"max6":250,"prop7":"light","min7":2,"max7":2} |
| unique:305 | Fleshripper | 7kr | 1 | 0 | 100 | 76 | 68 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg%","min1":200,"max1":300,"prop2":"reduce-ac","min2":50,"max2":50,"prop3":"noheal","min3":1,"max3":1,"prop4":"crush","min4":25,"max4":25,"prop5":"openwounds","min5":50,"max5":50,"prop6":"deadly","min6":33,"max6":33,"prop7":"slow","min7":20,"max7":20} |
| unique:307 | Horizon's Tornado | 7fl | 1 | 0 | 100 | 72 | 64 | 5 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg%","min1":230,"max1":280,"prop2":"swing2","min2":50,"max2":50,"prop3":"slow","min3":20,"max3":20,"prop4":"hit-skill","par4":"Tornado","min4":20,"max4":15,"prop5":"ease","min5":-20,"max5":-20} |
| unique:308 | Stone Crusher | 7wh | 1 | 0 | 100 | 76 | 68 | 4 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg%","min1":280,"max1":320,"prop2":"str","min2":20,"max2":30,"prop3":"crush","min3":40,"max3":40,"prop4":"reduce-ac","min4":25,"max4":25,"prop5":"dmg-ac","min5":-100,"max5":-100,"prop6":"dmg","min6":10,"max6":30} |
| unique:309 | Jadetalon | 7wb | 1 | 0 | 100 | 74 | 66 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg%","min1":190,"max1":240,"prop2":"manasteal","min2":10,"max2":15,"prop3":"res-all","min3":40,"max3":50,"prop4":"balance2","min4":30,"max4":30,"prop5":"skilltab","par5":19,"min5":1,"max5":2,"prop6":"skilltab","par6":20,"min6":1,"max6":2} |
| unique:310 | Shadowdancer | uhb | 1 | 1 | 100 | 79 | 71 | 1 | 运行时候选，受等级与稀有度限制；天梯标记不限制原版离线暗金生成；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ac%","min1":70,"max1":100,"prop2":"move2","min2":30,"max2":30,"prop3":"balance2","min3":30,"max3":30,"prop4":"dex","min4":15,"max4":25,"prop5":"skilltab","par5":19,"min5":1,"max5":2,"prop6":"ease","min6":-20,"max6":-20} |
| unique:311 | Cerebus | drb | 1 | 1 | 100 | 71 | 63 | 1 | 运行时候选，受等级与稀有度限制；天梯标记不限制原版离线暗金生成；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ac%","min1":130,"max1":140,"prop2":"skilltab","par2":16,"min2":2,"max2":4,"prop3":"lifesteal","min3":7,"max3":10,"prop4":"att%","min4":60,"max4":120,"prop5":"openwounds","min5":33,"max5":33,"prop6":"skill","par6":"feral rage","min6":1,"max6":2} |
| unique:312 | Tyrael's Might | uar | 1 | 1 | 100 | 87 | 84 | 1 | 运行时候选，受等级与稀有度限制；天梯标记不限制原版离线暗金生成；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ease","min1":-100,"max1":-100,"prop2":"indestruct","min2":1,"max2":1,"prop3":"ac%","min3":120,"max3":150,"prop4":"rip","min4":1,"max4":1,"prop5":"dmg-demon","min5":50,"max5":100,"prop6":"nofreeze","min6":1,"max6":1,"prop7":"move2","min7":20,"max7":20,"prop8":"res-all","min8":20,"max8":30,"prop9":"str","min9":20,"max9":30} |
| unique:313 | Souldrain | umg | 1 | 0 | 100 | 82 | 74 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ac%","min1":90,"max1":120,"prop2":"manasteal","min2":4,"max2":7,"prop3":"lifesteal","min3":4,"max3":7,"prop4":"hit-skill","par4":"Weaken","min4":8,"max4":3,"prop5":"dmg-ac","min5":-50,"max5":-50} |
| unique:314 | Runemaster | 72a | 1 | 1 | 100 | 80 | 72 | 1 | 运行时候选，受等级与稀有度限制；天梯标记不限制原版离线暗金生成；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg%","min1":220,"max1":270,"prop2":"sock","min2":3,"max2":5,"prop3":"res-cold-max","min3":5,"max3":5,"prop4":"nofreeze","min4":1,"max4":1} |
| unique:315 | Deathcleaver | 7wa | 1 | 1 | 100 | 78 | 70 | 1 | 运行时候选，受等级与稀有度限制；天梯标记不限制原版离线暗金生成；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg%","min1":230,"max1":280,"prop2":"deadly","min2":66,"max2":66,"prop3":"reduce-ac","min3":33,"max3":33,"prop4":"swing2","min4":40,"max4":40,"prop5":"heal-kill","min5":6,"max5":9} |
| unique:316 | Executioner's Justice | 7gi | 1 | 1 | 100 | 83 | 75 | 1 | 运行时候选，受等级与稀有度限制；天梯标记不限制原版离线暗金生成；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg%","min1":240,"max1":290,"prop2":"crush","min2":25,"max2":25,"prop3":"reduce-ac","min3":33,"max3":33,"prop4":"kill-skill","par4":"Decrepify","min4":50,"max4":6,"prop5":"swing2","min5":30,"max5":30} |
| unique:317 | Stoneraven | amd | 1 | 1 | 100 | 72 | 64 | 1 | 运行时候选，受等级与稀有度限制；天梯标记不限制原版离线暗金生成；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg%","min1":230,"max1":280,"prop2":"dmg-mag","min2":101,"max2":187,"prop3":"res-all","min3":30,"max3":50,"prop4":"ac","min4":400,"max4":600,"prop5":"skilltab","par5":2,"min5":1,"max5":3} |
| unique:318 | Leviathan | uld | 1 | 1 | 100 | 73 | 65 | 1 | 运行时候选，受等级与稀有度限制；天梯标记不限制原版离线暗金生成；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ac%","min1":170,"max1":200,"prop2":"ac","min2":100,"max2":150,"prop3":"red-dmg%","min3":15,"max3":25,"prop4":"str","min4":40,"max4":50,"prop5":"indestruct","min5":1,"max5":1} |
| unique:320 | Wisp | rin | 1 | 0 | 100 | 84 | 76 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"abs-ltng%","min1":10,"max1":20,"prop2":"hit-skill","par2":"Lightning","min2":10,"max2":16,"prop3":"mag%","min3":10,"max3":20,"prop4":"charged","par4":"Oak Sage","min4":15,"max4":2,"prop5":"charged","par5":"Heart of Wolverine","min5":13,"max5":5,"prop6":"charged","par6":"Spirit of Barbs","min6":11,"max6":7} |
| unique:321 | Gargoyle's Bite | 7ts | 1 | 0 | 100 | 78 | 70 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg%","min1":180,"max1":230,"prop2":"rep-quant","par2":30,"prop3":"dmg-pois","par3":250,"min3":300,"max3":300,"prop4":"lifesteal","min4":9,"max4":15,"prop5":"charged","par5":"Plague Javelin","min5":60,"max5":11} |
| unique:322 | Lacerator | 7b8 | 1 | 0 | 100 | 76 | 68 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg%","min1":150,"max1":210,"prop2":"rep-quant","par2":25,"prop3":"swing2","min3":30,"max3":30,"prop4":"noheal","min4":1,"max4":1,"prop5":"openwounds","min5":33,"max5":33,"prop6":"howl","min6":64,"max6":64,"prop7":"hit-skill","par7":"Amplify Damage","min7":33,"max7":3} |
| unique:323 | Mang Song's Lesson | 6ws | 1 | 1 | 100 | 86 | 82 | 1 | 运行时候选，受等级与稀有度限制；天梯标记不限制原版离线暗金生成；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"allskills","min1":5,"max1":5,"prop2":"pierce-fire","min2":7,"max2":15,"prop3":"pierce-ltng","min3":7,"max3":15,"prop4":"pierce-cold","min4":7,"max4":15,"prop5":"regen-mana","min5":10,"max5":10,"prop6":"cast2","min6":30,"max6":30} |
| unique:324 | Viperfork | 7br | 1 | 0 | 100 | 79 | 71 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg%","min1":190,"max1":240,"prop2":"dmg-pois","par2":250,"min2":333,"max2":333,"prop3":"swing2","min3":50,"max3":50,"prop4":"att","min4":200,"max4":250,"prop5":"hit-skill","par5":"Poison Explosion","min5":15,"max5":9,"prop6":"res-pois","min6":30,"max6":50} |
| unique:325 | Ethereal Edge | 7ba | 1 | 0 | 100 | 82 | 74 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg%","min1":150,"max1":180,"prop2":"swing2","min2":25,"max2":25,"prop3":"abs-fire","min3":10,"max3":12,"prop4":"dmg-demon","min4":150,"max4":200,"prop5":"demon-heal","min5":5,"max5":10,"prop6":"att","min6":270,"max6":350,"prop7":"ethereal","min7":1,"max7":1,"prop8":"indestruct","min8":1,"max8":1} |
| unique:326 | Demonhorn's Edge | bad | 1 | 1 | 100 | 69 | 61 | 1 | 运行时候选，受等级与稀有度限制；天梯标记不限制原版离线暗金生成；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ac%","min1":120,"max1":160,"prop2":"swing2","min2":10,"max2":10,"prop3":"lifesteal","min3":3,"max3":6,"prop4":"thorns","min4":55,"max4":77,"prop5":"skilltab","par5":12,"min5":1,"max5":3,"prop6":"skilltab","par6":13,"min6":1,"max6":3,"prop7":"skilltab","par7":14,"min7":1,"max7":3} |
| unique:327 | The Reaper's Toll | 7s8 | 1 | 1 | 100 | 83 | 75 | 1 | 运行时候选，受等级与稀有度限制；天梯标记不限制原版离线暗金生成；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg%","min1":190,"max1":240,"prop2":"hit-skill","par2":"Decrepify","min2":33,"max2":1,"prop3":"ignore-ac","min3":1,"max3":1,"prop4":"lifesteal","min4":11,"max4":15,"prop5":"ease","min5":-25,"max5":-25,"prop6":"deadly","min6":33,"max6":33,"prop7":"dmg-cold","min7":4,"max7":44} |
| unique:328 | Spiritkeeper | drd | 1 | 0 | 100 | 75 | 67 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ac%","min1":170,"max1":190,"prop2":"balance2","min2":20,"max2":20,"prop3":"abs-ltng","min3":9,"max3":14,"prop4":"res-fire","min4":30,"max4":40,"prop5":"abs-cold%","min5":15,"max5":25,"prop6":"res-pois-max","min6":10,"max6":10,"prop7":"dru","min7":1,"max7":2} |
| unique:329 | Hellrack | 6hx | 1 | 0 | 100 | 84 | 76 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg%","min1":180,"max1":230,"prop2":"dmg-elem","par2":33,"min2":63,"max2":324,"prop3":"swing2","min3":20,"max3":20,"prop4":"att%","min4":100,"max4":150,"prop5":"sock","min5":2,"max5":2,"prop6":"charged","par6":"Immolation Arrow","min6":150,"max6":18} |
| unique:330 | Alma Negra | pac | 1 | 0 | 100 | 85 | 77 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ac%","min1":180,"max1":210,"prop2":"block2","min2":30,"max2":30,"prop3":"pal","min3":1,"max3":2,"prop4":"block","min4":20,"max4":20,"prop5":"red-mag","min5":5,"max5":9,"prop6":"att%","min6":40,"max6":75,"prop7":"dmg%","min7":40,"max7":75} |
| unique:331 | Darkforge Spawn | nef | 1 | 1 | 100 | 72 | 64 | 1 | 运行时候选，受等级与稀有度限制；天梯标记不限制原版离线暗金生成；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ac%","min1":140,"max1":180,"prop2":"cast2","min2":30,"max2":30,"prop3":"mana%","min3":10,"max3":10,"prop4":"skilltab","par4":6,"min4":1,"max4":3,"prop5":"skilltab","par5":7,"min5":1,"max5":3,"prop6":"skilltab","par6":8,"min6":1,"max6":3} |
| unique:332 | Widowmaker | 6sw | 1 | 1 | 100 | 73 | 65 | 1 | 运行时候选，受等级与稀有度限制；天梯标记不限制原版离线暗金生成；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg%","min1":150,"max1":200,"prop2":"deadly","min2":33,"max2":33,"prop3":"ignore-ac","min3":1,"max3":1,"prop4":"magicarrow","min4":11,"max4":11,"prop5":"oskill","par5":"Guided Arrow","min5":3,"max5":5} |
| unique:333 | Bloodraven's Charge | amb | 1 | 0 | 100 | 79 | 71 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg%","min1":180,"max1":230,"prop2":"att%","min2":200,"max2":300,"prop3":"explosivearrow","min3":13,"max3":13,"prop4":"skilltab","min4":2,"max4":4,"prop5":"charged","par5":"Revive","min5":30,"max5":5} |
| unique:334 | Ghostflame | 7bl | 1 | 0 | 100 | 70 | 62 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg%","min1":190,"max1":240,"prop2":"ignore-ac","min2":1,"max2":1,"prop3":"dmg-mag","min3":108,"max3":108,"prop4":"manasteal","min4":10,"max4":15,"prop5":"ethereal","min5":1,"max5":1,"prop6":"indestruct","min6":1,"max6":1,"prop7":"light","min7":2,"max7":2} |
| unique:335 | Shadowkiller | 7cs | 1 | 1 | 100 | 85 | 78 | 1 | 运行时候选，受等级与稀有度限制；天梯标记不限制原版离线暗金生成；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg%","min1":170,"max1":220,"prop2":"reduce-ac","min2":25,"max2":25,"prop3":"freeze","min3":2,"max3":2,"prop4":"mana-kill","min4":10,"max4":15,"prop5":"hit-skill","par5":"Frost Nova","min5":33,"max5":8,"prop6":"ethereal","min6":1,"max6":1,"prop7":"indestruct","min7":1,"max7":1} |
| unique:336 | Gimmershred | 7ta | 1 | 0 | 100 | 78 | 70 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg%","min1":160,"max1":210,"prop2":"dmg-fire","min2":218,"max2":483,"prop3":"dmg-cold","par3":100,"min3":176,"max3":397,"prop4":"dmg-ltng","min4":29,"max4":501,"prop5":"stack","min5":60,"max5":60,"prop6":"swing2","min6":30,"max6":30} |
| unique:337 | Griffon's Eye | ci3 | 1 | 1 | 100 | 84 | 76 | 1 | 运行时候选，受等级与稀有度限制；天梯标记不限制原版离线暗金生成；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ac","min1":100,"max1":200,"prop2":"cast2","min2":25,"max2":25,"prop3":"allskills","min3":1,"max3":1,"prop4":"extra-ltng","min4":10,"max4":15,"prop5":"pierce-ltng","min5":15,"max5":20} |
| unique:338 | Windhammer | 7m7 | 1 | 0 | 100 | 76 | 68 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg%","min1":180,"max1":230,"prop2":"crush","min2":50,"max2":50,"prop3":"swing2","min3":60,"max3":60,"prop4":"hit-skill","par4":"Twister","min4":33,"max4":22} |
| unique:339 | Thunderstroke | amf | 1 | 1 | 100 | 77 | 69 | 1 | 运行时候选，受等级与稀有度限制；天梯标记不限制原版离线暗金生成；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg%","min1":150,"max1":200,"prop2":"dmg-ltng","min2":1,"max2":511,"prop3":"hit-skill","par3":"Lightning","min3":20,"max3":14,"prop4":"swing2","min4":15,"max4":15,"prop5":"pierce-ltng","min5":15,"max5":15,"prop6":"skill","par6":"Lightning Bolt","min6":3,"max6":3,"prop7":"skilltab","par7":2,"min7":2,"max7":4} |
| unique:341 | Demon's Arch | 7s7 | 1 | 0 | 100 | 76 | 68 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg%","min1":160,"max1":210,"prop2":"dmg-fire","min2":232,"max2":323,"prop3":"lifesteal","min3":6,"max3":12,"prop4":"rep-quant","par4":30,"prop5":"swing2","min5":30,"max5":30,"prop6":"dmg-ltng","min6":23,"max6":333} |
| unique:342 | Boneflame | nee | 1 | 0 | 100 | 80 | 72 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ac%","min1":120,"max1":150,"prop2":"move2","min2":20,"max2":20,"prop3":"gethit-skill","par3":"Terror","min3":15,"max3":3,"prop4":"nec","min4":2,"max4":3,"prop5":"res-all","min5":20,"max5":30} |
| unique:343 | Steelpillar | 7p7 | 1 | 0 | 100 | 77 | 69 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg%","min1":210,"max1":260,"prop2":"swing2","min2":25,"max2":25,"prop3":"reduce-ac","min3":20,"max3":20,"prop4":"ac%","min4":50,"max4":80,"prop5":"indestruct","min5":1,"max5":1,"prop6":"crush","min6":25,"max6":25} |
| unique:344 | Nightwing's Veil | uhm | 1 | 0 | 100 | 75 | 67 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ac%","min1":90,"max1":120,"prop2":"allskills","min2":2,"max2":2,"prop3":"dex","min3":10,"max3":20,"prop4":"abs-cold","min4":5,"max4":9,"prop5":"half-freeze","min5":1,"max5":1,"prop6":"extra-cold","min6":8,"max6":15,"prop7":"ease","min7":-50,"max7":-50} |
| unique:345 | Crown of Ages | urn | 1 | 0 | 100 | 86 | 82 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"balance2","min1":30,"max1":30,"prop2":"res-all","min2":20,"max2":30,"prop3":"allskills","min3":1,"max3":1,"prop4":"ac","min4":100,"max4":150,"prop5":"indestruct","min5":1,"max5":1,"prop6":"red-dmg%","min6":10,"max6":15,"prop7":"ac%","min7":50,"max7":50,"prop8":"sock","min8":1,"max8":2} |
| unique:346 | Andariel's Visage | usk | 1 | 1 | 100 | 85 | 83 | 1 | 运行时候选，受等级与稀有度限制；天梯标记不限制原版离线暗金生成；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ac%","min1":100,"max1":150,"prop2":"res-pois","min2":70,"max2":70,"prop3":"allskills","min3":2,"max3":2,"prop4":"res-pois-max","min4":10,"max4":10,"prop5":"swing2","min5":20,"max5":20,"prop6":"str","min6":25,"max6":30,"prop7":"gethit-skill","par7":92,"min7":15,"max7":15,"prop8":"charged","par8":278,"min8":20,"max8":3,"prop9":"lifesteal","min9":8,"max9":10,"prop10":"res-fire","min10":-30,"max10":-30} |
| unique:347 | Darkfear | ulm | 0 | 0 | 100 | 0 | 0 | 1 | 原始禁用（enabled≠1）；仅定义，未接入执行 | {} |
| unique:348 | Dragonscale | pae | 1 | 0 | 100 | 84 | 80 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ac%","min1":170,"max1":200,"prop2":"abs-fire%","min2":10,"max2":20,"prop3":"res-fire-max","min3":5,"max3":5,"prop4":"str","min4":15,"max4":25,"prop5":"dmg-fire","min5":211,"max5":371,"prop6":"oskill","par6":"Hydra","min6":10,"max6":10,"prop7":"extra-fire","min7":15,"max7":15} |
| unique:349 | Steel Carapice | uul | 1 | 0 | 100 | 74 | 66 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ac%","min1":190,"max1":220,"prop2":"balance2","min2":20,"max2":20,"prop3":"red-dmg","min3":9,"max3":14,"prop4":"res-cold","min4":40,"max4":60,"prop5":"regen-mana","min5":10,"max5":15,"prop6":"rep-dur","par6":5,"prop7":"gethit-skill","par7":"Iron Maiden","min7":8,"max7":6} |
| unique:350 | Medusa's Gaze | uow | 1 | 0 | 100 | 84 | 76 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ac%","min1":150,"max1":180,"prop2":"slow","min2":20,"max2":20,"prop3":"gethit-skill","par3":"Lower Resist","min3":10,"max3":7,"prop4":"lifesteal","min4":5,"max4":9,"prop5":"death-skill","par5":"Nova","min5":100,"max5":44,"prop6":"res-cold","min6":40,"max6":80} |
| unique:351 | Ravenlore | dre | 1 | 0 | 100 | 82 | 74 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ac%","min1":120,"max1":150,"prop2":"res-all","min2":15,"max2":25,"prop3":"skilltab","par3":17,"min3":3,"max3":3,"prop4":"enr","min4":20,"max4":30,"prop5":"pierce-fire","min5":10,"max5":20,"prop6":"skill","par6":"Raven","min6":7,"max6":7} |
| unique:352 | Boneshade | 7bw | 1 | 0 | 100 | 84 | 79 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"nec","min1":2,"max1":2,"prop2":"cast2","min2":25,"max2":25,"prop3":"skill","par3":"Teeth","min3":4,"max3":5,"prop4":"skill","par4":"Bone Armor","min4":4,"max4":5,"prop5":"skill","par5":"Bone Spear","min5":2,"max5":3,"prop6":"skill","par6":"Bone Spirit","min6":1,"max6":2,"prop7":"skill","par7":"Bone Wall","min7":2,"max7":3} |
| unique:354 | Flamebellow | 7gs | 1 | 0 | 100 | 79 | 71 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg%","min1":170,"max1":240,"prop2":"dmg-fire","min2":233,"max2":482,"prop3":"fireskill","min3":3,"max3":3,"prop4":"abs-fire%","min4":20,"max4":30,"prop5":"hit-skill","par5":"Firestorm","min5":12,"max5":16,"prop6":"str","min6":10,"max6":20,"prop7":"vit","min7":5,"max7":10,"prop8":"oskill","par8":"Inferno","min8":12,"max8":18} |
| unique:355 | Fathom | obf | 1 | 1 | 100 | 81 | 73 | 1 | 运行时候选，受等级与稀有度限制；天梯标记不限制原版离线暗金生成；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"sor","min1":3,"max1":3,"prop2":"extra-cold","min2":15,"max2":30,"prop3":"cast2","min3":20,"max3":20,"prop4":"res-fire","min4":25,"max4":40,"prop5":"res-ltng","min5":25,"max5":40} |
| unique:356 | Wolfhowl | bac | 1 | 0 | 100 | 85 | 79 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ac%","min1":120,"max1":150,"prop2":"skilltab","par2":14,"min2":2,"max2":3,"prop3":"str","min3":8,"max3":15,"prop4":"dex","min4":8,"max4":15,"prop5":"vit","min5":8,"max5":15,"prop6":"oskill","par6":"Wearwolf","min6":3,"max6":6,"prop7":"charged","par7":"Summon Fenris","min7":18,"max7":15,"prop8":"oskill","par8":"Shape Shifting","min8":3,"max8":6,"prop9":"oskill","par9":"Feral Rage","min9":3,"max9":6} |
| unique:357 | Spirit Ward | uts | 1 | 0 | 100 | 76 | 68 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ac%","min1":130,"max1":180,"prop2":"abs-cold","min2":6,"max2":11,"prop3":"res-all","min3":30,"max3":40,"prop4":"block","min4":20,"max4":30,"prop5":"block2","min5":25,"max5":25,"prop6":"gethit-skill","par6":"Fade","min6":5,"max6":8} |
| unique:358 | Kira's Guardian | ci2 | 1 | 1 | 100 | 85 | 77 | 1 | 运行时候选，受等级与稀有度限制；天梯标记不限制原版离线暗金生成；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ac","min1":50,"max1":120,"prop2":"res-all","min2":50,"max2":70,"prop3":"nofreeze","min3":1,"max3":1,"prop4":"balance2","min4":20,"max4":20} |
| unique:359 | Ormus' Robes | uui | 1 | 0 | 100 | 83 | 75 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ac","min1":10,"max1":20,"prop2":"cast2","min2":20,"max2":20,"prop3":"extra-fire","min3":10,"max3":15,"prop4":"extra-cold","min4":10,"max4":15,"prop5":"extra-ltng","min5":10,"max5":15,"prop6":"regen-mana","min6":10,"max6":15,"prop7":"skill-rand","par7":3,"min7":36,"max7":60} |
| unique:360 | Gheed's Fortune | cm3 | 1 | 1 | 100 | 70 | 62 | 1 | 运行时候选，受等级与稀有度限制；天梯标记不限制原版离线暗金生成；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"mag%","min1":20,"max1":40,"prop2":"gold%","min2":80,"max2":160,"prop3":"cheap","min3":10,"max3":15} |
| unique:361 | Stormlash | 7fl | 1 | 0 | 100 | 86 | 82 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg%","min1":240,"max1":300,"prop2":"swing2","min2":30,"max2":30,"prop3":"hit-skill","par3":"Static Field","min3":15,"max3":10,"prop4":"hit-skill","par4":"Tornado","min4":20,"max4":18,"prop5":"dmg-ltng","min5":1,"max5":473,"prop6":"light-thorns","min6":30,"max6":30,"prop7":"crush","min7":33,"max7":33,"prop8":"abs-ltng","min8":3,"max8":9} |
| unique:362 | Halaberd's Reign | bae | 1 | 0 | 100 | 85 | 77 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ac%","min1":140,"max1":170,"prop2":"skilltab","par2":13,"min2":1,"max2":1,"prop3":"bar","min3":2,"max3":2,"prop4":"balance2","min4":20,"max4":20,"prop5":"regen","min5":15,"max5":23,"prop6":"skill","par6":"Battle Orders","min6":1,"max6":2,"prop7":"skill","par7":"Battle Command","min7":1,"max7":2} |
| unique:364 | Spike Thorn | upk | 1 | 0 | 100 | 78 | 70 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ac%","min1":120,"max1":150,"prop2":"thorns/lvl","par2":11,"prop3":"dur","min3":250,"max3":250,"prop4":"balance2","min4":30,"max4":30,"prop5":"red-dmg%","min5":15,"max5":20,"prop6":"sock","min6":1,"max6":1} |
| unique:365 | Dracul's Grasp | uvg | 1 | 0 | 100 | 84 | 76 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ac%","min1":90,"max1":120,"prop2":"lifesteal","min2":7,"max2":10,"prop3":"openwounds","min3":25,"max3":25,"prop4":"hit-skill","par4":"Life Tap","min4":5,"max4":10,"prop5":"heal-kill","min5":5,"max5":10,"prop6":"str","min6":10,"max6":15} |
| unique:366 | Frostwind | 7ls | 1 | 0 | 100 | 78 | 70 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg%","min1":180,"max1":230,"prop2":"freeze","min2":4,"max2":4,"prop3":"half-freeze","min3":1,"max3":1,"prop4":"dmg-cold","par4":150,"min4":237,"max4":486,"prop5":"swing2","min5":25,"max5":25,"prop6":"abs-cold%","min6":7,"max6":15,"prop7":"oskill","par7":"Arctic Blast","min7":7,"max7":14} |
| unique:367 | Templar's Might | uar | 1 | 0 | 100 | 82 | 74 | 8 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ac%","min1":170,"max1":220,"prop2":"balance2","min2":20,"max2":20,"prop3":"ac-miss","min3":250,"max3":300,"prop4":"stam","min4":40,"max4":50,"prop5":"str","min5":10,"max5":15,"prop6":"vit","min6":10,"max6":15,"prop7":"skilltab","par7":10,"min7":1,"max7":2} |
| unique:368 | Eschuta's temper | obc | 1 | 0 | 100 | 80 | 72 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"sor","min1":1,"max1":3,"prop2":"cast2","min2":40,"max2":40,"prop3":"extra-fire","min3":10,"max3":20,"prop4":"extra-ltng","min4":10,"max4":20,"prop5":"enr","min5":20,"max5":30} |
| unique:369 | Firelizard's Talons | 7lw | 1 | 0 | 100 | 75 | 67 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg%","min1":200,"max1":270,"prop2":"swing2","min2":15,"max2":15,"prop3":"skilltab","par3":20,"min3":1,"max3":3,"prop4":"dmg-fire","min4":236,"max4":480,"prop5":"res-fire","min5":40,"max5":70,"prop6":"skill","par6":"Wake of Fire Sentry","min6":1,"max6":2,"prop7":"skill","par7":"Inferno Sentry","min7":1,"max7":2} |
| unique:370 | Sandstorm Trek | uvb | 1 | 0 | 100 | 72 | 64 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ac%","min1":140,"max1":170,"prop2":"move2","min2":20,"max2":20,"prop3":"balance2","min3":20,"max3":20,"prop4":"stam/lvl","par4":8,"prop5":"stamdrain","min5":50,"max5":50,"prop6":"res-pois","min6":40,"max6":70,"prop7":"rep-dur","par7":5,"prop8":"str","min8":10,"max8":15,"prop9":"vit","min9":10,"max9":15} |
| unique:371 | Marrowwalk | umb | 1 | 0 | 100 | 74 | 66 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ac%","min1":170,"max1":200,"prop2":"move2","min2":20,"max2":20,"prop3":"charged","par3":"Bone Prison","min3":13,"max3":33,"prop4":"charged","par4":"Life Tap","min4":10,"max4":12,"prop5":"regen-stam","min5":10,"max5":10,"prop6":"regen-mana","min6":10,"max6":10,"prop7":"half-freeze","min7":1,"max7":1,"prop8":"str","min8":10,"max8":20,"prop9":"dex","min9":17,"max9":17,"prop10":"skill","par10":"Skeleton Mastery","min10":1,"max10":2} |
| unique:372 | Heaven's Light | 7sc | 1 | 1 | 100 | 69 | 61 | 1 | 运行时候选，受等级与稀有度限制；天梯标记不限制原版离线暗金生成；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg%","min1":250,"max1":300,"prop2":"swing2","min2":20,"max2":20,"prop3":"reduce-ac","min3":33,"max3":33,"prop4":"light","min4":3,"max4":3,"prop5":"demon-heal","min5":15,"max5":20,"prop6":"crush","min6":33,"max6":33,"prop7":"sock","min7":1,"max7":3,"prop8":"pal","min8":2,"max8":3} |
| unique:374 | Arachnid Mesh | ulc | 1 | 0 | 100 | 87 | 80 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ac%","min1":90,"max1":120,"prop2":"cast2","min2":20,"max2":20,"prop3":"charged","par3":"Venom","min3":11,"max3":3,"prop4":"allskills","min4":1,"max4":1,"prop5":"slow","min5":10,"max5":10,"prop6":"mana%","min6":5,"max6":5} |
| unique:375 | Nosferatu's Coil | uvc | 1 | 0 | 100 | 68 | 51 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"str","min1":15,"max1":15,"prop2":"mana-kill","min2":2,"max2":2,"prop3":"slow","min3":10,"max3":10,"prop4":"lifesteal","min4":5,"max4":7,"prop5":"swing2","min5":10,"max5":10,"prop6":"light","min6":-3,"max6":-3} |
| unique:376 | Metalgrid | amu | 1 | 1 | 100 | 85 | 81 | 2 | 运行时候选，受等级与稀有度限制；天梯标记不限制原版离线暗金生成；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ac","min1":300,"max1":350,"prop2":"res-all","min2":25,"max2":35,"prop3":"att","min3":400,"max3":450,"prop4":"charged","par4":"IronGolem","min4":11,"max4":22,"prop5":"charged","par5":"Iron Maiden","min5":20,"max5":12} |
| unique:377 | Verdugo's Hearty Cord | umc | 1 | 0 | 100 | 71 | 63 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ac%","min1":90,"max1":140,"prop2":"vit","min2":30,"max2":40,"prop3":"stam","min3":100,"max3":120,"prop4":"balance2","min4":10,"max4":10,"prop5":"red-dmg%","min5":10,"max5":15,"prop6":"regen","min6":10,"max6":13} |
| unique:379 | Carrion Wind | rin | 1 | 0 | 100 | 68 | 60 | 3 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ac-miss","min1":100,"max1":160,"prop2":"lifesteal","min2":6,"max2":9,"prop3":"res-pois","min3":55,"max3":55,"prop4":"gethit-skill","par4":"Poison Nova","min4":10,"max4":10,"prop5":"charged","par5":"Plague Poppy","min5":15,"max5":21,"prop6":"hit-skill","par6":"Twister","min6":8,"max6":13,"prop7":"dmg-to-mana","min7":10,"max7":10} |
| unique:380 | Giantskull | uh9 | 1 | 0 | 100 | 73 | 65 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ac","min1":250,"max1":320,"prop2":"str","min2":25,"max2":35,"prop3":"crush","min3":10,"max3":10,"prop4":"sock","min4":1,"max4":2,"prop5":"knock","min5":1,"max5":1} |
| unique:381 | Ironward | 7ws | 1 | 0 | 100 | 68 | 60 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg%","min1":240,"max1":290,"prop2":"slow","min2":25,"max2":25,"prop3":"att%","min3":150,"max3":200,"prop4":"swing2","min4":10,"max4":10,"prop5":"dmg-mag","min5":80,"max5":240,"prop6":"red-dmg","min6":4,"max6":7,"prop7":"dmg","min7":40,"max7":85,"prop8":"skilltab","par8":9,"min8":2,"max8":4,"prop9":"crush","min9":33,"max9":33} |
| unique:382 | Annihilus | cm1 | 1 | 0 | 100 | 110 | 70 | 1 | 当前运行时不可选取；仅定义，未接入执行 | {"prop1":"allskills","min1":1,"max1":1,"prop2":"all-stats","min2":10,"max2":20,"prop3":"res-all","min3":10,"max3":20,"prop4":"addxp","min4":5,"max4":10} |
| unique:383 | Arioc's Needle | 7sr | 1 | 0 | 100 | 85 | 81 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg%","min1":180,"max1":230,"prop2":"dmg-pois","par2":250,"min2":403,"max2":403,"prop3":"deadly","min3":50,"max3":50,"prop4":"ignore-ac","min4":1,"max4":1,"prop5":"allskills","min5":2,"max5":4,"prop6":"swing2","min6":30,"max6":30} |
| unique:384 | Cranebeak | 7mp | 1 | 0 | 100 | 71 | 63 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg%","min1":240,"max1":300,"prop2":"dmg-ltng","min2":1,"max2":305,"prop3":"swing2","min3":40,"max3":40,"prop4":"reduce-ac","min4":25,"max4":25,"prop5":"mag%","min5":20,"max5":50,"prop6":"charged","par6":"Raven","min6":15,"max6":8} |
| unique:385 | Nord's Tenderizer | 7cl | 1 | 0 | 100 | 76 | 68 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg%","min1":270,"max1":330,"prop2":"freeze","min2":2,"max2":4,"prop3":"swing2","min3":25,"max3":25,"prop4":"charged","par4":"Blizzard","min4":12,"max4":16,"prop5":"att%","min5":150,"max5":180,"prop6":"abs-cold%","min6":5,"max6":15,"prop7":"dmg-cold","par7":125,"min7":205,"max7":455} |
| unique:386 | Earthshifter | 7gm | 1 | 0 | 100 | 77 | 69 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg%","min1":250,"max1":300,"prop2":"hit-skill","par2":"Eruption","min2":25,"max2":14,"prop3":"crush","min3":33,"max3":33,"prop4":"swing2","min4":10,"max4":10,"prop5":"charged","par5":"Volcano","min5":30,"max5":14,"prop6":"skilltab","par6":17,"min6":7,"max6":7,"prop7":"cast2","min7":10,"max7":10} |
| unique:387 | Wraithflight | 7gl | 1 | 1 | 100 | 84 | 76 | 1 | 运行时候选，受等级与稀有度限制；天梯标记不限制原版离线暗金生成；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg%","min1":150,"max1":190,"prop2":"rep-quant","par2":40,"prop3":"lifesteal","min3":9,"max3":13,"prop4":"mana-kill","min4":15,"max4":15,"prop5":"ethereal","min5":1,"max5":1} |
| unique:388 | Bonehew | 7o7 | 1 | 0 | 100 | 72 | 64 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg%","min1":270,"max1":320,"prop2":"swing2","min2":30,"max2":30,"prop3":"charged","par3":"Corpse Explosion","min3":30,"max3":14,"prop4":"hit-skill","par4":"Bone Spear","min4":50,"max4":16,"prop5":"noheal","min5":1,"max5":1,"prop6":"sock","min6":2,"max6":2} |
| unique:389 | Ondal's Wisdom | 6cs | 1 | 0 | 100 | 74 | 66 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"cast2","min1":45,"max1":45,"prop2":"enr","min2":40,"max2":50,"prop3":"allskills","min3":2,"max3":4,"prop4":"ac","min4":450,"max4":550,"prop5":"addxp","min5":5,"max5":5,"prop6":"red-mag","min6":5,"max6":8} |
| unique:390 | The Reedeemer | 7sc | 1 | 0 | 100 | 80 | 72 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg%","min1":250,"max1":300,"prop2":"dmg-demon","min2":200,"max2":250,"prop3":"pal","min3":2,"max3":2,"prop4":"ease","min4":-60,"max4":-60,"prop5":"skill","par5":"Redemption","min5":2,"max5":4,"prop6":"skill","par6":"Holy Bolt","min6":2,"max6":4,"prop7":"light","min7":3,"max7":3,"prop8":"reduce-ac","min8":33,"max8":33,"prop9":"dmg","min9":60,"max9":120} |
| unique:391 | Headhunter's Glory | ush | 1 | 0 | 100 | 83 | 75 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ac","min1":320,"max1":420,"prop2":"ac-miss","min2":300,"max2":350,"prop3":"res-pois","min3":30,"max3":40,"prop4":"sock","min4":1,"max4":3,"prop5":"res-fire","min5":20,"max5":30,"prop6":"heal-kill","min6":5,"max6":7} |
| unique:392 | Steelrend | uhg | 1 | 0 | 100 | 78 | 70 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"ac","min1":170,"max1":210,"prop2":"str","min2":15,"max2":20,"prop3":"dmg%","min3":30,"max3":60,"prop4":"crush","min4":10,"max4":10} |
| unique:393 | Rainbow Facet | jew | 1 | 0 | 100 | 85 | 49 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg-ltng","min1":1,"max1":74,"prop2":"pierce-ltng","min2":3,"max2":5,"prop3":"extra-ltng","min3":3,"max3":5,"prop4":"death-skill","par4":"Chain Lightning","min4":100,"max4":47} |
| unique:394 | Rainbow Facet | jew | 1 | 0 | 100 | 85 | 49 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg-cold","par1":3,"min1":24,"max1":38,"prop2":"pierce-cold","min2":3,"max2":5,"prop3":"extra-cold","min3":3,"max3":5,"prop4":"death-skill","par4":"Blizzard","min4":100,"max4":37} |
| unique:395 | Rainbow Facet | jew | 1 | 0 | 100 | 85 | 49 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg-fire","min1":17,"max1":45,"prop2":"pierce-fire","min2":3,"max2":5,"prop3":"extra-fire","min3":3,"max3":5,"prop4":"death-skill","par4":"Meteor","min4":100,"max4":31} |
| unique:396 | Rainbow Facet | jew | 1 | 0 | 100 | 85 | 49 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg-pois","par1":50,"min1":187,"max1":187,"prop2":"pierce-pois","min2":3,"max2":5,"prop3":"extra-pois","min3":3,"max3":5,"prop4":"death-skill","par4":"Poison Nova","min4":100,"max4":51} |
| unique:397 | Rainbow Facet | jew | 1 | 0 | 100 | 85 | 49 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg-ltng","min1":1,"max1":74,"prop2":"pierce-ltng","min2":3,"max2":5,"prop3":"extra-ltng","min3":3,"max3":5,"prop4":"levelup-skill","par4":"Nova","min4":100,"max4":41} |
| unique:398 | Rainbow Facet | jew | 1 | 0 | 100 | 85 | 49 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg-cold","par1":3,"min1":24,"max1":38,"prop2":"pierce-cold","min2":3,"max2":5,"prop3":"extra-cold","min3":3,"max3":5,"prop4":"levelup-skill","par4":"Frost Nova","min4":100,"max4":43} |
| unique:399 | Rainbow Facet | jew | 1 | 0 | 100 | 85 | 49 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg-fire","min1":17,"max1":45,"prop2":"pierce-fire","min2":3,"max2":5,"prop3":"extra-fire","min3":3,"max3":5,"prop4":"levelup-skill","par4":"Blaze","min4":100,"max4":29} |
| unique:400 | Rainbow Facet | jew | 1 | 0 | 100 | 85 | 49 | 1 | 运行时候选，受等级与稀有度限制；仅部分行为已接入，不代表完整生成或全部属性生效 | {"prop1":"dmg-pois","par1":50,"min1":187,"max1":187,"prop2":"pierce-pois","min2":3,"max2":5,"prop3":"extra-pois","min3":3,"max3":5,"prop4":"levelup-skill","par4":"Venom","min4":100,"max4":23} |
| unique:401 | Hellfire Torch | cm2 | 1 | 0 | 100 | 110 | 75 | 1 | 当前运行时不可选取；仅定义，未接入执行 | {"prop1":"randclassskill","max1":6,"prop2":"all-stats","min2":10,"max2":20,"prop3":"res-all","min3":10,"max3":20,"prop4":"light","min4":8,"max4":8,"prop5":"hit-skill","par5":197,"min5":5,"max5":10,"prop6":"charged","par6":"Hydra","min6":10,"max6":30} |

## 套装整体定义（32 条）

组合奖励处理器尚未完成。完整组合属性字段查原始 Sets 表，不把原始字段展示冒充奖励已经生效。

| 套装/index | 名称键 | version | 完整原始数据 |
| --- | --- | --- | --- |
| Aldur's Watchtower | Aldur's Watchtower | 100 | {"index":"Aldur's Watchtower","name":"Aldur's Watchtower","version":100,"level":29,"PCode2a":"att%","PMin2a":150,"PMax2a":150,"PCode3a":"mag%","PMin3a":50,"PMax3a":50,"PCode4a":"lifesteal","PMin4a":10,"PMax4a":10,"FCode1":"res-all","FMin1":50,"FMax1":50,"FCode2":"dru","FMin2":3,"FMax2":3,"FCode3":"ac","FMin3":150,"FMax3":150,"FCode4":"manasteal","FMin4":10,"FMax4":10,"FCode5":"mana","FMin5":150,"FMax5":150,"FCode6":"dmg%","FMin6":350,"FMax6":350,"FCode7":"state","FParam7":"fullsetgeneric","FMin7":1,"FMax7":1,"expansion":1,"lineNumber":18} |
| Angelical Raiment | Angelical Raiment | 0 | {"index":"Angelical Raiment","name":"Angelical Raiment","level":17,"PCode2a":"dex","PMin2a":10,"PMax2a":10,"PCode3a":"mana","PMin3a":50,"PMax3a":50,"FCode1":"res-all","FMin1":25,"FMax1":25,"FCode2":"half-freeze","FMin2":1,"FMax2":1,"FCode3":"mag%","FMin3":40,"FMax3":40,"FCode4":"regen-mana","FMin4":8,"FMax4":8,"lineNumber":13} |
| Arcanna's Tricks | Arcanna's Tricks | 0 | {"index":"Arcanna's Tricks","name":"Arcanna's Tricks","level":20,"PCode2a":"mana","PMin2a":25,"PMax2a":25,"PCode3a":"hp","PMin3a":50,"PMax3a":50,"FCode1":"cast3","FMin1":20,"FMax1":20,"FCode2":"manasteal","FMin2":5,"FMax2":5,"FCode3":"mana","FMin3":25,"FMax3":25,"lineNumber":15} |
| Arctic Gear | Arctic Gear | 0 | {"index":"Arctic Gear","name":"Arctic Gear","level":3,"PCode2a":"str","PMin2a":5,"PMax2a":5,"PCode3a":"hp","PMin3a":50,"PMax3a":50,"FCode1":"cold-min","FMin1":6,"FMax1":6,"FCode2":"cold-max","FMin2":14,"FMax2":14,"FCode3":"cold-len","FMin3":100,"FMax3":100,"FCode4":"nofreeze","FMin4":1,"FMax4":1,"lineNumber":14} |
| Berserker's Garb | Berserker's Garb | 0 | {"index":"Berserker's Garb","name":"Berserker's Garb","level":5,"PCode2a":"hp","PMin2a":50,"PMax2a":50,"FCode1":"res-pois-len","FMin1":75,"FMax1":75,"FCode2":"pois-min","FMin2":16,"FMax2":16,"FCode3":"pois-max","FMin3":32,"FMax3":32,"FCode4":"pois-len","FMin4":75,"FMax4":75,"FCode5":"ac","FMin5":75,"FMax5":75,"lineNumber":11} |
| Bul-Kathos' Children | Bul-Kathos' Children | 100 | {"index":"Bul-Kathos' Children","name":"Bul-Kathos' Children","version":100,"level":50,"FCode1":"dmg-fire","FMin1":20,"FMax1":20,"FCode2":"allskills","FMin2":2,"FMax2":2,"FCode3":"att","FMin3":200,"FMax3":200,"FCode4":"ac","FMin4":25,"FMax4":25,"FCode5":"dmg-undead","FMin5":200,"FMax5":200,"FCode6":"dmg-demon","FMin6":200,"FMax6":200,"expansion":1,"lineNumber":29} |
| Cathan's Traps | Cathan's Traps | 0 | {"index":"Cathan's Traps","name":"Cathan's Traps","level":15,"PCode2a":"dmg-fire","PMin2a":15,"PMax2a":20,"PCode3a":"res-ltng","PMin3a":25,"PMax3a":25,"FCode1":"att","FMin1":60,"FMax1":60,"FCode2":"red-mag","FMin2":3,"FMax2":3,"FCode3":"res-all","FMin3":25,"FMax3":25,"FCode4":"cast1","FMin4":10,"FMax4":10,"FCode5":"mana","FMin5":20,"FMax5":20,"lineNumber":7} |
| Civerb's Vestments | Civerb's Vestments | 0 | {"index":"Civerb's Vestments","name":"Civerb's Vestments","level":13,"PCode2a":"res-fire","PMin2a":15,"PMax2a":15,"FCode1":"str","FMin1":15,"FMax1":15,"FCode2":"dmg-undead","FMin2":200,"FMax2":200,"FCode3":"res-ltng","FMin3":25,"FMax3":25,"lineNumber":0} |
| Cleglaw's Brace | Cleglaw's Brace | 0 | {"index":"Cleglaw's Brace","name":"Cleglaw's Brace","level":6,"PCode2a":"ac","PMin2a":50,"PMax2a":50,"FCode1":"ac","FMin1":50,"FMax1":50,"FCode2":"manasteal","FMin2":6,"FMax2":6,"FCode3":"crush","FMin3":35,"FMax3":35,"FCode4":"swing2","FMin4":20,"FMax4":20,"lineNumber":2} |
| Cow King's Leathers | Cow King's Leathers | 100 | {"index":"Cow King's Leathers","name":"Cow King's Leathers","version":100,"level":20,"PCode2a":"res-pois","PMin2a":25,"PMax2a":25,"FCode1":"stam","FMin1":100,"FMax1":100,"FCode2":"str","FMin2":20,"FMax2":20,"FCode3":"gold%","FMin3":100,"FMax3":100,"FCode4":"mag%","FMin4":100,"FMax4":100,"FCode5":"gethit-skill","FParam5":42,"FMin5":25,"FMax5":5,"FCode6":"swing3","FMin6":30,"FMax6":30,"expansion":1,"lineNumber":30} |
| Death's Disguise | Death's Disguise | 0 | {"index":"Death's Disguise","name":"Death's Disguise","level":8,"PCode2a":"lifesteal","PMin2a":8,"PMax2a":8,"FCode1":"att%","FMin1":40,"FMax1":40,"FCode2":"dmg-min","FMin2":10,"FMax2":10,"FCode3":"res-all","FMin3":25,"FMax3":25,"lineNumber":12} |
| Griswold's Legacy | Griswold's Legacy | 100 | {"index":"Griswold's Legacy","name":"Griswold's Legacy","version":100,"level":44,"PCode2a":"str","PMin2a":20,"PMax2a":20,"PCode3a":"dex","PMin3a":30,"PMax3a":30,"FCode1":"res-all","FMin1":50,"FMax1":50,"FCode2":"pal","FMin2":3,"FMax2":3,"FCode3":"att","FMin3":200,"FMax3":200,"FCode4":"hp","FMin4":150,"FMax4":150,"FCode5":"state","FParam5":"fullsetgeneric","FMin5":1,"FMax5":1,"FCode6":"balance2","FMin6":30,"FMax6":30,"expansion":1,"lineNumber":21} |
| Heaven's Brethren | Heaven's Brethren | 100 | {"index":"Heaven's Brethren","name":"Heaven's Brethren","version":100,"level":55,"PCode2a":"regen-stam","PMin2a":50,"PMax2a":50,"PCode3a":"regen","PMin3a":20,"PMax3a":20,"PCode4a":"dmg-fire","PMin4a":30,"PMax4a":30,"FCode1":"res-all","FMin1":50,"FMax1":50,"FCode2":"allskills","FMin2":2,"FMax2":2,"FCode3":"nofreeze","FMin3":1,"FMax3":1,"FCode4":"light","FMin4":5,"FMax4":5,"expansion":1,"lineNumber":25} |
| Hsarus' Defense | Hsarus' Defense | 0 | {"index":"Hsarus' Defense","name":"Hsarus' Defense","level":4,"PCode2a":"thorns","PMin2a":5,"PMax2a":5,"FCode1":"dmg-max","FMin1":5,"FMax1":5,"FCode2":"nofreeze","FMin2":1,"FMax2":1,"FCode3":"res-ltng","FMin3":25,"FMax3":25,"lineNumber":1} |
| Hwanin's Majesty | Hwanin's Majesty | 100 | {"index":"Hwanin's Majesty","name":"Hwanin's Majesty","version":100,"level":28,"PCode2a":"ac","PMin2a":100,"PMax2a":100,"PCode3a":"ac","PMin3a":200,"PMax3a":200,"FCode1":"allskills","FMin1":2,"FMax1":2,"FCode2":"lifesteal","FMin2":20,"FMax2":20,"FCode3":"move3","FMin3":30,"FMax3":30,"FCode4":"res-all","FMin4":30,"FMax4":30,"expansion":1,"lineNumber":27} |
| Immortal King | Immortal King | 100 | {"index":"Immortal King","name":"Immortal King","version":100,"level":37,"PCode2a":"att","PMin2a":50,"PMax2a":50,"PCode3a":"att","PMin3a":75,"PMax3a":75,"PCode4a":"att","PMin4a":125,"PMax4a":125,"PCode5a":"att","PMin5a":200,"PMax5a":200,"FCode1":"res-all","FMin1":50,"FMax1":50,"FCode2":"bar","FMin2":3,"FMax2":3,"FCode3":"hp","FMin3":150,"FMax3":150,"FCode4":"red-mag","FMin4":10,"FMax4":10,"FCode5":"state","FParam5":"fullsetgeneric","FMin5":1,"FMax5":1,"expansion":1,"lineNumber":19} |
| Infernal Tools | Infernal Tools | 0 | {"index":"Infernal Tools","name":"Infernal Tools","level":7,"PCode2a":"dmg-pois","PParam2a":80,"PMin2a":25,"PMax2a":25,"PCode3a":"mana","PMin3a":10,"PMax3a":10,"FCode1":"att%","FMin1":20,"FMax1":20,"FCode2":"nec","FMin2":1,"FMax2":1,"FCode3":"openwounds","FMin3":20,"FMax3":20,"FCode4":"manasteal","FMin4":6,"FMax4":6,"lineNumber":10} |
| Iratha's Finery | Iratha's Finery | 0 | {"index":"Iratha's Finery","name":"Iratha's Finery","level":21,"PCode2a":"ac","PMin2a":50,"PMax2a":50,"PCode3a":"move2","PMin3a":20,"PMax3a":20,"FCode1":"res-all","FMin1":20,"FMax1":20,"FCode2":"res-fire-max","FMin2":10,"FMax2":10,"FCode3":"res-cold-max","FMin3":10,"FMax3":10,"FCode4":"res-ltng-max","FMin4":10,"FMax4":10,"FCode5":"res-pois-max","FMin5":10,"FMax5":10,"FCode6":"dex","FMin6":15,"FMax6":15,"lineNumber":3} |
| Isenhart's Armory | Isenhart's Armory | 0 | {"index":"Isenhart's Armory","name":"Isenhart's Armory","level":11,"PCode2a":"str","PMin2a":10,"PMax2a":10,"PCode3a":"dex","PMin3a":10,"PMax3a":10,"FCode1":"lifesteal","FMin1":5,"FMax1":5,"FCode2":"res-all","FMin2":10,"FMax2":10,"FCode3":"att%","FMin3":35,"FMax3":35,"FCode4":"block","FMin4":30,"FMax4":30,"FCode5":"move2","FMin5":20,"FMax5":20,"lineNumber":4} |
| M'avina's Battle Hymn | M'avina's Battle Hymn | 100 | {"index":"M'avina's Battle Hymn","name":"M'avina's Battle Hymn","version":100,"level":21,"PCode2a":"str","PMin2a":20,"PMax2a":20,"PCode3a":"dex","PMin3a":30,"PMax3a":30,"FCode1":"res-all","FMin1":50,"FMax1":50,"FCode2":"ama","FMin2":3,"FMax2":3,"FCode3":"ac","FMin3":100,"FMax3":100,"FCode4":"att","FMin4":100,"FMax4":100,"FCode5":"mag%","FMin5":100,"FMax5":100,"FCode6":"state","FParam6":"fullsetgeneric","FMin6":1,"FMax6":1,"expansion":1,"lineNumber":23} |
| McAuley's Folly | McAuley's Folly | 100 | {"index":"McAuley's Folly","name":"McAuley's Folly","version":100,"level":20,"PCode2a":"ac","PMin2a":50,"PMax2a":50,"PCode3a":"att","PMin3a":75,"PMax3a":75,"FCode1":"allskills","FMin1":1,"FMax1":1,"FCode2":"mag%","FMin2":50,"FMax2":50,"FCode3":"mana","FMin3":50,"FMax3":50,"FCode4":"lifesteal","FMin4":4,"FMax4":4,"expansion":1,"lineNumber":32} |
| Milabrega's Regalia | Milabrega's Regalia | 0 | {"index":"Milabrega's Regalia","name":"Milabrega's Regalia","level":23,"PCode2a":"att","PMin2a":75,"PMax2a":75,"PCode3a":"att","PMin3a":125,"PMax3a":125,"FCode1":"lifesteal","FMin1":8,"FMax1":8,"FCode2":"pal","FMin2":2,"FMax2":2,"FCode3":"manasteal","FMin3":10,"FMax3":10,"FCode4":"res-pois","FMin4":15,"FMax4":15,"lineNumber":6} |
| Naj's Ancient Set | Naj's Ancient Set | 100 | {"index":"Naj's Ancient Set","name":"Naj's Ancient Set","version":100,"level":43,"PCode2a":"ac","PMin2a":175,"PMax2a":175,"FCode1":"allskills","FMin1":1,"FMax1":1,"FCode2":"regen","FMin2":10,"FMax2":10,"FCode3":"dex","FMin3":15,"FMax3":15,"FCode4":"res-all","FMin4":50,"FMax4":50,"FCode5":"str","FMin5":20,"FMax5":20,"FCode6":"mana","FMin6":100,"FMax6":100,"expansion":1,"lineNumber":31} |
| Natalya's Odium | Natalya's Odium | 100 | {"index":"Natalya's Odium","name":"Natalya's Odium","version":100,"level":22,"PCode2a":"red-mag","PMin2a":15,"PMax2a":15,"PCode3a":"ac","PMin3a":200,"PMax3a":200,"PCode4a":"res-pois","PMin4a":20,"PMax4a":20,"FCode1":"res-all","FMin1":50,"FMax1":50,"FCode2":"ass","FMin2":3,"FMax2":3,"FCode3":"ac","FMin3":150,"FMax3":150,"FCode4":"lifesteal","FMin4":14,"FMax4":14,"FCode5":"manasteal","FMin5":14,"FMax5":14,"FCode6":"red-dmg%","FMin6":30,"FMax6":30,"FCode7":"fade","FMin7":1,"FMax7":1,"expansion":1,"lineNumber":17} |
| Orphan's Call | Orphan's Call | 100 | {"index":"Orphan's Call","name":"Orphan's Call","version":100,"level":41,"PCode2a":"hp","PMin2a":35,"PMax2a":35,"PCode3a":"thorns","PMin3a":5,"PMax3a":5,"PCode4a":"ac","PMin4a":100,"PMax4a":100,"FCode1":"hp","FMin1":50,"FMax1":50,"FCode2":"dex","FMin2":10,"FMax2":10,"FCode3":"str","FMin3":20,"FMax3":20,"FCode4":"ac","FMin4":100,"FMax4":100,"FCode5":"res-all","FMin5":15,"FMax5":15,"FCode6":"mag%","FMin6":80,"FMax6":80,"expansion":1,"lineNumber":26} |
| Sazabi's Grand Tribute | Sazabi's Grand Tribute | 100 | {"index":"Sazabi's Grand Tribute","name":"Sazabi's Grand Tribute","version":100,"level":34,"PCode2a":"move3","PMin2a":40,"PMax2a":40,"FCode1":"res-all","FMin1":30,"FMax1":30,"FCode2":"lifesteal","FMin2":15,"FMax2":15,"FCode3":"hp%","FMin3":27,"FMax3":27,"expansion":1,"lineNumber":28} |
| Sigon's Complete Steel | Sigon's Complete Steel | 0 | {"index":"Sigon's Complete Steel","name":"Sigon's Complete Steel","level":9,"PCode2a":"lifesteal","PMin2a":10,"PMax2a":10,"PCode3a":"ac","PMin3a":100,"PMax3a":100,"FCode1":"res-fire","FMin1":12,"FMax1":12,"FCode2":"thorns","FMin2":12,"FMax2":12,"FCode3":"red-dmg","FMin3":7,"FMax3":7,"FCode4":"fire-max","FMin4":24,"FMax4":24,"FCode5":"mana","FMin5":20,"FMax5":20,"lineNumber":9} |
| Tal Rasha's Wrappings | Tal Rasha's Wrappings | 100 | {"index":"Tal Rasha's Wrappings","name":"Tal Rasha's Wrappings","version":100,"level":26,"PCode2a":"regen","PMin2a":10,"PMax2a":10,"PCode3a":"mag%","PMin3a":65,"PMax3a":65,"PCode4a":"balance2","PMin4a":25,"PMax4a":25,"FCode1":"res-all","FMin1":50,"FMax1":50,"FCode2":"sor","FMin2":3,"FMax2":3,"FCode3":"ac","FMin3":150,"FMax3":150,"FCode4":"hp","FMin4":150,"FMax4":150,"FCode5":"ac-miss","FMin5":50,"FMax5":50,"FCode6":"state","FParam6":"fullsetgeneric","FMin6":1,"FMax6":1,"expansion":1,"lineNumber":20} |
| Tancred's Battlegear | Tancred's Battlegear | 0 | {"index":"Tancred's Battlegear","name":"Tancred's Battlegear","level":27,"PCode2a":"dmg-ltng","PMin2a":15,"PMax2a":15,"PCode3a":"lifesteal","PMin3a":5,"PMax3a":5,"FCode1":"gold%","FMin1":75,"FMax1":75,"FCode2":"res-all","FMin2":10,"FMax2":10,"FCode3":"slow","FMin3":35,"FMax3":35,"FCode4":"manasteal","FMin4":5,"FMax4":5,"lineNumber":8} |
| The Disciple | The Disciple | 100 | {"index":"The Disciple","name":"The Disciple","version":100,"level":39,"PCode2a":"ac","PMin2a":150,"PMax2a":150,"PCode3a":"dmg-pois","PParam3a":75,"PMin3a":75,"PMax3a":75,"PCode4a":"str","PMin4a":10,"PMax4a":10,"PCode5a":"dex","PMin5a":10,"PMax5a":10,"FCode1":"res-all","FMin1":50,"FMax1":50,"FCode2":"allskills","FMin2":2,"FMax2":2,"FCode3":"mana","FMin3":100,"FMax3":100,"expansion":1,"lineNumber":24} |
| Trang-Oul's Avatar | Trang-Oul's Avatar | 100 | {"index":"Trang-Oul's Avatar","name":"Trang-Oul's Avatar","version":100,"level":32,"PCode2a":"regen-mana","PMin2a":15,"PMax2a":15,"PCode2b":"oskill","PParam2b":"Fire Ball","PMin2b":18,"PMax2b":18,"PCode3a":"regen-mana","PMin3a":15,"PMax3a":15,"PCode3b":"oskill","PParam3b":"Fire Wall","PMin3b":13,"PMax3b":13,"PCode4a":"regen-mana","PMin4a":15,"PMax4a":15,"PCode4b":"oskill","PParam4b":"Meteor","PMin4b":10,"PMax4b":10,"FCode1":"res-all","FMin1":50,"FMax1":50,"FCode2":"nec","FMin2":3,"FMax2":3,"FCode3":"mana","FMin3":100,"FMax3":100,"FCode4":"ac","FMin4":200,"FMax4":200,"FCode5":"state","FParam5":"monsterset","FMin5":1,"FMax5":1,"FCode6":"regen-mana","FMin6":15,"FMax6":15,"FCode7":"oskill","FParam7":"Fire Mastery","FMin7":3,"FMax7":3,"FCode8":"lifesteal","FMin8":20,"FMax8":20,"expansion":1,"lineNumber":22} |
| Vidala's Rig | Vidala's Rig | 0 | {"index":"Vidala's Rig","name":"Vidala's Rig","level":19,"PCode2a":"att","PMin2a":75,"PMax2a":75,"PCode3a":"dex","PMin3a":15,"PMax3a":15,"FCode1":"dmg-cold","FParam1":50,"FMin1":15,"FMax1":20,"FCode2":"freeze","FMin2":1,"FMax2":1,"FCode3":"pierce","FMin3":50,"FMax3":50,"FCode4":"str","FMin4":10,"FMax4":10,"lineNumber":5} |

## 套装单件定义（127 条）

| 名称/index | 套装 | 底材 | 生成等级 | 需求等级 | rarity | 固定属性字段 |
| --- | --- | --- | --- | --- | --- | --- |
| Aldur's Advance | Aldur's Watchtower | xtb | 29 | 45 | 7 | {"prop1":"indestruct","min1":1,"max1":1,"prop2":"regen-stam","min2":32,"max2":32,"prop3":"hp","min3":50,"max3":50,"prop4":"dmg-to-mana","min4":10,"max4":10,"prop5":"move3","min5":40,"max5":40,"prop6":"stam","min6":180,"max6":180,"prop7":"res-fire","min7":40,"max7":50,"aprop1a":"dex","amin1a":15,"amax1a":15,"aprop2a":"dex","amin2a":15,"amax2a":15,"aprop3a":"dex","amin3a":15,"amax3a":15} |
| Aldur's Deception | Aldur's Watchtower | uul | 29 | 76 | 7 | {"prop1":"ac","min1":300,"max1":300,"prop2":"skilltab","par2":16,"min2":1,"max2":1,"prop3":"str","min3":20,"max3":20,"prop4":"dex","min4":15,"max4":15,"prop5":"res-ltng","min5":40,"max5":50,"prop6":"ease","min6":-50,"max6":-50,"prop7":"skilltab","par7":17,"min7":1,"max7":1,"aprop1a":"vit","amin1a":15,"amax1a":15,"aprop2a":"vit","amin2a":15,"amax2a":15,"aprop3a":"vit","amin3a":15,"amax3a":15} |
| Aldur's Gauntlet | Aldur's Watchtower | 9mt | 29 | 42 | 7 | {"prop1":"dmg-norm","min1":40,"max1":62,"prop2":"dmg-ltng","min2":50,"max2":75,"prop3":"lifesteal","min3":10,"max3":10,"prop4":"swing3","min4":30,"max4":30,"prop5":"dmg-demon","min5":200,"max5":200,"prop6":"manasteal","min6":5,"max6":5,"prop7":"sock","min7":2,"max7":5,"aprop1a":"str","amin1a":15,"amax1a":15,"aprop2a":"str","amin2a":15,"amax2a":15,"aprop3a":"str","amin3a":15,"amax3a":15} |
| Aldur's Stony Gaze | Aldur's Watchtower | dr8 | 29 | 36 | 7 | {"prop1":"ac","min1":90,"max1":90,"prop2":"regen-mana","min2":17,"max2":17,"prop3":"light","min3":5,"max3":5,"prop4":"balance3","min4":25,"max4":25,"prop5":"res-cold","min5":40,"max5":50,"prop6":"sock","min6":2,"max6":2,"aprop1a":"enr","amin1a":15,"amax1a":15,"aprop2a":"enr","amin2a":15,"amax2a":15,"aprop3a":"enr","amin3a":15,"amax3a":15} |
| Angelic Halo | Angelical Raiment | rin | 17 | 12 | 3 | {"prop1":"regen","min1":6,"max1":6,"prop2":"hp","min2":20,"max2":20,"aprop1a":"att/lvl","apar1a":24,"aprop2a":"mag%","amin2a":50,"amax2a":50} |
| Angelic Mantle | Angelical Raiment | rng | 17 | 12 | 7 | {"prop1":"red-dmg","min1":3,"max1":3,"prop2":"ac%","min2":40,"max2":40,"aprop1a":"ac","amin1a":150,"amax1a":150,"aprop2a":"res-fire","amin2a":50,"amax2a":50} |
| Angelic Sickle | Angelical Raiment | sbr | 17 | 12 | 7 | {"prop1":"att","min1":75,"max1":75,"prop2":"dmg-undead","min2":250,"max2":250,"aprop1a":"dmg%","amin1a":75,"amax1a":75,"aprop2a":"swing3","amin2a":30,"amax2a":30} |
| Angelic Wings | Angelical Raiment | amu | 17 | 12 | 7 | {"prop1":"light","min1":3,"max1":3,"prop2":"dmg-to-mana","min2":20,"max2":20,"aprop1a":"hp","amin1a":75,"amax1a":75,"aprop2a":"allskills","amin2a":1,"amax2a":1} |
| Arcanna's Deathwand | Arcanna's Tricks | wst | 20 | 15 | 7 | {"prop1":"sor","min1":1,"max1":1,"prop2":"deadly","min2":25,"max2":25,"aprop1a":"mana","amin1a":50,"amax1a":50,"aprop2a":"regen-mana","amin2a":5,"amax2a":5} |
| Arcanna's Flesh | Arcanna's Tricks | ltp | 20 | 15 | 7 | {"prop1":"light","min1":2,"max1":2,"prop2":"red-dmg","min2":3,"max2":3,"aprop1a":"ac","amin1a":100,"amax1a":100,"aprop2a":"enr","amin2a":10,"amax2a":10} |
| Arcanna's Head | Arcanna's Tricks | skp | 20 | 15 | 7 | {"prop1":"regen","min1":4,"max1":4,"prop2":"thorns","min2":2,"max2":2,"aprop1a":"ac/lvl","apar1a":24,"aprop2a":"res-ltng","amin2a":15,"amax2a":15} |
| Arcanna's Sign | Arcanna's Tricks | amu | 20 | 15 | 1 | {"prop1":"mana","min1":15,"max1":15,"prop2":"regen-mana","min2":20,"max2":20,"aprop1a":"mag%","amin1a":50,"amax1a":50,"aprop2a":"res-fire","amin2a":20,"amax2a":20} |
| Arctic Binding | Arctic Gear | vbl | 3 | 2 | 7 | {"prop1":"res-cold","min1":40,"max1":40,"prop2":"ac","min2":30,"max2":30,"aprop1a":"mag%","amin1a":40,"amax1a":40,"aprop2a":"res-cold","amin2a":10,"amax2a":10} |
| Arctic Furs | Arctic Gear | qui | 3 | 2 | 7 | {"prop1":"ac%","min1":275,"max1":325,"prop2":"res-all","min2":10,"max2":10,"aprop1a":"ac/lvl","apar1a":24,"aprop2a":"res-cold","amin2a":15,"amax2a":15} |
| Arctic Horn | Arctic Gear | swb | 3 | 2 | 7 | {"prop1":"att%","min1":20,"max1":20,"prop2":"dmg%","min2":50,"max2":50,"aprop1a":"att/lvl","apar1a":16,"aprop2a":"dmg-cold","apar2a":75,"amin2a":20,"amax2a":30} |
| Arctic Mitts | Arctic Gear | tgl | 3 | 2 | 7 | {"prop1":"hp","min1":20,"max1":20,"prop2":"swing1","min2":10,"max2":10,"aprop1a":"att","amin1a":50,"amax1a":50,"aprop2a":"dex","amin2a":10,"amax2a":10} |
| Berserker's Hatchet | Berserker's Garb | 2ax | 5 | 3 | 7 | {"prop1":"att%","min1":30,"max1":30,"prop2":"manasteal","min2":5,"max2":5,"aprop1a":"dmg%","amin1a":50,"amax1a":50} |
| Berserker's Hauberk | Berserker's Garb | spl | 5 | 3 | 7 | {"prop1":"red-mag","min1":2,"max1":2,"prop2":"bar","min2":1,"max2":1,"aprop1a":"ac/lvl","apar1a":24} |
| Berserker's Headgear | Berserker's Garb | hlm | 5 | 3 | 7 | {"prop1":"ac","min1":15,"max1":15,"prop2":"res-fire","min2":25,"max2":25,"aprop1a":"att/lvl","apar1a":16} |
| Bul-Kathos' Sacred Charge | Bul-Kathos' Children | 7gd | 50 | 61 | 7 | {"prop1":"crush","min1":35,"max1":35,"prop2":"res-all","min2":20,"max2":20,"prop3":"swing2","min3":20,"max3":20,"prop4":"knock","min4":1,"max4":1,"prop5":"dmg%","min5":200,"max5":200} |
| Bul-Kathos' Tribal Guardian | Bul-Kathos' Children | 7wd | 50 | 54 | 7 | {"prop1":"res-fire","min1":50,"max1":50,"prop2":"dmg-pois","par2":50,"min2":255,"max2":255,"prop3":"swing2","min3":20,"max3":20,"prop4":"str","min4":20,"max4":20,"prop5":"dmg%","min5":200,"max5":200} |
| Cathan's Mesh | Cathan's Traps | chn | 15 | 11 | 7 | {"prop1":"ac","min1":15,"max1":15,"prop2":"ease","min2":-50,"max2":-50,"aprop1a":"thorns","amin1a":5,"amax1a":5,"aprop2a":"res-fire","amin2a":30,"amax2a":30} |
| Cathan's Rule | Cathan's Traps | bst | 15 | 11 | 7 | {"prop1":"fireskill","min1":1,"max1":1,"prop2":"fire-max","min2":10,"max2":10,"aprop1a":"mana","amin1a":50,"amax1a":50,"aprop2a":"res-all","amin2a":10,"amax2a":10} |
| Cathan's Seal | Cathan's Traps | rin | 15 | 11 | 7 | {"prop1":"lifesteal","min1":6,"max1":6,"prop2":"red-dmg","min2":2,"max2":2,"aprop1a":"str","amin1a":10,"amax1a":10} |
| Cathan's Sigil | Cathan's Traps | amu | 15 | 11 | 7 | {"prop1":"balance1","min1":10,"max1":10,"prop2":"light-thorns","min2":5,"max2":5,"aprop1a":"att","amin1a":50,"amax1a":50,"aprop2a":"mag%","amin2a":25,"amax2a":25} |
| Cathan's Visage | Cathan's Traps | msk | 15 | 11 | 7 | {"prop1":"mana","min1":20,"max1":20,"prop2":"res-cold","min2":25,"max2":25,"aprop1a":"ac/lvl","apar1a":16} |
| Civerb's Cudgel | Civerb's Vestments | gsc | 13 | 9 | 7 | {"prop1":"att","min1":75,"max1":75,"prop2":"dmg-max","min2":17,"max2":23,"aprop1a":"dmg/lvl","apar1a":8} |
| Civerb's Icon | Civerb's Vestments | amu | 13 | 9 | 7 | {"prop1":"regen-mana","min1":40,"max1":40,"prop2":"regen","min2":4,"max2":4,"aprop1a":"res-cold","amin1a":25,"amax1a":25,"aprop2a":"ac","amin2a":25,"amax2a":25} |
| Civerb's Ward | Civerb's Vestments | lrg | 13 | 9 | 7 | {"prop1":"ac","min1":15,"max1":15,"prop2":"block","min2":15,"max2":15,"aprop1a":"mana","amin1a":21,"amax1a":22,"aprop2a":"res-pois","amin2a":25,"amax2a":26} |
| Cleglaw's Claw | Cleglaw's Brace | sml | 6 | 4 | 7 | {"prop1":"ac","min1":17,"max1":17,"prop2":"res-pois-len","min2":75,"max2":75,"aprop1a":"res-all","amin1a":15,"amax1a":15} |
| Cleglaw's Pincers | Cleglaw's Brace | mgl | 6 | 4 | 7 | {"prop1":"knock","min1":1,"max1":1,"prop2":"slow","min2":25,"max2":25,"aprop1a":"att/lvl","apar1a":20} |
| Cleglaw's Tooth | Cleglaw's Brace | lsd | 6 | 4 | 7 | {"prop1":"att%","min1":30,"max1":30,"prop2":"deadly","min2":50,"max2":50,"aprop1a":"dmg/lvl","apar1a":10} |
| Cow King's Hide | Cow King's Leathers | stu | 20 | 18 | 7 | {"prop1":"res-all","min1":18,"max1":18,"prop2":"ac%","min2":60,"max2":60,"prop3":"hp","min3":30,"max3":30,"prop4":"gethit-skill","par4":53,"min4":18,"max4":5} |
| Cow King's Hoofs | Cow King's Leathers | vbt | 20 | 13 | 7 | {"prop1":"ac","min1":25,"max1":35,"prop2":"move3","min2":30,"max2":30,"prop3":"mag%","min3":25,"max3":25,"prop4":"dex","min4":20,"max4":20,"prop5":"dmg-fire","min5":25,"max5":35} |
| Cow King's Horns | Cow King's Leathers | xap | 20 | 25 | 7 | {"prop1":"ac","min1":75,"max1":75,"prop2":"half-freeze","min2":1,"max2":1,"prop3":"dmg-to-mana","min3":35,"max3":35,"prop4":"thorns","min4":10,"max4":10} |
| Credendum | The Disciple | umc | 39 | 65 | 7 | {"prop1":"ac","min1":50,"max1":50,"prop2":"str","min2":10,"max2":10,"prop3":"dex","min3":10,"max3":10,"prop4":"res-all","min4":15,"max4":15} |
| Dangoon's Teaching | Heaven's Brethren | 7ma | 55 | 68 | 7 | {"prop1":"dmg/lvl","par1":12,"prop2":"swing3","min2":40,"max2":40,"prop3":"hit-skill","par3":44,"min3":10,"max3":3,"prop4":"dmg-fire","min4":20,"max4":30} |
| Death's Guard | Death's Disguise | lbl | 8 | 6 | 7 | {"prop1":"ac","min1":20,"max1":20,"prop2":"nofreeze","min2":1,"max2":1,"aprop1a":"res-all","amin1a":15,"amax1a":15} |
| Death's Hand | Death's Disguise | lgl | 8 | 6 | 7 | {"prop1":"res-pois","min1":50,"max1":50,"prop2":"res-pois-len","min2":75,"max2":75,"aprop1a":"swing3","amin1a":30,"amax1a":30} |
| Death's Touch | Death's Disguise | wsd | 8 | 6 | 7 | {"prop1":"dmg%","min1":25,"max1":25,"prop2":"lifesteal","min2":4,"max2":4,"aprop1a":"dmg-cold","apar1a":75,"amin1a":25,"amax1a":75} |
| Griswold's Heart | Griswold's Legacy | xar | 44 | 45 | 7 | {"prop1":"ac","min1":500,"max1":500,"prop2":"skilltab","par2":11,"min2":2,"max2":2,"prop3":"sock","min3":3,"max3":3,"prop4":"str","min4":20,"max4":20,"prop5":"ease","min5":-40,"max5":-40} |
| Griswold's Honor | Griswold's Legacy | paf | 44 | 68 | 7 | {"prop1":"ac","min1":108,"max1":108,"prop2":"sock","par2":3,"prop3":"block2","min3":65,"max3":65,"prop4":"block","min4":20,"max4":20,"prop5":"res-all","min5":45,"max5":45} |
| Griswold's Valor | Griswold's Legacy | urn | 44 | 69 | 7 | {"prop1":"ac%","min1":50,"max1":75,"prop2":"abs-cold/lvl","min2":2,"max2":2,"prop3":"sock","min3":2,"max3":2,"prop4":"ease","min4":-40,"max4":-40,"prop5":"mag%","min5":20,"max5":30,"prop6":"res-all","min6":5,"max6":5,"aprop1a":"skilltab","apar1a":10,"amin1a":2,"amax1a":2} |
| Griswolds's Redemption | Griswold's Legacy | 7ws | 44 | 53 | 7 | {"prop1":"dmg%","min1":200,"max1":240,"prop2":"swing2","min2":40,"max2":40,"prop3":"dmg-undead","min3":200,"max3":200,"prop4":"ease","min4":-20,"max4":-20,"prop5":"sock","min5":3,"max5":4,"aprop1a":"skilltab","apar1a":9,"amin1a":2,"amax1a":2,"aprop2a":"dmg-norm","amin2a":10,"amax2a":20,"aprop3a":"dmg-norm","amin3a":10,"amax3a":20} |
| Guillaume's Face | Orphan's Call | xhm | 41 | 34 | 7 | {"prop1":"ac%","min1":120,"max1":120,"prop2":"balance3","min2":30,"max2":30,"prop3":"crush","min3":35,"max3":35,"prop4":"deadly","min4":15,"max4":15,"prop5":"str","min5":15,"max5":15} |
| Haemosu's Adament | Heaven's Brethren | xrs | 55 | 44 | 7 | {"prop1":"ac","min1":500,"max1":500,"prop2":"ac-miss","min2":35,"max2":35,"prop3":"hp","min3":75,"max3":75,"prop4":"ac-hth","min4":40,"max4":40,"prop5":"ease","min5":-20,"max5":-20} |
| Heaven's Taebaek | Heaven's Brethren | uts | 55 | 81 | 7 | {"prop1":"ac","min1":50,"max1":50,"prop2":"mana","min2":100,"max2":100,"prop3":"res-ltng","min3":30,"max3":30,"prop4":"thorns","min4":30,"max4":30,"prop5":"indestruct","min5":1,"max5":1,"prop6":"block","min6":25,"max6":25,"prop7":"block3","min7":30,"max7":30} |
| Hsarus' Iron Fist | Hsarus' Defense | buc | 4 | 3 | 7 | {"prop1":"red-dmg","min1":2,"max1":2,"prop2":"str","min2":10,"max2":10,"aprop1a":"ac/lvl","apar1a":20} |
| Hsarus' Iron Heel | Hsarus' Defense | mbt | 4 | 3 | 7 | {"prop1":"res-fire","min1":25,"max1":25,"prop2":"move2","min2":20,"max2":20,"aprop1a":"att/lvl","apar1a":20} |
| Hsarus' Iron Stay | Hsarus' Defense | mbl | 4 | 3 | 7 | {"prop1":"res-cold","min1":20,"max1":20,"prop2":"hp","min2":20,"max2":20,"aprop1a":"ac/lvl","apar1a":20} |
| Hwanin's Justice | Hwanin's Majesty | 9vo | 28 | 28 | 7 | {"prop1":"att","min1":330,"max1":330,"prop2":"indestruct","min2":1,"max2":1,"prop3":"hit-skill","par3":45,"min3":10,"max3":3,"prop4":"swing3","min4":40,"max4":40,"prop5":"dmg%","min5":200,"max5":200,"prop6":"dmg-ltng","min6":5,"max6":25} |
| Hwanin's Refuge | Hwanin's Majesty | xcl | 28 | 30 | 7 | {"prop1":"ac","min1":200,"max1":200,"prop2":"res-pois","min2":27,"max2":27,"prop3":"hp","min3":100,"max3":100,"prop4":"gethit-skill","par4":42,"min4":10,"max4":3} |
| Hwanin's Seal | Hwanin's Majesty | mbl | 28 | 35 | 7 | {"prop1":"dmg-ltng","min1":3,"max1":33,"prop2":"noheal","min2":1,"max2":1,"prop3":"ac/lvl","par3":12,"prop4":"dmg-to-mana","min4":12,"max4":12} |
| Hwanin's Splendor | Hwanin's Majesty | xrn | 28 | 45 | 7 | {"prop1":"regen","min1":20,"max1":20,"prop2":"red-mag","min2":10,"max2":10,"prop3":"res-cold","min3":37,"max3":37,"prop4":"ac%","min4":100,"max4":100} |
| Immortal King's Detail | Immortal King | zhb | 37 | 29 | 7 | {"prop1":"ac","min1":36,"max1":36,"prop2":"res-fire","min2":28,"max2":28,"prop3":"res-ltng","min3":31,"max3":31,"prop4":"str","min4":25,"max4":25,"aprop1a":"ac","amin1a":105,"amax1a":105,"aprop2a":"balance2","amin2a":25,"amax2a":25,"aprop3a":"ac%","amin3a":100,"amax3a":100,"aprop4a":"red-dmg%","amin4a":20,"amax4a":20,"aprop5a":"skilltab","apar5a":13,"amin5a":2,"amax5a":2} |
| Immortal King's Forge | Immortal King | xhg | 37 | 30 | 7 | {"prop1":"ac","min1":65,"max1":65,"prop2":"str","min2":20,"max2":20,"prop3":"dex","min3":20,"max3":20,"prop4":"gethit-skill","par4":38,"min4":12,"max4":4,"aprop1a":"swing2","amin1a":25,"amax1a":25,"aprop2a":"ac","amin2a":120,"amax2a":120,"aprop3a":"lifesteal","amin3a":10,"amax3a":10,"aprop4a":"manasteal","amin4a":10,"amax4a":10,"aprop5a":"freeze","amin5a":2,"amax5a":2} |
| Immortal King's Pillar | Immortal King | xhb | 37 | 31 | 7 | {"prop1":"ac","min1":75,"max1":75,"prop2":"move3","min2":40,"max2":40,"prop3":"att","min3":110,"max3":110,"prop4":"hp","min4":44,"max4":44,"aprop1a":"mag%","amin1a":25,"amax1a":25,"aprop2a":"skilltab","apar2a":12,"amin2a":2,"amax2a":2,"aprop3a":"ac","amin3a":160,"amax3a":160,"aprop4a":"half-freeze","amin4a":1,"amax4a":1} |
| Immortal King's Soul Cage | Immortal King | uar | 37 | 76 | 7 | {"prop1":"ac","min1":400,"max1":400,"prop2":"gethit-skill","par2":52,"min2":5,"max2":5,"prop3":"skilltab","par3":12,"min3":2,"max3":2,"prop4":"res-pois","min4":50,"max4":50,"aprop1a":"balance2","amin1a":25,"amax1a":25,"aprop2a":"res-cold","amin2a":40,"amax2a":40,"aprop3a":"res-fire","amin3a":40,"amax3a":40,"aprop4a":"res-ltng","amin4a":40,"amax4a":40,"aprop5a":"ac%","amin5a":50,"amax5a":50} |
| Immortal King's Stone Crusher | Immortal King | 7m7 | 37 | 76 | 7 | {"prop1":"indestruct","min1":1,"max1":1,"prop2":"swing3","min2":40,"max2":40,"prop3":"dmg-demon","min3":200,"max3":200,"prop4":"dmg-undead","min4":200,"max4":200,"prop5":"crush","min5":35,"max5":40,"prop6":"dmg%","min6":200,"max6":200,"prop7":"sock","min7":2,"max7":2,"aprop1a":"dmg-fire","amin1a":211,"amax1a":397,"aprop2a":"dmg-ltng","amin2a":7,"amax2a":477,"aprop3a":"dmg-cold","apar3a":150,"amin3a":127,"amax3a":364,"aprop4a":"dmg-pois","apar4a":150,"amin4a":349,"amax4a":349,"aprop5a":"dmg-mag","amin5a":250,"amax5a":361} |
| Immortal King's Will | Immortal King | ba5 | 37 | 47 | 7 | {"prop1":"ac","min1":125,"max1":125,"prop2":"gold%","min2":37,"max2":37,"prop3":"skilltab","par3":14,"min3":2,"max3":2,"prop4":"light","min4":4,"max4":4,"prop5":"mag%","min5":25,"max5":40,"prop6":"sock","min6":2,"max6":2} |
| Infernal Cranium | Infernal Tools | cap | 7 | 5 | 7 | {"prop1":"res-all","min1":10,"max1":10,"prop2":"dmg-to-mana","min2":20,"max2":20,"aprop1a":"ac/lvl","apar1a":16} |
| Infernal Sign | Infernal Tools | tbl | 7 | 5 | 7 | {"prop1":"ac","min1":25,"max1":25,"prop2":"hp","min2":20,"max2":20,"aprop1a":"res-pois","amin1a":25,"amax1a":25,"aprop2a":"half-freeze","amin2a":1,"amax2a":1} |
| Infernal Torch | Infernal Tools | gwn | 7 | 5 | 7 | {"prop1":"dmg-min","min1":8,"max1":8,"prop2":"nec","min2":1,"max2":1,"aprop1a":"att/lvl","apar1a":20} |
| Iratha's Coil | Iratha's Finery | crn | 21 | 15 | 7 | {"prop1":"res-fire","min1":30,"max1":30,"prop2":"res-ltng","min2":30,"max2":30,"aprop1a":"ac/lvl","apar1a":16} |
| Iratha's Collar | Iratha's Finery | amu | 21 | 15 | 7 | {"prop1":"res-pois","min1":30,"max1":30,"prop2":"res-pois-len","min2":75,"max2":75,"aprop1a":"res-all","amin1a":15,"amax1a":15} |
| Iratha's Cord | Iratha's Finery | tbl | 21 | 15 | 7 | {"prop1":"ac","min1":25,"max1":25,"prop2":"dmg-min","min2":5,"max2":5,"aprop1a":"dex","amin1a":10,"amax1a":10} |
| Iratha's Cuff | Iratha's Finery | tgl | 21 | 15 | 7 | {"prop1":"res-cold","min1":30,"max1":30,"prop2":"half-freeze","min2":1,"max2":1,"aprop1a":"swing2","amin1a":20,"amax1a":20} |
| Isenhart's Case | Isenhart's Armory | brs | 11 | 8 | 7 | {"prop1":"ac","min1":40,"max1":40,"prop2":"red-mag","min2":2,"max2":2,"aprop1a":"ac/lvl","apar1a":16} |
| Isenhart's Horns | Isenhart's Armory | fhl | 11 | 8 | 7 | {"prop1":"dex","min1":6,"max1":6,"prop2":"red-dmg","min2":2,"max2":2,"aprop1a":"res-all","amin1a":8,"amax1a":8} |
| Isenhart's Lightbrand | Isenhart's Armory | bsd | 11 | 8 | 7 | {"prop1":"dmg-min","min1":10,"max1":10,"prop2":"swing2","min2":20,"max2":20,"aprop1a":"att/lvl","apar1a":10} |
| Isenhart's Parry | Isenhart's Armory | gts | 11 | 8 | 7 | {"prop1":"ac","min1":40,"max1":40,"prop2":"light-thorns","min2":4,"max2":4,"aprop1a":"res-all","amin1a":8,"amax1a":8} |
| Laying of Hands | The Disciple | ulg | 39 | 63 | 7 | {"prop1":"ac","min1":25,"max1":25,"prop2":"swing2","min2":20,"max2":20,"prop3":"res-fire","min3":50,"max3":50,"prop4":"dmg-demon","min4":350,"max4":350,"prop5":"hit-skill","par5":101,"min5":10,"max5":3} |
| M'avina's Caster | M'avina's Battle Hymn | amc | 21 | 70 | 7 | {"prop1":"dmg%","min1":188,"max1":188,"prop2":"swing3","min2":40,"max2":40,"prop3":"magicarrow","min3":1,"max3":1,"prop4":"att","min4":50,"max4":50,"aprop1a":"dmg-mag","amin1a":114,"amax1a":377,"aprop2a":"hit-skill","apar2a":"Nova","amin2a":10,"amax2a":15,"aprop3a":"skilltab","amin3a":2,"amax3a":2} |
| M'avina's Embrace | M'avina's Battle Hymn | uld | 21 | 70 | 7 | {"prop1":"gethit-skill","par1":55,"min1":10,"max1":3,"prop2":"ease","min2":-30,"max2":-30,"prop3":"red-mag","min3":5,"max3":12,"prop4":"skilltab","par4":1,"min4":2,"max4":2,"prop5":"ac/lvl","par5":32,"prop6":"ac","min6":350,"max6":350,"aprop2a":"balance2","amin2a":30,"amax2a":30} |
| M'avina's Icy Clutch | M'avina's Battle Hymn | xtg | 21 | 32 | 7 | {"prop1":"ac","min1":45,"max1":50,"prop2":"dmg-cold","par2":150,"min2":6,"max2":18,"prop3":"half-freeze","min3":1,"max3":1,"prop4":"gold%","min4":56,"max4":56,"prop5":"str","min5":10,"max5":10,"prop6":"dex","min6":15,"max6":15,"aprop3a":"dmg-cold","apar3a":100,"amin3a":131,"amax3a":252,"aprop4a":"extra-cold","amin4a":20,"amax4a":20} |
| M'avina's Tenet | M'avina's Battle Hymn | zvb | 21 | 45 | 7 | {"prop1":"ac","min1":50,"max1":50,"prop2":"move2","min2":20,"max2":20,"prop3":"manasteal","min3":5,"max3":5,"prop4":"light","min4":5,"max4":5,"aprop3a":"res-all","amin3a":25,"amax3a":25} |
| M'avina's True Sight | M'avina's Battle Hymn | ci3 | 21 | 59 | 7 | {"prop1":"ac","min1":150,"max1":150,"prop2":"regen","min2":10,"max2":10,"prop3":"swing2","min3":30,"max3":30,"prop4":"mana","min4":25,"max4":25,"aprop1a":"allskills","amin1a":1,"amax1a":1,"aprop2a":"att%","amin2a":50,"amax2a":50,"aprop3a":"res-all","amin3a":25,"amax3a":25} |
| Magnus' Skin | Orphan's Call | xvg | 41 | 37 | 7 | {"prop1":"ac%","min1":50,"max1":50,"prop2":"res-fire","min2":15,"max2":15,"prop3":"swing2","min3":20,"max3":20,"prop4":"light","min4":3,"max4":3,"prop5":"att","min5":100,"max5":100} |
| McAuley's Paragon | McAuley's Folly | cap | 20 | 25 | 3 | {"prop1":"mag%","min1":35,"max1":35,"prop2":"thorns","min2":8,"max2":8,"prop3":"ac/lvl","par3":8} |
| McAuley's Riprap | McAuley's Folly | vbt | 20 | 20 | 7 | {"prop1":"move3","min1":40,"max1":40,"prop2":"att","min2":100,"max2":100,"prop3":"str","min3":5,"max3":5,"prop4":"dex","min4":10,"max4":10} |
| McAuley's Superstition | McAuley's Folly | bwn | 20 | 25 | 7 | {"prop1":"dmg%","par1":2,"min1":75,"max1":75,"prop2":"mana","min2":25,"max2":25,"prop3":"manasteal","min3":8,"max3":8,"prop4":"cast3","min4":20,"max4":20,"prop5":"dmg-cold","par5":50,"min5":25,"max5":75} |
| McAuley's Taboo | McAuley's Folly | vgl | 20 | 28 | 7 | {"prop1":"ac","min1":20,"max1":25,"prop2":"swing2","min2":20,"max2":20,"prop3":"hp","min3":40,"max3":40,"prop4":"dmg-pois","par4":75,"min4":30,"max4":36} |
| Milabrega's Diadem | Milabrega's Regalia | crn | 23 | 17 | 7 | {"prop1":"hp","min1":15,"max1":15,"prop2":"mana","min2":15,"max2":15,"aprop1a":"res-cold","amin1a":40,"amax1a":40} |
| Milabrega's Orb | Milabrega's Regalia | kit | 23 | 17 | 7 | {"prop1":"mag%","min1":20,"max1":20,"prop2":"ac","min2":25,"max2":25,"aprop1a":"hp","amin1a":50,"amax1a":50,"aprop2a":"ac%","amin2a":50,"amax2a":50} |
| Milabrega's Robe | Milabrega's Regalia | aar | 23 | 17 | 7 | {"prop1":"thorns","min1":3,"max1":3,"prop2":"red-dmg","min2":2,"max2":2,"aprop1a":"ac%","amin1a":100,"amax1a":100} |
| Milabrega's Rod | Milabrega's Regalia | wsp | 23 | 17 | 7 | {"prop1":"pal","min1":1,"max1":1,"prop2":"dmg%","min2":50,"max2":50,"prop3":"light","min3":2,"max3":2} |
| Naj's Circlet | Naj's Ancient Set | ci0 | 43 | 28 | 7 | {"prop1":"ac","min1":75,"max1":75,"prop2":"dmg-fire","min2":25,"max2":35,"prop3":"Light","min3":5,"max3":5,"prop4":"str","min4":15,"max4":15,"prop5":"gethit-skill","par5":53,"min5":12,"max5":5} |
| Naj's Light Plate | Naj's Ancient Set | ult | 43 | 71 | 7 | {"prop1":"ease","min1":-60,"max1":-60,"prop2":"hp","min2":65,"max2":65,"prop3":"res-all","min3":25,"max3":25,"prop4":"dmg-to-mana","min4":45,"max4":45,"prop5":"allskills","min5":1,"max5":1,"prop6":"ac","min6":300,"max6":300} |
| Naj's Puzzler | Naj's Ancient Set | 6cs | 43 | 78 | 7 | {"prop1":"enr","min1":35,"max1":35,"prop2":"dmg%","min2":150,"max2":150,"prop3":"charged","par3":54,"min3":69,"max3":11,"prop4":"cast3","min4":30,"max4":30,"prop5":"dmg-ltng","min5":6,"max5":45,"prop6":"mana","min6":70,"max6":70,"prop7":"allskills","min7":1,"max7":1} |
| Natalya's Mark | Natalya's Odium | 7qr | 22 | 79 | 7 | {"prop1":"swing3","min1":40,"max1":40,"prop2":"dmg%","min2":200,"max2":200,"prop3":"ignore-ac","min3":1,"max3":1,"prop4":"dmg-cold","par4":100,"min4":50,"max4":50,"prop5":"dmg-fire","min5":12,"max5":17,"prop6":"dmg-undead","min6":200,"max6":200,"prop7":"dmg-demon","min7":200,"max7":200} |
| Natalya's Shadow | Natalya's Odium | ucl | 22 | 73 | 7 | {"prop1":"ac","min1":150,"max1":225,"prop2":"hp/lvl","par2":8,"prop3":"skilltab","par3":19,"min3":2,"max3":2,"prop4":"res-pois-len","min4":75,"max4":75,"prop5":"res-pois","min5":25,"max5":25,"prop6":"sock","min6":1,"max6":3} |
| Natalya's Soul | Natalya's Odium | xmb | 22 | 25 | 7 | {"prop1":"ac","min1":75,"max1":125,"prop2":"move3","min2":40,"max2":40,"prop3":"regen-stam/lvl","par3":2,"prop4":"dur","min4":50,"max4":50,"prop5":"res-cold","min5":15,"max5":25,"prop6":"res-ltng","min6":15,"max6":25} |
| Natalya's Totem | Natalya's Odium | xh9 | 22 | 59 | 7 | {"prop1":"ac","min1":135,"max1":175,"prop2":"dex","min2":20,"max2":30,"prop3":"str","min3":10,"max3":20,"prop4":"res-all","min4":10,"max4":20,"prop5":"red-mag","min5":3,"max5":3} |
| Ondal's Almighty | Heaven's Brethren | uhm | 55 | 69 | 7 | {"prop1":"ac","min1":50,"max1":50,"prop2":"ease","min2":-40,"max2":-40,"prop3":"hit-skill","par3":72,"min3":10,"max3":3,"prop4":"str","min4":10,"max4":10,"prop5":"dex","min5":15,"max5":15,"prop6":"balance3","min6":24,"max6":24} |
| Rite of Passage | The Disciple | xlb | 39 | 29 | 7 | {"prop1":"ac","min1":25,"max1":25,"prop2":"move3","min2":30,"max2":30,"prop3":"half-freeze","min3":1,"max3":1,"prop4":"stam","min4":15,"max4":25} |
| Sazabi's Cobalt Redeemer | Sazabi's Grand Tribute | 7ls | 34 | 73 | 7 | {"prop1":"dmg%","min1":150,"max1":150,"prop2":"dmg-cold","par2":50,"min2":25,"max2":35,"prop3":"swing3","min3":40,"max3":40,"prop4":"dmg-demon","min4":318,"max4":318,"prop5":"indestruct","min5":1,"max5":1,"prop6":"dex","min6":15,"max6":15,"prop7":"str","min7":5,"max7":5} |
| Sazabi's Ghost Liberator | Sazabi's Grand Tribute | upl | 34 | 67 | 7 | {"prop1":"ac","min1":400,"max1":400,"prop2":"balance3","min2":30,"max2":30,"prop3":"str","min3":25,"max3":25,"prop4":"att-demon","min4":300,"max4":300,"prop5":"hp","min5":50,"max5":75} |
| Sazabi's Mental Sheath | Sazabi's Grand Tribute | xhl | 34 | 43 | 7 | {"prop1":"ac","min1":100,"max1":100,"prop2":"allskills","min2":1,"max2":1,"prop3":"res-fire","min3":15,"max3":20,"prop4":"res-ltng","min4":15,"max4":20} |
| Sigon's Gage | Sigon's Complete Steel | hgl | 9 | 6 | 7 | {"prop1":"str","min1":10,"max1":10,"prop2":"att","min2":20,"max2":20,"aprop1a":"swing3","amin1a":30,"amax1a":30} |
| Sigon's Guard | Sigon's Complete Steel | tow | 9 | 6 | 7 | {"prop1":"allskills","min1":1,"max1":1,"prop2":"block","min2":20,"max2":20} |
| Sigon's Sabot | Sigon's Complete Steel | hbt | 9 | 6 | 7 | {"prop1":"move2","min1":20,"max1":20,"prop2":"res-cold","min2":40,"max2":40,"aprop1a":"att","amin1a":50,"amax1a":50,"aprop2a":"mag%","amin2a":50,"amax2a":50} |
| Sigon's Shelter | Sigon's Complete Steel | gth | 9 | 6 | 7 | {"prop1":"ac%","min1":25,"max1":25,"prop2":"res-ltng","min2":30,"max2":30,"aprop1a":"thorns","amin1a":20,"amax1a":20} |
| Sigon's Visor | Sigon's Complete Steel | ghm | 9 | 6 | 7 | {"prop1":"mana","min1":30,"max1":30,"prop2":"ac","min2":25,"max2":25,"aprop1a":"att/lvl","apar1a":16} |
| Sigon's Wrap | Sigon's Complete Steel | hbl | 9 | 6 | 7 | {"prop1":"res-fire","min1":20,"max1":20,"prop2":"hp","min2":20,"max2":20,"aprop1a":"ac/lvl","apar1a":16} |
| Spiritual Custodian | The Disciple | uui | 39 | 43 | 7 | {"prop1":"ac","min1":305,"max1":415,"prop2":"res-fire","min2":24,"max2":24,"prop3":"gethit-skill","par3":48,"min3":25,"max3":3,"prop4":"dmg-pois","par4":50,"min4":125,"max4":175} |
| Tal Rasha's Adjudication | Tal Rasha's Wrappings | amu | 26 | 67 | 1 | {"prop1":"res-ltng","min1":33,"max1":33,"prop2":"sor","min2":2,"max2":2,"prop3":"hp","min3":50,"max3":50,"prop4":"dmg-ltng","min4":3,"max4":32,"prop5":"mana","min5":42,"max5":42,"aprop3a":"cast2","amin3a":10,"amax3a":10} |
| Tal Rasha's Fire-Spun Cloth | Tal Rasha's Wrappings | zmb | 26 | 53 | 7 | {"prop1":"ease","min1":-20,"max1":-20,"prop2":"mana","min2":30,"max2":30,"prop3":"dex","min3":20,"max3":20,"prop4":"dmg-to-mana","min4":37,"max4":37,"prop5":"mag%","min5":10,"max5":15,"aprop1a":"ac","amin1a":60,"amax1a":60,"aprop2a":"cast2","amin2a":10,"amax2a":10} |
| Tal Rasha's Horadric Crest | Tal Rasha's Wrappings | xsk | 26 | 66 | 7 | {"prop1":"mana","min1":30,"max1":30,"prop2":"hp","min2":60,"max2":60,"prop3":"ac","min3":45,"max3":45,"prop4":"res-all","min4":15,"max4":15,"prop5":"lifesteal","min5":10,"max5":10,"prop6":"manasteal","min6":10,"max6":10} |
| Tal Rasha's Howling Wind | Tal Rasha's Wrappings | uth | 26 | 71 | 7 | {"prop1":"ease","min1":-60,"max1":-60,"prop2":"red-mag","min2":15,"max2":15,"prop3":"mag%","min3":88,"max3":88,"prop4":"res-cold","min4":40,"max4":40,"prop5":"res-fire","min5":40,"max5":40,"prop6":"res-ltng","min6":40,"max6":40,"prop7":"ac","min7":400,"max7":400,"aprop1a":"cast2","amin1a":10,"amax1a":10} |
| Tal Rasha's Lidless Eye | Tal Rasha's Wrappings | oba | 26 | 65 | 7 | {"prop1":"hp","min1":57,"max1":57,"prop2":"mana","min2":77,"max2":77,"prop3":"enr","min3":10,"max3":10,"prop4":"cast3","min4":20,"max4":20,"prop5":"skill","par5":"Fire Mastery","min5":1,"max5":2,"prop6":"skill","par6":"Lightning Mastery","min6":1,"max6":2,"prop7":"skill","par7":"Cold Mastery","min7":1,"max7":2,"aprop1a":"sor","amin1a":1,"amax1a":1,"aprop2a":"pierce-fire","amin2a":15,"amax2a":15,"aprop3a":"pierce-ltng","amin3a":15,"amax3a":15,"aprop4a":"extra-cold","amin4a":15,"amax4a":15} |
| Tancred's Crowbill | Tancred's Battlegear | mpi | 27 | 20 | 7 | {"prop1":"att","min1":75,"max1":75,"prop2":"dmg%","min2":80,"max2":80,"aprop1a":"mana","amin1a":20,"amax1a":20,"aprop2a":"swing2","amin2a":20,"amax2a":20} |
| Tancred's Hobnails | Tancred's Battlegear | lbt | 27 | 20 | 7 | {"prop1":"regen-stam","min1":25,"max1":25,"prop2":"dex","min2":10,"max2":10,"aprop1a":"move3","amin1a":30,"amax1a":30,"aprop2a":"str","amin2a":10,"amax2a":10} |
| Tancred's Skull | Tancred's Battlegear | bhm | 27 | 20 | 7 | {"prop1":"dmg%","min1":10,"max1":10,"prop2":"att","min2":40,"max2":40,"aprop1a":"res-all","amin1a":10,"amax1a":10} |
| Tancred's Spine | Tancred's Battlegear | ful | 27 | 20 | 7 | {"prop1":"hp","min1":40,"max1":40,"prop2":"str","min2":15,"max2":15,"aprop1a":"ac/lvl","apar1a":16} |
| Tancred's Weird | Tancred's Battlegear | amu | 27 | 20 | 7 | {"prop1":"red-dmg","min1":2,"max1":2,"prop2":"red-mag","min2":1,"max2":1,"aprop1a":"mag%","amin1a":78,"amax1a":78,"aprop2a":"att","amin2a":60,"amax2a":60} |
| Telling of Beads | The Disciple | amu | 39 | 30 | 1 | {"prop1":"res-pois","min1":35,"max1":50,"prop2":"allskills","min2":1,"max2":1,"prop3":"res-cold","min3":18,"max3":18,"prop4":"thorns","min4":8,"max4":10} |
| Trang-Oul's Claws | Trang-Oul's Avatar | xmg | 32 | 45 | 7 | {"prop1":"ac","min1":30,"max1":30,"prop2":"cast3","min2":20,"max2":20,"prop3":"res-cold","min3":30,"max3":30,"prop4":"skilltab","par4":6,"min4":2,"max4":2,"aprop3a":"extra-pois","amin3a":25,"amax3a":25} |
| Trang-Oul's Girth | Trang-Oul's Avatar | utc | 32 | 47 | 7 | {"prop1":"ac","min1":75,"max1":100,"prop2":"stam","min2":30,"max2":30,"prop3":"regen","min3":5,"max3":5,"prop4":"hp","min4":66,"max4":66,"prop5":"nofreeze","min5":1,"max5":1,"prop6":"ease","min6":-40,"max6":-40,"prop7":"mana","min7":25,"max7":50,"aprop2a":"res-cold","amin2a":40,"amax2a":40} |
| Trang-Oul's Guise | Trang-Oul's Avatar | uh9 | 32 | 65 | 7 | {"prop1":"ac","min1":80,"max1":100,"prop2":"balance2","min2":25,"max2":25,"prop3":"thorns","min3":20,"max3":20,"prop4":"mana","min4":150,"max4":150,"prop5":"regen","min5":5,"max5":5} |
| Trang-Oul's Scales | Trang-Oul's Avatar | xul | 32 | 49 | 7 | {"prop1":"ease","min1":-40,"max1":-40,"prop2":"ac-miss","min2":100,"max2":100,"prop3":"res-pois","min3":40,"max3":40,"prop4":"skilltab","par4":8,"min4":2,"max4":2,"prop5":"move3","min5":40,"max5":40,"prop6":"ac%","min6":150,"max6":150,"aprop2a":"res-ltng","amin2a":50,"amax2a":50,"aprop4a":"red-dmg%","amin4a":25,"amax4a":25} |
| Trang-Oul's Wing | Trang-Oul's Avatar | ne9 | 32 | 54 | 7 | {"prop1":"ac","min1":125,"max1":125,"prop2":"str","min2":25,"max2":25,"prop3":"dex","min3":15,"max3":15,"prop4":"res-fire","min4":38,"max4":45,"prop5":"block","min5":30,"max5":30,"prop6":"res-pois","min6":40,"max6":40,"prop7":"skilltab","par7":7,"min7":2,"max7":2,"aprop2a":"pierce-pois","amin2a":25,"amax2a":25,"aprop3a":"regen","amin3a":15,"amax3a":15} |
| Vidala's Ambush | Vidala's Rig | lea | 19 | 14 | 7 | {"prop1":"ac","min1":50,"max1":50,"prop2":"dex","min2":11,"max2":11,"aprop1a":"res-fire","amin1a":24,"amax1a":24,"aprop2a":"ac/lvl","apar2a":20} |
| Vidala's Barb | Vidala's Rig | lbb | 19 | 14 | 7 | {"prop1":"ltng-min","min1":1,"max1":1,"prop2":"ltng-max","min2":20,"max2":20,"aprop1a":"att/lvl","apar1a":16} |
| Vidala's Fetlock | Vidala's Rig | tbt | 19 | 14 | 7 | {"prop1":"stam","min1":150,"max1":150,"prop2":"move3","min2":30,"max2":30,"aprop1a":"res-all","amin1a":8,"amax1a":8} |
| Vidala's Snare | Vidala's Rig | amu | 19 | 14 | 7 | {"prop1":"hp","min1":15,"max1":15,"prop2":"res-cold","min2":20,"max2":20,"aprop1a":"mag%","amin1a":50,"amax1a":50} |
| Wihtstan's Guard | Orphan's Call | xml | 41 | 29 | 7 | {"prop1":"ac%","min1":175,"max1":175,"prop2":"block3","min2":40,"max2":40,"prop3":"block","min3":55,"max3":55,"prop4":"half-freeze","min4":1,"max4":1,"prop5":"light","min5":5,"max5":5} |
| Wilhelm's Pride | Orphan's Call | ztb | 41 | 42 | 7 | {"prop1":"ac%","min1":75,"max1":75,"prop2":"manasteal","min2":5,"max2":5,"prop3":"res-cold","min3":10,"max3":10,"prop4":"lifesteal","min4":5,"max4":5} |

## 魔法前缀定义（636 条）

| 名称 | version | spawnable | rare | level | maxlevel | levelreq | group | frequency | 允许类型 | 排除类型 | 属性字段 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Sturdy | 0 | 1 | 1 | 4 | 0 | 3 | 101 | 0 | armo | 无 | {"mod1code":"ac%","mod1min":20,"mod1max":30} |
| Strong | 0 | 1 | 1 | 9 | 0 | 6 | 101 | 0 | armo | 无 | {"mod1code":"ac%","mod1min":31,"mod1max":40} |
| Glorious | 0 | 1 | 1 | 19 | 0 | 14 | 101 | 0 | armo | 无 | {"mod1code":"ac%","mod1min":41,"mod1max":50} |
| Blessed | 0 | 1 | 1 | 25 | 0 | 18 | 101 | 0 | armo | 无 | {"mod1code":"ac%","mod1min":51,"mod1max":65} |
| Saintly | 0 | 1 | 1 | 31 | 0 | 23 | 101 | 0 | armo | 无 | {"mod1code":"ac%","mod1min":66,"mod1max":80} |
| Holy | 0 | 1 | 1 | 36 | 0 | 27 | 101 | 0 | armo | 无 | {"mod1code":"ac%","mod1min":81,"mod1max":100} |
| Devious | 0 | 1 | 1 | 7 | 0 | 5 | 103 | 0 | shld | 无 | {"mod1code":"red-mag","mod1min":1,"mod1max":1} |
| Fortified | 0 | 1 | 1 | 14 | 0 | 10 | 103 | 0 | shld | 无 | {"mod1code":"red-mag","mod1min":2,"mod1max":2} |
| Jagged | 0 | 1 | 1 | 1 | 0 | 1 | 106 | 0 | weap | 无 | {"mod1code":"dmg%","mod1min":10,"mod1max":20} |
| Deadly | 0 | 1 | 1 | 5 | 0 | 3 | 106 | 0 | weap | 无 | {"mod1code":"dmg%","mod1min":21,"mod1max":30} |
| Vicious | 0 | 1 | 1 | 8 | 0 | 6 | 106 | 0 | weap | 无 | {"mod1code":"dmg%","mod1min":31,"mod1max":40} |
| Brutal | 0 | 1 | 1 | 14 | 0 | 10 | 106 | 0 | weap | 无 | {"mod1code":"dmg%","mod1min":41,"mod1max":50} |
| Massive | 0 | 1 | 1 | 20 | 0 | 15 | 106 | 0 | weap | 无 | {"mod1code":"dmg%","mod1min":51,"mod1max":65} |
| Savage | 0 | 1 | 1 | 26 | 0 | 19 | 106 | 0 | weap | staf, wand | {"mod1code":"dmg%","mod1min":66,"mod1max":80} |
| Merciless | 0 | 1 | 1 | 32 | 0 | 24 | 106 | 0 | weap | staf, wand | {"mod1code":"dmg%","mod1min":81,"mod1max":100} |
| Vulpine | 0 | 1 | 1 | 9 | 0 | 6 | 107 | 0 | shld, amul | 无 | {"mod1code":"dmg-to-mana","mod1min":10,"mod1max":10} |
| Tireless | 0 | 1 | 1 | 14 | 0 | 10 | 109 | 0 | boot | 无 | {"mod1code":"regen-stam","mod1min":50,"mod1max":50} |
| Rugged | 0 | 1 | 1 | 14 | 0 | 10 | 110 | 0 | boot, glov, belt, ring, amul | 无 | {"mod1code":"stam","mod1min":5,"mod1max":10} |
| Bronze | 0 | 1 | 1 | 1 | 0 | 1 | 111 | 0 | weap, ring, glov, amul | 无 | {"mod1code":"att","mod1min":10,"mod1max":20} |
| Iron | 0 | 1 | 1 | 4 | 0 | 3 | 111 | 0 | weap, ring | 无 | {"mod1code":"att","mod1min":21,"mod1max":40} |
| Steel | 0 | 1 | 1 | 8 | 0 | 6 | 111 | 0 | weap, ring | 无 | {"mod1code":"att","mod1min":41,"mod1max":60} |
| Silver | 0 | 1 | 1 | 12 | 0 | 9 | 111 | 0 | weap, ring | 无 | {"mod1code":"att","mod1min":61,"mod1max":80} |
| Gold | 0 | 1 | 1 | 17 | 0 | 12 | 111 | 0 | weap | 无 | {"mod1code":"att","mod1min":81,"mod1max":100} |
| Platinum | 0 | 1 | 1 | 22 | 0 | 16 | 111 | 0 | weap, ring | 无 | {"mod1code":"att","mod1min":101,"mod1max":120} |
| Meteoric | 0 | 1 | 1 | 27 | 0 | 20 | 111 | 0 | weap, ring | staf, wand | {"mod1code":"att","mod1min":121,"mod1max":150} |
| Sharp | 0 | 1 | 1 | 5 | 0 | 3 | 112 | 0 | weap | 无 | {"mod1code":"att","mod1min":10,"mod1max":20,"mod2code":"dmg%","mod2min":10,"mod2max":20} |
| Fine | 0 | 1 | 1 | 9 | 0 | 6 | 112 | 0 | weap | 无 | {"mod1code":"att","mod1min":21,"mod1max":40,"mod2code":"dmg%","mod2min":21,"mod2max":30} |
| Warrior's | 0 | 1 | 1 | 15 | 0 | 11 | 112 | 0 | weap | 无 | {"mod1code":"att","mod1min":41,"mod1max":60,"mod2code":"dmg%","mod2min":31,"mod2max":40} |
| Soldier's | 0 | 1 | 1 | 21 | 0 | 15 | 112 | 0 | weap | 无 | {"mod1code":"att","mod1min":61,"mod1max":80,"mod2code":"dmg%","mod2min":41,"mod2max":50} |
| Knight's | 0 | 1 | 1 | 25 | 0 | 18 | 112 | 0 | weap | 无 | {"mod1code":"att","mod1min":81,"mod1max":100,"mod2code":"dmg%","mod2min":51,"mod2max":65} |
| Lord's | 0 | 1 | 1 | 30 | 0 | 22 | 112 | 0 | weap | staf, wand | {"mod1code":"att","mod1min":101,"mod1max":120,"mod2code":"dmg%","mod2min":66,"mod2max":80} |
| King's | 0 | 1 | 1 | 35 | 0 | 26 | 112 | 0 | weap | staf, wand | {"mod1code":"att","mod1min":121,"mod1max":150,"mod2code":"dmg%","mod2min":81,"mod2max":100} |
| Howling | 0 | 1 | 1 | 16 | 0 | 12 | 113 | 0 | weap | miss | {"mod1code":"howl","mod1min":128,"mod1max":128} |
| Fortuitous | 0 | 1 | 1 | 5 | 0 | 3 | 114 | 0 | ring, amul | 无 | {"mod1code":"mag%","mod1min":10,"mod1max":15} |
| Glimmering | 0 | 1 | 1 | 1 | 0 | 1 | 116 | 0 | armo, wand, staf, ring, amul | 无 | {"mod1code":"light","mod1min":1,"mod1max":1} |
| Glowing | 0 | 1 | 1 | 6 | 0 | 4 | 116 | 0 | armo, wand, staf, ring, amul | 无 | {"mod1code":"light","mod1min":2,"mod1max":2} |
| Lizard's | 0 | 1 | 1 | 3 | 0 | 2 | 118 | 0 | armo, ring, amul, rod | boot, glov | {"mod1code":"mana","mod1min":1,"mod1max":5} |
| Snake's | 0 | 1 | 1 | 6 | 0 | 4 | 118 | 0 | shld, rod, belt, ring, amul | 无 | {"mod1code":"mana","mod1min":5,"mod1max":10} |
| Serpent's | 0 | 1 | 1 | 14 | 0 | 10 | 118 | 0 | shld, rod, belt, ring, amul | 无 | {"mod1code":"mana","mod1min":11,"mod1max":20} |
| Serpent's | 0 | 1 | 1 | 37 | 0 | 27 | 118 | 0 | tors, helm, boot, glov, mele | h2h, rod | {"mod1code":"mana","mod1min":11,"mod1max":20} |
| Drake's | 0 | 1 | 1 | 20 | 0 | 15 | 118 | 0 | rod, ring, amul, belt | 无 | {"mod1code":"mana","mod1min":21,"mod1max":30} |
| Dragon's | 0 | 1 | 1 | 24 | 0 | 18 | 118 | 0 | rod, ring, amul | 无 | {"mod1code":"mana","mod1min":31,"mod1max":40} |
| Dragon's | 0 | 1 | 1 | 52 | 0 | 39 | 118 | 0 | tors, helm, boot, glov | 无 | {"mod1code":"mana","mod1min":31,"mod1max":40} |
| Wyrm's | 0 | 1 | 1 | 30 | 0 | 22 | 118 | 0 | rod, ring, amul | 无 | {"mod1code":"mana","mod1min":41,"mod1max":60} |
| Prismatic | 0 | 1 | 1 | 27 | 0 | 20 | 120 | 0 | amul | 无 | {"mod1code":"res-all","mod1min":15,"mod1max":25} |
| Prismatic | 0 | 1 | 1 | 62 | 0 | 46 | 120 | 0 | ring | 无 | {"mod1code":"res-all","mod1min":15,"mod1max":15} |
| Azure | 0 | 1 | 1 | 5 | 0 | 3 | 121 | 0 | armo, rod, miss, ring, amul | 无 | {"mod1code":"res-cold","mod1min":5,"mod1max":10} |
| Lapis | 0 | 1 | 1 | 12 | 0 | 9 | 121 | 0 | armo, ring, amul, rod | 无 | {"mod1code":"res-cold","mod1min":11,"mod1max":20} |
| Lapis | 0 | 1 | 1 | 35 | 0 | 26 | 121 | 0 | weap, glov | rod | {"mod1code":"res-cold","mod1min":11,"mod1max":20} |
| Cobalt | 0 | 1 | 1 | 18 | 0 | 13 | 121 | 0 | armo, ring, amul, rod | glov | {"mod1code":"res-cold","mod1min":21,"mod1max":30} |
| Cobalt | 0 | 1 | 1 | 55 | 0 | 41 | 121 | 0 | weap, glov | rod | {"mod1code":"res-cold","mod1min":21,"mod1max":30} |
| Sapphire | 0 | 1 | 1 | 25 | 0 | 18 | 121 | 0 | rod, boot, ring, amul, miss | scep | {"mod1code":"res-cold","mod1min":31,"mod1max":50} |
| Crimson | 0 | 1 | 1 | 5 | 0 | 3 | 122 | 0 | armo, rod, miss, ring, amul, amul | 无 | {"mod1code":"res-fire","mod1min":5,"mod1max":10} |
| Burgundy | 0 | 1 | 1 | 12 | 0 | 9 | 122 | 0 | armo, rod, ring, amul, amul | 无 | {"mod1code":"res-fire","mod1min":11,"mod1max":20} |
| Burgundy | 0 | 1 | 1 | 35 | 0 | 26 | 122 | 0 | weap | rod | {"mod1code":"res-fire","mod1min":11,"mod1max":20} |
| Garnet | 0 | 1 | 1 | 18 | 0 | 13 | 122 | 0 | armo, rod, ring, amul | glov | {"mod1code":"res-fire","mod1min":21,"mod1max":30} |
| Garnet | 0 | 1 | 1 | 55 | 0 | 41 | 122 | 0 | weap, glov | rod | {"mod1code":"res-fire","mod1min":21,"mod1max":30} |
| Ruby | 0 | 1 | 1 | 25 | 0 | 18 | 122 | 0 | wand, staf, boot, ring, amul | 无 | {"mod1code":"res-fire","mod1min":31,"mod1max":50} |
| Ocher | 0 | 1 | 1 | 5 | 0 | 3 | 123 | 0 | armo, rod, ring, amul, miss | 无 | {"mod1code":"res-ltng","mod1min":5,"mod1max":10} |
| Tangerine | 0 | 1 | 1 | 12 | 0 | 9 | 123 | 0 | armo, ring, amul, rod | 无 | {"mod1code":"res-ltng","mod1min":11,"mod1max":20} |
| Tangerine | 0 | 1 | 1 | 35 | 0 | 26 | 123 | 0 | weap | rod | {"mod1code":"res-ltng","mod1min":11,"mod1max":20} |
| Coral | 0 | 1 | 1 | 18 | 0 | 13 | 123 | 0 | armo, ring, amul, rod | glov | {"mod1code":"res-ltng","mod1min":21,"mod1max":30} |
| Coral | 0 | 1 | 1 | 55 | 0 | 41 | 123 | 0 | weap, glov | rod | {"mod1code":"res-ltng","mod1min":21,"mod1max":30} |
| Amber | 0 | 1 | 1 | 25 | 0 | 18 | 123 | 0 | armo, ring, amul, staf, wand | shld, glov | {"mod1code":"res-ltng","mod1min":31,"mod1max":50} |
| Beryl | 0 | 1 | 1 | 5 | 0 | 3 | 124 | 0 | armo, ring, amul, scep, staf, miss | 无 | {"mod1code":"res-pois","mod1min":5,"mod1max":10} |
| Jade | 0 | 1 | 1 | 12 | 0 | 9 | 124 | 0 | armo, ring, amul, scep, staf | 无 | {"mod1code":"res-pois","mod1min":11,"mod1max":20} |
| Jade | 0 | 1 | 1 | 35 | 0 | 26 | 124 | 0 | weap, ring | staf, scep | {"mod1code":"res-pois","mod1min":11,"mod1max":20} |
| Viridian | 0 | 1 | 1 | 18 | 0 | 13 | 124 | 0 | tors, helm, shld, scep, staf, ring, amul | 无 | {"mod1code":"res-pois","mod1min":21,"mod1max":30} |
| Viridian | 0 | 1 | 1 | 55 | 0 | 41 | 124 | 0 | weap, boot, glov, belt | staf, scep | {"mod1code":"res-pois","mod1min":21,"mod1max":30} |
| Emerald | 0 | 1 | 1 | 25 | 0 | 18 | 124 | 0 | scep, ring, amul | 无 | {"mod1code":"res-pois","mod1min":31,"mod1max":50} |
| Fletcher's | 0 | 1 | 1 | 30 | 0 | 22 | 125 | 0 | miss, amul | 无 | {"mod1code":"ama","mod1min":1,"mod1max":1} |
| Archer's | 0 | 1 | 1 | 40 | 0 | 30 | 125 | 0 | miss | 无 | {"mod1code":"ama","mod1min":2,"mod1max":2} |
| Archer's | 0 | 1 | 1 | 90 | 0 | 67 | 125 | 0 | amul | 无 | {"mod1code":"ama","mod1min":2,"mod1max":2} |
| Monk's | 0 | 1 | 1 | 30 | 0 | 22 | 126 | 0 | scep, amul | 无 | {"mod1code":"pal","mod1min":1,"mod1max":1} |
| Priest's | 0 | 1 | 1 | 40 | 0 | 30 | 126 | 0 | scep | 无 | {"mod1code":"pal","mod1min":2,"mod1max":2} |
| Priest's | 0 | 1 | 1 | 90 | 0 | 67 | 126 | 0 | amul | 无 | {"mod1code":"pal","mod1min":2,"mod1max":2} |
| Summoner's | 0 | 1 | 1 | 30 | 0 | 22 | 127 | 0 | wand, amul | 无 | {"mod1code":"nec","mod1min":1,"mod1max":1} |
| Necromancer's | 0 | 1 | 1 | 40 | 0 | 30 | 127 | 0 | wand | 无 | {"mod1code":"nec","mod1min":2,"mod1max":2} |
| Necromancer's | 0 | 1 | 1 | 90 | 0 | 67 | 127 | 0 | amul | 无 | {"mod1code":"nec","mod1min":2,"mod1max":2} |
| Angel's | 0 | 1 | 1 | 30 | 0 | 22 | 128 | 0 | staf, amul | 无 | {"mod1code":"sor","mod1min":1,"mod1max":1} |
| Arch-Angel's | 0 | 1 | 1 | 40 | 0 | 30 | 128 | 0 | staf | 无 | {"mod1code":"sor","mod1min":2,"mod1max":2} |
| Arch-Angel's | 0 | 1 | 1 | 90 | 0 | 67 | 128 | 0 | amul | 无 | {"mod1code":"sor","mod1min":2,"mod1max":2} |
| Slayer's | 0 | 1 | 1 | 30 | 0 | 22 | 129 | 0 | mele, amul | rod, h2h | {"mod1code":"bar","mod1min":1,"mod1max":1} |
| Berserker's | 0 | 1 | 1 | 40 | 0 | 30 | 129 | 0 | mele | rod, h2h | {"mod1code":"bar","mod1min":2,"mod1max":2} |
| Berserker's | 0 | 1 | 1 | 90 | 0 | 67 | 129 | 0 | amul | 无 | {"mod1code":"bar","mod1min":2,"mod1max":2} |
| Triumphant | 0 | 1 | 1 | 3 | 0 | 2 | 132 | 0 | mele, ring | 无 | {"mod1code":"mana-kill","mod1min":1,"mod1max":1} |
| Stout | 100 | 1 | 1 | 1 | 0 | 1 | 101 | 4 | lcha | 无 | {"mod1code":"ac","mod1min":3,"mod1max":5} |
| Stout | 100 | 1 | 1 | 7 | 0 | 5 | 101 | 4 | lcha | 无 | {"mod1code":"ac","mod1min":6,"mod1max":9} |
| Stout | 100 | 1 | 1 | 12 | 0 | 9 | 101 | 4 | lcha | 无 | {"mod1code":"ac","mod1min":10,"mod1max":12} |
| Burly | 100 | 1 | 1 | 17 | 0 | 12 | 101 | 4 | lcha | 无 | {"mod1code":"ac","mod1min":13,"mod1max":15} |
| Burly | 100 | 1 | 1 | 22 | 0 | 16 | 101 | 4 | lcha | 无 | {"mod1code":"ac","mod1min":16,"mod1max":22} |
| Burly | 100 | 1 | 1 | 27 | 0 | 20 | 101 | 4 | lcha | 无 | {"mod1code":"ac","mod1min":23,"mod1max":30} |
| Stalwart | 100 | 1 | 0 | 32 | 0 | 24 | 101 | 4 | lcha | 无 | {"mod1code":"ac","mod1min":33,"mod1max":40} |
| Stalwart | 100 | 1 | 0 | 37 | 0 | 29 | 101 | 4 | lcha | 无 | {"mod1code":"ac","mod1min":44,"mod1max":50} |
| Stalwart | 100 | 1 | 0 | 42 | 0 | 34 | 101 | 4 | lcha | 无 | {"mod1code":"ac","mod1min":60,"mod1max":100} |
| Stout | 100 | 1 | 1 | 1 | 0 | 1 | 101 | 4 | mcha | 无 | {"mod1code":"ac","mod1min":2,"mod1max":3} |
| Stout | 100 | 1 | 1 | 14 | 0 | 10 | 101 | 4 | mcha | 无 | {"mod1code":"ac","mod1min":4,"mod1max":6} |
| Stout | 100 | 1 | 1 | 20 | 0 | 15 | 101 | 4 | mcha | 无 | {"mod1code":"ac","mod1min":8,"mod1max":12} |
| Burly | 100 | 1 | 1 | 26 | 0 | 19 | 101 | 4 | mcha | 无 | {"mod1code":"ac","mod1min":13,"mod1max":18} |
| Burly | 100 | 1 | 1 | 32 | 0 | 24 | 101 | 4 | mcha | 无 | {"mod1code":"ac","mod1min":20,"mod1max":30} |
| Stalwart | 100 | 1 | 0 | 38 | 0 | 30 | 101 | 4 | mcha | 无 | {"mod1code":"ac","mod1min":30,"mod1max":40} |
| Stalwart | 100 | 1 | 0 | 45 | 0 | 37 | 101 | 4 | mcha | 无 | {"mod1code":"ac","mod1min":45,"mod1max":60} |
| Stout | 100 | 1 | 1 | 1 | 0 | 1 | 101 | 4 | scha | 无 | {"mod1code":"ac","mod1min":1,"mod1max":1} |
| Stout | 100 | 1 | 1 | 21 | 0 | 15 | 101 | 4 | scha | 无 | {"mod1code":"ac","mod1min":4,"mod1max":8} |
| Burly | 100 | 1 | 1 | 36 | 0 | 28 | 101 | 4 | scha | 无 | {"mod1code":"ac","mod1min":15,"mod1max":20} |
| Stalwart | 100 | 1 | 0 | 48 | 0 | 40 | 101 | 4 | scha | 无 | {"mod1code":"ac","mod1min":20,"mod1max":30} |
| Blanched | 100 | 1 | 1 | 1 | 0 | 1 | 101 | 4 | jewl | 无 | {"mod1code":"ac","mod1min":5,"mod1max":8} |
| Eburin | 100 | 1 | 1 | 16 | 0 | 12 | 101 | 4 | jewl | 无 | {"mod1code":"ac","mod1min":9,"mod1max":20} |
| Bone | 100 | 1 | 1 | 32 | 0 | 24 | 101 | 4 | jewl | 无 | {"mod1code":"ac","mod1min":21,"mod1max":40} |
| Ivory | 100 | 1 | 0 | 64 | 0 | 56 | 101 | 4 | jewl | 无 | {"mod1code":"ac","mod1min":41,"mod1max":64} |
| Sturdy | 1 | 1 | 1 | 1 | 0 | 1 | 101 | 9 | armo | 无 | {"mod1code":"ac%","mod1min":10,"mod1max":20} |
| Sturdy | 1 | 1 | 1 | 4 | 0 | 3 | 101 | 9 | armo | 无 | {"mod1code":"ac%","mod1min":21,"mod1max":30} |
| Strong | 1 | 1 | 1 | 9 | 0 | 6 | 101 | 8 | armo | 无 | {"mod1code":"ac%","mod1min":31,"mod1max":40} |
| Glorious | 1 | 1 | 1 | 19 | 0 | 14 | 101 | 8 | armo | 无 | {"mod1code":"ac%","mod1min":41,"mod1max":50} |
| Blessed | 1 | 1 | 1 | 25 | 0 | 18 | 101 | 7 | armo | 无 | {"mod1code":"ac%","mod1min":51,"mod1max":65} |
| Saintly | 1 | 1 | 1 | 31 | 0 | 23 | 101 | 7 | armo | 无 | {"mod1code":"ac%","mod1min":66,"mod1max":80} |
| Holy | 1 | 1 | 1 | 36 | 0 | 27 | 101 | 6 | armo | 无 | {"mod1code":"ac%","mod1min":81,"mod1max":100} |
| Godly | 100 | 1 | 0 | 45 | 0 | 38 | 101 | 3 | armo | 无 | {"mod1code":"ac%","mod1min":101,"mod1max":200} |
| Devious | 1 | 0 | 1 | 7 | 0 | 5 | 102 | 5 | shld, circ, orb, wand, staf | 无 | {"mod1code":"red-mag","mod1min":1,"mod1max":1} |
| Blank | 1 | 0 | 1 | 14 | 0 | 10 | 102 | 4 | shld, circ, orb, wand, staf | 无 | {"mod1code":"red-mag","mod1min":2,"mod1max":2} |
| Antimagic | 100 | 0 | 0 | 28 | 0 | 21 | 102 | 4 | shld, circ | 无 | {"mod1code":"red-mag","mod1min":6,"mod1max":10} |
| Red | 100 | 0 | 1 | 4 | 0 | 3 | 103 | 4 | lcha | 无 | {"mod1code":"dmg-min","mod1min":1,"mod1max":2} |
| Red | 100 | 0 | 1 | 16 | 0 | 12 | 103 | 4 | lcha | 无 | {"mod1code":"dmg-min","mod1min":3,"mod1max":3} |
| Sanguinary | 100 | 0 | 1 | 28 | 0 | 21 | 103 | 4 | lcha | 无 | {"mod1code":"dmg-min","mod1min":4,"mod1max":4} |
| Sanguinary | 100 | 0 | 1 | 40 | 0 | 32 | 103 | 4 | lcha | 无 | {"mod1code":"dmg-min","mod1min":5,"mod1max":6} |
| Bloody | 100 | 0 | 0 | 52 | 0 | 46 | 103 | 4 | lcha | 无 | {"mod1code":"dmg-min","mod1min":7,"mod1max":8} |
| Red | 100 | 0 | 1 | 11 | 0 | 8 | 103 | 4 | mcha | 无 | {"mod1code":"dmg-min","mod1min":1,"mod1max":2} |
| Sanguinary | 100 | 0 | 1 | 33 | 0 | 25 | 103 | 4 | mcha | 无 | {"mod1code":"dmg-min","mod1min":3,"mod1max":3} |
| Bloody | 100 | 0 | 0 | 55 | 0 | 47 | 103 | 4 | mcha | 无 | {"mod1code":"dmg-min","mod1min":4,"mod1max":4} |
| Red | 100 | 0 | 1 | 24 | 0 | 16 | 103 | 4 | scha | 无 | {"mod1code":"dmg-min","mod1min":1,"mod1max":1} |
| Sanguinary | 100 | 0 | 1 | 41 | 0 | 33 | 103 | 4 | scha | 无 | {"mod1code":"dmg-min","mod1min":2,"mod1max":2} |
| Bloody | 100 | 0 | 0 | 58 | 0 | 50 | 103 | 4 | scha | 无 | {"mod1code":"dmg-min","mod1min":3,"mod1max":3} |
| Scarlet | 100 | 1 | 1 | 8 | 0 | 6 | 103 | 4 | jewl | 无 | {"mod1code":"dmg-min","mod1min":1,"mod1max":4} |
| Crimson | 100 | 1 | 1 | 38 | 0 | 30 | 103 | 4 | jewl | 无 | {"mod1code":"dmg-min","mod1min":5,"mod1max":8} |
| Jagged | 100 | 0 | 1 | 3 | 0 | 2 | 104 | 4 | lcha | 无 | {"mod1code":"dmg-max","mod1min":1,"mod1max":2} |
| Jagged | 100 | 0 | 1 | 10 | 0 | 7 | 104 | 4 | lcha | 无 | {"mod1code":"dmg-max","mod1min":3,"mod1max":4} |
| Jagged | 100 | 0 | 1 | 17 | 0 | 12 | 104 | 4 | lcha | 无 | {"mod1code":"dmg-max","mod1min":5,"mod1max":6} |
| Forked | 100 | 0 | 1 | 25 | 0 | 18 | 104 | 4 | lcha | 无 | {"mod1code":"dmg-max","mod1min":7,"mod1max":8} |
| Forked | 100 | 0 | 1 | 32 | 0 | 24 | 104 | 4 | lcha | 无 | {"mod1code":"dmg-max","mod1min":9,"mod1max":10} |
| Serrated | 100 | 0 | 0 | 39 | 0 | 31 | 104 | 4 | lcha | 无 | {"mod1code":"dmg-max","mod1min":11,"mod1max":12} |
| Serrated | 100 | 0 | 0 | 47 | 0 | 39 | 104 | 4 | lcha | 无 | {"mod1code":"dmg-max","mod1min":13,"mod1max":14} |
| Jagged | 100 | 0 | 1 | 10 | 0 | 7 | 104 | 4 | mcha | 无 | {"mod1code":"dmg-max","mod1min":1,"mod1max":1} |
| Jagged | 100 | 0 | 1 | 20 | 0 | 15 | 104 | 4 | mcha | 无 | {"mod1code":"dmg-max","mod1min":2,"mod1max":2} |
| Forked | 100 | 0 | 1 | 30 | 0 | 22 | 104 | 4 | mcha | 无 | {"mod1code":"dmg-max","mod1min":3,"mod1max":3} |
| Forked | 100 | 0 | 1 | 40 | 0 | 32 | 104 | 4 | mcha | 无 | {"mod1code":"dmg-max","mod1min":4,"mod1max":5} |
| Serrated | 100 | 0 | 0 | 50 | 0 | 42 | 104 | 4 | mcha | 无 | {"mod1code":"dmg-max","mod1min":6,"mod1max":7} |
| Jagged | 100 | 0 | 1 | 23 | 0 | 17 | 104 | 4 | scha | 无 | {"mod1code":"dmg-max","mod1min":1,"mod1max":1} |
| Forked | 100 | 0 | 1 | 38 | 0 | 30 | 104 | 4 | scha | 无 | {"mod1code":"dmg-max","mod1min":2,"mod1max":2} |
| Serrated | 100 | 0 | 0 | 53 | 0 | 45 | 104 | 4 | scha | 无 | {"mod1code":"dmg-max","mod1min":3,"mod1max":3} |
| Carbuncle | 100 | 1 | 1 | 12 | 0 | 9 | 104 | 4 | jewl | 无 | {"mod1code":"dmg-max","mod1min":1,"mod1max":5} |
| Carmine | 100 | 1 | 1 | 35 | 0 | 27 | 104 | 4 | jewl | 无 | {"mod1code":"dmg-max","mod1min":6,"mod1max":9} |
| Vermillion | 100 | 1 | 0 | 58 | 0 | 50 | 104 | 4 | jewl | 无 | {"mod1code":"dmg-max","mod1min":11,"mod1max":15} |
| Jagged | 1 | 1 | 1 | 1 | 0 | 1 | 105 | 9 | weap, circ | staf, wand, orb | {"mod1code":"dmg%","mod1min":10,"mod1max":20} |
| Deadly | 1 | 1 | 1 | 5 | 0 | 3 | 105 | 9 | weap, circ | staf, wand, orb | {"mod1code":"dmg%","mod1min":21,"mod1max":30} |
| Vicious | 1 | 1 | 1 | 8 | 0 | 6 | 105 | 8 | weap | staf, wand, orb | {"mod1code":"dmg%","mod1min":31,"mod1max":40} |
| Brutal | 1 | 1 | 1 | 14 | 0 | 10 | 105 | 8 | weap | staf, wand, orb | {"mod1code":"dmg%","mod1min":41,"mod1max":50} |
| Massive | 1 | 1 | 1 | 20 | 0 | 15 | 105 | 7 | weap | staf, wand, orb | {"mod1code":"dmg%","mod1min":51,"mod1max":65} |
| Savage | 1 | 1 | 1 | 26 | 0 | 19 | 105 | 7 | weap | staf, wand, orb | {"mod1code":"dmg%","mod1min":66,"mod1max":80} |
| Merciless | 1 | 1 | 1 | 32 | 0 | 24 | 105 | 6 | weap | staf, wand, orb | {"mod1code":"dmg%","mod1min":81,"mod1max":100} |
| Ferocious | 100 | 1 | 1 | 41 | 0 | 33 | 105 | 6 | weap | staf, wand, orb | {"mod1code":"dmg%","mod1min":101,"mod1max":200} |
| Cruel | 100 | 1 | 0 | 51 | 0 | 43 | 105 | 5 | weap | staf, wand, orb | {"mod1code":"dmg%","mod1min":201,"mod1max":300} |
| Cinnabar | 100 | 1 | 1 | 1 | 0 | 1 | 105 | 4 | jewl | 无 | {"mod1code":"dmg%","mod1min":5,"mod1max":10} |
| Rusty | 100 | 1 | 1 | 13 | 0 | 9 | 105 | 4 | jewl | 无 | {"mod1code":"dmg%","mod1min":11,"mod1max":20} |
| Realgar | 100 | 1 | 1 | 45 | 0 | 37 | 105 | 4 | jewl | 无 | {"mod1code":"dmg%","mod1min":21,"mod1max":30} |
| Ruby | 100 | 1 | 0 | 66 | 0 | 58 | 105 | 4 | jewl | 无 | {"mod1code":"dmg%","mod1min":31,"mod1max":40} |
| Vulpine | 1 | 1 | 1 | 9 | 0 | 6 | 107 | 3 | shld, amul, orb, staf | 无 | {"mod1code":"dmg-to-mana","mod1min":7,"mod1max":12} |
| Dun | 100 | 1 | 1 | 7 | 0 | 5 | 107 | 3 | jewl | 无 | {"mod1code":"dmg-to-mana","mod1min":7,"mod1max":12} |
| Tireless | 1 | 1 | 1 | 6 | 0 | 4 | 108 | 4 | boot | 无 | {"mod1code":"regen-stam","mod1min":25,"mod1max":25} |
| Tireless | 100 | 1 | 1 | 14 | 0 | 10 | 108 | 4 | boot | 无 | {"mod1code":"regen-stam","mod1min":50,"mod1max":50} |
| Brown | 100 | 1 | 1 | 39 | 0 | 31 | 108 | 4 | jewl | 无 | {"mod1code":"regen-stam","mod1min":10,"mod1max":15} |
| Rugged | 100 | 1 | 1 | 1 | 0 | 1 | 109 | 4 | lcha | 无 | {"mod1code":"stam","mod1min":12,"mod1max":24} |
| Rugged | 100 | 1 | 1 | 7 | 0 | 5 | 109 | 4 | lcha | 无 | {"mod1code":"stam","mod1min":25,"mod1max":36} |
| Rugged | 100 | 1 | 1 | 21 | 0 | 15 | 109 | 4 | lcha | 无 | {"mod1code":"stam","mod1min":37,"mod1max":50} |
| Rugged | 100 | 1 | 1 | 1 | 0 | 0 | 109 | 4 | mcha | 无 | {"mod1code":"stam","mod1min":8,"mod1max":16} |
| Rugged | 100 | 1 | 1 | 7 | 0 | 5 | 109 | 4 | mcha | 无 | {"mod1code":"stam","mod1min":17,"mod1max":25} |
| Rugged | 100 | 1 | 1 | 21 | 0 | 15 | 109 | 4 | mcha | 无 | {"mod1code":"stam","mod1min":26,"mod1max":32} |
| Rugged | 100 | 1 | 1 | 1 | 0 | 0 | 109 | 4 | scha | 无 | {"mod1code":"stam","mod1min":4,"mod1max":8} |
| Rugged | 100 | 1 | 1 | 21 | 0 | 15 | 109 | 4 | scha | 无 | {"mod1code":"stam","mod1min":9,"mod1max":16} |
| Rugged | 1 | 1 | 1 | 1 | 0 | 1 | 109 | 4 | boot, glov, belt, ring, amul, circ | 无 | {"mod1code":"stam","mod1min":5,"mod1max":10} |
| Rugged | 1 | 1 | 1 | 8 | 0 | 6 | 109 | 4 | boot, belt | 无 | {"mod1code":"stam","mod1min":11,"mod1max":20} |
| Rugged | 1 | 1 | 1 | 8 | 0 | 6 | 109 | 4 | ring, amul, circ | 无 | {"mod1code":"stam","mod1min":11,"mod1max":20} |
| Vigorous | 100 | 1 | 1 | 16 | 0 | 12 | 109 | 4 | boot, belt | 无 | {"mod1code":"stam","mod1min":21,"mod1max":30} |
| Chestnut | 100 | 1 | 1 | 1 | 0 | 1 | 109 | 4 | jewl | 无 | {"mod1code":"stam","mod1min":10,"mod1max":15} |
| Maroon | 100 | 1 | 1 | 17 | 0 | 12 | 109 | 4 | jewl | 无 | {"mod1code":"stam","mod1min":16,"mod1max":25} |
| Bronze | 100 | 1 | 1 | 1 | 0 | 1 | 110 | 4 | lcha | 无 | {"mod1code":"att","mod1min":6,"mod1max":12} |
| Bronze | 100 | 1 | 1 | 7 | 0 | 5 | 110 | 4 | lcha | 无 | {"mod1code":"att","mod1min":13,"mod1max":27} |
| Bronze | 100 | 1 | 1 | 13 | 0 | 9 | 110 | 4 | lcha | 无 | {"mod1code":"att","mod1min":28,"mod1max":42} |
| Iron | 100 | 1 | 1 | 19 | 0 | 14 | 110 | 4 | lcha | 无 | {"mod1code":"att","mod1min":43,"mod1max":57} |
| Iron | 100 | 1 | 1 | 25 | 0 | 18 | 110 | 4 | lcha | 无 | {"mod1code":"att","mod1min":58,"mod1max":72} |
| Iron | 100 | 1 | 1 | 31 | 0 | 23 | 110 | 4 | lcha | 无 | {"mod1code":"att","mod1min":73,"mod1max":87} |
| Steel | 100 | 1 | 0 | 37 | 0 | 29 | 110 | 4 | lcha | 无 | {"mod1code":"att","mod1min":88,"mod1max":102} |
| Steel | 100 | 1 | 0 | 43 | 0 | 35 | 110 | 4 | lcha | 无 | {"mod1code":"att","mod1min":103,"mod1max":117} |
| Steel | 100 | 1 | 0 | 49 | 0 | 41 | 110 | 4 | lcha | 无 | {"mod1code":"att","mod1min":118,"mod1max":132} |
| Bronze | 100 | 1 | 1 | 1 | 0 | 1 | 110 | 4 | mcha | 无 | {"mod1code":"att","mod1min":4,"mod1max":8} |
| Bronze | 100 | 1 | 1 | 7 | 0 | 5 | 110 | 4 | mcha | 无 | {"mod1code":"att","mod1min":6,"mod1max":12} |
| Bronze | 100 | 1 | 1 | 16 | 0 | 12 | 110 | 4 | mcha | 无 | {"mod1code":"att","mod1min":13,"mod1max":25} |
| Iron | 100 | 1 | 1 | 25 | 0 | 18 | 110 | 4 | mcha | 无 | {"mod1code":"att","mod1min":26,"mod1max":38} |
| Iron | 100 | 1 | 1 | 34 | 0 | 26 | 110 | 4 | mcha | 无 | {"mod1code":"att","mod1min":39,"mod1max":51} |
| Steel | 100 | 1 | 0 | 43 | 0 | 36 | 110 | 4 | mcha | 无 | {"mod1code":"att","mod1min":52,"mod1max":64} |
| Steel | 100 | 1 | 0 | 52 | 0 | 44 | 110 | 4 | mcha | 无 | {"mod1code":"att","mod1min":65,"mod1max":77} |
| Bronze | 100 | 1 | 1 | 1 | 0 | 1 | 110 | 4 | scha | 无 | {"mod1code":"att","mod1min":2,"mod1max":4} |
| Bronze | 100 | 1 | 1 | 21 | 0 | 15 | 110 | 4 | scha | 无 | {"mod1code":"att","mod1min":6,"mod1max":12} |
| Iron | 100 | 1 | 1 | 39 | 0 | 31 | 110 | 4 | scha | 无 | {"mod1code":"att","mod1min":13,"mod1max":24} |
| Steel | 100 | 1 | 0 | 57 | 0 | 49 | 110 | 4 | scha | 无 | {"mod1code":"att","mod1min":25,"mod1max":36} |
| Bronze | 1 | 1 | 1 | 1 | 0 | 1 | 110 | 8 | weap, ring, glov, amul, circ | staf, wand, orb | {"mod1code":"att","mod1min":10,"mod1max":20} |
| Iron | 1 | 1 | 1 | 4 | 0 | 3 | 110 | 8 | weap, ring, circ | staf, wand, orb | {"mod1code":"att","mod1min":21,"mod1max":40} |
| Steel | 1 | 1 | 1 | 8 | 0 | 6 | 110 | 7 | weap, ring, circ | staf, wand, orb | {"mod1code":"att","mod1min":41,"mod1max":60} |
| Silver | 1 | 1 | 1 | 12 | 0 | 9 | 110 | 7 | weap, ring, circ | staf, wand, orb | {"mod1code":"att","mod1min":61,"mod1max":80} |
| Gold | 1 | 1 | 1 | 17 | 0 | 12 | 110 | 6 | weap, ring, circ | staf, wand, orb | {"mod1code":"att","mod1min":81,"mod1max":100} |
| Platinum | 1 | 1 | 1 | 22 | 0 | 16 | 110 | 6 | weap, ring, circ | staf, wand, orb | {"mod1code":"att","mod1min":101,"mod1max":120} |
| Meteoric | 1 | 1 | 1 | 27 | 0 | 20 | 110 | 5 | weap | staf, wand, orb | {"mod1code":"att","mod1min":121,"mod1max":150} |
| Strange | 100 | 1 | 1 | 32 | 0 | 24 | 110 | 5 | weap | staf, wand, orb | {"mod1code":"att","mod1min":151,"mod1max":300} |
| Weird | 100 | 1 | 0 | 37 | 0 | 27 | 110 | 4 | weap | staf, wand, orb | {"mod1code":"att","mod1min":301,"mod1max":450} |
| Nickel | 100 | 1 | 1 | 1 | 0 | 1 | 110 | 4 | jewl | 无 | {"mod1code":"att","mod1min":10,"mod1max":20} |
| Tin | 100 | 1 | 1 | 8 | 0 | 6 | 110 | 4 | jewl | 无 | {"mod1code":"att","mod1min":21,"mod1max":40} |
| Silver | 100 | 1 | 1 | 25 | 0 | 18 | 110 | 4 | jewl | 无 | {"mod1code":"att","mod1min":41,"mod1max":60} |
| Argent | 100 | 1 | 0 | 44 | 0 | 36 | 110 | 4 | jewl | 无 | {"mod1code":"att","mod1min":61,"mod1max":100} |
| Fine | 100 | 1 | 1 | 15 | 0 | 11 | 111 | 4 | lcha | 无 | {"mod1code":"att","mod1min":10,"mod1max":20,"mod2code":"dmg-max","mod2min":1,"mod2max":3} |
| Fine | 100 | 1 | 1 | 22 | 0 | 16 | 111 | 4 | lcha | 无 | {"mod1code":"att","mod1min":21,"mod1max":48,"mod2code":"dmg-max","mod2min":4,"mod2max":6} |
| Sharp | 100 | 1 | 1 | 29 | 0 | 21 | 111 | 4 | lcha | 无 | {"mod1code":"att","mod1min":49,"mod1max":76,"mod2code":"dmg-max","mod2min":7,"mod2max":10} |
| Fine | 100 | 1 | 1 | 19 | 0 | 14 | 111 | 4 | mcha | 无 | {"mod1code":"att","mod1min":10,"mod1max":20,"mod2code":"dmg-max","mod2min":1,"mod2max":3} |
| Sharp | 100 | 1 | 1 | 28 | 0 | 21 | 111 | 4 | mcha | 无 | {"mod1code":"att","mod1min":21,"mod1max":48,"mod2code":"dmg-max","mod2min":4,"mod2max":6} |
| Fine | 100 | 1 | 0 | 28 | 0 | 21 | 111 | 4 | scha | 无 | {"mod1code":"att","mod1min":10,"mod1max":20,"mod2code":"dmg-max","mod2min":1,"mod2max":3} |
| Sharp | 1 | 1 | 1 | 5 | 0 | 3 | 111 | 9 | weap | staf, wand, orb | {"mod1code":"att","mod1min":10,"mod1max":20,"mod2code":"dmg%","mod2min":10,"mod2max":20} |
| Fine | 1 | 1 | 1 | 12 | 0 | 9 | 111 | 9 | weap | staf, wand, orb | {"mod1code":"att","mod1min":21,"mod1max":40,"mod2code":"dmg%","mod2min":21,"mod2max":30} |
| Warrior's | 1 | 1 | 1 | 19 | 0 | 13 | 111 | 8 | weap | staf, wand, orb | {"mod1code":"att","mod1min":41,"mod1max":60,"mod2code":"dmg%","mod2min":31,"mod2max":40} |
| Soldier's | 1 | 1 | 1 | 27 | 0 | 19 | 111 | 8 | weap | staf, wand, orb | {"mod1code":"att","mod1min":61,"mod1max":80,"mod2code":"dmg%","mod2min":41,"mod2max":50} |
| Knight's | 1 | 1 | 1 | 38 | 0 | 30 | 111 | 7 | weap | staf, wand, orb | {"mod1code":"att","mod1min":81,"mod1max":100,"mod2code":"dmg%","mod2min":51,"mod2max":65} |
| Lord's | 1 | 1 | 1 | 47 | 0 | 39 | 111 | 6 | weap | staf, wand, orb | {"mod1code":"att","mod1min":101,"mod1max":120,"mod2code":"dmg%","mod2min":66,"mod2max":80} |
| King's | 1 | 1 | 1 | 56 | 0 | 48 | 111 | 5 | weap | staf, wand, orb | {"mod1code":"att","mod1min":121,"mod1max":150,"mod2code":"dmg%","mod2min":81,"mod2max":100} |
| Master's | 100 | 1 | 1 | 56 | 0 | 48 | 111 | 5 | weap | staf, wand, orb | {"mod1code":"att","mod1min":151,"mod1max":250,"mod2code":"dmg%","mod2min":101,"mod2max":150} |
| Grandmaster's | 100 | 1 | 0 | 69 | 0 | 61 | 111 | 4 | weap | staf, wand, orb | {"mod1code":"att","mod1min":251,"mod1max":300,"mod2code":"dmg%","mod2min":151,"mod2max":200} |
| Glimmering | 1 | 1 | 1 | 1 | 0 | 1 | 112 | 1 | armo, wand, staf, ring, amul, orb | 无 | {"mod1code":"light","mod1min":1,"mod1max":1} |
| Glowing | 1 | 1 | 1 | 6 | 0 | 4 | 112 | 1 | armo, wand, staf, ring, amul, orb | 无 | {"mod1code":"light","mod1min":2,"mod1max":2} |
| Bright | 100 | 1 | 1 | 1 | 0 | 1 | 112 | 1 | jewl | 无 | {"mod1code":"light","mod1min":1,"mod1max":1,"mod2code":"att","mod2min":10,"mod2max":10} |
| Screaming | 100 | 1 | 1 | 10 | 0 | 7 | 113 | 3 | weap | miss, swor, axe, pole, spea | {"mod1code":"howl","mod1min":32,"mod1max":32} |
| Howling | 1 | 1 | 1 | 16 | 0 | 12 | 113 | 3 | weap | miss, swor, axe, pole, spea | {"mod1code":"howl","mod1min":64,"mod1max":64} |
| Wailing | 100 | 1 | 1 | 20 | 0 | 13 | 113 | 3 | weap | miss, swor, axe, pole, spea | {"mod1code":"howl","mod1min":128,"mod1max":128} |
| Screaming | 100 | 1 | 1 | 10 | 0 | 7 | 113 | 4 | miss | 无 | {"mod1code":"howl","mod1min":16,"mod1max":16} |
| Howling | 100 | 1 | 1 | 16 | 0 | 12 | 113 | 4 | miss | 无 | {"mod1code":"howl","mod1min":24,"mod1max":24} |
| Wailing | 100 | 1 | 0 | 24 | 0 | 18 | 113 | 4 | miss | 无 | {"mod1code":"howl","mod1min":32,"mod1max":32} |
| Lucky | 100 | 1 | 1 | 21 | 0 | 0 | 114 | 4 | lcha | 无 | {"mod1code":"mag%","mod1min":1,"mod1max":4} |
| Lucky | 100 | 1 | 0 | 38 | 0 | 0 | 114 | 4 | lcha | 无 | {"mod1code":"mag%","mod1min":5,"mod1max":7} |
| Lucky | 100 | 1 | 0 | 55 | 0 | 0 | 114 | 4 | lcha | 无 | {"mod1code":"mag%","mod1min":8,"mod1max":12} |
| Lucky | 100 | 1 | 1 | 34 | 0 | 0 | 114 | 4 | mcha | 无 | {"mod1code":"mag%","mod1min":1,"mod1max":1} |
| Lucky | 100 | 1 | 0 | 53 | 0 | 0 | 114 | 4 | mcha | 无 | {"mod1code":"mag%","mod1min":2,"mod1max":3} |
| Lucky | 100 | 1 | 0 | 51 | 0 | 0 | 114 | 4 | mcha | 无 | {"mod1code":"mag%","mod1min":4,"mod1max":6} |
| Felicitous | 100 | 1 | 1 | 5 | 0 | 3 | 114 | 4 | ring, amul, circ | 无 | {"mod1code":"mag%","mod1min":5,"mod1max":10} |
| Fortuitous | 1 | 1 | 0 | 12 | 0 | 8 | 114 | 4 | ring, amul, circ | 无 | {"mod1code":"mag%","mod1min":11,"mod1max":15} |
| Emerald | 100 | 1 | 1 | 16 | 0 | 12 | 114 | 4 | jewl | 无 | {"mod1code":"mag%","mod1min":3,"mod1max":7} |
| Lizard's | 100 | 1 | 1 | 1 | 0 | 1 | 115 | 4 | lcha | 无 | {"mod1code":"mana","mod1min":3,"mod1max":7} |
| Lizard's | 100 | 1 | 1 | 7 | 0 | 5 | 115 | 4 | lcha | 无 | {"mod1code":"mana","mod1min":8,"mod1max":13} |
| Lizard's | 100 | 1 | 1 | 13 | 0 | 9 | 115 | 4 | lcha | 无 | {"mod1code":"mana","mod1min":14,"mod1max":20} |
| Snake's | 100 | 1 | 1 | 19 | 0 | 14 | 115 | 4 | lcha | 无 | {"mod1code":"mana","mod1min":21,"mod1max":26} |
| Snake's | 100 | 1 | 1 | 25 | 0 | 18 | 115 | 4 | lcha | 无 | {"mod1code":"mana","mod1min":27,"mod1max":33} |
| Snake's | 100 | 1 | 1 | 31 | 0 | 23 | 115 | 4 | lcha | 无 | {"mod1code":"mana","mod1min":34,"mod1max":39} |
| Serpent's | 100 | 1 | 1 | 37 | 0 | 29 | 115 | 4 | lcha | 无 | {"mod1code":"mana","mod1min":40,"mod1max":46} |
| Serpent's | 100 | 1 | 1 | 43 | 0 | 35 | 115 | 4 | lcha | 无 | {"mod1code":"mana","mod1min":47,"mod1max":52} |
| Serpent's | 100 | 1 | 1 | 49 | 0 | 41 | 115 | 4 | lcha | 无 | {"mod1code":"mana","mod1min":53,"mod1max":59} |
| Lizard's | 100 | 1 | 1 | 1 | 0 | 1 | 115 | 4 | mcha | 无 | {"mod1code":"mana","mod1min":2,"mod1max":4} |
| Lizard's | 100 | 1 | 1 | 9 | 0 | 6 | 115 | 4 | mcha | 无 | {"mod1code":"mana","mod1min":5,"mod1max":7} |
| Lizard's | 100 | 1 | 1 | 17 | 0 | 12 | 115 | 4 | mcha | 无 | {"mod1code":"mana","mod1min":8,"mod1max":12} |
| Snake's | 100 | 1 | 1 | 25 | 0 | 18 | 115 | 4 | mcha | 无 | {"mod1code":"mana","mod1min":13,"mod1max":18} |
| Snake's | 100 | 1 | 1 | 33 | 0 | 25 | 115 | 4 | mcha | 无 | {"mod1code":"mana","mod1min":19,"mod1max":23} |
| Serpent's | 100 | 1 | 1 | 41 | 0 | 33 | 115 | 4 | mcha | 无 | {"mod1code":"mana","mod1min":24,"mod1max":29} |
| Serpent's | 100 | 1 | 1 | 49 | 0 | 41 | 115 | 4 | mcha | 无 | {"mod1code":"mana","mod1min":30,"mod1max":34} |
| Lizard's | 100 | 1 | 1 | 16 | 0 | 12 | 115 | 4 | scha | 无 | {"mod1code":"mana","mod1min":1,"mod1max":2} |
| Lizard's | 100 | 1 | 1 | 16 | 0 | 12 | 115 | 4 | scha | 无 | {"mod1code":"mana","mod1min":3,"mod1max":7} |
| Snake's | 100 | 1 | 1 | 32 | 0 | 24 | 115 | 4 | scha | 无 | {"mod1code":"mana","mod1min":8,"mod1max":12} |
| Serpent's | 100 | 1 | 0 | 48 | 0 | 40 | 115 | 4 | scha | 无 | {"mod1code":"mana","mod1min":13,"mod1max":17} |
| Lizard's | 1 | 1 | 1 | 3 | 0 | 2 | 115 | 4 | armo, ring, amul, rod, orb | boot, glov | {"mod1code":"mana","mod1min":3,"mod1max":5} |
| Snake's | 1 | 1 | 1 | 6 | 0 | 4 | 115 | 4 | shld, rod, belt, ring, amul, circ | 无 | {"mod1code":"mana","mod1min":5,"mod1max":10} |
| Serpent's | 1 | 1 | 1 | 14 | 0 | 10 | 115 | 3 | shld, rod, belt, ring, amul, circ | 无 | {"mod1code":"mana","mod1min":11,"mod1max":20} |
| Serpent's | 1 | 1 | 1 | 37 | 0 | 27 | 115 | 2 | tors, boot, glov, weap, orb | rod | {"mod1code":"mana","mod1min":11,"mod1max":20} |
| Drake's | 1 | 1 | 1 | 20 | 0 | 15 | 115 | 2 | rod, ring, amul, orb, circ | 无 | {"mod1code":"mana","mod1min":21,"mod1max":30} |
| Dragon's | 1 | 1 | 1 | 24 | 0 | 18 | 115 | 2 | rod, ring, amul, orb, circ | 无 | {"mod1code":"mana","mod1min":31,"mod1max":40} |
| Dragon's | 1 | 1 | 1 | 52 | 0 | 39 | 115 | 2 | tors, boot, glov | 无 | {"mod1code":"mana","mod1min":31,"mod1max":40} |
| Wyrm's | 1 | 1 | 1 | 30 | 0 | 22 | 115 | 2 | rod, ring, amul, orb, circ | 无 | {"mod1code":"mana","mod1min":41,"mod1max":60} |
| Great Wyrm's | 100 | 1 | 1 | 37 | 0 | 29 | 115 | 2 | rod, ring, amul, orb, circ | 无 | {"mod1code":"mana","mod1min":61,"mod1max":90} |
| Bahamut's | 100 | 1 | 0 | 45 | 0 | 37 | 115 | 2 | rod, ring, amul, orb, circ | 无 | {"mod1code":"mana","mod1min":91,"mod1max":120} |
| Zircon | 100 | 1 | 1 | 3 | 0 | 2 | 115 | 2 | jewl | 无 | {"mod1code":"mana","mod1min":5,"mod1max":10} |
| Jacinth | 100 | 1 | 1 | 17 | 0 | 12 | 115 | 2 | jewl | 无 | {"mod1code":"mana","mod1min":11,"mod1max":15} |
| Turquoise | 100 | 1 | 0 | 29 | 0 | 21 | 115 | 2 | jewl | 无 | {"mod1code":"mana","mod1min":16,"mod1max":20} |
| Shimmering | 100 | 1 | 0 | 8 | 13 | 6 | 116 | 1 | lcha | 无 | {"mod1code":"res-all","mod1min":3,"mod1max":6} |
| Shimmering | 100 | 1 | 0 | 14 | 34 | 10 | 116 | 1 | lcha | 无 | {"mod1code":"res-all","mod1min":8,"mod1max":12} |
| Shimmering | 100 | 1 | 0 | 35 | 0 | 27 | 116 | 1 | lcha | 无 | {"mod1code":"res-all","mod1min":13,"mod1max":15} |
| Shimmering | 100 | 1 | 0 | 17 | 33 | 12 | 116 | 1 | mcha | 无 | {"mod1code":"res-all","mod1min":3,"mod1max":5} |
| Shimmering | 100 | 1 | 0 | 34 | 0 | 26 | 116 | 1 | mcha | 无 | {"mod1code":"res-all","mod1min":6,"mod1max":8} |
| Shimmering | 100 | 1 | 0 | 33 | 0 | 25 | 116 | 1 | scha | 无 | {"mod1code":"res-all","mod1min":3,"mod1max":5} |
| Shimmering | 100 | 1 | 1 | 6 | 0 | 4 | 116 | 5 | shld | 无 | {"mod1code":"res-all","mod1min":3,"mod1max":7} |
| Rainbow | 100 | 1 | 1 | 18 | 0 | 13 | 116 | 5 | shld | 无 | {"mod1code":"res-all","mod1min":8,"mod1max":11} |
| Scintillating | 100 | 1 | 1 | 28 | 0 | 21 | 116 | 5 | shld | 无 | {"mod1code":"res-all","mod1min":12,"mod1max":15} |
| Prismatic | 1 | 1 | 1 | 39 | 0 | 31 | 116 | 4 | shld | 无 | {"mod1code":"res-all","mod1min":16,"mod1max":20} |
| Chromatic | 100 | 1 | 0 | 50 | 0 | 42 | 116 | 4 | shld | 无 | {"mod1code":"res-all","mod1min":21,"mod1max":30} |
| Shimmering | 100 | 1 | 1 | 8 | 0 | 6 | 116 | 5 | amul, circ | 无 | {"mod1code":"res-all","mod1min":3,"mod1max":7} |
| Rainbow | 100 | 1 | 1 | 21 | 0 | 15 | 116 | 5 | amul, circ | 无 | {"mod1code":"res-all","mod1min":8,"mod1max":11} |
| Scintillating | 100 | 1 | 1 | 34 | 0 | 25 | 116 | 5 | amul, circ | 无 | {"mod1code":"res-all","mod1min":12,"mod1max":15} |
| Prismatic | 1 | 1 | 1 | 42 | 0 | 31 | 116 | 4 | amul, circ | 无 | {"mod1code":"res-all","mod1min":16,"mod1max":20} |
| Chromatic | 100 | 1 | 0 | 55 | 0 | 41 | 116 | 3 | amul, circ | 无 | {"mod1code":"res-all","mod1min":21,"mod1max":30} |
| Shimmering | 100 | 1 | 1 | 45 | 0 | 37 | 116 | 3 | ring | 无 | {"mod1code":"res-all","mod1min":3,"mod1max":7} |
| Rainbow | 100 | 1 | 1 | 56 | 0 | 48 | 116 | 2 | ring | 无 | {"mod1code":"res-all","mod1min":8,"mod1max":11} |
| Scintillating | 100 | 1 | 0 | 67 | 0 | 59 | 116 | 2 | ring | 无 | {"mod1code":"res-all","mod1min":12,"mod1max":15} |
| Shimmering | 100 | 1 | 1 | 16 | 0 | 12 | 116 | 1 | jewl | 无 | {"mod1code":"res-all","mod1min":5,"mod1max":10} |
| Scintillating | 100 | 1 | 0 | 34 | 0 | 26 | 116 | 1 | jewl | 无 | {"mod1code":"res-all","mod1min":11,"mod1max":15} |
| Azure | 100 | 1 | 1 | 1 | 0 | 1 | 117 | 2 | lcha | 无 | {"mod1code":"res-cold","mod1min":7,"mod1max":15} |
| Lapis | 100 | 1 | 1 | 10 | 0 | 7 | 117 | 2 | lcha | 无 | {"mod1code":"res-cold","mod1min":16,"mod1max":20} |
| Cobalt | 100 | 1 | 1 | 20 | 0 | 15 | 117 | 2 | lcha | 无 | {"mod1code":"res-cold","mod1min":21,"mod1max":25} |
| Sapphire | 100 | 1 | 0 | 30 | 0 | 22 | 117 | 2 | lcha | 无 | {"mod1code":"res-cold","mod1min":26,"mod1max":30} |
| Azure | 100 | 1 | 1 | 1 | 0 | 1 | 117 | 2 | mcha | 无 | {"mod1code":"res-cold","mod1min":4,"mod1max":7} |
| Lapis | 100 | 1 | 1 | 16 | 0 | 12 | 117 | 2 | mcha | 无 | {"mod1code":"res-cold","mod1min":8,"mod1max":10} |
| Cobalt | 100 | 1 | 1 | 25 | 0 | 18 | 117 | 2 | mcha | 无 | {"mod1code":"res-cold","mod1min":11,"mod1max":12} |
| Sapphire | 100 | 1 | 0 | 35 | 0 | 27 | 117 | 2 | mcha | 无 | {"mod1code":"res-cold","mod1min":13,"mod1max":15} |
| Azure | 100 | 1 | 1 | 1 | 0 | 1 | 117 | 2 | scha | 无 | {"mod1code":"res-cold","mod1min":3,"mod1max":5} |
| Lapis | 100 | 1 | 1 | 14 | 0 | 10 | 117 | 2 | scha | 无 | {"mod1code":"res-cold","mod1min":6,"mod1max":7} |
| Cobalt | 100 | 1 | 1 | 27 | 0 | 20 | 117 | 2 | scha | 无 | {"mod1code":"res-cold","mod1min":8,"mod1max":9} |
| Sapphire | 100 | 1 | 0 | 40 | 0 | 32 | 117 | 2 | scha | 无 | {"mod1code":"res-cold","mod1min":10,"mod1max":11} |
| Azure | 1 | 1 | 1 | 5 | 0 | 3 | 117 | 2 | armo, weap, ring, amul, orb, circ | 无 | {"mod1code":"res-cold","mod1min":5,"mod1max":10} |
| Lapis | 1 | 1 | 1 | 12 | 0 | 9 | 117 | 4 | armo, ring, amul, orb, circ | 无 | {"mod1code":"res-cold","mod1min":11,"mod1max":20} |
| Lapis | 1 | 1 | 1 | 35 | 0 | 26 | 117 | 2 | weap | orb | {"mod1code":"res-cold","mod1min":11,"mod1max":20} |
| Cobalt | 1 | 1 | 1 | 18 | 0 | 13 | 117 | 3 | armo, ring, amul, orb, circ | 无 | {"mod1code":"res-cold","mod1min":21,"mod1max":30} |
| Cobalt | 1 | 1 | 1 | 55 | 0 | 41 | 117 | 2 | weap | orb | {"mod1code":"res-cold","mod1min":21,"mod1max":30} |
| Sapphire | 1 | 1 | 1 | 25 | 0 | 18 | 117 | 3 | rod, boot, amul, orb, circ | 无 | {"mod1code":"res-cold","mod1min":31,"mod1max":40} |
| Lapis Lazuli | 100 | 1 | 1 | 2 | 0 | 1 | 117 | 4 | jewl | 无 | {"mod1code":"res-cold","mod1min":5,"mod1max":15} |
| Sapphire | 100 | 1 | 1 | 19 | 0 | 14 | 117 | 4 | jewl | 无 | {"mod1code":"res-cold","mod1min":16,"mod1max":30} |
| Crimson | 100 | 1 | 1 | 1 | 0 | 1 | 118 | 2 | lcha | 无 | {"mod1code":"res-fire","mod1min":7,"mod1max":15} |
| Russet | 100 | 1 | 1 | 10 | 0 | 7 | 118 | 2 | lcha | 无 | {"mod1code":"res-fire","mod1min":16,"mod1max":20} |
| Garnet | 100 | 1 | 1 | 20 | 0 | 15 | 118 | 2 | lcha | 无 | {"mod1code":"res-fire","mod1min":21,"mod1max":25} |
| Ruby | 100 | 1 | 0 | 30 | 0 | 22 | 118 | 2 | lcha | 无 | {"mod1code":"res-fire","mod1min":26,"mod1max":30} |
| Crimson | 100 | 1 | 1 | 1 | 0 | 1 | 118 | 2 | mcha | 无 | {"mod1code":"res-fire","mod1min":4,"mod1max":7} |
| Russet | 100 | 1 | 1 | 16 | 0 | 12 | 118 | 2 | mcha | 无 | {"mod1code":"res-fire","mod1min":8,"mod1max":10} |
| Garnet | 100 | 1 | 1 | 25 | 0 | 18 | 118 | 2 | mcha | 无 | {"mod1code":"res-fire","mod1min":11,"mod1max":12} |
| Ruby | 100 | 1 | 0 | 35 | 0 | 27 | 118 | 2 | mcha | 无 | {"mod1code":"res-fire","mod1min":13,"mod1max":15} |
| Crimson | 100 | 1 | 1 | 1 | 0 | 1 | 118 | 2 | scha | 无 | {"mod1code":"res-fire","mod1min":3,"mod1max":5} |
| Russet | 100 | 1 | 1 | 14 | 0 | 10 | 118 | 2 | scha | 无 | {"mod1code":"res-fire","mod1min":6,"mod1max":7} |
| Garnet | 100 | 1 | 0 | 27 | 0 | 20 | 118 | 2 | scha | 无 | {"mod1code":"res-fire","mod1min":8,"mod1max":9} |
| Ruby | 100 | 1 | 1 | 40 | 0 | 32 | 118 | 2 | scha | 无 | {"mod1code":"res-fire","mod1min":10,"mod1max":11} |
| Russet | 1 | 1 | 1 | 12 | 0 | 9 | 118 | 4 | armo, ring, amul, orb, circ | 无 | {"mod1code":"res-fire","mod1min":11,"mod1max":20} |
| Russet | 1 | 1 | 1 | 35 | 0 | 26 | 118 | 1 | weap | orb | {"mod1code":"res-fire","mod1min":11,"mod1max":20} |
| Garnet | 1 | 1 | 1 | 18 | 0 | 13 | 118 | 3 | armo, ring, amul, orb, circ | 无 | {"mod1code":"res-fire","mod1min":21,"mod1max":30} |
| Garnet | 1 | 1 | 1 | 55 | 0 | 41 | 118 | 1 | weap | orb | {"mod1code":"res-fire","mod1min":21,"mod1max":30} |
| Ruby | 1 | 1 | 1 | 25 | 0 | 18 | 118 | 3 | rod, boot, amul, orb, circ | 无 | {"mod1code":"res-fire","mod1min":31,"mod1max":40} |
| Garnet | 100 | 1 | 1 | 2 | 0 | 1 | 117 | 4 | jewl | 无 | {"mod1code":"res-fire","mod1min":5,"mod1max":15} |
| Ruby | 100 | 1 | 1 | 18 | 0 | 13 | 117 | 4 | jewl | 无 | {"mod1code":"res-fire","mod1min":16,"mod1max":30} |
| Tangerine | 100 | 1 | 1 | 1 | 0 | 1 | 119 | 2 | lcha | 无 | {"mod1code":"res-ltng","mod1min":7,"mod1max":15} |
| Ocher | 100 | 1 | 1 | 10 | 0 | 7 | 119 | 2 | lcha | 无 | {"mod1code":"res-ltng","mod1min":16,"mod1max":20} |
| Coral | 100 | 1 | 1 | 20 | 0 | 15 | 119 | 2 | lcha | 无 | {"mod1code":"res-ltng","mod1min":21,"mod1max":25} |
| Amber | 100 | 1 | 0 | 30 | 0 | 22 | 119 | 2 | lcha | 无 | {"mod1code":"res-ltng","mod1min":26,"mod1max":30} |
| Tangerine | 100 | 1 | 1 | 1 | 0 | 1 | 119 | 2 | mcha | 无 | {"mod1code":"res-ltng","mod1min":4,"mod1max":7} |
| Ocher | 100 | 1 | 1 | 16 | 0 | 12 | 119 | 2 | mcha | 无 | {"mod1code":"res-ltng","mod1min":8,"mod1max":10} |
| Coral | 100 | 1 | 1 | 25 | 0 | 18 | 119 | 2 | mcha | 无 | {"mod1code":"res-ltng","mod1min":11,"mod1max":12} |
| Amber | 100 | 1 | 0 | 35 | 0 | 27 | 119 | 2 | mcha | 无 | {"mod1code":"res-ltng","mod1min":13,"mod1max":15} |
| Tangerine | 100 | 1 | 1 | 1 | 0 | 1 | 119 | 2 | scha | 无 | {"mod1code":"res-ltng","mod1min":3,"mod1max":5} |
| Ocher | 100 | 1 | 1 | 14 | 0 | 10 | 119 | 2 | scha | 无 | {"mod1code":"res-ltng","mod1min":6,"mod1max":7} |
| Coral | 100 | 1 | 1 | 27 | 0 | 20 | 119 | 2 | scha | 无 | {"mod1code":"res-ltng","mod1min":8,"mod1max":9} |
| Amber | 100 | 1 | 0 | 40 | 0 | 32 | 119 | 2 | scha | 无 | {"mod1code":"res-ltng","mod1min":10,"mod1max":11} |
| Tangerine | 1 | 1 | 1 | 5 | 0 | 3 | 119 | 4 | armo, weap, ring, amul, orb, circ | 无 | {"mod1code":"res-ltng","mod1min":5,"mod1max":10} |
| Ocher | 1 | 1 | 1 | 12 | 0 | 9 | 119 | 4 | armo, ring, amul, orb, circ | 无 | {"mod1code":"res-ltng","mod1min":11,"mod1max":20} |
| Ocher | 1 | 1 | 1 | 35 | 0 | 26 | 119 | 1 | weap | orb | {"mod1code":"res-ltng","mod1min":11,"mod1max":20} |
| Coral | 1 | 1 | 1 | 18 | 0 | 13 | 119 | 3 | armo, ring, amul, orb, circ | 无 | {"mod1code":"res-ltng","mod1min":21,"mod1max":30} |
| Coral | 1 | 1 | 1 | 55 | 0 | 41 | 119 | 1 | weap | orb | {"mod1code":"res-ltng","mod1min":21,"mod1max":30} |
| Amber | 1 | 1 | 1 | 25 | 0 | 18 | 119 | 3 | rod, boot, amul, orb, circ | 无 | {"mod1code":"res-ltng","mod1min":31,"mod1max":40} |
| Camphor | 100 | 1 | 1 | 2 | 0 | 1 | 117 | 4 | jewl | 无 | {"mod1code":"res-ltng","mod1min":5,"mod1max":15} |
| Ambergris | 100 | 1 | 1 | 19 | 0 | 14 | 117 | 4 | jewl | 无 | {"mod1code":"res-ltng","mod1min":16,"mod1max":30} |
| Beryl | 100 | 1 | 1 | 1 | 0 | 1 | 120 | 2 | lcha | 无 | {"mod1code":"res-pois","mod1min":7,"mod1max":15} |
| Viridian | 100 | 1 | 1 | 10 | 0 | 7 | 120 | 2 | lcha | 无 | {"mod1code":"res-pois","mod1min":16,"mod1max":20} |
| Jade | 100 | 1 | 1 | 20 | 0 | 15 | 120 | 2 | lcha | 无 | {"mod1code":"res-pois","mod1min":21,"mod1max":25} |
| Emerald | 100 | 1 | 0 | 30 | 0 | 22 | 120 | 2 | lcha | 无 | {"mod1code":"res-pois","mod1min":26,"mod1max":30} |
| Beryl | 100 | 1 | 1 | 1 | 0 | 1 | 120 | 2 | mcha | 无 | {"mod1code":"res-pois","mod1min":4,"mod1max":7} |
| Viridian | 100 | 1 | 1 | 16 | 0 | 12 | 120 | 2 | mcha | 无 | {"mod1code":"res-pois","mod1min":8,"mod1max":10} |
| Jade | 100 | 1 | 1 | 25 | 0 | 18 | 120 | 2 | mcha | 无 | {"mod1code":"res-pois","mod1min":11,"mod1max":12} |
| Emerald | 100 | 1 | 0 | 35 | 0 | 27 | 120 | 2 | mcha | 无 | {"mod1code":"res-pois","mod1min":13,"mod1max":15} |
| Beryl | 100 | 1 | 1 | 1 | 0 | 1 | 120 | 2 | scha | 无 | {"mod1code":"res-pois","mod1min":3,"mod1max":5} |
| Viridian | 100 | 1 | 1 | 14 | 0 | 10 | 120 | 2 | scha | 无 | {"mod1code":"res-pois","mod1min":6,"mod1max":7} |
| Jade | 100 | 1 | 1 | 27 | 0 | 20 | 120 | 2 | scha | 无 | {"mod1code":"res-pois","mod1min":8,"mod1max":9} |
| Emerald | 100 | 1 | 0 | 40 | 0 | 32 | 120 | 2 | scha | 无 | {"mod1code":"res-pois","mod1min":10,"mod1max":11} |
| Beryl | 1 | 1 | 1 | 5 | 0 | 3 | 120 | 4 | armo, weap, ring, amul, orb, circ | 无 | {"mod1code":"res-pois","mod1min":5,"mod1max":10} |
| Viridian | 1 | 1 | 1 | 12 | 0 | 9 | 120 | 4 | armo, ring, amul, orb, circ | 无 | {"mod1code":"res-pois","mod1min":11,"mod1max":20} |
| Viridian | 1 | 1 | 1 | 35 | 0 | 26 | 120 | 1 | weap | orb | {"mod1code":"res-pois","mod1min":11,"mod1max":20} |
| Jade | 1 | 1 | 1 | 18 | 0 | 13 | 120 | 3 | armo, ring, amul, orb, circ | 无 | {"mod1code":"res-pois","mod1min":21,"mod1max":30} |
| Jade | 1 | 1 | 1 | 55 | 0 | 41 | 120 | 1 | weap | orb | {"mod1code":"res-pois","mod1min":21,"mod1max":30} |
| Emerald | 1 | 1 | 1 | 25 | 0 | 18 | 120 | 3 | rod, boot, amul, orb, circ | 无 | {"mod1code":"res-pois","mod1min":31,"mod1max":40} |
| Beryl | 100 | 1 | 1 | 2 | 0 | 1 | 117 | 4 | jewl | 无 | {"mod1code":"res-pois","mod1min":5,"mod1max":15} |
| Jade | 100 | 1 | 1 | 19 | 0 | 14 | 117 | 4 | jewl | 无 | {"mod1code":"res-pois","mod1min":16,"mod1max":30} |
| Triumphant | 1 | 1 | 1 | 3 | 0 | 2 | 121 | 4 | weap, ring, circ | 无 | {"mod1code":"mana-kill","mod1min":1,"mod1max":1} |
| Victorious | 100 | 1 | 1 | 17 | 0 | 12 | 121 | 4 | weap, circ | 无 | {"mod1code":"mana-kill","mod1min":2,"mod1max":5} |
| Aureolin | 100 | 1 | 1 | 22 | 0 | 16 | 121 | 4 | jewl | 无 | {"mod1code":"mana-kill","mod1min":1,"mod1max":3} |
| Mechanist's | 100 | 1 | 1 | 10 | 0 | 7 | 122 | 3 | weap, shld, helm, tors, circ | thro | {"mod1code":"sock","mod1min":1,"mod1max":2} |
| Artificer's | 100 | 1 | 0 | 33 | 0 | 25 | 122 | 2 | weap, shld, helm, tors | thro | {"mod1code":"sock","mod1param":3} |
| Jeweler's | 100 | 1 | 0 | 55 | 0 | 47 | 122 | 1 | weap, shld, helm, tors | thro | {"mod1code":"sock","mod1param":4} |
| Assamic | 100 | 1 | 1 | 3 | 0 | 1 | 123 | 2 | weap, circ | wand, orb | {"mod1code":"att-demon","mod1min":25,"mod1max":50,"mod2code":"dmg-demon","mod2min":10,"mod2max":25} |
| Arcadian | 100 | 1 | 1 | 15 | 0 | 11 | 123 | 2 | weap, circ | wand, orb | {"mod1code":"att-demon","mod1min":51,"mod1max":100,"mod2code":"dmg-demon","mod2min":26,"mod2max":50} |
| Unearthly | 100 | 1 | 1 | 25 | 0 | 18 | 123 | 1 | weap | wand, orb | {"mod1code":"att-demon","mod1min":101,"mod1max":150,"mod2code":"dmg-demon","mod2min":51,"mod2max":100} |
| Astral | 100 | 1 | 1 | 35 | 0 | 26 | 123 | 1 | weap | wand, orb | {"mod1code":"att-demon","mod1min":151,"mod1max":200,"mod2code":"dmg-demon","mod2min":101,"mod2max":150} |
| Elysian | 100 | 1 | 1 | 45 | 0 | 33 | 123 | 1 | weap | wand, orb | {"mod1code":"att-demon","mod1min":201,"mod1max":300,"mod2code":"dmg-demon","mod2min":151,"mod2max":200} |
| Celestial | 100 | 1 | 0 | 55 | 0 | 41 | 123 | 1 | weap | wand, orb | {"mod1code":"att-demon","mod1min":301,"mod1max":400,"mod2code":"dmg-demon","mod2min":201,"mod2max":300} |
| Diamond | 100 | 1 | 1 | 26 | 0 | 19 | 123 | 1 | jewl | 无 | {"mod1code":"att-demon","mod1min":25,"mod1max":50,"mod2code":"dmg-demon","mod2min":25,"mod2max":40} |
| Fletcher's | 100 | 1 | 0 | 50 | 0 | 42 | 125 | 1 | lcha | 无 | {"mod1code":"skilltab","mod1min":1,"mod1max":1} |
| Acrobat's | 100 | 1 | 0 | 50 | 0 | 42 | 125 | 1 | lcha | 无 | {"mod1code":"skilltab","mod1param":1,"mod1min":1,"mod1max":1} |
| Harpoonist's | 100 | 1 | 0 | 50 | 0 | 42 | 125 | 1 | lcha | 无 | {"mod1code":"skilltab","mod1param":2,"mod1min":1,"mod1max":1} |
| Fletcher's | 100 | 1 | 1 | 20 | 0 | 15 | 125 | 1 | miss, glov | 无 | {"mod1code":"skilltab","mod1min":1,"mod1max":1} |
| Bowyer's | 100 | 1 | 1 | 40 | 0 | 30 | 125 | 1 | miss, glov | 无 | {"mod1code":"skilltab","mod1min":2,"mod1max":2} |
| Archer's | 100 | 1 | 0 | 60 | 0 | 45 | 125 | 1 | miss, glov | 无 | {"mod1code":"skilltab","mod1min":3,"mod1max":3} |
| Acrobat's | 100 | 1 | 1 | 20 | 0 | 15 | 125 | 1 | glov, amul, circ | 无 | {"mod1code":"skilltab","mod1param":1,"mod1min":1,"mod1max":1} |
| Gymnast's | 100 | 1 | 1 | 40 | 0 | 30 | 125 | 1 | glov, amul, circ | 无 | {"mod1code":"skilltab","mod1param":1,"mod1min":2,"mod1max":2} |
| Athlete's | 100 | 1 | 0 | 60 | 0 | 45 | 125 | 1 | glov, amul, circ | 无 | {"mod1code":"skilltab","mod1param":1,"mod1min":3,"mod1max":3} |
| Harpoonist's | 100 | 1 | 1 | 20 | 0 | 15 | 125 | 1 | spea, glov | 无 | {"mod1code":"skilltab","mod1param":2,"mod1min":1,"mod1max":1} |
| Spearmaiden's | 100 | 1 | 1 | 40 | 0 | 30 | 125 | 1 | spea, glov | 无 | {"mod1code":"skilltab","mod1param":2,"mod1min":2,"mod1max":2} |
| Lancer's | 100 | 1 | 0 | 60 | 0 | 45 | 125 | 1 | spea, glov | 无 | {"mod1code":"skilltab","mod1param":2,"mod1min":3,"mod1max":3} |
| Burning | 100 | 1 | 1 | 50 | 0 | 42 | 125 | 1 | lcha | 无 | {"mod1code":"skilltab","mod1param":3,"mod1min":1,"mod1max":1} |
| Sparking | 100 | 1 | 1 | 50 | 0 | 42 | 125 | 1 | lcha | 无 | {"mod1code":"skilltab","mod1param":4,"mod1min":1,"mod1max":1} |
| Chilling | 100 | 1 | 1 | 50 | 0 | 42 | 125 | 1 | lcha | 无 | {"mod1code":"skilltab","mod1param":5,"mod1min":1,"mod1max":1} |
| Burning | 100 | 1 | 1 | 20 | 0 | 15 | 125 | 1 | staff, orb, amul, circ | 无 | {"mod1code":"skilltab","mod1param":3,"mod1min":1,"mod1max":1} |
| Blazing | 100 | 1 | 1 | 40 | 0 | 30 | 125 | 1 | staff, orb, amul, circ | 无 | {"mod1code":"skilltab","mod1param":3,"mod1min":2,"mod1max":2} |
| Volcanic | 100 | 1 | 0 | 60 | 0 | 45 | 125 | 1 | staff, orb, amul, circ | 无 | {"mod1code":"skilltab","mod1param":3,"mod1min":3,"mod1max":3} |
| Sparking | 100 | 1 | 1 | 20 | 0 | 15 | 125 | 1 | staff, orb, amul, circ | 无 | {"mod1code":"skilltab","mod1param":4,"mod1min":1,"mod1max":1} |
| Charged | 100 | 1 | 1 | 40 | 0 | 30 | 125 | 1 | staff, orb, amul, circ | 无 | {"mod1code":"skilltab","mod1param":4,"mod1min":2,"mod1max":2} |
| Powered | 100 | 1 | 0 | 60 | 0 | 45 | 125 | 1 | staff, orb, amul, circ | 无 | {"mod1code":"skilltab","mod1param":4,"mod1min":3,"mod1max":3} |
| Chilling | 100 | 1 | 1 | 20 | 0 | 15 | 125 | 1 | staff, orb, amul, circ | 无 | {"mod1code":"skilltab","mod1param":5,"mod1min":1,"mod1max":1} |
| Freezing | 100 | 1 | 1 | 40 | 0 | 30 | 125 | 1 | staff, orb, amul, circ | 无 | {"mod1code":"skilltab","mod1param":5,"mod1min":2,"mod1max":2} |
| Glacial | 100 | 1 | 0 | 60 | 0 | 45 | 125 | 1 | staff, orb, amul, circ | 无 | {"mod1code":"skilltab","mod1param":5,"mod1min":3,"mod1max":3} |
| Hexing | 100 | 1 | 1 | 50 | 0 | 42 | 125 | 1 | lcha | 无 | {"mod1code":"skilltab","mod1param":6,"mod1min":1,"mod1max":1} |
| Fungal | 100 | 1 | 1 | 50 | 0 | 42 | 125 | 1 | lcha | 无 | {"mod1code":"skilltab","mod1param":7,"mod1min":1,"mod1max":1} |
| Graverobber's | 100 | 1 | 1 | 50 | 0 | 42 | 125 | 1 | lcha | 无 | {"mod1code":"skilltab","mod1param":8,"mod1min":1,"mod1max":1} |
| Hexing | 100 | 1 | 1 | 20 | 0 | 15 | 125 | 1 | wand, head, amul, circ | 无 | {"mod1code":"skilltab","mod1param":6,"mod1min":1,"mod1max":1} |
| Blighting | 100 | 1 | 1 | 40 | 0 | 30 | 125 | 1 | wand, head, amul, circ | 无 | {"mod1code":"skilltab","mod1param":6,"mod1min":2,"mod1max":2} |
| Accursed | 100 | 1 | 0 | 60 | 0 | 45 | 125 | 1 | wand, head, amul, circ | 无 | {"mod1code":"skilltab","mod1param":6,"mod1min":3,"mod1max":3} |
| Fungal | 100 | 1 | 1 | 20 | 0 | 15 | 125 | 1 | wand, head, amul, knif, circ | tkni | {"mod1code":"skilltab","mod1param":7,"mod1min":1,"mod1max":1} |
| Noxious | 100 | 1 | 1 | 40 | 0 | 30 | 125 | 1 | wand, head, amul, knif, circ | tkni | {"mod1code":"skilltab","mod1param":7,"mod1min":2,"mod1max":2} |
| Venomous | 100 | 1 | 0 | 60 | 0 | 45 | 125 | 1 | wand, head, amul, knif, circ | tkni | {"mod1code":"skilltab","mod1param":7,"mod1min":3,"mod1max":3} |
| Graverobber's | 100 | 1 | 1 | 20 | 0 | 15 | 125 | 1 | wand, head, amul, circ | 无 | {"mod1code":"skilltab","mod1param":8,"mod1min":1,"mod1max":1} |
| Vodoun | 100 | 1 | 1 | 40 | 0 | 30 | 125 | 1 | wand, head, amul, circ | 无 | {"mod1code":"skilltab","mod1param":8,"mod1min":2,"mod1max":2} |
| Golemlord's | 100 | 1 | 0 | 60 | 0 | 45 | 125 | 1 | wand, head, amul, circ | 无 | {"mod1code":"skilltab","mod1param":8,"mod1min":3,"mod1max":3} |
| Lion Branded | 100 | 1 | 1 | 50 | 0 | 42 | 125 | 1 | lcha | 无 | {"mod1code":"skilltab","mod1param":9,"mod1min":1,"mod1max":1} |
| Captain's | 100 | 1 | 1 | 50 | 0 | 42 | 125 | 1 | lcha | 无 | {"mod1code":"skilltab","mod1param":10,"mod1min":1,"mod1max":1} |
| Preserver's | 100 | 1 | 1 | 50 | 0 | 42 | 125 | 1 | lcha | 无 | {"mod1code":"skilltab","mod1param":11,"mod1min":1,"mod1max":1} |
| Lion Branded | 100 | 1 | 1 | 20 | 0 | 15 | 125 | 1 | scep, swor, mace, shld, ashd, amul, circ | 无 | {"mod1code":"skilltab","mod1param":9,"mod1min":1,"mod1max":1} |
| Hawk Branded | 100 | 1 | 1 | 40 | 0 | 30 | 125 | 1 | scep, swor, mace, shld, ashd, amul, circ | 无 | {"mod1code":"skilltab","mod1param":9,"mod1min":2,"mod1max":2} |
| Rose Branded | 100 | 1 | 0 | 60 | 0 | 45 | 125 | 1 | scep, swor, mace, shld, ashd, amul, circ | 无 | {"mod1code":"skilltab","mod1param":9,"mod1min":3,"mod1max":3} |
| Captain's | 100 | 1 | 1 | 20 | 0 | 15 | 125 | 1 | scep, swor, mace, shld, ashd, amul, circ | 无 | {"mod1code":"skilltab","mod1param":10,"mod1min":1,"mod1max":1} |
| Commander's | 100 | 1 | 1 | 40 | 0 | 30 | 125 | 1 | scep, swor, mace, shld, ashd, amul, circ | 无 | {"mod1code":"skilltab","mod1param":10,"mod1min":2,"mod1max":2} |
| Marshal's | 100 | 1 | 0 | 60 | 0 | 45 | 125 | 1 | scep, swor, mace, shld, ashd, amul, circ | 无 | {"mod1code":"skilltab","mod1param":10,"mod1min":3,"mod1max":3} |
| Preserver's | 100 | 1 | 1 | 20 | 0 | 15 | 125 | 1 | shld, ashd, amul, circ | 无 | {"mod1code":"skilltab","mod1param":11,"mod1min":1,"mod1max":1} |
| Warder's | 100 | 1 | 1 | 40 | 0 | 30 | 125 | 1 | shld, ashd, amul, circ | 无 | {"mod1code":"skilltab","mod1param":11,"mod1min":2,"mod1max":2} |
| Guardian's | 100 | 1 | 0 | 60 | 0 | 45 | 125 | 1 | shld, ashd, amul, circ | 无 | {"mod1code":"skilltab","mod1param":11,"mod1min":3,"mod1max":3} |
| Expert's | 100 | 1 | 1 | 50 | 0 | 42 | 125 | 1 | lcha | 无 | {"mod1code":"skilltab","mod1param":12,"mod1min":1,"mod1max":1} |
| Fanatic | 100 | 1 | 1 | 50 | 0 | 42 | 125 | 1 | lcha | 无 | {"mod1code":"skilltab","mod1param":13,"mod1min":1,"mod1max":1} |
| Sounding | 100 | 1 | 1 | 50 | 0 | 42 | 125 | 1 | lcha | 无 | {"mod1code":"skilltab","mod1param":14,"mod1min":1,"mod1max":1} |
| Expert's | 100 | 1 | 1 | 20 | 0 | 15 | 125 | 1 | phlm, weap, helm | miss, rod | {"mod1code":"skilltab","mod1param":12,"mod1min":1,"mod1max":1} |
| Veteran's | 100 | 1 | 1 | 40 | 0 | 30 | 125 | 1 | phlm, weap, helm | miss, rod | {"mod1code":"skilltab","mod1param":12,"mod1min":2,"mod1max":2} |
| Master's | 100 | 1 | 0 | 60 | 0 | 45 | 125 | 1 | phlm, weap, helm | miss, rod | {"mod1code":"skilltab","mod1param":12,"mod1min":3,"mod1max":3} |
| Fanatic | 100 | 1 | 1 | 20 | 0 | 15 | 125 | 1 | phlm, weap, amul | miss, rod | {"mod1code":"skilltab","mod1param":13,"mod1min":1,"mod1max":1} |
| Raging | 100 | 1 | 1 | 40 | 0 | 30 | 125 | 1 | phlm, weap, amul | miss, rod | {"mod1code":"skilltab","mod1param":13,"mod1min":2,"mod1max":2} |
| Furious | 100 | 1 | 0 | 60 | 0 | 45 | 125 | 1 | phlm, weap, amul | miss, rod | {"mod1code":"skilltab","mod1param":13,"mod1min":3,"mod1max":3} |
| Sounding | 100 | 1 | 1 | 20 | 0 | 15 | 125 | 1 | phlm, weap, amul | miss, rod | {"mod1code":"skilltab","mod1param":14,"mod1min":1,"mod1max":1} |
| Resonant | 100 | 1 | 1 | 40 | 0 | 30 | 125 | 1 | phlm, weap, amul | miss, rod | {"mod1code":"skilltab","mod1param":14,"mod1min":2,"mod1max":2} |
| Echoing | 100 | 1 | 0 | 60 | 0 | 45 | 125 | 1 | phlm, weap, amul | miss, rod | {"mod1code":"skilltab","mod1param":14,"mod1min":3,"mod1max":3} |
| Trainer's | 100 | 1 | 1 | 50 | 0 | 42 | 125 | 1 | lcha | 无 | {"mod1code":"skilltab","mod1param":15,"mod1min":1,"mod1max":1} |
| Spiritual | 100 | 1 | 1 | 50 | 0 | 42 | 125 | 1 | lcha | 无 | {"mod1code":"skilltab","mod1param":16,"mod1min":1,"mod1max":1} |
| Nature's | 100 | 1 | 1 | 50 | 0 | 42 | 125 | 1 | lcha | 无 | {"mod1code":"skilltab","mod1param":17,"mod1min":1,"mod1max":1} |
| Trainer's | 100 | 1 | 1 | 20 | 0 | 15 | 125 | 1 | club, pelt, amul, circ | 无 | {"mod1code":"skilltab","mod1param":15,"mod1min":1,"mod1max":1} |
| Caretaker's | 100 | 1 | 1 | 40 | 0 | 30 | 125 | 1 | club, pelt, amul, circ | 无 | {"mod1code":"skilltab","mod1param":15,"mod1min":2,"mod1max":2} |
| Keeper's | 100 | 1 | 0 | 60 | 0 | 45 | 125 | 1 | club, pelt, amul, circ | 无 | {"mod1code":"skilltab","mod1param":15,"mod1min":3,"mod1max":3} |
| Spiritual | 100 | 1 | 1 | 20 | 0 | 15 | 125 | 1 | club, pelt, amul, circ | 无 | {"mod1code":"skilltab","mod1param":16,"mod1min":1,"mod1max":1} |
| Feral | 100 | 1 | 1 | 40 | 0 | 30 | 125 | 1 | club, pelt, amul, circ | 无 | {"mod1code":"skilltab","mod1param":16,"mod1min":2,"mod1max":2} |
| Communal | 100 | 1 | 0 | 60 | 0 | 45 | 125 | 1 | club, pelt, amul, circ | 无 | {"mod1code":"skilltab","mod1param":16,"mod1min":3,"mod1max":3} |
| Nature's | 100 | 1 | 1 | 20 | 0 | 15 | 125 | 1 | club, pelt, amul, circ | 无 | {"mod1code":"skilltab","mod1param":17,"mod1min":1,"mod1max":1} |
| Terra's | 100 | 1 | 1 | 40 | 0 | 30 | 125 | 1 | club, pelt, amul, circ | 无 | {"mod1code":"skilltab","mod1param":17,"mod1min":2,"mod1max":2} |
| Gaea's | 100 | 1 | 0 | 60 | 0 | 45 | 125 | 1 | club, pelt, amul, circ | 无 | {"mod1code":"skilltab","mod1param":17,"mod1min":3,"mod1max":3} |
| Entrapping | 100 | 1 | 1 | 50 | 0 | 42 | 125 | 1 | lcha | 无 | {"mod1code":"skilltab","mod1param":18,"mod1min":1,"mod1max":1} |
| Mentalist's | 100 | 1 | 1 | 50 | 0 | 42 | 125 | 1 | lcha | 无 | {"mod1code":"skilltab","mod1param":19,"mod1min":1,"mod1max":1} |
| Shogukusha's | 100 | 1 | 1 | 50 | 0 | 42 | 125 | 1 | lcha | 无 | {"mod1code":"skilltab","mod1param":20,"mod1min":1,"mod1max":1} |
| Entrapping | 100 | 1 | 1 | 20 | 0 | 15 | 125 | 1 | h2h, amul, circ | 无 | {"mod1code":"skilltab","mod1param":18,"mod1min":1,"mod1max":1} |
| Trickster's | 100 | 1 | 1 | 40 | 0 | 30 | 125 | 1 | h2h, amul, circ | 无 | {"mod1code":"skilltab","mod1param":18,"mod1min":2,"mod1max":2} |
| Cunning | 100 | 1 | 0 | 60 | 0 | 45 | 125 | 1 | h2h, amul, circ | 无 | {"mod1code":"skilltab","mod1param":18,"mod1min":3,"mod1max":3} |
| Mentalist's | 100 | 1 | 1 | 20 | 0 | 15 | 125 | 1 | h2h, amul, helm, circ | 无 | {"mod1code":"skilltab","mod1param":19,"mod1min":1,"mod1max":1} |
| Psychic | 100 | 1 | 1 | 40 | 0 | 30 | 125 | 1 | h2h, amul, helm, circ | 无 | {"mod1code":"skilltab","mod1param":19,"mod1min":2,"mod1max":2} |
| Shadow | 100 | 1 | 0 | 60 | 0 | 45 | 125 | 1 | h2h, amul, helm, circ | 无 | {"mod1code":"skilltab","mod1param":19,"mod1min":3,"mod1max":3} |
| Shogukusha's | 100 | 1 | 1 | 20 | 0 | 15 | 125 | 1 | h2h, amul, glov, circ | 无 | {"mod1code":"skilltab","mod1param":20,"mod1min":1,"mod1max":1} |
| Sensei's | 100 | 1 | 1 | 40 | 0 | 30 | 125 | 1 | h2h, amul, glov, circ | 无 | {"mod1code":"skilltab","mod1param":20,"mod1min":2,"mod1max":2} |
| Kenshi's | 100 | 1 | 0 | 60 | 0 | 45 | 125 | 1 | h2h, amul, glov, circ | 无 | {"mod1code":"skilltab","mod1param":20,"mod1min":3,"mod1max":3} |
| Miocene | 100 | 0 | 0 | 1 | 0 | 1 | 101 | 1 | tors | 无 | {"mod1code":"ac/lvl","mod1param":6} |
| Miocene | 100 | 0 | 1 | 1 | 0 | 1 | 101 | 1 | glov, boot, belt, shld | 无 | {"mod1code":"ac/lvl","mod1param":1} |
| Oligocene | 100 | 0 | 1 | 10 | 0 | 7 | 101 | 1 | tors | 无 | {"mod1code":"ac/lvl","mod1param":9} |
| Oligocene | 100 | 0 | 1 | 10 | 0 | 7 | 101 | 1 | glov, boot, belt, shld | 无 | {"mod1code":"ac/lvl","mod1param":2} |
| Eocene | 100 | 0 | 1 | 20 | 0 | 15 | 101 | 1 | tors | 无 | {"mod1code":"ac/lvl","mod1param":18} |
| Eocene | 100 | 0 | 1 | 20 | 0 | 15 | 101 | 1 | glov, boot, belt, shld | 无 | {"mod1code":"ac/lvl","mod1param":3} |
| Paleocene | 100 | 1 | 1 | 30 | 0 | 22 | 101 | 4 | tors | 无 | {"mod1code":"ac/lvl","mod1param":24} |
| Paleocene | 100 | 1 | 1 | 30 | 0 | 22 | 101 | 3 | glov, boot, belt, shld | 无 | {"mod1code":"ac/lvl","mod1param":4} |
| Knave's | 100 | 0 | 0 | 1 | 0 | 1 | 111 | 1 | weap | staf, wand, orb | {"mod1code":"dmg/lvl","mod1param":1,"mod2code":"att/lvl","mod2param":10} |
| Jack's | 100 | 0 | 1 | 10 | 0 | 7 | 111 | 1 | weap | staf, wand, orb | {"mod1code":"dmg/lvl","mod1param":2,"mod2code":"att/lvl","mod2param":15} |
| Jester's | 100 | 0 | 1 | 20 | 0 | 15 | 111 | 1 | weap | staf, wand, orb | {"mod1code":"dmg/lvl","mod1param":3,"mod2code":"att/lvl","mod2param":22} |
| Joker's | 100 | 0 | 1 | 35 | 0 | 26 | 111 | 1 | weap | staf, wand, orb | {"mod1code":"dmg/lvl","mod1param":4,"mod2code":"att/lvl","mod2param":33} |
| Trump | 100 | 1 | 1 | 50 | 0 | 37 | 111 | 7 | weap | staf, wand, orb | {"mod1code":"dmg/lvl","mod1param":4,"mod2code":"att/lvl","mod2param":33} |
| Loud | 100 | 0 | 0 | 1 | 0 | 1 | 105 | 1 | weap | staf, wand, orb | {"mod1code":"dmg/lvl","mod1param":2} |
| Calling | 100 | 0 | 1 | 10 | 0 | 7 | 105 | 1 | weap | staf, wand, orb | {"mod1code":"dmg/lvl","mod1param":3} |
| Yelling | 100 | 0 | 1 | 20 | 0 | 15 | 105 | 1 | weap | staf, wand, orb | {"mod1code":"dmg/lvl","mod1param":4} |
| Shouting | 100 | 0 | 1 | 35 | 0 | 26 | 105 | 1 | weap | staf, wand, orb | {"mod1code":"dmg/lvl","mod1param":5} |
| Gritty | 100 | 1 | 1 | 50 | 0 | 37 | 105 | 7 | weap | staf, wand, orb | {"mod1code":"dmg/lvl","mod1param":6} |
| Paradox | 100 | 0 | 1 | 25 | 0 | 18 | 101 | 1 | tors | 无 | {"mod1code":"ac%/lvl","mod1param":12} |
| Paradox | 100 | 0 | 1 | 25 | 0 | 18 | 105 | 1 | weap | staf, wand, orb | {"mod1code":"dmg%/lvl","mod1param":12} |
| Robineye | 100 | 0 | 0 | 1 | 0 | 1 | 111 | 1 | weap | staf, wand, orb | {"mod1code":"att/lvl","mod1param":4} |
| Sparroweye | 100 | 0 | 0 | 10 | 0 | 7 | 111 | 1 | weap | staf, wand, orb | {"mod1code":"att/lvl","mod1param":6} |
| Falconeye | 100 | 0 | 0 | 20 | 0 | 15 | 111 | 1 | weap | staf, wand, orb | {"mod1code":"att/lvl","mod1param":8} |
| Hawkeye | 100 | 1 | 0 | 35 | 0 | 26 | 111 | 7 | weap | staf, wand, orb | {"mod1code":"att/lvl","mod1param":12} |
| Eagleeye | 100 | 0 | 0 | 50 | 0 | 37 | 111 | 1 | weap | staf, wand, orb | {"mod1code":"att/lvl","mod1param":16} |
| Visionary | 100 | 1 | 1 | 25 | 0 | 18 | 111 | 1 | helm, miss | 无 | {"mod1code":"att%/lvl","mod1param":2} |
| Mnemonic | 100 | 1 | 1 | 25 | 0 | 18 | 115 | 1 | helm | 无 | {"mod1code":"mana/lvl","mod1param":6} |
| Snowflake | 100 | 1 | 1 | 25 | 0 | 18 | 137 | 3 | weap, circ | 无 | {"mod1code":"cold-len","mod1min":25,"mod1max":25,"mod2code":"cold-min","mod2min":6,"mod2max":9,"mod3code":"cold-max","mod3min":19,"mod3max":30} |
| Shivering | 100 | 1 | 1 | 35 | 0 | 26 | 137 | 2 | weap | 无 | {"mod1code":"cold-len","mod1min":50,"mod1max":50,"mod2code":"cold-min","mod2min":10,"mod2max":15,"mod3code":"cold-max","mod3min":31,"mod3max":45} |
| Boreal | 100 | 1 | 1 | 50 | 0 | 40 | 137 | 1 | weap | 无 | {"mod1code":"cold-len","mod1min":75,"mod1max":75,"mod2code":"cold-min","mod2min":16,"mod2max":23,"mod3code":"cold-max","mod3min":46,"mod3max":90} |
| Hibernal | 100 | 1 | 1 | 70 | 0 | 60 | 137 | 1 | weap | 无 | {"mod1code":"cold-len","mod1min":100,"mod1max":100,"mod2code":"cold-min","mod2min":24,"mod2max":45,"mod3code":"cold-max","mod3min":91,"mod3max":140} |
| Ember | 100 | 1 | 1 | 25 | 0 | 18 | 138 | 3 | weap, circ | 无 | {"mod1code":"fire-min","mod1min":16,"mod1max":25,"mod2code":"fire-max","mod2min":31,"mod2max":60} |
| Smoldering | 100 | 1 | 1 | 35 | 0 | 26 | 138 | 2 | weap | 无 | {"mod1code":"fire-min","mod1min":26,"mod1max":50,"mod2code":"fire-max","mod2min":61,"mod2max":90} |
| Smoking | 100 | 1 | 1 | 47 | 0 | 37 | 138 | 1 | weap | 无 | {"mod1code":"fire-min","mod1min":51,"mod1max":80,"mod2code":"fire-max","mod2min":91,"mod2max":130} |
| Flaming | 100 | 1 | 1 | 61 | 0 | 51 | 138 | 1 | weap | 无 | {"mod1code":"fire-min","mod1min":81,"mod1max":120,"mod2code":"fire-max","mod2min":131,"mod2max":180} |
| Scorching | 100 | 1 | 1 | 77 | 0 | 67 | 138 | 1 | weap | 无 | {"mod1code":"fire-min","mod1min":121,"mod1max":170,"mod2code":"fire-max","mod2min":181,"mod2max":240} |
| Static | 100 | 1 | 1 | 25 | 0 | 18 | 139 | 3 | weap, circ | 无 | {"mod1code":"ltng-min","mod1min":1,"mod1max":1,"mod2code":"ltng-max","mod2min":49,"mod2max":120} |
| Glowing | 100 | 1 | 1 | 34 | 0 | 25 | 139 | 2 | weap | 无 | {"mod1code":"ltng-min","mod1min":1,"mod1max":1,"mod2code":"ltng-max","mod2min":121,"mod2max":180} |
| Buzzing | 100 | 1 | 1 | 46 | 0 | 36 | 139 | 1 | weap | 无 | {"mod1code":"ltng-min","mod1min":1,"mod1max":1,"mod2code":"ltng-max","mod2min":181,"mod2max":260} |
| Arcing | 100 | 1 | 1 | 60 | 0 | 50 | 139 | 1 | weap | 无 | {"mod1code":"ltng-min","mod1min":1,"mod1max":1,"mod2code":"ltng-max","mod2min":261,"mod2max":360} |
| Shocking | 100 | 1 | 1 | 76 | 0 | 66 | 139 | 1 | weap | 无 | {"mod1code":"ltng-min","mod1min":1,"mod1max":1,"mod2code":"ltng-max","mod2min":361,"mod2max":480} |
| Septic | 100 | 1 | 1 | 1 | 0 | 1 | 140 | 3 | weap, circ | 无 | {"mod1code":"dmg-pois","mod1param":50,"mod1min":31,"mod1max":31} |
| Envenomed | 100 | 1 | 1 | 10 | 0 | 7 | 140 | 2 | weap | 无 | {"mod1code":"dmg-pois","mod1param":75,"mod1min":41,"mod1max":41} |
| Corosive | 100 | 1 | 1 | 20 | 0 | 15 | 140 | 1 | weap | 无 | {"mod1code":"dmg-pois","mod1param":100,"mod1min":205,"mod1max":205} |
| Toxic | 100 | 1 | 1 | 35 | 0 | 26 | 140 | 1 | weap | 无 | {"mod1code":"dmg-pois","mod1param":125,"mod1min":308,"mod1max":308} |
| Pestilent | 100 | 1 | 0 | 50 | 0 | 37 | 140 | 1 | weap | 无 | {"mod1code":"dmg-pois","mod1param":150,"mod1min":470,"mod1max":470} |
| Maiden's | 1 | 1 | 1 | 36 | 0 | 27 | 125 | 4 | amul, circ | 无 | {"mod1code":"ama","mod1min":1,"mod1max":1} |
| Valkyrie's | 1 | 1 | 1 | 90 | 0 | 67 | 125 | 2 | amul, circ | 无 | {"mod1code":"ama","mod1min":2,"mod1max":2} |
| Maiden's | 1 | 1 | 1 | 30 | 0 | 22 | 125 | 4 | miss, spea | 无 | {"mod1code":"ama","mod1min":1,"mod1max":1} |
| Valkyrie's | 1 | 1 | 1 | 50 | 0 | 42 | 125 | 2 | miss, spea | 无 | {"mod1code":"ama","mod1min":2,"mod1max":2} |
| Monk's | 1 | 1 | 1 | 36 | 0 | 27 | 125 | 4 | amul, circ | 无 | {"mod1code":"pal","mod1min":1,"mod1max":1} |
| Priest's | 1 | 1 | 1 | 90 | 0 | 67 | 125 | 2 | amul, circ | 无 | {"mod1code":"pal","mod1min":2,"mod1max":2} |
| Monk's | 1 | 1 | 1 | 30 | 0 | 22 | 125 | 4 | scep, ashd | 无 | {"mod1code":"pal","mod1min":1,"mod1max":1} |
| Priest's | 1 | 1 | 1 | 50 | 0 | 42 | 125 | 2 | scep, ashd | 无 | {"mod1code":"pal","mod1min":2,"mod1max":2} |
| Monk's | 1 | 1 | 1 | 35 | 0 | 27 | 125 | 4 | swor, mace, hamm, shld | 无 | {"mod1code":"pal","mod1min":1,"mod1max":1} |
| Priest's | 1 | 1 | 1 | 65 | 0 | 58 | 125 | 2 | swor, mace, hamm, shld | 无 | {"mod1code":"pal","mod1min":2,"mod1max":2} |
| Summoner's | 1 | 1 | 1 | 36 | 0 | 27 | 125 | 4 | amul, circ | 无 | {"mod1code":"nec","mod1min":1,"mod1max":1} |
| Necromancer's | 1 | 1 | 1 | 90 | 0 | 67 | 125 | 2 | amul, circ | 无 | {"mod1code":"nec","mod1min":2,"mod1max":2} |
| Summoner's | 1 | 1 | 1 | 30 | 0 | 22 | 125 | 4 | wand, knif, head | 无 | {"mod1code":"nec","mod1min":1,"mod1max":1} |
| Necromancer's | 1 | 1 | 1 | 50 | 0 | 42 | 125 | 2 | wand, knif, head | 无 | {"mod1code":"nec","mod1min":2,"mod1max":2} |
| Angel's | 1 | 1 | 1 | 36 | 0 | 27 | 125 | 4 | amul, circ | 无 | {"mod1code":"sor","mod1min":1,"mod1max":1} |
| Arch-Angel's | 1 | 1 | 1 | 90 | 0 | 67 | 125 | 2 | amul, circ | 无 | {"mod1code":"sor","mod1min":2,"mod1max":2} |
| Angel's | 1 | 1 | 1 | 30 | 0 | 22 | 125 | 4 | staf, orb | 无 | {"mod1code":"sor","mod1min":1,"mod1max":1} |
| Arch-Angel's | 1 | 1 | 1 | 50 | 0 | 42 | 125 | 2 | staf, orb | 无 | {"mod1code":"sor","mod1min":2,"mod1max":2} |
| Slayer's | 1 | 1 | 1 | 36 | 0 | 27 | 125 | 4 | amul, circ | 无 | {"mod1code":"bar","mod1min":1,"mod1max":1} |
| Berserker's | 1 | 1 | 1 | 90 | 0 | 67 | 125 | 2 | amul, circ | 无 | {"mod1code":"bar","mod1min":2,"mod1max":2} |
| Slayer's | 1 | 1 | 1 | 30 | 0 | 22 | 125 | 4 | tkni, axe, spea, club, swor, hamm, mace | jave | {"mod1code":"bar","mod1min":1,"mod1max":1} |
| Berserker's | 1 | 1 | 1 | 50 | 0 | 42 | 125 | 1 | tkni, axe, spea, club, swor, hamm, mace | jave | {"mod1code":"bar","mod1min":2,"mod1max":2} |
| Slayer's | 100 | 1 | 1 | 30 | 0 | 22 | 125 | 4 | phlm | 无 | {"mod1code":"bar","mod1min":1,"mod1max":1} |
| Berserker's | 100 | 1 | 1 | 50 | 0 | 42 | 125 | 2 | phlm | 无 | {"mod1code":"bar","mod1min":2,"mod1max":2} |
| Shaman's | 100 | 1 | 1 | 36 | 0 | 27 | 125 | 4 | amul, circ | 无 | {"mod1code":"dru","mod1min":1,"mod1max":1} |
| Hierophant's | 100 | 1 | 1 | 90 | 0 | 67 | 125 | 2 | amul, circ | 无 | {"mod1code":"dru","mod1min":2,"mod1max":2} |
| Shaman's | 100 | 1 | 1 | 30 | 0 | 22 | 125 | 4 | club, pelt | 无 | {"mod1code":"dru","mod1min":1,"mod1max":1} |
| Hierophant's | 100 | 1 | 1 | 50 | 0 | 42 | 125 | 2 | club, pelt | 无 | {"mod1code":"dru","mod1min":2,"mod1max":2} |
| Magekiller's | 100 | 1 | 1 | 36 | 0 | 27 | 125 | 4 | amul, circ | 无 | {"mod1code":"ass","mod1min":1,"mod1max":1} |
| Witch-hunter's | 100 | 1 | 1 | 90 | 0 | 67 | 125 | 2 | amul, circ | 无 | {"mod1code":"ass","mod1min":2,"mod1max":2} |
| Magekiller's | 100 | 1 | 1 | 30 | 0 | 22 | 125 | 4 | h2h | 无 | {"mod1code":"ass","mod1min":1,"mod1max":1} |
| Witch-hunter's | 100 | 1 | 1 | 50 | 0 | 42 | 125 | 2 | h2h | 无 | {"mod1code":"ass","mod1min":2,"mod1max":2} |
| Compact | 100 | 1 | 1 | 1 | 0 | 1 | 141 | 6 | thro | 无 | {"mod1code":"stack","mod1min":20,"mod1max":40} |
| Thin | 100 | 1 | 1 | 17 | 0 | 12 | 141 | 5 | thro | 无 | {"mod1code":"stack","mod1min":41,"mod1max":80} |
| Dense | 100 | 1 | 1 | 38 | 0 | 30 | 141 | 4 | thro | 无 | {"mod1code":"stack","mod1min":81,"mod1max":120} |
| Consecrated | 100 | 1 | 1 | 1 | 0 | 1 | 142 | 4 | weap | wand, orb | {"mod1code":"att-undead","mod1min":25,"mod1max":75,"mod2code":"dmg-undead","mod2min":25,"mod2max":75} |
| Pure | 100 | 1 | 1 | 15 | 0 | 11 | 142 | 3 | weap | wand, orb | {"mod1code":"att-undead","mod1min":76,"mod1max":175,"mod2code":"dmg-undead","mod2min":76,"mod2max":125} |
| Sacred | 100 | 1 | 1 | 25 | 0 | 18 | 142 | 2 | weap | wand, orb | {"mod1code":"att-undead","mod1min":175,"mod1max":250,"mod2code":"dmg-undead","mod2min":126,"mod2max":200} |
| Hallowed | 100 | 1 | 1 | 35 | 0 | 27 | 142 | 1 | weap | wand, orb | {"mod1code":"att-undead","mod1min":251,"mod1max":325,"mod2code":"dmg-undead","mod2min":201,"mod2max":275} |
| Divine | 100 | 1 | 0 | 45 | 0 | 37 | 142 | 1 | weap | wand, orb | {"mod1code":"att-undead","mod1min":326,"mod1max":450,"mod2code":"dmg-undead","mod2min":276,"mod2max":350} |
| Pearl | 100 | 1 | 1 | 18 | 0 | 13 | 142 | 1 | jewl | 无 | {"mod1code":"att-undead","mod1min":25,"mod1max":50,"mod2code":"dmg-undead","mod2min":25,"mod2max":50} |
| Crimson | 1 | 1 | 1 | 5 | 0 | 3 | 118 | 4 | armo, ring, amul, orb, circ, weap | 无 | {"mod1code":"res-fire","mod1min":5,"mod1max":10} |
| Red | 100 | 1 | 1 | 15 | 0 | 11 | 103 | 4 | lcha | 无 | {"mod1code":"dmg-min","mod1min":1,"mod1max":1} |
| Sanguinary | 100 | 1 | 1 | 45 | 0 | 37 | 103 | 4 | lcha | 无 | {"mod1code":"dmg-min","mod1min":2,"mod1max":2} |
| Bloody | 100 | 1 | 0 | 75 | 0 | 67 | 103 | 4 | lcha | 无 | {"mod1code":"dmg-min","mod1min":3,"mod1max":3} |
| Red | 100 | 1 | 1 | 30 | 0 | 22 | 103 | 4 | mcha | 无 | {"mod1code":"dmg-min","mod1min":1,"mod1max":1} |
| Sanguinary | 100 | 1 | 0 | 60 | 0 | 52 | 103 | 4 | mcha | 无 | {"mod1code":"dmg-min","mod1min":2,"mod1max":2} |
| Red | 100 | 1 | 1 | 90 | 0 | 82 | 103 | 4 | scha | 无 | {"mod1code":"dmg-min","mod1min":1,"mod1max":1} |
| Jagged | 100 | 1 | 1 | 7 | 0 | 5 | 104 | 4 | lcha | 无 | {"mod1code":"dmg-max","mod1min":1,"mod1max":1} |
| Forked | 100 | 1 | 1 | 37 | 0 | 29 | 104 | 4 | lcha | 无 | {"mod1code":"dmg-max","mod1min":2,"mod1max":2} |
| Serrated | 100 | 1 | 0 | 67 | 0 | 59 | 104 | 4 | lcha | 无 | {"mod1code":"dmg-max","mod1min":3,"mod1max":3} |
| Jagged | 100 | 1 | 1 | 22 | 0 | 16 | 104 | 4 | mcha | 无 | {"mod1code":"dmg-max","mod1min":1,"mod1max":1} |
| Forked | 100 | 1 | 0 | 52 | 0 | 44 | 104 | 4 | mcha | 无 | {"mod1code":"dmg-max","mod1min":2,"mod1max":2} |
| Jagged | 100 | 1 | 1 | 81 | 0 | 73 | 104 | 4 | scha | 无 | {"mod1code":"dmg-max","mod1min":1,"mod1max":1} |
| Snowflake | 100 | 1 | 1 | 9 | 0 | 6 | 137 | 2 | lcha | 无 | {"mod1code":"cold-len","mod1min":25,"mod1max":25,"mod2code":"cold-min","mod2min":1,"mod2max":1,"mod3code":"cold-max","mod3min":2,"mod3max":3} |
| Shivering | 100 | 1 | 1 | 15 | 0 | 11 | 137 | 1 | lcha | 无 | {"mod1code":"cold-len","mod1min":25,"mod1max":25,"mod2code":"cold-min","mod2min":2,"mod2max":4,"mod3code":"cold-max","mod3min":4,"mod3max":8} |
| Boreal | 100 | 1 | 1 | 30 | 0 | 22 | 137 | 1 | lcha | 无 | {"mod1code":"cold-len","mod1min":25,"mod1max":25,"mod2code":"cold-min","mod2min":5,"mod2max":7,"mod3code":"cold-max","mod3min":9,"mod3max":15} |
| Hibernal | 100 | 1 | 0 | 45 | 0 | 38 | 137 | 1 | lcha | 无 | {"mod1code":"cold-len","mod1min":25,"mod1max":25,"mod2code":"cold-min","mod2min":8,"mod2max":13,"mod3code":"cold-max","mod3min":16,"mod3max":25} |
| Snowflake | 100 | 1 | 1 | 18 | 0 | 13 | 137 | 2 | mcha | 无 | {"mod1code":"cold-len","mod1min":25,"mod1max":25,"mod2code":"cold-min","mod2min":2,"mod2max":3,"mod3code":"cold-max","mod3min":3,"mod3max":5} |
| Shivering | 100 | 1 | 1 | 29 | 0 | 21 | 137 | 1 | mcha | 无 | {"mod1code":"cold-len","mod1min":25,"mod1max":25,"mod2code":"cold-min","mod2min":4,"mod2max":5,"mod3code":"cold-max","mod3min":6,"mod3max":10} |
| Boreal | 100 | 1 | 1 | 49 | 0 | 41 | 137 | 1 | mcha | 无 | {"mod1code":"cold-len","mod1min":25,"mod1max":25,"mod2code":"cold-min","mod2min":6,"mod2max":10,"mod3code":"cold-max","mod3min":11,"mod3max":20} |
| Hibernal | 100 | 1 | 0 | 69 | 0 | 61 | 137 | 1 | mcha | 无 | {"mod1code":"cold-len","mod1min":25,"mod1max":25,"mod2code":"cold-min","mod2min":11,"mod2max":15,"mod3code":"cold-max","mod3min":21,"mod3max":30} |
| Snowflake | 100 | 1 | 1 | 27 | 0 | 20 | 137 | 2 | scha | 无 | {"mod1code":"cold-len","mod1min":25,"mod1max":25,"mod2code":"cold-min","mod2min":1,"mod2max":2,"mod3code":"cold-max","mod3min":2,"mod3max":4} |
| Shivering | 100 | 1 | 1 | 42 | 0 | 34 | 137 | 1 | scha | 无 | {"mod1code":"cold-len","mod1min":25,"mod1max":25,"mod2code":"cold-min","mod2min":3,"mod2max":4,"mod3code":"cold-max","mod3min":5,"mod3max":8} |
| Boreal | 100 | 1 | 1 | 66 | 0 | 58 | 137 | 1 | scha | 无 | {"mod1code":"cold-len","mod1min":25,"mod1max":25,"mod2code":"cold-min","mod2min":5,"mod2max":7,"mod3code":"cold-max","mod3min":9,"mod3max":14} |
| Hibernal | 100 | 1 | 0 | 91 | 0 | 83 | 137 | 1 | scha | 无 | {"mod1code":"cold-len","mod1min":25,"mod1max":25,"mod2code":"cold-min","mod2min":8,"mod2max":10,"mod3code":"cold-max","mod3min":15,"mod3max":20} |
| Ember | 100 | 1 | 1 | 5 | 0 | 3 | 138 | 2 | lcha | 无 | {"mod1code":"fire-min","mod1min":1,"mod1max":1,"mod2code":"fire-max","mod2min":2,"mod2max":3} |
| Smoldering | 100 | 1 | 1 | 15 | 0 | 11 | 138 | 1 | lcha | 无 | {"mod1code":"fire-min","mod1min":2,"mod1max":3,"mod2code":"fire-max","mod2min":4,"mod2max":7} |
| Smoking | 100 | 1 | 1 | 28 | 0 | 21 | 138 | 1 | lcha | 无 | {"mod1code":"fire-min","mod1min":4,"mod1max":7,"mod2code":"fire-max","mod2min":8,"mod2max":19} |
| Flaming | 100 | 1 | 0 | 43 | 0 | 35 | 138 | 1 | lcha | 无 | {"mod1code":"fire-min","mod1min":8,"mod1max":18,"mod2code":"fire-max","mod2min":20,"mod2max":36} |
| Ember | 100 | 1 | 1 | 13 | 0 | 9 | 138 | 2 | mcha | 无 | {"mod1code":"fire-min","mod1min":1,"mod1max":1,"mod2code":"fire-max","mod2min":2,"mod2max":3} |
| Smoldering | 100 | 1 | 1 | 27 | 0 | 20 | 138 | 1 | mcha | 无 | {"mod1code":"fire-min","mod1min":2,"mod1max":3,"mod2code":"fire-max","mod2min":4,"mod2max":12} |
| Smoking | 100 | 1 | 1 | 47 | 0 | 39 | 138 | 1 | mcha | 无 | {"mod1code":"fire-min","mod1min":4,"mod1max":9,"mod2code":"fire-max","mod2min":13,"mod2max":27} |
| Flaming | 100 | 1 | 0 | 67 | 0 | 59 | 138 | 1 | mcha | 无 | {"mod1code":"fire-min","mod1min":10,"mod1max":27,"mod2code":"fire-max","mod2min":28,"mod2max":43} |
| Ember | 100 | 1 | 1 | 21 | 0 | 15 | 138 | 2 | scha | 无 | {"mod1code":"fire-min","mod1min":1,"mod1max":1,"mod2code":"fire-max","mod2min":2,"mod2max":3} |
| Smoldering | 100 | 1 | 1 | 40 | 0 | 32 | 138 | 1 | scha | 无 | {"mod1code":"fire-min","mod1min":2,"mod1max":3,"mod2code":"fire-max","mod2min":4,"mod2max":10} |
| Smoking | 100 | 1 | 1 | 64 | 0 | 56 | 138 | 1 | scha | 无 | {"mod1code":"fire-min","mod1min":4,"mod1max":9,"mod2code":"fire-max","mod2min":11,"mod2max":19} |
| Flaming | 100 | 1 | 0 | 89 | 0 | 81 | 138 | 1 | scha | 无 | {"mod1code":"fire-min","mod1min":10,"mod1max":19,"mod2code":"fire-max","mod2min":20,"mod2max":29} |
| Static | 100 | 1 | 1 | 7 | 0 | 5 | 139 | 2 | lcha | 无 | {"mod1code":"ltng-min","mod1min":1,"mod1max":1,"mod2code":"ltng-max","mod2min":4,"mod2max":5} |
| Glowing | 100 | 1 | 1 | 14 | 0 | 10 | 139 | 1 | lcha | 无 | {"mod1code":"ltng-min","mod1min":1,"mod1max":1,"mod2code":"ltng-max","mod2min":6,"mod2max":17} |
| Arcing | 100 | 1 | 1 | 29 | 0 | 21 | 139 | 1 | lcha | 无 | {"mod1code":"ltng-min","mod1min":1,"mod1max":1,"mod2code":"ltng-max","mod2min":18,"mod2max":44} |
| Shocking | 100 | 1 | 0 | 44 | 0 | 36 | 139 | 1 | lcha | 无 | {"mod1code":"ltng-min","mod1min":1,"mod1max":1,"mod2code":"ltng-max","mod2min":45,"mod2max":79} |
| Static | 100 | 1 | 1 | 14 | 0 | 10 | 139 | 2 | mcha | 无 | {"mod1code":"ltng-min","mod1min":1,"mod1max":1,"mod2code":"ltng-max","mod2min":5,"mod2max":9} |
| Glowing | 100 | 1 | 1 | 28 | 0 | 20 | 139 | 1 | mcha | 无 | {"mod1code":"ltng-min","mod1min":1,"mod1max":1,"mod2code":"ltng-max","mod2min":10,"mod2max":26} |
| Arcing | 100 | 1 | 1 | 48 | 0 | 40 | 139 | 1 | mcha | 无 | {"mod1code":"ltng-min","mod1min":1,"mod1max":1,"mod2code":"ltng-max","mod2min":27,"mod2max":58} |
| Shocking | 100 | 1 | 0 | 68 | 0 | 60 | 139 | 1 | mcha | 无 | {"mod1code":"ltng-min","mod1min":1,"mod1max":1,"mod2code":"ltng-max","mod2min":59,"mod2max":90} |
| Static | 100 | 1 | 1 | 23 | 0 | 17 | 139 | 2 | scha | 无 | {"mod1code":"ltng-min","mod1min":1,"mod1max":1,"mod2code":"ltng-max","mod2min":6,"mod2max":11} |
| Glowing | 100 | 1 | 1 | 41 | 0 | 33 | 139 | 1 | scha | 无 | {"mod1code":"ltng-min","mod1min":1,"mod1max":1,"mod2code":"ltng-max","mod2min":12,"mod2max":24} |
| Arcing | 100 | 1 | 1 | 65 | 0 | 57 | 139 | 1 | scha | 无 | {"mod1code":"ltng-min","mod1min":1,"mod1max":1,"mod2code":"ltng-max","mod2min":25,"mod2max":43} |
| Shocking | 100 | 1 | 0 | 90 | 0 | 82 | 139 | 1 | scha | 无 | {"mod1code":"ltng-min","mod1min":1,"mod1max":1,"mod2code":"ltng-max","mod2min":44,"mod2max":71} |
| Septic | 100 | 1 | 1 | 1 | 0 | 1 | 140 | 2 | lcha | 无 | {"mod1code":"dmg-pois","mod1param":75,"mod1min":18,"mod1max":18} |
| Envenomed | 100 | 1 | 1 | 12 | 0 | 9 | 140 | 1 | lcha | 无 | {"mod1code":"dmg-pois","mod1param":100,"mod1min":39,"mod1max":39} |
| Toxic | 100 | 1 | 1 | 27 | 0 | 20 | 140 | 1 | lcha | 无 | {"mod1code":"dmg-pois","mod1param":125,"mod1min":103,"mod1max":103} |
| Pestilent | 100 | 1 | 0 | 42 | 0 | 34 | 140 | 1 | lcha | 无 | {"mod1code":"dmg-pois","mod1param":150,"mod1min":171,"mod1max":171} |
| Septic | 100 | 1 | 1 | 9 | 0 | 6 | 140 | 2 | mcha | 无 | {"mod1code":"dmg-pois","mod1param":75,"mod1min":35,"mod1max":35} |
| Envenomed | 100 | 1 | 1 | 26 | 0 | 19 | 140 | 1 | mcha | 无 | {"mod1code":"dmg-pois","mod1param":100,"mod1min":77,"mod1max":77} |
| Toxic | 100 | 1 | 1 | 46 | 0 | 38 | 140 | 1 | mcha | 无 | {"mod1code":"dmg-pois","mod1param":125,"mod1min":185,"mod1max":185} |
| Pestilent | 100 | 1 | 0 | 66 | 0 | 58 | 140 | 1 | mcha | 无 | {"mod1code":"dmg-pois","mod1param":150,"mod1min":299,"mod1max":299} |
| Septic | 100 | 1 | 1 | 18 | 0 | 13 | 140 | 2 | scha | 无 | {"mod1code":"dmg-pois","mod1param":75,"mod1min":52,"mod1max":52} |
| Envenomed | 100 | 1 | 1 | 39 | 0 | 31 | 140 | 1 | scha | 无 | {"mod1code":"dmg-pois","mod1param":100,"mod1min":128,"mod1max":128} |
| Toxic | 100 | 1 | 1 | 63 | 0 | 55 | 140 | 1 | scha | 无 | {"mod1code":"dmg-pois","mod1param":125,"mod1min":205,"mod1max":205} |
| Pestilent | 100 | 1 | 0 | 88 | 0 | 80 | 140 | 1 | scha | 无 | {"mod1code":"dmg-pois","mod1param":150,"mod1min":299,"mod1max":299} |
| Tireless | 1 | 1 | 1 | 1 | 5 | 1 | 108 | 4 | boot | 无 | {"mod1code":"regen-stam","mod1min":10,"mod1max":10} |
| Lizard's | 1 | 1 | 1 | 1 | 2 | 1 | 115 | 4 | armo, ring, amul, rod, orb | boot, glov | {"mod1code":"mana","mod1min":1,"mod1max":2} |
| Azure | 1 | 1 | 1 | 1 | 4 | 1 | 117 | 3 | armo, ring, amul, orb, circ | 无 | {"mod1code":"res-cold","mod1min":5,"mod1max":5} |
| Crimson | 1 | 1 | 1 | 1 | 4 | 1 | 118 | 3 | armo, ring, amul, orb, circ | 无 | {"mod1code":"res-fire","mod1min":5,"mod1max":5} |
| Tangerine | 1 | 1 | 1 | 1 | 4 | 1 | 119 | 3 | armo, ring, amul, orb, circ | 无 | {"mod1code":"res-ltng","mod1min":5,"mod1max":5} |
| Beryl | 1 | 1 | 1 | 1 | 4 | 1 | 120 | 3 | armo, ring, amul, orb, circ | 无 | {"mod1code":"res-pois","mod1min":5,"mod1max":5} |
| Godly | 100 | 1 | 1 | 50 | 0 | 43 | 101 | 1 | armo | 无 | {"mod1code":"ac%","mod1min":101,"mod1max":200} |
| Cruel | 100 | 1 | 1 | 56 | 0 | 48 | 105 | 1 | weap | staf, wand, orb | {"mod1code":"dmg%","mod1min":201,"mod1max":300} |

## 魔法后缀定义（741 条）

| 名称 | version | spawnable | rare | level | maxlevel | levelreq | group | frequency | 允许类型 | 排除类型 | 属性字段 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| of Health | 0 | 1 | 1 | 7 | 0 | 5 | 1 | 0 | tors, helm, shld, ring, amul | 无 | {"mod1code":"red-dmg","mod1min":1,"mod1max":1} |
| of Protection | 0 | 1 | 1 | 18 | 0 | 13 | 1 | 0 | ring, amul | 无 | {"mod1code":"red-dmg","mod1min":2,"mod1max":2} |
| of Absorption | 0 | 1 | 1 | 26 | 0 | 19 | 1 | 0 | amul | 无 | {"mod1code":"red-dmg","mod1min":3,"mod1max":3} |
| of Life | 0 | 1 | 1 | 35 | 0 | 26 | 1 | 0 | amul | 无 | {"mod1code":"red-dmg","mod1min":4,"mod1max":4} |
| of Warding | 0 | 1 | 1 | 7 | 0 | 5 | 2 | 0 | tors, helm, shld, ring, amul | 无 | {"mod1code":"red-mag","mod1min":1,"mod1max":1} |
| of the Sentinel | 0 | 1 | 1 | 18 | 0 | 13 | 2 | 0 | ring, amul | 无 | {"mod1code":"red-mag","mod1min":2,"mod1max":2} |
| of Guarding | 0 | 1 | 1 | 26 | 0 | 19 | 2 | 0 | amul | 无 | {"mod1code":"red-mag","mod1min":3,"mod1max":3} |
| of Negation | 0 | 1 | 1 | 35 | 0 | 26 | 2 | 0 | amul | 无 | {"mod1code":"red-mag","mod1min":4,"mod1max":4} |
| of Piercing | 0 | 1 | 1 | 25 | 0 | 18 | 3 | 0 | rod | 无 | {"mod1code":"ignore-ac","mod1min":1,"mod1max":1} |
| of Bashing | 0 | 1 | 1 | 16 | 0 | 12 | 4 | 0 | mele | wand, staf | {"mod1code":"dmg-ac","mod1min":-25,"mod1max":-40} |
| of Puncturing | 0 | 1 | 1 | 6 | 0 | 4 | 4 | 0 | mele | wand, staf | {"mod1code":"dmg-ac","mod1min":-10,"mod1max":-20} |
| of Thorns | 0 | 1 | 1 | 14 | 0 | 10 | 5 | 0 | tors, helm, shld, belt | 无 | {"mod1code":"thorns","mod1min":1,"mod1max":3} |
| of Spikes | 0 | 1 | 1 | 21 | 0 | 15 | 5 | 0 | tors, helm, shld, belt | 无 | {"mod1code":"thorns","mod1min":2,"mod1max":6} |
| of Readiness | 0 | 1 | 1 | 1 | 0 | 1 | 6 | 0 | weap, glov | 无 | {"mod1code":"swing1","mod1min":10,"mod1max":10} |
| of Alacrity | 0 | 1 | 1 | 8 | 0 | 6 | 6 | 0 | weap | 无 | {"mod1code":"swing2","mod1min":20,"mod1max":20} |
| of Swiftness | 0 | 1 | 1 | 19 | 0 | 14 | 6 | 0 | mele | wand, staf | {"mod1code":"swing2","mod1min":30,"mod1max":30} |
| of Quickness | 0 | 1 | 1 | 25 | 0 | 18 | 6 | 0 | mele | wand, staf | {"mod1code":"swing3","mod1min":40,"mod1max":40} |
| of Blocking | 0 | 1 | 1 | 1 | 0 | 1 | 7 | 0 | shld | 无 | {"mod1code":"block","mod1min":10,"mod1max":10} |
| of Deflecting | 0 | 1 | 1 | 11 | 0 | 8 | 7 | 0 | shld | 无 | {"mod1code":"block","mod1min":20,"mod1max":20} |
| of the Apprentice | 0 | 1 | 1 | 5 | 0 | 3 | 8 | 0 | rod, ring, amul | 无 | {"mod1code":"cast1","mod1min":10,"mod1max":10} |
| of the Magus | 0 | 1 | 1 | 17 | 0 | 12 | 8 | 0 | rod | 无 | {"mod1code":"cast3","mod1min":20,"mod1max":20} |
| of Frost | 0 | 1 | 1 | 4 | 0 | 3 | 9 | 0 | weap | 无 | {"mod1code":"cold-min","mod1min":1,"mod1max":1,"mod2code":"cold-max","mod2min":1,"mod2max":4,"mod3code":"cold-len","mod3min":125,"mod3max":125} |
| of the Glacier | 0 | 1 | 1 | 18 | 0 | 13 | 9 | 0 | mele | 无 | {"mod1code":"cold-min","mod1min":4,"mod1max":4,"mod2code":"cold-max","mod2min":4,"mod2max":12,"mod3code":"cold-len","mod3min":150,"mod3max":150} |
| of Frost | 0 | 1 | 1 | 55 | 0 | 41 | 9 | 0 | belt, amul | 无 | {"mod1code":"cold-min","mod1min":1,"mod1max":1,"mod2code":"cold-max","mod2min":1,"mod2max":4,"mod3code":"cold-len","mod3min":125,"mod3max":125} |
| of Warmth | 0 | 1 | 1 | 10 | 0 | 7 | 10 | 0 | shld, boot, glov, ring, amul | 无 | {"mod1code":"half-freeze","mod1min":1,"mod1max":1} |
| of Flame | 0 | 1 | 1 | 4 | 0 | 3 | 11 | 0 | weap | 无 | {"mod1code":"fire-min","mod1min":1,"mod1max":1,"mod2code":"fire-max","mod2min":2,"mod2max":6} |
| of Fire | 0 | 1 | 1 | 15 | 0 | 11 | 11 | 0 | weap | 无 | {"mod1code":"fire-min","mod1min":2,"mod1max":2,"mod2code":"fire-max","mod2min":6,"mod2max":11} |
| of Burning | 0 | 1 | 1 | 25 | 0 | 18 | 11 | 0 | weap | 无 | {"mod1code":"fire-min","mod1min":10,"mod1max":10,"mod2code":"fire-max","mod2min":10,"mod2max":20} |
| of Flame | 0 | 1 | 1 | 40 | 0 | 30 | 11 | 0 | glov, ring, amul | 无 | {"mod1code":"fire-min","mod1min":1,"mod1max":1,"mod2code":"fire-max","mod2min":2,"mod2max":6} |
| of Shock | 0 | 1 | 1 | 4 | 0 | 3 | 12 | 0 | weap | 无 | {"mod1code":"ltng-min","mod1min":1,"mod1max":1,"mod2code":"ltng-max","mod2min":8,"mod2max":8} |
| of Lightning | 0 | 1 | 1 | 15 | 0 | 11 | 12 | 0 | weap | 无 | {"mod1code":"ltng-min","mod1min":1,"mod1max":1,"mod2code":"ltng-max","mod2min":16,"mod2max":16} |
| of Thunder | 0 | 1 | 1 | 25 | 0 | 18 | 12 | 0 | weap | 无 | {"mod1code":"ltng-min","mod1min":1,"mod1max":1,"mod2code":"ltng-max","mod2min":32,"mod2max":32} |
| of Shock | 0 | 1 | 1 | 50 | 0 | 37 | 12 | 0 | boot, ring, amul, weap | miss, rod | {"mod1code":"ltng-min","mod1min":1,"mod1max":1,"mod2code":"ltng-max","mod2min":8,"mod2max":8} |
| of Craftsmanship | 0 | 1 | 1 | 1 | 0 | 1 | 13 | 0 | weap, ring, amul | 无 | {"mod1code":"dmg-max","mod1min":1,"mod1max":2} |
| of Quality | 0 | 1 | 1 | 4 | 0 | 3 | 13 | 0 | weap | 无 | {"mod1code":"dmg-max","mod1min":2,"mod1max":2} |
| of Maiming | 0 | 1 | 1 | 7 | 0 | 5 | 13 | 0 | weap | 无 | {"mod1code":"dmg-max","mod1min":3,"mod1max":4} |
| of Slaying | 0 | 1 | 1 | 11 | 0 | 8 | 13 | 0 | weap | 无 | {"mod1code":"dmg-max","mod1min":5,"mod1max":7} |
| of Gore | 0 | 1 | 1 | 14 | 0 | 10 | 13 | 0 | weap | 无 | {"mod1code":"dmg-max","mod1min":8,"mod1max":10} |
| of Carnage | 0 | 1 | 1 | 19 | 0 | 14 | 13 | 0 | weap | wand, staf | {"mod1code":"dmg-max","mod1min":11,"mod1max":14} |
| of Slaughter | 0 | 1 | 1 | 25 | 0 | 18 | 13 | 0 | weap | wand, staf | {"mod1code":"dmg-max","mod1min":15,"mod1max":20} |
| of Maiming | 0 | 1 | 1 | 42 | 0 | 31 | 13 | 0 | shld, ring, amul | 无 | {"mod1code":"dmg-max","mod1min":3,"mod1max":4} |
| of Worth | 0 | 1 | 1 | 2 | 0 | 1 | 14 | 0 | weap | rod | {"mod1code":"dmg-min","mod1min":1,"mod1max":1} |
| of Measure | 0 | 1 | 1 | 6 | 0 | 4 | 14 | 0 | weap | 无 | {"mod1code":"dmg-min","mod1min":2,"mod1max":2} |
| of Excellence | 0 | 1 | 1 | 12 | 0 | 9 | 14 | 0 | weap, ring, amul | 无 | {"mod1code":"dmg-min","mod1min":3,"mod1max":3} |
| of Performance | 0 | 1 | 1 | 18 | 0 | 13 | 14 | 0 | weap | 无 | {"mod1code":"dmg-min","mod1min":4,"mod1max":5} |
| of Measure | 0 | 1 | 1 | 37 | 0 | 27 | 14 | 0 | tors, helm, ring, amul | 无 | {"mod1code":"dmg-min","mod1min":2,"mod1max":2} |
| of Blight | 0 | 1 | 1 | 5 | 0 | 3 | 15 | 0 | weap | scep | {"mod1code":"pois-min","mod1min":8,"mod1max":8,"mod2code":"pois-max","mod2min":24,"mod2max":24,"mod3code":"pois-len","mod3min":75,"mod3max":75} |
| of Venom | 0 | 1 | 1 | 15 | 0 | 11 | 15 | 0 | weap | scep | {"mod1code":"pois-min","mod1min":16,"mod1max":16,"mod2code":"pois-max","mod2min":48,"mod2max":48,"mod3code":"pois-len","mod3min":75,"mod3max":75} |
| of Pestilence | 0 | 1 | 1 | 25 | 0 | 18 | 15 | 0 | weap | scep | {"mod1code":"pois-min","mod1min":32,"mod1max":32,"mod2code":"pois-max","mod2min":72,"mod2max":72,"mod3code":"pois-len","mod3min":100,"mod3max":100} |
| of Blight | 0 | 1 | 1 | 45 | 0 | 33 | 15 | 0 | ring, amul | 无 | {"mod1code":"pois-min","mod1min":8,"mod1max":8,"mod2code":"pois-max","mod2min":24,"mod2max":24,"mod3code":"pois-len","mod3min":75,"mod3max":75} |
| of Dexterity | 0 | 1 | 1 | 4 | 0 | 3 | 16 | 0 | ring, amul | 无 | {"mod1code":"dex","mod1min":1,"mod1max":1} |
| of Dexterity | 0 | 1 | 1 | 5 | 0 | 3 | 16 | 0 | scep, miss, boot, glov, ring, amul | 无 | {"mod1code":"dex","mod1min":1,"mod1max":3} |
| of Skill | 0 | 1 | 1 | 10 | 0 | 7 | 16 | 0 | scep, miss, boot, glov, ring, amul | 无 | {"mod1code":"dex","mod1min":4,"mod1max":6} |
| of Skill | 0 | 1 | 1 | 45 | 0 | 33 | 16 | 0 | armo | boot, glov | {"mod1code":"dex","mod1min":4,"mod1max":6} |
| of Accuracy | 0 | 1 | 1 | 18 | 0 | 13 | 16 | 0 | scep, miss, boot, glov, ring, amul | 无 | {"mod1code":"dex","mod1min":7,"mod1max":10} |
| of Precision | 0 | 1 | 1 | 22 | 0 | 16 | 16 | 0 | scep, miss, amul | 无 | {"mod1code":"dex","mod1min":11,"mod1max":15} |
| of Precision | 0 | 1 | 1 | 60 | 0 | 45 | 16 | 0 | armo, ring | 无 | {"mod1code":"dex","mod1min":11,"mod1max":15} |
| of Perfection | 0 | 1 | 1 | 30 | 0 | 22 | 16 | 0 | miss, glov, amul | 无 | {"mod1code":"dex","mod1min":16,"mod1max":20} |
| of Balance | 0 | 1 | 1 | 5 | 0 | 3 | 17 | 0 | armo | glov | {"mod1code":"balance1","mod1min":10,"mod1max":10} |
| of Stability | 0 | 1 | 1 | 9 | 0 | 6 | 17 | 0 | armo | glov | {"mod1code":"balance3","mod1min":20,"mod1max":20} |
| of Regeneration | 0 | 1 | 1 | 10 | 0 | 7 | 19 | 0 | scep, belt, ring, amul | 无 | {"mod1code":"regen","mod1min":3,"mod1max":3} |
| of Regeneration | 0 | 1 | 1 | 40 | 0 | 30 | 19 | 0 | shld, glov | 无 | {"mod1code":"regen","mod1min":3,"mod1max":3} |
| of Regeneration | 0 | 1 | 1 | 70 | 0 | 52 | 19 | 0 | tors, helm, weap, boot | scep | {"mod1code":"regen","mod1min":3,"mod1max":3} |
| of Regrowth | 0 | 1 | 1 | 17 | 0 | 12 | 19 | 0 | scep, amul | 无 | {"mod1code":"regen","mod1min":5,"mod1max":5} |
| of Regrowth | 0 | 1 | 1 | 55 | 0 | 41 | 19 | 0 | belt, ring | 无 | {"mod1code":"regen","mod1min":5,"mod1max":5} |
| of Vileness | 0 | 1 | 1 | 9 | 0 | 6 | 20 | 0 | mele | scep | {"mod1code":"noheal","mod1min":1,"mod1max":1} |
| of Greed | 0 | 1 | 1 | 2 | 0 | 1 | 22 | 0 | ring, amul | 无 | {"mod1code":"gold%","mod1min":40,"mod1max":60} |
| of Wealth | 0 | 1 | 1 | 17 | 0 | 12 | 22 | 0 | boot, glov, belt, amul | 无 | {"mod1code":"gold%","mod1min":80,"mod1max":120} |
| of Chance | 0 | 1 | 1 | 12 | 0 | 9 | 23 | 0 | ring, amul | 无 | {"mod1code":"mag%","mod1min":10,"mod1max":19} |
| of Fortune | 0 | 1 | 1 | 16 | 0 | 12 | 23 | 0 | boot, glov, amul | 无 | {"mod1code":"mag%","mod1min":20,"mod1max":35} |
| of Energy | 0 | 1 | 1 | 4 | 0 | 3 | 24 | 0 | ring, amul | 无 | {"mod1code":"mana","mod1min":1,"mod1max":1} |
| of Energy | 0 | 1 | 1 | 5 | 0 | 3 | 24 | 0 | rod, ring, amul | 无 | {"mod1code":"mana","mod1min":1,"mod1max":5} |
| of the Mind | 0 | 1 | 1 | 10 | 0 | 7 | 24 | 0 | rod, ring, amul | 无 | {"mod1code":"mana","mod1min":6,"mod1max":10} |
| of Brilliance | 0 | 1 | 1 | 18 | 0 | 13 | 24 | 0 | rod, ring, amul | 无 | {"mod1code":"mana","mod1min":11,"mod1max":15} |
| of Sorcery | 0 | 1 | 1 | 22 | 0 | 16 | 24 | 0 | rod, amul | 无 | {"mod1code":"mana","mod1min":16,"mod1max":20} |
| of Wizardry | 0 | 1 | 1 | 30 | 0 | 22 | 24 | 0 | rod, ring, amul | 无 | {"mod1code":"mana","mod1min":21,"mod1max":30} |
| of the Bear | 0 | 1 | 1 | 8 | 0 | 6 | 25 | 0 | mele | 无 | {"mod1code":"knock","mod1min":1,"mod1max":1} |
| of Light | 0 | 1 | 1 | 6 | 0 | 4 | 26 | 0 | armo, rod, miss, ring, amul | 无 | {"mod1code":"light","mod1min":1,"mod1max":1} |
| of Radiance | 0 | 1 | 1 | 15 | 0 | 11 | 26 | 0 | rod, miss, ring, amul | 无 | {"mod1code":"light","mod1min":3,"mod1max":3} |
| of the Sun | 0 | 1 | 1 | 17 | 0 | 12 | 26 | 0 | rod, miss, glov, ring, amul | 无 | {"mod1code":"light","mod1min":5,"mod1max":5} |
| of Life | 0 | 1 | 1 | 23 | 0 | 17 | 27 | 0 | tors, helm, shld, belt, amul | 无 | {"mod1code":"hp","mod1min":5,"mod1max":5} |
| of the Jackal | 0 | 1 | 1 | 3 | 0 | 2 | 27 | 0 | armo, rod, ring, amul | 无 | {"mod1code":"hp","mod1min":1,"mod1max":5} |
| of the Fox | 0 | 1 | 1 | 6 | 0 | 4 | 27 | 0 | armo, rod, ring, amul | 无 | {"mod1code":"hp","mod1min":5,"mod1max":10} |
| of the Wolf | 0 | 1 | 1 | 14 | 0 | 10 | 27 | 0 | armo, rod, ring, amul | 无 | {"mod1code":"hp","mod1min":11,"mod1max":20} |
| of the Wolf | 0 | 1 | 1 | 45 | 0 | 33 | 27 | 0 | weap | rod | {"mod1code":"hp","mod1min":11,"mod1max":20} |
| of the Tiger | 0 | 1 | 1 | 20 | 0 | 15 | 27 | 0 | armo, ring, amul | 无 | {"mod1code":"hp","mod1min":21,"mod1max":30} |
| of the Mammoth | 0 | 1 | 1 | 24 | 0 | 18 | 27 | 0 | tors, helm, shld, ring, amul | 无 | {"mod1code":"hp","mod1min":31,"mod1max":40} |
| of the Mammoth | 0 | 1 | 1 | 60 | 0 | 45 | 27 | 0 | mele, glov, belt | rod | {"mod1code":"hp","mod1min":31,"mod1max":40} |
| of the Colosuss | 0 | 1 | 1 | 30 | 0 | 22 | 27 | 0 | tors, helm, shld, belt, amul | 无 | {"mod1code":"hp","mod1min":41,"mod1max":60} |
| of the Leech | 0 | 1 | 1 | 6 | 0 | 4 | 28 | 0 | weap, ring, amul | 无 | {"mod1code":"lifesteal","mod1min":4,"mod1max":7} |
| of the Locust | 0 | 1 | 1 | 20 | 0 | 15 | 28 | 0 | mele | 无 | {"mod1code":"lifesteal","mod1min":8,"mod1max":10} |
| of the Bat | 0 | 1 | 1 | 6 | 0 | 4 | 29 | 0 | weap, ring, amul | 无 | {"mod1code":"manasteal","mod1min":4,"mod1max":8} |
| of the Vampire | 0 | 1 | 1 | 20 | 0 | 15 | 29 | 0 | mele | 无 | {"mod1code":"manasteal","mod1min":9,"mod1max":12} |
| of Defiance | 0 | 1 | 1 | 25 | 0 | 18 | 30 | 0 | tors, helm, shld, amul | 无 | {"mod1code":"res-pois-len","mod1min":75,"mod1max":75} |
| of Amelioration | 0 | 1 | 1 | 18 | 0 | 13 | 30 | 0 | tors, helm, shld, amul | 无 | {"mod1code":"res-pois-len","mod1min":50,"mod1max":50} |
| of Remedy | 0 | 1 | 1 | 7 | 0 | 5 | 30 | 0 | armo, ring, amul | 无 | {"mod1code":"res-pois-len","mod1min":25,"mod1max":25} |
| of Simplicity | 0 | 1 | 1 | 25 | 0 | 18 | 32 | 0 | tors, helm, weap, shld | rod | {"mod1code":"ease","mod1min":-40,"mod1max":-40} |
| of Ease | 0 | 1 | 1 | 15 | 0 | 11 | 32 | 0 | tors, helm, weap, shld | rod | {"mod1code":"ease","mod1min":-20,"mod1max":-20} |
| of Strength | 0 | 1 | 1 | 5 | 0 | 3 | 34 | 0 | belt, ring, amul | 无 | {"mod1code":"str","mod1min":1,"mod1max":3} |
| of Might | 0 | 1 | 1 | 10 | 0 | 7 | 34 | 0 | mele, shld, ring, amul | wand, staf | {"mod1code":"str","mod1min":4,"mod1max":6} |
| of the Ox | 0 | 1 | 1 | 18 | 0 | 13 | 34 | 0 | mele, belt, ring, amul | wand, staf | {"mod1code":"str","mod1min":7,"mod1max":10} |
| of the Ox | 0 | 1 | 1 | 47 | 0 | 35 | 34 | 0 | shld, boot, glov | 无 | {"mod1code":"str","mod1min":7,"mod1max":10} |
| of the Giant | 0 | 1 | 1 | 22 | 0 | 16 | 34 | 0 | mele, belt, amul | wand, staf | {"mod1code":"str","mod1min":11,"mod1max":15} |
| of the Giant | 0 | 1 | 1 | 62 | 0 | 46 | 34 | 0 | boot, glov, ring, shld | 无 | {"mod1code":"str","mod1min":11,"mod1max":15} |
| of the Titan | 0 | 1 | 1 | 30 | 0 | 22 | 34 | 0 | boot, belt, amul | 无 | {"mod1code":"str","mod1min":16,"mod1max":20} |
| of Pacing | 0 | 1 | 1 | 2 | 0 | 1 | 35 | 0 | boot | 无 | {"mod1code":"move1","mod1min":10,"mod1max":10} |
| of Haste | 0 | 1 | 1 | 12 | 0 | 9 | 35 | 0 | boot | 无 | {"mod1code":"move2","mod1min":20,"mod1max":20} |
| of Speed | 0 | 1 | 1 | 22 | 0 | 16 | 35 | 0 | boot | 无 | {"mod1code":"move3","mod1min":30,"mod1max":30} |
| of Health | 1 | 1 | 1 | 7 | 0 | 5 | 1 | 4 | tors, shld, ring, amul, circ | 无 | {"mod1code":"red-dmg","mod1min":1,"mod1max":1} |
| of Protection | 1 | 1 | 1 | 18 | 0 | 13 | 1 | 4 | ring, amul, circ | 无 | {"mod1code":"red-dmg","mod1min":2,"mod1max":2} |
| of Absorption | 1 | 1 | 1 | 26 | 0 | 19 | 1 | 4 | amul, circ | 无 | {"mod1code":"red-dmg","mod1min":3,"mod1max":3} |
| of Life | 1 | 1 | 1 | 35 | 0 | 26 | 1 | 4 | amul, circ | 无 | {"mod1code":"red-dmg","mod1min":4,"mod1max":4} |
| of Life Everlasting | 100 | 1 | 0 | 45 | 0 | 37 | 1 | 4 | amul, circ | 无 | {"mod1code":"red-dmg","mod1min":10,"mod1max":25} |
| of Protection | 1 | 1 | 1 | 24 | 0 | 18 | 1 | 4 | tors, shld, circ | 无 | {"mod1code":"red-dmg","mod1min":2,"mod1max":2} |
| of Absorption | 1 | 1 | 1 | 32 | 0 | 24 | 1 | 4 | tors, shld, circ | 无 | {"mod1code":"red-dmg","mod1min":3,"mod1max":3} |
| of Life | 1 | 1 | 1 | 41 | 0 | 33 | 1 | 4 | tors, shld, circ | 无 | {"mod1code":"red-dmg","mod1min":4,"mod1max":7} |
| of Anima | 100 | 1 | 0 | 51 | 0 | 43 | 1 | 4 | tors, shld, circ | 无 | {"mod1code":"red-dmg","mod1min":8,"mod1max":15} |
| of Warding | 1 | 1 | 1 | 7 | 0 | 5 | 2 | 4 | tors, shld, ring, amul, orb, circ | 无 | {"mod1code":"red-mag","mod1min":1,"mod1max":1} |
| of the Sentinel | 1 | 1 | 1 | 18 | 0 | 12 | 2 | 4 | ring, amul, orb, circ | 无 | {"mod1code":"red-mag","mod1min":2,"mod1max":2} |
| of Guarding | 1 | 1 | 1 | 26 | 0 | 19 | 2 | 4 | amul, orb, circ | 无 | {"mod1code":"red-mag","mod1min":3,"mod1max":3} |
| of Negation | 100 | 1 | 0 | 42 | 0 | 35 | 2 | 4 | amul, orb, circ | 无 | {"mod1code":"red-mag","mod1min":4,"mod1max":6} |
| of the Sentinel | 1 | 1 | 1 | 24 | 0 | 18 | 2 | 4 | tors, shld, circ | 无 | {"mod1code":"red-mag","mod1min":2,"mod1max":2} |
| of Guarding | 1 | 1 | 1 | 32 | 0 | 24 | 2 | 4 | tors, shld, circ | 无 | {"mod1code":"red-mag","mod1min":3,"mod1max":3} |
| of Negation | 100 | 1 | 0 | 41 | 0 | 33 | 2 | 4 | tors, shld, circ | 无 | {"mod1code":"red-mag","mod1min":4,"mod1max":6} |
| of Coolness | 100 | 0 | 1 | 11 | 0 | 8 | 3 | 1 | tors, shld, boot, circ | 无 | {"mod1code":"abs-fire","mod1min":2,"mod1max":2} |
| of Incombustibility | 100 | 0 | 1 | 19 | 0 | 14 | 3 | 1 | tors, shld, boot, circ | 无 | {"mod1code":"abs-fire","mod1min":3,"mod1max":3} |
| of Amianthus | 100 | 0 | 1 | 28 | 0 | 21 | 3 | 1 | tors, shld, boot, circ | 无 | {"mod1code":"abs-fire","mod1min":4,"mod1max":5} |
| of Fire Quenching | 100 | 0 | 0 | 38 | 0 | 30 | 3 | 1 | tors, shld, boot, circ | 无 | {"mod1code":"abs-fire","mod1min":6,"mod1max":8} |
| of Coolness | 100 | 0 | 1 | 13 | 0 | 9 | 3 | 1 | ring, amul, orb, circ | 无 | {"mod1code":"abs-fire","mod1min":2,"mod1max":2} |
| of Incombustibility | 100 | 0 | 1 | 22 | 0 | 16 | 3 | 1 | amul, orb, circ | 无 | {"mod1code":"abs-fire","mod1min":3,"mod1max":3} |
| of Amianthus | 100 | 0 | 1 | 33 | 0 | 25 | 3 | 1 | amul, orb, circ | 无 | {"mod1code":"abs-fire","mod1min":4,"mod1max":5} |
| of Fire Quenching | 100 | 0 | 0 | 46 | 0 | 38 | 3 | 1 | amul, orb, circ | 无 | {"mod1code":"abs-fire","mod1min":6,"mod1max":8} |
| of Faith | 100 | 0 | 1 | 23 | 0 | 17 | 3 | 1 | jewl | 无 | {"mod1code":"abs-fire","mod1min":1,"mod1max":2} |
| of Resistance | 100 | 0 | 1 | 11 | 0 | 8 | 3 | 1 | tors, shld, boot, circ | 无 | {"mod1code":"abs-ltng","mod1min":2,"mod1max":2} |
| of Insulation | 100 | 0 | 1 | 19 | 0 | 14 | 3 | 1 | tors, shld, boot, circ | 无 | {"mod1code":"abs-ltng","mod1min":3,"mod1max":3} |
| of Grounding | 100 | 0 | 1 | 28 | 0 | 21 | 3 | 1 | tors, shld, boot, circ | 无 | {"mod1code":"abs-ltng","mod1min":4,"mod1max":5} |
| of the Dynamo | 100 | 0 | 0 | 38 | 0 | 30 | 3 | 1 | tors, shld, boot, circ | 无 | {"mod1code":"abs-ltng","mod1min":6,"mod1max":8} |
| of Resistance | 100 | 0 | 1 | 13 | 0 | 9 | 3 | 1 | ring, amul, orb, circ | 无 | {"mod1code":"abs-ltng","mod1min":2,"mod1max":2} |
| of Insulation | 100 | 0 | 1 | 22 | 0 | 16 | 3 | 1 | amul, orb, circ | 无 | {"mod1code":"abs-ltng","mod1min":3,"mod1max":3} |
| of Grounding | 100 | 0 | 1 | 33 | 0 | 25 | 3 | 1 | amul, orb, circ | 无 | {"mod1code":"abs-ltng","mod1min":4,"mod1max":5} |
| of the Dynamo | 100 | 0 | 0 | 46 | 0 | 38 | 3 | 1 | amul, orb, circ | 无 | {"mod1code":"abs-ltng","mod1min":6,"mod1max":8} |
| of Stoicism | 100 | 0 | 1 | 22 | 0 | 16 | 3 | 1 | jewl | 无 | {"mod1code":"abs-ltng","mod1min":1,"mod1max":2} |
| of Warming | 100 | 0 | 1 | 11 | 0 | 8 | 3 | 1 | tors, shld, boot, circ | 无 | {"mod1code":"abs-cold","mod1min":2,"mod1max":2} |
| of Thawing | 100 | 0 | 1 | 19 | 0 | 14 | 3 | 1 | tors, shld, boot, circ | 无 | {"mod1code":"abs-cold","mod1min":3,"mod1max":3} |
| of the Dunes | 100 | 0 | 1 | 28 | 0 | 21 | 3 | 1 | tors, shld, boot, circ | 无 | {"mod1code":"abs-cold","mod1min":4,"mod1max":5} |
| of the Sirocco | 100 | 0 | 0 | 38 | 0 | 30 | 3 | 1 | tors, shld, boot, circ | 无 | {"mod1code":"abs-cold","mod1min":6,"mod1max":8} |
| of Warming | 100 | 0 | 1 | 13 | 0 | 9 | 3 | 1 | ring, amul, orb, circ | 无 | {"mod1code":"abs-cold","mod1min":2,"mod1max":2} |
| of Thawing | 100 | 0 | 1 | 22 | 0 | 16 | 3 | 1 | amul, orb, circ | 无 | {"mod1code":"abs-cold","mod1min":3,"mod1max":3} |
| of the Dunes | 100 | 0 | 1 | 33 | 0 | 25 | 3 | 1 | amul, orb, circ | 无 | {"mod1code":"abs-cold","mod1min":4,"mod1max":5} |
| of the Sirocco | 100 | 0 | 0 | 46 | 0 | 38 | 3 | 1 | amul, orb, circ | 无 | {"mod1code":"abs-cold","mod1min":6,"mod1max":8} |
| of Desire | 100 | 0 | 1 | 23 | 0 | 17 | 3 | 1 | jewl | 无 | {"mod1code":"abs-cold","mod1min":1,"mod1max":2} |
| of Piercing | 1 | 1 | 1 | 25 | 0 | 18 | 4 | 2 | rod, knif, h2h | 无 | {"mod1code":"ignore-ac","mod1min":1,"mod1max":1} |
| of Bashing | 100 | 0 | 1 | 16 | 0 | 12 | 5 | 4 | blun | wand, staf, orb | {"mod1code":"dmg-ac","mod1min":-25,"mod1max":-40} |
| of Puncturing | 100 | 0 | 1 | 6 | 0 | 4 | 5 | 4 | spea, knif, h2h | 无 | {"mod1code":"dmg-ac","mod1min":-10,"mod1max":-20} |
| of Thorns | 1 | 1 | 1 | 14 | 0 | 10 | 6 | 4 | tors, shld, belt, circ | 无 | {"mod1code":"thorns","mod1min":1,"mod1max":3} |
| of Spikes | 1 | 1 | 1 | 21 | 0 | 15 | 6 | 4 | tors, shld, belt, circ | 无 | {"mod1code":"thorns","mod1min":4,"mod1max":6} |
| of Razors | 100 | 1 | 1 | 34 | 0 | 26 | 6 | 4 | tors, shld, circ | 无 | {"mod1code":"thorns","mod1min":7,"mod1max":9} |
| of Swords | 100 | 1 | 0 | 47 | 0 | 39 | 6 | 4 | tors, shld, circ | 无 | {"mod1code":"thorns","mod1min":10,"mod1max":20} |
| of Malice | 100 | 1 | 1 | 37 | 0 | 29 | 6 | 4 | jewl | 无 | {"mod1code":"thorns","mod1min":1,"mod1max":5} |
| of Readiness | 1 | 1 | 1 | 5 | 0 | 3 | 7 | 6 | weap | wand, orb | {"mod1code":"swing1","mod1min":10,"mod1max":10} |
| of Alacrity | 1 | 1 | 1 | 25 | 0 | 17 | 7 | 6 | weap | wand, orb | {"mod1code":"swing2","mod1min":20,"mod1max":20} |
| of Swiftness | 1 | 1 | 1 | 34 | 0 | 26 | 7 | 6 | mele | wand, staf, orb | {"mod1code":"swing2","mod1min":30,"mod1max":30} |
| of Quickness | 1 | 1 | 1 | 46 | 0 | 38 | 7 | 5 | mele | wand, staf, orb | {"mod1code":"swing3","mod1min":40,"mod1max":40} |
| of Alacrity | 100 | 1 | 1 | 43 | 0 | 35 | 7 | 4 | glov | 无 | {"mod1code":"swing2","mod1min":20,"mod1max":20} |
| of Fervor | 100 | 1 | 0 | 39 | 0 | 31 | 7 | 4 | jewl | 无 | {"mod1code":"swing1","mod1min":15,"mod1max":15} |
| of Blocking | 1 | 1 | 1 | 1 | 0 | 1 | 8 | 7 | shld | 无 | {"mod1code":"block","mod1min":10,"mod1max":10,"mod2code":"block2","mod2min":15,"mod2max":15} |
| of Deflecting | 1 | 1 | 1 | 11 | 0 | 8 | 8 | 6 | shld | 无 | {"mod1code":"block","mod1min":20,"mod1max":20,"mod2code":"block2","mod2min":30,"mod2max":30} |
| of the Apprentice | 1 | 1 | 1 | 5 | 0 | 3 | 9 | 6 | rod, ring, amul, orb, circ | 无 | {"mod1code":"cast1","mod1min":10,"mod1max":10} |
| of the Magus | 1 | 1 | 1 | 29 | 0 | 21 | 9 | 5 | rod, orb, circ | scep | {"mod1code":"cast3","mod1min":20,"mod1max":20} |
| of Frost | 1 | 1 | 1 | 4 | 0 | 3 | 10 | 5 | weap | wand, orb | {"mod1code":"cold-min","mod1min":1,"mod1max":1,"mod2code":"cold-max","mod2min":1,"mod2max":2,"mod3code":"cold-len","mod3min":50,"mod3max":50} |
| of the Icicle | 100 | 1 | 1 | 13 | 0 | 9 | 10 | 4 | weap | wand, orb | {"mod1code":"cold-min","mod1min":1,"mod1max":1,"mod2code":"cold-max","mod2min":3,"mod2max":4,"mod3code":"cold-len","mod3min":75,"mod3max":75} |
| of the Glacier | 1 | 1 | 1 | 27 | 0 | 20 | 10 | 3 | weap | wand, orb | {"mod1code":"cold-min","mod1min":2,"mod1max":4,"mod2code":"cold-max","mod2min":4,"mod2max":15,"mod3code":"cold-len","mod3min":100,"mod3max":100} |
| of Winter | 100 | 1 | 1 | 45 | 0 | 37 | 10 | 2 | mele | wand, orb | {"mod1code":"cold-min","mod1min":5,"mod1max":9,"mod2code":"cold-max","mod2min":16,"mod2max":50,"mod3code":"cold-len","mod3min":150,"mod3max":150} |
| of Frost | 1 | 1 | 1 | 55 | 0 | 41 | 10 | 2 | belt, amul | 无 | {"mod1code":"cold-min","mod1min":1,"mod1max":1,"mod2code":"cold-max","mod2min":3,"mod2max":6,"mod3code":"cold-len","mod3min":50,"mod3max":50} |
| of Frigidity | 100 | 1 | 1 | 16 | 0 | 12 | 10 | 2 | jewl | 无 | {"mod1code":"cold-min","mod1min":1,"mod1max":1,"mod2code":"cold-max","mod2min":3,"mod2max":5,"mod3code":"cold-len","mod3min":50,"mod3max":50} |
| of Warmth | 1 | 1 | 1 | 10 | 0 | 7 | 11 | 4 | shld, boot, glov, ring, amul, circ, orb | 无 | {"mod1code":"half-freeze","mod1min":1,"mod1max":1} |
| of Flame | 1 | 1 | 1 | 4 | 0 | 3 | 12 | 5 | weap | wand, orb | {"mod1code":"fire-min","mod1min":1,"mod1max":1,"mod2code":"fire-max","mod2min":2,"mod2max":5} |
| of Fire | 1 | 1 | 1 | 15 | 0 | 11 | 12 | 4 | weap | wand, orb | {"mod1code":"fire-min","mod1min":1,"mod1max":4,"mod2code":"fire-max","mod2min":6,"mod2max":11} |
| of Burning | 1 | 1 | 1 | 25 | 0 | 18 | 12 | 3 | weap | wand, orb | {"mod1code":"fire-min","mod1min":5,"mod1max":9,"mod2code":"fire-max","mod2min":10,"mod2max":20} |
| of Incineration | 100 | 1 | 1 | 43 | 0 | 35 | 12 | 2 | mele | wand, orb | {"mod1code":"fire-min","mod1min":10,"mod1max":20,"mod2code":"fire-max","mod2min":21,"mod2max":75} |
| of Flame | 100 | 1 | 1 | 40 | 0 | 30 | 12 | 2 | glov, ring, amul | 无 | {"mod1code":"fire-min","mod1min":1,"mod1max":1,"mod2code":"fire-max","mod2min":2,"mod2max":6} |
| of Passion | 100 | 1 | 1 | 15 | 0 | 11 | 12 | 2 | jewl | 无 | {"mod1code":"fire-min","mod1min":1,"mod1max":3,"mod2code":"fire-max","mod2min":6,"mod2max":10} |
| of Shock | 1 | 1 | 1 | 4 | 0 | 3 | 13 | 5 | weap | wand, orb | {"mod1code":"ltng-min","mod1min":1,"mod1max":1,"mod2code":"ltng-max","mod2min":6,"mod2max":8} |
| of Lightning | 1 | 1 | 1 | 15 | 0 | 11 | 13 | 4 | weap | wand, orb | {"mod1code":"ltng-min","mod1min":1,"mod1max":1,"mod2code":"ltng-max","mod2min":9,"mod2max":16} |
| of Thunder | 1 | 1 | 1 | 25 | 0 | 18 | 13 | 3 | weap | wand, orb | {"mod1code":"ltng-min","mod1min":1,"mod1max":1,"mod2code":"ltng-max","mod2min":17,"mod2max":40} |
| of Storms | 100 | 1 | 1 | 34 | 0 | 26 | 13 | 2 | mele | wand, orb | {"mod1code":"ltng-min","mod1min":1,"mod1max":6,"mod2code":"ltng-max","mod2min":41,"mod2max":120} |
| of Shock | 100 | 1 | 1 | 50 | 0 | 37 | 13 | 2 | boot, ring, amul | 无 | {"mod1code":"ltng-min","mod1min":1,"mod1max":1,"mod2code":"ltng-max","mod2min":11,"mod2max":23} |
| of Ennui | 100 | 1 | 1 | 15 | 0 | 11 | 13 | 2 | jewl | 无 | {"mod1code":"ltng-min","mod1min":1,"mod1max":1,"mod2code":"ltng-max","mod2min":10,"mod2max":20} |
| of Craftsmanship | 1 | 1 | 1 | 1 | 0 | 1 | 14 | 8 | weap, ring, amul | wand, staf, orb | {"mod1code":"dmg-max","mod1min":1,"mod1max":1} |
| of Quality | 1 | 1 | 1 | 4 | 0 | 3 | 14 | 8 | weap | wand, staf, orb | {"mod1code":"dmg-max","mod1min":2,"mod1max":2} |
| of Maiming | 1 | 1 | 1 | 7 | 0 | 5 | 14 | 7 | weap | wand, staf, orb | {"mod1code":"dmg-max","mod1min":3,"mod1max":4} |
| of Slaying | 1 | 1 | 1 | 11 | 0 | 8 | 14 | 7 | weap | wand, staf, orb | {"mod1code":"dmg-max","mod1min":5,"mod1max":7} |
| of Gore | 1 | 1 | 1 | 14 | 0 | 10 | 14 | 6 | weap | wand, staf, orb | {"mod1code":"dmg-max","mod1min":8,"mod1max":10} |
| of Carnage | 1 | 1 | 1 | 19 | 0 | 14 | 14 | 6 | weap | wand, staf, orb | {"mod1code":"dmg-max","mod1min":11,"mod1max":14} |
| of Slaughter | 1 | 1 | 1 | 25 | 0 | 18 | 14 | 5 | weap | wand, staf, orb | {"mod1code":"dmg-max","mod1min":15,"mod1max":20} |
| of Butchery | 100 | 1 | 0 | 35 | 0 | 27 | 14 | 5 | weap | wand, staf, orb | {"mod1code":"dmg-max","mod1min":21,"mod1max":40} |
| of Evisceration | 100 | 1 | 0 | 45 | 0 | 37 | 14 | 4 | weap | wand, staf, orb | {"mod1code":"dmg-max","mod1min":41,"mod1max":63} |
| of Maiming | 1 | 1 | 1 | 42 | 0 | 34 | 14 | 4 | shld, ring, amul | 无 | {"mod1code":"dmg-max","mod1min":3,"mod1max":4} |
| of Craftsmanship | 100 | 1 | 1 | 1 | 7 | 1 | 14 | 4 | circ | 无 | {"mod1code":"dmg-max","mod1min":1,"mod1max":2} |
| of Craftsmanship | 100 | 1 | 1 | 8 | 14 | 6 | 14 | 4 | circ | 无 | {"mod1code":"dmg-max","mod1min":2,"mod1max":3} |
| of Craftsmanship | 100 | 1 | 1 | 15 | 0 | 11 | 14 | 4 | circ | 无 | {"mod1code":"dmg-max","mod1min":4,"mod1max":5} |
| of Quality | 100 | 1 | 1 | 23 | 29 | 17 | 14 | 4 | circ | 无 | {"mod1code":"dmg-max","mod1min":6,"mod1max":7} |
| of Quality | 100 | 1 | 1 | 30 | 0 | 22 | 14 | 4 | circ | 无 | {"mod1code":"dmg-max","mod1min":7,"mod1max":8} |
| of Maiming | 100 | 1 | 0 | 37 | 44 | 29 | 14 | 4 | circ | 无 | {"mod1code":"dmg-max","mod1min":9,"mod1max":10} |
| of Maiming | 100 | 1 | 0 | 45 | 0 | 37 | 14 | 4 | circ | 无 | {"mod1code":"dmg-max","mod1min":11,"mod1max":12} |
| of Craftsmanship | 100 | 0 | 1 | 8 | 17 | 6 | 14 | 4 | mcha | 无 | {"mod1code":"dmg-max","mod1min":1,"mod1max":1} |
| of Craftsmanship | 100 | 0 | 1 | 18 | 0 | 13 | 14 | 4 | mcha | 无 | {"mod1code":"dmg-max","mod1min":2,"mod1max":2} |
| of Quality | 100 | 0 | 1 | 28 | 37 | 21 | 14 | 4 | mcha | 无 | {"mod1code":"dmg-max","mod1min":3,"mod1max":4} |
| of Quality | 100 | 0 | 1 | 38 | 0 | 30 | 14 | 4 | mcha | 无 | {"mod1code":"dmg-max","mod1min":5,"mod1max":6} |
| of Maiming | 100 | 0 | 0 | 48 | 0 | 40 | 14 | 4 | mcha | 无 | {"mod1code":"dmg-max","mod1min":7,"mod1max":8} |
| of Craftsmanship | 100 | 0 | 1 | 21 | 0 | 15 | 14 | 4 | scha | 无 | {"mod1code":"dmg-max","mod1min":1,"mod1max":1} |
| of Quality | 100 | 0 | 1 | 36 | 0 | 28 | 14 | 4 | scha | 无 | {"mod1code":"dmg-max","mod1min":2,"mod1max":2} |
| of Maiming | 100 | 0 | 0 | 51 | 0 | 43 | 14 | 4 | scha | 无 | {"mod1code":"dmg-max","mod1min":3,"mod1max":4} |
| of Ire | 100 | 1 | 1 | 4 | 0 | 3 | 14 | 4 | jewl | 无 | {"mod1code":"dmg-max","mod1min":2,"mod1max":5} |
| of Wrath | 100 | 1 | 1 | 11 | 0 | 8 | 14 | 4 | jewl | 无 | {"mod1code":"dmg-max","mod1min":6,"mod1max":9} |
| of Carnage | 100 | 1 | 0 | 25 | 0 | 18 | 14 | 4 | jewl | 无 | {"mod1code":"dmg-max","mod1min":11,"mod1max":15} |
| of Worth | 1 | 1 | 1 | 1 | 0 | 1 | 15 | 8 | weap | staf, wand, orb | {"mod1code":"dmg-min","mod1min":1,"mod1max":2} |
| of Measure | 1 | 1 | 1 | 12 | 0 | 9 | 15 | 7 | weap | staf, wand, orb | {"mod1code":"dmg-min","mod1min":3,"mod1max":4} |
| of Excellence | 1 | 1 | 1 | 24 | 0 | 18 | 15 | 6 | weap | staf, wand, orb | {"mod1code":"dmg-min","mod1min":5,"mod1max":8} |
| of Performance | 1 | 1 | 1 | 48 | 0 | 40 | 15 | 5 | weap | staf, wand, orb | {"mod1code":"dmg-min","mod1min":9,"mod1max":14} |
| of Transcendence | 100 | 1 | 1 | 76 | 0 | 68 | 15 | 4 | weap | staf, wand, orb | {"mod1code":"dmg-min","mod1min":15,"mod1max":20} |
| of Worth | 1 | 1 | 1 | 15 | 0 | 11 | 15 | 4 | ring, amul, circ | 无 | {"mod1code":"dmg-min","mod1min":2,"mod1max":3} |
| of Measure | 1 | 1 | 1 | 37 | 0 | 29 | 15 | 4 | ring, amul, circ | 无 | {"mod1code":"dmg-min","mod1min":4,"mod1max":5} |
| of Excellence | 1 | 1 | 1 | 59 | 0 | 51 | 15 | 4 | ring, amul, circ | 无 | {"mod1code":"dmg-min","mod1min":6,"mod1max":9} |
| of Performance | 100 | 1 | 0 | 81 | 0 | 73 | 15 | 4 | ring, amul, circ | 无 | {"mod1code":"dmg-min","mod1min":10,"mod1max":13} |
| of Joyfulness | 100 | 1 | 1 | 5 | 0 | 3 | 15 | 4 | jewl | 无 | {"mod1code":"dmg-min","mod1min":1,"mod1max":4} |
| of Bliss | 100 | 1 | 1 | 43 | 0 | 37 | 15 | 4 | jewl | 无 | {"mod1code":"dmg-min","mod1min":5,"mod1max":10} |
| of Blight | 1 | 1 | 1 | 5 | 0 | 3 | 16 | 5 | weap, circ | rod, orb | {"mod1code":"dmg-pois","mod1param":75,"mod1min":24,"mod1max":24} |
| of Venom | 1 | 1 | 1 | 15 | 0 | 11 | 16 | 4 | weap, circ | rod, orb | {"mod1code":"dmg-pois","mod1param":100,"mod1min":54,"mod1max":54} |
| of Pestilence | 1 | 1 | 1 | 25 | 0 | 18 | 16 | 3 | weap, circ | rod, orb | {"mod1code":"dmg-pois","mod1param":125,"mod1min":103,"mod1max":103} |
| of Anthrax | 100 | 1 | 1 | 33 | 0 | 25 | 16 | 2 | weap | rod, orb | {"mod1code":"dmg-pois","mod1param":150,"mod1min":171,"mod1max":171} |
| of Blight | 100 | 1 | 1 | 45 | 0 | 33 | 16 | 2 | ring, amul | 无 | {"mod1code":"dmg-pois","mod1param":75,"mod1min":171,"mod1max":171} |
| of Envy | 100 | 1 | 1 | 1 | 0 | 1 | 16 | 2 | jewl | 无 | {"mod1code":"dmg-pois","mod1param":50,"mod1min":103,"mod1max":103} |
| of Dexterity | 1 | 1 | 1 | 1 | 0 | 1 | 17 | 4 | amul, miss, circ | 无 | {"mod1code":"dex","mod1min":1,"mod1max":2} |
| of Skill | 1 | 1 | 1 | 11 | 0 | 8 | 17 | 3 | amul, miss, circ | 无 | {"mod1code":"dex","mod1min":3,"mod1max":5} |
| of Accuracy | 1 | 1 | 1 | 27 | 0 | 20 | 17 | 3 | amul, miss, circ | 无 | {"mod1code":"dex","mod1min":6,"mod1max":9} |
| of Precision | 1 | 1 | 1 | 43 | 0 | 35 | 17 | 3 | amul, miss, circ | 无 | {"mod1code":"dex","mod1min":10,"mod1max":15} |
| of Perfection | 1 | 1 | 1 | 59 | 0 | 51 | 17 | 3 | amul, miss, circ | 无 | {"mod1code":"dex","mod1min":16,"mod1max":20} |
| of Nirvana | 100 | 1 | 0 | 72 | 0 | 64 | 17 | 3 | amul, miss, circ | 无 | {"mod1code":"dex","mod1min":21,"mod1max":30} |
| of Dexterity | 1 | 1 | 1 | 6 | 0 | 4 | 17 | 4 | ring, glov | 无 | {"mod1code":"dex","mod1min":1,"mod1max":2} |
| of Skill | 1 | 1 | 1 | 22 | 0 | 16 | 17 | 3 | ring, glov | 无 | {"mod1code":"dex","mod1min":3,"mod1max":5} |
| of Accuracy | 1 | 1 | 1 | 39 | 0 | 31 | 17 | 3 | ring, glov | 无 | {"mod1code":"dex","mod1min":6,"mod1max":9} |
| of Precision | 1 | 1 | 1 | 56 | 0 | 48 | 17 | 3 | ring, glov | 无 | {"mod1code":"dex","mod1min":10,"mod1max":15} |
| of Perfection | 100 | 1 | 0 | 75 | 0 | 67 | 17 | 3 | ring, glov | 无 | {"mod1code":"dex","mod1min":16,"mod1max":20} |
| of Dexterity | 1 | 1 | 1 | 13 | 0 | 9 | 17 | 3 | tors, boot | glov | {"mod1code":"dex","mod1min":2,"mod1max":3} |
| of Skill | 1 | 1 | 1 | 34 | 0 | 26 | 17 | 3 | tors, boot | glov | {"mod1code":"dex","mod1min":4,"mod1max":5} |
| of Accuracy | 1 | 1 | 1 | 46 | 0 | 38 | 17 | 3 | tors, boot | glov | {"mod1code":"dex","mod1min":6,"mod1max":9} |
| of Precision | 100 | 1 | 0 | 60 | 0 | 52 | 17 | 3 | tors, boot | glov | {"mod1code":"dex","mod1min":10,"mod1max":15} |
| of Dexterity | 100 | 1 | 1 | 1 | 0 | 1 | 31 | 4 | lcha | 无 | {"mod1code":"dex","mod1min":3,"mod1max":4} |
| of Dexterity | 100 | 1 | 1 | 3 | 0 | 2 | 31 | 4 | mcha | 无 | {"mod1code":"dex","mod1min":2,"mod1max":3} |
| of Dexterity | 100 | 1 | 1 | 7 | 0 | 5 | 31 | 4 | scha | 无 | {"mod1code":"dex","mod1min":1,"mod1max":1} |
| of Dexterity | 100 | 1 | 1 | 14 | 0 | 10 | 31 | 4 | lcha | 无 | {"mod1code":"dex","mod1min":5,"mod1max":6} |
| of Dexterity | 100 | 1 | 1 | 18 | 0 | 13 | 31 | 4 | mcha | 无 | {"mod1code":"dex","mod1min":4,"mod1max":5} |
| of Dexterity | 100 | 1 | 1 | 22 | 0 | 16 | 31 | 4 | scha | 无 | {"mod1code":"dex","mod1min":2,"mod1max":2} |
| of Daring | 100 | 1 | 1 | 7 | 0 | 5 | 17 | 3 | jewl | 无 | {"mod1code":"dex","mod1min":1,"mod1max":3} |
| of Balance | 1 | 1 | 1 | 5 | 0 | 3 | 18 | 4 | armo | glov | {"mod1code":"balance1","mod1min":10,"mod1max":10} |
| of Equilibrium | 1 | 1 | 1 | 9 | 0 | 6 | 18 | 4 | tors, belt, shld | 无 | {"mod1code":"balance2","mod1min":17,"mod1max":17} |
| of Stability | 1 | 1 | 1 | 18 | 0 | 13 | 18 | 4 | tors, belt | 无 | {"mod1code":"balance3","mod1min":24,"mod1max":24} |
| of Balance | 100 | 1 | 1 | 1 | 0 | 1 | 18 | 4 | lcha | 无 | {"mod1code":"balance3","mod1min":12,"mod1max":12} |
| of Balance | 100 | 1 | 1 | 19 | 0 | 14 | 18 | 4 | mcha | 无 | {"mod1code":"balance2","mod1min":8,"mod1max":8} |
| of Balance | 100 | 1 | 1 | 37 | 0 | 29 | 18 | 4 | scha | 无 | {"mod1code":"balance1","mod1min":5,"mod1max":5} |
| of Truth | 100 | 1 | 1 | 44 | 0 | 36 | 18 | 4 | jewl | 无 | {"mod1code":"balance1","mod1min":7,"mod1max":7} |
| of Regeneration | 1 | 1 | 1 | 10 | 0 | 7 | 19 | 4 | scep, belt, ring, amul, circ | 无 | {"mod1code":"regen","mod1min":3,"mod1max":5} |
| of Regeneration | 1 | 1 | 1 | 40 | 0 | 30 | 19 | 4 | shld, glov | 无 | {"mod1code":"regen","mod1min":3,"mod1max":5} |
| of Regeneration | 1 | 1 | 1 | 70 | 0 | 52 | 19 | 4 | tors, weap, boot | scep | {"mod1code":"regen","mod1min":3,"mod1max":5} |
| of Regrowth | 1 | 1 | 1 | 17 | 0 | 12 | 19 | 4 | scep, amul, circ | 无 | {"mod1code":"regen","mod1min":6,"mod1max":10} |
| of Regrowth | 1 | 1 | 1 | 55 | 0 | 41 | 19 | 4 | belt, ring | 无 | {"mod1code":"regen","mod1min":6,"mod1max":9} |
| of Revivification | 100 | 1 | 0 | 38 | 0 | 30 | 19 | 4 | scep, amul, circ | 无 | {"mod1code":"regen","mod1min":11,"mod1max":15} |
| of Honor | 100 | 1 | 1 | 47 | 0 | 35 | 19 | 4 | jewl | 无 | {"mod1code":"regen","mod1min":1,"mod1max":4} |
| of Vileness | 1 | 1 | 1 | 9 | 0 | 6 | 20 | 3 | mele | rod, orb | {"mod1code":"noheal","mod1min":1,"mod1max":1} |
| of Greed | 1 | 1 | 1 | 1 | 0 | 1 | 21 | 4 | ring, amul, circ | 无 | {"mod1code":"gold%","mod1min":25,"mod1max":40} |
| of Wealth | 1 | 1 | 1 | 17 | 0 | 12 | 21 | 4 | boot, glov, belt, amul, circ | 无 | {"mod1code":"gold%","mod1min":41,"mod1max":80} |
| of Greed | 100 | 1 | 1 | 1 | 0 | 1 | 21 | 4 | lcha | 无 | {"mod1code":"gold%","mod1min":10,"mod1max":20} |
| of Greed | 100 | 1 | 1 | 7 | 0 | 5 | 21 | 4 | lcha | 无 | {"mod1code":"gold%","mod1min":21,"mod1max":30} |
| of Greed | 100 | 1 | 1 | 19 | 0 | 14 | 21 | 4 | lcha | 无 | {"mod1code":"gold%","mod1min":31,"mod1max":40} |
| of Greed | 100 | 1 | 1 | 1 | 0 | 5 | 21 | 4 | mcha | 无 | {"mod1code":"gold%","mod1min":5,"mod1max":10} |
| of Greed | 100 | 1 | 1 | 20 | 0 | 15 | 21 | 4 | mcha | 无 | {"mod1code":"gold%","mod1min":11,"mod1max":22} |
| of Greed | 100 | 1 | 1 | 1 | 0 | 15 | 21 | 4 | scha | 无 | {"mod1code":"gold%","mod1min":5,"mod1max":10} |
| of Avarice | 100 | 1 | 1 | 1 | 0 | 1 | 21 | 4 | jewl | 无 | {"mod1code":"gold%","mod1min":10,"mod1max":30} |
| of Chance | 1 | 1 | 1 | 12 | 0 | 9 | 22 | 4 | boot, glov, ring, amul, circ | 无 | {"mod1code":"mag%","mod1min":5,"mod1max":15} |
| of Fortune | 1 | 1 | 1 | 16 | 0 | 12 | 22 | 4 | boot, glov, amul, circ | 无 | {"mod1code":"mag%","mod1min":16,"mod1max":25} |
| of Fortune | 1 | 1 | 0 | 42 | 0 | 31 | 22 | 4 | ring | 无 | {"mod1code":"mag%","mod1min":16,"mod1max":25} |
| of Luck | 100 | 1 | 0 | 26 | 0 | 19 | 22 | 4 | boot, amul, circ | 无 | {"mod1code":"mag%","mod1min":26,"mod1max":35} |
| of Fortune | 100 | 1 | 1 | 31 | 0 | 18 | 22 | 3 | scha | 无 | {"mod1code":"mag%","mod1min":3,"mod1max":5} |
| of Good Luck | 100 | 1 | 0 | 47 | 0 | 33 | 22 | 2 | scha | 无 | {"mod1code":"mag%","mod1min":6,"mod1max":7} |
| of Prosperity | 100 | 1 | 1 | 26 | 0 | 19 | 22 | 2 | jewl | 无 | {"mod1code":"mag%","mod1min":5,"mod1max":10} |
| of Energy | 1 | 1 | 1 | 1 | 0 | 1 | 23 | 4 | amul, orb, circ, wand, staf | 无 | {"mod1code":"enr","mod1min":1,"mod1max":3} |
| of the Mind | 1 | 1 | 1 | 7 | 0 | 3 | 23 | 4 | amul, orb, circ, wand, staf | 无 | {"mod1code":"enr","mod1min":4,"mod1max":6} |
| of Brilliance | 1 | 1 | 1 | 13 | 0 | 9 | 23 | 3 | amul, orb, circ, wand, staf | 无 | {"mod1code":"enr","mod1min":7,"mod1max":10} |
| of Sorcery | 1 | 1 | 1 | 21 | 0 | 16 | 23 | 3 | amul, orb, circ, wand, staf | 无 | {"mod1code":"enr","mod1min":11,"mod1max":15} |
| of Wizardry | 1 | 1 | 1 | 31 | 0 | 23 | 23 | 3 | amul, orb, circ, wand, staf | 无 | {"mod1code":"enr","mod1min":16,"mod1max":20} |
| of Enlightenment | 100 | 1 | 0 | 41 | 0 | 33 | 23 | 3 | amul, orb, circ, wand, staf | 无 | {"mod1code":"enr","mod1min":21,"mod1max":30} |
| of Energy | 1 | 1 | 1 | 7 | 0 | 5 | 23 | 4 | ring | 无 | {"mod1code":"enr","mod1min":1,"mod1max":3} |
| of the Mind | 1 | 1 | 1 | 13 | 0 | 9 | 23 | 3 | ring | 无 | {"mod1code":"enr","mod1min":4,"mod1max":6} |
| of Brilliance | 1 | 1 | 1 | 21 | 0 | 16 | 23 | 3 | ring | 无 | {"mod1code":"enr","mod1min":7,"mod1max":10} |
| of Sorcery | 1 | 1 | 1 | 31 | 0 | 23 | 23 | 3 | ring | 无 | {"mod1code":"enr","mod1min":11,"mod1max":15} |
| of Wizardry | 100 | 1 | 0 | 41 | 0 | 33 | 23 | 3 | ring | 无 | {"mod1code":"enr","mod1min":16,"mod1max":20} |
| of Energy | 1 | 1 | 1 | 4 | 0 | 3 | 23 | 3 | helm, scep | 无 | {"mod1code":"enr","mod1min":1,"mod1max":3} |
| of the Mind | 1 | 1 | 1 | 10 | 0 | 7 | 23 | 3 | helm, scep | 无 | {"mod1code":"enr","mod1min":4,"mod1max":6} |
| of Brilliance | 1 | 1 | 1 | 16 | 0 | 12 | 23 | 3 | helm, scep | 无 | {"mod1code":"enr","mod1min":7,"mod1max":10} |
| of Sorcery | 100 | 1 | 0 | 26 | 0 | 21 | 23 | 3 | helm, scep | 无 | {"mod1code":"enr","mod1min":11,"mod1max":15} |
| of Knowledge | 100 | 1 | 1 | 9 | 0 | 6 | 23 | 3 | jewl | 无 | {"mod1code":"enr","mod1min":1,"mod1max":5} |
| of the Bear | 1 | 1 | 1 | 8 | 0 | 6 | 24 | 3 | mele | 无 | {"mod1code":"knock","mod1min":1,"mod1max":1} |
| of Light | 1 | 1 | 1 | 6 | 0 | 4 | 25 | 1 | armo, rod, ring, amul | 无 | {"mod1code":"light","mod1min":1,"mod1max":1,"mod2code":"att","mod2min":15,"mod2max":15} |
| of Radiance | 1 | 1 | 1 | 15 | 0 | 11 | 25 | 1 | rod, miss, ring, amul, helm | 无 | {"mod1code":"light","mod1min":3,"mod1max":3,"mod2code":"att","mod2min":30,"mod2max":30} |
| of the Sun | 1 | 1 | 1 | 17 | 0 | 12 | 25 | 1 | rod, miss, glov, ring, amul, helm | 无 | {"mod1code":"light","mod1min":5,"mod1max":5,"mod2code":"att%","mod2min":5,"mod2max":5} |
| of the Jackal | 1 | 1 | 1 | 1 | 0 | 1 | 26 | 3 | tors, belt, amul, phlm, circ | 无 | {"mod1code":"hp","mod1min":1,"mod1max":5} |
| of the Fox | 1 | 1 | 1 | 7 | 0 | 5 | 26 | 3 | tors, belt, amul, phlm, circ | 无 | {"mod1code":"hp","mod1min":6,"mod1max":10} |
| of the Wolf | 1 | 1 | 1 | 15 | 0 | 11 | 26 | 3 | tors, belt, amul, phlm, circ | 无 | {"mod1code":"hp","mod1min":11,"mod1max":20} |
| of the Tiger | 1 | 1 | 1 | 20 | 0 | 15 | 26 | 3 | tors, belt, amul, phlm, circ | 无 | {"mod1code":"hp","mod1min":21,"mod1max":30} |
| of the Mammoth | 1 | 1 | 1 | 25 | 0 | 18 | 26 | 3 | tors, belt, amul, phlm, circ | 无 | {"mod1code":"hp","mod1min":31,"mod1max":40} |
| of the Colosuss | 1 | 1 | 1 | 30 | 0 | 22 | 26 | 3 | tors, belt, amul, phlm, circ | 无 | {"mod1code":"hp","mod1min":41,"mod1max":60} |
| of the Squid | 100 | 1 | 0 | 40 | 0 | 30 | 26 | 3 | tors, belt, amul, phlm, circ | 无 | {"mod1code":"hp","mod1min":61,"mod1max":80} |
| of the Whale | 100 | 1 | 0 | 50 | 0 | 37 | 26 | 3 | tors, belt, amul, phlm, circ | 无 | {"mod1code":"hp","mod1min":81,"mod1max":100} |
| of the Jackal | 100 | 1 | 1 | 4 | 0 | 3 | 26 | 3 | shld, pelt | 无 | {"mod1code":"hp","mod1min":1,"mod1max":5} |
| of the Fox | 100 | 1 | 1 | 11 | 0 | 8 | 26 | 3 | shld, pelt | 无 | {"mod1code":"hp","mod1min":6,"mod1max":10} |
| of the Wolf | 100 | 1 | 1 | 27 | 0 | 20 | 26 | 3 | shld, pelt | 无 | {"mod1code":"hp","mod1min":11,"mod1max":20} |
| of the Tiger | 100 | 1 | 1 | 43 | 0 | 35 | 26 | 3 | shld, pelt | 无 | {"mod1code":"hp","mod1min":21,"mod1max":30} |
| of the Mammoth | 100 | 1 | 1 | 59 | 0 | 51 | 26 | 3 | shld, pelt | 无 | {"mod1code":"hp","mod1min":31,"mod1max":40} |
| of the Colosuss | 100 | 1 | 0 | 75 | 0 | 67 | 26 | 3 | shld, pelt | 无 | {"mod1code":"hp","mod1min":41,"mod1max":60} |
| of the Jackal | 1 | 1 | 1 | 8 | 0 | 6 | 26 | 3 | club, hamm, mace, ring, helm | 无 | {"mod1code":"hp","mod1min":1,"mod1max":5} |
| of the Fox | 1 | 1 | 1 | 17 | 0 | 13 | 26 | 3 | club, hamm, mace, ring, helm | 无 | {"mod1code":"hp","mod1min":6,"mod1max":10} |
| of the Wolf | 1 | 1 | 1 | 34 | 0 | 26 | 26 | 3 | club, hamm, mace, ring, helm | 无 | {"mod1code":"hp","mod1min":11,"mod1max":20} |
| of the Tiger | 1 | 1 | 1 | 51 | 0 | 43 | 26 | 3 | club, hamm, mace, ring, helm | 无 | {"mod1code":"hp","mod1min":21,"mod1max":30} |
| of the Mammoth | 1 | 1 | 1 | 68 | 0 | 60 | 26 | 3 | club, hamm, mace, ring, helm | 无 | {"mod1code":"hp","mod1min":31,"mod1max":40} |
| of Life | 100 | 1 | 1 | 1 | 0 | 1 | 26 | 4 | lcha | 无 | {"mod1code":"hp","mod1min":5,"mod1max":10} |
| of Life | 100 | 1 | 1 | 9 | 0 | 6 | 26 | 4 | lcha | 无 | {"mod1code":"hp","mod1min":11,"mod1max":15} |
| of Life | 100 | 1 | 1 | 19 | 0 | 14 | 26 | 4 | lcha | 无 | {"mod1code":"hp","mod1min":16,"mod1max":20} |
| of Substinence | 100 | 1 | 1 | 31 | 0 | 23 | 26 | 4 | lcha | 无 | {"mod1code":"hp","mod1min":21,"mod1max":25} |
| of Substinence | 100 | 1 | 1 | 45 | 0 | 37 | 26 | 4 | lcha | 无 | {"mod1code":"hp","mod1min":26,"mod1max":30} |
| of Substinence | 100 | 1 | 1 | 61 | 0 | 53 | 26 | 4 | lcha | 无 | {"mod1code":"hp","mod1min":31,"mod1max":35} |
| of Vita | 100 | 1 | 0 | 77 | 0 | 69 | 26 | 4 | lcha | 无 | {"mod1code":"hp","mod1min":36,"mod1max":40} |
| of Vita | 100 | 1 | 0 | 91 | 0 | 83 | 26 | 4 | lcha | 无 | {"mod1code":"hp","mod1min":41,"mod1max":45} |
| of Vita | 100 | 1 | 0 | 110 | 0 | 97 | 26 | 4 | lcha | 无 | {"mod1code":"hp","mod1min":46,"mod1max":50} |
| of Life | 100 | 1 | 1 | 1 | 0 | 9 | 26 | 4 | mcha | 无 | {"mod1code":"hp","mod1min":6,"mod1max":10} |
| of Life | 100 | 1 | 1 | 12 | 0 | 9 | 26 | 4 | mcha | 无 | {"mod1code":"hp","mod1min":11,"mod1max":15} |
| of Substinence | 100 | 1 | 1 | 26 | 0 | 19 | 26 | 4 | mcha | 无 | {"mod1code":"hp","mod1min":16,"mod1max":20} |
| of Substinence | 100 | 1 | 1 | 42 | 0 | 34 | 26 | 4 | mcha | 无 | {"mod1code":"hp","mod1min":21,"mod1max":25} |
| of Vita | 100 | 1 | 0 | 58 | 0 | 50 | 26 | 4 | mcha | 无 | {"mod1code":"hp","mod1min":26,"mod1max":30} |
| of Vita | 100 | 1 | 0 | 74 | 0 | 66 | 26 | 4 | mcha | 无 | {"mod1code":"hp","mod1min":31,"mod1max":35} |
| of Life | 100 | 1 | 1 | 1 | 0 | 14 | 26 | 4 | scha | 无 | {"mod1code":"hp","mod1min":5,"mod1max":10} |
| of Substinence | 100 | 1 | 1 | 23 | 0 | 17 | 26 | 4 | scha | 无 | {"mod1code":"hp","mod1min":11,"mod1max":15} |
| of Vita | 100 | 1 | 0 | 47 | 0 | 39 | 26 | 4 | scha | 无 | {"mod1code":"hp","mod1min":16,"mod1max":20} |
| of Spirit | 100 | 1 | 1 | 1 | 0 | 1 | 26 | 4 | jewl | 无 | {"mod1code":"hp","mod1min":3,"mod1max":8} |
| of Hope | 100 | 1 | 0 | 45 | 0 | 37 | 26 | 4 | jewl | 无 | {"mod1code":"hp","mod1min":9,"mod1max":20} |
| of the Leech | 1 | 1 | 1 | 6 | 0 | 4 | 27 | 7 | weap | orb | {"mod1code":"lifesteal","mod1min":4,"mod1max":5} |
| of the Locust | 1 | 1 | 1 | 20 | 0 | 15 | 27 | 7 | mele | orb | {"mod1code":"lifesteal","mod1min":6,"mod1max":7} |
| of the Lamprey | 100 | 1 | 1 | 55 | 0 | 43 | 27 | 7 | mele | orb | {"mod1code":"lifesteal","mod1min":8,"mod1max":9} |
| of the Leech | 1 | 1 | 1 | 14 | 0 | 10 | 27 | 4 | ring, circ | 无 | {"mod1code":"lifesteal","mod1min":3,"mod1max":4} |
| of the Locust | 1 | 1 | 1 | 47 | 0 | 35 | 27 | 4 | ring, circ | 无 | {"mod1code":"lifesteal","mod1min":5,"mod1max":6} |
| of the Lamprey | 100 | 1 | 1 | 77 | 0 | 65 | 27 | 4 | ring, circ | 无 | {"mod1code":"lifesteal","mod1min":7,"mod1max":8} |
| of the Leech | 1 | 1 | 1 | 34 | 0 | 26 | 27 | 4 | glov | 无 | {"mod1code":"lifesteal","mod1min":3,"mod1max":3} |
| of the Bat | 1 | 1 | 1 | 7 | 0 | 4 | 28 | 7 | weap | orb | {"mod1code":"manasteal","mod1min":4,"mod1max":5} |
| of the Wraith | 1 | 1 | 1 | 21 | 0 | 16 | 28 | 7 | mele | 无 | {"mod1code":"manasteal","mod1min":6,"mod1max":7} |
| of the Vampire | 100 | 1 | 1 | 56 | 0 | 48 | 28 | 7 | mele | 无 | {"mod1code":"manasteal","mod1min":8,"mod1max":9} |
| of the Bat | 1 | 1 | 1 | 15 | 0 | 11 | 28 | 4 | amul, circ | 无 | {"mod1code":"manasteal","mod1min":3,"mod1max":4} |
| of the Wraith | 1 | 1 | 1 | 58 | 0 | 40 | 28 | 4 | amul, circ | 无 | {"mod1code":"manasteal","mod1min":5,"mod1max":6} |
| of the Vampire | 100 | 1 | 1 | 78 | 0 | 66 | 28 | 4 | amul, circ | 无 | {"mod1code":"manasteal","mod1min":7,"mod1max":8} |
| of the Bat | 1 | 1 | 1 | 35 | 0 | 27 | 28 | 4 | glov | 无 | {"mod1code":"manasteal","mod1min":3,"mod1max":3} |
| of Defiance | 1 | 1 | 1 | 25 | 0 | 18 | 29 | 2 | tors, shld, amul, circ | 无 | {"mod1code":"res-pois-len","mod1min":75,"mod1max":75} |
| of Amelioration | 1 | 1 | 1 | 18 | 0 | 13 | 29 | 3 | tors, shld, amul, circ | 无 | {"mod1code":"res-pois-len","mod1min":50,"mod1max":50} |
| of Remedy | 100 | 1 | 1 | 7 | 0 | 5 | 29 | 3 | armo, ring, amul, circ | 无 | {"mod1code":"res-pois-len","mod1min":25,"mod1max":25} |
| of Simplicity | 1 | 1 | 1 | 25 | 0 | 18 | 30 | 2 | tors, weap, shld | rod, orb | {"mod1code":"ease","mod1min":-30,"mod1max":-30} |
| of Ease | 1 | 1 | 1 | 15 | 0 | 11 | 30 | 3 | tors, weap, shld | rod, orb | {"mod1code":"ease","mod1min":-20,"mod1max":-20} |
| of Freedom | 100 | 1 | 1 | 1 | 0 | 1 | 30 | 3 | jewl | 无 | {"mod1code":"ease","mod1min":-15,"mod1max":-15} |
| of Strength | 1 | 1 | 1 | 1 | 0 | 1 | 31 | 4 | amul, belt, club, hamm, circ | 无 | {"mod1code":"str","mod1min":1,"mod1max":2} |
| of Might | 1 | 1 | 1 | 10 | 0 | 8 | 31 | 3 | amul, belt, club, hamm, circ | 无 | {"mod1code":"str","mod1min":3,"mod1max":5} |
| of the Ox | 1 | 1 | 1 | 26 | 0 | 19 | 31 | 3 | amul, belt, club, hamm, circ | 无 | {"mod1code":"str","mod1min":6,"mod1max":9} |
| of the Giant | 1 | 1 | 1 | 42 | 0 | 34 | 31 | 3 | amul, belt, club, hamm, circ | 无 | {"mod1code":"str","mod1min":10,"mod1max":15} |
| of the Titan | 1 | 1 | 1 | 58 | 0 | 50 | 31 | 3 | amul, belt, club, hamm, circ | 无 | {"mod1code":"str","mod1min":16,"mod1max":20} |
| of Atlus | 100 | 1 | 1 | 71 | 0 | 63 | 31 | 3 | amul, belt, club, hamm, circ | 无 | {"mod1code":"str","mod1min":21,"mod1max":30} |
| of Strength | 1 | 1 | 1 | 5 | 0 | 3 | 31 | 4 | ring, scep, mace, tors | 无 | {"mod1code":"str","mod1min":1,"mod1max":2} |
| of Might | 1 | 1 | 1 | 21 | 0 | 15 | 31 | 3 | ring, scep, mace, tors | 无 | {"mod1code":"str","mod1min":3,"mod1max":5} |
| of the Ox | 1 | 1 | 1 | 38 | 0 | 30 | 31 | 3 | ring, scep, mace, tors | 无 | {"mod1code":"str","mod1min":6,"mod1max":9} |
| of the Giant | 1 | 1 | 1 | 55 | 0 | 47 | 31 | 3 | ring, scep, mace, tors | 无 | {"mod1code":"str","mod1min":10,"mod1max":15} |
| of the Titan | 100 | 1 | 1 | 74 | 0 | 66 | 31 | 3 | ring, scep, mace, tors | 无 | {"mod1code":"str","mod1min":16,"mod1max":20} |
| of Strength | 1 | 1 | 1 | 12 | 0 | 8 | 31 | 3 | mele, glov, shld | blun | {"mod1code":"str","mod1min":1,"mod1max":2} |
| of Might | 1 | 1 | 1 | 33 | 0 | 25 | 31 | 3 | mele, glov, shld | blun | {"mod1code":"str","mod1min":3,"mod1max":5} |
| of the Ox | 1 | 1 | 1 | 45 | 0 | 37 | 31 | 3 | mele, glov, shld | blun | {"mod1code":"str","mod1min":6,"mod1max":9} |
| of the Giant | 100 | 1 | 1 | 59 | 0 | 51 | 31 | 3 | mele, glov | blun | {"mod1code":"str","mod1min":10,"mod1max":15} |
| of Strength | 100 | 1 | 1 | 1 | 0 | 1 | 31 | 4 | lcha | 无 | {"mod1code":"str","mod1min":3,"mod1max":4} |
| of Strength | 100 | 1 | 1 | 3 | 0 | 2 | 31 | 4 | mcha | 无 | {"mod1code":"str","mod1min":2,"mod1max":3} |
| of Strength | 100 | 1 | 1 | 7 | 0 | 5 | 31 | 4 | scha | 无 | {"mod1code":"str","mod1min":1,"mod1max":1} |
| of Strength | 100 | 1 | 1 | 14 | 0 | 10 | 31 | 4 | lcha | 无 | {"mod1code":"str","mod1min":5,"mod1max":6} |
| of Strength | 100 | 1 | 1 | 18 | 0 | 13 | 31 | 4 | mcha | 无 | {"mod1code":"str","mod1min":4,"mod1max":5} |
| of Strength | 100 | 1 | 1 | 22 | 0 | 16 | 31 | 4 | scha | 无 | {"mod1code":"str","mod1min":2,"mod1max":2} |
| of Virility | 100 | 1 | 1 | 18 | 0 | 13 | 31 | 4 | jewl | 无 | {"mod1code":"str","mod1min":1,"mod1max":4} |
| of Pacing | 1 | 1 | 1 | 12 | 0 | 8 | 35 | 3 | boot, circ | 无 | {"mod1code":"move1","mod1min":10,"mod1max":10} |
| of Haste | 1 | 1 | 1 | 22 | 0 | 16 | 35 | 4 | boot, circ | 无 | {"mod1code":"move2","mod1min":20,"mod1max":20} |
| of Speed | 1 | 1 | 1 | 37 | 0 | 29 | 35 | 4 | boot, circ | 无 | {"mod1code":"move3","mod1min":30,"mod1max":30} |
| of Traveling | 100 | 1 | 0 | 65 | 0 | 57 | 35 | 4 | boot | 无 | {"mod1code":"move3","mod1min":30,"mod1max":30,"mod2code":"stamdrain","mod2min":80,"mod2max":90} |
| of Acceleration | 100 | 1 | 0 | 51 | 0 | 43 | 35 | 4 | boot | 无 | {"mod1code":"move3","mod1min":40,"mod1max":40} |
| of Inertia | 100 | 1 | 1 | 19 | 0 | 14 | 35 | 4 | lcha | 无 | {"mod1code":"move3","mod1min":7,"mod1max":7} |
| of Inertia | 100 | 1 | 1 | 24 | 0 | 18 | 35 | 4 | mcha | 无 | {"mod1code":"move2","mod1min":5,"mod1max":5} |
| of Inertia | 100 | 1 | 0 | 35 | 0 | 27 | 35 | 4 | scha | 无 | {"mod1code":"move1","mod1min":3,"mod1max":3} |
| of Self-Repair | 100 | 1 | 1 | 3 | 0 | 1 | 37 | 3 | weap, armo | thro, miss | {"mod1code":"rep-dur","mod1param":3} |
| of Fast Repair | 100 | 1 | 1 | 20 | 0 | 12 | 37 | 2 | weap, armo | thro, miss | {"mod1code":"rep-dur","mod1param":5} |
| of Ages | 100 | 1 | 0 | 50 | 0 | 42 | 39 | 1 | weap, armo | thro, miss | {"mod1code":"indestruct"} |
| of Replenishing | 100 | 1 | 1 | 5 | 0 | 3 | 39 | 6 | thro | 无 | {"mod1code":"rep-quant","mod1param":5} |
| of Propogation | 100 | 1 | 1 | 24 | 0 | 18 | 39 | 5 | thro | 无 | {"mod1code":"rep-quant","mod1param":10} |
| of the Kraken | 100 | 1 | 0 | 20 | 0 | 1 | 41 | 1 | tors, amul, pelt, phlm | 无 | {"mod1code":"hp/lvl","mod1param":6} |
| of Memory | 100 | 1 | 0 | 20 | 0 | 1 | 41 | 1 | circ, amul, pelt | 无 | {"mod1code":"mana/lvl","mod1param":6} |
| of the Elephant | 100 | 1 | 0 | 37 | 0 | 7 | 41 | 2 | circ, pelt | 无 | {"mod1code":"hp/lvl","mod1param":4,"mod2code":"mana/lvl","mod2param":2} |
| of Power | 100 | 0 | 0 | 1 | 0 | 1 | 42 | 1 | belt, amul | 无 | {"mod1code":"str/lvl","mod1param":3} |
| of Grace | 100 | 0 | 0 | 1 | 0 | 1 | 42 | 1 | helm, amul | 无 | {"mod1code":"dex/lvl","mod1param":3} |
| of Grace and Power | 100 | 0 | 0 | 1 | 0 | 1 | 42 | 1 | amul | 无 | {"mod1code":"str/lvl","mod1param":1,"mod2code":"dex/lvl","mod2param":1} |
| of the Yeti | 100 | 0 | 0 | 1 | 0 | 1 | 43 | 1 | tors, glov, amul | 无 | {"mod1code":"res-cold/lvl","mod1param":3} |
| of the Phoenix | 100 | 0 | 0 | 1 | 0 | 1 | 43 | 1 | shld, helm, amul | 无 | {"mod1code":"res-fire/lvl","mod1param":3} |
| of the Efreeti | 100 | 0 | 0 | 1 | 0 | 1 | 43 | 1 | glov, boot, ring | 无 | {"mod1code":"res-ltng/lvl","mod1param":3} |
| of the Cobra | 100 | 0 | 0 | 1 | 0 | 1 | 43 | 1 | belt, ring, amul | 无 | {"mod1code":"res-pois/lvl","mod1param":3} |
| of the Elements | 100 | 0 | 0 | 1 | 0 | 1 | 43 | 10 | circ | 无 | {"mod1code":"res-cold/lvl","mod1param":1,"mod2code":"res-fire/lvl","mod2param":1,"mod3code":"res-ltng/lvl","mod3param":1} |
| of Firebolts | 100 | 1 | 1 | 16 | 0 | 12 | 44 | 1 | weap | miss | {"mod1code":"hit-skill","mod1param":36,"mod1min":10,"mod1max":8} |
| of Firebolts | 100 | 1 | 1 | 6 | 0 | 4 | 44 | 1 | weap | miss | {"mod1code":"att-skill","mod1param":36,"mod1min":5,"mod1max":3} |
| of Firebolts | 100 | 1 | 1 | 20 | 0 | 15 | 44 | 1 | weap | miss | {"mod1code":"att-skill","mod1param":36,"mod1min":10,"mod1max":4} |
| of Charged Shield | 100 | 1 | 1 | 6 | 0 | 4 | 44 | 1 | armo, ring, amul | 无 | {"mod1code":"gethit-skill","mod1param":38,"mod1min":10,"mod1max":3} |
| of Charged Shield | 100 | 1 | 1 | 16 | 0 | 12 | 44 | 1 | armo, ring, amul | 无 | {"mod1code":"gethit-skill","mod1param":38,"mod1min":12,"mod1max":4} |
| of Charged Shield | 100 | 1 | 1 | 26 | 0 | 19 | 44 | 1 | armo, ring, amul | 无 | {"mod1code":"gethit-skill","mod1param":38,"mod1min":14,"mod1max":5} |
| of Icebolt | 100 | 1 | 1 | 6 | 0 | 4 | 44 | 1 | weap | miss | {"mod1code":"att-skill","mod1param":39,"mod1min":5,"mod1max":3} |
| of Frozen Armor | 100 | 0 | 0 | 0 | 0 | 0 | 44 | 0 |  | 无 | {} |
| of Static Field | 100 | 0 | 0 | 0 | 0 | 0 | 44 | 0 |  | 无 | {} |
| of Telekinesis | 100 | 1 | 1 | 0 | 0 | 0 | 44 | 0 |  | 无 | {} |
| of Frost Shield | 100 | 1 | 1 | 12 | 0 | 9 | 44 | 1 | armo, amul | 无 | {"mod1code":"gethit-skill","mod1param":44,"mod1min":5,"mod1max":3} |
| of Ice Blast | 100 | 0 | 0 | 0 | 0 | 0 | 44 | 0 |  | 无 | {} |
| of Blaze | 100 | 0 | 0 | 0 | 0 | 0 | 44 | 0 |  | 无 | {} |
| of Fire Ball | 100 | 0 | 0 | 0 | 0 | 0 | 44 | 0 |  | 无 | {} |
| of Nova | 100 | 1 | 1 | 18 | 0 | 13 | 44 | 1 | weap | miss | {"mod1code":"hit-skill","mod1param":48,"mod1min":10,"mod1max":3} |
| of Nova | 100 | 1 | 1 | 28 | 0 | 21 | 44 | 1 | weap | miss | {"mod1code":"hit-skill","mod1param":48,"mod1min":12,"mod1max":4} |
| of Nova Shield | 100 | 1 | 1 | 18 | 0 | 13 | 44 | 1 | armo, ring | 无 | {"mod1code":"gethit-skill","mod1param":48,"mod1min":10,"mod1max":3} |
| of Nova Shield | 100 | 1 | 1 | 28 | 0 | 21 | 44 | 1 | armo, ring | 无 | {"mod1code":"gethit-skill","mod1param":48,"mod1min":12,"mod1max":4} |
| of Nova Shield | 100 | 1 | 1 | 38 | 0 | 28 | 44 | 1 | armo, ring | 无 | {"mod1code":"gethit-skill","mod1param":48,"mod1min":14,"mod1max":5} |
| of Lightning | 100 | 1 | 1 | 18 | 0 | 13 | 44 | 1 | weap | miss | {"mod1code":"att-skill","mod1param":49,"mod1min":5,"mod1max":3} |
| of Lightning | 100 | 0 | 0 | 12 | 0 | 18 | 44 | 1 | weap | 无 | {"mod1code":"charged","mod1param":49,"mod1min":50,"mod1max":1} |
| of Shiver Armor | 100 | 0 | 0 | 0 | 0 | 0 | 44 | 0 |  | 无 | {} |
| of Fire Wall | 100 | 0 | 0 | 0 | 0 | 0 | 44 | 0 |  | 无 | {} |
| of Enchant | 100 | 0 | 0 | 0 | 0 | 0 | 44 | 0 |  | 无 | {} |
| of Chain Lightning | 100 | 1 | 1 | 25 | 0 | 18 | 44 | 1 | weap, ring, amul | miss | {"mod1code":"att-skill","mod1param":53,"mod1min":5,"mod1max":3} |
| of Chain Lightning | 100 | 1 | 1 | 35 | 0 | 26 | 44 | 1 | weap, ring, amul | miss | {"mod1code":"att-skill","mod1param":53,"mod1min":8,"mod1max":3} |
| of Chain Lightning | 100 | 1 | 1 | 45 | 0 | 33 | 44 | 1 | weap, ring, amul | miss | {"mod1code":"att-skill","mod1param":53,"mod1min":8,"mod1max":5} |
| of Teleport Shield | 100 | 0 | 0 | 25 | 0 | 18 | 44 | 1 | armo, ring, amul | 无 | {"mod1code":"gethit-skill","mod1param":54,"mod1min":10,"mod1max":3} |
| of Teleport Shield | 100 | 0 | 0 | 35 | 0 | 26 | 44 | 1 | armo, ring, amul | 无 | {"mod1code":"gethit-skill","mod1param":54,"mod1min":14,"mod1max":3} |
| of Teleport Shield | 100 | 0 | 0 | 45 | 0 | 33 | 44 | 1 | armo, ring, amul | 无 | {"mod1code":"gethit-skill","mod1param":54,"mod1min":18,"mod1max":3} |
| of Glacial Spike | 100 | 0 | 0 | 0 | 0 | 0 | 44 | 0 |  | 无 | {} |
| of Meteor | 100 | 0 | 0 | 0 | 0 | 0 | 44 | 0 |  | 无 | {} |
| of Thunder Storm | 100 | 0 | 0 | 0 | 0 | 0 | 44 | 0 |  | 无 | {} |
| of Energy Shield | 100 | 0 | 0 | 0 | 0 | 0 | 44 | 0 |  | 无 | {} |
| of Blizzard | 100 | 0 | 0 | 0 | 0 | 0 | 44 | 0 |  | 无 | {} |
| of Chilling Armor | 100 | 0 | 0 | 0 | 0 | 0 | 44 | 0 |  | 无 | {} |
| of Hydra Shield | 100 | 1 | 1 | 40 | 0 | 30 | 44 | 1 | amul | 无 | {"mod1code":"gethit-skill","mod1param":62,"mod1min":10,"mod1max":3} |
| of Frozen Orb | 100 | 0 | 0 | 0 | 0 | 0 | 44 | 0 |  | 无 | {} |
| of Dawn | 100 | 0 | 0 | 30 | 0 | 22 | 45 | 0 |  | 无 | {"mod1code":"ac/time","mod1param":3,"mod1min":10,"mod1max":40} |
| of Sunlight | 100 | 0 | 0 | 30 | 0 | 22 | 45 | 0 |  | 无 | {"mod1code":"ac/time","mod1min":-10,"mod1max":60} |
| of Magic Arrows | 100 | 1 | 1 | 12 | 0 | 11 | 44 | 1 | miss, abow | 无 | {"mod1code":"charged","mod1param":6,"mod1min":-30,"mod1max":-10} |
| of Magic Arrows | 100 | 0 | 0 | 35 | 0 | 28 | 44 | 1 | glov | 无 | {"mod1code":"charged","mod1param":6,"mod1min":-20,"mod1max":-6} |
| of Fire Arrows | 100 | 0 | 0 | 13 | 0 | 12 | 44 | 1 | miss, abow | 无 | {"mod1code":"charged","mod1param":7,"mod1min":-30,"mod1max":-10} |
| of Fire Arrows | 100 | 1 | 1 | 40 | 0 | 32 | 44 | 1 | glov | 无 | {"mod1code":"charged","mod1param":7,"mod1min":-20,"mod1max":-6} |
| of Inner Sight | 100 | 1 | 1 | 18 | 0 | 14 | 44 | 1 | amul, amaz, circ | 无 | {"mod1code":"charged","mod1param":8,"mod1min":-30,"mod1max":-6} |
| of Inner Sight | 100 | 1 | 1 | 50 | 0 | 42 | 44 | 1 | glov | 无 | {"mod1code":"charged","mod1param":8,"mod1min":-20,"mod1max":-4} |
| of Jabbing | 100 | 0 | 0 | 24 | 0 | 18 | 44 | 1 | spea, aspe | 无 | {"mod1code":"charged","mod1param":10,"mod1min":-60,"mod1max":-7} |
| of Jabbing | 100 | 0 | 0 | 50 | 0 | 42 | 44 | 1 | glov | 无 | {"mod1code":"charged","mod1param":10,"mod1min":-20,"mod1max":-4} |
| of Cold Arrows | 100 | 1 | 1 | 15 | 0 | 16 | 44 | 1 | miss, abow | 无 | {"mod1code":"charged","mod1param":11,"mod1min":-30,"mod1max":-8} |
| of Cold Arrows | 100 | 1 | 1 | 47 | 0 | 39 | 44 | 1 | glov | 无 | {"mod1code":"charged","mod1param":11,"mod1min":-20,"mod1max":-5} |
| of Multiple Shot | 100 | 1 | 1 | 18 | 0 | 19 | 44 | 1 | miss, abow | 无 | {"mod1code":"charged","mod1param":12,"mod1min":-30,"mod1max":-8} |
| of Multiple Shot | 100 | 1 | 1 | 63 | 0 | 55 | 44 | 1 | glov | 无 | {"mod1code":"charged","mod1param":12,"mod1min":-20,"mod1max":-4} |
| of Power Strike | 100 | 1 | 1 | 12 | 0 | 13 | 44 | 1 | spea, aspe | 无 | {"mod1code":"charged","mod1param":14,"mod1min":-60,"mod1max":-6} |
| of Power Strike | 100 | 1 | 1 | 55 | 0 | 47 | 44 | 1 | glov | 无 | {"mod1code":"charged","mod1param":14,"mod1min":-20,"mod1max":-4} |
| of Poison Jab | 100 | 0 | 0 | 17 | 0 | 18 | 44 | 1 | amul, circ | 无 | {"mod1code":"charged","mod1param":15,"mod1min":-60,"mod1max":-6} |
| of Poison Jab | 100 | 0 | 0 | 67 | 0 | 59 | 44 | 1 | glov | 无 | {"mod1code":"charged","mod1param":15,"mod1min":-20,"mod1max":-3} |
| of Exploding Arrows | 100 | 1 | 1 | 30 | 0 | 26 | 44 | 1 | miss, abow | 无 | {"mod1code":"charged","mod1param":16,"mod1min":-30,"mod1max":-6} |
| of Exploding Arrows | 100 | 1 | 1 | 69 | 0 | 61 | 44 | 1 | glov | 无 | {"mod1code":"charged","mod1param":16,"mod1min":-20,"mod1max":-4} |
| of Slow Missiles | 100 | 0 | 0 | 33 | 0 | 27 | 44 | 1 | amaz | 无 | {"mod1code":"charged","mod1param":17,"mod1min":-30,"mod1max":-5} |
| of Slow Missiles | 100 | 0 | 0 | 68 | 0 | 60 | 44 | 1 | glov, amul | 无 | {"mod1code":"charged","mod1param":17,"mod1min":-20,"mod1max":-3} |
| of Impaling Strike | 100 | 0 | 0 | 24 | 0 | 18 | 44 | 1 | spea, aspe | 无 | {"mod1code":"charged","mod1param":19,"mod1min":-60,"mod1max":-6} |
| of Impaling Strike | 100 | 0 | 0 | 59 | 0 | 51 | 44 | 1 | glov | 无 | {"mod1code":"charged","mod1param":19,"mod1min":-20,"mod1max":-4} |
| of Lightning Javelin | 100 | 0 | 0 | 25 | 0 | 18 | 44 | 1 | amul, circ | 无 | {"mod1code":"charged","mod1param":20,"mod1min":-60,"mod1max":-6} |
| of Lightning Javelin | 100 | 0 | 0 | 70 | 0 | 62 | 44 | 1 | glov | 无 | {"mod1code":"charged","mod1param":20,"mod1min":-20,"mod1max":-3} |
| of Ice Arrows | 100 | 1 | 1 | 36 | 0 | 28 | 44 | 1 | miss, abow | 无 | {"mod1code":"charged","mod1param":21,"mod1min":-30,"mod1max":-5} |
| of Ice Arrows | 100 | 1 | 1 | 72 | 0 | 64 | 44 | 1 | glov | 无 | {"mod1code":"charged","mod1param":21,"mod1min":-20,"mod1max":-3} |
| of Guided Arrows | 100 | 0 | 0 | 34 | 0 | 26 | 44 | 1 | miss, abow | 无 | {"mod1code":"charged","mod1param":22,"mod1min":-30,"mod1max":-5} |
| of Guided Arrows | 100 | 0 | 0 | 69 | 0 | 61 | 44 | 1 | glov | 无 | {"mod1code":"charged","mod1param":22,"mod1min":-20,"mod1max":-3} |
| of Charged Strike | 100 | 1 | 1 | 33 | 0 | 25 | 44 | 1 | spea, aspe | 无 | {"mod1code":"charged","mod1param":24,"mod1min":-60,"mod1max":-5} |
| of Charged Strike | 100 | 1 | 1 | 68 | 0 | 60 | 44 | 1 | glov | 无 | {"mod1code":"charged","mod1param":24,"mod1min":-20,"mod1max":-3} |
| of Plague Jab | 100 | 0 | 0 | 35 | 0 | 27 | 44 | 1 | amul, circ | 无 | {"mod1code":"charged","mod1param":25,"mod1min":-60,"mod1max":-5} |
| of Plague Jab | 100 | 0 | 0 | 71 | 0 | 63 | 44 | 1 | glov | 无 | {"mod1code":"charged","mod1param":25,"mod1min":-20,"mod1max":-3} |
| of Immolating Arrows | 100 | 0 | 0 | 42 | 0 | 36 | 44 | 1 | miss, abow | 无 | {"mod1code":"charged","mod1param":27,"mod1min":-30,"mod1max":-4} |
| of Immolating Arrows | 100 | 0 | 0 | 85 | 0 | 77 | 44 | 1 | glov | 无 | {"mod1code":"charged","mod1param":27,"mod1min":-20,"mod1max":-2} |
| of Fending | 100 | 0 | 0 | 41 | 0 | 35 | 44 | 1 | spea, aspe | 无 | {"mod1code":"charged","mod1param":30,"mod1min":-60,"mod1max":-5} |
| of Fending | 100 | 0 | 0 | 83 | 0 | 75 | 44 | 1 | glov | 无 | {"mod1code":"charged","mod1param":30,"mod1min":-20,"mod1max":-3} |
| of Freezing Arrows | 100 | 1 | 1 | 50 | 0 | 42 | 44 | 1 | miss, abow | 无 | {"mod1code":"charged","mod1param":31,"mod1min":-30,"mod1max":-4} |
| of Freezing Arrows | 100 | 1 | 1 | 94 | 0 | 86 | 44 | 1 | glov | 无 | {"mod1code":"charged","mod1param":31,"mod1min":-20,"mod1max":-2} |
| of Lightning Strike | 100 | 1 | 1 | 47 | 0 | 39 | 44 | 1 | spea, aspe | 无 | {"mod1code":"charged","mod1param":34,"mod1min":-60,"mod1max":-4} |
| of Lightning Strike | 100 | 1 | 1 | 90 | 0 | 82 | 44 | 1 | glov | 无 | {"mod1code":"charged","mod1param":34,"mod1min":-20,"mod1max":-2} |
| of Lightning Fury | 100 | 0 | 0 | 49 | 0 | 41 | 44 | 1 | amul, circ | 无 | {"mod1code":"charged","mod1param":35,"mod1min":-60,"mod1max":-4} |
| of Lightning Fury | 100 | 0 | 0 | 92 | 0 | 84 | 44 | 1 | glov | 无 | {"mod1code":"charged","mod1param":35,"mod1min":-20,"mod1max":-2} |
| of Fire Bolts | 100 | 1 | 1 | 7 | 0 | 7 | 44 | 1 | staf, orb | 无 | {"mod1code":"charged","mod1param":36,"mod1min":-30,"mod1max":-10} |
| of Fire Bolts | 100 | 1 | 1 | 14 | 0 | 14 | 44 | 1 | swor, ring, circ | 无 | {"mod1code":"charged","mod1param":36,"mod1min":-20,"mod1max":-6} |
| of Charged Bolts | 100 | 1 | 1 | 7 | 0 | 7 | 44 | 1 | staf, orb | 无 | {"mod1code":"charged","mod1param":38,"mod1min":-30,"mod1max":-10} |
| of Charged Bolts | 100 | 1 | 1 | 14 | 0 | 14 | 44 | 1 | hamm, mace, scep, ring, circ | 无 | {"mod1code":"charged","mod1param":38,"mod1min":-20,"mod1max":-6} |
| of Ice Bolts | 100 | 1 | 1 | 7 | 0 | 7 | 44 | 1 | staf, orb | 无 | {"mod1code":"charged","mod1param":39,"mod1min":-30,"mod1max":-10} |
| of Ice Bolts | 100 | 1 | 1 | 14 | 0 | 14 | 44 | 1 | knif | 无 | {"mod1code":"charged","mod1param":39,"mod1min":-20,"mod1max":-6} |
| of Frozen Armor | 100 | 0 | 0 | 7 | 0 | 7 | 44 | 1 | staf, orb | 无 | {"mod1code":"charged","mod1param":40,"mod1min":-30,"mod1max":-10} |
| of Frozen Armor | 100 | 0 | 0 | 14 | 0 | 14 | 44 | 1 | knif, tors | 无 | {"mod1code":"charged","mod1param":40,"mod1min":-20,"mod1max":-6} |
| of Static Field | 100 | 0 | 0 | 12 | 0 | 12 | 44 | 1 | staf, orb | 无 | {"mod1code":"charged","mod1param":42,"mod1min":-30,"mod1max":-8} |
| of Static Field | 100 | 0 | 0 | 24 | 0 | 24 | 44 | 1 | hamm, mace, scep, ring, circ | 无 | {"mod1code":"charged","mod1param":42,"mod1min":-20,"mod1max":-5} |
| of Telekinesis | 100 | 1 | 1 | 12 | 0 | 12 | 44 | 1 | staf, orb | 无 | {"mod1code":"charged","mod1param":43,"mod1min":-30,"mod1max":-8} |
| of Telekinesis | 100 | 1 | 1 | 24 | 0 | 24 | 44 | 1 | hamm, mace, scep, ring, circ | 无 | {"mod1code":"charged","mod1param":43,"mod1min":-20,"mod1max":-5} |
| of Frost Novas | 100 | 1 | 1 | 12 | 0 | 12 | 44 | 1 | staf, orb | 无 | {"mod1code":"charged","mod1param":44,"mod1min":-30,"mod1max":-8} |
| of Frost Novas | 100 | 1 | 1 | 24 | 0 | 24 | 44 | 1 | knif, amul, circ | 无 | {"mod1code":"charged","mod1param":44,"mod1min":-20,"mod1max":-5} |
| of Ice Blasts | 100 | 1 | 1 | 12 | 0 | 12 | 44 | 1 | staf, orb | 无 | {"mod1code":"charged","mod1param":45,"mod1min":-30,"mod1max":-8} |
| of Ice Blasts | 100 | 1 | 1 | 24 | 0 | 24 | 44 | 1 | hamm, mace, scep, ring, circ | 无 | {"mod1code":"charged","mod1param":45,"mod1min":-20,"mod1max":-5} |
| of Blazing | 100 | 0 | 0 | 18 | 0 | 18 | 44 | 1 | staf, orb | 无 | {"mod1code":"charged","mod1param":46,"mod1min":-30,"mod1max":-7} |
| of Blazing | 100 | 0 | 0 | 36 | 0 | 36 | 44 | 1 | boot | 无 | {"mod1code":"charged","mod1param":46,"mod1min":-20,"mod1max":-4} |
| of Fire Balls | 100 | 1 | 1 | 18 | 0 | 18 | 44 | 1 | staf, orb | 无 | {"mod1code":"charged","mod1param":47,"mod1min":-30,"mod1max":-7} |
| of Fire Balls | 100 | 1 | 1 | 36 | 0 | 36 | 44 | 1 | spea, wand | 无 | {"mod1code":"charged","mod1param":47,"mod1min":-20,"mod1max":-4} |
| of Novas | 100 | 1 | 1 | 18 | 0 | 18 | 44 | 1 | staf, orb | 无 | {"mod1code":"charged","mod1param":48,"mod1min":-30,"mod1max":-7} |
| of Novas | 100 | 1 | 1 | 36 | 0 | 36 | 44 | 1 | shld | 无 | {"mod1code":"charged","mod1param":48,"mod1min":-20,"mod1max":-4} |
| of Lightning | 100 | 1 | 1 | 18 | 0 | 18 | 44 | 1 | staf, orb | 无 | {"mod1code":"charged","mod1param":49,"mod1min":-30,"mod1max":-7} |
| of Lightning | 100 | 1 | 1 | 36 | 0 | 36 | 44 | 1 | axe, hamm | 无 | {"mod1code":"charged","mod1param":49,"mod1min":-20,"mod1max":-4} |
| of Shiver Armor | 100 | 0 | 0 | 18 | 0 | 18 | 44 | 1 | staf, orb | 无 | {"mod1code":"charged","mod1param":50,"mod1min":-30,"mod1max":-7} |
| of Shiver Armor | 100 | 0 | 0 | 36 | 0 | 36 | 44 | 1 | knif, tors | 无 | {"mod1code":"charged","mod1param":50,"mod1min":-20,"mod1max":-4} |
| of Fire Walls | 100 | 0 | 0 | 24 | 0 | 24 | 44 | 1 | staf, orb | 无 | {"mod1code":"charged","mod1param":51,"mod1min":-30,"mod1max":-6} |
| of Fire Walls | 100 | 0 | 0 | 48 | 0 | 48 | 44 | 1 | pole | 无 | {"mod1code":"charged","mod1param":51,"mod1min":-20,"mod1max":-3} |
| of Enchantment | 100 | 1 | 1 | 24 | 0 | 24 | 44 | 1 | staf, orb | 无 | {"mod1code":"charged","mod1param":52,"mod1min":-20,"mod1max":-3} |
| of Enchantment | 100 | 1 | 1 | 48 | 0 | 48 | 44 | 1 | mele | 无 | {"mod1code":"charged","mod1param":52,"mod1min":-10,"mod1max":-1} |
| of Chain Lightning | 100 | 1 | 1 | 24 | 0 | 24 | 44 | 1 | staf, orb | 无 | {"mod1code":"charged","mod1param":53,"mod1min":-30,"mod1max":-6} |
| of Chain Lightning | 100 | 1 | 1 | 48 | 0 | 48 | 44 | 1 | spea | 无 | {"mod1code":"charged","mod1param":53,"mod1min":-20,"mod1max":-3} |
| of Teleportation | 100 | 1 | 1 | 24 | 0 | 24 | 44 | 1 | staf, orb | 无 | {"mod1code":"charged","mod1param":54,"mod1min":-30,"mod1max":-6} |
| of Teleportation | 100 | 1 | 1 | 48 | 0 | 48 | 44 | 1 | amul, circ | 无 | {"mod1code":"charged","mod1param":54,"mod1min":-20,"mod1max":-3} |
| of Glacial Spikes | 100 | 1 | 1 | 24 | 0 | 24 | 44 | 1 | staf, orb | 无 | {"mod1code":"charged","mod1param":55,"mod1min":-30,"mod1max":-6} |
| of Glacial Spikes | 100 | 1 | 1 | 48 | 0 | 48 | 44 | 1 | knif | 无 | {"mod1code":"charged","mod1param":55,"mod1min":-20,"mod1max":-3} |
| of Meteors | 100 | 1 | 1 | 30 | 0 | 30 | 44 | 1 | staf, orb | 无 | {"mod1code":"charged","mod1param":56,"mod1min":-30,"mod1max":-5} |
| of Meteors | 100 | 1 | 1 | 60 | 0 | 60 | 44 | 1 | knif, club | 无 | {"mod1code":"charged","mod1param":56,"mod1min":-20,"mod1max":-2} |
| of Thunder Storm | 100 | 0 | 0 | 30 | 0 | 30 | 44 | 1 | staf, orb | 无 | {"mod1code":"charged","mod1param":57,"mod1min":-30,"mod1max":-5} |
| of Thunder Storm | 100 | 0 | 0 | 60 | 0 | 60 | 44 | 1 | hamm, club | 无 | {"mod1code":"charged","mod1param":57,"mod1min":-20,"mod1max":-2} |
| of Energy Shield | 100 | 0 | 0 | 30 | 0 | 30 | 44 | 1 | staf, orb | 无 | {"mod1code":"charged","mod1param":58,"mod1min":-30,"mod1max":-5} |
| of Energy Shield | 100 | 0 | 0 | 60 | 0 | 60 | 44 | 1 | helm | 无 | {"mod1code":"charged","mod1param":58,"mod1min":-20,"mod1max":-2} |
| of Blizzards | 100 | 1 | 1 | 30 | 0 | 30 | 44 | 1 | staf, orb | 无 | {"mod1code":"charged","mod1param":59,"mod1min":-30,"mod1max":-5} |
| of Blizzards | 100 | 1 | 1 | 60 | 0 | 60 | 44 | 1 | knif | 无 | {"mod1code":"charged","mod1param":59,"mod1min":-20,"mod1max":-2} |
| of Chilling Armor | 100 | 0 | 0 | 30 | 0 | 30 | 44 | 1 | staf, orb | 无 | {"mod1code":"charged","mod1param":60,"mod1min":-30,"mod1max":-5} |
| of Chilling Armor | 100 | 0 | 0 | 60 | 0 | 60 | 44 | 1 | tors | 无 | {"mod1code":"charged","mod1param":60,"mod1min":-20,"mod1max":-2} |
| of Hydras | 100 | 0 | 0 | 36 | 0 | 36 | 44 | 1 | staf, orb | 无 | {"mod1code":"charged","mod1param":62,"mod1min":-30,"mod1max":-3} |
| of Hydras | 100 | 0 | 0 | 72 | 0 | 72 | 44 | 1 | club | 无 | {"mod1code":"charged","mod1param":62,"mod1min":-20,"mod1max":-1} |
| of Frozen Orbs | 100 | 1 | 1 | 36 | 0 | 36 | 44 | 1 | staf, orb | 无 | {"mod1code":"charged","mod1param":64,"mod1min":-30,"mod1max":-3} |
| of Frozen Orbs | 100 | 1 | 1 | 72 | 0 | 72 | 44 | 1 | knif | 无 | {"mod1code":"charged","mod1param":64,"mod1min":-20,"mod1max":-1} |
| of Amplify Damage | 100 | 0 | 0 | 7 | 0 | 7 | 44 | 1 | wand, knif, head | 无 | {"mod1code":"charged","mod1param":66,"mod1min":-60,"mod1max":-10} |
| of Amplify Damage | 100 | 0 | 0 | 14 | 0 | 14 | 44 | 1 | blun | 无 | {"mod1code":"charged","mod1param":66,"mod1min":-20,"mod1max":-6} |
| of Teeth | 100 | 1 | 1 | 7 | 0 | 7 | 44 | 1 | wand, knif, head | 无 | {"mod1code":"charged","mod1param":67,"mod1min":-60,"mod1max":-10} |
| of Teeth | 100 | 1 | 1 | 14 | 0 | 14 | 44 | 1 | swor | 无 | {"mod1code":"charged","mod1param":67,"mod1min":-20,"mod1max":-6} |
| of Bone Armor | 100 | 0 | 0 | 7 | 0 | 7 | 44 | 1 | wand, knif, head | 无 | {"mod1code":"charged","mod1param":68,"mod1min":-60,"mod1max":-10} |
| of Bone Armor | 100 | 0 | 0 | 14 | 0 | 14 | 44 | 1 | tors | 无 | {"mod1code":"charged","mod1param":68,"mod1min":-20,"mod1max":-6} |
| of Raise Skeletons | 100 | 0 | 0 | 7 | 0 | 7 | 44 | 1 | wand, knif, head | 无 | {"mod1code":"charged","mod1param":70,"mod1min":-60,"mod1max":-10} |
| of Raise Skeletons | 100 | 0 | 0 | 14 | 0 | 14 | 44 | 1 | amul, circ | 无 | {"mod1code":"charged","mod1param":70,"mod1min":-20,"mod1max":-6} |
| of Dim Vision | 100 | 1 | 1 | 12 | 0 | 12 | 44 | 1 | wand, knif, head | 无 | {"mod1code":"charged","mod1param":71,"mod1min":-60,"mod1max":-8} |
| of Dim Vision | 100 | 1 | 1 | 24 | 0 | 24 | 44 | 1 | ring, circ | 无 | {"mod1code":"charged","mod1param":71,"mod1min":-20,"mod1max":-5} |
| of Weaken | 100 | 1 | 1 | 12 | 0 | 12 | 44 | 1 | wand, knif, head | 无 | {"mod1code":"charged","mod1param":72,"mod1min":-60,"mod1max":-8} |
| of Weaken | 100 | 1 | 1 | 24 | 0 | 24 | 44 | 1 | glov | 无 | {"mod1code":"charged","mod1param":72,"mod1min":-20,"mod1max":-5} |
| of Poison Dagger | 100 | 1 | 1 | 12 | 0 | 12 | 44 | 1 | knif, head | 无 | {"mod1code":"charged","mod1param":73,"mod1min":-60,"mod1max":-8} |
| of Poison Dagger | 100 | 1 | 1 | 24 | 0 | 24 | 44 | 1 | glov, ring, circ | 无 | {"mod1code":"charged","mod1param":73,"mod1min":-20,"mod1max":-5} |
| of Corpse Explosions | 100 | 0 | 0 | 12 | 0 | 12 | 44 | 1 | wand, knif, head | 无 | {"mod1code":"charged","mod1param":74,"mod1min":-60,"mod1max":-8} |
| of Corpse Explosions | 100 | 0 | 0 | 24 | 0 | 24 | 44 | 1 | club | 无 | {"mod1code":"charged","mod1param":74,"mod1min":-20,"mod1max":-5} |
| of Clay Golem Summoning | 100 | 0 | 0 | 12 | 0 | 12 | 44 | 1 | wand, knif, head | 无 | {"mod1code":"charged","mod1param":75,"mod1min":-60,"mod1max":-8} |
| of Clay Golem Summoning | 100 | 0 | 0 | 24 | 0 | 24 | 44 | 1 | amul, circ | 无 | {"mod1code":"charged","mod1param":75,"mod1min":-20,"mod1max":-5} |
| of Iron Maiden | 100 | 0 | 0 | 18 | 0 | 18 | 44 | 1 | wand, knif, head | 无 | {"mod1code":"charged","mod1param":76,"mod1min":-60,"mod1max":-7} |
| of Iron Maiden | 100 | 0 | 0 | 36 | 0 | 36 | 44 | 1 | shld | 无 | {"mod1code":"charged","mod1param":76,"mod1min":-20,"mod1max":-4} |
| of Terror | 100 | 1 | 1 | 18 | 0 | 18 | 44 | 1 | wand, knif, head | 无 | {"mod1code":"charged","mod1param":77,"mod1min":-60,"mod1max":-7} |
| of Terror | 100 | 1 | 1 | 36 | 0 | 36 | 44 | 1 | shld | 无 | {"mod1code":"charged","mod1param":77,"mod1min":-20,"mod1max":-4} |
| of Bone Walls | 100 | 0 | 0 | 18 | 0 | 18 | 44 | 1 | wand, knif, head | 无 | {"mod1code":"charged","mod1param":78,"mod1min":-60,"mod1max":-7} |
| of Bone Walls | 100 | 0 | 0 | 36 | 0 | 36 | 44 | 1 | club, mace, scep | 无 | {"mod1code":"charged","mod1param":78,"mod1min":-20,"mod1max":-4} |
| of Raise Skeletal Mages | 100 | 0 | 0 | 18 | 0 | 18 | 44 | 1 | wand, knif, head | 无 | {"mod1code":"charged","mod1param":80,"mod1min":-60,"mod1max":-7} |
| of Raise Skeletal Mages | 100 | 0 | 0 | 36 | 0 | 36 | 44 | 1 | amul, circ | 无 | {"mod1code":"charged","mod1param":80,"mod1min":-20,"mod1max":-4} |
| of Confusion | 100 | 1 | 1 | 24 | 0 | 24 | 44 | 1 | wand, knif, head | 无 | {"mod1code":"charged","mod1param":81,"mod1min":-60,"mod1max":-6} |
| of Confusion | 100 | 1 | 1 | 48 | 0 | 48 | 44 | 1 | ring, circ | 无 | {"mod1code":"charged","mod1param":81,"mod1min":-20,"mod1max":-3} |
| of Life Tap | 100 | 1 | 1 | 24 | 0 | 24 | 44 | 1 | wand, knif, head | 无 | {"mod1code":"charged","mod1param":82,"mod1min":-60,"mod1max":-6} |
| of Life Tap | 100 | 1 | 1 | 48 | 0 | 48 | 44 | 1 | axe | 无 | {"mod1code":"charged","mod1param":82,"mod1min":-20,"mod1max":-3} |
| of Poison Explosion | 100 | 0 | 0 | 24 | 0 | 24 | 44 | 1 | wand, knif, head | 无 | {"mod1code":"charged","mod1param":83,"mod1min":-60,"mod1max":-6} |
| of Poison Explosion | 100 | 0 | 0 | 48 | 0 | 48 | 44 | 1 | blun | 无 | {"mod1code":"charged","mod1param":83,"mod1min":-20,"mod1max":-3} |
| of Bone Spears | 100 | 1 | 1 | 24 | 0 | 24 | 44 | 1 | wand, knif, head | 无 | {"mod1code":"charged","mod1param":84,"mod1min":-60,"mod1max":-6} |
| of Bone Spears | 100 | 1 | 1 | 48 | 0 | 48 | 44 | 1 | spea | 无 | {"mod1code":"charged","mod1param":84,"mod1min":-20,"mod1max":-3} |
| of Blood Golem Summoning | 100 | 0 | 0 | 24 | 0 | 24 | 44 | 1 | wand, knif, head | 无 | {"mod1code":"charged","mod1param":85,"mod1min":-60,"mod1max":-6} |
| of Blood Golem Summoning | 100 | 0 | 0 | 48 | 0 | 48 | 44 | 1 | axe | 无 | {"mod1code":"charged","mod1param":85,"mod1min":-20,"mod1max":-3} |
| of Attraction | 100 | 1 | 1 | 30 | 0 | 30 | 44 | 1 | wand, knif, head | 无 | {"mod1code":"charged","mod1param":86,"mod1min":-60,"mod1max":-5} |
| of Attraction | 100 | 1 | 1 | 60 | 0 | 60 | 44 | 1 | ring, amul, circ | 无 | {"mod1code":"charged","mod1param":86,"mod1min":-20,"mod1max":-2} |
| of Decrepification | 100 | 0 | 0 | 30 | 0 | 30 | 44 | 1 | wand, knif, head | 无 | {"mod1code":"charged","mod1param":87,"mod1min":-60,"mod1max":-5} |
| of Decrepification | 100 | 0 | 0 | 60 | 0 | 60 | 44 | 1 | shld | 无 | {"mod1code":"charged","mod1param":87,"mod1min":-20,"mod1max":-2} |
| of Bone Imprisonment | 100 | 0 | 0 | 30 | 0 | 30 | 44 | 1 | wand, knif, head | 无 | {"mod1code":"charged","mod1param":88,"mod1min":-60,"mod1max":-5} |
| of Bone Imprisonment | 100 | 0 | 0 | 60 | 0 | 60 | 44 | 1 | mace, scep | 无 | {"mod1code":"charged","mod1param":88,"mod1min":-20,"mod1max":-2} |
| of Iron Golem Creation | 100 | 0 | 0 | 30 | 0 | 30 | 44 | 1 | wand, knif, head | 无 | {"mod1code":"charged","mod1param":90,"mod1min":-60,"mod1max":-5} |
| of Iron Golem Creation | 100 | 0 | 0 | 60 | 0 | 60 | 44 | 1 | swor | 无 | {"mod1code":"charged","mod1param":90,"mod1min":-20,"mod1max":-2} |
| of Lower Resistance | 100 | 1 | 1 | 36 | 0 | 36 | 44 | 1 | wand, knif, head | 无 | {"mod1code":"charged","mod1param":91,"mod1min":-60,"mod1max":-3} |
| of Lower Resistance | 100 | 1 | 1 | 72 | 0 | 72 | 44 | 1 | staf | 无 | {"mod1code":"charged","mod1param":91,"mod1min":-20,"mod1max":-1} |
| of Poison Novas | 100 | 1 | 1 | 36 | 0 | 36 | 44 | 1 | wand, knif, head | 无 | {"mod1code":"charged","mod1param":92,"mod1min":-60,"mod1max":-3} |
| of Poison Novas | 100 | 1 | 1 | 72 | 0 | 72 | 44 | 1 | glov | 无 | {"mod1code":"charged","mod1param":92,"mod1min":-20,"mod1max":-1} |
| of Bone Spirits | 100 | 1 | 1 | 36 | 0 | 36 | 44 | 1 | wand, knif, head | 无 | {"mod1code":"charged","mod1param":93,"mod1min":-60,"mod1max":-3} |
| of Bone Spirits | 100 | 1 | 1 | 72 | 0 | 72 | 44 | 1 | amul, circ | 无 | {"mod1code":"charged","mod1param":93,"mod1min":-20,"mod1max":-1} |
| of Fire Golem Summoning | 100 | 0 | 0 | 36 | 0 | 36 | 44 | 1 | wand, knif, head | 无 | {"mod1code":"charged","mod1param":94,"mod1min":-60,"mod1max":-3} |
| of Fire Golem Summoning | 100 | 0 | 0 | 72 | 0 | 72 | 44 | 1 | hamm | 无 | {"mod1code":"charged","mod1param":94,"mod1min":-20,"mod1max":-1} |
| of Revivification | 100 | 0 | 0 | 36 | 0 | 36 | 44 | 1 | wand, knif, head | 无 | {"mod1code":"charged","mod1param":95,"mod1min":-60,"mod1max":-3} |
| of Revivification | 100 | 0 | 0 | 72 | 0 | 72 | 44 | 1 | pole | 无 | {"mod1code":"charged","mod1param":95,"mod1min":-20,"mod1max":-1} |
| of Sacrifice | 100 | 1 | 1 | 7 | 0 | 7 | 44 | 1 | scep, ashd | 无 | {"mod1code":"charged","mod1param":96,"mod1min":-30,"mod1max":-10} |
| of Sacrifice | 100 | 1 | 1 | 14 | 0 | 14 | 44 | 1 | mele | scep | {"mod1code":"charged","mod1param":96,"mod1min":-20,"mod1max":-6} |
| of Holy Bolts | 100 | 1 | 1 | 12 | 0 | 12 | 44 | 1 | scep, ashd | 无 | {"mod1code":"charged","mod1param":101,"mod1min":-30,"mod1max":-8} |
| of Holy Bolts | 100 | 1 | 1 | 24 | 0 | 24 | 44 | 1 | amul, circ | 无 | {"mod1code":"charged","mod1param":101,"mod1min":-20,"mod1max":-5} |
| of Zeal | 100 | 1 | 1 | 18 | 0 | 18 | 44 | 1 | scep, ashd | 无 | {"mod1code":"charged","mod1param":106,"mod1min":-30,"mod1max":-7} |
| of Zeal | 100 | 1 | 1 | 36 | 0 | 36 | 44 | 1 | mele | scep | {"mod1code":"charged","mod1param":106,"mod1min":-20,"mod1max":-4} |
| of Vengeance | 100 | 1 | 1 | 24 | 0 | 24 | 44 | 1 | scep, ashd | 无 | {"mod1code":"charged","mod1param":111,"mod1min":-30,"mod1max":-6} |
| of Vengeance | 100 | 1 | 1 | 48 | 0 | 48 | 44 | 1 | swor, axe | 无 | {"mod1code":"charged","mod1param":111,"mod1min":-20,"mod1max":-3} |
| of Blessed Hammers | 100 | 1 | 1 | 24 | 0 | 24 | 44 | 1 | scep, ashd | 无 | {"mod1code":"charged","mod1param":112,"mod1min":-30,"mod1max":-6} |
| of Blessed Hammers | 100 | 1 | 1 | 48 | 0 | 48 | 44 | 1 | hamm | 无 | {"mod1code":"charged","mod1param":112,"mod1min":-20,"mod1max":-3} |
| of Conversion | 100 | 0 | 0 | 30 | 0 | 30 | 44 | 1 | scep, ashd | 无 | {"mod1code":"charged","mod1param":116,"mod1min":-30,"mod1max":-5} |
| of Conversion | 100 | 0 | 0 | 60 | 0 | 60 | 44 | 1 | blun | scep | {"mod1code":"charged","mod1param":116,"mod1min":-20,"mod1max":-2} |
| of Fist of the Heavens | 100 | 0 | 0 | 36 | 0 | 36 | 44 | 1 | scep, ashd | 无 | {"mod1code":"charged","mod1param":121,"mod1min":-30,"mod1max":-3} |
| of Fist of the Heavens | 100 | 0 | 0 | 72 | 0 | 72 | 44 | 1 | glov | 无 | {"mod1code":"charged","mod1param":121,"mod1min":-20,"mod1max":-1} |
| of Bashing | 100 | 1 | 1 | 7 | 0 | 7 | 44 | 1 | phlm | 无 | {"mod1code":"charged","mod1param":126,"mod1min":-60,"mod1max":-10} |
| of Bashing | 100 | 1 | 1 | 14 | 0 | 14 | 44 | 1 | mele | staf, wand, orb | {"mod1code":"charged","mod1param":126,"mod1min":-20,"mod1max":-6} |
| of Howling | 100 | 0 | 0 | 7 | 0 | 7 | 44 | 1 | phlm | 无 | {"mod1code":"charged","mod1param":130,"mod1min":-60,"mod1max":-10} |
| of Howling | 100 | 0 | 0 | 14 | 0 | 14 | 44 | 1 |  | 无 | {"mod1code":"charged","mod1param":130,"mod1min":-20,"mod1max":-6} |
| of Potion Finding | 100 | 0 | 0 | 7 | 0 | 7 | 44 | 1 | phlm | 无 | {"mod1code":"charged","mod1param":131,"mod1min":-60,"mod1max":-10} |
| of Potion Finding | 100 | 0 | 0 | 14 | 0 | 14 | 44 | 1 |  | 无 | {"mod1code":"charged","mod1param":131,"mod1min":-20,"mod1max":-6} |
| of Taunting | 100 | 0 | 0 | 12 | 0 | 12 | 44 | 1 | phlm | 无 | {"mod1code":"charged","mod1param":137,"mod1min":-60,"mod1max":-8} |
| of Taunting | 100 | 0 | 0 | 24 | 0 | 24 | 44 | 1 |  | 无 | {"mod1code":"charged","mod1param":137,"mod1min":-20,"mod1max":-5} |
| of Shouting | 100 | 0 | 0 | 12 | 0 | 12 | 44 | 1 | phlm | 无 | {"mod1code":"charged","mod1param":138,"mod1min":-60,"mod1max":-8} |
| of Shouting | 100 | 0 | 0 | 24 | 0 | 24 | 44 | 1 |  | 无 | {"mod1code":"charged","mod1param":138,"mod1min":-20,"mod1max":-5} |
| of Stunning | 100 | 1 | 1 | 18 | 0 | 18 | 44 | 1 | phlm | staf, wand, orb | {"mod1code":"charged","mod1param":139,"mod1min":-60,"mod1max":-7} |
| of Stunning | 100 | 1 | 1 | 36 | 0 | 36 | 44 | 1 | mele | 无 | {"mod1code":"charged","mod1param":139,"mod1min":-20,"mod1max":-4} |
| of Item Finding | 100 | 0 | 0 | 18 | 0 | 18 | 44 | 1 | phlm | 无 | {"mod1code":"charged","mod1param":142,"mod1min":-60,"mod1max":-7} |
| of Item Finding | 100 | 0 | 0 | 36 | 0 | 36 | 44 | 1 |  | 无 | {"mod1code":"charged","mod1param":142,"mod1min":-20,"mod1max":-4} |
| of Concentration | 100 | 1 | 1 | 24 | 0 | 24 | 44 | 1 | phlm | 无 | {"mod1code":"charged","mod1param":144,"mod1min":-60,"mod1max":-6} |
| of Concentration | 100 | 1 | 1 | 48 | 0 | 48 | 44 | 1 | mele | staf, wand, orb | {"mod1code":"charged","mod1param":144,"mod1min":-20,"mod1max":-3} |
| of Battle Cry | 100 | 0 | 0 | 24 | 0 | 24 | 44 | 1 | phlm | 无 | {"mod1code":"charged","mod1param":146,"mod1min":-60,"mod1max":-6} |
| of Battle Cry | 100 | 0 | 0 | 48 | 0 | 48 | 44 | 1 |  | 无 | {"mod1code":"charged","mod1param":146,"mod1min":-20,"mod1max":-3} |
| of Battle Orders | 100 | 0 | 0 | 30 | 0 | 30 | 44 | 1 | phlm | 无 | {"mod1code":"charged","mod1param":149,"mod1min":-60,"mod1max":-5} |
| of Battle Orders | 100 | 0 | 0 | 60 | 0 | 60 | 44 | 1 |  | 无 | {"mod1code":"charged","mod1param":149,"mod1min":-20,"mod1max":-2} |
| of Grim Ward | 100 | 1 | 1 | 30 | 0 | 30 | 44 | 1 | phlm | 无 | {"mod1code":"charged","mod1param":150,"mod1min":-60,"mod1max":-5} |
| of Grim Ward | 100 | 1 | 1 | 60 | 0 | 60 | 44 | 1 | amul | 无 | {"mod1code":"charged","mod1param":150,"mod1min":-20,"mod1max":-2} |
| of War Cry | 100 | 0 | 0 | 36 | 0 | 36 | 44 | 1 | phlm | 无 | {"mod1code":"charged","mod1param":154,"mod1min":-60,"mod1max":-3} |
| of War Cry | 100 | 0 | 0 | 72 | 0 | 72 | 44 | 1 |  | 无 | {"mod1code":"charged","mod1param":154,"mod1min":-20,"mod1max":-1} |
| of Battle Command | 100 | 0 | 0 | 36 | 0 | 36 | 44 | 1 | phlm | 无 | {"mod1code":"charged","mod1param":155,"mod1min":-60,"mod1max":-3} |
| of Battle Command | 100 | 0 | 0 | 72 | 0 | 72 | 44 | 1 |  | 无 | {"mod1code":"charged","mod1param":155,"mod1min":-20,"mod1max":-1} |
| of Firestorms | 100 | 1 | 1 | 7 | 0 | 7 | 44 | 1 | club | 无 | {"mod1code":"charged","mod1param":225,"mod1min":-30,"mod1max":-10} |
| of Firestorms | 100 | 1 | 1 | 14 | 0 | 14 | 44 | 1 | staf | 无 | {"mod1code":"charged","mod1param":225,"mod1min":-20,"mod1max":-6} |
| of Molten Boulders | 100 | 0 | 0 | 12 | 0 | 12 | 44 | 1 | club | 无 | {"mod1code":"charged","mod1param":229,"mod1min":-30,"mod1max":-8} |
| of Molten Boulders | 100 | 0 | 0 | 24 | 0 | 24 | 44 | 1 | mace | 无 | {"mod1code":"charged","mod1param":229,"mod1min":-20,"mod1max":-5} |
| of Eruption | 100 | 1 | 1 | 18 | 0 | 18 | 44 | 1 | club | 无 | {"mod1code":"charged","mod1param":234,"mod1min":-30,"mod1max":-7} |
| of Eruption | 100 | 1 | 1 | 36 | 0 | 36 | 44 | 1 | staf | 无 | {"mod1code":"charged","mod1param":234,"mod1min":-20,"mod1max":-4} |
| of Cyclone Armor | 100 | 0 | 0 | 18 | 0 | 18 | 44 | 1 | club | 无 | {"mod1code":"charged","mod1param":235,"mod1min":-30,"mod1max":-7} |
| of Cyclone Armor | 100 | 0 | 0 | 36 | 0 | 36 | 44 | 1 | tors | 无 | {"mod1code":"charged","mod1param":235,"mod1min":-20,"mod1max":-4} |
| of Twister | 100 | 1 | 1 | 24 | 0 | 24 | 44 | 1 | club | 无 | {"mod1code":"charged","mod1param":240,"mod1min":-30,"mod1max":-6} |
| of Twister | 100 | 1 | 1 | 48 | 0 | 48 | 44 | 1 | amul, circ | 无 | {"mod1code":"charged","mod1param":240,"mod1min":-20,"mod1max":-3} |
| of Volcano | 100 | 1 | 1 | 30 | 0 | 30 | 44 | 1 | club | 无 | {"mod1code":"charged","mod1param":244,"mod1min":-30,"mod1max":-6} |
| of Volcano | 100 | 1 | 1 | 60 | 0 | 60 | 44 | 1 | hamm | 无 | {"mod1code":"charged","mod1param":244,"mod1min":-20,"mod1max":-3} |
| of Tornado | 100 | 1 | 1 | 30 | 0 | 30 | 44 | 1 | club | 无 | {"mod1code":"charged","mod1param":245,"mod1min":-30,"mod1max":-5} |
| of Tornado | 100 | 1 | 1 | 60 | 0 | 60 | 44 | 1 | amul, circ | 无 | {"mod1code":"charged","mod1param":245,"mod1min":-20,"mod1max":-2} |
| of Armageddon | 100 | 0 | 0 | 36 | 0 | 36 | 44 | 1 | club | 无 | {"mod1code":"charged","mod1param":249,"mod1min":-30,"mod1max":-3} |
| of Armageddon | 100 | 0 | 0 | 72 | 0 | 72 | 44 | 1 | staf | 无 | {"mod1code":"charged","mod1param":249,"mod1min":-20,"mod1max":-1} |
| of Hurricane | 100 | 0 | 0 | 36 | 0 | 36 | 44 | 1 | club | 无 | {"mod1code":"charged","mod1param":250,"mod1min":-30,"mod1max":-3} |
| of Hurricane | 100 | 0 | 0 | 72 | 0 | 72 | 44 | 1 | amul, circ | 无 | {"mod1code":"charged","mod1param":250,"mod1min":-20,"mod1max":-1} |
| of Damage Amplification | 100 | 1 | 1 | 3 | 0 | 0 | 44 | 1 | weap | orb | {"mod1code":"hit-skill","mod1param":66,"mod1min":5,"mod1max":1} |
| of the Icicle | 100 | 1 | 1 | 37 | 0 | 29 | 10 | 2 | jewl | 无 | {"mod1code":"cold-min","mod1min":2,"mod1max":3,"mod2code":"cold-max","mod2min":6,"mod2max":10,"mod3code":"cold-len","mod3min":50,"mod3max":50} |
| of the Glacier | 100 | 1 | 0 | 58 | 0 | 50 | 10 | 2 | jewl | 无 | {"mod1code":"cold-min","mod1min":4,"mod1max":5,"mod2code":"cold-max","mod2min":11,"mod2max":15,"mod3code":"cold-len","mod3min":50,"mod3max":50} |
| of Fire | 100 | 1 | 1 | 36 | 0 | 28 | 12 | 2 | jewl | 无 | {"mod1code":"fire-min","mod1min":4,"mod1max":10,"mod2code":"fire-max","mod2min":11,"mod2max":30} |
| of Burning | 100 | 1 | 1 | 57 | 0 | 49 | 12 | 2 | jewl | 无 | {"mod1code":"fire-min","mod1min":11,"mod1max":25,"mod2code":"fire-max","mod2min":31,"mod2max":50} |
| of Lightning | 100 | 1 | 1 | 36 | 0 | 28 | 13 | 2 | jewl | 无 | {"mod1code":"ltng-min","mod1min":1,"mod1max":1,"mod2code":"ltng-max","mod2min":21,"mod2max":60} |
| of Thunder | 100 | 1 | 1 | 57 | 0 | 49 | 13 | 2 | jewl | 无 | {"mod1code":"ltng-min","mod1min":1,"mod1max":1,"mod2code":"ltng-max","mod2min":61,"mod2max":100} |
| of Daring | 100 | 1 | 1 | 19 | 0 | 14 | 17 | 3 | jewl | 无 | {"mod1code":"dex","mod1min":4,"mod1max":6} |
| of Daring | 100 | 1 | 1 | 36 | 0 | 28 | 17 | 3 | jewl | 无 | {"mod1code":"dex","mod1min":7,"mod1max":9} |
| of Knowledge | 100 | 1 | 1 | 24 | 0 | 18 | 23 | 3 | jewl | 无 | {"mod1code":"enr","mod1min":4,"mod1max":6} |
| of Knowledge | 100 | 1 | 1 | 41 | 0 | 33 | 23 | 3 | jewl | 无 | {"mod1code":"enr","mod1min":7,"mod1max":9} |
| of Virility | 100 | 1 | 1 | 33 | 0 | 25 | 31 | 4 | jewl | 无 | {"mod1code":"str","mod1min":5,"mod1max":6} |
| of Virility | 100 | 1 | 1 | 50 | 0 | 42 | 31 | 4 | jewl | 无 | {"mod1code":"str","mod1min":7,"mod1max":9} |
| of Readiness | 1 | 1 | 1 | 20 | 0 | 15 | 7 | 2 | glov | 无 | {"mod1code":"swing1","mod1min":10,"mod1max":10} |
| of Craftsmanship | 100 | 1 | 1 | 1 | 0 | 1 | 14 | 4 | lcha | 无 | {"mod1code":"dmg-max","mod1min":1,"mod1max":1} |
| of Quality | 100 | 1 | 1 | 41 | 0 | 33 | 14 | 4 | lcha | 无 | {"mod1code":"dmg-max","mod1min":2,"mod1max":2} |
| of Maiming | 100 | 1 | 0 | 71 | 0 | 63 | 14 | 4 | lcha | 无 | {"mod1code":"dmg-max","mod1min":3,"mod1max":4} |
| of Craftsmanship | 100 | 1 | 1 | 26 | 0 | 19 | 14 | 4 | mcha | 无 | {"mod1code":"dmg-max","mod1min":1,"mod1max":1} |
| of Quality | 100 | 1 | 0 | 56 | 0 | 48 | 14 | 4 | mcha | 无 | {"mod1code":"dmg-max","mod1min":2,"mod1max":2} |
| of Craftsmanship | 100 | 1 | 1 | 85 | 0 | 77 | 14 | 4 | scha | 无 | {"mod1code":"dmg-max","mod1min":1,"mod1max":1} |
| of Blight | 100 | 1 | 1 | 1 | 0 | 1 | 16 | 2 | lcha | 无 | {"mod1code":"dmg-pois","mod1param":75,"mod1min":21,"mod1max":21} |
| of Venom | 100 | 1 | 1 | 6 | 0 | 4 | 16 | 1 | lcha | 无 | {"mod1code":"dmg-pois","mod1param":100,"mod1min":39,"mod1max":39} |
| of Pestilence | 100 | 1 | 1 | 14 | 0 | 10 | 16 | 1 | lcha | 无 | {"mod1code":"dmg-pois","mod1param":125,"mod1min":52,"mod1max":52} |
| of Anthrax | 100 | 1 | 0 | 21 | 0 | 15 | 16 | 1 | lcha | 无 | {"mod1code":"dmg-pois","mod1param":150,"mod1min":86,"mod1max":86} |
| of Blight | 100 | 1 | 1 | 5 | 0 | 3 | 16 | 2 | mcha | 无 | {"mod1code":"dmg-pois","mod1param":75,"mod1min":21,"mod1max":21} |
| of Venom | 100 | 1 | 1 | 13 | 0 | 9 | 16 | 1 | mcha | 无 | {"mod1code":"dmg-pois","mod1param":100,"mod1min":39,"mod1max":39} |
| of Pestilence | 100 | 1 | 1 | 23 | 0 | 17 | 16 | 1 | mcha | 无 | {"mod1code":"dmg-pois","mod1param":125,"mod1min":52,"mod1max":52} |
| of Anthrax | 100 | 1 | 0 | 33 | 0 | 25 | 16 | 1 | mcha | 无 | {"mod1code":"dmg-pois","mod1param":150,"mod1min":86,"mod1max":86} |
| of Blight | 100 | 1 | 1 | 9 | 0 | 6 | 16 | 2 | scha | 无 | {"mod1code":"dmg-pois","mod1param":75,"mod1min":21,"mod1max":21} |
| of Venom | 100 | 1 | 1 | 20 | 0 | 15 | 16 | 1 | scha | 无 | {"mod1code":"dmg-pois","mod1param":100,"mod1min":39,"mod1max":39} |
| of Pestilence | 100 | 1 | 1 | 32 | 0 | 24 | 16 | 1 | scha | 无 | {"mod1code":"dmg-pois","mod1param":125,"mod1min":52,"mod1max":52} |
| of Anthrax | 100 | 1 | 0 | 44 | 0 | 36 | 16 | 1 | scha | 无 | {"mod1code":"dmg-pois","mod1param":150,"mod1min":86,"mod1max":86} |
| of Frost | 100 | 1 | 1 | 5 | 0 | 3 | 10 | 2 | lcha | 无 | {"mod1code":"cold-min","mod1min":1,"mod1max":1,"mod2code":"cold-max","mod2min":2,"mod2max":2,"mod3code":"cold-len","mod3min":25,"mod3max":25} |
| of the Icicle | 100 | 1 | 1 | 8 | 0 | 6 | 10 | 1 | lcha | 无 | {"mod1code":"cold-min","mod1min":2,"mod1max":2,"mod2code":"cold-max","mod2min":3,"mod2max":4,"mod3code":"cold-len","mod3min":25,"mod3max":25} |
| of the Glacier | 100 | 1 | 1 | 15 | 0 | 11 | 10 | 1 | lcha | 无 | {"mod1code":"cold-min","mod1min":3,"mod1max":3,"mod2code":"cold-max","mod2min":5,"mod2max":7,"mod3code":"cold-len","mod3min":25,"mod3max":25} |
| of Winter | 100 | 1 | 0 | 23 | 0 | 17 | 10 | 1 | lcha | 无 | {"mod1code":"cold-min","mod1min":4,"mod1max":6,"mod2code":"cold-max","mod2min":8,"mod2max":11,"mod3code":"cold-len","mod3min":25,"mod3max":25} |
| of Frost | 100 | 1 | 1 | 9 | 0 | 6 | 10 | 2 | mcha | 无 | {"mod1code":"cold-min","mod1min":1,"mod1max":1,"mod2code":"cold-max","mod2min":2,"mod2max":3,"mod3code":"cold-len","mod3min":25,"mod3max":25} |
| of the Icicle | 100 | 1 | 1 | 15 | 0 | 11 | 10 | 1 | mcha | 无 | {"mod1code":"cold-min","mod1min":2,"mod1max":2,"mod2code":"cold-max","mod2min":4,"mod2max":5,"mod3code":"cold-len","mod3min":25,"mod3max":25} |
| of the Glacier | 100 | 1 | 1 | 25 | 0 | 18 | 10 | 1 | mcha | 无 | {"mod1code":"cold-min","mod1min":3,"mod1max":3,"mod2code":"cold-max","mod2min":6,"mod2max":8,"mod3code":"cold-len","mod3min":25,"mod3max":25} |
| of Winter | 100 | 1 | 0 | 35 | 0 | 27 | 10 | 1 | mcha | 无 | {"mod1code":"cold-min","mod1min":4,"mod1max":6,"mod2code":"cold-max","mod2min":9,"mod2max":12,"mod3code":"cold-len","mod3min":25,"mod3max":25} |
| of Frost | 100 | 1 | 1 | 14 | 0 | 10 | 10 | 2 | scha | 无 | {"mod1code":"cold-min","mod1min":1,"mod1max":1,"mod2code":"cold-max","mod2min":2,"mod2max":2,"mod3code":"cold-len","mod3min":25,"mod3max":25} |
| of the Icicle | 100 | 1 | 1 | 21 | 0 | 15 | 10 | 1 | scha | 无 | {"mod1code":"cold-min","mod1min":2,"mod1max":2,"mod2code":"cold-max","mod2min":3,"mod2max":4,"mod3code":"cold-len","mod3min":25,"mod3max":25} |
| of the Glacier | 100 | 1 | 1 | 33 | 0 | 25 | 10 | 1 | scha | 无 | {"mod1code":"cold-min","mod1min":3,"mod1max":3,"mod2code":"cold-max","mod2min":5,"mod2max":6,"mod3code":"cold-len","mod3min":25,"mod3max":25} |
| of Winter | 100 | 1 | 0 | 46 | 0 | 38 | 10 | 1 | scha | 无 | {"mod1code":"cold-min","mod1min":4,"mod1max":5,"mod2code":"cold-max","mod2min":7,"mod2max":9,"mod3code":"cold-len","mod3min":25,"mod3max":25} |
| of Flame | 100 | 1 | 1 | 3 | 0 | 2 | 12 | 2 | lcha | 无 | {"mod1code":"fire-min","mod1min":1,"mod1max":1,"mod2code":"fire-max","mod2min":2,"mod2max":2} |
| of Fire | 100 | 1 | 1 | 8 | 0 | 6 | 12 | 1 | lcha | 无 | {"mod1code":"fire-min","mod1min":1,"mod1max":2,"mod2code":"fire-max","mod2min":3,"mod2max":3} |
| of Burning | 100 | 1 | 1 | 14 | 0 | 10 | 12 | 1 | lcha | 无 | {"mod1code":"fire-min","mod1min":2,"mod1max":3,"mod2code":"fire-max","mod2min":4,"mod2max":7} |
| of Incineration | 100 | 1 | 0 | 22 | 0 | 16 | 12 | 1 | lcha | 无 | {"mod1code":"fire-min","mod1min":4,"mod1max":7,"mod2code":"fire-max","mod2min":8,"mod2max":14} |
| of Flame | 100 | 1 | 1 | 7 | 0 | 5 | 12 | 2 | mcha | 无 | {"mod1code":"fire-min","mod1min":1,"mod1max":1,"mod2code":"fire-max","mod2min":2,"mod2max":2} |
| of Fire | 100 | 1 | 1 | 14 | 0 | 10 | 12 | 1 | mcha | 无 | {"mod1code":"fire-min","mod1min":2,"mod1max":2,"mod2code":"fire-max","mod2min":3,"mod2max":5} |
| of Burning | 100 | 1 | 1 | 24 | 0 | 18 | 12 | 1 | mcha | 无 | {"mod1code":"fire-min","mod1min":3,"mod1max":5,"mod2code":"fire-max","mod2min":6,"mod2max":11} |
| of Incineration | 100 | 1 | 0 | 34 | 0 | 26 | 12 | 1 | mcha | 无 | {"mod1code":"fire-min","mod1min":6,"mod1max":10,"mod2code":"fire-max","mod2min":12,"mod2max":17} |
| of Flame | 100 | 1 | 1 | 11 | 0 | 8 | 12 | 2 | scha | 无 | {"mod1code":"fire-min","mod1min":1,"mod1max":1,"mod2code":"fire-max","mod2min":2,"mod2max":2} |
| of Fire | 100 | 1 | 1 | 20 | 0 | 15 | 12 | 1 | scha | 无 | {"mod1code":"fire-min","mod1min":2,"mod1max":2,"mod2code":"fire-max","mod2min":3,"mod2max":4} |
| of Burning | 100 | 1 | 1 | 32 | 0 | 24 | 12 | 1 | scha | 无 | {"mod1code":"fire-min","mod1min":3,"mod1max":4,"mod2code":"fire-max","mod2min":5,"mod2max":8} |
| of Incineration | 100 | 1 | 0 | 45 | 0 | 37 | 12 | 1 | scha | 无 | {"mod1code":"fire-min","mod1min":5,"mod1max":7,"mod2code":"fire-max","mod2min":9,"mod2max":13} |
| of Shock | 100 | 1 | 1 | 4 | 0 | 3 | 13 | 2 | lcha | 无 | {"mod1code":"ltng-min","mod1min":1,"mod1max":1,"mod2code":"ltng-max","mod2min":2,"mod2max":3} |
| of Lightning | 100 | 1 | 1 | 7 | 0 | 5 | 13 | 1 | lcha | 无 | {"mod1code":"ltng-min","mod1min":1,"mod1max":1,"mod2code":"ltng-max","mod2min":4,"mod2max":7} |
| of Thunder | 100 | 1 | 1 | 15 | 0 | 11 | 13 | 1 | lcha | 无 | {"mod1code":"ltng-min","mod1min":1,"mod1max":1,"mod2code":"ltng-max","mod2min":8,"mod2max":21} |
| of Storms | 100 | 1 | 0 | 22 | 0 | 16 | 13 | 1 | lcha | 无 | {"mod1code":"ltng-min","mod1min":1,"mod1max":1,"mod2code":"ltng-max","mod2min":22,"mod2max":33} |
| of Shock | 100 | 1 | 1 | 7 | 0 | 5 | 13 | 2 | mcha | 无 | {"mod1code":"ltng-min","mod1min":1,"mod1max":1,"mod2code":"ltng-max","mod2min":3,"mod2max":5} |
| of Lightning | 100 | 1 | 1 | 14 | 0 | 10 | 13 | 1 | mcha | 无 | {"mod1code":"ltng-min","mod1min":1,"mod1max":1,"mod2code":"ltng-max","mod2min":6,"mod2max":13} |
| of Thunder | 100 | 1 | 1 | 24 | 0 | 18 | 13 | 1 | mcha | 无 | {"mod1code":"ltng-min","mod1min":1,"mod1max":1,"mod2code":"ltng-max","mod2min":14,"mod2max":25} |
| of Storms | 100 | 1 | 0 | 34 | 0 | 26 | 13 | 1 | mcha | 无 | {"mod1code":"ltng-min","mod1min":1,"mod1max":1,"mod2code":"ltng-max","mod2min":26,"mod2max":38} |
| of Shock | 100 | 1 | 1 | 12 | 0 | 9 | 13 | 2 | scha | 无 | {"mod1code":"ltng-min","mod1min":1,"mod1max":1,"mod2code":"ltng-max","mod2min":3,"mod2max":6} |
| of Lightning | 100 | 1 | 1 | 21 | 0 | 15 | 13 | 1 | scha | 无 | {"mod1code":"ltng-min","mod1min":1,"mod1max":1,"mod2code":"ltng-max","mod2min":7,"mod2max":10} |
| of Thunder | 100 | 1 | 1 | 33 | 0 | 25 | 13 | 1 | scha | 无 | {"mod1code":"ltng-min","mod1min":1,"mod1max":1,"mod2code":"ltng-max","mod2min":11,"mod2max":18} |
| of Storms | 100 | 1 | 0 | 45 | 0 | 37 | 13 | 1 | scha | 无 | {"mod1code":"ltng-min","mod1min":1,"mod1max":1,"mod2code":"ltng-max","mod2min":19,"mod2max":28} |
| of Dexterity | 1 | 1 | 1 | 1 | 12 | 1 | 17 | 4 | boot, glov | 无 | {"mod1code":"dex","mod1min":1,"mod1max":1} |
| of Dexterity | 1 | 1 | 1 | 1 | 5 | 1 | 17 | 4 | ring | 无 | {"mod1code":"dex","mod1min":1,"mod1max":1} |
| of Strength | 1 | 1 | 1 | 1 | 11 | 1 | 31 | 4 | glov | 无 | {"mod1code":"str","mod1min":1,"mod1max":1} |
| of Strength | 1 | 1 | 1 | 1 | 4 | 1 | 31 | 4 | ring | 无 | {"mod1code":"str","mod1min":1,"mod1max":1} |
| of Thorns | 1 | 1 | 1 | 1 | 13 | 1 | 6 | 4 | tors, belt, shld | 无 | {"mod1code":"thorns","mod1min":1,"mod1max":1} |
| of Frost | 1 | 1 | 1 | 1 | 3 | 1 | 10 | 4 | weap | staf, wand, orb | {"mod1code":"dmg-cold","mod1param":25,"mod1min":1,"mod1max":1} |
| of Flame | 1 | 1 | 1 | 1 | 3 | 1 | 12 | 4 | weap | staf, wand, orb | {"mod1code":"dmg-fire","mod1min":1,"mod1max":2} |
| of Blight | 1 | 1 | 1 | 1 | 4 | 1 | 16 | 4 | weap | scep, staf, orb | {"mod1code":"dmg-pois","mod1param":50,"mod1min":8,"mod1max":8} |
| of Shock | 1 | 1 | 1 | 1 | 3 | 1 | 13 | 4 | weap | staf, wand, orb | {"mod1code":"dmg-ltng","mod1min":1,"mod1max":3} |
| of Regeneration | 1 | 1 | 1 | 1 | 9 | 1 | 19 | 3 | amul, circ | 无 | {"mod1code":"regen","mod1min":2,"mod1max":2} |
| of Energy | 1 | 1 | 1 | 1 | 4 | 1 | 23 | 4 | amul, orb, circ, wand, staf, helm, ring | 无 | {"mod1code":"enr","mod1min":1,"mod1max":1} |
| of Light | 1 | 1 | 1 | 1 | 5 | 1 | 25 | 4 | ring, amul | 无 | {"mod1code":"light","mod1min":1,"mod1max":1,"mod2code":"att","mod2min":10,"mod2max":10} |
| of the Leech | 100 | 1 | 1 | 24 | 0 | 20 | 27 | 2 | amul | 无 | {"mod1code":"lifesteal","mod1min":2,"mod1max":3} |
| of the Locust | 100 | 1 | 1 | 57 | 0 | 45 | 27 | 2 | amul | 无 | {"mod1code":"lifesteal","mod1min":4,"mod1max":5} |
| of the Lamprey | 100 | 1 | 1 | 85 | 0 | 73 | 27 | 2 | amul | 无 | {"mod1code":"lifesteal","mod1min":6,"mod1max":6} |
| of the Bat | 1 | 1 | 1 | 25 | 0 | 21 | 28 | 2 | ring | 无 | {"mod1code":"manasteal","mod1min":2,"mod1max":3} |
| of the Wraith | 1 | 1 | 1 | 58 | 0 | 46 | 28 | 2 | ring | 无 | {"mod1code":"manasteal","mod1min":4,"mod1max":5} |
| of the Vampire | 100 | 1 | 1 | 86 | 0 | 74 | 28 | 2 | ring | 无 | {"mod1code":"manasteal","mod1min":6,"mod1max":6} |

## 全部符文之语原始身份（169 条）

含 78 个完成及 91 个未完成定义；完成定义有 55 个 LoD 离线匹配加 1 个 D2R 边缘覆盖启用，另外 22 个 server=1 仍禁用。原始 null、同名未完成行、全部条件和参数不丢失。

| 稳定身份 | 显示名称 | 状态 | 完整原始字段 |
| --- | --- | --- | --- |
| runeword:Runeword43 | Amity | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword43","Rune Name":"Amity","lineNumber":71} |
| runeword:Runeword1 | Ancient's Pledge | 原版离线匹配已启用；仅部分行为已接入，不代表完整生成或全部属性生效 | {"Name":"Runeword1","Rune Name":"Ancient's Pledge","complete":1,"itype1":"shld","Rune1":"r08","Rune2":"r09","Rune3":"r07","T1Code1":"res-cold","T1Min1":30,"T1Max1":30,"T1Code2":"res-all","T1Min2":13,"T1Max2":13,"T1Code3":"ac%","T1Min3":50,"T1Max3":50,"T1Code4":"dmg-to-mana","T1Min4":10,"T1Max4":10,"lineNumber":0} |
| runeword:Runeword2 | Armageddon | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword2","Rune Name":"Armageddon","lineNumber":72} |
| runeword:Runeword3 | Authority | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword3","Rune Name":"Authority","lineNumber":73} |
| runeword:Runeword5 | Beauty | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword5","Rune Name":"Beauty","lineNumber":74} |
| runeword:Runeword6 | Black | 原版离线匹配已启用；仅部分行为已接入，不代表完整生成或全部属性生效 | {"Name":"Runeword6","Rune Name":"Black","complete":1,"itype1":"club","itype2":"hamm","itype3":"mace","Rune1":"r10","Rune2":"r16","Rune3":"r04","T1Code1":"crush","T1Min1":40,"T1Max1":40,"T1Code2":"dmg%","T1Min2":120,"T1Max2":120,"T1Code3":"swing2","T1Min3":15,"T1Max3":15,"T1Code4":"red-mag","T1Min4":2,"T1Max4":2,"T1Code5":"att","T1Min5":200,"T1Max5":200,"T1Code6":"charged","T1Param6":74,"T1Min6":12,"T1Max6":4,"lineNumber":1} |
| runeword:Runeword7 | Blood | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword7","Rune Name":"Blood","itype1":"helm","lineNumber":75} |
| runeword:Runeword8 | Bone | 原版离线匹配已启用；仅部分行为已接入，不代表完整生成或全部属性生效 | {"Name":"Runeword8","Rune Name":"Bone","complete":1,"itype1":"tors","*runes":"SolUmUm","Rune1":"r12","Rune2":"r22","Rune3":"r22","T1Code1":"hit-skill","T1Param1":"Bone Spear","T1Min1":15,"T1Max1":10,"T1Code2":"gethit-skill","T1Param2":"Bone Armor","T1Min2":15,"T1Max2":10,"T1Code3":"nec","T1Min3":2,"T1Max3":2,"T1Code4":"mana","T1Min4":100,"T1Max4":150,"lineNumber":76} |
| runeword:Runeword14 | Chains of Honor | 原版离线匹配已启用；仅部分行为已接入，不代表完整生成或全部属性生效 | {"Name":"Runeword14","Rune Name":"Bound by Duty","complete":1,"itype1":"tors","*runes":"DolUmBerIst","Rune1":"r14","Rune2":"r22","Rune3":"r30","Rune4":"r24","T1Code1":"res-all","T1Min1":50,"T1Max1":50,"T1Code2":"ac%","T1Min2":70,"T1Max2":70,"T1Code3":"dmg-demon","T1Min3":200,"T1Max3":200,"T1Code4":"dmg-undead","T1Min4":100,"T1Max4":100,"T1Code5":"lifesteal","T1Min5":8,"T1Max5":8,"T1Code6":"allskills","T1Min6":2,"T1Max6":2,"T1Code7":"str","T1Min7":20,"T1Max7":20,"lineNumber":24} |
| runeword:Runeword9 | Bramble | 原版离线匹配已启用；仅部分行为已接入，不代表完整生成或全部属性生效 | {"Name":"Runeword9","Rune Name":"Bramble","complete":1,"itype1":"tors","*runes":"RalOhmSurEth","Rune1":"r08","Rune2":"r27","Rune3":"r29","Rune4":"r05","T1Code1":"balance2","T1Min1":50,"T1Max1":50,"T1Code2":"ac","T1Min2":300,"T1Max2":300,"T1Code3":"aura","T1Param3":"Thorns","T1Min3":15,"T1Max3":21,"T1Code4":"heal-kill","T1Min4":13,"T1Max4":13,"T1Code5":"extra-pois","T1Min5":25,"T1Max5":50,"T1Code6":"res-pois","T1Min6":100,"T1Max6":100,"T1Code7":"charged","T1Param7":"Spirit of Barbs","T1Min7":33,"T1Max7":13,"lineNumber":25} |
| runeword:Runeword10 | Brand | 服务器限定（server=1），原版离线匹配禁用；仅定义，未接入执行，属性处理仍不完整 | {"Name":"Runeword10","Rune Name":"Brand","complete":1,"server":1,"itype1":"miss","*runes":"JahLoMalGul","Rune1":"r31","Rune2":"r28","Rune3":"r23","Rune4":"r25","T1Code1":"dmg%","T1Min1":260,"T1Max1":340,"T1Code2":"dmg-demon","T1Min2":280,"T1Max2":330,"T1Code3":"hit-skill","T1Param3":"Bone Spear","T1Min3":100,"T1Max3":18,"T1Code4":"gethit-skill","T1Param4":"Amplify Damage","T1Min4":35,"T1Max4":14,"T1Code5":"knock","T1Min5":1,"T1Max5":1,"T1Code6":"noheal","T1Min6":1,"T1Max6":1,"T1Code7":"explosivearrow","T1Min7":15,"T1Max7":15,"lineNumber":77} |
| runeword:Runeword11 | Breath of the Dying | 原版离线匹配已启用；仅部分行为已接入，不代表完整生成或全部属性生效 | {"Name":"Runeword11","Rune Name":"Breath of the Dying","complete":1,"itype1":"weap","*runes":"VexHelElEldZodEth","Rune1":"r26","Rune2":"r15","Rune3":"r01","Rune4":"r02","Rune5":"r33","Rune6":"r05","T1Code1":"swing2","T1Min1":60,"T1Max1":60,"T1Code2":"dmg-undead","T1Min2":125,"T1Max2":125,"T1Code3":"lifesteal","T1Min3":12,"T1Max3":15,"T1Code4":"noheal","T1Min4":1,"T1Max4":1,"T1Code5":"kill-skill","T1Param5":"Poison Nova","T1Min5":50,"T1Max5":20,"T1Code6":"dmg%","T1Min6":350,"T1Max6":400,"T1Code7":"all-stats","T1Min7":30,"T1Max7":30,"lineNumber":26} |
| runeword:Runeword12 | Broken Promise | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword12","Rune Name":"Broken Promise","lineNumber":78} |
| runeword:Runeword13 | Call to Arms | 原版离线匹配已启用；仅部分行为已接入，不代表完整生成或全部属性生效 | {"Name":"Runeword13","Rune Name":"Call to Arms","complete":1,"itype1":"weap","*runes":"AmnRalMalIstOhm","Rune1":"r11","Rune2":"r08","Rune3":"r23","Rune4":"r24","Rune5":"r27","T1Code1":"swing2","T1Min1":40,"T1Max1":40,"T1Code2":"dmg%","T1Min2":200,"T1Max2":240,"T1Code3":"allskills","T1Min3":1,"T1Max3":1,"T1Code4":"oskill","T1Param4":"Battle Command","T1Min4":2,"T1Max4":6,"T1Code5":"oskill","T1Param5":"Battle Orders","T1Min5":1,"T1Max5":6,"T1Code6":"oskill","T1Param6":"Battle Cry","T1Min6":1,"T1Max6":4,"T1Code7":"regen","T1Min7":12,"T1Max7":12,"lineNumber":27} |
| runeword:Runeword15 | Chance | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword15","Rune Name":"Chance","lineNumber":79} |
| runeword:Runeword16 | Chaos | 原版离线匹配已启用；仅部分行为已接入，不代表完整生成或全部属性生效 | {"Name":"Runeword16","Rune Name":"Chaos","complete":1,"itype1":"h2h","*runes":"FalOhmUm","Rune1":"r19","Rune2":"r27","Rune3":"r22","T1Code1":"demon-heal","T1Min1":15,"T1Max1":15,"T1Code2":"dmg%","T1Min2":240,"T1Max2":290,"T1Code3":"dmg-mag","T1Min3":216,"T1Max3":471,"T1Code4":"oskill","T1Param4":"Whirlwind","T1Min4":1,"T1Max4":1,"T1Code5":"swing2","T1Min5":35,"T1Max5":35,"T1Code6":"hit-skill","T1Param6":"Frozen Orb","T1Min6":9,"T1Max6":11,"T1Code7":"hit-skill","T1Param7":"Charged Bolt","T1Min7":11,"T1Max7":9,"lineNumber":42} |
| runeword:Runeword17 | Crescent Moon | 原版离线匹配已启用；仅部分行为已接入，不代表完整生成或全部属性生效 | {"Name":"Runeword17","Rune Name":"Crescent Moon","complete":1,"itype1":"axe","itype2":"swor","itype3":"pole","*runes":"ShaelUmTir","Rune1":"r13","Rune2":"r22","Rune3":"r03","T1Code1":"pierce-ltng","T1Min1":35,"T1Max1":35,"T1Code2":"ignore-ac","T1Min2":1,"T1Max2":1,"T1Code3":"dmg%","T1Min3":180,"T1Max3":220,"T1Code4":"abs-mag","T1Min4":9,"T1Max4":11,"T1Code5":"charged","T1Param5":"Summon Spirit Wolf","T1Min5":30,"T1Max5":18,"T1Code6":"hit-skill","T1Param6":"Static Field","T1Min6":7,"T1Max6":13,"T1Code7":"hit-skill","T1Param7":"Chain Lightning","T1Min7":10,"T1Max7":17,"lineNumber":28} |
| runeword:Runeword18 | Darkness | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword18","Rune Name":"Darkness","lineNumber":81} |
| runeword:Runeword19 | Daylight | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword19","Rune Name":"Daylight","lineNumber":82} |
| runeword:Runeword20 | Death | 服务器限定（server=1），原版离线匹配禁用；仅定义，未接入执行，属性处理仍不完整 | {"Name":"Runeword20","Rune Name":"Death","complete":1,"server":1,"itype1":"swor","itype2":"axe","*runes":"HelElVexOrtGul","Rune1":"r15","Rune2":"r01","Rune3":"r26","Rune4":"r09","Rune5":"r25","T1Code1":"dmg%","T1Min1":300,"T1Max1":385,"T1Code2":"deadly/lvl","T1Param2":4,"T1Code3":"charged","T1Param3":"BloodGolem","T1Min3":15,"T1Max3":22,"T1Code4":"att-skill","T1Param4":"Glacial Spike","T1Min4":25,"T1Max4":18,"T1Code5":"death-skill","T1Param5":"Chain Lightning","T1Min5":100,"T1Max5":44,"T1Code6":"crush","T1Min6":50,"T1Max6":50,"T1Code7":"indestruct","T1Min7":1,"T1Max7":1,"lineNumber":83} |
| runeword:Runeword21 | Deception | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword21","Rune Name":"Deception","lineNumber":84} |
| runeword:Runeword22 | Delirium | 原版离线匹配已启用；仅部分行为已接入，不代表完整生成或全部属性生效 | {"Name":"Runeword22","Rune Name":"Delirium","complete":1,"itype1":"helm","*runes":"LemIstIo","Rune1":"r20","Rune2":"r24","Rune3":"r16","T1Code1":"hit-skill","T1Param1":"Confuse","T1Min1":11,"T1Max1":18,"T1Code2":"charged","T1Param2":"Attract","T1Min2":60,"T1Max2":17,"T1Code3":"gethit-skill","T1Param3":"Terror","T1Min3":14,"T1Max3":13,"T1Code4":"ac","T1Min4":261,"T1Max4":261,"T1Code5":"gethit-skill","T1Param5":"Mind Blast","T1Min5":6,"T1Max5":14,"T1Code6":"gethit-skill","T1Param6":"Delerium Change","T1Min6":1,"T1Max6":50,"T1Code7":"allskills","T1Min7":2,"T1Max7":2,"lineNumber":29} |
| runeword:Runeword23 | Desire | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword23","Rune Name":"Desire","lineNumber":85} |
| runeword:Runeword24 | Despair | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword24","Rune Name":"Despair","lineNumber":86} |
| runeword:Runeword32 | Destiny's Daughter | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword32","Rune Name":"Destiny's Daughter","lineNumber":87} |
| runeword:Runeword25 | Destruction | 服务器限定（server=1），原版离线匹配禁用；仅定义，未接入执行，属性处理仍不完整 | {"Name":"Runeword25","Rune Name":"Destruction","complete":1,"server":1,"itype1":"pole","itype2":"swor","*runes":"VexLoBerJahKo","Rune1":"r26","Rune2":"r28","Rune3":"r30","Rune4":"r31","Rune5":"r18","T1Code1":"dmg%","T1Min1":350,"T1Max1":350,"T1Code2":"dmg-mag","T1Min2":100,"T1Max2":180,"T1Code3":"hit-skill","T1Param3":"Molten Boulder","T1Min3":5,"T1Max3":23,"T1Code4":"death-skill","T1Param4":"Meteor","T1Min4":100,"T1Max4":45,"T1Code5":"att-skill","T1Param5":"Nova","T1Min5":15,"T1Max5":22,"T1Code6":"hit-skill","T1Param6":"Volcano","T1Min6":23,"T1Max6":12,"T1Code7":"noheal","T1Min7":1,"T1Max7":1,"lineNumber":88} |
| runeword:Runeword26 | Doom | 原版离线匹配已启用；仅部分行为已接入，不代表完整生成或全部属性生效 | {"Name":"Runeword26","Rune Name":"Doomsayer","complete":1,"itype1":"axe","itype2":"pole","itype3":"hamm","*runes":"HelOhmUmLoCham","Rune1":"r15","Rune2":"r27","Rune3":"r22","Rune4":"r28","Rune5":"r32","T1Code1":"dmg%","T1Min1":280,"T1Max1":320,"T1Code2":"aura","T1Param2":"Holy Freeze","T1Min2":12,"T1Max2":12,"T1Code3":"swing2","T1Min3":45,"T1Max3":45,"T1Code4":"noheal","T1Min4":1,"T1Max4":1,"T1Code5":"pierce-cold","T1Min5":40,"T1Max5":60,"T1Code6":"allskills","T1Min6":2,"T1Max6":2,"T1Code7":"hit-skill","T1Param7":"Volcano","T1Min7":5,"T1Max7":18,"lineNumber":30} |
| runeword:Runeword27 | Dragon | 服务器限定（server=1），原版离线匹配禁用；仅定义，未接入执行，属性处理仍不完整 | {"Name":"Runeword27","Rune Name":"Dragon","complete":1,"server":1,"itype1":"tors","itype2":"shld","*runes":"SurLoSol","Rune1":"r29","Rune2":"r28","Rune3":"r12","T1Code1":"ac","T1Min1":360,"T1Max1":360,"T1Code2":"ac-miss","T1Min2":230,"T1Max2":230,"T1Code3":"str/lvl","T1Param3":3,"T1Code4":"hit-skill","T1Param4":"Hydra","T1Min4":12,"T1Max4":15,"T1Code5":"gethit-skill","T1Param5":"Venom","T1Min5":20,"T1Max5":18,"T1Code6":"aura","T1Param6":"Holy Fire","T1Min6":14,"T1Max6":14,"T1Code7":"all-stats","T1Min7":3,"T1Max7":5,"lineNumber":89} |
| runeword:Runeword28 | Dread | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword28","Rune Name":"Dread","lineNumber":90} |
| runeword:Runeword29 | Dream | 服务器限定（server=1），原版离线匹配禁用；仅定义，未接入执行，属性处理仍不完整 | {"Name":"Runeword29","Rune Name":"Dream","complete":1,"server":1,"itype1":"helm","itype2":"shld","*runes":"IoJahPul","Rune1":"r16","Rune2":"r31","Rune3":"r21","T1Code1":"ac","T1Min1":150,"T1Max1":220,"T1Code2":"gethit-skill","T1Param2":"Confuse","T1Min2":10,"T1Max2":15,"T1Code3":"mana/lvl","T1Param3":5,"T1Code4":"res-all","T1Min4":5,"T1Max4":20,"T1Code5":"balance3","T1Min5":20,"T1Max5":30,"T1Code6":"aura","T1Param6":"Holy Shock","T1Min6":15,"T1Max6":15,"T1Code7":"mag%","T1Min7":12,"T1Max7":25,"lineNumber":91} |
| runeword:Runeword30 | Duress | 原版离线匹配已启用；仅部分行为已接入，不代表完整生成或全部属性生效 | {"Name":"Runeword30","Rune Name":"Duress","complete":1,"itype1":"tors","*runes":"ShaelUmThul","Rune1":"r13","Rune2":"r22","Rune3":"r10","T1Code1":"dmg-cold","T1Param1":50,"T1Min1":37,"T1Max1":133,"T1Code2":"dmg%","T1Min2":10,"T1Max2":20,"T1Code3":"ac%","T1Min3":150,"T1Max3":200,"T1Code4":"balance2","T1Min4":20,"T1Max4":20,"T1Code5":"openwounds","T1Min5":33,"T1Max5":33,"T1Code6":"crush","T1Min6":15,"T1Max6":15,"T1Code7":"stamdrain","T1Min7":-20,"T1Max7":-20,"lineNumber":53} |
| runeword:Runeword56 | Dweomer | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword56","Rune Name":"Dweomer","lineNumber":92} |
| runeword:Runeword31 | Edge | 重制版离线边缘覆盖已启用（原始 server=1）；仅部分行为已接入，不代表完整生成或全部属性生效 | {"Name":"Runeword31","Rune Name":"Edge","complete":1,"server":1,"itype1":"miss","*runes":"TirTalAmn","Rune1":"r03","Rune2":"r07","Rune3":"r11","T1Code1":"dmg-demon","T1Min1":320,"T1Max1":380,"T1Code2":"dmg-undead","T1Min2":280,"T1Max2":280,"T1Code3":"swing2","T1Min3":35,"T1Max3":35,"T1Code4":"noheal","T1Min4":1,"T1Max4":1,"T1Code5":"aura","T1Param5":"Thorns","T1Min5":15,"T1Max5":15,"T1Code6":"all-stats","T1Min6":5,"T1Max6":10,"T1Code7":"cheap","T1Min7":15,"T1Max7":15,"lineNumber":93} |
| runeword:Runeword33 | Enigma | 原版离线匹配已启用；仅部分行为已接入，不代表完整生成或全部属性生效 | {"Name":"Runeword33","Rune Name":"Enigma","complete":1,"itype1":"tors","*runes":"JahIthBer","Rune1":"r31","Rune2":"r06","Rune3":"r30","T1Code1":"ac","T1Min1":750,"T1Max1":775,"T1Code2":"heal-kill","T1Min2":14,"T1Max2":14,"T1Code3":"move2","T1Min3":45,"T1Max3":45,"T1Code4":"str/lvl","T1Param4":6,"T1Code5":"allskills","T1Min5":2,"T1Max5":2,"T1Code6":"mag%/lvl","T1Param6":8,"T1Code7":"oskill","T1Param7":"Teleport","T1Min7":1,"T1Max7":1,"lineNumber":31} |
| runeword:Runeword34 | Enlightenment | 原版离线匹配已启用；仅部分行为已接入，不代表完整生成或全部属性生效 | {"Name":"Runeword34","Rune Name":"Enlightenment","complete":1,"itype1":"tors","*runes":"PulRalSur","Rune1":"r21","Rune2":"r08","Rune3":"r12","T1Code1":"hit-skill","T1Param1":"Fire Ball","T1Min1":5,"T1Max1":15,"T1Code2":"gethit-skill","T1Param2":"Blaze","T1Min2":5,"T1Max2":15,"T1Code3":"sor","T1Min3":2,"T1Max3":2,"T1Code4":"oskill","T1Param4":"Warmth","T1Min4":1,"T1Max4":1,"lineNumber":94} |
| runeword:Runeword35 | Envy | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword35","Rune Name":"Envy","lineNumber":95} |
| runeword:Runeword36 | Eternity | 原版离线匹配已启用；仅部分行为已接入，不代表完整生成或全部属性生效 | {"Name":"Runeword36","Rune Name":"Eternity","complete":1,"itype1":"mele","*runes":"AmnBerIstSolSur","Rune1":"r11","Rune2":"r30","Rune3":"r24","Rune4":"r12","Rune5":"r29","T1Code1":"dmg%","T1Min1":260,"T1Max1":310,"T1Code2":"indestruct","T1Min2":1,"T1Max2":1,"T1Code3":"slow","T1Min3":33,"T1Max3":33,"T1Code4":"charged","T1Param4":"Revive","T1Min4":88,"T1Max4":8,"T1Code5":"regen","T1Min5":16,"T1Max5":16,"T1Code6":"regen-mana","T1Min6":16,"T1Max6":16,"T1Code7":"nofreeze","T1Min7":1,"T1Max7":1,"lineNumber":33} |
| runeword:Runeword37 | Exile | 原版离线匹配已启用；仅部分行为已接入，不代表完整生成或全部属性生效 | {"Name":"Runeword37","Rune Name":"Exile's Path","complete":1,"itype1":"pala","*runes":"VexOhmIstDol","Rune1":"r26","Rune2":"r27","Rune3":"r24","Rune4":"r14","T1Code1":"block2","T1Min1":30,"T1Max1":30,"T1Code2":"freeze","T1Min2":1,"T1Max2":1,"T1Code3":"ac%","T1Min3":220,"T1Max3":260,"T1Code4":"aura","T1Param4":"Defiance","T1Min4":13,"T1Max4":16,"T1Code5":"skilltab","T1Param5":10,"T1Min5":2,"T1Max5":2,"T1Code6":"hit-skill","T1Param6":"Life Tap","T1Min6":15,"T1Max6":5,"T1Code7":"rep-dur","T1Param7":25,"lineNumber":34} |
| runeword:Runeword38 | Faith | 服务器限定（server=1），原版离线匹配禁用；仅定义，未接入执行，属性处理仍不完整 | {"Name":"Runeword38","Rune Name":"Faith","complete":1,"server":1,"itype1":"miss","*runes":"OhmJahLemEld","Rune1":"r27","Rune2":"r31","Rune3":"r20","Rune4":"r02","T1Code1":"dmg%","T1Min1":280,"T1Max1":280,"T1Code2":"att%","T1Min2":300,"T1Max2":300,"T1Code3":"dmg-fire","T1Min3":120,"T1Max3":120,"T1Code4":"res-all","T1Min4":15,"T1Max4":15,"T1Code5":"aura","T1Param5":"fanaticism","T1Min5":12,"T1Max5":15,"T1Code6":"reanimate","T1Param6":1,"T1Min6":10,"T1Max6":10,"T1Code7":"allskills","T1Min7":1,"T1Max7":2,"lineNumber":70} |
| runeword:Runeword39 | Famine | 原版离线匹配已启用；仅部分行为已接入，不代表完整生成或全部属性生效 | {"Name":"Runeword39","Rune Name":"Famine","complete":1,"itype1":"axe","itype2":"hamm","*runes":"FalOhmOrtJah","Rune1":"r19","Rune2":"r27","Rune3":"r09","Rune4":"r31","T1Code1":"dmg%","T1Min1":270,"T1Max1":320,"T1Code2":"lifesteal","T1Min2":12,"T1Max2":12,"T1Code3":"swing2","T1Min3":30,"T1Max3":30,"T1Code4":"noheal","T1Min4":1,"T1Max4":1,"T1Code5":"dmg-mag","T1Min5":180,"T1Max5":200,"T1Code6":"dmg-elem","T1Param6":100,"T1Min6":50,"T1Max6":200,"T1Code7":"ethereal","T1Min7":1,"T1Max7":1,"lineNumber":35} |
| runeword:Runeword40 | Flickering Flame | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword40","Rune Name":"Flickering Flame","lineNumber":65} |
| runeword:Runeword41 | Fortitude | 服务器限定（server=1），原版离线匹配禁用；仅定义，未接入执行，属性处理仍不完整 | {"Name":"Runeword41","Rune Name":"Fortitude","complete":1,"server":1,"itype1":"weap","itype2":"tors","*runes":"ElSolDolLo","Rune1":"r01","Rune2":"r12","Rune3":"r14","Rune4":"r28","T1Code1":"ac%","T1Min1":200,"T1Max1":200,"T1Code2":"dmg%","T1Min2":300,"T1Max2":300,"T1Code3":"cast3","T1Min3":25,"T1Max3":25,"T1Code4":"gethit-skill","T1Param4":"Chilling Armor","T1Min4":20,"T1Max4":15,"T1Code5":"dmg-to-mana","T1Min5":12,"T1Max5":12,"T1Code6":"hp/lvl","T1Min6":8,"T1Max6":12,"T1Code7":"res-all","T1Min7":25,"T1Max7":30,"lineNumber":66} |
| runeword:Runeword42 | Fortune's Favor | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword42","Rune Name":"Fortune's Favor","lineNumber":67} |
| runeword:Runeword44 | Fury | 原版离线匹配已启用；仅部分行为已接入，不代表完整生成或全部属性生效 | {"Name":"Runeword44","Rune Name":"Fury","complete":1,"itype1":"mele","Rune1":"r31","Rune2":"r25","Rune3":"r05","T1Code1":"dmg%","T1Min1":209,"T1Max1":209,"T1Code2":"swing2","T1Min2":40,"T1Max2":40,"T1Code3":"noheal","T1Min3":1,"T1Max3":1,"T1Code4":"openwounds","T1Min4":66,"T1Max4":66,"T1Code5":"lifesteal","T1Min5":6,"T1Max5":6,"T1Code6":"deadly","T1Min6":33,"T1Max6":33,"T1Code7":"skill","T1Param7":147,"T1Min7":5,"T1Max7":5,"lineNumber":2} |
| runeword:Runeword45 | Gloom | 原版离线匹配已启用；仅部分行为已接入，不代表完整生成或全部属性生效 | {"Name":"Runeword45","Rune Name":"Gloom","complete":1,"itype1":"tors","*runes":"FalUmPul","Rune1":"r19","Rune2":"r22","Rune3":"r21","T1Code1":"ac%","T1Min1":170,"T1Max1":230,"T1Code2":"res-all","T1Min2":30,"T1Max2":30,"T1Code3":"gethit-skill","T1Param3":"Dim Vision","T1Min3":15,"T1Max3":3,"T1Code4":"balance2","T1Min4":10,"T1Max4":10,"T1Code5":"dmg-to-mana","T1Min5":5,"T1Max5":5,"T1Code6":"light","T1Min6":-3,"T1Max6":-3,"T1Code7":"half-freeze","T1Min7":1,"T1Max7":1,"lineNumber":40} |
| runeword:Runeword46 | Glory | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword46","Rune Name":"Glory","lineNumber":69} |
| runeword:Runeword48 | Hand of Justice | 原版离线匹配已启用；仅部分行为已接入，不代表完整生成或全部属性生效 | {"Name":"Runeword48","Rune Name":"Hand of Justice","complete":1,"itype1":"weap","*runes":"SurChamAmnLo","Rune1":"r29","Rune2":"r32","Rune3":"r11","Rune4":"r28","T1Code1":"swing2","T1Min1":33,"T1Max1":33,"T1Code2":"dmg%","T1Min2":280,"T1Max2":330,"T1Code3":"aura","T1Param3":"Holy Fire","T1Min3":16,"T1Max3":16,"T1Code4":"levelup-skill","T1Param4":"Blaze","T1Min4":100,"T1Max4":36,"T1Code5":"death-skill","T1Param5":"Meteor","T1Min5":100,"T1Max5":48,"T1Code6":"ignore-ac","T1Min6":1,"T1Max6":1,"T1Code7":"pierce-fire","T1Min7":20,"T1Max7":20,"lineNumber":36} |
| runeword:Runeword49 | Harmony | 服务器限定（server=1），原版离线匹配禁用；仅定义，未接入执行，属性处理仍不完整 | {"Name":"Runeword49","Rune Name":"Harmony","complete":1,"server":1,"itype1":"miss","*runes":"TirIthSolKo","Rune1":"r03","Rune2":"r06","Rune3":"r12","Rune4":"r18","T1Code1":"dmg%","T1Min1":200,"T1Max1":275,"T1Code2":"dmg-elem","T1Min2":55,"T1Max2":160,"T1Code3":"charged","T1Param3":"Revive","T1Min3":25,"T1Max3":20,"T1Code4":"aura","T1Param4":"Vigor","T1Min4":10,"T1Max4":10,"T1Code5":"oskill","T1Param5":"Valkyrie","T1Min5":2,"T1Max5":6,"T1Code6":"regen-mana","T1Min6":20,"T1Max6":20,"T1Code7":"light","T1Min7":2,"T1Max7":2,"lineNumber":63} |
| runeword:Runeword50 | Hatred | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword50","Rune Name":"Hatred","lineNumber":64} |
| runeword:Runeword51 | Heart of the Oak | 原版离线匹配已启用；仅部分行为已接入，不代表完整生成或全部属性生效 | {"Name":"Runeword51","Rune Name":"Heart of the Oak","complete":1,"itype1":"staf","itype2":"mace","*runes":"KoVexPulThul","Rune1":"r18","Rune2":"r26","Rune3":"r21","Rune4":"r10","T1Code1":"cast2","T1Min1":40,"T1Max1":40,"T1Code2":"charged","T1Param2":"Oak Sage","T1Min2":25,"T1Max2":4,"T1Code3":"mana%","T1Min3":15,"T1Max3":15,"T1Code4":"allskills","T1Min4":3,"T1Max4":3,"T1Code5":"regen","T1Min5":20,"T1Max5":20,"T1Code6":"res-all","T1Min6":30,"T1Max6":40,"T1Code7":"charged","T1Param7":"Raven","T1Min7":60,"T1Max7":14,"lineNumber":37} |
| runeword:Runeword52 | Heaven's Will | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword52","Rune Name":"Heaven's Will","lineNumber":96} |
| runeword:Runeword53 | Holy Tears | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword53","Rune Name":"Holy Tears","lineNumber":97} |
| runeword:Runeword54 | Holy Thunder | 原版离线匹配已启用；仅部分行为已接入，不代表完整生成或全部属性生效 | {"Name":"Runeword54","Rune Name":"Holy Thunder","complete":1,"itype1":"scep","Rune1":"r05","Rune2":"r08","Rune3":"r09","Rune4":"r07","T1Code1":"dmg%","T1Min1":60,"T1Max1":60,"T1Code2":"dmg-ltng","T1Min2":20,"T1Max2":60,"T1Code3":"dmg-max","T1Min3":10,"T1Max3":10,"T1Code4":"res-ltng","T1Min4":60,"T1Max4":60,"T1Code5":"res-ltng-max","T1Min5":5,"T1Max5":5,"T1Code6":"skill","T1Param6":118,"T1Min6":3,"T1Max6":3,"T1Code7":"charged","T1Param7":53,"T1Min7":60,"T1Max7":7,"lineNumber":3} |
| runeword:Runeword55 | Honor | 原版离线匹配已启用；仅部分行为已接入，不代表完整生成或全部属性生效 | {"Name":"Runeword55","Rune Name":"Honor","complete":1,"itype1":"mele","Rune1":"r11","Rune2":"r01","Rune3":"r06","Rune4":"r03","Rune5":"r12","T1Code1":"dmg%","T1Min1":160,"T1Max1":160,"T1Code2":"regen","T1Min2":10,"T1Max2":10,"T1Code3":"allskills","T1Min3":1,"T1Max3":1,"T1Code4":"att","T1Min4":200,"T1Max4":200,"T1Code5":"deadly","T1Min5":25,"T1Max5":25,"T1Code6":"str","T1Min6":10,"T1Max6":10,"lineNumber":4} |
| runeword:Runeword57 | Humility | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword57","Rune Name":"Humility","lineNumber":98} |
| runeword:Runeword58 | Hunger | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword58","Rune Name":"Hunger","lineNumber":99} |
| runeword:Runeword59 | Ice | 服务器限定（server=1），原版离线匹配禁用；仅定义，未接入执行，属性处理仍不完整 | {"Name":"Runeword59","Rune Name":"Ice","complete":1,"server":1,"itype1":"miss","*runes":"AmnShaelJahLo","Rune1":"r11","Rune2":"r13","Rune3":"r31","Rune4":"r28","T1Code1":"dmg%","T1Min1":140,"T1Max1":210,"T1Code2":"aura","T1Param2":"Holy Freeze","T1Min2":18,"T1Max2":18,"T1Code3":"extra-cold","T1Min3":25,"T1Max3":30,"T1Code4":"hit-skill","T1Param4":"Frost Nova","T1Min4":25,"T1Max4":22,"T1Code5":"levelup-skill","T1Param5":"Blizzard","T1Min5":100,"T1Max5":40,"T1Code6":"pierce-cold","T1Min6":20,"T1Max6":20,"T1Code7":"gold%/lvl","T1Param7":25,"lineNumber":100} |
| runeword:Runeword60 | Infinity | 服务器限定（server=1），原版离线匹配禁用；仅定义，未接入执行，属性处理仍不完整 | {"Name":"Runeword60","Rune Name":null,"complete":1,"server":1,"itype1":"pole","*runes":"BerMalBerIst","Rune1":"r30","Rune2":"r23","Rune3":"r30","Rune4":"r24","T1Code1":"dmg%","T1Min1":255,"T1Max1":325,"T1Code2":"move3","T1Min2":35,"T1Max2":35,"T1Code3":"vit/lvl","T1Param3":4,"T1Code4":"aura","T1Param4":"Conviction","T1Min4":12,"T1Max4":12,"T1Code5":"kill-skill","T1Param5":"Chain Lightning","T1Min5":50,"T1Max5":20,"T1Code6":"pierce-ltng","T1Min6":45,"T1Max6":55,"T1Code7":"charged","T1Param7":"Cyclone Armor","T1Min7":30,"T1Max7":21,"lineNumber":101} |
| runeword:Runeword61 | Innocence | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword61","Rune Name":"Innocence","lineNumber":102} |
| runeword:Runeword62 | Insight | 服务器限定（server=1），原版离线匹配禁用；仅定义，未接入执行，属性处理仍不完整 | {"Name":"Runeword62","Rune Name":"Insight","complete":1,"server":1,"itype1":"pole","itype2":"staf","*runes":"RalTirTalSol","Rune1":"r08","Rune2":"r03","Rune3":"r07","Rune4":"r12","T1Code1":"dmg%","T1Min1":200,"T1Max1":260,"T1Code2":"att%","T1Min2":180,"T1Max2":250,"T1Code3":"mag%","T1Min3":23,"T1Max3":23,"T1Code4":"oskill","T1Param4":"Critical Strike","T1Min4":1,"T1Max4":6,"T1Code5":"cast2","T1Min5":35,"T1Max5":35,"T1Code6":"aura","T1Param6":"Meditation","T1Min6":12,"T1Max6":17,"T1Code7":"all-stats","T1Min7":5,"T1Max7":5,"lineNumber":103} |
| runeword:Runeword63 | Jealousy | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword63","Rune Name":"Jealousy","lineNumber":104} |
| runeword:Runeword64 | Judgment | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword64","Rune Name":"Judgment","lineNumber":105} |
| runeword:Runeword65 | King's Grace | 原版离线匹配已启用；仅部分行为已接入，不代表完整生成或全部属性生效 | {"Name":"Runeword65","Rune Name":"King's Grace","complete":1,"itype1":"swor","itype2":"scep","Rune1":"r11","Rune2":"r08","Rune3":"r10","T1Code1":"dmg%","T1Min1":100,"T1Max1":100,"T1Code2":"att","T1Min2":150,"T1Max2":150,"T1Code3":"dmg-demon","T1Min3":100,"T1Max3":100,"T1Code4":"dmg-undead","T1Min4":50,"T1Max4":50,"T1Code5":"att-demon","T1Min5":100,"T1Max5":100,"T1Code6":"att-undead","T1Min6":100,"T1Max6":100,"lineNumber":5} |
| runeword:Runeword66 | Kingslayer | 原版离线匹配已启用；仅部分行为已接入，不代表完整生成或全部属性生效 | {"Name":"Runeword66","Rune Name":"Kingslayer","complete":1,"itype1":"swor","itype2":"axe","*runes":"MalUmGulFal","Rune1":"r23","Rune2":"r22","Rune3":"r25","Rune4":"r19","T1Code1":"swing2","T1Min1":30,"T1Max1":30,"T1Code2":"dmg%","T1Min2":230,"T1Max2":270,"T1Code3":"reduce-ac","T1Min3":25,"T1Max3":25,"T1Code4":"crush","T1Min4":33,"T1Max4":33,"T1Code5":"openwounds","T1Min5":25,"T1Max5":25,"T1Code6":"oskill","T1Param6":"Vengeance","T1Min6":1,"T1Max6":1,"T1Code7":"gold%","T1Min7":40,"T1Max7":40,"lineNumber":38} |
| runeword:Runeword67 | Knight's Vigil | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword67","Rune Name":"Knight's Vigil","lineNumber":106} |
| runeword:Runeword69 | Last Wish | 服务器限定（server=1），原版离线匹配禁用；仅定义，未接入执行，属性处理仍不完整 | {"Name":"Runeword69","Rune Name":"Last Wish","complete":1,"server":1,"itype1":"swor","itype2":"hamm","itype3":"axe","*runes":"JahMalJahSurJahBer","Rune1":"r31","Rune2":"r23","Rune3":"r31","Rune4":"r29","Rune5":"r31","Rune6":"r30","T1Code1":"dmg%","T1Min1":330,"T1Max1":375,"T1Code2":"att-skill","T1Param2":"Charged Bolt","T1Min2":20,"T1Max2":20,"T1Code3":"hit-skill","T1Param3":"Life Tap","T1Min3":10,"T1Max3":18,"T1Code4":"gethit-skill","T1Param4":"Fade","T1Min4":6,"T1Max4":11,"T1Code5":"crush","T1Min5":40,"T1Max5":50,"T1Code6":"mag%/lvl","T1Param6":4,"T1Code7":"aura","T1Param7":"Might","T1Min7":17,"T1Max7":17,"lineNumber":107} |
| runeword:Runeword70 | Law | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword70","Rune Name":"Law","lineNumber":108} |
| runeword:Runeword71 | Lawbringer | 服务器限定（server=1），原版离线匹配禁用；仅定义，未接入执行，属性处理仍不完整 | {"Name":"Runeword71","Rune Name":"Lawbringer","complete":1,"server":1,"itype1":"swor","itype2":"hamm","itype3":"scep","*runes":"AmnLemKo","Rune1":"r11","Rune2":"r20","Rune3":"r18","T1Code1":"dmg-cold","T1Min1":130,"T1Max1":180,"T1Code2":"dmg-fire","T1Min2":150,"T1Max2":210,"T1Code3":"aura","T1Param3":"Sanctuary","T1Min3":16,"T1Max3":18,"T1Code4":"hit-skill","T1Param4":"Decrepify","T1Min4":20,"T1Max4":15,"T1Code5":"ac-miss","T1Min5":200,"T1Max5":250,"T1Code6":"rip","T1Min6":1,"T1Max6":1,"T1Code7":"reduce-ac","T1Min7":50,"T1Max7":50,"lineNumber":109} |
| runeword:Runeword72 | Leaf | 原版离线匹配已启用；仅部分行为已接入，不代表完整生成或全部属性生效 | {"Name":"Runeword72","Rune Name":"Leaf","complete":1,"itype1":"staf","Rune1":"r03","Rune2":"r08","T1Code1":"fireskill","T1Min1":3,"T1Max1":3,"T1Code2":"ac/lvl","T1Min2":16,"T1Max2":16,"T1Code3":"res-cold","T1Min3":33,"T1Max3":33,"T1Code4":"skill","T1Param4":41,"T1Min4":3,"T1Max4":3,"T1Code5":"skill","T1Param5":36,"T1Min5":3,"T1Max5":3,"T1Code6":"skill","T1Param6":37,"T1Min6":3,"T1Max6":3,"lineNumber":6} |
| runeword:Runeword73 | Lightning | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword73","Rune Name":"Lightning","lineNumber":110} |
| runeword:Runeword74 | Lionheart | 原版离线匹配已启用；仅部分行为已接入，不代表完整生成或全部属性生效 | {"Name":"Runeword74","Rune Name":"Lionheart","complete":1,"itype1":"tors","Rune1":"r15","Rune2":"r17","Rune3":"r19","T1Code1":"str","T1Min1":15,"T1Max1":15,"T1Code2":"vit","T1Min2":20,"T1Max2":20,"T1Code3":"dex","T1Min3":15,"T1Max3":15,"T1Code4":"dmg%","T1Min4":20,"T1Max4":20,"T1Code5":"hp","T1Min5":50,"T1Max5":50,"T1Code6":"res-all","T1Min6":30,"T1Max6":30,"lineNumber":7} |
| runeword:Runeword75 | Lore | 原版离线匹配已启用；仅部分行为已接入，不代表完整生成或全部属性生效 | {"Name":"Runeword75","Rune Name":"Lore","complete":1,"itype1":"helm","Rune1":"r09","Rune2":"r12","T1Code1":"enr","T1Min1":10,"T1Max1":10,"T1Code2":"allskills","T1Min2":1,"T1Max2":1,"T1Code3":"light","T1Min3":2,"T1Max3":2,"T1Code4":"mana-kill","T1Min4":2,"T1Max4":2,"lineNumber":8} |
| runeword:Runeword77 | Loyalty | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword77","Rune Name":"Loyalty","lineNumber":111} |
| runeword:Runeword78 | Lust | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword78","Rune Name":"Lust","lineNumber":112} |
| runeword:Runeword79 | Madness | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword79","Rune Name":"Madness","lineNumber":113} |
| runeword:Runeword81 | Malice | 原版离线匹配已启用；仅部分行为已接入，不代表完整生成或全部属性生效 | {"Name":"Runeword81","Rune Name":"Malice","complete":1,"itype1":"mele","Rune1":"r06","Rune2":"r01","Rune3":"r05","T1Code1":"openwounds","T1Min1":100,"T1Max1":100,"T1Code2":"dmg-ac","T1Min2":-100,"T1Max2":-100,"T1Code3":"noheal","T1Min3":1,"T1Max3":1,"T1Code4":"dmg%","T1Min4":33,"T1Max4":33,"T1Code5":"light","T1Min5":-1,"T1Max5":-1,"T1Code6":"regen","T1Min6":-5,"T1Max6":-5,"lineNumber":9} |
| runeword:Runeword82 | Melody | 原版离线匹配已启用；仅部分行为已接入，不代表完整生成或全部属性生效 | {"Name":"Runeword82","Rune Name":"Melody","complete":1,"itype1":"miss","Rune1":"r13","Rune2":"r18","Rune3":"r04","T1Code1":"dmg%","T1Min1":50,"T1Max1":50,"T1Code2":"skilltab","T1Min2":3,"T1Max2":3,"T1Code3":"skill","T1Param3":9,"T1Min3":3,"T1Max3":3,"T1Code4":"skill","T1Param4":13,"T1Min4":3,"T1Max4":3,"T1Code5":"skill","T1Param5":17,"T1Min5":3,"T1Max5":3,"T1Code6":"dmg-undead","T1Min6":300,"T1Max6":300,"lineNumber":10} |
| runeword:Runeword83 | Memory | 原版离线匹配已启用；仅部分行为已接入，不代表完整生成或全部属性生效 | {"Name":"Runeword83","Rune Name":"Memory","complete":1,"itype1":"staf","Rune1":"r17","Rune2":"r16","Rune3":"r12","Rune4":"r05","T1Code1":"mana%","T1Min1":20,"T1Max1":20,"T1Code2":"red-mag","T1Min2":7,"T1Max2":7,"T1Code3":"ac%","T1Min3":50,"T1Max3":50,"T1Code4":"cast2","T1Min4":33,"T1Max4":33,"T1Code5":"sor","T1Min5":3,"T1Max5":3,"T1Code6":"skill","T1Param6":58,"T1Min6":3,"T1Max6":3,"T1Code7":"skill","T1Param7":42,"T1Min7":2,"T1Max7":2,"lineNumber":11} |
| runeword:Runeword84 | Mist | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword84","Rune Name":"Mist","lineNumber":114} |
| runeword:Runeword85 | Morning Dew | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword85","Rune Name":"Morning Dew","lineNumber":115} |
| runeword:Runeword86 | Mystery | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword86","Rune Name":"Mystery","lineNumber":116} |
| runeword:Runeword87 | Myth | 原版离线匹配已启用；仅部分行为已接入，不代表完整生成或全部属性生效 | {"Name":"Runeword87","Rune Name":"Myth","complete":1,"itype1":"tors","*runes":"HelAmnNef","Rune1":"r15","Rune2":"r11","Rune3":"r04","T1Code1":"hit-skill","T1Param1":"Taunt","T1Min1":10,"T1Max1":1,"T1Code2":"gethit-skill","T1Param2":"Howl","T1Min2":3,"T1Max2":1,"T1Code3":"bar","T1Min3":2,"T1Max3":2,"T1Code4":"regen","T1Min4":10,"T1Max4":10,"lineNumber":117} |
| runeword:Runeword88 | Nadir | 原版离线匹配已启用；仅部分行为已接入，不代表完整生成或全部属性生效 | {"Name":"Runeword88","Rune Name":"Nadir","complete":1,"itype1":"helm","Rune1":"r04","Rune2":"r03","T1Code1":"ac%","T1Min1":50,"T1Max1":50,"T1Code2":"ac","T1Min2":10,"T1Max2":10,"T1Code3":"light","T1Min3":-3,"T1Max3":-3,"T1Code4":"charged","T1Param4":264,"T1Min4":9,"T1Max4":13,"T1Code5":"gold%","T1Min5":-33,"T1Max5":-33,"T1Code6":"str","T1Min6":5,"T1Max6":5,"lineNumber":12} |
| runeword:Runeword89 | Nature's Kingdom | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword89","Rune Name":"Nature's Kingdom","lineNumber":68} |
| runeword:Runeword90 | Nightfall | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword90","Rune Name":"Nightfall","lineNumber":58} |
| runeword:Runeword91 | Oath | 服务器限定（server=1），原版离线匹配禁用；仅定义，未接入执行，属性处理仍不完整 | {"Name":"Runeword91","Rune Name":"Oath","complete":1,"server":1,"itype1":"swor","itype2":"axe","itype3":"mace","*runes":"ShaelPulMalLum","Rune1":"r13","Rune2":"r21","Rune3":"r23","Rune4":"r17","T1Code1":"dmg%","T1Min1":210,"T1Max1":340,"T1Code2":"swing1","T1Min2":30,"T1Max2":30,"T1Code3":"hit-skill","T1Param3":"Bone Spirit","T1Min3":30,"T1Max3":20,"T1Code4":"charged","T1Param4":"IronGolem","T1Min4":14,"T1Max4":17,"T1Code5":"charged","T1Param5":"Heart of Wolverine","T1Min5":20,"T1Max5":16,"T1Code6":"abs-mag","T1Min6":10,"T1Max6":15,"T1Code7":"indestruct","T1Min7":1,"T1Max7":1,"lineNumber":59} |
| runeword:Runeword92 | Obedience | 服务器限定（server=1），原版离线匹配禁用；仅定义，未接入执行，属性处理仍不完整 | {"Name":"Runeword92","Rune Name":"Obedience","complete":1,"server":1,"itype1":"pole","*runes":"HelKoThulEthFal","Rune1":"r15","Rune2":"r18","Rune3":"r10","Rune4":"r05","Rune5":"r19","T1Code1":"dmg%","T1Min1":370,"T1Max1":370,"T1Code2":"crush","T1Min2":40,"T1Max2":40,"T1Code3":"kill-skill","T1Param3":"enchant","T1Min3":30,"T1Max3":21,"T1Code4":"pierce-fire","T1Min4":25,"T1Max4":25,"T1Code5":"ac","T1Min5":200,"T1Max5":300,"T1Code6":"balance3","T1Min6":40,"T1Max6":40,"T1Code7":"res-all","T1Min7":20,"T1Max7":30,"lineNumber":60} |
| runeword:Runeword93 | Oblivion | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword93","Rune Name":"Oblivion","lineNumber":61} |
| runeword:Runeword94 | Obsession | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword94","Rune Name":"Obsession","lineNumber":62} |
| runeword:Runeword95 | Passion | 原版离线匹配已启用；仅部分行为已接入，不代表完整生成或全部属性生效 | {"Name":"Runeword95","Rune Name":"Passion","complete":1,"itype1":"weap","*runes":"DolOrtEldLem","Rune1":"r14","Rune2":"r09","Rune3":"r02","Rune4":"r20","T1Code1":"dmg%","T1Min1":160,"T1Max1":210,"T1Code2":"oskill","T1Param2":"Zeal","T1Min2":1,"T1Max2":1,"T1Code3":"att%","T1Min3":50,"T1Max3":80,"T1Code4":"oskill","T1Param4":"Berserk","T1Min4":1,"T1Max4":1,"T1Code5":"swing2","T1Min5":25,"T1Max5":25,"T1Code6":"charged","T1Param6":"Heart of Wolverine","T1Min6":12,"T1Max6":3,"T1Code7":"stupidity","T1Min7":10,"T1Max7":10,"lineNumber":39} |
| runeword:Runeword95:118 | Patience | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword95","Rune Name":"Patience","lineNumber":118} |
| runeword:Runeword97 | Pattern | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword97","Rune Name":"Pattern","itype1":"h2h","Rune1":"r07","Rune2":"r09","Rune3":"r03","T1Code1":"att%","T1Min1":10,"T1Max1":10,"T1Code2":"dmg%","T1Min2":40,"T1Max2":80,"T1Code3":"dmg-fire","T1Min3":12,"T1Max3":32,"T1Code4":"res-all","T1Min4":15,"T1Max4":15,"T1Code5":"str","T1Min5":6,"T1Max5":6,"T1Code6":"dex","T1Min6":6,"T1Max6":6,"T1Code7":"block2","T1Min7":30,"T1Max7":30,"lineNumber":119} |
| runeword:Runeword98 | Peace | 原版离线匹配已启用；仅部分行为已接入，不代表完整生成或全部属性生效 | {"Name":"Runeword98","Rune Name":"Peace","complete":1,"itype1":"tors","*runes":"ShaelThulAmn","Rune1":"r13","Rune2":"r10","Rune3":"r11","T1Code1":"hit-skill","T1Param1":"Valkyrie","T1Min1":2,"T1Max1":15,"T1Code2":"gethit-skill","T1Param2":"Slow Missiles","T1Min2":4,"T1Max2":5,"T1Code3":"ama","T1Min3":2,"T1Max3":2,"T1Code4":"oskill","T1Param4":"Critical Strike","T1Min4":2,"T1Max4":2,"lineNumber":120} |
| runeword:Runeword100 | Penitence | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword100","Rune Name":"Penitence","lineNumber":121} |
| runeword:Runeword101 | Peril | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword101","Rune Name":"Peril","lineNumber":122} |
| runeword:Runeword102 | Pestilence | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword102","Rune Name":"Pestilence","lineNumber":123} |
| runeword:Runeword103 | Phoenix | 服务器限定（server=1），原版离线匹配禁用；仅定义，未接入执行，属性处理仍不完整 | {"Name":"Runeword103","Rune Name":"Phoenix","complete":1,"server":1,"itype1":"weap","itype2":"shld","*runes":"VexVexLoJah","Rune1":"r26","Rune2":"r26","Rune3":"r28","Rune4":"r31","T1Code1":"dmg%","T1Min1":350,"T1Max1":400,"T1Code2":"ac-miss","T1Min2":350,"T1Max2":400,"T1Code3":"hit-skill","T1Param3":"Firestorm","T1Min3":40,"T1Max3":22,"T1Code4":"levelup-skill","T1Param4":"Blaze","T1Min4":100,"T1Max4":40,"T1Code5":"pierce-fire","T1Min5":28,"T1Max5":28,"T1Code6":"aura","T1Param6":"Redemption","T1Min6":10,"T1Max6":15,"T1Code7":"abs-fire","T1Min7":15,"T1Max7":21,"lineNumber":124} |
| runeword:Runeword104 | Piety | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword104","Rune Name":"Piety","lineNumber":125} |
| runeword:Runeword105 | Pillar of Faith | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword105","Rune Name":"Pillar of Faith","lineNumber":126} |
| runeword:Runeword106 | Plague | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword106","Rune Name":"Plague","itype1":"weap","*runes":"ChamFalUm","Rune1":"r32","Rune2":"r19","Rune3":"r22","T1Code1":"dmg-demon","T1Min1":260,"T1Max1":380,"T1Code2":"gethit-skill","T1Param2":"Lower Resist","T1Min2":20,"T1Max2":12,"T1Code3":"hit-skill","T1Param3":"Poison Nova","T1Min3":25,"T1Max3":15,"T1Code4":"pierce-pois","T1Min4":23,"T1Max4":23,"T1Code5":"deadly/lvl","T1Param5":3,"T1Code6":"aura","T1Param6":"Cleansing","T1Min6":13,"T1Max6":17,"T1Code7":"allskills","T1Min7":1,"T1Max7":2,"lineNumber":127} |
| runeword:Runeword107 | Praise | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword107","Rune Name":"Praise","lineNumber":128} |
| runeword:Runeword108 | Prayer | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword108","Rune Name":"Prayer","lineNumber":129} |
| runeword:Runeword109 | Pride | 服务器限定（server=1），原版离线匹配禁用；仅定义，未接入执行，属性处理仍不完整 | {"Name":"Runeword109","Rune Name":"Pride","complete":1,"server":1,"itype1":"pole","*runes":"ChamSurIoLo","Rune1":"r32","Rune2":"r29","Rune3":"r16","Rune4":"r28","T1Code1":"dmg-dem/lvl","T1Param1":8,"T1Code2":"dmg-ltng","T1Min2":50,"T1Max2":280,"T1Code3":"att%","T1Min3":260,"T1Max3":300,"T1Code4":"aura","T1Param4":"Concentration","T1Min4":16,"T1Max4":20,"T1Code5":"gethit-skill","T1Param5":"Fire Wall","T1Min5":25,"T1Max5":17,"T1Code6":"regen","T1Min6":8,"T1Max6":8,"T1Code7":"gold%/lvl","T1Param7":15,"lineNumber":130} |
| runeword:Runeword110 | Principle | 原版离线匹配已启用；仅部分行为已接入，不代表完整生成或全部属性生效 | {"Name":"Runeword110","Rune Name":"Principle","complete":1,"itype1":"tors","*runes":"RalGulEld","Rune1":"r08","Rune2":"r25","Rune3":"r02","T1Code1":"hit-skill","T1Param1":"Holy Bolt","T1Min1":100,"T1Max1":5,"T1Code2":"pal","T1Min2":2,"T1Max2":2,"T1Code3":"hp","T1Min3":100,"T1Max3":150,"T1Code4":"dmg-undead","T1Min4":50,"T1Max4":50,"lineNumber":131} |
| runeword:Runeword111 | Prowess in Battle | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword111","Rune Name":"Prowess in Battle","lineNumber":132} |
| runeword:Runeword112 | Prudence | 原版离线匹配已启用；仅部分行为已接入，不代表完整生成或全部属性生效 | {"Name":"Runeword112","Rune Name":"Prudence","complete":1,"itype1":"tors","Rune1":"r23","Rune2":"r03","T1Code1":"ac%","T1Min1":140,"T1Max1":170,"T1Code2":"red-mag","T1Min2":10,"T1Max2":10,"T1Code3":"red-dmg","T1Min3":3,"T1Max3":3,"T1Code4":"res-all","T1Min4":25,"T1Max4":35,"T1Code5":"balance2","T1Min5":25,"T1Max5":25,"T1Code6":"rep-dur","T1Param6":25,"T1Code7":"light","T1Min7":1,"T1Max7":1,"lineNumber":133} |
| runeword:Runeword113 | Punishment | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword113","Rune Name":"Punishment","lineNumber":134} |
| runeword:Runeword114 | Purity | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword114","Rune Name":"Purity","lineNumber":135} |
| runeword:Runeword115 | Question | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword115","Rune Name":"Question","lineNumber":136} |
| runeword:Runeword116 | Radiance | 原版离线匹配已启用；仅部分行为已接入，不代表完整生成或全部属性生效 | {"Name":"Runeword116","Rune Name":"Radiance","complete":1,"itype1":"helm","Rune1":"r04","Rune2":"r12","Rune3":"r06","T1Code1":"light","T1Min1":5,"T1Max1":5,"T1Code2":"enr","T1Min2":10,"T1Max2":10,"T1Code3":"vit","T1Min3":10,"T1Max3":10,"T1Code4":"red-mag","T1Min4":3,"T1Max4":3,"T1Code5":"mana","T1Min5":33,"T1Max5":33,"T1Code6":"ac%","T1Min6":75,"T1Max6":75,"lineNumber":13} |
| runeword:Runeword117 | Rain | 原版离线匹配已启用；仅部分行为已接入，不代表完整生成或全部属性生效 | {"Name":"Runeword117","Rune Name":"Rain","complete":1,"itype1":"tors","*runes":"OrtMalIth","Rune1":"r09","Rune2":"r23","Rune3":"r06","T1Code1":"hit-skill","T1Param1":"Twister","T1Min1":5,"T1Max1":15,"T1Code2":"gethit-skill","T1Param2":"Cyclone Armor","T1Min2":5,"T1Max2":15,"T1Code3":"dru","T1Min3":2,"T1Max3":2,"T1Code4":"mana","T1Min4":100,"T1Max4":150,"lineNumber":137} |
| runeword:Runeword118 | Reason | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword118","Rune Name":"Reason","lineNumber":138} |
| runeword:Runeword119 | Red | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword119","Rune Name":"Red","lineNumber":139} |
| runeword:Runeword120 | Rhyme | 原版离线匹配已启用；仅部分行为已接入，不代表完整生成或全部属性生效 | {"Name":"Runeword120","Rune Name":"Rhyme","complete":1,"itype1":"shld","Rune1":"r13","Rune2":"r05","T1Code1":"block2","T1Min1":20,"T1Max1":20,"T1Code2":"block","T1Min2":20,"T1Max2":20,"T1Code3":"res-all","T1Min3":25,"T1Max3":25,"T1Code4":"nofreeze","T1Min4":1,"T1Max4":1,"T1Code5":"gold%","T1Min5":50,"T1Max5":50,"T1Code6":"mag%","T1Min6":25,"T1Max6":25,"lineNumber":14} |
| runeword:Runeword121 | Rift | 服务器限定（server=1），原版离线匹配禁用；仅定义，未接入执行，属性处理仍不完整 | {"Name":"Runeword121","Rune Name":"Rift","complete":1,"server":1,"itype1":"pole","itype2":"scep","*runes":"HelKoLemGul","Rune1":"r15","Rune2":"r18","Rune3":"r20","Rune4":"r25","T1Code1":"dmg-mag","T1Min1":160,"T1Max1":250,"T1Code2":"dmg-fire","T1Min2":60,"T1Max2":180,"T1Code3":"dmg-to-mana","T1Min3":38,"T1Max3":38,"T1Code4":"hit-skill","T1Param4":"Tornado","T1Min4":20,"T1Max4":16,"T1Code5":"att-skill","T1Param5":"Frozen Orb","T1Min5":16,"T1Max5":21,"T1Code6":"charged","T1Param6":"Iron Maiden","T1Min6":40,"T1Max6":15,"T1Code7":"all-stats","T1Min7":5,"T1Max7":10,"lineNumber":140} |
| runeword:Runeword122 | Sanctuary | 原版离线匹配已启用；仅部分行为已接入，不代表完整生成或全部属性生效 | {"Name":"Runeword122","Rune Name":"Sanctuary","complete":1,"itype1":"shld","*runes":"KoKoMal","Rune1":"r18","Rune2":"r18","Rune3":"r23","T1Code1":"block","T1Min1":20,"T1Max1":20,"T1Code2":"block2","T1Min2":20,"T1Max2":20,"T1Code3":"ac%","T1Min3":130,"T1Max3":160,"T1Code4":"ac-miss","T1Min4":250,"T1Max4":250,"T1Code5":"res-all","T1Min5":50,"T1Max5":70,"T1Code6":"balance2","T1Min6":20,"T1Max6":20,"T1Code7":"charged","T1Param7":"Slow Missiles","T1Min7":60,"T1Max7":12,"lineNumber":41} |
| runeword:Runeword123 | Serendipity | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword123","Rune Name":"Serendipity","lineNumber":44} |
| runeword:Runeword124 | Shadow | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword124","Rune Name":"Shadow","lineNumber":45} |
| runeword:Runeword125 | Shadow of Doubt | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword125","Rune Name":"Shadow of Doubt","lineNumber":46} |
| runeword:Runeword126 | Silence | 原版离线匹配已启用；仅部分行为已接入，不代表完整生成或全部属性生效 | {"Name":"Runeword126","Rune Name":"Silence","complete":1,"itype1":"weap","Rune1":"r14","Rune2":"r02","Rune3":"r15","Rune4":"r24","Rune5":"r03","Rune6":"r26","T1Code1":"manasteal","T1Min1":4,"T1Max1":4,"T1Code2":"stupidity","T1Min2":33,"T1Max2":33,"T1Code3":"dmg%","T1Min3":200,"T1Max3":200,"T1Code4":"swing2","T1Min4":20,"T1Max4":20,"T1Code5":"res-all","T1Min5":75,"T1Max5":75,"T1Code6":"allskills","T1Min6":2,"T1Max6":2,"T1Code7":"balance2","T1Min7":20,"T1Max7":20,"lineNumber":15} |
| runeword:Runeword127 | Siren's Song | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword127","Rune Name":"Siren's Song","lineNumber":47} |
| runeword:Runeword128 | Smoke | 原版离线匹配已启用；仅部分行为已接入，不代表完整生成或全部属性生效 | {"Name":"Runeword128","Rune Name":"Smoke","complete":1,"itype1":"tors","Rune1":"r04","Rune2":"r17","T1Code1":"ac-miss","T1Min1":250,"T1Max1":250,"T1Code2":"ac%","T1Min2":75,"T1Max2":75,"T1Code3":"res-all","T1Min3":50,"T1Max3":50,"T1Code4":"balance2","T1Min4":20,"T1Max4":20,"T1Code5":"light","T1Min5":-1,"T1Max5":-1,"T1Code6":"charged","T1Param6":72,"T1Min6":18,"T1Max6":6,"lineNumber":16} |
| runeword:Runeword129 | Sorrow | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword129","Rune Name":"Sorrow","lineNumber":48} |
| runeword:Runeword130 | Spirit | 服务器限定（server=1），原版离线匹配禁用；仅定义，未接入执行，属性处理仍不完整 | {"Name":"Runeword130","Rune Name":"Spirit","complete":1,"server":1,"itype1":"swor","itype2":"shld","*runes":"TalThulOrtAmn","Rune1":"r07","Rune2":"r10","Rune3":"r09","Rune4":"r11","T1Code1":"balance3","T1Min1":55,"T1Max1":55,"T1Code2":"mana","T1Min2":89,"T1Max2":112,"T1Code3":"ac-miss","T1Min3":250,"T1Max3":250,"T1Code4":"vit","T1Min4":22,"T1Max4":22,"T1Code5":"cast3","T1Min5":25,"T1Max5":35,"T1Code6":"abs-mag","T1Min6":3,"T1Max6":8,"T1Code7":"allskills","T1Min7":2,"T1Max7":2,"lineNumber":49} |
| runeword:Runeword131 | Splendor | 原版离线匹配已启用；仅部分行为已接入，不代表完整生成或全部属性生效 | {"Name":"Runeword131","Rune Name":"Splendor","complete":1,"itype1":"shld","Rune1":"r05","Rune2":"r17","T1Code1":"light","T1Min1":3,"T1Max1":3,"T1Code2":"gold%","T1Min2":50,"T1Max2":50,"T1Code3":"mag%","T1Min3":20,"T1Max3":20,"T1Code4":"ac%","T1Min4":60,"T1Max4":100,"T1Code5":"block2","T1Min5":20,"T1Max5":20,"T1Code6":"cast2","T1Min6":10,"T1Max6":10,"T1Code7":"allskills","T1Min7":1,"T1Max7":1,"lineNumber":50} |
| runeword:Runeword132 | Starlight | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword132","Rune Name":"Starlight","lineNumber":51} |
| runeword:Runeword133 | Stealth | 原版离线匹配已启用；仅部分行为已接入，不代表完整生成或全部属性生效 | {"Name":"Runeword133","Rune Name":"Stealth","complete":1,"itype1":"tors","Rune1":"r07","Rune2":"r05","T1Code1":"red-mag","T1Min1":3,"T1Max1":3,"T1Code2":"dex","T1Min2":6,"T1Max2":6,"T1Code3":"stam","T1Min3":15,"T1Max3":15,"T1Code4":"move2","T1Min4":25,"T1Max4":25,"T1Code5":"cast2","T1Min5":25,"T1Max5":25,"T1Code6":"balance2","T1Min6":25,"T1Max6":25,"lineNumber":17} |
| runeword:Runeword134 | Steel | 原版离线匹配已启用；仅部分行为已接入，不代表完整生成或全部属性生效 | {"Name":"Runeword134","Rune Name":"Steel","complete":1,"itype1":"swor","itype2":"axe","itype3":"mace","Rune1":"r03","Rune2":"r01","T1Code1":"swing2","T1Min1":25,"T1Max1":25,"T1Code2":"dmg-min","T1Min2":3,"T1Max2":3,"T1Code3":"dmg-max","T1Min3":3,"T1Max3":3,"T1Code4":"openwounds","T1Min4":50,"T1Max4":50,"T1Code5":"dmg%","T1Min5":20,"T1Max5":20,"lineNumber":18} |
| runeword:Runeword135 | Still Water | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword135","Rune Name":"Still Water","lineNumber":52} |
| runeword:Runeword136 | Sting | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword136","Rune Name":"Sting","lineNumber":80} |
| runeword:Runeword137 | Stone | 原版离线匹配已启用；仅部分行为已接入，不代表完整生成或全部属性生效 | {"Name":"Runeword137","Rune Name":"Stone","complete":1,"itype1":"tors","*runes":"ShaelUmPulLum","Rune1":"r13","Rune2":"r22","Rune3":"r21","Rune4":"r17","T1Code1":"ac%","T1Min1":220,"T1Max1":260,"T1Code2":"charged","T1Param2":"Clay Golem","T1Min2":16,"T1Max2":16,"T1Code3":"ac-miss","T1Min3":300,"T1Max3":300,"T1Code4":"charged","T1Param4":"Molten Boulder","T1Min4":80,"T1Max4":16,"T1Code5":"str","T1Min5":16,"T1Max5":16,"T1Code6":"vit","T1Min6":16,"T1Max6":16,"T1Code7":"balance2","T1Min7":40,"T1Max7":40,"lineNumber":32} |
| runeword:Runeword138 | Storm | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword138","Rune Name":"Storm","lineNumber":54} |
| runeword:Runeword139 | Strength | 原版离线匹配已启用；仅部分行为已接入，不代表完整生成或全部属性生效 | {"Name":"Runeword139","Rune Name":"Strength","complete":1,"itype1":"mele","Rune1":"r11","Rune2":"r03","T1Code1":"str","T1Min1":20,"T1Max1":20,"T1Code2":"dmg%","T1Min2":35,"T1Max2":35,"T1Code3":"vit","T1Min3":10,"T1Max3":10,"T1Code4":"crush","T1Min4":25,"T1Max4":25,"lineNumber":19} |
| runeword:Runeword140 | Tempest | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword140","Rune Name":"Tempest","lineNumber":55} |
| runeword:Runeword141 | Temptation | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword141","Rune Name":"Temptation","lineNumber":56} |
| runeword:Runeword142 | Terror | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword142","Rune Name":"Terror","lineNumber":57} |
| runeword:Runeword4 | Beast | 原版离线匹配已启用；仅部分行为已接入，不代表完整生成或全部属性生效 | {"Name":"Runeword4","Rune Name":"The Beast","complete":1,"itype1":"axe","itype2":"scep","itype3":"hamm","Rune1":"r30","Rune2":"r03","Rune3":"r22","Rune4":"r23","Rune5":"r17","T1Code1":"swing2","T1Min1":40,"T1Max1":40,"T1Code2":"aura","T1Param2":"Fanaticism","T1Min2":9,"T1Max2":9,"T1Code3":"dmg%","T1Min3":240,"T1Max3":270,"T1Code4":"str","T1Min4":25,"T1Max4":40,"T1Code5":"charged","T1Param5":"Summon Grizzly","T1Min5":5,"T1Max5":13,"T1Code6":"oskill","T1Param6":"Wearbear","T1Min6":3,"T1Max6":3,"T1Code7":"oskill","T1Param7":"Shape Shifting","T1Min7":3,"T1Max7":3,"lineNumber":43} |
| runeword:Runeword76 | The Lovers | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword76","Rune Name":"The Lovers","lineNumber":141} |
| runeword:Runeword143 | Thirst | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword143","Rune Name":"Thirst","lineNumber":142} |
| runeword:Runeword68 | Thirst for Knowledge | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword68","Rune Name":"Thirst for Knowledge","lineNumber":143} |
| runeword:Runeword144 | Thought | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword144","Rune Name":"Thought","lineNumber":144} |
| runeword:Runeword145 | Thunder | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword145","Rune Name":"Thunder","lineNumber":145} |
| runeword:Runeword146 | Time | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword146","Rune Name":"Time","lineNumber":146} |
| runeword:Runeword147 | Tradition | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword147","Rune Name":"Tradition","lineNumber":147} |
| runeword:Runeword148 | Treachery | 原版离线匹配已启用；仅部分行为已接入，不代表完整生成或全部属性生效 | {"Name":"Runeword148","Rune Name":"Treachery","complete":1,"itype1":"tors","*runes":"ShaelThulLem","Rune1":"r13","Rune2":"r10","Rune3":"r20","T1Code1":"hit-skill","T1Param1":"Venom","T1Min1":25,"T1Max1":15,"T1Code2":"gethit-skill","T1Param2":"Fade","T1Min2":5,"T1Max2":15,"T1Code3":"ass","T1Min3":2,"T1Max3":2,"T1Code4":"swing2","T1Min4":45,"T1Max4":45,"lineNumber":148} |
| runeword:Runeword149 | Trust | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword149","Rune Name":"Trust","lineNumber":149} |
| runeword:Runeword150 | Truth | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword150","Rune Name":"Truth","lineNumber":150} |
| runeword:Runeword151 | Unbending Will | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword151","Rune Name":"Unbending Will","lineNumber":151} |
| runeword:Runeword152 | Valor | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword152","Rune Name":"Valor","lineNumber":152} |
| runeword:Runeword153 | Vengeance | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword153","Rune Name":"Vengeance","itype1":"weap","Rune1":"r06","Rune2":"r11","Rune3":"r01","lineNumber":153} |
| runeword:Runeword154 | Venom | 原版离线匹配已启用；仅部分行为已接入，不代表完整生成或全部属性生效 | {"Name":"Runeword154","Rune Name":"Venom","complete":1,"itype1":"weap","Rune1":"r07","Rune2":"r14","Rune3":"r23","T1Code1":"dmg-pois","T1Param1":175,"T1Min1":312,"T1Max1":312,"T1Code2":"ignore-ac","T1Min2":1,"T1Max2":1,"T1Code3":"charged","T1Param3":83,"T1Min3":27,"T1Max3":15,"T1Code4":"charged","T1Param4":92,"T1Min4":11,"T1Max4":13,"T1Code5":"manasteal","T1Min5":7,"T1Max5":7,"lineNumber":20} |
| runeword:Runeword155 | Victory | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword155","Rune Name":"Victory","lineNumber":154} |
| runeword:Runeword156 | Voice | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword156","Rune Name":"Voice","itype1":"helm","Rune1":"r03","Rune2":"r06","lineNumber":155} |
| runeword:Runeword157 | Void | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword157","Rune Name":"Void","lineNumber":156} |
| runeword:Runeword158 | War | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword158","Rune Name":"War","lineNumber":157} |
| runeword:Runeword159 | Water | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword159","Rune Name":"Water","lineNumber":158} |
| runeword:Runeword160 | Wealth | 原版离线匹配已启用；仅部分行为已接入，不代表完整生成或全部属性生效 | {"Name":"Runeword160","Rune Name":"Wealth","complete":1,"itype1":"tors","Rune1":"r20","Rune2":"r18","Rune3":"r03","T1Code1":"gold%","T1Min1":250,"T1Max1":250,"T1Code2":"mag%","T1Min2":100,"T1Max2":100,"lineNumber":21} |
| runeword:Runeword161 | Whisper | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword161","Rune Name":"Whisper","lineNumber":159} |
| runeword:Runeword162 | White | 原版离线匹配已启用；仅部分行为已接入，不代表完整生成或全部属性生效 | {"Name":"Runeword162","Rune Name":"White","complete":1,"itype1":"wand","Rune1":"r14","Rune2":"r16","T1Code1":"skilltab","T1Param1":7,"T1Min1":3,"T1Max1":3,"T1Code2":"red-mag","T1Min2":4,"T1Max2":4,"T1Code3":"cast2","T1Min3":20,"T1Max3":20,"T1Code4":"mana","T1Min4":13,"T1Max4":13,"T1Code5":"skill","T1Param5":68,"T1Min5":3,"T1Max5":3,"T1Code6":"skill","T1Param6":84,"T1Min6":2,"T1Max6":2,"T1Code7":"skill","T1Param7":69,"T1Min7":4,"T1Max7":4,"lineNumber":22} |
| runeword:Runeword47 | Grief | 服务器限定（server=1），原版离线匹配禁用；仅定义，未接入执行，属性处理仍不完整 | {"Name":"Runeword47","Rune Name":"Widowmaker","complete":1,"server":1,"itype1":"swor","itype2":"axe","*runes":"EthTirLoMalRal","Rune1":"r05","Rune2":"r03","Rune3":"r28","Rune4":"r23","Rune5":"r08","T1Code1":"dmg-dem/lvl","T1Param1":15,"T1Code2":"dmg","T1Min2":340,"T1Max2":400,"T1Code3":"swing3","T1Min3":30,"T1Max3":40,"T1Code4":"hit-skill","T1Param4":"Venom","T1Min4":35,"T1Max4":15,"T1Code5":"pierce-pois","T1Min5":20,"T1Max5":25,"T1Code6":"ignore-ac","T1Min6":1,"T1Max6":1,"T1Code7":"heal-kill","T1Min7":10,"T1Max7":15,"lineNumber":160} |
| runeword:Runeword163 | Wind | 原版离线匹配已启用；仅部分行为已接入，不代表完整生成或全部属性生效 | {"Name":"Runeword163","Rune Name":"Wind","complete":1,"itype1":"mele","Rune1":"r29","Rune2":"r01","T1Code1":"dmg%","T1Min1":120,"T1Max1":160,"T1Code2":"swing2","T1Min2":40,"T1Max2":40,"T1Code3":"move2","T1Min3":20,"T1Max3":20,"T1Code4":"reduce-ac","T1Min4":50,"T1Max4":50,"T1Code5":"hit-skill","T1Param5":245,"T1Min5":10,"T1Max5":9,"T1Code6":"charged","T1Param6":240,"T1Min6":127,"T1Max6":13,"T1Code7":"balance2","T1Min7":15,"T1Max7":15,"lineNumber":161} |
| runeword:Runeword164 | Wings of Hope | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword164","Rune Name":"Wings of Hope","lineNumber":162} |
| runeword:Runeword99 | Voice of Reason | 服务器限定（server=1），原版离线匹配禁用；仅定义，未接入执行，属性处理仍不完整 | {"Name":"Runeword99","Rune Name":"Winter","complete":1,"server":1,"itype1":"swor","itype2":"mace","*runes":"LemKoElEld","Rune1":"r20","Rune2":"r18","Rune3":"r01","Rune4":"r02","T1Code1":"dmg-demon","T1Min1":220,"T1Max1":350,"T1Code2":"dmg-undead","T1Min2":280,"T1Max2":300,"T1Code3":"dmg-cold","T1Min3":100,"T1Max3":220,"T1Code4":"pierce-cold","T1Min4":24,"T1Max4":24,"T1Code5":"hit-skill","T1Param5":"Ice Blast","T1Min5":18,"T1Max5":20,"T1Code6":"hit-skill","T1Param6":"Frozen Orb","T1Min6":15,"T1Max6":13,"T1Code7":"nofreeze","T1Min7":1,"T1Max7":1,"lineNumber":163} |
| runeword:Runeword165 | Wisdom | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword165","Rune Name":"Wisdom","itype1":"shld","itype2":"staf","itype3":"wand","lineNumber":164} |
| runeword:Runeword166 | Woe | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword166","Rune Name":"Woe","itype1":"weap","itype2":"miss","lineNumber":165} |
| runeword:Runeword167 | Wonder | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword167","Rune Name":"Wonder","itype1":"wand","Rune1":"r04","Rune2":"r12","Rune3":"r24","lineNumber":166} |
| runeword:Runeword168 | Wrath | 服务器限定（server=1），原版离线匹配禁用；仅定义，未接入执行，属性处理仍不完整 | {"Name":"Runeword168","Rune Name":"Wrath","complete":1,"server":1,"itype1":"miss","*runes":"PulLumBerMal","Rune1":"r21","Rune2":"r17","Rune3":"r30","Rune4":"r23","T1Code1":"dmg-demon","T1Min1":300,"T1Max1":300,"T1Code2":"dmg-undead","T1Min2":250,"T1Max2":300,"T1Code3":"dmg-ltng","T1Min3":41,"T1Max3":240,"T1Code4":"dmg-mag","T1Min4":85,"T1Max4":120,"T1Code5":"hit-skill","T1Param5":"Life Tap","T1Min5":5,"T1Max5":10,"T1Code6":"hit-skill","T1Param6":"decrepify","T1Min6":30,"T1Max6":1,"T1Code7":"nofreeze","T1Min7":1,"T1Max7":1,"lineNumber":167} |
| runeword:Runeword169 | Youth | 原始未完成（complete≠1），离线匹配禁用；仅定义，未接入执行 | {"Name":"Runeword169","Rune Name":"Youth","lineNumber":168} |
| runeword:Runeword170 | Zephyr | 原版离线匹配已启用；仅部分行为已接入，不代表完整生成或全部属性生效 | {"Name":"Runeword170","Rune Name":"Zephyr","complete":1,"itype1":"miss","Rune1":"r09","Rune2":"r05","T1Code1":"move2","T1Min1":25,"T1Max1":25,"T1Code2":"swing2","T1Min2":25,"T1Max2":25,"T1Code3":"dmg%","T1Min3":33,"T1Max3":33,"T1Code4":"att","T1Min4":66,"T1Max4":66,"T1Code5":"gethit-skill","T1Param5":240,"T1Min5":7,"T1Max5":1,"T1Code6":"ac","T1Min6":25,"T1Max6":25,"lineNumber":23} |

## 全部方块配方定义（151 条，其中 146 启用）

该表不是首版支持配方清单。description、启用/版本/天梯标志、材料表达式、全部输出与额外属性保留；lvl/plvl/ilvl 的含义见装备研究。

| 稳定身份 | 描述 | enabled | version | ladder | 输入数 | 材料表达式 | 主输出 | lvl / plvl / ilvl | 完整原始字段 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| cube:0 | Staff of Kings + Viper amulet -> Horadric Staff | 1 | 0 | 0 | 2 | msf + vip | hst | 0 / 0 / 0 | {"description":"Staff of Kings + Viper amulet -> Horadric Staff","enabled":1,"op":28,"numinputs":2,"input 1":"msf","input 2":"vip","output":"hst"} |
| cube:1 | Khalim Flail + Khalim Heart + Khalim Eye + Khalim Brain -> Super Khalim Flail | 1 | 0 | 0 | 4 | qf1 + qhr + qey + qbr | qf2 | 0 / 0 / 0 | {"description":"Khalim Flail + Khalim Heart + Khalim Eye + Khalim Brain -> Super Khalim Flail","enabled":1,"op":28,"numinputs":4,"input 1":"qf1","input 2":"qhr","input 3":"qey","input 4":"qbr","output":"qf2"} |
| cube:2 | 1 Wirt's leg + 1 town portal book -> portal to cow lvl | 1 | 0 | 0 | 2 | leg + tbk | Cow Portal | 0 / 0 / 0 | {"description":"1 Wirt's leg + 1 town portal book -> portal to cow lvl","enabled":1,"op":28,"numinputs":2,"input 1":"leg","input 2":"tbk","output":"Cow Portal"} |
| cube:3 | 3 health potions + 3 mana potions + 1 standard gem -> full rejuvenate potion | 1 | 0 | 0 | 7 | hpot,qty=3 + mpot,qty=3 + gem2 | rvl | 0 / 0 / 0 | {"description":"3 health potions + 3 mana potions + 1 standard gem -> full rejuvenate potion","enabled":1,"numinputs":7,"input 1":"\"hpot,qty=3\"","input 2":"\"mpot,qty=3\"","input 3":"gem2","output":"rvl"} |
| cube:4 | 3 health potions +  3 mana potions + 1 chipped gem -> rejuvenate potion | 1 | 0 | 0 | 7 | hpot,qty=3 + mpot,qty=3 + gem0 | rvs | 0 / 0 / 0 | {"description":"3 health potions +  3 mana potions + 1 chipped gem -> rejuvenate potion","enabled":1,"numinputs":7,"input 1":"\"hpot,qty=3\"","input 2":"\"mpot,qty=3\"","input 3":"gem0","output":"rvs"} |
| cube:5 | 3 small rejuvs -> one large | 1 | 0 | 0 | 3 | rvs,qty=3 | rvl | 0 / 0 / 0 | {"description":"3 small rejuvs -> one large","enabled":1,"numinputs":3,"input 1":"\"rvs,qty=3\"","output":"rvl"} |
| cube:6 | 1 perfect gem of each type + 1 amulet -> prismatic amulet | 1 | 0 | 0 | 7 | amu,mag + gpv + gpy + gpb + gpg + gpr + gpw | amu,mag,pre=331 | 50 / 0 / 0 | {"description":"1 perfect gem of each type + 1 amulet -> prismatic amulet","enabled":1,"numinputs":7,"input 1":"\"amu,mag\"","input 2":"gpv","input 3":"gpy","input 4":"gpb","input 5":"gpg","input 6":"gpr","input 7":"gpw","output":"\"amu,mag,pre=331\"","lvl":50} |
| cube:7 | 1 ring + 1 perfect ruby + 1 exploding potions -> garnet ring | 1 | 0 | 0 | 3 | rin,mag + gpr + opm | rin,mag,pre=372 | 30 / 0 / 0 | {"description":"1 ring + 1 perfect ruby + 1 exploding potions -> garnet ring","enabled":1,"numinputs":3,"input 1":"\"rin,mag\"","input 2":"gpr","input 3":"opm","output":"\"rin,mag,pre=372\"","lvl":30} |
| cube:8 | 1 ring + 1 perfect sapphire + 1 thawing potions-> cobalt ring | 1 | 0 | 0 | 3 | rin,mag + gpb + wms | rin,mag,pre=353 | 30 / 0 / 0 | {"description":"1 ring + 1 perfect sapphire + 1 thawing potions-> cobalt ring","enabled":1,"numinputs":3,"input 1":"\"rin,mag\"","input 2":"gpb","input 3":"wms","output":"\"rin,mag,pre=353\"","lvl":30} |
| cube:9 | 1 ring + 1 perfect topaz + 1 rejuvenation -> coral ring | 1 | 0 | 0 | 3 | rin,mag + gpy + rvs | rin,mag,pre=392 | 30 / 0 / 0 | {"description":"1 ring + 1 perfect topaz + 1 rejuvenation -> coral ring","enabled":1,"numinputs":3,"input 1":"\"rin,mag\"","input 2":"gpy","input 3":"rvs","output":"\"rin,mag,pre=392\"","lvl":30} |
| cube:10 | 1 ring + 1 emerald + 1 antidote potions -> jade ring | 1 | 0 | 0 | 3 | rin,mag + gpg + yps | rin,mag,pre=412 | 30 / 0 / 0 | {"description":"1 ring + 1 emerald + 1 antidote potions -> jade ring","enabled":1,"numinputs":3,"input 1":"\"rin,mag\"","input 2":"gpg","input 3":"yps","output":"\"rin,mag,pre=412\"","lvl":30} |
| cube:11 | 1 axe + 1 dagger -> throwing axe | 1 | 0 | 0 | 2 | axe + knif | tax,nor | 0 / 0 / 0 | {"description":"1 axe + 1 dagger -> throwing axe","enabled":1,"numinputs":2,"input 1":"axe","input 2":"knif","output":"\"tax,nor\""} |
| cube:12 | 1 spear + 1 arrow quiver -> javelins | 1 | 0 | 0 | 2 | spea + aqv | jav,nor | 0 / 0 / 0 | {"description":"1 spear + 1 arrow quiver -> javelins","enabled":1,"numinputs":2,"input 1":"spea","input 2":"aqv","output":"\"jav,nor\""} |
| cube:13 | 3 rings -> amulet | 1 | 0 | 0 | 3 | rin,mag,qty=3 | amu,mag | 0 / 75 / 0 | {"description":"3 rings -> amulet","enabled":1,"numinputs":3,"input 1":"\"rin,mag,qty=3\"","output":"\"amu,mag\"","plvl":75} |
| cube:14 | 3 amulets -> ring | 1 | 0 | 0 | 3 | amu,mag,qty=3 | rin,mag | 0 / 75 / 0 | {"description":"3 amulets -> ring","enabled":1,"numinputs":3,"input 1":"\"amu,mag,qty=3\"","output":"\"rin,mag\"","plvl":75} |
| cube:15 | 3 standard gems + 1 socketed weapon ->  magic, socketable weapon | 1 | 0 | 0 | 4 | weap,sock + gem2,qty=3 | usetype,mag | 30 / 0 / 60 | {"description":"\"3 standard gems + 1 socketed weapon ->  magic, socketable weapon\"","enabled":1,"numinputs":4,"input 1":"\"weap,sock\"","input 2":"\"gem2,qty=3\"","output":"\"usetype,mag\"","lvl":30,"ilvl":60,"mod 1":"sock","mod 1 min":1,"mod 1 max":2} |
| cube:16 | 3 flawless gems + 1 magic weapon -> socketed, magic weapon | 1 | 0 | 0 | 4 | weap,mag + gem3,qty=3 | usetype,mag | 30 / 0 / 60 | {"description":"\"3 flawless gems + 1 magic weapon -> socketed, magic weapon\"","enabled":1,"numinputs":4,"input 1":"\"weap,mag\"","input 2":"\"gem3,qty=3\"","output":"\"usetype,mag\"","lvl":30,"ilvl":60,"mod 1":"sock","mod 1 min":1,"mod 1 max":2} |
| cube:17 | 1 magic small shield + 1 spiked club + 2 skulls -> shield of spikes | 1 | 0 | 0 | 4 | shld,mag + gemz,qty=2 + spc | usetype,mag,suf=162 | 30 / 0 / 60 | {"description":"1 magic small shield + 1 spiked club + 2 skulls -> shield of spikes","enabled":1,"numinputs":4,"input 1":"\"shld,mag\"","input 2":"\"gemz,qty=2\"","input 3":"spc","output":"\"usetype,mag,suf=162\"","lvl":30,"ilvl":60} |
| cube:18 | 4 health potion + 1 ruby + 1 magic sword -> sword of the leech | 1 | 0 | 0 | 6 | swor,mag + gemr + hpot,qty=4 | usetype,mag,suf=352 | 30 / 0 / 60 | {"description":"4 health potion + 1 ruby + 1 magic sword -> sword of the leech","enabled":1,"numinputs":6,"input 1":"\"swor,mag\"","input 2":"gemr","input 3":"\"hpot,qty=4\"","output":"\"usetype,mag,suf=352\"","lvl":30,"ilvl":60} |
| cube:19 | 1 diamond + 1 kriss + 1 staff + 1 belt -> savage polearm | 1 | 0 | 0 | 4 | kri + gemd + staf + belt | pole,mag,pre=191 | 50 / 0 / 60 | {"description":"1 diamond + 1 kriss + 1 staff + 1 belt -> savage polearm","enabled":1,"numinputs":4,"input 1":"kri","input 2":"gemd","input 3":"staf","input 4":"belt","output":"\"pole,mag,pre=191\"","lvl":50,"ilvl":60} |
| cube:20 | 1 strangling gas potion + 1 health potion -> antidote potion | 1 | 0 | 0 | 2 | gpl + hpot | yps | 0 / 0 / 0 | {"description":"1 strangling gas potion + 1 health potion -> antidote potion","enabled":1,"numinputs":2,"input 1":"gpl","input 2":"hpot","output":"yps"} |
| cube:21 | 2 arrows -> bolts | 1 | 0 | 0 | 2 | aqv,qty=2 | cqv | 0 / 0 / 0 | {"description":"2 arrows -> bolts","enabled":1,"numinputs":2,"input 1":"\"aqv,qty=2\"","output":"cqv"} |
| cube:22 | 2 bolts -> arrows | 1 | 0 | 0 | 2 | cqv,qty=2 | aqv | 0 / 0 / 0 | {"description":"2 bolts -> arrows","enabled":1,"numinputs":2,"input 1":"\"cqv,qty=2\"","output":"aqv"} |
| cube:23 | 3 chipped amethysts -> flawed amethyst | 1 | 0 | 0 | 3 | gcv,qty=3 | gfv | 0 / 0 / 0 | {"description":"3 chipped amethysts -> flawed amethyst","enabled":1,"numinputs":3,"input 1":"\"gcv,qty=3\"","output":"gfv"} |
| cube:24 | 3 flawed amethysts -> standard amethyst | 1 | 0 | 0 | 3 | gfv,qty=3 | gsv | 0 / 0 / 0 | {"description":"3 flawed amethysts -> standard amethyst","enabled":1,"numinputs":3,"input 1":"\"gfv,qty=3\"","output":"gsv"} |
| cube:25 | 3 standard amethysts -> flawless amethyst | 1 | 0 | 0 | 3 | gsv,qty=3 | gzv | 0 / 0 / 0 | {"description":"3 standard amethysts -> flawless amethyst","enabled":1,"numinputs":3,"input 1":"\"gsv,qty=3\"","output":"gzv"} |
| cube:26 | 3 flawless amethysts -> perfect amethyst | 1 | 0 | 0 | 3 | gzv,qty=3 | gpv | 0 / 0 / 0 | {"description":"3 flawless amethysts -> perfect amethyst","enabled":1,"numinputs":3,"input 1":"\"gzv,qty=3\"","output":"gpv"} |
| cube:27 | 3 chipped rubies -> flawed ruby | 1 | 0 | 0 | 3 | gcr,qty=3 | gfr | 0 / 0 / 0 | {"description":"3 chipped rubies -> flawed ruby","enabled":1,"numinputs":3,"input 1":"\"gcr,qty=3\"","output":"gfr"} |
| cube:28 | 3 flawed rubies -> standard ruby | 1 | 0 | 0 | 3 | gfr,qty=3 | gsr | 0 / 0 / 0 | {"description":"3 flawed rubies -> standard ruby","enabled":1,"numinputs":3,"input 1":"\"gfr,qty=3\"","output":"gsr"} |
| cube:29 | 3 standard rubies -> flawless ruby | 1 | 0 | 0 | 3 | gsr,qty=3 | glr | 0 / 0 / 0 | {"description":"3 standard rubies -> flawless ruby","enabled":1,"numinputs":3,"input 1":"\"gsr,qty=3\"","output":"glr"} |
| cube:30 | 3 flawless rubies -> perfect ruby | 1 | 0 | 0 | 3 | glr,qty=3 | gpr | 0 / 0 / 0 | {"description":"3 flawless rubies -> perfect ruby","enabled":1,"numinputs":3,"input 1":"\"glr,qty=3\"","output":"gpr"} |
| cube:31 | 3 chipped sapphires -> flawed sapphire | 1 | 0 | 0 | 3 | gcb,qty=3 | gfb | 0 / 0 / 0 | {"description":"3 chipped sapphires -> flawed sapphire","enabled":1,"numinputs":3,"input 1":"\"gcb,qty=3\"","output":"gfb"} |
| cube:32 | 3 flawed sapphires -> standard sapphire | 1 | 0 | 0 | 3 | gfb,qty=3 | gsb | 0 / 0 / 0 | {"description":"3 flawed sapphires -> standard sapphire","enabled":1,"numinputs":3,"input 1":"\"gfb,qty=3\"","output":"gsb"} |
| cube:33 | 3 standard sapphires -> flawless sapphire | 1 | 0 | 0 | 3 | gsb,qty=3 | glb | 0 / 0 / 0 | {"description":"3 standard sapphires -> flawless sapphire","enabled":1,"numinputs":3,"input 1":"\"gsb,qty=3\"","output":"glb"} |
| cube:34 | 3 flawless sapphires -> perfect sapphire | 1 | 0 | 0 | 3 | glb,qty=3 | gpb | 0 / 0 / 0 | {"description":"3 flawless sapphires -> perfect sapphire","enabled":1,"numinputs":3,"input 1":"\"glb,qty=3\"","output":"gpb"} |
| cube:35 | 3 chipped topazes -> flawed topaz | 1 | 0 | 0 | 3 | gcy,qty=3 | gfy | 0 / 0 / 0 | {"description":"3 chipped topazes -> flawed topaz","enabled":1,"numinputs":3,"input 1":"\"gcy,qty=3\"","output":"gfy"} |
| cube:36 | 3 flawed topazes -> standard topaz | 1 | 0 | 0 | 3 | gfy,qty=3 | gsy | 0 / 0 / 0 | {"description":"3 flawed topazes -> standard topaz","enabled":1,"numinputs":3,"input 1":"\"gfy,qty=3\"","output":"gsy"} |
| cube:37 | 3 standard topazes -> flawless topaz | 1 | 0 | 0 | 3 | gsy,qty=3 | gly | 0 / 0 / 0 | {"description":"3 standard topazes -> flawless topaz","enabled":1,"numinputs":3,"input 1":"\"gsy,qty=3\"","output":"gly"} |
| cube:38 | 3 flawless topazes -> perfect topaz | 1 | 0 | 0 | 3 | gly,qty=3 | gpy | 0 / 0 / 0 | {"description":"3 flawless topazes -> perfect topaz","enabled":1,"numinputs":3,"input 1":"\"gly,qty=3\"","output":"gpy"} |
| cube:39 | 3 chipped emeralds -> flawed emerald | 1 | 0 | 0 | 3 | gcg,qty=3 | gfg | 0 / 0 / 0 | {"description":"3 chipped emeralds -> flawed emerald","enabled":1,"numinputs":3,"input 1":"\"gcg,qty=3\"","output":"gfg"} |
| cube:40 | 3 flawed emeralds -> standard emerald | 1 | 0 | 0 | 3 | gfg,qty=3 | gsg | 0 / 0 / 0 | {"description":"3 flawed emeralds -> standard emerald","enabled":1,"numinputs":3,"input 1":"\"gfg,qty=3\"","output":"gsg"} |
| cube:41 | 3 standard emeralds -> flawless emerald | 1 | 0 | 0 | 3 | gsg,qty=3 | glg | 0 / 0 / 0 | {"description":"3 standard emeralds -> flawless emerald","enabled":1,"numinputs":3,"input 1":"\"gsg,qty=3\"","output":"glg"} |
| cube:42 | 3 flawless emeralds -> perfect emerald | 1 | 0 | 0 | 3 | glg,qty=3 | gpg | 0 / 0 / 0 | {"description":"3 flawless emeralds -> perfect emerald","enabled":1,"numinputs":3,"input 1":"\"glg,qty=3\"","output":"gpg"} |
| cube:43 | 3 chipped diamonds -> flawed diamond | 1 | 0 | 0 | 3 | gcw,qty=3 | gfw | 0 / 0 / 0 | {"description":"3 chipped diamonds -> flawed diamond","enabled":1,"numinputs":3,"input 1":"\"gcw,qty=3\"","output":"gfw"} |
| cube:44 | 3 flawed diamonds -> standard diamond | 1 | 0 | 0 | 3 | gfw,qty=3 | gsw | 0 / 0 / 0 | {"description":"3 flawed diamonds -> standard diamond","enabled":1,"numinputs":3,"input 1":"\"gfw,qty=3\"","output":"gsw"} |
| cube:45 | 3 standard diamonds -> flawless diamond | 1 | 0 | 0 | 3 | gsw,qty=3 | glw | 0 / 0 / 0 | {"description":"3 standard diamonds -> flawless diamond","enabled":1,"numinputs":3,"input 1":"\"gsw,qty=3\"","output":"glw"} |
| cube:46 | 3 flawless diamonds -> perfect diamond | 1 | 0 | 0 | 3 | glw,qty=3 | gpw | 0 / 0 / 0 | {"description":"3 flawless diamonds -> perfect diamond","enabled":1,"numinputs":3,"input 1":"\"glw,qty=3\"","output":"gpw"} |
| cube:47 | 3 chipped skulls -> flawed skull | 1 | 0 | 0 | 3 | skc,qty=3 | skf | 0 / 0 / 0 | {"description":"3 chipped skulls -> flawed skull","enabled":1,"numinputs":3,"input 1":"\"skc,qty=3\"","output":"skf"} |
| cube:48 | 3 flawed skulls -> standard skull | 1 | 0 | 0 | 3 | skf,qty=3 | sku | 0 / 0 / 0 | {"description":"3 flawed skulls -> standard skull","enabled":1,"numinputs":3,"input 1":"\"skf,qty=3\"","output":"sku"} |
| cube:49 | 3 standard skulls -> flawless skull | 1 | 0 | 0 | 3 | sku,qty=3 | skl | 0 / 0 / 0 | {"description":"3 standard skulls -> flawless skull","enabled":1,"numinputs":3,"input 1":"\"sku,qty=3\"","output":"skl"} |
| cube:50 | 3 flawless skulls -> perfect skull | 1 | 0 | 0 | 3 | skl,qty=3 | skz | 0 / 0 / 0 | {"description":"3 flawless skulls -> perfect skull","enabled":1,"numinputs":3,"input 1":"\"skl,qty=3\"","output":"skz"} |
| cube:51 | 3 rune 01 -> rune 02 | 1 | 100 | 0 | 3 | r01,qty=3 | r02 | 0 / 0 / 0 | {"description":"3 rune 01 -> rune 02","enabled":1,"version":100,"numinputs":3,"input 1":"\"r01,qty=3\"","output":"r02","expansion":1} |
| cube:52 | 3 rune 02 -> rune 03 | 1 | 100 | 0 | 3 | r02,qty=3 | r03 | 0 / 0 / 0 | {"description":"3 rune 02 -> rune 03","enabled":1,"version":100,"numinputs":3,"input 1":"\"r02,qty=3\"","output":"r03","expansion":1} |
| cube:53 | 3 rune 03 -> rune 04 | 1 | 100 | 0 | 3 | r03,qty=3 | r04 | 0 / 0 / 0 | {"description":"3 rune 03 -> rune 04","enabled":1,"version":100,"numinputs":3,"input 1":"\"r03,qty=3\"","output":"r04","expansion":1} |
| cube:54 | 3 rune 04 -> rune 05 | 1 | 100 | 0 | 3 | r04,qty=3 | r05 | 0 / 0 / 0 | {"description":"3 rune 04 -> rune 05","enabled":1,"version":100,"numinputs":3,"input 1":"\"r04,qty=3\"","output":"r05","expansion":1} |
| cube:55 | 3 rune 05 -> rune 06 | 1 | 100 | 0 | 3 | r05,qty=3 | r06 | 0 / 0 / 0 | {"description":"3 rune 05 -> rune 06","enabled":1,"version":100,"numinputs":3,"input 1":"\"r05,qty=3\"","output":"r06","expansion":1} |
| cube:56 | 3 rune 06 -> rune 07 | 1 | 100 | 0 | 3 | r06,qty=3 | r07 | 0 / 0 / 0 | {"description":"3 rune 06 -> rune 07","enabled":1,"version":100,"numinputs":3,"input 1":"\"r06,qty=3\"","output":"r07","expansion":1} |
| cube:57 | 3 rune 07 -> rune 08 | 1 | 100 | 0 | 3 | r07,qty=3 | r08 | 0 / 0 / 0 | {"description":"3 rune 07 -> rune 08","enabled":1,"version":100,"numinputs":3,"input 1":"\"r07,qty=3\"","output":"r08","expansion":1} |
| cube:58 | 3 rune 08 -> rune 09 | 1 | 100 | 0 | 3 | r08,qty=3 | r09 | 0 / 0 / 0 | {"description":"3 rune 08 -> rune 09","enabled":1,"version":100,"numinputs":3,"input 1":"\"r08,qty=3\"","output":"r09","expansion":1} |
| cube:59 | 3 rune 09 -> rune 10 | 1 | 100 | 0 | 3 | r09,qty=3 | r10 | 0 / 0 / 0 | {"description":"3 rune 09 -> rune 10","enabled":1,"version":100,"numinputs":3,"input 1":"\"r09,qty=3\"","output":"r10","expansion":1} |
| cube:60 | 3 perfect gems + 1 magic item -> magic item | 1 | 100 | 0 | 4 | any,mag + gem4,qty=3 | usetype,mag | 0 / 0 / 100 | {"description":"3 perfect gems + 1 magic item -> magic item","enabled":1,"version":100,"numinputs":4,"input 1":"\"any,mag\"","input 2":"\"gem4,qty=3\"","output":"\"usetype,mag\"","ilvl":100,"expansion":1} |
| cube:61 | 6 perfect skulls + 1 rare item -> 1 low level rare item | 1 | 0 | 0 | 7 | any,rar + skz,qty=6 | usetype,rar | 0 / 40 / 40 | {"description":"6 perfect skulls + 1 rare item -> 1 low level rare item","enabled":1,"numinputs":7,"input 1":"\"any,rar\"","input 2":"\"skz,qty=6\"","output":"\"usetype,rar\"","plvl":40,"ilvl":40} |
| cube:62 | 1 perfect skull + 1 rare item + soj -> 1 high level rare item | 1 | 0 | 0 | 3 | any,rar + skz + The Stone of Jordan | usetype,rar | 0 / 66 / 66 | {"description":"1 perfect skull + 1 rare item + soj -> 1 high level rare item","enabled":1,"numinputs":3,"input 1":"\"any,rar\"","input 2":"skz","input 3":"The Stone of Jordan","output":"\"usetype,rar\"","plvl":66,"ilvl":66} |
| cube:63 | 3 perfect skull + 1 rare item + stone of jordan-> add 1 socket to rare | 1 | 0 | 0 | 5 | any,rar,nos + skz,qty=3 + The Stone of Jordan | useitem,sock=1 | 0 / 0 / 0 | {"description":"3 perfect skull + 1 rare item + stone of jordan-> add 1 socket to rare","enabled":1,"numinputs":5,"input 1":"\"any,rar,nos\"","input 2":"\"skz,qty=3\"","input 3":"The Stone of Jordan","output":"\"useitem,sock=1\""} |
| cube:64 | magic full helm + jewel + rune 06 + perfect sapphire -> hitpower helm | 1 | 100 | 0 | 4 | fhl,mag,upg + jew + r06 + gpb | usetype,crf | 0 / 50 / 50 | {"description":"magic full helm + jewel + rune 06 + perfect sapphire -> hitpower helm","enabled":1,"version":100,"numinputs":4,"input 1":"\"fhl,mag,upg\"","input 2":"jew","input 3":"r06","input 4":"gpb","output":"\"usetype,crf\"","plvl":50,"ilvl":50,"mod 1":"gethit-skill","mod 1 param":44,"mod 1 min":5,"mod 1 max":4,"mod 2":"thorns","mod 2 min":3,"mod 2 max":7,"mod 3":"ac-miss","mod 3 min":25,"mod 3 max":50,"expansion":1} |
| cube:65 | magic chain boots + jewel + rune 08 + perfect sapphire -> hitpower boots | 1 | 100 | 0 | 4 | mbt,mag,upg + jew + r08 + gpb | usetype,crf | 0 / 50 / 50 | {"description":"magic chain boots + jewel + rune 08 + perfect sapphire -> hitpower boots","enabled":1,"version":100,"numinputs":4,"input 1":"\"mbt,mag,upg\"","input 2":"jew","input 3":"r08","input 4":"gpb","output":"\"usetype,crf\"","plvl":50,"ilvl":50,"mod 1":"gethit-skill","mod 1 param":44,"mod 1 min":5,"mod 1 max":4,"mod 2":"thorns","mod 2 min":3,"mod 2 max":7,"mod 3":"ac-hth","mod 3 min":25,"mod 3 max":60,"expansion":1} |
| cube:66 | magic chain gloves + jewel + rune 09 + perfect sapphire -> hitpower gloves | 1 | 100 | 0 | 4 | mgl,mag,upg + jew + r09 + gpb | usetype,crf | 0 / 50 / 50 | {"description":"magic chain gloves + jewel + rune 09 + perfect sapphire -> hitpower gloves","enabled":1,"version":100,"numinputs":4,"input 1":"\"mgl,mag,upg\"","input 2":"jew","input 3":"r09","input 4":"gpb","output":"\"usetype,crf\"","plvl":50,"ilvl":50,"mod 1":"gethit-skill","mod 1 param":44,"mod 1 min":5,"mod 1 max":4,"mod 2":"thorns","mod 2 min":3,"mod 2 max":7,"mod 3":"knock","mod 3 min":1,"mod 3 max":1,"expansion":1} |
| cube:67 | magic heavy belt + jewel + rune 07 + perfect sapphire -> hitpower belt | 1 | 100 | 0 | 4 | tbl,mag,upg + jew + r07 + gpb | usetype,crf | 0 / 50 / 50 | {"description":"magic heavy belt + jewel + rune 07 + perfect sapphire -> hitpower belt","enabled":1,"version":100,"numinputs":4,"input 1":"\"tbl,mag,upg\"","input 2":"jew","input 3":"r07","input 4":"gpb","output":"\"usetype,crf\"","plvl":50,"ilvl":50,"mod 1":"gethit-skill","mod 1 param":44,"mod 1 min":5,"mod 1 max":4,"mod 2":"thorns","mod 2 min":3,"mod 2 max":7,"mod 3":"dmg-to-mana","mod 3 min":5,"mod 3 max":10,"expansion":1} |
| cube:68 | magic gothic shield + jewel + rune 05 + perfect sapphire -> hitpower shield | 1 | 100 | 0 | 4 | gts,mag,upg + jew + r05 + gpb | usetype,crf | 0 / 50 / 50 | {"description":"magic gothic shield + jewel + rune 05 + perfect sapphire -> hitpower shield","enabled":1,"version":100,"numinputs":4,"input 1":"\"gts,mag,upg\"","input 2":"jew","input 3":"r05","input 4":"gpb","output":"\"usetype,crf\"","plvl":50,"ilvl":50,"mod 1":"gethit-skill","mod 1 param":44,"mod 1 min":5,"mod 1 max":4,"mod 2":"thorns","mod 2 min":3,"mod 2 max":10,"mod 3":"block","mod 3 min":5,"mod 3 max":10,"expansion":1} |
| cube:69 | magic field plate + jewel + rune 04 + perfect sapphire -> hitpower body | 1 | 100 | 0 | 4 | fld,mag,upg + jew + r04 + gpb | usetype,crf | 0 / 50 / 50 | {"description":"magic field plate + jewel + rune 04 + perfect sapphire -> hitpower body","enabled":1,"version":100,"numinputs":4,"input 1":"\"fld,mag,upg\"","input 2":"jew","input 3":"r04","input 4":"gpb","output":"\"usetype,crf\"","plvl":50,"ilvl":50,"mod 1":"gethit-skill","mod 1 param":44,"mod 1 min":5,"mod 1 max":4,"mod 2":"thorns","mod 2 min":3,"mod 2 max":10,"mod 3":"balance1","mod 3 min":10,"mod 3 max":20,"expansion":1} |
| cube:70 | magic amulet + jewel + rune 10 + perfect sapphire -> hitpower amulet | 1 | 100 | 0 | 4 | amul,mag + jew + r10 + gpb | usetype,crf | 0 / 50 / 50 | {"description":"magic amulet + jewel + rune 10 + perfect sapphire -> hitpower amulet","enabled":1,"version":100,"numinputs":4,"input 1":"\"amul,mag\"","input 2":"jew","input 3":"r10","input 4":"gpb","output":"\"usetype,crf\"","plvl":50,"ilvl":50,"mod 1":"gethit-skill","mod 1 param":44,"mod 1 min":5,"mod 1 max":4,"mod 2":"thorns","mod 2 min":3,"mod 2 max":10,"mod 3":"howl","mod 3 min":5,"mod 3 max":15,"expansion":1} |
| cube:71 | magic ring + jewel + rune 11 + perfect sapphire -> hitpower ring | 1 | 100 | 0 | 4 | ring,mag + jew + r11 + gpb | usetype,crf | 0 / 50 / 50 | {"description":"magic ring + jewel + rune 11 + perfect sapphire -> hitpower ring","enabled":1,"version":100,"numinputs":4,"input 1":"\"ring,mag\"","input 2":"jew","input 3":"r11","input 4":"gpb","output":"\"usetype,crf\"","plvl":50,"ilvl":50,"mod 1":"gethit-skill","mod 1 param":44,"mod 1 min":5,"mod 1 max":4,"mod 2":"thorns","mod 2 min":3,"mod 2 max":6,"mod 3":"dex","mod 3 min":1,"mod 3 max":5,"expansion":1} |
| cube:72 | magic blunt + jewel + rune 03 + perfect sapphire -> hitpower weapon | 1 | 100 | 0 | 4 | blun,mag + jew + r03 + gpb | usetype,crf | 0 / 50 / 50 | {"description":"magic blunt + jewel + rune 03 + perfect sapphire -> hitpower weapon","enabled":1,"version":100,"numinputs":4,"input 1":"\"blun,mag\"","input 2":"jew","input 3":"r03","input 4":"gpb","output":"\"usetype,crf\"","plvl":50,"ilvl":50,"mod 1":"gethit-skill","mod 1 param":44,"mod 1 min":5,"mod 1 max":4,"mod 2":"thorns","mod 2 min":3,"mod 2 max":7,"mod 3":"dmg%","mod 3 min":35,"mod 3 max":60,"expansion":1} |
| cube:73 | magic helm + jewel + rune 08 + perfect ruby -> blood helm | 1 | 100 | 0 | 4 | hlm,mag,upg + jew + r08 + gpr | usetype,crf | 0 / 50 / 50 | {"description":"magic helm + jewel + rune 08 + perfect ruby -> blood helm","enabled":1,"version":100,"numinputs":4,"input 1":"\"hlm,mag,upg\"","input 2":"jew","input 3":"r08","input 4":"gpr","output":"\"usetype,crf\"","plvl":50,"ilvl":50,"mod 1":"lifesteal","mod 1 min":1,"mod 1 max":3,"mod 2":"hp","mod 2 min":10,"mod 2 max":20,"mod 3":"deadly","mod 3 min":5,"mod 3 max":10,"expansion":1} |
| cube:74 | magic light plated boots + jewel + rune 05 + perfect ruby -> blood boots | 1 | 100 | 0 | 4 | tbt,mag,upg + jew + r05 + gpr | usetype,crf | 0 / 50 / 50 | {"description":"magic light plated boots + jewel + rune 05 + perfect ruby -> blood boots","enabled":1,"version":100,"numinputs":4,"input 1":"\"tbt,mag,upg\"","input 2":"jew","input 3":"r05","input 4":"gpr","output":"\"usetype,crf\"","plvl":50,"ilvl":50,"mod 1":"lifesteal","mod 1 min":1,"mod 1 max":3,"mod 2":"hp","mod 2 min":10,"mod 2 max":20,"mod 3":"regen","mod 3 min":5,"mod 3 max":10,"expansion":1} |
| cube:75 | magic heavy gloves + jewel + rune 04 + perfect ruby -> blood gloves | 1 | 100 | 0 | 4 | vgl,mag,upg + jew + r04 + gpr | usetype,crf | 0 / 50 / 50 | {"description":"magic heavy gloves + jewel + rune 04 + perfect ruby -> blood gloves","enabled":1,"version":100,"numinputs":4,"input 1":"\"vgl,mag,upg\"","input 2":"jew","input 3":"r04","input 4":"gpr","output":"\"usetype,crf\"","plvl":50,"ilvl":50,"mod 1":"lifesteal","mod 1 min":1,"mod 1 max":3,"mod 2":"hp","mod 2 min":10,"mod 2 max":20,"mod 3":"crush","mod 3 min":5,"mod 3 max":10,"expansion":1} |
| cube:76 | magic belt + jewel + rune 07 + perfect ruby -> blood belt | 1 | 100 | 0 | 4 | mbl,mag,upg + jew + r07 + gpr | usetype,crf | 0 / 50 / 50 | {"description":"magic belt + jewel + rune 07 + perfect ruby -> blood belt","enabled":1,"version":100,"numinputs":4,"input 1":"\"mbl,mag,upg\"","input 2":"jew","input 3":"r07","input 4":"gpr","output":"\"usetype,crf\"","plvl":50,"ilvl":50,"mod 1":"lifesteal","mod 1 min":1,"mod 1 max":3,"mod 2":"hp","mod 2 min":10,"mod 2 max":20,"mod 3":"openwounds","mod 3 min":5,"mod 3 max":10,"expansion":1} |
| cube:77 | magic spiked shield + jewel + rune 06 + perfect ruby -> blood shield | 1 | 100 | 0 | 4 | spk,mag,upg + jew + r06 + gpr | usetype,crf | 0 / 50 / 50 | {"description":"magic spiked shield + jewel + rune 06 + perfect ruby -> blood shield","enabled":1,"version":100,"numinputs":4,"input 1":"\"spk,mag,upg\"","input 2":"jew","input 3":"r06","input 4":"gpr","output":"\"usetype,crf\"","plvl":50,"ilvl":50,"mod 1":"lifesteal","mod 1 min":1,"mod 1 max":3,"mod 2":"hp","mod 2 min":10,"mod 2 max":20,"mod 3":"thorns","mod 3 min":4,"mod 3 max":7,"expansion":1} |
| cube:78 | magic plate mail + jewel + rune 10 + perfect ruby -> blood body | 1 | 100 | 0 | 4 | plt,mag,upg + jew + r10 + gpr | usetype,crf | 0 / 50 / 50 | {"description":"magic plate mail + jewel + rune 10 + perfect ruby -> blood body","enabled":1,"version":100,"numinputs":4,"input 1":"\"plt,mag,upg\"","input 2":"jew","input 3":"r10","input 4":"gpr","output":"\"usetype,crf\"","plvl":50,"ilvl":50,"mod 1":"lifesteal","mod 1 min":1,"mod 1 max":3,"mod 2":"hp","mod 2 min":10,"mod 2 max":20,"mod 3":"demon-heal","mod 3 min":1,"mod 3 max":3,"expansion":1} |
| cube:79 | magic amulet + jewel + rune 11 + perfect ruby -> blood amulet | 1 | 100 | 0 | 4 | amul,mag + jew + r11 + gpr | usetype,crf | 0 / 50 / 50 | {"description":"magic amulet + jewel + rune 11 + perfect ruby -> blood amulet","enabled":1,"version":100,"numinputs":4,"input 1":"\"amul,mag\"","input 2":"jew","input 3":"r11","input 4":"gpr","output":"\"usetype,crf\"","plvl":50,"ilvl":50,"mod 1":"lifesteal","mod 1 min":1,"mod 1 max":4,"mod 2":"hp","mod 2 min":10,"mod 2 max":20,"mod 3":"move1","mod 3 min":5,"mod 3 max":10,"expansion":1} |
| cube:80 | magic ring + jewel + rune 12 + perfect ruby -> blood ring | 1 | 100 | 0 | 4 | ring,mag + jew + r12 + gpr | usetype,crf | 0 / 50 / 50 | {"description":"magic ring + jewel + rune 12 + perfect ruby -> blood ring","enabled":1,"version":100,"numinputs":4,"input 1":"\"ring,mag\"","input 2":"jew","input 3":"r12","input 4":"gpr","output":"\"usetype,crf\"","plvl":50,"ilvl":50,"mod 1":"lifesteal","mod 1 min":1,"mod 1 max":3,"mod 2":"hp","mod 2 min":10,"mod 2 max":20,"mod 3":"str","mod 3 min":1,"mod 3 max":5,"expansion":1} |
| cube:81 | magic axe + jewel + rune 09 + perfect ruby -> blood weapon | 1 | 100 | 0 | 4 | axe,mag + jew + r09 + gpr | usetype,crf | 0 / 50 / 50 | {"description":"magic axe + jewel + rune 09 + perfect ruby -> blood weapon","enabled":1,"version":100,"numinputs":4,"input 1":"\"axe,mag\"","input 2":"jew","input 3":"r09","input 4":"gpr","output":"\"usetype,crf\"","plvl":50,"ilvl":50,"mod 1":"lifesteal","mod 1 min":1,"mod 1 max":4,"mod 2":"hp","mod 2 min":10,"mod 2 max":20,"mod 3":"dmg%","mod 3 min":35,"mod 3 max":60,"expansion":1} |
| cube:82 | magic mask + jewel + rune 04 + perfect amethyst -> caster helm | 1 | 100 | 0 | 4 | msk,mag,upg + jew + r04 + gpv | usetype,crf | 0 / 50 / 50 | {"description":"magic mask + jewel + rune 04 + perfect amethyst -> caster helm","enabled":1,"version":100,"numinputs":4,"input 1":"\"msk,mag,upg\"","input 2":"jew","input 3":"r04","input 4":"gpv","output":"\"usetype,crf\"","plvl":50,"ilvl":50,"mod 1":"regen-mana","mod 1 min":4,"mod 1 max":10,"mod 2":"mana","mod 2 min":10,"mod 2 max":20,"mod 3":"manasteal","mod 3 min":1,"mod 3 max":4,"expansion":1} |
| cube:83 | magic boots + jewel + rune 10 + perfect amethyst -> caster boots | 1 | 100 | 0 | 4 | lbt,mag,upg + jew + r10 + gpv | usetype,crf | 0 / 50 / 50 | {"description":"magic boots + jewel + rune 10 + perfect amethyst -> caster boots","enabled":1,"version":100,"numinputs":4,"input 1":"\"lbt,mag,upg\"","input 2":"jew","input 3":"r10","input 4":"gpv","output":"\"usetype,crf\"","plvl":50,"ilvl":50,"mod 1":"regen-mana","mod 1 min":4,"mod 1 max":10,"mod 2":"mana","mod 2 min":10,"mod 2 max":20,"mod 3":"mana%","mod 3 min":2,"mod 3 max":5,"expansion":1} |
| cube:84 | magic leather gloves + jewel + rune 09 + perfect amethyst -> caster gloves | 1 | 100 | 0 | 4 | lgl,mag,upg + jew + r09 + gpv | usetype,crf | 0 / 50 / 50 | {"description":"magic leather gloves + jewel + rune 09 + perfect amethyst -> caster gloves","enabled":1,"version":100,"numinputs":4,"input 1":"\"lgl,mag,upg\"","input 2":"jew","input 3":"r09","input 4":"gpv","output":"\"usetype,crf\"","plvl":50,"ilvl":50,"mod 1":"regen-mana","mod 1 min":4,"mod 1 max":10,"mod 2":"mana","mod 2 min":10,"mod 2 max":20,"mod 3":"mana-kill","mod 3 min":1,"mod 3 max":3,"expansion":1} |
| cube:85 | magic light belt + jewel + rune 06 + perfect amethyst -> caster belt | 1 | 100 | 0 | 4 | vbl,mag,upg + jew + r06 + gpv | usetype,crf | 0 / 50 / 50 | {"description":"magic light belt + jewel + rune 06 + perfect amethyst -> caster belt","enabled":1,"version":100,"numinputs":4,"input 1":"\"vbl,mag,upg\"","input 2":"jew","input 3":"r06","input 4":"gpv","output":"\"usetype,crf\"","plvl":50,"ilvl":50,"mod 1":"regen-mana","mod 1 min":4,"mod 1 max":10,"mod 2":"mana","mod 2 min":10,"mod 2 max":20,"mod 3":"cast1","mod 3 min":5,"mod 3 max":10,"expansion":1} |
| cube:86 | magic small shield + jewel + rune 05 + perfect amethyst -> caster shield | 1 | 100 | 0 | 4 | sml,mag,upg + jew + r05 + gpv | usetype,crf | 0 / 50 / 50 | {"description":"magic small shield + jewel + rune 05 + perfect amethyst -> caster shield","enabled":1,"version":100,"numinputs":4,"input 1":"\"sml,mag,upg\"","input 2":"jew","input 3":"r05","input 4":"gpv","output":"\"usetype,crf\"","plvl":50,"ilvl":50,"mod 1":"regen-mana","mod 1 min":4,"mod 1 max":10,"mod 2":"mana","mod 2 min":10,"mod 2 max":20,"mod 3":"block","mod 3 min":5,"mod 3 max":10,"expansion":1} |
| cube:87 | magic light plate + jewel + rune 07 + perfect amethyst -> caster body | 1 | 100 | 0 | 4 | ltp,mag,upg + jew + r07 + gpv | usetype,crf | 0 / 50 / 50 | {"description":"magic light plate + jewel + rune 07 + perfect amethyst -> caster body","enabled":1,"version":100,"numinputs":4,"input 1":"\"ltp,mag,upg\"","input 2":"jew","input 3":"r07","input 4":"gpv","output":"\"usetype,crf\"","plvl":50,"ilvl":50,"mod 1":"regen-mana","mod 1 min":4,"mod 1 max":10,"mod 2":"mana","mod 2 min":10,"mod 2 max":20,"mod 3":"mana-kill","mod 3 min":1,"mod 3 max":3,"expansion":1} |
| cube:88 | magic amulet + jewel + rune 08 + perfect amethyst -> caster amulet | 1 | 100 | 0 | 4 | amul,mag + jew + r08 + gpv | usetype,crf | 0 / 50 / 50 | {"description":"magic amulet + jewel + rune 08 + perfect amethyst -> caster amulet","enabled":1,"version":100,"numinputs":4,"input 1":"\"amul,mag\"","input 2":"jew","input 3":"r08","input 4":"gpv","output":"\"usetype,crf\"","plvl":50,"ilvl":50,"mod 1":"regen-mana","mod 1 min":4,"mod 1 max":10,"mod 2":"mana","mod 2 min":10,"mod 2 max":20,"mod 3":"cast1","mod 3 min":5,"mod 3 max":10,"expansion":1} |
| cube:89 | magic ring + jewel + rune 11 + perfect amethyst -> caster ring | 1 | 100 | 0 | 4 | ring,mag + jew + r11 + gpv | usetype,crf | 0 / 50 / 50 | {"description":"magic ring + jewel + rune 11 + perfect amethyst -> caster ring","enabled":1,"version":100,"numinputs":4,"input 1":"\"ring,mag\"","input 2":"jew","input 3":"r11","input 4":"gpv","output":"\"usetype,crf\"","plvl":50,"ilvl":50,"mod 1":"regen-mana","mod 1 min":4,"mod 1 max":10,"mod 2":"mana","mod 2 min":10,"mod 2 max":20,"mod 3":"enr","mod 3 min":1,"mod 3 max":5,"expansion":1} |
| cube:90 | magic rod + jewel + rune 03 + perfect amethyst -> caster weapon | 1 | 100 | 0 | 4 | rod,mag + jew + r03 + gpv | usetype,crf | 0 / 50 / 50 | {"description":"magic rod + jewel + rune 03 + perfect amethyst -> caster weapon","enabled":1,"version":100,"numinputs":4,"input 1":"\"rod,mag\"","input 2":"jew","input 3":"r03","input 4":"gpv","output":"\"usetype,crf\"","plvl":50,"ilvl":50,"mod 1":"regen-mana","mod 1 min":4,"mod 1 max":10,"mod 2":"mana","mod 2 min":10,"mod 2 max":20,"mod 3":"mana%","mod 3 min":1,"mod 3 max":5,"expansion":1} |
| cube:91 | magic crown + jewel + rune 06 + perfect emerald -> safety helm | 1 | 100 | 0 | 4 | crn,mag,upg + jew + r06 + gpg | usetype,crf | 0 / 50 / 50 | {"description":"magic crown + jewel + rune 06 + perfect emerald -> safety helm","enabled":1,"version":100,"numinputs":4,"input 1":"\"crn,mag,upg\"","input 2":"jew","input 3":"r06","input 4":"gpg","output":"\"usetype,crf\"","plvl":50,"ilvl":50,"mod 1":"red-dmg","mod 1 min":1,"mod 1 max":4,"mod 2":"red-mag","mod 2 min":1,"mod 2 max":2,"mod 3":"res-ltng","mod 3 min":5,"mod 3 max":10,"mod 4":"ac%","mod 4 min":10,"mod 4 max":30,"expansion":1} |
| cube:92 | magic plate boots + jewel + rune 09 + perfect emerald -> safety boots | 1 | 100 | 0 | 4 | hbt,mag,upg + jew + r09 + gpg | usetype,crf | 0 / 50 / 50 | {"description":"magic plate boots + jewel + rune 09 + perfect emerald -> safety boots","enabled":1,"version":100,"numinputs":4,"input 1":"\"hbt,mag,upg\"","input 2":"jew","input 3":"r09","input 4":"gpg","output":"\"usetype,crf\"","plvl":50,"ilvl":50,"mod 1":"red-dmg","mod 1 min":1,"mod 1 max":4,"mod 2":"red-mag","mod 2 min":1,"mod 2 max":2,"mod 3":"res-fire","mod 3 min":5,"mod 3 max":10,"mod 4":"ac%","mod 4 min":10,"mod 4 max":30,"expansion":1} |
| cube:93 | magic gauntlets + jewel + rune 08 + perfect emerald -> safety gloves | 1 | 100 | 0 | 4 | hgl,mag,upg + jew + r08 + gpg | usetype,crf | 0 / 50 / 50 | {"description":"magic gauntlets + jewel + rune 08 + perfect emerald -> safety gloves","enabled":1,"version":100,"numinputs":4,"input 1":"\"hgl,mag,upg\"","input 2":"jew","input 3":"r08","input 4":"gpg","output":"\"usetype,crf\"","plvl":50,"ilvl":50,"mod 1":"red-dmg","mod 1 min":1,"mod 1 max":4,"mod 2":"red-mag","mod 2 min":1,"mod 2 max":2,"mod 3":"res-cold","mod 3 min":5,"mod 3 max":10,"mod 4":"ac%","mod 4 min":10,"mod 4 max":30,"expansion":1} |
| cube:94 | magic sash + jewel + rune 07 + perfect emerald -> safety belt | 1 | 100 | 0 | 4 | lbl,mag,upg + jew + r07 + gpg | usetype,crf | 0 / 50 / 50 | {"description":"magic sash + jewel + rune 07 + perfect emerald -> safety belt","enabled":1,"version":100,"numinputs":4,"input 1":"\"lbl,mag,upg\"","input 2":"jew","input 3":"r07","input 4":"gpg","output":"\"usetype,crf\"","plvl":50,"ilvl":50,"mod 1":"red-dmg","mod 1 min":1,"mod 1 max":4,"mod 2":"red-mag","mod 2 min":1,"mod 2 max":2,"mod 3":"res-pois","mod 3 min":5,"mod 3 max":10,"mod 4":"ac%","mod 4 min":10,"mod 4 max":30,"expansion":1} |
| cube:95 | magic kite shield + jewel + rune 04 + perfect emerald -> safety shield | 1 | 100 | 0 | 4 | kit,mag,upg + jew + r04 + gpg | usetype,crf | 0 / 50 / 50 | {"description":"magic kite shield + jewel + rune 04 + perfect emerald -> safety shield","enabled":1,"version":100,"numinputs":4,"input 1":"\"kit,mag,upg\"","input 2":"jew","input 3":"r04","input 4":"gpg","output":"\"usetype,crf\"","plvl":50,"ilvl":50,"mod 1":"red-dmg","mod 1 min":1,"mod 1 max":4,"mod 2":"red-mag","mod 2 min":1,"mod 2 max":2,"mod 3":"res-mag","mod 3 min":5,"mod 3 max":10,"mod 4":"ac%","mod 4 min":10,"mod 4 max":30,"expansion":1} |
| cube:96 | magic breastplate + jewel + rune 05 + perfect emerald -> safety body | 1 | 100 | 0 | 4 | brs,mag,upg + jew + r05 + gpg | usetype,crf | 0 / 50 / 50 | {"description":"magic breastplate + jewel + rune 05 + perfect emerald -> safety body","enabled":1,"version":100,"numinputs":4,"input 1":"\"brs,mag,upg\"","input 2":"jew","input 3":"r05","input 4":"gpg","output":"\"usetype,crf\"","plvl":50,"ilvl":50,"mod 1":"red-dmg","mod 1 min":1,"mod 1 max":4,"mod 2":"red-mag","mod 2 min":1,"mod 2 max":2,"mod 3":"half-freeze","mod 3 min":1,"mod 3 max":1,"mod 4":"ac%","mod 4 min":10,"mod 4 max":30,"expansion":1} |
| cube:97 | magic amulet + jewel + rune 10 + perfect emerald -> safety amulet | 1 | 100 | 0 | 4 | amul,mag + jew + r10 + gpg | usetype,crf | 0 / 50 / 50 | {"description":"magic amulet + jewel + rune 10 + perfect emerald -> safety amulet","enabled":1,"version":100,"numinputs":4,"input 1":"\"amul,mag\"","input 2":"jew","input 3":"r10","input 4":"gpg","output":"\"usetype,crf\"","plvl":50,"ilvl":50,"mod 1":"red-dmg","mod 1 min":1,"mod 1 max":4,"mod 2":"red-mag","mod 2 min":1,"mod 2 max":2,"mod 3":"block","mod 3 min":1,"mod 3 max":10,"expansion":1} |
| cube:98 | magic ring + jewel + rune 11 + perfect emerald -> safety ring | 1 | 100 | 0 | 4 | ring,mag + jew + r11 + gpg | usetype,crf | 0 / 50 / 50 | {"description":"magic ring + jewel + rune 11 + perfect emerald -> safety ring","enabled":1,"version":100,"numinputs":4,"input 1":"\"ring,mag\"","input 2":"jew","input 3":"r11","input 4":"gpg","output":"\"usetype,crf\"","plvl":50,"ilvl":50,"mod 1":"red-dmg","mod 1 min":1,"mod 1 max":4,"mod 2":"red-mag","mod 2 min":1,"mod 2 max":2,"mod 3":"vit","mod 3 min":1,"mod 3 max":5,"expansion":1} |
| cube:99 | magic spear + jewel + rune 12 + perfect emerald -> safety weapon | 1 | 100 | 0 | 4 | spea,mag + jew + r12 + gpg | usetype,crf | 0 / 50 / 50 | {"description":"magic spear + jewel + rune 12 + perfect emerald -> safety weapon","enabled":1,"version":100,"numinputs":4,"input 1":"\"spea,mag\"","input 2":"jew","input 3":"r12","input 4":"gpg","output":"\"usetype,crf\"","plvl":50,"ilvl":50,"mod 1":"red-dmg","mod 1 min":1,"mod 1 max":4,"mod 2":"red-mag","mod 2 min":1,"mod 2 max":2,"mod 3":"ac%","mod 3 min":5,"mod 3 max":10,"expansion":1} |
| cube:100 | 3 rune 10 + 1 chipped topaz -> rune 11 | 1 | 100 | 0 | 4 | r10,qty=3 + gcy | r11 | 0 / 0 / 0 | {"description":"3 rune 10 + 1 chipped topaz -> rune 11","enabled":1,"version":100,"numinputs":4,"input 1":"\"r10,qty=3\"","input 2":"gcy","output":"r11","expansion":1} |
| cube:101 | 3 rune 11 + 1 chipped amethyst -> rune 12 | 1 | 100 | 0 | 4 | r11,qty=3 + gcv | r12 | 0 / 0 / 0 | {"description":"3 rune 11 + 1 chipped amethyst -> rune 12","enabled":1,"version":100,"numinputs":4,"input 1":"\"r11,qty=3\"","input 2":"gcv","output":"r12","expansion":1} |
| cube:102 | 3 rune 12 + 1 chipped sapphire -> rune 13 | 1 | 100 | 0 | 4 | r12,qty=3 + gcb | r13 | 0 / 0 / 0 | {"description":"3 rune 12 + 1 chipped sapphire -> rune 13","enabled":1,"version":100,"numinputs":4,"input 1":"\"r12,qty=3\"","input 2":"gcb","output":"r13","expansion":1} |
| cube:103 | 3 rune 13 + 1 chipped ruby -> rune 14 | 1 | 100 | 0 | 4 | r13,qty=3 + gcr | r14 | 0 / 0 / 0 | {"description":"3 rune 13 + 1 chipped ruby -> rune 14","enabled":1,"version":100,"numinputs":4,"input 1":"\"r13,qty=3\"","input 2":"gcr","output":"r14","expansion":1} |
| cube:104 | 3 rune 14 + 1 chipped emerald -> rune 15 | 1 | 100 | 1 | 4 | r14,qty=3 + gcg | r15 | 0 / 0 / 0 | {"description":"3 rune 14 + 1 chipped emerald -> rune 15","enabled":1,"ladder":1,"version":100,"numinputs":4,"input 1":"\"r14,qty=3\"","input 2":"gcg","output":"r15","expansion":1} |
| cube:105 | 3 rune 15 + 1 chipped diamond -> rune 16 | 1 | 100 | 1 | 4 | r15,qty=3 + gcw | r16 | 0 / 0 / 0 | {"description":"3 rune 15 + 1 chipped diamond -> rune 16","enabled":1,"ladder":1,"version":100,"numinputs":4,"input 1":"\"r15,qty=3\"","input 2":"gcw","output":"r16","expansion":1} |
| cube:106 | 3 rune 16 + 1 flawed topaz -> rune 17 | 1 | 100 | 1 | 4 | r16,qty=3 + gfy | r17 | 0 / 0 / 0 | {"description":"3 rune 16 + 1 flawed topaz -> rune 17","enabled":1,"ladder":1,"version":100,"numinputs":4,"input 1":"\"r16,qty=3\"","input 2":"gfy","output":"r17","expansion":1} |
| cube:107 | 3 rune 17 + 1 flawed amethyst -> rune 18 | 1 | 100 | 1 | 4 | r17,qty=3 + gfv | r18 | 0 / 0 / 0 | {"description":"3 rune 17 + 1 flawed amethyst -> rune 18","enabled":1,"ladder":1,"version":100,"numinputs":4,"input 1":"\"r17,qty=3\"","input 2":"gfv","output":"r18","expansion":1} |
| cube:108 | 3 rune 18 + 1 flawed sapphire -> rune 19 | 1 | 100 | 1 | 4 | r18,qty=3 + gfb | r19 | 0 / 0 / 0 | {"description":"3 rune 18 + 1 flawed sapphire -> rune 19","enabled":1,"ladder":1,"version":100,"numinputs":4,"input 1":"\"r18,qty=3\"","input 2":"gfb","output":"r19","expansion":1} |
| cube:109 | 3 rune 19 + 1 flawed ruby -> rune 20 | 1 | 100 | 1 | 4 | r19,qty=3 + gfr | r20 | 0 / 0 / 0 | {"description":"3 rune 19 + 1 flawed ruby -> rune 20","enabled":1,"ladder":1,"version":100,"numinputs":4,"input 1":"\"r19,qty=3\"","input 2":"gfr","output":"r20","expansion":1} |
| cube:110 | 3 rune 20 + 1 flawed emerald -> rune 21 | 1 | 100 | 1 | 4 | r20,qty=3 + gfg | r21 | 0 / 0 / 0 | {"description":"3 rune 20 + 1 flawed emerald -> rune 21","enabled":1,"ladder":1,"version":100,"numinputs":4,"input 1":"\"r20,qty=3\"","input 2":"gfg","output":"r21","expansion":1} |
| cube:111 | 2 rune 21 + 1 flawed diamond -> rune 22 | 1 | 100 | 1 | 3 | r21,qty=2 + gfw | r22 | 0 / 0 / 0 | {"description":"2 rune 21 + 1 flawed diamond -> rune 22","enabled":1,"ladder":1,"version":100,"numinputs":3,"input 1":"\"r21,qty=2\"","input 2":"gfw","output":"r22","expansion":1} |
| cube:112 | 2 rune 22 + 1 standard topaz -> rune 23 | 1 | 100 | 1 | 3 | r22,qty=2 + gsy | r23 | 0 / 0 / 0 | {"description":"2 rune 22 + 1 standard topaz -> rune 23","enabled":1,"ladder":1,"version":100,"numinputs":3,"input 1":"\"r22,qty=2\"","input 2":"gsy","output":"r23","expansion":1} |
| cube:113 | 2 rune 23 + 1 standard amethyst -> rune 24 | 1 | 100 | 1 | 3 | r23,qty=2 + gsv | r24 | 0 / 0 / 0 | {"description":"2 rune 23 + 1 standard amethyst -> rune 24","enabled":1,"ladder":1,"version":100,"numinputs":3,"input 1":"\"r23,qty=2\"","input 2":"gsv","output":"r24","expansion":1} |
| cube:114 | 2 rune 24 + 1 standard sapphire -> rune 25 | 1 | 100 | 1 | 3 | r24,qty=2 + gsb | r25 | 0 / 0 / 0 | {"description":"2 rune 24 + 1 standard sapphire -> rune 25","enabled":1,"ladder":1,"version":100,"numinputs":3,"input 1":"\"r24,qty=2\"","input 2":"gsb","output":"r25","expansion":1} |
| cube:115 | 2 rune 25 + 1 standard ruby -> rune 26 | 1 | 100 | 1 | 3 | r25,qty=2 + gsr | r26 | 0 / 0 / 0 | {"description":"2 rune 25 + 1 standard ruby -> rune 26","enabled":1,"ladder":1,"version":100,"numinputs":3,"input 1":"\"r25,qty=2\"","input 2":"gsr","output":"r26","expansion":1} |
| cube:116 | 2 rune 26 + 1 standard emerald -> rune 27 | 1 | 100 | 1 | 3 | r26,qty=2 + gsg | r27 | 0 / 0 / 0 | {"description":"2 rune 26 + 1 standard emerald -> rune 27","enabled":1,"ladder":1,"version":100,"numinputs":3,"input 1":"\"r26,qty=2\"","input 2":"gsg","output":"r27","expansion":1} |
| cube:117 | 2 rune 27 + 1 standard diamond -> rune 28 | 1 | 100 | 1 | 3 | r27,qty=2 + gsw | r28 | 0 / 0 / 0 | {"description":"2 rune 27 + 1 standard diamond -> rune 28","enabled":1,"ladder":1,"version":100,"numinputs":3,"input 1":"\"r27,qty=2\"","input 2":"gsw","output":"r28","expansion":1} |
| cube:118 | 2 rune 28 + 1 flawless topaz -> rune 29 | 1 | 100 | 1 | 3 | r28,qty=2 + gly | r29 | 0 / 0 / 0 | {"description":"2 rune 28 + 1 flawless topaz -> rune 29","enabled":1,"ladder":1,"version":100,"numinputs":3,"input 1":"\"r28,qty=2\"","input 2":"gly","output":"r29","expansion":1} |
| cube:119 | 2 rune 29 + 1 flawless amethyst -> rune 30 | 1 | 100 | 1 | 3 | r29,qty=2 + gzv | r30 | 0 / 0 / 0 | {"description":"2 rune 29 + 1 flawless amethyst -> rune 30","enabled":1,"ladder":1,"version":100,"numinputs":3,"input 1":"\"r29,qty=2\"","input 2":"gzv","output":"r30","expansion":1} |
| cube:120 | 2 rune 30 + 1 flawless sapphire -> rune 31 | 1 | 100 | 1 | 3 | r30,qty=2 + glb | r31 | 0 / 0 / 0 | {"description":"2 rune 30 + 1 flawless sapphire -> rune 31","enabled":1,"ladder":1,"version":100,"numinputs":3,"input 1":"\"r30,qty=2\"","input 2":"glb","output":"r31","expansion":1} |
| cube:121 | 2 rune 31 + 1 flawless ruby -> rune 32 | 1 | 100 | 1 | 3 | r31,qty=2 + glr | r32 | 0 / 0 / 0 | {"description":"2 rune 31 + 1 flawless ruby -> rune 32","enabled":1,"ladder":1,"version":100,"numinputs":3,"input 1":"\"r31,qty=2\"","input 2":"glr","output":"r32","expansion":1} |
| cube:122 | 2 rune 32 + 1 flawless emerald -> rune 33 | 1 | 100 | 1 | 3 | r32,qty=2 + glg | r33 | 0 / 0 / 0 | {"description":"2 rune 32 + 1 flawless emerald -> rune 33","enabled":1,"ladder":1,"version":100,"numinputs":3,"input 1":"\"r32,qty=2\"","input 2":"glg","output":"r33","expansion":1} |
| cube:123 | r07 + r10 + 1 perfect topaz + normal torso -> socketed torso | 1 | 100 | 0 | 4 | tors,nor,nos + r07 + r10 + gpy | useitem | 0 / 0 / 0 | {"description":"r07 + r10 + 1 perfect topaz + normal torso -> socketed torso","enabled":1,"version":100,"numinputs":4,"input 1":"\"tors,nor,nos\"","input 2":"r07","input 3":"r10","input 4":"gpy","output":"useitem","mod 1":"sock","mod 1 min":1,"mod 1 max":6,"expansion":1} |
| cube:124 | r08 + r11 + 1 perfect amethyst + normal weapon -> socketed weapon | 1 | 100 | 0 | 4 | weap,nor,nos + r08 + r11 + gpv | useitem | 0 / 0 / 0 | {"description":"r08 + r11 + 1 perfect amethyst + normal weapon -> socketed weapon","enabled":1,"version":100,"numinputs":4,"input 1":"\"weap,nor,nos\"","input 2":"r08","input 3":"r11","input 4":"gpv","output":"useitem","mod 1":"sock","mod 1 min":1,"mod 1 max":6,"expansion":1} |
| cube:125 | r08 + r10 + 1 perfect sapphire + normal helm -> socketed helm | 1 | 100 | 0 | 4 | helm,nor,nos + r08 + r10 + gpb | useitem | 0 / 0 / 0 | {"description":"r08 + r10 + 1 perfect sapphire + normal helm -> socketed helm","enabled":1,"version":100,"numinputs":4,"input 1":"\"helm,nor,nos\"","input 2":"r08","input 3":"r10","input 4":"gpb","output":"useitem","mod 1":"sock","mod 1 min":1,"mod 1 max":6,"expansion":1} |
| cube:126 | r07 + r11 + 1 perfect ruby + normal shield -> socketed shield | 1 | 100 | 0 | 4 | shld,nor,nos + r07 + r11 + gpr | useitem | 0 / 0 / 0 | {"description":"r07 + r11 + 1 perfect ruby + normal shield -> socketed shield","enabled":1,"version":100,"numinputs":4,"input 1":"\"shld,nor,nos\"","input 2":"r07","input 3":"r11","input 4":"gpr","output":"useitem","mod 1":"sock","mod 1 min":1,"mod 1 max":6,"expansion":1} |
| cube:127 | r02 + 1 chipped gem + low weapon -> normal weapon | 1 | 100 | 0 | 3 | weap,low + r02 + gem0 | usetype,nor | 0 / 0 / 0 | {"description":"r02 + 1 chipped gem + low weapon -> normal weapon","enabled":1,"version":100,"numinputs":3,"input 1":"\"weap,low\"","input 2":"r02","input 3":"gem0","output":"\"usetype,nor\"","expansion":1} |
| cube:128 | r01 + 1 chipped gem + low armor -> normal armor | 1 | 100 | 0 | 3 | armo,low + r01 + gem0 | usetype,nor | 0 / 0 / 0 | {"description":"r01 + 1 chipped gem + low armor -> normal armor","enabled":1,"version":100,"numinputs":3,"input 1":"\"armo,low\"","input 2":"r01","input 3":"gem0","output":"\"usetype,nor\"","expansion":1} |
| cube:129 | r08 + r12 + perfect emerald + basic unique weapon -> exceptional unique weapon | 1 | 100 | 0 | 4 | weap,bas,uni + r08 + r12 + gpg | useitem,mod,exc | 0 / 0 / 0 | {"description":"r08 + r12 + perfect emerald + basic unique weapon -> exceptional unique weapon","enabled":1,"version":100,"numinputs":4,"input 1":"\"weap,bas,uni\"","input 2":"r08","input 3":"r12","input 4":"gpg","output":"\"useitem,mod,exc\"","mod 1":"levelreq","mod 1 min":5,"mod 1 max":5,"expansion":1} |
| cube:130 | r07 + r13 + perfect diamond + basic unique armor -> exceptional unique armor | 1 | 100 | 0 | 4 | armo,bas,uni + r07 + r13 + gpw | useitem,mod,exc | 0 / 0 / 0 | {"description":"r07 + r13 + perfect diamond + basic unique armor -> exceptional unique armor","enabled":1,"version":100,"numinputs":4,"input 1":"\"armo,bas,uni\"","input 2":"r07","input 3":"r13","input 4":"gpw","output":"\"useitem,mod,exc\"","mod 1":"levelreq","mod 1 min":5,"mod 1 max":5,"expansion":1} |
| cube:131 | r17 + r21 + perfect emerald + exceptional unique weapon -> elite unique weapon | 1 | 100 | 1 | 4 | weap,exc,uni + r17 + r21 + gpg | useitem,mod,eli | 0 / 0 / 0 | {"description":"r17 + r21 + perfect emerald + exceptional unique weapon -> elite unique weapon","enabled":1,"ladder":1,"version":100,"numinputs":4,"input 1":"\"weap,exc,uni\"","input 2":"r17","input 3":"r21","input 4":"gpg","output":"\"useitem,mod,eli\"","mod 1":"levelreq","mod 1 min":7,"mod 1 max":7,"expansion":1} |
| cube:132 | r18 + r20 + perfect diamond + exceptional unique armor -> elite unique armor | 1 | 100 | 1 | 4 | armo,exc,uni + r18 + r20 + gpw | useitem,mod,eli | 0 / 0 / 0 | {"description":"r18 + r20 + perfect diamond + exceptional unique armor -> elite unique armor","enabled":1,"ladder":1,"version":100,"numinputs":4,"input 1":"\"armo,exc,uni\"","input 2":"r18","input 3":"r20","input 4":"gpw","output":"\"useitem,mod,eli\"","mod 1":"levelreq","mod 1 min":7,"mod 1 max":7,"expansion":1} |
| cube:133 | r09 + r11 + perfect sapphire + basic rare weapon -> exceptional rare weapon | 1 | 100 | 0 | 4 | weap,bas,rar + r09 + r11 + gpb | useitem,mod,exc | 0 / 0 / 0 | {"description":"r09 + r11 + perfect sapphire + basic rare weapon -> exceptional rare weapon","enabled":1,"version":100,"numinputs":4,"input 1":"\"weap,bas,rar\"","input 2":"r09","input 3":"r11","input 4":"gpb","output":"\"useitem,mod,exc\"","mod 1":"levelreq","mod 1 min":5,"mod 1 max":5,"expansion":1} |
| cube:134 | r08 + r10 + perfect amethyst + basic rare armor -> exceptional rare armor | 1 | 100 | 0 | 4 | armo,bas,rar + r08 + r10 + gpv | useitem,mod,exc | 0 / 0 / 0 | {"description":"r08 + r10 + perfect amethyst + basic rare armor -> exceptional rare armor","enabled":1,"version":100,"numinputs":4,"input 1":"\"armo,bas,rar\"","input 2":"r08","input 3":"r10","input 4":"gpv","output":"\"useitem,mod,exc\"","mod 1":"levelreq","mod 1 min":5,"mod 1 max":5,"expansion":1} |
| cube:135 | r19 + r22 + perfect sapphire + exceptional rare weapon -> elite rare weapon | 1 | 100 | 0 | 4 | weap,exc,rar + r19 + r22 + gpb | useitem,mod,eli | 0 / 0 / 0 | {"description":"r19 + r22 + perfect sapphire + exceptional rare weapon -> elite rare weapon","enabled":1,"version":100,"numinputs":4,"input 1":"\"weap,exc,rar\"","input 2":"r19","input 3":"r22","input 4":"gpb","output":"\"useitem,mod,eli\"","mod 1":"levelreq","mod 1 min":7,"mod 1 max":7,"expansion":1} |
| cube:136 | r18 + r21 + perfect amethyst + exceptional rare armor -> elite rare armor | 1 | 100 | 0 | 4 | armo,exc,rar + r18 + r21 + gpv | useitem,mod,eli | 0 / 0 / 0 | {"description":"r18 + r21 + perfect amethyst + exceptional rare armor -> elite rare armor","enabled":1,"version":100,"numinputs":4,"input 1":"\"armo,exc,rar\"","input 2":"r18","input 3":"r21","input 4":"gpv","output":"\"useitem,mod,eli\"","mod 1":"levelreq","mod 1 min":7,"mod 1 max":7,"expansion":1} |
| cube:137 | r09 + weapon -> repair | 1 | 100 | 0 | 2 | weap,noe + r09 | useitem,rep,qty=255 | 0 / 0 / 0 | {"description":"r09 + weapon -> repair","enabled":1,"version":100,"numinputs":2,"input 1":"\"weap,noe\"","input 2":"r09","output":"\"useitem,rep,qty=255\"","expansion":1} |
| cube:138 | r08 + armor -> repair | 1 | 100 | 0 | 2 | armo,noe + r08 | useitem,rep,qty=255 | 0 / 0 / 0 | {"description":"r08 + armor -> repair","enabled":1,"version":100,"numinputs":2,"input 1":"\"armo,noe\"","input 2":"r08","output":"\"useitem,rep,qty=255\"","expansion":1} |
| cube:139 | r09 + weapon + chipped gem -> repair + recharge | 1 | 100 | 0 | 3 | weap,noe + r09 + gem0 | useitem,rep,rch,qty=255 | 0 / 0 / 0 | {"description":"r09 + weapon + chipped gem -> repair + recharge","enabled":1,"version":100,"numinputs":3,"input 1":"\"weap,noe\"","input 2":"r09","input 3":"gem0","output":"\"useitem,rep,rch,qty=255\"","expansion":1} |
| cube:140 | r08 + armor + flawed gem -> repair + recharge | 1 | 100 | 0 | 3 | armo,noe + r08 + gem1 | useitem,rep,rch,qty=255 | 0 / 0 / 0 | {"description":"r08 + armor + flawed gem -> repair + recharge","enabled":1,"version":100,"numinputs":3,"input 1":"\"armo,noe\"","input 2":"r08","input 3":"gem1","output":"\"useitem,rep,rch,qty=255\"","expansion":1} |
| cube:141 | r15 + tsc + any socketed item -> unsocket (destroy gems) | 1 | 100 | 0 | 3 | any,sock + r15 + tsc | useitem,uns | 0 / 0 / 0 | {"description":"r15 + tsc + any socketed item -> unsocket (destroy gems)","enabled":1,"version":100,"numinputs":3,"input 1":"\"any,sock\"","input 2":"r15","input 3":"tsc","output":"\"useitem,uns\"","expansion":1} |
| cube:142 | r08 + jew + superior armor -> tempered armor | 0 | 100 | 0 | 3 | armo,hiq,nos + jew + r08 | useitem,tmp | 0 / 0 / 0 | {"description":"r08 + jew + superior armor -> tempered armor","version":100,"numinputs":3,"input 1":"\"armo,hiq,nos\"","input 2":"jew","input 3":"r08","output":"\"useitem,tmp\"","expansion":1} |
| cube:143 | r08 + jew + superior weapon -> tempered weapon | 0 | 100 | 0 | 3 | weap,hiq,nos + jew + r08 | useitem,tmp | 0 / 0 / 0 | {"description":"r08 + jew + superior weapon -> tempered weapon","version":100,"numinputs":3,"input 1":"\"weap,hiq,nos\"","input 2":"jew","input 3":"r08","output":"\"useitem,tmp\"","expansion":1} |
| cube:144 | r08 + jew + magic ring -> tempered ring | 0 | 100 | 0 | 3 | ring,mag + jew + r08 | usetype,tmp | 0 / 0 / 0 | {"description":"r08 + jew + magic ring -> tempered ring","version":100,"numinputs":3,"input 1":"\"ring,mag\"","input 2":"jew","input 3":"r08","output":"\"usetype,tmp\"","mod 1":"levelreq","mod 1 min":3,"mod 1 max":3,"expansion":1} |
| cube:145 | r08 + jew + magic amulet -> tempered amulet | 0 | 100 | 0 | 3 | amu,mag + jew + r08 | usetype,tmp | 0 / 0 / 0 | {"description":"r08 + jew + magic amulet -> tempered amulet","version":100,"numinputs":3,"input 1":"\"amu,mag\"","input 2":"jew","input 3":"r08","output":"\"usetype,tmp\"","mod 1":"levelreq","mod 1 min":5,"mod 1 max":5,"expansion":1} |
| cube:146 | r01 + gcv + tempered weapon -> +30-50 ar | 0 | 100 | 0 | 3 | weap,tmp + r01 + gcv | useitem | 0 / 0 / 0 | {"description":"r01 + gcv + tempered weapon -> +30-50 ar","version":100,"numinputs":3,"input 1":"\"weap,tmp\"","input 2":"r01","input 3":"gcv","output":"useitem","mod 1":"levelreq","mod 1 min":2,"mod 1 max":2,"mod 2":"att","mod 2 min":30,"mod 2 max":50,"expansion":1} |
| cube:147 | 3 chipped gems + 1 magic weapon -> socketed, magic weapon | 1 | 0 | 0 | 4 | weap,mag + gem0,qty=3 | usetype,mag | 25 / 0 / 50 | {"description":"\"3 chipped gems + 1 magic weapon -> socketed, magic weapon\"","enabled":1,"numinputs":4,"input 1":"\"weap,mag\"","input 2":"\"gem0,qty=3\"","output":"\"usetype,mag\"","lvl":25,"ilvl":50,"mod 1":"sock","mod 1 min":1,"mod 1 max":2} |
| cube:148 | Pandemonium key | 1 | 100 | 0 | 3 | pk1 + pk2 + pk3 | Pandemonium Portal | 0 / 0 / 0 | {"description":"Pandemonium key","enabled":1,"version":100,"op":28,"numinputs":3,"input 1":"pk1","input 2":"pk2","input 3":"pk3","output":"Pandemonium Portal","expansion":1} |
| cube:149 | Pandemonium Finale key | 1 | 100 | 0 | 3 | dhn + bey + mbr | Pandemonium Finale Portal | 0 / 0 / 0 | {"description":"Pandemonium Finale key","enabled":1,"version":100,"op":28,"numinputs":3,"input 1":"dhn","input 2":"bey","input 3":"mbr","output":"Pandemonium Finale Portal","expansion":1} |
| cube:150 | Token of Absolution | 1 | 100 | 0 | 4 | tes + ceh + bet + fed | toa | 0 / 0 / 0 | {"description":"Token of Absolution","enabled":1,"version":100,"numinputs":4,"input 1":"tes","input 2":"ceh","input 3":"bet","input 4":"fed","output":"toa","expansion":1} |

## 完整字段及属性映射

- [Properties 原始属性映射](../src/data/raw/Properties.json)

- [ItemStatCost 原始统计与保存字段](../src/data/raw/ItemStatCost.json)

- [ItemTypes 类型继承与孔数限制](../src/data/raw/ItemTypes.json)

- [TreasureClassEx 掉落递归表](../src/data/raw/TreasureClassEx.json)

- [ItemRatio 品质判定参数](../src/data/raw/itemratio.json)

- [完整暗金原始定义](../src/data/raw/UniqueItems.json)

- [完整套装单件及条件奖励字段](../src/data/raw/SetItems.json)

- [完整方块输出字段](../src/data/raw/cubemain.json)

- [全部 33 张表与来源/校验值](REFERENCE-CATALOG.md)

- [装备详细研究与全部附表](research/02-items.md)

## 更新方式

在项目目录执行 `npx --no-install tsx scripts/export-reference.ts`，重新导出本地数据快照。
