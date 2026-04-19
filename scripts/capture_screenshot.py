import json
import time
from playwright.sync_api import sync_playwright

URL = "http://localhost:8765"
OUT = "/Users/burkii/rv-testsite/_screenshots"

errors = []
requests_failed = []

def capture(page, path, full_page=False):
    page.wait_for_load_state("networkidle")
    time.sleep(4)
    page.screenshot(path=path, full_page=full_page)
    print(f"Saved: {path}")

def collect_diagnostics(page):
    return page.evaluate("""() => {
        const canvases = Array.from(document.querySelectorAll('canvas'));
        return {
            docTitle: document.title,
            htmlClasses: document.documentElement.className,
            canvasCount: canvases.length,
            canvases: canvases.map(c => ({
                id: c.id,
                className: c.className,
                width: c.width,
                height: c.height,
                offsetWidth: c.offsetWidth,
                offsetHeight: c.offsetHeight,
                parentHeight: c.parentElement ? c.parentElement.offsetHeight : 0,
                visible: c.offsetWidth > 0 && c.offsetHeight > 0,
            })),
            heroGraphMinHeight: (() => {
                const el = document.querySelector('.hero-graph');
                return el ? getComputedStyle(el).minHeight : 'not found';
            })(),
            sectionsVisible: ['#problem','#answer','#features','#compare','#how','#specs','#download','footer'].map(sel => {
                const el = document.querySelector(sel);
                return { sel, found: !!el, offsetHeight: el ? el.offsetHeight : 0 };
            }),
            blastCanvas: (() => {
                const bc = document.querySelector('.blast-canvas, [class*="blast"]');
                return bc ? { found: true, tag: bc.tagName, width: bc.width || bc.offsetWidth, height: bc.height || bc.offsetHeight } : { found: false };
            })(),
        };
    }""")

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()

        # Desktop page — collect errors + diagnostics here
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.on("console", lambda msg: errors.append(f"[{msg.type}] {msg.text}") if msg.type in ("error", "warning") else None)
        page.on("requestfailed", lambda req: requests_failed.append(f"FAILED: {req.url} — {req.failure}"))
        page.goto(URL, wait_until="networkidle")
        time.sleep(4)
        diag = collect_diagnostics(page)
        capture(page, f"{OUT}/desktop-hero.png", full_page=False)

        # Desktop full
        page2 = browser.new_page(viewport={"width": 1440, "height": 900})
        page2.goto(URL, wait_until="networkidle")
        time.sleep(4)
        capture(page2, f"{OUT}/desktop-full.png", full_page=True)

        # Mobile hero
        page3 = browser.new_page(viewport={"width": 390, "height": 844})
        page3.goto(URL, wait_until="networkidle")
        time.sleep(4)
        capture(page3, f"{OUT}/mobile-hero.png", full_page=False)

        # Mobile full
        page4 = browser.new_page(viewport={"width": 390, "height": 844})
        page4.goto(URL, wait_until="networkidle")
        time.sleep(4)
        capture(page4, f"{OUT}/mobile-full.png", full_page=True)

        browser.close()

        print("\n=== CONSOLE ERRORS ===")
        for e in errors: print(e)
        if not errors: print("None")

        print("\n=== FAILED REQUESTS ===")
        for r in requests_failed: print(r)
        if not requests_failed: print("None")

        print("\n=== DIAGNOSTICS ===")
        print(json.dumps(diag, indent=2))

if __name__ == "__main__":
    run()
