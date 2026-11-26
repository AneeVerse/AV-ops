// Sets a company teammate only when it is empty and exactly one Won lead has an assignee.
// Dry-run unless --apply. Never overwrites a teammate.
import { withHuly } from './lib/huly-read.mjs'

const apply = process.argv.includes('--apply')
const WON = 'task:statusCategory:Won'

await withHuly(async (client) => {
  const orgs = await client.findAll('contact:class:Organization')
  const leads = await client.findAll('lead:class:Lead')
  const statuses = await client.findAll('core:class:Status')
  const won = new Set(statuses.filter((status) => status.category === WON || String(status.name || '').trim().toLowerCase() === 'won').map((status) => status._id))
  for (const org of orgs) {
    if (org.manager != null && org.manager !== '') {
      console.log('SKIP ' + org._id + ' teammate already set')
      continue
    }
    const matching = leads.filter((lead) => lead.attachedTo === org._id && won.has(lead.status) && lead.assignee)
    const assignees = [...new Set(matching.map((lead) => lead.assignee))]
    if (assignees.length !== 1) {
      console.log('SKIP ' + org._id + ' won-leads=' + assignees.length)
      continue
    }
    console.log(org._id + ' teammate ' + assignees[0])
    if (apply) {
      await client.update(org._id, 'contact:class:Organization', org.space || 'contact:space:Contacts', {
        manager: assignees[0]
      })
    }
  }
})
