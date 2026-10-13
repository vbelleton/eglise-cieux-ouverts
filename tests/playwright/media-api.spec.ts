import { test, expect } from '@playwright/test'

// Stockage d'images : envoi, liste, service public (magasin en mémoire en test).
const auth = { Authorization: 'Bearer mock-test-token' }
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==', 'base64')

test.describe('API médias', () => {
  test('envoi puis lecture publique et liste admin', async ({ request }) => {
    const cle = `uploads/${Date.now()}_test.png`
    const envoi = await request.post(`/api/media?key=${encodeURIComponent(cle)}`, {
      headers: { ...auth, 'Content-Type': 'image/png' },
      data: PNG,
    })
    expect(envoi.status()).toBe(200)
    expect((await envoi.json()).url).toBe(`/api/media/${cle}`)

    const lecture = await request.get(`/api/media/${cle}`)
    expect(lecture.status()).toBe(200)
    expect(lecture.headers()['content-type']).toContain('image/png')
    expect(lecture.headers()['cache-control']).toContain('immutable')
    expect((await lecture.body()).equals(PNG)).toBe(true)

    const liste = await request.get('/api/media', { headers: auth })
    expect((await liste.json()).names).toContain(cle.slice('uploads/'.length))
  })

  test('refuse sans authentification, hors image, et chemins douteux', async ({ request }) => {
    const sansJeton = await request.post('/api/media?key=uploads/a.png', { headers: { 'Content-Type': 'image/png' }, data: PNG })
    expect([401, 403]).toContain(sansJeton.status())
    const pasImage = await request.post('/api/media?key=uploads/a.txt', { headers: { ...auth, 'Content-Type': 'text/plain' }, data: 'x' })
    expect(pasImage.status()).toBe(415)
    const sortie = await request.post('/api/media?key=' + encodeURIComponent('uploads/../secret.png'), { headers: { ...auth, 'Content-Type': 'image/png' }, data: PNG })
    expect(sortie.status()).toBe(400)
    expect((await request.get('/api/media/uploads/inexistante.png')).status()).toBe(404)
    expect((await request.get('/api/media', {})).status()).not.toBe(200)
  })

  test('suppression : image et vignette disparaissent, refus sans droits', async ({ request }) => {
    const nom = `${Date.now()}_a-supprimer.png`
    for (const dossier of ['uploads', 'uploads/thumbs']) {
      const r = await request.post(`/api/media?key=${encodeURIComponent(`${dossier}/${nom}`)}`, { headers: { ...auth, 'Content-Type': 'image/png' }, data: PNG })
      expect(r.status()).toBe(200)
    }
    const refus = await request.delete(`/api/media?name=${encodeURIComponent(nom)}`)
    expect([401, 403]).toContain(refus.status())
    expect((await request.get(`/api/media/uploads/${nom}`)).status()).toBe(200)

    const ok = await request.delete(`/api/media?name=${encodeURIComponent(nom)}`, { headers: auth })
    expect(ok.status()).toBe(200)
    expect((await request.get(`/api/media/uploads/${nom}`)).status()).toBe(404)
    expect((await request.get(`/api/media/uploads/thumbs/${nom}`)).status()).toBe(404)
    const liste = await request.get('/api/media', { headers: auth })
    expect((await liste.json()).names).not.toContain(nom)

    const douteux = await request.delete('/api/media?name=' + encodeURIComponent('../x.png'), { headers: auth })
    expect(douteux.status()).toBe(400)
  })
})
