// Téléversement d'images vers Firebase Storage (dossier `uploads/`), partagé
// par l'éditeur de blocs (FieldImage, FieldImages, ImageLibrary) et le
// gestionnaire d'événements (EventManager).
//
// Les photos prises au téléphone pèsent souvent 3 à 8 Mo pour 4000 px de
// large : téléversées telles quelles, chaque visiteur les télécharge en
// entier. Elles sont donc redimensionnées et recompressées dans le
// navigateur AVANT l'envoi.

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
// Rouvrir la médiathèque ne refait ni la liste ni les adresses déjà connues.
let listeEnCache = null
const adressesEnCache = new Map()
const sansVignette = new Set()

function invaliderListe() { listeEnCache = null }

async function storageApi() {
  const m = await import('firebase/storage')
  return { ...m, storage: m.getStorage() }
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
  const [optimise, vignette, api] = await Promise.all([
    compressImage(file),
    creerVignette(file).catch(() => null),
    storageApi(),
  ])
  const { storage, ref: storageRef, uploadBytes, getDownloadURL } = api
  const nom = `${Date.now()}_${nomFichierSur(optimise.name)}`
  const r = storageRef(storage, `${UPLOAD_FOLDER}/${nom}`)
  const envoiVignette = vignette
    // Facultatif : sans vignette (règles de stockage, réseau), la médiathèque
    // retombe sur l'image d'origine.
    ? uploadBytes(storageRef(storage, `${THUMB_FOLDER}/${nom}`), vignette, {
        contentType: 'image/jpeg',
        cacheControl: 'public, max-age=31536000, immutable',
      }).catch(() => null)
    : Promise.resolve(null)
  await uploadBytes(r, optimise, {
    contentType: optimise.type,
    // Le nom est unique et jamais réécrit : cache navigateur long sans risque.
    cacheControl: 'public, max-age=31536000, immutable',
  })
  await envoiVignette
  invaliderListe()
  const url = await getDownloadURL(r)
  adressesEnCache.set(`${UPLOAD_FOLDER}/${nom}`, url)
  return { url, name: nom }
}

/** Compresse puis téléverse une image. Renvoie son URL publique. */
export async function uploadImage(file) {
  return (await uploadImageDetailed(file)).url
}

/**
 * Noms des images déjà téléversées, les plus récentes d'abord — un seul appel
 * réseau, sans résoudre les adresses (c'est ce qui rendait la médiathèque
 * interminable : une requête par image avant d'afficher quoi que ce soit).
 */
export async function listUploadedImageNames() {
  if (listeEnCache) return listeEnCache
  const { storage, ref: storageRef, listAll } = await storageApi()
  const res = await listAll(storageRef(storage, UPLOAD_FOLDER))
  listeEnCache = res.items.map(i => i.name).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
  return listeEnCache
}

async function adresse(chemin) {
  if (adressesEnCache.has(chemin)) return adressesEnCache.get(chemin)
  const { storage, ref: storageRef, getDownloadURL } = await storageApi()
  const url = await getDownloadURL(storageRef(storage, chemin))
  adressesEnCache.set(chemin, url)
  return url
}

/** URL de l'image d'origine. */
export function imageUrl(nom) {
  return adresse(`${UPLOAD_FOLDER}/${nom}`)
}

/**
 * URL de la vignette si elle existe, sinon de l'image d'origine (images
 * envoyées avant l'arrivée des vignettes).
 */
export async function thumbnailUrl(nom) {
  if (!sansVignette.has(nom)) {
    try {
      return await adresse(`${THUMB_FOLDER}/${nom}`)
    } catch {
      // On s'en souvient : pas de nouvelle requête perdue à chaque ouverture.
      sansVignette.add(nom)
    }
  }
  return imageUrl(nom)
}

/** Images déjà téléversées avec leur URL, les plus récentes d'abord. */
export async function listUploadedImages() {
  const noms = await listUploadedImageNames()
  return Promise.all(noms.map(async name => ({ name, url: await imageUrl(name) })))
}
