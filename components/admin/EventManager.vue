<template>
  <Teleport to="body">
    <div v-if="open" class="event-manager-overlay" @click.self="close">
      <div class="event-manager">
        <div class="event-manager-header">
          <h2>Gestion des événements</h2>
          <button class="event-manager-close" @click="close">&times;</button>
        </div>

        <div v-if="!editing && !creating && !deleting" class="event-manager-body">
          <button class="event-add-btn" @click="startCreate">+ Nouvel événement</button>
          <div class="event-toolbar">
            <input
              v-model="searchQuery"
              type="text"
              class="event-search-input"
              placeholder="Rechercher un événement (titre, lieu, description)…"
            />
            <select v-model="sortOrder" class="event-sort-select" title="Trier">
              <option value="date-asc">Date ↑</option>
              <option value="date-desc">Date ↓</option>
              <option value="title-asc">Titre A→Z</option>
            </select>
            <select v-model="statusFilter" class="event-filter-select" title="Filtrer par statut">
              <option value="all">Tous les statuts</option>
              <option value="active">Actifs</option>
              <option value="cancelled">Annulés</option>
            </select>
          </div>
          <div v-if="loading" class="event-status">Chargement...</div>
          <div v-else class="event-list">
            <div v-for="evt in filteredEvents" :key="evt.id" class="event-row" @click="startEdit(evt)">
              <div class="event-row-date">
                <span class="event-row-day">{{ formatDay(evt.date) }}</span>
                <span class="event-row-month">{{ formatMonth(evt.date) }}</span>
              </div>
              <div class="event-row-info">
                <strong>{{ evt.emoji }} {{ evt.titre }}</strong>
                <div class="event-row-meta">
                  <span v-if="evt.heure">{{ evt.heure }}</span>
                  <span v-if="evt.lieu">{{ evt.lieu }}</span>
                  <span v-if="evt.repeat_period" class="event-badge">{{ formatRepeatPeriod(evt.repeat_period) }}</span>
                </div>
              </div>
              <button class="event-delete-btn" @click.stop="deleting = evt" title="Supprimer">&times;</button>
            </div>
            <p v-if="events.length === 0" class="event-status">Aucun événement.</p>
            <p v-else-if="filteredEvents.length === 0" class="event-status">Aucun événement ne correspond à la recherche.</p>
          </div>
        </div>

        <div v-if="creating || editing" class="event-manager-body">
          <h3 class="event-form-title">{{ creating ? 'Nouvel événement' : 'Modifier l\'événement' }}</h3>
          <div class="event-form">
            <label>Titre * <input v-model="form.title" type="text" /></label>
            <label>Description <textarea v-model="form.description" rows="3"></textarea></label>
            <div class="event-form-row">
              <label>Date début * <input v-model="form.start_date" type="date" /></label>
              <label :title="form.repeat_period ? 'Dernière date de la série : aucune occurrence ne sera affichée après.' : 'Dernier jour de l\'événement : il disparaît de l\'agenda le lendemain.'">{{ form.repeat_period ? 'Fin de la série' : 'Date fin' }} <input v-model="form.end_date" type="date" :min="form.start_date || undefined" /></label>
            </div>
            <div class="event-form-row">
              <label>Heure <input v-model="form.start_time" type="time" /></label>
              <label>Fin <input v-model="form.end_time" type="time" /></label>
            </div>
            <label>Lieu <input v-model="form.location" type="text" /></label>
            <div class="event-recurrence">
              <div v-for="(ruleStr, ri) in rules" :key="ri" class="recurrence-rule">
                <div class="recurrence-rule-head">
                  <select
                    :value="getRuleType(ruleStr)"
                    @change="setRuleType(ri, $event.target.value)"
                    class="recurrence-type-select"
                  >
                    <option value="weekly">Chaque semaine</option>
                    <option value="biweekly">Toutes les 2 semaines</option>
                    <option value="month">Chaque mois (même date)</option>
                    <option value="monthly_weekday">Même jour du mois…</option>
                  </select>
                  <button type="button" class="rule-remove-btn" @click="removeRule(ri)" title="Supprimer cette règle">×</button>
                </div>
                <div v-if="getRuleType(ruleStr) === 'weekly' || getRuleType(ruleStr) === 'biweekly'" class="day-pills">
                  <button
                    v-for="(label, di) in DAY_PILL_LABELS" :key="di"
                    type="button"
                    class="day-pill"
                    :class="{ active: getRuleDays(ruleStr).includes(DAY_PILL_WEEKDAYS[di]) }"
                    @click="toggleRuleDay(ri, DAY_PILL_WEEKDAYS[di])"
                  >{{ label }}</button>
                </div>
                <div v-if="getRuleType(ruleStr) === 'monthly_weekday'" class="monthly-weekday-row">
                  <select
                    :value="getRuleOrdinal(ruleStr)"
                    @change="setRuleOrdinal(ri, parseInt($event.target.value))"
                  >
                    <option value="1">1er</option>
                    <option value="2">2e</option>
                    <option value="3">3e</option>
                    <option value="4">4e</option>
                    <option value="-1">Dernier</option>
                  </select>
                  <div class="day-pills">
                    <button
                      v-for="(label, di) in DAY_PILL_LABELS" :key="di"
                      type="button"
                      class="day-pill"
                      :class="{ active: getRuleWeekday(ruleStr) === DAY_PILL_WEEKDAYS[di] }"
                      @click="setRuleWeekday(ri, DAY_PILL_WEEKDAYS[di])"
                    >{{ label }}</button>
                  </div>
                  <span class="monthly-suffix">du mois</span>
                </div>
              </div>
              <button type="button" class="rule-add-btn" @click="addRule">
                + {{ rules.length === 0 ? 'Ajouter une répétition' : 'Ajouter une règle' }}
              </button>
              <div v-if="rules.length > 0 && nextOccurrences.length > 0" class="next-dates-preview">
                <div class="next-dates-preview-label">Prochaines occurrences :</div>
                <div class="next-dates-chips">
                  <span v-for="(d, i) in nextOccurrences" :key="i" class="next-date-chip">
                    {{ d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' }) }}
                  </span>
                </div>
              </div>
            </div>
            <label>Emoji <input v-model="form.emoji" type="text" maxlength="5" /></label>
            <div class="event-image-section">
              <label class="event-image-label">Image</label>
              <div class="event-image-controls">
                <input v-model="form.image_url" type="url" placeholder="https://..." />
                <input ref="eventFileInput" type="file" accept="image/*" class="file-input-hidden" @change="onFileSelected" />
                <button class="event-btn-sec" type="button" :disabled="uploadSaving" @click="eventFileInput?.click()">{{ uploadSaving ? 'Envoi…' : 'Téléverser' }}</button>
                <button v-if="uploadedImages.length" class="event-btn-sec" type="button" @click="toggleUploadedList">Uploadées ({{ uploadedImages.length }})</button>
              </div>
              <img v-if="form.image_url" :src="form.image_url" class="event-image-preview" alt="" />
              <div v-if="showUploadedList" class="event-uploaded-list">
                <div v-if="imagesLoading" class="event-status">Chargement...</div>
                <div v-else class="event-uploaded-grid">
                  <div v-for="(url, i) in uploadedImages" :key="i" class="event-uploaded-item" :class="{ selected: url === form.image_url }" @click="form.image_url = url">
                    <img :src="url" alt="" />
                  </div>
                </div>
              </div>
            </div>
            <label>Lien <input v-model="form.link" type="url" placeholder="https://..." /></label>
            <label>Billetterie <input v-model="form.ticket_url" type="url" placeholder="https://..." /></label>
            <label>Statut
              <select v-model="form.status">
                <option value="active">Actif</option>
                <option value="cancelled">Annulé</option>
              </select>
            </label>

            <div v-if="editing" class="event-section">
              <h4>Exceptions</h4>
              <div v-for="(ex, i) in form.exceptions" :key="i" class="exception-row">
                <span>{{ ex.exception_date }} — {{ ex.type === 'cancelled' ? 'Annulé' : 'Déplacé au ' + (ex.new_date || '?') }}</span>
                <button @click="form.exceptions.splice(i, 1)" title="Supprimer">&times;</button>
              </div>
              <div class="exception-add">
                <select v-model="newEx.type">
                  <option value="cancelled">Annulé</option>
                  <option value="moved">Déplacé</option>
                </select>
                <input v-model="newEx.exception_date" type="date" />
                <input v-if="newEx.type === 'moved'" v-model="newEx.new_date" type="date" placeholder="Nouvelle date" />
                <button @click="addException">+</button>
              </div>
            </div>

            <p v-if="formError" class="event-error">{{ formError }}</p>
            <div class="event-form-actions">
              <button class="event-btn" @click="creating ? createEvent() : updateEvent()" :disabled="saving">
                {{ saving ? '...' : (creating ? 'Créer' : 'Enregistrer') }}
              </button>
              <button class="event-btn-sec" @click="cancelForm">Annuler</button>
            </div>
          </div>
        </div>

        <div v-if="deleting" class="event-manager-body">
          <p>Supprimer « <strong>{{ deleting.titre }}</strong> » ?</p>
          <div class="event-form-actions">
            <button class="event-btn" @click="deleteEvent" :disabled="saving">Confirmer</button>
            <button class="event-btn-sec" @click="deleting = null">Annuler</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import { expandRecurring, isoDay } from '~/utils/churchEvents.js'
import { uploadImage, listUploadedImages } from '~/utils/imageUpload.js'

const props = defineProps({ open: Boolean })
const emit = defineEmits(['close'])
const config = useRuntimeConfig()
const apiUrl = config.public.apiUrl || 'https://eglise-app.belletonv.workers.dev'

const events = ref([])
const loading = ref(false)
const searchQuery = ref('')
const sortOrder = ref('date-asc')
const statusFilter = ref('all')

const filteredEvents = computed(() => {
  let list = events.value

  if (statusFilter.value !== 'all') {
    list = list.filter((e) => (e.statut || 'active') === statusFilter.value)
  }

  const q = searchQuery.value.trim().toLowerCase()
  if (q) {
    list = list.filter((e) =>
      (e.titre || '').toLowerCase().includes(q) ||
      (e.lieu || '').toLowerCase().includes(q) ||
      (e.description || '').toLowerCase().includes(q)
    )
  }

  const sorted = [...list]
  switch (sortOrder.value) {
    case 'date-desc':
      sorted.sort((a, b) => b.date - a.date)
      break
    case 'title-asc':
      sorted.sort((a, b) => (a.titre || '').localeCompare(b.titre || ''))
      break
    default: // date-asc
      sorted.sort((a, b) => a.date - b.date)
  }
  return sorted
})
const editing = ref(null)
const creating = ref(false)
const deleting = ref(null)
const saving = ref(false)
const formError = ref('')

const newEx = ref({ type: 'cancelled', exception_date: '', new_date: '' })
const originalExceptions = ref([])

// Image upload
const eventFileInput = ref(null)
const uploadedImages = ref([])
const showUploadedList = ref(false)
const imagesLoading = ref(false)
const uploadSaving = ref(false)

// ── Recurrence helpers ──────────────────────────────────────────────
// Display order: L M M J V S D (French week starts Monday)
const DAY_PILL_LABELS   = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const DAY_PILL_WEEKDAYS = [1, 2, 3, 4, 5, 6, 0]  // JS weekday for each display position
const ORDINAL_FR = { 1: '1er', 2: '2e', 3: '3e', 4: '4e', '-1': 'dernier' }
const DAY_FR_SHORT = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.']

function formatRepeatPeriod(rp) {
  if (!rp) return ''
  return rp.split('|').filter(Boolean).map(formatSingleRule).join(' + ')
}

function formatSingleRule(rp) {
  if (!rp) return ''
  if (rp === 'week')   return 'chaque semaine'
  if (rp === 'biweek') return 'toutes les 2 sem.'
  if (rp === 'month')  return 'chaque mois'
  if (rp.startsWith('weekly:')) {
    const labels = rp.split(':')[1].split(',').map(Number).map(d => DAY_FR_SHORT[d]).join(', ')
    return `chaque ${labels}`
  }
  if (rp.startsWith('biweekly:')) {
    const labels = rp.split(':')[1].split(',').map(Number).map(d => DAY_FR_SHORT[d]).join(', ')
    return `${labels} / 2 sem.`
  }
  if (rp.startsWith('monthly_weekday:')) {
    const p = rp.split(':')
    const n = parseInt(p[1]), d = parseInt(p[2])
    return `${ORDINAL_FR[n] || n + 'e'} ${DAY_FR_SHORT[d] || ''} du mois`
  }
  return rp
}

// ── Multi-rule helpers ──────────────────────────────────────────────
// repeat_period stores one or more rule strings separated by '|'
// e.g. 'weekly:2|monthly_weekday:3:0' = "every Tuesday + 3rd Sunday"

const rules = computed(() => {
  const rp = form.value.repeat_period
  if (!rp) return []
  return rp.split('|').filter(Boolean)
})

function setRulesArray(arr) {
  form.value.repeat_period = arr.filter(Boolean).join('|')
}

function addRule() {
  const defaultDay = form.value.start_date
    ? new Date(form.value.start_date + 'T00:00:00').getDay()
    : 1
  const arr = form.value.repeat_period ? form.value.repeat_period.split('|').filter(Boolean) : []
  arr.push(`weekly:${defaultDay}`)
  setRulesArray(arr)
}

function removeRule(index) {
  const arr = (form.value.repeat_period || '').split('|').filter(Boolean)
  arr.splice(index, 1)
  setRulesArray(arr)
}

function getRuleType(ruleStr) {
  if (!ruleStr) return ''
  if (ruleStr === 'week' || ruleStr.startsWith('weekly:'))   return 'weekly'
  if (ruleStr === 'biweek' || ruleStr.startsWith('biweekly:')) return 'biweekly'
  if (ruleStr === 'month') return 'month'
  if (ruleStr.startsWith('monthly_weekday:')) return 'monthly_weekday'
  return ''
}

function setRuleType(index, val) {
  const arr = (form.value.repeat_period || '').split('|').filter(Boolean)
  const defaultDay = form.value.start_date
    ? new Date(form.value.start_date + 'T00:00:00').getDay()
    : 1
  let newRule = ''
  if (val === 'month') newRule = 'month'
  else if (val === 'weekly')   newRule = `weekly:${defaultDay}`
  else if (val === 'biweekly') newRule = `biweekly:${defaultDay}`
  else if (val === 'monthly_weekday') {
    if (form.value.start_date) {
      const d = new Date(form.value.start_date + 'T00:00:00')
      newRule = `monthly_weekday:${Math.min(Math.ceil(d.getDate() / 7), 4)}:${d.getDay()}`
    } else {
      newRule = 'monthly_weekday:1:1'
    }
  }
  arr[index] = newRule
  setRulesArray(arr)
}

function getRuleDays(ruleStr) {
  if (!ruleStr) return []
  if (ruleStr === 'week' || ruleStr === 'biweek') {
    if (!form.value.start_date) return []
    return [new Date(form.value.start_date + 'T00:00:00').getDay()]
  }
  if (ruleStr.startsWith('weekly:') || ruleStr.startsWith('biweekly:'))
    return ruleStr.split(':')[1].split(',').map(Number)
  return []
}

function toggleRuleDay(index, jsWeekday) {
  const arr = (form.value.repeat_period || '').split('|').filter(Boolean)
  const ruleStr = arr[index]
  if (!ruleStr) return
  const prefix = (ruleStr.startsWith('biweekly:') || ruleStr === 'biweek') ? 'biweekly' : 'weekly'
  const days = [...getRuleDays(ruleStr)]
  const idx = days.indexOf(jsWeekday)
  if (idx >= 0) {
    if (days.length <= 1) return
    days.splice(idx, 1)
  } else {
    days.push(jsWeekday)
  }
  days.sort((a, b) => a - b)
  arr[index] = `${prefix}:${days.join(',')}`
  setRulesArray(arr)
}

function getRuleOrdinal(ruleStr) {
  if (!ruleStr?.startsWith('monthly_weekday:')) return 1
  return parseInt(ruleStr.split(':')[1]) || 1
}

function setRuleOrdinal(index, val) {
  const arr = (form.value.repeat_period || '').split('|').filter(Boolean)
  const ruleStr = arr[index]
  if (!ruleStr?.startsWith('monthly_weekday:')) return
  const p = ruleStr.split(':')
  arr[index] = `monthly_weekday:${val}:${p[2]}`
  setRulesArray(arr)
}

function getRuleWeekday(ruleStr) {
  if (!ruleStr?.startsWith('monthly_weekday:')) return 1
  return parseInt(ruleStr.split(':')[2]) ?? 1
}

function setRuleWeekday(index, val) {
  const arr = (form.value.repeat_period || '').split('|').filter(Boolean)
  const ruleStr = arr[index]
  if (!ruleStr?.startsWith('monthly_weekday:')) return
  const p = ruleStr.split(':')
  arr[index] = `monthly_weekday:${p[1]}:${val}`
  setRulesArray(arr)
}

// Même moteur que le site public (utils/churchEvents.js) : l'aperçu montre
// exactement les dates que verront les visiteurs — exceptions (annulation,
// déplacement) et fin de série (`end_date`) comprises.
const nextOccurrences = computed(() => {
  if (!form.value.repeat_period || !form.value.start_date) return []
  const now = new Date(); now.setHours(0, 0, 0, 0)
  return expandRecurring({ ...form.value, id: editing.value }, now, 8).map(o => o.date)
})

const form = ref({
  title: '', description: '', start_date: '', end_date: '',
  start_time: '', end_time: '', location: '', repeat_period: '',
  emoji: '', image_url: '', link: '', ticket_url: '', status: 'active',
  exceptions: []
})

function resetForm() {
  form.value = { title: '', description: '', start_date: '', end_date: '',
    start_time: '', end_time: '', location: '', repeat_period: '',
    emoji: '', image_url: '', link: '', ticket_url: '', status: 'active',
    exceptions: [] }
  formError.value = ''
}

// Snapshot du formulaire pris à l'ouverture (édition/création) — permet de
// détecter des modifications non enregistrées et d'empêcher de les perdre
// silencieusement en fermant (× , clic hors modale, Echap).
const formSnapshot = ref('')
const isFormDirty = computed(() =>
  (editing.value || creating.value) && JSON.stringify(form.value) !== formSnapshot.value
)

function confirmDiscard() {
  if (!isFormDirty.value) return true
  return window.confirm('Modifications non enregistrées — les abandonner ?')
}

function close() {
  if (!confirmDiscard()) return
  editing.value = null; creating.value = false; deleting.value = null; emit('close')
}
function cancelForm() {
  if (!confirmDiscard()) return
  editing.value = null; creating.value = false; resetForm()
}

// Echap doit fermer CETTE modale (avec garde-fou dirty) sans se propager au
// document — sinon le handler global d'admin (layouts/default.vue) intercepte
// la même touche et quitte tout le mode admin, perdant bien plus que prévu.
function onKeydown(e) {
  if (e.key !== 'Escape') return
  e.stopPropagation()
  if (editing.value || creating.value) cancelForm()
  else close()
}

function startEdit(evt) {
  editing.value = evt.id; creating.value = false; deleting.value = null
  const d = evt.date instanceof Date ? evt.date : new Date(evt.date + 'T00:00:00')
  form.value = {
    title: evt.titre || '', description: evt.description || '',
    start_date: isoDay(d), end_date: evt.end_date || '',
    start_time: evt.heure || '', end_time: evt.fin || '', location: evt.lieu || '',
    repeat_period: evt.repeat_period || '', emoji: evt.emoji || '',
    image_url: evt.image_url || '', link: evt.lien || '',
    ticket_url: evt.billetterie || '', status: evt.statut || 'active',
    exceptions: evt.exceptions ? evt.exceptions.map(ex => ({ ...ex })) : []
  }
  // Snapshot pour calculer les exceptions ajoutées/supprimées au save.
  originalExceptions.value = (evt.exceptions || []).map(ex => ({ ...ex }))
  formSnapshot.value = JSON.stringify(form.value)
}
function startCreate() {
  creating.value = true; editing.value = null; deleting.value = null; resetForm()
  originalExceptions.value = []
  formSnapshot.value = JSON.stringify(form.value)
}

function addException() {
  if (!newEx.value.exception_date) return
  form.value.exceptions.push({ ...newEx.value })
  newEx.value = { type: 'cancelled', exception_date: '', new_date: '' }
}

async function getToken() {
  const { $auth } = useNuxtApp()
  return new Promise(r => {
    const u = $auth.onAuthStateChanged(u => { if (u) u.getIdToken().then(r); else r(null); if (typeof u === 'function') u() })
  })
}

// Appel DIRECT au Worker eglise-app depuis le navigateur (ce chemin ne passe
// pas par un proxy Nitro) : le délai maximal doit donc être posé ici. Sans
// lui, un Worker qui ne répond plus laisse l'écran de gestion des événements
// bloqué sur « chargement » sans qu'aucun catch ne se déclenche jamais.
const API_TIMEOUT_MS = 8000

async function api(path, opts = {}) {
  const token = await getToken()
  const h = { 'Content-Type': 'application/json', ...opts.headers }
  if (token) h['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${apiUrl}${path}`, {
    ...opts,
    headers: h,
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res
}

async function fetchEvents() {
  loading.value = true
  try {
    const res = await api('/api/church-events?include_exceptions=1', { method: 'GET' })
    const data = await res.json()
    events.value = (data || []).map(e => ({
      id: e.id, titre: e.title, date: new Date(e.start_date + 'T00:00:00'),
      heure: e.start_time || null, fin: e.end_time || null,
      end_date: e.end_date || null, lieu: e.location || null,
      description: e.description || null, image_url: e.image_url || null,
      repeat_period: e.repeat_period || null, emoji: e.emoji || null,
      lien: e.link || null, billetterie: e.ticket_url || null,
      statut: e.status || 'active',
      exceptions: e.exceptions || []
    })).sort((a, b) => a.date - b.date)
  } catch (e) { console.error(e); events.value = []
  } finally { loading.value = false }
}

// Synchronise les exceptions du formulaire avec le backend :
// supprime celles retirées (avaient un id, plus présentes) et crée les nouvelles
// (sans id). Les exceptions ne sont liées qu'aux événements récurrents.
async function syncExceptions(eventId) {
  if (!eventId) return
  const current = form.value.exceptions || []
  const original = originalExceptions.value || []
  for (const o of original) {
    if (o.id && !current.some(c => c.id === o.id)) {
      await api(`/api/church-events/${eventId}/exceptions/${o.id}`, { method: 'DELETE' })
    }
  }
  for (const c of current) {
    if (!c.id) {
      await api(`/api/church-events/${eventId}/exceptions`, { method: 'POST', body: JSON.stringify({
        type: c.type, exception_date: c.exception_date || null, new_date: c.new_date || null,
      }) })
    }
  }
}

function eventPayload() {
  return {
    title: form.value.title, description: form.value.description || null,
    start_date: form.value.start_date, end_date: form.value.end_date || null,
    start_time: form.value.start_time || null, end_time: form.value.end_time || null,
    location: form.value.location || null, repeat_period: form.value.repeat_period || null,
    emoji: form.value.emoji || null, image_url: form.value.image_url || null,
    link: form.value.link || null, ticket_url: form.value.ticket_url || null,
    status: form.value.status || 'active'
  }
}

async function createEvent() {
  if (!form.value.title || !form.value.start_date) { formError.value = 'Titre et date requis'; return }
  saving.value = true; formError.value = ''
  try {
    const res = await api('/api/church-events', { method: 'POST', body: JSON.stringify(eventPayload()) })
    const created = await res.json().catch(() => null)
    if (created?.id) await syncExceptions(created.id)
    await fetchEvents(); creating.value = false
  } catch (e) { formError.value = e.message
  } finally { saving.value = false }
}

async function updateEvent() {
  saving.value = true; formError.value = ''
  try {
    await api(`/api/church-events/${editing.value}`, { method: 'PUT', body: JSON.stringify(eventPayload()) })
    await syncExceptions(editing.value)
    await fetchEvents(); editing.value = null
  } catch (e) { formError.value = e.message
  } finally { saving.value = false }
}

async function deleteEvent() {
  if (!deleting.value) return
  saving.value = true
  try {
    await api(`/api/church-events/${deleting.value.id}`, { method: 'DELETE' })
    await fetchEvents(); deleting.value = null
  } catch (e) { formError.value = e.message
  } finally { saving.value = false }
}

function formatDay(d) { return d.toLocaleDateString('fr-FR', { day: '2-digit' }) }
function formatMonth(d) { return d.toLocaleDateString('fr-FR', { month: 'short' }).toUpperCase() }
function formatDateShort(d) {
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

// Image upload — compression + envoi partagés avec l'éditeur de blocs
// (utils/imageUpload.js) : une photo de téléphone de plusieurs Mo est
// redimensionnée avant l'envoi au lieu d'être servie telle quelle.
async function onFileSelected(e) {
  const file = e.target.files && e.target.files[0]
  if (!file) return
  uploadSaving.value = true
  try {
    form.value.image_url = await uploadImage(file)
    await loadUploadedImages()
  } catch (err) {
    console.error('Upload error', err)
    formError.value = err?.message || 'Erreur de téléversement'
  } finally {
    uploadSaving.value = false
    if (e.target) e.target.value = ''
  }
}

async function loadUploadedImages() {
  imagesLoading.value = true
  try {
    uploadedImages.value = (await listUploadedImages()).map(i => i.url)
  } catch (err) {
    console.error('Load images error', err)
    uploadedImages.value = []
  } finally {
    imagesLoading.value = false
  }
}

function toggleUploadedList() {
  showUploadedList.value = !showUploadedList.value
  if (showUploadedList.value) loadUploadedImages()
}

watch(() => props.open, (v) => {
  if (v) {
    fetchEvents()
    // Capture (pas bubble) : gagne sur le handler global admin
    // (layouts/default.vue) qui quitte tout le mode admin sur Echap, quel
    // que soit l'élément focus au moment de la touche.
    document.addEventListener('keydown', onKeydown, true)
  } else {
    document.removeEventListener('keydown', onKeydown, true)
  }
})
onUnmounted(() => document.removeEventListener('keydown', onKeydown, true))
</script>

<style scoped>
.event-manager-overlay {
  position: fixed; inset: 0; z-index: 2000;
  background: rgba(0,0,0,0.4);
  display: flex; align-items: center; justify-content: center;
  padding: 16px;
}
.event-manager {
  background: #fff; border-radius: 12px;
  box-shadow: 0 4px 32px rgba(0,0,0,0.12);
  width: 100%; max-width: 640px;
  max-height: 85vh; display: flex; flex-direction: column;
}
.event-manager-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 20px 24px; border-bottom: 1px solid #e5e7eb;
}
.event-manager-header h2 { margin: 0; font-size: 1.1em; font-weight: 700; color: #111827; }
.event-manager-close {
  background: #f3f4f6; border: none; width: 32px; height: 32px;
  border-radius: 50%; font-size: 1.3em; cursor: pointer;
  display: flex; align-items: center; justify-content: center; color: #6b7280;
}
.event-manager-close:hover { background: #e5e7eb; color: #111827; }
.event-manager-body { padding: 20px 24px; overflow-y: auto; flex: 1; }
.event-add-btn {
  width: 100%; padding: 10px; font-size: 0.9em; font-weight: 600;
  background: #2563eb; color: #fff; border: none; border-radius: 8px;
  cursor: pointer; margin-bottom: 16px;
}
.event-add-btn:hover { background: #1d4ed8; }
.event-toolbar {
  display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap;
}
.event-search-input {
  flex: 1; min-width: 180px; padding: 8px 12px; font-size: 0.85em;
  border: 1px solid #e5e7eb; border-radius: 8px; box-sizing: border-box;
}
.event-search-input:focus { outline: none; border-color: #2563eb; }
.event-sort-select, .event-filter-select {
  padding: 8px 10px; font-size: 0.85em; border: 1px solid #e5e7eb;
  border-radius: 8px; background: #fff; color: #374151; cursor: pointer;
}
.event-status { text-align: center; color: #6b7280; padding: 24px; }
.event-list { display: flex; flex-direction: column; gap: 8px; }
.event-row {
  display: flex; align-items: center; gap: 14px;
  padding: 12px 14px; border: 1px solid #e5e7eb; border-radius: 8px;
  cursor: pointer; transition: all .15s;
}
.event-row:hover { border-color: #2563eb; background: #f8faff; }
.event-row-date {
  display: flex; flex-direction: column; align-items: center;
  min-width: 44px; flex-shrink: 0;
}
.event-row-day { font-size: 1.2em; font-weight: 800; color: #111827; line-height: 1.1; }
.event-row-month { font-size: 0.65em; font-weight: 700; color: #6b7280; text-transform: uppercase; }
.event-row-info { flex: 1; min-width: 0; }
.event-row-info strong { font-size: 0.9em; color: #111827; display: block; }
.event-row-meta { display: flex; gap: 8px; font-size: 0.78em; color: #6b7280; flex-wrap: wrap; margin-top: 2px; }
.event-badge { background: #eff6ff; color: #2563eb; padding: 1px 6px; border-radius: 4px; font-weight: 600; font-size: 0.75em; }
.event-delete-btn {
  background: none; border: none; font-size: 1.2em; color: #9ca3af;
  cursor: pointer; padding: 4px; flex-shrink: 0;
}
.event-delete-btn:hover { color: #ef4444; }
.event-form-title { font-size: 1em; font-weight: 700; color: #111827; margin: 0 0 16px; }
.event-recurrence { display: flex; flex-direction: column; gap: 8px; }
.day-pills { display: flex; gap: 5px; flex-wrap: wrap; }
.day-pill {
  width: 32px; height: 32px; border-radius: 50%;
  border: 1.5px solid #d1d5db; background: white; color: #6b7280;
  font-size: 0.75em; font-weight: 700; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all .15s; padding: 0; line-height: 1;
}
.day-pill:hover { border-color: #2563eb; color: #2563eb; }
.day-pill.active { background: #2563eb; border-color: #2563eb; color: white; }
.monthly-weekday-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.monthly-weekday-row select { padding: 5px 8px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 0.85em; background: white; }
.monthly-suffix { font-size: 0.85em; font-weight: 600; color: #374151; }
.event-form { display: flex; flex-direction: column; gap: 14px; }
.event-form label { display: flex; flex-direction: column; gap: 4px; font-size: 0.85em; font-weight: 600; color: #374151; }
.event-form input, .event-form select, .event-form textarea {
  padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 6px;
  font-size: 0.9em; font-family: inherit; background: #fff;
}
.event-form input:focus, .event-form select:focus, .event-form textarea:focus {
  outline: none; border-color: #2563eb; box-shadow: 0 0 0 2px rgba(37,99,235,0.15);
}
.event-form-row { display: flex; gap: 12px; }
.event-form-row label { flex: 1; }
.event-form-actions { display: flex; gap: 8px; margin-top: 4px; }
.event-btn {
  padding: 10px 20px; background: #2563eb; color: #fff;
  border: none; border-radius: 8px; font-size: 0.9em; font-weight: 600; cursor: pointer;
}
.event-btn:hover { background: #1d4ed8; }
.event-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.event-btn-sec {
  padding: 10px 20px; background: #f3f4f6; color: #374151;
  border: 1px solid #d1d5db; border-radius: 8px; font-size: 0.9em; font-weight: 600; cursor: pointer;
}
.event-btn-sec:hover { background: #e5e7eb; }
.event-error { color: #ef4444; font-size: 0.85em; margin: 0; }
.event-section { border-top: 1px solid #e5e7eb; padding-top: 14px; }
.event-section h4 { margin: 0 0 8px; font-size: 0.9em; color: #374151; }
.exception-row { display: flex; justify-content: space-between; align-items: center; padding: 4px 0; font-size: 0.82em; color: #6b7280; }
.exception-row button { background: none; border: none; color: #9ca3af; cursor: pointer; font-size: 1.1em; }
.exception-row button:hover { color: #ef4444; }
.exception-add { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
.exception-add select, .exception-add input { padding: 6px 8px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 0.82em; }
.exception-add button { padding: 6px 12px; background: #2563eb; color: #fff; border: none; border-radius: 6px; font-size: 0.82em; cursor: pointer; }
.exception-add button:hover { background: #1d4ed8; }

.event-image-section { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
.event-image-label { font-size: 0.85em; font-weight: 600; color: #374151; }
.event-image-controls { display: flex; gap: 6px; flex-wrap: wrap; }
.event-image-controls input[type="url"] { flex: 1; min-width: 120px; }
.event-image-controls input[type="url"] { padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 0.9em; }
.event-image-preview { max-width: 100%; max-height: 220px; width: auto; object-fit: contain; border-radius: 6px; background: #f3f4f6; display: block; margin: 0 auto; }
.file-input-hidden { display: none; }
.event-uploaded-list { max-height: 180px; overflow-y: auto; }
.event-uploaded-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.event-uploaded-item { border: 2px solid transparent; border-radius: 6px; overflow: hidden; cursor: pointer; }
.event-uploaded-item:hover { border-color: #93c5fd; }
.event-uploaded-item.selected { border-color: #2563eb; }
.event-uploaded-item img { width: 100%; height: 60px; object-fit: cover; display: block; }

.recurrence-rule {
  border: 1px solid #e5e7eb; border-radius: 8px;
  padding: 10px 12px; display: flex; flex-direction: column; gap: 8px;
}
.recurrence-rule-head { display: flex; align-items: center; gap: 8px; }
.recurrence-type-select {
  flex: 1; padding: 6px 8px; border: 1px solid #d1d5db; border-radius: 6px;
  font-size: 0.85em; background: white;
}
.rule-remove-btn {
  width: 24px; height: 24px; border: 1px solid #fecaca; border-radius: 50%;
  background: white; color: #ef4444; cursor: pointer; font-size: 0.9em;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0; padding: 0;
}
.rule-remove-btn:hover { background: #fef2f2; }
.rule-add-btn {
  padding: 7px 14px; background: #f3f4f6; color: #374151;
  border: 1.5px dashed #d1d5db; border-radius: 8px;
  font-size: 0.83em; font-weight: 600; cursor: pointer; text-align: left;
}
.rule-add-btn:hover { background: #e5e7eb; border-color: #9ca3af; }
.next-dates-preview {
  padding: 10px 12px; background: #eff6ff; border-radius: 8px;
}
.next-dates-preview-label {
  font-weight: 600; color: #1d4ed8; font-size: 0.8em;
  text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 6px;
}
.next-dates-chips { display: flex; flex-wrap: wrap; gap: 4px; }
.next-date-chip {
  padding: 3px 9px; background: white; border: 1px solid #bfdbfe;
  border-radius: 12px; color: #1e40af; font-size: 0.82em; font-weight: 500;
}
</style>
