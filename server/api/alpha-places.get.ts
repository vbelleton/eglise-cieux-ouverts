import { placesAlpha } from '../utils/alpha-places'

// Public : uniquement des compteurs, pour afficher « il reste N places ».
export default defineEventHandler(async (event) => {
  const parcours = String(getQuery(event).parcours || '').slice(0, 120)
  try {
    const { capacity, taken, remaining } = await placesAlpha(event, parcours)
    return { capacity, taken, remaining }
  } catch (err) {
    console.error('alpha-places error:', err)
    // Compteur indisponible : le formulaire reste utilisable (le serveur
    // revérifie à l'envoi).
    return { capacity: 0, taken: 0, remaining: null }
  }
})
