import React, { useState } from 'react';
import { WorkWeekSheet, Project } from '../types';
import { CURRENT_WORK_WEEK_ID } from '../utils/workWeekEngine';
import {
  Calendar,
  Plus,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Trash2,
  CheckCircle2,
  Clock,
  Layers,
} from 'lucide-react';

interface WorkWeekTabsProps {
  workWeeks: WorkWeekSheet[];
  activeWeekId: string;
  onSelectWeek: (weekId: string) => void;
  onAddWeekSheet: () => void;
  onDeleteWeekSheet?: (weekId: string) => void;
  projects: Project[];
}

export const WorkWeekTabs: React.FC<WorkWeekTabsProps> = ({
  workWeeks,
  activeWeekId,
  onSelectWeek,
  onAddWeekSheet,
  onDeleteWeekSheet,
  projects,
}) => {
  const currentIndex = workWeeks.findIndex((w) => w.id === activeWeekId);

  const handlePrevWeek = () => {
    if (currentIndex > 0) {
      onSelectWeek(workWeeks[currentIndex - 1].id);
    }
  };

  const handleNextWeek = () => {
    if (currentIndex < workWeeks.length - 1) {
      onSelectWeek(workWeeks[currentIndex + 1].id);
    }
  };

  // Helper to count jobs for a specific week
  const getJobCountForWeek = (weekId: string) => {
    return projects.filter((p) => {
      if (p.workWeek) return p.workWeek === weekId;
      return weekId === CURRENT_WORK_WEEK_ID;
    }).length;
  };

  const currentWeek = workWeeks.find((w) => w.id === activeWeekId);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 mb-4 shadow-md">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left Section: Work Week Sheet Navigator & Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-thin scrollbar-thumb-slate-700">
          <div className="flex items-center gap-1 shrink-0 text-xs font-bold text-slate-400 uppercase tracking-wider pr-1 border-r border-slate-800">
            <FileSpreadsheet className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Sheets:</span>
          </div>

          {/* Previous / Next Week navigation buttons */}
          <div className="flex items-center gap-0.5 shrink-0 bg-slate-950 rounded-lg p-0.5 border border-slate-800">
            <button
              onClick={handlePrevWeek}
              disabled={currentIndex <= 0}
              title="Previous Work Week Sheet"
              className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 hover:bg-slate-800 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleNextWeek}
              disabled={currentIndex >= workWeeks.length - 1}
              title="Next Work Week Sheet"
              className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 hover:bg-slate-800 transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Individual Work Week Sheets Tabs */}
          {workWeeks.map((week) => {
            const isActive = activeWeekId === week.id;
            const count = getJobCountForWeek(week.id);

            return (
              <div
                key={week.id}
                className="flex items-center shrink-0 group/tab relative"
              >
                <button
                  onClick={() => onSelectWeek(week.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white border-cyan-400 shadow-md ring-1 ring-cyan-400/40'
                      : 'bg-slate-950 text-slate-300 border-slate-800 hover:text-white hover:border-slate-700 hover:bg-slate-900'
                  }`}
                >
                  {/* Current Active operational week pill */}
                  {week.isCurrent && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 animate-pulse"></span>
                  )}

                  <span className="truncate">{week.shortLabel}</span>

                  <span
                    id={`badge-week-count-${week.id}`}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-black workweek-count-badge ${
                      isActive
                        ? 'bg-white text-slate-950 shadow-xs font-black'
                        : 'bg-slate-800 text-slate-300 group-hover/tab:bg-slate-700'
                    }`}
                    style={isActive ? { color: '#0f172a', backgroundColor: '#ffffff' } : undefined}
                  >
                    {count}
                  </span>
                </button>

                {/* Optional Delete Sheet button for non-current custom weeks */}
                {!week.isCurrent && onDeleteWeekSheet && count === 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`Delete empty work week sheet "${week.label}"?`)) {
                        onDeleteWeekSheet(week.id);
                      }
                    }}
                    title={`Delete empty week sheet (${week.shortLabel})`}
                    className="opacity-0 group-hover/tab:opacity-100 p-1 -ml-1 text-slate-500 hover:text-rose-400 transition-opacity"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}

          {/* + Add New Work Week Sheet Button */}
          <button
            onClick={onAddWeekSheet}
            title="Create a new sheet for the next consecutive work week"
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-950 text-cyan-400 hover:text-cyan-300 hover:bg-slate-800 border border-dashed border-cyan-700/60 hover:border-cyan-500 transition-all shrink-0 cursor-pointer shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ New Week Sheet</span>
          </button>
        </div>

        {/* Right Section: Active Week Overview & Date Span Info */}
        <div className="flex items-center gap-3 shrink-0 text-xs text-slate-400">
          {currentWeek ? (
            <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
              <Calendar className="w-3.5 h-3.5 text-cyan-400" />
              <span className="font-semibold text-slate-200">
                {currentWeek.label}
              </span>
              {currentWeek.isCurrent && (
                <span className="bg-emerald-950 text-emerald-300 border border-emerald-600/60 text-[10px] px-1.5 py-0.2 rounded font-bold uppercase">
                  Active
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span className="font-semibold text-slate-200">All Work Weeks Combined</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
