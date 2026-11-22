import { test, expect, devices } from '@playwright/test'
import { resetMock } from './helpers/reset'

// Les champs de texte mis en forme (bloc Texte riche, corps du bloc Texte +
// Image…) s'éditent comme dans un traitement de texte : plus de balises
// <p>, <strong>… visibles dans l'admin. Le contenu reste stocké en HTML.

async function ouvrirBlocTexteRiche(page: import('@playwright/test').Page) {
  await page.goto('/test-blocks?admin=true')
  await page.waitForSelector('.block-wrapper[data-block-type="richText"]', { timeout: 10000 })
  await page.locator('.block-wrapper[data-block-type="richText"]').click()
  const champ = page.locator('.auto-field').filter({ has: page.locator('.field-label', { hasText: /^Contenu$/ }) })
  await expect(champ.locator('.rt-zone')).toBeVisible()
  return champ
}

test.describe('Éditeur de texte visuel de l\'admin', () => {
  test.beforeEach(async ({ request }) => {
    await resetMock(request)
  })

  test('le texte s\'affiche mis en forme, sans balise HTML visible', async ({ page }) => {
    const champ = await ouvrirBlocTexteRiche(page)
    const zone = champ.locator('.rt-zone')
    await expect(zone.locator('h2')).toHaveText('Bloc richText animé')
    await expect(zone).not.toContainText('<h2>')
    await expect(champ.locator('textarea')).toHaveCount(0)
  })

  test('mettre en gras met à jour le bloc sur la page', async ({ page }) => {
    const champ = await ouvrirBlocTexteRiche(page)
    const zone = champ.locator('.rt-zone')
    // Sélectionner « démonstration » puis cliquer G.
    await zone.locator('p').evaluate((p) => {
      const t = p.firstChild as Text
      const debut = t.data.indexOf('démonstration')
      const r = document.createRange()
      r.setStart(t, debut)
      r.setEnd(t, debut + 'démonstration'.length)
      const sel = window.getSelection()!
      sel.removeAllRanges()
      sel.addRange(r)
    })
    await champ.locator('.rt-gras').click()
    const rendu = page.locator('.block-wrapper[data-block-type="richText"] .richtext-inner')
    await expect(rendu.locator('b, strong')).toHaveText('démonstration')
    await expect(champ.locator('.rt-gras')).toHaveAttribute('aria-pressed', 'true')
  })

  test('taper du texte et ajouter un lien', async ({ page }) => {
    const champ = await ouvrirBlocTexteRiche(page)
    const zone = champ.locator('.rt-zone')
    await zone.locator('p').click()
    await page.keyboard.press('End')
    await page.keyboard.type(' Bienvenue')
    const rendu = page.locator('.block-wrapper[data-block-type="richText"] .richtext-inner')
    await expect(rendu).toContainText('Contenu de démonstration. Bienvenue')

    // Lien sur le mot tapé.
    await page.keyboard.down('Shift')
    for (let i = 0; i < 'Bienvenue'.length; i++) await page.keyboard.press('ArrowLeft')
    await page.keyboard.up('Shift')
    await champ.locator('.rt-lien').click()
    await champ.locator('.rt-lien-input').fill('/contact')
    await champ.locator('.rt-ok').click()
    await expect(rendu.locator('a[href="/contact"]')).toHaveText('Bienvenue')
  })

  test('le code HTML reste accessible en mode avancé', async ({ page }) => {
    const champ = await ouvrirBlocTexteRiche(page)
    await champ.locator('.rt-bascule').click()
    const code = champ.locator('textarea.rt-code')
    await expect(code).toHaveValue(/<h2>Bloc richText animé<\/h2>/)
    await code.fill('<h2>Titre changé</h2>')
    await champ.locator('.rt-bascule').click()
    await expect(champ.locator('.rt-zone h2')).toHaveText('Titre changé')
    await expect(page.locator('.block-wrapper[data-block-type="richText"] .richtext-inner h2')).toHaveText('Titre changé')
  })

  test('ouvrir un bloc sans rien taper ne modifie pas son contenu', async ({ page }) => {
    await ouvrirBlocTexteRiche(page)
    await expect(page.locator('.admin-toolbar')).not.toContainText(/modifications? non enregistr/i)
    const rendu = page.locator('.block-wrapper[data-block-type="richText"] .richtext-inner')
    expect(await rendu.innerHTML()).toBe('<h2>Bloc richText animé</h2><p>Contenu de démonstration.</p>')
  })

  test('le corps du bloc Texte + Image s\'édite aussi sans HTML', async ({ page }) => {
    await page.goto('/test-blocks?admin=true')
    await page.waitForSelector('.block-wrapper[data-block-type="textImage"]', { timeout: 10000 })
    await page.locator('.block-wrapper[data-block-type="textImage"]').first().click()
    const champ = page.locator('.auto-field').filter({ has: page.locator('.field-label', { hasText: /^Contenu$/ }) })
    await expect(champ.locator('.rt-zone')).toBeVisible()
  })
})

const { defaultBrowserType: _navigateur, ...iphone } = devices['iPhone 13']

test.describe('Éditeur de texte visuel sur téléphone', () => {
  test.use(iphone)

  test.beforeEach(async ({ request }) => {
    await resetMock(request)
  })

  test('la barre d\'outils tient dans la largeur et le texte se modifie', async ({ page }) => {
    await page.goto('/test-blocks?admin=true')
    await page.waitForSelector('.block-wrapper[data-block-type="richText"]', { timeout: 10000 })
    await page.evaluate(() => (document.querySelector('.block-wrapper[data-block-type="richText"]') as HTMLElement).click())
    await page.locator('.admin-pastille-ouvrir').click()
    const barre = page.locator('.admin-sidebar .rt-toolbar').first()
    await expect(barre).toBeVisible()
    const { sw, cw, droite } = await barre.evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth, droite: el.getBoundingClientRect().right }))
    expect(sw).toBeLessThanOrEqual(cw + 1)
    expect(droite).toBeLessThanOrEqual(390)

    const zone = page.locator('.admin-sidebar .rt-zone').first()
    await zone.locator('p').tap()
    await page.keyboard.press('End')
    await page.keyboard.type(' Merci')
    await expect(page.locator('.block-wrapper[data-block-type="richText"] .richtext-inner')).toContainText('démonstration. Merci')
  })
})
