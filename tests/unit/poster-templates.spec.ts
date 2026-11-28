import { test, expect } from '@playwright/test'
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { MODELES_AFFICHES, POLICES_AFFICHES, dateEnToutesLettres, heureAffiche, modelePourEvenement, textesParDefaut, modelePourImage } from '../../utils/posterTemplates.js'

// Affiches automatiques de l'agenda (utils/posterTemplates.js).
const racine = resolve(__dirname, '../..')

test.describe('Affiches : textes par défaut', () => {
  test('date en toutes lettres, jour en majuscule, lue en heure locale', () => {
    expect(dateEnToutesLettres('2026-11-27')).toBe('Vendredi 27 novembre')
    expect(dateEnToutesLettres('2026-12-25')).toBe('Vendredi 25 décembre')
    expect(dateEnToutesLettres('2027-01-01')).toBe('Vendredi 1 janvier')
    expect(dateEnToutesLettres('')).toBe('')
    expect(dateEnToutesLettres('n\'importe quoi')).toBe('')
  })

  test('heure au format des affiches', () => {
    expect(heureAffiche('19:30')).toBe('19H30')
    expect(heureAffiche('20:00')).toBe('20H')
    expect(heureAffiche('09:15')).toBe('9H15')
    expect(heureAffiche('')).toBe('')
  })

  test('modèle choisi d\'après le titre de la fiche, textes pré-remplis', () => {
    const m = modelePourEvenement('Soirée Cieux Ouverts ❤️‍🔥')
    expect(m.id).toBe('soiree-cieux-ouverts')
    expect(textesParDefaut(m, { date: '2026-12-25', heure: '19:30' })).toEqual({ date: 'Vendredi 25 décembre', heure: '19H30' })
    // Sans modèle à lui : le modèle « Tout événement », qui écrit aussi titre et rythme.
    const g = modelePourEvenement('Réunion de Prières 🙏')
    expect(g.id).toBe('evenement')
    expect(textesParDefaut(g, { date: '2026-12-02', heure: '19:30', titre: 'Réunion de Prières 🙏', rythme: 'chaque mercredi' })).toEqual({
      titre: 'Réunion de Prières',
      rythme: 'Chaque mercredi',
      date: 'Mercredi 2 décembre',
      heure: '19H30',
    })
    expect(modelePourImage('/affiches/modeles/evenement.jpg')?.id).toBe('evenement')
  })
})

test.describe('Affiches automatiques : reconnaissance du fond', () => {
  test('le fond d\'un modèle est reconnu, en adresse relative ou absolue', () => {
    expect(modelePourImage('/affiches/modeles/soiree-cieux-ouverts.jpg')?.id).toBe('soiree-cieux-ouverts')
    expect(modelePourImage('https://www.cieuxouverts.bzh/affiches/modeles/soiree-cieux-ouverts.jpg')?.id).toBe('soiree-cieux-ouverts')
  })

  test('une image ordinaire n\'est pas une affiche automatique', () => {
    expect(modelePourImage('/api/media/uploads/123_affiche.jpg')).toBeNull()
    expect(modelePourImage('/images/slides/soiree-cieux-ouverts-2026-11-27.jpg')).toBeNull()
    expect(modelePourImage('')).toBeNull()
    expect(modelePourImage(null)).toBeNull()
  })
})

test.describe('Affiches : fichiers fournis', () => {
  test('chaque fond et chaque police existent dans public/', () => {
    for (const m of MODELES_AFFICHES) expect(existsSync(resolve(racine, 'public' + m.fond)), m.fond).toBe(true)
    for (const p of POLICES_AFFICHES) expect(existsSync(resolve(racine, 'public' + p.fichier)), p.fichier).toBe(true)
  })

  test('chaque zone utilise une police fournie (jamais une police système en repli)', () => {
    const familles = POLICES_AFFICHES.map(p => p.famille)
    for (const m of MODELES_AFFICHES) for (const z of m.zones) expect(familles).toContain(z.famille)
  })

  test('les fonds de modèles ne sont pas proposés dans « Images du site »', () => {
    const images: string[] = JSON.parse(readFileSync(resolve(racine, 'utils/siteImages.json'), 'utf-8'))
    expect(images.some(i => i.startsWith('/affiches/modeles/'))).toBe(false)
  })
})
