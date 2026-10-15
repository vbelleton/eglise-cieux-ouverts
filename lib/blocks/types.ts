export interface FieldSchema {
  key: string
  label: string
  type: FieldType
  min?: number
  max?: number
  step?: number
  options?: string[]
  placeholder?: string
  subFields?: FieldSchema[]
  // Masque le champ dans l'éditeur quand il n'aurait aucun effet avec les
  // réglages actuels du bloc (ex. : champ propre à l'autre mise en page).
  hiddenWhen?: (props: Record<string, any>) => boolean
  // Texte affiché sans police/taille réglable ni « Déplacer ».
  noStyle?: boolean
  group?: string
}

export type FieldType =
  | 'text'
  | 'textarea'
  | 'richtext'
  | 'number'
  | 'color'
  | 'boolean'
  | 'select'
  | 'animation'
  | 'image'
  | 'array'
  | 'images'

export type AnimationStrategy = 'wrapper' | 'internal' | 'none'

// A named starting point for a block type, offered as a second step in the
// admin block picker when a type defines more than one. `props` is a
// partial override merged on top of `defaults` (see createBlock()) — it
// does not need to repeat every schema field, only the ones it changes.
export interface BlockTemplate {
  id: string
  label: string
  icon?: string
  props: Record<string, any>
}

export interface BlockSchema {
  type: string
  label: string
  icon: string
  category: BlockCategory
  defaults: Record<string, any>
  schema: FieldSchema[]
  component: string
  adminComponent?: string
  adminRenderer?: string
  animations: AnimationStrategy
  templates?: BlockTemplate[]
}

export type BlockCategory = 'content' | 'layout' | 'media' | 'hero'

export interface BlockInstance {
  id: string
  type: string
  props: Record<string, any>
  visibility: {
    desktop: boolean
    tablet: boolean
    mobile: boolean
  }
  // Per-device prop overrides merged on top of `props` at render time.
  // Desktop always uses the base `props`; tablet/mobile may override any key.
  responsive?: {
    tablet?: Record<string, any>
    mobile?: Record<string, any>
  }
}

// Éléments additionnels librement positionnables/redimensionnables, greffés
// après le contenu propre d'un bloc via `props.extraElements` (n'importe quel
// type de bloc, absent par défaut — voir components/blocks/BlockExtraElementsCanvas.vue
// et components/editor/FieldElements.vue). Position/taille en % de la zone
// canvas (pas en px) pour une mise à l'échelle proportionnelle responsive
// sans authoring séparé par device.
export type ExtraElementKind = 'text' | 'richtext' | 'image' | 'button'

export interface ExtraElement {
  id: string
  kind: ExtraElementKind
  text?: string
  imageUrl?: string
  imageAlt?: string
  buttonLabel?: string
  buttonLink?: string
  xPct: number
  yPct: number
  wPct: number
  hPct: number
  z: number
  // Style optionnel repris d'un champ promu via « Rendre déplaçable » pour
  // que le texte détaché conserve l'apparence qu'il avait dans le bloc.
  // color/fontSize/textAlign : valeurs CSS prêtes à l'emploi. fontFamily :
  // NOM de police (ex: "Lora"), résolu en stack + chargé à l'affichage,
  // même convention que props.fieldFonts (voir utils/fonts.js).
  color?: string
  fontSize?: string
  fontFamily?: string
  textAlign?: string
  // Mise en forme choisie dans la sidebar (boutons G/I/S de AutoEditor.vue).
  bold?: boolean
  italic?: boolean
  underline?: boolean
  // Clé du champ de schema d'origine si cet élément a été créé via « Rendre
  // déplaçable »/« Déplacer » (AutoEditor.vue) — permet de retrouver
  // l'élément déjà promu pour relancer le positionnement dessus (bouton
  // toujours visible) sans en recréer un doublon à chaque clic.
  promotedFrom?: string
  // Animation d'entrée jouée quand le bloc parent devient visible (id de
  // utils/blockTypes.js ANIMATIONS, ex: "fadeIn") — même déclenchement que
  // l'animation "wrapper" du bloc, pas d'observer dédié par élément.
  animation?: string
}

export interface EditorFieldProps {
  label: string
  value: any
  field: FieldSchema
  onChange: (value: any) => void
}

export interface TestScenario {
  blockType: string
  label: string
  props: Record<string, any>
  assertions: Assertion[]
}

export interface Assertion {
  type: 'visible' | 'text' | 'css' | 'count' | 'attribute' | 'notVisible'
  selector: string
  value?: string
  count?: number
  attr?: string
}

const VALID_FIELD_TYPES: FieldType[] = [
  'text', 'textarea', 'richtext', 'number', 'color',
  'boolean', 'select', 'animation', 'image', 'array', 'images',
]

const VALID_CATEGORIES: BlockCategory[] = ['content', 'layout', 'media', 'hero']
const VALID_ANIMATION_STRATEGIES: AnimationStrategy[] = ['wrapper', 'internal', 'none']

export interface ValidationError {
  type: string
  field: string
  message: string
}

export function validateBlockSchema(schema: BlockSchema): ValidationError[] {
  const errors: ValidationError[] = []

  if (!schema.type) {
    errors.push({ type: schema.type, field: 'type', message: 'type is required' })
  }
  if (!schema.label) {
    errors.push({ type: schema.type, field: 'label', message: 'label is required' })
  }
  if (!schema.icon) {
    errors.push({ type: schema.type, field: 'icon', message: 'icon is required' })
  }
  if (!VALID_CATEGORIES.includes(schema.category)) {
    errors.push({ type: schema.type, field: 'category', message: `category must be one of: ${VALID_CATEGORIES.join(', ')}, got "${schema.category}"` })
  }
  if (!VALID_ANIMATION_STRATEGIES.includes(schema.animations)) {
    errors.push({ type: schema.type, field: 'animations', message: `animations must be one of: ${VALID_ANIMATION_STRATEGIES.join(', ')}, got "${schema.animations}"` })
  }

  const seenKeys = new Set<string>()
  for (const field of schema.schema) {
    if (!field.key) {
      errors.push({ type: schema.type, field: '(unnamed)', message: 'field key is required' })
      continue
    }
    if (seenKeys.has(field.key)) {
      errors.push({ type: schema.type, field: field.key, message: `duplicate field key: ${field.key}` })
    }
    seenKeys.add(field.key)

    if (!field.label) {
      errors.push({ type: schema.type, field: field.key, message: `field "${field.key}" has no label` })
    }
    if (!VALID_FIELD_TYPES.includes(field.type)) {
      errors.push({ type: schema.type, field: field.key, message: `invalid field type "${field.type}". Valid: ${VALID_FIELD_TYPES.join(', ')}` })
    }
    if (!(field.key in schema.defaults)) {
      errors.push({ type: schema.type, field: field.key, message: `field "${field.key}" has no default value in defaults` })
    }
    if (field.type === 'select' && (!field.options || field.options.length < 1)) {
      errors.push({ type: schema.type, field: field.key, message: `select field "${field.key}" needs at least 1 option` })
    }
    if (field.type === 'number' && (field.min === undefined || field.max === undefined)) {
      errors.push({ type: schema.type, field: field.key, message: `number field "${field.key}" needs min and max` })
    }
    if (schema.animations === 'none' && field.type === 'animation') {
      errors.push({ type: schema.type, field: field.key, message: `block with animations='none' cannot have animation field "${field.key}"` })
    }
  }

  if (schema.templates) {
    const schemaKeys = new Set(schema.schema.map((f) => f.key))
    const seenTemplateIds = new Set<string>()
    for (const tpl of schema.templates) {
      if (!tpl.id) {
        errors.push({ type: schema.type, field: '(unnamed template)', message: 'template id is required' })
      } else if (seenTemplateIds.has(tpl.id)) {
        errors.push({ type: schema.type, field: tpl.id, message: `duplicate template id: ${tpl.id}` })
      } else {
        seenTemplateIds.add(tpl.id)
      }
      if (!tpl.label) {
        errors.push({ type: schema.type, field: tpl.id || '(unnamed template)', message: `template "${tpl.id}" has no label` })
      }
      for (const propKey of Object.keys(tpl.props || {})) {
        if (!schemaKeys.has(propKey)) {
          errors.push({ type: schema.type, field: tpl.id || '(unnamed template)', message: `template "${tpl.id}" references unknown prop "${propKey}" (not in schema)` })
        }
      }
    }
  }

  return errors
}

export function ALL_VALID_FIELD_TYPES(): FieldType[] {
  return [...VALID_FIELD_TYPES]
}
