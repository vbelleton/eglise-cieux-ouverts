import { requireAdmin } from '../../utils/firebase-admin'
import { fetchWithTimeout } from '../../utils/http'
import { typeImage, adresseAutorisee } from '../../utils/image-distante'

// Récupère une image hébergée ailleurs (ex. anciens visuels d'événements sur
// S3, servis sans cache et jusqu'à 9 Mo) pour que le navigateur de l'admin la
// recompresse puis la téléverse dans la médiathèque (utils/imageUpload.js,
// importerImageDistante). Le navigateur ne peut pas la lire directement :
// l'hôte d'origine n'envoie pas d'en-têtes CORS.
//
// Réservé aux administrateurs, HTTPS uniquement, jamais vers une adresse IP ou
// un nom local : ce n'est pas un relais générique.

const MAX_OCTETS = 25 * 1024 * 1024
const DELAI_MS = 20000

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody(event).catch(() => null)
  const u = adresseAutorisee(String(body?.url || ''))
  if (!u) throw createError({ statusCode: 400, message: 'Adresse d\'image invalide (https uniquement)' })

  let res: Response
  try {
    res = await fetchWithTimeout(u.toString(), { redirect: 'follow' }, DELAI_MS)
  } catch {
    throw createError({ statusCode: 504, message: "L'hébergeur de l'image ne répond pas" })
  }
  if (!res.ok) throw createError({ statusCode: 502, message: `Image introuvable (HTTP ${res.status})` })
  const annonce = Number(res.headers.get('content-length') || 0)
  if (annonce > MAX_OCTETS) throw createError({ statusCode: 413, message: 'Image trop lourde (25 Mo maximum)' })
  const octets = new Uint8Array(await res.arrayBuffer())
  if (octets.byteLength > MAX_OCTETS) throw createError({ statusCode: 413, message: 'Image trop lourde (25 Mo maximum)' })
  const type = typeImage(octets)
  if (!type) throw createError({ statusCode: 415, message: "Ce lien ne pointe pas vers une image" })

  setHeader(event, 'content-type', type)
  setHeader(event, 'cache-control', 'no-store')
  return octets
})
