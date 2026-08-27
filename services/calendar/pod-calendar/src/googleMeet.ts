//
// Copyright © 2026 AneeVerse.
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

import { Event, getMeetingJoinUrl, isGoogleMeetPlaceholder } from '@hcengineering/calendar'
import { calendar_v3 } from 'googleapis'

export function googleMeetUrl (event: calendar_v3.Schema$Event): string | undefined {
  if (event.hangoutLink != null && event.hangoutLink !== '') {
    return event.hangoutLink
  }
  const entries = event.conferenceData?.entryPoints ?? []
  const video = entries.find((p) => p.entryPointType === 'video') ?? entries[0]
  if (video?.uri != null && video.uri !== '') {
    return video.uri
  }
  return getMeetingJoinUrl(event.location, event.description)
}

export function eventLocationFromGoogle (event: calendar_v3.Schema$Event): string | undefined {
  const meet = googleMeetUrl(event)
  if (meet != null) return meet
  const loc = event.location?.trim()
  return loc !== '' ? loc : undefined
}

export function wantsGoogleMeet (event: Event): boolean {
  if (event.allDay) return false
  if (getMeetingJoinUrl(event.location, event.description) !== undefined) return false
  return isGoogleMeetPlaceholder(event.location)
}

export function applyConferenceCreateRequest (
  body: calendar_v3.Schema$Event,
  event: Event
): calendar_v3.Schema$Event {
  if (!wantsGoogleMeet(event)) return body
  body.conferenceData = {
    createRequest: {
      requestId: `${event._id}`,
      conferenceSolutionKey: { type: 'hangoutsMeet' }
    }
  }
  if (isGoogleMeetPlaceholder(event.location)) {
    delete body.location
  }
  return body
}

export function googleEventIdIsValid (id: string | undefined): boolean {
  return id != null && /^[a-v0-9]{5,1024}$/.test(id)
}
