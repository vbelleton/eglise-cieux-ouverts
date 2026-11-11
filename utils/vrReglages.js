// Réglages du mode VR caché (/vr), document Firestore `settings/vr` — séparé
// de `settings/config` pour qu'un enregistrement de l'un ne puisse jamais
// écraser l'autre. Lus par pages/vr.vue, modifiés dans l'admin, bouton
// 🥽 « Salle VR » (components/admin/ReglagesVR.vue).

/** Identifiants des lieux de lib/vr/lieux/index.js (vérifié par un test). */
export const VR_LIEUX = ['chapelle', 'salle', 'jardin', 'mer', 'chambre', 'ciel']

export const VR_REGLAGES_DEFAUT = {
  titre: 'salle de prière', // affiché en haut de l'écran et dans l'onglet
  lieux: [...VR_LIEUX], // lieux proposés aux visiteurs
  lieu: 'chapelle', // lieu de prière à l'arrivée (lib/vr/lieux/)
  passage: '', // passage d'ouverture (« Psaume 23 ») ; vide = automatique
  dureePriere: 3, // minutes du temps de prière
  agenda: true, // prochains événements (Worker eglise-app)
  predications: true, // dernières vidéos YouTube (/api/predications)
  photosSite: true, // photos des activités (lib/vr/scene.js → PHOTOS_VR)
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
    dureePriere: Number.isFinite(duree) ? Math.min(VR_DUREE_MAX, Math.max(VR_DUREE_MIN, duree)) : VR_REGLAGES_DEFAUT.dureePriere,
    agenda: bool(data?.agenda, VR_REGLAGES_DEFAUT.agenda),
    predications: bool(data?.predications, VR_REGLAGES_DEFAUT.predications),
    photosSite: bool(data?.photosSite, VR_REGLAGES_DEFAUT.photosSite),
    photos,
  }
}
