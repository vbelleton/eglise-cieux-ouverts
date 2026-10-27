import { test, expect, type Page } from '@playwright/test'
import { resetMock } from './helpers/reset'

// Réactivité des changements de page depuis le menu (utils/pageApiCache.js) :
// la lecture du contenu part au survol, le clic ne la refait pas, et une page
// déjà vue revient sans nouvel appel à l'API.

function compterLectures(page: Page, slug: string) {
  const compteur = { n: 0 }
  page.on('request', (req) => {
    if (new URL(req.url()).pathname === `/api/pages/${slug}`) compteur.n++
  })
  return compteur
}

test.describe('Navigation : préchargement du contenu', () => {
  test.beforeEach(async ({ request }) => {
    await resetMock(request)
  })

  test('le survol précharge, le clic ne relit pas', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    const lectures = compterLectures(page, 'contact')

    const lien = page.locator('.nav-desktop').getByRole('link', { name: 'Contact' })
    await lien.hover()
    await expect.poll(() => lectures.n).toBe(1)

    await lien.click()
    await page.waitForURL('/contact')
    await expect(page.locator('[data-block-type="contact"]')).toBeVisible()
    expect(lectures.n).toBe(1)
  })

  test('une page déjà vue revient sans nouvel appel', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    const lectures = compterLectures(page, 'messages')
    const nav = page.locator('.nav-desktop')

    await nav.getByRole('link', { name: 'Messages' }).click()
    await page.waitForURL('/messages')
    await nav.getByRole('link', { name: 'Contact' }).click()
    await page.waitForURL('/contact')
    await nav.getByRole('link', { name: 'Messages' }).click()
    await page.waitForURL('/messages')
    await expect(page.locator('[data-block-type="richText"]').first().or(page.locator('[data-block-type="youtube"]').first())).toBeVisible()

    expect(lectures.n).toBe(1)
  })

  test('une lecture ratée ne reste pas en cache', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    let echecs = 1
    await page.route('**/api/pages/contact', (route) => {
      if (echecs-- > 0) return route.fulfill({ status: 500, body: '{}' })
      return route.continue()
    })
    const lectures = compterLectures(page, 'contact')
    const lien = page.locator('.nav-desktop').getByRole('link', { name: 'Contact' })

    const reponseRatee = page.waitForResponse((r) => r.url().endsWith('/api/pages/contact') && r.status() === 500)
    await lien.hover()
    await reponseRatee
    await lien.click()
    await page.waitForURL('/contact')
    await expect(page.locator('[data-block-type="contact"]')).toBeVisible()
    expect(lectures.n).toBe(2)
  })
})
