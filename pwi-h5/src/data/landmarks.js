// Original Q-style diorama art directions, NOT official map/architecture facts.
// IDs and display names match world.js, including its explicitly abstract nodes.
// Static visual data only: no gameplay state, random source, or network assets.
export const ZONE_LANDMARKS = {
  wanliu: {
    name: '剑仙城', motif: 'sword-monument', biome: 'steep-hills',
    description: '原创Q版意象：青灰峭岭托起巨剑碑，金边青瓦楼围绕石阶。',
    palette: { sky: 0xcbdde2, ground: 0x91ac85, stone: 0xaebfc0, foliage: 0x4f8873, wood: 0x926c50, roof: 0x427c88, trim: 0xf0ca83, water: 0x77b9c7 },
  },
  h_f1: {
    name: '鹏程客栈', motif: 'roadside-inn', biome: 'meadow',
    description: '原创Q版意象：弯路旁的双层客栈、暖灯与茶棚。',
    palette: { sky: 0xe4dfce, ground: 0xaac18b, stone: 0xd5c7a8, foliage: 0x6b9d65, wood: 0xa57651, roof: 0xb87659, trim: 0xffd58e, water: 0x83bcb2 },
  },
  h_f2: {
    name: '万木岭', motif: 'valley-cave', biome: 'wooded-valley',
    description: '原创Q版意象：圆冠古木夹着山谷，暖色洞口藏在层叠岩壁中。',
    palette: { sky: 0xc4d6c5, ground: 0x8faa76, stone: 0xa29c86, foliage: 0x4c8060, wood: 0x87674d, roof: 0x6f8066, trim: 0xe9b96a, water: 0x75a99c },
  },
  jiyu: {
    name: '积羽城', motif: 'ancient-tree', biome: 'canopy-city',
    description: '原创Q版意象：可居住的巨大古树、枝间悬阁与细桥。',
    palette: { sky: 0xd3e6d5, ground: 0x95b791, stone: 0xd9d9be, foliage: 0x559f7c, wood: 0x9d785a, roof: 0x619b9c, trim: 0xf3d8a0, water: 0x8bc7b7 },
  },
  e_f1: {
    name: '落缨村', motif: 'blossom-grove', biome: 'blossom-village',
    description: '原创Q版意象：粉白花冠环抱小村屋，花瓣铺成弯曲小径。',
    palette: { sky: 0xf0dfe3, ground: 0xb2c393, stone: 0xd8c8bd, foliage: 0xeeb3c7, wood: 0xa08066, roof: 0x8e8aab, trim: 0xffdeae, water: 0x93c4c1 },
  },
  e_f2: {
    name: '无忧河西岸', motif: 'river-bridge', biome: 'riverbank',
    description: '原创Q版意象：碧河从石拱桥下流过，岸边垂柳与渡亭。',
    palette: { sky: 0xd3e7e5, ground: 0xa0bb94, stone: 0xc6d1bd, foliage: 0x73a98a, wood: 0x9a7a5f, roof: 0x5c98a0, trim: 0xf1d6a1, water: 0x71bfc5 },
  },
  wanhua: {
    name: '万化城', motif: 'beast-stronghold', biome: 'rocky-uplands',
    description: '原创Q版意象：兽面图腾与圆石堡垒，宽厚城垛和铜色门环。',
    palette: { sky: 0xe1d4bd, ground: 0xb5ad83, stone: 0xb9a38a, foliage: 0x738864, wood: 0x8b6049, roof: 0x955d4d, trim: 0xf1bf76, water: 0x8bada3 },
  },
  u_f1: {
    name: '北关营地', motif: 'banner-camp', biome: 'upland-camp',
    description: '原创Q版意象：三角帐篷、兽纹旗杆与木栅营门。',
    palette: { sky: 0xdddfca, ground: 0xb1b181, stone: 0xb4b39b, foliage: 0x788d5d, wood: 0x92704e, roof: 0xbf8863, trim: 0xf1cb86, water: 0x8cafa5 },
  },
  u_f2: {
    name: '盘丝岭', motif: 'webbed-rocks', biome: 'shadow-ridge',
    description: '原创Q版意象：紫灰岩柱间的银白蛛网与低矮蕨丛。',
    palette: { sky: 0xd5ccdf, ground: 0x9b9b89, stone: 0xa89bb4, foliage: 0x6b887b, wood: 0x7e665f, roof: 0x7e708e, trim: 0xeee0bd, water: 0x8babb5 },
  },
  xidao: {
    name: '惊涛城', motif: 'shell-tide-gate', biome: 'coral-coast',
    description: '原创Q版意象：扇贝潮门、珊瑚尖塔与浅碧水阶。',
    palette: { sky: 0xc9e6e9, ground: 0xe2d4b3, stone: 0xf0d6c8, foliage: 0x75b5a0, wood: 0xa78668, roof: 0x67aeba, trim: 0xffdab1, water: 0x64c2cb },
  },
  t_f1: {
    name: '龙牙村', motif: 'coastal-cottages', biome: 'coastal-village',
    description: '原创Q版意象：贝饰海边小屋、晒网木架与浅滩小舟。',
    palette: { sky: 0xd8e9e5, ground: 0xe8d7ac, stone: 0xdad5c3, foliage: 0x81b296, wood: 0xae8962, roof: 0x719fae, trim: 0xffdb9e, water: 0x80cbd1 },
  },
  t_f2: {
    name: '龙牙村海岸（外围抽象）', motif: 'reef-beacon', biome: 'rocky-coast',
    description: '原创Q版外围意象：牙形礁岩、航标与潮池，不表示独立原版地点。',
    palette: { sky: 0xc8e0e6, ground: 0xd9ccb0, stone: 0xb4c2c7, foliage: 0x719c87, wood: 0x9f7d5d, roof: 0x5b91a4, trim: 0xf9d498, water: 0x5eafc3 },
  },
  lingyuan: {
    name: '灵犀城', motif: 'lotus-crystal-shrine', biome: 'floating-garden',
    description: '原创Q版意象：浮莲托起晶石神龛，玉色阶台与小型悬石。',
    palette: { sky: 0xdbdff0, ground: 0xa4c5ab, stone: 0xdce6d2, foliage: 0x78ac95, wood: 0x968378, roof: 0x8f94c2, trim: 0xf7dda9, water: 0x9bc9d5 },
  },
  g_f1: {
    name: '星栖苑', motif: 'lotus-mushrooms', biome: 'enchanted-garden',
    description: '原创Q版意象：莲花浅池、星纹圆蘑菇与小石灯。',
    palette: { sky: 0xe1e4f2, ground: 0xa7c7a5, stone: 0xd8decc, foliage: 0x88b79f, wood: 0x9c8475, roof: 0xb49ac9, trim: 0xffe2b6, water: 0x94cdd1 },
  },
  g_f2: {
    name: '灵犀城郊（外围抽象）', motif: 'crystal-terraces', biome: 'spirit-foothills',
    description: '原创Q版外围意象：晶簇台地与藤绕石环，不表示独立原版地点。',
    palette: { sky: 0xd5dfeb, ground: 0x9dbba9, stone: 0xc3d7d0, foliage: 0x69998d, wood: 0x8e7b66, roof: 0x829bb7, trim: 0xeee0b3, water: 0x88bfc9 },
  },
  zulong: {
    name: '祖龙城', motif: 'twin-dragon-arch', biome: 'river-city',
    description: '原创Q版意象：双龙盘绕石拱门，河道与城楼构成大陆枢纽的缩景。',
    palette: { sky: 0xdce4df, ground: 0xb0bea0, stone: 0xd4d2bd, foliage: 0x6d9e85, wood: 0x9c6b54, roof: 0x549295, trim: 0xf4c879, water: 0x82bbc7 },
  },
  f_kuangkeng: {
    name: '祭旗坡', motif: 'flags-barrows', biome: 'memorial-hill',
    description: '原创Q版意象：低丘墓冢与层层纪念旗，石碑连接地宫石阶。',
    palette: { sky: 0xe0d9d0, ground: 0xb4ae90, stone: 0xb9b4a7, foliage: 0x849376, wood: 0x957258, roof: 0xa6655d, trim: 0xf0cf99, water: 0x9aafb3 },
  },
  taoyuan: {
    name: '落日镇', motif: 'sunset-bell-town', biome: 'sunset-town',
    description: '原创Q版意象：夕照钟楼与朱瓦街屋，旁侧幽暗小门呼应历练入口。',
    palette: { sky: 0xf2d5bc, ground: 0xbcb18d, stone: 0xd4bfa5, foliage: 0x91a076, wood: 0xa47354, roof: 0xbc795d, trim: 0xffd89b, water: 0xa2b8be },
  },
  f_taoyuan: {
    name: '英雄冢地宫', motif: 'underground-tomb', biome: 'underground',
    description: '原创Q版剖面意象：拱形地宫、石棺与两侧灯龛，不画作桃林。',
    palette: { sky: 0xaaaabb, ground: 0x9b9d9c, stone: 0xb4b5b8, foliage: 0x78877f, wood: 0x857365, roof: 0x777a91, trim: 0xf3c785, water: 0x8299ad },
  },
  jifeng: {
    name: '飞来镇', motif: 'cliff-teahouse', biome: 'cliff-town',
    description: '原创Q版意象：叠岩台上的茶楼、铜钟与翼形飞檐。',
    palette: { sky: 0xe3d9c8, ground: 0xb3b18c, stone: 0xc3b59c, foliage: 0x8a9c78, wood: 0xa17b58, roof: 0x817b87, trim: 0xf2ce8c, water: 0x97b8b8 },
  },
  f_jifeng: {
    name: '乘风原', motif: 'windmill-plains', biome: 'windswept-plains',
    description: '原创Q版意象：大风车、倾斜草束与缓起伏的开阔草原。',
    palette: { sky: 0xe0ebdf, ground: 0xc1c58e, stone: 0xd2ccb0, foliage: 0x93aa68, wood: 0xab8662, roof: 0xa88b6c, trim: 0xffe2ad, water: 0x99c3bf },
  },
  f_fengsha: {
    name: '破浪营地', motif: 'beach-fort', biome: 'beach',
    description: '原创Q版意象：海浪旁的木石小堡、蓝旗与海防栅栏，不以沙漠怪物推断地貌。',
    palette: { sky: 0xcfe4eb, ground: 0xe1d4b2, stone: 0xc4c5b6, foliage: 0x8ba68a, wood: 0x9f7d5c, roof: 0x5e96a9, trim: 0xf7d49b, water: 0x79bdcf },
  },
  f_bingfeng: {
    name: '云梦岭', motif: 'mist-mountains', biome: 'misty-mountains',
    description: '原创Q版意象：青绿叠峰、云带与悬崖小亭，不以冰雪怪物推断地貌。',
    palette: { sky: 0xd7e3e6, ground: 0x9ab69e, stone: 0x9cb6b3, foliage: 0x6b9a89, wood: 0x9c8370, roof: 0x6b8c9d, trim: 0xe9d6ae, water: 0x93bfc8 },
  },
  f_shangqi: {
    name: '怨灵沼泽', motif: 'ruined-swamp-gate', biome: 'dead-tree-swamp',
    description: '原创Q版意象：枯树浅沼与残破拱门，苔石和淡紫雾带。',
    palette: { sky: 0xc5cad7, ground: 0x929d8d, stone: 0xa5aaa8, foliage: 0x718a76, wood: 0x817a6a, roof: 0x7e8098, trim: 0xd8c99c, water: 0x789b9c },
  },
  wanjie: {
    name: '寻梦港', motif: 'harbor-lighthouse', biome: 'harbor',
    description: '原创Q版意象：长木栈桥、双帆小舟与暖灯灯塔。',
    palette: { sky: 0xdde9e8, ground: 0xdacfb4, stone: 0xd4d7c9, foliage: 0x83ad91, wood: 0xad835f, roof: 0x6b99a5, trim: 0xffda98, water: 0x80bfcd },
  },
  f_wanjie: {
    name: '夜哭岛', motif: 'shipwreck-tomb', biome: 'haunted-island',
    description: '原创Q版意象：歪斜船骸与岛上墓门，冷色礁岩点着温暖魂灯。',
    palette: { sky: 0xbcc9db, ground: 0xaaa997, stone: 0xa5b0bd, foliage: 0x788f88, wood: 0x8e7666, roof: 0x737e9b, trim: 0xefc998, water: 0x759fb8 },
  },
  f_tongtian: {
    name: '秘宝窟', motif: 'treasure-cavern', biome: 'underground',
    description: '原创Q版剖面意象：紫晶洞壁、宝箱与金币石台，不画作湖泊。',
    palette: { sky: 0xbfb3cf, ground: 0xa79cae, stone: 0xbab0cb, foliage: 0x839a91, wood: 0x94735b, roof: 0x9c86b5, trim: 0xffd478, water: 0x97adcb },
  },
  f_shedao: {
    name: '蛇岛', motif: 'serpent-ruin', biome: 'jungle-island',
    description: '原创Q版意象：盘蛇石柱与缺口遗迹，藤叶包围海岛台地。',
    palette: { sky: 0xd2ded3, ground: 0xa2ad80, stone: 0xb3bea0, foliage: 0x648d69, wood: 0x927455, roof: 0x7f9a7e, trim: 0xe9d293, water: 0x80b3ae },
  },
  f_longgong: {
    name: '龙宫', motif: 'coral-palace', biome: 'underwater',
    description: '原创Q版意象：水下珊瑚宫殿、珍珠拱门与静止气泡。',
    palette: { sky: 0x99c9db, ground: 0xbbd6d2, stone: 0xd9e7df, foliage: 0xd7a6b5, wood: 0x8da7a7, roof: 0x7dacc9, trim: 0xffe2b7, water: 0x72b8cc },
  },
  f_xianmo: {
    name: '仙魔之界（本作集合）', motif: 'yin-yang-shrines', biome: 'floating-realms',
    description: '原创Q版集合意象：明暗双悬台、对向神龛与阴阳石环，不表示原版两界相邻。',
    palette: { sky: 0xd7cee7, ground: 0xbdb5ce, stone: 0xe3dfef, foliage: 0xa1a7c0, wood: 0x9a8295, roof: 0x8b82b4, trim: 0xffdda7, water: 0xa4b3d3 },
  },
};
