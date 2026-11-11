import { fetchWithTimeout } from '../../../utils/http'
import { getMediaStore } from '../../../utils/media-store'
import { TABLEAU_PAR_CLE } from '../../../../utils/vrTableaux.js'

// Image d'un tableau de la salle de prière VR (utils/vrTableaux.js), servie
// depuis notre domaine (WebGL n'accepte que des textures de même origine ou
// servies avec CORS). Seules les clés de la liste sont acceptées : ce n'est
// pas un proxy ouvert. L'œuvre est cherchée sur Wikimedia Commons ; on ne
// retient qu'une reproduction marquée domaine public, assez grande et qui
// n'est pas un détail. Mise en cache dans le KV (`vr-tableaux/`) : Commons
// n'est sollicité qu'une fois par tableau.

const COMMONS = 'https://commons.wikimedia.org/w/api.php'
// Wikimedia demande un User-Agent qui identifie l'outil.
const UA = 'SalleDePriereVR/1.0 (+https://www.cieuxouverts.bzh/vr)'
const LIBRE = /public domain|domaine public|^pd\b|cc0/i

async function chercher(recherche: string): Promise<string | null> {
  const u = new URL(COMMONS)
  const params: Record<string, string> = {
    action: 'query',
    format: 'json',
    generator: 'search',
    gsrsearch: `${recherche} filetype:bitmap`,
    gsrnamespace: '6',
    gsrlimit: '8',
    prop: 'imageinfo',
    iiprop: 'url|size|extmetadata',
    iiurlwidth: '960',
    iiextmetadatafilter: 'LicenseShortName',
  }
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v)
  const res = await fetchWithTimeout(u.toString(), { headers: { 'User-Agent': UA } })
  if (!res.ok) return null
  const data: any = await res.json()
  const pages = Object.values(data?.query?.pages || {}).sort((a: any, b: any) => a.index - b.index) as any[]
  for (const p of pages) {
    const ii = p.imageinfo?.[0]
    if (!ii?.thumburl) continue
    if (/detail|détail|dettaglio|ausschnitt/i.test(p.title)) continue
    if (!LIBRE.test(String(ii.extmetadata?.LicenseShortName?.value || ''))) continue
    const ratio = ii.width / ii.height
    if (ii.width < 700 || ratio < 0.4 || ratio > 2.8) continue
    return ii.thumburl
  }
  return null
}

export default defineEventHandler(async (event) => {
  const cle = getRouterParam(event, 'cle') || ''
  const tableau = TABLEAU_PAR_CLE[cle]
  if (!tableau) throw createError({ statusCode: 404, message: 'Tableau inconnu' })

  // Tests : aucune sortie vers Wikimedia.
  if (process.env.PW_TEST === '1' || process.env.TEST_ENV === '1') return sendRedirect(event, '/images/activites-priere.jpg', 302)

  const envoyer = (body: ArrayBuffer, type: string) => {
    setHeader(event, 'content-type', type)
    setHeader(event, 'cache-control', 'public, max-age=604800')
    return new Uint8Array(body)
  }

  let magasin = null
  try {
    magasin = getMediaStore(event)
  } catch {
    // Pas de KV : on sert sans cache.
  }
  const cleKV = `vr-tableaux/${cle}`
  const enCache = await magasin?.get(cleKV).catch(() => null)
  if (enCache) return envoyer(enCache.body, enCache.contentType)

  const url = await chercher(tableau.recherche).catch(() => null)
  if (!url) throw createError({ statusCode: 404, message: 'Tableau introuvable' })
  const img = await fetchWithTimeout(url, { headers: { 'User-Agent': UA } }, 15000).catch(() => null)
  if (!img?.ok) throw createError({ statusCode: 502, message: 'Tableau indisponible' })
  const type = img.headers.get('content-type') || 'image/jpeg'
  if (!type.startsWith('image/')) throw createError({ statusCode: 502, message: 'Réponse inattendue' })
  const body = await img.arrayBuffer()
  await magasin?.put(cleKV, body, type).catch(() => {})
  return envoyer(body, type)
})
