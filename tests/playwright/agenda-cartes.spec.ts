import { test, expect } from '@playwright/test'
import { resetMock } from './helpers/reset'

// Vue « Cartes » : une série hebdomadaire apparaissait une fois par
// occurrence du mois (4 à 5 cartes identiques), avec des clés en double.

test.use({ timezoneId: 'Europe/Paris' })

const EVENEMENTS = [
  { id: 1, title: 'Autel de Louange', start_date: '2030-01-01', start_time: '21:00', repeat_period: 'week', status: 'active', exceptions: [] },
  { id: 2, title: 'FDL', start_date: '2030-03-16', status: 'active', exceptions: [] },
]

test.beforeEach(async ({ request }) => {
  await resetMock(request)
})

test('une seule carte par événement, sur sa prochaine date', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2030-03-12T10:00:00+01:00'))
  const avertissements: string[] = []
  page.on('console', (m) => { if (/duplicate keys/i.test(m.text())) avertissements.push(m.text()) })
  await page.route('**/api/church-events*', (route) => route.fulfill({ json: EVENEMENTS }))
  await page.goto('/agenda')
  await page.getByRole('button', { name: 'Cartes', exact: true }).click()
  const cartes = page.locator('.events-list .event-card')
  await expect(cartes.filter({ hasText: 'FDL' })).toHaveCount(1)
  const autel = cartes.filter({ hasText: 'Autel de Louange' })
  await expect(autel).toHaveCount(1)
  // Mardi 12/03/2030 : la prochaine occurrence est ce soir même.
  await expect(autel.locator('.badge-day')).toHaveText('12')
  expect(avertissements).toEqual([])
})

test('cartes : image entière, date hors de l\'image, pas de hauteur étirée', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 })
  await page.clock.setFixedTime(new Date('2030-03-12T10:00:00+01:00'))
  const longue = 'Une description très longue. '.repeat(30)
  await page.route('**/api/church-events*', (route) => route.fulfill({ json: [
    { ...EVENEMENTS[0], image_url: '/test-img-1.png' },
    { ...EVENEMENTS[1], description: longue },
  ] }))
  await page.route('**/test-img-*.png', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('89504e470d0a1a0a', 'hex') }))
  await page.goto('/agenda')
  await page.getByRole('button', { name: 'Cartes', exact: true }).click()
  const autel = page.locator('.event-card', { hasText: 'Autel de Louange' })
  const fdl = page.locator('.event-card', { hasText: 'FDL' })
  // Visuel 16:9 non recadré en hauteur fixe.
  const img = await autel.locator('.event-card-img').boundingBox()
  expect(Math.abs(img!.width / img!.height - 16 / 9)).toBeLessThan(0.05)
  // La date est dans le corps de la carte, pas posée sur l'image.
  const badge = await autel.locator('.event-date-badge').boundingBox()
  expect(badge!.y).toBeGreaterThanOrEqual(img!.y + img!.height - 1)
  // Sans image : un fond neutre, pas l'icône « image cassée ».
  await expect(fdl.locator('.event-card-placeholder')).toBeVisible()
  await expect(fdl.locator('svg')).toHaveCount(0)
  // Description longue : extrait, et la carte voisine n'est pas étirée.
  const hAutel = (await autel.boundingBox())!.height
  const hFdl = (await fdl.boundingBox())!.height
  expect(hFdl).toBeLessThan(500)
  // Chaque carte garde sa propre hauteur (pas étirée sur la plus haute).
  expect(Math.abs(hAutel - hFdl)).toBeGreaterThan(2)
})

test('/agenda n\'appelle le Worker événements qu\'une seule fois par chargement', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2030-03-12T10:00:00+01:00'))
  let appels = 0
  await page.route('**/api/church-events*', (route) => { appels++; return route.fulfill({ json: EVENEMENTS }) })
  await page.goto('/agenda')
  await expect(page.locator('.calendar-grid, .events-list').first()).toBeVisible()
  await page.waitForTimeout(1000)
  expect(appels).toBe(1)
})

test('cartes : rien de passé, une seule carte pour deux séries du même événement', async ({ page }) => {
  // Jeudi 14/03/2030 midi. « Autel de Louange » le mardi ET le jeudi (deux
  // fiches) ; « Soirée passée » a eu lieu le 05/03.
  await page.clock.setFixedTime(new Date('2030-03-14T12:00:00+01:00'))
  await page.route('**/api/church-events*', (route) => route.fulfill({ json: [
    { id: 1, title: 'Autel de Louange 🙌', start_date: '2030-01-01', start_time: '21:00', repeat_period: 'week', status: 'active', exceptions: [] },
    { id: 3, title: 'Autel de Louange 🙌', start_date: '2030-01-03', start_time: '21:00', repeat_period: 'week', status: 'active', exceptions: [] },
    { id: 4, title: 'Soirée passée', start_date: '2030-03-05', status: 'active', exceptions: [] },
  ] }))
  await page.goto('/agenda')
  await page.getByRole('button', { name: 'Cartes', exact: true }).click()
  const cartes = page.locator('.events-list .event-card')
  await expect(cartes.filter({ hasText: 'Autel de Louange' })).toHaveCount(1)
  await expect(cartes.filter({ hasText: 'Soirée passée' })).toHaveCount(0)
  const autel = cartes.filter({ hasText: 'Autel de Louange' })
  await expect(autel.locator('.badge-day')).toHaveText('14')
  await expect(autel.locator('.event-recurrence')).toHaveText('🔁 Chaque mardi et jeudi')
  // Rendez-vous régulier : son rythme, pas la liste de ses dates.
  await expect(autel.locator('.event-date-chip')).toHaveCount(0)
  // Cartes : tout l'avenir, sans choix de mois.
  await expect(page.getByRole('button', { name: 'Période précédente' })).toHaveCount(0)
  // Chaque vue est expliquée.
  await page.getByRole('button', { name: 'Ordre du jour', exact: true }).click()
  await expect(page.locator('.view-hint')).toContainText('le programme à venir, jour après jour')
  await expect(page.locator('.agenda-list')).not.toContainText('Soirée passée')
})

test('téléphone : l\'affiche apparaît dès qu\'on touche le jour', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.clock.setFixedTime(new Date('2030-03-12T10:00:00+01:00'))
  await page.addInitScript(() => localStorage.setItem('agenda_view', 'month'))
  await page.route('**/api/church-events*', (route) => route.fulfill({ json: [
    { id: 2, title: 'FDL', start_date: '2030-03-16', status: 'active', exceptions: [], image_url: '/test-img-fdl.png' },
  ] }))
  // PNG 16x9 valide.
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABAAAAAJCAIAAAC0SDtlAAAAEklEQVR4nGNgGAWjYBSMAggAAAQQAAGFP6pyAAAAAElFTkSuQmCC', 'base64')
  await page.route('**/test-img-*.png', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: png }))
  await page.goto('/agenda')
  await page.locator('.day-cell.has-events').first().click()
  const img = page.locator('.day-modal .day-modal-event-img img')
  await expect(img).toBeVisible()
  // Place réservée en 16:9, image affichée une fois prête (pas à moitié).
  const cadre = (await page.locator('.day-modal .day-modal-event-img').boundingBox())!
  expect(Math.abs(cadre.width / cadre.height - 16 / 9)).toBeLessThan(0.05)
  await expect(page.locator('.day-modal .day-modal-event-img')).toHaveClass(/est-prete/)
})

test('cartes : tous les événements à venir, au-delà du mois, les récurrents une seule fois', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2030-03-28T12:00:00+01:00'))
  await page.route('**/api/church-events*', (route) => route.fulfill({ json: [
    { id: 1, title: 'Célébration', start_date: '2030-01-06', start_time: '10:00', repeat_period: 'weekly:0', status: 'active', exceptions: [] },
    { id: 2, title: 'Fête de Pâques', start_date: '2030-04-21', start_time: '10:00', status: 'active', exceptions: [] },
    { id: 3, title: 'Concert', start_date: '2030-06-14', start_time: '20:00', status: 'active', exceptions: [] },
    { id: 4, title: 'Parcours #1', start_date: '2030-04-04', status: 'active', exceptions: [] },
    { id: 5, title: 'Parcours #2', start_date: '2030-04-11', status: 'active', exceptions: [] },
  ] }))
  await page.goto('/agenda')
  await page.getByRole('button', { name: 'Cartes', exact: true }).click()
  const cartes = page.locator('.events-list .event-card')
  await expect(cartes).toHaveCount(4)
  await expect(cartes.filter({ hasText: 'Célébration' })).toHaveCount(1)
  await expect(cartes.filter({ hasText: 'Concert' })).toHaveCount(1)
  const parcours = cartes.filter({ hasText: 'Parcours' })
  await expect(parcours.locator('.event-date-chip')).toHaveCount(2)
  // Rangées par prochaine date : Célébration (31/03) en tête, Concert (juin) en dernier.
  await expect(cartes.first()).toContainText('Célébration')
  await expect(cartes.last()).toContainText('Concert')
})

test('ordre du jour : tout l\'avenir, un récurrent une seule fois, sans choix de mois', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2030-03-28T12:00:00+01:00'))
  await page.route('**/api/church-events*', (route) => route.fulfill({ json: [
    { id: 1, title: 'Célébration', start_date: '2030-01-06', start_time: '10:00', repeat_period: 'weekly:0', status: 'active', exceptions: [] },
    { id: 2, title: 'Fête de Pâques', start_date: '2030-04-21', start_time: '10:00', status: 'active', exceptions: [] },
    { id: 3, title: 'Concert', start_date: '2030-06-14', start_time: '20:00', status: 'active', exceptions: [] },
    { id: 4, title: 'Soirée passée', start_date: '2030-03-05', status: 'active', exceptions: [] },
  ] }))
  await page.goto('/agenda')
  await page.getByRole('button', { name: 'Ordre du jour', exact: true }).click()
  const liste = page.locator('.agenda-list')
  await expect(liste.locator('.agenda-event')).toHaveCount(3)
  await expect(liste.locator('.agenda-event', { hasText: 'Célébration' })).toHaveCount(1)
  await expect(liste.locator('.agenda-event', { hasText: 'Célébration' })).toContainText('Chaque dimanche')
  await expect(liste.locator('.agenda-event', { hasText: 'Concert' })).toHaveCount(1)
  await expect(liste).not.toContainText('Soirée passée')
  await expect(page.getByRole('button', { name: 'Période précédente' })).toHaveCount(0)
  // Rangé jour après jour : Célébration (31/03) avant Concert (14/06).
  await expect(liste.locator('.agenda-event').first()).toContainText('Célébration')
  await expect(liste.locator('.agenda-event').last()).toContainText('Concert')
})
