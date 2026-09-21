import React from 'react';
import {
  Calendar,
  Table as TableIcon,
  Users,
  Sparkles,
  Plus,
  Download,
  Search,
  CheckCircle2,
  Clock,
  Layers,
  Wrench,
  AlertCircle,
  UploadCloud,
  Sun,
  Moon,
  UserCog,
  MapPin,
  ChevronDown,
} from 'lucide-react';
import { CURRENT_DAY_NAME, CURRENT_DATE_STR, CURRENT_FORMATTED_DATE } from '../utils/statusEngine';
import { RegionName, REGIONS } from '../types';

export type AppView = 'dispatch' | 'scheduler' | 'table' | 'technicians' | 'manage-techs';

interface HeaderProps {
  activeView: AppView;
  onViewChange: (view: AppView) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  pendingUpdatesCount: number;
  onOpenAutoStatus: () => void;
  onOpenAddProject: () => void;
  onOpenImportCSV: () => void;
  onExportCSV: () => void;
  totalProjects: number;
  totalEquipment: number;
  activeInField: number;
  teardownsToday: number;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
  refDateLabel?: string;
  activeCycleLabel?: string;
  refDate?: string;
  onRefDateChange?: (date: string) => void;
  activeRegion: RegionName;
  onRegionChange: (region: RegionName) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeView,
  onViewChange,
  searchTerm,
  onSearchChange,
  pendingUpdatesCount,
  onOpenAutoStatus,
  onOpenAddProject,
  onOpenImportCSV,
  onExportCSV,
  totalProjects,
  totalEquipment,
  activeInField,
  teardownsToday,
  theme = 'dark',
  onToggleTheme,
  refDateLabel,
  activeCycleLabel,
  refDate,
  onRefDateChange,
  activeRegion,
  onRegionChange,
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-slate-100 sticky top-0 z-30 shadow-md">
      {/* Top Banner with branding & live metrics - Full screen width */}
      <div className="w-full px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Logo and title */}
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center shadow-md shadow-cyan-900/30 font-bold text-white tracking-wider text-sm border border-cyan-400/30">
              NDS
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Field Ops Monitoring & Dispatch Scheduler
                </h1>
              </div>
              <div className="flex items-center flex-wrap gap-2.5 mt-2">
                {/* REGION SELECTION DROPDOWN */}
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-950/90 border-2 border-blue-500 text-xs shadow-md shadow-blue-950/40">
                  <MapPin className="w-4 h-4 text-blue-400 shrink-0 animate-pulse" />
                  <span className="text-blue-200 font-black uppercase tracking-wider text-[11px]">REGION:</span>
                  <div className="relative flex items-center">
                    <select
                      id="select-region"
                      value={activeRegion}
                      onChange={(e) => onRegionChange(e.target.value as RegionName)}
                      aria-label="Select Operational Region"
                      className="appearance-none bg-slate-900/90 text-white font-extrabold tracking-wide text-xs pl-2.5 pr-7 py-1 rounded border border-blue-400/80 focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer shadow-inner"
                    >
                      {REGIONS.map((r) => (
                        <option key={r} value={r} className="bg-slate-900 text-white font-bold py-1">
                          {r}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-blue-300 absolute right-2 pointer-events-none" />
                  </div>
                </div>

                {/* Ref Date: Equal to current date (static display, no calendar picker) */}
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950/90 border border-cyan-500/50 text-xs shadow-sm">
                  <Calendar className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 shrink-0" />
                  <span className="text-slate-700 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">REF DATE:</span>
                  <span className="text-cyan-800 dark:text-cyan-200 font-bold font-mono tracking-wide text-xs">
                    {refDateLabel || `${CURRENT_FORMATTED_DATE} (${CURRENT_DAY_NAME})`}
                  </span>
                </div>

                {/* WORK WEEK: Derived dynamically from Ref Date */}
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950/90 border border-emerald-500/50 text-xs shadow-sm">
                  <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="text-slate-700 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">WORK WEEK:</span>
                  <strong className="text-emerald-800 dark:text-emerald-200 font-bold tracking-wide font-mono">
                    {activeCycleLabel || 'Work Week 37 • Sep 6 - Sep 12'}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-4 text-xs">
            <div className="flex items-center gap-2 bg-slate-800/90 px-3 py-1.5 rounded-lg border border-slate-700/70">
              <Layers className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span className="text-slate-700 dark:text-slate-400 font-medium">Total Jobs:</span>
              <span className="font-bold text-slate-900 dark:text-white text-sm">{totalProjects}</span>
            </div>
            <div className="flex items-center gap-2 bg-slate-800/90 px-3 py-1.5 rounded-lg border border-slate-700/70">
              <Wrench className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span className="text-slate-700 dark:text-slate-400 font-medium">Equipment:</span>
              <span className="font-bold text-slate-900 dark:text-white text-sm">{totalEquipment} units</span>
            </div>
            <div className="flex items-center gap-2 bg-slate-800/90 px-3 py-1.5 rounded-lg border border-slate-700/70">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="text-slate-700 dark:text-slate-400 font-medium">In Field:</span>
              <span className="font-bold text-slate-900 dark:text-white text-sm">{activeInField}</span>
            </div>
            {teardownsToday > 0 && (
              <div className="flex items-center gap-2 bg-rose-950/80 px-3 py-1.5 rounded-lg border border-rose-800/80 text-rose-300">
                <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 animate-pulse" />
                <span className="text-rose-900 dark:text-rose-300 font-medium">Teardown Today:</span>
                <span className="font-bold text-rose-950 dark:text-white text-sm">{teardownsToday}</span>
              </div>
            )}
          </div>

          {/* Primary Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              id="btn-import-airtable-csv"
              onClick={onOpenImportCSV}
              title="Drag & drop or upload CSV exported from Airtable"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white shadow-sm transition-all border border-cyan-400/40"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Import Airtable CSV</span>
            </button>

            <button
              id="btn-auto-status-updates"
              onClick={onOpenAutoStatus}
              className={`relative inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all border ${
                pendingUpdatesCount > 0
                  ? 'bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 border-amber-300 ring-2 ring-amber-500/20'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
            >
              <Sparkles className={`w-3.5 h-3.5 ${pendingUpdatesCount > 0 ? 'text-slate-950 animate-bounce' : 'text-amber-400'}`} />
              <span>Automated Status Sync</span>
              {pendingUpdatesCount > 0 && (
                <span className="inline-flex items-center justify-center px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-slate-950 text-amber-300">
                  {pendingUpdatesCount}
                </span>
              )}
            </button>

            <button
              id="btn-add-new-project"
              onClick={onOpenAddProject}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition-all border border-blue-400/40"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Job</span>
            </button>

            <button
              id="btn-export-csv"
              onClick={onExportCSV}
              title="Export monitoring data to CSV"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export</span>
            </button>

            {/* Dark / Light Mode Toggle Button */}
            {onToggleTheme && (
              <button
                id="btn-theme-toggle"
                onClick={onToggleTheme}
                title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all shadow-sm hover:border-slate-500"
              >
                {theme === 'dark' ? (
                  <>
                    <Sun className="w-3.5 h-3.5 text-amber-400" />
                    <span className="hidden sm:inline">Light</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="hidden sm:inline">Dark</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* View Switcher and Search Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-3 pt-3 border-t border-slate-800">
          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800/80 overflow-x-auto">
            <button
              id="nav-tab-dispatch"
              onClick={() => onViewChange('dispatch')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                activeView === 'dispatch'
                  ? 'bg-blue-600 text-white shadow-sm font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-cyan-300" />
              <span>Dispatch & Timesheet</span>
            </button>

            <button
              id="nav-tab-scheduler"
              onClick={() => onViewChange('scheduler')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                activeView === 'scheduler'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Scheduler Matrix</span>
            </button>

            <button
              id="nav-tab-table"
              onClick={() => onViewChange('table')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                activeView === 'table'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Monitoring Sheet</span>
            </button>

            <button
              id="nav-tab-technicians"
              onClick={() => onViewChange('technicians')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                activeView === 'technicians'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Technicians Workload</span>
            </button>

            <button
              id="nav-tab-manage-techs"
              onClick={() => onViewChange('manage-techs')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                activeView === 'manage-techs'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <UserCog className="w-3.5 h-3.5 text-amber-300" />
              <span>Manage Technicians</span>
            </button>
          </nav>

          {/* Global Search Input */}
          <div className="relative min-w-[240px] max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="input-global-search"
              type="text"
              placeholder="Search Project #, City, Tech, Study..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700/80 rounded-lg pl-9 pr-3.5 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition-all"
            />
          </div>
        </div>
      </div>
    </header>
  );
};
