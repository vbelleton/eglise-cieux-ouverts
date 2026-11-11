// Outils communs aux lieux de prière (lib/vr/lieux/*.js) : bruit
// reproductible, textures dessinées au canvas, rayons de lumière, lueurs.
// Aucun fichier à télécharger : tout est généré à l'ouverture.
import * as THREE from 'three'

/** Rassemble ce qu'un lieu crée, pour tout libérer quand on en change. */
export function collecteur() {
  const objets = []
  const garder = (o) => (objets.push(o), o)
  const liberer = () => {
    for (const o of objets) o.dispose?.()
    objets.length = 0
  }
  return { garder, liberer }
}

// --- Bruit de valeur 2D, reproductible ---------------------------------------

export function bruit2D(graine = 1) {
  const h = (x, y) => {
    let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(graine, 1442695041)
    n = Math.imul(n ^ (n >>> 13), 1274126177)
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296
  }
  const lisse = (t) => t * t * (3 - 2 * t)
  const valeur = (x, y) => {
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    const fx = lisse(x - xi)
    const fy = lisse(y - yi)
    const a = h(xi, yi)
    const b = h(xi + 1, yi)
    const c = h(xi, yi + 1)
    const d = h(xi + 1, yi + 1)
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy
  }
  /** Bruit fractal entre 0 et 1. */
  return (x, y, octaves = 4) => {
    let somme = 0
    let amp = 0.5
    let f = 1
    let total = 0
    for (let i = 0; i < octaves; i++) {
      somme += valeur(x * f, y * f) * amp
      total += amp
      amp *= 0.5
      f *= 2
    }
    return somme / total
  }
}

// --- Textures ------------------------------------------------------------------

export function textureCanvas(l, h, dessin, { repeter = null, srgb = true } = {}) {
  const canvas = document.createElement('canvas')
  canvas.width = l
  canvas.height = h
  dessin(canvas.getContext('2d'), l, h)
  const t = new THREE.CanvasTexture(canvas)
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  if (repeter) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(repeter[0], repeter[1])
  }
  return t
}

/** Remplit le canvas pixel par pixel : f(x, y) -> [r, g, b] (0-255). */
export function pixels(ctx, l, h, f) {
  const img = ctx.createImageData(l, h)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < l; x++) {
      const [r, g, b] = f(x, y)
      const i = (y * l + x) * 4
      img.data[i] = r
      img.data[i + 1] = g
      img.data[i + 2] = b
      img.data[i + 3] = 255
    }
  ctx.putImageData(img, 0, 0)
}

export function textureLueur(couleur = '255,236,190') {
  return textureCanvas(64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
    g.addColorStop(0, `rgba(${couleur},1)`)
    g.addColorStop(0.3, `rgba(${couleur},0.5)`)
    g.addColorStop(1, `rgba(${couleur},0)`)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 64, 64)
  })
}

/** Matériau de rayon de lumière : dégradé le long de la hauteur, additif. */
export function materiauRayon(couleur = new THREE.Color(1, 0.95, 0.82), opacite = 0.16) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { uOpacite: { value: opacite }, uCouleur: { value: couleur } },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uOpacite;
      uniform vec3 uCouleur;
      void main() {
        float a = smoothstep(0.0, 0.35, vUv.y) * (1.0 - smoothstep(0.85, 1.0, vUv.y));
        a *= sin(vUv.x * 3.14159);
        gl_FragColor = vec4(uCouleur, a * uOpacite);
      }`,
  })
}

/**
 * Ciel en dégradé (sphère vue de l'intérieur) : horizon -> zénith, soleil
 * et halo. `uCalme` (0-1) fait glisser vers les couleurs de `nuit`.
 */
export function materiauCiel({ horizon, milieu, zenith, soleil, directionSoleil, nuit = null, etoiles = false }) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uHorizon: { value: new THREE.Color(...horizon) },
      uMilieu: { value: new THREE.Color(...milieu) },
      uZenith: { value: new THREE.Color(...zenith) },
      uSoleil: { value: new THREE.Color(...soleil) },
      uDir: { value: directionSoleil.clone().normalize() },
      uNuitH: { value: new THREE.Color(...(nuit?.horizon || horizon)) },
      uNuitZ: { value: new THREE.Color(...(nuit?.zenith || zenith)) },
      uCalme: { value: 0 },
      uEtoiles: { value: etoiles ? 1 : 0 },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      varying vec3 vDir;
      uniform vec3 uHorizon, uMilieu, uZenith, uSoleil, uDir, uNuitH, uNuitZ;
      uniform float uCalme, uEtoiles;
      float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      void main() {
        float y = max(vDir.y, -0.2);
        vec3 c = mix(uHorizon, uMilieu, smoothstep(0.0, 0.18, y));
        c = mix(c, uZenith, smoothstep(0.15, 0.75, y));
        vec3 nuit = mix(uNuitH, uNuitZ, smoothstep(0.0, 0.6, y));
        c = mix(c, nuit, uCalme * 0.75);
        float d = max(dot(vDir, uDir), 0.0);
        c += uSoleil * (pow(d, 900.0) * 3.0 + pow(d, 24.0) * 0.45 + pow(d, 4.0) * 0.12) * (1.0 - uCalme * 0.6);
        if (uEtoiles > 0.5 && y > 0.05) {
          vec3 g = floor(vDir * 260.0);
          float e = step(0.9965, hash(g));
          c += vec3(e) * uCalme * smoothstep(0.05, 0.3, y);
        }
        gl_FragColor = vec4(c, 1.0);
      }`,
  })
}

/** Ajoute à `groupe` une sphère de ciel ; renvoie son matériau. */
export function ajouterCiel(groupe, garder, options) {
  const mat = garder(materiauCiel(options))
  const ciel = new THREE.Mesh(garder(new THREE.SphereGeometry(480, 48, 24)), mat)
  ciel.frustumCulled = false
  ciel.renderOrder = -1
  groupe.add(ciel)
  return mat
}

/** Rocher arrondi : icosaèdre déformé par du bruit, couleurs par sommet. */
export function geometrieRocher(alea, { detail = 2, aplatir = 1, couleurs, plafond = Infinity }) {
  const geo = new THREE.IcosahedronGeometry(1, detail)
  const pos = geo.attributes.position
  const b = bruit2D(Math.floor(alea() * 1e6))
  const coul = []
  const v = new THREE.Vector3()
  const c = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const n = b(v.x * 1.7 + 3, v.z * 1.7 + v.y * 1.3 + 7, 3)
    v.multiplyScalar(0.75 + n * 0.5)
    v.y = Math.min(v.y * aplatir, plafond)
    pos.setXYZ(i, v.x, v.y, v.z)
    const t = b(v.x * 6, v.z * 6 + v.y * 4, 2)
    c.copy(couleurs[0]).lerp(couleurs[1], t)
    if (couleurs[2] && t > 0.72) c.lerp(couleurs[2], (t - 0.72) * 2.5)
    coul.push(c.r, c.g, c.b)
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(coul, 3))
  geo.computeVertexNormals()
  return geo
}
