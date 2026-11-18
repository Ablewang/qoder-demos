const ink = '#352b25';
const paper = '#fff5df';
const red = '#b94c38';
const gold = '#d4a854';

export function person(who, gesture = 'talk') {
  const grandma = who === 'nainai';
  const hair = grandma ? '#b9b1a0' : '#352b25';
  const coat = grandma ? '#75836c' : red;
  return `<svg viewBox="0 0 180 170" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M38 166L34 88Q34 72 49 72H132Q146 73 146 90L142 166" fill="${gold}"/>
    <path d="M44 97H137M43 107H138M48 156V122M131 156V123"/>
    ${grandma ? `<path d="M68 24Q63 10 79 9Q97 8 95 23" fill="${hair}"/><path d="M57 62Q45 48 54 30Q66 13 90 21Q110 18 119 37L117 62" fill="${hair}"/>` : `<path d="M57 67Q44 49 51 27Q55 12 77 17Q103 8 118 28L124 66L108 77H65Z" fill="${hair}"/>`}
    <path d="M81 77L79 88L94 99L108 84L103 74" fill="#e5ba91"/>
    <path d="M50 111Q51 88 78 84L94 96L109 84Q132 88 140 109L145 152L45 153Z" fill="${coat}"/>
    <path d="M79 86L74 100L90 96M108 86L113 98L97 97M94 100V146"/>
    <path d="M57 44Q50 40 48 48Q47 56 57 58M116 44Q124 40 124 49Q125 57 116 58" fill="#edc9a1"/>
    <path d="M57 39Q62 22 83 23Q105 23 115 39L116 58Q113 77 92 82Q70 80 59 66Z" fill="#edc9a1"/>
    ${grandma ? `<path d="M57 42Q62 25 81 25L71 40M82 25Q98 22 115 40" fill="${hair}"/><path d="M66 49Q71 45 76 49M98 49Q102 45 108 48M66 42L76 40M99 40L108 43"/><path d="M80 66Q89 73 102 65M88 51L85 58L91 59M63 60L69 62M106 63L111 60"/>` : `<path d="M56 39Q60 20 83 22Q80 33 63 38M84 22Q105 19 116 39L103 32L99 28" fill="${hair}"/><path d="M68 44L77 40M99 41L109 43M86 49L83 56L90 57M78 66Q89 69 102 61"/><path d="M71 50H73M103 49H105" stroke-width="4"/>`}
    <path d="M66 60H70M105 59H109" stroke="${red}"/>
    ${grandma ? `<path d="M51 111L39 131Q37 139 48 141L79 139L81 127L57 126L62 113" fill="${coat}"/><path d="M134 107L143 126L110 132L112 144L150 139Q160 136 153 124L146 106" fill="${coat}"/><path d="M73 127L88 130L91 140L77 141M111 133L98 134L99 146L114 143" fill="#edc9a1"/><path d="M78 123Q94 128 112 123L107 147Q94 155 83 147Z" fill="${paper}"/><ellipse cx="95" cy="123" rx="19" ry="7" fill="${paper}"/><path d="M86 124H103M88 138H102" stroke="${red}"/><path d="M91 110Q85 103 91 97M103 108Q109 100 103 94" stroke-width="2"/>` : gesture === 'reply' ? `<path d="M55 109L45 133L72 142L79 132L61 122L65 114" fill="${coat}"/><path d="M132 103L145 117L157 106L148 98L139 107" fill="${coat}"/><path d="M147 99L147 89L152 91L155 80Q159 76 161 82L160 97Q167 90 170 95L164 105L156 110Z" fill="#edc9a1"/><path d="M75 131L85 135L84 146L70 141" fill="#edc9a1"/>` : `<path d="M55 110L43 133Q43 138 50 140L76 143L81 130L60 126L65 113" fill="${coat}"/><path d="M135 103L142 121L161 106L169 117L144 140Q137 144 131 137L122 117" fill="${coat}"/><path d="M157 109L160 100L169 98L174 107L168 117Z" fill="#edc9a1"/><path d="M75 130L86 132L91 140L84 147L76 143" fill="#edc9a1"/><path d="M162 104L174 75M166 106L179 79" stroke-width="2.5"/>`}
    <path d="M54 150H80M109 150H137"/>
  </svg>`;
}

export function table(ending = false) {
  return `<svg viewBox="0 0 400 245" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M33 166L28 224M362 166L368 224" stroke-width="7"/>
    <ellipse cx="200" cy="128" rx="216" ry="105" fill="${gold}"/>
    <ellipse cx="200" cy="118" rx="214" ry="99" fill="${red}"/>
    <path d="M-7 127Q194 207 407 123" opacity=".3"/>
    <ellipse cx="198" cy="64" rx="51" ry="24" fill="${paper}"/>
    ${ending ? '<path d="M173 64L181 66M205 60L211 58M221 68L226 70"/>' : `<path d="M169 65L157 52L157 75Z" fill="#75836c"/><path d="M168 64Q194 40 229 59Q240 69 221 75Q187 84 168 64Z" fill="#75836c"/><circle cx="224" cy="62" r="2" fill="${ink}"/><path d="M201 52L207 69M178 64L191 60"/>`}
    <ellipse cx="91" cy="111" rx="32" ry="21" fill="${paper}"/>
    ${ending ? '<path d="M78 110L86 114M105 106L111 105"/>' : '<path d="M73 112Q69 88 83 91L91 105Q103 83 111 98L101 115Z" fill="#75836c"/>'}
    <ellipse cx="309" cy="112" rx="33" ry="20" fill="${paper}"/>
    ${ending ? '<path d="M301 114L309 116M322 107L326 110"/>' : `<path d="M290 104L299 96L309 102L306 115L294 116ZM311 113L322 101L333 110L327 124L315 124Z" fill="${gold}"/>`}
    <path d="M77 66L95 84M83 62L101 80M311 82L330 62M316 87L337 67"/>
    <path d="M117 140L145 161M120 134L149 154M254 155L279 135M259 161L286 140"/>
    <path d="M111 58Q113 78 133 78Q152 78 154 58" fill="${paper}"/><ellipse cx="132" cy="58" rx="22" ry="8" fill="${paper}"/>
    <path d="M247 58Q249 78 269 78Q288 78 290 58" fill="${paper}"/><ellipse cx="269" cy="58" rx="22" ry="8" fill="${paper}"/>
    <path d="M168 175Q173 215 201 216Q230 215 235 175" fill="${paper}"/><ellipse cx="201" cy="174" rx="35" ry="12" fill="${paper}"/>
    ${ending ? '<path d="M181 175L193 178M211 171L219 173"/>' : '<path d="M176 171Q184 161 193 169Q201 156 209 169Q220 161 227 174" fill="#fff5df"/>'}
    <path d="M180 199Q200 208 222 196" stroke="${red}"/>
    <path d="M157 221L183 229M214 230L242 220"/>
  </svg>`;
}

export function emptySeat() {
  return `<svg viewBox="0 0 180 100" fill="none" stroke="${ink}" stroke-width="3" stroke-linejoin="round" aria-hidden="true"><path d="M25 93L24 34Q25 14 44 13H133Q153 14 154 34V94" fill="${gold}"/><path d="M38 37H142M38 49H142M42 89V63M139 89V63"/><path d="M35 87Q85 69 145 87" fill="${paper}"/></svg>`;
}

export function openingSign() {
  return `<svg viewBox="0 0 176 84" fill="none" stroke="${ink}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" aria-label="手写开席"><path d="M14 14L66 11M7 32L74 29M30 13L29 47Q28 63 14 74M56 12L59 73M99 11L134 8M104 11L97 33L94 70M102 23L161 20M114 31L151 28M116 27L119 44L147 40L146 26M102 48L161 44M118 48L118 63L110 64M143 46L143 62L153 60M131 40L132 74"/><path d="M161 67L169 62" stroke="${red}" stroke-width="8"/></svg>`;
}

export function cardIcon(card) {
  const paths = {
    taiji: '<path d="M9 24Q3 13 15 9Q26 5 30 15Q33 24 23 28M22 10L16 16L24 18M23 28L25 34L32 29"/>',
    counter: '<path d="M7 14L31 10M8 24L32 20M12 5L19 32"/><path d="M27 28L32 32"/>',
    crazy: '<path d="M7 8L17 11L24 4L25 14L34 17L27 23L29 32L18 28L10 34L11 23L3 19L10 16Z"/>',
    sincere: '<path d="M5 20Q9 31 20 31Q31 30 34 20M4 19Q19 24 35 19M13 13Q8 7 13 3M25 13Q30 7 25 3"/>',
  };
  return `<svg viewBox="0 0 40 40" fill="none" stroke="${ink}" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[card]}</svg>`;
}

export function speechOutline(tail = 76) {
  return `<svg class="speech-outline" viewBox="0 0 150 110" preserveAspectRatio="none" fill="${paper}" stroke="${ink}" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M15 14L${tail - 8} 13L${tail} 2L${tail + 7} 13L135 15Q147 15 146 27L145 94Q145 106 132 105L16 104Q4 104 5 92L4 28Q3 14 15 14Z"/></svg>`;
}

export function toolIcon(type) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="${ink}" stroke-width="2" stroke-linecap="round" aria-hidden="true">${type === 'pause' ? '<path d="M8 5V19M16 5V19"/>' : '<path d="M4 9H8L13 5V19L8 15H4ZM17 8L22 16M22 8L17 16"/>'}</svg>`;
}
