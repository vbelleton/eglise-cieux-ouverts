import { requireAdmin } from '../../../utils/firebase-admin'
import { indexer } from '../../../utils/youtube-chaine'

// Récupère les sous-titres de quelques vidéos ; l'admin rappelle tant qu'il en
// reste (bouton « Récupérer les sous-titres » de ⚙ Config). Peu de vidéos par
// appel : chaque requête reste courte, et un quota épuisé arrête proprement.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return await indexer(event, 3)
})
