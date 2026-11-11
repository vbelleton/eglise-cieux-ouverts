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
const BLEU_CIEL = new THREE.Color(0.725, 0.8, 0.86)

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

function texturePoint() {
  return textureCanvas(64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.35, 'rgba(255,248,225,0.6)')
    g.addColorStop(1, 'rgba(255,248,225,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 64, 64)
  })
}

function textureNuage(alea) {
  return textureCanvas(256, 128, (ctx, l, h) => {
    for (let i = 0; i < 26; i++) {
      const x = l * (0.15 + alea() * 0.7)
      const y = h * (0.45 + alea() * 0.3)
      const r = 18 + alea() * 42
      const g = ctx.createRadialGradient(x, y, 0, x, y, r)
      const ombre = 235 + Math.round(alea() * 18)
      g.addColorStop(0, `rgba(${ombre},${ombre + 2},255,0.55)`)
      g.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }
  })
}

function textureDisque() {
  return textureCanvas(256, 256, (ctx) => {
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128)
    g.addColorStop(0, 'rgba(255,250,235,0.95)')
    g.addColorStop(0.55, 'rgba(255,244,214,0.55)')
    g.addColorStop(0.8, 'rgba(214,232,247,0.25)')
    g.addColorStop(1, 'rgba(214,232,247,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 256, 256)
  })
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

export function creerSceneVR(conteneur, { elements = PHOTOS_VR, graine = graineDuJour(), surChangement = () => {} } = {}) {
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
  scene.fog = new THREE.Fog(0xeef3f7, 40, 260)

  const camera = new THREE.PerspectiveCamera(70, conteneur.clientWidth / conteneur.clientHeight, 0.05, 1000)
  camera.position.set(0, HAUTEUR_YEUX, 0)
  const rig = new THREE.Group()
  rig.add(camera)
  scene.add(rig)

  const aDetruire = []
  const garder = (o) => (aDetruire.push(o), o)

  // Ciel : dégradé horizon blanc -> teinte du jour -> trouée de lumière au zénith.
  const angleLumiere = alea() * Math.PI * 2
  const directionLumiere = new THREE.Vector3(Math.cos(angleLumiere), 0.35, Math.sin(angleLumiere)).normalize()
  const ciel = new THREE.Mesh(
    garder(new THREE.SphereGeometry(500, 48, 24)),
    garder(
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
          uTemps: { value: 0 },
          uTeinte: { value: BLEU_CIEL.clone() },
          uLumiere: { value: directionLumiere },
          uCalme: { value: 0 },
        },
        vertexShader: `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: `
          varying vec3 vDir;
          uniform float uTemps;
          uniform vec3 uTeinte;
          uniform vec3 uLumiere;
          uniform float uCalme;
          void main() {
            float y = vDir.y;
            vec3 horizon = vec3(0.945, 0.960, 0.972);
            vec3 lumiere = vec3(1.0, 0.975, 0.900);
            vec3 c = mix(horizon, uTeinte, smoothstep(0.02, 0.55, y));
            // Lumière chaude venant d'un côté (direction du jour).
            float cote = pow(max(dot(vDir, uLumiere), 0.0), 3.0);
            c = mix(c, lumiere, cote * 0.55);
            // Le ciel ouvert : trouée lumineuse au zénith, qui respire.
            float ouverture = smoothstep(0.78, 0.97, y);
            float souffle = 0.92 + 0.08 * sin(uTemps * 0.6);
            c = mix(c, vec3(1.0, 0.99, 0.95), ouverture * souffle);
            // Temps de prière : lumière plus chaude et plus douce.
            c = mix(c, vec3(1.0, 0.93, 0.80), uCalme * 0.35 * smoothstep(-0.05, 0.6, y));
            // Sous l'horizon : la mer de nuages, blanche.
            c = mix(c, vec3(0.975, 0.980, 0.985), smoothstep(0.0, -0.08, y));
            gl_FragColor = vec4(c, 1.0);
          }`,
      }),
    ),
  )
  ciel.frustumCulled = false
  scene.add(ciel)
  const teinteCible = BLEU_CIEL.clone()

  // Rayons de lumière tombant de la trouée.
  const rayons = new THREE.Group()
  const matRayon = garder(
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: { uOpacite: { value: 0.16 } },
      vertexShader: `
        varying float vH;
        void main() {
          vH = uv.y;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        varying float vH;
        uniform float uOpacite;
        void main() {
          float a = smoothstep(0.0, 0.35, vH) * (1.0 - smoothstep(0.85, 1.0, vH));
          gl_FragColor = vec4(1.0, 0.95, 0.82, a * uOpacite);
        }`,
    }),
  )
  const nbRayons = 5 + Math.floor(alea() * 4)
  for (let i = 0; i < nbRayons; i++) {
    const geo = garder(new THREE.CylinderGeometry(0.15 + alea() * 0.3, 1 + alea() * 2.4, 70, 24, 1, true))
    const rayon = new THREE.Mesh(geo, matRayon)
    const a = alea() * Math.PI * 2
    const d = alea() * 2
    rayon.position.set(Math.sin(a) * d, 34, Math.cos(a) * d)
    rayon.rotation.set((alea() - 0.5) * 0.18, 0, (alea() - 0.5) * 0.18)
    rayons.add(rayon)
  }
  scene.add(rayons)

  // Mer de nuages, sous les pieds et jusqu'à l'horizon.
  const nuages = new THREE.Group()
  const texturesNuage = [0, 1, 2, 3].map(() => garder(textureNuage(alea)))
  const geoNuage = garder(new THREE.PlaneGeometry(1, 0.5))
  const nbNuages = 110 + Math.floor(alea() * 60)
  for (let i = 0; i < nbNuages; i++) {
    const angle = alea() * Math.PI * 2
    const dist = 6 + Math.pow(alea(), 0.7) * 150
    const echelle = 8 + dist * 0.35 + alea() * 10
    const mat = garder(
      new THREE.MeshBasicMaterial({
        map: texturesNuage[i % 4],
        transparent: true,
        depthWrite: false,
        opacity: 0.75 + alea() * 0.25,
        fog: true,
      }),
    )
    const nuage = new THREE.Mesh(geoNuage, mat)
    nuage.position.set(Math.cos(angle) * dist, -3 - alea() * 4 + dist * 0.01, Math.sin(angle) * dist)
    nuage.scale.set(echelle, echelle, 1)
    nuage.lookAt(0, nuage.position.y + 2, 0)
    nuage.userData.derive = (alea() - 0.5) * 0.02
    nuages.add(nuage)
  }
  scene.add(nuages)

  // Disque de lumière où l'on se tient.
  const disque = new THREE.Mesh(
    garder(new THREE.CircleGeometry(2.4, 64)),
    garder(new THREE.MeshBasicMaterial({ map: garder(textureDisque()), transparent: true, depthWrite: false })),
  )
  disque.rotation.x = -Math.PI / 2
  disque.position.y = 0.001
  scene.add(disque)
  const anneau = new THREE.Mesh(
    garder(new THREE.RingGeometry(2.2, 2.24, 96)),
    garder(new THREE.MeshBasicMaterial({ color: 0xd97777, transparent: true, opacity: 0.45, depthWrite: false })),
  )
  anneau.rotation.x = -Math.PI / 2
  anneau.position.y = 0.002
  scene.add(anneau)

  // Poussière de lumière qui monte doucement.
  const NB_PARTICULES = 500
  const positions = new Float32Array(NB_PARTICULES * 3)
  for (let i = 0; i < NB_PARTICULES; i++) {
    const a = alea() * Math.PI * 2
    const r = 2.5 + alea() * 12
    positions.set([Math.cos(a) * r, alea() * 16 - 2, Math.sin(a) * r], i * 3)
  }
  const geoParticules = garder(new THREE.BufferGeometry())
  geoParticules.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const particules = new THREE.Points(
    geoParticules,
    garder(
      new THREE.PointsMaterial({
        size: 0.035,
        map: garder(texturePoint()),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        color: 0xfff1cc,
      }),
    ),
  )
  scene.add(particules)

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
    const pastel = new THREE.Color().setHSL(hsl.h, Math.min(hsl.s, 0.35), 0.8)
    teinteCible.copy(BLEU_CIEL).lerp(pastel, 0.45)
  }

  /** Remplace le contenu de la spirale (ex. quand les prédications arrivent). */
  function definirElements(liste) {
    const approche = photoApprochee
    const elementApproche = approche?.userData.element
    for (const g of panneaux) detruirePanneau(g)
    couleurs = []
    teinteCible.copy(BLEU_CIEL)
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
    return THREE.MathUtils.smoothstep(s, -1.5, -0.6) * (1 - THREE.MathUtils.smoothstep(s, n - 2.5, n - 1.6))
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
  const posParticules = geoParticules.attributes.position
  let detruit = false
  let defilement = 0
  let premiereImage = true

  definirElements(elements)

  renderer.setAnimationLoop(() => {
    const dt = Math.min(horloge.getDelta(), 0.1) * vitesse
    const t = horloge.elapsedTime * vitesse

    ciel.material.uniforms.uTemps.value = t
    ciel.material.uniforms.uTeinte.value.lerp(teinteCible, Math.min(1, dt * 0.8))
    rayons.rotation.y += dt * 0.03
    matRayon.uniforms.uOpacite.value = 0.13 + 0.04 * Math.sin(t * 0.5) + calme * 0.08
    for (const n of nuages.children) n.position.x += n.userData.derive * dt * 20
    for (let i = 0; i < NB_PARTICULES; i++) {
      let y = posParticules.getY(i) + dt * 0.12
      if (y > 14) y = -2
      posParticules.setY(i, y)
    }
    posParticules.needsUpdate = true

    accueil.position.y = 3.35 + Math.sin(t * 0.8) * 0.03
    calme += (calmeCible - calme) * Math.min(1, dt * 0.7)
    ciel.material.uniforms.uCalme.value = calme
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
    definirOpaciteSpirale: (v) => (opaciteSpirale = v),
    relacher: () => {
      photoApprochee = null
      surChangement({ element: null })
    },
  }

  return { monde, vrDisponible, entrerVR, activerGyro, couperGyro, basculerCarton, viserDepuisCamera, definirElements, detruire }
}
