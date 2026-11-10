import { fetchWithTimeout } from './http'
import { getMediaStore } from './media-store'
import { choisirPiste, lireSousTitres, ligneParoles } from './sous-titres'
import { idChaineConfigure, videosEnCache } from './youtube'

/**
 * Chaîne YouTube connectée au site (autorisation Google du propriétaire) :
 * seule façon autorisée de télécharger les sous-titres, y compris les
 * automatiques, pour la recherche dans les paroles des prédications.
 *
 * Réglages Cloudflare Pages (Production) :
 * - NUXT_YOUTUBE_OAUTH_CLIENT_ID / NUXT_YOUTUBE_OAUTH_CLIENT_SECRET :
 *   identifiant OAuth « Application Web » du projet Google Cloud, avec pour
 *   URI de redirection `${SITE_URL}/api/youtube/oauth`.
 *
 * Tout est rangé dans l'espace KV `IMAGES`, sous `youtube/` — jamais servi
 * tel quel : `/api/media/*` n'accepte que `uploads/` (cleMedia).
 * - youtube/oauth.json   : jeton de renouvellement (secret)
 * - youtube/etat.json    : vidéos déjà traitées
 * - youtube/paroles.ndjson : une ligne JSON par vidéo { id, p: [[s, texte]] }
 */

const CLE_OAUTH = 'youtube/oauth.json'
const CLE_ETAT_OAUTH = 'youtube/oauth-state.json'
const CLE_ETAT = 'youtube/etat.json'
export const CLE_PAROLES = 'youtube/paroles.ndjson'

const PORTEE = 'https://www.googleapis.com/auth/youtube.force-ssl'
// Une vidéo sans sous-titres (automatiques pas encore générés) est retentée
// après ce délai.
const RETENTE_SANS_SOUS_TITRES_MS = 3 * 24 * 3600 * 1000
// Quota YouTube épuisé : on ne réessaie pas avant ce délai.
const PAUSE_QUOTA_MS = 6 * 3600 * 1000

const encodeur = new TextEncoder()
const decodeur = new TextDecoder()

function toBuffer(texte: string): ArrayBuffer {
  return encodeur.encode(texte).buffer as ArrayBuffer
}

async function lireJson<T>(event: any, cle: string, defaut: T): Promise<T> {
  const f = await getMediaStore(event).get(cle)
  if (!f) return defaut
  try { return JSON.parse(decodeur.decode(f.body)) as T } catch { return defaut }
}

async function ecrireJson(event: any, cle: string, valeur: unknown) {
  await getMediaStore(event).put(cle, toBuffer(JSON.stringify(valeur)), 'application/json')
}

export function configOAuth() {
  const clientId = (process.env.NUXT_YOUTUBE_OAUTH_CLIENT_ID || '').trim()
  const clientSecret = (process.env.NUXT_YOUTUBE_OAUTH_CLIENT_SECRET || '').trim()
  const site = String(useRuntimeConfig().public.SITE_URL || '').replace(/\/+$/, '')
  return { clientId, clientSecret, redirectUri: `${site}/api/youtube/oauth`, configure: Boolean(clientId && clientSecret) }
}

// ── Connexion ────────────────────────────────────────────────────────────

export async function urlConnexion(event: any): Promise<string> {
  const { clientId, redirectUri, configure } = configOAuth()
  if (!configure) throw createError({ statusCode: 400, message: 'Identifiant OAuth YouTube non configuré dans Cloudflare.' })
  const octets = crypto.getRandomValues(new Uint8Array(24))
  const state = [...octets].map((b) => b.toString(16).padStart(2, '0')).join('')
  await ecrireJson(event, CLE_ETAT_OAUTH, { state, expire: Date.now() + 15 * 60 * 1000 })
  const p = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: PORTEE,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`
}

async function jetonGoogle(params: Record<string, string>): Promise<any> {
  const r = await fetchWithTimeout('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  })
  const data: any = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(`Google ${r.status} : ${data?.error_description || data?.error || 'refus'}`)
  return data
}

/** Retour de Google après autorisation : échange le code contre le jeton durable. */
export async function terminerConnexion(event: any, code: string, state: string): Promise<{ ok: boolean, message: string }> {
  const attendu = await lireJson<{ state?: string, expire?: number }>(event, CLE_ETAT_OAUTH, {})
  await getMediaStore(event).delete([CLE_ETAT_OAUTH])
  if (!attendu.state || attendu.state !== state || (attendu.expire || 0) < Date.now()) {
    return { ok: false, message: 'Lien de connexion expiré ou invalide. Recommencez depuis ⚙ Config.' }
  }
  const { clientId, clientSecret, redirectUri } = configOAuth()
  const data = await jetonGoogle({
    code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code',
  })
  if (!data.refresh_token) {
    return { ok: false, message: "Google n'a pas fourni d'accès durable. Retirez l'accès du site dans votre compte Google, puis recommencez." }
  }
  // Le compte autorisé doit bien être celui de la chaîne de l'église.
  const r = await fetchWithTimeout('https://www.googleapis.com/youtube/v3/channels?part=id,snippet&mine=true', {
    headers: { authorization: `Bearer ${data.access_token}` },
  })
  const chaines: any = await r.json().catch(() => ({}))
  const ids: string[] = (chaines?.items || []).map((c: any) => c.id)
  if (!ids.includes(idChaineConfigure())) {
    return { ok: false, message: "Ce compte Google ne gère pas la chaîne de l'église. Recommencez en choisissant la chaîne « Cieux Ouverts » lors de la connexion." }
  }
  await ecrireJson(event, CLE_OAUTH, { refreshToken: data.refresh_token, date: new Date().toISOString() })
  jetonEnCache = null
  return { ok: true, message: 'Chaîne YouTube connectée.' }
}

export async function deconnecter(event: any) {
  await getMediaStore(event).delete([CLE_OAUTH])
  jetonEnCache = null
}

// Jeton d'accès (1 h) : on garde la VALEUR, pas une promesse partagée entre
// requêtes (voir videosEnCache dans youtube.ts).
let jetonEnCache: { jeton: string, expire: number } | null = null

export async function jetonAcces(event: any): Promise<string | null> {
  if (jetonEnCache && jetonEnCache.expire > Date.now()) return jetonEnCache.jeton
  const { clientId, clientSecret, configure } = configOAuth()
  if (!configure) return null
  const oauth = await lireJson<{ refreshToken?: string }>(event, CLE_OAUTH, {})
  if (!oauth.refreshToken) return null
  const data = await jetonGoogle({
    refresh_token: oauth.refreshToken, client_id: clientId, client_secret: clientSecret, grant_type: 'refresh_token',
  })
  jetonEnCache = { jeton: data.access_token, expire: Date.now() + (Number(data.expires_in || 3600) - 120) * 1000 }
  return jetonEnCache.jeton
}

// ── Indexation des sous-titres ───────────────────────────────────────────

interface EtatIndex {
  videos: Record<string, { ok: boolean, date: number }>
  pauseQuota?: number
}

export class QuotaEpuise extends Error {}

async function telechargerParoles(jeton: string, idVideo: string) {
  const entetes = { authorization: `Bearer ${jeton}` }
  const r = await fetchWithTimeout(`https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${idVideo}`, { headers: entetes })
  if (r.status === 403) {
    const t = await r.text().catch(() => '')
    if (/quota/i.test(t)) throw new QuotaEpuise('Quota YouTube du jour atteint')
    throw new Error(`YouTube 403 (sous-titres) : ${t.slice(0, 200)}`)
  }
  if (!r.ok) throw new Error(`YouTube ${r.status} (liste des sous-titres)`)
  const piste = choisirPiste(((await r.json()) as any)?.items)
  if (!piste) return null
  const d = await fetchWithTimeout(`https://www.googleapis.com/youtube/v3/captions/${encodeURIComponent(piste.id)}?tfmt=sbv`, { headers: entetes })
  if (d.status === 403) {
    const t = await d.text().catch(() => '')
    if (/quota/i.test(t)) throw new QuotaEpuise('Quota YouTube du jour atteint')
    return null // piste non téléchargeable : traitée comme absente
  }
  if (!d.ok) throw new Error(`YouTube ${d.status} (téléchargement des sous-titres)`)
  return lireSousTitres(await d.text())
}

async function ajouterParoles(event: any, ligne: string) {
  // Ajout en fin de fichier sans le relire en JSON : simple concaténation
  // d'octets, pour rester léger en calcul même quand le fichier grossit.
  const magasin = getMediaStore(event)
  const actuel = await magasin.get(CLE_PAROLES)
  const ajout = encodeur.encode(ligne)
  const avant = actuel ? new Uint8Array(actuel.body) : new Uint8Array(0)
  const total = new Uint8Array(avant.length + ajout.length)
  total.set(avant, 0)
  total.set(ajout, avant.length)
  await magasin.put(CLE_PAROLES, total.buffer as ArrayBuffer, 'application/x-ndjson')
}

export interface Avancement {
  connecte: boolean
  configure: boolean
  traitees: number
  avecParoles: number
  restantes: number
  pauseQuota: number | null
  derniereErreur?: string
}

function aTraiter(etat: EtatIndex, ids: string[]): string[] {
  const maintenant = Date.now()
  return ids.filter((id) => {
    const e = etat.videos[id]
    return !e || (!e.ok && maintenant - e.date > RETENTE_SANS_SOUS_TITRES_MS)
  })
}

/** Traite au plus `max` vidéos (les plus récentes d'abord). */
export async function indexer(event: any, max: number): Promise<Avancement> {
  const etat = await lireJson<EtatIndex>(event, CLE_ETAT, { videos: {} })
  const { configure } = configOAuth()
  const jeton = await jetonAcces(event)
  const base = { configure, connecte: Boolean(jeton) }
  const liste = await videosEnCache(async () => jeton)
  const ids = liste.videos.map((v) => v.id)
  let derniereErreur: string | undefined

  if (jeton && max > 0 && !(etat.pauseQuota && etat.pauseQuota > Date.now())) {
    for (const id of aTraiter(etat, ids).slice(0, max)) {
      try {
        const passages = await telechargerParoles(jeton, id)
        if (passages && passages.length) await ajouterParoles(event, ligneParoles(id, passages))
        etat.videos[id] = { ok: Boolean(passages && passages.length), date: Date.now() }
      } catch (err: any) {
        if (err instanceof QuotaEpuise) {
          etat.pauseQuota = Date.now() + PAUSE_QUOTA_MS
        }
        derniereErreur = String(err?.message || err).slice(0, 300)
        break
      }
    }
    await ecrireJson(event, CLE_ETAT, etat)
  }

  const valeurs = Object.entries(etat.videos).filter(([id]) => ids.includes(id))
  return {
    ...base,
    traitees: valeurs.length,
    avecParoles: valeurs.filter(([, e]) => e.ok).length,
    restantes: aTraiter(etat, ids).length,
    pauseQuota: etat.pauseQuota && etat.pauseQuota > Date.now() ? etat.pauseQuota : null,
    derniereErreur,
  }
}

// Indexation discrète au fil des visites : au plus une vidéo, au plus une
// fois toutes les 10 minutes par isolat, après l'envoi de la réponse.
let derniereTentative = 0
export function indexerEnArrierePlan(event: any) {
  if (Date.now() - derniereTentative < 10 * 60 * 1000) return
  derniereTentative = Date.now()
  const tache = indexer(event, 1).catch((err) => console.error('[paroles] indexation :', err))
  const attendre = event?.waitUntil || event?.context?.waitUntil
  if (typeof attendre === 'function') attendre.call(event?.waitUntil ? event : event.context, tache)
}
