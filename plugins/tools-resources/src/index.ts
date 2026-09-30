import { type Resources } from '@hcengineering/platform'

import ToolsDirectory from './components/ToolsDirectory.svelte'
import ToolEditor from './components/ToolEditor.svelte'

export default async (): Promise<Resources> => ({
  component: {
    ToolsDirectory,
    CreateTool: ToolEditor,
    EditTool: ToolEditor
  }
})
