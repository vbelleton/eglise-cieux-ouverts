import { test, expect } from '@playwright/test'
import { lienSur, sourceSure, estInterne } from '../../utils/safeLink.js'

test.describe('Liens et sources des nouveaux blocs', () => {
  test('lienSur accepte les liens normaux et refuse javascript:', () => {
    for (const u of ['/contact', '#haut', 'https://exemple.fr/don', 'mailto:a@b.fr', 'tel:+33123456789']) {
      expect(lienSur(u)).toBeTruthy()
    }
    for (const u of ['javascript:alert(1)', ' JaVaScRiPt:alert(1)', 'data:text/html,x', 'vbscript:x', '']) {
      expect(lienSur(u)).toBeFalsy()
    }
  })

  test('sourceSure refuse les schémas autres que http(s) et chemins', () => {
    expect(sourceSure('/test-img.gif')).toBeTruthy()
    expect(sourceSure('https://x.fr/a.mp3')).toBeTruthy()
    expect(sourceSure('javascript:alert(1)')).toBeFalsy()
    expect(sourceSure('data:text/html,x')).toBeFalsy()
    expect(sourceSure('//evil.example/x')).toBeFalsy()
  })

  test('estInterne distingue chemins et URL externes', () => {
    expect(estInterne('/contact')).toBe(true)
    expect(estInterne('https://x.fr')).toBe(false)
  })
})
