import * as sass from "sass";
import { join } from "node:path";

const chromeSassPath = join(process.cwd(), "src", "app", "app.component.sass");

/** Compile real app.component.sass for a light-DOM chrome/search harness. */
export function compileChromeSearchLayoutCss(): string {
  const compiled = sass.compile(chromeSassPath, { style: "expanded" }).css
    .replaceAll("::ng-deep", "");
  return `
html, body { margin: 0; background: #0b0b0b; color: #fff; }
.app-toolbar {
  display: flex;
  align-items: center;
  height: var(--site-chrome-bar-h, 58px);
  padding: 0 12px;
  background: #111;
  box-sizing: border-box;
}
#site { display: inline-flex; width: 42px; height: 42px; background: #fff; border-radius: 50%; flex-shrink: 0; }
#socialbuttons { margin-left: auto; display: flex; gap: 8px; }
#socialbuttons span {
  width: 40px; height: 40px; border-radius: 50%; background: #444; display: block;
}
#searchcontainer { margin: 0; }
#searchbar { display: flex; align-items: center; gap: 10px; margin: 0; }
#searchboxwrapper {
  flex: 1 1 auto;
  min-width: 0;
  height: var(--search-bar-control-h, 48px);
  background: #2a2a2a;
  border: 1px solid #666;
  border-radius: 8px;
  pointer-events: auto;
}
#searchcta {
  flex: 0 0 auto;
  height: var(--search-bar-control-h, 48px);
  pointer-events: auto;
  background: #e8a23a;
  border: 0;
  border-radius: 999px;
  padding: 0 16px;
}
.nflx { min-height: 2400px; background: #1a1a1a; }
${compiled}
`;
}

export function buildChromeSearchLayoutDocument(): string {
  const css = compileChromeSearchLayoutCss();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Chrome search layout harness</title>
  <style>${css}</style>
</head>
<body>
<section id="body" class="home-shell">
  <div class="site-chrome">
    <div class="site-chrome__bar" id="chromeBar">
      <div class="app-toolbar">
        <a id="site" href="#"></a>
        <div id="socialbuttons"><span></span><span></span></div>
      </div>
    </div>
    <div class="site-chrome__bar-spacer" aria-hidden="true"></div>
    <div class="chrome-search-slot">
      <div class="chrome-search" id="chromeSearch">
        <section id="searchcontainer">
          <form id="searchbar">
            <div id="searchboxwrapper"></div>
            <button type="button" id="searchcta">Search</button>
          </form>
        </section>
      </div>
    </div>
  </div>
  <div class="nflx"></div>
</section>
<script>
(function () {
  const HOME_UNDOCK_SCROLL_PX = 8;
  const body = document.getElementById("body");
  const bar = document.getElementById("chromeBar");
  const search = document.getElementById("chromeSearch");
  let docked = false;

  function clearLayout() {
    search.style.left = "";
    search.style.right = "";
    search.style.width = "";
    search.style.top = "";
    search.style.transform = "";
    search.style.marginLeft = "";
    search.style.marginRight = "";
  }

  function layoutHomeDocked() {
    const barHeight = Math.max(bar.getBoundingClientRect().height, 52);
    const searchHeight = Math.min(search.offsetHeight || 40, barHeight - 8);
    const top = Math.max(0, (barHeight - searchHeight) / 2);
    search.style.left = "50%";
    search.style.right = "auto";
    search.style.width = "";
    search.style.marginLeft = "0";
    search.style.marginRight = "0";
    search.style.top = top + "px";
    search.style.transform = "translateX(-50%)";
  }

  function setDocked(next) {
    docked = next;
    body.classList.toggle("chrome-stuck", next);
    search.classList.toggle("chrome-search--docked", next);
    if (next) {
      layoutHomeDocked();
    } else {
      clearLayout();
    }
  }

  function sync() {
    const y = window.scrollY;
    if (docked) {
      if (y < HOME_UNDOCK_SCROLL_PX) {
        setDocked(false);
      } else {
        layoutHomeDocked();
      }
      return;
    }
    const barBottom = bar.getBoundingClientRect().bottom;
    const searchTop = search.getBoundingClientRect().top;
    if (searchTop <= barBottom + 2) {
      setDocked(true);
    }
  }

  window.addEventListener("scroll", sync, { passive: true });
  window.__chromeSearchSync = sync;
  window.__chromeSearchHit = function () {
    const field = document.getElementById("searchboxwrapper");
    const slot = document.querySelector(".chrome-search-slot");
    const r = field.getBoundingClientRect();
    const cs = getComputedStyle(field);
    if (r.width < 80 || r.height < 16) {
      return { ok: false, reason: "zero-size", width: r.width, height: r.height, top: r.top };
    }
    if (r.bottom < 1 || r.top > window.innerHeight - 1) {
      return { ok: false, reason: "offscreen", top: r.top, bottom: r.bottom };
    }
    const x = Math.round(r.left + r.width / 2);
    const y = Math.round(r.top + r.height / 2);
    const hit = document.elementFromPoint(x, y);
    const ok = !!(hit && field.contains(hit));
    return {
      ok,
      reason: ok ? "hit" : "covered",
      hit: hit ? (hit.id || hit.className || hit.tagName) : null,
      // visibility/opacity stay "visible"/"1" when the toolbar paints over the
      // field — they are diagnostic only and must not be treated as pass.
      visibility: cs.visibility,
      opacity: cs.opacity,
      slotZIndex: slot ? getComputedStyle(slot).zIndex : null,
      width: Math.round(r.width),
      top: Math.round(r.top),
      stuck: body.classList.contains("chrome-stuck"),
      scrollY: Math.round(window.scrollY)
    };
  };
})();
</script>
</body>
</html>`;
}
