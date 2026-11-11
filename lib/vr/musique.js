// Fonds musicaux « soaking » de la salle de prière VR, joués en direct par le
// navigateur (Web Audio) : aucun fichier, aucun droit d'auteur. Chaque
// ambiance enchaîne lentement quelques accords tenus (nappes filtrées,
// légèrement désaccordées), sur une basse grave, avec de rares notes
// cristallines prises dans la gamme, le tout dans une grande réverbération.
//
// Un AudioContext ne démarre qu'après un geste de l'utilisateur : `jouer()`
// doit donc être appelé depuis un clic (ou après un premier clic).

const C = 261.63
const note = (demiTons) => C * Math.pow(2, demiTons / 12)

/** Accords en demi-tons depuis le do central ; `gamme` pour les notes cristallines. */
export const AMBIANCES = [
  {
    id: 'repos',
    nom: 'Repos',
    description: 'Ré majeur, très lent',
    accords: [
      [-10, -3, 2, 6, 9], // Ré
      [-5, -1, 2, 7, 11], // Sol maj7
      [-13, -6, 1, 4, 9], // Si mineur 7
      [-8, -1, 4, 7, 11], // Mi mineur 9
    ],
    gamme: [14, 16, 18, 21, 23, 26, 28, 30],
    duree: 14,
    clarte: 900,
    gain: 1,
  },
  {
    id: 'attente',
    nom: 'Attente',
    description: 'La mineur, profond',
    accords: [
      [-15, -3, 0, 4, 11], // La m9
      [-19, -7, 0, 4, 7], // Fa maj7
      [-24, -5, 2, 7, 11], // Do add9
      [-17, -5, 2, 5, 9], // Sol sus
    ],
    gamme: [12, 14, 16, 19, 21, 24, 26, 28],
    duree: 16,
    clarte: 700,
    gain: 0.8,
  },
  {
    id: 'lumiere',
    nom: 'Lumière',
    description: 'Mi majeur, aérien',
    accords: [
      [-8, 4, 8, 11, 15], // Mi add9
      [-15, 4, 9, 13, 16], // La maj9
      [-11, 3, 6, 11, 15], // Do# m7
      [-6, 1, 6, 10, 13], // Si sus
    ],
    gamme: [16, 18, 20, 23, 25, 28, 30, 32],
    duree: 12,
    clarte: 1300,
    gain: 1,
  },
  {
    id: 'nuit',
    nom: 'Nuit',
    description: 'Bourdon grave et étoiles',
    accords: [
      [-22, -10, -3, 2, 5], // Ré m
      [-22, -10, -5, 2, 7], // Ré sus
      [-22, -14, -7, 0, 5], // Sib / Ré
      [-22, -10, -3, 4, 9], // Ré m6
    ],
    gamme: [9, 14, 17, 21, 26, 29],
    duree: 18,
    clarte: 550,
    gain: 1.1,
  },
]

export const IDS_AMBIANCES = AMBIANCES.map((a) => a.id)

/** Réponse impulsionnelle d'une grande salle : bruit qui décroît (stéréo). */
function reverberation(ctx, secondes = 6) {
  const n = Math.floor(ctx.sampleRate * secondes)
  const tampon = ctx.createBuffer(2, n, ctx.sampleRate)
  for (let c = 0; c < 2; c++) {
    const d = tampon.getChannelData(c)
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.2)
  }
  const conv = ctx.createConvolver()
  conv.buffer = tampon
  return conv
}

export function creerMusique() {
  let ctx = null
  let maitre = null
  let bus = null
  let ambiance = null
  let minuterie = null
  let etincelles = null
  let nappes = []
  let volumeCible = 1
  let attenuation = 1

  function initialiser() {
    if (ctx) return
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    ctx = new AC()
    maitre = ctx.createGain()
    maitre.gain.value = 0
    const compresseur = ctx.createDynamicsCompressor()
    compresseur.threshold.value = -18
    compresseur.ratio.value = 3
    maitre.connect(compresseur).connect(ctx.destination)
    // Signal direct + grande réverbération.
    bus = ctx.createGain()
    const rev = reverberation(ctx)
    const humide = ctx.createGain()
    humide.gain.value = 0.85
    const sec = ctx.createGain()
    sec.gain.value = 0.35
    bus.connect(sec).connect(maitre)
    bus.connect(rev).connect(humide).connect(maitre)
  }

  function appliquerVolume(duree = 2.5) {
    if (!ctx) return
    const t = ctx.currentTime
    const v = ambiance ? 0.95 * ambiance.gain * volumeCible * attenuation : 0
    maitre.gain.cancelScheduledValues(t)
    maitre.gain.setValueAtTime(maitre.gain.value, t)
    maitre.gain.linearRampToValueAtTime(v, t + duree)
  }

  /** Une nappe : trois oscillateurs désaccordés, filtre passe-bas qui respire. */
  function nappe(freq, volume, attaque, tenue, clarte) {
    const t = ctx.currentTime
    const sortie = ctx.createGain()
    sortie.gain.setValueAtTime(0, t)
    sortie.gain.linearRampToValueAtTime(volume, t + attaque)
    sortie.gain.setValueAtTime(volume, t + tenue)
    sortie.gain.linearRampToValueAtTime(0, t + tenue + attaque)
    const filtre = ctx.createBiquadFilter()
    filtre.type = 'lowpass'
    filtre.frequency.value = clarte
    filtre.Q.value = 0.4
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.05 + Math.random() * 0.06
    const amplitude = ctx.createGain()
    amplitude.gain.value = clarte * 0.35
    lfo.connect(amplitude).connect(filtre.frequency)
    const panoramique = ctx.createStereoPanner ? ctx.createStereoPanner() : null
    if (panoramique) panoramique.pan.value = Math.random() * 1.2 - 0.6
    filtre.connect(sortie)
    ;(panoramique ? sortie.connect(panoramique) : sortie).connect(bus)
    const oscs = [
      ['sawtooth', -7],
      ['sawtooth', 6],
      ['triangle', 0],
    ].map(([type, cents]) => {
      const o = ctx.createOscillator()
      o.type = type
      o.frequency.value = freq
      o.detune.value = cents
      const g = ctx.createGain()
      g.gain.value = type === 'triangle' ? 0.6 : 0.22
      o.connect(g).connect(filtre)
      return o
    })
    const fin = t + tenue + attaque + 0.2
    for (const o of [...oscs, lfo]) {
      o.start(t)
      o.stop(fin)
    }
    const n = { fin, oscs: [...oscs, lfo], sortie }
    nappes.push(n)
    oscs[0].onended = () => {
      nappes = nappes.filter((x) => x !== n)
      sortie.disconnect()
    }
  }

  /** Note cristalline : sinus doux, attaque courte, longue extinction. */
  function etincelle(freq) {
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.value = freq
    const o2 = ctx.createOscillator()
    o2.type = 'sine'
    o2.frequency.value = freq * 2.01
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.05, t + 0.04)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 4.5)
    const g2 = ctx.createGain()
    g2.gain.value = 0.25
    o.connect(g)
    o2.connect(g2).connect(g)
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null
    if (pan) pan.pan.value = Math.random() * 1.6 - 0.8
    ;(pan ? g.connect(pan) : g).connect(bus)
    o.start(t)
    o2.start(t)
    o.stop(t + 4.6)
    o2.stop(t + 4.6)
  }

  function enchainer(a, i) {
    if (ambiance !== a) return
    const accord = a.accords[i % a.accords.length]
    const attaque = a.duree * 0.45
    accord.forEach((d, j) => nappe(note(d), j === 0 ? 0.2 : 0.11, attaque, a.duree, j === 0 ? a.clarte * 0.6 : a.clarte))
    minuterie = setTimeout(() => enchainer(a, i + 1), a.duree * 1000)
  }

  function programmerEtincelles(a) {
    clearTimeout(etincelles)
    if (ambiance !== a) return
    etincelles = setTimeout(
      () => {
        if (ambiance !== a) return
        etincelle(note(a.gamme[Math.floor(Math.random() * a.gamme.length)]))
        programmerEtincelles(a)
      },
      2500 + Math.random() * 6000,
    )
  }

  function couperNappes() {
    if (!ctx) return
    const t = ctx.currentTime
    for (const n of nappes) {
      n.sortie.gain.cancelScheduledValues(t)
      n.sortie.gain.setValueAtTime(n.sortie.gain.value, t)
      n.sortie.gain.linearRampToValueAtTime(0, t + 3)
      for (const o of n.oscs) o.stop(t + 3.2)
    }
  }

  return {
    ambiances: AMBIANCES,
    /** Lance une ambiance (id) ; null ou inconnue = silence. */
    jouer(id) {
      const a = AMBIANCES.find((x) => x.id === id) || null
      if (a === ambiance) return
      clearTimeout(minuterie)
      clearTimeout(etincelles)
      if (!a) {
        ambiance = null
        appliquerVolume(2)
        setTimeout(couperNappes, 2000)
        return
      }
      initialiser()
      if (!ctx) return
      ctx.resume?.()
      couperNappes()
      ambiance = a
      appliquerVolume(4)
      enchainer(a, 0)
      programmerEtincelles(a)
    },
    /** Baisse (0 à 1) pendant une lecture ou une prédication. */
    attenuer(facteur) {
      attenuation = facteur
      appliquerVolume(1.5)
    },
    volume(v) {
      volumeCible = v
      appliquerVolume(0.5)
    },
    actuelle: () => ambiance?.id || null,
    detruire() {
      clearTimeout(minuterie)
      clearTimeout(etincelles)
      ambiance = null
      ctx?.close?.()
      ctx = null
    },
  }
}
