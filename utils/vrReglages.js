// Réglages du mode VR caché (/vr), document Firestore `settings/vr` — séparé
// de `settings/config` pour qu'un enregistrement de l'un ne puisse jamais
// écraser l'autre. Lus par pages/vr.vue, modifiés dans ⚙ Config
// (components/admin/ReglagesVR.vue).

export const VR_REGLAGES_DEFAUT = {
  photosSite: true, // photos des activités (lib/vr/scene.js → PHOTOS_VR)
  photos: [], // photos choisies dans la médiathèque
  predications: true, // dernières vidéos YouTube (/api/predications)
  agenda: true, // prochains événements (Worker eglise-app)
  lieu: 'chapelle', // lieu de prière à l'arrivée (lib/vr/lieux/)
}

/** Identifiants des lieux de lib/vr/lieux/index.js (vérifié par un test). */
export const VR_LIEUX = ['chapelle', 'jardin', 'mer', 'chambre', 'ciel']

export const VR_MAX_PHOTOS = 40

/** Ne garde que des valeurs sûres ; tout champ absent prend sa valeur par défaut. */
export function normaliserReglagesVR(data) {
  const bool = (v, d) => (typeof v === 'boolean' ? v : d)
  const photos = Array.isArray(data?.photos)
    ? [...new Set(data.photos.map((u) => String(u || '').trim()).filter((u) => /^(\/|https:\/\/)/.test(u) && u.length < 1000))].slice(0, VR_MAX_PHOTOS)
    : []
  return {
    photosSite: bool(data?.photosSite, VR_REGLAGES_DEFAUT.photosSite),
    photos,
    predications: bool(data?.predications, VR_REGLAGES_DEFAUT.predications),
    agenda: bool(data?.agenda, VR_REGLAGES_DEFAUT.agenda),
    lieu: VR_LIEUX.includes(data?.lieu) ? data.lieu : VR_REGLAGES_DEFAUT.lieu,
  }
}
