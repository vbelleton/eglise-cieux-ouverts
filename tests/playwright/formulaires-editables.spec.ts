import { test, expect } from '@playwright/test'
import { resetMock } from './helpers/reset'
import { AVAILABLE_FONTS, FONT_GROUPS, isValidFont, fontWeights } from '../../utils/fonts.js'

const VISIBLE = { desktop: true, tablet: true, mobile: true }

test.describe('Formulaires : textes et champs modifiables', () => {
  test.beforeEach(async ({ request }) => { await resetMock(request) })

  test('formulaire de contact (accueil) : libellés, ville, newsletter, bouton', async ({ page, request }) => {
    await request.put('/api/pages/accueil', { data: { blocks: [{ id: 'c1', type: 'contact', visibility: VISIBLE, props: {
      title: 'Écris-nous', backgroundGradient: '#064886',
      labelPrenom: 'Ton prénom', labelNom: 'Ton nom', labelEmail: 'Ton courriel', labelMessage: 'Ta question',
      showVille: false, showNewsletter: false, submitText: 'Envoyer ma question', successText: 'Bien reçu !',
    } }] } })
    await page.goto('/')
    const form = page.locator('.contact-form')
    await expect(form.getByPlaceholder('Ton prénom *')).toBeVisible()
    await expect(form.getByPlaceholder('Ton nom *')).toBeVisible()
    await expect(form.getByPlaceholder('Ton courriel *')).toBeVisible()
    await expect(form.getByPlaceholder('Ta question *')).toBeVisible()
    await expect(form.getByPlaceholder('Ville')).toHaveCount(0)
    await expect(form.locator('.checkbox-label')).toHaveCount(0)
    await expect(form.getByRole('button', { name: 'Envoyer ma question' })).toBeVisible()
    // Nom accessible réel (RGAA) et pas seulement un placeholder
    await expect(form.getByRole('textbox', { name: 'Ton courriel' })).toBeVisible()
  })

  test('formulaire de contact (page Contact) : libellés personnalisés', async ({ page, request }) => {
    await request.put('/api/pages/contact', { data: { blocks: [{ id: 'c2', type: 'contact', visibility: VISIBLE, props: {
      title: 'Nous contacter', mapEmbedUrl: 'https://www.google.com/maps?q=Morlaix&output=embed',
      labelVille: 'Où habites-tu ?', newsletterText: 'Je veux la lettre', submitText: 'Go',
    } }] } })
    await page.goto('/contact')
    await expect(page.getByText('Où habites-tu ?')).toBeVisible()
    await expect(page.getByText('Je veux la lettre')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Go' })).toBeVisible()
  })

  test('valeurs d\'origine inchangées quand rien n\'est personnalisé', async ({ page }) => {
    await page.goto('/')
    const form = page.locator('.contact-form')
    await expect(form.getByPlaceholder('Prénom *')).toBeVisible()
    await expect(form.getByPlaceholder('Nom de famille *')).toBeVisible()
    await expect(form.getByPlaceholder('Ville')).toBeVisible()
    await expect(form.getByPlaceholder('Email *')).toBeVisible()
    await expect(form.getByPlaceholder('Ton message *')).toBeVisible()
    await expect(form.getByRole('button', { name: "C'est parti !" })).toBeVisible()
  })

  test('inscription Alpha : libellés, adresse et message modifiables', async ({ page, request }) => {
    await request.put('/api/pages/event-list', { data: { blocks: [{ id: 'a1', type: 'inscriptionAlpha', visibility: VISIBLE, props: {
      labelPrenom: 'Prénom du participant', labelTelephone: 'Mobile', showAddress: false, showMessage: false,
    } }] } })
    await page.route('**/api/church-events*', (r) => r.fulfill({ json: [] }))
    await page.goto('/event-list')
    const form = page.locator('.ia-form')
    await expect(form.getByText('Prénom du participant *')).toBeVisible()
    await expect(form.getByText('Mobile *')).toBeVisible()
    await expect(form.getByText('Adresse postale (facultatif)')).toHaveCount(0)
    await expect(form.getByText('Un mot pour nous (facultatif)')).toHaveCount(0)
  })

  test('ces textes sont éditables dans le panneau « Formulaire » de l\'admin', async ({ page }) => {
    await page.goto('/?admin=true')
    await page.waitForSelector('.admin-toolbar')
    await page.locator('.block-wrapper[data-block-type="contact"]').first().click({ position: { x: 20, y: 20 } })
    await expect(page.getByText('Formulaire (champs et textes)')).toBeVisible()
    await expect(page.getByText('Texte du bouton d\'envoi')).toBeVisible()
  })
})

test.describe('Polices', () => {
  test('liste étendue, groupée, avec graisses valides', () => {
    expect(AVAILABLE_FONTS.length).toBeGreaterThanOrEqual(30)
    const groupes = new Set(FONT_GROUPS.map((g) => g.id))
    const noms = new Set<string>()
    for (const f of AVAILABLE_FONTS) {
      expect(groupes.has(f.groupe), `groupe inconnu pour ${f.value}`).toBe(true)
      expect(noms.has(f.value), `doublon ${f.value}`).toBe(false)
      noms.add(f.value)
      expect(f.stack).toContain(`'${f.value}'`)
      expect(fontWeights(f.value)).toMatch(/^\d{3}(;\d{3})*$/)
      expect(isValidFont(f.value)).toBe(true)
    }
    // Les polices actuelles du site restent disponibles et en tête
    expect(AVAILABLE_FONTS[0].value).toBe('Nunito')
    expect(AVAILABLE_FONTS[1].value).toBe('Playfair Display')
  })

  test('une valeur de police arbitraire reste refusée', () => {
    expect(isValidFont('Comic Sans; } body { display:none')).toBe(false)
  })
})
