// Stockage des images téléversées : espace Cloudflare KV (liaison `IMAGES`,
// à déclarer dans le dashboard Pages → Settings → Bindings), gratuit et sans
// carte bancaire (R2 en demande une). Une Map en mémoire sert aux tests
// (PW_TEST=1). Valeur KV : 25 Mo max, comme la limite d'envoi.
//
// Les images sont servies par le site lui-même (`/api/media/uploads/…`) : pas
// de domaine public à configurer sur le bucket, pas de CORS.

export interface StoredMedia {
  body: ArrayBuffer
  contentType: string
}

export interface MediaStore {
  put(key: string, data: ArrayBuffer, contentType: string): Promise<void>
  get(key: string): Promise<StoredMedia | null>
  list(prefix: string): Promise<string[]>
  delete(keys: string[]): Promise<void>
}

const memoire = new Map<string, StoredMedia>()

const magasinMemoire: MediaStore = {
  async put(key, body, contentType) { memoire.set(key, { body, contentType }) },
  async get(key) { return memoire.get(key) ?? null },
  async list(prefix) { return [...memoire.keys()].filter(k => k.startsWith(prefix)) },
  async delete(keys) { keys.forEach(k => memoire.delete(k)) },
}

function magasinKV(kv: any): MediaStore {
  return {
    async put(key, body, contentType) {
      await kv.put(key, body, { metadata: { contentType } })
    },
    async get(key) {
      const { value, metadata } = await kv.getWithMetadata(key, { type: 'arrayBuffer' })
      if (!value) return null
      return { body: value, contentType: metadata?.contentType || 'application/octet-stream' }
    },
    async list(prefix) {
      const noms: string[] = []
      let cursor: string | undefined
      do {
        const res: any = await kv.list({ prefix, cursor, limit: 1000 })
        for (const k of res.keys) noms.push(k.name)
        cursor = res.list_complete ? undefined : res.cursor
      } while (cursor)
      return noms
    },
    async delete(keys) {
      await Promise.all(keys.map(k => kv.delete(k)))
    },
  }
}

export function getMediaStore(event: any): MediaStore {
  if (process.env.PW_TEST === '1' || process.env.NODE_ENV === 'test') return magasinMemoire
  const kv = event?.context?.cloudflare?.env?.IMAGES
  if (!kv) {
    throw createError({
      statusCode: 503,
      message: "Stockage d'images non configuré : la liaison KV « IMAGES » est absente du projet Cloudflare Pages.",
    })
  }
  return magasinKV(kv)
}

/** Clé sûre sous `uploads/`, ou null. Pas de `..`, pas de sous-dossier hors `thumbs/`. */
export function cleMedia(brut: string): string | null {
  const cle = decodeURIComponent(brut || '').replace(/^\/+/, '')
  if (!/^uploads\/(thumbs\/)?[a-z0-9][a-z0-9._-]*$/.test(cle)) return null
  return cle
}
