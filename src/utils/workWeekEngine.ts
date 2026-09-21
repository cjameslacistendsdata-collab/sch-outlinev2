import { WorkWeekSheet, DateColumn, WeekDay, Project } from '../types';
import { CURRENT_DATE_STR } from './statusEngine';
import { calculateBatterySwaps, DAY_INDEX_MAP } from './batterySwapEngine';

export const CURRENT_WORK_WEEK_ID = '2026-W37';

export interface ActiveCycleInfo {
  refDate: string;
  refDateFormatted: string;
  weekNumber: number;
  weekId: string;
  cycleLabel: string;
  sundayDateStr: string;
  saturdayDateStr: string;
  dateColumns: DateColumn[];
}

/**
 * Mathematically derives the Active Cycle (Work Week and range) from any Reference Date.
 */
export function computeActiveCycle(refDateStr?: string): ActiveCycleInfo {
  let date: Date;
  if (refDateStr) {
    let [y, m, d] = refDateStr.split('-').map(Number);
    date = new Date(y, m - 1, d);
  } else {
    date = new Date();
  }
  if (isNaN(date.getTime())) {
    date = new Date();
  }
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const refIsoStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

  // Calculate Sunday of the active cycle week
  const sunday = new Date(date);
  sunday.setDate(date.getDate() - dayOfWeek);

  const startYear = sunday.getFullYear();
  const startMonth = sunday.getMonth() + 1;
  const startDay = sunday.getDate();
  const sundayDateStr = `${startYear}-${String(startMonth).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;

  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);
  const endMonth = saturday.getMonth() + 1;
  const endDay = saturday.getDate();
  const saturdayDateStr = `${saturday.getFullYear()}-${String(endMonth).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;

  // Week number (1-52) from Sunday of this week relative to start of that year
  const oneJan = new Date(startYear, 0, 1);
  const diffDays = Math.floor((sunday.getTime() - oneJan.getTime()) / (24 * 60 * 60 * 1000));
  const weekNumber = Math.max(1, Math.ceil((diffDays + oneJan.getDay() + 1) / 7));

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const startMonthName = monthNames[startMonth - 1];
  const endMonthName = monthNames[endMonth - 1];
  const rangeStr = `${startMonthName} ${startDay} - ${endMonthName} ${endDay}`;

  const weekId = `${startYear}-W${String(weekNumber).padStart(2, '0')}`;
  const cycleLabel = `Work Week ${weekNumber} • ${rangeStr}`;

  const refDateFormatted = date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return {
    refDate: refIsoStr,
    refDateFormatted,
    weekNumber,
    weekId,
    cycleLabel,
    sundayDateStr,
    saturdayDateStr,
    dateColumns: generateDateColumns(sundayDateStr, refIsoStr),
  };
}

const DAY_NAMES: WeekDay[] = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/**
 * Generate 7 DateColumns starting from a Sunday start date
 */
export function generateDateColumns(sundayDateStr: string, todayFullDate: string = CURRENT_DATE_STR): DateColumn[] {
  const [year, month, day] = sundayDateStr.split('-').map(Number);
  const startDate = new Date(year, month - 1, day);

  return DAY_NAMES.map((dayName, index) => {
    const colDate = new Date(startDate);
    colDate.setDate(startDate.getDate() + index);

    const m = colDate.getMonth() + 1;
    const d = colDate.getDate();
    const y = colDate.getFullYear();
    const fullDate = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

    return {
      dateStr: `${m}/${d}`,
      fullDate,
      dayName,
      isToday: fullDate === todayFullDate,
    };
  });
}

export const INITIAL_WORK_WEEKS: WorkWeekSheet[] = [
  {
    id: '2026-W36',
    label: 'Week 36 (Aug 30 - Sep 5)',
    shortLabel: 'W36: Aug 30 - Sep 5',
    weekNumber: 36,
    startDate: '2026-08-30',
    endDate: '2026-09-05',
    isCurrent: false,
    dateColumns: generateDateColumns('2026-08-30', CURRENT_DATE_STR),
  },
  {
    id: '2026-W37',
    label: 'Week 37 (Sep 6 - Sep 12) • Active Dispatch',
    shortLabel: 'W37: Sep 6 - Sep 12',
    weekNumber: 37,
    startDate: '2026-09-06',
    endDate: '2026-09-12',
    isCurrent: true,
    dateColumns: generateDateColumns('2026-09-06', CURRENT_DATE_STR),
  },
  {
    id: '2026-W38',
    label: 'Week 38 (Sep 13 - Sep 19)',
    shortLabel: 'W38: Sep 13 - Sep 19',
    weekNumber: 38,
    startDate: '2026-09-13',
    endDate: '2026-09-19',
    isCurrent: false,
    dateColumns: generateDateColumns('2026-09-13', CURRENT_DATE_STR),
  },
  {
    id: '2026-W39',
    label: 'Week 39 (Sep 20 - Sep 26)',
    shortLabel: 'W39: Sep 20 - Sep 26',
    weekNumber: 39,
    startDate: '2026-09-20',
    endDate: '2026-09-26',
    isCurrent: false,
    dateColumns: generateDateColumns('2026-09-20', CURRENT_DATE_STR),
  },
];

/**
 * Creates a new next consecutive work week sheet
 */
export function createNextWorkWeekSheet(existingSheets: WorkWeekSheet[]): WorkWeekSheet {
  let highestWeek = 36;
  let latestStartDate = '2026-08-30';

  if (existingSheets.length > 0) {
    const sorted = [...existingSheets].sort((a, b) => a.weekNumber - b.weekNumber);
    const last = sorted[sorted.length - 1];
    highestWeek = last.weekNumber;
    latestStartDate = last.startDate;
  }

  const nextWeekNumber = highestWeek + 1;
  const [y, m, d] = latestStartDate.split('-').map(Number);
  const nextSunday = new Date(y, m - 1, d);
  nextSunday.setDate(nextSunday.getDate() + 7);

  const startYear = nextSunday.getFullYear();
  const startMonth = nextSunday.getMonth() + 1;
  const startDay = nextSunday.getDate();
  const startDateStr = `${startYear}-${String(startMonth).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;

  const nextSaturday = new Date(nextSunday);
  nextSaturday.setDate(nextSunday.getDate() + 6);
  const endMonth = nextSaturday.getMonth() + 1;
  const endDay = nextSaturday.getDate();
  const endDateStr = `${nextSaturday.getFullYear()}-${String(endMonth).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const startMonthName = monthNames[startMonth - 1];
  const endMonthName = monthNames[endMonth - 1];
  const dateRangeStr = `${startMonthName} ${startDay} - ${endMonthName} ${endDay}`;

  const id = `${startYear}-W${nextWeekNumber}`;
  return {
    id,
    label: `Week ${nextWeekNumber} (${dateRangeStr})`,
    shortLabel: `W${nextWeekNumber}: ${dateRangeStr}`,
    weekNumber: nextWeekNumber,
    startDate: startDateStr,
    endDate: endDateStr,
    isCurrent: false,
    dateColumns: generateDateColumns(startDateStr),
  };
}

/**
 * Determines the corresponding WorkWeekSheet ID based on install date, collection window, or date string
 */
export function determineWorkWeekFromInstallDate(
  installDateStr?: string,
  collectionWindow?: string,
  collectionDay?: string,
  installDay?: string,
  existingSheets: WorkWeekSheet[] = INITIAL_WORK_WEEKS
): string {
  // Candidate strings in priority order
  const candidates = [installDateStr, collectionDay, collectionWindow].filter(Boolean) as string[];

  let parsedDate: Date | null = null;

  for (const text of candidates) {
    if (!text) continue;

    // 1. Try ISO date e.g. 2026-09-01
    const isoMatch = text.match(/202[0-9]-[0-1][0-9]-[0-3][0-9]/);
    if (isoMatch) {
      const [y, m, d] = isoMatch[0].split('-').map(Number);
      parsedDate = new Date(y, m - 1, d);
      break;
    }

    // 2. Try MM/DD/YYYY or M/D/YYYY
    const fullSlashMatch = text.match(/([0-1]?[0-9])\/([0-3]?[0-9])\/(202[0-9])/);
    if (fullSlashMatch) {
      const m = parseInt(fullSlashMatch[1], 10);
      const d = parseInt(fullSlashMatch[2], 10);
      const y = parseInt(fullSlashMatch[3], 10);
      parsedDate = new Date(y, m - 1, d);
      break;
    }

    // 3. Try M/D or MM/DD e.g. "9/1", "8/25", "(9/1)", "9/02"
    const slashMatch = text.match(/(?:^|[^0-9])([0-1]?[0-9])\/([0-3]?[0-9])(?:[^0-9]|$)/);
    if (slashMatch) {
      const m = parseInt(slashMatch[1], 10);
      const d = parseInt(slashMatch[2], 10);
      parsedDate = new Date(2026, m - 1, d);
      break;
    }
  }

  // If a valid date was parsed, find which existing sheet covers this date
  if (parsedDate && !isNaN(parsedDate.getTime())) {
    const y = parsedDate.getFullYear();
    const m = String(parsedDate.getMonth() + 1).padStart(2, '0');
    const d = String(parsedDate.getDate()).padStart(2, '0');
    const targetDateStr = `${y}-${m}-${d}`;

    for (const sheet of existingSheets) {
      if (targetDateStr >= sheet.startDate && targetDateStr <= sheet.endDate) {
        return sheet.id;
      }
    }

    // If not in existing sheets, calculate the Sunday of this date
    const dayOfWeek = parsedDate.getDay(); // 0 = Sunday
    const sunday = new Date(parsedDate);
    sunday.setDate(parsedDate.getDate() - dayOfWeek);

    // Calculate approximate week number
    const oneJan = new Date(parsedDate.getFullYear(), 0, 1);
    const numberOfDays = Math.floor((parsedDate.getTime() - oneJan.getTime()) / (24 * 60 * 60 * 1000));
    const weekNum = Math.ceil((numberOfDays + oneJan.getDay() + 1) / 7);

    return `${parsedDate.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
  }

  // Fallback: If only installDay is provided, default to current active work week
  return CURRENT_WORK_WEEK_ID;
}

/**
 * Normalizes any work week string (e.g. "36", "W36", "WW 36", "WW36", "Week 36", "2026-W36", "Cycle 36")
 * into standard ID format "YYYY-Wxx" (e.g. "2026-W36").
 */
export function normalizeWorkWeekString(val?: string, defaultYear = 2026): string | null {
  if (!val) return null;
  const str = val.trim();
  if (!str) return null;

  // Check if already in standard format e.g. 2026-W36
  const fullMatch = str.match(/^([0-9]{4})-W([0-9]{1,2})$/i);
  if (fullMatch) {
    const year = fullMatch[1];
    const num = parseInt(fullMatch[2], 10);
    return `${year}-W${String(num).padStart(2, '0')}`;
  }

  // Check for week number with prefixes: WW 36, WW36, W36, Week 36, Cycle 36, or just 36
  const numMatch = str.match(/(?:WW|W|Week|Cycle)?\s*#?\s*([0-9]{1,2})\b/i);
  if (numMatch) {
    const num = parseInt(numMatch[1], 10);
    if (num >= 1 && num <= 53) {
      return `${defaultYear}-W${String(num).padStart(2, '0')}`;
    }
  }

  return null;
}

/**
 * Creates or retrieves a WorkWeekSheet for any valid week ID like "2026-W36" or "2026-W37".
 */
export function ensureWorkWeekSheet(weekId: string, existingSheets: WorkWeekSheet[]): WorkWeekSheet {
  const existing = existingSheets.find((s) => s.id === weekId);
  if (existing) return existing;

  // Parse year and week number from weekId
  const match = weekId.match(/^([0-9]{4})-W([0-9]{1,2})$/i);
  const year = match ? parseInt(match[1], 10) : 2026;
  const weekNum = match ? parseInt(match[2], 10) : 36;

  // Approximate Sunday start date for weekNum in year
  // In 2026, W36 starts on 2026-08-30.
  // Each week difference is 7 days.
  const baseW36Sunday = new Date(2026, 7, 30); // 2026-08-30
  const weekDiff = weekNum - 36;
  const targetSunday = new Date(baseW36Sunday);
  targetSunday.setDate(baseW36Sunday.getDate() + weekDiff * 7);

  const startYear = targetSunday.getFullYear();
  const startMonth = targetSunday.getMonth() + 1;
  const startDay = targetSunday.getDate();
  const startDateStr = `${startYear}-${String(startMonth).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;

  const targetSaturday = new Date(targetSunday);
  targetSaturday.setDate(targetSunday.getDate() + 6);
  const endMonth = targetSaturday.getMonth() + 1;
  const endDay = targetSaturday.getDate();
  const endDateStr = `${targetSaturday.getFullYear()}-${String(endMonth).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const startMonthName = monthNames[startMonth - 1];
  const endMonthName = monthNames[endMonth - 1];
  const dateRangeStr = `${startMonthName} ${startDay} - ${endMonthName} ${endDay}`;

  return {
    id: weekId,
    label: `Week ${weekNum} (${dateRangeStr})`,
    shortLabel: `W${weekNum}: ${dateRangeStr}`,
    weekNumber: weekNum,
    startDate: startDateStr,
    endDate: endDateStr,
    isCurrent: weekId === CURRENT_WORK_WEEK_ID,
    dateColumns: generateDateColumns(startDateStr),
  };
}

export const DAY_ORDER_MAP: Record<WeekDay, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

/**
 * Given a weekId like "2026-W37", returns the next consecutive weekId "2026-W38".
 */
export function getNextWorkWeekId(weekId: string): string {
  const match = weekId.match(/^([0-9]{4})-W([0-9]{1,2})$/i);
  if (match) {
    const year = parseInt(match[1], 10);
    const num = parseInt(match[2], 10);
    if (num >= 52) {
      return `${year + 1}-W01`;
    }
    return `${year}-W${String(num + 1).padStart(2, '0')}`;
  }
  return '2026-W38';
}

/**
 * Given a weekId like "2026-W38", returns the previous weekId "2026-W37".
 */
export function getPreviousWorkWeekId(weekId: string): string {
  const match = weekId.match(/^([0-9]{4})-W([0-9]{1,2})$/i);
  if (match) {
    const year = parseInt(match[1], 10);
    const num = parseInt(match[2], 10);
    if (num <= 1) {
      return `${year - 1}-W52`;
    }
    return `${year}-W${String(num - 1).padStart(2, '0')}`;
  }
  return '2026-W36';
}

/**
 * Determines whether a project's teardown extends into the following work week.
 * Example: Installed on Thursday (Day 4) and Teardown falls on Sunday (Day 0) -> Rollover into upcoming week.
 */
export function isTeardownRollover(project: {
  installDay?: WeekDay | '';
  teardownDay?: WeekDay | '';
  collectionWindow?: string;
  collectionDay?: string;
  consecutiveCollectionDays?: number;
  studyType?: string;
}): boolean {
  if (!project.installDay || !project.teardownDay) {
    return false;
  }

  const installIdx = DAY_ORDER_MAP[project.installDay];
  const teardownIdx = DAY_ORDER_MAP[project.teardownDay];

  // If teardown day of week is on or before install day of week, it physically
  // must happen in the subsequent week (e.g. Thu -> Sun, Fri -> Mon, Sat -> Tue, Mon -> Mon)
  if (teardownIdx <= installIdx) {
    return true;
  }

  // If collection duration is 6+ days (e.g. 7-day collection starting Mon (1), teardown Tue (2) next week)
  if (project.consecutiveCollectionDays && project.consecutiveCollectionDays >= 6) {
    return true;
  }

  // If study type is 7-day or notes suggest 7-day
  if (project.studyType && (project.studyType.includes('7-Day') || project.studyType.includes('7 Day') || project.studyType.includes('ATR'))) {
    return true;
  }

  // Also check explicit dates in collectionWindow if available (e.g. "9/10 - 9/13" or "9/14 - 9/22")
  if (project.collectionWindow) {
    const slashMatches = project.collectionWindow.match(/([0-1]?[0-9])\/([0-3]?[0-9])/g);
    if (slashMatches && slashMatches.length >= 2) {
      const [m1, d1] = slashMatches[0].split('/').map(Number);
      const [m2, d2] = slashMatches[1].split('/').map(Number);
      const date1 = new Date(2026, m1 - 1, d1);
      const date2 = new Date(2026, m2 - 1, d2);
      const diffDays = Math.round((date2.getTime() - date1.getTime()) / (24 * 60 * 60 * 1000));
      if (diffDays >= 7 || (diffDays >= 2 && date1.getDay() > date2.getDay())) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Returns the base work week ID for a project.
 */
export function getProjectBaseWorkWeek(
  project: Project,
  existingSheets: WorkWeekSheet[] = INITIAL_WORK_WEEKS
): string {
  if (project.workWeek) {
    return project.workWeek;
  }
  return determineWorkWeekFromInstallDate(
    project.collectionDay,
    project.collectionWindow,
    project.collectionDay,
    project.installDay,
    existingSheets
  );
}

/**
 * Returns the work week ID in which a project's teardown occurs.
 * If the teardown rolls over (e.g. Thu install -> Sun teardown), this returns the next work week ID!
 */
export function getProjectTeardownWorkWeek(
  project: Project,
  existingSheets: WorkWeekSheet[] = INITIAL_WORK_WEEKS
): string {
  const baseWeek = getProjectBaseWorkWeek(project, existingSheets);
  if (isTeardownRollover(project)) {
    return getNextWorkWeekId(baseWeek);
  }
  return baseWeek;
}

/**
 * Filter projects by selected work week sheet.
 * Includes:
 * 1. Projects whose primary installation occurs in this work week.
 * 2. Rollover Projects: Projects whose installation occurred in the previous week
 *    and whose teardown extends into this upcoming Work Week view!
 */
export function filterProjectsByWorkWeek(
  projects: Project[],
  selectedWeekId: string,
  existingSheets: WorkWeekSheet[] = INITIAL_WORK_WEEKS
): Project[] {
  if (!selectedWeekId || selectedWeekId === 'ALL') {
    return projects;
  }

  const prevWeekId = getPreviousWorkWeekId(selectedWeekId);

  return projects.filter((p) => {
    const baseWeek = getProjectBaseWorkWeek(p, existingSheets);

    // 1. Direct match for this work week
    if (baseWeek === selectedWeekId) {
      return true;
    }

    // 2. Rollover carryover: Project was installed in previous work week,
    // but its teardown extends into this upcoming week!
    if (baseWeek === prevWeekId && isTeardownRollover(p)) {
      return true;
    }

    // 3. Project has any battery swap occurring in this selectedWeekId
    const targetSheet = existingSheets.find((s) => s.id === selectedWeekId);
    if (targetSheet) {
      const hasBatterySwapInWeek = targetSheet.dateColumns.some((col) =>
        shouldShowProjectEventOnDay(p, 'battery_swap', col.dayName, selectedWeekId, existingSheets)
      );
      if (hasBatterySwapInWeek) {
        return true;
      }
    }

    // Default fallback for legacy unassigned projects
    if (!p.workWeek && (selectedWeekId === CURRENT_WORK_WEEK_ID || selectedWeekId.includes('37'))) {
      return true;
    }

    return false;
  });
}

/**
 * Determines whether a specific event (install, battery_swap, teardown) should be rendered
 * on a given day column for the currently selected work week.
 * - For install: Only renders in the base installation week.
 * - For battery_swap:
 *     - If collecting 3+ consecutive days, battery swaps occur 2 days after installation
 *       and every other day until teardown (e.g. 3-day: install + 2 days; 7-day: install + 2, 4, 6 days).
 *     - Correctly renders across both within-week and rollover work weeks!
 * - For teardown with rollover:
 *     - Does NOT render on the previous Sunday/Monday of the install week! (Prevents 9/13 showing on 9/6).
 *     - Renders on the teardown day in the upcoming rollover week.
 */
export function shouldShowProjectEventOnDay(
  project: Project,
  eventType: 'install' | 'battery_swap' | 'teardown',
  dayName: WeekDay,
  selectedWeekId: string = CURRENT_WORK_WEEK_ID,
  existingSheets: WorkWeekSheet[] = INITIAL_WORK_WEEKS
): boolean {
  const baseWeek = getProjectBaseWorkWeek(project, existingSheets);
  const hasRollover = isTeardownRollover(project);
  const rolloverWeek = getNextWorkWeekId(baseWeek);

  if (eventType === 'install') {
    // Only show install on its designated day in the project's base week
    return project.installDay === dayName && selectedWeekId === baseWeek;
  }

  if (eventType === 'battery_swap') {
    const targetSheet = existingSheets.find((s) => s.id === selectedWeekId);

    // 1. Check explicit calendar dates in batterySwapDates from CSV (e.g. ['9/16', '9/18', '9/20'])
    if (project.batterySwapDates && project.batterySwapDates.length > 0 && targetSheet) {
      const col = targetSheet.dateColumns.find((c) => c.dayName === dayName);
      if (col && project.batterySwapDates.includes(col.dateStr)) {
        return true;
      }
    }

    // 2. Check explicit batterySwapDays array or single batterySwapDay from CSV
    const allSwapDays: WeekDay[] = [];
    if (project.batterySwapDays && project.batterySwapDays.length > 0) {
      allSwapDays.push(...project.batterySwapDays);
    } else if (project.batterySwapDay) {
      allSwapDays.push(project.batterySwapDay);
    }

    if (allSwapDays.includes(dayName)) {
      // Determine if this dayName falls into baseWeek or rolloverWeek relative to installDay
      const installIdx = project.installDay ? DAY_INDEX_MAP[project.installDay] : 1;
      const swapIdx = DAY_INDEX_MAP[dayName];
      if (swapIdx > installIdx) {
        if (selectedWeekId === baseWeek) return true;
      } else {
        if (selectedWeekId === rolloverWeek) return true;
      }
    }

    return false;
  }

  if (eventType === 'teardown') {
    if (project.teardownDay !== dayName) {
      return false;
    }

    if (hasRollover) {
      // If project has teardown rollover into next week:
      // - In the install week: DO NOT place teardown on this day (e.g. DO NOT show on Sunday 9/6 when installed on 9/10)!
      // - In the upcoming rollover week: DO show on this day (e.g. Sunday 9/13)!
      return selectedWeekId === rolloverWeek;
    } else {
      // Normal within-week teardown
      return selectedWeekId === baseWeek;
    }
  }

  return false;
}

/**
 * Checks if a project belongs to a previous work week relative to the current active work week.
 * Projects belonging to previous work weeks are locked and preserved during CSV updates.
 */
export function isProjectInPreviousWorkWeek(
  project: Project,
  currentWeekNumber: number = 37,
  existingSheets: WorkWeekSheet[] = INITIAL_WORK_WEEKS
): boolean {
  // 1. If project has explicit workWeek ID e.g. 2026-W35, 2026-W36
  if (project.workWeek) {
    const match = project.workWeek.match(/^([0-9]{4})-W([0-9]{1,2})$/i);
    if (match) {
      const weekNum = parseInt(match[2], 10);
      return weekNum < currentWeekNumber;
    }
  }

  // 2. Derive work week from project dates
  const resolvedWeekId = determineWorkWeekFromInstallDate(
    project.installDay,
    project.collectionWindow,
    project.collectionDay,
    project.installDay,
    existingSheets
  );
  const match = resolvedWeekId.match(/^([0-9]{4})-W([0-9]{1,2})$/i);
  if (match) {
    const weekNum = parseInt(match[2], 10);
    return weekNum < currentWeekNumber;
  }

  return false;
}


