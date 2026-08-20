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

/** Qui écrit.
 *
 *  Le message portait l'agent du navigateur, l'écran, la version et la
 *  taille du carnet — quatre lignes qui décrivaient une machine, quand
 *  la seule question devant un signalement est « qui est-ce, et où lui
 *  répondre ». On les remplace par ce que la personne a écrit elle-même
 *  dans son profil.
 *
 *  Ce qu'elle a écrit, et pas tout : sa main, son sexe, son échelon et
 *  ses adresses ne disent rien du problème et n'aident à joindre
 *  personne. Un signalement n'est pas une occasion de faire passer une
 *  fiche, et ce qu'on n'envoie pas ne se perd pas en route.
 *
 *  Les cases vides ne partent pas non plus : une ligne « Téléphone : »
 *  suivie de rien fait croire à un défaut de plus.
 *
 *  Reste la version du site, seule ligne de machine à survivre, et pour
 *  une raison précise : devant un défaut qu'on ne reproduit pas, la
 *  première question est de savoir si l'autre a la version du jour ou
 *  celle d'il y a trois semaines. Sans elle, on cherche un bug déjà
 *  corrigé.
 */
function quiEcrit() {
  const p = store.profil || {};
  const nom = [p.prenom, p.nom].map(x => (x || '').trim()).filter(Boolean).join(' ');
  const lignes = [
    ['Nom', nom],
    ['E-mail', p.mail],
    ['Téléphone', p.telephone],
    ['Club', p.clubPrincipal],
  ].filter(([, v]) => (v || '').trim())
   .map(([c, v]) => `${c} : ${String(v).trim()}`);

  const version = (document.querySelector('script[type="module"]')?.getAttribute('src')
    || '').match(/v=(\d+)/)?.[1] || '?';

  return [
    lignes.length ? lignes.join('\n') : 'Profil non renseigné — pas de quoi rappeler.',
    `Version du site : ${version}`,
  ].join('\n');
}

/* ─── Passer l'adresse ─────────────────────────────────────────────────
 *
 * Il n'y a rien à installer et rien à créer : le carnet est une page, et
 * l'ouvrir suffit. Encore faut-il pouvoir en donner l'adresse sans aller
 * la chercher dans la barre du navigateur — sur un téléphone en mode
 * application, cette barre n'existe même plus.
 *
 * Le partage du système fait le travail quand il est là : c'est lui qui
 * connaît les contacts, les messageries et l'ordre dans lequel on s'en
 * sert. Sur un ordinateur il manque souvent, et l'on retombe sur quatre
 * chemins écrits à la main — dont la copie, qui marche partout et
 * n'engage rien.
 */
const adresseDuSite = () => location.origin + location.pathname;

const MOT_DE_PARTAGE = 'Mon carnet de tennis : matchs, classement FFT, clubs et conseils.'
  + ' Rien à installer, tout reste sur ton téléphone.';

async function partager() {
  const url = adresseDuSite();
  /* `canShare` avant `share` : quelques navigateurs de bureau annoncent
     la fonction sans savoir partager un lien, et l'appel échoue alors
     silencieusement — l'utilisateur touche un bouton qui ne fait rien. */
  const donnees = { title: 'Mon tennis', text: MOT_DE_PARTAGE, url };
  if (navigator.share && (!navigator.canShare || navigator.canShare(donnees))) {
    try { await navigator.share(donnees); return true; }
    catch { /* partage refusé ou annulé : on ouvre la fenêtre à la place */ }
  }
  return false;
}

async function copierAdresse() {
  const url = adresseDuSite();
  try {
    await navigator.clipboard.writeText(url);
    toast('Lien copié — il n\'y a plus qu\'à le coller.');
    return true;
  } catch {
    /* Le presse-papiers est refusé hors d'un geste direct, et sur
       certains navigateurs anciens. Plutôt que d'annoncer une copie qui
       n'a pas eu lieu, on montre l'adresse et l'on laisse faire. */
    toast('Copie refusée par le navigateur — l\'adresse est affichée, sélectionne-la.');
    return false;
  }
}

function partagerModal() {
  const url = adresseDuSite();
  const texte = encodeURIComponent(`${MOT_DE_PARTAGE}\n${url}`);
  openModal({
    title: 'Partager l\'application',
    body: `<p class="tiny muted">Envoie ce lien : la personne l'ouvre et s'en sert
        aussitôt. Il n'y a rien à installer, aucun compte à créer, et son carnet reste
        chez elle — tu ne verras pas ses matchs, elle ne verra pas les tiens.</p>

      <div class="rangee-partage">
        <button class="btn btn-primary" data-copier>🔗 Copier le lien</button>
        <a class="btn" href="sms:?&body=${texte}">💬 SMS</a>
        <a class="btn" href="https://wa.me/?text=${texte}" target="_blank"
           rel="noopener noreferrer">WhatsApp ↗</a>
        <a class="btn" href="mailto:?subject=${encodeURIComponent('Mon tennis')}&body=${texte}">✉️ E-mail</a>
      </div>

      <p class="adresse-partage" data-adresse>${h(url)}</p>
      <p class="tiny muted">Sur un téléphone, le bouton « Partager » du menu ouvre
        directement la liste de tes contacts et de tes applications.</p>`,
    onMount: corps => {
      corps.addEventListener('click', async e => {
        if (!e.target.closest('[data-copier]')) return;
        const ok = await copierAdresse();
        /* Copie refusée : on sélectionne l'adresse pour que le geste
           suivant — Ctrl+C — trouve quelque chose de prêt. */
        if (!ok) {
          const p = corps.querySelector('[data-adresse]');
          const s = window.getSelection();
          const r = document.createRange();
          r.selectNodeContents(p);
          s.removeAllRanges();
          s.addRange(r);
        }
      });
    },
  });
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
      <p class="tiny muted">Partent avec le message ton nom, ton e-mail, ton téléphone et
        ton club, tels que ton profil les donne — de quoi savoir qui écrit et où répondre —
        ainsi que la version du site, sans laquelle on cherche un défaut déjà corrigé. Rien
        d'autre : ni tes matchs, ni ton classement, ni tes adresses.</p>
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
        const corps = `${texte}\n\n— — —\n${quiEcrit()}`;
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
      <button class="btn btn-ghost" data-partager>📣 Partager l'application</button>
      <button class="btn btn-ghost" data-signaler>✉️ Un bug, une question…</button>
    </div>`,
    onMount: el => el.addEventListener('click', e => {
      const b = e.target.closest('[data-q]');
      if (b) { closeModal(); liste[+b.dataset.q][3](); return; }
      if (e.target.closest('[data-signaler]')) { closeModal(); signalerModal(); return; }
      /* Le partage du système d'abord ; s'il n'est pas là, la fenêtre. */
      if (e.target.closest('[data-partager]')) {
        closeModal();
        partager().then(fait => { if (!fait) partagerModal(); });
      }
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

/* ─── Le clavier du téléphone ──────────────────────────────────────────
 *
 * Sur iPhone, ouvrir le clavier rétrécit la fenêtre *visible* sans rien
 * dire à la page : la fenêtre de mise en page, elle, ne bouge pas. Or
 * c'est à celle-là que `position: fixed` s'accroche. La barre du bas et
 * le « + » restent donc à leur place — c'est-à-dire, à l'écran, en plein
 * milieu, par-dessus le texte, avec la page qui continue dessous.
 *
 * Rien à réparer dans la mise en page : elle est juste. Ce qu'il faut,
 * c'est savoir que le clavier est là, et la seule façon de l'apprendre
 * est de regarder la fenêtre visible se rétrécir. Deux fenêtres pour un
 * écran : tout le sujet tient dans cette phrase.
 *
 * On efface alors les deux éléments plutôt que de les déplacer. Ils ne
 * servent à rien pendant qu'on écrit — on ne navigue pas d'un onglet à
 * l'autre en pleine saisie — et ils masquaient le champ dans lequel on
 * tape. Ils reviennent dès que le clavier se referme.
 *
 * Le seuil est à cent vingt pixels parce que la barre d'adresse, qui
 * s'escamote au défilement, rétrécit elle aussi la fenêtre visible — de
 * quarante à soixante pixels. La confondre avec un clavier ferait
 * disparaître la navigation à chaque coup de pouce.
 */
const fenetreVisible = window.visualViewport;
if (fenetreVisible) {
  const guetter = () => {
    const manque = window.innerHeight - fenetreVisible.height;
    document.body.classList.toggle('clavier-ouvert', manque > 120);
  };
  fenetreVisible.addEventListener('resize', guetter);
  /* `scroll` aussi : iOS ne prévient pas toujours à la fermeture, et le
     premier défilement qui suit est le moment où l'on s'en aperçoit. */
  fenetreVisible.addEventListener('scroll', guetter);
  guetter();
}

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

/* ─── Le premier jour ──────────────────────────────────────────────────
 *
 * Un carnet vierge ouvrait droit sur le réglage du classement, sans un
 * mot d'explication : on tombait sur un formulaire fédéral avant d'avoir
 * compris où l'on était. C'était supportable pour qui a écrit le site ;
 * ça ne l'est pas pour quelqu'un à qui l'on vient d'envoyer un lien.
 *
 * Trois phrases, puis deux chemins. Le compte est proposé en premier
 * parce que c'est la seule chose qu'on regrette de ne pas avoir faite :
 * trois mois de matchs notés sur un téléphone, et rien sur l'ordinateur.
 * Mais il ne barre pas la route — le carnet marche sans compte, et le
 * dire est plus honnête que de faire semblant d'exiger une inscription.
 */
function accueilPremierJour() {
  openModal({
    title: 'Bienvenue',
    body: `<p>Ce carnet range une saison de tennis : les matchs et leur score, le
        classement et ce qu'il faudrait pour monter, les clubs où l'on joue, les
        conseils du prof qu'on oublie en sortant du court.</p>
      <p class="tiny muted">Tout reste dans ton navigateur, et rien ne part nulle part
        sans que tu le demandes. Il fonctionne sans réseau — c'est fait pour un bord de
        court.</p>
      <p class="tiny muted">Un compte ne sert qu'à une chose : retrouver le même carnet
        sur ton téléphone et sur ton ordinateur. Tu peux le créer maintenant ou plus tard,
        rien ne sera perdu.</p>
      <div class="rangee-boutons" style="margin-top:14px">
        <button class="btn btn-primary" data-compte>Créer un compte</button>
        <button class="btn" data-sans-compte>Commencer sans compte</button>
      </div>`,
    onMount: corps => {
      corps.addEventListener('click', e => {
        if (e.target.closest('[data-compte]')) {
          closeModal();
          /* Le profil, où vit le bloc du compte. La fenêtre de réglage du
             classement viendra après, une fois le compte réglé : deux
             formulaires empilés le premier jour, c'est un de trop. */
          location.hash = '#/matos';
          return;
        }
        if (e.target.closest('[data-sans-compte]')) {
          closeModal();
          /* Le classement conditionne tout le calcul des points : c'est la
             seule chose qu'on demande avant de laisser entrer. */
          setTimeout(profilForm, 250);
        }
      });
    },
  });
}

if (etat.neuf) {
  setTimeout(() => { if (!store.matchs.length) accueilPremierJour(); }, 400);
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
