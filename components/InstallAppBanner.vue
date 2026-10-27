<template>
  <aside v-if="visible" class="install-app" aria-label="Installer l'application">
    <img src="/favicon-192.png" alt="" width="40" height="40" class="install-app__icone">
    <div class="install-app__texte">
      <p class="install-app__titre">Cieux Ouverts sur votre téléphone</p>
      <p v-if="peutProposer" class="install-app__detail">Ajoutez le site à votre écran d'accueil, il reste consultable même sans réseau.</p>
      <p v-else class="install-app__detail">
        Sur iPhone : touchez <strong>Partager</strong>
        <svg class="install-app__partager" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5M5 12v8h14v-8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        puis <strong>« Sur l'écran d'accueil »</strong>.
      </p>
    </div>
    <button v-if="peutProposer" type="button" class="install-app__bouton" @click="installer">Installer</button>
    <button type="button" class="install-app__fermer" aria-label="Ne plus proposer" @click="masquer">×</button>
  </aside>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useInstallApp } from "~/composables/useInstallApp";

// Proposition d'installation (PWA), au-dessus du pied de page. N'apparaît que
// si le navigateur la permet (Chrome/Android) ou sur iPhone/iPad, jamais une
// fois l'application installée ni après « × » (mémorisé sur l'appareil).
const CLE = "pwa-banniere-masquee";
const { peutProposer, aideIos, installer } = useInstallApp();
const masquee = ref(true);

onMounted(() => {
  try { masquee.value = localStorage.getItem(CLE) === "1"; } catch { masquee.value = false; }
});

const visible = computed(() => !masquee.value && (peutProposer.value || aideIos.value));

function masquer() {
  masquee.value = true;
  try { localStorage.setItem(CLE, "1"); } catch {}
}
</script>

<style scoped>
.install-app {
  display: flex;
  align-items: center;
  gap: 14px;
  max-width: 720px;
  margin: 32px auto;
  padding: 14px 16px;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 2px 14px rgba(6, 72, 134, 0.1);
  font-family: var(--font-body);
}
@media (max-width: 760px) {
  .install-app { margin: 24px 16px; }
}
.install-app__icone { flex: none; border-radius: 10px; }
.install-app__texte { flex: 1; min-width: 0; }
.install-app__titre { margin: 0 0 2px; font-weight: 600; color: var(--primary-blue); }
.install-app__detail { margin: 0; font-size: 0.9rem; line-height: 1.4; color: #4b5563; }
.install-app__partager { width: 1em; height: 1em; vertical-align: -0.12em; color: #0a84ff; }
.install-app__bouton {
  flex: none;
  padding: 9px 18px;
  border: 0;
  border-radius: 999px;
  background: var(--primary-blue);
  color: #fff;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
.install-app__fermer {
  flex: none;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: #6b7280;
  font-size: 1.4rem;
  line-height: 1;
  cursor: pointer;
}
.install-app__fermer:hover { background: #f3f4f6; }
.install-app__bouton:focus-visible,
.install-app__fermer:focus-visible { outline: 3px solid var(--primary-pink); outline-offset: 2px; }
</style>
