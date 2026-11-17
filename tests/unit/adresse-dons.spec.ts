import { test, expect } from '@playwright/test'
import {
  normaliserAdresseDons,
  adresseDonsCourante,
  reponsePageDepuisDoc,
  plannifierDeplacement,
  adresseOccupee,
} from '../../utils/adresseDons.js'

// Adresse de la page de dons : saisie libre dans ⚙ Config, normalisée côté serveur.

test.describe('normaliserAdresseDons', () => {
  test('met en forme une adresse saisie librement', () => {
    expect(normaliserAdresseDons('  Nous Soutenir ! ')).toBe('nous-soutenir')
    expect(normaliserAdresseDons('Dons é à')).toBe('dons-e-a')
    expect(normaliserAdresseDons('nous-soutenir')).toBe('nous-soutenir')
  })

  test('refuse les adresses vides, trop longues ou réservées au site', () => {
    expect(normaliserAdresseDons('')).toBeNull()
    expect(normaliserAdresseDons('   ')).toBeNull()
    expect(normaliserAdresseDons('!!!')).toBeNull()
    expect(normaliserAdresseDons('a'.repeat(61))).toBeNull()
    expect(normaliserAdresseDons('contact')).toBeNull()
    expect(normaliserAdresseDons('admin')).toBeNull()
    expect(normaliserAdresseDons('api')).toBeNull()
  })

  test('accepte « dons » comme adresse par défaut', () => {
    expect(normaliserAdresseDons('dons')).toBe('dons')
    expect(adresseDonsCourante({})).toBe('dons')
    expect(adresseDonsCourante({ adresseDons: 'nous-soutenir' })).toBe('nous-soutenir')
    expect(adresseDonsCourante({ adresseDons: 'contact' })).toBe('dons')
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

test.describe('déplacement de la page de dons', () => {
  test('copie le contenu vers la nouvelle adresse et laisse une redirection', () => {
    const blocs = [{ id: 'a', type: 'quote', props: {} }]
    const { nouveauDoc, ancienDoc } = plannifierDeplacement('dons', 'nous-soutenir', { blocks: blocs })
    expect(nouveauDoc.blocks).toEqual(blocs)
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
