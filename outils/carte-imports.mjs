/* Régénère la carte d'imports de index.html.
 *
 * ─── Le problème qu'elle règle ────────────────────────────────────────
 *
 * Le `?v=` posé sur le module d'entrée ne versionne que lui. Les vingt
 * autres modules sont importés par chemin relatif, sans marqueur : le
 * navigateur les garde dans son cache, et un onglet resté ouvert peut
 * afficher un correctif à moitié appliqué — le nouveau `app.js` avec
 * l'ancien `terrain.js`. C'est arrivé trois fois de suite, chaque fois
 * pris pour un correctif qui ne marchait pas.
 *
 * Une carte d'imports (`<script type="importmap">`) résout ce problème
 * sans outil de construction : elle réécrit chaque chemin de module vers
 * sa version datée. Un seul numéro à changer, et tout le graphe suit.
 *
 * Usage : node outils/carte-imports.mjs 33
 */
import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const version = process.argv[2];
if (!/^\d+$/.test(version || '')) {
  console.error('Usage : node outils/carte-imports.mjs <numéro de version>');
  process.exit(1);
}

const modules = [];
const parcourir = (dossier, prefixe) => {
  for (const e of readdirSync(join('public', dossier), { withFileTypes: true })) {
    if (e.isDirectory()) parcourir(join(dossier, e.name), `${prefixe}${e.name}/`);
    else if (e.name.endsWith('.js')) modules.push(`${prefixe}${e.name}`);
  }
};
parcourir('js', 'js/');
modules.sort();

/* Des clés relatives, et non absolues : le site est publié sous
   /mon-tennis/ sur GitHub Pages et à la racine en local. Une clé
   « /js/store.js » désignerait deux fichiers différents selon l'endroit —
   dont un qui n'existe pas. Résolues contre l'adresse de la page, les
   clés relatives tombent juste dans les deux cas. */
const carte = {
  imports: Object.fromEntries(modules.map(m => [`./${m}`, `./${m}?v=${version}`])),
};

const bloc = `<script type="importmap">\n${JSON.stringify(carte, null, 2)}\n</script>`;

let html = readFileSync('public/index.html', 'utf8');
const debut = html.indexOf('<script type="importmap">');
if (debut >= 0) {
  const fin = html.indexOf('</script>', debut) + '</script>'.length;
  html = html.slice(0, debut) + bloc + html.slice(fin);
} else {
  html = html.replace('</head>', `${bloc}\n</head>`);
}

/* Le module d'entrée porte son propre marqueur, et il faut viser la
   balise qui le charge — pas la première occurrence du nom dans le
   fichier. Depuis que la carte d'imports existe, celle-ci contient
   « ./js/app.js?v=… » bien avant le `<script>` du bas : la
   substitution retombait sur la carte, qui venait d'être réécrite,
   et le `<script src>` restait à la version qu'il avait ce jour-là.

   Il y est resté quatre-vingt-dix versions. Les modules importés
   suivaient, eux, puisque la carte les redirige — si bien qu'un
   appareil pouvait servir l'ancien `app.js` avec tout le reste à
   jour : le routeur et le menu d'avant, les écrans d'après. C'est
   exactement la panne que la carte devait empêcher, déplacée d'un
   cran. */
html = html.replace(/css\/style\.css\?v=\d+/, `css/style.css?v=${version}`)
           .replace(/(<script type="module" src=")js\/app\.js\?v=\d+/,
                    `$1js/app.js?v=${version}`);

writeFileSync('public/index.html', html);
console.log(`carte d'imports : ${modules.length} modules en v=${version}`);
