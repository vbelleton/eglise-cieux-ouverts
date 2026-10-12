import { test, expect } from '@playwright/test'
import { resetMock } from './helpers/reset'

test.describe('Accessibilité (RGAA) : correctifs de l\'audit', () => {
  test.beforeEach(async ({ request }) => { await resetMock(request) })

  test('lien d\'évitement : visible au focus, mène au contenu', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/')
    await page.keyboard.press('Tab')
    const lien = page.getByRole('link', { name: 'Aller au contenu' })
    await expect(lien).toBeFocused()
    await expect(lien).toBeInViewport()
    await page.keyboard.press('Enter')
    await expect(page.locator('main#contenu')).toBeFocused()
  })

  for (const [path, titre] of [['/', 'Église Cieux Ouverts, Morlaix'], ['/messages', 'Nos messages'], ['/contact', 'Nous contacter']] as const) {
    test(`${path} : un seul h1`, async ({ page }) => {
      await page.goto(path)
      await expect(page.locator('h1')).toHaveCount(1)
      await expect(page.locator('h1')).toHaveText(titre)
    })
  }

  test('menu mobile : focus piégé, Échap le ferme et rend le focus au bouton', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    const burger = page.locator('.burger')
    await expect(burger).toHaveAttribute('aria-label', 'Ouvrir le menu')
    await burger.click()
    await expect(burger).toHaveAttribute('aria-label', 'Fermer le menu')
    const dansLeMenu = () => page.evaluate(() => {
      const a = document.activeElement
      return Boolean(a && (a.closest('.nav-mobile') || a.classList.contains('burger')))
    })
    expect(await dansLeMenu()).toBe(true)
    // 15 tabulations : le focus ne sort jamais du menu
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('Tab')
      expect(await dansLeMenu(), `focus sorti du menu à la tabulation ${i + 1}`).toBe(true)
    }
    await page.keyboard.press('Shift+Tab')
    expect(await dansLeMenu()).toBe(true)
    await page.keyboard.press('Escape')
    await expect(page.locator('.site-header')).not.toHaveClass(/menu-open/)
    await expect(burger).toBeFocused()
  })

  test('menu mobile : texte lisible (fond bleu opaque, contraste ≥ 4,5)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    await page.locator('.burger').click()
    const voile = await page.locator('.nav-mobile').evaluate((el) => getComputedStyle(el, '::before').backgroundImage)
    expect(voile).toContain('rgba(6, 72, 134')
  })

  test('formulaire de contact : erreur annoncée, champ fautif focalisé et marqué', async ({ page }) => {
    await page.goto('/')
    const form = page.locator('.contact-form')
    await form.scrollIntoViewIfNeeded()
    await expect(form.getByText('Les champs marqués d\'un * sont obligatoires.')).toBeVisible()
    await page.waitForTimeout(2700)
    await form.getByRole('textbox', { name: 'Prénom' }).fill('Ada')
    await form.getByRole('textbox', { name: 'Nom de famille' }).fill('Lovelace')
    await form.getByRole('textbox', { name: 'Email' }).fill('adresse-invalide')
    await form.getByRole('textbox', { name: 'Ton message' }).fill('Un message assez long pour passer.')
    await form.evaluate((f) => (f as HTMLFormElement).setAttribute('novalidate', ''))
    await form.getByRole('button', { name: "C'est parti !" }).click()
    const erreur = form.getByRole('alert')
    await expect(erreur).toContainText('adresse email valide')
    const email = form.getByRole('textbox', { name: 'Email' })
    await expect(email).toBeFocused()
    await expect(email).toHaveAttribute('aria-invalid', 'true')
    await expect(email).toHaveAttribute('aria-describedby', /contact-erreur/)
  })

  test('liens réseaux : nom accessible précisant la nouvelle fenêtre', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/')
    await expect(page.getByRole('link', { name: 'Instagram (nouvelle fenêtre)' }).first()).toBeVisible()
  })

  test('carrousel des activités : atteignable et utilisable au clavier', async ({ page }) => {
    await page.goto('/')
    const voir = page.getByRole('button', { name: /Voir le détail : Rencontre du dimanche/ }).first()
    await voir.scrollIntoViewIfNeeded()
    await voir.focus()
    await page.keyboard.press('Enter')
    const dialogue = page.getByRole('dialog')
    await expect(dialogue).toBeVisible()
    await expect(page.getByRole('button', { name: 'Fermer' })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(dialogue).toHaveCount(0)
    await expect(voir).toBeFocused()
    await expect(page.getByRole('button', { name: 'Activité suivante' })).toBeVisible()
  })

  test('le mode contraste élevé de Windows n\'est plus désactivé', async ({ page }) => {
    await page.goto('/')
    const valeur = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('forced-color-adjust') || 'auto')
    expect(valeur.trim()).not.toBe('none')
  })
})
