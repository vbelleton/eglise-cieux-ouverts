import { ANIMATIONS, BLOCK_TYPES, champsCommuns } from "~/utils/blockTypes.js";
import { mergeDesignDefaults } from "~/utils/designDefaults.js";
import { blockRegistry } from "./registry";
import {
  getBlockComponentName,
  getBlockCssSelector,
} from "./component-registry";
import type { BlockInstance, AnimationStrategy } from "./types";

export function getAnimationStrategy(type: string): AnimationStrategy {
  const entry = blockRegistry.get(type);
  if (entry) return entry.animations;
  const def = BLOCK_TYPES[type];
  if (def?.animations) return def.animations as AnimationStrategy;
  return "wrapper";
}

export function getAnimClass(block: BlockInstance): string {
  if (!block.props?.animation || block.props.animation === "none") return "";
  const strategy = getAnimationStrategy(block.type);
  if (strategy !== "wrapper") return "";
  const anim = ANIMATIONS.find((a) => a.id === block.props.animation);
  return anim ? `block-${anim.css}` : "";
}

/**
 * Marque les blocs dont l'animation est pilotée par le sélecteur, pour que
 * SEUL le choix de l'utilisateur soit visible.
 *
 * Bienvenue, Contact et Vision embarquent leurs propres @keyframes sur des
 * éléments INTERNES (lettres du titre, sous-titre, colonnes…), indépendantes
 * du sélecteur. Elles s'ajoutaient à l'animation choisie et, bien plus
 * spectaculaires, la masquaient : quel que soit le choix, on revoyait
 * l'animation d'origine du bloc — et « Aucune » n'arrêtait pas tout.
 *
 * Le style associé (assets/css/main.css) neutralise ces animations internes
 * sans toucher à celle du wrapper, qui porte le choix de l'utilisateur.
 *
 * Réservé aux blocs offrant réellement le choix : les types 'internal'
 * n'exposent aucun sélecteur, leur animation n'a jamais été décidée par
 * l'utilisateur et ne doit donc pas être coupée.
 */
export function getAnimControlClass(block: BlockInstance): string {
  if (getAnimationStrategy(block.type) !== "wrapper") return "";
  // « D'origine » : l'utilisateur redemande explicitement l'animation propre
  // du bloc, on ne la neutralise donc pas.
  if (block.props?.animation === "origine") return "";
  return "bloc-anim-controlee";
}

export function shouldUseTrigger(block: BlockInstance): boolean {
  const strategy = getAnimationStrategy(block.type);
  return strategy === "wrapper";
}

export function normalizeBlock(block: BlockInstance): BlockInstance {
  if (!block) return block;
  const copy = { ...block };
  let propsSrc = copy.props;
  if (propsSrc && propsSrc.props && typeof propsSrc.props === "object") {
    propsSrc = { ...propsSrc.props };
  }
  propsSrc = propsSrc || {};

  if (copy.type && BLOCK_TYPES[copy.type]) {
    // Champs vidés intentionnellement via "Rendre déplaçable" (promus en
    // élément libre de props.extraElements) : ne pas retomber sur le
    // default du type de bloc, qui recréerait visuellement le même
    // contenu qu'on vient de détacher de sa place fixe. N'affecte que
    // CETTE instance de bloc — les autres blocs du même type qui n'ont
    // jamais touché ce champ gardent leur default normalement.
    const promotedFields: string[] = Array.isArray(propsSrc.promotedFields)
      ? propsSrc.promotedFields
      : [];
    const safe: Record<string, any> = {};
    for (const [k, v] of Object.entries(propsSrc)) {
      // Un champ promu reste vide en permanence : ni son default, ni une
      // valeur re-saisie par mégarde dans la sidebar ne doivent réafficher
      // le contenu à sa place fixe — il vit désormais dans extraElements.
      if (promotedFields.includes(k)) {
        safe[k] = "";
      } else if (v !== "" && v !== null && v !== undefined) {
        safe[k] = v;
      }
    }
    copy.props = { ...BLOCK_TYPES[copy.type].defaults, ...safe };
  } else {
    copy.props = { ...propsSrc };
  }

  return mergeDesignDefaults(copy);
}

export function normalizeBlocks(blocks: BlockInstance[]): BlockInstance[] {
  return (blocks || []).map(normalizeBlock);
}

type Device = "desktop" | "tablet" | "mobile";

// Merge per-device overrides (block.responsive[device]) on top of base props.
// Desktop uses the base props unchanged. Returns a new block when overrides
// apply, otherwise the same block reference.
export function resolveResponsive(
  block: BlockInstance,
  device: Device,
): BlockInstance {
  if (!block || device === "desktop") return block;
  const overrides = (block as any).responsive?.[device];
  if (!overrides || typeof overrides !== "object") return block;
  const communs = champsCommuns(block.type);
  const safe: Record<string, any> = {};
  for (const [k, v] of Object.entries(overrides)) {
    if (communs.has(k)) continue;
    if (v !== "" && v !== null && v !== undefined) safe[k] = v;
  }
  if (Object.keys(safe).length === 0) return block;
  return { ...block, props: { ...block.props, ...safe } };
}

export function resolveBlocksForDevice(
  blocks: BlockInstance[],
  device: Device,
): BlockInstance[] {
  return (blocks || []).map((b) => resolveResponsive(b, device));
}

export function filterByVisibility(
  blocks: BlockInstance[],
  device: "desktop" | "tablet" | "mobile",
): BlockInstance[] {
  return blocks.filter((b) => {
    const v = b.visibility as Record<string, boolean | undefined> | undefined;
    if (device === "mobile" && v?.mobile === false) return false;
    if (device === "tablet" && v?.tablet === false) return false;
    if (device === "desktop" && v?.desktop === false) return false;
    return true;
  });
}

export { getBlockComponentName, getBlockCssSelector };
