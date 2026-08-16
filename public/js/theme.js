/* Clair, sombre, ou comme l'appareil.

   Trois états et non deux : « comme l'appareil » est le bon défaut, mais
   il ne suffit pas ici. Ce carnet se consulte surtout dehors, sur un court
   en plein soleil, où le mode sombre devient illisible — et ce moment-là
   ne correspond à aucun réglage du téléphone.

   Le choix est local à l'appareil, jamais partagé : le téléphone du court
   et l'ordinateur du bureau n'ont ni le même écran ni le même usage. */

const CLE = 'tennis-theme';
const CYCLE = ['auto', 'light', 'dark'];

export const ETIQUETTES = {
  auto:  { emoji: '🌗', mot: 'Comme l\'appareil' },
  light: { emoji: '☀️', mot: 'Clair' },
  dark:  { emoji: '🌙', mot: 'Sombre' },
};

/* La barre d'état du téléphone se teinte de cette couleur. Elle doit
   suivre le fond, sinon une bande claire reste collée en haut d'un écran
   sombre. */
const FOND = { light: '#f4f6f4', dark: '#0f1411' };

const lu = () => {
  try {
    const v = localStorage.getItem(CLE);
    return CYCLE.includes(v) ? v : 'auto';
  } catch { return 'auto'; }
};

export const themeActuel = () => lu();

/** Ce qu'on voit vraiment : « auto » se résout en clair ou sombre. */
export const themeEffectif = () => {
  const t = lu();
  if (t !== 'auto') return t;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export function appliquerTheme() {
  const t = lu();
  const html = document.documentElement;
  // Pas d'attribut du tout en « auto » : le media query reprend la main.
  if (t === 'auto') delete html.dataset.theme;
  else html.dataset.theme = t;

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', FOND[themeEffectif()]);
}

/** Passe au thème suivant et rend son nom, pour le message affiché. */
export function themeSuivant() {
  const suivant = CYCLE[(CYCLE.indexOf(lu()) + 1) % CYCLE.length];
  try { localStorage.setItem(CLE, suivant); } catch { /* stockage refusé */ }
  appliquerTheme();
  return suivant;
}

/* En « auto », le système peut basculer pendant que la page est ouverte.
   La barre d'état doit suivre. */
matchMedia('(prefers-color-scheme: dark)')
  .addEventListener('change', () => { if (lu() === 'auto') appliquerTheme(); });
