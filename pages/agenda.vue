<template>
  <div class="page-agenda">
    <section class="agenda-header">
      <h1 class="agenda-title">Agenda</h1>
      <p class="agenda-subtitle">Retrouvez tous les événements à venir</p>
    </section>

    <section class="agenda-calendar">
      <div class="calendar-nav">
        <button class="nav-btn" @click="prev">&#8249;</button>
        <h2 class="calendar-month">{{ periodLabel }}</h2>
        <button class="nav-btn" @click="next">&#8250;</button>
        <div class="view-toggle">
          <button class="view-btn" :class="{ active: currentView === 'month' }" @click="currentView = 'month'">Mois</button>
          <button class="view-btn" :class="{ active: currentView === 'next' }" @click="currentView = 'next'">Prochain</button>
          <button class="view-btn" :class="{ active: currentView === 'cards' }" @click="currentView = 'cards'">Cartes</button>
          <button class="view-btn" :class="{ active: currentView === 'agenda' }" @click="currentView = 'agenda'">Ordre du jour</button>
          <button class="view-btn" :class="{ active: currentView === 'week' }" @click="currentView = 'week'">Semaine</button>
        </div>
      </div>

      <!-- Mois -->
      <template v-if="currentView === 'month'">
        <div class="calendar-grid">
            <div class="day-header" v-for="d in dayNames" :key="d">{{ d }}</div>
            <div class="day-cell empty" v-for="_ in firstDayOfMonth" :key="'e' + _"></div>
            <div
              v-for="day in daysInMonth"
              :key="day"
              class="day-cell"
              :class="{ today: isToday(day), 'has-events': getDayEvents(day).length > 0 }"
              @click="openDayModal(day)"
            >
              <span class="day-number" :class="{ today: isToday(day) }">{{ day }}</span>
              <div class="day-events">
<span
  v-for="evt in getDayEvents(day)"
  :key="evt.id"
  class="event-pill"
  :class="[getEventColor(evt), { 'event-mine': isMine(evt) }]"
  :title="evt.titre"
  @click.stop="openEventModal(evt)"
>{{ isMine(evt) ? '⭐ ' : '' }}{{ evt.emoji || '•' }} {{ evt.titre }}</span>
              </div>
            </div>
          </div>
      </template>

      <!-- Semaine -->
      <template v-if="currentView === 'week'">
        <div class="calendar-grid">
            <div class="day-header" v-for="d in dayNames" :key="d">{{ d }}</div>
            <div
              v-for="day in weekDays"
              :key="day.date"
              class="day-cell"
              :class="{ today: isToday(day.day), 'has-events': day.events.length > 0 }"
              @click="openDayModal(day.date)"
            >
              <span class="day-number" :class="{ today: isToday(day.day) }">{{ day.day }}</span>
              <div class="day-events">
<span
  v-for="evt in day.events"
  :key="evt.id"
  class="event-pill"
  :class="[getEventColor(evt), { 'event-mine': isMine(evt) }]"
  :title="evt.titre"
  @click.stop="openEventModal(evt)"
>{{ isMine(evt) ? '⭐ ' : '' }}{{ evt.emoji || '•' }} {{ evt.titre }}</span>
              </div>
            </div>
          </div>
      </template>

      <div class="calendar-footer">
        <span class="tz-label">🌍 Europe/Paris</span>
      </div>
    </section>

    <!-- Cartes / Ordre du jour -->
    <section class="events-list-section" v-if="currentView === 'cards' || currentView === 'next' || currentView === 'agenda'">
      <div class="events-list-inner">
        <div v-if="currentView === 'next'" class="next-events">
          <div v-for="(g, i) in nextEvents" :key="i" class="next-event" @click="openEventModal(g.events[0])">
            <div class="next-event-date">
              <span class="next-event-day">{{ formatDay(g.date) }}</span>
              <span class="next-event-month">{{ formatMonth(g.date) }}</span>
            </div>
            <div class="next-event-body">
              <div v-for="evt in g.events" :key="evt.id" class="next-event-item">
                <strong>{{ evt.titre }}</strong>
                <span class="next-event-meta">
                  <span v-if="evt.heure">🕙 {{ evt.heure }}</span>
                  <span v-if="evt.lieu">📍 {{ evt.lieu }}</span>
                </span>
              </div>
            </div>
            <div class="next-event-arrow">›</div>
          </div>
          <!-- `!erreur` : une liste vide parce que l'API n'a pas répondu n'est
               pas un agenda vide. Le message d'échec, lui, est affiché une
               seule fois hors des vues (voir plus bas), sans quoi il faudrait
               le répéter dans chacune. -->
          <p v-if="!erreur && nextEvents.length === 0" class="empty-msg">Aucun événement à venir.</p>
        </div>
        <div v-if="currentView === 'cards'" class="events-list">
          <article v-for="evt in filteredEvents" :key="evt.id" class="event-card" :class="{ 'event-mine': isMine(evt) }" @click="openEventModal(evt)" style="cursor:pointer">
  <div style="position:relative;min-height:160px;width:100%">
  <template v-if="evt.images && evt.images.length">
    <EventImageSlider
      v-if="evt.images.length > 1"
      :images="evt.images"
      :altPrefix="'Photo '"
      mini
      @click="(e) => e.stopPropagation()"
      @slideClick="idx => openEventModal(evt, idx)"
    />
    <img
      v-else
      :src="evt.images[0]"
      :alt="evt.titre"
      class="event-card-img"
      loading="lazy"
      style="width:100%;height:160px;object-fit:cover; background:#ededed; border-radius:0; box-shadow:none; cursor:pointer;"
      @click.stop="openEventModal(evt, 0)"
    />
  </template>
  <div v-else style="width:100%;height:160px;display:flex;align-items:center;justify-content:center;background:#ebf0fa;">
    <svg width="58" height="58" viewBox="0 0 40 40" fill="#b8c7da"><circle cx="20" cy="20" r="18" stroke="#a6bed7" stroke-width="2" fill="#e9f0fa"/><path d="M12.5 27.5L20 15l7.5 12.5h-15z" fill="#b8c7da"/><rect x="17.2" y="18" width="5.6" height="5.5" rx="2.7" fill="#a6bed7"/></svg>
  </div>
  <div class="event-date-badge">
    <span class="badge-day">{{ formatDay(evt.date) }}</span>
    <span class="badge-month">{{ formatMonth(evt.date) }}</span>
  </div>
</div>
  <div class="event-body">
    <h3 class="event-title">{{ evt.titre }}</h3>
    <div class="event-meta">
      <span v-if="evt.heure">🕙 {{ evt.heure }}</span>
      <span v-if="evt.lieu">📍 {{ evt.lieu }}</span>
    </div>
    <p v-if="evt.description" class="event-desc" v-html="sanitizeHtml(evt.description)"></p>
    <div class="event-links" v-if="evt.lien || evt.billetterie">
      <a v-if="evt.lien" :href="evt.lien" target="_blank" rel="noopener" class="btn-event">En savoir plus</a>
      <a v-if="evt.billetterie" :href="evt.billetterie" target="_blank" rel="noopener" class="btn-event btn-event-outline">🎟️ Billetterie</a>
    </div>
  </div>
</article>
        </div>
        <div v-if="currentView === 'agenda'" class="agenda-list">
<div v-for="(group, gIdx) in groupedByDate" :key="gIdx" class="agenda-day-group">
  <h3 class="agenda-day-label">{{ formatDayLabel(group.date) }}</h3>
  <div v-for="evt in group.events" :key="evt.id" class="agenda-event" :class="{ 'event-mine': isMine(evt) }" @click="openEventModal(evt)" style="cursor:pointer">
    <span class="agenda-time">{{ evt.heure || '—' }}</span>
    <div class="agenda-event-body">
      <strong>{{ evt.titre }}</strong>
      <span v-if="evt.lieu" class="agenda-lieu">{{ evt.lieu }}</span>
      <p v-if="evt.description" class="agenda-desc" v-html="sanitizeHtml(evt.description)"></p>
    </div>
  </div>
</div>
          <p v-if="!erreur && filteredEvents.length === 0" class="empty-msg">Aucun événement pour cette période.</p>
        </div>
      </div>
    </section>

    <div v-if="loading" class="loading-msg">Chargement des événements...</div>
    <!-- Hors des vues (mois/semaine/cartes/…) : le message doit apparaître
         quelle que soit celle affichée, et la vue par défaut est « mois », où
         aucune liste — donc aucun message de liste vide — n'est rendue. -->
    <div v-else-if="erreur" class="loading-msg">Les événements n'ont pas pu être chargés. Réessayez dans un instant.</div>

    <EventModal
    v-if="eventModal.open && eventModal.event"
    v-model="eventModal.open"
    :title="eventModal.event.titre"
    @close="closeEventModal"
    >
    <template #default>
      <EventImageSlider v-if="eventModal.event.images && eventModal.event.images.length > 0"
                    :images="eventModal.event.images"
                    :altPrefix="'Photo '"
                    :initialIndex="eventModal.imageIndex || 0"
  />
      <div class="event-modal-info">
        <div class="event-modal-meta">
          <span v-if="eventModal.event.date">📅 {{ formatDate(eventModal.event.date) }}</span>
          <span v-if="eventModal.event.dateFin">→ {{ formatDate(eventModal.event.dateFin) }}</span>
          <span v-if="eventModal.event.heure">🕙 {{ eventModal.event.heure }}<template v-if="eventModal.event.fin"> – {{ eventModal.event.fin }}</template></span>
          <span v-if="eventModal.event.lieu">📍 {{ eventModal.event.lieu }}</span>
        </div>
        <div class="event-modal-desc" v-if="eventModal.event.description" v-html="sanitizeHtml(eventModal.event.description)"></div>
        <div class="event-modal-links" v-if="eventModal.event.lien || eventModal.event.billetterie">
          <a v-if="eventModal.event.lien" :href="eventModal.event.lien" target="_blank" rel="noopener" class="btn-event">En savoir plus</a>
          <a v-if="eventModal.event.billetterie" :href="eventModal.event.billetterie" target="_blank" rel="noopener" class="btn-event btn-event-outline">🎟️ Billetterie</a>
        </div>
        <!-- Présence : visible uniquement pour un membre connecté participant à cet événement -->
        <div v-if="memberLoggedIn && isMine(eventModal.event)" class="event-attendance">
          <p class="attendance-label">Ta présence :</p>
          <div class="attendance-choices">
            <button
              :class="{ active: attendanceFor(eventModal.event) === 'present' }"
              @click="setModalAttendance('present')"
            >✓ Présent</button>
            <button
              :class="{ active: attendanceFor(eventModal.event) === 'maybe' }"
              @click="setModalAttendance('maybe')"
            >? Peut-être</button>
            <button
              :class="{ active: attendanceFor(eventModal.event) === 'absent' }"
              @click="setModalAttendance('absent')"
            >✗ Absent</button>
          </div>
        </div>
      </div>
    </template>
  </EventModal>

  <!-- Modale de jour -->
  <Teleport to="body">
    <div v-if="dayModal.open" class="day-modal-overlay" @click.self="closeDayModal">
      <div class="day-modal">
        <button class="day-modal-close" @click="closeDayModal">&times;</button>
        <h3 class="day-modal-title">{{ formatDayModalDate(dayModal.date) }}</h3>
        <div class="day-modal-events">
          <div
            v-for="evt in dayModal.events"
            :key="evt.id"
            class="day-modal-event"
            @click="closeDayModal(); openEventModal(evt)"
          >
            <div class="day-modal-event-header">
              <span class="day-modal-event-dot" :class="getEventColor(evt)"></span>
              <strong class="day-modal-event-title">{{ evt.titre }}</strong>
            </div>
            <div class="day-modal-event-meta">
              <span v-if="evt.heure" class="day-modal-event-time">🕙 {{ evt.heure }}</span>
              <span v-if="evt.lieu" class="day-modal-event-lieu">📍 {{ evt.lieu }}</span>
            </div>
          </div>
          <p v-if="dayModal.events.length === 0" class="empty-msg">Aucun événement ce jour.</p>
        </div>
      </div>
    </div>
  </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import EventModal from '~/components/EventModal.vue'
import EventImageSlider from '~/components/EventImageSlider.vue'
import { sanitizeHtml as sanitizeHtmlXss } from '~/utils/sanitize'
import { isPast } from '~/utils/churchEvents.js'


useSeoMeta({
  title: "Agenda — Église Cieux Ouverts Morlaix",
  description: "Tous les événements à venir à l'Église Cieux Ouverts de Morlaix.",
})

// futureOnly: false — cette page permet de naviguer vers les mois/semaines
// passés (goPrev), donc a besoin de tout l'historique. Le composable filtre
// par défaut sur le futur (usage SiteHeader/event-list) ; ici c'est
// nextEvents (vue "Prochain") qui applique son propre filtre >= aujourd'hui.
const { evenements, loading, erreur } = useChurchEvents({ futureOnly: false })
const currentDate = ref(new Date())
const currentView = ref('month')

// --- Agenda personnel du membre connecté ---
// Désactivé avec l'espace membre (réglage ⚙️ Config « espaceMembre ») :
// une session membre restée ouverte ne doit plus rien afficher.
const { isLoggedIn: membreConnecte, authedFetch } = useMemberAuth()
const { espaceMembre, loadSiteSettings } = useSiteSettings()
const memberLoggedIn = computed(() => membreConnecte.value && espaceMembre.value)
const myParticipations = ref([])

async function loadMyParticipations() {
  if (!memberLoggedIn.value) return
  try {
    const res = await authedFetch('/api/member/events')
    myParticipations.value = res?.data || []
  } catch (e) {
    console.warn('agenda: participations membre indisponibles', e)
  }
}

function toIsoDay(d) {
  const date = d instanceof Date ? d : new Date(d)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function participationFor(evt) {
  if (!evt || !myParticipations.value.length) return null
  const day = evt.date ? toIsoDay(evt.date) : null
  return (
    myParticipations.value.find(
      (p) => p.event_id === evt.id && (p.occurrence_date === day || !p.occurrence_date),
    ) || null
  )
}

function isMine(evt) {
  return !!participationFor(evt)
}

function attendanceFor(evt) {
  return participationFor(evt)?.attendance_status || 'pending'
}

async function setModalAttendance(status) {
  const evt = eventModal.value.event
  const p = participationFor(evt)
  if (!p) return
  const previous = p.attendance_status
  p.attendance_status = status // optimiste
  try {
    await authedFetch(`/api/member/events/${evt.id}/attendance`, {
      method: 'POST',
      body: { status, occurrence_date: p.occurrence_date || toIsoDay(evt.date) },
    })
  } catch (e) {
    p.attendance_status = previous
    console.warn('agenda: présence non enregistrée', e)
  }
}

watch(memberLoggedIn, (v) => {
  if (v) loadMyParticipations()
})
onMounted(() => loadSiteSettings())

onMounted(() => {
  const saved = localStorage.getItem('agenda_view')
  if (saved && ['month','next','cards','agenda','week'].includes(saved)) {
    currentView.value = saved
  } else if (window.innerWidth < 480) {
    currentView.value = 'cards'
  }
  loadMyParticipations()
})
watch(currentView, (v) => {
  if (import.meta.client) localStorage.setItem('agenda_view', v)
})

// Modale d'événement individuel
const eventModal = ref({ open: false, event: null, imageIndex: 0 })

function openEventModal(evtObj, imageIndex = 0) {
  eventModal.value.event = evtObj
  eventModal.value.open = true
  eventModal.value.imageIndex = imageIndex || 0
}
function closeEventModal() {
  eventModal.value.open = false
  eventModal.value.event = null
  eventModal.value.imageIndex = 0
}

// Modale de jour (liste des événements d'un jour)
const dayModal = ref({ open: false, date: null, events: [] })

function openDayModal(dayOrDate) {
  let date, events
  if (typeof dayOrDate === 'number') {
    date = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth(), dayOrDate)
    events = getDayEvents(dayOrDate)
  } else {
    date = dayOrDate
    events = evenements.value.filter(evt => {
      const d = toDate(evt.date)
      return d.toDateString() === date.toDateString()
    })
  }
  if (events.length === 0) return
  dayModal.value = { open: true, date, events }
}
function closeDayModal() {
  dayModal.value.open = false
}

const dayNames = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.']

const monthLabel = computed(() =>
  currentDate.value.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
)

const periodLabel = computed(() => {
  if (currentView.value === 'week') {
    const start = weekDays.value[0]
    const end = weekDays.value[weekDays.value.length - 1]
    const opts = { day: 'numeric', month: 'long' }
    return `${start.date.toLocaleDateString('fr-FR', opts)} — ${end.date.toLocaleDateString('fr-FR', opts)}`
  }
  return monthLabel.value
})

const daysInMonth = computed(() => {
  const d = currentDate.value
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
})

const firstDayOfMonth = computed(() => {
  const d = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth(), 1)
  return (d.getDay() + 6) % 7
})

const weekDays = computed(() => {
  const d = new Date(currentDate.value)
  const dayOfWeek = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - dayOfWeek)
  const days = []
  for (let i = 0; i < 7; i++) {
    const date = new Date(d)
    date.setDate(d.getDate() + i)
    const day = date.getDate()
    const events = evenements.value.filter(evt => {
      const ed = toDate(evt.date)
      return ed.getDate() === day && ed.getMonth() === date.getMonth() && ed.getFullYear() === date.getFullYear()
    })
    days.push({ date, day, events })
  }
  return days
})

const filteredEvents = computed(() => {
  const d = currentDate.value
  const filtered = evenements.value.filter(evt => {
    const ed = toDate(evt.date)
    return ed.getMonth() === d.getMonth() && ed.getFullYear() === d.getFullYear()
  }).sort((a, b) => toDate(a.date) - toDate(b.date))

  return filtered
})

const nextEvents = computed(() => {
  // Vue "Prochain" : seule vue non bornée à un mois/semaine précis — doit
  // rester filtrée aux événements à venir maintenant que evenements inclut
  // aussi le passé (futureOnly: false ci-dessus, pour les vues calendrier).
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const seen = new Set()
  const groups = {}
  for (const evt of evenements.value) {
    if (seen.has(evt.id)) continue
    // Un événement sur plusieurs jours reste « à venir » jusqu'à son dernier jour.
    if (isPast(evt, today)) continue
    seen.add(evt.id)
    const dateKey = toDate(evt.date).toDateString()
    if (!groups[dateKey]) groups[dateKey] = { date: toDate(evt.date), events: [] }
    groups[dateKey].events.push(evt)
  }
  return Object.values(groups).sort((a, b) => a.date - b.date)
})

const groupedByDate = computed(() => {
  const map = {}
  filteredEvents.value.forEach(evt => {
    const key = toDate(evt.date).toDateString()
    if (!map[key]) map[key] = { date: toDate(evt.date), events: [] }
    map[key].events.push(evt)
  })
  return Object.values(map)
})

function isToday(day) {
  const now = new Date()
  return now.getDate() === day && now.getMonth() === currentDate.value.getMonth() && now.getFullYear() === currentDate.value.getFullYear()
}

function getDayEvents(day) {
  return evenements.value.filter(evt => {
    const d = toDate(evt.date)
    return d.getDate() === day && d.getMonth() === currentDate.value.getMonth() && d.getFullYear() === currentDate.value.getFullYear()
  })
}

const eventColors = ['color-blue', 'color-red', 'color-orange', 'color-purple', 'color-green']
function getEventColor(evt) {
  const idx = (evt.titre || '').charCodeAt(0) % eventColors.length
  return eventColors[idx]
}

function prev() {
  const d = new Date(currentDate.value)
  if (currentView.value === 'week') { d.setDate(d.getDate() - 7) }
  else { d.setMonth(d.getMonth() - 1) }
  currentDate.value = d
}

function next() {
  const d = new Date(currentDate.value)
  if (currentView.value === 'week') { d.setDate(d.getDate() + 7) }
  else { d.setMonth(d.getMonth() + 1) }
  currentDate.value = d
}

// Convertit les retours à la ligne en <br> puis passe par le vrai
// sanitizeHtml (utils/sanitize.js) qui retire scripts/handlers — le rendu
// se fait ensuite via v-html, donc cette étape XSS est obligatoire.
function sanitizeHtml(text) {
  if (typeof text !== 'string') return ''
  return sanitizeHtmlXss(text.replace(/\\n/g, '\n').replace(/\n/g, '<br>'))
}

function formatDate(date) {
  if (!date) return ''
  if (typeof date === 'string') date = new Date(date)
  try { return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) } catch (e) { return String(date) }
}

function toDate(ts) {
  if (!ts) return new Date()
  return ts.toDate ? ts.toDate() : new Date(ts)
}

function formatDay(ts) {
  return toDate(ts).toLocaleDateString('fr-FR', { day: '2-digit' })
}

function formatMonth(ts) {
  return toDate(ts).toLocaleDateString('fr-FR', { month: 'short' }).toUpperCase()
}

function formatDayLabel(date) {
  return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

function formatDayModalDate(date) {
  return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}
</script>

<style scoped>
.page-agenda { background: #fff; min-height: 100vh; }
.agenda-header { background: #fff; padding: 50px 48px 20px; border-bottom: 1px solid #e5e7eb; }
.agenda-title { font-family: var(--font-heading); font-size: 2.8em; font-weight: 700; font-style: italic; color: #064886; margin: 0 0 4px; }
.agenda-subtitle { font-size: 0.9em; color: #6b7280; margin: 0; }
.agenda-calendar { padding: 0 24px 40px; max-width: 1100px; margin: 0 auto; }
.calendar-nav { display: flex; align-items: center; gap: 12px; padding: 20px 0 16px; border-bottom: 1px solid #e5e7eb; }
.nav-btn { background: none; border: 1px solid #e5e7eb; border-radius: 6px; width: 32px; height: 32px; font-size: 1.2em; cursor: pointer; color: #374151; display: flex; align-items: center; justify-content: center; line-height: 1; transition: background .15s; }
.nav-btn:hover { background: #f9fafb; }
.calendar-month { font-size: 1.1em; font-weight: 700; color: #111827; margin: 0; text-transform: capitalize; }
.view-toggle { margin-left: auto; display: flex; gap: 4px; }
.view-btn { background: none; border: none; font-size: 0.82em; color: #6b7280; cursor: pointer; padding: 4px 8px; border-radius: 6px; white-space: nowrap; transition: all .15s; }
.view-btn:hover { color: #111827; background: #f9fafb; }
.view-btn.active { color: #2563eb; background: #eff6ff; font-weight: 600; }
.calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); }
.day-header { text-align: center; padding: 10px 4px; font-size: 0.82em; color: #374151; font-weight: 600; border-bottom: 1px solid #e5e7eb; }
.day-cell { min-height: 90px; padding: 6px; border-bottom: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb; cursor: pointer; transition: background .15s; }
.day-cell:nth-child(7n) { border-right: none; }
.day-cell:hover { background: #f9fafb; }
.day-cell.empty { cursor: default; }
.day-cell.empty:hover { background: transparent; }
.day-number { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; font-size: 0.85em; font-weight: 500; color: #4b5563; border-radius: 50%; margin-bottom: 4px; transition: all .15s; }
.day-number.today { background: #2563eb; color: #fff; font-weight: 700; }
.day-cell.has-events .day-number { font-weight: 600; }
.day-events { display: flex; flex-direction: column; gap: 2px; padding: 0; }
.event-pill { font-size: 0.75em; padding: 1px 6px; border-radius: 3px; color: white; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; display: block; }

/* Événements du membre connecté : surbrillance */
.event-pill.event-mine { outline: 2px solid #f6b93b; outline-offset: 1px; font-weight: 700; }
.event-card.event-mine { box-shadow: 0 0 0 2px #f6b93b, 0 2px 8px rgba(0,0,0,0.07); }
.agenda-event.event-mine { box-shadow: 0 0 0 2px #f6b93b; border-radius: 8px; }

/* Présence dans la modale */
.event-attendance { margin-top: 16px; padding-top: 14px; border-top: 1px solid #eee; }
.attendance-label { font-size: 0.85em; font-weight: 600; color: #555; margin-bottom: 8px; }
.attendance-choices { display: flex; gap: 8px; flex-wrap: wrap; }
.attendance-choices button {
  padding: 7px 14px; border: 1px solid #ddd; border-radius: 8px; background: #fff;
  font-size: 0.85em; cursor: pointer; color: #555; transition: all 0.15s;
}
.attendance-choices button.active { border-color: #064886; background: #064886; color: #fff; font-weight: 600; }
.color-blue { background: #2563eb; }
.color-red { background: #ef4444; }
.color-orange { background: #f59e0b; }
.color-purple { background: #8b5cf6; }
.color-green { background: #10b981; }
.calendar-footer { display: flex; align-items: center; justify-content: space-between; padding: 14px 0; border-top: 1px solid #e5e7eb; margin-top: 0; }
.tz-label { font-size: 0.82em; color: #6b7280; }
.btn-subscribe { display: inline-block; padding: 10px 24px; background: #ef4444; color: white; font-size: 0.9em; font-weight: 700; border-radius: 8px; text-decoration: none; transition: background 0.2s; }
.btn-subscribe:hover { background: #dc2626; }

/* Prochain */
.next-events { display: flex; flex-direction: column; gap: 12px; }
.next-event {
  display: flex; align-items: center; gap: 16px;
  background: #fff; border: 1px solid #e5e7eb; border-radius: 12px;
  padding: 16px 20px; cursor: pointer; transition: all .15s;
}
.next-event:hover { border-color: #2563eb; background: #f8faff; }
.next-event-date {
  display: flex; flex-direction: column; align-items: center;
  min-width: 50px; flex-shrink: 0;
}
.next-event-day { font-size: 1.4em; font-weight: 800; color: #111827; line-height: 1.1; }
.next-event-month { font-size: 0.7em; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: .04em; }
.next-event-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.next-event-item strong { font-size: 0.95em; font-weight: 600; color: #111827; display: block; }
.next-event-meta { display: flex; gap: 12px; font-size: 0.82em; color: #6b7280; flex-wrap: wrap; }
.next-event-arrow { font-size: 1.3em; color: #d1d5db; flex-shrink: 0; }

/* Cartes */
.events-list-section { padding: 40px 24px; }
.events-list-inner { max-width: 800px; margin: 0 auto; }
.events-list { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
@media (max-width: 900px) { .events-list { grid-template-columns: 1fr 1fr; gap: 18px; } }
@media (max-width: 600px) { .events-list { grid-template-columns: 1fr; gap: 12px; } }
.event-card { display: flex; flex-direction: column; gap: 0; background: white; border-radius: 14px; padding: 0 0 18px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.07); overflow: hidden; position: relative; min-height: 280px; }
.event-date-badge { position: absolute; top: 10px; left: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; min-width: 46px; background: rgba(6,72,134,0.97); border-radius: 9px; padding: 7px 5px 5px 5px; color: white; z-index: 2; box-shadow: 0 2px 10px rgba(6,72,134,0.13); }
.badge-day { font-size: 1.6em; font-weight: 900; line-height: 1; }
.badge-month { font-size: 0.65em; font-weight: 700; letter-spacing: 0.06em; opacity: 0.85; text-transform: uppercase; }
.event-body { flex: 1; display: flex; flex-direction: column; gap: 6px; padding: 14px 18px 2px 18px; }
.event-title { font-size: 1.05em; font-weight: 700; color: #111827; margin: 0; }
.event-meta { display: flex; gap: 14px; font-size: 0.85em; color: #6b7280; flex-wrap: wrap; }
.event-desc { font-size: 0.88em; color: #4b5563; line-height: 1.6; margin: 0; }
.event-links { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 4px; }
.btn-event { display: inline-block; padding: 8px 18px; background: #2563eb; color: white; font-size: 0.85em; font-weight: 600; border-radius: 8px; text-decoration: none; transition: background 0.2s; }
.btn-event:hover { background: #1d4ed8; }
.btn-event-outline { background: transparent; border: 2px solid #2563eb; color: #2563eb; }
.btn-event-outline:hover { background: #2563eb; color: white; }

/* Ordre du jour */
.agenda-list { display: flex; flex-direction: column; gap: 32px; }
.agenda-day-group { border-left: 3px solid #2563eb; padding-left: 20px; }
.agenda-day-label { font-size: 1.1em; font-weight: 700; color: #111827; margin: 0 0 12px; text-transform: capitalize; }
.agenda-event { display: flex; gap: 16px; padding: 10px 0; border-bottom: 1px solid #f3f4f6; }
.agenda-event:last-child { border-bottom: none; }
.agenda-time { flex-shrink: 0; width: 60px; font-size: 0.85em; color: #6b7280; font-weight: 600; padding-top: 1px; }
.agenda-event-body { display: flex; flex-direction: column; gap: 2px; }
.agenda-event-body strong { font-size: 0.95em; color: #111827; }
.agenda-lieu { font-size: 0.82em; color: #6b7280; }
.agenda-desc { font-size: 0.85em; color: #4b5563; margin: 2px 0 0; }
.empty-msg { text-align: center; color: #6b7280; padding: 40px; font-size: 1em; }
.loading-msg { text-align: center; padding: 40px; color: #6b7280; font-size: 1em; }
.event-card-img { width: 100%; height: 160px; object-fit: cover; background: #f3f4f6; display: block; }

/* Day modal */
.day-modal-overlay {
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(0,0,0,0.3);
  display: flex; align-items: center; justify-content: center;
  padding: 16px;
}
.day-modal {
  background: #fff; border-radius: 12px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.08);
  width: 100%; max-width: 480px;
  padding: 24px 20px 32px;
  position: relative;
  max-height: 80vh; overflow-y: auto;
}
.day-modal-close {
  position: absolute; top: 12px; right: 16px;
  background: #f3f4f6; border: none;
  width: 32px; height: 32px; border-radius: 50%;
  font-size: 1.3em; line-height: 1; color: #6b7280;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
}
.day-modal-close:hover { background: #e5e7eb; color: #111827; }
.day-modal-title {
  font-size: 1.1em; font-weight: 600; color: #111827;
  margin: 0 0 20px; padding-right: 32px;
}
.day-modal-events { display: flex; flex-direction: column; gap: 12px; }
.day-modal-event {
  background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px;
  padding: 14px 16px; cursor: pointer; transition: all .15s;
}
.day-modal-event:hover { border-color: #2563eb; background: #eff6ff; }
.day-modal-event-header { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
.day-modal-event-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.day-modal-event-title { font-size: 0.95em; font-weight: 600; color: #111827; }
.day-modal-event-meta { display: flex; gap: 14px; font-size: 0.82em; color: #6b7280; flex-wrap: wrap; margin-left: 18px; }
.day-modal-event-time, .day-modal-event-lieu { display: inline-flex; align-items: center; gap: 3px; }

@media (max-width: 768px) {
  .agenda-header { padding: 30px 16px 16px; }
  .agenda-title { font-size: 2em; }
  .agenda-calendar { padding: 0 8px 30px; }
  .day-cell { min-height: 70px; padding: 4px; }
  .day-number { width: 24px; height: 24px; font-size: 0.78em; }
  .event-pill {
    font-size: 0; width: 6px; height: 6px; padding: 0;
    border-radius: 50%; pointer-events: none;
  }
  .next-event { padding: 12px 14px; gap: 12px; }
  .next-event-day { font-size: 1.2em; }
}

@media (max-width: 480px) {
  .agenda-calendar { padding: 0 4px 20px; }
  .calendar-nav { flex-wrap: wrap; gap: 8px; padding: 12px 0; }
  .view-toggle { order: -1; width: 100%; justify-content: center; margin-left: 0; }
  .view-btn { font-size: 0.75em; padding: 4px 6px; }
  .day-cell { min-height: 56px; padding: 3px; }
  .day-number { width: 22px; height: 22px; font-size: 0.72em; }
  .day-header { font-size: 0.7em; padding: 6px 2px; }
  .calendar-footer { flex-direction: column; gap: 8px; align-items: flex-start; }
  .day-modal { padding: 20px 16px 24px; }
  .day-modal-title { font-size: 1em; }
}
</style>