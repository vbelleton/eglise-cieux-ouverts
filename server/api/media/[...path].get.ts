import { getMediaStore, cleMedia } from '../../utils/media-store'

// Service public des images. Le nom contient un horodatage et n'est jamais
// réécrit : cache long sans risque.
export default defineEventHandler(async (event) => {
  const cle = cleMedia(getRouterParam(event, 'path') || '')
  if (!cle) throw createError({ statusCode: 404 })
  const fichier = await getMediaStore(event).get(cle)
  if (!fichier) throw createError({ statusCode: 404 })
  setHeader(event, 'content-type', fichier.contentType)
  setHeader(event, 'cache-control', 'public, max-age=31536000, immutable')
  // Un SVG ouvert directement ne doit pas pouvoir exécuter de script.
  setHeader(event, 'content-security-policy', 'sandbox')
  return new Uint8Array(fichier.body)
})
