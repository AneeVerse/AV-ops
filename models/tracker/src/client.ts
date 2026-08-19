//
// Copyright © 2026 Hardcore Engineering Inc.
//
// Licensed under the Eclipse Public License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License. You may
// obtain a copy of the License at https://www.eclipse.org/legal/epl-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//
// See the License for the specific language governing permissions and
// limitations under the License.
//

import activity from '@hcengineering/activity'
import { AccountRole, type ClassCollaborators, SortingOrder, type FindOptions } from '@hcengineering/core'
import { type Builder } from '@hcengineering/model'
import chunter from '@hcengineering/chunter'
import contact from '@hcengineering/model-contact'
import core from '@hcengineering/model-core'
import task from '@hcengineering/model-task'
import view, { createAction } from '@hcengineering/model-view'
import workbench from '@hcengineering/model-workbench'
import setting from '@hcengineering/setting'
import { type ViewOptionsModel } from '@hcengineering/view'
import drive from '@hcengineering/drive'
import { type Client } from '@hcengineering/tracker'

import tracker from './plugin'
import { defineClientSpaceType } from './clientSpaceType'

export function defineClientModel (builder: Builder): void {
  builder.mixin(tracker.class.Client, core.class.Class, activity.mixin.ActivityDoc, {})
  builder.mixin(tracker.class.ClientFunnel, core.class.Class, activity.mixin.ActivityDoc, {})

  builder.createDoc(
    activity.class.ActivityExtension,
    core.space.Model,
    {
      ofClass: tracker.class.Client,
      components: { input: { component: chunter.component.ChatMessageInput } }
    },
    tracker.ids.ClientActivityExtension
  )

  builder.createDoc(
    activity.class.ActivityExtension,
    core.space.Model,
    {
      ofClass: tracker.class.ClientFunnel,
      components: { input: { component: chunter.component.ChatMessageInput } }
    },
    tracker.ids.ClientFunnelActivityExtension
  )

  builder.mixin(tracker.class.ClientFunnel, core.class.Class, workbench.mixin.SpaceView, {
    view: {
      class: tracker.class.Client,
      createItemDialog: tracker.component.CreateClient,
      createItemLabel: tracker.string.ClientCreateLabel
    }
  })

  builder.mixin(tracker.class.ClientFunnel, core.class.Class, view.mixin.ObjectEditor, {
    editor: tracker.component.CreateClientFunnel
  })

  builder.mixin(tracker.class.Client, core.class.Class, setting.mixin.Editable, {
    value: true
  })

  builder.mixin(tracker.class.Client, core.class.Class, view.mixin.ObjectPresenter, {
    presenter: tracker.component.ClientPresenter
  })

  builder.mixin(tracker.class.Client, core.class.Class, view.mixin.ObjectTitle, {
    titleProvider: tracker.function.ClientTitleProvider
  })

  builder.mixin(tracker.class.Client, core.class.Class, view.mixin.ObjectIdentifier, {
    provider: tracker.function.ClientIdProvider
  })

  builder.mixin(tracker.class.Client, core.class.Class, view.mixin.LinkProvider, {
    encode: tracker.function.GetClientLinkFragment
  })

  builder.mixin(tracker.class.Client, core.class.Class, task.mixin.KanbanCard, {
    card: tracker.component.ClientKanbanCard
  })

  builder.mixin(tracker.class.Client, core.class.Class, view.mixin.ClassFilters, {
    filters: ['attachedTo']
  })

  builder.createDoc<ClassCollaborators<Client>>(
    core.class.ClassCollaborators,
    core.space.Model,
    {
      attachedTo: tracker.class.Client,
      fields: ['createdBy', 'assignee']
    },
    tracker.ids.ClientCollaborators
  )

  defineClientApplication(builder)
  defineClientViewlets(builder)
  defineClientActions(builder)
  defineClientSpaceType(builder)

  builder.createDoc(
    core.class.Permission,
    core.space.Model,
    {
      label: tracker.string.ForbidCreateClientFunnelPermission,
      scope: 'workspace',
      txClass: core.class.TxCreateDoc,
      objectClass: tracker.class.ClientFunnel,
      forbid: true,
      description: tracker.string.ForbidCreateClientFunnelPermissionDescription
    },
    tracker.permission.ForbidCreateClientFunnel
  )

  builder.mixin(contact.class.Organization, core.class.Class, view.mixin.ObjectEditorFooter, {
    editor: tracker.component.CompanyRelated
  })
}

function defineClientApplication (builder: Builder): void {
  builder.createDoc(
    workbench.class.Application,
    core.space.Model,
    {
      label: tracker.string.CompanyApplication,
      icon: contact.icon.Company,
      alias: 'company',
      hidden: false,
      locationResolver: tracker.resolver.CompanyLocation,
      navigatorModel: {
        specials: [
          {
            id: 'my-clients',
            label: tracker.string.MyClients,
            icon: contact.icon.Company,
            component: tracker.component.MyClients,
            componentProps: {
              config: [
                ['assigned', view.string.Assigned, {}],
                ['created', view.string.Created, {}],
                ['subscribed', view.string.Subscribed, {}]
              ]
            },
            position: 'top'
          },
          {
            id: 'companies',
            label: tracker.string.Companies,
            icon: contact.icon.Company,
            component: workbench.component.SpecialView,
            accessLevel: AccountRole.DocGuest,
            componentProps: {
              _class: contact.class.Organization,
              icon: contact.icon.Company,
              label: tracker.string.Companies,
              createLabel: tracker.string.NewCompany,
              createComponent: tracker.component.CreateCompany
            },
            position: 'top'
          },
          {
            id: 'funnels',
            component: workbench.component.SpecialView,
            icon: tracker.icon.Project,
            label: tracker.string.Funnels,
            position: 'bottom',
            accessLevel: AccountRole.User,
            componentProps: {
              _class: tracker.class.ClientFunnel,
              icon: tracker.icon.Project,
              label: tracker.string.Funnels,
              createComponent: tracker.component.CreateClientFunnel,
              createLabel: tracker.string.CreateFunnel
            }
          }
        ],
        spaces: [
          {
            id: 'client-funnels',
            label: tracker.string.Funnels,
            spaceClass: tracker.class.ClientFunnel,
            addSpaceLabel: tracker.string.CreateFunnel,
            createComponent: tracker.component.CreateClientFunnel,
            icon: tracker.icon.Project
          }
        ],
        groups: [
          {
            id: 'client-tracker',
            label: tracker.string.Company,
            groupByClass: contact.class.Organization,
            component: tracker.component.ClientTrackerNav,
            specials: [
              {
                id: 'client-home',
                label: tracker.string.Company,
                icon: contact.icon.Company,
                component: tracker.component.ClientHome
              },
              {
                id: 'company-issues',
                label: tracker.string.Issues,
                icon: tracker.icon.Issues,
                component: tracker.component.ClientCompanyIssues
              },
              {
                id: 'company-files',
                label: tracker.string.CompanyFiles,
                icon: drive.icon.Folder,
                component: tracker.component.ClientCompanyFiles
              },
              {
                id: 'project-files',
                label: tracker.string.ProjectFiles,
                icon: drive.icon.Folder,
                component: tracker.component.ProjectDriveFiles
              }
            ]
          }
        ]
      },
      navHeaderComponent: tracker.component.NewCompanyHeader
    },
    tracker.app.Company
  )
}

function defineClientViewlets (builder: Builder): void {
  builder.createDoc(
    view.class.Viewlet,
    core.space.Model,
    {
      attachTo: tracker.class.ClientFunnel,
      descriptor: view.viewlet.Table,
      configOptions: {
        hiddenKeys: ['identifier', 'name'],
        sortable: true
      },
      viewOptions: {
        groupBy: [],
        orderBy: [],
        other: [
          {
            key: 'hideArchived',
            type: 'toggle',
            defaultValue: true,
            actionTarget: 'options',
            action: view.function.HideArchived,
            label: view.string.HideArchived
          }
        ]
      },
      config: ['', 'members', 'private', 'archived']
    },
    tracker.viewlet.TableClientFunnel
  )

  builder.createDoc(
    view.class.Viewlet,
    core.space.Model,
    {
      attachTo: tracker.class.Client,
      descriptor: task.viewlet.StatusTable,
      config: ['', 'title', 'attachedTo', 'assignee', 'status', 'attachments', 'comments', 'modifiedOn'],
      viewOptions: {
        groupBy: [],
        orderBy: [],
        other: [
          {
            key: 'hideArchived',
            type: 'toggle',
            defaultValue: true,
            actionTarget: 'options',
            action: view.function.HideArchived,
            label: view.string.HideArchived
          }
        ]
      },
      configOptions: {
        sortable: true
      }
    },
    tracker.viewlet.TableClient
  )

  const clientViewOptions: ViewOptionsModel = {
    groupBy: ['status', 'assignee'],
    orderBy: [
      ['status', SortingOrder.Ascending],
      ['modifiedOn', SortingOrder.Descending],
      ['createdOn', SortingOrder.Descending],
      ['dueDate', SortingOrder.Ascending],
      ['rank', SortingOrder.Ascending]
    ],
    other: [
      {
        key: 'shouldShowAll',
        type: 'toggle',
        defaultValue: false,
        actionTarget: 'category',
        action: view.function.ShowEmptyGroups,
        label: view.string.ShowEmptyGroups
      },
      {
        key: 'hideArchived',
        type: 'toggle',
        defaultValue: true,
        actionTarget: 'options',
        action: view.function.HideArchived,
        label: view.string.HideArchived
      }
    ]
  }

  builder.createDoc(
    view.class.Viewlet,
    core.space.Model,
    {
      attachTo: tracker.class.Client,
      descriptor: view.viewlet.List,
      configOptions: {
        strict: true,
        hiddenKeys: ['title']
      },
      config: [
        { key: '', displayProps: { fixed: 'left', key: 'client' } },
        {
          key: 'status',
          props: { kind: 'list', size: 'small', shouldShowName: false }
        },
        {
          key: '',
          presenter: tracker.component.ClientTitlePresenter,
          label: tracker.string.Title,
          props: { maxWidth: '10rem' }
        },
        {
          key: '$lookup.attachedTo',
          presenter: contact.component.OrganizationPresenter,
          label: tracker.string.Company,
          sortingKey: '$lookup.attachedTo.name',
          props: {
            _class: contact.class.Organization,
            maxWidth: '10rem'
          }
        },
        { key: 'attachments', displayProps: { key: 'attachments', suffix: true } },
        { key: 'comments', displayProps: { key: 'comments', suffix: true } },
        { key: '', displayProps: { grow: true } },
        {
          key: '$lookup.attachedTo.$lookup.channels',
          label: contact.string.ContactInfo,
          sortingKey: ['$lookup.attachedTo.$lookup.channels.lastMessage', '$lookup.attachedTo.channels'],
          props: {
            length: 'full',
            size: 'small',
            kind: 'list'
          },
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
    },
    tracker.viewlet.ListClient
  )

  const lookupClientOptions: FindOptions<Client> = {
    lookup: {
      attachedTo: contact.class.Organization
    }
  }

  builder.createDoc(
    view.class.Viewlet,
    core.space.Model,
    {
      attachTo: tracker.class.Client,
      descriptor: task.viewlet.Kanban,
      viewOptions: {
        ...clientViewOptions,
        groupDepth: 1
      },
      options: lookupClientOptions,
      config: ['attachedTo', 'status', 'attachments', 'comments', 'dueDate', 'assignee'],
      configOptions: {
        strict: true
      }
    },
    tracker.viewlet.KanbanClient
  )

  builder.createDoc(
    view.class.Viewlet,
    core.space.Model,
    {
      attachTo: tracker.class.Client,
      descriptor: task.viewlet.Dashboard,
      options: {},
      config: []
    },
    tracker.viewlet.DashboardClient
  )
}

function defineClientActions (builder: Builder): void {
  createAction(
    builder,
    {
      action: view.actionImpl.ShowPopup,
      actionProps: {
        component: tracker.component.CreateClient,
        element: 'top'
      },
      label: tracker.string.CreateClient,
      icon: contact.icon.Company,
      input: 'none',
      category: tracker.category.Tracker,
      target: core.class.Doc,
      context: {
        mode: ['workbench', 'browser'],
        application: tracker.app.Company,
        group: 'create'
      }
    },
    tracker.action.CreateGlobalClient
  )
}
