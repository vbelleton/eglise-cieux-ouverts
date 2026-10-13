// Stockage des images téléversées : bucket Cloudflare R2 (liaison `IMAGES`,
// à déclarer dans le dashboard Pages → Settings → Bindings), ou une Map en
// mémoire pour les tests (PW_TEST=1).
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
}

const memoire = new Map<string, StoredMedia>()

const magasinMemoire: MediaStore = {
  async put(key, body, contentType) { memoire.set(key, { body, contentType }) },
  async get(key) { return memoire.get(key) ?? null },
  async list(prefix) { return [...memoire.keys()].filter(k => k.startsWith(prefix)) },
}

function magasinR2(bucket: any): MediaStore {
  return {
    async put(key, body, contentType) {
      await bucket.put(key, body, { httpMetadata: { contentType } })
    },
    async get(key) {
      const obj = await bucket.get(key)
      if (!obj) return null
      return {
        body: await obj.arrayBuffer(),
        contentType: obj.httpMetadata?.contentType || 'application/octet-stream',
      }
    },
    async list(prefix) {
      const noms: string[] = []
      let cursor: string | undefined
      do {
        const res: any = await bucket.list({ prefix, cursor, limit: 1000 })
        for (const o of res.objects) noms.push(o.key)
        cursor = res.truncated ? res.cursor : undefined
      } while (cursor)
      return noms
    },
  }
}

export function getMediaStore(event: any): MediaStore {
  if (process.env.PW_TEST === '1' || process.env.NODE_ENV === 'test') return magasinMemoire
  const bucket = event?.context?.cloudflare?.env?.IMAGES
  if (!bucket) {
    throw createError({
      statusCode: 503,
      message: "Stockage d'images non configuré : la liaison R2 « IMAGES » est absente du projet Cloudflare Pages.",
    })
  }
  return magasinR2(bucket)
}

/** Clé R2 sûre sous `uploads/`, ou null. Pas de `..`, pas de sous-dossier hors `thumbs/`. */
export function cleMedia(brut: string): string | null {
  const cle = decodeURIComponent(brut || '').replace(/^\/+/, '')
  if (!/^uploads\/(thumbs\/)?[a-z0-9][a-z0-9._-]*$/.test(cle)) return null
  return cle
}
