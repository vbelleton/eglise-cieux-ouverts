import { test, expect } from '@playwright/test'
import {
  jourParis, estPerimee, slidesAffichees, slidesAgenda, verifierSlide, slideAnnonce,
  heuresDansTexte, dateDansNomImage, fusionnerSlides, titreNet,
} from '../../utils/diaporama.js'
import { buildEventList } from '../../utils/churchEvents.js'
import { BLOCK_TYPES } from '../../utils/blockTypes.js'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

test.describe('utils/diaporama — affiches périmées', () => {
  test('le jour est celui de Paris, pas celui d\'UTC', () => {
    // 23 h 30 UTC le 26 = 0 h 30 le 27 à Paris (heure d'hiver).
    expect(jourParis(new Date('2026-11-26T23:30:00Z'))).toBe('2026-11-27')
    // 22 h 30 UTC le 30 juin = 0 h 30 le 1er juillet (heure d'été).
    expect(jourParis(new Date('2026-06-30T22:30:00Z'))).toBe('2026-07-01')
    expect(jourParis(new Date('2026-11-27T12:00:00Z'))).toBe('2026-11-27')
  })

  test('une affiche reste visible le jour de sa date de fin, disparaît le lendemain', () => {
    const s = { image: '/a.jpg', fin: '2026-11-27' }
    expect(estPerimee(s, '2026-11-26')).toBe(false)
    expect(estPerimee(s, '2026-11-27')).toBe(false)
    expect(estPerimee(s, '2026-11-28')).toBe(true)
  })

  test('sans date ou avec une date illisible, l\'affiche reste', () => {
    expect(estPerimee({ image: '/a.jpg' }, '2030-01-01')).toBe(false)
    expect(estPerimee({ image: '/a.jpg', fin: '' }, '2030-01-01')).toBe(false)
    expect(estPerimee({ image: '/a.jpg', fin: '27/11/2026' }, '2030-01-01')).toBe(false)
  })

  test('slidesAffichees écarte les périmées et celles sans image, garde l\'ordre', () => {
    const slides = [
      { image: '/1.jpg', fin: '2026-11-19' },
      { image: '/2.jpg', fin: '2026-12-13' },
      { image: '', fin: '2027-01-01' },
      { image: '/3.jpg' },
      null,
    ]
    expect(slidesAffichees(slides, '2026-11-22').map((s: any) => s.image)).toEqual(['/2.jpg', '/3.jpg'])
    expect(slidesAffichees(undefined, '2026-11-22')).toEqual([])
  })

  test('les affiches par défaut existent dans public/ et ont un texte alternatif', () => {
    const items = (BLOCK_TYPES as any).diaporama.defaults.items
    expect(items.length).toBeGreaterThan(0)
    for (const it of items) {
      expect(existsSync(join(process.cwd(), 'public', it.image)), it.image).toBe(true)
      expect(it.alt.length).toBeGreaterThan(10)
      expect(it.fin).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })
})

// Fiches telles que le Worker les renvoie (extrait de la vraie base, nov. 2026).
const FICHES = [
  { id: 2, title: 'Célébration 🙌', start_date: '2025-02-05', start_time: '10:00', repeat_period: 'weekly:0', image_url: '/u/celebration.jpg', status: 'active' },
  { id: 5, title: 'Repas en commun - Agape 🥘', start_date: '2026-01-23', start_time: '12:15', repeat_period: 'monthly_weekday:-1:0', image_url: '/u/agape.jpg', status: 'active' },
  { id: 23, title: 'Soirée Cieux Ouverts ❤️‍🔥', start_date: '2026-01-30', start_time: '19:30', repeat_period: 'monthly_weekday:-1:5', image_url: '/affiches/modeles/soiree-cieux-ouverts.jpg', status: 'active' },
  { id: 31, title: 'Célébration de Noël 🎄', start_date: '2026-12-13', start_time: '10:00', image_url: '/images/slides/noel-2026-12-13.jpg', status: 'active' },
  { id: 32, title: 'Culte de baptême 💧', start_date: '2027-01-10', start_time: '10:00', image_url: '/images/slides/baptemes-2027-01-10.jpg', status: 'active' },
  { id: 30, title: 'Soirée jeunes', start_date: '2026-12-04', start_time: '19:00', image_url: null, status: 'active' },
  { id: 3, title: 'Réunion de Prières 🙏', start_date: '2026-11-04', start_time: '19:30', repeat_period: 'week', image_url: '/u/priere.jpg', status: 'active' },
]
const evenements = (fiches = FICHES, now = '2026-11-20T08:00:00') => buildEventList(fiches, { now: new Date(now) })
const SOIREE = { image: '/images/slides/soiree-cieux-ouverts-2026-11-27.jpg', alt: 'Soirée Cieux Ouverts : louange, prières, adoration. Vendredi 27 novembre, 19 h 30.', link: '/agenda', fin: '2026-11-27' }
const NOEL = { image: '/images/slides/noel-2026-12-13.jpg', alt: 'Célébration de Noël, dimanche 13 décembre.', link: '/agenda', fin: '2026-12-13' }
const BAPTEMES = { image: '/images/slides/baptemes-2027-01-10.jpg', alt: "Baptêmes le dimanche 10 janvier 2027, suivis d'un buffet.", fin: '2027-01-10' }
const LIBRAIRIE = { image: '/images/slides/librairie-ephemere.jpg', alt: 'Librairie éphémère, jusqu\'à début janvier.', fin: '2027-01-10' }

test.describe('utils/diaporama — alignement sur l\'agenda', () => {
  test.use({ timezoneId: 'Europe/Paris' })

  test('lit les heures écrites sur une affiche', () => {
    expect(heuresDansTexte('Vendredi 27 novembre, 19 h 30.')).toEqual([19 * 60 + 30])
    expect(heuresDansTexte('Le mardi de 19h30 à 21h30')).toEqual([1170, 1290])
    expect(heuresDansTexte('à 20h, ou 20:00')).toEqual([1200, 1200])
    expect(heuresDansTexte('Baptêmes le dimanche 10 janvier 2027')).toEqual([])
  })

  test('date dans le nom de l\'image, titre sans emoji', () => {
    expect(dateDansNomImage('https://x/images/slides/soiree-cieux-ouverts-2026-11-27.jpg?v=2')).toBe('2026-11-27')
    expect(dateDansNomImage('/api/media/uploads/1794246995000_img-abc.jpg')).toBeNull()
    expect(titreNet('Repas en commun - Agape 🥘')).toBe('Repas en commun - Agape')
    expect(titreNet('Soirée Cieux Ouverts ❤️‍🔥')).toBe('Soirée Cieux Ouverts')
  })

  test('rapproche une affiche de son événement, sans confondre les titres voisins', () => {
    const ev = evenements()
    const noel = ev.find((e: any) => e.titre.startsWith('Célébration de Noël'))
    const celebration = ev.find((e: any) => e.titre === 'Célébration 🙌')
    const bapteme = ev.find((e: any) => e.titre.startsWith('Culte de baptême'))
    expect(slideAnnonce(NOEL, noel)).toBe(true)
    // « Baptêmes » ↔ « Culte de baptême » : même jour + un mot commun.
    expect(slideAnnonce(BAPTEMES, bapteme)).toBe(true)
    expect(slideAnnonce({ ...BAPTEMES, fin: '2027-01-17' }, bapteme)).toBe(false)
    expect(slideAnnonce(LIBRAIRIE, noel)).toBe(false)
    // « Célébration de Noël » contient « Célébration » : rapprochée, mais la
    // vérification retient l'événement le plus précis (pas d'alerte parasite).
    expect(slideAnnonce(NOEL, celebration)).toBe(true)
    expect(verifierSlide(NOEL, ev, '2026-11-20')).toEqual([])
  })

  test('alerte quand l\'heure de l\'affiche diffère de l\'agenda (cas du 27/11 : affiche 19 h 30, agenda 20 h)', () => {
    // Fiche à image ordinaire (affiche figée) : l'heure de l'agenda est comparée.
    const fiches = FICHES.map((f) => (f.id === 23 ? { ...f, start_time: '20:00', image_url: '/u/soiree.jpg' } : f))
    const alertes = verifierSlide(SOIREE, evenements(fiches), '2026-11-20')
    expect(alertes).toHaveLength(1)
    expect(alertes[0]).toContain("l'affiche dit 19 h 30, l'agenda dit 20 h")
    expect(verifierSlide(SOIREE, evenements(), '2026-11-20')).toEqual([])
    // Fiche en affiche automatique : c'est elle qui est projetée, rien à signaler.
    expect(verifierSlide(SOIREE, evenements(FICHES.map((f) => (f.id === 23 ? { ...f, start_time: '20:00' } : f))), '2026-11-20')).toEqual([])
  })

  test('alerte quand l\'agenda n\'a pas l\'événement au jour de l\'affiche', () => {
    const decalee = { ...SOIREE, fin: '2026-11-28' }
    const alertes = verifierSlide(decalee, evenements(FICHES.map((f) => (f.id === 23 ? { ...f, image_url: '/u/soiree.jpg' } : f))), '2026-11-20')
    expect(alertes[0]).toContain("L'agenda n'a pas « Soirée Cieux Ouverts » le samedi 28 novembre")
    expect(alertes[0]).toContain('prochaine date le vendredi 27 novembre')
  })

  test('affiche sans lien avec l\'agenda : rien à dire, sauf si elle n\'a pas de fin', () => {
    expect(verifierSlide(LIBRAIRIE, evenements(), '2026-11-20')).toEqual([])
    expect(verifierSlide({ ...LIBRAIRIE, fin: '' }, evenements(), '2026-11-20')[0]).toContain('sans limite')
    // Périmée : déjà signalée autrement.
    expect(verifierSlide(SOIREE, evenements(), '2026-11-28')).toEqual([])
  })

  test('ajoute d\'office les prochains événements à affiche, sans hebdomadaires ni doublons', () => {
    const { ajoutees } = slidesAgenda(evenements(), [NOEL, LIBRAIRIE], { aujourdhui: '2026-11-20', jours: 30 })
    const titres = ajoutees.map((s: any) => `${s.titre} ${s.fin}`)
    // Agape (mensuel, une seule fois), Soirée Cieux Ouverts (affiche automatique) ;
    // Noël est déjà affichée à la main ; Célébration et Réunion de prières sont
    // hebdomadaires ; Soirée jeunes n'a pas d'image ; baptêmes est trop loin.
    expect(titres).toEqual(['Soirée Cieux Ouverts 2026-11-27', 'Repas en commun - Agape 2026-11-29'])
    expect(ajoutees[0]).toMatchObject({ agenda: true, link: '/agenda', heure: '19:30', image: '/affiches/modeles/soiree-cieux-ouverts.jpg' })
    expect(ajoutees[0].alt).toBe('Soirée Cieux Ouverts : vendredi 27 novembre, 19 h 30.')
  })

  test('une affiche à la main périmée n\'empêche pas la séance suivante de venir de l\'agenda', () => {
    const { ajoutees } = slidesAgenda(evenements(FICHES, '2026-11-28T08:00:00'), [SOIREE], { aujourdhui: '2026-11-28', jours: 30 })
    expect(ajoutees.map((s: any) => s.fin)).toContain('2026-12-25')
  })

  test('une affiche datée d\'une autre séance n\'est pas reprise : elle est signalée', () => {
    const fiches = FICHES.map((f) => (f.id === 23 ? { ...f, image_url: '/images/slides/soiree-cieux-ouverts-2026-11-27.jpg' } : f))
    const { ajoutees, ecartees } = slidesAgenda(evenements(fiches, '2026-11-28T08:00:00'), [], { aujourdhui: '2026-11-28', jours: 30 })
    expect(ajoutees.some((s: any) => s.titre === 'Soirée Cieux Ouverts')).toBe(false)
    expect(ecartees).toHaveLength(1)
    expect(ecartees[0]).toMatchObject({ jour: '2026-12-25', dateImage: '2026-11-27' })
  })

  test('fusion par date, les affiches sans fin à la suite', () => {
    const a = { image: '/a', fin: '2026-12-13' }
    const b = { image: '/b' }
    const c = { image: '/c', fin: '2026-11-29', agenda: true }
    expect(fusionnerSlides([a, b], [c]).map((s: any) => s.image)).toEqual(['/c', '/a', '/b'])
  })

  test('fiche en affiche automatique : remplace l\'affiche posée à la main, même pour une réunion hebdomadaire', () => {
    const fiches = FICHES.map((f) => (f.id === 2 ? { ...f, image_url: '/affiches/modeles/evenement.jpg' } : f))
      .map((f) => (f.id === 31 ? { ...f, image_url: '/affiches/modeles/evenement.jpg' } : f))
    const ev = evenements(fiches, '2026-11-26T08:00:00')
    const { ajoutees, remplacees } = slidesAgenda(ev, [NOEL, LIBRAIRIE], { aujourdhui: '2026-11-26', jours: 30 })
    const titres = ajoutees.map((s: any) => s.titre)
    // La Célébration du dimanche (hebdomadaire) est là, une seule fois, avec son rythme.
    expect(titres.filter((t: string) => t.startsWith('Célébration')).sort()).toEqual(['Célébration', 'Célébration de Noël'])
    const celebration = ajoutees.find((s: any) => s.titre === 'Célébration')
    expect(celebration).toMatchObject({ auto: true, fin: '2026-11-29', rythme: 'chaque dimanche' })
    // L'affiche de Noël posée à la main est remplacée par celle de l'agenda ; la librairie reste.
    expect(remplacees).toEqual([NOEL])
    // Sans cela, les hebdomadaires restent à l'écart.
    const sansAuto = slidesAgenda(evenements(FICHES, '2026-11-26T08:00:00'), [], { aujourdhui: '2026-11-26', jours: 30 })
    expect(sansAuto.ajoutees.some((s: any) => s.titre === 'Célébration')).toBe(false)
  })

  test('« Célébration de Noël » à la main n\'est pas remplacée par la Célébration du dimanche en affiche automatique', () => {
    const fiches = FICHES.map((f) => (f.id === 2 ? { ...f, image_url: '/affiches/modeles/evenement.jpg' } : f))
    const { remplacees } = slidesAgenda(evenements(fiches, '2026-11-26T08:00:00'), [NOEL], { aujourdhui: '2026-11-26', jours: 30 })
    expect(remplacees).toEqual([])
    expect(verifierSlide(NOEL, evenements(fiches, '2026-11-26T08:00:00'), '2026-11-26')).toEqual([])
  })
})
