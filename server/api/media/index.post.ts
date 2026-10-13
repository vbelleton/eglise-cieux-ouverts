import { requireAdmin } from '../../utils/firebase-admin'
import { getMediaStore, cleMedia } from '../../utils/media-store'

const MAX_OCTETS = 25 * 1024 * 1024

// Envoi d'une image : corps brut, chemin dans ?key= (ex. uploads/123_photo.jpg).
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const cle = cleMedia(String(getQuery(event).key || ''))
  if (!cle) throw createError({ statusCode: 400, message: 'Nom de fichier invalide' })
  const type = String(getHeader(event, 'content-type') || '')
  if (!type.startsWith('image/')) throw createError({ statusCode: 415, message: "Ce n'est pas une image" })
  const raw = await readRawBody(event, false)
  if (!raw || !raw.byteLength) throw createError({ statusCode: 400, message: 'Fichier vide' })
  if (raw.byteLength > MAX_OCTETS) throw createError({ statusCode: 413, message: 'Fichier trop lourd (25 Mo maximum)' })
  const data = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer
  await getMediaStore(event).put(cle, data, type)
  return { key: cle, url: `/api/media/${cle}` }
})
