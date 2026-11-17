import { test, expect } from '@playwright/test'
import {
  normaliserAdresse,
  reponsePageDepuisDoc,
  plannifierDeplacement,
  adresseOccupee,
} from '../../utils/adressePage.js'

// Adresse des pages : saisie dans l'éditeur de menu, normalisée côté serveur.

test.describe('normaliserAdresse', () => {
  test('met en forme une adresse saisie librement', () => {
    expect(normaliserAdresse('  Nous Soutenir ! ')).toBe('nous-soutenir')
    expect(normaliserAdresse('Dons é à')).toBe('dons-e-a')
    expect(normaliserAdresse('nous-soutenir')).toBe('nous-soutenir')
  })

  test('refuse les adresses vides, trop longues ou réservées au site', () => {
    expect(normaliserAdresse('')).toBeNull()
    expect(normaliserAdresse('   ')).toBeNull()
    expect(normaliserAdresse('!!!')).toBeNull()
    expect(normaliserAdresse('a'.repeat(61))).toBeNull()
    expect(normaliserAdresse('contact')).toBeNull()
    expect(normaliserAdresse('admin')).toBeNull()
    expect(normaliserAdresse('api')).toBeNull()
  })

  test('accepte « dons » comme adresse par défaut', () => {
    expect(normaliserAdresse('dons')).toBe('dons')
  })
})

test.describe('reponsePageDepuisDoc', () => {
  test('page de dons absente : contenu de départ', () => {
    const r = reponsePageDepuisDoc('dons', null)
    expect(r.exists).toBe(true)
    expect(r.blocks.length).toBeGreaterThan(0)
  })

  test('ancienne adresse déplacée : redirection vers la nouvelle', () => {
    const r = reponsePageDepuisDoc('dons', { blocks: [], _deleted: true, redirectTo: '/nous-soutenir' })
    expect(r.exists).toBe(false)
    expect(r.redirectTo).toBe('/nous-soutenir')
  })

  test('page existante : son contenu', () => {
    const r = reponsePageDepuisDoc('nous-soutenir', { blocks: [{ id: 'x', type: 'quote', props: {} }] })
    expect(r.exists).toBe(true)
    expect(r.blocks).toHaveLength(1)
  })

  test('page inconnue : 404', () => {
    expect(reponsePageDepuisDoc('inconnue', null).exists).toBe(false)
  })
})

test.describe('déplacement d\'une page', () => {
  test('copie le contenu vers la nouvelle adresse et laisse une redirection', () => {
    const blocs = [{ id: 'a', type: 'quote', props: {} }]
    const { nouveauDoc, ancienDoc } = plannifierDeplacement('dons', 'nous-soutenir', { blocks: blocs, title: 'Dons' })
    expect(nouveauDoc).toEqual({ blocks: blocs, title: 'Dons' })
    expect(ancienDoc).toEqual({ blocks: [], _deleted: true, redirectTo: '/nous-soutenir' })
  })

  test('sans document enregistré, déplace le contenu de départ', () => {
    const { nouveauDoc } = plannifierDeplacement('dons', 'nous-soutenir', null)
    expect(nouveauDoc.blocks.length).toBeGreaterThan(0)
  })

  test('une adresse déjà occupée par une page vivante est refusée', () => {
    expect(adresseOccupee({ blocks: [] })).toBe(true)
    expect(adresseOccupee({ blocks: [], _deleted: true, redirectTo: '/x' })).toBe(false)
    expect(adresseOccupee(null)).toBe(false)
  })
})
