import React, { useState, useRef } from 'react';
import { Technician, RegionName, REGIONS } from '../types';
import {
  X,
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Download,
  Users,
  Camera,
  Cog,
  MapPin,
  RefreshCw,
  PlusCircle,
  Layers,
} from 'lucide-react';
import {
  parseTechnicianFile,
  downloadTechnicianCsvTemplate,
  ParseTechnicianFileResult,
  ParsedTechnicianRow,
} from '../utils/technicianCsvParser';

export interface BulkImportItem {
  tech: Technician;
  targetRegion: RegionName;
}

interface UploadTechniciansModalProps {
  isOpen: boolean;
  activeRegion: RegionName;
  existingTechniciansByRegion: Record<RegionName, Technician[]>;
  onClose: () => void;
  onImport: (items: BulkImportItem[], mode: 'update' | 'append' | 'replace') => void;
}

export const UploadTechniciansModal: React.FC<UploadTechniciansModalProps> = ({
  isOpen,
  activeRegion,
  existingTechniciansByRegion,
  onClose,
  onImport,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<ParseTechnicianFileResult | null>(null);

  // Region routing mode: 'auto' (per row's region) or 'force-active' (all into activeRegion)
  const [routingMode, setRoutingMode] = useState<'auto' | 'force-active'>('auto');

  // Import mode
  const [importMode, setImportMode] = useState<'update' | 'append' | 'replace'>('update');

  // Per-row region overrides (tech index -> RegionName)
  const [rowRegionOverrides, setRowRegionOverrides] = useState<Record<number, RegionName>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleProcessFile = (selectedFile: File) => {
    setFile(selectedFile);
    setError(null);
    setParsing(true);
    setParseResult(null);
    setRowRegionOverrides({});

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        if (!text || !text.trim()) {
          throw new Error('The selected file is empty.');
        }

        const result = parseTechnicianFile(text, activeRegion);
        setParseResult(result);
      } catch (err: any) {
        setError(err.message || 'Failed to parse technician file. Please check format.');
      } finally {
        setParsing(false);
      }
    };

    reader.onerror = () => {
      setError('Could not read file from disk.');
      setParsing(false);
    };

    reader.readAsText(selectedFile);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleProcessFile(e.target.files[0]);
    }
  };

  const handleRowRegionChange = (index: number, newRegion: RegionName) => {
    setRowRegionOverrides((prev) => ({
      ...prev,
      [index]: newRegion,
    }));
  };

  const handleConfirmImport = () => {
    if (!parseResult) return;

    const items: BulkImportItem[] = parseResult.technicians.map((row, idx) => {
      const targetRegion: RegionName =
        routingMode === 'force-active'
          ? activeRegion
          : rowRegionOverrides[idx] || row.detectedOperationalRegion;

      const techWithTarget: Technician = {
        ...row.tech,
        operationalRegion: targetRegion,
      };

      return {
        tech: techWithTarget,
        targetRegion,
      };
    });

    onImport(items, importMode);
    onClose();
  };

  return (
    <div
      id="upload-technicians-modal-overlay"
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in"
    >
      <div
        id="upload-technicians-modal-card"
        className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Import Technicians & Equipment Fleet
                </h2>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-700/40 font-semibold">
                  Batch Upload
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Upload a CSV or spreadsheet with technician details, respective regions, and camera/machine inventory.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Dropzone & Template Download */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${
              dragOver
                ? 'border-cyan-400 bg-cyan-950/30'
                : 'border-slate-700 hover:border-slate-500 bg-slate-950/40'
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.tsv,.txt"
              className="hidden"
              onChange={handleFileChange}
            />

            <div className="flex flex-col items-center justify-center gap-2.5">
              <div className="p-3 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800/60 shadow-inner">
                <Upload className="w-6 h-6" />
              </div>

              <div>
                <span className="text-sm font-semibold text-white">
                  {file ? file.name : 'Click to select or drag & drop technicians CSV file'}
                </span>
                <p className="text-xs text-slate-400 mt-1">
                  Supported formats: CSV, TSV (Excel/Sheets export) with columns for Name, Region, Cameras, and Machines.
                </p>
              </div>

              <div className="flex items-center gap-3 mt-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    downloadTechnicianCsvTemplate();
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-xs font-semibold transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Sample CSV Template</span>
                </button>
              </div>
            </div>
          </div>

          {/* Loading state */}
          {parsing && (
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-center gap-3 text-cyan-300 text-sm">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Parsing technician roster and fleet metrics...</span>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3.5 bg-rose-950/60 border border-rose-500/40 rounded-xl flex items-start gap-2.5 text-rose-200 text-xs">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-bold">Error reading technician file:</span> {error}
              </div>
            </div>
          )}

          {/* Parsed Result Preview */}
          {parseResult && (
            <div className="space-y-4 animate-in fade-in">
              {/* Summary Metrics Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-[11px] text-slate-400 flex items-center gap-1.5 font-semibold">
                    <Users className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Technicians Found</span>
                  </div>
                  <div className="text-xl font-bold font-mono text-white mt-1">
                    {parseResult.totalParsed} <span className="text-xs text-slate-500 font-normal">members</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-[11px] text-slate-400 flex items-center gap-1.5 font-semibold">
                    <MapPin className="w-3.5 h-3.5 text-blue-400" />
                    <span>Regions Detected</span>
                  </div>
                  <div className="text-xl font-bold font-mono text-blue-300 mt-1">
                    {parseResult.detectedRegions.length} <span className="text-xs text-slate-500 font-normal">regions</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-[11px] text-slate-400 flex items-center gap-1.5 font-semibold">
                    <Camera className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Total Cameras</span>
                  </div>
                  <div className="text-xl font-bold font-mono text-cyan-400 mt-1">
                    {parseResult.totalCameras} <span className="text-xs text-slate-500 font-normal">units</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-[11px] text-slate-400 flex items-center gap-1.5 font-semibold">
                    <Cog className="w-3.5 h-3.5 text-amber-400" />
                    <span>Total Machines</span>
                  </div>
                  <div className="text-xl font-bold font-mono text-amber-400 mt-1">
                    {parseResult.totalMachines} <span className="text-xs text-slate-500 font-normal">units</span>
                  </div>
                </div>
              </div>

              {/* Detected Column Mapping */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1.5">
                  Detected Column Mappings:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  {Object.entries(parseResult.matchedHeaders).map(([key, val]) => (
                    <div key={key} className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                      <span className="text-slate-400 text-[10px] block">{key}</span>
                      <span className="font-mono text-cyan-300 font-semibold truncate block mt-0.5">
                        {val}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Import Configuration Controls */}
              <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Region Routing Option */}
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Regional Destination Routing:
                  </label>
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                      <input
                        type="radio"
                        name="routingMode"
                        checked={routingMode === 'auto'}
                        onChange={() => setRoutingMode('auto')}
                        className="text-cyan-500 focus:ring-cyan-500"
                      />
                      <span>
                        <strong className="text-white">Auto-route by row's region</strong> (
                        {parseResult.detectedRegions.join(', ')})
                      </span>
                    </label>

                    <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                      <input
                        type="radio"
                        name="routingMode"
                        checked={routingMode === 'force-active'}
                        onChange={() => setRoutingMode('force-active')}
                        className="text-cyan-500 focus:ring-cyan-500"
                      />
                      <span>
                        <strong className="text-white">Assign all to current active region:</strong>{' '}
                        <span className="text-cyan-300 font-semibold">{activeRegion}</span>
                      </span>
                    </label>
                  </div>
                </div>

                {/* Conflict / Roster Mode */}
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Roster Synchronization Mode:
                  </label>
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                      <input
                        type="radio"
                        name="importMode"
                        checked={importMode === 'update'}
                        onChange={() => setImportMode('update')}
                        className="text-cyan-500 focus:ring-cyan-500"
                      />
                      <span>
                        <strong className="text-white">Update existing & add new</strong> (Recommended)
                      </span>
                    </label>

                    <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                      <input
                        type="radio"
                        name="importMode"
                        checked={importMode === 'append'}
                        onChange={() => setImportMode('append')}
                        className="text-cyan-500 focus:ring-cyan-500"
                      />
                      <span>
                        <strong className="text-white">Append new only</strong> (Skip duplicate names)
                      </span>
                    </label>

                    <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                      <input
                        type="radio"
                        name="importMode"
                        checked={importMode === 'replace'}
                        onChange={() => setImportMode('replace')}
                        className="text-rose-500 focus:ring-rose-500"
                      />
                      <span className="text-rose-300">
                        <strong>Replace roster</strong> for target region(s)
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Roster Preview Table */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Technician Roster Preview ({parseResult.technicians.length} Members):
                  </span>
                  <span className="text-[11px] text-slate-400">
                    You can adjust operational regions individually before importing
                  </span>
                </div>

                <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-x-auto max-h-56">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-900/90 text-slate-400 sticky top-0 border-b border-slate-800 z-10">
                      <tr>
                        <th className="p-2 font-semibold">Technician Name</th>
                        <th className="p-2 font-semibold">File Region</th>
                        <th className="p-2 font-semibold">Target Operational Region</th>
                        <th className="p-2 font-semibold text-center">Cameras</th>
                        <th className="p-2 font-semibold text-center">Machines</th>
                        <th className="p-2 font-semibold">Team / Group</th>
                        <th className="p-2 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850">
                      {parseResult.technicians.map((item, idx) => {
                        const targetReg =
                          routingMode === 'force-active'
                            ? activeRegion
                            : rowRegionOverrides[idx] || item.detectedOperationalRegion;

                        const existingList = existingTechniciansByRegion[targetReg] || [];
                        const isExisting = existingList.some(
                          (t) => t.name.toLowerCase() === item.tech.name.toLowerCase()
                        );

                        return (
                          <tr key={idx} className="hover:bg-slate-900/50">
                            <td className="p-2 font-semibold text-white whitespace-nowrap">
                              {item.tech.name}
                            </td>
                            <td className="p-2 text-slate-400 whitespace-nowrap">
                              {item.originalRegionString}
                            </td>
                            <td className="p-2">
                              {routingMode === 'force-active' ? (
                                <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 font-semibold border border-cyan-800/40">
                                  {activeRegion}
                                </span>
                              ) : (
                                <select
                                  value={targetReg}
                                  onChange={(e) =>
                                    handleRowRegionChange(idx, e.target.value as RegionName)
                                  }
                                  className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-cyan-500"
                                >
                                  {REGIONS.map((r) => (
                                    <option key={r} value={r}>
                                      {r}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </td>
                            <td className="p-2 text-center font-mono font-bold text-cyan-400">
                              {item.tech.cameras}
                            </td>
                            <td className="p-2 text-center font-mono font-bold text-amber-400">
                              {item.tech.machines}
                            </td>
                            <td className="p-2 text-slate-300 whitespace-nowrap">
                              <span className="text-[10px] text-slate-400">{item.tech.team}</span>
                            </td>
                            <td className="p-2 whitespace-nowrap">
                              {isExisting ? (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-950/70 text-amber-300 border border-amber-800/40">
                                  Updates Existing
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-950/70 text-emerald-300 border border-emerald-800/40">
                                  New Member
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={!parseResult || parseResult.totalParsed === 0}
            onClick={handleConfirmImport}
            className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all shadow-md ${
              parseResult && parseResult.totalParsed > 0
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 cursor-pointer'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>
              Confirm & Import {parseResult ? `(${parseResult.totalParsed} Technicians)` : ''}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
