import { videosEnCache } from '../utils/youtube'

// Vidéos de la chaîne YouTube pour la page cachée /predications.
// Lecture publique (les vidéos le sont déjà sur YouTube), pas de Firestore.
export default defineEventHandler(async (event) => {
  const isTest = process.env.NODE_ENV === 'test' || process.env.PW_TEST === '1' || process.env.TEST_ENV === '1'
  if (isTest) {
    const { VIDEOS_TEST } = await import('../utils/youtube-mock.js')
    return { videos: VIDEOS_TEST, source: 'api', complete: true }
  }
  try {
    const liste = await videosEnCache()
    setHeader(event, 'cache-control', 'public, max-age=600')
    return liste
  } catch (err: any) {
    // La cause est renvoyée telle quelle (statut YouTube, délai dépassé…) :
    // elle ne contient jamais la clé (retirée des URL dans youtube.ts) et sert
    // à diagnostiquer depuis le navigateur sans ouvrir les journaux Cloudflare.
    console.error('[predications]', err)
    throw createError({ statusCode: 502, message: `Impossible de charger les vidéos YouTube : ${String(err?.message || err).slice(0, 400)}` })
  }
})
