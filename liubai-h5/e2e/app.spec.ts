import { expect, test } from '@playwright/test'
import type { Page, TestInfo } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { fileURLToPath } from 'node:url'

const key = 'liubai-private-v1'
const tabs = ['今天', '吃什么', '家务账', '心里话']
const tab = (page: Page, name: string) => page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name, exact: true })
const stored = (page: Page) => page.evaluate(storageKey => JSON.parse(localStorage.getItem(storageKey) ?? 'null'), key)
async function axe(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  expect(results.violations.map(item => ({ id: item.id, nodes: item.nodes.map(node => node.target) }))).toEqual([])
}
async function mockClipboard(page: Page) {
  await page.addInitScript(() => {
    const copied: string[] = []
    ;(window as unknown as { copied: string[] }).copied = copied
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text: string) => { copied.push(text) } } })
  })
}
const copiedTexts = (page: Page) => page.evaluate(() => (window as unknown as { copied: string[] }).copied)

const externalRequests = new WeakMap<Page, string[]>()
const isLocalRequest = (value: string) => {
  const url = new URL(value)
  return url.origin === 'http://127.0.0.1:5186' || url.protocol === 'data:'
}

const atHour = (hour: number, minute = 0) => { const date = new Date(); date.setHours(hour, minute, 0, 0); return date }

test.beforeEach(async ({ page, context }) => {
  const external: string[] = []
  externalRequests.set(page, external)
  context.on('request', request => { if (!isLocalRequest(request.url())) external.push(request.url()) })
  await context.route('**/*', route => isLocalRequest(route.request().url()) ? route.continue() : route.abort('blockedbyclient'))
  await page.clock.install({ time: atHour(18, 30) })
  await page.goto('/')
})
test.afterEach(async ({ page }) => {
  expect(externalRequests.get(page), '不应发起外部请求（所有外部请求均被拦截）').toEqual([])
})

test('四页不横向溢出，首页四个入口首屏可见', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const widths = testInfo.project.name === 'mobile' ? [390, 320] : [1440]
  for (const width of widths) {
    if (width !== 1440) await page.setViewportSize({ width, height: width === 320 ? 640 : 664 })
    for (const name of tabs) {
      await tab(page, name).click()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      await page.screenshot({ path: `artifacts/${testInfo.project.name}-${width}-${name}.png`, fullPage: true, animations: 'disabled' })
    }
    await tab(page, '今天').click()
    const navTop = await page.getByRole('navigation', { name: '主导航' }).evaluate(element => element.getBoundingClientRect().top)
    const rows = await page.locator('.index-row').evaluateAll(elements => elements.map(element => element.getBoundingClientRect().bottom))
    expect(rows).toHaveLength(4)
    if (width !== 320) expect(rows.every(bottom => bottom <= navTop)).toBe(true)
  }
  expect(errors).toEqual([])
})

test('今晚吃什么：进来就有菜，两下定好，清单可划掉并复制', async ({ page }) => {
  await mockClipboard(page)
  await page.reload()
  await page.locator('.index-row', { hasText: '今晚吃什么' }).click()
  const menu = page.getByRole('region', { name: '替你挑的菜' })
  await expect(menu.locator('.dish')).toHaveCount(3)
  const first = await menu.locator('.dish-name').first().innerText()
  await menu.locator('.dish').first().getByRole('button', { name: /^换掉/ }).click()
  await expect(menu.locator('.dish-name').first()).not.toHaveText(first)
  await page.getByRole('button', { name: '一锅一素' }).click()
  await expect(menu.locator('.dish')).toHaveCount(2)
  await expect(menu.locator('.dish-kind').first()).toHaveText('一锅')
  await page.getByRole('button', { name: '荤素汤' }).click()
  const skipped = (await menu.locator('.dish-name').nth(2).innerText()).split('\n')[0]
  await menu.locator('.dish').nth(2).getByRole('button', { name: /^以后不吃/ }).click()
  await expect(menu.locator('.dish-name', { hasText: skipped })).toHaveCount(0)
  await page.getByRole('button', { name: '就吃这些' }).click()
  await expect(page.getByRole('region', { name: '今晚的菜' })).toBeVisible()
  const data = await stored(page)
  expect(data.meals).toHaveLength(1)
  expect(data.meals[0].dishIds).toHaveLength(3)
  expect(data.skipDishes).toHaveLength(1)
  const items = page.locator('.shop-list button')
  const count = await items.count()
  expect(count).toBeGreaterThan(1)
  await items.first().click()
  await expect(items.first()).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: `复制要买的 ${count - 1} 样` }).click()
  await expect(page.getByRole('button', { name: '已复制，可以发给他下班带' })).toBeVisible()
  const [text] = await copiedTexts(page)
  expect(text.startsWith('买菜：')).toBe(true)
  expect(text.split('、')).toHaveLength(count - 1)
  await tab(page, '今天').click()
  await expect(page.locator('.index-row', { hasText: '今晚吃什么' })).toContainText('看清单')
  await page.reload()
  await tab(page, '吃什么').click()
  await expect(page.getByRole('region', { name: '今晚的菜' })).toBeVisible()
  await page.getByText(/不吃的菜/).click()
  await page.getByRole('button', { name: `恢复推荐${skipped}` }).click()
  expect((await stored(page)).skipDishes).toEqual([])
})

test('全部换一换：整套换菜、吃法不变、清单跟着换，不自动定菜', async ({ page }) => {
  await mockClipboard(page)
  await page.reload()
  await tab(page, '吃什么').click()
  const menu = page.getByRole('region', { name: '替你挑的菜' })
  const allSwap = menu.getByRole('button', { name: '全部换一换', exact: true })
  await expect(allSwap).toBeEnabled()
  const initial = await menu.locator('.dish-name').allTextContents()
  await allSwap.click()
  const changed = await menu.locator('.dish-name').allTextContents()
  expect(changed).toHaveLength(3)
  expect(changed.every((name, index) => name !== initial[index])).toBe(true)
  await expect(menu.locator('.dish-kind')).toHaveText(['荤', '素', '汤'])
  expect(await stored(page)).toBeNull()
  const groceries = await page.locator('.shop-list button').allTextContents()
  await page.getByRole('button', { name: /^复制要买的/ }).click()
  expect((await copiedTexts(page))[0]).toBe(`买菜：${groceries.join('、')}`)
  await allSwap.click()
  await expect(page.getByRole('button', { name: '已复制，可以发给他下班带' })).toHaveCount(0)

  await page.getByRole('button', { name: '一锅一素', exact: true }).click()
  const easy = await menu.locator('.dish-name').allTextContents()
  await allSwap.click()
  const nextEasy = await menu.locator('.dish-name').allTextContents()
  expect(nextEasy).toHaveLength(2)
  expect(nextEasy.every((name, index) => name !== easy[index])).toBe(true)
  await expect(menu.locator('.dish-kind')).toHaveText(['一锅', '素'])
  await expect(page.getByRole('button', { name: '一锅一素', exact: true })).toHaveAttribute('aria-pressed', 'true')

  const skipped = nextEasy[0].split('约')[0].trim()
  await menu.locator('.dish').first().getByRole('button', { name: /^以后不吃/ }).click()
  const raw = await page.evaluate(storageKey => localStorage.getItem(storageKey), key)
  for (let count = 0; count < 12; count += 1) {
    await allSwap.click()
    expect(await menu.locator('.dish-name').first().textContent()).not.toContain(skipped)
  }
  expect(await page.evaluate(storageKey => localStorage.getItem(storageKey), key)).toBe(raw)
  const chosen = await menu.locator('.dish-name').allTextContents()
  await menu.getByRole('button', { name: '就吃这些', exact: true }).click()
  await expect(page.getByRole('region', { name: '今晚的菜' }).locator('.dish-name')).toHaveText(chosen)
  expect((await stored(page)).meals[0].dishIds).toHaveLength(2)
  await expect(allSwap).toHaveCount(0)
})

test('早午晚：按时间默认哪一顿，点一下切换，晚饭吃法记住，各顿分开定', async ({ page }, testInfo) => {
  await page.clock.setSystemTime(atHour(7, 30))
  await page.reload()
  await expect(page.locator('.index-row', { hasText: '今早吃什么' })).toBeVisible()
  await tab(page, '吃什么').click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('今早吃什么')
  const meals = page.getByRole('group', { name: '哪一顿' })
  await expect(meals.getByRole('button', { name: '早饭' })).toHaveAttribute('aria-pressed', 'true')
  const menu = page.getByRole('region', { name: '替你挑的菜' })
  await expect(menu.locator('.dish-kind')).toHaveText(['早'])
  await expect(page.getByRole('group', { name: '今晚怎么吃' })).toHaveCount(0)
  await expect(menu.getByRole('button', { name: '全部换一换' })).toHaveCount(0)
  const breakfast = (await menu.locator('.dish-name').innerText()).split('\n')[0]
  await menu.getByRole('button', { name: '就吃这个', exact: true }).click()
  await expect(page.getByRole('region', { name: '今早的菜' })).toContainText('今早就吃这个。')
  const day = await page.evaluate(() => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` })
  expect((await stored(page)).meals).toEqual([{ day, dishIds: [expect.any(String)], meal: 'breakfast' }])

  await meals.getByRole('button', { name: '午饭' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('中午吃什么')
  await expect(menu.locator('.dish-kind')).toHaveText(['一锅'])
  for (let count = 0; count < 6; count += 1) {
    expect(Number((await menu.locator('.dish-name small').innerText()).match(/\d+/)![0])).toBeLessThanOrEqual(10)
    await menu.getByRole('button', { name: /^换掉/ }).click()
  }

  await meals.getByRole('button', { name: '晚饭' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('今晚吃什么')
  const styles = page.getByRole('group', { name: '今晚怎么吃' })
  await expect(styles.getByRole('button')).toHaveText(['荤素汤', '荤素', '一锅一素', '一个菜'])
  await expect(styles.getByRole('button', { name: '荤素汤' })).toHaveAttribute('aria-pressed', 'true')
  await styles.getByRole('button', { name: '荤素', exact: true }).click()
  await expect(menu.locator('.dish-kind')).toHaveText(['荤', '素'])
  await styles.getByRole('button', { name: '一个菜' }).click()
  await expect(menu.locator('.dish-kind')).toHaveText(['一锅'])
  await expect(menu.getByRole('button', { name: '全部换一换' })).toHaveCount(0)
  expect((await stored(page)).dinnerStyle).toBe('one')
  if (testInfo.project.name === 'mobile') {
    await page.setViewportSize({ width: 320, height: 640 })
    const heights = await styles.getByRole('button').evaluateAll(elements => elements.map(element => element.getBoundingClientRect().height))
    expect(heights.every(height => height >= 44 && height < 52)).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: 'artifacts/rebuild/meal-times-320.png' })
  }

  await page.reload()
  await tab(page, '吃什么').click()
  await expect(page.getByRole('region', { name: '今早的菜' })).toContainText(breakfast)
  await meals.getByRole('button', { name: '晚饭' }).click()
  await expect(styles.getByRole('button', { name: '一个菜' })).toHaveAttribute('aria-pressed', 'true')
  await menu.getByRole('button', { name: '就吃这个', exact: true }).click()
  await expect(page.getByRole('region', { name: '今晚的菜' })).toContainText('今晚就吃这个。')
  const saved = (await stored(page)).meals
  expect(saved).toHaveLength(2)
  expect(saved.find((meal: { meal?: string }) => !meal.meal).dishIds).toHaveLength(1)
  await meals.getByRole('button', { name: '早饭' }).click()
  await expect(page.getByRole('region', { name: '今早的菜' })).toContainText(breakfast)
})

test('家务账：三下得到可发送的话，改过的话不被覆盖，不自动发送', async ({ page }) => {
  await mockClipboard(page)
  await page.reload()
  await page.locator('.index-row', { hasText: '家务账' }).click()
  const tally = page.getByRole('region', { name: '每周大约用时' })
  await expect(tally).toContainText('他0')
  await page.getByRole('button', { name: '按耗时帮我挑 3 件' }).click()
  const give = page.locator('.give-list li')
  await expect(give).toHaveCount(3)
  await expect(give.first()).toContainText('做晚饭')
  const message = page.getByRole('textbox', { name: '发给他的话' })
  await expect(message).toHaveValue(/完整接手这几件[\s\S]*• 做晚饭（每天）/)
  await page.getByRole('button', { name: '复制这段话' }).click()
  await expect(page.getByRole('button', { name: '已复制，去微信粘贴' })).toBeVisible()
  expect((await copiedTexts(page))[0]).toContain('• 做晚饭（每天）')

  await page.getByRole('button', { name: '做晚饭：我在做，点一下改成他' }).click()
  await expect(tally).toContainText('他7')
  await expect(give.filter({ hasText: '做晚饭' })).toHaveCount(0)
  await page.getByRole('group', { name: '留给自己的时间' }).getByRole('button', { name: '周六上午' }).click()
  await expect(message).toHaveValue(/每周六上午留给自己/)

  await message.fill('老公，我想跟你商量件事。')
  await page.getByRole('button', { name: '洗澡、哄睡不交了' }).click()
  await expect(message).toHaveValue('老公，我想跟你商量件事。')
  await page.getByRole('button', { name: '按上面的选择重写' }).click()
  await expect(message).toHaveValue(/^我按常见时长粗算/)

  await page.getByLabel('还有别的家务').fill('倒垃圾')
  await page.getByRole('button', { name: '加上' }).click()
  await expect(page.locator('.chore', { hasText: '倒垃圾' })).toBeVisible()
  await page.getByRole('button', { name: '把倒垃圾交给他' }).click()
  await expect(message).toHaveValue(/• 倒垃圾（每周）/)
  const data = await stored(page)
  expect(data.restSlot).toBe('sat-am')
  expect(data.tasks).toMatchObject([{ title: '倒垃圾', owner: '我' }])
  expect(data.ledger.find((entry: { id: string }) => entry.id === 'dinner')).toMatchObject({ doer: '他', handOver: false })
  expect(JSON.stringify(data)).not.toContain('老公，我想')
})

test('喘口气：点开就开始，可暂停继续，一分钟后结束', async ({ page }) => {
  await page.reload()
  await page.locator('.index-row', { hasText: '喘口气' }).click()
  const sheet = page.getByRole('dialog', { name: '喘口气' })
  await expect(sheet.getByText('慢慢吸气')).toBeVisible()
  await page.clock.fastForward(5000)
  await expect(sheet.getByText('0:55')).toBeVisible()
  await expect(sheet.getByText('慢慢呼气，长一点')).toBeVisible()
  await sheet.getByRole('button', { name: '暂停' }).click()
  await page.clock.fastForward(10000)
  await expect(sheet.getByText('0:55')).toBeVisible()
  await sheet.getByRole('button', { name: '继续' }).click()
  await page.clock.fastForward(56000)
  await expect(sheet.getByText('一分钟到了。回去之前，肩膀再放松一点。')).toBeVisible()
  await sheet.getByRole('button', { name: '回去' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.locator('.index-row', { hasText: '喘口气' }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('心里话：手动保存、空内容提示、导出、两步清除', async ({ page }) => {
  await page.locator('.index-row', { hasText: '心里话' }).click()
  const note = page.getByLabel('写下心里话')
  await expect(note).toBeFocused()
  await page.getByRole('button', { name: '留下这页' }).click()
  await expect(page.getByRole('alert')).toHaveText('先写一点，再留下。')
  await note.fill('今天孩子又哭了一早上。')
  expect(await stored(page)).toBeNull()
  await page.getByRole('button', { name: '留下这页' }).click()
  await expect(page.getByRole('status').filter({ hasText: '留下了' })).toBeVisible()
  await expect(page.locator('.past li')).toContainText('今天孩子又哭了一早上。')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出', exact: true }).click()
  expect((await download).suggestedFilename()).toMatch(/^留白-心里话-\d{4}-\d{2}-\d{2}\.txt$/)
  await page.getByRole('button', { name: '记录与清除' }).click()
  await page.getByRole('button', { name: '清除本机全部记录' }).click()
  await page.getByRole('button', { name: '取消，保留记录' }).click()
  expect((await stored(page)).notes).toHaveLength(1)
  await page.getByRole('button', { name: '清除本机全部记录' }).click()
  await page.getByRole('button', { name: '确认清除全部记录' }).click()
  expect(await stored(page)).toBeNull()
  await expect(page.locator('.past li')).toHaveCount(0)
})

test('旧版记录完整保留：旧分工映射进家务账，旧日记可见，存储原样不变', async ({ page }) => {
  const raw = JSON.stringify({
    checkIns: [{ id: 'c1', mood: 'lonely', date: '2026-11-10T09:00:00.000Z' }],
    notes: [{ id: 'n1', text: '那天没说出口的话', tag: '想说没说的', date: '2026-11-11T09:00:00.000Z' }],
    tasks: [{ id: 't1', title: '接孩子放学', owner: '伴侣', when: '周五下午' }, { id: 't2', title: '修水龙头', owner: '一起', when: '' }],
    savedIds: ['tea'],
  })
  await page.evaluate(([storageKey, value]) => localStorage.setItem(storageKey, value), [key, raw])
  await page.reload()
  await tab(page, '家务账').click()
  await expect(page.locator('.give-list li')).toHaveCount(1)
  await expect(page.locator('.give-list li')).toContainText('接孩子放学')
  await expect(page.getByRole('button', { name: '修水龙头：一起在做，点一下改成我' })).toBeVisible()
  await tab(page, '心里话').click()
  await expect(page.locator('.past')).toContainText('那天没说出口的话')
  await expect(page.locator('.past')).toContainText('那天空落落')
  expect(await page.evaluate(storageKey => localStorage.getItem(storageKey), key)).toBe(raw)
})

test('存储不可用时提示，原有存储不被覆盖', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new Error('storage blocked') }
    Storage.prototype.setItem = () => { throw new Error('storage blocked') }
  })
  await page.reload()
  await expect(page.getByRole('alert')).toContainText('原有记录不会被覆盖')
  await tab(page, '心里话').click()
  await page.getByLabel('写下心里话').fill('先放这里')
  await page.getByRole('button', { name: '留下这页' }).click()
  await expect(page.getByRole('status').filter({ hasText: '关掉前记得导出' })).toBeVisible()
})

test('没有任何外部请求，各页与弹窗无障碍检查通过', async ({ page }) => {
  const external: string[] = []
  page.on('request', request => { const url = request.url(); if (!url.startsWith('http://127.0.0.1:5186') && !url.startsWith('data:')) external.push(url) })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
  for (const name of tabs) { await tab(page, name).click(); await axe(page) }
  await tab(page, '家务账').click()
  await page.getByRole('button', { name: '按耗时帮我挑 3 件' }).click()
  await axe(page)
  for (const opener of ['撑不住时', '记录与清除']) {
    await page.getByRole('button', { name: opener }).click()
    await axe(page)
    await page.getByRole('button', { name: '关闭弹窗' }).click()
  }
  await tab(page, '今天').click()
  await page.locator('.index-row', { hasText: '喘口气' }).click()
  await axe(page)
  expect(external).toEqual([])
})

test('手机端文字不小于 12px，可点区域不小于 44px', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile')
  for (const name of tabs) {
    await tab(page, name).click()
    if (name === '家务账') await page.getByRole('button', { name: '按耗时帮我挑 3 件' }).click()
    const problems = await page.evaluate(() => {
      const out: string[] = []
      for (const element of document.querySelectorAll<HTMLElement>('body *')) {
        const rect = element.getBoundingClientRect()
        if (!rect.width || !rect.height) continue
        const style = getComputedStyle(element)
        const hasText = [...element.childNodes].some(node => node.nodeType === 3 && node.textContent!.trim())
        if (hasText && parseFloat(style.fontSize) < 12) out.push(`字小：${element.textContent!.trim().slice(0, 12)} ${style.fontSize}`)
        if (element.matches('button, a, input, textarea, summary') && (rect.height < 44 || rect.width < 44)) out.push(`点小：${element.textContent!.trim().slice(0, 12) || element.getAttribute('aria-label')} ${Math.round(rect.width)}×${Math.round(rect.height)}`)
        if (element.matches('input, textarea') && parseFloat(style.fontSize) < 16) out.push(`输入框字小：${element.id}`)
      }
      return out
    })
    expect(problems, name).toEqual([])
  }
})

const douyinUrl = 'https://v.douyin.com/test-food/'
const xhsUrl = 'https://xhslink.com/test-food'
const douyinShare = `3.21 复制打开抖音，看看【今晚吃点好的】的作品\n${douyinUrl}。 11/18 想留给周末做`
const xhsShare = `这碗热汤想做给家人吃\n${xhsUrl}，复制本条信息，打开小红书查看！`
const collection = (page: Page) => page.getByRole('region', { name: '想吃收藏夹' })
const shareDialog = (page: Page) => page.getByRole('dialog', { name: '收藏想吃的', exact: true })
const shareToast = (page: Page, message: string) => page.getByRole('status').filter({ hasText: message })
const rawStored = (page: Page) => page.evaluate(storageKey => localStorage.getItem(storageKey), key)
const shareScreenshot = (page: Page, testInfo: TestInfo, state: string) => page.screenshot({
  path: fileURLToPath(new URL(`../artifacts/rebuild/share-test-${testInfo.project.name}-${state}.png`, import.meta.url)),
  fullPage: true,
  animations: 'disabled',
})
async function openShare(page: Page) {
  await tab(page, '吃什么').click()
  await page.getByRole('button', { name: '粘贴想吃的', exact: true }).click()
  await expect(shareDialog(page)).toBeVisible()
  return shareDialog(page)
}
async function showCollection(page: Page) {
  if (!await collection(page).isVisible()) await page.getByRole('button', { name: /^想吃收藏夹 · / }).click()
  await expect(collection(page)).toBeVisible()
}
async function saveShare(page: Page, text: string, message = '收藏好了，只在这台手机上') {
  const dialog = await openShare(page)
  await dialog.getByRole('textbox', { name: '分享内容', exact: true }).fill(text)
  await dialog.getByRole('button', { name: '保存收藏', exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(shareToast(page, message)).toBeVisible()
  await expect(collection(page)).toBeVisible()
}
async function expectNoShareShopping(page: Page) {
  await expect(page.getByRole('region', { name: '今晚想吃的' })).toBeVisible()
  await expect(page.getByRole('region', { name: '今晚的菜', exact: true })).toBeHidden()
  await expect(page.getByRole('region', { name: '替你挑的菜' })).toBeHidden()
  await expect(page.locator('.shop-list')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^复制要买的/ })).toHaveCount(0)
  await expect(page.getByRole('region', { name: '今晚想吃的' }).locator('.dish')).toHaveCount(0)
}
async function expectShareMobileSize(page: Page, state: string) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${state}：320px 无横向溢出`).toBe(true)
  const small = await page.locator('button, a, input, textarea, summary').evaluateAll(elements => elements.flatMap(element => {
    const rect = element.getBoundingClientRect()
    const style = getComputedStyle(element)
    if (!rect.width || !rect.height || style.visibility === 'hidden') return []
    return rect.width < 44 || rect.height < 44
      ? [`${element.getAttribute('aria-label') || element.textContent?.trim().slice(0, 30) || element.tagName} ${rect.width}×${rect.height}`]
      : []
  }))
  expect(small, `${state}：可点区域至少 44×44px`).toEqual([])
}

test.describe('想吃分享收藏', () => {
  test.beforeEach(async ({ page }) => { await page.emulateMedia({ reducedMotion: 'reduce' }) })
  test.afterEach(async ({ page }, testInfo) => {
    await shareScreenshot(page, testInfo, `${testInfo.line}-${testInfo.testId.replace(/[^a-zA-Z0-9-]/g, '-')}-${testInfo.status}`)
  })

  for (const [name, text, url] of [['抖音', `  ${douyinShare}  `, douyinUrl], ['小红书', xhsShare, xhsUrl]]) {
    test(`${name}：保存前不写存储，保存与刷新后原文及 URL 完整保留`, async ({ page, context }, testInfo) => {
      expect(await rawStored(page)).toBeNull()
      const dialog = await openShare(page)
      await axe(page)
      const textbox = dialog.getByRole('textbox', { name: '分享内容', exact: true })
      await expect(textbox).toHaveAttribute('maxlength', '4000')
      await textbox.fill(text)
      await expect(textbox).toHaveValue(text)
      expect(await rawStored(page)).toBeNull()
      await shareScreenshot(page, testInfo, `${name}-dialog`)
      await dialog.getByRole('button', { name: '保存收藏', exact: true }).click()
      await expect(dialog).toBeHidden()
      await expect(shareToast(page, '收藏好了，只在这台手机上')).toBeVisible()
      const list = collection(page)
      await expect(list).toBeVisible()
      await expect(list.locator('.saved-food')).toHaveCount(1)
      expect(await list.locator('.share-text').textContent()).toBe(text)
      const link = list.getByRole('link', { name: '打开原内容', exact: true })
      await expect(link).toHaveAttribute('href', url)
      await expect(link).toHaveAttribute('target', '_blank')
      expect((await link.getAttribute('rel'))?.split(/\s+/)).toEqual(expect.arrayContaining(['noopener', 'noreferrer']))
      const data = await stored(page)
      expect(data.savedFoods).toHaveLength(1)
      expect(data.savedFoods[0]).toEqual({ id: expect.any(String), text, url, date: expect.any(String) })
      expect(data.savedFoods[0].id.length).toBeGreaterThan(0)
      expect(Number.isFinite(Date.parse(data.savedFoods[0].date))).toBe(true)
      expect(data.meals).toEqual([])
      await axe(page)
      await shareScreenshot(page, testInfo, `${name}-collection`)
      const raw = await rawStored(page)
      await page.reload()
      await tab(page, '吃什么').click()
      await showCollection(page)
      await expect(collection(page).locator('.saved-food')).toHaveCount(1)
      expect(await collection(page).locator('.share-text').textContent()).toBe(text)
      await expect(collection(page).getByRole('link', { name: '打开原内容', exact: true })).toHaveAttribute('href', url)
      expect(await rawStored(page)).toBe(raw)
      expect(context.pages()).toHaveLength(1)
    })
  }

  test('相同规范化 URL 提示已收藏，不重复或覆盖第一条原文', async ({ page }) => {
    await saveShare(page, douyinShare)
    const raw = await rawStored(page)
    const dialog = await openShare(page)
    await dialog.getByRole('textbox', { name: '分享内容' }).fill('另一段想吃的原话 HTTPS://V.DOUYIN.COM:443/test-food/。')
    expect(await rawStored(page)).toBe(raw)
    await dialog.getByRole('button', { name: '保存收藏', exact: true }).click()
    await expect(shareToast(page, '已经收藏过了，不用再存。')).toBeVisible()
    await expect(collection(page).locator('.saved-food')).toHaveCount(1)
    expect(await collection(page).locator('.share-text').textContent()).toBe(douyinShare)
    expect(await rawStored(page)).toBe(raw)
    await page.reload()
    await tab(page, '吃什么').click()
    await showCollection(page)
    await expect(collection(page).locator('.saved-food')).toHaveCount(1)
  })

  test('无链接、不安全协议、无效链接及凭据提示错误且不保存', async ({ page }) => {
    const dialog = await openShare(page)
    for (const text of [
      '今晚想吃汤，没有链接',
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'file:///tmp/food.html',
      'https://',
      'https://[invalid]/food',
      'https://user:secret@v.douyin.com/test-food/',
      'https://user@xhslink.com/test-food',
    ]) {
      await dialog.getByRole('textbox', { name: '分享内容' }).fill(text)
      await dialog.getByRole('button', { name: '保存收藏', exact: true }).click()
      await expect(dialog.getByRole('alert')).toHaveText('没找到可打开的网页链接，请粘贴完整分享内容。')
      await expect(dialog).toBeVisible()
      expect(await rawStored(page), text).toBeNull()
      await expect(page.locator('.saved-food')).toHaveCount(0)
    }
    await axe(page)
  })

  test('分享原文按文字转义，不生成注入节点、不自动分析或请求原链接', async ({ page, context }) => {
    const text = `${xhsShare}\n<img src="https://v.douyin.com/injected.png" onerror="window.__shareInjected=1"><script>window.__shareInjected=1</script><a href="javascript:alert(1)">点我</a> data:text/html,evil file:///tmp/evil & 原文`
    await saveShare(page, text)
    const original = collection(page).locator('.share-text')
    expect(await original.textContent()).toBe(text)
    await expect(original.locator('img, script, a, iframe')).toHaveCount(0)
    expect(await page.evaluate(() => (window as unknown as { __shareInjected?: number }).__shareInjected)).toBeUndefined()
    const unsafe = await page.locator('a[href]').evaluateAll(elements => elements.map(element => (element as HTMLAnchorElement).href).filter(href => /^(javascript|data|file):/i.test(href)))
    expect(unsafe).toEqual([])
    await expect(collection(page).getByRole('link', { name: '打开原内容' })).toHaveAttribute('href', xhsUrl)
    expect((await stored(page)).savedFoods[0].text).toBe(text)
    expect((await stored(page)).meals).toEqual([])
    expect(context.pages()).toHaveLength(1)
    await page.reload()
    await tab(page, '吃什么').click()
    await showCollection(page)
    expect(await collection(page).locator('.share-text').textContent()).toBe(text)
    await expect(collection(page).locator('.share-text img, .share-text script, .share-text a')).toHaveCount(0)
    await axe(page)
  })

  test('今晚选中收藏及刷新保留 shareId，不虚构菜谱或购物清单；可返回推荐', async ({ page }, testInfo) => {
    await saveShare(page, douyinShare)
    const foods = (await stored(page)).savedFoods
    const item = collection(page).locator('.saved-food')
    await item.getByRole('button', { name: '今晚吃这个', exact: true }).click()
    await expect(item.getByRole('button', { name: '今晚已选', exact: true })).toBeDisabled()
    const today = await page.evaluate(() => {
      const date = new Date()
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    })
    expect((await stored(page)).meals).toEqual([{ day: today, dishIds: [], shareId: foods[0].id }])
    await expectNoShareShopping(page)
    expect(await page.getByRole('region', { name: '今晚想吃的' }).locator('.share-text').textContent()).toBe(douyinShare)
    await axe(page)
    await shareScreenshot(page, testInfo, 'selected')
    const data = await stored(page)
    await page.reload()
    await tab(page, '吃什么').click()
    await expect(collection(page).getByRole('button', { name: '今晚已选', exact: true })).toBeDisabled()
    await expectNoShareShopping(page)
    expect(await stored(page)).toEqual(data)
    await page.getByRole('button', { name: '还是替我挑菜', exact: true }).click()
    await expect(page.getByRole('region', { name: '替你挑的菜' }).locator('.dish')).toHaveCount(3)
    await expect(page.getByRole('region', { name: '今晚想吃的' })).toBeHidden()
    expect((await stored(page)).savedFoods).toEqual(foods)
    await showCollection(page)
    await expect(collection(page).getByRole('button', { name: '今晚吃这个', exact: true })).toBeEnabled()
    await page.getByRole('button', { name: '看推荐菜单', exact: true }).click()
    await expect(page.getByRole('region', { name: '替你挑的菜' }).locator('.dish')).toHaveCount(3)
    await page.getByRole('button', { name: '就吃这些', exact: true }).click()
    expect((await stored(page)).meals).toEqual([{ day: today, dishIds: expect.any(Array) }])
    expect((await stored(page)).meals[0].dishIds).toHaveLength(3)
    expect((await stored(page)).savedFoods).toEqual(foods)
    await expect(page.locator('.shop-list button').first()).toBeVisible()
    await shareScreenshot(page, testInfo, 'recommendation-restored')
  })

  test('移除收藏需确认：取消完整保留，确认只移除指定收藏及选中记录', async ({ page }, testInfo) => {
    await saveShare(page, douyinShare)
    await saveShare(page, xhsShare)
    const item = collection(page).locator('.saved-food').filter({ hasText: '复制打开抖音' })
    await item.getByRole('button', { name: '今晚吃这个', exact: true }).click()
    const data = await stored(page)
    const raw = await rawStored(page)
    const removedId = data.savedFoods.find((food: { url: string }) => food.url === douyinUrl).id
    await item.getByRole('button', { name: '移除这条收藏', exact: true }).click()
    const confirm = page.getByRole('dialog', { name: '移除收藏', exact: true })
    await expect(confirm).toBeVisible()
    expect(await rawStored(page)).toBe(raw)
    await axe(page)
    await shareScreenshot(page, testInfo, 'remove-dialog')
    await confirm.getByRole('button', { name: '保留收藏', exact: true }).click()
    await expect(confirm).toBeHidden()
    expect(await rawStored(page)).toBe(raw)
    await expect(collection(page).locator('.saved-food')).toHaveCount(2)
    await expectNoShareShopping(page)
    await item.getByRole('button', { name: '移除这条收藏', exact: true }).click()
    await confirm.getByRole('button', { name: '确认移除收藏', exact: true }).click()
    await expect(confirm).toBeHidden()
    await expect(collection(page).locator('.saved-food')).toHaveCount(1)
    expect((await stored(page)).savedFoods).toEqual(data.savedFoods.filter((food: { id: string }) => food.id !== removedId))
    expect((await stored(page)).meals.some((meal: { shareId?: string }) => meal.shareId === removedId)).toBe(false)
    await expect(page.getByRole('region', { name: '今晚想吃的' })).toBeHidden()
    await page.reload()
    await tab(page, '吃什么').click()
    await showCollection(page)
    await expect(collection(page).locator('.saved-food')).toHaveCount(1)
    expect(await collection(page).locator('.share-text').textContent()).toBe(xhsShare)
    await expect(page.getByRole('region', { name: '今晚想吃的' })).toBeHidden()
    await axe(page)
  })

  test('新增收藏后旧字段完整保留；清除全部记录包括收藏，只清理本应用测试记录', async ({ page }) => {
    const old = {
      checkIns: [{ id: 'c1', mood: 'lonely', date: '2026-11-10T09:00:00.000Z' }],
      notes: [{ id: 'n1', text: '旧版那天没说出口的话', tag: '想说没说的', date: '2026-11-11T09:00:00.000Z' }],
      tasks: [{ id: 't1', title: '接孩子放学', owner: '伴侣', when: '周五下午' }],
      savedIds: ['tea'],
      ledger: [{ id: 'dinner', doer: '他', handOver: true }],
      meals: [{ day: '2026-11-10', dishIds: ['tomato-egg'] }],
      skipDishes: ['mapo-tofu'],
      restSlot: 'sat-am',
    }
    await page.evaluate(([storageKey, value]) => {
      localStorage.setItem(storageKey, value)
      localStorage.setItem('share-test-unrelated', '此记录不属于留白')
    }, [key, JSON.stringify(old)])
    await page.reload()
    await saveShare(page, xhsShare)
    const data = await stored(page)
    expect(data).toMatchObject(old)
    expect(data.savedFoods).toHaveLength(1)
    await tab(page, '心里话').click()
    await expect(page.locator('.past')).toContainText('旧版那天没说出口的话')
    await page.getByRole('button', { name: '记录与清除', exact: true }).click()
    await page.getByRole('button', { name: '清除本机全部记录', exact: true }).click()
    await page.getByRole('button', { name: '取消，保留记录', exact: true }).click()
    expect(await stored(page)).toEqual(data)
    await page.getByRole('button', { name: '清除本机全部记录', exact: true }).click()
    await page.getByRole('button', { name: '确认清除全部记录', exact: true }).click()
    expect(await rawStored(page)).toBeNull()
    expect(await page.evaluate(() => localStorage.getItem('share-test-unrelated'))).toBe('此记录不属于留白')
    await page.reload()
    await tab(page, '吃什么').click()
    await expect(page.locator('.saved-food')).toHaveCount(0)
    await expect(page.getByRole('region', { name: '今晚想吃的' })).toBeHidden()
    await tab(page, '心里话').click()
    await expect(page.locator('.past li')).toHaveCount(0)
  })

  for (const readBlocked of [false, true]) {
    test(`存储${readBlocked ? '读写均' : '写入'}不可用：收藏暂存本页并提示，不覆盖原有记录`, async ({ page }) => {
      const original = JSON.stringify({
        checkIns: [], tasks: [], savedIds: ['tea'],
        notes: [{ id: 'old', text: '原有记录不能被覆盖', tag: '', date: '2026-11-11T09:00:00.000Z' }],
      })
      await page.evaluate(([storageKey, value]) => localStorage.setItem(storageKey, value), [key, original])
      await page.addInitScript(blockRead => {
        const nativeRead = Storage.prototype.getItem
        ;(window as unknown as { shareTestRead: typeof nativeRead }).shareTestRead = nativeRead
        if (blockRead) Storage.prototype.getItem = () => { throw new Error('storage read blocked') }
        Storage.prototype.setItem = () => { throw new Error('storage write blocked') }
      }, readBlocked)
      await page.reload()
      if (readBlocked) await expect(page.getByRole('alert')).toContainText('原有记录不会被覆盖')
      await saveShare(page, douyinShare, '暂存在这一页，关掉前请保留原分享')
      await expect(collection(page).locator('.saved-food')).toHaveCount(1)
      expect(await collection(page).locator('.share-text').textContent()).toBe(douyinShare)
      const preserved = await page.evaluate(storageKey => (window as unknown as { shareTestRead: typeof Storage.prototype.getItem }).shareTestRead.call(localStorage, storageKey), key)
      expect(preserved).toBe(original)
      await collection(page).getByRole('button', { name: '今晚吃这个', exact: true }).click()
      await expectNoShareShopping(page)
      await page.reload()
      await tab(page, '吃什么').click()
      await expect(page.locator('.saved-food')).toHaveCount(0)
      expect(await page.evaluate(storageKey => (window as unknown as { shareTestRead: typeof Storage.prototype.getItem }).shareTestRead.call(localStorage, storageKey), key)).toBe(original)
    })
  }

  test('320px：4000 字分享、收藏列表、今晚选中及确认弹窗均无溢出，触控至少 44px', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 640 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const text = `${douyinUrl}\n${'想'.repeat(4000 - douyinUrl.length - 1)}`
    expect(text).toHaveLength(4000)
    const dialog = await openShare(page)
    await dialog.getByRole('textbox', { name: '分享内容' }).fill(text)
    await expect(dialog.getByRole('textbox', { name: '分享内容' })).toHaveValue(text)
    expect(await rawStored(page)).toBeNull()
    await expectShareMobileSize(page, '收藏弹窗')
    await axe(page)
    await shareScreenshot(page, testInfo, '320-dialog')
    await dialog.getByRole('button', { name: '保存收藏', exact: true }).click()
    await expect(dialog).toBeHidden()
    await expect(shareToast(page, '收藏好了，只在这台手机上')).toBeVisible()
    await expect(collection(page)).toBeVisible()
    expect(await collection(page).locator('.share-text').textContent()).toBe(text)
    expect((await stored(page)).savedFoods[0].text).toBe(text)
    await expectShareMobileSize(page, '收藏列表')
    await axe(page)
    await shareScreenshot(page, testInfo, '320-collection')
    await collection(page).getByRole('button', { name: '今晚吃这个', exact: true }).click()
    await expectNoShareShopping(page)
    await expectShareMobileSize(page, '今晚想吃的')
    await axe(page)
    await shareScreenshot(page, testInfo, '320-selected')
    await collection(page).getByRole('button', { name: '移除这条收藏', exact: true }).click()
    const confirm = page.getByRole('dialog', { name: '移除收藏', exact: true })
    await expect(confirm).toBeVisible()
    await expectShareMobileSize(page, '移除确认弹窗')
    await axe(page)
    await shareScreenshot(page, testInfo, '320-remove-dialog')
    await confirm.getByRole('button', { name: '保留收藏', exact: true }).click()
    await expect(collection(page).getByRole('button', { name: '今晚已选', exact: true })).toBeDisabled()
  })
})
