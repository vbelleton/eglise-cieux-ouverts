import { test, expect } from '@playwright/test'
import { resetMock } from './helpers/reset'

// Vue « Prochain » de l'agenda : le jour même, un événement dont l'heure de
// fin est passée n'est plus « à venir ». Avant, le filtre ne regardait que la
// date, et l'événement du matin restait affiché l'après-midi.

test.use({ timezoneId: 'Europe/Paris' })

const EVENEMENTS = [
  { id: 1, title: 'Prière du matin', start_date: '2030-03-14', start_time: '08:00', end_time: '09:00', status: 'active', exceptions: [] },
  { id: 2, title: 'Soirée louange', start_date: '2030-03-14', start_time: '20:00', end_time: '22:00', status: 'active', exceptions: [] },
  { id: 3, title: 'Repas', start_date: '2030-03-14', start_time: '12:00', status: 'active', exceptions: [] },
]

test.beforeEach(async ({ request }) => {
  await resetMock(request)
})

test('un événement du jour déjà terminé disparaît de « Prochain »', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2030-03-14T15:00:00+01:00'))
  await page.route('**/api/church-events*', (route) => route.fulfill({ json: EVENEMENTS }))
  await page.goto('/agenda')
  await page.getByRole('button', { name: 'Prochain', exact: true }).click()
  const liste = page.locator('.next-events')
  await expect(liste.getByText('Soirée louange')).toBeVisible()
  await expect(liste.getByText('Prière du matin')).toHaveCount(0)
  // Sans heure de fin : début + 2 h, donc 12 h → 14 h, terminé à 15 h.
  await expect(liste.getByText('Repas')).toHaveCount(0)
})

test('les images de la vue Cartes sont demandées avant de l\'ouvrir', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2030-03-10T15:00:00+01:00'))
  const avecImage = EVENEMENTS.map((e) => ({ ...e, image_url: `/test-img-${e.id}.png` }))
  await page.route('**/api/church-events*', (route) => route.fulfill({ json: avecImage }))
  const demandees: string[] = []
  await page.route('**/test-img-*.png', (route) => {
    demandees.push(new URL(route.request().url()).pathname)
    return route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('89504e470d0a1a0a', 'hex') })
  })
  await page.goto('/agenda')
  await expect.poll(() => demandees.length, { timeout: 8000 }).toBe(3)
  await expect(page.locator('.event-card')).toHaveCount(0)
})
