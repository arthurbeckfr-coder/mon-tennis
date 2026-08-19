/* La petite boîte à outils : échapper du texte, dire un mot à l'écran,
   ouvrir une fenêtre, écrire une date en français. */

/** Échappe tout ce qui vient de l'utilisateur avant de l'injecter en HTML.
 *  Les conseils du prof sont du texte libre : un chevron mal placé ne doit
 *  pas casser la page. */
export const h = (s) => String(s ?? '').replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Conserve les retours à la ligne d'un texte saisi au clavier. */
export const hMulti = (s) => h(s).replace(/\n/g, '<br>');

export const uid = () => (crypto.randomUUID?.() ??
  `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`);

// =====================================================================
//  Dates
// =====================================================================
export const aujourdhui = () => new Date().toISOString().slice(0, 10);

/** « 12 mai 2025 ». Rend la chaîne telle quelle si elle n'est pas une date. */
export function dateLongue(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00');
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** « 12/05/25 », pour les listes serrées. */
export function dateCourte(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00');
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

/** Le classement FFT se calcule sur les douze derniers mois glissants. */
export function dansLesDouzeMois(iso) {
  if (!iso) return false;
  const d = new Date(iso + 'T12:00:00');
  if (isNaN(d)) return false;
  const limite = new Date();
  limite.setFullYear(limite.getFullYear() - 1);
  return d >= limite;
}

export const parAnneeDescendante = (a, b) => (b.date || '').localeCompare(a.date || '');

// =====================================================================
//  Messages passagers
// =====================================================================
export function toast(message, duree = 2600) {
  const racine = document.getElementById('toast-root');
  if (!racine) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  racine.appendChild(el);
  requestAnimationFrame(() => el.classList.add('vu'));
  setTimeout(() => {
    el.classList.remove('vu');
    setTimeout(() => el.remove(), 300);
  }, duree);
}

// =====================================================================
//  Fenêtres
// =====================================================================
let fermerCourant = null;

export function closeModal() {
  const racine = document.getElementById('modal-root');
  if (racine) racine.innerHTML = '';
  document.body.classList.remove('modal-ouvert');
  fermerCourant = null;
}

/**
 * Ouvre une fenêtre modale.
 * @param {object} o
 * @param {string} o.title
 * @param {string} o.body        HTML déjà échappé par l'appelant
 * @param {string} [o.footer]
 * @param {boolean} [o.large]
 * @param {(el: HTMLElement) => void} [o.onMount]
 */
export function openModal({ title, body, footer = '', large = false, onMount }) {
  const racine = document.getElementById('modal-root');
  racine.innerHTML = `
    <div class="modal-fond">
      <div class="modal ${large ? 'modal-large' : ''}" role="dialog" aria-modal="true"
           aria-label="${h(title)}">
        <div class="modal-tete">
          <h2>${h(title)}</h2>
          <button class="icon-btn" data-fermer aria-label="Fermer">✕</button>
        </div>
        <div class="modal-corps">${body}</div>
        ${footer ? `<div class="modal-pied">${footer}</div>` : ''}
      </div>
    </div>`;
  document.body.classList.add('modal-ouvert');

  const fond = racine.querySelector('.modal-fond');
  // Un clic sur le fond ferme ; un clic dans la fenêtre ne doit pas remonter.
  fond.addEventListener('click', e => { if (e.target === fond) closeModal(); });
  racine.querySelector('[data-fermer]').addEventListener('click', closeModal);

  fermerCourant = closeModal;
  onMount?.(racine.querySelector('.modal-corps'));
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && fermerCourant) fermerCourant();
});

// =====================================================================
//  Confirmation
// =====================================================================
/* Une suppression se confirme, mais sans dramatiser : la phrase dit ce
   qui disparaît, le bouton dit ce qu'il fait. */
export function confirmer(question, detail = '') {
  return new Promise(resolve => {
    openModal({
      title: question,
      body: detail ? `<p class="muted">${h(detail)}</p>` : '<p class="muted">Cette action est définitive.</p>',
      footer: `<button class="btn" data-non>Annuler</button>
               <button class="btn btn-danger" data-oui>Supprimer</button>`,
      onMount: () => {
        const racine = document.getElementById('modal-root');
        racine.querySelector('[data-non]').onclick = () => { closeModal(); resolve(false); };
        racine.querySelector('[data-oui]').onclick = () => { closeModal(); resolve(true); };
      },
    });
  });
}

/** Balise colorée réutilisée partout (profil d'adversaire, moment, issue). */
export const puce = (texte, teinte = '') =>
  `<span class="puce ${teinte}">${h(texte)}</span>`;

/* ─── La note d'un match, repliée derrière un ⓘ ────────────────────────

   Écrite en clair dans une liste, une note de quinze lignes donne à un
   match la hauteur de quatre autres : la liste devient un journal et l'on
   ne compare plus rien. Repliée, elle ne coûte qu'un rond de vingt-deux
   pixels, posé dans la ligne des chiffres — et le rond ne paraît que
   s'il y a quelque chose à lire.

   Les deux morceaux vivent ici plutôt que dans un écran : une ligne de
   match s'affiche sur cinq pages différentes, et la note n'apparaissait
   que sur une. Ce qui se répète doit s'écrire une fois. */

/** Le ⓘ, à poser dans la ligne des chiffres. */
export const puceNote = m => m?.notes
  ? `<button type="button" class="match-info" data-note="${h(m.id)}"
      aria-expanded="false" title="Ce que j'en retiens">ⓘ</button>`
  : '';

/** Le texte, replié, à poser juste après la ligne. */
export const blocNote = m => m?.notes
  ? `<p class="match-note" data-note-de="${h(m.id)}" hidden>${hMulti(m.notes)}</p>`
  : '';

/** Branche les ⓘ d'un écran. Le geste est de lecture, jamais d'édition :
 *  il ne doit donc pas remonter jusqu'au gestionnaire qui ouvre le match. */
export function brancherNotes(racine) {
  racine.addEventListener('click', e => {
    const b = e.target.closest('[data-note]');
    if (!b) return;
    e.stopPropagation();
    const p = racine.querySelector(`[data-note-de="${CSS.escape(b.dataset.note)}"]`);
    if (!p) return;
    const ouvert = p.hidden;
    p.hidden = !ouvert;
    b.setAttribute('aria-expanded', String(ouvert));
    b.classList.toggle('ouvert', ouvert);
  }, true);
}

/* ─── Ce qui n'est pas encore écrit au moment où l'on s'en va ──────────
 *
 * Un champ de formulaire ne s'enregistre qu'une fois quitté : c'est ce
 * que veut dire « change ». Tant qu'on écrit dedans, rien n'est écrit
 * nulle part — et ranger son téléphone en plein milieu, c'est perdre ce
 * qu'on venait de taper. Le cas n'a rien d'exotique : c'est même la
 * façon normale de quitter une application sur un téléphone.
 *
 * D'où ce registre. Un écran qui tient des champs à demi remplis y
 * dépose de quoi les enregistrer, et le départ le vide avant d'envoyer
 * quoi que ce soit. L'ordre importe : vider d'abord, envoyer ensuite,
 * sans quoi l'envoi partirait sans ce qu'on vient à peine d'écrire.
 */
const brouillons = new Set();

/** Dépose de quoi enregistrer ce qui traîne. Rend de quoi le retirer. */
export function aVider(fn) {
  brouillons.add(fn);
  return () => brouillons.delete(fn);
}

/** Enregistre tout ce qui traîne. Une erreur dans l'un ne doit pas
 *  empêcher les autres : on s'en va, c'est la dernière occasion. */
export function viderBrouillons() {
  for (const f of [...brouillons]) { try { f(); } catch { /* tant pis pour celui-là */ } }
}
