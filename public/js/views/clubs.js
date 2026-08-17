/* Les clubs où j'ai joué.

   La liste n'est pas saisie à la main : elle se déduit des matchs. Un club
   qu'on a fréquenté quatorze fois n'a pas à être ressaisi, et un club où
   l'on n'est jamais allé n'a rien à faire ici.

   Le rattachement d'un match à un club se fait sur le libellé de l'épreuve,
   qui est la seule chose que la fédération conserve. C'est imparfait et il
   faut le dire : « TOURNOI SENIORS » ne nomme personne, et un championnat
   par équipes se joue une fois chez soi et une fois ailleurs sans que ce
   soit écrit nulle part. D'où le bloc des épreuves orphelines en bas de
   page — non pour s'excuser, mais parce que c'est là qu'on répare.

   Cette fiche absorbe aussi les comptes de réseaux sociaux, qui vivaient
   sur un écran séparé : un club, c'est son adresse et son juge-arbitre et
   sa page Facebook. Trois écrans pour une même chose n'aidaient personne. */

import { h, dateCourte, puce, confirmer, toast } from '../util.js';
import {
  store, matchsDuClub, epreuvesOrphelines, bilanMatchs, positionMot,
  supprimerClub, ajouterClub, modifierClub, modifierMatch, clubDuMatch,
  estParEquipes, PLATEFORMES,
} from '../store.js';
import { clubConnuPour, MOTS_EN_PLUS, LIENS_CONNUS, urlTenupClub } from '../clubs-connus.js';
import { clubForm, matchForm } from '../forms.js';

/* ─── Les rattachements proposés ───────────────────────────────────────

   Une épreuve sans club n'est pas toujours une énigme : « TOURNOI OPEN
   MSA TC » nomme son organisateur, encore faut-il savoir que MSA TC est
   le club de Mont-Saint-Aignan. Le carnet le sait maintenant (voir
   clubs-connus.js) et le propose, sans jamais l'appliquer tout seul.

   Deux réparations possibles, et une seule s'affiche à la fois :
   ajouter le mot-clé manquant à un club qu'on a déjà, ou créer le club
   absent avec son adresse. Dans les deux cas les matchs se rattachent
   ensuite d'eux-mêmes, par le mécanisme habituel des mots-clés — rien
   n'est écrit dans les matchs, ce qui rend le geste réversible d'un
   changement de mot-clé. */
function propositions(orphelines) {
  const dejaConnu = mot => store.clubs.some(c =>
    (c.motsCles || []).some(x => x.toUpperCase() === mot.toUpperCase()));

  const liste = [];

  /* Une proposition par club, et non par mot-clé : Mont-Saint-Aignan
     s'écrit « MSA TC » une année et « MSATC » la suivante, ce qui ferait
     deux lignes proposant de créer deux fois le même club — dont la
     seconde n'aurait plus de sens une fois la première appliquée. On
     rassemble donc les graphies, et un seul geste les pose toutes. */
  for (const [nom, n] of orphelines) {
    const trouve = clubConnuPour(nom);
    if (!trouve || dejaConnu(trouve.mot)) continue;

    const cle = trouve.club.nom;
    const deja = liste.find(x => x.cle === cle);
    if (deja) {
      deja.matchs += n;
      if (!deja.mots.includes(trouve.mot)) deja.mots.push(trouve.mot);
      if (!deja.epreuves.includes(nom)) deja.epreuves.push(nom);
      continue;
    }

    const existant = store.clubs.find(c =>
      c.nom.toUpperCase() === trouve.club.nom.toUpperCase());

    liste.push({ cle, epreuves: [nom], matchs: n, mots: [trouve.mot],
                 connu: trouve.club, existant: existant || null });
  }

  /* Les mots-clés à greffer sur un club déjà présent — « TOUT VA BIEN »
     pour Dieppe : rien dans ces trois mots ne le laisse deviner. */
  for (const { club, mots } of MOTS_EN_PLUS) {
    const cible = store.clubs.find(c => (c.motsCles || [])
      .some(x => x.toUpperCase() === club.toUpperCase()));
    if (!cible) continue;
    for (const mot of mots) {
      if (dejaConnu(mot)) continue;
      const touchees = orphelines.filter(([nom]) => positionMot(nom, mot) >= 0);
      if (!touchees.length) continue;
      liste.push({
        cle: cible.nom + '|' + mot,
        epreuves: touchees.map(([nom]) => nom),
        matchs: touchees.reduce((t, [, n]) => t + n, 0),
        mots: [mot], connu: null, existant: cible,
      });
    }
  }

  /* Les pages publiques qui manquent à un club qu'on a déjà. Un club sans
     lien n'est pas un club incomplet par choix : c'est simplement que
     l'import de la fédération ne donne aucune page, et que personne ne va
     les chercher à la main. */
  for (const { club, sources } of LIENS_CONNUS) {
    const cible = store.clubs.find(c => c.nom.toUpperCase() === club.toUpperCase());
    if (!cible) continue;
    const dejaLa = new Set((cible.sources || []).map(s => (s.url || '').toLowerCase()));
    const manquants = sources.filter(s => !dejaLa.has(s.url.toLowerCase()));
    if (!manquants.length) continue;
    liste.push({
      cle: 'liens|' + cible.nom,
      liens: manquants,
      existant: cible,
      epreuves: [], matchs: 0, mots: [], connu: null,
    });
  }

  return liste;
}

const infoPlateforme = cle => PLATEFORMES.find(p => p.cle === cle) || { emoji: '🔗', nom: cle };

const carteMaps = adresse =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adresse)}`;

// =====================================================================
//  Les tris
// =====================================================================
/* Une liste de clubs ne se lit pas toujours dans le même ordre. « Où
   est-ce que je joue » se lit par nombre de matchs, « où est-ce que je
   gagne » par taux de victoires, « où ne suis-je pas retourné depuis
   deux ans » par dernière visite. Un ordre unique répondrait à une
   question sur trois.

   Chaque tri affiche le chiffre sur lequel il trie : trier sur un nombre
   qu'on ne voit pas, c'est demander de croire sur parole.

   Le taux de victoires se départage par le nombre de matchs, et c'est ce
   qui compte le plus dans ce tri : 100 % sur un match unique n'est pas
   un fort, et n'a rien à faire devant un club où l'on gagne trois fois
   sur quatre depuis quatorze matchs. */
let tri = 'matchs';

/* L'épreuve orpheline dont on regarde les matchs. Une seule à la fois :
   deux listes ouvertes se compareraient mal et rallongeraient l'écran
   pour rien. */
let epreuveOuverte = null;

const pluriel = n => `${n} match${n > 1 ? 's' : ''}`;

const TRIS = [
  { cle: 'matchs', nom: 'fréquentation',
    gros: c => String(c.matchs.length),
    petit: c => `${c.bilan.v}V–${c.bilan.d}D`,
    comparer: (a, b) => b.matchs.length - a.matchs.length },

  { cle: 'victoires', nom: 'mes victoires',
    gros: c => String(c.bilan.v),
    petit: c => `sur ${pluriel(c.matchs.length)}`,
    comparer: (a, b) => b.bilan.v - a.bilan.v || b.matchs.length - a.matchs.length },

  { cle: 'reussite', nom: 'mon taux de victoires',
    gros: c => c.matchs.length ? `${c.bilan.ratio}%` : '—',
    petit: c => c.matchs.length ? `${c.bilan.v}V–${c.bilan.d}D` : 'jamais joué',
    comparer: (a, b) => b.bilan.ratio - a.bilan.ratio || b.matchs.length - a.matchs.length },

  { cle: 'recent', nom: 'ma dernière visite',
    gros: c => String(c.matchs.length),
    petit: c => c.derniere ? dateCourte(c.derniere) : 'jamais',
    comparer: (a, b) => (b.derniere || '').localeCompare(a.derniere || '') },

  { cle: 'surfaces', nom: 'nombre de surfaces',
    gros: c => String((c.club.surfaces || []).length || '—'),
    petit: c => `${pluriel(c.matchs.length)}`,
    comparer: (a, b) => (b.club.surfaces || []).length - (a.club.surfaces || []).length ||
                        b.matchs.length - a.matchs.length },

  { cle: 'nom', nom: 'nom (A→Z)',
    gros: c => String(c.matchs.length),
    petit: c => `${c.bilan.v}V–${c.bilan.d}D`,
    comparer: (a, b) => a.club.nom.localeCompare(b.club.nom, 'fr') },
];

const triCourant = () => TRIS.find(t => t.cle === tri) || TRIS[0];

const barreTri = () => `<section class="barre-filtres">
  <label class="tri">
    <span>Trier par</span>
    <select id="tri-club">
      ${TRIS.map(t => `<option value="${t.cle}"${t.cle === tri ? ' selected' : ''}
        >${h(t.nom)}</option>`).join('')}
    </select>
  </label>
</section>`;

// =====================================================================
//  La liste
// =====================================================================
export function render() {
  const t = triCourant();
  const clubs = [...store.clubs]
    .map(c => {
      const matchs = matchsDuClub(c);
      // `matchsDuClub` rend les matchs du plus récent au plus ancien.
      return { club: c, matchs, bilan: bilanMatchs(matchs), derniere: matchs[0]?.date || '' };
    })
    // Le nom départage en dernier ressort : sans lui, deux clubs à égalité
    // s'échangeraient de place d'un affichage à l'autre.
    .sort((a, b) => t.comparer(a, b) || a.club.nom.localeCompare(b.club.nom, 'fr'));

  /* Toutes les épreuves sans club ne sont pas des oublis. Une rencontre
     par équipes se joue une journée chez soi et la suivante chez
     l'adversaire : elle n'appartient à aucun club, et la ranger parmi les
     choses à réparer faisait afficher un chantier permanent qu'aucun
     mot-clé ne pouvait clore. On les sépare donc, et on ne compte comme
     « à rattacher » que ce qui peut l'être. */
  const orphelinesToutes = epreuvesOrphelines();
  const orphelines = orphelinesToutes.filter(([nom]) => !estParEquipes({ tournoi: nom }));
  const equipes = orphelinesToutes.filter(([nom]) => estParEquipes({ tournoi: nom }));

  const sansClub = orphelinesToutes.reduce((t, [, n]) => t + n, 0);
  const aRattacher = orphelines.reduce((t, [, n]) => t + n, 0);
  const nEquipes = equipes.reduce((t, [, n]) => t + n, 0);

  if (!store.clubs.length) {
    return `<div class="vide">
      <span class="emoji">🏟️</span>
      Aucun club enregistré.
      <div class="rangee-boutons" style="justify-content:center;margin-top:14px">
        <button class="btn btn-primary" data-nouveau>Ajouter un club</button>
      </div>
    </div>`;
  }

  return `
    <section class="chiffres">
      <div class="chiffre"><b>${store.clubs.length}</b><span>clubs</span></div>
      <div class="chiffre"><b>${store.matchs.length - sansClub}</b><span>matchs situés</span></div>
      <div class="chiffre ${tri === 'surfaces' ? 'actif' : ''}" data-tri-vers="surfaces"
        title="Ranger les clubs par nombre de surfaces"
        ><b>${new Set(store.clubs.flatMap(c => c.surfaces || [])).size}</b>
        <span>surfaces</span></div>
      <div class="chiffre" data-aller="orphelines" title="Voir ces épreuves"
        ><b>${aRattacher}</b><span>à rattacher</span></div>
    </section>

    ${nEquipes ? `<p class="tiny muted" style="margin:0 4px 10px">Plus ${nEquipes} match(s)
      de championnat par équipes, qui n'ont volontairement pas de club : une journée se
      joue chez soi, la suivante chez l'adversaire. Leur bilan se lit dans les
      <a href="#/">statistiques</a>.</p>` : ''}

    ${store.clubs.length > 1 ? barreTri() : ''}

    <ul class="clubs">
      ${clubs.map(c => `<li class="club-ligne" data-club="${h(c.club.id)}">
          <div class="club-corps">
            <strong>${h(c.club.nom)}</strong>
            <div class="club-bas">
              ${c.club.ville ? `<span>${h(c.club.ville)}</span>` : ''}
              ${(c.club.surfaces || []).map(s => puce(s)).join('')}
              ${c.club.jugeArbitre ? `<span class="muted">JA ${h(c.club.jugeArbitre)}</span>` : ''}
            </div>
          </div>
          <div class="club-score">
            <b>${h(t.gros(c))}</b>
            <span class="tiny muted">${h(t.petit(c))}</span>
          </div>
        </li>`).join('')}
    </ul>

    <div class="rangee-boutons" style="justify-content:center">
      <button class="btn" data-nouveau>Ajouter un club</button>
    </div>

    ${(() => {
      const props = propositions(orphelines);
      if (!props.length) return '';
      const total = props.reduce((t, p) => t + p.matchs, 0);
      const nLiens = props.filter(p => p.liens).length;
      return `<section class="carte carte-verte">
        <h3>${total ? `${total} match(s) rattachables` : 'Des fiches à compléter'}${
          total && nLiens ? ', et des fiches à compléter' : ''}</h3>
        <p class="tiny muted">Ces épreuves nomment leur club, mais sous un sigle que ton
          carnet ne connaît pas encore. Rien n'est appliqué avant que tu cliques, et tout
          reste modifiable ensuite depuis la fiche du club.</p>
        <ul class="propositions">
          ${props.map(p => `<li>
            <div>
              <strong>${h(p.existant ? p.existant.nom : p.connu.nom)}</strong>
              ${p.existant ? '' : '<span class="puce">à créer</span>'}
              ${p.liens ? `<div class="tiny muted">Ajouter
                ${p.liens.map(s => h(s.plateforme === 'facebook' ? 'sa page Facebook'
                  : s.plateforme === 'instagram' ? 'son Instagram' : 'son site')).join(' et ')}
                — trouvé${p.liens.length > 1 ? 's' : ''} sur une page publique au nom du
                club.</div>` : `
              <div class="tiny muted">${h(p.epreuves[0])}${p.epreuves.length > 1
                ? ` et ${p.epreuves.length - 1} autre(s) épreuve(s)` : ''} —
                ${p.matchs} match${p.matchs > 1 ? 's' : ''}, reconnu${p.mots.length > 1
                  ? 's aux mots' : ' au mot'} ${p.mots.map(x => `« ${h(x)} »`).join(', ')}</div>
              ${p.connu?.adresse ? `<div class="tiny muted">${h(p.connu.adresse)}</div>` : ''}
              ${p.connu && !p.connu.adresse ? `<div class="tiny muted">Adresse inconnue :
                aucune source publique fiable, à compléter toi-même plutôt que de
                l'inventer.</div>` : ''}`}
            </div>
            <button class="btn btn-primary" data-rattacher="${h(p.cle)}">
              ${p.liens ? 'Ajouter les liens' : p.existant ? 'Ajouter le mot' : 'Créer le club'}</button>
          </li>`).join('')}
        </ul>
        <p class="tiny muted">Ces adresses viennent des pages publiques de chaque club, et
          non de Ten'Up — le site de la fédération exige une connexion et n'ouvre aucun
          accès aux applications extérieures.</p>
      </section>`;
    })()}

    ${orphelines.length ? `<section class="carte" id="orphelines">
      <h3>${aRattacher} match(s) sans club</h3>
      <p class="tiny muted">La fédération ne dit pas toujours où l'on a joué :
        « TOURNOI SENIORS » ne nomme personne, et aucune recherche n'y changera rien.
        Mais la date et l'adversaire, eux, font souvent revenir le lieu — touche une
        épreuve pour voir ses matchs. Les rencontres par équipes ne figurent pas ici :
        elles n'ont pas de club à trouver.</p>
      <ul class="orphelines">
        ${orphelines.map(([nom, n]) => `<li class="orpheline ${nom === epreuveOuverte
            ? 'actif' : ''}" data-epreuve="${h(nom)}" role="button" tabindex="0"
            title="Voir ces matchs">
          <span>${h(nom)}</span><b>${n}</b>
        </li>${nom === epreuveOuverte ? rendreMatchsOrphelins(nom) : ''}`).join('')}
      </ul>
    </section>` : ''}`;
}

/* ─── Les matchs d'une épreuve sans club ───────────────────────────────

   Un libellé anonyme ne dit rien, mais « 14 juillet 2019, Théo MARTIN,
   6/4 6/2 » fait revenir le lieu — on se souvient d'un adversaire et d'un
   été bien mieux que d'un intitulé de tournoi. C'est donc au souvenir
   qu'on s'adresse ici, faute de données.

   Le rattachement en bloc n'est offert que si tous les matchs tombent la
   même année. Un « TOURNOI SENIORS » qui traîne sur six saisons s'est
   presque sûrement joué dans plusieurs clubs, et l'attribuer d'un coup
   installerait sept erreurs en un clic — plus difficiles à défaire qu'à
   commettre. Dans ce cas chaque match s'ouvre séparément. */
function rendreMatchsOrphelins(nom) {
  const liste = store.matchs
    .filter(m => !clubDuMatch(m) && (m.tournoi || '(sans nom)').trim() === nom)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  if (!liste.length) return '';

  const b = bilanMatchs(liste);
  const annees = [...new Set(liste.map(m => (m.date || '').slice(0, 4)))].filter(Boolean);
  const memeAnnee = annees.length === 1;

  return `<li class="orphelines-detail">
    <p class="tiny muted">${b.v} victoire(s), ${b.d} défaite(s) —
      ${memeAnnee ? `tout en ${h(annees[0])}`
                  : `réparti sur ${annees.length} années (${h(annees.join(', '))})`}.</p>
    <ul class="matchs" style="margin-top:8px">
      ${liste.map(m => `<li class="match ${m.issue === 'V' ? 'gagne' : 'perdu'}"
          data-match="${h(m.id)}">
        <div class="match-issue">${m.issue}</div>
        <div class="match-corps">
          <div class="match-tete">
            <strong>${h(m.adversaire || '—')}</strong>${puce(m.echelonAdverse)}
          </div>
          <div class="match-bas">
            <span>${h(dateCourte(m.date))}</span>
            ${m.score ? `<span>${h(m.score)}</span>` : ''}
            ${m.surface ? puce(m.surface) : ''}
          </div>
        </div>
      </li>`).join('')}
    </ul>
    ${memeAnnee && store.clubs.length ? `<label class="tri" style="margin-top:10px">
      <span>Tout rattacher à</span>
      <select data-rattacher-tout="${h(nom)}">
        <option value="">— choisir un club —</option>
        ${[...store.clubs].sort((x, y) => x.nom.localeCompare(y.nom, 'fr'))
          .map(c => `<option value="${h(c.id)}">${h(c.nom)}</option>`).join('')}
      </select>
    </label>
    <p class="tiny muted">Ce rattachement se pose sur les matchs eux-mêmes, et non sur un
      mot-clé : il ne vaut que pour ces ${liste.length} matchs, et se défait match par
      match.</p>`
    : `<p class="tiny muted">${memeAnnee ? '' : 'Ces matchs s\'étalant sur plusieurs années, '
      }le rattachement en bloc n'est pas proposé : touche un match pour lui donner son
      club, un par un.</p>`}
  </li>`;
}

// =====================================================================
//  La fiche
// =====================================================================
export function renderFiche(params) {
  const club = store.clubs.find(c => c.id === params[1]);
  if (!club) return `<div class="vide"><span class="emoji">🤷</span>Ce club n'existe plus.</div>`;

  const matchs = matchsDuClub(club);
  const b = bilanMatchs(matchs);

  const lignes = [
    club.adresse ? ['📍', `<a href="${h(carteMaps(club.adresse))}" target="_blank"
                            rel="noopener noreferrer">${h(club.adresse)}</a>`] : null,
    club.telephone ? ['📞', `<a href="tel:${h(club.telephone.replace(/\s/g, ''))}">${h(club.telephone)}</a>`] : null,
    club.mail ? ['✉️', `<a href="mailto:${h(club.mail)}">${h(club.mail)}</a>`] : null,
    club.jugeArbitre ? ['⚖️', (() => {
      // Le juge principal n'a rien à faire dans la liste des autres.
      const autres = (club.autresJuges || []).filter(j => j && j !== club.jugeArbitre);
      return `Juge-arbitre : <strong>${h(club.jugeArbitre)}</strong>${autres.length
        ? ` <span class="muted">(aussi croisé : ${h(autres.join(', '))})</span>` : ''}`;
    })()] : null,
    (club.surfaces || []).length ? ['🎾', `${club.surfaces.length > 1 ? 'Surfaces' : 'Surface'} :
      ${club.surfaces.map(s => puce(s)).join(' ')}`] : null,
    club.installations ? ['🏟️', h(club.installations)] : null,
    club.note ? ['📝', h(club.note)] : null,
  ].filter(Boolean);

  return `
    <section class="carte">
      <div class="fiche-tete">
        <div>
          <h2>${h(club.nom)}</h2>
          ${club.ville ? `<p class="muted tiny">${h(club.ville)}</p>` : ''}
        </div>
        <button class="btn btn-ghost" data-modifier>Modifier</button>
      </div>
      <ul class="fiche-infos">
        ${lignes.map(([e, t]) => `<li><span class="fiche-emoji">${e}</span><div>${t}</div></li>`).join('')}
      </ul>
      ${!club.telephone ? `<p class="tiny muted">Le téléphone n'est pas publié sur Ten'Up :
        c'est à toi de l'ajouter une fois pour toutes.</p>` : ''}
    </section>

    ${((club.sources || []).length || urlTenupClub(club)) ? `<section class="carte">
      <h3>Suivre ce club</h3>
      <ul class="comptes">
        ${(club.sources || []).map(s => {
          const p = infoPlateforme(s.plateforme);
          return `<li><a href="${h(s.url)}" target="_blank" rel="noopener noreferrer">
            <span class="gros-emoji">${p.emoji}</span>
            <span class="compte-nom">${h(p.nom)}</span></a></li>`;
        }).join('')}
        ${/* La fiche officielle, déduite de l'identifiant posé par l'import.
              Sans identifiant, aucun lien : on n'invente pas une adresse. */
          urlTenupClub(club) ? `<li>
          <a href="${h(urlTenupClub(club))}" target="_blank" rel="noopener noreferrer">
            <span class="gros-emoji">🎾</span>
            <span class="compte-nom">Ten'Up</span></a></li>` : ''}
      </ul>
    </section>` : ''}

    <section class="carte">
      <h3>Mes matchs ici</h3>
      ${matchs.length ? `
        <p class="tiny muted">${matchs.length} match(s) — ${b.v} victoire(s),
           ${b.d} défaite(s), ${b.ratio}% de réussite.</p>
        <ul class="matchs" style="margin-top:10px">
          ${matchs.map(m => `<li class="match ${m.issue === 'V' ? 'gagne' : 'perdu'}"
                                data-match="${h(m.id)}">
            <div class="match-issue">${m.issue}</div>
            <div class="match-corps">
              <div class="match-tete">
                <strong>${h(m.adversaire || '—')}</strong>${puce(m.echelonAdverse)}
              </div>
              <div class="match-bas">
                <span>${h(dateCourte(m.date))}</span>
                ${m.score ? `<span>${h(m.score)}</span>` : ''}
                ${m.tournoi ? `<span class="muted">${h(m.tournoi)}</span>` : ''}
              </div>
            </div>
          </li>`).join('')}
        </ul>`
        : `<p class="tiny muted">Aucun match rattaché. Vérifie les mots-clés du club :
           ils sont comparés au libellé de l'épreuve.</p>`}
    </section>

    <div class="rangee-boutons">
      <button class="btn btn-danger" data-supprimer>Supprimer ce club</button>
    </div>`;
}

// =====================================================================
//  Branchements
// =====================================================================
export function wire(vue, rerendre) {
  vue.querySelector('#tri-club')?.addEventListener('change', e => {
    tri = e.target.value;
    rerendre();
  });

  /* Le rattachement en bloc pose `clubId` sur chaque match : c'est le
     rattachement explicite, qui fait foi devant les mots-clés. On ne
     touche donc à aucun autre match, et celui qui se trompe corrige
     depuis la fiche du match. */
  vue.addEventListener('change', e => {
    const sel = e.target.closest('[data-rattacher-tout]');
    if (!sel || !sel.value) return;
    const nom = sel.dataset.rattacherTout;
    const club = store.clubs.find(c => c.id === sel.value);
    const vises = store.matchs
      .filter(m => !clubDuMatch(m) && (m.tournoi || '(sans nom)').trim() === nom);
    for (const m of vises) modifierMatch(m.id, { clubId: club.id });
    epreuveOuverte = null;
    toast(`${vises.length} match(s) rattaché(s) à ${club.nom}.`);
  });

  // Une épreuve annoncée cliquable doit s'ouvrir au clavier aussi.
  vue.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const o = e.target.closest('[data-epreuve]');
    if (!o) return;
    e.preventDefault();
    o.click();
  });

  vue.addEventListener('click', e => {
    if (e.target.closest('[data-nouveau]')) { clubForm(); return; }

    /* Deux compteurs mènent quelque part, les deux autres non : le nombre
       de clubs et les matchs situés ne cachent rien qu'on ne voie déjà à
       l'écran, et une tuile qui promet une action sans en avoir vaut moins
       qu'une tuile muette. */
    const tv = e.target.closest('[data-tri-vers]');
    if (tv) { tri = tri === tv.dataset.triVers ? 'matchs' : tv.dataset.triVers; rerendre(); return; }

    if (e.target.closest('[data-aller="orphelines"]')) {
      vue.querySelector('#orphelines')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    const r = e.target.closest('[data-rattacher]');
    if (r) {
      const orphelines = epreuvesOrphelines()
        .filter(([nom]) => !estParEquipes({ tournoi: nom }));
      const p = propositions(orphelines).find(x => x.cle === r.dataset.rattacher);
      if (!p) { rerendre(); return; }

      if (p.liens) {
        modifierClub(p.existant.id, {
          sources: [...(p.existant.sources || []), ...p.liens],
        });
        toast(`${p.liens.length} lien(s) ajouté(s) à ${p.existant.nom}.`);
      } else if (p.existant) {
        modifierClub(p.existant.id, {
          motsCles: [...(p.existant.motsCles || []), ...p.mots],
        });
        toast(`${p.mots.map(m => `« ${m} »`).join(', ')} ajouté à ${p.existant.nom}.`);
      } else {
        ajouterClub({ ...p.connu, surfaces: [],
                      motsCles: [...p.connu.motsCles],
                      sources: [...(p.connu.sources || [])] });
        toast(`${p.connu.nom} créé — ${p.matchs} match(s) rattaché(s).`);
      }
      /* Pas de `rerendre()` : l'écriture émet « data-changed », qui
         redessine déjà l'écran. Le faire deux fois ferait clignoter la
         page pour rien. */
      return;
    }

    const mt = e.target.closest('[data-match]');
    if (mt) {
      const match = store.matchs.find(x => x.id === mt.dataset.match);
      if (match) matchForm(match);
      return;
    }

    const o = e.target.closest('[data-epreuve]');
    if (o) {
      // Retoucher l'épreuve ouverte la referme.
      epreuveOuverte = epreuveOuverte === o.dataset.epreuve ? null : o.dataset.epreuve;
      rerendre();
      return;
    }

    const l = e.target.closest('[data-club]');
    if (l) location.hash = `#/clubs/${l.dataset.club}`;
  });
}

export function wireFiche(vue, rerendre) {
  vue.addEventListener('click', async e => {
    const club = store.clubs.find(c => c.id === location.hash.split('/')[2]);
    if (!club) return;

    if (e.target.closest('[data-modifier]')) { clubForm(club); return; }

    const m = e.target.closest('[data-match]');
    if (m) {
      const match = store.matchs.find(x => x.id === m.dataset.match);
      if (match) matchForm(match);
      return;
    }

    if (e.target.closest('[data-supprimer]')) {
      if (await confirmer('Supprimer ce club ?',
          `${club.nom} — les matchs restent, ils redeviennent simplement sans club.`)) {
        supprimerClub(club.id);
        toast('Club supprimé.');
        location.hash = '#/clubs';
      }
    }
  });
}
