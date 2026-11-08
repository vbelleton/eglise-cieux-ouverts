import { test, expect, type Page } from '@playwright/test'
import { resetMock } from './helpers/reset'

/**
 * Menu ordinateur : aucun lien ne doit bouger après l'affichage.
 *
 * Deux causes de « sursaut » observées sur le lien de la page Événements
 * (renommé « Événement sur inscription » en production, le plus long du menu) :
 * 1. Avec « Masquer la page Événements si aucun événement » activé, le lien
 *    rendu par le serveur disparaissait le temps que les événements arrivent
 *    côté navigateur, puis revenait : tout le menu se décalait deux fois.
 * 2. Le lien de la page courante passe en gras : sa largeur changeait, et
 *    les liens suivants glissaient en arrivant sur la page (d'autant plus
 *    que le libellé est long).
 */

const LIBELLE = 'Événement sur inscription'

async function menuRenomme(request: import('@playwright/test').APIRequestContext) {
  const res = await request.put('/api/menu', {
    data: {
      menuItems: [
        { id: 'accueil', label: 'Accueil', to: '/', visible: true, children: [] },
        { id: 'messages', label: 'Messages', to: '/messages', visible: true, children: [] },
        { id: 'agenda', label: 'Agenda', to: '/agenda', visible: true, children: [] },
        { id: 'event-list', label: LIBELLE, to: '/event-list', visible: true, children: [] },
        { id: 'contact', label: 'Contact', to: '/contact', visible: true, children: [] },
      ],
      menuBgImage: '',
    },
  })
  expect(res.ok()).toBe(true)
}

// Enregistre, image par image, la position de chaque lien du menu ordinateur
// et sa présence : tout changement après le premier relevé est un sursaut.
async function suivreMenu(page: Page) {
  await page.addInitScript(() => {
    const releves: string[] = []
    ;(window as any).__relevesMenu = releves
    const relever = () => {
      const nav = document.querySelector('.nav-desktop')
      if (nav) {
        const liens = [...nav.querySelectorAll(':scope > a:not(.nav-membre-link)')] as HTMLElement[]
        const visible = getComputedStyle(nav).visibility !== 'hidden'
        if (visible) {
          const sig = liens
            .map((a) => `${a.textContent?.trim()}@${Math.round(a.getBoundingClientRect().left)}`)
            .join('|')
          if (releves[releves.length - 1] !== sig) releves.push(sig)
        }
      }
      requestAnimationFrame(relever)
    }
    requestAnimationFrame(relever)
  })
}

test.describe('Menu ordinateur sans sursaut', () => {
  test.use({ viewport: { width: 1366, height: 768 } })

  test.beforeEach(async ({ request }) => {
    await resetMock(request)
    await menuRenomme(request)
  })

  test('le lien Événements ne disparaît pas le temps de charger les événements', async ({ page, request }) => {
    const res = await request.put('/api/settings', {
      data: { contactEmails: ['contact@tests.fr'], hideEventsPageIfEmpty: true },
    })
    expect(res.ok()).toBe(true)
    // Des événements à venir, mais qui arrivent lentement.
    const demain = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    await page.route('**/api/church-events*', async (route) => {
      await new Promise((r) => setTimeout(r, 1500))
      await route.fulfill({
        json: [{ id: 1, title: 'Soirée', start_date: demain, start_time: '20:00', status: 'published' }],
      })
    })
    await suivreMenu(page)

    await page.goto('/contact')
    await page.waitForTimeout(3000)
    const releves = await page.evaluate(() => (window as any).__relevesMenu as string[])
    expect(releves.length, releves.join('\n')).toBe(1)
    expect(releves[0]).toContain(LIBELLE)
  })

  test('arriver sur la page Événements ne décale pas le menu', async ({ page }) => {
    await page.route('**/api/church-events*', (route) => route.fulfill({ json: [] }))
    await page.goto('/contact')
    const nav = page.locator('.nav-desktop')
    const lien = nav.getByRole('link', { name: LIBELLE })
    await expect(lien).toBeVisible()
    const avant = await nav.locator(':scope > a').evaluateAll((els) =>
      els.map((e) => Math.round(e.getBoundingClientRect().left)),
    )

    await lien.click()
    await expect(page).toHaveURL(/event-list/)
    await expect(lien).toHaveClass(/active/)
    const apres = await nav.locator(':scope > a').evaluateAll((els) =>
      els.map((e) => Math.round(e.getBoundingClientRect().left)),
    )
    expect(apres).toEqual(avant)
  })
})
