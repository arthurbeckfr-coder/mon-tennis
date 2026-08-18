/* Les graphiques.

   Deux règles gouvernent ce fichier, et elles ne sont pas décoratives.

   La couleur ne porte jamais seule l'information. Le vert et le rouge de
   « victoire / défaite », qui semblaient évidents, ont été mesurés : en
   deutéranopie ils sont à 2,6 d'écart perceptuel quand il en faut 6 au
   minimum — autrement dit un daltonien ne distingue pas une barre de
   victoire d'une barre de défaite. Le bleu et l'orange retenus ici sont à
   24,7 et passent tous les contrôles dans les deux thèmes. Et de toute
   façon chaque barre porte son chiffre écrit : on peut lire ces graphiques
   en noir et blanc.

   Rien n'est dessiné en dur : les couleurs viennent des variables CSS, si
   bien que le passage en sombre ne redessine rien.

   Les barres sont en HTML plutôt qu'en SVG — elles se redimensionnent
   toutes seules avec la colonne, et un graphique de téléphone n'a pas
   besoin de plus. La courbe, elle, est en SVG : c'est le seul moyen de
   tracer une ligne continue et une ligne de seuil au bon endroit. */

import { h } from './util.js';

/**
 * Barres groupées : un groupe par catégorie, une barre par série.
 * @param {object} o
 * @param {Array<{label:string, valeurs:number[]}>} o.groupes
 * @param {Array<{nom:string}>} o.series  — deux au plus (slots 1 et 2)
 * @param {string} [o.unite]
 */
export function barresGroupees({ groupes, series, unite = '', axe = '', ouvert = null }) {
  if (!groupes.length) return '';
  const max = Math.max(1, ...groupes.flatMap(g => g.valeurs));

  /* Une colonne s'ouvre sur les matchs qu'elle compte, quand l'appelant
     dit sur quel axe il range (`axe`) et donne une clé à chaque groupe.
     Sans cela le graphique reste ce qu'il était : une image. Un chiffre
     qu'on ne peut pas ouvrir se croit sur parole. */
  const cliquable = !!axe;

  return `
    ${series.length > 1 ? `<div class="g-legende">
      ${series.map((s, i) => `<span class="g-cle">
        <span class="g-pastille s${i + 1}"></span>${h(s.nom)}</span>`).join('')}
    </div>` : ''}
    <div class="g-barres">
      ${groupes.map(g => {
        const cle = g.cle ?? g.label;
        const actif = cliquable && ouvert === cle;
        return `<div class="g-groupe ${cliquable ? 'g-cliquable' : ''} ${actif ? 'actif' : ''}"
          ${cliquable ? `data-axe="${h(axe)}" data-cle="${h(cle)}" role="button" tabindex="0"
            aria-pressed="${actif}" title="Voir ces matchs"` : ''}>
        <div class="g-piles">
          ${g.valeurs.map((v, i) => `<div class="g-pile">
            <span class="g-valeur">${v || ''}</span>
            <div class="g-barre s${i + 1}" style="height:${Math.round((v / max) * 100)}%"
                 title="${h(g.label)} — ${h(series[i]?.nom || '')} : ${v}${h(unite)}"></div>
          </div>`).join('')}
        </div>
        <span class="g-label">${h(g.label)}</span>
      </div>`;
      }).join('')}
    </div>`;
}

/**
 * Courbe d'une grandeur dans le temps, avec une ligne de seuil et un
 * repère « aujourd'hui ».
 * @param {object} o
 * @param {Array<{label:string, valeur:number, futur?:boolean}>} o.points
 * @param {number} [o.seuil]
 * @param {string} [o.nomSeuil]
 */
/**
 * La courbe du bilan dans le temps, avec les paliers de classement.
 *
 * Une courbe de points ne dit pas ce qu'on perd : soixante points peuvent
 * ne rien coûter, ou coûter deux échelons. Les paliers tracés derrière la
 * courbe donnent la réponse d'un coup d'œil — on voit le trait passer
 * sous « 15 », puis sous « 15/1 », et l'on sait ce que l'attente coûte
 * pour de bon.
 *
 * On se déplace et l'on zoome sur le temps seulement : l'axe vertical est
 * une échelle de points, où un grossissement n'apprendrait rien. Chaque
 * point s'ouvre sur ce qu'il vaut, en HTML par-dessus le dessin, pour que
 * le texte garde sa taille de lecture à tous les zooms.
 *
 * @param {object} o
 * @param {Array<{label, valeur, futur?, echelon?, detail?}>} o.points
 * @param {Array<{echelon: string, points: number}>} [o.paliers]
 */
export function courbeBilan({ points, paliers = [], actuel = '' }) {
  if (points.length < 2) return '';

  const L = 1000, H = 300, marge = { haut: 12, bas: 12 };
  const hauts = [...points.map(p => p.valeur), ...paliers.map(p => p.points)];
  const max = Math.max(...hauts) * 1.08 || 1;
  const zoneH = H - marge.haut - marge.bas;

  const x = i => (i / (points.length - 1)) * L;
  const y = v => marge.haut + zoneH - (v / max) * zoneH;

  /* Les bandes, un mois chacune. Elles étaient annuelles : sur deux ans
     de projection cela faisait trois teintes en tout, et l'on ne pouvait
     pas dire si une chute avait pris deux mois ou huit. Un point vaut un
     mois — la bande est donc l'intervalle qui sépare deux points, et
     l'alternance des teintes fait une règle graduée.

     Le millésime n'est plus écrit dessus : l'axe du bas le porte déjà
     dans « oct. 25 », et douze étiquettes par an sur le dessin
     répéteraient ce qui est écrit dessous. */
  const bandes = points.slice(0, -1).map((p, i) => ({ x0: x(i), x1: x(i + 1) }));

  const passe = points.filter(p => !p.futur);
  const iCoupe = Math.max(0, passe.length - 1);
  const futur = points.filter(p => p.futur);

  const trace = (liste, decalage) => liste
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i + decalage).toFixed(1)} ${y(p.valeur).toFixed(1)}`)
    .join(' ');

  return `<div class="courbe-bloc" data-courbe data-boite="0 0 ${L} ${H}">
    <svg viewBox="0 0 ${L} ${H}" preserveAspectRatio="none" role="img"
         aria-label="Bilan mois par mois, avec les paliers de classement">
      ${/* ─── Les mois, en bandes alternées ──────────────────────────

            Un axe qui ne dit que « août 23 » à gauche et « août 28 » à
            droite laisse deviner cinq ans entre les deux. On ne sait pas
            où tombe telle chute, ni si elle dure deux mois ou huit.

            Des bandes alternées répondent sans rien ajouter à lire : un
            mois sur deux est très légèrement teinté, et l'on compte les
            bandes comme on compte les graduations d'une règle. C'est le
            procédé des diagrammes de Gantt, et il se lit sans légende. */''}
      ${bandes.map((b, i) => `<rect class="courbe-mois${i % 2 ? ' paire' : ''}"
          x="${b.x0.toFixed(1)}" y="0" width="${(b.x1 - b.x0).toFixed(1)}" height="${H}"/>`).join('')}
      ${/* Les paliers ensuite : ils sont le fond sur lequel on lit. */''}
      ${/* Les lignes restent dans le dessin : horizontales, elles ne
            souffrent pas de l'étirement. Les noms, eux, en sortent — voir
            plus bas. */''}
      ${paliers.map(p => `<line class="courbe-palier-ligne${p.echelon === actuel ? ' courant' : ''}"
          x1="0" y1="${y(p.points).toFixed(1)}" x2="${L}" y2="${y(p.points).toFixed(1)}"/>`).join('')}

      ${futur.length ? `<line class="g-aujourdhui" x1="${x(iCoupe).toFixed(1)}" y1="0"
            x2="${x(iCoupe).toFixed(1)}" y2="${H}"/>` : ''}

      <path class="g-trace" d="${trace(passe, 0)}"/>
      ${futur.length ? `<path class="g-trace g-trace-futur"
            d="${trace([passe[passe.length - 1], ...futur], iCoupe)}"/>` : ''}

      ${/* Les points de chaque mois ne se voient plus. Soixante pastilles
            sur une courbe qui descend n'apprenaient rien de plus que le
            trait lui-même, et brouillaient les paliers qu'on vient
            justement lire. Ils restent dans le dessin, invisibles, parce
            que c'est encore eux qu'on ouvre au toucher : ce qu'on désigne
            n'a pas à être ce qu'on voit. */''}
      ${points.map((p, i) => `<circle class="courbe-point ${p.futur ? 'futur' : ''}"
          data-i="${i}" data-x="${x(i).toFixed(2)}" data-y="${y(p.valeur).toFixed(2)}"
          data-label="${h(p.label)}" data-valeur="${p.valeur}"
          data-echelon="${h(p.echelon || '')}" data-detail="${h(p.detail || '')}"
          cx="${x(i).toFixed(2)}" cy="${y(p.valeur).toFixed(2)}" r="7"/>`).join('')}
    </svg>

    ${/* ─── Pourquoi les noms des paliers ne sont pas dans le SVG ─────

          Le dessin est étiré pour remplir la largeur — c'est ce qui permet
          à la courbe de s'allonger quand on zoome sur le temps sans que
          l'échelle des points bouge. Mais un texte placé dedans subit le
          même étirement : en zoomant, les noms devenaient énormes et
          déformés, jusqu'à recouvrir la courbe qu'ils devaient servir.

          Ils vivent donc en HTML au-dessus du dessin, comme les bulles.
          Ils gardent leur taille de lecture à tous les zooms, ne se
          déforment pas, et restent au bord gauche sans qu'on ait à les y
          recoller à la main. */''}
    ${/* Le nom, et le nombre de points qu'il demande. Les deux tenaient
          mal quand il y avait six lignes — une colonne de texte au bord
          gauche, plus large que ce qu'elle annotait. À trois, la place
          existe, et le chiffre est la moitié de l'information : savoir
          qu'on tient 15 ne dit pas qu'il y faut 360 points. */''}
    <div class="courbe-paliers">
      ${paliers.map(p => `<span class="courbe-palier-nom${p.echelon === actuel ? ' courant' : ''}"
          title="${h(p.echelon)} — ${p.points} points"
          data-y="${y(p.points).toFixed(2)}">${h(p.echelon)} · ${p.points} pts</span>`).join('')}
    </div>

    ${/* La pastille du point choisi vit en HTML, comme la bulle. Dans le
          dessin, elle subissait l'étirement des deux axes — qui ne sont
          pas au même facteur — et se déformait en une grosse olive verte
          d'autant plus grosse qu'on zoomait. Un rond reste un rond quand
          il est posé par-dessus. */''}
    <span class="courbe-choisi" hidden></span>

    <div class="courbe-bulle" hidden>
      <button class="courbe-bulle-fermer" aria-label="Fermer">✕</button>
      <strong class="courbe-bulle-nom"></strong>
      <span class="courbe-bulle-detail tiny muted"></span>
    </div>

    ${/* Les commandes tiennent dans un coin. Un bloc de trois grosses
          touches au milieu du dessin cachait la courbe qu'il servait à
          regarder — et ici, contrairement à la carte des clubs, le doigt
          et la molette suffisent presque toujours. */''}
    <div class="courbe-outils">
      <button class="icon-btn" data-zoom-t="0.72" aria-label="Zoomer">＋</button>
      <button class="icon-btn" data-zoom-t="1.4" aria-label="Dézoomer">−</button>
      <button class="icon-btn" data-recentrer-t aria-label="Tout revoir">⌖</button>
    </div>
  </div>

  ${/* ─── Les dates, sous le cadre ────────────────────────────────

        Deux libellés aux extrémités ne disent pas quand : « août 23 » à
        gauche, « août 31 » à droite, et huit ans à deviner entre les
        deux. On pose donc de vrais repères, comme sur un axe. Ils sont
        tous écrits, et c'est le placement qui décide lesquels se voient
        — un sur trois, un sur six, selon la place : en s'approchant, les
        mois remplacent les années sans qu'on ait à redessiner. */''}
  <div class="courbe-dates">
    ${points.map((p, i) => `<span class="courbe-date" data-x="${x(i).toFixed(1)}"
        hidden>${h(p.label)}</span>`).join('')}
    ${futur.length ? `<span class="courbe-date courbe-jour"
        data-x="${x(iCoupe).toFixed(1)}" hidden>aujourd'hui</span>` : ''}
  </div>`;
}

/**
 * Rend la courbe manipulable : glisser et zoomer sur le temps, toucher un
 * point pour savoir ce qu'il vaut.
 *
 * Même principe que la carte — on agit sur le viewBox, et la bulle vit en
 * HTML par-dessus — mais sur un seul axe : le temps. Zoomer sur les points
 * n'apprendrait rien, l'échelle verticale étant déjà lisible en entier.
 */
export function brancherCourbe(racine) {
  const bloc = racine.querySelector('[data-courbe]');
  if (!bloc) return;
  const svg = bloc.querySelector('svg');
  const depart = bloc.dataset.boite.split(' ').map(Number);
  const bulle = bloc.querySelector('.courbe-bulle');

  let vue = [...depart];
  let choisi = null;

  const pastille = bloc.querySelector('.courbe-choisi');

  const placerBulle = () => {
    if (!choisi) { bulle.hidden = true; if (pastille) pastille.hidden = true; return; }
    const r = svg.getBoundingClientRect();
    /* `preserveAspectRatio="none"` : le dessin s'étire pour remplir, donc
       chaque axe a son propre facteur — pas de lettrage à compenser. */
    const px = ((choisi.x - vue[0]) / vue[2]) * r.width;
    const py = ((choisi.y - vue[1]) / vue[3]) * r.height;

    if (pastille) {
      pastille.hidden = px < 0 || px > r.width || py < 0 || py > r.height;
      pastille.style.left = `${px}px`;
      pastille.style.top = `${py}px`;
    }

    bulle.hidden = px < -30 || px > r.width + 30;
    if (bulle.hidden) return;

    bulle.style.left = `${px}px`;
    bulle.style.top = `${py}px`;
    bulle.style.setProperty('--pointe', '50%');

    const cadre = bloc.getBoundingClientRect();
    const p = bulle.getBoundingClientRect();
    const marge = 8;
    const trop = Math.max(0, (cadre.left + marge) - p.left)
               - Math.max(0, p.right - (cadre.right - marge));
    if (trop) {
      bulle.style.left = `${px + trop}px`;
      bulle.style.setProperty('--pointe', `${50 - (trop / p.width) * 100}%`);
    }
  };

  /* Les noms des paliers, posés à la hauteur de leur ligne. Deux échelons
     voisins tiennent parfois à quinze points, et leurs noms se
     recouvriraient : on les écarte de proche en proche, du haut vers le
     bas, sans jamais toucher aux lignes — c'est le texte qui gêne, pas la
     mesure. */
  const etiquettes = [...bloc.querySelectorAll('.courbe-palier-nom')]
    .sort((a, b) => Number(a.dataset.y) - Number(b.dataset.y));

  /* ─── Le zoom porte sur les deux axes ───────────────────────────────

     Zoomer sur le seul temps laissait les paliers aussi serrés qu'au
     départ : entre 305 et 335 points, quatre échelons tiennent dans un
     centimètre, et s'approcher n'y changeait rien — on voyait la courbe
     s'allonger sans jamais voir où elle passe.

     Le cadre se resserre donc aussi en hauteur, du même facteur. C'est
     ce que fait n'importe quel graphique qu'on pince : les deux axes
     suivent le doigt, et l'écart entre deux classements s'ouvre avec le
     reste. Le cadrage d'origine, lui, tient tout : les points et les
     paliers qui les encadrent — une courbe sans ses seuils ne dirait
     rien de ce qu'elle coûte. */
  const mesures = [...bloc.querySelectorAll('.courbe-point')]
    .map(c => ({ x: Number(c.dataset.x), y: Number(c.dataset.y),
                 futur: c.classList.contains('futur') }));
  const niveaux = [...bloc.querySelectorAll('.courbe-palier-ligne')]
    .map(l => Number(l.getAttribute('y1')));

  /** Tout ce qu'il y a à voir : la courbe entière et les paliers qui
 *  l'encadrent. C'est la borne du dézoom — au-delà, il n'y a rien. */
  const cadrageTotal = () => {
    if (!mesures.length) return [...depart];
    /* La courbe et les trois traits, tous dedans. On ne retenait avant
       que le palier immédiatement au-dessus et celui immédiatement en
       dessous — une prudence utile quand on en dessinait vingt, absurde
       depuis qu'il n'y en a plus que trois : un bilan resté sous ses trois
       seuils les faisait tous sortir du cadre par le haut, et l'on voyait
       une courbe sans aucune règle pour la juger. */
    const haut = Math.min(...mesures.map(m => m.y), ...niveaux);
    const bas = Math.max(...mesures.map(m => m.y), ...niveaux);
    const marge = Math.max((bas - haut) * 0.12, 14);
    return [depart[0], haut - marge, depart[2], (bas - haut) + marge * 2];
  };

  /** ─── Où l'œil doit tomber en arrivant ───────────────────────────
 *
 *  Deux exigences se contredisent, et tout est dans leur équilibre.
 *
 *  Voir la courbe : c'est le sujet du dessin, et un cadre serré sur les
 *  deux traits n'en montrerait qu'une poignée de mois — le reste
 *  au-dessus et en dessous, hors champ.
 *
 *  Voir les deux traits séparément : quinze points séparent un échelon
 *  du suivant, et sur une échelle de six cents cela fait six pixels.
 *  Les noms se marchent dessus et l'on ne sait plus lequel on lit.
 *
 *  D'où la règle : le cadre se cale sur la partie récente de la courbe
 *  — les douze derniers mois et la projection —, en écartant les valeurs
 *  extrêmes, car un pic d'il y a deux ans ne doit pas décider de
 *  l'échelle d'aujourd'hui. Les deux traits entrent toujours dedans.
 *
 *  Rien ne borne plus la hauteur du cadre : c'est la courbe qui décide,
 *  et deux traits proches ne se confondent plus depuis que leurs noms
 *  changent de côté au lieu de se pousser. Mieux vaut deux lignes serrées
 *  et une courbe lisible que l'inverse.
 *
 *  Ce qui dépasse n'est pas perdu : le dézoom va jusqu'au cadrage total,
 *  et le glissement vertical avec lui.
 */
  const cadrageEntier = () => {
    const total = cadrageTotal();
    if (!mesures.length || !niveaux.length) return total;

    const hautP = Math.min(...niveaux), basP = Math.max(...niveaux);
    const passes = mesures.filter(m => !m.futur);
    const auj = passes.length ? passes[passes.length - 1].y : hautP;

    /* La partie récente : la projection, et l'année écoulée. */
    const recents = [...mesures.filter(m => m.futur), ...passes.slice(-12)];
    const ys = recents.map(m => m.y).sort((a, b) => a - b);
    const q = p => ys[Math.min(ys.length - 1, Math.max(0, Math.round(p * (ys.length - 1))))];

    let haut = Math.min(hautP, auj, q(0.08));
    let bas = Math.max(basP, auj, q(0.92));

    const marge = Math.max((bas - haut) * 0.12, 8);
    haut -= marge; bas += marge;

    /* Pas de plafond sur la hauteur : la courbe doit se voir en entier sur
       la période qui compte, et deux traits trop proches ne se confondent
       plus depuis que leurs noms changent de côté au lieu de se pousser.
       Mieux vaut deux lignes serrées et une courbe lisible que l'inverse. */
    const hh = bas - haut;

    if (hh >= total[3]) return total;
    const y0 = Math.min(Math.max(haut, total[1]), total[1] + total[3] - hh);
    return [total[0], y0, total[2], hh];
  };
  /** Les noms des paliers, chacun à la hauteur de sa ligne.
   *
   *  Ils se poussaient l'un l'autre vers le bas quand ils se touchaient :
   *  entre 15 et 5/6 il y a quinze points, soit une vingtaine de pixels,
   *  et deux libellés de quinze pixels de haut n'y tiennent pas tout à
   *  fait. Le nom finissait à côté de sa ligne, ce qui est pire que de le
   *  cacher : on lit un chiffre en face d'un trait qui n'est pas le sien.
   *
   *  Ils changent donc de côté plutôt que de hauteur — le premier à
   *  gauche, celui qui le gênerait à droite — et chacun reste exactement
   *  en face de son trait. Il n'y en a que trois : deux côtés suffisent.
   *  Le décalage vertical ne sert plus que de dernier recours, si les
   *  deux bords sont pris à la même hauteur. */
  const placerPaliers = () => {
    const r = svg.getBoundingClientRect();
    if (!r.height) return;

    const poses = [];                       // [haut, bas, côté]
    const gene = (haut, bas, cote) =>
      poses.some(p => p[2] === cote && !(haut > p[1] + 2 || bas < p[0] - 2));

    for (const el of etiquettes) {
      const px = ((Number(el.dataset.y) - vue[1]) / vue[3]) * r.height;
      el.hidden = px < -20 || px > r.height + 20;
      if (el.hidden) continue;

      const h = el.offsetHeight || 15;
      let haut = px - h / 2;
      let cote = 'gauche';

      if (gene(haut, haut + h, 'gauche')) {
        if (!gene(haut, haut + h, 'droite')) cote = 'droite';
        else haut = Math.max(...poses.map(p => p[1])) + 2;
      }

      el.classList.toggle('a-droite', cote === 'droite');
      el.style.top = `${haut}px`;
      poses.push([haut, haut + h, cote]);
    }
  };
  /* La rangée des dates est sœur du cadre, et non dedans : elle se lit
     sous le dessin, à la même largeur que lui. */
  const rangeeDates = bloc.parentElement?.querySelector('.courbe-dates');
  const datesDom = rangeeDates ? [...rangeeDates.querySelectorAll('.courbe-date')] : [];
  const placerDates = () => {
    const r = svg.getBoundingClientRect();
    if (!r.width || !datesDom.length) return;

    const px = el => ((Number(el.dataset.x) - vue[0]) / vue[2]) * r.width;
    const jour = rangeeDates?.querySelector('.courbe-jour');

    /* « aujourd'hui » se pose en premier et les autres l'évitent : c'est
       le repère qu'on cherche d'abord, et le laisser passer après les
       mois le faisait chevaucher son voisin : « juin 26 aujourd'hui »
       imprimés l'un sur l'autre. */
    const poses = [];
    const libre = (g, large) => poses.every(p => g > p[1] + 12 || g + large < p[0] - 12);

    const poser1 = el => {
      /* On mesure visible : `offsetWidth` vaut zéro sur un élément replié,
         et toutes les dates se croiraient alors minuscules. */
      el.hidden = false;
      const large = el.offsetWidth;
      const gauche = px(el) - large / 2;
      if (gauche < -2 || gauche + large > r.width + 2 || !libre(gauche, large)) {
        el.hidden = true;
        return;
      }
      el.style.left = `${gauche}px`;
      poses.push([gauche, gauche + large]);
    };

    if (jour) poser1(jour);
    for (const el of datesDom) if (el !== jour) poser1(el);
  };

  const poser = () => {
    svg.setAttribute('viewBox', vue.join(' '));
    placerPaliers();
    placerDates();
    placerBulle();
  };

  const total = cadrageTotal();
  const entier = cadrageEntier();
  vue = [...entier];
  const bornes = { min: depart[2] / 16, max: depart[2],
                   minH: entier[3] / 16, maxH: total[3] };

  const zoomer = (facteur, ancreX, ancreY) => {
    const w = Math.min(bornes.max, Math.max(bornes.min, vue[2] * facteur));
    const hh = Math.min(bornes.maxH, Math.max(bornes.minH, vue[3] * facteur));
    let x0 = ancreX - (ancreX - vue[0]) * (w / vue[2]);
    // On ne sort pas du temps connu : au-delà, il n'y a rien à regarder.
    x0 = Math.min(Math.max(x0, depart[0]), depart[0] + depart[2] - w);

    /* Verticalement, la borne est tout ce qui est tracé : on s'échappe
       jusqu'au sommet de la courbe, et pas au-delà. */
    const cy = ancreY == null ? vue[1] + vue[3] / 2 : ancreY;
    let y0 = cy - (cy - vue[1]) * (hh / vue[3]);
    y0 = Math.min(Math.max(y0, total[1]), total[1] + total[3] - hh);

    vue = [x0, y0, w, hh];
    poser();
  };

  const versCourbe = cx => {
    const r = svg.getBoundingClientRect();
    return vue[0] + ((cx - r.left) / r.width) * vue[2];
  };
  const versCourbeY = cy => {
    const r = svg.getBoundingClientRect();
    return vue[1] + ((cy - r.top) / r.height) * vue[3];
  };

  bloc.addEventListener('wheel', e => {
    e.preventDefault();
    zoomer(e.deltaY > 0 ? 1.15 : 0.87, versCourbe(e.clientX), versCourbeY(e.clientY));
  }, { passive: false });

  bloc.querySelectorAll('[data-zoom-t]').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    zoomer(Number(b.dataset.zoomT), vue[0] + vue[2] / 2, vue[1] + vue[3] / 2);
  }));
  bloc.querySelector('[data-recentrer-t]')?.addEventListener('click', e => {
    e.stopPropagation();
    vue = [...entier];
    poser();
  });

  const doigts = new Map();
  let bouge = false;
  const ecart = () => {
    const [a, b] = [...doigts.values()];
    return Math.abs(a.x - b.x);
  };

  svg.addEventListener('pointerdown', e => {
    try { svg.setPointerCapture(e.pointerId); } catch { /* tant pis */ }
    doigts.set(e.pointerId, { x: e.clientX, y: e.clientY });
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
        const c = [...doigts.values()];
        zoomer(precedent / nouveau, versCourbe((c[0].x + c[1].x) / 2),
               versCourbeY((c[0].y + c[1].y) / 2));
        bouge = true;
      }
      return;
    }

    const dx = (e.clientX - avant.x) / r.width * vue[2];
    const dy = (e.clientY - avant.y) / r.height * vue[3];
    if (Math.abs(e.clientX - avant.x) + Math.abs(e.clientY - avant.y) > 3) bouge = true;
    const x0 = Math.min(Math.max(vue[0] - dx, depart[0]), depart[0] + depart[2] - vue[2]);
    /* Zoomé, on se déplace aussi de haut en bas — sans quoi on ne verrait
       jamais ce qui sort du cadre, à commencer par le sommet de la courbe
       quand le cadrage d'arrivée s'est resserré sur les paliers. */
    const y0 = Math.min(Math.max(vue[1] - dy, total[1]), total[1] + total[3] - vue[3]);
    vue = [x0, y0, vue[2], vue[3]];
    doigts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    poser();
  });

  const lacher = e => doigts.delete(e.pointerId);
  svg.addEventListener('pointerup', lacher);
  svg.addEventListener('pointercancel', lacher);

  bulle.querySelector('.courbe-bulle-fermer').addEventListener('click', e => {
    e.stopPropagation();
    choisi = null;
    bulle.hidden = true;
    bloc.querySelectorAll('.courbe-point.choisi').forEach(p => p.classList.remove('choisi'));
  });

  /* Viser un cercle de quatre pixels au pouce est illusoire : on prend le
     point le plus proche horizontalement du doigt, ce qui revient à
     désigner un mois plutôt qu'une cible. */
  bloc.addEventListener('click', e => {
    if (bouge) { bouge = false; return; }
    if (e.target.closest('.courbe-bulle, .courbe-outils')) return;

    const rs = svg.getBoundingClientRect();
    const xVue = versCourbe(e.clientX);
    let proche = null, ecartMin = Infinity;
    for (const c of bloc.querySelectorAll('.courbe-point')) {
      const d = Math.abs(Number(c.dataset.x) - xVue);
      if (d < ecartMin) { ecartMin = d; proche = c; }
    }
    // Au-delà d'un dixième de la vue, on visait le vide : on referme.
    if (!proche || ecartMin > vue[2] / 10) {
      choisi = null; bulle.hidden = true;
      bloc.querySelectorAll('.courbe-point.choisi').forEach(p => p.classList.remove('choisi'));
      return;
    }

    bloc.querySelectorAll('.courbe-point').forEach(p => p.classList.toggle('choisi', p === proche));
    choisi = { x: Number(proche.dataset.x), y: Number(proche.dataset.y) };
    bulle.querySelector('.courbe-bulle-nom').textContent =
      `${proche.dataset.label} — ${proche.dataset.valeur} pts`;
    bulle.querySelector('.courbe-bulle-detail').textContent = proche.dataset.detail;
    bulle.hidden = false;
    placerBulle();
    void rs;
  });

  poser();
  /* Une seconde passe au tour suivant, et à chaque changement de taille.
     Au premier affichage, le dessin n'a pas toujours sa hauteur définitive
     — une police qui se pose, un pli qui s'ouvre au-dessus — et tout ce
     qui se place en pixels tomberait alors à zéro : les noms des paliers
     s'empileraient en haut à gauche, tous à la même place. */
  requestAnimationFrame(poser);
  if (window.ResizeObserver) new ResizeObserver(poser).observe(svg);
}

export function courbe({ points, seuil = null, nomSeuil = '' }) {
  if (points.length < 2) return '';

  const L = 320, H = 120, marge = { haut: 10, bas: 4, gauche: 4, droite: 4 };
  const max = Math.max(seuil ?? 0, ...points.map(p => p.valeur)) * 1.1 || 1;
  const zoneH = H - marge.haut - marge.bas;

  const x = i => marge.gauche + (i / (points.length - 1)) * (L - marge.gauche - marge.droite);
  const y = v => marge.haut + zoneH - (v / max) * zoneH;

  const passe = points.filter(p => !p.futur);
  const futur = points.filter(p => p.futur);
  const iCoupe = passe.length - 1;

  const chemin = (liste, decalage) => liste
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i + decalage).toFixed(1)} ${y(p.valeur).toFixed(1)}`)
    .join(' ');

  /* Le futur est en pointillé : c'est une projection, pas une mesure, et
     rien ne doit laisser croire le contraire. */
  const cheminFutur = futur.length
    ? chemin([passe[passe.length - 1], ...futur], iCoupe) : '';

  return `<svg class="g-courbe" viewBox="0 0 ${L} ${H}" preserveAspectRatio="none"
               role="img" aria-label="Évolution du bilan">
    ${seuil != null ? `
      <line class="g-seuil" x1="0" y1="${y(seuil).toFixed(1)}"
            x2="${L}" y2="${y(seuil).toFixed(1)}"/>` : ''}
    <path class="g-trace" d="${chemin(passe, 0)}"/>
    ${cheminFutur ? `<path class="g-trace g-trace-futur" d="${cheminFutur}"/>` : ''}
    ${futur.length ? `<line class="g-aujourdhui" x1="${x(iCoupe).toFixed(1)}" y1="${marge.haut}"
          x2="${x(iCoupe).toFixed(1)}" y2="${H - marge.bas}"/>` : ''}
    ${points.map((p, i) => `<circle class="g-point ${p.futur ? 'futur' : ''}"
        cx="${x(i).toFixed(1)}" cy="${y(p.valeur).toFixed(1)}" r="2.6">
        <title>${h(p.label)} : ${p.valeur}</title></circle>`).join('')}
  </svg>
  <div class="g-axe">
    <span>${h(points[0].label)}</span>
    ${futur.length ? `<span class="g-marque">aujourd'hui</span>` : ''}
    <span>${h(points[points.length - 1].label)}</span>
  </div>
  ${seuil != null && nomSeuil
    ? `<p class="tiny muted">Le trait marque ${h(nomSeuil)}.</p>` : ''}`;
}

/** Le tableau qui double le graphique : une courbe ne se lit pas au
 *  lecteur d'écran, et un chiffre exact se cherche parfois. */
export function tableauDouble(entetes, lignes) {
  return `<details class="g-tableau">
    <summary>Voir les chiffres</summary>
    <div class="tableau-defile">
      <table class="rendement">
        <thead><tr>${entetes.map(e => `<th>${h(e)}</th>`).join('')}</tr></thead>
        <tbody>
          ${lignes.map(l => `<tr>${l.map(c => `<td>${h(c)}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
    </div>
  </details>`;
}
