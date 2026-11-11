// Lieu « La chambre » : une grande chambre sous les toits, parquet, murs
// clairs, deux fenêtres devant soi, un lit dans le dos, une bibliothèque,
// un fauteuil et des guirlandes. Le temps de prière éteint le jour : il reste
// la lampe de chevet et les petites lumières.
//
// Repère : on se tient à z = 0, face aux fenêtres (z négatif). La pièce va de
// x = -7 à 7 et de z = -7 à 7, sous 3,4 m de plafond (la spirale de photos,
// rayon 6,5, passe juste devant les murs comme des cadres).
import * as THREE from 'three'
import { collecteur, bruit2D, textureCanvas, pixels, textureLueur } from './outils.js'

const L = 7 // demi-côté de la pièce
const H = 3.4

function textureParquet(garder, alea) {
  const b = bruit2D(Math.floor(alea() * 1e6))
  return garder(
    textureCanvas(
      512,
      512,
      (ctx, l, h) => {
        const lames = 6
        const teintes = Array.from({ length: lames * 4 }, () => 0.85 + alea() * 0.25)
        pixels(ctx, l, h, (x, y) => {
          const i = Math.floor((x / l) * lames)
          const seg = Math.floor(((y / h) * 4 + (i % 2) * 0.5) % 4)
          const fx = ((x / l) * lames) % 1
          if (fx < 0.02) return [92, 66, 44]
          const t = teintes[i * 4 + seg] * (0.85 + b(x / 6, y / 80, 3) * 0.3)
          return [Math.min(255, 196 * t), Math.min(255, 148 * t), Math.min(255, 100 * t)]
        })
      },
      { repeter: [L / 1.5, L / 1.5] },
    ),
  )
}

function textureTapis(garder) {
  return garder(
    textureCanvas(256, 256, (ctx, l, h) => {
      ctx.fillStyle = '#d9c3a0'
      ctx.fillRect(0, 0, l, h)
      const bandes = ['#b4572f', '#e9d9b8', '#3f6a78', '#e9d9b8', '#b4572f']
      bandes.forEach((c, i) => {
        ctx.strokeStyle = c
        ctx.lineWidth = i === 2 ? 18 : 10
        ctx.beginPath()
        ctx.arc(l / 2, h / 2, 118 - i * 22, 0, Math.PI * 2)
        ctx.stroke()
      })
    }),
  )
}

/** Fenêtre : ciel du jour dégradé, croisillons. */
function textureFenetre(garder) {
  return garder(
    textureCanvas(256, 384, (ctx, l, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h)
      g.addColorStop(0, '#9cc4ea')
      g.addColorStop(0.7, '#e8f1f7')
      g.addColorStop(1, '#fff3d6')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, l, h)
      // Nuages et collines lointaines.
      ctx.fillStyle = 'rgba(255,255,255,0.8)'
      for (const [x, y, r] of [[70, 90, 30], [105, 82, 36], [140, 95, 28], [190, 150, 24]]) {
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.fillStyle = '#8fae86'
      ctx.beginPath()
      ctx.moveTo(0, h)
      ctx.lineTo(0, 300)
      ctx.quadraticCurveTo(90, 250, 170, 300)
      ctx.quadraticCurveTo(220, 270, l, 292)
      ctx.lineTo(l, h)
      ctx.fill()
    }),
  )
}

export function construire({ alea }) {
  const { garder, liberer } = collecteur()
  const groupe = new THREE.Group()

  const boite = (l, h, p, materiau, x, y, z) => {
    const m = new THREE.Mesh(garder(new THREE.BoxGeometry(l, h, p)), materiau)
    m.position.set(x, y, z)
    groupe.add(m)
    return m
  }
  const mat = (couleur, rugosite = 0.9) => garder(new THREE.MeshStandardMaterial({ color: couleur, roughness: rugosite }))

  const platre = mat(0xefe3d0)
  const boisFonce = mat(0x6e4a2e, 0.7)
  const boisClair = mat(0xb98a5c, 0.75)

  // Sol, murs, plafond.
  const sol = new THREE.Mesh(
    garder(new THREE.PlaneGeometry(L * 2, L * 2)),
    garder(new THREE.MeshStandardMaterial({ map: textureParquet(garder, alea), roughness: 0.65 })),
  )
  sol.rotation.x = -Math.PI / 2
  groupe.add(sol)
  const murs = [
    [L * 2, 0, -L, 0],
    [L * 2, 0, L, Math.PI],
    [L * 2, -L, 0, Math.PI / 2],
    [L * 2, L, 0, -Math.PI / 2],
  ]
  for (const [l, x, z, ry] of murs) {
    const m = new THREE.Mesh(garder(new THREE.PlaneGeometry(l, H)), platre)
    m.position.set(x, H / 2, z)
    m.rotation.y = ry
    groupe.add(m)
  }
  const plafond = new THREE.Mesh(garder(new THREE.PlaneGeometry(L * 2, L * 2)), mat(0xf6efe3))
  plafond.rotation.x = Math.PI / 2
  plafond.position.y = H
  groupe.add(plafond)
  // Poutres apparentes et plinthes.
  for (let z = -5; z <= 5; z += 2.5) boite(L * 2, 0.18, 0.22, boisFonce, 0, H - 0.09, z)
  boite(L * 2, 0.14, 0.04, boisClair, 0, 0.07, -L + 0.02)
  boite(L * 2, 0.14, 0.04, boisClair, 0, 0.07, L - 0.02)
  boite(0.04, 0.14, L * 2, boisClair, -L + 0.02, 0.07, 0)
  boite(0.04, 0.14, L * 2, boisClair, L - 0.02, 0.07, 0)

  // Deux fenêtres devant soi : ciel peint, cadre, croisillons, rideaux.
  const texFenetre = textureFenetre(garder)
  const fenetres = []
  for (const x of [-3.2, 3.2]) {
    const verre = new THREE.Mesh(garder(new THREE.PlaneGeometry(1.7, 2.3)), garder(new THREE.MeshBasicMaterial({ map: texFenetre })))
    verre.position.set(x, 1.95, -L + 0.03)
    groupe.add(verre)
    fenetres.push(verre)
    boite(1.9, 0.1, 0.1, boisClair, x, 3.12, -L + 0.06)
    boite(1.9, 0.1, 0.1, boisClair, x, 0.8, -L + 0.06)
    boite(0.1, 2.4, 0.1, boisClair, x - 0.9, 1.96, -L + 0.06)
    boite(0.1, 2.4, 0.1, boisClair, x + 0.9, 1.96, -L + 0.06)
    boite(0.05, 2.3, 0.06, boisClair, x, 1.95, -L + 0.06)
    boite(1.7, 0.05, 0.06, boisClair, x, 1.95, -L + 0.06)
    for (const dx of [-1.05, 1.05]) boite(0.34, 2.7, 0.08, mat(0xe9d6c0, 1), x + dx, 1.8, -L + 0.2)
    boite(1.9, 0.06, 0.22, boisClair, x, 0.76, -L + 0.14) // appui
  }

  // Un lit dans le dos : tête contre le mur du fond.
  const draps = mat(0xf7f2ea, 1)
  const couverture = mat(0x486f8c, 1)
  boite(2.2, 0.35, 2.7, boisFonce, 0, 0.3, L - 1.5)
  boite(2.1, 0.28, 2.6, draps, 0, 0.62, L - 1.5)
  boite(2.14, 0.12, 1.7, couverture, 0, 0.8, L - 1.0)
  boite(2.4, 1.3, 0.12, boisFonce, 0, 0.95, L - 0.1)
  for (const dx of [-0.5, 0.5]) boite(0.8, 0.14, 0.5, draps, dx, 0.82, L - 2.45)
  // Table de chevet et lampe.
  boite(0.6, 0.55, 0.5, boisClair, 1.9, 0.28, L - 0.45)
  const abatjour = new THREE.Mesh(
    garder(new THREE.CylinderGeometry(0.14, 0.22, 0.26, 16, 1, true)),
    garder(new THREE.MeshBasicMaterial({ color: 0xffe2a8, side: THREE.DoubleSide })),
  )
  abatjour.position.set(1.9, 0.82, L - 0.45)
  groupe.add(abatjour)
  boite(0.04, 0.26, 0.04, boisFonce, 1.9, 0.66, L - 0.45)
  const lampe = new THREE.PointLight(0xffc27a, 6, 14, 1.4)
  lampe.position.set(1.9, 1.0, L - 0.6)
  groupe.add(lampe)

  // Bibliothèque sur le mur de gauche.
  boite(0.45, 2.4, 3.6, boisFonce, -L + 0.25, 1.2, -0.5)
  const couleursLivres = [0x9c3d32, 0x2f5d7a, 0xd8b45a, 0x4d7a4a, 0xe8e0d0, 0x7a4a8a]
  for (let r = 0; r < 4; r++) {
    boite(0.5, 0.05, 3.5, boisClair, -L + 0.28, 0.35 + r * 0.6, -0.5)
    let z = -2.1
    while (z < 1.0) {
      const e = 0.08 + alea() * 0.1
      const h = 0.34 + alea() * 0.16
      boite(0.26, h, e, mat(couleursLivres[Math.floor(alea() * 6)]), -L + 0.32, 0.38 + r * 0.6 + h / 2, z)
      z += e + 0.01
    }
  }

  // Un fauteuil et un petit gueridon à droite, un tapis rond au centre.
  boite(0.9, 0.4, 0.9, mat(0x8c5a3a), L - 1.4, 0.3, 1.2)
  boite(0.9, 0.7, 0.18, mat(0x8c5a3a), L - 0.9, 0.7, 1.2).rotation.y = Math.PI / 2
  boite(0.18, 0.3, 0.9, mat(0x8c5a3a), L - 1.4, 0.55, 1.7)
  boite(0.18, 0.3, 0.9, mat(0x8c5a3a), L - 1.4, 0.55, 0.7)
  const gueridon = new THREE.Mesh(garder(new THREE.CylinderGeometry(0.32, 0.32, 0.04, 20)), boisClair)
  gueridon.position.set(L - 1.4, 0.55, 2.5)
  groupe.add(gueridon)
  boite(0.05, 0.55, 0.05, boisFonce, L - 1.4, 0.27, 2.5)
  const tapis = new THREE.Mesh(
    garder(new THREE.CircleGeometry(2.3, 48)),
    garder(new THREE.MeshStandardMaterial({ map: textureTapis(garder), roughness: 1 })),
  )
  tapis.rotation.x = -Math.PI / 2
  tapis.position.y = 0.012
  groupe.add(tapis)
  // Une plante.
  const pot = new THREE.Mesh(garder(new THREE.CylinderGeometry(0.22, 0.17, 0.34, 12)), mat(0xc2693e))
  pot.position.set(-L + 0.7, 0.17, 3.6)
  groupe.add(pot)
  const feuille = garder(new THREE.IcosahedronGeometry(0.5, 1))
  const feuillage = new THREE.Mesh(feuille, mat(0x4d7a3e))
  feuillage.scale.set(1, 1.5, 1)
  feuillage.position.set(-L + 0.7, 1.0, 3.6)
  groupe.add(feuillage)

  // Guirlande de petites lumières le long du mur du fond et des côtés.
  const nbLumieres = 36
  const ampoules = new THREE.InstancedMesh(
    garder(new THREE.SphereGeometry(0.045, 8, 6)),
    garder(new THREE.MeshBasicMaterial({ color: 0xffd89a })),
    nbLumieres,
  )
  const m4 = new THREE.Matrix4()
  for (let i = 0; i < nbLumieres; i++) {
    const t = i / (nbLumieres - 1)
    const x = -L + 0.4 + t * (L * 2 - 0.8)
    m4.setPosition(x, H - 0.55 - Math.sin(t * Math.PI * 6) * 0.14, L - 0.05)
    ampoules.setMatrixAt(i, m4)
  }
  groupe.add(garder(ampoules))
  const halos = new THREE.Points(
    garder(new THREE.BufferGeometry().setFromPoints(Array.from({ length: nbLumieres }, (_, i) => {
      const t = i / (nbLumieres - 1)
      return new THREE.Vector3(-L + 0.4 + t * (L * 2 - 0.8), H - 0.55 - Math.sin(t * Math.PI * 6) * 0.14, L - 0.1)
    }))),
    garder(
      new THREE.PointsMaterial({
        size: 0.45,
        map: garder(textureLueur('255,214,150')),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: 0.4,
      }),
    ),
  )
  groupe.add(halos)

  // Lumière : jour par les fenêtres, qui baisse pendant la prière.
  const hemi = new THREE.HemisphereLight(0xfff4e0, 0x8a6a4a, 1.6)
  const soleil = new THREE.DirectionalLight(0xfff0d0, 2)
  soleil.position.set(2, 4, -10)
  groupe.add(hemi, soleil)
  const lumFenetres = [-3.2, 3.2].map((x) => {
    const l = new THREE.PointLight(0xfff0d8, 8, 12, 1.4)
    l.position.set(x, 2.2, -L + 1.2)
    groupe.add(l)
    return l
  })

  return {
    groupe,
    fond: new THREE.Color(0x2a2018),
    logo: false,
    hauteurMax: H - 0.5,
    maj(dt, t, calme) {
      const jour = 1 - calme * 0.8
      hemi.intensity = 1.6 * jour
      soleil.intensity = 2 * jour
      for (const l of lumFenetres) l.intensity = 8 * jour
      // Le ciel des fenêtres s'assombrit.
      for (const f of fenetres) f.material.color.setScalar(1 - calme * 0.65)
      lampe.intensity = (5 + calme * 3) * (0.97 + Math.sin(t * 1.3) * 0.03)
      halos.material.opacity = 0.3 + calme * 0.5
    },
    liberer,
  }
}
