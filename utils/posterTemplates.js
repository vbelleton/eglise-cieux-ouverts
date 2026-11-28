// Modèles d'affiches d'agenda : un fond sans les textes variables (date,
// heure…) + des zones de texte réécrites dans le style d'origine. Une fiche
// d'agenda dont l'image est le fond d'un modèle a une affiche par séance,
// générée à l'affichage (voir « Affiche automatique » plus bas).
//
// Les fonds viennent du PowerPoint exporté de Canva (« Annonces
// Présentation.pptx ») : chaque affiche y est en calques séparés, on empile
// les calques image sans les zones de texte variables — pas d'effacement
// automatique, donc pas de trace. Les positions, tailles et couleurs sont
// relevées sur l'affiche d'origine (coordonnées en pixels du fond 1600×900).
//
// Polices : seules des polices libres (OFL) servies depuis public/fonts/affiches
// — les polices payantes des affiches Canva (Telegraf, ITC Benguiat) restent
// figées dans le fond. « 19H30 » était en Telegraf Bold : Lexend 800 est la
// police libre la plus proche (mesurée sur l'affiche d'origine).
//
// Ajouter un modèle : déposer le fond dans public/affiches/modeles/ et
// décrire ses zones ci-dessous (voir FEATURES.md, « Affiches d'agenda »).

export const POLICES_AFFICHES = [
  { famille: 'DM Sans Affiche', fichier: '/fonts/affiches/dm-sans-700.ttf', graisse: '700' },
  { famille: 'Lexend Affiche', fichier: '/fonts/affiches/lexend-800.ttf', graisse: '800' },
]

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

// « Vendredi 27 novembre » — date au format AAAA-MM-JJ (lue en heure locale :
// new Date('2026-11-27') serait minuit UTC, donc la veille aux Antilles).
export function dateEnToutesLettres(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '')
  if (!m) return ''
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  const jour = JOURS[d.getDay()]
  return `${jour.charAt(0).toUpperCase()}${jour.slice(1)} ${d.getDate()} ${MOIS[d.getMonth()]}`
}

// « 19:30 » → « 19H30 », « 20:00 » → « 20H » (usage des affiches existantes).
export function heureAffiche(hhmm) {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm || '')
  if (!m) return ''
  return `${Number(m[1])}H${m[2] === '00' ? '' : m[2]}`
}

export const MODELES_AFFICHES = [
  {
    id: 'soiree-cieux-ouverts',
    libelle: 'Soirée Cieux Ouverts',
    // Titres de fiche d'agenda auxquels ce modèle est proposé en premier.
    motsCles: ['soirée cieux ouverts'],
    fond: '/affiches/modeles/soiree-cieux-ouverts.jpg',
    largeur: 1600,
    hauteur: 900,
    zones: [
      {
        cle: 'date',
        libelle: 'Date',
        valeur: ({ date }) => dateEnToutesLettres(date),
        x: 47, // bord gauche de l'encre
        haut: 712, // haut de l'encre (majuscules / hampes)
        largeurMax: 1000,
        famille: 'DM Sans Affiche',
        graisse: '700',
        taille: 62,
        couleur: '#FFFFFF',
        ombre: { couleur: 'rgba(40, 20, 10, 0.28)', flou: 14 },
      },
      {
        cle: 'heure',
        libelle: 'Heure',
        valeur: ({ heure }) => heureAffiche(heure),
        x: 57,
        haut: 791,
        largeurMax: 700,
        famille: 'Lexend Affiche',
        graisse: '800',
        taille: 91,
        espacement: -0.04, // en em, comme le resserrement de l'original
        couleur: '#104770',
      },
    ],
  },
]

// Titre sans emoji ni pictogramme : les polices des affiches n'en ont pas.
function titreAffiche(titre) {
  return String(titre || '')
    .replace(/[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\uFE0F\u200D]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

// « chaque mardi » → « Chaque mardi ».
function rythmeAffiche(rythme) {
  const r = String(rythme || '').trim()
  return r ? r.charAt(0).toUpperCase() + r.slice(1) : ''
}

// Modèle pour tout événement : le titre, le rythme (« Chaque mardi »), la
// date et l'heure viennent de la fiche. Sert à tous les événements sans
// modèle à eux, y compris les rendez-vous récurrents.
MODELES_AFFICHES.push({
  id: 'evenement',
  libelle: 'Tout événement (titre, rythme, date et heure de la fiche)',
  motsCles: [],
  fond: '/affiches/modeles/evenement.jpg',
  largeur: 1600,
  hauteur: 900,
  zones: [
    {
      cle: 'titre',
      libelle: 'Titre',
      valeur: ({ titre }) => titreAffiche(titre),
      x: 90,
      haut: 96,
      largeurMax: 1420,
      lignesMax: 3,
      interligne: 1.08,
      famille: 'DM Sans Affiche',
      graisse: '700',
      taille: 132,
      couleur: '#104770',
    },
    {
      cle: 'rythme',
      libelle: 'Rythme',
      valeur: ({ rythme }) => rythmeAffiche(rythme),
      x: 94,
      haut: 538,
      largeurMax: 1300,
      famille: 'DM Sans Affiche',
      graisse: '700',
      taille: 58,
      couleur: '#c2455a',
    },
    {
      cle: 'date',
      libelle: 'Date',
      valeur: ({ date }) => dateEnToutesLettres(date),
      x: 94,
      haut: 700,
      largeurMax: 1000,
      famille: 'DM Sans Affiche',
      graisse: '700',
      taille: 62,
      couleur: '#104770',
    },
    {
      cle: 'heure',
      libelle: 'Heure',
      valeur: ({ heure }) => heureAffiche(heure),
      x: 98,
      haut: 780,
      largeurMax: 700,
      famille: 'Lexend Affiche',
      graisse: '800',
      taille: 91,
      espacement: -0.04,
      couleur: '#104770',
    },
  ],
})

export function modeleParId(id) {
  return MODELES_AFFICHES.find(m => m.id === id) || null
}

// Modèle le plus probable pour une fiche d'agenda (par son titre), sinon le premier.
export function modelePourEvenement(titre) {
  const t = (titre || '').toLowerCase()
  return MODELES_AFFICHES.find(m => m.motsCles.some(k => t.includes(k))) || modeleParId('evenement') || MODELES_AFFICHES[0]
}

export function textesParDefaut(modele, { date, heure, titre, rythme } = {}) {
  return Object.fromEntries(modele.zones.map(z => [z.cle, z.valeur({ date, heure, titre, rythme })]))
}

let policesChargees = null
// Charge les polices une fois (FontFace : le canvas ne dessine qu'avec des
// polices déjà chargées — sinon il retombe en silence sur une police système).
export function chargerPolicesAffiches() {
  if (!policesChargees) {
    policesChargees = Promise.all(POLICES_AFFICHES.map(async (p) => {
      const face = new FontFace(p.famille, `url(${p.fichier})`, { weight: p.graisse })
      await face.load()
      document.fonts.add(face)
    })).catch((err) => { policesChargees = null; throw err })
  }
  return policesChargees
}

const fondsCharges = new Map()
function chargerFond(url) {
  if (!fondsCharges.has(url)) {
    fondsCharges.set(url, new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => { fondsCharges.delete(url); reject(new Error('Fond d\'affiche introuvable')) }
      img.src = url
    }))
  }
  return fondsCharges.get(url)
}

function largeurTexte(ctx, texte, espacementPx) {
  if (!espacementPx) return ctx.measureText(texte).width
  return [...texte].reduce((w, c) => w + ctx.measureText(c).width + espacementPx, 0) - espacementPx
}

// Coupe un texte en lignes de `largeurMax` au plus (aux espaces).
function decouper(ctx, texte, largeurMax) {
  const lignes = []
  let courante = ''
  for (const mot of texte.split(/\s+/)) {
    const essai = courante ? `${courante} ${mot}` : mot
    if (courante && ctx.measureText(essai).width > largeurMax) { lignes.push(courante); courante = mot } else courante = essai
  }
  if (courante) lignes.push(courante)
  return lignes
}

// Zone sur plusieurs lignes (titre) : la plus grande taille, au plus la taille
// de départ, pour laquelle le texte tient en `lignesMax` lignes dans la
// largeur ET dans la hauteur prévues.
function dessinerZoneLignes(ctx, zone, texte) {
  const police = t => `${zone.graisse} ${t}px "${zone.famille}"`
  const interligne = zone.interligne || 1.1
  const hauteurMax = zone.hauteurMax || 430
  let taille = zone.taille
  let lignes = []
  for (; taille >= 24; taille -= 2) {
    ctx.font = police(taille)
    lignes = decouper(ctx, texte, zone.largeurMax)
    const largeurOk = lignes.every(l => ctx.measureText(l).width <= zone.largeurMax)
    const hauteur = taille * interligne * (lignes.length - 1) + taille
    if (lignes.length <= (zone.lignesMax || 1) && largeurOk && hauteur <= hauteurMax) break
  }
  ctx.font = police(taille)
  ctx.save()
  ctx.fillStyle = zone.couleur
  ctx.textBaseline = 'alphabetic'
  const m0 = ctx.measureText(lignes[0] || 'H')
  lignes.forEach((l, i) => {
    const m = ctx.measureText(l)
    ctx.fillText(l, zone.x + m.actualBoundingBoxLeft, zone.haut + m0.actualBoundingBoxAscent + i * taille * interligne)
  })
  ctx.restore()
}

function dessinerZone(ctx, zone, texte) {
  if (!texte) return
  if (zone.lignesMax) return dessinerZoneLignes(ctx, zone, texte)
  let taille = zone.taille
  const police = t => `${zone.graisse} ${t}px "${zone.famille}"`
  ctx.font = police(taille)
  // Texte trop long pour la place prévue : on réduit plutôt que de déborder.
  const largeur = largeurTexte(ctx, texte, (zone.espacement || 0) * taille)
  if (zone.largeurMax && largeur > zone.largeurMax) {
    taille = Math.floor(taille * zone.largeurMax / largeur)
    ctx.font = police(taille)
  }
  const espacementPx = (zone.espacement || 0) * taille
  const mesure = ctx.measureText(texte)
  const y = zone.haut + mesure.actualBoundingBoxAscent
  let x = zone.x + mesure.actualBoundingBoxLeft
  ctx.save()
  ctx.fillStyle = zone.couleur
  ctx.textBaseline = 'alphabetic'
  if (zone.ombre) {
    ctx.shadowColor = zone.ombre.couleur
    ctx.shadowBlur = zone.ombre.flou
  }
  if (!espacementPx) {
    ctx.fillText(texte, x, y)
  } else {
    for (const c of texte) {
      ctx.fillText(c, x, y)
      x += ctx.measureText(c).width + espacementPx
    }
  }
  ctx.restore()
}

// Dessine l'affiche dans `canvas` (redimensionné au format du fond).
export async function dessinerAffiche(canvas, modele, textes) {
  const [fond] = await Promise.all([chargerFond(modele.fond), chargerPolicesAffiches()])
  canvas.width = modele.largeur
  canvas.height = modele.hauteur
  const ctx = canvas.getContext('2d')
  ctx.drawImage(fond, 0, 0, modele.largeur, modele.hauteur)
  for (const zone of modele.zones) dessinerZone(ctx, zone, (textes?.[zone.cle] || '').trim())
  return canvas
}

// ── Affiche automatique ─────────────────────────────────────────────
// Une fiche d'agenda dont l'image est le FOND d'un modèle (image_url =
// "/affiches/modeles/<id>.jpg", choisi dans l'admin) a une affiche par
// séance : la date et l'heure de chaque occurrence sont écrites à
// l'affichage, dans le navigateur. Rien à refaire chaque mois, et un
// changement d'heure dans la fiche se répercute tout seul. Un site qui ne
// connaît pas ce mécanisme (Bras Ouverts, ancien cache) montre le fond seul :
// titre et logo restent lisibles.

// Modèle dont `url` est le fond (adresse relative ou absolue), sinon null.
export function modelePourImage(url) {
  if (!url || typeof url !== 'string') return null
  let chemin = url
  try { chemin = new URL(url, 'https://x.invalid').pathname } catch { return null }
  return MODELES_AFFICHES.find(m => m.fond === chemin) || null
}

// Date AAAA-MM-JJ d'une occurrence (Date ou chaîne), en heure locale.
function jourIso(date) {
  if (!date) return ''
  if (typeof date === 'string') return date.slice(0, 10)
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const affichesGenerees = new Map()
// Adresse (blob:) de l'affiche de cette séance, générée une seule fois par
// modèle + date + heure. Client uniquement.
export function afficheSeance(modele, { date, heure, titre, rythme } = {}) {
  const jour = jourIso(date)
  const cle = `${modele.id}|${jour}|${heure || ''}|${titre || ''}|${rythme || ''}`
  if (!affichesGenerees.has(cle)) {
    affichesGenerees.set(cle, (async () => {
      const canvas = document.createElement('canvas')
      await dessinerAffiche(canvas, modele, textesParDefaut(modele, { date: jour, heure, titre, rythme }))
      const blob = await new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Affiche impossible'))), 'image/jpeg', 0.88))
      return URL.createObjectURL(blob)
    })().catch((err) => { affichesGenerees.delete(cle); throw err }))
  }
  return affichesGenerees.get(cle)
}
