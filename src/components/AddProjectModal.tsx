import React, { useState } from 'react';
import { Project, OpsStatus, ScheduleStatus, StudyType, WeekDay, EquipmentType, Technician } from '../types';
import { TECHNICIANS } from '../data/technicians';
import { X, Plus, Calendar, MapPin, Wrench, Camera, Cog, ArrowDownCircle, ArrowUpCircle, RefreshCw } from 'lucide-react';
import { DateTimePicker } from './DateTimePicker';
import { calculateBatterySwaps } from '../utils/batterySwapEngine';

interface AddProjectModalProps {
  onClose: () => void;
  onAdd: (newProject: Project) => void;
  technicians?: Technician[];
  defaultTech?: string;
  defaultDay?: WeekDay;
  allowCOD?: boolean;
}

export const AddProjectModal: React.FC<AddProjectModalProps> = ({
  onClose,
  onAdd,
  technicians,
  defaultTech = 'Unassigned',
  defaultDay = 'Thursday',
  allowCOD = false,
}) => {
  const techList = technicians && technicians.length > 0 ? technicians : TECHNICIANS;
  const [formData, setFormData] = useState<Partial<Project>>({
    id: `26-${Math.floor(100000 + Math.random() * 900000)}`,
    cityState: 'Austin, TX',
    studyType: 'TMC',
    opsStatus: defaultTech !== 'Unassigned' ? 'Scheduled to techs' : 'Needs Scheduling',
    scheduleStatus: 'Schedule Sent',
    version: 'Initial',
    technician: defaultTech,
    installDay: defaultDay,
    teardownDay: 'Friday',
    equipmentCount: 4,
    locationsCount: 2,
    collectionWindow: '9/3 (CRD)',
    collectionDay: '9/3',
    urgency: 'Priority Client',
    schedulerNotes: 'Collecting 9/3',
  });

  const handleApplyDuration = (days: number) => {
    const install = formData.installDay || defaultDay || 'Monday';
    const computed = calculateBatterySwaps({
      collectionWindow: formData.collectionWindow,
      collectionDay: formData.collectionDay,
      schedulerNotes: formData.schedulerNotes,
      installDay: install,
      studyType: formData.studyType,
      consecutiveCollectionDays: days,
    });

    setFormData({
      ...formData,
      installDay: install,
      consecutiveCollectionDays: days,
      batterySwapDays: computed.batterySwapDays,
      batterySwapDates: computed.batterySwapDates,
      batterySwapDay: computed.batterySwapDay,
      teardownDay: computed.teardownDay || formData.teardownDay || 'Friday',
    });
  };

  const handleInstallDayChange = (newDay: WeekDay) => {
    if (newDay && formData.consecutiveCollectionDays && formData.consecutiveCollectionDays >= 2) {
      const computed = calculateBatterySwaps({
        ...formData,
        installDay: newDay,
        consecutiveCollectionDays: formData.consecutiveCollectionDays,
      });
      setFormData({
        ...formData,
        installDay: newDay,
        batterySwapDays: computed.batterySwapDays,
        batterySwapDates: computed.batterySwapDates,
        batterySwapDay: computed.batterySwapDay,
        teardownDay: computed.teardownDay || formData.teardownDay,
      });
    } else {
      setFormData({ ...formData, installDay: newDay });
    }
  };

  const handleClearSwaps = () => {
    setFormData({
      ...formData,
      consecutiveCollectionDays: undefined,
      batterySwapDay: '',
      batterySwapDays: [],
      batterySwapDates: [],
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.id) return;

    const swapResult = calculateBatterySwaps({
      collectionWindow: formData.collectionWindow,
      schedulerNotes: formData.schedulerNotes,
      analystNotes: formData.analystNotes,
      installDay: formData.installDay,
      teardownDay: formData.teardownDay,
      studyType: formData.studyType,
      consecutiveCollectionDays: formData.consecutiveCollectionDays,
    });

    const finalProject: Project = {
      ...(formData as Project),
      batterySwapDay: formData.batterySwapDay || swapResult.batterySwapDay || undefined,
      batterySwapDays:
        formData.batterySwapDays && formData.batterySwapDays.length > 0
          ? formData.batterySwapDays
          : swapResult.batterySwapDays.length > 0
          ? swapResult.batterySwapDays
          : undefined,
      batterySwapDates:
        formData.batterySwapDates && formData.batterySwapDates.length > 0
          ? formData.batterySwapDates
          : swapResult.batterySwapDates.length > 0
          ? swapResult.batterySwapDates
          : undefined,
      consecutiveCollectionDays:
        formData.consecutiveCollectionDays ||
        (swapResult.consecutiveDays >= 2 ? swapResult.consecutiveDays : undefined),
    };

    onAdd(finalProject);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col my-8">
        {/* Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Create New Monitoring Job</h3>
              <p className="text-xs text-slate-400">Add a traffic study to scheduler and tracking sheet</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Project #</label>
              <input
                type="text"
                required
                value={formData.id}
                onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono font-bold focus:ring-1 focus:ring-cyan-500"
                placeholder="26-480130"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-semibold mb-1">City, State</label>
              <input
                type="text"
                required
                value={formData.cityState}
                onChange={(e) => setFormData({ ...formData, cityState: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white focus:ring-1 focus:ring-cyan-500"
                placeholder="e.g. San Antonio, TX"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Study Type</label>
              <select
                value={formData.studyType}
                onChange={(e) =>
                  setFormData({ ...formData, studyType: e.target.value as StudyType })
                }
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white focus:ring-1 focus:ring-cyan-500"
              >
                <option value="TMC">TMC (Turning Movement Count)</option>
                <option value="ATR">ATR (Automatic Traffic Recorder)</option>
                <option value="ATR (Camera)">ATR (Camera)</option>
                <option value="Screenline">Screenline</option>
                <option value="Video Review">Video Review</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-400 font-semibold mb-1">STATUS (OPS)</label>
              <select
                value={formData.opsStatus}
                onChange={(e) =>
                  setFormData({ ...formData, opsStatus: e.target.value as OpsStatus })
                }
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white focus:ring-1 focus:ring-cyan-500 font-semibold"
              >
                <option value="Needs Scheduling">Needs Scheduling</option>
                <option value="Scheduled to techs">Scheduled to techs</option>
                <option value="All locations installed">All locations installed</option>
                <option value="Pending QAQC OPS">Pending QAQC OPS</option>
                <option value="Pending Delivery">Pending Delivery</option>
                <option value="Delivered">Delivered</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Assigned Technician</label>
              <select
                value={formData.technician}
                onChange={(e) => setFormData({ ...formData, technician: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white focus:ring-1 focus:ring-cyan-500"
              >
                <option value="Unassigned">Unassigned</option>
                {techList.map((t) => (
                  <option key={t.id} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Group</label>
              <select
                value={formData.group || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setFormData({
                    ...formData,
                    group: (val || undefined) as any,
                    specialBadge: val === 'COD' ? 'COD' : undefined,
                  });
                }}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white font-bold focus:ring-1 focus:ring-cyan-500"
              >
                <option value="">Standard (None)</option>
                {allowCOD && <option value="COD">COD</option>}
                <option value="PRIORITY">PRIORITY</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-400 font-semibold mb-1 flex items-center justify-between">
                <span>Collection Date (OPS)</span>
                <span className="text-[10px] text-cyan-400 font-normal">Install 1d before</span>
              </label>
              <input
                type="text"
                value={formData.collectionWindow}
                onChange={(e) => setFormData({ ...formData, collectionWindow: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white focus:ring-1 focus:ring-cyan-500"
                placeholder="e.g. 9/3 (CRD)"
              />
            </div>
          </div>

          <div>
            <DateTimePicker
              label="DATE SENT (Schedule Notification)"
              value={formData.dateSent || ''}
              onChange={(val) => setFormData({ ...formData, dateSent: val })}
              placeholder="Select calendar date & time sent..."
            />
          </div>

          {/* Collection Duration & Battery Swap Quick Selector */}
          <div className="bg-slate-900/80 border border-sky-500/30 rounded-lg p-2.5 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-sky-200">
              <RefreshCw className="w-3.5 h-3.5 text-sky-400" />
              <span className="font-semibold">Collection Duration:</span>
              <span className="text-[11px] text-slate-400">
                (Rule: Swap 1 day after install, every other day until teardown)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleApplyDuration(3)}
                className={`px-2 py-0.5 rounded text-xs font-bold border transition-colors ${
                  formData.consecutiveCollectionDays === 3
                    ? 'bg-sky-500 text-slate-950 border-sky-400'
                    : 'bg-slate-800 text-sky-300 border-slate-700 hover:bg-slate-700'
                }`}
                title="3-Day: Mon Install -> Wed Swap (1 Swap) -> Fri Teardown"
              >
                3-Day
              </button>
              <button
                type="button"
                onClick={() => handleApplyDuration(5)}
                className={`px-2 py-0.5 rounded text-xs font-bold border transition-colors ${
                  formData.consecutiveCollectionDays === 5
                    ? 'bg-sky-500 text-slate-950 border-sky-400'
                    : 'bg-slate-800 text-sky-300 border-slate-700 hover:bg-slate-700'
                }`}
                title="5-Day: Mon Install -> Wed/Fri Swaps (2 Swaps) -> Sun Teardown"
              >
                5-Day
              </button>
              <button
                type="button"
                onClick={() => handleApplyDuration(7)}
                className={`px-2 py-0.5 rounded text-xs font-bold border transition-colors ${
                  formData.consecutiveCollectionDays === 7
                    ? 'bg-sky-500 text-slate-950 border-sky-400'
                    : 'bg-slate-800 text-sky-300 border-slate-700 hover:bg-slate-700'
                }`}
                title="7-Day: Mon Install -> Wed/Fri/Sun Swaps (3 Swaps) -> Tue Teardown"
              >
                7-Day
              </button>
              {(formData.batterySwapDays && formData.batterySwapDays.length > 0) || formData.consecutiveCollectionDays ? (
                <button
                  type="button"
                  onClick={handleClearSwaps}
                  className="px-2 py-0.5 rounded text-xs text-rose-300 bg-rose-950/40 border border-rose-800/50 hover:bg-rose-900/50"
                >
                  Clear
                </button>
              ) : null}
            </div>
          </div>

          {/* Calculated Timeline Preview */}
          {formData.batterySwapDays && formData.batterySwapDays.length > 0 && (
            <div className="bg-slate-950/80 border border-sky-500/20 rounded-lg p-2 text-xs flex items-center gap-1.5 flex-wrap font-mono">
              <span className="text-[10px] text-slate-400 mr-1 font-sans">Timeline:</span>
              <span className="px-1.5 py-0.2 rounded bg-emerald-950 border border-emerald-500/50 text-emerald-300 text-[10px] font-bold">
                Install: {formData.installDay || 'Monday'}
              </span>
              {formData.batterySwapDays.map((day, idx) => (
                <span
                  key={idx}
                  className="px-1.5 py-0.2 rounded bg-sky-950 border border-sky-500/50 text-sky-300 text-[10px] font-bold"
                >
                  Swap {idx + 1}: {day}
                  {formData.batterySwapDates && formData.batterySwapDates[idx] ? ` (${formData.batterySwapDates[idx]})` : ''}
                </span>
              ))}
              <span className="px-1.5 py-0.2 rounded bg-violet-950 border border-violet-500/50 text-violet-300 text-[10px] font-bold">
                Teardown: {formData.teardownDay || 'Friday'}
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-400 font-semibold mb-1 flex items-center gap-1">
                <ArrowDownCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-300">Install Day (Green)</span>
              </label>
              <select
                value={formData.installDay}
                onChange={(e) => handleInstallDayChange(e.target.value as WeekDay)}
                className="w-full bg-emerald-950/80 border border-emerald-600/80 rounded px-2 py-1.5 text-emerald-200 font-bold focus:ring-1 focus:ring-emerald-400"
              >
                <option value="" className="bg-slate-900 text-slate-400">None</option>
                <option value="Sunday" className="bg-slate-900 text-emerald-300">Sunday (Start)</option>
                <option value="Monday" className="bg-slate-900 text-emerald-300">Monday</option>
                <option value="Tuesday" className="bg-slate-900 text-emerald-300">Tuesday</option>
                <option value="Wednesday" className="bg-slate-900 text-emerald-300">Wednesday</option>
                <option value="Thursday" className="bg-slate-900 text-emerald-300">Thursday</option>
                <option value="Friday" className="bg-slate-900 text-emerald-300">Friday</option>
                <option value="Saturday" className="bg-slate-900 text-emerald-300">Saturday</option>
                <option value="Sunday" className="bg-slate-900 text-emerald-300">Sunday (End)</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-400 font-semibold mb-1 flex items-center gap-1">
                <RefreshCw className="w-3.5 h-3.5 text-sky-400" />
                <span className="text-sky-300">Battery Swap (Sky Blue)</span>
              </label>
              <select
                value={formData.batterySwapDay || ''}
                onChange={(e) =>
                  setFormData({ ...formData, batterySwapDay: e.target.value as WeekDay })
                }
                className="w-full bg-sky-950/80 border border-sky-600/80 rounded px-2 py-1.5 text-sky-200 font-bold focus:ring-1 focus:ring-sky-400"
              >
                <option value="" className="bg-slate-900 text-slate-400">None</option>
                <option value="Sunday" className="bg-slate-900 text-sky-300">Sunday (Start)</option>
                <option value="Monday" className="bg-slate-900 text-sky-300">Monday</option>
                <option value="Tuesday" className="bg-slate-900 text-sky-300">Tuesday</option>
                <option value="Wednesday" className="bg-slate-900 text-sky-300">Wednesday</option>
                <option value="Thursday" className="bg-slate-900 text-sky-300">Thursday</option>
                <option value="Friday" className="bg-slate-900 text-sky-300">Friday</option>
                <option value="Saturday" className="bg-slate-900 text-sky-300">Saturday</option>
                <option value="Sunday" className="bg-slate-900 text-sky-300">Sunday (End)</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-400 font-semibold mb-1 flex items-center gap-1">
                <ArrowUpCircle className="w-3.5 h-3.5 text-violet-400" />
                <span className="text-violet-300">Teardown Day (Violet)</span>
              </label>
              <select
                value={formData.teardownDay}
                onChange={(e) =>
                  setFormData({ ...formData, teardownDay: e.target.value as WeekDay })
                }
                className="w-full bg-violet-950/80 border border-violet-600/80 rounded px-2 py-1.5 text-violet-200 font-bold focus:ring-1 focus:ring-violet-400"
              >
                <option value="" className="bg-slate-900 text-slate-400">None</option>
                <option value="Sunday" className="bg-slate-900 text-violet-300">Sunday (Start)</option>
                <option value="Monday" className="bg-slate-900 text-violet-300">Monday</option>
                <option value="Tuesday" className="bg-slate-900 text-violet-300">Tuesday</option>
                <option value="Wednesday" className="bg-slate-900 text-violet-300">Wednesday</option>
                <option value="Thursday" className="bg-slate-900 text-violet-300">Thursday</option>
                <option value="Friday" className="bg-slate-900 text-violet-300">Friday</option>
                <option value="Saturday" className="bg-slate-900 text-violet-300">Saturday</option>
                <option value="Sunday" className="bg-slate-900 text-violet-300">Sunday (End)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-400 font-semibold mb-1 flex items-center gap-1">
                <Camera className="w-3 h-3 text-cyan-400" />
                <span>Equipment Type</span>
              </label>
              <select
                value={formData.equipmentType || (formData.studyType === 'ATR' ? 'Machine' : 'Camera')}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    equipmentType: e.target.value as EquipmentType,
                  })
                }
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-cyan-300 font-bold"
              >
                <option value="Camera">Cams (Cam / ATR Algorithm)</option>
                <option value="Machine">Mach (ATR / Machine)</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-400 font-semibold mb-1">
                Total Units (Equipment Count)
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={formData.equipmentCount}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setFormData({ ...formData, equipmentCount: isNaN(val) ? 0 : Math.round(val) });
                }}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-amber-400 font-mono font-bold"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-semibold mb-1">No. of Locations</label>
              <input
                type="number"
                min="0"
                step="any"
                value={formData.locationsCount}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setFormData({ ...formData, locationsCount: isNaN(val) ? 0 : Math.round(val) });
                }}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono font-bold"
              />
            </div>
          </div>

          <div className="bg-slate-950 p-2 rounded border border-slate-800 text-[11px] text-slate-400">
            <span className="text-emerald-400 font-bold">Install removes</span> equipment on install day;{' '}
            <span className="text-violet-300 font-bold">Teardown returns</span> equipment on teardown day.
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-slate-400 hover:text-white rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded shadow-md transition-colors"
            >
              Add to Scheduler
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
