import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './helpers/admin'
import { resetMock } from './helpers/reset'

/**
 * Système de demandes développeur : note attachée à un bloc (visible admin
 * uniquement), liste centralisée cross-page, navigation vers le bloc depuis
 * la liste.
 */

test.describe('Demandes développeur', () => {
  test.beforeEach(async ({ request }) => {
    await resetMock(request)
  })

  test('créer une note sur un bloc, elle apparaît dans la modale Demandes', async ({ page }) => {
    await loginAsAdmin(page)
    const block = page.locator('.block-wrapper').first()
    await block.click()

    const textarea = page.locator('.admin-comment-textarea')
    await textarea.fill('J\'aimerais un compteur ici')
    await page.locator('.admin-comment-actions button', { hasText: 'Créer la demande' }).click()

    await expect(page.locator('.admin-comment-actions button', { hasText: 'Marquer résolu' })).toBeVisible({ timeout: 3000 })
    await expect(page.locator('.dev-comment-badge')).toBeVisible()

    await page.locator('.admin-btn-secondary', { hasText: 'Demandes' }).click()
    await expect(page.getByText('J\'aimerais un compteur ici')).toBeVisible({ timeout: 3000 })
    await expect(page.getByText('accueil —')).toBeVisible()
  })

  test('marquer résolu retire le badge et déplace l\'item en fin de liste', async ({ page }) => {
    await loginAsAdmin(page)
    const block = page.locator('.block-wrapper').first()
    await block.click()
    await page.locator('.admin-comment-textarea').fill('Note à résoudre')
    await page.locator('.admin-comment-actions button', { hasText: 'Créer la demande' }).click()
    await expect(page.locator('.dev-comment-badge')).toBeVisible({ timeout: 3000 })

    await page.locator('.admin-comment-actions button', { hasText: 'Marquer résolu' }).click()
    await expect(page.locator('.admin-comment-resolved-note')).toBeVisible({ timeout: 3000 })
    await expect(page.locator('.dev-comment-badge')).toHaveCount(0)

    await page.locator('.admin-btn-secondary', { hasText: 'Demandes' }).click()
    await expect(page.locator('.version-item.comment-resolved')).toBeVisible({ timeout: 3000 })
  })

  test('supprimer une note la retire de la sidebar et de la modale', async ({ page }) => {
    await loginAsAdmin(page)
    const block = page.locator('.block-wrapper').first()
    await block.click()
    await page.locator('.admin-comment-textarea').fill('Note à supprimer')
    await page.locator('.admin-comment-actions button', { hasText: 'Créer la demande' }).click()
    await expect(page.locator('.admin-comment-del-btn')).toBeVisible({ timeout: 3000 })

    await page.locator('.admin-comment-del-btn').click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Supprimer' }).click()
    await expect(page.locator('.admin-comment-actions button', { hasText: 'Créer la demande' })).toBeVisible({ timeout: 3000 })
    await expect(page.locator('.dev-comment-badge')).toHaveCount(0)
  })

  test('cliquer un item de la modale navigue vers la page et sélectionne le bloc', async ({ page }) => {
    // Crée la note sur /contact, puis vérifie qu'on peut y revenir depuis /
    await loginAsAdmin(page, '/contact')
    const block = page.locator('.block-wrapper').first()
    const blockId = await block.getAttribute('data-block-id')
    await block.click()
    await page.locator('.admin-comment-textarea').fill('Demande cross-page')
    await page.locator('.admin-comment-actions button', { hasText: 'Créer la demande' }).click()
    await expect(page.locator('.admin-comment-actions button', { hasText: 'Marquer résolu' })).toBeVisible({ timeout: 3000 })

    await page.goto('/?admin=true')
    await page.waitForSelector('.admin-toolbar', { timeout: 4000 })
    await page.locator('.admin-btn-secondary', { hasText: 'Demandes' }).click()
    await expect(page.getByText('Demande cross-page')).toBeVisible({ timeout: 3000 })

    await page.locator('.version-info', { hasText: 'Demande cross-page' }).click()

    await expect(page).toHaveURL(/\/contact/, { timeout: 5000 })
    await expect(page).not.toHaveURL(/focusBlock/)
    await expect(page.locator(`.block-wrapper[data-block-id="${blockId}"].admin-selected`)).toBeVisible({ timeout: 3000 })
  })

  test('un type sans note affiche le compteur de demandes non résolues sur le bouton toolbar', async ({ page }) => {
    await loginAsAdmin(page)
    const block = page.locator('.block-wrapper').first()
    await block.click()
    await page.locator('.admin-comment-textarea').fill('Compteur test')
    await page.locator('.admin-comment-actions button', { hasText: 'Créer la demande' }).click()
    await expect(page.locator('.admin-comment-actions button', { hasText: 'Marquer résolu' })).toBeVisible({ timeout: 3000 })

    await page.reload()
    await page.waitForSelector('.admin-toolbar', { timeout: 4000 })
    await expect(page.locator('.admin-comment-count')).toHaveText('1', { timeout: 3000 })
  })

  test('une note en cours de saisie survit au chargement des demandes', async ({ page }) => {
    // Régression : le watcher de AdminToolbar observait l'objet `sidebarBlock`,
    // qui change d'identité à chaque mutation de props du bloc courant. Il
    // relançait donc GET /api/comments en pleine frappe et écrasait la note
    // avec la réponse — texte visible à l'écran, mais bouton « Créer la
    // demande » resté désactivé (`commentDraft` vidé côté Vue).
    let relacher: (() => void) | null = null
    const enAttente = new Promise<void>((r) => { relacher = r })
    await page.route('**/api/comments', async (route) => {
      if (route.request().method() === 'GET') await enAttente
      await route.continue()
    })

    await loginAsAdmin(page)
    await page.locator('.block-wrapper').first().click()

    const textarea = page.locator('.admin-comment-textarea')
    await textarea.fill('Note saisie pendant le chargement')
    // Le GET ne répond qu'APRÈS la frappe : c'est exactement l'ordre qui
    // faisait disparaître la saisie.
    relacher!()

    const bouton = page.locator('.admin-comment-actions button', { hasText: 'Créer la demande' })
    await expect(bouton).toBeEnabled({ timeout: 5000 })
    await expect(textarea).toHaveValue('Note saisie pendant le chargement')
  })
})

test.describe('API /api/comments', () => {
  test.beforeEach(async ({ request }) => {
    await resetMock(request)
  })

  test('POST sans données requises renvoie 400', async ({ request }) => {
    const res = await request.post('/api/comments', { data: { pageSlug: 'accueil' } })
    expect(res.status()).toBe(400)
  })

  test('cycle complet POST → GET → PUT → DELETE', async ({ request }) => {
    const created = await request.post('/api/comments', {
      data: { pageSlug: 'accueil', blockId: 'x', blockType: 'hero', blockLabel: 'Hero', message: 'test api' },
    })
    expect(created.ok()).toBe(true)
    const { comment } = await created.json()
    expect(comment.resolved).toBe(false)

    const list = await request.get('/api/comments')
    const { comments } = await list.json()
    expect(comments.some((c: any) => c.id === comment.id)).toBe(true)

    const updated = await request.put(`/api/comments/${comment.id}`, { data: { resolved: true } })
    expect(updated.ok()).toBe(true)

    const deleted = await request.delete(`/api/comments/${comment.id}`)
    expect(deleted.ok()).toBe(true)

    const listAfter = await request.get('/api/comments')
    const { comments: after } = await listAfter.json()
    expect(after.some((c: any) => c.id === comment.id)).toBe(false)
  })
})
