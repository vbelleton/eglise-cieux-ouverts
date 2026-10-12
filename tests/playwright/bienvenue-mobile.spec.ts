import { test, expect } from '@playwright/test'
import { resetMock } from './helpers/reset'

// « BIENVENUE » : la taille réglée dans l'admin (em) s'applique sur ordi,
// mais ne doit jamais faire déborder le titre de l'écran d'un téléphone.
test.describe('Bloc Bienvenue sur téléphone', () => {
  test.beforeEach(async ({ request }) => {
    await resetMock(request)
  })

  for (const largeur of [360, 390, 430]) {
    test(`le titre tient dans l'écran (${largeur}px)`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 800 })
      await page.goto('/')
      const lettres = page.locator('.hero-bienvenue-char')
      await expect(lettres.first()).toBeVisible({ timeout: 15000 })
      const premiere = await lettres.first().boundingBox()
      const derniere = await lettres.last().boundingBox()
      expect(premiere!.x).toBeGreaterThanOrEqual(0)
      expect(derniere!.x + derniere!.width).toBeLessThanOrEqual(largeur)
    })
  }

  test('sur ordi, la taille réglée est conservée', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    const titre = page.locator('.hero-bienvenue-portal')
    await expect(titre).toBeVisible({ timeout: 15000 })
    // fontSize par défaut : 5em sur une base de 16px
    expect(await titre.evaluate((e) => getComputedStyle(e).fontSize)).toBe('80px')
  })
})
