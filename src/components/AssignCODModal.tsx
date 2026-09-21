import React, { useState, useMemo } from 'react';
import { Project, WeekDay } from '../types';
import { X, CheckSquare, Square, Tag, Search, Check, AlertCircle, Calendar, Users, Layers } from 'lucide-react';

interface AssignCODModalProps {
  isOpen: boolean;
  technicianName: string;
  installDay?: WeekDay;
  initialListName?: string;
  allWeekProjects?: Project[];
  projects?: Project[];
  onClose: () => void;
  onAssignCOD: (
    projectIds: string[],
    isCOD: boolean,
    listName?: string,
    targetDay?: WeekDay,
    targetTech?: string
  ) => void;
}

export const AssignCODModal: React.FC<AssignCODModalProps> = ({
  isOpen,
  technicianName,
  installDay = 'Monday',
  initialListName = 'List-107',
  allWeekProjects,
  projects,
  onClose,
  onAssignCOD,
}) => {
  if (!isOpen) return null;

  const weekProjects = allWeekProjects || projects || [];
  const targetTech = technicianName.trim().toLowerCase();

  // State for List Name (e.g. List-107)
  const [listName, setListName] = useState<string>(initialListName || 'List-107');

  // Scope filter: 'day' | 'all' | 'unassigned'
  const [viewScope, setViewScope] = useState<'day' | 'all' | 'unassigned'>('day');

  // Projects currently on this day for this technician
  const dayProjects = useMemo(() => {
    return weekProjects.filter((p) => {
      const isPrimary = p.technician && p.technician.trim().toLowerCase() === targetTech;
      const isDay = p.installDay === installDay || p.teardownDay === installDay || p.batterySwapDay === installDay;
      return isPrimary && isDay;
    });
  }, [weekProjects, targetTech, installDay]);

  // All projects for this tech
  const techProjects = useMemo(() => {
    return weekProjects.filter((p) => {
      return p.technician && p.technician.trim().toLowerCase() === targetTech;
    });
  }, [weekProjects, targetTech]);

  // Unassigned projects
  const unassignedProjects = useMemo(() => {
    return weekProjects.filter(
      (p) => !p.technician || p.technician === 'Unassigned' || p.technician === 'TBD'
    );
  }, [weekProjects]);

  // Available projects based on viewScope
  const scopeProjects = useMemo(() => {
    if (viewScope === 'day') {
      return dayProjects.length > 0 ? dayProjects : techProjects;
    }
    if (viewScope === 'unassigned') {
      return unassignedProjects;
    }
    return weekProjects;
  }, [viewScope, dayProjects, techProjects, unassignedProjects, weekProjects]);

  const [searchTerm, setSearchTerm] = useState('');

  // Selected project IDs for COD
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(() => {
    // By default, select projects in the day that are already COD, or all day projects
    const codInDay = dayProjects.filter((p) => p.group === 'COD' || p.specialBadge === 'COD');
    if (codInDay.length > 0) {
      return new Set(codInDay.map((p) => p.id));
    }
    if (dayProjects.length > 0) {
      return new Set(dayProjects.map((p) => p.id));
    }
    return new Set<string>();
  });

  const filteredProjects = useMemo(() => {
    if (!searchTerm.trim()) return scopeProjects;
    const term = searchTerm.toLowerCase();
    return scopeProjects.filter(
      (p) =>
        p.id.toLowerCase().includes(term) ||
        (p.cityState && p.cityState.toLowerCase().includes(term)) ||
        (p.studyType && p.studyType.toLowerCase().includes(term)) ||
        (p.technician && p.technician.toLowerCase().includes(term)) ||
        (p.codList && p.codList.toLowerCase().includes(term))
    );
  }, [scopeProjects, searchTerm]);

  const toggleSelect = (id: string) => {
    const next = new Set(selectedProjectIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedProjectIds(next);
  };

  const selectAll = () => {
    const next = new Set(selectedProjectIds);
    filteredProjects.forEach((p) => next.add(p.id));
    setSelectedProjectIds(next);
  };

  const deselectAll = () => {
    const next = new Set(selectedProjectIds);
    filteredProjects.forEach((p) => next.delete(p.id));
    setSelectedProjectIds(next);
  };

  const handleApplyCOD = () => {
    if (selectedProjectIds.size === 0) return;
    const cleanList = listName.trim() || 'List-107';
    onAssignCOD(Array.from(selectedProjectIds), true, cleanList, installDay, technicianName);
    onClose();
  };

  const handleRemoveCOD = () => {
    if (selectedProjectIds.size === 0) return;
    onAssignCOD(Array.from(selectedProjectIds), false, undefined, installDay, technicianName);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#ff00bf] to-purple-600 flex items-center justify-center text-white shadow-lg shadow-[#ff00bf]/30 font-black text-xs tracking-wider">
              COD
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">
                  Assign COD on Install Day
                </h3>
                <span className="text-[11px] bg-[#ff00bf]/20 text-[#ff00bf] font-bold font-mono px-2 py-0.5 rounded-full border border-[#ff00bf]/40">
                  {installDay}
                </span>
                <span className="text-[11px] bg-slate-800 text-slate-300 font-medium px-2 py-0.5 rounded-full border border-slate-700">
                  {technicianName}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Group City of Dallas (COD) projects together for this install day to conserve matrix space.
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

        {/* Content */}
        <div className="p-4 overflow-y-auto space-y-3.5 text-xs flex-1">
          {/* List Name Input Section */}
          <div className="bg-slate-950 border border-[#ff00bf]/40 rounded-xl p-3 shadow-inner">
            <label className="block text-[11px] font-bold text-slate-200 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-[#ff00bf]" />
                <span>COD List Name / Identifier</span>
              </span>
              <span className="text-[10px] text-slate-400 font-normal">
                Appears on the matrix cell & groups all associated jobs
              </span>
            </label>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={listName}
                  onChange={(e) => setListName(e.target.value)}
                  placeholder="e.g. List-107"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-[#ff00bf] font-black placeholder-slate-500 focus:outline-none focus:border-[#ff00bf] focus:ring-1 focus:ring-[#ff00bf]"
                />
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {['List-106', 'List-107', 'List-108'].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setListName(preset)}
                    className={`px-2 py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
                      listName === preset
                        ? 'bg-[#ff00bf] text-white'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-1.5 text-[10px] text-slate-400">
              Preview badge:{' '}
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#ff00bf] text-white font-black text-[9px]">
                COD {listName || 'List-107'}
              </span>
            </div>
          </div>

          {/* Scope Selector Tabs: Assign a project from that week */}
          <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2 flex-wrap">
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button
                type="button"
                onClick={() => setViewScope('day')}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewScope === 'day'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                <span>This Install Day ({dayProjects.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setViewScope('all')}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewScope === 'all'
                    ? 'bg-[#ff00bf]/20 text-[#ff00bf] border border-[#ff00bf]/40 shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-[#ff00bf]" />
                <span>All Projects This Week ({allWeekProjects.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setViewScope('unassigned')}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewScope === 'unassigned'
                    ? 'bg-amber-950/40 text-amber-300 border border-amber-500/40 shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Users className="w-3.5 h-3.5 text-amber-400" />
                <span>Unassigned ({unassignedProjects.length})</span>
              </button>
            </div>

            <div className="text-[11px] text-slate-400 font-mono">
              <strong className="text-white">{selectedProjectIds.size}</strong> selected
            </div>
          </div>

          {/* Search & Bulk Select Toolbar */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search project #, city, study type, tech..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#ff00bf]"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={selectAll}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold transition-colors cursor-pointer"
              >
                Select All ({filteredProjects.length})
              </button>
              <button
                type="button"
                onClick={deselectAll}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold transition-colors cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Projects List */}
          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/70 max-h-72 overflow-y-auto divide-y divide-slate-850">
            {filteredProjects.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <AlertCircle className="w-6 h-6 mx-auto mb-2 opacity-50" />
                <p>No projects match current filters.</p>
              </div>
            ) : (
              filteredProjects.map((p) => {
                const isSelected = selectedProjectIds.has(p.id);
                const isCurrentlyCOD = p.group === 'COD' || p.specialBadge === 'COD';
                const isAlreadyThisDay =
                  p.technician === technicianName && p.installDay === installDay;

                return (
                  <div
                    key={p.id}
                    onClick={() => toggleSelect(p.id)}
                    className={`p-2.5 flex items-center justify-between gap-3 hover:bg-slate-850/80 cursor-pointer transition-colors ${
                      isSelected ? 'bg-[#ff00bf]/10 border-l-2 border-[#ff00bf]' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelect(p.id);
                        }}
                        className="text-slate-400 hover:text-white"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-[#ff00bf]" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-600" />
                        )}
                      </button>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-white text-xs">{p.id}</span>
                          <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded font-medium">
                            {p.studyType}
                          </span>
                          {isCurrentlyCOD && (
                            <span className="text-[9px] bg-[#ff00bf] text-white font-black px-1.5 py-0.2 rounded shadow-xs">
                              COD {p.codList || ''}
                            </span>
                          )}
                          {isAlreadyThisDay ? (
                            <span className="text-[9px] bg-emerald-950 text-emerald-300 border border-emerald-500/40 px-1.5 py-0.2 rounded font-mono font-bold">
                              Current Install ({installDay})
                            </span>
                          ) : (
                            <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.2 rounded font-mono">
                              {p.technician || 'Unassigned'} • {p.installDay || 'Unscheduled'}
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] text-slate-400 truncate mt-0.5">
                          {p.cityState || 'Dallas, TX'} • {p.equipmentCount || 2}{' '}
                          {p.equipmentType === 'Machine' ? 'Machines' : 'Cameras'}
                          {p.collectionWindow ? ` • ${p.collectionWindow}` : ''}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[10px] text-slate-400 font-mono block">
                        {p.opsStatus}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-400">
            <strong>{selectedProjectIds.size}</strong> projects will be grouped as{' '}
            <strong className="text-[#ff00bf]">COD {listName.trim() || 'List-107'}</strong>
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRemoveCOD}
              disabled={selectedProjectIds.size === 0}
              className="px-3 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              Remove COD
            </button>

            <button
              type="button"
              onClick={handleApplyCOD}
              disabled={selectedProjectIds.size === 0}
              className="px-4 py-1.5 rounded-lg bg-[#ff00bf] hover:bg-[#ff00bf]/90 text-white text-xs font-black shadow-md shadow-[#ff00bf]/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Group Selected as COD ({selectedProjectIds.size})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
