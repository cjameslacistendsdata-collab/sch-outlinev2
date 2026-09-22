import { Project, OpsStatus, StatusAuditResult, WeekDay, DateColumn } from '../types';

// Dynamic system reference date based on current operational date
const getNowInfo = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const dayNames: WeekDay[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  // Calculate Sunday of current week
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - now.getDay());
  const sunY = sunday.getFullYear();
  const sunM = String(sunday.getMonth() + 1).padStart(2, '0');
  const sunD = String(sunday.getDate()).padStart(2, '0');

  return {
    dateStr: `${y}-${m}-${d}`,
    dayName: dayNames[now.getDay()],
    formatted: `${m}/${d}/${y}`,
    sundayDateStr: `${sunY}-${sunM}-${sunD}`,
    sundayDate: sunday,
  };
};

const sysDate = getNowInfo();
export const CURRENT_DATE_STR = sysDate.dateStr;
export const CURRENT_DAY_NAME: WeekDay = sysDate.dayName;
export const CURRENT_FORMATTED_DATE = sysDate.formatted;
export const CURRENT_SUNDAY_STR = sysDate.sundayDateStr;

// Dynamic 7-day columns for the current operational week, synced with CURRENT_DATE_STR
export const WEEK_DAYS: DateColumn[] = (['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as WeekDay[]).map((dayName, idx) => {
  const colDate = new Date(sysDate.sundayDate);
  colDate.setDate(sysDate.sundayDate.getDate() + idx);
  const m = colDate.getMonth() + 1;
  const d = colDate.getDate();
  const y = colDate.getFullYear();
  const fullDate = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  return {
    dateStr: `${m}/${d}`,
    fullDate,
    dayName,
    isToday: fullDate === sysDate.dateStr,
  };
});

const DAY_ORDER: Record<WeekDay, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

/**
 * Evaluates a single project and determines if an automated status update is recommended
 */
export function evaluateProjectStatus(project: Project, refDayName: WeekDay = CURRENT_DAY_NAME): StatusAuditResult | null {
  // Never change already Delivered jobs automatically
  if (project.opsStatus === 'Delivered') {
    return null;
  }

  // 1. Unassigned technician check
  if (!project.technician || project.technician === 'Unassigned') {
    if (project.opsStatus !== 'Needs Scheduling') {
      return {
        projectId: project.id,
        currentStatus: project.opsStatus,
        suggestedStatus: 'Needs Scheduling',
        reason: 'No technician assigned. Requires field scheduling.',
        severity: 'warning',
      };
    }
    return null;
  }

  // 2. Teardown has already occurred before reference day
  if (project.teardownDay && DAY_ORDER[project.teardownDay] < DAY_ORDER[refDayName]) {
    if (project.opsStatus === 'Scheduled to techs' || project.opsStatus === 'Needs Scheduling' || project.opsStatus === 'All locations installed') {
      return {
        projectId: project.id,
        currentStatus: project.opsStatus,
        suggestedStatus: 'Pending QAQC OPS',
        reason: `Teardown was completed on ${project.teardownDay}. Ready for QA/QC and data auditing.`,
        severity: 'info',
      };
    }
  }

  // 3. Project is currently active in the field (Installed on/before reference day, teardown on/after reference day)
  if (
    project.installDay &&
    DAY_ORDER[project.installDay] <= DAY_ORDER[refDayName] &&
    project.teardownDay &&
    DAY_ORDER[project.teardownDay] >= DAY_ORDER[refDayName]
  ) {
    if (project.opsStatus === 'Scheduled to techs' || project.opsStatus === 'Needs Scheduling') {
      return {
        projectId: project.id,
        currentStatus: project.opsStatus,
        suggestedStatus: 'All locations installed',
        reason: `Installed on ${project.installDay} and teardown is on ${project.teardownDay}. Active in field collection.`,
        severity: 'success',
      };
    }
  }

  // 4. Job has technician and future install date, but marked as "Needs Scheduling"
  if (
    project.technician &&
    project.technician !== 'Unassigned' &&
    project.installDay &&
    project.opsStatus === 'Needs Scheduling'
  ) {
    return {
      projectId: project.id,
      currentStatus: project.opsStatus,
      suggestedStatus: 'Scheduled to techs',
      reason: `Assigned to ${project.technician} for ${project.installDay} install. Ready for dispatch.`,
      severity: 'info',
    };
  }

  return null;
}

/**
 * Automatically calculates synchronized opsStatus and scheduleStatus for a project
 */
export function computeAutoProjectStatus(project: Project, refDayName: WeekDay = CURRENT_DAY_NAME): { opsStatus: OpsStatus; scheduleStatus: Project['scheduleStatus'] } {
  if (project.opsStatus === 'Delivered') {
    return { opsStatus: 'Delivered', scheduleStatus: 'Sent -Checked by Ops' };
  }

  if (!project.technician || project.technician === 'Unassigned') {
    return { opsStatus: 'Needs Scheduling', scheduleStatus: 'Needs Scheduling' };
  }

  // Check teardown passed
  if (project.teardownDay && DAY_ORDER[project.teardownDay] < DAY_ORDER[refDayName]) {
    return { opsStatus: 'Pending QAQC OPS', scheduleStatus: 'Sent -Checked by Ops' };
  }

  // Check active in field
  if (
    project.installDay &&
    DAY_ORDER[project.installDay] <= DAY_ORDER[refDayName] &&
    (!project.teardownDay || DAY_ORDER[project.teardownDay] >= DAY_ORDER[refDayName])
  ) {
    return { opsStatus: 'All locations installed', scheduleStatus: 'Sent -Checked by Ops' };
  }

  // Scheduled for future
  if (project.installDay) {
    return { opsStatus: 'Scheduled to techs', scheduleStatus: 'Schedule Sent' };
  }

  return { opsStatus: project.opsStatus, scheduleStatus: project.scheduleStatus };
}

/**
 * Automates statuses across all projects in the workspace
 */
export function autoSyncAllProjectStatuses(projects: Project[], refDayName: WeekDay = CURRENT_DAY_NAME): Project[] {
  return projects.map((p) => {
    const computed = computeAutoProjectStatus(p, refDayName);
    if (computed.opsStatus !== p.opsStatus || computed.scheduleStatus !== p.scheduleStatus) {
      return {
        ...p,
        opsStatus: computed.opsStatus,
        scheduleStatus: computed.scheduleStatus,
        lastUpdated: new Date().toISOString(),
      };
    }
    return p;
  });
}

/**
 * Runs automated audit on all projects and returns list of actionable updates
 */
export function auditAllProjects(projects: Project[], refDayName: WeekDay = CURRENT_DAY_NAME): StatusAuditResult[] {
  const results: StatusAuditResult[] = [];
  for (const project of projects) {
    const res = evaluateProjectStatus(project, refDayName);
    if (res) {
      results.push(res);
    }
  }
  return results;
}

/**
 * Calculates workflow health and summary metrics
 */
export function calculateWorkflowMetrics(projects: Project[]) {
  const totalProjects = projects.length;
  const totalEquipment = projects.reduce((acc, p) => acc + (p.equipmentCount || 0), 0);
  const totalLocations = projects.reduce((acc, p) => acc + (p.locationsCount || 0), 0);

  const statusCounts: Record<OpsStatus, number> = {
    'All locations installed': 0,
    'Pending QAQC OPS': 0,
    'Scheduled to techs': 0,
    'Needs Scheduling': 0,
    'Pending Delivery': 0,
    'Delivered': 0,
  };

  const studyTypeCounts: Record<string, number> = {};

  let installsToday = 0;
  let teardownsToday = 0;
  let unassignedCount = 0;
  let priorityClientCount = 0;

  for (const p of projects) {
    statusCounts[p.opsStatus] = (statusCounts[p.opsStatus] || 0) + 1;
    studyTypeCounts[p.studyType] = (studyTypeCounts[p.studyType] || 0) + 1;

    if (p.installDay === CURRENT_DAY_NAME) installsToday++;
    if (p.teardownDay === CURRENT_DAY_NAME) teardownsToday++;
    if (!p.technician || p.technician === 'Unassigned') unassignedCount++;
    if (p.urgency === 'Priority Client' || p.urgency === 'ASAP') priorityClientCount++;
  }

  // Workload per technician
  const techWorkload: Record<string, { jobCount: number; equipmentCount: number; locationsCount: number }> = {};
  for (const p of projects) {
    if (p.technician && p.technician !== 'Unassigned') {
      if (!techWorkload[p.technician]) {
        techWorkload[p.technician] = { jobCount: 0, equipmentCount: 0, locationsCount: 0 };
      }
      techWorkload[p.technician].jobCount += 1;
      techWorkload[p.technician].equipmentCount += (p.equipmentCount || 0);
      techWorkload[p.technician].locationsCount += (p.locationsCount || 0);
    }
  }

  return {
    totalProjects,
    totalEquipment,
    totalLocations,
    statusCounts,
    studyTypeCounts,
    installsToday,
    teardownsToday,
    unassignedCount,
    priorityClientCount,
    techWorkload,
  };
}

export interface StatusBadgeInfo {
  bg: string;
  text: string;
  border: string;
  dot: string;
  label: string;
}

/**
 * Returns color badge styling for OPS / Project Status
 * Always returns a valid StatusBadgeInfo object and never returns undefined.
 */
export function getOpsStatusBadge(status?: string | null): StatusBadgeInfo {
  const normalized = (status || '').trim().toLowerCase();

  if (normalized.includes('all locations installed') || normalized === 'installed') {
    return {
      bg: 'bg-slate-700/80',
      text: 'text-slate-200',
      border: 'border-slate-600',
      dot: 'bg-slate-400',
      label: status || 'All locations installed',
    };
  }

  if (
    normalized.includes('pending qaqc') ||
    normalized.includes('qaqc') ||
    normalized.includes('qa/qc') ||
    normalized.includes('audit')
  ) {
    return {
      bg: 'bg-emerald-950/80',
      text: 'text-emerald-300',
      border: 'border-emerald-700/60',
      dot: 'bg-emerald-400',
      label: status || 'Pending QAQC OPS',
    };
  }

  if (
    normalized.includes('scheduled to techs') ||
    normalized === 'scheduled' ||
    normalized.includes('schedule sent')
  ) {
    return {
      bg: 'bg-amber-950/70',
      text: 'text-amber-300',
      border: 'border-amber-700/60',
      dot: 'bg-amber-400',
      label: status || 'Scheduled to techs',
    };
  }

  if (
    normalized.includes('needs scheduling') ||
    normalized.includes('pending scheduling') ||
    normalized === 'draft'
  ) {
    return {
      bg: 'bg-rose-950/80',
      text: 'text-rose-300',
      border: 'border-rose-700/60',
      dot: 'bg-rose-400',
      label: status || 'Needs Scheduling',
    };
  }

  if (
    normalized.includes('pending delivery') ||
    normalized.includes('processing') ||
    normalized.includes('review')
  ) {
    return {
      bg: 'bg-blue-950/80',
      text: 'text-blue-300',
      border: 'border-blue-700/60',
      dot: 'bg-blue-400',
      label: status || 'Pending Delivery',
    };
  }

  if (
    normalized.includes('delivered') ||
    normalized.includes('completed') ||
    normalized.includes('done')
  ) {
    return {
      bg: 'bg-teal-950/80',
      text: 'text-teal-300',
      border: 'border-teal-700/60',
      dot: 'bg-teal-400',
      label: status || 'Delivered',
    };
  }

  if (normalized.includes('hold') || normalized.includes('paused') || normalized.includes('waiting')) {
    return {
      bg: 'bg-orange-950/80',
      text: 'text-orange-300',
      border: 'border-orange-700/60',
      dot: 'bg-orange-400',
      label: status || 'On Hold',
    };
  }

  if (normalized.includes('cancel')) {
    return {
      bg: 'bg-red-950/80',
      text: 'text-red-300',
      border: 'border-red-700/60',
      dot: 'bg-red-400',
      label: status || 'Cancelled',
    };
  }

  // Safe fallback default - NEVER returns undefined!
  return {
    bg: 'bg-slate-800/80',
    text: 'text-slate-300',
    border: 'border-slate-700',
    dot: 'bg-slate-400',
    label: status || 'Pending',
  };
}

/**
 * Helper to export projects to CSV matching the format in Image 2 / original file,
 * sorted and designated cleanly by assigned Technician, Install Day, and Project #.
 */
export function exportProjectsToCSV(projects: Project[]): string {
  const dayOrder: Record<string, number> = {
    Sunday: 0,
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6,
  };

  // Sort by technician name (grouped), then by install day order, then by project ID
  const sorted = [...projects].sort((a, b) => {
    const techA = (a.technician || 'ZZZ').trim().toLowerCase();
    const techB = (b.technician || 'ZZZ').trim().toLowerCase();
    if (techA !== techB) return techA.localeCompare(techB);

    const dayA = dayOrder[a.installDay] ?? 99;
    const dayB = dayOrder[b.installDay] ?? 99;
    if (dayA !== dayB) return dayA - dayB;

    return a.id.localeCompare(b.id);
  });

  const headers = [
    'Technician',
    'Project #',
    'Install Day',
    'Teardown Day',
    'TEARDOWN  AFTER',
    'Teardown Date',
    'STATUS (OPS)',
    'City, State',
    'Study',
    'No. of Equipment',
    'No. of Locations',
    'Collection Window',
    'Collection Day',
    'Scheduling Status',
    'Work Week',
    'VERSION',
    'DATE SENT',
    'Evaluated By',
    'Urgency Selection',
    'Deliver Video',
    'Scheduler Notes',
    'Analyst Notes',
  ];

  const rows = sorted.map((p) => [
    `"${p.technician || 'Unassigned'}"`,
    `"${p.id}"`,
    `"${p.installDay || ''}"`,
    `"${p.teardownDay || ''}"`,
    `"${p.teardownAfter || ''}"`,
    `"${p.teardownDate || ''}"`,
    `"${p.opsStatus}"`,
    `"${p.cityState}"`,
    `"${p.studyType}"`,
    p.equipmentCount,
    p.locationsCount,
    `"${p.collectionWindow}"`,
    `"${p.collectionDay || ''}"`,
    `"${p.scheduleStatus}"`,
    `"${p.workWeek || '2026-W37'}"`,
    `"${p.version}"`,
    `"${p.dateSent || ''}"`,
    `"${p.evaluatedBy || ''}"`,
    `"${p.urgency || ''}"`,
    p.deliverVideo ? 'YES' : '',
    `"${(p.schedulerNotes || '').replace(/"/g, '""')}"`,
    `"${(p.analystNotes || '').replace(/"/g, '""')}"`,
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}
