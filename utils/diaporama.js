// Diaporama de la page d'accueil (bloc `diaporama`) : quelles diapositives
// montrer aujourd'hui.
//
// Chaque diapositive peut porter une date « fin » (AAAA-MM-JJ, incluse) :
// le lendemain, elle disparaît d'elle-même du site, sans que personne n'ait à
// repasser dans l'admin. Le jour est celui de Morlaix (Europe/Paris), pas
// celui d'UTC ni du serveur : un événement du jeudi reste affiché jusqu'à
// jeudi minuit heure française.

const FORMAT_JOUR = /^\d{4}-\d{2}-\d{2}$/

// Jour calendaire à Paris au format AAAA-MM-JJ. Jamais toISOString() : il
// donne le jour UTC, donc la veille entre minuit et 1 h (2 h l'été).
export function jourParis(date = new Date()) {
  const parties = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const v = (type) => parties.find((p) => p.type === type)?.value
  return `${v('year')}-${v('month')}-${v('day')}`
}

// Une diapositive est périmée si sa date de fin est passée. Sans date (ou
// date illisible), elle reste affichée : mieux vaut une affiche de trop
// qu'une affiche qui disparaît par erreur.
export function estPerimee(slide, aujourdhui) {
  const fin = String(slide?.fin || '').trim()
  if (!FORMAT_JOUR.test(fin)) return false
  return fin < aujourdhui
}

export function slidesAffichees(slides, aujourdhui) {
  return (Array.isArray(slides) ? slides : []).filter(
    (s) => s && String(s.image || '').trim() && !estPerimee(s, aujourdhui),
  )
}
