import { test, expect, type Page, type APIRequestContext } from '@playwright/test'
import { loginAsAdmin } from './helpers/admin'
import { resetMock } from './helpers/reset'

// Ordre des onglets de l'espace membre (Ressources/Demandes/Événements),
// réglable depuis la modale Configuration admin (server/api/settings).

async function loginAsMember(page: Page) {
  await page.addInitScript(() => {
    ;(window as unknown as Record<string, unknown>).__MOCK_AUTH_RESULT = {
      uid: 'cli-test-member',
      email: 'ci-member@tests.fr',
      displayName: 'Claire Membre',
      getIdToken: async () => 'mock-test-token:ci-member@tests.fr',
    }
  })
}

// L'espace membre est désactivé par défaut (réglage ⚙️ Config) : ces tests
// l'activent explicitement.
async function activerEspaceMembre(request: APIRequestContext) {
  const res = await request.put('/api/settings', { data: { contactEmails: ['belletonv@gmail.com'], espaceMembre: true } })
  if (!res.ok()) throw new Error(`activation espace membre : HTTP ${res.status()}`)
}

test.describe('Configuration admin — ordre des onglets espace membre', () => {
  test.beforeEach(async ({ request }) => {
    await resetMock(request)
    await activerEspaceMembre(request)
  })

  test('ordre par défaut : Ressources, Demandes, Mes événements', async ({ page }) => {
    await loginAsMember(page)
    await page.goto('/membre')
    await expect(page.locator('.dashboard')).toBeVisible({ timeout: 5000 })
    const tabs = await page.locator('.dash-tabs button').allTextContents()
    expect(tabs.map((t) => t.trim().replace(/\s*\d+$/, ''))).toEqual([
      '📚 Ressources',
      '🙋 Demandes',
      '📅 Mes événements',
    ])
  })

  test('réordonner dans la modale Configuration change l\'ordre sur /membre', async ({ page }) => {
    await loginAsAdmin(page)
    await page.locator('button[title="Configuration"]').click()
    await expect(page.locator('.member-tab-order-row')).toHaveCount(3)

    // Monter "Demandes" (2e ligne) en 1ère position.
    await page.locator('.member-tab-order-row').nth(1).locator('.member-tab-order-btn').first().click()
    await expect(page.locator('.member-tab-order-label').first()).toHaveText('🙋 Demandes')

    const saveBtn = page.locator('.settings-modal-footer button', { hasText: 'Sauvegarder' })
    await saveBtn.scrollIntoViewIfNeeded()
    await saveBtn.click()
    await expect(page.locator('.settings-modal')).toHaveCount(0, { timeout: 3000 })

    const res = await page.request.get('/api/settings')
    const data = await res.json()
    expect(data.memberTabOrder).toEqual(['demandes', 'ressources', 'evenements'])

    await loginAsMember(page)
    await page.goto('/membre')
    await expect(page.locator('.dashboard')).toBeVisible({ timeout: 5000 })
    const tabs = await page.locator('.dash-tabs button').allTextContents()
    expect(tabs.map((t) => t.trim().replace(/\s*\d+$/, ''))).toEqual([
      '🙋 Demandes',
      '📚 Ressources',
      '📅 Mes événements',
    ])
    await expect(page.locator('.dash-tabs button.active')).toHaveText(/Demandes/)
  })
})
