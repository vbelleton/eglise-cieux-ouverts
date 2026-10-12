import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './helpers/admin'
import { resetMock } from './helpers/reset'

/**
 * « Si on change en mobile, ça change vraiment que pour mobile » :
 * on modifie le titre du bloc Bienvenue en mode Mobile, on sauvegarde, puis on
 * vérifie (1) ce qui est stocké, (2) le rendu public à chaque largeur.
 */
test.beforeEach(async ({ request }) => { await resetMock(request) })
test.afterEach(async ({ request }) => { await resetMock(request) })

const NOUVEAU = 'Titre uniquement mobile'
const NOUVEAU_COMPACT = NOUVEAU.replace(/\s+/g, '')

async function titreDeBienvenue(page: any) {
  const bloc = page.locator('.block-wrapper[data-block-type="bienvenue"]').first()
  // Le titre est animé lettre par lettre : on compare sans espaces.
  return (await bloc.innerText()).replace(/\s+/g, '')
}

for (const [appareil, bouton, largeur] of [['mobile', 2, 390], ['tablet', 1, 800]] as const) {
  test(`une modification en mode ${appareil} ne touche que ${appareil}`, async ({ page, request }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    const avant = await (await request.get('/api/pages/accueil')).json()
    const bienvenueAvant = (avant.blocks || []).find((b: any) => b.type === 'bienvenue')

    await loginAsAdmin(page)
    await page.locator('.device-btn').nth(bouton).click()
    const cadre = page.frameLocator('.device-iframe')
    // Le bloc peut être momentanément invisible pendant le chargement de
    // l'aperçu (animation d'entrée) : on envoie le clic directement.
    const blocApercu = cadre.locator('.block-wrapper[data-block-type="bienvenue"]').first()
    await blocApercu.waitFor({ state: 'attached', timeout: 10000 })
    await blocApercu.dispatchEvent('click')

    const sidebar = page.locator('.admin-sidebar')
    await expect(sidebar).toBeVisible({ timeout: 8000 })
    await expect(sidebar).toContainText('Vous modifiez la version')

    const champ = sidebar.locator('.auto-field').filter({ has: page.locator('.field-label', { hasText: /^Titre$/ }) }).locator('.field-input').first()
    await champ.fill(NOUVEAU)
    await page.locator('.admin-btn', { hasText: 'Sauvegarder' }).first().click()
    await expect(page.locator('.admin-save-status')).toBeVisible({ timeout: 8000 })

    // 1. Stockage : le titre de base est intact, la surcharge est rangée sous l'appareil
    const apres = await (await request.get('/api/pages/accueil')).json()
    const b = (apres.blocks || []).find((x: any) => x.type === 'bienvenue')
    expect(b.props.title).toBe(bienvenueAvant.props.title)
    expect(b.responsive?.[appareil]?.title).toBe(NOUVEAU)
    const autre = appareil === 'mobile' ? 'tablet' : 'mobile'
    expect(b.responsive?.[autre]?.title).toBeUndefined()
    expect(b.responsive?.desktop).toBeUndefined()

    // 2. Rendu public aux trois largeurs
    const pub = await page.context().newPage()
    for (const [l, attendu] of [[1440, false], [largeur, true], [appareil === 'mobile' ? 800 : 390, false]] as const) {
      await pub.setViewportSize({ width: l, height: 900 })
      await pub.goto('/')
      await pub.waitForLoadState('networkidle')
      const texte = await titreDeBienvenue(pub)
      if (attendu) expect(texte).toContain(NOUVEAU_COMPACT)
      else expect(texte).not.toContain(NOUVEAU_COMPACT)
    }
    await pub.close()
  })
}
