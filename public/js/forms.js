/* Les formulaires de saisie.

   Un principe les gouverne tous : ce qui se saisit après un cours ou entre
   deux matchs doit tenir en quelques gestes. Les champs indispensables
   d'abord, le reste replié. Un conseil qu'on renonce à noter parce que le
   formulaire est long est un conseil perdu. */

import { openModal, closeModal, toast, h, aujourdhui, uid, confirmer, dateLongue } from './util.js';
import { ECHELONS, BAREME_DEFAUT } from './classement.js';
import {
  store, maj, sauver,
  ajouterMatch, modifierMatch, supprimerMatch,
  ajouterConseil, modifierConseil, supprimerConseil,
  ajouterSource, ajouterClub, modifierClub, clubDuMatch, surfaceDuMatch,
  exporterJSON, importerJSON, toutEffacer,
  raquettes, cordages, chaussures, courses, noterJoueur,
  ajouterDepense, modifierDepense, supprimerDepense,
  PROFILS, MOMENTS, CATEGORIES, PLATEFORMES, SURFACES, CATEGORIES_DEPENSE, TOURS,
} from './store.js';
import { ICONES, CATEGORIES_COURSES, CAUSES_CORDAGE } from './materiel.js';
import { analyser, EXEMPLE } from './import-fft.js';
import { URL_TENUP } from './config.js';
import { situer } from './geocodage.js';
import { poserRetour } from './retour.js';
import { avantMatch, feterSiMerite } from './montee.js';
import { blocTerrain, brancherTerrain } from './terrain.js';
import * as nuage from './nuage.js';

/** Ce qu'une synchronisation a rapporté, dit en français. */
function messageSync(r) {
  if (r.premiere) return 'Carnet envoyé en ligne pour la première fois.';
  const g = r.recu;
  if (!g || !g.ok) return 'Carnet synchronisé.';
  const parts = [
    g.matchs ? `${g.matchs} match(s)` : null,
    g.conseils ? `${g.conseils} conseil(s)` : null,
    g.clubs ? `${g.clubs} club(s)` : null,
    g.joueurs ? `${g.joueurs} adversaire(s)` : null,
  ].filter(Boolean);
  return parts.length
    ? `Synchronisé — récupéré ${parts.join(', ')} de l'autre appareil.`
    : 'Synchronisé — rien de neuf de l\'autre côté.';
}

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
/* Les adversaires proposés dans le formulaire.
 *
 * La liste est la réunion de deux sources, et il faut les deux : les
 * joueurs déjà rencontrés — que le répertoire déduit des matchs, import
 * Ten'Up compris — et ceux dont une fiche existe sans qu'on les ait
 * encore joués. Un menu bâti sur les seules fiches ferait disparaître
 * deux cent soixante-treize adversaires importés, et **changerait
 * silencieusement l'adversaire d'un match qu'on rouvre pour corriger son
 * score**. C'est la raison pour laquelle le nom en cours est toujours
 * inclus, même s'il ne vient de nulle part.
 *
 * « Anonyme » est écarté : la fédération l'affiche pour les joueurs qui
 * refusent d'être nommés, et le proposer reviendrait à ranger vingt-quatre
 * personnes différentes sous une même identité. */
function adversairesConnus(courant = '') {
  const noms = new Set();
  for (const x of store.matchs) {
    const n = (x.adversaire || '').trim();
    if (n && !/^(anonyme|inconnu|n\.?c\.?)$/i.test(n)) noms.add(n);
  }
  for (const j of (store.joueurs || [])) {
    const n = (j.nom || '').trim();
    if (n) noms.add(n);
  }
  if (courant && courant.trim()) noms.add(courant.trim());
  return [...noms].sort((a, b) => a.localeCompare(b, 'fr'));
}

/** La clé d'un adversaire, telle que le répertoire la calcule : sans
 *  casse ni accents. La recopier plutôt que d'importer joueurs.js évite un
 *  cycle d'imports entre les formulaires et les vues. */
const cleAdversaire = nom => (nom || '')
  .trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/s+/g, ' ');

/** Les options d'une molette de durée. `vide` place un tiret en tête,
 *  pour que « non renseigné » se distingue de « zéro ». */
function optsDuree(min, max, pas, choisi, vide) {
  const lignes = [];
  for (let v = min; v <= max; v += pas) {
    const sel = !vide && v === choisi ? ' selected' : '';
    lignes.push(`<option value="${v}"${sel}>${v}</option>`);
  }
  return lignes.join('');
}

export function matchForm(existant = null) {
  const m = existant || {
    date: aujourdhui(), issue: 'V', adversaire: '', echelonAdverse: store.profil.echelon,
    score: '', tournoi: '', surface: '', notes: '', wo: false,
    tour: '', gainMontant: null, gainLot: '',
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
        <select name="adversaire" id="choix-adversaire" required>
          <option value="">— choisir —</option>
          ${adversairesConnus(m.adversaire).map(n => `<option value="${h(n)}"
            ${n === m.adversaire ? 'selected' : ''}>${h(n)}</option>`).join('')}
          <option value="__nouveau">＋ Un adversaire que je n'ai jamais joué…</option>
        </select>
      </label>
      <label id="ligne-nouvel-adversaire" hidden>Son nom
        <input name="adversaireNouveau" placeholder="Prénom NOM"
               autocomplete="off" autocapitalize="words">
      </label>
      ${/* « Je l'ai déjà joué, ça avait donné quoi ? » se pose en
            regardant un match, pas seulement en parcourant le répertoire.
            Le bouton n'apparaît que s'il y a un historique à voir. */''}
      ${existant && m.adversaire ? `<div class="rangee-lieu">
        <button type="button" class="btn btn-ghost" data-historique>
          Notre historique</button>
        <span class="tiny muted">tous vos matchs, puis retour ici</span>
      </div>` : ''}
      <div class="duo">
        <label>Son classement
          <select name="echelonAdverse">${opts(ECHELONS, m.echelonAdverse)}</select>
        </label>
        <label>Score
          <input name="score" value="${h(m.score)}" placeholder="6/4 6/3"
                 inputmode="numeric" autocomplete="off">
        </label>
      </div>
      ${/* La durée ne vient d'aucune donnée fédérale : elle se note après
            coup, quand on y pense. Le champ reste donc facultatif et sans
            valeur par défaut — une durée inventée fausserait la moyenne
            plus sûrement qu'une case vide.

            Deux molettes plutôt qu'un nombre de minutes : personne ne
            pense « quatre-vingt-quinze minutes », on pense « une heure et
            demie ». Convertir de tête est un effort qu'on s'épargne, et
            l'on s'épargne surtout de taper — sur un téléphone, faire
            défiler deux listes courtes va plus vite qu'ouvrir un clavier
            numérique.

            Les minutes vont de cinq en cinq : personne ne sait si son
            match a duré 83 ou 85 minutes, et prétendre le contraire
            donnerait une précision que la mesure n'a pas. */''}
      <fieldset class="duree-bloc">
        <legend>Durée du match (facultatif)</legend>
        <div class="duree-molettes">
          <label>Heures
            <select name="dureeH">${optsDuree(0, 5, 1, Math.floor((m.duree ?? 0) / 60), m.duree == null)}</select>
          </label>
          <label>Minutes
            <select name="dureeM">${optsDuree(0, 55, 5, m.duree == null ? 0 : (m.duree % 60), m.duree == null)}</select>
          </label>
        </div>
        <p class="tiny muted">Laissé à zéro, rien n'est enregistré : le carnet préfère une
          case vide à une durée inventée, qui fausserait les moyennes.</p>
      </fieldset>
      <details ${m.tournoi || m.surface || m.notes ? 'open' : ''}>
        <summary>Contexte et ressenti</summary>
        <label>Épreuve
          <input name="tournoi" value="${h(m.tournoi)}" placeholder="Tournoi, championnat par équipes…">
        </label>
        ${/* Le tour ne se devine d'aucune donnée : ni Ten'Up ni le score
              ne disent où l'on en était dans le tableau. Il se coche, et
              il sert deux fois — au récit (« sorti un 15/1 en quart ») et
              au classement, où le tour atteint en championnat individuel
              donne les victoires bonus. « Vainqueur » n'est pas dans la
              liste : c'est une finale gagnée, et l'issue le dit déjà. */''}
        <label>Tour
          <select name="tour">
            <option value="">— non précisé —</option>
            ${TOURS.map(t => `<option value="${t.cle}"
              ${m.tour === t.cle ? 'selected' : ''}>${h(t.nom)}</option>`).join('')}
          </select>
        </label>
        ${m.tour === 'finale' || !m.tour ? `<p class="tiny muted">Une finale gagnée te
          compte vainqueur du tableau ; perdue, finaliste. Rien à cocher de plus.</p>` : ''}

        ${/* Ce qu'on a gagné : de l'argent, ou autre chose. Les deux
              existent — un tournoi de village récompense en bons d'achat,
              en cordage, en jambon. Une case pour le chiffre, qui
              s'additionne, et une pour le reste, qui se raconte. */''}
        <div class="duo">
          <label>Gain en euros
            <input type="number" name="gainMontant" min="0" step="1" inputmode="decimal"
                   value="${m.gainMontant ?? ''}" placeholder="facultatif">
          </label>
          <label>Ou quoi d'autre
            <input name="gainLot" value="${h(m.gainLot || '')}"
                   placeholder="bon d'achat, cordage…">
          </label>
        </div>
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

      /* Un adversaire qu'on n'a jamais joué ne peut pas figurer dans une
         liste déduite des matchs. Plutôt que de renvoyer saisir sa fiche
         ailleurs et revenir — ce qui se fait mal quand on note un match
         debout au bord du court —, le champ apparaît sur place. Le joueur
         entre bien au répertoire : c'est le même enregistrement. */
      /* On note d'où l'on part avant de partir : la fiche de
         l'adversaire se refermera sur ce match, et non sur le répertoire.
         Rouvrir le formulaire au retour suppose de retrouver le match dans
         le carnet — il a pu être modifié entre-temps, et c'est la version
         enregistrée qu'on veut revoir, pas celle d'il y a trois écrans. */
      racine.querySelector('[data-historique]')?.addEventListener('click', () => {
        const cible = `#/joueurs/${encodeURIComponent(cleAdversaire(m.adversaire))}`;
        /* On retient aussi l'écran d'où l'on partait. Rouvrir la fenêtre du
           match par-dessus la fiche de l'adversaire la refermerait sur
           cette fiche, et non là où l'on était : le détour ne serait pas
           refermé, seulement déplacé. */
        const origine = location.hash || '#/';
        poserRetour(cible, () => {
          const frais = store.matchs.find(x => x.id === existant.id);
          location.hash = origine;
          if (frais) matchForm(frais);
        });
        closeModal();
        location.hash = cible;
      });

      /* Le score s'écrit en chiffres seuls : « 6462 » devient 6/4 6/2.

         Personne ne tape volontiers une barre oblique sur un clavier de
         téléphone — il faut changer de page de touches deux fois par
         set. Les chiffres suffisent à dire le score, et la ponctuation
         se déduit : un jeu, puis l'autre, puis le set suivant.

         Reste le tie-break décisif, qui monte à dix ou plus et qu'aucun
         découpage automatique ne peut deviner : « 108 », est-ce 10/8 ou
         1/0 8 ? Alors dès qu'on tape soi-même un séparateur, le champ
         se tait et laisse écrire — et il se ravise si l'on efface tout.
         La règle est celle du carnet entier : deviner tant que c'est
         sûr, se taire dès que ça ne l'est plus. */
      const score = racine.querySelector('[name="score"]');
      if (score) {
        /* Un score déjà écrit ne se réécrit pas sous les doigts : on le
           laisse tel quel, et vider le champ rend la main au découpage. */
        if (/[^0-9\s]/.test(score.value)) score.dataset.libre = '1';

        const auBout = () => {
          const n = score.value.length;
          score.setSelectionRange(n, n);
        };

        score.addEventListener('input', e => {
          if (score.value === '') { delete score.dataset.libre; return; }
          const tape = e.data || '';

          /* Le séparateur tapé à la main veut dire « ce nombre-là n'est
             pas fini » : dix-huit, pas un puis huit. On recolle donc le
             set en cours — « 1/0 » redevient « 10 » — avant de passer la
             main. Sans ce recollage, « 10/8 » sortait « 1/0/8 » : le
             découpage avait déjà tranché avant qu'on puisse le démentir. */
          if (!score.dataset.libre && /^[\/\-. ,]$/.test(tape)) {
            const groupes = score.value.slice(0, -1).trim().split(' ');
            groupes[groupes.length - 1] = groupes[groupes.length - 1].replace('/', '');
            score.value = groupes.join(' ') + (tape === ',' ? '/' : tape);
            score.dataset.libre = '1';
            auBout();
            return;
          }

          if (/[^0-9]/.test(tape)) score.dataset.libre = '1';
          if (score.dataset.libre) return;

          const jeux = score.value.replace(/\D/g, '').split('');
          const sets = [];
          for (let i = 0; i < jeux.length; i += 2) {
            sets.push(jeux.slice(i, i + 2).join('/'));
          }
          score.value = sets.join(' ');
          /* Le curseur au bout : on n'écrit un score que de gauche à
             droite, et le remettre où il était le placerait avant une
             barre qu'on vient d'insérer. */
          auBout();
        });
      }

      const choix = racine.querySelector('#choix-adversaire');
      const ligneNeuf = racine.querySelector('#ligne-nouvel-adversaire');
      const champNeuf = ligneNeuf.querySelector('input');

      const basculer = () => {
        const neuf = choix.value === '__nouveau';
        ligneNeuf.hidden = !neuf;
        champNeuf.required = neuf;
        if (neuf) champNeuf.focus();
      };
      choix.addEventListener('change', basculer);
      basculer();

      racine.querySelector('[data-ok]').onclick = () => {
        if (!form.reportValidity()) return;
        const d = Object.fromEntries(new FormData(form));
        d.wo = form.wo.checked;

        /* Deux molettes à zéro veulent dire « je n'ai pas noté », et non
           « le match a duré zéro minute ». La nuance compte : une durée
           nulle enregistrée entrerait dans les moyennes et les tirerait
           vers le bas sans qu'on comprenne pourquoi. */
        const minutes = (Number(d.dureeH) || 0) * 60 + (Number(d.dureeM) || 0);
        d.duree = minutes > 0 ? minutes : null;
        delete d.dureeH; delete d.dureeM;

        /* Un gain vide n'est pas un gain de zéro : la case reste nulle,
           sans quoi tous les matchs entreraient dans le total à zéro euro
           et l'on ne saurait plus lesquels ont vraiment rapporté. */
        d.gainMontant = d.gainMontant === '' ? null : Number(d.gainMontant);

        if (d.adversaire === '__nouveau') {
          const nom = (d.adversaireNouveau || '').trim();
          if (!nom) { champNeuf.focus(); return; }
          d.adversaire = nom;
        }
        delete d.adversaireNouveau;

        /* Où en était la montée avant ce match : c'est la comparaison
           qui dit si la nouvelle vaut d'être annoncée. */
        const avant = avantMatch();
        const ok = conclure(
          existant ? modifierMatch(existant.id, d) : ajouterMatch(d),
          existant ? 'Match modifié.' : 'Match ajouté.');
        /* Une fenêtre qui s'ouvre pendant que l'autre se referme se
           marche dessus : on laisse le temps du battement. */
        if (ok) setTimeout(() => feterSiMerite(avant), 250);
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
/* Un lieu de départ : son adresse, et le point qu'on en a tiré. Les deux
   vont ensemble — l'adresse pour la relire, le point pour calculer — et le
   second ne s'obtient qu'en le demandant, ce que dit le bouton. */
function champLieu(cle, libelle, lieu, exemple) {
  const situe = lieu?.point;
  return `<label>${h(libelle)}
    <input name="${cle}" value="${h(lieu?.adresse || '')}" placeholder="${h(exemple)}"
           autocomplete="off">
  </label>
  <div class="rangee-lieu">
    <button type="button" class="btn btn-ghost" data-situer="${cle}">Situer</button>
    <span class="tiny muted" data-etat="${cle}">${situe
      ? `📍 ${h(lieu.libelle || lieu.adresse)}`
      : 'pas encore situé'}</span>
  </div>`;
}

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
      <p class="tiny muted">Le classement de départ, et c'est tout : le bilan, les
        victoires comptabilisées et les points se calculent depuis tes matchs, comme le
        fait la fédération. Rien à recopier de Ten'Up — importe ton palmarès et le compte
        se tient tout seul.</p>

      <fieldset>
        <legend>D'où je pars</legend>
        <p class="tiny muted">Pour situer les clubs par rapport à chez toi et savoir
          lesquels sont à côté. Ces adresses ne quittent ton carnet qu'au moment où elles
          sont situées — au bouton, ou à l'enregistrement si tu ne l'as pas touché — et
          rien n'est deviné : une adresse non reconnue reste sans point plutôt que d'être
          placée au hasard.</p>
        ${/* Des exemples inventés, et c'est délibéré : ce dépôt est public,
              et le repère de saisie d'un formulaire n'est pas l'endroit où
              écrire l'adresse de quelqu'un. */''}
        ${champLieu('domicile', 'Mon domicile', p.domicile, '12 rue des Écoles, 76000 Rouen')}
        ${champLieu('bureau', 'Mon travail', p.bureau, '3 place du Marché, 76200 Dieppe')}
        <p class="tiny muted">Mets la commune et le code postal : sans eux, le service des
          adresses cherche dans toute la France et se trompe de rue.</p>

        <label>Coût du kilomètre (facultatif)
          <input type="number" name="coutKm" min="0" step="0.01" inputmode="decimal"
                 value="${p.coutKm ?? ''}" placeholder="par exemple 0,30">
        </label>
        <p class="tiny muted">Sert à estimer ce que la route coûte, dans l'onglet Argent du
          sac. Laissé vide, le carnet compte les kilomètres et s'arrête là plutôt que
          d'inventer un prix.</p>
      </fieldset>
    </form>`,
    footer: `<button class="btn btn-primary" data-ok>Enregistrer</button>`,
    onMount: () => {
      const racine = document.getElementById('modal-root');

      /* Ce qu'on a situé pendant la saisie, en attendant l'enregistrement.
         On ne touche au carnet qu'au bouton « Enregistrer » : chercher une
         adresse ne doit pas décider à la place du lecteur. */
      const situes = { domicile: p.domicile || null, bureau: p.bureau || null };

      racine.querySelectorAll('[data-situer]').forEach(b => {
        b.addEventListener('click', async () => {
          const cle = b.dataset.situer;
          const champ = racine.querySelector(`[name="${cle}"]`);
          const etat = racine.querySelector(`[data-etat="${cle}"]`);
          const adresse = champ.value.trim();

          if (!adresse) { situes[cle] = null; etat.textContent = 'pas encore situé'; return; }

          b.disabled = true;
          etat.textContent = 'recherche…';
          const r = await situer(adresse);
          b.disabled = false;

          if (!r.ok) { situes[cle] = null; etat.textContent = `⚠️ ${r.erreur}`; return; }
          situes[cle] = { adresse, point: r.point, libelle: r.libelle };
          etat.textContent = `📍 ${r.libelle}`;
        });
      });

      racine.querySelector('[data-ok]').onclick = async () => {
        const form = document.getElementById('f-profil');
        const d = Object.fromEntries(new FormData(form));

        /* Une adresse retouchée sans être resituée garderait l'ancien
           point, donc un domicile faux à l'autre bout du département. On
           préfère perdre le point et le redemander.

           Et on le redemande tout de suite, sans attendre un second geste :
           le bouton « Situer » se manque, on enregistre, et l'adresse reste
           dans le carnet sans jamais paraître sur une carte — ce qui donne
           l'impression que la fonction ne marche pas. Enregistrer une
           adresse, c'est demander qu'elle serve. */
        const lieu = async cle => {
          const a = (d[cle] || '').trim();
          if (!a) return null;
          const s = situes[cle];
          if (s && s.adresse === a) return s;
          const r = await situer(a);
          /* Une adresse introuvable est gardée telle quelle, sans point :
             on la relira, on la corrigera, et rien n'est placé au hasard
             en attendant. */
          return r.ok ? { adresse: a, point: r.point, libelle: r.libelle }
                      : { adresse: a, point: null, libelle: '' };
        };

        /* Les deux recherches d'abord, l'écriture ensuite : `maj` est
           synchrone, et une promesse glissée dedans y déposerait un objet
           en attente au lieu d'un lieu. */
        const [dom, bur] = [await lieu('domicile'), await lieu('bureau')];

        conclure(maj(s => {
          s.profil = {
            ...s.profil,
            prenom: d.prenom,
            sexe: d.sexe,
            echelon: d.echelon,
            gaucher: d.gaucher === '1',
            domicile: dom,
            bureau: bur,
            coutKm: d.coutKm === '' ? null : Number(d.coutKm),
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
        <li><a class="btn btn-ghost btn-tenup" href="${URL_TENUP}" target="_blank"
               rel="noopener noreferrer">Ouvrir Ten'Up ↗</a>
          et connecte-toi.</li>
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
//  Ce qu'on retient d'un adversaire
// =====================================================================
/* Les mêmes profils que le carnet de conseils, et ce n'est pas un hasard :
   noter « chipeur » ici et chercher « chipeur » là-bas, c'est le même
   geste. Le vocabulaire commun est ce qui relie les deux écrans. */
export function joueurForm(joueur) {
  const f = joueur.fiche || { profils: [], note: '', club: '' };

  /* Le club d'un adversaire ne figure nulle part dans un palmarès Ten'Up :
     la fédération donne un nom et un classement, pas une licence. Il faut
     donc le saisir, et le champ propose ce qui a déjà été tapé — un même
     club revient vite, et deux orthographes en feraient deux clubs. */
  const clubsConnus = [...new Set([
    ...(store.joueurs || []).map(j => j.club).filter(Boolean),
    ...store.clubs.map(c => c.nom),
  ])].sort((a, b) => a.localeCompare(b, 'fr'));

  openModal({
    title: h(joueur.nom),
    large: true,
    body: `<form id="f-joueur" class="form">
      <label>Son club
        <input name="club" list="clubs-adverses" value="${h(f.club || '')}"
               placeholder="Le club dont il porte les couleurs">
      </label>
      <datalist id="clubs-adverses">
        ${clubsConnus.map(c => `<option value="${h(c)}"></option>`).join('')}
      </datalist>
      <p class="tiny muted">Ten'Up ne le donne pas : c'est à toi de l'ajouter. Une fois
        renseigné, la page des adversaires sait dire combien de joueurs d'un même club
        tu as battus.</p>
      <fieldset>
        <legend>Sa façon de jouer</legend>
        <p class="tiny muted">Ces cases ramèneront les conseils de tes profs sur ce type
          de joueur, la veille du match.</p>
        <div class="grille-cases">${cases(PROFILS, f.profils || [], 'profils')}</div>
      </fieldset>
      <label>Ce que j'en retiens
        <textarea name="note" rows="5"
          placeholder="Son service, son point faible, ce qui a marché la dernière fois…">${h(f.note || '')}</textarea>
      </label>
    </form>`,
    footer: `<button class="btn btn-primary" data-ok>Enregistrer</button>`,
    onMount: () => {
      document.getElementById('modal-root').querySelector('[data-ok]').onclick = () => {
        const form = document.getElementById('f-joueur');
        const d = Object.fromEntries(new FormData(form));
        conclure(noterJoueur(joueur.nom, {
          note: d.note,
          club: (d.club || '').trim(),
          profils: valeurs(form, 'profils'),
        }), 'Noté.');
      };
    },
  });
}

// =====================================================================
//  Qui je suis
// =====================================================================
/* Ces champs ne servent à aucun calcul, et c'est assumé : ils servent à
   retrouver son numéro de licence debout au club, au moment de s'inscrire
   à un tournoi, sans fouiller ses mails. Le carnet est déjà l'endroit où
   l'on range son tennis ; qu'il range aussi cela. */
export function identiteForm() {
  const p = store.profil;
  openModal({
    title: 'Mes informations',
    body: `<form id="f-identite" class="form">
      <div class="duo">
        <label>Prénom<input name="prenom" value="${h(p.prenom || '')}" autocomplete="given-name"></label>
        <label>Nom<input name="nom" value="${h(p.nom || '')}" autocomplete="family-name"></label>
      </div>
      <label>Numéro de licence
        <input name="licence" value="${h(p.licence || '')}" inputmode="numeric"
               placeholder="celui qu'on demande à chaque inscription">
      </label>
      <label>Mon club
        <input name="clubPrincipal" list="mes-clubs" value="${h(p.clubPrincipal || '')}"
               placeholder="celui où je suis licencié">
      </label>
      <datalist id="mes-clubs">
        ${store.clubs.map(c => `<option value="${h(c.nom)}"></option>`).join('')}
      </datalist>
      <div class="duo">
        <label>Téléphone
          <input type="tel" name="telephone" value="${h(p.telephone || '')}" autocomplete="tel">
        </label>
        <label>Date de naissance
          <input type="date" name="naissance" value="${h(p.naissance || '')}">
        </label>
      </div>
      <label>Adresse e-mail
        <input type="email" name="mail" value="${h(p.mail || '')}" autocomplete="email">
      </label>
      <p class="tiny muted">Rien de tout cela ne sort du carnet : ces informations restent
        sur ton appareil, et ne partent en ligne que dans ta propre sauvegarde, si tu es
        connecté. Aucun calcul ne s'en sert.</p>
    </form>`,
    footer: `<button class="btn btn-primary" data-ok>Enregistrer</button>`,
    onMount: () => {
      document.getElementById('modal-root').querySelector('[data-ok]').onclick = () => {
        const d = Object.fromEntries(new FormData(document.getElementById('f-identite')));
        conclure(maj(s => { s.profil = { ...s.profil, ...d }; }), 'Informations enregistrées.');
      };
    },
  });
}

// =====================================================================
//  Une dépense
// =====================================================================
/* Une seule règle ici : rien n'est prérempli qu'on ne sache. La date
   d'aujourd'hui, oui — c'est en rentrant du tournoi qu'on note. Le
   montant, jamais. */
export function depenseForm(existant = null) {
  const d = existant || {
    date: aujourdhui(), libelle: '', montant: '', categorie: 'inscription', note: '',
  };

  /* Les épreuves déjà jouées se proposent : une inscription se rattache
     presque toujours à un tournoi qu'on a dans son historique, et le
     retaper à la main invite à l'écrire deux fois différemment. */
  const epreuves = [...new Set(store.matchs.map(m => (m.tournoi || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'fr'));

  openModal({
    title: existant ? 'Modifier la dépense' : 'Une dépense',
    body: `<form id="f-depense" class="form">
      <div class="duo">
        <label>Date<input type="date" name="date" value="${h(d.date)}" required></label>
        <label>Montant (€)
          <input type="number" name="montant" min="0" step="0.01" inputmode="decimal"
                 value="${h(d.montant ?? '')}" placeholder="18" required>
        </label>
      </div>
      <label>Catégorie
        <select name="categorie">
          ${CATEGORIES_DEPENSE.map(c => `<option value="${c.cle}"
            ${d.categorie === c.cle ? 'selected' : ''}>${c.emoji} ${h(c.nom)}</option>`).join('')}
        </select>
      </label>
      <label>À quoi ça correspond
        <input name="libelle" list="epreuves-connues" value="${h(d.libelle)}"
               placeholder="Le nom du tournoi, du cordage…" required>
      </label>
      <datalist id="epreuves-connues">
        ${epreuves.map(e => `<option value="${h(e)}"></option>`).join('')}
      </datalist>
      <label>Note (facultatif)
        <textarea name="note" rows="2"
          placeholder="Payé sur place, remboursé par le club…">${h(d.note || '')}</textarea>
      </label>
    </form>`,
    footer: `${existant ? '<button class="btn btn-danger" data-suppr>Supprimer</button>' : ''}
             <button class="btn btn-primary" data-ok>${existant ? 'Enregistrer' : 'Ajouter'}</button>`,
    onMount: () => {
      const racine = document.getElementById('modal-root');
      const form = racine.querySelector('#f-depense');

      racine.querySelector('[data-ok]').onclick = () => {
        if (!form.reportValidity()) return;
        const v = Object.fromEntries(new FormData(form));
        v.montant = Number(v.montant) || 0;
        conclure(existant ? modifierDepense(existant.id, v) : ajouterDepense(v),
                 existant ? 'Dépense modifiée.' : 'Dépense ajoutée.');
      };

      racine.querySelector('[data-suppr]')?.addEventListener('click', async () => {
        closeModal();
        if (await confirmer('Supprimer cette dépense ?', `${d.libelle} — ${d.montant} €`)) {
          supprimerDepense(existant.id);
          toast('Dépense supprimée.');
        }
      });
    },
  });
}

// =====================================================================
//  Matériel et intendance
// =====================================================================
/** Le sélecteur d'icône, partagé par les articles de courses. Une palette
 *  fermée plutôt qu'un champ libre : on choisit plus vite qu'on ne tape,
 *  et la liste reste lisible d'un coup d'œil. */
function palette(choisie) {
  return `<div class="palette">
    ${ICONES.map(i => `<button type="button" class="icone ${i === choisie ? 'actif' : ''}"
        data-icone="${i}" aria-label="${i}">${i}</button>`).join('')}
  </div>`;
}

export function courseForm(existant = null) {
  const a = existant || { nom: '', icone: '🎾', categorie: 'materiel', recurrent: false, note: '' };
  let icone = a.icone;

  openModal({
    title: existant ? 'Modifier l\'article' : 'À acheter',
    body: `<form id="f-course" class="form">
      <label>Quoi<input name="nom" value="${h(a.nom)}" required placeholder="Tube de balles"></label>
      <label>Rayon
        <select name="categorie">
          ${CATEGORIES_COURSES.map(c => `<option value="${c.cle}" ${c.cle === a.categorie ? 'selected' : ''}>
            ${c.emoji} ${h(c.nom)}</option>`).join('')}
        </select>
      </label>
      <span class="etiquette">Icône</span>
      <div id="palette">${palette(icone)}</div>
      <label class="case case-seule">
        <input type="checkbox" name="recurrent" ${a.recurrent ? 'checked' : ''}>
        <span>Article récurrent — à racheter régulièrement</span>
      </label>
      <p class="tiny muted">Un article récurrent ne disparaît pas quand on range la liste :
        il se décoche, prêt pour la prochaine fois. Les balles, les surgrips.</p>
      <label>Note<input name="note" value="${h(a.note || '')}" placeholder="Marque, taille, référence…"></label>
    </form>`,
    footer: `${existant ? '<button class="btn btn-danger" data-suppr>Supprimer</button>' : ''}
             <button class="btn btn-primary" data-ok>${existant ? 'Enregistrer' : 'Ajouter'}</button>`,
    onMount: () => {
      const racine = document.getElementById('modal-root');
      racine.querySelector('#palette').addEventListener('click', e => {
        const b = e.target.closest('[data-icone]');
        if (!b) return;
        icone = b.dataset.icone;
        racine.querySelector('#palette').innerHTML = palette(icone);
      });

      racine.querySelector('[data-ok]').onclick = () => {
        const form = racine.querySelector('#f-course');
        if (!form.reportValidity()) return;
        const d = Object.fromEntries(new FormData(form));
        d.recurrent = form.recurrent.checked;
        d.icone = icone;
        if (!existant) { d.achete = false; d.dateAchat = ''; }
        conclure(existant ? courses.modifier(existant.id, d) : courses.ajouter(d),
                 existant ? 'Article modifié.' : 'Ajouté à la liste.');
      };
      racine.querySelector('[data-suppr]')?.addEventListener('click', () => {
        courses.supprimer(existant.id);
        closeModal();
        toast('Article retiré.');
      });
    },
  });
}

export function raquetteForm(existant = null) {
  const r = existant || {
    marque: '', modele: '', annee: '', tamis: '', poids: '',
    cordageHabituel: '', tensionHabituelle: '', dateAchat: '', active: true, note: '',
  };

  openModal({
    title: existant ? 'Modifier la raquette' : 'Nouvelle raquette',
    body: `<form id="f-raquette" class="form">
      <div class="duo">
        <label>Marque<input name="marque" value="${h(r.marque)}" required placeholder="Babolat"></label>
        <label>Modèle<input name="modele" value="${h(r.modele)}" placeholder="Pure Drive"></label>
      </div>
      <div class="duo">
        <label>Année<input name="annee" value="${h(r.annee)}" placeholder="2024"></label>
        <label>Tamis<input name="tamis" value="${h(r.tamis)}" placeholder="100 in²"></label>
      </div>
      <div class="duo">
        <label>Cordage habituel<input name="cordageHabituel" value="${h(r.cordageHabituel)}"
               placeholder="RPM Blast 1.25"></label>
        <label>Tension<input name="tensionHabituelle" value="${h(r.tensionHabituelle)}"
               placeholder="24 kg"></label>
      </div>
      <div class="duo">
        <label>Achetée le<input type="date" name="dateAchat" value="${h(r.dateAchat)}"></label>
        <label>Poids<input name="poids" value="${h(r.poids)}" placeholder="300 g"></label>
      </div>
      <label class="case case-seule">
        <input type="checkbox" name="active" ${r.active ? 'checked' : ''}>
        <span>Raquette en service</span>
      </label>
      <label>Note<textarea name="note" rows="2">${h(r.note || '')}</textarea></label>
    </form>`,
    footer: `${existant ? '<button class="btn btn-danger" data-suppr>Supprimer</button>' : ''}
             <button class="btn btn-primary" data-ok>${existant ? 'Enregistrer' : 'Ajouter'}</button>`,
    onMount: () => {
      const racine = document.getElementById('modal-root');
      racine.querySelector('[data-ok]').onclick = () => {
        const form = racine.querySelector('#f-raquette');
        if (!form.reportValidity()) return;
        const d = Object.fromEntries(new FormData(form));
        d.active = form.active.checked;
        conclure(existant ? raquettes.modifier(existant.id, d) : raquettes.ajouter(d),
                 existant ? 'Raquette modifiée.' : 'Raquette ajoutée.');
      };
      racine.querySelector('[data-suppr]')?.addEventListener('click', async () => {
        closeModal();
        if (await confirmer('Supprimer cette raquette ?',
            'Les cordages qui lui sont rattachés resteront dans l\'historique.')) {
          raquettes.supprimer(existant.id);
          toast('Raquette supprimée.');
        }
      });
    },
  });
}

/* Poser un cordage se note en trois secondes ou ne se note pas. D'où les
   valeurs pré-remplies depuis la raquette : dans la plupart des cas il n'y
   a qu'à valider. */
export function cordageForm(existant = null, raquetteId = null) {
  const rq = store.raquettes.find(x => x.id === (existant?.raquetteId || raquetteId))
          || store.raquettes.find(x => x.active) || store.raquettes[0];

  const c = existant || {
    date: aujourdhui(), raquetteId: rq?.id || '', cause: 'casse',
    marque: rq?.cordageHabituel || '', tension: rq?.tensionHabituelle || '', note: '',
  };

  openModal({
    title: existant ? 'Modifier le cordage' : 'Cordage cassé ou changé',
    body: `<form id="f-cordage" class="form">
      <div class="duo">
        <label>Date<input type="date" name="date" value="${h(c.date)}" required></label>
        <label>Raquette
          <select name="raquetteId">
            <option value="">—</option>
            ${store.raquettes.map(x => `<option value="${h(x.id)}" ${x.id === c.raquetteId ? 'selected' : ''}>
              ${h(x.marque)} ${h(x.modele)}</option>`).join('')}
          </select>
        </label>
      </div>
      <label>Pourquoi
        <select name="cause">
          ${CAUSES_CORDAGE.map(x => `<option value="${x.cle}" ${x.cle === c.cause ? 'selected' : ''}>
            ${h(x.nom)}</option>`).join('')}
        </select>
      </label>
      <div class="duo">
        <label>Cordage posé<input name="marque" value="${h(c.marque)}" placeholder="RPM Blast 1.25"></label>
        <label>Tension<input name="tension" value="${h(c.tension)}" placeholder="24 kg"></label>
      </div>
      <label>Note<input name="note" value="${h(c.note || '')}" placeholder="Cassé au service, 2e set…"></label>
      ${!store.raquettes.length ? `<p class="tiny muted">Aucune raquette enregistrée :
        ajoute-la d'abord pour suivre la durée de vie des cordages.</p>` : ''}
    </form>`,
    footer: `${existant ? '<button class="btn btn-danger" data-suppr>Supprimer</button>' : ''}
             <button class="btn btn-primary" data-ok>${existant ? 'Enregistrer' : 'Noter'}</button>`,
    onMount: () => {
      const racine = document.getElementById('modal-root');
      racine.querySelector('[data-ok]').onclick = () => {
        const form = racine.querySelector('#f-cordage');
        if (!form.reportValidity()) return;
        const d = Object.fromEntries(new FormData(form));
        conclure(existant ? cordages.modifier(existant.id, d) : cordages.ajouter(d),
                 existant ? 'Cordage modifié.' : 'Cordage noté.');
      };
      racine.querySelector('[data-suppr]')?.addEventListener('click', () => {
        cordages.supprimer(existant.id);
        closeModal();
        toast('Cordage supprimé.');
      });
    },
  });
}

export function chaussureForm(existant = null) {
  const c = existant || {
    marque: '', modele: '', surface: '', dateAchat: aujourdhui(), dateFin: '', note: '',
  };

  openModal({
    title: existant ? 'Modifier les chaussures' : 'Nouvelles chaussures',
    body: `<form id="f-chaussure" class="form">
      <div class="duo">
        <label>Marque<input name="marque" value="${h(c.marque)}" required placeholder="Asics"></label>
        <label>Modèle<input name="modele" value="${h(c.modele)}" placeholder="Gel Resolution"></label>
      </div>
      <label>Pour quelle surface
        <select name="surface"><option value="">Toutes</option>${opts(SURFACES, c.surface)}</select>
      </label>
      <div class="duo">
        <label>Achetées le<input type="date" name="dateAchat" value="${h(c.dateAchat)}"></label>
        <label>Mises au rebut<input type="date" name="dateFin" value="${h(c.dateFin)}"></label>
      </div>
      <label>Note<input name="note" value="${h(c.note || '')}" placeholder="Pointure, ressenti…"></label>
    </form>`,
    footer: `${existant ? '<button class="btn btn-danger" data-suppr>Supprimer</button>' : ''}
             <button class="btn btn-primary" data-ok>${existant ? 'Enregistrer' : 'Ajouter'}</button>`,
    onMount: () => {
      const racine = document.getElementById('modal-root');
      racine.querySelector('[data-ok]').onclick = () => {
        const form = racine.querySelector('#f-chaussure');
        if (!form.reportValidity()) return;
        const d = Object.fromEntries(new FormData(form));
        conclure(existant ? chaussures.modifier(existant.id, d) : chaussures.ajouter(d),
                 existant ? 'Chaussures modifiées.' : 'Chaussures ajoutées.');
      };
      racine.querySelector('[data-suppr]')?.addEventListener('click', () => {
        chaussures.supprimer(existant.id);
        closeModal();
        toast('Chaussures supprimées.');
      });
    },
  });
}

// =====================================================================
//  Sauvegarde et transfert
// =====================================================================
/* Le seul pont entre le téléphone et l'ordinateur. Il mérite donc d'être
   expliqué, pas rangé dans un menu comme une option d'export banale. */
/* ─── Sauvegarde et transfert, dans la page du profil ──────────────────
 *
 * C'était une fenêtre ouverte depuis une disquette, dans la barre du
 * haut. Deux défauts : l'icône ne disait rien à qui ne l'a pas connue,
 * et une fenêtre est un lieu qu'on ne visite pas — or ce qu'elle contient
 * est ce qu'on cherche justement quand on change de téléphone, c'est-à-
 * dire une fois, sans savoir où regarder.
 *
 * Le contenu s'écrit donc dans la page du profil, à la suite de ce qui
 * parle déjà de soi. Il reste une seule écriture pour les deux morceaux —
 * le balisage et son branchement — parce que les séparer les ferait
 * diverger.
 */
export function blocDonnees() {
  return `<div class="form">
      ${/* Le compte est en tête de la page, sous « Mon compte » : le
            redire ici mettrait deux fois le même identifiant dans le
            document, et le branchement ne saurait plus lequel remplir. */''}
      <p class="tiny muted">Le carnet vit d'abord dans ce navigateur : c'est ce qui le rend
        utilisable sur un court sans réseau. La synchronisation ne fait que transporter
        l'état d'un appareil à l'autre — et elle complète sans jamais écraser, donc deux
        appareils qui ont chacun ajouté des choses se retrouvent avec la somme des deux.</p>

      <h3>Emporter un fichier</h3>
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
    </div>`;
}

/** Branche le bloc ci-dessus, où qu'il soit posé. */
export function brancherDonnees(racine) {

      /* Le bloc de synchronisation se redessine à chaque changement d'état :
         connecté ou non, en cours ou non. */
      const bloc = racine.querySelector('#bloc-sync');
      const dessinerSync = () => {
        if (nuage.enTrain()) {
          bloc.innerHTML = `<p class="tiny muted">Synchronisation en cours…</p>`;
          return;
        }
        if (!nuage.connecte()) {
          bloc.innerHTML = `
            <p class="tiny muted">Connecte-toi pour retrouver ton carnet sur tous tes
              appareils. Tant que tu ne le fais pas, tout fonctionne comme avant, en local.</p>
            <div class="duo">
              <label>Email<input id="sync-mail" type="email" autocomplete="username"></label>
              <label>Mot de passe<input id="sync-mdp" type="password"
                     autocomplete="current-password"></label>
            </div>
            <button class="btn btn-primary" data-connexion>Se connecter</button>
            <p id="sync-erreur" class="tiny alerte" hidden></p>`;
          return;
        }
        const quand = nuage.derniereSync();
        /* Plus de bouton « Synchroniser maintenant ». Il ne servait qu'à
           faire soi-même ce qui se fait tout seul — à chaque
           modification, au retour sur l'écran, au retour du réseau,
           toutes les dix minutes et en fermant la page. Un bouton qui
           double un automatisme finit par faire douter de l'automatisme.
           Reste la date du dernier tour, qui, elle, se lit. */
        bloc.innerHTML = `
          <p class="tiny muted">Connecté en tant que <strong>${h(nuage.courriel())}</strong>.
            ${quand ? `Dernière synchronisation le ${h(dateLongue(quand.slice(0, 10)))}.`
                    : 'Jamais synchronisé depuis cet appareil.'}
            Elle se fait toute seule : à chaque modification, au retour sur l'écran et
            au retour du réseau.</p>
          <div class="rangee-boutons">
            <button class="btn btn-ghost" data-deconnexion>Se déconnecter</button>
          </div>`;
      };
      dessinerSync();
      document.addEventListener('sync-change', dessinerSync);

      bloc.addEventListener('click', async e => {
        if (e.target.closest('[data-connexion]')) {
          const mail = bloc.querySelector('#sync-mail').value.trim();
          const mdp = bloc.querySelector('#sync-mdp').value;
          const err = bloc.querySelector('#sync-erreur');
          if (!mail || !mdp) { err.hidden = false; err.textContent = 'Email et mot de passe.'; return; }
          try {
            await nuage.connexion(mail, mdp);
            dessinerSync();
            const r = await nuage.synchroniser();
            toast(r.ok ? messageSync(r) : `Connecté, mais : ${r.erreur}`);
            dessinerSync();
          } catch (ex) {
            err.hidden = false;
            err.textContent = /Invalid login/i.test(ex.message)
              ? 'Email ou mot de passe incorrect.' : ex.message;
          }
          return;
        }
        if (e.target.closest('[data-deconnexion]')) {
          nuage.deconnexion();
          dessinerSync();
          toast('Déconnecté — ton carnet reste sur cet appareil.');
        }
      });

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
        toast(mode === 'remplacement'
          ? `Données remplacées : ${r.matchs} match(s), ${r.conseils} conseil(s).`
          : `Ajouté : ${r.matchs} match(s), ${r.conseils} conseil(s), ${r.sources} compte(s).`);
      };

      racine.querySelector('[data-vider]').onclick = async () => {
        if (await confirmer('Tout effacer sur cet appareil ?',
            'Matchs, conseils et comptes suivis disparaîtront. Pense à exporter avant.')) {
          toutEffacer();
          toast('Carnet vidé.');
        }
      };
}

export { sauver };
