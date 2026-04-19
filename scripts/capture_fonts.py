import json
import time
from playwright.sync_api import sync_playwright

URL = "http://localhost:8766"
OUT = "/Users/burkii/rv-testsite/_screenshots"

console_msgs = []

def capture(page, path, full_page=False):
    page.wait_for_load_state("networkidle")
    time.sleep(4)
    page.screenshot(path=path, full_page=full_page)
    print(f"Saved: {path}")

def collect_font_diagnostics(page):
    return page.evaluate("""() => {
        function cf(sel) {
            const el = document.querySelector(sel);
            if (!el) return { found: false };
            const cs = getComputedStyle(el);
            return {
                found: true,
                fontFamily: cs.fontFamily,
                fontSize: cs.fontSize,
                fontStyle: cs.fontStyle,
                fontWeight: cs.fontWeight,
            };
        }
        // ember spans: look for <em> or <span class="ember"> or similar
        const emberEls = Array.from(document.querySelectorAll('em, .ember, [class*="ember"]'));
        const emberSample = emberEls.slice(0, 3).map(el => ({
            tag: el.tagName,
            class: el.className,
            text: el.textContent.trim().slice(0, 40),
            fontFamily: getComputedStyle(el).fontFamily,
            fontStyle: getComputedStyle(el).fontStyle,
            fontWeight: getComputedStyle(el).fontWeight,
        }));
        const h1 = cf('h1');
        const bodyP = cf('p');
        const code = cf('code');
        const nav = cf('nav a');
        return { h1, bodyP, code, nav, emberSample };
    }""")

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()

        # Desktop hero — font diagnostics
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.on("console", lambda msg: console_msgs.append(f"[{msg.type}] {msg.text}"))
        page.goto(URL, wait_until="networkidle")
        time.sleep(4)
        fonts = collect_font_diagnostics(page)
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

        browser.close()

        print("\n=== FONT DIAGNOSTICS ===")
        print(json.dumps(fonts, indent=2))

        print("\n=== CONSOLE (errors/warnings only) ===")
        filtered = [m for m in console_msgs if m.startswith("[error]") or m.startswith("[warning]")]
        for m in filtered: print(m)
        if not filtered: print("None")

        print("\n=== ALL CONSOLE MSGS (first 20) ===")
        for m in console_msgs[:20]: print(m)

if __name__ == "__main__":
    run()
