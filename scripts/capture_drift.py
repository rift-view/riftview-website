from playwright.sync_api import sync_playwright

def capture(url, output_path, viewport_width, viewport_height):
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={'width': viewport_width, 'height': viewport_height})
        page.goto(url, wait_until='networkidle')

        # Get absolute page Y of the drift feature via JS (before any scrolling)
        abs_y = page.evaluate("""
            () => {
                const els = document.querySelectorAll('.feature');
                for (const el of els) {
                    if (el.innerText.includes('Your IaC')) {
                        return el.getBoundingClientRect().top + window.scrollY;
                    }
                }
                return null;
            }
        """)

        if abs_y is not None:
            # Scroll so the section sits 40px from the top of the viewport
            page.evaluate(f'window.scrollTo(0, {abs_y - 40})')
            page.wait_for_timeout(500)

        page.screenshot(path=output_path, full_page=False)
        browser.close()

# Desktop: 1440x900
capture('http://localhost:8767',
        '/Users/burkii/rv-testsite/_screenshots/drift-heading.png',
        1440, 900)

# Mobile: 390x844
capture('http://localhost:8767',
        '/Users/burkii/rv-testsite/_screenshots/drift-heading-mobile.png',
        390, 844)

print("Done")
