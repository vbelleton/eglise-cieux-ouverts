// Adresses saisies dans l'admin (liens de boutons, fichiers audio, images) :
// seules les adresses du site (« /contact », « #ancre »), http(s), mailto: et
// tel: sont acceptées. Tout le reste (javascript:, data:, //hote…) devient
// une chaîne vide, et l'élément concerné n'est simplement pas affiché.
const LIEN_SUR = /^(\/(?!\/)|#|https?:\/\/|mailto:|tel:)/i

export function lienSur(url) {
  const u = String(url ?? '').trim()
  return LIEN_SUR.test(u) ? u : ''
}

// Fichier à charger (audio, image) : pas de mailto:/tel:/ancre.
export function sourceSure(url) {
  const u = String(url ?? '').trim()
  return /^(\/(?!\/)|https?:\/\/)/i.test(u) ? u : ''
}

export function estInterne(url) {
  return /^\/(?!\/)/.test(String(url ?? '').trim())
}
