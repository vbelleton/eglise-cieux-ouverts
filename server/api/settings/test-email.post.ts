import { getFirestoreConfig, getAccessToken, getFirestoreDoc, parseFirestoreDoc } from '../../utils/firebase'
import { requireAdmin } from '../../utils/firebase-admin'
import { sendEmail } from '../../utils/send-email'

// Bouton « Envoyer un email de test » de ⚙️ Config. Le formulaire de contact
// n'échoue jamais à cause de l'email (le message est déjà enregistré) : un
// envoi refusé par Mailjet ne laissait qu'une ligne dans les logs Cloudflare,
// que l'admin ne voit pas. Ici on renvoie la vraie raison, à un admin
// seulement, pour pouvoir corriger le réglage (adresse non validée, clé
// fausse…) sans fouiller les logs.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const isTest = process.env.NODE_ENV === 'test' || process.env.PW_TEST === '1' || process.env.TEST_ENV === '1'

  let destinataires: string[] = []
  if (isTest) {
    const { getSettings } = await import('../../utils/firestore-mock.js')
    destinataires = getSettings().contactEmails || []
  } else {
    const config = getFirestoreConfig(event)
    if (!config) throw createError({ statusCode: 500, message: 'Firestore non configuré' })
    const accessToken = await getAccessToken(config.clientEmail, config.privateKey)
    const doc = await getFirestoreDoc(config.projectId, accessToken, 'settings', 'config')
    const data = doc ? parseFirestoreDoc(doc) : null
    destinataires = data?.contactEmails?.length ? data.contactEmails : data?.contactEmail ? [data.contactEmail] : []
  }

  if (!destinataires.length) {
    return { ok: false, destinataires, erreur: 'Aucun email de destination enregistré : renseigne « Emails de destination » puis clique Sauvegarder.' }
  }

  const resultat = await sendEmail({
    to: destinataires,
    subject: 'Test du formulaire de contact',
    html: '<p>Cet email de test confirme que les messages du formulaire de contact du site arrivent bien à cette adresse.</p>',
  })
  if (!resultat.ok) console.error('[test-email] échec :', resultat.error)
  return { ok: resultat.ok, destinataires, erreur: resultat.ok ? null : resultat.error }
})
