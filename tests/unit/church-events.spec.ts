import { test, expect } from '@playwright/test'
import { buildEventList, expandRecurring, isoDay, lastDay, isPast, estTermine, agendaDe, cleEvenement, numeroSession, titreSansSession, sansDoublons, regrouperCartes, libelleRecurrence, fusionnerRecurrences } from '../../utils/churchEvents.js'

// Le site est consulté en France : les bugs de jour décalé n'apparaissent
// qu'avec un fuseau en avance sur UTC. Node relit TZ à chaque changement.
let tzAvant: string | undefined
test.beforeAll(() => { tzAvant = process.env.TZ; process.env.TZ = 'Europe/Paris' })
test.afterAll(() => { if (tzAvant === undefined) delete process.env.TZ; else process.env.TZ = tzAvant })

const NOW = '2026-10-11T12:00:00'
const jours = (list: { date: Date }[]) => list.map(e => isoDay(e.date))

function ev(over: Record<string, any>) {
  return { id: 1, title: 'Test', start_date: '2026-01-01', end_date: null, repeat_period: null, status: 'active', exceptions: [], ...over }
}

test.describe('utils/churchEvents — date de fin', () => {
  test('ponctuel terminé : absent de la liste à venir', () => {
    const list = buildEventList([ev({ start_date: '2026-10-01', end_date: '2026-10-01' })], { now: NOW })
    expect(list).toHaveLength(0)
  })

  test('ponctuel sur plusieurs jours en cours : toujours affiché jusqu\'à son dernier jour', () => {
    const list = buildEventList([ev({ start_date: '2026-10-09', end_date: '2026-10-12' })], { now: NOW })
    expect(list).toHaveLength(1)
    expect(isoDay(list[0].dateFin)).toBe('2026-10-12')
    expect(isPast(list[0], new Date('2026-10-12T00:00:00'))).toBe(false)
    expect(isPast(list[0], new Date('2026-10-13T00:00:00'))).toBe(true)
  })

  test('série terminée (fin passée) : plus aucune occurrence à venir', () => {
    // Cas réel : « Groupe de Marche », 3e dimanche, fin de série 18/06/2026.
    const marche = ev({ start_date: '2026-01-16', end_date: '2026-06-18', repeat_period: 'monthly_weekday:3:0' })
    expect(buildEventList([marche], { now: NOW })).toHaveLength(0)
  })

  test('série en cours : s\'arrête à sa date de fin', () => {
    // Cas réel : « École du Disciple », un mercredi sur deux jusqu'au 01/01/2027.
    const ecole = ev({ start_date: '2026-01-07', end_date: '2027-01-01', repeat_period: 'biweekly:3' })
    const dates = jours(buildEventList([ecole], { now: NOW }))
    expect(dates.length).toBeGreaterThan(0)
    expect(dates.every(d => d <= '2027-01-01')).toBe(true)
    expect(dates.at(-1)).toBe('2026-12-23')
  })

  test('agenda (historique) : aucune occurrence après la fin de série, l\'historique reste', () => {
    const marche = ev({ start_date: '2026-01-16', end_date: '2026-06-18', repeat_period: 'monthly_weekday:3:0' })
    const dates = jours(buildEventList([marche], { now: NOW, futureOnly: false }))
    expect(dates).toContain('2026-05-17')
    expect(dates.every(d => d <= '2026-06-18')).toBe(true)
  })

  test('fin de série égale ou antérieure au début : ignorée (série sans fin)', () => {
    // Cas réels : « Autel de Louange » (fin = début) et « Session 2 » (fin < début).
    const louange = ev({ start_date: '2026-01-08', end_date: '2026-01-08', repeat_period: 'week' })
    const session2 = ev({ id: 2, start_date: '2026-01-06', end_date: '2026-01-05', repeat_period: 'week' })
    expect(lastDay(louange)).toBeNull()
    expect(lastDay(session2)).toBeNull()
    const list = buildEventList([louange, session2], { now: NOW })
    expect(list.length).toBe(24)
  })
})

test.describe('utils/churchEvents — exceptions et fuseau horaire', () => {
  test('isoDay renvoie le jour local, pas le jour UTC', () => {
    expect(isoDay(new Date('2026-10-11T00:00:00'))).toBe('2026-10-11')
    // Ce que faisait l'ancien code, à titre de preuve du décalage :
    expect(new Date('2026-10-11T00:00:00').toISOString().slice(0, 10)).toBe('2026-10-10')
  })

  test('une occurrence annulée disparaît, une occurrence déplacée change de jour', () => {
    const culte = ev({
      start_date: '2026-01-04', repeat_period: 'weekly:0',
      exceptions: [
        { exception_date: '2026-10-18', type: 'cancelled' },
        { exception_date: '2026-10-25', type: 'moved', new_date: '2026-10-24' },
      ],
    })
    const dates = jours(expandRecurring(culte, new Date('2026-10-11T00:00:00'), 4))
    expect(dates).toEqual(['2026-10-11', '2026-10-24', '2026-11-01', '2026-11-08'])
  })

  test('événement annulé : jamais affiché', () => {
    expect(buildEventList([ev({ start_date: '2026-12-01', status: 'cancelled' })], { now: NOW })).toHaveLength(0)
  })
})

test.describe('estTermine : heure comprise', () => {
  const jour = new Date('2026-11-08T00:00:00')
  const evt = (heure: string | null, fin: string | null = null) => ({ date: jour, dateFin: null, heure, fin })
  test('heure de fin passée le jour même : terminé', () => {
    expect(estTermine(evt('10:00', '12:00'), new Date('2026-11-08T12:30:00'))).toBe(true)
    expect(estTermine(evt('10:00', '12:00'), new Date('2026-11-08T11:30:00'))).toBe(false)
  })
  test('sans heure de fin : début + 2 h', () => {
    expect(estTermine(evt('18:00'), new Date('2026-11-08T19:59:00'))).toBe(false)
    expect(estTermine(evt('18:00'), new Date('2026-11-08T20:00:00'))).toBe(true)
  })
  test('sans heure : jusqu\'à la fin de la journée', () => {
    expect(estTermine(evt(null), new Date('2026-11-08T23:59:00'))).toBe(false)
    expect(estTermine(evt(null), new Date('2026-11-09T00:00:00'))).toBe(true)
  })
  test('soirée qui finit après minuit', () => {
    expect(estTermine(evt('22:00', '01:00'), new Date('2026-11-09T00:30:00'))).toBe(false)
  })
  test('sur plusieurs jours : compte à partir du dernier jour', () => {
    const e = { date: jour, dateFin: new Date('2026-11-10T00:00:00'), heure: '10:00', fin: '12:00' }
    expect(estTermine(e, new Date('2026-11-09T15:00:00'))).toBe(false)
    expect(estTermine(e, new Date('2026-11-10T12:01:00'))).toBe(true)
  })
})

test.describe('utils/churchEvents — série mensuelle un 29, 30 ou 31', () => {
  // Cas réel : « Soirée Cieux Ouverts », chaque mois depuis le 30/01/2026.
  // `setMonth()` en boucle passait du 30 janvier au « 30 février » = 2 mars,
  // et toute la série s'affichait ensuite le 2 du mois.
  const soiree = ev({ start_date: '2026-01-30', end_date: '2026-01-30', repeat_period: 'month' })

  test('prochaines occurrences : toujours le 30, ou le dernier jour du mois', () => {
    const occ = expandRecurring(soiree, new Date('2026-11-09T00:00:00'), 4)
    expect(jours(occ)).toEqual(['2026-11-30', '2026-12-30', '2027-01-30', '2027-02-28'])
  })

  test('historique de l\'agenda : février ramené au 28, puis retour au 30', () => {
    const list = buildEventList([soiree], { now: '2026-11-09T12:00:00', futureOnly: false })
    const dates = jours(list)
    expect(dates).toContain('2026-02-28')
    expect(dates).toContain('2026-03-30')
    expect(dates).toContain('2026-11-30')
    expect(dates.some(d => d.endsWith('-02') && d !== '2026-01-02')).toBe(false)
  })
})

test('même jour : rangés par heure, sans heure en tête', () => {
  const list = buildEventList([
    ev({ id: 1, start_date: '2026-11-12', start_time: '21:00' }),
    ev({ id: 2, start_date: '2026-11-12', start_time: '19:30' }),
    ev({ id: 3, start_date: '2026-11-12' }),
  ], { now: '2026-11-09T12:00:00' })
  expect(list.map(e => e.id)).toEqual([3, 2, 1])
})

test.describe('utils/churchEvents — agendas Cieux Ouverts et Bras Ouverts', () => {
  const liste = [
    ev({ id: 1, title: 'Culte', start_date: '2026-10-18' }),
    ev({ id: 2, title: 'Maraude', start_date: '2026-10-18', source: 'bras-ouverts' }),
    ev({ id: 3, title: 'Importé', start_date: '2026-10-19', source: 'pco' }),
    ev({ id: 4, title: 'Fête', start_date: '2026-10-20', source: 'cieux-et-bras-ouverts' }),
  ]

  test('le site de l\'église ne montre jamais un événement Bras Ouverts', () => {
    const titres = buildEventList(liste, { now: NOW }).map(e => e.titre)
    expect(titres).toEqual(['Culte', 'Importé', 'Fête'])
  })

  test('le site Bras Ouverts ne montre que ses événements', () => {
    const titres = buildEventList(liste, { now: NOW, agenda: 'bras-ouverts' }).map(e => e.titre)
    expect(titres).toEqual(['Maraude', 'Fête'])
  })

  test('une source vide ou d\'import appartient à Cieux Ouverts', () => {
    expect(agendaDe({ source: null })).toBe('cieux-ouverts')
    expect(agendaDe({ source: 'pco' })).toBe('cieux-ouverts')
    expect(agendaDe({ source: 'bras-ouverts' })).toBe('bras-ouverts')
  })

  test('un événement publié sur les deux sites apparaît dans les deux agendas', () => {
    expect(agendaDe({ source: 'cieux-et-bras-ouverts' })).toBe('les-deux')
    const f = (agenda?: string) => buildEventList(liste, { now: NOW, agenda }).map(e => e.titre)
    expect(f()).toContain('Fête')
    expect(f('bras-ouverts')).toContain('Fête')
  })
})

// Agenda public, vue « Cartes » : des événements passés s'affichaient, et deux
// fiches du même événement (deux jours de la semaine, ou sessions #1, #2, #3
// saisies séparément) donnaient deux cartes identiques en apparence.
test.describe('utils/churchEvents — cartes sans doublons ni passé', () => {
  test('même événement malgré emoji, numéro de session ou espaces', () => {
    expect(cleEvenement('Chemin de Liberté 🕊️ #1')).toBe(cleEvenement('Chemin de Liberté 🕊️ #3'))
    expect(cleEvenement('Ecole du Disciple 👣  Session 2')).toBe(cleEvenement('Ecole du Disciple 👣'))
    expect(cleEvenement('Autel de Louange 🙌')).not.toBe(cleEvenement('Réunion de Prières 🙏'))
    expect(numeroSession('Chemin de Liberté 🕊️ #2')).toBe(2)
    expect(numeroSession('Ecole du Disciple 👣  Session 2')).toBe(2)
    expect(numeroSession('Fête de l\'Eté - 2ème édition')).toBeNull()
    expect(titreSansSession('Chemin de Liberté 🕊️ #2')).toBe('Chemin de Liberté 🕊️')
  })

  test('vrai doublon (même événement, même jour, même heure) : un seul, le plus complet', () => {
    const list = buildEventList([
      ev({ id: 1, title: 'Soirée jeunes', start_date: '2026-12-04', start_time: '19:00' }),
      ev({ id: 2, title: 'Soirée jeunes 🎉', start_date: '2026-12-04', start_time: '19:00', image_url: '/a.jpg' }),
      ev({ id: 3, title: 'Soirée jeunes', start_date: '2026-12-04', start_time: '21:00' }),
    ], { now: NOW })
    expect(list.map(e => e.id)).toEqual([2, 3])
    expect(sansDoublons([])).toEqual([])
  })

  test('deux séries du même événement : une carte, toutes les dates, rien de terminé', () => {
    // Cas réel : « Autel de Louange » le mardi (série terminée le 17/11) et le jeudi.
    const mardi = ev({ id: 26, title: 'Autel de Louange 🙌', start_date: '2026-01-06', end_date: '2026-11-17', start_time: '21:00', end_time: '22:30', repeat_period: 'week' })
    const jeudi = ev({ id: 19, title: 'Autel de Louange 🙌', start_date: '2026-01-08', start_time: '21:00', end_time: '22:30', repeat_period: 'week', image_url: '/autel.jpg' })
    const now = new Date('2026-11-26T12:00:00')
    const novembre = buildEventList([mardi, jeudi], { now, futureOnly: false })
      .filter(e => e.date.getMonth() === 10 && e.date.getFullYear() === 2026)
    const cartes = regrouperCartes(novembre, now)
    expect(cartes).toHaveLength(1)
    expect(cartes[0].dates.map(d => isoDay(d.date))).toEqual(['2026-11-26'])
    expect(cartes[0].evt.images).toEqual(['/autel.jpg'])
    // Fin de soirée passée : la carte disparaît.
    expect(regrouperCartes(novembre, new Date('2026-11-26T23:00:00'))).toHaveLength(0)
  })

  test('sessions saisies séparément : une carte numérotée, titre sans le numéro', () => {
    const sessions = [1, 2, 3].map(n => ev({ id: n, title: `Chemin de Liberté 🕊️ #${n}`, start_date: `2026-12-0${n * 2}`, start_time: '20:00' }))
    const cartes = regrouperCartes(buildEventList(sessions, { now: NOW }), new Date(NOW))
    expect(cartes).toHaveLength(1)
    expect(cartes[0].titre).toBe('Chemin de Liberté 🕊️')
    expect(cartes[0].dates.map(d => d.session)).toEqual([1, 2, 3])
  })

  test('rythme lisible d\'une série', () => {
    expect(libelleRecurrence({ repeat_period: 'week', debutSerie: '2026-01-06' })).toBe('chaque mardi')
    expect(libelleRecurrence({ repeat_period: 'biweek', debutSerie: '2026-11-12' })).toBe('un jeudi sur deux')
    expect(libelleRecurrence({ repeat_period: 'weekly:0' })).toBe('chaque dimanche')
    expect(libelleRecurrence({ repeat_period: 'weekly:0,3' })).toBe('chaque mercredi et dimanche')
    expect(libelleRecurrence({ repeat_period: 'monthly_weekday:-1:0' })).toBe('le dernier dimanche du mois')
    expect(libelleRecurrence({ repeat_period: null })).toBeNull()
    expect(fusionnerRecurrences(['chaque jeudi', 'chaque mardi'])).toEqual(['chaque mardi et jeudi'])
    expect(fusionnerRecurrences(['un jeudi sur deux', 'chaque mardi'])).toEqual(['chaque mardi', 'un jeudi sur deux'])
  })
})
