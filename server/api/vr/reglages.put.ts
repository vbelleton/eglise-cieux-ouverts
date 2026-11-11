import { getFirestoreConfig, getAccessToken, setFirestoreDoc } from '../../utils/firebase'
import { requireAdmin } from '../../utils/firebase-admin'
import { normaliserReglagesVR } from '../../../utils/vrReglages.js'

export default defineEventHandler(async (event) => {
  const isTest = process.env.NODE_ENV === 'test' || process.env.PW_TEST === '1' || process.env.TEST_ENV === '1'
  const reglages = normaliserReglagesVR(await readBody(event))

  if (isTest) {
    const { setVrReglages } = await import('../../utils/firestore-mock.js')
    setVrReglages(reglages)
    return { ok: true, ...reglages }
  }

  await requireAdmin(event)
  const config = getFirestoreConfig(event)
  if (!config) throw createError({ statusCode: 500, message: 'Firestore non configuré' })
  try {
    const accessToken = await getAccessToken(config.clientEmail, config.privateKey)
    await setFirestoreDoc(config.projectId, accessToken, 'settings', 'vr', { ...reglages, updatedAt: new Date().toISOString() })
    return { ok: true, ...reglages }
  } catch (err: any) {
    console.error('[vr] enregistrement des réglages:', err)
    throw createError({ statusCode: 500, message: `Erreur: ${err.message || err}` })
  }
})
