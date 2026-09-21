import React, { useState } from 'react';
import { RotateCcw, AlertTriangle, X, Check, Trash2, Calendar, FileSpreadsheet } from 'lucide-react';
import { RegionName } from '../types';

export type ResetOptionType = 'clear_week_assignments' | 'clear_region_projects' | 'reset_to_default';

interface ResetScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeRegion: RegionName;
  activeWeekLabel: string;
  totalProjectsInWeek: number;
  totalProjectsInRegion: number;
  onConfirmReset: (option: ResetOptionType) => void;
}

export const ResetScheduleModal: React.FC<ResetScheduleModalProps> = ({
  isOpen,
  onClose,
  activeRegion,
  activeWeekLabel,
  totalProjectsInWeek,
  totalProjectsInRegion,
  onConfirmReset,
}) => {
  const [selectedOption, setSelectedOption] = useState<ResetOptionType>('clear_week_assignments');
  const [confirmed, setConfirmed] = useState(false);

  if (!isOpen) return null;

  const handleExecute = () => {
    onConfirmReset(selectedOption);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden text-slate-100 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-slate-950/80 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
              <RotateCcw className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Clear / Reset Scheduling Matrix & Dispatch
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Region: <strong className="text-cyan-600 dark:text-cyan-400">{activeRegion}</strong> • {activeWeekLabel}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 dark:text-amber-200 space-y-1">
              <p className="font-bold">Independent Dataset Safety</p>
              <p className="text-amber-800 dark:text-amber-300/90">
                Clearing or resetting the Scheduler Matrix and Dispatch & Timesheet will <strong>NOT</strong> modify or delete any records in your <strong>Monitoring Sheet</strong>.
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-400">
              Select Reset Action:
            </label>

            {/* Option 1: Clear Assignments for Current Week */}
            <label
              className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                selectedOption === 'clear_week_assignments'
                  ? 'bg-cyan-950/40 border-cyan-500 ring-1 ring-cyan-500/50'
                  : 'bg-slate-950/50 border-slate-800 hover:bg-slate-800/60'
              }`}
            >
              <input
                type="radio"
                name="reset_option"
                checked={selectedOption === 'clear_week_assignments'}
                onChange={() => setSelectedOption('clear_week_assignments')}
                className="mt-1 text-cyan-500 focus:ring-cyan-400"
              />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />
                    Clear Week Schedule Assignments
                  </span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-cyan-900/60 text-cyan-300 font-bold">
                    {totalProjectsInWeek} Jobs
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                  Unassigns technicians, install days, and teardown days for jobs in <strong>{activeWeekLabel}</strong>. Leaves job records ready to re-assign or auto-populate.
                </p>
              </div>
            </label>

            {/* Option 2: Clear All Projects in Scheduling for Region */}
            <label
              className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                selectedOption === 'clear_region_projects'
                  ? 'bg-rose-950/40 border-rose-500 ring-1 ring-rose-500/50'
                  : 'bg-slate-950/50 border-slate-800 hover:bg-slate-800/60'
              }`}
            >
              <input
                type="radio"
                name="reset_option"
                checked={selectedOption === 'clear_region_projects'}
                onChange={() => setSelectedOption('clear_region_projects')}
                className="mt-1 text-rose-500 focus:ring-rose-400"
              />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <Trash2 className="w-4 h-4 text-rose-500 dark:text-rose-400" />
                    Clear All Scheduling Jobs ({activeRegion})
                  </span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-rose-900/60 text-rose-300 font-bold">
                    {totalProjectsInRegion} Total
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                  Removes all scheduling projects for <strong>{activeRegion}</strong>, providing a completely blank schedule canvas for new imports.
                </p>
              </div>
            </label>

            {/* Option 3: Reset to Reference Schedule */}
            <label
              className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                selectedOption === 'reset_to_default'
                  ? 'bg-amber-950/40 border-amber-500 ring-1 ring-amber-500/50'
                  : 'bg-slate-950/50 border-slate-800 hover:bg-slate-800/60'
              }`}
            >
              <input
                type="radio"
                name="reset_option"
                checked={selectedOption === 'reset_to_default'}
                onChange={() => setSelectedOption('reset_to_default')}
                className="mt-1 text-amber-500 focus:ring-amber-400"
              />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <RotateCcw className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                    Reset to Default Reference Schedule
                  </span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-900/60 text-amber-300 font-bold">
                    Default
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                  Restores the original baseline reference jobs and timeline for <strong>{activeRegion}</strong>.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-950/90 px-6 py-4 border-t border-slate-800 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            id="btn-confirm-reset-schedule"
            onClick={handleExecute}
            className={`px-5 py-2 rounded-xl text-xs font-bold shadow-lg transition-all flex items-center gap-1.5 ${
              selectedOption === 'clear_region_projects'
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
                : selectedOption === 'reset_to_default'
                ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/30'
                : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-600/30'
            }`}
          >
            <Check className="w-4 h-4" />
            <span>Confirm Reset</span>
          </button>
        </div>
      </div>
    </div>
  );
};
