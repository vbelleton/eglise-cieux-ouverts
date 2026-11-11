// Les 66 livres de la Bible (ordre protestant), codes USFM (fichiers
// public/bible/lsg/<code>.json, scripts/construire-bible.mjs) et noms français
// de la Louis Segond. `abr` : formes reconnues en plus du nom dans les titres
// et descriptions de prédications (comparaison sans accents ni casse).
export const LIVRES_BIBLE = [
  ['GEN', 'Genèse', ['gn', 'gen']],
  ['EXO', 'Exode', ['ex', 'exo']],
  ['LEV', 'Lévitique', ['lv', 'lev']],
  ['NUM', 'Nombres', ['nb', 'nomb']],
  ['DEU', 'Deutéronome', ['dt', 'deut']],
  ['JOS', 'Josué', ['jos']],
  ['JDG', 'Juges', ['jg', 'jug']],
  ['RUT', 'Ruth', ['rt']],
  ['1SA', '1 Samuel', ['1 s', '1 sam']],
  ['2SA', '2 Samuel', ['2 s', '2 sam']],
  ['1KI', '1 Rois', ['1 r']],
  ['2KI', '2 Rois', ['2 r']],
  ['1CH', '1 Chroniques', ['1 ch', '1 chr']],
  ['2CH', '2 Chroniques', ['2 ch', '2 chr']],
  ['EZR', 'Esdras', ['esd']],
  ['NEH', 'Néhémie', ['ne', 'neh']],
  ['EST', 'Esther', ['est']],
  ['JOB', 'Job', ['jb']],
  ['PSA', 'Psaumes', ['ps', 'psaume']],
  ['PRO', 'Proverbes', ['pr', 'prov']],
  ['ECC', 'Ecclésiaste', ['ec', 'eccl', 'qohelet']],
  ['SNG', 'Cantique des cantiques', ['ct', 'cant', 'cantique']],
  ['ISA', 'Ésaïe', ['es', 'is', 'isaie']],
  ['JER', 'Jérémie', ['jr', 'jer']],
  ['LAM', 'Lamentations', ['lm', 'lam']],
  ['EZK', 'Ézéchiel', ['ez', 'ezech']],
  ['DAN', 'Daniel', ['dn', 'dan']],
  ['HOS', 'Osée', ['os']],
  ['JOL', 'Joël', ['jl']],
  ['AMO', 'Amos', ['am']],
  ['OBA', 'Abdias', ['ab']],
  ['JON', 'Jonas', ['jon']],
  ['MIC', 'Michée', ['mi']],
  ['NAM', 'Nahum', ['na']],
  ['HAB', 'Habacuc', ['ha']],
  ['ZEP', 'Sophonie', ['so']],
  ['HAG', 'Aggée', ['ag']],
  ['ZEC', 'Zacharie', ['za']],
  ['MAL', 'Malachie', ['ml']],
  ['MAT', 'Matthieu', ['mt', 'matt']],
  ['MRK', 'Marc', ['mc']],
  ['LUK', 'Luc', ['lc']],
  ['JHN', 'Jean', ['jn']],
  ['ACT', 'Actes', ['ac', 'act']],
  ['ROM', 'Romains', ['rm', 'rom']],
  ['1CO', '1 Corinthiens', ['1 co', '1 cor']],
  ['2CO', '2 Corinthiens', ['2 co', '2 cor']],
  ['GAL', 'Galates', ['ga', 'gal']],
  ['EPH', 'Éphésiens', ['ep', 'eph']],
  ['PHP', 'Philippiens', ['ph', 'phil']],
  ['COL', 'Colossiens', ['col']],
  ['1TH', '1 Thessaloniciens', ['1 th', '1 thes']],
  ['2TH', '2 Thessaloniciens', ['2 th', '2 thes']],
  ['1TI', '1 Timothée', ['1 tm', '1 tim']],
  ['2TI', '2 Timothée', ['2 tm', '2 tim']],
  ['TIT', 'Tite', ['tt']],
  ['PHM', 'Philémon', ['phm']],
  ['HEB', 'Hébreux', ['he', 'heb']],
  ['JAS', 'Jacques', ['jc', 'jac']],
  ['1PE', '1 Pierre', ['1 p', '1 pi']],
  ['2PE', '2 Pierre', ['2 p', '2 pi']],
  ['1JN', '1 Jean', ['1 jn']],
  ['2JN', '2 Jean', ['2 jn']],
  ['3JN', '3 Jean', ['3 jn']],
  ['JUD', 'Jude', ['jd']],
  ['REV', 'Apocalypse', ['ap', 'apoc']],
].map(([code, nom, abr]) => ({ code, nom, abr }))

export const LIVRE_PAR_CODE = Object.fromEntries(LIVRES_BIBLE.map((l) => [l.code, l]))

const sansAccents = (s) =>
  String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

// Formes reconnues, de la plus longue à la plus courte (« 1 Jean » avant
// « Jean »). Les abréviations de deux lettres et moins ne sont acceptées
// qu'avec un chapitre ET un verset (« Jn 3.16 ») : seules, elles se
// confondent trop avec des mots (« es », « ne », « ex »…). Un nombre suivi
// d'un mois ou d'une heure est une date (« Marc 12 mai », « Jean 10 h »).
const FORMES = LIVRES_BIBLE.flatMap((l) => [
  { forme: sansAccents(l.nom), code: l.code, stricte: false },
  ...l.abr.map((a) => ({ forme: sansAccents(a), code: l.code, stricte: a.replace(/^\d\s*/, '').length <= 2 })),
]).sort((a, b) => b.forme.length - a.forme.length)

const echapper = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s*')
const MOTIF = new RegExp(
  `(?<![\\p{L}\\d])(${FORMES.map((f) => echapper(f.forme)).join('|')})\\.?\\s+(\\d{1,3})(?:\\s*[.:,v]\\s*(\\d{1,3})(?:\\s*[-–]\\s*(\\d{1,3}))?)?(?![\\p{L}\\d])(?!\\s*(?:janv|fevr|mars|avr|mai|juin|juil|aout|sept|oct|nov|dec|h\\b|heures?))`,
  'giu',
)

/**
 * Passages bibliques cités dans un texte : [{ code, chapitre, verset?, versetFin? }],
 * dans l'ordre d'apparition, sans doublon (livre + chapitre).
 */
export function trouverPassages(texte) {
  const sa = sansAccents(texte || '')
  const vus = new Set()
  const passages = []
  for (const m of sa.matchAll(MOTIF)) {
    const forme = m[1].replace(/\s+/g, ' ')
    const trouvee = FORMES.find((f) => f.forme === forme)
    if (!trouvee) continue
    if (trouvee.stricte && !m[3]) continue
    const chapitre = Number(m[2])
    const verset = m[3] ? Number(m[3]) : null
    const cle = `${trouvee.code}${chapitre}`
    if (vus.has(cle)) continue
    vus.add(cle)
    passages.push({ code: trouvee.code, chapitre, verset, versetFin: m[4] ? Number(m[4]) : null })
  }
  return passages
}

export function nomPassage(p) {
  const nom = LIVRE_PAR_CODE[p.code]?.nom || p.code
  const v = p.verset ? `.${p.verset}${p.versetFin ? `-${p.versetFin}` : ''}` : ''
  return `${nom} ${p.chapitre}${v}`
}
