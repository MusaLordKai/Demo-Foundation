export type Role = "APPLICANT" | "REVIEWER";

export type Status = "DRAFT" | "IN_REVIEW" | "APPROVED" | "REJECTED";

export const STATUSES: Status[] = ["DRAFT", "IN_REVIEW", "APPROVED", "REJECTED"];

export type LogCategory = "SYSTEM" | "CASE";

export const CATEGORIES = ["SPORT", "TECHNOLOGY", "GENERAL_EDUCATION", "QUALITY_OF_LIFE"] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  SPORT: "Sport",
  TECHNOLOGY: "Technology",
  GENERAL_EDUCATION: "General Education",
  QUALITY_OF_LIFE: "Quality of Life",
};

export type GrantStatus = "OPEN" | "CLOSED";

export type Folder = "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "REVERTED" | "APPROVED" | "REJECTED";

export const FOLDERS: { key: Folder; label: string }[] = [
  { key: "DRAFT", label: "Draft" },
  { key: "SUBMITTED", label: "Submitted" },
  { key: "UNDER_REVIEW", label: "Under review" },
  { key: "REVERTED", label: "Reverted" },
  { key: "APPROVED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
];

/** Paginated response envelope (reviewer queue search/pagination). */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface Person {
  id: string;
  name: string;
  email: string;
}

export interface WorkflowStep {
  id: string;
  name: string;
  position: number;
}

export interface GrantDocument {
  id: string;
  filename: string;
  mime: string;
  size: number;
  createdAt: string;
}

export interface Grant {
  id: string;
  name: string;
  shortCode: string;
  category: Category;
  description: string;
  fundsAllocated: string;
  openUntil: string;
  status: GrantStatus;
  applicationCount: number;
  documents: GrantDocument[];
  steps: WorkflowStep[];
  createdAt: string;
  updatedAt: string;
}

export interface GrantInput {
  name: string;
  shortCode: string;
  category: Category;
  description: string;
  fundsAllocated: number;
  openUntil: string;
}

export interface GrantSummary {
  id: string;
  name: string;
  shortCode: string;
  category: Category;
  fundsAllocated: string;
  openUntil: string;
  status: GrantStatus;
}

export interface CaseLogEntry {
  id: string;
  action: string;
  fromStep: string | null;
  toStep: string | null;
  fromStatus: Status | null;
  toStatus: Status;
  comment: string | null;
  actor: Person | null;
  createdAt: string;
}

export interface LogEntry extends CaseLogEntry {
  category: LogCategory;
  caseNumber: string | null;
  message: string | null;
}

export interface Attachment {
  filename: string | null;
  mime: string | null;
  size: number | null;
}

export interface Application {
  id: string;
  caseNumber: string;
  folder: Folder;
  title: string;
  category: Category;
  description: string;
  amount: string;
  needBy: string;
  status: Status;
  grantId: string;
  grant: GrantSummary | null;
  currentStep: WorkflowStep | null;
  ownerId: string;
  owner: Person | null;
  reviewerId: string | null;
  reviewer: Person | null;
  attachment: Attachment | null;
  createdAt: string;
  updatedAt: string;
  // Detail-only:
  workflow?: WorkflowStep[];
  currentStepIndex?: number | null;
  caseLog?: CaseLogEntry[];
}

/** Create payload — applies to a chosen grant. */
export interface ApplicationInput {
  grantId: string;
  title?: string;
  description: string;
  amount: number;
  needBy: string;
}

/** Edit payload — grant/category are fixed after creation. */
export interface ApplicationUpdate {
  title?: string;
  description: string;
  amount: number;
  needBy: string;
}

export type ReviewerAction = "advance" | "return" | "reject";
