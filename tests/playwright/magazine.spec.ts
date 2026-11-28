import { test, expect } from '@playwright/test'

/**
 * Magazine feuilletable : liste /magazine, liseuse /magazine/<id>.
 * Le numéro d'exemple (utils/magazines.json, 12 pages) sert de support.
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
  // L'indice du premier passage (coin de page qui se soulève) est couvert à
  // part ; ailleurs il se déclencherait au milieu des gestes testés.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => { try { localStorage.setItem('magazine-astuce', '1') } catch {} })
  })

  test('premier passage : le coin se soulève mais la page ne tourne pas', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await ctx.newPage()
    await page.goto('/magazine/exemple')
    await expect(page.locator('.feuille')).toBeVisible({ timeout: 4000 })
    await expect(page.locator('.feuille')).toHaveCount(0, { timeout: 4000 })
    await expect(page.locator('.barre-libelle')).toHaveText('Page 1 sur 12')
    await ctx.close()
  })

  test('curseur : aller à une page d\'un geste', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/magazine/exemple')
    await page.locator('.barre-curseur').fill('6')
    await expect(page.locator('.barre-libelle')).toHaveText('Pages 6–7 sur 12')
  })
  test('la liste montre le numéro et mène à la liseuse', async ({ page }) => {
    await page.goto('/magazine')
    await expect(page.getByRole('heading', { level: 1, name: 'Magazine' })).toBeVisible()
    await page.getByRole('link', { name: 'Feuilleter' }).click()
    await expect(page).toHaveURL(/\/magazine\/exemple$/)
    await expect(page.locator('.barre-libelle')).toHaveText('Page 1 sur 12')
  })

  test('ordinateur : double page, clavier, adresse partageable', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/magazine/exemple')
    const libelle = page.locator('.barre-libelle')
    await expect(libelle).toHaveText('Page 1 sur 12')
    await page.keyboard.press('ArrowRight')
    await expect(libelle).toHaveText('Pages 2–3 sur 12')
    await expect(page).toHaveURL(/\?page=2$/)
    await page.keyboard.press('End')
    await expect(libelle).toHaveText('Page 12 sur 12')
    await page.keyboard.press('ArrowLeft')
    await expect(libelle).toHaveText('Pages 10–11 sur 12')
    await page.keyboard.press('Home')
    await expect(libelle).toHaveText('Page 1 sur 12')
    await expect(page).toHaveURL(/\/magazine\/exemple$/)
  })

  test('glisser la page vers la gauche la tourne', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/magazine/exemple?page=2')
    const libelle = page.locator('.barre-libelle')
    await expect(libelle).toHaveText('Pages 2–3 sur 12')
    const box = (await page.locator('.livre').boundingBox())!
    await page.mouse.move(box.x + box.width * 0.9, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width * 0.3, box.y + box.height / 2, { steps: 12 })
    await page.mouse.up()
    await expect(libelle).toHaveText('Pages 4–5 sur 12')
  })

  test('téléphone : une page à la fois, toucher le bord droit avance', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
    const page = await ctx.newPage()
    await page.addInitScript(() => { try { localStorage.setItem('magazine-astuce', '1') } catch {} })
    await page.goto('/magazine/exemple?page=3')
    const libelle = page.locator('.barre-libelle')
    await expect(libelle).toHaveText('Page 3 sur 12')
    const box = (await page.locator('.livre').boundingBox())!
    await page.touchscreen.tap(box.x + box.width * 0.75, box.y + box.height / 2)
    await expect(libelle).toHaveText('Page 4 sur 12')
    // Flèches de la barre (les grandes flèches de côté sont masquées sur téléphone).
    await page.locator('.barre-tourner[aria-label="Page suivante"]').click()
    await expect(libelle).toHaveText('Page 5 sur 12')
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
    await expect(page.locator('.barre-libelle')).toHaveText('Pages 6–7 sur 12')
  })

  test('plein écran : les boutons du bas ne le font pas quitter', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/magazine/exemple')
    const etat = () => page.evaluate(() => ({
      plein: !!document.fullscreenElement,
      hauteur: Math.round(document.querySelector('.liseuse')!.getBoundingClientRect().height),
    }))
    await page.locator('.barre-bouton[title="Plein écran"]').click()
    await expect.poll(etat).toEqual({ plein: true, hauteur: 800 })
    for (const titre of ['Toutes les pages', 'Toutes les pages', 'Agrandir', 'Revenir à la taille normale']) {
      await page.locator(`.barre-bouton[title="${titre}"]`).click()
      expect(await etat()).toEqual({ plein: true, hauteur: 800 })
    }
    await page.locator('.barre-bouton[title="Toutes les pages"]').click()
    await page.getByRole('button', { name: 'Aller à la page 5' }).click()
    await expect(page.locator('.barre-libelle')).toHaveText('Pages 4–5 sur 12')
    expect(await etat()).toEqual({ plein: true, hauteur: 800 })
    await page.locator('.fleche-droite').click()
    await expect(page.locator('.barre-libelle')).toHaveText('Pages 6–7 sur 12')
    expect(await etat()).toEqual({ plein: true, hauteur: 800 })
  })

  test('plein écran : des appuis rapprochés pendant une entrée lente ne le dérèglent pas', async ({ page }) => {
    // Comme macOS ou Android : le navigateur met un moment à passer en plein
    // écran. L'ancien code concluait à un échec au bout de 150 ms et activait
    // aussi le repli : les deux à la fois, puis un bouton qui ne répondait plus.
    await page.addInitScript(() => {
      const origine = Element.prototype.requestFullscreen
      Element.prototype.requestFullscreen = function () {
        return new Promise(r => setTimeout(r, 450)).then(() => origine.call(this))
      }
    })
    await page.goto('/magazine/exemple?page=4')
    const bouton = page.locator('.barre-bouton[aria-pressed][title*="lein écran"]')
    const etat = () => page.evaluate(() => ({
      plein: !!document.fullscreenElement,
      repli: !!document.querySelector('.liseuse-pseudo-plein'),
      bouton: document.querySelector('.barre-bouton[title*="lein écran"]').getAttribute('aria-pressed'),
    }))
    for (let i = 0; i < 6; i++) await bouton.click({ delay: 0 })
    await expect.poll(etat, { timeout: 4000 }).toEqual({ plein: true, repli: false, bouton: 'true' })
    await page.waitForTimeout(300)
    expect(await etat()).toEqual({ plein: true, repli: false, bouton: 'true' })
    // Et il se quitte toujours d'un appui.
    await bouton.click()
    await expect.poll(etat).toEqual({ plein: false, repli: false, bouton: 'false' })
  })

  test('iPhone (pas de plein écran pour une page) : le repli couvre tout l\'écran', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 664 }, hasTouch: true, isMobile: true })
    const page = await ctx.newPage()
    await page.addInitScript(() => {
      try { localStorage.setItem('magazine-astuce', '1') } catch {}
      // Comme Safari sur iPhone : méthode présente mais plein écran non permis.
      Object.defineProperty(Document.prototype, 'fullscreenEnabled', { get: () => false })
      Object.defineProperty(Document.prototype, 'webkitFullscreenEnabled', { get: () => false })
    })
    await page.goto('/magazine/exemple')
    const etat = () => page.evaluate(() => {
      const r = document.querySelector('.liseuse')!.getBoundingClientRect()
      return { repli: !!document.querySelector('.liseuse-pseudo-plein'), haut: Math.round(r.top), hauteur: Math.round(r.height) }
    })
    await page.locator('.barre-bouton[title="Plein écran"]').tap()
    await expect.poll(etat).toEqual({ repli: true, haut: 0, hauteur: 664 })
    await page.locator('.barre-bouton[title="Toutes les pages"]').tap()
    await page.getByRole('button', { name: 'Aller à la page 5' }).tap()
    await expect(page.locator('.barre-libelle')).toHaveText('Page 5 sur 12')
    await page.locator('.barre-bouton[title="Agrandir"]').tap()
    await page.locator('.barre-bouton[title="Revenir à la taille normale"]').tap()
    expect(await etat()).toEqual({ repli: true, haut: 0, hauteur: 664 })
    await page.locator('.barre-bouton[title="Quitter le plein écran"]').tap()
    await expect.poll(etat).toMatchObject({ repli: false })
    await ctx.close()
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
