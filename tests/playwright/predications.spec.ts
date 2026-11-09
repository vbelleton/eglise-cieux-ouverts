import { test, expect } from '@playwright/test'

// Recherche cachée des prédications sur /messages?recherche : vidéos
// factices en PW_TEST (server/utils/youtube-mock.js), aucun appel à YouTube.
test.describe('Recherche cachée des prédications', () => {
  test('absente de /messages sans le paramètre, non indexée avec', async ({ page }) => {
    await page.goto('/messages')
    await expect(page.locator('.rp')).toHaveCount(0)
    await expect(page.locator('a[href*="recherche"]')).toHaveCount(0)

    await page.goto('/messages?recherche')
    await expect(page.locator('.rp')).toBeVisible()
    await expect(page.locator('meta[name="robots"]').last()).toHaveAttribute('content', /noindex/)
    // Le contenu habituel de la page reste en dessous.
    await expect(page.locator('.page-renderer')).toBeVisible()
  })

  test('/predications redirige vers la recherche', async ({ page }) => {
    await page.goto('/predications')
    await expect(page).toHaveURL(/\/messages\?recherche/)
    await expect(page.locator('.rp-carte')).toHaveCount(4)
  })

  test('recherche, surlignage, filtre par année, lecture et adresse partageable', async ({ page }) => {
    await page.goto('/messages?recherche')
    const cartes = page.locator('.rp-carte')
    await expect(cartes).toHaveCount(4)

    await page.getByRole('searchbox').fill('pasteur martin')
    await expect(cartes).toHaveCount(2)
    await expect(cartes.first().locator('mark').first()).toHaveText(/Pasteur/i)
    await expect(page).toHaveURL(/recherche.*q=pasteur(\+|%20)martin/)

    await page.getByRole('button', { name: '2025', exact: true }).click()
    await expect(cartes).toHaveCount(1)
    await expect(cartes.first()).toContainText('Marcher par')
    await expect(page).toHaveURL(/annee=2025/)

    await cartes.first().getByRole('button').click()
    const dialogue = page.locator('dialog.rp-dialogue')
    await expect(dialogue).toBeVisible()
    await expect(dialogue.locator('iframe')).toHaveAttribute('src', /youtube-nocookie\.com\/embed\/aaaaaaaaaa4/)
    await page.keyboard.press('Escape')
    await expect(dialogue).toBeHidden()

    await cartes.first().getByRole('button').click()
    await dialogue.getByRole('button', { name: 'Fermer' }).click()
    await expect(dialogue).toBeHidden()

    await page.getByRole('searchbox').fill('zzzz')
    await expect(cartes).toHaveCount(0)
    await page.getByRole('button', { name: 'Effacer la recherche' }).last().click()
    await expect(cartes).toHaveCount(4)
  })

  test('une recherche reprise depuis l\'adresse', async ({ page }) => {
    await page.goto('/messages?recherche&q=prodigue')
    await expect(page.locator('.rp-carte')).toHaveCount(1)
    await expect(page.getByRole('searchbox')).toHaveValue('prodigue')
  })

  test('erreur : message clair et « Réessayer »', async ({ page }) => {
    let appels = 0
    await page.route('**/api/predications', (route) => {
      appels++
      return appels === 1
        ? route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ message: 'YouTube 403' }) })
        : route.continue()
    })
    await page.goto('/messages?recherche')
    await expect(page.getByRole('alert')).toContainText("n'ont pas pu être chargées")
    await expect(page.getByRole('alert')).toContainText('YouTube 403')
    await page.getByRole('button', { name: 'Réessayer' }).click()
    await expect(page.locator('.rp-carte')).toHaveCount(4)
  })
  test('sans JavaScript : lien vers la chaîne au lieu d\'un chargement sans fin', async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false })
    const page = await ctx.newPage()
    await page.goto('/messages?recherche')
    await expect(page.getByRole('link', { name: 'Voir les vidéos sur YouTube' })).toBeVisible()
    await expect(page.getByText('Chargement des vidéos…')).toBeHidden()
    await expect(page.getByRole('searchbox')).toBeHidden()
    await ctx.close()
  })
})
