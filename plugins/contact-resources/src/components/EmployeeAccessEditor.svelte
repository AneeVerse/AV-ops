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
  import { getEmbeddedLabel } from '@hcengineering/platform'
  import { createQuery, getClient } from '@hcengineering/presentation'
  import { CheckBox, Label, Toggle } from '@hcengineering/ui'
  import workbench, { type Application, type Widget } from '@hcengineering/workbench'

  import contact from '../plugin'

  export let object: Person

  /** Avoid a contact-resources → tools package link; class id is stable. */
  const TOOL_CLASS = 'tools:class:Tool' as Ref<Class<Doc>>

  const FALLBACK_TOOLS: Array<{ _id: Ref<Doc>, name: string }> = [
    ['cultura', 'Cultura Jewels'],
    ['aneeverse', 'Aneeverse'],
    ['studio', 'ContentBeta Studio'],
    ['n8n', 'n8n'],
    ['erp', 'ERPNext'],
    ['crm', 'CRM'],
    ['sales1', 'Sales 1'],
    ['chat', 'OpenClaw Chat'],
    ['bot', 'OpenClaw Gateway'],
    ['sales-ui', 'Sales UI'],
    ['bots', 'Jewelry Gemini'],
    ['jwel-img', 'Jewelry Image Gen'],
    ['md', 'Obsidian'],
    ['scrape', 'ScrapeGraphAI']
  ].map(([id, name]) => ({
    _id: `tools:tool:${id}` as Ref<Doc>,
    name
  }))

  const client = getClient()
  const canEdit = isOwnerOrMaintainer()
  const selfId = getCurrentEmployee()

  const accessQuery = createQuery()
  const toolsQuery = createQuery()

  let access: EmployeeAccess | undefined
  let toolsList: Array<{ _id: Ref<Doc>, name: string }> = []

  $: isEmployee = client.getHierarchy().hasMixin(object, contact.mixin.Employee)
  $: showPanel = canEdit && isEmployee && client.getHierarchy().hasClass(contact.class.EmployeeAccess)
  $: isSelf = object._id === selfId

  $: if (showPanel && client.getHierarchy().hasClass(contact.class.EmployeeAccess)) {
    accessQuery.query(contact.class.EmployeeAccess, { attachedTo: object._id }, (res) => {
      access = res[0]
    })
  } else {
    accessQuery.unsubscribe()
    access = undefined
  }

  $: if (showPanel && client.getHierarchy().hasClass(TOOL_CLASS)) {
    toolsQuery.query(TOOL_CLASS, {}, (res) => {
      toolsList = res
        .map((doc) => ({ _id: doc._id, name: String((doc as Doc & { name?: string }).name ?? doc._id) }))
        .sort((a, b) => a.name.localeCompare(b.name))
    })
  } else {
    toolsQuery.unsubscribe()
    toolsList = []
  }

  const applications = client
    .getModel()
    .findAllSync<Application>(workbench.class.Application, { hidden: false })
    .slice()
    .sort((a, b) => a.alias.localeCompare(b.alias))

  const modelWidgets = client.getModel().findAllSync<Widget>(workbench.class.Widget, {})
  const extraWidgets: Array<Pick<Widget, '_id' | 'label' | 'icon'>> = [
    {
      _id: workbench.ids.NovinoChatWidget,
      label: getEmbeddedLabel('Novino'),
      icon: workbench.icon.Novino
    },
    {
      _id: workbench.ids.VpsFoldersWidget,
      label: getEmbeddedLabel('VPS'),
      icon: workbench.icon.Vps
    }
  ]
  const widgets = [...modelWidgets, ...extraWidgets.filter((w) => !modelWidgets.some((m) => m._id === w._id))]

  $: toolChoices = toolsList.length > 0 ? toolsList : FALLBACK_TOOLS

  function isChecked (list: Array<Ref<Doc>> | undefined, id: Ref<Doc>): boolean {
    return (list ?? []).includes(id)
  }

  async function ensureAccess (): Promise<EmployeeAccess | undefined> {
    if (access !== undefined) return access
    if (!showPanel) return undefined
    await client.addCollection(
      contact.class.EmployeeAccess,
      core.space.Workspace,
      object._id,
      contact.mixin.Employee,
      'access',
      {
        limitEnabled: false,
        apps: applications.map((app) => app._id),
        widgets: widgets.map((widget) => widget._id),
        tools: toolChoices.map((tool) => tool._id)
      }
    )
    return await client.findOne(contact.class.EmployeeAccess, { attachedTo: object._id })
  }

  async function setLimit (on: boolean): Promise<void> {
    const doc = await ensureAccess()
    if (doc === undefined) return
    const patch: Partial<EmployeeAccess> = { limitEnabled: on }
    if (on && doc.apps.length === 0 && doc.widgets.length === 0 && doc.tools.length === 0) {
      patch.apps = applications.map((app) => app._id)
      patch.widgets = widgets.map((widget) => widget._id)
      patch.tools = toolChoices.map((tool) => tool._id)
    }
    await client.update(doc, patch)
  }

  async function setId (field: 'apps' | 'widgets' | 'tools', id: Ref<Doc>, checked: boolean): Promise<void> {
    const doc = await ensureAccess()
    if (doc === undefined) return
    const current = doc[field] ?? []
    const next = checked ? Array.from(new Set([...current, id])) : current.filter((item) => item !== id)
    await client.update(doc, { [field]: next })
  }
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
      <div class="access-groups">
        <section>
          <h3><Label label={contact.string.LeftSidebar} /></h3>
          {#each applications as app (app._id)}
            <label class="access-row">
              <CheckBox
                checked={isChecked(access?.apps, app._id)}
                on:value={(event) => {
                  void setId('apps', app._id, event.detail)
                }}
              />
              <Label label={app.label} />
            </label>
          {/each}
        </section>
        <section>
          <h3><Label label={contact.string.RightSidebar} /></h3>
          {#each widgets as widget (widget._id)}
            <label class="access-row">
              <CheckBox
                checked={isChecked(access?.widgets, widget._id)}
                on:value={(event) => {
                  void setId('widgets', widget._id, event.detail)
                }}
              />
              <Label label={widget.label} />
            </label>
          {/each}
        </section>
        <section>
          <h3><Label label={contact.string.ToolsAccess} /></h3>
          {#each toolChoices as tool (tool._id)}
            <label class="access-row">
              <CheckBox
                checked={isChecked(access?.tools, tool._id)}
                on:value={(event) => {
                  void setId('tools', tool._id, event.detail)
                }}
              />
              <span>{tool.name}</span>
            </label>
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
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
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
</style>
