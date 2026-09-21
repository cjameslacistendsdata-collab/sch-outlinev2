import React, { useState } from 'react';
import { Project, OpsStatus, ScheduleStatus, StudyType, WeekDay, EquipmentType, Technician } from '../types';
import { TECHNICIANS } from '../data/technicians';
import {
  X,
  MapPin,
  Calendar,
  Wrench,
  FileText,
  User,
  CheckCircle,
  AlertCircle,
  Clock,
  Sparkles,
  Save,
  Trash2,
  Camera,
  Cog,
  ArrowDownCircle,
  ArrowUpCircle,
  BatteryCharging,
  RefreshCw,
} from 'lucide-react';
import { getOpsStatusBadge, evaluateProjectStatus } from '../utils/statusEngine';
import { toDateTimeLocalString, fromDateTimeLocalString, formatDateTimeSent } from '../utils/dateTimeFormat';
import { DateTimePicker } from './DateTimePicker';
import { calculateBatterySwaps } from '../utils/batterySwapEngine';
import { sanitizeProjectId } from '../utils/csvParser';

interface ProjectModalProps {
  project: Project;
  technicians?: Technician[];
  allowCOD?: boolean;
  onClose: () => void;
  onSave: (updated: Project) => void;
  onDelete?: (projectId: string) => void;
}

export const ProjectModal: React.FC<ProjectModalProps> = ({
  project,
  technicians,
  allowCOD = true,
  onClose,
  onSave,
  onDelete,
}) => {
  const techList = technicians && technicians.length > 0 ? technicians : TECHNICIANS;
  const [formData, setFormData] = useState<Project>({ ...project });
  const [activeTab, setActiveTab] = useState<'details' | 'notes' | 'audit'>('details');
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const audit = evaluateProjectStatus(project);
  const badge = getOpsStatusBadge(formData.opsStatus);

  const swapSchedule = calculateBatterySwaps({
    collectionWindow: formData.collectionWindow,
    collectionDay: formData.collectionDay,
    schedulerNotes: formData.schedulerNotes,
    analystNotes: formData.analystNotes,
    installDay: formData.installDay,
    teardownDay: formData.teardownDay,
    studyType: formData.studyType,
    consecutiveCollectionDays: formData.consecutiveCollectionDays,
  });

  const handleApplyDuration = (durationDays: number) => {
    const currentInstall = formData.installDay || 'Monday';
    const computed = calculateBatterySwaps({
      collectionWindow: formData.collectionWindow,
      collectionDay: formData.collectionDay,
      schedulerNotes: formData.schedulerNotes,
      analystNotes: formData.analystNotes,
      installDay: currentInstall,
      studyType: formData.studyType,
      consecutiveCollectionDays: durationDays,
    });

    setFormData({
      ...formData,
      installDay: currentInstall,
      consecutiveCollectionDays: durationDays,
      batterySwapDays: computed.batterySwapDays,
      batterySwapDates: computed.batterySwapDates,
      batterySwapDay: computed.batterySwapDay,
      teardownDay: computed.teardownDay || formData.teardownDay,
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
    let finalData = { ...formData };
    if (formData.consecutiveCollectionDays && formData.consecutiveCollectionDays >= 2) {
      const computed = calculateBatterySwaps({
        ...formData,
        installDay: formData.installDay || 'Monday',
        consecutiveCollectionDays: formData.consecutiveCollectionDays,
      });
      finalData = {
        ...finalData,
        batterySwapDays: computed.batterySwapDays,
        batterySwapDates: computed.batterySwapDates,
        batterySwapDay: computed.batterySwapDay,
        teardownDay: computed.teardownDay || finalData.teardownDay,
      };
    }
    onSave(finalData);
    onClose();
  };

  const applySuggestedStatus = () => {
    if (audit) {
      setFormData({
        ...formData,
        opsStatus: audit.suggestedStatus,
      });
    }
  };

  // Format project header: only include Project number and City, State, removing underscore and quotes
  const sanitizedIdInfo = sanitizeProjectId(formData.id);
  const displayCity = (formData.cityState && formData.cityState !== 'Statewide' && formData.cityState !== 'Unspecified')
    ? formData.cityState.replace(/["'_]/g, ' ').trim()
    : sanitizedIdInfo.cityState || 'Statewide';
  const displayTitle = sanitizedIdInfo.projectNumber
    ? (displayCity && displayCity !== 'Statewide' ? `${sanitizedIdInfo.projectNumber} ${displayCity}` : sanitizedIdInfo.id)
    : sanitizedIdInfo.id;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col my-8">
        {/* Modal Header */}
        <div className="p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-cyan-600 flex items-center justify-center font-mono font-bold text-white text-sm">
              #
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white font-mono">{displayTitle}</h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-semibold ${badge?.bg || 'bg-slate-800'} ${badge?.text || 'text-slate-300'}`}
                >
                  {formData.opsStatus}
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-rose-400" />
                <span>{displayCity}</span>
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

        {/* Tab navigation */}
        <div className="flex items-center gap-2 px-5 pt-3 border-b border-slate-800 bg-slate-950/50 text-xs">
          <button
            onClick={() => setActiveTab('details')}
            className={`pb-2.5 px-2 font-semibold border-b-2 transition-all ${
              activeTab === 'details'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Job Details & Dispatch
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={`pb-2.5 px-2 font-semibold border-b-2 transition-all ${
              activeTab === 'notes'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Scheduler & Analyst Notes
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`pb-2.5 px-2 font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'audit'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Automated Status Reason</span>
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto max-h-[calc(85vh-160px)] space-y-4">
          {/* Automated Status recommendation banner if available */}
          {audit && (
            <div className="bg-amber-950/40 border border-amber-800/80 rounded-xl p-3.5 flex items-start justify-between gap-3 text-xs">
              <div className="flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-amber-300">
                    Automated Status Update Recommended: {audit.suggestedStatus}
                  </div>
                  <div className="text-amber-200/80 mt-0.5">{audit.reason}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={applySuggestedStatus}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-2.5 py-1 rounded text-xs transition-colors shrink-0"
              >
                Apply Suggestion
              </button>
            </div>
          )}

          {activeTab === 'details' && (
            <div className="space-y-4 text-xs">
              {/* Row 1: City/State & Study */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">City, State</label>
                  <input
                    type="text"
                    value={formData.cityState}
                    onChange={(e) => setFormData({ ...formData, cityState: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    placeholder="e.g. Houston, TX"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Study Type</label>
                  <select
                    value={formData.studyType}
                    onChange={(e) =>
                      setFormData({ ...formData, studyType: e.target.value as StudyType })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  >
                    <option value="TMC">TMC (Turning Movement Count)</option>
                    <option value="ATR">ATR (Automatic Traffic Recorder)</option>
                    <option value="ATR (Camera)">ATR (Camera)</option>
                    <option value="Screenline">Screenline</option>
                    <option value="Video Review">Video Review</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Project Status & Schedule Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1 flex items-center justify-between">
                    <span>PROJECT STATUS</span>
                    <span className="text-[10px] text-slate-500 font-normal">Aligned with CSV</span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={formData.opsStatus}
                      onChange={(e) => setFormData({ ...formData, opsStatus: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-cyan-500 font-semibold text-xs"
                      placeholder="e.g. All locations installed, Pending QAQC..."
                    />
                    <select
                      value={['All locations installed', 'Pending QAQC OPS', 'Scheduled to techs', 'Needs Scheduling', 'Pending Delivery', 'Delivered'].includes(formData.opsStatus) ? formData.opsStatus : ''}
                      onChange={(e) => {
                        if (e.target.value) {
                          setFormData({ ...formData, opsStatus: e.target.value });
                        }
                      }}
                      className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-2 text-slate-300 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      title="Quick select standard status"
                    >
                      <option value="">Quick Select...</option>
                      <option value="All locations installed">All locations installed</option>
                      <option value="Pending QAQC OPS">Pending QAQC OPS</option>
                      <option value="Scheduled to techs">Scheduled to techs</option>
                      <option value="Needs Scheduling">Needs Scheduling</option>
                      <option value="Pending Delivery">Pending Delivery</option>
                      <option value="Delivered">Delivered</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">SCHEDULE STATUS</label>
                  <select
                    value={formData.scheduleStatus || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        scheduleStatus: e.target.value as ScheduleStatus,
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-cyan-500 font-medium text-xs"
                  >
                    <option value="">(Blank)</option>
                    <option value="SCHEDULE SENT">SCHEDULE SENT</option>
                    <option value="PENDING">PENDING</option>
                    {formData.scheduleStatus &&
                      !['', 'SCHEDULE SENT', 'PENDING'].includes(formData.scheduleStatus) && (
                        <option value={formData.scheduleStatus}>{formData.scheduleStatus}</option>
                      )}
                  </select>
                </div>
              </div>

              {/* Row 2.5: Version & Date Sent (Calendar with Day and Time) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">VERSION</label>
                  <select
                    value={formData.version || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        version: e.target.value as any,
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-cyan-500 font-medium text-xs"
                  >
                    <option value="">(Blank)</option>
                    <option value="INITIAL">INITIAL</option>
                    <option value="v1">v1</option>
                    <option value="v2">v2</option>
                    <option value="v3">v3</option>
                    <option value="v4">v4</option>
                    <option value="v5">v5</option>
                    <option value="v6">v6</option>
                    {formData.version &&
                      !['', 'INITIAL', 'v1', 'v2', 'v3', 'v4', 'v5', 'v6'].includes(formData.version) && (
                        <option value={formData.version}>{formData.version}</option>
                      )}
                  </select>
                </div>
                <div>
                  <DateTimePicker
                    label="DATE SENT"
                    value={formData.dateSent || ''}
                    onChange={(val) => setFormData({ ...formData, dateSent: val })}
                    placeholder="Select Date & Time Sent..."
                  />
                </div>
              </div>

              {/* Row 3: Technician, Group, & Evaluated By */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Assigned Technician
                  </label>
                  <select
                    value={formData.technician}
                    onChange={(e) => setFormData({ ...formData, technician: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-cyan-500 font-medium"
                  >
                    <option value="Unassigned">Unassigned</option>
                    {!techList.some((t) => t.name.toLowerCase() === formData.technician.toLowerCase()) &&
                      formData.technician !== 'Unassigned' && (
                        <option value={formData.technician}>
                          👥 {formData.technician} (Co-Assigned Team)
                        </option>
                      )}
                    {techList.map((t) => (
                      <option key={t.id} value={t.name}>
                        {t.name} ({t.team})
                      </option>
                    ))}
                  </select>
                  {formData.technician && (formData.technician.includes(',') || formData.technician.includes('/')) && (
                    <span className="text-[11px] text-cyan-400 font-mono mt-1 block">
                      👥 Multi-technician assignment: this project appears in each technician&apos;s individual row alongside their other projects.
                    </span>
                  )}
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Group / Project Category</label>
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
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-cyan-500 font-bold"
                  >
                    <option value="">Standard (None)</option>
                    {allowCOD && <option value="COD">COD (Client On Demand)</option>}
                    <option value="PRIORITY">PRIORITY</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Evaluated By</label>
                  <input
                    type="text"
                    value={formData.evaluatedBy || ''}
                    onChange={(e) => setFormData({ ...formData, evaluatedBy: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    placeholder="e.g. Patrick, Kat, Kyle"
                  />
                </div>
              </div>

              {/* Row 4: Install Day, Battery Swap Day & Teardown Day (Sunday to Sunday range) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold mb-1 text-emerald-400">
                    Install Day (Green)
                  </label>
                  <select
                    value={formData.installDay}
                    onChange={(e) => handleInstallDayChange(e.target.value as WeekDay)}
                    className="w-full bg-slate-950 border border-emerald-600/60 rounded-lg px-2.5 py-2 text-emerald-300 font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="">None</option>
                    <option value="Sunday">Sunday (Start)</option>
                    <option value="Monday">Monday</option>
                    <option value="Tuesday">Tuesday</option>
                    <option value="Wednesday">Wednesday</option>
                    <option value="Thursday">Thursday</option>
                    <option value="Friday">Friday</option>
                    <option value="Saturday">Saturday</option>
                    <option value="Sunday">Sunday (End)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-sky-400 flex items-center justify-between">
                    <span>Battery Swap Day</span>
                    {swapSchedule.batterySwapDays.length > 1 && (
                      <span className="text-[10px] text-sky-300 font-normal">
                        ({swapSchedule.batterySwapDays.length} swaps scheduled)
                      </span>
                    )}
                  </label>
                  <select
                    value={formData.batterySwapDay || ''}
                    onChange={(e) => {
                      const val = e.target.value as WeekDay;
                      setFormData({
                        ...formData,
                        batterySwapDay: val,
                        batterySwapDays: val ? [val] : [],
                      });
                    }}
                    className="w-full bg-slate-950 border border-sky-600/60 rounded-lg px-2.5 py-2 text-sky-300 font-semibold focus:outline-none focus:ring-1 focus:ring-sky-500"
                  >
                    <option value="">None</option>
                    <option value="Sunday">Sunday (Start)</option>
                    <option value="Monday">Monday</option>
                    <option value="Tuesday">Tuesday</option>
                    <option value="Wednesday">Wednesday</option>
                    <option value="Thursday">Thursday</option>
                    <option value="Friday">Friday</option>
                    <option value="Saturday">Saturday</option>
                    <option value="Sunday">Sunday (End)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-violet-400">
                    Teardown Day (Violet)
                  </label>
                  <select
                    value={formData.teardownDay}
                    onChange={(e) =>
                      setFormData({ ...formData, teardownDay: e.target.value as WeekDay })
                    }
                    className="w-full bg-slate-950 border border-violet-600/60 rounded-lg px-2.5 py-2 text-violet-300 font-semibold focus:outline-none focus:ring-1 focus:ring-violet-500"
                  >
                    <option value="">None</option>
                    <option value="Sunday">Sunday (Start)</option>
                    <option value="Monday">Monday</option>
                    <option value="Tuesday">Tuesday</option>
                    <option value="Wednesday">Wednesday</option>
                    <option value="Thursday">Thursday</option>
                    <option value="Friday">Friday</option>
                    <option value="Saturday">Saturday</option>
                    <option value="Sunday">Sunday (End)</option>
                  </select>
                </div>
              </div>

              {/* Battery Swaps & Collection Duration Section */}
              <div className="bg-slate-900/80 border border-sky-500/40 rounded-xl p-3.5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-sky-500/20 border border-sky-500/40 text-sky-400">
                      <BatteryCharging className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-sky-200">Collection Duration & Battery Swaps</h4>
                      <p className="text-[11px] text-slate-400">
                        Rule: Battery swap 1 day after install (Day 2), then every other day until teardown.
                      </p>
                    </div>
                  </div>

                  {/* Quick Preset Buttons */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleApplyDuration(3)}
                      className={`px-2.5 py-1 rounded text-xs font-bold transition-all border ${
                        formData.consecutiveCollectionDays === 3
                          ? 'bg-sky-500 text-slate-950 border-sky-400 shadow-sm'
                          : 'bg-slate-800 text-sky-300 border-slate-700 hover:bg-slate-750 hover:border-sky-500/60'
                      }`}
                      title="3-Day Collection: e.g. Mon Install -> Wed Swap (1 Swap) -> Fri Teardown"
                    >
                      3-Day (1 Swap)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyDuration(5)}
                      className={`px-2.5 py-1 rounded text-xs font-bold transition-all border ${
                        formData.consecutiveCollectionDays === 5
                          ? 'bg-sky-500 text-slate-950 border-sky-400 shadow-sm'
                          : 'bg-slate-800 text-sky-300 border-slate-700 hover:bg-slate-750 hover:border-sky-500/60'
                      }`}
                      title="5-Day Collection: e.g. Mon Install -> Wed/Fri Swaps (2 Swaps) -> Sun Teardown"
                    >
                      5-Day (2 Swaps)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyDuration(7)}
                      className={`px-2.5 py-1 rounded text-xs font-bold transition-all border ${
                        formData.consecutiveCollectionDays === 7
                          ? 'bg-sky-500 text-slate-950 border-sky-400 shadow-sm'
                          : 'bg-slate-800 text-sky-300 border-slate-700 hover:bg-slate-750 hover:border-sky-500/60'
                      }`}
                      title="7-Day Collection: e.g. Mon Install -> Wed/Fri/Sun Swaps (3 Swaps) -> Tue Teardown"
                    >
                      7-Day (3 Swaps)
                    </button>
                    {(formData.batterySwapDays && formData.batterySwapDays.length > 0) || formData.consecutiveCollectionDays ? (
                      <button
                        type="button"
                        onClick={handleClearSwaps}
                        className="px-2 py-1 rounded text-xs text-rose-300 bg-rose-950/40 border border-rose-800/60 hover:bg-rose-900/60 transition-colors"
                        title="Clear all battery swaps"
                      >
                        Clear Swaps
                      </button>
                    ) : null}
                  </div>
                </div>

                {/* Duration Input & Schedule Sync */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <label className="text-slate-300 font-medium">Duration (Days):</label>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={formData.consecutiveCollectionDays || swapSchedule.consecutiveDays || ''}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val) && val > 0) {
                          handleApplyDuration(val);
                        } else {
                          handleClearSwaps();
                        }
                      }}
                      placeholder="e.g. 3, 7"
                      className="w-20 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-sky-300 font-bold font-mono text-center focus:outline-none focus:ring-1 focus:ring-sky-400"
                    />
                    <span className="text-[11px] text-slate-400">
                      {formData.consecutiveCollectionDays
                        ? `${formData.consecutiveCollectionDays} days collection (${swapSchedule.batterySwapDays.length} swaps)`
                        : 'No multi-day collection set'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const days = formData.consecutiveCollectionDays || swapSchedule.consecutiveDays || 3;
                      handleApplyDuration(days);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs shrink-0 flex items-center gap-1.5 transition-colors self-start sm:self-auto"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Sync Battery Swaps</span>
                  </button>
                </div>

                {/* Visual Timeline of Events */}
                {swapSchedule.batterySwapDays.length > 0 && (
                  <div className="pt-2 border-t border-slate-800/80">
                    <div className="text-[11px] font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                      <span>Calculated Schedule Timeline:</span>
                      <span className="text-sky-300 font-mono text-[10px]">
                        {swapSchedule.summaryText || `${swapSchedule.batterySwapDays.length} swaps`}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap font-mono text-[11px]">
                      {/* Install */}
                      <span className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/60 text-emerald-200 font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                        <span>Install: {formData.installDay || 'Monday'}</span>
                      </span>

                      {/* Swaps */}
                      {swapSchedule.batterySwapDays.map((day, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded bg-sky-950/90 border border-sky-500/60 text-sky-200 font-bold flex items-center gap-1"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
                          <span>
                            Swap {idx + 1}: {day}
                            {swapSchedule.batterySwapDates[idx] ? ` (${swapSchedule.batterySwapDates[idx]})` : ''}
                          </span>
                        </span>
                      ))}

                      {/* Teardown */}
                      <span className="px-2 py-0.5 rounded bg-violet-950/80 border border-violet-500/60 text-violet-200 font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-violet-400"></span>
                        <span>
                          Teardown: {formData.teardownDay || swapSchedule.teardownDay || 'Friday'}
                          {swapSchedule.teardownDate ? ` (${swapSchedule.teardownDate})` : ''}
                        </span>
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Row 5: Equipment Type, Units, and Locations Count */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
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
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-cyan-300 font-bold focus:outline-none focus:ring-1 focus:ring-cyan-500"
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
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-amber-400 font-mono font-bold focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    No. of Locations
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={formData.locationsCount}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setFormData({ ...formData, locationsCount: isNaN(val) ? 0 : Math.round(val) });
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono font-bold focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
              </div>

              {/* Equipment Inventory Flow Banner */}
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-[11px] space-y-1">
                <span className="text-slate-400 font-bold block uppercase tracking-wider text-[10px]">
                  Dispatch Inventory Rule:
                </span>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <ArrowDownCircle className="w-3 h-3 text-emerald-400" />
                    <span>
                      Install ({formData.installDay || 'Unscheduled'}): Removes {formData.equipmentCount}{' '}
                      {formData.equipmentType || 'Camera'}(s) from {formData.technician || 'Tech'}
                    </span>
                  </span>
                  <span className="text-violet-300 font-semibold flex items-center gap-1">
                    <ArrowUpCircle className="w-3 h-3 text-violet-300" />
                    <span>
                      Teardown ({formData.teardownDay || 'Unscheduled'}): Returns {formData.equipmentCount}{' '}
                      {formData.equipmentType || 'Camera'}(s) to stock
                    </span>
                  </span>
                </div>
              </div>

              {/* Row 6: Collection Date (OPS) */}
              <div>
                <label className="block text-slate-400 font-semibold mb-1 flex items-center justify-between">
                  <span>Collection Date (OPS)</span>
                  <span className="text-[10px] text-cyan-400 font-normal">Install Date is 1 day before</span>
                </label>
                <input
                  type="text"
                  value={formData.collectionWindow}
                  onChange={(e) => setFormData({ ...formData, collectionWindow: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  placeholder="e.g. 9/1 (CRD) or 9/2-9/3"
                />
              </div>
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Scheduler Notes</label>
                <textarea
                  rows={2}
                  value={formData.schedulerNotes || ''}
                  onChange={(e) => setFormData({ ...formData, schedulerNotes: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono text-xs"
                  placeholder="e.g. Collecting 9/3; Teardown 24 hrs"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Analyst Audit Notes</label>
                <textarea
                  rows={5}
                  value={formData.analystNotes || ''}
                  onChange={(e) => setFormData({ ...formData, analystNotes: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono text-xs"
                  placeholder="Detailed field audit observations, camera upload logs..."
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Service Type Add-ons</label>
                <input
                  type="text"
                  value={formData.serviceTypeAddOns || ''}
                  onChange={(e) => setFormData({ ...formData, serviceTypeAddOns: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  placeholder="Pedestrians, Bicycles, Heavy Trucks..."
                />
              </div>
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="space-y-4 text-xs">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <h4 className="font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <span>Automated Workflow Logic Assessment</span>
                </h4>
                <div className="text-slate-300 space-y-2 leading-relaxed">
                  <p>
                    <strong>Current Reference Date:</strong> Thursday, Sep 3, 2026.
                  </p>
                  <p>
                    <strong>Install Scheduled:</strong> {formData.installDay || 'Not set'}
                  </p>
                  <p>
                    <strong>Teardown Scheduled:</strong> {formData.teardownDay || 'Not set'}
                  </p>
                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-700/80">
                    <span className="font-semibold text-slate-200 block mb-1">System Rule Engine Result:</span>
                    {audit ? (
                      <span className="text-amber-300 font-medium">
                        {audit.reason} (Recommended: <strong>{audit.suggestedStatus}</strong>)
                      </span>
                    ) : (
                      <span className="text-emerald-400 font-medium">
                        Status is aligned with operational lifecycle. No automatic adjustments required.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Modal Footer Actions */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-2">
            {onDelete ? (
              isConfirmingDelete ? (
                <div className="flex items-center gap-2 bg-rose-950/80 border border-rose-600/80 px-3 py-1.5 rounded-lg text-xs animate-in fade-in">
                  <span className="text-rose-200 font-semibold">Delete project #{formData.id}?</span>
                  <button
                    type="button"
                    onClick={() => {
                      onDelete(formData.id);
                      onClose();
                    }}
                    className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-sm transition-colors cursor-pointer"
                  >
                    Confirm Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsConfirmingDelete(false)}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsConfirmingDelete(true)}
                  className="inline-flex items-center gap-1.5 text-rose-400 hover:text-rose-300 text-xs px-2.5 py-1.5 rounded-lg bg-rose-950/20 hover:bg-rose-950/60 border border-rose-900/40 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Job</span>
                </button>
              )
            ) : (
              <div></div>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white shadow-md transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
