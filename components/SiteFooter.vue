<template>
  <footer class="site-footer">
    <div class="footer-inner">
      <div class="footer-left">
        <h2 class="footer-title">
          <span 
            v-for="(char, i) in titleChars" 
            :key="i" 
            class="shutter-char"
            :class="[char === ' ' ? 'space' : '', { 'place-bold': i >= 10 && i <= 14 }]"
            :style="getShutterStyle(i)"
          >
            {{ char === ' ' ? '\u00A0' : char }}
          </span>
        </h2>
      </div>
      
      <div class="footer-right">
        <div class="footer-info">
          <a href="mailto:contact@cieuxouverts.bzh" class="footer-email">contact@cieuxouverts.bzh</a>
          <p>Rdv chaque dimanche | <strong>10H</strong></p>
          <p>2 rue Jean Monnet | <strong>29600 Morlaix, Bretagne</strong></p>
        </div>
      </div>
    </div>
  </footer>
</template>

<script setup>
const titleChars = "Il y a une place pour toi !".split('')

// Chaque lettre apparaît pendant l'entrée du pied de page dans l'écran
// (`entry`), toujours entièrement parcourue : le pied de page est le dernier
// élément, on finit forcément par le voir en entier. Les plages étaient en
// `cover`, dont le bout n'est jamais atteint en bas de page : sur un écran
// haut (MacBook, 1920×1080), les dernières lettres (« oi ! ») restaient
// figées en cours d'animation, donc invisibles.
function getShutterStyle(i) {
  const total = titleChars.length
  const pas = total > 1 ? 65 / (total - 1) : 0
  const d = i * pas
  return {
    '--shutter-d': `${d}%`,
    '--shutter-e': `${d + 30}%`,
    '--shutter-delay': `${(i * 15 / total) * 0.14}s`,
  }
}
</script>

<style scoped>
.site-footer {
  background: linear-gradient(to bottom, #064886 0%, #064886 24%, #5a9fcf 100%);
  color: white;
  position: relative;
  overflow: hidden;
  view-timeline-name: --footer;
  view-timeline-axis: block;
}

  .footer-inner {
    max-width: 1200px;
    margin: 0 auto;
    padding: 28px 24px 22px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 40px;
  }

.footer-left {
  flex: 1;
}

.footer-title {
  font-family: var(--font-body);
  font-size: 24px;
  font-weight: 400;
  color: #ffffff;
  margin: 0;
  white-space: nowrap;
}

.shutter-char {
  display: inline-block;
  clip-path: inset(0 0 0 0);
  opacity: 1;
}

@supports (animation-timeline: scroll()) {
  @media (prefers-reduced-motion: no-preference) {
    .shutter-char {
      overflow: hidden;
      clip-path: inset(0 100% 0 0);
      opacity: 0;
      animation-name: reveal;
      animation-timeline: --footer;
      animation-range: entry var(--shutter-d) entry var(--shutter-e);
      animation-fill-mode: both;
    }
  }
}

@keyframes reveal {
  0%, 3% { clip-path: inset(0 100% 0 0); opacity: 0; }
  6%, 25% { clip-path: inset(0 0 0 0); opacity: 1; }
  28%, 50% { clip-path: inset(0 100% 0 0); opacity: 0; }
  53%, 100% { clip-path: inset(0 0 0 0); opacity: 1; }
}

.space {
  display: inline-block;
  width: 0.35em;
}

.place-bold {
  font-weight: 700;
}

.footer-right {
  flex: 1;
  display: flex;
  justify-content: flex-end;
}

.footer-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 19px;
  font-weight: 700;
  color: white;
  text-align: left;
  font-family: var(--font-body);
}

.footer-email {
  color: white;
  font-weight: 700;
  text-decoration: none;
  margin-bottom: 4px;
  font-size: 19px;
  display: block;
}

.footer-email:hover {
  text-decoration: underline;
}

.footer-email:focus-visible {
  outline: 2px solid #ffffff;
  outline-offset: 3px;
  border-radius: 4px;
}

.footer-info p {
  color: white;
  line-height: 1.6;
  margin: 0;
}

.footer-info strong {
  font-weight: 700;
  color: #f7fbff;
}

@media (prefers-reduced-motion: reduce) {
  .shutter-char {
    animation: none !important;
    clip-path: inset(0 0 0 0) !important;
    opacity: 1 !important;
  }
}

  @media (max-width: 768px) {
  .site-footer {
    background: linear-gradient(180deg, #d46269 0%, #be4f56 100%);
    min-height: 0;
  }
  .footer-inner {
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 16px;
    padding: 20px 10px 16px;
  }
  .footer-right {
    justify-content: center;
  }
  .footer-info {
    text-align: center;
    font-size: 0.92em;
  }
  .footer-title {
    white-space: normal;
    font-size: 24px;
    text-align: center;
  }
  .footer-email {
    margin-bottom: 4px;
    font-size: 1em;
  }
}
</style>
