import React, { useState } from 'react';
import { Project, StatusAuditResult, OpsStatus } from '../types';
import { Sparkles, CheckCircle2, ArrowRight, X, AlertCircle, RefreshCw } from 'lucide-react';
import { getOpsStatusBadge, CURRENT_DAY_NAME } from '../utils/statusEngine';

interface AutomatedStatusModalProps {
  auditResults: StatusAuditResult[];
  projects: Project[];
  onClose: () => void;
  onApplyUpdates: (updates: { projectId: string; newStatus: OpsStatus }[]) => void;
}

export const AutomatedStatusModal: React.FC<AutomatedStatusModalProps> = ({
  auditResults = [],
  projects = [],
  onClose,
  onApplyUpdates,
}) => {
  const safeAuditResults = Array.isArray(auditResults) ? auditResults : [];
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(safeAuditResults.map((r) => r.projectId))
  );

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const selectAll = () => {
    if (selectedIds.size === safeAuditResults.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(safeAuditResults.map((r) => r.projectId)));
    }
  };

  const handleApply = () => {
    const toApply = safeAuditResults
      .filter((r) => selectedIds.has(r.projectId))
      .map((r) => ({
        projectId: r.projectId,
        newStatus: r.suggestedStatus,
      }));
    onApplyUpdates(toApply);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col my-8">
        {/* Modal Header */}
        <div className="p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-950/40 text-slate-950 font-black">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Automated Status Synchronization Engine</h3>
                <span className="bg-amber-950 text-amber-300 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-amber-800/80">
                  {auditResults.length} Actionable Updates
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Evaluated against current operational cycle date: <strong className="text-slate-200">{CURRENT_DAY_NAME}, Sep 3, 2026</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 overflow-y-auto max-h-[calc(80vh-160px)] space-y-4 text-xs">
          {/* Rule explanation card */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-slate-300 space-y-1.5">
            <div className="font-semibold text-slate-200 flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
              <span>Automated Workflow Logic:</span>
            </div>
            <ul className="list-disc list-inside text-[11px] text-slate-400 space-y-1 pl-1">
              <li>
                <strong>Teardowns completed prior to today ({CURRENT_DAY_NAME}):</strong> Auto-escalate from &quot;Scheduled to techs&quot; to &quot;Pending QAQC OPS&quot;.
              </li>
              <li>
                <strong>Active in-field collection:</strong> Studies installed earlier this week with teardowns today or Friday are verified as active in field.
              </li>
              <li>
                <strong>Unassigned assignments:</strong> Automatically marked as &quot;Needs Scheduling&quot; for dispatcher action.
              </li>
            </ul>
          </div>

          {/* Results List */}
          {auditResults.length === 0 ? (
            <div className="text-center py-10 text-slate-400 bg-slate-950/40 rounded-xl border border-slate-800">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2 opacity-80" />
              <p className="font-bold text-white text-sm">All Statuses Are Up to Date!</p>
              <p className="text-xs text-slate-400 mt-1">
                Every project accurately reflects its install schedule, teardown milestone, and technician assignment.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-slate-400 px-1">
                <span>Select updates to apply:</span>
                <button
                  onClick={selectAll}
                  className="text-cyan-400 hover:text-cyan-300 font-semibold"
                >
                  {selectedIds.size === safeAuditResults.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              {safeAuditResults.map((result) => {
                const project = projects.find((p) => p.id === result.projectId);
                const isSelected = selectedIds.has(result.projectId);
                const currentBadge = getOpsStatusBadge(result.currentStatus);
                const suggestedBadge = getOpsStatusBadge(result.suggestedStatus);

                return (
                  <div
                    key={result.projectId}
                    onClick={() => toggleSelect(result.projectId)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-slate-950 border-amber-500/70 shadow-md ring-1 ring-amber-500/20'
                        : 'bg-slate-950/40 border-slate-800 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="mt-1 rounded text-amber-500 focus:ring-0 focus:ring-offset-0 bg-slate-900 border-slate-700"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-white text-xs">
                              {result.projectId}
                            </span>
                            <span className="text-slate-400 font-medium">
                              {project?.cityState} ({project?.studyType})
                            </span>
                          </div>
                          <p className="text-slate-400 mt-1 leading-relaxed text-[11px]">
                            {result.reason}
                          </p>
                        </div>
                      </div>

                      {/* Transition badges */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${currentBadge?.bg || 'bg-slate-800'} ${currentBadge?.text || 'text-slate-300'}`}
                        >
                          {result.currentStatus}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${suggestedBadge?.bg || 'bg-slate-800'} ${suggestedBadge?.text || 'text-slate-300'} border ${suggestedBadge?.border || 'border-slate-700'}`}
                        >
                          {result.suggestedStatus}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            {selectedIds.size} of {auditResults.length} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={selectedIds.size === 0}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 shadow-md transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Apply Selected Updates ({selectedIds.size})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
