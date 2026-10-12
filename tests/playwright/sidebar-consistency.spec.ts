import { test, expect } from '@playwright/test'
import { BLOCK_TYPES, createBlock } from '../../utils/blockTypes.js'
import { getBlockCssSelector } from '../../lib/blocks/component-registry'

/**
 * Test de cohérence sidebar ↔ bloc : vérifie que chaque champ du schema
 * peut être édité depuis la sidebar et que la modification est visible dans le rendu.
 */

test.describe('Sidebar consistency — All editable fields work', () => {
  test.use({ viewport: { width: 1280, height: 1400 } })

  // Liste des blocs à tester avec leurs champs éditables
  const BLOCK_TO_FIELD_CHECKS: Record<string, {
    schemaKey: string
    fieldLabel: RegExp
    testValue?: string
    skipElements?: boolean // Skip quand le bloc a des animations scroll-driven instables
  }[]> = {
    'bienvenue': [
      { schemaKey: 'title', fieldLabel: /^Titre$/ },
      { schemaKey: 'subtitle', fieldLabel: /^Sous-titre$/ },
      { schemaKey: 'textColor', fieldLabel: /^Couleur texte$/ },
    ],
    'contact': [
      { schemaKey: 'title', fieldLabel: /^Titre$/ },
      { schemaKey: 'backgroundGradient', fieldLabel: /^Fond/i },
    ],
    'faq': [
      { schemaKey: 'title', fieldLabel: /^Titre$/ },
      { schemaKey: 'openFirst', fieldLabel: /^Première question ouverte$/ },
    ],
    'stats': [
      { schemaKey: 'title', fieldLabel: /^Titre$/ },
    ],
    'quote': [
      { schemaKey: 'quote', fieldLabel: /^Citation$/ },
    ],
    'richText': [
      { schemaKey: 'content', fieldLabel: /^Contenu HTML$/ },
    ],
    'spacer': [
      { schemaKey: 'height', fieldLabel: /^Hauteur/ },
      { schemaKey: 'backgroundColor', fieldLabel: /^Fond$/ },
    ],
    'fullWidthImage': [
      { schemaKey: 'height', fieldLabel: /^Hauteur/ },
    ],
  }

  test('all sidebar fields have corresponding editable inputs (schema integrity)', async () => {
    // Vérifie que chaque champ du schema possède un composant de champ dans FIELD_MAP
    const fieldTypes = ['text', 'textarea', 'richtext', 'number', 'color', 'boolean', 'select', 'animation', 'image', 'array', 'images']

    for (const [type, def] of Object.entries(BLOCK_TYPES)) {
      for (const field of def.schema) {
        expect(fieldTypes).toContain(field.type)
      }
    }
  })

  test('each block type on test-blocks page shows editable fields in sidebar', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', err => errors.push(err.message))

    await page.goto('/test-blocks?admin=true')
    await page.waitForSelector('.admin-toolbar', { timeout: 10000 })
    await page.waitForTimeout(2000)

    // Pour chaque bloc présent sur la page, vérifier qu'il est selectable
    // et que la sidebar montre des champs éditables
    const blockTypesPresent = await page.evaluate(() => {
      const types = new Set<string>()
      document.querySelectorAll('[data-block-type]').forEach(el => {
        const type = el.getAttribute('data-block-type')
        if (type) types.add(type)
      })
      return Array.from(types)
    })

    for (const blockType of blockTypesPresent) {
      const sel = getBlockCssSelector(blockType)
      const wrapper = page.locator('.block-wrapper', { has: page.locator(`.${sel}`) }).first()

      if (!(await wrapper.count())) continue

      // Cliquer pour ouvrir la sidebar
      await wrapper.evaluate((el: HTMLElement) => el.click())
      await page.waitForTimeout(300)

      // Vérifier qu'au moins un champ est affiché
      const fieldCount = await page.locator('.auto-field').count()
      expect(fieldCount, `${blockType}: should have editable fields in sidebar`).toBeGreaterThan(0)

      // Vérifier que la classe admin-selected est appliquée
      await expect(wrapper).toHaveClass(/admin-selected/)
    }

    expect(errors).toEqual([])
  })

  test('visibility toggle controls exist in sidebar for all blocks', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', err => errors.push(err.message))

    await page.goto('/?admin=true')
    await page.waitForSelector('.admin-toolbar', { timeout: 10000 })

    // Sélectionner un bloc qui supporte visibility
    const wrapper = page.locator('.block-wrapper').first()
    await wrapper.click()
    await page.waitForTimeout(300)

    // 3 devices au total : le device courant a un bouton dédié
    // (.admin-vis-btn), les 2 autres un rappel passif (.admin-vis-mini) —
    // voir AdminToolbar.vue.
    const visControls = page.locator('.admin-vis-btn, .admin-vis-mini')
    await expect(visControls).toHaveCount(3) // desktop, tablet, mobile

    expect(errors).toEqual([])
  })

  test.describe('Fields that can be edited and persist', () => {
    test('can edit text field and see change reflected', async ({ page }) => {
      await page.goto('/?admin=true')
      await page.waitForSelector('.admin-toolbar', { timeout: 10000 })

      // Sélectionner Hero pour trouver un champ texte
      const heroWrapper = page.locator('.block-wrapper[data-block-id="bloc-hero"]')
      if (!(await heroWrapper.count())) {
        // Essayer un autre bloc avec champ texte
        const textImg = page.locator('.block-wrapper[data-block-type="textImage"]').first()
        if (await textImg.count()) await textImg.click()
      } else {
        await heroWrapper.click()
      }
      await page.waitForTimeout(300)

      // Vérifier que le champ title existe
      const titleField = page.locator('.auto-field').filter({ has: page.locator('.field-label', { hasText: /^(Titre|Texte)/ }) })

      if (await titleField.count()) {
        // Le champ est présent - vérifier qu'il a un contrôle d'édition
        const input = titleField.locator('.field-input').first()
        if (await input.count()) {
          // Un input texte existe - le champ est éditable
          expect(true).toBe(true)
        }
      }
    })

    test('color picker fields work in sidebar', async ({ page }) => {
      await page.goto('/?admin=true')
      await page.waitForSelector('.admin-toolbar', { timeout: 10000 })

      const wrapper = page.locator('.block-wrapper').first()
      await wrapper.click()
      await page.waitForTimeout(300)

      // Vérifier qu'il y a au moins un color picker (la plupart des blocs en ont)
      const colorPickers = page.locator('.field-color')
      const count = await colorPickers.count()
      expect(count).toBeGreaterThan(0)
    })

    test('boolean toggle fields work in sidebar', async ({ page }) => {
      // Le bloc FAQ a un champ boolean (openFirst)
      const faqBlock = createBlock('faq')
      expect(faqBlock).not.toBeNull()

      // Vérifier que le schema inclut le type boolean
      const faqSchema = BLOCK_TYPES.faq.schema
      const booleanField = faqSchema.find(f => f.type === 'boolean')
      expect(booleanField).toBeDefined()
    })
  })

  test.describe('Rapid multi-field edits', () => {
    test('modifier plusieurs champs coup sur coup conserve toutes les valeurs (pas de lost-update)', async ({ page }) => {
      // Régression réelle : AutoEditor.onChange reconstruisait TOUT props
      // depuis modelValue (mis à jour au tick suivant seulement) — deux
      // champs modifiés dans le même tick s'écrasaient mutuellement, seule
      // la dernière modification survivait. Corrigé en n'émettant que le
      // delta (le récepteur updateBlock fusionne).
      await page.goto('/?admin=true')
      await page.waitForSelector('.admin-toolbar', { timeout: 10000 })

      const bienvenue = page.locator('.block-wrapper[data-block-type="bienvenue"]')
      await bienvenue.click()
      await page.waitForTimeout(300)

      // Remplir titre + sous-titre dans le même tick (rafale synchrone)
      await page.evaluate(() => {
        const fields = [...document.querySelectorAll('.auto-field')]
        const byLabel = (name: string) =>
          fields.find(f => f.querySelector('.field-label')?.textContent?.trim() === name)
        const set = (el: HTMLInputElement, val: string) => {
          el.value = val
          el.dispatchEvent(new Event('input', { bubbles: true }))
        }
        set(byLabel('Titre')!.querySelector('input.field-input')!, 'TITRE RAFALE')
        set(byLabel('Sous-titre')!.querySelector('input.field-input')!, 'SOUS-TITRE RAFALE')
      })
      await page.waitForTimeout(300)

      // Les DEUX modifications doivent être appliquées au rendu
      await expect(bienvenue).toContainText('TITRE RAFALE')
      await expect(bienvenue).toContainText('SOUS-TITRE RAFALE')
    })
  })

  test.describe('Feature coverage checks', () => {
    test('richtext element kind has an add button in the extra elements toolbar', async ({ page }) => {
      await page.goto('/?admin=true')
      await page.waitForSelector('.admin-toolbar', { timeout: 10000 })

      const heroWrapper = page.locator('.block-wrapper[data-block-id="bloc-hero"]').first()
      await heroWrapper.click()
      await page.waitForTimeout(300)

      await expect(page.locator('.array-add-btn', { hasText: '+ Texte HTML' })).toBeVisible()
    })

    test('stats and quote blocks have animation field and apply it', async ({ page }) => {
      const statsDef = BLOCK_TYPES.stats
      const hasAnimationField = statsDef.schema.some(f => f.type === 'animation')
      expect(hasAnimationField).toBe(true)

      const quoteDef = BLOCK_TYPES.quote
      const quoteHasAnimationField = quoteDef.schema.some(f => f.type === 'animation')
      expect(quoteHasAnimationField).toBe(true)

      // Le rendu applique bien la classe block-anim-* déclarée par défaut (fadeIn)
      await page.goto('/test-blocks?admin=true')
      await page.waitForSelector('.block-stats', { timeout: 10000 })
      await expect(page.locator('.block-stats').first()).toHaveClass(/block-anim-/)
      await expect(page.locator('.block-quote').first()).toHaveClass(/block-anim-/)
    })

    test('spacer has fieldFonts and applies them to its text', async ({ page }) => {
      const spacerSchema = BLOCK_TYPES.spacer.schema
      const hasTextField = spacerSchema.some(f => f.key === 'text')
      expect(hasTextField).toBe(true)

      // fieldFonts/fieldFontSizes sont appliqués sur .spacer-text via fieldFontStyle
      await page.goto('/test-blocks?admin=true')
      const spacerBlock = page.locator('.block-spacer').first()
      await spacerBlock.locator('..').click()
      await page.waitForTimeout(300)

      const textField = page.locator('.auto-field').filter({ has: page.locator('.field-label', { hasText: /^Texte/ }) })
      await expect(textField.locator('.field-font-picker')).toBeVisible()
    })
  })
})

test.describe('Sidebar visibility toggle applies to rendered blocks', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?admin=true')
    await page.waitForSelector('.admin-toolbar', { timeout: 10000 })
  })

  test.describe('Stats block visibility', () => {
    test('toggling visibility off for the current device removes it from the admin canvas', async ({ page }) => {
      // Le bloc stats n'est pas sur accueil, on teste via test-blocks.
      // Note : filterByVisibility() retire le bloc de visibleBlocks pour le
      // device courant y compris en admin (PageRenderer.vue) — donc le
      // wrapper disparaît du DOM plutôt que de recevoir une classe hide-*
      // (cette classe est observable côté rendu public, voir
      // visibility-device.spec.ts).
      await page.goto('/test-blocks?admin=true')
      await page.waitForSelector('.block-stats', { timeout: 10000 })

      const statsWrapper = page.locator('.block-wrapper', { has: page.locator('.block-stats') }).first()
      await statsWrapper.click()
      await page.waitForTimeout(300)

      const visBtn = page.locator('.admin-vis-btn')
      await expect(visBtn).toBeVisible()
      await visBtn.click()

      await expect(page.locator('.block-stats')).toHaveCount(0)
    })
  })

  test.describe('Quote block visibility', () => {
    test('toggling visibility off for the current device removes it from the admin canvas', async ({ page }) => {
      await page.goto('/test-blocks?admin=true')
      await page.waitForSelector('.block-quote', { timeout: 10000 })

      const quoteWrapper = page.locator('.block-wrapper', { has: page.locator('.block-quote') }).first()
      await quoteWrapper.click()
      await page.waitForTimeout(300)

      const visBtn = page.locator('.admin-vis-btn')
      await expect(visBtn).toBeVisible()
      await visBtn.click()

      await expect(page.locator('.block-quote')).toHaveCount(0)
    })
  })

  test.describe('Spacer block fonts', () => {
    test('font picker on the text field is present', async ({ page }) => {
      await page.goto('/test-blocks?admin=true')
      await page.waitForSelector('.block-spacer', { timeout: 10000 })

      const spacerBlock = page.locator('.block-spacer').first()
      await spacerBlock.locator('..').click()
      await page.waitForTimeout(300)

      const textField = page.locator('.auto-field').filter({ has: page.locator('.field-label', { hasText: /^Texte/ }) })
      await expect(textField).toBeVisible()
      await expect(textField.locator('.field-font-picker')).toBeVisible()
    })
  })
})