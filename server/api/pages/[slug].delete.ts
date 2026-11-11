import { getFirestoreConfig, getAccessToken, getFirestoreDoc, setFirestoreDoc } from '../../utils/firebase'
import { requireAdmin } from '../../utils/firebase-admin'
import { HARDCODED_SLUGS } from '../../../utils/blockTypes.js'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  if (!slug) {
    throw createError({ statusCode: 400, message: 'Slug manquant' })
  }

  // Les pages statiques (accueil, contact, messages, event-list, agenda,
  // photos) ne sont pas des "custom pages" supprimables : soft-delete leur
  // doc Firestore effacerait le vrai contenu édité de ces pages (title
  // conservé mais blocks:[] écrasés), pas juste retirer une page fantôme.
  const reservedSlugs = ['admin', 'api', '_nuxt', 'favicon.ico', 'robots.txt', 'predications', 'vr', ...HARDCODED_SLUGS]
  if (reservedSlugs.includes(slug)) {
    throw createError({ statusCode: 400, message: 'Impossible de supprimer cette page' })
  }

  // En mode test, soft-delete dans le mock RAM — jamais dans la vraie base
  const isTest = process.env.NODE_ENV === 'test' || process.env.PW_TEST === '1' || process.env.TEST_ENV === '1'
  if (isTest) {
    const { getPageDoc, setPageDoc, getMenuMock, setMenuMock } = await import('../../utils/firestore-mock.js')
    const current = await getPageDoc(slug)
    await setPageDoc(slug, {
      ...current,
      _deleted: true,
      blocks: [],
      updatedAt: new Date().toISOString(),
      updatedBy: 'test',
    })

    // Nettoyer le menu du mock aussi
    try {
      const menuData = getMenuMock()?.menuItems || []
      const cleanedMenu = (menuData as any[])
        .map((item: any) => ({
          ...item,
          children: item.children?.filter((child: any) => child.to !== `/${slug}`) || []
        }))
        .filter((item: any) => item.to !== `/${slug}`)

      if (JSON.stringify(menuData) !== JSON.stringify(cleanedMenu)) {
        setMenuMock({ menuItems: cleanedMenu, menuBgImage: '' })
      }
    } catch (menuErr) {
      console.warn('Failed to clean menu item in mock:', menuErr)
    }

    return { success: true }
  }

  const config = getFirestoreConfig(event)
  if (!config) {
    throw createError({ statusCode: 500, message: 'Firestore non configuré' })
  }

  const userInfo = await requireAdmin(event)

  try {
    const accessToken = await getAccessToken(config.clientEmail, config.privateKey)

    const doc = await getFirestoreDoc(config.projectId, accessToken, 'pages', slug)
    if (!doc) {
      throw createError({ statusCode: 404, message: 'Page introuvable' })
    }

    // updateMask : conserve title/createdAt pour une éventuelle restauration
    await setFirestoreDoc(config.projectId, accessToken, 'pages', slug, {
      _deleted: true,
      blocks: [],
      updatedAt: new Date().toISOString(),
      updatedBy: userInfo.email || 'inconnu',
    }, ['_deleted', 'blocks', 'updatedAt', 'updatedBy'])

    // Nettoyer le menu : retirer l'item qui référence cette page
    try {
      const { parseFirestoreDoc } = await import('../../utils/firebase')
      const menuDoc = await getFirestoreDoc(config.projectId, accessToken, 'settings', 'menu')
      const menuData = menuDoc ? parseFirestoreDoc(menuDoc)?.menuItems || [] : []

      const cleanedMenu = (menuData as any[])
        .map((item: any) => ({
          ...item,
          children: item.children?.filter((child: any) => child.to !== `/${slug}`) || []
        }))
        .filter((item: any) => item.to !== `/${slug}`)

      if (JSON.stringify(menuData) !== JSON.stringify(cleanedMenu)) {
        await setFirestoreDoc(config.projectId, accessToken, 'settings', 'menu', {
          menuItems: cleanedMenu,
        }, ['menuItems'])
      }
    } catch (menuErr) {
      // Ne pas bloquer la suppression si le menu ne peut pas être nettoyé
      console.warn('Failed to clean menu item:', menuErr)
    }

    return { success: true }
  } catch (err: any) {
    console.error('Page delete error:', err)
    throw createError({ statusCode: 500, message: `Erreur lors de la suppression: ${err.message || err}` })
  }
})
