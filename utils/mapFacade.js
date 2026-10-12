// Les cartes Google Maps intégrées pèsent ~1 Mo de JavaScript et mettent
// plusieurs secondes à s'afficher, même en `loading="lazy"`. On affiche donc
// un cadre léger à la place et la vraie carte ne se charge qu'au toucher.
// Seules les cartes google.com/maps sont concernées ; tout autre iframe
// (YouTube, etc.) reste tel quel.

const MAP_SRC = /^https:\/\/(www\.)?google\.com\/maps/i

export function isMapSrc(src) {
  return typeof src === 'string' && MAP_SRC.test(src)
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Remplace chaque iframe Google Maps d'un HTML (déjà assaini) par son cadre.
export function facadeMaps(html) {
  if (!html || !/<iframe/i.test(html)) return html
  return html.replace(/<iframe\b([^>]*)>\s*<\/iframe>/gi, (whole, attrs) => {
    const src = (attrs.match(/\ssrc="([^"]*)"/i) || [])[1]?.replace(/&amp;/g, '&')
    if (!isMapSrc(src)) return whole
    const title = (attrs.match(/\stitle="([^"]*)"/i) || [])[1] || 'Carte'
    const height = parseInt((attrs.match(/\sheight="(\d+)"/i) || [])[1], 10) || 320
    return (
      `<div class="map-facade" data-map-src="${esc(src)}" data-map-title="${esc(title)}" style="height:${height}px">` +
      `<span class="map-facade-pin" aria-hidden="true">📍</span>` +
      `<span class="map-facade-title">${title}</span>` +
      `<button type="button" class="map-facade-btn">Afficher la carte</button>` +
      `</div>`
    )
  })
}

// À appeler sur un clic délégué : charge la vraie carte à la place du cadre.
export function activateMapFromEvent(event) {
  const facade = event.target?.closest?.('.map-facade')
  if (!facade) return false
  const src = facade.getAttribute('data-map-src')
  if (!isMapSrc(src)) return false
  const iframe = document.createElement('iframe')
  iframe.src = src
  iframe.title = facade.getAttribute('data-map-title') || 'Carte'
  iframe.setAttribute('referrerpolicy', 'no-referrer-when-downgrade')
  iframe.style.cssText = 'border:0;width:100%;height:100%;border-radius:12px;'
  facade.replaceChildren(iframe)
  facade.classList.add('map-facade-loaded')
  return true
}
