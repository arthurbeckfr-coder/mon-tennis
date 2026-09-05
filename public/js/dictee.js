/* Dicter une note, et la ranger au bon endroit.

   ─── Deux couches, et la première n'est pas un repli ─────────────────

   Le tri local, par mots-clés, marche sans réseau et sans clé. C'est celui
   qui sert sur un court, là où il n'y a ni l'un ni l'autre — c'est-à-dire
   au moment précis où l'on a quelque chose à noter. Il est bête mais
   fiable : il reconnaît un score, un « il faut que je rachète », un
   cordage cassé.

   Le tri par Claude ne sert qu'au-dessus, quand le réseau est là : il
   démêle les phrases que les mots-clés ne savent pas couper, celles qui
   contiennent trois choses à la fois. Il passe par une fonction serveur,
   parce que la clé de l'API ne peut pas vivre dans une page publique.

   ─── Rien n'est enregistré sans relecture ────────────────────────────

   Dans les deux cas on propose, on n'enregistre pas. Une dictée mal
   comprise doit se corriger sur-le-champ, pas se découvrir trois semaines
   plus tard au milieu des statistiques. */

import { openModal, closeModal, toast, h, aujourdhui } from './util.js';
import { store, PROFILS, MOMENTS, SURFACES } from './store.js';
import { ECHELONS } from './classement.js';
import { COUPS } from './terrain.js';
import { SUPABASE_URL, SUPABASE_CLE } from './config.js';
import * as nuage from './nuage.js';
import { matchForm, conseilForm, courseForm, cordageForm, joueurForm } from './forms.js';
import { repertoire } from './views/joueurs.js';

// =====================================================================
//  Le micro
// =====================================================================
/* L'API de reconnaissance vocale du navigateur. Chrome l'implémente en
   envoyant l'audio à Google : ce n'est donc pas une dictée hors ligne, et
   il faut le dire plutôt que de laisser croire le contraire. Firefox ne
   l'implémente pas du tout — d'où le repli sur la frappe, annoncé. */
const Reconnaissance = window.SpeechRecognition || window.webkitSpeechRecognition;
export const micDisponible = () => !!Reconnaissance;

function ecouter({ surTexte, surFin, surErreur }) {
  const r = new Reconnaissance();
  r.lang = 'fr-FR';
  r.continuous = true;
  r.interimResults = true;

  let acquis = '';
  r.onresult = (e) => {
    let provisoire = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) acquis += t + ' ';
      else provisoire += t;
    }
    surTexte((acquis + provisoire).trim());
  };
  r.onerror = (e) => surErreur(
    e.error === 'not-allowed' ? 'Micro refusé par le navigateur.'
    : e.error === 'no-speech' ? 'Rien entendu.'
    : `Micro : ${e.error}`);
  r.onend = () => surFin(acquis.trim());
  r.start();
  return r;
}

// =====================================================================
//  Le tri local
// =====================================================================
const sansAccent = s => (s || '').toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const MOTIF_SCORE = /\b\d\s*[/-]\s*\d\b(?:.*?\b\d\s*[/-]\s*\d\b)?/;

/** Les indices qui désignent une destination, du plus décisif au moins. */
const INDICES = [
  { destination: 'cordage', motif: /\b(cordage|corde|recorder|recordage|casse (mon|ma|le|la) cord)/ },
  { destination: 'course',  motif: /\b(rachet|acheter|il me faut|besoin d|prendre des|commander|stock)/ },
  { destination: 'match',   motif: /\b(gagn|perdu|battu|victoire|defaite|match contre|joue contre)/ },
  { destination: 'conseil', motif: /\b(il faut que je|penser a|se rappeler|conseil|le prof|coach|toujours|ne jamais)/ },
];

const PROFILS_MOTS = {
  chipeur: /\b(chipe|slice|coupe la balle)/,
  jeune: /\b(jeune|gamin|cadet|junior)/,
  gaucher: /\bgaucher/,
  decalage: /\bdecalage/,
  defenseur: /\b(defenseur|releve tout|renvoie tout|mur)/,
  attaquant: /\b(attaquant|monte au filet|serveur volleyeur)/,
  lifteur: /\b(lifte|lift)/,
  physique: /\b(physique|court partout|endurant)/,
};

/** L'adversaire, dans l'ordre du plus sûr au moins sûr.
 *
 *  D'abord un nom du répertoire : si l'on a déjà joué contre Dupont et
 *  que le mot « dupont » est dans la phrase, c'est lui — la
 *  reconnaissance vocale rend les noms en minuscules et sans accents,
 *  alors on compare de la même façon. C'est de loin le plus fiable :
 *  aucune grammaire à deviner, une liste fermée à reconnaître.
 *
 *  À défaut, ce qui suit « contre ». La version d'avant exigeait une
 *  majuscule, que la dictée ne met jamais : « j'ai gagné contre pierre
 *  martin » ne donnait donc rien du tout. On accepte les minuscules et
 *  l'on s'arrête au premier mot de liaison, sans quoi le nom emporterait
 *  la moitié de la phrase.
 */
function adversaireDicte(texte, t) {
  const connus = repertoire()
    .map(j => j.nom)
    .sort((a, b) => b.length - a.length);   // « jean dupont » avant « jean »
  for (const nom of connus) {
    const cle = sansAccent(nom).toLowerCase();
    if (cle.length > 2 && t.includes(cle)) return nom;
  }

  /* Les mots qui ne peuvent pas être un nom de famille : ils marquent la
     fin du nom. Sans eux, « contre Martin en finale » donnait « Martin
     en » — et le carnet aurait gardé un adversaire nommé « Martin En ». */
  const LIAISON = 'en|au|aux|a|le|la|les|du|de|des|sur|sous|dans|par|pour|avec'
    + '|score|set|jeu|j|et|puis|hier|aujourd|ce|cet|cette|mon|ma|mes|il|elle|on';
  const m = texte.match(new RegExp(
    `\\bcontre\\s+((?!(?:${LIAISON})\\b)[A-Za-zÀ-ÿ][\\wÀ-ÿ'-]*`
    + `(?:\\s+(?!(?:${LIAISON})\\b)[A-Za-zÀ-ÿ][\\wÀ-ÿ'-]*)?)`, 'i'));
  if (!m) return '';
  /* Écrit comme on écrit un nom : la dictée rend « pierre martin ». */
  return m[1].trim().split(/\s+/)
    .map(x => x.charAt(0).toUpperCase() + x.slice(1))
    .join(' ');
}

/** Le tour, quand il est dit. « Finale » attrape aussi « demi-finale » :
 *  on cherche donc du plus précis au moins précis. */
const TOURS_MOTS = [
  ['demie', /\b(demi[- ]?finale|demie)/],
  ['quart', /\bquart/],
  ['huitieme', /\b(huitieme|8e|1\/8)/],
  ['seizieme', /\b(seizieme|16e|1\/16)/],
  ['trentedeuxieme', /\b(trente[- ]?deuxieme|32e|1\/32)/],
  ['qualif', /\b(qualif|qualification)/],
  ['poule', /\bpoule/],
  ['tour1', /\b(premier tour|1er tour)/],
  ['finale', /\bfinale/],
];
const tourDicte = t => (TOURS_MOTS.find(([, m]) => m.test(t)) || [''])[0];

/** La surface, dans les mots du carnet — et seulement si elle y est :
 *  une surface inventée fausse une statistique pour toujours. */
const SURFACES_MOTS = [
  ['Terre battue traditionnelle', /\bterre battue|\bterre\b|\bocre\b/],
  ['Terre artificielle', /\bterre artificielle|\bterre synthetique/],
  ['Résine', /\bresine|\bdur\b|\bgreenset|\bgreen set/],
  ['Moquette', /\bmoquette/],
  ['Gazon synthétique', /\bgazon/],
  ['Béton poreux', /\bbeton/],
];
const surfaceDictee = t => (SURFACES_MOTS.find(([, m]) => m.test(t)) || [''])[0];

/** Le tournoi. On ne devine que la tournure explicite — « au tournoi de
 *  Dieppe », « à l'open de Puys » — et l'on rend la main sinon : un nom
 *  d'épreuve faux se propage au club, à la surface et aux statistiques. */
function tournoiDicte(texte, t) {
  const connus = [...new Set(store.matchs.map(m => (m.tournoi || '').trim()).filter(Boolean))]
    .sort((a, b) => b.length - a.length);
  for (const nom of connus) {
    const cle = sansAccent(nom).toLowerCase();
    if (cle.length > 5 && t.includes(cle)) return nom;
  }
  const STOP = 'sur|en|au|a|le|la|les|du|de|des|dans|par|pour|avec|contre|j|et|puis|hier';
  const m = texte.match(new RegExp(
    `\\b(?:tournoi|open|championnat)\\s+(?:de\\s+la\\s+|de\\s+|du\\s+|des\\s+|d['’]\\s*)?`
    + `((?!(?:${STOP})\\b)[A-Za-zÀ-ÿ][\\wÀ-ÿ'’-]*`
    + `(?:\\s+(?!(?:${STOP})\\b)[A-Za-zÀ-ÿ][\\wÀ-ÿ'’-]*)?)`, 'i'));
  return m ? m[0].trim().toUpperCase() : '';
}

/**
 * Range une dictée sans réseau. Devine la destination et ce qu'il peut
 * des champs — jamais le reste.
 */
export function rangerLocalement(texte) {
  const t = sansAccent(texte);
  if (!t.trim()) return [];

  let destination = 'conseil';
  for (const i of INDICES) {
    if (i.motif.test(t)) { destination = i.destination; break; }
  }
  // Un score l'emporte sur tout : c'est le signe le plus sûr d'un match.
  if (MOTIF_SCORE.test(texte) && destination !== 'cordage') destination = 'match';

  const element = { destination, resume: texte.slice(0, 120), _local: true };

  if (destination === 'match') {
    const score = (texte.match(new RegExp(MOTIF_SCORE.source, 'g')) || []).join(' ');
    const perdu = /\b(perdu|defaite|battu par)/.test(t);
    element.match = {
      date: aujourdhui(),
      issue: perdu ? 'D' : 'V',
      adversaire: adversaireDicte(texte, t),
      score: score.trim(),
      tour: tourDicte(t),
      surface: surfaceDictee(t),
      tournoi: tournoiDicte(texte, t),
      wo: /\b(forfait|w\.?o\.?)\b/.test(t),
      notes: texte,
    };
  } else if (destination === 'course') {
    /* On cherche la position sur le texte désaccentué, puis on coupe le
       texte d'origine au même endroit : « rachète » porte un accent que le
       motif ne verrait pas, et on garderait toute la phrase pour nom. */
    const amorce = t.match(/\b(rachet\w*|achet\w*|il me faut|besoin d\w*|prendre des)\s*/);
    const nom = (amorce ? texte.slice(amorce.index + amorce[0].length) : texte)
      // L'article qui traîne en tête (« des surgrips », « 'un tube ») n'est
      // pas le nom de l'article : on le retire pour une liste lisible.
      .replace(/^['’\s]*(du|de la|de l['’]?|des|un|une|le|la|les)\s+/i, '')
      .trim();
    element.course = { nom: nom.slice(0, 60) || texte.slice(0, 60), categorie: 'materiel' };
  } else if (destination === 'cordage') {
    element.cordage = { cause: /\bcasse/.test(t) ? 'casse' : 'usure', note: texte };
  } else {
    const profils = Object.entries(PROFILS_MOTS)
      .filter(([, m]) => m.test(t)).map(([k]) => k);
    element.conseil = { titre: texte.slice(0, 80), texte, categorie: 'tactique', profils };
  }
  return [element];
}

// =====================================================================
//  Le tri assisté
// =====================================================================
/* Ce que le carnet sait déjà, et qu'il faut donner pour être rattaché.

   C'est là tout l'intérêt du tri assisté : sans ces listes, « l'open de
   Puys » dicté trois fois de trois façons ferait trois tournois, et le
   palmarès compterait trois titres au lieu d'un. Avec elles, Claude
   choisit le libellé qui existe plutôt que d'en écrire un quatrième.

   Les listes sont bornées : soixante adversaires, quarante tournois. Un
   carnet de dix ans en compte trois cents, qu'on paierait à chaque
   dictée pour reconnaître celui de dimanche. Les plus récents d'abord —
   on dicte le match qu'on vient de jouer, pas celui de 2019. */
function contexte() {
  const tournois = [];
  for (const m of [...store.matchs].sort((a, b) => (b.date || '').localeCompare(a.date || ''))) {
    const t = (m.tournoi || '').trim();
    if (t && !tournois.includes(t)) tournois.push(t);
    if (tournois.length >= 40) break;
  }
  return {
    aujourdhui: aujourdhui(),
    echelon: store.profil.echelon,
    adversaires: repertoire().slice(0, 60).map(j => j.nom),
    tournois,
    clubs: store.clubs.map(c => c.nom).slice(0, 40),
    surfaces: SURFACES,
    echelons: ECHELONS,
    profils: PROFILS.map(p => p.cle),
    moments: MOMENTS.map(m => m.cle),
    coups: COUPS.map(c => c.cle),
  };
}

async function rangerEnLigne(texte) {
  const jeton = await nuage.jetonCourant();
  if (!jeton) throw new Error('Connecte-toi pour le tri assisté.');

  /* L'adresse de la fonction du projet, et non un chemin relatif : le
     site est publié sur des pages statiques, où « /api/dicter » n'est
     rien du tout. Il y a été appelé longtemps sans jamais répondre — le
     tri retombait chaque fois sur les mots-clés, en silence. */
  const r = await fetch(`${SUPABASE_URL}/functions/v1/dicter`, {
    method: 'POST',
    /* La clé publique voyage avec le jeton : la fonction en a besoin
       pour demander à la base qui parle, et elle n'a rien de secret —
       elle est déjà dans cette page. */
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jeton}`,
      apikey: SUPABASE_CLE,
    },
    body: JSON.stringify({ texte, ...contexte() }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.erreur || `Erreur ${r.status}`);
  return (d.elements || []).map(e => ({ ...e, _assiste: true }));
}

// =====================================================================
//  L'écran
// =====================================================================
const NOMS = {
  match: '🎾 Un match', conseil: '💡 Un conseil', joueur: '👥 Un adversaire',
  course: '🛒 À acheter', cordage: '🪢 Un cordage',
};

/* ─── Ce qui reste à ranger ────────────────────────────────────────────
 *
 * Une dictée fait souvent trois choses : un match, un conseil, une
 * course. On en ouvrait une, la fenêtre se fermait, et les deux autres
 * disparaissaient avec elle — il fallait tout redicter pour la suivante.
 *
 * D'où cette reprise. Le formulaire s'ouvre par-dessus la liste, et
 * quand il se referme — enregistré ou abandonné — la liste revient avec
 * ce qui reste. On sait qu'il s'est refermé en regardant la fenêtre :
 * elles partagent la même racine, et elle se vide.
 */
export function dicterModal(depart = null) {
  let reconnaissance = null;
  let elements = depart?.elements || [];
  const texteInitial = depart?.texte || '';
  const assisteInitial = !!depart?.assiste;

  openModal({
    title: 'Dicter une note',
    large: true,
    body: `<div class="form">
      <div class="rangee-boutons" style="justify-content:center">
        <button class="btn btn-primary btn-micro" data-micro>🎤 Parler</button>
      </div>
      <p id="etat-micro" class="tiny muted" style="text-align:center"></p>
      <label>Ce que tu dis
        <textarea id="dictee" rows="5"
          placeholder="J'ai gagné 6/4 6/2 contre Dupont, il chipait tout, et il faut que je rachète des surgrips."></textarea>
      </label>
      <div id="propositions"></div>
    </div>`,
    footer: `<button class="btn" data-ranger>Ranger</button>`,
    onMount: () => {
      const racine = document.getElementById('modal-root');
      const zone = racine.querySelector('#dictee');
      const etat = racine.querySelector('#etat-micro');
      const props = racine.querySelector('#propositions');
      if (texteInitial) zone.value = texteInitial;
      const bouton = racine.querySelector('[data-micro]');

      if (!micDisponible()) {
        bouton.disabled = true;
        /* Ni Firefox ni aucun navigateur sur iPhone : sur iOS, tous
           passent par le moteur de Safari, qui n'implémente pas la
           reconnaissance vocale. Dire « ce navigateur » laissait croire
           qu'en changer suffirait. Le clavier du téléphone, lui, sait
           dicter — et c'est la bonne réponse, pas un pis-aller. */
        const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
          || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        etat.textContent = iOS
          ? 'Sur iPhone, aucun navigateur ne sait dicter — c\'est iOS qui ne le permet pas. '
            + 'Touche le champ ci-dessous et utilise le 🎤 de ton clavier : le rangement fonctionne pareil.'
          : 'Ce navigateur ne sait pas dicter — Firefox notamment. '
            + 'Tape ta note, le rangement fonctionne pareil.';
      } else {
        etat.textContent = 'La dictée passe par le service de reconnaissance du navigateur : '
          + 'elle demande du réseau.';
      }

      bouton.onclick = () => {
        if (reconnaissance) { reconnaissance.stop(); return; }
        try {
          bouton.textContent = '⏹ Arrêter';
          bouton.classList.add('ecoute');
          etat.textContent = 'J\'écoute…';
          reconnaissance = ecouter({
            surTexte: t => { zone.value = t; },
            surFin: () => {
              reconnaissance = null;
              bouton.textContent = '🎤 Parler';
              bouton.classList.remove('ecoute');
              etat.textContent = zone.value ? 'Relis, puis range.' : 'Rien entendu.';
            },
            surErreur: m => { etat.textContent = m; },
          });
        } catch (err) {
          etat.textContent = 'Micro indisponible : ' + err.message;
          bouton.textContent = '🎤 Parler';
          bouton.classList.remove('ecoute');
          reconnaissance = null;
        }
      };

      const dessiner = (assiste) => {
        if (!elements.length) {
          props.innerHTML = `<div class="note-vide">Rien compris dans cette note.</div>`;
          return;
        }
        props.innerHTML = `
          <div class="resume-import">
            <strong>${elements.length} élément(s)</strong> —
            ${assiste ? 'trié par Claude' : 'trié localement, sans réseau'}
          </div>
          <ul class="propositions">
            ${elements.map((e, i) => `<li>
              <span class="prop-dest">${NOMS[e.destination] || e.destination}</span>
              <span class="prop-resume">${h(e.resume || '')}</span>
              <button class="btn btn-ghost" data-ouvrir="${i}">Ouvrir</button>
            </li>`).join('')}
          </ul>
          <p class="tiny muted">Rien n'est enregistré : « Ouvrir » remplit le formulaire
            correspondant, que tu valides ou non.</p>`;
      };

      if (elements.length) dessiner(assisteInitial);

      racine.querySelector('[data-ranger]').onclick = async () => {
        const texte = zone.value.trim();
        if (!texte) { toast('Rien à ranger.'); return; }
        props.innerHTML = '<p class="tiny muted">Rangement…</p>';

        /* On tente l'assisté, on retombe sur le local sans le dire comme
           un échec : le local est le mode normal sur un court. */
        try {
          elements = await rangerEnLigne(texte);
          dessiner(true);
        } catch (err) {
          elements = rangerLocalement(texte);
          dessiner(false);
          /* La raison se pose au-dessus des propositions, et non sous le
             bouton du micro : c'est là qu'on regarde après avoir rangé,
             et une explication qu'on ne voit pas ne vaut pas mieux qu'un
             silence. */
          props.insertAdjacentHTML('afterbegin',
            `<p class="alerte tiny">${h(/Connecte-toi/.test(err.message)
              ? 'Claude n\'a pas trié : connecte-toi dans ton profil.'
              : `Claude n'a pas trié — ${err.message}`)}</p>`);
          /* On dit toujours pourquoi. Le tri assisté a passé des mois à
             échouer sans un mot — l'adresse qu'il appelait n'existait
             pas —, et l'on croyait lire Claude là où l'on lisait trois
             expressions régulières. Un repli silencieux est un mensonge
             par omission. */
          etat.textContent = /Connecte-toi/.test(err.message)
            ? 'Tri local : connecte-toi pour que Claude range à ta place.'
            : `Tri local — le tri assisté n'a pas répondu : ${err.message}`;
        }
      };

      props.addEventListener('click', e => {
        const b = e.target.closest('[data-ouvrir]');
        if (!b) return;
        const i = +b.dataset.ouvrir;
        const el = elements[i];
        /* Ce qui reste, sans celui qu'on ouvre : rangé ou non, on ne le
           repropose pas — sinon la liste tourne en rond. */
        const reste = elements.filter((_, j) => j !== i);
        closeModal();
        ouvrirFormulaire(el);
        if (reste.length) reprendreApres(reste, zone.value, assisteInitial);
      });
    },
  });
}

/** Rouvre la liste dès que le formulaire posé par-dessus s'est refermé.
 *
 *  On guette la racine des fenêtres plutôt qu'un événement : les
 *  formulaires ne préviennent pas quand ils se ferment, et leur en faire
 *  prévenir treize obligerait à toucher treize fonctions pour un besoin
 *  qui n'en concerne qu'une.
 */
function reprendreApres(reste, texte, assiste) {
  const racine = document.getElementById('modal-root');
  const guet = new MutationObserver(() => {
    if (racine.querySelector('.modal')) return;   // un formulaire est encore là
    guet.disconnect();
    /* Le temps que la fermeture finisse : rouvrir dans la même
       respiration ferait clignoter l'écran. */
    setTimeout(() => dicterModal({ elements: reste, texte, assiste }), 220);
  });
  guet.observe(racine, { childList: true });
}

/** Ouvre le formulaire de la destination, pré-rempli. */
function ouvrirFormulaire(el) {
  switch (el.destination) {
    case 'match':
      return matchForm({ date: aujourdhui(), issue: 'V', adversaire: '', score: '',
                         echelonAdverse: store.profil.echelon, tournoi: '', surface: '',
                         notes: '', wo: false, ...(el.match || {}) });
    case 'conseil':
      return conseilForm({ date: aujourdhui(), titre: '', texte: '', categorie: 'tactique',
                           profils: [], moments: [], coups: [], source: '', favori: false,
                           ...(el.conseil || {}) });

    case 'course':
      return courseForm({ nom: '', icone: '🎾', categorie: 'materiel', recurrent: false,
                          note: '', ...(el.course || {}) });
    case 'cordage':
      return cordageForm({ date: aujourdhui(), raquetteId: store.raquettes[0]?.id || '',
                           cause: 'casse', marque: '', tension: '', note: '',
                           ...(el.cordage || {}) });
    case 'joueur': {
      const nom = (el.joueur?.nom || '').trim();
      if (!nom) { toast('Aucun nom dans cette note.'); return; }
      const j = repertoire().find(x => x.nom.toLowerCase() === nom.toLowerCase());
      /* Un adversaire inconnu se crée au lieu d'être refusé. Le carnet
         sait le faire depuis qu'on peut en ajouter un avant de l'avoir
         joué — et c'est exactement ce qu'on vient de dicter : ce qu'on
         sait de quelqu'un qu'on va rencontrer. */
      return j
        ? joueurForm({ ...j, fiche: { ...(j.fiche || {}), ...(el.joueur || {}) } })
        : joueurForm({ nom, fiche: { profils: [], note: '', club: '', ...(el.joueur || {}) } });
    }
    default:
      toast('Destination inconnue.');
  }
}
