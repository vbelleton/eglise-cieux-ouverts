import { fetchWithTimeout } from './http'

/**
 * Liste des vidéos de la chaîne YouTube de l'église, pour la page cachée
 * `/predications` (moteur de recherche des prédications).
 *
 * Deux sources, de la plus complète à la plus pauvre :
 * - avec une clé YouTube Data API (`NUXT_YOUTUBE_API_KEY`, variable
 *   Cloudflare Pages) : TOUTES les vidéos publiées, par la playlist
 *   « uploads » de la chaîne (1 unité de quota par tranche de 50 vidéos,
 *   sur 10 000 gratuites par jour) ;
 * - sans clé : le flux RSS public de la chaîne, limité par YouTube aux 15
 *   dernières vidéos. La page le signale, pour qu'on ne croie pas que la
 *   recherche porte sur tout l'historique.
 */

export const HANDLE_CHAINE = 'eglisecieuxouverts'

// Identifiant public de la chaîne (visible dans son adresse YouTube) : évite
// de le chercher dans la page de la chaîne, que YouTube remplace par un écran
// de consentement pour les serveurs situés en Europe. `NUXT_YOUTUBE_CHANNEL_ID`
// le remplace si la chaîne change.
export const ID_CHAINE_PAR_DEFAUT = 'UCw7Z4T4UyeVainbb4N895mw'

export interface Video {
  id: string
  titre: string
  description: string
  date: string // ISO
  vignette: string
}

export interface ListeVideos {
  videos: Video[]
  source: 'api' | 'rss'
  complete: boolean
}

const ID_VIDEO = /^[A-Za-z0-9_-]{11}$/
const ID_CHAINE = /^UC[A-Za-z0-9_-]{22}$/

function decoderEntites(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&')
}

function balise(xml: string, nom: string): string {
  const m = xml.match(new RegExp(`<${nom}(?:\\s[^>]*)?>([\\s\\S]*?)</${nom}>`))
  return m ? decoderEntites(m[1].trim()) : ''
}

/** Flux Atom `feeds/videos.xml` → vidéos. Exportée pour les tests. */
export function lireFluxRss(xml: string): Video[] {
  const videos: Video[] = []
  for (const [, entree] of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const id = balise(entree, 'yt:videoId')
    if (!ID_VIDEO.test(id)) continue
    videos.push({
      id,
      titre: balise(entree, 'title'),
      description: balise(entree, 'media:description'),
      date: balise(entree, 'published'),
      vignette: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
    })
  }
  return videos
}

/** Page HTML de la chaîne → identifiant `UC…`. Exportée pour les tests. */
export function idChaineDepuisHtml(html: string): string {
  const m = html.match(/"(?:externalId|channelId)":"(UC[A-Za-z0-9_-]{22})"/)
    || html.match(/youtube\.com\/channel\/(UC[A-Za-z0-9_-]{22})/)
  return m ? m[1] : ''
}

async function json(url: string, headers: Record<string, string> = {}): Promise<any> {
  const r = await fetchWithTimeout(url, { headers })
  if (!r.ok) {
    // Le corps d'erreur de Google donne la raison (clé refusée, API non
    // activée, quota) — utile dans les logs, sans la clé (retirée de l'URL).
    const detail = await r.text().catch(() => '')
    throw new Error(`YouTube ${r.status} sur ${url.split('?')[0]} : ${detail.slice(0, 300)}`)
  }
  return r.json()
}

/** Accès à l'API YouTube Data : clé API, ou jeton OAuth de la chaîne connectée. */
export interface AccesApi { cle?: string, jeton?: string }

async function viaApi(acces: AccesApi, idChaine: string): Promise<Video[]> {
  const k = acces.cle ? `&key=${encodeURIComponent(acces.cle)}` : ''
  const entetes: Record<string, string> = acces.jeton ? { authorization: `Bearer ${acces.jeton}` } : {}
  const filtre = idChaine ? `id=${idChaine}` : `forHandle=${HANDLE_CHAINE}`
  const chaine = await json(`https://www.googleapis.com/youtube/v3/channels?part=contentDetails&${filtre}${k}`, entetes)
  const uploads = chaine?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads
  if (!uploads) throw new Error('Chaîne YouTube introuvable')

  const videos: Video[] = []
  let page = ''
  // 40 pages × 50 = 2 000 vidéos : borne de sécurité, largement au-dessus
  // de ce que publie une église.
  for (let i = 0; i < 40; i++) {
    const data = await json(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${uploads}`
      + (page ? `&pageToken=${encodeURIComponent(page)}` : '') + k,
      entetes,
    )
    for (const it of data?.items || []) {
      const s = it.snippet || {}
      const id = s.resourceId?.videoId
      // Vidéos privées ou supprimées : restent dans la playlist, sans contenu.
      if (!ID_VIDEO.test(id || '') || s.title === 'Private video' || s.title === 'Deleted video') continue
      videos.push({
        id,
        titre: s.title || '',
        description: s.description || '',
        date: s.publishedAt || '',
        vignette: s.thumbnails?.medium?.url || `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
      })
    }
    page = data?.nextPageToken || ''
    if (!page) break
  }
  return videos
}

async function viaRss(idChaine: string): Promise<Video[]> {
  let id = idChaine
  if (!id) {
    const r = await fetchWithTimeout(`https://www.youtube.com/@${HANDLE_CHAINE}`, {
      headers: { 'accept-language': 'fr' },
    })
    if (!r.ok) throw new Error(`YouTube ${r.status} sur la page de la chaîne`)
    id = idChaineDepuisHtml(await r.text())
    if (!id) throw new Error('Identifiant de chaîne introuvable sur la page YouTube')
  }
  const r = await fetchWithTimeout(`https://www.youtube.com/feeds/videos.xml?channel_id=${id}`)
  if (!r.ok) throw new Error(`YouTube ${r.status} sur le flux RSS`)
  return lireFluxRss(await r.text())
}

export function idChaineConfigure(): string {
  const idEnv = (process.env.NUXT_YOUTUBE_CHANNEL_ID || '').trim()
  return ID_CHAINE.test(idEnv) ? idEnv : ID_CHAINE_PAR_DEFAUT
}

/**
 * `jetonOAuth` : renvoie le jeton d'accès de la chaîne connectée (ou null).
 * Il donne la liste complète même sans clé API.
 */
export async function chargerVideos(jetonOAuth?: () => Promise<string | null>): Promise<ListeVideos> {
  const cle = (process.env.NUXT_YOUTUBE_API_KEY || '').trim()
  const idChaine = idChaineConfigure()

  let videos: Video[] | null = null
  let source: ListeVideos['source'] = 'rss'
  // Clé API d'abord, puis jeton de la chaîne connectée (demandé seulement si
  // besoin : chaque jeton coûte un aller-retour vers Google), puis flux RSS.
  const essais: Array<() => Promise<AccesApi | null>> = [
    async () => (cle ? { cle } : null),
    async () => {
      const jeton = jetonOAuth ? await jetonOAuth().catch(() => null) : null
      return jeton ? { jeton } : null
    },
  ]
  for (const essai of essais) {
    const acces = await essai()
    if (!acces) continue
    try {
      videos = await viaApi(acces, idChaine)
      source = 'api'
      break
    } catch (err) {
      // Accès mal configuré : on essaie le suivant, puis le flux RSS.
      console.error('[predications] API YouTube en échec :', err)
    }
  }
  if (!videos) videos = await viaRss(idChaine)
  videos.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  return { videos, source, complete: source === 'api' }
}

// Cache à l'échelle de l'isolat : on garde le RÉSULTAT, jamais une promesse
// partagée entre requêtes. Sur le runtime Workers, une requête qui attend une
// promesse née dans une autre requête peut rester suspendue indéfiniment si
// celle-ci est annulée entre-temps (le visiteur a fermé l'onglet) — la page
// restait alors bloquée sur « Chargement des vidéos… ». Un échec n'est pas
// mémorisé.
const DUREE_CACHE_MS = 30 * 60 * 1000
let enCache: { liste: ListeVideos, expire: number } | null = null

export async function videosEnCache(jetonOAuth?: () => Promise<string | null>): Promise<ListeVideos> {
  if (process.env.PW_TEST === '1' || process.env.NODE_ENV === 'test') {
    // Tests : jamais d'appel à YouTube.
    const { VIDEOS_TEST } = await import('./youtube-mock.js')
    return { videos: VIDEOS_TEST, source: 'api', complete: true }
  }
  if (enCache && enCache.expire > Date.now()) return enCache.liste
  const liste = await chargerVideos(jetonOAuth)
  enCache = { liste, expire: Date.now() + DUREE_CACHE_MS }
  return liste
}
