import { test, expect } from './fixtures/admin-fixtures'
import { resetMock as remettreAZero } from './helpers/reset'

test.describe('Gestion des pages depuis le menu', () => {
  test('le bouton « Pages » de la toolbar ouvre la gestion du menu', async ({ page, adminLogin }) => {
    // Avant, le MenuEditor ne s'ouvrait qu'en cliquant sur le menu du site
    // en mode admin — aucun point d'entrée visible dans la toolbar.
    await page.goto('/?admin=true')
    await page.waitForSelector('.admin-toolbar', { timeout: 10000 })

    await page.locator('.admin-toolbar button', { hasText: 'Pages' }).click()
    await page.waitForSelector('.menu-editor-modal', { timeout: 5000 })
    await expect(page.locator('.btn-add-page')).toBeVisible()
  })

  test('ajouter un sous-menu garde le panneau ouvert et permet de le renommer immédiatement', async ({ page, adminLogin }) => {
    // Bug réel : addSubMenuItem() sélectionne le sous-item fraîchement créé
    // (editingMenuItemId = sub.id) pour permettre son édition, mais le
    // panneau .menu-item-edit d'un item de premier niveau ne s'affichait
    // qu'à la condition stricte editingMenuItemId === item.id — le panneau
    // (et le sous-item qu'on venait de créer) disparaissait donc
    // immédiatement après l'ajout, invisible jusqu'à re-cliquer le parent.
    await page.goto('/?admin=true')
    await page.waitForSelector('.admin-toolbar', { timeout: 10000 })
    await page.locator('.admin-toolbar button', { hasText: 'Pages' }).click()
    await page.waitForSelector('.menu-editor-modal', { timeout: 5000 })

    const accueilRow = page.locator('.menu-editor-item', { hasText: 'Accueil' })
    await accueilRow.locator('.menu-item-row').click()
    await page.getByRole('button', { name: '+ Ajouter un sous-menu' }).click()

    // Le panneau reste ouvert et le sous-item est immédiatement éditable
    const subItem = page.locator('.sub-item')
    await expect(subItem).toBeVisible()
    const labelInput = subItem.locator('input').first()
    await expect(labelInput).toHaveValue('Sous-menu')

    // Renommer immédiatement, sans avoir à rouvrir quoi que ce soit
    await labelInput.fill('Notre équipe')

    // Cliquer ailleurs puis revenir : le renommage a bien persisté
    await page.locator('.menu-editor-item', { hasText: 'Messages' }).locator('.menu-item-row').click()
    await accueilRow.locator('.menu-item-row').click()
    await expect(page.locator('.sub-item span')).toHaveText('Notre équipe')

    // Et le sous-menu s'affiche bien sur le site public une fois sauvegardé
    await page.locator('.menu-editor-header-actions .btn-save').click()
    await page.locator('.version-modal-close').click()
    await page.goto('/')
    await expect(page.locator('.nav-desktop a', { hasText: 'Notre équipe' })).toBeVisible()
  })

  test('supprimer la page actuellement affichée redirige vers l\'accueil et la retire du sélecteur', async ({ page, adminLogin }) => {
    // Auto-accepte tous les confirm()/alert() de la session (fermeture avec
    // modifications non sauvegardées, confirmation de suppression, etc.)
    page.on('dialog', (dialog) => dialog.accept())

    await page.goto('/?admin=true')
    await page.waitForSelector('.admin-toolbar', { timeout: 10000 })

    // Ouvre la gestion du menu : en desktop admin, cliquer un lien de nav
    // ouvre l'éditeur de menu au lieu de naviguer (le burger mobile est
    // masqué en CSS à cette largeur)
    await page.locator('.nav-desktop a, nav a').first().click()
    await page.waitForSelector('.menu-editor-modal', { timeout: 5000 })

    // Crée une page de test
    await page.locator('.btn-add-page').click()
    await page.locator('.admin-mgr-input').fill('Page Test Suppression E2E')
    await page.getByRole('button', { name: 'Créer la page' }).click()

    // La création navigue automatiquement vers la nouvelle page
    await page.waitForURL('**/page-test-suppression-e2e**', { timeout: 5000 })

    // Elle apparaît dans le sélecteur de pages admin
    await expect(page.locator('.admin-page-select option', { hasText: 'Page Test Suppression E2E' })).toHaveCount(1)

    // La création ferme la modale mais laisse le panneau de gestion du menu
    // ouvert : on le ferme avant de le rouvrir pour ne pas bloquer les clics
    await page.locator('.menu-editor-modal .version-modal-close').click()
    await page.waitForSelector('.menu-editor-modal', { state: 'detached', timeout: 3000 })

    // Rouvre le menu et supprime la page pendant qu'on la visite
    await page.locator('.nav-desktop a, nav a').first().click()
    await page.waitForSelector('.menu-editor-modal', { timeout: 5000 })

    const item = page.locator('.menu-editor-item', { hasText: 'Page Test Suppression E2E' })
    await item.locator('.btn-mini', { hasText: '🗑' }).click()

    // On est redirigé vers l'accueil, pas laissé sur la page supprimée
    await page.waitForURL((url) => url.pathname === '/', { timeout: 5000 })

    // La page a disparu du sélecteur immédiatement (pas besoin de recharger)
    await expect(page.locator('.admin-page-select option', { hasText: 'Page Test Suppression E2E' })).toHaveCount(0)
  })

  // Les slugs accueil/contact/messages/event-list/agenda/photos ont chacun
  // leur propre fichier pages/*.vue avec du vrai contenu Firestore. Sans
  // cette protection, créer une page custom avec un de ces titres
  // écraserait silencieusement (setFirestoreDoc) le document réel de la
  // page statique — pas juste un doublon inatteignable, une vraie perte de
  // contenu en production.
  for (const slug of ['accueil', 'contact', 'messages', 'event-list', 'agenda', 'photos']) {
    test(`création d'une page custom avec le slug réservé "${slug}" est refusée`, async ({ page }) => {
      const res = await page.request.post('/api/pages', { data: { slug, title: slug } })
      expect(res.status()).toBe(400)
      const body = await res.json()
      expect(body.message).toBe('Ce slug est réservé')
    })

    test(`suppression de la page réservée "${slug}" est refusée`, async ({ page }) => {
      const res = await page.request.delete(`/api/pages/${slug}`)
      expect(res.status()).toBe(400)
      const body = await res.json()
      expect(body.message).toBe('Impossible de supprimer cette page')
    })
  }

  test('changer l\'adresse d\'une page la déplace, redirige l\'ancienne et met le menu à jour', async ({ page, adminLogin, resetMock }) => {
    await page.goto('/?admin=true')
    await page.waitForSelector('.admin-toolbar', { timeout: 10000 })
    await page.locator('.admin-toolbar button', { hasText: 'Pages' }).click()
    await page.waitForSelector('.menu-editor-modal', { timeout: 5000 })

    // La page de dons est listée même jamais enregistrée
    const ligne = page.locator('.menu-editor-item', { hasText: 'Dons' })
    await ligne.locator('.menu-item-row').click()
    await ligne.locator('.page-adresse-row input').fill('Nous soutenir')
    await ligne.getByRole('button', { name: 'Changer' }).click()
    await expect(ligne.locator('.page-adresse-row input')).toHaveValue('nous-soutenir')
    await expect(ligne.locator('.page-adresse-erreur')).toHaveCount(0)

    // L'ancienne adresse redirige, la nouvelle affiche le contenu
    const reponse = await page.request.get('/dons', { maxRedirects: 0 })
    expect(reponse.status()).toBe(301)
    expect(reponse.headers()['location']).toContain('/nous-soutenir')
    await page.goto('/nous-soutenir')
    await expect(page.locator('.block-virement')).toBeVisible()
    await expect(page.locator('.nav-desktop a[href="/nous-soutenir"]')).toBeVisible()

    // Le mock est partagé : on ne laisse pas la page déplacée aux tests suivants
    await remettreAZero(page.request)
  })
})
