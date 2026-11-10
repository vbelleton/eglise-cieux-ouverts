import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './helpers/admin'
import { resetMock } from './helpers/reset'

// ⚙ Config : connexion de la chaîne YouTube et récupération des sous-titres
// pour la recherche dans les paroles (/messages?recherche).
test.describe('Configuration admin — chaîne YouTube', () => {
  test.beforeEach(async ({ request }) => {
    await resetMock(request)
  })

  test('sans identifiant OAuth, la modale nomme les variables Cloudflare', async ({ page }) => {
    await loginAsAdmin(page)
    await page.locator('button[title="Configuration"]').click()
    const section = page.locator('.youtube-paroles')
    await expect(section).toContainText('NUXT_YOUTUBE_OAUTH_CLIENT_ID')
    await expect(section.getByRole('button', { name: 'Connecter la chaîne YouTube' })).toHaveCount(0)
  })

  test('configuré mais pas connecté : bouton de connexion vers Google', async ({ page }) => {
    await page.route('**/api/admin/youtube/etat', (r) => r.fulfill({ json: { configure: true, connecte: false, traitees: 0, avecParoles: 0, restantes: 0, pauseQuota: null } }))
    await page.route('**/api/admin/youtube/connexion', (r) => r.fulfill({ json: { url: '/messages?recherche&connexion-simulee' } }))
    await loginAsAdmin(page)
    await page.locator('button[title="Configuration"]').click()
    await page.locator('.youtube-paroles').getByRole('button', { name: 'Connecter la chaîne YouTube' }).click()
    await expect(page).toHaveURL(/connexion-simulee/)
  })

  test('connecté : la récupération enchaîne les lots jusqu\'au bout', async ({ page }) => {
    let restantes = 5
    await page.route('**/api/admin/youtube/etat', (r) => r.fulfill({ json: { configure: true, connecte: true, traitees: 0, avecParoles: 0, restantes, pauseQuota: null } }))
    await page.route('**/api/admin/youtube/indexer', (r) => {
      restantes = Math.max(0, restantes - 3)
      return r.fulfill({ json: { configure: true, connecte: true, traitees: 5 - restantes, avecParoles: 5 - restantes, restantes, pauseQuota: null } })
    })
    await loginAsAdmin(page)
    await page.locator('button[title="Configuration"]').click()
    const section = page.locator('.youtube-paroles')
    await expect(section).toContainText('5 encore à traiter')
    await section.getByRole('button', { name: 'Récupérer les sous-titres' }).click()
    await expect(section).toContainText('paroles disponibles pour 5 vidéos')
    await expect(section).not.toContainText('encore à traiter')
  })
})
