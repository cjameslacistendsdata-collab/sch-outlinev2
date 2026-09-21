import { Technician, Project } from '../types';
import { TECHNICIANS } from '../data/technicians';

/**
 * Strips all quotation marks, backticks, escaped quotes, and extraneous leading/trailing spaces.
 */
export function cleanTechName(str: string | undefined | null): string {
  if (!str) return '';
  return str.replace(/["'“”‘’`\\]/g, '').trim();
}

/**
 * Robustly matches any raw name or name fragment against a technician roster.
 * Handles:
 * - Exact full name: "Dustyn May" -> Dustyn May
 * - Last, First: "May, Dustyn" -> Dustyn May
 * - First, Last: "Dustyn, May" -> Dustyn May
 * - Reversed two-word: "May Dustyn" -> Dustyn May
 * - Single token last name: "May" -> Dustyn May
 * - Single token first name: "Dustyn" -> Dustyn May
 */
export function matchKnownTechnician(
  rawName: string | undefined | null,
  roster: Technician[] = TECHNICIANS
): Technician | undefined {
  const clean = cleanTechName(rawName);
  if (!clean || clean.toLowerCase() === 'unassigned') return undefined;

  const lower = clean.toLowerCase();

  // 1. Direct full name match
  const directMatch = roster.find((t) => t.name.toLowerCase() === lower);
  if (directMatch) return directMatch;

  // 2. Comma-separated "Last, First" or "First, Last"
  if (clean.includes(',')) {
    const parts = clean.split(',').map((p) => cleanTechName(p)).filter(Boolean);
    if (parts.length === 2) {
      const reversed = `${parts[1]} ${parts[0]}`.toLowerCase();
      const matchReversed = roster.find((t) => t.name.toLowerCase() === reversed);
      if (matchReversed) return matchReversed;

      const direct = `${parts[0]} ${parts[1]}`.toLowerCase();
      const matchDirect = roster.find((t) => t.name.toLowerCase() === direct);
      if (matchDirect) return matchDirect;
    }
  }

  // 3. Space-separated reversed: "May Dustyn" -> "Dustyn May"
  const words = clean.split(/\s+/).map((w) => cleanTechName(w)).filter(Boolean);
  if (words.length === 2) {
    const reversedWords = `${words[1]} ${words[0]}`.toLowerCase();
    const matchReversed = roster.find((t) => t.name.toLowerCase() === reversedWords);
    if (matchReversed) return matchReversed;
  }

  // 4. Single token match (e.g. "May", "Dustyn", "Watts", "Coreas")
  if (words.length === 1) {
    const token = words[0].toLowerCase();

    // Check unique last name match (e.g. "May" -> Dustyn May)
    const lastNameMatches = roster.filter((t) => {
      const tLastName = t.name.split(' ').slice(-1)[0].toLowerCase();
      return tLastName === token;
    });
    if (lastNameMatches.length === 1) {
      return lastNameMatches[0];
    }

    // Check unique first name match (e.g. "Dustyn" -> Dustyn May)
    const firstNameMatches = roster.filter((t) => {
      const tFirstName = t.name.split(' ')[0].toLowerCase();
      return tFirstName === token;
    });
    if (firstNameMatches.length === 1) {
      return firstNameMatches[0];
    }
  }

  return undefined;
}

/**
 * Splits a raw technician string into an array of canonical individual technician names.
 * Supports:
 * - Comma-separated: "May, Dustyn", "Carlos Coreas, Dustyn May", "Coreas, Carlos, May, Dustyn"
 * - Slash-separated: "May, Dustyn / Carlos Coreas"
 * - Ampersand / and / with / plus / semicolon / newline
 *
 * Guaranteed to NEVER create fragmented tokens like ['"May', 'Dustyn"'] or ['May', 'Dustyn'].
 */
export function splitTechnicianNames(
  raw: string | undefined | null,
  roster: Technician[] = TECHNICIANS
): string[] {
  if (!raw) return [];
  const clean = cleanTechName(raw);
  if (!clean || clean.toLowerCase() === 'unassigned') return [];

  // 1. Check if the entire string matches a known technician (e.g. "May, Dustyn" -> "Dustyn May")
  const directMatch = matchKnownTechnician(clean, roster);
  if (directMatch) {
    return [directMatch.name];
  }

  // 2. Split by major multi-technician delimiters: slash (/), semicolon (;), ampersand (&), plus (+), "and", "with", newlines
  const majorDelimiterRegex = /[\/\&;\+\n]|\band\b|\bwith\b/i;
  if (majorDelimiterRegex.test(clean)) {
    const chunks = clean.split(majorDelimiterRegex).map(cleanTechName).filter(Boolean);
    const results: string[] = [];
    chunks.forEach((chunk) => {
      const subTechs = splitTechnicianNames(chunk, roster);
      subTechs.forEach((t) => {
        if (!results.includes(t)) results.push(t);
      });
    });
    if (results.length > 0) return results;
  }

  // 3. Comma-separated handling
  if (clean.includes(',')) {
    const parts = clean.split(',').map(cleanTechName).filter(Boolean);

    // Look for adjacent pairs that form "Last, First" matching a known technician
    const results: string[] = [];
    let i = 0;
    while (i < parts.length) {
      // Check if parts[i], parts[i+1] matches a technician
      if (i + 1 < parts.length) {
        const pairCandidate = `${parts[i]}, ${parts[i + 1]}`;
        const pairMatch = matchKnownTechnician(pairCandidate, roster);
        if (pairMatch) {
          if (!results.includes(pairMatch.name)) results.push(pairMatch.name);
          i += 2;
          continue;
        }
      }

      // Check if parts[i] matches a technician on its own
      const singleMatch = matchKnownTechnician(parts[i], roster);
      if (singleMatch) {
        if (!results.includes(singleMatch.name)) results.push(singleMatch.name);
      } else if (parts[i].toLowerCase() !== 'unassigned') {
        if (!results.includes(parts[i])) results.push(parts[i]);
      }
      i++;
    }

    if (results.length > 0) return results;
  }

  return [clean];
}

/**
 * Checks if a project is assigned to a specific technician (either as the sole technician
 * or as one of multiple assigned technicians).
 */
export function isProjectAssignedToTech(
  projectTech: string | undefined | null,
  targetTechName: string
): boolean {
  if (!projectTech || !targetTechName) return false;

  const targetClean = cleanTechName(targetTechName).toLowerCase();
  if (!targetClean || targetClean === 'unassigned') return false;

  const projectClean = cleanTechName(projectTech).toLowerCase();
  if (projectClean === targetClean) return true;

  const targetMatch = matchKnownTechnician(targetTechName);

  const techs = splitTechnicianNames(projectTech);
  return techs.some((t) => {
    const tClean = cleanTechName(t).toLowerCase();
    if (tClean === targetClean) return true;

    const tMatch = matchKnownTechnician(t);
    if (tMatch && targetMatch && tMatch.id === targetMatch.id) return true;

    // First name match if single token
    if (tClean.split(' ')[0] === targetClean || targetClean.split(' ')[0] === tClean) return true;
    // Last name match if single token
    if (tClean.split(' ').slice(-1)[0] === targetClean || targetClean.split(' ').slice(-1)[0] === tClean) return true;

    return false;
  });
}

/**
 * Determines if a technician string contains multiple assigned technicians.
 * Examples of multiple technicians:
 * - "Timothy Addison, Carlos Coreas" -> true
 * - "Carlos Coreas, Justin Windecker" -> true
 * - "Diego Coreas, Fullerton" -> true
 * - "Carlos Coreas / Dustyn May" -> true
 * - "Dustyn May" -> false
 * - "May, Dustyn" (Last, First of a single technician) -> false
 * - "Koda Castillo" -> false
 */
export function hasMultipleTechnicians(
  raw: string | undefined | null,
  roster: Technician[] = TECHNICIANS
): boolean {
  if (!raw) return false;
  const clean = cleanTechName(raw);
  if (!clean || clean.toLowerCase() === 'unassigned') return false;

  // Direct match to a known technician means it is a SINGLE technician
  const directMatch = matchKnownTechnician(clean, roster);
  if (directMatch) return false;

  // Delimiters indicating multiple technicians
  const multiDelimiters = /[\/\&;\+\n]|\band\b|\bwith\b/i;
  if (multiDelimiters.test(clean)) return true;

  // If contains comma, check if it's "Last, First" of a single technician or multiple distinct technicians
  if (clean.includes(',')) {
    const parts = clean.split(',').map(cleanTechName).filter(Boolean);
    if (parts.length > 2) return true;
    if (parts.length === 2) {
      // Check if reversed or direct matches a known technician
      const reversed = `${parts[1]} ${parts[0]}`;
      if (matchKnownTechnician(reversed, roster)) return false;
      const direct = `${parts[0]} ${parts[1]}`;
      if (matchKnownTechnician(direct, roster)) return false;

      // If both parts have multiple words or either part matches a known technician, it's multiple technicians
      const firstWords = parts[0].split(/\s+/).filter(Boolean);
      const secondWords = parts[1].split(/\s+/).filter(Boolean);
      if (firstWords.length >= 2 || secondWords.length >= 2) return true;
      if (matchKnownTechnician(parts[0], roster) || matchKnownTechnician(parts[1], roster)) return true;
    }
  }

  const list = splitTechnicianNames(clean, roster);
  return list.length > 1;
}

/**
 * Cleans and deduplicates a technician roster, purging any rogue fragment entries
 * (e.g. '"May', 'Dustyn"', 'May') and eliminating ANY combined multi-technician entries
 * (e.g. "Timothy Addison, Carlos Coreas", "Carlos Coreas, Justin Windecker").
 * A technician row/line item must represent an individual technician only.
 */
export function sanitizeTechnicianRoster(techs: Technician[]): Technician[] {
  if (!Array.isArray(techs)) return [];

  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  const sanitized: Technician[] = [];

  techs.forEach((t) => {
    const cleanName = cleanTechName(t.name);
    if (!cleanName || cleanName.toLowerCase() === 'unassigned') return;

    // Reject any technician line item that represents multiple technicians
    if (hasMultipleTechnicians(cleanName)) {
      return;
    }

    const splitNames = splitTechnicianNames(cleanName);
    if (splitNames.length > 1) {
      return;
    }

    // Check if it matches a known canonical technician
    const known = matchKnownTechnician(cleanName);
    const finalTech: Technician = known
      ? {
          ...known,
          active: t.active !== undefined ? t.active : known.active,
          cameras: t.cameras || known.cameras,
          machines: t.machines || known.machines,
        }
      : {
          ...t,
          name: cleanName,
        };

    if (hasMultipleTechnicians(finalTech.name)) {
      return;
    }

    const normName = finalTech.name.trim().toLowerCase();
    if (!seenIds.has(finalTech.id) && !seenNames.has(normName)) {
      seenIds.add(finalTech.id);
      seenNames.add(normName);
      sanitized.push(finalTech);
    }
  });

  return sanitized;
}

/**
 * Extracts and syncs the list of individual technicians from projects and base roster.
 * Ensures that if multiple technicians are assigned to a project, they are NOT grouped
 * into a single combined row, and NO extra line item or column is created below.
 */
export function getIndividualTechList(
  projects: Project[],
  baseTechnicians?: Technician[],
  currentRegion?: string
): Technician[] {
  const base =
    baseTechnicians !== undefined
      ? sanitizeTechnicianRoster(baseTechnicians)
      : currentRegion === 'South Central'
      ? [...TECHNICIANS]
      : [];

  const existingNames = new Set(base.map((t) => cleanTechName(t.name).toLowerCase()));

  projects.forEach((p) => {
    // CRITICAL: When multiple techs are assigned to a project, DO NOT create a line item or column below!
    if (hasMultipleTechnicians(p.technician, base)) {
      return;
    }

    const individualTechs = splitTechnicianNames(p.technician, base);
    if (individualTechs.length !== 1) {
      return;
    }

    const techName = individualTechs[0];
    const trimmed = cleanTechName(techName);
    const lower = trimmed.toLowerCase();

    if (!trimmed || lower === 'unassigned' || hasMultipleTechnicians(trimmed, base)) return;

    // Check if this technician matches ANY existing technician in the roster
    const matched = matchKnownTechnician(trimmed, base);
    if (matched || existingNames.has(lower)) {
      return;
    }

    existingNames.add(lower);

    let region = currentRegion || 'TX (Dallas)';
    if (currentRegion === 'South Central' || !currentRegion) {
      if (p.cityState?.includes('Houston')) region = 'TX (Houston)';
      else if (p.cityState?.includes('LA') || p.cityState?.includes('Louisiana') || p.cityState?.includes('New Orleans')) region = 'LA';
      else if (p.cityState?.includes('CO') || p.cityState?.includes('Denver') || p.cityState?.includes('Colorado')) region = 'CO';
      else region = 'TX (Dallas)';
    }

    base.push({
      id: `tech-auto-${lower.replace(/[^a-z0-9]/g, '-')}`,
      name: trimmed,
      team: `${currentRegion || 'Field'} Fleet`,
      colorGroup: 'navy',
      region: region as any,
      cameras: 25,
      machines: 5,
      active: true,
    });
  });

  return sanitizeTechnicianRoster(base);
}
