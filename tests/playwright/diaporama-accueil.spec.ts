import { test, expect, type Page } from '@playwright/test'
import { resetMock } from './helpers/reset'

// Dates relatives au jour du test : le spec ne doit pas expirer avec les
// affiches réelles.
function jour(offset: number) {
  const d = new Date(Date.now() + offset * 86400000)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(d)
}

const DIAPORAMA = {
  id: 'test-diaporama',
  type: 'diaporama',
  props: {
    interval: 3,
    items: [
      { image: '/images/slides/noel-2026-12-13.jpg', alt: 'Affiche à venir A', link: '/agenda', fin: jour(5) },
      { image: '/images/slides/autel-perime.jpg', alt: 'Affiche périmée', link: '', fin: jour(-1) },
      { image: '/images/slides/baptemes-2027-01-10.jpg', alt: 'Affiche du jour B', link: '', fin: jour(0) },
      { image: '/images/slides/librairie-ephemere.jpg', alt: 'Affiche sans date C', link: '', fin: '' },
    ],
  },
  visibility: { desktop: true, tablet: true, mobile: true },
}

async function seed(request: any) {
  await resetMock(request)
  const res = await request.put('/api/pages/accueil', { data: { blocks: [DIAPORAMA] } })
  expect(res.ok()).toBe(true)
}

async function positionPiste(page: Page) {
  return page.locator('.dia-piste').evaluate((el: HTMLElement) => Math.round(el.scrollLeft / el.clientWidth))
}

test.describe('Diaporama d\'affiches en page d\'accueil', () => {
  test.beforeEach(async ({ request }) => { await seed(request) })

  test('masque l\'affiche périmée, garde celle du jour et celle sans date', async ({ page }) => {
    await page.goto('/')
    const bloc = page.locator('.block-diaporama')
    await expect(bloc).toBeVisible({ timeout: 15000 })
    await expect(bloc.locator('img.dia-image')).toHaveCount(3)
    await expect(bloc.getByAltText('Affiche périmée')).toHaveCount(0)
    await expect(bloc.getByAltText('Affiche du jour B')).toHaveCount(1)
    await expect(bloc.locator('a.dia-lien[href="/agenda"]')).toHaveCount(1)
  })

  test('flèches, points et pause', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    await expect(page.locator('.block-diaporama')).toBeVisible({ timeout: 15000 })
    // Mouvement réduit : pas de défilement automatique, bouton « relancer ».
    await expect(page.getByRole('button', { name: 'Relancer le diaporama' })).toBeVisible()
    await page.getByRole('button', { name: 'Affiche suivante' }).click()
    await expect.poll(() => positionPiste(page)).toBe(1)
    await page.getByRole('button', { name: 'Affiche 3' }).click()
    await expect.poll(() => positionPiste(page)).toBe(2)
    await expect(page.getByRole('button', { name: 'Affiche 3' })).toHaveAttribute('aria-current', 'true')
    // Boucle : après la dernière, la première.
    await page.getByRole('button', { name: 'Affiche suivante' }).click()
    await expect.poll(() => positionPiste(page)).toBe(0)
  })

  test('défile tout seul, et s\'arrête avec le bouton pause', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.block-diaporama')).toBeVisible({ timeout: 15000 })
    await page.mouse.move(0, 0)
    await expect.poll(() => positionPiste(page), { timeout: 8000 }).toBe(1)
    await page.getByRole('button', { name: 'Mettre le diaporama en pause' }).click()
    await page.mouse.move(0, 0)
    const avant = await positionPiste(page)
    await page.waitForTimeout(4500)
    expect(await positionPiste(page)).toBe(avant)
  })

  test('sans JavaScript : affiches rendues, commandes retirées', async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false })
    const page = await ctx.newPage()
    await page.goto('/')
    await expect(page.locator('.block-diaporama img.dia-image')).toHaveCount(3)
    await expect(page.locator('.dia-fleche').first()).toBeHidden()
    await expect(page.locator('.dia-commandes')).toBeHidden()
    await ctx.close()
  })

  test('aucune affiche valable : le bloc ne s\'affiche pas', async ({ page, request }) => {
    const vide = { ...DIAPORAMA, props: { ...DIAPORAMA.props, items: [{ image: '/x.jpg', alt: 'x', fin: jour(-3) }] } }
    await request.put('/api/pages/accueil', { data: { blocks: [vide, { id: 'q', type: 'quote', props: { quote: 'Repère' }, visibility: { desktop: true, tablet: true, mobile: true } }] } })
    await page.goto('/')
    await expect(page.getByText('Repère')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('.block-diaporama')).toHaveCount(0)
  })
})
