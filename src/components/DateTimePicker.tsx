import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock, X, Check, Sparkles } from 'lucide-react';

interface DateTimePickerProps {
  value?: string;
  onChange: (newValue: string) => void;
  placeholder?: string;
  id?: string;
  className?: string;
  label?: string;
}

/**
 * Parses user strings like "9/9/2026 3:07 AM", "2026-09-09T03:07", or ISO into Date components
 */
function parseDateParts(val?: string): { dateStr: string; timeStr: string } {
  if (!val || !val.trim()) {
    return { dateStr: '', timeStr: '' };
  }

  const trimmed = val.trim();

  // Try parsing ISO or YYYY-MM-DD
  if (trimmed.includes('T')) {
    const [d, t] = trimmed.split('T');
    return { dateStr: d || '', timeStr: t?.substring(0, 5) || '' };
  }

  // Try parsing "M/D/YYYY h:mm A" or "M/D/YYYY hh:mm:ss"
  const match = trimmed.match(/^([0-1]?[0-9])\/([0-3]?[0-9])\/([0-9]{4})\s+([0-1]?[0-9]):([0-5][0-9])(?:\s*(AM|PM))?/i);
  if (match) {
    const month = String(parseInt(match[1], 10)).padStart(2, '0');
    const day = String(parseInt(match[2], 10)).padStart(2, '0');
    const year = match[3];
    let hours = parseInt(match[4], 10);
    const minutes = match[5];
    const ampm = match[6]?.toUpperCase();

    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;

    const hourStr = String(hours).padStart(2, '0');
    return {
      dateStr: `${year}-${month}-${day}`,
      timeStr: `${hourStr}:${minutes}`,
    };
  }

  // Fallback try standard Date
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    const hours = String(parsed.getHours()).padStart(2, '0');
    const minutes = String(parsed.getMinutes()).padStart(2, '0');
    return {
      dateStr: `${year}-${month}-${day}`,
      timeStr: `${hours}:${minutes}`,
    };
  }

  return { dateStr: '', timeStr: '' };
}

/**
 * Formats YYYY-MM-DD and HH:mm into standard traffic operations format: "M/D/YYYY h:mm A"
 */
function formatToStandard(dateStr: string, timeStr: string): string {
  if (!dateStr) return '';
  const [year, monthStr, dayStr] = dateStr.split('-');
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  if (!timeStr) {
    return `${month}/${day}/${year} 08:00 AM`;
  }

  const [hStr, mStr] = timeStr.split(':');
  let hours = parseInt(hStr, 10) || 0;
  const minutes = String(parseInt(mStr, 10) || 0).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';

  if (hours > 12) hours -= 12;
  if (hours === 0) hours = 12;

  return `${month}/${day}/${year} ${hours}:${minutes} ${ampm}`;
}

export const DateTimePicker: React.FC<DateTimePickerProps> = ({
  value = '',
  onChange,
  placeholder = 'Select Date & Time Sent...',
  id,
  className = '',
  label,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const initialParts = parseDateParts(value);
  const [selectedDate, setSelectedDate] = useState(initialParts.dateStr);
  const [selectedTime, setSelectedTime] = useState(initialParts.timeStr || '08:00');

  // Sync internal states when external value changes
  useEffect(() => {
    const parts = parseDateParts(value);
    setSelectedDate(parts.dateStr);
    setSelectedTime(parts.timeStr || '08:00');
  }, [value]);

  // Close popup on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  const handleApply = (d = selectedDate, t = selectedTime) => {
    if (!d) {
      onChange('');
    } else {
      const formatted = formatToStandard(d, t || '08:00');
      onChange(formatted);
    }
    setIsOpen(false);
  };

  const handleClear = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedDate('');
    setSelectedTime('');
    onChange('');
    setIsOpen(false);
  };

  const handleSetNow = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');

    const d = `${year}-${month}-${day}`;
    const t = `${hours}:${minutes}`;
    setSelectedDate(d);
    setSelectedTime(t);
    handleApply(d, t);
  };

  const handleSetPresetTime = (hours: number, minutes: number) => {
    let d = selectedDate;
    if (!d) {
      const now = new Date();
      d = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      setSelectedDate(d);
    }
    const t = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    setSelectedTime(t);
    handleApply(d, t);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`} id={id}>
      {label && (
        <label className="block text-slate-400 font-semibold mb-1 flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5">
            <CalendarIcon className="w-3.5 h-3.5 text-cyan-400" />
            <span>{label}</span>
          </span>
          {value && (
            <span className="text-[10px] text-cyan-400/80 font-mono">
              {value}
            </span>
          )}
        </label>
      )}

      {/* Main Trigger Input Button */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between gap-2 px-3 py-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-700 hover:border-cyan-500/80 rounded-lg cursor-pointer transition-colors text-xs text-white"
        title="Click to open calendar date and time picker"
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <CalendarIcon className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          {value ? (
            <span className="font-mono text-cyan-300 font-semibold truncate">{value}</span>
          ) : (
            <span className="text-slate-500 truncate">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-800 transition-colors"
              title="Clear Date Sent"
            >
              <X className="w-3 h-3" />
            </button>
          )}
          <Clock className="w-3 h-3 text-slate-400" />
        </div>
      </div>

      {/* Combined Date & Time Picker Popover */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 z-50 w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-3 text-xs text-slate-200 animate-in fade-in zoom-in-95">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2.5">
            <span className="font-bold text-white flex items-center gap-1.5">
              <CalendarIcon className="w-3.5 h-3.5 text-cyan-400" />
              <span>Combined Date & Time Picker</span>
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5">
            {/* Calendar Date Input */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1 flex items-center gap-1">
                <CalendarIcon className="w-3 h-3 text-cyan-400" />
                <span>Calendar Date</span>
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Time Input */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1 flex items-center gap-1">
                <Clock className="w-3 h-3 text-cyan-400" />
                <span>Time of Day</span>
              </label>
              <input
                type="time"
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Quick Presets */}
            <div className="pt-1 border-t border-slate-800">
              <span className="text-[10px] text-slate-500 font-semibold block mb-1.5">
                Quick Shortcuts:
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={handleSetNow}
                  className="px-2 py-1 bg-cyan-950/60 hover:bg-cyan-900 border border-cyan-800/80 rounded text-[10px] text-cyan-300 font-medium flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-2.5 h-2.5" />
                  <span>Right Now</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSetPresetTime(8, 30)}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-[10px] text-slate-200 font-medium cursor-pointer text-center"
                >
                  08:30 AM
                </button>
                <button
                  type="button"
                  onClick={() => handleSetPresetTime(13, 0)}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-[10px] text-slate-200 font-medium cursor-pointer text-center"
                >
                  01:00 PM
                </button>
                <button
                  type="button"
                  onClick={() => handleSetPresetTime(17, 0)}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-[10px] text-slate-200 font-medium cursor-pointer text-center"
                >
                  05:00 PM
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleClear}
                className="px-2.5 py-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 text-[11px] cursor-pointer"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => handleApply()}
                className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg text-xs flex items-center gap-1 cursor-pointer shadow-sm"
              >
                <Check className="w-3 h-3" />
                <span>Apply Date Sent</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
