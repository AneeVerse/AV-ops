<!--
// Copyright © 2022 Hardcore Engineering Inc.
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
-->
<script lang="ts">
  import { WithLookup } from '@hcengineering/core'
  import type { Issue } from '@hcengineering/tracker'
  import { DocNavLink } from '@hcengineering/view-resources'
  import tracker from '../../plugin'
  import ParentNamesPresenter from './ParentNamesPresenter.svelte'

  export let value: WithLookup<Issue> | string | undefined = undefined
  export let object: WithLookup<Issue> | undefined = undefined
  export let shouldUseMargin: boolean = false
  export let showParent: boolean = true
  export let grow: boolean = false
  export let kind: 'list' | undefined = undefined
  export let onClick: (() => void) | undefined = undefined
  export let disabled: boolean = false
  export let maxWidth: string | undefined = undefined
  export let minWidth: string | undefined = '1rem'

  $: issue = (object ?? (typeof value === 'object' && value !== null ? value : undefined)) as WithLookup<Issue> | undefined
  $: titleText = typeof value === 'string' ? value : (issue?.title ?? '')
</script>

{#if issue}
  <span
    class="presenter-label select-text"
    class:with-margin={shouldUseMargin}
    class:list={kind === 'list'}
    style:max-width={maxWidth}
    style:min-width={minWidth}
    class:flex-grow={grow}
    title={titleText}
  >
    <DocNavLink object={issue} {onClick} component={tracker.component.EditIssue} shrink={1} {disabled} colorInherit>
      {titleText}
    </DocNavLink>
  </span>
  {#if showParent && issue.attachedTo}
    <ParentNamesPresenter value={issue} />
  {/if}
  <slot />
{:else if titleText}
  <span
    class="presenter-label select-text"
    class:with-margin={shouldUseMargin}
    class:list={kind === 'list'}
    style:max-width={maxWidth}
    style:min-width={minWidth}
    class:flex-grow={grow}
    title={titleText}
  >
    {titleText}
  </span>
{/if}

<style lang="scss">
  .presenter-label {
    overflow: hidden;
    display: inline-flex;
    align-items: center;
    flex-shrink: 1;

    &.flex-grow {
      flex-shrink: 0.5;
      flex-grow: 1;
    }
  }

  .with-margin {
    margin-left: 0.5rem;
  }
</style>
