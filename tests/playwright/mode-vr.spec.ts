import { test, expect } from '@playwright/test'

/**
 * Mode VR caché (pages/vr.vue, lib/vr/scene.js).
 *
 * Caché = aucun lien du site n'y mène, absent du sitemap, non indexé. La scène
 * three.js doit se monter sans erreur et viser une photo doit l'approcher.
 * Le casque (WebXR) n'est pas testable ici : on vérifie la vue écran.
 */

test('la page /vr se charge, non indexée, et une photo s’approche au clic', async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/vr')

  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
  await expect(page.locator('.vr-scene canvas')).toBeVisible({ timeout: 15000 })
  await expect(page.locator('.vr-aide')).toBeVisible()
  // Ni en-tête ni pied de page du site : la scène occupe tout l'écran.
  await expect(page.locator('header.site-header, footer')).toHaveCount(0)

  // Au départ, « Le culte du dimanche » est la photo visible à droite.
  await page.waitForTimeout(1500)
  await page.mouse.click(1150, 400)
  await expect(page.locator('.vr-photo')).toContainText('Le culte du dimanche')

  // Viser le vide la remet en place.
  await page.mouse.click(640, 600)
  await expect(page.locator('.vr-photo')).toHaveCount(0)
  await expect(page.locator('.vr-aide')).toBeVisible()

  expect(erreurs).toEqual([])
})

test('aucun lien du site ne mène au mode VR', async ({ page, request }) => {
  await page.goto('/')
  await expect(page.locator('a[href*="/vr"]')).toHaveCount(0)
  const sitemap = await (await request.get('/sitemap.xml')).text()
  expect(sitemap).not.toContain('/vr')
})
