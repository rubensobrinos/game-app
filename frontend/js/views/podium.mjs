// views/podium.mjs — UI4. Eindpodium (fase FINISHED): top 3 + eigen
// samenvatting uit `game:finished`, en de rematch-knop — alleen zichtbaar voor
// de host (UI4-prompt: niet-hosts zien een wachtmelding, nooit een foutpad).
// De overgang na `game:rematch-started` regelt de viewswitcher; hier zit geen
// navigatielogica.

import { podiumTop3 } from './standings-model.mjs';

export function createPodiumView({ root, t, isHost, onRematch }) {
  root.textContent = '';

  const title = document.createElement('h2');
  title.className = 'podium-title';
  title.textContent = t('podium.title');

  const steps = document.createElement('ol');
  steps.className = 'podium-steps';

  const selfLine = document.createElement('p');
  selfLine.className = 'podium-self';
  selfLine.setAttribute('aria-live', 'polite');

  const action = document.createElement('div');
  action.className = 'podium-action';

  if (isHost) {
    const rematch = document.createElement('button');
    rematch.type = 'button';
    rematch.className = 'podium-rematch';
    rematch.textContent = t('podium.rematch');
    rematch.addEventListener('click', () => {
      rematch.disabled = true; // idempotent op UI-niveau; server is leidend
      onRematch();
    });
    action.appendChild(rematch);
  } else {
    const wait = document.createElement('p');
    wait.className = 'podium-wait';
    wait.textContent = t('podium.waitForHost');
    action.appendChild(wait);
  }

  root.append(title, steps, selfLine, action);

  function update(standings) {
    steps.textContent = '';
    const medals = ['podium.first', 'podium.second', 'podium.third'];
    podiumTop3(standings).forEach((entry, index) => {
      const item = document.createElement('li');
      item.className = `podium-step podium-step-${index + 1}${entry.isSelf ? ' is-self' : ''}`;
      const label = document.createElement('span');
      label.className = 'podium-medal';
      label.textContent = t(medals[index]);
      // Decoratief: de positie zit al in de volgorde van de <ol> (een
      // screenreader kondigt "item 1 van 3" enz. vanzelf aan) — het medaille-
      // emoji hoeft niet apart voorgelezen te worden.
      label.setAttribute('aria-hidden', 'true');
      const name = document.createElement('span');
      name.className = 'podium-name';
      name.textContent = entry.effectiveName;
      const score = document.createElement('span');
      score.className = 'podium-score';
      score.textContent = String(entry.score);
      item.append(label, name, score);
      steps.appendChild(item);
    });

    if (standings.self !== null) {
      selfLine.textContent =
        standings.self.position !== null
          ? `${t('standings.you')}: #${standings.self.position} — ${standings.self.score}`
          : `${t('standings.you')}: ${standings.self.score}`;
    } else {
      selfLine.textContent = '';
    }
  }

  return { update };
}
