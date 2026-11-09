import { test, expect } from '@playwright/test'
import { readFileSync } from 'fs'
import { resolve } from 'path'

/**
 * Le Worker eglise-app ne renvoie que 25 événements par défaut, triés par
 * date : sans `size`, tout événement au-delà du 25e disparaissait du site
 * (et de l'écran admin) sans erreur. Maximum accepté par le Worker : 100.
 */
for (const fichier of ['composables/useChurchEvents.js', 'components/admin/EventManager.vue']) {
  test(`${fichier} demande la liste complète des événements`, () => {
    const src = readFileSync(resolve(process.cwd(), fichier), 'utf8')
    expect(src).toContain('/api/church-events?include_exceptions=1&size=100')
  })
}
