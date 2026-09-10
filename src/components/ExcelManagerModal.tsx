import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { JobItem } from '../types';
import { INITIAL_JOBS, DEMO_EXTENDED_JOBS } from '../data/initialJobs';
import { X, Upload, Download, FileSpreadsheet, Check, AlertCircle, RefreshCw } from 'lucide-react';

interface ExcelManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentJobs: JobItem[];
  onImportJobs: (jobs: JobItem[]) => void;
  onResetToDefault: () => void;
}

export const ExcelManagerModal: React.FC<ExcelManagerModalProps> = ({
  isOpen,
  onClose,
  currentJobs,
  onImportJobs,
  onResetToDefault,
}) => {
  const [dragOver, setDragOver] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Process File with SheetJS
  const processExcelFile = (file: File) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);

        if (!jsonData || jsonData.length === 0) {
          setErrorMessage('File Excel kosong atau tidak memiliki data yang valid.');
          return;
        }

        // Map various column name representations to JobItem
        const parsedJobs: JobItem[] = jsonData.map((row, idx) => {
          // Normalize keys to lowercase trimmed
          const normalized: Record<string, unknown> = {};
          Object.keys(row).forEach((k) => {
            normalized[k.trim().toLowerCase()] = row[k];
          });

          const deskripsi = String(
            normalized['deskripsi'] ||
              normalized['deskripsi pekerjaan'] ||
              normalized['pekerjaan'] ||
              normalized['uraian pekerjaan'] ||
              normalized['job description'] ||
              normalized['nama pekerjaan'] ||
              `Pekerjaan ${idx + 1}`
          );

          const area = String(
            normalized['area'] ||
              normalized['lokasi'] ||
              normalized['plant'] ||
              normalized['pabrik'] ||
              normalized['unit'] ||
              'Workshop'
          );

          const start = String(
            normalized['start'] ||
              normalized['tanggal start'] ||
              normalized['mulai'] ||
              normalized['tgl mulai'] ||
              '26 Agustus 2026'
          );

          const finish = String(
            normalized['finish'] ||
              normalized['tanggal finish'] ||
              normalized['selesai'] ||
              normalized['tgl selesai'] ||
              '01 September 2026'
          );

          const rawTarget =
            normalized['schedule_target'] ??
            normalized['target_schedule'] ??
            normalized['schedule target'] ??
            normalized['target schedule'] ??
            normalized['progress_target'] ??
            normalized['progress target'] ??
            normalized['target'] ??
            normalized['schedule'] ??
            normalized['progress'] ??
            0;

          const rawActual =
            normalized['actual_schedule'] ??
            normalized['actual schedule'] ??
            normalized['schedule_actual'] ??
            normalized['progress_actual'] ??
            normalized['progress actual'] ??
            normalized['actual'] ??
            normalized['realisasi'] ??
            0;

          const progress_target = typeof rawTarget === 'number' ? rawTarget : parseFloat(String(rawTarget).replace('%', '')) || 0;
          const progress_actual = typeof rawActual === 'number' ? rawActual : parseFloat(String(rawActual).replace('%', '')) || 0;

          const status = String(
            normalized['status'] || (progress_actual >= 100 ? 'SELESAI' : 'AKTIF')
          );

          return {
            id: Number(normalized['id']) || idx + 1,
            deskripsi,
            area,
            start,
            finish,
            progress_target,
            progress_actual,
            status,
          };
        });

        onImportJobs(parsedJobs);
        setSuccessMessage(`Berhasil mengimpor ${parsedJobs.length} pekerjaan dari file Excel!`);
        setTimeout(() => {
          onClose();
        }, 1200);
      } catch (err) {
        console.error(err);
        setErrorMessage('Gagal memproses file Excel. Pastikan format file adalah .xlsx atau .xls.');
      }
    };

    reader.onerror = () => {
      setErrorMessage('Terjadi kesalahan saat membaca file.');
    };

    reader.readAsArrayBuffer(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processExcelFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processExcelFile(e.target.files[0]);
    }
  };

  // Export current jobs as DASHBOARD WS.xlsx
  const handleExportExcel = () => {
    try {
      const exportData = currentJobs.map((job) => ({
        id: job.id,
        deskripsi: job.deskripsi,
        area: job.area,
        start: job.start,
        finish: job.finish,
        progress_target: job.progress_target,
        progress_actual: job.progress_actual,
        status: job.status,
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);

      // Auto-fit column widths
      worksheet['!cols'] = [
        { wch: 6 }, // id
        { wch: 50 }, // deskripsi
        { wch: 16 }, // area
        { wch: 20 }, // start
        { wch: 20 }, // finish
        { wch: 16 }, // progress_target
        { wch: 16 }, // progress_actual
        { wch: 12 }, // status
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'DASHBOARD WS');
      XLSX.writeFile(workbook, 'DASHBOARD WS.xlsx');
      setSuccessMessage('File "DASHBOARD WS.xlsx" berhasil diunduh!');
    } catch (err) {
      console.error(err);
      setErrorMessage('Gagal mengekspor file Excel.');
    }
  };

  return (
    <div
      id="excel-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
    >
      <div
        id="excel-modal-container"
        className="w-full max-w-xl bg-gradient-to-b from-[#0F2C59] to-[#0A1832] border-2 border-yellow-400 rounded-2xl shadow-2xl p-6 relative flex flex-col gap-4 text-white"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-blue-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/90 flex items-center justify-center shadow-md">
              <FileSpreadsheet className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black text-yellow-400 uppercase tracking-wide">
                Kelola Data Excel (SheetJS)
              </h2>
              <p className="text-blue-200 text-xs">
                Import / Export file spreadsheet `DASHBOARD WS.xlsx`
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-blue-900/60 hover:bg-rose-800 text-blue-200 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Alerts */}
        {errorMessage && (
          <div className="flex items-center gap-2 p-3 bg-rose-950/80 border border-rose-500 rounded-xl text-rose-200 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}
        {successMessage && (
          <div className="flex items-center gap-2 p-3 bg-emerald-950/80 border border-emerald-500 rounded-xl text-emerald-200 text-xs">
            <Check className="w-4 h-4 flex-shrink-0 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Drag and Drop Zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center flex flex-col items-center justify-center cursor-pointer transition-all ${
            dragOver
              ? 'border-yellow-400 bg-blue-900/50 scale-[1.01]'
              : 'border-blue-600/70 bg-blue-950/50 hover:border-yellow-400 hover:bg-blue-900/30'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".xlsx, .xls"
            className="hidden"
          />
          <Upload className="w-10 h-10 text-yellow-400 mb-2 animate-bounce" />
          <p className="text-sm font-bold text-white">
            Tarik & Lepaskan file <span className="text-yellow-300 font-mono">DASHBOARD WS.xlsx</span> ke sini
          </p>
          <p className="text-xs text-blue-300 mt-1">atau klik untuk memilih file dari komputer</p>
          <span className="mt-3 text-[10px] text-blue-400 bg-blue-900/80 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
            Mendukung .xlsx & .xls
          </span>
        </div>

        {/* Quick Presets & Export Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-blue-800/80">
          <button
            onClick={handleExportExcel}
            className="flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-600 text-white font-bold py-2 px-3 rounded-xl text-xs transition-colors shadow"
          >
            <Download className="w-4 h-4" />
            <span>Export DASHBOARD WS.xlsx</span>
          </button>

          <button
            onClick={() => {
              onImportJobs(INITIAL_JOBS);
              setSuccessMessage(`Data dimuat ke ${INITIAL_JOBS.length} pekerjaan default!`);
              setTimeout(onClose, 800);
            }}
            className="flex items-center justify-center gap-2 bg-blue-800 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded-xl text-xs transition-colors shadow"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Load Data Default ({INITIAL_JOBS.length} Job)</span>
          </button>

          <button
            onClick={() => {
              onImportJobs(DEMO_EXTENDED_JOBS);
              setSuccessMessage('Data contoh (8 pekerjaan) dimuat untuk uji rotasi auto-scroll!');
              setTimeout(onClose, 800);
            }}
            className="flex items-center justify-center gap-2 bg-amber-700 hover:bg-amber-600 text-white font-bold py-2 px-3 rounded-xl text-xs transition-colors shadow"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Load Demo (8 Job & Carousel)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
