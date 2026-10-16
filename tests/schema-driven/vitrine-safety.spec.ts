import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { BLOCK_TYPES, createBlock } from '../../utils/blockTypes.js'

/**
 * GARDE-FOU VITRINES (refonte admin/builder en recette).
 *
 * Le rendu public d'un bloc est piloté par BLOCK_TYPES[type].defaults :
 * normalizeBlock() (lib/blocks/renderer.ts) réapplique ces defaults à CHAQUE
 * rendu pour tout prop absent. Donc tant que les defaults ne bougent pas et
 * qu'on ne touche pas aux composants components/blocks/Block*.vue, le rendu
 * des pages vitrines de production reste identique.
 *
 * Ce test échoue si une modification de l'éditeur altère par ricochet les
 * defaults, ou si une métadonnée de schéma (ex. `group`) fuit dans les props.
 *
 * Golden : tests/schema-driven/fixtures-vitrine-defaults.json
 * Régénérer VOLONTAIREMENT (changement vitrine assumé) :
 *   node --input-type=module -e "import('./utils/blockTypes.js').then(m=>{const g={};for(const[t,d]of Object.entries(m.BLOCK_TYPES))g[t]=d.defaults;require('fs').writeFileSync('tests/schema-driven/fixtures-vitrine-defaults.json',JSON.stringify(g,null,2)+'\n')})"
 */

// Playwright exécute depuis la racine du dépôt
const golden = JSON.parse(
  readFileSync(join(process.cwd(), 'tests/schema-driven/fixtures-vitrine-defaults.json'), 'utf8'),
) as Record<string, Record<string, unknown>>

const ALLOWED_GROUPS = ['contenu', 'formulaire', 'textes', 'mise-en-page', 'couleurs', 'medias', 'avance', 'scripts']

test.describe('Garde-fou vitrines — defaults de blocs figés', () => {
  test('aucun type de bloc n\'a disparu du golden', () => {
    for (const type of Object.keys(golden)) {
      expect(BLOCK_TYPES[type], `Le bloc "${type}" a disparu de BLOCK_TYPES`).toBeTruthy()
    }
  })

  test('les defaults de chaque bloc sont byte-identiques au golden', () => {
    for (const [type, def] of Object.entries(BLOCK_TYPES)) {
      const expected = golden[type]
      // Un NOUVEAU bloc (absent du golden) est autorisé : il n'existe sur
      // aucune vitrine de prod. Un bloc EXISTANT doit être figé.
      if (!expected) continue
      expect(
        JSON.parse(JSON.stringify(def.defaults)),
        `Les defaults du bloc "${type}" ont changé → risque de modifier le rendu des vitrines en prod`,
      ).toEqual(expected)
    }
  })

  test('createBlock() ne fait remonter que les defaults dans props (pas de fuite de métadonnée)', () => {
    for (const type of Object.keys(BLOCK_TYPES)) {
      const block = createBlock(type)
      expect(block, `${type}: createBlock a renvoyé null`).toBeTruthy()
      // props === defaults exactement (aucun champ de schéma type `group` injecté)
      expect(
        block!.props,
        `${type}: createBlock().props diverge des defaults`,
      ).toEqual(BLOCK_TYPES[type].defaults)
    }
  })
})

test.describe('Groupes de sidebar (métadonnée éditeur, neutre pour le rendu)', () => {
  test('tout `group` de champ appartient à la liste autorisée', () => {
    for (const [type, def] of Object.entries(BLOCK_TYPES)) {
      for (const field of def.schema || []) {
        if ('group' in field && field.group != null) {
          expect(
            ALLOWED_GROUPS,
            `${type}.${field.key}: group "${field.group}" hors liste autorisée`,
          ).toContain(field.group)
        }
      }
    }
  })
})
