import { requireAdmin } from '../../utils/firebase-admin'
import { lireImagesSiteMasquees } from '../../utils/media-store'

// Images du dossier public/ retirées de la médiathèque (elles restent sur le
// site : seules les pages qui les utilisent encore les affichent).
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return { hidden: await lireImagesSiteMasquees(event) }
})
