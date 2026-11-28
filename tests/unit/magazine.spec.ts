import { test, expect } from '@playwright/test'
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { decouperVues, vueDeLaPage, libelleVue, numerosAffiches, imagePage, srcsetPage, dateParution, TAILLES_PAGE } from '../../utils/magazines.js'

/**
 * Magazine feuilletable (pages/magazine/, components/MagazineLiseuse.vue).
 * Les numéros sont listés dans utils/magazines.json par
 * scripts/ajouter-magazine.mjs, leurs pages sont dans public/magazines/<id>/.
 */

const ROOT = resolve(__dirname, '../..')
const liste = JSON.parse(readFileSync(resolve(ROOT, 'utils/magazines.json'), 'utf8'))

test.describe('utils/magazines — découpage en vues', () => {
  test('page simple : une page par vue', () => {
    expect(decouperVues(3, false)).toEqual([[1], [2], [3]])
  })

  test('double page, total pair : couverture seule à droite, dernière seule à gauche', () => {
    expect(decouperVues(8, true)).toEqual([[null, 1], [2, 3], [4, 5], [6, 7], [8, null]])
  })

  test('double page, total impair : la dernière page complète une double page', () => {
    expect(decouperVues(7, true)).toEqual([[null, 1], [2, 3], [4, 5], [6, 7]])
  })

  test('aucune page : aucune vue', () => {
    expect(decouperVues(0, true)).toEqual([])
  })

  test('vue d\'une page, libellés', () => {
    const vues = decouperVues(8, true)
    expect(vueDeLaPage(vues, 5)).toBe(2)
    expect(vueDeLaPage(vues, 99)).toBe(0)
    expect(libelleVue(vues[0], 8)).toBe('Page 1 sur 8')
    expect(libelleVue(vues[1], 8)).toBe('Pages 2–3 sur 8')
    expect(libelleVue(vues[4], 8)).toBe('Page 8 sur 8')
  })
})

test.describe('utils/magazines — numéros', () => {
  const exemple = { id: 'exemple', titre: 'Ex', parution: '2026-11-21', pages: 2, exemple: true }
  const hiver = { id: '2026-hiver', titre: 'Hiver', parution: '2026-12-01', pages: 2 }
  const automne = { id: '2026-automne', titre: 'Automne', parution: '2026-09-01', pages: 2 }

  test('le numéro d\'exemple est montré tant qu\'il n\'y a pas de vrai numéro', () => {
    expect(numerosAffiches([exemple]).map(n => n.id)).toEqual(['exemple'])
  })

  test('le premier vrai numéro masque l\'exemple ; le plus récent en tête', () => {
    expect(numerosAffiches([automne, exemple, hiver]).map(n => n.id)).toEqual(['2026-hiver', '2026-automne'])
  })

  test('adresses des images', () => {
    expect(imagePage(hiver, 3, 'l')).toBe('/magazines/2026-hiver/p003-l.webp')
    expect(srcsetPage(hiver, 1)).toBe('/magazines/2026-hiver/p001-s.webp 400w, /magazines/2026-hiver/p001-m.webp 1000w, /magazines/2026-hiver/p001-l.webp 1600w')
  })

  test('date de parution sans décalage de fuseau', () => {
    expect(dateParution('2027-03-01')).toBe('1 mars 2027')
  })
})

test.describe('public/magazines — fichiers des numéros', () => {
  test('chaque numéro listé a ses trois images par page', () => {
    expect(liste.length).toBeGreaterThan(0)
    for (const n of liste) {
      expect(n.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      expect(n.parution).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(n.largeur).toBeGreaterThan(0)
      expect(n.hauteur).toBeGreaterThan(0)
      for (let p = 1; p <= n.pages; p++) {
        for (const taille of Object.keys(TAILLES_PAGE)) {
          expect(existsSync(resolve(ROOT, 'public', imagePage(n, p, taille).slice(1))), `${n.id} page ${p} (${taille})`).toBe(true)
        }
      }
      if (n.pdf) expect(existsSync(resolve(ROOT, 'public', n.pdf.slice(1)))).toBe(true)
    }
  })

  test('les pages ne passent pas par la fonction serveur (quota Cloudflare)', () => {
    const config = readFileSync(resolve(ROOT, 'nuxt.config.ts'), 'utf8')
    expect(config).toMatch(/exclude:\s*\[[^\]]*'\/magazines\/\*'/)
  })
})
