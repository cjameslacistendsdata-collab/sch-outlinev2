import React, { useState, useMemo } from 'react';
import { Project, OpsStatus } from '../types';
import { getOpsStatusBadge, evaluateProjectStatus } from '../utils/statusEngine';
import {
  Clock,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Wrench,
  MapPin,
  Sparkles,
  Calendar,
  Layers,
  Search,
  Filter,
  Users,
  ChevronRight,
} from 'lucide-react';

interface WorkflowPipelineProps {
  projects: Project[];
  onSelectProject: (project: Project) => void;
  onUpdateProjectStatus: (projectId: string, newStatus: OpsStatus) => void;
}

const STAGES: { status: OpsStatus; title: string; color: string; border: string; activeRing: string }[] = [
  {
    status: 'Needs Scheduling',
    title: 'Needs Scheduling',
    color: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60',
    border: 'border-rose-200 dark:border-rose-800/60',
    activeRing: 'ring-rose-500',
  },
  {
    status: 'Scheduled to techs',
    title: 'Scheduled to Techs',
    color: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60',
    border: 'border-amber-200 dark:border-amber-800/60',
    activeRing: 'ring-amber-500',
  },
  {
    status: 'All locations installed',
    title: 'In Field / Installed',
    color: 'bg-blue-50 dark:bg-slate-800/80 text-blue-700 dark:text-slate-200 border-blue-200 dark:border-slate-700',
    border: 'border-blue-200 dark:border-slate-700',
    activeRing: 'ring-blue-500',
  },
  {
    status: 'Pending QAQC OPS',
    title: 'Pending QA/QC',
    color: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60',
    border: 'border-emerald-200 dark:border-emerald-800/60',
    activeRing: 'ring-emerald-500',
  },
  {
    status: 'Pending Delivery',
    title: 'Pending Delivery',
    color: 'bg-indigo-50 dark:bg-blue-950/40 text-indigo-700 dark:text-blue-300 border-indigo-200 dark:border-blue-800/60',
    border: 'border-indigo-200 dark:border-blue-800/60',
    activeRing: 'ring-indigo-500',
  },
  {
    status: 'Delivered',
    title: 'Delivered & Completed',
    color: 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800/60',
    border: 'border-teal-200 dark:border-teal-800/60',
    activeRing: 'ring-teal-500',
  },
];

export const WorkflowPipeline: React.FC<WorkflowPipelineProps> = ({
  projects,
  onSelectProject,
  onUpdateProjectStatus,
}) => {
  // Navigation & Filtering State
  const [pipelineSearch, setPipelineSearch] = useState('');
  const [selectedTech, setSelectedTech] = useState<string>('all');
  const [activeStageTab, setActiveStageTab] = useState<string>('all');
  const [isCompact, setIsCompact] = useState<boolean>(true);

  // List of unique technicians for filtering
  const technicianList = useMemo(() => {
    const set = new Set<string>();
    projects.forEach((p) => {
      if (p.technician && p.technician !== 'Unassigned') {
        set.add(p.technician);
      }
    });
    return Array.from(set).sort();
  }, [projects]);

  // Filtered projects based on search and technician
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      // Tech filter
      if (selectedTech !== 'all') {
        const isAssigned = p.technician === selectedTech;
        if (!isAssigned) return false;
      }

      // Text search
      if (pipelineSearch.trim()) {
        const query = pipelineSearch.toLowerCase();
        const matchId = p.id.toLowerCase().includes(query);
        const matchCity = p.cityState?.toLowerCase().includes(query) || false;
        const matchTech = p.technician?.toLowerCase().includes(query) || false;
        const matchStudy = p.studyType?.toLowerCase().includes(query) || false;
        if (!matchId && !matchCity && !matchTech && !matchStudy) return false;
      }

      return true;
    });
  }, [projects, selectedTech, pipelineSearch]);

  const getStageProjects = (status: OpsStatus) => {
    return filteredProjects.filter((p) => p.opsStatus === status);
  };

  const advanceStage = (projectId: string, current: OpsStatus) => {
    const currentIndex = STAGES.findIndex((s) => s.status === current);
    if (currentIndex < STAGES.length - 1) {
      onUpdateProjectStatus(projectId, STAGES[currentIndex + 1].status);
    }
  };

  const regressStage = (projectId: string, current: OpsStatus) => {
    const currentIndex = STAGES.findIndex((s) => s.status === current);
    if (currentIndex > 0) {
      onUpdateProjectStatus(projectId, STAGES[currentIndex - 1].status);
    }
  };

  // Determine which stages to display based on activeStageTab
  const visibleStages = useMemo(() => {
    if (activeStageTab === 'all') return STAGES;
    return STAGES.filter((s) => s.status === activeStageTab);
  }, [activeStageTab]);

  return (
    <div className="space-y-4">
      {/* Workflow Navigation & Control Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                <span>Operational Pipeline & Project Lifecycle</span>
              </h2>
              <span className="bg-cyan-100 dark:bg-slate-800 text-cyan-800 dark:text-cyan-300 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold">
                {filteredProjects.length} Projects Total
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Track progress from intake to field dispatch, recording, teardown, QA/QC audit, and final delivery.
            </p>
          </div>

          {/* Quick Filters */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={pipelineSearch}
                onChange={(e) => setPipelineSearch(e.target.value)}
                placeholder="Search projects, city, tech..."
                className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-cyan-500 w-52 sm:w-64"
              />
              {pipelineSearch && (
                <button
                  onClick={() => setPipelineSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Technician Filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1 text-xs">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedTech}
                onChange={(e) => setSelectedTech(e.target.value)}
                className="bg-transparent text-slate-800 dark:text-slate-200 text-xs font-semibold focus:outline-none cursor-pointer"
              >
                <option value="all">All Technicians ({projects.length})</option>
                {technicianList.map((tech) => {
                  const techCount = projects.filter(
                    (p) => p.technician === tech
                  ).length;
                  return (
                    <option key={tech} value={tech}>
                      {tech} ({techCount} projects)
                    </option>
                  );
                })}
              </select>
            </div>

            {/* View Mode Toggle & Clear Filters */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-0.5 rounded-lg border border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setIsCompact(false)}
                className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                  !isCompact
                    ? 'bg-white dark:bg-slate-800 text-cyan-700 dark:text-cyan-300 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                }`}
                title="Expanded card view with full details"
              >
                Detailed
              </button>
              <button
                onClick={() => setIsCompact(true)}
                className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                  isCompact
                    ? 'bg-white dark:bg-slate-800 text-cyan-700 dark:text-cyan-300 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                }`}
                title="Compact view for high density tracking"
              >
                Compact
              </button>
            </div>
          </div>
        </div>

        {/* Interactive Stage Navigation Tabs */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-2 overflow-x-auto pb-1 text-xs select-none">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
            <Filter className="w-3 h-3 text-cyan-500" />
            <span>Stages:</span>
          </span>

          <button
            onClick={() => setActiveStageTab('all')}
            className={`px-3 py-1 rounded-lg font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
              activeStageTab === 'all'
                ? 'bg-slate-900 text-white dark:bg-cyan-600 shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            <span>All Stages</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-black/20 dark:bg-black/40">
              {filteredProjects.length}
            </span>
          </button>

          {STAGES.map((s, idx) => {
            const count = getStageProjects(s.status).length;
            const isActive = activeStageTab === s.status;

            return (
              <button
                key={s.status}
                onClick={() => setActiveStageTab(s.status)}
                className={`px-3 py-1 rounded-lg font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 border ${
                  isActive
                    ? 'bg-cyan-600 text-white border-cyan-500 shadow-xs'
                    : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <span>{s.title}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    isActive
                      ? 'bg-black/30 text-white'
                      : count > 0
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold'
                      : 'bg-slate-100 dark:bg-slate-900 text-slate-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Kanban Board Columns */}
      <div
        className={`grid gap-3.5 items-start overflow-x-auto pb-4 ${
          visibleStages.length === 1
            ? 'grid-cols-1 max-w-2xl mx-auto'
            : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6'
        }`}
      >
        {visibleStages.map((stage) => {
          const stageProjects = getStageProjects(stage.status);
          const stageIdx = STAGES.findIndex((s) => s.status === stage.status);

          return (
            <div
              key={stage.status}
              className={`bg-white dark:bg-slate-900/90 rounded-xl border ${stage.border} shadow-sm dark:shadow-lg flex flex-col min-w-[250px] transition-all`}
            >
              {/* Column Header: Clearly labeled with Number of Projects! */}
              <div className={`p-3 rounded-t-xl border-b ${stage.color}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs uppercase tracking-wider">{stage.title}</span>
                  <span className="bg-slate-900 dark:bg-slate-950 text-white font-mono font-bold text-xs px-2 py-0.5 rounded-full border border-slate-700">
                    {stageProjects.length}
                  </span>
                </div>
                <div className="text-[11px] font-medium flex items-center justify-between opacity-90">
                  <span className="font-semibold">
                    {stageProjects.length} {stageProjects.length === 1 ? 'Project' : 'Projects'}
                  </span>
                  <span>Stage {stageIdx + 1} of 6</span>
                </div>
              </div>

              {/* Cards Container */}
              <div className="p-2.5 space-y-2.5 max-h-[calc(100vh-290px)] overflow-y-auto">
                {stageProjects.length === 0 ? (
                  <div className="text-center py-10 text-xs text-slate-400 dark:text-slate-500 italic bg-slate-50/50 dark:bg-slate-950/40 rounded-lg border border-dashed border-slate-200 dark:border-slate-800">
                    No projects in this stage
                  </div>
                ) : (
                  stageProjects.map((project) => {
                    const audit = evaluateProjectStatus(project);
                    const badge = getOpsStatusBadge(project.opsStatus);

                    if (isCompact) {
                      const isCOD = project.group === 'COD' || project.specialBadge === 'COD';

                      return (
                        <div
                          key={project.id}
                          className="bg-white dark:bg-slate-900/90 hover:bg-slate-50 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 hover:border-cyan-500/50 rounded-lg p-2 transition-all shadow-xs flex flex-col gap-1.5 group cursor-pointer"
                          onClick={() => onSelectProject(project)}
                        >
                          {/* Row 1: ID, Study, Group & Stage Buttons */}
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1.5 truncate">
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${badge?.dot || 'bg-slate-400'}`}></span>
                              <span className="font-mono font-bold text-cyan-700 dark:text-cyan-300 text-xs truncate">
                                {project.id}
                              </span>
                              <span className="text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.2 rounded font-semibold shrink-0">
                                {project.studyType}
                              </span>
                              {isCOD && (
                                <span className="bg-[#ff00bf] text-white text-[8px] font-black px-1.5 py-0.2 rounded shrink-0">
                                  COD
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => regressStage(project.id, project.opsStatus)}
                                disabled={stageIdx === 0}
                                className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-20 text-slate-500 cursor-pointer"
                                title="Move to previous stage"
                              >
                                <ArrowLeft className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => advanceStage(project.id, project.opsStatus)}
                                disabled={stageIdx === STAGES.length - 1}
                                className="p-0.5 rounded hover:bg-cyan-600 hover:text-white disabled:opacity-20 text-slate-500 cursor-pointer"
                                title="Advance to next stage"
                              >
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          {/* Row 2: Location & Tech */}
                          <div className="flex items-center justify-between text-[10px] text-slate-600 dark:text-slate-400 gap-1">
                            <span className="truncate flex items-center gap-1 text-slate-700 dark:text-slate-300 font-medium">
                              <MapPin className="w-2.5 h-2.5 text-rose-500 shrink-0" />
                              <span className="truncate">{project.cityState || 'Statewide'}</span>
                            </span>
                            <span className={`truncate px-1.5 py-0.2 rounded text-[9px] font-semibold shrink-0 ${
                              project.technician === 'Unassigned'
                                ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                            }`}>
                              {project.technician || 'Unassigned'}
                            </span>
                          </div>

                          {/* Row 3: Schedule Day & Units */}
                          <div className="flex items-center justify-between text-[9px] font-mono border-t border-slate-100 dark:border-slate-800/60 pt-1 text-slate-500">
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                              {project.installDay ? `INS: ${project.installDay.slice(0, 3)}` : 'Schedule TBD'}
                            </span>
                            <span className="text-slate-600 dark:text-slate-400 font-bold">
                              {project.equipmentCount || 1} {project.studyType === 'ATR' ? 'Mach' : 'Cam'}
                            </span>
                          </div>
                        </div>
                      );
                    }

                    const isCOD = project.group === 'COD' || project.specialBadge === 'COD';

                    return (
                      <div
                        key={project.id}
                        className="bg-white dark:bg-slate-950/80 hover:bg-slate-50 dark:hover:bg-slate-850 border border-slate-200 dark:border-slate-800 hover:border-cyan-500/60 rounded-lg p-3 transition-all shadow-xs group relative"
                      >
                        {/* Card Top: ID and Study */}
                        <div className="flex items-center justify-between gap-1 mb-1.5">
                          <button
                            onClick={() => onSelectProject(project)}
                            className="font-mono font-bold text-cyan-700 dark:text-cyan-300 text-xs hover:underline flex items-center gap-1"
                          >
                            <span>{project.id}</span>
                          </button>
                          <div className="flex items-center gap-1">
                            {isCOD && (
                              <span className="bg-[#ff00bf] text-white text-[8px] font-black px-1.5 py-0.2 rounded">
                                COD
                              </span>
                            )}
                            <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded font-semibold border border-slate-200 dark:border-slate-700">
                              {project.studyType}
                            </span>
                          </div>
                        </div>

                        {/* Location */}
                        <div className="text-xs text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-2 truncate font-medium">
                          <MapPin className="w-3 h-3 text-rose-500 dark:text-rose-400 shrink-0" />
                          <span className="truncate">{project.cityState || 'Statewide'}</span>
                        </div>

                        {/* Assigned Technician & Project Scope */}
                        <div className="grid grid-cols-2 gap-1 text-[11px] bg-slate-50 dark:bg-slate-900/90 p-1.5 rounded border border-slate-200 dark:border-slate-800/80 mb-2">
                          <div className="truncate">
                            <span className="text-slate-400 dark:text-slate-500 block text-[9px] uppercase font-bold">
                              Tech
                            </span>
                            <span
                              className={`font-semibold truncate block ${
                                project.technician === 'Unassigned'
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : 'text-slate-800 dark:text-slate-200'
                              }`}
                            >
                              {project.technician || 'Unassigned'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 dark:text-slate-500 block text-[9px] uppercase font-bold">
                              Units
                            </span>
                            <span className="font-mono font-bold text-cyan-700 dark:text-cyan-400">
                              {project.equipmentCount || 1} Units
                            </span>
                          </div>
                        </div>

                        {/* Install & Teardown Days */}
                        <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 mb-2 font-medium">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-2.5 h-2.5 text-cyan-600 dark:text-cyan-400" />
                            <span>In: {project.installDay || '—'}</span>
                          </span>
                          <span>Out: {project.teardownDay || '—'}</span>
                        </div>

                        {/* Stage Controls: Move back / Details / Move forward */}
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                          <button
                            onClick={() => regressStage(project.id, project.opsStatus)}
                            disabled={stageIdx === 0}
                            title={stageIdx > 0 ? `Move back to ${STAGES[stageIdx - 1].title}` : 'First stage'}
                            className="p-1 rounded bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-20 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer transition-colors"
                          >
                            <ArrowLeft className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => onSelectProject(project)}
                            className="text-[11px] text-cyan-700 dark:text-cyan-400 hover:underline font-bold cursor-pointer"
                          >
                            Details
                          </button>

                          <button
                            onClick={() => advanceStage(project.id, project.opsStatus)}
                            disabled={stageIdx === STAGES.length - 1}
                            title={
                              stageIdx < STAGES.length - 1
                                ? `Advance to ${STAGES[stageIdx + 1].title}`
                                : 'Final stage'
                            }
                            className="p-1 rounded bg-slate-100 dark:bg-slate-900 hover:bg-cyan-600 hover:text-white disabled:opacity-20 text-slate-600 dark:text-slate-400 cursor-pointer transition-colors"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
