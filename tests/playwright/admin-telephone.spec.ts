import { test, expect, devices } from '@playwright/test'
import { loginAsAdmin } from './helpers/admin'
import { resetMock } from './helpers/reset'

/**
 * Admin sur téléphone (iPhone 13, 390 px). Avant : la barre d'outils faisait
 * ~1180 px de large sur un écran de 390 — Sauvegarder, ＋ Bloc, Quitter et
 * tous les outils étaient hors de l'écran, sans aucun moyen d'y accéder.
 */
const { defaultBrowserType, ...iphone } = devices['iPhone 13']
test.use(iphone)

test.describe('Admin sur téléphone', () => {
  test.beforeEach(async ({ request }) => {
    await resetMock(request)
  })

  test('la barre tient dans l\'écran et les outils passent par le menu ☰', async ({ page }) => {
    await loginAsAdmin(page)
    const barre = page.locator('.admin-toolbar')
    await expect(page.locator('.admin-btn-save')).toBeVisible()
    const { sw, cw } = await barre.evaluate((t) => ({ sw: t.scrollWidth, cw: t.clientWidth }))
    expect(sw).toBeLessThanOrEqual(cw)

    for (const sel of ['.admin-btn-save', '.admin-btn-add-block', '.admin-btn-plus']) {
      const box = await page.locator(sel).boundingBox()
      expect(box && box.x + box.width).toBeLessThanOrEqual(390)
    }

    // Menu fermé : les outils secondaires sont cachés
    await expect(page.locator('.admin-toolbar-plus .admin-btn', { hasText: 'Quitter' })).toBeHidden()
    await page.locator('.admin-btn-plus').click()
    await expect(page.locator('.admin-toolbar-plus .admin-btn', { hasText: 'Quitter' })).toBeVisible()

    // Un outil du menu ouvre sa modale et referme le menu
    await page.locator('.admin-toolbar-plus .admin-btn', { hasText: 'Admins' }).click()
    await expect(page.locator('.admin-mgr-input')).toBeVisible()
    await expect(page.locator('.admin-toolbar-plus.ouvert')).toHaveCount(0)
  })

  test('le panneau d\'un bloc s\'ouvre par le bas, en pleine largeur', async ({ page }) => {
    await loginAsAdmin(page)
    await page.evaluate(() => (document.querySelectorAll('.block-wrapper')[1] as HTMLElement).click())
    const panneau = page.locator('.admin-sidebar')
    await expect(panneau).toBeVisible()
    const box = await panneau.boundingBox()
    expect(box!.width).toBeGreaterThanOrEqual(389)
    expect(box!.y + box!.height).toBeGreaterThanOrEqual(page.viewportSize()!.height - 1)
    expect(box!.y).toBeGreaterThan(150)

    await page.locator('.admin-agrandir-btn').click()
    await expect(panneau).toHaveClass(/sidebar-agrandie/)
    await expect.poll(async () => (await panneau.boundingBox())!.y).toBeLessThanOrEqual(49)
  })

  test('pas de zoom Safari à la saisie en admin, zoom rendu en quittant', async ({ page }) => {
    await loginAsAdmin(page)
    await expect(page.locator('.admin-btn-save')).toBeVisible()
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', /maximum-scale=1/)
    await page.locator('.admin-btn-plus').click()
    await page.locator('.admin-toolbar-plus .admin-btn', { hasText: 'Quitter' }).click()
    await expect(page.locator('.admin-toolbar')).toHaveCount(0)
    await expect(page.locator('meta[name="viewport"]')).not.toHaveAttribute('content', /maximum-scale/)
  })

  test('le sélecteur d\'appareil est dans le menu ☰ et ouvre l\'aperçu', async ({ page }) => {
    await loginAsAdmin(page)
    await page.locator('.admin-btn-plus').click()
    const menu = page.locator('.admin-device-menu')
    await expect(menu).toBeVisible()
    await expect(menu.locator('.admin-device-menu-btn.active')).toContainText('Ordinateur')
    await menu.getByRole('button', { name: /Mobile/ }).click()
    await expect(page.locator('.device-iframe')).toBeVisible()
    await page.locator('.admin-btn-plus').click()
    await page.locator('.admin-device-menu').getByRole('button', { name: /Tablette/ }).click()
    await expect(page.locator('.device-iframe.preview-tablet')).toBeVisible()
    const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }))
    expect(sw).toBeLessThanOrEqual(cw)
  })

  test('zoom au pincement bloqué en admin, rendu en quittant', async ({ page }) => {
    await loginAsAdmin(page)
    await expect(page.locator('.admin-btn-save')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.style.touchAction)).toBe('pan-x pan-y')
    await page.locator('.admin-btn-plus').click()
    await page.locator('.admin-toolbar-plus .admin-btn', { hasText: 'Quitter' }).click()
    await expect(page.locator('.admin-toolbar')).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.style.touchAction)).toBe('')
  })
})
