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
  livres: { x: 529, y: 684 },
  lieux: { x: 648, y: 684 },
  lire: { x: 701, y: 684 },
  priere: { x: 753, y: 684 },
}

/** Synthèse vocale factice : chaque verset « dure » 150 ms (le Chromium de test n'a pas de voix). */
function voixFactice() {
  const file: any[] = []
  let enCours: any = null
  const suivant = () => {
    enCours = file.shift() || null
    if (!enCours) return
    const u = enCours
    u.onstart?.({})
    u._t = setTimeout(() => {
      u.onend?.({})
      suivant()
    }, 150)
  }
  const synth = {
    speak(u: any) {
      file.push(u)
      if (!enCours) suivant()
    },
    cancel() {
      if (enCours) clearTimeout(enCours._t)
      file.length = 0
      enCours = null
    },
    resume() {},
    getVoices: () => [{ name: 'Thomas', lang: 'fr-FR', voiceURI: 'Thomas', localService: true }],
    addEventListener() {},
    removeEventListener() {},
  }
  Object.defineProperty(window, 'speechSynthesis', { value: synth })
  ;(window as any).SpeechSynthesisUtterance = function (this: any, texte: string) {
    this.text = texte
  }
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
  // « Prier » reste désactivé tant que la Bible n'est pas ouverte : on attend
  // le livre plutôt qu'un délai fixe, trop court sur une machine chargée.
  const bible = page.waitForResponse(/\/bible\/lsg\/\w+\.json/, { timeout: 30000 })
  await page.goto('/vr')
  await expect(page.locator('.vr-scene canvas')).toBeVisible({ timeout: 15000 })
  await bible
  // Laisse les textures, les prédications et le dessin du pupitre arriver.
  await page.waitForTimeout(2500)
  return erreurs
}

/** Se tourner vers le panneau des prédications (à droite). */
async function tournerVersPredications(page: Page) {
  await page.mouse.move(640, 400)
  await page.mouse.down()
  await page.mouse.move(240, 400, { steps: 8 })
  await page.mouse.up()
  await page.waitForTimeout(500)
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

  test('changer de lieu depuis le pupitre et depuis l’écran, choix retenu', async ({ page }) => {
    const erreurs = await ouvrirSalle(page)
    const lieu = page.getByRole('combobox', { name: 'Lieu de prière' })
    await expect(lieu).toHaveValue('chapelle')
    await page.mouse.click(PUPITRE.lieux.x, PUPITRE.lieux.y)
    await page.waitForTimeout(500)
    await page.mouse.click(725, 320) // 2e carte : « Notre salle »
    await expect(lieu).toHaveValue('salle')
    await lieu.selectOption('mer')
    await page.waitForTimeout(1500)
    expect(await page.evaluate(() => localStorage.getItem('vr-lieu'))).toBe('mer')
    await page.reload()
    await expect(page.locator('.vr-scene canvas')).toBeVisible({ timeout: 15000 })
    await expect(lieu).toHaveValue('mer')
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

  test('une prédication : ses passages, son écoute, sa vidéo', async ({ page }) => {
    const erreurs = await ouvrirSalle(page)
    await tournerVersPredications(page)
    await page.mouse.click(812, 355) // « L'enfant prodigue »
    await expect(page.locator('.vr-carte')).toContainText("L'enfant prodigue")
    // La Bible s'ouvre sur le premier passage cité ; une pastille par passage.
    await expect(page.locator('.vr-sr')).toContainText('Luc 15')
    await page.mouse.click(765, 375) // pastille « Matthieu 18.12-14 »
    await expect(page.locator('.vr-sr')).toContainText('Matthieu 18')
    // Écouter : lecteur YouTube invisible, commandable.
    await page.locator('.vr-carte').getByRole('button', { name: 'Écouter' }).click()
    await expect(page.locator('.vr-ecoute-lecteur')).toHaveAttribute('src', /embed\/aaaaaaaaaa2.*enablejsapi=1/)
    await expect(page.locator('.vr-ecoute').getByRole('button', { name: 'Pause' })).toBeVisible()
    // Regarder la vidéo arrête l'écoute.
    await page.getByRole('button', { name: 'Regarder la vidéo' }).click()
    await expect(page.locator('.vr-lecteur iframe')).toHaveAttribute('src', /youtube-nocookie\.com\/embed\/aaaaaaaaaa2/)
    await expect(page.locator('.vr-ecoute-lecteur')).toHaveCount(0)
    expect(erreurs).toEqual([])
  })

  test('rechercher dans les prédications et écouter au bon moment', async ({ page }) => {
    const erreurs = await ouvrirSalle(page)
    await tournerVersPredications(page)
    await page.mouse.click(815, 537) // « Rechercher »
    const champ = page.getByRole('searchbox', { name: 'Rechercher dans les prédications' })
    await expect(champ).toBeVisible()
    await champ.fill('pardon')
    await page.waitForTimeout(1500)
    await page.mouse.click(821, 386) // premier résultat
    await expect(page.locator('.vr-carte')).toContainText('Louange du dimanche')
    await page.mouse.click(820, 389) // moment « 12:34 »
    await expect(page.locator('.vr-ecoute-lecteur')).toHaveAttribute('src', /start=(12|754)&/)
    expect(erreurs).toEqual([])
  })

  test('la Bible lue à voix haute : « Lire » puis « Arrêter »', async ({ page }) => {
    await page.addInitScript(voixFactice)
    const erreurs = await ouvrirSalle(page)
    await page.mouse.click(PUPITRE.lire.x, PUPITRE.lire.y)
    // Le verset lu est annoncé hors du canvas.
    await expect(page.locator('.vr-sr')).toContainText(/verset \d+/)
    await page.mouse.click(PUPITRE.lire.x, PUPITRE.lire.y) // « Arrêter »
    await expect(page.locator('.vr-sr')).not.toContainText('verset')
    expect(erreurs).toEqual([])
  })

  test('surlignage seul : le verset défile sans voix, choix retenu', async ({ page }) => {
    // Une voix est présente, mais on choisit le surlignage seul : elle ne doit pas parler.
    await page.addInitScript(voixFactice)
    await page.addInitScript(() => {
      ;(window as any).paroles = 0
      const speak = window.speechSynthesis.speak.bind(window.speechSynthesis)
      window.speechSynthesis.speak = (u: any) => ((window as any).paroles++, speak(u))
    })
    const erreurs = await ouvrirSalle(page)
    await page.mouse.click(PUPITRE.lieux.x, PUPITRE.lieux.y)
    await page.waitForTimeout(500)
    await page.mouse.click(688, 632) // « Surlignage seul »
    await expect.poll(() => page.evaluate(() => localStorage.getItem('vr-voix'))).toBe('0')
    await page.mouse.click(640, 684) // « Retour au texte »
    await page.waitForTimeout(500)
    await page.mouse.click(PUPITRE.lire.x, PUPITRE.lire.y) // « Suivre »
    await expect(page.locator('.vr-sr')).toContainText(/verset \d+/)
    expect(await page.evaluate(() => (window as any).paroles)).toBe(0)
    expect(erreurs).toEqual([])
  })

  test('tableau du domaine public lié au passage ouvert, fond musical au choix', async ({ page }) => {
    const tableau = page.waitForRequest(/\/api\/vr\/tableau\/transfiguration/, { timeout: 30000 })
    const erreurs = await ouvrirSalle(page) // Matthieu 17 : la Transfiguration
    await tableau
    const musique = page.getByRole('combobox', { name: 'Fond musical' })
    await expect(musique).toHaveValue('repos')
    await musique.selectOption('nuit')
    expect(await page.evaluate(() => localStorage.getItem('vr-musique'))).toBe('nuit')
    await musique.selectOption('')
    expect(await page.evaluate(() => localStorage.getItem('vr-musique'))).toBe('')
    expect(erreurs).toEqual([])
  })

  test('aucun lien du site ne mène à la salle', async ({ page, request }) => {
    await page.goto('/')
    await expect(page.locator('a[href*="/vr"]')).toHaveCount(0)
    const sitemap = await (await request.get('/sitemap.xml')).text()
    expect(sitemap).not.toContain('/vr')
  })

  test('🥽 Salle VR (admin) enregistre les réglages, appliqués dans la salle', async ({ page, request }) => {
    await loginAsAdmin(page)
    await page.locator('button[title^="Salle de prière VR"]').click()
    const fenetre = page.locator('.salle-vr-modal')
    const section = fenetre.locator('.reglages-vr')
    await expect(section.getByLabel("Afficher les prochains rendez-vous de l'agenda")).toBeVisible()
    await section.getByLabel("Afficher les prochains rendez-vous de l'agenda").uncheck()
    await section.getByLabel("Titre affiché en haut de l'écran").fill('veillée de prière')
    await section.getByLabel("Passage biblique d'ouverture").fill('Psaume 23')
    await expect(section).toContainText("La Bible s'ouvrira sur Psaumes 23")
    await section.getByLabel('Durée du temps de prière').fill('5')
    // Ne proposer que la salle de l'église et le jardin, arrivée au jardin.
    for (const nom of ['La chapelle', 'Le bord de mer', 'La chambre', 'Au-dessus des nuages']) await section.locator('label', { hasText: nom }).locator('input').uncheck()
    await section.getByLabel("Lieu de prière à l'arrivée").selectOption('jardin')
    await section.getByRole('button', { name: 'Ajouter une image par URL' }).click()
    await section.getByPlaceholder('URL image').fill('/photos/salle.jpg')
    await fenetre.getByRole('button', { name: 'Sauvegarder' }).click()
    await expect(fenetre).toHaveCount(0)
    const reglages = await (await request.get('/api/vr/reglages')).json()
    expect(reglages).toMatchObject({
      titre: 'veillée de prière',
      passage: 'Psaume 23',
      dureePriere: 5,
      agenda: false,
      predications: true,
      photosSite: true,
      photos: ['/photos/salle.jpg'],
      lieux: ['salle', 'jardin'],
      lieu: 'jardin',
    })

    // La salle suit : titre, deux lieux seulement, Bible au Psaume 23.
    const livres: string[] = []
    page.on('request', (r) => {
      const m = r.url().match(/\/bible\/lsg\/(\w+)\.json/)
      if (m) livres.push(m[1])
    })
    await page.goto('/vr')
    await expect(page.locator('.vr-titre')).toContainText('veillée de prière')
    const lieu = page.getByRole('combobox', { name: 'Lieu de prière' })
    await expect(lieu).toHaveValue('jardin')
    await expect(lieu.locator('option')).toHaveText(['Notre salle', 'Le jardin d’oliviers'])
    await expect.poll(() => livres).toContain('PSA')
  })

  test('le passage d’ouverture invalide n’est pas enregistré', async ({ page, request }) => {
    await loginAsAdmin(page)
    await page.locator('button[title^="Salle de prière VR"]').click()
    const fenetre = page.locator('.salle-vr-modal')
    await fenetre.getByLabel("Passage biblique d'ouverture").fill('blabla 12')
    await expect(fenetre).toContainText('Passage non reconnu')
    await fenetre.getByRole('button', { name: 'Sauvegarder' }).click()
    await expect(fenetre).toBeVisible()
    const reglages = await (await request.get('/api/vr/reglages')).json()
    expect(reglages.passage).toBe('')
  })
})
