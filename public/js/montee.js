/* Ce que le carnet dit d'un classement qui bouge.

   Le simulateur répond très bien à qui vient le consulter. Le problème
   est qu'on ne le consulte pas : on note un match au bord du court, on
   range son téléphone, et l'on apprend trois semaines plus tard qu'on
   avait de quoi monter depuis la mi-mai.

   D'où ce module. Il ne calcule rien de neuf — tout vient de
   `classement.js` — mais il choisit les deux seuls moments où le carnet a
   quelque chose à dire de lui-même :

     — après une victoire, quand elle fait franchir la barre ou qu'elle en
       approche à une victoire près ;
     — à l'ouverture, quand le temps a fait son travail et que le maintien
       n'est plus couvert.

   Le reste du temps, il se tait. Une félicitation qui revient à chaque
   match n'est plus une félicitation, c'est un bandeau publicitaire. */

import { store, maj, reglagesCalcul } from './store.js';
import { simuler, direScenario, echelonSuivant } from './classement.js';
import { openModal, closeModal, toast, h } from './util.js';

/** Où en est la montée vers l'échelon juste au-dessus. */
export function etatMontee() {
  const p = store.profil;
  if (!echelonSuivant(p.echelon)) return null;   // tout en haut de l'échelle
  const r = simuler({ ...reglagesCalcul(), echelon: p.echelon });
  return r && !r.erreur ? r : null;
}

/** Où en est le maintien à l'échelon qu'on occupe. Le même calcul, visant
 *  son propre échelon : c'est ainsi que la fédération le lit. */
export function etatMaintien() {
  const p = store.profil;
  const r = simuler({ ...reglagesCalcul(), echelon: p.echelon, cible: p.echelon });
  return r && !r.erreur ? r : null;
}

/** Le chemin le plus court, dit en français, ou null s'il n'y en a pas. */
const plusCourt = r => {
  const sc = (r?.scenarios || []).slice()
    .sort((a, b) => a.matchs - b.matchs || a.cout - b.cout)[0];
  return sc ? { texte: direScenario(sc), matchs: sc.matchs } : null;
};

/** Inscrire un nouvel échelon dans le profil.
 *
 *  On demande confirmation, non par cérémonie mais parce que le geste
 *  refait tous les calculs du carnet : monté trop tôt, le simulateur
 *  répondrait à une question qu'on ne se pose pas encore. Rien n'est perdu
 *  pour autant — l'échelon se rechoisit dans le profil.
 */
export function acterMontee(cible, apres = null) {
  const avant = store.profil.echelon;
  openModal({
    title: `Passer à ${cible} ?`,
    body: `<p>Ton profil dira <strong>${h(cible)}</strong> au lieu de ${h(avant)}. Tout le
        carnet suit : les points que rapporte chaque victoire, l'écart avec tes
        adversaires, les projections.</p>
      <p class="tiny muted">À faire une fois le classement publié — d'ici là, le calcul
        reste juste tant que le profil dit ce que dit ta licence. Et cela se défait :
        l'échelon se choisit dans ton profil.</p>`,
    footer: `<button class="btn" data-non>Pas encore</button>
             <button class="btn btn-primary" data-oui>Oui, je suis ${h(cible)}</button>`,
    onMount: () => {
      const racine = document.getElementById('modal-root');
      racine.querySelector('[data-non]')?.addEventListener('click', closeModal);
      racine.querySelector('[data-oui]')?.addEventListener('click', () => {
        maj(s => { s.profil = { ...s.profil, echelon: cible }; });
        closeModal();
        toast(`Te voilà ${cible}. Bravo.`);
        apres?.();
        /* Pas de redessin ici : `maj` annonce le changement, et l'écran se
           refait de lui-même. */
      });
    },
  });
}

/* ─── Après un match ───────────────────────────────────────────────────

   Deux nouvelles méritent qu'on interrompe : « c'est fait » et « il s'en
   faut d'une victoire ». La seconde n'est annoncée que si le match qu'on
   vient d'entrer a rapproché du but — sans quoi, à sept points de la
   barre, chaque victoire sans effet sur le bilan rouvrirait la même
   fenêtre pour ne rien dire de neuf. */

/** L'état d'avant, à prendre avant d'enregistrer le match. */
export const avantMatch = () => {
  const r = etatMontee();
  return r ? { manque: r.manque, atteint: !!r.atteint } : null;
};

export function feterSiMerite(avant, apresActe = null) {
  const r = etatMontee();
  if (!r) return false;

  const progresse = !avant || r.manque < avant.manque || (r.atteint && !avant.atteint);
  if (!progresse) return false;

  if (r.atteint) {
    const preuve = r.montee?.satisfaite && r.montee.preuve;
    openModal({
      title: `🎉 Tu as de quoi passer ${r.cible}`,
      body: `<p>Ton bilan à <strong>${h(r.cible)}</strong> atteint <strong>${r.bilan}
          points</strong>, pour ${r.seuil.points} demandés, et les ${r.seuil.victoires}
          victoires exigées y sont.</p>
        ${preuve ? `<p>La victoire contre un joueur déjà classé ${h(r.cible)} est acquise
          elle aussi (${h(preuve.adversaire || 'adversaire')}) : plus rien ne s'y oppose.</p>` : ''}
        <p class="tiny muted">C'est la fédération qui publie les classements : ce carnet
          calcule, il ne décide pas. Le jour où ce sera officiel, dis-le-lui — tout le
          reste s'ajustera tout seul.</p>`,
      footer: `<button class="btn" data-non>Plus tard</button>
               <button class="btn btn-primary" data-acter>Je suis ${h(r.cible)}</button>`,
      onMount: () => {
        const racine = document.getElementById('modal-root');
        racine.querySelector('[data-non]')?.addEventListener('click', closeModal);
        racine.querySelector('[data-acter]')?.addEventListener('click', () => {
          closeModal();
          acterMontee(r.cible, apresActe);
        });
      },
    });
    return true;
  }

  const chemin = plusCourt(r);
  if (!chemin || chemin.matchs > 1) return false;

  openModal({
    title: `🔥 Plus que ${r.manque} points`,
    body: `<p>Cette victoire te laisse à <strong>${r.manque} points</strong> de
        ${h(r.cible)} — ton bilan est à ${r.bilan}, il en faut ${r.seuil.points}.</p>
      ${/* Deux conditions distinctes, et les confondre ferait une promesse
            fausse : les points peuvent tenir en une victoire alors que le
            nombre de victoires exigé en réclame encore trois. */''}
      ${r.matchsManquants > 0
        ? `<p>Côté points, <strong>une seule victoire suffit</strong> : ${h(chemin.texte)}.
           ${h(r.cible)} en exige ${r.seuil.victoires} au total, et il t'en manque
           ${r.matchsManquants} : c'est ce compte-là qui commande, maintenant.</p>`
        : `<p><strong>Une seule victoire suffit</strong> : ${h(chemin.texte)}.</p>`}`,
    footer: `<button class="btn" data-non>Fermer</button>
             <button class="btn btn-primary" data-chemins>Voir les chemins</button>`,
    onMount: () => {
      const racine = document.getElementById('modal-root');
      racine.querySelector('[data-non]')?.addEventListener('click', closeModal);
      racine.querySelector('[data-chemins]')?.addEventListener('click', () => {
        closeModal();
        location.hash = '#/classement';
      });
    },
  });
  return true;
}

/* ─── À l'ouverture ────────────────────────────────────────────────────

   Le bilan glisse sur douze mois : sans jouer un seul match, il baisse à
   mesure que les vieilles victoires sortent de la fenêtre. C'est la seule
   mauvaise nouvelle que ce carnet ait à annoncer, et il vaut mieux
   l'apprendre en ouvrant l'application qu'en lisant le classement publié.

   Une fois, pas à chaque ouverture : le témoin retient ce qui a été dit.
   Il change quand le manque change — le message revient donc si l'écart
   se creuse, et se tait tant que rien ne bouge. Il vit hors du carnet
   partagé : un rappel lu sur le téléphone n'a pas à être effacé pour
   l'ordinateur, qui, lui, ne l'a pas lu. */
const CLE_AVIS = 'tennis-avis-classement';

export function veillerAuClassement() {
  if (!store.matchs.length) return false;
  if (document.querySelector('#modal-root .modal')) return false;

  const r = etatMaintien();
  if (!r || !r.manque) return false;

  const temoin = `${store.profil.echelon}|${r.manque}`;
  try {
    if (localStorage.getItem(CLE_AVIS) === temoin) return false;
    localStorage.setItem(CLE_AVIS, temoin);
  } catch { /* stockage refusé : on préviendra à chaque fois, tant pis */ }

  const chemin = plusCourt(r);
  openModal({
    title: 'Il est temps de rejouer',
    body: `<p>À force de mois, tes victoires sortent de la fenêtre des douze mois : ton
        bilan à <strong>${h(store.profil.echelon)}</strong> est descendu à
        <strong>${r.bilan} points</strong>, et il en faut ${r.seuil.points}. Il manque
        <strong>${r.manque}</strong>.</p>
      ${chemin ? `<p>Rien n'est joué : ${h(chemin.texte)} et tu repasses au-dessus.</p>`
               : `<p>Rien n'est joué : chaque victoire recompte, et le bilan remonte aussi
                  vite qu'il est descendu.</p>`}
      <p class="tiny muted">La fédération recalcule à ses propres dates : ce n'est pas un
        déclassement acté, c'est un maintien qui n'est plus assuré à résultats
        constants.</p>`,
    footer: `<button class="btn" data-non>Fermer</button>
             <button class="btn btn-primary" data-chemins>Voir les chemins</button>`,
    onMount: () => {
      const racine = document.getElementById('modal-root');
      racine.querySelector('[data-non]')?.addEventListener('click', closeModal);
      racine.querySelector('[data-chemins]')?.addEventListener('click', () => {
        closeModal();
        location.hash = '#/classement';
      });
    },
  });
  return true;
}
