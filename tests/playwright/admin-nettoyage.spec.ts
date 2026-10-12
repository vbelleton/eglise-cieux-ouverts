import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './helpers/admin'
import { resetMock } from './helpers/reset'

test.beforeEach(async ({ request }) => { await resetMock(request) })
test.afterEach(async ({ request }) => { await resetMock(request) })

const MENU_RENOMME = [
  { id: 'accueil', label: 'Accueil', to: '/', visible: true, children: [] },
  { id: 'messages', label: 'Messages', to: '/messages', visible: true, children: [] },
  { id: 'agenda', label: 'Agenda', to: '/agenda', visible: true, children: [] },
  { id: 'event-list', label: 'Évènements sur inscription', to: '/event-list', visible: true, children: [] },
  { id: 'contact', label: 'Contact', to: '/contact', visible: true, children: [] },
]

test.describe('Libellés renommés dans le menu', () => {
  test.beforeEach(async ({ request }) => {
    const r = await request.put('/api/menu', { data: { menuItems: MENU_RENOMME } })
    expect(r.ok()).toBe(true)
  })

  test('le menu mobile affiche le nouveau nom dès le rendu serveur', async ({ request, page }) => {
    const html = await (await request.get('/')).text()
    expect(html).toContain('Évènements sur inscription')
    await page.setViewportSize({ width: 390, height: 800 })
    await page.goto('/')
    await page.locator('.burger').click()
    await expect(page.locator('.nav-mobile')).toContainText('Évènements sur inscription')
  })

  test('la liste déroulante des pages de l\'admin suit le nom du menu', async ({ page }) => {
    await loginAsAdmin(page)
    const options = page.locator('.admin-toolbar select option')
    await expect(options.filter({ hasText: 'Évènements sur inscription' })).toHaveCount(1)
    await expect(options.filter({ hasText: /^Événements$/ })).toHaveCount(0)
  })
})

test('page Contact : les réglages sans effet (questions, réseaux, image) sont masqués', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 })
  await loginAsAdmin(page, '/contact')
  await page.locator('.block-wrapper[data-block-type="contact"]').first().click({ force: true })
  const sidebar = page.locator('.admin-sidebar')
  await expect(sidebar).toBeVisible({ timeout: 8000 })
  // Sans carte : mise en page classique, les réglages sont utiles et visibles
  await expect(sidebar.locator('.field-label', { hasText: /^Questions intro$/ })).toHaveCount(1)
  // Avec une carte : mise en page « page Contact », ils disparaissent
  await sidebar.locator('.auto-field').filter({ has: page.locator('.field-label', { hasText: /^URL carte$/ }) })
    .locator('.field-input').first().fill('https://www.google.com/maps/embed?pb=test')
  await expect(sidebar.locator('.field-label', { hasText: /^Questions intro$/ })).toHaveCount(0)
  await expect(sidebar.locator('.field-label', { hasText: /^Image gauche$/ })).toHaveCount(0)
  await expect(sidebar.locator('.field-label', { hasText: /^Réseaux sociaux$/ })).toHaveCount(0)
  // Le panneau du formulaire, lui, est bien là
  await expect(sidebar).toContainText('Formulaire (champs et textes)')
  await expect(sidebar.locator('.field-label', { hasText: 'Champ « prénom »' })).toHaveCount(1)
})
