import { getFirestoreConfig, getAccessToken, getFirestoreDoc, parseFirestoreDoc } from '../../utils/firebase'
import { normaliserReglagesVR } from '../../../utils/vrReglages.js'

// Lecture publique (la page /vr en a besoin) : ne contient que des choix
// d'affichage et des adresses d'images déjà publiques.
// `lu: false` quand la lecture a échoué : l'admin ne doit alors pas pouvoir
// enregistrer par-dessus des valeurs qu'il n'a pas vues (cf. CLAUDE.md,
// « ne jamais sauvegarder ce qu'on n'a pas réussi à lire »).
export default defineEventHandler(async (event) => {
  const isTest = process.env.NODE_ENV === 'test' || process.env.PW_TEST === '1' || process.env.TEST_ENV === '1'
  if (isTest) {
    const { getVrReglages } = await import('../../utils/firestore-mock.js')
    return { ...normaliserReglagesVR(getVrReglages()), lu: true }
  }

  const config = getFirestoreConfig(event)
  if (!config) return { ...normaliserReglagesVR(null), lu: false }
  try {
    const accessToken = await getAccessToken(config.clientEmail, config.privateKey)
    const doc = await getFirestoreDoc(config.projectId, accessToken, 'settings', 'vr')
    return { ...normaliserReglagesVR(doc ? parseFirestoreDoc(doc) : null), lu: true }
  } catch (err: any) {
    console.error('[vr] lecture des réglages:', err)
    return { ...normaliserReglagesVR(null), lu: false }
  }
})
