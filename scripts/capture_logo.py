from playwright.sync_api import sync_playwright

def capture(url, output_path, viewport_width, viewport_height, clip=None):
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={'width': viewport_width, 'height': viewport_height})
        page.goto(url, wait_until='networkidle')
        page.screenshot(path=output_path, full_page=False, clip=clip)
        browser.close()

url = 'http://localhost:8767'

capture(url, '/Users/burkii/rv-testsite/_screenshots/desktop-hero.png', 1440, 900)
capture(url, '/Users/burkii/rv-testsite/_screenshots/mobile-hero.png', 390, 844)
capture(url, '/Users/burkii/rv-testsite/_screenshots/nav-detail.png', 1440, 900,
        clip={'x': 0, 'y': 0, 'width': 1440, 'height': 120})
