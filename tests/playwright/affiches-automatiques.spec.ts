import { test, expect } from '@playwright/test'
import { resetMock } from './helpers/reset'
import { loginAsAdmin } from './helpers/admin'

// Affiches automatiques (utils/posterTemplates.js) : une fiche dont l'image
// est le fond d'un modèle a une affiche par séance, avec la date et l'heure
// de chaque occurrence écrites dans le navigateur.

test.use({ timezoneId: 'Europe/Paris' })

const FOND = '/affiches/modeles/soiree-cieux-ouverts.jpg'
const SOIREE = {
  id: 23, title: 'Soirée Cieux Ouverts ❤️‍🔥', start_date: '2026-01-30', start_time: '19:30', end_time: '22:00',
  repeat_period: 'monthly_weekday:-1:5', status: 'active', color: '', image_url: '', exceptions: [],
}

// Empreinte de la zone date/heure (bas gauche) d'une image : deux séances
// différentes doivent donner deux empreintes différentes.
async function empreinte(page, src: string) {
  return page.evaluate(async (s) => {
    const i = new Image(); i.src = s; await i.decode()
    const c = document.createElement('canvas'); c.width = 160; c.height = 90
    const x = c.getContext('2d')!
    x.drawImage(i, 0, 0, 160, 90)
    const d = x.getImageData(0, 68, 80, 22).data
    let t = 0
    for (let k = 0; k < d.length; k += 4) t += d[k] * (k % 97) + d[k + 2]
    return t
  }, src)
}

test.beforeEach(async ({ request }) => {
  await resetMock(request)
})

test('admin : « Affiche automatique » met le fond du modèle comme image de la fiche', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-28T10:00:00+01:00'))
  let envoye: any = null
  await page.route('**/api/church-events**', async (route) => {
    const req = route.request()
    if (req.method() === 'PUT') { envoye = req.postDataJSON(); return route.fulfill({ json: { ok: true } }) }
    return route.fulfill({ json: [SOIREE] })
  })
  await loginAsAdmin(page)
  await page.locator('button[title="Gérer les événements"]').click()
  await page.locator('.event-row', { hasText: 'Soirée Cieux Ouverts' }).click()
  await page.getByTestId('event-affiche-auto').click()
  await expect(page.getByTestId('affiche-auto-modele')).toHaveValue('soiree-cieux-ouverts')
  // Aperçu : affiche générée (blob:), jamais le fond seul.
  await expect(page.getByTestId('affiche-auto-panneau').locator('img')).toHaveAttribute('src', /^blob:/)
  await page.getByTestId('affiche-auto-utiliser').click()
  await expect(page.locator('.event-image-controls input[type=url]')).toHaveValue(FOND)
  await expect(page.getByTestId('affiche-auto-active')).toBeVisible()

  await page.getByRole('button', { name: /Enregistrer/ }).click()
  await expect.poll(() => envoye).not.toBeNull()
  expect(envoye.image_url).toBe(FOND)
})

test('agenda : chaque séance a sa propre affiche, jamais le fond seul', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-28T10:00:00+01:00'))
  await page.route('**/api/church-events*', (route) => route.fulfill({ json: [{ ...SOIREE, image_url: FOND }] }))
  await page.goto('/agenda')
  await page.getByRole('button', { name: 'Cartes', exact: true }).click()
  const img = page.locator('.event-card', { hasText: 'Soirée Cieux Ouverts' }).locator('img').first()
  await expect(img).toHaveAttribute('src', /^blob:/)
  await expect(page.locator(`img[src$="${FOND}"]`)).toHaveCount(0)
  expect(await empreinte(page, (await img.getAttribute('src'))!)).toBeGreaterThan(0)
})

test('l\'affiche suit la fiche : changer l\'heure change le texte écrit', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-28T10:00:00+01:00'))
  await page.route('**/api/church-events**', (route) => route.fulfill({ json: [{ ...SOIREE, image_url: FOND }] }))
  await loginAsAdmin(page)
  await page.locator('button[title="Gérer les événements"]').click()
  await page.locator('.event-row', { hasText: 'Soirée Cieux Ouverts' }).click()
  const apercu = page.locator('.event-image-section img').first()
  await expect(apercu).toHaveAttribute('src', /^blob:/)
  const avant = await apercu.getAttribute('src')
  const empreinteAvant = await empreinte(page, avant!)
  await page.locator('input[type=time]').first().fill('20:00')
  await expect(apercu).not.toHaveAttribute('src', avant!)
  await expect(apercu).toHaveAttribute('src', /^blob:/)
  expect(await empreinte(page, (await apercu.getAttribute('src'))!)).not.toBe(empreinteAvant)
})
