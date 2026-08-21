//
// Copyright © 2022-2023 Hardcore Engineering Inc.
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

import { Employee, Organization, Person } from '@hcengineering/contact'
import { type ChatMessage } from '@hcengineering/chunter'
import { Folder } from '@hcengineering/drive'
import {
  AttachedDoc,
  Attribute,
  Class,
  MarkupBlobRef,
  CollectionSize,
  Data,
  Doc,
  Markup,
  Mixin,
  Ref,
  RelatedDocument,
  Space,
  Status,
  Timestamp,
  Type,
  type Permission
} from '@hcengineering/core'
import { Asset, IntlString, Plugin, Resource, plugin } from '@hcengineering/platform'
import { Preference } from '@hcengineering/preference'
import { TagCategory, TagElement, TagReference } from '@hcengineering/tags'
import { ToDo } from '@hcengineering/time'
import {
  ProjectType,
  ProjectTypeDescriptor,
  Task,
  Project as TaskProject,
  TaskStatusFactory,
  TaskType,
  TaskTypeDescriptor
} from '@hcengineering/task'
import { AnyComponent, ComponentExtensionId, Location, ResolvedLocation } from '@hcengineering/ui'
import { Action, ActionCategory, IconProps } from '@hcengineering/view'

export * from './analytics'

/**
 * @public
 */
export interface IssueStatus extends Status {}

/**
 * @public
 */
/**
 * Request-level lifecycle on a Tracker Project (AneeVerse: Request = Project).
 * Independent from Issue status / priority / due / assignee.
 * @public
 */
export enum RequestStatus {
  New,
  InProgress,
  WaitingForClient,
  Review,
  Completed,
  Cancelled
}

/**
 * Request-level priority on a Tracker Project. Independent from IssuePriority.
 * @public
 */
export enum RequestPriority {
  Low,
  Normal,
  High,
  Urgent
}

export interface Project extends TaskProject, IconProps {
  identifier: string // Project identifier
  sequence: number
  defaultIssueStatus?: Ref<IssueStatus>
  defaultAssignee?: Ref<Employee>
  defaultTimeReportDay: TimeReportDayType
  company?: Ref<Organization>
  driveFolder?: Ref<Folder>
  productionFolder?: Ref<Folder>
  distributedFolder?: Ref<Folder>
  aneerequestId?: string
  /** Request lifecycle status (not Issue status). */
  requestStatus?: RequestStatus
  /** Request priority (not Issue priority). */
  requestPriority?: RequestPriority
  /** Request due date (not Issue dueDate). */
  requestDueDate?: Timestamp | null
  /** Primary person responsible for the Request (not Issue.assignee / defaultAssignee). */
  requestAssignee?: Ref<Employee> | null
  /** Project-level chat messages (same ChatMessage collection as other ActivityDocs). */
  comments?: CollectionSize<ChatMessage>
}

/**
 * @public
 */
export interface ProjectTargetPreference extends Preference {
  attachedTo: Ref<Project> // tracker.ids.ProjectPreferences

  usedOn: Timestamp

  props?: { key: string, value: any }[]
}

export type RelatedIssueKind = 'classRule' | 'spaceRule'

export interface RelatedClassRule {
  kind: 'classRule'
  ofClass: Ref<Class<Doc>>
}

export interface RelatedSpaceRule {
  kind: 'spaceRule'
  space: Ref<Space>
}

/**
 * @public
 *
 * If defined, will be used to set a default project for this kind of document's related issues.
 */
export interface RelatedIssueTarget extends Doc {
  // Attached to project.
  target?: Ref<Project> | null
  rule: RelatedClassRule | RelatedSpaceRule
}

/**
 * @public
 */
export enum TimeReportDayType {
  CurrentWorkDay = 'CurrentWorkDay',
  PreviousWorkDay = 'PreviousWorkDay'
}

/**
 * @public
 */
export enum IssuePriority {
  NoPriority,
  Urgent,
  High,
  Medium,
  Low
}

/**
 * Dependency kind between two Issues for Gantt scheduling.
 *
 * - `finish-to-start` (FS): A must finish before B can start. Most common.
 * - `start-to-start` (SS): A must start before B can start.
 * - `finish-to-finish` (FF): A must finish before B can finish.
 * - `start-to-finish` (SF): A must start before B can finish. Rare.
 *
 * @public
 */
export type DependencyKind = 'finish-to-start' | 'start-to-start' | 'finish-to-finish' | 'start-to-finish'

/**
 * @public
 */
export enum IssuesGrouping {
  Status = 'status',
  Assignee = 'assignee',
  Priority = 'priority',
  Component = 'component',
  Milestone = 'milestone',
  NoGrouping = '#no_category'
}

/**
 * @public
 */
export enum IssuesOrdering {
  Status = 'status',
  Priority = 'priority',
  LastUpdated = 'modifiedOn',
  DueDate = 'dueDate',
  Manual = 'rank'
}

/**
 * @public
 */
export enum IssuesDateModificationPeriod {
  All = 'all',
  PastWeek = 'pastWeek',
  PastMonth = 'pastMonth'
}

/**
 * @public
 */
export enum MilestoneStatus {
  Planned,
  InProgress,
  Completed,
  Canceled
}

/**
 * @public
 */
export interface Milestone extends Doc {
  label: string
  description?: Markup

  status: MilestoneStatus

  space: Ref<Project>

  comments: number
  attachments?: number

  startDate: Timestamp | null // null = open-ended begin marker
  targetDate: Timestamp
}

/**
 * @public
 */
export interface Issue extends Task {
  attachedTo: Ref<Issue>
  title: string
  description: MarkupBlobRef | null
  status: Ref<IssueStatus>
  priority: IssuePriority

  component: Ref<Component> | null

  // For subtasks
  subIssues: CollectionSize<Issue>
  blockedBy?: RelatedDocument[]
  relations?: RelatedDocument[]
  parents: IssueParentInfo[]

  startDate: Timestamp | null // for Gantt scheduling; null = unscheduled

  space: Ref<Project>

  milestone?: Ref<Milestone> | null

  // Estimation in man hours
  estimation: number

  // Remaining time in man hours
  remainingTime: number

  // ReportedTime time, auto updated using trigger.
  reportedTime: number
  // Collection of reportedTime entries, for proper time estimations per person.
  reports: CollectionSize<TimeSpendReport>

  childInfo: IssueChildInfo[]

  template?: {
    // A template issue is based on
    template: Ref<IssueTemplate>
    // Child id in template
    childId?: string
  }

  todos?: CollectionSize<ToDo>
}

/**
 * @public
 */
export interface IssueDraft {
  kind: Ref<TaskType>
  _id: Ref<Issue>
  title: string
  description: Markup
  status?: Ref<IssueStatus>
  priority: IssuePriority
  assignee: Ref<Person> | null
  component: Ref<Component> | null
  space: Ref<Project>
  startDate: Timestamp | null
  dueDate: Timestamp | null
  milestone?: Ref<Milestone> | null

  // Estimation in man days
  estimation: number
  parentIssue?: Ref<Issue>
  attachments?: number
  labels: TagReference[]
  subIssues: IssueDraft[]
  template?: {
    // A template issue is based on
    template: Ref<IssueTemplate>
    // Child id in template
    childId?: string
  }
}

/**
 * @public
 */
export interface IssueTemplateData {
  title: string
  description: Markup
  priority: IssuePriority

  assignee: Ref<Person> | null
  component: Ref<Component> | null

  milestone?: Ref<Milestone> | null

  // Estimation in man days
  estimation: number

  labels?: Ref<TagElement>[]

  kind?: Ref<TaskType>
}

/**
 * @public
 */
export interface IssueTemplateChild extends IssueTemplateData {
  id: Ref<Issue>
}

/**
 * @public
 */
export interface IssueTemplate extends Doc, IssueTemplateData {
  space: Ref<Project>

  children: IssueTemplateChild[]

  // Discussion stuff
  comments: number
  attachments?: number

  relations?: RelatedDocument[]
}

/**
 * @public
 *
 * Declares time spend entry
 */
export interface TimeSpendReport extends AttachedDoc {
  attachedTo: Ref<Issue>

  employee: Ref<Employee> | null

  date: Timestamp | null
  // Value in man hours
  value: number

  description: string
}

/**
 * @public
 */
export interface IssueParentInfo {
  parentId: Ref<Issue>
  identifier: string
  parentTitle: string
  space: Ref<Space>
}

/**
 * Typed dependency between two Issues, used by the Gantt view to compute
 * cascade scheduling and critical path.
 *
 * Persisted as an AttachedDoc collection 'relations' on the source Issue.
 *
 * @public
 */
export interface IssueRelation extends AttachedDoc<Issue, 'relations'> {
  target: Ref<Issue> // successor
  kind: DependencyKind
  /** Lag in schedule days; can be negative (overlap). */
  lag: number
}

/**
 * @public
 */
export interface IssueChildInfo {
  childId: Ref<Issue>
  estimation: number
  reportedTime: number
}

/**
 * @public
 */
export interface Document extends Doc {
  title: string
  icon: string | null
  color: number
  content?: Markup

  space: Ref<Project>
}

/**
 * @public
 */
export interface Component extends Doc {
  label: string
  description?: Markup
  lead: Ref<Employee> | null
  space: Ref<Project>
  comments: number
  attachments?: number
}

/**
 * @public
 */
export interface ClientFunnel extends TaskProject {
  fullDescription?: Markup
  attachments?: number
}

/**
 * @public
 */
export interface Client extends Task {
  space: Ref<ClientFunnel>
  attachedTo: Ref<Organization>
  status: Ref<Status>
  startDate: Timestamp | null
  title: string
}

/**
 * @public
 */
export const trackerId = 'tracker' as Plugin

const pluginState = plugin(trackerId, {
  class: {
    Project: '' as Ref<Class<Project>>,
    Issue: '' as Ref<Class<Issue>>,
    IssueRelation: '' as Ref<Class<IssueRelation>>,
    IssueTemplate: '' as Ref<Class<IssueTemplate>>,
    Component: '' as Ref<Class<Component>>,
    IssueStatus: '' as Ref<Class<IssueStatus>>,
    TypeIssuePriority: '' as Ref<Class<Type<IssuePriority>>>,
    Milestone: '' as Ref<Class<Milestone>>,
    TypeMilestoneStatus: '' as Ref<Class<Type<MilestoneStatus>>>,
    TypeRequestStatus: '' as Ref<Class<Type<RequestStatus>>>,
    TypeRequestPriority: '' as Ref<Class<Type<RequestPriority>>>,
    TimeSpendReport: '' as Ref<Class<TimeSpendReport>>,
    TypeReportedTime: '' as Ref<Class<Type<number>>>,
    TypeEstimation: '' as Ref<Class<Type<number>>>,
    TypeRemainingTime: '' as Ref<Class<Type<number>>>,
    RelatedIssueTarget: '' as Ref<Class<RelatedIssueTarget>>,
    ProjectTargetPreference: '' as Ref<Class<ProjectTargetPreference>>,
    Client: '' as Ref<Class<Client>>,
    ClientFunnel: '' as Ref<Class<ClientFunnel>>
  },
  mixin: {
    ClassicProjectTypeData: '' as Ref<Mixin<Project>>,
    IssueTypeData: '' as Ref<Mixin<Issue>>,
    DefaultClientFunnelTypeData: '' as Ref<Mixin<ClientFunnel>>,
    ClientTypeData: '' as Ref<Mixin<Client>>
  },
  ids: {
    NoParent: '' as Ref<Issue>,
    IssueDraft: '',
    IssueDraftChild: '',
    ClassingProjectType: '' as Ref<ProjectType>
  },
  status: {
    Backlog: '' as Ref<Status>,
    Todo: '' as Ref<Status>,
    InProgress: '' as Ref<Status>,
    Coding: '' as Ref<Status>,
    UnderReview: '' as Ref<Status>,
    Done: '' as Ref<Status>,
    Canceled: '' as Ref<Status>
  },
  component: {
    Tracker: '' as AnyComponent,
    TrackerApp: '' as AnyComponent,
    RelatedIssues: '' as AnyComponent,
    RelatedIssuesSection: '' as AnyComponent,
    RelatedIssueSelector: '' as AnyComponent,
    RelatedIssueTemplates: '' as AnyComponent,
    EditIssue: '' as AnyComponent,
    CreateIssue: '' as AnyComponent,
    ProjectPresenter: '' as AnyComponent,
    CreateIssueTemplate: '' as AnyComponent,
    CreateProject: '' as AnyComponent,
    IssueStatusPresenter: '' as AnyComponent,
    LabelsView: '' as AnyComponent
  },
  attribute: {
    IssueStatus: '' as Ref<Attribute<Status>>,
    ClientState: '' as Ref<Attribute<Status>>
  },
  icon: {
    TrackerApplication: '' as Asset,
    Component: '' as Asset,
    Issue: '' as Asset,
    Subissue: '' as Asset,
    Project: '' as Asset,
    Relations: '' as Asset,
    Inbox: '' as Asset,
    MyIssues: '' as Asset,
    Views: '' as Asset,
    Issues: '' as Asset,
    Components: '' as Asset,
    NewIssue: '' as Asset,
    Magnifier: '' as Asset,
    Labels: '' as Asset,
    DueDate: '' as Asset,
    Parent: '' as Asset,
    UnsetParent: '' as Asset,
    Milestone: '' as Asset,
    IssueTemplates: '' as Asset,
    Start: '' as Asset,
    Stop: '' as Asset,

    CategoryBacklog: '' as Asset,
    CategoryUnstarted: '' as Asset,
    CategoryStarted: '' as Asset,
    CategoryCompleted: '' as Asset,
    CategoryCanceled: '' as Asset,

    PriorityNoPriority: '' as Asset,
    PriorityUrgent: '' as Asset,
    PriorityHigh: '' as Asset,
    PriorityMedium: '' as Asset,
    PriorityLow: '' as Asset,

    ComponentsList: '' as Asset,

    MilestoneStatusPlanned: '' as Asset,
    MilestoneStatusInProgress: '' as Asset,
    MilestoneStatusPaused: '' as Asset,
    MilestoneStatusCompleted: '' as Asset,
    MilestoneStatusCanceled: '' as Asset,

    CopyBranch: '' as Asset,
    Duplicate: '' as Asset,

    TimeReport: '' as Asset,
    Estimation: '' as Asset,

    // Project icons
    Home: '' as Asset,
    RedCircle: '' as Asset
  },
  category: {
    Other: '' as Ref<TagCategory>,
    Tracker: '' as Ref<ActionCategory>
  },
  descriptors: {
    ProjectType: '' as Ref<ProjectTypeDescriptor>,
    Issue: '' as Ref<TaskTypeDescriptor>,
    ClientFunnelType: '' as Ref<ProjectTypeDescriptor>,
    Client: '' as Ref<TaskTypeDescriptor>
  },
  action: {
    CopyAsMarkdownTable: '' as Ref<Action<Doc, any>>,
    SetDueDate: '' as Ref<Action<Doc, any>>,
    SetParent: '' as Ref<Action<Doc, any>>,
    SetStatus: '' as Ref<Action>,
    SetPriority: '' as Ref<Action<Doc, any>>,
    SetAssignee: '' as Ref<Action<Doc, any>>,
    SetComponent: '' as Ref<Action<Doc, any>>,
    CopyIssueId: '' as Ref<Action<Doc, any>>,
    CopyIssueTitle: '' as Ref<Action<Doc, any>>,
    CopyIssueLink: '' as Ref<Action<Doc, any>>,
    MoveToProject: '' as Ref<Action>,
    Duplicate: '' as Ref<Action<Doc, any>>,
    Relations: '' as Ref<Action<Doc, any>>,
    NewIssue: '' as Ref<Action<Doc, any>>,
    NewIssueGlobal: '' as Ref<Action<Doc, any>>,
    NewSubIssue: '' as Ref<Action<Doc, any>>,
    EditWorkflowStatuses: '' as Ref<Action>,
    EditProject: '' as Ref<Action>,
    SetMilestone: '' as Ref<Action<Doc, any>>,
    SetLabels: '' as Ref<Action<Doc, any>>,
    EditRelatedTargets: '' as Ref<Action<Doc, any>>,
    UnsetParent: '' as Ref<Action<Doc, any>>
  },
  project: {
    DefaultProject: '' as Ref<Project>
  },
  space: {
    DefaultClientFunnel: '' as Ref<ClientFunnel>
  },
  template: {
    DefaultClientFunnel: '' as Ref<ProjectType>
  },
  clientStatus: {
    Backlog: '' as Ref<Status>,
    Incoming: '' as Ref<Status>,
    Negotiation: '' as Ref<Status>,
    OfferPreparing: '' as Ref<Status>,
    MakeADecision: '' as Ref<Status>,
    ContractConclusion: '' as Ref<Status>,
    Won: '' as Ref<Status>,
    Lost: '' as Ref<Status>
  },
  resolver: {
    Location: '' as Resource<(loc: Location) => Promise<ResolvedLocation | undefined>>,
    CompanyLocation: '' as Resource<(loc: Location) => Promise<ResolvedLocation | undefined>>
  },
  string: {
    TrackerApplication: '' as IntlString,
    ConfigLabel: '' as IntlString,
    NewRelatedIssue: '' as IntlString,
    IssueNotificationTitle: '' as IntlString,
    IssueNotificationBody: '' as IntlString,
    IssueNotificationChanged: '' as IntlString,
    IssueNotificationChangedProperty: '' as IntlString,
    IssueNotificationMessage: '' as IntlString,
    IssueAssignedToYou: '' as IntlString,
    Project: '' as IntlString,
    RelatedIssues: '' as IntlString,
    Issue: '' as IntlString,
    IssueStartDate: '' as IntlString,
    GanttDependency: '' as IntlString,
    GanttLag: '' as IntlString,
    NewProject: '' as IntlString,
    UnsetParentIssue: '' as IntlString,
    ForbidCreateProjectPermission: '' as IntlString,
    ForbidCreateProjectPermissionDescription: '' as IntlString,
    Client: '' as IntlString,
    Clients: '' as IntlString,
    ClientFunnel: '' as IntlString,
    ForbidCreateClientFunnelPermission: '' as IntlString,
    ForbidCreateClientFunnelPermissionDescription: '' as IntlString
  },
  extensions: {
    IssueListHeader: '' as ComponentExtensionId,
    EditIssueHeader: '' as ComponentExtensionId,
    EditIssueTitle: '' as ComponentExtensionId
  },
  taskTypes: {
    Issue: '' as Ref<TaskType>,
    SubIssue: '' as Ref<TaskType>,
    Client: '' as Ref<TaskType>
  },
  permission: {
    ForbidCreateProject: '' as Ref<Permission>,
    ForbidCreateClientFunnel: '' as Ref<Permission>
  }
})
export default pluginState

/**
 * @public
 */
export function createStatesData (data: TaskStatusFactory[]): Omit<Data<Status>, 'rank'>[] {
  const states: Omit<Data<Status>, 'rank'>[] = []

  for (const category of data) {
    for (const sName of category.statuses) {
      states.push({
        ofAttribute: pluginState.attribute.IssueStatus,
        name: Array.isArray(sName) ? sName[0] : sName,
        color: Array.isArray(sName) ? sName[1] : undefined,
        category: category.category
      })
    }
  }
  return states
}
