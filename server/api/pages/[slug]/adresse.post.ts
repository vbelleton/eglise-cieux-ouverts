import { getFirestoreConfig, getAccessToken, getFirestoreDoc, setFirestoreDoc, parseFirestoreDoc } from '../../../utils/firebase'
import { requireAdmin } from '../../../utils/firebase-admin'
import { normaliserAdresse, plannifierDeplacement, adresseOccupee, ADRESSES_RESERVEES } from '../../../../utils/adressePage.js'

// Change l'adresse d'une page créée dans l'admin (bouton « Changer » de
// l'éditeur de menu) : le document pages/<slug> est copié vers la nouvelle
// adresse, et l'ancien devient une redirection 301 (voir utils/adressePage.js).
// Le menu est mis à jour par l'éditeur lui-même, qui l'enregistre ensuite.
export default defineEventHandler(async (event) => {
  const isTest = process.env.NODE_ENV === 'test' || process.env.PW_TEST === '1' || process.env.TEST_ENV === '1'
  const actuelle = getRouterParam(event, 'slug') || ''
  const body = await readBody(event)
  const cible = normaliserAdresse(body?.adresse)

  if (!actuelle || ADRESSES_RESERVEES.includes(actuelle)) {
    throw createError({ statusCode: 400, message: 'L\'adresse de cette page ne peut pas être changée.' })
  }
  if (!cible) {
    throw createError({ statusCode: 400, message: 'Adresse invalide : lettres, chiffres et tirets, sans nom réservé au site.' })
  }
  if (cible === actuelle) return { adresse: cible }

  if (isTest) {
    const { getPages, setPageDoc } = await import('../../../utils/firestore-mock.js')
    if (adresseOccupee(getPages()[cible])) {
      throw createError({ statusCode: 409, message: `L'adresse /${cible} est déjà utilisée par une autre page.` })
    }
    const { nouveauDoc, ancienDoc } = plannifierDeplacement(actuelle, cible, getPages()[actuelle] || null)
    await setPageDoc(cible, nouveauDoc)
    await setPageDoc(actuelle, ancienDoc)
    return { adresse: cible }
  }

  await requireAdmin(event)
  const config = getFirestoreConfig(event)
  if (!config) throw createError({ statusCode: 500, message: 'Firestore non configuré' })

  const token = await getAccessToken(config.clientEmail, config.privateKey)
  const lire = async (slug: string) => {
    const doc = await getFirestoreDoc(config.projectId, token, 'pages', slug)
    return doc ? parseFirestoreDoc(doc) : null
  }
  if (adresseOccupee(await lire(cible))) {
    throw createError({ statusCode: 409, message: `L'adresse /${cible} est déjà utilisée par une autre page.` })
  }
  const { nouveauDoc, ancienDoc } = plannifierDeplacement(actuelle, cible, await lire(actuelle))
  // Nouvelle adresse d'abord : si la seconde écriture échoue, la page reste
  // joignable aux deux adresses, rien n'est perdu.
  await setFirestoreDoc(config.projectId, token, 'pages', cible, nouveauDoc)
  await setFirestoreDoc(config.projectId, token, 'pages', actuelle, ancienDoc)
  return { adresse: cible }
})
