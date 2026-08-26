/**
 * Workflow Updater — web app boot layer.
 *
 * This file is what turns the canonical dashboard (windows/) into a hosted,
 * serverless web app. It is loaded between config.js and app.js and adds the
 * three things a browser-only deployment needs and the desktop build does not:
 *
 *   1. Runtime settings — Apps Script URL / Sheet ID / tab name are editable in
 *      the UI and stored in localStorage, so nobody has to edit config.js.
 *   2. Offline reads — the last successful sheet payload is cached locally and
 *      replayed when the network (or Apps Script) is unreachable.
 *   3. App shell — service worker registration, install prompt and an
 *      offline / update status pill.
 *
 * app.js and config.js are copied verbatim from windows/ and are never patched.
 */
(function () {
  'use strict';

  var SETTINGS_KEY = 'wu.web.settings.v1';
  var SHEET_CACHE_KEY = 'wu.web.sheetCache.v1';
  var SCRIPT_HOST_RE = /^https?:\/\/script\.google(usercontent)?\.com\//i;

  var params = new URLSearchParams(window.location.search);
  var settings = readSettings();
  var sheetCache = { fromCache: false, savedAt: 0 };
  var deferredInstallPrompt = null;
  var updateRequested = false;
  var reloadingForUpdate = false;

  // ---------------------------------------------------------------------------
  // Phase 1 — configuration, applied before app.js reads window.CONFIG
  // ---------------------------------------------------------------------------

  function readSettings() {
    var defaults = {
      scriptUrl: '',
      spreadsheetId: '',
      sheetName: '',
      simulation: null,
      profileUrls: {}
    };
    try {
      var raw = window.localStorage.getItem(SETTINGS_KEY);
      if (!raw) return defaults;
      var parsed = JSON.parse(raw);
      return Object.assign(defaults, parsed && typeof parsed === 'object' ? parsed : {});
    } catch (err) {
      return defaults;
    }
  }

  function writeSettings(next) {
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      return true;
    } catch (err) {
      return false;
    }
  }

  function applySettings() {
    var config = window.CONFIG;
    if (!config) return;

    if (settings.scriptUrl) config.SCRIPT_URL = settings.scriptUrl;
    if (settings.spreadsheetId) config.SPREADSHEET_ID = settings.spreadsheetId;
    if (settings.sheetName) config.SHEET_NAME = settings.sheetName;
    if (typeof settings.simulation === 'boolean') config.SIMULATION_MODE = settings.simulation;

    if (settings.profileUrls && Array.isArray(config.PROFILES)) {
      config.PROFILES.forEach(function (profile) {
        var url = settings.profileUrls[profile.id];
        if (url) profile.scriptUrl = url;
      });
    }

    // ?demo=1 shows the bundled sample data without touching saved settings.
    if (params.get('demo') === '1') config.SIMULATION_MODE = true;

    // ?profile=ASE01 lets each engineer bookmark their own view.
    var wanted = params.get('profile');
    if (wanted && Array.isArray(config.PROFILES)) {
      var match = config.PROFILES.find(function (profile) {
        return profile.id.toLowerCase() === wanted.toLowerCase();
      });
      if (match) {
        try {
          window.localStorage.setItem('activeProfileId', match.id);
        } catch (err) {
          /* private mode — the default profile still loads */
        }
      }
    }
  }

  function activeScriptUrl() {
    var config = window.CONFIG || {};
    var profiles = Array.isArray(config.PROFILES) ? config.PROFILES : [];
    var activeId = null;
    try {
      activeId = window.localStorage.getItem('activeProfileId');
    } catch (err) {
      activeId = null;
    }
    activeId = activeId || config.DEFAULT_PROFILE_ID;
    var profile = profiles.find(function (item) {
      return item.id === activeId;
    });
    return (profile && profile.scriptUrl) || config.SCRIPT_URL || '';
  }

  // ---------------------------------------------------------------------------
  // Phase 2 — offline-tolerant sheet reads
  // ---------------------------------------------------------------------------

  function isSheetReadUrl(url) {
    if (!url) return false;
    if (SCRIPT_HOST_RE.test(url)) return true;
    var configured = activeScriptUrl();
    return Boolean(configured) && url.indexOf(configured) === 0;
  }

  function saveSheetPayload(sourceUrl, payload) {
    try {
      window.localStorage.setItem(
        SHEET_CACHE_KEY,
        JSON.stringify({ savedAt: Date.now(), sourceUrl: sourceUrl, payload: payload })
      );
    } catch (err) {
      // Quota exceeded (very large sheets): drop the cache rather than break sync.
      try {
        window.localStorage.removeItem(SHEET_CACHE_KEY);
      } catch (ignored) {
        /* nothing else to do */
      }
    }
  }

  function readSheetPayload(sourceUrl) {
    try {
      var raw = window.localStorage.getItem(SHEET_CACHE_KEY);
      if (!raw) return null;
      var entry = JSON.parse(raw);
      if (!entry || !entry.payload) return null;
      // Never show one office's cached rows against another endpoint.
      if (entry.sourceUrl && sourceUrl && entry.sourceUrl !== sourceUrl) return null;
      return entry;
    } catch (err) {
      return null;
    }
  }

  function clearSheetPayload() {
    try {
      window.localStorage.removeItem(SHEET_CACHE_KEY);
    } catch (err) {
      /* ignore */
    }
  }

  function installFetchCache() {
    if (typeof window.fetch !== 'function') return;
    var nativeFetch = window.fetch.bind(window);

    window.fetch = function (input, init) {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      var method = ((init && init.method) || (input && input.method) || 'GET').toUpperCase();

      if (method !== 'GET' || !isSheetReadUrl(url)) return nativeFetch(input, init);

      var baseUrl = url.split('?')[0];

      return nativeFetch(input, init).then(
        function (response) {
          if (!response.ok) return replayCache(baseUrl, new Error('HTTP ' + response.status), response);
          // A live answer clears any "showing saved data" state from an earlier sync.
          sheetCache.fromCache = false;
          updateStatusPill();
          return response
            .clone()
            .json()
            .then(function (data) {
              if (data && data.success) {
                sheetCache.savedAt = Date.now();
                saveSheetPayload(baseUrl, data);
              }
              return response;
            })
            .catch(function () {
              return response;
            });
        },
        function (err) {
          return replayCache(baseUrl, err, null);
        }
      );
    };
  }

  function replayCache(baseUrl, err, fallbackResponse) {
    var entry = readSheetPayload(baseUrl);
    if (!entry) {
      if (fallbackResponse) return fallbackResponse;
      throw err;
    }
    sheetCache.fromCache = true;
    sheetCache.savedAt = entry.savedAt || 0;
    window.setTimeout(announceCachedData, 400);
    return new Response(JSON.stringify(entry.payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  function announceCachedData() {
    var stamp = formatSavedAt(sheetCache.savedAt);
    if (typeof window.showToast === 'function') {
      window.showToast('Offline copy — showing sheet data saved ' + stamp, 'warning');
    }
    updateStatusPill();
  }

  function formatSavedAt(timestamp) {
    if (!timestamp) return 'earlier';
    var date = new Date(timestamp);
    var today = new Date();
    var sameDay =
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
    var time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return sameDay ? 'at ' + time : 'on ' + date.toLocaleDateString() + ' ' + time;
  }

  // ---------------------------------------------------------------------------
  // Phase 3 — web-only UI, after app.js has finished its own init()
  // ---------------------------------------------------------------------------

  function injectStyles() {
    var style = document.createElement('style');
    style.textContent = [
      // Sits to the right of the add-work FAB (fixed at bottom-left) so the two never overlap.
      '.wu-status-pill{position:fixed;left:6.4rem;bottom:2.15rem;z-index:901;display:none;align-items:center;',
      'gap:.5rem;padding:.6rem .95rem;border-radius:var(--radius-md);font-size:.8rem;font-weight:600;',
      'font-family:var(--font-sans);border:1px solid var(--border-color);background:var(--bg-panel);',
      'backdrop-filter:blur(12px);color:var(--text-secondary);box-shadow:var(--shadow-card);cursor:default;',
      'max-width:min(30rem,calc(100vw - 8rem));}',
      '.wu-status-pill.visible{display:flex;}',
      '.wu-status-pill.offline{border-color:var(--color-warning);color:var(--color-warning);',
      'background:var(--color-warning-bg);}',
      '.wu-status-pill.update{border-color:var(--color-accent);color:var(--text-primary);cursor:pointer;}',
      '.wu-status-pill .wu-dot{width:8px;height:8px;border-radius:50%;background:currentColor;flex-shrink:0;}',
      '.wu-hint{color:var(--text-muted);font-size:.82rem;line-height:1.55;margin-bottom:1.25rem;}',
      '.wu-hint code{font-family:var(--font-mono);font-size:.78rem;color:var(--text-secondary);}',
      '.wu-meta{margin-top:.35rem;padding:.85rem 1rem;border:1px dashed var(--border-color);',
      'border-radius:var(--radius-md);color:var(--text-muted);font-size:.78rem;line-height:1.6;}',
      '.wu-meta strong{color:var(--text-secondary);font-weight:600;}',
      '.wu-linkbtn{background:none;border:none;padding:0;color:var(--color-info);cursor:pointer;',
      'font:inherit;font-weight:600;text-decoration:underline;}',
      '@media (max-width:640px){.wu-status-pill{left:6.15rem;right:.75rem;bottom:2.15rem;font-size:.72rem;',
      'padding:.5rem .75rem;max-width:none;}}',
      '@media print{.wu-status-pill{display:none !important;}}'
    ].join('');
    document.head.appendChild(style);
  }

  function iconGear() {
    return (
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">' +
      '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>'
    );
  }

  function iconInstall() {
    return (
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">' +
      '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/>' +
      '<line x1="12" y1="15" x2="12" y2="3"/></svg>'
    );
  }

  function iconClose() {
    return (
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">' +
      '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
    );
  }

  function injectControls() {
    var panel = document.querySelector('.controls-panel');
    if (!panel) return;

    var settingsBtn = document.createElement('button');
    settingsBtn.type = 'button';
    settingsBtn.id = 'wu-settings-btn';
    settingsBtn.className = 'toggle-simulation-btn';
    settingsBtn.title = 'Connect this browser to your Google Sheet';
    settingsBtn.innerHTML = iconGear() + ' Settings';
    settingsBtn.addEventListener('click', openSettings);

    var installBtn = document.createElement('button');
    installBtn.type = 'button';
    installBtn.id = 'wu-install-btn';
    installBtn.className = 'toggle-simulation-btn';
    installBtn.title = 'Install the dashboard as an app on this device';
    installBtn.innerHTML = iconInstall() + ' Install App';
    installBtn.style.display = 'none';
    installBtn.addEventListener('click', promptInstall);

    var searchWrapper = panel.querySelector('.search-wrapper');
    if (searchWrapper) {
      panel.insertBefore(settingsBtn, searchWrapper);
      panel.insertBefore(installBtn, searchWrapper);
    } else {
      panel.appendChild(settingsBtn);
      panel.appendChild(installBtn);
    }

    var pill = document.createElement('div');
    pill.className = 'wu-status-pill';
    pill.id = 'wu-status-pill';
    document.body.appendChild(pill);
  }

  function buildSettingsModal() {
    var config = window.CONFIG || {};
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'wu-settings-modal';
    overlay.innerHTML = [
      '<div class="modal-window" style="max-width:600px">',
      '  <div class="modal-header">',
      '    <h3>Web App Settings</h3>',
      '    <button type="button" class="close-btn" id="wu-settings-close">' + iconClose() + '</button>',
      '  </div>',
      '  <form id="wu-settings-form">',
      '    <div class="modal-body">',
      '      <p class="wu-hint">Saved in this browser only — nothing is uploaded. Leave a field blank to',
      '      use the value shipped in <code>config.js</code>. Deploy <code>google_apps_script.js</code> as a',
      '      Web App with access set to <strong>Anyone</strong>, then paste its <code>/exec</code> URL below.</p>',
      '      <div class="form-group">',
      '        <label>Apps Script Web App URL</label>',
      '        <input type="url" id="wu-script-url" placeholder="https://script.google.com/macros/s/AKfy.../exec">',
      '      </div>',
      '      <div class="form-group">',
      '        <label>Google Sheet ID</label>',
      '        <input type="text" id="wu-spreadsheet-id" placeholder="1tDBZGf...">',
      '      </div>',
      '      <div class="form-group">',
      '        <label>Sheet tab name</label>',
      '        <input type="text" id="wu-sheet-name" placeholder="WORKFLOW MONITORING SHEET">',
      '      </div>',
      '      <div class="form-group">',
      '        <label>Data source</label>',
      '        <select id="wu-simulation">',
      '          <option value="live">Live Google Sheet</option>',
      '          <option value="demo">Demo data (bundled sample)</option>',
      '        </select>',
      '      </div>',
      '      <div class="wu-meta" id="wu-settings-meta"></div>',
      '    </div>',
      '    <div class="modal-footer">',
      '      <button type="button" class="btn btn-secondary" id="wu-settings-reset">Reset to defaults</button>',
      '      <button type="submit" class="btn btn-primary">Save &amp; reload</button>',
      '    </div>',
      '  </form>',
      '</div>'
    ].join('\n');
    document.body.appendChild(overlay);

    document.getElementById('wu-script-url').value = settings.scriptUrl || '';
    document.getElementById('wu-spreadsheet-id').value = settings.spreadsheetId || '';
    document.getElementById('wu-sheet-name').value = settings.sheetName || '';
    document.getElementById('wu-simulation').value =
      (typeof settings.simulation === 'boolean' ? settings.simulation : config.SIMULATION_MODE)
        ? 'demo'
        : 'live';

    overlay.addEventListener('click', function (event) {
      if (event.target === overlay) closeSettings();
    });
    document.getElementById('wu-settings-close').addEventListener('click', closeSettings);
    document.getElementById('wu-settings-reset').addEventListener('click', function () {
      try {
        window.localStorage.removeItem(SETTINGS_KEY);
      } catch (err) {
        /* ignore */
      }
      clearSheetPayload();
      window.location.reload();
    });
    document.getElementById('wu-settings-form').addEventListener('submit', function (event) {
      event.preventDefault();
      var next = {
        scriptUrl: document.getElementById('wu-script-url').value.trim(),
        spreadsheetId: document.getElementById('wu-spreadsheet-id').value.trim(),
        sheetName: document.getElementById('wu-sheet-name').value.trim(),
        simulation: document.getElementById('wu-simulation').value === 'demo',
        profileUrls: settings.profileUrls || {}
      };
      if (!writeSettings(next) && typeof window.showToast === 'function') {
        window.showToast('Could not save settings — browser storage is blocked.', 'error');
        return;
      }
      window.location.reload();
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && overlay.classList.contains('active')) closeSettings();
    });
  }

  function renderSettingsMeta() {
    var meta = document.getElementById('wu-settings-meta');
    if (!meta) return;
    var config = window.CONFIG || {};
    var entry = readSheetPayload(null);
    var rows = entry && entry.payload && Array.isArray(entry.payload.rows) ? entry.payload.rows.length : 0;

    meta.innerHTML = [
      '<div><strong>In use now:</strong> ' + (activeScriptUrl() ? 'live endpoint configured' : 'no endpoint set') + '</div>',
      '<div><strong>Sheet tab:</strong> ' + escapeHtml(config.SHEET_NAME || '—') + '</div>',
      '<div><strong>Offline copy:</strong> ' +
        (entry ? rows + ' rows saved ' + formatSavedAt(entry.savedAt) : 'none yet') +
        (entry ? ' · <button type="button" class="wu-linkbtn" id="wu-clear-cache">Clear</button>' : '') +
        '</div>'
    ].join('');

    var clearBtn = document.getElementById('wu-clear-cache');
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        clearSheetPayload();
        renderSettingsMeta();
        if (typeof window.showToast === 'function') window.showToast('Offline copy cleared.', 'info');
      });
    }
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
    });
  }

  function openSettings() {
    var overlay = document.getElementById('wu-settings-modal');
    if (!overlay) return;
    renderSettingsMeta();
    overlay.classList.add('active');
  }

  function closeSettings() {
    var overlay = document.getElementById('wu-settings-modal');
    if (overlay) overlay.classList.remove('active');
  }

  // --- status pill -----------------------------------------------------------

  function setPill(text, modifier, onClick) {
    var pill = document.getElementById('wu-status-pill');
    if (!pill) return;
    if (!text) {
      pill.className = 'wu-status-pill';
      pill.onclick = null;
      pill.innerHTML = '';
      return;
    }
    pill.className = 'wu-status-pill visible ' + (modifier || '');
    pill.innerHTML = '<span class="wu-dot"></span><span>' + escapeHtml(text) + '</span>';
    pill.onclick = onClick || null;
  }

  function updateStatusPill() {
    if (document.getElementById('wu-status-pill') && document.getElementById('wu-status-pill').classList.contains('update')) {
      return; // an available update outranks the connection state
    }
    if (!navigator.onLine) {
      setPill(
        sheetCache.fromCache
          ? 'Offline — showing data saved ' + formatSavedAt(sheetCache.savedAt)
          : 'Offline — changes cannot be saved',
        'offline'
      );
      return;
    }
    if (sheetCache.fromCache) {
      setPill('Sheet unavailable — showing data saved ' + formatSavedAt(sheetCache.savedAt), 'offline');
      return;
    }
    setPill('');
  }

  function wireNetworkEvents() {
    window.addEventListener('offline', updateStatusPill);
    window.addEventListener('online', function () {
      updateStatusPill();
      if (typeof window.loadData === 'function') {
        if (typeof window.showToast === 'function') window.showToast('Back online — re-syncing sheet…', 'info');
        window.loadData();
      }
    });
    updateStatusPill();
  }

  // --- install prompt --------------------------------------------------------

  function wireInstallPrompt() {
    window.addEventListener('beforeinstallprompt', function (event) {
      event.preventDefault();
      deferredInstallPrompt = event;
      var btn = document.getElementById('wu-install-btn');
      if (btn) btn.style.display = 'flex';
    });
    window.addEventListener('appinstalled', function () {
      deferredInstallPrompt = null;
      var btn = document.getElementById('wu-install-btn');
      if (btn) btn.style.display = 'none';
      if (typeof window.showToast === 'function') window.showToast('Installed! Launch it like any other app.', 'success');
    });
  }

  function promptInstall() {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.finally(function () {
      deferredInstallPrompt = null;
      var btn = document.getElementById('wu-install-btn');
      if (btn) btn.style.display = 'none';
    });
  }

  // --- service worker --------------------------------------------------------

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    var secure = window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!secure) return;

    navigator.serviceWorker
      .register('sw.js', { scope: './' })
      .then(function (registration) {
        registration.addEventListener('updatefound', function () {
          var incoming = registration.installing;
          if (!incoming) return;
          incoming.addEventListener('statechange', function () {
            if (incoming.state === 'installed' && navigator.serviceWorker.controller) {
              setPill('Update ready — tap to reload', 'update', function () {
                updateRequested = true;
                incoming.postMessage({ type: 'SKIP_WAITING' });
              });
            }
          });
        });
        window.setInterval(function () {
          registration.update().catch(function () {});
        }, 60 * 60 * 1000);
      })
      .catch(function () {
        /* offline support simply stays off */
      });

    // Only reload when the user asked for the update. The first visit also fires
    // controllerchange (the fresh worker calls clients.claim), and reloading there
    // would throw the user out of a page they just opened.
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!updateRequested || reloadingForUpdate) return;
      reloadingForUpdate = true;
      window.location.reload();
    });
  }

  // --- first run -------------------------------------------------------------

  function checkFirstRun() {
    var config = window.CONFIG || {};
    if (config.SIMULATION_MODE) return;
    if (activeScriptUrl()) return;
    if (typeof window.showToast === 'function') {
      window.showToast('No Google Sheet connected yet — add your Apps Script URL in Settings.', 'warning');
    }
    openSettings();
  }

  function warnAboutFileProtocol() {
    if (window.location.protocol !== 'file:') return;
    if (typeof window.showToast === 'function') {
      window.showToast(
        'Opened from a local file — browsers block live sheet access here. Use the hosted URL instead.',
        'warning'
      );
    }
  }

  function boot() {
    injectStyles();
    injectControls();
    buildSettingsModal();
    wireNetworkEvents();
    wireInstallPrompt();
    registerServiceWorker();
    warnAboutFileProtocol();
    checkFirstRun();
  }

  applySettings();
  installFetchCache();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      window.setTimeout(boot, 0);
    });
  } else {
    window.setTimeout(boot, 0);
  }
})();
