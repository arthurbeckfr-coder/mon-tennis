/* Fabrique le fond de carte des Antilles françaises.
 *
 * ─── Pourquoi un outil plutôt qu'un copier-coller ────────────────────
 *
 * Le fond de la métropole a été relevé une fois et collé dans
 * `france.js`. Personne ne sait plus le refaire : ni avec quelle
 * tolérance, ni depuis quelle source, ni comment les anneaux ont été
 * triés. Le jour où il faudra y toucher — une commune fusionnée, un
 * tracé à affiner — il faudra tout recommencer à l'aveugle.
 *
 * Celui-ci se régénère. On le lance, il redemande les données à l'API
 * officielle des communes et réécrit le fichier. La simplification, les
 * seuils et les arrondis sont écrits ici, en toutes lettres.
 *
 * ─── Comment on obtient le contour d'une île ─────────────────────────
 *
 * L'API donne les communes, pas les départements. Or les frontières
 * intérieures sont parcourues deux fois — une par la commune de chaque
 * côté — quand le bord de mer ne l'est qu'une. On compte donc chaque
 * segment : ceux qui reviennent deux fois s'annulent, ceux qui restent
 * sont le trait de côte. Il ne reste qu'à les recoudre bout à bout.
 *
 * C'est exact tant que les communes voisines partagent leurs points au
 * chiffre près, ce qui est le cas ici : elles viennent du même découpage.
 *
 * Usage : node outils/antilles.mjs
 */
import { writeFileSync } from 'fs';

const TOLERANCE = 0.003;   // ~330 m : le détail qu'un téléphone montre encore
const ETENDUE_MIN = 0.02;  // ~2 km : en dessous, un îlot n'est plus qu'un point
const DECIMALES = 3;       // ~110 m

const API = 'https://geo.api.gouv.fr/departements';

async function communes(dept) {
  const r = await fetch(`${API}/${dept}/communes?format=geojson&geometry=contour&fields=nom`);
  if (!r.ok) throw new Error(`${dept} : ${r.status}`);
  return (await r.json()).features;
}

async function villes(dept, seuil = 10000, enPlus = []) {
  const r = await fetch(`${API}/${dept}/communes?fields=nom,population,centre`);
  if (!r.ok) throw new Error(`${dept} : ${r.status}`);
  const j = await r.json();
  return j
    .filter(v => v.centre && (v.population >= seuil || enPlus.includes(v.nom)))
    .sort((a, b) => b.population - a.population)
    .map(v => ({
      nom: v.nom,
      r: v.population >= 100000 ? 0 : v.population >= 30000 ? 1 : 2,
      point: v.centre.coordinates.map(arrondi),
    }));
}

const arrondi = c => Math.round(c * 10 ** DECIMALES) / 10 ** DECIMALES;

/** Le contour extérieur d'un ensemble de polygones qui se touchent. */
function dissoudre(features) {
  const cle = p => `${p[0].toFixed(6)},${p[1].toFixed(6)}`;
  const compte = new Map();
  for (const f of features) {
    const g = f.geometry;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    for (const p of polys) {
      for (const anneau of p) {
        for (let i = 0; i < anneau.length - 1; i++) {
          const a = cle(anneau[i]), b = cle(anneau[i + 1]);
          const k = a < b ? `${a}|${b}` : `${b}|${a}`;
          compte.set(k, (compte.get(k) || 0) + 1);
        }
      }
    }
  }

  const voisins = new Map();
  for (const [k, n] of compte) {
    if (n !== 1) continue;
    const [a, b] = k.split('|');
    if (!voisins.has(a)) voisins.set(a, []);
    if (!voisins.has(b)) voisins.set(b, []);
    voisins.get(a).push(b);
    voisins.get(b).push(a);
  }

  const vus = new Set();
  const anneaux = [];
  for (const depart of voisins.keys()) {
    if (vus.has(depart)) continue;
    const ring = [depart];
    vus.add(depart);
    let courant = depart;
    for (;;) {
      const suite = (voisins.get(courant) || []).find(x => !vus.has(x));
      if (!suite) break;
      vus.add(suite);
      ring.push(suite);
      courant = suite;
    }
    if (ring.length > 8) anneaux.push(ring.map(s => s.split(',').map(Number)));
  }
  return anneaux;
}

/* ─── Douglas-Peucker ─────────────────────────────────────────────── */
const distance = (p, a, b) => {
  const [x, y] = p, [x1, y1] = a, [x2, y2] = b;
  const dx = x2 - x1, dy = y2 - y1;
  if (!dx && !dy) return Math.hypot(x - x1, y - y1);
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
};

function simplifier(pts, tol) {
  if (pts.length < 3) return pts;
  let max = 0, idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = distance(pts[i], pts[0], pts[pts.length - 1]);
    if (d > max) { max = d; idx = i; }
  }
  return max > tol
    ? [...simplifier(pts.slice(0, idx + 1), tol).slice(0, -1), ...simplifier(pts.slice(idx), tol)]
    : [pts[0], pts[pts.length - 1]];
}

const etendue = a => {
  const xs = a.map(p => p[0]), ys = a.map(p => p[1]);
  return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
};

function preparer(anneaux) {
  return anneaux
    .filter(a => etendue(a) > ETENDUE_MIN)
    .map(a => {
      const s = simplifier([...a, a[0]], TOLERANCE).map(p => p.map(arrondi));
      const net = s.filter((p, i) => i === 0 || p[0] !== s[i - 1][0] || p[1] !== s[i - 1][1]);
      const [p0] = net, pn = net[net.length - 1];
      if (p0[0] !== pn[0] || p0[1] !== pn[1]) net.push(p0);
      return net;
    })
    .filter(a => a.length > 6)
    .sort((a, b) => etendue(b) - etendue(a));
}

/* ─── Écriture ────────────────────────────────────────────────────── */
const enLigne = a => `[${a.map(p => `[${p[0]},${p[1]}]`).join(',')}]`;

const M = { code: '972', nom: 'Martinique', enPlus: [] };
const G = { code: '971', nom: 'Guadeloupe', enPlus: ['Basse-Terre'] };

const iles = [];
const noms = [];
for (const d of [M, G]) {
  const anneaux = preparer(dissoudre(await communes(d.code)));
  iles.push({ ...d, anneaux });
  noms.push(...(await villes(d.code, 10000, d.enPlus)));
  console.log(`${d.nom} : ${anneaux.length} anneau(x), ${anneaux.reduce((t, a) => t + a.length, 0)} points`);
}

const fichier = `/* Le fond de carte des Antilles françaises.
 *
 * La Martinique et la Guadeloupe sont des départements français, et l'on y
 * joue au tennis sous la même licence : leurs clubs ont autant leur place
 * sur une carte que ceux de Seine-Maritime. Ils n'y étaient pas, faute
 * d'avoir été demandés — pas faute d'être français.
 *
 * Même forme que \`france.js\` : des anneaux en [longitude, latitude], et des
 * villes avec leur rang d'apparition. Ils s'ajoutent au même tableau et se
 * dessinent par le même code — rien à changer dans la carte, qui cadre
 * toujours sur les clubs et ne sait pas où ils se trouvent.
 *
 * ─── D'où ça vient, et comment le refaire ────────────────────────────
 *
 * De l'API officielle des communes, dissoute en un seul contour par
 * annulation des frontières intérieures. Tout est dans
 * \`outils/antilles.mjs\`, qui régénère ce fichier : tolérance de ${TOLERANCE}°
 * (environ trois cents mètres), coordonnées au millième de degré, îlots de
 * moins de deux kilomètres écartés.
 *
 * Plus fin que la métropole, et pour une raison : une île de soixante
 * kilomètres tient tout entière dans un écran, là où la France n'y entre
 * qu'en perdant ses anses. La tolérance suit ce qu'on regarde.
 *
 * Régénérer : node outils/antilles.mjs
 */

export const ANTILLES = [
${iles.map(i => `  { code: "${i.code}", nom: "${i.nom}", anneaux: [\n${
  i.anneaux.map(a => `    ${enLigne(a)},`).join('\n')}\n  ] },`).join('\n')}
];

/* Les villes de plus de dix mille habitants, plus Basse-Terre : une
   préfecture est un repère même quand elle est petite, et celle-là l'est
   — dix mille habitants, moins que trois communes voisines. */
export const VILLES_ANTILLES = [
${noms.map(v => `  { nom: ${JSON.stringify(v.nom)}, r: ${v.r}, point: [${v.point.join(',')}] },`).join('\n')}
];
`;

writeFileSync('public/js/antilles.js', fichier);
console.log(`public/js/antilles.js écrit — ${noms.length} villes, ${Math.round(fichier.length / 1024)} Ko`);
