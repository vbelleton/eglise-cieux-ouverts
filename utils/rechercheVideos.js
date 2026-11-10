// Recherche dans les vidéos de prédication (page cachée /predications).
// Insensible à la casse, aux accents et à la ponctuation ; chaque mot tapé
// doit apparaître (dans le titre ou la description). Le titre compte plus
// que la description pour l'ordre des résultats, puis la date (récent d'abord).

export function normaliser(texte) {
  return String(texte || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’'`]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function motsDe(requete) {
  return normaliser(requete).split(' ').filter(Boolean)
}

export function rechercherVideos(videos, requete, { annee = '' } = {}) {
  const mots = motsDe(requete)
  const resultats = []
  for (const v of videos || []) {
    if (annee && String(v.date || '').slice(0, 4) !== String(annee)) continue
    if (!mots.length) {
      resultats.push({ video: v, score: 0 })
      continue
    }
    const titre = ` ${normaliser(v.titre)} `
    const desc = ` ${normaliser(v.description)} `
    let score = 0
    let ok = true
    for (const m of mots) {
      const dansTitre = titre.includes(m)
      const dansDesc = desc.includes(m)
      if (!dansTitre && !dansDesc) { ok = false; break }
      // Mot entier dans le titre > début de mot > ailleurs.
      if (dansTitre) score += titre.includes(` ${m} `) ? 10 : titre.includes(` ${m}`) ? 7 : 4
      else score += desc.includes(` ${m}`) ? 2 : 1
    }
    if (ok) resultats.push({ video: v, score })
  }
  resultats.sort((a, b) => b.score - a.score || String(b.video.date || '').localeCompare(String(a.video.date || '')))
  return resultats.map((r) => r.video)
}

export function anneesDisponibles(videos) {
  const annees = new Set()
  for (const v of videos || []) {
    const a = String(v.date || '').slice(0, 4)
    if (/^\d{4}$/.test(a)) annees.add(a)
  }
  return [...annees].sort().reverse()
}

// Découpe un texte en morceaux { texte, trouve } pour surligner les mots
// recherchés SANS v-html : la correspondance se fait sur la forme normalisée
// (sans accents ni casse), le texte affiché reste l'original.
function caractereNormalise(c) {
  const base = c.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  return /^[a-z0-9]$/.test(base) ? base : ' '
}

export function surligner(texte, requete) {
  const original = String(texte || '')
  const mots = motsDe(requete)
  if (!mots.length || !original) return [{ texte: original, trouve: false }]
  const chars = [...original]
  const normalise = chars.map(caractereNormalise).join('')
  const marque = new Array(chars.length).fill(false)
  for (const m of mots) {
    let i = normalise.indexOf(m)
    while (i !== -1) {
      for (let k = i; k < i + m.length; k++) marque[k] = true
      i = normalise.indexOf(m, i + m.length)
    }
  }
  const morceaux = []
  for (let i = 0; i < chars.length; i++) {
    const dernier = morceaux[morceaux.length - 1]
    if (dernier && dernier.trouve === marque[i]) dernier.texte += chars[i]
    else morceaux.push({ texte: chars[i], trouve: marque[i] })
  }
  return morceaux
}

// ── Recherche dans les paroles (sous-titres) ──────────────────────────────
// Fichier reçu de /api/predications/paroles : une ligne JSON par vidéo
// { id, p: [[seconde, texte], …] }. Une vidéo peut apparaître plusieurs fois
// (re-traitée) : la dernière ligne l'emporte.

export function indexerParoles(ndjson) {
  const index = new Map()
  for (const ligne of String(ndjson || '').split('\n')) {
    if (!ligne.trim()) continue
    let entree
    try { entree = JSON.parse(ligne) } catch { continue }
    if (!entree?.id || !Array.isArray(entree.p)) continue
    // Texte normalisé de toute la vidéo, avec le point de départ de chaque
    // passage : une expression à cheval sur deux passages est trouvée aussi.
    let texte = ' '
    const debuts = []
    for (const [t, brut] of entree.p) {
      debuts.push(texte.length)
      texte += normaliser(brut) + ' '
    }
    index.set(entree.id, { texte, debuts, passages: entree.p })
  }
  return index
}

function passageA(debuts, position) {
  let bas = 0
  let haut = debuts.length - 1
  while (bas < haut) {
    const milieu = (bas + haut + 1) >> 1
    if (debuts[milieu] <= position) bas = milieu
    else haut = milieu - 1
  }
  return bas
}

/**
 * Moments où l'expression recherchée est dite (mots entiers, dans l'ordre,
 * sans accents ni casse). Un passage n'est compté qu'une fois par occurrence.
 */
export function chercherDansParoles(entree, requete) {
  const expression = motsDe(requete).join(' ')
  if (!entree || !expression) return []
  const cible = ` ${expression} `
  const moments = []
  let i = entree.texte.indexOf(cible)
  while (i !== -1) {
    const n = passageA(entree.debuts, i + 1)
    const [t, texte] = entree.passages[n]
    moments.push({ t, extrait: texte })
    i = entree.texte.indexOf(cible, i + cible.length - 1)
  }
  return moments
}

/**
 * Titres/descriptions ET paroles : une vidéo trouvée par l'un ou l'autre.
 * Celles dont le titre correspond d'abord, puis par nombre d'occurrences
 * dans les paroles, puis de la plus récente à la plus ancienne.
 */
export function rechercherAvecParoles(videos, requete, { annee = '', paroles = null } = {}) {
  const parTitre = rechercherVideos(videos, requete, { annee })
  const ids = new Set(parTitre.map((v) => v.id))
  const resultats = parTitre.map((video, rang) => ({ video, rang, moments: [] }))
  if (paroles && motsDe(requete).length) {
    for (const r of resultats) r.moments = chercherDansParoles(paroles.get(r.video.id), requete)
    for (const video of videos || []) {
      if (ids.has(video.id)) continue
      if (annee && String(video.date || '').slice(0, 4) !== String(annee)) continue
      const moments = chercherDansParoles(paroles.get(video.id), requete)
      if (moments.length) resultats.push({ video, rang: Infinity, moments })
    }
    resultats.sort((a, b) =>
      (a.rang === Infinity) - (b.rang === Infinity)
      || (a.rang !== Infinity ? a.rang - b.rang : 0)
      || b.moments.length - a.moments.length
      || String(b.video.date || '').localeCompare(String(a.video.date || '')))
  }
  return resultats
}

export function formaterMoment(secondes) {
  const s = Math.max(0, Math.floor(Number(secondes) || 0))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`
}
