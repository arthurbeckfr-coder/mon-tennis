/* Les comptes des clubs qu'on suit.

   Il faut être clair sur ce que cet écran fait et ne fait pas, parce que
   la demande de départ était d'y voir les dernières publications.

   Ce n'est pas faisable ici, et pas par manque de travail :

   • Le site n'a pas de serveur. Depuis un navigateur, on n'a pas le droit
     d'aller lire le contenu d'un autre domaine — c'est une règle du web,
     pas un réglage à changer.

   • Facebook, Instagram et TikTok ne laissent plus personne lire
     publiquement les publications d'une page. Il faut une autorisation
     officielle, accordée au propriétaire de la page. Pour les pages des
     clubs, qui ne sont pas les tiennes, la réponse est non.

   • YouTube fait exception : chaque chaîne publie un flux ouvert. Le jour
     où ce site aura un petit serveur, les vidéos pourront vraiment
     s'afficher ici. C'est la seule des quatre plateformes où c'est vrai.

   Plutôt qu'un mur d'aperçus vides qui donnerait l'illusion de marcher,
   cet écran fait la seule chose utile et honnête : ranger les comptes par
   club, et les ouvrir d'un geste. */

import { h, puce, confirmer, toast } from '../util.js';
import { store, supprimerSource, PLATEFORMES } from '../store.js';
import { sourceForm } from '../forms.js';

const infoPlateforme = cle => PLATEFORMES.find(p => p.cle === cle) || { emoji: '🔗', nom: cle };

export function render() {
  /* Regroupé par club et non par plateforme : quand on veut des nouvelles
     d'un club, on les veut toutes, pas seulement son Instagram. */
  const clubs = new Map();
  for (const s of store.sources) {
    const cle = (s.club || 'Sans nom').trim();
    if (!clubs.has(cle)) clubs.set(cle, []);
    clubs.get(cle).push(s);
  }

  return `
    <section class="carte carte-avertissement">
      <h3>Ce que cet écran peut faire</h3>
      <p>Les dernières publications ne peuvent pas s'afficher ici. Facebook, Instagram
         et TikTok ont fermé la lecture publique des pages : il faut leur autorisation,
         accordée au propriétaire de la page — donc au club, pas à toi. Et sans serveur,
         un site ne peut de toute façon pas aller lire ailleurs.</p>
      <p class="tiny muted">Il reste une porte ouverte : YouTube publie un flux libre pour
         chaque chaîne. Si un jour tu veux vraiment voir les vidéos remonter ici, c'est
         faisable — il faudra ajouter un petit serveur. Dis-le-moi et on le fera.</p>
      <p>En attendant, voici tes comptes rangés par club, ouvrables d'un geste.</p>
    </section>

    ${clubs.size ? `
      <div class="rangee-boutons">
        <button class="btn" data-tour>Ouvrir tout le tour de veille</button>
        <button class="btn btn-ghost" data-ajout>Ajouter un compte</button>
      </div>
      ${[...clubs.entries()].map(([club, liste]) => `
        <section class="carte club">
          <h3>${h(club)}</h3>
          <ul class="comptes">
            ${liste.map(s => {
              const p = infoPlateforme(s.plateforme);
              return `<li>
                <a href="${h(s.url)}" target="_blank" rel="noopener noreferrer">
                  <span class="gros-emoji">${p.emoji}</span>
                  <span class="compte-nom">${h(p.nom)}
                    ${s.note ? `<small class="muted">${h(s.note)}</small>` : ''}</span>
                </a>
                <button class="icon-btn" data-suppr="${h(s.id)}" aria-label="Retirer">✕</button>
              </li>`;
            }).join('')}
          </ul>
        </section>`).join('')}`
      : `<div class="vide">
          <span class="emoji">📡</span>
          Aucun compte suivi pour l'instant.
          <div class="rangee-boutons" style="justify-content:center;margin-top:14px">
            <button class="btn btn-primary" data-ajout>Ajouter un compte</button>
          </div>
        </div>`}`;
}

export function wire(vue) {
  vue.addEventListener('click', async e => {
    if (e.target.closest('[data-ajout]')) { sourceForm(); return; }

    if (e.target.closest('[data-tour]')) {
      /* Le navigateur bloque l'ouverture de plusieurs onglets d'un coup,
         et il a raison. On prévient au lieu de laisser croire à un bug. */
      const urls = store.sources.map(s => s.url).filter(Boolean);
      let ouverts = 0;
      for (const u of urls) {
        if (window.open(u, '_blank', 'noopener')) ouverts++;
      }
      toast(ouverts === urls.length
        ? `${ouverts} onglet(s) ouvert(s).`
        : `${ouverts} sur ${urls.length} ouverts — le navigateur bloque le reste, autorise les fenêtres surgissantes.`);
      return;
    }

    const s = e.target.closest('[data-suppr]');
    if (s) {
      const src = store.sources.find(x => x.id === s.dataset.suppr);
      if (src && await confirmer('Retirer ce compte ?', `${src.club} — ${infoPlateforme(src.plateforme).nom}`)) {
        supprimerSource(src.id);
        toast('Compte retiré.');
      }
    }
  });
}
