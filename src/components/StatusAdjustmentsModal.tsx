import React, { useState } from 'react';
import { OpsStatus, StatusAuditResult } from '../types';
import { Sparkles, ArrowRight, CheckCircle2, AlertCircle, X, RefreshCw, FileSpreadsheet } from 'lucide-react';
import { getOpsStatusBadge, CURRENT_DAY_NAME } from '../utils/statusEngine';

export interface CsvStatusChange {
  projectId: string;
  projectCity?: string;
  technician?: string;
  oldStatus: OpsStatus;
  newStatus: OpsStatus;
}

interface StatusAdjustmentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  csvChanges: CsvStatusChange[];
  todayAdjustments: StatusAuditResult[];
  onApplyTodayUpdates: (updates: { projectId: string; newStatus: OpsStatus }[]) => void;
}

export const StatusAdjustmentsModal: React.FC<StatusAdjustmentsModalProps> = ({
  isOpen,
  onClose,
  csvChanges = [],
  todayAdjustments = [],
  onApplyTodayUpdates,
}) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'csv' | 'today'>(csvChanges.length > 0 ? 'csv' : 'today');
  const [selectedTodayIds, setSelectedTodayIds] = useState<Set<string>>(
    new Set(todayAdjustments.map((a) => a.projectId))
  );

  const toggleSelectToday = (id: string) => {
    const next = new Set(selectedTodayIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedTodayIds(next);
  };

  const selectAllToday = () => {
    setSelectedTodayIds(new Set(todayAdjustments.map((a) => a.projectId)));
  };

  const deselectAllToday = () => {
    setSelectedTodayIds(new Set());
  };

  const handleApplyToday = () => {
    const toApply = todayAdjustments
      .filter((a) => selectedTodayIds.has(a.projectId))
      .map((a) => ({
        projectId: a.projectId,
        newStatus: a.suggestedStatus,
      }));
    onApplyTodayUpdates(toApply);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-slate-950 shadow-lg shadow-amber-950/40 font-bold">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Status Adjustments & Change Notifications</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Audit changes detected between current data, recently uploaded CSV, and today ({CURRENT_DAY_NAME})
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950 px-4 pt-2 gap-2 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('csv')}
            className={`flex items-center gap-2 px-3 py-2 border-b-2 font-bold transition-colors ${
              activeTab === 'csv'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Changes from Uploaded CSV ({csvChanges.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('today')}
            className={`flex items-center gap-2 px-3 py-2 border-b-2 font-bold transition-colors ${
              activeTab === 'today'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <RefreshCw className="w-4 h-4" />
            <span>Automated Today Adjustments ({todayAdjustments.length})</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {activeTab === 'csv' && (
            <div className="space-y-3">
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 text-slate-300">
                <p className="text-xs">
                  The following <strong>{csvChanges.length}</strong> project(s) had operational status updates
                  in the recently uploaded Airtable CSV compared to your previous active data:
                </p>
              </div>

              {csvChanges.length === 0 ? (
                <div className="p-8 text-center text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400 opacity-80" />
                  <p className="font-medium text-slate-300">All uploaded CSV records match current project statuses.</p>
                  <p className="text-[11px] text-slate-500 mt-1">No status differences were introduced.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {csvChanges.map((change) => {
                    const oldBadge = getOpsStatusBadge(change.oldStatus);
                    const newBadge = getOpsStatusBadge(change.newStatus);

                    return (
                      <div
                        key={change.projectId}
                        className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-3 shadow-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-white text-xs">{change.projectId}</span>
                            {change.projectCity && (
                              <span className="text-slate-400 text-[11px]">{change.projectCity}</span>
                            )}
                            {change.technician && (
                              <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded font-mono">
                                {change.technician}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 mt-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${oldBadge?.bg || 'bg-slate-800'} ${oldBadge?.text || 'text-slate-300'}`}>
                              {change.oldStatus}
                            </span>
                            <ArrowRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${newBadge?.bg || 'bg-slate-800'} ${newBadge?.text || 'text-slate-300'} ring-1 ring-cyan-500/40`}>
                              {change.newStatus}
                            </span>
                          </div>
                        </div>

                        <span className="text-[10px] text-cyan-400 font-bold bg-cyan-950 px-2 py-1 rounded-md border border-cyan-800/80">
                          CSV Updated
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'today' && (
            <div className="space-y-3">
              <div className="bg-amber-950/20 border border-amber-800/40 rounded-xl p-3 text-amber-200">
                <p className="text-xs">
                  Automated operational milestones evaluated for <strong>{CURRENT_DAY_NAME}</strong>.
                  Projects with teardowns or installs matching today have suggested status progressions:
                </p>
              </div>

              {todayAdjustments.length === 0 ? (
                <div className="p-8 text-center text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400 opacity-80" />
                  <p className="font-medium text-slate-300">All project statuses are up to date for today!</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Select adjustments to apply:</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={selectAllToday}
                        className="hover:text-white underline"
                      >
                        Select All
                      </button>
                      <span>•</span>
                      <button
                        type="button"
                        onClick={deselectAllToday}
                        className="hover:text-white underline"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {todayAdjustments.map((audit) => {
                      const isSelected = selectedTodayIds.has(audit.projectId);
                      const curBadge = getOpsStatusBadge(audit.currentStatus);
                      const sugBadge = getOpsStatusBadge(audit.suggestedStatus);

                      return (
                        <div
                          key={audit.projectId}
                          onClick={() => toggleSelectToday(audit.projectId)}
                          className={`bg-slate-950 border rounded-xl p-3 flex items-start gap-3 cursor-pointer transition-colors ${
                            isSelected ? 'border-amber-500/60 bg-amber-950/10' : 'border-slate-800'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectToday(audit.projectId)}
                            className="mt-0.5 rounded text-amber-500 focus:ring-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-white text-xs">{audit.projectId}</span>
                              <span className="text-[10px] text-slate-400">{audit.reason}</span>
                            </div>

                            <div className="flex items-center gap-2 mt-2">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${curBadge?.bg || 'bg-slate-800'} ${curBadge?.text || 'text-slate-300'}`}>
                                {audit.currentStatus}
                              </span>
                              <ArrowRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${sugBadge?.bg || 'bg-slate-800'} ${sugBadge?.text || 'text-slate-300'} ring-1 ring-amber-500/40`}>
                                {audit.suggestedStatus}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
          >
            Close
          </button>

          {activeTab === 'today' && todayAdjustments.length > 0 && (
            <button
              type="button"
              onClick={handleApplyToday}
              disabled={selectedTodayIds.size === 0}
              className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-md shadow-amber-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Apply {selectedTodayIds.size} Selected Today Adjustments</span>
            </button>
          )}

          {activeTab === 'csv' && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-md shadow-cyan-600/30 transition-all cursor-pointer"
            >
              Acknowledge CSV Changes
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
