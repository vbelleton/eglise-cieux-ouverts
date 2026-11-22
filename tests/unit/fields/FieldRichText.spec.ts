import { test, expect } from '@playwright/test'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// L'admin ne doit plus montrer de balises HTML dans les champs de texte :
// éditeur visuel par défaut, code HTML seulement sur demande (« </> HTML »).
test.describe('FieldRichText.vue (static/unit checks)', () => {
  const file = resolve(__dirname, '../../../components/editor/fields/FieldRichText.vue')
  const src = readFileSync(file, 'utf-8')

  test('éditeur visuel (contenteditable) affiché par défaut, pas de textarea de code', () => {
    expect(src).toContain('contenteditable="true"')
    expect(src).toMatch(/const modeCode = ref\(false\)/)
    expect(src).toMatch(/<textarea\s+v-if="modeCode"/)
  })

  test('barre de mise en forme : gras, italique, souligné, titre, listes, lien', () => {
    for (const cmd of ['bold', 'italic', 'underline', 'titre', 'insertUnorderedList', 'insertOrderedList']) {
      expect(src).toContain(`cmd: '${cmd}'`)
    }
    expect(src).toContain('ouvrirLien')
  })

  test('le contenu injecté dans la zone est assaini', () => {
    expect(src).toContain('sanitizeHtml(')
  })

  test('les boutons gardent la sélection (mousedown.prevent)', () => {
    const boutons = src.match(/<button[\s\S]*?>/g) || []
    const barre = boutons.filter((b) => b.includes('rt-btn') && !b.includes('rt-ok') && !b.includes('Annuler') && !b.includes('Retirer'))
    expect(barre.length).toBeGreaterThan(0)
    for (const b of barre) expect(b).toContain('@mousedown.prevent')
  })

  test('defines props and emits in script setup', () => {
    expect(src).toMatch(/defineProps\s*<\{.*value.*field.*\}>/)
    expect(src).toMatch(/defineEmits\s*<\{.*change.*\}>/)
  })
})
