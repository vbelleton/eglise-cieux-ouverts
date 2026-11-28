import { reponsePageDepuisDoc } from '../../../utils/adressePage.js'
export default defineEventHandler(async (event) => {
  // En mode test (CI ou local), le mock prime TOUJOURS sur Firestore :
  // sinon les tests locaux (où .env a de vrais credentials) tapent la
  // vraie base et deviennent non déterministes
  const isTest = process.env.NODE_ENV === 'test' || process.env.PW_TEST === '1' || process.env.TEST_ENV === '1'
  if (isTest) {
    const { getPages } = await import('../../utils/firestore-mock.js')
    const slug = getRouterParam(event, 'slug') || 'accueil'
    return reponsePageDepuisDoc(slug, getPages()[slug] || null)
  }

  const config = useRuntimeConfig(event)
  const projectId = (process.env.NUXT_FIREBASE_PROJECT_ID || config.firebaseProjectId) as string
  const clientEmail = (process.env.NUXT_FIREBASE_CLIENT_EMAIL || config.firebaseClientEmail) as string
  const privateKey = (process.env.NUXT_FIREBASE_PRIVATE_KEY || config.firebasePrivateKey) as string

  if (!projectId || !clientEmail || !privateKey) {
    // Config absente : impossible de savoir si la page existe -> pas de 404
    // (exists:true), le frontend utilise getDefaultHomePage() etc.
    return { blocks: [], exists: true }
  }

  const slug = getRouterParam(event, 'slug')
  if (!slug) {
    throw createError({ statusCode: 400, message: 'Slug manquant.' })
  }

  try {
    const accessToken = await getAccessToken(clientEmail, privateKey)
    const doc = await getFirestoreDoc(projectId, accessToken, 'pages', slug)

    if (!doc) {
      // Jamais de null pour blocks ! ⇒ fallback neutre, UI toujours fonctionnelle
      // exists:false -> pages/[slug].vue peut renvoyer une vraie 404 pour
      // un slug réellement inconnu (les pages statiques comme /contact ne
      // passent jamais par ce endpoint via [slug].vue).
      return reponsePageDepuisDoc(slug, null)
    }

    // Une page soft-deleted (_deleted, cf. DELETE /api/pages/:slug) compte
    // comme inexistante pour le routage public ; un document déplacé renvoie
    // sa nouvelle adresse (voir utils/adressePage.js).
    return reponsePageDepuisDoc(slug, parseFirestoreDoc(doc))
  } catch (err) {
    console.error('Page API error:', err)
    throw createError({ statusCode: 500, message: 'Erreur lors du chargement de la page.' })
  }
})
