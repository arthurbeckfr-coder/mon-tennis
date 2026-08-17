/* L'historique des matchs.

   Un historique ne sert pas à collectionner : il sert à répondre à des
   questions qu'on se pose vraiment. Est-ce que je gagne contre plus fort
   que moi ? Est-ce que je perds toujours contre les gauchers ? Les
   compteurs du haut sont là pour ça, et non pour décorer. */

import { h, hMulti, dateCourte, puce, dansLesDouzeMois } from '../util.js';
import { store, bilanMatchs, surfaceDuMatch, estParEquipes, saisonEquipe,
         tournoisRemportes } from '../store.js';
import { pointsVictoire, rang, ECHELONS } from '../classement.js';
import { matchForm, importFFTForm } from '../forms.js';
import { barresGroupees, tableauDouble } from '../graphes.js';

let filtre = { periode: '12', issue: 'tout', texte: '', exploit: false };
let ongletVue = 'liste';

/** Une victoire contre mieux classé que soi. Le seul compteur du haut qui
 *  ne se lit pas directement dans la liste, et le plus parlant des quatre. */
const estExploit = m =>
  m.issue === 'V' && rang(m.echelonAdverse) > rang(store.profil.echelon);

function filtrer() {
  return store.matchs
    .filter(m => filtre.periode === 'tout' || dansLesDouzeMois(m.date))
    .filter(m => filtre.issue === 'tout' || m.issue === filtre.issue)
    .filter(m => !filtre.exploit || estExploit(m))
    .filter(m => {
      if (!filtre.texte) return true;
      const t = filtre.texte.toLowerCase();
      return [m.adversaire, m.tournoi, m.notes, m.echelonAdverse]
        .some(v => (v || '').toLowerCase().includes(t));
    })
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

/* ─── Les compteurs cliquables ─────────────────────────────────────────

   Un chiffre qu'on ne peut pas ouvrir est une affirmation qu'il faut
   croire. « 4 victoires contre plus fort » ne vaut que si l'on peut
   demander lesquelles — et c'est d'ailleurs la première chose qu'on a
   envie de faire en le lisant.

   Chaque compteur emmène donc vers exactement les matchs qu'il a comptés,
   fenêtre de douze mois comprise. Recliquer sur un compteur déjà ouvert
   le referme : sans quoi on se retrouve prisonnier d'un filtre sans
   savoir comment en sortir. */
const FILTRES = {
  tout:    { periode: '12', issue: 'tout', exploit: false },
  V:       { periode: '12', issue: 'V',    exploit: false },
  D:       { periode: '12', issue: 'D',    exploit: false },
  exploit: { periode: '12', issue: 'V',    exploit: true  },
};

function filtreActif(cle) {
  if (cle === 'exploit') return filtre.exploit;
  if (filtre.exploit) return false;
  return cle === 'tout'
    ? filtre.periode === '12' && filtre.issue === 'tout'
    : filtre.issue === cle;
}

/** « 95 » se lit mal ; « 1 h 35 » se lit d'un coup. En dessous de l'heure
 *  on garde les minutes, qui restent plus parlantes. */
export const direDuree = min => {
  const n = Number(min);
  if (!n || n <= 0) return '';
  return n < 60 ? `${n} min` : `${Math.floor(n / 60)} h ${String(n % 60).padStart(2, '0')}`;
};

/** Le détail qui manque partout ailleurs : ce que la victoire a rapporté. */
function ligneMatch(m) {
  const pts = m.issue === 'V' && !m.wo
    ? pointsVictoire(store.profil.echelon, m.echelonAdverse, store.bareme) : 0;
  const ecart = rang(m.echelonAdverse) - rang(store.profil.echelon);
  const exploit = m.issue === 'V' && ecart >= 1;

  return `<li class="match ${m.issue === 'V' ? 'gagne' : 'perdu'}" data-id="${h(m.id)}">
    <div class="match-issue">${m.issue === 'V' ? 'V' : 'D'}</div>
    <div class="match-corps">
      <div class="match-tete">
        <strong>${h(m.adversaire || 'Adversaire inconnu')}</strong>
        ${puce(m.echelonAdverse, ecart > 0 ? 'puce-fort' : ecart < 0 ? 'puce-faible' : '')}
        ${exploit ? '<span class="exploit" title="Victoire contre plus fort que toi">🔥</span>' : ''}
      </div>
      <div class="match-bas">
        <span>${h(dateCourte(m.date))}</span>
        ${m.score ? `<span>${h(m.score)}</span>` : ''}
        ${m.tournoi ? `<span class="muted">${h(m.tournoi)}</span>` : ''}
        ${m.duree ? `<span class="muted">${direDuree(m.duree)}</span>` : ''}
        ${m.wo ? puce('non joué') : ''}
      </div>
      ${m.notes ? `<p class="match-note">${hMulti(m.notes)}</p>` : ''}
    </div>
    ${pts ? `<div class="match-points">+${pts}</div>` : ''}
  </li>`;
}

/* ─── Les statistiques ─────────────────────────────────────────────────

   Quatre questions, quatre graphiques, et aucun pour décorer.

   « Est-ce que je joue plus, et est-ce que je gagne plus » se lit par
   année. « À quel niveau je tiens vraiment » se lit par classement
   d'adversaire — c'est le plus utile des quatre, parce qu'il dit à partir
   d'où ça casse. « Où je me sens bien » se lit par surface. Et « est-ce
   que je joue pareil pour mon club et pour moi » se lit par type
   d'épreuve : un tournoi ne se joue pas comme une rencontre par équipes,
   et le chiffre le dit assez brutalement.

   Chaque colonne s'ouvre sur les matchs qu'elle compte. C'est la
   différence entre une statistique et une affirmation : « 45 % par
   équipes » ne veut rien dire tant qu'on ne peut pas demander lesquels. */

/* L'axe cliqué, et la colonne ouverte. Un seul détail à la fois : deux
   panneaux ouverts sur deux graphiques différents ne se comparent pas,
   ils se gênent. */
let detail = null;

const AXES = {
  annee: {
    titre: c => `Mes matchs en ${c}`,
    porte: (m, c) => (m.date || '').slice(0, 4) === c,
  },
  echelon: {
    titre: c => `Mes matchs contre des ${c}`,
    porte: (m, c) => m.echelonAdverse === c,
  },
  surface: {
    titre: c => c === '?' ? 'Mes matchs à surface inconnue' : `Mes matchs sur ${c.toLowerCase()}`,
    porte: (m, c) => (surfaceDuMatch(m).surface || '?') === c,
  },
  epreuve: {
    titre: c => c === 'equipes'
      ? 'Mes matchs par équipes' : 'Mes matchs en tournoi',
    porte: (m, c) => estParEquipes(m) === (c === 'equipes'),
  },
  saison: {
    titre: c => `Championnat ${c}`,
    porte: (m, c) => estParEquipes(m) && saisonEquipe(m).libelle === c,
  },
  /* La clé est « libellé §année » : le même open revient chaque année, et
     gagner celui de 2023 ne dit rien de celui de 2024. */
  edition: {
    titre: c => c.split(' §')[0],
    porte: (m, c) => `${(m.tournoi || '').trim()} §${(m.date || '').slice(0, 4) || '?'}` === c,
  },
};

/** Le panneau qui s'ouvre sous une colonne : le bilan de la tranche, puis
 *  ses matchs, cliquables comme partout ailleurs. */
function rendreDetail(axe) {
  if (!detail || detail.axe !== axe) return '';
  const a = AXES[axe];
  const liste = store.matchs
    .filter(m => a.porte(m, detail.cle))
    .sort((x, y) => (y.date || '').localeCompare(x.date || ''));
  const b = bilanMatchs(liste);

  return `<section class="detail-graphe">
    <div class="detail-tete">
      <strong>${h(a.titre(detail.cle))}</strong>
      <button class="lien" data-fermer-detail>Fermer</button>
    </div>
    <p class="tiny muted">${b.total} match${b.total > 1 ? 's' : ''} —
      ${b.v} victoire${b.v > 1 ? 's' : ''}, ${b.d} défaite${b.d > 1 ? 's' : ''},
      ${b.ratio}% de réussite.</p>
    ${liste.length ? `<ul class="matchs" style="margin-top:8px">
      ${liste.map(ligneMatch).join('')}</ul>` : ''}
  </section>`;
}

/** Un compte { cle: {v, d} } vers les groupes du graphique. */
const versGroupes = (compte, cles, etiquette = c => c) =>
  cles.map(c => ({ label: etiquette(c), cle: c, valeurs: [compte[c].v, compte[c].d] }));

const versTableau = (compte, cles, etiquette = c => c) =>
  cles.map(c => {
    const t = compte[c].v + compte[c].d;
    return [etiquette(c), String(compte[c].v), String(compte[c].d),
            t ? Math.round((compte[c].v / t) * 100) + '%' : '—'];
  });

/** Range les matchs par une clé, en ignorant ceux qui n'en ont pas. */
function grouper(matchs, cleDe) {
  const n = {};
  for (const m of matchs) {
    const c = cleDe(m);
    if (c == null || c === '') continue;
    n[c] = n[c] || { v: 0, d: 0 };
    if (m.issue === 'V') n[c].v++; else n[c].d++;
  }
  return n;
}

function vueStats() {
  if (!store.matchs.length) {
    return `<div class="vide"><span class="emoji">📊</span>
      Aucun match : rien à représenter pour l'instant.</div>`;
  }

  const series = [{ nom: 'Victoires' }, { nom: 'Défaites' }];

  const parAn = grouper(store.matchs, m => (m.date || '').slice(0, 4));
  const annees = Object.keys(parAn).sort();

  const parEchelon = grouper(store.matchs, m => m.echelonAdverse);
  /* Rangés du plus faible au plus fort, et non par nombre de matchs :
     c'est la progression du niveau qui fait sens ici. */
  const echelons = Object.keys(parEchelon).sort((a, b) => rang(a) - rang(b));
  const meilleur = [...echelons].reverse().find(e => parEchelon[e].v > 0);

  const parSurface = grouper(store.matchs, m => surfaceDuMatch(m).surface || '?');
  const surfaces = Object.keys(parSurface)
    .sort((a, b) => (parSurface[b].v + parSurface[b].d) - (parSurface[a].v + parSurface[a].d));

  const parEpreuve = grouper(store.matchs, m => estParEquipes(m) ? 'equipes' : 'tournoi');
  const epreuves = Object.keys(parEpreuve);

  return `
    <section class="carte">
      <h3>Victoires et défaites, année par année</h3>
      ${barresGroupees({
        groupes: versGroupes(parAn, annees), series, axe: 'annee',
        ouvert: detail?.axe === 'annee' ? detail.cle : null,
      })}
      <p class="tiny muted">Touche une année pour voir les matchs qu'elle compte.</p>
      ${rendreDetail('annee')}
      ${tableauDouble(['Année', 'Victoires', 'Défaites', '%'], versTableau(parAn, annees))}
    </section>

    <section class="carte">
      <h3>Face à quel classement</h3>
      ${meilleur ? `<p class="tiny muted">Ton meilleur scalp : un joueur classé
        <strong>${h(meilleur)}</strong>.</p>` : ''}
      ${barresGroupees({
        groupes: versGroupes(parEchelon, echelons), series, axe: 'echelon',
        ouvert: detail?.axe === 'echelon' ? detail.cle : null,
      })}
      <p class="tiny muted">Chaque colonne est un classement d'adversaire, du plus faible au
        plus fort. C'est le graphique qui dit à quel niveau tu tiens vraiment — et à partir
        d'où ça casse.</p>
      ${rendreDetail('echelon')}
      ${tableauDouble(['Classement', 'Victoires', 'Défaites', '%'],
        versTableau(parEchelon, echelons))}
    </section>

    ${rendreDurees()}

    ${rendreTitres()}

    ${rendreSurfaces(parSurface, surfaces, series)}

    ${rendreEpreuves(parEpreuve, epreuves, series)}

    ${rendreEquipes(series)}`;
}

/* ─── Le temps passé sur le court ──────────────────────────────────────

   La durée ne vient d'aucune donnée fédérale : elle se note à la main,
   quand on y pense. Cette carte n'apparaît donc qu'une fois quelques
   matchs chronométrés, et elle dit toujours sur combien elle porte — une
   moyenne sur trois matchs n'est pas une moyenne, et laisser croire le
   contraire serait la seule vraie faute ici. */
function rendreDurees() {
  const avec = store.matchs.filter(m => Number(m.duree) > 0);
  if (avec.length < 3) return '';

  const total = avec.reduce((t, m) => t + Number(m.duree), 0);
  const moyenne = Math.round(total / avec.length);
  const plusLong = avec.reduce((a, b) => Number(b.duree) > Number(a.duree) ? b : a);

  const moy = liste => liste.length
    ? Math.round(liste.reduce((t, m) => t + Number(m.duree), 0) / liste.length) : 0;
  const gagnes = avec.filter(m => m.issue === 'V');
  const perdus = avec.filter(m => m.issue === 'D');

  return `<section class="carte">
    <h3>Le temps passé sur le court</h3>
    <section class="chiffres">
      <div class="chiffre"><b>${direDuree(moyenne)}</b><span>en moyenne</span></div>
      <div class="chiffre"><b>${direDuree(total)}</b><span>au total</span></div>
      <div class="chiffre"><b>${avec.length}</b><span>matchs chronométrés</span></div>
      <div class="chiffre"><b>${direDuree(plusLong.duree)}</b><span>le plus long</span></div>
    </section>
    <p class="tiny muted">Sur ${avec.length} match${avec.length > 1 ? 's' : ''} chronométré${
      avec.length > 1 ? 's' : ''} — les autres ne comptent pas dans ces moyennes.
      Le plus long : ${h(plusLong.adversaire || 'un adversaire')},
      ${h(dateCourte(plusLong.date))}${plusLong.score ? `, ${h(plusLong.score)}` : ''}.
      ${gagnes.length >= 2 && perdus.length >= 2
        ? `Tes victoires durent ${direDuree(moy(gagnes))} en moyenne, tes défaites
           ${direDuree(moy(perdus))}.`
        : 'Il faudra quelques matchs de plus pour comparer victoires et défaites.'}</p>
  </section>`;
}

/* ─── Les tournois gagnés ──────────────────────────────────────────────

   Le seul écran du carnet qui ne serve à rien d'autre qu'à faire plaisir,
   et il a sa place : un palmarès de 273 matchs ne dit nulle part qu'on a
   levé un trophée. La déduction est solide — un tournoi se perd en une
   fois, donc une édition sans défaite est une édition gagnée — et sa
   limite est affichée plutôt que masquée. */
function rendreTitres() {
  const { titres, incertains } = tournoisRemportes();
  if (!titres.length && !incertains.length) return '';

  const ligne = e => `<li class="titre-ligne ${detail?.axe === 'edition'
      && detail.cle === e.cle ? 'actif' : ''}"
      data-axe="edition" data-cle="${h(e.cle)}" role="button" tabindex="0"
      title="Voir ces matchs">
    <span class="titre-coupe">🏆</span>
    <div>
      <strong>${h(e.nom)}</strong>
      <div class="tiny muted">${h(e.an)} — ${e.v} victoire${e.v > 1 ? 's' : ''},
        aucune défaite</div>
    </div>
  </li>`;

  return `<section class="carte">
    <h3>${titres.length} tournoi${titres.length > 1 ? 's' : ''} gagné${titres.length > 1 ? 's' : ''}</h3>
    <p class="tiny muted">Aucune trace de cela dans les données de la fédération : elle
      donne des matchs, pas des trophées. Mais un tournoi se perd en une fois — dès la
      première défaite on est sorti. Une édition sans aucune défaite est donc une édition
      qu'on est allé gagner. Le championnat par équipes est exclu : on y joue toutes les
      journées quoi qu'il arrive.</p>
    ${titres.length ? `<ul class="titres">${titres.map(ligne).join('')}</ul>` : ''}
    ${rendreDetail('edition')}
    ${incertains.length ? `<details class="replis">
      <summary>${incertains.length} édition(s) à confirmer</summary>
      <p class="tiny muted">Une seule victoire et aucune défaite : ce peut être un petit
        tableau gagné en une rencontre, mais aussi un tournoi dont la défaite manque à
        l'historique, ou un forfait adverse. Le carnet ne tranche pas — toi seul sais.</p>
      <ul class="titres">${incertains.map(ligne).join('')}</ul>
    </details>` : ''}
  </section>`;
}

/* ─── La surface ───────────────────────────────────────────────────────

   Elle n'est pas toujours saisie : quand elle manque, on la déduit du
   club, et quand le club en a plusieurs, on ne tranche pas. La colonne
   « inconnue » est donc une vraie réponse et non un trou — la masquer
   ferait croire à une certitude qu'on n'a pas. */
function rendreSurfaces(parSurface, surfaces, series) {
  const connues = surfaces.filter(s => s !== '?');
  if (connues.length < 2) return '';

  const taux = s => {
    const t = parSurface[s].v + parSurface[s].d;
    return t ? parSurface[s].v / t : 0;
  };
  /* On ne compare que ce qui est comparable : trois matchs sur moquette
     ne font pas une préférence pour la moquette. */
  const assez = connues.filter(s => parSurface[s].v + parSurface[s].d >= 5);
  const meilleure = [...assez].sort((a, b) => taux(b) - taux(a))[0];
  const pire = [...assez].sort((a, b) => taux(a) - taux(b))[0];

  return `<section class="carte">
    <h3>Sur quelle surface</h3>
    ${barresGroupees({
      groupes: surfaces.map(s => ({ label: s === '?' ? 'inconnue' : s, cle: s,
                                    valeurs: [parSurface[s].v, parSurface[s].d] })),
      series, axe: 'surface',
      ouvert: detail?.axe === 'surface' ? detail.cle : null,
    })}
    ${meilleure && pire && meilleure !== pire
      ? `<p class="tiny muted">Tu gagnes ${Math.round(taux(meilleure) * 100)}% de tes matchs
         sur <strong>${h(meilleure.toLowerCase())}</strong> contre
         ${Math.round(taux(pire) * 100)}% sur <strong>${h(pire.toLowerCase())}</strong>
         — sur les surfaces où tu as au moins cinq matchs.</p>`
      : `<p class="tiny muted">Pas encore assez de matchs par surface pour en tirer
         quoi que ce soit.</p>`}
    ${surfaces.includes('?') ? `<p class="tiny muted">« inconnue » n'est pas un oubli : la
      surface n'est ni saisie sur le match, ni déductible d'un club qui n'en a qu'une.</p>` : ''}
    ${rendreDetail('surface')}
    ${tableauDouble(['Surface', 'Victoires', 'Défaites', '%'],
      versTableau(parSurface, surfaces, s => s === '?' ? 'inconnue' : s))}
  </section>`;
}

/* ─── Tournoi ou championnat par équipes ───────────────────────────────

   Deux compétitions qui n'ont de commun que la raquette. En tournoi on
   choisit son tableau et l'on joue pour soi ; par équipes on joue le
   numéro qu'on vous donne, souvent contre plus fort, et pour le club.
   Les mélanger dans une moyenne unique efface justement ce qu'il y a à
   comprendre. */
function rendreEpreuves(parEpreuve, epreuves, series) {
  if (epreuves.length < 2) return '';

  const t = c => parEpreuve[c].v + parEpreuve[c].d;
  const pc = c => Math.round((parEpreuve[c].v / t(c)) * 100);
  const ecart = pc('tournoi') - pc('equipes');

  return `<section class="carte">
    <h3>Tournoi ou championnat par équipes</h3>
    ${barresGroupees({
      groupes: [
        { label: 'Tournoi', cle: 'tournoi', valeurs: [parEpreuve.tournoi.v, parEpreuve.tournoi.d] },
        { label: 'Par équipes', cle: 'equipes', valeurs: [parEpreuve.equipes.v, parEpreuve.equipes.d] },
      ],
      series, axe: 'epreuve',
      ouvert: detail?.axe === 'epreuve' ? detail.cle : null,
    })}
    <p class="tiny muted">
      ${pc('tournoi')}% de victoires en tournoi (${t('tournoi')} matchs),
      ${pc('equipes')}% par équipes (${t('equipes')} matchs).
      ${Math.abs(ecart) >= 8
        ? ecart > 0
          ? `Soit <strong>${ecart} points de moins</strong> par équipes : on n'y choisit pas
             son adversaire, et le numéro qu'on porte décide du niveau d'en face.`
          : `Soit <strong>${-ecart} points de mieux</strong> par équipes, ce qui n'est pas
             banal : le format y est plus dur pour la plupart des joueurs.`
        : `L'écart est trop faible pour signifier quoi que ce soit.`}</p>
    ${rendreDetail('epreuve')}
  </section>`;
}

/* ─── Le détail du championnat par équipes ─────────────────────────────

   Une saison par ligne, parce que c'est ainsi qu'on s'en souvient : « la
   saison où on est descendus », « celle où j'ai fait un sans-faute ». Le
   libellé de la fédération porte l'année et la saison, ce qui suffit à
   les reconstituer sans rien saisir. */
function rendreEquipes(series) {
  const matchs = store.matchs.filter(estParEquipes);
  if (!matchs.length) return '';

  const parSaison = grouper(matchs, m => saisonEquipe(m).libelle);
  const saisons = Object.keys(parSaison).sort();
  const b = bilanMatchs(matchs);

  /* La meilleure saison ne se juge pas sur le nombre de victoires — une
     saison de six rencontres en gagne mécaniquement plus qu'une de trois.
     On demande donc au moins trois rencontres avant de couronner. */
  const eligibles = saisons.filter(s => parSaison[s].v + parSaison[s].d >= 3);
  const meilleure = [...eligibles].sort((x, y) => {
    const tx = parSaison[x].v / (parSaison[x].v + parSaison[x].d);
    const ty = parSaison[y].v / (parSaison[y].v + parSaison[y].d);
    return ty - tx;
  })[0];

  return `<section class="carte">
    <h3>Le championnat par équipes, saison par saison</h3>
    <p class="tiny muted">${matchs.length} rencontres reconnues au libellé de l'épreuve
      (« LIGUE-2023… », « 76-2024… ») : ${b.v} victoires, ${b.d} défaites, ${b.ratio}%.
      Ces matchs n'appartiennent à aucun club — une journée se joue chez soi, la suivante
      chez l'adversaire.</p>
    ${barresGroupees({
      groupes: versGroupes(parSaison, saisons), series, axe: 'saison',
      ouvert: detail?.axe === 'saison' ? detail.cle : null,
    })}
    ${meilleure ? `<p class="tiny muted">Ta meilleure saison :
      <strong>${h(meilleure)}</strong> (${parSaison[meilleure].v}V–${parSaison[meilleure].d}D),
      parmi celles d'au moins trois rencontres.</p>` : ''}
    ${rendreDetail('saison')}
    ${tableauDouble(['Saison', 'Victoires', 'Défaites', '%'], versTableau(parSaison, saisons))}
  </section>`;
}

const barreVue = () => `<div class="segments" style="width:100%;margin-bottom:14px">
    <button data-vue="liste" class="${ongletVue === 'liste' ? 'actif' : ''}" style="flex:1">Liste</button>
    <button data-vue="stats" class="${ongletVue === 'stats' ? 'actif' : ''}" style="flex:1">Statistiques</button>
  </div>`;

export function render() {
  if (ongletVue === 'stats') return barreVue() + vueStats();

  const liste = filtrer();
  const sur12 = store.matchs.filter(m => dansLesDouzeMois(m.date));
  const b = bilanMatchs(sur12);

  /* Les victoires contre plus fort que soi sont le vrai marqueur de
     progression : elles rapportent le plus, et ce sont celles dont on se
     souvient. Elles méritent leur compteur. */
  const exploits = sur12.filter(estExploit).length;

  return `
    ${barreVue()}
    <section class="chiffres">
      <div class="chiffre ${filtreActif('tout') ? 'actif' : ''}" data-filtre="tout"
        title="Voir ces matchs"><b>${b.total}</b><span>matchs sur 12 mois</span></div>
      <div class="chiffre"><b><span class="moitie ${filtreActif('V') ? 'actif' : ''}"
          data-filtre="V" title="Voir les victoires">${b.v}</span><small>–</small><span
          class="moitie ${filtreActif('D') ? 'actif' : ''}"
          data-filtre="D" title="Voir les défaites">${b.d}</span></b>
        <span>victoires–défaites</span></div>
      <div class="chiffre ${filtreActif('V') ? 'actif' : ''}" data-filtre="V"
        title="Voir les victoires"><b>${b.ratio}%</b><span>de victoires</span></div>
      <div class="chiffre ${filtreActif('exploit') ? 'actif' : ''}" data-filtre="exploit"
        title="Voir ces victoires"><b>${exploits}</b><span>contre plus fort</span></div>
    </section>

    <section class="barre-filtres">
      <input id="q" class="recherche" placeholder="Chercher un nom, un tournoi…"
             value="${h(filtre.texte)}">
      <div class="segments" role="group">
        <button data-p="12" class="${filtre.periode === '12' ? 'actif' : ''}">12 mois</button>
        <button data-p="tout" class="${filtre.periode === 'tout' ? 'actif' : ''}">Tout</button>
      </div>
      <div class="segments" role="group">
        <button data-i="tout" class="${filtre.issue === 'tout' ? 'actif' : ''}">Tous</button>
        <button data-i="V" class="${filtre.issue === 'V' ? 'actif' : ''}">Victoires</button>
        <button data-i="D" class="${filtre.issue === 'D' ? 'actif' : ''}">Défaites</button>
      </div>
    </section>

    ${filtre.exploit ? `<p class="tiny muted" style="margin:0 4px 10px">
      🔥 Seulement les victoires contre mieux classé que toi.
      <button class="lien" data-vider-exploit>Tout revoir</button></p>` : ''}

    ${liste.length ? `<ul class="matchs">${liste.map(ligneMatch).join('')}</ul>` : `
      <div class="vide">
        <span class="emoji">🎾</span>
        ${store.matchs.length
          ? 'Aucun match ne correspond à ce filtre.'
          : `Aucun match pour l'instant.
             <div class="rangee-boutons" style="justify-content:center;margin-top:14px">
               <button class="btn btn-primary" data-import>Importer depuis Ten'Up</button>
               <button class="btn" data-nouveau>Saisir un match</button>
             </div>`}
      </div>`}

    ${store.matchs.length ? `<div class="pied-liste">
      <button class="btn" data-import>Importer depuis Ten'Up</button>
    </div>` : ''}`;
}

export function wire(vue, rerendre) {
  vue.querySelector('#q')?.addEventListener('input', e => {
    filtre.texte = e.target.value;
    // On ne redessine que la liste : redessiner tout ferait perdre le curseur.
    const liste = vue.querySelector('.matchs');
    const trouves = filtrer();
    if (liste) liste.innerHTML = trouves.map(ligneMatch).join('');
  });

  /* Une colonne annoncée cliquable doit l'être au clavier aussi : elle
     porte role="button", ce qui promet Entrée et Espace. */
  vue.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const g = e.target.closest('[data-axe]');
    if (!g) return;
    e.preventDefault();
    g.click();
  });

  vue.addEventListener('click', e => {
    const v = e.target.closest('[data-vue]');
    if (v) { ongletVue = v.dataset.vue; detail = null; rerendre(); return; }

    if (e.target.closest('[data-fermer-detail]')) { detail = null; rerendre(); return; }

    const g = e.target.closest('[data-axe]');
    if (g) {
      const { axe, cle } = g.dataset;
      // Recliquer sur la colonne ouverte la referme.
      detail = detail?.axe === axe && detail.cle === cle ? null : { axe, cle };
      rerendre();
      return;
    }

    const p = e.target.closest('[data-p]');
    if (p) { filtre.periode = p.dataset.p; rerendre(); return; }

    /* Choisir « Défaites » à la main annule le filtre des exploits : une
       défaite contre plus fort n'est pas un exploit, et laisser les deux
       actifs afficherait une liste vide sans dire pourquoi. */
    const i = e.target.closest('[data-i]');
    if (i) { filtre.issue = i.dataset.i; filtre.exploit = false; rerendre(); return; }

    if (e.target.closest('[data-vider-exploit]')) {
      Object.assign(filtre, FILTRES.tout); rerendre(); return;
    }

    const f = e.target.closest('[data-filtre]');
    if (f) {
      const cle = f.dataset.filtre;
      // Recliquer sur un compteur ouvert le referme.
      Object.assign(filtre, filtreActif(cle) ? FILTRES.tout : FILTRES[cle]);
      rerendre();
      return;
    }

    if (e.target.closest('[data-import]')) { importFFTForm(); return; }
    if (e.target.closest('[data-nouveau]')) { matchForm(); return; }

    const li = e.target.closest('.match');
    if (li) {
      const m = store.matchs.find(x => x.id === li.dataset.id);
      if (m) matchForm(m);
    }
  });
}
