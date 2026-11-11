// Lieu « Au-dessus des nuages » : disque de lumière sur une mer de nuages,
// sous un ciel qui s'ouvre (l'image d'accueil du site, en volume). Le ciel
// prend la teinte des photos de la spirale (teinter) ; le temps de prière le
// réchauffe.
import * as THREE from 'three'
import { collecteur, textureCanvas } from './outils.js'


const BLEU_CIEL = new THREE.Color(0.725, 0.8, 0.86)

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

export function construire({ alea }) {
  const { garder, liberer } = collecteur()
  const groupe = new THREE.Group()

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
  groupe.add(ciel)
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
  groupe.add(rayons)

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
  groupe.add(nuages)

  // Disque de lumière où l'on se tient.
  const disque = new THREE.Mesh(
    garder(new THREE.CircleGeometry(2.4, 64)),
    garder(new THREE.MeshBasicMaterial({ map: garder(textureDisque()), transparent: true, depthWrite: false })),
  )
  disque.rotation.x = -Math.PI / 2
  disque.position.y = 0.001
  groupe.add(disque)
  const anneau = new THREE.Mesh(
    garder(new THREE.RingGeometry(2.2, 2.24, 96)),
    garder(new THREE.MeshBasicMaterial({ color: 0xd97777, transparent: true, opacity: 0.45, depthWrite: false })),
  )
  anneau.rotation.x = -Math.PI / 2
  anneau.position.y = 0.002
  groupe.add(anneau)

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
  groupe.add(particules)

  const posParticules = geoParticules.attributes.position

  return {
    groupe,
    fog: new THREE.Fog(0xeef3f7, 40, 260),
    logo: true,
    hauteurMax: Infinity,
    teinter(couleur) {
      teinteCible.copy(couleur ? BLEU_CIEL.clone().lerp(couleur, 0.45) : BLEU_CIEL)
    },
    maj(dt, t, calme) {
      ciel.material.uniforms.uTemps.value = t
      ciel.material.uniforms.uTeinte.value.lerp(teinteCible, Math.min(1, dt * 0.8))
      ciel.material.uniforms.uCalme.value = calme
      rayons.rotation.y += dt * 0.03
      matRayon.uniforms.uOpacite.value = 0.13 + 0.04 * Math.sin(t * 0.5) + calme * 0.08
      for (const n of nuages.children) n.position.x += n.userData.derive * dt * 20
      for (let i = 0; i < NB_PARTICULES; i++) {
        let y = posParticules.getY(i) + dt * 0.12
        if (y > 14) y = -2
        posParticules.setY(i, y)
      }
      posParticules.needsUpdate = true
    },
    liberer,
  }
}
