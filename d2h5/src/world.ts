import type { AreaDef, AreaLayout, AreaState, Difficulty, Element, Monster, Player, Point, QuestDef, RawRow, Rng, SurfaceRegion, WorldObject } from './types';
import { rawRows, num, text } from './catalog';
import { SHRINES } from './rules';

// Expansion area levels and candidate pools from the focused LoD world tables.
// Ordinary seams only: quest gates, scripted portals and act travel are separate.
export const AREAS: AreaDef[] = [
  {"id":1,"name":"罗格营地","english":"Rogue Encampment","act":1,"town":true,"waypoint":true,"levels":[0,0,0],"connections":[2],"style":"town","monsters":[]},
  {"id":2,"name":"鲜血荒地","english":"Blood Moor","act":1,"town":false,"waypoint":false,"levels":[1,36,67],"connections":[1,3,8],"style":"grass","monsters":["zombie1","fallen1","quillrat1"]},
  {"id":3,"name":"冰冷之原","english":"Cold Plains","act":1,"town":false,"waypoint":true,"levels":[2,36,68],"connections":[2,4,9,17],"style":"grass","monsters":["brute1","corruptrogue1","fallenshaman1","cr_lancer1"]},
  {"id":4,"name":"石块旷野","english":"Stony Field","act":1,"town":false,"waypoint":true,"levels":[4,37,68],"connections":[3,10],"style":"grass","monsters":["skeleton1","zombie2","crownest1","goatman1","cr_archer1"]},
  {"id":5,"name":"黑暗森林","english":"Dark Wood","act":1,"town":false,"waypoint":true,"levels":[5,38,68],"connections":[6,10],"style":"grass","monsters":["fallen2","corruptrogue2","quillrat2","cr_lancer2","sk_archer1"]},
  {"id":6,"name":"黑色荒地","english":"Black Marsh","act":1,"town":false,"waypoint":true,"levels":[6,38,69],"connections":[5,7,11,20],"style":"grass","monsters":["crownest2","skeleton2","brute2","goatman2","fallenshaman2","cr_archer2"]},
  {"id":7,"name":"泰摩高地","english":"Tamoe Highland","act":1,"town":false,"waypoint":false,"levels":[8,39,69],"connections":[6,12,26],"style":"grass","monsters":["corruptrogue3","quillrat3","cr_lancer3","sk_archer2","skmage_fire1"]},
  {"id":8,"name":"邪恶洞窟","english":"Den of Evil","act":1,"town":false,"waypoint":false,"levels":[1,36,79],"connections":[2],"style":"cave","monsters":["zombie1","brute1","fallenshaman1"]},
  {"id":9,"name":"洞穴第一层","english":"Cave Level 1","act":1,"town":false,"waypoint":false,"levels":[2,36,77],"connections":[3,13],"style":"cave","monsters":["skeleton1","zombie2","cr_archer1"]},
  {"id":10,"name":"地下通道第一层","english":"Underground Passage Level 1","act":1,"town":false,"waypoint":false,"levels":[4,37,69],"connections":[4,5,14],"style":"cave","monsters":["bighead3","fallen2","corruptrogue2","sk_archer1"]},
  {"id":11,"name":"地洞第一层","english":"Hole Level 1","act":1,"town":false,"waypoint":false,"levels":[5,38,80],"connections":[6,15],"style":"cave","monsters":["bighead3","fallen2","brute2","cr_archer2"]},
  {"id":12,"name":"深坑第一层","english":"Pit Level 1","act":1,"town":false,"waypoint":false,"levels":[7,39,85],"connections":[7,16],"style":"cave","monsters":["skeleton3","fallen3","corruptrogue3","cr_archer3"]},
  {"id":13,"name":"洞穴第二层","english":"Cave Level 2","act":1,"town":false,"waypoint":false,"levels":[2,37,78],"connections":[9],"style":"cave","monsters":["skeleton1","zombie2","cr_archer1"]},
  {"id":14,"name":"地下通道第二层","english":"Underground Passage Level 2","act":1,"town":false,"waypoint":false,"levels":[4,38,83],"connections":[10],"style":"cave","monsters":["bighead3","fallen2","corruptrogue2","sk_archer1"]},
  {"id":15,"name":"地洞第二层","english":"Hole Level 2","act":1,"town":false,"waypoint":false,"levels":[5,39,81],"connections":[11],"style":"cave","monsters":["bighead3","fallen2","brute2","cr_archer2"]},
  {"id":16,"name":"深坑第二层","english":"Pit Level 2","act":1,"town":false,"waypoint":false,"levels":[7,40,85],"connections":[12],"style":"cave","monsters":["skeleton3","fallen3","corruptrogue3","cr_archer3"]},
  {"id":17,"name":"埋骨之地","english":"Burial Grounds","act":1,"town":false,"waypoint":false,"levels":[3,36,80],"connections":[3,18,19],"style":"grass","monsters":["skeleton1","zombie2"]},
  {"id":18,"name":"大陵寝","english":"Crypt","act":1,"town":false,"waypoint":false,"levels":[3,37,83],"connections":[17],"style":"dungeon","monsters":["skeleton1","zombie2"]},
  {"id":19,"name":"陵墓","english":"Mausoleum","act":1,"town":false,"waypoint":false,"levels":[3,37,85],"connections":[17],"style":"dungeon","monsters":["skeleton1","zombie2"]},
  {"id":20,"name":"遗忘之塔","english":"Forgotten Tower","act":1,"town":false,"waypoint":false,"levels":[0,0,0],"connections":[6,21],"style":"dungeon","monsters":[]},
  {"id":21,"name":"高塔地牢第一层","english":"Tower Cellar Level 1","act":1,"town":false,"waypoint":false,"levels":[7,38,75],"connections":[20,22],"style":"dungeon","monsters":["fallen3","wraith1","goatman3","cr_archer3"]},
  {"id":22,"name":"高塔地牢第二层","english":"Tower Cellar Level 2","act":1,"town":false,"waypoint":false,"levels":[7,39,76],"connections":[21,23],"style":"dungeon","monsters":["fallen3","wraith1","goatman3","cr_archer3"]},
  {"id":23,"name":"高塔地牢第三层","english":"Tower Cellar Level 3","act":1,"town":false,"waypoint":false,"levels":[7,40,77],"connections":[22,24],"style":"dungeon","monsters":["fallen3","wraith1","goatman3","cr_archer3"]},
  {"id":24,"name":"高塔地牢第四层","english":"Tower Cellar Level 4","act":1,"town":false,"waypoint":false,"levels":[7,41,78],"connections":[23,25],"style":"dungeon","monsters":["fallen3","wraith1","goatman3","cr_archer3"]},
  {"id":25,"name":"高塔地牢第五层","english":"Tower Cellar Level 5","act":1,"town":false,"waypoint":false,"levels":[7,42,79],"connections":[24],"style":"dungeon","monsters":["fallen3","wraith1","goatman3","cr_archer3"]},
  {"id":26,"name":"修道院大门","english":"Monastery Gate","act":1,"town":false,"waypoint":false,"levels":[8,40,70],"connections":[7,27],"style":"grass","monsters":["bighead4","corruptrogue3","sk_archer2","skmage_ltng1"]},
  {"id":27,"name":"外侧回廊","english":"Outer Cloister","act":1,"town":false,"waypoint":true,"levels":[9,40,70],"connections":[26,28],"style":"grass","monsters":["brute3","corruptrogue4","fallenshaman3","quillrat4"]},
  {"id":28,"name":"军营","english":"Barracks","act":1,"town":false,"waypoint":false,"levels":[9,40,70],"connections":[27,29],"style":"dungeon","monsters":["corruptrogue4","goatman5","fallenshaman3","sk_archer3","skmage_fire2"]},
  {"id":29,"name":"监牢第一层","english":"Jail Level 1","act":1,"town":false,"waypoint":true,"levels":[10,41,71],"connections":[28,30],"style":"dungeon","monsters":["fallen4","wraith2","goatman5","sk_archer3","skmage_fire2"]},
  {"id":30,"name":"监牢第二层","english":"Jail Level 2","act":1,"town":false,"waypoint":false,"levels":[10,41,71],"connections":[29,31],"style":"dungeon","monsters":["fallen4","wraith2","goatman5","sk_archer3","skmage_fire2"]},
  {"id":31,"name":"监牢第三层","english":"Jail Level 3","act":1,"town":false,"waypoint":false,"levels":[10,41,71],"connections":[30,32],"style":"dungeon","monsters":["fallen4","wraith2","goatman5","sk_archer3","skmage_ltng2"]},
  {"id":32,"name":"内侧回廊","english":"Inner Cloister","act":1,"town":false,"waypoint":true,"levels":[10,41,72],"connections":[31,33],"style":"grass","monsters":["fallen4","cr_archer4","skmage_ltng2"]},
  {"id":33,"name":"大教堂","english":"Cathedral","act":1,"town":false,"waypoint":false,"levels":[11,42,72],"connections":[32,34],"style":"dungeon","monsters":["bighead2","wraith2","fallenshaman4"]},
  {"id":34,"name":"地下墓穴第一层","english":"Catacombs Level 1","act":1,"town":false,"waypoint":false,"levels":[11,42,72],"connections":[33,35],"style":"dungeon","monsters":["bighead2","fallenshaman4","fetish1"]},
  {"id":35,"name":"地下墓穴第二层","english":"Catacombs Level 2","act":1,"town":false,"waypoint":true,"levels":[11,42,73],"connections":[34,36],"style":"dungeon","monsters":["bighead2","fallenshaman4","arach1"]},
  {"id":36,"name":"地下墓穴第三层","english":"Catacombs Level 3","act":1,"town":false,"waypoint":false,"levels":[12,43,73],"connections":[35,37],"style":"dungeon","monsters":["zombie3","bighead1","vampire5"]},
  {"id":37,"name":"地下墓穴第四层","english":"Catacombs Level 4","act":1,"town":false,"waypoint":false,"levels":[12,43,73],"connections":[36],"style":"dungeon","monsters":["zombie3","bighead1"]},
  {"id":38,"name":"崔斯特瑞姆","english":"Tristram","act":1,"town":false,"waypoint":false,"levels":[6,39,76],"connections":[],"style":"grass","monsters":["skeleton2","goatman2","fallenshaman2","sk_archer1"]},
  {"id":39,"name":"秘密奶牛关","english":"Secret Cow Level","act":1,"town":false,"waypoint":false,"levels":[28,64,81],"connections":[],"style":"grass","monsters":["hellbovine","hellbovine","hellbovine"]},
  {"id":40,"name":"鲁高因","english":"Lut Gholein","act":2,"town":true,"waypoint":true,"levels":[0,0,0],"connections":[41,47],"style":"town","monsters":[]},
  {"id":41,"name":"碎石荒地","english":"Rocky Waste","act":2,"town":false,"waypoint":false,"levels":[14,43,75],"connections":[40,42,55],"style":"desert","monsters":["sandleaper1","pantherwoman1","scarab1","vulture1","slinger1"]},
  {"id":42,"name":"干燥高地","english":"Dry Hills","act":2,"town":false,"waypoint":true,"levels":[15,44,76],"connections":[41,43,56],"style":"desert","monsters":["sandleaper2","pantherwoman2","vulture2","slinger5"]},
  {"id":43,"name":"遥远绿洲","english":"Far Oasis","act":2,"town":false,"waypoint":true,"levels":[16,45,76],"connections":[42,44,62],"style":"desert","monsters":["crownest3","sandmaggot1","swarm1","scarab2","vulture2"]},
  {"id":44,"name":"遗失城市","english":"Lost City","act":2,"town":false,"waypoint":true,"levels":[17,46,77],"connections":[43,45,65],"style":"desert","monsters":["zombie5","sandraider2","sandleaper3","pantherwoman3","slinger6"]},
  {"id":45,"name":"群蛇峡谷","english":"Valley of Snakes","act":2,"town":false,"waypoint":false,"levels":[18,46,77],"connections":[44,58],"style":"desert","monsters":["clawviper2","clawviper2","clawviper3","clawviper3","mummy3","unraveler2"]},
  {"id":46,"name":"术士的峡谷","english":"Canyon of the Magi","act":2,"town":false,"waypoint":true,"levels":[16,48,79],"connections":[66,67,68,69,70,71,72],"style":"desert","monsters":["brute4","sandmaggot3","pantherwoman4","scarab4","slinger4"]},
  {"id":47,"name":"下水道第一层","english":"Sewers Level 1","act":2,"town":false,"waypoint":false,"levels":[13,43,74],"connections":[40,48],"style":"dungeon","monsters":["skeleton4","sandraider1","mummy1","sk_archer4"]},
  {"id":48,"name":"下水道第二层","english":"Sewers Level 2","act":2,"town":false,"waypoint":true,"levels":[13,43,74],"connections":[47,49],"style":"dungeon","monsters":["skeleton4","sandraider1","mummy1","sk_archer4"]},
  {"id":49,"name":"下水道第三层","english":"Sewers Level 3","act":2,"town":false,"waypoint":false,"levels":[14,44,75],"connections":[48],"style":"dungeon","monsters":["skeleton4","pantherwoman1","mummy1","skmage_fire3"]},
  {"id":50,"name":"女眷住处第一层","english":"Harem Level 1","act":2,"town":false,"waypoint":false,"levels":[0,0,0],"connections":[51],"style":"dungeon","monsters":[]},
  {"id":51,"name":"女眷住处第二层","english":"Harem Level 2","act":2,"town":false,"waypoint":false,"levels":[13,47,78],"connections":[50,52],"style":"dungeon","monsters":["sandraider3","baboon1","sk_archer5","blunderbore1","skmage_cold4"]},
  {"id":52,"name":"皇宫监牢第一层","english":"Palace Cellar Level 1","act":2,"town":false,"waypoint":true,"levels":[13,47,78],"connections":[51,53],"style":"dungeon","monsters":["sandraider3","baboon1","sk_archer5","blunderbore1","skmage_fire4"]},
  {"id":53,"name":"皇宫监牢第二层","english":"Palace Cellar Level 2","act":2,"town":false,"waypoint":false,"levels":[13,47,78],"connections":[52,54],"style":"dungeon","monsters":["sandraider3","baboon1","sk_archer5","blunderbore1","skmage_pois4"]},
  {"id":54,"name":"皇宫监牢第三层","english":"Palace Cellar Level 3","act":2,"town":false,"waypoint":false,"levels":[13,48,78],"connections":[53],"style":"dungeon","monsters":["sandraider3","baboon1","sk_archer5","blunderbore1","skmage_ltng4"]},
  {"id":55,"name":"古代之墓第一层","english":"Stony Tomb Level 1","act":2,"town":false,"waypoint":false,"levels":[12,44,78],"connections":[41,59],"style":"dungeon","monsters":["skeleton5","scarab1","skmage_ltng3"]},
  {"id":56,"name":"死亡之殿第一层","english":"Halls of the Dead Level 1","act":2,"town":false,"waypoint":false,"levels":[12,44,79],"connections":[42,57],"style":"dungeon","monsters":["mummy2","unraveler1","unraveler1","batdemon1","slinger2"]},
  {"id":57,"name":"死亡之殿第二层","english":"Halls of the Dead Level 2","act":2,"town":false,"waypoint":true,"levels":[13,45,81],"connections":[56,60],"style":"dungeon","monsters":["mummy2","unraveler1","unraveler1","batdemon1","slinger2"]},
  {"id":58,"name":"利爪蝮蛇神殿第一层","english":"Claw Viper Temple Level 1","act":2,"town":false,"waypoint":false,"levels":[14,47,82],"connections":[45,61],"style":"dungeon","monsters":["clawviper2","clawviper2","clawviper3","clawviper3","mummy3","unraveler2"]},
  {"id":59,"name":"古代之墓第二层","english":"Stony Tomb Level 2","act":2,"town":false,"waypoint":false,"levels":[12,44,79],"connections":[55],"style":"dungeon","monsters":["skeleton5","scarab1","skmage_pois3"]},
  {"id":60,"name":"死亡之殿第三层","english":"Halls of the Dead Level 3","act":2,"town":false,"waypoint":false,"levels":[13,45,82],"connections":[57],"style":"dungeon","monsters":["mummy2","unraveler1","unraveler1","batdemon1","slinger2"]},
  {"id":61,"name":"利爪蝮蛇神殿第二层","english":"Claw Viper Temple Level 2","act":2,"town":false,"waypoint":false,"levels":[14,47,83],"connections":[58],"style":"dungeon","monsters":["clawviper2","clawviper2","clawviper3","clawviper3","mummy3","unraveler2"]},
  {"id":62,"name":"蛆虫巢穴第一层","english":"Maggot Lair Level 1","act":2,"town":false,"waypoint":false,"levels":[17,45,84],"connections":[43,63],"style":"cave","monsters":["sandmaggot1","sandmaggot2","swarm2","scarab2","scarab3"]},
  {"id":63,"name":"蛆虫巢穴第二层","english":"Maggot Lair Level 2","act":2,"town":false,"waypoint":false,"levels":[17,45,84],"connections":[62,64],"style":"cave","monsters":["sandmaggot1","sandmaggot2","swarm2","scarab2","scarab3"]},
  {"id":64,"name":"蛆虫巢穴第三层","english":"Maggot Lair Level 3","act":2,"town":false,"waypoint":false,"levels":[17,46,85],"connections":[63],"style":"cave","monsters":["sandmaggot1","sandmaggot2","swarm2","scarab2","scarab3"]},
  {"id":65,"name":"古代通道","english":"Ancient Tunnels","act":2,"town":false,"waypoint":false,"levels":[17,46,85],"connections":[44],"style":"dungeon","monsters":["zombie5","sandraider3","mummy3","skmage_ltng4"]},
  {"id":66,"name":"塔拉夏的古墓","english":"Tal Rasha's Tomb","act":2,"town":false,"waypoint":false,"levels":[17,49,80],"connections":[46],"style":"dungeon","monsters":["wraith4","scarab4","mummy4","unraveler3","unraveler3","vampire1","blunderbore2"]},
  {"id":67,"name":"塔拉夏的古墓","english":"Tal Rasha's Tomb","act":2,"town":false,"waypoint":false,"levels":[17,49,80],"connections":[46],"style":"dungeon","monsters":["wraith4","scarab4","mummy4","unraveler3","unraveler3","vampire1","blunderbore2"]},
  {"id":68,"name":"塔拉夏的古墓","english":"Tal Rasha's Tomb","act":2,"town":false,"waypoint":false,"levels":[17,49,80],"connections":[46],"style":"dungeon","monsters":["wraith4","scarab4","mummy4","unraveler3","unraveler3","vampire1","blunderbore2"]},
  {"id":69,"name":"塔拉夏的古墓","english":"Tal Rasha's Tomb","act":2,"town":false,"waypoint":false,"levels":[17,49,80],"connections":[46],"style":"dungeon","monsters":["wraith4","scarab4","mummy4","unraveler3","unraveler3","vampire1","blunderbore2"]},
  {"id":70,"name":"塔拉夏的古墓","english":"Tal Rasha's Tomb","act":2,"town":false,"waypoint":false,"levels":[17,49,80],"connections":[46],"style":"dungeon","monsters":["wraith4","scarab4","mummy4","unraveler3","unraveler3","vampire1","blunderbore2"]},
  {"id":71,"name":"塔拉夏的古墓","english":"Tal Rasha's Tomb","act":2,"town":false,"waypoint":false,"levels":[17,49,80],"connections":[46],"style":"dungeon","monsters":["wraith4","scarab4","mummy4","unraveler3","unraveler3","vampire1","blunderbore2"]},
  {"id":72,"name":"塔拉夏的古墓","english":"Tal Rasha's Tomb","act":2,"town":false,"waypoint":false,"levels":[17,49,80],"connections":[46],"style":"dungeon","monsters":["wraith4","scarab4","mummy4","unraveler3","unraveler3","vampire1","blunderbore2"]},
  {"id":73,"name":"都瑞尔的巢穴","english":"Duriel's Lair","act":2,"town":false,"waypoint":false,"levels":[17,49,80],"connections":[],"style":"dungeon","monsters":["wraith4","scarab4","mummy4","unraveler3","unraveler3","vampire1","blunderbore2"]},
  {"id":74,"name":"神秘避难所","english":"Arcane Sanctuary","act":2,"town":false,"waypoint":true,"levels":[14,48,79],"connections":[],"style":"dungeon","monsters":["wraith3","goatman4","vampire1"]},
  {"id":75,"name":"库拉斯特海港","english":"Kurast Docks","act":3,"town":true,"waypoint":true,"levels":[0,0,0],"connections":[76],"style":"town","monsters":[]},
  {"id":76,"name":"蜘蛛森林","english":"Spider Forest","act":3,"town":false,"waypoint":true,"levels":[21,49,79],"connections":[75,77,78,84,85],"style":"jungle","monsters":["baboon3","mosquito1","thornhulk1","fetish2","fetishblow2","foulcrow4"]},
  {"id":77,"name":"庞大湿地","english":"Great Marsh","act":3,"town":false,"waypoint":true,"levels":[21,50,80],"connections":[76,78],"style":"jungle","monsters":["frogdemon1","frogdemon2","thornhulk2","zombie4","fetishshaman2","willowisp1"]},
  {"id":78,"name":"剥皮丛林","english":"Flayer Jungle","act":3,"town":false,"waypoint":true,"levels":[22,50,80],"connections":[76,77,79,86,88],"style":"jungle","monsters":["fetish3","fetishshaman3","fetish4","fetishshaman4","vulture4","frogdemon3","fetishblow3"]},
  {"id":79,"name":"库拉斯特下层","english":"Lower Kurast","act":3,"town":false,"waypoint":true,"levels":[22,52,80],"connections":[78,80],"style":"jungle","monsters":["baboon4","sandleaper4","vulture3","zealot1"]},
  {"id":80,"name":"库拉斯特商场","english":"Kurast Bazaar","act":3,"town":false,"waypoint":true,"levels":[22,52,81],"connections":[79,81,92,94,95],"style":"jungle","monsters":["thornhulk3","swarm4","zealot2","cantor1"]},
  {"id":81,"name":"库拉斯特上层","english":"Upper Kurast","act":3,"town":false,"waypoint":true,"levels":[23,52,81],"connections":[80,82,92,96,97],"style":"jungle","monsters":["vulture4","zealot3","cantor2","thornhulk3"]},
  {"id":82,"name":"库拉斯特堤道","english":"Kurast Causeway","act":3,"town":false,"waypoint":false,"levels":[24,53,81],"connections":[81,83,98,99],"style":"jungle","monsters":["sandraider4","baboon5","cantor3"]},
  {"id":83,"name":"崔凡克","english":"Travincal","act":3,"town":false,"waypoint":true,"levels":[24,54,82],"connections":[82],"style":"jungle","monsters":["cantor3","cantor3","vampire2"]},
  {"id":84,"name":"蜘蛛巢穴","english":"Arachnid Lair","act":3,"town":false,"waypoint":false,"levels":[21,50,79],"connections":[76],"style":"cave","monsters":["arach3","arach4","batdemon2","sandmaggot4","arach3"]},
  {"id":85,"name":"蜘蛛洞窟","english":"Spider Cavern","act":3,"town":false,"waypoint":false,"levels":[21,50,79],"connections":[76],"style":"cave","monsters":["arach3","arach4","batdemon2","sandmaggot4","arach3"]},
  {"id":86,"name":"沼泽地洞第一层","english":"Swampy Pit Level 1","act":3,"town":false,"waypoint":false,"levels":[21,51,80],"connections":[78,87],"style":"cave","monsters":["mummy4","bonefetish4","batdemon2","willowisp1","bonefetish5"]},
  {"id":87,"name":"沼泽地洞第二层","english":"Swampy Pit Level 2","act":3,"town":false,"waypoint":false,"levels":[21,51,81],"connections":[86,90],"style":"cave","monsters":["bonefetish4","zombie4","batdemon2","willowisp1","bonefetish5"]},
  {"id":88,"name":"剥皮地窖第一层","english":"Flayer Dungeon Level 1","act":3,"town":false,"waypoint":false,"levels":[22,51,81],"connections":[78,89],"style":"cave","monsters":["fetish3","fetishshaman3","fetish4","fetishshaman4","batdemon3","wraith5","fetishblow3","bonefetish3"]},
  {"id":89,"name":"剥皮地窖第二层","english":"Flayer Dungeon Level 2","act":3,"town":false,"waypoint":false,"levels":[22,51,82],"connections":[88,91],"style":"cave","monsters":["fetish3","fetishshaman3","fetish4","fetishshaman4","batdemon3","wraith5","fetishblow3","bonefetish3"]},
  {"id":90,"name":"沼泽地洞第三层","english":"Swampy Pit Level 3","act":3,"town":false,"waypoint":false,"levels":[21,51,82],"connections":[87],"style":"cave","monsters":["bonefetish4","bonefetish5","batdemon2","willowisp1"]},
  {"id":91,"name":"剥皮地窖第三层","english":"Flayer Dungeon Level 3","act":3,"town":false,"waypoint":false,"levels":[22,51,83],"connections":[89],"style":"cave","monsters":["fetish3","fetishshaman3","fetish4","fetishshaman4","batdemon3","wraith5","fetishblow3","bonefetish3"]},
  {"id":92,"name":"下水道第一层","english":"Sewers Level 1","act":3,"town":false,"waypoint":false,"levels":[23,52,84],"connections":[80,81],"style":"dungeon","monsters":["mummy4","mosquito2","batdemon3","unraveler4","bonefetish4"]},
  {"id":93,"name":"下水道第二层","english":"Sewers Level 2","act":3,"town":false,"waypoint":false,"levels":[24,53,85],"connections":[],"style":"dungeon","monsters":["mummy4","unraveler4","mosquito4","frogdemon3","bonefetish4"]},
  {"id":94,"name":"残破神殿","english":"Ruined Temple","act":3,"town":false,"waypoint":false,"levels":[23,53,84],"connections":[80],"style":"dungeon","monsters":["brute5","corruptrogue5","arach5","vampire2"]},
  {"id":95,"name":"废弃寺院","english":"Disused Fane","act":3,"town":false,"waypoint":false,"levels":[23,53,84],"connections":[80],"style":"dungeon","monsters":["brute5","corruptrogue5","arach5","vampire2"]},
  {"id":96,"name":"遗忘圣物","english":"Forgotten Reliquary","act":3,"town":false,"waypoint":false,"levels":[23,53,84],"connections":[81],"style":"dungeon","monsters":["brute5","corruptrogue5","arach5","vampire2"]},
  {"id":97,"name":"遗忘神殿","english":"Forgotten Temple","act":3,"town":false,"waypoint":false,"levels":[24,54,85],"connections":[81],"style":"dungeon","monsters":["clawviper5","scarab5","batdemon4","cr_archer5"]},
  {"id":98,"name":"残破寺院","english":"Ruined Fane","act":3,"town":false,"waypoint":false,"levels":[24,54,85],"connections":[82],"style":"dungeon","monsters":["clawviper5","scarab5","batdemon4","cr_archer5"]},
  {"id":99,"name":"废弃圣物","english":"Disused Reliquary","act":3,"town":false,"waypoint":false,"levels":[24,54,85],"connections":[82],"style":"dungeon","monsters":["clawviper5","scarab5","batdemon4","cr_archer5"]},
  {"id":100,"name":"憎恨囚牢第一层","english":"Durance of Hate Level 1","act":3,"town":false,"waypoint":false,"levels":[25,55,83],"connections":[101],"style":"dungeon","monsters":["mummy5","vampire3","blunderbore3","bonefetish5"]},
  {"id":101,"name":"憎恨囚牢第二层","english":"Durance of Hate Level 2","act":3,"town":false,"waypoint":true,"levels":[25,55,83],"connections":[100,102],"style":"dungeon","monsters":["mummy5","vampire3","blunderbore3","bonefetish5"]},
  {"id":102,"name":"憎恨囚牢第三层","english":"Durance of Hate Level 3","act":3,"town":false,"waypoint":false,"levels":[25,55,83],"connections":[101],"style":"dungeon","monsters":["vampire4","vampire4"]},
  {"id":103,"name":"群魔堡垒","english":"Pandemonium Fortress","act":4,"town":true,"waypoint":true,"levels":[0,0,0],"connections":[104],"style":"town","monsters":[]},
  {"id":104,"name":"外侧草原","english":"Outer Steppes","act":4,"town":false,"waypoint":false,"levels":[26,56,82],"connections":[103,105],"style":"hell","monsters":["sandleaper5","vilemother1","fingermage1","regurgitator1","doomknight1","megademon3"]},
  {"id":105,"name":"绝望平原","english":"Plains of Despair","act":4,"town":false,"waypoint":false,"levels":[26,56,83],"connections":[104,106],"style":"hell","monsters":["willowisp3","vilemother1","fingermage1","regurgitator1","doomknight1","megademon3"]},
  {"id":106,"name":"神罚之城","english":"City of the Damned","act":4,"town":false,"waypoint":true,"levels":[27,57,84],"connections":[105,107],"style":"hell","monsters":["bighead5","batdemon5","vilemother2","fingermage2","regurgitator2","doomknight2","megademon2"]},
  {"id":107,"name":"火焰之河","english":"River of Flame","act":4,"town":false,"waypoint":true,"levels":[27,57,85],"connections":[106,108],"style":"hell","monsters":["sandmaggot5","blunderbore4","vilemother3","fingermage2","regurgitator3","doomknight2","megademon2"]},
  {"id":108,"name":"混沌避难所","english":"Chaos Sanctuary","act":4,"town":false,"waypoint":false,"levels":[28,58,85],"connections":[107],"style":"hell","monsters":["fingermage3","doomknight3","megademon3"]},
  {"id":109,"name":"哈洛加斯","english":"Harrogath","act":5,"town":true,"waypoint":true,"levels":[0,0,0],"connections":[110],"style":"town","monsters":[]},
  {"id":110,"name":"血腥丘陵","english":"Bloody Foothills","act":5,"town":false,"waypoint":false,"levels":[24,58,80],"connections":[109,111],"style":"snow","monsters":["minion1","deathmauler1","overseer1","imp1","sk_archer6","quillrat6","bighead6"]},
  {"id":111,"name":"冰冻高地","english":"Frigid Highlands","act":5,"town":false,"waypoint":true,"levels":[25,59,81],"connections":[110,112],"style":"snow","monsters":["imp1","siegebeast2"]},
  {"id":112,"name":"亚瑞特高原","english":"Arreat Plateau","act":5,"town":false,"waypoint":true,"levels":[26,60,81],"connections":[111,113],"style":"snow","monsters":["overseer2","minion2"]},
  {"id":113,"name":"水晶通道","english":"Crystalline Passage","act":5,"town":false,"waypoint":true,"levels":[29,61,82],"connections":[112,114,115],"style":"cave","monsters":["frozenhorror1","succubus3","bloodlord1"]},
  {"id":114,"name":"冰河","english":"Frozen River","act":5,"town":false,"waypoint":false,"levels":[29,61,83],"connections":[113],"style":"cave","monsters":["snowyeti2","succubus5","reanimatedhorde1"]},
  {"id":115,"name":"冰冻之径","english":"Glacial Trail","act":5,"town":false,"waypoint":true,"levels":[29,61,83],"connections":[113,116,117],"style":"cave","monsters":["deathmauler3","reanimatedhorde2","frozenhorror2"]},
  {"id":116,"name":"漂泊者洞窟","english":"Drifter Cavern","act":5,"town":false,"waypoint":false,"levels":[29,61,84],"connections":[115],"style":"cave","monsters":["snowyeti1","succubus2"]},
  {"id":117,"name":"冰冻苔原","english":"Frozen Tundra","act":5,"town":false,"waypoint":true,"levels":[27,60,81],"connections":[115,118],"style":"snow","monsters":["siegebeast2","imp4"]},
  {"id":118,"name":"远古之路","english":"The Ancients' Way","act":5,"town":false,"waypoint":true,"levels":[29,62,82],"connections":[117,119,120],"style":"cave","monsters":["frozenhorror3","deathmauler3","bloodlord1"]},
  {"id":119,"name":"冰窖","english":"Icy Cellar","act":5,"town":false,"waypoint":false,"levels":[29,62,83],"connections":[118],"style":"cave","monsters":["snowyeti4","succubus3","reanimatedhorde3"]},
  {"id":120,"name":"亚瑞特山顶","english":"Arreat Summit","act":5,"town":false,"waypoint":false,"levels":[37,68,87],"connections":[118],"style":"snow","monsters":["ancientbarb1","ancientbarb2","ancientbarb3"]},
  {"id":121,"name":"尼拉塞克神殿","english":"Nihlathak's Temple","act":5,"town":false,"waypoint":false,"levels":[32,63,83],"connections":[122],"style":"dungeon","monsters":[]},
  {"id":122,"name":"悲痛之厅","english":"Halls of Anguish","act":5,"town":false,"waypoint":false,"levels":[33,63,83],"connections":[121,123],"style":"dungeon","monsters":["reanimatedhorde3","bloodlord2"]},
  {"id":123,"name":"痛苦之厅","english":"Halls of Pain","act":5,"town":false,"waypoint":true,"levels":[34,64,84],"connections":[122,124],"style":"dungeon","monsters":["reanimatedhorde4","deathmauler2","putriddefiler1"]},
  {"id":124,"name":"瓦特之厅","english":"Halls of Vaught","act":5,"town":false,"waypoint":false,"levels":[36,64,84],"connections":[123],"style":"dungeon","monsters":["minion6","succubus4","putriddefiler2"]},
  {"id":125,"name":"亚巴顿","english":"Abaddon","act":5,"town":false,"waypoint":false,"levels":[39,60,81],"connections":[],"style":"hell","monsters":["bloodlord3","imp2"]},
  {"id":126,"name":"亚契隆深坑","english":"Pit of Acheron","act":5,"town":false,"waypoint":false,"levels":[39,61,82],"connections":[],"style":"hell","monsters":["bloodlord2","overseer3"]},
  {"id":127,"name":"地狱魔窟","english":"Infernal Pit","act":5,"town":false,"waypoint":false,"levels":[39,62,83],"connections":[],"style":"hell","monsters":["imp4","overseer4"]},
  {"id":128,"name":"世界之石要塞第一层","english":"Worldstone Keep Level 1","act":5,"town":false,"waypoint":false,"levels":[39,65,85],"connections":[129],"style":"dungeon","monsters":["reanimatedhorde5","succubuswitch2","putriddefiler3"]},
  {"id":129,"name":"世界之石要塞第二层","english":"Worldstone Keep Level 2","act":5,"town":false,"waypoint":true,"levels":[40,65,85],"connections":[128,130],"style":"dungeon","monsters":["suicideminion6","minion7"]},
  {"id":130,"name":"世界之石要塞第三层","english":"Worldstone Keep Level 3","act":5,"town":false,"waypoint":false,"levels":[42,66,85],"connections":[129,131],"style":"dungeon","monsters":["bloodlord5","imp5","putriddefiler4"]},
  {"id":131,"name":"毁灭王座","english":"Throne of Destruction","act":5,"town":false,"waypoint":false,"levels":[43,66,85],"connections":[130],"style":"dungeon","monsters":["bloodlord5","succubuswitch3"]},
  {"id":132,"name":"世界之石大殿","english":"Worldstone Chamber","act":5,"town":false,"waypoint":false,"levels":[43,66,85],"connections":[],"style":"dungeon","monsters":[]},
  {"id":133,"name":"主母之巢","english":"Matron's Den","act":5,"town":false,"waypoint":false,"levels":[50,75,83],"connections":[],"style":"dungeon","monsters":["succubus8","succubuswitch9","corruptrogue6","cr_archer8","cr_lancer8"]},
  {"id":134,"name":"遗忘沙漠","english":"Forgotten Sands","act":5,"town":false,"waypoint":false,"levels":[50,75,83],"connections":[],"style":"desert","monsters":["swarm5","sandmaggot7","arach7","scarab8"]},
  {"id":135,"name":"苦痛熔炉","english":"Furnace of Pain","act":5,"town":false,"waypoint":false,"levels":[50,75,83],"connections":[],"style":"hell","monsters":["overseer6","dkmag3","megademon6","imp8"]},
  {"id":136,"name":"超级崔斯特瑞姆","english":"Uber Tristram","act":5,"town":false,"waypoint":false,"levels":[50,75,83],"connections":[],"style":"dungeon","monsters":[]},
];

export const WORLD_LIMITATIONS: string[] = [
  '首幕普通区域采用原创连通地块模板，其余区域保留紧凑种子地图；不是原版 DS1 / DT1 或地图随机器，丛林连接采用候选拓扑。',
  '怪物只提供近战、远程、萨满和首领代表性 AI 标签；专属技能、精英词缀效果、原版群体密度尚未实现完整模拟。',
  '静态红门的地图连接已提供；引擎还需区分此类门与玩家城镇传送门后才能交互旅行。',
  '已执行任务：邪恶洞窟、血鸟、女伯爵、安达利尔；其他任务目录不代表完整可执行状态机。',
  '王宫许可剧情门（40→50/74→46）和法杖/真墓物件链已简化实现（进入区域自动完成）；凯恩救援、先祖试炼、克林姆任务、秘密牛场均已简化实现。',
  '雇佣兵战斗、装备、成长及复活已实现。原版仅战网开放的超级区域（六Boss/潘多蒙邪传）在离线模式已实现，需消耗钥匙开启。',
  '数值来自原始 MonStats / MonLvl；特殊首领舍入和未解释的 noRatio/攻击技能需原版客户端进一步验收。',
];

export const QUESTS: QuestDef[] = [
  { id:'a1q1',act:1,number:1,name:'邪恶洞窟',description:'进入鲜血荒地的洞窟，消灭全部怪物（包括尸体发火与复活的沉沦魔），回阿卡拉处交付。',reward:'1 技能点；本难度一次属性/技能重置' },
  { id:'a1q2',act:1,number:2,name:'姐妹的埋骨之地',description:'从冰冷之原进入埋骨之地，击杀血鸟后回报卡夏。',reward:'免费罗格雇佣兵与招聘权限（战斗 AI 未实现）' },
  { id:'a1q3',act:1,number:3,name:'寻找凯恩',description:'进入石块旷野(area 4)激活任务，穿越传送门抵达崔斯特瑞姆与凯恩对话；凯恩传送回营地后本难度可免费鉴定。',reward:'本难度免费鉴定；阿卡拉戒指' },
  { id:'a1q4',act:1,number:4,name:'遗忘之塔',description:'探索黑色荒地的高塔，深入五层地牢击杀女伯爵。',reward:'宝藏与符文掉落；无属性或技能点奖励' },
  { id:'a1q5',act:1,number:5,name:'交易的工具',description:'击杀军营(area 28)铁匠哈费斯特，拾取赫拉迪克马勒斯交给恰西，获得本难度一次稀有装备注入权限。',reward:'等级至少 8 时一次稀有装备注入' },
  { id:'a1q6',act:1,number:6,name:'屠杀的修女',description:'进入地下墓穴第四层击杀安达利尔，返回营地向瓦瑞夫交付后向东旅行。',reward:'解锁第二幕鲁高因' },
  { id:'a2q1',act:2,number:1,name:'罗达门特的巢穴',description:'杀死下水道第三层罗达门特，回报亚特玛；任务已简化实现（无需使用技能之书）。',reward:'技能之书 +1 技能点；第二幕商店九折' },
  { id:'a2q2',act:2,number:2,name:'赫拉迪克的法杖',description:'进入蝮蛇神殿(area 46)或古墓激活任务，抵达都瑞尔巢穴(area 73)自动完成。',reward:'赫拉迪克方块；开启都瑞尔巢穴' },
  { id:'a2q3',act:2,number:3,name:'堕落的太阳',description:'遗失城市(area 44)进入触发，回报卓格南完成；祭坛交互已简化。',reward:'恢复日光与王宫剧情权限' },
  { id:'a2q4',act:2,number:4,name:'神秘避难所',description:'进入皇宫监牢(area 52)或神秘避难所(area 74)触发，回报杰海因完成。',reward:'真墓符号与术士峡谷红门' },
  { id:'a2q5',act:2,number:5,name:'召唤者',description:'在古代之墓(area 55)进入触发，击杀召唤者后回凯恩完成。',reward:'古墓剧情进展；无数值奖励' },
  { id:'a2q6',act:2,number:6,name:'七个古墓',description:'击杀都瑞尔后回报马席夫，解锁第三幕；已实现。',reward:'解锁第三幕' },
  { id:'a3q1',act:3,number:1,name:'黄金鸟',description:'进入剥皮丛林或库拉斯特下层激活，回报艾柯获得永久 +20 生命；已简化实现。',reward:'永久 +20 生命' },
  { id:'a3q2',act:3,number:2,name:'古代宗教之刃',description:'进入剥皮地窖三层或库拉斯特商场激活，回报赫拉铁力获得 1 技能点；已简化实现。',reward:'稀有戒指与铁狼招聘奖励' },
  { id:'a3q3',act:3,number:3,name:'克林姆的意志',description:'进入崔凡克(area 83)激活任务，解锁通往憎恨囚牢的通道；已简化实现。',reward:'开启憎恨囚牢；消耗克林姆的意志' },
  { id:'a3q4',act:3,number:4,name:'蓝·依森的古书',description:'进入废弃寺院(area 95)激活，回报奥玛斯获得 5 属性点；已简化实现。',reward:'5 属性点' },
  { id:'a3q5',act:3,number:5,name:'黑化的神殿',description:'进入遗忘神殿(area 97/98)激活，击杀墨菲斯托后由凯恩完成；已简化实现。',reward:'议会任务完成；无数值奖励' },
  { id:'a3q6',act:3,number:6,name:'守护者',description:'憎恨囚牢三层击杀墨菲斯托，解锁第四幕；已实现。',reward:'解锁第四幕；墨菲斯托灵魂石' },
  { id:'a4q1',act:4,number:1,name:'堕落天使',description:'进入绝望平原(area 105)激活，击杀衣卒尔后回报泰瑞尔获得 2 技能点；已实现。',reward:'2 技能点' },
  { id:'a4q2',act:4,number:2,name:'地狱熔炉',description:'击杀火焰之河(area 107)的海法斯特，直接掉落宝石与符文奖励；已实现。',reward:'普通宝石 1、无瑕宝石 2、完美宝石 1；难度符文池随机 1 枚' },
  { id:'a4q3',act:4,number:3,name:'恐怖的结局',description:'进入混沌避难所(area 108)激活，击杀迪亚波罗后回报泰瑞尔解锁第五幕；已实现。',reward:'解锁第五幕' },
  { id:'a5q1',act:5,number:1,name:'哈洛加斯围城',description:'击杀血腥丘陵(area 110)督军山克，回报拉苏克领取本难度镶孔服务；已实现。',reward:'本难度一次镶孔服务' },
  { id:'a5q2',act:5,number:2,name:'高山上的救援',description:'进入冰冻高地(area 112/113)或尼拉塞克神殿(area 121)激活，回报夸尔凯克获得符文与野蛮人招聘；已简化实现。',reward:'拉尔 + 欧特 + 塔尔；野蛮人招聘' },
  { id:'a5q3',act:5,number:3,name:'冰之囚',description:'进入冰冻之径(area 115)激活，对话马拉后解冻安雅，获得四系永久 +10 抗性；已实现。',reward:'四系永久 +10 抗性；职业稀有装备；神殿红门' },
  { id:'a5q4',act:5,number:4,name:'哈洛加斯的背叛',description:'进入远古之路(area 118)或尼拉塞克神殿(area 121)激活，击杀尼拉塞克后安雅提供一次刻名服务；已实现。',reward:'本难度一次装备刻名并修复/充能' },
  { id:'a5q5',act:5,number:5,name:'通道祭典',description:'进入亚瑞特山顶(area 120)激活，击杀三先祖获得大量经验并解锁要塞；已实现。',reward:'140万/2000万/4000万经验（至多一个等级经验跨度）；要塞权限' },
  { id:'a5q6',act:5,number:6,name:'毁灭前夕',description:'进入毁灭王座(area 131)激活，击杀世界之石大殿(area 132)的巴尔通关；已实现。',reward:'通关称号与下一难度权限' },
];

type NPCDef = { id: string; name: string; services: string[]; act: number; description: string };
export const NPCS: Record<string, NPCDef> = {};
const npcRows: [string, string, number, string[], string][] = [
  ['akara','阿卡拉',1,['trade','heal'],'清空邪恶洞窟后回来领取技能点；进入洞窟即可开始。交谈时自动恢复生命和法力。'],
  ['charsi','恰西',1,['trade','repair'],'完成 a1q5 后可进行一次稀有装备注入（imbue 指令）；已实现。'],
  ['gheed','基德',1,['trade','gamble'],'出售装备与杂货，提供赌博；不提供修理。'],
  ['kashya','卡夏',1,[],'完成埋骨之地任务击败血鸟，可解锁罗格雇佣兵（火焰箭/冰霜箭）招募权限。'],
  ['cain','迪卡·凯恩',1,[],'完成 a1q3 后凯恩传送至营地，提供本难度免费鉴定服务；已实现。'],
  ['warriv','瓦瑞夫',1,[],'杀死地下墓穴第四层安达利尔后，回来交付并向东旅行。'],
  ['atma','亚特玛',2,['heal'],'完成 a2q1（击杀罗达门特）后领取 1 技能点，第二幕商店九折；已实现。'],
  ['fara','法拉',2,['trade','repair','heal'],'鲁高因的铁匠和治疗者。'],
  ['drognan','卓格南',2,['trade'],'完成 a2q3（遗失城市）后对话领取奖励；已简化实现。'],
  ['elzix','艾吉斯',2,['trade','gamble'],'旅馆商人；原版不提供修理。'],
  ['lysander','雷山德',2,['trade'],'药剂与钥匙商人。'],
  ['greiz','格雷兹',2,['hire','resurrect'],'雇佣沙漠卫士（近战，物理伤害）。完成第二幕任务后可免费招募一名。'],
  ['geglash','基格列斯',2,[],'旅馆中的冒险者。'],
  ['jerhyn','杰海因',2,[],'完成 a2q4（神秘避难所）后对话领取奖励；已简化实现。'],
  ['kaelan','凯伦',2,[],'王宫守卫；未获许可不能进入。'],
  ['meshif','马席夫',2,[],'击杀都瑞尔后回报，解锁第三幕乘船；已实现。'],
  ['alkor','艾柯',3,['trade','gamble'],'完成 a3q1 获得 +20 生命；完成 a3q4 获得 5 属性点；已实现。'],
  ['asheara','艾席拉',3,['trade','hire','resurrect'],'雇佣铁狼（近战，物理/魔法伤害）。完成第三幕任务后可免费招募。'],
  ['hratli','赫拉铁力',3,['trade','repair'],'库拉斯特海港铁匠。'],
  ['ormus','奥玛斯',3,['trade','heal'],'完成 a3q4（古书）后对话获得 5 属性点；已实现。'],
  ['natalya','娜塔亚',3,[],'海港的刺客旅人。'],
  ['halbu','海尔布',4,['trade','repair'],'群魔堡垒铁匠。'],
  ['jamella','贾梅拉',4,['trade','gamble','heal'],'群魔堡垒治疗与商店。'],
  ['tyrael','泰瑞尔',4,['resurrect'],'完成 a4q1 给 2 技能点；完成 a4q3 解锁第五幕；可复活阵亡的雇佣兵；已实现。'],
  ['larzuk','拉苏克',5,['trade','repair'],'完成 a5q1（击杀督军山克）后提供本难度一次镶孔服务（larzuk-socket 指令）；已实现。'],
  ['malah','马拉',5,['trade','heal'],'a5q3 进行中时给解冻药；已实现。'],
  ['nihlathak','尼拉塞克',5,['gamble'],'早期城镇 NPC；剧情离城尚未实现。'],
  ['anya','安雅',5,[],'完成 a5q3 获得四系 +10 抗性；完成 a5q4 提供一次刻名服务（personalize 指令）；已实现。'],
  ['qualkehk','夸尔凯克',5,[],'进入 area 112/121 自动触发 a5q2；对话领取拉尔/欧特/塔尔符文，解锁野蛮人招聘；已实现。'],
  ['flavie','弗拉维',1,[],'冰冷之原边境的罗格守卫。'],
  ['hadriel','海德尔',4,[],'混沌避难所前的守卫。'],
];
for (const [id,name,act,services,description] of npcRows) NPCS[id] = {id,name,act,services,description};

export function getArea(id: number): AreaDef {
  const area = AREAS[id - 1];
  if (!Number.isInteger(id) || !area || area.id !== id) throw new RangeError(`Unknown area ${id}`);
  return area;
}
export function hasLineOfSight(area: AreaState, from: Point, to: Point): boolean {
  const walkable = (x: number, y: number) => area.tiles[Math.floor(y)]?.[Math.floor(x)] === 0;
  const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / .1));
  let x = from.x, y = from.y;
  for (let i = 1; i <= steps; i++) {
    const nx = from.x + (to.x - from.x) * i / steps, ny = from.y + (to.y - from.y) * i / steps;
    if (!walkable(nx, ny) || !walkable(x, ny) || !walkable(nx, y)) return false;
    x = nx; y = ny;
  }
  return true;
}

export function townForAct(act: number): number {
  const id = [1,40,75,103,109][act - 1];
  if (!Number.isInteger(act) || id === undefined) throw new RangeError(`Unknown act ${act}`);
  return id;
}

// 0 undiscovered, 1 active, 2 objective complete / return, 3 reward claimed.
// All auxiliary flags, including respec, use the same difficulty namespace.
export function questKey(player: Pick<Player, 'difficulty'>, id: string): string;
export function questKey(difficulty: Difficulty, id: string): string;
export function questKey(player: Pick<Player, 'difficulty'> | Difficulty, id: string): string {
  return `${typeof player === 'string' ? player : player.difficulty}:${id}`;
}
function status(player: Player, id: string): number { return player.quests[questKey(player,id)] ?? 0; }
function start(player: Player, id: string): boolean {
  if (status(player,id) !== 0) return false;
  player.quests[questKey(player,id)] = 1;
  return true;
}

// Act travel is an NPC/script service, never an ordinary map exit.
export const ACT_TRAVEL = [
  {fromAct:1,toAct:2,npcId:'warriv',quest:'a1q6',destination:40,implemented:true},
  {fromAct:2,toAct:3,npcId:'meshif',quest:'a2q6',destination:75,implemented:true},
  {fromAct:3,toAct:4,npcId:null,quest:'a3q6',destination:103,implemented:true},
  {fromAct:4,toAct:5,npcId:'tyrael',quest:'a4q3',destination:109,implemented:true},
] as const;
// The true tomb is seed-selected; no ID is permanently linked to Duriel.
export const DURIEL_GATE = {candidates:[66,67,68,69,70,71,72],destination:73,quest:'a2q2',implemented:true} as const;

export const WORLD_GATES = [
  {from:4,to:38,kind:'portal',implemented:true,quest:'a1q3'},
  {from:1,to:39,kind:'cow',implemented:true,quest:'a5q6'},
  {from:40,to:50,kind:'quest',implemented:true,quest:'a2q3'},
  {from:54,to:74,kind:'portal',implemented:true},
  {from:74,to:46,kind:'portal',implemented:true,quest:'a2q4'},
  {from:83,to:100,kind:'quest',implemented:true,quest:'a3q3'},
  {from:92,to:93,kind:'quest',implemented:true},
  {from:111,to:125,kind:'portal',implemented:true},
  {from:112,to:126,kind:'portal',implemented:true},
  {from:117,to:127,kind:'portal',implemented:true},
  {from:109,to:121,kind:'portal',implemented:true,quest:'a5q3'},
  {from:120,to:128,kind:'quest',implemented:true,quest:'a5q5'},
  {from:131,to:132,kind:'portal',implemented:true,quest:'a5q6'},
] as const;

export function getConnections(player: Player, areaId: number): number[] {
  const area = getArea(areaId);
  if (area.act > player.unlockedActs || areaId >= 133) return [];
  const ids = [...area.connections];
  for (const gate of WORLD_GATES) {
    if (!gate.implemented) continue;
    // a1q3: 凯恩传送门需要任务已激活
    if ('quest' in gate && gate.quest === 'a1q3') {
      if ((player.quests[questKey(player,'a1q3')] ?? 0) < 1) continue;
    }
    // a3q3: 崔凡克→憎恨囚牢需要任务已激活
    if ('quest' in gate && gate.quest === 'a3q3') {
      if ((player.quests[questKey(player,'a3q3')] ?? 0) < 1) continue;
    }
    // a5q5: 先祖试炼→要塞需要任务已完成
    if ('quest' in gate && gate.quest === 'a5q5') {
      if ((player.quests[questKey(player,'a5q5')] ?? 0) < 2) continue;
    }
    // 牛场：需要 cowPortal flag
    if ('kind' in gate && gate.kind === 'cow') {
      if (!player.quests[`${player.difficulty}:cowPortal`]) continue;
    }
    if (gate.from === areaId) ids.push(gate.to);
    else if (gate.to === areaId) ids.push(gate.from);
  }
  // a5q3: 冰之囚任务激活后连通哈洛加斯(109)与尼拉赛克的藏身处(121)
  const a5q3Status = player.quests[questKey(player,'a5q3')] ?? 0;
  if (a5q3Status >= 1 && areaId === 109) ids.push(121);
  if (a5q3Status >= 1 && areaId === 121) ids.push(109);
  return [...new Set(ids)].filter(id => {
    const a = getArea(id);
    if (a.act > player.unlockedActs) return false;
    if (id >= 133) return !!player.quests[`${player.difficulty}:uberPortal:${id}`];
    if (id === 39) return !!player.quests[`${player.difficulty}:cowPortal`];
    return true;
  }).sort((a,b) => a-b);
}
export function canTravel(player: Player, areaId: number): boolean {
  if (!Number.isInteger(areaId) || areaId < 1 || areaId > 136) return false;
  const area = getArea(areaId);
  if (areaId >= 133) return !!player.quests[`${player.difficulty}:uberPortal:${areaId}`];
  if (areaId === 39) return !!player.quests[`${player.difficulty}:cowPortal`];
  return area.act <= player.unlockedActs && (area.town || (area.waypoint && player.waypoints.includes(areaId)));
}

/** Local RNG: map/monster generation never consumes the engine RNG or Math.random. */
export function worldRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let n = Math.imul(state ^ (state >>> 15), state | 1);
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}
function integer(rng: Rng, min: number, max: number): number { return min + Math.floor(rng() * (max - min + 1)); }
const diffIndex = (difficulty: Difficulty): number => ['normal','nightmare','hell'].indexOf(difficulty);
const suffix = (difficulty: Difficulty): string => ['', '(N)', '(H)'][diffIndex(difficulty)];
let monRows: Map<string, RawRow> | undefined;
let levelRows: Map<number, RawRow> | undefined;
function monsterRow(code: string): RawRow {
  monRows ??= new Map(rawRows('monstats').map(row => [text(row,'Id'), row]));
  const row = monRows.get(code);
  if (!row) throw new RangeError(`Unknown monster ${code}`);
  return row;
}
function levelRow(level: number): RawRow {
  levelRows ??= new Map(rawRows('MonLvl').map(row => [num(row,'Level'), row]));
  const row = levelRows.get(level);
  if (!row) throw new RangeError(`Unknown monster scaling level ${level}`);
  return row;
}
// Case-insensitive lookup handles normal minHP versus Nightmare/Hell MinHP.
function field(row: RawRow, key: string): number {
  if (row[key] !== undefined) return num(row,key);
  const actual = Object.keys(row).find(k => k.toLowerCase() === key.toLowerCase());
  return actual === undefined ? 0 : num(row,actual);
}
export interface MonsterStats {
  baseLevel: number; level: number; minLife: number; maxLife: number;
  minDamage: number; maxDamage: number; defense: number; attackRating: number;
  experience: number; resists: Record<Element,number>;
}
export type MonsterRank = 'normal' | 'unique' | 'champion' | 'minion';
export function monsterStats(code: string, area: AreaDef | number, difficulty: Difficulty, rank: MonsterRank = 'normal'): MonsterStats {
  const def = typeof area === 'number' ? getArea(area) : area;
  const row = monsterRow(code), d = diffIndex(difficulty), s = suffix(difficulty);
  const fixed = field(row,'boss') !== 0 || field(row,'primeevil') !== 0 || field(row,'noRatio') !== 0;
  const baseLevel = fixed || difficulty === 'normal' ? field(row,`Level${s}`) : def.levels[d];
  const elite = !fixed && rank !== 'normal';
  const level = baseLevel + (elite ? rank === 'champion' ? 2 : 3 : 0);
  const base = levelRow(baseLevel), effective = levelRow(level);
  const scale = (key: string, table: RawRow, column: string): number => field(row,'noRatio')
    ? field(row,`${key}${s}`) : Math.floor(field(table,`L-${column}${s}`) * field(row,`${key}${s}`) / 100);
  const lifeMultiplier = !elite ? 1 : rank === 'unique' ? [4,3,2][d] : rank === 'champion' ? [3,2.5,2][d] : [2,1.75,1.5][d];
  const life = (key: string): number => Math.floor(scale(key,base,'HP') * 256 * lifeMultiplier) / 256;
  const resists = {physical:field(row,`ResDm${s}`),magic:field(row,`ResMa${s}`),fire:field(row,`ResFi${s}`),lightning:field(row,`ResLi${s}`),cold:field(row,`ResCo${s}`),poison:field(row,`ResPo${s}`)};
  return {
    baseLevel, level, minLife:life('minHP'), maxLife:life('maxHP'),
    minDamage:scale('A1MinD',effective,'DM'), maxDamage:scale('A1MaxD',effective,'DM'),
    defense:scale('AC',base,'AC'), attackRating:scale('A1TH',effective,'TH'),
    experience:scale('Exp',base,'XP') * (elite ? rank === 'champion' ? 3 : 5 : 1), resists,
  };
}
const MONSTER_NAMES: Record<string,string> = {
  zombie1:'僵尸',zombie2:'饥饿死者',fallen1:'沉沦魔',fallen2:'利刃魔',fallen3:'小恶魔',fallen4:'黑暗魔',fallen5:'扭曲魔',
  fallenshaman1:'沉沦魔巫师',quillrat1:'硬毛老鼠',brute1:'巨大野兽',bloodraven:'血鸟',andariel:'安达利尔',duriel:'都瑞尔',
  mephisto:'墨菲斯托',diablo:'迪亚波罗',baalcrab:'巴尔',radament:'罗达门特',izual:'衣卒尔',summoner:'召唤者',smith:'铁匠',nihlathakboss:'尼拉塞克',
};
export function createMonster(code: string, area: AreaDef | number, difficulty: Difficulty, rng: Rng, position: Point, uid: string, rank: MonsterRank = 'normal'): Monster {
  const row = monsterRow(code), stats = monsterStats(code,area,difficulty,rank);
  // Roll the whole-point base before applying an elite multiplier in life bits.
  const fixed = field(row,'boss') !== 0 || field(row,'primeevil') !== 0 || field(row,'noRatio') !== 0;
  const d = diffIndex(difficulty);
  const multiplier = fixed || rank === 'normal' ? 1 : rank === 'unique' ? [4,3,2][d]
    : rank === 'champion' ? [3,2.5,2][d] : [2,1.75,1.5][d];
  const maxLife = Math.floor(integer(rng, Math.round(stats.minLife/multiplier), Math.round(stats.maxLife/multiplier)) * multiplier * 256) / 256;
  const rawAI = text(row,'AI');
  const fixedBoss = field(row,'boss') !== 0 || field(row,'primeevil') !== 0;
  const ai: Monster['ai'] = /Shaman|GreaterMummy/i.test(rawAI) ? 'shaman'
    : /BloodRaven|Summoner|archer|mage|QuillRat|Vampire|Slinger|Blow|Succubus|Cantor|Willowisp|Imp/i.test(`${rawAI} ${code}`) ? 'ranged'
    : fixedBoss ? 'boss' : 'melee';
  return {uid,code,name:MONSTER_NAMES[code] ?? text(row,'NameStr') ?? code,...position,
    level:stats.level,life:maxLife,maxLife,minDamage:stats.minDamage,maxDamage:stats.maxDamage,defense:stats.defense,
    attackRating:stats.attackRating,experience:stats.experience,resists:stats.resists,
    boss:fixedBoss || rank === 'unique',champion:rank === 'champion',ai,
    color:fixedBoss || rank === 'unique' ? '#cba55b' : ai === 'shaman' ? '#b64d36' : ai === 'ranged' ? '#887948' : '#758163',
    cooldown:0,dead:false,chill:0,poison:0,poisonFrames:0,modifiers:rank === 'minion' ? ['minion'] : []};
}

const TOWN_NPCS: Record<number,string[]> = {
  1:['akara','charsi','gheed','kashya','warriv'],
  40:['atma','fara','drognan','elzix','lysander','greiz','cain','geglash','jerhyn','kaelan','meshif','warriv'],
  75:['alkor','asheara','hratli','ormus','cain','meshif','natalya'],
  103:['halbu','jamella','cain','tyrael'],109:['larzuk','malah','nihlathak','qualkehk','cain'],
};
const SUPER_NAMES: Record<string,string> = {
  Corpsefire:'尸体发火','The Countess':'女伯爵',Bishibosh:'毕须博须',Bonebreak:'碎骨者',Coldcrow:'冰冷乌鸦',
  Rakanishu:'拉卡尼休','Treehead WoodFist':'树头木拳',Griswold:'格瑞斯华尔德',Boneash:'骨灰',
  'The Smith':'铁匠',Radament:'罗达门特','The Summoner':'召唤者','The Feature Creep':'海法斯特',
  'Siege Boss':'督军山克','Megaflow Rectifier':'矫正者艾德利奇','Threash Socket':'剥壳凹槽',
  Pindleskin:'暴躁外皮',Frozenstein:'冰冻怪魔','Nihlathak Boss':'尼拉塞克',
};
const ACT_BOSSES: Record<number,string> = {17:'bloodraven',37:'andariel',73:'duriel',102:'mephisto',105:'izual',108:'diablo',132:'baalcrab',133:'uberandariel',134:'uberduriel',135:'ubermephisto',136:'uberdiablo'};

const BLOCK_SIZE = 12;
const BLOCK_DIRECTIONS = [{dx:0,dy:-1,bit:1,back:4},{dx:1,dy:0,bit:2,back:8},{dx:0,dy:1,bit:4,back:1},{dx:-1,dy:0,bit:8,back:2}] as const;
const BLOCK_SHAPES = [{name:'end',ports:1},{name:'straight',ports:5},{name:'bend',ports:3},{name:'tee',ports:7},{name:'cross',ports:15}] as const;
const rotatePorts = (ports: number,turns: number): number => {
  for (let i=0;i<turns;i++) ports=((ports<<1)&15)|(ports>>3);
  return ports;
};

/** Original binary-tile templates, not DS1/DT1 assets. Always retain the 5×4 bounding box. */
function blockLayout(def: AreaDef, topology: Rng, terrain: Rng): {layout: AreaLayout; tiles: number[][]; spawn: Point} {
  const neighbors = (cell: number) => BLOCK_DIRECTIONS.map(d=>({
    ...d,cell:cell+d.dx+d.dy*5,
  })).filter(d=>cell%5+d.dx>=0 && cell%5+d.dx<5 && Math.floor(cell/5)+d.dy>=0 && Math.floor(cell/5)+d.dy<4);
  const active=new Set<number>([10]),ports=new Map<number,number>([[10,0]]);
  const link = (a: number,b: number) => {
    const d=neighbors(a).find(n=>n.cell===b)!;
    active.add(a);active.add(b);
    ports.set(a,(ports.get(a)??0)|d.bit);ports.set(b,(ports.get(b)??0)|d.back);
  };
  // A randomly offset west/east backbone, followed by short north/south branches.
  // The monotone backbone cannot self-intersect, even when its lane reaches the bounding edge.
  const lane=integer(topology,0,3),enter=integer(topology,0,2),leave=integer(topology,enter+1,4);
  let trunk=10;
  for (const target of [enter+10,enter+lane*5,leave+lane*5,leave+10,14]) {
    while (trunk%5!==target%5) {const next=trunk+Math.sign(target%5-trunk%5);link(trunk,next);trunk=next;}
    while (Math.floor(trunk/5)!==Math.floor(target/5)) {const next=trunk+5*Math.sign(Math.floor(target/5)-Math.floor(trunk/5));link(trunk,next);trunk=next;}
  }
  // Each new shortest branch stops at the tree: adjacent but unlinked slots remain sealed.
  for (const anchor of [2,17]) {
    const distance=new Map<number,number>([...active].map(c=>[c,0])),queue=[...active];
    for (let i=0;i<queue.length;i++) for (const n of neighbors(queue[i])) if (!distance.has(n.cell)) {
      distance.set(n.cell,distance.get(queue[i])!+1);queue.push(n.cell);
    }
    let cell=anchor;
    while (distance.get(cell)!>0) {
      const choices=neighbors(cell).filter(n=>distance.get(n.cell)===distance.get(cell)!-1);
      const next=choices[integer(topology,0,choices.length-1)].cell;
      link(cell,next);cell=next;
    }
  }
  const count=Math.max(active.size,integer(topology,12,20));
  while (active.size<count) {
    const frontier=[...active].flatMap(a=>neighbors(a).filter(n=>!active.has(n.cell)).map(n=>({a,b:n.cell})));
    const edge=frontier[integer(topology,0,frontier.length-1)];link(edge.a,edge.b);
  }
  // Only explicit reciprocal edges form loops; no fallback ever shrinks the block count.
  for (let i=0,loops=integer(topology,0,2);i<loops;i++) {
    const choices=[...active].flatMap(a=>neighbors(a).filter(n=>active.has(n.cell) && a<n.cell && !(ports.get(a)!&n.bit)).map(n=>({a,b:n.cell})));
    if (!choices.length) break;
    const edge=choices[integer(topology,0,choices.length-1)];link(edge.a,edge.b);
  }
  const profile=def.style==='cave' ? 'cave' : def.style==='dungeon' ? ([18,19].includes(def.id) ? 'crypt' : 'dungeon')
    : def.id===17 ? 'yard' : def.id===5 ? 'forest' : 'wilderness';
  const variants: Record<string,string[]>={wilderness:['road','rocks'],forest:['dense','tree'],yard:['yard','graves'],crypt:['yard-room','crypt-room'],cave:['chamber','lobed-chamber'],dungeon:['room','corridor']};
  const tiles=Array.from({length:50},()=>Array<number>(62).fill(1));
  const layout: AreaLayout={blockSize:BLOCK_SIZE,blocks:[]};
  for (const cell of [...active].sort((a,b)=>a-b)) {
    const mask=ports.get(cell)!,matches=BLOCK_SHAPES.flatMap(shape=>[0,1,2,3].filter(turn=>rotatePorts(shape.ports,turn)===mask).map(turn=>({shape,turn})));
    const {shape,turn}=matches[integer(terrain,0,matches.length-1)],variant=variants[profile][integer(terrain,0,1)];
    const local=Array.from({length:12},()=>Array<number>(12).fill(1));
    if (profile==='cave') {
      const phase=terrain()*Math.PI*2;
      for (let y=1;y<11;y++) for (let x=1;x<11;x++) {
        const angle=Math.atan2(y-6,x-6),radius=3.5+Math.sin(angle*3+phase)*(variant==='chamber' ? .8 : 1.5)+terrain()*.8;
        if (Math.hypot((x-6)*.9,y-6)<radius) local[y][x]=0;
      }
    } else if (profile==='dungeon' || profile==='crypt') {
      if (variant!=='corridor') {
        const inset=integer(terrain,1,3);
        for (let y=2;y<10;y++) for (let x=inset;x<11-inset;x++) local[y][x]=0;
        if (profile==='crypt') for (const x of [3,8]) for (const y of [3,8]) local[y][x]=1;
      } else {
        for (let y=3;y<9;y++) for (let x=4;x<8;x++) local[y][x]=0;
      }
    } else {
      for (let y=1;y<11;y++) for (let x=1;x<11;x++) local[y][x]=0;
      if (profile==='yard') {
        for (const x of [2,3,8,9]) for (const y of [2,3,8,9]) local[y][x]=1;
      } else {
        const clusters=profile==='forest' ? (variant==='dense' ? 14 : 10) : (variant==='road' ? 3 : 6);
        for (let i=0;i<clusters;i++) {
          const x=integer(terrain,1,10),y=integer(terrain,1,10);
          local[y][x]=1;
          if (variant==='rocks' || profile==='forest') local[Math.min(10,y+1)][x]=1;
        }
      }
    }
    // Rotate the selected canonical template's interior; edges are stamped from its matched ports.
    let rotated=local;
    for (let i=0;i<turn;i++) rotated=rotated[0].map((_,y)=>rotated.map(row=>row[y]).reverse());
    const clear = (x: number,y: number) => { rotated[y][x]=0; };
    for (let y=4;y<=8;y++) for (let x=4;x<=8;x++) clear(x,y);
    for (const d of BLOCK_DIRECTIONS) if (mask&d.bit) {
      for (let step=0;step<=6;step++) for (let side=-1;side<=1;side++) {
        const x=6+d.dx*step+(d.dy ? side : 0),y=6+d.dy*step+(d.dx ? side : 0);
        if (x>=0 && y>=0 && x<12 && y<12) clear(x,y);
      }
    }
    // Restore sealed edges after rotation. A port opens exactly indices 5..7, never corners.
    for (let i=0;i<12;i++) {
      rotated[0][i]=(mask&1) && i>=5 && i<=7 ? 0 : 1;
      rotated[i][11]=(mask&2) && i>=5 && i<=7 ? 0 : 1;
      rotated[11][i]=(mask&4) && i>=5 && i<=7 ? 0 : 1;
      rotated[i][0]=(mask&8) && i>=5 && i<=7 ? 0 : 1;
    }
    // Template repair is strictly block-local: seal tiny orphan pockets, never cut an unlinked edge.
    const queue=[{x:6,y:6}],seen=new Set<number>([78]);
    for (let i=0;i<queue.length;i++) for (const d of BLOCK_DIRECTIONS) {
      const x=queue[i].x+d.dx,y=queue[i].y+d.dy,key=y*12+x;
      if (rotated[y]?.[x]===0 && !seen.has(key)) {seen.add(key);queue.push({x,y});}
    }
    for (let y=0;y<12;y++) for (let x=0;x<12;x++) if (!seen.has(y*12+x)) rotated[y][x]=1;
    const x=1+(cell%5)*12,y=1+Math.floor(cell/5)*12;
    layout.blocks.push({x,y,width:12,height:12,ports:mask,template:`${profile}/${variant}/${shape.name}@${turn*90}`,center:{x:x+6,y:y+6}});
    for (let yy=0;yy<12;yy++) for (let xx=0;xx<12;xx++) tiles[y+yy][x+xx]=rotated[yy][xx];
  }
  // External entry pads stop inside their boundary block. Surface composition alone opens legal seams.
  for (const [cell,entry] of [[10,{x:2,y:6}],[14,{x:10,y:6}],[2,{x:6,y:2}],[17,{x:6,y:10}]] as const) {
    const block=layout.blocks.find(b=>b.x===1+(cell%5)*12 && b.y===1+Math.floor(cell/5)*12)!;
    let x=6,y=6;
    const pad = () => {
      for (let dy=-1;dy<=1;dy++) for (let dx=-1;dx<=1;dx++)
        if (x+dx>0 && x+dx<11 && y+dy>0 && y+dy<11) tiles[block.y+y+dy][block.x+x+dx]=0;
    };
    pad();
    while (x!==entry.x) {x+=Math.sign(entry.x-x);pad();}
    while (y!==entry.y) {y+=Math.sign(entry.y-y);pad();}
  }
  return {layout,tiles,spawn:{x:4,y:31}};
}

/** Act I uses connected original block templates; all other areas retain their compact layouts. */
export function createArea(id: number, difficulty: Difficulty, seed: number, player: Player): AreaState {
  const def = getArea(id);
  const baseSeed=(seed ^ Math.imul(id,0x9e3779b1) ^ Math.imul(diffIndex(difficulty)+1,0x85ebca6b)) >>> 0;
  const rng = worldRng(baseSeed);
  const modular = !def.town && id>=2 && id<=37;
  // Geometry and scene placement are independent local streams, never the engine's item RNG.
  const generated = modular ? blockLayout(def,worldRng(baseSeed^0x243f6a88),worldRng(baseSeed^0xb7e15162)) : undefined;
  const placementRng = modular ? worldRng(baseSeed^0xa4093822) : rng;
  const indoor = def.style === 'cave' || def.style === 'dungeon' || [107,125,126,127,135].includes(id);
  const cave = def.style === 'cave';
  const width = generated ? 62 : def.town ? 34 : id === 8 ? 32 : cave ? 36 : indoor ? 38 : 44;
  const height = generated ? 50 : def.town ? 28 : id === 8 ? 28 : indoor ? 30 : 34;
  const spawn = generated?.spawn ?? {x:def.town ? 10 : 5,y:Math.floor(height/2)};
  const tiles = generated?.tiles ?? Array.from({length:height},(_,y) => Array.from({length:width},(_,x) =>
    x === 0 || y === 0 || x === width-1 || y === height-1 || indoor ? 1 : 0));
  const inner = (x: number,y: number): boolean => x>0 && y>0 && x<width-1 && y<height-1;
  const room = (x: number,y: number,w: number,h: number): void => {
    for (let yy=Math.max(1,y); yy<Math.min(height-1,y+h); yy++)
      for (let xx=Math.max(1,x); xx<Math.min(width-1,x+w); xx++) tiles[yy][xx]=0;
  };
  const wall = (x: number,y: number,w: number,h: number): void => {
    for (let yy=y; yy<Math.min(height-1,y+h); yy++)
      for (let xx=x; xx<Math.min(width-1,x+w); xx++) tiles[yy][xx]=1;
  };
  const corridor = (from: Point,to: Point,radius=1): void => {
    let {x,y}=from;
    room(x-radius,y-radius,2*radius+1,2*radius+1);
    while (x !== to.x) { x += Math.sign(to.x-x); room(x-radius,y-radius,2*radius+1,2*radius+1); }
    while (y !== to.y) { y += Math.sign(to.y-y); room(x-radius,y-radius,2*radius+1,2*radius+1); }
  };
  const flood = (): Set<number> => {
    const seen=new Set<number>([spawn.y*width+spawn.x]),queue=[spawn.y*width+spawn.x];
    for (let i=0;i<queue.length;i++) {
      const x=queue[i]%width,y=Math.floor(queue[i]/width);
      for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx=x+dx,ny=y+dy,key=ny*width+nx;
        if (inner(nx,ny) && tiles[ny][nx]===0 && !seen.has(key)) { seen.add(key);queue.push(key); }
      }
    }
    return seen;
  };
  const connect = (point: Point): void => {
    if (generated) {
      const block=generated.layout.blocks.find(b=>point.x>b.x && point.x<b.x+11 && point.y>b.y && point.y<b.y+11);
      if (!block || tiles[point.y]?.[point.x]!==0) throw new Error(`Invalid scene floor in ${id}`);
      // Only interior safe pads may be enlarged; ports and closed block edges are immutable.
      room(Math.max(block.x+1,point.x-1),Math.max(block.y+1,point.y-1),
        Math.min(block.x+11,point.x+2)-Math.max(block.x+1,point.x-1),Math.min(block.y+11,point.y+2)-Math.max(block.y+1,point.y-1));
      return;
    }
    room(point.x-1,point.y-1,3,3);
    const reach=flood();
    if (reach.has(point.y*width+point.x)) return;
    let best=point,bestDistance=Infinity;
    for (const key of reach) {
      const x=key%width,y=Math.floor(key/width),d=Math.abs(x-point.x)+Math.abs(y-point.y);
      if (d<bestDistance) { bestDistance=d;best={x,y}; }
    }
    corridor(point,best,cave ? 1 : indoor ? 0 : 1);
  };
  if (generated) {
    // The connected skeleton and rotated block interiors have already been stamped.
  } else if (def.town) {
    // Buildings, central street and service plaza; all collision stays tile-based.
    for (const [x,y,w,h] of [[3,3,6,6],[23,3,7,6],[3,20,6,5],[23,20,7,5]]) wall(x,y,w,h);
    room(8,10,17,9);
  } else if (cave) {
    // Cellular-automata cavern; isolated pockets are joined or sealed below.
    for (let y=1;y<height-1;y++) for (let x=1;x<width-1;x++) tiles[y][x]=rng()<.45 ? 1 : 0;
    for (let pass=0;pass<4;pass++) {
      const next=tiles.map(row=>[...row]);
      for (let y=1;y<height-1;y++) for (let x=1;x<width-1;x++) {
        let walls=0;
        for (let dy=-1;dy<=1;dy++) for (let dx=-1;dx<=1;dx++) walls+=tiles[y+dy]?.[x+dx] ?? 1;
        next[y][x]=walls>=5 ? 1 : 0;
      }
      for (let y=1;y<height-1;y++) tiles[y]=next[y];
    }
    room(spawn.x-2,spawn.y-2,5,5);
    for (let guard=0;guard<40;guard++) {
      const reach=flood();
      let orphan: Point | undefined;
      for (let y=1;y<height-1 && !orphan;y++) for (let x=1;x<width-1;x++) if (tiles[y][x]===0 && !reach.has(y*width+x)) { orphan={x,y};break; }
      if (!orphan) break;
      const pocket=[orphan],mark=new Set([orphan.y*width+orphan.x]);
      for (let i=0;i<pocket.length;i++) for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const x=pocket[i].x+dx,y=pocket[i].y+dy,key=y*width+x;
        if (inner(x,y) && tiles[y][x]===0 && !mark.has(key)) { mark.add(key);pocket.push({x,y}); }
      }
      if (pocket.length<12) for (const t of pocket) tiles[t.y][t.x]=1;
      else connect(pocket[Math.floor(pocket.length/2)]);
    }
  } else if (indoor) {
    // 3×3 room grid joined in a serpentine with two extra loops.
    const cellW=Math.floor((width-2)/3),cellH=Math.floor((height-2)/3),centers: Point[]=[];
    for (let gy=0;gy<3;gy++) for (let gx=0;gx<3;gx++) {
      const w=integer(rng,5,cellW-2),h=integer(rng,4,cellH-2);
      const x=1+gx*cellW+integer(rng,1,Math.max(1,cellW-w-1)),y=1+gy*cellH+integer(rng,1,Math.max(1,cellH-h-1));
      room(x,y,w,h);
      centers.push({x:x+Math.floor(w/2),y:y+Math.floor(h/2)});
    }
    const narrow = id>=62 && id<=64 ? 0 : 1;
    for (const [a,b] of [[0,1],[1,2],[2,5],[5,4],[4,3],[3,6],[6,7],[7,8]]) corridor(centers[a],centers[b],narrow);
    corridor(centers[integer(rng,0,2)],centers[integer(rng,6,8)],0);
    corridor(spawn,centers[3]);
  } else {
    // Open field: thin ragged border, then sparse isolated trees/rocks scattered inside.
    // No road corridors — the interior is mostly open, like D2's outdoor zones.
    const phase=rng()*Math.PI*2;
    // Border: 1-3 tile thick, irregular silhouette via sin waves.
    for (let x=1;x<width-1;x++) {
      const top=1+Math.floor(.8*(1+Math.sin(x*.41+phase))+rng()*.8),bottom=1+Math.floor(.8*(1+Math.cos(x*.37+phase))+rng()*.8);
      wall(x,1,1,top);wall(x,height-1-bottom,1,bottom);
    }
    for (let y=1;y<height-1;y++) {
      const left=1+Math.floor(.7*(1+Math.sin(y*.5+phase))+rng()*.6),right=1+Math.floor(.7*(1+Math.cos(y*.43+phase))+rng()*.6);
      wall(1,y,left,1);wall(width-1-right,y,right,1);
    }
    // Sparse interior obstacles: single tiles or pairs, never adjacent to each other.
    const isJungle = def.style === 'jungle' || id === 5;
    const count = Math.floor(width * height / (isJungle ? 55 : 90));
    const placed = new Set<number>();
    for (let i=0,attempts=0; i<count && attempts<count*8; attempts++) {
      const cx=integer(rng,4,width-5),cy=integer(rng,4,height-5);
      if (Math.hypot(cx-spawn.x,cy-spawn.y)<5) continue;
      // Reject if any neighbour within radius 3 is already a placed obstacle.
      let tooClose=false;
      for (let dy=-3;dy<=3&&!tooClose;dy++) for (let dx=-3;dx<=3&&!tooClose;dx++)
        if (placed.has((cy+dy)*width+(cx+dx))) tooClose=true;
      if (tooClose) continue;
      // Place a 1-tile obstacle, occasionally a 2-tile L-shape.
      if (inner(cx,cy) && tiles[cy][cx]===0) {
        tiles[cy][cx]=1; placed.add(cy*width+cx);
        if (rng()<.35) {
          const nx=cx+(rng()<.5?1:-1),ny=cy;
          if (inner(nx,ny) && tiles[ny][nx]===0) { tiles[ny][nx]=1; placed.add(ny*width+nx); }
        }
        i++;
      }
    }
  }
  room(spawn.x-2,spawn.y-2,5,5);
  const area: AreaState = {def,width,height,tiles,revealed:Array.from({length:height},()=>Array<boolean>(width).fill(false)),
    spawn,seed,objects:[],monsters:[],drops:[],...(generated ? {layout:generated.layout} : {})};
  const occupied = new Set<string>([`${spawn.x},${spawn.y}`]);
  const blockSteps=new Map<AreaLayout['blocks'][number],number>(),mainRoad=new Set<AreaLayout['blocks'][number]>();
  if (generated) {
    const blocks=generated.layout.blocks,start=blocks.find(b=>b.x===1 && b.y===25)!;
    const queue=[start],parent=new Map<AreaLayout['blocks'][number],AreaLayout['blocks'][number]>();
    blockSteps.set(start,0);
    for (let i=0;i<queue.length;i++) for (const d of BLOCK_DIRECTIONS) if (queue[i].ports&d.bit) {
      const next=blocks.find(b=>b.x===queue[i].x+d.dx*12 && b.y===queue[i].y+d.dy*12)!;
      if (!blockSteps.has(next)) {blockSteps.set(next,blockSteps.get(queue[i])!+1);parent.set(next,queue[i]);queue.push(next);}
    }
    let block: AreaLayout['blocks'][number] | undefined=blocks.find(b=>b.x===49 && b.y===25);
    while (block) {mainRoad.add(block);block=parent.get(block);}
  }
  const scenePosition = (kind: 'waypoint'|'chest'|'shrine'|'npc'): Point => {
    const blocks=generated!.layout.blocks;
    let preferred=blocks.filter(b=>blockSteps.get(b)!>0);
    if (kind==='waypoint') preferred=preferred.filter(b=>mainRoad.has(b));
    if (kind==='chest') {
      const leaves=preferred.filter(b=>(b.ports&(b.ports-1))===0);
      preferred=(leaves.length ? leaves : preferred).sort((a,b)=>blockSteps.get(b)!-blockSteps.get(a)!);
      preferred=preferred.slice(0,Math.max(1,Math.ceil(preferred.length*.35)));
    }
    if (kind==='shrine') {
      const scenic=preferred.filter(b=>/room|chamber|yard|tree|rocks/.test(b.template));
      if (scenic.length) preferred=scenic;
    }
    if (kind==='npc') preferred=blocks.filter(b=>b.x===1 && b.y===25);
    const block=preferred[integer(placementRng,0,preferred.length-1)];
    const points: Point[]=[];
    for (let y=block.y+3;y<=block.y+8;y++) for (let x=block.x+3;x<=block.x+8;x++)
      if (tiles[y][x]===0 && !occupied.has(`${x},${y}`)) points.push({x,y});
    return points[integer(placementRng,0,points.length-1)];
  };
  const addObject = (kind: WorldObject['kind'],name: string,position: Point,extra: Partial<WorldObject> = {}): WorldObject => {
    let {x,y}=position;
    if (generated && occupied.has(`${x},${y}`)) {
      const block=generated.layout.blocks.find(b=>x>b.x && x<b.x+11 && y>b.y && y<b.y+11)!;
      const choices: Point[]=[];
      for (let yy=block.y+1;yy<block.y+11;yy++) for (let xx=block.x+1;xx<block.x+11;xx++)
        if (tiles[yy][xx]===0 && !occupied.has(`${xx},${yy}`)) choices.push({x:xx,y:yy});
      choices.sort((a,b)=>Math.abs(a.x-x)+Math.abs(a.y-y)-Math.abs(b.x-x)-Math.abs(b.y-y));
      ({x,y}=choices[0]);
    } else while (occupied.has(`${x},${y}`)) { x++; if (x>=width-2) {x=2;y++;} }
    if (!def.town) connect({x,y}); else corridor(spawn,{x,y});
    occupied.add(`${x},${y}`);
    const object: WorldObject = {uid:`${difficulty}:${id}:${seed}:o${area.objects.length}`,kind,name,x,y,...extra};
    area.objects.push(object);
    return object;
  };
  // Generate only the exits the player can actually use, not arbitrary cross-act shortcuts.
  const travelPlayer = player.difficulty === difficulty ? player : {...player,difficulty};
  const targets = getConnections(travelPlayer,id);
  const positions: Point[] = def.town
    ? [{x:15,y:spawn.y},{x:19,y:spawn.y+6},{x:28,y:spawn.y}]
    : [{x:3,y:spawn.y},{x:width-4,y:Math.floor(height/2)},{x:Math.floor(width/2),y:height-4},{x:Math.floor(width/2),y:3},{x:width-7,y:height-5},{x:width-7,y:4},{x:9,y:height-4},{x:9,y:3}];
  targets.forEach((target,index) => {
    const gate = WORLD_GATES.find(g => g.implemented && ((g.from===id && g.to===target)||(g.to===id && g.from===target)));
    let position=positions[index % positions.length];
    if (generated) {
      const anchors=[{x:3,y:31},{x:58,y:31},{x:31,y:46},{x:31,y:3}];
      const a=SURFACE_CELLS[id],b=SURFACE_CELLS[target];
      const direction=a && b && Math.abs(a.x-b.x)+Math.abs(a.y-b.y)===1
        ? b.x<a.x ? 0 : b.x>a.x ? 1 : b.y>a.y ? 2 : 3 : index%4;
      position=anchors[direction];
    }
    addObject(gate?.kind === 'portal' ? 'portal' : 'exit',getArea(target).name,position,{targetArea:target});
  });
  if (def.waypoint) addObject('waypoint','传送点',def.town ? {x:12,y:11} : generated ? scenePosition('waypoint') : {x:9,y:spawn.y-4});
  if (def.town) {
    addObject('stash','私人储物箱',{x:9,y:11});
    const npcs=[...TOWN_NPCS[id]];
    if (id === 1 && status(travelPlayer,'a1q3') >= 3) npcs.push('cain');
    npcs.forEach((npcId,index) => addObject('npc',NPCS[npcId].name,
      {x:11+(index%6)*3,y:18+Math.floor(index/6)*3},{npcId}));
  } else {
    addObject('chest','宝箱',generated ? scenePosition('chest') : {x:width-9,y:height-8});
    if (id !== 8 && id !== 120) {
      const level = def.levels[['normal', 'nightmare', 'hell'].indexOf(difficulty)];
      const choices = SHRINES.filter(shrine => shrine.levelMin <= Math.max(1, level));
      // Local deterministic distribution, not a claim of original shrine spawn odds.
      const shrine = choices[integer(placementRng, 0, choices.length - 1)];
      addObject('shrine', shrine.name, generated ? scenePosition('shrine') : {x:Math.floor(width*.35),y:7}, {shrineCode: shrine.code});
    }
    if (id === 2) addObject('npc',NPCS.flavie.name,generated ? scenePosition('npc') : {x:9,y:spawn.y+3},{npcId:'flavie'});
    // a1q3: 凯恩被困在崔斯特瑞姆的牢笼旁，需通过石块旷野传送门抵达
    if (id === 38) addObject('npc',NPCS.cain.name,{x:Math.floor(width/2),y:Math.floor(height/2)},{npcId:'cain'});
    // a1q5: 军营铁架上的赫拉迪克马勒斯
    if (id === 28) addObject('chest','赫拉迪克马勒斯',generated ? scenePosition('chest') : {x:width-6,y:7});
    // a3q4: 库拉斯特废弃寺院中的蓝·依森古书
    if (id === 95) addObject('chest','蓝·依森的古书',generated ? scenePosition('chest') : {x:width-6,y:7});
    // a5q3: 冰封安雅在冰冻高地
    if (id === 115) addObject('npc',NPCS.anya.name,generated ? scenePosition('npc') : {x:Math.floor(width/2),y:Math.floor(height/2)},{npcId:'anya'});
  }
  // Remove disconnected floor pockets before choosing monsters. Every floor/object is reachable.
  const reachable = new Set<string>();
  const queue: Point[] = [spawn],walkDistance=new Map<string,number>([[`${spawn.x},${spawn.y}`,0]]);
  reachable.add(`${spawn.x},${spawn.y}`);
  for (let index=0;index<queue.length;index++) {
    const p=queue[index];
    for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const x=p.x+dx,y=p.y+dy,key=`${x},${y}`;
      if (x<0 || y<0 || x>=width || y>=height || tiles[y][x]!==0 || reachable.has(key)) continue;
      reachable.add(key);walkDistance.set(key,walkDistance.get(`${p.x},${p.y}`)!+1);queue.push({x,y});
    }
  }
  if (generated && generated.layout.blocks.some(b=>!reachable.has(`${b.center.x},${b.center.y}`)))
    throw new Error(`Disconnected block skeleton in ${id}`);
  for (let y=1;y<height-1;y++) for (let x=1;x<width-1;x++) if (!reachable.has(`${x},${y}`)) tiles[y][x]=1;
  const candidates = queue.filter(p => Math.hypot(p.x-spawn.x,p.y-spawn.y)>=6 && !occupied.has(`${p.x},${p.y}`)
    && area.objects.every(o => Math.hypot(o.x-p.x,o.y-p.y)>=3.5));
  const take = (filter: (p: Point) => boolean): Point => {
    if (!candidates.length) throw new Error(`No monster floor in ${id}`);
    const preferred=candidates.filter(filter),pool=preferred.length ? preferred : candidates;
    const p=pool[integer(placementRng,0,pool.length-1)];
    candidates.splice(candidates.indexOf(p),1);
    return p;
  };
  const centers: Point[] = [];
  let pack: {center: Point;left: number;near: boolean} | null = null;
  const packPosition = (near: boolean): Point => {
    if (!pack || pack.left<=0 || pack.near!==near) {
      let best=candidates[0],score=-1;
      for (let i=0;i<28 && candidates.length;i++) {
        const c=candidates[integer(placementRng,0,candidates.length-1)],d=Math.hypot(c.x-spawn.x,c.y-spawn.y);
        if (near && (d<8 || d>10)) continue;
        const block=generated?.layout.blocks.find(b=>c.x>b.x+2 && c.x<b.x+10 && c.y>b.y+2 && c.y<b.y+10);
        if (generated && !near && !block) continue;
        const scenic=block && /room|chamber|dense|yard/.test(block.template) ? 2 : 0;
        const s=Math.min(d,...centers.map(o=>Math.hypot(o.x-c.x,o.y-c.y)))+scenic;
        if (s>score) { score=s;best=c; }
      }
      centers.push(best);pack={center:best,left:near ? 3 : integer(placementRng,3,6),near};
    }
    pack.left--;
    const {center}=pack;
    if (generated && near) {
      const nearby=candidates.filter(p=>Math.hypot(p.x-spawn.x,p.y-spawn.y)<=12);
      if (!nearby.length) throw new Error(`No safe first encounter in ${id}`);
      const clustered=nearby.filter(p=>Math.hypot(p.x-center.x,p.y-center.y)<=2.3);
      const pick=(clustered.length ? clustered : nearby)[integer(placementRng,0,(clustered.length ? clustered : nearby).length-1)];
      return take(p=>p===pick);
    }
    return take(p => Math.hypot(p.x-center.x,p.y-center.y)<=2.3 && (!near || Math.hypot(p.x-spawn.x,p.y-spawn.y)<=12));
  };
  const farPosition = (top: number): Point => {
    const distance=(p: Point) => generated ? walkDistance.get(`${p.x},${p.y}`)! : Math.hypot(p.x-spawn.x,p.y-spawn.y);
    const sorted=[...candidates].sort((a,b)=>distance(b)-distance(a));
    const pick=sorted[integer(placementRng,0,Math.max(0,Math.floor(sorted.length*top)-1))];
    return take(p => p===pick);
  };
  const addMonster = (code: string,rank: MonsterRank='normal',position: Point=packPosition(false)): Monster => {
    const monster=createMonster(code,def,difficulty,rng,position,`${difficulty}:${id}:${seed}:m${area.monsters.length}`,rank);
    area.monsters.push(monster);
    return monster;
  };
  const around = (anchor: Point) => take(p => Math.hypot(p.x-anchor.x,p.y-anchor.y)<=2.5);
  if (!def.town && (id<133 || id<=136) && id!==120) {
    if (id === 8) {
      // 24 total, including five Corpsefire minions and shaman packs; corpses are never removed here.
      for (const code of ['fallen1','fallen1','zombie1','brute1','fallenshaman1','fallen1','zombie1','fallen1','zombie1',
        'brute1','fallen1','fallenshaman1','zombie1','fallen1','zombie1','brute1','fallen1','zombie1']) addMonster(code);
    } else if (id !== 73 && id !== 132 && def.monsters.length) {
      const pool=difficulty === 'normal' ? def.monsters : NIGHTMARE_POOLS[id] ?? def.monsters;
      for (let i=0;i<(id===2 ? 18 : 26);i++) addMonster(pool[i<pool.length ? i : integer(rng,0,pool.length-1)],'normal',packPosition(id===2 && i<3));
    }
    const bossCode=ACT_BOSSES[id];
    if (bossCode) addMonster(bossCode,'normal',farPosition(.05));
    // Exclude scripted seal bosses/waves/Ancients until their trigger state machines exist.
    if (id!==108 && id!==131) for (const row of rawRows('SuperUniques').filter(row => num(row,'areaId')===id)) {
      const code=text(row,'Class');
      if (!code || code===bossCode) continue;
      const special=['smith','hephasto','griswold'].includes(code);
      const boss=addMonster(code,special ? 'normal' : 'unique',farPosition(.25));
      const name=text(row,'Superunique');
      boss.name=SUPER_NAMES[name] ?? name;
      boss.boss=true;
      boss.modifiers=['superunique:'+name,...['Mod1','Mod2','Mod3'].map(key=>num(row,key)).filter(Boolean).map(n=>`monumod:${n}`)];
      const count=integer(rng,num(row,'MinGrp'),num(row,'MaxGrp'));
      for (let i=0;i<count;i++) addMonster(/shaman/.test(code) ? code.replace('shaman','') : code,'minion',around(boss));
    }
  }
  return area;
}

/** Act I outdoor maps share coordinates; closed edges still retain their original walls. */
export const SURFACE_IDS = [1,2,3,4,5,6,7,17,26,27,32] as const;
const SURFACE_CELLS: Record<number, Point> = {
  1:{x:0,y:0},2:{x:1,y:0},3:{x:2,y:0},4:{x:3,y:0},17:{x:2,y:1},
  5:{x:0,y:2},6:{x:1,y:2},7:{x:2,y:2},26:{x:3,y:2},27:{x:4,y:2},32:{x:4,y:0},
};
export function containsRegion(region: SurfaceRegion, point: Point): boolean {
  return point.x >= region.x && point.y >= region.y && point.x < region.x + region.width && point.y < region.y + region.height;
}
export function getSurfaceRegion(area: AreaState, id: number): SurfaceRegion | undefined {
  return area.regions?.find(region => region.def.id === id);
}
/** Road gaps belong to the closest local rectangle, changing region halfway across. */
export function surfaceRegionAt(area: AreaState, point: Point): SurfaceRegion | undefined {
  const inside = area.regions?.find(region => containsRegion(region, point));
  if (inside || area.tiles[Math.floor(point.y)]?.[Math.floor(point.x)] !== 0) return inside;
  let nearest: SurfaceRegion | undefined, best = Infinity;
  for (const region of area.regions ?? []) {
    const dx = Math.max(region.x - point.x, 0, point.x - region.x - region.width);
    const dy = Math.max(region.y - point.y, 0, point.y - region.y - region.height);
    const d = Math.hypot(dx,dy);
    if (d < best) { best = d; nearest = region; }
  }
  return nearest;
}
export function isTownPoint(area: AreaState, point: Point): boolean {
  return area.regions ? area.regions.some(region => region.def.town && containsRegion(region,point)) : area.def.town;
}

export function createSurfaceWorld(difficulty: Difficulty, engineSeed: number, player: Player): AreaState {
  const regions: SurfaceRegion[] = [];
  const locals=SURFACE_IDS.map(id=>createArea(id,difficulty,(engineSeed ^ id * 2654435761) >>> 0,player));
  const slotWidth=Math.max(...locals.map(local=>local.width))+6,slotHeight=Math.max(...locals.map(local=>local.height))+6;
  locals.forEach(local=>{
    const cell = SURFACE_CELLS[local.def.id], x = cell.x * slotWidth, y = cell.y * slotHeight;
    const layout=local.layout ? {blockSize:local.layout.blockSize,blocks:local.layout.blocks.map(block=>({
      ...block,x:block.x+x,y:block.y+y,center:{x:block.center.x+x,y:block.center.y+y},
    }))} : undefined;
    regions.push({def:local.def,x,y,width:local.width,height:local.height,spawn:{x:x+local.spawn.x,y:y+local.spawn.y},seed:local.seed,
      ...(layout ? {layout} : {})});
  });
  const width = Math.max(...regions.map(r => r.x+r.width)), height = Math.max(...regions.map(r => r.y+r.height));
  const world: AreaState = {
    def:regions[0].def,width,height,seed:engineSeed,spawn:regions[0].spawn,regions,
    tiles:Array.from({length:height},()=>Array<number>(width).fill(1)),
    revealed:Array.from({length:height},()=>Array<boolean>(width).fill(false)),objects:[],monsters:[],drops:[],
  };
  locals.forEach((local,index) => {
    const region = regions[index];
    for (let y=0;y<local.height;y++) for (let x=0;x<local.width;x++) world.tiles[y+region.y][x+region.x]=local.tiles[y][x];
    for (const object of local.objects) { object.x+=region.x;object.y+=region.y;object.regionId=region.def.id;world.objects.push(object); }
    for (const monster of local.monsters) {
      monster.x+=region.x;monster.y+=region.y;monster.regionId=region.def.id;
      if (monster.target) monster.target={x:monster.target.x+region.x,y:monster.target.y+region.y};
      world.monsters.push(monster);
    }
    for (const drop of local.drops) { drop.x+=region.x;drop.y+=region.y;world.drops.push(drop); }
  });
  const travelPlayer = player.difficulty === difficulty ? player : {...player,difficulty};
  const carve = (from: Point,to: Point,allowed: (p: Point) => boolean): void => {
    let x=Math.floor(from.x),y=Math.floor(from.y);
    const paint = () => {
      for (let dy=-1;dy<=1;dy++) for (let dx=-1;dx<=1;dx++) {
        const point={x:x+dx,y:y+dy};
        if (allowed(point) && world.tiles[point.y]?.[point.x] !== undefined) world.tiles[point.y][point.x]=0;
      }
    };
    paint();
    while (x!==Math.floor(to.x)) {x+=Math.sign(to.x-x);paint();}
    while (y!==Math.floor(to.y)) {y+=Math.sign(to.y-y);paint();}
  };
  for (const a of regions) for (const target of getConnections(travelPlayer,a.def.id)) {
    const b=getSurfaceRegion(world,target);
    if (!b || a.def.id>=target || !getConnections(travelPlayer,target).includes(a.def.id)) continue;
    const ac=SURFACE_CELLS[a.def.id],bc=SURFACE_CELLS[target];
    if (Math.abs(ac.x-bc.x)+Math.abs(ac.y-bc.y)!==1) continue;
    const source=world.objects.find(o=>o.kind==='exit' && o.regionId===a.def.id && o.targetArea===target);
    const back=world.objects.find(o=>o.kind==='exit' && o.regionId===target && o.targetArea===a.def.id);
    if (!source || !back) continue;
    const horizontal=ac.y===bc.y, positive=horizontal ? bc.x>ac.x : bc.y>ac.y;
    const opening = (r: SurfaceRegion,forward: boolean): Point => horizontal
      ? {x:r.x+(forward ? r.width-2 : 1),y:r.y+(r.layout ? 31 : Math.floor(r.height/2))}
      : {x:r.x+(r.layout ? 31 : Math.floor(r.width/2)),y:r.y+(forward ? r.height-2 : 1)};
    const ap=opening(a,positive),bp=opening(b,!positive);
    const entryAllowed = (r: SurfaceRegion,entry: Point) => {
      const block=r.layout?.blocks.find(b=>entry.x>=b.x && entry.x<b.x+b.width && entry.y>=b.y && entry.y<b.y+b.height);
      // The route to a seam can cut only its boundary anchor, not any interior closed block edge.
      return (p: Point) => containsRegion(r,p) && (!block || (horizontal
        ? p.x>=block.x-1 && p.x<=block.x+block.width && p.y>block.y && p.y<block.y+block.height-1
        : p.y>=block.y-1 && p.y<=block.y+block.height && p.x>block.x && p.x<block.x+block.width-1));
    };
    carve(source,ap,entryAllowed(a,ap));carve(back,bp,entryAllowed(b,bp));
    // Bend only inside this legal edge's gap: no other adjacent component is opened.
    if (horizontal) {
      const middle=Math.floor((ap.x+bp.x)/2);
      const allowed=(p: Point) => p.x>=Math.min(ap.x,bp.x)-1 && p.x<=Math.max(ap.x,bp.x)+1 && p.y>=Math.min(ap.y,bp.y)-1 && p.y<=Math.max(ap.y,bp.y)+1;
      carve(ap,{x:middle,y:ap.y},allowed);carve({x:middle,y:ap.y},{x:middle,y:bp.y},allowed);carve({x:middle,y:bp.y},bp,allowed);
      if (a.def.id === 2 && target === 3) {
        const flavie = world.objects.find(o => o.npcId === 'flavie')!;
        Object.assign(flavie, { x: middle + .5, y: ap.y + 1.5 });
      }
    } else {
      const middle=Math.floor((ap.y+bp.y)/2);
      const allowed=(p: Point) => p.y>=Math.min(ap.y,bp.y)-1 && p.y<=Math.max(ap.y,bp.y)+1 && p.x>=Math.min(ap.x,bp.x)-1 && p.x<=Math.max(ap.x,bp.x)+1;
      carve(ap,{x:ap.x,y:middle},allowed);carve({x:ap.x,y:middle},{x:bp.x,y:middle},allowed);carve({x:bp.x,y:middle},bp,allowed);
    }
    Object.assign(source,{x:ap.x+.5,y:ap.y+.5,seam:true});Object.assign(back,{x:bp.x+.5,y:bp.y+.5,seam:true});
  }
  return world;
}

// A live reference prevents an already-pending Den reward being claimed after a revival.
// Persisted state 2 remains valid after reload; no transient map reference is required then.
const pendingDens = new WeakMap<Player,Map<Difficulty,AreaState>>();
export function onEnterArea(player: Player, area: AreaState): string[] {
  const messages: string[]=[];
  if (area.def.id === 1 && start(player,'a1q1')) messages.push('阿卡拉：从营地东侧进入鲜血荒地，找到邪恶洞窟并清除全部怪物。');
  if (area.def.id === 8) {
    if (start(player,'a1q1')) messages.push('邪恶洞窟：消灭洞内全部怪物，再回阿卡拉处领取奖励。');
    let maps=pendingDens.get(player);
    if (!maps) {maps=new Map();pendingDens.set(player,maps);}
    maps.set(player.difficulty,area);
    if (status(player,'a1q1')===1) messages.push(`洞内剩余 ${area.monsters.filter(m=>!m.dead).length} 个怪物。`);
  }
  const trigger: Record<number,string>={
    3:'a1q2',17:'a1q2',20:'a1q4',21:'a1q4',25:'a1q4',34:'a1q6',37:'a1q6',
    // Act 2
    40:'a2q1',47:'a2q1',49:'a2q1',
    44:'a2q3',
    52:'a2q4',74:'a2q4',
    55:'a2q5',
    65:'a2q6',66:'a2q6',
    // Act 3
    78:'a3q1',79:'a3q1',
    80:'a3q2',91:'a3q2',
    85:'a3q3',86:'a3q3',87:'a3q3',
    95:'a3q4',
    97:'a3q5',98:'a3q5',
    100:'a3q6',
    // Act 4
    104:'a4q1',105:'a4q1',
    106:'a4q2',
    107:'a4q3',108:'a4q3',
    // Act 5
    110:'a5q1',111:'a5q1',
    112:'a5q2',113:'a5q2',121:'a5q2',
    115:'a5q3',
    118:'a5q4',121:'a5q4',
    119:'a5q5',120:'a5q5',
    131:'a5q6',
  };
  // a2q2: 进入蝮蛇神殿(46)或任意古墓激活；进入都瑞尔巢穴(73)视为法杖已用，完成
  if ([46,65,66,67,68,69,70,71,72].includes(area.def.id) && start(player,'a2q2'))
    messages.push(QUESTS.find(q=>q.id==='a2q2')!.description);
  if (area.def.id === 73 && status(player,'a2q2') === 1) {
    player.quests[questKey(player,'a2q2')] = 3;
    messages.push('赫拉迪克的法杖任务完成，都瑞尔巢穴已进入。');
  }
  const quest=trigger[area.def.id];
  if (quest && start(player,quest)) messages.push(QUESTS.find(q=>q.id===quest)!.description);
  // a1q3: 进入崔斯特瑞姆(38)自动完成凯恩救援，状态推进到3（凯恩传送至营地）
  if (area.def.id === 38 && status(player,'a1q3') >= 1 && status(player,'a1q3') < 3) {
    player.quests[questKey(player,'a1q3')] = 3;
    messages.push('迪卡·凯恩已获救！他已传送回罗格营地，本难度可免费鉴定装备。');
  }
  // a3q3: 进入崔凡克(83)激活克林姆的意志任务
  if (area.def.id === 83 && start(player,'a3q3'))
    messages.push(QUESTS.find(q=>q.id==='a3q3')!.description);
  // Field waypoints are discovered by engine interaction only, never by entering.
  return messages;
}

export function onKill(player: Player, area: AreaState, monster: Monster): string[] {
  if (!area.monsters.includes(monster) || (!monster.dead && monster.life>0)) return [];
  const region = monster.regionId === undefined ? undefined : getSurfaceRegion(area,monster.regionId);
  if (region) area = {...area,def:region.def,spawn:region.spawn};
  monster.dead=true;monster.life=0;
  const messages: string[]=[];
  if (area.def.id===8 && status(player,'a1q1')<3) {
    start(player,'a1q1');
    let maps=pendingDens.get(player);
    if (!maps) {maps=new Map();pendingDens.set(player,maps);}
    maps.set(player.difficulty,area);
    const remaining=area.monsters.filter(m=>!m.dead).length;
    if (remaining===0 && status(player,'a1q1')!==2) {
      player.quests[questKey(player,'a1q1')]=2;
      messages.push('邪恶洞窟已清空！返回罗格营地，向阿卡拉领取奖励。');
    } else if (remaining>0) {
      if (status(player,'a1q1')===2) player.quests[questKey(player,'a1q1')]=1;
      if (remaining<=5) messages.push(`邪恶洞窟还剩 ${remaining} 个怪物（复活的怪物也必须消灭）。`);
    }
  }
  const complete = (id: string,message: string,state=2): void => {
    if (status(player,id)>=state) return;
    player.quests[questKey(player,id)]=state;messages.push(message);
  };
  if (area.def.id===17 && monster.code==='bloodraven') complete('a1q2','血鸟已被击败。返回营地向卡夏交付。');
  if (area.def.id===25 && monster.modifiers.includes('superunique:The Countess'))
    complete('a1q4','女伯爵已被击败；遗忘之塔完成。宝藏由掉落系统处理，没有技能点奖励。',3);
  if (area.def.id===37 && monster.code==='andariel') complete('a1q6','安达利尔已被击败！回罗格营地与瓦瑞夫交付后向东旅行。');
  // Act 2
  if (area.def.id===49 && monster.code==='radament') complete('a2q1','罗达门特已被击杀。从他身上取得技能之书，向亚特玛领取奖励。');
  if (area.def.id===73 && monster.code==='duriel') complete('a2q6','都瑞尔已被击杀！向鲁高因的泰瑞尔汇合，乘马席夫前往第三幕。');
  // Act 3
  if (area.def.id===102 && monster.code==='mephisto') {
    complete('a3q6','墨菲斯托已被击杀！拾取灵魂石，穿越红门前往第四幕。');
    player.unlockedActs=Math.max(4,player.unlockedActs);
  }
  // Act 4
  if (area.def.id===105 && monster.code==='izual') complete('a4q1','衣卒尔已被击杀。向泰瑞尔汇报。');
  if (area.def.id===107 && monster.modifiers.some(m=>m==='superunique:The Feature Creep')) {
    complete('a4q2','海法斯特已被击杀。奖励宝石与符文直接掉落。',2);
    if (status(player,'a4q2')<=2) {
      const diffIdx=['normal','nightmare','hell'].indexOf(player.difficulty);
      // 普通宝石 × 1、无瑕宝石 × 2、完美宝石 × 1
      for (const code of ['gcv','gfv','gfv','gpv']) area.drops.push({item:{uid:`${player.difficulty}:q4q2:${code}:${Date.now()}:${Math.random()}`,code,name:code,quality:'normal',identified:true,ilvl:1,mods:{},sockets:0,socketed:[],x:0,y:0},x:monster.x,y:monster.y});
      // 随机符文：普通 r01-r05 / 噩梦 r07-r13 / 地狱 r15-r24
      const [rMin,rMax]=[[1,5],[7,13],[15,24]][diffIdx];
      const rNum=rMin+Math.floor(Math.random()*(rMax-rMin+1));
      const rCode=`r${String(rNum).padStart(2,'0')}`;
      area.drops.push({item:{uid:`${player.difficulty}:a4q2:rune:${Date.now()}`,code:rCode,name:rCode,quality:'normal',identified:true,ilvl:1,mods:{},sockets:0,socketed:[],x:0,y:0},x:monster.x,y:monster.y});
    }
  }
  if (area.def.id===108 && monster.code==='diablo') complete('a4q3','迪亚波罗已被击杀！泰瑞尔将打开通往第五幕的通道。');
  // Act 5
  if (area.def.id===110 && monster.modifiers.includes('superunique:Shenk the Overseer'))
    complete('a5q1','督军山克已被击杀。向拉苏克领取镶孔奖励。');
  // a5q5: 击杀三先祖（area 120 的 ancientbarb1/2/3 boss）→ 完成试炼，解锁要塞
  if (area.def.id===120 && ['ancientbarb1','ancientbarb2','ancientbarb3'].includes(monster.code)) {
    const allDead = area.monsters.filter(m => ['ancientbarb1','ancientbarb2','ancientbarb3'].includes(m.code)).every(m => m.dead);
    if (allDead && status(player,'a5q5') < 2) {
      player.quests[questKey(player,'a5q5')] = 2;
      const expBonus = player.difficulty === 'normal' ? 20000 : player.difficulty === 'nightmare' ? 100000 : 500000;
      player.experience = (player.experience ?? 0) + expBonus;
      messages.push(`三位先祖已被击败！获得 ${expBonus.toLocaleString()} 经验。世界之石要塞已解锁。`);
    }
  }
  if (area.def.id===132 && monster.code==='baalcrab') complete('a5q6','巴尔已被击杀！游戏通关。',3);
  return messages;
}

export function talkNPC(player: Player, npcId: string): {message: string;services: string[]} {
  const npc=NPCS[npcId];
  if (!npc) return {message:'没有这个 NPC。',services:[]};
  if (npc.act>player.unlockedActs) return {message:'尚未解锁该幕。',services:[]};
  const services=[...npc.services],messages: string[]=[];
  if (npcId==='akara') {
    start(player,'a1q1');
    const den=pendingDens.get(player)?.get(player.difficulty);
    if (status(player,'a1q1')===2 && den?.monsters.some(m=>!m.dead)) {
      player.quests[questKey(player,'a1q1')]=1;
      messages.push('邪恶洞窟仍有活着或复活的怪物；必须全部消灭后才能领奖。');
    }
    if (status(player,'a1q1')===2) {
      player.quests[questKey(player,'a1q1')]=3;
      player.skillPoints++;
      player.quests[questKey(player,'respec')]=1;
      messages.push('感谢你净化邪恶洞窟。获得 1 技能点，并解锁本难度一次属性/技能重置。');
    }
    if (status(player,'respec')===1) services.push('respec');
  }
  if (npcId==='kashya') {
    start(player,'a1q2');
    if (status(player,'a1q2')===2) {
      player.quests[questKey(player,'a1q2')]=3;
      player.quests[questKey(player,'freeRogue')]=1;
      messages.push('血鸟已被消灭。免费罗格奖励与招聘权限已解锁，可雇佣火焰箭或冰霜箭罗格。');
    }
    if (status(player,'a1q2')===3) services.push('hire','resurrect');
  }
  if (npcId==='charsi') {
    if (status(player,'a1q5')===2) {
      player.quests[questKey(player,'a1q5')]=3;
      messages.push('感谢你取回赫拉迪克马勒斯！等级达到 8 时可来进行一次稀有装备注入。');
    }
  }
  if (npcId==='warriv') {
    if (status(player,'a1q6')===2) {
      player.quests[questKey(player,'a1q6')]=3;
      player.unlockedActs=Math.max(2,player.unlockedActs);
      messages.push('安达利尔任务已交付。向东旅行已开放：通过旅行/传送面板前往鲁高因。');
    }
    if (status(player,'a1q6')===3) services.push('travel');
  }
  if (npcId==='cain' && status(player,'a1q3')===3) {
    services.push('identify');messages.push('凯恩已获救，本难度可免费鉴定。');
  }
  // Act 2
  if (npcId==='atma') {
    if (status(player,'a2q1')===2) {
      player.quests[questKey(player,'a2q1')]=3;
      player.skillPoints++;
      messages.push('罗达门特任务已交付，获得 1 技能点。第二幕商店九折优惠已解锁。');
    }
  }
  if (npcId==='drognan') {
    if (status(player,'a2q3')===2) {
      player.quests[questKey(player,'a2q3')]=3;
      messages.push('堕落的太阳任务完成，遗失城市重见天日。');
    }
  }
  if (npcId==='jerhyn') {
    if (status(player,'a2q4')===2) {
      player.quests[questKey(player,'a2q4')]=3;
      messages.push('神秘避难所任务完成，王宫通道已开启。');
    }
  }
  if (npcId==='cain' && player.unlockedActs>=2 && status(player,'a2q5')===2) {
    player.quests[questKey(player,'a2q5')]=3;
    messages.push('召唤者已击败，古墓调查完成。');
  }
  if (npcId==='meshif') {
    if (status(player,'a2q6')===2) {
      player.quests[questKey(player,'a2q6')]=3;
      player.unlockedActs=Math.max(3,player.unlockedActs);
      messages.push('都瑞尔任务已交付。乘船前往第三幕库拉斯特已开放。');
    }
    if (status(player,'a2q6')===3) services.push('travel');
  }
  // Act 3
  if (npcId==='alkor') {
    if (status(player,'a3q1')===2) {
      player.quests[questKey(player,'a3q1')]=3;
      player.bonusLife+=20;
      messages.push('黄金鸟任务完成，永久 +20 生命。');
    }
  }
  if (npcId==='hratli') {
    if (status(player,'a3q2')===2) {
      player.quests[questKey(player,'a3q2')]=3;
      player.skillPoints++;
      messages.push('古代宗教之刃任务完成，获得 1 技能点。');
    }
  }
  if (npcId==='ormus') {
    if (status(player,'a3q4')===2) {
      player.quests[questKey(player,'a3q4')]=3;
      player.statPoints+=5;
      messages.push('蓝·依森的古书任务完成，获得 5 属性点。');
    }
  }
  if (npcId==='cain' && player.unlockedActs>=3 && status(player,'a3q5')===2) {
    player.quests[questKey(player,'a3q5')]=3;
    messages.push('黑化的神殿任务完成。');
  }
  // Act 4
  if (npcId==='tyrael') {
    if (status(player,'a4q1')===2) {
      player.quests[questKey(player,'a4q1')]=3;
      player.skillPoints+=2;
      messages.push('堕落天使任务完成，获得 2 技能点。');
    }
    if (status(player,'a4q3')===2) {
      player.quests[questKey(player,'a4q3')]=3;
      player.unlockedActs=Math.max(5,player.unlockedActs);
      messages.push('恐怖的结局任务完成！前往第五幕哈洛加斯已开放。');
    }
    if (status(player,'a4q3')===3) services.push('travel');
  }
  if (npcId==='halbu') {
    if (status(player,'a4q2')===2) {
      player.quests[questKey(player,'a4q2')]=3;
      messages.push('地狱熔炉任务完成。');
    }
  }
  // Act 5
  if (npcId==='larzuk') {
    if (status(player,'a5q1')===2) {
      player.quests[questKey(player,'a5q1')]=3;
      messages.push('哈洛加斯围城任务完成，本难度一次镶孔服务已解锁。');
    }
  }
  if (npcId==='qualkehk') {
    if (status(player,'a5q2')===2) {
      player.quests[questKey(player,'a5q2')]=3;
      // 拉尔(r19) + 欧特(r20) + 塔尔(r07) 直接给到背包
      for (const code of ['r19','r20','r07']) {
        const rune: import('./types').Item = {uid:`${player.difficulty}:a5q2:${code}:${Date.now()}:${Math.random()}`,code,name:code,quality:'normal',identified:true,ilvl:1,mods:{},sockets:0,socketed:[],x:0,y:0,width:1,height:1,ethereal:false,durability:0,maxDurability:0,minDamage:0,maxDamage:0,defense:0,requiredLevel:0,price:0,quantity:1};
        player.inventory.push(rune);
      }
      messages.push('高山上的救援任务完成，获得拉尔、欧特、塔尔符文，野蛮人招聘已解锁。');
    }
    if (status(player,'a5q2')===3) services.push('hire','resurrect');
  }
  if (npcId==='anya') {
    if (status(player,'a5q3')===0) {
      messages.push('安雅不见踪迹。');
    } else if (status(player,'a5q3')===1) {
      messages.push('安雅被冰封……去找马拉寻求解药。');
    } else if (status(player,'a5q3')===2) {
      player.quests[questKey(player,'a5q3')]=3;
      player.bonusResist+=10;
      messages.push('安雅已解冻！冰之囚任务完成，四系永久 +10 抗性。');
    } else {
      messages.push('安雅：感谢你的救援，冒险者。');
    }
    if (status(player,'a5q4')===2 && !player.quests[`${player.difficulty}:personalizeDone`]) {
      messages.push('安雅可为你的一件装备刻名（使用 personalize 指令选择物品）。');
      services.push('personalize');
    }
  }
  if (npcId==='malah') {
    if (status(player,'a5q3')===1) {
      player.quests[questKey(player,'a5q3')]=2;
      messages.push('马拉：用这瓶药水去解救安雅。解冻任务进行中。');
    } else if (status(player,'a5q3')>=3) {
      messages.push('马拉：感谢你救回了安雅。');
    }
  }
  if (npcId==='nihlathak') {
    if (status(player,'a5q4')===2) {
      player.quests[questKey(player,'a5q4')]=3;
      messages.push('尼拉塞克任务完成。');
    }
  }
  return {message:messages.length ? messages.join('\n') : npc.description,services:[...new Set(services)]};
}

const NIGHTMARE_POOLS: Record<number, string[]> = {"110":["minion1","deathmauler1","overseer1","imp1","sk_archer6","quillrat6","foulcrow5","vulture5","thornhulk5","slinger7"],"111":["imp3","siegebeast1","minion2","deathmauler2","sk_archer6","cr_archer6","cr_lancer6","slinger8","blunderbore5","overseer2"],"112":["deathmauler3","minion4","siegebeast3","overseer5","imp3","slinger9","skmage_ltng5","skmage_fire5","goatman7","fallenshaman6"],"113":["snowyeti1","frozenhorror1","succubus1","bloodlord3","sandraider7","sandleaper6","skmage_cold5","cr_archer7","wraith6","clawviper6"],"114":["snowyeti1","frozenhorror1","succubus6","reanimatedhorde1","succubuswitch6","willowisp5","skmage_cold5","cr_lancer7","wraith6","clawviper6"],"115":["snowyeti1","frozenhorror1","reanimatedhorde1","skeleton6","wraith7","batdemon6","skmage_cold5","bloodlord6","skeleton6","clawviper7"],"116":["snowyeti2","succubus6","frozenhorror2","bighead6","goatman7","cr_archer7","skmage_cold5","wraith6","bloodlord6","sandraider7"],"117":["siegebeast2","imp2","deathmauler4","minion5","succubus5","sk_archer7","vulture5","skmage_ltng5","goatman10","pantherwoman6"],"118":["frozenhorror2","snowyeti2","bloodlord7","fallenshaman6","quillrat7","cr_lancer7","skmage_cold5","cr_lancer7","reanimatedhorde2","bighead6"],"119":["snowyeti2","succubus4","bloodlord7","frozenhorror2","clawviper7","bonefetish5","willowisp5","batdemon6","wraith6","succubuswitch6"],"122":["reanimatedhorde3","bloodlord2","deathmauler5","skeleton7","sandleaper7","fallenshaman7","scarab6","fetish6","skmage_pois5","baboon7"],"123":["bloodlord2","sandraider7","baboon8","goatman9","quillrat8","unraveler6","fetishblow6","cantor5","vilemother4","sandmaggot6"],"124":["minion9","succubus4","putriddefiler2","reanimatedhorde3","wraith6","arach6","sk_archer9","fetishshaman6","baboon6","clawviper9"],"125":["bloodlord3","imp6","megademon4","succubus7","succubuswitch7","fallenshaman8","sk_archer10","bonefetish6","fingermage4","minion10"],"126":["bloodlord3","imp6","megademon4","succubus7","clawviper8","blunderbore6","unraveler7","skmage_fire6","goatman8","regurgitator4"],"127":["imp7","overseer4","megademon4","clawviper8","bloodlord2","succubuswitch5","vampire6","fetishblow7","reanimatedhorde6","dkmag1"],"128":["reanimatedhorde6","succubuswitch8","putriddefiler3","sandraider9","bloodlord5","cr_lancer8","vilemother5","cantor6","vampire7","fetishshaman8"],"129":["suicideminion6","minion11","fetish8","batdemon7","clawviper10","mummy6","skmage_pois6","unraveler8","scarab7","willowisp6"],"130":["bloodlord5","imp5","putriddefiler4","fingermage5","dkmag2","fetishblow8","skmage_ltng6","wraith8","succubus4","overseer4"],"131":["bloodlord5","succubuswitch5","bonefetish7","sandraider10","willowisp7","vampire8","megademon5","unraveler9","dkmag2","clawviper10"]};
