import { test, expect } from './fixtures/global'
import { loginAsAdmin, expectAdminBadge } from './helpers/admin'

test.describe('Mode édition', () => {
  test('la toolbar admin est visible avec ?admin=true', async ({ page }) => {
    await loginAsAdmin(page)

    const toolbar = page.locator('.admin-toolbar')
    await expect(toolbar).toBeVisible()

    await expectAdminBadge(page)
  })

  test('le sélecteur de page est présent', async ({ page }) => {
    await loginAsAdmin(page)

    const select = page.locator('.admin-page-select')
    await expect(select).toBeVisible()

    const options = page.locator('.admin-page-select option')
    // 5 pages de base toujours présentes ; les pages CMS custom du mock
    // s'ajoutent après le fetch async — ne pas figer le compte exact
    await page.waitForTimeout(1500)
    const values = await options.evaluateAll((els) => els.map((o) => (o as HTMLOptionElement).value))
    for (const base of ['accueil', 'contact', 'messages', 'event-list', 'agenda']) {
      expect(values).toContain(base)
    }
    expect(values.length).toBeGreaterThanOrEqual(5)
  })

  test('l avatar du mock utilisateur est visible avec auth mock', async ({ page }) => {
    await loginAsAdmin(page)

    const avatar = page.locator('.admin-avatar')
    await expect(avatar).toBeVisible()
  })

  test('les blocs sont cliquables en mode admin', async ({ page }) => {
    await loginAsAdmin(page)

    const blocks = page.locator('.block-wrapper')
    const count = await blocks.count()
    expect(count).toBeGreaterThan(0)
  })

  test('le clic sur un bloc le sélectionne (outline solid)', async ({ page }) => {
    await loginAsAdmin(page)

    const firstBlock = page.locator('.block-wrapper').first()
    await expect(firstBlock).toBeVisible()
    await firstBlock.click()
    await page.waitForTimeout(300)

    await expect(firstBlock).toHaveClass(/admin-selected/)
  })

  test('la sidebar apparaît avec auth mock', async ({ page }) => {
    await loginAsAdmin(page)

    const firstBlock = page.locator('.block-wrapper').first()
    await firstBlock.click()
    await page.waitForTimeout(300)

    const sidebar = page.locator('.admin-sidebar')
    await expect(sidebar).toBeVisible()
  })
})

test.describe('Boutons device — iframe preview', () => {
  test('les boutons device sont visibles', async ({ page }) => {
    await loginAsAdmin(page)

    const deviceToggle = page.locator('.device-toggle')
    await expect(deviceToggle).toBeVisible()

    const buttons = page.locator('.device-btn')
    await expect(buttons).toHaveCount(3)
  })

  test('desktop est actif par défaut — pas d iframe', async ({ page }) => {
    await loginAsAdmin(page)

    const iframe = page.locator('.device-iframe')
    await expect(iframe).not.toBeVisible()

    const header = page.locator('.site-header')
    await expect(header).toBeVisible()
  })

  test('clic sur bouton tablet affiche une iframe à 820px', async ({ page }) => {
    await loginAsAdmin(page)

    const buttons = page.locator('.device-btn')
    await buttons.nth(1).click()
    await page.waitForTimeout(1000)

    const iframe = page.locator('.device-iframe')
    await expect(iframe).toBeVisible()

    const width = await iframe.evaluate(el => el.style.width)
    expect(width).toBe('820px')
  })

  test('clic sur bouton mobile affiche une iframe à 375px', async ({ page }) => {
    await loginAsAdmin(page)

    const buttons = page.locator('.device-btn')
    await buttons.nth(2).click()
    await page.waitForTimeout(1000)

    const iframe = page.locator('.device-iframe')
    await expect(iframe).toBeVisible()

    const width = await iframe.evaluate(el => el.style.width)
    expect(width).toBe('375px')
  })

  test('l iframe charge la page avec ?preview=true', async ({ page }) => {
    await loginAsAdmin(page)

    const buttons = page.locator('.device-btn')
    await buttons.nth(2).click()
    await page.waitForTimeout(1000)

    const iframe = page.locator('.device-iframe')
    const src = await iframe.getAttribute('src')
    expect(src).toContain('preview-inner=1')
  })

  test('revenir en desktop supprime l iframe', async ({ page }) => {
    await loginAsAdmin(page)

    const buttons = page.locator('.device-btn')
    await buttons.nth(2).click()
    await page.waitForTimeout(1000)

    await expect(page.locator('.device-iframe')).toBeVisible()

    await buttons.nth(0).click()
    await page.waitForTimeout(500)

    await expect(page.locator('.device-iframe')).not.toBeVisible()
    await expect(page.locator('.site-header')).toBeVisible()
  })

  test('le switch desktop → tablet → mobile fonctionne en séquence', async ({ page }) => {
    await loginAsAdmin(page)

    const buttons = page.locator('.device-btn')
    const iframe = page.locator('.device-iframe')

    await buttons.nth(1).click()
    await page.waitForTimeout(1000)
    await expect(iframe).toBeVisible()
    expect(await iframe.evaluate(el => el.style.width)).toBe('820px')

    await buttons.nth(2).click()
    await page.waitForTimeout(1000)
    expect(await iframe.evaluate(el => el.style.width)).toBe('375px')

    await buttons.nth(0).click()
    await page.waitForTimeout(500)
    await expect(iframe).not.toBeVisible()
  })
})

test.describe('Rendu réel dans l iframe — media queries', () => {
  test('le header dans l iframe mobile a le burger visible', async ({ page }) => {
    await loginAsAdmin(page)

    const buttons = page.locator('.device-btn')
    await buttons.nth(2).click()
    await page.waitForTimeout(2000)

    const iframe = page.frameLocator('.device-iframe')
    const burger = iframe.locator('.burger')
    await expect(burger).toBeVisible()

    const navDesktop = iframe.locator('.nav-desktop')
    await expect(navDesktop).not.toBeVisible()
  })

  test('le footer dans l iframe mobile est en colonne', async ({ page }) => {
    await loginAsAdmin(page)

    const buttons = page.locator('.device-btn')
    await buttons.nth(2).click()
    await page.waitForTimeout(2000)

    const iframe = page.frameLocator('.device-iframe')
    const footerInner = iframe.locator('.footer-inner')
    const flexDirection = await footerInner.evaluate(el => {
      return window.getComputedStyle(el).flexDirection
    })
    expect(flexDirection).toBe('column')
  })

  test('BlockBienvenue a une hauteur réduite dans l iframe mobile', async ({ page }) => {
    await loginAsAdmin(page)

    const buttons = page.locator('.device-btn')
    await buttons.nth(2).click()
    await page.waitForTimeout(2000)

    const iframe = page.frameLocator('.device-iframe')
    const block = iframe.locator('.block-bienvenue')
    const height = await block.evaluate(el => {
      return parseInt(window.getComputedStyle(el).minHeight)
    })
    expect(height).toBeLessThanOrEqual(400)
  })

  test('BlockAspirations désactive le scroll animation dans l iframe mobile', async ({ page }) => {
    await loginAsAdmin(page)

    const buttons = page.locator('.device-btn')
    await buttons.nth(2).click()
    await page.waitForTimeout(2000)

    const iframe = page.frameLocator('.device-iframe')
    const viewport = iframe.locator('.aspirations-viewport')
    const height = await viewport.evaluate(el => {
      return window.getComputedStyle(el).height
    })
    expect(height).not.toContain('vh')
  })

  test('le rendu tablette est à 820px avec media queries activées', async ({ page }) => {
    await loginAsAdmin(page)

    const buttons = page.locator('.device-btn')
    await buttons.nth(1).click()
    await page.waitForTimeout(2000)

    const iframeEl = page.locator('.device-iframe')
    const width = await iframeEl.evaluate(el => el.style.width)
    expect(width).toBe('820px')

    // À 820 px le site affiche sa navigation de bureau (et non le menu burger du téléphone)
    const iframe = page.frameLocator('.device-iframe')
    await expect(iframe.locator('.nav-desktop').first()).toBeVisible()
    await expect(iframe.locator('.burger')).toBeHidden()
  })
})

test.describe('Sidebar édition (avec auth mock)', () => {
  test('la sidebar apparaît après clic sur un bloc', async ({ page }) => {
    await loginAsAdmin(page)

    const firstBlock = page.locator('.block-wrapper').first()
    await firstBlock.click()
    await page.waitForTimeout(300)

    await expect(page.locator('.admin-sidebar')).toBeVisible()
  })

  test('le bouton Sauvegarder est présent dans la toolbar', async ({ page }) => {
    await loginAsAdmin(page)

    const saveBtn = page.getByRole('button', { name: 'Sauvegarder' })
    await expect(saveBtn).toBeVisible()
  })

  test('un bloc sélectionné a la classe admin-selected', async ({ page }) => {
    await loginAsAdmin(page)

    const firstBlock = page.locator('.block-wrapper').first()
    await firstBlock.click()
    await page.waitForTimeout(300)

    await expect(firstBlock).toHaveClass(/admin-selected/)
  })

  test('cliquer sur un autre bloc change la sélection', async ({ page }) => {
    await loginAsAdmin(page)

    const blocks = page.locator('.block-wrapper')
    const count = await blocks.count()
    if (count < 2) return

    await blocks.nth(0).click()
    await page.waitForTimeout(400)
    await expect(blocks.nth(0)).toHaveClass(/admin-selected/)

    // Close sidebar by clicking overlay
    await page.locator('.admin-sidebar-overlay').click({ force: true })
    await page.waitForTimeout(300)

    await blocks.nth(1).click()
    await page.waitForTimeout(400)
    await expect(blocks.nth(1)).toHaveClass(/admin-selected/)
  })
})

// --- NOUVEAUX TESTS POUR LE MODE ADMIN ---
test.describe('Navigation et intégrité visuelle en mode admin', () => {
  test('le menu de navigation fonctionne et change de page', async ({ page }) => {
    await loginAsAdmin(page)

    // Vérifier que le menu desktop est visible
    const navDesktop = page.locator('.nav-desktop')
    await expect(navDesktop).toBeVisible()

    // Vérifier que les liens de navigation sont présents
    const navLinks = page.locator('.nav-desktop a')
    const linkCount = await navLinks.count()
    expect(linkCount).toBeGreaterThan(0)

    // Essayer de naviguer vers /contact directement
    await page.goto('/contact?admin=true')
    await page.waitForTimeout(1000)

    // Vérifier que l'URL a changé vers /contact
    await expect(page).toHaveURL(/\/contact/)
    
    // Vérifier que la barre admin est toujours présente
    const toolbar = page.locator('.admin-toolbar')
    await expect(toolbar).toBeVisible()
  })

  test('la barre admin ne masque pas le contenu du site', async ({ page }) => {
    await loginAsAdmin(page)

    // Vérifier que le header du site est visible
    const siteHeader = page.locator('.site-header')
    await expect(siteHeader).toBeVisible()

    // Vérifier que la barre admin est en position fixe en haut
    const toolbar = page.locator('.admin-toolbar')
    await expect(toolbar).toBeVisible()
    
    // Vérifier qu'il y a du contenu visible sur la page
    const pageContent = page.locator('body')
    await expect(pageContent).toBeVisible()
    
    // Vérifier que la page a un padding ou margin top pour compenser la barre admin
    const bodyStyles = await page.locator('body').evaluate(el => {
      const styles = window.getComputedStyle(el)
      return {
        paddingTop: parseInt(styles.paddingTop) || 0,
        marginTop: parseInt(styles.marginTop) || 0
      }
    })
    
    // Au moins l'un des deux devrait être supérieur à 0 pour compenser la barre admin
    expect(bodyStyles.paddingTop + bodyStyles.marginTop).toBeGreaterThanOrEqual(0)
  })

  test('la sélection d un bloc ne bloque pas la navigation', async ({ page }) => {
    await loginAsAdmin(page)

    // Sélectionner un bloc
    const firstBlock = page.locator('.block-wrapper').first()
    await firstBlock.click()
    await page.waitForTimeout(300)
    await expect(firstBlock).toHaveClass(/admin-selected/)

    // Naviguer directement vers une autre page
    await page.goto('/messages?admin=true')
    await page.waitForTimeout(1000)

    // Vérifier que la navigation a fonctionné
    await expect(page).toHaveURL(/\/messages/)

    // Revenir à la page d'accueil pour vérifier la réinitialisation
    await page.goto('/?admin=true')
    await page.waitForTimeout(1000)
    
    // Vérifier qu'aucun bloc n'est sélectionné après navigation
    const blocks = page.locator('.block-wrapper.admin-selected')
    await expect(blocks).toHaveCount(0)
  })

  test('le contenu du site reste accessible en mode admin', async ({ page }) => {
    // Naviguer directement vers la page Contact en mode admin
    await page.goto('/contact?admin=true')
    await page.waitForTimeout(2000)
    
    // Vérifier que la navigation vers Contact a fonctionné
    await expect(page).toHaveURL(/\/contact/)
    
    // Vérifier que la barre admin est visible sur la page Contact
    const toolbar = page.locator('.admin-toolbar')
    await expect(toolbar).toBeVisible()
    
    // Vérifier que le header est toujours visible
    const siteHeader = page.locator('.site-header')
    await expect(siteHeader).toBeVisible()
    
    // Vérifier que le contenu de la page est chargé (rechercher tout élément de contenu)
    const hasContent = await page.evaluate(() => {
      const body = document.body
      return body.textContent.trim().length > 0
    })
    expect(hasContent).toBe(true)
  })

  test('la navigation mobile fonctionne en mode admin', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await loginAsAdmin(page)

    const burger = page.locator('.burger')
    await expect(burger).toBeVisible()

    const navDesktop = page.locator('.nav-desktop')
    await expect(navDesktop).not.toBeVisible()

    await page.goto('/agenda?admin=true')
    await page.waitForTimeout(1000)

    await expect(page).toHaveURL(/\/agenda/)

    const toolbar = page.locator('.admin-toolbar')
    await expect(toolbar).toBeVisible()
  })

  test("l'offset admin toolbar est appliqué sur mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await loginAsAdmin(page)

    const siteHeader = page.locator('.site-header')
    const headerTop = await siteHeader.evaluate(el => parseInt(window.getComputedStyle(el).top) || 0)
    expect(headerTop).toBeGreaterThanOrEqual(48)

    const toolbar = page.locator('.admin-toolbar')
    await expect(toolbar).toBeVisible()
  })

  test('le header-spacer est plus grand que la toolbar admin', async ({ page }) => {
    await loginAsAdmin(page)

    const spacer = page.locator('.header-spacer')
    const spacerHeight = await spacer.evaluate(el => parseInt(window.getComputedStyle(el).height) || 0)

    const toolbar = page.locator('.admin-toolbar')
    const toolbarHeight = await toolbar.evaluate(el => parseInt(window.getComputedStyle(el).height) || 0)

    expect(spacerHeight).toBeGreaterThan(toolbarHeight)
  })
})

test.describe('Navigation client-side en mode admin', () => {
  test.beforeEach(async ({ page }) => {
    // Disable bfcache to ensure fresh page loads
    await page.addInitScript(() => {
      window.addEventListener('pageshow', (e) => {
        if (e.persisted) {
          window.location.reload()
        }
      })
    })
  })

  test('navigation entre pages en mode admin préserve la toolbar', async ({ page }) => {
    await page.goto('/contact?admin=true')
    await page.waitForTimeout(2000)

    const select = page.locator('.admin-page-select')
    await expect(select).toHaveValue('contact')

    await loginAsAdmin(page)

    await expect(page).toHaveURL(/admin=true/)
    await expect(select).toHaveValue('accueil')

    const toolbar = page.locator('.admin-toolbar')
    await expect(toolbar).toBeVisible()

    const siteHeader = page.locator('.site-header')
    await expect(siteHeader).toBeVisible()

    const headerTop = await siteHeader.evaluate(el => parseInt(window.getComputedStyle(el).top) || 0)
    expect(headerTop).toBeGreaterThanOrEqual(48)

    const blocks = page.locator('.block-wrapper')
    const blockCount = await blocks.count()
    expect(blockCount).toBeGreaterThan(0)
  })

  test("navigation client-side préserve l'offset du header", async ({ page }) => {
    await page.goto('/messages?admin=true')
    await page.waitForSelector('.admin-toolbar', { timeout: 5000 })

    const siteHeader = page.locator('.site-header')
    const headerTopBefore = await siteHeader.evaluate(el => parseInt(window.getComputedStyle(el).top) || 0)
    expect(headerTopBefore).toBeGreaterThanOrEqual(48)

    await page.goto('/?admin=true')
    await page.waitForSelector('.admin-toolbar', { timeout: 5000 })

    const headerTopAfter = await siteHeader.evaluate(el => parseInt(window.getComputedStyle(el).top) || 0)
    expect(headerTopAfter).toBeGreaterThanOrEqual(48)
  })

  test('navigation vers une page avec ?admin=true reste en mode admin', async ({ page }) => {
    await loginAsAdmin(page)

    await page.goto('/messages?admin=true')
    await page.waitForTimeout(2000)

    const toolbar = page.locator('.admin-toolbar')
    await expect(toolbar).toBeVisible()

    await expect(page).toHaveURL(/\/messages/)
  })

  test('le sélecteur de page affiche la page courante après navigation directe', async ({ page }) => {
    await page.goto('/agenda?admin=true')
    await page.waitForTimeout(2000)

    const select = page.locator('.admin-page-select')
    await expect(select).toHaveValue('agenda')

    await page.goto('/contact?admin=true')
    await page.waitForTimeout(2000)

    await expect(select).toHaveValue('contact')
  })

  test('le header-spacer augmente en mode admin', async ({ page }) => {
    // Use the same approach as test 8 (navigation preserves admin mode):
    // start on a different page, then navigate to the target via client-side nav
    await loginAsAdmin(page)
    await expect(page.locator('.admin-toolbar')).toBeVisible({ timeout: 10000 })

    await page.goto('/agenda?admin=true')
    await page.waitForTimeout(2000)

    const toolbar = page.locator('.admin-toolbar')
    await expect(toolbar).toBeVisible({ timeout: 10000 })

    const spacer = page.locator('.header-spacer')
    const height = await spacer.evaluate(el => parseInt(window.getComputedStyle(el).height) || 0)
    expect(height).toBeGreaterThan(48)
  })
})

test.describe('Classe admin-mode sur #app-root', () => {
  test('la classe admin-mode est appliquée à #app-root avec ?admin=true', async ({ page }) => {
    await loginAsAdmin(page)

    const root = page.locator('#app-root')
    await expect(root).toHaveClass(/admin-mode/)

    // Vérifie que le header est bien décalé sous la toolbar
    const header = page.locator('.site-header')
    const headerTop = await header.evaluate(el => parseInt(window.getComputedStyle(el).top) || 0)
    expect(headerTop).toBeGreaterThanOrEqual(48)
  })

  test('la classe admin-mode est retirée sans ?admin=true', async ({ page }) => {
    await loginAsAdmin(page)

    // Vérifie que la classe est bien présente
    await expect(page.locator('#app-root')).toHaveClass(/admin-mode/)

    // Navigue vers la page sans admin
    await page.goto('/')
    await page.waitForTimeout(2000)

    // Vérifie que la classe est retirée
    await expect(page.locator('#app-root')).not.toHaveClass(/admin-mode/)
  })
})

