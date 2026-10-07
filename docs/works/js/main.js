/**
 * App entry point: What's New gate → default profile gate → list/detail navigation.
 * Mirrors android/.../MainActivity.kt and Navigation.kt.
 */

import { ProfilePrefs } from './prefs.js';
import { createRepository } from './repository.js';
import { createWorksViewModel } from './viewmodel.js';
import { applyDesktopLayout } from './ui/deviceLayout.js';
import { createDefaultProfileSetupScreen } from './ui/setupScreen.js';
import { createBulkScreen } from './ui/bulkScreen.js';
import { createDetailScreen } from './ui/detailScreen.js';
import { createMainScreen } from './ui/mainScreen.js';
import {
  createWhatsNewScreen,
  loadReleaseNotes,
  markReleaseNotesSeen,
  shouldShowReleaseNotes,
} from './ui/whatsNew.js';

const appRoot = document.getElementById('app');

// Decide phone column vs. full-window desktop before the first screen is mounted.
applyDesktopLayout();

function mount(screen) {
  appRoot.replaceChildren(screen.root);
}

const BULK_HASH = '#/bulk';
const isBulkRoute = () => window.location.hash === BULK_HASH;

async function boot() {
  // A link straight to the Excel screen skips the gates: it needs no profile and no sheet read.
  if (isBulkRoute()) {
    openBulkStandalone();
    return;
  }

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

/** The Excel screen opened before the app itself; leaving it starts the app as normal. */
function openBulkStandalone() {
  const leave = () => {
    window.removeEventListener('hashchange', onHashChange);
    if (isBulkRoute()) window.history.replaceState(null, '', window.location.pathname + window.location.search);
    boot();
  };
  const onHashChange = () => {
    if (!isBulkRoute()) leave();
  };
  window.addEventListener('hashchange', onHashChange);
  mount(createBulkScreen({ onBack: leave }));
  window.scrollTo(0, 0);
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
    onOpenBulk: () => {
      window.location.hash = BULK_HASH;
    },
  });

  /** `null` on the list, otherwise the row number of the open detail view. */
  let openDetailRow = null;
  /** Whether the mounted detail view found its work — a deep link can land before the sheet loads. */
  let detailHasWork = false;
  /** Whether the Excel screen is mounted; the list keeps loading behind it but stays unmounted. */
  let bulkOpen = false;

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

  function showBulk() {
    openDetailRow = null;
    detailHasWork = false;
    bulkOpen = true;
    mount(createBulkScreen({ onBack: () => window.history.back() }));
    window.scrollTo(0, 0);
  }

  function route() {
    bulkOpen = false;
    if (isBulkRoute()) {
      showBulk();
      return;
    }
    const match = /^#\/work\/(-?\d+)$/.exec(window.location.hash);
    if (match) showDetail(Number.parseInt(match[1], 10));
    else showMain();
  }

  viewModel.subscribe((state) => {
    if (bulkOpen) return;
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
