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

import { h, dateCourte, dateLongue, puce, confirmer, toast } from '../util.js';
import { store, basculerAchat, rangerCourses, courses as coursesCRUD, raquetteDe,
         clubDuMatch, CATEGORIES_DEPENSE, nomCategorieDepense, maj } from '../store.js';
import { pointDuClub } from '../carte.js';
import { distanceKm, situer } from '../geocodage.js';
import {
  CATEGORIES_COURSES, TROUSSE_TYPE, nomCause,
  statsCordages, ageCordage, dureesDeVie,
} from '../materiel.js';
import { courseForm, raquetteForm, cordageForm, chaussureForm, depenseForm,
         identiteForm, profilForm } from '../forms.js';

let onglet = 'moi';

const ONGLETS = [
  { cle: 'moi',        emoji: '🪪', nom: 'Moi' },
  { cle: 'courses',    emoji: '🛒', nom: 'Courses' },
  { cle: 'argent',     emoji: '💶', nom: 'Argent' },
  { cle: 'raquettes',  emoji: '🎾', nom: 'Raquettes' },
  { cle: 'cordages',   emoji: '🪢', nom: 'Cordages' },
  { cle: 'chaussures', emoji: '👟', nom: 'Chaussures' },
];

export function render() {
  const barre = `<div class="segments segments-defile">
    ${ONGLETS.map(o => `<button data-onglet="${o.cle}" style="flex:1"
      class="${onglet === o.cle ? 'actif' : ''}">${o.emoji} ${h(o.nom)}</button>`).join('')}
  </div>`;

  const corps = { moi: vueMoi, courses: vueCourses, argent: vueArgent, raquettes: vueRaquettes,
                  cordages: vueCordages, chaussures: vueChaussures }[onglet]();

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

function vueMoi() {
  const p = store.profil;
  const nomComplet = [p.prenom, p.nom].filter(Boolean).join(' ');
  const infos = [
    ligneInfo('🪪', 'Licence', p.licence),
    ligneInfo('🏟️', 'Mon club', p.clubPrincipal),
    ligneInfo('📞', 'Téléphone', p.telephone, p.telephone ? `tel:${p.telephone.replace(/\s/g, '')}` : ''),
    ligneInfo('✉️', 'E-mail', p.mail, p.mail ? `mailto:${p.mail}` : ''),
    ligneInfo('🎂', 'Naissance', p.naissance ? dateCourte(p.naissance) : ''),
  ].filter(Boolean).join('');

  const lieu = (emoji, libelle, l) => !l?.adresse ? '' :
    `<li><span class="fiche-emoji">${emoji}</span>
      <div><span class="tiny muted">${h(libelle)}</span><br>${h(l.libelle || l.adresse)}
      ${l.point ? '' : ' <em class="tiny muted">(pas situé sur la carte)</em>'}</div></li>`;

  const lieux = lieu('🏠', 'Domicile', p.domicile) + lieu('💼', 'Travail', p.bureau);

  /* Une adresse écrite mais jamais situées n'apparaît sur aucune carte, et
     rien ne le dit assez fort : on croit la fonction en panne alors qu'il
     manque une recherche d'un dixième de seconde. Le bouton la lance ici,
     sans rouvrir le formulaire. */
  const aSituer = [p.domicile, p.bureau].filter(l => l?.adresse && !l.point).length;

  return `
    <section class="carte">
      <div class="fiche-tete">
        <div>
          <h2>${h(nomComplet || 'Moi')}</h2>
          <p class="tiny muted">${h(p.echelon)}${p.gaucher ? ' · gaucher' : ''}${
            p.sexe === 'f' ? ' · barème dames' : ''}</p>
        </div>
        <button class="btn btn-ghost" data-identite>Modifier</button>
      </div>
      ${infos ? `<ul class="fiche-infos">${infos}</ul>`
        : `<p class="tiny muted">Rien de renseigné. Le numéro de licence est ce qu'on
           cherche le plus souvent, debout au club, au moment de s'inscrire.</p>`}
    </section>

    <section class="carte">
      <div class="fiche-tete">
        <div><h3>D'où je pars</h3></div>
        <button class="btn btn-ghost" data-profil>Régler</button>
      </div>
      ${lieux ? `<ul class="fiche-infos">${lieux}</ul>`
        : `<p class="tiny muted">Aucune adresse. Renseigne ton domicile et le carnet saura
           dire quels clubs sont à côté, et combien de kilomètres tu fais pour aller
           jouer.</p>`}
      ${aSituer ? `<p class="tiny muted">${aSituer > 1
          ? 'Ces adresses ne sont pas encore placées sur la carte.'
          : "Cette adresse n'est pas encore placée sur la carte."}</p>
        <button class="btn btn-ghost" data-situer-lieux>📍 Placer sur la carte</button>` : ''}
      ${p.coutKm ? `<p class="tiny muted">Coût du kilomètre réglé à ${p.coutKm} €.</p>` : ''}
    </section>

    <section class="carte">
      <div class="fiche-tete">
        <div><h3>Mon classement</h3></div>
        <button class="btn btn-ghost" data-profil>Régler</button>
      </div>
      <ul class="fiche-infos">
        <li><span class="fiche-emoji">🏅</span><div>
          <span class="tiny muted">Échelon</span><br>${h(p.echelon)}</div></li>
      </ul>
      <p class="tiny muted">Le détail du calcul et les projections se lisent dans l'onglet
        Classement, en bas.</p>
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

/** Les kilomètres parcourus pour aller jouer, club par club. */
function deplacements() {
  const chez = store.profil?.domicile?.point;
  if (!chez) return null;

  const parClub = new Map();
  for (const m of store.matchs) {
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

function vueArgent() {
  const saisies = [...(store.depenses || [])]
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const total = saisies.reduce((t, d) => t + (Number(d.montant) || 0), 0);

  const parCat = {};
  for (const d of saisies) {
    parCat[d.categorie] = (parCat[d.categorie] || 0) + (Number(d.montant) || 0);
  }

  const route = deplacements();
  const tarif = Number(store.profil?.coutKm) || 0;

  return `
    <section class="chiffres">
      <div class="chiffre"><b>${euros(total)}</b><span>dépenses notées</span></div>
      <div class="chiffre"><b>${saisies.length}</b><span>lignes</span></div>
      ${route ? `<div class="chiffre"><b>${Math.round(route.kmTotal)}</b>
        <span>km estimés</span></div>` : ''}
      ${route && tarif ? `<div class="chiffre"><b>${euros(route.kmTotal * tarif)}</b>
        <span>de route estimés</span></div>` : ''}
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
        confondus : la distance de chez toi à chaque club, comptée aller-retour et
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
        ${route.lignes.slice(0, 8).map(x => `<li>
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
  vue.addEventListener('click', async e => {
    const o = e.target.closest('[data-onglet]');
    if (o) { onglet = o.dataset.onglet; rerendre(); return; }

    if (e.target.closest('[data-identite]')) { identiteForm(); return; }
    if (e.target.closest('[data-profil]')) { profilForm(); return; }

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
