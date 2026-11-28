// Diaporama de la page d'accueil (bloc `diaporama`) : quelles diapositives
// montrer aujourd'hui.
//
// Chaque diapositive peut porter une date « fin » (AAAA-MM-JJ, incluse) :
// le lendemain, elle disparaît d'elle-même du site, sans que personne n'ait à
// repasser dans l'admin. Le jour est celui de Morlaix (Europe/Paris), pas
// celui d'UTC ni du serveur : un événement du jeudi reste affiché jusqu'à
// jeudi minuit heure française.

const FORMAT_JOUR = /^\d{4}-\d{2}-\d{2}$/

// Jour calendaire à Paris au format AAAA-MM-JJ. Jamais toISOString() : il
// donne le jour UTC, donc la veille entre minuit et 1 h (2 h l'été).
export function jourParis(date = new Date()) {
  const parties = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const v = (type) => parties.find((p) => p.type === type)?.value
  return `${v('year')}-${v('month')}-${v('day')}`
}

// Une diapositive est périmée si sa date de fin est passée. Sans date (ou
// date illisible), elle reste affichée : mieux vaut une affiche de trop
// qu'une affiche qui disparaît par erreur.
export function estPerimee(slide, aujourdhui) {
  const fin = String(slide?.fin || '').trim()
  if (!FORMAT_JOUR.test(fin)) return false
  return fin < aujourdhui
}

export function slidesAffichees(slides, aujourdhui) {
  return (Array.isArray(slides) ? slides : []).filter(
    (s) => s && String(s.image || '').trim() && !estPerimee(s, aujourdhui),
  )
}

// ─── Alignement sur l'agenda ─────────────────────────────────────────────
//
// Deux mécanismes, qui se complètent :
//
// 1. Synchronisation : les prochains événements de l'agenda qui ont une
//    affiche s'ajoutent d'eux-mêmes au diaporama (`slidesAgenda`), datés de
//    leur séance et retirés le lendemain. Leur image, leur date et leur heure
//    viennent de la fiche 📅 Événements : impossible qu'elles divergent.
//    Les réunions hebdomadaires en sont exclues (elles occuperaient tout le
//    diaporama), comme les événements déjà couverts par une affiche posée à
//    la main.
//
// 2. Alerte : une affiche posée à la main reste une image figée, que le site
//    ne peut pas relire. On la rapproche de l'événement de l'agenda qu'elle
//    annonce (d'après son texte alternatif) et on signale en admin
//    (`verifierSlides`) ce qui ne colle plus : heure, jour, événement qui
//    n'est plus à l'agenda.

const MOTS_VIDES = new Set([
  'les', 'des', 'une', 'pour', 'avec', 'dans', 'sur', 'aux', 'par', 'chez', 'the', 'and',
  'jour', 'jours', 'tous', 'toutes', 'notre', 'nos', 'votre', 'vos', 'son', 'ses',
])

function sansAccents(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

// Mots qui identifient un événement : sans accents, sans petits mots, au
// singulier (« Baptêmes » et « Culte de baptême » partagent « bapteme »).
export function motsCles(texte) {
  const mots = sansAccents(texte)
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((m) => m.length >= 3 && !MOTS_VIDES.has(m) && !/^\d+$/.test(m))
    .map((m) => (m.length > 4 && /[sx]$/.test(m) ? m.slice(0, -1) : m))
  return [...new Set(mots)]
}

// Heures écrites dans un texte (« 19 h 30 », « 19h30 », « 20h », « 20:00 »),
// en minutes depuis minuit.
export function heuresDansTexte(texte) {
  const sortie = []
  const re = /(?:^|[^\d])([01]?\d|2[0-3])\s*(?:h|:)\s*([0-5]\d)?(?![\d])/gi
  let m
  while ((m = re.exec(String(texte || '')))) sortie.push(Number(m[1]) * 60 + Number(m[2] || 0))
  return sortie
}

export function minutesHeure(hhmm) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm || ''))
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

// « 19 h 30 », « 20 h ».
export function heureLisible(minutes) {
  if (minutes == null) return ''
  const h = Math.floor(minutes / 60)
  const mn = minutes % 60
  return mn ? `${h} h ${String(mn).padStart(2, '0')}` : `${h} h`
}

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

// AAAA-MM-JJ → « vendredi 25 décembre ».
export function jourLisible(iso) {
  const m = FORMAT_JOUR.test(iso || '') && iso.split('-').map(Number)
  if (!m) return ''
  const d = new Date(m[0], m[1] - 1, m[2])
  return `${JOURS[d.getDay()]} ${d.getDate() === 1 ? '1er' : d.getDate()} ${MOIS[d.getMonth()]}`
}

// Jour calendaire (AAAA-MM-JJ) d'une occurrence de l'agenda, construite à
// minuit heure locale par utils/churchEvents.js. Jamais toISOString().
export function jourOccurrence(evt) {
  const d = evt?.date instanceof Date ? evt.date : new Date(evt?.date)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Date écrite dans le nom de fichier d'une affiche (« soiree-…-2026-11-27.jpg ») :
// l'affiche annonce ce jour-là, et pas un autre.
export function dateDansNomImage(url) {
  const m = /(\d{4}-\d{2}-\d{2})(?!.*\d{4}-\d{2}-\d{2})/.exec(String(url || '').split(/[?#]/)[0])
  return m ? m[1] : null
}

// Réunion qui revient chaque semaine (ou une semaine sur deux) : jamais
// ajoutée d'office au diaporama.
export function estHebdomadaire(evt) {
  return String(evt?.repeat_period || '')
    .split('|')
    .some((r) => r === 'week' || r === 'biweek' || r.startsWith('weekly:') || r.startsWith('biweekly:'))
}

// Titre sans emoji (« Repas en commun - Agape 🥘 » → « Repas en commun - Agape ») :
// un lecteur d'écran lirait le nom de chaque emoji.
export function titreNet(titre) {
  return String(titre || '')
    .replace(/[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\uFE0F\u200D]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function imageEvenement(evt) {
  return (evt?.images && evt.images[0]) || evt?.image_url || ''
}

/**
 * L'affiche (posée à la main) annonce-t-elle cet événement de l'agenda ?
 * - tous les mots du titre de l'événement figurent dans son texte ;
 * - ou elle s'arrête le jour même d'une séance et partage au moins un mot
 *   avec son titre (« Baptêmes le dimanche 10 janvier » ↔ « Culte de baptême »).
 */
export function slideAnnonce(slide, evt) {
  const motsEvt = motsCles(evt?.titre)
  if (!motsEvt.length) return false
  const motsSlide = new Set(motsCles(slide?.alt))
  if (!motsSlide.size) return false
  if (motsEvt.every((m) => motsSlide.has(m))) return true
  const fin = String(slide?.fin || '').trim()
  return FORMAT_JOUR.test(fin) && fin === jourOccurrence(evt) && motsEvt.some((m) => motsSlide.has(m))
}

// Occurrences de l'agenda qu'annonce l'affiche, par ordre chronologique.
// Quand plusieurs événements conviennent, on garde le plus précis : une
// affiche « Célébration de Noël » annonce « Célébration de Noël 🎄 », pas la
// « Célébration 🙌 » de chaque dimanche.
function occurrencesAnnoncees(slide, evenements) {
  const candidates = (evenements || []).filter((e) => slideAnnonce(slide, e))
  if (!candidates.length) return []
  const motsSlide = new Set(motsCles(slide?.alt))
  const score = (e) => {
    const mots = motsCles(e.titre)
    const communs = mots.filter((m) => motsSlide.has(m)).length
    return (communs === mots.length ? 1000 : 0) + communs
  }
  const meilleur = Math.max(...candidates.map(score))
  return candidates.filter((e) => score(e) === meilleur)
}

/**
 * Affiches à ajouter d'office depuis l'agenda.
 * `evenements` : occurrences à venir (buildEventList), triées.
 * `manuelles` : affiches posées à la main ; une affiche encore affichée qui
 * annonce déjà une séance (même jour, ou sans date de fin) l'empêche d'être
 * ajoutée en double.
 * Renvoie aussi `ecartees` : séances qui auraient dû figurer mais dont
 * l'image de l'agenda porte une autre date (affiche périmée à l'agenda).
 */
export function slidesAgenda(evenements, manuelles, { aujourdhui, jours = 30, max = 6 } = {}) {
  const limite = (() => {
    const [a, m, j] = String(aujourdhui).split('-').map(Number)
    const d = new Date(a, m - 1, j + Math.max(0, Number(jours) || 0))
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })()
  const affichees = slidesAffichees(manuelles, aujourdhui)
  const vues = new Set()
  const ajoutees = []
  const ecartees = []
  for (const evt of evenements || []) {
    const jour = jourOccurrence(evt)
    if (!jour || jour < aujourdhui || jour > limite) continue
    if (estHebdomadaire(evt)) continue
    const image = imageEvenement(evt)
    if (!image) continue
    const cle = motsCles(evt.titre).join(' ') || `id-${evt.id}`
    if (vues.has(cle)) continue
    const couverte = affichees.some((s) => {
      if (!slideAnnonce(s, evt)) return false
      const fin = String(s.fin || '').trim()
      return !FORMAT_JOUR.test(fin) || fin >= jour
    })
    if (couverte) { vues.add(cle); continue }
    const dateImage = dateDansNomImage(image)
    if (dateImage && dateImage !== jour) {
      vues.add(cle)
      ecartees.push({ evt, jour, dateImage })
      continue
    }
    vues.add(cle)
    const heure = heureLisible(minutesHeure(evt.heure))
    ajoutees.push({
      agenda: true,
      image,
      alt: `${titreNet(evt.titre)} : ${jourLisible(jour)}${heure ? `, ${heure}` : ''}.`,
      link: '/agenda',
      fin: jour,
      titre: titreNet(evt.titre),
      date: evt.date,
      heure: evt.heure || '',
      jourLisible: jourLisible(jour),
      heureLisible: heure,
    })
    if (ajoutees.length >= max) break
  }
  return { ajoutees, ecartees }
}

// Fusion : affiches à la main et affiches de l'agenda, par date (celles sans
// date de fin gardent leur place relative, en fin de liste).
export function fusionnerSlides(manuelles, agenda) {
  const cle = (s) => (FORMAT_JOUR.test(String(s?.fin || '')) ? s.fin : '9999-12-31')
  return [...(manuelles || []), ...(agenda || [])]
    .map((s, i) => ({ s, i }))
    .sort((a, b) => (cle(a.s) < cle(b.s) ? -1 : cle(a.s) > cle(b.s) ? 1 : a.i - b.i))
    .map(({ s }) => s)
}

/**
 * Ce qui ne colle plus entre une affiche posée à la main et l'agenda.
 * Renvoie une liste de messages (vide si rien à signaler). Une affiche qui
 * n'annonce aucun événement de l'agenda (librairie, annonce générale) n'est
 * pas vérifiable : rien à dire, sauf si elle n'a pas de date de fin.
 */
export function verifierSlide(slide, evenements, aujourdhui) {
  if (!slide || !String(slide.image || '').trim() || estPerimee(slide, aujourdhui)) return []
  const alertes = []
  const fin = String(slide.fin || '').trim()
  const aFin = FORMAT_JOUR.test(fin)
  const occ = occurrencesAnnoncees(slide, evenements)
  if (!occ.length) {
    if (!aFin) alertes.push("Aucune date de fin et aucun événement de l'agenda ne correspond : cette affiche restera en ligne sans limite.")
    return alertes
  }
  const titre = titreNet(occ[0].titre)
  // Séance visée : celle du jour de fin de l'affiche, sinon la prochaine.
  let cible = occ[0]
  if (aFin) {
    const leJour = occ.find((e) => jourOccurrence(e) === fin)
    if (leJour) cible = leJour
    else if (!occ.some((e) => estHebdomadaire(e))) {
      const suivante = occ.find((e) => jourOccurrence(e) >= aujourdhui)
      alertes.push(
        `L'agenda n'a pas « ${titre} » le ${jourLisible(fin)}` +
          (suivante ? ` : prochaine date le ${jourLisible(jourOccurrence(suivante))}.` : '.'),
      )
      return alertes
    }
  }
  const heureAgenda = minutesHeure(cible.heure)
  const heuresAffiche = heuresDansTexte(slide.alt)
  if (heureAgenda != null && heuresAffiche.length && !heuresAffiche.includes(heureAgenda)) {
    alertes.push(
      `Heure différente : l'affiche dit ${heureLisible(heuresAffiche[0])}, l'agenda dit ${heureLisible(heureAgenda)} (« ${titre} », ${jourLisible(jourOccurrence(cible))}).`,
    )
  }
  return alertes
}
