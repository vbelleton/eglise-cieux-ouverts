<template>
  <Teleport to="body">
    <div v-if="open" class="taches-overlay" @click.self="$emit('close')">
      <div class="taches-modal">
        <header class="taches-header">
          <div>
            <h2>Tâches</h2>
            <p class="taches-sub">Qui fait quoi — une tâche prise ne peut plus être prise par quelqu'un d'autre.</p>
          </div>
          <button class="taches-close" @click="$emit('close')" title="Fermer">✕</button>
        </header>

        <div class="taches-filtres">
          <button
            v-for="f in FILTRES"
            :key="f.valeur"
            class="taches-filtre"
            :class="{ actif: filtre === f.valeur }"
            @click="filtre = f.valeur"
          >{{ f.libelle }} ({{ compteParSource(f.valeur) }})</button>

          <label class="taches-mines">
            <input type="checkbox" v-model="seulementLesMiennes" />
            Seulement les miennes
          </label>

          <div class="taches-vues">
            <button class="taches-vue" :class="{ actif: vue === 'kanban' }" @click="vue = 'kanban'">Tableau</button>
            <button class="taches-vue" :class="{ actif: vue === 'gantt' }" @click="vue = 'gantt'">Frise</button>
          </div>
        </div>

        <form class="taches-ajout" @submit.prevent="ajouter">
          <input v-model="nouveauTitre" placeholder="Nouvelle tâche…" maxlength="140" class="taches-input" />
          <select v-model="nouvelleSource" class="taches-select">
            <option value="service">Service</option>
            <option value="site">Site</option>
            <option value="projet">Projet</option>
          </select>
          <button type="submit" class="taches-btn" :disabled="!nouveauTitre.trim() || enregistre">
            {{ enregistre ? '…' : 'Ajouter' }}
          </button>
        </form>

        <p v-if="erreur" class="taches-erreur">{{ erreur }}</p>

        <!-- Import : transformer un élément existant en tâche suivie et
             attribuable, plutôt que de ressaisir son intitulé à la main. -->
        <div v-if="sources.length" class="taches-sources">
          <button class="taches-sources-titre" @click="sourcesOuvertes = !sourcesOuvertes">
            {{ sourcesOuvertes ? '▾' : '▸' }} À transformer en tâche ({{ sources.length }})
          </button>
          <div v-if="sourcesOuvertes" class="taches-sources-liste">
            <div v-for="s in sources" :key="s.type + s.id" class="taches-source-item">
              <span class="taches-source-badge">{{ s.type === 'demande' ? 'Demande' : 'Événement' }}</span>
              <span class="taches-source-txt">
                {{ s.libelle }}
                <em v-if="s.contexte" class="taches-source-ctx">{{ s.contexte }}</em>
              </span>
              <button class="taches-btn" :disabled="occupe === s.id" @click="importer(s)">
                {{ occupe === s.id ? '…' : 'Créer la tâche' }}
              </button>
            </div>
          </div>
        </div>

        <div v-if="chargement" class="taches-vide">Chargement…</div>
        <p v-else-if="taches.length === 0" class="taches-vide">
          Aucune tâche pour l'instant — ajoute la première ci-dessus.
        </p>

        <!-- Les colonnes restent affichées même à vide : elles montrent la
             structure du tableau et servent de cible de dépôt. -->
        <div v-if="!chargement && vue === 'kanban'" class="taches-colonnes">
          <section v-for="col in COLONNES" :key="col.statut" class="taches-colonne">
            <h3>{{ col.libelle }} <span class="taches-compte">{{ parStatut(col.statut).length }}</span></h3>

            <VueDraggable
              v-model="listes[col.statut]"
              :group="{ name: 'taches' }"
              :animation="150"
              ghost-class="taches-carte-ghost"
              tag="div"
              class="taches-liste"
              @add="(e) => deplacer(e, col.statut)"
            >
              <article v-for="t in listes[col.statut]" :key="t.id" class="taches-carte" :class="{ prise: t.prisPar }">
                <span class="taches-source" :data-source="t.source">{{ libelleSource(t.source) }}</span>
                <span v-if="t.origineType" class="taches-origine" :title="t.origineLibelle">
                  ↳ {{ t.origineType === 'demande' ? 'Demande développeur' : 'Événement' }}
                </span>
                <p class="taches-titre">{{ t.titre }}</p>

                <div class="taches-dates">
                  <input
                    type="date"
                    class="taches-date-input"
                    :value="t.debut || ''"
                    aria-label="Date de début"
                    @click.stop
                    @change="majDate(t, 'debut', $event.target.value)"
                  />
                  <span class="taches-fleche">→</span>
                  <input
                    type="date"
                    class="taches-date-input"
                    :value="t.fin || ''"
                    aria-label="Date de fin"
                    @click.stop
                    @change="majDate(t, 'fin', $event.target.value)"
                  />
                </div>

                <p v-if="t.prisPar" class="taches-titulaire">
                  <template v-if="estMoi(t.prisPar)">
                    {{ t.assignePar ? `🙌 Confiée par ${t.assignePar}` : '✋ Tu as pris cette tâche' }}
                  </template>
                  <template v-else>
                    {{ t.assignePar ? `👤 Confiée à ${t.prisPar}` : `🔒 Prise par ${t.prisPar}` }}
                  </template>
                </p>
                <p v-else class="taches-libre">Libre</p>

                <div class="taches-actions">
                  <button v-if="!t.prisPar" class="taches-btn taches-btn-prendre" :disabled="occupe === t.id" @click="prendre(t)">
                    {{ occupe === t.id ? '…' : 'Je prends' }}
                  </button>
                  <button
                    v-else-if="estMoi(t.prisPar) || monRole === 'admin'"
                    class="taches-btn taches-btn-second"
                    :disabled="occupe === t.id"
                    @click="liberer(t)"
                  >Libérer</button>

                  <button
                    v-if="peutSupprimer"
                    class="taches-supprimer"
                    title="Supprimer cette tâche"
                    @click="supprimer(t)"
                  >🗑</button>
                </div>

                <!-- Attribution : un responsable peut confier la tâche plutôt
                     que d'attendre que quelqu'un se propose. -->
                <div v-if="peutAssigner" class="taches-assigner" @click.stop>
                  <select class="taches-assigner-select" :value="t.prisPar || ''" @change="assigner(t, $event.target.value)">
                    <option value="">Confier à…</option>
                    <option v-for="m in membres" :key="m.email" :value="m.email">
                      {{ m.nom }}
                    </option>
                  </select>
                </div>
              </article>
            </VueDraggable>
          </section>
        </div>

        <!-- Frise : une ligne par tâche datée, positionnée sur l'échelle de
             temps commune. Les tâches sans dates sont listées à part plutôt
             que masquées, sinon elles disparaîtraient sans explication. -->
        <div v-if="!chargement && vue === 'gantt'" class="gantt">
          <p v-if="tachesDatees.length === 0" class="taches-vide">
            Aucune tâche datée. Renseigne un début et une fin sur une carte du tableau pour la voir apparaître ici.
          </p>

          <div v-else class="gantt-cadre">
            <div class="gantt-entete">
              <span class="gantt-col-titre">Tâche</span>
              <div class="gantt-echelle">
                <span
                  v-for="(rep, i) in reperes"
                  :key="i"
                  class="gantt-repere"
                  :style="{ left: rep.position + '%', transform: rep.decalage }"
                >{{ rep.libelle }}</span>
              </div>
            </div>

            <div v-for="t in tachesDatees" :key="t.id" class="gantt-ligne">
              <span class="gantt-col-titre" :title="t.titre">{{ t.titre }}</span>
              <div class="gantt-piste">
                <div
                  class="gantt-barre"
                  :data-source="t.source"
                  :class="{ terminee: t.statut === 'fait' }"
                  :style="barre(t)"
                  :title="`${t.titre} — ${t.debut} → ${t.fin}${t.prisPar ? ' — ' + t.prisPar : ' — libre'}`"
                >
                  <span class="gantt-etiquette">{{ t.prisPar ? abrege(t.prisPar) : 'libre' }}</span>
                </div>
              </div>
            </div>
          </div>

          <p v-if="tachesSansDates.length" class="gantt-sans-dates">
            Sans dates ({{ tachesSansDates.length }}) :
            <span v-for="t in tachesSansDates" :key="t.id" class="gantt-puce">{{ t.titre }}</span>
          </p>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'

const { $auth } = useNuxtApp()

const props = defineProps({
  open: { type: Boolean, default: false },
  /** Email de l'utilisateur courant, pour distinguer « mes » tâches. */
  monEmail: { type: String, default: '' },
  /** 'admin' | 'editor' | 'planning' — pilote les actions autorisées. */
  monRole: { type: String, default: '' },
})
defineEmits(['close'])

const COLONNES = [
  { statut: 'a_faire', libelle: 'À faire' },
  { statut: 'en_cours', libelle: 'En cours' },
  { statut: 'fait', libelle: 'Fait' },
]
const FILTRES = [
  { valeur: 'tous', libelle: 'Tout' },
  { valeur: 'service', libelle: 'Service' },
  { valeur: 'site', libelle: 'Site' },
  { valeur: 'projet', libelle: 'Projet' },
]
const LIBELLES_SOURCE = { service: 'Service', site: 'Site', projet: 'Projet' }

const taches = ref([])
const chargement = ref(false)
const enregistre = ref(false)
const occupe = ref(null)
const erreur = ref('')
const filtre = ref('tous')
const vue = ref('kanban')
const seulementLesMiennes = ref(false)
const nouveauTitre = ref('')
const nouvelleSource = ref('projet')
const sources = ref([])
const sourcesOuvertes = ref(true)

// Les colonnes doivent être des tableaux modifiables : vue-draggable-plus
// réordonne le tableau lié, ce qu'une computed ne permet pas.
const listes = ref({ a_faire: [], en_cours: [], fait: [] })

const peutSupprimer = computed(() => props.monRole === 'admin' || props.monRole === 'editor')
// Disposer du temps de quelqu'un d'autre n'est pas une action d'édition :
// réservé aux responsables, comme côté serveur.
const peutAssigner = computed(() => props.monRole === 'admin')
const membres = ref([])

function estMoi(email) {
  return !!email && email.toLowerCase() === (props.monEmail || '').toLowerCase()
}
function libelleSource(s) {
  return LIBELLES_SOURCE[s] || s
}

const tachesVisibles = computed(() =>
  taches.value.filter((t) => {
    if (filtre.value !== 'tous' && t.source !== filtre.value) return false
    if (seulementLesMiennes.value && !estMoi(t.prisPar)) return false
    return true
  })
)

function parStatut(statut) {
  return tachesVisibles.value.filter((t) => t.statut === statut)
}

function reconstruireColonnes() {
  listes.value = {
    a_faire: parStatut('a_faire'),
    en_cours: parStatut('en_cours'),
    fait: parStatut('fait'),
  }
}

function compteParSource(valeur) {
  return valeur === 'tous' ? taches.value.length : taches.value.filter((t) => t.source === valeur).length
}

watch([tachesVisibles], reconstruireColonnes, { immediate: true })
watch(() => props.open, (ouvert) => { if (ouvert) { charger(); chargerMembres() } })

// Le jeton vient de l'utilisateur Firebase courant. `getFirebaseToken` n'est
// pas un auto-import : c'est une fonction locale d'AdminToolbar, invisible
// ici — d'où une résolution directe via $auth.
async function jeton() {
  try {
    return await $auth?.currentUser?.getIdToken()
  } catch {
    return null
  }
}

async function appel(url, options = {}) {
  const token = await jeton()
  const res = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(options.headers || {}) },
  })
  if (!res.ok) {
    const corps = await res.json().catch(() => ({}))
    const err = new Error(corps.message || `HTTP ${res.status}`)
    err.status = res.status
    throw err
  }
  return res.json()
}

async function charger() {
  chargement.value = true
  erreur.value = ''
  try {
    const { taches: liste } = await appel('/api/taches')
    taches.value = liste
  } catch (e) {
    erreur.value = `Impossible de charger les tâches : ${e.message}`
  } finally {
    chargement.value = false
  }
  // Best effort : les sources enrichissent le tableau, leur absence ne doit
  // pas empêcher de travailler.
  try {
    const { sources: dispo } = await appel('/api/taches/sources')
    sources.value = dispo || []
  } catch (e) {
    console.warn('[taches] sources indisponibles :', e.message)
    sources.value = []
  }
}

/** Annuaire, pour le sélecteur d'attribution. Best effort : sans lui, on
 *  garde le tableau utilisable, seule l'attribution est indisponible. */
async function chargerMembres() {
  if (!peutAssigner.value) return
  try {
    const data = await appel('/api/members?size=100')
    membres.value = (data?.data || []).map((m) => ({
      email: m.email,
      nom: [m.first_name, m.last_name].filter(Boolean).join(' ') || m.email,
    }))
  } catch (e) {
    console.warn('[taches] annuaire indisponible :', e.message)
    membres.value = []
  }
}

async function assigner(tache, email) {
  if (!email) return
  if (tache.prisPar && tache.prisPar !== email) {
    if (!confirm(`Cette tâche est actuellement prise par ${tache.prisPar}.\n\nLa confier à ${email} à la place ?`)) return
  }
  occupe.value = tache.id
  erreur.value = ''
  try {
    await appel(`/api/taches/${tache.id}/assigner`, {
      method: 'POST',
      body: JSON.stringify({ email }),
    })
    await charger()
  } catch (e) {
    erreur.value = e.message
    await charger()
  } finally {
    occupe.value = null
  }
}

/** Transforme un élément existant en tâche, en gardant le lien vers lui. */
async function importer(source) {
  occupe.value = source.id
  erreur.value = ''
  try {
    await appel('/api/taches', {
      method: 'POST',
      body: JSON.stringify({
        titre: source.libelle,
        source: source.type === 'demande' ? 'site' : 'service',
        origineType: source.type,
        origineId: source.id,
        origineLibelle: source.libelle,
        // Un événement porte déjà sa date : la reprendre évite de la
        // ressaisir et place la tâche directement sur la frise.
        debut: source.debut || null,
        fin: source.fin || null,
      }),
    })
    await charger()
  } catch (e) {
    erreur.value = e.message
    // 409 = déjà importée entre-temps : on recharge pour refléter la réalité
    if (e.status === 409) await charger()
  } finally {
    occupe.value = null
  }
}

async function ajouter() {
  const titre = nouveauTitre.value.trim()
  if (!titre) return
  enregistre.value = true
  erreur.value = ''
  try {
    await appel('/api/taches', {
      method: 'POST',
      body: JSON.stringify({ titre, source: nouvelleSource.value }),
    })
    nouveauTitre.value = ''
    await charger()
  } catch (e) {
    erreur.value = e.message
  } finally {
    enregistre.value = false
  }
}

async function prendre(tache) {
  occupe.value = tache.id
  erreur.value = ''
  try {
    await appel(`/api/taches/${tache.id}/prendre`, { method: 'POST' })
    await charger()
  } catch (e) {
    // 409 = quelqu'un a été plus rapide : on recharge pour montrer la réalité
    erreur.value = e.message
    if (e.status === 409) await charger()
  } finally {
    occupe.value = null
  }
}

async function liberer(tache) {
  occupe.value = tache.id
  erreur.value = ''
  try {
    await appel(`/api/taches/${tache.id}/liberer`, { method: 'POST' })
    await charger()
  } catch (e) {
    erreur.value = e.message
  } finally {
    occupe.value = null
  }
}

async function supprimer(tache) {
  if (!confirm(`Supprimer la tâche « ${tache.titre} » ?\n\nCette action est irréversible.`)) return
  erreur.value = ''
  try {
    await appel(`/api/taches/${tache.id}`, { method: 'DELETE' })
    await charger()
  } catch (e) {
    erreur.value = e.message
  }
}

async function majDate(tache, champ, valeur) {
  erreur.value = ''
  try {
    await appel(`/api/taches/${tache.id}`, {
      method: 'PUT',
      body: JSON.stringify({ [champ]: valeur || null }),
    })
    await charger()
  } catch (e) {
    erreur.value = e.message
    await charger()
  }
}

// ─── Frise (Gantt) ────────────────────────────────────────────────────────
const JOUR_MS = 86400000

function versDate(iso) {
  // Midi UTC : évite qu'un décalage horaire fasse basculer la date d'un jour.
  return new Date(`${iso}T12:00:00Z`)
}

/** Seules les tâches ayant les DEUX bornes peuvent être placées sur la frise. */
const tachesDatees = computed(() =>
  tachesVisibles.value
    .filter((t) => t.debut && t.fin)
    .slice()
    .sort((a, b) => a.debut.localeCompare(b.debut))
)

const tachesSansDates = computed(() => tachesVisibles.value.filter((t) => !t.debut || !t.fin))

/** Échelle commune : de la première date au dernier terme, avec une marge. */
const plage = computed(() => {
  if (tachesDatees.value.length === 0) return null
  let min = Infinity
  let max = -Infinity
  for (const t of tachesDatees.value) {
    min = Math.min(min, versDate(t.debut).getTime())
    max = Math.max(max, versDate(t.fin).getTime())
  }
  // Une tâche d'un seul jour donnerait une largeur nulle : on garantit au
  // moins un jour d'amplitude, plus une marge visuelle de part et d'autre.
  const marge = JOUR_MS
  const debut = min - marge
  const fin = Math.max(max + marge, debut + 2 * JOUR_MS)
  return { debut, fin, duree: fin - debut }
})

function barre(t) {
  const p = plage.value
  if (!p) return {}
  const d = versDate(t.debut).getTime()
  const f = versDate(t.fin).getTime()
  const gauche = ((d - p.debut) / p.duree) * 100
  const largeur = Math.max(((f - d + JOUR_MS) / p.duree) * 100, 2)
  return { left: `${gauche}%`, width: `${Math.min(largeur, 100 - gauche)}%` }
}

/** Quelques repères de date le long de l'échelle, pour situer les barres. */
const reperes = computed(() => {
  const p = plage.value
  if (!p) return []
  const nb = 4
  const out = []
  for (let i = 0; i <= nb; i++) {
    const t = p.debut + (p.duree * i) / nb
    // Les repères des extrémités sont alignés vers l'intérieur : centrés,
    // le premier et le dernier déborderaient de moitié hors du cadre.
    const decalage = i === 0 ? 'none' : i === nb ? 'translateX(-100%)' : 'translateX(-50%)'
    out.push({
      position: (i / nb) * 100,
      decalage,
      libelle: new Date(t).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
    })
  }
  return out
})

function abrege(email) {
  return email.split('@')[0]
}

/** Carte déposée dans une autre colonne : on persiste le nouvel avancement. */
async function deplacer(evenement, nouveauStatut) {
  const carte = listes.value[nouveauStatut]?.[evenement.newIndex]
  if (!carte || carte.statut === nouveauStatut) return
  erreur.value = ''
  try {
    await appel(`/api/taches/${carte.id}`, {
      method: 'PUT',
      body: JSON.stringify({ statut: nouveauStatut }),
    })
    await charger()
  } catch (e) {
    erreur.value = e.message
    await charger()
  }
}
</script>

<style scoped>
.taches-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.taches-modal {
  background: #fff;
  border-radius: 14px;
  width: min(1100px, 100%);
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  padding: 20px;
  overflow-y: auto;
}
.taches-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}
.taches-header h2 {
  margin: 0;
  color: #064886;
  font-size: 1.4rem;
}
.taches-sub {
  margin: 2px 0 0;
  font-size: 0.8rem;
  color: #6b7280;
}
.taches-close {
  border: none;
  background: none;
  font-size: 1.2rem;
  cursor: pointer;
  color: #6b7280;
}
.taches-filtres {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 14px 0 10px;
}
.taches-filtre {
  border: 1.5px solid #ddd;
  background: #f9fafb;
  border-radius: 20px;
  padding: 5px 12px;
  font-size: 0.78rem;
  cursor: pointer;
}
.taches-filtre.actif {
  background: #064886;
  border-color: #064886;
  color: #fff;
  font-weight: 600;
}
.taches-mines {
  margin-left: auto;
  font-size: 0.78rem;
  color: #4b5563;
  display: flex;
  align-items: center;
  gap: 5px;
}
.taches-ajout {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}
.taches-input,
.taches-select {
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 0.85rem;
}
.taches-input { flex: 1; }
.taches-btn {
  background: #064886;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 8px 14px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
}
.taches-btn:disabled { opacity: 0.5; cursor: default; }
.taches-btn-second { background: #6b7280; }
.taches-btn-prendre { background: #15803d; }
.taches-sources {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 8px 10px;
  margin-bottom: 10px;
  background: #f9fafb;
}
.taches-sources-titre {
  border: none;
  background: none;
  padding: 0;
  font-size: 0.78rem;
  font-weight: 600;
  color: #374151;
  cursor: pointer;
}
.taches-sources-liste { margin-top: 8px; display: flex; flex-direction: column; gap: 6px; }
.taches-source-item {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 6px 8px;
}
.taches-source-badge {
  flex: none;
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: #fef3c7;
  color: #92400e;
  border-radius: 4px;
  padding: 1px 6px;
}
.taches-source-txt { flex: 1; font-size: 0.8rem; color: #111827; min-width: 0; }
.taches-source-ctx { display: block; font-size: 0.7rem; color: #6b7280; font-style: normal; }
.taches-origine {
  display: inline-block;
  margin-left: 6px;
  font-size: 0.62rem;
  color: #6b7280;
}
.taches-erreur {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #b91c1c;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 0.82rem;
  margin: 0 0 10px;
}
.taches-vide {
  color: #6b7280;
  font-size: 0.85rem;
  padding: 24px 0;
  text-align: center;
}
.taches-colonnes {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
@media (max-width: 760px) {
  .taches-colonnes { grid-template-columns: 1fr; }
  .taches-ajout { flex-wrap: wrap; }
  .taches-ajout .taches-input { flex: 1 1 100%; }
}
.taches-colonne {
  background: #f3f4f6;
  border-radius: 10px;
  padding: 10px;
  min-width: 0;
}
.taches-colonne h3 {
  margin: 0 0 8px;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #4b5563;
}
.taches-compte {
  background: #d1d5db;
  border-radius: 10px;
  padding: 1px 7px;
  font-size: 0.72rem;
  margin-left: 4px;
}
.taches-liste { min-height: 60px; display: flex; flex-direction: column; gap: 8px; }
.taches-carte {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 10px;
  cursor: grab;
}
.taches-carte.prise { border-left: 3px solid #15803d; }
.taches-carte-ghost { opacity: 0.4; }
.taches-source {
  display: inline-block;
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-radius: 4px;
  padding: 1px 6px;
  background: #e5e7eb;
  color: #374151;
}
.taches-source[data-source='service'] { background: #dbeafe; color: #1e40af; }
.taches-source[data-source='site'] { background: #fef3c7; color: #92400e; }
.taches-source[data-source='projet'] { background: #ede9fe; color: #5b21b6; }
.taches-titre {
  margin: 6px 0 4px;
  font-size: 0.88rem;
  font-weight: 600;
  color: #111827;
}
.taches-dates {
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 0 0 4px;
}
.taches-date-input {
  border: 1px solid #e5e7eb;
  border-radius: 5px;
  padding: 2px 4px;
  font-size: 0.68rem;
  color: #4b5563;
  background: #fff;
  min-width: 0;
  flex: 1;
}
.taches-fleche { font-size: 0.7rem; color: #9ca3af; }

/* ─── Frise ─── */
.taches-vues { display: flex; gap: 4px; }
.taches-vue {
  border: 1.5px solid #ddd;
  background: #f9fafb;
  border-radius: 20px;
  padding: 5px 12px;
  font-size: 0.78rem;
  cursor: pointer;
}
.taches-vue.actif { background: #064886; border-color: #064886; color: #fff; font-weight: 600; }

.gantt-cadre { border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; }
.gantt-entete {
  display: flex;
  align-items: center;
  background: #f3f4f6;
  border-bottom: 1px solid #e5e7eb;
  padding: 6px 0;
}
.gantt-col-titre {
  width: 180px;
  flex: none;
  padding: 0 10px;
  font-size: 0.78rem;
  color: #374151;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.gantt-echelle { position: relative; flex: 1; height: 16px; }
.gantt-repere {
  position: absolute;
  font-size: 0.65rem;
  color: #6b7280;
  white-space: nowrap;
}
.gantt-ligne {
  display: flex;
  align-items: center;
  border-top: 1px solid #f3f4f6;
  padding: 6px 0;
}
.gantt-piste { position: relative; flex: 1; height: 22px; margin-right: 10px; }
.gantt-barre {
  position: absolute;
  top: 0;
  height: 22px;
  border-radius: 5px;
  background: #7c3aed;
  display: flex;
  align-items: center;
  padding: 0 6px;
  min-width: 2px;
}
.gantt-barre[data-source='service'] { background: #2563eb; }
.gantt-barre[data-source='site'] { background: #d97706; }
.gantt-barre[data-source='projet'] { background: #7c3aed; }
.gantt-barre.terminee { opacity: 0.45; }
.gantt-etiquette {
  font-size: 0.62rem;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.gantt-sans-dates { margin: 10px 0 0; font-size: 0.75rem; color: #6b7280; }
.gantt-puce {
  display: inline-block;
  background: #f3f4f6;
  border-radius: 10px;
  padding: 1px 8px;
  margin: 2px 4px 0 0;
}
@media (max-width: 760px) {
  .gantt-col-titre { width: 110px; }
}
.taches-titulaire { margin: 0; font-size: 0.75rem; color: #15803d; font-weight: 600; }
.taches-libre { margin: 0; font-size: 0.75rem; color: #9ca3af; }
.taches-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
}
.taches-assigner { margin-top: 6px; }
.taches-assigner-select {
  width: 100%;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 3px 5px;
  font-size: 0.72rem;
  color: #4b5563;
  background: #fff;
}
.taches-supprimer {
  margin-left: auto;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 0.85rem;
  opacity: 0.6;
}
.taches-supprimer:hover { opacity: 1; }
</style>
