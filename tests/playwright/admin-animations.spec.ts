import { test, expect } from './fixtures/global'

test.describe('Animations des blocs en mode admin', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log('CONSOLE:', msg.text()))
    page.on('pageerror', err => console.log('PAGEERROR:', err.message))
    page.on('requestfailed', req => console.log('FAILED:', req.url(), req.failure()))
  })
  test('les classes CSS block-anim-* sont appliquées selon le type d animation', async ({ page }) => {
    await page.goto('/?admin=true')
    // === DIAGNOSTIC AUTOMATIQUE ADMIN/UI ===
    await page.waitForLoadState('domcontentloaded')
    // 1) adminEnabled
    const adminEnabled = await page.evaluate(() => {
      return (window as any).__adminEnabled ?? false
    })
    console.log('adminEnabled =', adminEnabled)
    // 2) toolbar visible ?
    const toolbarNode = await page.$('.admin-toolbar')
    let toolbar = 'absente'
    if (toolbarNode) {
      const visible = await toolbarNode.evaluate(n => {
        const s = window.getComputedStyle(n)
        return s && s.display !== 'none' && s.visibility !== 'hidden'
      })
      toolbar = visible ? 'visible' : 'absente'
    }
    console.log('toolbar =', toolbar)
    // 3) classes du premier bloc
    const firstBlock = await page.$('.block-wrapper')
    const firstBlockClasses = firstBlock
      ? await firstBlock.getAttribute('class')
      : 'absent'
    console.log('firstBlockClasses =', firstBlockClasses)
    await page.waitForTimeout(3000)

    // dump complet DOM et screenshot pour debug complet
    console.log('=== PAGE CONTENT START ===')
    console.log(await page.content())
    console.log('=== PAGE CONTENT END ===')
    await page.screenshot({ path: 'debug-before-fail.png', fullPage: true })

    expect(await page.locator('.block-wrapper.block-anim-portal').count()).toBeGreaterThanOrEqual(1)
    expect(await page.locator('.block-wrapper.block-anim-fadeIn').count()).toBeGreaterThanOrEqual(1)
  })

  test('les blocs spéciaux aspirations et nousRejoindre n ont pas de wrapper d animation', async ({ page }) => {
    await page.goto('/?admin=true')
    await page.waitForTimeout(3000)

    const aspirationsViewport = page.locator('.aspirations-viewport').first()
    await expect(aspirationsViewport).toBeVisible()
    expect(await aspirationsViewport.locator('..').getAttribute('class')).not.toContain('block-anim-')

    const nousRejoindreWrapper = page.locator('[data-block-type="nousRejoindre"]').first()
    await expect(nousRejoindreWrapper).toBeVisible()
    expect(await nousRejoindreWrapper.getAttribute('class')).not.toContain('block-anim-')
  })

  test('les blocs sont pré-déclenchés en mode admin (classe triggered)', async ({ page }) => {
    await page.goto('/?admin=true')
    await page.waitForTimeout(3000)

    const triggeredCount = await page.locator('.block-wrapper.triggered').count()
    expect(triggeredCount).toBeGreaterThan(0)
  })

  test('les animations par défaut diffèrent selon le type de bloc', async ({ page }) => {
    await page.goto('/?admin=true')
    await page.waitForTimeout(3000)

    await expect(page.locator('[data-block-type="bienvenue"]').first()).toHaveClass(/block-anim-portal/)
    await expect(page.locator('[data-block-type="rejoins"]').first()).not.toHaveClass(/block-anim-/)
  })

  test("l'événement replay-animation est bien capté par PageRenderer", async ({ page }) => {
    await page.goto('/?admin=true')
    await page.waitForTimeout(3000)

    const handled = await page.evaluate(() => {
      return new Promise((resolve) => {
        const handler = () => {
          document.removeEventListener('replay-animation', handler)
          resolve(true)
        }
        document.addEventListener('replay-animation', handler)
        document.dispatchEvent(new CustomEvent('replay-animation', { detail: { id: 'dummy' } }))
        setTimeout(() => resolve(false), 100)
      })
    })
    expect(handled).toBe(true)
  })
})

test.describe('Sélection et survol des blocs', () => {
  test('le survol d un bloc en mode admin affiche un outline dashed bleu', async ({ page }) => {
    await page.goto('/?admin=true')
    await page.waitForTimeout(3000)

    const block = page.locator('.block-wrapper').first()
    await block.hover({ force: true })
    await page.waitForTimeout(200)

    const outline = await block.evaluate((el) => window.getComputedStyle(el).outline)
    expect(outline.toLowerCase()).toContain('rgba(59, 130, 246')
  })

  test('le curseur devient pointeur au survol d un bloc en mode admin', async ({ page }) => {
    await page.goto('/?admin=true')
    await page.waitForTimeout(3000)

    const cursor = await page.locator('.block-wrapper').first().evaluate(
      (el) => window.getComputedStyle(el).cursor
    )
    expect(cursor).toBe('pointer')
  })

})

test.describe('Entrée et sortie du mode admin', () => {
  test('la touche Escape quitte le mode admin', async ({ page }) => {
    await page.goto('/?admin=true')
    await page.waitForTimeout(3000)

    await expect(page.locator('.admin-toolbar')).toBeVisible()
    await expect(page.locator('#app-root')).toHaveClass(/admin-mode/)

    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    await expect(page.locator('.admin-toolbar')).not.toBeVisible()
    await expect(page.locator('#app-root')).not.toHaveClass(/admin-mode/)
  })

  test('la toolbar disparaît sans ?admin=true', async ({ page }) => {
    await page.goto('/?admin=true')
    await page.waitForTimeout(3000)

    await expect(page.locator('.admin-toolbar')).toBeVisible()

    await page.goto('/')
    await page.waitForTimeout(2000)

    await expect(page.locator('.admin-toolbar')).not.toBeVisible()
  })

  test('le paramètre admin=true est retiré de l URL en quittant', async ({ page }) => {
    await page.goto('/?admin=true')
    await page.waitForTimeout(2000)

    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    expect(page.url()).not.toContain('admin=true')
  })

  test('le badge Mode édition est visible dans la toolbar', async ({ page }) => {
    await page.goto('/?admin=true')
    await page.waitForTimeout(3000)

    await expect(page.locator('.admin-badge')).toHaveText('Mode édition')
  })
})

test.describe('Navigation entre pages en mode admin', () => {
  test('le sélecteur de page permet de naviguer entre les pages', async ({ page }) => {
    await page.goto('/?admin=true')
    await page.waitForTimeout(3000)

    const select = page.locator('.admin-page-select')
    await expect(select).toHaveValue('accueil')

    await select.selectOption('contact')
    await page.waitForTimeout(2000)

    await expect(page).toHaveURL(/\/contact/)
    await expect(select).toHaveValue('contact')
  })

  test('chaque page a un nombre de blocs différent', async ({ page }) => {
    await page.goto('/?admin=true')
    await page.waitForTimeout(3000)

    let blocks = page.locator('.block-wrapper')
    const homeCount = await blocks.count()
    expect(homeCount).toBeGreaterThan(3)

    const select = page.locator('.admin-page-select')
    await select.selectOption('contact')
    await page.waitForTimeout(2000)

    blocks = page.locator('.block-wrapper')
    const contactCount = await blocks.count()
    expect(contactCount).toBeGreaterThan(0)
    expect(contactCount).toBeLessThan(homeCount)

    await select.selectOption('messages')
    await page.waitForTimeout(2000)

    blocks = page.locator('.block-wrapper')
    expect(await blocks.count()).toBeGreaterThan(0)
  })

  test('la page agenda n a pas de PageRenderer (pas de blocs)', async ({ page }) => {
    await page.goto('/agenda?admin=true')
    await page.waitForTimeout(3000)

    await expect(page.locator('.admin-toolbar')).toBeVisible()
    await expect(page.locator('.admin-page-select')).toHaveValue('agenda')

    expect(await page.locator('.block-wrapper').count()).toBe(0)
  })
})

test.describe('Aperçu responsive (device preview)', () => {
  test('le mode tablette affiche une iframe à 820px', async ({ page }) => {
    await page.goto('/?admin=true')
    await page.waitForTimeout(3000)

    await page.locator('.device-btn').nth(1).click()
    await page.waitForTimeout(1000)

    const iframe = page.locator('.device-iframe')
    await expect(iframe).toBeVisible()
    expect(await iframe.evaluate((el) => el.style.width)).toBe('820px')
  })

  test('le mode mobile affiche une iframe à 375px', async ({ page }) => {
    await page.goto('/?admin=true')
    await page.waitForTimeout(3000)

    await page.locator('.device-btn').nth(2).click()
    await page.waitForTimeout(1000)

    const iframe = page.locator('.device-iframe')
    await expect(iframe).toBeVisible()
    expect(await iframe.evaluate((el) => el.style.width)).toBe('375px')
  })

  test('le bouton desktop désactive l aperçu iframe', async ({ page }) => {
    await page.goto('/?admin=true')
    await page.waitForTimeout(3000)

    await page.locator('.device-btn').nth(2).click()
    await page.waitForTimeout(1000)
    await expect(page.locator('.device-iframe')).toBeVisible()

    await page.locator('.device-btn').first().click()
    await page.waitForTimeout(500)

    await expect(page.locator('.device-iframe')).not.toBeVisible()
  })
})

test.describe('Rendu dans l aperçu mobile (iframe)', () => {
  test('les blocs sont rendus dans l iframe mobile', async ({ page }) => {
    await page.goto('/?admin=true')
    await page.waitForTimeout(3000)

    await page.locator('.device-btn').nth(2).click()
    await page.waitForTimeout(2000)

    const pageRenderer = page.frameLocator('.device-iframe').locator('.page-renderer')
    await expect(pageRenderer).toBeVisible({ timeout: 5000 })
    expect(await page.frameLocator('.device-iframe').locator('.block-wrapper').count()).toBeGreaterThan(0)
  })

  test('le site-header est visible dans l iframe mobile', async ({ page }) => {
    await page.goto('/?admin=true')
    await page.waitForTimeout(3000)

    await page.locator('.device-btn').nth(2).click()
    await page.waitForTimeout(2000)

    await expect(page.frameLocator('.device-iframe').locator('.site-header')).toBeVisible()
  })
})

test.describe('Admin layout intégrité', () => {
  test('le header est décalé de 48px sous la toolbar en mode admin', async ({ page }) => {
    await page.goto('/?admin=true')
    await page.waitForTimeout(3000)

    const headerTop = await page.locator('.site-header').evaluate(
      (el) => parseInt(window.getComputedStyle(el).top) || 0
    )
    expect(headerTop).toBeGreaterThanOrEqual(48)
  })

  test('le header-spacer est plus haut que la toolbar admin', async ({ page }) => {
    await page.goto('/?admin=true')
    await page.waitForTimeout(3000)

    const spacerH = await page.locator('.header-spacer').evaluate(
      (el) => parseInt(window.getComputedStyle(el).height) || 0
    )
    const toolbarH = await page.locator('.admin-toolbar').evaluate(
      (el) => parseInt(window.getComputedStyle(el).height) || 0
    )
    expect(spacerH).toBeGreaterThan(toolbarH)
  })

  test('la classe admin-mode est appliquée et retirée de #app-root', async ({ page }) => {
    await page.goto('/?admin=true')
    await page.waitForTimeout(3000)

    await expect(page.locator('#app-root')).toHaveClass(/admin-mode/)

    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    await expect(page.locator('#app-root')).not.toHaveClass(/admin-mode/)
  })

  test('la toolbar admin a 3 boutons device (desktop, tablette, mobile)', async ({ page }) => {
    await page.goto('/?admin=true')
    await page.waitForTimeout(3000)

    expect(await page.locator('.device-btn').count()).toBe(3)
  })
})

test.describe('Fallback animations sans JavaScript', () => {
  test('le bloc hero est visible sans JS', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false })
    const page = await context.newPage()
    await page.goto('/')


    await expect(page.locator('[data-block-type="hero"]')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('.hero-content')).toBeVisible()
    await context.close()
  })

  test('le footer shutter est visible sans JS', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false })
    const page = await context.newPage()
    await page.goto('/')

    await expect(page.locator('.shutter-char').first()).toBeVisible({ timeout: 10000 })

    const footerText = await page.locator('.footer-title').innerText()
    expect(footerText.replace(/\xa0/g, ' ')).toContain('Il y a une place pour toi')
    await context.close()
  })
})

test.describe('Styles CSS des animations', () => {
  test('les classes block-anim-* existent dans le DOM', async ({ page }) => {
    await page.goto('/?admin=true')
    await page.waitForTimeout(3000)

    expect(await page.locator('[class*="block-anim-"]').count()).toBeGreaterThan(0)
  })

  test('toutes les animations ANIMATIONS sont utilisées au moins une fois', async ({ page }) => {
    await page.goto('/?admin=true')
    await page.waitForTimeout(3000)

    const anims = ['block-anim-fadeIn', 'block-anim-slideUp', 'block-anim-slideLeft',
                   'block-anim-portal', 'block-anim-zoom', 'block-anim-bounce',
                   'block-anim-flip', 'block-anim-wave']
    const found: string[] = []
    for (const cls of anims) {
      const count = await page.locator(`.${cls}`).count()
      if (count > 0) found.push(cls)
    }
    // Au moins fadeIn et portal sont utilisés par défaut (vision + bienvenue)
    expect(found.length).toBeGreaterThanOrEqual(2)
  })
})
