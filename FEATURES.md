# FEATURES.md — Périmètre du site

Description stable du site tel qu'il existe (pas un changelog — pour l'historique des évolutions, `git log`). Sert de référence de périmètre : toute modification doit rester cohérente avec ce qui est décrit ici, et ce fichier doit être mis à jour quand le périmètre change réellement (pas à chaque session). Objectif principal : qu'un agent qui n'a pas le contexte d'une session précédente sache ce qui existe déjà avant de le recréer, le casser ou le dupliquer.

## Ce que c'est

Site vitrine de l'Église Cieux Ouverts (Morlaix) avec un éditeur de pages intégré façon Wix (drag-and-drop, édition en direct, sans build/déploiement pour changer le contenu). Nuxt 3 + Vue 3, persistance Firestore, déployé sur Cloudflare Pages.

## Pages publiques

Chaque page est composée de blocs (voir « Système de blocs »). Le contenu réel vit en Firestore (`pages/{slug}`), **pas** dans le code — le code ne définit que la structure/les defaults. Slugs réservés (`HARDCODED_SLUGS` dans `utils/blockTypes.js`) : `accueil`, `contact`, `messages`, `event-list`, `agenda`, `photos` — protégés en création/suppression depuis l'admin (pas en écriture, qui est le chemin d'édition normal).

- **Accueil** (`/`, `pages/index.vue`) — fetch `pages/accueil`. Structure réelle actuelle : 8 blocs dans cet ordre — `hero`, `bienvenue`, `rejoins`, `aspirations`, `vision`, `activities`, `nousRejoindre`, `contact`. **Incident passé** : ce document Firestore a été écrasé accidentellement à deux reprises pendant une session (contenu perdu, restauré depuis l'historique git + recette). Voir « Pièges de sauvegarde » ci-dessous pour la cause racine corrigée.
- **Contact** (`/contact`, `pages/contact.vue`) — bloc `contact` en mode page complète (formulaire + adresse + carte Google Maps intégrée).
- **Agenda** (`/agenda`, `pages/agenda.vue`) — calendrier public des événements (voir « Événements »).
- **Billetterie/Événements** (`/event-list`, `pages/event-list.vue`) — par défaut : en-tête, bloc `evenements` (prochains événements du Worker) et présentation du **parcours Alpha** (`textImage`, `PARCOURS_ALPHA_PROPS`). La page jamais éditée (ancien bloc unique « Aucun événement pour le moment », sauvegardé tel quel en Firestore) est remplacée à l'affichage par ce contenu par défaut — `upgradeLegacyBilletterie()` ; tout contenu réellement édité est laissé intact. `/billetterie` redirige vers `/event-list` (`routeRules` dans `nuxt.config.ts`).
- **Messages** (`/messages`, `pages/messages.vue`) — messages/prédications, bloc `textImage` + `youtube`.
- **Photos** (`/photos`, `pages/photos.vue`) — page supprimée volontairement : redirection 301 vers l'accueil. Les galeries passent par le bloc `gallery` sur n'importe quelle page.
- **Admin** (`/admin`, `pages/admin.vue`) — page de connexion dédiée, redirige vers `/?admin=true` après authentification. Ce n'est pas un dashboard séparé — toute l'édition se fait en admin mode sur les pages publiques elles-mêmes.
- **Espace membre** (`/membre`, `pages/membre.vue`) — voir « Espace membre » ci-dessous.
- **Pages custom** — un admin peut créer des pages additionnelles (slug libre) via le menu ; route catch-all `pages/[slug].vue`.

## Système de blocs (schema-driven)

31 types de blocs (`utils/blockTypes.js` = source de vérité, vérifié) : `hero`, `bienvenue`, `activities`, `textImage`, `rejoins`, `aspirations`, `contact`, `nousRejoindre`, `richText`, `gallery`, `spacer`, `youtube`, `vision`, `fullWidthImage`, `equipe`, `louange`, `faq`, `iconGrid`, `stats`, `quote`, `bandeau`, `evenements`, `sectionTitle`, `callToAction`, `infosPratiques`, `temoignages`, `colonnes`, `compteARebours`, `don`, `audio`, `footer`.

- **Blocs ajoutés (titre de section, bouton, horaires, témoignages, colonnes, compte à rebours, don, audio)** : tout texte visible vient des props (aucun texte en dur). Liens et sources passent par `utils/safeLink.js` (`lienSur`, `sourceSure` : refus de `javascript:`/`data:`). Le compte à rebours utilise l'heure de l'appareil du visiteur ; l'audio lit une URL de fichier mp3 hébergé ailleurs (pas de téléversement audio). Le bloc `don` pointe par défaut vers `/contact` : y mettre le vrai lien de don.

Chaque type déclare `label`, `icon`, `category`, `animations` (stratégie), `defaults`, `schema` (champs auto-générés dans la sidebar : `text`, `textarea`, `richtext`, `number`, `color`, `boolean`, `select`, `animation`, `image`, `array`, `images`).

- **Espace vide** (`spacer`) : simple espacement OU zone de contenu (texte + image) avec alignement horizontal/vertical réglable. Pas de glisser-déposer libre du contenu à l'intérieur — décision volontaire, contrôles d'alignement seulement. Rétrocompatible : un bloc vide sans texte/image reste une div nue (0 enfant DOM).
- **Bandeau défilant** (`bandeau`) : texte qui défile en boucle (un message par ligne), cliquable vers un lien (par défaut `/event-list`), pause au survol, immobile si l'utilisateur a demandé moins d'animations (`prefers-reduced-motion`). En admin le clic sélectionne le bloc au lieu de naviguer.
- **Prochains événements** (`evenements`) : cartes des prochains événements du Worker (via `useChurchEvents`, côté client), une seule carte par événement récurrent (sa prochaine date), filtre tous/ponctuels/réguliers, nombre maximum, lien vers l'agenda. Squelette au rendu serveur, message distinct en cas d'erreur de chargement.
- **Visibilité par device** : chaque bloc peut être masqué indépendamment sur desktop/tablette/mobile (`block.visibility`).
- **Templates génériques** : les blocs ont des defaults neutres (pas de contenu church-specific codé en dur) pour rester réutilisables sur d'autres sites. Certains types (`textImage`, `richText`) proposent des modèles pré-remplis (`BLOCK_TYPES[type].templates`) au moment de l'ajout.

## Éditeur admin

- Activation : `?admin=true` sur n'importe quelle page (la toolbar affiche "Se connecter" si non authentifié).
- Drag-and-drop de blocs, undo/redo (50 entrées, Ctrl+Z / Ctrl+Shift+Z).
- Auto-save Firestore (debounce 3s) + bouton sauvegarde manuelle. Garde-fou : la sauvegarde est annulée (silencieusement pour l'auto-save, avec message pour la sauvegarde manuelle) si la page affichée a changé depuis le chargement des blocs édités — évite d'écrire le contenu d'une page sur le slug d'une autre.
- Prévisualisation responsive desktop/tablette/mobile (tablette/mobile = iframe avec sa propre synchronisation de blocs).
- Historique des versions par page (bouton "🕐 Versions"), restauration possible — **mais** aucune version n'est créée tant que la page n'a jamais été sauvegardée une première fois explicitement ; ne pas supposer qu'un historique existe forcément.
- **Menu** (bouton menu/burger en admin) : modale centrée (pas un panneau latéral) — gestion des items, sous-menus, réorganisation, création/suppression de pages custom, fond du menu mobile.
- **Police par champ de texte** : sur chaque champ `text`/`textarea`/`richtext` **visuel** (titre, sous-titre, citation…) de la sidebar d'édition, un petit sélecteur de police apparaît à côté du label — inspiré de l'inspecteur Wix (sélectionner un élément → contrôle contextuel). Liste fermée de 8 polices Google Fonts (`utils/fonts.js`). Les champs non-visuels (liens, URLs, CSS de gradient, ID vidéo) sont exclus automatiquement par convention de nommage. Portée limitée aux champs de premier niveau (pas de descente dans les tableaux type activités/FAQ). **Il n'y a pas de réglage de police global** — chaque champ est indépendant, retombe sur `--font-heading`/`--font-body` (CSS, `assets/css/main.css`) si aucun override.
- **Système de demandes développeur** ("💬 Demandes") : note attachable à un bloc (visible admin uniquement, jamais publique), liste centralisée cross-page cliquable pour revenir au bloc concerné — sert à signaler une demande qui nécessite du code, sans passer par un canal externe.
- **Gestion des administrateurs** ("👥 Admins") : ajout/retrait par email, Firestore `settings/admins`.

## Auth admin

Firebase Auth (email + mot de passe — connexion Google retirée), projet Firebase `eglise-cieux-ouverts`. `?admin=true` active le mode admin dans l'UI quel que soit le statut d'authentification — c'est la toolbar qui affiche "Se connecter" si besoin (redirige vers `/admin`). `auth.onAuthStateChanged` existe nativement sur le SDK Firebase (compat v8) — ne jamais le réassigner (a causé une récursion infinie en prod, corrigé).

## Événements

**Backend séparé** : les événements viennent du Worker Cloudflare `eglise-app` (`/Users/vic/Projects/eglise-app`, base D1) exposé sur `https://eglise-app.belletonv.workers.dev/api/church-events` — **pas de Firestore ici**. `composables/useChurchEvents.js` centralise le fetch public (SiteHeader, agenda). Le Worker vérifie les tokens Firebase de son propre projet OU du projet `eglise-cieux-ouverts` (les deux sites partagent l'auth admin mais utilisent des projets Firebase distincts).

- **Gestion admin** (bouton "📅 Événements" → `components/admin/EventManager.vue`) : CRUD complet (création/édition/suppression), récurrence (hebdo, bimensuel, mensuel même date, mensuel même jour de semaine), exceptions (annulation ou déplacement d'une occurrence), upload d'images.
- **Date de fin** (`end_date`, moteur unique `utils/churchEvents.js`, partagé par le site public et l'aperçu « prochaines dates » de l'admin) : un événement ponctuel disparaît des listes « à venir » le lendemain de sa date de fin ; pour un événement récurrent, `end_date` est la **fin de la série** — aucune occurrence générée après. Une `end_date` antérieure ou égale à `start_date` sur un récurrent est ignorée (valeur pré-remplie du formulaire, pas une fin de série). L'agenda garde l'historique des mois passés.
- **Recherche/tri/filtre** dans la modale de gestion : barre de recherche (titre, lieu, description), tri (date ↑/↓, titre A→Z), filtre par statut (tous/actifs/annulés).
- Ne jamais créer de collection/endpoint Firestore parallèle pour les événements — un système parallèle non connecté au site public a déjà été tenté et annulé.

## Menu & Footer

- **Menu** (navigation du site) : Firestore `settings/menu`, édité via la modale de gestion du menu (voir « Éditeur admin »).
- **Changement de page depuis le menu** : le contenu de la page visée (`/api/pages/:slug`) est préchargé dès le survol, le focus ou le toucher d'un lien, et lu en différé pour tout le menu 1,5 s après l'affichage (le premier clic est alors instantané) ; une page lue il y a moins de 5 minutes est réutilisée sans nouvel appel (`utils/pageApiCache.js`, navigateur uniquement ; jamais en admin, qui lit toujours la version à jour et vide ce cache). Barre de progression en haut de l'écran si le chargement dépasse 150 ms (`NuxtLoadingIndicator`, `app.vue`), transition de page raccourcie à 0,12 s.
- **Menu jamais affiché avec ses anciens noms** : si le menu enregistré n'a pu être lu ni au rendu serveur (un nouvel essai est fait) ni encore côté client, les liens restent masqués (`menu-pending`, `SiteHeader.vue`) au lieu de montrer les libellés d'origine puis de les remplacer. Sans JavaScript, ils s'affichent quand même.
- **Footer** (bandeau bas de chaque page) : Firestore `settings/footer` — si le document n'existe pas (`props: null`), le site retombe sur `BLOCK_TYPES.footer.defaults` (`utils/blockTypes.js`). **Piège** : contrairement aux pages (toujours sauvegardées explicitement dès leur création), le footer peut tourner indéfiniment sur les defaults code sans qu'aucun admin ne l'ait jamais sauvegardé — un changement de defaults dans le code se répercute alors directement sur le site réel (déjà arrivé : neutralisation accidentelle du vrai contact en prod, corrigé).

## Formulaire de contact

`server/api/contact.post.ts` — écrit dans Firestore `contacts` + notification email via Mailjet (`server/utils/send-email.ts`, si `NUXT_MAILJET_API_KEY`, `NUXT_MAILJET_API_SECRET` et `NUXT_MAILJET_FROM_EMAIL` sont configurés ; destinataires réglés dans ⚙️ Config, qui affiche aussi si l'envoi est actif d'après `/api/health` et propose un bouton « Envoyer un email de test » renvoyant la vraie raison d'un refus Mailjet, `POST /api/settings/test-email`, admin seulement). Rate-limité (3 requêtes / 15 min / IP, en mémoire — reset à chaque cold start serverless). Retourne un 503 explicite si les credentials serveur Firestore manquent (comportement volontaire, pas une erreur silencieuse). Le composant affiche `e.data.message` (message métier explicite), pas `e.data.statusMessage` (texte HTTP générique type "Server Error").

- **Champ newsletter** (`checkbox` dans le formulaire) : booléen capturé lors de la soumission, stocké en Firestore `contacts/{id}` (champ `newsletter`). Permet aux visiteurs de s'abonner directement via le formulaire contact.
- **Email de destination configurable** : l'adresse qui reçoit les notifications est stockée en Firestore `settings/config` (champ `contactEmail`), modifiable en admin via le bouton «⚙️ Config». Fallback variable d'env `CONTACT_EMAIL` en dev. Utilise ce champ si défini, sinon fallback défaut.

Messages visibles dans l'admin via le bouton toolbar « 📬 Messages » (badge = nombre non lus) — liste en lecture seule (`GET /api/contacts`, admin-only) avec un simple bascule lu/non lu (`PUT /api/contacts/:id`, champ `status`). Volontairement pas de réponse/reply gérée depuis l'admin : le mail de l'expéditeur est un lien `mailto:` cliquable, rien de plus.

## Animations

CSS `animation-timeline` natif (scroll-driven), fallback IntersectionObserver pour Safari/navigateurs non supportés. Deux stratégies déclarées par bloc (`animations` dans `BLOCK_TYPES`) : `wrapper` (PageRenderer gère l'animation) et `internal` (le bloc gère la sienne en interne, ex. `aspirations`, `nousRejoindre`, `rejoins`). Le travail d'animation vit entièrement dans le code des composants — jamais dans Firestore, donc jamais perdu par une corruption de données de page.

## Pièges de sauvegarde et de stabilité admin (causes racines corrigées)

Ces bugs ont causé des pertes de contenu réel ou des blocages de l'admin en prod — corrigés, mais les mécanismes valent d'être compris avant de toucher au code de sauvegarde/auth :

- **Sauvegarde croisée entre pages** : `saveToServer()` (`AdminToolbar.vue`) combinait `props.pageSlug` (piloté par la route, se met à jour immédiatement à la navigation) avec `localBlocks.value` (composable partagé, mis à jour de façon asynchrone). Une sauvegarde différée (debounce 3s) qui se déclenchait après un changement de page écrivait encore le contenu de l'ancienne page, mais sur le slug de la nouvelle. Corrigé par un garde-fou comparant `localBlocksPage` à `props.pageSlug` avant toute écriture.
- **Reload forcé en sortant du bfcache (retour d'onglet)** : un listener `pageshow` rechargeait systématiquement la page à la restauration depuis le cache navigateur, sans exception pour le mode admin — perdait silencieusement les modifications non sauvegardées en changeant d'onglet puis en revenant. Corrigé (`plugins/deployment-check.client.ts`).
- **`normalizeBlock()`** (`lib/blocks/renderer.ts`) réapplique `BLOCK_TYPES[type].defaults` à CHAQUE rendu (pas seulement à la création) pour tout prop vide/absent — changer un default de type peut donc changer l'affichage de contenu déjà existant si ce contenu n'a jamais explicitement écrasé ce champ. C'est ce mécanisme qui a causé la neutralisation accidentelle du footer réel.
- **Crash Vue après connexion admin réelle** : `pages/admin.vue` avait un listener `onAuthStateChanged` jamais désabonné, combiné à une course entre sa navigation post-connexion (SPA) et `layouts/default.vue` (layout persistant) réagissant en parallèle au même changement de route — corrompait l'état interne de Vue, rendant l'admin totalement inerte (aucun bouton ne répondait) jusqu'à un hard refresh. Non reproductible avec le raccourci de test habituel (`?admin=true` direct) — seulement en passant réellement par `/admin`. Corrigé : cleanup du listener + rechargement complet (`window.location.href`) au lieu de navigation SPA après connexion.

## Espace membre

**Page `/membre`** (`pages/membre.vue`, slug réservé dans `HARDCODED_SLUGS`) — espace personnel des membres, distinct de l'admin. **Désactivé par défaut** : réglage « Activer l'espace membre (comptes) » dans ⚙️ Config (`espaceMembre` de `settings/config`). Désactivé, le lien du SiteHeader disparaît, `/membre` redirige vers l'accueil (`middleware/espace-membre.ts`), l'agenda n'affiche plus rien de personnel et « Je postule ! » du bloc Louange mène à `/contact`. Activé :

- **Auth membre** : Firebase Auth du projet `eglise-cieux-ouverts`, email/mot de passe uniquement (connexion Google retirée) — connexion + création de compte + reset. Composable `useMemberAuth.ts` (refs singleton module-scope, pattern `useAdmin`). Le Worker eglise-app associe/auto-crée le membre par email (`getMemberFromRequest`). Lien « Espace membre » dans le SiteHeader (devient `👤 Prénom` connecté).
- **Ressources partagées** : liste des ressources ciblées vers le membre (partagées depuis la SPA admin eglise-app, vue `/resources` — ciblage tous/équipe/groupe de maison/membres, snapshot des destinataires au partage). Ouvrir une ressource **logge automatiquement la consultation** (`POST /api/member/resources/:id/access` : première/dernière consultation + compteur) puis ouvre l'URL. L'admin voit « consulté par X/Y » avec détail par membre ; un **digest email quotidien** (cron 8h du Worker, Resend → `ADMIN_EMAIL`, marqueur `digested_at`) récapitule les nouvelles consultations (+ push FCM admins si configuré).
- **Demandes & candidatures** : table D1 `participation_requests` (`kind` = `admin_request` | `candidacy`). L'admin envoie une demande ciblée (« peux-tu chanter dimanche ? ») que le membre accepte/refuse depuis `/membre` (accepter avec `event_id` → participation `present`) ; le membre postule aux postes du bloc `louange`, l'admin tranche dans la vue `/requests` d'eglise-app.
- **Agenda personnel** : le membre connecté voit ses événements surlignés (`.event-mine`, ⭐) dans `/agenda` et indique sa présence (Présent/Peut-être/Absent) depuis la modale d'événement — table D1 `church_event_participants` (occurrence par date pour les récurrents). Badge « X/Y confirmés » + modale participants côté admin (ChurchEvents.vue d'eglise-app).
- **Bloc `louange`** : postes ouverts (tableau `positions`) avec bouton « Je postule ! » (redirige vers `/membre` si déconnecté, candidature dédupliquée sinon).
- **Proxies Nuxt** `server/api/member/*` : forwardent le Bearer vers le Worker en prod ; en test (`PW_TEST=1`), branche mock `server/utils/member-mock.js` (reset dédié `POST /api/reset-member-mock`, **séparé** du reset global pour éviter les courses entre fichiers de spec parallèles). Tests : `tests/playwright/membre-espace.spec.ts` (un seul fichier, volontairement — exécution séquentielle).

## Intégration eglise-app (backend partagé)

**Repo séparé** : `/Users/vic/Projects/eglise-app` (Worker Cloudflare + D1). Les deux sites partagent l'**authentification Firebase** (deux projets distincts `eglise-app-b81b0` et `eglise-cieux-ouverts`, mais auth mutuelle via tokens `Bearer`). eglise-app expose plusieurs ressources :

- **Événements** (`/api/church-events`, D1 table `church_events`) — voir section « Événements » ci-dessus.
- **Membres** (`/api/members`, D1 table `members`) — liste des membres avec pagination, recherche, filtrage par équipe (`teams`). Accessible via `GET /api/members?page=1&size=25&q=...&teamId=...` en passant un token Firebase Bearer. Retourne les champs : `id`, `first_name`, `last_name`, `email`, `phone`, `birth_date`, `membership_type`, `role`, `teams` (array), + champs RGPD (`consent_*`). Admins voient tous les champs ; members et autres rôles voient une version réduite (exclusion des champs sensibles : `birth_date`, `baptism_date`, `notes`, `pco_*`, `consent_*`, `data_origin`, `gdpr_*`). Rôles/permissions définis en `src/auth.js` : `admin` (accès total), `editor` (peut modifier), `scheduler`, `music_director`, `tech_director`, `member`, `volunteer`, `viewer` (lecture seule ou réduite).
- **Proxy local** (`server/api/members.get.ts` sur eglise-cieux-ouverts) — le site envoie son token Bearer à eglise-app, l'app retourne les membres bruts. Composable `useMembers()` (`composables/useMembers.ts`) encapsule le fetch avec pagination et filtres côté client.

## Application installable (PWA)

- **Installation** : manifeste `public/manifest.webmanifest` (nom « Cieux Ouverts », icônes `favicon-192/512` + versions `maskable`, couleur `#064886`). Chrome/Android proposent l'installation ; le bandeau `components/InstallAppBanner.vue` (au-dessus du pied de page, hors admin) offre un bouton « Installer », ou sur iPhone/iPad explique Partager → « Sur l'écran d'accueil ». Masquable (« × », mémorisé sur l'appareil), absent une fois l'app installée.
- **Hors ligne** : service worker `public/sw.js`, enregistré par `plugins/pwa.client.ts`. Réseau d'abord pour le HTML et les lectures publiques (`/api/pages`, `menu`, `footer`, `settings`, agenda du Worker) — le cache n'est qu'un repli, la fraîcheur du contenu ne change pas. Bundles `/_nuxt/*` et images servis depuis le cache. Une page jamais visitée affiche `public/offline.html`.
- **Admin exclu** : jamais servi depuis le cache (`/admin`, `?admin=true`, `preview-inner`, onglet signalé en mode admin, requêtes authentifiées, tout ce qui n'est pas GET).
- **Notifications push** : étudiées, non retenues pour l'instant (octobre 2026). Possibles plus tard sans refaire la base (Web Push, abonnements à stocker, écran d'envoi admin ; sur iPhone seulement si l'app est installée).

## Tests

- `tests/schema-driven/` (config `playwright.unit.config.ts`) — tests génériques par schema (SSR, admin, responsive, a11y, intégrité) + specs dédiées par bloc.
- `tests/playwright/` (config `playwright.config.ts`) — E2E (parcours admin, navigation, auth, formulaire, événements, etc.).
- Mode mock (`PW_TEST=1`) : toutes les lectures/écritures Firestore passent par `server/utils/firestore-mock.js` (RAM, reset via `resetMock()`), jamais la vraie base. Contacts, settings, commentaires, et contacts passent par le mock — les membres n'existent que via le proxy (eglise-app réel, même en test, ou fallback mock si l'API est indisponible).

## Déploiement

Push sur `main` → déploiement automatique Cloudflare Pages (`eglise-cieux-ouverts.pages.dev`). Voir CLAUDE.md pour les détails opérationnels (Node version, commandes, cache, environnements).

## Features demandées (roadmap)

### ✅ Comptes membres, ressources ciblées, suivi de consultation — implémentés (juillet 2026)

Voir la section « Espace membre » ci-dessus. Réalisation vs plan initial :

- Page membre : `/membre` (pas `/ressources`), tables D1 `resources` + `resource_recipients` (pattern `message_recipients`, pas de table `resource_access` séparée — le suivi vit sur la ligne destinataire : `first_accessed_at`, `last_accessed_at`, `access_count`, `digested_at`), vue admin `ResourcesList.vue` (pas `ResourcesView.vue`), composable `useMemberAuth` (pas de store Pinia).
- Alertes : digest email quotidien via le cron du Worker (pas d'email temps réel par consultation), badge « consulté par X/Y » dans la SPA admin.
- En plus du plan : demandes de participation/candidatures (`participation_requests`), agenda personnel avec présence (`church_event_participants`), bloc CMS `louange`, envoi d'emails aux groupes de maison.

## Incohérences détectées (à corriger)

Cette section suit le pattern de documentation des projets open source comme PayloadCMS et Directus : chaque inconsistence est catégorisée par impact et complexité.

### 🐛 Bugs fonctionnels (priorité haute)

| Champ/Propriété | Impact | Bloc(s) concerné(s) | Détails |
|-----------------|--------|---------------------|---------|
| `visibility` | ✅ Corrigé | `BlockStats.vue`, `BlockQuote.vue`, `BlockFooter.vue` | `visibilityClasses` appliqué sur la racine de chaque composant (pattern BlockRichText). Indispensable pour le footer, rendu hors PageRenderer (`layouts/default.vue`) — pour les blocs de page, le wrapper PageRenderer l'appliquait déjà. Testé dans `tests/playwright/visibility-device.spec.ts`. |
| `richtext` (éléments additionnels) | ✅ Corrigé | `FieldElements.vue` | Bouton `+ Texte HTML` ajouté, avec placeholder `<p>Nouveau contenu HTML...</p>` à la création. |

### 🐛 Bugs de rendu inline (priorité haute)

| Champ/Propriété | Bloc(s) concerné(s) | Détails |
|-----------------|---------------------|---------|
| `questionSize`/`answerSize` | `BlockFaq.vue` | ✅ Corrigé : style conditionnel (`item.questionSize ? { fontSize: ... } : {}`) — aucun style inline émis quand le champ n'est pas défini. |

### 🔧 Actions recommandées

1. ✅ **Uniformiser `visibility`** : `visibilityClasses` ajouté dans `BlockStats.vue`, `BlockQuote.vue`, `BlockFooter.vue`
2. **Centraliser `minHeight`** : Déplacer la logique depuis `AdminToolbar.vue` vers `utils/designDefaults.js`
3. **Documenter les champs inactifs** : Soit les implémenter, soit les retirer du schema, soit les marquer comme "non fonctionnel" dans la UI
4. ✅ **Ajouter le bouton "+ Texte HTML"** dans `FieldElements.vue` — fait
5. ✅ **Appliquer `fieldFonts`/`fieldFontSizes` au texte du Spacer** — en place sur `.spacer-text`
6. ✅ **Vérifier l'animation des blocs Stats et Quote** — `animClass` appliqué dans les composants, cohérent avec le wrapper PageRenderer

### ✅ TODO - Vérification des éléments modifiables

| TO DO | Bloc/Fichier | Type | Priorité | État |
|-------|--------------|------|----------|------|
| Ajouter `visibilityClasses` computed dans BlockStats.vue | `components/blocks/BlockStats.vue` | Bug | Haute | ✅ Fait |
| Ajouter `animClass` dans BlockStats.vue | `components/blocks/BlockStats.vue` | Bug | Haute | ✅ Fait |
| Ajouter `visibilityClasses` computed dans BlockQuote.vue | `components/blocks/BlockQuote.vue` | Bug | Haute | ✅ Fait |
| Ajouter `animClass` dans BlockQuote.vue | `components/blocks/BlockQuote.vue` | Bug | Haute | ✅ Fait |
| Ajouter `visibilityClasses` computed dans BlockFooter.vue | `components/blocks/BlockFooter.vue` | Bug | Haute | ✅ Fait |
| Appliquer `fieldFontStyle()` sur texte du Spacer | `components/blocks/BlockSpacer.vue` | Amélioration | Moyenne | ✅ Déjà en place (`.spacer-text`) |
| Ajouter bouton `+ Texte HTML` dans FieldElements.vue | `components/editor/FieldElements.vue` | Feature | Haute | ✅ Fait |
| Protéger `fontSize` contre `undefined` dans FAQ | `components/blocks/BlockFaq.vue` | Bug | Haute | ✅ Fait |
| Examiner `animations: "wrapper"` vs réel pour Stats/Quote | `utils/blockTypes.js`, composants | Design | Basse | ✅ Vérifié : wrapper PageRenderer + classes internes cohérents |

## 📐 Fonctionnalités de modification disponibles par bloc (sidebar)

Cette section documente ce qui peut être modifié depuis la sidebar pour chaque bloc, basé sur l'analyse de la cohérence `schema` → `props` → `template`.

### Bloc Hero (`hero`)
| Champ | Modifiable depuis sidebar | Appliqué au rendu | Tests |
|-------|--------------------------|-------------------|-------|
| image | ✅ | ✅ | ✅ |
| nameImage | ✅ | ✅ | ✅ |
| height | ✅ | ✅ | ✅ |
| overlay | ✅ | ✅ | ✅ |
| overlayColor | ✅ | ✅ | ✅ |
| overlayText | ✅ | ✅ | ✅ |
| textColor | ✅ | ✅ | ✅ |
| showButton | ✅ | ✅ | ✅ |
| **Design** | | | |
| fontFamily | ✅ | ✅ | ✅ |
| fontSize | ✅ | ✅ | ✅ |
| fontWeight | ✅ | ❌ Non applicable (pas de champ fontWeight dans schema) | N/A |
| **Note** | Aucun champ avec `sizable` dans les sous-éléments (pas de tableau) | | |

### Bloc Bienvenue (`bienvenue`)
| Champ | Modifiable | Appliqué | Tests |
|-------|-----------|----------|-------|
| title | ✅ | ✅ | ✅ |
| subtitle | ✅ | ✅ | ✅ |
| backgroundColor | ✅ | ✅ | ✅ |
| textColor | ✅ | ✅ | ✅ |
| animation | ✅ | ✅ | ✅ |
| fontSize | ✅ | ✅ (titre seulement) | ✅ |

### Bloc Rejoins (`rejoins`)
| Champ | Modifiable | Appliqué | Tests |
|-------|-----------|----------|-------|
| title | ✅ | ✅ | ✅ |
| subtitle | ✅ | ✅ | ✅ |
| location | ✅ | ✅ | ✅ |
| backgroundGradient | ✅ | ✅ | ✅ |
| horaires[] | ✅ | ✅ | ✅ |
| **Design** | | | |
| fontFamily | ✅ | ✅ | ✅ |
| fontSize | ✅ | ✅ | ✅ |
| **Note** | Animation `internal` (cercles qui bougent) | | |

### Bloc Aspirations (`aspirations`)
| Champ | Modifiable | Appliqué | Tests |
|-------|-----------|----------|-------|
| title | ✅ | ✅ | ✅ |
| items[] | ✅ | ✅ | ✅ |
| backgroundColor | ✅ | ✅ | ✅ |
| textColor | ✅ | ✅ | ✅ |
| **Design** | | | |
| fontFamily | ✅ | ✅ | ✅ |
| fontSize | ✅ | ❌ Pas de contrôle pour items individuels | |
| **Note** | Animation `internal` avec cercles | | |

### Bloc Nous rejoindre (`nousRejoindre`)
| Champ | Modifiable | Appliqué | Tests |
|-------|-----------|----------|-------|
| title | ✅ | ✅ | ✅ |
| link | ✅ | ✅ | ✅ |
| backgroundGradient | ✅ | ✅ | ✅ |
| **Design** | | | |
| fontFamily | ✅ | ✅ | ✅ |
| fontSize | ✅ | ✅ | ✅ |
| **Note** | Animation `internal` avec cercles | | |

### Bloc Vision (`vision`)
| Champ | Modifiable | Appliqué | Tests |
|-------|-----------|----------|-------|
| label | ✅ | ✅ | ✅ |
| quote | ✅ | ✅ | ✅ |
| ctaText | ✅ | ✅ | ✅ |
| ctaLink | ✅ | ✅ | ✅ |
| backgroundGradient | ✅ | ✅ | ✅ |
| textColor | ✅ | ✅ | ✅ |
| animation | ✅ | ✅ | ✅ |
| **Design** | | | |
| fontFamily | ✅ | ✅ | ✅ |
| fontSize | ✅ | ✅ | ✅ |

### Bloc FAQ (`faq`)
| Champ | Modifiable | Appliqué | Tests |
|-------|-----------|----------|-------|
| title | ✅ | ✅ | ✅ |
| subtitle | ✅ | ✅ | ✅ |
| items[].question | ✅ | ✅ | ✅ |
| items[].answer | ✅ | ✅ | ✅ |
| items[].questionSize | ✅ | ✅ Style conditionnel (rien si undefined) | ✅ |
| items[].answerSize | ✅ | ✅ Style conditionnel (rien si undefined) | ✅ |
| openFirst | ✅ | ✅ | ✅ |
| backgroundColor | ✅ | ✅ | ✅ |
| textColor | ✅ | ✅ | ✅ |
| animation | ✅ | ✅ | ✅ |
| **Design** | | | |
| fontFamily | ✅ | ✅ | ✅ |
| fontSize | ✅ (top-level) | ✅ | ✅ |
| **Note** | Les sous-champs ont un contrôle `sizable` mais pas `fieldFonts`/`fieldFontSizes` | | |

### Bloc Stats (`stats`)
| Champ | Modifiable | Appliqué | Tests |
|-------|-----------|----------|-------|
| title | ✅ | ✅ | ✅ |
| items[] | ✅ | ✅ | ✅ |
| backgroundColor | ✅ | ✅ | ✅ |
| textColor | ✅ | ✅ | ✅ |
| animation | ✅ | ✅ `animClass` + `isTriggered` (pattern BlockRichText) | ✅ `visibility-device.spec.ts` |
| **Design** | | | |
| fontFamily | ✅ | ✅ | ✅ |
| fontSize | ✅ | ✅ | ✅ |

### Bloc Quote (`quote`)
| Champ | Modifiable | Appliqué | Tests |
|-------|-----------|----------|-------|
| quote | ✅ | ✅ | ✅ |
| author | ✅ | ✅ | ✅ |
| backgroundColor | ✅ | ✅ | ✅ |
| textColor | ✅ | ✅ | ✅ |
| animation | ✅ | ✅ `animClass` + `isTriggered` (pattern BlockRichText) | ✅ `visibility-device.spec.ts` |
| **Design** | | | |
| fontFamily | ✅ | ✅ | ✅ |
| fontSize | ✅ | ✅ | ✅ |

### Bloc Galerie (`gallery`)
| Champ | Modifiable | Appliqué | Tests |
|-------|-----------|----------|-------|
| title | ✅ | ✅ | ✅ |
| textColor | ✅ | ✅ | ✅ |
| images[] | ✅ | ✅ | ✅ |
| columns | ✅ | ✅ | ✅ |
| backgroundColor | ✅ | ✅ | ✅ |
| animation | ✅ | ✅ | ✅ |
| **Design** | | | |
| fontFamily | ✅ | ✅ | ✅ |
| fontSize | ✅ | ✅ | ✅ |

### Bloc Spacer (`spacer`)
| Champ | Modifiable | Appliqué | Tests |
|-------|-----------|----------|-------|
| height | ✅ | ✅ | ✅ |
| backgroundColor | ✅ | ✅ | ✅ |
| text | ✅ | ✅ | ✅ |
| image | ✅ | ✅ | ✅ |
| contentAlign | ✅ | ✅ | ✅ |
| contentVerticalAlign | ✅ | ✅ | ✅ |
| **Design** | | | |
| fontFamily | ✅ | ✅ Appliqué sur `.spacer-text` via `fieldFontStyle` | ✅ |
| fontSize | ✅ | ✅ Appliqué sur `.spacer-text` | ✅ |
| **Note** | Non appliqué sur l'image (`<img>`) : une police n'a aucun effet sur une image | | |

### Bloc Texte/Image (`textImage`)
| Champ | Modifiable | Appliqué | Tests |
|-------|-----------|----------|-------|
| title | ✅ | ✅ | ✅ |
| subtitle | ✅ | ✅ | ✅ |
| body | ✅ | ✅ | ✅ |
| image | ✅ | ✅ | ✅ |
| reverse | ✅ | ✅ | ✅ |
| visualStyle | ✅ | ✅ | ✅ |
| ctaText | ✅ | ✅ | ✅ |
| ctaLink | ✅ | ✅ | ✅ |
| buttons[] | ✅ | ✅ | ✅ |
| backgroundColor | ✅ | ✅ | ✅ |
| textColor | ✅ | ✅ | ✅ |
| animation | ✅ | ✅ | ✅ |
| **Design** | | | |
| fontFamily | ✅ | ✅ | ✅ |
| fontSize | ✅ | ✅ | ✅ |

### Bloc Équipe (`equipe`)
| Champ | Modifiable | Appliqué | Tests |
|-------|-----------|----------|-------|
| title | ✅ | ✅ | ✅ |
| subtitle | ✅ | ✅ | ✅ |
| members[].name | ✅ | ✅ | ✅ |
| members[].role | ✅ | ✅ | ✅ |
| members[].photo | ✅ | ✅ | ✅ |
| members[].description | ✅ | ✅ | ✅ |
| columns | ✅ | ✅ | ✅ |
| backgroundColor | ✅ | ✅ | ✅ |
| textColor | ✅ | ✅ | ✅ |
| animation | ✅ | ✅ | ✅ |
| **Design** | | | |
| fontFamily | ✅ | ✅ | ✅ |
| fontSize | ✅ | ✅ | ✅ |
| **Note** | Les sous-champs ne bénéficient pas de `fieldFonts` individuels | | |

### Bloc Vidéo (`youtube`)
| Champ | Modifiable | Appliqué | Tests |
|-------|-----------|----------|-------|
| videoId | ✅ | ✅ | ✅ |
| title | ✅ | ✅ | ✅ |
| backgroundColor | ✅ | ✅ | ✅ |
| animation | ✅ | ✅ | ✅ |
| **Design** | | | |
| fontFamily | ✅ | ✅ | ✅ |
| fontSize | ✅ | ✅ | ✅ |

### Bloc Image pleine largeur (`fullWidthImage`)
| Champ | Modifiable | Appliqué | Tests |
|-------|-----------|----------|-------|
| src | ✅ | ✅ | ✅ |
| alt | ✅ | ✅ | ✅ |
| height | ✅ | ✅ | ✅ |
| **Design** | | | |
| fontFamily | ❌ Absent des props | - | N/A |
| fontSize | ❌ Absent des props | - | N/A |
| **Note** | Pas de props `fieldFonts`/`fieldFontSizes` - le texte alternatif ne peut pas être stylisé via sidebar | | |

### Bloc Footer (`footer`)
| Champ | Modifiable | Appliqué | Tests |
|-------|-----------|----------|-------|
| title | ✅ | ✅ | ✅ |
| email | ✅ | ✅ | ✅ |
| schedule | ✅ | ✅ | ✅ |
| address | ✅ | ✅ | ✅ |
| bgColorStart/Mid/End | ✅ | ✅ | ✅ |
| bgColorMobileStart/End | ✅ | ✅ | ✅ |
| fontSize | ✅ | ✅ | ✅ |
| titleFontSize | ✅ | ✅ | ✅ |
| textColor | ✅ | ✅ | ✅ |
| titleBoldStart/End | ✅ | ✅ | ✅ |
| **Design** | | | |
| animation | ❌ Absent du schema | - | N/A (animation intern via shutter) |
| **Note** | Le footer a `animations: "internal"` et utilise `useAnimatedElements` pour l'animation d'entrée, pas le champ `animation` wrapper. **Problème : `visibility` non appliqué.** | | |

### Bloc Contact (`contact`)
| Champ | Modifiable | Appliqué | Tests |
|-------|-----------|----------|-------|
| title | ✅ | ✅ | ✅ |
| addressTitle | ✅ | ✅ | ✅ |
| addressLine | ✅ | ✅ | ✅ |
| image | ✅ | ✅ | ✅ |
| mapEmbedUrl | ✅ | ✅ | ✅ |
| backgroundGradient | ✅ | ✅ | ✅ |
| showQuestions | ✅ | ✅ | ✅ |
| showSocials | ✅ | ✅ | ✅ |
| textColor | ✅ | ✅ | ✅ |
| animation | ✅ | ✅ | ✅ |
| **Design** | | | |
| fontFamily | ✅ | ✅ | ✅ |
| fontSize | ✅ | ✅ | ✅ |

### Éléments additionnels (`FieldElements.vue`)
| Type | Ajoutable depuis sidebar | Contrôles disponibles | Notes |
|------|-------------------------|---------------------|-------|
| text | ✅ `+ Texte` | Police, taille, texte, animation, position | |
| image | ✅ `+ Image` | URL, alt, animation, position | |
| button | ✅ `+ Bouton` | Texte, lien, animation, position | |
| richtext | ✅ `+ Texte HTML` | Police, taille, HTML, animation, position | Placeholder `<p>Nouveau contenu HTML...</p>` à la création |

### 🐛 Incohérences Schema vs Rendu (priorité haute)

| Bloc | Champ Schema | Présence dans composant | Détails |
|------|-------------|------------------------|---------|
| Tous | `fieldFonts` / `fieldFontSizes` | ✅ | Tous les blocs récents l'acceptent, mais les champs texte dans les tableaux (activities.items[].title, faq.items[].question) n'ont pas accès à la police/taille par champ. |
| `BlockStats.vue` | `animation` | ✅ Prop | ✅ Corrigé : `animClass` + `isTriggered` appliqués sur la `<section>` (pattern BlockRichText). |
| `BlockQuote.vue` | `animation` | ✅ Prop | ✅ Corrigé : idem Stats. |
| `BlockFooter.vue` | `animation` | ❌ Absente | Schema n'a pas de champ `animation`, mais le composant a `animation: "none"` en default. Animation gérée via `animations: "internal"` et `useAnimatedElements`. |
| `BlockSpacer.vue` | `fieldFonts` / `fieldFontSizes` | ✅ Props | ✅ Appliqués sur `.spacer-text` via `fieldFontStyle`. |
| `BlockFullWidthImage.vue` | `fieldFonts` / `fieldFontSizes` | ❌ Absents | Pas de props `fieldFonts`/`fieldFontSizes`. Le texte alternatif ne peut pas être stylisé. |

### 📋 Ce qui manque pour une cohérence complète des éléments modifiables

Pour que **tous les éléments affichés dans la sidebar soient modifiables** de manière uniforme sur n'importe quelle page, il faut ajouter :

#### Dans `components/blocks/BlockStats.vue`
| Élément manquant | Ligne à modifier | Action requise |
|------------------|-----------------|--------------|
| `:class="visibilityClasses"` | Ligne 2 | Ajouter computed `visibilityClasses` + `:class="[visibilityClasses]"` dans le `<section>` |
| Animation wrapper | Ligne 2 | Ajouter `animClass` et `:class="animClass"` comme dans les autres blocs |

#### Dans `components/blocks/BlockQuote.vue`
| Élément manquant | Ligne à modifier | Action requise |
|------------------|-----------------|--------------|
| `:class="visibilityClasses"` | Ligne 2 | Ajouter computed `visibilityClasses` + `:class="[visibilityClasses]"` dans le `<section>` |
| Animation wrapper | Ligne 2 | Ajouter `animClass` et `:class="animClass"` comme dans les autres blocs |

#### Dans `components/blocks/BlockFooter.vue`
| Élément manquant | Ligne à modifier | Action requise |
|------------------|-----------------|--------------|
| `:class="visibilityClasses"` | Ligne 4 | Ajouter computed `visibilityClasses` + `:class="[visibilityClasses]"` dans le `<footer>` |

#### Dans `components/blocks/BlockSpacer.vue`
| Élément manquant | Ligne à modifier | Action requise |
|------------------|-----------------|--------------|
| `fieldFontStyle()` sur texte/image | Ligne 9 | Appliquer `:style="fieldFontStyle(fieldFonts, 'text', fieldFontSizes)"` sur `.spacer-text` et `.spacer-img` |

#### Dans `components/editor/FieldElements.vue`
| Élément manquant | Ligne à modifier | Action requise |
|------------------|-----------------|--------------|
| Bouton `+ Texte HTML` | Ligne 115 | Ajouter `<button class="array-add-btn" @click="addItem('richtext')">+ Texte HTML</button>` |

#### Correction dans `components/blocks/BlockFaq.vue`
| Élément à corriger | Ligne actuelle | Action requise |
|-------------------|---------------|--------------|
| Style `fontSize: undefined` | Ligne 14, 17 | Modifier `:style="{ fontSize: item.questionSize }"` en `:style="item.questionSize ? { fontSize: item.questionSize } : {}"` |

### 🧪 Scénarios de test supplémentaires recommandés

Pour valider la cohérence complète sidebar ↔ rendu, il manque ces tests :

| Scénario | Fichier test actuel | Action |
|----------|-------------------|--------|
| Masquage d'un bloc Stats via visibility | ✅ `tests/playwright/visibility-device.spec.ts` | Vérifie `.hide-mobile` sur wrapper + section, et le masquage réel en viewport mobile |
| Masquage d'un bloc Quote via visibility | ✅ `visibility-device.spec.ts` | Idem que Stats |
| Masquage du Footer via visibility | ✅ `visibility-device.spec.ts` | Seed via `PUT /api/footer` (props.visibility), classe sur `.site-footer` |
| Animation d'entrée sur Stats | ✅ `visibility-device.spec.ts` | Vérifie `block-anim-fadeIn` sur la section interne |
| Animation d'entrée sur Quote | ✅ `visibility-device.spec.ts` | Vérifie `block-anim-slideUp` sur la section interne |
| Police personnalisée sur texte du Spacer | ❌ Manquant | Ouvrir sidebar → changer police → vérifier le style appliqué |
| Taille personnalisée sur questions FAQ | ⚠️ Partiel | Style conditionnel en place ; test dédié `undefined` non écrit |
| Ajout d'élément richtext dans canvas | ⚠️ À tester | Bouton `+ Texte HTML` ajouté — test E2E dédié non écrit |

### 🔧 Checklist de vérification

- [ ] Stats + Quote : `visibilityClasses` appliqué
- [ ] Stats + Quote : `animClass` ajouté (ou champ `animation` retiré du schema)
- [ ] Footer : `visibilityClasses` appliqué
- [ ] Spacer : `fieldFontStyle()` appliqué au texte
- [ ] FieldElements : bouton `+ Texte HTML` ajouté
- [ ] FAQ : protection contre `undefined` dans les styles inline

## 📚 Références open source

Inspiration pour la structure de documentation et les patterns de gestion des incohérences :

| Projet | Patterns pertinents |
|--------|-------------------|
| **PayloadCMS** | [Blocks Field](https://payloadcms.com/docs/fields/blocks) : Structure de blocs schema-driven avec templates |
| **Directus** | [Interfaces & Layouts](https://docs.directus.io/guides/customizing-admin-app.html) : Champs techniques vs champs visuels |
| **Sanity** | [Structure Builder](https://www.sanity.io/docs/structure-builder) : Documentation "Gotchas" pour les incohérences attendues |
| **Builder.io** | [Custom Components](https://www.builder.io/c/docs/custom-components) : Pattern de champs qui n'ont pas toujours d'effet rendu |


## Inscription au Parcours Alpha

Page Événements par défaut : prochains événements, présentation Alpha (questions, encadré du prochain parcours à compléter, gratuit), déroulement d'une rencontre en deux temps, formulaire, FAQ, « Où nous trouver » avec carte. Bloc `inscriptionAlpha` : prénom, nom, e-mail, téléphone, adresse facultative, mot facultatif, consentement obligatoire. L'envoi passe par `POST /api/contact` (champs `parcours`, `telephone`, `adresse`) : l'inscrit apparaît dans l'admin 📬 Messages avec ces informations et déclenche l'e-mail de notification habituel. Réglage « Nombre de places » du bloc (0 = illimité) : le formulaire affiche les places restantes (`GET /api/alpha-places`, compteurs seulement) et le serveur refuse l'inscription (409) quand c'est complet. Dans l'admin 📬 Messages, le filtre « Inscrits Alpha » liste les inscrits et le bouton « Export CSV » les télécharge (compatible Excel). La page par défaut comporte aussi une FAQ Alpha.


## Bloc Rejoins-nous

Réglage « Position des horaires » : `dessous` (défaut, horaires centrés sous « Rejoins-nous / Chaque dimanche / à Morlaix ») ou `cote` (ancienne mise en page, horaires à droite).
