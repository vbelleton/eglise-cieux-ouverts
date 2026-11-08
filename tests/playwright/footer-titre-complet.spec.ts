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
