import type { H3Event } from 'h3'
import { getFirestoreConfig, getAccessToken, getFirestoreDoc, parseFirestoreDoc } from './firebase'

// Accès à l'espace membre, trois états (réglages ⚙️ Config, `settings/config`) :
// - ouvert (`espaceMembre: true`) : tout le monde ;
// - test (`espaceMembre: false` + `espaceMembreTesteurs` non vide) : seuls les
//   e-mails de la liste. Le lien reste absent du site public, `/membre`
//   n'est accessible qu'en tapant l'adresse ;
// - fermé (sinon) : personne.
// Le vrai verrou est `server/middleware/espace-membre-acces.ts`, qui applique
// ces règles à tous les appels /api/member/* : le Worker eglise-app crée un
// membre à la première connexion d'un e-mail inconnu, il ne faut donc pas
// qu'un visiteur qui devine l'adresse /membre puisse l'atteindre.

export interface ReglagesEspaceMembre {
  ouvert: boolean
  testeurs: string[]
}

export function normaliserTesteurs(brut: unknown): string[] {
  const liste = Array.isArray(brut) ? brut : typeof brut === 'string' ? brut.split(/[,;\s]+/) : []
  return [...new Set(liste.map((e) => String(e).trim().toLowerCase()).filter(Boolean))]
}

function depuisDonnees(data: Record<string, any> | null): ReglagesEspaceMembre {
  return { ouvert: data?.espaceMembre === true, testeurs: normaliserTesteurs(data?.espaceMembreTesteurs) }
}

function isTestEnv(): boolean {
  return process.env.NODE_ENV === 'test' || process.env.PW_TEST === '1' || process.env.TEST_ENV === '1'
}

// Lecture ratée → fermé : pour un contrôle d'accès, refuser est le bon repli
// (même règle que getAdminUsers).
export async function lireReglagesEspaceMembre(event: H3Event): Promise<ReglagesEspaceMembre> {
  if (isTestEnv()) {
    const { getSettings } = await import('./firestore-mock.js')
    return depuisDonnees(getSettings())
  }
  const config = getFirestoreConfig(event)
  if (!config) return depuisDonnees(null)
  try {
    const accessToken = await getAccessToken(config.clientEmail, config.privateKey)
    const doc = await getFirestoreDoc(config.projectId, accessToken, 'settings', 'config')
    return depuisDonnees(doc ? parseFirestoreDoc(doc) : null)
  } catch (err) {
    console.error('espace membre : réglages illisibles, accès refusé', err)
    return depuisDonnees(null)
  }
}
