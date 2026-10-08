//
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
//

import { findProperty, resultSort } from '../query'
import core from '../component'
import type { Hierarchy } from '../hierarchy'
import type { MemDb } from '../memdb'
import { SortingOrder } from '../storage'
import type { Doc, Ref, Class } from '../classes'

function doc (id: string, fields: Record<string, any> = {}): Doc {
  const doc: Doc = { _id: id as Ref<Doc>, _class: 'test:class:Issue' as Ref<Class<Doc>>, ...fields } as any
  return doc
}

describe('findProperty', () => {
  const assigned1 = doc('i1', { assignee: 'person:1' })
  const assigned2 = doc('i2', { assignee: 'person:2' })
  const unassigned = doc('i3', { assignee: null })
  const missingField = doc('i4')
  const allDocs = [assigned1, assigned2, unassigned, missingField]

  it('should match a specific value', () => {
    const result = findProperty(allDocs, 'assignee', 'person:1')
    expect(result).toEqual([assigned1])
  })

  it('should match null to docs with null or missing field', () => {
    const result = findProperty(allDocs, 'assignee', null)
    expect(result).toEqual([unassigned, missingField])
  })

  it('should match undefined to docs with null or missing field', () => {
    const result = findProperty(allDocs, 'assignee', undefined)
    expect(result).toEqual([unassigned, missingField])
  })

  describe('JSON round-trip (simulates server query)', () => {
    it('null survives JSON serialization and filters correctly', () => {
      const query = { assignee: null }
      const roundTripped = JSON.parse(JSON.stringify(query))
      expect(roundTripped).toHaveProperty('assignee')

      const result = findProperty(allDocs, 'assignee', roundTripped.assignee)
      expect(result).toEqual([unassigned, missingField])
    })

    it('undefined is stripped by JSON serialization, losing the filter', () => {
      const query = { assignee: undefined }
      const roundTripped = JSON.parse(JSON.stringify(query))
      expect(roundTripped).not.toHaveProperty('assignee')

      // Without the 'assignee' key, matchQuery iterates only the remaining keys
      // and never calls findProperty for assignee, so all docs pass through.
      // This is the root cause of #10606.
    })
  })
})

describe('live-query date ordering', () => {
  const hierarchy = {
    findAttribute: (_class: unknown, key: string) => ({
      type: { _class: key === 'dueDate' ? core.class.TypeDate : core.class.TypeNumber },
      attributeOf: 'test:class:Issue'
    }),
    isMixin: () => false
  } as unknown as Hierarchy
  const modelDb = {} as MemDb
  const clazz = 'test:class:Issue' as Ref<Class<Doc>>
  const rows = (): Doc[] => [doc('missing'), doc('later', { dueDate: 20 }), doc('null', { dueDate: null }), doc('early', { dueDate: 10 })]

  it('keeps dated tasks ahead of null and missing dates', () => {
    const docs = rows()
    resultSort(docs, { dueDate: SortingOrder.Ascending }, clazz, hierarchy, modelDb)
    expect(docs.map((d) => d._id)).toEqual(['early', 'later', 'missing', 'null'])
  })

  it('honors descending order', () => {
    const docs = rows()
    resultSort(docs, { dueDate: SortingOrder.Descending }, clazz, hierarchy, modelDb)
    expect(docs.map((d) => d._id)).toEqual(['later', 'early', 'missing', 'null'])
  })

  it('moves a task into date order when a live update sets its due date', () => {
    const docs = rows()
    Object.assign(docs[0], { dueDate: 5 })
    resultSort(docs, { dueDate: SortingOrder.Ascending }, clazz, hierarchy, modelDb)
    expect(docs.map((d) => d._id)).toEqual(['missing', 'early', 'later', 'null'])
  })

  it('uses the secondary sort when dates match or are missing', () => {
    const docs = [doc('b', { dueDate: 10, priority: 2 }), doc('a', { dueDate: 10, priority: 1 }), doc('d', { priority: 2 }), doc('c', { dueDate: null, priority: 1 })]
    resultSort(docs, { dueDate: SortingOrder.Ascending, priority: SortingOrder.Ascending }, clazz, hierarchy, modelDb)
    expect(docs.map((d) => d._id)).toEqual(['a', 'b', 'c', 'd'])
  })
})
