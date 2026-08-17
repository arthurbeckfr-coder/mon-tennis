/* Le sac : ce qu'il faut acheter, et ce avec quoi on joue.

   Quatre sujets sous un même toit parce qu'ils se pensent au même moment —
   la veille d'un tournoi, quand on prépare son sac. Un seul est affiché à
   la fois : une liste de courses et un historique de cordages n'ont rien à
   se dire, les empiler ne ferait que rallonger le défilement. */

import { h, dateCourte, dateLongue, puce, confirmer, toast } from '../util.js';
import { store, basculerAchat, rangerCourses, courses as coursesCRUD, raquetteDe } from '../store.js';
import {
  CATEGORIES_COURSES, TROUSSE_TYPE, nomCause,
  statsCordages, ageCordage, dureesDeVie,
} from '../materiel.js';
import { courseForm, raquetteForm, cordageForm, chaussureForm } from '../forms.js';

let onglet = 'courses';

const ONGLETS = [
  { cle: 'courses',    emoji: '🛒', nom: 'Courses' },
  { cle: 'raquettes',  emoji: '🎾', nom: 'Raquettes' },
  { cle: 'cordages',   emoji: '🪢', nom: 'Cordages' },
  { cle: 'chaussures', emoji: '👟', nom: 'Chaussures' },
];

export function render() {
  const barre = `<div class="segments" style="width:100%;margin-bottom:14px">
    ${ONGLETS.map(o => `<button data-onglet="${o.cle}" style="flex:1"
      class="${onglet === o.cle ? 'actif' : ''}">${o.emoji} ${h(o.nom)}</button>`).join('')}
  </div>`;

  const corps = { courses: vueCourses, raquettes: vueRaquettes,
                  cordages: vueCordages, chaussures: vueChaussures }[onglet]();

  return barre + corps;
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
