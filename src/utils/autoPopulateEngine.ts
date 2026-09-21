import { Project, WeekDay, Technician } from '../types';
import { calculateBatterySwaps } from './batterySwapEngine';

export interface AutoPopulateDetail {
  projectId: string;
  technician: string;
  installDay: WeekDay | '';
  teardownDay: WeekDay | '';
  prevInstallDay?: string;
  prevTeardownDay?: string;
  prevTech?: string;
  batterySwaps?: string;
  actionReason: string;
}

export interface AutoPopulateResult {
  updatedProjects: Project[];
  totalUpdated: number;
  installDaysAdded: number;
  teardownDaysAdded: number;
  batterySwapsAdded: number;
  techsAssigned: number;
  details: AutoPopulateDetail[];
}

const DAY_MAP: { [key: string]: WeekDay } = {
  sunday: 'Sunday',
  sun: 'Sunday',
  '8/30': 'Sunday',
  '08/30': 'Sunday',

  monday: 'Monday',
  mon: 'Monday',
  '8/31': 'Monday',
  '08/31': 'Monday',

  tuesday: 'Tuesday',
  tues: 'Tuesday',
  tue: 'Tuesday',
  '9/1': 'Tuesday',
  '09/01': 'Tuesday',

  wednesday: 'Wednesday',
  wed: 'Wednesday',
  '9/2': 'Wednesday',
  '09/02': 'Wednesday',

  thursday: 'Thursday',
  thurs: 'Thursday',
  thu: 'Thursday',
  '9/3': 'Thursday',
  '09/03': 'Thursday',

  friday: 'Friday',
  fri: 'Friday',
  '9/4': 'Friday',
  '09/04': 'Friday',

  saturday: 'Saturday',
  sat: 'Saturday',
  '9/5': 'Saturday',
  '09/05': 'Saturday',
};

const NEXT_DAYS: Record<WeekDay, WeekDay> = {
  Sunday: 'Monday',
  Monday: 'Tuesday',
  Tuesday: 'Wednesday',
  Wednesday: 'Thursday',
  Thursday: 'Friday',
  Friday: 'Saturday',
  Saturday: 'Sunday',
};

const PREV_DAYS: Record<WeekDay, WeekDay> = {
  Sunday: 'Saturday',
  Monday: 'Sunday',
  Tuesday: 'Monday',
  Wednesday: 'Tuesday',
  Thursday: 'Wednesday',
  Friday: 'Thursday',
  Saturday: 'Friday',
};

export function getPreviousDay(day: WeekDay): WeekDay {
  return PREV_DAYS[day];
}

function addDaysToWeekDay(day: WeekDay, daysToAdd: number): WeekDay {
  let curr = day;
  for (let i = 0; i < daysToAdd; i++) {
    curr = NEXT_DAYS[curr];
  }
  return curr;
}

/**
 * Searches a text blob for mention of a weekday or date.
 */
function extractDayFromText(text?: string): WeekDay | null {
  if (!text) return null;
  const lower = text.toLowerCase();

  // Explicit day names first
  if (lower.includes('sunday') || lower.includes('sun ') || lower.includes('8/30')) return 'Sunday';
  if (lower.includes('monday') || lower.includes('mon ') || lower.includes('8/31')) return 'Monday';
  if (lower.includes('tuesday') || lower.includes('tues') || lower.includes('tue ') || lower.includes('9/1') || lower.includes('09/01')) return 'Tuesday';
  if (lower.includes('wednesday') || lower.includes('wed ') || lower.includes('9/2') || lower.includes('09/02')) return 'Wednesday';
  if (lower.includes('thursday') || lower.includes('thurs') || lower.includes('thu ') || lower.includes('9/3') || lower.includes('09/03')) return 'Thursday';
  if (lower.includes('friday') || lower.includes('fri ') || lower.includes('9/4') || lower.includes('09/04')) return 'Friday';
  if (lower.includes('saturday') || lower.includes('sat ') || lower.includes('9/5')) return 'Saturday';

  return null;
}

/**
 * Extracts teardown day specifically from notes or collection window
 */
function extractTeardownFromText(notesText?: string, installDay?: WeekDay | ''): WeekDay | null {
  if (!notesText) return null;
  const lower = notesText.toLowerCase();

  // Look for "teardown <date/day>"
  const tdIndex = lower.indexOf('teardown');
  if (tdIndex !== -1) {
    const afterTd = lower.substring(tdIndex);
    if (afterTd.includes('24 hrs') || afterTd.includes('24hrs') || afterTd.includes('next day') || afterTd.includes('24 hours')) {
      if (installDay) return addDaysToWeekDay(installDay, 1);
    }
    if (afterTd.includes('48 hrs') || afterTd.includes('48hrs') || afterTd.includes('48 hours')) {
      if (installDay) return addDaysToWeekDay(installDay, 2);
    }
    if (afterTd.includes('72 hrs') || afterTd.includes('72hrs')) {
      if (installDay) return addDaysToWeekDay(installDay, 3);
    }
    // Specific date/day after "teardown"
    const extracted = extractDayFromText(afterTd.slice(0, 50));
    if (extracted) return extracted;
  }

  // Fallback check in entire text
  if (installDay) {
    if (lower.includes('teardown 24 hrs') || lower.includes('teardown 24hrs')) {
      return addDaysToWeekDay(installDay, 1);
    }
    if (lower.includes('teardown after 09/04') || lower.includes('teardown 9/4') || lower.includes('teardown friday')) {
      return 'Friday';
    }
    if (lower.includes('teardown 9/3') || lower.includes('teardown thursday')) {
      return 'Thursday';
    }
    if (lower.includes('teardown 9/2') || lower.includes('teardown wednesday')) {
      return 'Wednesday';
    }
  }

  return null;
}

/**
 * Finds the best technician based on geographical region and current workload
 */
function matchTechnicianByRegion(
  cityState: string,
  technicians: Technician[],
  projects: Project[]
): Technician | null {
  if (!cityState || !technicians || technicians.length === 0) return null;
  const lower = cityState.toLowerCase();

  // Find candidate region
  let targetRegion: string = '';
  if (lower.includes('dallas') || lower.includes('ft worth') || lower.includes('fort worth') || lower.includes('plano') || lower.includes('arlington')) {
    targetRegion = 'TX (Dallas)';
  } else if (lower.includes('houston') || lower.includes('college station') || lower.includes('conroe') || lower.includes('katy') || lower.includes('sugar land')) {
    targetRegion = 'TX (Houston)';
  } else if (lower.includes('la') || lower.includes('louisiana') || lower.includes('livingston') || lower.includes('hammond') || lower.includes('baton rouge')) {
    targetRegion = 'LA';
  } else if (lower.includes('co') || lower.includes('colorado') || lower.includes('denver') || lower.includes('boulder') || lower.includes('aurora')) {
    targetRegion = 'CO';
  } else if (lower.includes('tx') || lower.includes('texas')) {
    // General Texas fallback: prefer Houston or Dallas
    targetRegion = 'TX (Houston)';
  }

  // Filter techs by region
  const regionalTechs = technicians.filter((t) => t.active && (!targetRegion || t.region.includes(targetRegion) || targetRegion.includes(t.region)));
  if (regionalTechs.length === 0) {
    // Fall back to any active tech
    return technicians.find((t) => t.active) || null;
  }

  // Choose the tech with the fewest assigned equipment units
  let bestTech = regionalTechs[0];
  let minLoad = Infinity;

  regionalTechs.forEach((t) => {
    const techLoad = projects
      .filter((p) => p.technician === t.name)
      .reduce((acc, p) => acc + (p.equipmentCount || 0), 0);
    if (techLoad < minLoad) {
      minLoad = techLoad;
      bestTech = t;
    }
  });

  return bestTech;
}

/**
 * Main Auto-Population Engine:
 * Analyzes projects from the Monitoring Sheet and automatically:
 * 1. Sets missing Install Day from Collection Window, Collection Day, or Notes
 * 2. Sets missing Teardown Day from Notes or collection duration
 * 3. Smart-assigns unassigned projects to technicians based on City/State market
 * 4. Ensures the Scheduler Matrix is fully populated with all jobs from the sheet
 */
export function autoPopulateSchedulerMatrix(
  projects: Project[],
  technicians: Technician[]
): AutoPopulateResult {
  let installDaysAdded = 0;
  let teardownDaysAdded = 0;
  let batterySwapsAdded = 0;
  let techsAssigned = 0;
  const details: AutoPopulateDetail[] = [];

  const updatedProjects = projects.map((p) => {
    let changed = false;
    let newInstallDay = p.installDay;
    let newTeardownDay = p.teardownDay;
    let newTechnician = p.technician;
    const reasons: string[] = [];

    // 1. Install Day Auto-Population: Reference for Install Date is 1 day before the Collection Window / Collection Date
    if (!newInstallDay) {
      let detectedCollDay = extractDayFromText(p.collectionDay);
      if (!detectedCollDay) {
        detectedCollDay = extractDayFromText(p.collectionWindow);
      }

      if (detectedCollDay) {
        // Install date is 1 day before the collection window/date
        newInstallDay = getPreviousDay(detectedCollDay);
        changed = true;
        installDaysAdded++;
        reasons.push(`Install day set to ${newInstallDay} (1 day before Collection Date: ${detectedCollDay})`);
      } else {
        // Fallback to notes
        const detectedInstallFromNotes = extractDayFromText(p.schedulerNotes) || extractDayFromText(p.analystNotes);
        if (detectedInstallFromNotes) {
          newInstallDay = detectedInstallFromNotes;
          changed = true;
          installDaysAdded++;
          reasons.push(`Install day set to ${detectedInstallFromNotes} from scheduler/analyst notes`);
        }
      }
    }

    // 2. Teardown Day Auto-Population
    if (!newTeardownDay) {
      const combinedNotes = `${p.schedulerNotes || ''} ${p.analystNotes || ''} ${p.collectionWindow || ''}`;
      const detectedTeardown = extractTeardownFromText(combinedNotes, newInstallDay);

      if (detectedTeardown) {
        newTeardownDay = detectedTeardown;
        changed = true;
        teardownDaysAdded++;
        reasons.push(`Teardown day set to ${detectedTeardown} from teardown notes`);
      } else if (newInstallDay) {
        // Standard study fallback: 2 days after install (e.g. Tuesday -> Thursday, Wednesday -> Friday)
        // Check study type
        const fallbackDays = p.studyType === 'ATR' || p.studyType === 'ATR (Camera)' ? 3 : 2;
        const defaultTd = addDaysToWeekDay(newInstallDay, fallbackDays);
        newTeardownDay = defaultTd;
        changed = true;
        teardownDaysAdded++;
        reasons.push(`Teardown day calculated as ${defaultTd} (${fallbackDays}-day study)`);
      }
    }

    // 3. Battery Swap Calculation for Projects collecting 3+ consecutive days
    // Rule: Add battery swaps 2 days after installation and add another every other day until teardown
    let newBatterySwapDays = p.batterySwapDays;
    let newBatterySwapDates = p.batterySwapDates;
    let newBatterySwapDay = p.batterySwapDay;
    let newConsecutiveDays = p.consecutiveCollectionDays;

    const swapResult = calculateBatterySwaps({
      collectionWindow: p.collectionWindow,
      collectionDay: p.collectionDay,
      schedulerNotes: p.schedulerNotes,
      analystNotes: p.analystNotes,
      installDay: newInstallDay,
      teardownDay: newTeardownDay,
      studyType: p.studyType,
      consecutiveCollectionDays: p.consecutiveCollectionDays,
    });

    if (swapResult.consecutiveDays >= 2 && swapResult.batterySwapDays.length > 0) {
      if (
        !p.batterySwapDays ||
        p.batterySwapDays.length === 0 ||
        p.batterySwapDays.length !== swapResult.batterySwapDays.length
      ) {
        newBatterySwapDays = swapResult.batterySwapDays;
        newBatterySwapDates = swapResult.batterySwapDates;
        newBatterySwapDay = swapResult.batterySwapDay;
        newConsecutiveDays = swapResult.consecutiveDays;
        changed = true;
        batterySwapsAdded++;
        reasons.push(
          `Battery Swap scheduled for ${swapResult.consecutiveDays}-day collection: ${swapResult.summaryText}`
        );
      }
    }

    // 4. Technician Auto-Assignment if Unassigned
    if (!newTechnician || newTechnician === 'Unassigned') {
      const matched = matchTechnicianByRegion(p.cityState, technicians, projects);
      if (matched) {
        newTechnician = matched.name;
        changed = true;
        techsAssigned++;
        reasons.push(`Assigned to ${matched.name} (${matched.region}) based on market`);
      }
    }

    // 5. Update Ops Status if ready
    let newOpsStatus = p.opsStatus;
    if (newTechnician && newTechnician !== 'Unassigned' && newInstallDay) {
      if (p.opsStatus === 'Needs Scheduling') {
        newOpsStatus = 'Scheduled to techs';
        changed = true;
      }
    }

    if (changed) {
      details.push({
        projectId: p.id,
        technician: newTechnician,
        installDay: newInstallDay,
        teardownDay: newTeardownDay,
        prevInstallDay: p.installDay,
        prevTeardownDay: p.teardownDay,
        prevTech: p.technician,
        batterySwaps: swapResult.summaryText || undefined,
        actionReason: reasons.join('; '),
      });

      return {
        ...p,
        installDay: newInstallDay,
        teardownDay: newTeardownDay,
        batterySwapDay: newBatterySwapDay,
        batterySwapDays: newBatterySwapDays,
        batterySwapDates: newBatterySwapDates,
        consecutiveCollectionDays: newConsecutiveDays,
        technician: newTechnician,
        opsStatus: newOpsStatus,
        lastUpdated: new Date().toISOString(),
      };
    }

    return p;
  });

  return {
    updatedProjects,
    totalUpdated: details.length,
    installDaysAdded,
    teardownDaysAdded,
    batterySwapsAdded,
    techsAssigned,
    details,
  };
}
