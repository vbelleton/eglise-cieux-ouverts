import { requireAdmin } from '../../utils/firebase-admin'
import { getMediaStore } from '../../utils/media-store'

// Liste des images d'origine (hors vignettes), pour la médiathèque.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const cles = await getMediaStore(event).list('uploads/')
  return { names: cles.filter(k => !k.startsWith('uploads/thumbs/')).map(k => k.slice('uploads/'.length)) }
})
