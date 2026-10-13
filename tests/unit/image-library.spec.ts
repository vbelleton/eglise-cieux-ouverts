import { test, expect } from '@playwright/test'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Garde-fous de performance de la médiathèque (vérifiés à la main contre un
// Firebase Storage simulé : 80 images → 1 requête de liste + uniquement les
// vignettes visibles, et zéro requête de plus à la réouverture).
const lire = (p: string) => readFileSync(resolve(__dirname, '../..', p), 'utf-8')

test.describe('Médiathèque : rapidité', () => {
  const upload = lire('utils/imageUpload.js')
  const lib = lire('components/editor/ImageLibrary.vue')
  const tuile = lire('components/editor/ImageLibraryTile.vue')

  test('la liste ne résout pas une URL par image avant d\'afficher', () => {
    const noms = upload.slice(upload.indexOf('export async function listUploadedImageNames'), upload.indexOf('async function adresse'))
    expect(noms).toContain("fetch('/api/media'")
    expect(lib).toContain('listUploadedImageNames')
    expect(lib).not.toContain('listUploadedImages()')
  })

  test('chaque vignette ne charge qu\'en entrant dans la zone visible', () => {
    expect(tuile).toContain('IntersectionObserver')
    expect(tuile).toContain('thumbnailUrl')
  })

  test('une vignette est envoyée avec chaque image, et le cache évite les requêtes répétées', () => {
    expect(upload).toContain('THUMB_FOLDER')
    expect(upload).toContain('listeEnCache')
  })

  test('plusieurs photos sont envoyées en parallèle', () => {
    expect(lib).toMatch(/Math\.min\(3, files\.length\)/)
  })

  test('un envoi qui échoue abandonne vite avec un message clair (pas 10 minutes)', () => {
    expect(upload).toContain('AbortSignal.timeout(DELAI_MAX_ENVOI_MS)')
    expect(upload).toContain('messageErreurEnvoi')
  })

  test('les images ne passent plus par Firebase Storage', () => {
    expect(upload).not.toContain('firebase/storage')
  })

  test('l\'ancien envoi sans compression a disparu de la barre admin', () => {
    const barre = lire('components/AdminToolbar.vue')
    expect(barre).not.toContain('uploadBytes')
    expect(barre).toContain('uploadImage(file)')
  })

  test('l\'onglet « Images du site » est à jour avec le dossier public/', async () => {
    // @ts-expect-error script .mjs sans types
    const { listerImagesDuSite } = await import('../../scripts/generate-site-images.mjs')
    const figee = JSON.parse(lire('utils/siteImages.json'))
    expect(figee, 'relancer : node scripts/generate-site-images.mjs').toEqual(listerImagesDuSite())
    expect(figee.length).toBeGreaterThan(10)
  })

  test('la suppression est proposée pour les envois seulement, avec confirmation', () => {
    expect(lib).toContain('deleteUploadedImages')
    expect(lib).toContain('window.confirm')
    expect(lib).toContain('saveHiddenSiteImages')
    expect(lib).toContain('groupesSite')
  })
})
