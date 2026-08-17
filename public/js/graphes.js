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
export function courbeBilan({ points, paliers = [] }) {
  if (points.length < 2) return '';

  const L = 1000, H = 300, marge = { haut: 12, bas: 12 };
  const hauts = [...points.map(p => p.valeur), ...paliers.map(p => p.points)];
  const max = Math.max(...hauts) * 1.08 || 1;
  const zoneH = H - marge.haut - marge.bas;

  const x = i => (i / (points.length - 1)) * L;
  const y = v => marge.haut + zoneH - (v / max) * zoneH;

  const passe = points.filter(p => !p.futur);
  const iCoupe = Math.max(0, passe.length - 1);
  const futur = points.filter(p => p.futur);

  const trace = (liste, decalage) => liste
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i + decalage).toFixed(1)} ${y(p.valeur).toFixed(1)}`)
    .join(' ');

  return `<div class="courbe-bloc" data-courbe data-boite="0 0 ${L} ${H}">
    <svg viewBox="0 0 ${L} ${H}" preserveAspectRatio="none" role="img"
         aria-label="Bilan mois par mois, avec les paliers de classement">
      ${/* Les paliers d'abord : ils sont le fond sur lequel on lit. */''}
      ${paliers.map(p => `<g class="courbe-palier">
        <line x1="0" y1="${y(p.points).toFixed(1)}" x2="${L}" y2="${y(p.points).toFixed(1)}"/>
        <text class="courbe-palier-nom" x="6" y="${(y(p.points) - 4).toFixed(1)}"
              >${h(p.echelon)}</text>
      </g>`).join('')}

      ${futur.length ? `<line class="g-aujourdhui" x1="${x(iCoupe).toFixed(1)}" y1="0"
            x2="${x(iCoupe).toFixed(1)}" y2="${H}"/>` : ''}

      <path class="g-trace" d="${trace(passe, 0)}"/>
      ${futur.length ? `<path class="g-trace g-trace-futur"
            d="${trace([passe[passe.length - 1], ...futur], iCoupe)}"/>` : ''}

      ${points.map((p, i) => `<circle class="courbe-point ${p.futur ? 'futur' : ''}"
          data-i="${i}" data-x="${x(i).toFixed(2)}" data-y="${y(p.valeur).toFixed(2)}"
          data-label="${h(p.label)}" data-valeur="${p.valeur}"
          data-echelon="${h(p.echelon || '')}" data-detail="${h(p.detail || '')}"
          cx="${x(i).toFixed(2)}" cy="${y(p.valeur).toFixed(2)}" r="4"/>`).join('')}
    </svg>

    <div class="courbe-bulle" hidden>
      <button class="courbe-bulle-fermer" aria-label="Fermer">✕</button>
      <strong class="courbe-bulle-nom"></strong>
      <span class="courbe-bulle-detail tiny muted"></span>
    </div>

    <div class="carte-outils">
      <button class="icon-btn" data-zoom-t="0.7" aria-label="Zoomer">＋</button>
      <button class="icon-btn" data-zoom-t="1.43" aria-label="Dézoomer">−</button>
      <button class="icon-btn" data-recentrer-t aria-label="Tout revoir">⌖</button>
    </div>
  </div>
  <div class="g-axe">
    <span>${h(points[0].label)}</span>
    ${futur.length ? '<span class="g-marque">aujourd\'hui</span>' : ''}
    <span>${h(points[points.length - 1].label)}</span>
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

  const placerBulle = () => {
    if (!choisi) { bulle.hidden = true; return; }
    const r = svg.getBoundingClientRect();
    /* `preserveAspectRatio="none"` : le dessin s'étire pour remplir, donc
       chaque axe a son propre facteur — pas de lettrage à compenser. */
    const px = ((choisi.x - vue[0]) / vue[2]) * r.width;
    const py = ((choisi.y - vue[1]) / vue[3]) * r.height;

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

  const poser = () => { svg.setAttribute('viewBox', vue.join(' ')); placerBulle(); };

  /* On ne zoome que le temps : la largeur change, la hauteur jamais. */
  const bornes = { min: depart[2] / 14, max: depart[2] };
  const zoomer = (facteur, ancreX) => {
    const w = Math.min(bornes.max, Math.max(bornes.min, vue[2] * facteur));
    const vrai = w / vue[2];
    let x0 = ancreX - (ancreX - vue[0]) * vrai;
    // On ne sort pas du temps connu : au-delà, il n'y a rien à regarder.
    x0 = Math.min(Math.max(x0, depart[0]), depart[0] + depart[2] - w);
    vue = [x0, vue[1], w, vue[3]];
    poser();
  };

  const versCourbe = cx => {
    const r = svg.getBoundingClientRect();
    return vue[0] + ((cx - r.left) / r.width) * vue[2];
  };

  bloc.addEventListener('wheel', e => {
    e.preventDefault();
    zoomer(e.deltaY > 0 ? 1.15 : 0.87, versCourbe(e.clientX));
  }, { passive: false });

  bloc.querySelectorAll('[data-zoom-t]').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    zoomer(Number(b.dataset.zoomT), vue[0] + vue[2] / 2);
  }));
  bloc.querySelector('[data-recentrer-t]')?.addEventListener('click', e => {
    e.stopPropagation();
    vue = [...depart];
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
    doigts.set(e.pointerId, { x: e.clientX });
    bouge = false;
  });

  svg.addEventListener('pointermove', e => {
    const avant = doigts.get(e.pointerId);
    if (!avant) return;
    const r = svg.getBoundingClientRect();

    if (doigts.size === 2) {
      const precedent = ecart();
      doigts.set(e.pointerId, { x: e.clientX });
      const nouveau = ecart();
      if (precedent > 0 && nouveau > 0) {
        const c = [...doigts.values()];
        zoomer(precedent / nouveau, versCourbe((c[0].x + c[1].x) / 2));
        bouge = true;
      }
      return;
    }

    const dx = (e.clientX - avant.x) / r.width * vue[2];
    if (Math.abs(e.clientX - avant.x) > 3) bouge = true;
    const x0 = Math.min(Math.max(vue[0] - dx, depart[0]), depart[0] + depart[2] - vue[2]);
    vue = [x0, vue[1], vue[2], vue[3]];
    doigts.set(e.pointerId, { x: e.clientX });
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
    if (e.target.closest('.courbe-bulle, .carte-outils')) return;

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
