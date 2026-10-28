import { test, expect } from '@playwright/test'
import { resetMock } from './helpers/reset'

// Quand le menu enregistré n'a pu être lu ni au rendu serveur ni encore côté
// client, seuls les libellés d'origine existent : on ne les montre pas, sinon
// les noms renommés dans l'admin n'apparaissent qu'après un instant.

test.describe('Menu : pas de libellés d\'origine en attendant le vrai menu', () => {
  test.beforeEach(async ({ request }) => {
    await resetMock(request)
  })

  test('liens masqués tant que le menu n\'est pas chargé, puis affichés renommés', async ({ page }) => {
    await page.route('**/api/menu', async (route) => {
      if (route.request().method() !== 'GET') return route.continue()
      await new Promise((r) => setTimeout(r, 1500))
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          menuItems: [
            { id: 'accueil', label: 'Accueil', to: '/', visible: true, children: [] },
            { id: 'messages', label: 'Prédications', to: '/messages', visible: true, children: [] },
          ],
          menuBgImage: '',
        }),
      })
    })

    await page.goto('/contact')
    const nav = page.locator('.nav-desktop')
    const messages = nav.getByRole('link', { name: 'Messages', exact: true })
    await expect(page.locator('.site-header')).toHaveClass(/menu-pending/)
    await expect(messages).toBeHidden()

    await expect(nav.getByRole('link', { name: 'Prédications' })).toBeVisible({ timeout: 10000 })
    await expect(page.locator('.site-header')).not.toHaveClass(/menu-pending/)
    await expect(messages).toHaveCount(0)
  })

  test('un menu qui ne se charge pas retombe sur les libellés d\'origine', async ({ page }) => {
    await page.route('**/api/menu', (route) =>
      route.request().method() === 'GET' ? route.fulfill({ status: 500, body: '{}' }) : route.continue())

    await page.goto('/contact')
    await expect(page.locator('.nav-desktop').getByRole('link', { name: 'Messages', exact: true })).toBeVisible({ timeout: 10000 })
    await expect(page.locator('.site-header')).not.toHaveClass(/menu-pending/)
  })
})
