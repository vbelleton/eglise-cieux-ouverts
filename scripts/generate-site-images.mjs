// Liste des images fournies avec le site (dossier public/), affichées dans
// l'onglet « Images du site » de la médiathèque. Cloudflare Pages n'a pas de
// système de fichiers à l'exécution : la liste est donc figée dans
// utils/siteImages.json. À relancer après tout ajout d'image dans public/ :
//   node scripts/generate-site-images.mjs
// (tests/unit/image-library.spec.ts échoue si le fichier est périmé.)
import { readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const racine = join(dirname(fileURLToPath(import.meta.url)), '..')
const publicDir = join(racine, 'public')
const EXT = /\.(png|jpe?g|webp|gif|svg)$/i

function parcourir(dossier) {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom)
    return statSync(chemin).isDirectory() ? parcourir(chemin) : [chemin]
  })
}

export function listerImagesDuSite() {
  return parcourir(publicDir)
    .map(f => '/' + relative(publicDir, f).split('\\').join('/'))
    .filter(f => EXT.test(f) && !/^\/favicon/.test(f) && !/^\/test-/.test(f))
    .sort()
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(join(racine, 'utils/siteImages.json'), JSON.stringify(listerImagesDuSite(), null, 2) + '\n')
}
