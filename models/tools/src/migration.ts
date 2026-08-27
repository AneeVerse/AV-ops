import { type MigrateOperation, type MigrationClient, type MigrationUpgradeClient } from '@hcengineering/model'

export const toolsOperation: MigrateOperation = {
  async migrate (client: MigrationClient, mode): Promise<void> {},
  async upgrade (state: Map<string, Set<string>>, client: () => Promise<MigrationUpgradeClient>, mode): Promise<void> {}
}
