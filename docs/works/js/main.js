/**
 * App entry point: What's New gate → default profile gate → list/detail navigation.
 * Mirrors android/.../MainActivity.kt and Navigation.kt.
 */

import { ProfilePrefs } from './prefs.js';
import { createRepository } from './repository.js';
import { createWorksViewModel } from './viewmodel.js';
import { createDefaultProfileSetupScreen } from './ui/setupScreen.js';
import { createDetailScreen } from './ui/detailScreen.js';
import { createMainScreen } from './ui/mainScreen.js';
import {
  createWhatsNewScreen,
  loadReleaseNotes,
  markReleaseNotesSeen,
  shouldShowReleaseNotes,
} from './ui/whatsNew.js';

const appRoot = document.getElementById('app');

function mount(screen) {
  appRoot.replaceChildren(screen.root);
}

async function boot() {
  const notes = await loadReleaseNotes();
  if (shouldShowReleaseNotes(notes)) {
    mount(
      createWhatsNewScreen({
        notes,
        onContinue: () => {
          markReleaseNotesSeen(notes);
          startDefaultProfileGate();
        },
      }),
    );
    return;
  }
  startDefaultProfileGate();
}

function startDefaultProfileGate() {
  if (ProfilePrefs.isDefaultProfileSetupComplete) {
    startApp();
    return;
  }
  mount(
    createDefaultProfileSetupScreen({
      onContinue: (profile) => {
        ProfilePrefs.completeDefaultProfileSetup(profile.id);
        startApp();
      },
    }),
  );
}

function startApp() {
  const viewModel = createWorksViewModel({ repository: createRepository() });

  const mainScreen = createMainScreen({
    viewModel,
    onWorkClick: (rowNum) => {
      window.location.hash = `#/work/${rowNum}`;
    },
  });

  /** `null` on the list, otherwise the row number of the open detail view. */
  let openDetailRow = null;
  /** Whether the mounted detail view found its work — a deep link can land before the sheet loads. */
  let detailHasWork = false;

  function showMain() {
    openDetailRow = null;
    detailHasWork = false;
    mount(mainScreen);
    mainScreen.render(viewModel.getState());
  }

  function showDetail(rowNum) {
    const work = viewModel.findWork(rowNum);
    openDetailRow = rowNum;
    detailHasWork = work !== null;
    mount(createDetailScreen({ work, onBack: () => window.history.back() }));
    window.scrollTo(0, 0);
  }

  function route() {
    const match = /^#\/work\/(-?\d+)$/.exec(window.location.hash);
    if (match) showDetail(Number.parseInt(match[1], 10));
    else showMain();
  }

  viewModel.subscribe((state) => {
    if (openDetailRow === null) {
      mainScreen.render(state);
      return;
    }
    // A deep-linked detail view opened before the sheet loaded — fill it in once the work arrives.
    if (!detailHasWork && viewModel.findWork(openDetailRow)) showDetail(openDetailRow);
  });

  window.addEventListener('hashchange', route);
  route();

  viewModel.start();
}

if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* Offline caching is a bonus; the app still works without it. */
    });
  });
}

boot();
