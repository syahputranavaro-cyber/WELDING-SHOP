import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { JobItem, BrandingImages, SyncStatusType } from '../types';
import { INITIAL_JOBS, DEMO_EXTENDED_JOBS } from '../data/initialJobs';
import {
  X,
  Upload,
  Download,
  FileSpreadsheet,
  Check,
  AlertCircle,
  RefreshCw,
  Cloud,
  FileJson,
  ShieldCheck,
} from 'lucide-react';

interface ExcelManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentJobs: JobItem[];
  onImportJobs: (jobs: JobItem[]) => void;
  onResetToDefault: () => void;
  branding?: BrandingImages;
  onImportBackupJson?: (data: any) => void;
  onExportBackupJson?: () => void;
  onForceSaveServer?: () => void;
  syncStatus?: SyncStatusType;
}

export const ExcelManagerModal: React.FC<ExcelManagerModalProps> = ({
  isOpen,
  onClose,
  currentJobs,
  onImportJobs,
  onResetToDefault,
  onImportBackupJson,
  onExportBackupJson,
  onForceSaveServer,
}) => {
  const [activeTab, setActiveTab] = useState<'excel' | 'backup'>('backup');
  const [dragOver, setDragOver] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonFileInputRef = useRef<HTMLInputElement>(null);

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

          const pic = String(
            normalized['pic'] ||
              normalized['pic (nama)'] ||
              normalized['nama pic'] ||
              normalized['pic nama'] ||
              normalized['penanggung jawab'] ||
              normalized['person in charge'] ||
              normalized['nama'] ||
              ''
          ).trim();

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
            normalized['progress_actual'] ??
            normalized['actual_progress'] ??
            normalized['progress actual'] ??
            normalized['actual progress'] ??
            normalized['actual'] ??
            normalized['realisasi'] ??
            0;

          const parsePct = (val: unknown): number => {
            if (typeof val === 'number') {
              return val <= 1 && val > 0 ? Number((val * 100).toFixed(2)) : Number(val.toFixed(2));
            }
            if (typeof val === 'string') {
              const clean = val.replace('%', '').trim().replace(',', '.');
              const num = parseFloat(clean);
              return isNaN(num) ? 0 : Number(num.toFixed(2));
            }
            return 0;
          };

          const rawStatus = String(normalized['status'] || '').toUpperCase();
          let status: 'AKTIF' | 'SELESAI' = 'AKTIF';
          if (rawStatus.includes('SELESAI') || rawStatus.includes('DONE') || rawStatus.includes('COMPLETE')) {
            status = 'SELESAI';
          }

          const parsedActual = parsePct(rawActual);
          if (parsedActual >= 100) {
            status = 'SELESAI';
          }

          return {
            id: Number(normalized['no'] || normalized['id'] || idx + 1),
            deskripsi,
            area,
            pic: pic || undefined,
            start,
            finish,
            progress_target: parsePct(rawTarget),
            progress_actual: parsedActual,
            status,
          };
        });

        if (parsedJobs.length > 0) {
          onImportJobs(parsedJobs);
          setSuccessMessage(
            `Berhasil memuat ${parsedJobs.length} data pekerjaan dari file Excel!`
          );
          setTimeout(() => {
            onClose();
          }, 1200);
        } else {
          setErrorMessage('Tidak ada data yang cocok dengan format pekerjaan Welding Shop.');
        }
      } catch (err: any) {
        console.error('Excel parse error:', err);
        setErrorMessage(`Gagal membaca file Excel: ${err.message || 'Format tidak dikenali'}`);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // Process JSON Backup file
  const processJsonBackupFile = (file: File) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text);

        if (!parsed || typeof parsed !== 'object') {
          setErrorMessage('Format berkas backup JSON tidak valid.');
          return;
        }

        if (onImportBackupJson) {
          onImportBackupJson(parsed);
          setSuccessMessage('Cadangan lengkap (.json) berhasil dipulihkan!');
          setTimeout(() => {
            onClose();
          }, 1200);
        }
      } catch (err: any) {
        console.error('JSON parse error:', err);
        setErrorMessage(`Gagal membaca berkas cadangan: ${err.message || 'File JSON rusak'}`);
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (activeTab === 'excel') {
        processExcelFile(file);
      } else {
        processJsonBackupFile(file);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processExcelFile(e.target.files[0]);
    }
  };

  const handleJsonFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processJsonBackupFile(e.target.files[0]);
    }
  };

  // Export current jobs to Excel
  const handleExportExcel = () => {
    try {
      const exportData = currentJobs.map((j, idx) => ({
        NO: idx + 1,
        'DESKRIPSI PEKERJAAN': j.deskripsi,
        AREA: j.area,
        'PIC (NAMA)': j.pic || '-',
        START: j.start,
        FINISH: j.finish,
        'TARGET SCHEDULE (%)': j.progress_target,
        'PROGRESS ACTUAL (%)': j.progress_actual,
        STATUS: j.status,
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);

      worksheet['!cols'] = [
        { wch: 6 },
        { wch: 45 },
        { wch: 15 },
        { wch: 18 },
        { wch: 18 },
        { wch: 18 },
        { wch: 22 },
        { wch: 22 },
        { wch: 12 },
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'DASHBOARD WS');

      XLSX.writeFile(workbook, 'DASHBOARD WS.xlsx');
      setSuccessMessage('File DASHBOARD WS.xlsx berhasil diunduh!');
    } catch (err: any) {
      console.error('Export error:', err);
      setErrorMessage(`Gagal mengunduh Excel: ${err.message}`);
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
              {activeTab === 'excel' ? (
                <FileSpreadsheet className="w-6 h-6 text-white" />
              ) : (
                <FileJson className="w-6 h-6 text-white" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-black text-yellow-400 uppercase tracking-wide">
                {activeTab === 'excel' ? 'Kelola Data Excel (SheetJS)' : 'Cadangan & Sinkronisasi Data'}
              </h2>
              <p className="text-blue-200 text-xs">
                {activeTab === 'excel'
                  ? 'Import / Export file spreadsheet DASHBOARD WS.xlsx'
                  : 'Kelola cadangan lengkap & pemulihan data lintas perangkat'}
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

        {/* Tab Navigation */}
        <div className="flex border-b border-blue-800/80 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('excel')}
            className={`flex items-center gap-2 pb-2 px-3 text-xs font-black uppercase tracking-wider transition-colors border-b-2 ${
              activeTab === 'excel'
                ? 'border-yellow-400 text-yellow-300'
                : 'border-transparent text-blue-300 hover:text-white'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Excel (.xlsx)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('backup')}
            className={`flex items-center gap-2 pb-2 px-3 text-xs font-black uppercase tracking-wider transition-colors border-b-2 ${
              activeTab === 'backup'
                ? 'border-yellow-400 text-yellow-300'
                : 'border-transparent text-blue-300 hover:text-white'
            }`}
          >
            <FileJson className="w-4 h-4" />
            <span>Cadangan Lengkap (.json)</span>
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

        {/* TAB 1: EXCEL */}
        {activeTab === 'excel' && (
          <>
            {/* Drag and Drop Zone Excel */}
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
                <span>Load Default ({INITIAL_JOBS.length} Job)</span>
              </button>

              <button
                onClick={() => {
                  onImportJobs(DEMO_EXTENDED_JOBS);
                  setSuccessMessage('Data contoh (8 pekerjaan) dimuat untuk uji rotasi!');
                  setTimeout(onClose, 800);
                }}
                className="flex items-center justify-center gap-2 bg-amber-700 hover:bg-amber-600 text-white font-bold py-2 px-3 rounded-xl text-xs transition-colors shadow"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Load Demo (8 Job)</span>
              </button>
            </div>
          </>
        )}

        {/* TAB 2: BACKUP LENGKAP */}
        {activeTab === 'backup' && (
          <div className="flex flex-col gap-3">
            {/* Info Box */}
            <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/80 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs">
                <div className="font-black text-emerald-300 uppercase tracking-wide">
                  Sinkronisasi Lintas Perangkat &amp; Cadangan Portabel
                </div>
                <p className="text-emerald-100/90 mt-1 leading-relaxed">
                  Semua data pekerjaan, arsip, logo PT Pupuk Kaltim, logo Welding Shop, dan poster K3 tersimpan otomatis secara permanen.
                  Gunakan fitur cadangan di bawah untuk mengunduh salinan portabel atau memulihkan data dari file cadangan sebelumnya.
                </p>
              </div>
            </div>

            {/* Actions Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Unduh Cadangan JSON */}
              <div className="p-4 rounded-xl bg-blue-950/60 border border-blue-700/70 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-yellow-300 font-bold text-xs">
                  <FileJson className="w-4 h-4" />
                  <span>Unduh File Cadangan (.json)</span>
                </div>
                <p className="text-[11px] text-blue-200">
                  Menyimpan seluruh pekerjaan, <strong>semua arsip selesai/dihapus</strong>, PIN, dan gambar logo/poster ke dalam 1 file cadangan portabel.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    if (onExportBackupJson) {
                      onExportBackupJson();
                      setSuccessMessage('File cadangan lengkap (.json) berhasil diunduh!');
                    }
                  }}
                  className="mt-auto flex items-center justify-center gap-2 bg-[#EA7A2D] hover:bg-amber-600 text-white font-bold py-2 px-3 rounded-lg text-xs transition-colors shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  <span>Unduh Cadangan (.json)</span>
                </button>
              </div>

              {/* Pulihkan Cadangan JSON */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => jsonFileInputRef.current?.click()}
                className={`p-4 rounded-xl border-2 border-dashed flex flex-col gap-2 cursor-pointer transition-all ${
                  dragOver
                    ? 'border-yellow-400 bg-blue-900/50'
                    : 'border-blue-600/70 bg-blue-950/60 hover:border-yellow-400'
                }`}
              >
                <input
                  type="file"
                  ref={jsonFileInputRef}
                  onChange={handleJsonFileChange}
                  accept=".json"
                  className="hidden"
                />
                <div className="flex items-center gap-2 text-yellow-300 font-bold text-xs">
                  <Upload className="w-4 h-4" />
                  <span>Pulihkan dari File (.json)</span>
                </div>
                <p className="text-[11px] text-blue-200">
                  Pilih atau seret file <span className="font-mono text-yellow-300">.json</span> cadangan (atau hasil simpan dari <span className="font-mono text-yellow-300">/api/state</span>) untuk memulihkan semua pekerjaan, arsip &amp; gambar.
                </p>
                <div className="mt-auto text-center py-1.5 px-2 rounded-lg bg-blue-900/80 hover:bg-blue-800 text-white font-bold text-xs">
                  Pilih File Cadangan...
                </div>
              </div>
            </div>

            {/* Sinkronisasi Manual */}
            <div className="pt-2 border-t border-blue-800 flex items-center justify-between gap-2">
              <span className="text-[11px] text-blue-200">
                Kirim salinan data &amp; gambar saat ini ke seluruh layar TV yang aktif.
              </span>
              <button
                type="button"
                onClick={() => {
                  if (onForceSaveServer) {
                    onForceSaveServer();
                    setSuccessMessage('Data & seluruh gambar berhasil disinkronkan!');
                  }
                }}
                className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-600 text-white font-bold py-1.5 px-3 rounded-lg text-xs transition-colors shadow-xs flex-shrink-0"
              >
                <Cloud className="w-3.5 h-3.5" />
                <span>Sinkronkan Sekarang</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
