const serif = '"Songti SC","STSong","Noto Serif CJK SC",serif';
const sans = '"PingFang SC","Microsoft YaHei",sans-serif';
const ink = '#233c3c';
const muted = '#53635e';
const green = '#285d54';
function text(context, value, x, y, size, weight = 400, family = sans) {
  context.font = `${weight} ${size}px ${family}`;
  context.fillText(value, x, y);
}
function wrap(context, value, x, y, width, size, leading, color = muted) {
  context.font = `400 ${size}px ${sans}`;
  context.fillStyle = color;
  let line = '';
  for (const character of value) {
    if (context.measureText(line + character).width > width) {
      if (/[，。；：！？）]/.test(character)) {
        const tail = line.slice(-1);
        context.fillText(line.slice(0, -1), x, y);
        line = tail + character;
      } else {
        context.fillText(line, x, y);
        line = character;
      }
      y += leading;
    } else line += character;
  }
  if (line) context.fillText(line, x, y);
  return y + leading;
}
function drawThanks(canvas, height) {
  canvas.width = 1080;
  canvas.height = height;
  const context = canvas.getContext('2d');
  context.fillStyle = '#fafbf8';
  context.fillRect(0, 0, 1080, height);
  context.textBaseline = 'top';
  const start = height === 720 ? 112 : 420;
  context.fillStyle = ink;
  text(context, '奶奶，谢谢惦记', 72, start, 92, 400, serif);
  text(context, '我都记着呢', 72, start + 124, 92, 400, serif);
  text(context, '会照顾好自己', 72, start + 248, 92, 400, serif);
  context.fillStyle = muted;
  text(context, '静态评审样卡 · 虚构称呼', 72, height - 174, 56);
  text(context, '本地内测，非医疗建议', 72, height - 108, 56);
  return canvas;
}
export function drawNote(canvas, saying, thanks = false) {
  if (thanks) return drawThanks(canvas, 1440);
  canvas.width = 1080;
  canvas.height = 1440;
  const context = canvas.getContext('2d');
  context.fillStyle = '#fafbf8';
  context.fillRect(0, 0, 1080, 1440);
  context.textBaseline = 'top';
  const lines = saying.bigCard.lines.map((line) => line.replaceAll('{称呼}', '奶奶'));
  context.fillStyle = green;
  text(context, lines[0], 72, 62, 60, 400, serif);
  context.fillStyle = ink;
  text(context, lines[1], 72, 182, 96, 400, serif);
  text(context, lines[2], 72, 300, 68);
  text(context, lines[3], 72, 454, 68);
  context.fillStyle = green;
  text(context, '适用范围', 72, 574, 56);
  wrap(context, saying.scopeNote, 72, 650, 936, 60, 82, ink);
  context.fillStyle = muted;
  text(context, lines[4], 72, 1035, 56);
  wrap(context, `出处：${saying.bigCard.sourceLine}`, 72, 1130, 936, 56, 74, ink);
  context.fillStyle = muted;
  text(context, '静态评审样卡 · 虚构称呼', 72, 1292, 56);
  text(context, '本地内测，非医疗建议', 72, 1365, 56);
  return canvas;
}
export function drawShortThanksNote(canvas) {
  return drawThanks(canvas, 720);
}
