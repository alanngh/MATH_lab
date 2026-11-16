import base64
import json
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path("/home/alan/Desktop/MATH_lab/3214")
SRC = ROOT / "surface_openness_simulator.html"
OUT = ROOT / ".shots"
OUT.mkdir(exist_ok=True)

TESTS = {
    "default": None,
    "sphere": ["sphere", 0.0, 0.85, 0.8, 1.25],
    "torus": ["torus", 0.9, 1.2, 0.5, 1.25],
    "saddle": ["saddle", 0.0, 0.0, 0.9, 1.25],
    "wave": ["wave", 0.0, 0.0, 1.0, 2.0],
    "plane": ["plane", 0.0, 0.0, 1.0, 1.25],
}

HOOK = """<script>
window.__errs = [];
window.addEventListener("error", function (e) { window.__errs.push(e.message + " @" + e.lineno); });
window.addEventListener("DOMContentLoaded", function () {
  setTimeout(function () {
    var spec = %s;
    if (spec) {
      var g = function (id) { return document.getElementById(id); };
      g("preset").value = spec[0]; g("preset").dispatchEvent(new Event("change"));
      g("a").value = String(spec[1]); g("b").value = String(spec[2]);
      g("radius").value = String(spec[3]); g("domain").value = String(spec[4]);
      g("a").dispatchEvent(new Event("input"));
    }
    setTimeout(function () {
      var cv = document.getElementById("plot");
      var out = document.createElement("div"); out.id = "__png";
      out.textContent = cv.toDataURL("image/png");
      var err = document.createElement("div"); err.id = "__errs";
      err.textContent = JSON.stringify(window.__errs);
      document.body.appendChild(out); document.body.appendChild(err);
    }, 600);
  }, 700);
});
</script>"""

source = SRC.read_text()
names = sys.argv[1:] or list(TESTS)
for name in names:
    spec = TESTS[name]
    page = source.replace("</head>", (HOOK % json.dumps(spec)) + "\n</head>")
    probe_path = ROOT / ("_probe_%s.html" % name)
    probe_path.write_text(page)
    dom = subprocess.run(
        ["google-chrome", "--headless=new", "--disable-gpu", "--no-sandbox",
         "--window-size=1440,1200", "--virtual-time-budget=7000",
         "--dump-dom", "file://%s" % probe_path],
        capture_output=True, text=True).stdout
    png = re.search(r'id="__png">data:image/png;base64,([^<]+)<', dom)
    errs = re.search(r'id="__errs">([^<]*)<', dom)
    if not png:
        print(name, "NO PNG")
        continue
    (OUT / ("canvas_%s.png" % name)).write_bytes(base64.b64decode(png.group(1)))
    print(name, "errors", errs.group(1) if errs else "?")
