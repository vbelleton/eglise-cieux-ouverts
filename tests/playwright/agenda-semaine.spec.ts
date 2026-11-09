import { test, expect } from '@playwright/test'
import { resetMock } from './helpers/reset'

// Constaté en prod (semaine du 9/11/2026) : un titre long (« FDL avec les
// Pasteurs Jean-Claude et Marie-Claire BUIS ») élargissait sa colonne
// (`1fr` = minmax(auto, 1fr)) et le dimanche sortait de l'écran. Et le même
// jour, un 21:00 s'affichait avant un 19:30 (ordre de la base, pas de l'heure).

test.use({ timezoneId: 'Europe/Paris', viewport: { width: 1400, height: 900 } })

const EVENEMENTS = [
  { id: 1, title: 'Autel de Louange', start_date: '2030-03-14', start_time: '21:00', status: 'active', exceptions: [] },
  { id: 2, title: 'Ecole du Disciple', start_date: '2030-03-14', start_time: '19:30', status: 'active', exceptions: [] },
  { id: 3, title: 'FDL avec les Pasteurs Jean-Claude et Marie-Claire BUIS — enseignement', start_date: '2030-03-16', status: 'active', exceptions: [] },
  { id: 4, title: 'Célébration', start_date: '2030-03-17', start_time: '10:00', status: 'active', exceptions: [] },
]

test.beforeEach(async ({ request, page }) => {
  await resetMock(request)
  await page.clock.setFixedTime(new Date('2030-03-12T10:00:00+01:00'))
  await page.route('**/api/church-events*', (route) => route.fulfill({ json: EVENEMENTS }))
  await page.goto('/agenda')
  await page.getByRole('button', { name: 'Semaine', exact: true }).click()
})

test('vue Semaine : un titre long ne fait pas déborder la grille', async ({ page }) => {
  const grille = page.locator('.calendar-grid')
  await expect(grille.getByText('Célébration')).toBeVisible()
  const { scroll, client, colonnes } = await grille.evaluate((el) => ({
    scroll: el.scrollWidth, client: el.clientWidth,
    colonnes: getComputedStyle(el).gridTemplateColumns.split(' ').map(parseFloat),
  }))
  expect(scroll).toBeLessThanOrEqual(client + 1)
  // Les 7 jours gardent la même largeur (avant : samedi 473 px, les autres 96).
  expect(Math.max(...colonnes) - Math.min(...colonnes)).toBeLessThan(2)
  const boite = await grille.boundingBox()
  expect(boite!.x + boite!.width).toBeLessThanOrEqual(1400)
})

test('même jour : les événements sont rangés par heure', async ({ page }) => {
  const titres = await page.locator('.calendar-grid .event-pill').allTextContents()
  const ecole = titres.findIndex((t) => t.includes('Ecole du Disciple'))
  const autel = titres.findIndex((t) => t.includes('Autel de Louange'))
  expect(ecole).toBeGreaterThanOrEqual(0)
  expect(ecole).toBeLessThan(autel)
})
