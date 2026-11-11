// Salle de prière du mode VR (/vr), posée dans le monde de lib/vr/scene.js :
// - en face, un pupitre avec la Bible (Louis Segond 1910) : livres, chapitres,
//   pages, passage surligné ;
// - à gauche, les prochains rendez-vous de l'agenda ;
// - à droite, les dernières prédications : un passage cité dans le titre ou
//   la description (« Luc 15 ») ouvre la Bible à cet endroit ;
// - « Lieux » : choisir où prier (chapelle, jardin, bord de mer, ciel) ;
// - « Prier » (temps de prière) : les panneaux s'effacent, la lumière se réchauffe et
//   les versets du chapitre ouvert apparaissent un à un pendant 3 minutes.
//
// Tout est dessiné au canvas puis plaqué sur des plans. Viser un panneau
// (manette, clic, toucher, centre de l'écran en mode carton) donne la
// position visée sur la texture (uv) : chaque dessin enregistre ses zones
// cliquables, qu'on retrouve à partir de cette position.
import { couper } from './scene.js'
import { chargerLivre, livreVoisin, passageDuJour } from './bible.js'
import { LIEUX } from './lieux/index.js'
import { LIVRES_BIBLE, LIVRE_PAR_CODE, nomPassage } from '~/utils/livresBible.js'

const BLEU = '#064886'
const ROSE = '#d97777'
const GRIS = '#4a6378'
const SERIF = '"Playfair Display", Georgia, serif'
const SANS = '"Nunito", "Segoe UI", Arial, sans-serif'
const DUREE_PRIERE = 180
const DUREE_VERSET = 16

const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
const JOURS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.']

// --- Panneau dessiné au canvas, avec zones cliquables ------------------------

function creerPanneau(monde, lpx, hpx, largeurM) {
  const { THREE } = monde
  const canvas = document.createElement('canvas')
  canvas.width = lpx
  canvas.height = hpx
  const ctx = canvas.getContext('2d')
  const texture = monde.garder(new THREE.CanvasTexture(canvas))
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = Math.min(8, monde.renderer.capabilities.getMaxAnisotropy())
  const mesh = new THREE.Mesh(
    monde.garder(new THREE.PlaneGeometry(largeurM, (largeurM * hpx) / lpx)),
    monde.garder(new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false })),
  )
  const p = {
    mesh,
    ctx,
    l: lpx,
    h: hpx,
    zones: [],
    opacite: 0,
    cible: 1,
    commencer() {
      p.zones = []
      ctx.clearRect(0, 0, lpx, hpx)
      ctx.save()
      ctx.shadowColor = 'rgba(6,72,134,0.18)'
      ctx.shadowBlur = 24
      ctx.fillStyle = 'rgba(255,253,247,0.985)'
      arrondi(ctx, 12, 12, lpx - 24, hpx - 24, 36)
      ctx.fill()
      ctx.restore()
      ctx.strokeStyle = 'rgba(217,119,119,0.45)'
      ctx.lineWidth = 3
      arrondi(ctx, 12, 12, lpx - 24, hpx - 24, 36)
      ctx.stroke()
    },
    zone(x, y, w, h, action) {
      p.zones.push({ x, y, w, h, action })
    },
    finir() {
      texture.needsUpdate = true
    },
  }
  mesh.userData.surVisee = (uv) => {
    if (!uv) return
    const x = uv.x * lpx
    const y = (1 - uv.y) * hpx
    p.zones.find((z) => x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h)?.action()
  }
  mesh.material.opacity = 0
  mesh.visible = false
  monde.scene.add(mesh)
  monde.ajouterInteractif(mesh)
  return p
}

function arrondi(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function texte(ctx, t, x, y, police, couleur = BLEU, align = 'left') {
  ctx.font = police
  ctx.fillStyle = couleur
  ctx.textAlign = align
  ctx.textBaseline = 'middle'
  ctx.fillText(t, x, y)
}

function bouton(p, x, y, w, h, libelle, action, { plein = false, desactive = false } = {}) {
  const { ctx } = p
  ctx.globalAlpha = desactive ? 0.35 : 1
  arrondi(ctx, x, y, w, h, h / 2)
  ctx.fillStyle = plein ? BLEU : 'rgba(255,255,255,0.9)'
  ctx.fill()
  ctx.lineWidth = 3
  ctx.strokeStyle = BLEU
  ctx.stroke()
  texte(ctx, libelle, x + w / 2, y + h / 2 + 1, `700 30px ${SANS}`, plein ? '#fff' : BLEU, 'center')
  ctx.globalAlpha = 1
  if (!desactive) p.zone(x, y, w, h, action)
}

/** Rangée de boutons centrée : [{ libelle, action, largeur, plein, desactive }]. */
function rangeeBoutons(p, y, boutons) {
  const ecart = 18
  const total = boutons.reduce((t, b) => t + b.largeur, 0) + ecart * (boutons.length - 1)
  let x = (p.l - total) / 2
  for (const b of boutons) {
    bouton(p, x, y, b.largeur, 78, b.libelle, b.action, b)
    x += b.largeur + ecart
  }
}

/** Écrit `t` sur au plus `max` lignes en réduisant la police si besoin. */
function texteAjuste(ctx, t, x, y, largeur, taille, police, couleur, align = 'left', max = 1) {
  let tl = taille
  ctx.font = police(tl)
  while (tl > 16 && max === 1 && ctx.measureText(t).width > largeur) ctx.font = police(--tl)
  const lignes = couper(ctx, t, largeur, max)
  lignes.forEach((li, i) => texte(ctx, li, x, y + i * tl * 1.2, police(tl), couleur, align))
  return lignes.length * tl * 1.2
}

// -----------------------------------------------------------------------------

export function creerSalle(monde, { surAction = () => {} } = {}) {
  const { THREE } = monde
  const panneaux = []

  const placer = (p, angleDeg, distance, y) => {
    const a = THREE.MathUtils.degToRad(angleDeg)
    p.mesh.position.set(Math.sin(a) * distance, y, -Math.cos(a) * distance)
    p.mesh.lookAt(0, y, 0)
    panneaux.push(p)
  }

  // === Pupitre : la Bible ======================================================

  const pupitre = creerPanneau(monde, 1024, 1408, 1.5)
  placer(pupitre, 0, 2.35, 1.38)
  pupitre.mesh.rotateX(-0.08)

  const HAUT_CORPS = 190
  const BAS_CORPS = 1250
  const INTERLIGNE = 47
  const etat = { vue: 'lecture', choix: null, livreChoix: null, code: null, chapitre: 1, page: 0, pages: [], surligne: null, livre: null, chargement: true, erreur: null }

  function mettreEnPage(versets) {
    const { ctx } = pupitre
    const largeur = pupitre.l - 120
    const lignes = []
    versets.forEach((v, i) => {
      if (!v) return
      ctx.font = `700 22px ${SANS}`
      const num = String(i + 1)
      const lNum = ctx.measureText(num).width + 10
      ctx.font = `34px ${SERIF}`
      const morceaux = couper(ctx, v, largeur - lNum, 99)
      morceaux.forEach((m, j) => lignes.push({ verset: i + 1, num: j === 0 ? num : null, texte: m, retrait: lNum }))
    })
    const parPage = Math.floor((BAS_CORPS - HAUT_CORPS) / INTERLIGNE)
    const pages = []
    for (let i = 0; i < lignes.length; i += parPage) pages.push(lignes.slice(i, i + parPage))
    return pages.length ? pages : [[]]
  }

  function dessinerPupitre() {
    const p = pupitre
    const { ctx } = p
    p.commencer()
    const nomLivre = LIVRE_PAR_CODE[etat.code]?.nom || ''

    if (etat.vue === 'lieux') {
      texte(ctx, 'Où voulez-vous prier ?', p.l / 2, 90, `600 54px ${SERIF}`, BLEU, 'center')
      texte(ctx, 'Le pupitre et les panneaux vous suivent', p.l / 2, 145, `24px ${SANS}`, GRIS, 'center')
      const actuel = monde.lieuActuel()
      const lc = (p.l - 100) / 2
      const rangs = Math.ceil(LIEUX.length / 2)
      const hc = (BAS_CORPS - HAUT_CORPS - 20 * (rangs - 1)) / rangs
      LIEUX.forEach((l, i) => {
        // Une dernière carte seule est centrée.
        const seule = i === LIEUX.length - 1 && LIEUX.length % 2 === 1
        const x = seule ? (p.l - lc) / 2 : 40 + (i % 2) * (lc + 20)
        const y = HAUT_CORPS + Math.floor(i / 2) * (hc + 20)
        // Vignette : dégradé aux couleurs du lieu, du sol vers le ciel.
        const g = ctx.createLinearGradient(0, y + hc, 0, y)
        l.couleurs.forEach((c, j) => g.addColorStop(j / (l.couleurs.length - 1), c))
        arrondi(ctx, x, y, lc, hc, 26)
        ctx.fillStyle = g
        ctx.fill()
        ctx.lineWidth = l.id === actuel ? 10 : 3
        ctx.strokeStyle = l.id === actuel ? ROSE : 'rgba(6,72,134,0.35)'
        ctx.stroke()
        arrondi(ctx, x + 20, y + hc - 170, lc - 40, 150, 18)
        ctx.fillStyle = 'rgba(255,255,255,0.88)'
        ctx.fill()
        texteAjuste(ctx, l.nom, x + lc / 2, y + hc - 125, lc - 70, 38, (t) => `600 ${t}px ${SERIF}`, BLEU, 'center')
        texteAjuste(ctx, l.description, x + lc / 2, y + hc - 75, lc - 70, 23, (t) => `${t}px ${SANS}`, GRIS, 'center', 2)
        if (l.id === actuel) texte(ctx, 'Vous êtes ici', x + lc / 2, y + 50, `700 26px ${SANS}`, '#fff', 'center')
        p.zone(x, y, lc, hc, () => choisirLieu(l.id))
      })
      rangeeBoutons(p, 1290, [{ libelle: 'Retour au texte', largeur: 320, action: () => changerVue('lecture') }])
    } else if (etat.vue === 'livres') {
      texte(ctx, 'Choisir un livre', p.l / 2, 90, `600 54px ${SERIF}`, BLEU, 'center')
      texte(ctx, 'Ancien Testament en bleu · Nouveau Testament en rose', p.l / 2, 145, `24px ${SANS}`, GRIS, 'center')
      const cols = 6
      const lc = (p.l - 80) / cols
      const hc = (BAS_CORPS - HAUT_CORPS) / Math.ceil(LIVRES_BIBLE.length / cols)
      LIVRES_BIBLE.forEach((l, i) => {
        const x = 40 + (i % cols) * lc
        const y = HAUT_CORPS + Math.floor(i / cols) * hc
        if (l.code === (etat.choix || etat.code)) {
          arrondi(ctx, x + 4, y + 6, lc - 8, hc - 12, 14)
          ctx.fillStyle = 'rgba(6,72,134,0.1)'
          ctx.fill()
        }
        texteAjuste(ctx, l.nom, x + lc / 2, y + hc / 2, lc - 14, 26, (t) => `600 ${t}px ${SANS}`, i < 39 ? BLEU : ROSE, 'center')
        p.zone(x, y, lc, hc, () => choisirLivre(l.code))
      })
      rangeeBoutons(p, 1290, [{ libelle: 'Retour au texte', largeur: 320, action: () => changerVue('lecture') }])
    } else if (etat.vue === 'chapitres') {
      const parcouru = etat.livreChoix || etat.livre
      texte(ctx, LIVRE_PAR_CODE[parcouru?.code]?.nom || '', p.l / 2, 90, `600 54px ${SERIF}`, BLEU, 'center')
      texte(ctx, 'Choisir un chapitre', p.l / 2, 145, `24px ${SANS}`, GRIS, 'center')
      const n = parcouru?.chapitres.length || 0
      const cols = n <= 30 ? 6 : 10
      const lc = (p.l - 80) / cols
      const hc = Math.min(97, (BAS_CORPS - HAUT_CORPS) / Math.ceil(n / cols))
      for (let i = 0; i < n; i++) {
        const x = 40 + (i % cols) * lc
        const y = HAUT_CORPS + Math.floor(i / cols) * hc
        if (parcouru === etat.livre && i + 1 === etat.chapitre) {
          arrondi(ctx, x + 6, y + 4, lc - 12, hc - 8, 14)
          ctx.fillStyle = 'rgba(6,72,134,0.12)'
          ctx.fill()
        }
        texte(ctx, String(i + 1), x + lc / 2, y + hc / 2, `600 ${hc > 70 ? 34 : 28}px ${SANS}`, BLEU, 'center')
        p.zone(x, y, lc, hc, () => ouvrir({ code: parcouru.code, chapitre: i + 1 }))
      }
      rangeeBoutons(p, 1290, [
        { libelle: 'Livres', largeur: 220, action: () => changerVue('livres') },
        { libelle: 'Retour au texte', largeur: 320, action: () => changerVue('lecture') },
      ])
    } else {
      texte(ctx, etat.code ? `${nomLivre} ${etat.chapitre}` : 'La Bible', p.l / 2, 88, `600 58px ${SERIF}`, BLEU, 'center')
      const sous = etat.pages.length > 1 ? `Louis Segond 1910 · page ${etat.page + 1}/${etat.pages.length}` : 'Louis Segond 1910'
      texte(ctx, sous, p.l / 2, 145, `600 24px ${SANS}`, ROSE, 'center')
      if (etat.chargement) texte(ctx, 'Ouverture…', p.l / 2, 600, `italic 34px ${SERIF}`, GRIS, 'center')
      else if (etat.erreur) {
        texte(ctx, 'Ce passage n’a pas pu être chargé.', p.l / 2, 580, `italic 34px ${SERIF}`, GRIS, 'center')
        bouton(p, p.l / 2 - 150, 640, 300, 78, 'Réessayer', () => ouvrir({ code: etat.code, chapitre: etat.chapitre }))
      } else {
        const lignes = etat.pages[etat.page] || []
        lignes.forEach((li, i) => {
          const y = HAUT_CORPS + i * INTERLIGNE + INTERLIGNE / 2
          const s = etat.surligne
          if (s && li.verset >= s.debut && li.verset <= s.fin) {
            ctx.fillStyle = 'rgba(217,119,119,0.16)'
            ctx.fillRect(48, y - INTERLIGNE / 2, p.l - 96, INTERLIGNE)
          }
          if (li.num) texte(ctx, li.num, 60, y - 6, `700 22px ${SANS}`, ROSE)
          texte(ctx, li.texte, 60 + li.retrait, y, `34px ${SERIF}`, '#1d2f40')
        })
      }
      const premierePage = !etat.code || (etat.page === 0 && etat.chapitre === 1 && !livreVoisin(etat.code, -1))
      const dernierePage =
        !etat.livre || (etat.page >= etat.pages.length - 1 && etat.chapitre >= etat.livre.chapitres.length && !livreVoisin(etat.code, 1))
      rangeeBoutons(p, 1290, [
        { libelle: '◀', largeur: 90, action: () => tourner(-1), desactive: premierePage || etat.chargement },
        { libelle: 'Livres', largeur: 150, action: () => changerVue('livres') },
        { libelle: 'Chapitres', largeur: 180, action: () => ((etat.livreChoix = etat.livre), changerVue('chapitres')), desactive: !etat.livre },
        { libelle: 'Lieux', largeur: 140, action: () => changerVue('lieux') },
        { libelle: 'Prier', largeur: 140, action: () => commencerPriere(), plein: true, desactive: !etat.livre },
        { libelle: '▶', largeur: 90, action: () => tourner(1), desactive: dernierePage || etat.chargement },
      ])
    }
    p.finir()
  }

  function choisirLieu(id) {
    monde.changerLieu(id)
    surAction({ type: 'lieu', id })
    changerVue('lecture')
  }

  function changerVue(vue) {
    etat.vue = vue
    // « Chapitres » depuis le texte : ceux du livre ouvert.
    if (vue !== 'livres') etat.livreChoix = vue === 'chapitres' ? etat.livreChoix || etat.livre : null
    if (vue === 'lecture') etat.choix = null
    dessinerPupitre()
  }

  // Parcourir un livre ne change pas le texte ouvert tant qu'on n'a pas
  // choisi de chapitre : « Retour au texte » y revient tel quel.
  async function choisirLivre(code) {
    etat.choix = code
    try {
      const livre = await chargerLivre(code)
      if (etat.choix !== code) return
      if (livre.chapitres.length === 1) return ouvrir({ code, chapitre: 1 })
      etat.livreChoix = livre
      etat.vue = 'chapitres'
    } catch {
      etat.choix = null
    }
    dessinerPupitre()
  }

  let jeton = 0
  /** Ouvre la Bible : { code, chapitre, verset?, versetFin? } ; page -1 = dernière page. */
  async function ouvrir(passage, { page = null } = {}) {
    const moi = ++jeton
    Object.assign(etat, { vue: 'lecture', choix: null, livreChoix: null, code: passage.code, chargement: true, erreur: null, surligne: null })
    dessinerPupitre()
    try {
      const livre = await chargerLivre(passage.code)
      if (moi !== jeton) return
      const chapitre = THREE.MathUtils.clamp(passage.chapitre || 1, 1, livre.chapitres.length)
      Object.assign(etat, { livre, chapitre, chargement: false, pages: mettreEnPage(livre.chapitres[chapitre - 1]) })
      etat.surligne = passage.verset ? { debut: passage.verset, fin: passage.versetFin || passage.verset } : null
      etat.page = page === -1 ? etat.pages.length - 1 : 0
      if (etat.surligne) {
        const i = etat.pages.findIndex((pg) => pg.some((li) => li.verset === etat.surligne.debut))
        if (i >= 0) etat.page = i
      }
    } catch (e) {
      if (moi !== jeton) return
      console.error('[vr] Bible', e)
      Object.assign(etat, { chargement: false, erreur: true, livre: null, pages: [] })
    }
    dessinerPupitre()
  }

  function tourner(sens) {
    const page = etat.page + sens
    if (page >= 0 && page < etat.pages.length) {
      etat.page = page
      return dessinerPupitre()
    }
    const chapitre = etat.chapitre + sens
    if (chapitre >= 1 && chapitre <= etat.livre.chapitres.length) return ouvrir({ code: etat.code, chapitre }, { page: sens < 0 ? -1 : 0 })
    const voisin = livreVoisin(etat.code, sens)
    if (!voisin) return
    // Livre précédent : son dernier chapitre (on ne le connaît qu'une fois chargé).
    if (sens > 0) return ouvrir({ code: voisin, chapitre: 1 })
    chargerLivre(voisin)
      .then((l) => ouvrir({ code: voisin, chapitre: l.chapitres.length }, { page: -1 }))
      .catch(() => ouvrir({ code: voisin, chapitre: 1 }))
  }

  // === Agenda (à gauche) =======================================================

  const agenda = creerPanneau(monde, 1024, 1152, 1.3)
  placer(agenda, -52, 2.7, 1.62)
  const etatAgenda = { actif: true, chargement: true, erreur: false, evenements: [], detail: null }

  function dessinerAgenda() {
    const p = agenda
    const { ctx } = p
    p.commencer()
    const d = etatAgenda.detail
    if (d) {
      const date = d.date instanceof Date ? d.date : new Date(d.date)
      texteAjuste(ctx, d.titre, p.l / 2, 100, p.l - 120, 48, (t) => `600 ${t}px ${SERIF}`, BLEU, 'center', 2)
      const quand = date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
      texte(ctx, [quand, d.heure && `à ${d.heure.replace(':', 'h')}`].filter(Boolean).join(' '), p.l / 2, 230, `600 30px ${SANS}`, ROSE, 'center')
      if (d.lieu) texte(ctx, d.lieu, p.l / 2, 280, `28px ${SANS}`, GRIS, 'center')
      ctx.font = `30px ${SANS}`
      const lignes = String(d.description || '')
        .split('\n')
        .flatMap((para) => (para.trim() ? couper(ctx, para, p.l - 140, 99) : ['']))
        .slice(0, 17)
      lignes.forEach((li, i) => texte(ctx, li, 70, 350 + i * 42, `30px ${SANS}`, '#1d2f40'))
      rangeeBoutons(p, 1040, [{ libelle: 'Retour', largeur: 220, action: () => ((etatAgenda.detail = null), dessinerAgenda()) }])
      return p.finir()
    }
    texte(ctx, 'Prochains rendez-vous', p.l / 2, 95, `600 52px ${SERIF}`, BLEU, 'center')
    if (etatAgenda.chargement) texte(ctx, 'Chargement de l’agenda…', p.l / 2, 500, `italic 32px ${SERIF}`, GRIS, 'center')
    else if (etatAgenda.erreur) {
      texte(ctx, 'L’agenda n’a pas pu être chargé.', p.l / 2, 500, `italic 32px ${SERIF}`, GRIS, 'center')
      texte(ctx, 'Il reste consultable sur le site, page Agenda.', p.l / 2, 550, `26px ${SANS}`, GRIS, 'center')
    } else if (!etatAgenda.evenements.length) texte(ctx, 'Aucun rendez-vous prévu pour l’instant.', p.l / 2, 500, `italic 32px ${SERIF}`, GRIS, 'center')
    else {
      // Un événement récurrent n'apparaît qu'une fois (sa prochaine date).
      const vus = new Set()
      const prochains = etatAgenda.evenements.filter((ev) => !vus.has(ev.id ?? ev.titre) && vus.add(ev.id ?? ev.titre))
      prochains.slice(0, 6).forEach((ev, i) => {
        const y = 170 + i * 160
        const date = ev.date instanceof Date ? ev.date : new Date(ev.date)
        arrondi(ctx, 50, y, 130, 136, 22)
        ctx.fillStyle = 'rgba(6,72,134,0.08)'
        ctx.fill()
        texte(ctx, JOURS[date.getDay()], 115, y + 26, `600 22px ${SANS}`, GRIS, 'center')
        texte(ctx, String(date.getDate()), 115, y + 70, `600 52px ${SERIF}`, BLEU, 'center')
        texte(ctx, MOIS[date.getMonth()], 115, y + 112, `700 22px ${SANS}`, ROSE, 'center')
        texteAjuste(ctx, ev.titre || 'Rendez-vous', 210, y + 46, p.l - 270, 34, (t) => `700 ${t}px ${SANS}`, BLEU)
        const info = [ev.heure && ev.heure.replace(':', 'h'), ev.lieu].filter(Boolean).join(' · ')
        if (info) texteAjuste(ctx, info, 210, y + 96, p.l - 270, 27, (t) => `${t}px ${SANS}`, GRIS)
        p.zone(40, y, p.l - 80, 140, () => ((etatAgenda.detail = ev), dessinerAgenda()))
      })
    }
    p.finir()
  }

  // === Prédications (à droite) =================================================

  const predications = creerPanneau(monde, 1024, 1152, 1.3)
  placer(predications, 52, 2.7, 1.62)
  const etatPred = { actif: true, chargement: true, erreur: false, videos: [] }
  const vignettes = new Map()

  function vignette(v) {
    if (!vignettes.has(v.id)) {
      const img = new Image()
      img.onload = () => dessinerPredications()
      img.src = v.image
      vignettes.set(v.id, img)
    }
    const img = vignettes.get(v.id)
    return img.complete && img.naturalWidth ? img : null
  }

  function dessinerPredications() {
    const p = predications
    const { ctx } = p
    p.commencer()
    texte(ctx, 'Prédications', p.l / 2, 95, `600 52px ${SERIF}`, BLEU, 'center')
    if (etatPred.chargement) texte(ctx, 'Chargement des prédications…', p.l / 2, 500, `italic 32px ${SERIF}`, GRIS, 'center')
    else if (etatPred.erreur) texte(ctx, 'Les prédications n’ont pas pu être chargées.', p.l / 2, 500, `italic 30px ${SERIF}`, GRIS, 'center')
    else if (!etatPred.videos.length) texte(ctx, 'Aucune prédication pour l’instant.', p.l / 2, 500, `italic 32px ${SERIF}`, GRIS, 'center')
    else {
      etatPred.videos.slice(0, 5).forEach((v, i) => {
        const y = 165 + i * 192
        const img = vignette(v)
        ctx.save()
        arrondi(ctx, 50, y, 284, 160, 18)
        ctx.clip()
        if (img) {
          // Recadrage 16:9 (les vignettes YouTube « hq » ont des bandes noires).
          const r = img.naturalWidth / img.naturalHeight
          const sh = r < 16 / 9 ? img.naturalWidth / (16 / 9) : img.naturalHeight
          ctx.drawImage(img, 0, (img.naturalHeight - sh) / 2, img.naturalWidth, sh, 50, y, 284, 160)
        } else {
          ctx.fillStyle = 'rgba(6,72,134,0.1)'
          ctx.fillRect(50, y, 284, 160)
        }
        ctx.restore()
        const hTitre = texteAjuste(ctx, v.titre, 360, y + 32, p.l - 420, 30, (t) => `700 ${t}px ${SANS}`, BLEU, 'left', 2)
        const date = v.date ? new Date(v.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : ''
        texte(ctx, date, 360, y + 32 + hTitre + 4, `24px ${SANS}`, GRIS)
        if (v.passages.length) {
          texteAjuste(ctx, `Bible : ${v.passages.slice(0, 3).map(nomPassage).join(', ')}`, 360, y + 32 + hTitre + 42, p.l - 420, 25, (t) => `700 ${t}px ${SANS}`, ROSE)
        }
        p.zone(40, y - 6, p.l - 80, 176, () => {
          if (v.passages.length) ouvrir(v.passages[0])
          surAction({ type: 'predication', video: v })
        })
      })
    }
    p.finir()
  }

  // === Temps de prière =========================================================

  const priere = creerPanneau(monde, 1024, 560, 2.5)
  placer(priere, 0, 3, 1.75)
  priere.cible = 0
  const etatPriere = { actif: false, debut: 0, versets: [], index: -1 }

  function dessinerPriere(verset, reste) {
    const p = priere
    const { ctx } = p
    p.zones = []
    ctx.clearRect(0, 0, p.l, p.h)
    if (verset) {
      let taille = 50
      let lignes
      do {
        ctx.font = `italic ${taille}px ${SERIF}`
        lignes = couper(ctx, verset.texte, p.l - 80, 99)
        taille -= 2
      } while (lignes.length * taille * 1.3 > 380 && taille > 26)
      const h = lignes.length * (taille + 2) * 1.3
      lignes.forEach((li, i) => {
        ctx.save()
        ctx.shadowColor = 'rgba(255,255,255,0.95)'
        ctx.shadowBlur = 16
        texte(ctx, li, p.l / 2, 230 - h / 2 + i * (taille + 2) * 1.3 + (taille + 2) * 0.65, `italic ${taille + 2}px ${SERIF}`, BLEU, 'center')
        ctx.restore()
      })
      texte(ctx, verset.ref, p.l / 2, 230 + h / 2 + 40, `700 26px ${SANS}`, ROSE, 'center')
    }
    const m = Math.floor(reste / 60)
    const s = String(Math.floor(reste % 60)).padStart(2, '0')
    texte(ctx, `Temps de prière · ${m}:${s} · visez le texte pour terminer`, p.l / 2, 525, `24px ${SANS}`, GRIS, 'center')
    p.zone(0, 0, p.l, p.h, () => terminerPriere())
    p.finir()
  }

  function commencerPriere() {
    if (!etat.livre || etatPriere.actif) return
    const versets = etat.livre.chapitres[etat.chapitre - 1]
    const depart = etat.surligne?.debut || etat.pages[etat.page]?.[0]?.verset || 1
    etatPriere.versets = versets
      .map((t, i) => ({ texte: t, ref: `${LIVRE_PAR_CODE[etat.code].nom} ${etat.chapitre}.${i + 1}`, n: i + 1 }))
      .filter((v) => v.texte && v.n >= depart)
    if (!etatPriere.versets.length) return
    Object.assign(etatPriere, { actif: true, debut: performance.now(), index: -1 })
    monde.definirCalme(1)
    monde.relacher()
    surAction({ type: 'priere', actif: true })
  }

  function terminerPriere() {
    if (!etatPriere.actif) return
    etatPriere.actif = false
    monde.definirCalme(0)
    surAction({ type: 'priere', actif: false })
  }

  // === Animation : fondus, déroulé de la prière ================================

  let opaciteSpirale = 1
  monde.surImage((dt) => {
    const enPriere = etatPriere.actif
    pupitre.cible = enPriere ? 0 : 1
    agenda.cible = enPriere || !etatAgenda.actif ? 0 : 1
    predications.cible = enPriere || !etatPred.actif ? 0 : 1

    if (enPriere) {
      const ecoule = (performance.now() - etatPriere.debut) / 1000
      const reste = Math.max(0, DUREE_PRIERE - ecoule)
      if (reste <= 0) terminerPriere()
      const index = Math.min(Math.floor(ecoule / DUREE_VERSET), etatPriere.versets.length - 1)
      const dansVerset = ecoule - index * DUREE_VERSET
      // Fondu entrant et sortant de chaque verset (le dernier reste affiché).
      const dernier = index === etatPriere.versets.length - 1
      priere.cible = Math.min(1, dansVerset / 2) * (dernier ? 1 : Math.min(1, (DUREE_VERSET - dansVerset) / 2))
      if (index !== etatPriere.index || Math.floor(reste) !== etatPriere.seconde) {
        etatPriere.index = index
        etatPriere.seconde = Math.floor(reste)
        dessinerPriere(etatPriere.versets[index], reste)
      }
    } else priere.cible = 0

    const k = Math.min(1, dt * 2.2)
    for (const p of panneaux) {
      p.opacite += (p.cible - p.opacite) * (p === priere ? Math.min(1, dt * 6) : k)
      p.mesh.material.opacity = p.opacite
      p.mesh.visible = p.opacite > 0.01
    }
    opaciteSpirale += ((enPriere ? 0.15 : 1) - opaciteSpirale) * k
    monde.definirOpaciteSpirale(opaciteSpirale)
  })

  dessinerPupitre()
  dessinerAgenda()
  dessinerPredications()

  return {
    ouvrir,
    passageDuJour,
    definirAgenda({ actif = true, chargement = false, erreur = false, evenements = [] }) {
      Object.assign(etatAgenda, { actif, chargement, erreur, evenements, detail: null })
      dessinerAgenda()
    },
    definirPredications({ actif = true, chargement = false, erreur = false, videos = [] }) {
      Object.assign(etatPred, { actif, chargement, erreur, videos })
      dessinerPredications()
    },
    commencerPriere,
    terminerPriere,
    /** Le lieu a changé (depuis l'écran) : la vue « Lieux » se met à jour. */
    lieuChange() {
      if (etat.vue === 'lieux') dessinerPupitre()
    },
  }
}
