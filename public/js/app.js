/* Point d'entrée : thème, chargement, routeur, ajout rapide. */

import { charger, store, remplirTourneeUneFois } from './store.js';
import { completerClubsConnus } from './clubs-connus.js';
import { veillerAuClassement } from './montee.js';
import { h, toast, openModal, closeModal } from './util.js';
import { appliquerTheme, themeSuivant, themeActuel, ETIQUETTES } from './theme.js';
import { matchForm, conseilForm, profilForm, clubForm,
         nouvelAdversaireForm, courseForm, cordageForm } from './forms.js';

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
   liste des matchs, et sur l'écran vide qui l'accueille au départ.

   Le classement s'en va pour la même raison, et une de plus : ce n'est
   rien à ajouter, c'est un réglage. Il vit dans le profil, où l'échelon
   se choisit dans une liste, et il continue de s'ouvrir tout seul le
   premier jour — un carnet sans classement ne sait rien calculer.

   Ne restent ici que des gestes d'ajout, et rien d'autre — mais leur
   ordre compte. La grille a deux colonnes, et deux cases côte à côte se
   lisent comme une paire, qu'on l'ait voulu ou non : autant que les
   paires disent quelque chose. Les gens ensemble — un adversaire, un
   club —, puis le matériel — un cordage, une course. On cherche alors
   la ligne avant la case, ce qui fait un geste de moins. */
const RAPIDE = () => [
  ['🎤', 'Dicter une note', "Parler plutôt qu'écrire",     () => dicterModal(), true],
  ['🎾', 'Un match',   'Résultat, score, ressenti',       () => matchForm()],
  ['💡', 'Un conseil', 'Ce que le prof vient de dire',     () => conseilForm()],
  /* Le répertoire des adversaires se remplit tout seul avec les matchs.
     Celui-ci est pour l'avant : le tableau de dimanche est sorti, on
     sait contre qui l'on joue, et il n'y avait nulle part où le noter
     avant d'avoir joué. */
  ['👥', 'Un adversaire', 'Sa façon de jouer, avant le match', () => nouvelAdversaireForm()],
  ['🏟️', 'Un club',    'Adresse, surfaces, juge-arbitre',  () => clubForm()],
  /* Un cordage se casse trois fois par an et se change plus souvent
     encore. C'est le geste le plus répété du carnet après le match
     lui-même, et il se faisait par le profil, deux onglets plus loin. */
  ['🪢', 'Un cordage', 'Cassé, ou changé', () => cordageForm()],
  ['🛒', 'Une course',  'À racheter : cordage, grip, balles', () => courseForm()],
];

/* ─── Signaler quelque chose ───────────────────────────────────────────
 *
 * Un lien `mailto` nu ouvrait un message vide : à charge de l'auteur du
 * message de dire ce qui ne va pas, sur quel écran, et avec quelle
 * version. Personne ne le fait — on écrit « ça marche pas » et l'on
 * repart. La fenêtre pose donc les trois questions à sa place : de quoi
 * s'agit-il, que s'est-il passé, et le reste, elle le sait toute seule.
 *
 * Elle ne peut pas joindre l'image : aucune page web n'attache un
 * fichier à un message, `mailto` ne le permet pas et c'est une bonne
 * chose. Elle le dit, et laisse le logiciel de messagerie faire ce
 * qu'il sait faire.
 */
const TYPES_MESSAGE = [
  { cle: 'bug',      emoji: '🐞', nom: 'Un bug',
    aide: 'Quelque chose ne marche pas comme prévu' },
  { cle: 'faux',     emoji: '🔢', nom: 'Un chiffre faux',
    aide: 'Un compte, un classement ou une distance qui ne tombe pas juste' },
  { cle: 'question', emoji: '❓', nom: 'Une question',
    aide: 'Je ne comprends pas ce que fait le carnet' },
  { cle: 'idee',     emoji: '💡', nom: 'Une idée',
    aide: 'Il manque quelque chose, ou ça pourrait être mieux' },
  { cle: 'autre',    emoji: '✉️', nom: 'Autre chose',
    aide: 'Ce qui n\'entre dans aucune des cases au-dessus' },
];

/* L'adresse, assemblée à l'exécution. Écrite d'un seul tenant dans un
   dépôt public, elle serait récoltée par les robots qui lisent le code
   des sites ; en deux morceaux, elle échappe aux plus simples d'entre
   eux. Ce n'est pas un secret et cela n'en fait pas un — c'est le
   minimum de politesse qu'on doit à sa propre boîte aux lettres. */
const ADRESSE = ['arthurbeck.fr', 'gmail.com'].join('@');

/** Ce que le carnet sait de lui-même, et qu'on ne pense jamais à dire. */
function contexte() {
  const version = (document.querySelector('script[type="module"]')?.getAttribute('src')
    || '').match(/v=(\d+)/)?.[1] || '?';
  return [
    `Version du site : ${version}`,
    `Écran : ${location.hash || '#/'}`,
    `Appareil : ${navigator.userAgent}`,
    `Carnet : ${store.matchs.length} match(s), ${store.clubs.length} club(s)`,
  ].join('\n');
}

function signalerModal() {
  openModal({
    title: 'Signaler quelque chose',
    body: `<form id="f-signal" class="form">
      ${/* Des boutons plutôt qu'une liste déroulante. Une liste demande
            trois gestes — ouvrir, chercher, choisir — et cache ses
            options jusqu'au premier. Ici les cinq natures sont lisibles
            d'un coup d'œil, et choisir tient en un appui. C'est la même
            raison qui a mis la dictée en tête du menu : ce qui se voit
            se choisit plus vite que ce qui se déroule. */''}
      <span class="etiquette">De quoi s'agit-il ?</span>
      <div class="choix-nature" role="radiogroup" aria-label="Nature du message">
        ${TYPES_MESSAGE.map((t, i) => `<button type="button" data-type="${t.cle}"
          class="${i === 0 ? 'actif' : ''}" role="radio"
          aria-checked="${i === 0 ? 'true' : 'false'}"
          ><span>${t.emoji}</span>${h(t.nom)}</button>`).join('')}
      </div>
      <p class="tiny muted" data-aide>${h(TYPES_MESSAGE[0].aide)}</p>
      <label>Ce qui s'est passé
        <textarea name="texte" rows="6" placeholder="Ce que tu faisais, ce que tu attendais, ce qui est arrivé à la place. Trois lignes suffisent."></textarea>
      </label>
      ${/* La capture d'écran vaut dix explications, et c'est la seule
            chose que cette fenêtre ne peut pas faire à ta place. */''}
      <p class="tiny muted">📸 <strong>Si tu as une capture d'écran du problème, joins-la
        au message.</strong> Ton logiciel de messagerie s'ouvre avec le texte déjà écrit :
        il ne reste qu'à ajouter l'image avant d'envoyer. Une image montre en une seconde
        ce qu'un paragraphe explique mal.</p>
      <p class="tiny muted">Partent avec le message la version du site, l'écran où tu es,
        l'appareil et la taille du carnet. Rien de ce que contient le carnet — ni match, ni
        nom, ni adresse.</p>
    </form>`,
    footer: `<button class="btn" data-non>Annuler</button>
             <button class="btn btn-primary" data-envoyer>Écrire le message</button>`,
    onMount: () => {
      const racine = document.getElementById('modal-root');
      const form = racine.querySelector('#f-signal');
      const aide = form.querySelector('[data-aide]');
      let nature = TYPES_MESSAGE[0].cle;
      form.querySelector('.choix-nature').addEventListener('click', e => {
        const b = e.target.closest('[data-type]');
        if (!b) return;
        nature = b.dataset.type;
        for (const x of form.querySelectorAll('[data-type]')) {
          const choisi = x === b;
          x.classList.toggle('actif', choisi);
          x.setAttribute('aria-checked', choisi ? 'true' : 'false');
        }
        aide.textContent = TYPES_MESSAGE.find(t => t.cle === nature)?.aide || '';
      });
      racine.querySelector('[data-non]').addEventListener('click', closeModal);
      racine.querySelector('[data-envoyer]').addEventListener('click', () => {
        const t = TYPES_MESSAGE.find(x => x.cle === nature) || TYPES_MESSAGE[0];
        const texte = form.querySelector('[name="texte"]').value.trim();
        const corps = `${texte}\n\n— — —\n${contexte()}`;
        /* L'arobase reste elle-même : encodée en %40, elle se retrouve
           écrite telle quelle dans le champ « À » de quelques clients. */
        const lien = `mailto:${ADRESSE}`
          + `?subject=${encodeURIComponent(`Mon tennis — ${t.nom.toLowerCase()}`)}`
          + `&body=${encodeURIComponent(corps)}`;
        closeModal();
        /* Un lien qu'on clique plutôt qu'une adresse qu'on impose : sur
           un téléphone, changer `location` d'un coup fait parfois sortir
           de l'application sans y revenir. */
        const el = document.createElement('a');
        el.href = lien;
        el.rel = 'noopener';
        document.body.appendChild(el);
        el.click();
        el.remove();
        toast('Ton logiciel de messagerie s\'ouvre — pense à la capture d\'écran.');
      });
    },
  });
}
function ajoutRapide() {
  const liste = RAPIDE();
  openModal({
    title: 'Ajouter',
    body: `<div class="grille-rapide">
      ${liste.map((q, i) => `<button class="bouton-rapide${q[4] ? ' large' : ''}" data-q="${i}">
        <span class="qi">${q[0]}</span><b>${h(q[1])}</b>
        <span class="tiny muted">${h(q[2])}</span></button>`).join('')}
    </div>
    ${/* Séparé de la grille, et sans cadre : ce n'est pas une chose de
          plus à ajouter au carnet, c'est une porte de sortie. La mettre
          au même rang que les autres, c'était la proposer à chaque fois
          qu'on vient noter un match. */''}
    <div class="rangee-message">
      <button class="btn btn-ghost" data-signaler>✉️ Un bug, une question…</button>
    </div>`,
    onMount: el => el.addEventListener('click', e => {
      const b = e.target.closest('[data-q]');
      if (b) { closeModal(); liste[+b.dataset.q][3](); return; }
      if (e.target.closest('[data-signaler]')) { closeModal(); signalerModal(); }
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
