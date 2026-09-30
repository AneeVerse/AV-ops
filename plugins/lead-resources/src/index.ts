//
// Copyright © 2020, 2021 Anticrm Platform Contributors.
// Copyright © 2021 Hardcore Engineering Inc.
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

import { AccountRole, getCurrentAccount, hasAccountRole, type Doc } from '@hcengineering/core'
import { type Resources } from '@hcengineering/platform'
import { getClient, MessageBox } from '@hcengineering/presentation'
import { showPopup } from '@hcengineering/ui'
import lead, { type Funnel } from '@hcengineering/lead'
import { canDeleteSpace } from '@hcengineering/view-resources'

import CreateFunnel from './components/CreateFunnel.svelte'
import CreateLead from './components/CreateLead.svelte'
import EditLead from './components/EditLead.svelte'
import KanbanCard from './components/KanbanCard.svelte'
import LeadPresenter from './components/LeadPresenter.svelte'
import Leads from './components/Leads.svelte'
import LeadsPresenter from './components/LeadsPresenter.svelte'
import TemplatesIcon from './components/TemplatesIcon.svelte'
import CreateCustomer from './components/CreateCustomer.svelte'
import NewItemsHeader from './components/NewItemsHeader.svelte'
import EditFunnel from './components/EditFunnel.svelte'
import MyLeads from './components/MyLeads.svelte'
import AllLeads from './components/AllLeads.svelte'
import TitlePresenter from './components/TitlePresenter.svelte'

import { getLeadId, getLeadTitle } from './utils'
import plugin from './plugin'

export async function canDeleteFunnel (doc?: Doc | Doc[]): Promise<boolean> {
  if (doc === undefined || Array.isArray(doc)) {
    return false
  }
  if (hasAccountRole(getCurrentAccount(), AccountRole.Maintainer)) {
    return true
  }
  return await canDeleteSpace(doc)
}

async function deleteFunnel (funnel: Funnel | undefined): Promise<void> {
  if (funnel === undefined) return
  const client = getClient()
  if (funnel.archived) {
    showPopup(MessageBox, {
      label: plugin.string.DeleteFunnel,
      labelProps: { name: funnel.name },
      message: plugin.string.DeleteFunnelConfirm,
      action: async () => {
        const leads = await client.findAll(lead.class.Lead, { space: funnel._id }, { showArchived: true })
        for (const item of leads) {
          await client.remove(item)
        }
        await client.remove(funnel)
      }
    })
    return
  }
  const anyLead = await client.findOne(lead.class.Lead, { space: funnel._id })
  showPopup(MessageBox, {
    label: plugin.string.ArchiveFunnel,
    labelProps: { name: funnel.name },
    message: anyLead !== undefined ? plugin.string.FunnelHasLeads : plugin.string.ArchiveFunnelConfirm,
    action: async () => {
      await client.update(funnel, { archived: true })
    }
  })
}

export default async (): Promise<Resources> => ({
  component: {
    CreateFunnel,
    CreateLead,
    EditLead,
    KanbanCard,
    LeadPresenter,
    TemplatesIcon,
    LeadsPresenter,
    Leads,
    CreateCustomer,
    NewItemsHeader,
    EditFunnel,
    MyLeads,
    AllLeads,
    TitlePresenter
  },
  function: {
    LeadTitleProvider: getLeadTitle,
    LeadIdProvider: getLeadId,
    CanDeleteFunnel: canDeleteFunnel
  },
  actionImpl: {
    DeleteFunnel: deleteFunnel
  }
})
