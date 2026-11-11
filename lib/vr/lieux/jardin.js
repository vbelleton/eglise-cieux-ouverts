// Lieu « Le jardin d'oliviers » : une clairière au coucher du soleil,
// entourée d'oliviers noueux, un muret de pierres sèches, des touffes
// d'herbe, des lucioles. Le temps de prière fait tomber le soir : le ciel
// s'assombrit, les étoiles paraissent, les lucioles s'allument.
import * as THREE from 'three'
import { collecteur, bruit2D, textureLueur, ajouterCiel, geometrieRocher } from './outils.js'

const DIR_SOLEIL = new THREE.Vector3(-0.35, 0.07, -1)

export function construire({ alea }) {
  const { garder, liberer } = collecteur()
  const groupe = new THREE.Group()
  const b = bruit2D(Math.floor(alea() * 1e6))

  const ciel = ajouterCiel(groupe, garder, {
    horizon: [1.0, 0.6, 0.34],
    milieu: [0.93, 0.55, 0.52],
    zenith: [0.22, 0.27, 0.5],
    soleil: [1.0, 0.75, 0.45],
    directionSoleil: DIR_SOLEIL,
    nuit: { horizon: [0.32, 0.2, 0.3], zenith: [0.03, 0.05, 0.14] },
    etoiles: true,
  })

  // Terrain : plat dans la clairière, collines au loin.
  const hauteur = (x, z) => {
    const d = Math.hypot(x, z)
    const relief = THREE.MathUtils.smoothstep(d, 7, 40)
    return (b(x / 25 + 10, z / 25 + 10, 4) - 0.45) * (1 + relief * 22) * (0.25 + relief) + relief * Math.max(0, d - 60) * 0.12
  }
  const geoSol = garder(new THREE.PlaneGeometry(400, 400, 160, 160))
  geoSol.rotateX(-Math.PI / 2)
  const pos = geoSol.attributes.position
  const coul = []
  const c = new THREE.Color()
  const herbe = new THREE.Color(0x76863c)
  const sec = new THREE.Color(0xb39d58)
  const terre = new THREE.Color(0x6b5236)
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    pos.setY(i, Math.hypot(x, z) < 6 ? 0 : hauteur(x, z))
    const n = b(x / 6, z / 6, 3)
    c.copy(herbe).lerp(sec, THREE.MathUtils.smoothstep(n, 0.45, 0.7))
    // Sentier de terre battue vers l'autel.
    if (Math.abs(x + Math.sin(z / 4) * 0.4) < 0.7 && z > -2) c.lerp(terre, 0.75)
    coul.push(c.r, c.g, c.b)
  }
  geoSol.setAttribute('color', new THREE.Float32BufferAttribute(coul, 3))
  geoSol.computeVertexNormals()
  groupe.add(new THREE.Mesh(geoSol, garder(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }))))

  // Oliviers : troncs tordus, feuillage argenté en boules facettées.
  const matTronc = garder(new THREE.MeshStandardMaterial({ color: 0x7a6a5a, roughness: 1, flatShading: true }))
  const matsFeuillage = [0x95a46c, 0xa7b483, 0x86965c].map((col) => garder(new THREE.MeshStandardMaterial({ color: col, roughness: 0.9, flatShading: true })))
  const troncs = [0, 1, 2].map(() => {
    const g = garder(new THREE.CylinderGeometry(0.16, 0.34, 1.9, 8, 6))
    const p = g.attributes.position
    const torsion = 0.6 + alea() * 0.8
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i) + 0.95
      const a = y * torsion
      const x = p.getX(i)
      const z = p.getZ(i)
      p.setXYZ(i, x * Math.cos(a) - z * Math.sin(a) + Math.sin(y * 2.1) * 0.12, p.getY(i), x * Math.sin(a) + z * Math.cos(a) + (alea() - 0.5) * 0.05)
    }
    g.translate(0, 0.95, 0)
    g.computeVertexNormals()
    return g
  })
  const boule = garder(new THREE.IcosahedronGeometry(1, 1))
  const occupe = (x, z) => Math.hypot(x, z) < 6.5 || (z < -1 && Math.abs(x) < 3.2)
  let arbres = 0
  for (let essai = 0; essai < 400 && arbres < 34; essai++) {
    const a = alea() * Math.PI * 2
    const d = 7 + Math.pow(alea(), 0.8) * 34
    const x = Math.cos(a) * d
    const z = Math.sin(a) * d
    if (occupe(x, z)) continue
    const arbre = new THREE.Group()
    arbre.add(new THREE.Mesh(troncs[arbres % 3], matTronc))
    const nb = 5 + Math.floor(alea() * 4)
    for (let i = 0; i < nb; i++) {
      const f = new THREE.Mesh(boule, matsFeuillage[i % 3])
      const r = 0.6 + alea() * 0.6
      f.scale.set(r * 1.3, r * 0.75, r * 1.3)
      f.position.set((alea() - 0.5) * 2.2, 1.9 + alea() * 0.9, (alea() - 0.5) * 2.2)
      arbre.add(f)
    }
    const e = 0.85 + alea() * 0.6
    arbre.scale.setScalar(e)
    arbre.rotation.y = alea() * Math.PI * 2
    arbre.position.set(x, Math.hypot(x, z) < 6 ? 0 : hauteur(x, z) - 0.05, z)
    groupe.add(arbre)
    arbres++
  }

  // Muret de pierres sèches en arc, derrière soi, et quelques rochers.
  const geoPierres = [0, 1, 2].map(() =>
    garder(geometrieRocher(alea, { detail: 1, aplatir: 0.7, couleurs: [new THREE.Color(0x9a8f80), new THREE.Color(0xc2b6a2)] })),
  )
  const matPierre = garder(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }))
  for (let a = Math.PI * 0.2; a < Math.PI * 0.8; a += 0.045)
    for (let rang = 0; rang < 2; rang++) {
      const p = new THREE.Mesh(geoPierres[Math.floor(alea() * 3)], matPierre)
      const r = 7.6 + (alea() - 0.5) * 0.2
      p.position.set(Math.cos(a) * r, 0.18 + rang * 0.32, Math.sin(a) * r)
      p.scale.set(0.32 + alea() * 0.12, 0.2, 0.25)
      p.rotation.y = alea() * 3
      groupe.add(p)
    }
  for (let i = 0; i < 14; i++) {
    const a = alea() * Math.PI * 2
    const d = 5 + alea() * 20
    const x = Math.cos(a) * d
    const z = Math.sin(a) * d
    if (occupe(x, z)) continue
    const r = new THREE.Mesh(geoPierres[i % 3], matPierre)
    r.scale.setScalar(0.3 + alea() * 0.7)
    r.position.set(x, (d < 6 ? 0 : hauteur(x, z)) + 0.05, z)
    groupe.add(r)
  }
  // Un banc de pierre, à gauche.
  const banc = new THREE.Mesh(garder(new THREE.BoxGeometry(1.8, 0.12, 0.5)), garder(new THREE.MeshStandardMaterial({ color: 0xb3a690, roughness: 1 })))
  banc.position.set(-4.2, 0.46, 1.8)
  banc.rotation.y = 0.5
  groupe.add(banc)
  for (const dx of [-0.65, 0.65]) {
    const pied = new THREE.Mesh(garder(new THREE.BoxGeometry(0.22, 0.42, 0.4)), banc.material)
    pied.position.set(-4.2 + dx * Math.cos(0.5), 0.21, 1.8 - dx * Math.sin(0.5))
    pied.rotation.y = 0.5
    groupe.add(pied)
  }

  // Touffes d'herbe (instances).
  const nbTouffes = 1400
  const touffes = new THREE.InstancedMesh(
    garder(new THREE.ConeGeometry(0.035, 0.38, 3)),
    garder(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 })),
    nbTouffes,
  )
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const s = new THREE.Vector3()
  const v = new THREE.Vector3()
  const e = new THREE.Euler()
  for (let i = 0; i < nbTouffes; i++) {
    const a = alea() * Math.PI * 2
    const d = 2.6 + Math.pow(alea(), 0.6) * 28
    const x = Math.cos(a) * d
    const z = Math.sin(a) * d
    v.set(x, (d < 6 ? 0 : hauteur(x, z)) + 0.15, z)
    q.setFromEuler(e.set((alea() - 0.5) * 0.5, 0, (alea() - 0.5) * 0.5))
    s.setScalar(0.6 + alea() * 0.9)
    touffes.setMatrixAt(i, m.compose(v, q, s))
    touffes.setColorAt(i, c.copy(herbe).lerp(sec, alea() * 0.8))
  }
  groupe.add(garder(touffes))

  // Lucioles.
  const nbLucioles = 140
  const base = []
  const pl = new Float32Array(nbLucioles * 3)
  for (let i = 0; i < nbLucioles; i++) {
    const a = alea() * Math.PI * 2
    const d = 3 + alea() * 14
    base.push([Math.cos(a) * d, 0.3 + alea() * 2.2, Math.sin(a) * d, alea() * 10])
  }
  const geoLucioles = garder(new THREE.BufferGeometry())
  geoLucioles.setAttribute('position', new THREE.BufferAttribute(pl, 3))
  const matLucioles = garder(
    new THREE.PointsMaterial({
      size: 0.09,
      map: garder(textureLueur('220,255,140')),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      color: 0xd8ff8a,
      opacity: 0.4,
    }),
  )
  groupe.add(new THREE.Points(geoLucioles, matLucioles))

  const hemi = new THREE.HemisphereLight(0xffd2b0, 0x5a6a3a, 2.3)
  const soleil = new THREE.DirectionalLight(0xffa864, 2.2)
  soleil.position.copy(DIR_SOLEIL).multiplyScalar(50)
  groupe.add(hemi, soleil)
  const brume = new THREE.Fog(0xe9a172, 30, 190)
  const brumeJour = new THREE.Color(0xe9a172)
  const brumeNuit = new THREE.Color(0x2a2236)

  return {
    groupe,
    fog: brume,
    logo: false,
    hauteurMax: Infinity,
    maj(dt, t, calme) {
      ciel.uniforms.uCalme.value = calme
      hemi.intensity = 2.3 - calme * 1.7
      soleil.intensity = 2.2 * (1 - calme * 0.9)
      brume.color.copy(brumeJour).lerp(brumeNuit, calme * 0.8)
      matLucioles.opacity = 0.35 + calme * 0.65
      const p = geoLucioles.attributes.position
      for (let i = 0; i < nbLucioles; i++) {
        const [x, y, z, ph] = base[i]
        p.setXYZ(i, x + Math.sin(t * 0.3 + ph) * 0.8, y + Math.sin(t * 0.7 + ph * 2) * 0.3, z + Math.cos(t * 0.25 + ph) * 0.8)
      }
      p.needsUpdate = true
    },
    liberer,
  }
}
