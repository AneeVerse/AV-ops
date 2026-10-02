import { type Resources } from '@hcengineering/platform'

import ToolsDirectory from './components/ToolsDirectory.svelte'
import ToolEditor from './components/ToolEditor.svelte'
import GroupEditor from './components/GroupEditor.svelte'
import ToolViewerModal from './components/ToolViewerModal.svelte'
import EmbeddedToolView from './components/EmbeddedToolView.svelte'

export default async (): Promise<Resources> => ({
  component: {
    ToolsDirectory,
    CreateTool: ToolEditor,
    EditTool: ToolEditor,
    GroupEditor,
    ToolViewerModal,
    EmbeddedToolView
  }
})
