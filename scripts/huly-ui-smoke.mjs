#!/usr/bin/env node
/**
 * Chromium smoke: Tracker All issues, My Clients All, HORECA1 Issues, project overflow.
 *   FRONT_URL=... HULY_USER=... HULY_PASSWORD=... node scripts/huly-ui-smoke.mjs
 */
import { createRequire } from 'module'
import { mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
const { chromium } = require(join(dirname(fileURLToPath(import.meta.url)), '_tmp-playwright/node_modules/playwright'))

const frontUrl = (process.env.FRONT_URL ?? 'https://huly.aneeverse.com').replace(/\/$/, '')
const email = process.env.HULY_USER
const password = process.env.HULY_PASSWORD
const allowEmpty = process.env.ALLOW_EMPTY === '1'
if (!email || !password) {
  console.error('Need HULY_USER and HULY_PASSWORD')
  process.exit(1)
}

const shotDir = join(process.cwd(), 'scripts', '_tmp-smoke-shots')
mkdirSync(shotDir, { recursive: true })

function totalFromText (text) {
  const m = String(text ?? '').match(/Total:\s*(\d+)/i)
  return m ? Number(m[1]) : null
}

async function waitWorkbench (page) {
  const deadline = Date.now() + 90000
  while (Date.now() < deadline) {
    const url = page.url()
    if (/selectWorkspace/.test(url)) {
      const btn = page.locator('.workspace').first()
      if (await btn.count()) await btn.click().catch(() => {})
    }
    const body = await page.locator('body').innerText().catch(() => '')
    const ready = /Tracker|Inbox|Chat|Company|All issues|My Clients/.test(body)
    const blocked = /Select workspace|Log In/.test(body)
    if (ready && !blocked) return true
    await page.waitForTimeout(1500)
  }
  return false
}

async function login (page) {
  await page.goto(`${frontUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(2500)
  const emailBox = page.locator('input[name="email"]')
  await emailBox.waitFor({ state: 'visible', timeout: 25000 })
  await emailBox.click()
  await emailBox.fill(email)
  const passBox = page.locator('input[name="current-password"], input[type="password"]').first()
  await passBox.click()
  await passBox.fill(password)
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: /log in/i }).first().click()
  await page.waitForURL(/selectWorkspace|workbench/, { timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(2000)
  const workspaceBtn = page.locator('.workspace').filter({ hasText: /aneeverse/i }).first()
  if (await workspaceBtn.count()) {
    await workspaceBtn.click()
  } else {
    const exact = page.getByText('aneeverse', { exact: true }).first()
    if (await exact.count()) await exact.click()
  }
  const ok = await waitWorkbench(page)
  if (!ok) console.log('workbench not ready after login, url=', page.url())
}

async function clickText (page, name) {
  await page.getByText(name, { exact: true }).first().click({ timeout: 20000 })
  await page.waitForTimeout(2500)
}

async function waitTotal (page) {
  await page.getByText(/Total:/i).first().waitFor({ timeout: 25000 }).catch(() => {})
}

async function shot (page, name) {
  await page.screenshot({ path: join(shotDir, `${name}.png`), fullPage: true }).catch(() => {})
}

async function main () {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  page.on('pageerror', (err) => console.log('pageerror', err.message))
  page.setDefaultTimeout(30000)
  const failures = []

  try {
    await login(page)
    console.log('login url', page.url())
    await shot(page, '01-after-login')

    await clickText(page, 'Tracker')
    await clickText(page, 'All issues')
    await waitTotal(page)
    await shot(page, '02-all-issues')
    const allBody = await page.locator('body').innerText()
    const allTotal = totalFromText(allBody)
    const selectedChip = page.locator('.antiChip, [class*="chip"]').filter({ hasText: /04-Bcmp Landing page updates/i })
    const chipCount = await selectedChip.count()
    console.log('All issues total=', allTotal, 'bcmpChipCount=', chipCount, 'url=', page.url())
    if (chipCount > 0 && allTotal !== null && allTotal <= 1) {
      failures.push(`All issues still scoped to 04-Bcmp chip, total=${allTotal}`)
    }
    if (!allowEmpty && (allTotal === null || allTotal <= 1)) {
      failures.push(`All issues expected more than one issue, total=${allTotal}`)
    }

    const trackerBody = await page.locator('body').innerText()
    const dupLabeled = (trackerBody.match(/00-Updates-Followups/gi) ?? []).length
    console.log(
      'Tracker 00-Updates-Followups mentions=',
      dupLabeled,
      'has company prefix=',
      /HORECA1\s*·/i.test(trackerBody) || /OCEAN/i.test(trackerBody) || / · /.test(trackerBody)
    )

    await page.locator('[data-id="app-sidebar-company"]').first().click({ timeout: 20000 })
    await page.waitForTimeout(2500)
    await clickText(page, 'My Clients')
    const allTab = page.getByText('All', { exact: true }).first()
    const hasAllTab = await allTab.count()
    if (hasAllTab) {
      await allTab.click().catch(() => {})
      await page.waitForTimeout(2000)
    }
    await waitTotal(page)
    await shot(page, '03-my-clients')
    const clientsBody = await page.locator('body').innerText()
    const clientsTotal = totalFromText(clientsBody)
    const companyNavOnList = await page.locator('.client-nav').count()
    console.log('My Clients total=', clientsTotal, 'has All=', hasAllTab > 0, 'companyNav=', companyNavOnList)
    if (companyNavOnList > 0) {
      failures.push('My Clients still shows a company nav block (e.g. MAAT)')
    }
    if (!allowEmpty && hasAllTab && (clientsTotal === null || clientsTotal < 1)) {
      failures.push(`My Clients expected clients, total=${clientsTotal}`)
    }
    if (!allowEmpty && !hasAllTab && process.env.REQUIRE_ALL_TAB === '1') {
      failures.push('My Clients All tab missing')
    }

    const ecom = page.getByText('ECOM', { exact: true }).first()
    const ecomCount = await ecom.count()
    console.log('ECOM funnel visible=', ecomCount > 0)
    if (ecomCount > 0) {
      await ecom.click()
      await page.waitForTimeout(3500)
      await waitTotal(page)
      await shot(page, '09-ecom-funnel')
      const funnelBody = await page.locator('body').innerText()
      const funnelTotal = totalFromText(funnelBody)
      console.log('ECOM funnel total=', funnelTotal, 'url=', page.url())
      if (!allowEmpty && (funnelTotal === null || funnelTotal < 1)) {
        failures.push(`ECOM funnel expected clients, total=${funnelTotal}`)
      }
    } else if (process.env.REQUIRE_FUNNEL === '1') {
      failures.push('ECOM funnel missing from Client sidebar')
    }

    await clickText(page, 'Companies')
    await page.waitForTimeout(2000)
    const horeca = page.getByText('HORECA1', { exact: true }).first()
    if (await horeca.count()) {
      await horeca.click()
      await page.waitForTimeout(3000)
    }
    await shot(page, '04-horeca1-home')
    const companyBody = await page.locator('body').innerText()
    const labeled = /HORECA1\s*·/i.test(companyBody) || /00UPDATE/i.test(companyBody) || / · /.test(companyBody)
    console.log('HORECA1 labeled project=', labeled)

    const firstMore = page.locator('.flex-presenter button').first()
    if (await firstMore.count()) {
      await firstMore.click({ timeout: 5000 }).catch(() => {})
      await page.waitForTimeout(800)
      const menuText = await page.locator('body').innerText()
      const hasArchive = /Archive/i.test(menuText)
      console.log('project overflow opened, has Archive=', hasArchive)
      if (!hasArchive) failures.push('Archive/Delete control missing on project overflow')
      await shot(page, '07-project-menu')
      await page.keyboard.press('Escape').catch(() => {})
      await page.waitForTimeout(400)
    } else {
      console.log('no overflow button found')
      if (!allowEmpty) failures.push('No project overflow button on HORECA1')
    }

    const issuesTab = page.locator('.company-related').getByText('Issues', { exact: true }).first()
    if (await issuesTab.count()) {
      await issuesTab.click()
      await page.waitForTimeout(4000)
    }
    await waitTotal(page)
    await shot(page, '05-horeca1-issues')
    const issuesBody = await page.locator('.company-related').innerText().catch(() => page.locator('body').innerText())
    const issuesTotal = totalFromText(issuesBody)
    console.log('HORECA1 Issues total=', issuesTotal)
    if (!allowEmpty && (issuesTotal === null || issuesTotal < 1)) {
      failures.push(`HORECA1 Issues expected >=1, total=${issuesTotal}`)
    }

    const backBtn = page.locator('.client-nav').getByRole('button').first()
    if (await backBtn.count()) {
      await backBtn.click()
      await page.waitForTimeout(2000)
    } else {
      await page.locator('[data-id="app-sidebar-company"]').first().click({ timeout: 10000 }).catch(() => {})
      await page.getByText('My Clients', { exact: true }).first().click({ timeout: 8000 }).catch(() => {})
      await page.waitForTimeout(2000)
    }
    await page.waitForTimeout(2000)
    await shot(page, '08-my-clients-after-company')
    const navAfter = await page.locator('.client-nav').count()
    console.log('My Clients after HORECA1 companyNav=', navAfter, 'url=', page.url())
    if (navAfter > 0) {
      failures.push('My Clients still shows company nav after leaving HORECA1')
    }
  } finally {
    await browser.close()
  }

  if (failures.length) {
    console.error('SMOKE FAIL:\n' + failures.join('\n'))
    process.exit(1)
  }
  console.log('SMOKE OK')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
