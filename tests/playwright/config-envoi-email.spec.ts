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

  test('le bouton de test affiche la vraie raison d\'un échec', async ({ page }) => {
    // En test, Mailjet n'est pas configuré : l'envoi échoue, et la modale
    // doit le dire au lieu de rester muette.
    await loginAsAdmin(page)
    await page.locator('button[title="Configuration"]').click()
    await page.getByRole('button', { name: 'Envoyer un email de test' }).click()
    const resultat = page.locator('.test-email-resultat')
    await expect(resultat).toContainText("L'envoi n'est pas configuré")
    await expect(resultat).toContainText('Mailjet non configuré')
  })

  test('le refus « adresse non validée » est expliqué', async ({ page }) => {
    await page.route('**/api/settings/test-email', (route) => route.fulfill({
      json: { ok: false, destinataires: ['eglise@exemple.fr'], erreur: 'Mailjet a rejeté l\'envoi : [{"Status":"error","Errors":[{"ErrorMessage":"The sender address has not been validated"}]}]' },
    }))
    await loginAsAdmin(page)
    await page.locator('button[title="Configuration"]').click()
    await page.getByRole('button', { name: 'Envoyer un email de test' }).click()
    await expect(page.locator('.test-email-resultat')).toContainText("L'adresse d'envoi n'est pas validée chez Mailjet")
  })

  test('un visiteur anonyme ne peut pas lancer de test', async ({ request }) => {
    const res = await request.post('/api/settings/test-email')
    expect(res.status()).toBe(401)
  })
})
