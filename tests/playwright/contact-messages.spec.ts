import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './helpers/admin'
import { resetMock } from './helpers/reset'

/**
 * Formulaire de contact public → visible dans l'admin (lecture seule,
 * pas de réponse gérée depuis l'admin).
 */

test.describe('Messages de contact', () => {
  test.beforeEach(async ({ request }) => {
    await resetMock(request)
  })

  test('un message envoyé via le formulaire public apparaît dans la modale admin', async ({ page }) => {
    // Le bloc contact par défaut de /contact n'a pas de mapEmbedUrl, donc
    // isClassicPageContact est false : c'est le mode "simple" (placeholder,
    // pas de <label>) qui est rendu, pas le mode "page classique".
    await page.goto('/contact')
    await page.getByPlaceholder('Prénom *').fill('Jean')
    await page.getByPlaceholder('Nom de famille *').fill('Dupont')
    await page.getByPlaceholder('Email *').fill('jean.dupont@example.com')
    await page.getByPlaceholder('Ton Message *').fill('Bonjour, je voudrais des informations sur les cultes du dimanche.')
    // Anti-bot : le formulaire refuse l'envoi avant 2.5s depuis le montage.
    await page.waitForTimeout(2600)
    await page.getByRole('button', { name: "C'est parti !" }).click()
    await expect(page.locator('.success-msg')).toBeVisible({ timeout: 5000 })

    await loginAsAdmin(page)
    await page.locator('.admin-btn-secondary', { hasText: 'Messages' }).click()
    await expect(page.getByText('Jean Dupont')).toBeVisible({ timeout: 3000 })
    await expect(page.getByText('jean.dupont@example.com')).toBeVisible()
    await expect(page.getByText('informations sur les cultes')).toBeVisible()
  })

  test('marquer un message comme lu retire le badge de compteur', async ({ page, request }) => {
    await request.post('/api/contact', {
      data: {
        prenom: 'Marie', nom: 'Martin', email: 'marie@example.com',
        message: 'Message de test pour le badge non lu.',
      },
    })

    await loginAsAdmin(page)
    await expect(page.locator('.admin-btn-secondary', { hasText: 'Messages' }).locator('.admin-msg-count')).toHaveText('1', { timeout: 3000 })

    await page.locator('.admin-btn-secondary', { hasText: 'Messages' }).click()
    await page.locator('.version-item', { hasText: 'Marie Martin' }).locator('button', { hasText: '✓ Lu' }).click()
    await expect(page.locator('.version-item', { hasText: 'Marie Martin' }).locator('button', { hasText: '↺ Non lu' })).toBeVisible({ timeout: 3000 })
  })

  test('un message peut être supprimé définitivement, après confirmation', async ({ page, request }) => {
    await request.post('/api/contact', {
      data: {
        prenom: 'Lucie', nom: 'Bernard', email: 'lucie@example.com',
        message: 'Message destiné à être supprimé par le test.',
      },
    })

    await loginAsAdmin(page)
    await page.locator('.admin-btn-secondary', { hasText: 'Messages' }).click()

    const item = page.locator('.version-item', { hasText: 'Lucie Bernard' })
    await expect(item).toBeVisible({ timeout: 3000 })

    // Refuser la confirmation ne doit rien supprimer
    await item.locator('.version-del-btn').click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Annuler' }).click()
    await expect(page.locator('.version-item', { hasText: 'Lucie Bernard' })).toBeVisible({ timeout: 3000 })

    // Accepter supprime réellement le message
    await item.locator('.version-del-btn').click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Supprimer' }).click()
    await expect(page.locator('.version-item', { hasText: 'Lucie Bernard' })).toHaveCount(0, { timeout: 3000 })

    // Et il ne revient pas après rechargement (suppression persistée)
    const list = await request.get('/api/contacts')
    const { contacts } = await list.json()
    expect(contacts.some((c: any) => c.email === 'lucie@example.com')).toBe(false)
  })

  test('un message resté au statut archivé reste visible après le retrait de l\'archivage', async ({ page, request }) => {
    // Régression : les messages archivés avant la suppression de la
    // fonctionnalité ne doivent pas devenir invisibles pour toujours.
    await request.post('/api/contact', {
      data: {
        prenom: 'Ancien', nom: 'Archivé', email: 'ancien@example.com',
        message: 'Message archivé avant le retrait de la fonctionnalité.',
      },
    })
    const list = await request.get('/api/contacts')
    const { contacts } = await list.json()
    const cible = contacts.find((c: any) => c.email === 'ancien@example.com')
    await request.put(`/api/contacts/${cible.id}`, { data: { status: 'archived' } })

    await loginAsAdmin(page)
    await page.locator('.admin-btn-secondary', { hasText: 'Messages' }).click()
    await expect(page.locator('.version-item', { hasText: 'Ancien Archivé' })).toBeVisible({ timeout: 3000 })
  })
})

test.describe('API /api/contacts', () => {
  test.beforeEach(async ({ request }) => {
    await resetMock(request)
  })

  test('un POST /api/contact valide est listé par GET /api/contacts', async ({ request }) => {
    const created = await request.post('/api/contact', {
      data: {
        prenom: 'Paul', nom: 'Petit', email: 'paul@example.com',
        message: 'Un message suffisamment long pour passer la validation.',
      },
    })
    expect(created.ok()).toBe(true)

    const list = await request.get('/api/contacts')
    const { contacts } = await list.json()
    expect(contacts.some((c: any) => c.email === 'paul@example.com')).toBe(true)
  })

  test('PUT /api/contacts/:id change le status', async ({ request }) => {
    await request.post('/api/contact', {
      data: {
        prenom: 'Alice', nom: 'Roy', email: 'alice@example.com',
        message: 'Un autre message suffisamment long pour la validation.',
      },
    })
    const list = await request.get('/api/contacts')
    const { contacts } = await list.json()
    const target = contacts.find((c: any) => c.email === 'alice@example.com')
    expect(target.status).toBe('new')

    const updated = await request.put(`/api/contacts/${target.id}`, { data: { status: 'read' } })
    expect(updated.ok()).toBe(true)

    const listAfter = await request.get('/api/contacts')
    const { contacts: after } = await listAfter.json()
    expect(after.find((c: any) => c.id === target.id).status).toBe('read')
  })
})
