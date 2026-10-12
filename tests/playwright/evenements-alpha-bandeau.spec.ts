import { test, expect } from '@playwright/test'
import { resetMock } from './helpers/reset'

// Le Worker événements (eglise-app) est simulé : contenu maîtrisé et aucune
// dépendance réseau.
function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const jour = (offset: number) => { const d = new Date(); d.setDate(d.getDate() + offset); return iso(d) }

const EVENEMENTS = [
  // Ponctuel à venir
  { id: 1, title: 'Soirée louange test', start_date: jour(10), end_date: jour(10), start_time: '20:00', end_time: '22:00', location: 'Salle', repeat_period: null, status: 'active', exceptions: [] },
  // Ponctuel terminé hier : ne doit plus apparaître
  { id: 2, title: 'Atelier terminé', start_date: jour(-1), end_date: jour(-1), start_time: '18:00', repeat_period: null, status: 'active', exceptions: [] },
  // Série hebdomadaire terminée il y a un mois : ne doit plus apparaître
  { id: 3, title: 'Série finie', start_date: jour(-120), end_date: jour(-30), start_time: '19:00', repeat_period: 'week', status: 'active', exceptions: [] },
  // Série hebdomadaire sans fin : une seule carte (sa prochaine date)
  { id: 4, title: 'Culte hebdo test', start_date: jour(-60), end_date: jour(-60), start_time: '10:00', repeat_period: 'week', status: 'active', exceptions: [] },
]

async function simulerWorker(page: import('@playwright/test').Page) {
  await page.route('**/api/church-events*', (route) => route.fulfill({ json: EVENEMENTS }))
}

// Contenu historique de la page Événements, tel que sauvegardé en Firestore
// sans jamais avoir été retouché.
const PAGE_HISTORIQUE = [{
  id: 'default-billetterie-0',
  type: 'richText',
  props: {
    content: `<div style="max-width:820px;margin:0 auto;text-align:center;"><h1>Billetterie Événements</h1><p>Découvrez et réservez vos places pour nos prochains événements.</p><p><strong>Aucun événement pour le moment.</strong></p><p>Revenez bientôt pour de nouvelles dates.</p></div>`,
    backgroundColor: '#ffffff', textColor: '#1a1a2e', textAlign: 'left', padding: 70, animation: 'fadeIn',
  },
  visibility: { desktop: true, tablet: true, mobile: true },
}]

test.describe('Page Événements : parcours Alpha et prochains événements', () => {
  test.beforeEach(async ({ request }) => {
    await resetMock(request)
  })

  test('la page jamais éditée passe sur le nouveau contenu (Alpha + liste)', async ({ page, request }) => {
    const res = await request.put('/api/pages/event-list', { data: { blocks: PAGE_HISTORIQUE } })
    expect(res.ok()).toBe(true)
    await simulerWorker(page)

    await page.goto('/event-list')
    await expect(page.getByRole('heading', { name: 'Parcours Alpha', exact: true })).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Aucun événement pour le moment.')).toHaveCount(0)
    await expect(page.getByRole('link', { name: /inscris au parcours Alpha/ })).toHaveAttribute('href', '#inscription-alpha')

    await expect(page.getByText('Qui est Jésus ?')).toBeVisible()
    await expect(page.getByText('Comment se passe une rencontre')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Où nous trouver ?' })).toBeVisible()
    await expect(page.locator('iframe[title^="Carte"]')).toHaveCount(1)

    const liste = page.locator('.block-evenements')
    await expect(liste.getByText('Soirée louange test')).toBeVisible({ timeout: 10000 })
    await expect(liste.getByText('Culte hebdo test')).toHaveCount(1)
    await expect(liste.getByText('Atelier terminé')).toHaveCount(0)
    await expect(liste.getByText('Série finie')).toHaveCount(0)
  })

  test('une page Événements éditée n\'est jamais remplacée', async ({ page, request }) => {
    const edited = [{ ...PAGE_HISTORIQUE[0], props: { ...PAGE_HISTORIQUE[0].props, content: '<h1>Mon contenu à moi</h1>' } }]
    await request.put('/api/pages/event-list', { data: { blocks: edited } })
    await simulerWorker(page)

    await page.goto('/event-list')
    await expect(page.getByRole('heading', { name: 'Mon contenu à moi' })).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('heading', { name: 'Parcours Alpha', exact: true })).toHaveCount(0)
  })
})

test.describe('Agenda : date de fin', () => {
  test('vue « Prochain » : ni événement terminé ni série finie', async ({ page }) => {
    await simulerWorker(page)
    await page.addInitScript(() => localStorage.setItem('agenda_view', 'next'))
    await page.goto('/agenda')

    await expect(page.locator('.next-events').getByText('Soirée louange test')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('.next-events').getByText('Culte hebdo test')).toBeVisible()
    await expect(page.locator('.next-events').getByText('Atelier terminé')).toHaveCount(0)
    await expect(page.locator('.next-events').getByText('Série finie')).toHaveCount(0)
  })
})

test.describe('Bloc Bandeau défilant', () => {
  test.beforeEach(async ({ request }) => {
    await resetMock(request)
  })

  test('affiche ses messages et pointe vers la page Événements', async ({ page }) => {
    await page.goto('/test-blocks')
    const bandeau = page.locator('.block-bandeau')
    await expect(bandeau).toBeVisible({ timeout: 15000 })
    await expect(bandeau.locator('a.bandeau-lien')).toHaveAttribute('href', '/event-list')
    await expect(bandeau.locator('.bandeau-msg').first()).toHaveText('Découvrez nos prochains événements')
    // Le texte est annoncé une seule fois aux lecteurs d'écran.
    await expect(bandeau.locator('a.bandeau-lien')).toHaveAttribute('aria-label', /Découvrez nos prochains événements — Parcours Alpha/)
  })

  test('le clic mène à la page Événements', async ({ page }) => {
    await simulerWorker(page)
    await page.goto('/test-blocks', { waitUntil: 'networkidle' })
    await page.locator('.block-bandeau a.bandeau-lien').click()
    await page.waitForURL('**/event-list', { timeout: 10000 })
  })

  test('en admin, le clic sélectionne le bloc sans quitter la page', async ({ page }) => {
    await page.goto('/test-blocks?admin=true')
    await page.waitForSelector('.admin-toolbar', { timeout: 15000 })
    await page.waitForTimeout(1000)
    await page.locator('.block-bandeau').click()
    await page.waitForTimeout(500)
    await expect(page).toHaveURL(/test-blocks/)
    await expect(page.locator('.admin-sidebar')).toContainText('Messages (un par ligne)')
  })
})

test.describe('Inscription au Parcours Alpha', () => {
  test.beforeEach(async ({ request }) => {
    await resetMock(request)
  })

  test('le formulaire enregistre l\'inscrit dans les messages', async ({ page, request }) => {
    await request.put('/api/pages/event-list', { data: { blocks: PAGE_HISTORIQUE } })
    await simulerWorker(page)
    await page.goto('/event-list')
    const bloc = page.locator('.block-inscription-alpha')
    await expect(bloc.getByRole('heading', { name: /S'inscrire au Parcours Alpha/ })).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Comment se passe une rencontre')).toBeVisible()

    await bloc.getByLabel('Prénom *').fill('Marie')
    await bloc.getByLabel('Nom *', { exact: true }).fill('Test')
    await bloc.getByLabel('E-mail *').fill('marie@example.com')
    await bloc.getByLabel('Téléphone *').fill('06 12 34 56 78')
    await bloc.getByRole('checkbox').check()
    await page.waitForTimeout(2600)
    await bloc.getByRole('button', { name: "Je m'inscris" }).click()
    await expect(bloc.getByRole('status')).toContainText('inscription est bien enregistrée')

    const res = await request.get('/api/contacts')
    const { contacts } = await res.json()
    const c = contacts.find((x: any) => x.email === 'marie@example.com')
    expect(c.telephone).toBe('06 12 34 56 78')
    expect(c.parcours).toBeTruthy()
  })

  test('sans consentement, rien n\'est envoyé', async ({ page, request }) => {
    await request.put('/api/pages/event-list', { data: { blocks: PAGE_HISTORIQUE } })
    await simulerWorker(page)
    await page.goto('/event-list')
    const bloc = page.locator('.block-inscription-alpha')
    await expect(bloc).toBeVisible({ timeout: 15000 })
    await bloc.getByLabel('Prénom *').fill('Marie')
    await bloc.getByLabel('Nom *', { exact: true }).fill('Test')
    await bloc.getByLabel('E-mail *').fill('marie@example.com')
    await bloc.getByLabel('Téléphone *').fill('0612345678')
    await page.waitForTimeout(2600)
    await bloc.getByRole('button', { name: "Je m'inscris" }).click()
    const { contacts } = await (await request.get('/api/contacts')).json()
    expect(contacts.length).toBe(0)
  })
})

test.describe('Places du Parcours Alpha', () => {
  test.beforeEach(async ({ request }) => {
    await resetMock(request)
  })

  async function pageAvecCapacite(request: any, capacity: number) {
    const bloc = { id: 'ia-1', type: 'inscriptionAlpha', props: { parcours: 'Parcours test', capacity }, visibility: { desktop: true, tablet: true, mobile: true } }
    await request.put('/api/pages/event-list', { data: { blocks: [bloc] } })
  }
  const inscription = (n: number) => ({ prenom: 'A', nom: 'B', email: `p${n}@example.com`, telephone: '0612345678', parcours: 'Parcours test' })

  test('compte les places restantes et refuse quand c\'est complet', async ({ request }) => {
    await pageAvecCapacite(request, 2)
    let places = await (await request.get('/api/alpha-places?parcours=Parcours%20test')).json()
    expect(places).toMatchObject({ capacity: 2, taken: 0, remaining: 2 })

    expect((await request.post('/api/contact', { data: inscription(1) })).ok()).toBe(true)
    expect((await request.post('/api/contact', { data: inscription(2) })).ok()).toBe(true)
    places = await (await request.get('/api/alpha-places?parcours=Parcours%20test')).json()
    expect(places.remaining).toBe(0)

    const refus = await request.post('/api/contact', { data: inscription(3) })
    expect(refus.status()).toBe(409)
  })

  test('capacité 0 : illimité', async ({ request }) => {
    await pageAvecCapacite(request, 0)
    for (let i = 0; i < 4; i++) expect((await request.post('/api/contact', { data: inscription(i) })).ok()).toBe(true)
    const places = await (await request.get('/api/alpha-places?parcours=Parcours%20test')).json()
    expect(places.remaining).toBeNull()
  })

  test('le formulaire affiche les places restantes, puis « complet »', async ({ page, request }) => {
    await pageAvecCapacite(request, 1)
    await page.route('**/api/church-events*', (route) => route.fulfill({ json: [] }))
    await page.goto('/event-list')
    const bloc = page.locator('.block-inscription-alpha')
    await expect(bloc.getByText(/Plus que 1 place sur 1/)).toBeVisible({ timeout: 15000 })
    await request.post('/api/contact', { data: inscription(1) })
    await page.reload()
    await expect(bloc.getByText('Complet', { exact: true })).toBeVisible({ timeout: 15000 })
    await expect(bloc.getByRole('button', { name: "Je m'inscris" })).toHaveCount(0)
  })
})
