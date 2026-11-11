// Lieu « La chapelle » : murs de pierre, poutres, vitraux traversés de
// rayons de soleil, croix de bois au-dessus de l'autel, bougies qui
// vacillent, rangées de bancs derrière soi. Le temps de prière baisse la
// lumière du jour et laisse les bougies éclairer.
//
// Repère : on se tient à z = 0, face à l'autel (z négatif). La nef va de
// x = -7 à 7 et de z = -10 à 14, sous un plafond à 9 m.
import * as THREE from 'three'
import { collecteur, bruit2D, textureCanvas, pixels, textureLueur, materiauRayon } from './outils.js'

const LARGEUR = 14
const AVANT = -10
const ARRIERE = 14
const HAUTEUR = 9

function texturePierre(garder, alea) {
  const b = bruit2D(Math.floor(alea() * 1e6))
  return garder(
    textureCanvas(
      512,
      512,
      (ctx, l, h) => {
        // Appareillage de pierres : rangées décalées, joints clairs.
        const rangs = 8
        const hr = h / rangs
        const teintes = []
        for (let r = 0; r < rangs; r++) for (let c = 0; c < 5; c++) teintes.push(0.82 + alea() * 0.3)
        pixels(ctx, l, h, (x, y) => {
          const r = Math.floor(y / hr)
          const decal = r % 2 ? 0.5 : 0
          const lp = l / 4
          const c = Math.floor(x / lp + decal)
          const fx = x / lp + decal - c
          const fy = y / hr - r
          const joint = fx < 0.025 || fx > 0.975 || fy < 0.04 || fy > 0.96
          const n = b(x / 40, y / 40, 4)
          const t = teintes[(r * 5 + (c % 5)) % teintes.length] * (0.8 + n * 0.35)
          if (joint) return [196, 186, 168]
          return [Math.min(255, 168 * t), Math.min(255, 150 * t), Math.min(255, 126 * t)]
        })
      },
      { repeter: [4, 3] },
    ),
  )
}

function textureDalles(garder, alea) {
  const b = bruit2D(Math.floor(alea() * 1e6))
  return garder(
    textureCanvas(
      512,
      512,
      (ctx, l, h) => {
        const n = 4
        const teintes = Array.from({ length: n * n }, () => 0.8 + alea() * 0.35)
        pixels(ctx, l, h, (x, y) => {
          const cx = Math.floor((x / l) * n)
          const cy = Math.floor((y / h) * n)
          const fx = ((x / l) * n) % 1
          const fy = ((y / h) * n) % 1
          if (fx < 0.015 || fy < 0.015) return [70, 58, 48]
          const t = teintes[cy * n + cx] * (0.82 + b(x / 30, y / 30, 4) * 0.3)
          return [Math.min(255, 150 * t), Math.min(255, 128 * t), Math.min(255, 104 * t)]
        })
      },
      { repeter: [LARGEUR / 2.4, (ARRIERE - AVANT) / 2.4] },
    ),
  )
}

function textureBois(garder, alea, repeter = [1, 1]) {
  const b = bruit2D(Math.floor(alea() * 1e6))
  return garder(
    textureCanvas(
      256,
      256,
      (ctx, l, h) =>
        pixels(ctx, l, h, (x, y) => {
          const veine = Math.sin(x / 5 + b(x / 60, y / 12, 3) * 9) * 0.5 + 0.5
          const t = 0.72 + veine * 0.22 + b(x / 8, y / 90, 2) * 0.15
          return [120 * t, 74 * t, 42 * t]
        }),
      { repeter },
    ),
  )
}

/** Vitrail en arc : morceaux de verre colorés, sertis de plomb. */
function textureVitrail(garder, alea) {
  const palette = ['#1f4fa3', '#2f78c4', '#c4362f', '#e2a42b', '#3c8f4a', '#7b3fa0', '#e8d9a8']
  return garder(
    textureCanvas(256, 512, (ctx, l, h) => {
      const arc = () => {
        ctx.beginPath()
        ctx.moveTo(0, h)
        ctx.lineTo(0, l / 2)
        ctx.arc(l / 2, l / 2, l / 2, Math.PI, 0)
        ctx.lineTo(l, h)
        ctx.closePath()
      }
      ctx.save()
      arc()
      ctx.clip()
      // Morceaux : grille déformée de quadrilatères.
      const cols = 5
      const rangs = 11
      const pts = []
      for (let r = 0; r <= rangs; r++)
        for (let c = 0; c <= cols; c++) {
          const bord = c === 0 || c === cols || r === 0 || r === rangs
          pts.push([(c / cols) * l + (bord ? 0 : (alea() - 0.5) * 30), (r / rangs) * h + (bord ? 0 : (alea() - 0.5) * 30)])
        }
      const p = (r, c) => pts[r * (cols + 1) + c]
      for (let r = 0; r < rangs; r++)
        for (let c = 0; c < cols; c++) {
          const coins = [p(r, c), p(r, c + 1), p(r + 1, c + 1), p(r + 1, c)]
          ctx.beginPath()
          coins.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
          ctx.closePath()
          // Une croix claire au centre du vitrail.
          const croix = (c === 2 && r >= 2 && r <= 8) || (r === 4 && c >= 1 && c <= 3)
          ctx.fillStyle = croix ? '#f6e7b4' : palette[Math.floor(alea() * (palette.length - 1))]
          ctx.fill()
          ctx.lineWidth = 6
          ctx.strokeStyle = '#1a1612'
          ctx.stroke()
        }
      // Lumière plus vive au centre.
      const g = ctx.createRadialGradient(l / 2, h * 0.45, 10, l / 2, h * 0.45, h * 0.6)
      g.addColorStop(0, 'rgba(255,255,230,0.35)')
      g.addColorStop(1, 'rgba(0,0,0,0.25)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, l, h)
      ctx.restore()
      ctx.lineWidth = 10
      ctx.strokeStyle = '#2a2219'
      arc()
      ctx.stroke()
    }),
  )
}

export function construire({ alea }) {
  const { garder, liberer } = collecteur()
  const groupe = new THREE.Group()

  const matPierre = garder(new THREE.MeshStandardMaterial({ map: texturePierre(garder, alea), roughness: 0.95 }))
  const matDalles = garder(new THREE.MeshStandardMaterial({ map: textureDalles(garder, alea), roughness: 0.85 }))
  const matBois = garder(new THREE.MeshStandardMaterial({ map: textureBois(garder, alea), roughness: 0.7 }))
  const matBoisFonce = garder(new THREE.MeshStandardMaterial({ map: textureBois(garder, alea, [6, 2]), color: 0x8a7060, roughness: 0.8 }))

  // Sol, murs, plafond.
  const profondeur = ARRIERE - AVANT
  const sol = new THREE.Mesh(garder(new THREE.PlaneGeometry(LARGEUR, profondeur)), matDalles)
  sol.rotation.x = -Math.PI / 2
  sol.position.z = (AVANT + ARRIERE) / 2
  groupe.add(sol)

  const mur = (l, h, x, z, rotY) => {
    const m = new THREE.Mesh(garder(new THREE.PlaneGeometry(l, h)), matPierre)
    m.position.set(x, h / 2, z)
    m.rotation.y = rotY
    groupe.add(m)
  }
  mur(LARGEUR, HAUTEUR, 0, AVANT, 0)
  mur(LARGEUR, HAUTEUR, 0, ARRIERE, Math.PI)
  mur(profondeur, HAUTEUR, -LARGEUR / 2, (AVANT + ARRIERE) / 2, Math.PI / 2)
  mur(profondeur, HAUTEUR, LARGEUR / 2, (AVANT + ARRIERE) / 2, -Math.PI / 2)

  const plafond = new THREE.Mesh(garder(new THREE.PlaneGeometry(LARGEUR, profondeur)), matBoisFonce)
  plafond.rotation.x = Math.PI / 2
  plafond.position.set(0, HAUTEUR, (AVANT + ARRIERE) / 2)
  groupe.add(plafond)
  const geoPoutre = garder(new THREE.BoxGeometry(LARGEUR, 0.35, 0.4))
  for (let z = AVANT + 2; z < ARRIERE; z += 3) {
    const poutre = new THREE.Mesh(geoPoutre, matBoisFonce)
    poutre.position.set(0, HAUTEUR - 0.25, z)
    groupe.add(poutre)
  }

  // Vitraux sur les murs latéraux, et une rosace au fond.
  const geoVitrail = garder(new THREE.PlaneGeometry(1.5, 3))
  const vitraux = []
  for (const cote of [-1, 1])
    for (const z of [-6.5, -1.5, 3.5, 8.5]) {
      const v = new THREE.Mesh(geoVitrail, garder(new THREE.MeshBasicMaterial({ map: textureVitrail(garder, alea), transparent: true })))
      v.position.set(cote * (LARGEUR / 2 - 0.02), 4.6, z)
      v.rotation.y = -cote * (Math.PI / 2)
      groupe.add(v)
      vitraux.push(v)
    }
  const rosace = new THREE.Mesh(
    garder(new THREE.CircleGeometry(1.4, 48)),
    garder(
      new THREE.MeshBasicMaterial({
        map: garder(
          textureCanvas(512, 512, (ctx) => {
            const couleurs = ['#2f78c4', '#c4362f', '#e2a42b', '#3c8f4a', '#7b3fa0', '#1f4fa3']
            for (let i = 0; i < 12; i++) {
              ctx.beginPath()
              ctx.moveTo(256, 256)
              ctx.arc(256, 256, 250, (i / 12) * Math.PI * 2, ((i + 1) / 12) * Math.PI * 2)
              ctx.closePath()
              ctx.fillStyle = couleurs[i % couleurs.length]
              ctx.fill()
              ctx.lineWidth = 8
              ctx.strokeStyle = '#1a1612'
              ctx.stroke()
            }
            ctx.beginPath()
            ctx.arc(256, 256, 70, 0, Math.PI * 2)
            ctx.fillStyle = '#f6e7b4'
            ctx.fill()
            ctx.stroke()
          }),
        ),
      }),
    ),
  )
  rosace.position.set(0, 6.2, ARRIERE - 0.02)
  rosace.rotation.y = Math.PI
  groupe.add(rosace)

  // Rayons de soleil entrant par les vitraux de gauche, et poussière dorée.
  const matRayon = garder(materiauRayon(new THREE.Color(1, 0.88, 0.62), 0.22))
  const geoRayon = garder(new THREE.PlaneGeometry(1.4, 9))
  for (const z of [-6.5, -1.5, 3.5, 8.5]) {
    for (const decal of [0, 0.35]) {
      const r = new THREE.Mesh(geoRayon, matRayon)
      r.position.set(-LARGEUR / 2 + 3.2, 2.6, z + decal)
      r.rotation.set(0, Math.PI / 2 + decal, 0.62)
      groupe.add(r)
    }
  }
  const nbPoussiere = 260
  const pos = new Float32Array(nbPoussiere * 3)
  for (let i = 0; i < nbPoussiere; i++) pos.set([-6 + alea() * 7, alea() * 6, -8 + alea() * 18], i * 3)
  const geoPoussiere = garder(new THREE.BufferGeometry())
  geoPoussiere.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  const poussiere = new THREE.Points(
    geoPoussiere,
    garder(
      new THREE.PointsMaterial({
        size: 0.03,
        map: garder(textureLueur()),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        color: 0xffe2a8,
      }),
    ),
  )
  groupe.add(poussiere)

  // Croix de bois au fond, autel, nappe.
  const croix = new THREE.Group()
  const montant = new THREE.Mesh(garder(new THREE.BoxGeometry(0.28, 3.6, 0.18)), matBois)
  const traverse = new THREE.Mesh(garder(new THREE.BoxGeometry(1.9, 0.28, 0.18)), matBois)
  traverse.position.y = 0.75
  croix.add(montant, traverse)
  croix.position.set(0, 5.4, AVANT + 0.15)
  groupe.add(croix)
  const autel = new THREE.Mesh(garder(new THREE.BoxGeometry(2.6, 1, 1)), matBois)
  autel.position.set(0, 0.5, AVANT + 2.6)
  groupe.add(autel)
  const nappe = new THREE.Mesh(garder(new THREE.BoxGeometry(2.7, 0.04, 1.06)), garder(new THREE.MeshStandardMaterial({ color: 0xf4efe4, roughness: 0.9 })))
  nappe.position.set(0, 1.01, AVANT + 2.6)
  groupe.add(nappe)
  const marche = new THREE.Mesh(garder(new THREE.BoxGeometry(LARGEUR, 0.18, 4)), matDalles)
  marche.position.set(0, 0.09, AVANT + 2)
  groupe.add(marche)

  // Bougies : sur l'autel, et deux chandeliers devant.
  const matCire = garder(new THREE.MeshStandardMaterial({ color: 0xf3e9d2, roughness: 0.6, emissive: 0x3a2a10, emissiveIntensity: 0.4 }))
  const matFer = garder(new THREE.MeshStandardMaterial({ color: 0x2b2522, roughness: 0.5, metalness: 0.6 }))
  const texFlamme = garder(textureLueur('255,190,110'))
  const flammes = []
  const bougie = (x, y, z, h = 0.3) => {
    const c = new THREE.Mesh(garder(new THREE.CylinderGeometry(0.035, 0.04, h, 12)), matCire)
    c.position.set(x, y + h / 2, z)
    groupe.add(c)
    const f = new THREE.Sprite(garder(new THREE.SpriteMaterial({ map: texFlamme, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })))
    f.position.set(x, y + h + 0.05, z)
    f.scale.set(0.12, 0.2, 1)
    f.userData.phase = alea() * 10
    groupe.add(f)
    flammes.push(f)
  }
  for (const x of [-0.9, -0.5, 0.5, 0.9]) bougie(x, 1.03, AVANT + 2.4, x === -0.5 || x === 0.5 ? 0.45 : 0.3)
  const lumieres = []
  for (const cote of [-1, 1]) {
    const x = cote * 3.4
    const z = -4.2
    const pied = new THREE.Mesh(garder(new THREE.CylinderGeometry(0.04, 0.12, 1.2, 10)), matFer)
    pied.position.set(x, 0.6, z)
    groupe.add(pied)
    const plateau = new THREE.Mesh(garder(new THREE.CylinderGeometry(0.35, 0.3, 0.05, 20)), matFer)
    plateau.position.set(x, 1.22, z)
    groupe.add(plateau)
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2
      bougie(x + Math.cos(a) * 0.22, 1.25, z + Math.sin(a) * 0.22, 0.18 + alea() * 0.2)
    }
    const l = new THREE.PointLight(0xffa860, 6, 9, 1.6)
    l.position.set(x, 1.8, z)
    groupe.add(l)
    lumieres.push(l)
  }
  const lumiereAutel = new THREE.PointLight(0xffb070, 5, 8, 1.6)
  lumiereAutel.position.set(0, 1.9, AVANT + 2.2)
  groupe.add(lumiereAutel)
  lumieres.push(lumiereAutel)

  // Bancs, de part et d'autre de l'allée centrale, derrière soi.
  const geoAssise = garder(new THREE.BoxGeometry(4.4, 0.07, 0.45))
  const geoDossier = garder(new THREE.BoxGeometry(4.4, 0.55, 0.06))
  const geoPied = garder(new THREE.BoxGeometry(0.07, 0.45, 0.45))
  for (let z = 2.4; z < ARRIERE - 1.5; z += 1.5)
    for (const cote of [-1, 1]) {
      const banc = new THREE.Group()
      const assise = new THREE.Mesh(geoAssise, matBois)
      assise.position.y = 0.45
      const dossier = new THREE.Mesh(geoDossier, matBois)
      dossier.position.set(0, 0.78, 0.22)
      banc.add(assise, dossier)
      for (const px of [-2.1, 2.1]) {
        const p = new THREE.Mesh(geoPied, matBois)
        p.position.set(px, 0.22, 0)
        banc.add(p)
      }
      banc.position.set(cote * 3.6, 0, z)
      groupe.add(banc)
    }

  // Éclairage : jour doux par les vitraux, chaleur des bougies.
  const hemi = new THREE.HemisphereLight(0xffe9cc, 0x3b2a1e, 1.1)
  groupe.add(hemi)
  const soleil = new THREE.DirectionalLight(0xffd9a0, 1.4)
  soleil.position.set(-8, 7, 2)
  groupe.add(soleil)
  const projecteurCroix = new THREE.SpotLight(0xfff0d6, 30, 14, 0.5, 0.6, 1.5)
  projecteurCroix.position.set(0, 8.5, -5)
  projecteurCroix.target = croix
  groupe.add(projecteurCroix)

  return {
    groupe,
    fond: new THREE.Color(0x1c140f),
    logo: false,
    hauteurMax: HAUTEUR - 0.6,
    maj(dt, t, calme) {
      // Bougies qui vacillent ; plus présentes pendant le temps de prière.
      for (const f of flammes) {
        const v = 0.85 + Math.sin(t * 9 + f.userData.phase) * 0.08 + Math.sin(t * 23 + f.userData.phase * 3) * 0.05
        f.scale.set(0.12 * v, 0.2 * v, 1)
      }
      const vacille = 0.9 + Math.sin(t * 7.3) * 0.06 + Math.sin(t * 17.1) * 0.04
      for (const l of lumieres) l.intensity = (5 + calme * 4) * vacille
      hemi.intensity = 1.1 - calme * 0.65
      soleil.intensity = 1.4 - calme * 1
      matRayon.uniforms.uOpacite.value = (0.2 + Math.sin(t * 0.4) * 0.04) * (1 - calme * 0.7)
      const p = geoPoussiere.attributes.position
      for (let i = 0; i < nbPoussiere; i++) {
        let y = p.getY(i) + dt * 0.03
        if (y > 6) y = 0
        p.setY(i, y)
      }
      p.needsUpdate = true
    },
    liberer,
  }
}
