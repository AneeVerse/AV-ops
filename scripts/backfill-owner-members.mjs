// Adds workspace Owners to every project. Dry-run unless --apply. Never adds a Guest.
import { withHuly } from './lib/huly-read.mjs'

const apply = process.argv.includes('--apply')
const accountsUrl = process.env.HULY_ACCOUNTS_URL || ''
const token = process.env.HULY_READ_TOKEN || process.env.HULY_TOKEN || ''

if (accountsUrl === '' || token === '') {
  console.error('Set HULY_ACCOUNTS_URL and HULY_READ_TOKEN. Aborting before any project change.')
  process.exit(1)
}

let members
try {
  const response = await fetch(accountsUrl, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ method: 'getWorkspaceMembers', params: {} })
  })
  const body = await response.json()
  if (!response.ok || body?.error != null) throw new Error('role lookup failed')
  members = body.result
  if (!Array.isArray(members)) throw new Error('role lookup failed')
} catch (err) {
  console.error(err instanceof Error ? err.message : 'role lookup failed')
  console.error('Aborting. No project was changed.')
  process.exit(1)
}

const owners = members
  .filter((member) => member?.role === 'OWNER' && member.person)
  .map((member) => member.person)

if (owners.length === 0) {
  console.error('No workspace Owner was returned. Aborting. No project was changed.')
  process.exit(1)
}

await withHuly(async (client) => {
  const projects = await client.findAll('tracker:class:Project')
  let pushes = 0
  for (const project of projects) {
    const current = Array.isArray(project.members) ? project.members : []
    for (const uuid of owners) {
      if (current.includes(uuid)) continue
      console.log(project._id + ' missing ' + uuid)
      pushes += 1
      if (apply) {
        await client.update(project._id, 'tracker:class:Project', 'core:space:Space', { $push: { members: uuid } })
        current.push(uuid)
      }
    }
  }
  console.log((apply ? 'Added ' : 'Would add ') + pushes + ' owner memberships')
})
