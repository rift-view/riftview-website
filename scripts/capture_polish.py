import time
import json
from playwright.sync_api import sync_playwright

URL = "http://localhost:8765"
OUT = "/Users/burkii/rv-testsite/_screenshots"

def wait_net(page):
    page.wait_for_load_state("networkidle")
    time.sleep(4)

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()

        # 1. desktop-full.png — 1440 wide, full page
        pg1 = browser.new_page(viewport={"width": 1440, "height": 900})
        pg1.goto(URL, wait_until="networkidle")
        wait_net(pg1)
        pg1.screenshot(path=f"{OUT}/desktop-full.png", full_page=True)
        print(f"Saved: {OUT}/desktop-full.png")

        # 2. mobile-hero.png — 390x844, above the fold only
        pg2 = browser.new_page(viewport={"width": 390, "height": 844})
        pg2.goto(URL, wait_until="networkidle")
        wait_net(pg2)
        pg2.screenshot(path=f"{OUT}/mobile-hero.png", full_page=False)
        print(f"Saved: {OUT}/mobile-hero.png")

        # 3. features-desktop.png — 1440 wide, full-page then clip via PIL
        #    Strategy: take full-page screenshot, measure section bounds, crop in Python
        pg3 = browser.new_page(viewport={"width": 1440, "height": 900})
        pg3.goto(URL, wait_until="networkidle")
        wait_net(pg3)

        bounds = pg3.evaluate("""() => {
            const features = document.querySelector('#features');
            const compare = document.querySelector('#compare');
            const featuresTop = features
                ? Math.round(features.getBoundingClientRect().top + window.scrollY)
                : 0;
            let sectionBottom;
            if (compare) {
                sectionBottom = Math.round(compare.getBoundingClientRect().bottom + window.scrollY);
            } else if (features) {
                sectionBottom = Math.round(features.getBoundingClientRect().bottom + window.scrollY);
            } else {
                sectionBottom = document.body.scrollHeight;
            }
            return { featuresTop, sectionBottom, pageHeight: document.body.scrollHeight };
        }""")

        top = bounds["featuresTop"]
        bottom = bounds["sectionBottom"]
        page_height = bounds["pageHeight"]
        print(f"Section bounds: top={top} bottom={bottom} pageHeight={page_height}")

        # Take full-page screenshot then crop with PIL
        tmp_path = f"{OUT}/_tmp_features_full.png"
        pg3.screenshot(path=tmp_path, full_page=True)

        try:
            from PIL import Image
            img = Image.open(tmp_path)
            img_w, img_h = img.size
            # clamp to image bounds
            crop_top = max(0, min(top, img_h))
            crop_bottom = max(crop_top, min(bottom, img_h))
            cropped = img.crop((0, crop_top, img_w, crop_bottom))
            cropped.save(f"{OUT}/features-desktop.png")
            print(f"Saved: {OUT}/features-desktop.png (crop {crop_top}-{crop_bottom} of {img_h}px)")
            import os
            os.remove(tmp_path)
        except ImportError:
            import shutil
            shutil.move(tmp_path, f"{OUT}/features-desktop.png")
            print(f"PIL not available — saved full page as features-desktop.png")

        # --- Diagnostics ---

        # Mobile hero-meta overflow
        meta_diag = pg2.evaluate("""() => {
            const meta = document.querySelector('.hero-meta');
            if (!meta) return { found: false };
            const items = Array.from(meta.children).map(el => ({
                tag: el.tagName,
                className: el.className,
                scrollWidth: el.scrollWidth,
                offsetWidth: el.offsetWidth,
                overflow: el.scrollWidth > el.offsetWidth
            }));
            return {
                found: true,
                scrollWidth: meta.scrollWidth,
                offsetWidth: meta.offsetWidth,
                overflow: meta.scrollWidth > meta.offsetWidth,
                gridTemplateColumns: getComputedStyle(meta).gridTemplateColumns,
                children: items
            };
        }""")
        print("\n=== HERO-META DIAGNOSTICS (390px) ===")
        print(json.dumps(meta_diag, indent=2))

        # Feature-demo block heights
        feat_diag = pg3.evaluate("""() => {
            const blocks = Array.from(document.querySelectorAll('.feature-demo'));
            return blocks.map((el, i) => ({
                index: i,
                offsetHeight: el.offsetHeight,
                computedMinHeight: getComputedStyle(el).minHeight,
                display: getComputedStyle(el).display,
                flexDirection: getComputedStyle(el).flexDirection
            }));
        }""")
        print("\n=== FEATURE-DEMO BLOCK DIAGNOSTICS (1440px) ===")
        print(json.dumps(feat_diag, indent=2))

        browser.close()

if __name__ == "__main__":
    run()
