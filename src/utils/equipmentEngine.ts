import { Project, WeekDay, Technician, EquipmentType, SpecialAssignment } from '../types';
import { shouldShowProjectEventOnDay } from './workWeekEngine';
import { isProjectAssignedToTech, splitTechnicianNames, cleanTechName, matchKnownTechnician } from './technicianUtils';

export const WEEK_DAY_ORDER: WeekDay[] = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/**
 * Returns the equipment units designated to a specific technician from the imported CSV
 * or divided evenly if co-assigned across multiple technicians.
 */
export function getTechUnitsForProject(p: Project, techName: string): number {
  if (p.techUnits) {
    if (p.techUnits[techName] !== undefined) return p.techUnits[techName];
    const targetMatch = matchKnownTechnician(techName);
    const matchKey = Object.keys(p.techUnits).find((k) => {
      const kMatch = matchKnownTechnician(k);
      if (kMatch && targetMatch && kMatch.id === targetMatch.id) return true;
      return cleanTechName(k).toLowerCase() === cleanTechName(techName).toLowerCase();
    });
    if (matchKey && p.techUnits[matchKey] !== undefined) {
      return p.techUnits[matchKey];
    }
  }
  const assigned = splitTechnicianNames(p.technician);
  if (assigned.length > 1) {
    return Math.round((p.equipmentCount || 0) / assigned.length);
  }
  return p.equipmentCount || 0;
}

/**
 * Determines whether a study/project uses Camera or Machine equipment.
 * In traffic data operations:
 * - ATR (Automatic Traffic Recorder tube counters) uses Machine.
 * - TMC, ATR (Camera), Screenline, Video Review use Camera units.
 */
export function getProjectEquipmentType(project: {
  studyType: string;
  equipmentType?: EquipmentType;
}): EquipmentType {
  if (project.equipmentType) {
    return project.equipmentType;
  }
  if (project.studyType === 'ATR') {
    return 'Machine';
  }
  return 'Camera';
}

export interface DayEquipmentDelta {
  installedCameras: number;
  installedMachines: number;
  teardownCameras: number;
  teardownMachines: number;
  // Net changes on this day (Install removes, Teardown adds back)
  netCameras: number;
  netMachines: number;
  // Day-end running balances
  availableCameras: number;
  availableMachines: number;
}

/**
 * Calculates technician inventory timeline across the week (Sunday through Saturday).
 * - When a project is installed: equipment is subtracted from technician inventory (GREEN).
 * - When a project is torn down: equipment is added back to technician inventory (VIOLET).
 * - Accurately uses the designated units for this specific technician from CSV.
 */
export function calculateTechInventoryTimeline(
  tech: Technician,
  projects: Project[],
  specialAssignments?: Record<string, SpecialAssignment>,
  activeWeekId?: string
): Record<WeekDay, DayEquipmentDelta> {
  // Strict valid project filter: must have valid ID, not cancelled, and actively assigned to this technician
  const techProjects = projects.filter(
    (p) =>
      p.id &&
      p.id.trim() !== '' &&
      !p.isCancelled &&
      p.opsStatus !== 'Cancelled' &&
      isProjectAssignedToTech(p.technician, tech.name)
  );

  const result = {} as Record<WeekDay, DayEquipmentDelta>;

  let currentCameras = tech.cameras;
  let currentMachines = tech.machines;

  // If no valid projects are assigned to this technician, stock remains at full capacity
  if (techProjects.length === 0) {
    for (const day of WEEK_DAY_ORDER) {
      result[day] = {
        installedCameras: 0,
        installedMachines: 0,
        teardownCameras: 0,
        teardownMachines: 0,
        netCameras: 0,
        netMachines: 0,
        availableCameras: tech.cameras,
        availableMachines: tech.machines,
      };
    }
    return result;
  }

  for (const day of WEEK_DAY_ORDER) {
    let installedCameras = 0;
    let installedMachines = 0;
    let teardownCameras = 0;
    let teardownMachines = 0;

    // Projects installed or torn down on this day (only valid active projects for this tech)
    for (const p of techProjects) {
      const equipCount = getTechUnitsForProject(p, tech.name);
      const type = getProjectEquipmentType(p);

      const isInstallToday = p.installDay === day && (!activeWeekId || shouldShowProjectEventOnDay(p, 'install', day, activeWeekId));
      const isTeardownToday = p.teardownDay === day && (!activeWeekId || shouldShowProjectEventOnDay(p, 'teardown', day, activeWeekId));

      if (isInstallToday) {
        if (type === 'Camera') installedCameras += equipCount;
        else installedMachines += equipCount;
      }

      if (isTeardownToday) {
        if (type === 'Camera') teardownCameras += equipCount;
        else teardownMachines += equipCount;
      }
    }

    // Installs REMOVE equipment (subtract), Teardowns ADD equipment back (add real-time)
    const netCameras = teardownCameras - installedCameras;
    const netMachines = teardownMachines - installedMachines;

    currentCameras += netCameras;
    currentMachines += netMachines;

    result[day] = {
      installedCameras,
      installedMachines,
      teardownCameras,
      teardownMachines,
      netCameras,
      netMachines,
      availableCameras: Math.max(0, currentCameras),
      availableMachines: Math.max(0, currentMachines),
    };
  }

  return result;
}

/**
 * Returns overall active field load and current remaining stock for a technician.
 * Calculates available cameras in real-time by adding upon teardown and subtracting upon install
 * up to the specific operational reference day.
 */
export function getTechOverallEquipmentStats(
  tech: Technician,
  projects: Project[],
  specialAssignments?: Record<string, SpecialAssignment>,
  refDayName?: WeekDay,
  activeWeekId?: string
) {
  const timeline = calculateTechInventoryTimeline(tech, projects, specialAssignments, activeWeekId);
  const targetDay = refDayName || 'Monday';
  const dayDelta = timeline[targetDay] || timeline['Monday'];

  const activeCamerasInField = Math.max(0, tech.cameras - dayDelta.availableCameras);
  const activeMachinesInField = Math.max(0, tech.machines - dayDelta.availableMachines);

  return {
    baseCameras: tech.cameras,
    baseMachines: tech.machines,
    currentAvailableCameras: dayDelta.availableCameras,
    currentAvailableMachines: dayDelta.availableMachines,
    activeCamerasInField,
    activeMachinesInField,
  };
}
