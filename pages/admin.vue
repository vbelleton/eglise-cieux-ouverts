<template>
  <div class="admin-login-page">
    <div class="admin-login-card">
      <img src="/logo-nav.png" alt="Cieux Ouverts" class="admin-login-logo" />
      <h1>Administration</h1>

      <div v-if="error" class="admin-login-actions">
        <p class="admin-error">{{ error }}</p>
        <button class="btn-admin" @click="signOut">Se déconnecter</button>
      </div>

      <template v-else-if="!checking">
        <div v-if="user && !isAdmin && !isSetupMode" class="admin-login-actions">
          <p class="admin-error">Vous n'êtes pas autorisé à accéder à l'administration.</p>
          <button class="btn-admin" @click="signOut">Se déconnecter</button>
        </div>

        <div v-else-if="isSetupMode" class="admin-login-actions">
          <p class="admin-login-subtitle">Aucun administrateur configuré.</p>
          <button class="btn-admin" @click="setupFirstAdmin" :disabled="settingUp">
            {{ settingUp ? 'Configuration...' : 'Configurer l\'administration' }}
          </button>
        </div>

        <div v-else class="admin-login-actions">
          <p class="admin-login-subtitle">Connectez-vous pour modifier le site</p>
          <template v-if="!user">
            <MessageConnexionSansJs />
            <form @submit.prevent="doEmailSubmit" class="admin-login-form js-only">
              <input v-model="loginEmailInput" type="email" placeholder="Email" required autocomplete="email" />
              <input
                v-if="loginMode !== 'reset'"
                v-model="loginPasswordInput"
                type="password"
                :placeholder="loginMode === 'register' ? 'Choisis un mot de passe' : 'Mot de passe'"
                required
                minlength="6"
                :autocomplete="loginMode === 'register' ? 'new-password' : 'current-password'"
              />
              <button type="submit" class="btn-admin" :disabled="authBusy">
                {{ loginMode === 'login' ? 'Se connecter' : loginMode === 'register' ? 'Créer mon compte' : 'Envoyer le lien' }}
              </button>
            </form>
            <p v-if="authFeedback" class="admin-login-feedback" :class="{ error: authFeedbackError }">{{ authFeedback }}</p>
            <div class="admin-login-links">
              <a v-if="loginMode !== 'login'" href="#" @click.prevent="switchLoginMode('login')">J'ai déjà un compte</a>
              <a v-if="loginMode !== 'register'" href="#" @click.prevent="switchLoginMode('register')">Créer un compte</a>
              <a v-if="loginMode !== 'reset'" href="#" @click.prevent="switchLoginMode('reset')">Mot de passe oublié ?</a>
            </div>
          </template>
          <button v-else class="btn-admin" @click="goAdmin">
            Accéder à l'éditeur →
          </button>
        </div>
      </template>

      <div v-else class="admin-checking">
        <span class="spinner"></span>
        Vérification de l'authentification...
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut as firebaseSignOut,
} from 'firebase/auth'

useSeoMeta({
  title: 'Administration — Église Cieux Ouverts',
  description: 'Connexion à l\'administration du site.',
})

const route = useRoute()
const { $auth } = useNuxtApp()
const user = ref(null)
const checking = ref(true)
const isAdmin = ref(false)
const isSetupMode = ref(false)
const error = ref('')
const settingUp = ref(false)

const redirectUrl = computed(() => route.query.redirect || '/?admin=true')

// Jamais désabonné auparavant : ce listener restait actif après la navigation
// (navigateTo plus bas) vers la page cible une fois connecté, et pouvait se
// redéclencher pendant que Vue démontait ce composant — corrompait l'état
// interne de Vue (crash "Cannot destructure property of null" en cascade,
// plus aucune interaction possible jusqu'à un hard refresh). Constaté en
// prod avec une vraie connexion Google, mais aussi reproduit en mock quand
// une session déjà authentifiée déclenche le callback de façon synchrone —
// Firebase peut appeler le callback AVANT que `onAuthStateChanged()` n'ait
// fini de retourner, donc `unsubscribe` n'est pas encore assigné au moment
// où le tout premier appel voudrait s'en servir. `navigated` (booléen simple,
// affecté de façon synchrone) protège indépendamment de cet ordre d'exécution.
let unsubscribe = null
let navigated = false

onMounted(() => {
  if (!$auth?.onAuthStateChanged) {
    checking.value = false
    return
  }
  unsubscribe = $auth.onAuthStateChanged(async (u) => {
    if (navigated) return
    user.value = u
    error.value = ''
    if (!u) {
      checking.value = false
      return
    }
    // Vérifier si l'utilisateur est admin
    try {
      const config = useRuntimeConfig()
      if (config.public?.TEST_ENV) {
        isAdmin.value = true
        isSetupMode.value = false
        checking.value = false
        navigated = true
        unsubscribe?.()
        // Rechargement complet plutôt que navigateTo() (SPA) : juste après la
        // résolution de l'auth, layouts/default.vue (persistant, ne remonte
        // pas) réagit *aussi* au changement de route via son propre watcher
        // sur route.query.admin, en parallèle du remplacement de cette page
        // par la cible — les deux cascades réactives concurrentes (bascule
        // des v-if AdminToolbar/MenuEditor + swap de page) ont fait planter
        // Vue en interne ("Cannot destructure property of null", plus aucune
        // interaction possible jusqu'à hard refresh). Un rechargement complet
        // ici (une fois, juste après connexion) est un compromis sûr — même
        // pattern déjà utilisé par AdminToolbar.vue pour ce type de
        // transition d'auth.
        window.location.href = redirectUrl.value
        return
      }
      const token = await u.getIdToken()
      const res = await fetch('/api/admin/check', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      if (navigated) return
      if (data.isAdmin) {
        isAdmin.value = true
        isSetupMode.value = false
        checking.value = false
        navigated = true
        unsubscribe?.()
        // Rechargement complet plutôt que navigateTo() (SPA) : juste après la
        // résolution de l'auth, layouts/default.vue (persistant, ne remonte
        // pas) réagit *aussi* au changement de route via son propre watcher
        // sur route.query.admin, en parallèle du remplacement de cette page
        // par la cible — les deux cascades réactives concurrentes (bascule
        // des v-if AdminToolbar/MenuEditor + swap de page) ont fait planter
        // Vue en interne ("Cannot destructure property of null", plus aucune
        // interaction possible jusqu'à hard refresh). Un rechargement complet
        // ici (une fois, juste après connexion) est un compromis sûr — même
        // pattern déjà utilisé par AdminToolbar.vue pour ce type de
        // transition d'auth.
        window.location.href = redirectUrl.value
        return
      }
      // Si setupMode pas dans la réponse (ancien déploiement),
      // on teste /api/admin/exists (sans auth, fiable en tout temps)
      if (data.setupMode === true || data.setupMode === undefined) {
        try {
          const existsRes = await fetch('/api/admin/exists')
          const existsData = await existsRes.json()
          isSetupMode.value = !existsData.exists
        } catch {
          isSetupMode.value = true
        }
      } else {
        isSetupMode.value = false
      }
      isAdmin.value = false
      checking.value = false
    } catch {
      isAdmin.value = false
      isSetupMode.value = false
      checking.value = false
    }
  })
})

onUnmounted(() => {
  unsubscribe?.()
})

const loginMode = ref('login') // 'login' | 'register' | 'reset'
const loginEmailInput = ref('')
const loginPasswordInput = ref('')
const authBusy = ref(false)
const authFeedback = ref('')
const authFeedbackError = ref(false)

function switchLoginMode(m) {
  loginMode.value = m
  authFeedback.value = ''
}

function authErrorMessage(e) {
  const code = e?.code || ''
  if (code.includes('user-not-found') || code.includes('invalid-credential')) return 'Email ou mot de passe incorrect.'
  if (code.includes('wrong-password')) return 'Mot de passe incorrect.'
  if (code.includes('email-already-in-use')) return 'Un compte existe déjà avec cet email. Connecte-toi.'
  if (code.includes('weak-password')) return 'Mot de passe trop court (6 caractères minimum).'
  if (code.includes('invalid-email')) return 'Adresse email invalide.'
  return 'Une erreur est survenue. Réessaie.'
}

async function doEmailSubmit() {
  authBusy.value = true
  authFeedback.value = ''
  authFeedbackError.value = false
  try {
    if (loginMode.value === 'login') {
      await signInWithEmailAndPassword($auth, loginEmailInput.value, loginPasswordInput.value)
    } else if (loginMode.value === 'register') {
      await createUserWithEmailAndPassword($auth, loginEmailInput.value, loginPasswordInput.value)
    } else {
      await sendPasswordResetEmail($auth, loginEmailInput.value)
      authFeedback.value = 'Email de réinitialisation envoyé — vérifie ta boîte mail.'
      loginMode.value = 'login'
    }
  } catch (e) {
    authFeedbackError.value = true
    authFeedback.value = authErrorMessage(e)
  } finally {
    authBusy.value = false
  }
}

async function signOut() {
  try {
    await firebaseSignOut($auth)
  } catch (e) {
    console.error('Sign out error:', e)
  }
}

async function setupFirstAdmin() {
  settingUp.value = true
  try {
    const token = await user.value?.getIdToken()
    if (!token) throw new Error('Non authentifié')
    const res = await fetch('/api/admin/setup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || `HTTP ${res.status}`)
    }
    isAdmin.value = true
    isSetupMode.value = false
    navigated = true
    unsubscribe?.()
    window.location.href = redirectUrl.value
  } catch (e) {
    error.value = e.message || 'Erreur de configuration'
  } finally {
    settingUp.value = false
  }
}

function goAdmin() {
  navigated = true
  unsubscribe?.()
  window.location.href = redirectUrl.value
}
</script>

<style scoped>
.admin-login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #064886 0%, #d97777 100%);
  padding: 40px 20px;
}
.admin-login-card {
  max-width: 420px;
  width: 100%;
  background: white;
  border-radius: 16px;
  padding: 48px 32px;
  box-shadow: 0 8px 40px rgba(0,0,0,0.15);
  text-align: center;
}
.admin-login-logo {
  width: 80px;
  height: 80px;
  object-fit: contain;
  margin-bottom: 16px;
}
.admin-login-card h1 {
  font-family: var(--font-heading);
  font-size: 28px;
  color: #064886;
  margin: 0 0 4px;
}
.admin-login-subtitle {
  color: #888;
  font-size: 0.9em;
  margin: 0 0 32px;
}
.admin-error {
  color: #d32f2f;
  font-size: 0.9em;
  margin: 16px 0;
}
.admin-login-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
  width: 100%;
}
.admin-login-form {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  width: 100%;
}
.admin-login-form input {
  padding: 0.7rem 0.9rem;
  border: 1px solid #ddd;
  border-radius: 10px;
  font-size: 0.95rem;
}
.admin-login-feedback {
  margin: 0;
  font-size: 0.85rem;
  color: #2e7d32;
}
.admin-login-feedback.error {
  color: #c62828;
}
.admin-login-links {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 1rem;
  font-size: 0.82rem;
}
.admin-login-links a {
  color: #666;
  text-decoration: underline;
}
.btn-admin {
  display: inline-block;
  padding: 14px 32px;
  background: #064886;
  color: white;
  border-radius: 50px;
  font-size: 1em;
  font-weight: 700;
  text-decoration: none;
  border: none;
  cursor: pointer;
  transition: transform 0.2s;
}
.btn-admin:hover {
  transform: translateY(-2px);
}
.admin-checking {
  color: #888;
  font-size: 0.9em;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.spinner {
  width: 18px;
  height: 18px;
  border: 2px solid #ddd;
  border-top-color: #064886;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
