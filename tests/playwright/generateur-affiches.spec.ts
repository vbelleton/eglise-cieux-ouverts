import { test, expect } from '@playwright/test'
import { resetMock } from './helpers/reset'
import { loginAsAdmin } from './helpers/admin'

// Générateur d'affiches de l'admin (📅 événements → « Générer l'affiche ») :
// la date proposée est la prochaine occurrence de la série, l'heure vient de
// l'heure de début, et l'affiche générée devient l'image de la fiche.

test.use({ timezoneId: 'Europe/Paris' })

const SOIREE = {
  id: 23, title: 'Soirée Cieux Ouverts ❤️‍🔥', start_date: '2026-01-30', start_time: '19:30', end_time: '22:00',
  repeat_period: 'monthly_weekday:-1:5', status: 'active', color: '', image_url: '', exceptions: [],
}

test.beforeEach(async ({ request }) => {
  await resetMock(request)
})

test('génère l\'affiche de la prochaine soirée et la met comme image de la fiche', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-28T10:00:00+01:00'))
  let envoye: any = null
  await page.route('**/api/church-events**', async (route) => {
    const req = route.request()
    if (req.method() === 'PUT') { envoye = req.postDataJSON(); return route.fulfill({ json: { ok: true } }) }
    return route.fulfill({ json: [SOIREE] })
  })
  const envois: string[] = []
  page.on('request', (r) => {
    if (r.method() === 'POST' && /\/api\/media\?key=uploads%2F(?!thumbs)/.test(r.url())) envois.push(r.url())
  })
  await loginAsAdmin(page)
  await page.locator('button[title="Gérer les événements"]').click()
  await page.locator('.event-row', { hasText: 'Soirée Cieux Ouverts' }).click()
  await page.getByTestId('event-generer-affiche').click()

  await expect(page.getByTestId('poster-modele')).toHaveValue('soiree-cieux-ouverts')
  await expect(page.getByTestId('poster-date')).toHaveValue('2026-12-25')
  await expect(page.getByTestId('poster-texte-date')).toHaveValue('Vendredi 25 décembre')
  await expect(page.getByTestId('poster-texte-heure')).toHaveValue('19H30')

  // L'aperçu est dessiné au format du fond, avec les polices fournies.
  const apercu = page.getByTestId('poster-apercu')
  await expect.poll(() => apercu.evaluate((c: HTMLCanvasElement) => `${c.width}x${c.height}`)).toBe('1600x900')
  await expect.poll(() => page.evaluate(() => document.fonts.check('800 91px "Lexend Affiche"'))).toBe(true)

  // Choisir une autre date réécrit le texte de la date.
  await page.getByTestId('poster-date').fill('2027-01-29')
  await page.getByTestId('poster-date').dispatchEvent('change')
  await expect(page.getByTestId('poster-texte-date')).toHaveValue('Vendredi 29 janvier')

  await page.getByTestId('poster-utiliser').click()
  await expect.poll(() => envois.length, { timeout: 15000 }).toBeGreaterThan(0)
  expect(envois[0]).toContain('affiche-soiree-cieux-ouverts-2027-01-29')
  const champ = page.locator('.event-image-controls input[type=url]')
  await expect(champ).toHaveValue(/\/api\/media\/uploads\//)
  await expect(page.getByTestId('poster-generator')).toHaveCount(0)

  await page.getByRole('button', { name: /Enregistrer/ }).click()
  await expect.poll(() => envoye).not.toBeNull()
  expect(envoye.image_url).toMatch(/\/api\/media\/uploads\//)
  expect(envoye.start_time).toBe('19:30')
})
