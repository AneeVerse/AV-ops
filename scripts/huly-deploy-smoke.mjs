#!/usr/bin/env node
/**
 * Post-deploy smoke test for huly.aneeverse.com.
 *
 * Catches the two failure modes that have taken production down:
 *   1. plugin load failure -> platform LoadHelper reload loop / black screen
 *   2. front bundle vs workspace model mismatch -> workbench never renders
 *
 *   FRONT_URL=https://huly.aneeverse.com HULY_USER=... HULY_PASSWORD=... \
 *     node scripts/huly-deploy-smoke.mjs
 *
 * Exits non-zero on failure so the deploy can roll back.
 */
import { createRequire } from 'module'
import { mkdirSync, existsSync } from 'fs'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'

const scriptsDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptsDir, '..')
const require = createRequire(import.meta.url)

const playwrightCandidates = [
  join(scriptsDir, '.deploy-tools', 'node_modules', 'playwright'),
  join(scriptsDir, '_tmp-playwright', 'node_modules', 'playwright'),
  'playwright'
]

function loadChromium () {
  for (const candidate of playwrightCandidates) {
    try {
      return require(candidate).chromium
    } catch {}
  }
  console.error(
    'Playwright not found. Install it once with:\n' +
      '  mkdir -p scripts/.deploy-tools && cd scripts/.deploy-tools && npm i playwright && npx playwright install chromium\n' +
      'Or skip the smoke stage with SKIP_SMOKE=1 (not recommended).'
  )
  process.exit(2)
}

const frontUrl = (process.env.FRONT_URL ?? 'https://huly.aneeverse.com').replace(/\/$/, '')
const email = process.env.HULY_USER
const password = process.env.HULY_PASSWORD
const workspace = process.env.HULY_WORKSPACE ?? 'aneeverse'
const settleMs = Number(process.env.SMOKE_SETTLE_MS ?? 12000)

const shotDir = join(repoRoot, 'scripts', '_deploy-smoke')
mkdirSync(shotDir, { recursive: true })

// Noise that does not indicate a broken deploy.
const ignoredError = /favicon|manifest\.json|ERR_INTERNET_DISCONNECTED|sw\.js|ResizeObserver/i

async function main () {
  const chromium = loadChromium()
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()

  const consoleErrors = []
  const reloadLoopHits = []
  let navigations = 0

  page.on('console', (m) => {
    const text = m.text()
    if (text.includes('reload due to loading error')) reloadLoopHits.push(text)
    if (m.type() === 'error' && !ignoredError.test(text)) consoleErrors.push(text)
  })
  page.on('pageerror', (err) => {
    if (!ignoredError.test(err.message)) consoleErrors.push(`pageerror: ${err.message}`)
  })
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) navigations++
  })

  const failures = []
  const shot = async (name) => {
    await page.screenshot({ path: join(shotDir, `${name}.png`), fullPage: false }).catch(() => {})
  }

  try {
    // --- 1. anonymous load: bundle must boot without the reload loop ---
    await page.goto(`${frontUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    navigations = 0
    await page.waitForTimeout(settleMs)
    await shot('01-login')

    const bundles = await page.evaluate(() =>
      Array.from(document.scripts)
        .map((s) => s.src.split('/').pop())
        .filter(Boolean)
    )
    console.log(`bundle: ${bundles.join(', ')}`)

    if (reloadLoopHits.length > 0) {
      failures.push(`platform reload loop detected (${reloadLoopHits.length}x "reload due to loading error")`)
    }
    if (navigations > 0) {
      failures.push(`page reloaded ${navigations}x after settling — reload loop`)
    }

    const hasEmail = await page.locator('input[name="email"]').count()
    if (hasEmail === 0) {
      failures.push('login form never rendered (blank page)')
    }

    // Bail out before login if the bundle itself is broken.
    if (failures.length > 0) throw new Error('anonymous load failed')

    if (email === undefined || password === undefined || email === '' || password === '') {
      console.log('no credentials supplied — skipping logged-in workbench check')
    } else {
      // --- 2. logged-in load: workbench must resolve model + components ---
      await page.locator('input[name="email"]').fill(email)
      await page.locator('input[name="current-password"], input[type="password"]').first().fill(password)
      await page.getByRole('button', { name: /log in/i }).first().click()
      await page.waitForTimeout(6000)

      const wsButton = page.locator('.workspace').filter({ hasText: new RegExp(workspace, 'i') }).first()
      if ((await wsButton.count()) > 0) {
        await wsButton.click().catch(() => {})
      } else {
        await page.getByText(workspace, { exact: true }).first().click({ timeout: 8000 }).catch(() => {})
      }

      const deadline = Date.now() + 90000
      let ready = false
      while (Date.now() < deadline) {
        const body = await page.locator('body').innerText().catch(() => '')
        if (/Tracker|Inbox|Chat|Settings/.test(body) && !/Log In|Select workspace/.test(body)) {
          ready = true
          break
        }
        await page.waitForTimeout(1500)
      }
      await shot('02-workbench')

      if (!ready) {
        failures.push(`workbench never rendered after login (url=${page.url()})`)
      }
      if (reloadLoopHits.length > 0) {
        failures.push(`reload loop after login (${reloadLoopHits.length}x)`)
      }
    }

    if (consoleErrors.length > 0) {
      failures.push(`console errors:\n    - ${consoleErrors.slice(0, 8).join('\n    - ')}`)
    }
  } catch (err) {
    if (failures.length === 0) failures.push(`smoke crashed: ${err.message}`)
    await shot('99-failure')
  } finally {
    await browser.close()
  }

  if (failures.length > 0) {
    console.error(`\nSMOKE FAIL (${failures.length}):`)
    for (const f of failures) console.error(`  - ${f}`)
    console.error(`\nScreenshots: ${shotDir}`)
    process.exit(1)
  }

  console.log('SMOKE OK — bundle boots, no reload loop, workbench renders')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
