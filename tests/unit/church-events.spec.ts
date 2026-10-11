import { test, expect } from '@playwright/test'
import { buildEventList, expandRecurring, isoDay, lastDay, isPast } from '../../utils/churchEvents.js'

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
