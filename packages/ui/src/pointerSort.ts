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

export function rowIndexFromY (clientY: number, rows: Array<HTMLElement | undefined | null>): number {
  let last = 0
  for (let i = 0; i < rows.length; i++) {
    const rect = rows[i]?.getBoundingClientRect()
    if (rect === undefined) continue
    last = i
    if (clientY < rect.top + rect.height / 2) {
      return i
    }
  }
  return last
}

export function moveItem<T> (items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return items
  }
  const next = [...items]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}
