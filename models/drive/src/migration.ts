//
// Copyright © 2024 Hardcore Engineering Inc.
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

import core, { DOMAIN_SPACE, type Blob, type Ref, DOMAIN_BLOB, generateId, toIdMap } from '@hcengineering/core'
import { COMPANIES_DRIVE_NAME, INTERNAL_FOLDER_NAME, type Drive, type File, type FileVersion, type Folder, type Resource } from '@hcengineering/drive'
import {
  type MigrateOperation,
  type MigrationClient,
  type MigrationUpgradeClient,
  tryMigrate,
  tryUpgrade
} from '@hcengineering/model'

import drive, { DOMAIN_DRIVE, driveId } from './index'

const COMPANIES_DRIVE_ID = 'drive:space:Companies' as Ref<Drive>
const INTERNAL_FOLDER_ID = 'drive:folder:Internal' as Ref<Folder>

async function ensureCompaniesDriveSpace (client: MigrationClient): Promise<void> {
  const existing = await client.find<Drive>(DOMAIN_SPACE, {
    _class: drive.class.Drive,
    name: COMPANIES_DRIVE_NAME
  })
  if (existing.some((d) => d._id === COMPANIES_DRIVE_ID || d.name === COMPANIES_DRIVE_NAME)) {
    const internal = await client.find<Folder>(DOMAIN_DRIVE, {
      _id: INTERNAL_FOLDER_ID,
      _class: drive.class.Folder
    })
    if (internal.length === 0) {
      const driveDoc = existing.find((d) => d.name === COMPANIES_DRIVE_NAME) ?? existing[0]
      await client.create(DOMAIN_DRIVE, {
        _id: INTERNAL_FOLDER_ID,
        _class: drive.class.Folder,
        space: driveDoc._id,
        title: INTERNAL_FOLDER_NAME,
        parent: drive.ids.Root,
        path: [],
        modifiedBy: core.account.System,
        modifiedOn: Date.now(),
        createdBy: core.account.System,
        createdOn: Date.now()
      } as Folder)
    }
    return
  }

  await client.create(DOMAIN_SPACE, {
    _id: COMPANIES_DRIVE_ID,
    _class: drive.class.Drive,
    space: core.space.Space,
    name: COMPANIES_DRIVE_NAME,
    description: 'Company and project files',
    private: false,
    archived: false,
    members: [],
    owners: [],
    autoJoin: true,
    restricted: false,
    type: drive.spaceType.DefaultDrive,
    modifiedBy: core.account.System,
    modifiedOn: Date.now(),
    createdBy: core.account.System,
    createdOn: Date.now()
  } as Drive)

  await client.create(DOMAIN_DRIVE, {
    _id: INTERNAL_FOLDER_ID,
    _class: drive.class.Folder,
    space: COMPANIES_DRIVE_ID,
    title: INTERNAL_FOLDER_NAME,
    parent: drive.ids.Root,
    path: [],
    modifiedBy: core.account.System,
    modifiedOn: Date.now(),
    createdBy: core.account.System,
    createdOn: Date.now()
  } as Folder)
}

async function migrateFileVersions (client: MigrationClient): Promise<void> {
  type ExFile = Omit<File, 'file'> & {
    file: Ref<Blob>
    metadata?: Record<string, any>
  }

  const files = await client.find<File>(DOMAIN_DRIVE, {
    _class: drive.class.File,
    version: { $exists: false }
  })

  const blobIds = files.map((p) => (p as unknown as ExFile).file)
  const blobs = await client.find<Blob>(DOMAIN_BLOB, { _id: { $in: blobIds }, _class: core.class.Blob })
  const blobsById = toIdMap(blobs)

  for (const file of files) {
    const exfile = file as unknown as ExFile

    const blob = blobsById.get(exfile.file)
    if (blob === undefined) continue

    const fileVersionId: Ref<FileVersion> = generateId()

    await client.create<FileVersion>(DOMAIN_DRIVE, {
      _id: fileVersionId,
      _class: drive.class.FileVersion,
      attachedTo: file._id,
      attachedToClass: file._class,
      collection: 'versions',
      modifiedOn: file.modifiedOn,
      modifiedBy: file.modifiedBy,
      space: file.space,
      title: exfile.title,
      file: blob._id,
      size: blob.size,
      lastModified: blob.modifiedOn,
      type: blob.contentType,
      metadata: exfile.metadata,
      version: 1
    })

    await client.update<File>(
      DOMAIN_DRIVE,
      {
        _id: file._id,
        _class: file._class
      },
      {
        version: 1,
        versions: 1,
        file: fileVersionId,
        $unset: {
          metadata: 1
        }
      }
    )
  }
}

async function renameFields (client: MigrationClient): Promise<void> {
  const resources = await client.find<Resource>(DOMAIN_DRIVE, {
    _class: { $in: [drive.class.Resource, drive.class.File, drive.class.Folder] },
    name: { $exists: true }
  })

  for (const resource of resources) {
    await client.update(
      DOMAIN_DRIVE,
      { _id: resource._id },
      {
        $rename: {
          name: 'title'
        }
      }
    )
  }

  const versions = await client.find<FileVersion>(DOMAIN_DRIVE, {
    _class: drive.class.FileVersion,
    name: { $exists: true }
  })

  for (const version of versions) {
    await client.update(
      DOMAIN_DRIVE,
      { _id: version._id },
      {
        $rename: {
          name: 'title'
        }
      }
    )
  }
}

export const driveOperation: MigrateOperation = {
  async migrate (client: MigrationClient, mode): Promise<void> {
    await tryMigrate(mode, client, driveId, [
      {
        state: 'companies-drive',
        func: ensureCompaniesDriveSpace
      },
      {
        state: 'file-versions',
        func: migrateFileVersions
      },
      {
        state: 'renameFields',
        func: renameFields
      }
    ])
  },

  async upgrade (state: Map<string, Set<string>>, client: () => Promise<MigrationUpgradeClient>, mode): Promise<void> {
    await tryUpgrade(mode, state, client, driveId, [])
  }
}
