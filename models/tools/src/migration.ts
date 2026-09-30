import core, { TxOperations } from '@hcengineering/core'
import {
  tryUpgrade,
  type MigrateOperation,
  type MigrationClient,
  type MigrationUpgradeClient
} from '@hcengineering/model'
import { catalogToolId, TOOL_SITES, toolsId } from '@hcengineering/tools'

import tools from './plugin'

export const toolsOperation: MigrateOperation = {
  async migrate (_client: MigrationClient, _mode): Promise<void> {},
  async upgrade (state: Map<string, Set<string>>, client: () => Promise<MigrationUpgradeClient>, mode): Promise<void> {
    await tryUpgrade(mode, state, client, toolsId, [
      {
        state: 'seed-catalog-tools',
        func: async (upgradeClient) => {
          const tx = new TxOperations(upgradeClient, core.account.System)
          for (let index = 0; index < TOOL_SITES.length; index++) {
            const site = TOOL_SITES[index]
            const _id = catalogToolId(site.id)
            const existing = await tx.findOne(tools.class.Tool, { _id })
            if (existing !== undefined) continue
            await tx.createDoc(
              tools.class.Tool,
              core.space.Workspace,
              {
                name: site.name,
                description: site.description,
                href: site.href,
                host: site.host,
                group: site.group,
                https: site.https,
                current: site.current,
                order: index
              },
              _id
            )
          }
        }
      }
    ])
  }
}
