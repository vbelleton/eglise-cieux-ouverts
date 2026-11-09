// Utilitaires de server/api/media/importer.post.ts (testés à part).

// Hébergeurs comme S3 servent parfois les images en
// `binary/octet-stream` : le type est déduit des premiers octets.
export function typeImage(octets: Uint8Array): string | null {
  const b = octets
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png'
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif'
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46
    && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp'
  return null
}

export function adresseAutorisee(brute: string): URL | null {
  let u: URL
  try { u = new URL(brute) } catch { return null }
  if (u.protocol !== 'https:' || u.username || u.password || u.port) return null
  const h = u.hostname.toLowerCase()
  if (!h.includes('.') || h.endsWith('.local') || h.endsWith('.internal') || h === 'localhost') return null
  if (/^[\d.]+$/.test(h) || h.includes(':') || h.startsWith('[')) return null // adresses IP
  return u
}
