import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './helpers/admin'
import { resetMock } from './helpers/reset'

/**
 * Gras / italique / souligné / couleur par champ de texte, et textes des
 * blocs qui étaient écrits en dur (ex. la mention des champs obligatoires
 * du contact), désormais modifiables depuis la sidebar.
 */

test.describe('Mise en forme des textes', () => {
  test.beforeEach(async ({ page, request }) => {
    await resetMock(request)
    await loginAsAdmin(page)
  })

  test('gras, italique, souligné et couleur s\'appliquent puis s\'enregistrent', async ({ page }) => {
    const footer = page.locator('.footer-editable-wrap')
    await footer.scrollIntoViewIfNeeded()
    await footer.click()
    await expect(page.locator('.admin-sidebar-header h3')).toHaveText('Footer')

    const barre = page.locator('.field-format-bar').first()
    await barre.getByRole('button', { name: 'Gras' }).click()
    await barre.getByRole('button', { name: 'Italique' }).click()
    await barre.getByRole('button', { name: 'Souligné' }).click()
    await barre.getByLabel('Couleur du texte').fill('#c0392b')

    await expect(barre.getByRole('button', { name: 'Gras' })).toHaveAttribute('aria-pressed', 'true')
    const titre = page.locator('footer.site-footer .footer-title')
    await expect(titre).toHaveCSS('font-weight', '700')
    await expect(titre).toHaveCSS('font-style', 'italic')
    await expect(titre).toHaveCSS('text-decoration-line', 'underline')
    await expect(titre).toHaveCSS('color', 'rgb(192, 57, 43)')

    // Désactiver l'italique et revenir à la couleur par défaut
    await barre.getByRole('button', { name: 'Italique' }).click()
    await barre.getByRole('button', { name: 'Revenir à la couleur par défaut' }).click()
    await expect(titre).toHaveCSS('font-style', 'normal')
    await expect(titre).not.toHaveCSS('color', 'rgb(192, 57, 43)')

    await page.locator('button[title="Sauvegarder les modifications"]').click()
    await expect(page.locator('.admin-toolbar')).toContainText('Sauvegardé', { timeout: 5000 })
    const data = await (await page.request.get('/api/footer')).json()
    expect(data.props?.fieldFonts?._formats?.title).toEqual({ gras: true, souligne: true })
  })
})

test.describe('Textes du formulaire de contact', () => {
  test.beforeEach(async ({ request }) => {
    await resetMock(request)
  })

  test('la mention des champs obligatoires se modifie dans l\'admin', async ({ page }) => {
    await loginAsAdmin(page, '/contact')
    const note = page.locator('.contact-required-note').first()
    await expect(note).toHaveText("Les champs marqués d'un * sont obligatoires.")

    await note.click()
    const champ = page.locator('.auto-field', { hasText: 'Mention des champs obligatoires' })
    await expect(champ).toBeVisible()
    await champ.locator('.field-input').fill('* = à remplir')
    await expect(note).toHaveText('* = à remplir')

    await champ.locator('.field-format-bar').getByRole('button', { name: 'Gras' }).click()
    await expect(note).toHaveCSS('font-weight', '700')
  })
})
