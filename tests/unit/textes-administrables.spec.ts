import { test, expect } from '@playwright/test'
import { readFileSync, readdirSync } from 'fs'
import { resolve } from 'path'
import { fieldFontStyle, formatStyle } from '../../utils/fonts.js'
import { BLOCK_TYPES } from '../../utils/blockTypes.js'

const racine = resolve(__dirname, '../..')
const lire = (p: string) => readFileSync(resolve(racine, p), 'utf-8')

test.describe('Mise en forme des textes (gras, italique, souligné, couleur)', () => {
  test('fieldFontStyle applique le format rangé dans fieldFonts._formats', () => {
    const fieldFonts = { _formats: { title: { gras: true, italique: true, souligne: true, couleur: '#c0392b' } } }
    expect(fieldFontStyle(fieldFonts, 'title')).toEqual({
      fontWeight: '700',
      fontStyle: 'italic',
      textDecoration: 'underline',
      color: '#c0392b',
    })
    expect(fieldFontStyle(fieldFonts, 'subtitle')).toEqual({})
  })

  test('une couleur invalide est ignorée', () => {
    expect(formatStyle({ couleur: 'red; background: url(x)' })).toEqual({})
    expect(formatStyle({ couleur: 'rgb(10, 20, 30)' })).toEqual({ color: 'rgb(10, 20, 30)' })
    expect(formatStyle(null)).toEqual({})
  })
})

// Tout texte affiché aux visiteurs par un bloc doit venir de ses props
// (donc de l'admin), pas être écrit en dur dans le gabarit.
function textesEnDur(gabarit: string) {
  const t = gabarit.replace(/<!--[\s\S]*?-->/g, '').replace(/&[a-z]+;/g, '')
  const trouves: string[] = []
  // Balise = tout jusqu'au « > » qui la ferme, en sautant ceux des attributs
  // entre guillemets (ex. :class="{ x: i >= n }").
  for (const morceau of t.split(/<(?:[^>"']|"[^"]*"|'[^']*')*>/)) {
    const texte = morceau.replace(/\{\{[\s\S]*?\}\}/g, '').replace(/\s+/g, ' ').trim()
    if (/[A-Za-zÀ-ÿ]{3,}/.test(texte)) trouves.push(texte)
  }
  for (const m of t.matchAll(/\{\{([\s\S]*?)\}\}/g)) {
    for (const lit of m[1].matchAll(/(['"`])([^'"`]*[A-Za-zÀ-ÿ]{3,}[^'"`]*)\1/g)) trouves.push(lit[2])
  }
  return trouves
}

// Exceptions assumées : messages vus seulement dans l'admin, et le nom de
// l'église affiché uniquement si l'image du titre ne se charge pas.
const AUTORISES = new Set([
  "Le formulaire est désactivé dans l'admin. Teste-le sur le site public.",
  'Église Cieux Ouverts',
])

test.describe('Textes des blocs administrables', () => {
  const dossier = resolve(racine, 'components/blocks')
  for (const fichier of readdirSync(dossier).filter((f) => f.endsWith('.vue'))) {
    test(`${fichier} n'écrit aucun texte visible en dur`, () => {
      const src = lire(`components/blocks/${fichier}`)
      const gabarit = src.match(/<template>([\s\S]*)<\/template>/)?.[1] || ''
      const enDur = textesEnDur(gabarit).filter((t) => !AUTORISES.has(t))
      expect(enDur).toEqual([])
    })
  }

  test('chaque champ de texte du schéma a une valeur par défaut', () => {
    const manquants: string[] = []
    for (const [type, def] of Object.entries(BLOCK_TYPES) as [string, any][]) {
      for (const champ of def.schema || []) {
        if (['textes'].includes(champ.group) && !(champ.key in (def.defaults || {}))) manquants.push(`${type}.${champ.key}`)
      }
    }
    expect(manquants).toEqual([])
  })

  test('la mention des champs obligatoires du contact est modifiable', () => {
    expect(BLOCK_TYPES.contact.defaults.requiredNote).toBe("Les champs marqués d'un * sont obligatoires.")
    expect(BLOCK_TYPES.contact.schema.some((f: any) => f.key === 'requiredNote')).toBe(true)
  })
})
