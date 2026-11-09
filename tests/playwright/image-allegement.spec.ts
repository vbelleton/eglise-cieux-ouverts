import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './helpers/admin'

// Constaté en prod : visuels d'événements en PNG opaque de 2640 px (9,4 Mo).
// Un PNG sans transparence passe en JPEG à l'envoi ; un logo détouré reste PNG.

async function pngGenere(page, transparent: boolean): Promise<Buffer> {
  const b64 = await page.evaluate(async (transp) => {
    const c = document.createElement('canvas'); c.width = 2600; c.height = 1460
    const ctx = c.getContext('2d')!
    // Dégradé bruité, comme une photo : lourd en PNG, léger en JPEG.
    const img = ctx.createImageData(c.width, c.height)
    for (let i = 0; i < img.data.length; i += 4) {
      const p = i / 4, x = p % c.width, y = (p / c.width) | 0
      img.data[i] = (x / 10 + Math.random() * 40) & 255
      img.data[i + 1] = (y / 6 + Math.random() * 40) & 255
      img.data[i + 2] = 120
      img.data[i + 3] = transp && (x < 300 || y < 200) ? 0 : 255
    }
    ctx.putImageData(img, 0, 0)
    const blob: Blob = await new Promise(r => c.toBlob(b => r(b!), 'image/png'))
    const buf = new Uint8Array(await blob.arrayBuffer())
    let s = ''; for (const x of buf) s += String.fromCharCode(x)
    return btoa(s)
  }, transparent)
  return Buffer.from(b64, 'base64')
}

for (const transparent of [false, true]) {
  test(`téléversement d'un PNG ${transparent ? 'détouré : reste PNG' : 'opaque : envoyé en JPEG'}`, async ({ page }) => {
    await page.route('**/api/church-events**', (route) => route.fulfill({ json: [] }))
    await loginAsAdmin(page)
    const png = await pngGenere(page, transparent)
    const envois: string[] = []
    page.on('request', (r) => {
      if (r.method() === 'POST' && /\/api\/media\?key=uploads%2F(?!thumbs)/.test(r.url())) envois.push(r.headers()['content-type'])
    })
    await page.locator('button[title="Gérer les événements"]').click()
    await page.getByRole('button', { name: /Nouvel événement/ }).click()
    await page.locator('.event-image-controls input[type=file]').setInputFiles({ name: 'visuel.png', mimeType: 'image/png', buffer: png })
    await expect.poll(() => envois.length, { timeout: 15000 }).toBeGreaterThan(0)
    expect(envois[0]).toBe(transparent ? 'image/png' : 'image/jpeg')
    await expect(page.locator('.event-image-controls input[type=url]')).toHaveValue(/\/api\/media\/uploads\//)
  })
}

test('image collée par lien externe : allégée automatiquement, sans bouton', async ({ page }) => {
  await page.route('**/api/church-events**', (route) => route.fulfill({ json: [] }))
  await page.route('**/api/media/importer', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('89504e470d0a1a0a', 'hex') }))
  await loginAsAdmin(page)
  await page.locator('button[title="Gérer les événements"]').click()
  await page.getByRole('button', { name: /Nouvel événement/ }).click()
  const champ = page.locator('.event-image-controls input[type=url]')
  await champ.fill('https://s3.amazonaws.com/bucket/img.png')
  await champ.press('Tab')
  await expect(champ).toHaveValue(/\/api\/media\/uploads\//, { timeout: 15000 })
  await expect(page.locator('.event-image-distante')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Alléger/ })).toHaveCount(0)
})

test('image distante impossible à importer : lien gardé, enregistrement non bloqué', async ({ page }) => {
  const envois: any[] = []
  await page.route('**/api/church-events**', async (route) => {
    if (route.request().method() === 'POST') { envois.push(route.request().postDataJSON()); return route.fulfill({ json: { id: 99 } }) }
    return route.fulfill({ json: [] })
  })
  await page.route('**/api/media/importer', (route) => route.fulfill({ status: 502, json: { message: 'injoignable' } }))
  await loginAsAdmin(page)
  await page.locator('button[title="Gérer les événements"]').click()
  await page.getByRole('button', { name: /Nouvel événement/ }).click()
  await page.locator('.event-form input[type=text]').first().fill('Test')
  await page.locator('.event-form input[type=date]').first().fill('2026-12-01')
  const champ = page.locator('.event-image-controls input[type=url]')
  await champ.fill('https://s3.amazonaws.com/bucket/img.png')
  await champ.press('Tab')
  await expect(page.locator('.event-image-distante')).toContainText('pas pu être allégée')
  await page.getByRole('button', { name: 'Créer', exact: true }).click()
  await expect.poll(() => envois.length).toBe(1)
  expect(envois[0].image_url).toBe('https://s3.amazonaws.com/bucket/img.png')
})

test('import d\'image distante : réservé aux admins, adresses contrôlées', async ({ request }) => {
  expect((await request.post('/api/media/importer', { data: { url: 'https://exemple.fr/a.png' } })).status()).toBe(401)
  const auth = { Authorization: 'Bearer mock-test-token' }
  for (const url of ['http://exemple.fr/a.png', 'https://127.0.0.1/a.png', 'https://localhost/x']) {
    expect((await request.post('/api/media/importer', { headers: auth, data: { url } })).status(), url).toBe(400)
  }
})
