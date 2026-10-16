// Polices sélectionnables pour la police par champ de texte (voir
// components/editor/AutoEditor.vue et fieldFontStyle ci-dessous).
// Liste fermée volontairement : chaque entrée doit exister sur Google Fonts
// et est chargée dynamiquement via un <link> quand elle est utilisée.
// N'accepter que ces valeurs empêche l'injection de CSS/URL arbitraire via
// le champ police (admin-only mais vaut mieux valider à la frontière).
// `groupe` classe la police dans le sélecteur de l'admin ; `weights` liste les
// graisses RÉELLEMENT proposées par Google Fonts : demander une graisse absente
// fait rejeter toute la feuille de style (la police ne se charge pas du tout).
export const FONT_GROUPS = [
  { id: "actuelles", label: "Polices actuelles du site" },
  { id: "sans", label: "Sans empattement (sobres)" },
  { id: "serif", label: "Avec empattement (classiques)" },
  { id: "titres", label: "Titres marqués" },
  { id: "manuscrites", label: "Manuscrites et décoratives" },
]

const sans = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif"
export const AVAILABLE_FONTS = [
  { value: "Nunito", label: "Nunito (actuel — texte)", groupe: "actuelles", weights: "400;600;700", stack: `'Nunito', ${sans}` },
  { value: "Playfair Display", label: "Playfair Display (actuel — titres)", groupe: "actuelles", weights: "400;600;700", stack: "'Playfair Display', serif" },

  { value: "Montserrat", label: "Montserrat", groupe: "sans", weights: "400;600;700", stack: "'Montserrat', sans-serif" },
  { value: "Poppins", label: "Poppins", groupe: "sans", weights: "400;600;700", stack: "'Poppins', sans-serif" },
  { value: "Open Sans", label: "Open Sans", groupe: "sans", weights: "400;600;700", stack: "'Open Sans', sans-serif" },
  { value: "Roboto", label: "Roboto", groupe: "sans", weights: "400;500;700", stack: "'Roboto', sans-serif" },
  { value: "Inter", label: "Inter", groupe: "sans", weights: "400;600;700", stack: `'Inter', ${sans}` },
  { value: "Raleway", label: "Raleway", groupe: "sans", weights: "400;600;700", stack: "'Raleway', sans-serif" },
  { value: "DM Sans", label: "DM Sans", groupe: "sans", weights: "400;600;700", stack: "'DM Sans', sans-serif" },
  { value: "Work Sans", label: "Work Sans", groupe: "sans", weights: "400;600;700", stack: "'Work Sans', sans-serif" },
  { value: "Source Sans 3", label: "Source Sans 3", groupe: "sans", weights: "400;600;700", stack: "'Source Sans 3', sans-serif" },
  { value: "Quicksand", label: "Quicksand (arrondie)", groupe: "sans", weights: "400;600;700", stack: "'Quicksand', sans-serif" },
  { value: "Josefin Sans", label: "Josefin Sans (élégante)", groupe: "sans", weights: "400;600;700", stack: "'Josefin Sans', sans-serif" },
  { value: "Rubik", label: "Rubik", groupe: "sans", weights: "400;500;700", stack: "'Rubik', sans-serif" },
  { value: "Fira Sans", label: "Fira Sans", groupe: "sans", weights: "400;600;700", stack: "'Fira Sans', sans-serif" },
  { value: "Lato", label: "Lato", groupe: "sans", weights: "400;700", stack: "'Lato', sans-serif" },

  { value: "Lora", label: "Lora", groupe: "serif", weights: "400;600;700", stack: "'Lora', serif" },
  { value: "Merriweather", label: "Merriweather", groupe: "serif", weights: "400;700", stack: "'Merriweather', serif" },
  { value: "Cormorant Garamond", label: "Cormorant Garamond (raffinée)", groupe: "serif", weights: "400;600;700", stack: "'Cormorant Garamond', serif" },
  { value: "EB Garamond", label: "EB Garamond", groupe: "serif", weights: "400;600;700", stack: "'EB Garamond', serif" },
  { value: "Libre Baskerville", label: "Libre Baskerville", groupe: "serif", weights: "400;700", stack: "'Libre Baskerville', serif" },
  { value: "Crimson Text", label: "Crimson Text", groupe: "serif", weights: "400;600;700", stack: "'Crimson Text', serif" },
  { value: "PT Serif", label: "PT Serif", groupe: "serif", weights: "400;700", stack: "'PT Serif', serif" },
  { value: "Cinzel", label: "Cinzel (capitales classiques)", groupe: "serif", weights: "400;600;700", stack: "'Cinzel', serif" },

  { value: "Oswald", label: "Oswald (condensée)", groupe: "titres", weights: "400;600;700", stack: "'Oswald', sans-serif" },
  { value: "Bebas Neue", label: "Bebas Neue (capitales)", groupe: "titres", weights: "400", stack: "'Bebas Neue', sans-serif" },
  { value: "Abril Fatface", label: "Abril Fatface (affiche)", groupe: "titres", weights: "400", stack: "'Abril Fatface', serif" },
  { value: "Archivo Black", label: "Archivo Black (très grasse)", groupe: "titres", weights: "400", stack: "'Archivo Black', sans-serif" },

  { value: "Dancing Script", label: "Dancing Script (cursive)", groupe: "manuscrites", weights: "400;600;700", stack: "'Dancing Script', cursive" },
  { value: "Pacifico", label: "Pacifico (cursive ronde)", groupe: "manuscrites", weights: "400", stack: "'Pacifico', cursive" },
  { value: "Caveat", label: "Caveat (écriture à la main)", groupe: "manuscrites", weights: "400;600;700", stack: "'Caveat', cursive" },
  { value: "Great Vibes", label: "Great Vibes (calligraphie)", groupe: "manuscrites", weights: "400", stack: "'Great Vibes', cursive" },
  { value: "Satisfy", label: "Satisfy", groupe: "manuscrites", weights: "400", stack: "'Satisfy', cursive" },
  { value: "Lobster", label: "Lobster", groupe: "manuscrites", weights: "400", stack: "'Lobster', cursive" },
  { value: "Amatic SC", label: "Amatic SC (dessinée)", groupe: "manuscrites", weights: "400;700", stack: "'Amatic SC', cursive" },
]

export function isValidFont(name) {
  return AVAILABLE_FONTS.some((f) => f.value === name)
}

export function fontWeights(name) {
  return AVAILABLE_FONTS.find((f) => f.value === name)?.weights || "400;600;700"
}

export function fontStack(name) {
  return AVAILABLE_FONTS.find((f) => f.value === name)?.stack || null
}

// Injecte le <link> Google Fonts pour une police si ce n'est pas déjà fait
// (idempotent — vérifie le href avant d'ajouter). Client uniquement.
export function ensureFontLoaded(name) {
  if (!isValidFont(name) || typeof document === "undefined") return
  const href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name).replace(/%20/g, "+")}:wght@${fontWeights(name)}&display=swap`
  if (document.querySelector(`link[href="${href}"]`)) return
  const link = document.createElement("link")
  link.rel = "stylesheet"
  link.href = href
  document.head.appendChild(link)
}

// Police (+ taille) par champ de texte (ex: props.fieldFonts = { title:
// "Lora" }, props.fieldFontSizes = { title: "1.4em" }) — override plus fin
// que le réglage global headingFont/bodyFont. Retourne un objet de style
// prêt pour :style, vide si aucun override pour ce champ. fieldFontSizes
// est optionnel : les appels existants à 2 arguments restent valides.
export function fieldFontStyle(fieldFonts, key, fieldFontSizes) {
  const style = {}
  const name = fieldFonts?.[key]
  if (name && isValidFont(name)) {
    ensureFontLoaded(name)
    style.fontFamily = fontStack(name)
  }
  const size = fieldFontSizes?.[key]
  if (size) style.fontSize = size
  Object.assign(style, formatStyle(fieldFonts?._formats?.[key]))
  return style
}

// Couleur saisie dans l'admin : seuls #rgb/#rrggbb(aa) et rgb()/rgba() sont
// acceptés, pour qu'une valeur arbitraire ne puisse pas injecter d'autre CSS.
const COULEUR_VALIDE = /^(#[0-9a-f]{3,4}|#[0-9a-f]{6}|#[0-9a-f]{8}|rgba?\(\s*[\d.\s,%]+\))$/i
export function couleurValide(c) {
  return typeof c === "string" && COULEUR_VALIDE.test(c.trim())
}

// Mise en forme d'un champ de texte (gras/italique/souligné/couleur), stockée
// dans props.fieldFonts._formats[clé] = { gras, italique, souligne, couleur }
// — rangée dans fieldFonts pour que tous les appels existants à
// fieldFontStyle() l'appliquent sans toucher chaque composant de bloc.
export function formatStyle(format) {
  const style = {}
  if (!format || typeof format !== "object") return style
  if (format.gras) style.fontWeight = "700"
  if (format.italique) style.fontStyle = "italic"
  if (format.souligne) style.textDecoration = "underline"
  if (couleurValide(format.couleur)) style.color = format.couleur.trim()
  return style
}
