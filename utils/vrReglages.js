// Réglages du mode VR caché (/vr), document Firestore `settings/vr` — séparé
// de `settings/config` pour qu'un enregistrement de l'un ne puisse jamais
// écraser l'autre. Lus par pages/vr.vue, modifiés dans l'admin, bouton
// 🥽 « Salle VR » (components/admin/ReglagesVR.vue).

/** Identifiants des lieux de lib/vr/lieux/index.js (vérifié par un test). */
export const VR_LIEUX = ['chapelle', 'salle', 'jardin', 'mer', 'chambre', 'ciel']

/** Identifiants des fonds musicaux de lib/vr/musique.js (vérifié par un test). */
export const VR_MUSIQUES = ['repos', 'attente', 'lumiere', 'nuit']

/**
 * Photos des activités du site proposées dans la salle (fichiers de public/).
 * Chacune peut être retirée dans l'admin (`photosSiteMasquees`) ; elles
 * apparaissent dans la médiathèque avec l'usage « Salle VR ».
 */
export const VR_PHOTOS_SITE = [
  { image: '/images/activites-celebration.jpg', titre: 'Le culte du dimanche' },
  { image: '/images/activites-priere.jpg', titre: 'La prière' },
  { image: '/images/activites-jeunesse.jpeg', titre: 'La jeunesse' },
  { image: '/images/activites-maison.jpeg', titre: 'Les groupes de maison' },
  { image: '/images/activites-repas.jpg', titre: 'Les repas' },
  { image: '/images/activites-femmes.jpeg', titre: 'Les femmes' },
  { image: '/images/activites-marche.jpeg', titre: 'Le groupe de marche' },
]

export const VR_REGLAGES_DEFAUT = {
  titre: 'salle de prière', // affiché en haut de l'écran et dans l'onglet
  lieux: [...VR_LIEUX], // lieux proposés aux visiteurs
  lieu: 'chapelle', // lieu de prière à l'arrivée (lib/vr/lieux/)
  passage: '', // passage d'ouverture (« Psaume 23 ») ; vide = automatique
  dureePriere: 3, // minutes du temps de prière
  musique: 'repos', // fond musical à l'arrivée (lib/vr/musique.js) ; null = aucun
  tableaux: true, // tableaux du domaine public selon le passage ouvert (lib/vr/tableaux.js)
  agenda: true, // prochains événements (Worker eglise-app)
  predications: true, // dernières vidéos YouTube (/api/predications)
  photosSite: true, // photos des activités (VR_PHOTOS_SITE)
  photosSiteMasquees: [], // photos des activités retirées une à une
  photos: [], // photos choisies dans la médiathèque
}

export const VR_MAX_PHOTOS = 40
export const VR_DUREE_MIN = 1
export const VR_DUREE_MAX = 15

/** Ne garde que des valeurs sûres ; tout champ absent prend sa valeur par défaut. */
export function normaliserReglagesVR(data) {
  const bool = (v, d) => (typeof v === 'boolean' ? v : d)
  const texte = (v, d, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : d)
  const photos = Array.isArray(data?.photos)
    ? [...new Set(data.photos.map((u) => String(u || '').trim()).filter((u) => /^(\/|https:\/\/)/.test(u) && u.length < 1000))].slice(0, VR_MAX_PHOTOS)
    : []
  // Au moins un lieu proposé, dans l'ordre de VR_LIEUX ; le lieu d'arrivée
  // en fait toujours partie.
  const choisis = Array.isArray(data?.lieux) ? VR_LIEUX.filter((id) => data.lieux.includes(id)) : []
  const lieux = choisis.length ? choisis : [...VR_LIEUX]
  const lieu = lieux.includes(data?.lieu) ? data.lieu : lieux.includes(VR_REGLAGES_DEFAUT.lieu) ? VR_REGLAGES_DEFAUT.lieu : lieux[0]
  const duree = Math.round(Number(data?.dureePriere))
  return {
    titre: texte(data?.titre, VR_REGLAGES_DEFAUT.titre, 60) || VR_REGLAGES_DEFAUT.titre,
    lieux,
    lieu,
    passage: texte(data?.passage, '', 60),
    musique: data && 'musique' in data ? (VR_MUSIQUES.includes(data.musique) ? data.musique : null) : VR_REGLAGES_DEFAUT.musique,
    tableaux: bool(data?.tableaux, VR_REGLAGES_DEFAUT.tableaux),
    dureePriere: Number.isFinite(duree) ? Math.min(VR_DUREE_MAX, Math.max(VR_DUREE_MIN, duree)) : VR_REGLAGES_DEFAUT.dureePriere,
    agenda: bool(data?.agenda, VR_REGLAGES_DEFAUT.agenda),
    predications: bool(data?.predications, VR_REGLAGES_DEFAUT.predications),
    photosSite: bool(data?.photosSite, VR_REGLAGES_DEFAUT.photosSite),
    photos,
    photosSiteMasquees: Array.isArray(data?.photosSiteMasquees)
      ? VR_PHOTOS_SITE.map((p) => p.image).filter((u) => data.photosSiteMasquees.includes(u))
      : [],
  }
}

/** Photos affichées dans la salle, dans l'ordre des réglages : { image, titre }. */
export function photosDeLaSalle(reglages, retirees = []) {
  const garder = (u) => !retirees.includes(u)
  const site = reglages.photosSite ? VR_PHOTOS_SITE.filter((p) => !reglages.photosSiteMasquees.includes(p.image) && garder(p.image)) : []
  return [...site, ...reglages.photos.filter(garder).map((image) => ({ image, titre: '' }))]
}
