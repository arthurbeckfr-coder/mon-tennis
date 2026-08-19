/* Mon profil : qui je suis, et tout ce qui m'appartient.

   La rubrique s'appelait « le sac » et ne parlait que de matériel. Elle
   parle maintenant de son propriétaire, dont le sac n'est qu'un chapitre :
   qui il est, d'où il part, ce qu'il porte, ce que ça lui coûte. Le
   changement n'est pas cosmétique — un numéro de licence n'avait aucune
   place dans un sac, et n'en avait nulle part ailleurs non plus.

   Six sujets sous un même toit parce qu'ils se pensent au même moment, la
   veille d'un tournoi. Un seul est affiché à la fois : une liste de
   courses et un historique de cordages n'ont rien à se dire, les empiler
   ne ferait que rallonger le défilement. */

import { h, dateCourte, dateLongue, puce, confirmer, toast, openModal,
         aVider } from '../util.js';
import { store, basculerAchat, rangerCourses, courses as coursesCRUD, raquetteDe,
         clubDuMatch, CATEGORIES_DEPENSE, nomCategorieDepense, maj } from '../store.js';
import { pointDuClub } from '../carte.js';
import { saisonDe } from './matchs.js';
import { direTour } from '../store.js';
import { distanceKm, situer } from '../geocodage.js';
import { ECHELONS } from '../classement.js';
import {
  CATEGORIES_COURSES, TROUSSE_TYPE, nomCause,
  statsCordages, ageCordage, dureesDeVie,
} from '../materiel.js';
import { courseForm, raquetteForm, cordageForm, chaussureForm, depenseForm,
         identiteForm, profilForm, baremeForm,
         blocDonnees, brancherDonnees } from '../forms.js';

let onglet = 'moi';

/* La saison retenue sur la page Argent — dépenses comprises, et pas
   seulement la route. Un filtre posé en haut d'une page gouverne ce
   qu'il y a dessous : n'en faire suivre qu'un quart des chiffres serait
   un piège. « Tout » par défaut, parce que le total depuis toujours est
   le premier chiffre qu'on veut ; la saison répond ensuite à « et cette
   année ? ». */
let saisonRoute = 'tout';

/* Quatre onglets, et non six. Raquettes, cordages et chaussures parlaient
   de la même chose — ce qu'on emporte au court — et leurs trois entrées
   débordaient de la barre : on faisait défiler un menu pour trouver ce
   qui tenait dans un seul mot. Elles sont maintenant trois rayons d'un
   onglet « Matériel », choisis au-dessous.

   Le rayon retenu vit à part de l'onglet : revenir au matériel après un
   détour par l'argent doit rouvrir la page où on l'avait laissée, pas la
   première des trois. */
const ONGLETS = [
  { cle: 'moi',      emoji: '👤', nom: 'Moi' },
  { cle: 'courses',  emoji: '🛒', nom: 'Courses' },
  { cle: 'argent',   emoji: '💶', nom: 'Argent' },
  { cle: 'materiel', emoji: '🎒', nom: 'Matériel' },
];

const RAYONS = [
  { cle: 'raquettes',  emoji: '🎾', nom: 'Raquettes' },
  { cle: 'cordages',   emoji: '🪢', nom: 'Cordages' },
  { cle: 'chaussures', emoji: '👟', nom: 'Chaussures' },
];

let rayon = 'raquettes';

export function render() {
  const barre = `<div class="segments segments-defile">
    ${ONGLETS.map(o => `<button data-onglet="${o.cle}" style="flex:1"
      class="${onglet === o.cle ? 'actif' : ''}">${o.emoji} ${h(o.nom)}</button>`).join('')}
  </div>`;

  if (onglet === 'materiel') {
    const sous = `<div class="segments" style="margin-top:10px">
      ${RAYONS.map(o => `<button data-rayon="${o.cle}" style="flex:1"
        class="${rayon === o.cle ? 'actif' : ''}">${o.emoji} ${h(o.nom)}</button>`).join('')}
    </div>`;
    const dedans = { raquettes: vueRaquettes, cordages: vueCordages,
                     chaussures: vueChaussures }[rayon]();
    return barre + sous + dedans;
  }

  const corps = { moi: vueMoi, courses: vueCourses, argent: vueArgent }[onglet]();
  return barre + corps;
}

/* ─── Moi ──────────────────────────────────────────────────────────────

   Le sac est devenu un profil, et le sac n'en est qu'un onglet. Ce qui a
   changé n'est pas l'organisation mais le sujet : la rubrique parlait de
   matériel, elle parle maintenant de son propriétaire — qui il est, où il
   habite, ce qu'il porte, ce que ça lui coûte.

   Cet écran ne saisit rien lui-même : il montre, et renvoie aux
   formulaires qui existent déjà. Deux endroits pour modifier la même
   chose finiraient par diverger. */
function ligneInfo(emoji, libelle, valeur, lien = '') {
  if (!valeur) return '';
  const contenu = lien
    ? `<a href="${h(lien)}">${h(valeur)}</a>`
    : h(valeur);
  return `<li><span class="fiche-emoji">${emoji}</span>
    <div><span class="tiny muted">${h(libelle)}</span><br>${contenu}</div></li>`;
}

/* ─── Le profil, d'un seul tenant ──────────────────────────────────────
 *
 * C'était trois cartes en lecture seule, chacune avec un bouton qui
 * ouvrait une fenêtre où l'on modifiait. Trois allers-retours pour
 * changer un numéro de licence, et surtout : ce qu'on lisait n'était pas
 * ce qu'on modifiait. Une page de réglages doit se régler sur place.
 *
 * Tout est donc éditable ici, et chaque champ s'enregistre en le
 * quittant — pas de bouton « Enregistrer » à oublier. La connexion vient
 * en tête : c'est elle qui décide si le reste vivra sur un seul appareil
 * ou sur tous, et c'est la première chose à faire sur un téléphone neuf.
 */
/** Les champs du profil s'enregistrent en les quittant.
 *
 *  Pas de bouton « Enregistrer » : il se sait, se cherche et s'oublie, et
 *  l'on repart d'un écran de réglages en croyant avoir réglé. `change` se
 *  déclenche à la sortie du champ pour du texte, au choix pour une liste :
 *  dans les deux cas au moment où l'on a fini.
 *
 *  Une adresse fait un détour de plus : elle est cherchée avant d'être
 *  rangée, et l'on écrit sous le champ ce qu'on a trouvé — ou qu'on n'a
 *  rien trouvé, ce qui vaut mieux qu'un point posé au hasard.
 */
/* De quoi retirer le rattrapage du profil précédent : la page se
   redessine à chaque écriture, et laisser s'empiler un rattrapage par
   passage ferait travailler dix écrans morts au moment du départ. */
let oublierRattrapage = null;

function brancherProfil(vue) {
  const textes = ['prenom', 'nom', 'licence', 'naissance', 'telephone', 'mail',
                  'clubPrincipal', 'echelon', 'sexe'];

  /* Ce qu'un champ vaut, à l'écran comme dans le carnet, pour ne rien
     écrire quand rien n'a bougé — une écriture pour rien redessine
     l'écran et relance un envoi. */
  const lu = el => {
    if (el.name === 'gaucher') return el.value === '1';
    if (el.name === 'coutKm' || el.name === 'coutVictoire') {
      return el.value === '' ? null : Number(el.value);
    }
    return el.value.trim();
  };
  const garde = cle => {
    const v = store.profil?.[cle];
    return (cle === 'domicile' || cle === 'bureau') ? (v?.adresse || '') : v;
  };

  /* Le rattrapage du départ. Un champ ne s'enregistre qu'une fois
     quitté ; taper son numéro de licence puis passer à une autre
     application, c'était le perdre — et donc ne rien synchroniser du
     tout. On repasse donc sur les champs au moment où la page s'en va.

     Les adresses y sont gardées telles quelles, sans leur point : les
     situer demande un aller-retour au géocodeur qui n'aura pas lieu. Le
     texte est sauf, et le bouton « Placer sur la carte » finit le
     travail à la prochaine ouverture — mieux vaut une adresse sans point
     qu'une adresse perdue. */
  oublierRattrapage?.();
  oublierRattrapage = aVider(() => {
    if (!document.contains(vue)) return;
    const change = {};
    for (const el of vue.querySelectorAll('[name]')) {
      const cle = el.name;
      if (cle === 'domicile' || cle === 'bureau') {
        const adresse = el.value.trim();
        if (adresse === garde(cle)) continue;
        change[cle] = adresse ? { adresse, point: null, libelle: '' } : null;
        continue;
      }
      if (!textes.includes(cle) && cle !== 'gaucher'
          && cle !== 'coutKm' && cle !== 'coutVictoire') continue;
      const v = lu(el);
      if (v === garde(cle)) continue;
      change[cle] = v;
      if (cle === 'coutVictoire') change.tourneeReglee = true;
    }
    if (Object.keys(change).length) maj(s => { s.profil = { ...s.profil, ...change }; });
  });

  vue.addEventListener('change', async e => {
    const el = e.target.closest('[name]');
    if (!el || !vue.contains(el)) return;
    const cle = el.name;

    if (textes.includes(cle)) {
      maj(s => { s.profil = { ...s.profil, [cle]: el.value.trim() }; });
      return;
    }
    if (cle === 'gaucher') {
      maj(s => { s.profil = { ...s.profil, gaucher: el.value === '1' }; });
      return;
    }
    if (cle === 'coutKm' || cle === 'coutVictoire') {
      const v = el.value === '' ? null : Number(el.value);
      /* Toucher au prix de la tournée, fût-ce pour l'effacer, c'est en
         décider : le carnet n'a plus à le remplir à ta place. */
      maj(s => { s.profil = { ...s.profil, [cle]: v,
        ...(cle === 'coutVictoire' ? { tourneeReglee: true } : {}) }; });
      return;
    }

    if (cle === 'domicile' || cle === 'bureau') {
      const adresse = el.value.trim();
      const etat = vue.querySelector(`[data-etat="${cle}"]`);
      if (!adresse) {
        maj(s => { s.profil = { ...s.profil, [cle]: null }; });
        return;
      }
      if (etat) etat.textContent = 'recherche…';
      const r = await situer(adresse);
      maj(s => {
        s.profil = { ...s.profil, [cle]: r.ok
          ? { adresse, point: r.point, libelle: r.libelle }
          : { adresse, point: null, libelle: '' } };
      });
      if (!r.ok) toast(`Adresse non trouvée : ${r.erreur}`);
    }
  });
}
function vueMoi() {
  const p = store.profil;

  const champ = (cle, libelle, o = {}) => `<label>${h(libelle)}
    <input name="${cle}" type="${o.type || 'text'}" value="${h(p[cle] ?? '')}"
      ${o.placeholder ? `placeholder="${h(o.placeholder)}"` : ''}
      ${o.inputmode ? `inputmode="${o.inputmode}"` : ''}
      ${o.autocomplete ? `autocomplete="${o.autocomplete}"` : ''}></label>`;

  const lieu = (cle, libelle, exemple) => {
    const l = p[cle];
    return `<label>${h(libelle)}
      <input name="${cle}" value="${h(l?.adresse || '')}" placeholder="${h(exemple)}"></label>
      <p class="tiny muted" data-etat="${cle}">${
        !l?.adresse ? 'Rien pour l\'instant.'
        : l.point ? `📍 ${h(l.libelle || l.adresse)}`
        : '⚠️ pas encore trouvée sur la carte — vérifie la commune et le code postal'}</p>`;
  };

  return `
    ${/* La connexion en tête : c'est elle qui décide si le reste vivra sur
          un appareil ou sur tous. */''}
    <section class="carte">
      <h3>Mon compte</h3>
      <div id="bloc-sync"></div>
    </section>

    <section class="carte">
      <h3>Qui je suis</h3>
      <div class="form">
        <div class="duo">
          ${champ('prenom', 'Prénom', { placeholder: 'Arthur' })}
          ${champ('nom', 'Nom', { placeholder: 'BECK' })}
        </div>
        <div class="duo">
          ${champ('licence', 'Numéro de licence', { placeholder: '1234567 A' })}
          ${champ('naissance', 'Naissance', { type: 'date' })}
        </div>
        <div class="duo">
          ${champ('telephone', 'Téléphone', { type: 'tel', autocomplete: 'tel' })}
          ${champ('mail', 'E-mail', { type: 'email', autocomplete: 'email' })}
        </div>
        ${champ('clubPrincipal', 'Mon club', { placeholder: 'TC de ma ville' })}
        <p class="tiny muted">Le numéro de licence est ce qu'on cherche le plus souvent,
          debout au club, au moment de s'inscrire. Rien de tout cela ne sort du carnet.</p>
      </div>
    </section>

    <section class="carte">
      <h3>Mon classement</h3>
      <div class="form">
        <div class="duo">
          <label>Mon échelon
            <select name="echelon">${ECHELONS.map(e =>
              `<option value="${h(e)}" ${e === p.echelon ? 'selected' : ''}>${h(e)}</option>`).join('')}
            </select>
          </label>
          <label>Barème
            <select name="sexe">
              <option value="h" ${p.sexe === 'h' ? 'selected' : ''}>Messieurs</option>
              <option value="f" ${p.sexe === 'f' ? 'selected' : ''}>Dames</option>
            </select>
          </label>
        </div>
        <label>Ma main
          <select name="gaucher">
            <option value="" ${!p.gaucher ? 'selected' : ''}>Droitier</option>
            <option value="1" ${p.gaucher ? 'selected' : ''}>Gaucher</option>
          </select>
        </label>
        <p class="tiny muted">La main décide de quel côté du terrain se trouve ton coup
          droit, sur le dessin de l'écran « Sur le court ». Le classement de départ, et
          c'est tout : le bilan, les victoires comptabilisées et les bonifications se
          calculent depuis tes matchs, comme le fait la fédération.</p>
        <div class="rangee-boutons">
          <button class="btn btn-ghost" data-bareme>Voir et corriger le barème</button>
        </div>
      </div>
    </section>

    <section class="carte">
      <h3>D'où je pars</h3>
      <div class="form">
        <p class="tiny muted">Pour situer les clubs par rapport à chez toi et savoir
          lesquels sont à côté. Une adresse est cherchée dès que tu quittes le champ, et
          rien n'est deviné : une adresse non reconnue reste sans point plutôt que
          d'être placée au hasard.</p>
        ${lieu('domicile', 'Mon domicile', '12 rue des Écoles, 76000 Rouen')}
        ${lieu('bureau', 'Mon travail', '3 place du Marché, 76200 Dieppe')}
        <label>Coût du kilomètre
          <input name="coutKm" type="number" min="0" step="0.01" inputmode="decimal"
            value="${p.coutKm ?? ''}" placeholder="par exemple 0,30"></label>
        <p class="tiny muted">Sert à estimer ce que la route coûte, dans l'onglet Argent.
          Laissé vide, le carnet compte les kilomètres et s'arrête là plutôt que
          d'inventer un prix.</p>

        ${/* La tournée d'après-match : une habitude, donc une dépense
              régulière, donc quelque chose qui s'estime. Elle ne se saisit
              pas match par match — personne ne note quatre euros trente
              fois par saison —, mais elle se calcule très bien : une
              victoire, une tournée. */''}
        <label>La tournée d'après-match
          <input name="coutVictoire" type="number" min="0" step="0.5" inputmode="decimal"
            value="${p.coutVictoire ?? ''}" placeholder="par exemple 4"></label>
        <p class="tiny muted">Ce qu'une victoire te coûte au bar : la canette de
          l'adversaire et la tienne. Le carnet le compte pour chaque match gagné sauf les
          finales, dans l'onglet Argent, du côté des estimations. Laissé vide, il ne
          compte rien.</p>
      </div>
    </section>

    <section class="carte">
      <h3>Sauvegarde et transfert</h3>
      ${blocDonnees()}
    </section>`;
}
/* ─── Ce que le tennis coûte ───────────────────────────────────────────

   Deux natures de chiffres, et l'écran ne les mélange jamais.

   Ce qui est **payé** se saisit : une inscription de tournoi, une licence,
   un cordage. Rien ne s'en déduit d'un palmarès — la fédération enregistre
   des résultats, pas des factures.

   Ce qui est **estimé** se calcule : les déplacements, à partir du
   domicile et des clubs où l'on a joué. À vol d'oiseau, aller-retour, au
   tarif qu'on aura réglé soi-même. C'est un ordre de grandeur et c'est dit
   comme tel — la route est plus longue que le vol d'oiseau, et de combien
   dépend du relief.

   Les additionner dans un même total ferait passer l'estimation pour une
   dépense constatée. Ils restent donc côte à côte, jamais confondus. */
const euros = n => `${n.toLocaleString('fr-FR', { maximumFractionDigits: n < 100 ? 2 : 0 })} €`;

/** Les kilomètres parcourus pour aller jouer, club par club.
 *
 *  `saison` vaut « tout » ou l'année de début d'une saison sportive —
 *  celle-ci court de septembre à août, et c'est ainsi qu'on s'en
 *  souvient : les frais d'une année de tennis ne se comptent pas du 1er
 *  janvier au 31 décembre. */
function deplacements(saison = 'tout') {
  const chez = store.profil?.domicile?.point;
  if (!chez) return null;

  const parClub = new Map();
  for (const m of store.matchs) {
    if (saison !== 'tout' && saisonDe(m.date) !== Number(saison)) continue;
    const club = clubDuMatch(m);
    if (!club) continue;
    const p = pointDuClub(club);
    if (!p) continue;
    if (!parClub.has(club.id)) {
      parClub.set(club.id, { club, trajets: 0, km: distanceKm(chez, p) });
    }
    parClub.get(club.id).trajets++;
  }

  const lignes = [...parClub.values()]
    .map(x => ({ ...x, kmTotal: x.km * 2 * x.trajets }))
    .sort((a, b) => b.kmTotal - a.kmTotal);

  return { lignes, kmTotal: lignes.reduce((t, x) => t + x.kmTotal, 0) };
}

/** Ce qu'un club coûte en route, et ce que cela fait par match.
 *
 *  Le total au kilomètre ne dit pas ce qu'un déplacement vaut : deux
 *  heures de route pour un tour perdu et trois matchs dans la même
 *  journée à vingt minutes de chez soi donnent le même total et n'ont
 *  rien à voir. On détaille donc par saison et par épreuve, et l'on
 *  ramène le prix au match — c'est le chiffre qu'on compare.
 */
function detailRoute(clubId) {
  const chez = store.profil?.domicile?.point;
  const club = store.clubs.find(c => c.id === clubId);
  if (!club || !chez) return;

  const km = distanceKm(chez, pointDuClub(club));
  const matchs = store.matchs.filter(x => clubDuMatch(x)?.id === clubId);
  const tarif = Number(store.profil?.coutKm) || 0;

  /* Un aller-retour par match : c'est l'hypothèse la plus simple, et la
     seule tenable sans savoir quels matchs se sont joués le même jour.
     Deux matchs dans la journée comptent donc deux trajets, et le chiffre
     est majoré — on donne les deux bornes plutôt que de trancher. */
  const jours = new Set(matchs.map(x => x.date).filter(Boolean));
  const kmTotal = km * 2 * matchs.length;
  const kmJours = km * 2 * (jours.size || matchs.length);
  const dist = km < 10 ? km.toFixed(1) : Math.round(km);

  const parSaison = {};
  const parEpreuve = {};
  for (const x of matchs) {
    const s = saisonDe(x.date);
    if (s != null) parSaison[s] = (parSaison[s] || 0) + 1;
    const e = (x.tournoi || 'Sans épreuve').trim();
    parEpreuve[e] = (parEpreuve[e] || 0) + 1;
  }

  const ligne = (cle, valeur) => `<li><div><strong>${h(cle)}</strong></div>
    <div class="club-score"><b>${h(valeur)}</b></div></li>`;

  openModal({
    title: club.nom,
    body: `
      <section class="chiffres">
        <div class="chiffre"><b>${dist}</b><span>km à l'aller</span></div>
        <div class="chiffre"><b>${matchs.length}</b><span>match(s)</span></div>
        <div class="chiffre"><b>${jours.size}</b><span>jour(s) sur place</span></div>
        <div class="chiffre"><b>${Math.round(kmTotal)}</b><span>km au total</span></div>
      </section>

      <p class="tiny muted">Un aller-retour par match : ${matchs.length} × ${dist} km
        × 2 = ${Math.round(kmTotal)} km. En comptant un seul aller-retour par journée de
        jeu — ${jours.size} au lieu de ${matchs.length} — cela ferait
        ${Math.round(kmJours)} km. La vérité est entre les deux, et la distance est à vol
        d'oiseau : la route fait toujours plus.</p>

      ${tarif ? `<section class="chiffres">
        <div class="chiffre"><b>${euros(kmTotal * tarif)}</b><span>de route</span></div>
        <div class="chiffre"><b>${euros(matchs.length ? kmTotal * tarif / matchs.length : 0)}</b>
          <span>par match</span></div>
        <div class="chiffre"><b>${euros(kmJours * tarif)}</b>
          <span>à un trajet par jour</span></div>
      </section>` : `<p class="tiny muted">Aucun tarif kilométrique réglé : le carnet
        compte les kilomètres et n'invente pas un prix. Il se règle dans ton profil.</p>`}

      <span class="etiquette">Par saison</span>
      <ul class="clubs-adverses">
        ${Object.keys(parSaison).sort((a, b) => b - a).map(s =>
          ligne(`${s}-${String(Number(s) + 1).slice(2)}`, `${parSaison[s]} match(s)`)).join('')}
      </ul>

      <span class="etiquette">Par épreuve</span>
      <ul class="clubs-adverses">
        ${Object.entries(parEpreuve).sort((a, b) => b[1] - a[1])
          .map(([e, n]) => ligne(e, `${n} match(s)`)).join('')}
      </ul>`,
  });
}

/** Le détail derrière un des quatre chiffres du haut : un total
 *  n'apprend rien tant qu'on ne sait pas de quoi il est fait. */
function detailArgent(quoi) {
  const saisies = [...(store.depenses || [])]
    .filter(d => saisonRoute === 'tout' || saisonDe(d.date) === Number(saisonRoute))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const total = saisies.reduce((t, d) => t + (Number(d.montant) || 0), 0);
  const route = deplacements(saisonRoute);
  const tarif = Number(store.profil?.coutKm) || 0;

  const parAn = {};
  const parCat = {};
  for (const d of saisies) {
    const a = (d.date || '').slice(0, 4) || '?';
    parAn[a] = (parAn[a] || 0) + (Number(d.montant) || 0);
    parCat[d.categorie] = (parCat[d.categorie] || 0) + (Number(d.montant) || 0);
  }

  const ligne = (cle, valeur) => `<li><div><strong>${h(cle)}</strong></div>
    <div class="club-score"><b>${h(valeur)}</b></div></li>`;

  const vues = {
    total: {
      titre: 'Ce que le tennis a coûté',
      corps: `<p class="tiny muted">${euros(total)} notés en ${saisies.length} ligne(s).
          Ce sont des dépenses saisies et non une estimation : rien ne se déduit d'un
          palmarès — la fédération enregistre des résultats, pas des factures.</p>
        <span class="etiquette">Par catégorie</span>
        <ul class="clubs-adverses">${CATEGORIES_DEPENSE.filter(c => parCat[c.cle])
          .sort((a, b) => parCat[b.cle] - parCat[a.cle])
          .map(c => ligne(`${c.emoji} ${c.nom}`, euros(parCat[c.cle]))).join('')}</ul>
        <span class="etiquette">Par année</span>
        <ul class="clubs-adverses">${Object.keys(parAn).sort((a, b) => b.localeCompare(a))
          .map(a => ligne(a, euros(parAn[a]))).join('')}</ul>`,
    },
    lignes: {
      titre: 'Les dépenses notées',
      corps: saisies.length
        ? `<ul class="clubs-adverses">${saisies.map(d => `<li>
            <div><strong>${h(d.libelle)}</strong>
              <div class="tiny muted">${h(dateCourte(d.date))} —
                ${h(nomCategorieDepense(d.categorie))}</div></div>
            <div class="club-score"><b>${euros(Number(d.montant) || 0)}</b></div>
          </li>`).join('')}</ul>`
        : `<p class="tiny muted">Rien de noté pour l'instant.</p>`,
    },
  };

  if (quoi === 'tournees') {
    const t = tournees(saisonRoute);
    const parAn = {};
    for (const x of t.liste) {
      const s = saisonDe(x.date);
      if (s != null) parAn[s] = (parAn[s] || 0) + 1;
    }
    openModal({
      title: 'La tournée d\'après-match',
      body: `<section class="chiffres">
          <div class="chiffre"><b>${t.victoires}</b><span>victoires</span></div>
          <div class="chiffre"><b>${euros(t.prix)}</b><span>la tournée</span></div>
          <div class="chiffre"><b>${euros(t.total)}</b><span>en tout</span></div>
        </section>
        <p class="tiny muted">Une victoire, une tournée : ta canette et la sienne. Les
          finales n'y sont pas, ni les matchs gagnés par forfait — dans un cas la règle
          ne s'applique pas, dans l'autre il n'y a eu ni match ni bar.</p>
        <span class="etiquette">Par saison</span>
        <ul class="clubs-adverses">${Object.keys(parAn).sort((a, b) => b - a).map(a =>
          `<li><div><strong>${a}-${String(Number(a) + 1).slice(2)}</strong>
            <div class="tiny muted">${parAn[a]} victoire(s)</div></div>
           <div class="club-score"><b>${euros(parAn[a] * t.prix)}</b></div></li>`).join('')}</ul>
        <p class="tiny muted">C'est une estimation, comme la route : elle suppose que la
          règle a toujours été tenue, et qu'elle valait déjà quatre euros il y a cinq
          ans. Elle ne s'additionne donc pas aux dépenses notées.</p>`,
    });
    return;
  }

  if (quoi === 'gains') {
    const g = gains(saisonRoute);
    openModal({
      title: 'Ce que les tournois ont rapporté',
      body: `<p class="tiny muted">${g.total ? `${euros(g.total)} en tout` : 'Aucun gain en'
          + ' argent'}${g.lots ? `, et ${g.lots} lot(s)` : ''}. Les lots ne sont pas
          convertis en euros : un prix inventé passerait pour une recette.</p>
        <ul class="clubs-adverses">${g.liste.map(x => `<li>
          <div><strong>${h(x.adversaire || 'Adversaire inconnu')}</strong>
            <div class="tiny muted">${h(dateCourte(x.date))}${
              x.tournoi ? ' — ' + h(x.tournoi) : ''}${
              direTour(x) ? ' — ' + h(direTour(x)) : ''}</div></div>
          <div class="club-score"><b>${x.gainMontant ? euros(x.gainMontant) : ''}</b>
            ${x.gainLot ? `<span class="tiny muted">${h(x.gainLot)}</span>` : ''}</div>
        </li>`).join('')}</ul>`,
    });
    return;
  }

  if ((quoi === 'km' || quoi === 'route') && route) {
    const n = route.lignes.reduce((t, x) => t + x.trajets, 0);
    vues[quoi] = {
      titre: quoi === 'km' ? 'Les kilomètres, estimés' : 'Ce que la route coûterait',
      corps: `
        <section class="chiffres">
          <div class="chiffre"><b>${Math.round(route.kmTotal)}</b><span>km</span></div>
          <div class="chiffre"><b>${n}</b><span>match(s) situés</span></div>
          <div class="chiffre"><b>${n ? Math.round(route.kmTotal / n) : 0}</b>
            <span>km par match</span></div>
          ${tarif ? `<div class="chiffre"><b>${euros(n ? route.kmTotal * tarif / n : 0)}</b>
            <span>par match</span></div>` : ''}
        </section>
        <p class="tiny muted"><strong>C'est un ordre de grandeur.</strong> La distance est
          à vol d'oiseau et la route fait toujours plus ; on ignore le covoiturage, les
          allers pour rien et les matchs dont on ne connaît pas le club.</p>
        <span class="etiquette">Club par club</span>
        <ul class="clubs-adverses">${route.lignes.map(x => `<li>
          <div><strong>${h(x.club.nom)}</strong>
            <div class="tiny muted">${x.trajets} trajet(s) —
              ${x.km < 10 ? x.km.toFixed(1) : Math.round(x.km)} km à l'aller</div></div>
          <div class="club-score"><b>${tarif ? euros(x.kmTotal * tarif)
            : Math.round(x.kmTotal) + ' km'}</b></div>
        </li>`).join('')}</ul>`,
    };
  }

  const v = vues[quoi];
  if (v) openModal({ title: v.titre, body: v.corps });
}
/** La tournée d'après-match, victoire par victoire.
 *
 *  C'est une estimation, et elle se range du côté des estimations : une
 *  habitude n'est pas une facture. On la calcule pourtant sans rien
 *  inventer — le nombre de victoires est connu à l'unité près, et le prix
 *  de la tournée, c'est lui qui le donne.
 */
function tournees(saison = 'tout') {
  const prix = Number(store.profil?.coutVictoire) || 0;
  /* Les finales gagnées n'y sont pas : c'est la règle telle qu'elle se
     tient, et elle ne s'applique qu'aux tours qui précèdent. Une finale
     perdue non plus, faute d'être une victoire — la question ne se pose
     donc que pour celles qu'on gagne. */
  const gagnes = store.matchs.filter(m => m.issue === 'V' && !m.wo
    && m.tour !== 'finale'
    && (saison === 'tout' || saisonDe(m.date) === Number(saison)));
  return { prix, victoires: gagnes.length, total: gagnes.length * prix, liste: gagnes };
}

/** Ce que les tournois ont rapporté : l'argent d'un côté, les lots de
 *  l'autre. On ne convertit pas un cordage en euros — un prix inventé
 *  passerait pour une recette. */
function gains(saison = 'tout') {
  const liste = store.matchs.filter(x =>
    (x.gainMontant || x.gainLot)
    && (saison === 'tout' || saisonDe(x.date) === Number(saison)));
  return {
    liste: liste.sort((a, b) => (b.date || '').localeCompare(a.date || '')),
    total: liste.reduce((t, x) => t + (Number(x.gainMontant) || 0), 0),
    lots: liste.filter(x => x.gainLot).length,
  };
}

/** Les saisons où il s'est passé quelque chose qui coûte : un match dans
 *  un club situé, ou une dépense notée. */
function saisonsDeRoute() {
  const vues = new Set();
  for (const m of store.matchs) {
    if (!clubDuMatch(m)) continue;
    const s = saisonDe(m.date);
    if (s != null) vues.add(s);
  }
  for (const d of store.depenses || []) {
    const s = saisonDe(d.date);
    if (s != null) vues.add(s);
  }
  return [...vues].sort((a, b) => b - a);
}

function vueArgent() {
  const saisies = [...(store.depenses || [])]
    .filter(d => saisonRoute === 'tout' || saisonDe(d.date) === Number(saisonRoute))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const total = saisies.reduce((t, d) => t + (Number(d.montant) || 0), 0);

  const parCat = {};
  for (const d of saisies) {
    parCat[d.categorie] = (parCat[d.categorie] || 0) + (Number(d.montant) || 0);
  }

  const route = deplacements(saisonRoute);
  const tarif = Number(store.profil?.coutKm) || 0;
  const saisons = saisonsDeRoute();
  const gagne = gains(saisonRoute);
  const tour = tournees(saisonRoute);

  return `
    ${/* Le filtre en tête de page, et il gouverne tout ce qui suit. Une
          saison sportive va de septembre à août : c'est la maille dans
          laquelle on pense ses frais de tennis, là où l'année civile
          couperait un championnat d'hiver en deux. */''}
    ${saisons.length > 1 ? `<section class="choix-cible">
      <span class="etiquette">Saison</span>
      <div class="segments">
        <button data-saison-route="tout"
          class="${saisonRoute === 'tout' ? 'actif' : ''}">Tout</button>
        ${saisons.slice(0, 5).map(s => `<button data-saison-route="${s}"
          class="${String(saisonRoute) === String(s) ? 'actif' : ''}"
          >${s}-${String(s + 1).slice(2)}</button>`).join('')}
      </div>
    </section>` : ''}

    ${/* Les quatre chiffres s'ouvrent : un total n'apprend rien tant
          qu'on ne sait pas de quoi il est fait. */''}
    <section class="chiffres">
      <div class="chiffre" data-argent="total" title="Voir le détail"
        ><b>${euros(total)}</b><span>dépenses notées</span></div>
      <div class="chiffre" data-argent="lignes" title="Voir le détail"
        ><b>${saisies.length}</b><span>lignes</span></div>
      ${route ? `<div class="chiffre" data-argent="km" title="Voir le détail"
        ><b>${Math.round(route.kmTotal)}</b><span>km estimés</span></div>` : ''}
      ${route && tarif ? `<div class="chiffre" data-argent="route" title="Voir le détail"
        ><b>${euros(route.kmTotal * tarif)}</b><span>de route estimés</span></div>` : ''}
      ${/* Ce que le tennis rapporte tient dans la même page que ce qu'il
            coûte, sans jamais se soustraire : un lot n'est pas une
            recette, et une estimation de route n'est pas une dépense
            constatée. Trois natures de chiffres, trois cases. */''}
      ${tour.total ? `<div class="chiffre" data-argent="tournees" title="Voir le détail"
        ><b>${euros(tour.total)}</b><span>de tournées</span></div>` : ''}
      ${gagne.total || gagne.lots ? `<div class="chiffre" data-argent="gains"
        title="Voir le détail"><b>${gagne.total ? euros(gagne.total)
          : gagne.lots}</b><span>${gagne.total ? 'gagnés en tournoi'
          : 'lot(s) gagné(s)'}</span></div>` : ''}
    </section>

    <div class="rangee-boutons" style="justify-content:center">
      <button class="btn btn-primary" data-depense>Noter une dépense</button>
    </div>

    ${saisies.length ? `<section class="carte">
      <h3>Par catégorie</h3>
      <ul class="clubs-adverses">
        ${CATEGORIES_DEPENSE.filter(c => parCat[c.cle]).map(c => `<li>
          <div><strong>${c.emoji} ${h(c.nom)}</strong></div>
          <div class="club-score"><b>${euros(parCat[c.cle])}</b></div>
        </li>`).join('')}
      </ul>
    </section>` : `<div class="vide"><span class="emoji">💶</span>
      Rien de noté pour l'instant. Une inscription de tournoi ne figure nulle part dans un
      palmarès : c'est à toi de l'écrire, et le carnet ne l'inventera pas.</div>`}

    ${saisies.length ? `<section class="carte">
      <h3>Le détail</h3>
      <ul class="clubs-adverses">
        ${saisies.map(d => `<li data-depense-id="${h(d.id)}" style="cursor:pointer">
          <div>
            <strong>${h(d.libelle)}</strong>
            <div class="tiny muted">${h(dateCourte(d.date))} —
              ${h(nomCategorieDepense(d.categorie))}${d.note ? ` · ${h(d.note)}` : ''}</div>
          </div>
          <div class="club-score"><b>${euros(Number(d.montant) || 0)}</b></div>
        </li>`).join('')}
      </ul>
    </section>` : ''}

    ${route ? `<section class="carte">
      <h3>La route, estimée</h3>
      <p class="tiny muted">${Math.round(route.kmTotal)} km pour aller jouer, tous clubs
        confondus${saisonRoute === 'tout' ? '' : `, sur la saison ${saisonRoute}-${
          String(Number(saisonRoute) + 1).slice(2)}`} : la distance de chez toi à chaque club, comptée aller-retour et
        multipliée par le nombre de matchs qui s'y sont joués.
        <strong>C'est un ordre de grandeur.</strong> La distance est à vol d'oiseau et la
        route fait toujours plus ; on ignore le covoiturage, les allers pour rien et les
        matchs dont on ne connaît pas le club.</p>
      ${tarif
        ? `<p class="tiny muted">Au tarif de ${euros(tarif)} du kilomètre que tu as réglé,
           cela ferait <strong>${euros(route.kmTotal * tarif)}</strong>.</p>`
        : `<p class="tiny muted">Aucun tarif kilométrique réglé : le carnet ne compte donc
           que les kilomètres, et n'invente pas un prix. Il se règle dans ton profil.</p>`}
      <ul class="clubs-adverses">
        ${/* Chaque club s'ouvre : le total au kilomètre ne dit pas ce
              qu'un match coûte là-bas, et c'est pourtant la question —
              deux heures de route pour un tour perdu, ou trois matchs
              dans la même journée à vingt minutes de chez soi. */''}
        ${route.lignes.slice(0, 8).map(x => `<li data-route="${h(x.club.id)}"
            style="cursor:pointer">
          <div>
            <strong>${h(x.club.nom)}</strong>
            <div class="tiny muted">${x.trajets} trajet(s) —
              ${x.km < 10 ? x.km.toFixed(1) : Math.round(x.km)} km à l'aller</div>
          </div>
          <div class="club-score">
            <b>${Math.round(x.kmTotal)}</b>
            <span class="tiny muted">km</span>
          </div>
        </li>`).join('')}
      </ul>
    </section>` : `<section class="carte">
      <h3>La route</h3>
      <p class="tiny muted">Renseigne ton domicile dans le profil et le carnet saura dire
        combien de kilomètres tu fais pour aller jouer.</p>
    </section>`}`;
}

// =====================================================================
//  Courses
// =====================================================================
function vueCourses() {
  const liste = store.courses;
  const aPrendre = liste.filter(a => !a.achete);
  const pris = liste.filter(a => a.achete);

  if (!liste.length) {
    return `<div class="vide">
      <span class="emoji">🛒</span>
      Ta liste est vide.
      <p class="tiny muted" style="margin-top:10px">La trousse de secours et les
        consommables reviennent à chaque saison : plutôt que de les saisir un par un,
        pars d'une liste type et retire ce qui ne te sert pas.</p>
      <div class="rangee-boutons" style="justify-content:center;margin-top:14px">
        <button class="btn btn-primary" data-trousse>Partir d'une liste type</button>
        <button class="btn" data-ajout-course>Ajouter un article</button>
      </div>
    </div>`;
  }

  /* Regroupé par rayon : on ne fait pas trois fois le tour du magasin. */
  const parRayon = CATEGORIES_COURSES.map(cat => ({
    cat, articles: aPrendre.filter(a => a.categorie === cat.cle),
  })).filter(g => g.articles.length);

  return `
    <section class="chiffres">
      <div class="chiffre"><b>${aPrendre.length}</b><span>à acheter</span></div>
      <div class="chiffre"><b>${pris.length}</b><span>dans le panier</span></div>
    </section>

    ${parRayon.map(g => `<section class="carte">
      <h3>${g.cat.emoji} ${h(g.cat.nom)}</h3>
      <ul class="courses">
        ${g.articles.map(ligneCourse).join('')}
      </ul>
    </section>`).join('')}

    ${pris.length ? `<section class="carte">
      <h3>Déjà pris</h3>
      <ul class="courses">${pris.map(ligneCourse).join('')}</ul>
      <button class="btn btn-ghost" data-ranger>Ranger la liste</button>
      <p class="tiny muted">Les articles récurrents se décochent et restent ;
         les autres disparaissent.</p>
    </section>` : ''}

    <div class="rangee-boutons" style="justify-content:center">
      <button class="btn" data-ajout-course>Ajouter un article</button>
    </div>`;
}

function ligneCourse(a) {
  return `<li class="course ${a.achete ? 'pris' : ''}">
    <button class="coche" data-cocher="${h(a.id)}" aria-pressed="${!!a.achete}"
            aria-label="${a.achete ? 'Décocher' : 'Cocher'}">✓</button>
    <span class="course-icone">${a.icone || '📦'}</span>
    <span class="course-nom" data-ouvrir-course="${h(a.id)}">
      ${h(a.nom)}
      ${a.note ? `<small class="muted">${h(a.note)}</small>` : ''}
    </span>
    ${a.recurrent ? puce('récurrent') : ''}
  </li>`;
}

// =====================================================================
//  Raquettes
// =====================================================================
function vueRaquettes() {
  if (!store.raquettes.length) {
    return `<div class="vide"><span class="emoji">🎾</span>
      Aucune raquette enregistrée.
      <p class="tiny muted" style="margin-top:10px">C'est elle qui permet de suivre
        la durée de vie des cordages : sans raquette, un cordage cassé n'est qu'une date.</p>
      <div class="rangee-boutons" style="justify-content:center;margin-top:14px">
        <button class="btn btn-primary" data-ajout-raquette>Ajouter ma raquette</button>
      </div></div>`;
  }

  return `
    ${store.raquettes.map(r => {
      const age = ageCordage(store.cordages, r.id);
      const durees = dureesDeVie(store.cordages, r.id);
      const moyenne = durees.length
        ? Math.round(durees.reduce((t, d) => t + d.jours, 0) / durees.length) : null;
      /* Un cordage qui a dépassé sa durée de vie habituelle est le seul
         signal utile ici : c'est celui qui va lâcher au mauvais moment. */
      const alerte = age && moyenne && age.jours > moyenne;

      return `<section class="carte ${r.active ? '' : 'carte-retiree'}">
        <div class="fiche-tete">
          <div>
            <h3>${h(r.marque)} ${h(r.modele)}
              ${r.active ? '' : puce('au repos')}</h3>
            <p class="tiny muted">
              ${[r.annee, r.tamis, r.poids].filter(Boolean).map(h).join(' · ') || 'Sans détail'}
            </p>
          </div>
          <button class="btn btn-ghost" data-modif-raquette="${h(r.id)}">Modifier</button>
        </div>
        <ul class="fiche-infos">
          ${r.cordageHabituel ? `<li><span class="fiche-emoji">🪢</span><div>
            ${h(r.cordageHabituel)}${r.tensionHabituelle ? ` à ${h(r.tensionHabituelle)}` : ''}</div></li>` : ''}
          <li><span class="fiche-emoji">⏱️</span><div>
            ${age
              ? `Cordage posé il y a <strong>${age.jours} jour${age.jours > 1 ? 's' : ''}</strong>
                 (${h(dateCourte(age.pose.date))})
                 ${moyenne ? ` — d'habitude il tient ${moyenne} jours` : ''}
                 ${alerte ? ' <span class="alerte">· au-delà de l\'habitude</span>' : ''}`
              : 'Aucun cordage noté sur cette raquette.'}
          </div></li>
        </ul>
        <button class="btn" data-casse="${h(r.id)}">Cordage cassé ou changé</button>
      </section>`;
    }).join('')}

    <div class="rangee-boutons" style="justify-content:center">
      <button class="btn" data-ajout-raquette>Ajouter une raquette</button>
    </div>`;
}

// =====================================================================
//  Cordages
// =====================================================================
function vueCordages() {
  const s = statsCordages(store.cordages, store.raquettes);
  const liste = [...store.cordages].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  if (!liste.length) {
    return `<div class="vide"><span class="emoji">🪢</span>
      Aucun cordage noté.
      <p class="tiny muted" style="margin-top:10px">Note-les au fur et à mesure : au bout
        de trois ou quatre, la durée de vie moyenne se calcule toute seule et devient
        une vraie information — celle qui dit quand recorder avant de casser en match.</p>
      <div class="rangee-boutons" style="justify-content:center;margin-top:14px">
        <button class="btn btn-primary" data-ajout-cordage>Noter un cordage</button>
      </div></div>`;
  }

  return `
    <section class="chiffres">
      <div class="chiffre"><b>${s.cassesSurDouzeMois}</b><span>cassés sur 12 mois</span></div>
      <div class="chiffre"><b>${s.casses}</b><span>cassés en tout</span></div>
      <div class="chiffre"><b>${s.moyenneGenerale ?? '—'}</b><span>jours de vie moyens</span></div>
      <div class="chiffre"><b>${s.total}</b><span>poses notées</span></div>
    </section>

    ${s.parRaquette.filter(x => x.poses).length > 1 ? `<section class="carte">
      <h3>Par raquette</h3>
      <ul class="fiche-infos">
        ${s.parRaquette.filter(x => x.poses).map(x => `<li>
          <span class="fiche-emoji">🎾</span>
          <div><strong>${h(x.raquette.marque)} ${h(x.raquette.modele)}</strong> —
            ${x.poses} pose(s), ${x.casses} cassé(s)${
            x.moyenne ? `, ${x.moyenne} jours en moyenne` : ''}</div>
        </li>`).join('')}
      </ul>
    </section>` : ''}

    <h3 class="titre-section">L'historique</h3>
    <ul class="cordages">
      ${liste.map(c => {
        const r = raquetteDe(c.raquetteId);
        return `<li class="cordage ${c.cause === 'casse' ? 'casse' : ''}"
                    data-modif-cordage="${h(c.id)}">
          <div class="cordage-date">${h(dateCourte(c.date))}</div>
          <div class="cordage-corps">
            <strong>${h(c.marque || 'Cordage')}</strong>
            ${c.tension ? `<span class="muted">${h(c.tension)}</span>` : ''}
            <div class="match-bas">
              ${puce(nomCause(c.cause), c.cause === 'casse' ? 'puce-fort' : '')}
              ${r ? `<span class="muted">${h(r.marque)} ${h(r.modele)}</span>` : ''}
              ${c.note ? `<span class="muted">${h(c.note)}</span>` : ''}
            </div>
          </div>
        </li>`;
      }).join('')}
    </ul>

    <div class="rangee-boutons" style="justify-content:center">
      <button class="btn" data-ajout-cordage>Noter un cordage</button>
    </div>`;
}

// =====================================================================
//  Chaussures
// =====================================================================
function vueChaussures() {
  if (!store.chaussures.length) {
    return `<div class="vide"><span class="emoji">👟</span>
      Aucune paire enregistrée.
      <div class="rangee-boutons" style="justify-content:center;margin-top:14px">
        <button class="btn btn-primary" data-ajout-chaussure>Ajouter une paire</button>
      </div></div>`;
  }

  const enCours = store.chaussures.filter(c => !c.dateFin);
  const finies = store.chaussures.filter(c => c.dateFin);

  const carte = (c) => {
    const jours = c.dateAchat
      ? Math.round((new Date(c.dateFin || Date.now()) - new Date(c.dateAchat)) / 86400000)
      : null;
    return `<li class="course" data-modif-chaussure="${h(c.id)}">
      <span class="course-icone">👟</span>
      <span class="course-nom">
        ${h(c.marque)} ${h(c.modele)}
        <small class="muted">
          ${c.surface ? `${h(c.surface)} · ` : ''}
          ${c.dateAchat ? `depuis le ${h(dateLongue(c.dateAchat))}` : ''}
          ${jours != null ? ` · ${jours} jours` : ''}
        </small>
      </span>
    </li>`;
  };

  return `
    ${enCours.length ? `<section class="carte">
      <h3>En service</h3>
      <ul class="courses">${enCours.map(carte).join('')}</ul>
    </section>` : ''}
    ${finies.length ? `<section class="carte">
      <h3>Au rebut</h3>
      <ul class="courses">${finies.map(carte).join('')}</ul>
    </section>` : ''}
    <div class="rangee-boutons" style="justify-content:center">
      <button class="btn" data-ajout-chaussure>Ajouter une paire</button>
    </div>`;
}

// =====================================================================
//  Branchements
// =====================================================================
export function wire(vue, rerendre) {
  /* Le bloc de sauvegarde ne se branche que là où il est affiché : les
     autres onglets ne le contiennent pas, et brancher dans le vide
     lèverait une erreur sur un `querySelector` qui ne trouve rien. */
  if (onglet === 'moi') {
    brancherDonnees(vue);
    brancherProfil(vue);
  }
  vue.addEventListener('click', async e => {
    const ry = e.target.closest('[data-rayon]');
    if (ry) { rayon = ry.dataset.rayon; rerendre(); return; }

    const o = e.target.closest('[data-onglet]');
    if (o) { onglet = o.dataset.onglet; rerendre(); return; }

    if (e.target.closest('[data-identite]')) { identiteForm(); return; }
    if (e.target.closest('[data-profil]')) { profilForm(); return; }
    if (e.target.closest('[data-bareme]')) { baremeForm(); return; }

    if (e.target.closest('[data-situer-lieux]')) {
      const b = e.target.closest('[data-situer-lieux]');
      b.disabled = true;
      b.textContent = 'recherche…';
      const trouve = {};
      for (const cle of ['domicile', 'bureau']) {
        const l = store.profil?.[cle];
        if (!l?.adresse || l.point) continue;
        const r = await situer(l.adresse);
        if (r.ok) trouve[cle] = { ...l, point: r.point, libelle: r.libelle };
      }
      const n = Object.keys(trouve).length;
      if (n) {
        maj(s => { s.profil = { ...s.profil, ...trouve }; });
        toast(n > 1 ? 'Les deux adresses sont sur la carte.' : 'Adresse placée sur la carte.');
      } else {
        toast('Adresse introuvable — ajoute la commune et le code postal.');
      }
      rerendre();
      return;
    }
    if (e.target.closest('[data-depense]')) { depenseForm(); return; }

    const sr = e.target.closest('[data-saison-route]');
    if (sr) { saisonRoute = sr.dataset.saisonRoute; rerendre(); return; }

    const rt = e.target.closest('[data-route]');
    if (rt) { detailRoute(rt.dataset.route); return; }

    const ar = e.target.closest('[data-argent]');
    if (ar) { detailArgent(ar.dataset.argent); return; }

    const dep = e.target.closest('[data-depense-id]');
    if (dep) {
      const x = (store.depenses || []).find(y => y.id === dep.dataset.depenseId);
      if (x) depenseForm(x);
      return;
    }

    const c = e.target.closest('[data-cocher]');
    if (c) { basculerAchat(c.dataset.cocher); return; }

    const oc = e.target.closest('[data-ouvrir-course]');
    if (oc) {
      const a = store.courses.find(x => x.id === oc.dataset.ouvrirCourse);
      if (a) courseForm(a);
      return;
    }

    if (e.target.closest('[data-ranger]')) {
      if (await confirmer('Ranger la liste ?',
          'Les articles récurrents se décochent et restent. Les autres disparaissent.')) {
        rangerCourses();
        toast('Liste rangée.');
      }
      return;
    }

    if (e.target.closest('[data-trousse]')) {
      for (const a of TROUSSE_TYPE) {
        coursesCRUD.ajouter({ ...a, achete: false, recurrent: true, note: '', dateAchat: '' });
      }
      toast(`${TROUSSE_TYPE.length} articles ajoutés — retire ce qui ne te sert pas.`);
      return;
    }

    if (e.target.closest('[data-ajout-course]'))    { courseForm(); return; }
    if (e.target.closest('[data-ajout-raquette]'))  { raquetteForm(); return; }
    if (e.target.closest('[data-ajout-cordage]'))   { cordageForm(); return; }
    if (e.target.closest('[data-ajout-chaussure]')) { chaussureForm(); return; }

    const mr = e.target.closest('[data-modif-raquette]');
    if (mr) { raquetteForm(store.raquettes.find(x => x.id === mr.dataset.modifRaquette)); return; }

    const ca = e.target.closest('[data-casse]');
    if (ca) { cordageForm(null, ca.dataset.casse); return; }

    const mc = e.target.closest('[data-modif-cordage]');
    if (mc) { cordageForm(store.cordages.find(x => x.id === mc.dataset.modifCordage)); return; }

    const mch = e.target.closest('[data-modif-chaussure]');
    if (mch) { chaussureForm(store.chaussures.find(x => x.id === mch.dataset.modifChaussure)); return; }
  });
}
