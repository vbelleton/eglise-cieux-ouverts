import { requireAdmin } from '../../../utils/firebase-admin'
import { deconnecter } from '../../../utils/youtube-chaine'

// Oublie l'accès à la chaîne. Les paroles déjà récupérées restent.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  await deconnecter(event)
  return { ok: true }
})
