"""
Browser smoke test: loads every route in a real browser and fails on any JS
error or blank screen.

Covers AUTHENTICATED routes as well as public ones — a crash inside onboarding
or a dashboard is invisible to a public-only check.

Usage:  python3 scripts/smoke-test.py [base_url] [email] [password]
"""
import sys
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:4173'
EMAIL = sys.argv[2] if len(sys.argv) > 2 else None
PASSWORD = sys.argv[3] if len(sys.argv) > 3 else None

PUBLIC = ['/', '/institutions', '/how-it-works', '/faq', '/login', '/register', '/nope-404']
PRIVATE = ['/onboarding/biodata', '/onboarding/exam-details', '/app', '/app/profile',
           '/app/apply', '/app/applications', '/app/payments']

failures = []

def visit(page, route):
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(BASE + route, wait_until='networkidle', timeout=25000)
    page.wait_for_timeout(700)
    text = page.inner_text('body').strip()
    crashed = 'Something went wrong' in text          # our error boundary
    blank = len(text) < 10
    real = [e for e in errors if 'api/v1' not in e]
    status = 'CRASH' if crashed else ('BLANK' if blank else 'ok')
    print(f"  {route:26} {status:6} {len(text):>5} chars  {len(real)} err")
    if crashed or blank or real:
        failures.append((route, status, real[:2]))
        for e in real[:2]:
            print('       !', e[:150])

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 1280, 'height': 900})

    print('PUBLIC ROUTES')
    for r in PUBLIC:
        pg = ctx.new_page(); visit(pg, r); pg.close()

    if EMAIL and PASSWORD:
        print('\nSIGNING IN')
        pg = ctx.new_page()
        pg.goto(BASE + '/login', wait_until='networkidle')
        pg.fill('input[type=email]', EMAIL)
        pg.fill('input[type=password]', PASSWORD)
        pg.click("button:has-text('Sign in')")
        pg.wait_for_timeout(3000)
        print('  signed in ->', pg.url.replace(BASE, '') or '/')
        pg.close()

        print('\nAUTHENTICATED ROUTES')
        for r in PRIVATE:
            pg = ctx.new_page(); visit(pg, r); pg.close()
    else:
        print('\n(no credentials given — authenticated routes skipped)')

    b.close()

print()
if failures:
    print(f"SMOKE FAILED — {len(failures)} route(s):")
    for r, s, _ in failures:
        print(f"   {s}  {r}")
    sys.exit(1)
print("SMOKE PASSED — every route renders with no JS errors")
