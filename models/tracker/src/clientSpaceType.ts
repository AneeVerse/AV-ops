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
import { PaletteColorIndexes } from '@hcengineering/ui/src/colors'
import task from '@hcengineering/task'
import { type Builder } from '@hcengineering/model'
import core from '@hcengineering/model-core'
import { type Ref, type Status } from '@hcengineering/core'

import { TClientTypeData, TDefaultClientFunnelTypeData } from './types'
import plugin from './plugin'

export const defaultClientStatuses = [
  {
    id: plugin.clientStatus.Backlog,
    color: PaletteColorIndexes.Coin,
    name: 'Backlog',
    ofAttribute: plugin.attribute.ClientState,
    category: task.statusCategory.UnStarted
  },
  {
    id: plugin.clientStatus.Incoming,
    color: PaletteColorIndexes.Coin,
    name: 'Incoming',
    ofAttribute: plugin.attribute.ClientState,
    category: task.statusCategory.Active
  },
  {
    id: plugin.clientStatus.Negotiation,
    color: PaletteColorIndexes.Arctic,
    name: 'Negotiation',
    ofAttribute: plugin.attribute.ClientState,
    category: task.statusCategory.Active
  },
  {
    id: plugin.clientStatus.OfferPreparing,
    color: PaletteColorIndexes.Watermelon,
    name: 'Offer preparing',
    ofAttribute: plugin.attribute.ClientState,
    category: task.statusCategory.Active
  },
  {
    id: plugin.clientStatus.MakeADecision,
    color: PaletteColorIndexes.Orange,
    name: 'Make a decision',
    ofAttribute: plugin.attribute.ClientState,
    category: task.statusCategory.Active
  },
  {
    id: plugin.clientStatus.ContractConclusion,
    color: PaletteColorIndexes.Ocean,
    name: 'Contract conclusion',
    ofAttribute: plugin.attribute.ClientState,
    category: task.statusCategory.Active
  },
  {
    name: 'Won',
    id: plugin.clientStatus.Won,
    ofAttribute: plugin.attribute.ClientState,
    category: task.statusCategory.Won
  },
  {
    name: 'Lost',
    id: plugin.clientStatus.Lost,
    ofAttribute: plugin.attribute.ClientState,
    category: task.statusCategory.Lost
  }
]

export function defineClientSpaceType (builder: Builder): void {
  builder.createModel(TDefaultClientFunnelTypeData)
  builder.createDoc(
    task.class.ProjectTypeDescriptor,
    core.space.Model,
    {
      name: plugin.string.CompanyApplication,
      description: plugin.string.ManageFunnelStatuses,
      icon: plugin.icon.Project,
      baseClass: plugin.class.ClientFunnel,
      availablePermissions: [
        core.permission.UpdateSpace,
        core.permission.ArchiveSpace,
        core.permission.ForbidDeleteObject
      ],
      allowedTaskTypeDescriptors: [plugin.descriptors.Client]
    },
    plugin.descriptors.ClientFunnelType
  )
  builder.createDoc(
    task.class.TaskTypeDescriptor,
    core.space.Model,
    {
      baseClass: plugin.class.Client,
      allowCreate: true,
      description: plugin.string.Client,
      icon: plugin.icon.Project,
      name: plugin.string.Client
    },
    plugin.descriptors.Client
  )

  const defaultStatuses: Ref<Status>[] = []

  for (const status of defaultClientStatuses) {
    const { name, color, ofAttribute, id, category } = status

    if (id === undefined) {
      throw new Error('Status id is required when creating in static model. Missing for: ' + name)
    }

    defaultStatuses.push(id)

    builder.createDoc(
      core.class.Status,
      core.space.Model,
      {
        ofAttribute,
        name,
        color,
        category
      },
      id
    )
  }

  builder.createModel(TClientTypeData)

  builder.createDoc(
    task.class.TaskType,
    core.space.Model,
    {
      name: 'Client',
      descriptor: plugin.descriptors.Client,
      ofClass: plugin.class.Client,
      targetClass: plugin.mixin.ClientTypeData,
      statusClass: core.class.Status,
      statusCategories: [
        task.statusCategory.UnStarted,
        task.statusCategory.Active,
        task.statusCategory.Won,
        task.statusCategory.Lost
      ],
      kind: 'task',
      parent: plugin.template.DefaultClientFunnel,
      statuses: defaultStatuses,
      icon: plugin.icon.Project
    },
    plugin.taskTypes.Client
  )

  builder.createDoc(
    task.class.ProjectType,
    core.space.Model,
    {
      name: 'Default funnel',
      descriptor: plugin.descriptors.ClientFunnelType,
      description: '',
      tasks: [plugin.taskTypes.Client],
      roles: 0,
      classic: false,
      statuses: defaultStatuses.map((s) => ({ _id: s, taskType: plugin.taskTypes.Client })),
      targetClass: plugin.mixin.DefaultClientFunnelTypeData
    },
    plugin.template.DefaultClientFunnel
  )
}
