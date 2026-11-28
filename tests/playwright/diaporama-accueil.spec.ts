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
  test.beforeEach(async ({ request, context }) => {
    await seed(request)
    // Agenda vide : ces tests ne regardent que les affiches posées à la main
    // (l'ajout d'office depuis l'agenda est couvert plus bas).
    await context.route('**/api/church-events**', (route) => route.fulfill({ json: [] }))
  })

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

// ─── Alignement sur l'agenda ────────────────────────────────────────────
test.describe('Diaporama aligné sur l\'agenda', () => {
  test.use({ timezoneId: 'Europe/Paris' })

  const SOIREE_FIN = jour(2)
  const AFFICHE_SOIREE = {
    image: '/images/slides/soiree-cieux-ouverts-2026-11-27.jpg',
    alt: 'Soirée Cieux Ouverts : louange, prières. 19 h 30.',
    link: '/agenda',
    fin: SOIREE_FIN,
  }
  const fiche = (o: any) => ({ status: 'active', color: '', exceptions: [], ...o })

  async function seedAvec(request: any, items: any[]) {
    await resetMock(request)
    const bloc = { ...DIAPORAMA, props: { ...DIAPORAMA.props, items } }
    const res = await request.put('/api/pages/accueil', { data: { blocks: [bloc] } })
    expect(res.ok()).toBe(true)
  }

  test('les prochains événements à affiche s\'ajoutent d\'eux-mêmes, avec date et heure de l\'agenda', async ({ page, request }) => {
    await seedAvec(request, [{ image: '/images/slides/librairie-ephemere.jpg', alt: 'Librairie', fin: '' }])
    await page.route('**/api/church-events**', (route) => route.fulfill({
      json: [
        fiche({ id: 40, title: 'Concert de louange 🎶', start_date: jour(3), start_time: '18:00', image_url: '/images/slides/ecole-du-disciple-janvier.jpg' }),
        fiche({ id: 41, title: 'Réunion de prières', start_date: jour(-6), start_time: '19:30', repeat_period: 'week', image_url: '/images/slides/noel-2026-12-13.jpg' }),
      ],
    }))
    await page.goto('/')
    const bloc = page.locator('.block-diaporama')
    await expect(bloc.locator('.dia-slide')).toHaveCount(2, { timeout: 15000 })
    // Hebdomadaire exclue ; l'événement ponctuel arrive avant l'affiche sans date.
    const legende = bloc.locator('.dia-slide').first().locator('.dia-legende')
    await expect(legende).toContainText('Concert de louange')
    await expect(legende).toContainText('18 h')
    await expect(bloc.locator('.dia-slide').first().locator('a.dia-lien')).toHaveAttribute('href', '/agenda')
  })

  test('admin : alerte quand l\'heure de l\'affiche ne correspond plus à l\'agenda', async ({ page, request }) => {
    await seedAvec(request, [AFFICHE_SOIREE])
    await page.route('**/api/church-events**', (route) => route.fulfill({
      json: [fiche({ id: 23, title: 'Soirée Cieux Ouverts ❤️‍🔥', start_date: SOIREE_FIN, start_time: '20:00', image_url: '' })],
    }))
    await page.goto('/?admin=true')
    const verif = page.getByTestId('diaporama-verif')
    await expect(verif).toContainText('1 point à vérifier', { timeout: 15000 })
    await expect(verif).toContainText("l'affiche dit 19 h 30, l'agenda dit 20 h")
    await expect(page.locator('.dia-badge-alerte')).toBeVisible()
  })

  test('admin : tout est aligné, et rien n\'est montré aux visiteurs', async ({ page, request }) => {
    await seedAvec(request, [AFFICHE_SOIREE])
    await page.route('**/api/church-events**', (route) => route.fulfill({
      json: [fiche({ id: 23, title: 'Soirée Cieux Ouverts ❤️‍🔥', start_date: SOIREE_FIN, start_time: '19:30', image_url: '' })],
    }))
    await page.goto('/?admin=true')
    await expect(page.getByTestId('diaporama-verif')).toContainText('Diaporama aligné sur l\'agenda', { timeout: 15000 })
    await page.goto('/')
    await expect(page.locator('.block-diaporama')).toBeVisible({ timeout: 15000 })
    await expect(page.getByTestId('diaporama-verif')).toHaveCount(0)
  })

  test('agenda injoignable : le diaporama reste, l\'admin est prévenu', async ({ page, request }) => {
    await seedAvec(request, [AFFICHE_SOIREE])
    await page.route('**/api/church-events**', (route) => route.fulfill({ status: 503, body: 'down' }))
    await page.goto('/?admin=true')
    await expect(page.getByTestId('diaporama-verif')).toContainText('Agenda injoignable', { timeout: 15000 })
    await expect(page.locator('.dia-slide')).toHaveCount(1)
  })
})
