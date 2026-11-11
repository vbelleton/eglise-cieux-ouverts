import { getFirestoreConfig, getAccessToken, getFirestoreDoc, parseFirestoreDoc } from '../../utils/firebase'
import { normaliserReglagesVR } from '../../../utils/vrReglages.js'
import { lireImagesSiteMasquees } from '../../utils/media-store'

// Lecture publique (la page /vr en a besoin) : ne contient que des choix
// d'affichage et des adresses d'images déjà publiques.
// `lu: false` quand la lecture a échoué : l'admin ne doit alors pas pouvoir
// enregistrer par-dessus des valeurs qu'il n'a pas vues (cf. CLAUDE.md,
// « ne jamais sauvegarder ce qu'on n'a pas réussi à lire »).
// `imagesRetirees` : images du site « supprimées » dans la Médiathèque. La
// salle ne les montre plus non plus (sinon une photo introuvable dans la
// Médiathèque restait affichée en VR). Ce ne sont que des chemins d'images
// publiques ; elles ne sont pas enregistrées avec les réglages.
async function imagesRetirees(event: any): Promise<string[]> {
  try {
    return await lireImagesSiteMasquees(event)
  } catch {
    return []
  }
}

export default defineEventHandler(async (event) => {
  const retirees = await imagesRetirees(event)
  const isTest = process.env.NODE_ENV === 'test' || process.env.PW_TEST === '1' || process.env.TEST_ENV === '1'
  if (isTest) {
    const { getVrReglages } = await import('../../utils/firestore-mock.js')
    return { ...normaliserReglagesVR(getVrReglages()), lu: true, imagesRetirees: retirees }
  }

  const config = getFirestoreConfig(event)
  if (!config) return { ...normaliserReglagesVR(null), lu: false, imagesRetirees: retirees }
  try {
    const accessToken = await getAccessToken(config.clientEmail, config.privateKey)
    const doc = await getFirestoreDoc(config.projectId, accessToken, 'settings', 'vr')
    return { ...normaliserReglagesVR(doc ? parseFirestoreDoc(doc) : null), lu: true, imagesRetirees: retirees }
  } catch (err: any) {
    console.error('[vr] lecture des réglages:', err)
    return { ...normaliserReglagesVR(null), lu: false, imagesRetirees: retirees }
  }
})
