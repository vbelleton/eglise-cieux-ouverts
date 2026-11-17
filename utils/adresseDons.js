// Adresse publique de la page de dons (réglage ⚙ Config : settings/config.adresseDons).
// Le contenu reste dans le document pages/<adresse> : changer l'adresse déplace
// ce document, et l'ancienne adresse devient une redirection (voir
// plannifierDeplacement). Ce module est partagé par le serveur et le client.
import { getDefaultDonsPage } from './blockTypes.js'

export const ADRESSE_DONS_DEFAUT = 'dons'

// Adresses qu'une page de dons ne peut pas prendre : routes du site et slugs
// de pages système. « dons » n'y figure pas : c'est l'adresse par défaut.
const ADRESSES_RESERVEES = [
  'accueil', 'contact', 'messages', 'event-list', 'agenda', 'photos', 'membre',
  'billetterie', 'admin', 'api', '_nuxt', 'favicon.ico', 'robots.txt',
  'sitemap.xml', 'offline.html', 'predications', 'vr',
]

// Retourne l'adresse normalisée (minuscules, sans accents, tirets) ou null si
// elle n'est pas utilisable.
export function normaliserAdresseDons(valeur) {
  const s = String(valeur ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!s || s.length > 60 || ADRESSES_RESERVEES.includes(s)) return null
  return s
}

export function adresseDonsCourante(config) {
  return normaliserAdresseDons(config?.adresseDons) || ADRESSE_DONS_DEFAUT
}

// Réponse de GET /api/pages/:slug à partir du document brut (null = absent).
// Un document déplacé porte une redirection : le site renvoie alors vers la
// nouvelle adresse au lieu d'une 404. La page de dons garde son contenu de
// départ tant que personne ne l'a enregistrée.
export function reponsePageDepuisDoc(slug, doc) {
  if (doc?._deleted) {
    return doc.redirectTo
      ? { blocks: [], exists: false, redirectTo: doc.redirectTo }
      : { blocks: [], exists: false }
  }
  if (doc) return { blocks: doc.blocks || null, exists: true }
  if (slug === ADRESSE_DONS_DEFAUT) return { blocks: getDefaultDonsPage(), exists: true }
  return { blocks: [], exists: false }
}

// Écritures nécessaires pour passer de l'adresse `actuelle` à `cible`.
// `docActuel` = document brut de pages/<actuelle> (null si absent).
export function plannifierDeplacement(actuelle, cible, docActuel) {
  const blocsActuels = docActuel && !docActuel._deleted && Array.isArray(docActuel.blocks) && docActuel.blocks.length
    ? docActuel.blocks
    : actuelle === ADRESSE_DONS_DEFAUT ? getDefaultDonsPage() : []
  return {
    nouveauDoc: { blocks: blocsActuels },
    ancienDoc: { blocks: [], _deleted: true, redirectTo: `/${cible}` },
  }
}

// Vrai si le document existe et est visible : l'adresse cible ne doit pas
// déjà servir une autre page.
export function adresseOccupee(doc) {
  return !!doc && !doc._deleted
}
