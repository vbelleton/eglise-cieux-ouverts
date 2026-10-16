<template>
  <div class="sidebar-autoeditor auto-editor">
    <!-- Panneaux groupés (Contenu / Médias / Mise en page / Couleurs / Avancé /
         Scripts). Le groupe d'un champ vient de `field.group` s'il est défini,
         sinon d'une classification automatique par type/nom (groupOf). -->
    <section
      v-for="group in groupedFields"
      :key="group.id"
      class="auto-group"
    >
      <button
        type="button"
        class="auto-group-header"
        :aria-expanded="!collapsed.has(group.id)"
        @click="toggleGroup(group.id)"
      >
        <span class="auto-group-title">{{ group.icon }} {{ group.label }}</span>
        <span class="auto-group-chevron" :class="{ open: !collapsed.has(group.id) }">▾</span>
      </button>
      <div v-show="!collapsed.has(group.id)" class="auto-group-body">
        <EditorFieldError
          v-for="field in group.fields"
          :key="field.key"
          :field-key="field.key"
        >
          <div
            class="auto-field"
            :class="{ 'auto-field-active': activeFieldKey === field.key }"
            :ref="(el) => { if (el) fieldRefs[field.key] = el }"
          >
            <div class="auto-field-header">
              <label class="field-label">{{ field.label }}</label>
              <button
                v-if="isPromotableField(field) && (isPromoted(field) || effectiveFieldValue(field))"
                type="button"
                class="field-promote-btn"
                :title="isPromoted(field) ? 'Déplacer/redimensionner cet élément sur la page' : 'Rendre cet élément déplaçable, redimensionnable et le sortir de sa place fixe dans le bloc'"
                @click="onMoveField(field)"
              >⇱ Déplacer</button>
            </div>
            <div
              v-if="isFontableField(field)"
              class="field-format-bar"
              role="group"
              :aria-label="`Mise en forme : ${field.label}`"
            >
              <button
                v-for="opt in FORMAT_OPTIONS"
                :key="opt.cle"
                type="button"
                class="field-format-btn"
                :class="[`field-format-${opt.cle}`, { 'field-format-on': formatValue(field.key)[opt.cle] }]"
                :aria-pressed="formatValue(field.key)[opt.cle] ? 'true' : 'false'"
                :title="opt.titre"
                :aria-label="opt.titre"
                @click="toggleFormat(field.key, opt.cle)"
              >{{ opt.lettre }}</button>
              <input
                type="color"
                class="field-format-color"
                :value="formatValue(field.key).couleur || '#000000'"
                title="Couleur du texte"
                aria-label="Couleur du texte"
                @input="setFormatColor(field.key, ($event.target as HTMLInputElement).value)"
              />
              <button
                v-if="formatValue(field.key).couleur"
                type="button"
                class="field-format-reset"
                title="Revenir à la couleur par défaut"
                aria-label="Revenir à la couleur par défaut"
                @click="setFormatColor(field.key, '')"
              >↺</button>
              <span class="field-format-sep" aria-hidden="true"></span>
              <input
                type="number"
                step="0.1"
                min="0.3"
                max="5"
                class="field-size-input"
                :value="fieldFontSizeValue(field.key)"
                title="Taille de police relative (1 = taille par défaut)"
                placeholder="Taille"
                @change="onFontSizeChange(field.key, ($event.target as HTMLInputElement).value)"
              />
              <select
                class="field-font-picker"
                :value="fieldFontValue(field.key)"
                title="Police de ce champ"
                @change="onFontChange(field.key, ($event.target as HTMLSelectElement).value)"
              >
                <option value="">Police par défaut</option>
                <optgroup v-for="g in fontGroups" :key="g.id" :label="g.label">
                  <option v-for="f in g.fonts" :key="f.value" :value="f.value">{{ f.label }}</option>
                </optgroup>
              </select>
            </div>
            <p v-if="isPromoted(field)" class="field-promoted-note">
              ↳ Déplacé sur la page. Clique « Déplacer » ci-dessus pour l'ajuster, ou sélectionne-le sur le bloc pour modifier son contenu.
            </p>
            <component
              v-else
              :is="fieldComponent(field.type)"
              :field="field"
              :value="effectiveFieldValue(field)"
              @change="onChange(field.key, $event)"
            />
          </div>
        </EditorFieldError>
      </div>
    </section>
    <FieldDesign
      v-if="modelValue?.type !== 'footer'"
      :model-value="modelValue"
      @update="onDesignUpdate"
    />
  </div>
</template>

<script setup lang="ts">
import type { FieldSchema, BlockInstance, ExtraElement } from '~/lib/blocks/types'
import { BLOCK_TYPES } from '~/utils/blockTypes.js'
import FieldText from './fields/FieldText.vue'
import FieldTextarea from './fields/FieldTextarea.vue'
import FieldRichText from './fields/FieldRichText.vue'
import FieldNumber from './fields/FieldNumber.vue'
import FieldColor from './fields/FieldColor.vue'
import FieldBoolean from './fields/FieldBoolean.vue'
import FieldSelect from './fields/FieldSelect.vue'
import FieldAnimation from './fields/FieldAnimation.vue'
import FieldImage from './fields/FieldImage.vue'
import FieldArray from './fields/FieldArray.vue'
import FieldImages from './fields/FieldImages.vue'
import EditorFieldError from './EditorFieldError.vue'
import FieldDesign from './FieldDesign.vue'
import { AVAILABLE_FONTS as availableFonts, FONT_GROUPS, fontStack } from '~/utils/fonts.js'
import { watch, nextTick, computed, reactive, provide } from 'vue'

const fontGroups = FONT_GROUPS.map((g) => ({ ...g, fonts: availableFonts.filter((f) => f.groupe === g.id) })).filter((g) => g.fonts.length)

const props = defineProps<{
  schema: FieldSchema[]
  modelValue: BlockInstance | null
}>()

// Le type de bloc n'est pas transmis aux composants de champ (ils ne
// reçoivent que `field` et `value`). On le fournit plutôt que d'ajouter un
// attribut à <component :is>, qui retomberait sur le DOM de tous les autres
// champs. FieldAnimation s'en sert pour ne proposer « D'origine » qu'aux
// blocs qui embarquent réellement une animation propre.
provide('blockType', computed(() => props.modelValue?.type || ''))

// ─── Regroupement des champs en panneaux ───────────────────────────────────
// Ordre fixe et libellés des panneaux de la sidebar. Un groupe sans champ
// n'est pas rendu (groupedFields filtre les groupes vides).
const GROUP_DEFS: { id: string; label: string; icon: string }[] = [
  { id: 'contenu', label: 'Contenu', icon: '📝' },
  { id: 'formulaire', label: 'Formulaire (champs et textes)', icon: '✏️' },
  { id: 'textes', label: 'Boutons et messages', icon: '💬' },
  { id: 'medias', label: 'Icônes / médias', icon: '🖼️' },
  { id: 'mise-en-page', label: 'Mise en page', icon: '📐' },
  { id: 'couleurs', label: 'Couleurs / thème', icon: '🎨' },
  { id: 'avance', label: 'Paramètres avancés', icon: '⚙️' },
  { id: 'scripts', label: 'Scripts / intégrations', icon: '🔌' },
]
const VALID_GROUPS = new Set(GROUP_DEFS.map((g) => g.id))

// Classification d'un champ : `field.group` explicite s'il est valide, sinon
// déduction par type + convention de nommage. Ne modifie jamais blockTypes.js
// ni les defaults → neutre pour le rendu des vitrines.
function groupOf(field: FieldSchema): string {
  const explicit = (field as { group?: string }).group
  if (explicit && VALID_GROUPS.has(explicit)) return explicit
  const key = field.key || ''
  if (field.type === 'color' || /colou?r|gradient|background|overlay(?!text)/i.test(key)) return 'couleurs'
  if (field.type === 'image' || field.type === 'images' || /image|img|photo|icon|logo|src|videoid|mapembed/i.test(key)) return 'medias'
  if (field.type === 'animation' || /height|width|column|align|reverse|visualstyle|openfirst|showbutton|spacing|padding|gap|layout|position/i.test(key)) return 'mise-en-page'
  if (/script|embed|customcss|rawhtml|integration/i.test(key)) return 'scripts'
  if (/advanced/i.test(key)) return 'avance'
  return 'contenu'
}

const groupedFields = computed(() => {
  const buckets: Record<string, FieldSchema[]> = {}
  const valeurs = props.modelValue?.props || {}
  for (const field of props.schema || []) {
    if (field.hiddenWhen?.(valeurs)) continue
    const g = groupOf(field)
    ;(buckets[g] ||= []).push(field)
  }
  return GROUP_DEFS
    .map((def) => ({ ...def, fields: buckets[def.id] || [] }))
    .filter((g) => g.fields.length > 0)
})

// État de repli par groupe (tous ouverts par défaut : rien n'est caché sans
// action de l'utilisateur). Les panneaux donnent la hiérarchie visuelle.
const collapsed = reactive(new Set<string>())
function toggleGroup(id: string) {
  if (collapsed.has(id)) collapsed.delete(id)
  else collapsed.add(id)
}

const emit = defineEmits<{
  update: [block: BlockInstance]
  promoted: [elementId: string]
}>()

// Champ identifié par le dernier clic direct sur le rendu du bloc (attribut
// data-field-key posé par les composants Block*.vue) — surligné + scrollé en
// vue ci-dessous pour que l'utilisateur retrouve immédiatement dans la
// sidebar l'élément sur lequel il vient de cliquer sur la page.
const { activeFieldKey, identifySeq, promoteFieldToElement } = useAdmin()
const fieldRefs: Record<string, HTMLElement> = {}
// Watch sur identifySeq (compteur incrémenté à CHAQUE clic), pas sur
// activeFieldKey directement : Vue ne déclenche pas un watch sur un ref
// primitif dont la valeur ne change pas (ex: re-cliquer le même champ déjà
// actif) — le scroll ne partait alors jamais pour ce cas précis.
watch(identifySeq, () => {
  const key = activeFieldKey.value
  if (!key) return
  nextTick(() => fieldRefs[key]?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
}, { immediate: true })

const FIELD_MAP: Record<string, any> = {
  text: FieldText,
  textarea: FieldTextarea,
  richtext: FieldRichText,
  number: FieldNumber,
  color: FieldColor,
  boolean: FieldBoolean,
  select: FieldSelect,
  animation: FieldAnimation,
  image: FieldImage,
  array: FieldArray,
  images: FieldImages,
}

function fieldComponent(type: string) {
  return FIELD_MAP[type]
}

// Champs texte simples uniquement (pas array/richtext sous-champs) — la
// police par champ ne descend pas dans les items d'un tableau (activités,
// FAQ...), portée volontairement limitée aux champs de premier niveau.
// Exclut aussi les champs "text" qui ne sont pas du texte visuel affiché
// (liens, URLs, CSS de gradient, ID vidéo) via une convention de nommage —
// pas de sens à proposer une police pour une URL ou un identifiant.
const NON_VISUAL_FIELD_PATTERN = /link|url|gradient|videoid|^alt$/i
// Textes de formulaire (libellés, bouton…), boutons et messages (groupe
// « textes ») et champs marqués `noStyle` : le
// composant ne leur applique ni police ni taille, et ils ne peuvent pas être
// détachés en élément libre — on n'affiche donc pas ces réglages sans effet.
function sansMiseEnForme(field: FieldSchema) {
  const group = (field as { group?: string }).group
  return group === 'formulaire' || group === 'textes' || Boolean((field as { noStyle?: boolean }).noStyle)
}
function isFontableField(field: FieldSchema) {
  if (sansMiseEnForme(field)) return false
  if (!['text', 'textarea', 'richtext'].includes(field.type)) return false
  return !NON_VISUAL_FIELD_PATTERN.test(field.key)
}

// N'émettre QUE le champ modifié (le récepteur fusionne : updateBlock /
// updateFooterBlock font `{ ...current.props, ...patch }`). Reconstruire tout
// `props` depuis modelValue perdait des modifications : les props Vue ne se
// mettent à jour qu'au tick suivant, donc deux champs modifiés dans le même
// tick (collage, autofill, remplissage scripté) partaient chacun d'un état
// périmé et le second écrasait le premier avec les anciennes valeurs.
function onChange(key: string, value: any) {
  if (!props.modelValue) return
  const updated = {
    ...props.modelValue,
    props: { [key]: value },
  }
  emit('update', updated)
  // Le bloc est déjà "triggered" (état stable) en admin dès son affichage —
  // sans rejeu explicite, changer le type d'animation ne produit aucune
  // différence visible tant qu'on ne revient pas sur la page publique.
  // On attend le prochain tick pour laisser le wrapper récupérer la
  // nouvelle classe block-anim-* avant de la rejouer.
  if (key === 'animation') {
    const blockId = props.modelValue.id
    nextTick(() => {
      document.dispatchEvent(new CustomEvent('replay-animation', { detail: { id: blockId } }))
    })
  }
}

// Un champ promu n'est plus rendu à sa place fixe (fieldFontStyle ne
// s'applique plus à rien) — police/taille doivent alors éditer le STYLE de
// l'élément libre correspondant (color/fontSize/fontFamily sur
// l'ExtraElement, lus par BlockExtraElementContent.vue), pas fieldFonts/
// fieldFontSizes. Sans ça, promouvoir un champ faisait disparaître ces
// réglages de la sidebar (ils dépendaient de !isPromoted) sans équivalent
// ailleurs — un champ promu n'était donc plus "que" déplaçable.
function promotedElementIdByKey(key: string) {
  return props.modelValue?.props?.extraElements?.find((el) => el.promotedFrom === key)?.id || null
}

function updatePromotedElementStyle(key: string, patch: Partial<ExtraElement>) {
  if (!props.modelValue) return
  const id = promotedElementIdByKey(key)
  if (!id) return
  const extraElements = (props.modelValue.props?.extraElements || []).map((el) =>
    el.id === id ? { ...el, ...patch } : el,
  )
  emit('update', { ...props.modelValue, props: { ...props.modelValue.props, extraElements } })
}

function fieldFontValue(key: string) {
  if (isPromotedKey(key)) {
    const id = promotedElementIdByKey(key)
    const el = props.modelValue?.props?.extraElements?.find((e) => e.id === id)
    return el?.fontFamily || ''
  }
  return props.modelValue?.props?.fieldFonts?.[key] || ''
}

function onFontChange(key: string, font: string) {
  if (!props.modelValue) return
  if (isPromotedKey(key)) {
    updatePromotedElementStyle(key, { fontFamily: font || undefined })
    return
  }
  const fieldFonts = { ...(props.modelValue.props?.fieldFonts || {}) }
  if (font) fieldFonts[key] = font
  else delete fieldFonts[key]
  // Delta seul (voir onChange) : ne pas renvoyer tout props depuis un
  // modelValue potentiellement périmé dans le même tick.
  const updated = {
    ...props.modelValue,
    props: { fieldFonts },
  }
  emit('update', updated)
}

// Valeur affichée dans le champ numérique (multiplicateur, ex: "1.4"),
// vide si aucun override — fieldFontSizes/ExtraElement.fontSize stockent la
// valeur CSS complète (ex: "1.4em") pour être directement utilisable par
// fieldFontStyle()/BlockExtraElementContent.vue.
function fieldFontSizeValue(key: string) {
  if (isPromotedKey(key)) {
    const id = promotedElementIdByKey(key)
    const el = props.modelValue?.props?.extraElements?.find((e) => e.id === id)
    const n = el?.fontSize ? parseFloat(String(el.fontSize)) : NaN
    return Number.isFinite(n) ? String(n) : ''
  }
  const raw = props.modelValue?.props?.fieldFontSizes?.[key]
  const n = raw ? parseFloat(String(raw)) : NaN
  return Number.isFinite(n) ? String(n) : ''
}

function onFontSizeChange(key: string, value: string) {
  if (!props.modelValue) return
  const n = parseFloat(value)
  const size = !value || !Number.isFinite(n) || n <= 0 ? undefined : `${n}em`
  if (isPromotedKey(key)) {
    updatePromotedElementStyle(key, { fontSize: size })
    return
  }
  const fieldFontSizes = { ...(props.modelValue.props?.fieldFontSizes || {}) }
  if (size) fieldFontSizes[key] = size
  else delete fieldFontSizes[key]
  // Delta seul (voir onChange).
  const updated = {
    ...props.modelValue,
    props: { fieldFontSizes },
  }
  emit('update', updated)
}

// Gras / italique / souligné / couleur par champ. Hors promotion, stockés
// dans props.fieldFonts._formats[clé] (lu par fieldFontStyle, déjà branché
// sur chaque champ des blocs) ; champ promu → sur l'ExtraElement
// (bold/italic/underline/color, lus par BlockExtraElementContent.vue).
type FormatCle = 'gras' | 'italique' | 'souligne'
interface FormatChamp { gras?: boolean; italique?: boolean; souligne?: boolean; couleur?: string }
const FORMAT_OPTIONS: { cle: FormatCle; lettre: string; titre: string }[] = [
  { cle: 'gras', lettre: 'G', titre: 'Gras' },
  { cle: 'italique', lettre: 'I', titre: 'Italique' },
  { cle: 'souligne', lettre: 'S', titre: 'Souligné' },
]
const CLE_ELEMENT: Record<FormatCle, 'bold' | 'italic' | 'underline'> = {
  gras: 'bold',
  italique: 'italic',
  souligne: 'underline',
}

function formatValue(key: string): FormatChamp {
  if (isPromotedKey(key)) {
    const id = promotedElementIdByKey(key)
    const el = props.modelValue?.props?.extraElements?.find((e) => e.id === id)
    if (!el) return {}
    return { gras: !!el.bold, italique: !!el.italic, souligne: !!el.underline, couleur: el.color || '' }
  }
  return props.modelValue?.props?.fieldFonts?._formats?.[key] || {}
}

function writeFormat(key: string, patch: FormatChamp) {
  if (!props.modelValue) return
  if (isPromotedKey(key)) {
    const elPatch: Partial<ExtraElement> = {}
    for (const cle of Object.keys(CLE_ELEMENT) as FormatCle[]) {
      if (cle in patch) elPatch[CLE_ELEMENT[cle]] = patch[cle] || undefined
    }
    if ('couleur' in patch) elPatch.color = patch.couleur || undefined
    updatePromotedElementStyle(key, elPatch)
    return
  }
  const fieldFonts = { ...(props.modelValue.props?.fieldFonts || {}) }
  const formats = { ...(fieldFonts._formats || {}) }
  const next: FormatChamp = { ...(formats[key] || {}), ...patch }
  for (const k of Object.keys(next) as (keyof FormatChamp)[]) {
    if (!next[k]) delete next[k]
  }
  if (Object.keys(next).length) formats[key] = next
  else delete formats[key]
  if (Object.keys(formats).length) fieldFonts._formats = formats
  else delete fieldFonts._formats
  // Delta seul (voir onChange).
  emit('update', { ...props.modelValue, props: { fieldFonts } })
}

function toggleFormat(key: string, cle: FormatCle) {
  writeFormat(key, { [cle]: !formatValue(key)[cle] })
}

function setFormatColor(key: string, couleur: string) {
  writeFormat(key, { couleur })
}

// "Rendre déplaçable" : convertit la valeur actuelle d'un champ fixe du
// bloc (image/texte/HTML) en élément libre du canvas (props.extraElements),
// pour lui donner le même comportement déplacer/redimensionner/éditer
// que les éléments ajoutés via le panneau — au lieu de rester figé à sa
// place dans la mise en page du bloc. richtext rendu via un kind dédié
// (BlockExtraElementContent applique sanitizeHtml + v-html, comme
// BlockRichText.vue) plutôt qu'affiché tel quel comme texte brut.
function isPromotableField(field: FieldSchema) {
  // Le footer est rendu hors PageRenderer (layouts/default.vue) : pas de
  // .block-wrapper ni de BlockExtraElementsCanvas, donc la promotion en
  // élément libre ne peut pas fonctionner — promoteFieldToElement ne le
  // trouve pas dans localBlocks et retournait null en silence (bouton mort).
  if (props.modelValue?.type === 'footer') return false
  if (sansMiseEnForme(field)) return false
  if (!['image', 'text', 'textarea', 'richtext'].includes(field.type)) return false
  return !NON_VISUAL_FIELD_PATTERN.test(field.key)
}

// sidebarBlock (useAdmin.js) expose les props BRUTES, non fusionnées avec
// BLOCK_TYPES[type].defaults comme le fait le rendu public (normalizeBlock) —
// un champ jamais modifié apparaît donc vide ici alors que la page affiche
// bien une valeur par défaut. On retombe sur ce default uniquement pour
// savoir CE QUI EST RÉELLEMENT AFFICHÉ à promouvoir, sans toucher à
// l'affichage des champs eux-mêmes ni au flux de sauvegarde habituel.
function effectiveFieldValue(field: FieldSchema) {
  return effectiveProp(field.key)
}

// Valeur effective d'une prop du bloc : la valeur brute si renseignée,
// sinon le default du type (comme le rendu public via normalizeBlock).
function effectiveProp(key: string) {
  const raw = props.modelValue?.props?.[key]
  if (raw !== undefined && raw !== null && raw !== '') return raw
  const type = props.modelValue?.type
  return type ? BLOCK_TYPES[type]?.defaults?.[key] : undefined
}

function isPromotedKey(key: string) {
  return !!props.modelValue?.props?.promotedFields?.includes(key)
}

function isPromoted(field: FieldSchema) {
  return isPromotedKey(field.key)
}

// Retrouve l'élément déjà promu correspondant à ce champ, pour relancer le
// positionnement dessus sans en recréer un doublon (bouton « Déplacer »
// toujours visible, y compris après une première promotion).
function promotedElementId(field: FieldSchema) {
  return promotedElementIdByKey(field.key)
}

// Bouton « Déplacer » : promeut le champ s'il ne l'est pas encore, ou
// relance directement le mode positionnement sur l'élément déjà promu.
function onMoveField(field: FieldSchema) {
  if (isPromoted(field)) {
    const id = promotedElementId(field)
    if (id) emit('promoted', id)
    return
  }
  promoteField(field)
}

// Construit l'élément (kind + contenu + apparence héritée), la position/
// taille réelle est mesurée et corrigée par promoteFieldToElement()
// (useAdmin.js — voir ce fichier pour le pourquoi de ce découpage).
function promoteField(field: FieldSchema) {
  if (!props.modelValue) return
  const value = effectiveFieldValue(field)
  if (!value) return
  const kind = field.type === 'image' ? 'image' : field.type === 'richtext' ? 'richtext' : 'text'
  const seed: Partial<ExtraElement> = {
    kind,
    ...(kind === 'image' ? { imageUrl: value, imageAlt: '' } : { text: value }),
  }

  // Reprend l'apparence que le champ avait dans le bloc pour que le texte
  // détaché ne devienne pas un texte générique (couleur/taille/police).
  // Ces clés (textColor/fontSize/fieldFonts) couvrent les blocs textuels du
  // site ; fontSize est en em côté blocs (ex: Bienvenue) → suffixé 'em' si
  // numérique. Un champ sans style particulier reste au défaut de .bee-text.
  if (kind === 'text' || kind === 'richtext') {
    const color = effectiveProp('textColor') ?? effectiveProp('color')
    if (color) seed.color = String(color)
    const fs = effectiveProp('fontSize')
    if (fs !== undefined && fs !== null && fs !== '') {
      seed.fontSize = typeof fs === 'number' ? `${fs}em` : String(fs)
    }
    const align = effectiveProp('textAlign') ?? effectiveProp('align')
    if (align) seed.textAlign = String(align)
    const fontName = props.modelValue.props?.fieldFonts?.[field.key]
    if (fontName && fontStack(fontName)) seed.fontFamily = fontName
    const format = formatValue(field.key)
    if (format.gras) seed.bold = true
    if (format.italique) seed.italic = true
    if (format.souligne) seed.underline = true
    if (format.couleur) seed.color = format.couleur
  }

  // promoteFieldToElement() lance elle-même le mode positionnement, une
  // fois la taille garantie stable (voir sa doc dans useAdmin.js) — émettre
  // 'promoted' ici déclencherait un positionnement prématuré (sidebar
  // cachée, élément monté) AVANT que la correction de taille n'ait eu lieu.
  promoteFieldToElement(props.modelValue.id, field.key, seed)
}

function onDesignUpdate(block: BlockInstance) {
  emit('update', block)
}
</script>

<style scoped>
.auto-editor { display: flex; flex-direction: column; gap: 10px; }

/* Panneaux groupés repliables */
.auto-group { border: 1px solid #e8edf3; border-radius: 10px; overflow: hidden; background: #fff; }
.auto-group-header {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 9px 12px;
  background: #f7f9fc;
  border: none;
  cursor: pointer;
  font: inherit;
  transition: background-color 0.15s;
}
.auto-group-header:hover { background: #eef3f9; }
.auto-group-title { font-size: 0.8em; font-weight: 600; color: #334155; letter-spacing: 0.01em; }
.auto-group-chevron { font-size: 0.7em; color: #94a3b8; transition: transform 0.2s; }
.auto-group-chevron.open { transform: rotate(180deg); }
.auto-group-body { display: flex; flex-direction: column; gap: 14px; padding: 12px; }

.auto-field { display: flex; flex-direction: column; gap: 5px; border-radius: 8px; transition: background-color 0.2s, box-shadow 0.2s; }
.auto-field-active { background: rgba(59, 130, 246, 0.08); box-shadow: 0 0 0 2px #3b82f6; padding: 8px; margin: -8px; }
.auto-field-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.field-label { font-size: 0.78em; color: #6b7280; font-weight: 500; }
.field-promote-btn {
  font-size: 0.68em;
  background: #eef4fa;
  border: 1px solid #cfe0ee;
  border-radius: 5px;
  color: #064886;
  padding: 2px 7px;
  cursor: pointer;
  white-space: nowrap;
}
.field-promote-btn:hover { background: #dceafb; }
.field-promoted-note {
  margin: 0;
  font-size: 0.75em;
  color: #64748b;
  font-style: italic;
  background: #f1f5f9;
  border-radius: 6px;
  padding: 6px 9px;
  line-height: 1.35;
}
.field-font-picker {
  font-size: 0.72em;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 5px;
  color: #555;
  padding: 2px 5px;
  max-width: 130px;
}
/* Barre de mise en forme sous le libellé : G/I/S, couleur et taille sur
   une ligne, la police sur toute la largeur en dessous (la sidebar est trop
   étroite pour tout aligner sans retours à la ligne désordonnés). */
.field-format-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; }
.field-format-bar .field-font-picker { flex: 1 1 100%; max-width: none; min-width: 0; height: 26px; }
.field-format-bar .field-size-input { height: 24px; box-sizing: border-box; }
.field-format-sep { width: 1px; height: 18px; background: #e2e8f0; margin: 0 2px; }
.field-format-btn {
  width: 26px;
  height: 24px;
  font-size: 0.8em;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 5px;
  color: #555;
  cursor: pointer;
  padding: 0;
  font-family: Georgia, serif;
}
.field-format-gras { font-weight: 700; }
.field-format-italique { font-style: italic; }
.field-format-souligne { text-decoration: underline; }
.field-format-btn.field-format-on { background: #064886; border-color: #064886; color: #fff; }
.field-format-color {
  width: 28px;
  height: 24px;
  border: 1px solid #ddd;
  border-radius: 5px;
  padding: 1px;
  background: #fff;
  cursor: pointer;
}
.field-format-reset {
  font-size: 0.85em;
  background: none;
  border: none;
  color: #064886;
  cursor: pointer;
  padding: 0 2px;
}
.field-size-input {
  font-size: 0.72em;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 5px;
  color: #555;
  padding: 2px 5px;
  width: 52px;
}
</style>
