import { test, expect } from '@playwright/test'

/**
 * Magazine feuilletable : liste /magazine, liseuse /magazine/<id>.
 * Le numéro d'exemple (utils/magazines.json, 8 pages) sert de support.
 */

const pagesDemandees = (page: import('@playwright/test').Page) => {
  const demandes: string[] = []
  page.on('request', (r) => {
    const m = r.url().match(/\/magazines\/[^/]+\/p(\d{3})-([sml])\.webp/)
    if (m) demandes.push(`${Number(m[1])}${m[2]}`)
  })
  return demandes
}

test.describe('Magazine', () => {
  test('la liste montre le numéro et mène à la liseuse', async ({ page }) => {
    await page.goto('/magazine')
    await expect(page.getByRole('heading', { level: 1, name: 'Magazine' })).toBeVisible()
    await page.getByRole('link', { name: 'Feuilleter' }).click()
    await expect(page).toHaveURL(/\/magazine\/exemple$/)
    await expect(page.locator('.barre-libelle')).toHaveText('Page 1 sur 8')
  })

  test('ordinateur : double page, clavier, adresse partageable', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/magazine/exemple')
    const libelle = page.locator('.barre-libelle')
    await expect(libelle).toHaveText('Page 1 sur 8')
    await page.keyboard.press('ArrowRight')
    await expect(libelle).toHaveText('Pages 2–3 sur 8')
    await expect(page).toHaveURL(/\?page=2$/)
    await page.keyboard.press('End')
    await expect(libelle).toHaveText('Page 8 sur 8')
    await page.keyboard.press('ArrowLeft')
    await expect(libelle).toHaveText('Pages 6–7 sur 8')
    await page.keyboard.press('Home')
    await expect(libelle).toHaveText('Page 1 sur 8')
    await expect(page).toHaveURL(/\/magazine\/exemple$/)
  })

  test('glisser la page vers la gauche la tourne', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/magazine/exemple?page=2')
    const libelle = page.locator('.barre-libelle')
    await expect(libelle).toHaveText('Pages 2–3 sur 8')
    const box = (await page.locator('.livre').boundingBox())!
    await page.mouse.move(box.x + box.width * 0.9, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width * 0.3, box.y + box.height / 2, { steps: 12 })
    await page.mouse.up()
    await expect(libelle).toHaveText('Pages 4–5 sur 8')
  })

  test('téléphone : une page à la fois, toucher le bord droit avance', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
    const page = await ctx.newPage()
    await page.goto('/magazine/exemple?page=3')
    const libelle = page.locator('.barre-libelle')
    await expect(libelle).toHaveText('Page 3 sur 8')
    const box = (await page.locator('.livre').boundingBox())!
    await page.touchscreen.tap(box.x + box.width * 0.75, box.y + box.height / 2)
    await expect(libelle).toHaveText('Page 4 sur 8')
    await ctx.close()
  })

  test('léger : seules la vue affichée et ses voisines sont téléchargées', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    const demandes = pagesDemandees(page)
    await page.goto('/magazine/exemple?page=4', { waitUntil: 'networkidle' })
    const pages = [...new Set(demandes.map(d => Number.parseInt(d, 10)))].sort((a, b) => a - b)
    // Vue 4–5, plus la précédente (2–3) et la suivante (6–7) en avance.
    expect(pages).toEqual([2, 3, 4, 5, 6, 7])
    expect(await page.locator('.liseuse img').count()).toBe(2)
    // Jamais la grande image hors zoom sur un écran 1×.
    expect(demandes.filter(d => d.endsWith('l'))).toEqual([])
  })

  test('vignettes : aller directement à une page', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/magazine/exemple')
    await page.getByRole('button', { name: /Pages/ }).click()
    await page.getByRole('button', { name: 'Aller à la page 6' }).click()
    await expect(page.locator('.barre-libelle')).toHaveText('Pages 6–7 sur 8')
  })

  test('numéro inconnu : 404', async ({ page }) => {
    const res = await page.goto('/magazine/numero-inexistant')
    expect(res?.status()).toBe(404)
  })

  test('numéro d\'exemple non indexé', async ({ page }) => {
    await page.goto('/magazine/exemple')
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
  })
})
