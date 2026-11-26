// Logique pure des événements (Worker eglise-app) : expansion des récurrences,
// exceptions, date de fin. Sortie de composables/useChurchEvents.js pour être
// testable sans navigateur (tests/unit/church-events.spec.ts) et partagée avec
// l'aperçu des prochaines dates de l'admin (components/admin/EventManager.vue).

/**
 * Jour calendaire LOCAL au format AAAA-MM-JJ.
 *
 * Jamais `date.toISOString().slice(0, 10)` sur une date construite à minuit
 * local : en France (UTC+1/UTC+2), minuit local tombe la veille en UTC, la
 * clé obtenue est donc décalée d'un jour. Les exceptions (`exception_date`,
 * saisies via un `<input type="date">`, donc en jour local) ne
 * correspondaient alors jamais à l'occurrence visée — une occurrence annulée
 * ou déplacée restait affichée à sa date d'origine sur le site public.
 */
// ─── Deux agendas dans la même base ───
// Le Worker eglise-app sert aussi l'agenda du site de l'association Bras
// Ouverts : ses événements portent `source = 'bras-ouverts'` et se gèrent dans
// le même écran d'admin (EventManager.vue, choix « Publier sur »). Tout le
// reste (source vide, ou une source d'import) appartient à Cieux Ouverts.
// Ne jamais afficher un événement Bras Ouverts sur le site de l'église, ni
// l'inverse (sauf s'il est publié sur les deux) : le filtre est dans buildEventList, utilisé par les deux sites.
export const AGENDA_CIEUX_OUVERTS = 'cieux-ouverts'
export const AGENDA_BRAS_OUVERTS = 'bras-ouverts'
// Un événement peut aussi être publié sur les deux sites à la fois (ex. une fête ouverte à tous) :
// il porte alors `source = 'cieux-et-bras-ouverts'` et s'affiche dans les deux agendas.
export const AGENDA_LES_DEUX = 'les-deux'
export const SOURCE_LES_DEUX = 'cieux-et-bras-ouverts'
export function agendaDe(ev) {
  if (ev && ev.source === AGENDA_BRAS_OUVERTS) return AGENDA_BRAS_OUVERTS
  if (ev && ev.source === SOURCE_LES_DEUX) return AGENDA_LES_DEUX
  return AGENDA_CIEUX_OUVERTS
}
// L'événement (déjà passé par agendaDe) doit-il apparaître sur ce site ?
export function visibleSur(agendaEvenement, site) {
  return agendaEvenement === site || agendaEvenement === AGENDA_LES_DEUX
}

export function isoDay(date) {
  const d = date instanceof Date ? date : new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function parseDay(str) {
  return new Date(str + 'T00:00:00')
}

/**
 * Dernier jour où l'événement doit encore apparaître, ou null s'il n'a pas de
 * fin.
 *
 * - Ponctuel : `end_date` (événement sur plusieurs jours), sinon `start_date`.
 * - Récurrent : `end_date` borne la série — aucune occurrence après cette
 *   date. Une `end_date` antérieure ou égale à `start_date` est ignorée : le
 *   formulaire admin la pré-remplit souvent avec le jour même (durée d'une
 *   occurrence, pas fin de série), et la prendre au pied de la lettre ferait
 *   disparaître du site des séries toujours actives après leur 1ʳᵉ date.
 */
export function lastDay(ev) {
  if (!ev.repeat_period) {
    const end = ev.end_date && ev.end_date >= ev.start_date ? ev.end_date : ev.start_date
    return parseDay(end)
  }
  if (ev.end_date && ev.end_date > ev.start_date) return parseDay(ev.end_date)
  return null
}

function isException(ev, dateStr, type) {
  if (!ev.exceptions) return false
  return ev.exceptions.some(ex => ex.exception_date === dateStr && ex.type === type)
}

function getException(ev, dateStr, type) {
  if (!ev.exceptions) return null
  return ev.exceptions.find(ex => ex.exception_date === dateStr && ex.type === type) || null
}

/**
 * Même jour du mois, `k` mois après `start`, ramené au dernier jour du mois
 * quand il n'existe pas. Jamais `setMonth()` en boucle : le 30 janvier + 1 mois
 * donnait le « 30 février », soit le 2 mars, et toute la série glissait au 2.
 */
export function addMonths(start, k) {
  const y = start.getFullYear(), m = start.getMonth() + k
  const dernier = new Date(y, m + 1, 0).getDate()
  return new Date(y, m, Math.min(start.getDate(), dernier))
}

export function getNthWeekdayOfMonth(year, month, weekday, ordinal) {
  if (ordinal === -1) {
    const last = new Date(year, month + 1, 0)
    const diff = (last.getDay() - weekday + 7) % 7
    return new Date(year, month, last.getDate() - diff)
  }
  const first = new Date(year, month, 1)
  const diff = (weekday - first.getDay() + 7) % 7
  const date = 1 + diff + (ordinal - 1) * 7
  if (date > new Date(year, month + 1, 0).getDate()) return null
  return new Date(year, month, date)
}

function weeklyRule(rp, start) {
  if (rp === 'week') return { days: [start.getDay()], interval: 1 }
  if (rp === 'biweek') return { days: [start.getDay()], interval: 2 }
  const days = rp.split(':')[1].split(',').map(Number).sort((a, b) => a - b)
  return { days, interval: rp.startsWith('weekly:') ? 1 : 2 }
}

function isWeekly(rp) {
  return rp === 'week' || rp === 'biweek' || rp.startsWith('weekly:') || rp.startsWith('biweekly:')
}

export function mapEvent(ev, date) {
  const fin = !ev.repeat_period && ev.end_date && ev.end_date > ev.start_date ? parseDay(ev.end_date) : null
  return {
    id: ev.id,
    titre: ev.title,
    date,
    // Événement ponctuel sur plusieurs jours : dernier jour (sinon null).
    dateFin: fin,
    heure: ev.start_time || null,
    fin: ev.end_time || null,
    lieu: ev.location || null,
    // Certaines descriptions en base contiennent des "\n" littéraux (texte
    // backslash+n, pas de vrai retour à la ligne) — normalisé ici une fois
    // pour tous les consommateurs (agenda, etc).
    description: ev.description ? ev.description.replace(/\\n/g, '\n') : null,
    source: ev.source || null,
    image_url: ev.image_url || null,
    images: ev.images ? ev.images : (ev.image_url ? [ev.image_url] : []),
    repeat_period: ev.repeat_period || null,
    // Premier jour de la série : sert à dire « chaque mardi » (libelleRecurrence).
    debutSerie: ev.start_date || null,
    lien: ev.lien || ev.link || null,
    billetterie: ev.billetterie || ev.ticket_url || null,
    emoji: ev.emoji || null,
    // Mise en évidence (Noël, baptême…) : couleur choisie dans l'admin,
    // champ `color` du Worker. null = événement ordinaire.
    couleur: couleurEvenement(ev.color),
  }
}

/**
 * Couleurs proposées dans l'admin pour faire ressortir un événement de
 * l'agenda. La valeur est appliquée en style en ligne : seule une couleur
 * hexadécimale stricte est acceptée, n'importe quelle autre chaîne venue de
 * la base est ignorée.
 */
export const COULEURS_EVENEMENT = [
  { valeur: '', libelle: 'Aucune (événement ordinaire)' },
  { valeur: '#e11d2e', libelle: 'Rouge vif (fête, Noël…)' },
  { valeur: '#0284c7', libelle: 'Bleu eau (baptême…)' },
  { valeur: '#d97706', libelle: 'Or' },
  { valeur: '#7c3aed', libelle: 'Violet' },
  { valeur: '#059669', libelle: 'Vert' },
]

export function couleurEvenement(color) {
  return typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color.trim()) ? color.trim().toLowerCase() : null
}

/**
 * Prochaines occurrences (au plus `maxCount`) d'un événement récurrent à
 * partir de `now`, en s'arrêtant à la fin de série (`lastDay`).
 */
export function expandRecurring(ev, now, maxCount) {
  const rp = ev.repeat_period
  const start = parseDay(ev.start_date)
  const end = lastDay(ev)
  const results = []

  // Multi-rule: '|'-separated, expand each and merge
  if (rp.includes('|')) {
    const allResults = []
    for (const ruleStr of rp.split('|').filter(Boolean)) {
      allResults.push(...expandRecurring({ ...ev, repeat_period: ruleStr }, now, maxCount))
    }
    allResults.sort((a, b) => a.date - b.date)
    const seen = new Set()
    const unique = []
    for (const r of allResults) {
      const key = isoDay(r.date)
      if (!seen.has(key)) { seen.add(key); unique.push(r) }
    }
    return unique.slice(0, maxCount)
  }

  // Renvoie false quand la série est terminée (plus rien à générer).
  function push(date) {
    if (end && date > end) return false
    const dateStr = isoDay(date)
    if (!isException(ev, dateStr, 'cancelled')) {
      const moved = getException(ev, dateStr, 'moved')
      results.push(mapEvent(ev, moved ? parseDay(moved.new_date) : new Date(date)))
    }
    return true
  }

  if (rp === 'month') {
    let k = 0
    while (addMonths(start, k) < now && k < 1200) k++
    let safety = 0
    while (results.length < maxCount && safety++ < 500) {
      if (!push(addMonths(start, k++))) break
    }

  } else if (isWeekly(rp)) {
    const { days, interval } = weeklyRule(rp, start)
    // Lundi de la semaine de start_date
    const dow = start.getDay()
    const curMon = new Date(start)
    curMon.setDate(start.getDate() - (dow === 0 ? 6 : dow - 1))
    let safety = 0, finished = false
    while (!finished && results.length < maxCount && safety++ < 500) {
      for (const day of days) {
        const offset = day === 0 ? 6 : day - 1
        const date = new Date(curMon)
        date.setDate(curMon.getDate() + offset)
        if (date >= now && date >= start && !push(date)) { finished = true; break }
      }
      curMon.setDate(curMon.getDate() + 7 * interval)
    }
    results.sort((a, b) => a.date - b.date)
    results.splice(maxCount)

  } else if (rp.startsWith('monthly_weekday:')) {
    const p = rp.split(':')
    const ordinal = parseInt(p[1]) || 1
    const weekday = parseInt(p[2]) || 0
    // Chercher à partir du mois précédent pour ne pas rater le mois courant
    let year = now.getFullYear(), month = now.getMonth()
    if (month === 0) { month = 11; year-- } else { month-- }
    let safety = 0
    while (results.length < maxCount && safety++ < 200) {
      const occ = getNthWeekdayOfMonth(year, month, weekday, ordinal)
      if (occ && occ >= now && occ >= start && !push(occ)) break
      if (++month > 11) { month = 0; year++ }
    }
  }

  return results
}

/**
 * Occurrences d'un événement récurrent dans la fenêtre [rangeStart, rangeEnd).
 *
 * expandRecurring() ne génère que les prochaines occurrences à venir (ancrées
 * sur `now`, jamais l'historique) — les vues calendrier qui naviguent aussi
 * dans le passé (agenda.vue, futureOnly: false) ont besoin d'une génération
 * bornée à une fenêtre explicite, sans lien avec « maxCount prochaines ».
 */
export function expandPastRecurring(ev, rangeStart, rangeEnd) {
  const rp = ev.repeat_period
  const start = parseDay(ev.start_date)
  const end = lastDay(ev)
  const results = []
  const from = rangeStart < start ? start : rangeStart
  // Fin de série : la fenêtre s'arrête au lendemain du dernier jour.
  const until = end && end < rangeEnd ? new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1) : rangeEnd
  if (from >= until) return results

  if (rp.includes('|')) {
    for (const ruleStr of rp.split('|').filter(Boolean)) {
      results.push(...expandPastRecurring({ ...ev, repeat_period: ruleStr }, from, until))
    }
    return results
  }

  function pushOccurrence(date) {
    const dateStr = isoDay(date)
    if (isException(ev, dateStr, 'cancelled')) return
    const moved = getException(ev, dateStr, 'moved')
    results.push(mapEvent(ev, moved ? parseDay(moved.new_date) : new Date(date)))
  }

  if (rp === 'month') {
    let k = 0
    while (addMonths(start, k) < from && k < 1200) k++
    let safety = 0
    for (let d = addMonths(start, k); d < until && safety++ < 500; d = addMonths(start, ++k)) {
      pushOccurrence(d)
    }

  } else if (isWeekly(rp)) {
    const { days, interval } = weeklyRule(rp, start)
    const dow = start.getDay()
    const curMon = new Date(start)
    curMon.setDate(start.getDate() - (dow === 0 ? 6 : dow - 1))
    let safety = 0
    // Borne de sécurité élevée : une série hebdomadaire commencée il y a
    // longtemps doit pouvoir avancer jusqu'à la fenêtre demandée.
    while (curMon < until && safety++ < 5000) {
      for (const day of days) {
        const offset = day === 0 ? 6 : day - 1
        const date = new Date(curMon)
        date.setDate(curMon.getDate() + offset)
        if (date >= from && date < until && date >= start) pushOccurrence(date)
      }
      curMon.setDate(curMon.getDate() + 7 * interval)
    }
    results.sort((a, b) => a.date - b.date)

  } else if (rp.startsWith('monthly_weekday:')) {
    const p = rp.split(':')
    const ordinal = parseInt(p[1]) || 1
    const weekday = parseInt(p[2]) || 0
    let year = from.getFullYear(), month = from.getMonth()
    let safety = 0
    while (safety++ < 200) {
      const occ = getNthWeekdayOfMonth(year, month, weekday, ordinal)
      if (occ && occ >= from && occ >= start) {
        if (occ >= until) break
        pushOccurrence(occ)
      }
      if (++month > 11) { month = 0; year++ }
      if (year > until.getFullYear() + 1) break
    }
  }

  return results
}

/**
 * Liste publique des événements, triée par date, à partir de la réponse brute
 * du Worker.
 *
 * - `futureOnly` (défaut) : seulement ce qui n'est pas terminé — un événement
 *   dont la date de fin est passée n'apparaît plus.
 * - `futureOnly: false` (agenda.vue) : ajoute l'historique récent (12 mois)
 *   pour la navigation vers les mois passés, sans jamais générer
 *   d'occurrence après la fin d'une série.
 */
export function buildEventList(allEvents, { futureOnly = true, now: nowArg, agenda = AGENDA_CIEUX_OUVERTS } = {}) {
  const now = nowArg ? new Date(nowArg) : new Date()
  now.setHours(0, 0, 0, 0)
  const results = []

  for (const ev of allEvents || []) {
    if (ev.status === 'cancelled') continue
    if (!visibleSur(agendaDe(ev), agenda)) continue

    if (ev.repeat_period) {
      const occurrences = expandRecurring(ev, now, 12)
      results.push(...occurrences)
      // futureOnly: false — ajouter aussi l'historique récent, sinon un
      // événement récurrent (ex: culte du dimanche) n'apparaît jamais en
      // naviguant vers un mois passé.
      if (!futureOnly) {
        const pastLimit = new Date(now)
        pastLimit.setMonth(pastLimit.getMonth() - 12)
        const seenDates = new Set(occurrences.map(o => isoDay(o.date)))
        for (const o of expandPastRecurring(ev, pastLimit, now)) {
          const key = isoDay(o.date)
          if (!seenDates.has(key)) { seenDates.add(key); results.push(o) }
        }
      }
    } else {
      if (futureOnly && lastDay(ev) < now) continue
      results.push(mapEvent(ev, parseDay(ev.start_date)))
    }
  }

  // Même jour : par heure (sans heure en tête) — sinon l'ordre dépendait de
  // celui des événements en base, et un 21:00 passait avant un 19:30.
  results.sort((a, b) => (a.date - b.date) || ((heureMinutes(a.heure) ?? -1) - (heureMinutes(b.heure) ?? -1)))
  return sansDoublons(results)
}

/**
 * Titre réduit à ce qui identifie l'événement : sans emoji, accents, casse,
 * ponctuation ni numéro de session (« #2 », « Session 2 », « n°2 »,
 * « Partie 2 », « 2ème session »). « Chemin de Liberté 🕊️ #1 » et
 * « Chemin de Liberté 🕊️ #3 » donnent la même clé : ce sont les sessions d'un
 * même événement, pas deux événements.
 */
export function cleEvenement(titre) {
  return String(titre || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/(?:#|n°|no\.?\s)\s*\d+/g, ' ')
    .replace(/\b(?:session|seance|partie|module|episode|semaine)\s*\d+\b/g, ' ')
    .replace(/\b\d+\s*(?:e|er|ere|eme|ème)?\s*(?:session|seance|partie|module)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Numéro de session écrit dans le titre (« #2 », « Session 2 »…), sinon null. */
export function numeroSession(titre) {
  const t = String(titre || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const m = t.match(/(?:#|n°|\b(?:session|seance|partie|module|episode)\s*)\s*(\d+)/)
    || t.match(/\b(\d+)\s*(?:e|er|ere|eme)?\s*(?:session|seance|partie|module)\b/)
  return m ? Number(m[1]) : null
}

/** Titre à afficher pour un groupe de sessions : sans le numéro de session. */
export function titreSansSession(titre) {
  const net = String(titre || '')
    .replace(/\s*(?:#|n°)\s*\d+/gi, '')
    .replace(/\s*[-–—:]?\s*\b(?:session|séance|seance|partie|module|épisode|episode)\s*\d+\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
  return net || String(titre || '').trim()
}

/**
 * Retire les vrais doublons : même événement (cleEvenement), même jour, même
 * heure de début. Arrive quand un événement a été saisi deux fois, ou qu'une
 * occurrence déplacée retombe sur une date déjà occupée par la série. On garde
 * l'exemplaire le plus complet (avec image, puis avec description).
 */
export function sansDoublons(liste) {
  const parCle = new Map()
  const sortie = []
  const richesse = (e) => (e.images?.length ? 2 : 0) + (e.description ? 1 : 0)
  for (const evt of liste || []) {
    const cle = `${cleEvenement(evt.titre)}|${isoDay(evt.date)}|${heureMinutes(evt.heure) ?? ''}`
    const deja = parCle.get(cle)
    if (deja === undefined) { parCle.set(cle, sortie.length); sortie.push(evt); continue }
    if (richesse(evt) > richesse(sortie[deja])) sortie[deja] = evt
  }
  return sortie
}

const JOURS_SEMAINE = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
const ORDINAUX = { 1: '1er', 2: '2e', 3: '3e', 4: '4e', 5: '5e', '-1': 'dernier' }

/** « chaque mardi », « un jeudi sur deux », « le dernier dimanche du mois »… ou null. */
export function libelleRecurrence(evt) {
  const rp = evt && evt.repeat_period
  if (!rp) return null
  const regles = rp.split('|').filter(Boolean)
  const debut = evt.debutSerie ? parseDay(evt.debutSerie) : (evt.date ? new Date(evt.date) : null)
  const morceaux = []
  for (const r of regles) {
    if (r === 'week' || r === 'biweek') {
      if (!debut) continue
      const j = JOURS_SEMAINE[debut.getDay()]
      morceaux.push(r === 'week' ? `chaque ${j}` : `un ${j} sur deux`)
    } else if (r.startsWith('weekly:') || r.startsWith('biweekly:')) {
      const jours = r.split(':')[1].split(',').map(Number).filter(n => n >= 0 && n <= 6)
        .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map(n => JOURS_SEMAINE[n])
      if (!jours.length) continue
      const liste = jours.length > 1 ? `${jours.slice(0, -1).join(', ')} et ${jours.at(-1)}` : jours[0]
      morceaux.push(r.startsWith('weekly:') ? `chaque ${liste}` : `un ${liste} sur deux`)
    } else if (r.startsWith('monthly_weekday:')) {
      const [, ord, jour] = r.split(':')
      const o = ORDINAUX[String(parseInt(ord))]
      const j = JOURS_SEMAINE[parseInt(jour)]
      if (o && j) morceaux.push(`le ${o} ${j} du mois`)
    } else if (r === 'month') {
      morceaux.push(debut ? `chaque mois, le ${debut.getDate() === 1 ? '1er' : debut.getDate()}` : 'chaque mois')
    }
  }
  return morceaux.length ? morceaux.join(' · ') : null
}

// Rang d'un libellé dans la semaine (lundi d'abord), d'après le 1er jour cité.
function rangJour(libelle) {
  const i = JOURS_SEMAINE.findIndex(j => libelle.includes(j))
  return i < 0 ? 99 : (i + 6) % 7
}

/**
 * Plusieurs séries d'un même événement : dans l'ordre de la semaine, et
 * « chaque mardi » + « chaque jeudi » → « chaque mardi et jeudi ».
 */
export function fusionnerRecurrences(libelles) {
  const tries = [...libelles].sort((a, b) => rangJour(a) - rangJour(b))
  const simples = tries.filter(l => /^chaque (lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)$/.test(l))
  if (simples.length < 2) return tries
  const jours = simples.map(l => l.slice('chaque '.length))
  const fusion = `chaque ${jours.slice(0, -1).join(', ')} et ${jours.at(-1)}`
  return [fusion, ...tries.filter(l => !simples.includes(l))]
}

/**
 * Vue « Cartes » de l'agenda : une carte par événement, jamais une carte par
 * occurrence ni par fiche en base.
 *
 * - Ce qui est terminé (`estTermine`, heure comprise) n'apparaît pas.
 * - Les fiches qui portent le même événement (même cleEvenement : une série
 *   saisie deux fois pour deux jours de la semaine, ou des sessions #1, #2,
 *   #3 saisies séparément) sont réunies sur une seule carte, datée de la
 *   prochaine occurrence, qui liste toutes ses dates à venir. Deux cartes
 *   « Autel de Louange » côte à côte ressemblaient à un doublon.
 *
 * Renvoie [{ cle, evt, titre, dates: [{ date, heure, session, evt }], recurrences }].
 */
export function regrouperCartes(liste, now = new Date()) {
  const groupes = new Map()
  for (const evt of liste || []) {
    if (estTermine(evt, now)) continue
    const cle = cleEvenement(evt.titre) || `id-${evt.id}`
    let g = groupes.get(cle)
    if (!g) { g = { cle, evt, occurrences: [] }; groupes.set(cle, g) }
    g.occurrences.push(evt)
  }
  const sortie = []
  for (const g of groupes.values()) {
    const occ = sansDoublons(g.occurrences).sort((a, b) => (a.date - b.date) || ((heureMinutes(a.heure) ?? -1) - (heureMinutes(b.heure) ?? -1)))
    const premier = occ[0]
    // Image : celle de la prochaine occurrence, sinon celle d'une autre fiche du groupe.
    const avecImage = premier.images?.length ? premier : occ.find(e => e.images?.length)
    const evt = avecImage && avecImage !== premier ? { ...premier, images: avecImage.images, image_url: avecImage.image_url } : premier
    const plusieursFiches = new Set(occ.map(e => e.id)).size > 1
    const recurrences = fusionnerRecurrences([...new Set(occ.map(libelleRecurrence).filter(Boolean))])
    sortie.push({
      cle: g.cle,
      evt,
      titre: plusieursFiches ? titreSansSession(premier.titre) : premier.titre,
      dates: occ.map(e => ({ date: e.date, heure: e.heure, session: numeroSession(e.titre), evt: e })),
      recurrences,
    })
  }
  return sortie.sort((a, b) => (a.evt.date - b.evt.date) || ((heureMinutes(a.evt.heure) ?? -1) - (heureMinutes(b.evt.heure) ?? -1)))
}

/** Vrai si l'événement (ou l'occurrence) est terminé avant `today`. */
export function isPast(evt, today) {
  return (evt.dateFin || evt.date) < today
}

// Durée supposée d'un événement sans heure de fin.
const DUREE_PAR_DEFAUT_H = 2

function heureMinutes(txt) {
  const m = typeof txt === 'string' && txt.match(/(\d{1,2})\s*[:hH]\s*(\d{2})?/)
  return m ? Number(m[1]) * 60 + Number(m[2] || 0) : null
}

/**
 * Vrai si l'événement (ou l'occurrence) est terminé à l'instant `now`, heure
 * comprise : le jour même, un événement dont l'heure de fin est passée ne doit
 * plus figurer parmi les « prochains ». Sans heure de fin : début + 2 h. Sans
 * aucune heure : fin de journée (comme isPast).
 */
export function estTermine(evt, now = new Date()) {
  const jour = new Date(evt.dateFin || evt.date)
  jour.setHours(0, 0, 0, 0)
  const debut = heureMinutes(evt.heure)
  const fin = heureMinutes(evt.fin)
  let minutes
  if (fin != null) minutes = debut != null && fin <= debut && !evt.dateFin ? fin + 24 * 60 : fin
  else if (debut != null) minutes = debut + DUREE_PAR_DEFAUT_H * 60
  else minutes = 24 * 60
  return new Date(jour.getTime() + minutes * 60000) <= now
}
