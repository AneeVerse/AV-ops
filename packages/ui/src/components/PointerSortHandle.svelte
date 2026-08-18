<!--
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
-->
<script lang="ts">
  import IconCircles from './icons/Circles.svelte'

  export let disabled: boolean = false
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
  class="pointer-sort-handle"
  class:disabled
  class:grab={!disabled}
  on:pointerdown
  on:click|stopPropagation
>
  <IconCircles size={'small'} />
</div>

<style lang="scss">
  .pointer-sort-handle {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 1.5rem;
    height: 2.25rem;
    opacity: 0.45;
    touch-action: none;

    &.grab {
      cursor: grab;
    }
    &.grab:active {
      cursor: grabbing;
    }
    &:hover:not(.disabled) {
      opacity: 1;
    }
    &.disabled {
      opacity: 0.2;
      cursor: default;
      pointer-events: none;
    }
  }
</style>
