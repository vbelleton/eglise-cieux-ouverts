import { watch } from 'vue'
import { useAdmin } from '~/composables/useAdmin'
import { capturerInvitation, initialiserEtatInstallation, marquerInstallee } from '~/composables/useInstallApp'

/**
 * Application installable et hors ligne (PWA) : enregistre public/sw.js et
 * capte la proposition d'installation du navigateur.
 *
 * Le service worker ne sert jamais l'admin depuis le cache (voir l'en-tête de
 * public/sw.js) ; il reconnaît seul `/admin`, `?admin=true` et
 * `preview-inner`, et ce plugin lui signale en plus chaque bascule de
 * `isAdminMode`, au cas où le mode admin serait actif sans ces marqueurs.
 *
 * Pas d'enregistrement en dev (HMR) ni pendant les tests E2E (`TEST_ENV`),
 * où un cache entre deux tests fausserait le mock Firestore — sauf si un
 * test le demande explicitement via `localStorage['pwa-test'] = '1'`
 * (tests/playwright/pwa.spec.ts).
 */
export default defineNuxtPlugin(() => {
  initialiserEtatInstallation()
  window.addEventListener('beforeinstallprompt', capturerInvitation)
  window.addEventListener('appinstalled', marquerInstallee)

  if (!('serviceWorker' in navigator)) return
  if (import.meta.dev) return
  let forceTest = false
  try { forceTest = localStorage.getItem('pwa-test') === '1' } catch {}
  if (useRuntimeConfig().public.TEST_ENV && !forceTest) return

  const { isAdminMode } = useAdmin()
  const signalerAdmin = (actif: boolean) => {
    navigator.serviceWorker.controller?.postMessage({ type: 'admin-mode', actif })
  }
  watch(isAdminMode, v => signalerAdmin(Boolean(v)), { immediate: true })
  // Un service worker qui prend le contrôle en cours de route (première
  // installation, mise à jour) n'a pas reçu l'état courant.
  navigator.serviceWorker.addEventListener('controllerchange', () => signalerAdmin(Boolean(isAdminMode.value)))

  const enregistrer = () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((e) => {
      console.warn('pwa: enregistrement du service worker impossible', e)
    })
  }
  if (document.readyState === 'complete') enregistrer()
  else window.addEventListener('load', enregistrer, { once: true })
})
