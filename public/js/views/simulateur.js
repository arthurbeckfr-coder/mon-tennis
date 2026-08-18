/* Combien de matchs pour monter ?

   C'est la question que tout le monde se pose et à laquelle le site de la
   fédération répond mal, parce qu'il raisonne en points quand le joueur
   raisonne en matchs. On répond donc en scénarios : « une victoire à 15 »,
   « deux victoires à 15/1 ».

   Le calcul n'est plus une approximation : il reproduit au point près les
   bilans officiels de Ten'Up (voir l'en-tête de classement.js). Le bilan
   n'est donc plus saisi à la main, il est calculé depuis l'historique. */

import { h, puce, dateCourte } from '../util.js';
import { store, reglagesCalcul } from '../store.js';
import { simuler, bilanA, direScenario, echelonSuivant, ECHELONS, rang, seuil,
         projeter, echeance, rendementParEchelon, moisAVenir } from '../classement.js';
import { profilForm, baremeForm } from '../forms.js';
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
      <button class="btn btn-ghost" data-profil>Régler</button>
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

    ${rendreDescente(reglages, p)}

    ${rendreCalendrier(reglages, cible, r)}

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
      <div class="rangee-boutons">
        <button class="btn btn-ghost" data-bareme>Voir et corriger le barème</button>
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
    return `<section class="carte carte-verte">
      <h3>${maintien ? 'Ton échelon est tenu.' : 'Les points y sont.'}</h3>
      <p>Ton bilan à ${h(r.cible)} atteint ${r.bilan} points, pour ${r.seuil.points} demandés.</p>
      ${manqueMatchs
        ? `<p class="alerte">Il manque encore ${r.matchsManquants} victoire(s) :
           ${h(r.cible)} en exige ${r.seuil.victoires}, tu en as ${r.nbVictoires}.</p>`
        : `<p>Le nombre de victoires exigé est également atteint.</p>`}
      ${rendreMontee(r)}
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

    ${r.scenarios.length ? `
      <h3 class="titre-section">Les chemins possibles</h3>
      <ul class="scenarios">
        ${r.scenarios.map((sc, n) => `<li class="scenario ${n === 0 ? 'meilleur' : ''}">
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
      </ul>`
      : `<div class="avis">Aucun scénario réaliste ne comble cet écart en huit victoires.
         Vise d'abord l'échelon juste au-dessus.</div>`}`;
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
function rendreCalendrier(reglages, cible, r) {
  if (!r.seuil || r.seuil.points == null) return '';

  /* Trois ans en arrière, cinq devant. Cette asymétrie a une raison : la
     descente est bridée à un échelon par douze mois, si bien qu'une chute
     de plusieurs classements s'étale mécaniquement sur plusieurs années.
     Sur deux ans on n'en voyait que le début, et le graphique laissait
     croire que tout s'arrêtait là. */
  const etapes = projeter({ ...reglages, cible,
                            debut: -36, mois: 60, depuis: store.profil.echelon });
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
      ? `<p>Tant que tu ne rejoues pas, il te manque <strong>${maintenant.manque} points</strong>.
         À partir de <strong>${h(ech.apres.libelle)}</strong> il t'en manquera
         <strong>${ech.apres.manque}</strong> : des victoires sortent de la fenêtre des douze
         mois et cessent de compter. Agir avant coûte ${ech.surcout} points de moins.</p>`
      : `<p class="tiny muted">Aucune de tes victoires comptées ne sort de la fenêtre dans
         l'année qui vient : l'écart ne se creusera pas tout seul.</p>`}

    ${(() => {
      /* ─── Trois traits, pas davantage ─────────────────────────────

         On montrait tous les échelons traversés : jusqu'à sept traits
         serrés dans la hauteur d'un pouce, leurs noms empilés au bord
         gauche, et la courbe perdue au milieu. Or trois suffisent à
         répondre à la seule question qu'on pose ici — est-ce que je
         tiens : celui du dessus, qu'on vise ; le sien, qu'on garde ou
         qu'on perd ; celui du dessous, où l'on tombe.

         Le reste de la descente se lit en toutes lettres sous le
         graphique, échelon par échelon et date par date — c'est plus
         précis qu'un trait de plus. */
      const mien = store.profil.echelon;
      const i = rang(mien);
      const paliers = [ECHELONS[i + 1], mien, ECHELONS[i - 1]]
        .filter(Boolean)
        .map(e => ({ echelon: e, points: seuil(e, store.profil.sexe)?.points }))
        .filter(p => p.points != null)
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

export function wire(vue, rerendre) {
  brancherCourbe(vue);

  vue.addEventListener('click', e => {
    if (e.target.closest('[data-profil]')) { profilForm(); return; }
    if (e.target.closest('[data-bareme]')) { baremeForm(); return; }
    const c = e.target.closest('[data-cible]');
    if (c) { cibleChoisie = c.dataset.cible; rerendre(); return; }
    const x = e.target.closest('[data-horizon]');
    if (x) { horizon = Number(x.dataset.horizon); rerendre(); }
  });
}
