import React, { useState } from 'react';
import { Technician, Project, RegionName } from '../types';
import {
  X,
  UserPlus,
  Trash2,
  Users,
  Camera,
  Cog,
  Search,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Upload,
} from 'lucide-react';
import { UploadTechniciansModal, BulkImportItem } from './UploadTechniciansModal';

interface ManageTechniciansModalProps {
  technicians: Technician[];
  activeRegion?: RegionName;
  projects?: Project[];
  existingTechniciansByRegion?: Record<RegionName, Technician[]>;
  onClose: () => void;
  onAddTechnician: (tech: Technician) => void;
  onRemoveTechnician: (techId: string) => void;
  onResetTechnicians?: () => void;
  onBulkImportTechnicians?: (items: BulkImportItem[], mode: 'update' | 'append' | 'replace') => void;
  initialAddNew?: boolean;
}

export const ManageTechniciansModal: React.FC<ManageTechniciansModalProps> = ({
  technicians,
  activeRegion = 'South Central' as RegionName,
  projects = [],
  existingTechniciansByRegion = {},
  onClose,
  onAddTechnician,
  onRemoveTechnician,
  onResetTechnicians,
  onBulkImportTechnicians,
  initialAddNew = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddingNew, setIsAddingNew] = useState(initialAddNew);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  // New Technician form state
  const [newName, setNewName] = useState('');
  const [newRegion, setNewRegion] = useState(() => {
    if (activeRegion === 'South Central') return 'TX (Dallas)';
    return activeRegion || 'General';
  });
  const [customRegion, setCustomRegion] = useState('');
  const [newColorGroup, setNewColorGroup] = useState<'navy' | 'orange' | 'burgundy' | 'green'>('navy');
  const [newCameras, setNewCameras] = useState(25);
  const [newMachines, setNewMachines] = useState(4);
  const [formError, setFormError] = useState('');

  // Delete confirmation state
  const [confirmDeleteTech, setConfirmDeleteTech] = useState<Technician | null>(null);

  const getTeamNameForColor = (color: 'navy' | 'orange' | 'burgundy' | 'green') => {
    switch (color) {
      case 'navy':
        return `${activeRegion} (Team Central)`;
      case 'orange':
        return `${activeRegion} (Team North)`;
      case 'burgundy':
        return `${activeRegion} (Team South)`;
      case 'green':
        return `${activeRegion} (Team West)`;
    }
  };

  const handleCreateTech = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const trimmedName = newName.trim();
    if (!trimmedName) {
      setFormError('Please enter the technician full name.');
      return;
    }

    // Check duplicate
    const exists = technicians.some(
      (t) => t.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (exists) {
      setFormError(`A technician named "${trimmedName}" already exists in ${activeRegion}.`);
      return;
    }

    const finalRegion = newRegion === 'custom' ? (customRegion.trim() || activeRegion || 'General') : newRegion;
    const baseId = trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const id = `${baseId}-${Date.now().toString().slice(-4)}`;

    const newTech: Technician = {
      id,
      name: trimmedName,
      region: finalRegion,
      operationalRegion: activeRegion,
      team: getTeamNameForColor(newColorGroup),
      colorGroup: newColorGroup,
      cameras: Math.max(0, newCameras),
      machines: Math.max(0, newMachines),
      active: true,
    };

    onAddTechnician(newTech);
    setNewName('');
    setCustomRegion('');
    setIsAddingNew(false);
  };

  const filteredTechs = technicians.filter((t) => {
    const q = searchTerm.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      t.region.toLowerCase().includes(q) ||
      t.team.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-3xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Manage Field Technicians</span>
                {activeRegion && (
                  <span className="text-xs bg-cyan-950/80 text-cyan-300 border border-cyan-700/60 px-2 py-0.5 rounded-md font-semibold">
                    {activeRegion}
                  </span>
                )}
                <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-mono font-medium">
                  {technicians.length} Active
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                {activeRegion
                  ? `Dedicated technician roster for ${activeRegion}. Changes here do not affect any other region.`
                  : 'Add, remove, and configure technician rosters.'}
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

        {/* Action Toolbar */}
        <div className="px-6 py-3 border-b border-slate-800 bg-slate-900/50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search technician by name, region, team..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700/80 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="flex items-center gap-2">
            {!isAddingNew ? (
              <>
                <button
                  type="button"
                  onClick={() => setIsAddingNew(true)}
                  className="px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-md transition-all shrink-0"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>+ Add Technician</span>
                </button>

                {onBulkImportTechnicians && (
                  <button
                    type="button"
                    onClick={() => setIsUploadModalOpen(true)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-cyan-200 border border-cyan-500/40 rounded-lg flex items-center gap-1.5 font-bold text-xs shadow-sm transition-all shrink-0"
                    title="Upload CSV roster to import technicians and equipment"
                  >
                    <Upload className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Upload File</span>
                  </button>
                )}
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIsAddingNew(false);
                  setFormError('');
                }}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg flex items-center gap-1 transition-colors shrink-0"
              >
                <span>Cancel</span>
              </button>
            )}

            {onResetTechnicians && (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                title="Reset back to default NDS roster"
                className="p-1.5 text-slate-400 hover:text-amber-300 hover:bg-slate-800 rounded-lg border border-slate-800 transition-colors shrink-0"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Reset Confirmation Banner */}
        {confirmReset && (
          <div className="p-3 bg-amber-950/60 border-b border-amber-500/40 flex items-center justify-between gap-3 text-xs animate-fade-in">
            <div className="flex items-center gap-2 text-amber-200 font-medium">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Reset technician roster back to default 14 technicians?</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onResetTechnicians?.();
                  setConfirmReset(false);
                }}
                className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 font-bold text-slate-950"
              >
                Yes, Reset Roster
              </button>
            </div>
          </div>
        )}

        {/* Collapsible Add Technician Form */}
        {isAddingNew && (
          <form
            onSubmit={handleCreateTech}
            className="p-5 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950/30 border-b border-cyan-500/30 space-y-4 animate-fade-in"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                <UserPlus className="w-4 h-4 text-cyan-400" />
                <span>New Field Technician Details</span>
              </h3>
              <span className="text-[11px] text-slate-400">All fields automatically sync with scheduler</span>
            </div>

            {formError && (
              <div className="p-2.5 rounded-lg bg-rose-950/80 border border-rose-500 text-rose-200 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Full Name */}
              <div className="lg:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Technician Full Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Marcus Brody"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-medium"
                  autoFocus
                />
              </div>

              {/* Region */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Operational Region
                </label>
                <select
                  value={newRegion}
                  onChange={(e) => setNewRegion(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-medium"
                >
                  <option value="TX (Dallas)">TX (Dallas)</option>
                  <option value="TX (Houston)">TX (Houston)</option>
                  <option value="LA">LA (Louisiana)</option>
                  <option value="CO">CO (Colorado)</option>
                  <option value="custom">Custom Region...</option>
                </select>
              </div>

              {/* Team / Color Group */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Color Group & Team
                </label>
                <select
                  value={newColorGroup}
                  onChange={(e) => setNewColorGroup(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-medium"
                >
                  <option value="navy">Navy - Team Central</option>
                  <option value="orange">Orange - Team North</option>
                  <option value="burgundy">Burgundy - Team Louisiana</option>
                  <option value="green">Green - Team West/Colo</option>
                </select>
              </div>

              {/* Custom Region field if selected */}
              {newRegion === 'custom' && (
                <div className="lg:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Custom Region Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Austin, TX or Bay Area"
                    value={customRegion}
                    onChange={(e) => setCustomRegion(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              )}

              {/* Base Cameras */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Base Camera Stock
                </label>
                <div className="relative">
                  <Camera className="w-3.5 h-3.5 text-cyan-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="number"
                    step="any"
                    min={0}
                    max={999}
                    value={newCameras}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setNewCameras(isNaN(val) ? 0 : Math.round(val));
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-cyan-300 font-mono font-bold focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Base Machines */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Base Machine Stock
                </label>
                <div className="relative">
                  <Cog className="w-3.5 h-3.5 text-amber-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="number"
                    step="any"
                    min={0}
                    max={999}
                    value={newMachines}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setNewMachines(isNaN(val) ? 0 : Math.round(val));
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-amber-300 font-mono font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddingNew(false)}
                className="px-3 py-1.5 text-xs rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-bold rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 flex items-center gap-1.5 shadow-md"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Save & Add to Matrix</span>
              </button>
            </div>
          </form>
        )}

        {/* Delete Confirmation Alert */}
        {confirmDeleteTech && (
          <div className="m-4 p-4 rounded-xl bg-rose-950/90 border border-rose-500/80 text-white space-y-2 animate-fade-in shadow-xl">
            <div className="flex items-center gap-2 text-rose-300 font-bold text-sm">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
              <span>Confirm Removal of {confirmDeleteTech.name}</span>
            </div>
            <p className="text-xs text-slate-200">
              Removing <strong>{confirmDeleteTech.name}</strong> will remove them from the Scheduler Matrix and Capacity View.
              Any active projects assigned to this technician will be set to <span className="underline font-bold">Unassigned</span>.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteTech(null)}
                className="px-3 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onRemoveTechnician(confirmDeleteTech.id);
                  setConfirmDeleteTech(null);
                }}
                className="px-3 py-1 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-500 text-white shadow"
              >
                Yes, Remove Technician
              </button>
            </div>
          </div>
        )}

        {/* Technicians List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-2.5">
          {filteredTechs.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-xs">
              No technicians found matching &quot;{searchTerm}&quot;
            </div>
          ) : (
            filteredTechs.map((tech) => {
              const assignedProjects = (projects || []).filter(
                (p) => p.technician === tech.name
              );
              const totalEquip = assignedProjects.reduce((acc, p) => acc + (p.equipmentCount || 0), 0);

              const colorBorder =
                tech.colorGroup === 'navy'
                  ? 'border-blue-800/60 bg-blue-950/20'
                  : tech.colorGroup === 'orange'
                  ? 'border-amber-700/60 bg-amber-950/20'
                  : tech.colorGroup === 'burgundy'
                  ? 'border-rose-800/60 bg-rose-950/20'
                  : 'border-emerald-800/60 bg-emerald-950/20';

              return (
                <div
                  key={tech.id}
                  className={`rounded-xl border p-3 flex items-center justify-between gap-3 transition-all hover:bg-slate-800/50 ${colorBorder}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 shadow-inner ${
                        tech.colorGroup === 'navy'
                          ? 'bg-blue-900 text-blue-200'
                          : tech.colorGroup === 'orange'
                          ? 'bg-amber-800 text-amber-200'
                          : tech.colorGroup === 'burgundy'
                          ? 'bg-rose-900 text-rose-200'
                          : 'bg-emerald-900 text-emerald-200'
                      }`}
                    >
                      {tech.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-white text-sm truncate">{tech.name}</h4>
                        <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                          {tech.region}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                        <span className="truncate">{tech.team}</span>
                        <span className="flex items-center gap-1 text-cyan-300 font-mono">
                          <Camera className="w-3 h-3 text-cyan-400" />
                          <span>{tech.cameras} Cams</span>
                        </span>
                        <span className="flex items-center gap-1 text-amber-300 font-mono">
                          <Cog className="w-3 h-3 text-amber-400" />
                          <span>{tech.machines} Mach</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right hidden sm:block">
                      <span className="text-xs font-mono font-bold text-white block">
                        {assignedProjects.length} Active Jobs
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono block">
                        {totalEquip} units in field
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setConfirmDeleteTech(tech)}
                      title={`Remove ${tech.name}`}
                      className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-950/50 rounded-lg border border-transparent hover:border-rose-800 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400">
          <span>Total Technicians: {technicians.length}</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs transition-colors"
          >
            Done
          </button>
        </div>
      </div>

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
