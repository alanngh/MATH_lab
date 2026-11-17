/* Math Lab index. Vanilla, no build step.
   The catalog in index.html is the source of truth: every .collection block
   becomes a class orb, every .sim-card becomes a row in that class's panel. */
(function () {
  "use strict";

  var root = document.documentElement;
  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (id) { return document.getElementById(id); };

  /* ---------------- theme ---------------- */
  var themeButton = $("themeToggle");
  var themeColor = $("themeColor");

  function activeTheme() {
    var explicit = root.getAttribute("data-theme");
    if (explicit === "dark" || explicit === "light") return explicit;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  function syncThemeButton() {
    if (!themeButton) return;
    var dark = activeTheme() === "dark";
    themeButton.setAttribute("aria-pressed", dark ? "true" : "false");
    themeButton.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
    if (themeColor) themeColor.setAttribute("content", dark ? "#061B1A" : "#EDEADE");
  }
  if (themeButton) {
    themeButton.addEventListener("click", function () {
      var next = activeTheme() === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("mathlab-theme", next); } catch (error) { /* private mode */ }
      syncThemeButton();
    });
  }
  syncThemeButton();

  var year = $("year");
  if (year) year.textContent = String(new Date().getFullYear());

  /* ---------------- the wordmark: the page's one automatic sequence ---------------- */
  (function () {
    var host = $("hero-title");
    if (!host) return;
    var text = "Math Lab";
    var markup = "";
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      if (ch === " ") {
        markup += '<span class="ch space" style="--i:' + i + '" aria-hidden="true"></span>';
      } else {
        markup += '<span class="ch" style="--i:' + i + '" aria-hidden="true">' + ch + "</span>";
      }
    }
    host.innerHTML = markup;
  })();

  /* ---------------- local memory ----------------
     Saves, visits and the last simulator opened. Nothing leaves the browser;
     with storage blocked the page still works and just forgets. */
  var STORE = { saved: "mathlab-saved", visits: "mathlab-visits", last: "mathlab-last" };

  function readJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) { return fallback; }
  }
  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (error) { /* private mode */ }
  }

  var saved = readJSON(STORE.saved, []);
  if (!Array.isArray(saved)) saved = [];

  function isSaved(href) { return saved.indexOf(href) !== -1; }
  function toggleSaved(href) {
    var at = saved.indexOf(href);
    if (at === -1) saved.push(href); else saved.splice(at, 1);
    writeJSON(STORE.saved, saved);
    syncSaveButtons();
    renderMetrics();
  }
  function syncSaveButtons() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-save]"), function (button) {
      var on = isSaved(button.getAttribute("data-save"));
      var title = button.getAttribute("data-title") || "this simulator";
      button.setAttribute("aria-pressed", on ? "true" : "false");
      button.setAttribute("aria-label", (on ? "Remove " : "Save ") + title + (on ? " from this browser" : " in this browser"));
      button.title = on ? "Saved in this browser" : "Save in this browser";
    });
  }

  var visits = readJSON(STORE.visits, { count: 0, last: "" });
  if (!visits || typeof visits.count !== "number") visits = { count: 0, last: "" };
  visits.count += 1;
  visits.last = new Date().toISOString();
  writeJSON(STORE.visits, visits);

  var lastOpened = readJSON(STORE.last, null);
  if (lastOpened && typeof lastOpened.href !== "string") lastOpened = null;

  var cardEls = Array.prototype.slice.call(document.querySelectorAll(".catalog .sim-card"));
  var collectionEls = Array.prototype.slice.call(document.querySelectorAll(".catalog .collection"));
  var simTotal = cardEls.length;
  var classTotal = collectionEls.length;

  function renderMetrics() {
    var sims = $("metricSims");
    var classes = $("metricClasses");
    var savedEl = $("metricSaved");
    var note = $("deviceNote");
    if (sims) sims.textContent = String(simTotal);
    if (classes) classes.textContent = String(classTotal);
    if (savedEl) savedEl.textContent = String(saved.length);
    if (!note) return;

    var parts = [];
    if (visits.count > 1) parts.push("Visit " + visits.count + " on this device");
    if (lastOpened) {
      parts.push('Last opened <a href="' + lastOpened.href + '">' + lastOpened.title + "</a>");
    }
    parts.push("Saves and history stay in this browser.");
    note.innerHTML = parts.join(" · ");
  }
  renderMetrics();

  /* remember the last simulator opened from this page */
  document.addEventListener("click", function (event) {
    var link = event.target.closest("a[href]");
    if (!link) return;
    var href = link.getAttribute("href") || "";
    if (!/\.html($|[?#])/i.test(href) || /(^|\/)index(_new)?\.html/i.test(href)) return;
    var nameEl = link.querySelector(".sim-name, h4");
    var title = link.getAttribute("data-title") || (nameEl ? nameEl.textContent : href);
    lastOpened = { title: title.trim(), href: href, at: new Date().toISOString() };
    writeJSON(STORE.last, lastOpened);
  });

  /* ---------------- catalog: a save button beside each row ----------------
     The catalog block is rewritten by update_index_links.py, so the buttons
     are added here rather than emitted by the generator. */
  function decorateCatalog() {
    cardEls.forEach(function (card) {
      if (card.parentElement && card.parentElement.classList.contains("sim-hold")) return;
      var href = card.getAttribute("href");
      var nameEl = card.querySelector(".sim-name");
      var title = nameEl ? nameEl.textContent.trim() : href;
      card.setAttribute("data-title", title);

      var hold = document.createElement("div");
      hold.className = "sim-hold";
      card.parentNode.insertBefore(hold, card);
      hold.appendChild(card);

      var button = document.createElement("button");
      button.type = "button";
      button.className = "save";
      button.setAttribute("data-save", href);
      button.setAttribute("data-title", title);
      button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.3 4.9 13a4.6 4.6 0 0 1 6.5-6.5l.6.6.6-.6a4.6 4.6 0 0 1 6.5 6.5Z"/></svg>';
      button.addEventListener("click", function () { toggleSaved(href); });
      hold.appendChild(button);
    });
    syncSaveButtons();
    renderMetrics();
  }
  decorateCatalog();

  /* ---------------- the class orbit ----------------
     One orb per folder. Order follows the catalog, which follows
     _collection.json "order" then title. */
  var portal = $("classes");
  var stage = $("portalStage");
  var heroStage = $("heroStage");
  var wheel = $("wheel");
  var slots = $("slots");
  var core = $("core");
  var coreInner = $("coreInner");
  var fpanel = $("fpanel");

  var HUES = ["--color-hue-a", "--color-hue-b", "--color-hue-c", "--color-hue-d", "--color-hue-e", "--color-hue-f"];

  function shortGlyph(title, index) {
    var clean = String(title || "").trim();
    if (!clean) return String(index + 1);
    if (clean.length <= 4) return clean;
    var words = clean.split(/\s+/);
    if (words.length > 1) return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
    return clean.charAt(0).toUpperCase();
  }

  var FOLDERS = collectionEls.map(function (block, index) {
    var titleEl = block.querySelector(".collection-title");
    var descEl = block.querySelector(".collection-desc");
    var title = titleEl ? titleEl.textContent.trim() : "Class " + (index + 1);
    return {
      id: block.getAttribute("data-collection") || String(index),
      title: title,
      desc: descEl ? descEl.textContent.trim() : "Simulations grouped in this folder.",
      glyph: block.getAttribute("data-glyph") || shortGlyph(title, index),
      hue: block.getAttribute("data-hue") || HUES[index % HUES.length],
      cards: Array.prototype.slice.call(block.querySelectorAll(".sim-card")),
      count: block.querySelectorAll(".sim-card").length
    };
  });

  var N = FOLDERS.length;
  var STEP = N ? (Math.PI * 2) / N : 0;
  var rot = -Math.PI / 2;
  var hovered = null;
  var current = null;
  var shownKey = null;

  function folderById(id) {
    for (var i = 0; i < FOLDERS.length; i++) if (FOLDERS[i].id === id) return FOLDERS[i];
    return null;
  }
  function countText(folder) {
    if (!folder.count) return "Nothing published yet";
    return folder.count + (folder.count === 1 ? " simulator" : " simulators");
  }

  /* Below four classes the orbs grow and sit a little wider, so two or three
     on the ring still read as an orbit rather than as scattered dots. */
  var RING = N < 4 ? 0.37 : 0.355;
  var ORB = N < 4 ? 0.2 : 0.185;
  if (N < 4) portal.classList.add("is-thin");

  slots.innerHTML = FOLDERS.map(function (folder, i) {
    var dur = (4.6 + (i * 0.7) % 2.2).toFixed(2);
    var delay = (-i * 1.1).toFixed(2);
    return '<div class="slot"><div class="f-wrap" style="--dur:' + dur + 's;--delay:' + delay + 's">' +
      '<button type="button" class="orb' + (folder.count ? "" : " soon") + '" data-id="' + folder.id + '" style="--hue:var(' + folder.hue + ')" aria-pressed="false" aria-label="' + folder.title + ", " + countText(folder) + '">' +
      '<span class="orb-glyph" aria-hidden="true">' + folder.glyph + "</span>" +
      '<span class="orb-count">' + folder.count + "</span></button>" +
      '<span class="f-label">' + folder.title + "</span></div></div>";
  }).join("");

  var slotEls = slots.querySelectorAll(".slot");

  var wheelTrack = wheel.querySelector(".track");

  function layout() {
    var S = wheel.offsetWidth;
    if (!S) return;
    var orbSize = Math.max(58, Math.min(120, Math.round(S * ORB)));
    var R = S * RING;
    wheel.style.setProperty("--orb", orbSize + "px");
    portal.style.setProperty("--S", S + "px");
    for (var i = 0; i < N; i++) {
      var angle = rot + i * STEP;
      slotEls[i].style.transform = "translate(" +
        (S / 2 + R * Math.cos(angle) - orbSize / 2).toFixed(1) + "px," +
        (S / 2 + R * Math.sin(angle) - orbSize / 2).toFixed(1) + "px)";
    }
    if (wheelTrack) wheelTrack.style.transform = "rotate(" + rot + "rad)";
  }

  function showCore(folder) {
    var key = folder ? folder.id : "";
    if (shownKey === key) return;
    shownKey = key;

    if (!folder) {
      core.style.setProperty("--hue", "var(--color-accent)");
      coreInner.innerHTML = '<div class="core-kicker">Math Lab</div><h3>Choose a class</h3>' +
        '<p>Every folder in the lab is a class. Pick its orb to open the simulators inside.</p>' +
        '<div class="core-list">' + simTotal + " simulators · " + N + " classes</div>";
    } else {
      core.style.setProperty("--hue", "var(" + folder.hue + ")");
      /* The readout names the class and says what it covers; the simulator
         names belong to the panel on the right, not here. */
      coreInner.innerHTML = '<div class="core-kicker">' + countText(folder) + "</div>" +
        "<h3>" + folder.title + "</h3><p>" + folder.desc + "</p>";
    }
    if (!reduced) {
      coreInner.classList.remove("swap");
      void coreInner.offsetWidth;
      coreInner.classList.add("swap");
    }
  }
  function refreshCore() { showCore(hovered || current); }

  function markOrbs() {
    Array.prototype.forEach.call(wheel.querySelectorAll(".orb"), function (orb) {
      var on = !!current && orb.getAttribute("data-id") === current.id;
      orb.classList.toggle("on", on);
      orb.setAttribute("aria-pressed", String(on));
    });
  }

  function panelList(folder) {
    if (!folder.cards.length) {
      return '<div class="fempty">Nothing in this class yet. <a href="#suggest">Suggest a simulator</a> and it could be the first.</div>';
    }
    return '<ul class="flist">' + folder.cards.map(function (card, i) {
      var href = card.getAttribute("href");
      var nameEl = card.querySelector(".sim-name");
      var descEl = card.querySelector(".sim-desc");
      var tagsEl = card.querySelector(".sim-tags");
      var title = nameEl ? nameEl.textContent : href;
      var desc = descEl ? descEl.textContent : "";
      var tags = tagsEl ? tagsEl.innerHTML : "";
      var esc = title.replace(/"/g, "&quot;");
      return '<li class="frow" style="--hue:var(' + folder.hue + ');--i:' + i + '">' +
        '<a class="frow-link" href="' + href + '" data-title="' + esc + '">' +
        '<span class="mini" aria-hidden="true">' + folder.glyph + "</span>" +
        '<span class="frow-copy"><h4>' + title + "</h4><p>" + desc + "</p>" +
        (tags ? '<span class="sim-tags">' + tags + "</span>" : "") + "</span>" +
        '<span class="go" aria-hidden="true">→</span></a>' +
        '<button type="button" class="save" data-save="' + href + '" data-title="' + esc + '">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.3 4.9 13a4.6 4.6 0 0 1 6.5-6.5l.6.6.6-.6a4.6 4.6 0 0 1 6.5 6.5Z"/></svg></button></li>';
    }).join("") + "</ul>";
  }

  function renderPanel(folder) {
    fpanel.innerHTML =
      '<div class="fhead"><button class="back" type="button" id="backBtn">← All classes</button>' +
      '<span class="fkicker">' + countText(folder) + "</span></div>" +
      '<h3 class="ftitle" tabindex="-1">' + folder.title + "</h3>" +
      '<p class="fdesc">' + folder.desc + "</p>" +
      panelList(folder);
    syncSaveButtons();
  }

  function rotateBy(delta, done) {
    if (reduced || Math.abs(delta) < 0.001) { rot += delta; layout(); done(); return; }
    var from = rot;
    var duration = 620 + 380 * Math.abs(delta) / Math.PI;
    var start = performance.now();
    var finished = false;

    function finish() {
      if (finished) return;
      finished = true;
      rot = from + delta;
      layout();
      done();
    }
    (function step(now) {
      if (finished) return;
      var k = Math.min(1, (now - start) / duration);
      var eased = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      rot = from + delta * eased;
      layout();
      if (k < 1) requestAnimationFrame(step); else finish();
    })(start);

    /* Frames can be throttled in a background tab; the turn must still land. */
    setTimeout(finish, duration + 260);
  }

  function openPortal(folder) {
    if (!folder) return;
    if (current === folder && portal.classList.contains("open")) { closePortal(); return; }

    current = folder;
    hovered = null;
    markOrbs();
    refreshCore();

    /* The panel renders at once; the ring turns so the picked class lands at
       three o'clock, beside the list. Waiting for the turn would make the
       page feel slower than it is, and throttled frames would stall it. */
    renderPanel(folder);
    if (heroStage) heroStage.classList.add("is-open");
    portal.classList.add("open");
    fpanel.setAttribute("aria-hidden", "false");

    var angle = rot + FOLDERS.indexOf(folder) * STEP;
    var delta = Math.atan2(Math.sin(-angle), Math.cos(-angle)); /* shortest turn to 3 o'clock */
    rotateBy(delta, function () {});

    var title = fpanel.querySelector(".ftitle");
    if (title) title.focus({ preventScroll: true });
    if (window.matchMedia("(max-width: 1100px)").matches) {
      setTimeout(function () {
        fpanel.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
      }, 280);
    }
  }

  function closePortal() {
    if (!portal.classList.contains("open")) return;
    var previous = current;
    portal.classList.remove("open");
    if (heroStage) heroStage.classList.remove("is-open");
    fpanel.setAttribute("aria-hidden", "true");
    current = null;
    markOrbs();
    refreshCore();
    if (previous) {
      var orb = wheel.querySelector('.orb[data-id="' + previous.id + '"]');
      if (orb) orb.focus({ preventScroll: true });
    }
  }

  wheel.addEventListener("pointerover", function (event) {
    var orb = event.target.closest(".orb");
    if (orb && event.pointerType !== "touch") { hovered = folderById(orb.getAttribute("data-id")); refreshCore(); }
  });
  wheel.addEventListener("pointerleave", function () { hovered = null; refreshCore(); });
  wheel.addEventListener("focusin", function (event) {
    var orb = event.target.closest(".orb");
    if (orb) { hovered = folderById(orb.getAttribute("data-id")); refreshCore(); }
  });
  wheel.addEventListener("focusout", function () { hovered = null; refreshCore(); });
  wheel.addEventListener("click", function (event) {
    var orb = event.target.closest(".orb");
    if (orb) openPortal(folderById(orb.getAttribute("data-id")));
  });
  wheel.addEventListener("keydown", function (event) {
    var dir = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1
            : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!dir || !N) return;
    var orbs = Array.prototype.slice.call(wheel.querySelectorAll(".orb"));
    var at = orbs.indexOf(document.activeElement);
    if (at < 0) return;
    event.preventDefault();
    orbs[(at + dir + N) % N].focus();
  });
  fpanel.addEventListener("click", function (event) {
    if (event.target.closest("#backBtn")) closePortal();
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closePortal();
  });

  /* orbs lean toward the pointer */
  wheel.addEventListener("pointermove", function (event) {
    var orb = event.target.closest(".orb");
    if (!orb || event.pointerType === "touch" || reduced) return;
    var r = orb.getBoundingClientRect();
    orb.style.setProperty("--tx", ((event.clientX - r.left - r.width / 2) * 0.12).toFixed(1) + "px");
    orb.style.setProperty("--ty", ((event.clientY - r.top - r.height / 2) * 0.12).toFixed(1) + "px");
  });
  wheel.addEventListener("pointerout", function (event) {
    var orb = event.target.closest(".orb");
    if (!orb) return;
    orb.style.setProperty("--tx", "0px");
    orb.style.setProperty("--ty", "0px");
  });

  if (window.ResizeObserver) new ResizeObserver(layout).observe(wheel);
  else window.addEventListener("resize", layout);
  layout();
  showCore(null);

  /* deep link: #classes/<id> or #<id> opens that class */
  function openFromHash() {
    var hash = (location.hash || "").replace(/^#/, "");
    if (!hash) return false;
    var candidate = hash.indexOf("classes/") === 0 ? hash.slice(8) : hash;
    var folder = folderById(candidate);
    if (!folder) return false;
    openPortal(folder);
    return true;
  }
  openFromHash();
  window.addEventListener("hashchange", openFromHash);

  /* ---------------- browse filter ---------------- */
  var filters = $("filters");
  var searchInput = $("simSearch");
  var clearButton = $("simSearchClear");
  var tagRow = $("simTags");
  var countEl = $("simCount");
  var catalog = $("catalog");
  var emptyEl = $("filterEmpty");
  var catalogEmpty = $("catalogEmpty");
  var activeTag = "";
  var noun = function (n) { return n === 1 ? "simulation" : "simulations"; };

  if (catalogEmpty && cardEls.length === 0) catalogEmpty.hidden = false;

  var tagCounts = {};
  var tagOrder = [];
  cardEls.forEach(function (card) {
    (card.getAttribute("data-tags") || "").split("|").forEach(function (tag) {
      tag = tag.trim();
      if (!tag) return;
      if (!(tag in tagCounts)) { tagCounts[tag] = 0; tagOrder.push(tag); }
      tagCounts[tag] += 1;
    });
  });
  tagOrder.sort(function (a, b) { return a.toLowerCase().localeCompare(b.toLowerCase()); });

  if (tagRow) {
    tagOrder.forEach(function (tag) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "filter-tag";
      button.setAttribute("aria-pressed", "false");
      button.setAttribute("data-tag", tag);
      button.textContent = tag;
      tagRow.appendChild(button);
    });
  }

  function cardMatches(card) {
    var query = searchInput ? searchInput.value.trim().toLowerCase() : "";
    if (activeTag) {
      var tags = (card.getAttribute("data-tags") || "").split("|").map(function (t) { return t.trim().toLowerCase(); });
      if (tags.indexOf(activeTag.toLowerCase()) === -1) return false;
    }
    if (query) {
      var hay = (card.getAttribute("data-search") || "") + " " + card.textContent;
      if (hay.toLowerCase().indexOf(query) === -1) return false;
    }
    return true;
  }

  function applyFilter() {
    var shown = 0;
    cardEls.forEach(function (card) {
      var match = cardMatches(card);
      card.hidden = !match;
      var hold = card.parentElement;
      if (hold && hold.classList.contains("sim-hold")) hold.hidden = !match;
      if (match) shown += 1;
    });
    collectionEls.forEach(function (collection) {
      collection.classList.toggle("is-hidden", !collection.querySelector(".sim-card:not([hidden])"));
    });
    var filtering = shown !== cardEls.length;
    if (filters) filters.classList.toggle("is-empty", filtering && shown === 0);
    if (emptyEl) emptyEl.hidden = !(filtering && shown === 0);
    if (countEl) {
      countEl.textContent = shown === cardEls.length
        ? cardEls.length + " " + noun(cardEls.length)
        : shown + " of " + cardEls.length + " " + noun(cardEls.length);
    }
    if (clearButton) clearButton.hidden = !(searchInput && searchInput.value);
    if (catalog) catalog.classList.toggle("is-filtered", filtering);
  }

  if (searchInput) {
    searchInput.addEventListener("input", applyFilter);
    searchInput.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && searchInput.value) {
        searchInput.value = "";
        applyFilter();
      }
    });
  }
  if (clearButton) {
    clearButton.addEventListener("click", function () {
      if (searchInput) searchInput.value = "";
      applyFilter();
      if (searchInput) searchInput.focus();
    });
  }
  if (tagRow) {
    tagRow.addEventListener("click", function (event) {
      var button = event.target.closest("button[data-tag]");
      if (!button) return;
      var tag = button.getAttribute("data-tag");
      activeTag = activeTag === tag ? "" : tag;
      Array.prototype.forEach.call(tagRow.querySelectorAll("button[data-tag]"), function (other) {
        other.setAttribute("aria-pressed", other.getAttribute("data-tag") === activeTag ? "true" : "false");
      });
      applyFilter();
    });
  }
  applyFilter();

  /* ---------------- suggest: opens a prefilled project issue ---------------- */
  var ideaForm = $("ideaForm");
  if (ideaForm) {
    ideaForm.addEventListener("submit", function (event) {
      event.preventDefault();
      var titleEl = $("ideaTitle");
      var bodyEl = $("ideaBody");
      var note = $("ideaNote");
      var title = titleEl ? titleEl.value.trim() : "";
      var body = bodyEl ? bodyEl.value.trim() : "";
      if (!title) {
        if (note) note.textContent = "Add a topic first.";
        if (titleEl) titleEl.focus();
        return;
      }
      var url = "https://github.com/alanngh/MATH_lab/issues/new?title=" +
        encodeURIComponent("Simulator idea: " + title) +
        "&body=" + encodeURIComponent(body || "(no description)");
      window.open(url, "_blank", "noopener");
      if (note) note.textContent = "Opening the project page…";
    });
  }
})();
