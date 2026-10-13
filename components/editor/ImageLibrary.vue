<template>
  <Teleport to="body">
    <div class="imglib-overlay" @click.self="$emit('close')">
      <div
        ref="dialogEl"
        class="imglib"
        role="dialog"
        aria-modal="true"
        aria-label="Médiathèque"
        tabindex="-1"
        @keydown.esc="$emit('close')"
      >
        <header class="imglib-head">
          <h3>🖼️ Médiathèque</h3>
          <button class="imglib-close" aria-label="Fermer la médiathèque" @click="$emit('close')">✕</button>
        </header>

        <div class="imglib-actions">
          <input ref="fileInput" type="file" accept="image/*" multiple class="imglib-file" @change="onFiles" />
          <button class="imglib-btn" :disabled="uploading" @click="fileInput?.click()">
            {{ uploading ? `Envoi… ${progress}` : '📤 Téléverser depuis l\'ordinateur' }}
          </button>
          <input v-model="search" type="search" class="imglib-search" placeholder="Rechercher par nom" aria-label="Rechercher une image" />
        </div>
        <div class="imglib-tabs" role="tablist">
          <button role="tab" :aria-selected="onglet === 'envois'" :class="{ actif: onglet === 'envois' }" @click="onglet = 'envois'">Mes images ({{ images.length }})</button>
          <button role="tab" :aria-selected="onglet === 'site'" :class="{ actif: onglet === 'site' }" @click="onglet = 'site'">Images du site ({{ visiblesSite.length }})</button>
        </div>
        <p class="imglib-hint">Les photos sont redimensionnées et allégées automatiquement avant l'envoi.</p>
        <p v-if="error" class="imglib-error">{{ error }}</p>

        <div v-if="onglet === 'envois' && loading" class="imglib-msg">Chargement des images…</div>
        <div v-else-if="!filtered.length" class="imglib-msg">
          {{ onglet === 'envois' ? 'Aucune image téléversée pour l\'instant.' : 'Aucune image ne correspond.' }}
        </div>
        <div v-else-if="onglet === 'envois'" class="imglib-grid">
          <ImageLibraryTile
            v-for="n in filtered"
            :key="n"
            :name="n"
            :label="libelle(n)"
            :selected="selected.includes(n)"
            :badge="multiple ? selected.indexOf(n) + 1 : '✓'"
            @toggle="toggle(n)"
          />
        </div>
        <div v-else class="imglib-groupes">
          <section v-for="g in groupesSite" :key="g.dossier" class="imglib-groupe">
            <h4>{{ g.dossier }} <span>({{ g.images.length }})</span></h4>
            <div class="imglib-grid">
              <ImageLibraryTile
                v-for="u in g.images"
                :key="u"
                :name="u"
                :url="u"
                :label="u.slice(1)"
                :selected="selected.includes(PREFIXE_SITE + u)"
                :badge="multiple ? selected.indexOf(PREFIXE_SITE + u) + 1 : '✓'"
                @toggle="toggle(PREFIXE_SITE + u)"
              />
            </div>
          </section>
        </div>

        <footer class="imglib-foot">
          <span class="imglib-count">{{ selected.length ? `${selected.length} sélectionnée(s)` : '' }}</span>
          <button class="imglib-btn imglib-btn-danger" :disabled="!(aSupprimer.length + siteASupprimer.length) || deleting" @click="supprimer">
            {{ deleting ? 'Suppression…' : '🗑 Supprimer' }}
          </button>
          <button class="imglib-btn imglib-btn-sec" @click="$emit('close')">Annuler</button>
          <button class="imglib-btn imglib-btn-primary" :disabled="!selected.length" @click="confirm">
            {{ multiple ? 'Ajouter la sélection' : 'Choisir cette image' }}
          </button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import ImageLibraryTile from '~/components/editor/ImageLibraryTile.vue'
import { listUploadedImageNames, uploadImageDetailed, imageUrl, deleteUploadedImages, listHiddenSiteImages, saveHiddenSiteImages } from '~/utils/imageUpload.js'
import imagesSite from '~/utils/siteImages.json'

// Images fournies avec le site : choisissables, mais jamais supprimables.
const PREFIXE_SITE = 'site:'

const props = defineProps<{ multiple?: boolean }>()
const emit = defineEmits<{ select: [urls: string[]]; close: [] }>()

const images = ref<string[]>([])
const masquees = ref<string[]>([])
const onglet = ref<'envois' | 'site'>('envois')
const deleting = ref(false)
const loading = ref(true)
const uploading = ref(false)
const progress = ref('')
const error = ref('')
const search = ref('')
const selected = ref<string[]>([])
const fileInput = ref<HTMLInputElement | null>(null)
const dialogEl = ref<HTMLElement | null>(null)

// « 1712345678901_ma-photo.jpg » → « ma-photo.jpg »
function libelle(name: string) {
  return name.replace(/^\d+_/, '')
}

// Images du site encore visibles (celles retirées par « Supprimer » n'apparaissent plus).
const visiblesSite = computed(() => (imagesSite as string[]).filter(u => !masquees.value.includes(u)))

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  const liste: string[] = onglet.value === 'envois' ? images.value : visiblesSite.value
  return q ? liste.filter(n => n.toLowerCase().includes(q)) : liste
})

// Images du site rangées par dossier (/images/…, /photos/…, racine).
const groupesSite = computed(() => {
  const parDossier = new Map<string, string[]>()
  for (const u of filtered.value) {
    const dossier = u.split('/').length > 2 ? u.split('/')[1] : 'Logos et images générales'
    const nom = dossier === 'Logos et images générales' ? dossier : `Dossier « ${dossier} »`
    if (!parDossier.has(nom)) parDossier.set(nom, [])
    parDossier.get(nom)!.push(u)
  }
  return [...parDossier.entries()].map(([dossier, imgs]) => ({ dossier, images: imgs }))
})

const aSupprimer = computed(() => selected.value.filter(n => !n.startsWith(PREFIXE_SITE)))
const siteASupprimer = computed(() => selected.value.filter(n => n.startsWith(PREFIXE_SITE)).map(n => n.slice(PREFIXE_SITE.length)))

async function supprimer() {
  const noms = aSupprimer.value
  const site = siteASupprimer.value
  if (!noms.length && !site.length) return
  const total = noms.length + site.length
  const msg = total === 1 ? 'Supprimer cette image de la médiathèque ?' : `Supprimer ces ${total} images de la médiathèque ?`
  const avert = site.length
    ? "\nLes images du site retirées restent affichées sur les pages qui les utilisent déjà ; les images téléversées supprimées y apparaîtront cassées."
    : "\nSi elle est utilisée sur une page, elle y apparaîtra cassée."
  if (!window.confirm(msg + avert)) return
  deleting.value = true
  error.value = ''
  try {
    if (noms.length) {
      const faites = await deleteUploadedImages(noms)
      if (faites.length < noms.length) error.value = `${noms.length - faites.length} image(s) n'ont pas pu être supprimées.`
      selected.value = selected.value.filter(n => !faites.includes(n))
      await load()
    }
    if (site.length) {
      masquees.value = await saveHiddenSiteImages([...new Set([...masquees.value, ...site])])
      selected.value = selected.value.filter(n => !n.startsWith(PREFIXE_SITE))
    }
  } catch (e: any) {
    error.value = e?.message || 'Suppression impossible.'
  } finally {
    deleting.value = false
  }
}

async function load() {
  loading.value = true
  try {
    images.value = await listUploadedImageNames()
    masquees.value = await listHiddenSiteImages().catch(() => [])
  } catch (e) {
    console.error('ImageLibrary: liste impossible', e)
    error.value = 'Impossible de charger la médiathèque.'
    images.value = []
  } finally {
    loading.value = false
  }
}

function toggle(nom: string) {
  if (!props.multiple) {
    selected.value = selected.value[0] === nom ? [] : [nom]
    return
  }
  const i = selected.value.indexOf(nom)
  if (i === -1) selected.value.push(nom)
  else selected.value.splice(i, 1)
}

async function onFiles(e: Event) {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files || [])
  input.value = ''
  if (!files.length) return
  uploading.value = true
  error.value = ''
  const echecs: string[] = []
  const nouvelles: string[] = []
  let faits = 0
  progress.value = `0/${files.length}`
  // Trois envois à la fois : plusieurs photos ne s'attendent plus l'une l'autre.
  const file_attente = [...files]
  const ouvrier = async () => {
    for (let file = file_attente.shift(); file; file = file_attente.shift()) {
      try {
        nouvelles.push((await uploadImageDetailed(file)).name)
      } catch (err: any) {
        console.error('ImageLibrary: envoi impossible', err)
        echecs.push(err?.message || file.name)
      }
      progress.value = `${++faits}/${files.length}`
    }
  }
  await Promise.all(Array.from({ length: Math.min(3, files.length) }, ouvrier))
  uploading.value = false
  progress.value = ''
  if (echecs.length) error.value = `Échec : ${echecs.join(', ')}`
  await load()
  // Les images qu'on vient d'envoyer sont présélectionnées.
  selected.value = props.multiple ? [...selected.value, ...nouvelles] : nouvelles.slice(-1)
}

async function confirm() {
  if (!selected.value.length) return
  try {
    emit('select', await Promise.all(selected.value.map(n => (n.startsWith(PREFIXE_SITE) ? n.slice(PREFIXE_SITE.length) : imageUrl(n)))))
  } catch (e) {
    console.error('ImageLibrary: adresse introuvable', e)
    error.value = 'Impossible de récupérer cette image.'
  }
}

onMounted(() => {
  load()
  nextTick(() => dialogEl.value?.focus())
})
</script>

<style scoped>
.imglib-overlay { position: fixed; inset: 0; background: rgba(10, 20, 40, 0.55); z-index: 100000; display: flex; align-items: center; justify-content: center; padding: 16px; }
.imglib { background: #fff; color: #1a1a2e; width: min(860px, 100%); max-height: 90vh; border-radius: 14px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3); outline: none; }
.imglib-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 1px solid #e5e7eb; }
.imglib-head h3 { margin: 0; font-size: 1.05em; color: #064886; }
.imglib-close { background: none; border: none; font-size: 1.2em; cursor: pointer; color: #666; }
.imglib-actions { display: flex; gap: 10px; padding: 12px 18px 0; flex-wrap: wrap; }
.imglib-file { display: none; }
.imglib-search { flex: 1; min-width: 160px; padding: 8px 10px; border: 1px solid #ddd; border-radius: 8px; font: inherit; }
.imglib-hint { margin: 6px 18px 0; font-size: 0.78em; color: #6b7280; }
.imglib-error { margin: 8px 18px 0; color: #b91c1c; font-size: 0.85em; }
.imglib-msg { padding: 40px 18px; text-align: center; color: #6b7280; }
.imglib-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px; padding: 14px 18px; overflow-y: auto; }
.imglib-foot { display: flex; align-items: center; gap: 10px; padding: 12px 18px; border-top: 1px solid #e5e7eb; }
.imglib-count { flex: 1; font-size: 0.85em; color: #6b7280; }
.imglib-btn { padding: 8px 14px; border-radius: 8px; border: 1.5px solid #d1d5db; background: #f9fafb; cursor: pointer; font: inherit; font-size: 0.88em; }
.imglib-btn:disabled { opacity: 0.5; cursor: default; }
.imglib-btn-primary { background: #064886; border-color: #064886; color: #fff; }
.imglib-btn-sec { background: #fff; }
.imglib-btn-danger { border-color: #fca5a5; color: #b91c1c; background: #fff; }
.imglib-groupes { overflow-y: auto; padding: 4px 0 10px; }
.imglib-groupe h4 { margin: 12px 18px 0; font-size: 0.85em; color: #064886; }
.imglib-groupe h4 span { color: #6b7280; font-weight: 400; }
.imglib-groupe .imglib-grid { overflow: visible; }
.imglib-tabs { display: flex; gap: 6px; padding: 10px 18px 0; }
.imglib-tabs button { padding: 6px 12px; border: 1px solid #d1d5db; border-bottom: 2px solid transparent; background: #f9fafb; border-radius: 8px 8px 0 0; cursor: pointer; font: inherit; font-size: 0.86em; }
.imglib-tabs button.actif { background: #fff; border-bottom-color: #064886; color: #064886; font-weight: 600; }
</style>
