// Scène du mode VR caché (/vr) : on se tient sur un disque de lumière, au-dessus
// d'une mer de nuages, sous un ciel qui s'ouvre — la même image que le hero du
// site (public/logo-hero.png), en volume. Les photos de la vie de l'église
// flottent en cercle autour de soi ; viser une photo (manette, clic, toucher, ou
// le centre de l'écran en mode carton) l'approche, viser à nouveau la renvoie.
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

export const PHOTOS_VR = [
  { src: '/images/activites-celebration.jpg', legende: 'Le culte du dimanche' },
  { src: '/images/activites-priere.jpg', legende: 'La prière' },
  { src: '/images/activites-jeunesse.jpeg', legende: 'La jeunesse' },
  { src: '/images/activites-maison.jpeg', legende: 'Les groupes de maison' },
  { src: '/images/activites-repas.jpg', legende: 'Les repas' },
  { src: '/images/activites-femmes.jpeg', legende: 'Les femmes' },
  { src: '/images/activites-marche.jpeg', legende: 'Le groupe de marche' },
]

const HAUTEUR_YEUX = 1.6
const RAYON_PHOTOS = 4.6
const BLEU = '#064886'

// --- Textures dessinées au canvas (aucun fichier à charger) -----------------

function textureCanvas(largeur, hauteur, dessin) {
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

function textureNuage(graine) {
  let s = graine
  const alea = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  return textureCanvas(256, 128, (ctx, l, h) => {
    for (let i = 0; i < 26; i++) {
      const x = l * (0.15 + alea() * 0.7)
      const y = h * (0.45 + alea() * 0.3)
      const r = 18 + alea() * 42
      const g = ctx.createRadialGradient(x, y, 0, x, y, r)
      const ombre = 235 + Math.round(alea() * 20)
      g.addColorStop(0, `rgba(${ombre},${ombre + 2 > 255 ? 255 : ombre + 2},255,0.55)`)
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

function textureTexte(lignes, { largeur = 1024, hauteur = 256 } = {}) {
  return textureCanvas(largeur, hauteur, (ctx, l, h) => {
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const total = lignes.reduce((t, li) => t + li.taille * 1.3, 0)
    let y = (h - total) / 2
    for (const li of lignes) {
      y += li.taille * 0.65
      ctx.font = li.police
      ctx.fillStyle = li.couleur || BLEU
      ctx.shadowColor = 'rgba(255,255,255,0.9)'
      ctx.shadowBlur = 12
      ctx.fillText(li.texte, l / 2, y)
      y += li.taille * 0.65
    }
  })
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

export function creerSceneVR(conteneur, { surChangement = () => {} } = {}) {
  const mouvementReduit = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const vitesse = mouvementReduit ? 0.25 : 1

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

  // Ciel : dégradé horizon blanc -> bleu pâle -> trouée de lumière au zénith.
  const ciel = new THREE.Mesh(
    garder(new THREE.SphereGeometry(500, 48, 24)),
    garder(
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: { uTemps: { value: 0 } },
        vertexShader: `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: `
          varying vec3 vDir;
          uniform float uTemps;
          void main() {
            float y = vDir.y;
            vec3 horizon = vec3(0.945, 0.960, 0.972);
            vec3 bleu = vec3(0.725, 0.800, 0.860);
            vec3 lumiere = vec3(1.0, 0.975, 0.900);
            vec3 c = mix(horizon, bleu, smoothstep(0.02, 0.55, y));
            // Lumière chaude venant d'un côté, comme sur l'image du site.
            float cote = pow(max(dot(vDir, normalize(vec3(-0.8, 0.35, -0.5))), 0.0), 3.0);
            c = mix(c, lumiere, cote * 0.55);
            // Le ciel ouvert : trouée lumineuse au zénith, qui respire.
            float ouverture = smoothstep(0.78, 0.97, y);
            float souffle = 0.92 + 0.08 * sin(uTemps * 0.6);
            c = mix(c, vec3(1.0, 0.99, 0.95), ouverture * souffle);
            // Sous l'horizon : la mer de nuages, blanche.
            c = mix(c, vec3(0.975, 0.980, 0.985), smoothstep(0.0, -0.08, y));
            gl_FragColor = vec4(c, 1.0);
          }`,
      }),
    ),
  )
  ciel.frustumCulled = false
  scene.add(ciel)

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
  for (let i = 0; i < 7; i++) {
    const geo = garder(new THREE.CylinderGeometry(0.15 + i * 0.05, 1.2 + i * 0.35, 70, 24, 1, true))
    const rayon = new THREE.Mesh(geo, matRayon)
    rayon.position.set(Math.sin(i * 2.1) * 1.5, 34, Math.cos(i * 2.1) * 1.5)
    rayon.rotation.set(Math.sin(i * 1.7) * 0.08, 0, Math.cos(i * 1.3) * 0.08)
    rayons.add(rayon)
  }
  scene.add(rayons)

  // Mer de nuages, sous les pieds et jusqu'à l'horizon.
  const nuages = new THREE.Group()
  const texturesNuage = [1, 2, 3, 4].map((g) => garder(textureNuage(g * 9973)))
  const geoNuage = garder(new THREE.PlaneGeometry(1, 0.5))
  for (let i = 0; i < 140; i++) {
    const angle = Math.random() * Math.PI * 2
    const dist = 6 + Math.pow(Math.random(), 0.7) * 150
    const echelle = 8 + dist * 0.35 + Math.random() * 10
    const mat = garder(
      new THREE.MeshBasicMaterial({
        map: texturesNuage[i % 4],
        transparent: true,
        depthWrite: false,
        opacity: 0.75 + Math.random() * 0.25,
        fog: true,
      }),
    )
    const nuage = new THREE.Mesh(geoNuage, mat)
    nuage.position.set(Math.cos(angle) * dist, -3 - Math.random() * 4 + dist * 0.01, Math.sin(angle) * dist)
    nuage.scale.set(echelle, echelle, 1)
    nuage.lookAt(0, nuage.position.y + 2, 0)
    nuage.userData.derive = (Math.random() - 0.5) * 0.02
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
    const a = Math.random() * Math.PI * 2
    const r = 2.5 + Math.random() * 12
    positions.set([Math.cos(a) * r, Math.random() * 16 - 2, Math.sin(a) * r], i * 3)
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

  // Face à soi : logo + verset.
  const chargeur = new THREE.TextureLoader()
  const charger = (src) =>
    new Promise((ok) =>
      chargeur.load(
        src,
        (t) => {
          t.colorSpace = THREE.SRGBColorSpace
          t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())
          ok(garder(t))
        },
        undefined,
        () => ok(null),
      ),
    )

  const accueil = new THREE.Group()
  accueil.position.set(0, 0, -RAYON_PHOTOS)
  scene.add(accueil)
  charger('/logo-nav.png').then((t) => {
    if (!t || detruit) return
    const logo = new THREE.Mesh(
      garder(new THREE.PlaneGeometry(1.4, 1.4 * (113 / 240))),
      garder(new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false })),
    )
    logo.position.y = 2.75
    logo.userData.flotte = 0
    accueil.add(logo)
  })
  const verset = new THREE.Mesh(
    garder(new THREE.PlaneGeometry(3.2, 0.8)),
    garder(
      new THREE.MeshBasicMaterial({
        transparent: true,
        depthWrite: false,
        map: garder(
          textureTexte([
            { texte: '« Voici, je vois les cieux ouverts »', taille: 74, police: 'italic 600 74px "Playfair Display", Georgia, serif' },
            { texte: 'Actes 7.56', taille: 44, police: '600 44px "Nunito", "Segoe UI", Arial, sans-serif', couleur: '#d97777' },
          ]),
        ),
      }),
    ),
  )
  verset.position.y = 1.95
  accueil.add(verset)
  const consigne = new THREE.Mesh(
    garder(new THREE.PlaneGeometry(2.4, 0.3)),
    garder(
      new THREE.MeshBasicMaterial({
        transparent: true,
        depthWrite: false,
        opacity: 0.85,
        map: garder(
          textureTexte(
            [{ texte: 'Regardez autour de vous · visez une photo pour l’approcher', taille: 40, police: '40px "Nunito", "Segoe UI", Arial, sans-serif' }],
            { largeur: 1280, hauteur: 160 },
          ),
        ),
      }),
    ),
  )
  consigne.position.y = 1.35
  accueil.add(consigne)

  // Photos en cercle.
  const photos = []
  const geoPhoto = garder(new THREE.PlaneGeometry(1, 1))
  PHOTOS_VR.forEach((p, i) => {
    const angle = ((i + 1) / (PHOTOS_VR.length + 1)) * Math.PI * 2
    const groupe = new THREE.Group()
    groupe.position.set(Math.sin(angle) * RAYON_PHOTOS, HAUTEUR_YEUX, -Math.cos(angle) * RAYON_PHOTOS)
    groupe.lookAt(0, HAUTEUR_YEUX, 0)
    groupe.userData = {
      maison: { position: groupe.position.clone(), quaternion: groupe.quaternion.clone(), echelle: 1 },
      phase: i * 0.9,
    }

    const cadre = new THREE.Mesh(
      geoPhoto,
      garder(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 })),
    )
    cadre.position.z = -0.005
    groupe.add(cadre)
    const image = new THREE.Mesh(geoPhoto, garder(new THREE.MeshBasicMaterial({ color: 0xdfe8ef })))
    groupe.add(image)
    const legende = new THREE.Mesh(
      garder(new THREE.PlaneGeometry(1.6, 0.25)),
      garder(
        new THREE.MeshBasicMaterial({
          transparent: true,
          depthWrite: false,
          map: garder(
            textureTexte([{ texte: p.legende, taille: 64, police: '600 64px "Playfair Display", Georgia, serif' }], {
              largeur: 1024,
              hauteur: 160,
            }),
          ),
        }),
      ),
    )
    groupe.add(legende)

    const dimensionner = (ratio) => {
      const h = 1.05
      const w = Math.min(h * ratio, 2.1)
      const hh = w / ratio
      image.scale.set(w, hh, 1)
      cadre.scale.set(w + 0.08, hh + 0.08, 1)
      legende.position.y = -hh / 2 - 0.2
    }
    dimensionner(4 / 3)
    charger(p.src).then((t) => {
      if (!t || detruit) return
      image.material.map = t
      image.material.color.set(0xffffff)
      image.material.needsUpdate = true
      dimensionner(t.image.width / t.image.height)
    })

    image.userData.photo = groupe
    cadre.userData.photo = groupe
    photos.push(groupe)
    scene.add(groupe)
  })
  const cibles = photos.flatMap((g) => g.children.slice(0, 2))

  // --- Sélection d'une photo --------------------------------------------------

  let photoApprochee = null
  const raycaster = new THREE.Raycaster()
  const tmpMat = new THREE.Matrix4()
  const tmpVec = new THREE.Vector3()
  const tmpQuat = new THREE.Quaternion()

  function viser(origine, direction) {
    raycaster.set(origine, direction)
    const touche = raycaster.intersectObjects(cibles, false)[0]
    const groupe = touche?.object.userData.photo
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
      groupe.userData.proche = { position: cible, quaternion: orient.quaternion.clone(), echelle: 1.35 }
    }
    surChangement({ photo: photoApprochee ? PHOTOS_VR[photos.indexOf(photoApprochee)].legende : null })
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

  renderer.setAnimationLoop(() => {
    const dt = Math.min(horloge.getDelta(), 0.1) * vitesse
    const t = horloge.elapsedTime * vitesse

    ciel.material.uniforms.uTemps.value = t
    rayons.rotation.y += dt * 0.03
    matRayon.uniforms.uOpacite.value = 0.13 + 0.04 * Math.sin(t * 0.5)
    for (const n of nuages.children) n.position.x += n.userData.derive * dt * 20
    for (let i = 0; i < NB_PARTICULES; i++) {
      let y = posParticules.getY(i) + dt * 0.12
      if (y > 14) y = -2
      posParticules.setY(i, y)
    }
    posParticules.needsUpdate = true
    for (const c of accueil.children) if (c.userData.flotte !== undefined) c.position.y = 2.75 + Math.sin(t * 0.8) * 0.04

    // Photos : retour au cercle ou approche, en douceur.
    const k = 1 - Math.pow(0.002, dt)
    for (const g of photos) {
      const cible = g === photoApprochee ? g.userData.proche : g.userData.maison
      const flotte = g === photoApprochee ? 0 : Math.sin(t * 0.7 + g.userData.phase) * 0.05
      tmpVec.copy(cible.position).setY(cible.position.y + flotte)
      g.position.lerp(tmpVec, k)
      g.quaternion.slerp(cible.quaternion, k)
      const e = THREE.MathUtils.lerp(g.scale.x, cible.echelle, k)
      g.scale.setScalar(e)
    }

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
      orientationVersQuaternion(
        qGyro,
        alpha - decalageAlpha,
        THREE.MathUtils.degToRad(o.beta),
        THREE.MathUtils.degToRad(o.gamma),
        orient,
      )
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
    for (const o of aDetruire) o.dispose?.()
    renderer.dispose()
    renderer.domElement.remove()
  }

  return { vrDisponible, entrerVR, activerGyro, couperGyro, basculerCarton, viserDepuisCamera, detruire }
}
