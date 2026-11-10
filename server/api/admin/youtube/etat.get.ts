import { requireAdmin } from '../../../utils/firebase-admin'
import { indexer } from '../../../utils/youtube-chaine'

// État de la chaîne connectée et de la récupération des sous-titres (⚙ Config).
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  try {
    return await indexer(event, 0)
  } catch (err: any) {
    return { configure: false, connecte: false, traitees: 0, avecParoles: 0, restantes: 0, pauseQuota: null, derniereErreur: String(err?.message || err).slice(0, 300) }
  }
})
