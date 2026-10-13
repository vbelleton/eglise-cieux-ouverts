import { requireAdmin } from '../../utils/firebase-admin'
import { getMediaStore, cleMedia } from '../../utils/media-store'

// Suppression d'une image téléversée et de sa vignette : ?name=<nom>.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const nom = String(getQuery(event).name || '')
  const cle = cleMedia(`uploads/${nom}`)
  if (!cle || nom.includes('/')) throw createError({ statusCode: 400, message: 'Nom de fichier invalide' })
  await getMediaStore(event).delete([cle, `uploads/thumbs/${nom}`])
  return { deleted: nom }
})
