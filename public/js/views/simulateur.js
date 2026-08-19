/* Combien de matchs pour monter ?

   C'est la question que tout le monde se pose et à laquelle le site de la
   fédération répond mal, parce qu'il raisonne en points quand le joueur
   raisonne en matchs. On répond donc en scénarios : « une victoire à 15 »,
   « deux victoires à 15/1 ».

   Le calcul n'est plus une approximation : il reproduit au point près les
   bilans officiels de Ten'Up (voir l'en-tête de classement.js). Le bilan
   n'est donc plus saisi à la main, il est calculé depuis l'historique. */

import { h, puce, dateCourte, openModal, closeModal, toast } from '../util.js';
import { store, reglagesCalcul, maj } from '../store.js';
import { simuler, bilanA, direScenario, echelonSuivant, ECHELONS, rang, seuil,
         projeter, echeance, rendementParEchelon, moisAVenir } from '../classement.js';

import { URL_TENUP } from '../config.js';
import { courbeBilan, brancherCourbe, tableauDouble } from '../graphes.js';

let cibleChoisie = null;

/* ─── L'horizon ────────────────────────────────────────────────────────

   Le bilan glisse sur douze mois : sans jouer un seul match, il baisse à
   mesure que les vieilles victoires sortent de la fenêtre. La courbe du
   bas le montrait déjà, mais montrer n'est pas calculer — on voyait le
   trait descendre sans savoir ce qu'il resterait à faire une fois en bas.

   Se placer en septembre, en octobre ou en novembre refait tout le calcul
   à cette date : le bilan, l'écart, les chemins possibles, et jusqu'à la
   victoire qui lève la limitation de montée, laquelle expire comme les
   autres.

   Trois mois et pas douze : au-delà, l'hypothèse « je ne joue rien »
   devient absurde pour quelqu'un qui joue. */
let horizon = 0;

const horizonsPossibles = () =>
  [0, 1, 2, 3].map(n => (n === 0
    ? { n, fin: null, mois: 'Aujourd\'hui', libelle: 'aujourd\'hui' }
    : { n, ...moisAVenir(n) }));

export function render() {
  const p = store.profil;
  const reglages = reglagesCalcul();
  const cible = cibleChoisie || echelonSuivant(p.echelon);

  const horizons = horizonsPossibles();
  const vise = horizons.find(x => x.n === horizon) || horizons[0];
  const fin = vise.fin;

  const actuel = bilanA({ ...reglages, cible: p.echelon, finISO: fin });
  const r = simuler({ ...reglages, echelon: p.echelon, cible, finISO: fin });

  /* Ce que la projection coûte, en points à retrouver. Le chiffre seul ne
     dit rien : c'est l'écart avec aujourd'hui qui répond à « est-ce que
     ça vaut le coup de m'y mettre maintenant ». */
  const rMaintenant = horizon
    ? simuler({ ...reglages, echelon: p.echelon, cible, })
    : null;
  const surcout = rMaintenant && rMaintenant.manque != null && r.manque != null
    ? r.manque - rMaintenant.manque : null;

  /* Son propre échelon fait partie des objectifs, et ce n'est pas une
     coquetterie : « est-ce que je me maintiens » est une vraie question,
     posée par tout joueur dont le bilan glisse. La sélectionner montre le
     seuil de son propre échelon et ce qu'il reste dessous — là où les
     trois suivantes montrent ce qu'il faut pour monter. */
  const i = rang(p.echelon);
  const cibles = [0, 1, 2, 3].map(d => ECHELONS[i + d]).filter(Boolean);


  return `
    <section class="carte-classement">
      <div class="classement-actuel">
        <span class="etiquette">Mon classement</span>
        <b class="echelon">${h(p.echelon)}</b>
        <span class="bilan">${actuel.bilan} points de bilan, calculés
          sur ${actuel.nbMatchs} match${actuel.nbMatchs > 1 ? 's' : ''}${horizon
            ? ` <em>— fin ${h(vise.libelle)}</em>` : ''}</span>
      </div>
    </section>

    ${!store.matchs.length ? `<div class="avis">
      <strong>Aucun match enregistré.</strong>
      Le bilan se calcule depuis l'historique : importe ton palmarès Ten'Up
      et tout le reste se remplit tout seul.</div>` : ''}

    ${/* Ce que le championnat individuel a rapporté, puisque c'est déduit
          et non saisi : il faut pouvoir vérifier d'un coup d'œil que le
          carnet a bien reconnu les bonnes épreuves. */''}
    ${(actuel.bonus?.points || actuel.bonus?.victoires) ? `<p class="tiny muted"
        style="margin:0 4px 10px">Championnat individuel :
      ${actuel.bonus.retenues} victoire(s) à ${actuel.bonus.valeur} points
      — ${actuel.bonus.points} points de bonification${
        actuel.bonus.nb > actuel.bonus.retenues
          ? ` (sur ${actuel.bonus.nb}, le règlement n'en retient que ${actuel.bonus.retenues})` : ''}${
        actuel.bonus.victoires
          ? `, et ${actuel.bonus.victoires} victoire(s) bonus hors quota pour
             ${h(actuel.bonus.editions.map(e => e.nom).join(', '))}` : ''}.</p>` : ''}


    <section class="choix-cible">
      <span class="etiquette">Objectif</span>
      <div class="segments">
        ${cibles.map(c => `<button data-cible="${h(c)}"
          class="${c === cible ? 'actif' : ''}"
          title="${c === p.echelon ? 'Me maintenir à ' + h(c) : 'Passer ' + h(c)}"
          >${h(c)}${c === p.echelon ? ' <small>actuel</small>' : ''}</button>`).join('')}
      </div>
    </section>

    <section class="choix-cible">
      <span class="etiquette">À quelle date</span>
      <div class="segments">
        ${horizons.map(x => `<button data-horizon="${x.n}"
          class="${x.n === horizon ? 'actif' : ''}">${h(x.mois)}</button>`).join('')}
      </div>
    </section>

    ${horizon ? `<div class="avis">
      <strong>Tout ce qui suit est calculé fin ${h(vise.libelle)}, sans un match de plus.</strong>
      C'est une hypothèse, pas une prédiction : elle sert à voir ce que coûte l'attente.
      ${surcout > 0
        ? `D'ici là, des victoires sortent de la fenêtre des douze mois et cessent de
           compter — il te manquera <strong>${surcout} points de plus</strong>
           qu'aujourd'hui.`
        : surcout === 0
          ? `Rien de ce qui porte ton bilan n'expire d'ici là : attendre ne coûte
             aucun point.`
          : `L'écart se réduit tout seul : ce sont des victoires trop faibles pour
             compter qui sortent, et de meilleures reprennent leur place.`}
    </div>` : ''}

    ${r.erreur ? `<div class="avis">${h(r.erreur)}</div>` : rendreResultat(r)}

    ${r.erreur ? '' : rendreChemins(reglages, p, cible, r)}

    ${rendreDescente(reglages, p)}

    ${rendreCalendrier(reglages)}

    ${rendreRendement(reglages, cible, r, fin, vise)}

    ${rendreBanque(r)}

    <section class="carte">
      <h3>D'où viennent ces chiffres</h3>
      <p class="tiny muted">Le barème et les seuils ne viennent pas d'une source de seconde
        main : ils ont été confrontés aux bilans officiels de Ten'Up et les reproduisent
        au point près, à trois échelons différents. Plus rien ne se saisit : les
        bonifications du championnat individuel — 15 points par victoire en 4e série,
        20 en 3e, 25 en 2e, les trois meilleures retenues — et les victoires bonus hors
        quota se lisent dans l'historique, comme le fait le règlement.</p>
      <p class="tiny muted">Une réserve, et elle tient aux données et non à la règle :
        l'historique ne dit pas le tour atteint dans un championnat. Une édition gagnée
        se reconnaît quand même — c'est celle où tu n'as pas perdu — mais un finaliste
        ne se distingue pas d'un demi-finaliste, et rien ne lui est compté. L'erreur va
        donc toujours dans le même sens : jamais un classement annoncé qu'on n'a pas.</p>
      ${/* Aucun réglage ici : cet écran lit, il ne paramètre pas. Le
            classement de départ, la main, le barème et les adresses se
            règlent au même endroit, dans le profil — c'est là qu'on va
            quand on veut changer quelque chose sur soi. */''}
      <div class="rangee-boutons">
        <a class="btn btn-ghost btn-tenup" href="${URL_TENUP}" target="_blank"
           rel="noopener noreferrer">Vérifier sur Ten'Up ↗</a>
      </div>
      <p class="tiny muted">Le site de la fédération s'ouvre dans un autre onglet, sur ton
        espace si tu y es déjà connecté. Ce carnet n'y a aucun accès et ne peut rien y
        lire : c'est à toi d'aller voir.</p>
    </section>`;
}

function rendreResultat(r) {
  const manqueMatchs = r.matchsManquants > 0;
  /* Viser son propre échelon n'est pas viser une montée : on ne « passe »
     pas 15 quand on est 15, on s'y maintient. Le même calcul répond aux
     deux questions, mais pas avec les mêmes mots — et la limitation de
     montée, elle, ne s'applique pas du tout. */
  const maintien = r.cible === store.profil.echelon;

  if (r.manque === 0) {
    /* Tout est réuni : les points, le nombre de victoires, et la victoire
       contre un joueur de l'échelon visé quand elle est exigée. Il n'y a
       plus rien à faire pour monter — autant le dire comme tel, plutôt
       que de laisser lire « les points y sont » à quelqu'un qui vient de
       gagner son échelon.

       Et proposer de l'inscrire : le classement du profil commande tout
       le reste du carnet — les points de chaque victoire, l'écart avec
       l'adversaire, les projections — et il se corrigeait dans un autre
       écran, au moment où l'on y pense, c'est-à-dire jamais. */
    const acquis = !maintien && !manqueMatchs
      && (!r.montee?.requise || r.montee.satisfaite)
      && rang(r.cible) > rang(store.profil.echelon);

    return `<section class="carte carte-verte">
      <h3>${maintien ? 'Ton échelon est tenu.'
        : acquis ? `🎉 Tu as de quoi passer ${h(r.cible)}.` : 'Les points y sont.'}</h3>
      <p>Ton bilan à ${h(r.cible)} atteint ${r.bilan} points, pour ${r.seuil.points} demandés.</p>
      ${manqueMatchs
        ? `<p class="alerte">Il manque encore ${r.matchsManquants} victoire(s) :
           ${h(r.cible)} en exige ${r.seuil.victoires}, tu en as ${r.nbVictoires}.</p>`
        : `<p>Le nombre de victoires exigé est également atteint.</p>`}
      ${rendreMontee(r)}
      ${acquis ? `<p class="tiny muted">C'est la fédération qui publie les classements :
        ce carnet calcule, il ne décide pas. Le jour où ce sera officiel, dis-le-lui —
        tout le reste s'ajustera tout seul.</p>
        <button class="btn btn-primary" data-monter="${h(r.cible)}">Je suis
          ${h(r.cible)} — mettre à jour mon profil</button>` : ''}
    </section>`;
  }

  return `
    <section class="carte carte-objectif">
      <div class="ecart">
        <b>${r.manque}</b>
        <span>points à trouver pour ${maintien ? `te maintenir à` : `passer`} ${h(r.cible)}</span>
      </div>
      <div class="jauge"><div class="jauge-pleine"
        style="width:${Math.min(100, Math.round((r.bilan / r.seuil.points) * 100))}%"></div></div>
      <p class="tiny muted">${r.bilan} / ${r.seuil.points} points
        ${manqueMatchs ? ` — et ${r.matchsManquants} victoire(s) à ajouter en plus des points`
                       : ' — le nombre de victoires exigé est déjà atteint'}.</p>
      ${maintien ? '' : `<p class="tiny muted">Attention au piège : à ${h(r.cible)}, tes victoires sont
        recomptées <em>depuis ${h(r.cible)}</em>. Une victoire qui te rapporte 120 points
        aujourd'hui n'en vaut plus que 90 une fois là-haut. C'est ce qui rend chaque
        échelon plus dur que le précédent.</p>`}
    </section>

    ${rendreMontee(r)}

    ${/* Les chemins ont leur propre chapitre, plus bas : monter et ne pas
          descendre sont deux faces d'une même question, et les séparer
          d'un écran laissait croire que la seconde n'existait pas. */''}`;
}

/** Une liste de scénarios : « deux victoires à 15/1 », et ce qu'elle vaut. */
function listeScenarios(scenarios) {
  return `<ul class="scenarios">
    ${scenarios.map((sc, n) => `<li class="scenario ${n === 0 ? 'meilleur' : ''}">
      <div class="scenario-tete">
        <strong>${h(direScenario(sc))}</strong>
        ${n === 0 ? puce('le plus court', 'puce-vert') : ''}
      </div>
      <div class="scenario-bas">
        <span>${sc.matchs} match${sc.matchs > 1 ? 's' : ''}</span>
        <span>+${sc.gain} points</span>
        ${sc.parts.map(x => `<span class="muted">${x.n}×${h(x.echelon)} = ${x.points} pts</span>`).join('')}
      </div>
    </li>`).join('')}
  </ul>`;
}

/* ─── Les deux chemins ─────────────────────────────────────────────────

   Monter et ne pas descendre sont la même question posée dans deux sens,
   et l'écran n'en traitait qu'une. « Combien de victoires pour passer
   5/6 » avait sa liste ; « combien pour ne pas retomber à 15/1 » n'avait
   rien, alors que c'est la question qui se pose en premier quand le bilan
   glisse.

   Le calcul est le même, à deux choses près. La cible est son propre
   échelon, et la date n'est pas aujourd'hui : c'est le mois où le manque
   sera le plus grand dans l'année qui vient. Se maintenir aujourd'hui ne
   veut rien dire quand trois victoires sortent de la fenêtre en novembre
   — ce qu'il faut, c'est de quoi passer le pire mois.

   Si aucun mois de l'année ne descend sous le seuil, il n'y a pas de
   chemin à proposer : il n'y a rien à faire, et le dire est la bonne
   réponse. */
function rendreChemins(reglages, p, cible, r) {
  const maintien = cible === p.echelon;

  /* Les douze mois qui viennent, calculés à son propre échelon. Chaque
     étape connaît les victoires qui sortent de la fenêtre ce mois-là :
     c'est le mécanisme entier de la descente, et il n'y en a pas d'autre
     — on ne perd pas son classement parce qu'on joue mal, on le perd
     parce que les victoires de l'an dernier cessent de compter. */
  const etapes = projeter({ ...reglages, cible: p.echelon,
                            debut: 0, mois: 12, depuis: p.echelon });

  /* Les paliers de la chute : les mois où le manque augmente. Les autres
     ne disent rien de neuf — entre deux sorties de victoire, le bilan ne
     bouge pas. */
  const marches = [];
  let precedent = -1;
  for (const e of etapes) {
    const m = e.manque ?? 0;
    if (m > precedent && m > 0) {
      marches.push(e);
      precedent = m;
    }
  }

  const pire = marches[marches.length - 1] || null;
  const menace = !!pire;

  /* Ce qu'il faut trouver pour couvrir chaque marche. La date compte
     autant que le nombre : une victoire d'aujourd'hui protège douze mois,
     pas plus, et c'est bien pour cela que l'écart se reforme. */
  const chemin = e => {
    const rr = simuler({ ...reglages, echelon: p.echelon,
                         cible: p.echelon, finISO: e.fin });
    return rr?.scenarios?.[0] || null;
  };

  return `<section class="carte">
    <h3>Les chemins possibles</h3>

    ${maintien ? '' : `<h4 class="sous-titre">Pour passer ${h(cible)}</h4>
      ${r.scenarios.length ? listeScenarios(r.scenarios)
        : `<div class="avis">Aucun scénario réaliste ne comble cet écart en huit
           victoires. Vise d'abord l'échelon juste au-dessus.</div>`}`}

    <h4 class="sous-titre">Pour garder ton ${h(p.echelon)}</h4>
    ${!menace
      ? `<p class="tiny muted">Rien à faire : aucun mois de l'année qui vient ne fait
         passer ton bilan sous le seuil de ${h(p.echelon)}. Ce que tu as gagné te
         couvre douze mois de plus.</p>`
      : `<p class="tiny muted">Mois par mois, ce que le temps retire. À chaque date,
          des victoires de l'an dernier sortent de la fenêtre des douze mois et
          cessent de compter : l'écart se creuse sans qu'un match ait été joué.</p>

        <ul class="marches">
          ${marches.map(e => {
            const sc = chemin(e);
            const perdus = (e.sortants || []).reduce((t, x) => t + x.points, 0);
            return `<li>
              <div>
                <strong>${h(e.libelle)}</strong>
                <div class="tiny muted">${e.manque} points manquants${
                  e.sortants?.length ? ` — ${e.sortants.length} victoire${
                    e.sortants.length > 1 ? 's' : ''} sort${
                    e.sortants.length > 1 ? 'ent' : ''}, ${perdus} points` : ''}</div>
              </div>
              <div class="club-score">
                <b>${sc ? h(direScenario(sc)) : 'hors de portée'}</b>
                ${sc ? `<span class="tiny muted">${sc.matchs} match(s)</span>` : ''}
              </div>
            </li>`;
          }).join('')}
        </ul>

        <p class="tiny muted">La dernière ligne est celle qui compte si tu ne veux t'y
          reprendre qu'une fois : elle couvre toute l'année. Les précédentes disent
          jusqu'à quand il est encore temps d'en faire moins.</p>
        ${maintien ? '' : `<p class="tiny muted">Ces victoires-là comptent aussi pour
          monter : ce ne sont pas deux campagnes à mener, c'est la même.</p>`}`}
  </section>`;
}
/* ─── La descente ──────────────────────────────────────────────────────

   Le simulateur ne répondait qu'à « comment monter ». Or la question qui
   réveille, c'est l'autre : si je ne rejoue plus, quand est-ce que je
   redescends ? Elle a une réponse exacte, parce que le bilan glisse sur
   douze mois et qu'on sait à la journée près quelle victoire sort quand.

   Deux honnêtetés, sans lesquelles ce serait une fausse promesse.

   Le carnet connaît un seuil par échelon — celui qu'il faut atteindre.
   Le prendre pour le plancher du maintien est la lecture naturelle du
   modèle, mais c'est une lecture : la fédération peut traiter le maintien
   autrement.

   Et surtout la fédération ne déclasse pas le jour où le bilan passe
   dessous : elle recalcule à ses propres dates. Ce qui est annoncé ici est
   donc le mois où le maintien cesse d'être couvert, ce qui n'est pas la
   date du déclassement — et on le dit plutôt que de laisser croire. */
function rendreDescente(reglages, p) {
  const etapes = projeter({ ...reglages, cible: p.echelon,
                            debut: 0, mois: 12 });
  if (etapes.length < 2 || etapes[0].manque == null) return '';

  const aujourdhui = etapes[0];
  const bascule = etapes.find(e => e.manque > 0);
  // Ce qu'on peut encore perdre avant de passer dessous.
  const coussin = bascule ? aujourdhui.bilan - bascule.bilan : null;

  if (aujourdhui.manque > 0) {
    return `<section class="carte carte-objectif">
      <h3>Ton maintien n'est déjà plus couvert</h3>
      <p>À ${h(p.echelon)}, ton bilan est de <strong>${aujourdhui.bilan} points</strong>,
        et il en faut ${aujourdhui.bilan + aujourdhui.manque}. Il manque
        <strong>${aujourdhui.manque}</strong>.</p>
      <p class="tiny muted">La fédération recalcule à ses propres dates : ce n'est pas un
        déclassement acté, c'est un maintien qui n'est plus assuré à résultats constants.</p>
    </section>`;
  }

  if (!bascule) {
    return `<section class="carte carte-verte">
      <h3>Ton échelon tient l'année</h3>
      <p>Même sans rejouer un seul match, ton bilan à ${h(p.echelon)} reste au-dessus des
        points demandés pendant les douze prochains mois.</p>
    </section>`;
  }

  const victoiresPerdues = etapes
    .slice(1, etapes.indexOf(bascule) + 1)
    .flatMap(e => e.sortants.map(s => ({ mois: e.libelle, ...s })));

  return `<section class="carte">
    <h3>Si tu ne rejoues plus</h3>
    <p>Ton bilan à ${h(p.echelon)} passe sous les points demandés
      <strong>en ${h(bascule.libelle)}</strong> : il tombe à ${bascule.bilan}, et il en
      faut ${bascule.bilan + bascule.manque}. Tu as donc
      <strong>${coussin} points</strong> de marge à perdre d'ici là — c'est-à-dire
      ${victoiresPerdues.length} victoire(s) qui sortent de la fenêtre des douze mois.</p>

    ${victoiresPerdues.length ? `<ul class="fiche-infos" style="margin-top:10px">
      ${victoiresPerdues.slice(0, 5).map(x => `<li>
        <span class="fiche-emoji">📉</span><div>
        <strong>${h(x.mois)}</strong> — ${h(x.match.adversaire || 'une victoire')}
        (${h(x.match.echelonAdverse)}, ${h(dateCourte(x.match.date))}) cesse de compter,
        ${x.points} points.</div></li>`).join('')}
    </ul>` : ''}

    <p class="tiny muted">Deux réserves, et elles comptent. Le carnet connaît un seuil par
      échelon — celui qu'il faut atteindre — et le prend ici pour le plancher du maintien ;
      c'est la lecture naturelle du modèle, pas une règle publiée. Et la fédération ne
      déclasse pas le jour où le bilan passe dessous : elle recalcule à ses propres dates.
      ${h(bascule.libelle)} est le mois où le maintien cesse d'être couvert, pas la date
      d'un déclassement.</p>
  </section>`;
}

/* ─── Le calendrier ────────────────────────────────────────────────────

   La question « qu'est-ce qu'il me faut » a une jumelle qu'on oublie :
   « jusqu'à quand ». Le bilan glisse sur douze mois, donc une victoire
   finit par sortir de la fenêtre et le total baisse sans qu'on ait rien
   fait. Attendre coûte. */
function rendreCalendrier(reglages) {
  /* ─── Cette section parle du classement qu'on a, jamais de celui qu'on
         vise ────────────────────────────────────────────────────────────

     Elle suivait l'objectif choisi au-dessus : sélectionner 3/6 faisait
     dire à la courbe « il te manque 430 points » et redessinait toute la
     descente par rapport à un échelon qu'on n'a pas. Or la question posée
     ici est l'inverse de celle du haut de page — non pas « qu'est-ce
     qu'il me faut pour monter » mais « qu'est-ce que je perds si je ne
     joue plus ». Elle n'a qu'une réponse, celle de son propre échelon.

     Trois ans en arrière, deux devant. Cinq ans de projection avaient
     été ouverts pour une raison qui a disparu : la descente est bridée à
     un échelon par douze mois, et l'on voulait voir la chute entière —
     jusqu'à trois ou quatre classements plus bas. Mais montrer ces cinq
     ans écrasait l'échelle : les quinze points qui séparent deux
     classements voisins ne faisaient plus que six pixels, et le
     graphique devenait illisible pour montrer un lointain qui ne se
     décide pas aujourd'hui.

     Deux ans suffisent à la question posée : le premier franchissement,
     et le suivant. Au-delà, la descente se lit en toutes lettres sous le
     graphique, échelon par échelon et date par date — un texte est plus
     précis qu'une courbe écrasée. */
  const mien = store.profil.echelon;
  if (seuil(mien, store.profil.sexe)?.points == null) return '';

  const etapes = projeter({ ...reglages, cible: mien,
                            debut: -36, mois: 24, depuis: mien });
  if (etapes.length < 2) return '';

  /* Le mois d'aujourd'hui se trouve, il ne se compte pas : son rang dans
     la liste dépend de la profondeur du passé qu'on a demandée, et un
     indice écrit en dur devient faux dès qu'on l'allonge. */
  const passe = etapes.filter(e => !e.futur);
  const maintenant = passe[passe.length - 1];
  const aVenir = etapes.filter(e => e.futur);
  const ech = echeance([maintenant, ...aVenir].filter(Boolean));

  /* Les victoires qui vont sortir, et ce qu'elles emportent. C'est le
     détail qui rend la baisse concrète plutôt que fatale. */
  const pertes = aVenir.flatMap(e =>
    e.sortants.map(s => ({ mois: e.libelle, ...s }))).slice(0, 4);

  return `<section class="carte">
    <h3>Le temps joue contre toi</h3>
    ${ech
      ? `<p>Tant que tu ne rejoues pas, il te manque <strong>${maintenant.manque} points</strong>
         pour tenir ton <strong>${h(mien)}</strong>. À partir de
         <strong>${h(ech.apres.libelle)}</strong> il t'en manquera
         <strong>${ech.apres.manque}</strong> : des victoires sortent de la fenêtre des douze
         mois et cessent de compter. Agir avant coûte ${ech.surcout} points de moins.</p>`
      : `<p class="tiny muted">Aucune de tes victoires comptées ne sort de la fenêtre dans
         l'année qui vient : ton ${h(mien)} ne se perdra pas tout seul.</p>`}
    <p class="tiny muted">Tout ce qui suit parle de ton classement actuel, et de lui
      seul : l'objectif choisi plus haut ne le change pas.</p>

    ${(() => {
      /* ─── Deux traits, et pourquoi ils ne se lisent pas de la même
             façon ────────────────────────────────────────────────────

         Le trait du bas est le seuil de son propre échelon : passer
         dessous, c'est le perdre. Il se compare directement à la courbe,
         puisque celle-ci est calculée à cet échelon-là.

         Le trait du haut ne peut pas être le seuil de l'échelon suivant.
         Un bilan n'existe pas dans l'absolu : il se recalcule pour chaque
         échelon visé, et les mêmes victoires y rapportent moins — c'est
         tout le piège que la page explique plus haut. Comparer une courbe
         calculée à 15 au seuil publié pour 5/6 revenait à comparer des
         francs à des euros : quinze points d'écart affichés, là où il en
         faut bien davantage.

         Le trait du haut est donc posé là où la courbe devrait monter
         pour que l'échelon suivant soit acquis : le bilan d'aujourd'hui
         plus ce qu'il manque pour l'obtenir, ce manque étant calculé, lui,
         dans l'échelle du haut. Les deux traits parlent alors la même
         langue que la courbe. */
      const i = rang(mien);
      const suivant = ECHELONS[i + 1];
      const manqueHaut = suivant
        ? simuler({ ...reglages, echelon: mien, cible: suivant }).manque
        : null;

      const paliers = [
        { echelon: mien, points: seuil(mien, store.profil.sexe)?.points },
        manqueHaut != null
          ? { echelon: suivant, points: maintenant.bilan + manqueHaut,
              /* « +195 pts » plutôt que « 675 pts » : le chiffre absolu
                 n'est celui d'aucun barème publié — c'est une hauteur sur
                 cette courbe-ci. Ce qui se retient, c'est ce qu'il reste
                 à trouver. */
              texte: manqueHaut ? `${suivant} · +${manqueHaut} pts` : `${suivant} · acquis` }
          : null,
      ].filter(p => p && p.points != null)
        .sort((a, b) => a.points - b.points);

      const changements = [];
      etapes.forEach((e, i) => {
        if (i && e.echelon && e.echelon !== etapes[i - 1].echelon) changements.push(e);
      });
      const descentes = changements.filter(e => e.futur);

      return `${courbeBilan({
        points: etapes.map(e => ({
          label: e.libelle, valeur: e.bilan, futur: e.futur, echelon: e.echelon, fin: e.fin,
          detail: [
            e.echelon ? `échelon tenu : ${e.echelon}` : 'sous le plus bas seuil examiné',
            `${e.nbVictoires} victoire(s) dans la fenêtre`,
            e.futur ? 'projeté, sans un match de plus' : 'mesuré',
          ].join(' · '),
        })),
        paliers,
        actuel: store.profil.echelon,
      })}
      <p class="tiny muted">Bilan mois par mois : mesuré jusqu'à aujourd'hui, puis projeté
        en pointillé si tu ne rejoues pas. Les traits horizontaux sont les points demandés
        à chaque échelon — voir la courbe passer dessous, c'est voir le classement se
        perdre. Touche un point pour le détail du mois ; glisse et pince pour parcourir le
        temps.</p>
      ${descentes.length ? `<p class="tiny muted">Sans rejouer un match, tu passerais
        ${descentes.map(e => `<strong>${h(e.echelon)}</strong> en ${h(e.libelle)}`)
          .join(', puis ')}.</p>
        <p class="tiny muted">Un échelon par an, et pas davantage : le règlement interdit
        de descendre de deux échelons consécutifs en moins de douze mois, qu'on ait joué
        ou non. C'est ce qui étale la chute — le bilan, lui, s'effondre bien plus vite.
        La limitation saute dès qu'on remonte.</p>
        <p class="tiny muted">Une chose que ce carnet ne modélise pas, et qui compte si
        l'arrêt se prolonge : après environ trois ans sans licence ni compétition, la
        fédération retire le classement et inscrit « ND ». Il faut alors demander un
        reclassement, plafonné à son meilleur classement. Ce n'est plus une descente,
        c'est une remise à zéro — et la courbe ci-dessus n'en sait rien.</p>` : ''}`;
    })()}

    ${tableauDouble(['Mois', 'Bilan', 'Écart'],
      etapes.filter((_, i) => i % 3 === 0 || i === etapes.length - 1)
        .map(e => [e.libelle, String(e.bilan), e.manque ? `−${e.manque}` : 'atteint']))}

    ${pertes.length ? `<ul class="fiche-infos" style="margin-top:10px">
      ${pertes.map(p => `<li><span class="fiche-emoji">📉</span><div>
        <strong>${h(p.mois)}</strong> — ${h(p.match.adversaire || 'une victoire')}
        (${h(p.match.echelonAdverse)}, ${h(dateCourte(p.match.date))}) cesse de compter,
        ${p.points} points.</div></li>`).join('')}
    </ul>` : ''}
  </section>`;
}

/* ─── Le rendement ─────────────────────────────────────────────────────

   Le contre-intuitif du système : une fois le quota atteint, battre un
   joueur moins bien classé que ses propres victoires déjà comptées ne
   rapporte rien du tout. Zéro. Autant le dire avant de s'inscrire. */
function rendreRendement(reglages, cible, r, finISO = null, vise = null) {
  if (!r.seuil || r.seuil.points == null) return '';

  const lignes = rendementParEchelon({ ...reglages, cible, finISO });
  const inutiles = lignes.filter(l => l.gain === 0);

  /* Le rendement se lit à la date choisie, et pas ailleurs : une victoire
     qui ne rapporte rien aujourd'hui, parce qu'une meilleure occupe déjà
     sa place, peut valoir plein tarif en novembre une fois celle-ci
     expirée. C'est précisément ce que l'horizon sert à voir. */
  return `<section class="carte">
    <h3>Ce que rapporterait une victoire, ${finISO ? `fin ${h(vise.libelle)}` : 'aujourd\'hui'}</h3>
    <table class="rendement">
      <thead><tr><th>Battre un…</th><th>Barème</th><th>Gain réel</th></tr></thead>
      <tbody>
        ${lignes.map(l => `<tr class="${l.gain === 0 ? 'nul' : ''}">
          <td><strong>${h(l.echelon)}</strong></td>
          <td class="muted">${l.bareme} pts</td>
          <td>${l.gain > 0 ? `<strong>+${l.gain}</strong>` : '<span class="muted">rien</span>'}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    <p class="tiny muted">Le barème est ce que vaut la victoire ; le gain réel est ce qu'elle
      ajoute vraiment à ton bilan une fois les remplacements faits.
      ${inutiles.length
        ? `Battre ${inutiles.map(l => l.echelon).join(', ')} ne changerait
           strictement rien : ces victoires ne feraient que remplacer des victoires
           équivalentes déjà comptées.`
        : 'Toutes ces victoires te feraient progresser.'}</p>
  </section>`;
}

/** La limitation de montée, règle officielle et souvent la vraie raison
 *  d'un blocage : on a les points, mais pas le scalp. */
function rendreMontee(r) {
  const m = r.montee;
  if (!m || !m.requise) return '';
  // On ne monte pas à l'échelon qu'on occupe déjà : la règle ne s'applique pas.
  if (r.cible === store.profil.echelon) return '';

  if (!m.satisfaite) {
    return `<div class="avis">
      <strong>Il te manque une victoire contre un joueur classé ${h(r.cible)}.</strong>
      La fédération l'exige pour monter, quels que soient les points : il faut avoir battu
      quelqu'un déjà classé à l'échelon visé, et pas par forfait. Les chemins ci-dessous
      en tiennent compte.</div>`;
  }
  return `<p class="tiny muted" style="margin:0 4px 10px">Victoire contre un joueur classé
    ${h(r.cible)} déjà acquise (${h(m.preuve.adversaire || 'adversaire')},
    ${h(dateCourte(m.preuve.date))}) : la limitation de montée est levée.</p>`;
}

/** Les victoires qui comptent, nommément. C'est ce qui rend le calcul
 *  vérifiable : on voit lesquelles portent le bilan, et laquelle sautera
 *  à la prochaine victoire. */
function rendreBanque(r) {
  if (!r.retenues?.length) return '';

  const faible = r.retenues[r.retenues.length - 1];

  return `<section class="carte">
      <h3>Les ${r.retenues.length} victoires qui comptent pour ${h(r.cible)}</h3>
      <p class="tiny muted">Seules les meilleures comptent, dans la limite de ${r.quota}.
        Une victoire de plus ne s'ajoute pas : elle remplace la moins bonne et ne rapporte
        que la différence.</p>
      <ul class="banque-liste">
        ${r.retenues.map(x => `<li>
          <span class="jeton">+${x.points}</span>
          <span class="banque-nom">${h(x.match.adversaire || '—')}
            ${puce(x.match.echelonAdverse)}</span>
          <span class="muted tiny">${h(dateCourte(x.match.date))}</span>
        </li>`).join('')}
      </ul>
      ${faible.points > 0 ? `<p class="tiny muted">La plus basse vaut ${faible.points} points :
        en dessous de ça, une nouvelle victoire ne changera rien à ton bilan.</p>` : ''}
      ${r.ecartees.length ? `<p class="tiny muted">${r.ecartees.length} autre(s) victoire(s)
        hors quota, sans effet sur ce bilan.</p>` : ''}
    </section>`;
}

/* ─── Replier les sections ─────────────────────────────────────────────

   Cet écran est une suite de développements : ce qu'il faut pour monter,
   ce qu'on perd en attendant, le rendement d'une victoire, les victoires
   qui comptent, d'où viennent les chiffres. On les lit une fois, et
   ensuite on veut pouvoir les passer — sur un téléphone, la page fait
   quatre écrans de haut.

   Le pli se pose après coup, sur le rendu, plutôt que dans chaque gabarit :
   il suffit qu'une section porte un titre pour qu'elle se replie, et les
   sections à venir en hériteront sans qu'on y pense. Le contenu passe dans
   une boîte qu'on montre ou qu'on cache ; le titre devient la poignée.

   Deux exceptions. Le graphique ne se replie pas : c'est ce qu'on vient
   regarder, et le cacher derrière son titre reviendrait à cacher l'écran.
   Et ce qu'on a ouvert reste ouvert d'un redessin à l'autre — changer
   d'objectif redessine la page, et une section qui se referme au moment
   où l'on veut la lire est pire que pas de pli du tout. */
const ouverts = new Set();

function replier(vue) {
  for (const sec of vue.querySelectorAll('section')) {
    const titre = sec.querySelector(':scope > h3');
    if (!titre || sec.querySelector('[data-courbe]')) continue;

    const cle = titre.textContent.trim();
    const corps = document.createElement('div');
    corps.className = 'pli-corps';
    while (titre.nextSibling) corps.appendChild(titre.nextSibling);
    sec.appendChild(corps);

    sec.classList.add('pli-section');
    titre.setAttribute('role', 'button');
    titre.setAttribute('tabindex', '0');
    if (ouverts.has(cle)) sec.classList.add('ouvert');
    titre.setAttribute('aria-expanded', String(sec.classList.contains('ouvert')));

    const basculer = () => {
      const ouvert = sec.classList.toggle('ouvert');
      titre.setAttribute('aria-expanded', String(ouvert));
      if (ouvert) ouverts.add(cle); else ouverts.delete(cle);
    };
    titre.addEventListener('click', basculer);
    titre.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); basculer(); }
    });
  }
}
/** Inscrire un nouvel échelon dans le profil.
 *
 *  On demande confirmation, non par cérémonie mais parce que le geste
 *  refait tous les calculs du carnet : monté trop tôt, le simulateur
 *  répondrait à une question qu'on ne se pose pas encore. Rien n'est
 *  perdu pour autant — l'échelon se rechoisit dans le profil.
 */
function acterMontee(cible) {
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
        /* L'objectif repart de zéro : viser l'échelon qu'on vient
           d'atteindre n'a plus de sens, c'est le suivant qu'on regarde. */
        cibleChoisie = null;
        closeModal();
        toast(`Te voilà ${cible}. Bravo.`);
        /* Pas de redessin ici : `maj` annonce le changement, et l'écran
           se refait de lui-même. */
      });
    },
  });
}

export function wire(vue, rerendre) {
  replier(vue);
  brancherCourbe(vue);

  vue.addEventListener('click', e => {

    const mo = e.target.closest('[data-monter]');
    if (mo) { acterMontee(mo.dataset.monter); return; }

    const c = e.target.closest('[data-cible]');
    if (c) { cibleChoisie = c.dataset.cible; rerendre(); return; }
    const x = e.target.closest('[data-horizon]');
    if (x) { horizon = Number(x.dataset.horizon); rerendre(); }
  });
}
