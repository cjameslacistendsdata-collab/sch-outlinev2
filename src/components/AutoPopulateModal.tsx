import React from 'react';
import { Project, Technician } from '../types';
import { AutoPopulateResult } from '../utils/autoPopulateEngine';
import {
  X,
  Sparkles,
  ArrowDownCircle,
  ArrowUpCircle,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  BatteryCharging,
} from 'lucide-react';

interface AutoPopulateModalProps {
  autoPopulateResult: AutoPopulateResult;
  onClose: () => void;
  onConfirm: (updatedProjects: Project[]) => void;
}

export const AutoPopulateModal: React.FC<AutoPopulateModalProps> = ({
  autoPopulateResult,
  onClose,
  onConfirm,
}) => {
  const {
    updatedProjects,
    totalUpdated,
    installDaysAdded,
    teardownDaysAdded,
    batterySwapsAdded = 0,
    techsAssigned,
    details,
  } = autoPopulateResult;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Auto-Populate Matrix from Monitoring Sheet</span>
              </h2>
              <p className="text-xs text-slate-400">
                Extracts Install dates, Teardown dates, 3+ consecutive day Battery Swaps, and regional technician assignments.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stats Summary Bar */}
        <div className="px-6 py-3 border-b border-slate-800 bg-slate-900/60 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-2.5 flex items-center gap-3">
            <ArrowDownCircle className="w-6 h-6 text-emerald-400 shrink-0" />
            <div>
              <span className="text-[10px] text-emerald-300 font-bold uppercase block">
                Install Days
              </span>
              <span className="text-sm font-mono font-black text-white">
                +{installDaysAdded} Scheduled
              </span>
            </div>
          </div>

          <div className="bg-sky-950/40 border border-sky-500/30 rounded-xl p-2.5 flex items-center gap-3">
            <BatteryCharging className="w-6 h-6 text-sky-400 shrink-0" />
            <div>
              <span className="text-[10px] text-sky-300 font-bold uppercase block">
                Battery Swaps (3+ Days)
              </span>
              <span className="text-sm font-mono font-black text-white">
                +{batterySwapsAdded} Scheduled
              </span>
            </div>
          </div>

          <div className="bg-violet-950/40 border border-violet-500/30 rounded-xl p-2.5 flex items-center gap-3">
            <ArrowUpCircle className="w-6 h-6 text-violet-400 shrink-0" />
            <div>
              <span className="text-[10px] text-violet-300 font-bold uppercase block">
                Teardown Days
              </span>
              <span className="text-sm font-mono font-black text-white">
                +{teardownDaysAdded} Scheduled
              </span>
            </div>
          </div>

          <div className="bg-blue-950/40 border border-blue-500/30 rounded-xl p-2.5 flex items-center gap-3">
            <UserCheck className="w-6 h-6 text-cyan-400 shrink-0" />
            <div>
              <span className="text-[10px] text-cyan-300 font-bold uppercase block">
                Techs Assigned
              </span>
              <span className="text-sm font-mono font-black text-white">
                +{techsAssigned} Matched
              </span>
            </div>
          </div>
        </div>

        {/* Preview List of Actions */}
        <div className="flex-1 overflow-y-auto p-6 space-y-2.5">
          {details.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
              <h4 className="text-sm font-bold text-white">Scheduler Matrix is Already Up to Date</h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                All projects in the Monitoring Sheet already have their Install Days, Teardown Days, and Field Technicians matched in the Scheduler Matrix.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                <span>{details.length} Proposed Matrix Slot Adjustments:</span>
                <span className="flex items-center gap-1 text-[11px] text-amber-400">
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Derived from Monitoring Sheet records</span>
                </span>
              </div>

              {details.map((item) => (
                <div
                  key={item.projectId}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-white text-sm">
                        {item.projectId}
                      </span>
                      <span className="font-bold text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-500/40">
                        {item.technician}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      {item.actionReason}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 font-mono font-bold flex-wrap justify-end">
                    {item.installDay && (
                      <span className="px-2 py-1 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/60 flex items-center gap-1 text-[11px]">
                        <ArrowDownCircle className="w-3 h-3 text-emerald-400" />
                        <span>INS: {item.installDay}</span>
                      </span>
                    )}
                    {item.batterySwaps && (
                      <span className="px-2 py-1 rounded bg-sky-950 text-sky-300 border border-sky-500/60 flex items-center gap-1 text-[11px]">
                        <BatteryCharging className="w-3 h-3 text-sky-400" />
                        <span>SWAP: {item.batterySwaps}</span>
                      </span>
                    )}
                    {item.teardownDay && (
                      <span className="px-2 py-1 rounded bg-violet-950 text-violet-300 border border-violet-500/60 flex items-center gap-1 text-[11px]">
                        <ArrowUpCircle className="w-3 h-3 text-violet-400" />
                        <span>TD: {item.teardownDay}</span>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            {totalUpdated > 0
              ? `Ready to populate ${totalUpdated} projects into Matrix`
              : 'Matrix is fully in sync with Monitoring Sheet'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={totalUpdated === 0}
              onClick={() => onConfirm(updatedProjects)}
              className={`px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg transition-all ${
                totalUpdated > 0
                  ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-amber-500/20'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>Confirm & Populate Matrix</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
