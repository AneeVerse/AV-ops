import { expect, type Locator, type Page } from '@playwright/test'
import { PlatformURI } from '../utils'

export class LoginPage {
  readonly page: Page

  constructor (page: Page) {
    this.page = page
  }

  inputEmail = (): Locator => this.page.locator('input[name=email]')
  inputPassword = (): Locator => this.page.locator('input[name=current-password]')
  buttonLogin = (): Locator => this.page.locator('button', { hasText: 'Log In' })
  loginWithPassword = (): Locator => this.page.locator('a', { hasText: 'Login with password' })
  linkSignUp = (): Locator => this.page.locator('a.title', { hasText: 'Sign Up' })
  invalidCredentialsMessage = (): Locator =>
    this.page.getByText('Account not found or the provided credentials are incorrect')
  passwordLoginLockedMessage = (): Locator =>
    this.page.getByText('Password login is locked after too many failed attempts. Use Forgot password')

  recoverLink = (): Locator => this.page.getByRole('link', { name: 'Recover' })
  passwordRecovery = (): Locator => this.page.getByText('Password recovery')
  recoveryLoginText = (): Locator => this.page.getByText('Know your password? Log In')
  recoverySignUpText = (): Locator => this.page.getByText('Do not have an account? Sign Up')
  recoveryLogin = (): Locator => this.page.getByRole('link', { name: 'Log In' })
  recoverySignUp = (): Locator => this.page.getByRole('link', { name: 'Sign Up' })

  profileButton = (): Locator => this.page.locator('#profile-button')
  popupItemButton = (hasText: string): Locator => this.page.locator('div.popup button[class*="menu"]', { hasText })

  // ACTIONS
  async goto (): Promise<void> {
    await (await this.page.goto(`${PlatformURI}/login/login`))?.finished()
  }

  // ACTIONS
  async gotoAdmin (): Promise<void> {
    await (await this.page.goto(`${PlatformURI}/login/admin`))?.finished()
  }

  async clickSignUp (): Promise<void> {
    await this.linkSignUp().click()
  }

  async clickOnRecover (): Promise<void> {
    await this.recoverLink().click()
  }

  async clickOnRecoveryLogin (): Promise<void> {
    await this.recoveryLogin().click()
  }

  async clickOnRecoverySignUp (): Promise<void> {
    await this.recoverySignUp().click()
  }

  async login (email: string, password: string): Promise<void> {
    const loginWithPassword = this.loginWithPassword()
    if (!(await this.inputPassword().isVisible()) && (await loginWithPassword.isVisible())) {
      await loginWithPassword.click()
    }
    await this.inputEmail().fill(email)
    await this.inputPassword().fill(password)
    expect(await this.buttonLogin().isEnabled()).toBe(true)
    await this.buttonLogin().click()
  }

  async requestPasswordReset (email: string): Promise<void> {
    await this.inputEmail().fill(email)
    await this.page.getByRole('button', { name: 'Recover', exact: true }).click()
  }

  async openProfileMenu (): Promise<void> {
    await this.profileButton().click()
  }

  // ASSERTS

  async checkIfErrorMessageIsShown (message: string): Promise<void> {
    if (message === 'wrong-credentials') {
      await expect(this.invalidCredentialsMessage()).toBeVisible()
    }
  }

  async checkIfLoginButtonIsDisabled (): Promise<void> {
    await expect(this.buttonLogin()).toBeDisabled()
  }

  async checkIfPasswordRecoveryIsVisible (signUpVisible: boolean = true): Promise<void> {
    await expect(this.passwordRecovery()).toBeVisible()
    await expect(this.recoveryLoginText()).toBeVisible()
    if (signUpVisible) {
      await expect(this.recoverySignUpText()).toBeVisible()
    } else {
      await expect(this.recoverySignUpText()).toHaveCount(0)
    }
  }

  async checkIfSignUpIsHidden (): Promise<void> {
    await expect(this.linkSignUp()).toHaveCount(0)
    await expect(this.page.getByText('Login as guest')).toHaveCount(0)
    await expect(this.page.getByText('Continue as a guest')).toHaveCount(0)
  }
}
