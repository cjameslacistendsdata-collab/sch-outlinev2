import React, { useState, useMemo } from 'react';
import { Technician, Project, RegionName } from '../types';
import {
  Users,
  Camera,
  Cog,
  MapPin,
  Search,
  Plus,
  Edit2,
  Trash2,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  X,
  Phone,
  Mail,
  Shield,
  Briefcase,
  Layers,
  ChevronDown,
  Filter,
  Upload,
} from 'lucide-react';
import { UploadTechniciansModal, BulkImportItem } from './UploadTechniciansModal';

interface ManageTechniciansViewProps {
  technicians: Technician[];
  projects: Project[];
  activeRegion?: RegionName;
  allowCOD?: boolean;
  existingTechniciansByRegion?: Record<RegionName, Technician[]>;
  onUpdateTechnician: (updatedTech: Technician, oldName?: string) => void;
  onAddTechnician: (tech: Technician) => void;
  onRemoveTechnician: (techId: string) => void;
  onResetTechnicians?: () => void;
  onAssignCODForTech?: (technicianName: string) => void;
  onBulkImportTechnicians?: (items: BulkImportItem[], mode: 'update' | 'append' | 'replace') => void;
}

const REGION_PRESETS = [
  'TX (Dallas)',
  'TX (Houston)',
  'TX (Austin)',
  'TX (San Antonio)',
  'LA',
  'CO',
  'Other',
];

const TEAMS = [
  { name: 'Team Central (Navy)', colorGroup: 'navy' as const, bg: 'bg-blue-600', text: 'text-blue-300' },
  { name: 'Team North (Orange)', colorGroup: 'orange' as const, bg: 'bg-amber-600', text: 'text-amber-300' },
  { name: 'Team Louisiana (Burgundy)', colorGroup: 'burgundy' as const, bg: 'bg-rose-700', text: 'text-rose-300' },
  { name: 'Team West/Colo (Green)', colorGroup: 'green' as const, bg: 'bg-emerald-600', text: 'text-emerald-300' },
];

export const ManageTechniciansView: React.FC<ManageTechniciansViewProps> = ({
  technicians,
  projects,
  activeRegion = 'South Central' as RegionName,
  allowCOD = true,
  existingTechniciansByRegion = {},
  onUpdateTechnician,
  onAddTechnician,
  onRemoveTechnician,
  onResetTechnicians,
  onAssignCODForTech,
  onBulkImportTechnicians,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [regionFilter, setRegionFilter] = useState('All');
  
  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [editingTech, setEditingTech] = useState<Technician | null>(null);
  const [techToDelete, setTechToDelete] = useState<Technician | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  // Form state for Add/Edit
  const [formName, setFormName] = useState('');
  const [formRegion, setFormRegion] = useState(() => {
    if (activeRegion === 'South Central') return 'TX (Dallas)';
    return activeRegion || 'General';
  });
  const [customRegion, setCustomRegion] = useState('');
  const [formTeam, setFormTeam] = useState('Team Central (Navy)');
  const [formColorGroup, setFormColorGroup] = useState<'navy' | 'orange' | 'burgundy' | 'green'>('navy');
  const [formCameras, setFormCameras] = useState(25);
  const [formMachines, setFormMachines] = useState(4);
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formActive, setFormActive] = useState(true);
  const [formError, setFormError] = useState('');

  // Calculate project counts per technician
  const techProjectCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    projects.forEach((p) => {
      if (p.technician && p.technician !== 'Unassigned') {
        counts[p.technician] = (counts[p.technician] || 0) + 1;
      }
    });
    return counts;
  }, [projects]);

  // Overall statistics
  const stats = useMemo(() => {
    const totalTechs = technicians.length;
    const activeTechs = technicians.filter((t) => t.active).length;
    const totalCameras = technicians.reduce((sum, t) => sum + (t.cameras || 0), 0);
    const totalMachines = technicians.reduce((sum, t) => sum + (t.machines || 0), 0);
    const assignedProjectsCount = (Object.values(techProjectCounts) as number[]).reduce((sum, val) => sum + val, 0);

    return {
      totalTechs,
      activeTechs,
      totalCameras,
      totalMachines,
      assignedProjectsCount,
    };
  }, [technicians, techProjectCounts]);

  // Filtered technician list
  const filteredTechnicians = useMemo(() => {
    return technicians.filter((t) => {
      // Search matching
      const q = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !q ||
        t.name.toLowerCase().includes(q) ||
        (t.region && t.region.toLowerCase().includes(q)) ||
        (t.team && t.team.toLowerCase().includes(q)) ||
        (t.phone && t.phone.toLowerCase().includes(q)) ||
        (t.email && t.email.toLowerCase().includes(q));

      // Region filter
      let matchesRegion = true;
      if (regionFilter !== 'All') {
        if (regionFilter === 'Other') {
          matchesRegion = !['TX (Dallas)', 'TX (Houston)', 'LA', 'CO'].some((r) =>
            t.region?.toUpperCase().includes(r.toUpperCase())
          );
        } else {
          matchesRegion = (t.region || '').toLowerCase().includes(regionFilter.toLowerCase());
        }
      }

      return matchesSearch && matchesRegion;
    });
  }, [technicians, searchTerm, regionFilter]);

  // Quick inline update handler
  const handleQuickUpdate = (tech: Technician, updates: Partial<Technician>) => {
    const updated = { ...tech, ...updates };
    onUpdateTechnician(updated);
  };

  // Open Edit Modal
  const handleOpenEdit = (tech: Technician) => {
    setEditingTech(tech);
    setFormName(tech.name);
    if (REGION_PRESETS.includes(tech.region)) {
      setFormRegion(tech.region);
      setCustomRegion('');
    } else {
      setFormRegion('Other');
      setCustomRegion(tech.region || '');
    }
    setFormTeam(tech.team);
    setFormColorGroup(tech.colorGroup || 'navy');
    setFormCameras(tech.cameras ?? 25);
    setFormMachines(tech.machines ?? 4);
    setFormPhone(tech.phone || '');
    setFormEmail(tech.email || '');
    setFormActive(tech.active ?? true);
    setFormError('');
  };

  // Open Add Modal
  const handleOpenAdd = () => {
    setIsAddModalOpen(true);
    setFormName('');
    setFormRegion('TX (Dallas)');
    setCustomRegion('');
    setFormTeam('Team Central (Navy)');
    setFormColorGroup('navy');
    setFormCameras(25);
    setFormMachines(4);
    setFormPhone('');
    setFormEmail('');
    setFormActive(true);
    setFormError('');
  };

  // Save changes from Edit Modal
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTech) return;

    const trimmedName = formName.trim();
    if (!trimmedName) {
      setFormError('Technician name cannot be blank.');
      return;
    }

    // Check duplicate name against others
    const duplicate = technicians.some(
      (t) => t.id !== editingTech.id && t.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (duplicate) {
      setFormError(`A technician named "${trimmedName}" already exists.`);
      return;
    }

    const finalRegion =
      formRegion === 'Other' ? customRegion.trim() || 'General' : formRegion;

    const updatedTech: Technician = {
      ...editingTech,
      name: trimmedName,
      region: finalRegion,
      team: formTeam,
      colorGroup: formColorGroup,
      cameras: Math.max(0, Number(formCameras) || 0),
      machines: Math.max(0, Number(formMachines) || 0),
      phone: formPhone.trim() || undefined,
      email: formEmail.trim() || undefined,
      active: formActive,
    };

    onUpdateTechnician(updatedTech, editingTech.name);
    setEditingTech(null);
  };

  // Save new Technician from Add Modal
  const handleSaveAdd = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = formName.trim();
    if (!trimmedName) {
      setFormError('Technician name is required.');
      return;
    }

    const duplicate = technicians.some(
      (t) => t.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (duplicate) {
      setFormError(`A technician named "${trimmedName}" already exists in ${activeRegion}.`);
      return;
    }

    const finalRegion =
      formRegion === 'Other' ? (customRegion.trim() || activeRegion || 'General') : formRegion;
    const baseId = trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const id = `tech-${baseId}-${Date.now().toString().slice(-4)}`;

    const newTech: Technician = {
      id,
      name: trimmedName,
      region: finalRegion,
      operationalRegion: activeRegion,
      team: formTeam,
      colorGroup: formColorGroup,
      cameras: Math.max(0, Number(formCameras) || 0),
      machines: Math.max(0, Number(formMachines) || 0),
      phone: formPhone.trim() || undefined,
      email: formEmail.trim() || undefined,
      active: formActive,
    };

    onAddTechnician(newTech);
    setIsAddModalOpen(false);
  };

  const getColorGroupBadge = (color?: string) => {
    switch (color) {
      case 'orange':
        return 'bg-amber-950/80 text-amber-300 border-amber-600/50';
      case 'burgundy':
        return 'bg-rose-950/80 text-rose-300 border-rose-600/50';
      case 'green':
        return 'bg-emerald-950/80 text-emerald-300 border-emerald-600/50';
      case 'navy':
      default:
        return 'bg-blue-950/80 text-blue-300 border-blue-600/50';
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Banner & Statistics Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-base font-bold text-white flex items-center gap-2">
                  <span>Manage Field Technicians</span>
                  {activeRegion && (
                    <span className="text-xs bg-cyan-950/80 text-cyan-300 border border-cyan-700/60 px-2 py-0.5 rounded-md font-semibold">
                      {activeRegion}
                    </span>
                  )}
                  <span className="text-xs bg-slate-800 text-cyan-300 px-2.5 py-0.5 rounded-full font-mono font-bold border border-slate-700">
                    {technicians.length} Roster Members
                  </span>
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Dedicated technician roster for {activeRegion}. Adding or modifying a technician here only affects {activeRegion}.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              id="btn-add-tech-top"
              type="button"
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs rounded-lg shadow-md transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Add Technician</span>
            </button>

            {onBulkImportTechnicians && (
              <button
                id="btn-upload-techs-top"
                type="button"
                onClick={() => setIsUploadModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-cyan-200 border border-cyan-500/40 hover:border-cyan-400 font-bold text-xs rounded-lg shadow-sm transition-all cursor-pointer"
                title="Batch upload technician roster and equipment from CSV"
              >
                <Upload className="w-4 h-4 text-cyan-400" />
                <span>Upload Technicians File</span>
              </button>
            )}

            {onResetTechnicians && (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                title="Reset roster back to default technicians"
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-300 text-xs font-semibold rounded-lg border border-slate-700 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                <span>Reset Roster</span>
              </button>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-800">
          <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-2.5">
            <div className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-cyan-400" />
              <span>Active Technicians</span>
            </div>
            <div className="text-xl font-bold font-mono text-white mt-1">
              {stats.activeTechs} <span className="text-xs font-normal text-slate-500">/ {stats.totalTechs}</span>
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-2.5">
            <div className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5 text-cyan-400" />
              <span>Total Fleet Cameras</span>
            </div>
            <div className="text-xl font-bold font-mono text-cyan-400 mt-1">
              {stats.totalCameras} <span className="text-xs font-normal text-slate-500">units</span>
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-2.5">
            <div className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
              <Cog className="w-3.5 h-3.5 text-amber-400" />
              <span>Total Fleet Machines</span>
            </div>
            <div className="text-xl font-bold font-mono text-amber-400 mt-1">
              {stats.totalMachines} <span className="text-xs font-normal text-slate-500">units</span>
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-2.5">
            <div className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-emerald-400" />
              <span>Total Active Jobs</span>
            </div>
            <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
              {stats.assignedProjectsCount} <span className="text-xs font-normal text-slate-500">assigned</span>
            </div>
          </div>
        </div>
      </div>

      {/* Reset Confirmation Banner */}
      {confirmReset && (
        <div className="p-3.5 bg-amber-950/70 border border-amber-500/40 rounded-xl flex items-center justify-between gap-3 text-xs animate-in fade-in">
          <div className="flex items-center gap-2 text-amber-200 font-medium">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Are you sure you want to reset the technician roster back to the standard NDS technicians?</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setConfirmReset(false)}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (onResetTechnicians) onResetTechnicians();
                setConfirmReset(false);
              }}
              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded text-xs cursor-pointer shadow"
            >
              Confirm Reset
            </button>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, location, team..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700/80 rounded-lg pl-9 pr-3.5 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Region Filter Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider mr-1 flex items-center gap-1 shrink-0">
            <Filter className="w-3 h-3" /> Location:
          </span>
          {['All', 'Dallas', 'Houston', 'LA', 'CO', 'Other'].map((reg) => (
            <button
              key={reg}
              onClick={() => setRegionFilter(reg)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
                regionFilter === reg
                  ? 'bg-cyan-600 text-white font-bold shadow-sm'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              {reg}
            </button>
          ))}
        </div>
      </div>

      {/* Technicians List Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs min-w-[850px]">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-300 uppercase tracking-wider font-semibold text-[11px]">
                <th className="py-3 px-4">Technician</th>
                <th className="py-3 px-3">Location / Region</th>
                <th className="py-3 px-3">Team Assignment</th>
                <th className="py-3 px-3 text-center">Cameras (Units)</th>
                <th className="py-3 px-3 text-center">Machines (Units)</th>
                <th className="py-3 px-3 text-center">Active Jobs</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredTechnicians.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="p-3 bg-slate-800/80 rounded-full text-slate-400">
                        <Users className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-300">No technicians found in this view</p>
                        <p className="text-xs text-slate-500 mt-0.5">Upload your technician roster file or add members manually.</p>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        {onBulkImportTechnicians && (
                          <button
                            type="button"
                            onClick={() => setIsUploadModalOpen(true)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/40 rounded-lg text-xs font-semibold"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>Upload Technicians File</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleOpenAdd}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg text-xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Manually</span>
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTechnicians.map((tech) => {
                  const jobCount = techProjectCounts[tech.name] || 0;
                  return (
                    <tr
                      key={tech.id}
                      className="hover:bg-slate-800/40 transition-colors group"
                    >
                      {/* Name & Avatar */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs uppercase shadow-sm ${
                              tech.colorGroup === 'orange'
                                ? 'bg-amber-600 text-slate-950'
                                : tech.colorGroup === 'burgundy'
                                ? 'bg-rose-700 text-white'
                                : tech.colorGroup === 'green'
                                ? 'bg-emerald-600 text-slate-950'
                                : 'bg-blue-600 text-white'
                            }`}
                          >
                            {tech.name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-white text-sm group-hover:text-cyan-300 transition-colors">
                              {tech.name}
                            </div>
                            {(tech.phone || tech.email) && (
                              <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                                {tech.phone && (
                                  <span className="flex items-center gap-0.5">
                                    <Phone className="w-2.5 h-2.5" /> {tech.phone}
                                  </span>
                                )}
                                {tech.email && (
                                  <span className="flex items-center gap-0.5">
                                    <Mail className="w-2.5 h-2.5" /> {tech.email}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Location / Region (Inline Selectable) */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          <select
                            value={tech.region}
                            onChange={(e) => handleQuickUpdate(tech, { region: e.target.value })}
                            className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
                          >
                            {REGION_PRESETS.filter((r) => r !== 'Other').map((reg) => (
                              <option key={reg} value={reg}>
                                {reg}
                              </option>
                            ))}
                            {!REGION_PRESETS.includes(tech.region) && (
                              <option value={tech.region}>{tech.region}</option>
                            )}
                          </select>
                        </div>
                      </td>

                      {/* Team Assignment */}
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getColorGroupBadge(
                            tech.colorGroup
                          )}`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                          <span>{tech.team || 'Standard Team'}</span>
                        </span>
                      </td>

                      {/* Cameras Stepper & Inline Input */}
                      <td className="py-3 px-3 text-center">
                        <div className="inline-flex items-center border border-slate-700 rounded-lg bg-slate-950 overflow-hidden shadow-inner">
                          <button
                            type="button"
                            onClick={() =>
                              handleQuickUpdate(tech, {
                                cameras: Math.max(0, (tech.cameras || 0) - 1),
                              })
                            }
                            className="px-2 py-1 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                            title="Decrease cameras"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="0"
                            value={tech.cameras ?? 0}
                            onChange={(e) =>
                              handleQuickUpdate(tech, {
                                cameras: Math.max(0, parseInt(e.target.value, 10) || 0),
                              })
                            }
                            className="w-12 text-center bg-transparent text-cyan-400 font-mono font-bold text-xs py-1 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              handleQuickUpdate(tech, {
                                cameras: (tech.cameras || 0) + 1,
                              })
                            }
                            className="px-2 py-1 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                            title="Increase cameras"
                          >
                            +
                          </button>
                        </div>
                      </td>

                      {/* Machines Stepper & Inline Input */}
                      <td className="py-3 px-3 text-center">
                        <div className="inline-flex items-center border border-slate-700 rounded-lg bg-slate-950 overflow-hidden shadow-inner">
                          <button
                            type="button"
                            onClick={() =>
                              handleQuickUpdate(tech, {
                                machines: Math.max(0, (tech.machines || 0) - 1),
                              })
                            }
                            className="px-2 py-1 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                            title="Decrease machines"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="0"
                            value={tech.machines ?? 0}
                            onChange={(e) =>
                              handleQuickUpdate(tech, {
                                machines: Math.max(0, parseInt(e.target.value, 10) || 0),
                              })
                            }
                            className="w-12 text-center bg-transparent text-amber-400 font-mono font-bold text-xs py-1 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              handleQuickUpdate(tech, {
                                machines: (tech.machines || 0) + 1,
                              })
                            }
                            className="px-2 py-1 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                            title="Increase machines"
                          >
                            +
                          </button>
                        </div>
                      </td>

                      {/* Active Jobs */}
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-mono font-bold ${
                            jobCount > 0
                              ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/60'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {jobCount} jobs
                        </span>
                      </td>

                      {/* Active Toggle */}
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleQuickUpdate(tech, { active: !tech.active })}
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                            tech.active
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-600/50'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {tech.active ? 'Active' : 'Inactive'}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {allowCOD && onAssignCODForTech && (
                            <button
                              type="button"
                              onClick={() => onAssignCODForTech(tech.name)}
                              className="px-2 py-1 bg-amber-950/70 hover:bg-amber-900/80 text-amber-300 border border-amber-600/40 rounded text-xs font-semibold transition-colors"
                              title="Assign COD for technician"
                            >
                              COD
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(tech)}
                            className="p-1.5 text-slate-400 hover:text-cyan-300 hover:bg-slate-800 rounded-lg transition-colors"
                            title="Edit technician details"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setTechToDelete(tech)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                            title="Delete technician"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Technician Modal */}
      {editingTech && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-cyan-400" />
                <h3 className="font-bold text-white text-base">Edit Technician Details</h3>
              </div>
              <button
                onClick={() => setEditingTech(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-rose-950/60 border border-rose-500/50 rounded-lg text-rose-300">
                  {formError}
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              {/* Location / Region */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Region / Market *</label>
                  <select
                    value={formRegion}
                    onChange={(e) => setFormRegion(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  >
                    {REGION_PRESETS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
                {formRegion === 'Other' && (
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Custom Location *</label>
                    <input
                      type="text"
                      placeholder="e.g. Phoenix, AZ"
                      value={customRegion}
                      onChange={(e) => setCustomRegion(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    />
                  </div>
                )}
              </div>

              {/* Team Assignment */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Team & Color Group</label>
                <div className="grid grid-cols-2 gap-2">
                  {TEAMS.map((tm) => (
                    <button
                      key={tm.name}
                      type="button"
                      onClick={() => {
                        setFormTeam(tm.name);
                        setFormColorGroup(tm.colorGroup);
                      }}
                      className={`p-2 rounded-lg border text-left flex items-center gap-2 transition-all ${
                        formTeam === tm.name
                          ? 'border-cyan-500 bg-cyan-950/30 text-white'
                          : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <span className={`w-3 h-3 rounded-full ${tm.bg}`}></span>
                      <span className="truncate">{tm.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Cameras & Machines Inventory */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1 flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-cyan-400" /> Number of Cameras *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formCameras}
                    onChange={(e) => setFormCameras(parseInt(e.target.value, 10) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-cyan-400 font-mono font-bold focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1 flex items-center gap-1.5">
                    <Cog className="w-3.5 h-3.5 text-amber-400" /> Number of Machines *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formMachines}
                    onChange={(e) => setFormMachines(parseInt(e.target.value, 10) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-amber-400 font-mono font-bold focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
              </div>

              {/* Phone & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Phone (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. (214) 555-0199"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Email (Optional)</label>
                  <input
                    type="email"
                    placeholder="tech@ndsdata.com"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="chk-tech-active"
                  checked={formActive}
                  onChange={(e) => setFormActive(e.target.checked)}
                  className="rounded border-slate-700 text-cyan-500 focus:ring-cyan-500"
                />
                <label htmlFor="chk-tech-active" className="text-slate-300 font-semibold cursor-pointer">
                  Active Technician (Available for dispatch & scheduling)
                </label>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingTech(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold rounded-lg shadow-md"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Technician Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-cyan-400" />
                <h3 className="font-bold text-white text-base">Add New Field Technician</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAdd} className="p-6 space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-rose-950/60 border border-rose-500/50 rounded-lg text-rose-300">
                  {formError}
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Marcus Vance"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              {/* Location / Region */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Region / Market *</label>
                  <select
                    value={formRegion}
                    onChange={(e) => setFormRegion(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  >
                    {REGION_PRESETS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
                {formRegion === 'Other' && (
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Custom Location *</label>
                    <input
                      type="text"
                      placeholder="e.g. Phoenix, AZ"
                      value={customRegion}
                      onChange={(e) => setCustomRegion(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    />
                  </div>
                )}
              </div>

              {/* Team Assignment */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Team & Color Group</label>
                <div className="grid grid-cols-2 gap-2">
                  {TEAMS.map((tm) => (
                    <button
                      key={tm.name}
                      type="button"
                      onClick={() => {
                        setFormTeam(tm.name);
                        setFormColorGroup(tm.colorGroup);
                      }}
                      className={`p-2 rounded-lg border text-left flex items-center gap-2 transition-all ${
                        formTeam === tm.name
                          ? 'border-cyan-500 bg-cyan-950/30 text-white'
                          : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <span className={`w-3 h-3 rounded-full ${tm.bg}`}></span>
                      <span className="truncate">{tm.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Cameras & Machines Inventory */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1 flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-cyan-400" /> Number of Cameras *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formCameras}
                    onChange={(e) => setFormCameras(parseInt(e.target.value, 10) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-cyan-400 font-mono font-bold focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1 flex items-center gap-1.5">
                    <Cog className="w-3.5 h-3.5 text-amber-400" /> Number of Machines *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formMachines}
                    onChange={(e) => setFormMachines(parseInt(e.target.value, 10) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-amber-400 font-mono font-bold focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
              </div>

              {/* Phone & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Phone (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. (214) 555-0199"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Email (Optional)</label>
                  <input
                    type="email"
                    placeholder="tech@ndsdata.com"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold rounded-lg shadow-md"
                >
                  Create Technician
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {techToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-rose-500/50 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-3 bg-rose-500/10 rounded-xl border border-rose-500/20">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Remove Technician?</h3>
                <p className="text-xs text-slate-400">This action will remove them from the fleet roster.</p>
              </div>
            </div>

            <p className="text-xs text-slate-300">
              Are you sure you want to remove <strong className="text-white font-bold">{techToDelete.name}</strong> ({techToDelete.region})?
              {techProjectCounts[techToDelete.name] > 0 && (
                <span className="block mt-2 text-amber-300 bg-amber-950/60 p-2.5 rounded-lg border border-amber-600/40">
                  ⚠️ Note: {techProjectCounts[techToDelete.name]} scheduled project(s) assigned to this technician will be automatically moved to <strong>Unassigned</strong>.
                </span>
              )}
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setTechToDelete(null)}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onRemoveTechnician(techToDelete.id);
                  setTechToDelete(null);
                }}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold shadow"
              >
                Yes, Remove Technician
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Technicians Modal */}
      {isUploadModalOpen && onBulkImportTechnicians && (
        <UploadTechniciansModal
          isOpen={isUploadModalOpen}
          activeRegion={activeRegion}
          existingTechniciansByRegion={existingTechniciansByRegion}
          onClose={() => setIsUploadModalOpen(false)}
          onImport={(items, mode) => {
            onBulkImportTechnicians(items, mode);
            setIsUploadModalOpen(false);
          }}
        />
      )}
    </div>
  );
};
