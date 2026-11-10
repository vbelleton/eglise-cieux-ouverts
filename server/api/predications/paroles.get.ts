import { getMediaStore } from '../../utils/media-store'
import { CLE_PAROLES } from '../../utils/youtube-chaine'

// Paroles des prédications (une ligne JSON par vidéo), pour la recherche dans
// ce qui est dit. Renvoyées telles quelles, sans les relire : léger en calcul
// côté serveur, compressé par Cloudflare à l'envoi.
export default defineEventHandler(async (event) => {
  const isTest = process.env.NODE_ENV === 'test' || process.env.PW_TEST === '1' || process.env.TEST_ENV === '1'
  setHeader(event, 'content-type', 'application/x-ndjson; charset=utf-8')
  if (isTest) {
    const { PAROLES_TEST } = await import('../../utils/youtube-mock.js')
    return PAROLES_TEST
  }
  const fichier = await getMediaStore(event).get(CLE_PAROLES).catch(() => null)
  setHeader(event, 'cache-control', 'public, max-age=600')
  if (!fichier) return ''
  return new Uint8Array(fichier.body)
})
