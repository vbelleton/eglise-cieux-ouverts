import { test, expect } from '@playwright/test'
import { resetMock } from './helpers/reset'

// « Il y a une place pour toi ! » apparaît lettre par lettre au défilement.
// Les plages étaient calées sur la traversée complète du pied de page
// (`cover`), dont la fin n'est jamais atteinte en bas de page : sur un écran
// haut, les dernières lettres (« oi ! ») restaient invisibles.

for (const [largeur, hauteur] of [[1366, 768], [1512, 982], [1920, 1080], [2560, 1440], [390, 844]]) {
  test(`pied de page : titre entier en bas de page (${largeur}×${hauteur})`, async ({ page, request }) => {
    await resetMock(request)
    await page.setViewportSize({ width: largeur, height: hauteur })
    await page.goto('/')
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await expect.poll(async () => page.evaluate(() =>
      [...document.querySelectorAll('.site-footer .footer-title .shutter-char')]
        .filter((s) => s.textContent!.trim() && Number(getComputedStyle(s).opacity) < 0.99)
        .map((s) => s.textContent!.trim()).join(''),
    ), { timeout: 8000 }).toBe('')
  })
}

// Page courte (page d'erreur, page en panne, grand écran) : le pied de page
// est déjà à l'écran au chargement, le visiteur ne défile pas, et le titre
// restait à moitié écrit (« Il y a une pla ») ou invisible, puisqu'il ne
// s'écrit qu'au fil du défilement. `deborde` = de combien la page dépasse
// l'écran (négatif : elle ne défile pas du tout).
for (const [largeur, deborde] of [[1280, 40], [1280, -300], [390, 60]]) {
  test(`pied de page : titre entier sans défiler sur une page courte (${largeur}px, débord ${deborde}px)`, async ({ page, request }) => {
    await resetMock(request)
    await page.setViewportSize({ width: largeur, height: 600 })
    await page.goto('/cette-page-n-existe-pas')
    const hauteurPage = await page.evaluate(() => document.documentElement.scrollHeight)
    await page.setViewportSize({ width: largeur, height: hauteurPage - deborde })
    await page.reload()
    expect(await page.evaluate(() => window.scrollY)).toBe(0)
    await expect.poll(async () => page.evaluate(() =>
      [...document.querySelectorAll('.site-footer .footer-title .shutter-char')]
        .filter((s) => s.textContent!.trim() && Number(getComputedStyle(s).opacity) < 0.99)
        .map((s) => s.textContent!.trim()).join(''),
    ), { timeout: 8000 }).toBe('')
  })
}
