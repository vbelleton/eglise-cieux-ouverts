<template>
  <div class="field-richtext" :class="{ 'rt-mode-code': modeCode }">
    <div class="rt-toolbar" role="toolbar" aria-label="Mise en forme du texte">
      <template v-if="!modeCode">
        <button
          v-for="b in boutons"
          :key="b.cmd"
          type="button"
          class="rt-btn"
          :class="[b.classe, { 'rt-actif': actifs[b.cmd] }]"
          :title="b.titre"
          :aria-label="b.titre"
          :aria-pressed="actifs[b.cmd] ? 'true' : 'false'"
          @mousedown.prevent
          @click="executer(b.cmd)"
        >{{ b.icone }}</button>
        <button
          type="button"
          class="rt-btn rt-lien"
          :class="{ 'rt-actif': actifs.lien }"
          :title="actifs.lien ? 'Modifier ou retirer le lien' : 'Ajouter un lien'"
          :aria-label="actifs.lien ? 'Modifier ou retirer le lien' : 'Ajouter un lien'"
          @mousedown.prevent
          @click="ouvrirLien"
        >🔗</button>
        <button
          type="button"
          class="rt-btn"
          title="Effacer la mise en forme"
          aria-label="Effacer la mise en forme"
          @mousedown.prevent
          @click="executer('removeFormat')"
        >⌫</button>
      </template>
      <button
        type="button"
        class="rt-btn rt-bascule"
        :title="modeCode ? 'Revenir à l\'éditeur de texte' : 'Voir et modifier le code HTML (avancé)'"
        @mousedown.prevent
        @click="basculerCode"
      >{{ modeCode ? '✓ Texte' : '</> HTML' }}</button>
    </div>

    <div v-if="lienOuvert" class="rt-lien-panneau">
      <input
        ref="champLien"
        v-model="adresseLien"
        type="url"
        inputmode="url"
        class="rt-lien-input"
        placeholder="https://… ou /contact"
        aria-label="Adresse du lien"
        @keydown.enter.prevent="validerLien"
        @keydown.esc.prevent="fermerLien"
      >
      <button type="button" class="rt-btn rt-ok" @click="validerLien">OK</button>
      <button v-if="actifs.lien" type="button" class="rt-btn" title="Retirer le lien" @click="retirerLien">Retirer</button>
      <button type="button" class="rt-btn" title="Annuler" @click="fermerLien">✕</button>
    </div>

    <div
      v-show="!modeCode"
      ref="zone"
      class="rt-zone"
      contenteditable="true"
      role="textbox"
      aria-multiline="true"
      :aria-label="field?.label || 'Texte'"
      @input="onInput"
      @focus="onFocus"
      @blur="onBlur"
      @paste="onPaste"
      @keyup="majActifs"
      @mouseup="majActifs"
    ></div>

    <textarea
      v-if="modeCode"
      class="rt-code"
      rows="8"
      :value="value"
      aria-label="Code HTML"
      @input="emettre(($event.target as HTMLTextAreaElement).value)"
    ></textarea>
    <p v-if="modeCode" class="rt-aide">Mode avancé : le texte est affiché avec ses balises HTML.</p>
  </div>
</template>

<script setup lang="ts">
// Éditeur de texte « comme un traitement de texte » pour les champs HTML
// (bloc Texte riche, corps du bloc Texte + Image…). Le contenu reste stocké
// en HTML, exactement comme avant : seul l'affichage dans l'admin change.
// Le code HTML reste accessible via « </> HTML » pour les contenus avancés
// (cartes intégrées, mises en page avec styles).
//
// Tant que la personne ne tape rien, rien n'est émis : ouvrir un bloc ne
// réécrit donc jamais son contenu.
import { ref, reactive, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { sanitizeHtml } from '~/utils/sanitize.js'

const props = defineProps<{ value: any; field: any }>()
const emit = defineEmits<{ change: [value: string] }>()

const zone = ref<HTMLElement | null>(null)
const champLien = ref<HTMLInputElement | null>(null)
const modeCode = ref(false)
const lienOuvert = ref(false)
const adresseLien = ref('')
let plageLien: Range | null = null
// Dernière valeur émise par la zone : quand le parent nous la renvoie, la
// zone est déjà à jour — la réécrire déplacerait le curseur au début.
let dernierEmis: string | null = null
let enEdition = false

const boutons = [
  { cmd: 'bold', icone: 'G', titre: 'Gras', classe: 'rt-gras' },
  { cmd: 'italic', icone: 'I', titre: 'Italique', classe: 'rt-italique' },
  { cmd: 'underline', icone: 'S', titre: 'Souligné', classe: 'rt-souligne' },
  { cmd: 'titre', icone: 'Titre', titre: 'Titre (cliquer à nouveau pour revenir au texte normal)', classe: 'rt-titre' },
  { cmd: 'insertUnorderedList', icone: '• Liste', titre: 'Liste à puces', classe: '' },
  { cmd: 'insertOrderedList', icone: '1. Liste', titre: 'Liste numérotée', classe: '' },
]

const actifs = reactive<Record<string, boolean>>({})

function texte(v: unknown) {
  return typeof v === 'string' ? v : v == null ? '' : String(v)
}

function remplirZone() {
  if (!zone.value) return
  zone.value.innerHTML = sanitizeHtml(texte(props.value))
}

function nettoyer(html: string) {
  // Zone vidée : le navigateur laisse souvent un <br> ou un paragraphe vide.
  const sansBalises = html.replace(/<br\s*\/?>/gi, '').replace(/<(p|div)>\s*<\/\1>/gi, '').trim()
  return sansBalises === '' ? '' : html
}

function emettre(v: string) {
  dernierEmis = v
  emit('change', v)
}

function onInput() {
  if (!zone.value) return
  emettre(nettoyer(zone.value.innerHTML))
  majActifs()
}

function onFocus() {
  enEdition = true
  try { document.execCommand('defaultParagraphSeparator', false, 'p') } catch {}
}

function onBlur() {
  enEdition = false
  // Le parent a pu transformer la valeur pendant la saisie (ex. zone vidée
  // remplacée par le texte par défaut) : on resynchronise en sortant.
  if (texte(props.value) !== dernierEmis) remplirZone()
}

// Collage : texte seul. Un copier-coller depuis un mail ou Word apporterait
// des polices, couleurs et tailles invisibles qui casseraient la mise en page.
function onPaste(e: ClipboardEvent) {
  const brut = e.clipboardData?.getData('text/plain')
  if (brut == null) return
  e.preventDefault()
  document.execCommand('insertText', false, brut)
}

function selectionDansZone() {
  const sel = window.getSelection()
  if (!sel || !sel.rangeCount || !zone.value) return null
  const plage = sel.getRangeAt(0)
  return zone.value.contains(plage.commonAncestorContainer) ? plage : null
}

function blocCourant(): string {
  try { return String(document.queryCommandValue('formatBlock') || '').toLowerCase().replace(/[<>]/g, '') } catch { return '' }
}

function lienCourant(): HTMLAnchorElement | null {
  const plage = selectionDansZone()
  let n: Node | null = plage ? plage.startContainer : null
  while (n && n !== zone.value) {
    if (n.nodeName === 'A') return n as HTMLAnchorElement
    n = n.parentNode
  }
  return null
}

function majActifs() {
  if (!selectionDansZone()) return
  for (const b of boutons) {
    if (b.cmd === 'titre') actifs.titre = ['h2', 'h3', 'h4'].includes(blocCourant())
    else {
      try { actifs[b.cmd] = document.queryCommandState(b.cmd) } catch { actifs[b.cmd] = false }
    }
  }
  actifs.lien = Boolean(lienCourant())
}

function onSelectionChange() {
  if (document.activeElement === zone.value) majActifs()
}

function executer(cmd: string) {
  if (!zone.value) return
  if (!selectionDansZone()) zone.value.focus()
  if (cmd === 'titre') {
    const estTitre = ['h2', 'h3', 'h4'].includes(blocCourant())
    document.execCommand('formatBlock', false, estTitre ? '<p>' : '<h3>')
  } else {
    document.execCommand(cmd, false)
  }
  onInput()
}

function ouvrirLien() {
  plageLien = selectionDansZone()?.cloneRange() || null
  adresseLien.value = lienCourant()?.getAttribute('href') || ''
  lienOuvert.value = true
  nextTick(() => champLien.value?.focus())
}

function restaurerSelection() {
  if (!zone.value) return
  zone.value.focus()
  if (plageLien) {
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(plageLien)
  }
}

function validerLien() {
  const url = adresseLien.value.trim()
  if (!url) return retirerLien()
  restaurerSelection()
  const lien = lienCourant()
  if (lien) {
    lien.setAttribute('href', url)
  } else if (!plageLien || plageLien.collapsed) {
    // Rien de sélectionné : on insère l'adresse elle-même comme texte du lien.
    const a = document.createElement('a')
    a.href = url
    a.textContent = url
    document.execCommand('insertHTML', false, a.outerHTML)
  } else {
    document.execCommand('createLink', false, url)
  }
  fermerLien()
  onInput()
}

function retirerLien() {
  restaurerSelection()
  const lien = lienCourant()
  if (lien) {
    const r = document.createRange()
    r.selectNodeContents(lien)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(r)
  }
  document.execCommand('unlink', false)
  fermerLien()
  onInput()
}

function fermerLien() {
  lienOuvert.value = false
  adresseLien.value = ''
  plageLien = null
}

function basculerCode() {
  modeCode.value = !modeCode.value
  fermerLien()
  if (!modeCode.value) nextTick(remplirZone)
}

watch(() => props.value, (v) => {
  if (modeCode.value) return
  if (texte(v) === dernierEmis) return
  if (enEdition && document.activeElement === zone.value) return
  remplirZone()
})

onMounted(() => {
  remplirZone()
  document.addEventListener('selectionchange', onSelectionChange)
})

onBeforeUnmount(() => {
  document.removeEventListener('selectionchange', onSelectionChange)
})
</script>

<style scoped>
.field-richtext {
  border: 1px solid #ddd;
  border-radius: 6px;
  background: #fff;
  overflow: hidden;
}
.field-richtext:focus-within { border-color: #064886; }
.rt-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 5px;
  background: #f6f8fc;
  border-bottom: 1px solid #e5e7eb;
}
.rt-btn {
  min-width: 32px;
  height: 32px;
  padding: 0 8px;
  border: 1px solid #d7dde6;
  border-radius: 5px;
  background: #fff;
  color: #1a1a2e;
  font-size: 0.82em;
  line-height: 1;
  cursor: pointer;
  touch-action: manipulation;
}
.rt-btn:hover { background: #eef4fa; }
.rt-btn.rt-actif { background: #064886; border-color: #064886; color: #fff; }
.rt-gras { font-weight: 700; }
.rt-italique { font-style: italic; font-family: Georgia, serif; }
.rt-souligne { text-decoration: underline; }
.rt-titre { font-weight: 700; }
.rt-bascule { margin-left: auto; font-family: monospace; font-size: 0.75em; color: #4b5563; }
.rt-lien-panneau {
  display: flex;
  gap: 4px;
  padding: 5px;
  border-bottom: 1px solid #e5e7eb;
  background: #fffdf5;
}
.rt-lien-input {
  flex: 1;
  min-width: 0;
  height: 32px;
  padding: 0 8px;
  border: 1px solid #d7dde6;
  border-radius: 5px;
  /* 16 px : en dessous, Safari iPhone zoome sur le champ au toucher. */
  font-size: 16px;
}
.rt-ok { background: #064886; color: #fff; border-color: #064886; }
.rt-zone {
  min-height: 120px;
  max-height: 420px;
  overflow-y: auto;
  padding: 8px 10px;
  color: #1a1a2e;
  font-size: 0.92em;
  line-height: 1.5;
  outline: none;
  overflow-wrap: anywhere;
  -webkit-user-select: text;
  user-select: text;
}
.rt-zone :deep(h1), .rt-zone :deep(h2) { font-size: 1.3em; margin: 0.4em 0; }
.rt-zone :deep(h3), .rt-zone :deep(h4) { font-size: 1.12em; margin: 0.4em 0; }
.rt-zone :deep(p) { margin: 0 0 0.6em; }
.rt-zone :deep(ul), .rt-zone :deep(ol) { margin: 0 0 0.6em; padding-left: 1.4em; }
.rt-zone :deep(a) { color: #064886; text-decoration: underline; }
.rt-zone :deep(img), .rt-zone :deep(iframe), .rt-zone :deep(video) { max-width: 100%; height: auto; }
.rt-zone :deep(iframe) { min-height: 160px; pointer-events: none; }
.rt-code {
  display: block;
  width: 100%;
  min-height: 160px;
  padding: 7px 10px;
  border: 0;
  color: #1a1a2e;
  font-size: 0.85em;
  font-family: monospace;
  outline: none;
  resize: vertical;
}
.rt-aide { margin: 0; padding: 4px 10px 6px; font-size: 0.72em; color: #6b7280; }
</style>
