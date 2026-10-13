import { requireAdmin } from '../../utils/firebase-admin'
import { ecrireImagesSiteMasquees } from '../../utils/media-store'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody(event)
  const liste = Array.isArray(body?.hidden) ? body.hidden : null
  if (!liste) throw createError({ statusCode: 400, message: 'Liste invalide' })
  const propres = [...new Set<string>(liste.filter((c: unknown): c is string => typeof c === 'string'))]
  if (propres.some(c => !/^\/[A-Za-z0-9._\/-]+$/.test(c) || c.includes('..'))) {
    throw createError({ statusCode: 400, message: 'Chemin invalide' })
  }
  await ecrireImagesSiteMasquees(event, propres)
  return { hidden: propres }
})
