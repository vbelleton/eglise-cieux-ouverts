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
