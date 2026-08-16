/* Le terrain vu du dessus, cliquable.

   Pourquoi un dessin plutôt qu'une liste de cases à cocher : un conseil de
   tennis parle presque toujours d'un endroit. « Avance d'un mètre »,
   « joue croisé long », « monte derrière ton coup droit » — la liste
   oblige à traduire, le terrain non. Et au changement de côté, viser une
   zone du pouce va plus vite que lire douze libellés.

   Pourquoi un tracé et non une image : le site doit rester autonome hors
   ligne et net sur tous les écrans. Un SVG se colore d'ailleurs tout seul
   avec le thème, ce qu'une photo de court ne ferait pas.

   L'orientation est celle de la caméra derrière le joueur : mon côté en
   bas, l'adversaire en haut. Pour un droitier, le coup droit tombe alors
   à droite de l'image — comme sur le court. Tout s'inverse pour un
   gaucher, et c'est le seul réglage dont le dessin a besoin. */

const G = {
  X0: 20,   X1: 220,      // lignes de couloir (double)
  SX0: 45,  SX1: 195,     // lignes de simple
  Y0: 20,   Y1: 453,      // lignes de fond
  NET: 236.5,
  SVH: 120, SVB: 353,     // lignes de service, haut et bas
  CX: 120,                // ligne médiane
  SERVICE_Y: 458, SERVICE_H: 34,
};

/* Les douze coups. Trois natures, parce qu'un coup n'est pas toujours un
   endroit : une zone se clique sur le terrain, une flèche décrit une
   direction, et ce qui n'a ni l'un ni l'autre reste une pastille. */
export const COUPS = [
  { cle: 'service',        nom: 'Service',        type: 'zone' },
  { cle: 'coup-droit',     nom: 'Coup droit',     type: 'zone' },
  { cle: 'revers',         nom: 'Revers',         type: 'zone' },
  { cle: 'montee',         nom: 'Montée',         type: 'zone' },
  { cle: 'volee',          nom: 'Volée',          type: 'zone' },
  { cle: 'adv-coup-droit', nom: 'Son coup droit', type: 'zone' },
  { cle: 'adv-revers',     nom: 'Son revers',     type: 'zone' },
  { cle: 'croise',         nom: 'Croisé',         type: 'fleche' },
  { cle: 'long-ligne',     nom: 'Long de ligne',  type: 'fleche' },
  { cle: 'lob',            nom: 'Lob',            type: 'pastille', emoji: '🌙' },
  { cle: 'smash',          nom: 'Smash',          type: 'pastille', emoji: '💥' },
  { cle: 'amortie',        nom: 'Amortie',        type: 'pastille', emoji: '🪶' },
];

export const nomCoup = cle => COUPS.find(c => c.cle === cle)?.nom || cle;
export const PASTILLES = COUPS.filter(c => c.type === 'pastille');

/** Les zones, placées selon la main qui tient la raquette.
 *  Seule la position change : « coup droit » reste « coup droit ». */
function zones(gaucher) {
  const droite = { x: G.CX,  w: G.SX1 - G.CX };
  const gauche = { x: G.SX0, w: G.CX - G.SX0 };
  const cd = gaucher ? gauche : droite;
  const rv = gaucher ? droite : gauche;

  return [
    { cle: 'adv-coup-droit', nom: 'Son coup droit',
      x: G.SX0, y: G.Y0, w: G.CX - G.SX0, h: G.SVH - G.Y0 },
    { cle: 'adv-revers', nom: 'Son revers',
      x: G.CX, y: G.Y0, w: G.SX1 - G.CX, h: G.SVH - G.Y0 },
    { cle: 'volee', nom: 'Volée',
      x: G.SX0, y: G.NET + 4, w: G.SX1 - G.SX0, h: 52 },
    { cle: 'montee', nom: 'Montée',
      x: G.SX0, y: G.NET + 58, w: G.SX1 - G.SX0, h: G.SVB - G.NET - 58 },
    { cle: 'coup-droit', nom: 'Coup droit',
      x: cd.x, y: G.SVB, w: cd.w, h: G.Y1 - G.SVB },
    { cle: 'revers', nom: 'Revers',
      x: rv.x, y: G.SVB, w: rv.w, h: G.Y1 - G.SVB },
    { cle: 'service', nom: 'Service',
      x: G.SX0, y: G.SERVICE_Y, w: G.SX1 - G.SX0, h: G.SERVICE_H },
  ];
}

/** Les deux directions, tracées depuis le côté du coup droit — c'est de
 *  là qu'on les pense. */
function fleches(gaucher) {
  const depart = gaucher ? 72 : 168;
  const arrivee = gaucher ? 168 : 72;
  return [
    { cle: 'croise', nom: 'Croisé',
      d: `M ${depart} 400 L ${arrivee} 68`,
      lx: gaucher ? 148 : 92, ly: 210 },
    { cle: 'long-ligne', nom: 'Long de ligne',
      d: `M ${depart} 400 L ${depart} 68`,
      lx: depart, ly: 168 },
  ];
}

const ligne = (x1, y1, x2, y2) =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="t-ligne"/>`;

/**
 * Le terrain en SVG.
 * @param {object} o
 * @param {string[]} [o.selection] les clés des coups actuellement retenus
 * @param {boolean}  [o.gaucher]
 * @param {object}   [o.compte]  nombre de conseils par coup, pour la pastille
 */
export function dessinerTerrain({ selection = [], gaucher = false, compte = {} } = {}) {
  const choisi = c => selection.includes(c) ? ' actif' : '';

  const zonesSVG = zones(gaucher).map(z => {
    const n = compte[z.cle] || 0;
    return `<g class="t-zone${choisi(z.cle)}" data-coup="${z.cle}"
               role="button" tabindex="0" aria-pressed="${selection.includes(z.cle)}">
      <title>${z.nom}${n ? ` — ${n} conseil(s)` : ''}</title>
      <rect x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" rx="3"/>
      <text x="${z.x + z.w / 2}" y="${z.y + z.h / 2 + 4}">${z.nom}</text>
      ${n ? `<circle class="t-compte" cx="${z.x + z.w - 13}" cy="${z.y + 13}" r="9"/>
             <text class="t-compte-txt" x="${z.x + z.w - 13}" y="${z.y + 17}">${n}</text>` : ''}
    </g>`;
  }).join('');

  const flechesSVG = fleches(gaucher).map(f => {
    const n = compte[f.cle] || 0;
    return `<g class="t-fleche${choisi(f.cle)}" data-coup="${f.cle}"
               role="button" tabindex="0" aria-pressed="${selection.includes(f.cle)}">
      <title>${f.nom}${n ? ` — ${n} conseil(s)` : ''}</title>
      <path class="t-fleche-cible" d="${f.d}"/>
      <path class="t-fleche-trait" d="${f.d}" marker-end="url(#pointe)"/>
      <text x="${f.lx}" y="${f.ly}">${f.nom}${n ? ` (${n})` : ''}</text>
    </g>`;
  }).join('');

  return `<svg class="terrain" viewBox="0 0 240 500" role="group"
               aria-label="Terrain de tennis cliquable">
    <defs>
      <marker id="pointe" viewBox="0 0 10 10" refX="9" refY="5"
              markerWidth="5" markerHeight="5" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" class="t-pointe"/>
      </marker>
    </defs>

    <rect class="t-surface" x="${G.X0 - 8}" y="${G.Y0 - 8}"
          width="${G.X1 - G.X0 + 16}" height="${G.Y1 - G.Y0 + 16}" rx="4"/>

    ${zonesSVG}

    <!-- Les lignes par-dessus les zones : elles doivent rester lisibles
         quand une zone est allumée. Elles ne captent pas le clic. -->
    <g class="t-lignes">
      <rect class="t-cadre" x="${G.X0}" y="${G.Y0}"
            width="${G.X1 - G.X0}" height="${G.Y1 - G.Y0}"/>
      ${ligne(G.SX0, G.Y0, G.SX0, G.Y1)}
      ${ligne(G.SX1, G.Y0, G.SX1, G.Y1)}
      ${ligne(G.SX0, G.SVH, G.SX1, G.SVH)}
      ${ligne(G.SX0, G.SVB, G.SX1, G.SVB)}
      ${ligne(G.CX, G.SVH, G.CX, G.SVB)}
      ${ligne(G.CX, G.Y0, G.CX, G.Y0 + 10)}
      ${ligne(G.CX, G.Y1 - 10, G.CX, G.Y1)}
      <line class="t-filet" x1="${G.X0 - 8}" y1="${G.NET}"
            x2="${G.X1 + 8}" y2="${G.NET}"/>
    </g>

    ${flechesSVG}
  </svg>`;
}

/** Le terrain et ses pastilles, d'un bloc. Les deux écrans qui s'en
 *  servent — noter un conseil, le retrouver en match — affichent
 *  exactement le même dessin : ce qui a servi à ranger sert à chercher. */
export function blocTerrain({ selection = [], gaucher = false, compte = {} } = {}) {
  const pastilles = PASTILLES.map(p => {
    const n = compte[p.cle] || 0;
    return `<button type="button" class="pastille ${selection.includes(p.cle) ? 'actif' : ''}"
              data-coup="${p.cle}" aria-pressed="${selection.includes(p.cle)}">
      ${p.emoji} ${p.nom}${n ? ` <span class="tiny">(${n})</span>` : ''}</button>`;
  }).join('');

  return `<div class="terrain-bloc">
    ${dessinerTerrain({ selection, gaucher, compte })}
    <div class="pastilles" style="justify-content:center;margin-top:10px">${pastilles}</div>
  </div>`;
}

/** Branche les clics d'un terrain déjà inséré dans la page.
 *  `onChoix(cle)` est appelé à chaque zone, flèche ou pastille touchée. */
export function brancherTerrain(racine, onChoix) {
  const activer = e => {
    const cible = e.target.closest('[data-coup]');
    if (!cible) return;
    e.preventDefault();
    onChoix(cible.dataset.coup);
  };
  racine.addEventListener('click', activer);
  racine.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') activer(e);
  });
}
