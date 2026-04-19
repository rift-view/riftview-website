import time
from playwright.sync_api import sync_playwright

def capture(url, output_path, viewport_width, viewport_height, full_page=False):
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={'width': viewport_width, 'height': viewport_height})
        page.goto(url, wait_until='networkidle')
        time.sleep(4)
        page.screenshot(path=output_path, full_page=full_page)
        browser.close()

url = 'http://localhost:8767'

capture(url, '/Users/burkii/rv-testsite/_screenshots/desktop-hero.png', 1440, 900, full_page=False)
print('desktop-hero done')

capture(url, '/Users/burkii/rv-testsite/_screenshots/desktop-full.png', 1440, 900, full_page=True)
print('desktop-full done')

capture(url, '/Users/burkii/rv-testsite/_screenshots/mobile-hero.png', 390, 844, full_page=False)
print('mobile-hero done')
