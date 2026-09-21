import { Technician, RegionName, REGIONS } from '../types';
import { parseCSVString, parseNumericQuantity } from './csvParser';

export interface ParsedTechnicianRow {
  tech: Technician;
  rawRow: Record<string, string>;
  detectedOperationalRegion: RegionName;
  originalRegionString: string;
  hasWarnings?: string[];
}

export interface ParseTechnicianFileResult {
  technicians: ParsedTechnicianRow[];
  totalParsed: number;
  matchedHeaders: Record<string, string>;
  detectedRegions: RegionName[];
  totalCameras: number;
  totalMachines: number;
  warnings: string[];
}

/**
 * Normalizes header string for fuzzy matching (removes punctuation, spaces, converts to lowercase)
 */
const normalizeHeader = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Maps a raw region/location string to one of the 10 system operational regions.
 */
export function mapToOperationalRegion(
  rawRegion: string,
  fallbackRegion: RegionName = 'South Central'
): { operationalRegion: RegionName; formattedSubRegion: string } {
  if (!rawRegion || !rawRegion.trim()) {
    return { operationalRegion: fallbackRegion, formattedSubRegion: fallbackRegion };
  }

  const clean = rawRegion.trim();
  const lower = clean.toLowerCase();

  // Exact match to REGIONS list
  const exact = REGIONS.find((r) => r.toLowerCase() === lower);
  if (exact) {
    return { operationalRegion: exact, formattedSubRegion: clean };
  }

  // NOCAL
  if (
    lower.includes('nocal') ||
    lower.includes('norcal') ||
    lower.includes('northern cal') ||
    lower.includes('bay area') ||
    lower.includes('san francisco') ||
    lower.includes('oakland') ||
    lower.includes('san jose') ||
    lower.includes('sacramento') ||
    lower.includes('fresno')
  ) {
    return { operationalRegion: 'NOCAL', formattedSubRegion: clean };
  }

  // SOCAL
  if (
    lower.includes('socal') ||
    lower.includes('southern cal') ||
    lower.includes('los angeles') ||
    lower.includes('san diego') ||
    lower.includes('orange county') ||
    lower.includes('riverside') ||
    lower.includes('inland empire')
  ) {
    return { operationalRegion: 'SOCAL', formattedSubRegion: clean };
  }

  // Florida
  if (
    lower.includes('florida') ||
    lower === 'fl' ||
    lower.includes('orlando') ||
    lower.includes('miami') ||
    lower.includes('tampa') ||
    lower.includes('jacksonville') ||
    lower.includes('tallahassee') ||
    lower.includes('fort lauderdale')
  ) {
    return { operationalRegion: 'Florida', formattedSubRegion: clean };
  }

  // NYS (New York State)
  if (
    lower === 'nys' ||
    lower.includes('new york state') ||
    lower.includes('upstate') ||
    lower.includes('albany') ||
    lower.includes('buffalo') ||
    lower.includes('rochester') ||
    lower.includes('syracuse')
  ) {
    return { operationalRegion: 'NYS', formattedSubRegion: clean };
  }

  // NYC
  if (
    lower.includes('nyc') ||
    lower.includes('new york') ||
    lower.includes('manhattan') ||
    lower.includes('brooklyn') ||
    lower.includes('queens') ||
    lower.includes('bronx') ||
    lower.includes('staten island') ||
    lower.includes('new jersey') ||
    lower === 'nj' ||
    lower === 'ny'
  ) {
    return { operationalRegion: 'NYC', formattedSubRegion: clean };
  }

  // South East
  if (
    lower.includes('south east') ||
    lower.includes('southeast') ||
    lower === 'se' ||
    lower.includes('georgia') ||
    lower === 'ga' ||
    lower.includes('atlanta') ||
    lower.includes('north carolina') ||
    lower === 'nc' ||
    lower.includes('charlotte') ||
    lower.includes('raleigh') ||
    lower.includes('south carolina') ||
    lower === 'sc' ||
    lower.includes('tennessee') ||
    lower === 'tn' ||
    lower.includes('nashville') ||
    lower.includes('memphis')
  ) {
    return { operationalRegion: 'South East', formattedSubRegion: clean };
  }

  // Mid West
  if (
    lower.includes('mid west') ||
    lower.includes('midwest') ||
    lower.includes('chicago') ||
    lower.includes('illinois') ||
    lower === 'il' ||
    lower.includes('ohio') ||
    lower === 'oh' ||
    lower.includes('michigan') ||
    lower === 'mi' ||
    lower.includes('detroit') ||
    lower.includes('indiana') ||
    lower === 'in' ||
    lower.includes('wisconsin') ||
    lower === 'wi'
  ) {
    return { operationalRegion: 'Mid West', formattedSubRegion: clean };
  }

  // Northeast
  if (
    lower.includes('northeast') ||
    lower === 'ne' ||
    lower.includes('boston') ||
    lower.includes('massachusetts') ||
    lower === 'ma' ||
    lower.includes('connecticut') ||
    lower === 'ct' ||
    lower.includes('rhode island') ||
    lower === 'ri' ||
    lower.includes('vermont') ||
    lower === 'vt' ||
    lower.includes('new hampshire') ||
    lower === 'nh'
  ) {
    return { operationalRegion: 'Northeast', formattedSubRegion: clean };
  }

  // Mid Atlantic
  if (
    lower.includes('mid atlantic') ||
    lower.includes('midatlantic') ||
    lower.includes('virginia') ||
    lower === 'va' ||
    lower.includes('maryland') ||
    lower === 'md' ||
    lower.includes('dc') ||
    lower.includes('pennsylvania') ||
    lower === 'pa' ||
    lower.includes('philadelphia') ||
    lower.includes('pittsburgh')
  ) {
    return { operationalRegion: 'Mid Atlantic', formattedSubRegion: clean };
  }

  // Maine
  if (lower.includes('maine') || lower === 'me' || lower.includes('portland, me')) {
    return { operationalRegion: 'Maine', formattedSubRegion: clean };
  }

  // South Central (Default NDS hub: Texas, Louisiana, Colorado)
  if (
    lower.includes('south central') ||
    lower.includes('texas') ||
    lower === 'tx' ||
    lower.includes('dallas') ||
    lower.includes('houston') ||
    lower.includes('austin') ||
    lower.includes('san antonio') ||
    lower.includes('fort worth') ||
    lower.includes('louisiana') ||
    lower === 'la' ||
    lower.includes('baton rouge') ||
    lower.includes('new orleans') ||
    lower.includes('colorado') ||
    lower === 'co' ||
    lower.includes('denver')
  ) {
    let sub = clean;
    if (lower.includes('dallas')) sub = 'TX (Dallas)';
    else if (lower.includes('houston')) sub = 'TX (Houston)';
    else if (lower.includes('austin')) sub = 'TX (Austin)';
    else if (lower.includes('san antonio')) sub = 'TX (San Antonio)';
    else if (lower.includes('louisiana') || lower === 'la') sub = 'LA';
    else if (lower.includes('colorado') || lower === 'co' || lower.includes('denver')) sub = 'CO';
    return { operationalRegion: 'South Central', formattedSubRegion: sub };
  }

  return { operationalRegion: fallbackRegion, formattedSubRegion: clean };
}

/**
 * Assigns team name and color based on team text or color group.
 */
function resolveTeamAndColor(
  rawTeam: string | undefined,
  operationalRegion: RegionName,
  subRegion: string,
  index: number
): { team: string; colorGroup: 'navy' | 'orange' | 'burgundy' | 'green' } {
  const colors: Array<'navy' | 'orange' | 'burgundy' | 'green'> = ['navy', 'orange', 'burgundy', 'green'];
  const lower = (rawTeam || '').toLowerCase();

  if (lower.includes('navy') || lower.includes('central') || lower.includes('blue')) {
    return { team: `${operationalRegion} (Team Central)`, colorGroup: 'navy' };
  }
  if (lower.includes('orange') || lower.includes('north') || lower.includes('amber')) {
    return { team: `${operationalRegion} (Team North)`, colorGroup: 'orange' };
  }
  if (lower.includes('burgundy') || lower.includes('south') || lower.includes('rose') || lower.includes('red')) {
    return { team: `${operationalRegion} (Team South)`, colorGroup: 'burgundy' };
  }
  if (lower.includes('green') || lower.includes('west') || lower.includes('colo') || lower.includes('emerald')) {
    return { team: `${operationalRegion} (Team West)`, colorGroup: 'green' };
  }

  // Infer from sub-region if South Central
  if (operationalRegion === 'South Central') {
    if (subRegion.includes('Dallas')) return { team: 'Team Central (Navy)', colorGroup: 'navy' };
    if (subRegion.includes('Houston')) return { team: 'Team North (Orange)', colorGroup: 'orange' };
    if (subRegion.includes('LA')) return { team: 'Team Louisiana (Burgundy)', colorGroup: 'burgundy' };
    if (subRegion.includes('CO')) return { team: 'Team West/Colo (Green)', colorGroup: 'green' };
  }

  // Fallback by index rotation
  const color = colors[index % colors.length];
  const teamLabel =
    color === 'navy'
      ? 'Team Central (Navy)'
      : color === 'orange'
      ? 'Team North (Orange)'
      : color === 'burgundy'
      ? 'Team South (Burgundy)'
      : 'Team West (Green)';

  return { team: `${operationalRegion} (${teamLabel})`, colorGroup: color };
}

/**
 * Parses technician file contents (CSV/TSV/Text).
 */
export function parseTechnicianFile(
  content: string,
  activeRegion: RegionName = 'South Central'
): ParseTechnicianFileResult {
  const warnings: string[] = [];

  // Support tab-delimited or comma-delimited
  let normalizedContent = content.trim();
  if (normalizedContent.includes('\t') && !normalizedContent.includes(',')) {
    // Convert TSV to CSV
    normalizedContent = normalizedContent
      .split('\n')
      .map((line) =>
        line
          .split('\t')
          .map((cell) => `"${cell.replace(/"/g, '""')}"`)
          .join(',')
      )
      .join('\n');
  }

  const rows = parseCSVString(normalizedContent);
  if (rows.length < 2) {
    throw new Error('File does not contain enough data. It must include a header row and at least one technician row.');
  }

  const rawHeaders = rows[0];
  const headerMap: Record<string, number> = {};

  rawHeaders.forEach((h, idx) => {
    headerMap[normalizeHeader(h)] = idx;
  });

  const findCol = (...aliases: string[]): number => {
    for (const alias of aliases) {
      const norm = normalizeHeader(alias);
      if (headerMap[norm] !== undefined) return headerMap[norm];
    }
    for (const alias of aliases) {
      const norm = normalizeHeader(alias);
      for (const [key, idx] of Object.entries(headerMap)) {
        if (key === norm || key.startsWith(norm) || (norm.length > 3 && key.includes(norm))) {
          return idx;
        }
      }
    }
    return -1;
  };

  // Find column indices
  const nameCol = findCol(
    'technician',
    'tech',
    'technicianname',
    'techname',
    'name',
    'fullname',
    'employee',
    'fieldtech',
    'technicians'
  );
  const regionCol = findCol(
    'region',
    'operationalregion',
    'market',
    'area',
    'territory',
    'location',
    'subregion',
    'citystate',
    'state',
    'city'
  );
  const camerasCol = findCol(
    'numberofcameras',
    'ofcameras',
    'cameras',
    'cameraunits',
    'cameracount',
    'maxcameras',
    'camunits',
    'cam',
    'ofcameraunits',
    'units',
    'camera'
  );
  const machinesCol = findCol(
    'numberofmachines',
    'ofmachines',
    'machines',
    'machineunits',
    'machinecount',
    'maxmachines',
    'machunits',
    'mach',
    'tubes',
    'ofmachineunits',
    'machine'
  );
  const teamCol = findCol('team', 'colorgroup', 'teamname', 'group');
  const phoneCol = findCol('phone', 'mobile', 'cell', 'contact', 'phonenumber');
  const emailCol = findCol('email', 'mail', 'emailaddress');
  const activeCol = findCol('active', 'status', 'isactive');

  const matchedHeaders: Record<string, string> = {
    'Technician Name': nameCol !== -1 ? rawHeaders[nameCol] : 'Not found',
    'Region': regionCol !== -1 ? rawHeaders[regionCol] : `Default (${activeRegion})`,
    'Cameras': camerasCol !== -1 ? rawHeaders[camerasCol] : 'Default (25)',
    'Machines': machinesCol !== -1 ? rawHeaders[machinesCol] : 'Default (4)',
  };
  if (teamCol !== -1) matchedHeaders['Team'] = rawHeaders[teamCol];
  if (phoneCol !== -1) matchedHeaders['Phone'] = rawHeaders[phoneCol];
  if (emailCol !== -1) matchedHeaders['Email'] = rawHeaders[emailCol];

  if (nameCol === -1) {
    throw new Error(
      `Could not identify the Technician Name column in the uploaded file. Please make sure your header includes "Technician", "Name", or "Tech". Found headers: ${rawHeaders.join(
        ', '
      )}`
    );
  }

  const parsedTechs: ParsedTechnicianRow[] = [];
  const detectedRegionsSet = new Set<RegionName>();
  let totalCameras = 0;
  let totalMachines = 0;

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const name = row[nameCol]?.trim();
    if (!name) {
      // Empty row or blank name
      continue;
    }

    const rawRegion = regionCol !== -1 && row[regionCol] ? row[regionCol].trim() : '';
    const { operationalRegion, formattedSubRegion } = mapToOperationalRegion(rawRegion, activeRegion);
    detectedRegionsSet.add(operationalRegion);

    // Parse equipment
    const rawCameras = camerasCol !== -1 && row[camerasCol] ? row[camerasCol] : '';
    const rawMachines = machinesCol !== -1 && row[machinesCol] ? row[machinesCol] : '';

    const cameras = rawCameras ? Math.max(0, parseNumericQuantity(rawCameras, 25)) : 25;
    const machines = rawMachines ? Math.max(0, parseNumericQuantity(rawMachines, 4)) : 4;

    totalCameras += cameras;
    totalMachines += machines;

    // Team & Color
    const rawTeam = teamCol !== -1 ? row[teamCol]?.trim() : undefined;
    const { team, colorGroup } = resolveTeamAndColor(rawTeam, operationalRegion, formattedSubRegion, r - 1);

    // Phone, email, active
    const phone = phoneCol !== -1 && row[phoneCol] ? row[phoneCol].trim() : undefined;
    const email = emailCol !== -1 && row[emailCol] ? row[emailCol].trim() : undefined;

    let active = true;
    if (activeCol !== -1 && row[activeCol]) {
      const actStr = row[activeCol].trim().toLowerCase();
      if (actStr === 'false' || actStr === 'inactive' || actStr === 'no' || actStr === '0') {
        active = false;
      }
    }

    const baseId = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const id = `${baseId}-${operationalRegion.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

    const techObj: Technician = {
      id,
      name,
      region: formattedSubRegion || operationalRegion,
      operationalRegion,
      team,
      colorGroup,
      cameras,
      machines,
      phone,
      email,
      active,
    };

    const rawRowObj: Record<string, string> = {};
    rawHeaders.forEach((h, i) => {
      rawRowObj[h] = row[i] || '';
    });

    parsedTechs.push({
      tech: techObj,
      rawRow: rawRowObj,
      detectedOperationalRegion: operationalRegion,
      originalRegionString: rawRegion || operationalRegion,
    });
  }

  if (parsedTechs.length === 0) {
    throw new Error('No technician rows were found. Please check that your file contains data rows below the header.');
  }

  return {
    technicians: parsedTechs,
    totalParsed: parsedTechs.length,
    matchedHeaders,
    detectedRegions: Array.from(detectedRegionsSet),
    totalCameras,
    totalMachines,
    warnings,
  };
}

/**
 * Generates a clean CSV template for technicians.
 */
export function generateTechnicianCsvTemplate(): string {
  return [
    'Technician,Region,Cameras,Machines,Phone,Email,Status',
    'Austin Miller,TX (Dallas),25,4,214-555-0192,austin@ndsdata.com,Active',
    'Eduardo Lara,CO (Denver),25,5,720-555-0143,eduardo@ndsdata.com,Active',
    'Dustin Fullerton,TX (Houston),25,4,713-555-0188,dustin@ndsdata.com,Active',
    'Darren Robinson,LA (Baton Rouge),25,4,225-555-0177,darren@ndsdata.com,Active',
    'Marcus Vance,Florida (Orlando),20,2,407-555-0112,marcus@ndsdata.com,Active',
    'Carlos Mendez,NOCAL (Bay Area),30,6,415-555-0165,carlos@ndsdata.com,Active',
    'Samson Brooks,SOCAL (Los Angeles),28,4,213-555-0182,samson@ndsdata.com,Active',
    'Tyler Bennett,South East (Atlanta),25,4,404-555-0133,tyler@ndsdata.com,Active',
  ].join('\n');
}

/**
 * Triggers browser download of the CSV template.
 */
export function downloadTechnicianCsvTemplate(): void {
  const content = generateTechnicianCsvTemplate();
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'NDS_Technicians_Roster_Template.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
