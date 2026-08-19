/* Les photos d'un match.

   ─── Pourquoi elles sont réduites avant d'entrer ─────────────────────

   Une photo de téléphone pèse trois à six méga-octets. Le carnet vit dans
   le stockage local du navigateur, qui en offre cinq en tout — et c'est
   ce même stockage qui part en ligne à chaque synchronisation. Deux
   photos brutes, et le carnet ne s'enregistre plus : ni le match qu'on
   vient de saisir, ni les trois conseils notés après le cours.

   On réduit donc à l'entrée, une fois pour toutes : mille deux cents
   pixels sur le grand côté, en JPEG. C'est plus que ce qu'un téléphone
   affiche, et cela ramène une photo à cent ou deux cents kilo-octets. La
   remise des prix reste lisible, la raquette cassée aussi ; ce qu'on perd
   est ce qu'on n'aurait jamais regardé.

   Le PNG et le HEIC entrent également : le navigateur les décode, et l'on
   ressort du JPEG dans tous les cas — un PNG de photographie pèse trois
   fois le JPEG pour la même image.
*/

const COTE_MAX = 1200;
const QUALITE = 0.6;

/** Le poids d'une image encodée en base64, en octets — approché mais de
 *  très près : quatre caractères pour trois octets, moins le remplissage. */
export const poidsDe = src => Math.round(((src || '').length - 22) * 3 / 4);

export const poidsLisible = o =>
  o >= 1e6 ? `${(o / 1e6).toFixed(1)} Mo` : `${Math.max(1, Math.round(o / 1e3))} Ko`;

/** Réduit un fichier image et le rend en JPEG, prêt à ranger.
 *
 *  Rend `null` si le fichier n'est pas une image que le navigateur sait
 *  ouvrir — un document renommé, un format qu'il ne connaît pas. On ne
 *  devine pas à la place de l'appelant : il dira ce qu'il veut en dire.
 */
export async function reduire(fichier) {
  if (!fichier || !/^image\//.test(fichier.type || '')) return null;

  const image = await chargerImage(fichier);
  if (!image) return null;

  const { width: l, height: hn } = image;
  const facteur = Math.min(1, COTE_MAX / Math.max(l, hn));
  const w = Math.max(1, Math.round(l * facteur));
  const h = Math.max(1, Math.round(hn * facteur));

  const toile = document.createElement('canvas');
  toile.width = w;
  toile.height = h;
  const ctx = toile.getContext('2d');
  /* Un fond blanc avant de dessiner : un PNG transparent tourné en JPEG
     donne sinon un aplat noir là où il n'y avait rien. */
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(image, 0, 0, w, h);
  image.close?.();

  const src = toile.toDataURL('image/jpeg', QUALITE);
  return { src, w, h, poids: poidsDe(src) };
}

/** L'image décodée, par le chemin le plus court que le navigateur offre.
 *
 *  `createImageBitmap` redresse les photos prises de travers — l'appareil
 *  note l'orientation dans un coin du fichier plutôt que de tourner les
 *  pixels, et une balise `img` la respecte quand un canvas l'ignore. Là où
 *  il manque, on retombe sur l'ancienne méthode.
 */
async function chargerImage(fichier) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(fichier, { imageOrientation: 'from-image' }); }
    catch { /* format refusé : on tente l'autre chemin */ }
  }
  return new Promise(resolve => {
    const url = URL.createObjectURL(fichier);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

/** Les photos d'un match, quelle que soit la façon dont elles ont été
 *  rangées. Les premières versions n'écrivaient qu'une adresse ; les
 *  suivantes ajoutent les dimensions. Lire les deux coûte trois lignes et
 *  évite d'avoir à retoucher les carnets déjà remplis. */
export const photosDe = m => (m?.photos || [])
  .map(p => (typeof p === 'string' ? { src: p } : p))
  .filter(p => p && p.src);
