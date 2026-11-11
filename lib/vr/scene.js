// Scène du mode VR caché (/vr) : on se tient sur un disque de lumière, au-dessus
// d'une mer de nuages, sous un ciel qui s'ouvre — la même image que le hero du
// site (public/logo-hero.png), en volume.
//
// Monde procédural, construit à partir du contenu du site :
// - les éléments (photos des activités, prédications YouTube…) forment une
//   spirale qui descend lentement du ciel en tournant autour de soi : chacun
//   passe à son tour devant les yeux puis s'efface sous le disque, et
//   réapparaît tout en haut ; plus il y a de contenu, plus la spirale monte ;
// - le monde change chaque jour (graine = date du jour) : nuages, rayons,
//   poussière de lumière, pas de la spirale, ordre de passage ;
// - la teinte du ciel s'inspire des couleurs des images chargées.
// Viser un élément (manette, clic, toucher, ou le centre de l'écran en mode
// carton) l'approche et le fige devant soi ; viser à nouveau le renvoie.
//
// Trois façons de regarder :
// - WebXR « immersive-vr » (Meta Quest, Pico, Android + Chrome…) ;
// - mode carton : écran coupé en deux (StereoCamera) + gyroscope, pour un
//   casque en carton sur n'importe quel téléphone, iPhone compris (Safari n'a
//   pas WebXR) ;
// - écran simple : glisser pour regarder autour, ou bouger le téléphone.
//
// three.js est importé dynamiquement par pages/vr.vue : il ne pèse rien sur le
// reste du site.

import * as THREE from 'three'
import { LIEUX, chargerLieu } from './lieux/index.js'

/** Photos du site toujours présentes dans la spirale. */
export const PHOTOS_VR = [
  { type: 'photo', image: '/images/activites-celebration.jpg', titre: 'Le culte du dimanche' },
  { type: 'photo', image: '/images/activites-priere.jpg', titre: 'La prière' },
  { type: 'photo', image: '/images/activites-jeunesse.jpeg', titre: 'La jeunesse' },
  { type: 'photo', image: '/images/activites-maison.jpeg', titre: 'Les groupes de maison' },
  { type: 'photo', image: '/images/activites-repas.jpg', titre: 'Les repas' },
  { type: 'photo', image: '/images/activites-femmes.jpeg', titre: 'Les femmes' },
  { type: 'photo', image: '/images/activites-marche.jpeg', titre: 'Le groupe de marche' },
]

const HAUTEUR_YEUX = 1.6
const RAYON_SPIRALE = 6.5
const BLEU = '#064886'

// --- Hasard reproductible : même monde toute la journée ---------------------

export function graineDuJour(date = new Date()) {
  const jour = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
  let h = 2166136261
  for (const c of jour) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return h >>> 0
}

export function hasard(graine) {
  let a = graine >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// --- Textures dessinées au canvas (aucun fichier à charger) -----------------

export function textureCanvas(largeur, hauteur, dessin) {
  const canvas = document.createElement('canvas')
  canvas.width = largeur
  canvas.height = hauteur
  dessin(canvas.getContext('2d'), largeur, hauteur)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}




function textureLecture() {
  return textureCanvas(128, 128, (ctx) => {
    ctx.fillStyle = 'rgba(6,72,134,0.85)'
    ctx.beginPath()
    ctx.arc(64, 64, 60, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.moveTo(50, 38)
    ctx.lineTo(92, 64)
    ctx.lineTo(50, 90)
    ctx.closePath()
    ctx.fill()
  })
}

/** Coupe un texte en lignes d'au plus `largeur` px, `max` lignes (… si tronqué). */
export function couper(ctx, texte, largeur, max) {
  const mots = String(texte || '')
    .split(/\s+/)
    .filter(Boolean)
  const lignes = []
  let ligne = ''
  for (const mot of mots) {
    const essai = ligne ? `${ligne} ${mot}` : mot
    if (ctx.measureText(essai).width <= largeur || !ligne) ligne = essai
    else {
      lignes.push(ligne)
      ligne = mot
    }
  }
  if (ligne) lignes.push(ligne)
  if (lignes.length > max) {
    lignes.length = max
    let fin = lignes[max - 1]
    while (fin.length > 1 && ctx.measureText(`${fin}…`).width > largeur) fin = fin.slice(0, -1)
    lignes[max - 1] = `${fin.trimEnd()}…`
  }
  return lignes
}

export function textureTexte(blocs, { largeur = 1024, hauteur = 256 } = {}) {
  return textureCanvas(largeur, hauteur, (ctx, l, h) => {
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const lignes = []
    for (const b of blocs) {
      ctx.font = b.police
      for (const texte of couper(ctx, b.texte, l - 48, b.max || 1)) lignes.push({ ...b, texte })
    }
    const total = lignes.reduce((t, li) => t + li.taille * 1.25, 0)
    let y = (h - total) / 2
    for (const li of lignes) {
      y += li.taille * 0.625
      ctx.font = li.police
      ctx.fillStyle = li.couleur || BLEU
      ctx.shadowColor = 'rgba(255,255,255,0.9)'
      ctx.shadowBlur = 12
      ctx.fillText(li.texte, l / 2, y)
      y += li.taille * 0.625
    }
  })
}

/** Couleur moyenne d'une image chargée (même origine), ou null. */
function couleurMoyenne(image) {
  try {
    const c = document.createElement('canvas')
    c.width = c.height = 12
    const ctx = c.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(image, 0, 0, 12, 12)
    const d = ctx.getImageData(0, 0, 12, 12).data
    let r = 0
    let g = 0
    let b = 0
    for (let i = 0; i < d.length; i += 4) {
      r += d[i]
      g += d[i + 1]
      b += d[i + 2]
    }
    const n = d.length / 4
    return new THREE.Color().setRGB(r / n / 255, g / n / 255, b / n / 255, THREE.SRGBColorSpace)
  } catch {
    return null
  }
}

const formatDate = (iso) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

// --- Gyroscope -> orientation de caméra (ex-DeviceOrientationControls) -------

const AXE_Z = new THREE.Vector3(0, 0, 1)
const Q_ECRAN = new THREE.Quaternion()
const Q_REDRESSE = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5))
const EULER = new THREE.Euler()

function orientationVersQuaternion(q, alpha, beta, gamma, orientEcran) {
  EULER.set(beta, alpha, -gamma, 'YXZ')
  q.setFromEuler(EULER)
  q.multiply(Q_REDRESSE)
  q.multiply(Q_ECRAN.setFromAxisAngle(AXE_Z, -orientEcran))
}

// -----------------------------------------------------------------------------

export function creerSceneVR(conteneur, { elements = PHOTOS_VR, lieu: lieuInitial = 'chapelle', graine = graineDuJour(), surChangement = () => {} } = {}) {
  const mouvementReduit = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const vitesse = mouvementReduit ? 0.25 : 1
  const alea = hasard(graine)

  // Réglages du jour.
  const PAS_ANGLE = (Math.PI * 2) / (6 + alea() * 2) // 6 à 8 éléments par tour
  const PAS_HAUTEUR = 0.45 + alea() * 0.15
  const SENS = alea() < 0.5 ? 1 : -1
  const DEPART = alea()

  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setSize(conteneur.clientWidth, conteneur.clientHeight)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.xr.enabled = true
  renderer.xr.setReferenceSpaceType('local-floor')
  renderer.xr.setFoveation?.(0.5)
  conteneur.appendChild(renderer.domElement)

  const scene = new THREE.Scene()

  const camera = new THREE.PerspectiveCamera(70, conteneur.clientWidth / conteneur.clientHeight, 0.05, 1000)
  camera.position.set(0, HAUTEUR_YEUX, 0)
  const rig = new THREE.Group()
  rig.add(camera)
  scene.add(rig)

  const aDetruire = []
  const garder = (o) => (aDetruire.push(o), o)

  const chargeur = new THREE.TextureLoader()
  const charger = (src) =>
    new Promise((ok) =>
      chargeur.load(
        src,
        (t) => {
          t.colorSpace = THREE.SRGBColorSpace
          t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())
          ok(t)
        },
        undefined,
        () => ok(null),
      ),
    )

  // Logo de l'église, au-dessus du pupitre.
  const accueil = new THREE.Group()
  accueil.position.set(0, 3.35, -2.7)
  scene.add(accueil)
  charger('/logo-nav.png').then((t) => {
    if (!t || detruit) return t?.dispose()
    garder(t)
    const logo = new THREE.Mesh(
      garder(new THREE.PlaneGeometry(0.9, 0.9 * (113 / 240))),
      garder(new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false })),
    )
    accueil.add(logo)
  })

  // --- Lieux de prière (lib/vr/lieux/) ----------------------------------------

  let lieu = null
  let idLieu = null
  let teinte = null
  let fondu = 0
  let changementEnCours = false
  // Voile noir collé à la caméra, pour passer d'un lieu à l'autre en douceur.
  const voile = new THREE.Mesh(
    garder(new THREE.SphereGeometry(0.4, 16, 12)),
    garder(new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide, transparent: true, opacity: 0, depthTest: false, depthWrite: false })),
  )
  voile.renderOrder = 9999
  voile.visible = false
  camera.add(voile)

  const attendre = (ms) => new Promise((r) => setTimeout(r, ms))
  let demandeLieu = 0
  async function changerLieu(id) {
    if (!LIEUX.some((l) => l.id === id)) id = LIEUX[0].id
    if (id === idLieu) return
    const moi = ++demandeLieu
    changementEnCours = Boolean(lieu)
    let module
    try {
      module = await chargerLieu(id)
    } catch (e) {
      // Module introuvable (déploiement entre-temps, réseau coupé) : on reste
      // dans le lieu actuel plutôt que dans le noir.
      console.error('[vr] lieu', e)
      if (moi === demandeLieu) changementEnCours = false
      return
    }
    if (lieu) await attendre(450)
    if (moi !== demandeLieu || detruit) return
    if (lieu) {
      scene.remove(lieu.groupe)
      lieu.liberer()
    }
    // Chaque lieu a sa propre graine, tirée de celle du jour.
    lieu = module.construire({ alea: hasard(graine ^ id.length * 7919), renderer })
    idLieu = id
    scene.add(lieu.groupe)
    scene.fog = lieu.fog || null
    scene.background = lieu.fond || null
    accueil.visible = lieu.logo !== false
    lieu.teinter?.(teinte)
    changementEnCours = false
    surChangement({ lieu: id })
  }

  // --- Spirale des éléments ---------------------------------------------------

  const geoPanneau = garder(new THREE.PlaneGeometry(1, 1))
  const texLecture = garder(textureLecture())
  let panneaux = []
  let cibles = []
  let couleurs = []
  let photoApprochee = null

  function creerPanneau(el, index) {
    const groupe = new THREE.Group()
    const materiaux = []
    const mat = (o) => {
      const m = new THREE.MeshBasicMaterial({ transparent: true, ...o })
      m.userData.base = o.opacity ?? 1
      materiaux.push(m)
      return m
    }
    const cadre = new THREE.Mesh(geoPanneau, mat({ color: 0xffffff, opacity: 0.92 }))
    cadre.position.z = -0.005
    const image = new THREE.Mesh(geoPanneau, mat({ color: 0xdfe8ef }))
    const sousTitre = el.type === 'video' ? ['Prédication', formatDate(el.date)].filter(Boolean).join(' · ') : ''
    const legende = new THREE.Mesh(
      new THREE.PlaneGeometry(1.8, 0.4),
      mat({
        depthWrite: false,
        map: textureTexte(
          [
            { texte: el.titre, taille: 54, police: '600 54px "Playfair Display", Georgia, serif', max: 2 },
            ...(sousTitre ? [{ texte: sousTitre, taille: 34, police: '600 34px "Nunito", "Segoe UI", Arial, sans-serif', couleur: '#d97777' }] : []),
          ],
          { largeur: 1024, hauteur: 228 },
        ),
      }),
    )
    groupe.add(cadre, image, legende)
    if (el.type === 'video') {
      const lecture = new THREE.Mesh(geoPanneau, mat({ map: texLecture, depthWrite: false }))
      lecture.scale.setScalar(0.32)
      lecture.position.z = 0.01
      groupe.add(lecture)
    }

    const dimensionner = (ratio) => {
      const w = Math.min(1.05 * ratio, 2.1)
      const h = w / ratio
      image.scale.set(w, h, 1)
      cadre.scale.set(w + 0.08, h + 0.08, 1)
      legende.position.y = -h / 2 - 0.26
    }
    dimensionner(el.type === 'video' ? 16 / 9 : 4 / 3)
    charger(el.image).then((t) => {
      if (!t) return
      if (detruit || !panneaux.includes(groupe)) return t.dispose()
      image.material.map = t
      image.material.color.set(0xffffff)
      image.material.needsUpdate = true
      dimensionner(t.image.width / t.image.height)
      const c = couleurMoyenne(t.image)
      if (c) {
        couleurs.push(c)
        recalculerTeinte()
      }
    })

    groupe.userData = { element: el, index, materiaux, fondu: 0, proche: null }
    image.userData.panneau = groupe
    cadre.userData.panneau = groupe
    groupe.visible = false
    scene.add(groupe)
    return groupe
  }

  function detruirePanneau(g) {
    scene.remove(g)
    for (const m of g.userData.materiaux) {
      if (m.map && m.map !== texLecture) m.map.dispose()
      m.dispose()
    }
    for (const c of g.children) if (c.geometry !== geoPanneau) c.geometry.dispose()
  }

  // Teinte du ciel : moyenne des images, éclaircie et adoucie.
  function recalculerTeinte() {
    const moy = new THREE.Color(0, 0, 0)
    for (const c of couleurs) moy.add(c)
    moy.multiplyScalar(1 / couleurs.length)
    const hsl = moy.getHSL({})
    teinte = new THREE.Color().setHSL(hsl.h, Math.min(hsl.s, 0.35), 0.8)
    lieu?.teinter?.(teinte)
  }

  /** Remplace le contenu de la spirale (ex. quand les prédications arrivent). */
  function definirElements(liste) {
    const approche = photoApprochee
    const elementApproche = approche?.userData.element
    for (const g of panneaux) detruirePanneau(g)
    couleurs = []
    teinte = null
    lieu?.teinter?.(null)
    // Ordre de passage du jour : mélange reproductible.
    const r = hasard(graine ^ liste.length)
    const ordre = liste
      .map((el) => ({ el, cle: r() }))
      .sort((a, b) => a.cle - b.cle)
      .map((o) => o.el)
    panneaux = ordre.map(creerPanneau)
    cibles = panneaux.flatMap((g) => g.children.slice(0, 2))
    photoApprochee = null
    if (elementApproche) {
      const meme = panneaux.find((g) => g.userData.element === elementApproche)
      if (meme) {
        meme.userData.proche = approche.userData.proche
        meme.position.copy(approche.position)
        meme.quaternion.copy(approche.quaternion)
        photoApprochee = meme
      } else surChangement({ element: null })
    }
    premiereImage = true
  }

  /** Place un élément sur la spirale ; renvoie son opacité (fondu haut et bas). */
  const posSpirale = new THREE.Vector3()
  const quatSpirale = new THREE.Quaternion()
  const visee = new THREE.Object3D()
  function placerSurSpirale(index, defilement) {
    const n = panneaux.length
    const s = ((((index - defilement) % n) + n) % n) - 1.5 // de -1,5 (sous les yeux) à n-1,5 (tout en haut)
    const angle = SENS * s * PAS_ANGLE
    const y = HAUTEUR_YEUX - 0.1 + s * PAS_HAUTEUR
    posSpirale.set(Math.sin(angle) * RAYON_SPIRALE, y, -Math.cos(angle) * RAYON_SPIRALE)
    visee.position.copy(posSpirale)
    visee.lookAt(0, y, 0)
    quatSpirale.copy(visee.quaternion)
    const plafond = lieu?.hauteurMax ?? Infinity
    return (
      THREE.MathUtils.smoothstep(s, -1.5, -0.6) *
      (1 - THREE.MathUtils.smoothstep(s, n - 2.5, n - 1.6)) *
      (1 - THREE.MathUtils.smoothstep(y, plafond - 1.6, plafond - 0.9))
    )
  }

  // --- Objets interactifs (pupitre, panneaux) et rappels par image ------------

  const interactifs = []
  /** `mesh.userData.surVisee(uv, point)` est appelé quand on vise ce mesh. */
  function ajouterInteractif(mesh) {
    interactifs.push(mesh)
  }
  const rappels = []
  function surImage(fn) {
    rappels.push(fn)
  }
  let opaciteSpirale = 1
  let calme = 0
  let calmeCible = 0

  // --- Sélection --------------------------------------------------------------

  const raycaster = new THREE.Raycaster()
  const tmpMat = new THREE.Matrix4()
  const tmpVec = new THREE.Vector3()
  const tmpQuat = new THREE.Quaternion()

  function viser(origine, direction) {
    raycaster.set(origine, direction)
    const visibles = interactifs.filter((m) => m.visible && m.parent?.visible !== false && (m.material.opacity ?? 1) > 0.3)
    const touche = raycaster
      .intersectObjects([...visibles, ...cibles], false)
      .find((i) => i.object.userData.surVisee || i.object.userData.panneau.userData.fondu * opaciteSpirale > 0.3)
    if (touche?.object.userData.surVisee) {
      touche.object.userData.surVisee(touche.uv, touche.point)
      return
    }
    const groupe = touche?.object.userData.panneau
    if (!groupe || groupe === photoApprochee) {
      photoApprochee = null
    } else {
      photoApprochee = groupe
      // Devant les yeux, dans la direction où l'on regarde (à plat).
      const cam = renderer.xr.isPresenting ? renderer.xr.getCamera() : camera
      cam.getWorldPosition(tmpVec)
      const regard = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.getWorldQuaternion(tmpQuat))
      regard.y = 0
      if (regard.lengthSq() < 1e-4) regard.set(0, 0, -1)
      regard.normalize()
      const cible = tmpVec.clone().addScaledVector(regard, 1.9)
      const orient = new THREE.Object3D()
      orient.position.copy(cible)
      orient.lookAt(tmpVec.x, cible.y, tmpVec.z)
      groupe.userData.proche = { position: cible, quaternion: orient.quaternion.clone() }
    }
    surChangement({ element: photoApprochee ? photoApprochee.userData.element : null })
  }

  function viserDepuisCamera(ndcX = 0, ndcY = 0) {
    camera.updateMatrixWorld()
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera)
    viser(raycaster.ray.origin.clone(), raycaster.ray.direction.clone())
  }

  // Manettes WebXR (gâchette ou pincement des mains = « select »).
  const geoRayon = garder(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]))
  const matRayonManette = garder(new THREE.LineBasicMaterial({ color: 0x064886, transparent: true, opacity: 0.6 }))
  for (let i = 0; i < 2; i++) {
    const manette = renderer.xr.getController(i)
    const ligne = new THREE.Line(geoRayon, matRayonManette)
    ligne.scale.z = 5
    manette.add(ligne)
    manette.addEventListener('select', () => {
      tmpMat.identity().extractRotation(manette.matrixWorld)
      const origine = new THREE.Vector3().setFromMatrixPosition(manette.matrixWorld)
      const direction = new THREE.Vector3(0, 0, -1).applyMatrix4(tmpMat)
      viser(origine, direction)
    })
    rig.add(manette)
  }

  // --- Regarder sans casque : glisser / gyroscope ----------------------------

  let lacet = 0
  let tangage = 0
  let gyroActif = false
  let derniereOrientation = null
  let decalageAlpha = null
  const qGyro = new THREE.Quaternion()
  const qLacet = new THREE.Quaternion()

  function surOrientation(e) {
    if (e.alpha == null) return
    derniereOrientation = e
  }

  let appui = null
  function surAppui(e) {
    appui = { x: e.clientX, y: e.clientY, lacet, tangage, bouge: false }
    renderer.domElement.setPointerCapture?.(e.pointerId)
  }
  function surDeplacement(e) {
    if (!appui) return
    const dx = e.clientX - appui.x
    const dy = e.clientY - appui.y
    if (Math.abs(dx) + Math.abs(dy) > 6) appui.bouge = true
    const facteur = (camera.fov * Math.PI) / 180 / conteneur.clientHeight
    lacet = appui.lacet + dx * facteur
    if (!gyroActif) tangage = THREE.MathUtils.clamp(appui.tangage + dy * facteur, -1.3, 1.3)
  }
  function surRelache(e) {
    if (appui && !appui.bouge) {
      if (modeCarton) viserDepuisCamera(0, 0)
      else {
        const r = renderer.domElement.getBoundingClientRect()
        viserDepuisCamera(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      }
    }
    appui = null
  }
  renderer.domElement.addEventListener('pointerdown', surAppui)
  renderer.domElement.addEventListener('pointermove', surDeplacement)
  renderer.domElement.addEventListener('pointerup', surRelache)
  renderer.domElement.addEventListener('pointercancel', () => (appui = null))

  async function activerGyro() {
    const DOE = window.DeviceOrientationEvent
    if (!DOE) return false
    if (typeof DOE.requestPermission === 'function') {
      try {
        if ((await DOE.requestPermission()) !== 'granted') return false
      } catch {
        return false
      }
    }
    if (!gyroActif) window.addEventListener('deviceorientation', surOrientation)
    gyroActif = true
    decalageAlpha = null
    lacet = 0
    return true
  }
  function couperGyro() {
    window.removeEventListener('deviceorientation', surOrientation)
    gyroActif = false
    derniereOrientation = null
  }

  // --- Mode carton (stéréo écran partagé) -------------------------------------

  let modeCarton = false
  const stereo = new THREE.StereoCamera()
  stereo.eyeSep = 0.064
  function basculerCarton(actif) {
    modeCarton = actif
    redimensionner()
  }

  // --- WebXR -----------------------------------------------------------------

  async function vrDisponible() {
    try {
      return Boolean(await navigator.xr?.isSessionSupported('immersive-vr'))
    } catch {
      return false
    }
  }
  let session = null
  async function entrerVR() {
    if (session) return session.end()
    session = await navigator.xr.requestSession('immersive-vr', {
      optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'],
    })
    session.addEventListener('end', () => {
      session = null
      camera.position.set(0, HAUTEUR_YEUX, 0)
      surChangement({ vr: false })
    })
    await renderer.xr.setSession(session)
    surChangement({ vr: true })
  }

  // --- Boucle -----------------------------------------------------------------

  function redimensionner() {
    const l = conteneur.clientWidth
    const h = conteneur.clientHeight
    if (renderer.xr.isPresenting) return
    // En mode carton, StereoCamera divise elle-même le format par deux (stereo.aspect).
    camera.aspect = l / h
    camera.updateProjectionMatrix()
    renderer.setSize(l, h)
  }
  window.addEventListener('resize', redimensionner)

  const horloge = new THREE.Clock()
  let detruit = false
  let defilement = 0
  let premiereImage = true

  definirElements(elements)
  changerLieu(lieuInitial)

  renderer.setAnimationLoop(() => {
    const dt = Math.min(horloge.getDelta(), 0.1) * vitesse
    const t = horloge.elapsedTime * vitesse

    accueil.position.y = 3.35 + Math.sin(t * 0.8) * 0.03
    calme += (calmeCible - calme) * Math.min(1, dt * 0.7)
    lieu?.maj(dt, t, calme)
    // Fondu au noir pendant un changement de lieu.
    fondu += ((changementEnCours ? 1 : 0) - fondu) * Math.min(1, dt * 6)
    voile.material.opacity = fondu
    voile.visible = fondu > 0.01
    for (const fn of rappels) fn(dt, t)

    // La spirale descend d'un cran toutes les ~9 s ; elle s'arrête tant qu'un
    // élément est approché, pour qu'il retrouve sa place en le relâchant.
    if (!photoApprochee) defilement += dt * 0.11
    const k = premiereImage ? 1 : 1 - Math.pow(0.002, dt)
    for (const g of panneaux) {
      const proche = g === photoApprochee
      const fondu = placerSurSpirale(g.userData.index + DEPART * panneaux.length, defilement)
      g.position.lerp(proche ? g.userData.proche.position : posSpirale, proche ? 1 - Math.pow(0.002, dt) : k)
      g.quaternion.slerp(proche ? g.userData.proche.quaternion : quatSpirale, proche ? 1 - Math.pow(0.002, dt) : k)
      g.scale.setScalar(THREE.MathUtils.lerp(g.scale.x, proche ? 1.35 : 1, 1 - Math.pow(0.002, dt)))
      g.userData.fondu = proche ? 1 : fondu
      const opacite = g.userData.fondu * (proche ? 1 : opaciteSpirale)
      g.visible = opacite > 0.01
      for (const m of g.userData.materiaux) m.opacity = m.userData.base * opacite
    }
    premiereImage = false

    if (renderer.xr.isPresenting) {
      renderer.setScissorTest(false)
      renderer.render(scene, camera)
      return
    }

    // Orientation de la caméra hors casque.
    if (gyroActif && derniereOrientation) {
      const o = derniereOrientation
      const alpha = THREE.MathUtils.degToRad(o.alpha)
      if (decalageAlpha === null) decalageAlpha = alpha
      const orient = THREE.MathUtils.degToRad(screen.orientation?.angle ?? window.orientation ?? 0)
      orientationVersQuaternion(qGyro, alpha - decalageAlpha, THREE.MathUtils.degToRad(o.beta), THREE.MathUtils.degToRad(o.gamma), orient)
      camera.quaternion.copy(qLacet.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, lacet)).multiply(qGyro)
    } else {
      camera.quaternion.setFromEuler(new THREE.Euler(tangage, lacet, 0, 'YXZ'))
    }
    camera.position.set(0, HAUTEUR_YEUX, 0)
    camera.updateMatrixWorld()

    if (modeCarton) {
      const l = conteneur.clientWidth
      const h = conteneur.clientHeight
      stereo.aspect = 0.5
      stereo.update(camera)
      renderer.setScissorTest(true)
      renderer.setScissor(0, 0, l / 2, h)
      renderer.setViewport(0, 0, l / 2, h)
      renderer.render(scene, stereo.cameraL)
      renderer.setScissor(l / 2, 0, l / 2, h)
      renderer.setViewport(l / 2, 0, l / 2, h)
      renderer.render(scene, stereo.cameraR)
      renderer.setScissorTest(false)
      renderer.setViewport(0, 0, l, h)
    } else {
      renderer.render(scene, camera)
    }
  })

  function detruire() {
    detruit = true
    renderer.setAnimationLoop(null)
    session?.end().catch(() => {})
    window.removeEventListener('resize', redimensionner)
    couperGyro()
    for (const g of panneaux) detruirePanneau(g)
    panneaux = []
    lieu?.liberer()
    for (const o of aDetruire) o.dispose?.()
    renderer.dispose()
    renderer.domElement.remove()
  }

  /** Ce dont la salle de prière (lib/vr/salle.js) a besoin pour s'installer. */
  const monde = {
    THREE,
    scene,
    camera,
    renderer,
    garder,
    charger,
    ajouterInteractif,
    surImage,
    regard: () => {
      const cam = renderer.xr.isPresenting ? renderer.xr.getCamera() : camera
      return new THREE.Vector3(0, 0, -1).applyQuaternion(cam.getWorldQuaternion(new THREE.Quaternion()))
    },
    definirCalme: (v) => (calmeCible = v),
    changerLieu,
    lieuActuel: () => idLieu,
    definirOpaciteSpirale: (v) => (opaciteSpirale = v),
    relacher: () => {
      photoApprochee = null
      surChangement({ element: null })
    },
  }

  return { monde, changerLieu, vrDisponible, entrerVR, activerGyro, couperGyro, basculerCarton, viserDepuisCamera, definirElements, detruire }
}
