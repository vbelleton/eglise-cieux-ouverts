import { test, expect, type Page } from '@playwright/test'
import { resetMock } from './helpers/reset'

/**
 * Application installable et hors ligne (public/sw.js, plugins/pwa.client.ts).
 *
 * Le service worker n'est pas enregistré pendant les tests E2E (un cache
 * entre deux tests fausserait le mock) ; ce fichier l'active explicitement
 * via `localStorage['pwa-test']`. Chaque test a son propre contexte
 * navigateur, donc son propre service worker et ses propres caches.
 *
 * `context.setOffline(true)` coupe aussi le réseau du service worker : c'est
 * le seul moyen fiable de simuler le hors ligne ici, `page.route` ne voyant
 * pas les requêtes servies par le service worker.
 *
 * Les navigations passent par `location.assign`, comme un clic de visiteur.
 */

async function activerServiceWorker(page: Page) {
  await page.addInitScript(() => {
    try { localStorage.setItem('pwa-test', '1') } catch {}
  })
  await page.goto('/')
  await page.waitForFunction(async () => {
    const reg = await navigator.serviceWorker.getRegistration()
    return reg?.active?.state === 'activated'
  }, null, { timeout: 15000 })
  // Situation d'un visiteur qui revient : la page est contrôlée par le
  // service worker dès sa navigation. Juste après la toute première
  // activation, Chromium n'a pas toujours fini d'enregistrer le service
  // worker et sert encore la page suivante sans lui : on recharge jusqu'à
  // ce que la navigation soit bien passée par lui (`workerStart` non nul).
  await expect.poll(async () => {
    await naviguer(page, '/')
    return page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      return Boolean(navigator.serviceWorker.controller) && nav.workerStart > 0
    })
  }, { timeout: 15000, intervals: [300] }).toBe(true)
}

async function naviguer(page: Page, chemin: string) {
  await Promise.all([
    page.waitForEvent('load'),
    page.evaluate(c => location.assign(c), chemin),
  ])
}

const enCache = (page: Page, url: string) =>
  page.evaluate(u => caches.match(new URL(u, location.href).href).then(Boolean), url)

// La mise en cache se fait après la réponse (event.waitUntil) : on attend
// qu'elle soit écrite avant de couper le réseau.
const attendreEnCache = (page: Page, url: string) =>
  expect.poll(() => enCache(page, url), { timeout: 5000 }).toBe(true)

const lire = (page: Page, url: string) =>
  page.evaluate(u => fetch(u, { cache: 'no-store' }).then(r => (r.ok ? 'ok' : `http-${r.status}`), () => 'erreur'), url)

test.describe('PWA', () => {
  test.beforeEach(async ({ request }) => {
    await resetMock(request)
  })

  test('le site déclare un manifeste installable', async ({ page, request }) => {
    await page.goto('/')
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest')
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#064886')
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', '/favicon-180.png')

    const res = await request.get('/manifest.webmanifest')
    expect(res.ok()).toBe(true)
    const manifeste = await res.json()
    expect(manifeste.display).toBe('standalone')
    expect(manifeste.start_url).toBe('/')
    const tailles = manifeste.icons.map((i: any) => `${i.sizes} ${i.purpose}`)
    expect(tailles).toEqual(expect.arrayContaining(['192x192 any', '512x512 any', '512x512 maskable']))
    for (const icone of manifeste.icons) {
      expect((await request.get(icone.src)).ok(), icone.src).toBe(true)
    }
  })

  test('sans le drapeau de test, aucun service worker n\'est enregistré', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('load')
    await page.waitForTimeout(500)
    const enregistre = await page.evaluate(async () => Boolean(await navigator.serviceWorker.getRegistration()))
    expect(enregistre).toBe(false)
  })

  test('une page déjà visitée reste consultable hors ligne', async ({ page, context }) => {
    await activerServiceWorker(page)
    await naviguer(page, '/contact')
    await expect(page.locator('main#contenu')).toBeVisible()
    await attendreEnCache(page, '/contact')
    const titreEnLigne = await page.title()

    await naviguer(page, '/')
    await context.setOffline(true)
    await naviguer(page, '/contact')
    await expect(page.locator('main#contenu')).toBeVisible()
    expect(await page.title()).toBe(titreEnLigne)
  })

  test('une page jamais visitée affiche la page hors connexion', async ({ page, context }) => {
    await activerServiceWorker(page)
    await context.setOffline(true)
    await naviguer(page, '/agenda')
    await expect(page.getByRole('heading', { name: 'Pas de connexion' })).toBeVisible()
  })

  test('le contenu public est mis en cache, la sentinelle de déploiement jamais', async ({ page, context }) => {
    await activerServiceWorker(page)
    expect(await lire(page, '/api/pages/accueil')).toBe('ok')
    await attendreEnCache(page, '/api/pages/accueil')
    expect(await lire(page, '/version.txt')).toBe('ok')

    await context.setOffline(true)
    expect(await lire(page, '/api/pages/accueil')).toBe('ok')
    // plugins/deployment-check.client.ts doit toujours voir la version en ligne.
    expect(await lire(page, '/version.txt')).toBe('erreur')
  })

  test('l\'admin n\'est jamais servi depuis le cache', async ({ page, context }) => {
    await activerServiceWorker(page)
    // Contenu mis en cache depuis le site public…
    expect(await lire(page, '/api/pages/accueil')).toBe('ok')
    await attendreEnCache(page, '/api/pages/accueil')

    // …puis ouvert en admin : hors ligne, la lecture doit échouer pour que
    // l'éditeur sache qu'il n'a rien chargé (sinon l'auto-save pourrait
    // écrire une copie périmée par-dessus la vraie page).
    await naviguer(page, '/contact?admin=true')
    // Une page ouverte en admin n'est pas non plus mise en cache.
    await page.waitForTimeout(500)
    expect(await enCache(page, '/contact')).toBe(false)

    await context.setOffline(true)
    expect(await lire(page, '/api/pages/accueil')).toBe('erreur')
  })

  test('le service worker est enregistré sans erreur de console', async ({ page }) => {
    const erreurs: string[] = []
    page.on('console', m => { if (m.type() === 'error') erreurs.push(m.text()) })
    await activerServiceWorker(page)
    expect(erreurs.filter(e => /sw\.js|service ?worker/i.test(e))).toEqual([])
  })
  test('le bandeau propose l\'installation quand le navigateur le permet', async ({ page }) => {
    await page.goto('/')
    const bandeau = page.getByRole('complementary', { name: "Installer l'application" })
    await expect(bandeau).toHaveCount(0)

    // Simule la proposition d'installation de Chrome/Android.
    await page.evaluate(() => {
      const e: any = new Event('beforeinstallprompt', { cancelable: true })
      e.prompt = () => { (window as any).__invite = true }
      e.userChoice = Promise.resolve({ outcome: 'accepted' })
      window.dispatchEvent(e)
    })
    await expect(bandeau).toBeVisible()
    await bandeau.getByRole('button', { name: 'Installer' }).click()
    expect(await page.evaluate(() => (window as any).__invite)).toBe(true)
    await expect(bandeau).toHaveCount(0)
  })

  test('sur iPhone, le bandeau explique l\'ajout à l\'écran d\'accueil et se masque', async ({ browser }) => {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      viewport: { width: 390, height: 844 },
    })
    const page = await context.newPage()
    await page.goto('http://localhost:3001/')
    const bandeau = page.getByRole('complementary', { name: "Installer l'application" })
    await expect(bandeau).toContainText("Sur l'écran d'accueil")
    await bandeau.getByRole('button', { name: 'Ne plus proposer' }).click()
    await expect(bandeau).toHaveCount(0)
    await page.reload()
    await page.waitForLoadState('load')
    await page.waitForTimeout(300)
    await expect(bandeau).toHaveCount(0)
    await context.close()
  })

  test('le bandeau n\'apparaît jamais en admin', async ({ browser }) => {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    })
    const page = await context.newPage()
    await page.goto('http://localhost:3001/?admin=true')
    await page.waitForSelector('.admin-toolbar', { timeout: 5000 })
    await expect(page.getByRole('complementary', { name: "Installer l'application" })).toHaveCount(0)
    await context.close()
  })
})
