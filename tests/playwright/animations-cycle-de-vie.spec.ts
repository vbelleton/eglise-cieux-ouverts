import { test, expect } from '@playwright/test'
import { resetMock } from './helpers/reset'

/**
 * Cycle de vie du système d'animation (composables/useBlockAnimation.js) :
 * navigation entre pages, redimensionnement de la fenêtre, préférence
 * « réduire les animations ».
 */
const TOKEN = { Authorization: 'Bearer mock-test-token' }

test.beforeEach(async ({ request }) => {
  await resetMock(request)
})
test.afterEach(async ({ request }) => {
  await resetMock(request)
})

// Bloc animé loin sous la ligne de flottaison, entre deux grands espaceurs.
async function pageAvecBlocBas(request: any, extra: Record<string, any> = {}) {
  const blocks = [
    { id: 'cv-spacer', type: 'spacer', props: { height: 2000 } },
    {
      id: 'cv-bloc',
      type: 'richText',
      props: { content: '<p style="height:300px">Bloc animé du bas</p>', animation: 'slideUp' },
      ...extra,
    },
    { id: 'cv-spacer-bas', type: 'spacer', props: { height: 1200 } },
  ]
  const res = await request.put('/api/pages/test-blocks', { headers: TOKEN, data: { blocks } })
  expect(res.ok()).toBe(true)
}

// Navigation client (sans rechargement) via le routeur Nuxt — le layout et
// l'état de module du composable survivent, comme pour un vrai visiteur.
async function naviguer(page: any, chemin: string) {
  await page.evaluate((c: string) => {
    const app = (document.querySelector('#__nuxt') as any).__vue_app__
    return app.config.globalProperties.$router.push(c)
  }, chemin)
  await page.waitForTimeout(900)
}

test('navigation : revenir sur une page rejoue l\'entrée de ses blocs au lieu de les montrer déjà animés', async ({ page, request }) => {
  await pageAvecBlocBas(request)
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/test-blocks')
  await page.waitForLoadState('networkidle')
  const bloc = page.locator('.block-wrapper[data-block-id="cv-bloc"]')

  // Premier passage : le bloc n'est déclenché qu'une fois atteint
  await expect(bloc).not.toHaveClass(/triggered/)
  await bloc.scrollIntoViewIfNeeded()
  await expect(bloc).toHaveClass(/triggered/, { timeout: 3000 })

  // Aller ailleurs, puis revenir (on repart du haut de la page)
  await naviguer(page, '/messages')
  await naviguer(page, '/test-blocks')
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(400)

  // Le bloc est de nouveau hors de la fenêtre : il ne doit PAS être déjà
  // dans son état final, sinon son animation ne se joue plus jamais (les
  // navigateurs sans animation-timeline n'ont que la classe .triggered).
  await expect(page.locator('.block-wrapper[data-block-id="cv-bloc"]')).not.toHaveClass(/triggered/)
  await page.locator('.block-wrapper[data-block-id="cv-bloc"]').scrollIntoViewIfNeeded()
  await expect(page.locator('.block-wrapper[data-block-id="cv-bloc"]')).toHaveClass(/triggered/, { timeout: 3000 })
})

test('navigation : les écouteurs de rejeu ne s\'accumulent pas d\'une page à l\'autre', async ({ page }) => {
  // Compte les écouteurs 'replay-element-animation' réellement posés sur
  // document, moins ceux retirés.
  await page.addInitScript(() => {
    const w = window as any
    w.__ecouteursRejeu = 0
    const add = Document.prototype.addEventListener
    const remove = Document.prototype.removeEventListener
    Document.prototype.addEventListener = function (type: string, ...rest: any[]) {
      if (type === 'replay-element-animation' || type === 'replay-animation') w.__ecouteursRejeu++
      return (add as any).call(this, type, ...rest)
    }
    Document.prototype.removeEventListener = function (type: string, ...rest: any[]) {
      if (type === 'replay-element-animation' || type === 'replay-animation') w.__ecouteursRejeu--
      return (remove as any).call(this, type, ...rest)
    }
  })
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  const auDepart = await page.evaluate(() => (window as any).__ecouteursRejeu)

  for (const chemin of ['/messages', '/', '/event-list', '/', '/messages', '/']) {
    await naviguer(page, chemin)
  }
  const apres = await page.evaluate(() => (window as any).__ecouteursRejeu)
  console.log('ÉCOUTEURS DE REJEU départ/après →', auDepart, apres)
  expect(apres, 'une seule page montée : ses écouteurs, pas ceux des pages quittées').toBe(auDepart)
})

test('site public : changer de format d\'écran ne fait pas défiler la page vers un bloc', async ({ page, request }) => {
  // Animation différente sur tablette : franchir le seuil desktop/tablette
  // (rotation d'une tablette, redimensionnement) change l'animation résolue.
  await pageAvecBlocBas(request, { responsive: { tablet: { animation: 'zoom' } } })
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/test-blocks')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(500)
  expect(await page.evaluate(() => window.scrollY)).toBe(0)

  // Plusieurs bascules (tablette retournée dans un sens puis dans l'autre)
  const bloc = page.locator('.block-wrapper[data-block-id="cv-bloc"]')
  for (const largeur of [900, 1280, 900]) {
    await page.setViewportSize({ width: largeur, height: 800 })
    await page.waitForTimeout(1200)
  }
  // L'animation tablette est bien appliquée…
  await expect(bloc).toHaveClass(/block-anim-zoom/)
  // …sans arracher le visiteur à sa position de lecture
  expect(await page.evaluate(() => window.scrollY), 'la page ne doit pas défiler toute seule').toBe(0)
})

test('« réduire les animations » : les blocs à animation propre pilotée au scroll ne bougent plus', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/test-blocks')
  await page.waitForLoadState('networkidle')

  // Le bloc Rejoins (animation propre, au scroll) entre tout juste dans la
  // fenêtre : sans la préférence, son texte serait encore en train de glisser.
  await page.evaluate(() => {
    const w = document.querySelector('.block-wrapper[data-block-type="rejoins"]') as HTMLElement
    const top = w.getBoundingClientRect().top + window.scrollY
    window.scrollTo(0, top - window.innerHeight + 120)
  })
  await page.waitForTimeout(400)
  const r = await page.evaluate(() => {
    const t = document.querySelector('.rejoins-text-container') as HTMLElement
    const cs = getComputedStyle(t)
    return { opacite: Number(cs.opacity), transform: cs.transform }
  })
  console.log('REJOINS (reduced-motion) →', JSON.stringify(r))
  expect(r.opacite, 'le texte doit être directement visible').toBeGreaterThan(0.95)
  expect(['none', 'matrix(1, 0, 0, 1, 0, 0)']).toContain(r.transform)
})
