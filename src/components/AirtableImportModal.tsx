import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Project, RegionName, REGIONS } from '../types';
import { parseAirtableCSV, ParseAirtableResult } from '../utils/csvParser';
import { REFERENCE_SCHEDULING_CSV, REFERENCE_MONITORING_CSV } from '../data/referenceCsvData';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  X,
  ArrowRight,
  Sparkles,
  RefreshCw,
  Download,
  Info,
  MapPin,
  Layers,
  FileText,
} from 'lucide-react';
import { getOpsStatusBadge } from '../utils/statusEngine';

interface AirtableImportModalProps {
  isOpen?: boolean;
  existingProjects?: Project[];
  targetRegion?: RegionName;
  onRegionChange?: (region: RegionName) => void;
  targetTab?: 'scheduling' | 'monitoring';
  onTargetTabChange?: (tab: 'scheduling' | 'monitoring') => void;
  onClose: () => void;
  onImportComplete?: (
    importedProjects: Project[],
    mode: 'merge' | 'replace',
    targetRegion?: RegionName,
    targetTab?: 'scheduling' | 'monitoring'
  ) => void;
  onImport?: (
    importedProjects: Project[],
    mode: 'merge' | 'replace',
    targetRegion?: RegionName,
    targetTab?: 'scheduling' | 'monitoring'
  ) => void;
  initialFile?: File | null;
}

export const AirtableImportModal: React.FC<AirtableImportModalProps> = ({
  isOpen = true,
  existingProjects = [],
  targetRegion = 'South Central',
  onRegionChange,
  targetTab = 'scheduling',
  onTargetTabChange,
  onClose,
  onImportComplete,
  onImport,
  initialFile = null,
}) => {
  if (isOpen === false) return null;

  const [selectedRegion, setSelectedRegion] = useState<RegionName>(targetRegion);
  const [selectedTab, setSelectedTab] = useState<'scheduling' | 'monitoring'>(targetTab);
  const [dragOver, setDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<ParseAirtableResult | null>(null);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSelectedTab(targetTab);
  }, [targetTab]);

  const handleRegionSelect = (reg: RegionName) => {
    setSelectedRegion(reg);
    onRegionChange?.(reg);
  };

  const handleTabSelect = (tab: 'scheduling' | 'monitoring') => {
    setSelectedTab(tab);
    onTargetTabChange?.(tab);
  };

  const handleImportCallback = onImportComplete || onImport;

  const processCsvText = (text: string, sourceName?: string) => {
    setParsing(true);
    setError(null);
    try {
      if (!text || !text.trim()) {
        throw new Error('CSV content is empty.');
      }
      const result = parseAirtableCSV(text);
      if (result.projects.length === 0) {
        throw new Error(`No valid project rows could be extracted${sourceName ? ` from ${sourceName}` : ''}.`);
      }
      setParseResult(result);
    } catch (err: any) {
      setError(err.message || 'Failed to parse CSV file. Please check file format.');
    } finally {
      setParsing(false);
    }
  };

  const processFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') {
      setError('Please upload a valid .csv file exported from Airtable.');
      return;
    }

    setParsing(true);
    setError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      processCsvText(text, file.name);
    };
    reader.onerror = () => {
      setError('Error reading file from disk.');
      setParsing(false);
    };
    reader.readAsText(file);
  };

  const handleLoadReferenceCsv = (type: 'scheduling' | 'monitoring') => {
    if (type === 'scheduling') {
      handleTabSelect('scheduling');
      processCsvText(REFERENCE_SCHEDULING_CSV, '1st Attached Reference CSV (Scheduling Matrix / Dispatch)');
    } else {
      handleTabSelect('monitoring');
      processCsvText(REFERENCE_MONITORING_CSV, '2nd Attached Reference CSV (Monitoring Sheet)');
    }
  };

  // If an initial file was passed (e.g. from global drag-and-drop), process it immediately
  useEffect(() => {
    if (initialFile) {
      processFile(initialFile);
    }
  }, [initialFile]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const handleConfirmImport = () => {
    if (!parseResult) return;
    handleImportCallback?.(parseResult.projects, importMode, selectedRegion, selectedTab);
    onClose();
  };

  // Compute diff stats against current existing projects
  const diffStats = React.useMemo(() => {
    if (!parseResult || !Array.isArray(parseResult.projects)) return { newCount: 0, updateCount: 0 };
    const projectList = Array.isArray(existingProjects) ? existingProjects : [];
    const existingIds = new Set(projectList.map((p) => p.id.toLowerCase()));
    let newCount = 0;
    let updateCount = 0;

    for (const p of parseResult.projects) {
      if (existingIds.has(p.id.toLowerCase())) {
        updateCount++;
      } else {
        newCount++;
      }
    }
    return { newCount, updateCount };
  }, [parseResult, existingProjects]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-950/50">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Import Airtable Operations CSV</span>
                <span className="text-[10px] bg-cyan-950 text-cyan-300 font-semibold px-2 py-0.5 rounded-full border border-cyan-800/80">
                  Drag & Drop
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Directly upload or drag an exported CSV from Airtable to sync the scheduler and monitoring sheet
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

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          {/* Target Region & Target Tab Selectors */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Target Region Selector Banner */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-blue-500/40 flex flex-col justify-between gap-2.5 shadow-inner">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-950 border border-blue-500/60 flex items-center justify-center text-blue-400 shrink-0">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-2">
                    <span>Target Region</span>
                    <span className="text-[10px] bg-blue-900/60 text-blue-200 px-1.5 py-0.2 rounded font-semibold border border-blue-700/60">
                      Isolated
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Saved to <strong className="text-blue-300">{selectedRegion}</strong>.
                  </div>
                </div>
              </div>
              <div>
                <select
                  id="select-import-target-region"
                  value={selectedRegion}
                  onChange={(e) => handleRegionSelect(e.target.value as RegionName)}
                  className="w-full bg-slate-900 text-white font-bold text-xs px-3 py-1.5 rounded-lg border border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer shadow-sm"
                >
                  {REGIONS.map((r) => (
                    <option key={r} value={r} className="bg-slate-900 text-white font-semibold">
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Target Tab Selector Banner */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-cyan-500/40 flex flex-col justify-between gap-2.5 shadow-inner">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-lg ${selectedTab === 'scheduling' ? 'bg-cyan-950 border-cyan-500/60 text-cyan-400' : 'bg-emerald-950 border-emerald-500/60 text-emerald-400'} border flex items-center justify-center shrink-0`}>
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-2">
                    <span>Target View / Tab</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold uppercase tracking-wider ${selectedTab === 'scheduling' ? 'bg-cyan-900/80 text-cyan-200 border border-cyan-700/60' : 'bg-emerald-900/80 text-emerald-200 border border-emerald-700/60'}`}>
                      {selectedTab === 'scheduling' ? 'Matrix & Dispatch' : 'Monitoring Sheet'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {selectedTab === 'scheduling' ? (
                      <span className="text-cyan-300 font-medium">Monitoring Sheet will be untouched.</span>
                    ) : (
                      <span className="text-emerald-300 font-medium">Matrix & Dispatch will be untouched.</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5 bg-slate-900 p-1 rounded-lg border border-slate-800">
                <button
                  type="button"
                  id="target-tab-scheduling-btn"
                  onClick={() => handleTabSelect('scheduling')}
                  className={`px-2 py-1.5 rounded-md font-bold text-[11px] transition-all text-center truncate ${
                    selectedTab === 'scheduling'
                      ? 'bg-cyan-600 text-white shadow'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  Scheduling Matrix & Dispatch
                </button>
                <button
                  type="button"
                  id="target-tab-monitoring-btn"
                  onClick={() => handleTabSelect('monitoring')}
                  className={`px-2 py-1.5 rounded-md font-bold text-[11px] transition-all text-center truncate ${
                    selectedTab === 'monitoring'
                      ? 'bg-emerald-600 text-white shadow'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  Monitoring Sheet
                </button>
              </div>
            </div>
          </div>

          {/* Quick-load Reference Files for testing and instant reference */}
          {!parseResult && (
            <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Reference Datasets (from Attached Files):</span>
                </span>
                <span className="text-[10px] text-slate-500">Click to instantly load & preview</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  id="btn-load-csv-reference-1"
                  onClick={() => handleLoadReferenceCsv('scheduling')}
                  className="flex items-center justify-start gap-2 px-3 py-2 rounded-lg bg-slate-900 hover:bg-cyan-950/50 text-slate-300 hover:text-cyan-200 border border-slate-700 hover:border-cyan-600/60 text-left transition-all group"
                >
                  <FileSpreadsheet className="w-4 h-4 text-cyan-400 shrink-0 group-hover:scale-110 transition-transform" />
                  <div className="overflow-hidden">
                    <div className="text-xs font-bold text-white group-hover:text-cyan-300 truncate">
                      1st CSV: Scheduling Matrix & Dispatch
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">
                      Install Day, Tear Down Day, Camera Units Needed
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  id="btn-load-csv-reference-2"
                  onClick={() => handleLoadReferenceCsv('monitoring')}
                  className="flex items-center justify-start gap-2 px-3 py-2 rounded-lg bg-slate-900 hover:bg-emerald-950/50 text-slate-300 hover:text-emerald-200 border border-slate-700 hover:border-emerald-600/60 text-left transition-all group"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0 group-hover:scale-110 transition-transform" />
                  <div className="overflow-hidden">
                    <div className="text-xs font-bold text-white group-hover:text-emerald-300 truncate">
                      2nd CSV: Monitoring Sheet
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">
                      Tech Assigned, Ops Audit Date, Work Week
                    </div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Dropzone */}
          {!parseResult && (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                dragOver
                  ? 'border-cyan-400 bg-cyan-950/30 scale-[1.01]'
                  : 'border-slate-700 hover:border-slate-600 bg-slate-950/40 hover:bg-slate-950/70'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileInputChange}
                className="hidden"
              />
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-cyan-400">
                {parsing ? (
                  <RefreshCw className="w-6 h-6 animate-spin text-cyan-400" />
                ) : (
                  <UploadCloud className="w-7 h-7" />
                )}
              </div>
              <h4 className="text-sm font-bold text-white mb-1">
                {dragOver ? 'Drop CSV File Here' : `Drag & Drop CSV for ${selectedTab === 'scheduling' ? 'Scheduling Matrix & Dispatch' : 'Monitoring Sheet'}`}
              </h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mb-3">
                Or click to browse from your computer. Detected columns: Project #, Techs, Days, Equipment units, Work Week, and Status.
              </p>
              <span className="inline-block bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-3 py-1.5 rounded-lg border border-slate-700 transition-colors">
                Select CSV File
              </span>
            </div>
          )}

          {/* Error notice */}
          {error && (
            <div className="p-3 bg-rose-950/60 border border-rose-800/80 rounded-xl text-rose-300 flex items-start gap-2 text-xs">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <strong>Import Error:</strong> {error}
              </div>
            </div>
          )}

          {/* Preview and Confirmation Section */}
          {parseResult && (
            <div className="space-y-4">
              {/* Summary Banner */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-950 border border-emerald-800/80 flex items-center justify-center text-emerald-400 font-bold">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm">
                      {parseResult.totalParsed} Studies Extracted from Airtable CSV
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-3">
                      <span className="text-emerald-400 font-medium">
                        +{diffStats.newCount} New Projects
                      </span>
                      <span className="text-cyan-400 font-medium">
                        ↻ {diffStats.updateCount} Existing Updates
                      </span>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setParseResult(null);
                    setError(null);
                  }}
                  className="text-xs text-slate-400 hover:text-white px-2.5 py-1 bg-slate-900 rounded border border-slate-800"
                >
                  Upload different file
                </button>
              </div>

              {/* Matched Columns Grid */}
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1.5">
                  Detected Column Mapping:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  {Object.entries(parseResult.matchedHeaders || {}).map(([key, val]) => (
                    <div
                      key={key}
                      className="bg-slate-950 p-2 rounded-lg border border-slate-800 flex flex-col justify-between"
                    >
                      <span className="text-slate-400 text-[10px]">{key}</span>
                      <span className="font-mono text-cyan-300 font-medium truncate mt-0.5" title={val}>
                        {val}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sample Parsed Rows Preview */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Data Preview (First 5 of {parseResult.projects?.length || 0} rows):
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Auto-formatted for Matrix & Sheet
                  </span>
                </div>
                <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-x-auto max-h-48">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-900/90 text-slate-400 sticky top-0 border-b border-slate-800">
                      <tr>
                        <th className="p-2 font-semibold">Project #</th>
                        <th className="p-2 font-semibold">City, State</th>
                        <th className="p-2 font-semibold">STATUS (OPS)</th>
                        <th className="p-2 font-semibold">Study / Service Type</th>
                        <th className="p-2 font-semibold">Tech</th>
                        <th className="p-2 font-semibold">Install</th>
                        <th className="p-2 font-semibold">Teardown</th>
                        <th className="p-2 font-semibold">Units</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850">
                      {(parseResult.projects || []).slice(0, 5).map((p) => {
                        const badge = getOpsStatusBadge(p.opsStatus);
                        return (
                          <tr key={p.id} className="hover:bg-slate-900/50">
                            <td className="p-2 font-mono font-bold text-cyan-400">{p.id}</td>
                            <td className="p-2 text-slate-300">{p.cityState}</td>
                            <td className="p-2">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${badge?.bg || 'bg-slate-800'} ${badge?.text || 'text-slate-300'}`}>
                                {p.opsStatus}
                              </span>
                            </td>
                            <td className="p-2 whitespace-nowrap">
                              <span className="font-semibold text-white">{p.studyType}</span>
                              {p.serviceTypeAddOns && (
                                <span className="block text-[10px] text-slate-400">{p.serviceTypeAddOns}</span>
                              )}
                            </td>
                            <td className="p-2 text-slate-300">{p.technician}</td>
                            <td className="p-2 text-cyan-300">{p.installDay || '—'}</td>
                            <td className="p-2 text-amber-300">{p.teardownDay || '—'}</td>
                            <td className="p-2 font-mono text-amber-400">
                              {p.equipmentCount} <span className="text-[10px] text-slate-400">{p.equipmentType || 'Units'}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Import Mode Selection */}
              <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 space-y-2">
                <span className="font-bold text-white text-xs block">Choose Merge Strategy:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <label
                    onClick={() => setImportMode('merge')}
                    className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-all ${
                      importMode === 'merge'
                        ? 'bg-cyan-950/40 border-cyan-500/80 text-white shadow-sm'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'merge'}
                      onChange={() => setImportMode('merge')}
                      className="mt-0.5 text-cyan-500"
                    />
                    <div>
                      <div className="font-semibold text-xs text-white">
                        Merge & Update (Recommended)
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Updates matching Project IDs with new values and appends new jobs without deleting unsynced work.
                      </div>
                    </div>
                  </label>

                  <label
                    onClick={() => setImportMode('replace')}
                    className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-all ${
                      importMode === 'replace'
                        ? 'bg-rose-950/40 border-rose-500/80 text-white shadow-sm'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'replace'}
                      onChange={() => setImportMode('replace')}
                      className="mt-0.5 text-rose-500"
                    />
                    <div>
                      <div className="font-semibold text-xs text-white">
                        Replace All Existing
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Completely overwrites all current studies with the exact contents of this Airtable CSV.
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-400 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-cyan-400" />
            <span>Supports Airtable CSV exports with standard traffic monitoring headers</span>
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>

            {parseResult && (
              <button
                id="btn-confirm-airtable-import"
                onClick={handleConfirmImport}
                className={`inline-flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-bold text-white shadow-md transition-all cursor-pointer ${
                  selectedTab === 'scheduling'
                    ? 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-950/40'
                    : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/40'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>
                  Confirm & Sync {parseResult.projects.length} Studies to {selectedTab === 'scheduling' ? 'Scheduling Matrix & Dispatch' : 'Monitoring Sheet'} ({selectedRegion})
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
