import { Project, WeekDay } from '../types';

export const DAY_ORDER: WeekDay[] = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export const DAY_INDEX_MAP: Record<WeekDay, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

/**
 * Parses consecutive collection days from collection window, notes, or install-to-teardown span.
 * e.g. "3 days", "7 days", "72 hrs", "168 hrs", "9/14-9/17", "9/14 to 9/21", "9/1 9/2 & 9/3", etc.
 */
export function detectConsecutiveCollectionDays(
  collectionWindow?: string,
  collectionDay?: string,
  notes?: string,
  installDay?: WeekDay | '',
  teardownDay?: WeekDay | '',
  studyType?: string
): number {
  const combined = `${collectionWindow || ''} ${collectionDay || ''} ${notes || ''}`.toLowerCase();

  // 1. Explicit consecutive days / day count in text: e.g. "7 consecutive days", "7 days", "7-day", "3 days"
  const dayMatch = combined.match(/(\d+)\s*(?:consecutive\s*)?(?:-| )?(?:day|days)\b/i);
  if (dayMatch && dayMatch[1]) {
    const days = parseInt(dayMatch[1], 10);
    if (!isNaN(days) && days > 0 && days <= 30) {
      return days;
    }
  }

  // 2. Explicit hours: e.g. "72 hrs", "72hrs", "72 hours" -> 3 days; "168 hrs" -> 7 days
  const hrMatch = combined.match(/(\d+)\s*(?:hrs?|hours?)\b/i);
  if (hrMatch && hrMatch[1]) {
    const hrs = parseInt(hrMatch[1], 10);
    if (!isNaN(hrs) && hrs >= 24) {
      return Math.round(hrs / 24);
    }
  }

  // 3. Date range in collectionWindow or combined text: e.g. "9/14 - 9/17", "9/14 to 9/21", "9/1-9/10"
  const dateRangeMatch = combined.match(/([0-1]?[0-9])\/([0-3]?[0-9])\s*(?:-|to|through|–|—)\s*([0-1]?[0-9])\/([0-3]?[0-9])/);
  if (dateRangeMatch) {
    const m1 = parseInt(dateRangeMatch[1], 10);
    const d1 = parseInt(dateRangeMatch[2], 10);
    const m2 = parseInt(dateRangeMatch[3], 10);
    const d2 = parseInt(dateRangeMatch[4], 10);
    const date1 = new Date(2026, m1 - 1, d1);
    const date2 = new Date(2026, m2 - 1, d2);
    const diffTime = date2.getTime() - date1.getTime();
    const diffDays = Math.round(diffTime / (24 * 60 * 60 * 1000));
    if (diffDays > 0 && diffDays <= 30) {
      // If collection range is 9/14 - 9/16, that is 3 days (14, 15, 16) or if 9/14 - 9/17 teardown, diffDays = 3
      return diffDays;
    }
  }

  // 4. Multiple explicit dates joined by & or commas: e.g. "9/1 9/2 & 9/3", "9/14, 9/15, 9/16"
  const allDateMatches = combined.match(/([0-1]?[0-9]\/[0-3]?[0-9])/g);
  if (allDateMatches && allDateMatches.length >= 3) {
    // Check if distinct dates
    const uniqueDates = Array.from(new Set(allDateMatches));
    if (uniqueDates.length >= 3 && (combined.includes('&') || combined.includes('and') || combined.includes(','))) {
      return uniqueDates.length;
    }
  }

  // 5. From installDay and teardownDay if available
  if (installDay && teardownDay) {
    const installIdx = DAY_INDEX_MAP[installDay];
    const teardownIdx = DAY_INDEX_MAP[teardownDay];
    if (installIdx !== undefined && teardownIdx !== undefined) {
      let spanDays = teardownIdx - installIdx;
      if (spanDays <= 0) {
        spanDays += 7; // Wraps into next week (rollover)
      }
      // If study is 7-day ATR or notes suggest rollover week e.g. Mon -> Tue next week
      if (spanDays === 1 && (combined.includes('7') || combined.includes('week') || (studyType && studyType.includes('7')))) {
        spanDays += 7; // 8 days span
      }
      // Between install and teardown, collection duration is spanDays - 1 (e.g. Mon to Fri span = 4 -> 3-day collection)
      const collectionDuration = spanDays >= 3 ? spanDays - 1 : spanDays;
      if (collectionDuration >= 2) {
        return collectionDuration;
      }
    }
  }

  // 6. Study type fallbacks (e.g. 7-day ATR, LADOTD Annual Counts)
  if (studyType) {
    const stUpper = studyType.toUpperCase();
    if (stUpper.includes('7-DAY') || stUpper.includes('7 DAY') || stUpper.includes('WEEK') || stUpper.includes('LADOTD ANNUAL')) {
      return 7;
    }
  }

  return 0;
}

export interface CalculatedBatterySwaps {
  consecutiveDays: number;
  teardownDay: WeekDay | '';
  teardownDate?: string;
  teardownOffset: number;
  batterySwapDays: WeekDay[];
  batterySwapDates: string[];
  batterySwapDay: WeekDay | '';
  summaryText: string;
}

/**
 * Calculates battery swap days and dates based on:
 * "add battery swaps to a project 1 day after install then every other day until its teardown depending on the duration of collection"
 *
 * Example: 3 day collection project.
 * 9/14-Monday Install
 * 9/16-Wednesday Battery Swap
 * 9/18-Friday Teardown
 *
 * 7 day collection project
 * 9/14-Monday Install
 * 9/16-Wednesday Battery Swap
 * 9/18-Friday Battery Swap
 * 9/20-Sunday Battery Swap
 * 9/22-Tuesday Teardown
 */
export function calculateBatterySwaps(
  projectOrConfig: {
    collectionWindow?: string;
    collectionDay?: string;
    schedulerNotes?: string;
    analystNotes?: string;
    installDay?: WeekDay | '';
    teardownDay?: WeekDay | '';
    studyType?: string;
    workWeek?: string;
    consecutiveCollectionDays?: number;
  },
  referenceInstallDate?: { month: number; day: number; year?: number }
): CalculatedBatterySwaps {
  const {
    collectionWindow = '',
    collectionDay = '',
    schedulerNotes = '',
    analystNotes = '',
    installDay = '',
    teardownDay = '',
    studyType = '',
    workWeek = '',
    consecutiveCollectionDays,
  } = projectOrConfig;

  // Determine consecutive collection days (duration of collection)
  let consecutiveDays =
    consecutiveCollectionDays && consecutiveCollectionDays > 0
      ? consecutiveCollectionDays
      : detectConsecutiveCollectionDays(
          collectionWindow,
          collectionDay,
          `${schedulerNotes} ${analystNotes}`,
          installDay,
          teardownDay,
          studyType
        );

  // If less than 2 days, no battery swaps required (single battery lasts 24-48 hours)
  if (consecutiveDays < 2) {
    return {
      consecutiveDays,
      teardownDay: teardownDay || '',
      teardownDate: undefined,
      teardownOffset: 0,
      batterySwapDays: [],
      batterySwapDates: [],
      batterySwapDay: '',
      summaryText: '',
    };
  }

  // Extract base calendar date from collectionWindow or collectionDay if not provided
  let baseDate = referenceInstallDate;
  if (!baseDate) {
    const combined = `${collectionWindow} ${collectionDay}`;
    const dateMatch = combined.match(/([0-1]?[0-9])\/([0-3]?[0-9])/);
    if (dateMatch) {
      const m = parseInt(dateMatch[1], 10);
      const d = parseInt(dateMatch[2], 10);
      const collDate = new Date(2026, m - 1, d);
      // Check if this date was already install date or collection date
      if (combined.toLowerCase().includes('install') || dateMatch.index === 0) {
        baseDate = { month: m, day: d, year: 2026 };
      } else {
        // 1 day before collection
        collDate.setDate(collDate.getDate() - 1);
        baseDate = { month: collDate.getMonth() + 1, day: collDate.getDate(), year: 2026 };
      }
    }
  }

  // If baseDate not yet resolved, derive from workWeek and installDay
  if (!baseDate) {
    const installIdx = installDay ? (DAY_INDEX_MAP[installDay] ?? 1) : 1;
    // Week 38 starts Sep 13, 2026; Week 37 starts Sep 6, 2026; Week 36 starts Aug 30, 2026
    let sundayDate = new Date(2026, 8, 13); // Default to 2026-W38 (Sep 13, 2026) so Monday is 9/14
    if (workWeek === '2026-W37') {
      sundayDate = new Date(2026, 8, 6);
    } else if (workWeek === '2026-W36') {
      sundayDate = new Date(2026, 7, 30);
    } else if (workWeek === '2026-W39') {
      sundayDate = new Date(2026, 8, 20);
    }
    const installDate = new Date(sundayDate);
    installDate.setDate(sundayDate.getDate() + installIdx);
    baseDate = {
      month: installDate.getMonth() + 1,
      day: installDate.getDate(),
      year: installDate.getFullYear(),
    };
  }

  // Determine install day index
  let installDayIdx = installDay ? DAY_INDEX_MAP[installDay] : -1;
  if (installDayIdx === -1 && baseDate) {
    const d = new Date(baseDate.year || 2026, baseDate.month - 1, baseDate.day);
    installDayIdx = d.getDay();
  }
  // Default to Monday (index 1) if unspecified
  if (installDayIdx === -1) {
    installDayIdx = 1;
  }

  // Teardown occurs at `consecutiveDays + 1` days after installation:
  // e.g. 3-day collection: Install 9/14 (Mon, Day 0) -> Collection: Tue, Wed, Thu -> Teardown 9/18 (Fri, Day 4 = 3 + 1)
  // e.g. 7-day collection: Install 9/14 (Mon, Day 0) -> Collection: 7 days -> Teardown 9/22 (Tue, Day 8 = 7 + 1)
  let teardownOffset = consecutiveDays + 1;

  // If teardownDay is explicitly provided and consecutiveCollectionDays was NOT explicitly forced,
  // ensure teardownOffset aligns with the physical difference between installDay and teardownDay
  if (teardownDay && !consecutiveCollectionDays) {
    const tdIdx = DAY_INDEX_MAP[teardownDay];
    if (tdIdx !== undefined && installDayIdx !== -1) {
      let diff = tdIdx - installDayIdx;
      if (diff <= 0) {
        diff += 7;
      }
      // If study is 7-day or notes suggest next week, add 7
      if (consecutiveDays >= 7 && diff < 7) {
        diff += 7;
      }
      if (diff >= 2) {
        teardownOffset = diff;
      }
    }
  }

  // Compute teardown day of week
  const computedTeardownDay = DAY_ORDER[(installDayIdx + teardownOffset) % 7];

  // Compute teardown calendar date if baseDate exists
  let teardownDate: string | undefined;
  if (baseDate) {
    const tdDateObj = new Date(baseDate.year || 2026, baseDate.month - 1, baseDate.day + teardownOffset);
    teardownDate = `${tdDateObj.getMonth() + 1}/${tdDateObj.getDate()}`;
  }

  const swapDays: WeekDay[] = [];
  const swapDates: string[] = [];

  // Add battery swaps starting 1 day after install (Day 2 / 48 hrs after install),
  // then every other day (+2 days) until teardown!
  for (let offset = 2; offset < teardownOffset; offset += 2) {
    // Weekday calculation
    const swapDayIdx = (installDayIdx + offset) % 7;
    swapDays.push(DAY_ORDER[swapDayIdx]);

    // Calendar date calculation
    if (baseDate) {
      const d = new Date(baseDate.year || 2026, baseDate.month - 1, baseDate.day + offset);
      swapDates.push(`${d.getMonth() + 1}/${d.getDate()}`);
    }
  }

  const summary =
    swapDates.length > 0
      ? swapDates.map((dt, i) => `${dt} (${swapDays[i]})`).join(', ')
      : swapDays.length > 0
      ? swapDays.join(', ')
      : '';

  return {
    consecutiveDays,
    teardownDay: teardownDay || computedTeardownDay,
    teardownDate,
    teardownOffset,
    batterySwapDays: swapDays,
    batterySwapDates: swapDates,
    batterySwapDay: swapDays[0] || '',
    summaryText: summary,
  };
}
