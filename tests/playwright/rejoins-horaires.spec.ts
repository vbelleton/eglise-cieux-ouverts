import { test, expect } from '@playwright/test'
import { resetMock } from './helpers/reset'

// Bloc « Rejoins-nous » : horaires sous « Rejoins-nous / Chaque dimanche /
// à Morlaix » par défaut, l'ancienne mise en page (à droite) reste possible.
function bloc(props: Record<string, unknown>) {
  return { id: 'rj', type: 'rejoins', props, visibility: { desktop: true, tablet: true, mobile: true } }
}

test.describe('Bloc Rejoins-nous', () => {
  test.beforeEach(async ({ request }) => {
    await resetMock(request)
  })

  test('par défaut, les horaires sont sous le texte', async ({ page, request }) => {
    await request.put('/api/pages/rejoins-test', { data: { blocks: [bloc({})] } })
    await page.setViewportSize({ width: 1400, height: 900 })
    await page.goto('/rejoins-test')
    const texte = page.locator('.rejoins-text-container')
    const horaires = page.locator('.rejoins-grid')
    await expect(page.locator('.rejoins-location')).toHaveText('à Morlaix')
    const t = await texte.boundingBox()
    const h = await horaires.boundingBox()
    expect(h!.y).toBeGreaterThan(t!.y + t!.height - 1)
  })

  test('« cote » garde les horaires à droite', async ({ page, request }) => {
    await request.put('/api/pages/rejoins-test', { data: { blocks: [bloc({ horairesPosition: 'cote' })] } })
    await page.setViewportSize({ width: 1400, height: 900 })
    await page.goto('/rejoins-test')
    const t = await page.locator('.rejoins-text-container').boundingBox()
    const h = await page.locator('.rejoins-grid').boundingBox()
    expect(h!.x).toBeGreaterThan(t!.x + t!.width - 1)
  })
})
