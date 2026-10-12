import { getFirestoreConfig, getAccessToken, getFirestoreDoc, parseFirestoreDoc } from '../../utils/firebase'
import { callerIsAdmin } from '../../utils/firebase-admin'

// Cet endpoint est PUBLIC : les pages vitrines y lisent socialLinks,
// memberTabOrder et hideEventsPageIfEmpty sans être authentifiées. Il
// renvoyait aussi `contactEmails`, c'est-à-dire les adresses de destination
// du formulaire de contact — l'adresse personnelle du responsable était donc
// lisible par n'importe qui (moisson de spam). Aucun consommateur public n'en
// a besoin : seule la modale Configuration de AdminToolbar.vue l'utilise. Le
// champ n'est donc joint qu'à un appelant authentifié ayant un rôle admin —
// via `callerIsAdmin`, contrôle non bloquant : un visiteur anonyme doit
// continuer à recevoir 200 avec le reste des réglages, pas un 401.

// Normalise le champ email : accepte le nouveau format (contactEmails: string[])
// et l'ancien format legacy (contactEmail: string) pour les documents Firestore
// existants écrits avant l'introduction des emails multiples.
function normalizeContactEmails(data: Record<string, any> | null): string[] {
  if (data?.contactEmails?.length) return data.contactEmails
  if (data?.contactEmail) return [data.contactEmail]
  return [process.env.CONTACT_EMAIL || 'contact@example.com']
}

// Réseaux sociaux : réglage GLOBAL (un seul jeu de liens pour tout le site —
// SiteHeader.vue, BlockContact.vue, BlockBienvenue.vue affichaient
// auparavant les mêmes URLs codées en dur indépendamment à 3 endroits,
// risque d'incohérence si on en changeait une sans les autres). Défaut =
// anciennes valeurs codées en dur, pour que les sites existants gardent le
// même rendu tant que l'admin n'a pas explicitement modifié ce réglage.
function normalizeSocialLinks(data: Record<string, any> | null): { platform: string; url: string }[] {
  if (Array.isArray(data?.socialLinks)) return data.socialLinks
  return [
    { platform: 'instagram', url: 'https://www.instagram.com/eglise_cieux_ouverts/' },
    { platform: 'facebook', url: 'https://www.facebook.com/eglisecieuxouverts' },
  ]
}

const MEMBER_TABS = ['ressources', 'demandes', 'evenements']

// Ordre des onglets de l'espace membre (pages/membre.vue) — réglable depuis
// l'admin. On ne fait confiance qu'à un tableau contenant exactement les 3
// clés connues (une seule fois chacune) ; sinon on retombe sur l'ordre
// historique codé en dur, pour ne jamais faire disparaître un onglet à
// cause d'une valeur Firestore corrompue/partielle.
function normalizeMemberTabOrder(data: Record<string, any> | null): string[] {
  const order = data?.memberTabOrder
  if (
    Array.isArray(order) &&
    order.length === MEMBER_TABS.length &&
    MEMBER_TABS.every((t) => order.includes(t))
  ) {
    return order
  }
  return MEMBER_TABS
}

// Réponse publique + `contactEmails` uniquement si l'appelant est admin.
function buildResponse(data: Record<string, any> | null, isAdmin: boolean) {
  return {
    hideEventsPageIfEmpty: data?.hideEventsPageIfEmpty === true,
    // Espace membre (comptes, /membre) : désactivé tant que l'admin ne l'a
    // pas explicitement activé dans ⚙️ Config.
    espaceMembre: data?.espaceMembre === true,
    socialLinks: normalizeSocialLinks(data),
    memberTabOrder: normalizeMemberTabOrder(data),
    ...(isAdmin ? { contactEmails: normalizeContactEmails(data) } : {}),
  }
}

export default defineEventHandler(async (event) => {
  const isTest = process.env.NODE_ENV === 'test' || process.env.PW_TEST === '1' || process.env.TEST_ENV === '1'
  const isAdmin = await callerIsAdmin(event)

  if (isTest) {
    const { getSettings } = await import('../../utils/firestore-mock.js')
    return buildResponse(getSettings(), isAdmin)
  }

  const config = getFirestoreConfig(event)
  if (!config) {
    return buildResponse(null, isAdmin)
  }

  try {
    const accessToken = await getAccessToken(config.clientEmail, config.privateKey)
    const doc = await getFirestoreDoc(config.projectId, accessToken, 'settings', 'config')
    return buildResponse(doc ? parseFirestoreDoc(doc) : null, isAdmin)
  } catch (err: any) {
    console.error('Settings load error:', err)
    return buildResponse(null, isAdmin)
  }
})
