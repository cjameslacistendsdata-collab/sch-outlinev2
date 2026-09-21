import React, { useState, useEffect, useMemo } from 'react';
import { Project, OpsStatus, WeekDay, EquipmentType, SpecialAssignment, Technician, WorkWeekSheet, RegionName, REGIONS } from './types';
import { INITIAL_PROJECTS } from './data/initialProjects';
import { TECHNICIANS } from './data/technicians';
import { Header, AppView } from './components/Header';
import { DispatchTimesheetMatrix } from './components/DispatchTimesheetMatrix';
import { SchedulerMatrix } from './components/SchedulerMatrix';
import { MonitoringTable } from './components/MonitoringTable';
import { TechnicianCapacityView } from './components/TechnicianCapacityView';
import { ProjectModal } from './components/ProjectModal';
import { AddProjectModal } from './components/AddProjectModal';
import { AutomatedStatusModal } from './components/AutomatedStatusModal';
import { StatusAdjustmentsModal, CsvStatusChange } from './components/StatusAdjustmentsModal';
import { AssignCODModal } from './components/AssignCODModal';
import { AirtableImportModal } from './components/AirtableImportModal';
import { ManageTechniciansModal } from './components/ManageTechniciansModal';
import { ManageTechniciansView } from './components/ManageTechniciansView';
import { BulkImportItem } from './components/UploadTechniciansModal';
import { AutoPopulateModal } from './components/AutoPopulateModal';
import { ResetScheduleModal, ResetOptionType } from './components/ResetScheduleModal';
import { WorkWeekTabs } from './components/WorkWeekTabs';
import {
  INITIAL_WORK_WEEKS,
  createNextWorkWeekSheet,
  filterProjectsByWorkWeek,
  CURRENT_WORK_WEEK_ID,
  computeActiveCycle,
  generateDateColumns,
} from './utils/workWeekEngine';
import { calculateBatterySwaps } from './utils/batterySwapEngine';
import { autoPopulateSchedulerMatrix, AutoPopulateResult } from './utils/autoPopulateEngine';
import {
  calculateWorkflowMetrics,
  auditAllProjects,
  exportProjectsToCSV,
  CURRENT_DAY_NAME,
  CURRENT_DATE_STR,
  CURRENT_FORMATTED_DATE,
} from './utils/statusEngine';
import { REFERENCE_SCHEDULING_CSV, REFERENCE_MONITORING_CSV } from './data/referenceCsvData';
import { parseAirtableCSV, assignRegionalTech, sanitizeProjectId, formatProjectId } from './utils/csvParser';
import {
  sanitizeTechnicianRoster,
  splitTechnicianNames,
  hasMultipleTechnicians,
  matchKnownTechnician,
  cleanTechName,
} from './utils/technicianUtils';
import {
  Sparkles,
  AlertCircle,
  Calendar,
  Layers,
  CheckCircle,
  Clock,
  MapPin,
  Wrench,
  X,
  FileSpreadsheet,
  UploadCloud,
} from 'lucide-react';

const SCHEDULING_STORAGE_KEY = 'nds_field_ops_scheduling_projects_v5';
const MONITORING_STORAGE_KEY = 'nds_field_ops_monitoring_projects_v5';
const SPECIAL_ASSIGNMENTS_STORAGE_KEY = 'nds_field_ops_special_assignments_v2';
const TECHNICIANS_STORAGE_KEY = 'nds_field_ops_technicians_v2';
const REGION_TECHNICIANS_STORAGE_KEY = 'nds_field_ops_technicians_by_region_v3';
const WORK_WEEKS_STORAGE_KEY = 'nds_field_ops_work_weeks_v3';
const ACTIVE_WEEK_STORAGE_KEY = 'nds_field_ops_active_week_id_v3';
const ACTIVE_REGION_STORAGE_KEY = 'nds_field_ops_active_region_v2';

// Special COD assignments: empty by default, only populated if assigned on CSV or added by user
const DEFAULT_SPECIAL_ASSIGNMENTS: Record<string, SpecialAssignment> = {};

export default function App() {
  // Region-Specific state - default to South Central
  const [activeRegion, setActiveRegion] = useState<RegionName>(() => {
    try {
      const saved = localStorage.getItem(ACTIVE_REGION_STORAGE_KEY);
      if (saved && REGIONS.includes(saved as RegionName)) {
        return saved as RegionName;
      }
    } catch (e) {
      console.error('Error loading active region from storage:', e);
    }
    return 'South Central';
  });

  useEffect(() => {
    try {
      localStorage.setItem(ACTIVE_REGION_STORAGE_KEY, activeRegion);
    } catch (e) {
      console.error('Error saving active region to storage:', e);
    }
  }, [activeRegion]);

  // COD is ONLY allowed on South Central as requested by the user
  const allowCOD = activeRegion === 'South Central';

  // 1. Scheduling Matrix & Dispatch / Timesheet State
  // Synchronized with 1st Reference CSV; independent from Monitoring Sheet
  const [schedulingProjects, setSchedulingProjects] = useState<Project[]>(() => {
    try {
      // Check migration flag to ensure CSV parsing updates are applied
      const migrationVersion = localStorage.getItem('nds_csv_parsed_version_v8');
      if (migrationVersion === 'true') {
        const saved = localStorage.getItem(SCHEDULING_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.map((p: Project) => {
              const sanitizedObj = sanitizeProjectId(p.id);
              const cleanCity = (!p.cityState || p.cityState === 'Unspecified')
                ? sanitizedObj.cityState || 'Unspecified'
                : p.cityState.replace(/["'_]/g, ' ').trim();
              const finalId = formatProjectId(sanitizedObj.projectNumber || p.id, cleanCity);
              return {
                ...p,
                id: finalId || sanitizedObj.id || p.id,
                cityState: cleanCity,
                region: (p.region as RegionName) || 'South Central',
                installDay: p.installDay || '',
                teardownDay: p.teardownDay || '',
                batterySwapDays:
                  p.batterySwapDays && p.batterySwapDays.length > 0
                    ? p.batterySwapDays
                    : undefined,
                batterySwapDates:
                  p.batterySwapDates && p.batterySwapDates.length > 0
                    ? p.batterySwapDates
                    : undefined,
                batterySwapDay: p.batterySwapDay || (p.batterySwapDays && p.batterySwapDays[0]) || undefined,
                consecutiveCollectionDays: p.consecutiveCollectionDays,
                technician: (() => {
                  const norm = splitTechnicianNames(p.technician);
                  if (norm.length > 0) return norm.join(', ');
                  return !p.technician || p.technician === 'Unassigned'
                    ? assignRegionalTech(cleanCity, sanitizedObj.id || p.id)
                    : p.technician;
                })(),
              };
            });
          }
        }
      }
    } catch (e) {
      console.error('Error loading scheduling projects from storage:', e);
    }
    // Default to 1st Reference CSV with accurate Install, Swap, and Teardown parsing
    try {
      const parsedCsv = parseAirtableCSV(REFERENCE_SCHEDULING_CSV);
      if (parsedCsv.projects.length > 0) {
        try {
          localStorage.setItem('nds_csv_parsed_version_v8', 'true');
        } catch (e) {}
        return parsedCsv.projects.map((p) => ({
          ...p,
          region: 'South Central' as RegionName,
        }));
      }
    } catch (e) {
      console.error('Error parsing reference scheduling CSV:', e);
    }
    return INITIAL_PROJECTS.map((p) => ({
      ...p,
      region: (p.region as RegionName) || 'South Central',
    }));
  });

  // Save scheduling projects to localStorage
  useEffect(() => {
    try {
      if (Array.isArray(schedulingProjects)) {
        localStorage.setItem(SCHEDULING_STORAGE_KEY, JSON.stringify(schedulingProjects));
      }
    } catch (e) {
      console.error('Error saving scheduling projects to storage:', e);
    }
  }, [schedulingProjects]);

  // 2. Monitoring Sheet State
  // Synchronized with 2nd Reference CSV; independent from Scheduling Matrix / Dispatch
  const [monitoringProjects, setMonitoringProjects] = useState<Project[]>(() => {
    try {
      const saved = localStorage.getItem(MONITORING_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((p: Project) => {
            const sanitizedObj = sanitizeProjectId(p.id);
            const cleanCity = (!p.cityState || p.cityState === 'Unspecified')
              ? sanitizedObj.cityState || 'Unspecified'
              : p.cityState.replace(/["'_]/g, ' ').trim();
            const finalId = formatProjectId(sanitizedObj.projectNumber || p.id, cleanCity);
            return {
              ...p,
              id: finalId || sanitizedObj.id || p.id,
              cityState: cleanCity,
              technician: (() => {
                const norm = splitTechnicianNames(p.technician);
                return norm.length > 0 ? norm.join(', ') : p.technician;
              })(),
              region: (p.region as RegionName) || 'South Central',
            };
          });
        }
      }
    } catch (e) {
      console.error('Error loading monitoring projects from storage:', e);
    }
    // Default to 2nd Reference CSV
    try {
      const parsedCsv = parseAirtableCSV(REFERENCE_MONITORING_CSV);
      if (parsedCsv.projects.length > 0) {
        return parsedCsv.projects.map((p) => ({
          ...p,
          region: 'South Central' as RegionName,
        }));
      }
    } catch (e) {
      console.error('Error parsing reference monitoring CSV:', e);
    }
    return INITIAL_PROJECTS.map((p) => ({
      ...p,
      region: (p.region as RegionName) || 'South Central',
    }));
  });

  // Save monitoring projects to localStorage
  useEffect(() => {
    try {
      if (Array.isArray(monitoringProjects)) {
        localStorage.setItem(MONITORING_STORAGE_KEY, JSON.stringify(monitoringProjects));
      }
    } catch (e) {
      console.error('Error saving monitoring projects to storage:', e);
    }
  }, [monitoringProjects]);

  // Selected Target Tab for Import Modal
  const [importModalTargetTab, setImportModalTargetTab] = useState<'scheduling' | 'monitoring'>('scheduling');

  // Dynamic Technicians State segregated by Region with persistence
  const [techniciansByRegion, setTechniciansByRegion] = useState<Record<RegionName, Technician[]>>(() => {
    try {
      const saved = localStorage.getItem(REGION_TECHNICIANS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          const result: Record<RegionName, Technician[]> = {} as any;
          REGIONS.forEach((r) => {
            const rawTechs = Array.isArray(parsed[r]) ? parsed[r] : (r === 'South Central' ? TECHNICIANS : []);
            const sanitized = sanitizeTechnicianRoster(rawTechs);
            if (r === 'South Central') {
              // Ensure base South Central technicians are preserved, plus any valid individual custom technicians
              const combined = [...TECHNICIANS];
              const existingNames = new Set(combined.map((t) => t.name.toLowerCase()));
              sanitized.forEach((t) => {
                const cName = cleanTechName(t.name);
                if (!hasMultipleTechnicians(cName) && !existingNames.has(cName.toLowerCase())) {
                  existingNames.add(cName.toLowerCase());
                  combined.push(t);
                }
              });
              result[r] = sanitizeTechnicianRoster(combined);
            } else {
              result[r] = sanitized;
            }
          });
          return result;
        }
      }
      // Migration from legacy flat technician storage if present
      const legacySaved = localStorage.getItem(TECHNICIANS_STORAGE_KEY);
      let southCentralTechs = TECHNICIANS;
      if (legacySaved) {
        try {
          const parsedLegacy = JSON.parse(legacySaved);
          if (Array.isArray(parsedLegacy) && parsedLegacy.length > 0) {
            southCentralTechs = sanitizeTechnicianRoster(parsedLegacy);
          }
        } catch (e) {
          // ignore
        }
      }
      const initialMap: Record<RegionName, Technician[]> = {} as any;
      REGIONS.forEach((r) => {
        initialMap[r] = r === 'South Central' ? sanitizeTechnicianRoster(southCentralTechs) : [];
      });
      return initialMap;
    } catch (e) {
      console.error('Error loading technicians by region:', e);
    }
    const fallback: Record<RegionName, Technician[]> = {} as any;
    REGIONS.forEach((r) => {
      fallback[r] = r === 'South Central' ? sanitizeTechnicianRoster(TECHNICIANS) : [];
    });
    return fallback;
  });

  useEffect(() => {
    try {
      localStorage.setItem(REGION_TECHNICIANS_STORAGE_KEY, JSON.stringify(techniciansByRegion));
    } catch (e) {
      console.error('Error saving technicians by region:', e);
    }
  }, [techniciansByRegion]);

  // Current active region's technician roster
  const technicians = useMemo(() => {
    const raw = techniciansByRegion[activeRegion] || [];
    return sanitizeTechnicianRoster(raw);
  }, [techniciansByRegion, activeRegion]);

  // Dynamic calculation of active cycle from today's reference date
  const activeCycle = useMemo(() => computeActiveCycle(CURRENT_DATE_STR), []);

  // Work Week Sheets State with persistence and live date column synchronization
  const [workWeeks, setWorkWeeks] = useState<WorkWeekSheet[]>(() => {
    try {
      const saved = localStorage.getItem(WORK_WEEKS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Re-synchronize date columns with CURRENT_DATE_STR so today's marker and column dates are always accurate
          const synced: WorkWeekSheet[] = parsed.map((sheet: WorkWeekSheet) => ({
            ...sheet,
            dateColumns: generateDateColumns(sheet.startDate, CURRENT_DATE_STR),
            isCurrent: sheet.id === activeCycle.weekId,
          }));

          // Ensure active cycle week exists in the sheets
          if (!synced.some((s: WorkWeekSheet) => s.id === activeCycle.weekId)) {
            const currentSheet: WorkWeekSheet = {
              id: activeCycle.weekId,
              label: `${activeCycle.cycleLabel} • Active Dispatch`,
              shortLabel: `W${activeCycle.weekNumber}: ${activeCycle.sundayDateStr.slice(5)} - ${activeCycle.saturdayDateStr.slice(5)}`,
              weekNumber: activeCycle.weekNumber,
              startDate: activeCycle.sundayDateStr,
              endDate: activeCycle.saturdayDateStr,
              isCurrent: true,
              dateColumns: activeCycle.dateColumns,
            };
            synced.unshift(currentSheet);
            synced.sort((a: WorkWeekSheet, b: WorkWeekSheet) => a.weekNumber - b.weekNumber);
          }
          return synced;
        }
      }
    } catch (e) {
      console.error('Error loading work weeks from storage:', e);
    }
    return INITIAL_WORK_WEEKS.map((sheet) => ({
      ...sheet,
      dateColumns: generateDateColumns(sheet.startDate, CURRENT_DATE_STR),
      isCurrent: sheet.id === activeCycle.weekId,
    }));
  });

  useEffect(() => {
    try {
      localStorage.setItem(WORK_WEEKS_STORAGE_KEY, JSON.stringify(workWeeks));
    } catch (e) {
      console.error('Error saving work weeks to storage:', e);
    }
  }, [workWeeks]);

  const [activeWeekId, setActiveWeekId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(ACTIVE_WEEK_STORAGE_KEY);
      if (saved && saved !== '2026-W36') return saved;
    } catch (e) {
      console.error('Error loading active week from storage:', e);
    }
    return activeCycle.weekId || CURRENT_WORK_WEEK_ID;
  });

  useEffect(() => {
    try {
      localStorage.setItem(ACTIVE_WEEK_STORAGE_KEY, activeWeekId);
    } catch (e) {
      console.error('Error saving active week to storage:', e);
    }
  }, [activeWeekId]);

  // Views and Modals - Default to 'dispatch' (Image View with hours per day and running total)
  const [activeView, setActiveView] = useState<AppView>('dispatch');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addModalPrefill, setAddModalPrefill] = useState<{ tech?: string; day?: WeekDay }>({});
  const [isAutoStatusModalOpen, setIsAutoStatusModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isManageTechsModalOpen, setIsManageTechsModalOpen] = useState(false);
  const [isManageTechsAddMode, setIsManageTechsAddMode] = useState(false);
  const [isAutoPopulateModalOpen, setIsAutoPopulateModalOpen] = useState(false);
  const [isResetScheduleModalOpen, setIsResetScheduleModalOpen] = useState(false);
  const [codModalConfig, setCodModalConfig] = useState<{
    techName: string;
    dayName?: WeekDay;
    listName?: string;
  } | null>(null);
  const [isStatusAdjustmentsModalOpen, setIsStatusAdjustmentsModalOpen] = useState(false);
  const [recentCsvChanges, setRecentCsvChanges] = useState<CsvStatusChange[]>([]);
  const [draggedFile, setDraggedFile] = useState<File | null>(null);
  const [isWindowDragging, setIsWindowDragging] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Special COD & LADOT assignments with manual camera and machine tracking
  const [specialAssignments, setSpecialAssignments] = useState<Record<string, SpecialAssignment>>(() => {
    try {
      const saved = localStorage.getItem(SPECIAL_ASSIGNMENTS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Error reading special assignments from storage:', e);
    }
    return DEFAULT_SPECIAL_ASSIGNMENTS;
  });

  useEffect(() => {
    try {
      localStorage.setItem(SPECIAL_ASSIGNMENTS_STORAGE_KEY, JSON.stringify(specialAssignments));
    } catch (e) {
      console.error('Error saving special assignments to storage:', e);
    }
  }, [specialAssignments]);

  const handleUpdateSpecialAssignmentEquipment = (key: string, cameras: number, machines: number) => {
    setSpecialAssignments((prev) => {
      const existing = prev[key];
      if (!existing) {
        // Parse techName and dayName from key e.g. "Anthony Oliphant-Tuesday"
        const lastHyphenIndex = key.lastIndexOf('-');
        const techName = lastHyphenIndex !== -1 ? key.substring(0, lastHyphenIndex) : key;
        const dayName = (lastHyphenIndex !== -1 ? key.substring(lastHyphenIndex + 1) : 'Monday') as WeekDay;
        const type = 'COD';
        return {
          ...prev,
          [key]: {
            id: key,
            techName,
            dayName,
            type,
            cameras: Math.max(0, cameras),
            machines: Math.max(0, machines),
          },
        };
      }
      return {
        ...prev,
        [key]: {
          ...existing,
          cameras: Math.max(0, cameras),
          machines: Math.max(0, machines),
        },
      };
    });
  };

  const handleSetSpecialAssignment = (assignment: SpecialAssignment) => {
    setSpecialAssignments((prev) => ({
      ...prev,
      [assignment.id]: assignment,
    }));
    showToast(`Saved ${assignment.type} for ${assignment.techName} (${assignment.dayName})`);
  };

  const handleRemoveSpecialAssignment = (key: string) => {
    setSpecialAssignments((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    showToast('Removed special assignment');
  };

  // Dark and Light Mode Theme State with persistence
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      const saved = localStorage.getItem('nds_field_ops_theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch (e) {
      console.error('Error reading theme from storage:', e);
    }
    return 'dark';
  });

  // Apply theme class to documentElement
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('light');
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
      root.classList.remove('light');
    }
    try {
      localStorage.setItem('nds_field_ops_theme', theme);
    } catch (e) {
      console.error('Error saving theme to storage:', e);
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Region-Specific project subsets
  const schedulingRegionProjects = useMemo(() => {
    const safe = Array.isArray(schedulingProjects) ? schedulingProjects : [];
    return safe.filter((p) => (p.region || 'South Central') === activeRegion);
  }, [schedulingProjects, activeRegion]);

  const monitoringRegionProjects = useMemo(() => {
    const safe = Array.isArray(monitoringProjects) ? monitoringProjects : [];
    return safe.filter((p) => (p.region || 'South Central') === activeRegion);
  }, [monitoringProjects, activeRegion]);

  // Active tab's projects for header metrics, status audits, work week tabs, and CSV export
  const activeTabProjects = useMemo(() => {
    return activeView === 'table' ? monitoringRegionProjects : schedulingRegionProjects;
  }, [activeView, monitoringRegionProjects, schedulingRegionProjects]);

  // Workflow Metrics & Automated Audits for current active tab
  const metrics = useMemo(() => calculateWorkflowMetrics(activeTabProjects), [activeTabProjects]);
  const auditResults = useMemo(() => auditAllProjects(activeTabProjects), [activeTabProjects]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const handleOpenImportModal = (forcedTab?: 'scheduling' | 'monitoring') => {
    const target = forcedTab || (activeView === 'table' ? 'monitoring' : 'scheduling');
    setImportModalTargetTab(target);
    setDraggedFile(null);
    setIsImportModalOpen(true);
  };

  // Global window drag & drop handler for Airtable CSV files
  useEffect(() => {
    let dragCounter = 0;

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragCounter++;
      if (e.dataTransfer && e.dataTransfer.types.includes('Files')) {
        setIsWindowDragging(true);
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter <= 0) {
        setIsWindowDragging(false);
        dragCounter = 0;
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounter = 0;
      setIsWindowDragging(false);
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (file.name.endsWith('.csv') || file.type.includes('csv') || file.type.includes('text')) {
          setDraggedFile(file);
          setImportModalTargetTab(activeView === 'table' ? 'monitoring' : 'scheduling');
          setIsImportModalOpen(true);
          showToast(`Loaded "${file.name}" for Airtable sync preview`);
        } else {
          showToast('Please drop a valid .csv file downloaded from Airtable');
        }
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, [activeView]);

  // Handlers for updates
  const handleUpdateProjectStatus = (projectId: string, newStatus: OpsStatus) => {
    const updateFn = (prev: Project[]) =>
      prev.map((p) => (p.id === projectId ? { ...p, opsStatus: newStatus, lastUpdated: new Date().toISOString() } : p));
    if (activeView === 'table') {
      setMonitoringProjects(updateFn);
    } else {
      setSchedulingProjects(updateFn);
    }
    showToast(`Updated ${projectId} status to "${newStatus}"`);
  };

  const handleUpdateProjectInstall = (projectId: string, newInstall: WeekDay) => {
    const updateFn = (prev: Project[]) =>
      prev.map((p) => {
        if (p.id !== projectId) return p;
        if (p.consecutiveCollectionDays && p.consecutiveCollectionDays >= 2) {
          const computed = calculateBatterySwaps({
            ...p,
            installDay: newInstall,
            consecutiveCollectionDays: p.consecutiveCollectionDays,
          });
          return {
            ...p,
            installDay: newInstall,
            teardownDay: computed.teardownDay || p.teardownDay,
            batterySwapDays: computed.batterySwapDays,
            batterySwapDates: computed.batterySwapDates,
            batterySwapDay: computed.batterySwapDay,
          };
        }
        return { ...p, installDay: newInstall };
      });
    if (activeView === 'table') {
      setMonitoringProjects(updateFn);
    } else {
      setSchedulingProjects(updateFn);
    }
    showToast(`Updated ${projectId} Install Day to ${newInstall}`);
  };

  const handleApplyBatterySwaps = (projectId: string, durationDays: number) => {
    const updateFn = (prev: Project[]) =>
      prev.map((p) => {
        if (p.id !== projectId) return p;
        const currentInstall = p.installDay || 'Monday';
        const computed = calculateBatterySwaps({
          ...p,
          installDay: currentInstall,
          consecutiveCollectionDays: durationDays,
        });
        return {
          ...p,
          installDay: currentInstall,
          consecutiveCollectionDays: durationDays,
          batterySwapDays: computed.batterySwapDays,
          batterySwapDates: computed.batterySwapDates,
          batterySwapDay: computed.batterySwapDay,
          teardownDay: computed.teardownDay || p.teardownDay,
        };
      });
    setSchedulingProjects(updateFn);
    setMonitoringProjects(updateFn);
    showToast(`Configured ${durationDays}-day collection battery swaps for ${projectId}`);
  };

  const handleClearBatterySwaps = (projectId: string) => {
    const updateFn = (prev: Project[]) =>
      prev.map((p) => {
        if (p.id !== projectId) return p;
        return {
          ...p,
          consecutiveCollectionDays: undefined,
          batterySwapDays: [],
          batterySwapDates: [],
          batterySwapDay: '',
        };
      });
    setSchedulingProjects(updateFn);
    setMonitoringProjects(updateFn);
    showToast(`Cleared battery swaps for ${projectId}`);
  };

  const handleUpdateProjectTeardown = (projectId: string, newTeardown: WeekDay) => {
    const updateFn = (prev: Project[]) =>
      prev.map((p) => (p.id === projectId ? { ...p, teardownDay: newTeardown } : p));
    if (activeView === 'table') {
      setMonitoringProjects(updateFn);
    } else {
      setSchedulingProjects(updateFn);
    }
    showToast(`Updated ${projectId} Teardown Day to ${newTeardown}`);
  };

  const handleUpdateProjectTech = (projectId: string, newTech: string) => {
    const updateFn = (prev: Project[]) =>
      prev.map((p) => (p.id === projectId ? { ...p, technician: newTech } : p));
    if (activeView === 'table') {
      setMonitoringProjects(updateFn);
    } else {
      setSchedulingProjects(updateFn);
    }
    showToast(`Reassigned ${projectId} to ${newTech}`);
  };

  const handleUpdateProjectEquipment = (projectId: string, count: number, type?: EquipmentType) => {
    const updateFn = (prev: Project[]) =>
      prev.map((p) =>
        p.id === projectId
          ? {
              ...p,
              equipmentCount: Math.max(0, count),
              ...(type ? { equipmentType: type } : {}),
              lastUpdated: new Date().toISOString(),
            }
          : p
      );
    if (activeView === 'table') {
      setMonitoringProjects(updateFn);
    } else {
      setSchedulingProjects(updateFn);
    }
    showToast(`Updated project ${projectId} equipment to ${count} units`);
  };

  const handleSaveProject = (updated: Project) => {
    const updateFn = (prev: Project[]) =>
      prev.map((p) => (p.id === updated.id ? updated : p));
    if (activeView === 'table') {
      setMonitoringProjects(updateFn);
    } else {
      setSchedulingProjects(updateFn);
    }
    showToast(`Saved changes for project ${updated.id}`);
  };

  const handleAddProject = (newProject: Project) => {
    const projectWithRegion: Project = {
      ...newProject,
      region: newProject.region || activeRegion,
    };
    if (activeView === 'table') {
      setMonitoringProjects((prev) => [projectWithRegion, ...prev]);
    } else {
      setSchedulingProjects((prev) => [projectWithRegion, ...prev]);
    }
    showToast(`Added new project ${projectWithRegion.id} to ${projectWithRegion.region}`);
  };

  const handleDeleteProject = (projectId: string) => {
    if (activeView === 'table') {
      setMonitoringProjects((prev) => prev.filter((p) => p.id !== projectId));
    } else {
      setSchedulingProjects((prev) => prev.filter((p) => p.id !== projectId));
    }
    showToast(`Deleted project ${projectId}`);
  };

  const handleApplyAutoUpdates = (updates: { projectId: string; newStatus: OpsStatus }[]) => {
    const updateMap = new Map(updates.map((u) => [u.projectId, u.newStatus]));
    const updateFn = (prev: Project[]) =>
      prev.map((p) => {
        if (updateMap.has(p.id)) {
          return { ...p, opsStatus: updateMap.get(p.id)!, lastUpdated: new Date().toISOString() };
        }
        return p;
      });
    if (activeView === 'table') {
      setMonitoringProjects(updateFn);
    } else {
      setSchedulingProjects(updateFn);
    }
    showToast(`Successfully applied ${updates.length} automated status synchronizations`);
  };

  const handleImportProjects = (
    importedProjects: Project[],
    mode: 'merge' | 'replace',
    targetRegion?: RegionName,
    targetTab?: 'scheduling' | 'monitoring'
  ) => {
    const importRegion: RegionName = targetRegion || activeRegion || 'South Central';
    const destinationTab: 'scheduling' | 'monitoring' =
      targetTab || importModalTargetTab || (activeView === 'table' ? 'monitoring' : 'scheduling');
    const isTargetMonitoring = destinationTab === 'monitoring';

    const currentTargetList = isTargetMonitoring ? monitoringProjects : schedulingProjects;
    const setTargetList = isTargetMonitoring ? setMonitoringProjects : setSchedulingProjects;

    // Separate other regions' projects so they are 100% untouched and preserved!
    const otherRegionsProjects = currentTargetList.filter((p) => (p.region || 'South Central') !== importRegion);
    const thisRegionProjects = currentTargetList.filter((p) => (p.region || 'South Central') === importRegion);

    // 1. Detect CSV status changes compared to current data for this region
    const detectedChanges: CsvStatusChange[] = [];
    const currentMap = new Map<string, Project>(thisRegionProjects.map((p) => [p.id.toLowerCase(), p]));

    for (const imp of importedProjects) {
      const existing = currentMap.get(imp.id.toLowerCase());
      if (existing && imp.opsStatus && existing.opsStatus !== imp.opsStatus) {
        detectedChanges.push({
          projectId: existing.id,
          projectCity: existing.cityState,
          technician: existing.technician,
          oldStatus: existing.opsStatus,
          newStatus: imp.opsStatus,
        });
      }
    }

    // Helper to determine if a project belongs to a previous work week
    // Format: 'YYYY-Www' (e.g. '2026-W36' < '2026-W37')
    const isPreviousWeek = (ww?: string) => {
      if (!ww) return false;
      return ww < CURRENT_WORK_WEEK_ID;
    };

    let updatedThisRegion: Project[] = [];

    if (mode === 'replace') {
      if (isTargetMonitoring) {
        // Monitoring sheet can contain all weeks (e.g. historical W36 + active W37)
        updatedThisRegion = importedProjects.map((imp) => ({
          ...imp,
          region: importRegion,
        }));
      } else {
        // In replace mode for Scheduling: keep all projects from previous work weeks for this region, only replace current & future work weeks!
        const previousWeekProjects = thisRegionProjects.filter((p) => isPreviousWeek(p.workWeek));
        const allowedImported = importedProjects
          .filter((imp) => !isPreviousWeek(imp.workWeek))
          .map((imp) => ({
            ...imp,
            region: importRegion,
          }));
        updatedThisRegion = [...previousWeekProjects, ...allowedImported];
      }
    } else {
      // Merge mode
      const projectMap = new Map<string, Project>(thisRegionProjects.map((p) => [p.id.toLowerCase(), p]));

      for (const rawImported of importedProjects) {
        const imported: Project = { ...rawImported, region: importRegion };
        const key = imported.id.toLowerCase();
        if (projectMap.has(key)) {
          const existing = projectMap.get(key)!;
          if (!isTargetMonitoring) {
            if (isPreviousWeek(existing.workWeek)) {
              continue;
            }
            if (isPreviousWeek(imported.workWeek)) {
              continue;
            }
          }

          projectMap.set(key, {
            ...existing,
            ...imported,
            region: importRegion,
            cityState: imported.cityState || existing.cityState,
            studyType: imported.studyType || existing.studyType,
            technician: imported.technician && imported.technician !== 'Unassigned' ? imported.technician : existing.technician,
            installDay: imported.installDay || existing.installDay,
            teardownDay: imported.teardownDay || existing.teardownDay,
            opsStatus: imported.opsStatus || existing.opsStatus,
            locationsCount: imported.locationsCount || existing.locationsCount,
            equipmentCount: imported.equipmentCount !== undefined ? imported.equipmentCount : existing.equipmentCount,
            equipmentType: imported.equipmentType || existing.equipmentType,
            dateSent: imported.dateSent || existing.dateSent,
            opsAuditDate: imported.opsAuditDate || imported.dateSent || existing.opsAuditDate || existing.dateSent,
            lastUpdated: new Date().toISOString(),
          });
        } else {
          if (isTargetMonitoring || !isPreviousWeek(imported.workWeek)) {
            projectMap.set(key, imported);
          }
        }
      }

      updatedThisRegion = Array.from(projectMap.values());
    }

    const fullUpdatedProjectsList = [...otherRegionsProjects, ...updatedThisRegion];
    setTargetList(fullUpdatedProjectsList);

    // 1b. Automatically register any technicians assigned in the imported CSV strictly to importRegion
    // Directive: "Don't create a line item or column below when there are multiple techs assigned from the imported csv."
    const existingTechNames = new Set((techniciansByRegion[importRegion] || []).map((t) => cleanTechName(t.name).toLowerCase()));
    const newTechsToDiscover: Technician[] = [];
    for (const p of updatedThisRegion) {
      if (!p.technician || p.technician.trim().toLowerCase() === 'unassigned') {
        continue;
      }

      // If multiple techs are assigned on this project, NEVER create a technician line item or column below!
      if (hasMultipleTechnicians(p.technician)) {
        continue;
      }

      const individualTechs = splitTechnicianNames(p.technician);
      if (individualTechs.length !== 1) {
        continue;
      }

      const singleTech = cleanTechName(individualTechs[0]);
      const lowerTech = singleTech.toLowerCase();
      if (!singleTech || lowerTech === 'unassigned' || hasMultipleTechnicians(singleTech)) {
        continue;
      }

      // Check against current region techs and known roster
      const currentRegionTechs = techniciansByRegion[importRegion] || [];
      const isKnown = matchKnownTechnician(singleTech, currentRegionTechs) || matchKnownTechnician(singleTech);
      if (isKnown) {
        continue;
      }

      if (!existingTechNames.has(lowerTech)) {
        existingTechNames.add(lowerTech);
        newTechsToDiscover.push({
          id: `tech-${lowerTech.replace(/[^a-z0-9]/g, '-')}-${Date.now().toString().slice(-4)}`,
          name: singleTech,
          team: `${importRegion} Fleet`,
          colorGroup: 'navy',
          region: importRegion,
          operationalRegion: importRegion,
          cameras: 25,
          machines: 4,
          active: true,
        });
      }
    }
    if (newTechsToDiscover.length > 0) {
      setTechniciansByRegion((prev) => ({
        ...prev,
        [importRegion]: sanitizeTechnicianRoster([...(prev[importRegion] || []), ...newTechsToDiscover]),
      }));
    }

    if (activeRegion !== importRegion) {
      setActiveRegion(importRegion);
    }

    const targetTabLabel = isTargetMonitoring ? 'Monitoring Sheet' : 'Scheduling Matrix & Dispatch';
    const untouchedTabLabel = isTargetMonitoring ? 'Scheduling Matrix & Dispatch' : 'Monitoring Sheet';

    // 2. Set recent CSV changes and check today's automated status adjustments
    setRecentCsvChanges(detectedChanges);
    const todayAudits = auditAllProjects(updatedThisRegion, CURRENT_DAY_NAME);

    if (detectedChanges.length > 0 || todayAudits.length > 0) {
      setIsStatusAdjustmentsModalOpen(true);
      showToast(
        `Imported CSV to ${targetTabLabel} (${importRegion}): ${detectedChanges.length} status change(s) detected. (${untouchedTabLabel} untouched)`
      );
    } else {
      showToast(
        `Imported ${importedProjects.length} records into ${targetTabLabel} (${importRegion}). ${untouchedTabLabel} untouched.`
      );
    }
  };

  // Open COD project picker modal for a specific technician and optional day / list
  const handleAssignCODForTech = (technicianName: string, dayName?: WeekDay, listName?: string) => {
    setCodModalConfig({ techName: technicianName, dayName, listName });
  };

  const handleOpenAssignCOD = (technicianName: string, dayName?: WeekDay, listName?: string) => {
    setCodModalConfig({ techName: technicianName, dayName, listName });
  };

  const handleUpdateCodListName = (techName: string, dayName: WeekDay, newListName: string) => {
    setSchedulingProjects((prev) =>
      prev.map((p) => {
        const isMatch =
          p.technician === techName &&
          (p.installDay === dayName || p.teardownDay === dayName || p.batterySwapDay === dayName) &&
          (p.group === 'COD' || p.specialBadge === 'COD');
        if (isMatch) {
          return {
            ...p,
            codList: newListName,
            lastUpdated: new Date().toISOString(),
          };
        }
        return p;
      })
    );
  };

  const handleApplyCODFromModal = (
    projectIds: string[],
    isCOD: boolean,
    listName?: string,
    targetDay?: WeekDay,
    targetTech?: string
  ) => {
    const idSet = new Set(projectIds);
    setSchedulingProjects((prev) =>
      prev.map((p) => {
        if (idSet.has(p.id)) {
          return {
            ...p,
            group: isCOD ? 'COD' : undefined,
            specialBadge: isCOD ? 'COD' : undefined,
            codList: isCOD ? (listName || p.codList || 'List-107') : undefined,
            technician: targetTech || (p.technician === 'Unassigned' && codModalConfig?.techName ? codModalConfig.techName : p.technician),
            installDay: targetDay || p.installDay,
            lastUpdated: new Date().toISOString(),
          };
        }
        return p;
      })
    );
    const targetTechName = targetTech || codModalConfig?.techName || 'technician';
    setCodModalConfig(null);
    showToast(
      isCOD
        ? `Grouped ${projectIds.length} project(s) as ${listName || 'COD'} for ${targetTechName}`
        : `Removed COD grouping from ${projectIds.length} project(s) for ${targetTechName}`
    );
  };

  // Option per day per tech: COD
  const handleToggleDayGroup = (techName: string, dayName: WeekDay, group: 'COD') => {
    if (!allowCOD) return;
    setSchedulingProjects((prev) => {
      const dayJobs = prev.filter(
        (p) =>
          p.technician === techName &&
          (p.installDay === dayName || p.teardownDay === dayName || p.batterySwapDay === dayName) &&
          (!p.workWeek || p.workWeek === activeWeekId) &&
          (p.region || 'South Central') === activeRegion
      );
      if (dayJobs.length === 0) {
        showToast(`No projects found for ${techName} on ${dayName}`);
        return prev;
      }
      const allMatch = dayJobs.every((p) => (p.group || p.specialBadge) === group);
      const targetGroup = allMatch ? undefined : group;

      showToast(
        targetGroup
          ? `Marked ${dayJobs.length} project(s) on ${dayName} for ${techName} as ${targetGroup}`
          : `Cleared ${group} from projects on ${dayName} for ${techName}`
      );

      return prev.map((p) => {
        const isMatch =
          p.technician === techName &&
          (p.installDay === dayName || p.teardownDay === dayName || p.batterySwapDay === dayName) &&
          (!p.workWeek || p.workWeek === activeWeekId) &&
          (p.region || 'South Central') === activeRegion;
        if (isMatch) {
          return {
            ...p,
            group: targetGroup,
            specialBadge: targetGroup,
            lastUpdated: new Date().toISOString(),
          };
        }
        return p;
      });
    });
  };

  // Update Schedule Status inline from Monitoring Sheet
  const handleUpdateProjectScheduleStatus = (projectId: string, newStatus: Project['scheduleStatus']) => {
    setMonitoringProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, scheduleStatus: newStatus, lastUpdated: new Date().toISOString() } : p))
    );
    showToast(`Updated Schedule Status for ${projectId}`);
  };

  // Update Version inline from Monitoring Sheet
  const handleUpdateProjectVersion = (projectId: string, newVersion: string) => {
    setMonitoringProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, version: newVersion, lastUpdated: new Date().toISOString() } : p))
    );
    showToast(`Updated Version for ${projectId}`);
  };

  // Bulk update multiple projects at once (Status, Schedule Status, Version)
  const handleBulkUpdateProjects = (projectIds: string[], updates: Partial<Project>) => {
    const idSet = new Set(projectIds);
    const updateFn = (prev: Project[]) =>
      prev.map((p) => {
        if (idSet.has(p.id)) {
          return {
            ...p,
            ...updates,
            lastUpdated: new Date().toISOString(),
          };
        }
        return p;
      });

    if (activeView === 'table') {
      setMonitoringProjects(updateFn);
    } else {
      setSchedulingProjects(updateFn);
    }

    const summary: string[] = [];
    if (updates.opsStatus) summary.push(`Status to "${updates.opsStatus}"`);
    if (updates.scheduleStatus !== undefined) summary.push(`Schedule Status to "${updates.scheduleStatus || '(Blank)'}"`);
    if (updates.version !== undefined) summary.push(`Version to "${updates.version || '(Blank)'}"`);
    showToast(`Updated ${projectIds.length} project(s): ${summary.join(', ') || 'saved'}`);
  };

  const handleExportCSV = () => {
    const csvContent = exportProjectsToCSV(activeTabProjects);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `nds_${activeRegion.toLowerCase().replace(/\s+/g, '_')}_${activeView === 'table' ? 'monitoring' : 'scheduling'}_${CURRENT_DATE_STR}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Exported ${activeRegion} ${activeView === 'table' ? 'monitoring' : 'scheduling'} sheet to CSV`);
  };

  const handleAssignProjectToDay = (techName: string, day: WeekDay) => {
    setAddModalPrefill({ tech: techName, day });
    setIsAddModalOpen(true);
  };

  // Technician management handlers - strictly isolated to the active region
  const handleAddTechnician = (newTech: Technician, targetRegion: RegionName = activeRegion) => {
    const techWithRegion: Technician = {
      ...newTech,
      operationalRegion: targetRegion,
    };
    setTechniciansByRegion((prev) => {
      const currentList = prev[targetRegion] || [];
      if (currentList.some((t) => t.name.toLowerCase() === techWithRegion.name.toLowerCase())) {
        showToast(`Technician "${techWithRegion.name}" already exists in ${targetRegion}`);
        return prev;
      }
      return {
        ...prev,
        [targetRegion]: [...currentList, techWithRegion],
      };
    });
    showToast(`Added technician "${techWithRegion.name}" to ${targetRegion}. Other regions untouched.`);
  };

  const handleRemoveTechnician = (techId: string, targetRegion: RegionName = activeRegion) => {
    const currentList = techniciansByRegion[targetRegion] || [];
    const techToRemove = currentList.find((t) => t.id === techId);
    if (!techToRemove) return;

    setTechniciansByRegion((prev) => ({
      ...prev,
      [targetRegion]: (prev[targetRegion] || []).filter((t) => t.id !== techId),
    }));

    // Reassign affected projects in both scheduling and monitoring ONLY within targetRegion to 'Unassigned'
    const unassignTechFn = (prev: Project[]) =>
      prev.map((p) => {
        if ((p.region || 'South Central') === targetRegion && p.technician === techToRemove.name) {
          return {
            ...p,
            technician: 'Unassigned',
            opsStatus: 'Needs Scheduling',
            lastUpdated: new Date().toISOString(),
          };
        }
        return p;
      });

    setSchedulingProjects(unassignTechFn);
    setMonitoringProjects(unassignTechFn);

    showToast(`Removed technician "${techToRemove.name}" from ${targetRegion}. Other regions unaffected.`);
  };

  const handleUpdateTechnician = (updatedTech: Technician, oldName?: string, targetRegion: RegionName = activeRegion) => {
    setTechniciansByRegion((prev) => ({
      ...prev,
      [targetRegion]: (prev[targetRegion] || []).map((t) => (t.id === updatedTech.id ? updatedTech : t)),
    }));

    // If technician name changed, propagate update in both tabs ONLY within targetRegion
    if (oldName && oldName.trim().toLowerCase() !== updatedTech.name.trim().toLowerCase()) {
      const renameTechFn = (prev: Project[]) =>
        prev.map((p) => {
          if ((p.region || 'South Central') === targetRegion && p.technician === oldName) {
            return {
              ...p,
              technician: updatedTech.name,
              lastUpdated: new Date().toISOString(),
            };
          }
          return p;
        });

      setSchedulingProjects(renameTechFn);
      setMonitoringProjects(renameTechFn);
    }

    showToast(`Updated technician "${updatedTech.name}" details in ${targetRegion}.`);
  };

  const handleResetTechnicians = (targetRegion: RegionName = activeRegion) => {
    setTechniciansByRegion((prev) => ({
      ...prev,
      [targetRegion]: targetRegion === 'South Central' ? TECHNICIANS : [],
    }));
    showToast(`Reset technician roster for ${targetRegion}.`);
  };

  const handleBulkImportTechnicians = (
    items: BulkImportItem[],
    mode: 'update' | 'append' | 'replace'
  ) => {
    if (items.length === 0) return;

    setTechniciansByRegion((prev) => {
      const next = { ...prev };
      const grouped: Record<string, Technician[]> = {};
      for (const item of items) {
        if (!grouped[item.targetRegion]) {
          grouped[item.targetRegion] = [];
        }
        grouped[item.targetRegion].push(item.tech);
      }

      for (const [reg, incomingTechs] of Object.entries(grouped)) {
        const regionKey = reg as RegionName;
        const currentList = prev[regionKey] || [];

        if (mode === 'replace') {
          next[regionKey] = incomingTechs;
        } else if (mode === 'append') {
          const existingNames = new Set(currentList.map((t) => t.name.toLowerCase()));
          const toAdd = incomingTechs.filter((t) => !existingNames.has(t.name.toLowerCase()));
          next[regionKey] = [...currentList, ...toAdd];
        } else {
          // 'update' (default): updates existing by name, adds new
          const updatedList = [...currentList];
          for (const inc of incomingTechs) {
            const idx = updatedList.findIndex(
              (t) => t.name.toLowerCase() === inc.name.toLowerCase()
            );
            if (idx !== -1) {
              updatedList[idx] = {
                ...updatedList[idx],
                ...inc,
                id: updatedList[idx].id, // preserve existing ID
              };
            } else {
              updatedList.push(inc);
            }
          }
          next[regionKey] = updatedList;
        }
      }

      return next;
    });

    const regionsTouched = Array.from(new Set(items.map((i) => i.targetRegion)));
    showToast(
      `Successfully imported ${items.length} technician(s) across ${regionsTouched.join(', ')}.`
    );
  };

  // Work Week Sheets handlers
  const handleAddWeekSheet = () => {
    const nextWeek = createNextWorkWeekSheet(workWeeks);
    setWorkWeeks((prev) => [...prev, nextWeek]);
    setActiveWeekId(nextWeek.id);
    showToast(`Created new sheet: "${nextWeek.label}"`);
  };

  const handleDeleteWeekSheet = (weekId: string) => {
    setWorkWeeks((prev) => prev.filter((w) => w.id !== weekId));
    if (activeWeekId === weekId) {
      setActiveWeekId(CURRENT_WORK_WEEK_ID);
    }
    showToast(`Deleted work week sheet`);
  };

  // Auto-populate from Monitoring Sheet calculation for current region
  const autoPopulateResult = useMemo(
    () => autoPopulateSchedulerMatrix(monitoringRegionProjects, technicians),
    [monitoringRegionProjects, technicians]
  );

  const handleApplyAutoPopulate = (updatedRegionProjects: Project[]) => {
    setSchedulingProjects((prev) => {
      const otherRegions = prev.filter((p) => (p.region || 'South Central') !== activeRegion);
      const stampedUpdated = updatedRegionProjects.map((p) => ({ ...p, region: activeRegion }));
      return [...otherRegions, ...stampedUpdated];
    });
    setIsAutoPopulateModalOpen(false);
    showToast(`Auto-populated ${autoPopulateResult.totalUpdated} project schedules for ${activeRegion}`);
  };

  // Clear / Reset Handler for Scheduler Matrix & Dispatch Tab
  const handleResetScheduling = (option: ResetOptionType) => {
    if (option === 'clear_week_assignments') {
      setSchedulingProjects((prev) =>
        prev.map((p) => {
          const belongsToRegion = (p.region || 'South Central') === activeRegion;
          const belongsToWeek = p.workWeek ? p.workWeek === activeWeekId : activeWeekId === CURRENT_WORK_WEEK_ID;
          if (belongsToRegion && belongsToWeek) {
            return {
              ...p,
              technician: 'Unassigned',
              installDay: '',
              teardownDay: '',
              lastUpdated: new Date().toISOString(),
            };
          }
          return p;
        })
      );
      showToast(`Cleared schedule assignments for ${activeRegion} in ${activeWeekObj?.label || activeWeekId}`);
    } else if (option === 'clear_region_projects') {
      setSchedulingProjects((prev) =>
        prev.filter((p) => (p.region || 'South Central') !== activeRegion)
      );
      showToast(`Cleared all Scheduling Matrix & Dispatch jobs for ${activeRegion}`);
    } else if (option === 'reset_to_default') {
      try {
        const parsed = parseAirtableCSV(REFERENCE_SCHEDULING_CSV);
        const defaults = parsed.projects.map((p) => ({
          ...p,
          region: 'South Central' as RegionName,
        }));
        setSchedulingProjects((prev) => {
          const otherRegions = prev.filter((p) => (p.region || 'South Central') !== activeRegion);
          if (activeRegion === 'South Central') {
            return [...defaults, ...otherRegions];
          } else {
            return otherRegions;
          }
        });
        showToast(`Reset Scheduling Matrix & Dispatch for ${activeRegion} to default`);
      } catch (e) {
        console.error('Error resetting to default schedule:', e);
      }
    }
  };

  // Filter projects by current active work week sheet AND current active region
  const displaySchedulingProjects = useMemo(
    () => filterProjectsByWorkWeek(schedulingRegionProjects, activeWeekId, workWeeks),
    [schedulingRegionProjects, activeWeekId, workWeeks]
  );

  const displayMonitoringProjects = useMemo(
    () => filterProjectsByWorkWeek(monitoringRegionProjects, activeWeekId, workWeeks),
    [monitoringRegionProjects, activeWeekId, workWeeks]
  );

  const activeWeekObj = useMemo(
    () => workWeeks.find((w) => w.id === activeWeekId),
    [workWeeks, activeWeekId]
  );
  const activeDateColumns = activeWeekObj?.dateColumns || activeCycle.dateColumns;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-white relative">
      {/* Window-wide Drag & Drop Overlay */}
      {isWindowDragging && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 border-4 border-dashed border-cyan-400 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-150 pointer-events-none">
          <div className="w-20 h-20 rounded-2xl bg-cyan-600/30 border border-cyan-400 flex items-center justify-center text-cyan-300 shadow-2xl mb-4 animate-bounce">
            <UploadCloud className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-wide">
            Drop Airtable CSV Here
          </h2>
          <p className="text-sm text-cyan-300 max-w-md mt-1">
            Drop your downloaded CSV to automatically parse and synchronize project statuses, technicians, and equipment counts.
          </p>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-cyan-900 border border-cyan-500/60 text-white px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs font-medium animate-in slide-in-from-top-2">
          <CheckCircle className="w-4 h-4 text-cyan-400" />
          <span>{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="ml-2 hover:text-slate-300"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Header */}
      <Header
        activeView={activeView}
        onViewChange={setActiveView}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        pendingUpdatesCount={auditResults.length}
        onOpenAutoStatus={() => setIsAutoStatusModalOpen(true)}
        onOpenAddProject={() => {
          setAddModalPrefill({});
          setIsAddModalOpen(true);
        }}
        onOpenImportCSV={() => handleOpenImportModal()}
        onExportCSV={handleExportCSV}
        totalProjects={metrics.totalProjects}
        totalEquipment={metrics.totalEquipment}
        activeInField={metrics.statusCounts['All locations installed']}
        teardownsToday={metrics.teardownsToday}
        theme={theme}
        onToggleTheme={toggleTheme}
        activeCycleLabel={activeWeekObj ? activeWeekObj.label : activeCycle.cycleLabel}
        refDate={CURRENT_DATE_STR}
        refDateLabel={`${CURRENT_FORMATTED_DATE} (${CURRENT_DAY_NAME})`}
        activeRegion={activeRegion}
        onRegionChange={setActiveRegion}
      />

      {/* Operational Highlights Strip */}
      <div className="bg-slate-900/60 border-b border-slate-800/80 px-3 sm:px-5 lg:px-6 py-2 text-xs">
        <div className="w-full flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4 text-slate-300">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
              <strong>{metrics.statusCounts['All locations installed']}</strong> Active in Field
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <strong>{metrics.statusCounts['Pending QAQC OPS']}</strong> In QA/QC
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              <strong>{metrics.statusCounts['Scheduled to techs']}</strong> Scheduled
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2 h-2 rounded-full bg-rose-400"></span>
              <strong>{metrics.statusCounts['Needs Scheduling']}</strong> Needs Scheduling
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Airtable Quick Drag Tip */}
            <button
              onClick={() => handleOpenImportModal()}
              className="text-slate-400 hover:text-cyan-300 text-[11px] flex items-center gap-1.5 transition-colors"
            >
              <UploadCloud className="w-3.5 h-3.5 text-cyan-400" />
              <span>Drag & drop Airtable CSV anytime</span>
            </button>

            {/* Quick Auto-Update & CSV Changes Reminder if pending */}
            {(auditResults.length > 0 || recentCsvChanges.length > 0) && (
              <button
                onClick={() => setIsStatusAdjustmentsModalOpen(true)}
                className="flex items-center gap-1.5 text-amber-300 hover:text-amber-200 text-xs font-semibold bg-amber-950/60 px-2.5 py-1 rounded-md border border-amber-800/80 transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                <span>
                  {auditResults.length} automated status adjustment(s) detected for today ({CURRENT_DAY_NAME})
                  {recentCsvChanges.length > 0 ? ` • ${recentCsvChanges.length} CSV status change(s) detected` : ''}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area - Full Screen Width Maximized */}
      <main className="flex-1 w-full px-3 sm:px-5 lg:px-6 py-4">
        {/* Work Week Sheets Switcher Tabs (Separate Sheet for Every Work Week) */}
        <WorkWeekTabs
          workWeeks={workWeeks}
          activeWeekId={activeWeekId}
          onSelectWeek={setActiveWeekId}
          onAddWeekSheet={handleAddWeekSheet}
          onDeleteWeekSheet={handleDeleteWeekSheet}
          projects={activeTabProjects}
        />

        {activeView === 'dispatch' && (
          <DispatchTimesheetMatrix
            projects={displaySchedulingProjects}
            technicians={technicians}
            dateColumns={activeDateColumns}
            currentWeekLabel={activeWeekObj?.label}
            onSelectProject={(p) => setSelectedProject(p)}
            onQuickAddJob={(techName, dayName, eventType) => {
              setAddModalPrefill({
                tech: techName,
                day: dayName as WeekDay,
              });
              setIsAddModalOpen(true);
            }}
            onAssignCODForTech={allowCOD ? handleAssignCODForTech : undefined}
            onOpenAssignCOD={allowCOD ? handleOpenAssignCOD : undefined}
            onUpdateCodListName={handleUpdateCodListName}
            onToggleDayGroup={handleToggleDayGroup}
            allowCOD={allowCOD}
            activeWeekId={activeWeekId}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            onOpenResetSchedule={() => setIsResetScheduleModalOpen(true)}
          />
        )}

        {activeView === 'scheduler' && (
          <SchedulerMatrix
            projects={displaySchedulingProjects}
            technicians={technicians}
            currentRegion={activeRegion}
            dateColumns={activeDateColumns}
            currentWeekLabel={activeWeekObj?.label}
            activeWeekId={activeWeekId}
            onAddTechnician={handleAddTechnician}
            onRemoveTechnician={handleRemoveTechnician}
            onOpenManageTechs={() => {
              setIsManageTechsAddMode(false);
              setIsManageTechsModalOpen(true);
            }}
            onOpenAddTech={() => {
              setIsManageTechsAddMode(true);
              setIsManageTechsModalOpen(true);
            }}
            onAutoPopulateFromSheet={() => setIsAutoPopulateModalOpen(true)}
            autoPopulatePendingCount={autoPopulateResult.totalUpdated}
            onOpenResetSchedule={() => setIsResetScheduleModalOpen(true)}
            onSelectProject={(p) => setSelectedProject(p)}
            onAssignProjectToDay={handleAssignProjectToDay}
            onApplyBatterySwaps={handleApplyBatterySwaps}
            onClearBatterySwaps={handleClearBatterySwaps}
            onAssignCODForTech={allowCOD ? handleAssignCODForTech : undefined}
            onOpenAssignCOD={allowCOD ? handleOpenAssignCOD : undefined}
            onUpdateCodListName={handleUpdateCodListName}
            onToggleDayGroup={handleToggleDayGroup}
            allowCOD={allowCOD}
            searchTerm={searchTerm}
            specialAssignments={specialAssignments}
            onUpdateSpecialAssignmentEquipment={handleUpdateSpecialAssignmentEquipment}
            onSetSpecialAssignment={handleSetSpecialAssignment}
            onRemoveSpecialAssignment={handleRemoveSpecialAssignment}
          />
        )}

        {activeView === 'table' && (
          <MonitoringTable
            projects={displayMonitoringProjects}
            technicians={technicians}
            onSelectProject={(p) => setSelectedProject(p)}
            onUpdateProjectStatus={handleUpdateProjectStatus}
            onUpdateProjectScheduleStatus={handleUpdateProjectScheduleStatus}
            onUpdateProjectVersion={handleUpdateProjectVersion}
            onBulkUpdateProjects={handleBulkUpdateProjects}
            onUpdateProjectInstall={handleUpdateProjectInstall}
            onUpdateProjectTeardown={handleUpdateProjectTeardown}
            onUpdateProjectTech={handleUpdateProjectTech}
            onUpdateProjectEquipment={handleUpdateProjectEquipment}
            onDeleteProject={handleDeleteProject}
            searchTerm={searchTerm}
            onOpenImportModal={() => handleOpenImportModal('monitoring')}
            onAutoPopulateFromSheet={() => setIsAutoPopulateModalOpen(true)}
            autoPopulatePendingCount={autoPopulateResult.totalUpdated}
          />
        )}

        {activeView === 'technicians' && (
          <TechnicianCapacityView
            projects={displaySchedulingProjects}
            technicians={technicians}
            currentRegion={activeRegion}
            onSelectProject={(p) => setSelectedProject(p)}
            onSelectTechDay={handleAssignProjectToDay}
            onAddTechnician={handleAddTechnician}
            onRemoveTechnician={handleRemoveTechnician}
            onOpenManageTechs={() => setActiveView('manage-techs')}
            onAssignCODForTech={allowCOD ? handleAssignCODForTech : undefined}
            allowCOD={allowCOD}
          />
        )}

        {activeView === 'manage-techs' && (
          <ManageTechniciansView
            technicians={technicians}
            projects={activeTabProjects}
            activeRegion={activeRegion}
            existingTechniciansByRegion={techniciansByRegion}
            onUpdateTechnician={handleUpdateTechnician}
            onAddTechnician={handleAddTechnician}
            onRemoveTechnician={handleRemoveTechnician}
            onResetTechnicians={handleResetTechnicians}
            onAssignCODForTech={allowCOD ? handleAssignCODForTech : undefined}
            onBulkImportTechnicians={handleBulkImportTechnicians}
            allowCOD={allowCOD}
          />
        )}
      </main>

      {/* Modals */}
      {selectedProject && (
        <ProjectModal
          project={selectedProject}
          technicians={technicians}
          onClose={() => setSelectedProject(null)}
          onSave={handleSaveProject}
          onDelete={handleDeleteProject}
          allowCOD={allowCOD}
        />
      )}

      {isAddModalOpen && (
        <AddProjectModal
          onClose={() => setIsAddModalOpen(false)}
          onAdd={handleAddProject}
          technicians={technicians}
          defaultTech={addModalPrefill.tech}
          defaultDay={addModalPrefill.day}
          allowCOD={allowCOD}
        />
      )}

      {isAutoStatusModalOpen && (
        <AutomatedStatusModal
          auditResults={auditResults}
          projects={activeTabProjects}
          onClose={() => setIsAutoStatusModalOpen(false)}
          onApplyUpdates={handleApplyAutoUpdates}
        />
      )}

      {isStatusAdjustmentsModalOpen && (
        <StatusAdjustmentsModal
          isOpen={isStatusAdjustmentsModalOpen}
          onClose={() => setIsStatusAdjustmentsModalOpen(false)}
          csvChanges={recentCsvChanges}
          todayAdjustments={auditResults}
          onApplyTodayUpdates={handleApplyAutoUpdates}
        />
      )}

      {codModalConfig && (
        <AssignCODModal
          isOpen={Boolean(codModalConfig)}
          technicianName={codModalConfig.techName}
          installDay={codModalConfig.dayName}
          initialListName={codModalConfig.listName || 'List-107'}
          projects={displaySchedulingProjects}
          allWeekProjects={displaySchedulingProjects}
          onClose={() => setCodModalConfig(null)}
          onAssignCOD={handleApplyCODFromModal}
        />
      )}

      {/* Manage Technicians Modal */}
      {isManageTechsModalOpen && (
        <ManageTechniciansModal
          technicians={technicians}
          projects={activeTabProjects}
          activeRegion={activeRegion}
          existingTechniciansByRegion={techniciansByRegion}
          onClose={() => {
            setIsManageTechsModalOpen(false);
            setIsManageTechsAddMode(false);
          }}
          onAddTechnician={handleAddTechnician}
          onRemoveTechnician={handleRemoveTechnician}
          onResetTechnicians={handleResetTechnicians}
          onBulkImportTechnicians={handleBulkImportTechnicians}
          initialAddNew={isManageTechsAddMode}
        />
      )}

      {/* Auto-Populate from Monitoring Sheet Modal */}
      {isAutoPopulateModalOpen && (
        <AutoPopulateModal
          autoPopulateResult={autoPopulateResult}
          onClose={() => setIsAutoPopulateModalOpen(false)}
          onConfirm={handleApplyAutoPopulate}
        />
      )}

      {/* Clear / Reset Scheduling Matrix & Dispatch Modal */}
      {isResetScheduleModalOpen && (
        <ResetScheduleModal
          isOpen={isResetScheduleModalOpen}
          onClose={() => setIsResetScheduleModalOpen(false)}
          activeRegion={activeRegion}
          activeWeekLabel={activeWeekObj?.label || activeWeekId}
          totalProjectsInWeek={displaySchedulingProjects.length}
          totalProjectsInRegion={schedulingRegionProjects.length}
          onConfirmReset={handleResetScheduling}
        />
      )}

      {/* Airtable CSV Drag & Drop / Import Modal */}
      {isImportModalOpen && (
        <AirtableImportModal
          isOpen={isImportModalOpen}
          targetTab={importModalTargetTab}
          onTargetTabChange={setImportModalTargetTab}
          existingProjects={importModalTargetTab === 'monitoring' ? monitoringRegionProjects : schedulingRegionProjects}
          targetRegion={activeRegion}
          onRegionChange={setActiveRegion}
          onClose={() => {
            setIsImportModalOpen(false);
            setDraggedFile(null);
          }}
          onImportComplete={handleImportProjects}
          onImport={handleImportProjects}
          initialFile={draggedFile}
        />
      )}
    </div>
  );
}

