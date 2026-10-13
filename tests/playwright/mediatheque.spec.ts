import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './helpers/admin'
import { resetMock } from './helpers/reset'

test.beforeEach(async ({ request }) => {
  await resetMock(request)
  await request.put('/api/media/site-hidden', { headers: { Authorization: 'Bearer mock-test-token' }, data: { hidden: [] } })
})

test('médiathèque : images du site rangées par dossier et supprimables (elles disparaissent de la liste)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 })
  await loginAsAdmin(page, '/')
  await page.locator('.block-wrapper[data-block-type="hero"]').first().click({ force: true })
  const sidebar = page.locator('.admin-sidebar')
  await expect(sidebar).toBeVisible({ timeout: 8000 })
  await sidebar.getByRole('button', { name: /Médiathèque/ }).first().click()

  const dialog = page.getByRole('dialog', { name: 'Médiathèque' })
  await dialog.getByRole('tab', { name: /Images du site/ }).click()
  await expect(dialog.locator('h4', { hasText: 'Dossier « photos »' })).toBeVisible()
  await expect(dialog.locator('h4', { hasText: 'Dossier « images »' })).toBeVisible()
  await expect(dialog.locator('h4', { hasText: 'Logos et images générales' })).toBeVisible()

  const avant = await dialog.locator('.imglib-item').count()
  await dialog.locator('.imglib-item').first().click()
  page.once('dialog', d => d.accept())
  await dialog.getByRole('button', { name: /Supprimer/ }).click()
  await expect(dialog.locator('.imglib-item')).toHaveCount(avant - 1)

  // Le retrait est mémorisé : rouvrir la médiathèque ne les remontre pas.
  await dialog.getByRole('button', { name: 'Fermer la médiathèque' }).click()
  await sidebar.getByRole('button', { name: /Médiathèque/ }).first().click()
  await dialog.getByRole('tab', { name: /Images du site/ }).click()
  await expect(dialog.locator('.imglib-item')).toHaveCount(avant - 1)
})

test('médiathèque : chaque image indique où elle est affichée, et le filtre « non utilisées » marche', async ({ page, request }) => {
  await page.setViewportSize({ width: 1280, height: 1000 })
  // Une image téléversée, utilisée nulle part.
  const nom = `${Date.now()}_libre.png`
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==', 'base64')
  await request.post(`/api/media?key=${encodeURIComponent(`uploads/${nom}`)}`, { headers: { Authorization: 'Bearer mock-test-token', 'Content-Type': 'image/png' }, data: PNG })

  await loginAsAdmin(page, '/')
  await page.locator('.block-wrapper[data-block-type="hero"]').first().click({ force: true })
  const sidebar = page.locator('.admin-sidebar')
  await expect(sidebar).toBeVisible({ timeout: 8000 })
  await sidebar.getByRole('button', { name: /Médiathèque/ }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Médiathèque' })

  // L'image téléversée n'est affichée nulle part.
  await expect(dialog.locator('.imglib-item[title="libre.png"] .imglib-usage.libre').first()).toContainText('Non utilisée', { timeout: 10000 })

  // Le Hero de l'accueil affiche /foule-croix.png (image par défaut) : l'onglet du site le dit.
  await dialog.getByRole('tab', { name: /Images du site/ }).click()
  const tuile = dialog.locator('.imglib-item[title="foule-croix.png"]')
  await expect(tuile.locator('.imglib-usage')).toContainText('📍')
  await expect(tuile.locator('.imglib-usage')).toHaveAttribute('title', /Accueil \(Hero/)
  await tuile.click()
  await expect(dialog.locator('.imglib-count')).toContainText('Affichée sur :')
  await expect(dialog.locator('.imglib-count')).toContainText('Accueil (Hero')

  // Filtre « Non utilisées » : plus aucune image affichée sur l'accueil.
  await dialog.getByLabel("Filtrer selon l'utilisation").selectOption('libres')
  await expect(dialog.locator('.imglib-item[title="foule-croix.png"]')).toHaveCount(0)
  await expect(dialog.locator('.imglib-usage.libre').first()).toBeVisible()
})
