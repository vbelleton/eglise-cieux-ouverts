import { test, expect } from '@playwright/test'
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { MODELES_AFFICHES, POLICES_AFFICHES, dateEnToutesLettres, heureAffiche, modelePourEvenement, textesParDefaut, nomFichierAffiche } from '../../utils/posterTemplates.js'

// Générateur d'affiches d'agenda (components/admin/PosterGenerator.vue).
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
    expect(modelePourEvenement('Autre chose')).toBe(MODELES_AFFICHES[0])
    expect(nomFichierAffiche(m, '2026-12-25')).toBe('affiche-soiree-cieux-ouverts-2026-12-25.jpg')
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
