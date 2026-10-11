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
  let img
  try {
    img = await chargerImage(file)
  } catch {
    return file
  }
  const echelle = Math.min(1, MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight))
  if (echelle === 1 && file.size <= SEUIL_OCTETS) return file

  const largeur = Math.round(img.naturalWidth * echelle)
  const hauteur = Math.round(img.naturalHeight * echelle)
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
  ctx.drawImage(img, 0, 0, largeur, hauteur)
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

/**
 * Compresse puis téléverse une image. Renvoie son URL publique.
 * Le nom est préfixé par l'horodatage : tri chronologique dans la
 * médiathèque, et jamais d'écrasement d'une image déjà utilisée.
 */
export async function uploadImage(file) {
  if (!file?.type?.startsWith('image/')) throw new Error(`« ${file?.name || 'fichier'} » n'est pas une image`)
  if (file.size > MAX_FILE_SIZE) throw new Error(`« ${file.name} » dépasse 25 Mo`)
  const optimise = await compressImage(file)
  const { getStorage, ref: storageRef, uploadBytes, getDownloadURL } = await import('firebase/storage')
  const storage = getStorage()
  const r = storageRef(storage, `${UPLOAD_FOLDER}/${Date.now()}_${nomFichierSur(optimise.name)}`)
  await uploadBytes(r, optimise, {
    contentType: optimise.type,
    // Le nom est unique et jamais réécrit : cache navigateur long sans risque.
    cacheControl: 'public, max-age=31536000, immutable',
  })
  return getDownloadURL(r)
}

/** Images déjà téléversées, les plus récentes d'abord. */
export async function listUploadedImages() {
  const { getStorage, ref: storageRef, listAll, getDownloadURL } = await import('firebase/storage')
  const res = await listAll(storageRef(getStorage(), UPLOAD_FOLDER))
  const items = [...res.items].sort((a, b) => b.name.localeCompare(a.name, undefined, { numeric: true }))
  return Promise.all(items.map(async item => ({ name: item.name, url: await getDownloadURL(item) })))
}
