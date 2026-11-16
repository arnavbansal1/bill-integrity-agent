"""Assemble the single-page app (app/index.html) from the source files in src/.

  python3 tools/build.py           write app/index.html
  python3 tools/build.py --check   exit 1 if app/index.html differs from what the sources produce

Order: src/data, src/engine and src/ui hold numbered .js files; they are concatenated by number, byte for byte.
The page template (src/app.html) has four markers: styles, script, and the two generated panels.
"""
import pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
OUT = ROOT / "app" / "index.html"
sys.path.insert(0, str(ROOT / "tools"))
import arch, evals  # noqa: E402  (panel generators: diagrams, tables, "evals we ran")


def read(path):
    with open(path, encoding="utf-8", newline="") as f:
        return f.read()


def put(page, marker, text):
    assert page.count(marker) == 1, f"marker {marker} must appear exactly once"
    return page.replace(marker, text)


def build():
    parts = sorted((f for d in ("data", "engine", "ui") for f in (SRC / d).glob("*.js")), key=lambda f: f.name)
    numbers = [f.name[:2] for f in parts]
    assert len(set(numbers)) == len(numbers), "each source file needs its own two-digit number"
    script = "".join(read(f) for f in parts)
    # case data: the recorded live run shown by default on the blind set
    script = put(script, "__RECORDED_BLIND__", read(ROOT / "case" / "recorded_run_blind.json").strip())
    page = read(SRC / "app.html")
    page = put(page, "/*__BUILD:STYLES__*/", read(SRC / "styles.css"))
    page = put(page, "<!--__BUILD:PANEL:EVALS__-->", evals.panel_html())
    page = put(page, "<!--__BUILD:PANEL:ARCHITECTURE__-->", arch.panel_html())
    page = put(page, "/*__BUILD:SCRIPT__*/", script)
    return page.encode("utf-8")


if __name__ == "__main__":
    page = build()
    if "--check" in sys.argv:
        same = OUT.exists() and OUT.read_bytes() == page
        print("app/index.html is up to date" if same else "app/index.html differs from the sources; run tools/build.py")
        sys.exit(0 if same else 1)
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_bytes(page)
    print(f"built app/index.html ({len(page)} bytes from {len(list(SRC.rglob('*.js')))} script files)")
