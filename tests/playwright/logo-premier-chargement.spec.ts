import { test, expect } from '@playwright/test'
import { resetMock } from './helpers/reset'

/**
 * À la première visite (rien en cache), le logo « Cieux Ouverts » de la
 * bannière d'accueil restait invisible plusieurs secondes : son entrée
 * (opacity 0 → 1) attendait l'hydratation, donc le téléchargement de tous les
 * bundles JS — 13 s sur une 4G lente, et pour toujours si l'hydratation
 * échouait. L'entrée est désormais une animation CSS jouée dès l'affichage.
 *
 * On bloque ici les bundles JS : la page reste telle que le serveur l'a
 * rendue, JavaScript activé (pas la classe `.no-js`, qui force déjà tout
 * visible), comme pendant ces secondes d'attente.
 */
test.use({ reducedMotion: 'no-preference' })

test.beforeEach(async ({ request }) => {
  await resetMock(request)
})

test("le logo de la bannière s'affiche sans attendre le JavaScript", async ({ page }) => {
  await page.route('**/_nuxt/*.js', route => route.abort())
  await page.goto('/', { waitUntil: 'load' })

  const titre = page.locator('.hero-name')
  await expect(titre).toBeVisible()
  await expect
    .poll(() => page.locator('.hero-content').evaluate(el => Number(getComputedStyle(el).opacity)), { timeout: 5000 })
    .toBe(1)
  expect(await titre.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)

  const logoMenu = page.locator('.site-header .logo')
  expect(await logoMenu.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)
})

test('les deux logos sont préchargés en tête de page', async ({ request }) => {
  const html = await (await request.get('/')).text()
  const tete = html.slice(0, html.indexOf('</head>'))
  expect(tete).toContain('<link rel="preload" as="image" href="/logo-nav.png" fetchpriority="high">')
  expect(tete).toMatch(/<link rel="preload" as="image" href="[^"]*hero-name[^"]*" fetchpriority="high">/)
  // Avant les modulepreload JS, sinon le préchargement attend derrière eux.
  expect(tete.indexOf('href="/logo-nav.png"')).toBeLessThan(tete.indexOf('rel="modulepreload"'))
})
