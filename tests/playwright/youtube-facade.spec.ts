import { test, expect } from '@playwright/test'
import { resetMock } from './helpers/reset'

// Le lecteur YouTube intégré pèse ~1 Mo de JavaScript : le charger à
// l'affichage de /messages laissait un cadre blanc plusieurs secondes. Le
// visiteur voit d'abord une image + un bouton ; le lecteur ne se charge
// qu'au clic. L'admin garde le lecteur réel (sélection du bloc).

test.describe('Vidéo YouTube : chargement au clic', () => {
  test.beforeEach(async ({ request }) => {
    await resetMock(request)
  })

  test('aucune requête YouTube avant le clic, le lecteur démarre après', async ({ page }) => {
    const requetesLecteur: string[] = []
    await page.route(/youtube(-nocookie)?\.com\//, (route) => {
      requetesLecteur.push(route.request().url())
      return route.fulfill({ body: '<html></html>', contentType: 'text/html' })
    })
    await page.route(/ytimg\.com\//, (route) => route.fulfill({ status: 204 }))

    await page.goto('/messages')
    const bloc = page.locator('.block-youtube')
    await expect(bloc).toBeVisible()
    await bloc.scrollIntoViewIfNeeded()
    await page.waitForTimeout(1500)
    await expect(bloc.locator('iframe')).toHaveCount(0)
    expect(requetesLecteur).toEqual([])

    await bloc.getByRole('button', { name: /Lire la vidéo/ }).click()
    const lecteur = bloc.locator('iframe')
    await expect(lecteur).toHaveCount(1)
    await expect(lecteur).toHaveAttribute('src', /youtube-nocookie\.com\/embed\/.+autoplay=1/)
  })
})
