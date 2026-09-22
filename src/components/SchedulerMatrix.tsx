import React, { useState } from 'react';
import { Project, WeekDay, Technician, SpecialAssignment, DateColumn } from '../types';
import { TECHNICIANS } from '../data/technicians';
import { WEEK_DAYS, CURRENT_DAY_NAME, getOpsStatusBadge } from '../utils/statusEngine';
import {
  getProjectEquipmentType,
  calculateTechInventoryTimeline,
  getTechOverallEquipmentStats,
  getTechUnitsForProject,
} from '../utils/equipmentEngine';
import {
  shouldShowProjectEventOnDay,
  isTeardownRollover,
  getProjectBaseWorkWeek,
} from '../utils/workWeekEngine';
import {
  getIndividualTechList,
  isProjectAssignedToTech,
  splitTechnicianNames,
  sanitizeTechnicianRoster,
} from '../utils/technicianUtils';
import {
  Info,
  Plus,
  MapPin,
  Camera,
  Cog,
  ArrowDownCircle,
  ArrowUpCircle,
  Filter,
  X,
  MousePointerClick,
  Layers,
  Trash2,
  Users,
  UserPlus,
  Sparkles,
  RefreshCw,
  Calendar,
  ChevronDown,
  ChevronUp,
  Tag,
  FolderPlus,
  Edit3,
  UploadCloud,
  RotateCcw,
  BatteryCharging,
  FileText,
  Check,
} from 'lucide-react';

interface SchedulerMatrixProps {
  projects: Project[];
  technicians?: Technician[];
  dateColumns?: DateColumn[];
  currentWeekLabel?: string;
  activeWeekId?: string;
  allowCOD?: boolean;
  currentRegion?: string;
  onOpenImportCSV?: () => void;
  onAddTechnician?: (tech: Technician) => void;
  onRemoveTechnician?: (techId: string) => void;
  onOpenManageTechs?: () => void;
  onOpenAddTech?: () => void;
  onAutoPopulateFromSheet?: () => void;
  autoPopulatePendingCount?: number;
  onAutoSyncAllStatuses?: () => void;
  onOpenResetSchedule?: () => void;
  onUpdateProjectGroup?: (projectId: string, group: string | null) => void;
  onUpdateProjectNotes?: (projectId: string, notes: string) => void;
  onSelectProject: (project: Project) => void;
  onAssignProjectToDay: (techName: string, day: WeekDay) => void;
  onApplyBatterySwaps?: (projectId: string, durationDays: number) => void;
  onClearBatterySwaps?: (projectId: string) => void;
  searchTerm: string;
  selectedTechFilter?: string | null;
  selectedDayFilter?: WeekDay | null;
  highlightedProjectId?: string | null;
  onFilterSync?: (filter: { tech?: string | null; day?: WeekDay | null; projectId?: string | null }) => void;
  onClearFilterSync?: () => void;
  isCompact?: boolean;
  onAssignCODForTech?: (technicianName: string, dayName?: WeekDay, listName?: string) => void;
  onOpenAssignCOD?: (technicianName: string, dayName?: WeekDay, listName?: string) => void;
  onUpdateCodListName?: (techName: string, dayName: WeekDay, newListName: string) => void;
  onToggleDayGroup?: (techName: string, dayName: WeekDay, group: 'COD') => void;
  specialAssignments?: Record<string, SpecialAssignment>;
  onUpdateSpecialAssignmentEquipment?: (key: string, cameras: number, machines: number) => void;
  onSetSpecialAssignment?: (assignment: SpecialAssignment) => void;
  onRemoveSpecialAssignment?: (key: string) => void;
}

export type MatrixEventType = 'install' | 'battery_swap' | 'teardown' | 'both';

export interface CellMatrixEvent {
  project: Project;
  eventType: MatrixEventType;
}

const REGION_ORDER: ('TX (Dallas)' | 'TX (Houston)' | 'LA' | 'CO')[] = [
  'TX (Dallas)',
  'TX (Houston)',
  'LA',
  'CO',
];

export const SchedulerMatrix: React.FC<SchedulerMatrixProps> = ({
  projects,
  technicians,
  dateColumns,
  currentWeekLabel,
  activeWeekId = '2026-W37',
  allowCOD = true,
  currentRegion = 'South Central',
  onOpenImportCSV,
  onAddTechnician,
  onRemoveTechnician,
  onOpenManageTechs,
  onOpenAddTech,
  onAutoPopulateFromSheet,
  autoPopulatePendingCount = 0,
  onAutoSyncAllStatuses,
  onOpenResetSchedule,
  onUpdateProjectGroup,
  onUpdateProjectNotes,
  onAssignCODForTech,
  onOpenAssignCOD,
  onUpdateCodListName,
  onToggleDayGroup,
  onSelectProject,
  onAssignProjectToDay,
  onApplyBatterySwaps,
  onClearBatterySwaps,
  searchTerm,
  selectedTechFilter,
  selectedDayFilter,
  highlightedProjectId,
  onFilterSync,
  onClearFilterSync,
  isCompact = false,
  specialAssignments,
  onUpdateSpecialAssignmentEquipment,
  onSetSpecialAssignment,
  onRemoveSpecialAssignment,
}) => {
  const [selectedRegionFilter, setSelectedRegionFilter] = useState<string>('all');
  const [activityFilter, setActivityFilter] = useState<'all' | 'install' | 'battery_swap' | 'teardown'>('all');
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [expandedCodGroups, setExpandedCodGroups] = useState<Set<string>>(new Set());
  const [notesModalProject, setNotesModalProject] = useState<Project | null>(null);
  const [editingNoteText, setEditingNoteText] = useState<string>('');

  const handleSaveNote = () => {
    if (!notesModalProject) return;
    const trimmed = editingNoteText.trim();
    if (onUpdateProjectNotes) {
      onUpdateProjectNotes(notesModalProject.id, trimmed);
    }
    // Also update locally on project object reference for immediate UI response
    notesModalProject.schedulerNotes = trimmed;
    setNotesModalProject(null);
  };

  const getDisplayProjectHeader = (proj: Project) => {
    const id = (proj.id || '').trim();
    const rawCity = (proj.cityState && proj.cityState !== 'Unspecified') ? proj.cityState.trim() : '';

    // Match patterns like "26-260111 City, ST"
    const match = id.match(/^(\d{2}-\d{4,6}[A-Za-z0-9\-_]*)\s+(.+)$/);
    if (match) {
      return {
        projectNumber: match[1],
        city: match[2],
      };
    }

    if (rawCity) {
      if (id.toLowerCase().includes(rawCity.toLowerCase())) {
        return { projectNumber: id, city: '' };
      }
      return { projectNumber: id, city: rawCity };
    }

    return { projectNumber: id, city: '' };
  };

  const toggleCodGroup = (groupId: string) => {
    setExpandedCodGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };
  const [hoveredProject, setHoveredProject] = useState<Project | null>(null);
  const [techToDelete, setTechToDelete] = useState<Technician | null>(null);

  const activeDays = dateColumns && dateColumns.length > 0 ? dateColumns : WEEK_DAYS;
  const hasActiveSyncFilter = Boolean(selectedTechFilter || selectedDayFilter || highlightedProjectId);

  // Sync technicians directly from Monitoring Sheet projects so no technicians or projects are missed
  // When multiple technicians are assigned to a project, do not group them: each individual tech gets their own row
  const techList = React.useMemo(() => {
    return sanitizeTechnicianRoster(getIndividualTechList(projects, technicians, currentRegion));
  }, [technicians, projects, currentRegion]);

  // Filter technicians if search or region filter is active
  const filteredTechs = techList.filter((tech) => {
    if (selectedRegionFilter !== 'all' && tech.region !== selectedRegionFilter) {
      return false;
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchesTech = tech.name.toLowerCase().includes(term);
      const hasMatchingProject = projects.some(
        (p) =>
          isProjectAssignedToTech(p.technician, tech.name) &&
          (p.id.toLowerCase().includes(term) ||
            p.cityState.toLowerCase().includes(term) ||
            (p.technician && p.technician.toLowerCase().includes(term)))
      );
      return matchesTech || hasMatchingProject;
    }
    return true;
  });

  const allRegions = React.useMemo(() => {
    const presentRegions = Array.from(new Set(filteredTechs.map((t) => t.region || 'TX (Dallas)')));
    const ordered = REGION_ORDER.filter((r) => presentRegions.includes(r as any));
    const others = presentRegions.filter((r) => !REGION_ORDER.includes(r as any));
    return [...ordered, ...others];
  }, [filteredTechs]);

  // Helper to get events for a tech on a given day (INSTALL, BATTERY SWAP, TEARDOWN)
  // Allows shared projects to appear in every assigned technician's row alongside their other projects
  const getEventsForCell = (techName: string, dayName: WeekDay): CellMatrixEvent[] => {
    const events: CellMatrixEvent[] = [];

    projects.forEach((p) => {
      const isAssigned = isProjectAssignedToTech(p.technician, techName);

      if (!isAssigned) return;

      // Filter by group if selected
      if (groupFilter !== 'all') {
        const pGroup = (p.group || p.specialBadge || '').toLowerCase();
        if (pGroup !== groupFilter.toLowerCase()) return;
      }

      if (shouldShowProjectEventOnDay(p, 'install', dayName, activeWeekId)) {
        if (activityFilter === 'all' || activityFilter === 'install') {
          events.push({ project: p, eventType: 'install' });
        }
      }
      if (shouldShowProjectEventOnDay(p, 'battery_swap', dayName, activeWeekId)) {
        if (activityFilter === 'all' || activityFilter === 'battery_swap') {
          events.push({ project: p, eventType: 'battery_swap' });
        }
      }
      if (shouldShowProjectEventOnDay(p, 'teardown', dayName, activeWeekId)) {
        if (activityFilter === 'all' || activityFilter === 'teardown') {
          events.push({ project: p, eventType: 'teardown' });
        }
      }
    });

    return events;
  };

  // Helper for tech column style matching region
  const getTechHeaderStyle = (colorGroup: Technician['colorGroup']) => {
    switch (colorGroup) {
      case 'orange':
        return 'bg-gradient-to-r from-amber-600/90 to-orange-600/90 text-white font-bold border-amber-700/80';
      case 'navy':
        return 'bg-gradient-to-r from-slate-900 to-blue-950 text-sky-200 font-bold border-blue-900';
      case 'burgundy':
        return 'bg-gradient-to-r from-rose-950 to-red-950 text-rose-200 font-bold border-rose-900';
      case 'green':
        return 'bg-gradient-to-r from-emerald-950 to-green-900 text-emerald-200 font-bold border-emerald-900';
    }
  };

  // Pre-calculate counts for activity filters accurately reflecting active week events
  const totalInstallsCount = projects.filter((p) =>
    activeDays.some((d) => shouldShowProjectEventOnDay(p, 'install', d.dayName, activeWeekId))
  ).length;
  const totalBatterySwapsCount = projects.filter((p) =>
    activeDays.some((d) => shouldShowProjectEventOnDay(p, 'battery_swap', d.dayName, activeWeekId))
  ).length;
  const totalTeardownsCount = projects.filter((p) =>
    activeDays.some((d) => shouldShowProjectEventOnDay(p, 'teardown', d.dayName, activeWeekId))
  ).length;
  const totalCodCount = projects.filter((p) => (p.group || p.specialBadge) === 'COD').length;

  // Rollover Teardowns carried over into this active week from previous week install
  const rolloverTeardownsInActiveWeek = React.useMemo(() => {
    return projects.filter(
      (p) =>
        isTeardownRollover(p) &&
        activeDays.some((d) => shouldShowProjectEventOnDay(p, 'teardown', d.dayName, activeWeekId))
    );
  }, [projects, activeDays, activeWeekId]);

  // Fleet wide equipment totals from dispatch sheet
  const fleetTotalCameras = techList.reduce((acc, t) => acc + t.cameras, 0);
  const fleetTotalMachines = techList.reduce((acc, t) => acc + t.machines, 0);

  // Available unique regions
  const availableRegions = Array.from(new Set(techList.map((t) => t.region)));

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 shadow-xl overflow-hidden">
      {/* Scheduler Sub-header with legend & region filters */}
      <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <h2 className="text-sm font-bold text-white tracking-wide uppercase">
              Field Technician Weekly Dispatch & Inventory Matrix
            </h2>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono font-bold">
            <span className="text-cyan-400 bg-cyan-950/80 border border-cyan-800 px-2 py-0.5 rounded-md flex items-center gap-1">
              <Camera className="w-3 h-3 text-cyan-400" />
              <span>{fleetTotalCameras} Cameras</span>
            </span>
            <span className="text-amber-400 bg-amber-950/80 border border-amber-800 px-2 py-0.5 rounded-md flex items-center gap-1">
              <Cog className="w-3 h-3 text-amber-400" />
              <span>{fleetTotalMachines} Machines</span>
            </span>
          </div>
        </div>

        {/* Action Controls & Filters */}
        <div className="flex items-center gap-2 text-xs flex-wrap">
          {/* AUTO-POPULATE THE SCHEDULER MATRIX AND GET IT FROM MONITORING SHEET */}
          {onAutoPopulateFromSheet && (
            <button
              id="btn-auto-populate-matrix"
              onClick={onAutoPopulateFromSheet}
              title="Auto-populate matrix install/teardown days & technician assignments directly from Monitoring Sheet"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-md shadow-amber-500/20 transition-all cursor-pointer select-none active:scale-95"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Auto-Populate from Sheet</span>
              {autoPopulatePendingCount > 0 && (
                <span className="bg-slate-950 text-amber-300 px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black">
                  {autoPopulatePendingCount}
                </span>
              )}
            </button>
          )}

          {/* AUTOMATE STATUS ACROSS ALL MODULES BUTTON */}
          {onAutoSyncAllStatuses && (
            <button
              id="btn-auto-sync-matrix"
              onClick={onAutoSyncAllStatuses}
              title="Automate Status across all projects based on collection dates, schedule days, and Ref Date"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white shadow-sm transition-all cursor-pointer select-none active:scale-95"
            >
              <RefreshCw className="w-3.5 h-3.5 text-cyan-200" />
              <span>Auto-Sync Statuses</span>
            </button>
          )}

          {/* CLEAR / RESET SCHEDULER MATRIX & DISPATCH */}
          {onOpenResetSchedule && (
            <button
              id="btn-clear-reset-matrix"
              onClick={onOpenResetSchedule}
              title="Clear or Reset Scheduler Matrix & Dispatch data"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-rose-300 hover:text-rose-200 border border-slate-700 transition-all cursor-pointer select-none active:scale-95"
            >
              <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
              <span>Clear / Reset</span>
            </button>
          )}

          {/* Technicians Management Controls */}
          <div className="flex items-center gap-1.5">
            {onOpenManageTechs && (
              <button
                id="btn-manage-technicians"
                onClick={onOpenManageTechs}
                title="Manage technicians, add/remove roster, update baseline equipment"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
              >
                <Users className="w-3.5 h-3.5 text-cyan-400" />
                <span>Techs ({techList.length})</span>
              </button>
            )}
            {(onOpenAddTech || onOpenManageTechs) && (
              <button
                id="btn-add-tech-quick"
                onClick={onOpenAddTech || onOpenManageTechs}
                title="Add new technician"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white shadow-sm transition-colors cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">+ Tech</span>
              </button>
            )}
          </div>

          {hasActiveSyncFilter && (
            <button
              onClick={onClearFilterSync}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors shadow-sm animate-pulse"
              title="Clear active filter on monitoring sheet"
            >
              <X className="w-3 h-3" />
              <span>Clear Filter Sync</span>
            </button>
          )}

          {/* Activity / Stage View: All, Installs Only (Green), Battery Swaps Only (Sky Blue), Teardowns Only (Violet) */}
          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
            <span className="text-slate-400 text-[10px] uppercase font-bold px-1.5 flex items-center gap-1">
              <Layers className="w-3 h-3 text-cyan-400" /> Filter:
            </span>
            <button
              onClick={() => setActivityFilter('all')}
              className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${
                activityFilter === 'all'
                  ? 'bg-cyan-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setActivityFilter('install')}
              title="Installs: Equipment is removed from technician inventory"
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${
                activityFilter === 'install'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-emerald-400 hover:text-white'
              }`}
            >
              <ArrowDownCircle className="w-2.5 h-2.5 text-emerald-300" />
              <span>INS ({totalInstallsCount})</span>
            </button>
            <button
              onClick={() => setActivityFilter('battery_swap')}
              title="Battery Swaps: Technician swaps batteries on active field equipment"
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${
                activityFilter === 'battery_swap'
                  ? 'bg-sky-600 text-slate-950 font-black shadow-sm'
                  : 'text-sky-300 hover:text-white'
              }`}
            >
              <RefreshCw className="w-2.5 h-2.5 text-sky-400" />
              <span>BATTERY ({totalBatterySwapsCount})</span>
            </button>
            <button
              onClick={() => setActivityFilter('teardown')}
              title="Teardowns: Equipment is returned back to technician inventory"
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${
                activityFilter === 'teardown'
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-violet-300 hover:text-white'
              }`}
            >
              <ArrowUpCircle className="w-2.5 h-2.5 text-violet-300" />
              <span>TD ({totalTeardownsCount})</span>
            </button>
          </div>

          {/* Region Filter matching photo */}
          <div className="flex items-center gap-1">
            <span className="text-slate-400 text-[11px] flex items-center gap-1">
              <Filter className="w-3 h-3" /> Region:
            </span>
            <select
              value={selectedRegionFilter}
              onChange={(e) => setSelectedRegionFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-2 py-1 outline-none focus:border-cyan-500"
            >
              <option value="all">All Regions ({techList.length} Techs)</option>
              {availableRegions.map((region) => {
                const count = techList.filter((t) => t.region === region).length;
                return (
                  <option key={region} value={region}>
                    {region} ({count})
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      </div>

      {/* Sync Filter notice bar if active */}
      {hasActiveSyncFilter && (
        <div className="bg-amber-950/40 border-b border-amber-800/80 px-4 py-2 flex items-center justify-between text-xs text-amber-300">
          <div className="flex items-center gap-2">
            <MousePointerClick className="w-3.5 h-3.5 text-amber-400" />
            <span>
              <strong>Matrix Filter Active:</strong> Monitoring sheet filtered by{' '}
              {selectedTechFilter && <span className="bg-slate-900 px-2 py-0.5 rounded text-white font-semibold">Tech: {selectedTechFilter}</span>}{' '}
              {selectedDayFilter && <span className="bg-slate-900 px-2 py-0.5 rounded text-cyan-300 font-semibold">Day: {selectedDayFilter}</span>}
              {highlightedProjectId && <span className="bg-slate-900 px-2 py-0.5 rounded text-amber-300 font-mono font-bold">#{highlightedProjectId}</span>}
            </span>
          </div>
          <button
            onClick={onClearFilterSync}
            className="text-[11px] text-amber-400 hover:text-white underline font-semibold"
          >
            Show All Jobs in Table
          </button>
        </div>
      )}

      {/* Rollover Teardowns Notification Banner for Upcoming Work Week */}
      {rolloverTeardownsInActiveWeek.length > 0 && (
        <div className="rollover-banner mx-4 my-2.5 p-3.5 rounded-xl bg-purple-100/90 border-2 border-purple-300 shadow-sm dark:bg-gradient-to-r dark:from-purple-950/90 dark:via-indigo-950/80 dark:to-slate-900/90 dark:border-purple-500/50 backdrop-blur-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-purple-950 dark:text-purple-100">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-700 text-white dark:bg-purple-900/90 dark:text-purple-200 border border-purple-500/50 flex items-center justify-center shrink-0 shadow-sm mt-0.5 sm:mt-0">
              <RefreshCw className="w-4 h-4 animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-white tracking-wide text-[11px] uppercase bg-purple-700 dark:bg-purple-800 px-2.5 py-0.5 rounded-md border border-purple-600/50 dark:border-purple-400/40 shadow-xs">
                  Upcoming Work Week Rollover Active
                </span>
                <span className="text-purple-950 dark:text-purple-200 text-xs font-bold">
                  {rolloverTeardownsInActiveWeek.length} project teardown{rolloverTeardownsInActiveWeek.length > 1 ? 's' : ''} carried over from previous week:
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap mt-2">
                {rolloverTeardownsInActiveWeek.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onSelectProject(p)}
                    title={`View details for Project ${p.id} (${p.cityState || 'Unspecified'})`}
                    className="rollover-chip inline-flex items-center gap-2 font-mono text-[11px] font-semibold bg-white hover:bg-purple-100/90 text-slate-900 border-2 border-purple-300 hover:border-purple-600 shadow-xs hover:shadow-md active:scale-95 dark:bg-purple-950/90 dark:hover:bg-purple-900 dark:border-purple-700/80 dark:text-white px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                  >
                    <span className="chip-id text-purple-900 dark:text-amber-300 font-extrabold tracking-tight">#{p.id}</span>
                    {p.cityState && (
                      <span className="chip-city text-slate-800 dark:text-slate-100 font-semibold font-sans text-[11px] max-w-[140px] truncate">
                        {p.cityState.split(',')[0]}
                      </span>
                    )}
                    <span className="chip-day text-purple-900 bg-purple-100 border border-purple-300 dark:bg-purple-900/90 dark:text-purple-200 dark:border-purple-500/50 font-bold text-[10px] px-1.5 py-0.5 rounded">
                      {p.teardownDay}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="shrink-0 self-end sm:self-center">
            <span className="inline-flex items-center gap-1.5 text-[11px] bg-white text-purple-950 border-2 border-purple-300 shadow-xs dark:bg-purple-900/90 dark:text-purple-100 dark:border-purple-500/50 px-2.5 py-1 rounded-lg font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span>Teardowns Synced to Current View</span>
            </span>
          </div>
        </div>
      )}

      {/* The Main Matrix Table - Maximized Full Width (No horizontal scroll on standard displays) */}
      <div className="w-full overflow-x-auto">
        <table className="w-full border-collapse text-left table-fixed min-w-[760px] lg:min-w-full">
          <colgroup>
            <col className="w-36 sm:w-44 lg:w-48" />
            {activeDays.map((d) => (
              <col key={`col-${d.dayName}`} className="w-[calc((100%-9rem)/7)] sm:w-[calc((100%-11rem)/7)] lg:w-[calc((100%-12rem)/7)]" />
            ))}
          </colgroup>
          {/* Header Row 1: Dates (Matching Image 1: 8/30, 8/31, 9/1, 9/2, 9/3, 9/4, 9/5) */}
          <thead>
            <tr>
              <th className="w-36 sm:w-44 lg:w-48 bg-slate-950 border border-slate-700/80 p-1.5 sm:p-2 text-xs font-black text-slate-200 tracking-wide uppercase">
                <div className="flex items-center justify-between">
                  <span>TECHNICIAN & FLEET</span>
                  <span className="text-[10px] text-slate-500 font-normal lowercase">click to filter</span>
                </div>
              </th>
              {activeDays.map((day) => {
                const isFilteredDay = selectedDayFilter === day.dayName;
                return (
                  <th
                    key={`date-${day.dateStr}`}
                    onClick={() => onFilterSync?.({ day: day.dayName })}
                    title={`Click to filter Monitoring Sheet to ${day.dayName}`}
                    className={`border border-slate-700/80 p-1.5 text-center text-xs font-extrabold tracking-wider cursor-pointer select-none transition-all ${
                      isFilteredDay
                        ? 'bg-amber-400 text-slate-950 ring-4 ring-amber-300 ring-inset'
                        : day.isToday
                        ? 'bg-emerald-500 text-slate-950 ring-2 ring-emerald-300 ring-inset hover:brightness-105'
                        : 'bg-[#00c92b] text-slate-950 hover:brightness-105'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span>{day.dateStr}</span>
                      {day.isToday && (
                        <span className="bg-slate-950 text-emerald-300 text-[10px] px-1 py-0.2 rounded font-bold uppercase">
                          Today
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>

            {/* Header Row 2: Yellow Days of Week (SUNDAY, MONDAY, TUESDAY...) */}
            <tr>
              <th className="bg-slate-950 border border-slate-700/80 p-1 text-[11px] font-medium text-slate-400 text-center">
                Tech & Equipment Stock
              </th>
              {activeDays.map((day) => {
                const isFilteredDay = selectedDayFilter === day.dayName;
                return (
                  <th
                    key={`day-${day.dayName}`}
                    onClick={() => onFilterSync?.({ day: day.dayName })}
                    title={`Click to filter Monitoring Sheet to ${day.dayName}`}
                    className={`border border-slate-700/80 p-1.5 text-center text-xs font-black tracking-widest cursor-pointer select-none transition-all ${
                      isFilteredDay
                        ? 'bg-amber-300 text-slate-950 ring-2 ring-amber-500'
                        : day.isToday
                        ? 'bg-[#ffe600] text-slate-950 shadow-inner hover:brightness-105'
                        : 'bg-[#ffff00] text-slate-950 hover:brightness-105'
                    }`}
                  >
                    {day.dayName.toUpperCase()}
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Table Body: Grouped by Regions with Yellow Divider Rows matching photo */}
          <tbody className="divide-y divide-slate-800">
            {filteredTechs.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-16 text-center">
                  <div className="flex flex-col items-center justify-center max-w-md mx-auto">
                    <div className="w-12 h-12 rounded-2xl bg-cyan-900/30 border border-cyan-500/40 flex items-center justify-center text-cyan-400 mb-3">
                      <Users className="w-6 h-6" />
                    </div>
                    <p className="text-base font-bold text-white">
                      No technicians or scheduled jobs for {currentRegion || 'this region'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm">
                      Import an Airtable CSV to automatically sync technicians and jobs for this region, or click Add Technician.
                    </p>
                    <div className="flex items-center gap-2 mt-4">
                      {onOpenImportCSV && (
                        <button
                          type="button"
                          onClick={onOpenImportCSV}
                          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white shadow-sm cursor-pointer"
                        >
                          <UploadCloud className="w-4 h-4" />
                          <span>Import CSV to {currentRegion || 'Region'}</span>
                        </button>
                      )}
                      {onOpenAddTech && (
                        <button
                          type="button"
                          onClick={onOpenAddTech}
                          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
                        >
                          <UserPlus className="w-4 h-4" />
                          <span>Add Technician</span>
                        </button>
                      )}
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              allRegions.map((regionName) => {
              const regionTechs = filteredTechs.filter((t) => t.region === regionName);
              if (regionTechs.length === 0) return null;

              const regionBaseCameras = regionTechs.reduce((sum, t) => sum + t.cameras, 0);
              const regionBaseMachines = regionTechs.reduce((sum, t) => sum + t.machines, 0);

              return (
                <React.Fragment key={`group-${regionName}`}>
                  {/* Yellow Regional Divider Row matching attached photo */}
                  <tr className="bg-[#ffff00] text-slate-950 font-black text-xs border-y-2 border-slate-700 select-none">
                    <td
                      colSpan={8}
                      className="px-3 py-1 font-extrabold uppercase tracking-wide border border-slate-700"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-slate-950" />
                          <span className="text-sm font-black">{regionName}</span>
                          <span className="text-[10px] bg-black text-white px-2 py-0.5 rounded font-mono font-bold">
                            {regionTechs.length} Technicians
                          </span>
                        </div>
                        <div className="text-[11px] font-mono font-bold flex items-center gap-4 text-slate-950">
                          <span>Fleet: 📷 {regionBaseCameras} Cameras • ⚙️ {regionBaseMachines} Machines</span>
                        </div>
                      </div>
                    </td>
                  </tr>

                  {/* Technician Rows for this region */}
                  {regionTechs.map((tech) => {
                    const isTechSelected = selectedTechFilter === tech.name;

                    // Calculate tech inventory timeline and current stats
                    const timeline = calculateTechInventoryTimeline(tech, projects, specialAssignments, activeWeekId);
                    const overallStats = getTechOverallEquipmentStats(tech, projects, specialAssignments, CURRENT_DAY_NAME, activeWeekId);

                    const techProjects = projects.filter(
                      (p) => isProjectAssignedToTech(p.technician, tech.name)
                    );

                    return (
                      <tr
                        key={tech.id}
                        className={`transition-colors ${
                          isTechSelected ? 'bg-cyan-950/40 ring-1 ring-cyan-500/50' : 'hover:bg-slate-800/40'
                        }`}
                      >
                        {/* 1. Left Technician Column with Camera & Machine counts directly under name */}
                        <td
                          onClick={() => onFilterSync?.({ tech: tech.name })}
                          title={`Click to filter Monitoring Sheet to ${tech.name}`}
                          className={`p-1.5 sm:p-2 border border-slate-700/80 text-xs font-semibold select-none shadow-sm cursor-pointer ${
                            isTechSelected ? 'ring-2 ring-cyan-400 ring-inset' : ''
                          } ${getTechHeaderStyle(tech.colorGroup)}`}
                        >
                          <div className="flex flex-col gap-1">
                            {/* Name and Action Buttons */}
                            <div className="flex items-center justify-between">
                              <span className="font-bold tracking-tight text-white flex items-center gap-1.5 truncate">
                                {isTechSelected && <span className="w-2 h-2 rounded-full bg-cyan-300 shrink-0"></span>}
                                <span className="text-[12px] sm:text-[13px] truncate">{tech.name}</span>
                              </span>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onAssignProjectToDay(tech.name, CURRENT_DAY_NAME);
                                  }}
                                  title={`Assign job to ${tech.name}`}
                                  className="p-1 rounded bg-black/20 hover:bg-black/40 text-white transition-opacity cursor-pointer"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                                {onRemoveTechnician && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setTechToDelete(tech);
                                    }}
                                    title={`Remove ${tech.name}`}
                                    className="p-1 rounded bg-black/20 hover:bg-rose-900/80 text-slate-300 hover:text-rose-200 transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Team & Job Count */}
                            <div className="flex items-center justify-between text-[10px] text-slate-200/90 font-mono font-medium">
                              <span>{tech.team.split(' ')[1]}</span>
                              <span className="bg-black/30 px-1 rounded">{techProjects.length} jobs</span>
                            </div>

                            {/* NUMBER OF CAMERA AND MACHINE UNDER TECHNICIANS NAME */}
                            <div className="pt-1 border-t border-white/20 grid grid-cols-2 gap-1 text-[10px] font-mono">
                              {/* Camera stock */}
                              <div
                                title={`Base: ${tech.cameras} Cameras | Available: ${overallStats.currentAvailableCameras}${
                                  overallStats.activeCamerasInField > 0 ? ` | In Field: ${overallStats.activeCamerasInField}` : ''
                                }`}
                                className="bg-black/40 rounded px-1.5 py-0.5 flex flex-col"
                              >
                                <div className="flex items-center gap-1 text-cyan-300 font-bold">
                                  <Camera className="w-3 h-3 shrink-0" />
                                  <span>{tech.cameras} Cam</span>
                                </div>
                                <div className="text-[9px] text-slate-200 flex items-center justify-between">
                                  <span className={overallStats.currentAvailableCameras === tech.cameras ? 'text-emerald-300 font-bold' : 'text-amber-300 font-bold'}>
                                    {overallStats.currentAvailableCameras} avail
                                  </span>
                                  {overallStats.activeCamerasInField > 0 && (
                                    <span className="text-emerald-300 text-[8px]">(-{overallStats.activeCamerasInField})</span>
                                  )}
                                </div>
                              </div>

                              {/* Machine stock */}
                              <div
                                title={`Base: ${tech.machines} Machines | Available: ${overallStats.currentAvailableMachines}${
                                  overallStats.activeMachinesInField > 0 ? ` | In Field: ${overallStats.activeMachinesInField}` : ''
                                }`}
                                className="bg-black/40 rounded px-1.5 py-0.5 flex flex-col"
                              >
                                <div className="flex items-center gap-1 text-amber-300 font-bold">
                                  <Cog className="w-3 h-3 shrink-0" />
                                  <span>{tech.machines} Mach</span>
                                </div>
                                <div className="text-[9px] text-slate-200 flex items-center justify-between">
                                  <span className={overallStats.currentAvailableMachines === tech.machines ? 'text-emerald-300 font-bold' : 'text-amber-300 font-bold'}>
                                    {overallStats.currentAvailableMachines} avail
                                  </span>
                                  {overallStats.activeMachinesInField > 0 && (
                                    <span className="text-emerald-300 text-[8px]">(-{overallStats.activeMachinesInField})</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* 7 Days of the Week Cells */}
                        {activeDays.map((day) => {
                          const cellEvents = getEventsForCell(tech.name, day.dayName);
                          const dayDelta = timeline[day.dayName];

                          // Equipment movement flags for this day
                          const hasInstallsToday = dayDelta.installedCameras > 0 || dayDelta.installedMachines > 0;
                          const hasSwapsToday = (dayDelta.swappedCameras || 0) > 0 || (dayDelta.swappedMachines || 0) > 0;
                          const hasTeardownsToday = dayDelta.teardownCameras > 0 || dayDelta.teardownMachines > 0;

                          const allEventsInCell = cellEvents;
                          const isDayAllCOD = allowCOD && allEventsInCell.length > 0 && allEventsInCell.every((e) => (e.project.group || e.project.specialBadge) === 'COD');

                          return (
                            <td
                              key={`${tech.id}-${day.dayName}`}
                              onClick={(e) => {
                                if (e.target === e.currentTarget) {
                                  onFilterSync?.({ tech: tech.name, day: day.dayName });
                                }
                              }}
                              className={`p-1.5 border border-slate-700/60 align-top relative min-h-[72px] text-xs transition-colors cursor-pointer group/cell ${
                                selectedTechFilter === tech.name && selectedDayFilter === day.dayName
                                  ? 'bg-amber-950/40 ring-2 ring-amber-400/80 ring-inset'
                                  : day.isToday
                                  ? 'bg-cyan-950/20'
                                  : 'bg-slate-900/60'
                              } hover:bg-slate-800/60`}
                            >
                              {/* Option per day per tech: COD */}
                              <div className="flex items-center justify-between gap-1 mb-1 pb-1 border-b border-slate-800">
                                {allowCOD ? (
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onToggleDayGroup?.(tech.name, day.dayName, 'COD');
                                      }}
                                      title={`Assign/Toggle ${tech.name}'s ${day.dayName} projects to COD`}
                                      className={`px-1 py-0.5 rounded text-[9px] font-black transition-all cursor-pointer ${
                                        isDayAllCOD
                                          ? 'bg-[#ff00bf] text-white ring-1 ring-white shadow-xs'
                                          : 'text-slate-400 hover:text-[#ff00bf] hover:bg-[#ff00bf]/15'
                                      }`}
                                    >
                                      COD
                                    </button>
                                    {onOpenAssignCOD && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onOpenAssignCOD(tech.name, day.dayName);
                                        }}
                                        title={`Assign/pick projects from this week to COD on ${day.dayName}`}
                                        className="p-0.5 rounded text-[9px] text-slate-400 hover:text-[#ff00bf] hover:bg-[#ff00bf]/20 transition-all cursor-pointer"
                                      >
                                        <FolderPlus className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-[9px] font-mono text-slate-500 font-semibold">{day.dayName.slice(0, 3)}</span>
                                )}
                                {allEventsInCell.length > 0 && (
                                  <span className="text-[9px] font-mono text-slate-500">
                                    {allEventsInCell.length} {allEventsInCell.length === 1 ? 'job' : 'jobs'}
                                  </span>
                                )}
                              </div>

                              {/* Daily Equipment Delta Banner (Install and Swap remove, Teardown adds back) */}
                              {(hasInstallsToday || hasSwapsToday || hasTeardownsToday) && (
                                <div className="mb-1.5 flex flex-col gap-1 pb-1 border-b border-slate-800">
                                  {/* INSTALL: Removed from inventory (GREEN) */}
                                  {hasInstallsToday && (
                                    <div
                                      title="Install Day: Equipment removed from technician stock and deployed into the field"
                                      className="px-1.5 py-0.5 rounded text-[9px] font-mono font-black bg-emerald-950/90 text-emerald-300 border border-emerald-500/80 flex items-center justify-between shadow-sm"
                                    >
                                      <span className="flex items-center gap-0.5">
                                        <ArrowDownCircle className="w-2.5 h-2.5 text-emerald-400" />
                                        <span>INS</span>
                                      </span>
                                      <span>
                                        -{dayDelta.installedCameras > 0 ? `${dayDelta.installedCameras} Cam` : ''}
                                        {dayDelta.installedCameras > 0 && dayDelta.installedMachines > 0 ? ', ' : ''}
                                        {dayDelta.installedMachines > 0 ? `${dayDelta.installedMachines} Mach` : ''}
                                      </span>
                                    </div>
                                  )}

                                  {/* SWAP: Removed from inventory (SKY BLUE) */}
                                  {hasSwapsToday && (
                                    <div
                                      title="Swap Day: Equipment removed/swapped from technician stock"
                                      className="px-1.5 py-0.5 rounded text-[9px] font-mono font-black bg-sky-950/90 text-sky-300 border border-sky-500/80 flex items-center justify-between shadow-sm"
                                    >
                                      <span className="flex items-center gap-0.5">
                                        <RefreshCw className="w-2.5 h-2.5 text-sky-400" />
                                        <span>SWAP</span>
                                      </span>
                                      <span>
                                        -{dayDelta.swappedCameras > 0 ? `${dayDelta.swappedCameras} Cam` : ''}
                                        {dayDelta.swappedCameras > 0 && dayDelta.swappedMachines > 0 ? ', ' : ''}
                                        {dayDelta.swappedMachines > 0 ? `${dayDelta.swappedMachines} Mach` : ''}
                                      </span>
                                    </div>
                                  )}

                                  {/* TEARDOWN: Added back to inventory (VIOLET) */}
                                  {hasTeardownsToday && (
                                    <div
                                      title="Teardown Day: Equipment recovered from field and added back to technician stock"
                                      className="px-1.5 py-0.5 rounded text-[9px] font-mono font-black bg-violet-950/90 text-violet-300 border border-violet-500/80 flex items-center justify-between shadow-sm"
                                    >
                                      <span className="flex items-center gap-0.5">
                                        <ArrowUpCircle className="w-2.5 h-2.5 text-violet-400" />
                                        <span>TD</span>
                                      </span>
                                      <span>
                                        +{dayDelta.teardownCameras > 0 ? `${dayDelta.teardownCameras} Cam` : ''}
                                        {dayDelta.teardownCameras > 0 && dayDelta.teardownMachines > 0 ? ', ' : ''}
                                        {dayDelta.teardownMachines > 0 ? `${dayDelta.teardownMachines} Mach` : ''}
                                      </span>
                                    </div>
                                  )}

                                  {/* Day End Available Stock Summary */}
                                  <div className="text-[8px] font-mono text-slate-400 flex items-center justify-between px-0.5">
                                    <span>Avail:</span>
                                    <span className="font-bold text-slate-200">
                                      <strong className="text-cyan-300">{dayDelta.availableCameras}</strong>📷 /{' '}
                                      <strong className="text-amber-300">{dayDelta.availableMachines}</strong>⚙️
                                    </span>
                                  </div>
                                </div>
                              )}

                              {/* Project Cards Rendered with Strict Color Scheme: Green Install, Sky Blue Battery Swap, Violet Teardown */}
                              {(() => {
                                const renderCard = (proj: Project, eventType: MatrixEventType) => {
                                  const badge = getOpsStatusBadge(proj.opsStatus);
                                  const isHighlighted = highlightedProjectId === proj.id;
                                  const equipType = getProjectEquipmentType(proj);
                                  const isInstall = eventType === 'install';
                                  const isBatterySwap = eventType === 'battery_swap';
                                  const isTeardown = eventType === 'teardown';

                                  const cardTheme = isHighlighted
                                    ? 'bg-amber-400 text-slate-950 border-amber-300 font-bold ring-2 ring-amber-300 shadow-md scale-[1.02]'
                                    : isInstall
                                    ? 'bg-emerald-950/80 text-emerald-100 border-emerald-500/80 hover:bg-emerald-900/90 ring-1 ring-emerald-500/30'
                                    : isBatterySwap
                                    ? 'bg-sky-950/80 text-sky-100 border-sky-500/80 hover:bg-sky-900/90 ring-1 ring-sky-500/30'
                                    : isTeardown
                                    ? 'bg-violet-950/80 text-violet-100 border-violet-500/80 hover:bg-violet-900/90 ring-1 ring-violet-500/30'
                                    : 'bg-slate-800/90 text-slate-100 border-slate-700 hover:border-cyan-500 hover:bg-slate-750';

                                  return (
                                    <div
                                      key={`${proj.id}-${eventType}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onSelectProject(proj);
                                        onFilterSync?.({
                                          projectId: proj.id,
                                          tech: tech.name,
                                          day: day.dayName,
                                        });
                                      }}
                                      onMouseEnter={() => setHoveredProject(proj)}
                                      onMouseLeave={() => setHoveredProject(null)}
                                      className={`group/item cursor-pointer p-1.5 rounded-lg border text-xs font-mono transition-all shadow-sm ${cardTheme}`}
                                    >
                                      {/* Card Content */}
                                      {(() => {
                                        const techUnits = getTechUnitsForProject(proj, tech.name);
                                        const durLabel = proj.consecutiveCollectionDays ? `${proj.consecutiveCollectionDays}d` : '';
                                        const techLocs = (proj.techLocations && proj.techLocations[tech.name]) || proj.locationIds || (proj.locationId ? [proj.locationId] : []);
                                        const locLabel = techLocs.length > 0 ? (techLocs.length === 1 ? `Loc ${techLocs[0]}` : `${techLocs.length} Locs`) : (proj.locationsCount > 1 ? `${proj.locationsCount} Locs` : '');
                                        const { projectNumber, city } = getDisplayProjectHeader(proj);
                                        const assignedTechs = splitTechnicianNames(proj.technician);
                                        const coTechs = assignedTechs.filter(
                                          (t) => t.toLowerCase() !== tech.name.trim().toLowerCase()
                                        );

                                        return (
                                          <>
                                            {/* Row 1: Activity Badges (INSTALL, SWAP, TEARDOWN, COD) on TOP of the Project Number */}
                                            <div className="flex items-center justify-between gap-1 mb-1">
                                              <div className="flex items-center gap-1 shrink-0 flex-wrap">
                                                {/* Group Badge (COD / PRIORITY) */}
                                                {allowCOD && (proj.group === 'COD' || proj.specialBadge === 'COD') && (
                                                  <span
                                                    title="Group: COD"
                                                    className="px-1.5 py-0.2 rounded text-[8px] font-black uppercase bg-[#ff00bf] text-white tracking-wider shadow-sm"
                                                  >
                                                    COD
                                                  </span>
                                                )}
                                                {proj.group === 'PRIORITY' && (
                                                  <span
                                                    title="Group: Priority"
                                                    className="px-1.5 py-0.2 rounded text-[8px] font-black uppercase bg-purple-600 text-white tracking-wider shadow-sm"
                                                  >
                                                    PRIORITY
                                                  </span>
                                                )}

                                                {/* INSTALL Badge: GREEN */}
                                                {isInstall && (
                                                  <span
                                                    title={`Install Day (${day.dayName}) - Removes ${proj.equipmentCount} ${equipType} from inventory`}
                                                    className="px-1.5 py-0.2 rounded text-[8px] font-black uppercase bg-emerald-600 text-white tracking-wider shadow-sm"
                                                  >
                                                    INSTALL
                                                  </span>
                                                )}

                                                {/* BATTERY SWAP Badge: SKY BLUE */}
                                                {isBatterySwap && (() => {
                                                  const sIdx = proj.batterySwapDays ? proj.batterySwapDays.indexOf(day.dayName) : -1;
                                                  const totalSwaps = proj.batterySwapDays?.length || 1;
                                                  return (
                                                    <span
                                                      title={`Battery Swap Day (${day.dayName}) - Swap ${sIdx >= 0 ? sIdx + 1 : 1} of ${totalSwaps}`}
                                                      className="px-1.5 py-0.2 rounded text-[8px] font-black uppercase bg-sky-500 text-slate-950 tracking-wider shadow-sm font-bold flex items-center gap-1"
                                                    >
                                                      <span>SWAP</span>
                                                      {sIdx >= 0 && totalSwaps > 1 && (
                                                        <span className="text-[7px] opacity-90">{sIdx + 1}/{totalSwaps}</span>
                                                      )}
                                                    </span>
                                                  );
                                                })()}

                                                {/* TEARDOWN Badge: VIOLET */}
                                                {isTeardown && (
                                                  <span
                                                    title={`Teardown Day (${day.dayName}) - Returns ${proj.equipmentCount} ${equipType} back to inventory`}
                                                    className="teardown-badge px-1.5 py-0.2 rounded text-[8px] font-black uppercase bg-violet-950/90 text-white tracking-wider shadow-sm border border-white/40"
                                                  >
                                                    TEARDOWN
                                                  </span>
                                                )}
                                              </div>

                                              {/* Equipment Delta Units & Duration on the top-right */}
                                              <div className="flex items-center gap-1 shrink-0 text-[10px] font-bold font-mono">
                                                {isInstall && (
                                                  <span className="text-emerald-300 flex items-center gap-0.5">
                                                    <span>-{techUnits}</span>
                                                    <span>{equipType === 'Camera' ? 'Cam' : 'Mach'}</span>
                                                  </span>
                                                )}
                                                {isBatterySwap && (
                                                  <span className="text-sky-300 flex items-center gap-0.5">
                                                    <span>-{techUnits}</span>
                                                    <span>{equipType === 'Camera' ? 'Cam' : 'Mach'}</span>
                                                  </span>
                                                )}
                                                {isTeardown && (
                                                  <span className="teardown-equip-delta text-white font-black flex items-center gap-0.5">
                                                    <span>+{techUnits}</span>
                                                    <span>{equipType === 'Camera' ? 'Cam' : 'Mach'}</span>
                                                  </span>
                                                )}
                                                {durLabel && (
                                                  <span className="text-amber-300/90 font-semibold ml-0.5" title={`Duration: ${durLabel} consecutive collection days`}>
                                                    ⏱{durLabel}
                                                  </span>
                                                )}
                                              </div>
                                            </div>

                                            {/* Row 2: Project Number and City, State (Plenty of space to be seen) */}
                                            <div className="flex items-center gap-1.5 min-w-0">
                                              <span
                                                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                                  isHighlighted ? 'bg-slate-950' : (badge?.dot || 'bg-slate-400')
                                                }`}
                                              ></span>
                                              <div className="min-w-0 flex-1 flex items-baseline gap-1.5 flex-wrap">
                                                <span className="font-bold tracking-tight text-white text-[11px] truncate" title={proj.id}>
                                                  {projectNumber}
                                                </span>
                                                {city && (
                                                  <span className="text-slate-200 text-[10px] font-sans truncate font-medium" title={city}>
                                                    {city}
                                                  </span>
                                                )}
                                              </div>
                                            </div>

                                            {/* Row 3: Co-assigned with placed below the project number */}
                                            {coTechs.length > 0 && (
                                              <div className="mt-1 flex items-center">
                                                <span
                                                  title={`Co-assigned with ${coTechs.join(', ')}`}
                                                  className="px-1.5 py-0.5 rounded text-[8px] font-semibold bg-cyan-950/90 text-cyan-300 border border-cyan-500/50 tracking-tight flex items-center gap-1 max-w-full truncate shadow-xs"
                                                >
                                                  <span className="text-[9px]">👥</span>
                                                  <span className="truncate">Co-assigned with: {coTechs.join(', ')}</span>
                                                </span>
                                              </div>
                                            )}

                                            {/* Row 4: Replace location below with Option to add/edit notes */}
                                            <div className="mt-1 pt-1 border-t border-white/10 flex items-center justify-between gap-1">
                                              {proj.schedulerNotes ? (
                                                <div
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setNotesModalProject(proj);
                                                    setEditingNoteText(proj.schedulerNotes || '');
                                                  }}
                                                  title={`Note: ${proj.schedulerNotes} (Click to edit)`}
                                                  className="flex-1 min-w-0 flex items-center gap-1 text-[8.5px] px-1.5 py-0.5 rounded bg-amber-950/60 text-amber-200 border border-amber-500/40 hover:bg-amber-900/70 hover:border-amber-400 transition-colors cursor-pointer group/note"
                                                >
                                                  <FileText className="w-2.5 h-2.5 shrink-0 text-amber-400" />
                                                  <span className="truncate flex-1 font-sans font-normal">{proj.schedulerNotes}</span>
                                                  <Edit3 className="w-2 h-2 shrink-0 opacity-60 group-hover/note:opacity-100 text-amber-300" />
                                                </div>
                                              ) : (
                                                <button
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setNotesModalProject(proj);
                                                    setEditingNoteText('');
                                                  }}
                                                  className="flex items-center gap-1 text-[8px] text-slate-400 hover:text-cyan-300 hover:bg-slate-800/80 px-1.5 py-0.5 rounded border border-dashed border-slate-700/80 hover:border-cyan-500/60 transition-colors cursor-pointer"
                                                  title="Add note for this project"
                                                >
                                                  <FileText className="w-2.5 h-2.5" />
                                                  <span>+ Add Note</span>
                                                </button>
                                              )}
                                            </div>
                                          </>
                                        );
                                      })()}

                                      {/* Quick Battery Swap Controls on Install Card */}
                                      {isInstall && onApplyBatterySwaps && (
                                        <div
                                          className="mt-1 flex items-center justify-between text-[9px] pt-1 border-t border-emerald-500/20"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <div className="flex items-center gap-1 text-slate-300 font-medium">
                                            <BatteryCharging className="w-2.5 h-2.5 text-sky-400" />
                                            {((proj.batterySwapDays && proj.batterySwapDays.length > 0) || proj.consecutiveCollectionDays) ? (
                                              <span className="text-sky-300 font-bold text-[8px]">
                                                {proj.consecutiveCollectionDays || (proj.batterySwapDays ? proj.batterySwapDays.length * 2 + 1 : 3)}d ({proj.batterySwapDays?.length || 1}s):
                                              </span>
                                            ) : (
                                              <span className="text-slate-400 text-[8px]">+ Swaps:</span>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-1">
                                            <button
                                              type="button"
                                              title="Schedule 3-Day Collection (1 Swap: 1 day after install, teardown +4 days)"
                                              onClick={() => onApplyBatterySwaps(proj.id, 3)}
                                              className={`px-1 py-0.2 rounded text-[7px] font-bold border transition-colors ${
                                                proj.consecutiveCollectionDays === 3
                                                  ? 'bg-sky-500 text-slate-950 border-sky-400 font-black'
                                                  : 'bg-slate-900 text-sky-300 border-slate-700 hover:border-sky-400 hover:bg-slate-800'
                                              }`}
                                            >
                                              3d
                                            </button>
                                            <button
                                              type="button"
                                              title="Schedule 7-Day Collection (3 Swaps: 1 day after install, every other day until teardown)"
                                              onClick={() => onApplyBatterySwaps(proj.id, 7)}
                                              className={`px-1 py-0.2 rounded text-[7px] font-bold border transition-colors ${
                                                proj.consecutiveCollectionDays === 7
                                                  ? 'bg-sky-500 text-slate-950 border-sky-400 font-black'
                                                  : 'bg-slate-900 text-sky-300 border-slate-700 hover:border-sky-400 hover:bg-slate-800'
                                              }`}
                                            >
                                              7d
                                            </button>
                                            {((proj.batterySwapDays && proj.batterySwapDays.length > 0) || proj.consecutiveCollectionDays) && onClearBatterySwaps && (
                                              <button
                                                type="button"
                                                title="Clear battery swaps"
                                                onClick={() => onClearBatterySwaps(proj.id)}
                                                className="px-1 py-0.2 rounded text-[7px] text-rose-300 bg-rose-950/60 border border-rose-800/60 hover:bg-rose-900"
                                              >
                                                ✕
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                      )}

                                      {/* Multi-Week Rollover Indicators */}
                                      {isTeardown && isTeardownRollover(proj) && (
                                        <div className="mt-1 px-1.5 py-0.5 rounded bg-violet-950/90 border border-violet-500/60 text-[8px] text-violet-200 flex items-center justify-between font-mono font-bold">
                                          <span className="flex items-center gap-1">
                                            <RefreshCw className="w-2.5 h-2.5 text-violet-400" />
                                            <span>ROLLOVER TD</span>
                                          </span>
                                          <span className="text-[7px] text-violet-300">Installed {proj.installDay}</span>
                                        </div>
                                      )}
                                      {isInstall && isTeardownRollover(proj) && (
                                        <div className="mt-1 px-1.5 py-0.5 rounded bg-amber-950/70 border border-amber-500/50 text-[8px] text-amber-200 flex items-center justify-between font-mono">
                                          <span>TD rolls to {proj.teardownDay}</span>
                                          <span className="text-[7px] text-amber-300 font-bold">Upcoming Week</span>
                                        </div>
                                      )}

                                      {/* Option to assign projects to groups like COD */}
                                      {onUpdateProjectGroup && (
                                        <div
                                          className="mt-1 flex items-center justify-between text-[9px] pt-1 border-t border-white/10"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <span className="text-slate-400 font-sans">Group:</span>
                                          <select
                                            value={proj.group || (proj.specialBadge === 'COD' ? 'COD' : '')}
                                            onChange={(e) => {
                                              e.stopPropagation();
                                              onUpdateProjectGroup(proj.id, e.target.value || null);
                                            }}
                                            className="bg-slate-900 border border-slate-700 hover:border-cyan-400 rounded px-1.5 py-0.5 text-[9px] font-bold text-slate-200 focus:outline-none cursor-pointer"
                                            title="Assign project to a group (e.g. COD)"
                                          >
                                            <option value="" className="bg-slate-900 text-slate-300">Standard</option>
                                            {allowCOD && (
                                              <option value="COD" className="bg-slate-900 text-[#ff00bf] font-black">COD</option>
                                            )}
                                            <option value="PRIORITY" className="bg-slate-900 text-purple-300 font-bold">PRIORITY</option>
                                          </select>
                                        </div>
                                      )}
                                    </div>
                                  );
                                };

                                // Group all COD projects in this cell into a single consolidated block
                                const codEvents = allowCOD
                                  ? cellEvents.filter(
                                      ({ project: p }) => p.group === 'COD' || p.specialBadge === 'COD'
                                    )
                                  : [];
                                const nonCodEvents = allowCOD
                                  ? cellEvents.filter(
                                      ({ project: p }) => p.group !== 'COD' && p.specialBadge !== 'COD'
                                    )
                                  : cellEvents;

                                const currentListName = codEvents[0]?.project.codList || 'List-107';
                                const totalCodCameras = codEvents.reduce(
                                  (sum, { project: p }) => sum + (p.equipmentType === 'Camera' ? (p.equipmentCount || 0) : 0),
                                  0
                                );
                                const totalCodMachines = codEvents.reduce(
                                  (sum, { project: p }) => sum + (p.equipmentType === 'Machine' ? (p.equipmentCount || 0) : 0),
                                  0
                                );

                                return (
                                  <div className="space-y-1.5">
                                    {/* Consolidated COD Block to save interface space */}
                                    {allowCOD && codEvents.length > 0 && (
                                      <div
                                        className="p-1.5 rounded-lg border-2 border-[#ff00bf] bg-[#ff00bf]/15 text-white shadow-sm transition-all hover:bg-[#ff00bf]/20 flex flex-col gap-1.5"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {/* Header row: COD Badge + Editable List Input + Interactive Project Picker */}
                                        <div className="flex items-center justify-between gap-1">
                                          <div className="flex items-center gap-1 min-w-0">
                                            <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-[#ff00bf] text-white tracking-wider shadow-xs shrink-0">
                                              COD
                                            </span>
                                            {/* Editable Text Box adjacent to COD for List identification (e.g. List-107) */}
                                            <input
                                              type="text"
                                              value={currentListName}
                                              onChange={(e) => {
                                                e.stopPropagation();
                                                onUpdateCodListName?.(tech.name, day.dayName, e.target.value);
                                              }}
                                              title="Type to edit COD List identifier (e.g. List-107)"
                                              placeholder="List-107"
                                              className="w-16 sm:w-20 bg-slate-950/90 border border-[#ff00bf]/60 hover:border-[#ff00bf] rounded px-1 py-0.5 text-[9px] font-mono font-black text-pink-200 focus:outline-none focus:ring-1 focus:ring-[#ff00bf]"
                                            />
                                          </div>

                                          {/* Interactive Project Picker Button */}
                                          {onOpenAssignCOD && (
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                onOpenAssignCOD(tech.name, day.dayName, currentListName);
                                              }}
                                              title="Pick/assign projects from this week for COD"
                                              className="px-1.5 py-0.5 rounded bg-[#ff00bf] hover:bg-[#ff00bf]/80 text-white text-[8px] font-black transition-all flex items-center gap-0.5 shrink-0 shadow-xs cursor-pointer"
                                            >
                                              <Plus className="w-2.5 h-2.5" />
                                              <span>Pick</span>
                                            </button>
                                          )}
                                        </div>

                                        {/* Equipment & Job count summary */}
                                        <div className="flex items-center justify-between text-[9px] font-mono text-pink-200 font-bold px-0.5">
                                          <span>{codEvents.length} {codEvents.length === 1 ? 'project' : 'projects'}</span>
                                          <span>
                                            {totalCodCameras > 0 ? `-${totalCodCameras} Cam` : ''}
                                            {totalCodCameras > 0 && totalCodMachines > 0 ? ', ' : ''}
                                            {totalCodMachines > 0 ? `-${totalCodMachines} Mach` : ''}
                                            {totalCodCameras === 0 && totalCodMachines === 0 ? '0 eq' : ''}
                                          </span>
                                        </div>

                                        {/* Compact Project ID Chips */}
                                        <div className="flex flex-wrap gap-1 pt-0.5 border-t border-[#ff00bf]/30">
                                          {codEvents.map(({ project: p, eventType }) => {
                                            const isHighlighted = highlightedProjectId === p.id;
                                            return (
                                              <div
                                                key={`cod-chip-${p.id}-${eventType}`}
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  onSelectProject(p);
                                                  onFilterSync?.({
                                                    projectId: p.id,
                                                    tech: p.technician,
                                                    day: day.dayName,
                                                  });
                                                }}
                                                onMouseEnter={() => setHoveredProject(p)}
                                                onMouseLeave={() => setHoveredProject(null)}
                                                title={`Click to view ${p.id} (${p.cityState})`}
                                                className={`px-1.5 py-0.5 rounded border text-[9px] font-mono font-bold cursor-pointer transition-all flex items-center gap-1 ${
                                                  isHighlighted
                                                    ? 'bg-amber-400 text-slate-950 border-amber-300 ring-1 ring-amber-300'
                                                    : 'bg-slate-900/90 text-white border-pink-500/50 hover:border-[#ff00bf] hover:bg-slate-850'
                                                }`}
                                              >
                                                <span>{p.id}</span>
                                                {eventType === 'teardown' && (
                                                  <span
                                                    title={isTeardownRollover(p) ? 'Rollover Teardown from previous week' : 'Teardown Event'}
                                                    className={`text-[7px] px-1 rounded font-black ${
                                                      isTeardownRollover(p)
                                                        ? 'bg-violet-900 text-violet-200 border border-violet-500/50'
                                                        : 'bg-violet-700 text-white'
                                                    }`}
                                                  >
                                                    {isTeardownRollover(p) ? 'TD 🔄' : 'TD'}
                                                  </span>
                                                )}
                                                {p.equipmentCount > 0 && (
                                                  <span className="text-[8px] text-pink-300 font-mono">
                                                    ({p.equipmentCount})
                                                  </span>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}

                                    {/* Non-COD Project Cards */}
                                    {nonCodEvents.map(({ project: proj, eventType }) =>
                                      renderCard(proj, eventType)
                                    )}
                                  </div>
                                );
                              })()}

                              {/* Quick Add button on hover */}
                              <button
                                onClick={() => onAssignProjectToDay(tech.name, day.dayName)}
                                className="opacity-0 hover:opacity-100 focus:opacity-100 w-full mt-1.5 py-0.5 rounded text-[10px] text-slate-400 hover:text-cyan-300 hover:bg-slate-800/80 transition-opacity flex items-center justify-center gap-1 border border-transparent hover:border-slate-700"
                              >
                                <Plus className="w-2.5 h-2.5" />
                                <span>Assign</span>
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </React.Fragment>
              );
            })
          )}
          </tbody>
        </table>
      </div>

      {/* Floating Quick Preview Card when hovering over a chip */}
      {hoveredProject && (
        <div className="fixed bottom-4 right-4 z-40 bg-slate-900/95 border border-cyan-500/40 rounded-xl p-4 shadow-2xl backdrop-blur max-w-sm text-xs text-slate-200 pointer-events-none animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center justify-between gap-3 mb-1.5">
            <span className="font-mono font-bold text-sm text-cyan-300">{hoveredProject.id}</span>
            {(() => {
              const badge = getOpsStatusBadge(hoveredProject.opsStatus);
              return (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${badge.bg} ${badge.text}`}
                >
                  {hoveredProject.opsStatus}
                </span>
              );
            })()}
          </div>

          <p className="flex items-center gap-1.5 text-slate-300 font-medium">
            <MapPin className="w-3 h-3 text-red-400" />
            <span>{hoveredProject.cityState}</span>
          </p>

          <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-800 text-[11px]">
            <div>
              <span className="text-slate-400">Study Type:</span> {hoveredProject.studyType}
            </div>
            <div>
              <span className="text-slate-400">Assigned Tech:</span> {hoveredProject.technician}
            </div>
            <div className="bg-cyan-950/40 p-1.5 rounded border border-cyan-800/50">
              <span className="text-cyan-400 font-bold block">Equipment Required:</span>
              <span className="font-mono text-cyan-200 font-bold text-xs">
                {hoveredProject.equipmentCount} {getProjectEquipmentType(hoveredProject)}s
              </span>
              <span className="text-[10px] text-slate-400 block">({hoveredProject.locationsCount} locations)</span>
            </div>
            <div className="bg-slate-950 p-1.5 rounded border border-slate-800 space-y-0.5">
              <span className="text-slate-400 font-bold block">Inventory Flow:</span>
              <span className="text-emerald-400 block font-semibold">
                INS (Green): -{hoveredProject.equipmentCount} {hoveredProject.installDay || 'N/A'}
              </span>
              <span className="text-violet-300 block font-semibold">
                TD (Violet): +{hoveredProject.equipmentCount} {hoveredProject.teardownDay || 'N/A'}
              </span>
            </div>
          </div>

          {isTeardownRollover(hoveredProject) && (
            <div className="mt-2 bg-violet-950/60 p-2 rounded-lg border border-violet-700/60 space-y-0.5 text-violet-200">
              <span className="text-violet-300 font-bold flex items-center gap-1 text-[11px]">
                <RefreshCw className="w-3 h-3 text-violet-400" />
                <span>Multi-Week Teardown Rollover Active</span>
              </span>
              <span className="text-[10px] text-violet-200 block">
                Installed {hoveredProject.installDay} • Teardown on {hoveredProject.teardownDay} rolls over into upcoming Work Week.
              </span>
            </div>
          )}
        </div>
      )}

      {/* Footer Legend & Instructions */}
      <div className="p-3 bg-slate-950 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between text-xs text-slate-400 gap-2">
        <div className="flex items-center gap-2">
          <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span>Click any card to inspect monitoring specs, reassign technicians, or update install & teardown days.</span>
        </div>
        <div className="flex items-center gap-4 text-[11px] flex-wrap font-medium">
          <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
            <span className="w-2.5 h-2.5 rounded bg-emerald-500"></span>
            <span>Install: Green</span>
          </span>
          <span className="flex items-center gap-1.5 text-sky-400 font-bold">
            <span className="w-2.5 h-2.5 rounded bg-sky-500"></span>
            <span>Battery Swap: Sky Blue</span>
          </span>
          <span className="flex items-center gap-1.5 text-violet-300 font-bold">
            <span className="w-2.5 h-2.5 rounded bg-violet-600"></span>
            <span>Teardown: Violet</span>
          </span>
          <span className="flex items-center gap-1.5 text-purple-300 font-bold">
            <span className="w-2.5 h-2.5 rounded bg-purple-700"></span>
            <span>Crew Task (Multiple Techs)</span>
          </span>
          {allowCOD && (
            <span className="flex items-center gap-1 text-white">
              <span className="w-2 h-2 rounded bg-[#ff00bf]"></span> COD
            </span>
          )}
        </div>
      </div>

      {/* Delete Technician In-App Modal */}
      {techToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-rose-500/50 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Remove Technician</h3>
                <p className="text-xs text-slate-400">{techToDelete.name} • {techToDelete.region}</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to remove <strong>{techToDelete.name}</strong> from the scheduler roster?
              Any currently assigned jobs will automatically be returned to <span className="text-amber-300 font-semibold">Unassigned</span>.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setTechToDelete(null)}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onRemoveTechnician?.(techToDelete.id);
                  setTechToDelete(null);
                }}
                className="px-4 py-1.5 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-500 text-white shadow-lg transition-colors"
              >
                Yes, Remove Technician
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Quick Notes Modal */}
      {notesModalProject && (
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          onClick={() => setNotesModalProject(null)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
                    <span>Notes: {notesModalProject.id}</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    {notesModalProject.cityState} • Tech: {notesModalProject.technician}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setNotesModalProject(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>Project & Field Notes</span>
                  <span className="text-[10px] text-slate-500 font-normal">Press Ctrl+Enter to save</span>
                </label>
                <textarea
                  autoFocus
                  rows={4}
                  value={editingNoteText}
                  onChange={(e) => setEditingNoteText(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                      e.preventDefault();
                      handleSaveNote();
                    }
                  }}
                  placeholder="Add notes for this project (e.g. Collecting 9/3; Teardown 24 hrs; Gate code #1234; Client contact...)"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent font-sans resize-none"
                />
              </div>

              {/* Quick Suggestion Chips */}
              <div className="flex flex-wrap gap-1.5">
                <span className="text-[10px] text-slate-400 flex items-center">Quick Add:</span>
                {['Collecting this week', 'Teardown 24 hrs', 'Gate code needed', 'Contact client on arrival', 'Recollection'].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => {
                      setEditingNoteText((prev) => (prev ? `${prev}; ${chip}` : chip));
                    }}
                    className="px-2 py-0.5 rounded text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 hover:border-slate-600 transition-colors cursor-pointer"
                  >
                    +{chip}
                  </button>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between p-3.5 border-t border-slate-800 bg-slate-950/40">
              <div>
                {notesModalProject.schedulerNotes && (
                  <button
                    type="button"
                    onClick={() => setEditingNoteText('')}
                    className="text-xs text-rose-400 hover:text-rose-300 hover:underline px-1 py-0.5"
                  >
                    Clear Note
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setNotesModalProject(null)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveNote}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Note</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
