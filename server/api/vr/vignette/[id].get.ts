import { fetchWithTimeout } from '../../../utils/http'

// Vignette d'une vidéo YouTube, servie depuis notre domaine pour le mode VR
// (pages/vr.vue) : WebGL n'accepte une image comme texture que si elle est
// de même origine ou servie avec CORS, ce que i.ytimg.com ne garantit pas.
// Seul un identifiant de vidéo est accepté : ce n'est pas un proxy ouvert.
const ID_VIDEO = /^[A-Za-z0-9_-]{11}$/

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') || ''
  if (!ID_VIDEO.test(id)) throw createError({ statusCode: 400, message: 'Identifiant de vidéo invalide' })

  // Tests : aucune sortie vers YouTube, les vidéos factices n'existent pas.
  if (process.env.PW_TEST === '1' || process.env.TEST_ENV === '1') return sendRedirect(event, '/favicon-192.png', 302)

  for (const taille of ['hqdefault', 'mqdefault']) {
    const res = await fetchWithTimeout(`https://i.ytimg.com/vi/${id}/${taille}.jpg`).catch(() => null)
    if (!res?.ok) continue
    setHeader(event, 'content-type', res.headers.get('content-type') || 'image/jpeg')
    setHeader(event, 'cache-control', 'public, max-age=86400')
    return new Uint8Array(await res.arrayBuffer())
  }
  throw createError({ statusCode: 404, message: 'Vignette introuvable' })
})
