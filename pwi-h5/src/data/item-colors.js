export const ITEM_COLOR_PALETTE = Object.freeze({
  unknown: '#d8d8d8', white: '#ffffff', blue: '#879cff', purple: '#c779ff',
  gold: '#ffd34f', green: '#35ead0', orange: '#ff9455', red: '#ff6969',
});

const evidence = (color, source, image = null) => Object.freeze({ color, source, image, rgbBasis: '本作可读性配色；官方类别已核，客户端精确RGB未核' });
const highSources = {
  axe: 'https://w2i.games.wanmei.com/news/bulletin/20260522/88911.shtml',
  sword: 'https://w2i.wanmei.com/news/bulletin/20201116/83189.shtml',
  robe: 'https://w2i.wanmei.com/mobile/mobilenews/20180815/80718.shtml',
};
export const VERIFIED_ITEM_COLORS = Object.freeze({
  枯荣: evidence('red', highSources.axe),
  逝川归: evidence('red', highSources.axe),
  千古一色: evidence('red', highSources.axe),
  '沉天踏绛气·浩然': evidence('red', highSources.sword),
  '通天者法袍·正气': evidence('red', highSources.robe, 'http://w2i.wanmei.com/resources/jpg/180815/10021534300034392.jpg'),
  鼓力拳套: evidence('green', 'https://w2i.wanmei.com/hd/hhsd/zhuangbei/01.htm', '/official-library/assets/492625e4719091a194d7.gif'),
  鬼王的披风: evidence('gold', 'https://w2i.wanmei.com/hd/hhsd/zhuangbei/pic/image367.gif', '/official-library/assets/da49df8ce667be2a6697.gif'),
  飞龙翔击双虎掌: evidence('orange', 'https://w2i.wanmei.com/pic/news_img/091103/1103031.jpg', '/official-library/assets/096b190bd32f10aa7329.jpg'),
  燃淬: evidence('green', 'https://w2i.wanmei.com/hd/fuben/wuqi/fsimg/image047.gif', '/official-library/assets/5be52f381d05aad3b797.gif'),
  万佛斩: evidence('gold', 'https://w2i.wanmei.com/hd/fuben/wuqi/fsimg/image001.gif', '/official-library/assets/a30b8a2329a4f72ecf57.gif'),
  凤兮法冠: evidence('green', 'https://event51.wanmei.com/w2i/201002/w2isyg/iframe/conjjcz.htm', '/official-library/assets/84c0eb37cb13a2e05463.gif'),
  凤歌楚狂人: evidence('gold', 'https://w2i.wanmei.com/pic/news_img/091103/1103041.jpg', '/official-library/assets/1dee995ba545eadacc1c.jpg'),
  幻仙石: evidence('purple', 'https://w2i.wanmei.com/pic/news_img/jinglian/kingstone_clip_image004.jpg', '/official-library/assets/1b02f813b95b38caa356.jpg'),
  清寂露: evidence('purple', 'https://w2i.wanmei.com/resources/jpg/111205/10021323077477840.jpg', '/official-library/assets/25fc298ae40e0a358a6d.jpg'),
});

export const ITEM_COLOR_NOTE = '名称色独立于品阶、穿戴等级、星级、系列与阶段。只有已核游戏提示首行的具体物品使用对应色；未核物品用中性色，并不认定为官方白色。七色RGB为本作可读性配色，不宣称客户端精确值。';

export function itemColorEvidence(item) {
  const name = typeof item === 'string' ? item : item?.name || item?.equipment?.name || '';
  const key = name.trim().replace(/^★+/, '').replace(/\s*[（(]\d+孔[）)]$/, '');
  return VERIFIED_ITEM_COLORS[key] || null;
}

export function itemNameColor(item) {
  return itemColorEvidence(item)?.color || 'unknown';
}
