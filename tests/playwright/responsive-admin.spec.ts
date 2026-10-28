import { test, expect } from '@playwright/test'

const PAGE_BLOCKS = [
  { type: 'hero' },
  { type: 'bienvenue' },
  { type: 'rejoins' },
  { type: 'aspirations' },
  { type: 'vision' },
  { type: 'activities' },
  { type: 'nousRejoindre' },
  { type: 'contact' },
]

test.describe('Responsive admin mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?admin=true')
    await page.waitForLoadState('networkidle')
  })

  test.describe('Desktop (>1024px)', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 })
    })

    test('toolbar is visible and has full width', async ({ page }) => {
      await expect(page.locator('.admin-toolbar')).toBeVisible()
      const toolbarWidth = await page.locator('.admin-toolbar').evaluate(el => el.getBoundingClientRect().width)
      expect(toolbarWidth).toBeGreaterThanOrEqual(1024)
    })

    test('all blocks render correctly', async ({ page }) => {
      await expect(page.locator('.block-wrapper')).toHaveCount(PAGE_BLOCKS.length, { timeout: 15000 })
      for (const { type } of PAGE_BLOCKS) {
        await expect(page.locator(`.block-wrapper[data-block-type="${type}"]`).first()).toBeVisible()
      }
    })

    test('device buttons are present and clickable', async ({ page }) => {
      const deviceBtns = page.locator('.device-btn')
      expect(await deviceBtns.count()).toBe(3)
      for (let i = 0; i < 3; i++) {
        await expect(deviceBtns.nth(i)).toBeVisible()
      }
    })
  })

  test.describe('Tablet (768px)', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 })
    })

    test('toolbar is visible and compact', async ({ page }) => {
      await expect(page.locator('.admin-toolbar')).toBeVisible()
      const toolbarWidth = await page.locator('.admin-toolbar').evaluate(el => el.getBoundingClientRect().width)
      expect(toolbarWidth).toBeLessThanOrEqual(800)
    })

    test('blocks render correctly at tablet width', async ({ page }) => {
      await expect(page.locator('.block-wrapper')).toHaveCount(PAGE_BLOCKS.length, { timeout: 15000 })
      for (const { type } of PAGE_BLOCKS) {
        await expect(page.locator(`.block-wrapper[data-block-type="${type}"]`).first()).toBeVisible()
      }
    })

    // Sous 768 px, les boutons d'appareil de la barre sont remplacés par le
    // sélecteur du menu ☰ (voir admin-telephone.spec.ts).
    test('pas de boutons d\'appareil dans la barre, édition directe par défaut', async ({ page }) => {
      await expect(page.locator('.admin-btn-save')).toBeVisible()
      await expect(page.locator('.device-btn').first()).toBeHidden()
      await expect(page.locator('.device-iframe')).toHaveCount(0)
    })
  })

  test.describe('Mobile (375px)', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 })
    })

    test('blocks render correctly at mobile width', async ({ page }) => {
      await expect(page.locator('.block-wrapper')).toHaveCount(PAGE_BLOCKS.length, { timeout: 15000 })
      for (const { type } of PAGE_BLOCKS) {
        await expect(page.locator(`.block-wrapper[data-block-type="${type}"]`).first()).toBeVisible()
      }
    })

    test('la barre admin tient dans l\'écran, sélecteur d\'appareil dans le menu', async ({ page }) => {
      await expect(page.locator('.admin-btn-save')).toBeVisible()
      const { sw, cw } = await page.locator('.admin-toolbar').evaluate((t) => ({ sw: t.scrollWidth, cw: t.clientWidth }))
      expect(sw).toBeLessThanOrEqual(cw)
      await expect(page.locator('.device-btn').first()).toBeHidden()
    })

    test('hamburger menu is accessible on mobile', async ({ page }) => {
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)

      await page.goto('/')
      await page.waitForLoadState('networkidle')

      const burger = page.locator('.burger')
      await expect(burger).toBeVisible()
      await burger.click()
      await page.waitForTimeout(300)
      await expect(page.locator('.nav-mobile')).toBeVisible({ timeout: 5000 })
    })
  })
})
