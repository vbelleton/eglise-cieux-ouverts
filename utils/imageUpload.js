// Téléversement d'images vers Cloudflare KV (dossier `uploads/`), via /api/media, partagé
// par l'éditeur de blocs (FieldImage, FieldImages, ImageLibrary) et le
// gestionnaire d'événements (EventManager).
//
// Les photos prises au téléphone pèsent souvent 3 à 8 Mo pour 4000 px de
// large : téléversées telles quelles, chaque visiteur les télécharge en
// entier. Elles sont donc redimensionnées et recompressées dans le
// navigateur AVANT l'envoi.

import { useNuxtApp } from '#app'

const MAX_DIMENSION = 2000
const JPEG_QUALITY = 0.82
// En dessous, l'image est gardée telle quelle (déjà légère).
const SEUIL_OCTETS = 400 * 1024
// Formats que le canvas ne doit pas toucher : animation (GIF) ou vectoriel (SVG).
const FORMATS_INTACTS = ['image/gif', 'image/svg+xml']

export const UPLOAD_FOLDER = 'uploads'
export const MAX_FILE_SIZE = 25 * 1024 * 1024

// Décodage + réduction hors du fil principal quand le navigateur sait le faire
// (createImageBitmap avec redimensionnement) : une photo de 12 Mpx ne fige plus
// la page. Repli sur <img> sinon.
async function chargerBitmap(file, maxDim) {
  if (typeof createImageBitmap !== 'function') return null
  try {
    const brut = await createImageBitmap(file)
    const origine = { largeur: brut.width, hauteur: brut.height }
    const echelle = Math.min(1, maxDim / Math.max(brut.width, brut.height))
    if (echelle === 1) return { bitmap: brut, ...origine }
    const w = Math.round(brut.width * echelle)
    const h = Math.round(brut.height * echelle)
    const reduit = await createImageBitmap(brut, { resizeWidth: w, resizeHeight: h, resizeQuality: 'high' })
    brut.close?.()
    return { bitmap: reduit, ...origine }
  } catch {
    return null
  }
}

function chargerImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image illisible')) }
    img.src = url
  })
}

/**
 * Redimensionne (côté le plus long ≤ 2000 px) et recompresse une image.
 * PNG reste PNG (transparence des logos préservée), le reste passe en JPEG.
 * Renvoie le fichier d'origine si la compression n'apporte rien.
 */
export async function compressImage(file) {
  if (!file?.type?.startsWith('image/') || FORMATS_INTACTS.includes(file.type)) return file
  let source
  let largeurOrigine
  let hauteurOrigine
  const decode = await chargerBitmap(file, MAX_DIMENSION)
  if (decode) {
    source = decode.bitmap
    largeurOrigine = decode.largeur
    hauteurOrigine = decode.hauteur
  } else {
    try { source = await chargerImage(file) } catch { return file }
    largeurOrigine = source.naturalWidth
    hauteurOrigine = source.naturalHeight
  }
  const echelle = Math.min(1, MAX_DIMENSION / Math.max(largeurOrigine, hauteurOrigine))
  if (echelle === 1 && file.size <= SEUIL_OCTETS) { source.close?.(); return file }

  const largeur = Math.round(largeurOrigine * echelle)
  const hauteur = Math.round(hauteurOrigine * echelle)
  const canvas = document.createElement('canvas')
  canvas.width = largeur
  canvas.height = hauteur
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  const png = file.type === 'image/png'
  if (!png) {
    // JPEG n'a pas de transparence : fond blanc plutôt que noir.
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, largeur, hauteur)
  }
  ctx.drawImage(source, 0, 0, largeur, hauteur)
  source.close?.()
  const type = png ? 'image/png' : 'image/jpeg'
  const blob = await new Promise(resolve => canvas.toBlob(resolve, type, JPEG_QUALITY))
  if (!blob || blob.size >= file.size) return file
  const nom = png ? file.name : file.name.replace(/\.[^.]+$/, '') + '.jpg'
  return new File([blob], nom, { type, lastModified: Date.now() })
}

function nomFichierSur(nom) {
  const base = (nom || 'image')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
  return base || 'image'
}

export const THUMB_FOLDER = `${UPLOAD_FOLDER}/thumbs`
const THUMB_DIMENSION = 320

/** Vignette JPEG ~320 px (quelques Ko) : c'est elle que la médiathèque affiche. */
async function creerVignette(file) {
  if (!file?.type?.startsWith('image/') || FORMATS_INTACTS.includes(file.type)) return null
  const decode = await chargerBitmap(file, THUMB_DIMENSION)
  let source
  let largeurSource
  let hauteurSource
  if (decode) {
    source = decode.bitmap
    // Le bitmap est déjà à la bonne taille : on le dessine tel quel.
    largeurSource = source.width
    hauteurSource = source.height
  } else {
    try { source = await chargerImage(file) } catch { return null }
    largeurSource = source.naturalWidth
    hauteurSource = source.naturalHeight
  }
  const echelle = Math.min(1, THUMB_DIMENSION / Math.max(largeurSource, hauteurSource))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(largeurSource * echelle))
  canvas.height = Math.max(1, Math.round(hauteurSource * echelle))
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  source.close?.()
  return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.7))
}

// ── Cache de session ───────────────────────────────────────────────────────
// Rouvrir la médiathèque ne refait pas la liste.
let listeEnCache = null

function invaliderListe() { listeEnCache = null }

// Les images sont stockées dans Cloudflare KV et servies par le site lui-même
// (/api/media/…). Un envoi qui ne répond pas est abandonné au bout de 40 s :
// assez pour une connexion lente avec une image déjà réduite, sans laisser
// l'éditeur figé.
const DELAI_MAX_ENVOI_MS = 40 * 1000

async function jetonAdmin() {
  const { $auth } = useNuxtApp()
  const user = await new Promise((resolve) => {
    if ($auth?.currentUser) { resolve($auth.currentUser); return }
    const unsub = $auth?.onAuthStateChanged?.((u) => { resolve(u); if (typeof unsub === 'function') unsub() })
    if (!$auth?.onAuthStateChanged) resolve(null)
  })
  if (!user) throw new Error("Connecte-toi à l'admin pour envoyer des images.")
  return user.getIdToken()
}

/** Message clair à la place des erreurs réseau ou serveur brutes. */
export function messageErreurEnvoi(err) {
  if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
    return "Le stockage d'images ne répond pas (connexion lente ou service indisponible). Réessaie."
  }
  return err?.message || "Échec de l'envoi"
}

async function envoyer(cle, blob) {
  const token = await jetonAdmin()
  const res = await fetch(`/api/media?key=${encodeURIComponent(cle)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': blob.type || 'application/octet-stream' },
    body: blob,
    signal: AbortSignal.timeout(DELAI_MAX_ENVOI_MS),
  })
  if (!res.ok) {
    const corps = await res.json().catch(() => ({}))
    throw new Error(corps.message || `Envoi refusé (HTTP ${res.status})`)
  }
}

/** Adresse publique d'un fichier du dossier `uploads/`. */
function adresse(chemin) {
  return `/api/media/${chemin}`
}

/**
 * Compresse puis téléverse une image (plus une vignette, en arrière-plan de
 * l'envoi principal). Renvoie son URL publique et son nom de fichier.
 * Le nom est préfixé par l'horodatage : tri chronologique dans la
 * médiathèque, et jamais d'écrasement d'une image déjà utilisée.
 */
export async function uploadImageDetailed(file) {
  if (!file?.type?.startsWith('image/')) throw new Error(`« ${file?.name || 'fichier'} » n'est pas une image`)
  if (file.size > MAX_FILE_SIZE) throw new Error(`« ${file.name} » dépasse 25 Mo`)
  const [optimise, vignette] = await Promise.all([
    compressImage(file),
    creerVignette(file).catch(() => null),
  ])
  const nom = `${Date.now()}_${nomFichierSur(optimise.name)}`
  const envoiVignette = vignette
    // Facultatif : sans vignette, la médiathèque retombe sur l'image d'origine.
    ? envoyer(`${THUMB_FOLDER}/${nom}`, vignette).catch(() => null)
    : Promise.resolve(null)
  try {
    await envoyer(`${UPLOAD_FOLDER}/${nom}`, optimise)
  } catch (err) {
    throw Object.assign(new Error(messageErreurEnvoi(err)), { code: err?.code })
  }
  // La vignette est un plus : on ne la laisse jamais retarder l'image elle-même.
  await Promise.race([envoiVignette, new Promise(resolve => setTimeout(resolve, 3000))])
  invaliderListe()
  return { url: adresse(`${UPLOAD_FOLDER}/${nom}`), name: nom }
}

/** Compresse puis téléverse une image. Renvoie son URL publique. */
export async function uploadImage(file) {
  return (await uploadImageDetailed(file)).url
}

/**
 * Noms des images déjà téléversées, les plus récentes d'abord — un seul appel
 * réseau.
 */
export async function listUploadedImageNames() {
  if (listeEnCache) return listeEnCache
  const token = await jetonAdmin()
  const res = await fetch('/api/media', {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(DELAI_MAX_ENVOI_MS),
  })
  if (!res.ok) throw new Error(`Médiathèque indisponible (HTTP ${res.status})`)
  const { names } = await res.json()
  listeEnCache = names.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
  return listeEnCache
}

/** URL de l'image d'origine. */
export async function imageUrl(nom) {
  return adresse(`${UPLOAD_FOLDER}/${nom}`)
}

/**
 * URL de la vignette. Une image envoyée sans vignette renvoie une 404 : la
 * tuile de la médiathèque retombe alors sur l'image d'origine (onError).
 */
export async function thumbnailUrl(nom) {
  return adresse(`${THUMB_FOLDER}/${nom}`)
}

/** Supprime des images téléversées (et leurs vignettes). Renvoie les noms réellement supprimés. */
export async function deleteUploadedImages(noms) {
  const token = await jetonAdmin()
  const supprimees = []
  for (const nom of noms) {
    const res = await fetch(`/api/media?name=${encodeURIComponent(nom)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(DELAI_MAX_ENVOI_MS),
    })
    if (res.ok) supprimees.push(nom)
  }
  invaliderListe()
  return supprimees
}

/** Images du dossier public/ retirées de la médiathèque (chemins comme « /images/x.jpg »). */
export async function listHiddenSiteImages() {
  const token = await jetonAdmin()
  const res = await fetch('/api/media/site-hidden', {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(DELAI_MAX_ENVOI_MS),
  })
  if (!res.ok) throw new Error(`Médiathèque indisponible (HTTP ${res.status})`)
  return (await res.json()).hidden
}

export async function saveHiddenSiteImages(hidden) {
  const token = await jetonAdmin()
  const res = await fetch('/api/media/site-hidden', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ hidden }),
    signal: AbortSignal.timeout(DELAI_MAX_ENVOI_MS),
  })
  if (!res.ok) throw new Error(`Suppression impossible (HTTP ${res.status})`)
  return (await res.json()).hidden
}

/** Images déjà téléversées avec leur URL, les plus récentes d'abord. */
export async function listUploadedImages() {
  const noms = await listUploadedImageNames()
  return noms.map(name => ({ name, url: adresse(`${UPLOAD_FOLDER}/${name}`) }))
}
