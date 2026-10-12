<template>
  <div class="membre-page">
    <!-- Connexion -->
    <div v-if="!isLoggedIn" class="login-wrap">
      <div class="login-card">
        <h1>Espace membre</h1>
        <p class="login-intro">Connecte-toi pour accéder à tes ressources, tes demandes et tes événements.</p>

        <form @submit.prevent="doEmailSubmit" class="login-form">
          <input v-model="email" type="email" placeholder="Email" required autocomplete="email" />
          <input v-if="mode !== 'reset'" v-model="password" type="password" :placeholder="mode === 'register' ? 'Choisis un mot de passe' : 'Mot de passe'" required minlength="6" :autocomplete="mode === 'register' ? 'new-password' : 'current-password'" />
          <button type="submit" class="btn-primary" :disabled="busy">
            {{ mode === 'login' ? 'Se connecter' : mode === 'register' ? 'Créer mon compte' : 'Envoyer le lien' }}
          </button>
        </form>

        <p v-if="feedback" class="login-feedback" :class="{ error: feedbackError }">{{ feedback }}</p>

        <div class="login-links">
          <a v-if="mode !== 'login'" href="#" @click.prevent="switchMode('login')">J'ai déjà un compte</a>
          <a v-if="mode !== 'register'" href="#" @click.prevent="switchMode('register')">Créer un compte</a>
          <a v-if="mode !== 'reset'" href="#" @click.prevent="switchMode('reset')">Mot de passe oublié ?</a>
        </div>
      </div>
    </div>

    <!-- Dashboard membre -->
    <div v-else class="dashboard">
      <header class="dash-header">
        <div>
          <h1>Bonjour {{ firstName }} 👋</h1>
          <p v-if="profile?.teams?.length" class="dash-teams">
            {{ profile.teams.map((t) => t.name + (t.position ? ' · ' + t.position : '')).join(' — ') }}
          </p>
        </div>
        <button class="btn-logout" @click="doLogout">Se déconnecter</button>
      </header>

      <nav class="dash-tabs" role="tablist">
        <button
          v-for="t in orderedTabs"
          :key="t.key"
          :class="{ active: tab === t.key }"
          @click="tab = t.key"
          role="tab"
        >
          {{ t.icon }} {{ t.label }}
          <span v-if="t.badge()" class="badge">{{ t.badge() }}</span>
        </button>
      </nav>

      <!-- Ressources -->
      <section v-if="tab === 'ressources'" class="dash-section">
        <p v-if="loadingResources" class="dash-loading">Chargement…</p>
        <p v-else-if="resources.length === 0" class="dash-empty">Aucune ressource partagée avec toi pour l'instant.</p>
        <div v-else class="resource-list">
          <article v-for="r in resources" :key="r.id" class="resource-card" @click="openResource(r)">
            <div class="resource-body">
              <h3>
                {{ r.title }}
                <span v-if="!r.first_accessed_at" class="badge-new">Nouveau</span>
              </h3>
              <p v-if="r.description">{{ r.description }}</p>
              <p class="resource-meta">
                Partagé par {{ r.shared_by_first }} {{ r.shared_by_last }}
                <span v-if="r.expires_at"> · expire le {{ formatDate(r.expires_at) }}</span>
              </p>
            </div>
            <span class="resource-open">Ouvrir ↗</span>
          </article>
        </div>
      </section>

      <!-- Demandes -->
      <section v-else-if="tab === 'demandes'" class="dash-section">
        <p v-if="loadingRequests" class="dash-loading">Chargement…</p>
        <p v-else-if="requests.length === 0" class="dash-empty">Aucune demande pour l'instant.</p>
        <div v-else class="request-list">
          <article v-for="r in requests" :key="r.id" class="request-card">
            <div class="request-body">
              <p v-if="r.kind === 'admin_request'" class="request-from">
                Demande de {{ r.created_by_first || 'l\'équipe' }} {{ r.created_by_last || '' }}
              </p>
              <p v-else class="request-from">Ma candidature — {{ r.position_label }}</p>
              <p class="request-msg">{{ r.message }}</p>
              <p v-if="r.position_label && r.kind === 'admin_request'" class="request-meta">
                {{ r.position_label }}<span v-if="r.event_date"> · {{ formatDate(r.event_date) }}</span>
              </p>
              <p v-if="r.response_note" class="request-note">« {{ r.response_note }} »</p>
            </div>
            <div class="request-actions">
              <span class="status-pill" :class="'status-' + r.status">{{ statusLabel(r.status) }}</span>
              <template v-if="r.kind === 'admin_request' && r.status === 'pending'">
                <button class="btn-accept" @click="respond(r, 'accepted')">Accepter</button>
                <button class="btn-decline" @click="respond(r, 'declined')">Refuser</button>
              </template>
            </div>
          </article>
        </div>
      </section>

      <!-- Mes événements -->
      <section v-else class="dash-section">
        <p v-if="loadingEvents" class="dash-loading">Chargement…</p>
        <p v-else-if="myEvents.length === 0" class="dash-empty">
          Tu n'es inscrit·e à aucun événement pour l'instant.
        </p>
        <div v-else class="event-list">
          <article v-for="e in myEvents" :key="e.participation_id" class="event-card-m">
            <div class="event-body">
              <h3>{{ e.title }}</h3>
              <p class="event-meta">
                📆 {{ formatDate(e.occurrence_date || e.start_date) }}
                <span v-if="e.start_time"> · 🕐 {{ e.start_time }}</span>
                <span v-if="e.location"> · 📍 {{ e.location }}</span>
              </p>
            </div>
            <div class="attendance-btns">
              <button :class="{ active: e.attendance_status === 'present' }" @click="setAttendance(e, 'present')">✓ Présent</button>
              <button :class="{ active: e.attendance_status === 'maybe' }" @click="setAttendance(e, 'maybe')">? Peut-être</button>
              <button :class="{ active: e.attendance_status === 'absent' }" @click="setAttendance(e, 'absent')">✗ Absent</button>
            </div>
          </article>
        </div>
        <p class="event-hint">Retrouve aussi tes événements en surbrillance dans <NuxtLink to="/agenda">l'agenda</NuxtLink>.</p>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'

useSeoMeta({
  title: 'Espace membre — Église Cieux Ouverts',
  description: 'Espace personnel des membres : ressources partagées, demandes et événements.',
  robots: 'noindex',
})

// Espace membre désactivé dans ⚙️ Config (défaut) : redirection vers
// l'accueil, décidée par middleware/espace-membre.ts avant le rendu.
definePageMeta({ middleware: 'espace-membre' })

const {
  isLoggedIn, profile, firstName, authReady,
  authedFetch, fetchProfile, loginEmail, registerEmail, resetPassword, logout,
} = useMemberAuth()

// --- Connexion ---
const mode = ref('login') // 'login' | 'register' | 'reset'
const email = ref('')
const password = ref('')
const busy = ref(false)
const feedback = ref('')
const feedbackError = ref(false)

function switchMode(m) {
  mode.value = m
  feedback.value = ''
}

function authErrorMessage(e) {
  const code = e?.code || ''
  if (code.includes('user-not-found') || code.includes('invalid-credential')) return 'Email ou mot de passe incorrect.'
  if (code.includes('wrong-password')) return 'Mot de passe incorrect.'
  if (code.includes('email-already-in-use')) return 'Un compte existe déjà avec cet email. Connecte-toi.'
  if (code.includes('weak-password')) return 'Mot de passe trop court (6 caractères minimum).'
  if (code.includes('invalid-email')) return 'Adresse email invalide.'
  if (code.includes('popup-closed')) return 'Connexion annulée.'
  // Erreurs Firebase/Auth problématiques
  if (!e?.message) return 'Erreur de connexion. Vérifie ta connexion internet.'
  if (!e?.code) return 'Erreur de connexion. Réessaie plus tard.'
  return 'Une erreur est survenue: ' + (e.message || 'Réessaie.')
}

async function doEmailSubmit() {
  busy.value = true
  feedback.value = ''
  feedbackError.value = false
  try {
    if (mode.value === 'login') {
      await loginEmail(email.value, password.value)
    } else if (mode.value === 'register') {
      await registerEmail(email.value, password.value)
    } else {
      await resetPassword(email.value)
      feedback.value = 'Email de réinitialisation envoyé — vérifie ta boîte mail.'
      mode.value = 'login'
    }
  } catch (e) {
    feedbackError.value = true
    feedback.value = authErrorMessage(e)
  } finally {
    busy.value = false
  }
}

async function doLogout() {
  await logout()
  tab.value = orderedTabs.value[0]?.key || 'ressources'
}

// --- Dashboard ---
const tab = ref('ressources')
const resources = ref([])
const requests = ref([])
const myEvents = ref([])
const loadingResources = ref(false)
const loadingRequests = ref(false)
const loadingEvents = ref(false)

// Ordre des onglets réglable depuis l'admin (modale Configuration) —
// composable partagé avec SiteHeader/BlockContact (useSiteSettings.js).
const { memberTabOrder, loadSiteSettings } = useSiteSettings()
const MEMBER_TAB_META = {
  ressources: { icon: '📚', label: 'Ressources', badge: () => profile.value?.unread_resources },
  demandes: { icon: '🙋', label: 'Demandes', badge: () => profile.value?.pending_requests },
  evenements: { icon: '📅', label: 'Mes événements', badge: () => null },
}
const orderedTabs = computed(() =>
  memberTabOrder.value
    .filter((key) => MEMBER_TAB_META[key])
    .map((key) => ({ key, ...MEMBER_TAB_META[key] })),
)

function formatDate(d) {
  if (!d) return ''
  try {
    return new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  } catch {
    return d
  }
}

function statusLabel(s) {
  return { pending: 'En attente', accepted: 'Acceptée', declined: 'Refusée', cancelled: 'Annulée' }[s] || s
}

async function loadResources() {
  loadingResources.value = true
  try {
    const res = await authedFetch('/api/member/resources')
    resources.value = res?.data || []
  } catch (e) {
    console.warn('membre: chargement ressources échoué', e)
  } finally {
    loadingResources.value = false
  }
}

async function loadRequests() {
  loadingRequests.value = true
  try {
    const res = await authedFetch('/api/member/requests')
    requests.value = res?.data || []
  } catch (e) {
    console.warn('membre: chargement demandes échoué', e)
  } finally {
    loadingRequests.value = false
  }
}

async function loadEvents() {
  loadingEvents.value = true
  try {
    const res = await authedFetch('/api/member/events')
    myEvents.value = res?.data || []
  } catch (e) {
    console.warn('membre: chargement événements échoué', e)
  } finally {
    loadingEvents.value = false
  }
}

// Consultation : log l'accès PUIS ouvre le lien (tracking automatique)
async function openResource(r) {
  try {
    const res = await authedFetch(`/api/member/resources/${r.id}/access`, { method: 'POST' })
    if (!r.first_accessed_at) r.first_accessed_at = new Date().toISOString()
    r.access_count = (r.access_count || 0) + 1
    fetchProfile() // met à jour le badge "non lus"
    if (res?.url) window.open(res.url, '_blank', 'noopener')
  } catch (e) {
    console.warn('membre: consultation échouée', e)
  }
}

async function respond(r, status) {
  try {
    const updated = await authedFetch(`/api/member/requests/${r.id}/respond`, {
      method: 'POST',
      body: { status },
    })
    Object.assign(r, updated)
    fetchProfile()
    if (status === 'accepted' && r.event_id) loadEvents()
  } catch (e) {
    console.warn('membre: réponse échouée', e)
  }
}

async function setAttendance(e, status) {
  const previous = e.attendance_status
  e.attendance_status = status // optimiste
  try {
    await authedFetch(`/api/member/events/${e.event_id}/attendance`, {
      method: 'POST',
      body: { status, occurrence_date: e.occurrence_date || undefined },
    })
  } catch (err) {
    e.attendance_status = previous
    console.warn('membre: présence échouée', err)
  }
}

function loadAll() {
  loadResources()
  loadRequests()
  loadEvents()
}

watch(isLoggedIn, (v) => {
  if (v) loadAll()
})

onMounted(() => {
  // Onglet actif par défaut = premier de l'ordre configuré (peut différer
  // de 'ressources' si l'admin a réordonné) — seulement au tout premier
  // montage, avant toute interaction de l'utilisateur avec les onglets.
  loadSiteSettings().then(() => {
    if (orderedTabs.value[0]) tab.value = orderedTabs.value[0].key
  })
  if (isLoggedIn.value) loadAll()
})
</script>

<style scoped>
.membre-page {
  min-height: 70vh;
  padding: 7rem 1.5rem 4rem;
  max-width: 860px;
  margin: 0 auto;
  font-family: var(--font-body, sans-serif);
}

/* --- Connexion --- */
.login-wrap {
  display: flex;
  justify-content: center;
  padding-top: 2rem;
}
.login-card {
  width: 100%;
  max-width: 400px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.08);
  padding: 2.5rem 2rem;
  text-align: center;
}
.login-card h1 {
  font-family: var(--font-heading, serif);
  font-size: 1.6rem;
  margin-bottom: 0.5rem;
}
.login-intro {
  color: #666;
  font-size: 0.92rem;
  margin-bottom: 1.5rem;
}
.login-form {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}
.login-form input {
  padding: 0.7rem 0.9rem;
  border: 1px solid #ddd;
  border-radius: 10px;
  font-size: 0.95rem;
}
.btn-primary {
  padding: 0.75rem;
  border: none;
  border-radius: 10px;
  background: #1a1a2e;
  color: #fff;
  font-size: 0.95rem;
  cursor: pointer;
}
.btn-primary:hover {
  background: #33334d;
}
.login-feedback {
  margin-top: 0.9rem;
  font-size: 0.85rem;
  color: #2e7d32;
}
.login-feedback.error {
  color: #c62828;
}
.login-links {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 1rem;
  margin-top: 1.2rem;
  font-size: 0.82rem;
}
.login-links a {
  color: #666;
  text-decoration: underline;
}

/* --- Dashboard --- */
.dash-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.5rem;
}
.dash-header h1 {
  font-family: var(--font-heading, serif);
  font-size: 1.7rem;
}
.dash-teams {
  color: #777;
  font-size: 0.88rem;
  margin-top: 0.3rem;
}
.btn-logout {
  padding: 0.5rem 1rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: #fff;
  font-size: 0.85rem;
  cursor: pointer;
  white-space: nowrap;
}
.btn-logout:hover {
  background: #f5f5f5;
}
.dash-tabs {
  display: flex;
  gap: 0.5rem;
  border-bottom: 1px solid #eee;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}
.dash-tabs button {
  padding: 0.65rem 1rem;
  border: none;
  background: none;
  font-size: 0.95rem;
  cursor: pointer;
  color: #666;
  border-bottom: 2px solid transparent;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.dash-tabs button.active {
  color: #1a1a2e;
  font-weight: 600;
  border-bottom-color: #1a1a2e;
}
.badge {
  background: #e53935;
  color: #fff;
  border-radius: 999px;
  font-size: 0.7rem;
  padding: 0.1rem 0.45rem;
  font-weight: 700;
}
.dash-loading,
.dash-empty {
  color: #888;
  text-align: center;
  padding: 2.5rem 0;
}

/* Ressources */
.resource-list,
.request-list,
.event-list {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}
.resource-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.1rem 1.3rem;
  background: #fff;
  border: 1px solid #eee;
  border-radius: 12px;
  cursor: pointer;
  transition: box-shadow 0.2s, transform 0.2s;
}
.resource-card:hover {
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.07);
  transform: translateY(-1px);
}
.resource-body h3 {
  font-size: 1.02rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.badge-new {
  background: #1976d2;
  color: #fff;
  font-size: 0.68rem;
  border-radius: 999px;
  padding: 0.12rem 0.5rem;
  font-weight: 600;
}
.resource-body p {
  color: #666;
  font-size: 0.88rem;
  margin-top: 0.25rem;
}
.resource-meta {
  font-size: 0.78rem !important;
  color: #999 !important;
}
.resource-open {
  color: #1976d2;
  font-size: 0.85rem;
  white-space: nowrap;
}

/* Demandes */
.request-card {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.1rem 1.3rem;
  background: #fff;
  border: 1px solid #eee;
  border-radius: 12px;
  flex-wrap: wrap;
}
.request-from {
  font-weight: 600;
  font-size: 0.92rem;
}
.request-msg {
  margin-top: 0.3rem;
  color: #444;
  font-size: 0.92rem;
}
.request-meta {
  color: #888;
  font-size: 0.8rem;
  margin-top: 0.25rem;
}
.request-note {
  font-style: italic;
  color: #888;
  font-size: 0.82rem;
  margin-top: 0.3rem;
}
.request-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.status-pill {
  font-size: 0.75rem;
  padding: 0.25rem 0.7rem;
  border-radius: 999px;
  font-weight: 600;
}
.status-pending {
  background: #fff8e1;
  color: #b28704;
}
.status-accepted {
  background: #e8f5e9;
  color: #2e7d32;
}
.status-declined {
  background: #ffebee;
  color: #c62828;
}
.status-cancelled {
  background: #f5f5f5;
  color: #777;
}
.btn-accept,
.btn-decline {
  padding: 0.45rem 0.9rem;
  border: none;
  border-radius: 8px;
  font-size: 0.85rem;
  cursor: pointer;
  color: #fff;
}
.btn-accept {
  background: #2e7d32;
}
.btn-decline {
  background: #c62828;
}

/* Mes événements */
.event-card-m {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 1.1rem 1.3rem;
  background: #fff;
  border: 1px solid #eee;
  border-radius: 12px;
  flex-wrap: wrap;
}
.event-body h3 {
  font-size: 1.02rem;
}
.event-meta {
  color: #777;
  font-size: 0.85rem;
  margin-top: 0.25rem;
}
.attendance-btns {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}
.attendance-btns button {
  padding: 0.45rem 0.8rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: #fff;
  font-size: 0.82rem;
  cursor: pointer;
  color: #555;
}
.attendance-btns button.active {
  border-color: #1a1a2e;
  background: #1a1a2e;
  color: #fff;
  font-weight: 600;
}
.event-hint {
  margin-top: 1.2rem;
  font-size: 0.85rem;
  color: #888;
  text-align: center;
}
.event-hint a {
  color: #1976d2;
}

@media (max-width: 640px) {
  .membre-page {
    padding-top: 6rem;
  }
  .resource-card,
  .request-card,
  .event-card-m {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
