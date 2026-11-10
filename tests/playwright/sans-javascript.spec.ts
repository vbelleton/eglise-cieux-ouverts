import { test, expect } from '@playwright/test'
import { resetMock } from './helpers/reset'

/**
 * Site utilisable avec JavaScript désactivé (assets/css/no-js.css, classe
 * `no-js` retirée par le script de tête dès que JS s'exécute) : menu, envoi
 * du formulaire de contact, agenda, vidéo. Et l'inverse : avec JS, aucun des
 * éléments de repli n'apparaît.
 */

test.describe('Sans JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test.beforeEach(async ({ request }) => {
    await resetMock(request)
  })

  test('ordinateur : le menu est visible', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/')
    await expect(page.locator('html')).toHaveClass(/no-js/)
    await expect(page.locator('.nav-desktop a', { hasText: 'Contact' })).toBeVisible()
  })

  test('téléphone : le ☰ ouvre et ferme le menu sans JS', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    await expect(page.locator('button.burger')).toBeHidden()
    const nav = page.locator('#mobile-navigation')
    await expect(nav).toBeHidden()

    await page.locator('.burger-ouvrir').click()
    await expect(nav).toBeVisible()
    await expect(nav.locator('a', { hasText: 'Contact' })).toBeVisible()

    await page.locator('.burger-fermer').click()
    await expect(nav).toBeHidden()
  })

  test('le formulaire de contact s\'envoie et confirme l\'envoi', async ({ page, request }) => {
    await page.goto('/contact')
    await page.getByPlaceholder('Prénom *').fill('Jeanne')
    await page.getByPlaceholder('Nom de famille *').fill('SansJs')
    await page.getByPlaceholder('Email *').fill('jeanne@example.com')
    await page.getByPlaceholder('Ton Message *').fill('Bonjour, message envoyé sans JavaScript.')
    // Le serveur ignore un envoi arrivé moins de 3 s après l'affichage (robot).
    await page.waitForTimeout(3200)
    await page.getByRole('button', { name: "C'est parti !" }).click()

    await expect(page).toHaveURL(/\/contact\?envoi=ok&formulaire=contact#formulaire-contact$/)
    await expect(page.locator('.success-msg')).toBeVisible()
    const { contacts } = await (await request.get('/api/contacts')).json()
    expect(contacts.map((c: any) => `${c.prenom} ${c.nom}`)).toContain('Jeanne SansJs')
    expect(contacts.find((c: any) => c.nom === 'SansJs').source).toBe('/contact')
  })

  test('une erreur du serveur s\'affiche sur la page', async ({ page }) => {
    await page.goto('/contact')
    await page.getByPlaceholder('Prénom *').fill('Jeanne')
    await page.getByPlaceholder('Nom de famille *').fill('SansJs')
    await page.getByPlaceholder('Email *').fill('jeanne@example.com')
    await page.getByPlaceholder('Ton Message *').fill('court')
    await page.waitForTimeout(3200)
    await page.getByRole('button', { name: "C'est parti !" }).click()

    await expect(page).toHaveURL(/envoi=court/)
    await expect(page.locator('.error-msg')).toHaveText('Ton message est un peu trop court.')
  })

  test('un envoi instantané (robot) n\'est pas enregistré', async ({ page, request }) => {
    await page.goto('/contact')
    await page.getByPlaceholder('Prénom *').fill('Robot')
    await page.getByPlaceholder('Nom de famille *').fill('Pressé')
    await page.getByPlaceholder('Email *').fill('robot@example.com')
    await page.getByPlaceholder('Ton Message *').fill('Message posté aussitôt la page reçue.')
    await page.getByRole('button', { name: "C'est parti !" }).click()

    await expect(page).toHaveURL(/envoi=ok/)
    const { contacts } = await (await request.get('/api/contacts')).json()
    expect(contacts).toHaveLength(0)
  })

  test('l\'agenda remplace « Chargement… » par un message utile', async ({ page }) => {
    await page.goto('/agenda')
    await expect(page.locator('.message-sans-js')).toBeVisible()
    await expect(page.locator('.message-sans-js a[href="/contact"]')).toBeVisible()
    await expect(page.getByText('Chargement des événements')).toBeHidden()
  })

  test('la vidéo YouTube s\'ouvre sur YouTube', async ({ page }) => {
    await page.goto('/messages')
    const lien = page.locator('.facade-lien-sans-js').first()
    await expect(lien).toBeVisible()
    await expect(lien).toHaveAttribute('href', /^https:\/\/www\.youtube\.com\/watch\?v=[\w-]{11}$/)
  })
})

test.describe('Avec JavaScript', () => {
  test('aucun élément de repli sans-JS n\'est visible', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/messages')
    await expect(page.locator('html')).not.toHaveClass(/no-js/)
    for (const el of await page.locator('.nojs-only').all()) await expect(el).toBeHidden()
    await expect(page.locator('button.burger')).toBeVisible()
  })

  test('après un envoi sans JS, la redirection reste sur le site', async ({ request }) => {
    // Envoi « formulaire » (urlencoded) avec un retour hors du site : la
    // redirection reste interne.
    const res = await request.post('/api/contact', {
      form: { formulaire: 'contact', retour: '//exemple.com/piege', ouvert: String(Date.now() - 10_000), prenom: 'A', nom: 'B', email: 'a@b.fr', message: 'Un message assez long.' },
      maxRedirects: 0,
    })
    expect(res.status()).toBe(303)
    expect(res.headers()['location']).toBe('/contact?envoi=ok&formulaire=contact#formulaire-contact')
  })
})
