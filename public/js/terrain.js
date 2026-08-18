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
  /* Le banc déborde du terrain : le cadrage s'élargit vers la gauche
     plutôt que de le poser sur le court, où il n'a rien à faire. */
  BANC_X: -34,
};

/* Les douze coups. Trois natures, parce qu'un coup n'est pas toujours un
   endroit : une zone se clique sur le terrain, une flèche décrit une
   direction, et ce qui n'a ni l'un ni l'autre reste une pastille. */
export const COUPS = [
  /* Le service se joue deux fois, et pas de la même façon : le premier
     cherche le point, le second cherche le carré. Deux zones, donc, parce
     que ce sont deux moments dont on ne se dit pas les mêmes choses.

     L'ancienne clé « service » reste dans le vocabulaire : elle n'a plus
     de zone au dessin, mais les conseils déjà notés sous ce nom gardent
     leur étiquette lisible au lieu d'afficher un code. */
  { cle: 'service',        nom: 'Service',        type: 'ancien' },
  { cle: 'service-1',      nom: '1er service',    type: 'zone' },
  { cle: 'service-2',      nom: '2e service',     type: 'zone' },
  /* Le banc n'est pas un coup, et c'est justement pourquoi il manquait.
     Quatre-vingt-dix secondes assis décident souvent de la suite : boire,
     souffler, décider d'une tactique. Un conseil sur le repos n'avait
     nulle part où se ranger. */
  { cle: 'banc',           nom: 'Le banc',        type: 'zone' },
  { cle: 'coup-droit',     nom: 'Coup droit',     type: 'zone' },
  { cle: 'revers',         nom: 'Revers',         type: 'zone' },
  { cle: 'montee',         nom: 'Montée',         type: 'zone' },
  { cle: 'volee',          nom: 'Volée',          type: 'zone' },
  { cle: 'adv-coup-droit', nom: 'Son coup droit', type: 'zone' },
  { cle: 'adv-revers',     nom: 'Son revers',     type: 'zone' },
  { cle: 'croise',         nom: 'Croisé long',    type: 'fleche' },
  /* Le croisé court n'est pas un croisé plus faible : c'est un autre
     coup, qui sort l'adversaire du court par le côté au lieu de le
     repousser au fond. Il méritait sa flèche. */
  { cle: 'croise-court',   nom: 'Croisé court',   type: 'fleche' },
  { cle: 'long-ligne',     nom: 'Long de ligne',  type: 'fleche' },
  /* Les trajectoires se voient de profil et non du dessus : une amortie
     et un lob tombent au même endroit vus d'en haut, et n'ont rien à voir.
     D'où la seconde vue, et ce troisième type. */
  { cle: 'lob',            nom: 'Lob',            type: 'profil', emoji: '🌙' },
  { cle: 'amortie',        nom: 'Amortie',        type: 'profil', emoji: '🪶' },
  { cle: 'smash',          nom: 'Smash',          type: 'profil', emoji: '💥' },
  { cle: 'lift',           nom: 'Lifté',          type: 'profil', emoji: '🌀' },
  { cle: 'plat',           nom: 'À plat',         type: 'profil', emoji: '➡️' },
  { cle: 'slice',          nom: 'Slice',          type: 'profil', emoji: '🪃' },
];

export const nomCoup = cle => COUPS.find(c => c.cle === cle)?.nom || cle;
export const PASTILLES = COUPS.filter(c => c.type === 'pastille');
export const PROFILS_COUPS = COUPS.filter(c => c.type === 'profil');

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
    /* Le bandeau du service coupé en deux : à gauche le premier, à droite
       le second, dans l'ordre où ils se jouent. */
    { cle: 'service-1', nom: '1er service', court: '1er',
      x: G.SX0, y: G.SERVICE_Y, w: (G.SX1 - G.SX0) / 2 - 3, h: G.SERVICE_H },
    { cle: 'service-2', nom: '2e service', court: '2e',
      x: G.SX0 + (G.SX1 - G.SX0) / 2 + 3, y: G.SERVICE_Y,
      w: (G.SX1 - G.SX0) / 2 - 3, h: G.SERVICE_H },
    /* Le banc est à sa place réelle : sur le côté, au niveau du filet.
       C'est là qu'on s'assoit au changement de côté, et le dessin ne
       servirait à rien s'il le mettait ailleurs. */
    { cle: 'banc', nom: 'Le banc',
      x: G.BANC_X, y: G.NET - 34, w: 26, h: 68, vertical: true },
  ];
}

/** Où poser le nom d'une flèche, et sous quel angle.
 *
 *  Écrit en travers, un nom occupe la largeur du court et croise tout ce
 *  qui passe. Écrit dans le sens de la flèche, il tient dans la bande que
 *  la flèche occupe déjà : c'est la règle des noms de rue sur un plan, et
 *  elle ne coûte rien.
 *
 *  @param {number[]} pt     le point de la flèche où poser le nom
 *  @param {number[]} sens   la direction de la flèche à cet endroit
 *  @param {number}   ecart  de combien s'écarter du trait, à sa droite
 *  @param {boolean}  gaucher pour un gaucher, le dessin est en miroir :
 *                    la droite de la flèche devient sa gauche.
 */
function leLongDe([x, y], [dx, dy], ecart, gaucher) {
  const norme = Math.hypot(dx, dy);
  /* La perpendiculaire à droite du sens de marche. En SVG l'axe des y
     descend, donc (-dy, dx) pointe bien à droite et non à gauche. */
  const nx = -dy / norme, ny = dx / norme;
  const e = gaucher ? -ecart : ecart;

  /* L'angle, ramené entre -90 et 90 : au-delà, le texte se lirait la tête
     en bas. Une flèche qui monte vers la gauche porte donc un nom qui se
     lit vers le bas à droite — le long du même trait. */
  let rot = Math.atan2(dy, dx) * 180 / Math.PI;
  if (rot > 90) rot -= 180;
  if (rot < -90) rot += 180;

  return { lx: +(x + nx * e).toFixed(1), ly: +(y + ny * e).toFixed(1),
           rot: +rot.toFixed(1) };
}

/** Les deux directions, tracées depuis le côté du coup droit — c'est de
 *  là qu'on les pense. */
function fleches(gaucher) {
  const depart = gaucher ? 72 : 168;
  const arrivee = gaucher ? 168 : 72;
  /* Le croisé court meurt dans le carré de service, près du couloir :
     c'est ce qui le distingue du croisé long, et ce qui sort l'adversaire
     du court. Sa flèche s'arrête donc là où la balle tombe. */
  const courtX = gaucher ? 186 : 54;

  /* Le croisé court est une courbe : son sens change en chemin, et le nom
     suit la tangente à l'endroit où il se pose plutôt que la corde. */
  const milieuX = (depart + courtX) / 2;
  const t = 0.72;
  const bezier = (a, b, c) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * b + t * t * c;
  const tangente = (a, b, c) => 2 * (1 - t) * (b - a) + 2 * t * (c - b);

  return [
    { cle: 'croise', nom: 'Croisé long',
      d: `M ${depart} 400 L ${arrivee} 68`,
      ...leLongDe([depart + (arrivee - depart) * 0.5, 234],
                  [arrivee - depart, -332], 11, gaucher) },
    { cle: 'croise-court', nom: 'Croisé court',
      d: `M ${depart} 400 Q ${milieuX} 300 ${courtX} 190`,
      ...leLongDe([bezier(depart, milieuX, courtX), bezier(400, 300, 190)],
                  [tangente(depart, milieuX, courtX), tangente(400, 300, 190)],
                  /* De l'autre côté du trait que le croisé long : les deux
                     flèches partent du même coin, et un nom posé entre
                     elles se fait traverser par l'autre. */
                  -14, gaucher) },
    { cle: 'long-ligne', nom: 'Long de ligne',
      d: `M ${depart} 400 L ${depart} 68`,
      ...leLongDe([depart, 150], [0, -332], 15, gaucher) },
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

  /* ─── Pourquoi les noms sont dessinés à part ────────────────────────

     Un SVG se peint dans l'ordre du document : les flèches, écrites après
     les zones, passaient donc par-dessus leurs noms. « Son coup droit »
     et « Son revers » se retrouvaient barrés d'un trait, et le liseré
     posé sous les lettres n'y pouvait rien — il ne protège que de ce qui
     est peint avant.

     Les noms sont donc rassemblés ici et posés en dernier, au-dessus de
     tout. Chaque nom garde les classes de son groupe (`t-zone actif`,
     `t-fleche actif`) : la mise en couleur du coup choisi et l'estompage
     des autres continuent de s'appliquer, sans qu'on ait à les redire.
     La couche ne capte aucun clic : les zones et les flèches restent
     seules à répondre, exactement comme avant. */
  const etiquettes = [];

  const zonesSVG = zones(gaucher).map(z => {
    const n = compte[z.cle] || 0;
    const cx = z.x + z.w / 2, cy = z.y + z.h / 2;
    /* Une zone étroite ne peut pas porter son nom en travers : le banc
       fait vingt-six unités de large pour sept lettres. On l'écrit dans
       le sens de la zone, comme sur un plan. */
    const nom = z.vertical
      ? `<text x="${cx}" y="${cy}" transform="rotate(-90 ${cx} ${cy})">${z.nom}</text>`
      : `<text x="${cx}" y="${cy + 4}">${z.court || z.nom}</text>`;

    /* La pastille du compte se pose dans un coin où le nom ne passe pas.
       Dans une grande zone, le coin haut-droit est libre ; dans une zone
       basse — les deux bandeaux de service — le nom occupe toute la
       hauteur et la pastille mordrait dessus. Elle se met alors dehors,
       au-dessus, plutôt que de rendre le libellé illisible. */
    const petite = z.h < 46;
    const bx = z.vertical ? z.x + z.w - 9 : z.x + z.w - 11;
    const by = petite || z.vertical ? z.y - 3 : z.y + 13;
    const r = petite || z.vertical ? 8 : 9;

    etiquettes.push(`<g class="t-zone${choisi(z.cle)}">
      ${nom}
      ${n ? `<circle class="t-compte" cx="${bx}" cy="${by}" r="${r}"/>
             <text class="t-compte-txt" x="${bx}" y="${by + 4}">${n}</text>` : ''}
    </g>`);

    return `<g class="t-zone${choisi(z.cle)}" data-coup="${z.cle}"
               role="button" tabindex="0" aria-pressed="${selection.includes(z.cle)}">
      <title>${z.nom}${n ? ` — ${n} conseil(s)` : ''}</title>
      <rect x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" rx="3"/>
    </g>`;
  }).join('');

  const flechesSVG = fleches(gaucher).map(f => {
    const n = compte[f.cle] || 0;
    etiquettes.push(`<g class="t-fleche${choisi(f.cle)}">
      <text x="${f.lx}" y="${f.ly}"
            transform="rotate(${f.rot} ${f.lx} ${f.ly})">${f.nom}${
        n ? ` (${n})` : ''}</text>
    </g>`);

    return `<g class="t-fleche${choisi(f.cle)}" data-coup="${f.cle}"
               role="button" tabindex="0" aria-pressed="${selection.includes(f.cle)}">
      <title>${f.nom}${n ? ` — ${n} conseil(s)` : ''}</title>
      <path class="t-fleche-cible" d="${f.d}"/>
      <path class="t-fleche-halo" d="${f.d}"/>
      <path class="t-fleche-trait" d="${f.d}" marker-end="url(#pointe)"/>
    </g>`;
  }).join('');

  return `<svg class="terrain" viewBox="-40 0 280 500" role="group"
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

    <g class="t-etiquettes" aria-hidden="true">${etiquettes.join('')}</g>
  </svg>`;
}


/* ─── Le court vu de côté ──────────────────────────────────────────────

   Le dessin du dessus dit *où* la balle tombe. Il ne dit rien de ce
   qu'elle fait en chemin — or une amortie et un lob tombent quasiment au
   même endroit vus d'en haut, et n'ont rien à voir. La hauteur, c'est
   l'autre moitié du tennis, et elle ne se voit que de profil.

   Six trajectoires, tracées depuis le même point de frappe pour qu'on les
   compare : c'est l'écart entre les courbes qui enseigne, pas chaque
   courbe prise seule. Le service part de plus haut, parce qu'il part de
   plus haut.

   Les proportions ne sont pas celles d'un vrai court — un terrain fait
   vingt-quatre mètres de long pour un filet d'un mètre, ce qui donnerait
   un trait plat où l'on ne verrait rien. La hauteur est donc exagérée,
   comme sur tous les schémas de tennis, et pour la même raison : on
   dessine ce qu'il faut comprendre, pas ce qu'on mesurerait. */
const P = {
  SOL: 96,          // la ligne de terre
  X0: 16, X1: 232,  // les deux fonds de court
  FILET: 124,       // le filet, entre les deux
  HAUT_FILET: 70,   // son sommet
  FRAPPE_X: 30, FRAPPE_Y: 62,
};

const TRAJECTOIRES = [
  /* Chaque courbe est une cubique et non un arc simple : une amortie
     monte doucement puis plonge, ce qu'une parabole ne sait pas faire —
     elle retombe aussi vite qu'elle est montée. La forme du coup est
     précisément ce qu'on vient regarder ici.

     Toutes ont été vérifiées au passage du filet, où l'erreur ne pardonne
     pas : dans la première version, le slice et l'amortie le traversaient.
     Un schéma qui fait passer la balle à travers le filet n'enseigne pas,
     il désapprend. Les gardes retenues vont de quatre unités pour
     l'amortie — juste ce qu'il faut — à soixante-quatre pour le lob.

     Les noms ne sont pas posés à la main : chacun est calculé à l'endroit
     où sa courbe est le plus éloignée de toutes les autres. C'est le seul
     point où une étiquette ne peut désigner qu'elle. */
  { cle: 'lob', nom: "Lob",
    d: 'M 30 62 C 78 -26, 168 -8, 212 88',
    lx: 147, ly: 9, ancre: 'middle' },
  { cle: 'lift', nom: "Lifté",
    d: 'M 30 62 C 88 22, 162 42, 204 90',
    lx: 155, ly: 49, ancre: 'middle' },
  { cle: 'smash', nom: "Smash",
    d: 'M 100 18 C 124 40, 152 64, 178 92',
    lx: 110, ly: 22, ancre: 'middle' },
  { cle: 'service', nom: "Service",
    d: 'M 22 24 C 68 28, 108 48, 152 86',
    lx: 40, ly: 21, ancre: 'start' },
  { cle: 'plat', nom: "À plat",
    d: 'M 30 62 C 92 48, 162 60, 214 88',
    lx: 167, ly: 63, ancre: 'middle' },
  { cle: 'slice', nom: "Slice",
    d: 'M 30 62 C 88 54, 148 62, 196 93',
    lx: 183, ly: 80, ancre: 'end' },
  { cle: 'amortie', nom: "Amortie",
    d: 'M 30 62 C 70 38, 104 34, 148 93',
    lx: 85, ly: 41, ancre: 'middle' },
];

/**
 * Le court de profil, avec ses trajectoires cliquables.
 * Même contrat que le terrain vu du dessus : une sélection, des comptes.
 */
export function dessinerProfil({ selection = [], compte = {} } = {}) {
  const traces = TRAJECTOIRES.map(t => {
    const n = compte[t.cle] || 0;
    const actif = selection.includes(t.cle) ? ' actif' : '';
    return `<g class="p-trajet${actif}" data-coup="${t.cle}"
               role="button" tabindex="0" aria-pressed="${selection.includes(t.cle)}">
      <title>${t.nom}${n ? ` — ${n} conseil(s)` : ''}</title>
      <path class="p-cible" d="${t.d}"/>
      <path class="p-halo" d="${t.d}"/>
      <path class="p-trait" d="${t.d}" marker-end="url(#pointe)"/>
      <text x="${t.lx}" y="${t.ly}" text-anchor="${t.ancre}"
        >${t.nom}${n ? ` (${n})` : ''}</text>
    </g>`;
  }).join('');

  return `<svg class="terrain-profil" viewBox="0 -6 248 112" role="group"
               aria-label="Trajectoires de balle, vues de côté">
    <rect class="t-surface" x="${P.X0 - 6}" y="${P.SOL - 2}"
          width="${P.X1 - P.X0 + 12}" height="8" rx="2"/>
    <line class="p-sol" x1="${P.X0 - 6}" y1="${P.SOL}" x2="${P.X1 + 6}" y2="${P.SOL}"/>
    ${/* Les lignes de service, marquées au sol : elles disent où le service
          doit tomber, et donnent l'échelle du demi-court. */''}
    <line class="p-service" x1="${P.FILET - 58}" y1="${P.SOL - 4}"
          x2="${P.FILET - 58}" y2="${P.SOL + 4}"/>
    <line class="p-service" x1="${P.FILET + 58}" y1="${P.SOL - 4}"
          x2="${P.FILET + 58}" y2="${P.SOL + 4}"/>
    <line class="p-filet" x1="${P.FILET}" y1="${P.HAUT_FILET}" x2="${P.FILET}" y2="${P.SOL}"/>
    ${/* ─── Le joueur ────────────────────────────────────────────────

          Un pictogramme à membres épais et bouts arrondis, dans la manière
          des panneaux de gymnase : tête ronde détachée, tronc et membres
          d'une même épaisseur, raquette au cadre ovale. C'est le style qui
          se lit le plus petit — c'est d'ailleurs pour ça qu'on le trouve
          sur les panneaux — et il tient à la taille d'un timbre, ce qui
          est exactement la taille qu'il occupe ici.

          La forme naît des épaisseurs de trait, non d'un contour fermé :
          six segments et deux ovales, là où une silhouette découpée
          demandait vingt-cinq coordonnées qu'aucun humain ne pouvait
          relire.

          Il est en position de frappe, bras tendu, et la raquette tombe
          exactement au départ des sept courbes — c'est ce point-là qui
          justifie sa présence, pas le décor. */''}
    <g class="p-joueur">
      <circle class="p-tete" cx="13.6" cy="67.4" r="3.9"/>
      ${/* Le tronc, des épaules aux hanches. */''}
      <path class="p-membre" d="M 13.8 72 L 13.8 83.4"/>
      ${/* Les jambes : appui arrière tendu, appui avant fléchi. */''}
      <path class="p-membre" d="M 13.8 83.4 L 10.4 95.2"/>
      <path class="p-membre" d="M 13.8 83.4 L 19.4 89.8 L 18.6 95.2"/>
      ${/* Le bras libre, qui équilibre. */''}
      <path class="p-membre" d="M 13.8 74 L 8.2 78.6"/>
      ${/* Le bras porteur, jusqu'au point de frappe. */''}
      <path class="p-membre" d="M 13.8 73.6 L 23.4 68.6"/>
      ${/* La raquette : un cadre ovale et un manche, rien de plus. */''}
      ${/* La raquette se tient. Le manche part de la main — le bout du
            bras, et non un point voisin — et le tamis se trouve au-delà,
            centré sur le point de frappe. Auparavant le cadre pivotait
            autour de son centre sans que le manche rejoigne quoi que ce
            soit : la raquette flottait à côté du joueur. */''}
      <line class="p-manche" x1="23.4" y1="68.6"
            x2="${P.FRAPPE_X - 2.4}" y2="${P.FRAPPE_Y + 2.6}"/>
      <ellipse class="p-cadre" cx="${P.FRAPPE_X}" cy="${P.FRAPPE_Y}"
               rx="3.2" ry="4.3"
               transform="rotate(-46 ${P.FRAPPE_X} ${P.FRAPPE_Y})"/>
    </g>
    </g>
    ${traces}
  </svg>`;
}

/** Le terrain et ses pastilles, d'un bloc. Les deux écrans qui s'en
 *  servent — noter un conseil, le retrouver en match — affichent
 *  exactement le même dessin : ce qui a servi à ranger sert à chercher. */
/** Les coups en toutes lettres, à côté de leur dessin.
 *
 *  Le dessin dit tout, à condition de savoir le lire : entre deux zones
 *  voisines et trois flèches parties du même coin, on cherche parfois ce
 *  qu'on nomme très bien. La liste dit les mêmes coups par leur nom et se
 *  sélectionne pareil — le dessin s'allume quand on touche un nom, le nom
 *  s'allume quand on touche le dessin.
 *
 *  Chaque liste reste auprès de la vue qu'elle commande : ce qui se voit
 *  d'en haut à côté du plan, les trajectoires sous la vue de profil. Une
 *  liste unique en bas obligeait à chercher, pour chaque nom, laquelle des
 *  deux vues allait s'allumer.
 */
export function listeCoups({ selection = [], compte = {}, groupes = [] } = {}) {
  return groupes.map(([titre, types]) => {
    const liste = COUPS.filter(c => types.includes(c.type));
    if (!liste.length) return '';

    /* Replié par défaut, et déplié tout seul quand il contient le coup
       retenu : dix-huit pastilles étalées repoussaient le dessin hors de
       l'écran, alors qu'on vient sur cette page pour le dessin. Un
       `<details>` plutôt qu'un bouton et une classe : le navigateur sait
       déjà ouvrir et fermer, annoncer l'état aux lecteurs d'écran, et
       retrouver le contenu quand on cherche dans la page.

       Le nombre de conseils du groupe est écrit sur le titre : replié, il
       faut bien savoir s'il y a quelque chose dessous. */
    const dedans = liste.some(c => selection.includes(c.cle));
    const n = liste.reduce((t, c) => t + (compte[c.cle] || 0), 0);

    return `<details class="terrain-coups${dedans ? ' choisi' : ''}"${dedans ? ' open' : ''}>
      <summary class="terrain-coups-titre">${titre}${
        n ? `<span class="pastille-nb">${n}</span>` : ''}</summary>
      <div class="pastilles">
        ${liste.map(c => `<button data-coup="${c.cle}"
          class="pastille ${selection.includes(c.cle) ? 'actif' : ''}">${
            c.emoji ? c.emoji + ' ' : ''}${c.nom}${
            compte[c.cle] ? `<span class="pastille-nb">${compte[c.cle]}</span>` : ''
          }</button>`).join('')}
      </div>
    </details>`;
  }).join('');
}
export function blocTerrain({ selection = [], gaucher = false, compte = {} } = {}) {
  /* Les deux vues d'un même court, l'une sous l'autre : du dessus pour
     savoir où, de profil pour savoir comment. Elles partagent leur
     sélection — toucher « amortie » en bas allume le même filtre que
     toucher une zone en haut — parce que ce sont les mêmes conseils
     qu'on cherche. */
  /* Dès qu'un coup est retenu, le bloc entier le sait : le reste
     s'estompe pour que le trait choisi se détache. Sept trajectoires qui
     se croisent, toutes de la même couleur, ne se distinguent que par
     l'extinction des autres — surligner la bonne ne suffit pas quand elle
     passe derrière trois voisines. */
  return `<div class="terrain-bloc${selection.length ? ' a-choix' : ''}">
    ${/* Le plan et ce qui le commande, côte à côte dès que l'écran le
          permet. En dessous de quoi la liste passe sous le plan : à trois
          cent cinquante pixels de large, une colonne de pastilles à côté
          d'un court n'est ni l'un ni l'autre. */''}
    <div class="terrain-dessus">
      <div class="terrain-vue">
        ${dessinerTerrain({ selection, gaucher, compte })}
        <p class="tiny muted terrain-aide">Vue de dessus : où la balle tombe.</p>
      </div>
      <div class="terrain-cote">
        ${listeCoups({ selection, compte,
                       groupes: [['Sur le court', ['zone']], ['Directions', ['fleche']]] })}
      </div>
    </div>

    ${dessinerProfil({ selection, compte })}
    <p class="tiny muted terrain-aide">Vue de côté : ce qu'elle fait en chemin.
      Les hauteurs sont exagérées — un vrai court donnerait un trait plat.</p>
    ${listeCoups({ selection, compte, groupes: [['Trajectoires', ['profil']]] })}
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
