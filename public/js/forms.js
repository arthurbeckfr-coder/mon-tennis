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
  ajouterSource,
  exporterJSON, importerJSON, toutEffacer,
  PROFILS, MOMENTS, CATEGORIES, PLATEFORMES, SURFACES,
} from './store.js';
import { analyser, EXEMPLE } from './import-fft.js';

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
        <label>Surface
          <select name="surface"><option value="">—</option>${opts(SURFACES, m.surface)}</select>
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

      racine.querySelector('[data-ok]').onclick = () => {
        if (!form.reportValidity()) return;
        const d = Object.fromEntries(new FormData(form));
        d.profils = valeurs(form, 'profils');
        d.moments = valeurs(form, 'moments');
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
      <label>Mon classement
        <select name="echelon">${opts(ECHELONS, p.echelon)}</select>
      </label>
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
                       <th>Class.</th><th>Score</th></tr></thead>
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
              </tr>`).join('')}
            </tbody>
          </table></div>
          <p class="tiny muted">Les lignes surlignées sont celles où l'issue ou le classement
             n'ont pas été trouvés : corrige-les avant d'importer.</p>`;

        apercu.addEventListener('input', e => {
          const champ = e.target.dataset.champ;
          if (champ) lignes[+e.target.dataset.i][champ] = e.target.value;
        });
      };

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
              wo: l.wo, notes: '', surface: '',
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
