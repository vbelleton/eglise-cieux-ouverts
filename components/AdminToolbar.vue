<template>
    <div class="admin-toolbar">
        <div class="admin-toolbar-left">
            <span class="admin-badge">Mode édition</span>
            <select
                class="admin-page-select"
                :value="pageSlug"
                @change="navigateToPage($event.target.value)"
            >
                <option v-for="p in orderedPageOptions" :key="p.slug" :value="p.slug">{{ p.label }}</option>
            </select>
        </div>
        <div class="admin-toolbar-center">
            <div class="device-toggle" v-if="activeBlock">
                <span class="admin-block-type">{{
                    getBlockLabel(activeBlock.type)
                }}</span>
            </div>
            <div class="device-toggle" v-else>
                <button
                    class="device-btn"
                    :class="{ active: previewDevice === 'desktop' }"
                    @click="setDevice('desktop')"
                    title="Desktop"
                >
                    <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                    >
                        <rect x="2" y="3" width="20" height="14" rx="2" />
                        <line x1="8" y1="21" x2="16" y2="21" />
                        <line x1="12" y1="17" x2="12" y2="17" />
                    </svg>
                </button>
                <button
                    class="device-btn"
                    :class="{ active: previewDevice === 'tablet' }"
                    @click="setDevice('tablet')"
                    title="Tablet"
                >
                    <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                    >
                        <rect x="4" y="2" width="16" height="20" rx="2" />
                        <line x1="12" y1="18" x2="12" y2="18" />
                    </svg>
                </button>
                <button
                    class="device-btn"
                    :class="{ active: previewDevice === 'mobile' }"
                    @click="setDevice('mobile')"
                    title="Mobile"
                >
                    <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                    >
                        <rect x="5" y="2" width="14" height="20" rx="2" />
                        <line x1="12" y1="18" x2="12" y2="18" />
                    </svg>
                </button>
            </div>
        </div>
        <div class="admin-toolbar-right">
            <div class="undo-redo-group">
                <button
                    class="admin-icon-btn"
                    @click="undo"
                    :disabled="!canUndo()"
                    :title="undoTooltip"
                >
                    ↩
                </button>
                <button
                    class="admin-icon-btn"
                    @click="redo"
                    :disabled="!canRedo()"
                    :title="redoTooltip"
                >
                    ↪
                </button>
            </div>
            <ClientOnly>
                <template v-if="user">
                    <template v-if="checkingAdmin">
                        <span class="admin-save-status">Vérification...</span>
                    </template>
                    <template v-else-if="!isAdminUser" />
                    <template v-else>
                        <span
                            class="admin-save-status preview-mode"
                            v-if="previewingVersion"
                            >👁 Prévisualisation en cours</span
                        >
                        <span
                            class="admin-save-status unsaved"
                            v-else-if="hasAnyUnsavedChanges && !saveStatus"
                            >⚠ Modifications non sauvegardées</span
                        >
                        <span
                            class="admin-save-status auto-saved"
                            v-else-if="saveStatus && saveStatus === 'Auto-sauvegardé'"
                            >✓ Auto-sauvegardé</span
                        >
                        <span class="admin-save-status" v-else-if="saveStatus">{{
                            saveStatus
                        }}</span>
                        <img
                            v-if="user.photoURL"
                            :src="user.photoURL"
                            class="admin-avatar"
                            alt="Photo profil"
                        />
                        <span v-else class="admin-user">{{ user.email }}</span>
                        <button
                            class="admin-btn admin-btn-add-block"
                            @click="() => { loadTemplates(); showBlockPicker = true }"
                            title="Ajouter un bloc à la page"
                        >
                            ＋ Bloc
                        </button>
                        <button
                            class="admin-btn"
                            @click="saveChanges"
                            :disabled="saving"
                            title="Sauvegarder les modifications"
                        >
                            {{ saving ? "Sauvegarde..." : "Sauvegarder" }}
                        </button>
                        <button
                            v-if="previewingVersion"
                            class="admin-btn admin-btn-preview-cancel admin-btn-compact"
                            @click="cancelPreview"
                            title="Annuler le preview et revenir à la version actuelle"
                        >
                            <span class="icon">❌</span><span class="label">Annuler preview</span>
                        </button>
                        <button
                            class="admin-btn admin-btn-secondary admin-btn-compact"
                            @click="showVersionHistory = true"
                            title="Historique des versions"
                        >
                            <span class="icon">🕐</span><span class="label">Versions</span>
                        </button>
                        <!-- Le MenuEditor (créer/gérer les pages, ordonner le menu)
                             ne s'ouvrait qu'en cliquant sur le menu du site en mode
                             admin — introuvable sans le savoir. Point d'entrée
                             explicite ici. -->
                        <button
                            class="admin-btn admin-btn-secondary admin-btn-compact"
                            @click="openMenuEditor()"
                            title="Gérer le menu et les pages (créer, renommer, ordonner)"
                        >
                            <span class="icon">📄</span><span class="label">Pages</span>
                        </button>
                        <button
                            class="admin-btn admin-btn-secondary admin-btn-compact"
                            @click="showAdminManager = true"
                            title="Gérer les administrateurs"
                        >
                            <span class="icon">👥</span><span class="label">Admins</span>
                        </button>
                        <button
                            class="admin-btn admin-btn-secondary admin-btn-compact"
                            @click="showComments = true"
                            title="Demandes développeur"
                        >
                            <span class="icon">💬</span><span class="label">Demandes</span><span v-if="unresolvedCommentCount" class="admin-comment-count">{{ unresolvedCommentCount }}</span>
                        </button>
                        <button
                            class="admin-btn admin-btn-secondary admin-btn-compact"
                            @click="openContactMessages"
                            title="Messages de contact"
                        >
                            <span class="icon">📬</span><span class="label">Messages</span><span v-if="unreadContactCount" class="admin-msg-count">{{ unreadContactCount }}</span>
                        </button>
                        <button
                            class="admin-btn admin-btn-secondary admin-btn-compact"
                            @click="showSettings = true"
                            title="Configuration"
                        >
                            <span class="icon">⚙️</span><span class="label">Config</span>
                        </button>
                        <button
                            class="admin-btn admin-btn-secondary admin-btn-compact"
                            @click="showEventManager = true"
                            title="Gérer les événements"
                        >
                            <span class="icon">📅</span><span class="label">Événements</span>
                        </button>
                        <button
                            class="admin-btn admin-btn-secondary admin-btn-compact"
                            @click="showTaches = true"
                            title="Tableau des tâches — qui fait quoi"
                        >
                            <span class="icon">📋</span><span class="label">Tâches</span>
                        </button>
                        <button
                            class="admin-btn admin-btn-secondary"
                            @click="signOutAndExit"
                            title="Quitter le mode admin"
                        >
                            Quitter
                        </button>
                    </template>
                </template>
                <template v-else>
                    <button
                        class="admin-btn admin-btn-login"
                        @click="goToAdminLogin"
                    >
                        Se connecter
                    </button>
                    <button
                        class="admin-btn admin-btn-secondary"
                        @click="exitAdmin"
                    >
                        ✕
                    </button>
                </template>
                <template #fallback>
                    <span class="admin-loading">Chargement...</span>
                </template>
            </ClientOnly>
        </div>
    </div>

    <div
        class="admin-sidebar-overlay"
        v-if="sidebarBlock && user"
        @click="positioningElementId ? stopPositioning() : closeSidebar()"
    ></div>
    <div class="admin-sidebar" v-if="sidebarBlock && user" :class="{ 'positioning-mode': positioningElementId }">
        <div class="admin-sidebar-header">
            <h3>{{ getBlockLabel(sidebarBlock.type) }}</h3>
            <button class="admin-close-btn" @click="closeSidebar">
                ✕
            </button>
        </div>
        <div class="admin-sidebar-body">
            <div v-if="!editingFooter" class="admin-responsive-panel">
                <p class="admin-responsive-label">Visible sur {{ deviceLabel(previewDevice) }}</p>
                <button
                    class="admin-vis-btn"
                    :class="{ off: deviceVisible(previewDevice) === false }"
                    :title="deviceVisible(previewDevice) === false ? `Masqué sur ${deviceLabel(previewDevice)}` : `Visible sur ${deviceLabel(previewDevice)}`"
                    @click="toggleDeviceVisibility(previewDevice)"
                >
                    <span class="admin-vis-icon">{{ deviceIcon(previewDevice) }}</span>
                    <span class="admin-vis-name">{{ deviceLabel(previewDevice) }}</span>
                    <span class="admin-vis-state">{{ deviceVisible(previewDevice) === false ? '🚫 Masqué' : '✓ Visible' }}</span>
                </button>
                <!-- Rappel passif (non cliquable) : évite de devoir changer de
                     device juste pour vérifier si le bloc est masqué ailleurs.
                     Seul le bouton ci-dessus (device actif) modifie l'état. -->
                <div class="admin-vis-others">
                    <span
                        v-for="d in otherDevices"
                        :key="d"
                        class="admin-vis-mini"
                        :class="{ off: deviceVisible(d) === false }"
                        :title="deviceVisible(d) === false ? `Masqué sur ${deviceLabel(d)}` : `Visible sur ${deviceLabel(d)}`"
                    >
                        {{ deviceIcon(d) }} {{ deviceVisible(d) === false ? '🚫' : '✓' }}
                    </span>
                </div>
                <div v-if="previewDevice !== 'desktop'" class="admin-responsive-editing">
                    ✎ Vous modifiez la version <strong>{{ deviceLabel(previewDevice) }}</strong>.
                    Les réglages s'appliquent à ce format uniquement.
                    <button
                        v-if="hasDeviceOverrides"
                        class="admin-reset-overrides"
                        @click="resetCurrentDeviceOverrides"
                    >
                        Réinitialiser ({{ deviceLabel(previewDevice) }})
                    </button>
                </div>
                <p v-else class="admin-responsive-hint">
                    Choisis Tablette/Mobile dans la barre du haut pour régler chaque format.
                </p>
            </div>
            <div v-if="!editingFooter && sidebarBlock" class="admin-height-panel">
                <p class="admin-height-label">Hauteur minimale du bloc (px)</p>
                <div class="admin-height-row">
                    <input
                        type="number"
                        class="admin-height-input"
                        min="0"
                        placeholder="Auto"
                        :value="sidebarBlock.props?.minHeight || ''"
                        @input="updateBlock(sidebarBlock.id, { minHeight: $event.target.value ? Number($event.target.value) : '' })"
                    />
                    <button
                        v-if="sidebarBlock.props?.minHeight"
                        class="admin-height-reset"
                        title="Revenir à la hauteur automatique"
                        @click="updateBlock(sidebarBlock.id, { minHeight: '' })"
                    >↺ Auto</button>
                </div>
            </div>
            <FieldElements
                v-if="!editingFooter && sidebarBlock"
                :elements="sidebarBlock.props?.extraElements || []"
                :selected-id="selectedElementId"
                @change="updateBlock(sidebarBlock.id, { extraElements: $event })"
                @replay="onExtraElementReplay"
                @select="selectedElementId = $event"
                @position="startPositioning"
            />
            <div v-if="sidebarBlock" class="admin-comment-panel">
                <p class="admin-comment-label">💬 Note pour le développeur</p>
                <textarea
                    v-model="commentDraft"
                    class="admin-comment-textarea"
                    placeholder="Ex : « J'aimerais un compteur ici — ça demande du code »"
                    rows="3"
                ></textarea>
                <div class="admin-comment-actions">
                    <button
                        class="admin-btn admin-btn-secondary"
                        @click="saveComment"
                        :disabled="!commentDraft.trim() || savingComment"
                    >
                        {{ savingComment ? "..." : (activeComment ? "Mettre à jour" : "Créer la demande") }}
                    </button>
                    <button
                        v-if="activeComment && !activeComment.resolved"
                        class="admin-btn admin-btn-secondary"
                        @click="toggleCommentResolved(true)"
                    >✓ Marquer résolu</button>
                    <button
                        v-if="activeComment && activeComment.resolved"
                        class="admin-btn admin-btn-secondary"
                        @click="toggleCommentResolved(false)"
                    >↺ Rouvrir</button>
                    <button
                        v-if="activeComment"
                        class="admin-comment-del-btn"
                        @click="deleteActiveComment"
                        title="Supprimer"
                    >✕</button>
                </div>
                <p v-if="activeComment?.resolved" class="admin-comment-resolved-note">
                    Résolu{{ activeComment.resolvedBy ? ' par ' + activeComment.resolvedBy : '' }}
                </p>
            </div>
            <AutoEditor
                :schema="sidebarSchema"
                :model-value="sidebarBlock"
                @update="onAutoUpdate"
                @promoted="onPromoted"
            />
            <p v-if="sidebarBlock && BLOCK_TYPES[sidebarBlock.type]?.animations !== 'wrapper'" class="admin-anim-note">
                {{ BLOCK_TYPES[sidebarBlock.type]?.animations === 'none' ? 'Aucune animation configurable pour ce bloc.' : 'Animation CSS native — non modifiable dans l\'éditeur.' }}
            </p>
            <div v-if="!editingFooter && hasImageFields" class="admin-image-section">
                <p class="admin-image-section-label">Images</p>
                <div class="uploader-controls">
                    <input
                        ref="adminFileInput"
                        type="file"
                        accept="image/*"
                        class="file-input"
                        @change="onAdminFileSelected"
                    />
                    <button
                        class="admin-btn"
                        @click.prevent="adminFileInput?.click()"
                    >
                        Téléverser une image
                    </button>
                    <button
                        v-if="uploadedImages.length"
                        class="admin-btn admin-btn-secondary"
                        @click.prevent="toggleAdminImagesList()"
                    >
                        Images uploadées ({{ uploadedImages.length }})
                    </button>
                </div>
                <div v-if="showAdminImagesList" class="admin-uploaded-list">
                    <div v-if="imagesLoading" class="images-loading">
                        Chargement...
                    </div>
                    <div v-else class="admin-uploaded-grid">
                        <div
                            v-for="(u, i) in uploadedImages"
                            :key="i"
                            class="admin-uploaded-item"
                        >
                            <img
                                :src="u"
                                @click="selectAdminUploaded(u)"
                                alt="img"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="admin-sidebar-footer" v-if="!editingFooter">
            <div class="admin-block-actions">
                <button
                    class="admin-action-btn"
                    @click="moveBlock(sidebarBlock.id, -1)"
                    title="Monter"
                >
                    ↑
                </button>
                <button
                    class="admin-action-btn"
                    @click="moveBlock(sidebarBlock.id, 1)"
                    title="Descendre"
                >
                    ↓
                </button>
                <button
                    class="admin-action-btn admin-action-duplicate"
                    @click="duplicateBlock(sidebarBlock.id)"
                    title="Dupliquer"
                >
                    📋
                </button>
                <button
                    class="admin-action-btn admin-action-template"
                    @click="openTemplateModal"
                    title="Sauvegarder template"
                >
                    💾
                </button>
                <button
                    class="admin-action-btn admin-action-danger"
                    @click="removeBlock(sidebarBlock.id)"
                    title="Supprimer"
                >
                    🗑
                </button>
            </div>
        </div>
        <div class="admin-sidebar-footer" v-else>
            <div class="admin-block-actions">
                <button
                    class="admin-btn"
                    @click="saveFooterChanges"
                    style="flex:1"
                >
                    Sauvegarder le footer
                </button>
            </div>
        </div>
    </div>

    <!-- Block Picker Modal -->
    <Teleport to="body">
        <div v-if="showBlockPicker" class="version-modal-overlay" @click.self="showBlockPicker = false">
            <div class="version-modal block-picker-modal">
                <div class="version-modal-header">
                    <div>
                        <h3>Ajouter un bloc</h3>
                        <p v-if="activeBlock" class="block-picker-subtitle">Sera inséré après « {{ getBlockLabel(activeBlock.type) }} »</p>
                        <p v-else class="block-picker-subtitle">Sera ajouté en fin de page</p>
                    </div>
                    <button class="version-modal-close" @click="showBlockPicker = false" title="Fermer">✕</button>
                </div>
                <div class="version-modal-body">
                    <div class="block-picker-grid">
                        <button
                            v-for="bt in pickableBlockTypes"
                            :key="bt.key"
                            class="block-picker-card"
                            @click="pickBlock(bt.key)"
                        >
                            <span class="block-picker-icon">{{ bt.icon }}</span>
                            <span class="block-picker-label">{{ bt.label }}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </Teleport>

    <!-- Template Picker Modal (2nd step, using saved templates) -->
    <Teleport to="body">
        <div v-if="showTemplatePicker" class="version-modal-overlay" @click.self="showTemplatePicker = false">
            <div class="version-modal block-picker-modal">
                <div class="version-modal-header">
                    <div>
                        <h3>Choisir un modèle</h3>
                        <p class="block-picker-subtitle">{{ getBlockLabel(pendingBlockType) }}</p>
                    </div>
                    <button class="version-modal-close" @click="showTemplatePicker = false" title="Fermer">✕</button>
                </div>
                <div class="version-modal-body">
                    <button class="block-picker-back" @click="backToBlockPicker">← Retour</button>
                    <div v-if="templatesLoading" class="block-picker-loading">Chargement...</div>
                    <div v-else class="block-picker-grid">
                        <button
                            v-for="tpl in availableTemplates.filter(t => t.type === pendingBlockType)"
                            :key="tpl.id"
                            class="block-picker-card"
                            @click="pickTemplate(tpl)"
                        >
                            <span class="block-picker-icon">📄</span>
                            <span class="block-picker-label">{{ tpl.name }}</span>
                        </button>
                        <button
                            class="block-picker-card block-picker-card-empty"
                            @click="pickTemplate({ props: {} })"
                        >
                            <span class="block-picker-icon">➕</span>
                            <span class="block-picker-label">Bloc vierge</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </Teleport>

    <!-- Version History Modal -->
    <Teleport to="body">
        <div v-if="showVersionHistory" class="version-modal-overlay" @click.self="showVersionHistory = false">
            <div class="version-modal">
                <div class="version-modal-header">
                    <h3>Historique des versions — {{ props.pageSlug }} <span v-if="versions.length" class="version-count">{{ versions.length }}</span></h3>
                    <button class="version-modal-close" @click="showVersionHistory = false">✕</button>
                </div>
                <div class="version-modal-body">
                    <div v-if="versionsLoading" class="version-loading">Chargement...</div>
                    <div v-else-if="versions.length === 0" class="version-empty">
                        Aucune version sauvegardée
                    </div>
                    <div v-else>
                        <p class="version-list-hint">Chaque version est un instantané de la page pris juste avant une sauvegarde — pas nécessairement l'état actuellement affiché sur le site.</p>
                        <div v-if="blockOptions.length" class="version-filter-bar">
                            <label class="version-filter-label">Filtrer par bloc:</label>
                            <select v-model="filterByBlock" class="version-filter-select">
                                <option :value="null">Tous les blocs</option>
                                <option v-for="block in blockOptions" :key="block.id" :value="block.id">
                                    {{ block.label }}
                                </option>
                            </select>
                            <span v-if="filterByBlock" class="version-filter-count">{{ filteredVersions.length }} version{{ filteredVersions.length !== 1 ? 's' : '' }}</span>
                        </div>
                        <div v-if="filteredVersions.length === 0" class="version-empty">
                            Aucune version n'affecte ce bloc
                        </div>
                        <div v-else class="version-list">
                            <div
                                v-for="v in filteredVersions"
                            :key="v.id"
                            class="version-item"
                        >
                            <div class="version-item-row">
                                <div
                                    class="version-info"
                                    :style="{ cursor: v.changes ? 'pointer' : 'default' }"
                                    :title="v.changes ? (expandedVersion === v.id ? 'Masquer les détails' : 'Voir les détails des changements') : undefined"
                                    @click="v.changes && toggleVersionExpand(v.id)"
                                >
                                    <span class="version-date">{{ formatDate(v.savedAt) }}</span>
                                    <span class="version-author">{{ v.savedBy }}</span>
                                    <div class="version-meta">
                                        <span class="version-blocks">{{ v.blockCount }} bloc{{ v.blockCount !== 1 ? 's' : '' }}</span>
                                        <span v-if="versions.length && v.id === versions[0].id" class="version-current" title="L'état réellement affiché sur le site peut être différent : cette version est un instantané pris juste avant la dernière sauvegarde, pas l'état actuel en direct.">Précédente</span>
                                        <span v-if="v.changes" class="version-expand-arrow">{{ expandedVersion === v.id ? '▲' : '▼' }}</span>
                                    </div>
                                    <div v-if="v.changes && (v.changes.added || v.changes.removed || v.changes.modified)" class="version-diff">
                                        <span v-if="v.changes.added" class="vd-added">+{{ v.changes.added }} ajouté{{ v.changes.added > 1 ? 's' : '' }}</span>
                                        <span v-if="v.changes.removed" class="vd-removed">−{{ v.changes.removed }} supprimé{{ v.changes.removed > 1 ? 's' : '' }}</span>
                                        <span v-if="v.changes.modified" class="vd-modified">~{{ v.changes.modified }} modifié{{ v.changes.modified > 1 ? 's' : '' }}</span>
                                    </div>
                                </div>
                                <div class="version-actions">
                                    <button
                                        class="admin-btn admin-btn-secondary version-restore-btn"
                                        @click.stop="previewVersion(v.id)"
                                        :disabled="restoring === v.id || deletingVersion === v.id || previewingVersion === v.id"
                                        title="Prévisualiser cette version"
                                    >
                                        {{ previewingVersion === v.id ? "..." : "Prévisualiser" }}
                                    </button>
                                    <button
                                        class="admin-btn admin-btn-secondary version-restore-btn"
                                        @click.stop="restoreVersion(v.id)"
                                        :disabled="restoring === v.id || deletingVersion === v.id"
                                        title="Restaurer cette version"
                                    >
                                        {{ restoring === v.id ? "..." : "Restaurer" }}
                                    </button>
                                    <button
                                        class="version-del-btn"
                                        @click.stop="deleteVersion(v.id)"
                                        :disabled="deletingVersion === v.id || restoring === v.id"
                                        title="Supprimer cette version"
                                    >{{ deletingVersion === v.id ? "…" : "✕" }}</button>
                                </div>
                            </div>
                            <div v-if="expandedVersion === v.id && v.changes" class="version-detail-panel">
                                <div v-if="v.changes.details?.modified?.length" class="vd-detail-group">
                                    <span class="vd-detail-label">~ Modifiés</span>
                                    <span v-for="item in v.changes.details.modified" :key="item.id" class="vd-detail-item vd-modified">{{ item.label }}</span>
                                </div>
                                <div v-if="v.changes.details?.added?.length" class="vd-detail-group">
                                    <span class="vd-detail-label">+ Ajoutés</span>
                                    <span v-for="item in v.changes.details.added" :key="item.id" class="vd-detail-item vd-added">{{ item.label }}</span>
                                </div>
                                <div v-if="v.changes.details?.removed?.length" class="vd-detail-group">
                                    <span class="vd-detail-label">− Supprimés</span>
                                    <span v-for="item in v.changes.details.removed" :key="item.id" class="vd-detail-item vd-removed">{{ item.label }}</span>
                                </div>
                                <p v-if="!v.changes.details?.modified?.length && !v.changes.details?.added?.length && !v.changes.details?.removed?.length" class="vd-no-detail">Aucun changement détecté</p>
                            </div>
                        </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </Teleport>

    <!-- Admin Manager Modal -->
    <Teleport to="body">
        <div v-if="showAdminManager" class="version-modal-overlay" @click.self="showAdminManager = false">
            <div class="version-modal">
                <div class="version-modal-header">
                    <h3>Gestion des administrateurs</h3>
                    <button class="version-modal-close" @click="showAdminManager = false">✕</button>
                </div>
                <div class="version-modal-body">
                    <div class="admin-mgr-section" v-if="currentUserRole === 'admin'">
                        <h4>Ajouter un admin</h4>
                        <div class="admin-mgr-add">
                            <input
                                v-model="newAdminEmail"
                                placeholder="Email de l'utilisateur"
                                type="email"
                                class="admin-mgr-input"
                            />
                            <select v-model="newAdminRole" class="admin-mgr-role-select">
                                <option value="editor">Éditeur</option>
                                <option value="planning">Planning (tâches seulement)</option>
                                <option value="admin">Admin</option>
                            </select>
                            <button
                                class="admin-btn"
                                @click="addAdmin"
                                :disabled="addingAdmin"
                            >
                                {{ addingAdmin ? "Ajout..." : "Ajouter" }}
                            </button>
                        </div>
                        <p class="admin-mgr-hint">
                            Admin : accès complet, y compris la gestion des comptes. Éditeur : peut éditer le contenu du site mais pas gérer les admins. Planning : accède uniquement au tableau des tâches, sans pouvoir modifier le site.
                        </p>
                    </div>
                    <div class="admin-mgr-section">
                        <h4>Admins actuels</h4>
                        <div v-if="adminList.length === 0" class="version-empty">
                            Aucun admin
                        </div>
                        <table v-else class="admin-mgr-table">
                            <thead>
                                <tr>
                                    <th>Email</th>
                                    <th>Rôle</th>
                                    <th v-if="currentUserRole === 'admin'"></th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr
                                    v-for="u in adminList"
                                    :key="u.email"
                                    class="admin-mgr-row"
                                >
                                    <td class="admin-mgr-uid">{{ u.email }}</td>
                                    <td>
                                        <select
                                            v-if="currentUserRole === 'admin' && u.email !== user?.email?.toLowerCase()"
                                            :value="u.role"
                                            @change="changeAdminRole(u.email, $event.target.value)"
                                            class="admin-mgr-role-select"
                                            :disabled="changingRole === u.email"
                                        >
                                            <option value="editor">Éditeur</option>
                                            <option value="planning">Planning (tâches seulement)</option>
                                            <option value="admin">Admin</option>
                                        </select>
                                        <span v-else class="admin-mgr-role-badge" :class="`role-${u.role}`">{{ u.role === 'admin' ? 'Admin' : u.role === 'planning' ? 'Planning' : 'Éditeur' }}</span>
                                    </td>
                                    <td v-if="currentUserRole === 'admin'">
                                        <button
                                            class="admin-mgr-del-btn"
                                            @click="removeAdmin(u.email)"
                                            title="Retirer"
                                            :disabled="removingAdmin === u.email || u.email === user?.email?.toLowerCase()"
                                        >{{ removingAdmin === u.email ? "…" : "✕" }}</button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <div v-if="setupMode" class="admin-mgr-section">
                        <p class="admin-mgr-hint">
                            Aucun admin configuré. <button class="admin-btn" @click="setupFirstAdmin">Devenir le premier admin</button>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </Teleport>

    <!-- Contact Messages Modal -->
    <Teleport to="body">
        <div v-if="showContactMessages" class="version-modal-overlay" @click.self="showContactMessages = false">
            <div class="version-modal">
                <div class="version-modal-header">
                    <h3>Messages de contact <span v-if="contactMessages.length" class="version-count">{{ contactMessages.length }}</span></h3>
                    <button class="version-modal-close" @click="showContactMessages = false">✕</button>
                </div>
                <div class="version-modal-body">
                    <div v-if="!contactMessagesLoading && contactMessages.length > 0" class="contact-stats">
                        <div class="stat-item">
                            <span class="stat-label">Total</span>
                            <span class="stat-value">{{ contactMessages.length }}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Non lus</span>
                            <span class="stat-value">{{ unreadContactCount }}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Newsletter</span>
                            <span class="stat-value">{{ newsletterSubscriberCount }}</span>
                        </div>
                    </div>
                    <div v-if="!contactMessagesLoading && contactMessages.length > 0" class="contact-filters">
                        <button
                            class="filter-btn"
                            :class="{ active: contactMessageFilter === 'all' }"
                            @click="contactMessageFilter = 'all'"
                        >Tous ({{ inboxMessages.length }})</button>
                        <button
                            class="filter-btn"
                            :class="{ active: contactMessageFilter === 'unread' }"
                            @click="contactMessageFilter = 'unread'"
                        >Non lus ({{ unreadContactCount }})</button>
                        <button
                            class="filter-btn"
                            :class="{ active: contactMessageFilter === 'alpha' }"
                            @click="contactMessageFilter = 'alpha'"
                        >Inscrits Alpha ({{ alphaInscrits.length }})</button>
                        <button
                            v-if="alphaInscrits.length"
                            class="filter-btn"
                            @click="exporterInscritsAlpha"
                            title="Télécharger la liste des inscrits au format CSV"
                        >⬇ Export CSV</button>
                    </div>
                    <div v-if="!contactMessagesLoading && contactMessages.length > 0" class="contact-sort">
                        <label>Tri:</label>
                        <select v-model="contactMessageSort" class="sort-select">
                            <option value="date-desc">Plus récent d'abord</option>
                            <option value="date-asc">Plus ancien d'abord</option>
                            <option value="sender">Par sender (A-Z)</option>
                        </select>
                    </div>
                    <div v-if="contactMessagesLoading" class="version-loading">Chargement...</div>
                    <div v-else-if="contactMessages.length === 0" class="version-empty">Aucun message reçu</div>
                    <div v-else-if="filteredContactMessages.length === 0" class="version-empty">Aucun message correspondant au filtre</div>
                    <div v-else class="version-list">
                        <div
                            v-for="m in filteredContactMessages"
                            :key="m.id"
                            class="version-item"
                            :class="{ 'comment-resolved': m.status === 'read' }"
                        >
                            <div class="version-item-row">
                                <div class="version-info">
                                    <span class="version-date">{{ new Date(m.createdAt).toLocaleString('fr-FR') }}</span>
                                    <span class="version-author">{{ m.prenom }} {{ m.nom }} — <a :href="`mailto:${m.email}`">{{ m.email }}</a>{{ m.ville ? ' — ' + m.ville : '' }}{{ m.parcours ? ' — 📝 Inscription Alpha : ' + m.parcours : '' }}{{ m.telephone ? ' — 📞 ' + m.telephone : '' }}{{ m.adresse ? ' — 🏠 ' + m.adresse : '' }}{{ m.newsletter ? ' — 📧 Newsletter' : '' }}</span>
                                    <div class="version-meta">{{ m.message }}</div>
                                </div>
                                <div class="version-actions">
                                    <button class="admin-btn admin-btn-secondary" @click.stop="toggleContactRead(m)">
                                        {{ m.status === 'read' ? "↺ Non lu" : "✓ Lu" }}
                                    </button>
                                    <button class="version-del-btn" @click.stop="deleteContactMessage(m)" title="Supprimer définitivement ce message">
                                        {{ deletingContactId === m.id ? "…" : "🗑" }}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </Teleport>

    <!-- Comments (Developer Requests) Modal -->
    <Teleport to="body">
        <div v-if="showComments" class="version-modal-overlay" @click.self="showComments = false">
            <div class="version-modal">
                <div class="version-modal-header">
                    <h3>Demandes développeur <span v-if="allComments.length" class="version-count">{{ allComments.length }}</span></h3>
                    <button class="version-modal-close" @click="showComments = false">✕</button>
                </div>
                <div class="version-modal-body">
                    <div v-if="commentsLoading" class="version-loading">Chargement...</div>
                    <div v-else-if="allComments.length === 0" class="version-empty">Aucune demande</div>
                    <div v-else class="version-list">
                        <div
                            v-for="c in sortedComments"
                            :key="c.id"
                            class="version-item"
                            :class="{ 'comment-resolved': c.resolved }"
                        >
                            <div class="version-item-row">
                                <div class="version-info" style="cursor:pointer" @click="goToComment(c)">
                                    <span class="version-date">{{ new Date(c.createdAt).toLocaleString('fr-FR') }}</span>
                                    <span class="version-author">{{ c.pageSlug }} — {{ c.blockLabel || c.blockType }}</span>
                                    <div class="version-meta">{{ c.message }}</div>
                                </div>
                                <div class="version-actions">
                                    <button class="admin-btn admin-btn-secondary" @click.stop="toggleGlobalCommentResolved(c)">
                                        {{ c.resolved ? "↺ Rouvrir" : "✓ Résolu" }}
                                    </button>
                                    <button class="version-del-btn" @click.stop="deleteGlobalComment(c.id)" title="Supprimer">✕</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </Teleport>

    <!-- Modale Configuration -->
    <Teleport to="body" v-if="showSettings">
        <div class="settings-modal-overlay" @click.self="showSettings = false">
            <div class="settings-modal">
                <div class="settings-modal-header">
                    <h2>Configuration</h2>
                    <button class="close-btn" @click="showSettings = false">✕</button>
                </div>
                <div class="settings-modal-body">
                    <div class="settings-field">
                        <label>Emails de destination (formulaire contact)</label>
                        <textarea
                            v-model="contactEmailsText"
                            rows="2"
                            placeholder="contact@example.com, pasteur@example.com"
                            class="settings-input settings-textarea"
                        ></textarea>
                        <p class="settings-hint">Un ou plusieurs emails, séparés par une virgule ou un retour à la ligne. Chacun recevra les messages du formulaire de contact.</p>
                    </div>
                    <div class="settings-field" v-if="emailQuota">
                        <label>Quota d'envoi d'emails ({{ emailQuota.month || 'ce mois' }})</label>
                        <div class="quota-bar-wrap">
                            <div class="quota-bar">
                                <div class="quota-bar-fill" :class="quotaLevelClass" :style="{ width: quotaPercent + '%' }"></div>
                            </div>
                            <span class="quota-text">{{ emailQuota.count }}/{{ emailQuota.limit }}</span>
                        </div>
                        <p v-if="quotaPercent >= 100" class="settings-hint quota-warning">
                            Quota atteint : les nouveaux messages restent visibles dans l'admin mais aucun email ne sera envoyé jusqu'au mois prochain. Si cette limite est gênante, une formule Resend supérieure permet d'augmenter le quota.
                        </p>
                        <p v-else-if="quotaPercent >= 80" class="settings-hint quota-warning">
                            Le quota d'envoi mensuel approche de sa limite.
                        </p>
                    </div>
                    <div class="settings-field">
                        <label class="settings-checkbox-label">
                            <input
                                v-model="settingsForm.hideEventsPageIfEmpty"
                                type="checkbox"
                                class="settings-checkbox"
                            />
                            Masquer la page Événements si aucun événement à venir
                        </label>
                        <p class="settings-hint">La page et le lien de menu seront masqués du site public tant qu'aucun événement n'est prévu. Toujours visible en mode admin.</p>
                    </div>
                    <div class="settings-field">
                        <label>Ordre des onglets de l'espace membre (/membre)</label>
                        <p class="settings-hint">Ordre d'affichage des onglets Ressources/Demandes/Mes événements.</p>
                        <div class="member-tab-order-list">
                            <div
                                v-for="(t, i) in memberTabOrderForm"
                                :key="t"
                                class="member-tab-order-row"
                            >
                                <span class="member-tab-order-label">{{ MEMBER_TAB_LABELS[t] }}</span>
                                <button
                                    type="button"
                                    class="member-tab-order-btn"
                                    :disabled="i === 0"
                                    title="Monter"
                                    @click="moveMemberTab(i, -1)"
                                >↑</button>
                                <button
                                    type="button"
                                    class="member-tab-order-btn"
                                    :disabled="i === memberTabOrderForm.length - 1"
                                    title="Descendre"
                                    @click="moveMemberTab(i, 1)"
                                >↓</button>
                            </div>
                        </div>
                    </div>
                    <div class="settings-field">
                        <label>Réseaux sociaux</label>
                        <p class="settings-hint">Réglage unique pour tout le site — ces liens s'affichent dans le menu, le bloc Bienvenue et le bloc Contact.</p>
                        <div v-for="(link, i) in socialLinksForm" :key="i" class="social-link-row">
                            <select v-model="link.platform" class="settings-input social-link-platform">
                                <option v-for="p in Object.keys(SOCIAL_ICONS)" :key="p" :value="p">{{ SOCIAL_ICONS[p].label }}</option>
                            </select>
                            <input v-model="link.url" type="text" placeholder="https://..." class="settings-input social-link-url" />
                            <button type="button" class="social-link-del" @click="socialLinksForm.splice(i, 1)" aria-label="Supprimer">✕</button>
                        </div>
                        <button
                            type="button"
                            class="social-link-add"
                            @click="socialLinksForm.push({ platform: 'instagram', url: '' })"
                        >+ Ajouter un réseau</button>
                    </div>
                </div>
                <div class="settings-modal-footer">
                    <button class="btn-cancel" @click="showSettings = false">Annuler</button>
                    <button
                        class="btn-save"
                        @click="saveSettings"
                        :disabled="settingsSaving"
                    >
                        {{ settingsSaving ? 'Sauvegarde...' : 'Sauvegarder' }}
                    </button>
                </div>
            </div>
        </div>
    </Teleport>

    <AdminEventManager :open="showEventManager" @close="showEventManager = false" />

    <AdminTachesBoard
        :open="showTaches"
        :mon-email="user?.email || ''"
        :mon-role="currentUserRole || ''"
        @close="showTaches = false"
    />

</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, inject, nextTick } from "vue";
import {
    signOut,
    onAuthStateChanged,
} from "firebase/auth";
import { BLOCK_TYPES, ANIMATIONS, HARDCODED_SLUGS } from "~/utils/blockTypes.js";
import { SOCIAL_ICONS } from "~/utils/socialIcons.js";
import { useToast } from '~/composables/useToast'

const { socialLinks: liveSocialLinks, memberTabOrder: liveMemberTabOrder } = useSiteSettings()

const { showToast } = useToast()

const props = defineProps({
    pageSlug: { type: String, default: "" },
});
const emit = defineEmits(['navigate-preview'])

const router = useRouter();
const route = useRoute();

const {
    isAdminMode,
    activeBlock,
    editingFooter,
    sidebarBlock,
    sidebarSchema,
    selectBlock,
    updateBlock,
    updateVisibility,
    resetResponsive,
    moveBlock,
    removeBlock,
    duplicateBlock,
    saveTemplateBlock,
    exitAdmin,
    clearBlocks,
    localBlocks,
    previewDevice,
    undo,
    redo,
    canUndo,
    canRedo,
    nextUndoLabel,
    nextRedoLabel,
    hasUnsavedChanges,
    markSaved,
    selectFooter,
    closeFooterEditor,
    updateFooterBlock,
    saveFooterBlock,
    footerDirty,
    addBlock,
    localBlocksPage,
    contenuNonCharge,
    selectedElementId,
    positioningElementId,
    startPositioning,
} = useAdmin();

const { saveMenuToFirestore, customPages, loadCustomPages, menuChanged, openMenuEditor, menuItems } = useMenuEditor();

const HARDCODED_PAGE_OPTIONS = [
    { slug: 'accueil', label: 'Accueil' },
    { slug: 'contact', label: 'Contact' },
    { slug: 'messages', label: 'Messages' },
    { slug: 'event-list', label: 'Événements' },
    { slug: 'agenda', label: 'Agenda' },
]

// Le menu déroulant de sélection de page listait les pages système dans un
// ordre figé puis les pages perso dans l'ordre (arbitraire) de l'API — sans
// rapport avec l'ordre réel du menu de navigation du site. On reconstruit
// l'ordre en parcourant menuItems (profondeur d'abord, comme affiché dans le
// menu) ; toute page non référencée dans le menu (supprimée de la nav sans
// être supprimée elle-même) est ajoutée à la fin pour ne jamais disparaître
// du sélecteur.
const orderedPageOptions = computed(() => {
    const bySlug = new Map()
    for (const p of HARDCODED_PAGE_OPTIONS) bySlug.set(p.slug, p)
    for (const p of customPages.value) bySlug.set(p.slug, { slug: p.slug, label: p.title || p.slug })

    const ordered = []
    const seen = new Set()
    function walk(items) {
        for (const item of items || []) {
            const slug = item.pageSlug || (HARDCODED_SLUGS.includes(item.id) ? item.id : null)
            if (slug && bySlug.has(slug) && !seen.has(slug)) {
                ordered.push(bySlug.get(slug))
                seen.add(slug)
            }
            if (item.children?.length) walk(item.children)
        }
    }
    walk(menuItems.value)
    for (const p of bySlug.values()) {
        if (!seen.has(p.slug)) ordered.push(p)
    }
    return ordered
})

// Fusionner l'état des modifications (blocs + menu) pour une UX unifiée
const hasAnyUnsavedChanges = computed(() => hasUnsavedChanges.value || menuChanged.value)

// Titre « propre » de la page courante (celui affiché dans la liste
// déroulante), renvoyé au serveur à chaque sauvegarde pour réparer les
// pages dont le titre a été écrasé
const knownPageTitle = computed(() => {
    const page = customPages.value.find(p => p.slug === props.pageSlug)
    return page && page.title && page.title !== page.slug ? page.title : ''
})

const { $auth } = useNuxtApp();

// ─── Block picker ─────────────────────────────────────────────────────────────
const showBlockPicker = ref(false)
const showTemplatePicker = ref(false)
const pendingBlockType = ref(null)
const availableTemplates = ref([])
const templatesLoading = ref(false)

const pickableBlockTypes = computed(() =>
    Object.entries(BLOCK_TYPES)
        .filter(([key]) => key !== 'footer')
        .map(([key, def]) => ({ key, label: def.label || key, icon: def.icon || '📦', category: def.category || 'other' }))
)

// Load templates when opening picker
async function loadTemplates(type) {
    templatesLoading.value = true
    try {
        const res = await fetch('/api/templates/blocks')
        if (res.ok) {
            availableTemplates.value = await res.json()
        }
    } catch (e) {
        console.warn('loadTemplates error:', e)
    } finally {
        templatesLoading.value = false
    }
}

// Types with templates show a 2nd step (template chooser) before adding
async function pickBlock(type) {
    pendingBlockType.value = type
    const templates = availableTemplates.value.filter(t => t.type === type)
    if (templates.length > 0) {
        showBlockPicker.value = false
        showTemplatePicker.value = true
    } else {
        showBlockPicker.value = false
        await finalizeAddBlock(type)
    }
}

async function finalizeAddBlock(type, overrideProps) {
    const newBlock = await addBlock(type, activeBlock.value?.id, overrideProps)
    if (newBlock) selectBlock(newBlock.id)
}

async function pickTemplate(tpl) {
    showTemplatePicker.value = false
    const type = pendingBlockType.value
    pendingBlockType.value = null
    await finalizeAddBlock(type, tpl.props)
}

function backToBlockPicker() {
    showTemplatePicker.value = false
    pendingBlockType.value = null
    showBlockPicker.value = true
}

// « Rendre déplaçable » (AutoEditor.vue) promeut un champ fixe en élément
// libre : le champ a déjà du contenu (contrairement à un élément vierge
// ajouté via « + Texte »), donc pas besoin de garder la sidebar ouverte pour
// taper du texte — on lance directement le mode positionnement.
function onPromoted(id) {
    selectedElementId.value = id
    startPositioning(id)
}

// Les éléments additionnels (FieldElements.vue) réutilisent les classes
// block-anim-* et l'état "triggered" du BLOC parent (BlockExtraElementsCanvas
// n'a pas de déclenchement individuel) — sans rejeu explicite, changer
// l'animation d'un élément ne produit aucune différence visible tant que le
// bloc reste dans son état stable admin (même cause que pour le champ
// "animation" du bloc lui-même, voir AutoEditor.onChange). Déclenché
// uniquement sur le select Animation (événement 'replay' dédié), pas sur
// chaque frappe de texte — sinon le bloc rejouerait son animation à chaque
// caractère tapé dans un élément.
function onExtraElementReplay() {
    if (!sidebarBlock.value) return
    const blockId = sidebarBlock.value.id
    nextTick(() => {
        document.dispatchEvent(new CustomEvent('replay-animation', { detail: { id: blockId } }))
    })
}

function setDevice(device) {
  previewDevice.value = device
  const newQuery = { ...route.query, device }
  router.replace({ query: newQuery }).catch(() => {})
}

// ─── Responsive / per-device controls (sidebar) ───
const DEVICE_LABELS = { desktop: 'Ordinateur', tablet: 'Tablette', mobile: 'Mobile' }
const DEVICE_ICONS = { desktop: '🖥', tablet: '▭', mobile: '▯' }
function deviceLabel(d) { return DEVICE_LABELS[d] || d }
function deviceIcon(d) { return DEVICE_ICONS[d] || '•' }

function deviceVisible(d) {
  const v = sidebarBlock.value?.visibility
  return v?.[d] !== false
}

function toggleDeviceVisibility(d) {
  const block = sidebarBlock.value
  if (!block?.id) return
  updateVisibility(block.id, { [d]: deviceVisible(d) === false })
}

const otherDevices = computed(() =>
  ['desktop', 'tablet', 'mobile'].filter((d) => d !== previewDevice.value)
)

const hasDeviceOverrides = computed(() => {
  const block = activeBlock.value
  const dev = previewDevice.value
  if (!block || dev === 'desktop') return false
  const o = block.responsive?.[dev]
  return Boolean(o && Object.keys(o).length)
})

function resetCurrentDeviceOverrides() {
  const block = activeBlock.value
  if (!block?.id || previewDevice.value === 'desktop') return
  resetResponsive(block.id, previewDevice.value)
}
const user = ref(null);
const saving = ref(false);
const saveStatus = ref("");

// Admin access control
const isAdminUser = ref(false);
const checkingAdmin = ref(true);

let unsubscribe = null;
let autoSaveTimer = null;

// ─── Developer comments (per-block note) ───
const pageComments = ref([]) // toutes les demandes de la page courante (chargées à la demande)
const commentDraft = ref('')
const savingComment = ref(false)
// Même ref réactive que layouts/default.vue provide/injecte pour le badge
// 💬 sur les blocs (PageRenderer.vue) — la mettre à jour ici évite d'attendre
// un changement de page pour que le badge reflète une création/résolution
// tout juste faite dans cette même session d'édition.
const commentBlockIds = inject('commentBlockIds', ref([]))

const activeComment = computed(() =>
    pageComments.value.find(c => c.blockId === sidebarBlock.value?.id && !c.resolved) ||
    pageComments.value.find(c => c.blockId === sidebarBlock.value?.id) || null
)

// On observe l'ID du bloc, PAS l'objet `sidebarBlock` : ce computed change
// d'identité à CHAQUE mutation de props du bloc courant (une frappe dans
// n'importe quel champ de la sidebar, un changement de hauteur…). Sur l'objet,
// le watcher repartait donc à zéro sans arrêt, rechargeait /api/comments à
// chaque frappe, et surtout écrasait `commentDraft` avec la réponse — la note
// développeur en cours de saisie disparaissait toute seule dès que le fetch
// arrivait après le début de la frappe. Symptôme observé : bouton « Créer la
// demande » resté désactivé alors que le texte était bien visible à l'écran.
watch(() => sidebarBlock.value?.id ?? null, async (blockId) => {
    commentDraft.value = ''
    if (!blockId) return
    await loadPageComments()
    // La réponse peut arriver après un changement de bloc, ou après que
    // l'utilisateur a commencé à écrire : dans les deux cas, ne rien écraser.
    if (sidebarBlock.value?.id !== blockId) return
    if (commentDraft.value) return
    commentDraft.value = activeComment.value?.message || ''
})

async function loadPageComments() {
    try {
        const token = await getFirebaseToken()
        const res = await fetch('/api/comments', { headers: { Authorization: `Bearer ${token}` } })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        pageComments.value = (data.comments || []).filter(c => c.pageSlug === props.pageSlug)
        commentBlockIds.value = pageComments.value.filter(c => !c.resolved).map(c => c.blockId)
    } catch (e) {
        console.error('[admin] load comments failed:', e)
    }
}

async function saveComment() {
    const block = sidebarBlock.value
    if (!block || !commentDraft.value.trim()) return
    savingComment.value = true
    try {
        const token = await getFirebaseToken()
        if (activeComment.value) {
            const res = await fetch(`/api/comments/${activeComment.value.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ resolved: activeComment.value.resolved, message: commentDraft.value.trim() }),
            })
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
        } else {
            const res = await fetch('/api/comments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    pageSlug: props.pageSlug,
                    blockId: block.id,
                    blockType: block.type,
                    blockLabel: getBlockLabel(block.type),
                    message: commentDraft.value.trim(),
                }),
            })
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
        }
        await loadPageComments()
        showToast('Note enregistrée', 'toast-success')
    } catch (e) {
        showToast('Erreur : ' + (e.message || e), 'toast-error')
    } finally {
        savingComment.value = false
    }
}

async function toggleCommentResolved(resolved) {
    if (!activeComment.value) return
    try {
        const token = await getFirebaseToken()
        const res = await fetch(`/api/comments/${activeComment.value.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ resolved }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        await loadPageComments()
    } catch (e) {
        showToast('Erreur : ' + (e.message || e), 'toast-error')
    }
}

async function deleteActiveComment() {
    if (!activeComment.value || !confirm('Supprimer cette demande ?')) return
    try {
        const token = await getFirebaseToken()
        const res = await fetch(`/api/comments/${activeComment.value.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        commentDraft.value = ''
        await loadPageComments()
    } catch (e) {
        showToast('Erreur : ' + (e.message || e), 'toast-error')
    }
}

// Liste centralisée des demandes (modale "💬 Demandes"), toutes pages confondues
const showComments = ref(false)
const allComments = ref([])
const commentsLoading = ref(false)

const unresolvedCommentCount = computed(() => allComments.value.filter(c => !c.resolved).length)
const sortedComments = computed(() =>
    [...allComments.value].sort((a, b) => {
        if (a.resolved !== b.resolved) return a.resolved ? 1 : -1
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
)

watch(showComments, (show) => { if (show) loadAllComments() })

async function loadAllComments() {
    commentsLoading.value = true
    try {
        const token = await getFirebaseToken()
        const res = await fetch('/api/comments', { headers: { Authorization: `Bearer ${token}` } })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        allComments.value = data.comments || []
    } catch (e) {
        console.error('[admin] load comments failed:', e)
        allComments.value = []
    } finally {
        commentsLoading.value = false
    }
}

async function toggleGlobalCommentResolved(c) {
    try {
        const token = await getFirebaseToken()
        const res = await fetch(`/api/comments/${c.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ resolved: !c.resolved }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        await loadAllComments()
        if (c.pageSlug === props.pageSlug) await loadPageComments()
    } catch (e) {
        showToast('Erreur : ' + (e.message || e), 'toast-error')
    }
}

async function deleteGlobalComment(id) {
    if (!confirm('Supprimer cette demande ?')) return
    try {
        const token = await getFirebaseToken()
        const res = await fetch(`/api/comments/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        allComments.value = allComments.value.filter(x => x.id !== id)
        await loadPageComments()
    } catch (e) {
        showToast('Erreur : ' + (e.message || e), 'toast-error')
    }
}

function goToComment(c) {
    showComments.value = false
    navigateToPage(c.pageSlug, c.blockId)
}

// Charge le compte de demandes non résolues dès l'auth admin confirmée,
// pour que le badge sur "💬 Demandes" soit visible sans ouvrir la modale.
watch(isAdminUser, (val) => { if (val) loadAllComments() }, { immediate: true })

// Le rôle n'était chargé qu'à l'ouverture de la modale « Admins » : tant
// qu'on ne l'avait pas ouverte, currentUserRole valait null et tout ce qui en
// dépend restait masqué — dont le bouton de suppression et le sélecteur
// d'attribution du tableau des tâches. On le résout dès l'authentification.
watch(isAdminUser, (val) => { if (val) loadAdminList() }, { immediate: true })

// ─── Messages de contact (lecture seule, pas de réponse depuis l'admin) ───
const showContactMessages = ref(false)
const contactMessages = ref([])
const contactMessagesLoading = ref(false)
const contactMessageFilter = ref('all') // 'all' | 'unread' | 'alpha'
const contactMessageSort = ref('date-desc') // 'date-desc', 'date-asc', 'sender'

// L'archivage a été remplacé par une suppression définitive : il n'ajoutait
// qu'un troisième état à côté de lu/non-lu tout en conservant indéfiniment
// des données personnelles simplement masquées. Les messages restés au
// statut 'archived' d'avant ce changement sont réaffichés normalement —
// sans quoi ils seraient devenus invisibles pour toujours, l'onglet qui
// les montrait n'existant plus.
const inboxMessages = computed(() => contactMessages.value)
const unreadContactCount = computed(() =>
  inboxMessages.value.filter(m => m.status !== 'read').length
)
const alphaInscrits = computed(() => contactMessages.value.filter(m => m.parcours))

// Export CSV des inscrits Alpha (séparateur « ; » et BOM : s'ouvre
// correctement dans Excel en français). Les cellules commençant par = + - @
// sont préfixées d'une apostrophe, sinon Excel les exécute comme formule.
function exporterInscritsAlpha() {
  const cellule = (v) => {
    let t = String(v ?? '').replace(/\r?\n/g, ' ')
    if (/^[=+\-@]/.test(t)) t = "'" + t
    return `"${t.replace(/"/g, '""')}"`
  }
  const lignes = [['Date', 'Parcours', 'Prénom', 'Nom', 'E-mail', 'Téléphone', 'Adresse', 'Message']]
  for (const m of [...alphaInscrits.value].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))) {
    lignes.push([new Date(m.createdAt).toLocaleString('fr-FR'), m.parcours, m.prenom, m.nom, m.email, m.telephone, m.adresse, m.message])
  }
  const csv = '\ufeff' + lignes.map(l => l.map(cellule).join(';')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `inscrits-alpha-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

const newsletterSubscriberCount = computed(() => contactMessages.value.filter(m => m.newsletter === true).length)

const filteredContactMessages = computed(() => {
  let filtered = inboxMessages.value

  if (contactMessageFilter.value === 'alpha') {
    filtered = filtered.filter(m => m.parcours)
  }
  if (contactMessageFilter.value === 'unread') {
    filtered = filtered.filter(m => m.status !== 'read')
  }

  // Tri
  const sorted = [...filtered]
  if (contactMessageSort.value === 'date-desc') {
    sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  } else if (contactMessageSort.value === 'date-asc') {
    sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  } else if (contactMessageSort.value === 'sender') {
    sorted.sort((a, b) => `${a.prenom} ${a.nom}`.localeCompare(`${b.prenom} ${b.nom}`))
  }

  return sorted
})

watch(isAdminUser, (val) => { if (val) loadContactMessages() }, { immediate: true })
watch(showContactMessages, (show) => { if (show) loadContactMessages() })

async function loadContactMessages() {
    contactMessagesLoading.value = true
    try {
        const token = await getFirebaseToken()
        const res = await fetch('/api/contacts', { headers: { Authorization: `Bearer ${token}` } })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        contactMessages.value = (data.contacts || []).sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
    } catch (e) {
        console.error('[admin] load contact messages failed:', e)
        contactMessages.value = []
    } finally {
        contactMessagesLoading.value = false
    }
}

function openContactMessages() {
    showContactMessages.value = true
    loadContactMessages()
}

async function toggleContactRead(message) {
    try {
        const token = await getFirebaseToken()
        const newStatus = message.status === 'read' ? 'new' : 'read'
        const res = await fetch(`/api/contacts/${message.id}`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        message.status = newStatus
    } catch (e) {
        console.error('[admin] toggle read failed:', e)
        showToast('Erreur lors de la mise à jour', 'toast-error')
    }
}

// Suppression définitive (l'archivage n'existe plus) : la confirmation est
// indispensable, un message de contact effacé n'est récupérable nulle part.
const deletingContactId = ref(null)

async function deleteContactMessage(message) {
    const qui = `${message.prenom} ${message.nom}`.trim() || message.email
    if (!confirm(`Supprimer définitivement le message de ${qui} ?\n\nCette action est irréversible.`)) return

    deletingContactId.value = message.id
    try {
        const token = await getFirebaseToken()
        const res = await fetch(`/api/contacts/${message.id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        contactMessages.value = contactMessages.value.filter(m => m.id !== message.id)
        showToast('Message supprimé', 'toast-success')
    } catch (e) {
        console.error('[admin] delete contact failed:', e)
        showToast('Erreur lors de la suppression', 'toast-error')
    } finally {
        deletingContactId.value = null
    }
}

// Settings
const showSettings = ref(false)
const settingsForm = ref({ hideEventsPageIfEmpty: false })
const contactEmailsText = ref('')
const socialLinksForm = ref([])
const emailQuota = ref(null)
const settingsSaving = ref(false)

const MEMBER_TAB_LABELS = { ressources: '📚 Ressources', demandes: '🙋 Demandes', evenements: '📅 Mes événements' }
const memberTabOrderForm = ref(['ressources', 'demandes', 'evenements'])
function moveMemberTab(i, dir) {
    const j = i + dir
    if (j < 0 || j >= memberTabOrderForm.value.length) return
    const arr = [...memberTabOrderForm.value]
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
    memberTabOrderForm.value = arr
}

const quotaPercent = computed(() => {
  if (!emailQuota.value || !emailQuota.value.limit) return 0
  return Math.min(100, Math.round((emailQuota.value.count / emailQuota.value.limit) * 100))
})
const quotaLevelClass = computed(() => {
  if (quotaPercent.value >= 100) return 'quota-critical'
  if (quotaPercent.value >= 80) return 'quota-warning-level'
  return 'quota-ok'
})

watch(showSettings, async (show) => {
  if (show) {
    await loadSettings()
    await loadEmailQuota()
  }
})

async function loadSettings() {
  try {
    // Token obligatoire : /api/settings est public (les vitrines y lisent
    // socialLinks/memberTabOrder sans authentification) et ne joint
    // `contactEmails` qu'à un appelant admin. Sans en-tête, la modale
    // afficherait un champ « Emails de destination » vide et la sauvegarde
    // repartirait en 400.
    const token = await getFirebaseToken()
    const res = await fetch('/api/settings', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    settingsForm.value = { hideEventsPageIfEmpty: data.hideEventsPageIfEmpty === true }
    contactEmailsText.value = (data.contactEmails || []).join(', ')
    socialLinksForm.value = Array.isArray(data.socialLinks) ? data.socialLinks.map(l => ({ ...l })) : []
    memberTabOrderForm.value = Array.isArray(data.memberTabOrder) && data.memberTabOrder.length === 3
      ? [...data.memberTabOrder]
      : ['ressources', 'demandes', 'evenements']
  } catch (e) {
    console.error('[admin] load settings failed:', e)
    showToast('Erreur : ' + (e.message || e), 'toast-error')
  }
}

async function loadEmailQuota() {
  try {
    const token = await getFirebaseToken()
    const res = await fetch('/api/settings/email-quota', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    emailQuota.value = await res.json()
  } catch (e) {
    console.error('[admin] load email quota failed:', e)
    emailQuota.value = null
  }
}

async function saveSettings() {
  const contactEmails = contactEmailsText.value
    .split(/[,\n]/)
    .map(e => e.trim())
    .filter(Boolean)
  if (contactEmails.length === 0) {
    showToast('Au moins un email est requis', 'toast-error')
    return
  }
  settingsSaving.value = true
  try {
    const token = await getFirebaseToken()
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...settingsForm.value, contactEmails, socialLinks: socialLinksForm.value, memberTabOrder: memberTabOrderForm.value }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      throw new Error(body?.message || `HTTP ${res.status}`)
    }
    // Reflète immédiatement le changement dans SiteHeader/BlockContact/
    // BlockBienvenue (state partagé useSiteSettings.js) sans recharger la page.
    liveSocialLinks.value = socialLinksForm.value.map(l => ({ ...l }))
    liveMemberTabOrder.value = [...memberTabOrderForm.value]
    showToast('Configuration sauvegardée', 'toast-success')
    showSettings.value = false
  } catch (e) {
    console.error('[admin] save settings failed:', e)
    showToast('Erreur : ' + (e.message || e), 'toast-error')
  } finally {
    settingsSaving.value = false
  }
}

// Version history
const showVersionHistory = ref(false);
const versions = ref([]);
const versionsLoading = ref(false);
const restoring = ref(null);
const expandedVersion = ref(null);
const deletingVersion = ref(null);
const previewingVersion = ref(null);
const previewOriginalBlocks = ref(null);
const filterByBlock = ref(null);

function toggleVersionExpand(id) {
    expandedVersion.value = expandedVersion.value === id ? null : id
}

async function deleteVersion(versionId) {
    if (!confirm('Supprimer cette version ?')) return
    deletingVersion.value = versionId
    try {
        const token = await getFirebaseToken()
        const res = await fetch(`/api/pages/${props.pageSlug}/versions/${versionId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        versions.value = versions.value.filter(v => v.id !== versionId)
        if (expandedVersion.value === versionId) expandedVersion.value = null
    } catch (e) {
        console.error('[admin] deleteVersion failed:', e)
        showToast("Erreur : " + (e.message || e), 'toast-error')
    } finally {
        deletingVersion.value = null
    }
}

watch(showVersionHistory, (show) => {
    if (show) loadVersions()
})

async function loadVersions() {
    versionsLoading.value = true
    try {
        const token = await getFirebaseToken()
        const res = await fetch(`/api/pages/${props.pageSlug}/versions`, {
            headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) {
            const body = await res.json().catch(() => null)
            throw new Error(body?.message || `HTTP ${res.status}`)
        }
        const data = await res.json()
        versions.value = data.versions || []
    } catch (e) {
        console.error('[admin] load versions failed:', e)
        versions.value = []
        // Distingue "0 version" (état normal) d'une erreur de chargement —
        // sans ça l'admin voit juste "Aucune version" et pense que la
        // fonctionnalité n'existe pas alors qu'il y a une vraie erreur.
        showToast('Impossible de charger l\'historique : ' + (e.message || e), 'toast-error')
    } finally {
        versionsLoading.value = false
    }
}

async function restoreVersion(versionId) {
    restoring.value = versionId
    try {
        const token = await getFirebaseToken()
        const res = await fetch(`/api/pages/${props.pageSlug}/versions/${versionId}`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            throw new Error(err.message || `HTTP ${res.status}`)
        }
        const data = await res.json()
        if (data.blocks) {
            localBlocks.value = data.blocks
        }
        showVersionHistory.value = false
        saveStatus.value = "Version restaurée"
        setTimeout(() => { saveStatus.value = "" }, 3000)
    } catch (e) {
        console.error('[admin] restore failed:', e)
        showToast("Erreur lors de la restauration : " + (e.message || e), 'toast-error')
    } finally {
        restoring.value = null
    }
}

async function previewVersion(versionId) {
    try {
        const token = await getFirebaseToken()
        const res = await fetch(`/api/pages/${props.pageSlug}/versions/${versionId}`, {
            headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            throw new Error(err.message || `HTTP ${res.status}`)
        }
        const data = await res.json()
        if (data.blocks) {
            previewOriginalBlocks.value = JSON.parse(JSON.stringify(localBlocks.value))
            localBlocks.value = data.blocks
            previewingVersion.value = versionId
        }
    } catch (e) {
        console.error('[admin] preview failed:', e)
        showToast("Erreur lors du preview : " + (e.message || e), 'toast-error')
    }
}

function cancelPreview() {
    if (previewOriginalBlocks.value) {
        localBlocks.value = previewOriginalBlocks.value
    }
    previewingVersion.value = null
    previewOriginalBlocks.value = null
}

function getBlockTypesLabel(typeCounts) {
    if (!typeCounts) return ''
    return Object.entries(typeCounts).map(([type, count]) => {
        const label = BLOCK_TYPES[type]?.label || type
        return count > 1 ? `${label} ×${count}` : label
    }).join(', ')
}

function formatDate(dateStr) {
    if (!dateStr) return "Date inconnue"
    try {
        return new Date(dateStr).toLocaleString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        })
    } catch {
        return dateStr
    }
}

// Filtre par bloc pour les versions
const blockOptions = computed(() => {
    const blocks = localBlocks.value || []
    return blocks.map(b => ({
        id: b.id,
        label: `${BLOCK_TYPES[b.type]?.label || b.type}${b.id ? ` #${b.id}` : ''}`,
    }))
})

const filteredVersions = computed(() => {
    if (!filterByBlock.value) return versions.value
    const selectedBlockId = filterByBlock.value
    return versions.value.filter(v => {
        if (!v.changes?.details) return false
        const allItems = [
            ...(v.changes.details.added || []),
            ...(v.changes.details.removed || []),
            ...(v.changes.details.modified || []),
        ]
        return allItems.some(item => item.id === selectedBlockId)
    })
})

// Admin management
const showAdminManager = ref(false);
const showEventManager = ref(false);
const showTaches = ref(false);
const adminList = ref([]); // [{ email, role }]
const newAdminEmail = ref('');
const newAdminRole = ref('editor');
const addingAdmin = ref(false);
const removingAdmin = ref(null);
const changingRole = ref(null);
const setupMode = ref(false);
const currentUserRole = ref(null);

watch(showAdminManager, (show) => {
    if (show) loadAdminList()
})

async function loadAdminList() {
    const token = await getFirebaseToken()
    if (!token) return
    try {
        const res = await fetch('/api/admin/users', {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        if (res.ok) {
            const data = await res.json()
            adminList.value = data.users || []
            setupMode.value = false
            const mine = adminList.value.find(u => u.email === user.value?.email?.toLowerCase())
            currentUserRole.value = mine?.role || null
        } else if (res.status === 404) {
            setupMode.value = true
            adminList.value = []
        } else {
            adminList.value = []
            setupMode.value = true
        }
    } catch {
        adminList.value = []
        setupMode.value = true
    }
}

async function addAdmin() {
    if (!newAdminEmail.value.trim()) return
    addingAdmin.value = true
    try {
        const token = await getFirebaseToken()
        if (!token) throw new Error('Non authentifié')
        const res = await fetch('/api/admin/users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ email: newAdminEmail.value.trim(), role: newAdminRole.value }),
        })
        if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            throw new Error(err.message || `HTTP ${res.status}`)
        }
        const data = await res.json()
        adminList.value = data.users || []
        newAdminEmail.value = ''
        newAdminRole.value = 'editor'
    } catch (e) {
        console.error('[admin] addAdmin failed:', e)
        showToast("Erreur : " + (e.message || e), 'toast-error')
    } finally {
        addingAdmin.value = false
    }
}

async function changeAdminRole(email, role) {
    changingRole.value = email
    try {
        const token = await getFirebaseToken()
        if (!token) throw new Error('Non authentifié')
        const res = await fetch('/api/admin/users', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ email, role }),
        })
        if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            throw new Error(err.message || `HTTP ${res.status}`)
        }
        const data = await res.json()
        adminList.value = data.users || []
        showToast('Rôle mis à jour', 'toast-success')
    } catch (e) {
        console.error('[admin] changeAdminRole failed:', e)
        showToast("Erreur : " + (e.message || e), 'toast-error')
        await loadAdminList()
    } finally {
        changingRole.value = null
    }
}

async function removeAdmin(email) {
    removingAdmin.value = email
    try {
        const token = await getFirebaseToken()
        if (!token) throw new Error('Non authentifié')
        const res = await fetch('/api/admin/users', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ email }),
        })
        if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            throw new Error(err.message || `HTTP ${res.status}`)
        }
        const data = await res.json()
        adminList.value = data.users || []
    } catch (e) {
        console.error('[admin] removeAdmin failed:', e)
        showToast("Erreur : " + (e.message || e), 'toast-error')
    } finally {
        removingAdmin.value = null
    }
}

async function setupFirstAdmin() {
    try {
        const token = await getFirebaseToken()
        if (!token) throw new Error('Non authentifié')
        const res = await fetch('/api/admin/setup', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
        })
        if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            throw new Error(err.message || `HTTP ${res.status}`)
        }
        showAdminManager.value = false
        // Re-check admin status
        isAdminUser.value = true
        currentUserRole.value = 'admin'
        showToast("Vous êtes maintenant administrateur !", 'toast-success')
    } catch (e) {
        console.error('[admin] setupFirstAdmin failed:', e)
        showToast("Erreur : " + (e.message || e), 'toast-error')
    }
}

onMounted(() => {
    unsubscribe = onAuthStateChanged($auth, async (u) => {
        user.value = u;
        if (!u) {
            isAdminUser.value = false;
            checkingAdmin.value = false;
            if (route.path !== '/admin') {
                navigateTo(`/admin?redirect=${encodeURIComponent(route.fullPath)}`, { replace: true })
            }
            return
        }
        // En mode test, on saute la vérification admin
        const config = useRuntimeConfig()
        if (config.public?.TEST_ENV) {
            isAdminUser.value = true
            checkingAdmin.value = false
            return
        }
        // Vérifier si l'utilisateur est admin
        try {
            const token = await u.getIdToken()
            const res = await fetch('/api/admin/check', {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            const data = await res.json()
            isAdminUser.value = data.isAdmin === true
        } catch {
            isAdminUser.value = false
        }
        checkingAdmin.value = false

        if (!isAdminUser.value) {
            window.location.href = '/admin'
        }
    });

    document.addEventListener("keydown", onUndoRedoShortcut);

    if (!customPages.value.length) loadCustomPages();
});

// Raccourcis annuler/rétablir. Déclaré au niveau du composant et non dans
// onMounted : la version locale n'était joignable par aucun nettoyage, et
// AdminToolbar est monté sous `v-if` (layouts/default.vue) — il se démonte en
// quittant le mode admin et à chaque passage en aperçu responsive. Chaque
// cycle laissait donc un listener de plus sur `document`, tous branchés sur le
// même singleton useAdmin() : un Ctrl+Z sur le site public annulait des blocs
// en silence, et en admin il en annulait autant que de montages précédents.
// (cf. CLAUDE.md : tout listener doit être désabonné.)
function onUndoRedoShortcut(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        redo();
    }
}

onUnmounted(() => {
    if (unsubscribe) unsubscribe();
    clearTimeout(autoSaveTimer);
    document.removeEventListener("keydown", onUndoRedoShortcut);
});

const undoTooltip = computed(() => {
    const label = nextUndoLabel();
    return label ? `Annuler : ${label} (Ctrl+Z)` : `Annuler (Ctrl+Z)`;
});

const redoTooltip = computed(() => {
    const label = nextRedoLabel();
    return label ? `Rétablir : ${label} (Ctrl+Shift+Z)` : `Rétablir (Ctrl+Shift+Z)`;
});

// Auto-save Firestore with debounce
watch(
    localBlocks,
    () => {
        if (!user.value || !import.meta.client) return;
        // Show unsaved indicator immediately
        saveStatus.value = "";
        clearTimeout(autoSaveTimer);
        autoSaveTimer = setTimeout(() => {
            autoSave();
        }, 3000);
    },
    { deep: true },
);

async function getFirebaseToken() {
    try {
        return await user.value?.getIdToken()
    } catch {
        return null
    }
}

async function saveToServer() {
    // Garde-fou anti-corruption : localBlocks (composable partagé, mis à jour de façon
    // asynchrone par la page qui vient de charger) peut rester momentanément sur
    // l'ancienne page pendant que props.pageSlug (piloté par la route, synchrone) a déjà
    // changé — ex. sauvegarde différée (3s) qui se déclenche après une navigation.
    // Sans ce contrôle, on écrirait le contenu de l'ancienne page sur le slug de la
    // nouvelle (constaté en prod : accueil écrasé par le contenu de messages).
    if (localBlocksPage.value !== props.pageSlug) {
        console.warn(`[admin] Sauvegarde annulée : localBlocksPage="${localBlocksPage.value}" ne correspond pas à props.pageSlug="${props.pageSlug}"`)
        throw new Error('page-mismatch')
    }
    // Second garde-fou de la même famille : ne jamais écrire un contenu qu'on
    // n'a pas réussi à LIRE. Quand GET /api/pages/:slug échoue, la page se
    // rabat sur ses defaults — bon comportement pour l'affichage public, mais
    // en admin ces defaults deviennent le contenu de travail et l'auto-save
    // (3 s après la moindre modification) les écrivait par-dessus la vraie
    // page. Une lecture ratée suivie d'une écriture réussie suffit à remplacer
    // le contenu réel par le modèle. Les modifications restent dans
    // localBlocks et marquées « non sauvegardées » : rien n'est perdu, seule
    // l'écriture est refusée.
    if (contenuNonCharge.value) {
        console.warn('[admin] Sauvegarde refusée : contenu non chargé depuis le serveur, écrire écraserait la vraie page par les valeurs par défaut.')
        throw new Error('contenu-non-charge')
    }
    const token = await getFirebaseToken()
    if (!token) throw new Error('Non authentifié')
    try {
        const res = await fetch(`/api/pages/${props.pageSlug}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                blocks: localBlocks.value,
                // Renvoie le titre connu pour réparer les pages dont le titre
                // a été écrasé par d'anciennes sauvegardes
                title: knownPageTitle.value || undefined,
            }),
        })
        if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            throw new Error(err.message || `HTTP ${res.status}`)
        }
        return true
    } catch (e) {
        console.error('[admin] save failed:', e)
        throw e
    }
}

async function autoSave() {
    if (!user.value) return;
    try {
        await saveToServer()
        // Même logique que saveChanges() : le footer modifié doit partir
        // avec l'auto-save, sinon ses modifs sont perdues à la fermeture.
        if (footerDirty.value) {
            await saveFooterBlock();
        }
        markSaved();
        saveStatus.value = "Auto-sauvegardé";
        setTimeout(() => {
            saveStatus.value = "";
        }, 2000);
    } catch (e) {
        // Changement de page pendant le délai de sauvegarde différée : ce n'est pas une
        // vraie erreur, juste un skip volontaire. La page nouvellement affichée relancera
        // son propre cycle d'auto-save si besoin. Pas de markSaved() : les changements
        // restent "non sauvegardés" pour l'ancienne page tant qu'on ne l'a pas revisitée.
        if (e.message === 'page-mismatch') return;
        // Contenu jamais chargé : l'auto-save doit se taire durablement, mais
        // l'admin doit comprendre pourquoi rien ne se sauvegarde — sinon il
        // continue d'éditer en croyant que ça part.
        if (e.message === 'contenu-non-charge') {
            saveStatus.value = "Non sauvegardé : contenu non chargé";
            return;
        }
        saveStatus.value = "Erreur auto-save";
        setTimeout(() => {
            saveStatus.value = "";
        }, 3000);
    }
}

function getBlockLabel(type) {
    if (!type) return "";
    return BLOCK_TYPES[type]?.label || type;
}

function getBlockSchema(type) {
    if (!type) return [];
    return BLOCK_TYPES[type]?.schema || [];
}

const hasImageFields = computed(() => {
    if (!sidebarBlock.value) return false;
    const schema = sidebarSchema.value;
    return schema.some((f) => f.type === "image" || f.type === "images");
});

// Image upload state
const adminFileInput = ref(null);
const uploadedImages = ref([]);
const showAdminImagesList = ref(false);
const imagesLoading = ref(false);

function onAutoUpdate(block) {
    if (editingFooter.value) {
        updateFooterBlock(block.props);
    } else {
        updateBlock(block.id, block.props);
    }
}

async function onAdminFileSelected(e) {
    const file = e.target.files && e.target.files[0];
    if (!file || !import.meta.client) return;
    imagesLoading.value = true;
    try {
        const {
            getStorage,
            ref: storageRef,
            uploadBytes,
            getDownloadURL,
        } = await import("firebase/storage");
        const storage = getStorage();
        const path = `uploads/${Date.now()}_${file.name}`;
        const r = storageRef(storage, path);
        await uploadBytes(r, file);
        const url = await getDownloadURL(r);
        if (sidebarBlock.value) {
            const key = fieldKeysWithImages.value[0];
            if (!key) return;
            if (fieldKeysImagesArray.value.includes(key)) {
                const existing = sidebarBlock.value.props?.[key] ?? [];
                const newArray = Array.isArray(existing) ? [...existing, url] : [url];
                if (editingFooter.value) {
                    updateFooterBlock({ [key]: newArray });
                } else {
                    updateBlock(sidebarBlock.value.id, { [key]: newArray });
                }
            } else {
                if (editingFooter.value) {
                    updateFooterBlock({ [key]: url });
                } else {
                    updateBlock(sidebarBlock.value.id, { [key]: url });
                }
            }
        }
        await loadAdminUploadedImages();
    } catch (err) {
        console.error("Upload error", err);
        showToast("Erreur lors du téléversement : " + (err.message || err), 'toast-error');
    } finally {
        imagesLoading.value = false;
    }
}

const fieldKeysWithImages = computed(() => {
    if (!sidebarBlock.value) return [];
    const schema = sidebarSchema.value;
    return schema.filter((f) => f.type === "image" || f.type === "images").map((f) => f.key);
});

const fieldKeysImagesArray = computed(() => {
    if (!sidebarBlock.value) return [];
    const schema = sidebarSchema.value;
    return schema.filter((f) => f.type === "images").map((f) => f.key);
});

async function loadAdminUploadedImages() {
    if (!import.meta.client) return;
    imagesLoading.value = true;
    try {
        const {
            getStorage,
            ref: storageRef,
            listAll,
            getDownloadURL,
        } = await import("firebase/storage");
        const storage = getStorage();
        const listRef = storageRef(storage, "uploads");
        const res = await listAll(listRef);
        const urls = await Promise.all(res.items.map((i) => getDownloadURL(i)));
        uploadedImages.value = urls;
    } catch (err) {
        console.error("Error loading images", err);
        uploadedImages.value = [];
    } finally {
        imagesLoading.value = false;
    }
}

function toggleAdminImagesList() {
    showAdminImagesList.value = !showAdminImagesList.value;
    if (showAdminImagesList.value) loadAdminUploadedImages();
}

function selectAdminUploaded(url) {
    if (!sidebarBlock.value) return;
    const key = fieldKeysWithImages.value[0];
    if (!key) return;
    if (fieldKeysImagesArray.value.includes(key)) {
        const existing = sidebarBlock.value.props?.[key] ?? [];
        const newArray = Array.isArray(existing) ? [...existing, url] : [url];
        if (editingFooter.value) {
            updateFooterBlock({ [key]: newArray });
        } else {
            updateBlock(sidebarBlock.value.id, { [key]: newArray });
        }
    } else {
        if (editingFooter.value) {
            updateFooterBlock({ [key]: url });
        } else {
            updateBlock(sidebarBlock.value.id, { [key]: url });
        }
    }
    showAdminImagesList.value = false;
}

function closeSidebar() {
    if (editingFooter.value) {
        closeFooterEditor();
    } else {
        selectBlock(null);
    }
}

async function saveFooterChanges() {
    try {
        await saveFooterBlock();
        markSaved();
        showToast("Footer sauvegardé !", 'toast-success');
    } catch (e) {
        showToast("Erreur lors de la sauvegarde du footer : " + e.message, 'toast-error');
    }
}

async function openTemplateModal() {
    if (!sidebarBlock.value) return
    const name = prompt("Nom du template :", "Template " + (sidebarBlock.value?.type || "inconnu"))
    if (!name) return
    
    // Ask if user wants to share with other admins
    const share = confirm("Partager ce template avec les autres admins ?")
    
    try {
        await saveTemplateBlock(name, share)
        showToast(`Template sauvé${share ? ' et partagé' : ''} !`, 'toast-success')
    } catch (e) {
        showToast("Erreur : " + e.message, 'toast-error')
    }
}


async function navigateToPage(slug, focusBlockId) {
    // Sauter vers un bloc précis (depuis la modale Demandes) : portée v1
    // limitée au desktop — la préview tablette/mobile passe par un iframe,
    // relayer focusBlock jusque dans son contexte est une extension possible
    // mais pas nécessaire pour ce premier jet. On bascule en desktop d'abord.
    if (focusBlockId && previewDevice.value !== "desktop") {
        previewDevice.value = "desktop"
    }
    if (previewDevice.value !== "desktop") {
        emit('navigate-preview', slug)
        return
    }
    // Desktop mode: client-side navigation
    const newQuery = { ...route.query, admin: "true" };
    delete newQuery.device;
    if (focusBlockId) newQuery.focusBlock = focusBlockId
    else delete newQuery.focusBlock
    try {
        await router.push({ path: slug === "accueil" ? "/" : `/${slug}`, query: newQuery });
        if (!focusBlockId) { try { window.scrollTo(0, 0) } catch (e) { console.warn(e) } }
    } catch (err) {
        console.error("navigateToPage: router.push failed", err);
    }
}

// Ce bouton n'apparaît que dans le cas limite où la toolbar est montée
// (isAdminMode actif) sans session Firebase (ex: session expirée pendant la
// navigation) — redirige vers la page de connexion dédiée (email + mot de
// passe) plutôt que de dupliquer un troisième formulaire de connexion ici.
function goToAdminLogin() {
    const current = window.location.pathname + window.location.search;
    window.location.href = `/admin?redirect=${encodeURIComponent(current)}`;
}

async function signOutAndExit() {
    try {
        await signOut($auth);
    } catch (e) {
        console.error("Sign out error:", e);
    }
    exitAdmin();
}

async function saveChanges() {
    if (!user.value) {
        showToast("Connectez-vous pour sauvegarder.", 'toast-error');
        return;
    }
    saving.value = true;
    try {
        await saveToServer();
        // Sauvegarde aussi le menu s'il a changé (fusion UX: une seule sauvegarde)
        if (menuChanged.value) {
            await saveMenuToFirestore();
        }
        // Idem pour le footer : il vit hors localBlocks (settings/footer) et
        // n'est PAS couvert par saveToServer — sans ça, modifier le footer
        // puis cliquer « Sauvegarder » perdait silencieusement les modifs
        // (il fallait deviner le bouton dédié en bas de la sidebar footer).
        // Uniquement s'il a été réellement modifié (footerDirty) : ne jamais
        // écrire un footer resté sur ses defaults (voir CLAUDE.md).
        if (footerDirty.value) {
            await saveFooterBlock();
        }
        markSaved();
        saveStatus.value = "Sauvegardé";
        setTimeout(() => {
            saveStatus.value = "";
        }, 2000);
    } catch (e) {
        console.error("Save error:", e);
        if (e.message === 'page-mismatch') {
            showToast("Page changée pendant la sauvegarde — réessaie depuis la page actuelle.", 'toast-error');
        } else if (e.message === 'contenu-non-charge') {
            showToast("Sauvegarde refusée : le contenu de cette page n'a pas pu être chargé, l'enregistrer écraserait la vraie page par le modèle par défaut. Recharge la page.", 'toast-error');
        } else {
            showToast("Erreur lors de la sauvegarde : " + (e.message || e), 'toast-error');
        }
    } finally {
        saving.value = false;
    }
}
</script>

<style scoped>
/* ─── Developer comment panel (sidebar) ─── */
.admin-comment-panel {
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 10px;
    margin-bottom: 14px;
    background: #fffbea;
}
.admin-comment-label {
    font-size: 0.72em;
    font-weight: 600;
    color: #92400e;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin: 0 0 8px;
}
.admin-comment-textarea {
    width: 100%;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    padding: 8px;
    font-size: 0.85em;
    font-family: inherit;
    resize: vertical;
}
.admin-comment-actions {
    display: flex;
    gap: 6px;
    margin-top: 8px;
    flex-wrap: wrap;
}
.admin-comment-del-btn {
    background: none;
    border: 1px solid #fecaca;
    border-radius: 6px;
    color: #b91c1c;
    cursor: pointer;
    padding: 0 10px;
}
.admin-comment-del-btn:hover { background: #fef2f2; }
.admin-comment-resolved-note {
    margin: 8px 0 0;
    font-size: 0.72em;
    color: #16a34a;
}
.admin-comment-count, .admin-msg-count {
    display: inline-block;
    margin-left: 4px;
    background: #ef4444;
    color: white;
    border-radius: 10px;
    padding: 1px 6px;
    font-size: 0.85em;
}
.comment-resolved {
    opacity: 0.55;
}
.comment-resolved .version-meta {
    text-decoration: line-through;
}

/* ─── Responsive panel (sidebar) ─── */
.admin-responsive-panel {
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 10px;
    margin-bottom: 14px;
    background: #fafafc;
}
.admin-height-panel {
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 10px;
    margin-bottom: 14px;
    background: #fafafc;
}
.admin-height-label {
    font-size: 0.72em;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin: 0 0 8px;
}
.admin-height-row {
    display: flex;
    gap: 8px;
}
.admin-height-input {
    flex: 1;
    padding: 7px 10px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.85em;
    font-family: inherit;
}
.admin-height-input:focus {
    outline: none;
    border-color: #064886;
    box-shadow: 0 0 0 2px rgba(6, 72, 134, 0.1);
}
.admin-height-reset {
    flex-shrink: 0;
    padding: 7px 12px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    background: #fff;
    color: #374151;
    font-size: 0.78em;
    cursor: pointer;
    white-space: nowrap;
}
.admin-height-reset:hover {
    background: #f3f4f6;
}
.admin-responsive-label {
    font-size: 0.72em;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin: 0 0 8px;
}
.admin-vis-btn {
    width: 100%;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    background: #fff;
    cursor: pointer;
    font-size: 0.78em;
    color: #374151;
    transition: all 0.15s;
}
.admin-vis-btn:hover { border-color: #3b82f6; }
.admin-vis-btn.off {
    background: #fef2f2;
    border-color: #fecaca;
    color: #b91c1c;
    opacity: 0.85;
}
.admin-vis-icon { font-size: 1.1em; }
.admin-vis-state { font-size: 0.85em; }
.admin-vis-others {
    display: flex;
    gap: 8px;
    margin-top: 6px;
    justify-content: center;
}
.admin-vis-mini {
    font-size: 0.68em;
    color: #9ca3af;
    cursor: default;
}
.admin-vis-mini.off { color: #b91c1c; }
.admin-responsive-editing {
    margin-top: 10px;
    padding: 8px;
    border-radius: 6px;
    background: #eff6ff;
    color: #1e40af;
    font-size: 0.74em;
    line-height: 1.4;
}
.admin-responsive-editing strong { text-transform: capitalize; }
.admin-reset-overrides {
    display: inline-block;
    margin-top: 6px;
    padding: 3px 8px;
    border: 1px solid #93c5fd;
    border-radius: 5px;
    background: #fff;
    color: #1e40af;
    font-size: 0.95em;
    cursor: pointer;
}
.admin-reset-overrides:hover { background: #dbeafe; }
.admin-responsive-hint {
    margin: 8px 0 0;
    font-size: 0.72em;
    color: #9ca3af;
    line-height: 1.4;
}
.admin-toolbar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 48px;
    background: #1a1a2e;
    color: white;
    display: flex;
    align-items: center;
    padding: 0 12px;
    z-index: 10000;
    gap: 12px;
}
.admin-toolbar-left,
.admin-toolbar-right {
    display: flex;
    align-items: center;
    gap: 10px;
}
.admin-toolbar-center {
    flex: 1;
    display: flex;
    justify-content: center;
}
.admin-badge {
    background: #ef4b54;
    padding: 4px 10px;
    border-radius: 4px;
    font-size: 0.8em;
    font-weight: 700;
    white-space: nowrap;
}
.admin-page-select {
    background: rgba(255, 255, 255, 0.1);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 6px;
    padding: 4px 8px;
    font-size: 0.85em;
    cursor: pointer;
    outline: none;
}
.admin-page-select option {
    background: #1a1a2e;
    color: white;
}
.admin-page-select:hover {
    background: rgba(255, 255, 255, 0.2);
}
.admin-block-type {
    font-size: 0.9em;
    font-weight: 600;
}
.device-toggle {
    display: flex;
    gap: 4px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 3px;
}
.device-btn {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.5);
    padding: 4px 8px;
    border-radius: 6px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
}
.device-btn:hover {
    color: rgba(255, 255, 255, 0.8);
    background: rgba(255, 255, 255, 0.1);
}
.device-btn.active {
    color: white;
    background: rgba(255, 255, 255, 0.2);
}
.admin-user {
    font-size: 0.8em;
    opacity: 0.8;
    max-width: 150px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.undo-redo-group {
    display: flex;
    gap: 2px;
    margin-right: 8px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    padding: 2px;
}
.admin-icon-btn {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.7);
    padding: 4px 8px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1em;
    transition: all 0.15s;
}
.admin-icon-btn:hover {
    color: white;
    background: rgba(255, 255, 255, 0.2);
}
.admin-icon-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
}
.admin-save-status {
    font-size: 0.75em;
    color: rgba(255, 255, 255, 0.6);
    margin-right: 8px;
    white-space: nowrap;
}
.admin-save-status.unsaved {
    color: #fbbf24;
}
.admin-save-status.auto-saved {
    color: #4ade80;
}
.admin-save-status.preview-mode {
    color: #60a5fa;
    font-weight: 600;
}
.admin-avatar {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid rgba(255, 255, 255, 0.3);
    flex-shrink: 0;
}
.admin-btn {
    padding: 6px 14px;
    border: none;
    border-radius: 6px;
    font-size: 0.85em;
    font-weight: 600;
    cursor: pointer;
    background: #3b82f6;
    color: white;
    white-space: nowrap;
}
.admin-btn:hover {
    background: #2563eb;
}
.admin-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}
.admin-btn-secondary {
    background: rgba(255, 255, 255, 0.2);
}
.admin-btn-secondary:hover {
    background: rgba(255, 255, 255, 0.3);
}
/* Dans les modales à fond blanc (version-modal, settings-modal), le style
   translucide blanc-sur-blanc du bouton secondaire devient illisible. */
.version-modal .admin-btn-secondary,
.settings-modal .admin-btn-secondary {
    background: #f0f0f0;
    color: #333;
}
.version-modal .admin-btn-secondary:hover,
.settings-modal .admin-btn-secondary:hover {
    background: #e0e0e0;
}
.admin-btn-preview-cancel {
    background: rgba(217, 119, 119, 0.3);
    border: 1px solid rgba(217, 119, 119, 0.5);
}
.admin-btn-preview-cancel:hover {
    background: rgba(217, 119, 119, 0.4);
}
.admin-btn-login {
    background: #fff;
    color: #1a1a2e;
}
.admin-btn-login:hover {
    background: #f0f0f0;
}
.admin-btn-compact {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 10px;
}
.admin-btn-compact .label {
    display: none;
}
.admin-btn-compact:hover .label {
    display: inline;
}
.admin-btn-compact .icon {
    font-size: 1.1em;
}

.contact-filters {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
    flex-wrap: wrap;
}

.filter-btn {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 0.7);
    padding: 6px 12px;
    border-radius: 4px;
    font-size: 0.8em;
    cursor: pointer;
    transition: all 0.15s;
}

.filter-btn:hover {
    background: rgba(255, 255, 255, 0.15);
    color: white;
}

.filter-btn.active {
    background: #3b82f6;
    color: white;
    border-color: #3b82f6;
}

.contact-sort {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    font-size: 0.8em;
}

.sort-select {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 0.8em;
    cursor: pointer;
}

.sort-select option {
    background: #1a1a2e;
    color: white;
}

.admin-sidebar-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.3);
    z-index: 9998;
    top: 48px;
}
.admin-sidebar {
    position: fixed;
    top: 48px;
    right: 0;
    bottom: 0;
    width: 320px;
    background: white;
    box-shadow: -4px 0 20px rgba(0, 0, 0, 0.15);
    z-index: 9999;
    display: flex;
    flex-direction: column;
}
.admin-sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    border-bottom: 1px solid #eee;
}
.admin-sidebar-header h3 {
    margin: 0;
    font-size: 1em;
    color: #1a1a2e;
}
.admin-close-btn {
    background: none;
    border: none;
    font-size: 1.2em;
    cursor: pointer;
    color: #888;
    padding: 4px 8px;
}
.admin-close-btn:hover {
    color: #333;
}
.admin-sidebar-body {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
}
.admin-field {
    margin-bottom: 16px;
}
.admin-field label {
    display: block;
    font-size: 0.8em;
    font-weight: 600;
    color: #555;
    margin-bottom: 4px;
}
.admin-input {
    width: 100%;
    padding: 8px 10px;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 0.9em;
    font-family: inherit;
}
.admin-input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}
.admin-textarea {
    resize: vertical;
    min-height: 80px;
}
.admin-checkbox {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
}
.admin-checkbox input {
    width: 18px;
    height: 18px;
    accent-color: #3b82f6;
}
.admin-unsupported {
    font-size: 0.8em;
    color: #888;
    font-style: italic;
}
.admin-image-section {
    margin-top: 16px;
    padding-top: 14px;
    border-top: 1px solid #eee;
}
.admin-image-section-label {
    font-size: 0.72em;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #7c7c9a;
    margin-bottom: 8px;
}
.admin-anim-note {
    font-size: 0.78em;
    color: #888;
    background: #f5f5f5;
    padding: 8px 12px;
    border-radius: 6px;
    margin: 8px 0;
}
.admin-sidebar-footer {
    padding: 12px 16px;
    border-top: 1px solid #eee;
}
.admin-block-actions {
    display: flex;
    gap: 8px;
}
.admin-action-btn {
    flex: 1;
    padding: 8px;
    border: 1px solid #ddd;
    border-radius: 6px;
    background: white;
    cursor: pointer;
    font-size: 1em;
}
.admin-action-btn:hover {
    background: #f5f5f5;
}
.admin-action-danger:hover {
    background: #fee;
    border-color: #ef4b54;
}
.admin-action-duplicate:hover {
    background: #e8f4ff;
    border-color: #064886;
}
.admin-action-template:hover {
    background: #fff8e8;
    border-color: #f59e0b;
}
.admin-loading {
    font-size: 0.8em;
    opacity: 0.6;
}
.admin-image-preview {
    width: 100%;
    max-height: 120px;
    object-fit: cover;
    border-radius: 6px;
    margin-top: 8px;
}
.uploader-controls {
    display: flex;
    gap: 8px;
    margin-top: 8px;
    align-items: center;
}
.file-input {
    display: none;
}
.admin-uploaded-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
    margin-top: 8px;
}
.admin-uploaded-item img {
    width: 100%;
    height: 56px;
    object-fit: cover;
    border-radius: 6px;
    cursor: pointer;
    border: 1px solid #e5e7eb;
}
.images-loading {
    color: #666;
    font-size: 0.9em;
    margin-top: 8px;
}
</style>

<style>
/* Version history modal */
.version-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.5);
    z-index: 99999;
    display: flex;
    align-items: center;
    justify-content: center;
}
.version-modal {
    background: white;
    border-radius: 12px;
    width: 90%;
    max-width: 500px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 40px rgba(0,0,0,0.2);
}
.version-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid #eee;
}
.version-modal-header h3 {
    margin: 0;
    font-size: 16px;
    color: #333;
}
.version-modal-close {
    background: none;
    border: none;
    font-size: 20px;
    cursor: pointer;
    color: #999;
    padding: 4px 8px;
}
.version-modal-close:hover {
    color: #333;
}
.version-modal-body {
    padding: 16px 20px;
    overflow-y: auto;
    flex: 1;
}
.version-list-hint {
    font-size: 11px;
    color: #999;
    margin: 0 0 12px;
    line-height: 1.4;
}
.version-filter-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 0 16px 0;
    border-bottom: 1px solid #e5e5e5;
    margin-bottom: 12px;
}
.version-filter-label {
    font-size: 12px;
    color: #666;
    font-weight: 600;
}
.version-filter-select {
    flex: 1;
    padding: 6px 10px;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    font-size: 13px;
    font-family: inherit;
}
.version-filter-select:focus {
    outline: none;
    border-color: #064886;
    box-shadow: 0 0 0 2px rgba(6, 72, 134, 0.1);
}
.version-filter-count {
    font-size: 11px;
    color: #888;
    white-space: nowrap;
}
.version-loading, .version-empty {
    color: #888;
    text-align: center;
    padding: 24px;
}
.version-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
}
/* .version-item moved above with expandable layout */
.version-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
}
.version-date {
    font-weight: 600;
    color: #333;
    font-size: 14px;
}
.version-author {
    font-size: 12px;
    color: #888;
}
.version-meta {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-top: 2px;
}
.version-blocks {
    font-size: 11px;
    color: #666;
    font-weight: 500;
}
.version-types {
    font-size: 11px;
    color: #555;
}
.version-diff {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 4px;
    align-items: baseline;
}
.vd-added, .vd-removed, .vd-modified {
    font-size: 11px;
    font-weight: 600;
    padding: 1px 5px;
    border-radius: 3px;
}
.vd-added { color: #059669; background: #ecfdf5; }
.vd-removed { color: #dc2626; background: #fef2f2; }
.vd-modified { color: #d97706; background: #fffbeb; }
.vd-detail {
    font-size: 10px;
    color: #6b7280;
    font-style: italic;
    max-width: 260px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.vd-added-detail { color: #059669; }
.vd-removed-detail { color: #dc2626; }
.version-current {
    font-size: 10px;
    font-weight: 700;
    color: #2563eb;
    background: #eff6ff;
    padding: 1px 5px;
    border-radius: 3px;
    text-transform: uppercase;
}

/* Admin manager */
.admin-mgr-section {
    margin-bottom: 16px;
}
.admin-mgr-section h4 {
    margin: 0 0 8px;
    font-size: 14px;
    color: #555;
}
.admin-mgr-add {
    display: flex;
    gap: 8px;
}
.admin-mgr-input {
    flex: 1;
    padding: 8px 12px;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 13px;
    font-family: monospace;
}
.admin-mgr-hint {
    font-size: 12px;
    color: #999;
    margin: 6px 0 0;
}
.admin-mgr-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
}
.admin-mgr-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 10px;
    background: #f8f9fa;
    border-radius: 6px;
    font-family: monospace;
    font-size: 12px;
}
.admin-mgr-uid {
    word-break: break-all;
    color: #555;
    flex: 1;
    min-width: 0;
}
.admin-mgr-del-btn {
    flex-shrink: 0;
    padding: 2px 7px;
    border: 1px solid #fecaca;
    border-radius: 4px;
    background: white;
    color: #ef4444;
    cursor: pointer;
    font-size: 11px;
    line-height: 1.4;
    white-space: nowrap;
    margin-left: 8px;
}
.admin-mgr-del-btn:hover { background: #fef2f2; }
.admin-mgr-del-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.admin-mgr-role-select {
    padding: 4px 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 12px;
    font-family: inherit;
    background: white;
}
.admin-mgr-role-select:disabled { opacity: 0.5; cursor: not-allowed; }
.admin-mgr-role-badge {
    font-size: 11px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 4px;
}
.admin-mgr-role-badge.role-admin {
    color: #2563eb;
    background: #eff6ff;
}
.admin-mgr-role-badge.role-editor {
    color: #6b7280;
    background: #f3f4f6;
}
.admin-mgr-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
}
.admin-mgr-table th {
    text-align: left;
    font-size: 11px;
    color: #999;
    font-weight: 500;
    padding: 4px 8px;
    border-bottom: 1px solid #eee;
}
.admin-mgr-row td {
    padding: 6px 8px;
    border-bottom: 1px solid #f5f5f5;
    vertical-align: middle;
}
.admin-mgr-row .admin-mgr-uid {
    font-family: monospace;
}

/* Version history expandable */
.version-item {
    display: flex;
    flex-direction: column;
    background: #f8f9fa;
    border-radius: 8px;
    overflow: hidden;
}
.version-item-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
    padding: 10px 12px;
}
.version-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.version-actions {
    display: flex;
    flex-direction: column;
    gap: 4px;
    align-items: flex-end;
    flex-shrink: 0;
}
.version-restore-btn { font-size: 0.78em; padding: 4px 10px; }
.version-del-btn {
    background: none;
    border: 1px solid #fecaca;
    border-radius: 4px;
    color: #ef4444;
    cursor: pointer;
    font-size: 10px;
    padding: 2px 6px;
    line-height: 1.4;
}
.version-del-btn:hover { background: #fef2f2; }
.version-del-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.version-expand-arrow { font-size: 10px; color: #9ca3af; margin-left: 4px; }
.version-detail-panel {
    padding: 8px 12px 10px;
    border-top: 1px solid #e5e7eb;
    background: white;
    display: flex;
    flex-direction: column;
    gap: 6px;
}
.vd-detail-group { display: flex; flex-wrap: wrap; gap: 4px; align-items: baseline; }
.vd-detail-label {
    font-size: 10px; font-weight: 700; color: #9ca3af;
    text-transform: uppercase; letter-spacing: 0.04em;
    width: 100%; margin-bottom: 2px;
}
.vd-detail-item {
    font-size: 11px; padding: 2px 6px; border-radius: 3px;
}
.vd-no-detail { font-size: 11px; color: #9ca3af; margin: 0; font-style: italic; }

/* Block picker */
.block-picker-modal {
    max-width: 640px;
}
.block-picker-subtitle {
    margin: 2px 0 0;
    font-size: 12px;
    color: #888;
}
.block-picker-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: 10px;
}
.block-picker-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 14px 10px;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    background: #fafafa;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s, transform 0.1s;
    font-family: inherit;
}
.block-picker-card:hover {
    background: #eff6ff;
    border-color: #3b82f6;
    transform: translateY(-2px);
}
.block-picker-icon {
    font-size: 24px;
    line-height: 1;
}
.block-picker-label {
    font-size: 11px;
    font-weight: 600;
    color: #374151;
    text-align: center;
    line-height: 1.3;
}
.block-picker-back {
    background: none;
    border: none;
    color: #3b82f6;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    padding: 0 0 12px;
    font-family: inherit;
}
.block-picker-back:hover {
    text-decoration: underline;
}
.block-picker-loading {
    padding: 40px;
    text-align: center;
    color: #6b7280;
    font-size: 14px;
}
.block-picker-card-empty {
    grid-column: 1 / -1;
    border-style: dashed;
    background: #f9fafb;
}
.block-picker-card-empty:hover {
    background: #f3f4f6;
    border-color: #9ca3af;
}
.admin-btn-add-block {
    background: #10b981;
    color: white;
}
.admin-btn-add-block:hover {
    background: #059669;
}

/* Settings Modal */
.settings-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
}
.settings-modal {
    background: white;
    border-radius: 8px;
    width: 90%;
    max-width: 500px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}
.settings-modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px;
    border-bottom: 1px solid #e5e7eb;
}
.settings-modal-header h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
}
.close-btn {
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: #6b7280;
}
.settings-modal-body {
    padding: 20px;
    overflow-y: auto;
    flex: 1;
    min-height: 0;
}
.settings-field {
    margin-bottom: 16px;
}
.settings-field label {
    display: block;
    margin-bottom: 8px;
    font-size: 14px;
    font-weight: 500;
    color: #374151;
}
.settings-input {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    font-size: 14px;
    font-family: inherit;
}
.settings-input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}
.settings-textarea {
    resize: vertical;
    min-height: 44px;
    line-height: 1.5;
}
.settings-hint {
    margin: 6px 0 0 0;
    font-size: 13px;
    color: #6b7280;
}
.social-link-row {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-top: 8px;
}
.social-link-platform {
    flex: 0 0 140px;
}
.social-link-url {
    flex: 1;
}
.social-link-del {
    background: none;
    border: none;
    color: #EF4B54;
    cursor: pointer;
    font-size: 0.9em;
    padding: 4px 8px;
    border-radius: 4px;
    flex-shrink: 0;
}
.social-link-del:hover {
    background: rgba(239, 75, 84, 0.1);
}
.social-link-add {
    margin-top: 10px;
    background: #f3f4f6;
    border: 1.5px dashed #d1d5db;
    border-radius: 8px;
    color: #555;
    font-size: 0.85em;
    padding: 8px 12px;
    cursor: pointer;
}
.social-link-add:hover {
    border-color: #064886;
    color: #064886;
    background: #eef4fa;
}
.member-tab-order-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 8px;
}
.member-tab-order-row {
    display: flex;
    align-items: center;
    gap: 8px;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 8px 10px;
}
.member-tab-order-label {
    flex: 1;
    font-size: 0.9em;
    color: #1a1a2e;
}
.member-tab-order-btn {
    background: #fff;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    color: #555;
    cursor: pointer;
    padding: 2px 9px;
    font-size: 0.9em;
}
.member-tab-order-btn:hover:not(:disabled) {
    border-color: #064886;
    color: #064886;
    background: #eef4fa;
}
.member-tab-order-btn:disabled {
    opacity: 0.35;
    cursor: default;
}
.settings-hint.quota-warning {
    color: #b45309;
}
.quota-bar-wrap {
    display: flex;
    align-items: center;
    gap: 10px;
}
.quota-bar {
    flex: 1;
    height: 8px;
    border-radius: 4px;
    background: #e5e7eb;
    overflow: hidden;
}
.quota-bar-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 0.2s ease;
}
.quota-bar-fill.quota-ok {
    background: #22c55e;
}
.quota-bar-fill.quota-warning-level {
    background: #f59e0b;
}
.quota-bar-fill.quota-critical {
    background: #ef4444;
}
.quota-text {
    font-size: 12px;
    color: #6b7280;
    white-space: nowrap;
    min-width: 48px;
    text-align: right;
}
.settings-checkbox-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 500;
    color: #374151;
    cursor: pointer;
}
.settings-checkbox {
    width: 18px;
    height: 18px;
    cursor: pointer;
}
.settings-modal-footer {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    padding: 20px;
    border-top: 1px solid #e5e7eb;
}
.btn-cancel, .btn-save {
    padding: 8px 16px;
    border-radius: 4px;
    border: none;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
}
.btn-cancel {
    background: #e5e7eb;
    color: #374151;
}
.btn-cancel:hover {
    background: #d1d5db;
}
.btn-save {
    background: #3b82f6;
    color: white;
}
.btn-save:hover:not(:disabled) {
    background: #2563eb;
}
.btn-save:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

/* Contact Stats */
.contact-stats {
    display: flex;
    gap: 16px;
    padding: 12px 0;
    border-bottom: 1px solid #e5e7eb;
    margin-bottom: 12px;
}
.stat-item {
    flex: 1;
    text-align: center;
    padding: 8px;
    background: #f9fafb;
    border-radius: 4px;
}
.stat-label {
    display: block;
    font-size: 12px;
    color: #6b7280;
    font-weight: 500;
    margin-bottom: 4px;
}
.stat-value {
    display: block;
    font-size: 20px;
    font-weight: 700;
    color: #3b82f6;
}

/* Global fallback: ensure site header is offset below admin toolbar when in admin mode */
#app-root.admin-mode .site-header {
    top: var(--admin-offset, 48px) !important;
}
/* Spacer = header height only (72px desktop, 52px mobile).
   Admin toolbar (48px) is already above in normal flow — do NOT add --admin-offset. */
#app-root.admin-mode .header-spacer {
    height: 72px;
}
@media (max-width: 768px) {
    #app-root.admin-mode .header-spacer {
        height: 52px;
    }
}
</style>
