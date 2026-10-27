import { test, expect, type Page } from '@playwright/test'
import { resetMock } from './helpers/reset'

/**
 * « Bienvenue » s'affichait à l'arrivée sur le site, mais plus en revenant
 * sur l'accueil depuis une autre page : sur une navigation interne, ses
 * animations pilotées au scroll (titre lettre par lettre, entrée du bloc)
 * pouvaient rester figées sur leur première image, à opacity 0.
 *
 * Le blocage dépend du navigateur et n'apparaît pas dans le Chromium de test :
 * on le provoque en figeant (pause) ces animations tant que la transition
 * d'entrée de page est en cours. plugins/relance-animations-scroll.client.ts
 * doit les relancer une fois la transition terminée.
 */

test.use({ reducedMotion: 'no-preference', viewport: { width: 1280, height: 800 } })

async function regleAnimationBienvenue(page: Page, animation: string) {
  const res = await page.request.get('/api/pages/accueil')
  const { blocks } = await res.json()
  const bloc = blocks.find((b: any) => b.type === 'bienvenue')
  bloc.props = { ...(bloc.props || {}), animation }
  const put = await page.request.put('/api/pages/accueil', { data: { blocks } })
  expect(put.ok()).toBeTruthy()
}

async function defileJusquaBienvenue(page: Page) {
  // Défilement progressif, comme un visiteur : un saut direct ne passerait
  // pas par les étapes intermédiaires des animations de scroll.
  for (let i = 0; i < 40; i++) {
    const top = await page.evaluate(
      () => document.querySelector('.block-bienvenue')?.getBoundingClientRect().top,
    )
    if (top !== undefined && top < 150) break
    await page.mouse.wheel(0, 120)
    await page.waitForTimeout(50)
  }
}

async function bienvenueVisible(page: Page) {
  return page.evaluate(() => {
    const bloc = document.querySelector('.block-bienvenue')
    if (!bloc) return false
    const lettres = [...bloc.querySelectorAll('.hero-bienvenue-char')]
    const elements = [bloc.closest('.block-wrapper')!, bloc.querySelector('.hero-subtitle')!, ...lettres]
    return lettres.length > 0 && elements.every((el) => Number(getComputedStyle(el).opacity) > 0.95)
  })
}

for (const animation of ['origine', 'portal']) {
  test(`« Bienvenue » réapparaît en revenant sur l'accueil (animation ${animation})`, async ({ page }) => {
    await resetMock(page.request)
    await regleAnimationBienvenue(page, animation)

    // Fige, tant que la transition d'entrée de page est en cours, les
    // animations de scroll du bloc : c'est l'état bloqué observé dans le
    // navigateur. Une fois la transition finie, on n'y touche plus.
    await page.addInitScript(() => {
      const w = window as any
      w.__figeBienvenue = false
      const fige = () => {
        if (w.__figeBienvenue && document.querySelector('.page-enter-from, .page-enter-active')) {
          const bloc = document.querySelector('.block-bienvenue')
          const wrapper = bloc?.closest('.block-wrapper')
          if (bloc && wrapper) {
            for (const a of [...wrapper.getAnimations(), ...bloc.getAnimations({ subtree: true })]) {
              const cible = (a.effect as KeyframeEffect | null)?.target as Element | null
              // Seules les animations que la feuille de style rattache bien
              // au scroll (pas celles neutralisées par .bloc-anim-controlee).
              if (!cible || getComputedStyle(cible).animationTimeline === 'auto') continue
              if (a.timeline && !(a.timeline instanceof DocumentTimeline) && a.playState !== 'paused') a.pause()
            }
          }
        }
        requestAnimationFrame(fige)
      }
      requestAnimationFrame(fige)
    })

    await page.goto('/')
    await defileJusquaBienvenue(page)
    await expect.poll(() => bienvenueVisible(page)).toBe(true)

    await page.locator('header a[href="/contact"]').first().click()
    await expect(page).toHaveURL(/\/contact$/)
    await page.evaluate(() => { (window as any).__figeBienvenue = true })

    await page.locator('header a[href="/"]').first().click()
    await expect(page).toHaveURL(/\/$/)
    await page.locator('.block-bienvenue').waitFor()
    await defileJusquaBienvenue(page)

    await expect.poll(() => bienvenueVisible(page), { timeout: 5000 }).toBe(true)
  })
}
