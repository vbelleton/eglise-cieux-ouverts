import { test, expect } from '@playwright/test'
import { jourParis, estPerimee, slidesAffichees } from '../../utils/diaporama.js'
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
