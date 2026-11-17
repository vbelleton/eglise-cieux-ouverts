import { ref, provide, watch, inject, computed } from 'vue'
import { HARDCODED_SLUGS } from '~/utils/blockTypes.js'

const DEFAULT_MENU_ITEMS = [
  { id: 'accueil', label: 'Accueil', to: '/', visible: true, children: [] },
  { id: 'messages', label: 'Messages', to: '/messages', visible: true, children: [] },
  { id: 'agenda', label: 'Agenda', to: '/agenda', visible: true, children: [] },
  { id: 'event-list', label: 'Événements', to: '/event-list', visible: true, children: [] },
  { id: 'dons', label: 'Dons', to: '/dons', visible: true, children: [] },
  { id: 'contact', label: 'Contact', to: '/contact', visible: true, children: [] },
]

const MENU_EDITOR_KEY = Symbol('menu-editor')

const menuItems = ref(JSON.parse(JSON.stringify(DEFAULT_MENU_ITEMS)))
const customPages = ref([])
const editingMenuItemId = ref(null)
const menuEditorOpen = ref(false)
const menuLoaded = ref(false)
const menuSaving = ref(false)
const menuChanged = ref(false)
const menuBgImage = ref('')

export function useMenuEditor() {
  const existing = inject(MENU_EDITOR_KEY, null)
  if (existing) return existing

  const activeMenuItem = computed(() => {
    if (!editingMenuItemId.value) return null
    return findItemById(menuItems.value, editingMenuItemId.value)
  })

  function findItemById(items, id) {
    for (const item of items) {
      if (item.id === id) return item
      if (item.children?.length) {
        const found = findItemById(item.children, id)
        if (found) return found
      }
    }
    return null
  }

  function initMenuItems(items) {
    if (items && items.length) {
      menuItems.value = JSON.parse(JSON.stringify(items))
    }
  }

  function openMenuEditor(itemId = null) {
    menuEditorOpen.value = true
    if (itemId) editingMenuItemId.value = itemId
  }

  function closeMenuEditor() {
    menuEditorOpen.value = false
    editingMenuItemId.value = null
  }

  function toggleMenuEditor() {
    if (menuEditorOpen.value) closeMenuEditor()
    else openMenuEditor()
  }

  function selectMenuItem(id) {
    editingMenuItemId.value = id
  }

  function markChanged() {
    menuChanged.value = true
  }

  function updateMenuItem(id, updates) {
    const item = findItemById(menuItems.value, id)
    if (item) { Object.assign(item, updates); markChanged() }
  }

  function addMenuItem(afterId = null) {
    const newItem = { id: 'item_' + Date.now(), label: 'Nouveau lien', to: '/', visible: true, children: [] }
    if (afterId) {
      const idx = menuItems.value.findIndex(i => i.id === afterId)
      menuItems.value.splice(idx + 1, 0, newItem)
    } else {
      menuItems.value.push(newItem)
    }
    editingMenuItemId.value = newItem.id
    markChanged()
  }

  function addSubMenuItem(parentId) {
    const newItem = { id: 'sub_' + Date.now(), label: 'Sous-menu', to: '/', visible: true, children: [] }
    const parent = findItemById(menuItems.value, parentId)
    if (parent) {
      if (!parent.children) parent.children = []
      parent.children.push(newItem)
      editingMenuItemId.value = newItem.id
      markChanged()
    }
  }

  function removeMenuItem(id) {
    function remove(items) {
      return items.filter(item => {
        if (item.id === id) return false
        if (item.children) item.children = remove(item.children)
        return true
      })
    }
    menuItems.value = remove(menuItems.value)
    if (editingMenuItemId.value === id) editingMenuItemId.value = null
    markChanged()
  }

  function moveMenuItem(id, direction) {
    const idx = menuItems.value.findIndex(i => i.id === id)
    if (idx < 0) return
    const newIdx = idx + direction
    if (newIdx < 0 || newIdx >= menuItems.value.length) return
    const [item] = menuItems.value.splice(idx, 1)
    menuItems.value.splice(newIdx, 0, item)
    markChanged()
  }

  function toggleMenuItemVisibility(id) {
    const item = findItemById(menuItems.value, id)
    if (item) { item.visible = !item.visible; markChanged() }
  }

  function setMenuBgImage(value) {
    menuBgImage.value = value
    markChanged()
  }

  function getVisibleItems() {
    return menuItems.value.filter(i => i.visible)
  }

  function getMenuItems() {
    return menuItems.value
  }

  function resetToDefault() {
    menuItems.value = JSON.parse(JSON.stringify(DEFAULT_MENU_ITEMS))
    editingMenuItemId.value = null
    markChanged()
  }

  // ── Custom CMS pages (shared between AdminToolbar dropdown and MenuEditor) ──
  function findLabelForSlug(items, slug) {
    for (const item of items) {
      if (item.pageSlug === slug || item.to === `/${slug}`) return item.label
      if (item.children?.length) {
        const found = findLabelForSlug(item.children, slug)
        if (found) return found
      }
    }
    return null
  }

  async function loadCustomPages() {
    try {
      const res = await fetch('/api/pages')
      if (!res.ok) return
      const data = await res.json()
      customPages.value = (data.pages || [])
        .filter(p => !HARDCODED_SLUGS.includes(p.slug) && !p._deleted)
        .map(p => {
          // Les anciennes sauvegardes écrasaient le titre (il retombait sur le
          // slug) : on récupère alors le label du menu comme titre d'affichage
          if (!p.title || p.title === p.slug) {
            const label = findLabelForSlug(menuItems.value, p.slug)
            if (label) return { ...p, title: label }
          }
          return p
        })
    } catch (e) {
      console.warn('useMenuEditor: failed to load custom pages', e)
    }
  }

  // Retire récursivement les items dont pageSlug pointe vers une page
  // supprimée/inexistante (menu item orphelin — la page a été supprimée
  // sans que la suppression de son entrée de menu soit sauvegardée)
  function stripOrphanPageItems(items, deletedOrMissingSlugs) {
    return items
      .filter(item => !item.pageSlug || !deletedOrMissingSlugs.has(item.pageSlug))
      .map(item => item.children?.length
        ? { ...item, children: stripOrphanPageItems(item.children, deletedOrMissingSlugs) }
        : item
      )
  }

  async function pruneOrphanMenuItems() {
    try {
      const res = await fetch('/api/pages')
      if (!res.ok) return
      const data = await res.json()
      const existingSlugs = new Set(
        (data.pages || []).filter(p => !p._deleted).map(p => p.slug)
      )
      const referencedSlugs = new Set()
      const collect = (items) => {
        for (const item of items) {
          if (item.pageSlug) referencedSlugs.add(item.pageSlug)
          if (item.children?.length) collect(item.children)
        }
      }
      collect(menuItems.value)
      const orphanSlugs = new Set([...referencedSlugs].filter(s => !existingSlugs.has(s)))
      if (orphanSlugs.size) {
        menuItems.value = stripOrphanPageItems(menuItems.value, orphanSlugs)
      }
    } catch (e) {
      console.warn('MenuEditor: failed to prune orphan menu items', e)
    }
  }

  // ── Firestore persistence (via server API — bypasses client security rules) ──
  async function loadMenuFromFirestore() {
    if (menuLoaded.value) return
    try {
      const res = await fetch('/api/menu')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (data.menuItems?.length) {
        // Nettoie l'orphelin « /accueil » ajouté par d'anciennes versions du
        // merge : la vraie route d'accueil est « / », rien ne pointe vers
        // /accueil légitimement
        menuItems.value = JSON.parse(JSON.stringify(data.menuItems)).filter(
          item => item.to !== '/accueil'
        )
        // Auto-guérison : retire les entrées pointant vers une page supprimée
        // (ex: page supprimée sans que le retrait du menu ait été sauvegardé)
        await pruneOrphanMenuItems()
      }
      if (data.menuBgImage) menuBgImage.value = data.menuBgImage
    } catch (e) {
      console.warn('MenuEditor: could not load menu, using defaults', e)
    } finally {
      menuLoaded.value = true
    }
  }

  async function getFirebaseToken() {
    if (import.meta.server) return null
    const { $auth } = useNuxtApp()
    const user = await new Promise((resolve) => {
      if ($auth?.currentUser) { resolve($auth.currentUser); return }
      const unsub = $auth?.onAuthStateChanged((u) => { resolve(u); if (typeof unsub === 'function') unsub() })
    })
    if (!user) return null
    try { return await user.getIdToken() } catch { return null }
  }

  async function saveMenuToFirestore() {
    if (!menuLoaded.value) return
    menuSaving.value = true
    try {
      const token = await getFirebaseToken()
      if (!token) throw new Error('Non authentifié')
      const res = await fetch('/api/menu', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          menuItems: JSON.parse(JSON.stringify(menuItems.value)),
          menuBgImage: menuBgImage.value,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || `HTTP ${res.status}`)
      }
      menuChanged.value = false
    } catch (e) {
      console.error('MenuEditor: save failed', e)
      throw e
    } finally {
      menuSaving.value = false
    }
  }

  const api = {
    menuItems, editingMenuItemId, menuEditorOpen, activeMenuItem,
    menuLoaded, menuSaving, menuChanged, menuBgImage,
    customPages, loadCustomPages,
    initMenuItems, loadMenuFromFirestore, saveMenuToFirestore,
    openMenuEditor, closeMenuEditor, toggleMenuEditor,
    selectMenuItem, updateMenuItem, addMenuItem, addSubMenuItem,
    removeMenuItem, moveMenuItem, toggleMenuItemVisibility,
    setMenuBgImage, getVisibleItems, getMenuItems, resetToDefault,
    getFirebaseToken,
  }

  provide(MENU_EDITOR_KEY, api)
  provide('menuItems', menuItems)
  provide('menuEditorOpen', menuEditorOpen)
  provide('editingMenuItemId', editingMenuItemId)
  provide('menuChanged', menuChanged)

  return api
}
