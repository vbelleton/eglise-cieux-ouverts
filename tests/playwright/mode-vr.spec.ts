import { test, expect, type Page } from '@playwright/test'
import { loginAsAdmin } from './helpers/admin'
import { resetMock } from './helpers/reset'

/**
 * Salle de prière VR cachée (pages/vr.vue, lib/vr/scene.js, lib/vr/salle.js).
 *
 * Caché = aucun lien du site n'y mène, absent du sitemap, non indexé. Les
 * panneaux sont dessinés dans un canvas WebGL : on les vise par leur position
 * à l'écran, fixe à 1280×800 (caméra et panneaux à des places fixes), et on
 * vérifie l'effet dans la page (texte d'aide, carte de la vidéo…). Le casque
 * (WebXR) n'est pas testable ici.
 */

const PUPITRE = {
  livres: { x: 546, y: 684 },
  priere: { x: 714, y: 684 },
}

async function ouvrirSalle(page: Page) {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.route('**/api/church-events**', (route) =>
    route.fulfill({
      json: [
        { id: 1, title: 'Réunion de prière', start_date: '2099-01-08', start_time: '19:30', location: 'Salle de l’église' },
        { id: 2, title: 'Culte du dimanche', start_date: '2099-01-04', start_time: '10:30', repeat_period: 'week' },
      ],
    }),
  )
  await page.goto('/vr')
  await expect(page.locator('.vr-scene canvas')).toBeVisible({ timeout: 15000 })
  // Laisse les textures et les prédications arriver.
  await page.waitForTimeout(2500)
  return erreurs
}

test.describe('Salle de prière VR', () => {
  test.beforeEach(async ({ request }) => {
    await resetMock(request)
  })

  test('se charge sans erreur, non indexée, sans en-tête ni pied de page', async ({ page }) => {
    const erreurs = await ouvrirSalle(page)
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
    await expect(page.locator('.vr-aide')).toContainText('la Bible')
    await expect(page.locator('header.site-header, footer')).toHaveCount(0)
    expect(erreurs).toEqual([])
  })

  test('la Bible s’ouvre sur le passage de la dernière prédication', async ({ page }) => {
    const livres: string[] = []
    page.on('request', (r) => {
      const m = r.url().match(/\/bible\/lsg\/(\w+)\.json/)
      if (m) livres.push(m[1])
    })
    await ouvrirSalle(page)
    // Prédication la plus récente du mock : « … Matthieu 17 ».
    expect(livres).toContain('MAT')
  })

  test('temps de prière : commence au pupitre, se termine par le bouton', async ({ page }) => {
    const erreurs = await ouvrirSalle(page)
    await page.mouse.click(PUPITRE.priere.x, PUPITRE.priere.y)
    const terminer = page.getByRole('button', { name: 'Terminer le temps de prière' })
    await expect(terminer).toBeVisible()
    await expect(page.locator('.vr-aide')).toContainText('Temps de prière')
    await terminer.click()
    await expect(terminer).toHaveCount(0)
    expect(erreurs).toEqual([])
  })

  test('choisir un livre charge ce livre', async ({ page }) => {
    await ouvrirSalle(page)
    const requete = page.waitForRequest(/\/bible\/lsg\/ECC\.json/)
    await page.mouse.click(PUPITRE.livres.x, PUPITRE.livres.y)
    await page.waitForTimeout(500)
    await page.mouse.click(612, 390) // Ecclésiaste, dans la grille des livres
    await requete
  })

  test('une prédication propose sa vidéo', async ({ page }) => {
    await ouvrirSalle(page)
    // Se tourner vers le panneau des prédications (à droite).
    await page.mouse.move(640, 400)
    await page.mouse.down()
    await page.mouse.move(240, 400, { steps: 8 })
    await page.mouse.up()
    await page.waitForTimeout(500)
    await page.mouse.click(812, 355) // « L'enfant prodigue »
    await expect(page.locator('.vr-carte')).toContainText("L'enfant prodigue")
    await page.getByRole('button', { name: 'Regarder la vidéo' }).click()
    await expect(page.locator('.vr-lecteur iframe')).toHaveAttribute('src', /youtube-nocookie\.com\/embed\/aaaaaaaaaa2/)
  })

  test('aucun lien du site ne mène à la salle', async ({ page, request }) => {
    await page.goto('/')
    await expect(page.locator('a[href*="/vr"]')).toHaveCount(0)
    const sitemap = await (await request.get('/sitemap.xml')).text()
    expect(sitemap).not.toContain('/vr')
  })

  test('⚙ Config enregistre les réglages de la salle', async ({ page, request }) => {
    await loginAsAdmin(page)
    await page.locator('button[title="Configuration"]').click()
    const section = page.locator('.reglages-vr')
    await expect(section).toBeVisible()
    await section.getByLabel("Afficher les prochains rendez-vous de l'agenda").uncheck()
    await section.getByRole('button', { name: 'Ajouter une image par URL' }).click()
    await section.getByPlaceholder('URL image').fill('/photos/salle.jpg')
    await page.locator('.settings-modal').getByRole('button', { name: 'Sauvegarder' }).click()
    await expect(page.locator('.settings-modal')).toHaveCount(0)
    const reglages = await (await request.get('/api/vr/reglages')).json()
    expect(reglages).toMatchObject({ agenda: false, predications: true, photosSite: true, photos: ['/photos/salle.jpg'] })
  })
})
