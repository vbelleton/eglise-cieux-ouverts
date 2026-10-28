import { test, expect } from '@playwright/test'

// Déjà sur l'accueil, cliquer sur le logo doit ramener en haut de page
// (NuxtLink vers la même route ne faisait rien).
test.describe("Logo depuis l'accueil", () => {
  test('desktop : remonte en haut de page', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/', { waitUntil: 'networkidle' })

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.6))
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100)

    await page.locator('.site-header .brand').click()
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
    expect(new URL(page.url()).pathname).toBe('/')
  })

  test('mobile, menu ouvert : ferme le menu et remonte en haut', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/', { waitUntil: 'networkidle' })

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.6))
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100)

    await page.locator('.site-header .burger').click()
    await expect(page.locator('.site-header')).toHaveClass(/menu-open/)

    await page.locator('.site-header .brand').click()
    await expect(page.locator('.site-header')).not.toHaveClass(/menu-open/)
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
  })

  test('depuis une autre page : navigue vers l’accueil', async ({ page }) => {
    await page.goto('/contact', { waitUntil: 'networkidle' })
    await page.locator('.site-header .brand').click()
    await expect(page).toHaveURL(/\/$/)
  })
})
