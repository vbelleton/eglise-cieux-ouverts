import { requireAdmin } from '../../../utils/firebase-admin'
import { urlConnexion } from '../../../utils/youtube-chaine'

// Adresse d'autorisation Google vers laquelle l'admin est envoyé pour
// connecter la chaîne YouTube de l'église.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return { url: await urlConnexion(event) }
})
