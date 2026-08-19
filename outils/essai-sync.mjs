/* Trois appareils, une seule vérité : on rejoue à la main ce que la
   synchronisation fait toute seule — exporter d'un côté, reprendre de
   l'autre — et l'on vérifie qu'ils finissent par dire la même chose. */
import { pathToFileURL } from 'url';

/* Le minimum de navigateur pour que le magasin s'exécute. */
const memoire = {};
globalThis.localStorage = {
  getItem: k => (k in memoire ? memoire[k] : null),
  setItem: (k, v) => { memoire[k] = String(v); },
  removeItem: k => { delete memoire[k]; },
};
globalThis.document = { dispatchEvent: () => {}, addEventListener: () => {} };
globalThis.CustomEvent = class { constructor(n, o) { this.type = n; Object.assign(this, o); } };

const url = pathToFileURL('public/js/store.js').href;

/** Un appareil = un magasin fraîchement chargé, avec son propre stockage. */
async function appareil(nom, depuis = null) {
  for (const k of Object.keys(memoire)) delete memoire[k];
  if (depuis) memoire['tennis-donnees'] = depuis;
  const m = await import(url + '?a=' + nom + '&t=' + Math.random());
  m.charger();
  return {
    nom, m,
    exporter: () => m.exporterJSON(),
    reprendre: t => m.importerJSON(t, 'fusion'),
    etat: () => m.store,
  };
}

const dit = (ok, quoi) => {
  console.log(`${ok ? '  ok  ' : '  ÉCHEC'} ${quoi}`);
  if (!ok) process.exitCode = 1;
};

/* ─── 1. Un ajout traverse ─────────────────────────────────────────── */
let A = await appareil('A');
A.m.ajouterMatch({ date: '2026-01-10', issue: 'V', adversaire: 'DUPONT', score: '6/4 6/2' });
const idM = A.etat().matchs[0].id;
const versB = A.exporter();

let B = await appareil('B', versB);
dit(B.etat().matchs.length === 1, 'B reçoit le match ajouté sur A');
dit(!!B.etat().matchs[0].modifieLe, 'le match porte une date d\'écriture');

/* ─── 2. Une correction traverse, et la plus récente gagne ─────────── */
await new Promise(r => setTimeout(r, 5));
B.m.modifierMatch(idM, { score: '7/5 6/3' });
const versA = B.exporter();

A.reprendre(versA);
dit(A.etat().matchs[0].score === '7/5 6/3', 'la correction faite sur B redescend sur A');

/* Et l'ancienne version renvoyée par un appareil en retard ne l'écrase pas. */
A.reprendre(versB);
dit(A.etat().matchs[0].score === '7/5 6/3', 'une version périmée ne réécrase pas la neuve');

/* ─── 3. Une suppression traverse, et tient ────────────────────────── */
await new Promise(r => setTimeout(r, 5));
A.m.supprimerMatch(idM);
dit(A.etat().matchs.length === 0, 'le match disparaît sur A');
dit(A.etat().supprimes.length === 1, 'la suppression laisse une trace datée');

const versB2 = A.exporter();
B.reprendre(versB2);
dit(B.etat().matchs.length === 0, 'la suppression descend sur B');

/* Le retour de flamme : B renvoie son ancien état, le match ne revit pas. */
A.reprendre(versA);
dit(A.etat().matchs.length === 0, 'un appareil en retard ne ressuscite pas le match');

/* ─── 4. Un troisième appareil, jamais synchronisé, converge ───────── */
const C = await appareil('C', versB2);
dit(C.etat().matchs.length === 0, 'un appareil neuf part du bon état');
C.m.ajouterMatch({ date: '2026-02-01', issue: 'D', adversaire: 'MARTIN' });
A.reprendre(C.exporter());
B.reprendre(C.exporter());
dit(A.etat().matchs.length === 1 && B.etat().matchs.length === 1,
    'ce que C ajoute arrive sur A et sur B');

/* ─── 5. Le profil suit la dernière écriture ───────────────────────── */
await new Promise(r => setTimeout(r, 5));
A.m.maj(s => { s.profil = { ...s.profil, echelon: '5/6', prenom: 'Arthur' }; });
B.reprendre(A.exporter());
dit(B.etat().profil.echelon === '5/6', 'le classement réglé sur A descend sur B');

await new Promise(r => setTimeout(r, 5));
B.m.maj(s => { s.profil = { ...s.profil, echelon: '4/6' }; });
A.reprendre(B.exporter());
dit(A.etat().profil.echelon === '4/6', 'et le dernier réglage gagne, dans les deux sens');

/* ─── 6. Une fusion sans nouveauté n'écrit rien ────────────────────── */
const avant = JSON.stringify(A.etat());
A.reprendre(B.exporter());
dit(JSON.stringify(A.etat()) === avant, 'une fusion sans nouveauté ne change rien');

/* ─── 7. Aucune liste n'est oubliée par la fusion ──────────────────── */
const D = await appareil('D');
const listesDuCarnet = Object.keys(D.etat())
  .filter(c => Array.isArray(D.etat()[c]) && c !== 'supprimes');
const oubliees = listesDuCarnet.filter(c => !D.m.LISTES.includes(c));
dit(oubliees.length === 0,
    'toutes les listes du carnet passent par la fusion' +
    (oubliees.length ? ' — oubliée(s) : ' + oubliees.join(', ') : ''));

/* ─── 8. Le profil entier traverse, champ par champ ────────────────── */
await new Promise(r => setTimeout(r, 5));
A.m.maj(s => {
  s.profil = { ...s.profil, prenom: 'Arthur', nom: 'Beck', licence: '1234567',
    telephone: '06', mail: 'x@y.fr', clubPrincipal: 'TENNIS DE PUYS',
    naissance: '1990-01-01', sexe: 'h', gaucher: true, coutKm: 0.3,
    coutVictoire: 4, tourneeReglee: true,
    domicile: { adresse: 'quelque part', point: [1, 2], libelle: 'quelque part' } };
});
B.reprendre(A.exporter());
const manquants = Object.keys(A.etat().profil)
  .filter(c => JSON.stringify(A.etat().profil[c]) !== JSON.stringify(B.etat().profil[c]));
dit(manquants.length === 0,
    'le profil traverse en entier' +
    (manquants.length ? ' — resté(s) en route : ' + manquants.join(', ') : ''));

/* Et il redescend dans l'autre sens, sans emporter le reste. */
await new Promise(r => setTimeout(r, 5));
B.m.maj(s => { s.profil = { ...s.profil, telephone: '07' }; });
A.reprendre(B.exporter());
dit(A.etat().profil.telephone === '07' && A.etat().profil.prenom === 'Arthur',
    'une correction du profil remonte sans effacer les autres champs');

console.log(process.exitCode ? '\nDes cas échouent.' : '\nTous les cas passent.');
