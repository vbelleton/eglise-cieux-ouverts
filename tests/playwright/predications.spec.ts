import { test, expect } from '@playwright/test'

// Page cachée de recherche des prédications : vidéos factices en PW_TEST
// (server/utils/youtube-mock.js), aucun appel à YouTube.
test.describe('Page cachée /predications', () => {
  test('non indexée et absente du menu', async ({ page }) => {
    const res = await page.goto('/predications')
    expect(res?.headers()['x-robots-tag']).toContain('noindex')
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
    await expect(page.locator('a[href="/predications"]')).toHaveCount(0)
  })

  test('recherche, filtre par année, lecture et adresse partageable', async ({ page }) => {
    await page.goto('/predications')
    const cartes = page.locator('.pred-carte')
    await expect(cartes).toHaveCount(4)

    await page.getByRole('searchbox').fill('pasteur martin')
    await expect(cartes).toHaveCount(2)
    await expect(page).toHaveURL(/q=pasteur(\+|%20)martin/)

    await page.locator('#pred-annee').selectOption('2025')
    await expect(cartes).toHaveCount(1)
    await expect(cartes.first()).toContainText('Marcher par')

    await cartes.first().getByRole('button').click()
    const dialogue = page.locator('dialog.pred-dialogue')
    await expect(dialogue).toBeVisible()
    await expect(dialogue.locator('iframe')).toHaveAttribute('src', /youtube-nocookie\.com\/embed\/aaaaaaaaaa4/)
    await page.keyboard.press('Escape')
    await expect(dialogue).toBeHidden()

    await cartes.first().getByRole('button').click()
    await expect(dialogue).toBeVisible()
    await dialogue.getByRole('button', { name: 'Fermer' }).click()
    await expect(dialogue).toBeHidden()

    await page.getByRole('searchbox').fill('prodigue')
    await page.locator('#pred-annee').selectOption('')
    await expect(cartes).toHaveCount(1)
  })

  test('une recherche reprise depuis l\'adresse', async ({ page }) => {
    await page.goto('/predications?q=prodigue')
    await expect(page.locator('.pred-carte')).toHaveCount(1)
    await expect(page.getByRole('searchbox')).toHaveValue('prodigue')
  })
})
