// Adresse (slug) des pages créées dans l'admin. Le contenu vit dans le document
// pages/<adresse> : changer l'adresse (POST /api/pages/:slug/adresse, bouton
// « Changer » de l'éditeur de menu) déplace ce document, et l'ancienne adresse
// devient une redirection 301. Module partagé par le serveur et le client.
import { getDefaultDonsPage } from './blockTypes.js'

// Page de dons : servie avec son contenu de départ tant qu'elle n'est pas enregistrée.
export const ADRESSE_DONS_DEFAUT = 'dons'

// Adresses qu'aucune page ne peut prendre : routes du site et pages à adresse fixe.
export const ADRESSES_RESERVEES = [
  'accueil', 'contact', 'messages', 'event-list', 'agenda', 'photos', 'membre',
  'billetterie', 'admin', 'api', '_nuxt', 'favicon.ico', 'robots.txt',
  'sitemap.xml', 'offline.html', 'predications', 'vr',
]

// Retourne l'adresse normalisée (minuscules, sans accents, tirets) ou null si
// elle n'est pas utilisable.
export function normaliserAdresse(valeur) {
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
  const vivant = docActuel && !docActuel._deleted ? docActuel : null
  const blocks = vivant?.blocks?.length
    ? vivant.blocks
    : actuelle === ADRESSE_DONS_DEFAUT ? getDefaultDonsPage() : []
  return {
    // Les autres champs (titre…) suivent la page.
    nouveauDoc: { ...(vivant || {}), blocks },
    ancienDoc: { blocks: [], _deleted: true, redirectTo: `/${cible}` },
  }
}

// Vrai si le document existe et est visible : l'adresse cible ne doit pas
// déjà servir une autre page.
export function adresseOccupee(doc) {
  return !!doc && !doc._deleted
}
