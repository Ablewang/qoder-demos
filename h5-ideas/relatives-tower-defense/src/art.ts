import type { Card, Relative } from './content';

export const ink = '#352b25';
export const paper = '#fff5df';
export const red = '#b94c38';
export const gold = '#d4a854';
export const green = '#75836c';
const skin = '#edc9a1';
const neck = '#e5ba91';
const mouthInk = '#8b3a2c';

export type Seated = Exclude<Relative, 'table'>;
export type Gesture = 'hold' | 'ask' | 'reply' | 'cheer' | 'cross';
export type Gaze = 'you' | 'in' | 'down';
export type Face = 'ask' | 'smile' | 'flat' | 'huff' | 'happy';
export interface Pose { gesture: Gesture; gaze: Gaze; face: Face }
export interface Part { d: string; fill?: string; stroke?: string; w?: number; o?: number }
export interface Layer { parts: Part[]; rotate?: [number, number, number] }
export interface Art { width: number; height: number; layers: Layer[] }

const E = (cx: number, cy: number, rx: number, ry: number) => `M${cx - rx} ${cy}A${rx} ${ry} 0 1 0 ${cx + rx} ${cy}A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}Z`;
const dot = (x: number, y: number) => `M${x - 1} ${y}H${x + 1}`;

type Hair = 'bun' | 'long' | 'short' | 'bald' | 'perm' | 'bob' | 'pony' | 'curly';
const looks: Record<Seated, { coat: string; hair: Hair; hairColor: string; glasses?: boolean; earrings?: boolean; scarf?: boolean }> = {
  nainai: { coat: green, hair: 'bun', hairColor: '#b9b1a0' },
  dayi: { coat: red, hair: 'long', hairColor: ink },
  sangu: { coat: '#8b5a5a', hair: 'perm', hairColor: '#4a3a30', earrings: true },
  erjiu: { coat: '#4f5963', hair: 'short', hairColor: ink, glasses: true },
  gufu: { coat: '#7a5a44', hair: 'bald', hairColor: '#8a8076', glasses: true },
  ershen: { coat: '#a7735a', hair: 'bob', hairColor: ink, earrings: true },
  biaojie: { coat: '#c98f3d', hair: 'pony', hairColor: ink },
  wangayi: { coat: '#d9c7a5', hair: 'curly', hairColor: '#6b5a4e', scarf: true },
};

const hairBack: Record<Hair, string[]> = {
  bun: ['M68 24Q63 10 79 9Q97 8 95 23', 'M57 62Q45 48 54 30Q66 13 90 21Q110 18 119 37L117 62'],
  long: ['M57 67Q44 49 51 27Q55 12 77 17Q103 8 118 28L124 66L108 77H65Z'],
  short: ['M55 46Q51 24 68 16Q88 8 108 15Q123 23 118 46Z'],
  bald: ['M55 54Q50 36 58 28L66 34Q60 41 61 54Z', 'M118 54Q123 36 115 28L107 34Q113 41 112 54Z'],
  perm: ['M53 64Q41 58 46 46Q39 35 49 27Q49 15 62 15Q69 6 81 11Q92 4 102 11Q116 9 119 22Q130 29 124 42Q131 55 119 64Z'],
  bob: ['M51 70Q44 44 54 27Q68 13 88 14Q111 13 121 29Q129 46 122 70L110 72Q112 60 112 50H62Q61 62 64 72Z'],
  pony: ['M108 22Q132 14 140 34Q144 52 132 66Q134 48 118 36Z', 'M54 54Q50 27 70 18Q92 10 110 20Q123 30 118 54Z'],
  curly: ['M54 50Q46 36 55 26Q62 14 79 16Q91 8 104 14Q119 15 121 29Q128 40 119 52Z'],
};
const hairFront: Record<Hair, string> = {
  bun: 'M57 42Q62 25 81 25L71 40M82 25Q98 22 115 40',
  long: 'M56 39Q60 20 83 22Q80 33 63 38M84 22Q105 19 116 39L103 32L99 28',
  short: 'M56 44Q57 27 74 26Q88 19 104 25Q116 28 117 44L110 33Q90 33 76 30Q64 34 56 44Z',
  bald: 'M64 30Q86 21 108 30',
  perm: 'M56 41Q58 29 70 30Q76 21 88 26Q98 20 106 28Q115 29 117 40Q105 35 96 37Q86 32 77 37Q66 34 56 41Z',
  bob: 'M56 43Q58 24 86 22Q111 21 117 43Q104 31 86 31Q69 31 56 43Z',
  pony: 'M56 44Q60 23 88 22Q109 22 116 39Q98 30 82 33Q66 37 56 44Z',
  curly: 'M56 42Q58 31 68 31Q73 23 84 27Q93 21 101 28Q112 27 116 40Q106 35 98 36Q88 32 79 36Q66 34 56 42Z',
};

const coatArms: Record<Gesture, string[]> = {
  hold: ['M51 111L39 131Q37 139 48 141L79 139L81 127L57 126L62 113', 'M134 107L143 126L110 132L112 144L150 139Q160 136 153 124L146 106'],
  ask: ['M55 110L43 133Q43 138 50 140L76 143L81 130L60 126L65 113', 'M135 103L142 121L161 106L169 117L144 140Q137 144 131 137L122 117'],
  reply: ['M55 109L45 133L72 142L79 132L61 122L65 114', 'M132 103L145 117L157 106L148 98L139 107'],
  cheer: ['M55 109L45 133L72 142L79 132L61 122L65 114', 'M132 103L145 117L157 106L148 98L139 107'],
  cross: ['M50 112L44 128Q44 140 58 140L134 134Q146 132 144 120L137 104L128 121L72 126L63 113Z'],
};
const hands: Record<Gesture, string[]> = {
  hold: ['M73 127L88 130L91 140L77 141', 'M111 133L98 134L99 146L114 143'],
  ask: ['M157 109L160 100L169 98L174 107L168 117Z', 'M75 130L86 132L91 140L84 147L76 143'],
  reply: ['M147 99L147 89L152 91L155 80Q159 76 161 82L160 97Q167 90 170 95L164 105L156 110Z', 'M75 131L85 135L84 146L70 141'],
  cheer: ['M147 99L146 86Q152 80 160 84L161 97L156 110Z', 'M75 131L85 135L84 146L70 141'],
  cross: ['M62 124Q55 128 59 135L70 133Z', 'M132 119Q141 117 141 126L130 128Z'],
};

export function person(who: Seated, pose: Pose): Art {
  const look = looks[who];
  const grandma = who === 'nainai';
  const gesture = grandma && pose.gesture === 'ask' ? 'hold' : pose.gesture;
  const body: Part[] = [
    { d: 'M38 166L34 88Q34 72 49 72H132Q146 73 146 90L142 166', fill: gold },
    { d: 'M44 97H137M43 107H138M48 156V122M131 156V123' },
    { d: 'M81 77L79 88L94 99L108 84L103 74', fill: neck },
    { d: 'M50 111Q51 88 78 84L94 96L109 84Q132 88 140 109L145 152L45 153Z', fill: look.coat },
    { d: 'M79 86L74 100L90 96M108 86L113 98L97 97M94 100V146' },
  ];
  if (look.scarf) body.push({ d: 'M76 84Q94 96 112 84L115 94Q94 106 73 94Z', fill: red }, { d: 'M100 98L106 116L98 118L94 100Z', fill: red });

  const dx = pose.gaze === 'in' ? 3 : 0;
  const dy = pose.gaze === 'down' ? 3 : pose.gaze === 'you' ? 1 : 0;
  const closed = pose.face === 'happy' || (grandma && pose.face === 'smile');
  const head: Part[] = [
    ...hairBack[look.hair].map(d => ({ d, fill: look.hairColor })),
    { d: 'M57 44Q50 40 48 48Q47 56 57 58M116 44Q124 40 124 49Q125 57 116 58', fill: skin },
    { d: 'M57 39Q62 22 83 23Q105 23 115 39L116 58Q113 77 92 82Q70 80 59 66Z', fill: skin },
    look.hair === 'bald' ? { d: hairFront.bald, w: 2.5 } : { d: hairFront[look.hair], fill: look.hairColor },
    { d: pose.face === 'huff' ? 'M67 40L77 44M99 44L109 40' : pose.face === 'ask' ? 'M68 44L77 40M99 41L109 43' : 'M67 42Q72 39 77 41M99 41Q104 39 109 42' },
    closed ? { d: 'M66 50Q71 46 76 50M98 49Q103 45 108 49' } : { d: `${dot(72 + dx, 50 + dy)}${dot(104 + dx, 49 + dy)}`, w: 4.5 },
    { d: 'M86 49L83 56L90 57' },
    pose.face === 'ask' ? { d: 'M85 63Q92 61 99 63Q98 71 92 71Q86 71 85 63Z', fill: mouthInk }
      : pose.face === 'happy' ? { d: 'M79 62Q90 64 103 61Q99 73 90 73Q81 72 79 62Z', fill: mouthInk }
      : pose.face === 'huff' ? { d: 'M83 68Q90 64 98 68' }
      : pose.face === 'flat' ? { d: 'M83 66Q90 67 98 65' }
      : { d: 'M78 64Q89 70 102 61' },
    { d: 'M66 60H70M105 59H109', stroke: red },
  ];
  if (grandma) head.push({ d: 'M63 60L69 62M106 63L111 60' });
  if (look.glasses) head.push({ d: `${E(72, 50, 8, 7)}${E(104, 49, 8, 7)}M80 49Q88 46 96 48M64 48L57 45M112 47L116 44`, w: 2.4 });
  if (look.earrings) head.push({ d: `${dot(52, 62)}${dot(121, 62)}`, stroke: red, w: 5 });

  const arms: Part[] = [...coatArms[gesture].map(d => ({ d, fill: look.coat })), ...hands[gesture].map(d => ({ d, fill: skin }))];
  if (gesture === 'cross') arms.push({ d: 'M72 126Q102 140 130 121' });
  if (gesture === 'ask') arms.push({ d: 'M162 104L174 75M166 106L179 79', w: 2.5 });
  if (gesture === 'cheer') arms.push({ d: 'M146 64H166L163 82Q156 87 149 82Z', fill: paper }, { d: E(156, 64, 10, 3.5), fill: paper }, { d: 'M170 58L176 51M172 69L179 68', stroke: red, w: 2.5 });
  if (gesture === 'hold' && grandma) arms.push(
    { d: 'M78 123Q94 128 112 123L107 147Q94 155 83 147Z', fill: paper }, { d: E(95, 123, 19, 7), fill: paper },
    { d: 'M86 124H103M88 138H102', stroke: red }, { d: 'M91 110Q85 103 91 97M103 108Q109 100 103 94', w: 2 },
  );
  else if (gesture === 'hold') arms.push({ d: 'M84 124H106L103 146Q95 151 87 146Z', fill: paper }, { d: E(95, 124, 11, 4), fill: paper }, { d: 'M88 133H102', stroke: green });
  arms.push({ d: 'M54 150H80M109 150H137' });

  const tilt = pose.gaze === 'in' ? 4 : pose.gaze === 'down' ? -2 : 0;
  return { width: 180, height: 170, layers: [{ parts: body }, { parts: head, rotate: [tilt, 92, 84] }, { parts: arms }] };
}

export function table(ending = false): Art {
  const parts: Part[] = [
    { d: 'M33 166L28 224M362 166L368 224', w: 7 },
    { d: E(200, 128, 216, 105), fill: gold },
    { d: E(200, 118, 214, 99), fill: red },
    { d: 'M-7 127Q194 207 407 123', o: 0.3 },
    { d: E(198, 64, 51, 24), fill: paper },
    ...(ending ? [{ d: 'M173 64L181 66M205 60L211 58M221 68L226 70' }] : [
      { d: 'M169 65L157 52L157 75Z', fill: green }, { d: 'M168 64Q194 40 229 59Q240 69 221 75Q187 84 168 64Z', fill: green },
      { d: E(224, 62, 2, 2), fill: ink }, { d: 'M201 52L207 69M178 64L191 60' },
    ]),
    { d: E(91, 111, 32, 21), fill: paper },
    ending ? { d: 'M78 110L86 114M105 106L111 105' } : { d: 'M73 112Q69 88 83 91L91 105Q103 83 111 98L101 115Z', fill: green },
    { d: E(309, 112, 33, 20), fill: paper },
    ending ? { d: 'M301 114L309 116M322 107L326 110' } : { d: 'M290 104L299 96L309 102L306 115L294 116ZM311 113L322 101L333 110L327 124L315 124Z', fill: gold },
    { d: 'M77 66L95 84M83 62L101 80M311 82L330 62M316 87L337 67' },
    { d: 'M117 140L145 161M120 134L149 154M254 155L279 135M259 161L286 140' },
    { d: 'M111 58Q113 78 133 78Q152 78 154 58', fill: paper }, { d: E(132, 58, 22, 8), fill: paper },
    { d: 'M247 58Q249 78 269 78Q288 78 290 58', fill: paper }, { d: E(269, 58, 22, 8), fill: paper },
    { d: 'M168 175Q173 215 201 216Q230 215 235 175', fill: paper }, { d: E(201, 174, 35, 12), fill: paper },
    ending ? { d: 'M181 175L193 178M211 171L219 173' } : { d: 'M176 171Q184 161 193 169Q201 156 209 169Q220 161 227 174', fill: paper },
    { d: 'M180 199Q200 208 222 196', stroke: red },
    { d: 'M157 221L183 229M214 230L242 220' },
  ];
  return { width: 400, height: 245, layers: [{ parts }] };
}

export function emptySeat(): Art {
  return { width: 180, height: 100, layers: [{ parts: [
    { d: 'M25 93L24 34Q25 14 44 13H133Q153 14 154 34V94', fill: gold },
    { d: 'M38 37H142M38 49H142M42 89V63M139 89V63' },
    { d: 'M35 87Q85 69 145 87', fill: paper },
  ] }] };
}

export function openingSign(): Art {
  return { width: 176, height: 84, layers: [{ parts: [
    { d: 'M14 14L66 11M7 32L74 29M30 13L29 47Q28 63 14 74M56 12L59 73M99 11L134 8M104 11L97 33L94 70M102 23L161 20M114 31L151 28M116 27L119 44L147 40L146 26M102 48L161 44M118 48L118 63L110 64M143 46L143 62L153 60M131 40L132 74', w: 6 },
    { d: 'M161 67L169 62', stroke: red, w: 8 },
  ] }] };
}

const iconPaths: Record<Card, string> = {
  taiji: 'M9 24Q3 13 15 9Q26 5 30 15Q33 24 23 28M22 10L16 16L24 18M23 28L25 34L32 29',
  counter: 'M7 14L31 10M8 24L32 20M12 5L19 32M27 28L32 32',
  crazy: 'M7 8L17 11L24 4L25 14L34 17L27 23L29 32L18 28L10 34L11 23L3 19L10 16Z',
  sincere: 'M5 20Q9 31 20 31Q31 30 34 20M4 19Q19 24 35 19M13 13Q8 7 13 3M25 13Q30 7 25 3',
};
export function cardIcon(card: Card): Art {
  return { width: 40, height: 40, layers: [{ parts: [{ d: iconPaths[card], w: 2.7 }] }] };
}

function partSvg(part: Part): string {
  return `<path d="${part.d}"${part.fill ? ` fill="${part.fill}"` : ''}${part.stroke ? ` stroke="${part.stroke}"` : ''}${part.w ? ` stroke-width="${part.w}"` : ''}${part.o !== undefined ? ` opacity="${part.o}"` : ''}/>`;
}
export function svg(art: Art, mirror = false): string {
  const body = art.layers.map(layer => {
    const inner = layer.parts.map(partSvg).join('');
    return layer.rotate && layer.rotate[0] ? `<g transform="rotate(${layer.rotate.join(' ')})">${inner}</g>` : inner;
  }).join('');
  return `<svg viewBox="0 0 ${art.width} ${art.height}" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${mirror ? `<g transform="matrix(-1 0 0 1 ${art.width} 0)">${body}</g>` : body}</svg>`;
}

export function paint(ctx: CanvasRenderingContext2D, art: Art, x: number, y: number, width: number, mirror = false): void {
  const scale = width / art.width;
  ctx.save();
  ctx.translate(x + (mirror ? width : 0), y);
  ctx.scale(mirror ? -scale : scale, scale);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const layer of art.layers) {
    ctx.save();
    if (layer.rotate && layer.rotate[0]) {
      const [deg, cx, cy] = layer.rotate;
      ctx.translate(cx, cy); ctx.rotate(deg * Math.PI / 180); ctx.translate(-cx, -cy);
    }
    for (const part of layer.parts) {
      const path = new Path2D(part.d);
      ctx.globalAlpha = part.o ?? 1;
      if (part.fill) { ctx.fillStyle = part.fill; ctx.fill(path); }
      ctx.strokeStyle = part.stroke ?? ink;
      ctx.lineWidth = part.w ?? 3;
      ctx.stroke(path);
    }
    ctx.restore();
  }
  ctx.restore();
}

export function speechOutline(tail = 76, down = false): string {
  const d = down
    ? `M15 6L135 7Q147 7 146 19L145 86Q145 98 132 97L${tail + 7} 97L${tail} 108L${tail - 8} 97L16 96Q4 96 5 84L4 20Q3 6 15 6Z`
    : `M15 14L${tail - 8} 13L${tail} 2L${tail + 7} 13L135 15Q147 15 146 27L145 94Q145 106 132 105L16 104Q4 104 5 92L4 28Q3 14 15 14Z`;
  return `<svg class="speech-outline" viewBox="0 0 150 110" preserveAspectRatio="none" aria-hidden="true"><path d="${d}" vector-effect="non-scaling-stroke"/></svg>`;
}

export function toolIcon(type: 'mute' | 'sound' | 'pause'): string {
  const d = type === 'pause' ? 'M8 5V19M16 5V19' : type === 'mute' ? 'M4 9H8L13 5V19L8 15H4ZM17 9L22 15M22 9L17 15' : 'M4 9H8L13 5V19L8 15H4ZM17 9Q20 12 17 15M19 6Q25 12 19 18';
  return `<svg viewBox="0 0 24 24" fill="none" stroke="${ink}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
}
