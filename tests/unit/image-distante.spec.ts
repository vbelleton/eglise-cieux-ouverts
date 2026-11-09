import { test, expect } from '@playwright/test'
import { typeImage, adresseAutorisee } from '../../server/utils/image-distante'

test('typeImage reconnaît les images par leurs premiers octets (S3 les sert en octet-stream)', () => {
  expect(typeImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]))).toBe('image/png')
  expect(typeImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg')
  expect(typeImage(new Uint8Array([0x47, 0x49, 0x46, 0x38]))).toBe('image/gif')
  expect(typeImage(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))).toBe('image/webp')
  expect(typeImage(new TextEncoder().encode('<html>'))).toBeNull()
})

test('adresseAutorisee : https public uniquement, jamais une adresse IP ou un nom local', () => {
  expect(adresseAutorisee('https://s3.amazonaws.com/uploadcare.calendar.inffuse.com/a/img.png')).not.toBeNull()
  for (const url of [
    'http://exemple.fr/a.png', 'https://127.0.0.1/a.png', 'https://169.254.169.254/latest',
    'https://[::1]/a.png', 'https://localhost/a.png', 'https://intranet/a.png',
    'https://serveur.local/a.png', 'https://u:p@exemple.fr/a.png', 'https://exemple.fr:8443/a.png',
    'file:///etc/passwd', 'pas une url',
  ]) expect(adresseAutorisee(url), url).toBeNull()
})
