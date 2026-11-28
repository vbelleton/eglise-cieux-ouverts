import { test, expect } from '@playwright/test'
import { resetMock } from './helpers/reset'
import { collectErrors } from './helpers/console'

// Viewport large : le canvas doit être entièrement visible pour que les
// coordonnées de drag/resize (page.mouse) tombent dans le bon élément.
test.use({ viewport: { width: 1280, height: 1400 } })

async function selectHeroBlock(page: import('@playwright/test').Page) {
  await page.locator('.block-wrapper[data-block-id="bloc-hero"]').click()
  await page.waitForTimeout(300)
}

test.describe('Éléments additionnels (canvas libre) — panneau sidebar', () => {
  test.beforeEach(async ({ request }) => {
    await resetMock(request)
  })

  test('un bloc sans extraElements ne rend aucun .bee-el (non-régression)', async ({ page }) => {
    const errors = collectErrors(page)
    await page.goto('/accueil?admin=true')
    await page.waitForSelector('.admin-toolbar', { timeout: 10000 })
    await page.waitForTimeout(500)

    await expect(page.locator('.bee-el')).toHaveCount(0)
    expect(errors).toEqual([])
  })

  test('ajouter un élément de chaque type les fait apparaître dans la sidebar et sur le canvas', async ({ page }) => {
    const errors = collectErrors(page)
    await page.goto('/accueil?admin=true')
    await page.waitForSelector('.admin-toolbar', { timeout: 10000 })
    await selectHeroBlock(page)

    await expect(page.locator('.field-elements')).toBeVisible()

    await page.locator('.array-add-btn', { hasText: /^\+ Texte$/ }).click()
    await page.locator('.array-add-btn', { hasText: '+ Image' }).click()
    await page.locator('.array-add-btn', { hasText: '+ Bouton' }).click()

    await expect(page.locator('.field-elements .array-item')).toHaveCount(3)
    await expect(page.locator('.bee-el')).toHaveCount(3)

    expect(errors).toEqual([])
  })

  test('éditer le contenu met à jour le rendu du canvas en direct', async ({ page }) => {
    await page.goto('/accueil?admin=true')
    await page.waitForSelector('.admin-toolbar', { timeout: 10000 })
    await selectHeroBlock(page)

    await page.locator('.array-add-btn', { hasText: /^\+ Texte$/ }).click()
    await page.locator('.field-elements .field-textarea').fill('Texte de test canvas')
    await expect(page.locator('.bee-text')).toHaveText('Texte de test canvas')

    await page.locator('.array-add-btn', { hasText: '+ Image' }).click()
    const imageInputs = page.locator('.field-elements .array-item').nth(1).locator('.field-input')
    await imageInputs.first().fill('/logo.png')
    await expect(page.locator('.bee-image')).toHaveAttribute('src', '/logo.png')

    await page.locator('.array-add-btn', { hasText: '+ Bouton' }).click()
    const buttonInputs = page.locator('.field-elements .array-item').nth(2).locator('.field-input')
    await buttonInputs.first().fill('Cliquez ici')
    await expect(page.locator('.bee-button')).toHaveText('Cliquez ici')
  })

  test('cliquer un élément dans la sidebar le sélectionne sur le canvas (et inversement)', async ({ page }) => {
    await page.goto('/accueil?admin=true')
    await page.waitForSelector('.admin-toolbar', { timeout: 10000 })
    await selectHeroBlock(page)

    await page.locator('.array-add-btn', { hasText: /^\+ Texte$/ }).click()
    await page.locator('.array-add-btn', { hasText: '+ Image' }).click()

    // Sélection depuis la sidebar → le canvas surligne l'élément sélectionné
    // (statique, pas encore de poignées — il faut cliquer ⤢ pour ça).
    // On clique le header (pas le body de l'item : la textarea/les inputs ont
    // @click.stop pour ne pas déclencher la sélection en éditant du contenu).
    await page.locator('.field-elements .array-item').first().locator('.array-item-header').click()
    await expect(page.locator('.field-elements .array-item').first()).toHaveClass(/array-item-selected/)
    await expect(page.locator('.bee-el').first()).toHaveClass(/bee-el-selected/)

    // Sélection depuis le canvas (clic direct) → la sidebar suit
    await page.locator('.bee-el').nth(1).click()
    await expect(page.locator('.field-elements .array-item').nth(1)).toHaveClass(/array-item-selected/)
  })

  test('déplacer un élément à la souris met à jour sa position (%) et persiste', async ({ page }) => {
    const errors = collectErrors(page)
    await page.goto('/accueil?admin=true')
    await page.waitForSelector('.admin-toolbar', { timeout: 10000 })
    await selectHeroBlock(page)

    await page.locator('.array-add-btn', { hasText: /^\+ Texte$/ }).click()
    await page.locator('.field-elements .field-textarea').fill('Élément déplaçable')

    // Le drag ne s'active plus à la simple sélection : il faut cliquer ⤢
    // pour entrer en mode positionnement (la sidebar se cache).
    await page.locator('.array-item-position-btn').click()
    await page.waitForTimeout(200)

    const el = page.locator('.bee-el').first()
    const before = await el.boundingBox()
    if (!before) throw new Error('bounding box introuvable')

    await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2)
    await page.mouse.down()
    await page.mouse.move(before.x + before.width / 2 + 100, before.y + before.height / 2 + 50, { steps: 10 })
    await page.mouse.up()
    await page.waitForTimeout(300)

    const after = await el.boundingBox()
    if (!after) throw new Error('bounding box introuvable après drag')
    expect(Math.abs(after.x - before.x)).toBeGreaterThan(50)
    expect(Math.abs(after.y - before.y)).toBeGreaterThan(20)

    // Valider le positionnement pour rouvrir la sidebar
    await page.locator('.bee-validate-btn').click()
    await page.waitForTimeout(200)

    // Sauvegarde puis vérification de la persistance via l'API
    await page.locator('button[title="Sauvegarder les modifications"], button:has-text("Sauvegarder")').first().click()
    await page.waitForTimeout(500)

    const res = await page.request.get('/api/pages/accueil')
    const data = await res.json()
    const hero = (data.blocks || []).find((b: any) => b.id === 'bloc-hero')
    expect(hero?.props?.extraElements?.length).toBe(1)
    expect(hero.props.extraElements[0].xPct).toBeGreaterThan(10) // défaut était 10

    expect(errors).toEqual([])
  })

  test('redimensionner un élément avec une poignée met à jour largeur/hauteur (%)', async ({ page }) => {
    await page.goto('/accueil?admin=true')
    await page.waitForSelector('.admin-toolbar', { timeout: 10000 })
    await selectHeroBlock(page)

    await page.locator('.array-add-btn', { hasText: /^\+ Texte$/ }).click()

    // Le resize ne s'active plus à la simple sélection : il faut cliquer ⤢
    // pour entrer en mode positionnement (la sidebar se cache).
    await page.locator('.array-item-position-btn').click()
    await page.waitForTimeout(200)

    const el = page.locator('.bee-el').first()
    const before = await el.boundingBox()
    if (!before) throw new Error('bounding box introuvable')

    const handle = el.locator('.handle-br')
    const handleBox = await handle.boundingBox()
    if (!handleBox) throw new Error('poignée introuvable')

    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2)
    await page.mouse.down()
    await page.mouse.move(handleBox.x + 80, handleBox.y + 40, { steps: 10 })
    await page.mouse.up()
    await page.waitForTimeout(300)

    const after = await el.boundingBox()
    if (!after) throw new Error('bounding box introuvable après resize')
    expect(after.width).toBeGreaterThan(before.width)
    expect(after.height).toBeGreaterThan(before.height)
  })

  test('supprimer un élément le retire de la sidebar et du canvas', async ({ page }) => {
    await page.goto('/accueil?admin=true')
    await page.waitForSelector('.admin-toolbar', { timeout: 10000 })
    await selectHeroBlock(page)

    await page.locator('.array-add-btn', { hasText: /^\+ Texte$/ }).click()
    await page.locator('.array-add-btn', { hasText: '+ Image' }).click()
    await expect(page.locator('.bee-el')).toHaveCount(2)

    await page.locator('.field-elements .array-item-del').first().click()
    await expect(page.locator('.field-elements .array-item')).toHaveCount(1)
    await expect(page.locator('.bee-el')).toHaveCount(1)

    await page.locator('.field-elements .array-item-del').first().click()
    await expect(page.locator('.field-elements .array-item')).toHaveCount(0)
    await expect(page.locator('.bee-el')).toHaveCount(0)
  })

  test('le canvas se superpose sur le contenu du bloc (pas une zone séparée en dessous)', async ({ page }) => {
    await page.goto('/accueil?admin=true')
    await page.waitForSelector('.admin-toolbar', { timeout: 10000 })
    await selectHeroBlock(page)

    await page.locator('.array-add-btn', { hasText: /^\+ Texte$/ }).click()

    const heroWrapper = page.locator('.block-wrapper[data-block-id="bloc-hero"]')
    const heroBox = await heroWrapper.boundingBox()
    const canvasBox = await page.locator('.bee-canvas').boundingBox()
    if (!heroBox || !canvasBox) throw new Error('bounding box introuvable')

    // Le canvas occupe exactement la même zone que le bloc — aucune bande
    // supplémentaire ajoutée après le contenu du bloc.
    expect(canvasBox.y).toBeCloseTo(heroBox.y, 0)
    expect(canvasBox.height).toBeCloseTo(heroBox.height, 0)
  })

  test('un clic sur une zone vide du canvas atteint le contenu du bloc en dessous (pointer-events)', async ({ page }) => {
    // Testé sur le rendu PUBLIC : en admin, le backdrop plein écran de la
    // sidebar (.admin-sidebar-overlay, z-index 9998) couvrirait toute la
    // page dès qu'un bloc est sélectionné, ce qui fausserait ce test —
    // ce backdrop est un comportement préexistant indépendant du canvas.
    await page.goto('/accueil?admin=true')
    await page.waitForSelector('.admin-toolbar', { timeout: 10000 })
    await selectHeroBlock(page)
    await page.locator('.array-add-btn', { hasText: /^\+ Texte$/ }).click()
    await page.locator('button[title="Sauvegarder les modifications"], button:has-text("Sauvegarder")').first().click()
    await page.waitForTimeout(500)

    await page.goto('/accueil')
    await page.waitForTimeout(500)

    // Un point du canvas loin de l'élément (60%/70%) doit résoudre vers le
    // contenu du bloc (l'image de fond du Hero), pas vers .bee-canvas
    // lui-même (pointer-events: none sur la zone vide).
    const topElement = await page.evaluate(() => {
      const canvas = document.querySelector('.bee-canvas') as HTMLElement
      const rect = canvas.getBoundingClientRect()
      const el = document.elementFromPoint(rect.left + rect.width * 0.6, rect.top + rect.height * 0.7)
      return el?.className
    })
    expect(topElement).not.toContain('bee-canvas')
  })

  test('un élément statique du canvas sélectionne son bloc (comportement homogène avec les champs fixes)', async ({ page }) => {
    // Comportement voulu : un élément additionnel statique (non en cours de
    // positionnement) doit se comporter comme un champ fixe de bloc — un
    // clic dessus sélectionne/ouvre la sidebar de SON bloc, même si un
    // autre bloc était sélectionné auparavant.
    await page.goto('/accueil?admin=true')
    await page.waitForSelector('.admin-toolbar', { timeout: 10000 })
    await selectHeroBlock(page)
    await page.locator('.array-add-btn', { hasText: /^\+ Texte$/ }).click()

    // On sélectionne un AUTRE bloc — editingBlockId pointe maintenant vers lui.
    // Comportement préexistant de la sidebar (indépendant du canvas) : tant
    // qu'elle est ouverte, son backdrop plein écran (.admin-sidebar-overlay)
    // intercepte tout clic ailleurs sur la page — il faut donc cliquer le
    // backdrop explicitement pour fermer la sidebar du Hero avant de
    // pouvoir sélectionner Bienvenue (Playwright cible le locator demandé
    // et attend qu'il devienne cliquable, il ne clique jamais l'obstruction
    // à sa place comme le ferait un utilisateur réel).
    await page.locator('.admin-sidebar-overlay').click()
    await page.waitForTimeout(200)
    await page.locator('.block-wrapper[data-block-id="bloc-bienvenue"]').click()
    await page.waitForTimeout(200)
    await expect(page.locator('.block-wrapper.admin-selected')).toHaveAttribute('data-block-id', 'bloc-bienvenue')

    // Cliquer sur l'élément statique du Hero (bloc non sélectionné) doit
    // ramener la sélection sur le Hero et identifier l'élément dans la sidebar
    await page.locator('.bee-el').first().click()
    await page.waitForTimeout(200)
    await expect(page.locator('.block-wrapper.admin-selected')).toHaveAttribute('data-block-id', 'bloc-hero')
    await expect(page.locator('.field-elements .array-item').first()).toHaveClass(/array-item-selected/)
  })

  test('interagir avec un élément en cours de positionnement ne re-sélectionne pas le bloc (ne coupe pas un drag/resize en cours)', async ({ page }) => {
    // Bug réel : docPointerHandler/docClickHandler/wrapperClick sélectionnaient
    // le bloc sur TOUT clic dans .block-wrapper, y compris sur les poignées
    // VueDraggableResizable — rouvrant/re-render la sidebar en pleine saisie
    // d'une poignée et avalant le drag, exactement le bug déjà connu et
    // corrigé pour .drag-handle (Sortable). Cette protection ne concerne
    // désormais que l'élément ACTIVEMENT en positionnement (.bee-el-drag) :
    // un clic dessus ne doit pas appeler selectBlock() (qui réinitialiserait
    // positioningElementId et couperait le drag/resize en cours).
    await page.goto('/accueil?admin=true')
    await page.waitForSelector('.admin-toolbar', { timeout: 10000 })
    await selectHeroBlock(page)
    await page.locator('.array-add-btn', { hasText: /^\+ Texte$/ }).click()
    await page.locator('.array-item-position-btn').click()
    await page.waitForTimeout(200)

    await page.locator('.bee-el').first().click()
    await page.waitForTimeout(200)
    await expect(page.locator('.bee-el').first()).toHaveClass(/bee-el-drag/)
    await expect(page.locator('.bee-validate-btn')).toBeVisible()
  })

  test('persistance après rechargement : le rendu public statique reflète position/taille/contenu', async ({ page }) => {
    await page.goto('/accueil?admin=true')
    await page.waitForSelector('.admin-toolbar', { timeout: 10000 })
    await selectHeroBlock(page)

    await page.locator('.array-add-btn', { hasText: /^\+ Texte$/ }).click()
    await page.locator('.field-elements .field-textarea').fill('Persisté après reload')

    await page.locator('button[title="Sauvegarder les modifications"], button:has-text("Sauvegarder")').first().click()
    await page.waitForTimeout(500)

    await page.goto('/accueil')
    await page.waitForTimeout(500)

    const bee = page.locator('.bee-el').first()
    await expect(bee).toHaveText('Persisté après reload')
    const style = await bee.getAttribute('style')
    expect(style).toContain('position:absolute')
    expect(style).toContain('%')
  })
})

test.describe('« Rendre déplaçable » — promouvoir un champ existant en élément libre', () => {
  test.beforeEach(async ({ request }) => {
    await resetMock(request)
  })

  async function selectBienvenueBlock(page: import('@playwright/test').Page) {
    await page.locator('.block-wrapper[data-block-id="bloc-bienvenue"]').click()
    await page.waitForTimeout(300)
  }

  test('promouvoir un champ jamais édité (valeur par défaut) ne duplique pas le contenu', async ({ page }) => {
    // Bug réel rencontré en implémentant la fonctionnalité : le titre du
    // bloc Bienvenue n'a jamais été explicitement défini, il s'affiche via
    // BLOCK_TYPES.bienvenue.defaults.title = "BIENVENUE". Vider le champ
    // à '' seul ne suffit pas : normalizeBlock retombe sur ce même default,
    // recréant le même texte à l'ancien emplacement en plus du nouvel
    // élément flottant — d'où le mécanisme props.promotedFields.
    const errors = collectErrors(page)
    await page.goto('/accueil?admin=true')
    await page.waitForSelector('.admin-toolbar', { timeout: 10000 })
    await selectBienvenueBlock(page)

    const titreField = page.locator('.auto-field').filter({ has: page.locator('.field-label', { hasText: /^Titre$/ }) })
    await expect(titreField.locator('.field-promote-btn')).toBeVisible()
    await titreField.locator('.field-promote-btn').click()
    await page.waitForTimeout(200)

    // Le texte "BIENVENUE" n'apparaît qu'une fois (l'élément flottant),
    // pas une deuxième fois à son ancien emplacement fixe.
    const wrapper = page.locator('.block-wrapper[data-block-id="bloc-bienvenue"]')
    await expect(wrapper.locator('.bee-el')).toHaveCount(1)
    await expect(wrapper.locator('.bee-el').first()).toHaveText('BIENVENUE')
    const bienvenueOccurrences = await wrapper.evaluate((el) => (el.textContent?.match(/BIENVENUE/g) || []).length)
    expect(bienvenueOccurrences).toBe(1)

    // Le bouton reste affiché après promotion (il devient « Déplacer », pour
    // relancer le positionnement — cf. tests dédiés plus bas), il ne
    // disparaît pas.
    await expect(titreField.locator('.field-promote-btn')).toHaveText('⇱ Déplacer')

    expect(errors).toEqual([])
  })

  test('l\'élément promu est sélectionné automatiquement et s\'édite comme un élément ajouté', async ({ page }) => {
    // Le drag/resize d'un élément du canvas est déjà couvert mécaniquement
    // par les tests "déplacer..."/"redimensionner..." plus haut (identique
    // pour un élément ajouté ou promu, même composant sous-jacent). Ici on
    // vérifie spécifiquement ce qui est NOUVEAU pour la promotion : la
    // sélection automatique et l'édition via le même panneau FieldElements.
    await page.goto('/accueil?admin=true')
    await page.waitForSelector('.admin-toolbar', { timeout: 10000 })
    await selectBienvenueBlock(page)

    const titreField = page.locator('.auto-field').filter({ has: page.locator('.field-label', { hasText: /^Titre$/ }) })
    await titreField.locator('.field-promote-btn').click()
    await page.waitForTimeout(200)

    const el = page.locator('.bee-el').first()
    // Le champ a déjà du contenu (pas besoin de le taper) : la promotion
    // lance directement le mode positionnement (poignées actives, sidebar
    // cachée), sans étape intermédiaire.
    await expect(el).toHaveClass(/bee-el-drag/)
    await expect(el).toHaveClass(/active/)

    // Valider referme le mode positionnement et rouvre la sidebar
    await page.locator('.bee-validate-btn').click()
    await page.waitForTimeout(200)
    await expect(page.locator('.field-elements .array-item').first()).toHaveClass(/array-item-selected/)

    // Édition de contenu via le même panneau FieldElements que les
    // éléments ajoutés normalement
    await page.locator('.field-elements .field-textarea').fill('Titre modifié après promotion')
    await expect(el).toHaveText('Titre modifié après promotion')
  })

  test('un titre promu conserve sa couleur et sa taille d\'origine', async ({ page }) => {
    // Le titre Bienvenue s'affiche en #064886 à 5em ; une fois promu, le
    // texte détaché doit garder cette apparence plutôt que de retomber sur
    // le style générique de .bee-text (voir promoteField dans AutoEditor).
    await page.goto('/accueil?admin=true')
    await page.waitForSelector('.admin-toolbar', { timeout: 10000 })
    await selectBienvenueBlock(page)

    const titreField = page.locator('.auto-field').filter({ has: page.locator('.field-label', { hasText: /^Titre$/ }) })
    await titreField.locator('.field-promote-btn').click()
    await page.waitForTimeout(200)

    const beeText = page.locator('.bee-text').first()
    // #064886 == rgb(6, 72, 134) ; 5em == 80px (base 16px)
    await expect(beeText).toHaveCSS('color', 'rgb(6, 72, 134)')
    await expect(beeText).toHaveCSS('font-size', '80px')
  })

  test('un champ promu affiche une note à la place de son éditeur (pas de re-saisie possible)', async ({ page }) => {
    await page.goto('/accueil?admin=true')
    await page.waitForSelector('.admin-toolbar', { timeout: 10000 })
    await selectBienvenueBlock(page)

    const titreField = page.locator('.auto-field').filter({ has: page.locator('.field-label', { hasText: /^Titre$/ }) })
    await titreField.locator('.field-promote-btn').click()
    await page.waitForTimeout(200)

    // La promotion lance directement le mode positionnement (sidebar
    // cachée) : valider pour la rouvrir et vérifier l'état du champ.
    await page.locator('.bee-validate-btn').click()
    await page.waitForTimeout(200)

    // Le champ affiche désormais une note "déplacé sur la page", plus
    // d'éditeur de VALEUR (impossible de re-saisir un texte qui recréerait
    // le doublon). Le bouton « Déplacer » et les contrôles police/taille
    // restent eux affichés en permanence — un champ promu doit garder les
    // mêmes réglages qu'avant promotion, seule la saisie de contenu passe
    // par le panneau FieldElements désormais.
    await expect(titreField.locator('.field-promoted-note')).toBeVisible()
    await expect(titreField.locator('.field-input, .field-textarea')).toHaveCount(0)
    await expect(titreField.locator('.field-promote-btn')).toHaveText('⇱ Déplacer')
    await expect(titreField.locator('.field-size-input')).toBeVisible()
    await expect(titreField.locator('.field-font-picker')).toBeVisible()
  })

  test('le bouton « Déplacer » reste affiché après promotion et relance le positionnement sans doublon', async ({ page }) => {
    await page.goto('/accueil?admin=true')
    await page.waitForSelector('.admin-toolbar', { timeout: 10000 })
    await selectBienvenueBlock(page)

    const titreField = page.locator('.auto-field').filter({ has: page.locator('.field-label', { hasText: /^Titre$/ }) })
    await titreField.locator('.field-promote-btn').click()
    await page.waitForTimeout(200)
    await page.locator('.bee-validate-btn').click()
    await page.waitForTimeout(200)

    await expect(page.locator('.bee-el')).toHaveCount(1)

    // Re-cliquer le bouton (maintenant « Déplacer ») relance le mode
    // positionnement sur le MÊME élément, sans en créer un second.
    await titreField.locator('.field-promote-btn').click()
    await page.waitForTimeout(200)
    await expect(page.locator('.bee-el')).toHaveClass(/bee-el-drag/)
    await expect(page.locator('.bee-validate-btn')).toBeVisible()
    await page.locator('.bee-validate-btn').click()
    await page.waitForTimeout(200)
    await expect(page.locator('.bee-el')).toHaveCount(1)
  })

  test('après sauvegarde + rechargement, re-cliquer « Déplacer » ne crée pas de doublon', async ({ page }) => {
    // Scénario utilisateur réel : promouvoir un champ, sauvegarder, revenir
    // plus tard (reload) et re-cliquer « Déplacer ». promotedFields et
    // extraElements doivent survivre au cycle save/reload — sinon le champ
    // réapparaît (default restauré par normalizeBlock) et chaque re-clic
    // empile un nouvel élément « Texte #N » dans la sidebar.
    await page.goto('/accueil?admin=true')
    await page.waitForSelector('.admin-toolbar', { timeout: 10000 })
    await selectBienvenueBlock(page)

    const titreField = page.locator('.auto-field').filter({ has: page.locator('.field-label', { hasText: /^Titre$/ }) })
    await titreField.locator('.field-promote-btn').click()
    await page.waitForTimeout(200)
    await page.locator('.bee-validate-btn').click()
    await page.waitForTimeout(200)

    await page.locator('button[title="Sauvegarder les modifications"]').click()
    await expect(page.locator('.admin-toolbar')).toContainText('Sauvegardé', { timeout: 5000 })

    await page.goto('/accueil?admin=true')
    await page.waitForSelector('.admin-toolbar', { timeout: 10000 })
    await selectBienvenueBlock(page)

    // L'état promu a survécu : un seul élément dans la sidebar, note affichée
    await expect(page.locator('.field-elements .array-item')).toHaveCount(1)
    await expect(page.locator('.field-promoted-note')).toBeVisible()

    // Re-cliquer « Déplacer » relance le positionnement sur le même élément
    const titreField2 = page.locator('.auto-field').filter({ has: page.locator('.field-label', { hasText: /^Titre$/ }) })
    await titreField2.locator('.field-promote-btn').click()
    await page.waitForTimeout(200)
    await expect(page.locator('.bee-el')).toHaveCount(1)
    await page.locator('.bee-validate-btn').click()
    await page.waitForTimeout(200)
    await expect(page.locator('.bee-el')).toHaveCount(1)
    await expect(page.locator('.field-elements .array-item')).toHaveCount(1)
  })

  test('un champ richtext (bloc Texte riche) est promouvable et son HTML est rendu, pas affiché en texte brut', async ({ page }) => {
    // Le champ "content" du bloc richText était le seul type de champ exclu
    // de « Rendre déplaçable » : son HTML aurait été affiché tel quel en
    // texte brut par .bee-text. Un kind 'richtext' dédié le rend via v-html
    // (sanitizeHtml), comme BlockRichText.vue en position fixe.
    const errors = collectErrors(page)
    await page.goto('/test-blocks?admin=true')
    await page.waitForSelector('.block-wrapper[data-block-type="richText"]', { timeout: 10000 })
    await page.locator('.block-wrapper[data-block-type="richText"]').click()
    await page.waitForTimeout(300)

    const contentField = page.locator('.auto-field').filter({ has: page.locator('.field-label', { hasText: /^Contenu$/ }) })
    await expect(contentField.locator('.field-promote-btn')).toBeVisible()
    await contentField.locator('.field-promote-btn').click()
    await page.waitForTimeout(200)

    const wrapper = page.locator('.block-wrapper[data-block-type="richText"]')
    // Le <h2> du contenu mock ("Bloc richText animé") est rendu comme
    // véritable élément HTML, pas comme texte brut contenant des chevrons.
    await expect(wrapper.locator('.bee-richtext h2')).toHaveText('Bloc richText animé')
    await expect(wrapper.locator('.bee-text')).toHaveCount(0)

    // La promotion lance directement le mode positionnement (sidebar
    // cachée) : valider pour la rouvrir et vérifier l'état du champ.
    await page.locator('.bee-validate-btn').click()
    await page.waitForTimeout(200)

    // Le champ affiche la note de promotion, plus d'éditeur de valeur ; le
    // bouton « Déplacer » reste lui affiché en permanence pour relancer le
    // positionnement sans doublon (voir les tests équivalents pour « Titre »).
    await expect(contentField.locator('.field-promoted-note')).toBeVisible()
    await expect(contentField.locator('.field-promote-btn')).toHaveText('⇱ Déplacer')

    expect(errors).toEqual([])
  })
})
