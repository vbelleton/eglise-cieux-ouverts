// Lieu « Notre salle » : la salle de l'église telle qu'on la connaît — plafond
// de dalles blanches, poutres de bois, parquet, grande croix de bois éclairée
// sur le mur du fond, bambous en pots blancs, chaises beiges, fenêtres à
// stores blancs à gauche, porte à droite. Pendant le temps de prière, les
// néons s'éteignent et seule la croix éclaire.
//
// Repère : on se tient à z = 0, face à la croix (z négatif). La salle va de
// x = -7 à 7 et de z = -10 à 9, sous 6,2 m de plafond (assez haut pour voir la croix au-dessus du pupitre).
import * as THREE from 'three'
import { collecteur, bruit2D, textureCanvas, pixels, textureLueur } from './outils.js'

const L = 7
const AVANT = -10
const ARRIERE = 9
const H = 6.2

function textureParquet(garder, alea) {
  const b = bruit2D(Math.floor(alea() * 1e6))
  return garder(
    textureCanvas(
      512,
      512,
      (ctx, l, h) => {
        const lames = 8
        const teintes = Array.from({ length: lames * 4 }, () => 0.82 + alea() * 0.3)
        pixels(ctx, l, h, (x, y) => {
          const i = Math.floor((x / l) * lames)
          const seg = Math.floor(((y / h) * 4 + (i % 2) * 0.5) % 4)
          if (((x / l) * lames) % 1 < 0.02) return [60, 44, 32]
          const t = teintes[i * 4 + seg] * (0.85 + b(x / 6, y / 90, 3) * 0.3)
          return [Math.min(255, 140 * t), Math.min(255, 98 * t), Math.min(255, 68 * t)]
        })
      },
      { repeter: [L / 1.4, (ARRIERE - AVANT) / 1.4] },
    ),
  )
}

/** Plafond : dalles blanches de 60 cm, joints gris. */
function texturePlafond(garder) {
  return garder(
    textureCanvas(
      256,
      256,
      (ctx, l, h) => {
        ctx.fillStyle = '#f3f3f0'
        ctx.fillRect(0, 0, l, h)
        ctx.strokeStyle = '#b9bab6'
        ctx.lineWidth = 3
        ctx.strokeRect(0, 0, l, h)
        ctx.fillStyle = 'rgba(150,150,145,0.35)'
        for (let i = 0; i < 90; i++) ctx.fillRect(Math.random() * l, Math.random() * h, 2, 2)
      },
      { repeter: [L * 2 / 1.2, (ARRIERE - AVANT) / 1.2] },
    ),
  )
}

/** Fenêtre à stores verticaux blancs. */
function textureStores(garder) {
  return garder(
    textureCanvas(256, 256, (ctx, l, h) => {
      for (let x = 0; x < l; x += 16) {
        const g = ctx.createLinearGradient(x, 0, x + 16, 0)
        g.addColorStop(0, '#fdfdfb')
        g.addColorStop(1, '#e4e6e8')
        ctx.fillStyle = g
        ctx.fillRect(x, 0, 16, h)
      }
    }),
  )
}

export function construire({ alea }) {
  const { garder, liberer } = collecteur()
  const groupe = new THREE.Group()
  const mat = (couleur, rugosite = 0.9) => garder(new THREE.MeshStandardMaterial({ color: couleur, roughness: rugosite }))
  const boite = (l, h, p, materiau, x, y, z) => {
    const m = new THREE.Mesh(garder(new THREE.BoxGeometry(l, h, p)), materiau)
    m.position.set(x, y, z)
    groupe.add(m)
    return m
  }
  const centreZ = (AVANT + ARRIERE) / 2
  const profondeur = ARRIERE - AVANT

  const blanc = mat(0xf4f2ec)
  const bois = mat(0x9a6a3e, 0.7)

  // Sol, murs, plafond.
  const sol = new THREE.Mesh(
    garder(new THREE.PlaneGeometry(L * 2, profondeur)),
    garder(new THREE.MeshStandardMaterial({ map: textureParquet(garder, alea), roughness: 0.6 })),
  )
  sol.rotation.x = -Math.PI / 2
  sol.position.z = centreZ
  groupe.add(sol)
  const murs = [
    [L * 2, 0, AVANT, 0],
    [L * 2, 0, ARRIERE, Math.PI],
    [profondeur, -L, centreZ, Math.PI / 2],
    [profondeur, L, centreZ, -Math.PI / 2],
  ]
  for (const [l, x, z, ry] of murs) {
    const m = new THREE.Mesh(garder(new THREE.PlaneGeometry(l, H)), blanc)
    m.position.set(x, H / 2, z)
    m.rotation.y = ry
    groupe.add(m)
  }
  const plafond = new THREE.Mesh(
    garder(new THREE.PlaneGeometry(L * 2, profondeur)),
    garder(new THREE.MeshStandardMaterial({ map: texturePlafond(garder), roughness: 1 })),
  )
  plafond.rotation.x = Math.PI / 2
  plafond.position.set(0, H, centreZ)
  groupe.add(plafond)

  // Poutres de bois : en travers, et en V vers les coins comme sur le toit.
  for (const z of [-7, -2.5, 2, 6.5]) boite(L * 2, 0.28, 0.3, bois, 0, H - 0.14, z)
  for (const sens of [-1, 1]) {
    const p = boite(0.28, 0.26, 7.4, bois, sens * 4.2, H - 0.13, -6.2)
    p.rotation.y = sens * 0.55
  }

  // Néons : dalles lumineuses au plafond.
  const matNeon = garder(new THREE.MeshBasicMaterial({ color: 0xffffff }))
  const neons = []
  for (const x of [-4, 0, 4])
    for (const z of [-6, -1, 4]) {
      const n = new THREE.Mesh(garder(new THREE.PlaneGeometry(1.2, 0.6)), matNeon)
      n.rotation.x = Math.PI / 2
      n.position.set(x, H - 0.02, z)
      groupe.add(n)
      neons.push(n)
    }

  // Croix de bois lumineuse au fond, rideau blanc de part et d'autre.
  const croixBois = garder(new THREE.MeshStandardMaterial({ color: 0xb87a3c, emissive: 0xff9a40, emissiveIntensity: 0.9, roughness: 0.5 }))
  boite(0.2, 3, 0.1, croixBois, 0, 4.7, AVANT + 0.06)
  boite(1.5, 0.2, 0.1, croixBois, 0, 5.3, AVANT + 0.06)
  const halo = new THREE.Sprite(
    garder(new THREE.SpriteMaterial({ map: garder(textureLueur('255,200,120')), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.25 })),
  )
  halo.position.set(0, 4.9, AVANT + 0.3)
  halo.scale.setScalar(5)
  groupe.add(halo)
  const lumCroix = new THREE.PointLight(0xffc070, 4, 12, 1.5)
  lumCroix.position.set(0, 4.6, AVANT + 1)
  groupe.add(lumCroix)
  for (const dx of [-3, 3]) boite(1.6, 4.4, 0.06, mat(0xf0f0ee, 1), dx, 2.6, AVANT + 0.05)
  // Rampe de projecteurs.
  boite(5, 0.06, 0.06, mat(0x9aa0a6, 0.4), 0, 5.8, AVANT + 2.2)
  for (let x = -2; x <= 2; x++) boite(0.12, 0.16, 0.12, mat(0x222428), x, 5.7, AVANT + 2.2)

  // Fenêtres à stores, mur de gauche ; porte claire à droite, au fond.
  const stores = garder(new THREE.MeshBasicMaterial({ map: textureStores(garder) }))
  const fenetres = []
  for (const z of [-5.5, -1.5]) {
    const f = new THREE.Mesh(garder(new THREE.PlaneGeometry(2.9, 1.8)), stores)
    f.rotation.y = Math.PI / 2
    f.position.set(-L + 0.075, 2, z)
    groupe.add(f)
    fenetres.push(f)
    boite(0.08, 2.0, 3.1, mat(0x9a8a76, 0.7), -L + 0.025, 2, z)
  }
  boite(0.08, 2.2, 1.0, mat(0xd8b88a, 0.7), L - 0.05, 1.1, AVANT + 2.2)

  // Bambous en pots blancs, de chaque côté de l'allée.
  const pot = garder(new THREE.CylinderGeometry(0.28, 0.22, 0.45, 16))
  const matPot = mat(0xf5f5f2, 0.5)
  const tige = garder(new THREE.CylinderGeometry(0.015, 0.02, 2.6, 5))
  const matTige = mat(0x9aa85a)
  const feuille = garder(new THREE.IcosahedronGeometry(0.13, 0))
  const matFeuille = mat(0x4f8a3a)
  for (const [x, z] of [[-2.4, -2.5], [2.4, -2.5], [-5.6, -8.6], [5.6, -8.6], [-3, 2], [3, 2], [-6.4, 7.5], [6.4, 7.5]]) {
    const p = new THREE.Mesh(pot, matPot)
    p.position.set(x, 0.22, z)
    groupe.add(p)
    for (let i = 0; i < 7; i++) {
      const a = alea() * Math.PI * 2
      const r = alea() * 0.14
      const hh = 0.8 + alea() * 1.1
      const t = new THREE.Mesh(tige, matTige)
      t.scale.y = hh / 2.6
      t.position.set(x + Math.cos(a) * r, 0.45 + hh / 2, z + Math.sin(a) * r)
      groupe.add(t)
      for (let k = 0; k < 5; k++) {
        const fl = new THREE.Mesh(feuille, matFeuille)
        fl.scale.set(1.8, 0.45, 0.7)
        fl.position.set(x + Math.cos(a) * (r + 0.12), 0.45 + hh * (0.3 + k * 0.16), z + Math.sin(a) * (r + 0.12))
        fl.rotation.y = alea() * 3
        groupe.add(fl)
      }
    }
  }

  // Chaises beiges derrière soi (assise, dossier, pieds : 3 instances).
  const rangs = 5
  const cols = 9
  const nb = rangs * cols - rangs
  const iAssise = new THREE.InstancedMesh(garder(new THREE.BoxGeometry(0.46, 0.05, 0.44)), mat(0xd9bf94, 0.8), nb)
  const iDossier = new THREE.InstancedMesh(garder(new THREE.BoxGeometry(0.46, 0.4, 0.04)), mat(0xd9bf94, 0.8), nb)
  const iPied = new THREE.InstancedMesh(garder(new THREE.BoxGeometry(0.03, 0.45, 0.4)), mat(0xb8bcc0, 0.4), nb * 2)
  const m4 = new THREE.Matrix4()
  let n = 0
  for (let r = 0; r < rangs; r++)
    for (let c = 0; c < cols; c++) {
      const x = (c - (cols - 1) / 2) * 0.95
      if (Math.abs(x) < 0.5) continue
      const z = 2.6 + r * 1.15
      m4.setPosition(x, 0.45, z)
      iAssise.setMatrixAt(n, m4)
      m4.setPosition(x, 0.7, z + 0.22)
      iDossier.setMatrixAt(n, m4)
      m4.setPosition(x - 0.2, 0.22, z)
      iPied.setMatrixAt(n * 2, m4)
      m4.setPosition(x + 0.2, 0.22, z)
      iPied.setMatrixAt(n * 2 + 1, m4)
      n++
    }
  groupe.add(garder(iAssise), garder(iDossier), garder(iPied))

  // Lumière : jour par les fenêtres et les néons, qui s'éteignent à la prière.
  const hemi = new THREE.HemisphereLight(0xffffff, 0x9a7a5a, 1.9)
  groupe.add(hemi)
  const lumNeons = [-3, 1.5].map((z) => {
    const l = new THREE.PointLight(0xfff4e6, 10, 18, 1.2)
    l.position.set(0, H - 0.8, z)
    groupe.add(l)
    return l
  })

  return {
    groupe,
    fond: new THREE.Color(0x1a1613),
    logo: false,
    hauteurMax: H - 0.6,
    maj(dt, t, calme) {
      const jour = 1 - calme * 0.85
      hemi.intensity = 1.9 * jour
      for (const l of lumNeons) l.intensity = 10 * jour
      for (const nn of neons) nn.material.color.setScalar(0.25 + 0.75 * jour)
      for (const f of fenetres) f.material.color.setScalar(0.35 + 0.65 * jour)
      croixBois.emissiveIntensity = 0.6 + calme * 1.0 + Math.sin(t * 0.8) * 0.05
      lumCroix.intensity = 4 + calme * 6
      halo.material.opacity = 0.25 + calme * 0.5
    },
    liberer,
  }
}
