import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './helpers/admin'

// Une série dont la date de fin est passée disparaît du site sans aucun signe
// dans l'admin, et retirer cette date obligeait à vider le champ date à la
// main (constaté : Réunion de Prières, Agape, Groupe de Marche).
const SERIE = {
  id: 5, title: 'Repas en commun - Agape', description: '', location: 'Morlaix',
  start_date: '2025-01-26', start_time: '12:15', end_date: '2026-01-25', end_time: '14:15',
  repeat_period: 'monthly_weekday:-1:0', emoji: null, image_url: null, link: null,
  ticket_url: null, status: 'active', exceptions: [],
}

test('série terminée : signalée dans la liste, « Sans fin » envoie end_date: null', async ({ page }) => {
  let envoye: any = null
  await page.route('**/api/church-events**', async (route) => {
    const req = route.request()
    if (req.method() === 'PUT') { envoye = req.postDataJSON(); return route.fulfill({ json: { ok: true } }) }
    return route.fulfill({ json: [SERIE] })
  })
  await loginAsAdmin(page)
  await page.locator('button[title="Gérer les événements"]').click()
  const ligne = page.locator('.event-row', { hasText: 'Agape' })
  await expect(ligne.locator('.event-badge-terminee')).toHaveText('Terminée le 25/01/2026')
  await ligne.click()
  await expect(page.locator('.event-alerte-fin')).toContainText("n'apparaît plus sur le site")
  await page.getByRole('button', { name: 'Sans fin' }).click()
  await expect(page.locator('.event-alerte-fin')).toHaveCount(0)
  await page.getByRole('button', { name: /Enregistrer/ }).click()
  await expect.poll(() => envoye).not.toBeNull()
  expect(envoye.end_date).toBeNull()
})

test('fin de série égale au début (ignorée par le site) : ni badge, ni date affichée', async ({ page }) => {
  const ancienne = { ...SERIE, start_date: '2026-01-30', end_date: '2026-01-30', repeat_period: 'week' }
  await page.route('**/api/church-events**', (route) => route.fulfill({ json: [ancienne] }))
  await loginAsAdmin(page)
  await page.locator('button[title="Gérer les événements"]').click()
  const ligne = page.locator('.event-row', { hasText: 'Agape' })
  await expect(ligne).toBeVisible()
  await expect(ligne.locator('.event-badge-terminee')).toHaveCount(0)
  await ligne.click()
  await expect(page.locator('.date-fin-champ input')).toHaveValue('')
})
