import { test, expect } from '@playwright/test'

// Page Événements sans contenu enregistré : la page par défaut s'affiche
// (en-tête, prochains événements, parcours Alpha). Le Worker événements est
// simulé (un événement à venir) pour ne pas dépendre du réseau — non vide,
// sinon le lien Événements est retiré de la navigation.
const EVENEMENT = {
  id: 9001, title: 'Concert de test', start_date: '2099-06-15', end_date: '2099-06-15',
  start_time: '20:00', end_time: '22:00', location: 'Morlaix', repeat_period: null, status: 'active', exceptions: [],
}
test.describe('Fallback Billetterie sur /event-list', () => {

  test.beforeEach(async ({ page }) => {
    await page.request.get('/api/test/set-mock?slug=event-list&empty=true')
    await page.route('**/api/church-events*', (route) => route.fulfill({ json: [EVENEMENT] }))
  })

  test('SSR : le fallback s\'affiche sur chargement direct de /event-list', async ({ page }) => {
    await page.goto('/event-list', { waitUntil: 'networkidle' })
    await expect(page.getByText('Billetterie Événements')).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('heading', { name: 'Parcours Alpha' })).toBeVisible({ timeout: 5000 })
    await expect(page.locator('.block-evenements').getByText('Concert de test')).toBeVisible({ timeout: 10000 })
  })

  test('SPA : le fallback s\'affiche après navigation depuis /agenda', async ({ page }) => {
    await page.goto('/agenda', { waitUntil: 'networkidle' })
    await expect(page.locator('body')).toBeAttached()

    await page.goto('/event-list', { waitUntil: 'networkidle' })

    await expect(page.getByText('Billetterie Événements')).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('heading', { name: 'Parcours Alpha' })).toBeVisible({ timeout: 5000 })
  })

  test('SPA : le fallback s\'affiche via clic lien navigation', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })

    await page.getByRole('link', { name: 'Événements' }).first().click()
    await page.waitForURL('**/event-list')

    await expect(page.getByText('Billetterie Événements')).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('heading', { name: 'Parcours Alpha' })).toBeVisible({ timeout: 5000 })
  })

})
