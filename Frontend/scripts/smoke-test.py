import sys, json, subprocess, time
from playwright.sync_api import sync_playwright

ROUTES = ['/', '/institutions', '/how-it-works', '/faq', '/login', '/register', '/nope-404']
BASE = 'http://localhost:4173'
failures = []

with sync_playwright() as p:
    b = p.chromium.launch()
    for route in ROUTES:
        page = b.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        try:
            page.goto(BASE + route, wait_until='networkidle', timeout=20000)
            page.wait_for_timeout(600)
            # white-screen check: is anything actually rendered inside #root?
            html = page.inner_html('#root')
            text = page.inner_text('body').strip()
            blank = len(html) < 50 or len(text) < 10
            status = 'BLANK' if blank else 'ok'
            # ignore network errors for the API (no backend running)
            real = [e for e in errors if 'Failed to load resource' not in e and 'net::ERR' not in e and 'api/v1' not in e]
            if blank or real:
                failures.append((route, status, real[:3]))
            print(f"  {route:16} {status:6} rendered={len(text)} chars  errors={len(real)}")
            if real:
                for e in real[:2]: print("       !", e[:160])
        except Exception as ex:
            failures.append((route, 'LOAD-FAIL', [str(ex)[:120]]))
            print(f"  {route:16} LOAD-FAIL {str(ex)[:100]}")
        page.close()
    b.close()

print()
if failures:
    print("SMOKE TEST FAILED:", len(failures), "route(s)")
    sys.exit(1)
print("SMOKE TEST PASSED — every route renders with no JS errors")
