import { type Resources } from '@hcengineering/platform'

import ToolsDirectory from './components/ToolsDirectory.svelte'

export default async (): Promise<Resources> => ({
  component: {
    ToolsDirectory
  }
})
