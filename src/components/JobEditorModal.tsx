import React, { useState, useEffect, useMemo } from 'react';
import { JobItem, JobWorkStatus } from '../types';
import {
  calculateJobTarget,
  formatToISO,
  formatToIndonesian,
  normalizeWorkStatus,
  parseDate,
} from '../utils/jobCalculations';
import {
  X,
  Save,
  PlusCircle,
  Trash2,
  Calendar,
  Calculator,
  Clock,
  MapPin,
  FileText,
  Percent,
  User,
  Activity,
} from 'lucide-react';

interface JobEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobToEdit: JobItem | null;
  onSaveJob: (job: JobItem, updatedRefDate?: string) => void;
  onDeleteJob?: (id: number) => void;
  currentDashboardDate: string;
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
  const [workStatus, setWorkStatus] = useState<JobWorkStatus>('I/P');

  const [startDate, setStartDate] = useState('2026-09-09');
  const [finishDate, setFinishDate] = useState('2026-09-15');
  const [refDate, setRefDate] = useState('2026-09-09');

  const [progressActual, setProgressActual] = useState<number>(20);
  const [manualTargetOverride, setManualTargetOverride] = useState<boolean>(false);
  const [manualTargetValue, setManualTargetValue] = useState<number>(14.29);

  useEffect(() => {
    if (!isOpen) return;

    const isoRef = formatToISO(currentDashboardDate);
    setRefDate(isoRef);

    if (jobToEdit) {
      setDeskripsi(jobToEdit.deskripsi);
      setPic(jobToEdit.pic || '');
      setWorkStatus(normalizeWorkStatus(jobToEdit.status));
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
      setDeskripsi('');
      setArea('Pabrik 1');
      setIsCustomArea(false);
      setCustomAreaText('');
      setPic('');
      setWorkStatus('I/P');
      setStartDate(isoRef);
      const d = parseDate(isoRef) || new Date();
      const finishD = new Date(d.getTime() + 6 * 24 * 60 * 60 * 1000);
      setFinishDate(formatToISO(finishD));
      setProgressActual(0);
      setManualTargetOverride(false);
    }
  }, [jobToEdit, isOpen, currentDashboardDate]);

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
      status: workStatus,
    };

    onSaveJob(finalJob, formatToIndonesian(refDate));
    onClose();
  };

  return (
    <div
      id="modal-job-editor"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto"
    >
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col my-auto max-h-[95vh]">
        {/* Modal Header */}
        <div className="bg-[#032F73] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl text-[#EA7A2D]">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg tracking-tight">
                {jobToEdit ? 'Edit Pekerjaan' : 'Tambah Pekerjaan Baru'}
              </h3>
              <p className="text-xs text-blue-200/90 font-normal">
                Target schedule dihitung otomatis sesuai durasi kerja &amp; tanggal referensi
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label="Tutup modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex flex-col gap-4">
          {/* 1. Deskripsi Pekerjaan */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-[#032F73]" />
              <span>Deskripsi Pekerjaan</span>
            </label>
            <textarea
              required
              rows={2}
              value={deskripsi}
              onChange={(e) => setDeskripsi(e.target.value)}
              placeholder="Contoh: Repair Tube Bundle 101C / Pabrikasi Sand Loading Support"
              className="w-full bg-white border border-slate-300 rounded-xl p-3 text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:border-[#032F73] focus:ring-2 focus:ring-[#032F73]/15 text-sm transition-all"
            />
          </div>

          {/* 2. Status Pekerjaan (I/P vs HOLD) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[#F8FAFC] border border-slate-200/80 rounded-xl px-3.5 py-2.5">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#032F73]" />
              <div>
                <div className="text-xs font-semibold text-slate-800">Status Pekerjaan</div>
                <div className="text-[11px] text-slate-500">
                  Pilih I/P (sedang dikerjakan) atau HOLD (sementara ditunda)
                </div>
              </div>
            </div>
            <div className="inline-flex items-center gap-1 bg-slate-200/75 p-1 rounded-lg self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setWorkStatus('I/P')}
                className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${
                  workStatus === 'I/P'
                    ? 'bg-[#032F73] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                I/P (In Progress)
              </button>
              <button
                type="button"
                onClick={() => setWorkStatus('HOLD')}
                className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${
                  workStatus === 'HOLD'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                HOLD
              </button>
            </div>
          </div>

          {/* 3. Area / Lokasi Pabrik & PIC (Nama) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#032F73]" />
                <span>Area / Lokasi Pabrik</span>
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
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-semibold focus:outline-none focus:border-[#032F73] focus:ring-2 focus:ring-[#032F73]/15 text-sm transition-all"
                >
                  {COMMON_AREAS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                  <option value="MANUAL">Isi Manual (Lainnya)...</option>
                </select>

                {isCustomArea ? (
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="Ketik area / lokasi manual..."
                    value={customAreaText}
                    onChange={(e) => setCustomAreaText(e.target.value)}
                    className="w-full bg-white border border-[#032F73] rounded-xl px-3 py-2 text-slate-900 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-[#032F73]/15"
                  />
                ) : (
                  <span className="text-[11px] text-slate-500">
                    Area terpilih: <strong className="text-[#032F73] font-semibold">{area}</strong>
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-[#032F73]" />
                <span>PIC (Penanggung Jawab)</span>
              </label>
              <input
                type="text"
                placeholder="Contoh: Hendra W. / Agus P."
                value={pic}
                onChange={(e) => setPic(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:border-[#032F73] focus:ring-2 focus:ring-[#032F73]/15 text-sm transition-all"
              />
              <span className="text-[11px] text-slate-500">
                Ditampilkan tepat di bawah Area pada baris pekerjaan
              </span>
            </div>
          </div>

          {/* 4. Tanggal Start & Tanggal Finish */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#032F73]" />
                <span>Tanggal Start (Mulai)</span>
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-mono-data font-semibold text-sm focus:outline-none focus:border-[#032F73] focus:ring-2 focus:ring-[#032F73]/15"
              />
              <span className="text-[11px] font-medium text-slate-500">
                {formatToIndonesian(startDate)}
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#EA7A2D]" />
                <span>Tanggal Finish (Selesai)</span>
              </label>
              <input
                type="date"
                required
                value={finishDate}
                onChange={(e) => setFinishDate(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-mono-data font-semibold text-sm focus:outline-none focus:border-[#EA7A2D] focus:ring-2 focus:ring-[#EA7A2D]/20"
              />
              <span className="text-[11px] font-semibold text-[#D96B1F]">
                {formatToIndonesian(finishDate)}
              </span>
            </div>
          </div>

          {/* 5. Progress Actual & Tanggal Referensi Dashboard */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[#1054C1] flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Percent className="w-3.5 h-3.5" />
                  <span>Progress Actual (%)</span>
                </span>
                <span className="font-mono-data text-sm font-bold">{progressActual}%</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                required
                value={progressActual}
                onChange={(e) => setProgressActual(parseFloat(e.target.value) || 0)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-mono-data font-bold text-sm focus:outline-none focus:border-[#1054C1] focus:ring-2 focus:ring-[#1054C1]/15"
              />
              <input
                type="range"
                min="0"
                max="100"
                step="0.5"
                value={progressActual}
                onChange={(e) => setProgressActual(parseFloat(e.target.value) || 0)}
                className="w-full accent-[#1054C1] cursor-pointer mt-0.5"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[#D96B1F] flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Tanggal Referensi</span>
                </label>
                <button
                  type="button"
                  onClick={handleSetTodayRef}
                  className="text-[11px] font-semibold text-[#EA7A2D] hover:text-[#D96B1F] transition-colors"
                >
                  Set Hari Ini
                </button>
              </div>
              <input
                type="date"
                required
                value={refDate}
                onChange={(e) => setRefDate(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-mono-data font-semibold text-sm focus:outline-none focus:border-[#EA7A2D] focus:ring-2 focus:ring-[#EA7A2D]/20"
              />
              <span className="text-[11px] font-medium text-slate-500">
                {formatToIndonesian(refDate)}
              </span>
            </div>
          </div>

          {/* Ringkasan Kalkulasi Target Schedule */}
          <div className="bg-[#F4F7FB] rounded-xl p-4 border border-[#032F73]/15 flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-[#032F73]" />
                <span className="text-xs font-bold text-[#032F73]">
                  Hasil Kalkulasi Target Schedule
                </span>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">
                Otomatis
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="flex flex-col items-center">
                <span className="text-[11px] text-slate-500 font-medium">Total Durasi</span>
                <span className="text-base font-bold text-slate-900 font-mono-data mt-0.5">
                  {calculation.totalDays} Hari
                </span>
                <span className="text-[10px] text-slate-400">Finish - Start + 1</span>
              </div>

              <div className="flex flex-col items-center sm:border-l sm:border-slate-200/80">
                <span className="text-[11px] text-slate-500 font-medium">Target Harian</span>
                <span className="text-base font-bold text-[#032F73] font-mono-data mt-0.5">
                  {calculation.dailyTargetPct.toFixed(2)}%
                </span>
                <span className="text-[10px] text-slate-400">100% / Total Hari</span>
              </div>

              <div className="flex flex-col items-center sm:border-l sm:border-slate-200/80">
                <span className="text-[11px] text-slate-500 font-medium">Hari Berjalan</span>
                <span className="text-base font-bold text-[#1054C1] font-mono-data mt-0.5">
                  {calculation.isBeforeStart
                    ? '0 Hari'
                    : calculation.isAfterFinish
                    ? `${calculation.totalDays} Hari`
                    : `Ke-${calculation.daysElapsed}`}
                </span>
                <span className="text-[10px] text-slate-400">
                  {calculation.isBeforeStart
                    ? 'Belum Mulai'
                    : calculation.isAfterFinish
                    ? 'Melewati Finish'
                    : 'Sedang Berjalan'}
                </span>
              </div>

              <div className="flex flex-col items-center sm:border-l sm:border-slate-200/80">
                <span className="text-[11px] text-[#D96B1F] font-semibold">Target Schedule</span>
                <span className="text-lg font-extrabold text-[#EA7A2D] font-mono-data mt-0.5">
                  {effectiveTarget.toFixed(2)}%
                </span>
                <span className="text-[10px] text-slate-500 font-mono-data">
                  ({calculation.daysElapsed}/{calculation.totalDays}) &times; 100%
                </span>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between text-xs text-slate-600 border-t border-slate-200/80">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={manualTargetOverride}
                  onChange={(e) => setManualTargetOverride(e.target.checked)}
                  className="rounded accent-[#EA7A2D]"
                />
                <span className="text-xs font-medium">Ubah nilai Target Schedule secara manual</span>
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
                    className="w-20 bg-white border border-[#EA7A2D] text-slate-900 font-mono-data font-semibold px-2 py-0.5 rounded-md text-xs text-right focus:outline-none"
                  />
                  <span className="font-mono-data text-slate-500">%</span>
                </div>
              )}
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-200/80">
            {jobToEdit && onDeleteJob ? (
              <button
                type="button"
                onClick={() => {
                  onDeleteJob(jobToEdit.id);
                  onClose();
                }}
                className="flex items-center gap-1.5 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors"
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
                className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#032F73] hover:bg-[#022154] text-white text-xs font-bold shadow-sm transition-colors"
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
