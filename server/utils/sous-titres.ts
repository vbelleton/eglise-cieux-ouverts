// Sous-titres des prédications : fonctions pures (testées dans
// tests/unit/paroles-predications.spec.ts), sans accès réseau ni stockage.

/** Un passage : seconde de début, texte. */
export type Passage = [number, string]

export interface PisteSousTitres {
  id: string
  langue: string
  type: string // 'standard' (saisis), 'asr' (automatiques), 'forced'
}

/**
 * Choix de la piste à télécharger : français d'abord, sous-titres saisis à la
 * main de préférence aux automatiques (plus fiables), sinon n'importe quelle
 * piste.
 */
export function choisirPiste(items: any[]): PisteSousTitres | null {
  const pistes: PisteSousTitres[] = (items || [])
    .map((it) => ({
      id: String(it?.id || ''),
      langue: String(it?.snippet?.language || '').toLowerCase(),
      type: String(it?.snippet?.trackKind || '').toLowerCase(),
    }))
    .filter((p) => p.id)
  const rang = (p: PisteSousTitres) =>
    (p.langue.startsWith('fr') ? 0 : 10) + (p.type === 'standard' ? 0 : p.type === 'asr' ? 1 : 2)
  pistes.sort((a, b) => rang(a) - rang(b))
  return pistes[0] || null
}

function secondes(horodatage: string): number {
  // « H:MM:SS.mmm » (SBV) ou « HH:MM:SS.mmm » / « MM:SS.mmm » (VTT)
  const parties = horodatage.trim().replace(',', '.').split(':').map(Number)
  if (parties.some((n) => Number.isNaN(n))) return NaN
  return parties.reduce((total, n) => total * 60 + n, 0)
}

function nettoyer(texte: string): string {
  return texte
    .replace(/<[^>]*>/g, '') // balises VTT (<c>, <00:00:01.000>…)
    .replace(/\[[^\]]*\]/g, '') // [Musique], [Applaudissements]…
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Fichier de sous-titres (SBV ou WebVTT) → passages horodatés. Les lignes
 * répétées d'un bloc au suivant (défilement des sous-titres automatiques)
 * ne sont gardées qu'une fois.
 */
export function lireSousTitres(contenu: string): Passage[] {
  const passages: Passage[] = []
  let precedent = ''
  for (const bloc of String(contenu || '').replace(/\r/g, '').split(/\n{2,}/)) {
    const lignes = bloc.split('\n').map((l) => l.trim()).filter(Boolean)
    const iTemps = lignes.findIndex((l) => /^\d{1,2}:\d{2}(:\d{2})?[.,]\d{1,3}\s*(,|-->)/.test(l))
    if (iTemps === -1) continue
    const debut = secondes(lignes[iTemps].split(/,(?=\d)|-->/)[0])
    if (!Number.isFinite(debut)) continue
    let texte = nettoyer(lignes.slice(iTemps + 1).join(' '))
    if (!texte) continue
    // Sous-titres automatiques : le bloc reprend souvent la fin du précédent.
    if (precedent && texte.startsWith(precedent)) texte = texte.slice(precedent.length).trim()
    if (!texte) continue
    precedent = nettoyer(lignes.slice(iTemps + 1).join(' '))
    passages.push([Math.floor(debut), texte])
  }
  return passages
}

/** Ligne du fichier des paroles (une ligne JSON par vidéo). */
export function ligneParoles(id: string, passages: Passage[]): string {
  return JSON.stringify({ id, p: passages }) + '\n'
}
