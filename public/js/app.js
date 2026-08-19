/* Point d'entrée : thème, chargement, routeur, ajout rapide. */

import { charger, store, remplirTourneeUneFois } from './store.js';
import { completerClubsConnus } from './clubs-connus.js';
import { veillerAuClassement } from './montee.js';
import { h, toast, openModal, closeModal } from './util.js';
import { appliquerTheme, themeSuivant, themeActuel, ETIQUETTES } from './theme.js';
import { matchForm, conseilForm, clubForm, profilForm } from './forms.js';

import * as matchs     from './views/matchs.js';
import * as simulateur from './views/simulateur.js';
import * as coaching   from './views/coaching.js';
import * as clubs      from './views/clubs.js';
import * as materiel   from './views/materiel.js';
import * as joueurs    from './views/joueurs.js';
import { retourPour, oublierRetourSi } from './retour.js';
import * as nuage      from './nuage.js';
import { dicterModal } from './dictee.js';

const $ = id => document.getElementById(id);

/* Le thème s'applique avant tout affichage : le poser après le chargement
   des données ferait clignoter un écran clair avant de passer au sombre. */
appliquerTheme();

// =====================================================================
//  Routeur
// =====================================================================
const ROUTES = [
  { match: /^\/?$/,           title: 'Mes matchs',   tab: '/',
    render: () => matchs.render(),      wire: matchs.wire },
  { match: /^\/classement$/,  title: 'Mon classement', tab: '/classement',
    render: () => simulateur.render(),  wire: simulateur.wire },
  /* Le carnet a été absorbé par le court : écrire tient dans une fenêtre
     flottante, et deux écrans pour un même formulaire, c'était un écran de
     trop. L'ancienne adresse mène au court plutôt que nulle part — elle
     traîne dans les raccourcis d'écran d'accueil et dans les favoris. */
  { match: /^\/conseils$/,    title: 'Sur le court', tab: '/court',
    render: () => { location.replace('#/court'); return ''; }, wire: () => {} },
  { match: /^\/court$/,       title: 'Sur le court', tab: '/court',
    render: () => coaching.renderCourt(), wire: coaching.wireCourt, nu: true },
  { match: /^\/clubs$/,       title: 'Mes clubs',    tab: '/clubs',
    render: () => clubs.render(),       wire: clubs.wire },
  { match: /^\/clubs\/(.+)$/, title: 'Club',         tab: '/clubs',
    render: p => clubs.renderFiche(p),  wire: clubs.wireFiche, retour: '#/clubs' },
  { match: /^\/matos$/,       title: 'Mon profil',   tab: '/matos',
    render: () => materiel.render(),    wire: materiel.wire },
  { match: /^\/joueurs$/,     title: 'Mes adversaires', tab: '/joueurs',
    render: () => joueurs.render(),     wire: joueurs.wire },
  { match: /^\/joueurs\/(.+)$/, title: 'Adversaire', tab: '/joueurs',
    render: p => joueurs.renderFiche(p), wire: joueurs.wireFiche, retour: '#/joueurs' },
];

function routeCourante() {
  const chemin = (location.hash || '#/').slice(1);
  for (const r of ROUTES) {
    const m = chemin.match(r.match);
    if (m) return { route: r, params: m };
  }
  return { route: ROUTES[0], params: [] };
}

/* L'écran affiché au rendu précédent. Il ne sert qu'à distinguer « on
   change de page » de « on redessine la même » : les deux passent par
   `afficher()`, mais l'une doit remonter en haut et l'autre surtout pas. */
let ecranPrecedent = null;

function afficher() {
  const { route, params } = routeCourante();
  const ecran = location.hash || '#/';
  const memeEcran = ecran === ecranPrecedent;
  const hauteur = window.scrollY;
  ecranPrecedent = ecran;

  /* Chaque vue pose ses écouteurs sur le conteneur. On repart d'un nœud
     vierge à chaque rendu, sinon ils s'empilent et un clic se déclenche
     autant de fois qu'il y a eu d'affichages. */
  const vue = $('view').cloneNode(false);
  $('view').replaceWith(vue);

  $('page-title').textContent = route.title;

  /* Une fiche est un cul-de-sac sans ceci : la barre du bas ramène aux
     cinq écrans du quotidien, dont ni les clubs ni les adversaires ne
     font partie. On sortait donc d'une fiche d'adversaire par le bouton
     du navigateur, quand il y en a un. */
  /* `retourCible` et non `cible` : la page du classement utilise déjà
     `data-cible` pour ses boutons d'objectif, et deux attributs de même
     nom sur un même document finissent par se confondre dans un
     sélecteur. */
  /* Un détour ponctuel — la fenêtre d'un match qui envoie voir un
     adversaire — se referme là où il s'est ouvert. La flèche garde son
     dessin mais ne fait pas la même chose, et c'est bien ce qu'on attend
     d'elle : revenir. */
  oublierRetourSi(ecran);
  const ponctuel = retourPour(ecran);

  const retour = $('btn-retour');
  retour.hidden = !route.retour && !ponctuel;
  retour.dataset.retourCible = route.retour || '';
  retour.title = ponctuel ? 'Revenir au match' : 'Revenir à la liste';

  // Le mode court se passe de tout le décorum : il doit tenir en un écran.
  document.body.classList.toggle('mode-court', !!route.nu);

  document.querySelectorAll('.tabbar a').forEach(a =>
    a.classList.toggle('active', a.dataset.tab === route.tab));
  // Le profil vit dans la barre du haut : il s'allume comme les autres.
  $('btn-profil')?.classList.toggle('active', route.tab === '/matos');

  try {
    vue.innerHTML = route.render(params);
  } catch (err) {
    console.error(err);
    vue.innerHTML = `<div class="vide"><span class="emoji">⚠️</span>
      Erreur d'affichage : ${h(err.message)}</div>`;
    return;
  }
  route.wire?.(vue, afficher);

  /* On ne remonte en haut qu'en arrivant sur un écran. Un redessin sur
     place — une synchronisation qui rapporte un match, un tri qu'on
     change — doit laisser le lecteur là où il était : rien n'est plus
     désagréable qu'une page qui se dérobe pendant qu'on la lit. Le
     conteneur ayant été remplacé, la position n'est pas conservée toute
     seule et se repose à la main. */
  window.scrollTo({ top: memeEcran ? hauteur : 0 });
}

// =====================================================================
//  Le bouton +
// =====================================================================
/* La dictée était un bouton flottant de plus, à côté du « + ». Deux
   ronds pour une seule intention — ajouter quelque chose — et le second
   mangeait le bas de l'écran sans qu'on sache ce qu'il faisait avant de
   le toucher. Ici, il porte son nom — et il passe en tête, sur toute la
   largeur : c'est le geste des mains prises, celui qu'on cherche en
   sortant du court, et il ne se cherche pas au fond d'une grille.

   L'import de Ten'Up quitte cette liste. Il ne s'y faisait qu'une fois,
   au premier jour, et occupait ensuite une case sur six dans un menu
   qu'on ouvre pour noter un match. Il reste où il sert : au bas de la
   liste des matchs, et sur l'écran vide qui l'accueille au départ. */
const RAPIDE = () => [
  ['🎤', 'Dicter une note', "Parler plutôt qu'écrire",     () => dicterModal(), true],
  ['🎾', 'Un match',   'Résultat, score, ressenti',       () => matchForm()],
  ['💡', 'Un conseil', 'Ce que le prof vient de dire',     () => conseilForm()],
  ['🏟️', 'Un club',    'Adresse, surfaces, juge-arbitre',  () => clubForm()],
  ['🏅', 'Mon classement', 'Échelon et bilan',             () => profilForm()],
];

function ajoutRapide() {
  const liste = RAPIDE();
  openModal({
    title: 'Ajouter',
    body: `<div class="grille-rapide">
      ${liste.map((q, i) => `<button class="bouton-rapide${q[4] ? ' large' : ''}" data-q="${i}">
        <span class="qi">${q[0]}</span><b>${h(q[1])}</b>
        <span class="tiny muted">${h(q[2])}</span></button>`).join('')}
    </div>`,
    onMount: el => el.addEventListener('click', e => {
      const b = e.target.closest('[data-q]');
      if (b) { closeModal(); liste[+b.dataset.q][3](); }
    }),
  });
}

// =====================================================================
//  Barre du haut
// =====================================================================
function rafraichirBoutonTheme() {
  const e = ETIQUETTES[themeActuel()];
  const b = $('btn-theme');
  b.textContent = e.emoji;
  b.title = `Thème : ${e.mot.toLowerCase()} — toucher pour changer`;
}

$('btn-theme').addEventListener('click', () => {
  const t = themeSuivant();
  rafraichirBoutonTheme();
  toast(`Thème : ${ETIQUETTES[t].mot.toLowerCase()}`);
});
rafraichirBoutonTheme();

$('fab').addEventListener('click', ajoutRapide);

// =====================================================================
//  Démarrage
// =====================================================================
const etat = charger();

/* Les surfaces relevées sur Ten'Up n'arrivaient qu'aux clubs créés
   après coup. Ceux qui étaient déjà là restaient sans surface, donc
   invisibles au filtre — pour une information qu'on possède. Le
   rattrapage ne remplit que les cases vides, et ne se voit qu'une
   fois : au second démarrage, il n'a plus rien à faire. */
completerClubsConnus();
remplirTourneeUneFois();
window.__appReady = true;
$('boot').hidden = true;
$('shell').hidden = false;

if (!etat.ok) {
  toast('Données locales illisibles — on repart d\'un carnet vide.');
}

/* Le classement conditionne tout le calcul des points. Sur un carnet
   vierge, on le demande une fois — sans bloquer l'accès au reste. */
if (etat.neuf) {
  setTimeout(() => { if (!store.matchs.length) profilForm(); }, 400);
}

/* Le temps fait baisser le bilan sans qu'on joue : mieux vaut
   l'apprendre en ouvrant l'application qu'en lisant le classement
   publié. Après l'affichage, pour ne pas retarder l'écran, et une fois
   seulement — le module retient ce qu'il a déjà dit. */
setTimeout(veillerAuClassement, 1200);

afficher();

$('btn-retour').addEventListener('click', () => {
  const ponctuel = retourPour(location.hash || '#/');
  if (ponctuel) { ponctuel(); return; }
  const cible = $('btn-retour').dataset.retourCible;
  if (cible) location.hash = cible;
});

window.addEventListener('hashchange', afficher);
document.addEventListener('data-changed', () => {
  afficher();
  // Une saisie appelle un envoi, mais pas tout de suite : on note souvent
  // trois choses d'affilée, et trois envois pour un seul geste seraient
  // du gaspillage.
  nuage.planifierEnvoi();
});

/* ─── La synchronisation ───────────────────────────────────────────────

   Elle ne conditionne rien : sans compte, ou sans réseau, le carnet
   fonctionne exactement comme avant. C'est la règle qui compte, parce que
   l'écran le plus utile de ce site se consulte sur un terrain où le réseau
   ne passe pas. */
/* Le témoin de synchronisation suit la sauvegarde : elle vit dans le
   profil, il marque donc l'icône du profil. Un témoin n'a de sens qu'à
   côté de ce qu'il concerne. */
function rafraichirIndicateur() {
  const b = $('btn-profil');
  if (!b) return;
  if (nuage.enTrain()) { b.dataset.sync = 'cours'; b.title = 'Synchronisation en cours…'; }
  else if (nuage.connecte()) { b.dataset.sync = 'ok'; b.title = `Synchronisé — ${nuage.courriel()}`; }
  else { delete b.dataset.sync; b.title = 'Mon profil'; }
}
document.addEventListener('sync-change', rafraichirIndicateur);
rafraichirIndicateur();

/* Plus de bouton à toucher : le carnet se synchronise au démarrage, au
   retour sur l'écran, au retour du réseau, toutes les dix minutes, et en
   partant. Le bouton reste pour dire où l'on en est et pour forcer. */
nuage.brancherSynchroAuto();
