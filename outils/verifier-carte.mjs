/* Le déploiement refuse de publier une carte d'imports incomplète.
 *
 * Sans ce contrôle, ajouter un module et oublier de régénérer la carte
 * produit exactement la panne qu'elle était censée éliminer : le module
 * neuf est servi sans version, donc mis en cache, donc figé — et l'on
 * cherche pendant une heure pourquoi un correctif « ne marche pas ».
 *
 * Ce contrôle vit dans un fichier plutôt que dans le YAML du déploiement,
 * et pour une raison apprise à la dure : un script glissé dans un bloc
 * YAML traverse deux niveaux d'échappement, et les antislashs d'une
 * expression régulière n'y survivent pas. Ici, il s'exécute aussi en
 * local, à l'identique.
 */
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const html = readFileSync('public/index.html', 'utf8');

const bloc = html.match(/<script type="importmap">([\s\S]*?)<\/script>/);
if (!bloc) {
  console.error("::error::Aucune carte d'imports dans index.html.");
  process.exit(1);
}

let carte;
try { carte = JSON.parse(bloc[1]); }
catch (e) { console.error(`::error::Carte d'imports illisible : ${e.message}`); process.exit(1); }

const modules = [];
const parcourir = (dossier, prefixe) => {
  for (const e of readdirSync(join('public', dossier), { withFileTypes: true })) {
    if (e.isDirectory()) parcourir(join(dossier, e.name), `${prefixe}${e.name}/`);
    else if (e.name.endsWith('.js')) modules.push(`${prefixe}${e.name}`);
  }
};
parcourir('js', 'js/');

const absents = modules.filter(m => !carte.imports[`./${m}`]);
if (absents.length) {
  console.error(`::error::Modules absents de la carte d'imports : ${absents.join(', ')}`
    + ' — relance « node outils/carte-imports.mjs <version> ».');
  process.exit(1);
}

const versions = new Set(Object.values(carte.imports).map(v => v.split('?v=')[1]));

/* La balise, et non la première occurrence du nom : la carte d'imports
   contient « ./js/app.js?v=… » bien avant le `<script>` du bas, si bien
   que ce contrôle comparait la carte à elle-même. Il passait donc
   toujours, pendant que le module d'entrée restait figé à une vieille
   version — la panne même qu'il devait interdire. */
const entree = (html.match(/<script type="module" src="js\/app\.js\?v=(\d+)"/) || [])[1];
const feuille = (html.match(/css\/style\.css\?v=(\d+)/) || [])[1];

if (versions.size !== 1 || !versions.has(entree)) {
  console.error("::error::La carte d'imports et le module d'entrée ne portent pas la même version"
    + ` (carte : ${[...versions].join(', ')} ; entrée : ${entree}).`);
  process.exit(1);
}

/* La feuille de style suit le même chemin et le même cache. Publiée
   sous une version périmée, elle donne un écran aux styles d'avant sur
   un site dont le code est d'après : plus déroutant encore qu'un module
   figé, parce que rien n'a l'air cassé. */
if (feuille !== entree) {
  console.error('::error::La feuille de style ne porte pas la version du site'
    + ` (style : ${feuille} ; entrée : ${entree}).`);
  process.exit(1);
}

console.log(`OK — ${modules.length} modules, version ${entree}.`);
