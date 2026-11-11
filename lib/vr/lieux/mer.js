// Lieu « Le bord de mer » : une dalle de granit rose au-dessus des vagues,
// des chaos de rochers, une plage, un phare breton au loin dont le faisceau
// tourne, des goélands. Le temps de prière apaise la mer et réchauffe le ciel.
import * as THREE from 'three'
import { collecteur, bruit2D, textureLueur, ajouterCiel, geometrieRocher } from './outils.js'

const DIR_SOLEIL = new THREE.Vector3(0.55, 0.09, -1)
const NIVEAU_MER = -1.3

export function construire({ alea }) {
  const { garder, liberer } = collecteur()
  const groupe = new THREE.Group()
  const b = bruit2D(Math.floor(alea() * 1e6))

  const ciel = ajouterCiel(groupe, garder, {
    horizon: [1.0, 0.84, 0.74],
    milieu: [0.8, 0.84, 0.9],
    zenith: [0.42, 0.62, 0.84],
    soleil: [1.0, 0.86, 0.66],
    directionSoleil: DIR_SOLEIL,
    nuit: { horizon: [1.0, 0.72, 0.55], zenith: [0.35, 0.42, 0.66] },
  })

  // Mer : vagues calculées dans le shader, couleur selon la profondeur,
  // reflet du ciel et scintillement du soleil.
  const matMer = garder(
    new THREE.ShaderMaterial({
      uniforms: {
        uTemps: { value: 0 },
        uAmplitude: { value: 1 },
        uSoleil: { value: DIR_SOLEIL.clone().normalize() },
        uCiel: { value: new THREE.Color(1.0, 0.86, 0.78) },
      },
      vertexShader: `
        uniform float uTemps, uAmplitude;
        varying vec3 vMonde;
        varying vec3 vNormale;
        float vague(vec2 p, vec2 d, float l, float a, float v) {
          return a * sin(dot(p, normalize(d)) * 6.2831 / l + uTemps * v);
        }
        float h(vec2 p) {
          return uAmplitude * (vague(p, vec2(1.0, 0.3), 9.0, 0.22, 1.1) + vague(p, vec2(-0.4, 1.0), 5.0, 0.12, 1.6)
            + vague(p, vec2(0.7, -0.6), 2.6, 0.05, 2.3) + vague(p, vec2(0.2, 0.9), 1.3, 0.025, 3.1));
        }
        void main() {
          vec3 p = (modelMatrix * vec4(position, 1.0)).xyz;
          float e = 0.15;
          float hy = h(p.xz);
          vec3 n = normalize(vec3(h(p.xz - vec2(e, 0.0)) - h(p.xz + vec2(e, 0.0)), 2.0 * e, h(p.xz - vec2(0.0, e)) - h(p.xz + vec2(0.0, e))));
          p.y += hy;
          vMonde = p;
          vNormale = n;
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 uSoleil, uCiel;
        varying vec3 vMonde;
        varying vec3 vNormale;
        void main() {
          vec3 vue = normalize(cameraPosition - vMonde);
          vec3 n = normalize(vNormale);
          float fresnel = pow(1.0 - max(dot(vue, n), 0.0), 4.0);
          float d = length(vMonde.xz);
          vec3 profond = vec3(0.04, 0.22, 0.32);
          vec3 turquoise = vec3(0.12, 0.52, 0.55);
          vec3 c = mix(turquoise, profond, smoothstep(10.0, 70.0, d));
          c = mix(c, uCiel, clamp(fresnel * 0.85, 0.0, 0.85));
          vec3 r = reflect(-vue, n);
          c += vec3(1.0, 0.9, 0.7) * pow(max(dot(r, uSoleil), 0.0), 180.0) * 2.5;
          // Écume près des rochers.
          float ecume = smoothstep(9.5, 6.5, d) * smoothstep(0.0, 0.25, vMonde.y - ${NIVEAU_MER.toFixed(2)} + 0.1);
          c = mix(c, vec3(0.95), ecume * 0.6);
          // Fondu vers l'horizon.
          c = mix(c, uCiel, smoothstep(120.0, 380.0, d));
          gl_FragColor = vec4(c, 1.0);
        }`,
    }),
  )
  const geoMer = garder(new THREE.PlaneGeometry(800, 800, 220, 220))
  geoMer.rotateX(-Math.PI / 2)
  const mer = new THREE.Mesh(geoMer, matMer)
  mer.position.y = NIVEAU_MER
  mer.frustumCulled = false
  groupe.add(mer)

  // Dalle de granit où l'on se tient, chaos de rochers autour.
  const granit = [new THREE.Color(0xb98a7c), new THREE.Color(0xd8ab98), new THREE.Color(0xd6a14a)]
  const matGranit = garder(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }))
  // Le dessus est écrêté, donc plat : on y marche, et rien ne dépasse devant
  // le bas du pupitre.
  const dalle = new THREE.Mesh(garder(geometrieRocher(alea, { detail: 4, aplatir: 1, couleurs: granit, plafond: 0.5 })), matGranit)
  dalle.scale.set(5.2, 1.6, 5.2)
  dalle.position.y = -0.8
  groupe.add(dalle)
  const formes = [0, 1, 2, 3].map(() => garder(geometrieRocher(alea, { detail: 3, aplatir: 0.7, couleurs: granit })))
  const libre = (x, z) => !(z < -1 && Math.abs(x) < 3.4) && Math.hypot(x, z) > 3.8
  for (let i = 0; i < 46; i++) {
    const a = alea() * Math.PI * 2
    const d = 4.5 + Math.pow(alea(), 1.4) * 30
    const x = Math.cos(a) * d
    const z = Math.sin(a) * d
    if (!libre(x, z)) continue
    const r = new THREE.Mesh(formes[i % 4], matGranit)
    const e = (0.6 + alea() * 1.8) * (d < 8 ? 0.8 : 1.4)
    r.scale.set(e * (1 + alea() * 0.6), e * (0.6 + alea() * 0.5), e)
    r.rotation.y = alea() * Math.PI * 2
    r.position.set(x, NIVEAU_MER + e * 0.25, z)
    groupe.add(r)
  }

  // Plage de sable sur la droite.
  const geoPlage = garder(new THREE.PlaneGeometry(60, 40, 40, 30))
  geoPlage.rotateX(-Math.PI / 2)
  const pp = geoPlage.attributes.position
  for (let i = 0; i < pp.count; i++) {
    const x = pp.getX(i)
    const z = pp.getZ(i)
    pp.setY(i, NIVEAU_MER - 0.6 + (x + 30) * 0.05 + b(x / 8, z / 8, 3) * 0.4)
  }
  geoPlage.computeVertexNormals()
  const plage = new THREE.Mesh(geoPlage, garder(new THREE.MeshStandardMaterial({ color: 0xe6d3b3, roughness: 1 })))
  plage.position.set(48, 0, 18)
  plage.rotation.y = -0.4
  groupe.add(plage)

  // Phare sur son îlot, au loin : bandes blanches et rouges, lanterne,
  // faisceau qui tourne.
  const phare = new THREE.Group()
  const ilot = new THREE.Mesh(formes[0], matGranit)
  ilot.scale.set(9, 4, 7)
  phare.add(ilot)
  const blanc = garder(new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.7 }))
  const rouge = garder(new THREE.MeshStandardMaterial({ color: 0xb8322a, roughness: 0.7 }))
  for (let i = 0; i < 6; i++) {
    const t = new THREE.Mesh(garder(new THREE.CylinderGeometry(1.5 - (i + 1) * 0.12, 1.5 - i * 0.12, 3, 20)), i % 2 ? rouge : blanc)
    t.position.y = 2 + i * 3 + 1.5
    phare.add(t)
  }
  const lanterne = new THREE.Mesh(garder(new THREE.CylinderGeometry(0.9, 0.9, 1.6, 16)), garder(new THREE.MeshBasicMaterial({ color: 0xfff1c0 })))
  lanterne.position.y = 21.8
  const toit = new THREE.Mesh(garder(new THREE.ConeGeometry(1.2, 1.4, 16)), rouge)
  toit.position.y = 23.3
  const halo = new THREE.Sprite(garder(new THREE.SpriteMaterial({ map: garder(textureLueur('255,240,190')), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false })))
  halo.position.y = 21.8
  halo.scale.setScalar(9)
  const faisceau = new THREE.Mesh(
    garder(new THREE.ConeGeometry(4, 70, 24, 1, true)),
    garder(new THREE.MeshBasicMaterial({ color: 0xfff0c0, transparent: true, opacity: 0.035, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })),
  )
  faisceau.geometry.translate(0, -35, 0)
  faisceau.rotation.z = Math.PI / 2
  const pivot = new THREE.Group()
  pivot.position.y = 21.8
  pivot.add(faisceau)
  phare.add(lanterne, toit, halo, pivot)
  phare.position.set(-70, NIVEAU_MER - 1, -150)
  groupe.add(phare)

  // Goélands : deux ailes qui battent, en cercles au-dessus de l'eau.
  const matAile = garder(new THREE.MeshBasicMaterial({ color: 0xf5f5f2, side: THREE.DoubleSide }))
  const geoAile = garder(new THREE.BufferGeometry())
  geoAile.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.12, 0, 0, 0.12, 0.7, 0, 0], 3))
  const goelands = []
  for (let i = 0; i < 6; i++) {
    const oiseau = new THREE.Group()
    const g = new THREE.Mesh(geoAile, matAile)
    const d = new THREE.Mesh(geoAile, matAile)
    d.scale.x = -1
    oiseau.add(g, d)
    oiseau.userData = { g, d, rayon: 15 + alea() * 25, hauteur: 6 + alea() * 8, vitesse: 0.08 + alea() * 0.07, phase: alea() * 6, centre: new THREE.Vector3((alea() - 0.5) * 40, 0, -20 - alea() * 40) }
    groupe.add(oiseau)
    goelands.push(oiseau)
  }

  const hemi = new THREE.HemisphereLight(0xd8e8f5, 0x6b5a50, 1.4)
  const soleil = new THREE.DirectionalLight(0xffe0bc, 2.2)
  soleil.position.copy(DIR_SOLEIL).multiplyScalar(60)
  groupe.add(hemi, soleil)

  return {
    groupe,
    fog: new THREE.Fog(0xf4dccd, 80, 420),
    logo: false,
    hauteurMax: Infinity,
    maj(dt, t, calme) {
      matMer.uniforms.uTemps.value = t
      matMer.uniforms.uAmplitude.value = 1 - calme * 0.55
      ciel.uniforms.uCalme.value = calme * 0.6
      pivot.rotation.y = t * 0.6
      for (const o of goelands) {
        const u = o.userData
        const a = t * u.vitesse + u.phase
        o.position.set(u.centre.x + Math.cos(a) * u.rayon, u.hauteur + Math.sin(t * 0.5 + u.phase) * 0.6, u.centre.z + Math.sin(a) * u.rayon)
        o.rotation.y = -a
        const battement = Math.sin(t * 6 + u.phase) * 0.5
        u.g.rotation.z = battement
        u.d.rotation.z = -battement
      }
    },
    liberer,
  }
}
