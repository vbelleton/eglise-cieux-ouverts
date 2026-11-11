// Bible Louis Segond 1910 du mode VR : un fichier par livre dans
// public/bible/lsg/ (scripts/construire-bible.mjs), chargé à la demande et
// gardé en mémoire le temps de la visite.
import { LIVRES_BIBLE, LIVRE_PAR_CODE } from '~/utils/livresBible.js'
import { hasard, graineDuJour } from './scene.js'

const cache = new Map()

export function chargerLivre(code) {
  if (!LIVRE_PAR_CODE[code]) return Promise.reject(new Error(`Livre inconnu : ${code}`))
  if (!cache.has(code)) {
    const promesse = fetch(`/bible/lsg/${code}.json`, { signal: AbortSignal.timeout(15000) })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .catch((e) => {
        cache.delete(code) // une erreur passagère ne doit pas rester en cache
        throw e
      })
    cache.set(code, promesse)
  }
  return cache.get(code)
}

/** Livre précédent / suivant dans l'ordre biblique (null aux extrémités). */
export function livreVoisin(code, sens) {
  const i = LIVRES_BIBLE.findIndex((l) => l.code === code)
  return LIVRES_BIBLE[i + sens]?.code || null
}

// Passages propices à la prière, pour le « verset du jour » quand aucune
// prédication récente ne cite de passage.
const PASSAGES_PRIERE = [
  ['PSA', 23], ['PSA', 27], ['PSA', 46], ['PSA', 62], ['PSA', 91], ['PSA', 103], ['PSA', 121], ['PSA', 139],
  ['ISA', 40, 28], ['ISA', 43], ['LAM', 3, 22], ['MAT', 5], ['MAT', 6, 5], ['MAT', 11, 28], ['LUK', 15],
  ['JHN', 14], ['JHN', 15], ['ROM', 8, 26], ['ROM', 12], ['1CO', 13], ['EPH', 3, 14], ['PHP', 4, 4],
  ['COL', 3, 12], ['1TH', 5, 16], ['HEB', 4, 14], ['HEB', 12], ['JAS', 5, 13], ['1JN', 4, 7], ['REV', 21], ['ACT', 7, 55],
].map(([code, chapitre, verset = null]) => ({ code, chapitre, verset }))

export function passageDuJour(date = new Date()) {
  const r = hasard(graineDuJour(date) ^ 0x5eed)
  return PASSAGES_PRIERE[Math.floor(r() * PASSAGES_PRIERE.length)]
}
