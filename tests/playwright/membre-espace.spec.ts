import { test, expect, type Page, type APIRequestContext } from '@playwright/test'
import { resetMock } from './helpers/reset'

/**
 * Espace membre de bout en bout : connexion, ressources avec tracking
 * automatique, demandes accepter/refuser, agenda personnel (surbrillance +
 * présence) et bloc Louange (candidatures).
 *
 * UN SEUL fichier volontairement : les tests d'un même fichier s'exécutent
 * séquentiellement dans un worker, et l'état membre (member-mock.js) a son
 * propre reset (/api/reset-member-mock) que seul ce fichier appelle — les
 * resetMock globaux des autres specs (parallèles) ne le touchent pas.
 *
 * Auth : window.__MOCK_AUTH_RESULT pilote le mock (auth-mock.client.ts) ;
 * getIdToken 'mock-test-token:email' sélectionne l'utilisateur côté serveur.
 */

async function resetMemberMock(request: APIRequestContext) {
  await request.post('/api/reset-member-mock')
}

async function loginAsMember(page: Page) {
  await page.addInitScript(() => {
    ;(window as unknown as Record<string, unknown>).__MOCK_AUTH_RESULT = {
      uid: 'cli-test-member',
      email: 'ci-member@tests.fr',
      displayName: 'Claire Membre',
      getIdToken: async () => 'mock-test-token:ci-member@tests.fr',
    }
  })
}

async function logoutAll(page: Page) {
  await page.addInitScript(() => {
    ;(window as unknown as Record<string, unknown>).__MOCK_AUTH_RESULT = null
  })
}

// L'espace membre est désactivé par défaut (réglage ⚙️ Config) : ces tests
// l'activent explicitement.
async function activerEspaceMembre(request: APIRequestContext) {
  const res = await request.put('/api/settings', { data: { contactEmails: ['belletonv@gmail.com'], espaceMembre: true } })
  if (!res.ok()) throw new Error(`activation espace membre : HTTP ${res.status()}`)
}

test.describe('Espace membre — /membre', () => {
  test.beforeEach(async ({ request }) => {
    await resetMock(request)
    await activerEspaceMembre(request)
    await resetMemberMock(request)
  })

  test('déconnecté : la page /membre affiche la carte de connexion', async ({ page }) => {
    await logoutAll(page)
    await page.goto('/membre')
    await expect(page.getByRole('heading', { name: 'Espace membre' })).toBeVisible()
    await expect(page.getByPlaceholder('Email')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible()
  })

  test('connecté : dashboard avec onglets et ressource "Nouveau"', async ({ page }) => {
    await loginAsMember(page)
    await page.goto('/membre')
    await expect(page.getByText('Bonjour Claire')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Notes du sermon — Psaume 23')).toBeVisible()
    await expect(page.locator('.badge-new')).toBeVisible()
  })

  test('consulter une ressource déclenche le tracking (badge Nouveau disparaît)', async ({ page, context }) => {
    await loginAsMember(page)
    await page.goto('/membre')
    await expect(page.locator('.badge-new')).toBeVisible({ timeout: 5000 })

    // Le clic logge l'accès PUIS ouvre l'URL dans un nouvel onglet
    const popupPromise = context.waitForEvent('page')
    await page.locator('.resource-card').first().click()
    const popup = await popupPromise
    await popup.close()

    await expect(page.locator('.badge-new')).toHaveCount(0)

    // Persistance mock réelle : toujours consultée après reload
    await page.reload()
    await expect(page.getByText('Notes du sermon — Psaume 23')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('.badge-new')).toHaveCount(0)
  })

  test('accepter une demande met à jour son statut', async ({ page }) => {
    await loginAsMember(page)
    await page.goto('/membre')
    await page.getByRole('tab', { name: /Demandes/ }).click()
    await expect(page.getByText('Peux-tu chanter dimanche ?')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('.status-pill')).toHaveText('En attente')

    await page.getByRole('button', { name: 'Accepter' }).click()
    await expect(page.locator('.status-pill')).toHaveText('Acceptée', { timeout: 3000 })
    await expect(page.getByRole('button', { name: 'Accepter' })).toHaveCount(0)
  })

  test('refuser une demande', async ({ page }) => {
    await loginAsMember(page)
    await page.goto('/membre')
    await page.getByRole('tab', { name: /Demandes/ }).click()
    await page.getByRole('button', { name: 'Refuser' }).click()
    await expect(page.locator('.status-pill')).toHaveText('Refusée', { timeout: 3000 })
  })

  test('mes événements : indiquer une absence, persistée après reload', async ({ page }) => {
    await loginAsMember(page)
    await page.goto('/membre')
    await page.getByRole('tab', { name: /Mes événements/ }).click()
    await expect(page.getByText('Culte du dimanche')).toBeVisible({ timeout: 5000 })

    await page.getByRole('button', { name: '✗ Absent' }).click()
    await expect(page.getByRole('button', { name: '✗ Absent' })).toHaveClass(/active/, { timeout: 3000 })

    await page.reload()
    await page.getByRole('tab', { name: /Mes événements/ }).click()
    await expect(page.getByRole('button', { name: '✗ Absent' })).toHaveClass(/active/, { timeout: 5000 })
  })
})

/**
 * Agenda personnel : surbrillance des événements du membre + présence dans la
 * modale. Les événements publics viennent d'un appel client direct au Worker
 * (useChurchEvents) — intercepté via page.route pour rester déterministe.
 * useChurchEvents attend un TABLEAU BRUT en réponse, pas {data: [...]}.
 */

// Même convention que server/utils/member-mock.js : dates ancrées sur le mois
// courant. La vue cartes de /agenda ne montre que le mois affiché, donc une
// date en dur finit par sortir de la fenêtre et casse ces tests sans qu'aucune
// ligne de code applicatif n'ait bougé (c'est arrivé avec le 26/07/2026).
// Le premier événement doit tomber le même jour que la participation mock,
// sinon participationFor() ne les relie pas et la surbrillance disparaît.
function jourDuMoisCourant(jour: number): string {
  const maintenant = new Date()
  const mois = String(maintenant.getMonth() + 1).padStart(2, '0')
  return `${maintenant.getFullYear()}-${mois}-${String(jour).padStart(2, '0')}`
}
const DATE_PARTICIPATION = jourDuMoisCourant(15)
const DATE_AUTRE_EVENT = jourDuMoisCourant(17)

const MOCK_EVENTS = [
  {
    id: 1,
    title: 'Culte du dimanche',
    start_date: DATE_PARTICIPATION,
    start_time: '10:00',
    location: 'Morlaix',
    repeat_period: null,
    status: 'active',
  },
  {
    id: 2,
    title: 'Soirée jeunes',
    start_date: DATE_AUTRE_EVENT,
    start_time: '19:00',
    location: 'Morlaix',
    repeat_period: null,
    status: 'active',
  },
]

test.describe('Agenda personnel du membre', () => {
  test.beforeEach(async ({ page, request }) => {
    await resetMock(request)
    await activerEspaceMembre(request)
    await resetMemberMock(request)
    await page.route('**/api/church-events*', (route) => route.fulfill({ json: MOCK_EVENTS }))
  })

  test("l'événement du membre est surligné dans la vue cartes", async ({ page }) => {
    await loginAsMember(page)
    await page.goto('/agenda')
    await page.evaluate(() => localStorage.setItem('agenda_view', 'cards'))
    await page.reload()
    await expect(page.locator('.event-card', { hasText: 'Culte du dimanche' })).toBeVisible({ timeout: 8000 })
    // Ce culte tombe le même jour que la participation mock → surligné
    await expect(page.locator('.event-card.event-mine', { hasText: 'Culte du dimanche' })).toBeVisible()
    // La soirée jeunes n'est pas une participation → pas surlignée
    await expect(page.locator('.event-card.event-mine', { hasText: 'Soirée jeunes' })).toHaveCount(0)
  })

  test('la modale affiche les boutons de présence et enregistre le choix', async ({ page }) => {
    await loginAsMember(page)
    await page.goto('/agenda')
    await page.evaluate(() => localStorage.setItem('agenda_view', 'cards'))
    await page.reload()
    await page.locator('.event-card', { hasText: 'Culte du dimanche' }).click()

    const attendance = page.locator('.event-attendance')
    await expect(attendance).toBeVisible({ timeout: 5000 })
    await attendance.getByRole('button', { name: '✓ Présent' }).click()
    await expect(attendance.getByRole('button', { name: '✓ Présent' })).toHaveClass(/active/, { timeout: 3000 })
  })

  test("pas de section présence sur un événement sans participation", async ({ page }) => {
    await loginAsMember(page)
    await page.goto('/agenda')
    await page.evaluate(() => localStorage.setItem('agenda_view', 'cards'))
    await page.reload()
    await page.locator('.event-card', { hasText: 'Soirée jeunes' }).click()
    await expect(page.locator('.event-modal-meta').first()).toBeVisible({ timeout: 5000 })
    await expect(page.locator('.event-attendance')).toHaveCount(0)
  })

  test('visiteur déconnecté : aucune surbrillance ni section présence', async ({ page }) => {
    await logoutAll(page)
    await page.goto('/agenda')
    await page.evaluate(() => localStorage.setItem('agenda_view', 'cards'))
    await page.reload()
    await expect(page.locator('.event-card', { hasText: 'Culte du dimanche' })).toBeVisible({ timeout: 8000 })
    await expect(page.locator('.event-mine')).toHaveCount(0)
  })
})

/**
 * Bloc CMS "louange" : postes ouverts + bouton Postuler.
 * La page 'louange-test' fait partie des defaults du mock (firestore-mock.js).
 */

test.describe('Bloc Louange', () => {
  test.beforeEach(async ({ request }) => {
    await resetMock(request)
    await activerEspaceMembre(request)
    await resetMemberMock(request)
  })

  test('les postes sont affichés avec le bouton Postuler', async ({ page }) => {
    await page.goto('/louange-test')
    await expect(page.getByRole('heading', { name: "Rejoins l'équipe louange" })).toBeVisible({ timeout: 8000 })
    await expect(page.getByRole('heading', { name: 'Chant' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Batterie' })).toBeVisible()
    await expect(page.getByText('2 places à pourvoir')).toBeVisible()
    await expect(page.getByText('1 place à pourvoir')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Je postule !' })).toHaveCount(2)
  })

  test('déconnecté : Postuler redirige vers /membre', async ({ page }) => {
    await logoutAll(page)
    await page.goto('/louange-test')
    await page.getByRole('button', { name: 'Je postule !' }).first().click()
    await page.waitForURL(/\/membre\?redirect=/, { timeout: 5000 })
    await expect(page.getByPlaceholder('Email')).toBeVisible()
  })

  test('connecté : la candidature part et le bouton se verrouille', async ({ page }) => {
    await loginAsMember(page)
    await page.goto('/louange-test')
    await page.getByRole('button', { name: 'Je postule !' }).first().click()
    await expect(page.locator('.louange-toast')).toHaveText(/Candidature envoyée/, { timeout: 5000 })
    await expect(page.getByRole('button', { name: 'Candidature envoyée ✓' })).toBeDisabled()

    // La candidature apparaît côté espace membre
    await page.goto('/membre')
    await page.getByRole('tab', { name: /Demandes/ }).click()
    await expect(page.getByText('Ma candidature — Chant')).toBeVisible({ timeout: 5000 })
  })

  test('double candidature refusée proprement', async ({ page }) => {
    await loginAsMember(page)
    await page.goto('/louange-test')
    await page.getByRole('button', { name: 'Je postule !' }).first().click()
    await expect(page.getByRole('button', { name: 'Candidature envoyée ✓' })).toBeDisabled({ timeout: 5000 })

    // Reload : l'état local est perdu, mais le serveur mock refuse le doublon
    await page.reload()
    await page.getByRole('button', { name: 'Je postule !' }).first().click()
    await expect(page.locator('.louange-toast')).toHaveText(/déjà une candidature|déjà postulé/, { timeout: 5000 })
  })
})

test.describe('Espace membre désactivé (réglage par défaut)', () => {
  test.beforeEach(async ({ request }) => {
    await resetMock(request)
    await resetMemberMock(request)
  })

  test('le réglage public vaut false par défaut', async ({ request }) => {
    const data = await (await request.get('/api/settings')).json()
    expect(data.espaceMembre).toBe(false)
  })

  test('aucun lien « Espace membre » et /membre renvoie vers l\'accueil', async ({ page }) => {
    await logoutAll(page)
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('.nav-membre-link')).toHaveCount(0)
    await page.goto('/membre')
    await expect(page).toHaveURL(/\/$/)
  })

  test('un membre encore connecté ne voit plus son agenda personnel', async ({ page }) => {
    await page.route('**/api/church-events*', (route) => route.fulfill({ json: MOCK_EVENTS }))
    await loginAsMember(page)
    await page.goto('/agenda')
    await page.evaluate(() => localStorage.setItem('agenda_view', 'cards'))
    await page.reload()
    await expect(page.locator('.event-card', { hasText: 'Culte du dimanche' })).toBeVisible({ timeout: 8000 })
    await expect(page.locator('.event-mine')).toHaveCount(0)
  })

  test('Louange : « Je postule ! » mène au formulaire de contact', async ({ page }) => {
    await logoutAll(page)
    await page.goto('/louange-test', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Je postule !' }).first().click()
    await page.waitForURL('**/contact', { timeout: 8000 })
  })
})
