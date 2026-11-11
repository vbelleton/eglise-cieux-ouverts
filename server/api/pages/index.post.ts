import { getFirestoreConfig, getAccessToken, setFirestoreDoc } from '../../utils/firebase'
import { requireAdmin } from '../../utils/firebase-admin'
import { HARDCODED_SLUGS } from '../../../utils/blockTypes.js'

function sanitizeSlug(rawSlug: string): string {
  return String(rawSlug).toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/^-+|-+$/g, '')
}

// HARDCODED_SLUGS (accueil, contact, messages, event-list, agenda, photos) :
// ces routes ont leur propre fichier pages/*.vue, une page custom créée
// avec le même slug serait enregistrée en Firestore mais jamais rendue
// nulle part (l'URL reste capturée par le fichier statique) — on bloque
// donc leur création à la source plutôt que de laisser un piège silencieux.
const RESERVED_SLUGS = ['admin', 'api', '_nuxt', 'favicon.ico', 'robots.txt', 'predications', 'vr', ...HARDCODED_SLUGS]

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  if (!body || !body.slug) {
    throw createError({ statusCode: 400, message: 'Slug manquant' })
  }

  const slug = sanitizeSlug(body.slug)
  if (!slug) {
    throw createError({ statusCode: 400, message: 'Slug invalide' })
  }

  if (RESERVED_SLUGS.includes(slug)) {
    throw createError({ statusCode: 400, message: 'Ce slug est réservé' })
  }

  const title = body.title?.trim() || slug

  // En mode test, crée dans le mock RAM — jamais dans la vraie base
  const isTest = process.env.NODE_ENV === 'test' || process.env.PW_TEST === '1' || process.env.TEST_ENV === '1'
  if (isTest) {
    const { setPageDoc } = await import('../../utils/firestore-mock.js')
    await setPageDoc(slug, {
      title,
      blocks: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      updatedBy: 'test',
    })
    return { success: true, slug }
  }

  const config = getFirestoreConfig(event)
  if (!config) {
    throw createError({ statusCode: 500, message: 'Firestore non configuré' })
  }

  const userInfo = await requireAdmin(event)

  try {
    const accessToken = await getAccessToken(config.clientEmail, config.privateKey)

    await setFirestoreDoc(config.projectId, accessToken, 'pages', slug, {
      title,
      blocks: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      updatedBy: userInfo.email || 'inconnu',
    })

    return { success: true, slug }
  } catch (err: any) {
    console.error('Page create error:', err)
    throw createError({ statusCode: 500, message: `Erreur lors de la création: ${err.message || err}` })
  }
})
