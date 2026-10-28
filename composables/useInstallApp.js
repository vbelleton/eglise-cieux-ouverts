import { ref, computed } from "vue";

// Installation de l'application (PWA) sur l'écran d'accueil.
//
// Chrome/Edge/Android émettent `beforeinstallprompt` quand le site est
// installable : on garde l'événement pour déclencher la proposition depuis
// notre propre bouton (plugins/pwa.client.ts le capture). Safari sur iPhone
// n'a pas d'API : on ne peut qu'expliquer la marche à suivre (Partager →
// « Sur l'écran d'accueil »).
const invitation = ref(null);
const dejaInstallee = ref(false);
const estIos = ref(false);

export function capturerInvitation(evenement) {
  evenement.preventDefault();
  invitation.value = evenement;
}

export function initialiserEtatInstallation() {
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches
    || window.navigator.standalone === true;
  dejaInstallee.value = Boolean(standalone);
  const ua = window.navigator.userAgent || "";
  // iPadOS se présente comme un Mac : on le reconnaît à l'écran tactile.
  estIos.value = /iPhone|iPad|iPod/.test(ua)
    || (/Macintosh/.test(ua) && window.navigator.maxTouchPoints > 1);
}

export function marquerInstallee() {
  dejaInstallee.value = true;
  invitation.value = null;
}

export function useInstallApp() {
  const peutProposer = computed(() => !dejaInstallee.value && Boolean(invitation.value));
  const aideIos = computed(() => !dejaInstallee.value && !invitation.value && estIos.value);

  async function installer() {
    const evenement = invitation.value;
    if (!evenement) return false;
    invitation.value = null;
    evenement.prompt();
    const { outcome } = await evenement.userChoice;
    if (outcome === "accepted") dejaInstallee.value = true;
    return outcome === "accepted";
  }

  return { peutProposer, aideIos, dejaInstallee, installer };
}
