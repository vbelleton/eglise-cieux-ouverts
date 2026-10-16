import { test, expect } from '@playwright/test'
import { resetMock } from './helpers/reset'

/**
 * Animation des éléments libres (props.extraElements) et aperçu des
 * animations dans l'éditeur.
 *
 * Chaque élément libre porte sa propre classe .block-anim-* (choix
 * « Animation » de la sidebar). Trois causes empêchaient qu'on la voie :
 *
 *  1. il vit DANS le .block-wrapper, et tout bloc à sélecteur reçoit la
 *     classe `bloc-anim-controlee`, dont la règle descendante
 *     (assets/css/main.css) ramène toutes les animations internes à 0,01 ms
 *     pour couper les @keyframes propres à Bienvenue/Contact/Vision ;
 *  2. `.bee-canvas` était en `overflow: hidden`, donc conteneur de
 *     défilement : animation-timeline: view() s'y calait, et l'élément, déjà
 *     entièrement visible dans son canvas, avait fini son animation avant
 *     même que le bloc n'entre à l'écran ;
 *  3. dans l'éditeur, l'aperçu (.anim-rejeu) basculait la timeline sans
 *     relancer l'animation : elle restait bloquée en attente, le bloc ou
 *     l'élément s'affichait directement dans son état final.
 */
const TOKEN = { Authorization: 'Bearer mock-test-token' }

test.use({ viewport: { width: 1280, height: 800 } })

test.beforeEach(async ({ request }) => {
  await resetMock(request)
})
test.afterEach(async ({ request }) => {
  await resetMock(request)
})

async function preparePage(request: any, animationBloc = 'none', animationElement = 'slideUp') {
  const blocks = [
    // Pousse le bloc testé sous la ligne de flottaison
    { id: 'el-spacer', type: 'spacer', props: { height: 1600 } },
    {
      id: 'el-bloc',
      type: 'richText',
      props: {
        content: '<p style="height:500px">Bloc portant un élément libre</p>',
        animation: animationBloc,
        extraElements: [
          {
            id: 'el-1', kind: 'text', text: 'Élément libre animé',
            xPct: 10, yPct: 0, wPct: 40, hPct: 40, z: 1,
            animation: animationElement,
          },
        ],
      },
    },
    { id: 'el-spacer-bas', type: 'spacer', props: { height: 1600 } },
  ]
  const res = await request.put('/api/pages/test-blocks', { headers: TOKEN, data: { blocks } })
  expect(res.ok()).toBe(true)
}

function releveElement(page: any) {
  return page.evaluate(() => {
    const el = document.querySelector('.bee-el') as HTMLElement
    const a = ((el?.getAnimations?.() || []) as any[]).find((x) => x.animationName === 'animSlideUp')
    return {
      wrapperClasses: (el?.closest('.block-wrapper') as HTMLElement)?.className || '',
      opacite: el ? Number(getComputedStyle(el).opacity) : null,
      timeline: a ? a.timeline?.constructor?.name : null,
      progression: a ? a.effect?.getComputedTiming?.().progress : null,
    }
  })
}

// Échantillonne l'opacité d'un élément à chaque image pendant ~1,2 s.
function echantillonneOpacite(page: any, selecteur: string) {
  return page.evaluate((sel: string) => new Promise<number[]>((resolve) => {
    const vals: number[] = []
    const t0 = performance.now()
    const tick = () => {
      const el = document.querySelector(sel) as HTMLElement
      if (el) vals.push(Number(getComputedStyle(el).opacity))
      if (performance.now() - t0 < 1200) requestAnimationFrame(tick)
      else resolve(vals)
    }
    requestAnimationFrame(tick)
  }), selecteur)
}

async function ouvreBlocDansEditeur(page: any) {
  await page.goto('/test-blocks?admin=true')
  await page.waitForSelector('.admin-toolbar', { timeout: 10000 })
  await page.locator('.block-wrapper[data-block-id="el-bloc"]').scrollIntoViewIfNeeded()
  await page.waitForTimeout(800)
  await page.locator('.block-wrapper[data-block-id="el-bloc"]').click({ position: { x: 900, y: 400 } })
  await expect(page.locator('.admin-sidebar')).toBeVisible({ timeout: 5000 })
}

test('site public : l\'animation d\'un élément libre suit le scroll au lieu d\'être coupée', async ({ page, request }) => {
  await preparePage(request)
  await page.goto('/test-blocks')
  await page.waitForLoadState('networkidle')

  // Amène le haut de l'élément à 30 % de sa hauteur au-dessus du bas de la
  // fenêtre (deux passes : la première mesure peut précéder un recalage).
  for (let i = 0; i < 2; i++) {
    await page.evaluate(() => {
      const el = document.querySelector('.bee-el') as HTMLElement
      const cible = window.innerHeight - el.offsetHeight * 0.3
      // Position de mise en page (sans le transform de l'animation)
      const haut = (el.offsetParent as HTMLElement).getBoundingClientRect().top + el.offsetTop
      window.scrollBy({ top: haut - cible, behavior: 'instant' as ScrollBehavior })
    })
    await page.waitForTimeout(300)
  }
  const r = await releveElement(page)
  console.log('ÉLÉMENT LIBRE (public) →', JSON.stringify(r))

  expect(r.wrapperClasses).toContain('bloc-anim-controlee')
  expect(r.timeline, 'l\'animation de l\'élément doit rester pilotée au scroll').toBe('ViewTimeline')
  expect(r.progression, 'à peine entré, l\'animation doit être en cours').toBeGreaterThan(0.05)
  expect(r.progression).toBeLessThan(0.9)
  expect(r.opacite!, 'à peine entré, l\'élément doit être en cours d\'apparition').toBeLessThan(0.9)

  // Une fois entièrement entré, il est pleinement visible
  await page.evaluate(() => (document.querySelector('.bee-el') as HTMLElement).scrollIntoView({ block: 'center' }))
  await page.waitForTimeout(400)
  const fin = await releveElement(page)
  expect(fin.opacite!).toBeGreaterThan(0.95)
})

test('éditeur : changer l\'animation d\'un élément libre la rejoue réellement', async ({ page, request }) => {
  await preparePage(request, 'none', 'fadeIn')
  await ouvreBlocDansEditeur(page)
  const select = page.locator('.field-elements .array-item-anim-row select').first()
  await expect(select).toBeVisible({ timeout: 5000 })

  const echantillons = echantillonneOpacite(page, '.bee-el')
  await select.selectOption('slideUp')
  const vals = await echantillons
  console.log('ÉLÉMENT LIBRE (aperçu) →', vals.map((v) => v.toFixed(2)).join(' '))

  // Un saut direct 0 → 1 (animation coupée) ne donne aucune valeur
  // intermédiaire ; une vraie lecture de 0,8 s en donne des dizaines.
  const intermediaires = vals.filter((v) => v > 0.05 && v < 0.95)
  expect(intermediaires.length, 'l\'aperçu doit montrer l\'élément en train d\'apparaître').toBeGreaterThan(5)
  await page.waitForTimeout(800)
  expect(Number(await page.locator('.bee-el').evaluate((el) => getComputedStyle(el).opacity))).toBeGreaterThan(0.95)
})

test('éditeur : changer l\'animation d\'un bloc la rejoue réellement (pas seulement « running »)', async ({ page, request }) => {
  await preparePage(request, 'none', 'none')
  await ouvreBlocDansEditeur(page)

  const selecteur = '.block-wrapper[data-block-id="el-bloc"]'
  const echantillons = echantillonneOpacite(page, selecteur)
  await page.locator('.admin-sidebar .anim-btn', { hasText: 'Glisse haut' }).first().click()
  const vals = await echantillons
  console.log('BLOC (aperçu) →', vals.map((v) => v.toFixed(2)).join(' '))

  await expect(page.locator(selecteur)).toHaveClass(/block-anim-slideUp/)
  const intermediaires = vals.filter((v) => v > 0.05 && v < 0.95)
  expect(intermediaires.length, 'l\'aperçu doit montrer le bloc en train d\'apparaître').toBeGreaterThan(5)
  await page.waitForTimeout(800)
  expect(Number(await page.locator(selecteur).evaluate((el) => getComputedStyle(el).opacity))).toBeGreaterThan(0.95)
})
