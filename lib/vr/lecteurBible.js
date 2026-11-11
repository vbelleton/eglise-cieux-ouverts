// Lecture à voix haute de la Bible dans la salle de prière VR : synthèse
// vocale de l'appareil (Web Speech API), verset par verset, pour pouvoir
// surligner le verset lu. La qualité dépend de l'appareil : voix naturelles
// sur iPhone/Mac et Android récents, plus synthétiques ailleurs.
//
// Tous les versets sont mis en file d'attente d'un coup, dans le geste de
// l'utilisateur (clic sur « Lire ») : Safari iOS refuse de parler hors d'un
// geste, ce qui interdirait d'enchaîner verset par verset depuis `onend`.

/** Note une voix française : les voix « naturelles » d'abord. */
function noteVoix(v) {
  const nom = `${v.name} ${v.voiceURI}`.toLowerCase()
  let n = 0
  if (/^fr[-_]fr/i.test(v.lang)) n += 20
  else if (/^fr/i.test(v.lang)) n += 10
  if (/premium|enhanced|améliorée|natural|neural|online/.test(nom)) n += 30
  if (/google/.test(nom)) n += 12
  if (/audrey|amélie|amelie|thomas|denise|henri|vivienne|remy|rémy|eloise|marie/.test(nom)) n += 6
  if (/compact|eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley|jacques/.test(nom)) n -= 15
  if (v.localService) n += 2
  return n
}

export function choisirVoix(voix) {
  return (
    voix
      .filter((v) => /^fr/i.test(v.lang))
      .map((v) => ({ v, n: noteVoix(v) }))
      .sort((a, b) => b.n - a.n)[0]?.v || null
  )
}

export function creerLecteurBible({ surVerset = () => {}, surFin = () => {} } = {}) {
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : null
  let voix = null
  let tour = 0

  const chargerVoix = () => {
    voix = choisirVoix(synth?.getVoices() || [])
  }
  if (synth) {
    chargerVoix()
    synth.addEventListener?.('voiceschanged', chargerVoix)
  }

  function arreter() {
    if (!synth) return
    tour++
    synth.cancel()
  }

  /** Lit les versets [{ n, texte }] dans l'ordre ; surVerset(n) à chaque début. */
  function lire(versets) {
    if (!synth || !versets.length) return false
    arreter()
    const moi = tour
    if (!voix) chargerVoix()
    versets.forEach((v, i) => {
      const u = new SpeechSynthesisUtterance(v.texte)
      u.lang = voix?.lang || 'fr-FR'
      if (voix) u.voice = voix
      u.rate = 0.92
      u.pitch = 1
      u.onstart = () => moi === tour && surVerset(v.n)
      if (i === versets.length - 1) u.onend = () => moi === tour && (tour++, surFin())
      u.onerror = (e) => {
        // « interrupted »/« canceled » : arrêt volontaire.
        if (moi !== tour || e.error === 'interrupted' || e.error === 'canceled') return
        tour++
        synth.cancel()
        surFin()
      }
      synth.speak(u)
    })
    // Chrome met parfois la synthèse en pause d'office (onglet repris) : on relance.
    synth.resume?.()
    return true
  }

  return {
    disponible: Boolean(synth),
    lire,
    arreter,
    detruire() {
      arreter()
      synth?.removeEventListener?.('voiceschanged', chargerVoix)
    },
  }
}
