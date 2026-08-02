// app.mjs — UI0. Entry point (`<script type="module">`), geladen vanuit
// `index.html`. Op dit moment vult geen enkel scherm (`js/views/`) zich nog —
// dat is UI1–UI5. Dit bestand bewijst alleen dat de module-graf laadt: het
// past i18n toe en zet een minimale, zichtbare placeholder in de root-
// container.

import { applyI18n } from './i18n.mjs';

const ROOT_ID = 'app-root';

function renderReadyPlaceholder() {
  const root = document.getElementById(ROOT_ID);
  if (root === null) {
    return;
  }

  // Nooit innerHTML: een tekstnode via textContent/data-i18n, ook al is er
  // hier nog geen gebruikersinvoer in het spel — precedent voor de rest van
  // frontend/ (UI0-scaffold.md §Regels).
  const message = document.createElement('p');
  message.dataset.i18n = 'scaffold.ready';
  root.textContent = '';
  root.appendChild(message);
}

function main() {
  renderReadyPlaceholder();
  applyI18n();
  console.log('[frontend] UI0 scaffold loaded — no screens are wired up yet.');
}

main();
