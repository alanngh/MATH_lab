/* ==================================================================
   MATH LAB — shared simulator behaviour
   ------------------------------------------------------------------
   Load after the page markup:
     <script src="../assets/lab.js"></script>

   Provides:
     MathLab.theme()          current theme, "light" | "dark"
     MathLab.toggleTheme()    flip + persist + notify
     MathLab.onTheme(fn)      run fn on every theme change
     MathLab.collection       { name, description, folder }
     MathLab.format(v, sig)   4-significant-figure number with real minus
     MathLab.canvas.lab(cv)   DPR-aware canvas wrapper for chart pages

   The theme is applied before first paint by the inline snippet each page
   keeps in <head> (it must run before CSS paints). This file only handles
   the toggle, listeners and header text.
   ================================================================== */
(function (global) {
  "use strict";

  var THEME_KEY = "mathlab-theme";
  var listeners = [];

  function readStored(key) {
    try { return global.localStorage.getItem(key); } catch (e) { return null; }
  }
  function writeStored(key, value) {
    try { global.localStorage.setItem(key, value); } catch (e) { /* private mode */ }
  }

  function rootAttr() {
    return document.documentElement.getAttribute("data-theme");
  }

  function systemTheme() {
    return global.matchMedia && global.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark" : "light";
  }

  function theme() {
    var attr = rootAttr();
    return attr === "dark" || attr === "light" ? attr : systemTheme();
  }

  function notify() {
    var value = theme();
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](value); } catch (e) { /* a page callback must not break the others */ }
    }
  }

  function toggleTheme() {
    var next = theme() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    writeStored(THEME_KEY, next);
    notify();
    return next;
  }

  function onTheme(fn) {
    if (typeof fn === "function") listeners.push(fn);
  }

  /* ---------------- collection label ----------------
     The folder a page sits in names the header. If that folder has a
     _collection.json, its title/description replace the folder name.
     Purely path-derived: moving the file renames the header.          */
  function collection() {
    var result = { name: "Math Lab", description: "Collection", folder: "" };
    var path = global.location.pathname.replace(/\/[^/]*$/, "");
    var parts = path.split("/").filter(Boolean);
    var folder = parts.length ? decodeURIComponent(parts[parts.length - 1]) : "";
    result.folder = folder;

    if (!folder || /^[a-z]:$/i.test(folder) || folder === "MATH_lab") {
      result.name = "Math Lab";
      result.description = "Standalone simulator";
      return result;
    }
    result.name = folder;
    result.description = "Course collection";
    return result;
  }

  function bindCollection(markup) {
    var nameEl = document.getElementById("collectionName");
    var subEl = document.getElementById("collectionSub");
    var info = collection();

    if (nameEl) nameEl.textContent = info.name;
    if (subEl) subEl.textContent = info.description;

    if (!info.folder || info.name === "Math Lab" || !global.fetch) return info;

    fetch("_collection.json", { cache: "no-store" })
      .then(function (response) { return response.ok ? response.json() : null; })
      .then(function (data) {
        if (!data || typeof data !== "object") return;
        if (nameEl && typeof data.title === "string" && data.title.trim()) {
          nameEl.textContent = data.title.trim();
          info.name = data.title.trim();
        }
        if (subEl && typeof data.description === "string" && data.description.trim()) {
          subEl.textContent = data.description.trim();
          info.description = data.description.trim();
        }
      })
      .catch(function () { /* file:// or missing metadata — keep the folder name */ });

    return info;
  }

  /* ---------------- number formatting ---------------- */
  var MINUS = "−"; /* real minus sign, never a hyphen */

  function format(value, sig) {
    sig = sig || 4;
    if (!Number.isFinite(value)) return "—";
    if (value === 0) return "0";
    var abs = Math.abs(value);
    if (abs >= 1e5 || abs < 1e-3) {
      return value.toExponential(Math.max(1, sig - 1))
        .replace("e+", "e").replace("e-", "e" + MINUS);
    }
    return String(Number(value.toPrecision(sig))).replace("-", MINUS);
  }

  /* ---------------- canvas helper ---------------- */
  function labCanvas(canvas) {
    var ctx = canvas.getContext("2d");
    var chart = {
      canvas: canvas,
      ctx: ctx,
      w: 0, h: 0, dpr: 1,
      fit: function () {
        var box = canvas.parentElement.getBoundingClientRect();
        var dpr = Math.min(global.devicePixelRatio || 1, 2.5);
        var w = Math.max(120, Math.round(box.width));
        var h = Math.max(120, Math.round(box.height));
        if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
          canvas.width = Math.round(w * dpr);
          canvas.height = Math.round(h * dpr);
        }
        chart.w = w; chart.h = h; chart.dpr = dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        return chart;
      },
      clear: function () {
        ctx.setTransform(chart.dpr, 0, 0, chart.dpr, 0, 0);
        ctx.clearRect(0, 0, chart.w, chart.h);
      }
    };
    return chart;
  }

  /* ---------------- boot ---------------- */
  function boot() {
    var button = document.getElementById("themeBtn");
    if (button) {
      button.addEventListener("click", toggleTheme);
    }
    if (global.matchMedia) {
      var mq = global.matchMedia("(prefers-color-scheme: dark)");
      var handler = function () { notify(); };
      if (mq.addEventListener) mq.addEventListener("change", handler);
      else if (mq.addListener) mq.addListener(handler);
    }
    bindCollection();
  }

  global.MathLab = {
    theme: theme,
    toggleTheme: toggleTheme,
    onTheme: onTheme,
    collection: bindCollection,
    format: format,
    canvas: { lab: labCanvas }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(window);
