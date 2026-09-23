import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Project, WeekDay, DateColumn, Technician } from '../types';
import {
  Clock,
  Layers,
  MapPin,
  Check,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Download,
  Edit2,
  X,
  Camera,
  Cog,
  Plus,
  ArrowDownCircle,
  ArrowUpCircle,
  RefreshCw,
  Users,
  FileText,
  Edit3,
} from 'lucide-react';
import {
  parseDurationToSeconds,
  formatSecondsToDuration,
  INITIAL_DISPATCH_HOURS,
  estimateHoursFromProjects,
  calculateTechWeeklyHours,
  WEEK_DAYS_ORDER,
} from '../utils/hoursEngine';
import { exportProjectsToCSV, WEEK_DAYS } from '../utils/statusEngine';
import { getTechOverallEquipmentStats } from '../utils/equipmentEngine';
import { shouldShowProjectEventOnDay, isTeardownRollover } from '../utils/workWeekEngine';
import {
  getIndividualTechList,
  isProjectAssignedToTech,
  splitTechnicianNames,
  formatLocationList,
} from '../utils/technicianUtils';

interface DispatchTimesheetMatrixProps {
  projects: Project[];
  technicians: Technician[];
  dateColumns?: DateColumn[];
  currentWeekLabel?: string;
  activeWeekId?: string;
  allowCOD?: boolean;
  onOpenResetSchedule?: () => void;
  onSelectProject: (project: Project) => void;
  onQuickAddJob?: (techName: string, dayName: WeekDay, eventType: 'install' | 'teardown' | 'battery_swap') => void;
  onUpdateProjectGroup?: (projectId: string, group: string | null) => void;
  onAssignCODForTech?: (technicianName: string) => void;
  onToggleDayGroup?: (techName: string, dayName: WeekDay, group: 'COD') => void;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  onUpdateProjectNotes?: (projectId: string, notes: string) => void;
}

const REGION_ORDER = [
  'TX (Dallas)',
  'TX (Houston)',
  'LA',
  'CO',
  'Texas',
  'Field Fleet',
];

interface DayJobs {
  installs: Project[];
  batterySwaps: Project[];
  teardowns: Project[];
}

const EMPTY_DAY_JOBS: DayJobs = {
  installs: [],
  batterySwaps: [],
  teardowns: [],
};

// Modular, clean job card component for Installs, Battery Swaps, and Teardowns
interface DispatchJobCardProps {
  project: Project;
  eventType: 'install' | 'battery_swap' | 'teardown';
  technicianName: string;
  allowCOD?: boolean;
  isSearchMatch: boolean;
  onSelect: (p: Project) => void;
  onOpenNotes: (e: React.MouseEvent, p: Project) => void;
}

const DispatchJobCard: React.FC<DispatchJobCardProps> = React.memo(({
  project,
  eventType,
  technicianName,
  allowCOD,
  isSearchMatch,
  onSelect,
  onOpenNotes,
}) => {
  const pGroup = project.group || project.specialBadge;
  const assignedTechs = splitTechnicianNames(project.technician);
  const coTechs = assignedTechs.filter(
    (t) => t.toLowerCase() !== technicianName.trim().toLowerCase()
  );

  const locListStr = formatLocationList(project, technicianName);
  const isTeardown = eventType === 'teardown';
  const isSwap = eventType === 'battery_swap';
  const isInstall = eventType === 'install';

  // Base card styles by event type
  let baseCardStyle = 'border-emerald-500/80 bg-emerald-50 dark:bg-emerald-950/90 text-emerald-950 dark:text-emerald-100 hover:bg-emerald-100 dark:hover:bg-emerald-900';
  if (isSwap) {
    baseCardStyle = 'border-sky-500/80 bg-sky-50 dark:bg-sky-950/90 text-sky-950 dark:text-sky-100 hover:bg-sky-100 dark:hover:bg-sky-900';
  } else if (isTeardown) {
    baseCardStyle = 'border-violet-400 dark:border-violet-500/80 bg-violet-100/70 dark:bg-violet-950/90 text-violet-950 dark:text-violet-100 hover:bg-violet-200/80 dark:hover:bg-violet-900';
  }

  return (
    <div
      onClick={() => onSelect(project)}
      className={`p-1.5 rounded text-[11px] border shadow-sm transition-all cursor-pointer group/card relative flex flex-col gap-0.5 ${
        isSearchMatch
          ? 'ring-4 ring-yellow-400 border-2 border-yellow-300 bg-yellow-400 dark:bg-yellow-500 text-slate-950 font-bold shadow-xl shadow-yellow-500/50 scale-[1.02] z-10 dispatch-search-highlight'
          : baseCardStyle
      }`}
    >
      {/* Row 1: Badges ON TOP (COD, PRIORITY, EVENT TYPE) + Top-right Teardown count */}
      <div className="flex items-center justify-between gap-1 mb-0.5">
        <div className="flex items-center gap-1 shrink-0 flex-wrap">
          {allowCOD && pGroup === 'COD' && (
            <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-[#ff00bf] text-white tracking-wider shadow-sm">
              COD
            </span>
          )}
          {pGroup === 'PRIORITY' && (
            <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-purple-600 text-white tracking-wider shadow-sm">
              PRIORITY
            </span>
          )}
          {isInstall && (
            <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-emerald-600 text-white tracking-wider font-bold shadow-sm">
              INSTALL
            </span>
          )}
          {isSwap && (
            <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-sky-500 text-slate-950 tracking-wider font-bold shadow-sm">
              SWAP
            </span>
          )}
          {isTeardown && (
            isTeardownRollover(project) ? (
              <span
                title={`Rollover Teardown from previous week install on ${project.installDay}`}
                className="teardown-badge px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-violet-800 dark:bg-violet-950 text-white tracking-wider border border-violet-900/40 shadow-sm"
              >
                ROLLOVER TD 🔄
              </span>
            ) : (
              <span className="teardown-badge px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-violet-800 dark:bg-violet-950/90 text-white tracking-wider font-black shadow-sm border border-violet-900/40">
                TEARDOWN
              </span>
            )
          )}
        </div>

        {/* Teardown returns equipment: count displayed top-right in high-contrast text */}
        {isTeardown && (
          <span className="teardown-equip-delta font-mono text-[10px] text-violet-950 dark:text-white font-black shrink-0 ml-auto tracking-wide">
            {project.equipmentCount > 0 ? `+${project.equipmentCount} ${project.equipmentType === 'Machine' ? 'MACH' : 'CAMS'}` : ''}
          </span>
        )}
      </div>

      {/* Row 2: Project Number */}
      <div className={`flex items-center gap-1 font-mono font-bold min-w-0 ${
        isTeardown ? 'text-violet-950 dark:text-white font-black' : 'text-slate-900 dark:text-white'
      }`}>
        {isInstall && <ArrowDownCircle className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400 shrink-0" />}
        {isSwap && <RefreshCw className="w-2.5 h-2.5 text-sky-600 dark:text-sky-400 shrink-0" />}
        {isTeardown && <ArrowUpCircle className="w-2.5 h-2.5 text-violet-800 dark:text-violet-400 shrink-0" />}
        <span className="truncate text-[11px]" title={`${project.id}${project.cityState ? ` • ${project.cityState}` : ''}`}>
          {project.projectNumber || project.id}
        </span>
      </div>

      {/* Row 2.5: Grouped Locations Display Format (e.g. "• Loc: 001, 002, 003") */}
      {locListStr && (
        <div className={`text-[9px] font-mono font-semibold tracking-tight ${
          isSearchMatch
            ? 'text-slate-950 font-bold'
            : isInstall
            ? 'text-emerald-800 dark:text-emerald-300'
            : isSwap
            ? 'text-sky-800 dark:text-sky-300'
            : 'text-violet-900 dark:text-violet-200'
        }`}>
          • Loc: {locListStr}
        </div>
      )}

      {/* Row 3: Co-assigned technicians if any */}
      {coTechs.length > 0 && (
        <div className="flex items-center mt-0.5">
          <span
            title={`Co-assigned with ${coTechs.join(', ')}`}
            className="px-1 py-0.5 rounded text-[8px] font-semibold bg-cyan-900/40 text-cyan-800 dark:text-cyan-200 border border-cyan-500/30 truncate"
          >
            👥 Co: {coTechs.join(', ')}
          </span>
        </div>
      )}

      {/* Row 4: Notes Button (Left) + Equipment count deduction (Right for installs & swaps) */}
      <div className="flex items-center justify-between text-[10px] gap-1 mt-0.5">
        {project.schedulerNotes ? (
          <button
            type="button"
            onClick={(e) => onOpenNotes(e, project)}
            title={`Note: ${project.schedulerNotes} (Click to edit)`}
            className="flex-1 min-w-0 max-w-[130px] flex items-center gap-1 text-[8.5px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-900 dark:text-amber-200 border border-amber-500/40 hover:bg-amber-500/30 transition-colors cursor-pointer text-left group/note"
          >
            <FileText className="w-2.5 h-2.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <span className="truncate flex-1 font-sans">{project.schedulerNotes}</span>
            <Edit3 className="w-2 h-2 shrink-0 opacity-60 group-hover/note:opacity-100 text-amber-600 dark:text-amber-300" />
          </button>
        ) : (
          <button
            type="button"
            onClick={(e) => onOpenNotes(e, project)}
            title="Add note for this project"
            className="flex items-center gap-1 text-[8.5px] text-slate-500 dark:text-slate-400 hover:text-cyan-700 dark:hover:text-cyan-300 px-1.5 py-0.5 rounded border border-dashed border-slate-300 dark:border-slate-700 hover:border-cyan-500 transition-colors cursor-pointer"
          >
            <FileText className="w-2.5 h-2.5 shrink-0" />
            <span>+ Add Note</span>
          </button>
        )}

        {!isTeardown && project.equipmentCount > 0 && (
          <span className={`font-mono text-[10px] font-bold shrink-0 ml-auto ${
            isInstall ? 'text-emerald-700 dark:text-emerald-300' : 'text-sky-700 dark:text-sky-300'
          }`}>
            -{project.equipmentCount} {project.equipmentType === 'Machine' ? 'MACH' : 'CAMS'}
          </span>
        )}
      </div>
    </div>
  );
});

DispatchJobCard.displayName = 'DispatchJobCard';

export const DispatchTimesheetMatrix: React.FC<DispatchTimesheetMatrixProps> = ({
  projects,
  technicians,
  dateColumns,
  currentWeekLabel = 'Week 37 (Sep 6 - Sep 12)',
  activeWeekId = '2026-W37',
  allowCOD = true,
  onOpenResetSchedule,
  onSelectProject,
  onQuickAddJob,
  onAssignCODForTech,
  onToggleDayGroup,
  searchTerm = '',
  onSearchChange,
  onUpdateProjectNotes,
}) => {
  // Notes Modal state for editing project notes directly from the card
  const [notesModalProject, setNotesModalProject] = useState<Project | null>(null);
  const [editingNoteText, setEditingNoteText] = useState<string>('');

  const handleOpenNotes = useCallback((e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    setNotesModalProject(project);
    setEditingNoteText(project.schedulerNotes || '');
  }, []);

  const handleSaveNote = () => {
    if (!notesModalProject) return;
    const trimmed = editingNoteText.trim();
    if (onUpdateProjectNotes) {
      onUpdateProjectNotes(notesModalProject.id, trimmed);
    }
    notesModalProject.schedulerNotes = trimmed;
    setNotesModalProject(null);
  };

  // Region filter: defaults to 'all' or specific region
  const [selectedRegion, setSelectedRegion] = useState<string>('all');

  // Internal search if onSearchChange not provided
  const [internalSearch, setInternalSearch] = useState<string>('');
  const activeSearch = searchTerm || internalSearch;

  // Group filter: 'all' | 'COD' | 'PRIORITY'
  const [groupFilter, setGroupFilter] = useState<string>('all');

  // Sync technicians directly from Monitoring Sheet projects so no technicians or projects are missed
  const techList = useMemo(() => {
    return getIndividualTechList(projects, technicians);
  }, [technicians, projects]);

  // Daily hours state (persisted to localStorage with fallback to exact dispatch values)
  const [dailyHours, setDailyHours] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('nds_dispatch_timesheet_hours');
      if (saved) {
        return { ...INITIAL_DISPATCH_HOURS, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.error('Error loading timesheet hours:', e);
    }
    return INITIAL_DISPATCH_HOURS;
  });

  // Hours display mode: 'daily' vs 'cumulative'
  const [hoursMode, setHoursMode] = useState<'daily' | 'cumulative'>('daily');

  // Inline editing state for an hours cell
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');

  // Save hours to localStorage whenever updated
  const updateDailyHours = (key: string, value: string) => {
    setDailyHours((prev) => {
      const updated = { ...prev, [key]: value };
      try {
        localStorage.setItem('nds_dispatch_timesheet_hours', JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save timesheet hours:', e);
      }
      return updated;
    });
  };

  // Reset hours back to original dispatch sheet
  const handleResetToDefaults = () => {
    if (window.confirm('Reset all technicians timesheet hours to initial dispatch default?')) {
      setDailyHours(INITIAL_DISPATCH_HOURS);
      localStorage.removeItem('nds_dispatch_timesheet_hours');
    }
  };

  // 7 Days list from active sheet date columns or standard Sunday through Saturday
  const daysList: { dayName: WeekDay; dateStr: string; isToday?: boolean }[] = useMemo(() => {
    if (dateColumns && dateColumns.length === 7) {
      return dateColumns.map((col) => ({
        dayName: col.dayName,
        dateStr: col.dateStr,
        isToday: col.isToday,
      }));
    }

    return WEEK_DAYS.map((col) => ({
      dayName: col.dayName,
      dateStr: col.dateStr,
      isToday: col.isToday,
    }));
  }, [dateColumns]);

  // High-performance indexed map for all jobs by tech and day: O(1) lookup
  const jobsByTechAndDay = useMemo(() => {
    const map = new Map<string, DayJobs>();

    const activeProjects = groupFilter === 'all'
      ? projects
      : projects.filter((p) => {
          const pGroup = (p.group || p.specialBadge || '').toLowerCase();
          return pGroup === groupFilter.toLowerCase();
        });

    for (const p of activeProjects) {
      if (!p.technician) continue;
      const assignedTechs = splitTechnicianNames(p.technician);
      for (const techName of assignedTechs) {
        const normTech = techName.trim().toLowerCase();

        for (const dayName of WEEK_DAYS_ORDER) {
          const isInstall = shouldShowProjectEventOnDay(p, 'install', dayName, activeWeekId);
          const isSwap = shouldShowProjectEventOnDay(p, 'battery_swap', dayName, activeWeekId);
          const isTeardown = shouldShowProjectEventOnDay(p, 'teardown', dayName, activeWeekId);

          if (isInstall || isSwap || isTeardown) {
            const key = `${normTech}__${dayName}`;
            let entry = map.get(key);
            if (!entry) {
              entry = { installs: [], batterySwaps: [], teardowns: [] };
              map.set(key, entry);
            }
            if (isInstall) entry.installs.push(p);
            if (isSwap) entry.batterySwaps.push(p);
            if (isTeardown) entry.teardowns.push(p);
          }
        }
      }
    }

    return map;
  }, [projects, groupFilter, activeWeekId]);

  // Fast O(1) getter for tech jobs on a specific day
  const getTechDayJobs = useCallback((techName: string, dayName: WeekDay): DayJobs => {
    const key = `${techName.trim().toLowerCase()}__${dayName}`;
    return jobsByTechAndDay.get(key) || EMPTY_DAY_JOBS;
  }, [jobsByTechAndDay]);

  // Check if technician has any projects on day
  const techHasProjectsOnDay = useCallback((techName: string, dayName: WeekDay): boolean => {
    const jobs = getTechDayJobs(techName, dayName);
    return (jobs.installs.length + jobs.batterySwaps.length + jobs.teardowns.length) > 0;
  }, [getTechDayJobs]);

  // Auto-estimate hours from scheduled projects
  const handleAutoEstimate = () => {
    const estimated: Record<string, string> = {};
    techList.forEach((tech) => {
      const techName = tech.name;
      WEEK_DAYS_ORDER.forEach((dayName) => {
        const dayJobs = getTechDayJobs(techName, dayName);
        const estStr = estimateHoursFromProjects(dayJobs.installs, dayJobs.teardowns);
        if (estStr !== '0:00:00') {
          estimated[`${techName}_${dayName}`] = estStr;
        }
      });
    });

    setDailyHours((prev) => {
      const updated: Record<string, string> = { ...(prev || {}), ...estimated };
      try {
        localStorage.setItem('nds_dispatch_timesheet_hours', JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save estimated hours:', e);
      }
      return updated;
    });
  };

  // Available unique regions
  const availableRegions = useMemo(() => {
    return Array.from(new Set(techList.map((t) => t.region || 'TX (Dallas)')));
  }, [techList]);

  // Fast precompiled search matcher
  const isProjectSearchMatch = useMemo(() => {
    const q = activeSearch.trim().toLowerCase();
    if (!q) return () => false;
    return (p: Project) => {
      return Boolean(
        p.id.toLowerCase().includes(q) ||
        (p.projectNumber && p.projectNumber.toLowerCase().includes(q)) ||
        (p.cityState && p.cityState.toLowerCase().includes(q)) ||
        (p.technician && p.technician.toLowerCase().includes(q)) ||
        (p.locationId && p.locationId.toLowerCase().includes(q)) ||
        (p.locationIds && p.locationIds.some((loc) => loc.toLowerCase().includes(q))) ||
        (p.studyType && p.studyType.toLowerCase().includes(q))
      );
    };
  }, [activeSearch]);

  // Filter technicians by region and search term
  const filteredTechs = useMemo(() => {
    let list = techList;
    if (selectedRegion !== 'all') {
      list = list.filter((t) => t.region === selectedRegion);
    }
    if (activeSearch.trim()) {
      const q = activeSearch.toLowerCase();
      list = list.filter((t) => {
        const matchesTech =
          t.name.toLowerCase().includes(q) ||
          t.team.toLowerCase().includes(q) ||
          t.region?.toLowerCase().includes(q);
        const hasMatchingJob = projects.some(
          (p) => isProjectAssignedToTech(p.technician, t.name) && isProjectSearchMatch(p)
        );
        return matchesTech || hasMatchingJob;
      });
    }
    return list;
  }, [techList, selectedRegion, activeSearch, projects, isProjectSearchMatch]);

  // Focus View: Auto-scroll to matching project or tech on active search
  useEffect(() => {
    if (activeSearch && activeSearch.trim().length >= 2) {
      const timer = setTimeout(() => {
        const matchEl = document.querySelector('.dispatch-search-highlight');
        if (matchEl) {
          matchEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        }
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [activeSearch]);

  const allRegions = useMemo(() => {
    const presentRegions = Array.from(new Set(filteredTechs.map((t) => t.region || 'TX (Dallas)')));
    const ordered = REGION_ORDER.filter((r) => presentRegions.includes(r as any));
    const others = presentRegions.filter((r) => !REGION_ORDER.includes(r as any));
    return [...ordered, ...others];
  }, [filteredTechs]);

  // Get effective hours for a technician (zero on days without projects)
  const getEffectiveHoursForTech = useCallback((techName: string) => {
    const effective: Record<string, string> = {};
    WEEK_DAYS_ORDER.forEach((day) => {
      const key = `${techName}_${day}`;
      if (techHasProjectsOnDay(techName, day)) {
        effective[key] = dailyHours[key] || '0:00:00';
      } else {
        effective[key] = '0:00:00';
      }
    });
    return effective;
  }, [dailyHours, techHasProjectsOnDay]);

  // Deduplicated jobs count and team stats
  const teamStats = useMemo(() => {
    let totalSec = 0;
    let overtimeCount = 0;

    filteredTechs.forEach((t) => {
      const calc = calculateTechWeeklyHours(getEffectiveHoursForTech(t.name), t.name);
      totalSec += calc.weeklyTotalSeconds;
      if (calc.isOvertime) overtimeCount++;
    });

    const uniqueProjectIds = new Set<string>();
    projects.forEach((p) => {
      const isAssignedToFiltered = filteredTechs.some((t) => {
        return isProjectAssignedToTech(p.technician, t.name);
      });
      if (isAssignedToFiltered) {
        if (groupFilter === 'all') {
          uniqueProjectIds.add(p.id);
        } else {
          const pGroup = (p.group || p.specialBadge || '').toLowerCase();
          if (pGroup === groupFilter.toLowerCase()) {
            uniqueProjectIds.add(p.id);
          }
        }
      }
    });

    const totalUniqueJobs = uniqueProjectIds.size;
    const avgSec = filteredTechs.length > 0 ? Math.round(totalSec / filteredTechs.length) : 0;

    return {
      totalHoursStr: formatSecondsToDuration(totalSec),
      avgHoursStr: formatSecondsToDuration(avgSec),
      overtimeCount,
      totalTechs: filteredTechs.length,
      totalJobs: totalUniqueJobs,
    };
  }, [filteredTechs, projects, groupFilter, getEffectiveHoursForTech]);

  // Daily Fleet Totals for the footer row
  const dailyFleetTotals = useMemo(() => {
    const totals: Record<WeekDay, number> = {
      Sunday: 0,
      Monday: 0,
      Tuesday: 0,
      Wednesday: 0,
      Thursday: 0,
      Friday: 0,
      Saturday: 0,
    };

    filteredTechs.forEach((t) => {
      WEEK_DAYS_ORDER.forEach((day) => {
        const key = `${t.name}_${day}`;
        if (techHasProjectsOnDay(t.name, day)) {
          totals[day] += parseDurationToSeconds(dailyHours[key]);
        }
      });
    });

    const totalFleetSec = Object.values(totals).reduce((sum, val) => sum + val, 0);

    return {
      byDay: totals,
      grandTotalStr: formatSecondsToDuration(totalFleetSec),
    };
  }, [filteredTechs, dailyHours, techHasProjectsOnDay]);

  // CSV Export handler
  const handleExportTimesheet = () => {
    const csvContent = exportProjectsToCSV(projects);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `nds_dispatch_timesheet_matrix_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Helper to get technician header styling matching SchedulerMatrix
  const getTechHeaderStyle = (colorGroup: string) => {
    switch (colorGroup) {
      case 'orange':
        return 'bg-gradient-to-r from-amber-600/90 to-orange-600/90 text-white font-bold border-amber-700/80';
      case 'navy':
      case 'blue':
        return 'bg-gradient-to-r from-slate-900 to-blue-950 text-sky-200 font-bold border-blue-900';
      case 'burgundy':
        return 'bg-gradient-to-r from-rose-950 to-red-950 text-rose-200 font-bold border-rose-900';
      default:
        return 'bg-gradient-to-r from-emerald-950 to-green-900 text-emerald-200 font-bold border-emerald-900';
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Controls Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-4 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Left: Title & Filter controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black shadow-sm">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white tracking-wide flex items-center gap-2">
                <span>Dispatch & Timesheet Matrix</span>
                <span className="text-[10px] bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded-full font-mono">
                  {currentWeekLabel}
                </span>
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Weekly dispatch matrix with daily hours and running weekly totals per technician
              </p>
            </div>
          </div>

          {/* Region Dropdown Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700/80 rounded-lg px-2.5 py-1 text-xs">
            <MapPin className="w-3.5 h-3.5 text-amber-500" />
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="bg-transparent text-slate-800 dark:text-slate-200 text-xs font-semibold focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-white dark:bg-slate-900">All Regions ({technicians.length} Techs)</option>
              {availableRegions.map((region) => (
                <option key={region} value={region} className="bg-white dark:bg-slate-900">
                  {region} ({technicians.filter((t) => t.region === region).length} Techs)
                </option>
              ))}
            </select>
          </div>

          {/* Group Filter (All / COD / Priority) */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-950 p-0.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
            <button
              onClick={() => setGroupFilter('all')}
              className={`px-2 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                groupFilter === 'all'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              All Jobs
            </button>
            <button
              onClick={() => setGroupFilter('cod')}
              className={`px-2 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                groupFilter === 'cod'
                  ? 'bg-[#ff00bf] text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              COD
            </button>
            <button
              onClick={() => setGroupFilter('priority')}
              className={`px-2 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                groupFilter === 'priority'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Priority
            </button>
          </div>

          {/* Hours Display Mode Toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-950 p-0.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
            <button
              onClick={() => setHoursMode('daily')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                hoursMode === 'daily'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Daily Hours
            </button>
            <button
              onClick={() => setHoursMode('cumulative')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                hoursMode === 'cumulative'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Running Total
            </button>
          </div>

          {/* Activity Legend: Green Install, Sky Blue Battery Swap, Violet Teardown, COD */}
          <div className="hidden lg:flex items-center gap-1.5 text-[11px] font-semibold bg-slate-50 dark:bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800">
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-300 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Install
            </span>
            <span className="text-slate-300 dark:text-slate-600">•</span>
            <span className="flex items-center gap-1 text-sky-600 dark:text-sky-300 font-bold">
              <span className="w-2 h-2 rounded-full bg-sky-400"></span> Swap
            </span>
            <span className="text-slate-300 dark:text-slate-600">•</span>
            <span className="flex items-center gap-1 text-violet-900 dark:text-violet-300 font-bold">
              <span className="w-2 h-2 rounded-full bg-violet-600 dark:bg-violet-400"></span> Teardown
            </span>
            {allowCOD && (
              <>
                <span className="text-slate-300 dark:text-slate-600">•</span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-[#ff00bf] text-white">
                  COD
                </span>
              </>
            )}
          </div>
        </div>

        {/* Right: Search & Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="text"
            placeholder="Search tech, job #, city..."
            value={activeSearch}
            onChange={(e) => {
              if (onSearchChange) onSearchChange(e.target.value);
              else setInternalSearch(e.target.value);
            }}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700/80 rounded-lg px-2.5 py-1 text-xs text-slate-900 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 w-40 sm:w-48"
          />

          {onOpenResetSchedule && (
            <button
              id="btn-clear-reset-dispatch"
              onClick={onOpenResetSchedule}
              title="Clear or Reset Dispatch & Timesheet and Scheduler Matrix"
              className="flex items-center gap-1.5 px-2.5 py-1 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/40 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 rounded-lg text-xs font-bold shadow-sm transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3 text-rose-500" />
              <span>Clear / Reset</span>
            </button>
          )}

          <button
            onClick={handleAutoEstimate}
            title="Auto-calculate hours from scheduled installs and teardowns"
            className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800 rounded-lg text-xs font-bold shadow-sm transition-colors cursor-pointer"
          >
            <Sparkles className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
            <span>Auto Calculate</span>
          </button>

          <button
            onClick={handleResetToDefaults}
            title="Reset hours to match Houston handwritten dispatch sheet"
            className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3 text-slate-500" />
            <span>Reset Hours</span>
          </button>

          <button
            onClick={handleExportTimesheet}
            title="Export full technician timesheet and assignments to CSV"
            className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold shadow-sm transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Summary Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex items-center justify-between shadow-sm">
          <div>
            <div className="text-[11px] font-bold text-slate-700 dark:text-slate-400">Total Unique Jobs</div>
            <div className="text-xl font-black text-slate-900 dark:text-white font-mono mt-0.5">
              {teamStats.totalJobs}
            </div>
            <div className="text-[10px] text-slate-600 dark:text-slate-400 font-medium">Deduplicated across technicians</div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <Layers className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex items-center justify-between shadow-sm">
          <div>
            <div className="text-[11px] font-bold text-slate-700 dark:text-slate-400">Total Fleet Hours</div>
            <div className="text-xl font-black text-cyan-600 dark:text-cyan-400 font-mono mt-0.5">
              {teamStats.totalHoursStr}
            </div>
            <div className="text-[10px] text-slate-600 dark:text-slate-400 font-medium">{teamStats.totalTechs} Technicians</div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-200 dark:border-cyan-800/60 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
            <Clock className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex items-center justify-between shadow-sm">
          <div>
            <div className="text-[11px] font-bold text-slate-700 dark:text-slate-400">Average Tech Hours</div>
            <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
              {teamStats.avgHoursStr}
            </div>
            <div className="text-[10px] text-slate-600 dark:text-slate-400 font-medium">Per field technician</div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <Check className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex items-center justify-between shadow-sm">
          <div>
            <div className="text-[11px] font-bold text-slate-700 dark:text-slate-400">Overtime Alerts (&gt;40h)</div>
            <div className={`text-xl font-black mt-0.5 font-mono ${teamStats.overtimeCount > 0 ? 'text-amber-600 dark:text-amber-500' : 'text-slate-800 dark:text-slate-300'}`}>
              {teamStats.overtimeCount > 0 ? `${teamStats.overtimeCount} Techs in OT` : 'All Normal'}
            </div>
            <div className="text-[10px] text-slate-600 dark:text-slate-400 font-medium">&gt; 40h weekly standard</div>
          </div>
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
            teamStats.overtimeCount > 0
              ? 'bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/60 text-amber-500'
              : 'bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-400'
          }`}>
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* The Main Dispatch & Timesheet Matrix - Maximized Full Screen Width */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-md overflow-x-auto relative">
        <table className="w-full border-collapse text-xs table-fixed min-w-[960px]">
          <colgroup>
            <col className="w-52 sm:w-56" />
            {daysList.map((d) => (
              <col key={`col-${d.dayName}`} className="w-[calc((100%-19rem)/7)]" />
            ))}
            <col className="w-24 sm:w-28" />
          </colgroup>

          {/* Header Rows: Green Date Numbers & Yellow Day Names */}
          <thead>
            {/* Header Row 1: Green Date Numbers */}
            <tr>
              <th className="w-52 sm:w-56 bg-slate-950 border border-slate-700/80 p-2 text-left text-xs font-bold text-slate-300">
                <div className="flex items-center justify-between">
                  <span>TECHNICIAN & INVENTORY</span>
                  <span className="text-[10px] text-slate-400 font-normal">hours & dispatch</span>
                </div>
              </th>

              {daysList.map((day) => (
                <th
                  key={`date-${day.dateStr}`}
                  className={`border border-slate-700/80 p-1.5 text-center text-xs font-extrabold tracking-wider select-none ${
                    day.isToday
                      ? 'bg-emerald-500 text-slate-950 ring-2 ring-emerald-300 ring-inset'
                      : 'bg-[#00c92b] text-slate-950'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1 font-mono">
                    <span className="text-sm font-black">{day.dateStr}</span>
                    {day.isToday && (
                      <span className="text-[9px] bg-slate-950 text-emerald-300 px-1 py-0.5 rounded font-bold uppercase">
                        TODAY
                      </span>
                    )}
                  </div>
                </th>
              ))}

              <th className="w-24 sm:w-28 bg-[#00c92b] text-slate-950 border border-slate-700/80 p-1.5 text-center text-xs font-extrabold tracking-wider">
                WEEK TOTAL
              </th>
            </tr>

            {/* Header Row 2: Yellow Day Names */}
            <tr>
              <th className="bg-[#1e40af] text-white border border-slate-700/80 p-1 text-[11px] font-black tracking-wider text-left pl-3">
                FIELD PERSONNEL
              </th>

              {daysList.map((day) => (
                <th
                  key={`day-${day.dayName}`}
                  className={`border border-slate-700/80 p-1 text-center text-[11px] font-black tracking-wider select-none ${
                    day.isToday
                      ? 'bg-[#ffff00] text-slate-950 ring-2 ring-yellow-400 ring-inset'
                      : 'bg-[#ffff00] text-slate-950'
                  }`}
                >
                  {day.dayName.toUpperCase()}
                </th>
              ))}

              <th className="bg-[#1e40af] text-white border border-slate-700/80 p-1 text-[11px] font-black tracking-wider text-center">
                RUNNING HOURS & OT
              </th>
            </tr>
          </thead>

          {/* Table Body: Grouped by Regions with Yellow Regional Divider Rows */}
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {filteredTechs.length === 0 ? (
              <tr>
                <td colSpan={daysList.length + 2} className="py-12 text-center">
                  <div className="flex flex-col items-center justify-center gap-2 text-slate-500 dark:text-slate-400">
                    <Users className="w-8 h-8 text-slate-400 dark:text-slate-600" />
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      No technicians or projects match the selected criteria.
                    </p>
                    <p className="text-xs text-slate-400">
                      Try choosing another region, clearing your search query, or switching the group filter.
                    </p>
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
                    {/* Regional Divider Row */}
                    <tr className="bg-[#ffff00] text-slate-950 font-black text-xs border-y-2 border-slate-600 select-none">
                      <td
                        colSpan={daysList.length + 2}
                        className="px-3 py-1 font-extrabold uppercase tracking-wide border border-slate-600"
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

                    {/* Technician Rows */}
                    {regionTechs.map((tech) => {
                      const overallStats = getTechOverallEquipmentStats(tech, projects, undefined, undefined, activeWeekId);
                      const techWeeklyCalc = calculateTechWeeklyHours(getEffectiveHoursForTech(tech.name), tech.name);
                      const techAssignedJobs = projects.filter(
                        (p) => isProjectAssignedToTech(p.technician, tech.name)
                      );

                      const isTechSearchMatch = Boolean(
                        activeSearch.trim() && tech.name.toLowerCase().includes(activeSearch.trim().toLowerCase())
                      );

                      return (
                        <tr key={tech.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          {/* 1. Left Technician Column */}
                          <td className={`p-2 border border-slate-300 dark:border-slate-700/80 text-xs font-semibold select-none shadow-sm ${
                            isTechSearchMatch
                              ? 'ring-4 ring-yellow-400 border-2 border-yellow-300 bg-yellow-500/40 text-yellow-100 dispatch-search-highlight'
                              : ''
                          } ${getTechHeaderStyle(tech.colorGroup)}`}>
                            <div className="flex flex-col gap-1">
                              {/* Name and Quick Actions */}
                              <div className="flex items-center justify-between">
                                <span className="font-bold tracking-tight text-white flex items-center gap-1.5 truncate">
                                  <span className="text-[13px] truncate">{tech.name}</span>
                                </span>
                                <div className="flex items-center gap-1 shrink-0">
                                  {allowCOD && onAssignCODForTech && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onAssignCODForTech(tech.name);
                                      }}
                                      title={`Assign projects assigned to ${tech.name} to COD`}
                                      className="px-1.5 py-0.5 rounded bg-[#ff00bf] hover:bg-[#ff00bf]/80 text-white font-black text-[10px] tracking-wide shadow-sm transition-colors cursor-pointer flex items-center gap-1"
                                    >
                                      <span>COD</span>
                                      {techAssignedJobs.filter((p) => p.group === 'COD' || p.specialBadge === 'COD').length > 0 && (
                                        <span className="bg-black/40 px-1 rounded-full text-[9px] font-mono">
                                          {techAssignedJobs.filter((p) => p.group === 'COD' || p.specialBadge === 'COD').length}
                                        </span>
                                      )}
                                    </button>
                                  )}
                                  {onQuickAddJob && (
                                    <button
                                      onClick={() => onQuickAddJob(tech.name, 'Monday', 'install')}
                                      title={`Assign job to ${tech.name}`}
                                      className="p-1 rounded bg-black/20 hover:bg-black/40 text-white transition-opacity cursor-pointer"
                                    >
                                      <Plus className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Team & Unique Job Count */}
                              <div className="flex items-center justify-between text-[10px] text-slate-200/90 font-mono font-medium">
                                <span>{tech.team.split(' ')[1] || tech.team}</span>
                                <span className="bg-black/30 px-1.5 py-0.5 rounded font-bold">
                                  {techAssignedJobs.length} {techAssignedJobs.length === 1 ? 'job' : 'jobs'}
                                </span>
                              </div>

                              {/* Camera & Machine Stock Box */}
                              <div className="pt-1 border-t border-white/20 grid grid-cols-2 gap-1 text-[10px] font-mono">
                                <div className="bg-black/40 rounded px-1.5 py-0.5 flex flex-col">
                                  <div className="flex items-center gap-1 text-cyan-300 font-bold">
                                    <Camera className="w-3 h-3 shrink-0" />
                                    <span>{tech.cameras} Cam</span>
                                  </div>
                                  <div className="text-[9px] text-slate-200 flex items-center justify-between">
                                    <span className={overallStats.currentAvailableCameras === tech.cameras ? 'text-emerald-300 font-bold' : 'text-amber-300 font-bold'}>
                                      {overallStats.currentAvailableCameras} avail
                                    </span>
                                  </div>
                                </div>

                                <div className="bg-black/40 rounded px-1.5 py-0.5 flex flex-col">
                                  <div className="flex items-center gap-1 text-amber-300 font-bold">
                                    <Cog className="w-3 h-3 shrink-0" />
                                    <span>{tech.machines} Mach</span>
                                  </div>
                                  <div className="text-[9px] text-slate-200 flex items-center justify-between">
                                    <span className={overallStats.currentAvailableMachines === tech.machines ? 'text-emerald-300 font-bold' : 'text-amber-300 font-bold'}>
                                      {overallStats.currentAvailableMachines} avail
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* 2-8: 7 Day Columns */}
                          {daysList.map((day) => {
                            const hoursKey = `${tech.name}_${day.dayName}`;
                            const rawDayHours = dailyHours[hoursKey] || '0:00:00';
                            const displayHours =
                              hoursMode === 'cumulative'
                                ? techWeeklyCalc.cumulativeRunningByDay[day.dayName]
                                : rawDayHours;

                            const dayJobs = getTechDayJobs(tech.name, day.dayName);
                            const installs = dayJobs.installs;
                            const batterySwaps = dayJobs.batterySwaps;
                            const teardowns = dayJobs.teardowns;

                            const totalDayJobs = installs.length + batterySwaps.length + teardowns.length;
                            const hasProjects = totalDayJobs > 0;
                            const isEditing = editingKey === hoursKey;

                            const allDayProjects = [...installs, ...batterySwaps, ...teardowns];
                            const isDayAllCOD = hasProjects && allDayProjects.every((p) => (p.group || p.specialBadge) === 'COD');

                            return (
                              <td
                                key={`cell-${tech.name}-${day.dayName}`}
                                className="p-1.5 border border-slate-200 dark:border-slate-700/80 align-top bg-white dark:bg-slate-950/80 hover:bg-slate-50 dark:hover:bg-slate-900/60 transition-colors"
                              >
                                <div className="flex flex-col gap-1.5 min-h-[90px]">
                                  {/* Top of Cell: COD Toggle & Daily Hours */}
                                  <div className="flex items-center justify-between gap-1 pb-1 border-b border-slate-200 dark:border-slate-800">
                                    {allowCOD ? (
                                      <div className="flex items-center gap-1 shrink-0">
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onToggleDayGroup?.(tech.name, day.dayName, 'COD');
                                          }}
                                          title={`Assign ${tech.name}'s ${day.dayName} projects to COD`}
                                          className={`px-1 py-0.5 rounded text-[9px] font-black transition-all cursor-pointer ${
                                            isDayAllCOD
                                              ? 'bg-[#ff00bf] text-white ring-1 ring-white shadow-sm'
                                              : 'text-slate-400 dark:text-slate-500 hover:text-[#ff00bf] hover:bg-[#ff00bf]/15'
                                          }`}
                                        >
                                          COD
                                        </button>
                                      </div>
                                    ) : (
                                      <span className="text-[9px] font-mono text-slate-400">{day.dayName.slice(0, 3)}</span>
                                    )}

                                    {/* Hours display */}
                                    {isEditing ? (
                                      <div className="flex items-center gap-1 w-full justify-end">
                                        <input
                                          type="text"
                                          autoFocus
                                          value={editingValue}
                                          onChange={(e) => setEditingValue(e.target.value)}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                              updateDailyHours(hoursKey, editingValue);
                                              setEditingKey(null);
                                            } else if (e.key === 'Escape') {
                                              setEditingKey(null);
                                            }
                                          }}
                                          className="w-16 bg-slate-100 dark:bg-slate-900 border border-blue-500 text-slate-900 dark:text-white font-mono font-bold text-xs px-1 py-0.5 rounded focus:outline-none"
                                          placeholder="0:00:00"
                                        />
                                        <button
                                          onClick={() => {
                                            updateDailyHours(hoursKey, editingValue);
                                            setEditingKey(null);
                                          }}
                                          className="p-0.5 rounded bg-emerald-600 text-white hover:bg-emerald-500 cursor-pointer"
                                        >
                                          <Check className="w-3 h-3" />
                                        </button>
                                        <button
                                          onClick={() => setEditingKey(null)}
                                          className="p-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </div>
                                    ) : hasProjects ? (
                                      <div
                                        onClick={() => {
                                          setEditingKey(hoursKey);
                                          setEditingValue(rawDayHours);
                                        }}
                                        title="Click to edit daily hours"
                                        className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono font-bold cursor-pointer transition-all ${
                                          rawDayHours !== '0:00:00'
                                            ? 'bg-blue-50 dark:bg-blue-950/80 text-blue-800 dark:text-cyan-200 border border-blue-200 dark:border-blue-700/60 hover:border-blue-400 shadow-sm'
                                            : 'bg-slate-100 dark:bg-slate-900/60 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-800/80 hover:text-slate-700 dark:hover:text-slate-300'
                                        }`}
                                      >
                                        <Clock className="w-3 h-3 text-blue-600 dark:text-cyan-400 shrink-0" />
                                        <span>{displayHours}</span>
                                        <Edit2 className="w-2.5 h-2.5 opacity-40 hover:opacity-100 ml-0.5" />
                                      </div>
                                    ) : (
                                      <span
                                        onClick={() => {
                                          setEditingKey(hoursKey);
                                          setEditingValue(rawDayHours);
                                        }}
                                        title="No projects scheduled (Click to add hours if needed)"
                                        className="text-slate-300 dark:text-slate-600 text-[10px] font-mono cursor-pointer hover:text-slate-400 px-1"
                                      >
                                        —
                                      </span>
                                    )}
                                  </div>

                                  {/* Scheduled Jobs Cards */}
                                  <div className="space-y-1">
                                    {installs.map((p) => (
                                      <DispatchJobCard
                                        key={`inst-${p.id}`}
                                        project={p}
                                        eventType="install"
                                        technicianName={tech.name}
                                        allowCOD={allowCOD}
                                        isSearchMatch={isProjectSearchMatch(p)}
                                        onSelect={onSelectProject}
                                        onOpenNotes={handleOpenNotes}
                                      />
                                    ))}

                                    {batterySwaps.map((p) => (
                                      <DispatchJobCard
                                        key={`swap-${p.id}`}
                                        project={p}
                                        eventType="battery_swap"
                                        technicianName={tech.name}
                                        allowCOD={allowCOD}
                                        isSearchMatch={isProjectSearchMatch(p)}
                                        onSelect={onSelectProject}
                                        onOpenNotes={handleOpenNotes}
                                      />
                                    ))}

                                    {teardowns.map((p) => (
                                      <DispatchJobCard
                                        key={`td-${p.id}`}
                                        project={p}
                                        eventType="teardown"
                                        technicianName={tech.name}
                                        allowCOD={allowCOD}
                                        isSearchMatch={isProjectSearchMatch(p)}
                                        onSelect={onSelectProject}
                                        onOpenNotes={handleOpenNotes}
                                      />
                                    ))}
                                  </div>
                                </div>
                              </td>
                            );
                          })}

                          {/* 9: Running Hours & OT Column */}
                          <td className="p-2 border border-slate-300 dark:border-slate-700/80 align-top bg-slate-50 dark:bg-slate-950 text-xs select-none">
                            <div className="flex flex-col gap-1 text-center">
                              <span className="font-mono font-black text-sm text-slate-900 dark:text-white">
                                {techWeeklyCalc.weeklyTotalStr}
                              </span>
                              {techWeeklyCalc.isOvertime && (
                                <span className="inline-flex items-center justify-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-amber-500 text-slate-950 tracking-wider">
                                  <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                                  <span>OVERTIME</span>
                                </span>
                              )}
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                                {techWeeklyCalc.daysWorked} {techWeeklyCalc.daysWorked === 1 ? 'day' : 'days'} worked
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })
            )}
          </tbody>

          {/* Table Footer: Fleet Daily Totals */}
          <tfoot>
            <tr className="bg-slate-100 dark:bg-slate-950 border-t-2 border-slate-300 dark:border-slate-700 font-bold text-xs">
              <td className="p-2 text-slate-800 dark:text-slate-200 font-black tracking-wider uppercase pl-3">
                DAILY FLEET TOTALS
              </td>
              {daysList.map((day) => (
                <td
                  key={`total-${day.dayName}`}
                  className="p-2 text-center font-mono font-black text-blue-700 dark:text-cyan-300 border border-slate-200 dark:border-slate-800"
                >
                  {formatSecondsToDuration(dailyFleetTotals.byDay[day.dayName])}
                </td>
              ))}
              <td className="p-2 text-center font-mono font-black text-emerald-700 dark:text-emerald-300 text-sm border border-slate-200 dark:border-slate-800">
                {dailyFleetTotals.grandTotalStr}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Notes Modal for Dispatch View */}
      {notesModalProject && (
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4"
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
                    {notesModalProject.cityState || notesModalProject.studyType} • Tech: {notesModalProject.technician}
                  </p>
                </div>
              </div>
              <button
                type="button"
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
                    className="text-xs text-rose-400 hover:text-rose-300 hover:underline px-1 py-0.5 cursor-pointer"
                  >
                    Clear Note
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setNotesModalProject(null)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveNote}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 shadow-md transition-colors flex items-center gap-1.5 cursor-pointer"
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
