// Company-first nav / list title for Tracker projects.
import type { Organization } from '@hcengineering/contact'
import type { Project } from '@hcengineering/tracker'

export function projectNavTitle (project: Pick<Project, 'name'>, company?: Pick<Organization, 'name'> | null): string {
  const companyName = company?.name?.trim()
  if (companyName != null && companyName !== '') {
    return `${companyName} ${project.name}`
  }
  return project.name
}
