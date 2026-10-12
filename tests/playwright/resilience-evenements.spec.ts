import { test, expect } from '@playwright/test'
import { resetMock } from './helpers/reset'

/**
 * Panne du Worker événements (backend séparé, cf. CLAUDE.md).
 *
 * Régression : une liste d'événements vide parce que l'API n'a pas répondu
 * était traitée exactement comme un agenda réellement vide. Conséquences en
 * cas de panne passagère de l'amont :
 * - /agenda affichait « Aucun événement à venir », ce qui est faux ;
 * - /event-list se redirigeait vers l'accueil (option « masquer si vide »),
 *   la page disparaissait donc du site ;
 * - le lien Événements disparaissait de la navigation de TOUTES les pages.
 *
 * Le composable distingue maintenant `erreur` de « liste vide ». Le dernier
 * test vérifie que le masquage volontaire fonctionne toujours : il ne s'agit
 * pas d'avoir désactivé la fonctionnalité.
 */

async function couperWorkerEvenements(page: import('@playwright/test').Page) {
  await page.route('**/api/church-events*', (route) => route.abort('failed'))
}

async function agendaVide(page: import('@playwright/test').Page) {
  await page.route('**/api/church-events*', (route) => route.fulfill({ json: [] }))
}

async function activerMasquageSiVide(request: import('@playwright/test').APIRequestContext) {
  const res = await request.put('/api/settings', {
    data: { contactEmails: ['contact@tests.fr'], hideEventsPageIfEmpty: true },
  })
  expect(res.ok()).toBe(true)
}

test.describe('Panne du Worker événements', () => {
  test.beforeEach(async ({ request }) => {
    await resetMock(request)
  })

  test('/agenda annonce l\'échec au lieu d\'affirmer qu\'il n\'y a aucun événement', async ({ page }) => {
    await couperWorkerEvenements(page)
    await page.goto('/agenda')

    await expect(page.getByText("Les événements n'ont pas pu être chargés").first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Aucun événement à venir.')).toHaveCount(0)
  })

  test('la page Événements n\'est pas retirée du site sur une erreur de chargement', async ({ page, request }) => {
    await activerMasquageSiVide(request)
    await couperWorkerEvenements(page)

    await page.goto('/event-list')
    // Laisse au watcher le temps de se déclencher après hydratation : c'est
    // précisément là que la redirection partait.
    await page.waitForTimeout(2000)
    await expect(page).toHaveURL(/event-list/)
  })

  test('le lien Événements reste dans la navigation malgré la panne', async ({ page }) => {
    await couperWorkerEvenements(page)
    await page.goto('/')

    await expect(page.locator('header a[href="/event-list"]').first()).toBeVisible({ timeout: 15000 })
  })

  test('mais un agenda réellement vide masque toujours la page', async ({ page, request }) => {
    await activerMasquageSiVide(request)
    await agendaVide(page)

    await page.goto('/event-list')
    await expect(page).toHaveURL(/\/$/, { timeout: 10000 })
  })

  test('agenda vide sans masquage demandé : le lien Événements reste (Parcours Alpha)', async ({ page }) => {
    await agendaVide(page)
    await page.goto('/', { waitUntil: 'networkidle' })
    await expect(page.locator('header a[href="/event-list"]').first()).toBeVisible({ timeout: 15000 })
  })

  test('agenda vide avec masquage demandé : le lien Événements disparaît', async ({ page, request }) => {
    await activerMasquageSiVide(request)
    await agendaVide(page)
    await page.goto('/', { waitUntil: 'networkidle' })
    await expect(page.locator('header a[href="/event-list"]')).toHaveCount(0, { timeout: 15000 })
  })
})
