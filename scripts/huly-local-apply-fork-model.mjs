#!/usr/bin/env node
/**
 * Apply this fork's Client model onto the local Docker workspace.
 *
 * Official workspace/transactor images only know upstream Huly. The compiled
 * Client app/classes/types live in this repo, so they must be written into
 * model_tx (user model) for the official transactor to serve them.
 *
 * Idempotent. Run from local.cmd after Cockroach is up.
 */
import { execFileSync, execSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

function dockerNames () {
  return execSync('docker ps --format "{{.Names}}"', { encoding: 'utf8' })
    .split(/\r?\n/)
    .filter(Boolean)
}

function requireName (found, label) {
  if (found === undefined) {
    throw new Error(`Docker container not running: ${label}`)
  }
  return found
}

function cockroachName () {
  return requireName(
    dockerNames().find((n) => n.includes('cockroach') && !n.includes('transactor') && !n.includes('workspace')),
    'cockroach'
  )
}

function transactorName () {
  return requireName(
    dockerNames().find((n) => n.includes('transactor')),
    'transactor'
  )
}

function workspaceName () {
  return requireName(
    dockerNames().find((n) => n.includes('workspace')),
    'workspace'
  )
}

const hideArchived = {
  key: 'hideArchived',
  type: 'toggle',
  defaultValue: true,
  actionTarget: 'options',
  action: 'view:function:HideArchived',
  label: 'view:string:HideArchived'
}

const clientViewOptions = {
  groupBy: ['status', 'assignee'],
  orderBy: [
    ['status', 1],
    ['modifiedOn', -1],
    ['createdOn', -1],
    ['dueDate', 1],
    ['rank', 1]
  ],
  other: [
    {
      key: 'shouldShowAll',
      type: 'toggle',
      defaultValue: false,
      actionTarget: 'category',
      action: 'view:function:ShowEmptyGroups',
      label: 'view:string:ShowEmptyGroups'
    },
    hideArchived
  ]
}

const statuses = [
  ['tracker:clientStatus:Backlog', 'Backlog', 22, 'task:statusCategory:UnStarted'],
  ['tracker:clientStatus:Incoming', 'Incoming', 22, 'task:statusCategory:Active'],
  ['tracker:clientStatus:Negotiation', 'Negotiation', 9, 'task:statusCategory:Active'],
  ['tracker:clientStatus:OfferPreparing', 'Offer preparing', 1, 'task:statusCategory:Active'],
  ['tracker:clientStatus:MakeADecision', 'Make a decision', 19, 'task:statusCategory:Active'],
  ['tracker:clientStatus:ContractConclusion', 'Contract conclusion', 13, 'task:statusCategory:Active'],
  ['tracker:clientStatus:Won', 'Won', undefined, 'task:statusCategory:Won'],
  ['tracker:clientStatus:Lost', 'Lost', undefined, 'task:statusCategory:Lost']
]

const statusIds = statuses.map(([id]) => id)

/** @type {Array<{ id: string, tx?: string, objectClass: string, mixin?: string, attributes: Record<string, unknown> }>} */
const catalog = [
  {
    id: 'tracker:class:ClientFunnel',
    objectClass: 'core:class:Class',
    attributes: {
      kind: 0,
      label: 'tracker:string:ClientFunnel',
      icon: 'tracker:icon:Project',
      extends: 'task:class:Project'
    }
  },
  {
    id: 'tracker:class:Client',
    objectClass: 'core:class:Class',
    attributes: {
      kind: 0,
      label: 'tracker:string:Client',
      icon: 'contact:icon:Company',
      extends: 'task:class:Task',
      shortLabel: 'CLIENT',
      sortingKey: 'title',
      filteringKey: 'title',
      pluralLabel: 'tracker:string:Clients'
    }
  },
  {
    id: 'tracker:mixin:DefaultClientFunnelTypeData',
    objectClass: 'core:class:Mixin',
    attributes: {
      kind: 2,
      label: 'embedded:embedded:Default client funnel',
      icon: 'tracker:icon:Project',
      extends: 'tracker:class:ClientFunnel'
    }
  },
  {
    id: 'tracker:mixin:ClientTypeData',
    objectClass: 'core:class:Mixin',
    attributes: {
      kind: 2,
      label: 'embedded:embedded:Client',
      icon: 'contact:icon:Company',
      extends: 'tracker:class:Client'
    }
  },
  {
    id: 'tracker:class:ClientFunnel_fullDescription',
    objectClass: 'core:class:Attribute',
    attributes: {
      name: 'fullDescription',
      attributeOf: 'tracker:class:ClientFunnel',
      label: 'tracker:string:Description',
      type: { _class: 'core:class:TypeMarkup', label: 'core:string:Markup', icon: 'core:icon:TypeMarkup' }
    }
  },
  {
    id: 'tracker:class:ClientFunnel_attachments',
    objectClass: 'core:class:Attribute',
    attributes: {
      name: 'attachments',
      attributeOf: 'tracker:class:ClientFunnel',
      label: 'attachment:string:Attachments',
      type: {
        _class: 'core:class:Collection',
        label: 'core:string:Collection',
        icon: 'core:icon:TypeCollection',
        of: 'attachment:class:Attachment'
      }
    }
  },
  {
    id: 'tracker:class:ClientFunnel_comments',
    objectClass: 'core:class:Attribute',
    attributes: {
      name: 'comments',
      attributeOf: 'tracker:class:ClientFunnel',
      label: 'chunter:string:Comments',
      type: {
        _class: 'core:class:Collection',
        label: 'core:string:Collection',
        icon: 'core:icon:TypeCollection',
        of: 'chunter:class:ChatMessage'
      }
    }
  },
  {
    id: 'tracker:class:Client_attachedTo',
    objectClass: 'core:class:Attribute',
    attributes: {
      name: 'attachedTo',
      attributeOf: 'tracker:class:Client',
      label: 'tracker:string:Company',
      readonly: true,
      type: {
        _class: 'core:class:RefTo',
        label: 'core:string:Ref',
        icon: 'core:icon:TypeRef',
        to: 'contact:class:Organization'
      }
    }
  },
  {
    id: 'tracker:class:Client_title',
    objectClass: 'core:class:Attribute',
    attributes: {
      name: 'title',
      attributeOf: 'tracker:class:Client',
      label: 'tracker:string:Title',
      type: { _class: 'core:class:TypeString', label: 'core:string:String' }
    }
  },
  {
    id: 'tracker:class:Client_startDate',
    objectClass: 'core:class:Attribute',
    attributes: {
      name: 'startDate',
      attributeOf: 'tracker:class:Client',
      label: 'task:string:StartDate',
      type: {
        _class: 'core:class:TypeDate',
        label: 'core:string:Date',
        icon: 'core:icon:TypeDate',
        mode: 'DATE',
        withShift: true
      }
    }
  },
  {
    id: 'tracker:attribute:ClientState',
    objectClass: 'core:class:Attribute',
    attributes: {
      name: 'status',
      attributeOf: 'tracker:class:Client',
      label: 'task:string:TaskState',
      type: {
        _class: 'core:class:RefTo',
        label: 'core:string:Ref',
        icon: 'core:icon:TypeRef',
        to: 'core:class:Status'
      }
    }
  },
  {
    id: 'tracker:class:Project_company',
    objectClass: 'core:class:Attribute',
    attributes: {
      name: 'company',
      attributeOf: 'tracker:class:Project',
      label: 'tracker:string:Company',
      type: {
        _class: 'core:class:RefTo',
        label: 'core:string:Ref',
        icon: 'core:icon:TypeRef',
        to: 'contact:class:Organization'
      }
    }
  },
  {
    id: 'tracker:app:Company',
    objectClass: 'workbench:class:Application',
    attributes: {
      _class: 'workbench:class:Application',
      label: 'tracker:string:CompanyApplication',
      icon: 'contact:icon:Company',
      alias: 'company',
      hidden: false,
      locationResolver: 'tracker:resolver:CompanyLocation',
      navHeaderComponent: 'tracker:component:NewCompanyHeader',
      navigatorModel: {
        specials: [
          {
            id: 'my-clients',
            label: 'tracker:string:MyClients',
            icon: 'contact:icon:Company',
            component: 'tracker:component:MyClients',
            componentProps: {
              config: [
                ['assigned', 'view:string:Assigned', {}],
                ['created', 'view:string:Created', {}],
                ['subscribed', 'view:string:Subscribed', {}]
              ]
            },
            position: 'top'
          },
          {
            id: 'companies',
            label: 'tracker:string:Companies',
            icon: 'contact:icon:Company',
            component: 'workbench:component:SpecialView',
            accessLevel: 'DocGuest',
            componentProps: {
              _class: 'contact:class:Organization',
              icon: 'contact:icon:Company',
              label: 'tracker:string:Companies',
              createLabel: 'tracker:string:NewCompany',
              createComponent: 'tracker:component:CreateCompany'
            },
            position: 'top'
          },
          {
            id: 'funnels',
            component: 'workbench:component:SpecialView',
            icon: 'tracker:icon:Project',
            label: 'tracker:string:Funnels',
            position: 'bottom',
            accessLevel: 'USER',
            componentProps: {
              _class: 'tracker:class:ClientFunnel',
              icon: 'tracker:icon:Project',
              label: 'tracker:string:Funnels',
              createComponent: 'tracker:component:CreateClientFunnel',
              createLabel: 'tracker:string:CreateFunnel'
            }
          }
        ],
        spaces: [
          {
            id: 'client-funnels',
            label: 'tracker:string:Funnels',
            spaceClass: 'tracker:class:ClientFunnel',
            addSpaceLabel: 'tracker:string:CreateFunnel',
            createComponent: 'tracker:component:CreateClientFunnel',
            icon: 'tracker:icon:Project'
          }
        ],
        groups: [
          {
            id: 'client-tracker',
            label: 'tracker:string:Company',
            groupByClass: 'contact:class:Organization',
            component: 'tracker:component:ClientTrackerNav',
            specials: [
              {
                id: 'client-home',
                label: 'tracker:string:Company',
                icon: 'contact:icon:Company',
                component: 'tracker:component:ClientHome'
              },
              {
                id: 'company-issues',
                label: 'tracker:string:Issues',
                icon: 'tracker:icon:Issues',
                component: 'tracker:component:ClientCompanyIssues'
              },
              {
                id: 'company-files',
                label: 'tracker:string:CompanyFiles',
                icon: 'drive:icon:Folder',
                component: 'tracker:component:ClientCompanyFiles'
              },
              {
                id: 'issues',
                label: 'tracker:string:Issues',
                icon: 'tracker:icon:Issues',
                component: 'tracker:component:Issues',
                componentProps: {
                  icon: 'tracker:icon:Issues',
                  title: 'tracker:string:Issues',
                  config: [
                    ['all', 'tracker:string:All', {}],
                    ['active', 'tracker:string:Active', {}],
                    ['backlog', 'tracker:string:Backlog', {}]
                  ]
                }
              },
              {
                id: 'project-files',
                label: 'tracker:string:ProjectFiles',
                icon: 'drive:icon:Folder',
                component: 'tracker:component:ProjectDriveFiles'
              }
            ]
          }
        ]
      }
    }
  },
  {
    id: 'tracker:descriptors:ClientFunnelType',
    objectClass: 'task:class:ProjectTypeDescriptor',
    attributes: {
      name: 'tracker:string:CompanyApplication',
      description: 'tracker:string:ManageFunnelStatuses',
      icon: 'tracker:icon:Project',
      baseClass: 'tracker:class:ClientFunnel',
      availablePermissions: [
        'core:permission:UpdateSpace',
        'core:permission:ArchiveSpace',
        'core:permission:ForbidDeleteObject'
      ],
      allowedTaskTypeDescriptors: ['tracker:descriptors:Client']
    }
  },
  {
    id: 'tracker:descriptors:Client',
    objectClass: 'task:class:TaskTypeDescriptor',
    attributes: {
      name: 'tracker:string:Client',
      description: 'tracker:string:Client',
      icon: 'tracker:icon:Project',
      baseClass: 'tracker:class:Client',
      allowCreate: true
    }
  },
  ...statuses.map(([id, name, color, category]) => ({
    id,
    objectClass: 'core:class:Status',
    attributes: {
      ofAttribute: 'tracker:attribute:ClientState',
      name,
      category,
      ...(color !== undefined ? { color } : {})
    }
  })),
  {
    id: 'tracker:taskTypes:Client',
    objectClass: 'task:class:TaskType',
    attributes: {
      name: 'Client',
      descriptor: 'tracker:descriptors:Client',
      ofClass: 'tracker:class:Client',
      targetClass: 'tracker:mixin:ClientTypeData',
      statusClass: 'core:class:Status',
      statusCategories: [
        'task:statusCategory:UnStarted',
        'task:statusCategory:Active',
        'task:statusCategory:Won',
        'task:statusCategory:Lost'
      ],
      kind: 'task',
      parent: 'tracker:template:DefaultClientFunnel',
      statuses: statusIds,
      icon: 'tracker:icon:Project'
    }
  },
  {
    id: 'tracker:template:DefaultClientFunnel',
    objectClass: 'task:class:ProjectType',
    attributes: {
      name: 'Default funnel',
      descriptor: 'tracker:descriptors:ClientFunnelType',
      description: '',
      tasks: ['tracker:taskTypes:Client'],
      roles: 0,
      classic: false,
      statuses: statusIds.map((_id) => ({ _id, taskType: 'tracker:taskTypes:Client' })),
      targetClass: 'tracker:mixin:DefaultClientFunnelTypeData'
    }
  },
  {
    id: 'tracker:viewlet:TableClientFunnel',
    objectClass: 'view:class:Viewlet',
    attributes: {
      attachTo: 'tracker:class:ClientFunnel',
      descriptor: 'view:viewlet:Table',
      configOptions: { hiddenKeys: ['identifier', 'name'], sortable: true },
      viewOptions: { groupBy: [], orderBy: [], other: [hideArchived] },
      config: ['', 'members', 'private', 'archived']
    }
  },
  {
    id: 'tracker:viewlet:TableClient',
    objectClass: 'view:class:Viewlet',
    attributes: {
      attachTo: 'tracker:class:Client',
      descriptor: 'task:viewlet:StatusTable',
      config: ['', 'title', 'attachedTo', 'assignee', 'status', 'attachments', 'comments', 'modifiedOn'],
      viewOptions: { groupBy: [], orderBy: [], other: [hideArchived] },
      configOptions: { sortable: true }
    }
  },
  {
    id: 'tracker:viewlet:ListClient',
    objectClass: 'view:class:Viewlet',
    attributes: {
      attachTo: 'tracker:class:Client',
      descriptor: 'view:viewlet:List',
      configOptions: { strict: true, hiddenKeys: ['title'] },
      config: [
        { key: '', displayProps: { fixed: 'left', key: 'client' } },
        { key: 'status', props: { kind: 'list', size: 'small', shouldShowName: false } },
        {
          key: '',
          presenter: 'tracker:component:ClientTitlePresenter',
          label: 'tracker:string:Title',
          props: { maxWidth: '10rem' }
        },
        {
          key: '$lookup.attachedTo',
          presenter: 'contact:component:OrganizationPresenter',
          label: 'tracker:string:Company',
          sortingKey: '$lookup.attachedTo.name',
          props: { _class: 'contact:class:Organization', maxWidth: '10rem' }
        },
        { key: 'attachments', displayProps: { key: 'attachments', suffix: true } },
        { key: 'comments', displayProps: { key: 'comments', suffix: true } },
        { key: '', displayProps: { grow: true } },
        {
          key: '$lookup.attachedTo.$lookup.channels',
          label: 'contact:string:ContactInfo',
          sortingKey: ['$lookup.attachedTo.$lookup.channels.lastMessage', '$lookup.attachedTo.channels'],
          props: { length: 'full', size: 'small', kind: 'list' },
          displayProps: { compression: true }
        },
        { key: 'modifiedOn', displayProps: { key: 'modified', fixed: 'right', dividerBefore: true } },
        {
          key: 'assignee',
          props: { kind: 'list', shouldShowName: false, avatarSize: 'x-small' },
          displayProps: { key: 'assignee', fixed: 'right' }
        }
      ],
      viewOptions: clientViewOptions
    }
  },
  {
    id: 'tracker:viewlet:KanbanClient',
    objectClass: 'view:class:Viewlet',
    attributes: {
      attachTo: 'tracker:class:Client',
      descriptor: 'task:viewlet:Kanban',
      viewOptions: { ...clientViewOptions, groupDepth: 1 },
      options: { lookup: { attachedTo: 'contact:class:Organization' } },
      config: ['attachedTo', 'status', 'attachments', 'comments', 'dueDate', 'assignee'],
      configOptions: { strict: true }
    }
  },
  {
    id: 'tracker:viewlet:DashboardClient',
    objectClass: 'view:class:Viewlet',
    attributes: {
      attachTo: 'tracker:class:Client',
      descriptor: 'task:viewlet:Dashboard',
      options: {},
      config: []
    }
  },
  {
    id: 'tracker:ids:ClientActivityExtension',
    objectClass: 'activity:class:ActivityExtension',
    attributes: {
      ofClass: 'tracker:class:Client',
      components: { input: { component: 'chunter:component:ChatMessageInput' } }
    }
  },
  {
    id: 'tracker:ids:ClientFunnelActivityExtension',
    objectClass: 'activity:class:ActivityExtension',
    attributes: {
      ofClass: 'tracker:class:ClientFunnel',
      components: { input: { component: 'chunter:component:ChatMessageInput' } }
    }
  },
  {
    id: 'tracker:ids:ClientCollaborators',
    objectClass: 'core:class:ClassCollaborators',
    attributes: {
      attachedTo: 'tracker:class:Client',
      fields: ['createdBy', 'assignee']
    }
  },
  {
    id: 'tracker:permission:ForbidCreateClientFunnel',
    objectClass: 'core:class:Permission',
    attributes: {
      label: 'tracker:string:ForbidCreateClientFunnelPermission',
      scope: 'workspace',
      txClass: 'core:class:TxCreateDoc',
      objectClass: 'tracker:class:ClientFunnel',
      forbid: true,
      description: 'tracker:string:ForbidCreateClientFunnelPermissionDescription'
    }
  },
  {
    id: 'tracker:action:CreateGlobalClient',
    objectClass: 'view:class:Action',
    attributes: {
      action: 'view:actionImpl:ShowPopup',
      actionProps: { component: 'tracker:component:CreateClient', element: 'top' },
      label: 'tracker:string:CreateClient',
      icon: 'contact:icon:Company',
      input: 'none',
      category: 'tracker:category:Tracker',
      target: 'core:class:Doc',
      context: { mode: ['workbench', 'browser'], application: 'tracker:app:Company', group: 'create' }
    }
  },
  {
    id: 'tracker:class:ClientFunnel',
    tx: 'core:class:TxMixin',
    objectClass: 'core:class:Class',
    mixin: 'workbench:mixin:SpaceView',
    attributes: {
      view: {
        class: 'tracker:class:Client',
        createItemDialog: 'tracker:component:CreateClient',
        createItemLabel: 'tracker:string:ClientCreateLabel'
      }
    }
  },
  {
    id: 'tracker:class:ClientFunnel',
    tx: 'core:class:TxMixin',
    objectClass: 'core:class:Class',
    mixin: 'view:mixin:ObjectEditor',
    attributes: { editor: 'tracker:component:CreateClientFunnel' }
  },
  {
    id: 'tracker:class:ClientFunnel',
    tx: 'core:class:TxMixin',
    objectClass: 'core:class:Class',
    mixin: 'activity:mixin:ActivityDoc',
    attributes: {}
  },
  {
    id: 'tracker:class:Client',
    tx: 'core:class:TxMixin',
    objectClass: 'core:class:Class',
    mixin: 'activity:mixin:ActivityDoc',
    attributes: {}
  },
  {
    id: 'tracker:class:Client',
    tx: 'core:class:TxMixin',
    objectClass: 'core:class:Class',
    mixin: 'setting:mixin:Editable',
    attributes: { value: true }
  },
  {
    id: 'tracker:class:Client',
    tx: 'core:class:TxMixin',
    objectClass: 'core:class:Class',
    mixin: 'view:mixin:ObjectPresenter',
    attributes: { presenter: 'tracker:component:ClientPresenter' }
  },
  {
    id: 'tracker:class:Client',
    tx: 'core:class:TxMixin',
    objectClass: 'core:class:Class',
    mixin: 'view:mixin:ObjectTitle',
    attributes: { titleProvider: 'tracker:function:ClientTitleProvider' }
  },
  {
    id: 'tracker:class:Client',
    tx: 'core:class:TxMixin',
    objectClass: 'core:class:Class',
    mixin: 'view:mixin:ObjectIdentifier',
    attributes: { provider: 'tracker:function:ClientIdProvider' }
  },
  {
    id: 'tracker:class:Client',
    tx: 'core:class:TxMixin',
    objectClass: 'core:class:Class',
    mixin: 'view:mixin:LinkProvider',
    attributes: { encode: 'tracker:function:GetClientLinkFragment' }
  },
  {
    id: 'tracker:class:Client',
    tx: 'core:class:TxMixin',
    objectClass: 'core:class:Class',
    mixin: 'task:mixin:KanbanCard',
    attributes: { card: 'tracker:component:ClientKanbanCard' }
  },
  {
    id: 'tracker:class:Client',
    tx: 'core:class:TxMixin',
    objectClass: 'core:class:Class',
    mixin: 'view:mixin:ClassFilters',
    attributes: { filters: ['attachedTo'] }
  },
  {
    id: 'contact:class:Organization',
    tx: 'core:class:TxMixin',
    objectClass: 'core:class:Class',
    mixin: 'view:mixin:ObjectEditorFooter',
    attributes: { editor: 'tracker:component:CompanyRelated' }
  }
]

function sqlLiteral (value) {
  return `'${String(value).replace(/'/g, "''")}'`
}

function buildSql () {
  const lines = ['-- fork Client model seed for local-ws']
  catalog.forEach((item, index) => {
    const txClass = item.tx ?? 'core:class:TxCreateDoc'
    const attributes = { ...item.attributes }
    if (attributes._class === undefined) {
      attributes._class = item.objectClass
    }
    const data = {
      objectClass: item.objectClass,
      attributes,
      ...(item.mixin !== undefined ? { mixin: item.mixin } : {})
    }
    const json = JSON.stringify(data).replace(/'/g, "''")
    const seedKey = `${item.id}|${txClass}|${item.mixin ?? ''}`
    const mixinPred =
      txClass === 'core:class:TxMixin'
        ? ` AND m.data->>'mixin' = ${sqlLiteral(item.mixin)}`
        : ''
    lines.push(`INSERT INTO model_tx (
  "workspaceId", "_id", "_class", space, "modifiedBy", "createdBy",
  "modifiedOn", "createdOn", "%hash%", "attachedTo", "objectSpace", "objectId", data
)
SELECT w.uuid, substr(md5(w.uuid::text || ${sqlLiteral(seedKey)}), 1, 24),
  ${sqlLiteral(txClass)}, 'core:space:Tx', 'core:account:System', 'core:account:System',
  (extract(epoch from now()) * 1000)::bigint + ${index},
  (extract(epoch from now()) * 1000)::bigint + ${index},
  substr(md5(w.uuid::text || ${sqlLiteral(seedKey + '-h')}), 1, 11),
  NULL, 'core:space:Model', ${sqlLiteral(item.id)},
  '${json}'::jsonb
FROM global_account.workspace w
WHERE NOT EXISTS (
  SELECT 1 FROM model_tx m
  WHERE m."workspaceId" = w.uuid AND m."objectId" = ${sqlLiteral(item.id)}
    AND m."_class" = ${sqlLiteral(txClass)}${mixinPred}
)
ON CONFLICT ("workspaceId", "_id") DO NOTHING;`)
  })
  lines.push(`SELECT COUNT(*) AS client_model_rows FROM model_tx
WHERE "objectId" LIKE 'tracker:%Client%' OR "objectId" IN (
  'tracker:app:Company', 'tracker:template:DefaultClientFunnel', 'tracker:attribute:ClientState'
);`)
  const companyApp = catalog.find((item) => item.id === 'tracker:app:Company' && item.tx === undefined)
  if (companyApp !== undefined) {
    const json = JSON.stringify({
      objectClass: companyApp.objectClass,
      attributes: companyApp.attributes
    }).replace(/'/g, "''")
    lines.push(`UPDATE model_tx SET data = '${json}'::jsonb
WHERE "objectId" = 'tracker:app:Company' AND "_class" = 'core:class:TxCreateDoc';`)
  }
  return lines.join('\n')
}

if (process.argv.includes('--dump-sql')) {
  process.stdout.write(buildSql() + '\n')
  process.exit(0)
}

const cockroach = cockroachName()
const transactor = transactorName()
const dir = mkdtempSync(join(tmpdir(), 'huly-client-model-'))
const sqlPath = join(dir, 'apply.sql')
writeFileSync(sqlPath, buildSql(), 'utf8')

console.log(`==== applying fork Client model via ${cockroach} (${catalog.length} objects) ====`)
execFileSync('docker', ['cp', sqlPath, `${cockroach}:/tmp/huly-local-fork-model.sql`], { stdio: 'inherit' })
const out = execFileSync(
  'docker',
  ['exec', cockroach, './cockroach', 'sql', '--insecure', '-f', '/tmp/huly-local-fork-model.sql'],
  { encoding: 'utf8' }
)
process.stdout.write(out)

const inserted = (out.match(/^INSERT 0 1$/gm) ?? []).length
if (inserted > 0) {
  console.log(`==== restart ${transactor} (${inserted} new model txs) ====`)
  execFileSync('docker', ['restart', transactor], { stdio: 'inherit' })
  execFileSync('docker', ['restart', workspaceName()], { stdio: 'inherit' })
} else {
  console.log('==== Client model already present, transactor left running ====')
}
