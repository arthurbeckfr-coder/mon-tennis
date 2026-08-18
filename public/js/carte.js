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
import { store } from './store.js';
import { distanceKm, direDistance, lienItineraire, adresseDuClub } from './geocodage.js';
import { CONTOURS } from './contours.js';
import { FRANCE, VILLES_FRANCE } from './france.js';
import { ROUTES, VILLES, COMMUNES_TRACE } from './reperes.js';

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

/** La couture d'une balle de tennis, vue de face : une courbe en S d'un
 *  bord à l'autre. Deux arcs symétriques seraient plus fidèles à l'objet
 *  et illisibles à douze pixels — c'est le S que l'œil reconnaît sur les
 *  petites tailles, et une carte n'affiche rien d'autre que de petites
 *  tailles. */
const couture = (x, y, r) =>
  `M ${(x - r).toFixed(4)} ${y.toFixed(4)}`
  + ` C ${(x - r * 0.42).toFixed(4)} ${(y - r * 0.82).toFixed(4)}`
  + ` ${(x + r * 0.42).toFixed(4)} ${(y + r * 0.82).toFixed(4)}`
  + ` ${(x + r).toFixed(4)} ${y.toFixed(4)}`;

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
 * @param {object} [o]
 * @param {'club'|'bilan'} [o.couleur] ce que dit la couleur des balles :
 *        « club » — rien, elles sont jaunes comme une balle neuve ;
 *        « bilan » — vert quand on gagne là-bas, rouge quand on perd.
 *        Sur la carte de mes clubs, la couleur n'a rien à dire : on
 *        regarde où l'on joue. Sur celle d'un adversaire, elle dit tout :
 *        on regarde où l'on gagne contre lui.
 * @returns {string} le HTML de la carte, ou '' s'il n'y a rien à montrer
 */
export function carteClubs(clubs, { couleur = 'club' } = {}) {
  const places = clubs
    .map(c => ({ ...c, point: pointDuClub(c.club) }))
    .filter(c => c.point);

  const absents = clubs.length - places.length;
  /* Un seul club suffit à faire une carte, et c'est le cas courant sur la
     fiche d'un adversaire croisé une fois : le contour du département et
     les villes autour disent déjà où c'était. C'est zéro qui ne se dessine
     pas. */
  if (!places.length) {
    return `<p class="tiny muted">Aucun de ces clubs n'a de ville reconnue : rien à
      placer sur une carte.${absents ? ` (${absents} club(s))` : ''}</p>`;
  }

  /* Le domicile et le bureau, s'ils ont été situés. Ils ne sont pas des
     clubs et ne doivent pas s'y confondre : une forme à eux, et un nom
     écrit à côté, parce qu'on les cherche du regard.

     Ils sont lus avant le cadrage, et non après : ce sont des lieux à
     voir, pas une décoration. Sur la fiche d'un club, la carte n'a qu'un
     disque à montrer — la maison à côté est précisément ce qui dit à
     quelle distance il est. */
  const repereAncres = [
    { cle: 'domicile', nom: 'Chez moi', emoji: '🏠', lieu: store?.profil?.domicile },
    { cle: 'bureau', nom: 'Le bureau', emoji: '💼', lieu: store?.profil?.bureau },
  ].filter(x => Array.isArray(x.lieu?.point));

  /* Un degré de longitude ne vaut pas un degré de latitude : sans cette
     correction, la région paraîtrait étirée d'est en ouest. */
  const latMoyenne = places.reduce((t, c) => t + c.point[1], 0) / places.length;
  const k = Math.cos(latMoyenne * Math.PI / 180);

  const projete = ([lon, lat]) => [lon * k, -lat];
  const pts = places.map(c => ({ ...c, xy: projete(c.point) }));

  /* Les clubs et les ancres, ensemble : une maison hors du cadre ne sert
     à rien, et c'est en la voyant à côté du club qu'on lit la distance. */
  const tousXY = [...pts.map(p => p.xy), ...repereAncres.map(a => projete(a.lieu.point))];
  const xs = tousXY.map(p => p[0]), ys = tousXY.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);

  /* Le cadrage tient les clubs, et jamais moins d'une trentaine de
     kilomètres. Ce plancher n'est pas un détail de présentation : sans
     lui, un club seul — ou deux de la même ville — donnerait une boîte de
     largeur nulle, donc une division par zéro, et au mieux un point au
     milieu de rien. Avec lui, la côte et une ville restent dans le champ,
     et l'on sait où l'on est. */
  const etendue = Math.max(maxX - minX, maxY - minY, 0.30);
  const marge = etendue * 0.18;

  const cadrer = (min, max) => {
    const large = Math.max(max - min, etendue) + marge * 2;
    const centre = (min + max) / 2;
    return { debut: centre - large / 2, taille: large };
  };
  const cx = cadrer(minX, maxX), cy = cadrer(minY, maxY);
  const boite = { x: cx.debut, y: cy.debut, w: cx.taille, h: cy.taille };

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

  /* Deux fonds superposés, et l'ordre compte. La France d'abord, tracée
     grossièrement : elle répond à « où est-ce dans le pays » et n'a pas
     besoin de plus. Les deux départements où l'on joue par-dessus, au
     trait fin : eux portent la côte qu'on reconnaît.

     Le second redessine une partie du premier, et c'est voulu — la
     précision régionale doit gagner là où elle existe. */
  const fondFrance = FRANCE
    .flatMap(d => d.anneaux)
    .map(anneau => `<path class="carte-france" data-rang="0" d="${chemin(anneau)}"/>`)
    .join('');

  const fond = fondFrance + Object.values(CONTOURS)
    .flat()
    .map(anneau => `<path class="carte-terre" d="${chemin(anneau)}"/>`)
    .join('');

  /* Les axes ne sont pas fermés : on reprend le même tracé sans le « Z »,
     sans quoi l'autoroute se refermerait sur elle-même en travers. */
  const ligne = trace => trace.map((c, i) => {
    const [x, y] = projete(c);
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(4)} ${y.toFixed(4)}`;
  }).join('');

  const routes = ROUTES.map(r =>
    `<path class="carte-route" data-rang="${r.r}" d="${ligne(r.trace)}"
       ><title>${h(r.ref)}</title></path>`).join('');

  /* Les limites de communes ne se dessinent qu'une fois qu'on s'est
     approché : de loin, vingt polygones se chevauchent en un gribouillis
     qui masque les clubs. */
  const limites = COMMUNES_TRACE.map(c =>
    `<path class="carte-limite" data-rang="3" d="${ligne(c.trace)}Z"
       ><title>${h(c.nom)}</title></path>`).join('');

  /* Les villes citées pour se situer portent un petit carré et leur nom.
     Elles se distinguent des clubs par la forme autant que par la
     couleur : un carré gris n'est pas un disque vert, même en noir et
     blanc. */
  const ancres = repereAncres.map(a => {
    const [x, y] = projete(a.lieu.point);
    /* Trois pièces plutôt qu'un émoji seul : un disque qui découpe le
       fond, l'émoji dedans, et le nom dessous. Un émoji posé nu sur une
       carte se confond avec le relief dès qu'on dézoome — il n'a ni
       contour ni fond, et à dix pixels il n'est plus qu'une tache. Les
       trois pièces sont redimensionnées à chaque zoom pour garder leur
       taille à l'écran, comme les clubs. */
    return `<g class="carte-ancre" data-x="${x.toFixed(5)}" data-y="${y.toFixed(5)}">
      <title>${h(a.nom)} — ${h(a.lieu.libelle || a.lieu.adresse || '')}</title>
      <circle class="carte-ancre-fond" cx="${x.toFixed(5)}" cy="${y.toFixed(5)}"/>
      <text class="carte-ancre-marque" x="${x.toFixed(5)}" y="${y.toFixed(5)}"
            >${a.emoji}</text>
      <text class="carte-ancre-nom" x="${x.toFixed(5)}" y="${y.toFixed(5)}"
            >${h(a.nom)}</text>
    </g>`;
  }).join('');

  /* Une ville qui porte déjà un club n'a pas besoin de son étiquette : le
     disque et son nom dans la bulle disent la même chose, et deux
     marqueurs au même endroit se gênent. */
  const villesDeClubs = new Set(clubs.map(c => sansAccent(c.club?.ville)));

  /* Les villes de France et celles de la région ne font qu'une liste. Une
     ville présente dans les deux — Rouen, Dieppe — garderait deux
     étiquettes superposées : on ne retient que la première rencontrée,
     et la nationale vient d'abord parce qu'elle porte le rang le plus
     bas, donc la meilleure visibilité. */
  const vues = new Set();
  const villes = [...VILLES_FRANCE, ...VILLES]
    .filter(v => {
      const n = sansAccent(v.nom);
      if (vues.has(n) || villesDeClubs.has(n)) return false;
      vues.add(n);
      return true;
    })
    .map(v => {
      const [x, y] = projete(v.point);
      return `<g class="carte-ville" data-rang="${v.r}"
          data-x="${x.toFixed(5)}" data-y="${y.toFixed(5)}">
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
      ${limites}
      ${routes}
      ${villes}
      ${ancres}
      ${pts.map(p => {
        const [x, y] = p.xy;
        const rpx = rayonPx(p.matchs.length);
        const r = rpx / echInitiale;
        /* Vert, rouge, ou rien. L'égalité ne se tranche pas : deux
           victoires pour deux défaites n'est ni un bon ni un mauvais
           terrain, et lui donner une couleur serait mentir d'un match. */
        const teinte = couleur !== 'bilan' || !p.bilan.total ? ''
          : p.bilan.v > p.bilan.d ? 'gagnant'
          : p.bilan.d > p.bilan.v ? 'perdu' : '';
        /* `data-club-carte` et non `data-club` : la liste des clubs
           utilise déjà `data-club`, et son gestionnaire attraperait le
           clic avant celui de la carte — court-circuitant le garde-fou
           qui distingue un glissement d'un appui. */
        /* Aucun nom écrit sur la carte, et c'est délibéré : quatorze
           étiquettes sur un écran de téléphone se chevauchent, et l'on
           finit par ne plus rien lire. Le nom vient au clic, dans une
           bulle en HTML — laquelle garde sa taille de lecture à tous les
           zooms, là où un texte SVG grossirait avec la carte. */
        return `<g class="carte-club ${teinte}"
             data-club-carte="${h(p.club.id)}" role="button" tabindex="0"
             data-x="${x.toFixed(5)}" data-y="${y.toFixed(5)}"
             data-rpx="${rpx.toFixed(2)}"
             data-nom="${h(p.club.nom)}"
             data-detail="${p.matchs.length} match${p.matchs.length > 1 ? 's' : ''} — ${p.bilan.v}V–${p.bilan.d}D${
               p.club.ville ? ' — ' + h(p.club.ville) : ''}${
               (() => {
                 /* La distance depuis chez soi, quand on sait d'où l'on
                    part. À vol d'oiseau et dit comme tel : la route est
                    plus longue, et de combien dépend du relief. */
                 const d = distanceKm(store?.profil?.domicile?.point, p.point);
                 return d == null ? '' : ' — ' + h(direDistance(d));
               })()}"
             data-lon="${p.point[0]}" data-lat="${p.point[1]}"
             data-adresse="${h(adresseDuClub(p.club))}">
          <title>${h(p.club.nom)} — ${p.matchs.length} match(s), ${p.bilan.v}V–${p.bilan.d}D</title>
          ${/* Une balle de tennis plutôt qu'un disque : sur une carte où
                l'on cherche des courts, le sujet doit se reconnaître de
                loin. La couture est une courbe en S — c'est ainsi que se
                dessine une balle vue de face, et c'est ce qui reste
                lisible à douze pixels. Elle est retracée à chaque zoom,
                comme le rayon : voir `redimensionner`. */''}
          <circle class="carte-halo" cx="${x.toFixed(4)}" cy="${y.toFixed(4)}"
                  r="${(r * 1.9).toFixed(4)}"/>
          <circle class="carte-point" cx="${x.toFixed(4)}" cy="${y.toFixed(4)}"
                  r="${r.toFixed(4)}"/>
          <path class="carte-couture" d="${couture(x, y, r)}"/>
        </g>`;
      }).join('')}
    </svg>

    <div class="carte-bulle" hidden>
      <button class="carte-bulle-fermer" aria-label="Fermer">✕</button>
      <strong class="carte-bulle-nom"></strong>
      <span class="carte-bulle-detail tiny muted"></span>
      <button class="btn btn-primary carte-bulle-voir">Voir la fiche</button>
      ${/* L'itinéraire s'ouvre dans l'application de cartes du téléphone :
            elle seule connaît les routes, les travaux et l'heure. Le carnet
            ne calcule pas de temps de trajet — il n'en a pas les moyens et
            n'inventera pas un chiffre qui aurait l'air juste. */''}
      <a class="btn btn-ghost carte-bulle-route" target="_blank"
         rel="noopener noreferrer" hidden>Itinéraire depuis chez moi ↗</a>
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
    Les carrés gris et les traits fins sont des repères — villes, axes routiers et limites
    de communes — et non des lieux où tu as joué. La carte en montre d'autant plus que tu
    t'approches : les grandes villes et les autoroutes de loin, les bourgs et les
    nationales ensuite, les villages et les limites communales de près. Un nom qui manque
    n'est pas absent, il attend la place.
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
  /* Rangées de la plus grosse ville à la plus petite : c'est l'ordre dans
     lequel on décide qui garde son étiquette quand la place manque. */
  const villes = [...bloc.querySelectorAll('.carte-ville')]
    .sort((a, b) => Number(a.dataset.rang) - Number(b.dataset.rang));
  const ancresDom = [...bloc.querySelectorAll('.carte-ancre')];
  const rangs = [...bloc.querySelectorAll('[data-rang]')];

  /* ─── Ce qu'on montre à chaque échelle ───────────────────────────────

     Une carte routière ne dit pas les mêmes noms au 1/1 000 000 et au
     1/25 000, et pour une raison qui n'a rien d'esthétique : cent
     cinquante étiquettes sur un écran de téléphone se recouvrent jusqu'à
     ce qu'on ne lise plus rien, clubs compris — or les clubs sont le
     sujet.

     Le seuil se mesure sur la largeur de la vue, en degrés, c'est-à-dire
     sur la surface réellement embrassée. À plus d'un demi-degré on
     regarde un département : seules les villes de plus de dix mille
     habitants et les autoroutes ont leur place. En dessous de trois
     dixièmes on regarde un canton : les bourgs et les nationales
     arrivent. Sous un dixième, on est sur une commune : les villages et
     les limites administratives peuvent enfin se lire. */
  const rangVisible = largeur =>
    largeur > 3.0 ? 0        // la France, ou une grande région
    : largeur > 1.0 ? 1      // plusieurs départements
    : largeur > 0.35 ? 2     // un département
    : 3;                     // un canton, une commune

  /* Le rang ne suffit pas. Autour de Rouen, une douzaine de communes de
     plus de dix mille habitants se touchent : toutes de rang 1, toutes
     affichées, leurs noms s'empilent en un pâté illisible qui recouvre
     jusqu'aux clubs.

     On repasse donc derrière, à l'écran cette fois : les étiquettes sont
     posées de la plus grosse ville à la plus petite, et celle qui
     mordrait sur une déjà posée se tait. C'est ce que fait toute carte —
     et c'est pourquoi le nom d'un village apparaît en s'approchant, quand
     la place se libère, plutôt qu'à un seuil de zoom arbitraire.

     Le carré du repère reste, lui : il occupe sept pixels et dit qu'il y a
     là une commune, ce que le silence de l'étiquette n'enlève pas. */
  const degager = () => {
    const poses = [];
    const chevauche = (a, b) =>
      a.left < b.right + 3 && a.right + 3 > b.left &&
      a.top < b.bottom + 2 && a.bottom + 2 > b.top;

    /* On écarte d'abord ce qui est hors du cadre. Sans cela, mille deux
       cents villes de France seraient mesurées à chaque cran de zoom pour
       décider du sort de la vingtaine qu'on regarde — et Marseille
       compterait comme « affichée » alors qu'elle est à six cents
       kilomètres du bord de l'écran. */
    const marge = vue[2] * 0.08;
    const seuil = rangVisible(vue[2]);
    const dedans = g => {
      const x = Number(g.dataset.x), y = Number(g.dataset.y);
      return x > vue[0] - marge && x < vue[0] + vue[2] + marge
          && y > vue[1] - marge && y < vue[1] + vue[3] + marge;
    };

    for (const g of villes) {
      const nom = g.querySelector('text');
      nom.classList.remove('muette');

      if (!dedans(g) || Number(g.dataset.rang) > seuil) { g.classList.add('efface'); continue; }
      g.classList.remove('efface');

      const boite = nom.getBoundingClientRect();
      if (boite.width === 0) continue;
      if (poses.some(b => chevauche(boite, b))) nom.classList.add('muette');
      else poses.push(boite);
    }
  };

  const doserDetail = () => {
    const seuil = rangVisible(vue[2]);
    // Les villes sont traitées plus bas, qui ajoute le cadrage au rang :
    // deux décisions concurrentes sur la même classe se contrediraient.
    for (const el of rangs) {
      if (el.closest('.carte-ville')) continue;
      el.classList.toggle('efface', Number(el.dataset.rang) > seuil);
    }
    degager();
  };

  const redimensionner = ech => {
    for (const g of clubs) {
      const r = Number(g.dataset.rpx) / ech;
      g.querySelector('.carte-point').setAttribute('r', r.toFixed(5));
      g.querySelector('.carte-halo').setAttribute('r', (r * 1.9).toFixed(5));
      g.querySelector('.carte-couture')?.setAttribute('d',
        couture(Number(g.dataset.x), Number(g.dataset.y), r));
    }
    for (const g of ancresDom) {
      const x = Number(g.dataset.x), y = Number(g.dataset.y);
      /* Comme les clubs : les tailles sont données en pixels d'écran et
         redivisées par l'échelle. Sans quoi la maison enflerait avec le
         zoom jusqu'à couvrir la commune. */
      const rond = g.querySelector('.carte-ancre-fond');
      rond.setAttribute('r', (11 / ech).toFixed(5));
      const marque = g.querySelector('.carte-ancre-marque');
      marque.setAttribute('font-size', (13 / ech).toFixed(5));
      marque.setAttribute('y', (y + 4.6 / ech).toFixed(5));
      const nom = g.querySelector('.carte-ancre-nom');
      nom.setAttribute('font-size', (10 / ech).toFixed(5));
      nom.setAttribute('y', (y + 24 / ech).toFixed(5));
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
    doserDetail();
    placerBulle();
  };

  const ouvrirBulle = g => {
    choisi = { x: Number(g.dataset.x), y: Number(g.dataset.y), id: g.dataset.clubCarte };
    bulle.querySelector('.carte-bulle-nom').textContent = g.dataset.nom;
    bulle.querySelector('.carte-bulle-detail').textContent = g.dataset.detail;

    const route = bulle.querySelector('.carte-bulle-route');
    const depuis = store?.profil?.domicile?.point;
    const vers = [Number(g.dataset.lon), Number(g.dataset.lat)];
    route.hidden = !depuis;
    if (depuis) route.href = lienItineraire(depuis, vers, g.dataset.adresse || '');

    bulle.hidden = false;
    bloc.querySelectorAll('.carte-club').forEach(x => x.classList.toggle('choisi', x === g));
    placerBulle();
    degagerLaBulle();
  };

  /** Déplace la carte du strict nécessaire pour que la bulle tienne
   *  entière dans le cadre.
   *
   *  Un club près du bord ouvrait une bulle coupée : le décalage
   *  horizontal de `placerBulle` la ramène dans le cadre, mais rien ne
   *  la sauvait en haut — elle se dessine au-dessus du disque — ni quand
   *  elle est plus haute que la place restante.
   *
   *  On déplace la carte, sans jamais zoomer : le niveau de zoom est un
   *  choix du lecteur, et le lui reprendre parce qu'il a touché un club
   *  serait le punir de sa curiosité. Un glissement, en revanche, se
   *  refait d'un doigt.
   */
  const degagerLaBulle = () => {
    if (bulle.hidden) return;
    const cadre = bloc.getBoundingClientRect();
    const p = bulle.getBoundingClientRect();
    const marge = 10;

    /* Ce qui dépasse d'un côté, en pixels. Un seul des deux termes est
       non nul dans le cas courant ; s'ils le sont tous les deux, la bulle
       est plus grande que la carte et aucun déplacement n'y changerait
       rien — la somme s'annule et l'on ne bouge pas. */
    const dx = Math.max(0, (cadre.left + marge) - p.left)
             - Math.max(0, p.right - (cadre.right - marge));
    const dy = Math.max(0, (cadre.top + marge) - p.top)
             - Math.max(0, p.bottom - (cadre.bottom - marge));
    if (!dx && !dy) return;

    /* Des pixels d'écran vers des unités de carte. Déplacer la vue vers
       la droite fait glisser le dessin vers la gauche : d'où le signe. */
    const ech = echelle();
    vue = [vue[0] - dx / ech, vue[1] - dy / ech, vue[2], vue[3]];
    poser();
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
  /* On peut désormais s'éloigner jusqu'à embrasser la France — c'est
     pourquoi elle est dessinée. La borne est absolue et non relative au
     cadrage de départ : celui-ci dépend des clubs, alors que le pays, lui,
     ne change pas de taille. */
  const bornes = { min: depart[2] / 12, max: 9 };

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

  /* Ce qui était sous le doigt au moment de l'appui.

     La carte capture le pointeur pour suivre un glissement qui sort du
     cadre. Or le navigateur redirige alors vers l'élément capturant non
     seulement les événements de pointeur, mais aussi les `mousedown` et
     `mouseup` de compatibilité — et le `click` qu'il en déduit. La cible
     du clic devient donc le `<svg>` entier, jamais le disque touché : les
     clubs avaient cessé de répondre le jour où la capture s'est mise à
     réussir. On retient donc soi-même ce qu'on a touché. */
  let appui = null;

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
    appui = e.target.closest('[data-club-carte]');
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
    /* Clic redirigé par la capture : la cible annoncée est le fond de
       carte, et seul l'appui dit la vérité. Hors de ce cas — bulle,
       outils, clavier — on lit la cible normalement. */
    const g = e.target === svg ? appui : e.target.closest('[data-club-carte]');
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
