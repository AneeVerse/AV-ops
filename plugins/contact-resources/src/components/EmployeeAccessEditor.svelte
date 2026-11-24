<!--
// Copyright © 2026 AneeVerse
-->
<script lang="ts">
  import { getCurrentEmployee, type EmployeeAccess, type Person } from '@hcengineering/contact'
  import core, {
    isOwnerOrMaintainer,
    type Class,
    type Doc,
    type Ref
  } from '@hcengineering/core'
  import { getEmbeddedLabel, getResourcePlugin, translate, type IntlString, type Plugin } from '@hcengineering/platform'
  import {
    createQuery,
    getClient,
    pluginConfigurationStore,
    type ConfigurationManager
  } from '@hcengineering/presentation'
  import { CheckBox, Label, themeStore, Toggle } from '@hcengineering/ui'
  import workbench, { type Application, type Widget } from '@hcengineering/workbench'

  import contact from '../plugin'

  export let object: Person

  /** Avoid a contact-resources → tools package link; class id is stable. */
  const TOOL_CLASS = 'tools:class:Tool' as Ref<Class<Doc>>

  /** Same cards the Tools app shows when the workspace has not been seeded yet. */
  const FALLBACK_TOOLS: RawTool[] = [
    ['cultura', 'Cultura Jewels', 'websites'],
    ['aneeverse', 'Aneeverse', 'studio'],
    ['studio', 'ContentBeta Studio', 'studio'],
    ['bots', 'Jewelry Gemini', 'tools'],
    ['jwel-img', 'Jewelry Image Gen', 'tools'],
    ['md', 'Obsidian', 'tools'],
    ['n8n-listing-images', 'Listing Images', 'n8n']
  ].map(([id, name, group]) => ({
    _id: `tools:tool:${id}` as Ref<Doc>,
    name,
    group,
    host: ''
  }))

  /** Retired n8n forms. The Tools directory hides these and keeps Listing Images. */
  const HIDDEN_TOOL_IDS = new Set(['n8n', 'amazon', 'etsy', 'n8n-ebay', 'n8n-amazon', 'n8n-etsy'])

  const GROUP_LABELS: Record<string, string> = {
    websites: 'Websites',
    studio: 'Studio',
    tools: 'Bots & tools',
    n8n: 'n8n'
  }
  const GROUP_ORDER = ['websites', 'studio', 'tools', 'n8n']

  interface RawTool {
    _id: Ref<Doc>
    name: string
    group: string
    host: string
  }

  interface AccessRow {
    key: string
    title: string
    ids: Array<Ref<Doc>>
    aliases: string[]
  }

  interface ToolRow {
    key: string
    name: string
    ids: Array<Ref<Doc>>
  }

  interface ToolGroupRow {
    id: string
    name: string
    tools: ToolRow[]
  }

  const client = getClient()
  const canEdit = isOwnerOrMaintainer()
  const selfId = getCurrentEmployee()

  const accessQuery = createQuery()
  const toolsQuery = createQuery()

  let access: EmployeeAccess | undefined
  let rawTools: RawTool[] = []
  let toolsLoaded = false
  let appRows: AccessRow[] = []
  let widgetRows: AccessRow[] = []
  let toolGroups: ToolGroupRow[] = []
  let rebuildToken = 0

  const modelApplications = client
    .getModel()
    .findAllSync<Application>(workbench.class.Application, { hidden: false })
    .slice()
    .sort((a, b) => a.alias.localeCompare(b.alias))

  const modelWidgets = client
    .getModel()
    .findAllSync<Widget>(workbench.class.Widget, {})
    .filter((widget) => !String(widget._id).toLowerCase().includes('chunter'))
  const extraWidgets: Array<Pick<Widget, '_id' | 'label'>> = [
    {
      _id: workbench.ids.NovinoChatWidget,
      label: getEmbeddedLabel('Chat')
    },
    {
      _id: workbench.ids.VpsFoldersWidget,
      label: getEmbeddedLabel('VPS')
    }
  ]
  const seenWidgetIds = new Set<string>()
  const modelWidgetChoices = [...modelWidgets, ...extraWidgets.filter((widget) => !modelWidgets.some((item) => item._id === widget._id))]
    .filter((widget) => {
      if (widget._id === undefined || widget._id === '' || seenWidgetIds.has(widget._id)) return false
      seenWidgetIds.add(widget._id)
      return true
    })

  $: isEmployee =
    client.getHierarchy().hasMixin(object, contact.mixin.Employee) ||
    (object._class as string)?.includes('Employee') ||
    (object._class as string)?.includes('Person')
  $: showPanel = canEdit && isEmployee
  $: isSelf = object._id === selfId

  $: if (showPanel) {
    try {
      if (client.getHierarchy().hasClass(contact.class.EmployeeAccess)) {
        accessQuery.query(contact.class.EmployeeAccess, { attachedTo: object._id }, (res) => {
          access = res[0]
        })
      }
    } catch {
      // ignore
    }
  } else {
    accessQuery.unsubscribe()
    access = undefined
  }

  $: if (showPanel) {
    try {
      if (client.getHierarchy().hasClass(TOOL_CLASS)) {
        toolsQuery.query(TOOL_CLASS, {}, (res) => {
          toolsLoaded = true
          rawTools = res.map((doc) => {
            const tool = doc as Doc & { name?: string, group?: string, host?: string }
            return {
              _id: doc._id,
              name: String(tool.name ?? doc._id),
              group: String(tool.group ?? ''),
              host: String(tool.host ?? '')
            }
          })
        })
      } else {
        toolsLoaded = true
        rawTools = []
      }
    } catch {
      toolsLoaded = true
      rawTools = []
    }
  } else {
    toolsQuery.unsubscribe()
    toolsLoaded = false
    rawTools = []
  }

  function pluginEnabled (config: ConfigurationManager, alias: string): boolean {
    return config.configuration.get(alias as Plugin)?.enabled ?? true
  }

  function widgetPluginEnabled (config: ConfigurationManager, id: Ref<Doc>): boolean {
    try {
      const plugin = getResourcePlugin(id as never)
      return config.configuration.get(plugin)?.enabled ?? true
    } catch {
      return true
    }
  }

  function toolIdSlug (id: Ref<Doc>): string {
    return String(id).replace('tools:tool:', '')
  }

  function isListedTool (tool: RawTool): boolean {
    const slug = toolIdSlug(tool._id)
    if (tool.group === '__group__' || tool.group === '__deleted__') return false
    if (slug.startsWith('group:') || String(tool._id).startsWith('tools:group:')) return false
    if (String(tool._id).startsWith('tools:deleted:')) return false
    if (slug === 'n8n-listing-images') return true
    if (HIDDEN_TOOL_IDS.has(slug)) return false
    const lowerName = tool.name.toLowerCase()
    if (
      lowerName.includes('ebay -> listing') ||
      lowerName.includes('amazon -> listing') ||
      lowerName.includes('etsy -> listing')
    ) {
      return false
    }
    return tool.name.trim() !== ''
  }

  function listedTools (): RawTool[] {
    const live = rawTools.filter(isListedTool)
    if (live.length > 0) return live
    return toolsLoaded ? FALLBACK_TOOLS : []
  }

  function metaSlug (tool: RawTool, prefix: string): string {
    if (String(tool._id).startsWith(prefix)) return String(tool._id).replace(prefix, '')
    return tool.host
  }

  function groupLabel (id: string, samples: RawTool[]): string {
    const named = samples.find((tool) => {
      const meta = tool.group === '__group__' || String(tool._id).startsWith('tools:group:')
      return meta && metaSlug(tool, 'tools:group:') === id && tool.name.trim() !== ''
    })
    if (named !== undefined) return named.name
    return GROUP_LABELS[id] ?? id.charAt(0).toUpperCase() + id.slice(1)
  }

  function deletedGroups (samples: RawTool[]): Set<string> {
    return new Set(
      samples
        .filter((tool) => tool.group === '__deleted__' || String(tool._id).startsWith('tools:deleted:'))
        .map((tool) => metaSlug(tool, 'tools:deleted:'))
        .filter((id) => id !== '')
    )
  }

  function buildToolGroups (tools: RawTool[]): ToolGroupRow[] {
    const removed = deletedGroups(rawTools)
    const byGroup = new Map<string, Map<string, ToolRow>>()
    for (const tool of tools) {
      const groupId = tool.group.trim() === '' ? 'tools' : tool.group
      if (removed.has(groupId)) continue
      const nameKey = tool.name.trim().toLowerCase()
      const group = byGroup.get(groupId) ?? new Map<string, ToolRow>()
      const existing = group.get(nameKey)
      if (existing === undefined) {
        group.set(nameKey, { key: `${groupId}:${nameKey}`, name: tool.name, ids: [tool._id] })
      } else if (!existing.ids.includes(tool._id)) {
        existing.ids.push(tool._id)
      }
      byGroup.set(groupId, group)
    }
    const ids = Array.from(byGroup.keys()).sort((a, b) => {
      const ai = GROUP_ORDER.indexOf(a)
      const bi = GROUP_ORDER.indexOf(b)
      if (ai === -1 && bi === -1) return a.localeCompare(b)
      if (ai === -1) return 1
      if (bi === -1) return -1
      return ai - bi
    })
    return ids.map((id) => ({
      id,
      name: groupLabel(id, rawTools),
      tools: Array.from(byGroup.get(id)?.values() ?? []).sort((a, b) => a.name.localeCompare(b.name))
    }))
  }

  async function collapseByLabel (
    items: Array<{ _id: Ref<Doc>, label: IntlString, alias?: string }>,
    lang: string
  ): Promise<AccessRow[]> {
    const titles = await Promise.all(items.map(async (item) => await translate(item.label, {}, lang)))
    const rows: AccessRow[] = []
    const index = new Map<string, number>()
    items.forEach((item, itemIndex) => {
      const title = titles[itemIndex]?.trim() || item.alias || String(item._id)
      const key = title.toLowerCase()
      const existing = index.get(key)
      if (existing === undefined) {
        index.set(key, rows.length)
        rows.push({ key, title, ids: [item._id], aliases: item.alias !== undefined ? [item.alias] : [] })
      } else {
        const row = rows[existing]
        if (!row.ids.includes(item._id)) row.ids.push(item._id)
        if (item.alias !== undefined && !row.aliases.includes(item.alias)) row.aliases.push(item.alias)
      }
    })
    return rows
  }

  async function rebuild (lang: string, config: ConfigurationManager): Promise<void> {
    const token = ++rebuildToken
    const apps = modelApplications.filter((app) => pluginEnabled(config, app.alias))
    const widgets = modelWidgetChoices.filter((widget) => widgetPluginEnabled(config, widget._id))
    const [nextApps, nextWidgets] = await Promise.all([
      collapseByLabel(apps, lang),
      collapseByLabel(widgets, lang)
    ])
    if (token !== rebuildToken) return
    appRows = nextApps
    widgetRows = nextWidgets
    toolGroups = buildToolGroups(listedTools())
  }

  $: void rebuild($themeStore.language, $pluginConfigurationStore)

  $: toolsSignature = `${toolsLoaded}:${rawTools.map((tool) => `${tool._id}:${tool.name}:${tool.group}:${tool.host}`).join('|')}`
  $: if (toolsSignature !== undefined) {
    toolGroups = buildToolGroups(listedTools())
  }

  function isChecked (list: Array<Ref<Doc>> | undefined, id: Ref<Doc>): boolean {
    return (list ?? []).includes(id)
  }

  function selectionState (list: Array<Ref<Doc>> | undefined, ids: Array<Ref<Doc>>): 'all' | 'some' | 'none' {
    const picked = ids.filter((id) => isChecked(list, id)).length
    if (picked === 0) return 'none'
    if (picked === ids.length) return 'all'
    return 'some'
  }

  async function ensureAccess (limitEnabled = access?.limitEnabled === true): Promise<EmployeeAccess | undefined> {
    if (access !== undefined) return access
    if (!showPanel) return undefined
    await client.addCollection(
      contact.class.EmployeeAccess,
      core.space.Workspace,
      object._id,
      contact.mixin.Employee,
      'access',
      {
        limitEnabled,
        apps: [],
        widgets: [],
        tools: []
      }
    )
    return await client.findOne(contact.class.EmployeeAccess, { attachedTo: object._id })
  }

  async function setLimit (on: boolean): Promise<void> {
    const doc = await ensureAccess(on)
    if (doc === undefined || doc.limitEnabled === on) return
    await client.update(doc, { limitEnabled: on })
  }

  async function setMany (field: 'apps' | 'widgets' | 'tools', ids: Array<Ref<Doc>>, checked: boolean): Promise<void> {
    const doc = await ensureAccess()
    if (doc === undefined) return
    const current = new Set(doc[field] ?? [])
    for (const id of ids) {
      if (checked) current.add(id)
      else current.delete(id)
    }
    await client.update(doc, { [field]: Array.from(current) })
  }

  $: nothingTicked =
    (access?.apps?.length ?? 0) === 0 &&
    (access?.widgets?.length ?? 0) === 0 &&
    (access?.tools?.length ?? 0) === 0
</script>

{#if showPanel}
  <div class="access-panel">
    <div class="access-head">
      <div class="access-title">
        <Label label={contact.string.LimitWhatTheySee} />
        <span class="access-hint"><Label label={contact.string.LimitWhatTheySeeHint} /></span>
      </div>
      <Toggle
        on={access?.limitEnabled === true}
        disabled={!canEdit}
        on:change={() => {
          void setLimit(!(access?.limitEnabled === true))
        }}
      />
    </div>
    {#if isSelf && isOwnerOrMaintainer()}
      <p class="access-note"><Label label={contact.string.OwnerAlwaysSeesAll} /></p>
    {/if}
    {#if access?.limitEnabled === true}
      {#if nothingTicked}
        <p class="access-note">
          <Label label={getEmbeddedLabel('Nothing is ticked yet. Tick only what this person should see.')} />
        </p>
      {/if}
      <div class="access-groups">
        <section>
          <h3><Label label={contact.string.LeftSidebar} /></h3>
          {#each appRows as row (row.key)}
            {@const state = selectionState(access?.apps, row.ids)}
            <div
              class="access-row"
              on:click={() => {
                void setMany('apps', row.ids, state !== 'all')
              }}
            >
              <CheckBox
                checked={state !== 'none'}
                symbol={state === 'some' ? 'minus' : 'check'}
                on:value={(event) => {
                  void setMany('apps', row.ids, state === 'some' ? true : event.detail)
                }}
              />
              <span>{row.title}</span>
            </div>
            {#if row.aliases.includes('tools')}
              <div class="access-nest">
                {#each toolGroups as group (group.id)}
                  {@const groupIds = group.tools.flatMap((tool) => tool.ids)}
                  {@const groupState = selectionState(access?.tools, groupIds)}
                  <div
                    class="access-row"
                    on:click={() => {
                      void setMany('tools', groupIds, groupState !== 'all')
                    }}
                  >
                    <CheckBox
                      checked={groupState !== 'none'}
                      symbol={groupState === 'some' ? 'minus' : 'check'}
                      on:value={(event) => {
                        void setMany('tools', groupIds, groupState === 'some' ? true : event.detail)
                      }}
                    />
                    <span class="access-group-name">{group.name}</span>
                  </div>
                  {#each group.tools as tool (tool.key)}
                    {@const toolState = selectionState(access?.tools, tool.ids)}
                    <div
                      class="access-row access-child"
                      on:click={() => {
                        void setMany('tools', tool.ids, toolState !== 'all')
                      }}
                    >
                      <CheckBox
                        checked={toolState === 'all'}
                        on:value={(event) => {
                          void setMany('tools', tool.ids, event.detail)
                        }}
                      />
                      <span>{tool.name}</span>
                    </div>
                  {/each}
                {/each}
              </div>
            {/if}
          {/each}
        </section>
        <section>
          <h3><Label label={contact.string.RightSidebar} /></h3>
          {#each widgetRows as row (row.key)}
            {@const state = selectionState(access?.widgets, row.ids)}
            <div
              class="access-row"
              on:click={() => {
                void setMany('widgets', row.ids, state !== 'all')
              }}
            >
              <CheckBox
                checked={state !== 'none'}
                symbol={state === 'some' ? 'minus' : 'check'}
                on:value={(event) => {
                  void setMany('widgets', row.ids, state === 'some' ? true : event.detail)
                }}
              />
              <span>{row.title}</span>
            </div>
          {/each}
        </section>
      </div>
    {/if}
  </div>
{/if}

<style lang="scss">
  .access-panel {
    margin-top: 1.25rem;
    padding-top: 1rem;
    border-top: 1px solid var(--theme-divider-color);
  }
  .access-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }
  .access-title {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-weight: 500;
    color: var(--theme-caption-color);
  }
  .access-hint,
  .access-note {
    margin: 0.5rem 0 0;
    color: var(--theme-dark-color);
    font-size: 0.75rem;
    font-weight: 400;
  }
  .access-groups {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    margin-top: 1rem;
  }
  h3 {
    margin: 0 0 0.5rem;
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--theme-dark-color);
  }
  .access-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0 0 0.35rem;
    cursor: pointer;
    font-size: 0.8125rem;
  }
  .access-nest {
    margin: 0.15rem 0 0.75rem 0.4rem;
    padding: 0.35rem 0 0.15rem 0.75rem;
    border-left: 1px solid var(--theme-divider-color);
  }
  .access-group-name {
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    color: var(--theme-caption-color);
  }
  .access-child {
    margin-left: 1.35rem;
  }
</style>
