/**
 * Page Builder — Définition des types de blocs
 * Chaque bloc a : type, label, icône, props par défaut, schema de propriétés éditables
 */

// Slugs occupés par une route statique dédiée (pages/*.vue) : jamais
// atteignables via le catch-all pages/[slug].vue. Source de vérité unique,
// importée à la fois côté client (useMenuEditor, pour filtrer/masquer ces
// entrées de la liste des pages custom) et côté serveur
// (server/api/pages/index.post.ts, pour interdire leur création — sans ça
// un admin pouvait créer une page "Contact" ou "Photos" en Firestore qui
// n'était jamais rendue nulle part, l'URL restant capturée par le fichier
// statique).
export const HARDCODED_SLUGS = ["accueil", "contact", "messages", "event-list", "agenda", "photos", "membre"];

export const ANIMATIONS = [
  { id: "none", label: "Aucune", css: "" },
  { id: "fadeIn", label: "Apparition", css: "anim-fadeIn" },
  { id: "slideUp", label: "Glisse haut", css: "anim-slideUp" },
  { id: "slideLeft", label: "Glisse gauche", css: "anim-slideLeft" },
  { id: "portal", label: "Portail 3D", css: "anim-portal" },
  { id: "zoom", label: "Zoom entrant", css: "anim-zoom" },
  { id: "bounce", label: "Rebond", css: "anim-bounce" },
  { id: "flip", label: "Flip horizontal", css: "anim-flip" },
  { id: "wave", label: "Vague", css: "anim-wave" },
];

// Blocs dotés de leur PROPRE animation, écrite dans le composant (titre qui
// se déploie lettre par lettre pour Bienvenue, colonnes de Contact, etc.).
// Elle est neutralisée par défaut, sans quoi elle se cumulerait à l'animation
// choisie et la masquerait — bien plus spectaculaire, c'est elle qu'on voyait
// quel que soit le choix. Ces blocs reçoivent donc une option supplémentaire
// pour la rétablir explicitement.
export const BLOCS_AVEC_ANIMATION_PROPRE = ["bienvenue", "contact", "vision"];

/** Valeur du choix « garder l'animation d'origine du bloc ». */
export const ANIMATION_ORIGINE = { id: "origine", label: "D'origine" };

const DEFAULT_MESSAGES_BODY = `<p>Les messages partages a l'eglise ne sont pas faits pour s'arreter au dimanche.</p><p>📺 Replonge dans la parole sur notre chaine YouTube :</p><ul><li>(Re)decouvre les messages qui t'ont touche.</li><li>Laisse Dieu te parler a nouveau, ou d'une maniere nouvelle.</li><li>Partage-les avec tes proches pour semer l'esperance autour de toi.</li></ul><p>Que ce soit pour approfondir, reentendre une parole qui t'a marque(e), ou rester connecte(e) dans la semaine, ces moments sont la pour toi.</p><p><strong>Abonne-toi des maintenant pour ne rien manquer et garde la flamme allumee.</strong></p>`;
const DEFAULT_MESSAGES_GRADIENT = `radial-gradient(circle at 94.35% 89.61%, #054886 0%, 20%, rgba(5, 72, 134, 0) 40%), radial-gradient(circle at 9.07% 95.57%, rgba(238, 108, 113, 0.99) 0%, 25%, rgba(238, 108, 113, 0) 50%), radial-gradient(circle at 4.04% 13.51%, #054886 0%, 42%, rgba(5, 72, 134, 0) 70%), radial-gradient(circle at 93.32% 10.65%, #EF4B54 0%, 42%, rgba(239, 75, 84, 0) 70%), radial-gradient(circle at 48.90% 49.52%, #FFFFFF 0%, 100%, rgba(255, 255, 255, 0) 100%)`;
// ─── TYPES DE BLOCS ────────────────────────────────────────────────────────────
export const BLOCK_TYPES = {
  hero: {
    label: "Hero (bannière)",
    icon: "🖼️",
    category: "hero",
    animations: "none",
    defaults: {
      image: "/foule-croix.png",
      height: 700,
      overlay: false,
      overlayColor: "rgba(0,0,0,0.3)",
      overlayText: "",
      textColor: "#064886",
      showButton: false,
      nameImage: "/images/hero-name-image.png",
    },
    schema: [
      { key: "image", label: "Image", type: "image" },
      { key: "nameImage", label: "Image titre", type: "image" },
      {
        key: "height",
        label: "Hauteur (px)",
        type: "number",
        min: 200,
        max: 900,
      },
      { key: "overlay", label: "Overlay sombre", type: "boolean" },
      { key: "overlayColor", label: "Fond overlay", type: "color" },
      { key: "overlayText", label: "Texte principal (remplace logo)", type: "text" },
      { key: "textColor", label: "Couleur texte", type: "color" },
      { key: "showButton", label: "Afficher bouton", type: "boolean" },
    ],
  },

  bienvenue: {
    label: "Bienvenue (lettres)",
    icon: "✨",
    category: "content",
    animations: "wrapper",
    defaults: {
      title: "BIENVENUE",
      subtitle: "à votre église",
      backgroundColor: "#ffffff",
      textColor: "#064886",
      animation: "portal",
      fontSize: 5,
    },
    schema: [
      { key: "title", label: "Titre", type: "text" },
      { key: "subtitle", label: "Sous-titre", type: "text" },
      { key: "backgroundColor", label: "Fond", type: "color" },
      { key: "textColor", label: "Couleur texte", type: "color" },
      { key: "animation", label: "Animation", type: "animation" },
      {
        key: "fontSize",
        label: "Taille police (titre uniquement, em)",
        type: "number",
        min: 2,
        max: 10,
      },
    ],
  },

  activities: {
    label: "Grille d'activités",
    icon: "🗂️",
    category: "content",
    animations: "wrapper",
    defaults: {
      items: [
        {
          title: "Rencontre du dimanche",
          description:
            "Un temps hebdomadaire pour se retrouver, célébrer et échanger ensemble.\n\nDécrivez ici le déroulé type : accueil, temps de louange, message, temps de prière.",
          image: "/images/activites-celebration.jpg",
        },
        {
          title: "Groupe de partage",
          description:
            "Un petit groupe qui se réunit régulièrement pour discuter, prier et grandir ensemble.\n\nPrécisez ici le rythme, le lieu et le public visé.",
          image: "/images/activites-priere.jpg",
        },
        {
          title: "Repas convivial",
          description:
            "Un moment de partage autour d'un repas, ouvert à tous.\n\nIndiquez ici la fréquence et les modalités de participation.",
          image: "/images/activites-repas.jpg",
        },
      ],
      // "none" conserve l'apparence actuelle : ces blocs n'avaient aucune
      // animation avant l'ajout du sélecteur.
      animation: "none",
    },
    schema: [
      {
        key: "items",
        label: "Activités",
        type: "array",
        subFields: [
          { key: "title", label: "Titre", type: "text" },
          { key: "description", label: "Description", type: "textarea" },
          { key: "image", label: "URL image", type: "text" },
        ],
      },
      { key: "animation", label: "Animation", type: "animation" },
    ],
  },

  textImage: {
    label: "Texte + Image",
    icon: "📝",
    category: "content",
    animations: "wrapper",
    defaults: {
      title: "Titre de la section",
      subtitle: "",
      body: "Contenu de la section.",
      image: "/photos/salle.jpg",
      images: [],
      reverse: false,
      visualStyle: "default",
      ctaText: "",
      ctaLink: "",
      buttons: [],
      backgroundColor: "#ffffff",
      textColor: "#1a1a2e",
      animation: "slideLeft",
    },
    schema: [
      { key: "title", label: "Titre", type: "text" },
      { key: "subtitle", label: "Sous-titre", type: "text" },
      { key: "body", label: "Contenu", type: "textarea" },
      { key: "image", label: "Image principale", type: "image" },
      { key: "images", label: "Images supplémentaires (galerie)", type: "images" },
      { key: "reverse", label: "Image à gauche", type: "boolean" },
      {
        key: "visualStyle",
        label: "Style visuel",
        type: "select",
        options: ["default", "messagesLaptop"],
      },
      { key: "ctaText", label: "Texte bouton principal", type: "text" },
      { key: "ctaLink", label: "Lien bouton principal", type: "text" },
      {
        key: "buttons",
        label: "Boutons supplémentaires",
        type: "array",
        subFields: [
          { key: "text", label: "Texte", type: "text" },
          { key: "link", label: "Lien", type: "text" },
        ],
      },
      { key: "backgroundColor", label: "Fond", type: "color" },
      { key: "textColor", label: "Couleur texte", type: "color" },
      { key: "animation", label: "Animation", type: "animation" },
    ],
    templates: [
      { id: "blank", label: "Vierge", icon: "📝", props: {} },
      {
        id: "ministry-presentation",
        label: "Présentation d'un ministère",
        icon: "🙌",
        props: {
          title: "Nom du ministère",
          subtitle: "Une équipe à votre service",
          body: "Présentez ici la mission et les activités de ce ministère.",
          ctaText: "En savoir plus",
          ctaLink: "/contact",
        },
      },
      {
        id: "event-highlight",
        label: "Mise en avant d'un événement",
        icon: "📅",
        props: {
          title: "Nom de l'événement",
          subtitle: "Date à préciser",
          body: "Décrivez l'événement, le lieu et comment s'inscrire.",
          reverse: true,
          ctaText: "S'inscrire",
          ctaLink: "/contact",
        },
      },
    ],
  },

  rejoins: {
    label: "Rejoins-nous",
    icon: "🤝",
    category: "content",
    animations: "internal",
    defaults: {
      title: "Rejoins-nous",
      subtitle: "Chaque dimanche",
      location: "dans votre ville",
      horaires: [
        { heure: "9h30", label: "Accueil café" },
        { heure: "10h00", label: "Célébration" },
      ],
      backgroundGradient:
        "linear-gradient(to bottom, #064886 0%, #e58b8b 100%)",
    },
    schema: [
      { key: "title", label: "Titre", type: "text" },
      { key: "subtitle", label: "Sous-titre", type: "text" },
      { key: "location", label: "Lieu", type: "text" },
      { key: "backgroundGradient", label: "Fond (CSS)", type: "text" },
      {
        key: "horaires",
        label: "Horaires",
        type: "array",
        subFields: [
          { key: "heure", label: "Heure", type: "text" },
          { key: "label", label: "Libellé", type: "text" },
        ],
      },
    ],
  },

  aspirations: {
    label: "Nos aspirations",
    icon: "🌟",
    category: "content",
    animations: "internal",
    defaults: {
      title: "Nos aspirations",
      items: [
        "Accueillir chacun avec bienveillance",
        "Célébrer et vivre notre foi ensemble",
        "Accompagner et soutenir les uns les autres",
        "Partager et transmettre nos convictions",
      ],
      backgroundColor: "#064886",
      textColor: "#ffffff",
    },
    schema: [
      { key: "title", label: "Titre", type: "text" },
      { key: "items", label: "Aspirations", type: "array", itemType: "text" },
      { key: "backgroundColor", label: "Fond", type: "color" },
      { key: "textColor", label: "Couleur texte", type: "color" },
    ],
  },

  contact: {
    label: "Formulaire contact",
    icon: "✉️",
    category: "content",
    animations: "wrapper",
    defaults: {
      title: "Tu veux nous contacter ?",
      addressTitle: "",
      addressLine: "",
      image: "",
      mapEmbedUrl: "",
      backgroundColor: "#064886",
      backgroundGradient: "#064886",
      textColor: "#ffffff",
      showQuestions: true,
      showSocials: true,
      animation: "fadeIn",
    },
    schema: [
      { key: "title", label: "Titre", type: "text" },
      { key: "addressTitle", label: "Adresse titre", type: "text" },
      { key: "addressLine", label: "Adresse ligne", type: "text" },
      { key: "image", label: "Image gauche", type: "image" },
      { key: "mapEmbedUrl", label: "URL carte", type: "text" },
      { key: "backgroundGradient", label: "Fond (CSS)", type: "text" },
      { key: "textColor", label: "Texte couleur", type: "color" },
      { key: "showQuestions", label: "Questions intro", type: "boolean" },
      { key: "showSocials", label: "Réseaux sociaux", type: "boolean" },
      { key: "animation", label: "Animation", type: "animation" },
    ],
  },

  nousRejoindre: {
    label: "Nous rejoindre (Cercle)",
    icon: "⚪",
    category: "content",
    animations: "internal",
    defaults: {
      title: "Nous rejoindre",
      link: "/contact",
      backgroundGradient:
        "linear-gradient(to bottom, #d97777 0%, #064886 100%)",
    },
    schema: [
      { key: "title", label: "Titre", type: "text" },
      { key: "link", label: "Lien", type: "text" },
      { key: "backgroundGradient", label: "Fond (CSS)", type: "text" },
    ],
  },

  richText: {
    label: "Texte riche",
    icon: "📄",
    category: "content",
    animations: "wrapper",
    defaults: {
      content: "Écrivez votre texte ici...",
      backgroundColor: "#ffffff",
      backgroundGradient: "",
      textColor: "#1a1a2e",
      textAlign: "left",
      padding: 60,
      animation: "fadeIn",
    },
    schema: [
      { key: "content", label: "Contenu HTML", type: "richtext" },
      { key: "backgroundColor", label: "Fond (couleur)", type: "color" },
      { key: "backgroundGradient", label: "Fond (dégradé)", type: "text" },
      { key: "textColor", label: "Couleur texte", type: "color" },
      {
        key: "textAlign",
        label: "Alignement",
        type: "select",
        options: ["left", "center", "right"],
      },
      {
        key: "padding",
        label: "Espacement (px)",
        type: "number",
        min: 0,
        max: 200,
      },
      { key: "animation", label: "Animation", type: "animation" },
    ],
    templates: [
      { id: "blank", label: "Vierge", icon: "📄", props: {} },
      {
        id: "announcement",
        label: "Annonce",
        icon: "📢",
        props: {
          content:
            "<h2>Titre de l'annonce</h2><p>Détails de l'annonce à venir.</p>",
          backgroundColor: "#fff7e6",
          textColor: "#7a4a00",
          textAlign: "center",
        },
      },
      {
        id: "testimony",
        label: "Témoignage",
        icon: "💬",
        props: {
          content:
            "<p><em>« Un témoignage marquant à partager ici. »</em></p><p>— Nom du témoin</p>",
          backgroundColor: "#f8f9fa",
          textAlign: "left",
        },
      },
      {
        id: "article",
        label: "Article",
        icon: "📰",
        props: {
          content:
            "<h2>Titre de l'article</h2><p>Introduction...</p><p>Développement...</p>",
          textAlign: "left",
          padding: 80,
        },
      },
    ],
  },

  gallery: {
    label: "Galerie photos",
    icon: "🖼️",
    category: "media",
    animations: "wrapper",
    defaults: {
      title: "",
      textColor: "#064886",
      images: [],
      columns: 3,
      backgroundColor: "#ffffff",
      animation: "fadeIn",
    },
    schema: [
      { key: "title", label: "Titre", type: "text" },
      { key: "textColor", label: "Couleur texte", type: "color" },
      { key: "images", label: "Images", type: "images" },
      { key: "columns", label: "Colonnes", type: "number", min: 1, max: 4 },
      { key: "backgroundColor", label: "Fond", type: "color" },
      { key: "animation", label: "Animation", type: "animation" },
    ],
  },

  spacer: {
    label: "Espace vide",
    icon: "↕️",
    category: "layout",
    animations: "none",
    defaults: {
      height: 60,
      backgroundColor: "transparent",
      text: "",
      image: "",
      contentAlign: "center",
      contentVerticalAlign: "middle",
    },
    schema: [
      {
        key: "height",
        label: "Hauteur (px)",
        type: "number",
        min: 10,
        max: 400,
      },
      { key: "backgroundColor", label: "Fond", type: "color" },
      { key: "text", label: "Texte (optionnel)", type: "textarea" },
      { key: "image", label: "Image (optionnelle)", type: "image" },
      {
        key: "contentAlign",
        label: "Alignement horizontal",
        type: "select",
        options: ["left", "center", "right"],
      },
      {
        key: "contentVerticalAlign",
        label: "Alignement vertical",
        type: "select",
        options: ["top", "middle", "bottom"],
      },
    ],
  },

  youtube: {
    label: "Vidéo YouTube",
    icon: "▶️",
    category: "media",
    animations: "wrapper",
    defaults: {
      videoId: "",
      title: "Message récent",
      backgroundColor: "#ffffff",
      animation: "fadeIn",
    },
    schema: [
      { key: "videoId", label: "ID ou URL YouTube", type: "text", placeholder: "ID (ex: dQw4w9WgXcQ) ou lien complet youtube.com/watch?v=..." },
      { key: "title", label: "Titre", type: "text" },
      { key: "backgroundColor", label: "Fond", type: "color" },
      { key: "animation", label: "Animation", type: "animation" },
    ],
  },

  vision: {
    label: "Vision (citation)",
    icon: "🎯",
    category: "content",
    animations: "wrapper",
    defaults: {
      label: "Ce qui nous anime",
      quote:
        "Notre vision : voir des vies transformées et une communauté qui grandit ensemble.",
      ctaText: "",
      ctaLink: "",
      backgroundGradient: "#f8f9fa",
      textColor: "#064886",
      animation: "fadeIn",
    },
    schema: [
      { key: "label", label: "Label", type: "text" },
      { key: "quote", label: "Citation", type: "textarea" },
      { key: "ctaText", label: "Bouton texte", type: "text" },
      { key: "ctaLink", label: "Bouton lien", type: "text" },
      { key: "backgroundGradient", label: "Fond (CSS)", type: "text" },
      { key: "textColor", label: "Texte couleur", type: "color" },
      { key: "animation", label: "Animation", type: "animation" },
    ],
  },

  fullWidthImage: {
    label: "Image pleine largeur",
    icon: "🌆",
    category: "media",
    animations: "wrapper",
    defaults: {
      src: "",
      alt: "Image pleine largeur",
      height: 400,
      // "none" conserve l'apparence actuelle : ce bloc n'avait aucune
      // animation avant l'ajout du sélecteur.
      animation: "none",
    },
    schema: [
      { key: "src", label: "Image", type: "image" },
      { key: "alt", label: "Texte alternatif", type: "text" },
      {
        key: "height",
        label: "Hauteur (px)",
        type: "number",
        min: 100,
        max: 800,
      },
      { key: "animation", label: "Animation", type: "animation" },
    ],
  },

  equipe: {
    label: "Équipe (membres)",
    icon: "👥",
    category: "content",
    animations: "wrapper",
    defaults: {
      title: "Notre équipe",
      subtitle: "",
      members: [
        { name: "Prénom Nom", role: "Pasteur", photo: "", description: "" },
      ],
      columns: 3,
      backgroundColor: "#ffffff",
      textColor: "#064886",
      animation: "fadeIn",
    },
    schema: [
      { key: "title", label: "Titre", type: "text" },
      { key: "subtitle", label: "Sous-titre", type: "text" },
      {
        key: "members",
        label: "Membres",
        type: "array",
        subFields: [
          { key: "name", label: "Nom", type: "text" },
          { key: "role", label: "Rôle", type: "text" },
          { key: "photo", label: "URL photo", type: "text" },
          { key: "description", label: "Description", type: "textarea" },
        ],
      },
      { key: "columns", label: "Colonnes", type: "number", min: 1, max: 4 },
      { key: "backgroundColor", label: "Fond", type: "color" },
      { key: "textColor", label: "Couleur texte", type: "color" },
      { key: "animation", label: "Animation", type: "animation" },
    ],
  },

  louange: {
    label: "Louange — postes ouverts",
    icon: "🎤",
    category: "content",
    animations: "wrapper",
    defaults: {
      title: "Rejoins l'équipe louange",
      intro: "Nous cherchons des personnes pour servir dans la louange. Postule au poste qui te correspond !",
      positions: [
        {
          key: "chant",
          poste: "Chant",
          description: "Chanter lors des cultes du dimanche.",
          places: 2,
        },
      ],
      backgroundColor: "#ffffff",
      textColor: "#064886",
      animation: "fadeIn",
    },
    schema: [
      { key: "title", label: "Titre", type: "text" },
      { key: "intro", label: "Introduction", type: "textarea" },
      {
        key: "positions",
        label: "Postes",
        type: "array",
        subFields: [
          { key: "key", label: "Clé (identifiant unique)", type: "text" },
          { key: "poste", label: "Poste", type: "text" },
          { key: "description", label: "Description", type: "textarea" },
          { key: "places", label: "Places", type: "number", min: 1, max: 20 },
        ],
      },
      { key: "backgroundColor", label: "Fond", type: "color" },
      { key: "textColor", label: "Couleur texte", type: "color" },
      { key: "animation", label: "Animation", type: "animation" },
    ],
  },

  faq: {
    label: "FAQ (accordéon)",
    icon: "❓",
    category: "content",
    animations: "wrapper",
    defaults: {
      title: "Questions fréquentes",
      subtitle: "",
      items: [
        {
          question: "Comment se déroule un culte / une célébration ?",
          answer:
            "Décrivez ici le déroulé type : accueil, temps de louange, message et temps de prière.",
        },
      ],
      openFirst: false,
      backgroundColor: "#ffffff",
      textColor: "#064886",
      animation: "fadeIn",
    },
    schema: [
      { key: "title", label: "Titre", type: "text" },
      { key: "subtitle", label: "Sous-titre", type: "text" },
      {
        key: "items",
        label: "Questions",
        type: "array",
        subFields: [
          { key: "question", label: "Question", type: "text", sizable: true },
          { key: "answer", label: "Réponse", type: "textarea", sizable: true },
        ],
      },
      { key: "openFirst", label: "Première question ouverte", type: "boolean" },
      { key: "backgroundColor", label: "Fond", type: "color" },
      { key: "textColor", label: "Couleur texte", type: "color" },
      { key: "animation", label: "Animation", type: "animation" },
    ],
  },

  iconGrid: {
    label: "Grille à icônes",
    icon: "🔷",
    category: "content",
    animations: "wrapper",
    defaults: {
      title: "Nos missions",
      items: [
        {
          icon: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjRkZGRkZGIiBzdHJva2Utd2lkdGg9IjEuNiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTIgMTEuMmMtMS4yLTEuNS0zLjMtMS42LTQuNC0uMy0xLjEgMS4zLS45IDMuMS40IDQuNEwxMiAxOWwzLjktMy43YzEuMy0xLjMgMS41LTMuMS40LTQuNC0xLjEtMS4zLTMuMi0xLjItNC4zLjN6Ii8+PHBhdGggZD0iTTMuNSAxNC41YzAgMi43IDEuNyA0LjcgMy42IDVNMjAuNSAxNC41YzAgMi43LTEuNyA0LjctMy42IDUiLz48L3N2Zz4=",
          title: "Accueillir et vivre l'unité",
          description: "",
        },
        {
          icon: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjRkZGRkZGIiBzdHJva2Utd2lkdGg9IjEuOCIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTIgM3YxOE03LjUgOC41aDkiLz48L3N2Zz4=",
          title: "Célébrer et cultiver la présence de Dieu",
          description: "",
        },
        {
          icon: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjRkZGRkZGIiBzdHJva2Utd2lkdGg9IjEuNiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTIgNi4zYy0xLTEuMi0yLjctMS4zLTMuNi0uMi0uOSAxLjEtLjcgMi41LjMgMy41TDEyIDEzbDMuMy0zLjRjMS0xIDEuMi0yLjQuMy0zLjUtLjktMS4xLTIuNi0xLTMuNi4yeiIvPjxwYXRoIGQ9Ik01IDE0LjVjMCAzLjMgMy4xIDYgNyA2czctMi43IDctNiIvPjwvc3ZnPg==",
          title: "Accompagner et restaurer les vies",
          description: "",
        },
        {
          icon: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjRkZGRkZGIiBzdHJva2Utd2lkdGg9IjEuNiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48Y2lyY2xlIGN4PSI3IiBjeT0iOCIgcj0iMi4zIi8+PHBhdGggZD0iTTIuNiAxOGMwLTIuOCAyLTQuOCA0LjQtNC44czQuNCAyIDQuNCA0LjgiLz48Y2lyY2xlIGN4PSIxNi41IiBjeT0iNyIgcj0iMiIvPjxwYXRoIGQ9Ik0yMSAxNS4yYzAtMi4xLTEuNy0zLjctMy45LTMuNy0uNSAwLTEgLjEtMS41LjMiLz48cGF0aCBkPSJNMTUuMyAxNS4yaDQuNGEyIDIgMCAwIDEgMiAydjEuMWwxLjMgMS41LTIuMS0uNGgtNS42YTIgMiAwIDAgMS0yLTJ2LS4yYTIgMiAwIDAgMSAyLTJ6Ii8+PC9zdmc+",
          title: "Témoigner et former des disciples",
          description: "",
        },
      ],
      columns: 2,
      backgroundColor: "#FFFFFF",
      cardBackgroundColor: "#F2F2F2",
      iconBackgroundColor: "#1A4C8B",
      titleColor: "#1A4C8B",
      textColor: "#4A4A4A",
      animation: "fadeIn",
    },
    schema: [
      { key: "title", label: "Titre", type: "text" },
      {
        key: "items",
        label: "Cartes",
        type: "array",
        subFields: [
          { key: "icon", label: "Icône (URL image)", type: "text" },
          { key: "title", label: "Titre", type: "text" },
          { key: "description", label: "Description", type: "textarea" },
        ],
      },
      { key: "columns", label: "Colonnes", type: "number", min: 1, max: 4 },
      { key: "backgroundColor", label: "Fond section", type: "color" },
      { key: "cardBackgroundColor", label: "Fond des cartes", type: "color" },
      { key: "iconBackgroundColor", label: "Fond du rond d'icône", type: "color" },
      { key: "titleColor", label: "Couleur des titres", type: "color" },
      { key: "textColor", label: "Couleur du texte", type: "color" },
      { key: "animation", label: "Animation", type: "animation" },
    ],
  },

  stats: {
    label: "Chiffres clés",
    icon: "📊",
    category: "content",
    animations: "wrapper",
    defaults: {
      title: "En quelques chiffres",
      items: [
        { value: "10", label: "Années d'existence" },
        { value: "200", label: "Membres" },
        { value: "5", label: "Groupes actifs" },
      ],
      backgroundColor: "#064886",
      textColor: "#ffffff",
      animation: "fadeIn",
    },
    schema: [
      { key: "title", label: "Titre", type: "text" },
      {
        key: "items",
        label: "Chiffres",
        type: "array",
        subFields: [
          { key: "value", label: "Valeur", type: "text" },
          { key: "label", label: "Libellé", type: "text" },
        ],
      },
      { key: "backgroundColor", label: "Fond", type: "color" },
      { key: "textColor", label: "Couleur texte", type: "color" },
      { key: "animation", label: "Animation", type: "animation" },
    ],
  },

  quote: {
    label: "Citation",
    icon: "💬",
    category: "content",
    animations: "wrapper",
    defaults: {
      quote: "Une citation inspirante à mettre en avant.",
      author: "",
      backgroundColor: "#f8f9fa",
      textColor: "#064886",
      animation: "fadeIn",
    },
    schema: [
      { key: "quote", label: "Citation", type: "textarea" },
      { key: "author", label: "Auteur / source", type: "text" },
      { key: "backgroundColor", label: "Fond", type: "color" },
      { key: "textColor", label: "Couleur texte", type: "color" },
      { key: "animation", label: "Animation", type: "animation" },
    ],
  },

  bandeau: {
    label: "Bandeau défilant",
    icon: "📢",
    category: "layout",
    animations: "none",
    defaults: {
      text: "Découvrez nos prochains événements\nParcours Alpha : inscriptions ouvertes",
      link: "/event-list",
      separator: "✦",
      speed: 30,
      pauseOnHover: true,
      backgroundColor: "#064886",
      textColor: "#ffffff",
    },
    schema: [
      { key: "text", label: "Messages (un par ligne)", type: "textarea" },
      { key: "link", label: "Lien au clic (ex : /event-list)", type: "text" },
      { key: "separator", label: "Séparateur", type: "text" },
      { key: "speed", label: "Durée d'un tour (secondes)", type: "number", min: 5, max: 120 },
      { key: "pauseOnHover", label: "Pause au survol", type: "boolean" },
      { key: "backgroundColor", label: "Fond", type: "color" },
      { key: "textColor", label: "Couleur texte", type: "color" },
    ],
  },

  evenements: {
    label: "Prochains événements",
    icon: "📅",
    category: "content",
    animations: "wrapper",
    defaults: {
      title: "Prochains événements",
      subtitle: "",
      filter: "tous",
      maxItems: 6,
      emptyText: "Aucun événement à venir pour le moment. Revenez bientôt !",
      showAgendaLink: true,
      backgroundColor: "#ffffff",
      textColor: "#064886",
      animation: "fadeIn",
    },
    schema: [
      { key: "title", label: "Titre", type: "text" },
      { key: "subtitle", label: "Sous-titre", type: "text" },
      {
        key: "filter",
        label: "Événements affichés (tous / ponctuels / reguliers)",
        type: "select",
        options: ["tous", "ponctuels", "reguliers"],
      },
      { key: "maxItems", label: "Nombre maximum", type: "number", min: 1, max: 12 },
      { key: "emptyText", label: "Texte si aucun événement", type: "text" },
      { key: "showAgendaLink", label: "Lien vers l'agenda", type: "boolean" },
      { key: "backgroundColor", label: "Fond", type: "color" },
      { key: "textColor", label: "Couleur texte", type: "color" },
      { key: "animation", label: "Animation", type: "animation" },
    ],
  },

  footer: {
    label: "Footer",
    icon: "📋",
    category: "layout",
    animations: "internal",
    defaults: {
      title: "Il y a une place pour toi !",
      email: "contact@cieuxouverts.bzh",
      schedule: "Rdv chaque dimanche | 10H",
      address: "2 rue Jean Monnet | 29600 Morlaix, Bretagne",
      bgColorStart: "#064886",
      bgColorMid: "#064886",
      bgColorEnd: "#5a9fcf",
      bgColorMobileStart: "#d46269",
      bgColorMobileEnd: "#be4f56",
      fontSize: 19,
      titleFontSize: 24,
      textColor: "#ffffff",
      titleBoldStart: 10,
      titleBoldEnd: 14,
      animation: "none",
    },
    schema: [
      { key: "title", label: "Titre", type: "text" },
      { key: "email", label: "Email", type: "text" },
      { key: "schedule", label: "Horaire", type: "text" },
      { key: "address", label: "Adresse", type: "text" },
      { key: "bgColorStart", label: "Fond dégradé (haut)", type: "color" },
      { key: "bgColorMid", label: "Fond dégradé (milieu)", type: "color" },
      { key: "bgColorEnd", label: "Fond dégradé (bas)", type: "color" },
      { key: "bgColorMobileStart", label: "Fond mobile (haut)", type: "color" },
      { key: "bgColorMobileEnd", label: "Fond mobile (bas)", type: "color" },
      { key: "fontSize", label: "Taille police infos", type: "number", min: 10, max: 48 },
      { key: "titleFontSize", label: "Taille police titre", type: "number", min: 14, max: 72 },
      { key: "textColor", label: "Couleur texte", type: "color" },
      { key: "titleBoldStart", label: "Début gras titre (index)", type: "number", min: 0, max: 50 },
      { key: "titleBoldEnd", label: "Fin gras titre (index)", type: "number", min: 0, max: 50 },
    ],
  },
};

// ─── Visibilité responsive ──────────────────────────────────────────────────
export const VISIBILITY_DEFAULTS = {
  desktop: true,
  tablet: true,
  mobile: true,
};

// ─── Créer un nouveau bloc avec ID unique ───────────────────────────────────
export function createBlock(type, props = {}) {
  if (!BLOCK_TYPES[type]) {
    console.warn(`createBlock: type inconnu "${type}"`);
    return null;
  }
  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return {
    id,
    type,
    props: { ...BLOCK_TYPES[type].defaults, ...props },
    visibility: { ...VISIBILITY_DEFAULTS },
  };
}

// ─── Structure de page initiale (accueil) ─────────────────────────────────
export function getDefaultHomePage() {
  return [
    createBlock("hero"),
    createBlock("bandeau"),
    createBlock("bienvenue"),
    createBlock("rejoins"),
    createBlock("aspirations"),
    createBlock("vision"),
    createBlock("activities"),
    createBlock("nousRejoindre"),
    createBlock("contact", {
      image: "/images/contact-smartphone.jpg",
      backgroundGradient: "#064886",
    }),
  ]
    .filter(Boolean)
    .map((block, i) => ({ ...block, id: `default-home-${i}` }));
}

export function getDefaultMessagesPage() {
  return [
    createBlock("textImage", {
      title: "Nos messages",
      subtitle: "Cieux Ouverts est aussi en ligne !",
      body: DEFAULT_MESSAGES_BODY,
      image: "/images/messages-laptop.png",
      visualStyle: "messagesLaptop",
      backgroundColor: "#ffffff",
      textColor: "#064886",
      ctaText: "Notre chaine YouTube",
      ctaLink: "https://www.youtube.com/@eglisecieuxouverts",
    }),
    createBlock("youtube", {
      videoId: "wZebQj0gR98",
      title: "Dernier message",
      backgroundColor: DEFAULT_MESSAGES_GRADIENT,
      animation: "fadeIn",
    }),
  ]
    .filter(Boolean)
    .map((block, i) => ({ ...block, id: `default-messages-${i}` }));
}

export function getDefaultPhotosPage() {
  return [
    createBlock("gallery", {
      title: "Galerie photos",
      textColor: "#064886",
      columns: 3,
      images: [
        "/photos/slide-salle.jpg",
        "/photos/slide-mains.jpg",
        "/photos/slide-promenade.jpg",
        "/photos/slide-pizza.jpg",
        "/photos/slide-buffet.jpg",
      ],
    }),
  ]
    .filter(Boolean)
    .map((block, i) => ({ ...block, id: `default-photos-${i}` }));
}

// Contenu historique de la page Événements tant que personne ne l'a éditée :
// un seul bloc, sauvegardé tel quel en Firestore avec son id par défaut.
// Il affirmait « Aucun événement pour le moment » même quand l'agenda en
// contenait — voir upgradeLegacyBilletterie().
const LEGACY_BILLETTERIE_MARKER = "Aucun événement pour le moment.";

export const PARCOURS_ALPHA_PROPS = {
  title: "Parcours Alpha",
  subtitle: "Des soirées pour explorer le sens de la vie et la foi chrétienne",
  body: "<p>Alpha, c'est une série de rencontres conviviales : un repas partagé, un court exposé, puis un temps d'échange en petit groupe où toutes les questions sont les bienvenues, sans tabou et sans engagement.</p><p>Ouvert à tous, que tu sois croyant, curieux ou sceptique. C'est gratuit, il suffit de s'inscrire !</p>",
  image: "/images/activites-repas.jpg",
  reverse: false,
  ctaText: "Je m'inscris au parcours Alpha",
  ctaLink: "/contact",
  backgroundColor: "#f6f8fc",
  textColor: "#1a1a2e",
  animation: "slideLeft",
};

export function getDefaultBilletteriePage() {
  return [
    createBlock("richText", {
      content: `<div style="max-width:820px;margin:0 auto;text-align:center;"><h1 style="font-family:'Playfair Display',Georgia,serif;font-style:italic;color:#064886;">Billetterie Événements</h1><p>Découvrez nos prochains rendez-vous et réservez vos places.</p></div>`,
      backgroundColor: "#ffffff",
      textColor: "#1a1a2e",
      textAlign: "left",
      padding: 50,
      animation: "fadeIn",
    }),
    createBlock("evenements", { title: "", maxItems: 6 }),
    createBlock("textImage", PARCOURS_ALPHA_PROPS),
  ]
    .filter(Boolean)
    .map((block, i) => ({ ...block, id: `default-billetterie-${i}` }));
}

/**
 * Page Événements jamais retouchée depuis l'admin (le bloc par défaut
 * d'origine, intact) → remplacée par la page par défaut actuelle (liste des
 * prochains événements + parcours Alpha). Tout contenu réellement édité est
 * renvoyé tel quel : on ne touche jamais au travail de l'admin.
 */
export function upgradeLegacyBilletterie(blocks) {
  const seul = Array.isArray(blocks) && blocks.length === 1 ? blocks[0] : null;
  const intact =
    seul?.id === "default-billetterie-0" &&
    seul?.type === "richText" &&
    typeof seul?.props?.content === "string" &&
    seul.props.content.includes(LEGACY_BILLETTERIE_MARKER);
  return intact ? getDefaultBilletteriePage() : blocks;
}

export function getDefaultContactPage() {
  return [
    createBlock("contact", {
      title: "Nous contacter",
      addressTitle: "",
      addressLine: "",
      mapEmbedUrl: "",
      backgroundGradient: "#064886",
      showQuestions: false,
      showSocials: false,
    }),
  ]
    .filter(Boolean)
    .map((block, i) => ({ ...block, id: `default-contact-${i}` }));
}

// ─── Pages d'erreur par défaut ─────────────────────────────────────────────
export function getDefaultErrorPage(code = 404) {
  const common = {
    backgroundColor: "#ffffff",
    textColor: "#1a1a2e",
    padding: 70,
    animation: "fadeIn",
  };

  const blocks = [];

  if (code === 404) {
    blocks.push(
      createBlock("richText", {
        content: `<div style="max-width:820px;margin:0 auto;text-align:center;"><h1 style=\"font-family:'Playfair Display',Georgia,serif;color:#064886;\">404 — Page introuvable</h1><p>La page que vous cherchez n'existe pas ou a été déplacée.</p></div>`,
        ...common,
      }),
    );
  } else if (code === 500) {
    blocks.push(
      createBlock("richText", {
        content: `<div style="max-width:820px;margin:0 auto;text-align:center;"><h1 style=\"font-family:'Playfair Display',Georgia,serif;color:#064886;\">500 — Erreur serveur</h1><p>Désolé, une erreur inattendue s'est produite.</p></div>`,
        ...common,
      }),
    );
  } else {
    blocks.push(
      createBlock("richText", {
        content: `<div style="max-width:820px;margin:0 auto;text-align:center;"><h1 style=\"font-family:'Playfair Display',Georgia,serif;color:#064886;\">${code} — Service indisponible</h1><p>Le site est momentanément indisponible. Revenez plus tard.</p></div>`,
        ...common,
      }),
    );
  }

  return blocks
    .filter(Boolean)
    .map((block, i) => ({ ...block, id: `default-error-${code}-${i}` }));
}

function normalizeMessagesBlocks(blocks) {
  return blocks.map((block, index) => {
    if (index === 0 && block.type === "textImage") {
      return {
        ...block,
        props: {
          ...BLOCK_TYPES.textImage.defaults,
          ...block.props,
          title: block.props?.title || "Nos messages",
          subtitle:
            block.props?.subtitle || "Cieux Ouverts est aussi en ligne !",
          body: block.props?.body || DEFAULT_MESSAGES_BODY,
          visualStyle: block.props?.visualStyle || "messagesLaptop",
          backgroundColor: block.props?.backgroundColor || "#ffffff",
          textColor: block.props?.textColor || "#064886",
          ctaText: block.props?.ctaText || "Notre chaine YouTube",
          ctaLink:
            block.props?.ctaLink ||
            "https://www.youtube.com/@eglisecieuxouverts",
        },
      };
    }

    if (
      index === 1 &&
      block.type === "richText" &&
      block.props?.content?.includes("youtube.com/embed")
    ) {
      return {
        ...block,
        props: {
          ...BLOCK_TYPES.richText.defaults,
          ...block.props,
          backgroundGradient:
            block.props?.backgroundGradient || DEFAULT_MESSAGES_GRADIENT,
          backgroundColor: block.props?.backgroundColor || "#ffffff",
          padding:
            block.props?.padding !== undefined ? block.props.padding : 20,
        },
      };
    }

    return block;
  });
}

function normalizeContactBlocks(blocks) {
  const contactBlock = blocks.find((block) => block.type === "contact");
  if (!contactBlock) return blocks;

  const normalizedContact = {
    ...contactBlock,
    props: {
      ...BLOCK_TYPES.contact.defaults,
      ...contactBlock.props,
      title: contactBlock.props?.title || "Nous contacter",
      addressTitle: contactBlock.props?.addressTitle || "",
      addressLine: contactBlock.props?.addressLine || "",
      mapEmbedUrl: contactBlock.props?.mapEmbedUrl || "",
      backgroundGradient: contactBlock.props?.backgroundGradient || "#064886",
      showQuestions: contactBlock.props?.showQuestions ?? false,
      showSocials: contactBlock.props?.showSocials ?? false,
      image: contactBlock.props?.mapEmbedUrl
        ? ""
        : contactBlock.props?.image || "",
    },
  };

  if (
    blocks.length === 3 &&
    blocks[0]?.type === "richText" &&
    blocks[2]?.type === "richText"
  ) {
    return [normalizedContact];
  }

  return blocks.map((block) =>
    block.id === contactBlock.id ? normalizedContact : block,
  );
}

export function normalizePageBlocks(slug, blocks) {
  if (!Array.isArray(blocks) || blocks.length === 0)
    return getDefaultPageBySlug(slug);
  if (slug === "messages") return normalizeMessagesBlocks(blocks);
  if (slug === "contact") return normalizeContactBlocks(blocks);
  if (slug === "event-list") return upgradeLegacyBilletterie(blocks);
  return blocks;
}

export function getDefaultPageBySlug(slug) {
  if (slug === "accueil") return getDefaultHomePage();
  if (slug === "messages") return getDefaultMessagesPage();
  if (slug === "photos") return getDefaultPhotosPage();
  if (slug === "event-list") return getDefaultBilletteriePage();
  if (slug === "contact") return getDefaultContactPage();
  return [];
}
