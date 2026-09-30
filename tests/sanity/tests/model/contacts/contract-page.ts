import { expect, type Locator, type Page } from '@playwright/test'

export enum ButtonAction {
  Open = 'Open',
  OpenInNewTab = 'Open in new tab',
  NewApplication = 'New Application',
  NewLead = 'New Lead',
  NewRelatedIssue = 'New related task',
  PublicLink = 'Public link',
  Delete = 'Delete',
  MergeContacts = 'Merge contacts'
}

export class ContractPage {
  page: Page

  constructor (page: Page) {
    this.page = page
  }

  readonly appContact = (): Locator => this.page.locator('[id="app-contact\\:string\\:Contacts"]')
  readonly employeeNavElement = (Employee: string): Locator =>
    this.page.locator(`.hulyNavItem-container:has-text("${Employee}")`)

  readonly employeeButton = (Employee: string): Locator =>
    this.page.locator(`button:not(.hulyNavItem-container, .hulyBreadcrumb-container):has-text("${Employee}")`)

  readonly firstNameInput = (): Locator => this.page.locator('[placeholder="First name"]')
  readonly lastNameInput = (): Locator => this.page.locator('[placeholder="Last name"]')
  readonly emailInput = (): Locator => this.page.locator('[placeholder="Email"]')
  readonly phoneInput = (): Locator => this.page.locator('[placeholder="+1 555 333 7777"]')
  readonly passwordInput = (): Locator => this.page.locator('.antiCard .password-editbox input')
  readonly showPasswordButton = (): Locator => this.page.locator('.antiCard .password-editbox button:has-text("Show")')
  readonly hidePasswordButton = (): Locator => this.page.locator('.antiCard .password-editbox button:has-text("Hide")')
  readonly loginPanelPasswordInput = (): Locator => this.page.locator('.login-panel .password-editbox input')
  readonly setPasswordButton = (): Locator => this.page.getByRole('button', { name: 'Set password', exact: true })
  readonly createButton = (): Locator => this.page.locator('.antiCard button:has-text("Create")')
  readonly addEmployeeButton = (): Locator => this.page.locator('.antiCard button:has-text("Add Employee")')
  readonly addEmployeeToolbarButton = (): Locator =>
    this.page.getByRole('button', { name: 'Add Employee' }).or(this.employeeButton('Employee')).first()
  readonly formAntiCard = (): Locator => this.page.locator('form.antiCard')
  readonly employeeEntry = (first: string, last: string): Locator =>
    this.page.locator(`td:has-text("${last} ${first}")`).or(this.page.locator(`td:has-text("${first} ${last}")`))
  readonly confirmOkButton = (): Locator => this.page.getByRole('button', { name: 'Ok', exact: true })

  readonly kickEmployeeOption = (): Locator => this.page.locator('text="Kick employee"')
  readonly deleteEmployeeOption = (): Locator => this.page.locator('text="Delete employee"')
  readonly submitButton = (): Locator => this.page.locator('form[id="view:string:DeleteObject"] button[type="submit"]')
  readonly okButton = (): Locator => this.page.locator('text=Ok')
  readonly openButton = (): Locator => this.page.locator('button:has-text("Open")')
  readonly openNewTabButton = (): Locator => this.page.locator('button:has-text("Open in new tab")')
  readonly openNewApplicationButton = (): Locator => this.page.locator('button:has-text("New Application")')
  readonly openNewLeadButton = (): Locator => this.page.locator('button:has-text("New Lead")')
  readonly openNewRelatedIssueButton = (): Locator => this.page.locator('button:has-text("New related task")')
  readonly openPublicLinkButton = (): Locator => this.page.locator('button:has-text("Public link")')
  readonly openMergeContactsButton = (): Locator => this.page.locator('button:has-text("Merge contacts")')
  readonly openDeleteButton = (): Locator => this.page.locator('button:has-text("Delete")')
  readonly newApplicationDescription = (): Locator => this.page.getByRole('paragraph')
  readonly newApplicationAssignRectruiter = (): Locator => this.page.getByRole('button', { name: 'Assigned recruiter' })
  readonly newApplicationChooseRecruiter = (recruiter: string): Locator =>
    this.page.getByRole('button', { name: recruiter })

  readonly newApplicationInterview = (Interview: string): Locator => this.page.getByRole('button', { name: Interview })
  readonly newApplicationStartDate = (): Locator => this.page.getByRole('button', { name: 'Start date' })
  readonly newApplicationStartInADay = (): Locator => this.page.getByText('in a day')
  readonly newApplicationCreate = (): Locator => this.page.getByRole('button', { name: 'Create' })
  readonly personName = (person: string): Locator => this.page.locator(`text=${person}`)
  readonly personTable = (): Locator => this.page.locator('.antiTable-body__row')
  readonly personMarina = (): Locator => this.page.getByRole('link', { name: 'MM M. Marina' })
  readonly comapnyTab = (): Locator => this.page.locator('.hulyNavItem-container:has-text("Company")')
  readonly addCompany = (): Locator => this.page.locator('button.antiButton:has-text("Company")')
  readonly companyName = (): Locator => this.page.locator('[placeholder="Company name"]')
  readonly companyCreateButton = (): Locator => this.page.locator('button:has-text("Create")')
  readonly companyByName = (company: string): Locator => this.page.locator(`text=${company}`)
  readonly addMember = (): Locator => this.page.locator('[id="contact:string:AddMember"]')
  readonly selectMember = (): Locator => this.page.getByRole('cell', { name: 'CR Chen Rosamund' }).getByRole('link')
  readonly openNewMember = (member: string): Locator => this.page.locator(`.card a:has-text("${member}")`)
  readonly newMemberAdded = (): Locator => this.page.getByText('New Members: Chen Rosamund')
  readonly stateApplication = (role: string): Locator => this.page.getByRole('cell', { name: role })
  readonly commentApplication = (): Locator => this.page.getByRole('button', { name: '1', exact: true })
  readonly commentDescription = (): Locator => this.page.getByText('Test Application')
  readonly buttonClosePanel = (): Locator => this.page.locator('button#btnPClose')

  // ACTIONS

  async addNewApplication (description: string, recruiter: string): Promise<void> {
    await this.newApplicationDescription().click()
    await this.newApplicationDescription().fill(description)
    await this.newApplicationAssignRectruiter().click()
    await this.newApplicationChooseRecruiter(recruiter).click()
    await this.newApplicationStartDate().click()
    await this.newApplicationStartInADay().click()
    await this.newApplicationCreate().click()
  }

  async clickAppContact (): Promise<void> {
    await this.appContact().click()
  }

  async clickEmployeeNavElement (Employee: string): Promise<void> {
    await this.employeeNavElement(Employee).click()
  }

  async clickEmployeeButton (Employee: string): Promise<void> {
    await this.employeeButton(Employee).click()
  }

  async clickFirstNameInput (): Promise<void> {
    await this.firstNameInput().click()
  }

  async fillFirstNameInput (firstName: string): Promise<void> {
    await this.firstNameInput().fill(firstName)
  }

  async clickLastNameInput (): Promise<void> {
    await this.lastNameInput().click()
  }

  async fillLastNameInput (lastName: string): Promise<void> {
    await this.lastNameInput().fill(lastName)
  }

  async clickEmailInput (): Promise<void> {
    await this.emailInput().click()
  }

  async fillEmailInput (email: string): Promise<void> {
    await this.emailInput().fill(email)
  }

  async fillPhoneInput (phone: string): Promise<void> {
    await this.phoneInput().fill(phone)
  }

  async fillPasswordInput (password: string): Promise<void> {
    await this.passwordInput().fill(password)
  }

  async expectPasswordFieldHidden (): Promise<void> {
    await expect(this.passwordInput()).toHaveAttribute('type', 'password')
  }

  async expectPasswordFieldVisible (): Promise<void> {
    await expect(this.passwordInput()).toHaveAttribute('type', 'text')
  }

  async togglePasswordVisibility (): Promise<void> {
    await this.showPasswordButton().click()
  }

  async openEmployeeProfile (first: string, last: string): Promise<void> {
    await this.clickOnEmployee(first, last)
    await this.page.locator('.login-panel, .antiPanel').first().waitFor({ state: 'visible', timeout: 30000 })
  }

  async setPasswordInDetailPanel (newPassword: string): Promise<void> {
    await this.loginPanelPasswordInput().waitFor({ state: 'visible', timeout: 30000 })
    await this.loginPanelPasswordInput().fill(newPassword)
    await this.setPasswordButton().click()
    await this.confirmOkButton().click()
    await this.page.locator('.msgbox-container').waitFor({ state: 'hidden', timeout: 60000 }).catch(() => {})
    await expect(this.page.getByText('Password updated.')).toBeVisible({ timeout: 30000 })
  }

  async setPasswordFromContextMenu (first: string, last: string, newPassword: string): Promise<void> {
    await this.employeeEntry(first, last).hover()
    await this.employeeEntry(first, last).click({ button: 'right' })
    await this.page.getByRole('button', { name: 'Set password', exact: true }).click()
    const card = this.page.locator('form.antiCard')
    await card.waitFor({ state: 'visible', timeout: 30000 })
    await card.locator('.password-editbox input').fill(newPassword)
    await card.getByRole('button', { name: 'Set password', exact: true }).click()
    await card.waitFor({ state: 'detached', timeout: 60000 })
  }

  async clickAddEmployeeButton (): Promise<void> {
    await this.addEmployeeButton().click()
  }

  async openEmployeesPage (): Promise<void> {
    const byId = this.appContact()
    const byHref = this.page.locator('a[href*="/contact"]').first()
    if (await byId.isVisible().catch(() => false)) {
      await byId.click()
    } else {
      await byHref.click()
    }
    await this.employeeNavElement('Employee').waitFor({ state: 'visible', timeout: 30000 })
    await this.clickEmployeeNavElement('Employee')
    await this.page.waitForURL(/\/contact\/employees/, { timeout: 30000 })
  }

  async openGuestsPage (): Promise<void> {
    const byId = this.appContact()
    const byHref = this.page.locator('a[href*="/contact"]').first()
    if (await byId.isVisible().catch(() => false)) {
      await byId.click()
    } else {
      await byHref.click()
    }
    await this.employeeNavElement('Guest').waitFor({ state: 'visible', timeout: 30000 })
    await this.clickEmployeeNavElement('Guest')
    await this.page.waitForURL(/\/contact\/guests/, { timeout: 30000 })
  }

  async addEmployee (
    first: string,
    last: string,
    email: string,
    password: string,
    phone?: string
  ): Promise<void> {
    await this.clickEmployeeButton('Employee')
    await this.formAntiCard().waitFor({ state: 'visible' })
    await this.fillFirstNameInput(first)
    await this.fillLastNameInput(last)
    await this.fillEmailInput(email)
    if (phone != null && phone !== '') {
      await this.fillPhoneInput(phone)
    }
    await this.fillPasswordInput(password)
    await this.expectPasswordFieldHidden()
    await this.togglePasswordVisibility()
    await this.expectPasswordFieldVisible()
    await this.clickAddEmployeeButton()
    await this.waitForFormAntiCardDetached()
  }

  async addGuest (
    first: string,
    last: string,
    email: string,
    password: string,
    phone?: string
  ): Promise<void> {
    await this.clickEmployeeButton('Guest')
    await this.formAntiCard().waitFor({ state: 'visible' })
    await this.fillFirstNameInput(first)
    await this.fillLastNameInput(last)
    await this.fillEmailInput(email)
    if (phone != null && phone !== '') {
      await this.fillPhoneInput(phone)
    }
    await this.fillPasswordInput(password)
    await this.createButton().click()
    await this.waitForFormAntiCardDetached()
  }

  async fillCompanyInput (company: string): Promise<void> {
    await this.companyName().click()
    await this.companyName().fill(company)
  }

  async clickCreateButton (): Promise<void> {
    await this.createButton().click()
  }

  async clickSubmitButton (): Promise<void> {
    await this.submitButton().click()
  }

  async clickOnEmployee (first: string, last: string): Promise<void> {
    await this.employeeEntry(first, last).click()
  }

  async waitForFormAntiCardDetached (): Promise<void> {
    await this.formAntiCard().waitFor({ state: 'detached', timeout: 60000 })
  }

  async clickCompanyTab (): Promise<void> {
    await this.comapnyTab().click()
  }

  async clickAddCompany (): Promise<void> {
    await this.addCompany().click()
  }

  async clickCreateCompany (): Promise<void> {
    await this.companyCreateButton().click()
  }

  async clickCompanyByName (company: string): Promise<void> {
    await this.companyByName(company).click()
  }

  async clickAddMember (): Promise<void> {
    await this.addMember().click()
  }

  async clickSelectMember (): Promise<void> {
    await this.selectMember().click()
  }

  async clickOpenNewMember (member: string): Promise<void> {
    await this.openNewMember(member).click()
  }

  // Regular approach
  async kickEmployee (first: string, last: string): Promise<void> {
    await this.employeeEntry(first, last).hover()
    await this.employeeEntry(first, last).click({ button: 'right' })
    await this.kickEmployeeOption().click()
    await this.okButton().click()
  }

  async deleteEmployeeFromRow (first: string, last: string): Promise<void> {
    const row = this.page.locator('tr', { has: this.employeeEntry(first, last) })
    const trash = row.locator('[data-id="delete-employee"]')
    if (await trash.isVisible().catch(() => false)) {
      await trash.click()
    } else {
      await this.employeeEntry(first, last).hover()
      await this.employeeEntry(first, last).click({ button: 'right' })
      await this.deleteEmployeeOption().click()
    }
    await this.confirmOkButton().click()
    await this.page.locator('.msgbox-container').waitFor({ state: 'hidden', timeout: 60000 }).catch(() => {})
    await expect(this.employeeEntry(first, last)).toHaveCount(0, { timeout: 30000 })
  }

  // Approach where we use the enum to determine the action to take on the right click
  async personRightClickOption (first: string, last: string, action: ButtonAction): Promise<void> {
    await this.employeeEntry(first, last).hover()
    await this.employeeEntry(first, last).click({ button: 'right' })
    switch (action) {
      case ButtonAction.Open:
        await this.openButton().click()
        break
      case ButtonAction.OpenInNewTab:
        await this.openNewTabButton().click()
        break
      case ButtonAction.NewApplication:
        await this.openNewApplicationButton().click()
        break
      case ButtonAction.NewLead:
        await this.openNewLeadButton().click()
        break
      case ButtonAction.NewRelatedIssue:
        await this.openNewRelatedIssueButton().click()
        break
      case ButtonAction.Delete:
        await this.openDeleteButton().click()
        break
      case ButtonAction.PublicLink:
        await this.openPublicLinkButton().click()
        break
      case ButtonAction.MergeContacts:
        await this.openMergeContactsButton().click()
        break
      default:
        throw new Error('Option does not exists')
    }
  }

  async toggleHideInactive (): Promise<void> {
    await this.page.locator('[data-id="btn-viewOptions"]').click()
    await this.page.locator('.antiCard-menu__item', { hasText: 'Hide inactive' }).click()
    await this.page.keyboard.press('Escape')
  }

  // ASSERTIONS

  async expectKickEmployeeShowsInactiveStatus (first: string, last: string): Promise<void> {
    await expect(this.employeeEntry(first, last)).toContainText('Inactive')
  }

  async checkIfPersonIsDeleted (first: string, last: string, count: number): Promise<void> {
    await expect(this.employeeEntry(first, last)).toHaveCount(count)
  }

  async checkIfPersonIsCreated (first: string, last: string): Promise<void> {
    await expect(this.employeeEntry(first, last)).toBeVisible()
  }

  async checkPersonMarinaIsVisible (person: string): Promise<void> {
    await expect(this.personName(person)).toBeVisible()
  }

  async checkPersonTableCount (count: number, checkMoreOrEqual: boolean = false): Promise<void> {
    const actualCount = await this.personTable().count()

    if (checkMoreOrEqual) {
      expect(actualCount).toBeGreaterThanOrEqual(count)
    } else {
      await expect(this.personMarina()).toBeVisible()
    }
  }

  async checkIfTextIsVisible (text: string): Promise<void> {
    await expect(this.page.locator(`text=${text}`)).toBeVisible()
  }

  async checkIfNewMemberIsAdded (): Promise<void> {
    await expect(this.newMemberAdded()).toBeVisible()
  }

  async checkStateApplication (role: string): Promise<void> {
    await expect(this.stateApplication(role)).toBeVisible()
    await this.commentApplication().hover()
    await expect(this.commentDescription()).toBeVisible()
  }

  async closePanel (): Promise<void> {
    await this.buttonClosePanel().click()
  }
}
