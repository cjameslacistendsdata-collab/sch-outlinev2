import React, { useState, useMemo } from 'react';
import { Project, WeekDay, Technician, RegionName } from '../types';
import { TECHNICIANS } from '../data/technicians';
import {
  MapPin,
  UserCheck,
  Camera,
  Cog,
  ArrowDownCircle,
  ArrowUpCircle,
  Plus,
  Trash2,
  Users,
} from 'lucide-react';
import { getOpsStatusBadge } from '../utils/statusEngine';
import { getTechOverallEquipmentStats, getProjectEquipmentType } from '../utils/equipmentEngine';
import { getIndividualTechList, isProjectAssignedToTech } from '../utils/technicianUtils';

interface TechnicianCapacityViewProps {
  projects: Project[];
  technicians?: Technician[];
  currentRegion?: RegionName;
  allowCOD?: boolean;
  onAddTechnician?: (tech: Technician) => void;
  onRemoveTechnician?: (techId: string) => void;
  onOpenManageTechs?: () => void;
  onAssignCODForTech?: (technicianName: string) => void;
  onSelectProject: (project: Project) => void;
  onSelectTechDay: (techName: string, day: WeekDay) => void;
}

export const TechnicianCapacityView: React.FC<TechnicianCapacityViewProps> = ({
  projects,
  technicians,
  currentRegion = 'South Central',
  allowCOD = true,
  onRemoveTechnician,
  onOpenManageTechs,
  onAssignCODForTech,
  onSelectProject,
}) => {
  const [techToDelete, setTechToDelete] = useState<Technician | null>(null);

  // Sync technicians from both prop and monitoring sheet projects
  // When multiple technicians are assigned to a project, do not group them: each individual tech gets their own row
  const techList = useMemo(() => {
    return getIndividualTechList(projects, technicians, currentRegion);
  }, [technicians, projects, currentRegion]);

  return (
    <div className="space-y-4">
      {/* Header Summary */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              <span>Field Technician Load & Inventory Dispatch Summary</span>
            </h2>
            <span className="bg-slate-100 dark:bg-slate-800 text-cyan-700 dark:text-cyan-300 px-2 py-0.5 rounded text-xs font-mono font-bold">
              {techList.length} Technicians Active
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
            Monitor real-time equipment allocation, base camera & machine stocks, and field jobs across Dallas, Houston, Louisiana, Colorado, and custom territories.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {onOpenManageTechs && (
            <button
              onClick={onOpenManageTechs}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white shadow-md transition-colors cursor-pointer"
            >
              <Users className="w-3.5 h-3.5" />
              <span>+ Add & Manage Technicians</span>
            </button>
          )}
          <span className="flex items-center gap-1.5 text-emerald-400 font-semibold bg-emerald-950/80 px-2.5 py-1 rounded border border-emerald-500/60 text-xs">
            <ArrowDownCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span>Install = -Stock</span>
          </span>
          <span className="flex items-center gap-1.5 text-violet-300 font-semibold bg-violet-950/80 px-2.5 py-1 rounded border border-violet-500/60 text-xs">
            <ArrowUpCircle className="w-3.5 h-3.5 text-violet-400" />
            <span>Teardown = +Stock</span>
          </span>
        </div>
      </div>

      {/* Grid of Tech Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {techList.map((tech) => {
          const stats = getTechOverallEquipmentStats(tech, projects);
          const assignedJobs = projects.filter(
            (p) => isProjectAssignedToTech(p.technician, tech.name)
          );
          const totalEquip = assignedJobs.reduce((acc, p) => acc + (p.equipmentCount || 0), 0);
          const totalLocs = assignedJobs.reduce((acc, p) => acc + (p.locationsCount || 0), 0);

          // Distinct cities
          const cities = Array.from(new Set(assignedJobs.map((p) => p.cityState).filter(Boolean)));

          // Workload risk: if equip > 30 or jobs > 5
          const isHeavyLoad = totalEquip >= 25 || assignedJobs.length >= 5;

          const teamBorder =
            tech.colorGroup === 'orange'
              ? 'border-t-4 border-t-amber-500 border-x border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm'
              : tech.colorGroup === 'navy'
              ? 'border-t-4 border-t-blue-600 border-x border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm'
              : tech.colorGroup === 'burgundy'
              ? 'border-t-4 border-t-rose-600 border-x border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm'
              : 'border-t-4 border-t-emerald-600 border-x border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm';

          return (
            <div
              key={tech.id}
              className={`rounded-xl border p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between ${teamBorder}`}
            >
              <div>
                {/* Tech Header */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div>
                    <h3 className="font-extrabold text-slate-900 dark:text-white text-base flex items-center gap-2">
                      <span>{tech.name}</span>
                      <span className="text-[10px] bg-yellow-400 text-slate-950 px-1.5 py-0.5 rounded font-black uppercase border border-yellow-500">
                        {tech.region}
                      </span>
                      {isHeavyLoad && (
                        <span className="text-[10px] bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-700/80 px-1.5 py-0.5 rounded font-bold uppercase">
                          Heavy Load
                        </span>
                      )}
                    </h3>
                    <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">{tech.team}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {allowCOD && onAssignCODForTech && (
                      <button
                        onClick={() => onAssignCODForTech(tech.name)}
                        title={`Assign projects for ${tech.name} to COD`}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[#ff00bf] hover:bg-[#ff00bf]/90 text-white text-[11px] font-black shadow-xs transition-colors cursor-pointer"
                      >
                        <span>COD</span>
                        {assignedJobs.filter((p) => p.group === 'COD' || p.specialBadge === 'COD').length > 0 && (
                          <span className="bg-black/30 px-1 rounded-full text-[9px] font-mono">
                            {assignedJobs.filter((p) => p.group === 'COD' || p.specialBadge === 'COD').length}
                          </span>
                        )}
                      </button>
                    )}
                    <div className="text-right">
                      <span className="font-mono font-bold text-sm text-cyan-700 dark:text-cyan-400">
                        {assignedJobs.length} Jobs
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block">{totalEquip} units</span>
                    </div>
                    {onRemoveTechnician && (
                      <button
                        onClick={() => setTechToDelete(tech)}
                        title={`Remove technician ${tech.name}`}
                        className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 hover:bg-rose-100 dark:hover:bg-rose-950/80 text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-300 border border-slate-200 dark:border-slate-700 hover:border-rose-400 dark:hover:border-rose-600/50 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Base Equipment & Available Stock Row */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded p-2 text-center shadow-xs">
                    <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-cyan-800 dark:text-cyan-400">
                      <Camera className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                      <span>CAMERAS</span>
                    </div>
                    <div className="text-sm font-mono font-black text-slate-900 dark:text-white mt-0.5">
                      {tech.cameras} Base
                    </div>
                    <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold">
                      {stats.currentAvailableCameras} Available
                    </div>
                    {stats.activeCamerasInField > 0 && (
                      <div className="text-[9px] text-slate-600 dark:text-emerald-300 font-medium">
                        (-{stats.activeCamerasInField} deployed)
                      </div>
                    )}
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded p-2 text-center shadow-xs">
                    <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-amber-800 dark:text-amber-400">
                      <Cog className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                      <span>MACHINES</span>
                    </div>
                    <div className="text-sm font-mono font-black text-slate-900 dark:text-white mt-0.5">
                      {tech.machines} Base
                    </div>
                    <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold">
                      {stats.currentAvailableMachines} Available
                    </div>
                    {stats.activeMachinesInField > 0 && (
                      <div className="text-[9px] text-slate-600 dark:text-emerald-300 font-medium">
                        (-{stats.activeMachinesInField} deployed)
                      </div>
                    )}
                  </div>
                </div>

                {/* Cities Badge */}
                {cities.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 mb-3 text-[11px] text-slate-700 dark:text-slate-300">
                    <MapPin className="w-3 h-3 text-red-500 dark:text-red-400 shrink-0" />
                    {cities.slice(0, 3).map((city) => (
                      <span
                        key={city}
                        className="bg-slate-50 dark:bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 font-semibold text-slate-800 dark:text-slate-200 shadow-xs"
                      >
                        {city}
                      </span>
                    ))}
                    {cities.length > 3 && (
                      <span className="text-slate-500 text-[10px]">+{cities.length - 3} more</span>
                    )}
                  </div>
                )}

                {/* Assigned Projects List */}
                <div className="space-y-1.5 mt-2">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                    Active Studies & Equipment Flow:
                  </span>
                  {assignedJobs.length === 0 ? (
                    <div className="text-xs text-slate-500 italic py-2">
                      No active assignments this week
                    </div>
                  ) : (
                    assignedJobs.map((p) => {
                      const badge = getOpsStatusBadge(p.opsStatus);
                      const equipType = getProjectEquipmentType(p);
                      return (
                        <div
                          key={p.id}
                          onClick={() => onSelectProject(p)}
                          className="bg-slate-50 dark:bg-slate-950/70 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 hover:border-cyan-500/50 rounded p-2 text-xs transition-all cursor-pointer flex flex-col gap-1 shadow-xs"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${badge?.dot || 'bg-slate-400'}`}></span>
                              <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{p.id}</span>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-sans">
                                {p.studyType}
                              </span>
                            </div>
                            <div className="text-[10px] font-mono font-bold text-cyan-700 dark:text-cyan-300">
                              {p.equipmentCount} {equipType === 'Camera' ? 'Cam' : 'Mach'}
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[10px] font-mono">
                            {p.installDay ? (
                              <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5">
                                <ArrowDownCircle className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                                <span>INS: {p.installDay.slice(0, 3)} (-{p.equipmentCount})</span>
                              </span>
                            ) : (
                              <span className="text-slate-400 dark:text-slate-500">INS: Unscheduled</span>
                            )}

                            {p.teardownDay ? (
                              <span className="text-violet-600 dark:text-violet-300 font-bold flex items-center gap-0.5">
                                <ArrowUpCircle className="w-2.5 h-2.5 text-violet-600 dark:text-violet-300" />
                                <span>TD: {p.teardownDay.slice(0, 3)} (+{p.equipmentCount})</span>
                              </span>
                            ) : (
                              <span className="text-slate-400 dark:text-slate-500">TD: Unscheduled</span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Card Footer: Quick Stats */}
              <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                <span>Total Locations: <strong className="text-slate-900 dark:text-white">{totalLocs}</strong></span>
                <span>Fleet In Field: <strong className="text-slate-900 dark:text-white">{totalEquip}</strong></span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Delete Technician In-App Modal */}
      {techToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-rose-500/50 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Remove Technician</h3>
                <p className="text-xs text-slate-400">{techToDelete.name} • {techToDelete.region}</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to remove <strong>{techToDelete.name}</strong> from the field roster?
              Any currently assigned jobs will automatically be moved to <span className="text-amber-300 font-semibold">Unassigned</span>.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setTechToDelete(null)}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onRemoveTechnician?.(techToDelete.id);
                  setTechToDelete(null);
                }}
                className="px-4 py-1.5 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-500 text-white shadow-lg transition-colors"
              >
                Yes, Remove Technician
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
