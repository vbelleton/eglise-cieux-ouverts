import { test, expect } from '@playwright/test'
import { resolveResponsive } from '../../lib/blocks/renderer'
import { champsCommuns } from '../../utils/blockTypes.js'

/**
 * La vidéo YouTube est la même sur tous les formats. Une surcharge « mobile »
 * de `videoId`, enregistrée un jour en modifiant le bloc en mode Mobile, faisait
 * afficher l'ancienne vidéo sur téléphone après tout changement fait sur
 * ordinateur. Elle doit être ignorée ; les vraies surcharges, conservées.
 */
test.describe('champs communs à tous les formats', () => {
  test('videoId et title de la vidéo sont communs', () => {
    const c = champsCommuns('youtube')
    expect(c.has('videoId')).toBe(true)
    expect(c.has('title')).toBe(true)
    expect(c.has('backgroundColor')).toBe(false)
  })

  test('une surcharge mobile de la vidéo est ignorée, les autres appliquées', () => {
    const bloc: any = {
      id: 'y1',
      type: 'youtube',
      props: { videoId: 'NOUVELLE123', title: 'Message', backgroundColor: '#fff' },
      responsive: { mobile: { videoId: 'ANCIENNE12', backgroundColor: '#000' } },
    }
    const mobile = resolveResponsive(bloc, 'mobile')
    expect(mobile.props.videoId).toBe('NOUVELLE123')
    expect(mobile.props.backgroundColor).toBe('#000')
  })

  test('les surcharges des autres blocs restent par format', () => {
    const bloc: any = {
      id: 'b1',
      type: 'bienvenue',
      props: { title: 'Ordinateur' },
      responsive: { mobile: { title: 'Téléphone' } },
    }
    expect(resolveResponsive(bloc, 'mobile').props.title).toBe('Téléphone')
  })
})
