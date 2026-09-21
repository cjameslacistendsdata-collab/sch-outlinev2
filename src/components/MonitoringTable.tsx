import React, { useState, useMemo } from 'react';
import { Project, OpsStatus, ScheduleStatus, WeekDay, EquipmentType, Technician } from '../types';
import { TECHNICIANS } from '../data/technicians';
import {
  ArrowUpDown,
  Filter,
  CheckSquare,
  Square,
  Edit2,
  FileText,
  AlertTriangle,
  ChevronDown,
  Sparkles,
  ExternalLink,
  UploadCloud,
  X,
  ArrowDownCircle,
  ArrowUpCircle,
  Camera,
  Cog,
  Calendar,
  Trash2,
} from 'lucide-react';
import { evaluateProjectStatus, getOpsStatusBadge } from '../utils/statusEngine';
import { getIndividualTechList, isProjectAssignedToTech } from '../utils/technicianUtils';

interface MonitoringTableProps {
  projects: Project[];
  technicians?: Technician[];
  onAutoPopulateMatrix?: () => void;
  autoPopulatePendingCount?: number;
  onSelectProject: (project: Project) => void;
  onUpdateProjectStatus: (projectId: string, newStatus: OpsStatus) => void;
  onUpdateProjectInstall: (projectId: string, newInstall: WeekDay) => void;
  onUpdateProjectTeardown: (projectId: string, newTeardown: WeekDay) => void;
  onUpdateProjectTech: (projectId: string, newTech: string) => void;
  onUpdateProjectEquipment?: (projectId: string, count: number, type?: EquipmentType) => void;
  onUpdateProjectScheduleStatus?: (projectId: string, newStatus: ScheduleStatus) => void;
  onUpdateProjectVersion?: (projectId: string, newVersion: string) => void;
  onBulkUpdateProjects?: (projectIds: string[], updates: Partial<Project>) => void;
  searchTerm: string;
  syncFilter?: {
    tech?: string | null;
    day?: WeekDay | null;
    projectId?: string | null;
  } | null;
  onClearSyncFilter?: () => void;
  onOpenImportModal?: () => void;
  onDeleteProject?: (projectId: string) => void;
}

type SortField =
  | 'id'
  | 'cityState'
  | 'opsStatus'
  | 'studyType'
  | 'locationsCount'
  | 'equipmentCount'
  | 'installDay'
  | 'teardownDay'
  | 'technician';

export const MonitoringTable: React.FC<MonitoringTableProps> = ({
  projects,
  technicians,
  onAutoPopulateMatrix,
  autoPopulatePendingCount = 0,
  onSelectProject,
  onUpdateProjectStatus,
  onUpdateProjectInstall,
  onUpdateProjectTeardown,
  onUpdateProjectTech,
  onUpdateProjectEquipment,
  onUpdateProjectScheduleStatus,
  onUpdateProjectVersion,
  onBulkUpdateProjects,
  searchTerm,
  syncFilter,
  onClearSyncFilter,
  onOpenImportModal,
  onDeleteProject,
}) => {
  const techList = useMemo(() => getIndividualTechList(projects, technicians), [projects, technicians]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>('id');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [projectToDeleteId, setProjectToDeleteId] = useState<string | null>(null);

  // Filter dropdowns
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [techFilter, setTechFilter] = useState<string>('all');
  const [studyFilter, setStudyFilter] = useState<string>('all');

  // Dynamic study types present across projects
  const availableStudyTypes = useMemo(() => {
    const baseList = ['TMC', 'ATR', 'ATR (Camera)', 'Screenline', 'Video Review', 'LADOTD Annual Counts'];
    const set = new Set<string>(baseList);
    projects.forEach((p) => {
      if (p.studyType && p.studyType.trim()) {
        set.add(p.studyType.trim());
      }
    });
    return Array.from(set);
  }, [projects]);

  // Multi-edit states and tabs
  const [bulkTab, setBulkTab] = useState<'status' | 'scheduleStatus' | 'version' | 'all'>('status');
  const [bulkStatus, setBulkStatus] = useState<OpsStatus | ''>('');
  const [bulkScheduleStatus, setBulkScheduleStatus] = useState<string>('');
  const [bulkVersion, setBulkVersion] = useState<string>('');

  const singleSelectedProject = useMemo(() => {
    if (selectedIds.size !== 1) return null;
    const id = Array.from(selectedIds)[0];
    return projects.find((p) => p.id === id) || null;
  }, [selectedIds, projects]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredAndSortedProjects = useMemo(() => {
    return projects
      .filter((p) => {
        // Sync Filter from Matrix
        if (syncFilter?.tech) {
          const matchesTech = isProjectAssignedToTech(p.technician, syncFilter.tech);
          if (!matchesTech) return false;
        }

        if (syncFilter?.day) {
          const matchesDay = p.installDay === syncFilter.day || p.teardownDay === syncFilter.day;
          if (!matchesDay) return false;
        }

        if (syncFilter?.projectId) {
          if (p.id.toLowerCase() !== syncFilter.projectId.toLowerCase()) {
            return false;
          }
        }

        // Search term
        if (searchTerm) {
          const q = searchTerm.toLowerCase();
          const match =
            p.id.toLowerCase().includes(q) ||
            p.cityState.toLowerCase().includes(q) ||
            p.technician.toLowerCase().includes(q) ||
            p.studyType.toLowerCase().includes(q) ||
            (p.evaluatedBy && p.evaluatedBy.toLowerCase().includes(q)) ||
            (p.schedulerNotes && p.schedulerNotes.toLowerCase().includes(q));
          if (!match) return false;
        }

        // Status Filter
        if (statusFilter !== 'all' && p.opsStatus !== statusFilter) return false;

        // Tech Filter
        if (techFilter !== 'all' && !isProjectAssignedToTech(p.technician, techFilter)) return false;

        // Study Filter
        if (studyFilter !== 'all' && p.studyType !== studyFilter) return false;

        return true;
      })
      .sort((a, b) => {
        let valA: any = a[sortField];
        let valB: any = b[sortField];

        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
  }, [projects, searchTerm, statusFilter, techFilter, studyFilter, sortField, sortDirection, syncFilter]);

  // Handle select all
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredAndSortedProjects.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAndSortedProjects.map((p) => p.id)));
    }
  };

  const toggleSelectRow = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const applyBulkStatus = () => {
    if (!bulkStatus) return;
    if (onBulkUpdateProjects) {
      onBulkUpdateProjects(Array.from(selectedIds), { opsStatus: bulkStatus });
    } else {
      selectedIds.forEach((id) => {
        onUpdateProjectStatus(id, bulkStatus as OpsStatus);
      });
    }
    setSelectedIds(new Set());
    setBulkStatus('');
  };

  const applyBulkScheduleStatus = () => {
    if (!bulkScheduleStatus) return;
    const finalVal = bulkScheduleStatus === '__CLEAR__' ? '' : (bulkScheduleStatus as ScheduleStatus);
    if (onBulkUpdateProjects) {
      onBulkUpdateProjects(Array.from(selectedIds), { scheduleStatus: finalVal });
    } else {
      selectedIds.forEach((id) => {
        onUpdateProjectScheduleStatus?.(id, finalVal);
      });
    }
    setSelectedIds(new Set());
    setBulkScheduleStatus('');
  };

  const applyBulkVersion = () => {
    if (!bulkVersion) return;
    const finalVal = bulkVersion === '__CLEAR__' ? '' : bulkVersion;
    if (onBulkUpdateProjects) {
      onBulkUpdateProjects(Array.from(selectedIds), { version: finalVal });
    } else {
      selectedIds.forEach((id) => {
        onUpdateProjectVersion?.(id, finalVal);
      });
    }
    setSelectedIds(new Set());
    setBulkVersion('');
  };

  const applyBulkAll = () => {
    if (!bulkStatus && !bulkScheduleStatus && !bulkVersion) return;
    const updates: Partial<Project> = {};
    if (bulkStatus) updates.opsStatus = bulkStatus;
    if (bulkScheduleStatus) {
      updates.scheduleStatus = bulkScheduleStatus === '__CLEAR__' ? '' : (bulkScheduleStatus as ScheduleStatus);
    }
    if (bulkVersion) {
      updates.version = bulkVersion === '__CLEAR__' ? '' : bulkVersion;
    }

    if (onBulkUpdateProjects) {
      onBulkUpdateProjects(Array.from(selectedIds), updates);
    } else {
      selectedIds.forEach((id) => {
        if (updates.opsStatus) onUpdateProjectStatus(id, updates.opsStatus);
        if (updates.scheduleStatus !== undefined) onUpdateProjectScheduleStatus?.(id, updates.scheduleStatus);
        if (updates.version !== undefined) onUpdateProjectVersion?.(id, updates.version);
      });
    }
    setSelectedIds(new Set());
    setBulkStatus('');
    setBulkScheduleStatus('');
    setBulkVersion('');
  };

  // Evaluated By badge style
  const getEvaluatedByBadge = (name?: string) => {
    if (!name) return null;
    if (name === 'Patrick') {
      return 'bg-emerald-950/70 text-emerald-300 border border-emerald-700/60';
    }
    if (name === 'Kat') {
      return 'bg-purple-950/70 text-purple-300 border border-purple-700/60';
    }
    if (name === 'Kyle') {
      return 'bg-amber-950/70 text-amber-300 border border-amber-700/60';
    }
    return 'bg-slate-800 text-slate-300 border border-slate-700';
  };

  // Version badge style
  const getVersionBadge = (version: string) => {
    if (version === 'Initial') {
      return 'bg-emerald-800 text-emerald-100 border border-emerald-600';
    }
    if (version === 'V1') {
      return 'bg-rose-900 text-rose-100 border border-rose-600';
    }
    if (version === 'V2') {
      return 'bg-amber-800 text-amber-100 border border-amber-600';
    }
    return 'bg-slate-800 text-slate-200 border border-slate-600';
  };

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 shadow-xl overflow-hidden">
      {/* Table Toolbar & Header Count Badge */}
      <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {/* Prominent count badge */}
          <div className="bg-[#0077cc] text-white px-3.5 py-1.5 rounded-lg font-black text-xl tracking-tight shadow-md border border-cyan-400/30 flex items-center justify-center min-w-[50px]">
            {filteredAndSortedProjects.length}
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-wide uppercase flex items-center gap-2">
              <span>Field Ops Monitoring Master Sheet</span>
              <span className="text-xs font-normal text-slate-400">
                (Showing {filteredAndSortedProjects.length} of {projects.length} jobs)
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Real-time synchronization between scheduler dispatch and operational collection status.
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5 bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-800">
            <span className="text-slate-400">Project Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-slate-900">All Project Statuses</option>
              <option value="All locations installed" className="bg-slate-900">All locations installed</option>
              <option value="Pending QAQC OPS" className="bg-slate-900">Pending QAQC OPS</option>
              <option value="Scheduled to techs" className="bg-slate-900">Scheduled to techs</option>
              <option value="Needs Scheduling" className="bg-slate-900">Needs Scheduling</option>
              <option value="Pending Delivery" className="bg-slate-900">Pending Delivery</option>
              <option value="Delivered" className="bg-slate-900">Delivered</option>
            </select>
          </div>

          {/* Tech Filter */}
          <div className="flex items-center gap-1.5 bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-800">
            <span className="text-slate-400">Tech:</span>
            <select
              value={techFilter}
              onChange={(e) => setTechFilter(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-slate-900">All Technicians</option>
              {techList.map((t) => (
                <option key={t.id} value={t.name} className="bg-slate-900">
                  {t.name}
                </option>
              ))}
              <option value="Unassigned" className="bg-slate-900">Unassigned</option>
            </select>
          </div>

          {/* Study Filter */}
          <div className="flex items-center gap-1.5 bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-800">
            <span className="text-slate-400">Study:</span>
            <select
              value={studyFilter}
              onChange={(e) => setStudyFilter(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-slate-900">All Studies</option>
              {availableStudyTypes.map((st) => (
                <option key={st} value={st} className="bg-slate-900">
                  {st}
                </option>
              ))}
            </select>
          </div>

          {/* Bulk Update Controls if rows selected */}
          {selectedIds.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 bg-slate-900 border border-blue-600/90 text-white px-2.5 py-1.5 rounded-xl shadow-lg animate-in fade-in">
              {/* Selected Count & Quick Deselect */}
              <div className="flex items-center gap-1.5 bg-blue-950 px-2 py-1 rounded-lg border border-blue-700/60 text-blue-200 text-xs font-bold whitespace-nowrap">
                <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
                <span>
                  {singleSelectedProject ? `#${singleSelectedProject.id}` : `${selectedIds.size} selected`}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  title="Clear selection"
                  className="ml-1 text-slate-400 hover:text-white p-0.5 rounded transition-colors cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>

              {/* Action Tabs: Project Status, Schedule Status, Version, All Fields */}
              <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setBulkTab('status')}
                  className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer whitespace-nowrap ${
                    bulkTab === 'status'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Project Status
                </button>
                <button
                  type="button"
                  onClick={() => setBulkTab('scheduleStatus')}
                  className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer whitespace-nowrap ${
                    bulkTab === 'scheduleStatus'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Schedule Status
                </button>
                <button
                  type="button"
                  onClick={() => setBulkTab('version')}
                  className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer whitespace-nowrap ${
                    bulkTab === 'version'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Version
                </button>
                <button
                  type="button"
                  onClick={() => setBulkTab('all')}
                  className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer whitespace-nowrap ${
                    bulkTab === 'all'
                      ? 'bg-cyan-700 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Edit Status, Schedule Status, and Version together"
                >
                  All Fields
                </button>
              </div>

              {/* Tab 1: Project Status */}
              {bulkTab === 'status' && (
                <div className="flex items-center gap-1.5 animate-in fade-in">
                  <select
                    value={bulkStatus}
                    onChange={(e) => setBulkStatus(e.target.value as OpsStatus)}
                    className="bg-slate-950 text-white border border-slate-700 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer"
                  >
                    <option value="" className="bg-slate-900 text-slate-400">
                      {singleSelectedProject ? `Status (Current: ${singleSelectedProject.opsStatus})` : 'Set Status...'}
                    </option>
                    <option value="All locations installed" className="bg-slate-900">All locations installed</option>
                    <option value="Pending QAQC OPS" className="bg-slate-900 text-emerald-300">Pending QAQC OPS</option>
                    <option value="Scheduled to techs" className="bg-slate-900 text-amber-300">Scheduled to techs</option>
                    <option value="Needs Scheduling" className="bg-slate-900 text-rose-300">Needs Scheduling</option>
                    <option value="Pending Delivery" className="bg-slate-900 text-blue-300">Pending Delivery</option>
                    <option value="Delivered" className="bg-slate-900 text-teal-300">Delivered</option>
                  </select>
                  <button
                    type="button"
                    onClick={applyBulkStatus}
                    disabled={!bulkStatus}
                    className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold px-3 py-1 rounded-lg text-xs transition-colors shadow-sm cursor-pointer"
                  >
                    Apply
                  </button>
                </div>
              )}

              {/* Tab 2: Schedule Status */}
              {bulkTab === 'scheduleStatus' && (
                <div className="flex items-center gap-1.5 animate-in fade-in">
                  <select
                    value={bulkScheduleStatus}
                    onChange={(e) => setBulkScheduleStatus(e.target.value)}
                    className="bg-slate-950 text-white border border-slate-700 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400 cursor-pointer"
                  >
                    <option value="" className="bg-slate-900 text-slate-400">
                      {singleSelectedProject ? `Schedule (Current: ${singleSelectedProject.scheduleStatus || 'Blank'})` : 'Set Schedule Status...'}
                    </option>
                    <option value="SCHEDULE SENT" className="bg-slate-900 text-emerald-300 font-bold">SCHEDULE SENT</option>
                    <option value="PENDING" className="bg-slate-900 text-rose-300 font-bold">PENDING</option>
                    <option value="__CLEAR__" className="bg-slate-900 text-slate-400">— Clear (Blank) —</option>
                  </select>
                  <button
                    type="button"
                    onClick={applyBulkScheduleStatus}
                    disabled={!bulkScheduleStatus}
                    className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold px-3 py-1 rounded-lg text-xs transition-colors shadow-sm cursor-pointer"
                  >
                    Apply
                  </button>
                </div>
              )}

              {/* Tab 3: Version */}
              {bulkTab === 'version' && (
                <div className="flex items-center gap-1.5 animate-in fade-in">
                  <select
                    value={bulkVersion}
                    onChange={(e) => setBulkVersion(e.target.value)}
                    className="bg-slate-950 text-white border border-slate-700 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-purple-400 cursor-pointer"
                  >
                    <option value="" className="bg-slate-900 text-slate-400">
                      {singleSelectedProject ? `Version (Current: ${singleSelectedProject.version || 'Blank'})` : 'Set Version...'}
                    </option>
                    <option value="INITIAL" className="bg-slate-900 text-emerald-300 font-bold">INITIAL</option>
                    <option value="v1" className="bg-slate-900 text-rose-300 font-bold">v1</option>
                    <option value="v2" className="bg-slate-900 text-amber-300 font-bold">v2</option>
                    <option value="v3" className="bg-slate-900 text-blue-300 font-bold">v3</option>
                    <option value="v4" className="bg-slate-900 text-purple-300 font-bold">v4</option>
                    <option value="v5" className="bg-slate-900 text-cyan-300 font-bold">v5</option>
                    <option value="v6" className="bg-slate-900 text-teal-300 font-bold">v6</option>
                    <option value="__CLEAR__" className="bg-slate-900 text-slate-400">— Clear (Blank) —</option>
                  </select>
                  <button
                    type="button"
                    onClick={applyBulkVersion}
                    disabled={!bulkVersion}
                    className="bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-bold px-3 py-1 rounded-lg text-xs transition-colors shadow-sm cursor-pointer"
                  >
                    Apply
                  </button>
                </div>
              )}

              {/* Tab 4: All Fields (Combined) */}
              {bulkTab === 'all' && (
                <div className="flex items-center gap-1.5 flex-wrap animate-in fade-in">
                  <select
                    value={bulkStatus}
                    onChange={(e) => setBulkStatus(e.target.value as OpsStatus)}
                    className="bg-slate-950 text-white border border-slate-700 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-400 cursor-pointer"
                  >
                    <option value="" className="bg-slate-900 text-slate-400">Status: (No change)</option>
                    <option value="All locations installed" className="bg-slate-900">All locations installed</option>
                    <option value="Pending QAQC OPS" className="bg-slate-900 text-emerald-300">Pending QAQC OPS</option>
                    <option value="Scheduled to techs" className="bg-slate-900 text-amber-300">Scheduled to techs</option>
                    <option value="Needs Scheduling" className="bg-slate-900 text-rose-300">Needs Scheduling</option>
                    <option value="Pending Delivery" className="bg-slate-900 text-blue-300">Pending Delivery</option>
                    <option value="Delivered" className="bg-slate-900 text-teal-300">Delivered</option>
                  </select>
                  <select
                    value={bulkScheduleStatus}
                    onChange={(e) => setBulkScheduleStatus(e.target.value)}
                    className="bg-slate-950 text-white border border-slate-700 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-400 cursor-pointer"
                  >
                    <option value="" className="bg-slate-900 text-slate-400">Schedule: (No change)</option>
                    <option value="SCHEDULE SENT" className="bg-slate-900 text-emerald-300 font-bold">SCHEDULE SENT</option>
                    <option value="PENDING" className="bg-slate-900 text-rose-300 font-bold">PENDING</option>
                    <option value="__CLEAR__" className="bg-slate-900 text-slate-400">— Clear (Blank) —</option>
                  </select>
                  <select
                    value={bulkVersion}
                    onChange={(e) => setBulkVersion(e.target.value)}
                    className="bg-slate-950 text-white border border-slate-700 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-400 cursor-pointer"
                  >
                    <option value="" className="bg-slate-900 text-slate-400">Version: (No change)</option>
                    <option value="INITIAL" className="bg-slate-900 text-emerald-300 font-bold">INITIAL</option>
                    <option value="v1" className="bg-slate-900 text-rose-300 font-bold">v1</option>
                    <option value="v2" className="bg-slate-900 text-amber-300 font-bold">v2</option>
                    <option value="v3" className="bg-slate-900 text-blue-300 font-bold">v3</option>
                    <option value="v4" className="bg-slate-900 text-purple-300 font-bold">v4</option>
                    <option value="v5" className="bg-slate-900 text-cyan-300 font-bold">v5</option>
                    <option value="v6" className="bg-slate-900 text-teal-300 font-bold">v6</option>
                    <option value="__CLEAR__" className="bg-slate-900 text-slate-400">— Clear (Blank) —</option>
                  </select>
                  <button
                    type="button"
                    onClick={applyBulkAll}
                    disabled={!bulkStatus && !bulkScheduleStatus && !bulkVersion}
                    className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white font-bold px-3 py-1 rounded-lg text-xs transition-colors shadow-sm cursor-pointer"
                  >
                    Apply All
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Auto-Populate Scheduler Matrix from Monitoring Sheet Button */}
          {onAutoPopulateMatrix && (
            <button
              onClick={onAutoPopulateMatrix}
              title="Synchronize and auto-populate Scheduler Matrix slots from Monitoring Sheet records"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-lg shadow-md transition-all cursor-pointer text-xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-200" />
              <span>Auto-Populate Scheduler Matrix</span>
              {autoPopulatePendingCount > 0 && (
                <span
                  className="bg-white text-slate-900 font-mono text-[10px] px-1.5 py-0.5 rounded-full font-black"
                  style={{ color: '#0f172a', backgroundColor: '#ffffff' }}
                >
                  {autoPopulatePendingCount}
                </span>
              )}
            </button>
          )}

          {/* Quick Import Airtable CSV button */}
          {onOpenImportModal && (
            <button
              onClick={onOpenImportModal}
              title="Upload / Drag Airtable CSV"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-cyan-300 hover:text-cyan-200 font-semibold rounded-lg border border-slate-700 transition-colors"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Import Airtable CSV</span>
            </button>
          )}
        </div>
      </div>

      {/* Synchronized Filter with Scheduler Matrix Banner */}
      {syncFilter && (syncFilter.tech || syncFilter.day || syncFilter.projectId) && (
        <div className="bg-amber-950/40 border-b border-amber-800/80 px-4 py-2.5 flex items-center justify-between text-xs text-amber-300 animate-in fade-in">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold flex items-center gap-1.5 text-amber-400">
              <Sparkles className="w-3.5 h-3.5" /> Synchronized with Scheduler Matrix:
            </span>
            {syncFilter.tech && (
              <span className="bg-slate-900 border border-slate-700 px-2 py-0.5 rounded text-white font-semibold">
                Tech: {syncFilter.tech}
              </span>
            )}
            {syncFilter.day && (
              <span className="bg-slate-900 border border-slate-700 px-2 py-0.5 rounded text-cyan-300 font-semibold">
                Day: {syncFilter.day}
              </span>
            )}
            {syncFilter.projectId && (
              <span className="bg-slate-900 border border-slate-700 px-2 py-0.5 rounded text-amber-300 font-mono font-bold">
                Study #{syncFilter.projectId}
              </span>
            )}
            <span className="text-slate-400 text-[11px]">
              (Showing {filteredAndSortedProjects.length} of {projects.length} jobs)
            </span>
          </div>

          <button
            onClick={onClearSyncFilter}
            className="flex items-center gap-1 text-xs text-amber-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-amber-700/60 px-2.5 py-1 rounded-md transition-colors font-semibold"
          >
            <X className="w-3 h-3" />
            <span>Show All Jobs</span>
          </button>
        </div>
      )}

      {/* Main Monitoring Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs min-w-[1200px]">
          {/* Table Header */}
          <thead className="bg-[#0b3b60] text-white border-b border-blue-900 font-semibold tracking-wide select-none sticky top-0 z-10">
            <tr>
              <th className="p-2.5 w-10 text-center">
                <button onClick={toggleSelectAll} className="hover:text-cyan-300">
                  {selectedIds.size === filteredAndSortedProjects.length && filteredAndSortedProjects.length > 0 ? (
                    <CheckSquare className="w-4 h-4 text-cyan-300" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400" />
                  )}
                </button>
              </th>

              <th
                onClick={() => handleSort('id')}
                className="p-2.5 cursor-pointer hover:bg-blue-900/60 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span>Project #</span>
                  <ArrowUpDown className="w-3 h-3 text-cyan-300" />
                </div>
              </th>

              <th
                onClick={() => handleSort('cityState')}
                className="p-2.5 cursor-pointer hover:bg-blue-900/60 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span>City, State</span>
                  <ArrowUpDown className="w-3 h-3 text-cyan-300" />
                </div>
              </th>

              <th
                onClick={() => handleSort('opsStatus')}
                className="p-2.5 cursor-pointer hover:bg-blue-900/60 transition-colors min-w-[170px]"
              >
                <div className="flex items-center gap-1.5">
                  <span>PROJECT STATUS</span>
                  <ArrowUpDown className="w-3 h-3 text-cyan-300" />
                </div>
              </th>

              <th className="p-2.5 min-w-[140px]">SCHEDULE STATUS</th>
              <th className="p-2.5 text-center">VERSION</th>
              <th className="p-2.5 whitespace-nowrap" title="Date Sent synced with Ops Audit Date from CSV file">
                <div className="flex items-center gap-1">
                  <span>DATE SENT</span>
                  <span className="text-[10px] font-normal text-cyan-200">/ OPS AUDIT</span>
                </div>
              </th>

              <th
                onClick={() => handleSort('studyType')}
                className="p-2.5 cursor-pointer hover:bg-blue-900/60 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span>Study</span>
                  <ArrowUpDown className="w-3 h-3 text-cyan-300" />
                </div>
              </th>

              <th
                onClick={() => handleSort('locationsCount')}
                className="p-2.5 text-center cursor-pointer hover:bg-blue-900/60 transition-colors"
              >
                <div className="flex items-center justify-center gap-1">
                  <span>Locations</span>
                  <ArrowUpDown className="w-3 h-3 text-cyan-300" />
                </div>
              </th>

              <th
                onClick={() => handleSort('equipmentCount')}
                className="p-2.5 text-center cursor-pointer hover:bg-blue-900/60 transition-colors"
              >
                <div className="flex items-center justify-center gap-1">
                  <span>Equipment</span>
                  <ArrowUpDown className="w-3 h-3 text-cyan-300" />
                </div>
              </th>

              <th className="p-2.5" title="Collection Date (OPS) - Reference for Install Date is 1 day before this date">
                <div className="flex items-center gap-1">
                  <span>Collection Date (OPS)</span>
                </div>
              </th>
              <th className="p-2.5 text-emerald-300 bg-emerald-950/40 border-x border-emerald-800/40">
                <div className="flex items-center gap-1">
                  <ArrowDownCircle className="w-3.5 h-3.5 text-emerald-400" />
                  <span>INSTALL</span>
                </div>
              </th>
              <th className="p-2.5 text-violet-300 bg-violet-950/40 border-x border-violet-800/40">
                <div className="flex items-center gap-1">
                  <ArrowUpCircle className="w-3.5 h-3.5 text-violet-400" />
                  <span>TEARDOWN</span>
                </div>
              </th>

              <th
                onClick={() => handleSort('technician')}
                className="p-2.5 cursor-pointer hover:bg-blue-900/60 transition-colors min-w-[140px]"
              >
                <div className="flex items-center gap-1.5">
                  <span>Technician</span>
                  <ArrowUpDown className="w-3 h-3 text-cyan-300" />
                </div>
              </th>

              <th className="p-2.5 text-center">Actions</th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-slate-800">
            {filteredAndSortedProjects.map((project) => {
              const isSelected = selectedIds.has(project.id);
              const badge = getOpsStatusBadge(project.opsStatus);
              const audit = evaluateProjectStatus(project);
              const isSyncHighlighted = syncFilter?.projectId === project.id;

              return (
                <tr
                  key={project.id}
                  className={`hover:bg-slate-800/60 transition-colors ${
                    isSyncHighlighted
                      ? 'bg-amber-950/40 ring-2 ring-amber-400 ring-inset'
                      : isSelected
                      ? 'bg-cyan-950/20'
                      : 'bg-slate-900/40'
                  }`}
                >
                  {/* Select Checkbox */}
                  <td className="p-2.5 text-center">
                    <button
                      onClick={() => toggleSelectRow(project.id)}
                      className="text-slate-400 hover:text-cyan-300"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-cyan-400" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </td>

                  {/* Project # */}
                  <td className="p-2.5 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                    <button
                      onClick={() => onSelectProject(project)}
                      className="text-slate-900 dark:text-white hover:text-cyan-600 dark:hover:text-cyan-300 hover:underline flex items-center gap-1.5"
                    >
                      <span>{project.id}</span>
                      {audit && (
                        <span
                          title={`Suggested Update: ${audit.suggestedStatus} (${audit.reason})`}
                          className="inline-block"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 animate-pulse" />
                        </span>
                      )}
                    </button>
                  </td>

                  {/* City, State */}
                  <td className="p-2.5 text-slate-800 dark:text-slate-300 whitespace-nowrap font-medium">
                    {project.cityState || '—'}
                  </td>

                  {/* PROJECT STATUS with direct inline selector */}
                  <td className="p-2.5">
                    <div className="relative inline-block w-full">
                      <select
                        value={project.opsStatus}
                        onChange={(e) =>
                          onUpdateProjectStatus(project.id, e.target.value as OpsStatus)
                        }
                        className={`w-full appearance-none pl-2.5 pr-6 py-1 rounded text-xs font-semibold border cursor-pointer focus:outline-none focus:ring-1 focus:ring-cyan-400 transition-all ${badge?.bg || 'bg-slate-800/80'} ${badge?.text || 'text-slate-200'} ${badge?.border || 'border-slate-700'}`}
                      >
                        {/* Always include imported / custom status so it is aligned with imported CSV */}
                        {project.opsStatus &&
                          !['All locations installed', 'Pending QAQC OPS', 'Scheduled to techs', 'Needs Scheduling', 'Pending Delivery', 'Delivered'].includes(project.opsStatus) && (
                            <option value={project.opsStatus} className="bg-slate-900 text-cyan-300 font-bold">
                              {project.opsStatus}
                            </option>
                          )}
                        <option value="All locations installed" className="bg-slate-900 text-slate-200">
                          All locations installed
                        </option>
                        <option value="Pending QAQC OPS" className="bg-slate-900 text-emerald-300">
                          Pending QAQC OPS
                        </option>
                        <option value="Scheduled to techs" className="bg-slate-900 text-amber-300">
                          Scheduled to techs
                        </option>
                        <option value="Needs Scheduling" className="bg-slate-900 text-rose-300">
                          Needs Scheduling
                        </option>
                        <option value="Pending Delivery" className="bg-slate-900 text-blue-300">
                          Pending Delivery
                        </option>
                        <option value="Delivered" className="bg-slate-900 text-teal-300">
                          Delivered
                        </option>
                      </select>
                      <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </td>

                  {/* SCHEDULE STATUS (Dropdown: SCHEDULE SENT, PENDING, or Blank) */}
                  <td className="p-2.5 whitespace-nowrap">
                    <div className="relative inline-block min-w-[135px]">
                      <select
                        value={project.scheduleStatus || ''}
                        onChange={(e) =>
                          onUpdateProjectScheduleStatus?.(project.id, e.target.value as ScheduleStatus)
                        }
                        className={`w-full appearance-none pl-2 pr-6 py-1 rounded text-xs font-bold border cursor-pointer focus:outline-none transition-all ${
                          project.scheduleStatus === 'SCHEDULE SENT' || project.scheduleStatus === 'Schedule Sent'
                            ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                            : project.scheduleStatus === 'PENDING' || project.scheduleStatus === 'Pending'
                            ? 'bg-rose-950/80 text-rose-300 border-rose-700/60'
                            : 'bg-slate-900/80 text-slate-400 border-slate-700/60'
                        }`}
                      >
                        <option value="" className="bg-slate-900 text-slate-400">— Blank —</option>
                        <option value="SCHEDULE SENT" className="bg-slate-900 text-emerald-300 font-bold">SCHEDULE SENT</option>
                        <option value="PENDING" className="bg-slate-900 text-rose-300 font-bold">PENDING</option>
                      </select>
                      <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </td>

                  {/* VERSION (Dropdown: INITIAL, v1, v2, v3, v4, v5, v6, or Blank) */}
                  <td className="p-2.5 text-center">
                    <div className="relative inline-block min-w-[80px]">
                      <select
                        value={project.version || ''}
                        onChange={(e) =>
                          onUpdateProjectVersion?.(project.id, e.target.value)
                        }
                        className="w-full appearance-none pl-2 pr-5 py-1 rounded text-xs font-bold border border-slate-700 bg-slate-800 text-slate-200 cursor-pointer focus:outline-none"
                      >
                        <option value="" className="bg-slate-900 text-slate-400">—</option>
                        <option value="INITIAL" className="bg-slate-900 text-emerald-300">INITIAL</option>
                        <option value="v1" className="bg-slate-900 text-rose-300">v1</option>
                        <option value="v2" className="bg-slate-900 text-amber-300">v2</option>
                        <option value="v3" className="bg-slate-900 text-blue-300">v3</option>
                        <option value="v4" className="bg-slate-900 text-purple-300">v4</option>
                        <option value="v5" className="bg-slate-900 text-cyan-300">v5</option>
                        <option value="v6" className="bg-slate-900 text-teal-300">v6</option>
                      </select>
                      <ChevronDown className="w-2.5 h-2.5 text-slate-400 absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </td>

                  {/* DATE SENT (Synced with Ops Audit Date from CSV) */}
                  <td className="p-2.5 text-slate-800 dark:text-slate-300 whitespace-nowrap text-xs font-mono">
                    <button
                      onClick={() => onSelectProject(project)}
                      title="Click to edit Date Sent (synced with CSV Ops Audit Date)"
                      className="hover:text-cyan-600 dark:hover:text-cyan-300 hover:underline cursor-pointer font-medium"
                    >
                      {project.dateSent || project.opsAuditDate || '—'}
                    </button>
                  </td>

                  {/* Study */}
                  <td className="p-2.5 whitespace-nowrap">
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-900 dark:text-slate-200">
                        {project.studyType}
                      </span>
                      {project.serviceTypeAddOns && (
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[140px]" title={project.serviceTypeAddOns}>
                          {project.serviceTypeAddOns}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* No. of Locations */}
                  <td className="p-2.5 text-center font-mono font-bold text-slate-900 dark:text-slate-300">
                    {project.locationsCount}
                  </td>

                  {/* No. of Equipment (Interactive - bases number of equipment needed on monitoring sheet) */}
                  <td className="p-2.5 text-center font-mono font-bold">
                    <div className="inline-flex items-center justify-center gap-1">
                      <input
                        type="number"
                        step="any"
                        min={0}
                        max={999}
                        value={project.equipmentCount}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          onUpdateProjectEquipment?.(project.id, isNaN(val) ? 0 : Math.round(val));
                        }}
                        title="Set equipment needed for this project (synchronizes with dispatch scheduler & technician fleet)"
                        className="w-12 text-center bg-slate-800/90 border border-slate-700/80 rounded px-1 py-0.5 text-xs font-bold text-amber-600 dark:text-amber-300 focus:outline-none focus:ring-1 focus:ring-amber-400 focus:border-amber-400 hover:border-slate-500"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const currentType =
                            project.equipmentType ||
                            (project.studyType === 'ATR' ? 'Machine' : 'Camera');
                          const nextType = currentType === 'Camera' ? 'Machine' : 'Camera';
                          onUpdateProjectEquipment?.(project.id, project.equipmentCount, nextType);
                        }}
                        title={`Equipment Type: ${
                          project.equipmentType || (project.studyType === 'ATR' ? 'Machine' : 'Camera')
                        }. Click to toggle Camera/Machine`}
                        className="p-1 rounded hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors text-xs shrink-0"
                      >
                        {project.equipmentType === 'Machine' || project.studyType === 'ATR' ? (
                          <Cog className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        ) : (
                          <Camera className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                        )}
                      </button>
                    </div>
                  </td>

                  {/* Collection Window */}
                  <td className="p-2.5 text-slate-800 dark:text-slate-300 whitespace-nowrap text-[11px] font-medium">
                    {project.collectionWindow}
                  </td>

                  {/* Install Day Dropdown pill: GREEN */}
                  <td className="p-2.5 bg-emerald-950/20 border-x border-emerald-900/30">
                    <div className="flex items-center gap-1">
                      <ArrowDownCircle className="w-3 h-3 text-emerald-400 shrink-0" />
                      <select
                        value={project.installDay}
                        onChange={(e) =>
                          onUpdateProjectInstall(project.id, e.target.value as WeekDay)
                        }
                        title="Install Day (Green) - Removes equipment from technician stock"
                        className="bg-emerald-950/90 text-emerald-200 border border-emerald-600/80 rounded px-2 py-0.5 text-xs font-bold focus:outline-none cursor-pointer hover:border-emerald-400 shadow-sm"
                      >
                        <option value="" className="bg-slate-900 text-slate-400">
                          None
                        </option>
                        <option value="Sunday" className="bg-slate-900 text-emerald-300">Sunday (Start)</option>
                        <option value="Monday" className="bg-slate-900 text-emerald-300">Monday</option>
                        <option value="Tuesday" className="bg-slate-900 text-emerald-300">Tuesday</option>
                        <option value="Wednesday" className="bg-slate-900 text-emerald-300">Wednesday</option>
                        <option value="Thursday" className="bg-slate-900 text-emerald-300">Thursday</option>
                        <option value="Friday" className="bg-slate-900 text-emerald-300">Friday</option>
                        <option value="Saturday" className="bg-slate-900 text-emerald-300">Saturday</option>
                        <option value="Sunday" className="bg-slate-900 text-emerald-300">Sunday (End)</option>
                      </select>
                    </div>
                  </td>

                  {/* Teardown Day Dropdown pill: VIOLET */}
                  <td className="p-2.5 bg-violet-950/20 border-x border-violet-900/30">
                    <div className="flex items-center gap-1">
                      <ArrowUpCircle className="w-3 h-3 text-violet-400 shrink-0" />
                      <select
                        value={project.teardownDay}
                        onChange={(e) =>
                          onUpdateProjectTeardown(project.id, e.target.value as WeekDay)
                        }
                        title="Teardown Day (Violet) based on Monitoring Sheet 'TEARDOWN' - Returns equipment back to technician stock"
                        className="bg-violet-950/90 text-violet-200 border border-violet-600/80 rounded px-2 py-0.5 text-xs font-bold focus:outline-none cursor-pointer hover:border-violet-400 shadow-sm"
                      >
                        <option value="" className="bg-slate-900 text-slate-400">
                          None
                        </option>
                        <option value="Sunday" className="bg-slate-900 text-violet-300">Sunday (Start)</option>
                        <option value="Monday" className="bg-slate-900 text-violet-300">Monday</option>
                        <option value="Tuesday" className="bg-slate-900 text-violet-300">Tuesday</option>
                        <option value="Wednesday" className="bg-slate-900 text-violet-300">Wednesday</option>
                        <option value="Thursday" className="bg-slate-900 text-violet-300">Thursday</option>
                        <option value="Friday" className="bg-slate-900 text-violet-300">Friday</option>
                        <option value="Saturday" className="bg-slate-900 text-violet-300">Saturday</option>
                        <option value="Sunday" className="bg-slate-900 text-violet-300">Sunday (End)</option>
                      </select>
                    </div>
                  </td>

                  {/* Technician Dropdown */}
                  <td className="p-2.5">
                    <select
                      value={project.technician}
                      onChange={(e) => onUpdateProjectTech(project.id, e.target.value)}
                      className={`w-full bg-slate-800 text-slate-900 dark:text-slate-200 font-medium border border-slate-700 rounded px-2 py-0.5 text-xs focus:outline-none cursor-pointer ${
                        project.technician === 'Unassigned'
                          ? 'text-rose-600 dark:text-rose-400 font-bold border-rose-800'
                          : ''
                      }`}
                    >
                      <option value="Unassigned" className="bg-slate-900 text-rose-400">
                        Unassigned
                      </option>
                      {techList.map((t) => (
                        <option key={t.id} value={t.name} className="bg-slate-900 text-white">
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Actions */}
                  <td className="p-2.5 text-center whitespace-nowrap">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => onSelectProject(project)}
                        className="p-1 rounded bg-slate-800 hover:bg-cyan-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                        title="Inspect & Edit Notes"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {onDeleteProject && (
                        <button
                          onClick={() => {
                            if (projectToDeleteId === project.id) {
                              onDeleteProject(project.id);
                              setProjectToDeleteId(null);
                            } else {
                              setProjectToDeleteId(project.id);
                            }
                          }}
                          className={`p-1 rounded transition-colors cursor-pointer ${
                            projectToDeleteId === project.id
                              ? 'bg-rose-600 text-white font-bold text-[10px] px-1.5'
                              : 'bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-rose-300'
                          }`}
                          title={projectToDeleteId === project.id ? 'Click to confirm delete' : 'Delete Job'}
                        >
                          {projectToDeleteId === project.id ? 'Confirm?' : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
