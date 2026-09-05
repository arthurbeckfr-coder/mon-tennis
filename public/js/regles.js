/* Les règles du jeu, en images et en trois lignes.

   ─── Ce qu'on vient y chercher ───────────────────────────────────────

   Jamais le règlement. Trois questions, toujours les mêmes, et toujours
   au bord du court : « le filet est à combien ? », « le couloir compte en
   double ou pas ? », « on change de côté quand ? ». Le règlement fédéral
   y répond en quarante pages, ce qui revient à ne pas y répondre quand on
   a une raquette dans la main.

   D'où un plan coté et des fiches de trois lignes. Ce qui se mesure est
   dessiné — un chiffre sur une image se retient, une phrase sur une
   distance se relit trois fois. Ce qui se raconte est écrit court.

   ─── Ce qu'on n'y met pas ────────────────────────────────────────────

   Rien d'inventé et rien d'approché. Les cotes sont celles des Règles du
   jeu de la Fédération internationale, reprises par la FFT : elles ne
   bougent pas, et c'est bien pour cela qu'on peut les écrire dans une
   page. Tout le reste — les cas tordus, les balles de reprise, le
   règlement d'une épreuve — renvoie au texte officiel, en lien : mieux
   vaut deux clics vers la bonne réponse qu'un résumé qui se trompe.
*/

import { h } from './util.js';

/* ─── Le plan coté ─────────────────────────────────────────────────────

   Un demi-court vu de dessus, à l'échelle. Les cotes sont posées en SVG
   plutôt qu'en HTML par-dessus : ici le dessin garde ses proportions —
   pas de `preserveAspectRatio="none"` —, donc le texte ne se déforme pas
   et peut vivre dedans.

   Toutes les mesures viennent des Règles du jeu (FFT / ITF), en mètres :
   23,77 de long, 8,23 de large en simple, 10,97 en double, service à 6,40
   du filet, filet à 0,914 au centre et 1,07 aux poteaux. */

const L_DOUBLE = 10.97;
const L_SIMPLE = 8.23;
const LONGUEUR = 23.77;
const SERVICE = 6.40;

/** Le plan, vu de dessus, coté. */
function planCote() {
  /* Marges en mètres, pour que les cotes tiennent autour du court. Celle
     du bas est plus large que celle du haut : la cote du simple s'écrit
     sous son trait, et se faisait couper par le bord du dessin. */
  const mx = 3.2, myHaut = 2.6, myBas = 3.8;
  const W = L_DOUBLE + mx * 2, H = LONGUEUR + myHaut + myBas;
  const x0 = mx, y0 = myHaut;
  const cx = x0 + L_DOUBLE / 2;
  const couloir = (L_DOUBLE - L_SIMPLE) / 2;

  /* Une cote : un trait à embouts et son nombre. Horizontale ou
     verticale — deux cas suffisent, et les écrire séparément coûte moins
     qu'une fonction qui saurait tout faire. */
  const coteH = (y, xa, xb, texte, dessus = true) => `
    <g class="regle-cote">
      <line x1="${xa}" y1="${y}" x2="${xb}" y2="${y}"/>
      <line x1="${xa}" y1="${y - 0.35}" x2="${xa}" y2="${y + 0.35}"/>
      <line x1="${xb}" y1="${y - 0.35}" x2="${xb}" y2="${y + 0.35}"/>
      <text x="${(xa + xb) / 2}" y="${y + (dessus ? -0.6 : 1.35)}">${h(texte)}</text>
    </g>`;

  /* `ou` place le nombre le long du trait, en fraction de sa longueur.
     La longueur du court se cotait au milieu, c'est-à-dire à hauteur du
     filet — là même où passe le débord de 0,91 m : les deux nombres se
     chevauchaient. Un quart plus haut, ils ne se voient plus. */
  const coteV = (x, ya, yb, texte, ou = 0.5) => {
    const yt = ya + (yb - ya) * ou;
    return `
    <g class="regle-cote">
      <line x1="${x}" y1="${ya}" x2="${x}" y2="${yb}"/>
      <line x1="${x - 0.35}" y1="${ya}" x2="${x + 0.35}" y2="${ya}"/>
      <line x1="${x - 0.35}" y1="${yb}" x2="${x + 0.35}" y2="${yb}"/>
      <text x="${x}" y="${yt}" transform="rotate(-90 ${x} ${yt})">${h(texte)}</text>
    </g>`;
  };

  return `<svg class="regle-plan" viewBox="0 0 ${W} ${H}" role="img"
       aria-label="Plan coté d'un court de tennis">
    ${/* Le sol, puis les lignes. Le court est peint d'un bloc : c'est la
          couleur qui dit « terrain », les traits disent les règles. */''}
    <rect class="regle-sol" x="${x0}" y="${y0}" width="${L_DOUBLE}" height="${LONGUEUR}"/>

    ${/* Les lignes de simple, les couloirs, le service, la marque du
          centre. Toutes à la même épaisseur d'écran : sur un vrai court
          elles font entre 2,5 et 10 cm, ce qu'aucun écran ne montre. */''}
    <g class="regle-lignes">
      <rect x="${x0}" y="${y0}" width="${L_DOUBLE}" height="${LONGUEUR}"/>
      <line x1="${x0 + couloir}" y1="${y0}" x2="${x0 + couloir}" y2="${y0 + LONGUEUR}"/>
      <line x1="${x0 + couloir + L_SIMPLE}" y1="${y0}"
            x2="${x0 + couloir + L_SIMPLE}" y2="${y0 + LONGUEUR}"/>
      <line x1="${x0 + couloir}" y1="${y0 + LONGUEUR / 2 - SERVICE}"
            x2="${x0 + couloir + L_SIMPLE}" y2="${y0 + LONGUEUR / 2 - SERVICE}"/>
      <line x1="${x0 + couloir}" y1="${y0 + LONGUEUR / 2 + SERVICE}"
            x2="${x0 + couloir + L_SIMPLE}" y2="${y0 + LONGUEUR / 2 + SERVICE}"/>
      <line x1="${cx}" y1="${y0 + LONGUEUR / 2 - SERVICE}"
            x2="${cx}" y2="${y0 + LONGUEUR / 2 + SERVICE}"/>
      <line x1="${cx}" y1="${y0}" x2="${cx}" y2="${y0 + 0.3}"/>
      <line x1="${cx}" y1="${y0 + LONGUEUR - 0.3}" x2="${cx}" y2="${y0 + LONGUEUR}"/>
    </g>

    ${/* Le filet, en travers, et débordant de chaque côté : ses poteaux
          sont à 0,914 m en dehors du court de double, ce qui explique
          qu'il dépasse — et pourquoi une balle peut passer à côté. */''}
    <g class="regle-filet">
      <line x1="${x0 - 0.914}" y1="${y0 + LONGUEUR / 2}"
            x2="${x0 + L_DOUBLE + 0.914}" y2="${y0 + LONGUEUR / 2}"/>
      <circle cx="${x0 - 0.914}" cy="${y0 + LONGUEUR / 2}" r="0.28"/>
      <circle cx="${x0 + L_DOUBLE + 0.914}" cy="${y0 + LONGUEUR / 2}" r="0.28"/>
    </g>

    ${/* Les carrés de service, teintés : c'est la zone dont on parle le
          plus, et la nommer d'un mot évite une flèche de plus. */''}
    <text class="regle-mot" x="${x0 + couloir + L_SIMPLE / 4}"
      y="${y0 + LONGUEUR / 2 - SERVICE / 2}">carré</text>
    <text class="regle-mot" x="${x0 + couloir + L_SIMPLE / 4}"
      y="${y0 + LONGUEUR / 2 - SERVICE / 2 + 1.2}">de service</text>
    <text class="regle-mot" x="${x0 + couloir / 2}" y="${y0 + LONGUEUR / 4}"
      transform="rotate(-90 ${x0 + couloir / 2} ${y0 + LONGUEUR / 4})">couloir</text>

    ${coteH(y0 - 1.2, x0, x0 + L_DOUBLE, '10,97 m — double')}
    ${coteH(y0 + LONGUEUR + 1.2, x0 + couloir, x0 + couloir + L_SIMPLE, '8,23 m — simple', false)}
    ${coteV(x0 - 1.5, y0, y0 + LONGUEUR, '23,77 m', 0.24)}
    ${coteV(x0 + L_DOUBLE + 1.5, y0 + LONGUEUR / 2 - SERVICE, y0 + LONGUEUR / 2, '6,40 m')}
    ${coteH(y0 + LONGUEUR / 2 - 0.9, x0 - 0.914, x0, '0,91 m')}
  </svg>`;
}

/** Le filet vu de face : la seule cote qu'un plan de dessus ne peut pas
 *  porter, et c'est celle qu'on demande le plus. */
function filetDeFace() {
  const W = 14, H = 4;
  const y = 2.7;                     // le sol
  const gauche = 1, droite = W - 1;
  const hPoteau = 1.07, hCentre = 0.914;
  const ech = 1.55;                  // les hauteurs sont grandies pour se voir

  const yh = m => y - m * ech;
  const cx = (gauche + droite) / 2;

  return `<svg class="regle-plan regle-filet-face" viewBox="0 0 ${W} ${H}" role="img"
       aria-label="Hauteur du filet, vue de face">
    <line class="regle-sol-trait" x1="0.2" y1="${y}" x2="${W - 0.2}" y2="${y}"/>
    <g class="regle-filet">
      <line x1="${gauche}" y1="${y}" x2="${gauche}" y2="${yh(hPoteau)}"/>
      <line x1="${droite}" y1="${y}" x2="${droite}" y2="${yh(hPoteau)}"/>
      ${/* La bande s'affaisse au centre : c'est une chaînette, pas un
            triangle. Une courbe de Bézier en donne la forme d'un trait. */''}
      <path class="regle-bande" d="M${gauche} ${yh(hPoteau)}
        Q${cx} ${yh(hCentre) + (yh(hCentre) - yh(hPoteau)) * 0.9}
        ${droite} ${yh(hPoteau)}"/>
    </g>
    <g class="regle-cote">
      <line x1="${gauche - 0.55}" y1="${y}" x2="${gauche - 0.55}" y2="${yh(hPoteau)}"/>
      <line x1="${gauche - 0.85}" y1="${y}" x2="${gauche - 0.25}" y2="${y}"/>
      <line x1="${gauche - 0.85}" y1="${yh(hPoteau)}" x2="${gauche - 0.25}" y2="${yh(hPoteau)}"/>
      ${/* Aligné à gauche et non centré : centré sur le poteau, le texte
            sortait du cadre par la gauche et se faisait couper. */''}
      <text class="a-gauche" x="${gauche + 0.35}" y="${yh(hPoteau) - 0.42}"
        >1,07 m aux poteaux</text>
      <line x1="${cx}" y1="${y}" x2="${cx}" y2="${yh(hCentre)}"/>
      <line x1="${cx - 0.3}" y1="${yh(hCentre)}" x2="${cx + 0.3}" y2="${yh(hCentre)}"/>
      <text x="${cx}" y="${y + 0.75}">0,914 m au centre</text>
    </g>
  </svg>`;
}

/* ─── Ce qui se raconte ────────────────────────────────────────────────

   Des fiches courtes, repliées. L'ordre n'est pas celui du règlement mais
   celui des questions : ce qu'on demande le plus vient en premier. */

const FICHES = [
  {
    titre: 'Le couloir, en simple et en double',
    corps: `<p>En <strong>simple</strong>, le couloir est dehors : le court fait
      8,23 m de large. En <strong>double</strong>, il est dedans, sauf au service.</p>
    <p><strong>Au service, jamais</strong> — dans les deux cas, la balle doit tomber
      dans le carré, couloir exclu. Une fois le service réussi, l'échange se joue
      couloirs compris en double.</p>`,
  },
  {
    titre: 'Le service',
    corps: `<p>Deux balles. Le serveur se place derrière la ligne de fond, entre la
      marque du centre et le prolongement du couloir, et frappe en diagonale dans le
      carré opposé.</p>
    <p>On sert d'abord à <strong>droite</strong>, puis on alterne à chaque point.</p>
    <p><strong>Faute de pied</strong> : toucher la ligne ou le court avant d'avoir frappé.
      <strong>Let</strong> : la balle touche le filet et tombe bonne — on rejoue le service,
      sans le perdre.</p>`,
  },
  {
    titre: 'Compter les points',
    corps: `<p>15, 30, 40, jeu. À 40 partout, <strong>égalité</strong> : il faut deux
      points d'écart — avantage, puis jeu.</p>
    <p>Le premier à <strong>six jeux</strong> avec deux jeux d'écart gagne la manche.
      À 6-6, on joue un <strong>jeu décisif</strong>.</p>
    <p>Le score du serveur s'annonce en premier.</p>`,
  },
  {
    titre: 'Le jeu décisif',
    corps: `<p>Premier à <strong>7 points</strong>, avec deux points d'écart. On compte
      en points simples : 1, 2, 3…</p>
    <p>Le premier serveur en sert <strong>un</strong>, puis chacun en sert
      <strong>deux</strong>. On change de côté <strong>tous les six points</strong>.</p>`,
  },
  {
    titre: 'Changer de côté',
    corps: `<p>Au bout du <strong>premier jeu</strong>, puis tous les <strong>deux
      jeux</strong> — donc après les jeux impairs : 1, 3, 5…</p>
    <p>On dispose de <strong>90 secondes</strong> au changement de côté,
      <strong>25 secondes</strong> entre deux points, et <strong>120 secondes</strong>
      entre deux manches.</p>`,
  },
  {
    titre: 'Bonne ou faute',
    corps: `<p><strong>La ligne est bonne.</strong> Une balle qui touche la ligne, même
      d'un cheveu, est dans le court.</p>
    <p>Une balle qui touche le filet et retombe bonne se joue — sauf au service, où
      c'est un let.</p>
    <p>Sans arbitre, <strong>chacun annonce les balles de son côté</strong>, et le doute
      profite à l'adversaire.</p>`,
  },
  {
    titre: 'Le point est perdu si…',
    corps: `<p>La balle rebondit deux fois de ton côté ; tu l'envoies dehors ou dans le
      filet ; tu la touches avant qu'elle n'ait franchi le filet ; tu touches le filet,
      le poteau ou le terrain adverse pendant l'échange ; la balle te touche.</p>
    <p>Un double rebond ou un carreau se reconnaissent : personne d'autre ne les a vus,
      et c'est ce qui fait le tennis.</p>`,
  },
];

/** Le bloc entier, prêt à poser dans un écran. */
export function blocRegles() {
  return `
    <details class="court-carte regles-bloc" data-regles>
      <summary class="court-carte-tete">
        <h2>📏 Les règles, en bref</h2>
      </summary>

      <p class="tiny muted">Les cotes du court et les règles qu'on se répète au bord du
        terrain. Rien d'inventé : ce sont les Règles du jeu de la fédération, résumées.
        Pour le reste — les cas tordus, le règlement d'une épreuve — le texte officiel
        est en bas.</p>

      <span class="etiquette">Le court, en mètres</span>
      ${planCote()}
      <p class="tiny muted">Vu de dessus. Le filet dépasse de 0,91 m de chaque côté :
        ses poteaux sont en dehors du court de double.</p>

      <span class="etiquette">La hauteur du filet</span>
      ${filetDeFace()}
      <p class="tiny muted">Il s'affaisse au centre, et c'est voulu : passer au milieu
        est plus facile de quinze centimètres et demi.</p>

      <span class="etiquette">Ce qu'on demande le plus</span>
      <div class="regles-fiches">
        ${FICHES.map(f => `<details class="regle-fiche">
          <summary>${h(f.titre)}</summary>
          ${f.corps}
        </details>`).join('')}
      </div>

      <p class="tiny muted">Résumé de mémoire d'après les Règles du jeu (FFT / ITF).
        En cas de doute, c'est le texte officiel qui tranche :</p>
      <a class="btn btn-ghost" href="https://www.fft.fr/la-federation/reglements"
         target="_blank" rel="noopener noreferrer">Les règlements de la FFT ↗</a>
    </details>`;
}
