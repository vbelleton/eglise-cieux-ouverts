import { test, expect } from '@playwright/test'

test.describe('Error pages', () => {
  test('404 page for non-existent route', async ({ page }) => {
    const reponse = await page.goto('/cette-page-n-existe-pas')
    expect(reponse?.status()).toBe(404)
    await page.waitForLoadState('networkidle')

    await expect(page.locator('.error-page')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('.error-code')).toContainText('404')
    await expect(page.locator('.error-title')).toContainText('introuvable')
    await expect(page.locator('.error-message')).toBeVisible()
  })

  test("la page d'erreur garde l'en-tête et le pied de page du site", async ({ page }) => {
    await page.goto('/cette-page-n-existe-pas')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('.site-header')).toBeVisible()
    await expect(page.locator('footer').first()).toBeVisible()
    // Un seul titre de niveau 1 : celui de l'erreur.
    await expect(page.locator('h1')).toHaveCount(1)
  })

  test('error page has expected content structure', async ({ page }) => {
    await page.goto('/cette-page-n-existe-pas')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('.error-code')).toBeVisible()
    await expect(page.locator('.error-title')).toBeVisible()
    await expect(page.locator('.error-message')).toBeVisible()
    await expect(page.locator('.error-actions')).toBeVisible()
    await expect(page.locator('.error-suggestions')).toBeVisible()

    const links = page.locator('.error-actions a')
    expect(await links.count()).toBeGreaterThanOrEqual(1)
  })

  test('navigation back to home works from error page', async ({ page }) => {
    await page.goto('/cette-page-n-existe-pas')
    await page.waitForLoadState('networkidle')

    const homeLink = page.locator('.error-actions a[href="/"]')
    await expect(homeLink).toBeVisible()
    await homeLink.click()

    await page.waitForURL('/', { timeout: 10000 })
    await expect(page.locator('.page-renderer')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('.error-page')).toHaveCount(0)
  })

  test('error page has useful suggestion links, sans la page cachée', async ({ page }) => {
    await page.goto('/cette-page-n-existe-pas')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('.error-suggestions')).toBeVisible()

    const suggestionLinks = page.locator('.error-links a')
    expect(await suggestionLinks.count()).toBeGreaterThanOrEqual(2)
    await expect(page.locator('.error-page a[href*="predications"]')).toHaveCount(0)
  })

  test('error page SEO meta is correct', async ({ page }) => {
    await page.goto('/cette-page-n-existe-pas')
    await page.waitForLoadState('networkidle')

    expect(await page.title()).toContain('introuvable')
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
  })

  test("une panne serveur n'est pas présentée comme une page introuvable", async ({ page }) => {
    await page.goto('/contact')
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => {
      const nuxtApp = (document.querySelector('#__nuxt') as any).__vue_app__.config.globalProperties.$nuxt
      // Équivalent de showError() : Nuxt affiche error.vue dès que
      // payload.error est renseigné.
      nuxtApp.payload.error = { statusCode: 500, message: 'Panne simulée' }
    })

    await expect(page.locator('.error-page')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('.error-code')).toContainText('500')
    await expect(page.locator('.error-title')).not.toContainText('introuvable')
    await expect(page.locator('.error-actions button', { hasText: 'Réessayer' })).toBeVisible()
  })
})
