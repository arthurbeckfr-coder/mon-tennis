/* Les formulaires de saisie.

   Un principe les gouverne tous : ce qui se saisit après un cours ou entre
   deux matchs doit tenir en quelques gestes. Les champs indispensables
   d'abord, le reste replié. Un conseil qu'on renonce à noter parce que le
   formulaire est long est un conseil perdu. */

import { openModal, closeModal, toast, h, aujourdhui, uid, confirmer } from './util.js';
import { ECHELONS, BAREME_DEFAUT } from './classement.js';
import {
  store, maj, sauver,
  ajouterMatch, modifierMatch, supprimerMatch,
  ajouterConseil, modifierConseil, supprimerConseil,
  ajouterSource, ajouterClub, modifierClub, clubDuMatch, surfaceDuMatch,
  exporterJSON, importerJSON, toutEffacer,
  PROFILS, MOMENTS, CATEGORIES, PLATEFORMES, SURFACES,
} from './store.js';
import { analyser, EXEMPLE } from './import-fft.js';
import { blocTerrain, brancherTerrain } from './terrain.js';

const opts = (liste, choisi) => liste
  .map(v => `<option value="${h(v)}" ${v === choisi ? 'selected' : ''}>${h(v)}</option>`).join('');

const cases = (liste, choisis = [], nom) => liste.map(x => `
  <label class="case">
    <input type="checkbox" name="${nom}" value="${h(x.cle)}"
           ${choisis.includes(x.cle) ? 'checked' : ''}>
    <span>${x.emoji} ${h(x.nom)}</span>
  </label>`).join('');

const valeurs = (form, nom) =>
  [...form.querySelectorAll(`[name="${nom}"]:checked`)].map(i => i.value);

/** Enregistre et le dit. Un échec d'écriture (mode privé, quota plein) ne
 *  doit jamais passer pour un succès. */
function conclure(resultat, message) {
  if (resultat && resultat.ok === false) {
    toast(`Impossible d'enregistrer : ${resultat.erreur}`);
    return false;
  }
  closeModal();
  toast(message);
  return true;
}

// =====================================================================
//  Un match
// =====================================================================
export function matchForm(existant = null) {
  const m = existant || {
    date: aujourdhui(), issue: 'V', adversaire: '', echelonAdverse: store.profil.echelon,
    score: '', tournoi: '', surface: '', notes: '', wo: false,
  };

  /* Le club se devine du libellé de l'épreuve, et la surface se devine du
     club. On ne l'impose pas pour autant : on la propose, et le champ reste
     vide tant qu'on n'a pas confirmé — une surface fausse dans l'historique
     vaut moins qu'une surface absente. */
  const deduit = clubDuMatch(m);
  const suggestion = surfaceDuMatch(m);
  const surfacesPossibles = [...new Set([
    ...(deduit?.surfaces || []),
    ...SURFACES,
  ])];

  openModal({
    title: existant ? 'Modifier le match' : 'Nouveau match',
    body: `<form id="f-match" class="form">
      <div class="duo">
        <label>Date<input type="date" name="date" value="${h(m.date)}" required></label>
        <label>Issue
          <select name="issue">
            <option value="V" ${m.issue === 'V' ? 'selected' : ''}>Victoire</option>
            <option value="D" ${m.issue === 'D' ? 'selected' : ''}>Défaite</option>
          </select>
        </label>
      </div>
      <label>Adversaire
        <input name="adversaire" value="${h(m.adversaire)}" placeholder="Nom" required>
      </label>
      <div class="duo">
        <label>Son classement
          <select name="echelonAdverse">${opts(ECHELONS, m.echelonAdverse)}</select>
        </label>
        <label>Score
          <input name="score" value="${h(m.score)}" placeholder="6/4 6/3">
        </label>
      </div>
      <details ${m.tournoi || m.surface || m.notes ? 'open' : ''}>
        <summary>Contexte et ressenti</summary>
        <label>Épreuve
          <input name="tournoi" value="${h(m.tournoi)}" placeholder="Tournoi, championnat par équipes…">
        </label>
        <label>Club
          <select name="clubId">
            <option value="">${deduit ? `Déduit du nom : ${h(deduit.nom)}` : 'Aucun club reconnu'}</option>
            ${store.clubs.map(c => `<option value="${h(c.id)}" ${m.clubId === c.id ? 'selected' : ''}>
              ${h(c.nom)}</option>`).join('')}
          </select>
        </label>
        ${suggestion.origine === 'ambigu' ? `<p class="tiny muted">${h(deduit.nom)} a plusieurs
          surfaces (${h(suggestion.choix.join(', '))}) : à toi de dire laquelle.</p>` : ''}
        <label>Surface
          <select name="surface">
            <option value="">${suggestion.origine === 'club'
              ? `Celle du club : ${h(suggestion.surface)}` : '—'}</option>
            ${opts(surfacesPossibles, m.surface)}
          </select>
        </label>
        <label class="case case-seule">
          <input type="checkbox" name="wo" ${m.wo ? 'checked' : ''}>
          <span>Match non joué (W.O., forfait)</span>
        </label>
        <label>Ce que j'en retiens
          <textarea name="notes" rows="4"
            placeholder="Ce qui a marché, ce qui a lâché, ce qu'il faudra travailler.">${h(m.notes)}</textarea>
        </label>
      </details>
    </form>`,
    footer: `${existant ? '<button class="btn btn-danger" data-suppr>Supprimer</button>' : ''}
             <button class="btn btn-primary" data-ok>${existant ? 'Enregistrer' : 'Ajouter'}</button>`,
    onMount: () => {
      const racine = document.getElementById('modal-root');
      const form = racine.querySelector('#f-match');

      racine.querySelector('[data-ok]').onclick = () => {
        if (!form.reportValidity()) return;
        const d = Object.fromEntries(new FormData(form));
        d.wo = form.wo.checked;
        conclure(
          existant ? modifierMatch(existant.id, d) : ajouterMatch(d),
          existant ? 'Match modifié.' : 'Match ajouté.');
      };

      racine.querySelector('[data-suppr]')?.addEventListener('click', async () => {
        closeModal();
        if (await confirmer('Supprimer ce match ?', `${m.adversaire} — ${m.score || 'sans score'}`)) {
          supprimerMatch(existant.id);
          toast('Match supprimé.');
        }
      });
    },
  });
}

// =====================================================================
//  Un conseil
// =====================================================================
export function conseilForm(existant = null) {
  const c = existant || {
    date: aujourdhui(), titre: '', texte: '', categorie: 'tactique',
    profils: [], moments: [], source: '', favori: false,
  };

  openModal({
    title: existant ? 'Modifier le conseil' : 'Noter un conseil',
    large: true,
    body: `<form id="f-conseil" class="form">
      <label>Le conseil, en une phrase
        <input name="titre" value="${h(c.titre)}" required
               placeholder="Ex. : contre un chipeur, avancer d'un mètre">
      </label>
      <label>Le détail
        <textarea name="texte" rows="5"
          placeholder="Ce que le prof a dit, avec ses mots. Le pourquoi compte autant que le quoi.">${h(c.texte)}</textarea>
      </label>
      <div class="duo">
        <label>Catégorie
          <select name="categorie">
            ${CATEGORIES.map(x => `<option value="${x.cle}" ${x.cle === c.categorie ? 'selected' : ''}>
              ${x.emoji} ${h(x.nom)}</option>`).join('')}
          </select>
        </label>
        <label>Qui l'a dit
          <input name="source" value="${h(c.source)}" placeholder="Prénom du prof, stage…">
        </label>
      </div>

      <fieldset>
        <legend>De quel coup ça parle ?</legend>
        <p class="tiny muted">Touche l'endroit du terrain concerné — la zone, la direction,
           ou une pastille. C'est ce qui te permettra de le retrouver d'un pouce en match.</p>
        <div id="terrain-conseil"></div>
      </fieldset>

      <fieldset>
        <legend>Face à quel joueur ?</legend>
        <p class="tiny muted">Ce sont ces cases qui feront ressortir le conseil au bon moment,
           quand tu chercheras quoi faire contre l'adversaire en face.</p>
        <div class="grille-cases">${cases(PROFILS, c.profils, 'profils')}</div>
      </fieldset>

      <fieldset>
        <legend>À quel moment ?</legend>
        <div class="grille-cases">${cases(MOMENTS, c.moments, 'moments')}</div>
      </fieldset>

      <div class="duo">
        <label>Date<input type="date" name="date" value="${h(c.date)}"></label>
        <label class="case case-seule">
          <input type="checkbox" name="favori" ${c.favori ? 'checked' : ''}>
          <span>⭐ Essentiel — à voir en mode match</span>
        </label>
      </div>
    </form>`,
    footer: `${existant ? '<button class="btn btn-danger" data-suppr>Supprimer</button>' : ''}
             <button class="btn btn-primary" data-ok>${existant ? 'Enregistrer' : 'Noter'}</button>`,
    onMount: () => {
      const racine = document.getElementById('modal-root');
      const form = racine.querySelector('#f-conseil');

      /* Le terrain se redessine à chaque choix : c'est un dessin, pas un
         formulaire, donc la sélection vit ici et non dans des champs. */
      let coups = [...(c.coups || [])];
      const zoneTerrain = form.querySelector('#terrain-conseil');
      const redessiner = () => {
        zoneTerrain.innerHTML = blocTerrain({ selection: coups, gaucher: !!store.profil.gaucher });
      };
      redessiner();
      brancherTerrain(zoneTerrain, cle => {
        coups = coups.includes(cle) ? coups.filter(x => x !== cle) : [...coups, cle];
        redessiner();
      });

      racine.querySelector('[data-ok]').onclick = () => {
        if (!form.reportValidity()) return;
        const d = Object.fromEntries(new FormData(form));
        d.profils = valeurs(form, 'profils');
        d.moments = valeurs(form, 'moments');
        d.coups = coups;
        d.favori = form.favori.checked;
        conclure(
          existant ? modifierConseil(existant.id, d) : ajouterConseil(d),
          existant ? 'Conseil modifié.' : 'Conseil noté.');
      };

      racine.querySelector('[data-suppr]')?.addEventListener('click', async () => {
        closeModal();
        if (await confirmer('Supprimer ce conseil ?', c.titre)) {
          supprimerConseil(existant.id);
          toast('Conseil supprimé.');
        }
      });
    },
  });
}

// =====================================================================
//  Mon profil
// =====================================================================
export function profilForm() {
  const p = store.profil;
  openModal({
    title: 'Mon classement',
    body: `<form id="f-profil" class="form">
      <div class="duo">
        <label>Prénom<input name="prenom" value="${h(p.prenom)}" placeholder="Arthur"></label>
        <label>Barème
          <select name="sexe">
            <option value="h" ${p.sexe === 'h' ? 'selected' : ''}>Messieurs</option>
            <option value="f" ${p.sexe === 'f' ? 'selected' : ''}>Dames</option>
          </select>
        </label>
      </div>
      <div class="duo">
        <label>Mon classement
          <select name="echelon">${opts(ECHELONS, p.echelon)}</select>
        </label>
        <label>Ma main
          <select name="gaucher">
            <option value="" ${!p.gaucher ? 'selected' : ''}>Droitier</option>
            <option value="1" ${p.gaucher ? 'selected' : ''}>Gaucher</option>
          </select>
        </label>
      </div>
      <p class="tiny muted">La main décide de quel côté du terrain se trouve ton coup droit,
        sur le schéma des conseils.</p>
      <p class="tiny muted">Le bilan n'est plus à saisir : il se calcule depuis tes matchs,
        exactement comme le fait la fédération. Les deux réglages ci-dessous sont les seuls
        qu'on ne peut pas déduire — ils se lisent sur Ten'Up, onglet
        « Bilan classement ».</p>

      <div class="duo">
        <label>Bonus de victoires
          <input type="number" name="bonusVictoires" min="0" max="7" step="1"
                 value="${p.bonusVictoires ?? 0}">
        </label>
        <label>Bonus de points
          <input type="number" name="bonusPoints" min="0" step="1"
                 value="${p.bonusPoints ?? 0}">
        </label>
      </div>
      <p class="tiny muted">Le <strong>bonus de victoires</strong>, c'est le « +2 » de
        « victoires comptabilisées : 9+2 » — des victoires supplémentaires accordées à ton
        ratio. Sa formule n'est pas publiée, d'où la saisie ; à zéro, le calcul est
        seulement pessimiste. Le <strong>bonus de points</strong> est celui du double, qui
        s'ajoute au bilan.</p>

      <label>Bilan officiel Ten'Up (facultatif)
        <input type="number" name="bilanOfficiel" min="0" step="1"
               value="${p.bilanOfficiel ?? ''}" placeholder="pour vérifier le calcul">
      </label>
      <p class="tiny muted">Sert uniquement de contrôle. Si le calcul ne tombe pas dessus,
        c'est qu'il manque des matchs à l'historique — le site te le dira.</p>
    </form>`,
    footer: `<button class="btn btn-primary" data-ok>Enregistrer</button>`,
    onMount: () => {
      document.getElementById('modal-root').querySelector('[data-ok]').onclick = () => {
        const form = document.getElementById('f-profil');
        const d = Object.fromEntries(new FormData(form));
        conclure(maj(s => {
          s.profil = {
            ...s.profil,
            prenom: d.prenom,
            sexe: d.sexe,
            echelon: d.echelon,
            gaucher: d.gaucher === '1',
            bonusVictoires: Number(d.bonusVictoires) || 0,
            bonusPoints: Number(d.bonusPoints) || 0,
            bilanOfficiel: d.bilanOfficiel === '' ? null : Number(d.bilanOfficiel),
          };
        }), 'Classement enregistré.');
      };
    },
  });
}

// =====================================================================
//  Le barème, réglable
// =====================================================================
/* Le barème est recopié de sources publiques, pas d'un document officiel
   téléchargeable. Une divergence subsiste entre elles sur la victoire à
   trois échelons d'écart. Plutôt que de figer un chiffre incertain dans le
   code, on le rend modifiable : le jour où Ten'Up dit autre chose, la
   correction prend dix secondes. */
export function baremeForm() {
  const b = store.bareme;
  const LIGNES = [
    ['2',  'Adversaire 2 échelons au-dessus ou plus'],
    ['1',  'Adversaire 1 échelon au-dessus'],
    ['0',  'Même échelon'],
    ['-1', 'Adversaire 1 échelon en dessous'],
    ['-2', 'Adversaire 2 échelons en dessous'],
    ['-3', 'Adversaire 3 échelons en dessous'],
    ['-4', 'Adversaire 4 échelons en dessous ou plus'],
  ];

  openModal({
    title: 'Barème des victoires',
    body: `<form id="f-bareme" class="form">
      <p class="tiny muted">Ces valeurs sont recoupées entre deux sources publiques.
        Une seule fait débat : la victoire à trois échelons d'écart, donnée à 15 points
        par l'une et 10 par l'autre. Si ta fiche Ten'Up dit autre chose, corrige ici —
        tout le simulateur suivra.</p>
      ${LIGNES.map(([cle, libelle]) => `
        <label class="ligne-bareme">
          <span>${h(libelle)}</span>
          <input type="number" name="${cle}" value="${b[cle] ?? 0}" min="0" step="1">
        </label>`).join('')}
    </form>`,
    footer: `<button class="btn" data-defaut>Valeurs d'origine</button>
             <button class="btn btn-primary" data-ok>Enregistrer</button>`,
    onMount: () => {
      const racine = document.getElementById('modal-root');
      racine.querySelector('[data-defaut]').onclick = () => {
        const form = document.getElementById('f-bareme');
        for (const [k, v] of Object.entries(BAREME_DEFAUT)) form[k].value = v;
      };
      racine.querySelector('[data-ok]').onclick = () => {
        const d = Object.fromEntries(new FormData(document.getElementById('f-bareme')));
        conclure(maj(s => {
          s.bareme = Object.fromEntries(Object.entries(d).map(([k, v]) => [k, Number(v) || 0]));
        }), 'Barème enregistré.');
      };
    },
  });
}

// =====================================================================
//  Un club
// =====================================================================
/* Les mots-clés sont le cœur de cette fiche, et le seul champ dont
   l'utilité ne saute pas aux yeux : ce sont eux qui rattachent les matchs
   au club, en étant comparés au libellé de l'épreuve tel que la fédération
   l'a écrit. C'est pour ça qu'ils sont visibles et modifiables plutôt que
   cachés dans le code. */
export function clubForm(existant = null) {
  const c = existant || {
    nom: '', ville: '', adresse: '', telephone: '', mail: '',
    jugeArbitre: '', surfaces: [], motsCles: [], installations: '', note: '', sources: [],
  };
  let sources = [...(c.sources || [])];

  const listeSources = () => sources.length
    ? sources.map((s, i) => {
        const p = PLATEFORMES.find(x => x.cle === s.plateforme) || { emoji: '🔗', nom: s.plateforme };
        return `<li>${p.emoji} <span class="compte-nom">${h(p.nom)}</span>
          <span class="tiny muted">${h((s.url || '').slice(0, 34))}…</span>
          <button type="button" class="icon-btn" data-oter="${i}" aria-label="Retirer">✕</button></li>`;
      }).join('')
    : '<li class="tiny muted">Aucun compte suivi.</li>';

  openModal({
    title: existant ? 'Modifier le club' : 'Nouveau club',
    large: true,
    body: `<form id="f-club" class="form">
      <label>Nom du club<input name="nom" value="${h(c.nom)}" required placeholder="TENNIS CLUB DE…"></label>
      <div class="duo">
        <label>Ville<input name="ville" value="${h(c.ville)}"></label>
        <label>Téléphone<input name="telephone" value="${h(c.telephone)}" placeholder="02 35 …"></label>
      </div>
      <label>Adresse<input name="adresse" value="${h(c.adresse)}"></label>
      <div class="duo">
        <label>Mail<input name="mail" type="email" value="${h(c.mail)}"></label>
        <label>Juge-arbitre<input name="jugeArbitre" value="${h(c.jugeArbitre)}"></label>
      </div>
      <label>Surfaces
        <input name="surfaces" value="${h((c.surfaces || []).join(', '))}"
               placeholder="Résine, Terre battue">
      </label>
      <p class="tiny muted">Séparées par des virgules. Quand il n'y en a qu'une, elle
        est proposée d'office pour les matchs joués ici.</p>

      <label>Mots-clés de rattachement
        <input name="motsCles" value="${h((c.motsCles || []).join(', '))}"
               placeholder="VEULES, TC VEULES">
      </label>
      <p class="tiny muted">Ce sont eux qui relient les matchs à ce club : chacun est
        cherché dans le nom de l'épreuve, en mot entier. Sans cette précaution
        « VEULES » attraperait « VEULETTES », qui est un autre club.</p>

      <details>
        <summary>Réseaux sociaux et notes</summary>
        <ul class="comptes" id="liste-sources">${listeSources()}</ul>
        <div class="duo">
          <label>Plateforme
            <select id="src-plateforme">
              ${PLATEFORMES.map(p => `<option value="${p.cle}">${p.emoji} ${h(p.nom)}</option>`).join('')}
            </select>
          </label>
          <label>Adresse<input id="src-url" type="url" placeholder="https://…"></label>
        </div>
        <button type="button" class="btn" data-ajout-source>Ajouter ce compte</button>
        <label style="margin-top:12px">Installations
          <input name="installations" value="${h(c.installations || '')}" placeholder="3 terrains, 1 surface">
        </label>
        <label>Note<textarea name="note" rows="3">${h(c.note || '')}</textarea></label>
      </details>
    </form>`,
    footer: `<button class="btn btn-primary" data-ok>${existant ? 'Enregistrer' : 'Ajouter'}</button>`,
    onMount: () => {
      const racine = document.getElementById('modal-root');
      const form = racine.querySelector('#f-club');

      const rafraichir = () => { racine.querySelector('#liste-sources').innerHTML = listeSources(); };

      racine.querySelector('[data-ajout-source]').onclick = () => {
        const url = racine.querySelector('#src-url').value.trim();
        if (!url) { toast('Il manque l\'adresse du compte.'); return; }
        sources.push({ plateforme: racine.querySelector('#src-plateforme').value, url });
        racine.querySelector('#src-url').value = '';
        rafraichir();
      };

      racine.querySelector('#liste-sources').addEventListener('click', e => {
        const b = e.target.closest('[data-oter]');
        if (!b) return;
        sources.splice(+b.dataset.oter, 1);
        rafraichir();
      });

      racine.querySelector('[data-ok]').onclick = () => {
        if (!form.reportValidity()) return;
        const d = Object.fromEntries(new FormData(form));
        const liste = v => (v || '').split(',').map(x => x.trim()).filter(Boolean);
        const club = {
          ...d,
          surfaces: liste(d.surfaces),
          motsCles: liste(d.motsCles),
          sources,
        };
        conclure(
          existant ? modifierClub(existant.id, club) : ajouterClub(club),
          existant ? 'Club modifié.' : 'Club ajouté.');
      };
    },
  });
}

// =====================================================================
//  Une source à suivre
// =====================================================================
export function sourceForm() {
  openModal({
    title: 'Suivre un compte',
    body: `<form id="f-source" class="form">
      <label>Club ou compte
        <input name="club" required placeholder="TC de la Colline">
      </label>
      <label>Plateforme
        <select name="plateforme">
          ${PLATEFORMES.map(p => `<option value="${p.cle}">${p.emoji} ${h(p.nom)}</option>`).join('')}
        </select>
      </label>
      <label>Adresse
        <input name="url" type="url" required placeholder="https://…">
      </label>
      <label>Pourquoi je le suis
        <input name="note" placeholder="Tournois open, résultats de l'équipe…">
      </label>
    </form>`,
    footer: `<button class="btn btn-primary" data-ok>Ajouter</button>`,
    onMount: () => {
      document.getElementById('modal-root').querySelector('[data-ok]').onclick = () => {
        const form = document.getElementById('f-source');
        if (!form.reportValidity()) return;
        conclure(ajouterSource(Object.fromEntries(new FormData(form))), 'Compte ajouté.');
      };
    },
  });
}

// =====================================================================
//  Import depuis la fédération
// =====================================================================
/** Reconnaît une sauvegarde du carnet collée dans l'écran d'import.
 *  La confusion est facile — les deux écrans demandent de coller du texte —
 *  et ses conséquences sont sournoises : l'analyseur ne refuse pas le JSON,
 *  il y trouve des dates et en tire des matchs qui ont l'air corrects. */
function reconnaitreSauvegarde(texte) {
  const t = texte.trim();
  if (!t.startsWith('{') && !t.startsWith('[')) return null;

  try {
    const lu = JSON.parse(t);
    if (lu && typeof lu === 'object' && (Array.isArray(lu.matchs) || Array.isArray(lu.conseils))) {
      return { matchs: (lu.matchs || []).length, conseils: (lu.conseils || []).length };
    }
    return null;
  } catch {
    /* Un copier-coller partiel ne se parse pas, mais ses clés le trahissent
       — et c'est justement le cas où l'utilisateur a le plus besoin qu'on
       lui dise ce qui se passe. */
    return /"echelonAdverse"|"profil"\s*:|"version"\s*:\s*1/.test(t)
      ? { matchs: null, conseils: null }
      : null;
  }
}

export function importFFTForm() {
  openModal({
    title: 'Importer mes matchs depuis Ten\'Up',
    large: true,
    body: `<div class="form">
      <ol class="marche-a-suivre">
        <li>Ouvre <strong>Ten'Up</strong> et connecte-toi.</li>
        <li>Va dans <strong>Mon compte → Mon palmarès</strong> (ou « Mes matchs »).</li>
        <li>Sélectionne la liste des matchs, copie-la.</li>
        <li>Colle-la ci-dessous.</li>
      </ol>
      <p class="tiny muted">Le site de la fédération demande une connexion et n'ouvre
        aucun accès aux applications extérieures : personne ne peut aller chercher ces
        matchs à ta place, ici ou ailleurs. Le copier-coller est le seul chemin honnête.
        Rien ne sera ajouté avant que tu aies relu.</p>
      <label>Coller ici
        <textarea id="colle" rows="8" placeholder="${h(EXEMPLE)}"></textarea>
      </label>
      <div id="apercu"></div>
    </div>`,
    footer: `<button class="btn" data-lire>Analyser</button>
             <button class="btn btn-primary" data-ok disabled>Importer</button>`,
    onMount: () => {
      const racine = document.getElementById('modal-root');
      const zone = racine.querySelector('#colle');
      const apercu = racine.querySelector('#apercu');
      const btnOk = racine.querySelector('[data-ok]');
      let lignes = [];

      const relire = () => {
        /* Une sauvegarde du carnet collée ici par erreur : chaque fiche
           contient une date, l'analyseur y trouve donc des centaines de
           « matchs » et fabrique du plausible-mais-faux — des noms de clubs
           dans la colonne adversaire. Mieux vaut le reconnaître et proposer
           le bon geste que de laisser produire ce charabia. */
        const sauvegarde = reconnaitreSauvegarde(zone.value);
        if (sauvegarde) {
          lignes = [];
          btnOk.disabled = true;
          apercu.innerHTML = `<div class="avis">
            <strong>Ce n'est pas un palmarès Ten'Up : c'est une sauvegarde du carnet.</strong>
            <p class="tiny">${sauvegarde.matchs != null
              ? `Elle contient ${sauvegarde.matchs} match(s) et ${sauvegarde.conseils} conseil(s).`
              : 'Le texte collé semble tronqué, mais il s\'agit bien d\'une sauvegarde.'}
              Ce fichier se charge par le bouton 💾, pas par cet écran-ci —
              mais autant le faire d'ici.</p>
            <label class="case case-seule">
              <input type="checkbox" id="sauv-remplacer" checked>
              <span>Remplacer tout ce qui est déjà enregistré</span>
            </label>
            <p class="tiny muted">À laisser coché pour repartir propre : sinon la sauvegarde
              s'ajoute à ce qui est déjà là, doublons compris.</p>
            <button class="btn btn-primary" data-sauvegarde>Charger cette sauvegarde</button>
          </div>`;
          return;
        }

        const { resultats, ignores } = analyser(zone.value);
        lignes = resultats;
        btnOk.disabled = !lignes.length;

        if (!lignes.length) {
          apercu.innerHTML = `<div class="note-vide">Rien de reconnu pour l'instant.
            Il faut au minimum une date par match, au format 12/05/2025.</div>`;
          return;
        }

        const douteux = lignes.filter(l => l.confiance === 'verifier').length;
        apercu.innerHTML = `
          <div class="resume-import">
            <strong>${lignes.length} match${lignes.length > 1 ? 's' : ''} reconnu${lignes.length > 1 ? 's' : ''}</strong>
            ${douteux ? ` — <span class="alerte">${douteux} à vérifier</span>` : ''}
            ${ignores.length ? ` — ${ignores.length} ligne(s) ignorée(s)` : ''}
          </div>
          <div class="tableau-defile">
          <table class="tableau-import">
            <thead><tr><th></th><th>Date</th><th>Issue</th><th>Adversaire</th>
                       <th>Class.</th><th>Score</th><th>Épreuve</th><th>Né en</th></tr></thead>
            <tbody>
              ${lignes.map((l, i) => `<tr class="${l.confiance === 'verifier' ? 'douteux' : ''}">
                <td><input type="checkbox" data-prendre="${i}" checked></td>
                <td><input type="date" data-champ="date" data-i="${i}" value="${h(l.date)}"></td>
                <td><select data-champ="issue" data-i="${i}">
                      <option value="V" ${l.issue === 'V' ? 'selected' : ''}>V</option>
                      <option value="D" ${l.issue === 'D' ? 'selected' : ''}>D</option>
                    </select></td>
                <td><input data-champ="adversaire" data-i="${i}" value="${h(l.adversaire)}"></td>
                <td><select data-champ="echelonAdverse" data-i="${i}">
                      <option value="">?</option>${opts(ECHELONS, l.echelonAdverse)}
                    </select></td>
                <td><input data-champ="score" data-i="${i}" value="${h(l.score)}" size="10"></td>
                <td><input data-champ="tournoi" data-i="${i}" value="${h(l.tournoi || '')}"></td>
                <td><input data-champ="annee" data-i="${i}" value="${h(l.annee || '')}" size="4"></td>
              </tr>`).join('')}
            </tbody>
          </table></div>
          <p class="tiny muted">Les lignes surlignées sont celles où quelque chose manque :
             corrige-les avant d'importer. La colonne <strong>Épreuve</strong> est le meilleur
             contrôle — si un nom de club s'y trouve aussi bien qu'en adversaire, c'est que la
             lecture a dérapé.</p>`;
      };

      /* Un seul écouteur, posé une fois : le remettre à chaque relecture
         les empilerait, et une frappe serait enregistrée autant de fois
         qu'on a analysé. */
      apercu.addEventListener('input', e => {
        const champ = e.target.dataset.champ;
        if (champ && lignes[+e.target.dataset.i]) {
          lignes[+e.target.dataset.i][champ] = e.target.value;
        }
      });

      apercu.addEventListener('click', e => {
        if (!e.target.closest('[data-sauvegarde]')) return;
        const remplacer = racine.querySelector('#sauv-remplacer')?.checked;
        const r = importerJSON(zone.value, remplacer ? 'remplacement' : 'fusion');
        if (!r.ok) { toast(r.erreur); return; }
        closeModal();
        toast(remplacer
          ? `Sauvegarde chargée : ${r.matchs} match(s), ${r.conseils} conseil(s).`
          : `Ajouté : ${r.matchs} match(s), ${r.conseils} conseil(s).`);
      });

      racine.querySelector('[data-lire]').onclick = relire;
      zone.addEventListener('paste', () => setTimeout(relire, 50));

      btnOk.onclick = () => {
        const prises = [...apercu.querySelectorAll('[data-prendre]')]
          .filter(c => c.checked).map(c => lignes[+c.dataset.prendre])
          .filter(l => l.echelonAdverse);
        if (!prises.length) {
          toast('Aucune ligne complète à importer : il manque les classements.');
          return;
        }
        const r = maj(s => {
          for (const l of prises) {
            s.matchs.push({
              id: uid(), date: l.date, issue: l.issue, adversaire: l.adversaire,
              echelonAdverse: l.echelonAdverse, score: l.score, tournoi: l.tournoi,
              annee: l.annee || '', wo: l.wo, notes: '', surface: '',
            });
          }
          s.matchs.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        });
        conclure(r, `${prises.length} match(s) importé(s).`);
      };
    },
  });
}

// =====================================================================
//  Sauvegarde et transfert
// =====================================================================
/* Le seul pont entre le téléphone et l'ordinateur. Il mérite donc d'être
   expliqué, pas rangé dans un menu comme une option d'export banale. */
export function donneesForm() {
  openModal({
    title: 'Sauvegarde et transfert',
    large: true,
    body: `<div class="form">
      <p class="tiny muted">Ce carnet vit dans ce navigateur-ci, et nulle part ailleurs :
        rien ne part sur internet. C'est ce qui le rend utilisable sur un court sans réseau —
        et ce qui fait que l'ordinateur ignore ce que tu as saisi sur le téléphone.
        Ce fichier est le pont entre les deux.</p>

      <h3>Emporter</h3>
      <p class="tiny muted">${store.matchs.length} match(s), ${store.conseils.length} conseil(s),
         ${store.sources.length} compte(s) suivi(s).</p>
      <div class="rangee-boutons">
        <button class="btn" data-fichier>Enregistrer un fichier</button>
        <button class="btn" data-presse>Copier</button>
      </div>

      <h3>Reprendre</h3>
      <label>Choisir un fichier
        <input type="file" id="import-fichier" accept="application/json,.json">
      </label>
      <p class="tiny muted">Ou coller le contenu à la main, si le fichier vient d'un
        téléphone où il n'est pas facile à retrouver.</p>
      <label>Coller ici l'export d'un autre appareil
        <textarea id="import-json" rows="5" placeholder='{ "version": 1, … }'></textarea>
      </label>
      <label class="case case-seule">
        <input type="checkbox" id="remplacer">
        <span>Remplacer tout au lieu de compléter</span>
      </label>
      <p class="tiny muted">Par défaut on complète : les matchs et conseils absents s'ajoutent,
         rien n'est écrasé. Le remplacement efface d'abord ce qui est ici.</p>
      <button class="btn btn-primary" data-importer>Reprendre ces données</button>

      <h3>Effacer</h3>
      <button class="btn btn-danger" data-vider>Tout effacer sur cet appareil</button>
    </div>`,
    onMount: () => {
      const racine = document.getElementById('modal-root');

      racine.querySelector('[data-fichier]').onclick = async () => {
        const nom = `tennis-${new Date().toISOString().slice(0, 10)}.json`;
        const contenu = exporterJSON();
        // Un lien de téléchargement est bloqué dans certains contextes
        // d'affichage : on prévient plutôt que de laisser un bouton mort.
        try {
          const blob = new Blob([contenu], { type: 'application/json' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = nom;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(a.href), 1000);
          toast('Fichier enregistré.');
        } catch {
          toast('Téléchargement refusé par le navigateur — utilise « Copier ».');
        }
      };

      racine.querySelector('[data-presse]').onclick = async () => {
        try {
          await navigator.clipboard.writeText(exporterJSON());
          toast('Copié. Colle-le sur l\'autre appareil.');
        } catch {
          toast('Copie refusée par le navigateur.');
        }
      };

      /* Un fichier choisi remplit la zone de texte : le reste du chemin
         est alors identique, et l'on peut relire avant de valider. */
      racine.querySelector('#import-fichier').addEventListener('change', async e => {
        const f = e.target.files?.[0];
        if (!f) return;
        try {
          racine.querySelector('#import-json').value = await f.text();
          toast(`${f.name} chargé — reste à valider.`);
        } catch (err) {
          toast(`Fichier illisible : ${err.message}`);
        }
      });

      racine.querySelector('[data-importer]').onclick = () => {
        const texte = racine.querySelector('#import-json').value.trim();
        if (!texte) { toast('Rien à reprendre.'); return; }
        const mode = racine.querySelector('#remplacer').checked ? 'remplacement' : 'fusion';
        const r = importerJSON(texte, mode);
        if (!r.ok) { toast(r.erreur); return; }
        closeModal();
        toast(mode === 'remplacement'
          ? `Données remplacées : ${r.matchs} match(s), ${r.conseils} conseil(s).`
          : `Ajouté : ${r.matchs} match(s), ${r.conseils} conseil(s), ${r.sources} compte(s).`);
      };

      racine.querySelector('[data-vider]').onclick = async () => {
        closeModal();
        if (await confirmer('Tout effacer sur cet appareil ?',
            'Matchs, conseils et comptes suivis disparaîtront. Pense à exporter avant.')) {
          toutEffacer();
          toast('Carnet vidé.');
        }
      };
    },
  });
}

export { sauver };
