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
