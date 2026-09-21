import { WeekDay, Project } from '../types';

export const WEEK_DAYS_ORDER: WeekDay[] = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/**
 * Parses duration strings like "07:37:00", "7:37", "7.5", "8h 30m" into total seconds
 */
export function parseDurationToSeconds(timeStr: string | null | undefined): number {
  if (!timeStr) return 0;
  const trimmed = timeStr.trim();
  if (!trimmed || trimmed === '0' || trimmed === '0:00' || trimmed === '00:00:00') return 0;

  // Pattern: "HH:MM:SS" or "HH:MM"
  if (trimmed.includes(':')) {
    const parts = trimmed.split(':').map((p) => Number(p) || 0);
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    if (parts.length === 2) {
      return parts[0] * 3600 + parts[1] * 60;
    }
  }

  // Pattern: "8.5" (decimal hours)
  const decimalHours = parseFloat(trimmed);
  if (!isNaN(decimalHours) && decimalHours > 0 && !trimmed.includes('m')) {
    return Math.round(decimalHours * 3600);
  }

  // Pattern: "8h 30m"
  const hourMatch = trimmed.match(/(\d+)\s*h/i);
  const minMatch = trimmed.match(/(\d+)\s*m/i);
  let secs = 0;
  if (hourMatch) secs += parseInt(hourMatch[1], 10) * 3600;
  if (minMatch) secs += parseInt(minMatch[1], 10) * 60;
  return secs;
}

/**
 * Formats total seconds into standard "HH:MM:SS" format (matching dispatch sheet image)
 */
export function formatSecondsToDuration(totalSeconds: number): string {
  if (!totalSeconds || isNaN(totalSeconds) || totalSeconds <= 0) {
    return '0:00:00';
  }
  const hours = Math.floor(totalSeconds / 3600);
  const remainder = totalSeconds % 3600;
  const minutes = Math.floor(remainder / 60);
  const seconds = remainder % 60;

  return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Initial real hours directly matching the user's uploaded Houston Dispatch Sheet
 */
export const INITIAL_DISPATCH_HOURS: Record<string, string> = {
  // Dustin Fullerton (Total 25:08:00)
  'Dustin Fullerton_Monday': '7:37:00',
  'Dustin Fullerton_Tuesday': '5:47:00',
  'Dustin Fullerton_Wednesday': '6:37:00',
  'Dustin Fullerton_Thursday': '5:07:00',

  // Timothy Addison (Total 46:49:00)
  'Timothy Addison_Monday': '7:37:00',
  'Timothy Addison_Tuesday': '5:47:00',
  'Timothy Addison_Wednesday': '21:42:00',
  'Timothy Addison_Thursday': '11:43:00',

  // Dustyn May (Total 26:53:00)
  'Dustyn May_Monday': '2:22:00',
  'Dustyn May_Tuesday': '3:17:00',
  'Dustyn May_Wednesday': '10:57:00',
  'Dustyn May_Thursday': '10:17:00',

  // Diego Coreas (Total 23:47:00)
  'Diego Coreas_Monday': '7:03:00',
  'Diego Coreas_Tuesday': '4:30:00',
  'Diego Coreas_Wednesday': '7:07:00',
  'Diego Coreas_Thursday': '5:07:00',

  // Carlos Coreas (Total 25:21:00)
  'Carlos Coreas_Monday': '7:47:00',
  'Carlos Coreas_Tuesday': '7:03:00',
  'Carlos Coreas_Wednesday': '6:08:00',
  'Carlos Coreas_Thursday': '4:23:00',

  // Dallas Default Sample Hours for preview completeness
  'Treyvon Watts_Monday': '8:15:00',
  'Treyvon Watts_Tuesday': '6:30:00',
  'Treyvon Watts_Wednesday': '7:45:00',
  'Treyvon Watts_Thursday': '5:20:00',
  'Gavin Adams_Monday': '7:10:00',
  'Gavin Adams_Tuesday': '6:45:00',
  'Gavin Adams_Wednesday': '8:00:00',
  'Gavin Adams_Thursday': '6:15:00',
  'Jhonathan White_Monday': '6:50:00',
  'Jhonathan White_Tuesday': '5:30:00',
  'Jhonathan White_Wednesday': '7:20:00',
  'Jhonathan White_Thursday': '6:40:00',
};

/**
 * Calculates estimated daily hours based on active projects assigned to a technician on a day
 */
export function estimateHoursFromProjects(installs: Project[], teardowns: Project[]): string {
  if (installs.length === 0 && teardowns.length === 0) {
    return '0:00:00';
  }

  // Base travel/staging per day: 1.5 hours (5400s)
  let totalSec = 5400;

  installs.forEach((p) => {
    // 1 hour base setup + 12 min (720s) per camera/machine
    totalSec += 3600 + (p.equipmentCount || 1) * 720;
  });

  teardowns.forEach((p) => {
    // 45 min base teardown + 8 min (480s) per camera/machine
    totalSec += 2700 + (p.equipmentCount || 1) * 480;
  });

  return formatSecondsToDuration(totalSec);
}

/**
 * Calculates running total per week and cumulative running total for each day
 */
export function calculateTechWeeklyHours(
  hoursMap: Record<string, string>,
  techName: string,
  weekDays: WeekDay[] = WEEK_DAYS_ORDER
): {
  weeklyTotalStr: string;
  weeklyTotalSeconds: number;
  cumulativeRunningByDay: Record<WeekDay, string>;
  isOvertime: boolean;
  overtimeSeconds: number;
  daysWorked: number;
} {
  let runningSec = 0;
  let daysWorked = 0;
  const cumulativeRunningByDay = {} as Record<WeekDay, string>;

  weekDays.forEach((day) => {
    const key = `${techName}_${day}`;
    const dayHoursStr = hoursMap[key];
    const daySec = parseDurationToSeconds(dayHoursStr);
    if (daySec > 0) {
      daysWorked++;
    }
    runningSec += daySec;
    cumulativeRunningByDay[day] = formatSecondsToDuration(runningSec);
  });

  const weeklyTotalSeconds = runningSec;
  const weeklyTotalStr = formatSecondsToDuration(weeklyTotalSeconds);
  const fortyHoursSec = 40 * 3600;
  const isOvertime = weeklyTotalSeconds > fortyHoursSec;
  const overtimeSeconds = isOvertime ? weeklyTotalSeconds - fortyHoursSec : 0;

  return {
    weeklyTotalStr,
    weeklyTotalSeconds,
    cumulativeRunningByDay,
    isOvertime,
    overtimeSeconds,
    daysWorked,
  };
}
