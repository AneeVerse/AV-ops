// Adds issue assignees to that issue's project. Dry-run unless --apply.
// Does not scan leads and does not remove anyone.
import { withHuly } from './lib/huly-read.mjs'

const apply = process.argv.includes('--apply')

await withHuly(async (client) => {
  const issues = await client.findAll('tracker:class:Issue')
  const projects = await client.findAll('tracker:class:Project')
  const people = await client.findAll('contact:class:Person')
  const projectById = new Map(projects.map((project) => [project._id, project]))
  const personById = new Map(people.map((person) => [person._id, person]))
  let pushes = 0
  for (const issue of issues) {
    if (issue.assignee == null || issue.assignee === '') continue
    const person = personById.get(issue.assignee)
    const uuid = person?.personUuid
    const project = projectById.get(issue.space)
    console.log([
      issue._id,
      issue.space,
      issue.assignee,
      uuid || 'MISSING'
    ].join(' '))
    if (!uuid || project == null) continue
    const members = Array.isArray(project.members) ? project.members : []
    if (members.includes(uuid)) continue
    pushes += 1
    if (apply) {
      await client.update(project._id, 'tracker:class:Project', 'core:space:Space', { $push: { members: uuid } })
      members.push(uuid)
    }
  }
  console.log((apply ? 'Added ' : 'Would add ') + pushes + ' project members')
})
