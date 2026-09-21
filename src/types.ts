export type OpsStatus = string;

export type RegionName =
  | 'South Central'
  | 'NOCAL'
  | 'SOCAL'
  | 'South East'
  | 'Florida'
  | 'NYC'
  | 'NYS'
  | 'Mid West'
  | 'Northeast'
  | 'Mid Atlantic'
  | 'Maine';

export const REGIONS: RegionName[] = [
  'South Central',
  'NOCAL',
  'SOCAL',
  'South East',
  'Florida',
  'NYC',
  'NYS',
  'Mid West',
  'Northeast',
  'Mid Atlantic',
  'Maine',
];

export type ScheduleStatus =
  | ''
  | 'SCHEDULE SENT'
  | 'PENDING'
  | 'Schedule Sent'
  | 'Needs Scheduling'
  | 'Draft'
  | 'Sent -Checked by Ops'
  | string;

export type StudyType =
  | 'TMC'
  | 'ATR'
  | 'ATR (Camera)'
  | 'Screenline'
  | 'Video Review'
  | 'LADOTD Annual Counts'
  | string;

export type EquipmentType = 'Camera' | 'Machine';

export type WeekDay =
  | 'Sunday'
  | 'Monday'
  | 'Tuesday'
  | 'Wednesday'
  | 'Thursday'
  | 'Friday'
  | 'Saturday';

export interface Project {
  id: string; // Project # e.g. "26-460061"
  cityState: string; // e.g. "Manor, TX"
  opsStatus: OpsStatus; // Project Status (aligned with CSV)
  scheduleStatus: ScheduleStatus; // Schedule Status (SCHEDULE SENT, PENDING, or blank)
  version: '' | 'INITIAL' | 'v1' | 'v2' | 'v3' | 'v4' | 'v5' | 'v6' | string; // Version
  dateSent?: string; // e.g. "9/9/2026 3:07 AM" (Synced with Ops Audit Date from CSV)
  opsAuditDate?: string; // Ops Audit Date from CSV
  studyType: StudyType;
  locationId?: string; // Designated Location ID(s) e.g. "001" or "LOC-01"
  locationIds?: string[]; // Synced list of Location IDs for this Project ID from CSV
  locationsCount: number;
  equipmentCount: number; // No. of Equipment / Camera / Machine Units
  techUnits?: Record<string, number>; // Total units breakdown per assigned technician from CSV
  techLocations?: Record<string, string[]>; // Designated Location IDs per assigned technician from CSV
  equipmentType?: EquipmentType; // Camera or Machine
  collectionWindow: string; // e.g. "9/1 (CRD)" or "(9/1) 9/2 or 9/3"
  collectionDay?: string; // e.g. "9/1", "9/2-9/3", "9/3"
  installDay: WeekDay | '';
  teardownDay: WeekDay | '';
  batterySwapDay?: WeekDay | '';
  batterySwapDays?: WeekDay[]; // All scheduled battery swap days
  batterySwapDates?: string[]; // All scheduled battery swap calendar dates e.g. ['9/16', '9/18', '9/20']
  consecutiveCollectionDays?: number; // e.g. 3, 7 (collecting 3 or more consecutive days)
  isCancelled?: boolean;
  technician: string; // single assigned technician
  evaluatedBy?: string; // e.g. "Patrick", "Kat", "Kyle"
  urgency?: 'Priority Client' | 'ASAP' | 'Standard';
  dueDate?: string;
  deliverVideo?: boolean;
  schedulerNotes?: string;
  leadSchedulerNotes?: string;
  analystNotes?: string;
  serviceTypeAddOns?: string;
  specialBadge?: 'COD' | null;
  group?: 'COD' | 'PRIORITY' | string | null; // Option to assign projects to groups like COD
  codList?: string; // e.g. "List-107", "List-108", etc.
  region?: RegionName; // Operational Region: South Central, NOCAL, SOCAL, Florida, etc.
  workWeek?: string; // e.g. "2026-W36" for separate weekly sheets
  lastUpdated?: string;
}

export interface WorkWeekSheet {
  id: string; // e.g. "2026-W36"
  label: string; // e.g. "Week 36 (Aug 31 - Sep 6, 2026)"
  shortLabel: string; // e.g. "Aug 31 - Sep 6"
  weekNumber: number; // e.g. 36
  startDate: string; // e.g. "2026-08-30"
  endDate: string; // e.g. "2026-09-05"
  isCurrent?: boolean;
  dateColumns?: DateColumn[];
}

export interface Technician {
  id: string;
  name: string;
  team: 'Team North (Orange)' | 'Team Central (Navy)' | 'Team Louisiana (Burgundy)' | 'Team West/Colo (Green)' | string;
  colorGroup: 'orange' | 'navy' | 'burgundy' | 'green';
  region: 'TX (Dallas)' | 'TX (Houston)' | 'LA' | 'CO' | string;
  operationalRegion?: RegionName; // Independent isolation by main Region
  cameras: number; // Initial Camera inventory based on dispatch sheet
  machines: number; // Initial Machine inventory based on dispatch sheet
  phone?: string;
  email?: string;
  active: boolean;
}

export interface DateColumn {
  dateStr: string; // "8/30", "8/31", "9/1", "9/2", "9/3", "9/4", "9/5"
  fullDate: string; // "2026-08-30", etc.
  dayName: WeekDay;
  isToday: boolean;
}

export interface SpecialAssignment {
  id: string; // `${techName}_${dayName}`
  techName: string;
  dayName: WeekDay;
  type: 'COD';
  cameras: number;
  machines: number;
  notes?: string;
}

export interface StatusAuditResult {
  projectId: string;
  currentStatus: OpsStatus;
  suggestedStatus: OpsStatus;
  reason: string;
  severity: 'info' | 'warning' | 'success';
}
