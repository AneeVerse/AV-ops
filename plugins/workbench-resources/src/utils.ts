//
// Copyright © 2020, 2021 Anticrm Platform Contributors.
// Copyright © 2021, 2023 Hardcore Engineering Inc.
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

import { getClient as getAccountClient } from '@hcengineering/account-client'
import type {
  Account,
  AccountRole,
  Class,
  Client,
  Doc,
  Ref,
  Space,
  TxOperations,
  WorkspaceInfoWithStatus
} from '@hcengineering/core'
import core, { hasAccountRole } from '@hcengineering/core'
import login from '@hcengineering/login'
import { getMetadata, getResource, setMetadata } from '@hcengineering/platform'
import presentation, { closeClient, getClient, setPresentationCookie } from '@hcengineering/presentation'
import {
  closePanel,
  getCurrentLocation,
  type Location,
  location,
  navigate,
  setMetadataLocalStorage
} from '@hcengineering/ui'
import view from '@hcengineering/view'
import workbench, { type Application, type NavigatorModel } from '@hcengineering/workbench'
import { derived, writable } from 'svelte/store'

export const workspaceCreating = writable<number | undefined>(undefined)

function shouldPersistTokenLocally (): boolean {
  if (typeof window === 'undefined') return false
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
}

export function getSpecialSpaceClass (model: NavigatorModel): Array<Ref<Class<Space>>> {
  const spaceResult = (model.spaces ?? []).map((x) => x.spaceClass)
  const result = (model.specials ?? [])
    .map((it) => it.spaceClass)
    .filter((it) => it !== undefined && !spaceResult.includes(it))
  return spaceResult.concat(result as Array<Ref<Class<Space>>>)
}

export async function getSpaceName (client: Client, space: Space): Promise<string> {
  const hierarchy = client.getHierarchy()
  const clazz = hierarchy.getClass(space._class)
  const nameMixin = hierarchy.as(clazz, view.mixin.SpaceName)

  if (nameMixin?.getName !== undefined) {
    const getSpaceName = await getResource(nameMixin.getName)
    const name = await getSpaceName(client, space)

    return name
  }

  return space.name
}

/**
 * @public
 */
export async function doNavigate (
  doc: Doc | Doc[],
  evt: Event | undefined,
  props: {
    mode: 'app' | 'special' | 'space'
    application?: string
    special?: string
    spaceSpecial?: string
    space?: Ref<Space>
    // If no space is selected, select first space from list
    spaceClass?: Ref<Class<Space>>
    query?: Record<string, string | null>
  }
): Promise<void> {
  evt?.preventDefault()

  closePanel()
  const loc = getCurrentLocation()
  const client = getClient()
  switch (props.mode) {
    case 'app':
      loc.path[2] = props.application ?? ''
      if (props.special !== undefined) {
        loc.path[3] = props.special
        loc.path.length = 4
      } else {
        loc.path.length = 3
      }
      loc.query = props.query
      loc.fragment = undefined
      navigate(loc)
      break
    case 'special':
      if (props.application !== undefined && loc.path[2] !== props.application) {
        loc.path[2] = props.application
      }
      loc.path[3] = props.special ?? ''
      loc.path.length = 4
      loc.query = props.query
      loc.fragment = undefined
      navigate(loc)
      break
    case 'space': {
      if (props.space !== undefined) {
        loc.path[3] = props.space
      } else {
        if (doc !== undefined && !Array.isArray(doc) && client.getHierarchy().isDerived(doc._class, core.class.Space)) {
          loc.path[3] = doc._id
        }
      }
      if (props.spaceSpecial !== undefined) {
        loc.path[4] = props.spaceSpecial
      }
      if (props.spaceClass !== undefined) {
        const ex = await client.findOne(props.spaceClass, { _id: loc.path[3] as Ref<Space> })
        if (ex === undefined) {
          const r = await client.findOne(props.spaceClass, {})
          if (r !== undefined) {
            loc.path[3] = r._id
          }
        }
      }
      loc.path.length = 5
      loc.query = props.query
      loc.fragment = undefined
      navigate(loc)

      break
    }
  }
}

export function isAllowedToRole (role: AccountRole | undefined, acc: Account): boolean {
  if (role === undefined) return true
  return hasAccountRole(acc, role)
}

export async function hideApplication (app: Application): Promise<void> {
  const client = getClient()

  await client.createDoc(workbench.class.HiddenApplication, core.space.Workspace, {
    attachedTo: app._id
  })
}

export async function showApplication (app: Application): Promise<void> {
  const client = getClient()

  const current = await client.findOne(workbench.class.HiddenApplication, { attachedTo: app._id })
  if (current !== undefined) {
    await client.remove(current)
  }
}

export function sortApplicationsByOrder (apps: Application[], order: Array<Ref<Application>>): Application[] {
  if (order.length === 0) {
    return [...apps].sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity))
  }
  const orderMap = new Map(order.map((id, index) => [id, index]))
  return [...apps].sort((a, b) => {
    const aIndex = orderMap.get(a._id)
    const bIndex = orderMap.get(b._id)
    if (aIndex !== undefined && bIndex !== undefined) return aIndex - bIndex
    if (aIndex !== undefined) return -1
    if (bIndex !== undefined) return 1
    return (a.order ?? Infinity) - (b.order ?? Infinity)
  })
}

function applicationOrderStorageKey (): string {
  const workspace = getMetadata(presentation.metadata.WorkspaceUuid) ?? 'default'
  return `workbench.applicationOrder.${workspace}`
}

function loadLocalApplicationOrder (): Array<Ref<Application>> {
  try {
    const raw = localStorage.getItem(applicationOrderStorageKey())
    if (raw == null || raw === '') return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export const applicationOrderStore = writable<Array<Ref<Application>>>([])

export function hydrateApplicationOrderStore (): void {
  const local = loadLocalApplicationOrder()
  if (local.length > 0) {
    applicationOrderStore.set(local)
  }
}

export async function saveApplicationOrder (applications: Array<Ref<Application>>): Promise<void> {
  applicationOrderStore.set(applications)
  try {
    localStorage.setItem(applicationOrderStorageKey(), JSON.stringify(applications))
  } catch {
    // ignore quota / private-mode failures; in-memory store still updates the sidebar
  }

  const client = getClient()
  if (!client.getHierarchy().hasClass(workbench.class.ApplicationOrder)) {
    return
  }
  try {
    const current = await client.findOne(workbench.class.ApplicationOrder, { space: core.space.Workspace })
    if (current !== undefined) {
      await client.update(current, { applications })
    } else {
      await client.createDoc(workbench.class.ApplicationOrder, core.space.Workspace, { applications })
    }
  } catch (err) {
    console.error('Failed to persist application order', err)
  }
}

export const workspacesStore = writable<WorkspaceInfoWithStatus[]>([])
export const locationWorkspaceStore = derived(location, (loc: Location) => loc.path[1])
export const currentWorkspaceStore = derived(
  [workspacesStore, locationWorkspaceStore],
  ([$workspaces, $locationWorkspace]) => {
    return $workspaces.find((it) => it.url === $locationWorkspace)
  }
)

/**
 * @public
 */
export async function buildNavModel (
  client: TxOperations,
  currentApplication?: Application
): Promise<NavigatorModel | undefined> {
  let newNavModel = currentApplication?.navigatorModel
  if (currentApplication !== undefined) {
    const models = await client.findAll(workbench.class.ApplicationNavModel, { extends: currentApplication._id })
    for (const nm of models) {
      const spaces = newNavModel?.spaces ?? []
      // Check for extending
      for (const sp of spaces) {
        const extend = (nm.spaces ?? []).find((p) => p.id === sp.id)
        if (extend !== undefined) {
          sp.label = sp.label ?? extend.label
          sp.createComponent = sp.createComponent ?? extend.createComponent
          sp.addSpaceLabel = sp.addSpaceLabel ?? extend.addSpaceLabel
          sp.icon = sp.icon ?? extend.icon
          sp.visibleIf = sp.visibleIf ?? extend.visibleIf
          sp.specials = [...(sp.specials ?? []), ...(extend.specials ?? [])]
        }
      }
      const newSpaces = (nm.spaces ?? []).filter((it) => !spaces.some((sp) => sp.id === it.id))
      newNavModel = {
        spaces: [...spaces, ...newSpaces],
        specials: [...(newNavModel?.specials ?? []), ...(nm.specials ?? [])]
      }
    }
  }
  return newNavModel
}

export async function logIn (loginInfo: { account: string, token?: string }): Promise<void> {
  const accountsUrl = getMetadata(login.metadata.AccountsUrl)
  await getAccountClient(accountsUrl, loginInfo.token).setCookie()

  if (shouldPersistTokenLocally()) {
    setMetadataLocalStorage(presentation.metadata.Token, loginInfo.token ?? null)
  } else {
    setMetadata(presentation.metadata.Token, loginInfo.token)
  }
  setMetadataLocalStorage(login.metadata.LastAccount, loginInfo.account)
  setMetadataLocalStorage(login.metadata.LoginAccount, loginInfo.account)
}

export async function logOut (): Promise<void> {
  const accountsUrl = getMetadata(login.metadata.AccountsUrl)
  try {
    await getAccountClient(accountsUrl).deleteCookie()
  } catch (error) {}

  const currentWorkspace = getMetadata(presentation.metadata.WorkspaceUuid)
  if (currentWorkspace !== undefined) {
    setPresentationCookie('', currentWorkspace)
  }

  if (shouldPersistTokenLocally()) {
    setMetadataLocalStorage(presentation.metadata.Token, null)
  } else {
    setMetadata(presentation.metadata.Token, null)
  }
  setMetadata(presentation.metadata.WorkspaceUuid, null)
  setMetadata(presentation.metadata.WorkspaceDataId, null)
  setMetadataLocalStorage(login.metadata.LoginEndpoint, null)
  setMetadataLocalStorage(login.metadata.LoginAccount, null)

  void closeClient()
}
