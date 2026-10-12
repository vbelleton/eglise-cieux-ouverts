import { test, expect } from '@playwright/test'
import { resetMock } from './helpers/reset'

test.describe('Référencement (SEO) : balises par page', () => {
  test.beforeEach(async ({ request }) => { await resetMock(request) })

  for (const path of ['/', '/messages', '/contact']) {
    test(`${path} : canonical, titre, description et aperçu de partage`, async ({ page }) => {
      await page.goto(path + '?device=mobile')
      const canonical = await page.locator('link[rel="canonical"]').getAttribute('href')
      expect(canonical).toBeTruthy()
      // Pas de paramètre de requête dans l'URL canonique
      expect(canonical).not.toContain('?')
      expect(canonical!.endsWith(path === '/' ? '' : path) || canonical!.endsWith('/')).toBe(true)
      await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /.{20,}/)
      await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /.+/)
      // Open Graph exige une image en URL absolue
      await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /^https?:\/\//)
      await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image')
    })
  }

  test('données structurées « Church » valides sur l\'accueil', async ({ page }) => {
    await page.goto('/')
    const json = await page.locator('script[type="application/ld+json"]').first().textContent()
    const data = JSON.parse(json!)
    expect(data['@type']).toBe('Church')
    expect(data.name).toBeTruthy()
  })
})
