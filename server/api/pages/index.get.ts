import { ADRESSE_DONS_DEFAUT } from '../../../utils/adressePage.js'

import { getFirestoreConfig, getAccessToken, listFirestoreCollection, parseFirestoreDoc } from '../../utils/firebase'

export default defineEventHandler(async (event) => {
  // En mode test, liste le mock RAM — jamais la vraie base
  const isTest = process.env.NODE_ENV === 'test' || process.env.PW_TEST === '1' || process.env.TEST_ENV === '1'
  if (isTest) {
    const { getPages } = await import('../../utils/firestore-mock.js')
    const pages = Object.entries(getPages()).map(([slug, data]: [string, any]) => ({
      slug,
      title: data.title || slug,
      updatedAt: data.updatedAt || null,
      updatedBy: data.updatedBy || null,
      blockCount: data.blocks?.length || 0,
      _deleted: data._deleted || false,
    }))
    return { pages: avecPageDons(pages) }
  }

  const config = getFirestoreConfig(event)
  if (!config) {
    return { pages: [] }
  }

  try {
    const accessToken = await getAccessToken(config.clientEmail, config.privateKey)
    const docs = await listFirestoreCollection(config.projectId, accessToken, 'pages')
    const pages = (docs || [])
      .map((doc: any) => {
        const data = parseFirestoreDoc(doc)
        if (!data) return null
        return {
          slug: doc.name?.split('/').pop() || '',
          title: data.title || data.slug || doc.name?.split('/').pop() || '',
          updatedAt: data.updatedAt || null,
          updatedBy: data.updatedBy || null,
          blockCount: data.blocks?.length || 0,
          _deleted: data._deleted || false,
        }
      })
      .filter(Boolean)
    return { pages: avecPageDons(pages) }
  } catch (err: any) {
    console.error('List pages error:', err)
    return { pages: [] }
  }
})

// La page de dons existe (contenu de départ) avant d'être enregistrée : on la
// liste pour qu'elle apparaisse dans l'éditeur de menu et le sélecteur de pages.
function avecPageDons(pages: any[]) {
  if (pages.some((p) => p.slug === ADRESSE_DONS_DEFAUT)) return pages
  return [...pages, { slug: ADRESSE_DONS_DEFAUT, title: 'Dons', updatedAt: null, updatedBy: null, blockCount: 0, _deleted: false }]
}
