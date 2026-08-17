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
import { store } from './store.js';
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
    /* Le nom vient après « contre » : c'est la seule tournure fiable à
       l'oral. Sans elle on laisse vide plutôt que de ramasser un mot. */
    const nom = texte.match(/\bcontre\s+([A-ZÉÈÀÂ][\wÀ-ÿ'-]*(?:\s+[A-ZÉÈÀÂ][\wÀ-ÿ'-]*)?)/);
    element.match = {
      date: aujourdhui(),
      issue: perdu ? 'D' : 'V',
      adversaire: nom ? nom[1].trim() : '',
      score: score.trim(),
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
async function rangerEnLigne(texte) {
  const jeton = await nuage.jetonCourant();
  if (!jeton) throw new Error('Connexion requise pour le tri assisté.');

  const r = await fetch('/api/dicter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jeton}` },
    body: JSON.stringify({
      texte,
      echelon: store.profil.echelon,
      adversaires: repertoire().slice(0, 60).map(j => j.nom),
    }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.erreur || `Erreur ${r.status}`);
  return d.elements || [];
}

// =====================================================================
//  L'écran
// =====================================================================
const NOMS = {
  match: '🎾 Un match', conseil: '💡 Un conseil', joueur: '👤 Un adversaire',
  course: '🛒 À acheter', cordage: '🪢 Un cordage',
};

export function dicterModal() {
  let reconnaissance = null;
  let elements = [];

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
      const bouton = racine.querySelector('[data-micro]');

      if (!micDisponible()) {
        bouton.disabled = true;
        etat.textContent = 'Ce navigateur ne sait pas dicter — Firefox notamment. '
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
          if (!/Connexion requise/.test(err.message)) {
            etat.textContent = `Tri assisté indisponible (${err.message}) — tri local utilisé.`;
          }
        }
      };

      props.addEventListener('click', e => {
        const b = e.target.closest('[data-ouvrir]');
        if (!b) return;
        const el = elements[+b.dataset.ouvrir];
        closeModal();
        ouvrirFormulaire(el);
      });
    },
  });
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
      const nom = el.joueur?.nom || '';
      const j = repertoire().find(x => x.nom.toLowerCase() === nom.toLowerCase());
      if (!j) { toast(`Aucun adversaire nommé « ${nom} » dans le carnet.`); return; }
      return joueurForm({ ...j, fiche: { ...(j.fiche || {}), ...(el.joueur || {}) } });
    }
    default:
      toast('Destination inconnue.');
  }
}
