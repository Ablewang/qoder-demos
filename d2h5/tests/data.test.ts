import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { ART_KEYS, artUrl, heroArtKey, itemArtKey } from '../src/art';
import { rawRows, text } from '../src/catalog';
import { BASE_ITEMS } from '../src/items';

const source = new URL('../src/data/', import.meta.url);
test('all 33 data tables are pinned and local normalized checksums match', () => {
  const provenance=JSON.parse(readFileSync(new URL('provenance.json',source),'utf8')) as Record<string,{commit:string;rows:number;storedSha256:string;error?:string}>;
  assert.equal(Object.keys(provenance).length,33);
  for (const [name,p] of Object.entries(provenance)) {
    assert.equal(p.error,undefined,name); assert.equal(p.commit,'0edfaf6d006f2eb82857c066e07ce03614285981');
    const raw=readFileSync(new URL(`raw/${name}.json`,source));
    assert.equal(createHash('sha256').update(raw).digest('hex'),p.storedSha256,name);
    assert.equal(Object.keys(JSON.parse(raw.toString())).length,p.rows,name);
  }
});
test('source skill table contains all seven classes and excludes D2R eighth class', () => {
  const rows=Object.values(JSON.parse(readFileSync(new URL('raw/skills.json',source),'utf8'))) as Record<string,unknown>[];
  const playerSkills=rows.filter(r=>['ama','sor','nec','pal','bar','dru','ass'].includes(String(r.charclass)));
  assert.equal(playerSkills.length,210);
  for (const code of ['ama','sor','nec','pal','bar','dru','ass']) assert.equal(playerSkills.filter(r=>r.charclass===code).length,30);
});
test('all 49 original runtime assets have positive manifest dimensions and real WebP files', () => {
  const directory = new URL('../public/art/', import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL('manifest.json', directory), 'utf8')) as Record<string, {file:string;width:number;height:number}>;
  assert.equal(ART_KEYS.length, 49);
  assert.deepEqual(Object.keys(manifest).sort(), [...ART_KEYS].sort());
  for (const key of ART_KEYS) {
    const entry = manifest[key];
    assert.equal(entry.file, `${key}.webp`);
    assert.ok(entry.width > 0 && entry.height > 0, key);
    const bytes = readFileSync(new URL(entry.file, directory));
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF', key);
    assert.equal(bytes.toString('ascii', 8, 12), 'WEBP', key);
    assert.equal(artUrl(key), `/art/${key}.webp`);
  }
});
test('every runtime base maps to available raster or inline key art; gems and runes remain distinct', () => {
  for (const base of BASE_ITEMS) {
    const icon = itemArtKey(base.code);
    if (icon === 'key' || icon === 'skull') {
      assert.match(base.code, icon === 'key' ? /^(key|pk[1-3])$/ : /^sk[cfulz]$/);
      assert.match(artUrl(icon), /^data:image\/svg\+xml,/);
    } else assert.ok(ART_KEYS.includes(icon as typeof ART_KEYS[number]), base.code);
  }
  for (const row of rawRows('gems')) {
    const code = text(row, 'code');
    if (code) assert.equal(itemArtKey(code), /^r\d{2}$/.test(code) ? 'rune' : /^sk[cfulz]$/.test(code) ? 'skull' : 'gem', code);
  }
  for (const [code, family] of Object.entries({hp1:'health',mp5:'mana',rvs:'rejuvenation',rvl:'rejuvenation',box:'cube',gld:'gold',aqv:'arrows',cqv:'arrows',rin:'ring',amu:'amulet',tsc:'scroll',tbk:'book',cap:'helm',buc:'shield',hax:'axe',sst:'staff',jav:'spear',sbb:'bow'})) assert.equal(itemArtKey(code), family, code);
});
test('all seven class portraits and generic NPC portraits use dedicated art', () => {
  for (const code of ['ama','sor','nec','pal','bar','dru','ass']) assert.equal(heroArtKey(code), code);
  assert.equal(heroArtKey('akara'), 'traveler');
});
