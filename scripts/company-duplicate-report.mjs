// Read-only. Prints companies that look alike. Does not delete or update anything.
import { buildCompanyReport } from './company-groups.mjs'
import { withHuly } from './lib/huly-read.mjs'

if (process.argv.includes('--apply')) {
  console.error('This report has no apply mode and does not write.')
  process.exit(1)
}

const CUSTOMER = 'lead:mixin:Customer'

function hasCustomer (doc) {
  if (doc == null) return false
  if (doc[CUSTOMER] != null) return true
  return Object.prototype.hasOwnProperty.call(doc, 'customerDescription')
}

await withHuly(async (client) => {
  const orgs = await client.findAll('contact:class:Organization')
  const projects = await client.findAll('tracker:class:Project')
  const people = await client.findAll('contact:class:Person')
  const leads = await client.findAll('lead:class:Lead')
  const leadCustomers = new Set(leads.map((lead) => lead.attachedTo).filter(Boolean))
  const report = buildCompanyReport(orgs)
  console.log('Duplicate-looking companies')
  for (const group of report.groups) {
    console.log('group: ' + group.reason)
    for (const org of group.companies) {
      const projectCount = projects.filter((project) => project.company === org._id).length
      const memberCount = Array.isArray(org.members) ? org.members.length : Number(org.members) || 0
      console.log([
        org._id,
        JSON.stringify(org.name),
        'projects=' + projectCount,
        'members=' + memberCount,
        'aneerequestId=' + (org.aneerequestId ? 'yes' : 'no')
      ].join(' '))
    }
  }
  console.log('Names that look like tests')
  for (const org of report.tests) {
    console.log(org._id + ' ' + JSON.stringify(org.name))
  }
  console.log('People with the customer mark and no lead')
  for (const person of people) {
    if (!hasCustomer(person) || leadCustomers.has(person._id)) continue
    console.log(person._id + ' ' + JSON.stringify(person.name ?? ''))
  }
})
console.log('Database was not changed.')
