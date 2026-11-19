import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { CLASSES, RACES } from '../src/data/classes.js';
import { ZONES } from '../src/data/world.js';

const base = process.env.GAME_URL || 'http://127.0.0.1:5183';
assert.equal(base, 'http://127.0.0.1:5183');
const stage = process.env.MODELING_STAGE || 'after';
assert.ok(['before', 'after'].includes(stage));
const artifact = name => fileURLToPath(new URL(`../artifacts/modeling-${stage}-${name}`, import.meta.url));
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const context = await browser.newContext({ reducedMotion: 'reduce' });
const page = await context.newPage();
const errors = [], external = [], results = [], images = [];
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => { if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== base) external.push(request.url()); });
try {
  await page.route('**/src/ui/world-scene.js?modeling-fixture', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `${await response.text()}\nexport { buildAvatar, buildEnemy, buildEnvironment, pose };` });
  });
  await page.goto(base);
  await page.waitForFunction(() => document.querySelector('#app')?.getAttribute('aria-busy') === 'false');
  await page.evaluate(async () => {
    const scene = await import('/src/ui/world-scene.js'); scene.unmountWorldScene();
    const THREE = await import('/src/vendor/three.module.js');
    const prototype = WebGL2RenderingContext.prototype;
    const clear = prototype.clear;
    prototype.clear = function (mask) {
      if (mask & this.COLOR_BUFFER_BIT) window.__modelingMetrics = { calls: 0, triangles: 0 };
      return clear.call(this, mask);
    };
    for (const name of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
      const draw = prototype[name];
      prototype[name] = function (...args) {
        const metrics = window.__modelingMetrics;
        if (metrics) {
          metrics.calls++;
          const count = name.startsWith('drawElements') ? args[1] : args[2];
          const instances = name.endsWith('Instanced') ? args.at(-1) : 1;
          if (args[0] === this.TRIANGLES) metrics.triangles += count / 3 * instances;
        }
        return draw.apply(this, args);
      };
    }
    document.querySelector('#app').innerHTML = '<main style="padding:12px;background:#292327;color:#ffe7bd"><h1 id="model-title" style="font:18px serif;margin:0 0 10px"></h1><div id="model-scene" style="position:relative;width:100%;height:680px"></div></main>';
    window.__modeling = scene;
    window.__builders = await import('/src/ui/world-scene.js?modeling-fixture');
    window.__three = THREE;
  });
  const shot = async (name, title) => {
    await page.evaluate(title => { document.querySelector('#model-title').textContent = `${title} · 独立建模夹具，不写入存档`; }, title);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.screenshot({ path: artifact(`${name}.png`), animations: 'disabled' });
    results.push({ name, ...await page.evaluate(() => window.__modelingMetrics) });
    images.push({ name, title });
  };
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 740 : 780 });
    await page.evaluate(width => { document.querySelector('#model-scene').style.height = `${width === 390 ? 640 : 680}px`; }, width);
    for (const [id, cls] of Object.entries(CLASSES)) {
      assert.equal(await page.evaluate(state => __modeling.mountWorldScene(document.querySelector('#model-scene'), state), {
        cls: id, race: cls.race, location: 'zulong', city: true, active: false, monsters: [], equipment: { weapon: { weaponType: cls.weapon } },
      }), true);
      await shot(`class-${id}-${width}`, `${RACES[cls.race].name} / ${cls.name}`);
    }
    for (const location of ['h_f1', 'zulong']) {
      const monsters = (ZONES[location].mobs || []).map(([name, lv, rank], i) => ({ id: `model-${i}`, name, lv, rank, hp: 10, maxHp: 10, aggro: rank === 'boss' ? 4.2 : rank === 'elite' ? 3.2 : 0 }));
      assert.equal(await page.evaluate(state => __modeling.mountWorldScene(document.querySelector('#model-scene'), state), { cls: 'blademaster', location, city: location === 'zulong', explorable: true, movementEnabled: true, active: false, monsters, targetId: monsters.at(-1)?.id }), true);
      await page.evaluate(() => __modeling.toggleWorldOverview());
      await shot(`region-${location}-${width}`, ZONES[location].name);
    }
    await page.evaluate(() => __modeling.unmountWorldScene());
    const galleryMetrics = await page.evaluate(() => {
      const T = __three, scene = new T.Scene(); scene.background = new T.Color(0xe4dfce);
      scene.add(new T.HemisphereLight(0xfff2d8, 0x8c9a87, 0.95));
      const key = new T.DirectionalLight(0xffe5bf, 2); key.position.set(-3, 7, 5); scene.add(key);
      const rim = new T.DirectionalLight(0xb6dce4, 0.7); rim.position.set(4, 4, -5); scene.add(rim);
      const monsters = ['小野猪', '林间野狼', '山贼喽啰', '木桩妖', '山贼头目', '巨牙野猪王'];
      const layers = monsters.map((name, i) => __builders.buildEnemy({ id: `gallery-${i}`, name, rank: i === 5 ? 'boss' : i === 4 ? 'elite' : '', hp: 10 }, [(i % 3 - 1) * 2.25, Math.floor(i / 3) * 2.8], i));
      layers.forEach(layer => scene.add(layer.root));
      const renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
      renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping;
      const host = document.querySelector('#model-scene'); renderer.setSize(host.clientWidth, host.clientHeight); host.appendChild(renderer.domElement);
      const camera = new T.PerspectiveCamera(36, host.clientWidth / host.clientHeight, 0.1, 100);
      const distance = Math.max(9, 7.2 / (2 * Math.tan(Math.PI / 10) * camera.aspect));
      camera.position.set(0, 1.1 + distance * 0.42, 1.4 + distance * 0.91); camera.lookAt(0, 1.1, 1.4);
      renderer.render(scene, camera);
      const metrics = layers.map(layer => {
        let triangles = 0, meshes = 0;
        layer.model.traverse(object => {
          if (!object.isMesh) return;
          meshes++;
          triangles += (object.geometry.index?.count || object.geometry.attributes.position.count) / 3 * (object.isInstancedMesh ? object.count : 1);
        });
        const bounds = new T.Box3().setFromObject(layer.model).getSize(new T.Vector3()).toArray();
        assertContract(layer);
        return { id: layer.id, triangles, meshes, bounds };
      });
      function assertContract(layer) {
        for (const field of ['root', 'model', 'k', 'shadow', 'selection', 'warning']) if (!layer[field]) throw new Error(`缺少怪物字段 ${field}`);
        if (!Number.isFinite(layer.fallHeight)) throw new Error('倒地包围尺寸无效');
      }
      window.__galleryFocus = index => {
        layers.forEach((layer, i) => { layer.root.visible = i === index; });
        const at = layers[index].root.position;
        camera.position.set(at.x + 0.6, 2.5, at.z + 5.3); camera.lookAt(at.x, 0.95, at.z);
        renderer.render(scene, camera);
      };
      window.__galleryCleanup = () => {
        const pending = new Set();
        for (const layer of layers) {
          layer.root.traverse(object => {
            if (!object.isMesh) return;
            for (const resource of [object.geometry, object.material, ...(object.isInstancedMesh ? [object] : [])]) {
              if (pending.has(resource)) continue;
              pending.add(resource); resource.addEventListener('dispose', () => pending.delete(resource));
            }
          });
          layer.k.dispose();
        }
        if (pending.size || renderer.info.memory.geometries !== 0) throw new Error('建模资源未随图层释放');
        scene.clear(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
      };
      return metrics;
    });
    await shot(`monsters-${width}`, '上排：小野猪 / 林间野狼 / 山贼喽啰；下排：木桩妖 / 精英山贼 / 野猪王');
    results.at(-1).models = galleryMetrics;
    if (stage === 'after') {
      const names = ['小野猪', '林间野狼', '山贼喽啰', '木桩妖', '精英山贼头目', '巨牙野猪王'];
      for (let index = 0; index < names.length; index++) {
        await page.evaluate(index => __galleryFocus(index), index);
        await shot(`monster-${index}-${width}`, names[index]);
      }
    }
    await page.evaluate(() => __galleryCleanup());
  }
  const resourceChecks = await page.evaluate(({ classes, zones }) => {
    let layers = 0, geometries = 0, materials = 0, instances = 0, warningChecks = 0;
    const release = layer => {
      const pending = new Set();
      layer.root.traverse(object => {
        if (!object.isMesh) return;
        for (const resource of [object.geometry, object.material, ...(object.isInstancedMesh ? [object] : [])]) {
          if (pending.has(resource)) continue;
          pending.add(resource); resource.addEventListener('dispose', () => pending.delete(resource));
          if (resource.isBufferGeometry) geometries++;
          if (resource.isMaterial) materials++;
          if (resource.isInstancedMesh) instances++;
        }
      });
      layer.k.dispose();
      if (pending.size) throw new Error('图层资源释放不完整');
      layers++;
    };
    const avatar = __builders.buildAvatar({ ...classes[0][1], cls: classes[0][0] });
    for (const [cls, data] of classes.slice(1)) release(__builders.buildAvatar({ ...data, cls }));
    for (const [location, zone] of zones) {
      for (const explorable of [false, true]) {
        const layer = __builders.buildEnvironment({ location, city: zone.type === 'city', explorable });
        if (!layer.framePoints.every(point => point.toArray().every(Number.isFinite))) throw new Error('场景包围数据无效');
        if (layer.occluders.some(cover => !cover.object.parent)) throw new Error('遮挡网格被错误合批');
        release(layer);
      }
      for (const [i, [name, , rank]] of (zone.mobs || []).entries()) {
        const layer = __builders.buildEnemy({ id: `${location}-${i}`, name, rank, hp: 10 }, [0, 0], i);
        const size = new __three.Box3().setFromObject(layer.model).getSize(new __three.Vector3());
        if (![size.x, size.y, size.z, layer.fallHeight].every(Number.isFinite)) throw new Error('怪物包围数据无效');
        const warning = layer.warning.material, emission = warning.emissive.clone(), intensity = warning.emissiveIntensity;
        layer.hit = 0.23;
        __builders.pose({ avatar, enemies: [layer], reducedMotion: true, moving: false, time: 0, walkPhase: 0, attack: 0, state: { explorable: true }, facing: 0 }, 0);
        if (!warning.emissive.equals(emission) || warning.emissiveIntensity !== intensity) throw new Error('受击闪光不得改变重击预警圈');
        warningChecks++;
        release(layer);
      }
    }
    release(avatar);
    return { layers, geometries, materials, instances, warningChecks };
  }, { classes: Object.entries(CLASSES), zones: Object.entries(ZONES) });
  const sheet = await context.newPage();
  for (const [kind, filter] of [['classes', x => x.name.startsWith('class-') && x.name.endsWith('1440')], ['scenes', x => !x.name.startsWith('class-')]]) {
    const tiles = await Promise.all(images.filter(filter).map(async image => `<figure style="margin:0"><img style="width:100%;display:block" src="data:image/png;base64,${(await readFile(artifact(`${image.name}.png`))).toString('base64')}"><figcaption>${image.title}</figcaption></figure>`));
    await sheet.setViewportSize({ width: 1440, height: 900 });
    await sheet.setContent(`<body style="margin:0;padding:12px;background:#292327;color:#ffe7bd;font:14px sans-serif"><div style="display:grid;grid-template-columns:repeat(${kind === 'classes' ? 5 : 3},1fr);gap:8px">${tiles.join('')}</div></body>`);
    await sheet.screenshot({ path: artifact(`${kind}-contact.png`), fullPage: true });
  }
  await sheet.close();
  assert.deepEqual(errors, []); assert.deepEqual(external, []);
  await writeFile(artifact('metrics.json'), JSON.stringify({ stage, results, resourceChecks, errors, external }, null, 2));
  console.log(`PASS ${stage}: ${images.length} captures, five races/ten classes, field elite/boss, town, 1440/390; ${resourceChecks.layers} layer disposal checks (${resourceChecks.instances} instance batches), ${resourceChecks.warningChecks} recoil warning-color checks; no save writes or external requests.`);
} finally { await context.close(); await browser.close(); }
