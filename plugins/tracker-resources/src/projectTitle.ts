import type { Organization } from '@hcengineering/contact'
import type { Project } from '@hcengineering/tracker'

export function projectNavTitle (project: Project, company?: Pick<Organization, 'name'> | null): string {
  const parts: string[] = []
  const companyName = company?.name?.trim()
  if (companyName !== undefined && companyName.length > 0) {
    parts.push(companyName)
  }
  if (project.identifier !== undefined && project.identifier.length > 0 && project.identifier !== project.name) {
    parts.push(project.identifier)
  }
  parts.push(project.name)
  return parts.join(' · ')
}
