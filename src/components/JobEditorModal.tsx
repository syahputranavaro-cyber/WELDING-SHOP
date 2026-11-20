import React, { useState, useEffect, useMemo } from 'react';
import { JobItem } from '../types';
import {
  calculateJobTarget,
  formatToISO,
  formatToIndonesian,
  parseDate,
} from '../utils/jobCalculations';
import {
  X,
  Save,
  PlusCircle,
  Trash2,
  Calendar,
  Calculator,
  CheckCircle2,
  Clock,
  MapPin,
  FileText,
  Percent,
  User,
} from 'lucide-react';

interface JobEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobToEdit: JobItem | null;
  onSaveJob: (job: JobItem, updatedRefDate?: string) => void;
  onDeleteJob?: (id: number) => void;
  currentDashboardDate: string; // Indonesian or ISO text
}

const COMMON_AREAS = [
  'Pabrik 1',
  'Pabrik 1A',
  'Pabrik 2',
  'Pabrik 3',
  'Pabrik 4',
  'Pabrik 5',
  'Pabrik 6 BB 1',
  'Pabrik 6 BB 2',
  'Pabrik 7',
  'KAN',
  'KPI',
  'KNI',
  'KDM',
  'JPP',
];

export const JobEditorModal: React.FC<JobEditorModalProps> = ({
  isOpen,
  onClose,
  jobToEdit,
  onSaveJob,
  onDeleteJob,
  currentDashboardDate,
}) => {
  const [deskripsi, setDeskripsi] = useState('');
  const [area, setArea] = useState('Pabrik 1');
  const [isCustomArea, setIsCustomArea] = useState(false);
  const [customAreaText, setCustomAreaText] = useState('');
  const [pic, setPic] = useState('');

  // Dates in ISO YYYY-MM-DD for native HTML5 datepickers
  const [startDate, setStartDate] = useState('2026-09-09');
  const [finishDate, setFinishDate] = useState('2026-09-15');
  const [refDate, setRefDate] = useState('2026-09-09');

  const [progressActual, setProgressActual] = useState<number>(20);
  const [manualTargetOverride, setManualTargetOverride] = useState<boolean>(false);
  const [manualTargetValue, setManualTargetValue] = useState<number>(14.29);

  // Sync state whenever modal opens or jobToEdit changes
  useEffect(() => {
    if (!isOpen) return;

    const isoRef = formatToISO(currentDashboardDate);
    setRefDate(isoRef);

    if (jobToEdit) {
      setDeskripsi(jobToEdit.deskripsi);
      setPic(jobToEdit.pic || '');
      const matchedArea = COMMON_AREAS.find(
        (a) => a.toLowerCase() === jobToEdit.area.trim().toLowerCase()
      );
      if (matchedArea) {
        setArea(matchedArea);
        setIsCustomArea(false);
      } else {
        setIsCustomArea(true);
        setCustomAreaText(jobToEdit.area);
      }
      setStartDate(formatToISO(jobToEdit.start));
      setFinishDate(formatToISO(jobToEdit.finish));
      setProgressActual(jobToEdit.progress_actual);
      setManualTargetValue(jobToEdit.progress_target);
      setManualTargetOverride(false);
    } else {
      // New Job defaults
      setDeskripsi('');
      setArea('Pabrik 1');
      setIsCustomArea(false);
      setCustomAreaText('');
      setPic('');
      // Default: today to +6 days (total 7 days)
      setStartDate(isoRef);
      const d = parseDate(isoRef) || new Date();
      const finishD = new Date(d.getTime() + 6 * 24 * 60 * 60 * 1000);
      setFinishDate(formatToISO(finishD));
      setProgressActual(0);
      setManualTargetOverride(false);
    }
  }, [jobToEdit, isOpen, currentDashboardDate]);

  // Real-time calculation using exact formula
  const calculation = useMemo(() => {
    return calculateJobTarget(startDate, finishDate, refDate);
  }, [startDate, finishDate, refDate]);

  const effectiveTarget = manualTargetOverride
    ? manualTargetValue
    : calculation.targetProgressPct;

  if (!isOpen) return null;

  const handleSetTodayRef = () => {
    const today = new Date();
    setRefDate(formatToISO(today));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!deskripsi.trim()) return;

    const finalArea = isCustomArea
      ? customAreaText.trim() || 'Pabrik 1'
      : area;

    const finalJob: JobItem = {
      id: jobToEdit?.id || Date.now(),
      deskripsi: deskripsi.trim(),
      area: finalArea.toUpperCase(),
      pic: pic.trim() || undefined,
      start: formatToIndonesian(startDate),
      finish: formatToIndonesian(finishDate),
      progress_target: Number(effectiveTarget.toFixed(2)),
      progress_actual: Math.min(Math.max(Number(progressActual) || 0, 0), 100),
      status: Number(progressActual) >= 100 ? 'SELESAI' : 'AKTIF',
    };

    onSaveJob(finalJob, formatToIndonesian(refDate));
    onClose();
  };

  return (
    <div
      id="modal-job-editor"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/75 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto"
    >
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[95vh]">
        {/* Modal Header */}
        <div className="bg-[#032F73] text-white px-6 py-4 flex items-center justify-between border-b border-blue-900">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-lg text-yellow-300">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-lg tracking-wide uppercase font-sans">
                {jobToEdit ? 'Edit Pekerjaan' : 'Tambah Pekerjaan Baru'}
              </h3>
              <p className="text-xs text-blue-200">
                Kalkulasi target schedule otomatis sesuai durasi hari kerja & tanggal referensi
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex flex-col gap-4">
          {/* 1. Deskripsi Pekerjaan */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-[#032F73]" />
              <span>1. Deskripsi Pekerjaan</span>
            </label>
            <textarea
              required
              rows={2}
              value={deskripsi}
              onChange={(e) => setDeskripsi(e.target.value)}
              placeholder="Contoh: Repair Tube Bundle 101C / Pabrikasi Sand Loading Support"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-900 font-bold placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#032F73] text-sm"
            />
          </div>

          {/* 2. Area / Lokasi Pabrik & PIC (Nama) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* 2. Area / Lokasi Pabrik */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-[#032F73]" />
                <span>2. Area / Lokasi Pabrik</span>
              </label>
              <div className="flex flex-col gap-1.5">
                <select
                  value={isCustomArea ? 'MANUAL' : area}
                  onChange={(e) => {
                    if (e.target.value === 'MANUAL') {
                      setIsCustomArea(true);
                    } else {
                      setIsCustomArea(false);
                      setArea(e.target.value);
                    }
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-[#032F73] text-sm"
                >
                  {COMMON_AREAS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                  <option value="MANUAL">✍️ Isi Manual (Lainnya)...</option>
                </select>

                {isCustomArea ? (
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="Ketik area / lokasi manual..."
                    value={customAreaText}
                    onChange={(e) => setCustomAreaText(e.target.value)}
                    className="w-full bg-white border-2 border-[#032F73] rounded-lg px-3 py-2 text-slate-900 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-[#032F73]"
                  />
                ) : (
                  <div className="text-xs text-slate-600 flex items-center px-3 py-1.5 bg-slate-100 rounded-lg border border-slate-200">
                    <span>Area terpilih:</span>
                    <strong className="ml-1.5 text-[#032F73] font-black">{area}</strong>
                  </div>
                )}
              </div>
            </div>

            {/* PIC (Nama Penanggung Jawab) */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-4 h-4 text-[#032F73]" />
                <span>PIC (Nama)</span>
              </label>
              <input
                type="text"
                placeholder="Contoh: Hendra W. / Agus P. / Budi"
                value={pic}
                onChange={(e) => setPic(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-bold placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#032F73] text-sm"
              />
              <span className="text-[11px] text-slate-500 font-medium">
                Ditampilkan tepat di bawah Area/Lokasi pada tabel job
              </span>
            </div>
          </div>

          {/* 3 & 4. Tanggal Start & Tanggal Finish */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            {/* Tanggal Start */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#032F73]" />
                <span>3. Tanggal Start (Mulai)</span>
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono font-bold text-sm focus:outline-none focus:ring-2 focus:ring-[#032F73]"
              />
              <span className="text-[11px] font-bold text-slate-500">
                {formatToIndonesian(startDate)}
              </span>
            </div>

            {/* Tanggal Finish */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#EA7A2D]" />
                <span>4. Tanggal Finish (Selesai)</span>
              </label>
              <input
                type="date"
                required
                value={finishDate}
                onChange={(e) => setFinishDate(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono font-bold text-sm focus:outline-none focus:ring-2 focus:ring-[#EA7A2D]"
              />
              <span className="text-[11px] font-bold text-[#EA7A2D]">
                {formatToIndonesian(finishDate)}
              </span>
            </div>
          </div>

          {/* 5 & 6. Progress Actual & Tanggal Referensi Dashboard */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Progress Actual */}
            <div className="flex flex-col gap-1.5 p-3.5 bg-blue-50/50 rounded-xl border border-blue-200">
              <label className="text-xs font-black text-[#1054C1] uppercase tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Percent className="w-3.5 h-3.5" />
                  <span>5. ACTUAL (%)</span>
                </span>
                <span className="font-mono text-sm font-black">{progressActual}%</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  required
                  value={progressActual}
                  onChange={(e) => setProgressActual(parseFloat(e.target.value) || 0)}
                  className="w-full bg-white border border-[#1054C1]/40 rounded-lg px-3 py-2 text-slate-900 font-mono font-black text-base focus:outline-none focus:ring-2 focus:ring-[#1054C1]"
                />
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="0.5"
                value={progressActual}
                onChange={(e) => setProgressActual(parseFloat(e.target.value) || 0)}
                className="w-full accent-[#1054C1] cursor-pointer"
              />
            </div>

            {/* Tanggal Referensi Dashboard */}
            <div className="flex flex-col gap-1.5 p-3.5 bg-orange-50/50 rounded-xl border border-orange-200">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-[#EA7A2D] uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>6. Tanggal Hari Ini</span>
                </label>
                <button
                  type="button"
                  onClick={handleSetTodayRef}
                  className="text-[10px] font-black uppercase text-orange-700 bg-orange-200/70 hover:bg-orange-300 px-2 py-0.5 rounded transition-colors"
                >
                  Hari Ini
                </button>
              </div>
              <input
                type="date"
                required
                value={refDate}
                onChange={(e) => setRefDate(e.target.value)}
                className="w-full bg-white border border-[#EA7A2D]/40 rounded-lg px-3 py-2 text-slate-900 font-mono font-bold text-sm focus:outline-none focus:ring-2 focus:ring-[#EA7A2D]"
              />
              <span className="text-[11px] font-bold text-slate-600">
                {formatToIndonesian(refDate)}
              </span>
            </div>
          </div>

          {/* BOX KALKULASI OTOMATIS (Sesuai Logika Bagian 2) */}
          <div className="bg-slate-900 text-white rounded-xl p-4 border-2 border-yellow-500/80 shadow-md flex flex-col gap-2.5">
            <div className="flex items-center justify-between border-b border-slate-700 pb-2">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-yellow-400" />
                <span className="text-xs font-black text-yellow-400 tracking-wider uppercase font-sans">
                  HASIL KALKULASI TARGET OTOMATIS
                </span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-yellow-400/20 text-yellow-300 font-mono font-bold">
                Formula Aktif
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center pt-1">
              {/* 1. Total Hari */}
              <div className="bg-slate-800/90 rounded-lg p-2 flex flex-col items-center">
                <span className="text-[10px] text-slate-400 uppercase font-bold">Total Durasi</span>
                <span className="text-base font-black text-white font-mono mt-0.5">
                  {calculation.totalDays} Hari
                </span>
                <span className="text-[9px] text-slate-400">Finish - Start + 1</span>
              </div>

              {/* 2. Target Harian */}
              <div className="bg-slate-800/90 rounded-lg p-2 flex flex-col items-center">
                <span className="text-[10px] text-slate-400 uppercase font-bold">Target Harian</span>
                <span className="text-base font-black text-orange-400 font-mono mt-0.5">
                  {calculation.dailyTargetPct.toFixed(2)}%
                </span>
                <span className="text-[9px] text-slate-400">100% / Total Hari</span>
              </div>

              {/* 3. Hari Berjalan */}
              <div className="bg-slate-800/90 rounded-lg p-2 flex flex-col items-center">
                <span className="text-[10px] text-slate-400 uppercase font-bold">Hari Berjalan</span>
                <span className="text-base font-black text-cyan-300 font-mono mt-0.5">
                  {calculation.isBeforeStart
                    ? '0 Hari'
                    : calculation.isAfterFinish
                    ? `${calculation.totalDays} Hari (Selesai)`
                    : `Hari ke-${calculation.daysElapsed}`}
                </span>
                <span className="text-[9px] text-slate-400">
                  {calculation.isBeforeStart
                    ? 'Belum Mulai'
                    : calculation.isAfterFinish
                    ? 'Melewati Finish'
                    : 'Sedang Berjalan'}
                </span>
              </div>

              {/* 4. Target Schedule (%) */}
              <div className="bg-orange-950/80 border border-orange-500 rounded-lg p-2 flex flex-col items-center">
                <span className="text-[10px] text-orange-300 uppercase font-black font-inter">
                  Target Schedule
                </span>
                <span className="text-xl font-black text-[#EA7A2D] font-inter tabular-nums mt-0.5">
                  {effectiveTarget.toFixed(2)}%
                </span>
                <span className="text-[9px] text-orange-200 font-inter tabular-nums">
                  ({calculation.daysElapsed}/{calculation.totalDays}) × 100%
                </span>
              </div>
            </div>

            {/* Optional Manual Target Override toggle */}
            <div className="pt-1 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={manualTargetOverride}
                  onChange={(e) => setManualTargetOverride(e.target.checked)}
                  className="rounded accent-[#EA7A2D]"
                />
                <span className="text-[11px]">Override nilai Target Schedule secara manual</span>
              </label>

              {manualTargetOverride && (
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={manualTargetValue}
                    onChange={(e) => setManualTargetValue(parseFloat(e.target.value) || 0)}
                    className="w-20 bg-slate-800 border border-orange-400 text-white font-mono px-2 py-0.5 rounded text-xs text-right"
                  />
                  <span className="font-mono">%</span>
                </div>
              )}
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-200">
            {jobToEdit && onDeleteJob ? (
              <button
                type="button"
                onClick={() => {
                  onDeleteJob(jobToEdit.id);
                  onClose();
                }}
                className="flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-3 py-2 rounded-xl text-xs font-bold transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>Hapus Job</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-[#032F73] hover:bg-blue-900 text-white text-xs font-black tracking-wide shadow-md transition-all"
              >
                <Save className="w-4 h-4" />
                <span>Simpan Pekerjaan</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
