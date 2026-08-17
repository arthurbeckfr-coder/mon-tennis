/* La carte des clubs.

   Pas de Google Maps, pas de Leaflet, pas une seule tuile téléchargée — et
   ce n'est pas une privation. Le déploiement refuse toute ressource
   extérieure pour que le carnet démarre sur un court sans réseau, et une
   carte qui ne s'affiche qu'avec du réseau serait précisément inutile là
   où l'on s'en sert.

   Ce qu'on dessine n'est donc pas un fond de carte mais ce qui compte
   ici : où sont les clubs les uns par rapport aux autres, lesquels sont
   groupés, lequel est loin. Un fond de rues n'ajouterait rien à cette
   question et pèserait deux mégaoctets.

   ─── La projection ──────────────────────────────────────────────────

   Équirectangulaire, corrigée en longitude. À cette latitude un degré de
   longitude vaut environ 0,65 degré de latitude en distance réelle : sans
   cette correction la Seine-Maritime paraîtrait étirée d'est en ouest de
   moitié. La correction se calcule sur la latitude moyenne des clubs
   affichés, ce qui est exact à l'échelle d'un département et faux à
   l'échelle d'un pays — on ne prétend pas faire mieux.

   ─── Les coordonnées ────────────────────────────────────────────────

   Elles viennent de l'API officielle des communes (geo.api.gouv.fr),
   relevées une fois et écrites ici. Pas d'appel au moment de l'affichage :
   ce serait une ressource extérieure de plus, et le carnet doit marcher
   hors ligne. Un club dont la ville n'est pas dans cette table n'est pas
   placé au hasard — il est dit absent, et compté. */

import { h } from './util.js';
import { CONTOURS } from './contours.js';
import { ROUTES, VILLES } from './reperes.js';

/* Le centre officiel de chaque commune où l'on a joué, en [longitude,
   latitude]. Auffay a fusionné dans Val-de-Scie et Belleville-sur-Mer
   dans Petit-Caux : ce sont les communes nouvelles qui portent le point,
   sous le nom que la fédération continue d'employer. */
export const COMMUNES = {
  'AUFFAY':                 [1.1339, 49.7147],
  'ST AUBIN SUR SCIE':      [1.0802, 49.8855],
  'ENVERMEU':               [1.2634, 49.8980],
  'EU':                     [1.4303, 50.0420],
  'LE TREPORT':             [1.3759, 50.0520],
  'LONDINIERES':            [1.3980, 49.8399],
  'NEUFCHATEL EN BRAY':     [1.4488, 49.7420],
  'PAVILLY':                [0.9491, 49.5783],
  'ROUXMESNIL BOUTEILLES':  [1.1020, 49.8987],
  'ST VALERY EN CAUX':      [0.7094, 49.8582],
  'MERS LES BAINS':         [1.4031, 50.0723],
  'VEULES LES ROSES':       [0.7877, 49.8640],
  'BELLEVILLE SUR MER':     [1.2343, 49.9612],
  'VEULETTES SUR MER':      [0.5872, 49.8451],
  'MONT SAINT AIGNAN':      [1.0806, 49.4673],
  'PETIT COURONNE':         [1.0342, 49.3817],
  'YVETOT':                 [0.7685, 49.6183],
  'YERVILLE':               [0.8902, 49.6752],
  'BOIS GUILLAUME':         [1.1194, 49.4729],
  'ROUEN':                  [1.0912, 49.4412],
};

/* « Saint-Aubin-sur-Scie », « ST AUBIN SUR SCIE » et « St Aubin sur Scie »
   sont la même commune. On ramène tout à une forme unique avant de
   comparer — sans quoi la moitié des clubs manquerait la table. */
const sansAccent = s => (s || '').toUpperCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^A-Z0-9]+/g, ' ').trim()
  .replace(/^(SAINTE|SAINT|STE)\b/, 'ST');

const INDEX = new Map(Object.keys(COMMUNES).map(k => [sansAccent(k), COMMUNES[k]]));

/** Le point d'un club : sa position saisie si elle existe, sinon celle de
 *  sa commune. Rien à défaut — on ne place pas un club au hasard. */
export function pointDuClub(club) {
  if (Array.isArray(club?.point) && club.point.length === 2) return club.point;
  return INDEX.get(sansAccent(club?.ville)) || null;
}

/**
 * La carte, en SVG et en un seul bloc de texte.
 *
 * @param {Array<{club, matchs, bilan}>} clubs — déjà comptés par l'appelant
 * @returns {string} le HTML de la carte, ou '' s'il n'y a rien à montrer
 */
export function carteClubs(clubs) {
  const places = clubs
    .map(c => ({ ...c, point: pointDuClub(c.club) }))
    .filter(c => c.point);

  const absents = clubs.length - places.length;
  if (places.length < 2) {
    return `<p class="tiny muted">Pas encore assez de clubs situés pour dessiner une
      carte.${absents ? ` ${absents} club(s) n'ont pas de ville reconnue.` : ''}</p>`;
  }

  /* Un degré de longitude ne vaut pas un degré de latitude : sans cette
     correction, la région paraîtrait étirée d'est en ouest. */
  const latMoyenne = places.reduce((t, c) => t + c.point[1], 0) / places.length;
  const k = Math.cos(latMoyenne * Math.PI / 180);

  const projete = ([lon, lat]) => [lon * k, -lat];
  const pts = places.map(c => ({ ...c, xy: projete(c.point) }));

  const xs = pts.map(p => p.xy[0]), ys = pts.map(p => p.xy[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);

  /* Une marge proportionnelle à l'étendue, jamais nulle : deux clubs de la
     même ville donneraient une boîte de largeur zéro, donc une division
     par zéro puis une carte vide. */
  const etendue = Math.max(maxX - minX, maxY - minY, 0.02);
  const marge = etendue * 0.18;
  const boite = {
    x: minX - marge, y: minY - marge,
    w: (maxX - minX) + marge * 2, h: (maxY - minY) + marge * 2,
  };

  const maxMatchs = Math.max(1, ...pts.map(p => p.matchs.length));

  /* Le rayon est donné en pixels d'écran, et non en unités de carte.
     C'est tout le sujet : exprimé en unités de carte, un disque grossit
     avec le zoom, si bien qu'en s'approchant on obtenait des pastilles
     énormes — et deux clubs voisins restaient superposés quel que soit
     le grossissement, puisqu'ils enflaient ensemble. En pixels, zoomer
     écarte les clubs sans les gonfler, ce qui est précisément ce qu'on
     attend d'une carte.

     La taille suit la racine carrée du nombre de matchs : c'est l'aire du
     disque qu'on lit, pas son rayon. Six à douze pixels de rayon — assez
     pour viser au pouce, assez peu pour que quatorze clubs ne fassent pas
     une tache. */
  const rayonPx = n => 6 + 6 * Math.sqrt(n / maxMatchs);

  /* La hauteur de la carte est fixée par la feuille de style. On s'en sert
     pour poser une première taille cohérente ; `brancherCarte` la corrige
     dès le premier affichage, avec les dimensions réelles. */
  const echInitiale = 340 / boite.h;

  /* Le fond passe par la même projection que les clubs : sans cela, les
     points flotteraient à côté de leur pays au lieu d'être dedans. */
  const chemin = anneau => anneau
    .map((c, i) => {
      const [x, y] = projete(c);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(4)} ${y.toFixed(4)}`;
    }).join('') + 'Z';

  const fond = Object.values(CONTOURS)
    .flat()
    .map(anneau => `<path class="carte-terre" d="${chemin(anneau)}"/>`)
    .join('');

  /* Les axes ne sont pas fermés : on reprend le même tracé sans le « Z »,
     sans quoi l'autoroute se refermerait sur elle-même en travers. */
  const routes = ROUTES.map(r => {
    const d = r.trace.map((c, i) => {
      const [x, y] = projete(c);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(4)} ${y.toFixed(4)}`;
    }).join('');
    return `<path class="carte-route" d="${d}"><title>${h(r.ref)}</title></path>`;
  }).join('');

  /* Les villes citées pour se situer portent un petit carré et leur nom.
     Elles se distinguent des clubs par la forme autant que par la
     couleur : un carré gris n'est pas un disque vert, même en noir et
     blanc. */
  const villes = VILLES.map(v => {
    const [x, y] = projete(v.point);
    return `<g class="carte-ville" data-x="${x.toFixed(5)}" data-y="${y.toFixed(5)}">
      <rect class="carte-ville-marque" x="${x.toFixed(4)}" y="${y.toFixed(4)}"/>
      <text class="carte-ville-nom" x="${x.toFixed(4)}" y="${y.toFixed(4)}">${h(v.nom)}</text>
    </g>`;
  }).join('');

  return `<div class="carte-clubs" data-carte
       data-boite="${boite.x} ${boite.y} ${boite.w} ${boite.h}">
    <svg viewBox="${boite.x} ${boite.y} ${boite.w} ${boite.h}"
         preserveAspectRatio="xMidYMid meet" role="img"
         aria-label="Carte des clubs où j'ai joué">
      ${fond}
      ${routes}
      ${villes}
      ${pts.map(p => {
        const [x, y] = p.xy;
        const rpx = rayonPx(p.matchs.length);
        const r = rpx / echInitiale;
        const gagne = p.bilan.total && p.bilan.v > p.bilan.d;
        /* `data-club-carte` et non `data-club` : la liste des clubs
           utilise déjà `data-club`, et son gestionnaire attraperait le
           clic avant celui de la carte — court-circuitant le garde-fou
           qui distingue un glissement d'un appui. */
        /* Aucun nom écrit sur la carte, et c'est délibéré : quatorze
           étiquettes sur un écran de téléphone se chevauchent, et l'on
           finit par ne plus rien lire. Le nom vient au clic, dans une
           bulle en HTML — laquelle garde sa taille de lecture à tous les
           zooms, là où un texte SVG grossirait avec la carte. */
        return `<g class="carte-club ${gagne ? 'gagnant' : ''}"
             data-club-carte="${h(p.club.id)}" role="button" tabindex="0"
             data-x="${x.toFixed(5)}" data-y="${y.toFixed(5)}"
             data-rpx="${rpx.toFixed(2)}"
             data-nom="${h(p.club.nom)}"
             data-detail="${p.matchs.length} match${p.matchs.length > 1 ? 's' : ''} — ${p.bilan.v}V–${p.bilan.d}D${
               p.club.ville ? ' — ' + h(p.club.ville) : ''}">
          <title>${h(p.club.nom)} — ${p.matchs.length} match(s), ${p.bilan.v}V–${p.bilan.d}D</title>
          <circle class="carte-halo" cx="${x.toFixed(4)}" cy="${y.toFixed(4)}"
                  r="${(r * 1.9).toFixed(4)}"/>
          <circle class="carte-point" cx="${x.toFixed(4)}" cy="${y.toFixed(4)}"
                  r="${r.toFixed(4)}"/>
        </g>`;
      }).join('')}
    </svg>

    <div class="carte-bulle" hidden>
      <button class="carte-bulle-fermer" aria-label="Fermer">✕</button>
      <strong class="carte-bulle-nom"></strong>
      <span class="carte-bulle-detail tiny muted"></span>
      <button class="btn btn-primary carte-bulle-voir">Voir la fiche</button>
    </div>

    <div class="carte-outils">
      <button class="icon-btn" data-zoom="0.7" aria-label="Zoomer">＋</button>
      <button class="icon-btn" data-zoom="1.43" aria-label="Dézoomer">−</button>
      <button class="icon-btn" data-recentrer aria-label="Recentrer">⌖</button>
    </div>
  </div>
  <p class="tiny muted">Chaque disque est un club, sa taille dit le nombre de matchs joués,
    sa couleur si ton bilan y est positif. Touche un club pour voir son nom, puis « Voir la
    fiche » pour l'ouvrir ; glisse pour te déplacer, pince ou molette pour zoomer — les
    disques gardent leur taille, ce sont les distances qui s'écartent.
    Les carrés gris et les traits fins sont des repères — quelques villes et les grands
    axes — et non des lieux où tu as joué.
    ${absents ? `${absents} club(s) ne figurent pas ici : leur ville n'est pas dans la
      table des communes, et les placer au hasard vaudrait moins que de le dire.` : ''}</p>`;
}

/**
 * Rend la carte manipulable : glisser pour se déplacer, pincer ou molette
 * pour zoomer, toucher un club pour l'ouvrir.
 *
 * On agit sur le viewBox plutôt que sur une transformation CSS : c'est ce
 * qui garde les traits fins et le texte net à tous les niveaux de zoom,
 * là où un `scale` grossirait tout, y compris ce qui doit rester lisible.
 */
export function brancherCarte(racine, ouvrirClub) {
  const bloc = racine.querySelector('[data-carte]');
  if (!bloc) return;
  const svg = bloc.querySelector('svg');
  const depart = bloc.dataset.boite.split(' ').map(Number);

  /* La bulle vit en HTML par-dessus le SVG, et non dedans. C'est ce qui
     lui garde une taille de lecture constante : un texte tracé dans le
     SVG grossirait avec la carte, et il faudrait choisir entre illisible
     de loin et démesuré de près. En contrepartie il faut la replacer à
     chaque déplacement — d'où son recalcul dans `poser`. */
  const bulle = bloc.querySelector('.carte-bulle');
  let choisi = null;

  const placerBulle = () => {
    if (!choisi) return;
    const r = svg.getBoundingClientRect();
    /* Le viewBox est ajusté en « meet » : l'échelle est la même sur les
       deux axes, et le dessin est centré dans la boîte. Sans refaire ce
       calcul, la bulle dériverait dès que la carte n'est pas carrée. */
    const ech = Math.min(r.width / vue[2], r.height / vue[3]);
    const gx = (r.width - vue[2] * ech) / 2;
    const gy = (r.height - vue[3] * ech) / 2;
    const x = gx + (choisi.x - vue[0]) * ech;
    const y = gy + (choisi.y - vue[1]) * ech;

    // Hors cadre, la bulle n'a plus de sens : elle s'efface avec son club.
    bulle.hidden = x < -40 || y < -40 || x > r.width + 40 || y > r.height + 40;
    if (bulle.hidden) return;

    /* Un club près du bord ferait sortir la bulle de la carte, et son nom
       serait coupé.

       On la pose d'abord sur le club, puis on mesure ce qui dépasse et on
       corrige. Calculer la retenue à l'avance demandait la largeur de la
       bulle *avant* que le navigateur n'ait remis son texte en page — on
       obtenait celle du club précédent, et un nom long débordait quand
       même. Mesurer après, c'est se passer de deviner. */
    bulle.style.left = `${x}px`;
    bulle.style.top = `${y}px`;
    bulle.style.setProperty('--pointe', '50%');

    const cadre = bloc.getBoundingClientRect();
    const p = bulle.getBoundingClientRect();
    const marge = 8;
    const trop = Math.max(0, (cadre.left + marge) - p.left)
               - Math.max(0, p.right - (cadre.right - marge));

    if (trop) {
      bulle.style.left = `${x + trop}px`;
      // La pointe, elle, reste sur le club : sinon on ne sait plus de qui
      // la bulle parle quand deux clubs sont voisins.
      bulle.style.setProperty('--pointe', `${50 - (trop / p.width) * 100}%`);
    }
  };

  /* Tout ce qui doit garder sa taille à l'écran est redimensionné ici, à
     chaque changement de cadrage : les disques, les carrés des villes et
     leurs noms. Le SVG ne sait pas faire « constant en pixels » tout seul
     — `vector-effect` ne vaut que pour l'épaisseur des traits — et une
     taille exprimée en unités de carte enfle avec le zoom.
     C'est aussi ce qui sépare enfin deux clubs voisins quand on
     s'approche : ils s'écartent sans grossir. */
  const clubs = [...bloc.querySelectorAll('.carte-club')];
  const villes = [...bloc.querySelectorAll('.carte-ville')];

  const redimensionner = ech => {
    for (const g of clubs) {
      const r = Number(g.dataset.rpx) / ech;
      g.querySelector('.carte-point').setAttribute('r', r.toFixed(5));
      g.querySelector('.carte-halo').setAttribute('r', (r * 1.9).toFixed(5));
    }
    for (const g of villes) {
      const x = Number(g.dataset.x), y = Number(g.dataset.y);
      const c = 3.5 / ech;                    // le carré, 7 px de côté
      const rect = g.querySelector('rect');
      rect.setAttribute('x', (x - c).toFixed(5));
      rect.setAttribute('y', (y - c).toFixed(5));
      rect.setAttribute('width', (c * 2).toFixed(5));
      rect.setAttribute('height', (c * 2).toFixed(5));
      const t = g.querySelector('text');
      t.setAttribute('font-size', (11 / ech).toFixed(5));
      t.setAttribute('x', x.toFixed(5));
      t.setAttribute('y', (y - 6 / ech).toFixed(5));
    }
  };

  /* L'échelle du moment : le viewBox est ajusté en « meet », donc la même
     sur les deux axes. */
  const echelle = () => {
    const r = svg.getBoundingClientRect();
    return Math.min(r.width / vue[2], r.height / vue[3]) || 1;
  };

  let vue = [...depart];
  const poser = () => {
    svg.setAttribute('viewBox', vue.join(' '));
    redimensionner(echelle());
    placerBulle();
  };

  const ouvrirBulle = g => {
    choisi = { x: Number(g.dataset.x), y: Number(g.dataset.y), id: g.dataset.clubCarte };
    bulle.querySelector('.carte-bulle-nom').textContent = g.dataset.nom;
    bulle.querySelector('.carte-bulle-detail').textContent = g.dataset.detail;
    bulle.hidden = false;
    bloc.querySelectorAll('.carte-club').forEach(x => x.classList.toggle('choisi', x === g));
    placerBulle();
  };

  const fermerBulle = () => {
    choisi = null;
    bulle.hidden = true;
    bloc.querySelectorAll('.carte-club.choisi').forEach(x => x.classList.remove('choisi'));
  };

  bulle.querySelector('.carte-bulle-fermer').addEventListener('click', e => {
    e.stopPropagation();
    fermerBulle();
  });
  bulle.querySelector('.carte-bulle-voir').addEventListener('click', e => {
    e.stopPropagation();
    if (choisi) ouvrirClub(choisi.id);
  });

  /* Les limites du zoom sont relatives à la boîte de départ : on ne
     s'éloigne pas au point de perdre les clubs, et on ne s'approche pas
     au point de n'en voir qu'un. */
  const bornes = { min: depart[2] / 12, max: depart[2] * 2.2 };

  const zoomer = (facteur, ancre) => {
    const w = Math.min(bornes.max, Math.max(bornes.min, vue[2] * facteur));
    const vrai = w / vue[2];
    const h = vue[3] * vrai;
    // L'ancre reste sous le doigt : c'est ce qui rend le zoom prévisible.
    vue = [ancre[0] - (ancre[0] - vue[0]) * vrai,
           ancre[1] - (ancre[1] - vue[1]) * vrai, w, h];
    poser();
  };

  /** Un point de l'écran, exprimé dans les unités de la carte. */
  const versCarte = (cx, cy) => {
    const r = svg.getBoundingClientRect();
    return [vue[0] + ((cx - r.left) / r.width) * vue[2],
            vue[1] + ((cy - r.top) / r.height) * vue[3]];
  };

  bloc.addEventListener('wheel', e => {
    e.preventDefault();
    zoomer(e.deltaY > 0 ? 1.15 : 0.87, versCarte(e.clientX, e.clientY));
  }, { passive: false });

  bloc.querySelectorAll('[data-zoom]').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    zoomer(Number(b.dataset.zoom), [vue[0] + vue[2] / 2, vue[1] + vue[3] / 2]);
  }));

  bloc.querySelector('[data-recentrer]')?.addEventListener('click', e => {
    e.stopPropagation();
    vue = [...depart];
    poser();
  });

  /* Le déplacement et le pincement partagent le même suivi de doigts.
     `bouge` distingue le glissement du simple appui : sans lui, tout clic
     sur un club serait avalé par le déplacement. */
  const doigts = new Map();
  let bouge = false;
  let ecartDepart = 0;

  const ecart = () => {
    const [a, b] = [...doigts.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  svg.addEventListener('pointerdown', e => {
    /* La capture garde le doigt sur la carte s'il en sort en glissant,
       mais elle peut échouer — pointeur déjà capté ailleurs, événement
       synthétique. Elle est donc un confort et non une condition : la
       laisser jeter ici priverait la carte de tout déplacement. */
    try { svg.setPointerCapture(e.pointerId); } catch { /* tant pis */ }
    doigts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (doigts.size === 2) ecartDepart = ecart();
    bouge = false;
  });

  svg.addEventListener('pointermove', e => {
    const avant = doigts.get(e.pointerId);
    if (!avant) return;
    const r = svg.getBoundingClientRect();

    if (doigts.size === 2) {
      const precedent = ecart();
      doigts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const nouveau = ecart();
      if (precedent > 0 && nouveau > 0) {
        const centre = [...doigts.values()];
        zoomer(precedent / nouveau,
               versCarte((centre[0].x + centre[1].x) / 2, (centre[0].y + centre[1].y) / 2));
        bouge = true;
      }
      return;
    }

    const dx = (e.clientX - avant.x) / r.width * vue[2];
    const dy = (e.clientY - avant.y) / r.height * vue[3];
    if (Math.abs(e.clientX - avant.x) + Math.abs(e.clientY - avant.y) > 3) bouge = true;
    vue = [vue[0] - dx, vue[1] - dy, vue[2], vue[3]];
    doigts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    poser();
  });

  const lacher = e => {
    doigts.delete(e.pointerId);
    if (doigts.size < 2) ecartDepart = 0;
  };
  svg.addEventListener('pointerup', lacher);
  svg.addEventListener('pointercancel', lacher);

  bloc.addEventListener('click', e => {
    // Un glissement n'est pas un clic : on ne veut pas ouvrir une bulle
    // parce qu'on a déplacé la carte en partant d'un club.
    if (bouge) { bouge = false; return; }
    const g = e.target.closest('[data-club-carte]');
    if (g) ouvrirBulle(g);
    // Toucher le vide referme : c'est le geste qu'on essaie d'abord.
    else if (!e.target.closest('.carte-bulle, .carte-outils')) fermerBulle();
  });

  bloc.addEventListener('keydown', e => {
    if (e.key === 'Escape') { fermerBulle(); return; }
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const g = e.target.closest('[data-club-carte]');
    if (!g) return;
    e.preventDefault();
    ouvrirBulle(g);
  });

  /* Premier calage : le rendu initial a posé des tailles estimées à partir
     de la hauteur déclarée dans la feuille de style. On les corrige ici
     avec les dimensions réelles, sitôt la carte dans la page. */
  poser();
}
