import * as sass from "sass";
import { join } from "node:path";

function dropOverlayCss(): string {
	return sass
		.compile(join(process.cwd(), "src", "app", "app.component.sass"), { style: "expanded" })
		.css.replaceAll("::ng-deep", "");
}

/** Light-DOM Cult Podcasts chrome + submit dialogs, with a live HTTP overlay. */
export function submitUrlFlowsDocument(): string {
	const overlayCss = dropOverlayCss();
	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Submit URL flows</title>
  <style>
    :root {
      --cp-ink: #0b0d12;
      --cp-ink-elevated: #141821;
      --cp-amber: #e8a23a;
      --cp-radius: 14px;
      --cp-font-display: Georgia, serif;
      --cp-font-ui: 'Segoe UI', sans-serif;
      --mat-sys-on-surface: #e8d5c4;
      --mat-sys-outline-variant: #5a443c;
    }
    html, body { height: 100%; margin: 0; }
    body {
      font-family: var(--cp-font-ui);
      color: #e8d5c4;
      background: var(--cp-ink);
      overflow: hidden;
    }
    .layout { display: flex; height: 100vh; min-height: 0; }
    ${overlayCss}
    /* AFTER injected sass: app .drop-overlay is position:fixed; inset:0 (full viewport). Pin it to .stage. */
    .stage { position: relative; overflow: hidden; flex: 1 1 auto; min-width: 0; }
    .stage .drop-overlay {
      position: absolute !important;
      inset: 0 !important;
      z-index: 1000;
    }
    .drop-overlay [hidden] { display: none !important; }
    .stage .drop-overlay.drop-overlay--home #drop-podcast,
    .stage .drop-overlay.drop-overlay--home .drop-targets,
    #drop-park, #drop-park .drop-targets { display: none !important; }
    #http-overlay { position: relative; z-index: 2000; flex-shrink: 0; min-height: 0; }
    .app-toolbar {
      display: flex; align-items: center; gap: 12px;
      height: 58px; padding: 0 16px;
      background: #11141a; box-sizing: border-box;
      border-bottom: 1px solid #2a303c;
    }
    #site { color: #e8d5c4; text-decoration: none; font-family: var(--cp-font-display); font-size: 1.15rem; }
    #auth-badge {
      margin-left: auto; font-size: 12px; color: #9aa3b2;
      border: 1px solid #3a4250; border-radius: 999px; padding: 4px 10px;
    }
    #add-podcast {
      background: transparent; border: 0; color: var(--cp-amber);
      font: inherit; cursor: pointer; padding: 8px 10px;
    }
    .page-main { padding: 28px 32px; }
    .page-main h1 { font-family: var(--cp-font-display); font-weight: 400; margin: 0 0 8px; }
    .page-main p { opacity: 0.8; max-width: 36rem; }
    .ghost-url {
      display: none; position: absolute; z-index: 1100; left: 8%; top: 40%;
      max-width: calc(100% - 24px); box-sizing: border-box;
      padding: 10px 14px; border-radius: 8px; background: #1c222e;
      border: 1px dashed var(--cp-amber); font-size: 13px; pointer-events: none;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .ghost-url.visible { display: block; }
    .dialog-scrim {
      display: none; position: absolute; inset: 0; z-index: 1200;
      align-items: center; justify-content: center;
      background: color-mix(in srgb, var(--cp-ink) 55%, transparent);
    }
    .dialog-scrim.open { display: flex; }
    .dialog {
      width: min(440px, 92%); background: #1a1f2a; border-radius: var(--cp-radius);
      border: 1px solid #3a4250; padding: 8px 8px 12px; box-shadow: 0 16px 48px #0008;
    }
    .dialog h2 { font-family: var(--cp-font-display); font-weight: 400; margin: 12px 16px 8px; font-size: 1.35rem; }
    .dialog-body { padding: 8px 16px 16px; }
    .field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 14px; }
    .field label { font-size: 12px; opacity: 0.7; }
    .field input {
      font: inherit; padding: 10px 12px; border-radius: 8px; border: 1px solid #5a443c;
      background: #12151c; color: #e8d5c4;
    }
    .known-series { margin: 0 0 1rem; color: #c4b4a4; }
    .series-panel { border: 1px solid #3a4250; border-radius: 8px; padding: 10px 12px; margin-bottom: 12px; }
    .series-panel h3 { margin: 0 0 8px; font-size: 0.95rem; font-weight: 500; }
    .dialog-actions { display: flex; justify-content: flex-end; gap: 8px; padding: 0 12px; }
    .dialog-actions button, .conflict-pick {
      font: inherit; background: #2c211c; color: #e8d5c4; border: 1px solid #d4a394;
      border-radius: 6px; padding: 8px 14px; cursor: pointer;
    }
    .dialog-actions .primary { background: #3a2a18; border-color: var(--cp-amber); color: var(--cp-amber); }
    .dialog-actions button:disabled { opacity: 0.45; cursor: default; }
    .conflict-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
    .conflict-pick { width: 100%; text-align: left; display: flex; flex-direction: column; gap: 2px; }
    .conflict-pick .meta { font-size: 12px; opacity: 0.75; word-break: break-all; }
    .spinner { width: 36px; height: 36px; margin: 24px auto; border: 3px solid #3a4250; border-top-color: var(--cp-amber); border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .snack { display: none; position: absolute; bottom: 16px; left: 50%; transform: translateX(-50%);
      background: #222; border: 1px solid var(--cp-amber); padding: 10px 18px; border-radius: 8px; z-index: 1300; }
    .snack.open { display: block; }
    #http-overlay {
      width: 360px; flex-shrink: 0; min-height: 0; height: 100%; max-height: 100vh;
      background: #0a0c10; border-left: 1px solid #3a4250;
      display: flex; flex-direction: column; position: relative; z-index: 2000;
      overflow: hidden;
    }
    #http-overlay h2 {
      margin: 0; padding: 14px 14px 8px; font-size: 0.85rem; letter-spacing: 0.06em;
      text-transform: uppercase; color: #9aa3b2; font-weight: 600;
      flex: 0 0 auto;
    }
    #http-log {
      flex: 1 1 auto; min-height: 0; overflow-y: auto; overflow-x: hidden;
      padding: 8px 12px 16px; font-family: ui-monospace, Consolas, monospace; font-size: 12px; line-height: 1.4;
    }
    .http-call { flex-shrink: 0; margin: 0 0 12px; padding: 8px; border-radius: 8px; background: #12151c; border: 1px solid #2a303c; }
    .http-call.post { border-color: var(--cp-amber); background: #1a160e; }
    .http-call .verb { font-weight: 700; }
    .http-call.post .verb { color: var(--cp-amber); }
    .http-call.get .verb { color: #9ec9c3; }
    .http-call .path { word-break: break-all; }
    .http-call .body, .http-call .status { margin-top: 4px; color: #c4b4a4; white-space: pre-wrap; word-break: break-all; }
    .http-call .status.persist { color: var(--cp-amber); font-weight: 700; }
    .http-call .status.stop { color: #e8a0a0; }
    #intro {
      display: none; position: fixed; inset: 0; z-index: 4000;
      background: color-mix(in srgb, var(--cp-ink) 92%, transparent);
      align-items: center; justify-content: center; padding: 32px;
    }
    #intro.open { display: flex; }
    .intro-card { max-width: 720px; }
    .intro-card .kicker { color: var(--cp-amber); letter-spacing: 0.08em; text-transform: uppercase; font-size: 0.8rem; margin: 0 0 10px; }
    .intro-card h1 { font-family: var(--cp-font-display); font-weight: 400; font-size: 2.1rem; margin: 0 0 16px; }
    .intro-card .lede { font-size: 1.15rem; line-height: 1.5; margin: 0 0 16px; }
    .intro-card ul { margin: 0 0 16px; padding-left: 1.2rem; line-height: 1.55; }
    .intro-card .persist { color: var(--cp-amber); margin: 0; font-size: 1.05rem; }
    .drop-target-icon { font-size: 28px; color: var(--cp-amber); }
  </style>
</head>
<body>
  <div id="intro">
    <div class="intro-card">
      <p class="kicker" id="intro-kicker"></p>
      <h1 id="intro-title"></h1>
      <p class="lede" id="intro-lede"></p>
      <ul id="intro-points"></ul>
      <p class="persist" id="intro-persist"></p>
    </div>
  </div>
  <div id="drop-park" hidden>
    <div class="drop-targets" id="drop-podcast">
      <div class="drop-target" id="drop-general" role="button">
        <div class="drop-target-icon">↗</div>
        <p class="drop-target-title">Submit episode link</p>
        <p class="drop-target-desc">Add as a general submission — Cult Podcasts will match the podcast automatically.</p>
      </div>
      <div class="drop-target" id="drop-page" role="button">
        <div class="drop-target-icon">◉</div>
        <p class="drop-target-title">Submit to Page Show</p>
        <p class="drop-target-desc">Link this episode to the podcast shown on this page.</p>
      </div>
    </div>
  </div>
  <div class="layout">
    <div class="stage">
      <div class="drop-overlay drop-overlay--home" id="drop-overlay" aria-hidden="true">
        <p class="drop-overlay-message" id="drop-home">Drop episode link to submit</p>
      </div>
      <div class="ghost-url" id="ghost-url"></div>
      <div class="app-toolbar">
        <a id="site" href="#">Cult Podcasts</a>
        <span id="auth-badge">Signed out</span>
        <button type="button" id="add-podcast">Add Podcast</button>
      </div>
      <div class="page-main" id="page-main">
        <h1 id="page-title">Homepage</h1>
        <p id="page-copy">Browse recent episodes. Drag a podcast or streaming URL onto the page to submit it.</p>
      </div>
      <div class="dialog-scrim" id="dlg-add">
        <div class="dialog" role="dialog" aria-labelledby="add-title">
          <h2 id="add-title">Add Podcast</h2>
          <div class="dialog-body">
            <div class="field">
              <label for="podcast-url">Podcast Url</label>
              <input id="podcast-url" placeholder="Podcast Url" />
            </div>
            <p class="known-series" id="known-series" hidden></p>
            <div class="series-panel" id="series-panel" hidden>
              <h3>Series (optional)</h3>
              <div class="field">
                <label for="series-name">Series</label>
                <input id="series-name" placeholder="Series" />
              </div>
            </div>
          </div>
          <div class="dialog-actions">
            <button type="button" id="add-close">Close</button>
            <button type="button" class="primary" id="add-save" disabled>Save</button>
          </div>
        </div>
      </div>
      <div class="dialog-scrim" id="dlg-send">
        <div class="dialog" role="dialog" aria-labelledby="send-title">
          <h2 id="send-title">Sending Podcast</h2>
          <div class="dialog-body"><div class="spinner" aria-label="Sending"></div></div>
        </div>
      </div>
      <div class="dialog-scrim" id="dlg-confirm">
        <div class="dialog" role="dialog" aria-labelledby="confirm-title">
          <h2 id="confirm-title">Already on another series</h2>
          <div class="dialog-body"><p id="confirm-q"></p></div>
          <div class="dialog-actions">
            <button type="button" id="confirm-no">No</button>
            <button type="button" id="confirm-yes">Yes</button>
          </div>
        </div>
      </div>
      <div class="dialog-scrim" id="dlg-conflict">
        <div class="dialog" role="dialog" aria-labelledby="conflict-title">
          <h2 id="conflict-title">Choose series</h2>
          <div class="dialog-body">
            <p>Several catalogue rows share this name. Pick by platform ids or removed status — do not guess.</p>
            <ul class="conflict-list" id="conflict-list"></ul>
          </div>
          <div class="dialog-actions"><button type="button" id="conflict-cancel">Cancel</button></div>
        </div>
      </div>
      <div class="snack" id="snack"></div>
    </div>
    <aside id="http-overlay">
      <h2>HTTP — Worker API</h2>
      <div id="http-log"></div>
    </aside>
  </div>
  <script>
    const API = 'https://api.example';
    const PAGE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const httpLog = document.getElementById('http-log');
    const urlInput = document.getElementById('podcast-url');
    const seriesInput = document.getElementById('series-name');
    const saveBtn = document.getElementById('add-save');
    const dropOverlay = document.getElementById('drop-overlay');
    const dropHome = document.getElementById('drop-home');
    const dropPodcast = document.getElementById('drop-podcast');
    const dropPark = document.getElementById('drop-park');
    let lookup = null;
    let lookedUpHref = null;
    let pending = false;
    let confirmResolve = null;
    let pendingUrl = '';
    let tourRole = 'signedOut';
    let onPodcastPage = false;

    function isCurator() { return tourRole === 'curator'; }
    function canCallSubmitUrlLookup() { return tourRole === 'curator' || tourRole === 'member'; }

    function applyAuthChrome() {
      const badge = document.getElementById('auth-badge');
      if (tourRole === 'curator') badge.textContent = 'Signed in · Curator';
      else if (tourRole === 'member') badge.textContent = 'Signed in · Submitter';
      else badge.textContent = 'Signed out';
    }

    function applyDropTargets() {
      /* Matches app.component.html @if (isOnPodcastPage && canSubmitUrlForPodcast) two cards @else single message. */
      const twoCard = onPodcastPage && isCurator();
      dropOverlay.classList.toggle('drop-overlay--home', !twoCard);
      dropOverlay.classList.toggle('drop-overlay--podcast', twoCard);
      if (twoCard) {
        dropPark.appendChild(dropHome);
        dropOverlay.replaceChildren(dropPodcast);
      } else {
        dropPark.appendChild(dropPodcast);
        dropOverlay.replaceChildren(dropHome);
      }
    }

    function applySeriesFromLookup() {
      const known = document.getElementById('known-series');
      const panel = document.getElementById('series-panel');
      if (!isCurator()) {
        known.hidden = true;
        panel.hidden = true;
        return;
      }
      if (lookup && lookup.known) {
        known.hidden = false;
        known.textContent = 'Series: ' + lookup.podcastName;
        panel.hidden = true;
      } else if (lookup && (lookup.kind === 'streaming' || lookup.ambiguous)) {
        known.hidden = true;
        panel.hidden = false;
      } else {
        known.hidden = true;
        panel.hidden = true;
      }
    }

    function compact(body) {
      if (!body) return undefined;
      return Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined));
    }

    function revealLatestHttp() {
      const last = httpLog.lastElementChild;
      if (last) last.scrollIntoView({ block: 'end', inline: 'nearest' });
      httpLog.scrollTop = httpLog.scrollHeight;
    }

    function addHttp(method, path, body) {
      const el = document.createElement('div');
      el.className = 'http-call ' + (method === 'POST' ? 'post' : 'get');
      const req = document.createElement('div');
      const verb = document.createElement('span');
      verb.className = 'verb';
      verb.textContent = method;
      const pathEl = document.createElement('span');
      pathEl.className = 'path';
      pathEl.textContent = ' ' + path;
      req.append(verb, pathEl);
      el.appendChild(req);
      if (body) {
        const bodyEl = document.createElement('div');
        bodyEl.className = 'body';
        bodyEl.textContent = JSON.stringify(body, null, 2);
        el.appendChild(bodyEl);
      }
      const st = document.createElement('div');
      st.className = 'status pending';
      st.textContent = '…';
      el.appendChild(st);
      httpLog.appendChild(el);
      revealLatestHttp();
      return el;
    }

    const origFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const method = ((init && init.method) || 'GET').toUpperCase();
      const href = typeof input === 'string' ? input : input.url;
      const u = new URL(href);
      const path = u.pathname + u.search;
      let body;
      if (init && init.body) body = JSON.parse(init.body);
      const card = addHttp(method, path, body);
      const res = await origFetch(input, init);
      const text = await res.clone().text();
      const st = card.querySelector('.status');
      const xOrigin = res.headers.get('X-Origin');
      st.textContent =
        '← ' +
        res.status +
        (xOrigin ? '  X-Origin' : '') +
        (text ? '  ' + text : '');
      st.classList.remove('pending');
      if (method === 'POST' && path === '/submit' && res.ok) st.classList.add('persist');
      if (!res.ok) st.classList.add('stop');
      revealLatestHttp();
      return res;
    };

    async function call(method, path, body) {
      const payload = compact(body);
      const res = await fetch(API + path, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Tour-Role': tourRole
        },
        body: payload ? JSON.stringify(payload) : undefined
      });
      const text = await res.text();
      return { status: res.status, json: text ? JSON.parse(text) : null };
    }

    function setScrim(id, open) {
      document.getElementById(id).classList.toggle('open', open);
    }

    function resetDialogs() {
      ['dlg-add', 'dlg-send', 'dlg-confirm', 'dlg-conflict'].forEach((id) => setScrim(id, false));
      document.getElementById('snack').classList.remove('open');
      lookup = null;
      lookedUpHref = null;
      pending = false;
      urlInput.value = '';
      seriesInput.value = '';
      saveBtn.disabled = true;
      applySeriesFromLookup();
    }

    function hideDrop() {
      dropOverlay.classList.remove('drop-overlay--active');
      dropOverlay.setAttribute('aria-hidden', 'true');
      document.getElementById('ghost-url').classList.remove('visible');
    }

    function parsedHref() {
      try {
        const u = new URL(urlInput.value.trim());
        if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
        return u.href;
      } catch { return ''; }
    }

    async function runLookup() {
      const href = parsedHref();
      if (!href) {
        lookup = null;
        lookedUpHref = null;
        applySeriesFromLookup();
        saveBtn.disabled = true;
        return;
      }
      if (!canCallSubmitUrlLookup()) {
        lookup = null;
        lookedUpHref = href;
        pending = false;
        applySeriesFromLookup();
        saveBtn.disabled = false;
        return;
      }
      if (href === lookedUpHref && lookup) {
        saveBtn.disabled = false;
        return;
      }
      pending = true;
      saveBtn.disabled = true;
      const res = await call('GET', '/submit/lookup?url=' + encodeURIComponent(href));
      lookup = res.json;
      lookedUpHref = href;
      pending = false;
      applySeriesFromLookup();
      saveBtn.disabled = false;
    }

    async function persist(url, podcastId, podcastName) {
      hideDrop();
      setScrim('dlg-add', false);
      setScrim('dlg-send', true);
      const first = await call('POST', '/submit', { url, podcastId, podcastName });
      if (first.status === 409 && Array.isArray(first.json) && !podcastId) {
        const ids = first.json;
        const rows = [];
        for (const id of ids) {
          const row = await call('GET', '/podcast/' + id);
          rows.push(row.json);
        }
        const list = document.getElementById('conflict-list');
        list.replaceChildren();
        await new Promise((resolve) => {
          rows.forEach((row) => {
            const li = document.createElement('li');
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'conflict-pick';
            btn.innerHTML = '<span>' + row.name + '</span>'
              + '<span class="meta">id: ' + row.id + '</span>'
              + '<span class="meta">Spotify: ' + (row.spotifyId || '—') + '</span>';
            btn.onclick = async () => {
              setScrim('dlg-conflict', false);
              setScrim('dlg-send', true);
              const second = await call('POST', '/submit', { url, podcastId: row.id, podcastName: row.name });
              setScrim('dlg-send', false);
              finish(second);
              resolve();
            };
            li.appendChild(btn);
            list.appendChild(li);
          });
          setScrim('dlg-send', false);
          setScrim('dlg-conflict', true);
        });
        return;
      }
      setScrim('dlg-send', false);
      finish(first);
    }

    function finish(res) {
      const snack = document.getElementById('snack');
      snack.textContent = res.status === 200 ? 'Episode submitted' : 'Submit failed';
      snack.classList.add('open');
    }

    function generalDropSeries(looked) {
      if (!looked || looked.known || looked.ambiguous) return {};
      if (looked.kind === 'streaming' && looked.podcastName) {
        return { podcastName: looked.podcastName };
      }
      return {};
    }

    async function saveAdd() {
      const url = parsedHref();
      if (!url) return;
      if (!canCallSubmitUrlLookup()) {
        await persist(url);
        return;
      }
      if (lookedUpHref !== url || !lookup) return;
      if (!isCurator()) {
        if (lookup.known || lookup.kind === 'podcast-service') {
          await persist(url);
          return;
        }
        const series = generalDropSeries(lookup);
        await persist(url, series.podcastId, series.podcastName);
        return;
      }
      if (lookup && lookup.known) {
        await persist(url);
        return;
      }
      if (lookup && lookup.kind === 'podcast-service') {
        await persist(url);
        return;
      }
      const name = seriesInput.value.trim();
      if (!name) {
        await persist(url);
        return;
      }
      const probe = await call('GET', '/podcast/' + encodeURIComponent(name));
      if (probe.status === 200 && probe.json && probe.json.id) {
        await persist(url, probe.json.id, probe.json.name);
        return;
      }
      await persist(url, undefined, name);
    }

    async function dropGeneral(url) {
      hideDrop();
      if (!canCallSubmitUrlLookup()) {
        await persist(url);
        return;
      }
      const looked = await call('GET', '/submit/lookup?url=' + encodeURIComponent(url));
      const series = generalDropSeries(looked.json);
      await persist(url, series.podcastId, series.podcastName);
    }

    async function dropToPage(url) {
      hideDrop();
      const page = await call('GET', '/podcast/' + encodeURIComponent('Page Show'));
      const looked = await call('GET', '/submit/lookup?url=' + encodeURIComponent(url));
      if (looked.json && looked.json.known && looked.json.podcastId !== page.json.id) {
        document.getElementById('confirm-q').textContent =
          'This URL is already on ' + looked.json.podcastName + '. Submit to ' + page.json.name + ' anyway?';
        setScrim('dlg-confirm', true);
        const yes = await new Promise((resolve) => { confirmResolve = resolve; });
        setScrim('dlg-confirm', false);
        if (!yes) return;
      }
      await persist(url, page.json.id, page.json.name);
    }

    document.getElementById('confirm-yes').onclick = () => { if (confirmResolve) confirmResolve(true); };
    document.getElementById('confirm-no').onclick = () => { if (confirmResolve) confirmResolve(false); };
    document.getElementById('add-podcast').onclick = () => { resetDialogs(); setScrim('dlg-add', true); };
    document.getElementById('add-close').onclick = () => setScrim('dlg-add', false);
    document.getElementById('add-save').onclick = () => saveAdd();
    let lookupTimer = 0;
    urlInput.addEventListener('input', () => {
      window.clearTimeout(lookupTimer);
      lookupTimer = window.setTimeout(runLookup, 200);
    });
    urlInput.addEventListener('change', runLookup);
    urlInput.addEventListener('blur', runLookup);
    document.getElementById('drop-home').onclick = () => dropGeneral(pendingUrl);
    document.getElementById('drop-general').onclick = () => dropGeneral(pendingUrl);
    document.getElementById('drop-page').onclick = () => dropToPage(pendingUrl);

    window.__tour = {
      showIntro(data) {
        document.getElementById('intro-kicker').textContent = data.kicker;
        document.getElementById('intro-title').textContent = data.title;
        document.getElementById('intro-lede').textContent = data.lede;
        const ul = document.getElementById('intro-points');
        ul.replaceChildren();
        (data.points || []).forEach((p) => {
          const li = document.createElement('li');
          li.textContent = p;
          ul.appendChild(li);
        });
        document.getElementById('intro-persist').textContent = data.persist || '';
        document.getElementById('intro').classList.add('open');
      },
      hideIntro() { document.getElementById('intro').classList.remove('open'); },
      clearHttp() { httpLog.replaceChildren(); },
      setRole(role) {
        tourRole = role === 'curator' || role === 'member' ? role : 'signedOut';
        applyAuthChrome();
        applyDropTargets();
        applySeriesFromLookup();
      },
      setHome() {
        resetDialogs();
        hideDrop();
        onPodcastPage = false;
        document.getElementById('page-title').textContent = 'Homepage';
        document.getElementById('page-copy').textContent = 'Browse recent episodes. Drag a podcast or streaming URL onto the page to submit it.';
        applyDropTargets();
      },
      setPodcastPage() {
        resetDialogs();
        hideDrop();
        onPodcastPage = true;
        document.getElementById('page-title').textContent = 'Page Show';
        document.getElementById('page-copy').textContent = isCurator()
          ? 'You are on a podcast page as a Curator. Dropping a URL offers two targets: general submit, or attach to this series.'
          : 'You are on a podcast page without the Curator role. Drop is the same as the homepage: Cult Podcasts matches the series.';
        applyDropTargets();
      },
      showDrop(url) {
        pendingUrl = url;
        applyDropTargets();
        const ghost = document.getElementById('ghost-url');
        ghost.textContent = url;
        ghost.classList.add('visible');
        dropOverlay.classList.add('drop-overlay--active');
        dropOverlay.setAttribute('aria-hidden', 'false');
      },
      openAddPodcast() { resetDialogs(); setScrim('dlg-add', true); }
    };

    window.__tour.setHome();
  </script>
</body>
</html>`;
}
