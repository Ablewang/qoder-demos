import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { makeNamedEquip, makeHighEquip, ITEMS } from '../src/data/items.js';
import { NAMED_EQUIPMENT, matchesNamedEquip } from '../src/data/named-equipment.js';
import { itemNameColor, ITEM_COLOR_PALETTE } from '../src/data/item-colors.js';
import { getProductionRecipes } from '../src/data/production.js';
import { SHOP_PRODUCTS, ACTIVITY_POOLS, MILESTONES } from '../src/data/economy.js';

const base = process.env.GAME_URL || 'http://127.0.0.1:5176';
assert.match(base, /^http:\/\/(?:localhost|127\.0\.0\.1):5176$/, 'Use only the existing isolated production preview on port 5176 in a fresh context');

const out = new URL('../artifacts/', import.meta.url).pathname;
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
page.setDefaultTimeout(15000);
const errors = [];
page.on('pageerror', (err) => errors.push(err.message));
const settled = async () => {
  await page.waitForFunction(() => document.querySelector('#app')?.getAttribute('aria-busy') === 'false');
  await page.evaluate(async () => {
    const api = globalThis[Symbol.for('pwi-h5.main-session')]?.api;
    if (!api) throw new Error('Missing main-session API in the isolated preview');
    await api.queue;
  });
  await page.waitForFunction(() => document.querySelector('#app')?.getAttribute('aria-busy') === 'false');
};
const state = async () => { await settled(); return page.evaluate(async () => {
  const api = globalThis[Symbol.for('pwi-h5.main-session')].api;
  return (await api.request('GET', '/v1/state')).data.snapshot;
}); };
const click = async (action, attrs = '', root = '') => {
  await settled();
  const locator = page.locator(`${root} [data-action="${action}"]${attrs}`.trim()).filter({ visible: true }).first();
  if (action === 'page' && !await locator.count() && await page.locator('.mobile-nav-more > summary').isVisible()) {
    await page.locator('.mobile-nav-more > summary').click();
  }
  await locator.click(); await settled();
};
const renderedName = (locator) => locator.evaluate((element) => {
  const copy = element.cloneNode(true); copy.querySelectorAll('.sr-only').forEach((node) => node.remove());
  return copy.textContent.trim();
});
async function disabledNoCharge(locator, checkpoint, label) {
  assert.ok(await locator.isVisible(), `${label}: action must be visible`);
  assert.ok(await locator.isDisabled(), `${label}: action must be disabled`);
  await locator.evaluate((button) => button.click());
  assert.deepEqual(await state(), checkpoint, `${label}: disabled action must not charge or change the save`);
}
async function nameColor(locator, item) {
  const nodes = await locator.evaluateAll((elements) => elements.map((element) => ({
    name: element.dataset.itemName, token: element.dataset.itemColor, color: getComputedStyle(element).color,
  })));
  assert.ok(nodes.length > 0, 'Expected an item name with color evidence');
  for (const node of nodes) {
    assert.ok(node.name, 'Name color must identify the actual item, not q');
    if (item) assert.equal(node.name, typeof item === 'string' ? item : item.name);
    const token = itemNameColor(node.name), hex = ITEM_COLOR_PALETTE[token].slice(1);
    const rgb = [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
    assert.equal(node.token, token, `${node.name}: source-evidenced color token`);
    assert.equal(node.color, `rgb(${rgb.join(', ')})`, `${node.name}: evidence palette CSS`);
  }
}
const screenshot = async (name) => { await settled(); await page.waitForFunction(() => !document.querySelector('#toast')?.classList.contains('show')); await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: `${out}${name}`, fullPage: true, animations: 'disabled' }); };
async function noOverflow() {
  const size = await page.evaluate(() => ({ w: innerWidth, content: document.documentElement.scrollWidth }));
  assert.ok(size.content <= size.w + 1, `horizontal overflow: ${JSON.stringify(size)}`);
}
async function fightPig() {
  await click('hunt', '[data-index="0"]');
  for (let i = 0; i < 30; i++) {
    if (await page.locator('.battle-result').count()) break;
    const recommended = page.locator('[data-action="turn"].recommended:not(:disabled)').filter({ visible: true }).first();
    assert.ok(await recommended.count(), 'Manual combat must explain an available next action');
    await recommended.click(); await settled();
  }
  assert.equal(await page.locator('.battle-controls').count(), 0, 'Resolved combat removes turn controls');
  assert.equal(await page.locator('[data-action="turn"]:not(:disabled)').count(), 0, 'Resolved combat cannot advance another turn');
  assert.match(await page.locator('.battle-result').innerText(), /此战告捷/);
  await click('leaveBattle');
}
try {
  await page.goto(base);
  await page.locator('#char-name').fill('');
  await page.getByRole('button', { name: '进入完美大陆' }).click();
  assert.equal(await page.locator('.shell').count(), 0);
  for (const [id, home] of [['human', '剑仙城'], ['elf', '积羽城'], ['untamed', '万化城'], ['tideborn', '惊涛城'], ['earthguard', '灵犀城']]) {
    await click('race', `[data-id="${id}"]`);
    assert.match(await page.locator('.creation-preview').innerText(), new RegExp(home));
    assert.equal(await page.locator('.class-option').count(), 2);
  }
  await click('race', '[data-id="human"]');
  await noOverflow();
  await screenshot('desktop-create.png');
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 }); await noOverflow();
    await screenshot(`mobile-${width}-create.png`);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  assert.equal(await page.evaluate(async () => globalThis[Symbol.for('pwi-h5.main-session')].api.store.current()), null, 'Fresh context must start with no save');
  await page.locator('#char-name').fill('云归');
  await page.getByRole('button', { name: '进入完美大陆' }).click();
  assert.match(await page.locator('.hud-identity strong').innerText(), /云归/);
  await click('travel', '[data-id="h_f1"]');
  await noOverflow();
  await screenshot('desktop-world.png');
  for (let i = 0; i < 3; i++) await fightPig();
  assert.ok((await state()).player.lv >= 2);
  await click('page', '[data-id="quests"]');
  await click('claim', '[data-bounty="false"]');
  assert.equal((await state()).player.mainIndex, 1);
  await click('page', '[data-id="character"]');
  await click('allocateAuto');
  assert.equal((await state()).player.points, 0);
  await click('page', '[data-id="world"]');
  await fightPig();
  assert.equal((await state()).player.mainProgress, 1);
  // Natural play: collect the actual root-recipe resources, never import forge materials.
  const rootRecipe = getProductionRecipes((await state()).player.cls).find((recipe) => recipe.series === 'local-tutorial' && recipe.lv === 1 && recipe.slot === 'weapon');
  assert.ok(rootRecipe?.id && rootRecipe.templateId, 'Select an actual level-1 local-tutorial weapon recipe');
  for (const [id, required] of Object.entries(rootRecipe.materials)) {
    while (((await state()).player.items[id] || 0) < required) {
      await page.locator(`[data-action="gather"][data-id="${id.slice(0, -1)}"]:not(:disabled)`).waitFor();
      const prior = await state();
      await click('gather', `[data-id="${id.slice(0, -1)}"]`);
      assert.ok((await state()).player.items[id] > (prior.player.items[id] || 0));
    }
  }
  await click('travel', '[data-id="wanliu"]');
  await click('page', '[data-id="town"]');
  const beforePurchase = await state();
  await click('buy', '[data-id="hp1"][data-qty="10"]');
  const afterPurchase = await state();
  assert.equal(afterPurchase.player.items.hp1, beforePurchase.player.items.hp1 + 10);
  assert.equal(afterPurchase.player.gold, beforePurchase.player.gold - 100);
  await click('townTab', '[data-id="activities"]');
  await click('sign');
  assert.equal((await state()).player.daily.signed, true);
  assert.ok(await page.locator('[data-action="sign"]').isDisabled());
  await click('townTab', '[data-id="forge"]');
  await page.locator('#production-series').selectOption(rootRecipe.series); await settled();
  await page.locator('#forge-slot').selectOption('weapon'); await settled();
  await page.locator('#production-recipe').selectOption(rootRecipe.id); await settled();
  const beforeForge = await state();
  assert.ok(beforeForge.player.lv >= rootRecipe.playerLv);
  assert.ok((beforeForge.player.production?.[rootRecipe.skill]?.level ?? 1) >= rootRecipe.skillLevel);
  await click('produceConfirm', `[data-id="${rootRecipe.id}"]`);
  assert.match(await page.locator('#dialog-title').innerText(), /确认生产/);
  assert.deepEqual(await state(), beforeForge, 'Production preview must not charge or award equipment');
  await click('closeModal');
  assert.deepEqual(await state(), beforeForge, 'Production cancellation must not charge');
  await click('produceConfirm', `[data-id="${rootRecipe.id}"]`);
  await click('confirmModal');
  const beforeEquip = await state();
  const weapon = beforeEquip.player.bag.find((it) => it.origin === `production:${rootRecipe.id}`);
  assert.ok(weapon && matchesNamedEquip(weapon));
  assert.equal(weapon.templateId, rootRecipe.templateId);
  assert.equal(weapon.q, 0, 'q0 is only legacy accounting, never a color or random quality roll');
  assert.equal(weapon.stars, null);
  assert.equal(weapon.nameColor, null);
  assert.equal(beforeEquip.player.bag.length, beforeForge.player.bag.length + 1);
  assert.equal(beforeEquip.player.gold, beforeForge.player.gold - rootRecipe.gold);
  for (const [id, quantity] of Object.entries(rootRecipe.materials)) assert.equal(beforeEquip.player.items[id], beforeForge.player.items[id] - quantity);
  assert.equal(beforeEquip.player.items.huanxian, beforeForge.player.items.huanxian);
  assert.equal(beforeEquip.player.production[rootRecipe.skill].exp, (beforeForge.player.production?.[rootRecipe.skill]?.exp ?? 0) + 1);
  await click('closeModal');
  await click('page', '[data-id="bag"]');
  await click('equip', `[data-id="${weapon.uid}"]`);
  assert.equal((await state()).player.equipment.weapon.uid, weapon.uid);
  await click('page', '[data-id="town"]');
  await click('townTab', '[data-id="refine"]');
  const beforeRefine = await state();
  await click('refineConfirm', '[data-id="weapon"]');
  assert.match(await page.locator('.modal-body').innerText(), /失败后精炼为\+0/);
  await page.locator('.modal-actions [data-action="closeModal"]').click();
  assert.equal((await state()).player.gold, beforeRefine.player.gold);
  assert.equal((await state()).player.items.huanxian, beforeRefine.player.items.huanxian);
  await click('page', '[data-id="quests"]');
  await click('bounty');
  assert.ok((await state()).player.bounty);
  for (const id of ['skills', 'cult', 'character', 'guide']) {
    await click('page', `[data-id="${id}"]`);
    await noOverflow();
  }
  assert.equal(await page.locator('.sidebar .nav [data-action="page"][data-id="activities"]').innerText(), '鸿运秘宝');
  await click('page', '[data-id="mall"]');
  assert.equal(await page.locator('.mall-page [data-action="activityOpen"], .mall-page #box-vault, .mall-page #boxes-vault').count(), 0);
  assert.equal(await page.locator('.mall-page [data-action="activityClaim"]').count(), 1);
  assert.equal(await page.locator('.shop-product').count(), 8);
  assert.equal(await page.locator('.product-art .relic-art').count(), 8);
  assert.match(await page.locator('.mall-shelf').innerText(), /幸运粽子/);
  assert.match(await page.locator('.mall-shelf').innerText(), /黄金护身符/);
  assert.equal(await page.locator('.shop-product[data-product="hp1"]').count(), 0);
  await screenshot('desktop-mall.png');
  await click('mallDetail', '[data-id="zongzi"]');
  assert.match(await page.locator('.modal-body').innerText(), /持有后再开启/);
  await click('closeModal');
  await click('mallTab', '[data-id="all"]');
  assert.equal(SHOP_PRODUCTS.length, 66);
  assert.equal(await page.locator('.shop-product').count(), SHOP_PRODUCTS.length);
  assert.ok(await page.locator('[data-action="mallBuy"][data-id="hp2"][data-qty="1"]').first().isDisabled());
  assert.ok(await page.locator('[data-action="mallBuy"][data-id="hp1"][data-qty="1"]').first().isDisabled());
  const originalItems = (await state()).player.items;
  await click('walletDetail'); await click('walletDaily');
  assert.ok(await page.locator('[data-action="walletDaily"]').isDisabled());
  assert.deepEqual((await state()).player.items, originalItems);
  await click('closeModal');
  await click('page', '[data-id="activities"]');
  assert.equal(await page.locator('.orbit-prize').count(), 12);
  assert.equal(await page.locator('.treasure-progress .treasure-milestone').count(), 3);
  assert.ok(await page.locator('.treasure-progress').isVisible());
  assert.equal(await page.locator('.treasure-progress [data-draw-total]').innerText(), '0');
  for (const id of ['draw10', 'draw50', 'draw100']) assert.ok(await page.locator(`.treasure-progress [data-action="activityClaim"][data-id="${id}"]`).isDisabled());
  const layout = await page.locator('.treasure-layout').evaluate((element) => {
    const progress = element.querySelector('.treasure-progress').getBoundingClientRect();
    const palace = element.querySelector('.treasure-palace').getBoundingClientRect();
    return { progressRight: progress.right, palaceLeft: palace.left };
  });
  assert.ok(layout.progressRight < layout.palaceLeft);
  assert.ok(await page.locator('[data-action="treasureDraw"][data-count="1"]').isDisabled());
  assert.equal(await page.locator('.treasure-page [data-action="activityOpen"], .treasure-page #box-vault, .treasure-page #boxes-vault, .treasure-page [data-id="festival.daily"]').count(), 0);
  assert.equal(await page.locator('.treasure-page [data-action="activityClaim"]').count(), 3);
  await click('page', '[data-id="mall"]');
  await page.locator('.economy-fold[data-fold="每日商城补贴"] > summary').click();
  const beforeSubsidy = await state();
  await click('activityClaim', '[data-id="festival.daily"]'); await click('closeModal');
  assert.deepEqual((await state()).player.items, originalItems);
  assert.equal((await state()).player.wallet.boundYuanbao, beforeSubsidy.player.wallet.boundYuanbao + 10);
  await disabledNoCharge(page.locator('[data-action="activityClaim"][data-id="festival.daily"]'), await state(), 'Daily mall subsidy can only be claimed once');
  await click('page', '[data-id="activities"]');
  await screenshot('desktop-activities.png');
  await click('page', '[data-id="mall"]');
  await click('mallTab', '[data-id="all"]');
  const buy = async (id, quantity = 1, goToBag = false) => {
    const prior = await state();
    await click('mallBuy', `[data-id="${id}"][data-qty="${quantity}"]`);
    await page.locator('#dialog-title').filter({ hasText: '选购成功' }).waitFor();
    const purchased = await state();
    assert.equal(purchased.player.mall.orders.length, prior.player.mall.orders.length + 1);
    const order = purchased.player.mall.orders.at(-1);
    assert.equal(order.quantity, quantity);
    assert.equal(purchased.player.wallet[order.currency], prior.player.wallet[order.currency] - order.cost);
    assert.deepEqual(purchased.player.drawHistory, prior.player.drawHistory, 'Purchasing must not draw rewards early');
    if (goToBag) {
      assert.equal(await page.locator('#modal [data-action="bagOpenables"]').innerText(), '前往包裹开启');
      await click('bagOpenables', '', '#modal');
      assert.ok(await page.locator('#modal').evaluate((element) => element.classList.contains('hidden')));
      assert.ok(await page.locator('.bag-tabs [data-id="items"]').evaluate((element) => element.classList.contains('active')));
      assert.ok(await page.locator('#owned-items').isVisible());
      assert.deepEqual(await state(), purchased, 'Purchase-result bag navigation must not change the save');
    } else await click('closeModal');
    return purchased;
  };
  await buy('revive', 10);
  for (const id of Object.keys(ACTIVITY_POOLS)) {
    const unowned = await state();
    assert.equal(unowned.player.items[id] || 0, 0);
    await click('mallDetail', `[data-id="${id}"]`);
    await click('itemDetail', `[data-id="${id}"]`);
    assert.equal(await page.locator('#modal .probability-list li').count(), ACTIVITY_POOLS[id].pool.length);
    for (const count of [1, 10]) await disabledNoCharge(page.locator(`#modal [data-action="activityOpen"][data-id="${id}"][data-count="${count}"]`), unowned, `${id} unowned detail ×${count}`);
    await click('closeModal');
    const prior = await buy(id, 1, true);
    assert.equal(prior.player.items[id], 1);
    assert.equal(prior.player.items.treasureKey || 0, 0);
    const ownedCard = page.locator(`.page .codex-item[data-item="${id}"]`);
    assert.equal(await ownedCard.count(), 1);
    assert.match(await ownedCard.locator('.owned-label').innerText(), /持有 ×1/);
    assert.ok(await ownedCard.locator(`[data-action="activityOpen"][data-id="${id}"][data-count="1"]`).isEnabled());
    await disabledNoCharge(ownedCard.locator(`[data-action="activityOpen"][data-id="${id}"][data-count="10"]`), prior, `${id} real quantity is insufficient for ten`);
    const milestones = page.locator('.economy-fold[data-fold="物品开启累计礼"]');
    if (!await milestones.evaluate((fold) => fold.open)) await milestones.locator('summary').click();
    for (const milestone of MILESTONES.filter((entry) => entry.counter !== 'draws')) {
      assert.match(await milestones.locator(`[data-milestone="${milestone.id}"]`).innerText(), new RegExp(`${prior.player.events[milestone.counter]}/${milestone.target}`));
      await disabledNoCharge(milestones.locator(`[data-action="activityClaim"][data-id="${milestone.id}"]`), prior, `${milestone.id} below opening threshold`);
    }
    await click('activityOpen', `[data-id="${id}"][data-count="1"]`);
    await page.locator('#dialog-title').filter({ hasText: '包裹物品已开启' }).waitFor();
    assert.equal(await page.locator('#modal .real-prize').count(), 1);
    const after = await state();
    const result = after.player.drawHistory.at(-1);
    assert.equal(result.poolId, id);
    assert.equal(result.pityBefore, null);
    assert.equal(result.pityAfter, null);
    assert.equal(after.player.drawHistory.length, prior.player.drawHistory.length + 1);
    const expected = structuredClone(prior.player);
    expected.items[id] -= 1;
    expected.events[ACTIVITY_POOLS[id].counter] += 1;
    for (const reward of result.rewards) {
      if (reward.type === 'item') expected.items[reward.itemId] = (expected.items[reward.itemId] || 0) + reward.quantity;
      else if (reward.type === 'equip') {
        assert.ok(reward.equipment.uid && !prior.player.bag.some((item) => item.uid === reward.equipment.uid));
        expected.bag.push(reward.equipment);
        assert.equal(await renderedName(page.locator('#modal .real-prize .equipment-name')), reward.equipment.name);
      } else if (reward.type === 'cosmetic') expected.cosmetics.owned.push(reward.cosmeticId);
      else if (['yuanbao', 'boundYuanbao'].includes(reward.type)) expected.wallet[reward.type] += reward.quantity;
      else expected[reward.type] += reward.quantity;
    }
    expected.drawHistory.push(result);
    assert.deepEqual(after.player, expected, `${id} must deliver exactly recorded rewards/UIDs, consume one item and no extra key/wallet, and leave Hongyun counters unchanged`);
    await click('closeModal');
    assert.equal(await page.locator(`.page .codex-item[data-item="${id}"]`).count(), 0, 'Consumed item must disappear, not leave a phantom disabled card');
    const history = page.locator('.economy-fold[data-fold^="逐次真实记录"]');
    if (!await history.evaluate((fold) => fold.open)) await history.locator('summary').click();
    const boxRecords = after.player.drawHistory.filter((entry) => ACTIVITY_POOLS[entry.poolId]);
    assert.equal(await history.locator('.economy-history article').count(), boxRecords.length);
    for (const entry of boxRecords) assert.equal(await history.locator('.economy-history article small').filter({ hasText: entry.id }).count(), 1);
    await click('bagTab', '[data-id="catalog"]');
    await click('itemDetail', `[data-id="${id}"]`);
    for (const count of [1, 10]) await disabledNoCharge(page.locator(`#modal [data-action="activityOpen"][data-id="${id}"][data-count="${count}"]`), after, `${id} consumed detail ×${count}`);
    await click('closeModal');
    await click('page', '[data-id="mall"]');
    await click('mallTab', '[data-id="all"]');
  }
  const opened = await state();
  assert.equal(opened.player.events.chestsOpened, 2);
  assert.equal(opened.player.events.zongziOpened, 2);
  assert.equal(opened.player.drawHistory.length, 4);
  await buy('treasureKey');
  const beforeDraw = await state();
  await click('page', '[data-id="activities"]');
  assert.ok(await page.locator('[data-action="treasureDraw"][data-count="10"]').isDisabled());
  await click('treasureDraw', '[data-count="1"]');
  await page.locator('#dialog-title').filter({ hasText: '鸿运揭晓' }).waitFor();
  assert.equal((await state()).player.events.hongyun.draws, beforeDraw.player.events.hongyun.draws + 1);
  assert.equal(await page.locator('#modal .real-prize').count(), 1);
  await click('closeModal');
  const afterDraw = await state();
  await click('page', '[data-id="bag"]');
  await click('bagTab', '[data-id="items"]');
  const bagHistory = page.locator('.economy-fold[data-fold^="逐次真实记录"]');
  if (!await bagHistory.evaluate((fold) => fold.open)) await bagHistory.locator('summary').click();
  assert.equal(await bagHistory.locator('.economy-history article').count(), 4);
  assert.equal(await bagHistory.locator('.economy-history article small').filter({ hasText: afterDraw.player.drawHistory.at(-1).id }).count(), 0, 'Bag opening history must exclude Hongyun draws');
  assert.deepEqual(await state(), afterDraw, 'Browsing separate bag history must not mutate rewards or counters');
  await click('bagTab', '[data-id="equipment"]');
  await click('page', '[data-id="mall"]');
  await click('mallTab', '[data-id="all"]');
  for (const id of ['gemHp1', 'reforgeStone', 'salvage', 'charmHp', 'outfitCloud']) await buy(id);
  const punchStones = weapon.grade * (weapon.sockets.length + 1);
  for (let i = 0; i < punchStones; i++) await buy('socketStone');
  await page.locator('.economy-fold').filter({ hasText: '外观与护符' }).locator('summary').click();
  await click('charmEquip', '[data-id="charmHp"][data-count="1"]');
  assert.equal((await state()).player.charms.hp, 600000);
  assert.ok(await page.locator('.economy-fold[data-fold="外观与护符"]').evaluate((fold) => fold.open));
  await click('cosmeticEquip', '[data-id="outfitCloud"]');
  assert.equal((await state()).player.cosmetics.outfit, 'outfitCloud');
  await click('mallTab', '[data-id="extension"]');
  assert.equal(await page.locator('.shop-product').count(), 58);
  assert.equal(await page.locator('.shop-product[data-product="zongzi"]').count(), 0);
  await click('mallTab', '[data-id="featured"]');
  await noOverflow();
  // Use the real gold shop for the additional compatible gem; never rely on
  // random chest currency to stretch the original 40-bound-yuanbao daily budget.
  await click('page', '[data-id="town"]');
  await click('townTab', '[data-id="shop"]');
  const beforeGemPurchase = await state();
  await click('buy', '[data-id="gemPatk1"][data-qty="1"]');
  const afterGemPurchase = await state();
  assert.equal(afterGemPurchase.player.items.gemPatk1, (beforeGemPurchase.player.items.gemPatk1 || 0) + 1);
  assert.equal(afterGemPurchase.player.gold, beforeGemPurchase.player.gold - ITEMS.gemPatk1.price);
  await click('page', '[data-id="character"]');
  assert.ok(await page.locator('.stat-box').count() >= 30);
  await click('equipped', '[data-id="weapon"]');
  assert.ok(await page.locator('#socket-gem option[value="gemHp1"]').isDisabled(), 'Weapon must reject HP gems');
  assert.equal(await page.locator('#modal [data-op="reroll"], #modal [data-op="upgrade"]').count(), 0, 'New gear must not offer legacy reroll or generic +5');
  assert.match(await page.locator('.modal-body').innerText(), /不允许通用\+5升级.*洗练/);
  const beforePunch = await state();
  const openedHoles = beforePunch.player.equipment.weapon.sockets.length;
  await click('equipmentAction', '[data-op="punch"]');
  const punched = await state();
  assert.equal(punched.player.equipment.weapon.sockets.length, openedHoles + 1);
  assert.equal(punched.player.items.socketStone, beforePunch.player.items.socketStone - weapon.grade * (openedHoles + 1));
  assert.equal(punched.player.gold, beforePunch.player.gold);
  await page.locator('#socket-gem').selectOption('gemPatk1');
  const socketIndex = punched.player.equipment.weapon.sockets.indexOf(null);
  await click('equipmentAction', '[data-op="socket"]');
  const socketed = await state();
  assert.equal(socketed.player.equipment.weapon.sockets[socketIndex], 'gemPatk1');
  assert.equal(socketed.player.items.gemPatk1, punched.player.items.gemPatk1 - 1);
  assert.equal(socketed.player.items.socketStone, punched.player.items.socketStone, 'Socketing must not silently punch or consume stones');
  assert.equal(socketed.player.gold, punched.player.gold - 40 - weapon.lv * 2);
  await click('equipmentAction', `[data-op="unsocket"][data-index="${socketIndex}"]`);
  const unsocketed = await state();
  assert.equal(unsocketed.player.equipment.weapon.sockets[socketIndex], null);
  assert.equal(unsocketed.player.items.gemPatk1, punched.player.items.gemPatk1);
  assert.equal(unsocketed.player.gold, socketed.player.gold - 30 - weapon.lv);
  assert.equal(unsocketed.player.equipment.weapon.rerolls, 0);
  assert.equal(unsocketed.player.equipment.weapon.upgrades, 0);
  assert.equal(unsocketed.player.equipment.weapon.lv, weapon.lv);
  const beforeBind = await state();
  await click('equipmentAction', '[data-op="bind"]');
  await page.locator('.modal-actions [data-action="closeModal"]').click();
  assert.equal((await state()).player.equipment.weapon.bound, beforeBind.player.equipment.weapon.bound);
  await noOverflow();
  const backup = await state();
  await page.reload();
  assert.equal((await state()).player.name, '云归');
  assert.equal((await state()).player.mainIndex, backup.player.mainIndex);
  await click('page', '[data-id="guide"]');
  const downloadPromise = page.waitForEvent('download');
  await page.locator('.settings-grid [data-action="export"]').click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), 'perfect-text-save.json');
  const chooserPromise = page.waitForEvent('filechooser');
  await click('importPicker');
  await (await chooserPromise).setFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{bad') });
  await page.locator('#toast').filter({ hasText: 'JSON格式错误' }).waitFor();
  assert.equal((await state()).player.name, '云归');
  console.log('PASS natural-play checkpoint: creation/combat/progression, natural-resource production, mall purchases routed to owned-only bag items, four independent item-detail pools and recorded opening rewards/UIDs without extra key/wallet charges, consumed-card removal, daily mall subsidy, punch/compatible weapon gem, new-gear no reroll/+5, reload/export and invalid JSON rejection.');
  // CONTROLLED IMPORT FIXTURE: finite named palette, legacy-name XSS, keys, opening milestones and near-pity counters;
  // none of these supplied assets/counters are claimed as naturally earned progress.
  console.log('BEGIN controlled imported fixture: finite level-1 named weapons, verified red high template, legacy-name XSS, 20 keys, five chest/zongzi opening counters and 49-draw pity checkpoint; not naturally earned.');
  const fixture = structuredClone(backup); fixture.player.name = '<b>test</b>';
  const palette = Object.values(NAMED_EQUIPMENT).filter((template) => template.status === 'local-tutorial' && template.slot === 'weapon' && template.lv === 1 && template.classes.includes(fixture.player.cls)).slice(0, 4)
    .map((template, index) => ({ ...makeNamedEquip(template.templateId, { origin: 'controlled-import:palette' }), uid: `palette${index}` }));
  assert.equal(palette.length, 4);
  const verifiedColor = makeHighEquip('axe19c');
  // A genuine old-format compatibility fixture, not a new gear identity with renamed metadata.
  const legacyXss = { uid: 'legacyxss', kind: 'equip', slot: 'weapon', name: '<b>配色验证·旧制珍品</b>', desc: 'Controlled imported legacy XSS fixture',
    lv: 1, grade: 1, q: 3, cls: fixture.player.cls, armorType: null, base: { patk: 10 }, addons: {}, refine: 0,
    durability: 100, maxDurability: 100, bound: false, sockets: [], socketLimit: 2, rerolls: 0, upgrades: 0, setId: null, price: 20 };
  fixture.player.bag.push(...palette, verifiedColor, legacyXss);
  fixture.player.items.treasureKey = 20;
  fixture.player.events.chestsOpened = 5;
  fixture.player.events.zongziOpened = 5;
  fixture.player.events.hongyun.draws = 49;
  fixture.player.events.hongyun.pity = 49;
  const validChooser = page.waitForEvent('filechooser');
  await click('importPicker');
  await (await validChooser).setFiles({ name: 'controlled-palette-xss-pity-fixture.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fixture)) });
  await page.locator('#dialog-title').filter({ hasText: '导入存档' }).waitFor();
  assert.equal((await state()).player.name, '云归');
  await click('confirmModal');
  assert.equal((await state()).player.name, '<b>test</b>');
  assert.equal(await page.locator('.hud-identity strong b').count(), 0);
  await click('page', '[data-id="bag"]');
  await click('bagTab', '[data-id="items"]');
  const openingMilestones = page.locator('.economy-fold[data-fold="物品开启累计礼"]');
  if (!await openingMilestones.evaluate((fold) => fold.open)) await openingMilestones.locator('summary').click();
  for (const id of ['chest5', 'zongzi5']) {
    const milestone = MILESTONES.find((entry) => entry.id === id);
    const beforeClaim = await state();
    assert.ok(await openingMilestones.locator(`[data-action="activityClaim"][data-id="${id}"]`).isEnabled());
    await click('activityClaim', `[data-id="${id}"]`);
    await page.locator('#dialog-title').filter({ hasText: '奖励已领取' }).waitFor();
    const afterClaim = await state();
    const expected = structuredClone(beforeClaim.player);
    expected.events.milestones.push(id);
    for (const reward of milestone.rewards) {
      if (reward.type === 'item') expected.items[reward.itemId] = (expected.items[reward.itemId] || 0) + reward.quantity;
      else expected.wallet[reward.type] += reward.quantity;
    }
    assert.deepEqual(afterClaim.player, expected, `${id}: same claim API must award exactly the bag milestone, without changing opening/draw counters or history`);
    await click('closeModal');
    await disabledNoCharge(openingMilestones.locator(`[data-action="activityClaim"][data-id="${id}"]`), afterClaim, `${id} cannot be claimed twice`);
  }
  assert.equal(await page.locator('.page .codex-item[data-item="bigZongzi"]').count(), 1, 'Claimed opening reward must appear as a real owned item');
  await click('bagTab', '[data-id="equipment"]');
  for (const it of palette) {
    await nameColor(page.locator('.item-card').filter({ has: page.locator(`[data-action="equipmentDetail"][data-id="${it.uid}"]`) }).locator('h3 .equipment-name'), it);
  }
  assert.equal(await page.locator('.equipment-name b').count(), 0);
  await nameColor(page.locator('.item-card .equipment-name').filter({ hasText: legacyXss.name }), legacyXss);
  await nameColor(page.locator('.item-card .equipment-name').filter({ hasText: verifiedColor.name }), verifiedColor);
  assert.equal(await page.locator('[class*="quality-"]').count(), 0, 'No q-driven name, icon or border classes');
  await click('equipmentDetail', `[data-id="${legacyXss.uid}"]`);
  assert.equal(await renderedName(page.locator('#modal .modal-body > h3 .equipment-name').first()), legacyXss.name);
  assert.equal(await page.locator('#modal .equipment-name b').count(), 0);
  await click('closeModal');
  await screenshot('desktop-equipment-colors.png');
  for (const it of palette) {
    await click('equipmentDetail', `[data-id="${it.uid}"]`);
    await nameColor(page.locator('#modal h3 .equipment-name'), it);
    assert.match(await page.locator('.modal-body').innerText(), new RegExp(`${it.grade}品`));
    await click('closeModal');
    await click('equip', `[data-id="${it.uid}"]`);
    await click('page', '[data-id="character"]');
    await nameColor(page.locator('.equip-slot[data-id="weapon"] .equipment-name'), it);
    await click('equipped', '[data-id="weapon"]');
    await click('equipmentAction', '[data-op="bind"]');
    await nameColor(page.locator('#modal .equipment-name'), it);
    await click('closeModal');
    await click('page', '[data-id="town"]');
    await click('townTab', '[data-id="refine"]');
    await nameColor(page.locator('.item-card .equipment-name').filter({ hasText: it.name }), it);
    await click('refineConfirm', '[data-id="weapon"]');
    await nameColor(page.locator('#modal .equipment-name'), it);
    await click('closeModal');
    await click('page', '[data-id="bag"]');
  }
  await click('page', '[data-id="town"]');
  await click('townTab', '[data-id="equipment"]');
  await nameColor(page.locator('.named-shop-card h3 .equipment-name').first());
  await click('page', '[data-id="activities"]');
  await nameColor(page.locator('.orbit-prize .equipment-name'));
  const delivered = [];
  for (const [random, rarity] of [[0.01, 'legendary'], [0.8, 'rare']]) {
    await page.evaluate((value) => { window.paletteRandom = Math.random; Math.random = () => value; }, random);
    try { await click('treasureDraw', '[data-count="1"]'); }
    finally { await page.evaluate(() => { Math.random = window.paletteRandom; delete window.paletteRandom; }); }
    const result = (await state()).player.drawHistory.at(-1);
    assert.equal(result.rarity, rarity, 'Prize tier is independent from equipment q and name color');
    const reward = result.rewards.find((entry) => entry.type === 'equip');
    assert.ok(reward?.equipment && matchesNamedEquip(reward.equipment));
    assert.equal(reward.equipment.q, 0);
    delivered.push(reward.equipment);
    await nameColor(page.locator('#modal .real-prize > strong .equipment-name'), reward.equipment);
    await nameColor(page.locator('#modal .reward-line .equipment-name'), reward.equipment);
    assert.equal(await renderedName(page.locator('#modal .reward-line .equipment-name')), reward.equipment.name);
    await click('closeModal');
    await nameColor(page.locator('.delivery-showcase .reward-line .equipment-name'), reward.equipment);
  }
  assert.equal(await page.locator('.treasure-progress [data-draw-total]').innerText(), '51');
  assert.equal((await state()).player.events.hongyun.pity, 1);
  for (const id of ['draw10', 'draw50']) {
    const beforeClaim = await state();
    await click('activityClaim', `[data-id="${id}"]`);
    const afterClaim = await state();
    assert.ok(afterClaim.player.events.milestones.includes(id));
    assert.deepEqual(afterClaim.player.events.hongyun, beforeClaim.player.events.hongyun);
    assert.ok(await page.locator(`.treasure-progress [data-action="activityClaim"][data-id="${id}"]`).isDisabled());
    if (id === 'draw10') {
      assert.equal(afterClaim.player.wallet.boundYuanbao, beforeClaim.player.wallet.boundYuanbao + 20);
      assert.equal(afterClaim.player.sp, beforeClaim.player.sp + 1000);
    } else {
      assert.equal(afterClaim.player.wallet.boundYuanbao, beforeClaim.player.wallet.boundYuanbao + 50);
      assert.equal(afterClaim.player.items.gemAtkLevel2, (beforeClaim.player.items.gemAtkLevel2 || 0) + 1);
    }
    await click('closeModal');
  }
  await screenshot('desktop-activities-progress.png');
  const claimedCheckpoint = await state();
  await page.reload(); await settled();
  assert.deepEqual(await state(), claimedCheckpoint);
  await click('page', '[data-id="activities"]');
  assert.ok(await page.locator('.treasure-progress [data-id="draw50"]').isDisabled());
  for (const width of [1080, 850, 761]) { await page.setViewportSize({ width, height: 1000 }); await noOverflow(); }
  await page.setViewportSize({ width: 1440, height: 1000 });
  const treasureHistory = page.locator('.treasure-page .economy-fold[data-fold^="逐次真实记录"]');
  await treasureHistory.locator('summary').click();
  const hongyunRecords = (await state()).player.drawHistory.filter((entry) => entry.poolId === 'hongyun');
  assert.equal(await treasureHistory.locator('.economy-history article').count(), hongyunRecords.length);
  for (const entry of hongyunRecords) assert.equal(await treasureHistory.locator('.economy-history article small').filter({ hasText: entry.id }).count(), 1);
  assert.doesNotMatch(await treasureHistory.innerText(), /青铜宝箱|黄金宝箱|幸运粽子|大粽子/);
  for (const item of delivered) await nameColor(page.locator('.economy-history .reward-line .equipment-name').filter({ hasText: item.name }), item);
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await click('page', '[data-id="bag"]', '.mobile-nav');
    await settled(); await noOverflow();
    for (const it of [...palette.slice(0, 3), verifiedColor]) await nameColor(page.locator('.item-card').filter({ has: page.locator(`[data-action="equipmentDetail"][data-id="${it.uid}"]`) }).locator('h3 .equipment-name'), it);
    await screenshot(`mobile-${width}-equipment-colors.png`);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await click('page', '[data-id="world"]');
  await click('travel', '[data-id="h_f1"]');
  await click('hunt', '[data-index="0"]');
  await click('turn', '[data-id="defend"]');
  const battleCheckpoint = (await state()).battle;
  await page.reload(); await page.locator('.battle-controls').waitFor();
  assert.deepEqual((await state()).battle, battleCheckpoint);
  await click('auto');
  await page.locator('.battle-result').waitFor({ timeout: 30000 });
  assert.match(await page.locator('.battle-result').innerText(), /此战告捷/);
  await screenshot('desktop-battle.png');
  await click('leaveBattle');
  await page.setViewportSize({ width: 390, height: 844 });
  await noOverflow();
  await screenshot('mobile-world.png');
  for (const id of ['quests', 'character', 'bag', 'skills', 'cult', 'town', 'mall', 'activities', 'guide']) {
    await click('page', `[data-id="${id}"]`, '.mobile-nav');
    await settled(); await noOverflow();
    if (id === 'mall' || id === 'activities') {
      await page.locator(id === 'mall' ? '.mall-page' : '.treasure-page').waitFor();
      await screenshot(`mobile-${id}.png`);
    }
  }
  await page.setViewportSize({ width: 320, height: 740 });
  for (const id of ['mall', 'activities']) {
    await click('page', `[data-id="${id}"]`, '.mobile-nav');
    await page.locator(id === 'mall' ? '.mall-page' : '.treasure-page').waitFor();
    await noOverflow(); await screenshot(`mobile-320-${id}.png`);
  }
  await noOverflow();
  await click('page', '[data-id="world"]', '.mobile-nav');
  const beforeAtlas = await state();
  await click('map');
  assert.equal(await page.locator('#modal.atlas-modal, #modal .atlas-modal').count(), 1);
  assert.equal(await page.locator('#modal [data-action="atlasLayer"]').count(), 3);
  assert.equal(await page.locator('#modal .atlas-canvas.mainland').count(), 1);
  await noOverflow();
  assert.deepEqual(await state(), beforeAtlas, 'Layered atlas browsing must not mutate the save');
  await page.keyboard.press('Escape');
  assert.ok(await page.locator('#modal').evaluate((el) => el.classList.contains('hidden')));
  assert.equal((await state()).player.name, '<b>test</b>', 'No new-character rebuild is used on an existing save');
  assert.deepEqual(errors, []);
  console.log('PASS browser: five races, creation, combat, level, points, quests, shop, forge, equipment, refine cancel, bounty, autosave, export/import, XSS escaping, auto combat, 1440/390/320px layouts, modal, fresh-context mobile creation; production-data-counted mall, virtual-wallet limits, secret treasure with Hongyun-only history, two chests and two zongzi pools opened from actual owned bag cards, disabled unowned/insufficient-count details without charges, purchase-result bag routing, consumed-card removal, separate opening history, daily mall subsidy, bag opening milestone claims, charm/cosmetic, explicit punch/compatible patk socket/unsocket, HP-gem rejection, new gear no reroll/+5, bind cancel, active battle reload, ten mobile navigation entries; source-evidenced/unknown name colors in bag/detail/equipped/refine/shop/confirm, actual rare/legendary equipment delivery and history, 390/320px equipment palette; visible left cumulative rewards, insufficient-count disable, actual 10/50 milestone delivery, legendary reset independent from cumulative draws, claim persistence, 1080/850/761px treasure layouts.');
  console.log(`Screenshots: ${out}`);
} finally { await context.close(); await browser.close(); }
