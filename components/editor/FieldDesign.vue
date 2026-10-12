<template>
  <div class="design-section">
    <button class="design-toggle" @click="open = !open">
      <span>Design</span>
      <span class="design-chevron" :class="{ open }">▼</span>
    </button>
    <div v-if="open" class="design-fields">
      <div v-for="field in CHAMPS_EFFECTIFS" :key="field.key" class="design-field">
        <label class="field-label">{{ field.label }}</label>
        <component
          :is="fieldComponent(field.type)"
          :field="field"
          :value="props.modelValue?.props?.[field.key]"
          @change="onChange(field.key, $event)"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { DESIGN_FIELDS } from '~/utils/designDefaults.js'
import FieldText from './fields/FieldText.vue'
import FieldNumber from './fields/FieldNumber.vue'
import FieldColor from './fields/FieldColor.vue'
import FieldSelect from './fields/FieldSelect.vue'

const open = ref(false)

// Seuls les réglages d'emplacement sont réellement appliqués (sur le wrapper
// du bloc, voir PageRenderer). Police, taille, épaisseur, alignement du texte,
// couleurs et padding n'étaient lus par aucun bloc (ou écrasaient un réglage
// du bloc portant le même nom) : retirés de l'éditeur.
const CLES_EFFECTIVES = ['blockAlign', 'maxWidth', 'marginTop', 'marginBottom']
const CHAMPS_EFFECTIFS = DESIGN_FIELDS.filter((f) => CLES_EFFECTIVES.includes(f.key))

const props = defineProps({
  modelValue: { type: Object, default: null },
})

const emit = defineEmits(['update'])

const FIELD_MAP = {
  text: FieldText,
  number: FieldNumber,
  color: FieldColor,
  select: FieldSelect,
}

function fieldComponent(type) {
  return FIELD_MAP[type]
}

function onChange(key, value) {
  if (!props.modelValue) return
  emit('update', {
    ...props.modelValue,
    props: { ...props.modelValue.props, [key]: value },
  })
}
</script>

<style scoped>
.design-section {
  margin-top: 8px;
  border-top: 1px solid #eee;
  padding-top: 8px;
}
.design-toggle {
  background: none;
  border: none;
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  cursor: pointer;
  font-size: 0.85em;
  font-weight: 600;
  color: #555;
}
.design-toggle:hover {
  color: #1a1a2e;
}
.design-chevron {
  font-size: 0.7em;
  transition: transform 0.2s;
}
.design-chevron.open {
  transform: rotate(180deg);
}
.design-fields {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 8px 0;
}
.design-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.field-label {
  font-size: 0.75em;
  color: #6b7280;
  font-weight: 500;
}
</style>
