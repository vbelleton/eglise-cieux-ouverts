/**
 * Central registry for block component names, CSS selectors, and dynamic imports.
 * Eliminates the 5 hardcoded maps that previously had to be manually kept in sync.
 */

function pascalCase(type: string): string {
  return type.replace(/-./g, s => s[1].toUpperCase()).replace(/^[a-z]/, s => s.toUpperCase())
}

function kebabCase(type: string): string {
  return type.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '')
}

export function getBlockComponentName(type: string): string {
  return `Block${pascalCase(type)}`
}

export function getBlockComponentPath(type: string): string {
  return `~/components/blocks/Block${pascalCase(type)}.vue`
}

export function getBlockCssSelector(type: string): string {
  const map: Record<string, string> = {
    hero: 'block-main-hero',
    aspirations: 'aspirations-viewport',
    vision: 'vision-section',
  }
  return map[type] || `block-${kebabCase(type)}`
}

// Use dynamic import loaders to avoid importing Vue SFCs at module load time.
// This keeps the module Node-friendly for tests (no static .vue imports).
export const BLOCK_MAP: Record<string, () => Promise<any>> = {
  hero: () => import('../../components/blocks/BlockHero.vue'),
  bienvenue: () => import('../../components/blocks/BlockBienvenue.vue'),
  activities: () => import('../../components/blocks/BlockActivities.vue'),
  textImage: () => import('../../components/blocks/BlockTextImage.vue'),
  rejoins: () => import('../../components/blocks/BlockRejoins.vue'),
  aspirations: () => import('../../components/blocks/BlockAspirations.vue'),
  contact: () => import('../../components/blocks/BlockContact.vue'),
  nousRejoindre: () => import('../../components/blocks/BlockNousRejoindre.vue'),
  richText: () => import('../../components/blocks/BlockRichText.vue'),
  gallery: () => import('../../components/blocks/BlockGallery.vue'),
  spacer: () => import('../../components/blocks/BlockSpacer.vue'),
  fullWidthImage: () => import('../../components/blocks/BlockFullWidthImage.vue'),
  vision: () => import('../../components/blocks/BlockVision.vue'),
  youtube: () => import('../../components/blocks/BlockYoutube.vue'),
  equipe: () => import('../../components/blocks/BlockEquipe.vue'),
  louange: () => import('../../components/blocks/BlockLouange.vue'),
  faq: () => import('../../components/blocks/BlockFaq.vue'),
  stats: () => import('../../components/blocks/BlockStats.vue'),
  iconGrid: () => import('../../components/blocks/BlockIconGrid.vue'),
  quote: () => import('../../components/blocks/BlockQuote.vue'),
  inscriptionAlpha: () => import('../../components/blocks/BlockInscriptionAlpha.vue'),
  bandeau: () => import('../../components/blocks/BlockBandeau.vue'),
  evenements: () => import('../../components/blocks/BlockEvenements.vue'),
  sectionTitle: () => import('../../components/blocks/BlockSectionTitle.vue'),
  callToAction: () => import('../../components/blocks/BlockCallToAction.vue'),
  infosPratiques: () => import('../../components/blocks/BlockInfosPratiques.vue'),
  temoignages: () => import('../../components/blocks/BlockTemoignages.vue'),
  colonnes: () => import('../../components/blocks/BlockColonnes.vue'),
  compteARebours: () => import('../../components/blocks/BlockCompteARebours.vue'),
  don: () => import('../../components/blocks/BlockDon.vue'),
  audio: () => import('../../components/blocks/BlockAudio.vue'),
  footer: () => import('../../components/blocks/BlockFooter.vue'),
}

export function getBlockTypes(): string[] {
  return Object.keys(BLOCK_MAP)
}

export function resolveBlockComponent(type: string) {
  // Return the loader function if present; consumers may call it to get a Promise
  // resolving to the component, or use it as an async component factory.
  return BLOCK_MAP[type] || BLOCK_MAP.richText
}
