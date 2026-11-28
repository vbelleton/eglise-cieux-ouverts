import { test, expect } from '@playwright/test'
import { resetMock } from './helpers/reset'
import { loginAsAdmin } from './helpers/admin'

// Événements mis en évidence depuis l'admin (champ `color` du Worker) :
// la Célébration de Noël en rouge vif, le culte de baptême en bleu, pour
// qu'ils ressortent parmi les célébrations ordinaires du dimanche.

test.use({ timezoneId: 'Europe/Paris' })

const ROUGE = 'rgb(225, 29, 46)'

const EVENEMENTS = [
  { id: 1, title: 'Célébration', start_date: '2030-03-03', start_time: '10:00', repeat_period: 'weekly:0', status: 'active', color: '', exceptions: [] },
  { id: 2, title: 'Célébration de Noël', start_date: '2030-03-17', start_time: '10:00', status: 'active', color: '#E11D2E', exceptions: [] },
  // Valeur en base qui n'est pas une couleur stricte : ignorée.
  { id: 3, title: 'Piège', start_date: '2030-03-20', status: 'active', color: 'red;background:url(x)', exceptions: [] },
]

test.beforeEach(async ({ request }) => {
  await resetMock(request)
})

test('vue mois : l\'événement mis en évidence prend sa couleur, les autres non', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2030-03-12T10:00:00+01:00'))
  await page.route('**/api/church-events*', (route) => route.fulfill({ json: EVENEMENTS }))
  await page.goto('/agenda')
  const noel = page.locator('.event-pill', { hasText: 'Célébration de Noël' })
  await expect(noel).toHaveClass(/event-special/)
  await expect(noel).toHaveCSS('background-color', ROUGE)
  const ordinaire = page.locator('.event-pill', { hasText: /^• Célébration$/ }).first()
  await expect(ordinaire).not.toHaveClass(/event-special/)
  await expect(page.locator('.event-pill', { hasText: 'Piège' })).not.toHaveClass(/event-special/)
})

test('vues cartes et ordre du jour : titre et liseré dans la couleur choisie', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2030-03-12T10:00:00+01:00'))
  await page.route('**/api/church-events*', (route) => route.fulfill({ json: EVENEMENTS }))
  await page.goto('/agenda')
  await page.getByRole('button', { name: 'Cartes', exact: true }).click()
  const carte = page.locator('.event-card', { hasText: 'Célébration de Noël' })
  await expect(carte.locator('.event-title')).toHaveCSS('color', ROUGE)
  await expect(carte.locator('.event-date-badge')).toHaveCSS('background-color', ROUGE)
  await expect(page.locator('.event-card', { hasText: 'Piège' })).not.toHaveClass(/event-special/)
  await page.getByRole('button', { name: 'Ordre du jour', exact: true }).click()
  const ligne = page.locator('.agenda-event', { hasText: 'Célébration de Noël' })
  await expect(ligne).toHaveCSS('border-left-color', ROUGE)
})

test('admin : la mise en évidence se relit et s\'envoie dans `color`', async ({ page }) => {
  let envoye: any = null
  await page.route('**/api/church-events**', async (route) => {
    const req = route.request()
    if (req.method() === 'PUT') { envoye = req.postDataJSON(); return route.fulfill({ json: { ok: true } }) }
    return route.fulfill({ json: [{ ...EVENEMENTS[1], start_date: '2099-12-13' }] })
  })
  await loginAsAdmin(page)
  await page.locator('button[title="Gérer les événements"]').click()
  await page.locator('.event-row', { hasText: 'Célébration de Noël' }).click()
  const choix = page.getByTestId('event-couleur')
  await expect(choix).toHaveValue('#e11d2e')
  await choix.selectOption({ label: 'Bleu eau (baptême…)' })
  await page.getByRole('button', { name: /Enregistrer/ }).click()
  await expect.poll(() => envoye).not.toBeNull()
  expect(envoye.color).toBe('#0284c7')
})
