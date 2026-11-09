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
  expect(hAutel).toBeLessThan(hFdl)
})
