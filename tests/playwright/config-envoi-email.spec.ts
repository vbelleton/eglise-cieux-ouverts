import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './helpers/admin'
import { resetMock } from './helpers/reset'

// La modale ⚙️ Config dit si l'envoi des emails du formulaire de contact
// est en place (d'après /api/health), à la place de l'ancienne jauge de
// quota Resend qui ne comptait rien.

test.describe('Configuration admin — envoi des emails', () => {
  test.beforeEach(async ({ request }) => {
    await resetMock(request)
  })

  test('sans Mailjet, la modale nomme les variables manquantes', async ({ page }) => {
    await page.route('**/api/health', (route) => route.fulfill({
      json: { ok: true, email: { configured: false, apiKey: true, apiSecret: false, fromEmail: false } },
    }))
    await loginAsAdmin(page)
    await page.locator('button[title="Configuration"]').click()
    const etat = page.locator('.email-etat')
    await expect(etat).toContainText('Pas configuré')
    await expect(etat).toContainText('NUXT_MAILJET_API_SECRET, NUXT_MAILJET_FROM_EMAIL')
    await expect(etat).not.toContainText('NUXT_MAILJET_API_KEY')
    await expect(page.locator('.settings-modal')).not.toContainText('Quota')
  })

  test('avec Mailjet, la modale affiche l\'adresse d\'envoi', async ({ page }) => {
    await page.route('**/api/health', (route) => route.fulfill({
      json: { ok: true, email: { configured: true, apiKey: true, apiSecret: true, fromEmail: true, fromEmailValeur: 'envoi@exemple.fr' } },
    }))
    await loginAsAdmin(page)
    await page.locator('button[title="Configuration"]').click()
    await expect(page.locator('.email-etat')).toHaveText('✅ Actif : les messages partent de envoi@exemple.fr.')
  })
})
