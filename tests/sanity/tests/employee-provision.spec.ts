import { expect, test, type Page } from '@playwright/test'
import { generateId } from './utils'
import { ContractPage } from './model/contacts/contract-page'
import { LoginPage } from './model/login-page'
import { SelectWorkspacePage } from './model/select-workspace-page'
import { UserProfilePage } from './model/profile/user-profile-page'

const platformUri = (process.env.PLATFORM_URI ?? 'http://localhost:8080').replace(/\/$/, '')
const adminUser = process.env.PLATFORM_USER ?? process.env.HULY_USER ?? 'user1'
const adminPassword = process.env.PLATFORM_PASSWORD ?? process.env.HULY_PASSWORD ?? '1234'
const workspace = process.env.PLATFORM_WS ?? process.env.HULY_WORKSPACE ?? 'local-ws'
const expectSignupHidden =
  process.env.EXPECT_SIGNUP_HIDDEN === '1' || platformUri.includes('app.aneeverse.com')

const shouldRun =
  process.env.EMPLOYEE_PROVISION === '1' ||
  /localhost:\d+|app\.aneeverse\.com/.test(process.env.PLATFORM_URI ?? '')

test.use({
  storageState: { cookies: [], origins: [] }
})

test.describe('admin-provisioned employees', () => {
  test.skip(!shouldRun, 'Set EMPLOYEE_PROVISION=1 (or PLATFORM_URI to local.cmd / production)')
  test.describe.configure({ timeout: 600000 })

  let first: string
  let last: string
  let email: string
  let password: string
  let phone: string

  test.beforeEach(() => {
    const id = generateId(6)
    first = 'Emp-' + id
    last = 'Test-' + id
    email = `emp.${id}@example.com`
    password = 'EmpPass123'
    phone = '+15550001111'
  })

  test('create, login, forgot-password UI, delete', async ({ page }) => {
    const loginPage = new LoginPage(page)
    const contractPage = new ContractPage(page)
    const profile = new UserProfilePage(page)
    let created = false

    try {
      await loginAs(page, loginPage, adminUser, adminPassword)
      await enterWorkspace(page, workspace)
      await dismissOverlays(page)
      await contractPage.openEmployeesPage()

      await contractPage.addEmployee(first, last, email, password, phone)
      created = true
      await contractPage.checkIfPersonIsCreated(first, last)

      await signOut(page)
      await loginAs(page, loginPage, email, password)
      await enterWorkspace(page, workspace)
      await expect(page.locator('#profile-button')).toBeVisible({ timeout: 60000 })
      await expect(page).toHaveURL(new RegExp(`/workbench/${workspace}`))
      await dismissOverlays(page)

      await signOut(page)
      await page.goto(`${platformUri}/login/password`, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await loginPage.checkIfPasswordRecoveryIsVisible(!expectSignupHidden)
      await expect(page).toHaveURL(/\/login\/password/)

      await loginAs(page, loginPage, adminUser, adminPassword)
      await enterWorkspace(page, workspace)
      await dismissOverlays(page)
      await contractPage.openEmployeesPage()
      await contractPage.checkIfPersonIsCreated(first, last)

      const newPassword = password + 'X'
      await contractPage.openEmployeeProfile(first, last)
      await contractPage.setPasswordInDetailPanel(newPassword)

      await signOut(page)
      await loginAs(page, loginPage, email, newPassword)
      await enterWorkspace(page, workspace)
      await expect(page.locator('#profile-button')).toBeVisible({ timeout: 60000 })

      await signOut(page)
      await loginAs(page, loginPage, adminUser, adminPassword)
      await enterWorkspace(page, workspace)
      await dismissOverlays(page)
      await contractPage.openEmployeesPage()
      await contractPage.checkIfPersonIsCreated(first, last)
      await contractPage.deleteEmployeeFromRow(first, last)
      created = false
      await contractPage.checkIfPersonIsDeleted(first, last, 0)

      await signOut(page)
      await page.goto(`${platformUri}/login/login`, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await waitForLoginFormReady(page)
      await loginPage.login(email, password)
      const workspaceButton = new SelectWorkspacePage(page).workspaceButtonByName(workspace)
      await expect(workspaceButton).toHaveCount(0, { timeout: 30000 })
      await expect(page).not.toHaveURL(new RegExp(`/workbench/${workspace}`), { timeout: 30000 })
    } finally {
      if (created) {
        await cleanupEmployee(page, loginPage, contractPage, profile, first, last)
      }
    }
  })

  test('signup is hidden when DISABLE_SIGNUP is on', async ({ page }) => {
    test.skip(!expectSignupHidden, 'Signup stays available on local/sanity unless DISABLE_SIGNUP is on')
    const loginPage = new LoginPage(page)
    await (await page.goto(`${platformUri}/login/login`))?.finished()
    await loginPage.checkIfSignUpIsHidden()
    await expect(page.locator('input[name=current-password]')).toBeVisible()
  })

  test('re-adding an existing account replaces its password and clears a login lock', async ({ page }) => {
    const loginPage = new LoginPage(page)
    const contractPage = new ContractPage(page)
    const profile = new UserProfilePage(page)
    const replacementPassword = `${password}New`
    let created = false

    try {
      await loginAs(page, loginPage, adminUser, adminPassword)
      await enterWorkspace(page, workspace)
      await dismissOverlays(page)
      await contractPage.openEmployeesPage()

      await contractPage.addEmployee(first, last, email, password, phone)
      created = true
      await contractPage.deleteEmployeeFromRow(first, last)
      created = false

      await signOut(page)
      for (let attempt = 0; attempt < 5; attempt++) {
        await loginPage.login(email, `WrongPassword${attempt}`)
        await expect(loginPage.invalidCredentialsMessage()).toBeVisible({ timeout: 30000 })
      }

      await loginPage.login(email, 'WrongPasswordLocked')
      await expect(loginPage.passwordLoginLockedMessage()).toBeVisible({ timeout: 30000 })

      await loginAs(page, loginPage, adminUser, adminPassword)
      await enterWorkspace(page, workspace)
      await dismissOverlays(page)
      await contractPage.openEmployeesPage()
      await contractPage.addEmployee(first, last, email, replacementPassword, phone)
      created = true

      await signOut(page)
      await loginAs(page, loginPage, email, replacementPassword)
      await enterWorkspace(page, workspace)
      await expect(page.locator('#profile-button')).toBeVisible({ timeout: 60000 })
    } finally {
      if (created) {
        await cleanupEmployee(page, loginPage, contractPage, profile, first, last)
      }
    }
  })

  test('forgot password does not reveal whether an account exists', async ({ page }) => {
    const loginPage = new LoginPage(page)
    await page.goto(`${platformUri}/login/password`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await loginPage.requestPasswordReset(`missing.${generateId(8)}@example.com`)
    await expect(page.getByText('Password recovery link sent to email')).toBeVisible({ timeout: 30000 })
  })

  test('admin can create and reset a guest login', async ({ page }) => {
    const loginPage = new LoginPage(page)
    const contractPage = new ContractPage(page)
    const profile = new UserProfilePage(page)
    const replacementPassword = `${password}Guest`
    let created = false

    try {
      await loginAs(page, loginPage, adminUser, adminPassword)
      await enterWorkspace(page, workspace)
      await dismissOverlays(page)
      await contractPage.openGuestsPage()
      await contractPage.addGuest(first, last, email, password, phone)
      created = true
      await contractPage.checkIfPersonIsCreated(first, last)

      await signOut(page)
      await loginAs(page, loginPage, email, password)
      await enterWorkspace(page, workspace)
      await expect(page.locator('#profile-button')).toBeVisible({ timeout: 60000 })

      await signOut(page)
      await loginAs(page, loginPage, adminUser, adminPassword)
      await enterWorkspace(page, workspace)
      await dismissOverlays(page)
      await contractPage.openGuestsPage()
      await contractPage.openEmployeeProfile(first, last)
      await contractPage.setPasswordInDetailPanel(replacementPassword)

      await signOut(page)
      await loginAs(page, loginPage, email, replacementPassword)
      await enterWorkspace(page, workspace)
      await expect(page.locator('#profile-button')).toBeVisible({ timeout: 60000 })
    } finally {
      if (created) {
        await cleanupGuest(page, loginPage, contractPage, profile, first, last)
      }
    }
  })
})

async function waitForLoginFormReady (page: Page): Promise<void> {
  await page.locator('input[name=email]').waitFor({ state: 'visible', timeout: 120000 })
  // Webpack first load can show untranslated keys until login-resources finishes.
  await page.getByRole('button', { name: 'Log In', exact: true }).waitFor({ state: 'visible', timeout: 120000 })
}

async function loginAs (page: Page, loginPage: LoginPage, email: string, password: string): Promise<void> {
  await page.goto(`${platformUri}/login/login`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await waitForLoginFormReady(page)
  await loginPage.login(email, password)
  await page.waitForURL((url) => !url.pathname.includes('/login/login'), { timeout: 60000 })
}

async function enterWorkspace (page: Page, workspaceName: string): Promise<void> {
  const workbench = new RegExp(`/workbench/${workspaceName}`)
  if (workbench.test(page.url())) {
    await dismissOverlays(page)
    return
  }
  const select = new SelectWorkspacePage(page)
  await Promise.race([
    page.waitForURL(workbench, { timeout: 120000 }),
    select.title().waitFor({ state: 'visible', timeout: 120000 })
  ])
  if (workbench.test(page.url())) {
    await dismissOverlays(page)
    return
  }
  await page.getByText('LoadingPlugin').waitFor({ state: 'hidden', timeout: 120000 }).catch(() => {})
  const wsButton = page.locator('.workspace').filter({ hasText: new RegExp(workspaceName, 'i') }).first()
  await Promise.race([
    wsButton.waitFor({ state: 'visible', timeout: 60000 }),
    page.waitForURL(workbench, { timeout: 60000 })
  ]).catch(() => {})
  if (workbench.test(page.url())) {
    await dismissOverlays(page)
    return
  }
  if ((await wsButton.count()) > 0) {
    await wsButton.click()
  } else {
    await select.selectWorkspace(workspaceName)
  }
  try {
    await page.waitForURL(workbench, { timeout: 30000 })
  } catch {
    await page.goto(`${platformUri}/workbench/${workspaceName}/`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    })
    await page.waitForURL(workbench, { timeout: 120000 })
  }
  await dismissOverlays(page)
}

async function dismissOverlays (page: Page): Promise<void> {
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Escape')
  }
}

async function signOut (page: Page, _profile?: UserProfilePage): Promise<void> {
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  await page.context().clearCookies()
  await page.goto(`${platformUri}/login/login`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await waitForLoginFormReady(page)
}

async function cleanupEmployee (
  page: Page,
  loginPage: LoginPage,
  contractPage: ContractPage,
  profile: UserProfilePage,
  firstName: string,
  lastName: string
): Promise<void> {
  try {
    if (page.url().includes('/workbench/')) {
      await signOut(page, profile).catch(() => {})
    }
    await loginAs(page, loginPage, adminUser, adminPassword)
    await enterWorkspace(page, workspace)
    await contractPage.openEmployeesPage()
    if ((await contractPage.employeeEntry(firstName, lastName).count()) > 0) {
      await contractPage.deleteEmployeeFromRow(firstName, lastName)
    }
  } catch (err) {
    console.warn('Failed to clean up test employee', firstName, lastName, err)
  }
}

async function cleanupGuest (
  page: Page,
  loginPage: LoginPage,
  contractPage: ContractPage,
  profile: UserProfilePage,
  firstName: string,
  lastName: string
): Promise<void> {
  try {
    if (page.url().includes('/workbench/')) {
      await signOut(page, profile).catch(() => {})
    }
    await loginAs(page, loginPage, adminUser, adminPassword)
    await enterWorkspace(page, workspace)
    await contractPage.openGuestsPage()
    if ((await contractPage.employeeEntry(firstName, lastName).count()) > 0) {
      await contractPage.deleteEmployeeFromRow(firstName, lastName)
    }
  } catch (err) {
    console.warn('Failed to clean up test guest', firstName, lastName, err)
  }
}
