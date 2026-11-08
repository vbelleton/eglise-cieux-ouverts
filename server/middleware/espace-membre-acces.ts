import { lireReglagesEspaceMembre } from '../utils/espace-membre'
import { verifyFirebaseToken } from '../utils/firebase-admin'

// Verrou serveur de l'espace membre (voir server/utils/espace-membre.ts) :
// tous les proxies /api/member/* passent ici avant d'atteindre le Worker
// eglise-app. Ouvert → on laisse passer ; mode test → seuls les e-mails de la
// liste des testeurs ; fermé → personne.
export default defineEventHandler(async (event) => {
  const path = event.path || ''
  if (!path.startsWith('/api/member/')) return

  const { ouvert, testeurs } = await lireReglagesEspaceMembre(event)
  if (ouvert) return

  const refus = () => createError({ statusCode: 403, message: "L'espace membre n'est pas encore ouvert" })
  if (testeurs.length === 0) throw refus()

  const auth = getRequestHeader(event, 'Authorization') || ''
  if (!auth.startsWith('Bearer ')) throw createError({ statusCode: 401, message: 'Non authentifié' })
  const info = await verifyFirebaseToken(auth.slice(7), event)
  if (!info?.email) throw createError({ statusCode: 401, message: 'Non authentifié' })
  if (!testeurs.includes(info.email.toLowerCase())) throw refus()
})
