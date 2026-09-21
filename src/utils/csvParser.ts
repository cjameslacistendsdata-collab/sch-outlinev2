import { Project, OpsStatus, ScheduleStatus, StudyType, WeekDay, EquipmentType } from '../types';
import { determineWorkWeekFromInstallDate, normalizeWorkWeekString } from './workWeekEngine';
import { formatDateTimeSent } from './dateTimeFormat';
import { calculateBatterySwaps } from './batterySwapEngine';
import { TECHNICIANS } from '../data/technicians';
import { INITIAL_PROJECTS } from '../data/initialProjects';
import { splitTechnicianNames, cleanTechName, matchKnownTechnician } from './technicianUtils';

const PREV_DAYS: Record<WeekDay, WeekDay> = {
  Sunday: 'Saturday',
  Monday: 'Sunday',
  Tuesday: 'Monday',
  Wednesday: 'Tuesday',
  Thursday: 'Wednesday',
  Friday: 'Thursday',
  Saturday: 'Friday',
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

function getPreviousDay(day: WeekDay): WeekDay {
  return PREV_DAYS[day];
}

function addDaysToWeekDay(day: WeekDay, daysToAdd: number): WeekDay {
  let curr = day;
  for (let i = 0; i < daysToAdd; i++) {
    curr = NEXT_DAYS[curr];
  }
  return curr;
}

function extractDayFromText(text?: string): WeekDay | null {
  if (!text) return null;
  const lower = text.toLowerCase();
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
 * Standard RFC 4180 CSV parser that properly handles:
 * - Commas within quoted fields
 * - Double quotes inside quotes ("" -> ")
 * - Line breaks inside quoted strings (multi-line notes)
 * - Windows CRLF and Unix LF
 * - UTF-8 BOM
 */
function cleanCSVField(field: string): string {
  let val = field.trim();
  while (
    (val.startsWith('"') && val.endsWith('"') && val.length >= 2) ||
    (val.startsWith("'") && val.endsWith("'") && val.length >= 2)
  ) {
    val = val.slice(1, -1).trim();
  }
  return val;
}

/**
 * Robust CSV string parser that correctly handles:
 * - Quoted fields containing commas
 * - Escaped quotes ("")
 * - CRLF and LF line endings
 * - UTF-8 BOM
 */
export function parseCSVString(csvText: string): string[][] {
  // Remove BOM if present
  let cleanText = csvText;
  if (cleanText.charCodeAt(0) === 0xfeff) {
    cleanText = cleanText.slice(1);
  }

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = i + 1 < cleanText.length ? cleanText[i + 1] : '';

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote
          currentField += '"';
          i++; // Skip the second quote
        } else {
          // End of quoted string
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        if (currentField.trim() === '') {
          currentField = '';
        }
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(cleanCSVField(currentField));
        currentField = '';
      } else if (char === '\r') {
        if (nextChar === '\n') {
          i++; // Skip \n
        }
        currentRow.push(cleanCSVField(currentField));
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else if (char === '\n') {
        currentRow.push(cleanCSVField(currentField));
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
  }

  // Push final field and row if any
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(cleanCSVField(currentField));
    rows.push(currentRow);
  }

  // Filter out any completely blank rows
  return rows.filter((row) => row.some((field) => field.trim().length > 0));
}

/**
 * Safely parses quantities from Airtable/CSV fields.
 * Handles float formatting from Airtable exports such as "10.0", "1.0", "2.0"
 * preventing them from being stripped into "100", "10", "20".
 */
export function parseNumericQuantity(val: any, fallback: number = 0): number {
  if (val === undefined || val === null || val === '') return fallback;
  if (typeof val === 'number') return isNaN(val) ? fallback : val;
  const str = String(val).trim();
  if (!str) return fallback;

  // Clean out commas like "1,000.0" -> "1000.0"
  const cleaned = str.replace(/,/g, '');

  // Match decimal or integer numbers: e.g. "10.0", "10", "2.5"
  const match = cleaned.match(/[-+]?[0-9]+(?:\.[0-9]+)?/);
  if (match) {
    const num = parseFloat(match[0]);
    if (!isNaN(num)) {
      return Math.round(num);
    }
  }
  return fallback;
}

/**
 * Formats a project ID following the standard:
 * <Project #> <City, State> (e.g. "26-620003 ME", "26-480128 Santa Fe, NM", "26-320020 Middletown, PA")
 * If cityState is missing or "Unspecified", returns just the project number.
 * Avoids duplicating the city if it is already present in the project number.
 */
export function formatProjectId(projectNumber: string, cityState?: string): string {
  const cleanProj = (projectNumber || '').trim();
  const cleanCity = (cityState || '').replace(/["'_]/g, ' ').trim();
  if (!cleanProj) return '';
  if (!cleanCity || cleanCity.toLowerCase() === 'unspecified') return cleanProj;

  const projLower = cleanProj.toLowerCase();
  const cityLower = cleanCity.toLowerCase();
  if (projLower.endsWith(cityLower) || projLower.includes(cityLower)) {
    return cleanProj;
  }

  return `${cleanProj} ${cleanCity}`.trim();
}

/**
 * Extracts the base/parent project number, optional location suffix, and optional city
 * from a raw project or location string.
 * Examples:
 * - "26-620003-1084" -> parent: "26-620003", loc: "1084", city: undefined
 * - "26-320020-001" -> parent: "26-320020", loc: "001", city: undefined
 * - "26-480128 Santa Fe, NM" -> parent: "26-480128", loc: "", city: "Santa Fe, NM"
 * - "26-470294_McLennan County, TX" -> parent: "26-470294", loc: "", city: "McLennan County, TX"
 * - "26-620003-1084 ME" -> parent: "26-620003", loc: "1084", city: "ME"
 */
export function parseProjectNumberAndLocation(raw: string): {
  parentProjectNumber: string;
  locationSuffix: string;
  cityPart?: string;
  cleanRaw: string;
} {
  if (!raw) return { parentProjectNumber: '', locationSuffix: '', cleanRaw: '' };

  let cleaned = raw.replace(/["'\\]/g, '').trim();
  cleaned = cleaned.replace(/\s*\([^)]*https?:\/\/[^)]*\)/gi, '').trim();
  cleaned = cleaned.replace(/[_ -]*cover\s*sheet.*$/gi, '').trim();
  cleaned = cleaned.replace(/\.pdf$/i, '').trim();
  cleaned = cleaned.replace(/^[-_ ]+|[-_ ]+$/g, '').trim();

  // Pattern A: Has location suffix e.g. "26-620003-1084", "26-320020-001", "26-620003-1084 ME"
  const locMatch = cleaned.match(/^(26-[A-Za-z0-9]{4,7})-([A-Za-z0-9]{1,6})(?:[_\s]+(.*))?$/i);
  if (locMatch) {
    const parentProjectNumber = locMatch[1].trim();
    const locationSuffix = locMatch[2].trim();
    const cityPart = locMatch[3] ? locMatch[3].replace(/_/g, ' ').trim().replace(/^[-_ ]+|[-_ ]+$/g, '') : undefined;
    return {
      parentProjectNumber,
      locationSuffix,
      cityPart: cityPart || undefined,
      cleanRaw: cleaned,
    };
  }

  // Pattern B: Parent project number followed by space or underscore and City/State
  // e.g. "26-480128 Santa Fe, NM" or "26-470294_McLennan County, TX"
  const cityMatch = cleaned.match(/^([A-Za-z0-9-]+)[_\s]+(.*)$/);
  if (cityMatch) {
    const parentProjectNumber = cityMatch[1].trim();
    const cityPart = cityMatch[2].replace(/_/g, ' ').trim().replace(/^[-_ ]+|[-_ ]+$/g, '');
    return {
      parentProjectNumber,
      locationSuffix: '',
      cityPart: cityPart || undefined,
      cleanRaw: cleaned,
    };
  }

  return {
    parentProjectNumber: cleaned.replace(/_/g, ' ').trim(),
    locationSuffix: '',
    cityPart: undefined,
    cleanRaw: cleaned,
  };
}

/**
 * Sanitizes project IDs and cover sheets from CSV / Airtable exports.
 * Rule: Only include the Project number and City, State. Remove underscore and quotation.
 * E.g. '"26-470302_Richardson, TX_Cover Sheet V2.0.pdf (https://v5.airtableusercontent.com/...)"' -> '26-470302 Richardson, TX'
 */
export function sanitizeProjectId(raw: string): {
  id: string;
  projectNumber: string;
  cityState?: string;
  locationSuffix?: string;
} {
  if (!raw) return { id: '', projectNumber: '' };
  const parsed = parseProjectNumberAndLocation(raw);
  const formattedId = formatProjectId(parsed.parentProjectNumber, parsed.cityPart);

  return {
    id: formattedId || parsed.parentProjectNumber || raw,
    projectNumber: parsed.parentProjectNumber,
    cityState: parsed.cityPart,
    locationSuffix: parsed.locationSuffix || undefined,
  };
}

/**
 * Normalizes header strings by lowercasing and stripping special chars
 */
function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, '');
}

const DAY_ORDER: WeekDay[] = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/**
 * Normalizes day of week to valid WeekDay or empty string.
 * Accurately parses:
 * - Direct weekday names: "Tuesday", "Wednesday", "mon", "tue", etc.
 * - Exact dates/timestamps from CSV: "9/9/2026 23:00", "9/8/2026", "09/08/2026", "9/14/2026", "9/15", "09/16", etc.
 * - Comma-separated day values: "Monday,Tuesday" -> returns primary day "Monday"
 */
export function normalizeDay(value?: string): WeekDay | '' {
  if (!value) return '';
  const trimmed = value.trim();
  if (!trimmed) return '';

  // 1. If comma-separated (e.g. "Monday,Tuesday"), take the first day
  const firstPart = trimmed.includes(',') ? trimmed.split(',')[0].trim() : trimmed;
  const v = firstPart.toLowerCase();

  // 2. Direct weekday names or prefixes
  if (v.startsWith('sun') || v === 'sunday') return 'Sunday';
  if (v.startsWith('mon') || v === 'monday') return 'Monday';
  if (v.startsWith('tue') || v === 'tuesday') return 'Tuesday';
  if (v.startsWith('wed') || v === 'wednesday') return 'Wednesday';
  if (v.startsWith('thu') || v === 'thursday') return 'Thursday';
  if (v.startsWith('fri') || v === 'friday') return 'Friday';
  if (v.startsWith('sat') || v === 'saturday') return 'Saturday';

  // 3. Exact calendar date matching (e.g. "9/9/2026 23:00", "09/08/2026", "9/14")
  const dateMatch = v.match(/([0-1]?[0-9])\/([0-3]?[0-9])(?:\/([0-9]{2,4}))?/);
  if (dateMatch) {
    const month = parseInt(dateMatch[1], 10);
    const day = parseInt(dateMatch[2], 10);
    let year = dateMatch[3] ? parseInt(dateMatch[3], 10) : 2026;
    if (year < 100) year += 2000;
    const dt = new Date(year, month - 1, day);
    if (!isNaN(dt.getTime())) {
      return DAY_ORDER[dt.getDay()];
    }
  }

  // Exact calendar date matching YYYY-MM-DD
  const isoMatch = v.match(/([0-9]{4})-([0-1]?[0-9])-([0-3]?[0-9])/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    const dt = new Date(year, month - 1, day);
    if (!isNaN(dt.getTime())) {
      return DAY_ORDER[dt.getDay()];
    }
  }

  // 4. Also check substring mentions
  for (const day of DAY_ORDER) {
    if (v.includes(day.toLowerCase()) || v.includes(day.slice(0, 3).toLowerCase())) {
      return day;
    }
  }

  return '';
}

/**
 * Extracts date string "M/D" from a date or datetime string e.g. "9/9/2026 23:00" -> "9/9"
 */
export function extractDateStr(value?: string): string | undefined {
  if (!value) return undefined;
  const match = value.match(/([0-1]?[0-9])\/([0-3]?[0-9])/);
  if (match) {
    const m = parseInt(match[1], 10);
    const d = parseInt(match[2], 10);
    return `${m}/${d}`;
  }
  return undefined;
}

/**
 * Deterministically assigns a regional technician based on geographical market and city/state
 */
export function assignRegionalTech(cityState: string, projectId: string): string {
  const lower = (cityState || '').toLowerCase();
  // Colorado Team (Green)
  if (
    lower.includes('co') ||
    lower.includes('colorado') ||
    lower.includes('denver') ||
    lower.includes('weld') ||
    lower.includes('boulder') ||
    lower.includes('golden') ||
    lower.includes('commerce city') ||
    lower.includes('mead') ||
    lower.includes('johnstown') ||
    lower.includes('berthoud') ||
    lower.includes('evergreen')
  ) {
    return 'Juan Espinoza';
  }
  // Louisiana Team (Burgundy)
  if (
    lower.includes('la') ||
    lower.includes('louisiana') ||
    lower.includes('new orleans') ||
    lower.includes('jefferson') ||
    lower.includes('baton rouge') ||
    lower.includes('lafayette') ||
    lower.includes('livingston') ||
    lower.includes('hammond') ||
    lower.includes('haughton')
  ) {
    return 'Gilliam Johns';
  }
  // Texas Dallas Team (Navy)
  if (
    lower.includes('dallas') ||
    lower.includes('justin') ||
    lower.includes('fort worth') ||
    lower.includes('richardson') ||
    lower.includes('quanah') ||
    lower.includes('mclennan') ||
    lower.includes('collin') ||
    lower.includes('denton')
  ) {
    return 'Treyvon Watts';
  }
  // Texas Houston Team (Orange)
  return 'Dustin Fullerton';
}

/**
 * Normalizes Project Status - preserves exact imported status from CSV
 */
export function normalizeOpsStatus(val?: string, tech?: string): OpsStatus {
  if (val && val.trim() !== '') {
    return val.trim();
  }
  return tech && tech !== 'Unassigned' ? 'Scheduled to techs' : 'Needs Scheduling';
}

/**
 * Normalizes Schedule Status - defaults to blank unless specified
 */
export function normalizeScheduleStatus(val?: string): ScheduleStatus {
  if (!val || val.trim() === '') return '';
  const s = val.trim().toLowerCase();
  if (s === 'schedule sent' || s.includes('sent')) {
    return 'SCHEDULE SENT';
  }
  if (s === 'pending' || s.includes('pending') || s.includes('needs sched')) {
    return 'PENDING';
  }
  return val.trim();
}

/**
 * Normalizes Study Type - synced with Service Types from the CSV
 */
export function normalizeStudyType(val?: string): StudyType {
  if (!val || val.trim() === '') return 'TMC';
  const raw = val.trim();
  const s = raw.toUpperCase();

  // 1. Camera ATR variants (prioritize camera over plain ATR)
  if (
    s.includes('ATR (CAMERA)') ||
    s.includes('ATR(CAMERA)') ||
    s.includes('ATR CAMERA') ||
    s.includes('CAMERA ATR') ||
    s.includes('VIDEO ATR') ||
    s.includes('MIOVISION') ||
    (s.includes('ATR') && s.includes('CAMERA'))
  ) {
    return 'ATR (Camera)';
  }

  // 2. Pneumatic Tube / Machine ATR variants
  if (
    s === 'ATR' ||
    s.startsWith('ATR') ||
    s.includes('PNEUMATIC') ||
    s.includes('ROAD TUBE') ||
    s.includes('TUBE') ||
    s.includes('AXLE') ||
    s.includes('AUTOMATIC TRAFFIC RECORDER')
  ) {
    return 'ATR';
  }

  // 3. Screenline
  if (s.includes('SCREENLINE') || s.includes('SCREEN LINE')) {
    return 'Screenline';
  }

  // 4. Video Review
  if (s.includes('VIDEO REVIEW') || s.includes('VIDEO AUDIT') || s === 'VIDEO') {
    return 'Video Review';
  }

  // 5. LADOTD / Annual Counts
  if (s.includes('LADOT') || s.includes('ANNUAL')) {
    return 'LADOTD Annual Counts';
  }

  // 6. Turning Movement Counts (TMC)
  if (s.includes('TMC') || s.includes('TURNING') || s.includes('INTERSECTION')) {
    return 'TMC';
  }

  // 7. Volume / Speed / Classification counts without camera -> ATR
  if (s.includes('VOLUME') || s.includes('SPEED') || s.includes('CLASSIFICATION') || s.includes('CLASS')) {
    return 'ATR';
  }

  // 8. If custom string provided, preserve original text
  return raw;
}

export interface ParseAirtableResult {
  projects: Project[];
  totalParsed: number;
  matchedHeaders: Record<string, string>;
  warnings: string[];
}

/**
 * Parses raw Airtable CSV string into typed Project objects
 */
export function parseAirtableCSV(csvContent: string): ParseAirtableResult {
  const rows = parseCSVString(csvContent);
  const warnings: string[] = [];

  if (rows.length < 2) {
    throw new Error('The CSV file does not contain enough data (missing header row or data rows).');
  }

  const rawHeaders = rows[0];
  const headerMap: Record<string, number> = {};

  rawHeaders.forEach((header, index) => {
    headerMap[normalizeHeader(header)] = index;
  });

  // Helper to find column index with strict prioritization:
  // Step 1: Exact normalized match across all aliases first
  // Step 2: Specific substring/prefix match with conflict guards
  const findColumn = (...aliases: string[]): number => {
    // Pass 1: Strict exact match across all aliases
    for (const alias of aliases) {
      const norm = normalizeHeader(alias);
      if (headerMap[norm] !== undefined) {
        return headerMap[norm];
      }
    }
    // Pass 2: Controlled prefix/suffix match with strict boundary guards
    for (const alias of aliases) {
      const norm = normalizeHeader(alias);
      for (const [key, idx] of Object.entries(headerMap)) {
        // Disambiguation guards:
        // Never let project ID alias match a status/name/type/date/notes/summary column
        if (
          (norm === 'project' || norm === 'id' || norm === 'projectid' || norm === 'projectnumber') &&
          (key.includes('status') || key.includes('name') || key.includes('type') || key.includes('manager') || key.includes('date') || key.includes('note') || key.includes('summary'))
        ) {
          continue;
        }
        // Never let city/location alias match an ID or project column or location count column
        if (
          (norm === 'city' || norm === 'citystate' || norm === 'location' || norm === 'market') &&
          (key.includes('id') || key.includes('project') || key.includes('count') || key.includes('number') || key.includes('num') || key.includes('status') || key.includes('note') || key.includes('summary'))
        ) {
          continue;
        }
        // Never let location count aliases (e.g. locations, numlocations, nooflocations) match an ID or project column
        if (
          (norm.includes('location') || norm.includes('loc')) &&
          !norm.includes('id') &&
          (key.includes('id') || key.includes('project'))
        ) {
          continue;
        }
        // Never let a status alias match a non-status column (like "project")
        if (norm.includes('status') && !key.includes('status') && !key.includes('state')) {
          continue;
        }
        // Never let ops/project status match schedule status
        if ((norm.includes('projectstatus') || norm.includes('opsstatus') || norm.includes('statusops')) && key.includes('sched')) {
          continue;
        }
        // Never let schedule status match ops/project status
        if (norm.includes('sched') && !key.includes('sched')) {
          continue;
        }
        // Never let service type alias match service addons column
        if (norm.includes('service') && key.includes('addon')) {
          continue;
        }

        if (key === norm || key.startsWith(norm) || (norm.length > 5 && key.includes(norm))) {
          return idx;
        }
      }
    }
    return -1;
  };

  // Specific Project ID detection: Prioritize location-level Project ID columns
  // (e.g. "PROJECT ID (FROM LOCATIONS)", "Project ID (from Locations)") used by other regions
  // before general "Project #" or "Project"
  const idCol = findColumn(
    'projectidfromlocations',
    'projectidfromlocation',
    'projectfromlocations',
    'projectnumberfromlocations',
    'projectnumberfromlocation',
    'locationidfromlocations',
    'locationprojectid',
    'projectid',
    'projectnumber',
    'projectno',
    'projectnum',
    'project#',
    'locationid',
    'locationnumber',
    'locationnum',
    'study#',
    'job#',
    'project',
    'recordid',
    'id'
  );

  // Collect all candidate Project ID columns across regions in priority order
  const candidateIdAliases = [
    'projectidfromlocations',
    'projectidfromlocation',
    'projectfromlocations',
    'projectnumberfromlocations',
    'projectnumberfromlocation',
    'locationidfromlocations',
    'locationprojectid',
    'projectid',
    'projectnumber',
    'projectno',
    'projectnum',
    'project#',
    'locationid',
    'locationnumber',
    'locationnum',
    'study#',
    'job#',
    'project',
    'recordid',
    'id',
  ];
  const candidateIdCols: number[] = [];
  for (const alias of candidateIdAliases) {
    const colIdx = findColumn(alias);
    if (colIdx !== -1 && !candidateIdCols.includes(colIdx)) {
      candidateIdCols.push(colIdx);
    }
  }
  for (const [key, idx] of Object.entries(headerMap)) {
    if (
      (key.includes('project') || key.includes('location') || key.includes('job') || key.includes('study')) &&
      (key.includes('id') || key.includes('num') || key.includes('#')) &&
      !key.includes('status') &&
      !key.includes('date') &&
      !key.includes('name') &&
      !key.includes('manager') &&
      !key.includes('type') &&
      !key.includes('note') &&
      !key.includes('summary') &&
      !candidateIdCols.includes(idx)
    ) {
      candidateIdCols.push(idx);
    }
  }
  const cityCol = findColumn('citystate', 'city', 'location', 'city&state', 'market');
  const opsStatusCol = findColumn('projectstatus', 'statusops', 'opsstatus', 'operationalstatus', 'jobstatus', 'status', 'projectstate', 'state');
  const schedStatusCol = findColumn('schedulestatus', 'schedulingstatus', 'schedstatus', 'schedstate', 'schedulestate');
  const versionCol = findColumn('version', 'rev');
  const opsAuditDateCol = findColumn(
    'opsauditdate',
    'opsaudit',
    'auditdate',
    'auditdateops',
    'opsauditdatetime',
    'auditdatetime',
    'datesentopsaudit',
    'datesentopsauditdate',
    'opsauditdatedatesent',
    'auditeddate',
    'opsaudittimestamp',
    'opsauditday'
  );
  const dateSentCol = findColumn('datesent', 'sentdate', 'schedsentdate', 'datesentcalendar', 'datesenttime', 'datesentschedule');
  const studyCol = findColumn(
    'servicetypes',
    'servicetype',
    'service_types',
    'service_type',
    'services',
    'service',
    'studytype',
    'study',
    'counttype'
  );
  const serviceAddonsCol = findColumn(
    'servicetypeaddons',
    'serviceaddons',
    'addonservices',
    'addons',
    'addon'
  );
  const locationIdCol = findColumn(
    'locationid',
    'locationids',
    'locationno',
    'locationnum',
    'locationnumber',
    'locid',
    'locids',
    'locationidentifier',
    'locationcode',
    'loccode'
  );
  const locCol = findColumn(
    'nooflocations',
    'numberoflocations',
    'locationscount',
    'numlocations',
    '#locations',
    'locations',
    'locationcount',
    'loccount',
    'locs'
  );
  const scheduleDetailsCol = findColumn(
    'scheduledetails',
    'scheduledetail',
    'collectionsummary',
    'schedsummary',
    'schedulesummary',
    'scheddetails',
    'summary'
  );
  const daysCountCol = findColumn(
    'ofdays',
    'noofdays',
    'numberofdays',
    'numdays',
    'days',
    'durationdays',
    'duration',
    'collectiondays',
    'daycount',
    'consecutivedays',
    '#ofdays',
    '#days'
  );
  
  // Explicit detection for "# of Camera Units Needed" and "# of Machine Units Needed" from CSV
  // "Sync the number of Equipment (Units) to Total Units"
  const totalUnitsCol = findColumn(
    'totalunits',
    'totalunitsneeded',
    'totalunit',
    'totalunitneeded',
    'ofequipmentunits',
    'ofequipmentunitsneeded',
    'equipmentunits',
    'equipmentunitsneeded',
    'equipmentcameramachineunits',
    'total#ofunits',
    'totalnoofunits',
    'total'
  );
  const cameraUnitsCol = findColumn(
    'ofcameraunitsneeded',
    'cameraunitsneeded',
    'cameraunits',
    'noofcameraunitsneeded',
    'numberofcameraunitsneeded',
    'numcameraunitsneeded',
    'ofcamerasneeded',
    'camerasneeded',
    'cameraneeded',
    'ofcameraunits',
    'cameraunit',
    'cameracount',
    'cameratotal',
    'noofcameras',
    'cameras',
    'camera'
  );
  const machineUnitsCol = findColumn(
    'ofmachineunitsneeded',
    'machineunitsneeded',
    'machineunits',
    'noofmachineunitsneeded',
    'numberofmachineunitsneeded',
    'nummachineunitsneeded',
    'ofmachinesneeded',
    'machinesneeded',
    'ofmachineunits',
    'machineunit',
    'machinecount',
    'noofmachines',
    'machines',
    'machine'
  );
  const equipCol = findColumn(
    'ofequipmentcameramachineunits',
    'noofequipmentcameramachineunits',
    'ofequipmentunitsneeded',
    'equipmentunitsneeded',
    'noofequipment',
    'ofequipment',
    'equipmentcount',
    'equipment',
    'unitsneeded',
    'ofunitsneeded',
    'totalunits',
    'units'
  );
  const windowCol = findColumn(
    'collectiondateops',
    'collectiondate',
    'collectionwindow',
    'window',
    'collectionday',
    'fromcollectiondate',
    'from-collectiondate',
    'throughcollectiondate',
    'through-collectiondate'
  );
  const fieldCollectionDaysCol = findColumn('fieldcollectiondaysrayandrew', 'fieldcollectiondays', 'collectiondays');
  // "From the imported csv, Sync Install Day to the Setup Before."
  const setupBeforeCol = findColumn(
    'setupbefore',
    'setup_before',
    'setupbeforedate',
    'setupbeforeday',
    'setupbeforetime',
    'setupdate',
    'setupday',
    'setup'
  );
  const installCol =
    setupBeforeCol !== -1
      ? setupBeforeCol
      : findColumn(
          'installday',
          'install',
          'installdate',
          'installationday',
          'installedday'
        );
  const teardownCol = findColumn(
    'teardownday',
    'teardown',
    'teardowndate',
    'tdday',
    'teardownafter',
    'teardown_after'
  );
  const techCol = findColumn(
    'technician',
    'tech',
    'assignedtech',
    'techassigned',
    'primarytech',
    'technicians',
    'fieldtech',
    'scheduleplanner'
  );
  const wwCol = findColumn(
    'ww',
    'workweek',
    'work week',
    'activecycle',
    'active cycle',
    'cycle',
    'ww#',
    'week',
    'week#',
    'workweekcollection2026',
    'workweekcollection',
    'workweek2026',
    'collectionworkweek'
  );
  const evalCol = findColumn('evaluatedby', 'evaluator', 'auditedby', 'analyst');
  const schedNotesCol = findColumn('schedulernotes', 'dispatchnotes', 'notes');
  const leadSchedNotesCol = findColumn('leadschedulernotes', 'leadnotes');
  const collectionSummaryCol = findColumn('collectionsummary', 'summary');
  const analystNotesCol = findColumn('analystnotes', 'auditnotes', 'fieldnotes');
  const urgencyCol = findColumn('urgency', 'priority', 'urgencyselection');
  const videoCol = findColumn('delivervideo', 'video');
  const methodCol = findColumn(
    'method',
    'collectionmethod',
    'studymethod',
    'equipmentmethod',
    'countmethod'
  );

  // Detect any explicit battery change / equipment check columns in CSV:
  // "Sync Battery Swap to Battey Change/Equipment Check 1, 2, 3, 4, 5 and so on"
  const batterySwapCols: number[] = [];
  rawHeaders.forEach((h, idx) => {
    const norm = normalizeHeader(h);
    if (
      norm.includes('batterychange') ||
      norm.includes('batteychange') ||
      norm.includes('batteryswap') ||
      norm.includes('batterycheck') ||
      norm.includes('batteycheck') ||
      (norm.includes('battery') && norm.includes('check')) ||
      (norm.includes('battey') && norm.includes('check')) ||
      (norm.includes('equipmentcheck') && !norm.includes('status'))
    ) {
      batterySwapCols.push(idx);
    }
  });

  const matchedHeaders: Record<string, string> = {
    'Project #': idCol !== -1 ? rawHeaders[idCol] : 'Not found (auto-generated)',
    'City, State': cityCol !== -1 ? rawHeaders[cityCol] : 'Not found',
    'Project Status': opsStatusCol !== -1 ? rawHeaders[opsStatusCol] : 'Derived / Default',
    'Schedule Status': schedStatusCol !== -1 ? rawHeaders[schedStatusCol] : 'Derived / Default',
    'Study Type / Service Types': studyCol !== -1 ? rawHeaders[studyCol] : 'Not found (default TMC)',
    'Method': methodCol !== -1 ? rawHeaders[methodCol] : 'Not found',
    'Technician': techCol !== -1 ? rawHeaders[techCol] : 'Not found',
    'Collection Date (OPS)': windowCol !== -1 ? rawHeaders[windowCol] : 'Not found',
    'Install Day':
      setupBeforeCol !== -1
        ? `${rawHeaders[setupBeforeCol]} (Setup Before)`
        : installCol !== -1
        ? rawHeaders[installCol]
        : 'Derived (1 day before Collection Date)',
    'Teardown Day': teardownCol !== -1 ? rawHeaders[teardownCol] : 'Derived (2-3 days post-install)',
    'Work Week (WW)': wwCol !== -1 ? rawHeaders[wwCol] : 'Derived from Install/Collection Date',
    'Equipment (Units) / Total Units':
      totalUnitsCol !== -1
        ? rawHeaders[totalUnitsCol]
        : cameraUnitsCol !== -1
        ? rawHeaders[cameraUnitsCol]
        : equipCol !== -1
        ? rawHeaders[equipCol]
        : machineUnitsCol !== -1
        ? rawHeaders[machineUnitsCol]
        : 'Not found (default 2)',
    'Battery Swap / Equipment Check':
      batterySwapCols.length > 0
        ? batterySwapCols.map((c) => rawHeaders[c]).join(', ')
        : 'None detected',
    'Date Sent / Ops Audit Date':
      opsAuditDateCol !== -1
        ? rawHeaders[opsAuditDateCol]
        : dateSentCol !== -1
        ? rawHeaders[dateSentCol]
        : 'Not found',
  };

  const projectsById = new Map<string, Project>();
  const projectsByParentKey = new Map<string, Project>();

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];

    // 1. Multi-level Project ID and Location determination:
    // South Central typically uses "Project #", while other regions (e.g. Middletown, PA / Northeast / Mid Atlantic / etc.)
    // export "PROJECT ID (FROM LOCATIONS)" or individual location Project IDs (e.g. 26-320020-001 or 26-620003-1084).
    // All locations belonging to the same project (e.g. 26-620003-1084, 26-620003-1160) are grouped into 1 project (e.g. "26-620003 ME").
    let chosenRawId = '';
    let extractedLocSuffix = '';

    // Pass A: Check candidate ID columns in priority order
    for (const cIdx of candidateIdCols) {
      if (cIdx < 0 || cIdx >= row.length) continue;
      const cellVal = row[cIdx] ? row[cIdx].trim() : '';
      if (!cellVal) continue;

      const parsed = parseProjectNumberAndLocation(cellVal);
      if (parsed.parentProjectNumber && parsed.parentProjectNumber.startsWith('26-')) {
        chosenRawId = cellVal;
        if (parsed.locationSuffix) {
          extractedLocSuffix = parsed.locationSuffix;
          break;
        }
      }
    }

    // Pass B: If no location-specific ID was selected, scan non-note cells for any location-level 26- ID
    if (!chosenRawId || !extractedLocSuffix) {
      for (let c = 0; c < row.length; c++) {
        if (
          c === schedNotesCol ||
          c === leadSchedNotesCol ||
          c === analystNotesCol ||
          c === collectionSummaryCol ||
          c === scheduleDetailsCol
        ) {
          continue;
        }
        const cellVal = row[c] ? row[c].trim() : '';
        if (!cellVal) continue;
        const parsed = parseProjectNumberAndLocation(cellVal);
        if (parsed.parentProjectNumber && parsed.parentProjectNumber.startsWith('26-')) {
          if (parsed.locationSuffix) {
            chosenRawId = cellVal;
            extractedLocSuffix = parsed.locationSuffix;
            break;
          }
          if (!chosenRawId) {
            chosenRawId = cellVal;
          }
        }
      }
    }

    // Pass C: If still no ID found at all, scan all cells for any project number starting with 26-
    if (!chosenRawId) {
      for (let c = 0; c < row.length; c++) {
        if (
          c === schedNotesCol ||
          c === leadSchedNotesCol ||
          c === analystNotesCol ||
          c === collectionSummaryCol ||
          c === scheduleDetailsCol
        ) {
          continue;
        }
        const cellVal = row[c] ? row[c].trim() : '';
        if (!cellVal) continue;
        if (/^26-[A-Za-z0-9]+/i.test(cellVal)) {
          const parsed = parseProjectNumberAndLocation(cellVal);
          if (parsed.parentProjectNumber && parsed.parentProjectNumber.startsWith('26-')) {
            chosenRawId = cellVal;
            if (parsed.locationSuffix) extractedLocSuffix = parsed.locationSuffix;
            break;
          }
        }
      }
    }

    const sanitizedObj = sanitizeProjectId(chosenRawId);
    let parentProjectNumber = sanitizedObj.projectNumber;
    if (sanitizedObj.locationSuffix && !extractedLocSuffix) {
      extractedLocSuffix = sanitizedObj.locationSuffix;
    }

    if (!parentProjectNumber) {
      // If row has no ID, skip if completely empty, otherwise generate fallback
      const hasAnyData = row.some((c) => c && c.trim().length > 0);
      if (!hasAnyData) continue;
      parentProjectNumber = `26-AIRTABLE-${r}`;
      warnings.push(`Row ${r + 1} was missing Project ID; auto-assigned ${parentProjectNumber}`);
    }

    // Filter: User requirement: "Only include projects starting with 26-. Don't include projects starting with 23- , 24- , 25-"
    if (!parentProjectNumber.startsWith('26-')) {
      continue;
    }

    let cityState = cityCol !== -1 && row[cityCol] ? row[cityCol].trim() : '';
    if (!cityState || cityState.toLowerCase() === 'unspecified') {
      cityState = sanitizedObj.cityState || 'Unspecified';
    }

    // Universal project ID format: <Project #> <City, State> (e.g. "26-620003 ME", "26-480128 Santa Fe, NM", "26-320020 Middletown, PA")
    const id = formatProjectId(parentProjectNumber, cityState);
    const parentKey = parentProjectNumber.toLowerCase();

    // Parse technician with multi-tech detection, "Last, First" normalization, and regional fallbacks
    let assignedTech = 'Unassigned';
    const rawTech = techCol !== -1 && row[techCol] ? cleanTechName(row[techCol]) : '';
    if (rawTech && rawTech.toLowerCase() !== 'unassigned') {
      const parsedTechs = splitTechnicianNames(rawTech);
      if (parsedTechs.length > 0) {
        assignedTech = parsedTechs.join(', ');
      } else {
        assignedTech = rawTech;
      }
    } else {
      // Check if project exists in INITIAL_PROJECTS
      const initP = INITIAL_PROJECTS.find((p) => p.id === id);
      if (initP && initP.technician && initP.technician !== 'Unassigned') {
        assignedTech = initP.technician;
      } else {
        assignedTech = assignRegionalTech(cityState, id);
      }
    }

    const opsStatus = normalizeOpsStatus(opsStatusCol !== -1 ? row[opsStatusCol] : undefined, assignedTech);
    const scheduleStatus = normalizeScheduleStatus(schedStatusCol !== -1 ? row[schedStatusCol] : undefined);
    
    // Read and sync Study Type directly from CSV Service Types column
    const rawServiceTypes = studyCol !== -1 && row[studyCol] ? row[studyCol].trim() : '';
    const studyType = normalizeStudyType(rawServiceTypes);
    let serviceTypeAddOns = serviceAddonsCol !== -1 && row[serviceAddonsCol] ? row[serviceAddonsCol].trim() : undefined;
    if (!serviceTypeAddOns && rawServiceTypes.includes(',')) {
      const parts = rawServiceTypes.split(',').map((p) => p.trim()).filter(Boolean);
      const addons = parts.filter((p) => normalizeStudyType(p) !== studyType);
      if (addons.length > 0) {
        serviceTypeAddOns = addons.join(', ');
      }
    }

    // Parse Location IDs and Locations count from CSV
    // "No. of Locations does not match. Refer and sync to the number of Location ID from the specific Project ID from csv"
    let rawLocationIdStr = locationIdCol !== -1 && row[locationIdCol] ? row[locationIdCol].trim() : '';
    let parsedLocationIds: string[] = [];
    if (rawLocationIdStr) {
      const parts = rawLocationIdStr.split(/[,;\/\n]+/).map((s) => s.trim()).filter(Boolean);
      if (parts.length > 0) {
        parsedLocationIds = parts;
      }
    }

    if (extractedLocSuffix && !parsedLocationIds.includes(extractedLocSuffix)) {
      parsedLocationIds.unshift(extractedLocSuffix);
    }

    let locationsCount = 1;
    if (locCol !== -1 && row[locCol]) {
      locationsCount = parseNumericQuantity(row[locCol], parsedLocationIds.length || 1);
    } else if (parsedLocationIds.length > 0) {
      locationsCount = parsedLocationIds.length;
    }
    
    // Parse duration / number of consecutive days from CSV
    // "Duration (Days) does not match. Sync it with the number of #Days from Schedule Details from the imported csv"
    let parsedDaysCount = 0;
    const rawDaysCountStr = daysCountCol !== -1 && row[daysCountCol] ? row[daysCountCol].trim() : '';
    if (rawDaysCountStr) {
      const match = rawDaysCountStr.match(/\d+/);
      if (match) {
        parsedDaysCount = parseInt(match[0], 10);
      }
    }

    // Sync with Schedule Details / Collection Summary text e.g. "TMC (3 days)", "(1 day)", "4 ATR (2 days)", "72hrs"
    const rawSchedDetails =
      (scheduleDetailsCol !== -1 && row[scheduleDetailsCol] ? row[scheduleDetailsCol] : '') ||
      (collectionSummaryCol !== -1 && row[collectionSummaryCol] ? row[collectionSummaryCol] : '');
    if (rawSchedDetails) {
      const dayMatch = rawSchedDetails.match(/\b(\d+)\s*(?:day|days|d)\b/i);
      if (dayMatch) {
        const matchedDays = parseInt(dayMatch[1], 10);
        if (matchedDays > 0) {
          parsedDaysCount = matchedDays;
        }
      } else if (parsedDaysCount === 0) {
        const hrMatch = rawSchedDetails.match(/\b(24|48|72|96|120|144|168)\s*(?:hr|hrs|hours?)\b/i);
        if (hrMatch) {
          parsedDaysCount = Math.max(1, Math.round(parseInt(hrMatch[1], 10) / 24));
        }
      }
    }

    // 1. "Sync the number of Equipment (Units) to Total Units"
    const rawTotalUnits = totalUnitsCol !== -1 && row[totalUnitsCol] ? row[totalUnitsCol].trim() : '';
    const rawCamUnits = cameraUnitsCol !== -1 && row[cameraUnitsCol] ? row[cameraUnitsCol].trim() : '';
    const rawMachUnits = machineUnitsCol !== -1 && row[machineUnitsCol] ? row[machineUnitsCol].trim() : '';
    const rawEquipUnits = equipCol !== -1 && row[equipCol] ? row[equipCol].trim() : '';

    let equipmentCount = 0;
    if (totalUnitsCol !== -1 && rawTotalUnits !== '') {
      equipmentCount = parseNumericQuantity(rawTotalUnits, 0);
    } else if (cameraUnitsCol !== -1 && rawCamUnits !== '') {
      equipmentCount = parseNumericQuantity(rawCamUnits, 0);
    } else if (machineUnitsCol !== -1 && rawMachUnits !== '') {
      equipmentCount = parseNumericQuantity(rawMachUnits, 0);
    } else if (equipCol !== -1 && rawEquipUnits !== '') {
      equipmentCount = parseNumericQuantity(rawEquipUnits, 0);
    } else {
      equipmentCount = 2;
    }

    // 2. Determine Equipment Type based on Method
    // "For the Equipment Type
    //  Use Cams when the Method are the following, 
    //  Cam
    //  Cam - ATR Algorithm
    //  Cam - ATR Speed Algorithm
    //  If ATR, use Mach"
    const rawMethod = methodCol !== -1 && row[methodCol] ? row[methodCol].trim() : '';
    const methodStr = (rawMethod || rawServiceTypes || '').toLowerCase();

    let equipmentType: EquipmentType = 'Camera';
    if (
      methodStr === 'cam' ||
      methodStr === 'cams' ||
      methodStr === 'camera' ||
      methodStr.includes('cam - atr algorithm') ||
      methodStr.includes('cam - atr speed algorithm') ||
      methodStr.includes('cam-atr algorithm') ||
      methodStr.includes('cam-atr speed algorithm') ||
      methodStr.startsWith('cam') ||
      methodStr.includes('camera')
    ) {
      equipmentType = 'Camera';
    } else if (
      methodStr === 'atr' ||
      methodStr.startsWith('atr') ||
      methodStr.includes('mach') ||
      methodStr.includes('machine') ||
      methodStr.includes('tube') ||
      methodStr.includes('pneumatic')
    ) {
      equipmentType = 'Machine';
    } else if (studyType === 'ATR') {
      equipmentType = 'Machine';
    } else {
      equipmentType = 'Camera';
    }

    const rawWindow = windowCol !== -1 && row[windowCol] ? row[windowCol].trim() : '';
    const rawFieldDays = fieldCollectionDaysCol !== -1 && row[fieldCollectionDaysCol] ? row[fieldCollectionDaysCol].trim() : '';
    const collectionWindow = rawWindow || rawFieldDays || '9/3 (CRD)';
    const rawInstall = installCol !== -1 ? row[installCol]?.trim() : '';
    let installDay = installCol !== -1 ? normalizeDay(row[installCol]) : '';

    // REFERENCE FOR INSTALL DATE IS 1 DAY BEFORE THE COLLECTION WINDOW / COLLECTION DATE
    if (!installDay && collectionWindow) {
      const collDay = extractDayFromText(collectionWindow);
      if (collDay) {
        installDay = getPreviousDay(collDay);
      }
    }

    const evaluatedBy = evalCol !== -1 && row[evalCol] ? row[evalCol].trim() : '';
    const rawSchedNotes = schedNotesCol !== -1 && row[schedNotesCol] ? row[schedNotesCol].trim() : '';
    const rawLeadSchedNotes = leadSchedNotesCol !== -1 && row[leadSchedNotesCol] ? row[leadSchedNotesCol].trim() : '';
    const rawSummary = collectionSummaryCol !== -1 && row[collectionSummaryCol] ? row[collectionSummaryCol].trim() : '';
    const schedulerNotes = [rawSchedNotes, rawLeadSchedNotes, rawSummary].filter(Boolean).join(' | ');
    const analystNotes = analystNotesCol !== -1 && row[analystNotesCol] ? row[analystNotesCol].trim() : '';
    const urgency = urgencyCol !== -1 && row[urgencyCol]?.toLowerCase().includes('priority') ? 'Priority Client' : 'Standard';
    const deliverVideo = videoCol !== -1 && row[videoCol]?.toLowerCase().includes('yes');

    // Parse Teardown Day directly from CSV, with notes inspection and duration-based calculation
    let teardownDay = teardownCol !== -1 ? normalizeDay(row[teardownCol]) : '';
    if (!teardownDay && installDay) {
      // Check notes for explicit teardown mention e.g. "Teardown 09/21"
      const combinedNotes = `${schedulerNotes} ${analystNotes} ${collectionWindow}`.toLowerCase();
      const tdNoteMatch = combinedNotes.match(/teardown\s*(?:at|on)?\s*([0-1]?[0-9]\/[0-3]?[0-9])/);
      if (tdNoteMatch) {
        const parsedNoteDay = normalizeDay(tdNoteMatch[1]);
        if (parsedNoteDay) {
          teardownDay = parsedNoteDay;
        }
      }
      if (!teardownDay) {
        // If consecutive collection days is known (e.g. 7-day study: install Sun -> teardown Mon)
        if (parsedDaysCount >= 2) {
          const instIdx = DAY_ORDER.indexOf(installDay);
          teardownDay = DAY_ORDER[(instIdx + parsedDaysCount + 1) % 7];
        } else {
          const fallbackDays = studyType === 'ATR' || studyType === 'ATR (Camera)' ? 3 : 2;
          teardownDay = addDaysToWeekDay(installDay, fallbackDays);
        }
      }
    }

    // WW = WORK WEEK = Active Cycle
    let detectedWorkWeek: string | null = null;
    if (wwCol !== -1 && row[wwCol]) {
      detectedWorkWeek = normalizeWorkWeekString(row[wwCol]);
    }
    if (!detectedWorkWeek) {
      detectedWorkWeek = determineWorkWeekFromInstallDate(
        rawInstall,
        collectionWindow,
        undefined,
        installDay
      );
    }

    // User requirement:
    // "Sync Battery Swap to Battey Change/Equipment Check 1, 2, 3, 4, 5 and so on and ignore previous prompt to plot it every other day after install until teardown"
    // Explicit Battery Swap Columns in CSV (e.g. "Battery Change/Equipment Check 1, 2, 3, 4, 5 and so on")
    const explicitSwapDays: WeekDay[] = [];
    const explicitSwapDates: string[] = [];
    batterySwapCols.forEach((colIdx) => {
      const cellVal = row[colIdx]?.trim();
      if (cellVal) {
        const day = normalizeDay(cellVal);
        const dtStr = extractDateStr(cellVal);
        if (day && !explicitSwapDays.includes(day)) {
          explicitSwapDays.push(day);
        }
        if (dtStr && !explicitSwapDates.includes(dtStr)) {
          explicitSwapDates.push(dtStr);
        }
      }
    });

    const finalSwapDays = explicitSwapDays.length > 0 ? explicitSwapDays : undefined;
    const finalSwapDates = explicitSwapDates.length > 0 ? explicitSwapDates : undefined;
    const finalSwapDay = finalSwapDays && finalSwapDays.length > 0 ? finalSwapDays[0] : undefined;
    const finalConsecutiveDays = parsedDaysCount > 0 ? parsedDaysCount : undefined;

    // User rule: Schedule Status and Version leave as blank as user will fill this
    const parsedVersion = versionCol !== -1 && row[versionCol] ? (row[versionCol].trim() as any) : '';
    const rawAuditDate = opsAuditDateCol !== -1 && row[opsAuditDateCol] ? row[opsAuditDateCol].trim() : '';
    const rawDateSent = dateSentCol !== -1 && row[dateSentCol] ? row[dateSentCol].trim() : '';
    const chosenDateSent = rawAuditDate || rawDateSent;
    const formattedDateSent = chosenDateSent ? formatDateTimeSent(chosenDateSent) : '';
    const formattedAuditDate = rawAuditDate ? formatDateTimeSent(rawAuditDate) : formattedDateSent;

    const existingProj = projectsByParentKey.get(parentKey) || projectsById.get(id);
    if (!existingProj) {
      const techUnits: Record<string, number> = {};
      const techLocations: Record<string, string[]> = {};
      if (assignedTech && assignedTech !== 'Unassigned') {
        const assignedList = splitTechnicianNames(assignedTech);
        if (assignedList.length === 1) {
          techUnits[assignedList[0]] = equipmentCount;
          if (parsedLocationIds.length > 0) {
            techLocations[assignedList[0]] = parsedLocationIds;
          }
        } else {
          // If multiple techs are listed in a single row, assign units and locations per tech
          const perTechUnits = Math.round(equipmentCount / assignedList.length);
          assignedList.forEach((t, i) => {
            techUnits[t] = perTechUnits;
            if (parsedLocationIds[i]) {
              techLocations[t] = [parsedLocationIds[i]];
            }
          });
        }
      }

      const newProj: Project = {
        id,
        cityState,
        opsStatus,
        scheduleStatus,
        version: parsedVersion,
        dateSent: formattedDateSent || undefined,
        opsAuditDate: formattedAuditDate || undefined,
        studyType,
        serviceTypeAddOns,
        locationId: parsedLocationIds.join(', ') || undefined,
        locationIds: parsedLocationIds.length > 0 ? parsedLocationIds : undefined,
        locationsCount,
        equipmentCount,
        techUnits: Object.keys(techUnits).length > 0 ? techUnits : undefined,
        techLocations: Object.keys(techLocations).length > 0 ? techLocations : undefined,
        equipmentType,
        collectionWindow,
        installDay,
        teardownDay,
        batterySwapDay: finalSwapDay,
        batterySwapDays: finalSwapDays,
        batterySwapDates: finalSwapDates,
        consecutiveCollectionDays: finalConsecutiveDays,
        technician: assignedTech,
        evaluatedBy,
        urgency,
        deliverVideo,
        schedulerNotes,
        analystNotes,
        workWeek: detectedWorkWeek,
        region: 'South Central',
        lastUpdated: new Date().toISOString(),
      };

      projectsById.set(id, newProj);
      projectsByParentKey.set(parentKey, newProj);
    } else {
      // Multiple rows / locations for the SAME Project ID!
      // If the existing project didn't have a valid cityState, update it
      if ((!existingProj.cityState || existingProj.cityState === 'Unspecified') && cityState && cityState !== 'Unspecified') {
        existingProj.cityState = cityState;
        const newId = formatProjectId(parentProjectNumber, cityState);
        if (newId !== existingProj.id) {
          projectsById.delete(existingProj.id);
          existingProj.id = newId;
          projectsById.set(newId, existingProj);
        }
      }

      // 1. Combine technicians without duplicates
      const currentTechs = splitTechnicianNames(existingProj.technician);
      const incomingTechs = splitTechnicianNames(assignedTech);
      incomingTechs.forEach((t) => {
        if (t && t !== 'Unassigned' && !currentTechs.includes(t)) {
          currentTechs.push(t);
        }
      });
      existingProj.technician = currentTechs.length > 0 ? currentTechs.join(', ') : existingProj.technician;

      // 2. Combine Location IDs & sync No. of Locations
      const combinedLocIds = new Set(
        existingProj.locationIds || (existingProj.locationId ? existingProj.locationId.split(/[,;\/\s]+/).filter(Boolean) : [])
      );
      parsedLocationIds.forEach((loc) => combinedLocIds.add(loc));
      existingProj.locationIds = Array.from(combinedLocIds);
      existingProj.locationId = existingProj.locationIds.join(', ');
      existingProj.locationsCount = Math.max(existingProj.locationIds.length, existingProj.locationsCount);

      // 3. Track Total Units per technician
      if (!existingProj.techUnits) existingProj.techUnits = {};
      if (!existingProj.techLocations) existingProj.techLocations = {};
      incomingTechs.forEach((t) => {
        if (t && t !== 'Unassigned') {
          existingProj.techUnits![t] = (existingProj.techUnits![t] || 0) + equipmentCount;
          if (parsedLocationIds.length > 0) {
            if (!existingProj.techLocations![t]) existingProj.techLocations![t] = [];
            parsedLocationIds.forEach((loc) => {
              if (!existingProj.techLocations![t].includes(loc)) existingProj.techLocations![t].push(loc);
            });
          }
        }
      });
      existingProj.equipmentCount += equipmentCount;

      // 4. Consecutive days
      if (finalConsecutiveDays && (!existingProj.consecutiveCollectionDays || finalConsecutiveDays > existingProj.consecutiveCollectionDays)) {
        existingProj.consecutiveCollectionDays = finalConsecutiveDays;
      }

      // 5. Battery swap days & dates
      if (finalSwapDays) {
        const swapDaysSet = new Set(existingProj.batterySwapDays || []);
        finalSwapDays.forEach((d) => swapDaysSet.add(d));
        existingProj.batterySwapDays = Array.from(swapDaysSet);
        existingProj.batterySwapDay = existingProj.batterySwapDays[0];
      }
      if (finalSwapDates) {
        const swapDatesSet = new Set(existingProj.batterySwapDates || []);
        finalSwapDates.forEach((dt) => swapDatesSet.add(dt));
        existingProj.batterySwapDates = Array.from(swapDatesSet);
      }
    }
  }

  const parsedProjects = Array.from(new Set(projectsById.values()));

  return {
    projects: parsedProjects,
    totalParsed: parsedProjects.length,
    matchedHeaders,
    warnings,
  };
}
