import { useAdmin } from '~/composables/useAdmin'

/**
 * Relance les animations pilotées au scroll d'une page atteinte par
 * navigation interne.
 *
 * Au premier chargement, la page arrive par le HTML serveur et ses animations
 * (animation-timeline: view() ou timeline nommée — titre « Bienvenue »,
 * blocs à entrée animée…) s'accrochent normalement au défilement. Sur une
 * navigation interne, Vue insère la page dans un conteneur encore en pleine
 * transition (.page-enter-from : opacity 0 + transform) : une animation créée
 * à cet instant peut rester bloquée en attente (`pending`, currentTime null),
 * figée sur sa première image — même mécanisme que celui décrit dans
 * relanceAnimationsApercu (composables/useBlockAnimation.js). Les keyframes
 * partant de opacity 0, le contenu restait invisible : « Bienvenue »
 * s'affichait à l'arrivée sur le site mais plus en revenant sur l'accueil.
 *
 * Une fois la transition terminée, chaque animation de scroll du document est
 * annulée puis relancée, ce qui la rattache à sa timeline : sa progression se
 * recalcule d'après la position réelle de l'élément. Sans effet visible sur
 * une animation qui fonctionnait déjà (même progression, même image).
 *
 * Les animations sur base temporelle (DocumentTimeline) ne sont pas touchées :
 * les relancer rejouerait une entrée déjà vue. L'admin est exclu : ses aperçus
 * d'animation (.anim-rejeu) ont leur propre relance.
 */
export default defineNuxtPlugin((nuxtApp) => {
  const { isAdminMode } = useAdmin()

  function relanceAnimationsScroll() {
    if (isAdminMode.value) return
    if (!document.getAnimations) return
    for (const a of document.getAnimations()) {
      const timeline = a.timeline
      if (!timeline || timeline instanceof DocumentTimeline) continue
      try {
        a.cancel()
        a.play()
      } catch {}
    }
  }

  // `page:transition:finish` est émis à la fin de la SORTIE de l'ancienne page
  // (mode out-in) : la nouvelle page est alors insérée et commence son
  // entrée. On attend que celle-ci soit terminée (plus aucune classe
  // .page-enter-*) avant de relancer, avec une limite au cas où.
  nuxtApp.hook('page:transition:finish', () => {
    let images = 0
    const attendFinEntree = () => {
      images++
      const enCours = document.querySelector('.page-enter-from, .page-enter-active, .page-enter-to')
      if ((images < 3 || enCours) && images < 180) {
        requestAnimationFrame(attendFinEntree)
        return
      }
      relanceAnimationsScroll()
    }
    requestAnimationFrame(attendFinEntree)
  })
})
