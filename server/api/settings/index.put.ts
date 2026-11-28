import { getFirestoreConfig, getAccessToken, setFirestoreDoc } from '../../utils/firebase'
import { requireAdmin } from '../../utils/firebase-admin'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Accepte soit un tableau (contactEmails), soit l'ancien format legacy
// (contactEmail: string) — normalise, dédoublonne et valide.
function parseContactEmails(body: any): string[] {
  const raw = Array.isArray(body?.contactEmails)
    ? body.contactEmails
    : typeof body?.contactEmails === 'string'
      ? body.contactEmails.split(/[,\n]/)
      : body?.contactEmail
        ? [body.contactEmail]
        : []

  const emails = [...new Set(
    raw.map((e: string) => String(e).trim().toLowerCase()).filter(Boolean)
  )] as string[]

  return emails
}

// Réseaux sociaux : réglage global (voir index.get.ts) — filtre les entrées
// incomplètes (platform/url vides) plutôt que de rejeter toute la requête,
// pour rester tolérant à une ligne laissée vide dans l'UI de gestion.
function parseSocialLinks(body: any): { platform: string; url: string }[] {
  if (!Array.isArray(body?.socialLinks)) return []
  return body.socialLinks
    .map((l: any) => ({ platform: String(l?.platform || '').trim(), url: String(l?.url || '').trim() }))
    .filter((l: { platform: string; url: string }) => l.platform && l.url)
}

const MEMBER_TABS = ['ressources', 'demandes', 'evenements']

// Ordre des onglets de l'espace membre (pages/membre.vue) — n'accepte qu'une
// permutation complète des 3 clés connues, sinon retombe sur l'ordre
// historique (voir normalizeMemberTabOrder côté GET, même garde-fou).
function parseMemberTabOrder(body: any): string[] {
  const order = body?.memberTabOrder
  if (
    Array.isArray(order) &&
    order.length === MEMBER_TABS.length &&
    MEMBER_TABS.every((t) => order.includes(t))
  ) {
    return order
  }
  return MEMBER_TABS
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const isTest = process.env.NODE_ENV === 'test' || process.env.PW_TEST === '1' || process.env.TEST_ENV === '1'
  const contactEmails = parseContactEmails(body)

  if (contactEmails.length === 0) {
    throw createError({ statusCode: 400, message: 'Au moins un email de contact est requis' })
  }
  const invalid = contactEmails.find(e => !EMAIL_RE.test(e))
  if (invalid) {
    throw createError({ statusCode: 400, message: `Email invalide : ${invalid}` })
  }

  const hideEventsPageIfEmpty = body?.hideEventsPageIfEmpty === true // par défaut false (toujours visible)
  const espaceMembre = body?.espaceMembre === true // par défaut false (espace membre masqué)
  const socialLinks = parseSocialLinks(body)
  const memberTabOrder = parseMemberTabOrder(body)

  if (isTest) {
    const { setSettings } = await import('../../utils/firestore-mock.js')
    setSettings({ contactEmails, hideEventsPageIfEmpty, espaceMembre, socialLinks, memberTabOrder })
    return { ok: true }
  }

  // Authentification AVANT toute autre vérification : placée après le contrôle
  // de configuration Firestore, elle renvoyait « Firestore non configuré »
  // (500) à un appelant anonyme sur une instance mal configurée — une réponse
  // qui renseigne sur l'état du serveur avant même d'avoir vérifié qui appelle.
  await requireAdmin(event)

  const config = getFirestoreConfig(event)
  if (!config) {
    throw createError({ statusCode: 500, message: 'Firestore non configuré' })
  }

  try {
    const accessToken = await getAccessToken(config.clientEmail, config.privateKey)
    await setFirestoreDoc(config.projectId, accessToken, 'settings', 'config', {
      contactEmails: contactEmails,
      hideEventsPageIfEmpty: hideEventsPageIfEmpty,
      espaceMembre: espaceMembre,
      socialLinks: socialLinks,
      memberTabOrder: memberTabOrder,
      updatedAt: new Date().toISOString(),
    })
    return { ok: true }
  } catch (err: any) {
    console.error('Settings update error:', err)
    throw createError({ statusCode: 500, message: `Erreur: ${err.message || err}` })
  }
})
