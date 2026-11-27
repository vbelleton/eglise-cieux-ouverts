// Modèles d'affiches d'agenda : un fond sans les textes variables (date,
// heure…) + des zones de texte réécrites dans le style d'origine.
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

export function modeleParId(id) {
  return MODELES_AFFICHES.find(m => m.id === id) || null
}

// Modèle le plus probable pour une fiche d'agenda (par son titre), sinon le premier.
export function modelePourEvenement(titre) {
  const t = (titre || '').toLowerCase()
  return MODELES_AFFICHES.find(m => m.motsCles.some(k => t.includes(k))) || MODELES_AFFICHES[0]
}

export function textesParDefaut(modele, { date, heure } = {}) {
  return Object.fromEntries(modele.zones.map(z => [z.cle, z.valeur({ date, heure })]))
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

function dessinerZone(ctx, zone, texte) {
  if (!texte) return
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

export function nomFichierAffiche(modele, date) {
  return `affiche-${modele.id}${date ? '-' + date : ''}.jpg`
}

export function canvasEnFichier(canvas, nom) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error('Impossible de créer l\'image'))
      resolve(new File([blob], nom, { type: 'image/jpeg' }))
    }, 'image/jpeg', 0.9)
  })
}
