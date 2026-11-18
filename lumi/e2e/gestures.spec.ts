import { expect, test, type CDPSession, type Locator, type Page } from '@playwright/test'

type Point = { x: number; y: number }
async function touch(session: CDPSession, type: 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel', point?: Point) {
  await session.send('Input.dispatchTouchEvent', { type, touchPoints: point ? [{ ...point, id: 1 }] : [] })
}
async function drag(page: Page, from: Point, to: Point, options: { cancel?: boolean; fast?: boolean } = {}) {
  const session = await page.context().newCDPSession(page)
  await touch(session, 'touchStart', from)
  const steps = options.fast ? 1 : 8
  for (let step = 1; step <= steps; step++) {
    await page.waitForTimeout(options.fast ? 8 : 45)
    await touch(session, 'touchMove', { x: from.x + (to.x - from.x) * step / steps, y: from.y + (to.y - from.y) * step / steps })
  }
  if (!options.fast) await page.waitForTimeout(120)
  await touch(session, options.cancel ? 'touchCancel' : 'touchEnd')
  await session.detach()
}
async function settled(dialog: Locator) {
  await dialog.evaluate(async element => { await Promise.all(element.getAnimations().map(animation => animation.finished.catch(() => {}))) })
}
async function openLocation(page: Page) {
  await page.getByRole('button', { name: '杭州', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '当前演示位置' })
  await expect(dialog).toBeVisible()
  await settled(dialog)
  return dialog
}
async function headerPoint(dialog: Locator): Promise<Point> {
  const box = await dialog.locator('header').boundingBox()
  if (!box) throw new Error('Missing dialog header')
  return { x: box.x + 100, y: box.y + 16 }
}
async function seedSaved(page: Page, count = 3) {
  await page.addInitScript(count => {
    localStorage.setItem('lumi:v1', JSON.stringify({ conversations: [], drafts: {}, theme: 'light', lastConversationId: null,
      saved: Array.from({ length: count }, (_, index) => ({ id: `gesture-${index}`, kind: 'task', title: `小事 ${index}`, detail: '测试滚动与手势', done: false, createdAt: new Date().toISOString() })) }))
  }, count)
  await page.goto('/saved')
}
async function rowPoint(row: Locator): Promise<Point> {
  const box = await row.boundingBox()
  if (!box) throw new Error('Missing saved row')
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

test('closing holds focus and background lock until exit, then allows reopen', async ({ page }) => {
  await page.goto('/')
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const dialog = await openLocation(page)
  await dialog.getByRole('button', { name: '关闭弹窗' }).evaluate((button: HTMLButtonElement) => button.click())
  expect(await page.locator('#root').evaluate(root => root.hasAttribute('inert'))).toBe(true)
  expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true)
  await expect(dialog).toHaveCount(0)
  await expect(page.locator('#root')).not.toHaveAttribute('inert', '')
  await expect(page.getByRole('button', { name: '杭州', exact: true })).toBeFocused()
  await openLocation(page)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await openLocation(page)
  await page.mouse.click(5, 100)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('reduced motion removes closing transition', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  const dialog = await openLocation(page)
  await dialog.getByRole('button', { name: '关闭弹窗' }).evaluate((button: HTMLButtonElement) => button.click())
  await expect(dialog).toHaveCount(0)
  await openLocation(page)
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
})

test('mouse drag does not dismiss dialogs or change saved items', async ({ page }) => {
  await page.goto('/')
  const dialog = await openLocation(page)
  const point = await headerPoint(dialog)
  await page.mouse.move(point.x, point.y)
  await page.mouse.down()
  await page.mouse.move(point.x, point.y + 130, { steps: 8 })
  await page.mouse.up()
  await expect(dialog).toBeVisible()
  await expect(dialog).not.toHaveAttribute('style', /translateY/)
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await seedSaved(page)
  const row = page.locator('[data-saved-row="gesture-0"]')
  const start = await rowPoint(row)
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x - 150, start.y, { steps: 8 })
  await page.mouse.up()
  await expect(row).toBeVisible()
  await expect(row.getByRole('button', { name: '标记完成：小事 0' })).toHaveAttribute('aria-pressed', 'false')
})

test.describe('real mobile touch gestures', () => {
  test.beforeEach(async ({}, info) => { test.skip(info.project.name !== 'mobile', 'Touch-only scenarios; mouse behavior is tested separately') })

  test('header follows drag, dims only backdrop, springs back and dismisses', async ({ page }) => {
    await page.goto('/')
    const dialog = await openLocation(page)
    const point = await headerPoint(dialog)
    const session = await page.context().newCDPSession(page)
    await touch(session, 'touchStart', point)
    await touch(session, 'touchMove', { x: point.x, y: point.y + 12 })
    await touch(session, 'touchMove', { x: point.x, y: point.y + 55 })
    await expect(dialog).toHaveAttribute('style', /translateY\(55px\)/)
    expect(await dialog.evaluate(element => getComputedStyle(element).opacity)).toBe('1')
    expect(await dialog.evaluate(element => Number(getComputedStyle(element.parentElement!, '::before').opacity))).toBeLessThan(1)
    await page.waitForTimeout(140)
    await touch(session, 'touchEnd')
    await settled(dialog)
    await expect(dialog).toBeVisible()
    await expect(dialog).not.toHaveAttribute('style', /translateY/)
    await session.detach()
    await drag(page, point, { x: point.x, y: point.y + 160 })
    await expect(dialog).toHaveCount(0)
    await expect(page.locator('#root')).not.toHaveAttribute('inert', '')
    await expect(page.getByRole('button', { name: '杭州', exact: true })).toBeFocused()
  })

  test('fast downward flick closes; upward and cancelled drags do not', async ({ page }) => {
    await page.goto('/')
    let dialog = await openLocation(page)
    let point = await headerPoint(dialog)
    await drag(page, point, { x: point.x, y: point.y + 160 }, { cancel: true })
    await settled(dialog)
    await expect(dialog).toBeVisible()
    await drag(page, point, { x: point.x, y: point.y - 70 })
    await settled(dialog)
    await expect(dialog).toBeVisible()
    await drag(page, point, { x: point.x, y: point.y + 80 }, { fast: true })
    await expect(dialog).toHaveCount(0)
    dialog = await openLocation(page)
    point = await headerPoint(dialog)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await drag(page, point, { x: point.x, y: point.y + 45 })
    await expect(dialog).not.toHaveAttribute('style', /translateY/)
    await drag(page, point, { x: point.x, y: point.y + 160 })
    await expect(dialog).toHaveCount(0)
  })

  test('top body pulls down; scrolled body and excluded controls keep their gestures', async ({ page }) => {
    await page.goto('/')
    let dialog = await openLocation(page)
    const paragraph = await dialog.locator('p').first().boundingBox()
    if (!paragraph) throw new Error('Missing body text')
    const point = { x: paragraph.x + 50, y: paragraph.y + 10 }
    await drag(page, point, { x: point.x, y: point.y + 160 })
    await expect(dialog).toHaveCount(0)
    await page.getByRole('button', { name: '打开菜单' }).click()
    await page.getByRole('dialog', { name: '菜单', exact: true }).getByRole('button', { name: '设置', exact: true }).click()
    dialog = page.getByRole('dialog', { name: '设置', exact: true })
    await settled(dialog)
    const body = dialog.locator('div[class*="modalBody"]')
    await body.evaluate(element => { element.style.height = '230px'; element.style.flexShrink = '0' })
    const box = await body.boundingBox()
    if (!box) throw new Error('Missing scroll body')
    const from = { x: box.x + 100, y: box.y + 180 }
    await drag(page, from, { x: from.x, y: from.y - 130 })
    await expect.poll(() => body.evaluate(element => element.scrollTop)).toBeGreaterThan(0)
    await expect(dialog).not.toHaveAttribute('style', /translateY/)
    await drag(page, { x: from.x, y: box.y + 40 }, { x: from.x, y: box.y + 110 })
    await expect(dialog).toBeVisible()
    await expect(dialog).not.toHaveAttribute('style', /translateY/)
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    dialog = await openLocation(page)
    const bodyText = dialog.locator('p').first()
    await bodyText.evaluate(element => element.setAttribute('data-sheet-nodrag', ''))
    const excluded = await bodyText.boundingBox()
    if (!excluded) throw new Error('Missing excluded text')
    await drag(page, { x: excluded.x + 50, y: excluded.y + 10 }, { x: excluded.x + 50, y: excluded.y + 160 })
    await expect(dialog).toBeVisible()
    await expect(dialog).not.toHaveAttribute('style', /translateY/)
  })

  test('nested menu scroll never becomes a sheet dismissal', async ({ page }) => {
    await page.addInitScript(() => {
      const now = new Date().toISOString()
      localStorage.setItem('lumi:v1', JSON.stringify({ saved: [], theme: 'light', drafts: {}, lastConversationId: null,
        conversations: Array.from({ length: 30 }, (_, i) => ({ id: `history-${i}`, title: `历史对话 ${i}`, messages: [], updatedAt: now, createdAt: now })) }))
    })
    await page.goto('/')
    await page.getByRole('button', { name: '打开菜单' }).click()
    const dialog = page.getByRole('dialog')
    await settled(dialog)
    const history = dialog.getByRole('navigation', { name: '历史会话' })
    await history.evaluate(element => { element.scrollTop = 200 })
    const box = await history.boundingBox()
    if (!box) throw new Error('Missing history list')
    const from = { x: box.x + 80, y: box.y + 20 }
    await drag(page, from, { x: from.x, y: from.y + 100 })
    await expect(dialog).toBeVisible()
    await expect(dialog).not.toHaveAttribute('style', /translate[XY]/)
    await expect.poll(() => history.evaluate(element => element.scrollTop)).toBeLessThan(200)
    await dialog.getByRole('link', { name: '首页', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await expect(page).toHaveURL('/')
  })

  test('menu drawer springs back on a short swipe and closes on a left swipe', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: '打开菜单' }).click()
    const dialog = page.getByRole('dialog', { name: '菜单', exact: true })
    await settled(dialog)
    const box = await dialog.locator('header').boundingBox()
    if (!box) throw new Error('Missing drawer header')
    const from = { x: box.x + box.width - 40, y: box.y + box.height / 2 }
    await drag(page, from, { x: from.x - 30, y: from.y })
    await settled(dialog)
    await expect(dialog).toBeVisible()
    await expect(dialog).not.toHaveAttribute('style', /translateX/)
    await drag(page, from, { x: from.x - 200, y: from.y })
    await expect(dialog).toHaveCount(0)
    await expect(page.getByRole('button', { name: '打开菜单' })).toBeFocused()
  })

  test('saved rows rebound, swipe complete and delete with cross-page undo', async ({ page }) => {
    await seedSaved(page)
    const row = page.locator('[data-saved-row="gesture-0"]')
    let point = await rowPoint(row)
    await drag(page, point, { x: point.x - 45, y: point.y })
    await expect(row).toBeVisible()
    await expect(row.locator('div[class*="item"]').first()).not.toHaveAttribute('style', /translateX/)
    await drag(page, point, { x: point.x + 140, y: point.y })
    await expect(row.getByRole('button', { name: '标记未完成：小事 0' })).toHaveAttribute('aria-pressed', 'true')
    await settled(row.locator('div[class*="item"]').first())
    await row.getByRole('button', { name: '标记未完成：小事 0' }).focus()
    await page.keyboard.press('Enter')
    await expect(row.getByRole('button', { name: '标记完成：小事 0' })).toHaveAttribute('aria-pressed', 'false')
    await page.keyboard.press('Enter')
    await expect(row.getByRole('button', { name: '标记未完成：小事 0' })).toHaveAttribute('aria-pressed', 'true')
    point = await rowPoint(row)
    await drag(page, point, { x: point.x - 150, y: point.y })
    await expect(row).toHaveCount(0)
    await page.getByRole('navigation', { name: '快捷导航' }).getByRole('link', { name: '首页', exact: true }).click()
    await page.getByRole('button', { name: '撤销删除' }).click()
    await page.getByRole('navigation', { name: '快捷导航' }).getByRole('link', { name: /^清单/ }).click()
    await expect(row).toBeVisible()
    await expect(row.getByRole('button', { name: '标记未完成：小事 0' })).toHaveAttribute('aria-pressed', 'true')
    expect(await page.locator('[data-saved-row]').first().getAttribute('data-saved-row')).toBe('gesture-0')
    await row.getByRole('button', { name: '标记未完成：小事 0' }).click()
    await expect(row.getByRole('button', { name: '标记完成：小事 0' })).toHaveAttribute('aria-pressed', 'false')
  })

  test('row vertical scroll and cancelled swipes do not change data', async ({ page }) => {
    await seedSaved(page, 18)
    const row = page.locator('[data-saved-row="gesture-1"]')
    const point = await rowPoint(row)
    await drag(page, point, { x: point.x - 150, y: point.y }, { cancel: true })
    await expect(row).toBeVisible()
    await drag(page, point, { x: point.x, y: point.y - 130 })
    await expect.poll(() => page.locator('div[class*="pageScroll"]:visible').evaluate(element => element.scrollTop)).toBeGreaterThan(0)
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('lumi:v1')!).saved.filter((item: { done: boolean }) => item.done).length)).toBe(0)
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('lumi:v1')!).saved.length)).toBe(18)
  })
})
