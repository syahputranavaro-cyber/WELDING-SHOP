import React, { useState, useRef } from 'react';
import { JobItem, BrandingImages, SyncStatusType } from '../types';
import { normalizeWorkStatus } from '../utils/jobCalculations';
import {
  X,
  Upload,
  Download,
  FileSpreadsheet,
  Check,
  AlertCircle,
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

  const processExcelFile = (file: File) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const XLSX = await import('xlsx');
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);

        if (!jsonData || jsonData.length === 0) {
          setErrorMessage('File Excel kosong atau tidak memiliki data yang valid.');
          return;
        }

        const usedIds = new Set<number>();
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

          const rawStatus = String(normalized['status'] || '').trim().toUpperCase();
          let status: 'I/P' | 'HOLD' | 'SELESAI' = 'I/P';
          if (rawStatus.includes('HOLD') || rawStatus.includes('TERTUNDA') || rawStatus.includes('TUNDA')) {
            status = 'HOLD';
          } else if (rawStatus.includes('SELESAI') || rawStatus.includes('DONE') || rawStatus.includes('COMPLETE')) {
            status = 'SELESAI';
          }

          const parsedActual = parsePct(rawActual);
          if (parsedActual >= 100 && status !== 'HOLD') {
            status = 'SELESAI';
          }

          let resolvedId = Number(normalized['no'] || normalized['id']);
          if (!Number.isFinite(resolvedId) || resolvedId <= 0 || usedIds.has(resolvedId)) {
            resolvedId = Date.now() + idx;
          }
          usedIds.add(resolvedId);

          return {
            id: resolvedId,
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

  const handleExportExcel = async () => {
    try {
      const XLSX = await import('xlsx');
      const exportData = currentJobs.map((j, idx) => ({
        NO: idx + 1,
        'DESKRIPSI PEKERJAAN': j.deskripsi,
        AREA: j.area,
        'PIC (NAMA)': j.pic || '-',
        START: j.start,
        FINISH: j.finish,
        'TARGET SCHEDULE (%)': j.progress_target,
        'PROGRESS ACTUAL (%)': j.progress_actual,
        STATUS: j.status?.toUpperCase() === 'SELESAI' ? 'SELESAI' : normalizeWorkStatus(j.status),
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
    >
      <div
        id="excel-modal-container"
        className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col"
      >
        {/* Header — Unified Corporate Navy */}
        <div className="bg-[#032F73] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 text-[#EA7A2D] flex items-center justify-center flex-shrink-0">
              {activeTab === 'excel' ? (
                <FileSpreadsheet className="w-5 h-5" />
              ) : (
                <FileJson className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight">
                {activeTab === 'excel' ? 'Kelola Data Excel' : 'Cadangan & Sinkronisasi Data'}
              </h2>
              <p className="text-xs text-blue-200/90 font-normal">
                {activeTab === 'excel'
                  ? 'Impor atau ekspor spreadsheet DASHBOARD WS.xlsx'
                  : 'Unduh cadangan lengkap atau pulihkan data lintas perangkat'}
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

        {/* Segmented Tab Bar */}
        <div className="px-6 py-3 bg-[#F8FAFC] border-b border-slate-200/80">
          <div className="inline-flex items-center gap-1 bg-slate-200/70 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('backup')}
              className={`flex items-center gap-1.5 py-1.5 px-3.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'backup'
                  ? 'bg-white text-[#032F73] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileJson className="w-3.5 h-3.5" />
              <span>Cadangan Lengkap (.json)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('excel')}
              className={`flex items-center gap-1.5 py-1.5 px-3.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'excel'
                  ? 'bg-white text-[#032F73] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Excel (.xlsx)</span>
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-6 flex flex-col gap-4">
          {errorMessage && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500" />
              <span>{errorMessage}</span>
            </div>
          )}
          {successMessage && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-medium">
              <Check className="w-4 h-4 flex-shrink-0 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* TAB 1: EXCEL */}
          {activeTab === 'excel' && (
            <>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center flex flex-col items-center justify-center cursor-pointer transition-colors ${
                  dragOver
                    ? 'border-[#032F73] bg-blue-50/60'
                    : 'border-slate-300 bg-[#F8FAFC] hover:border-[#032F73] hover:bg-blue-50/30'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".xlsx, .xls"
                  className="hidden"
                />
                <div className="w-11 h-11 rounded-xl bg-[#032F73]/8 text-[#032F73] flex items-center justify-center mb-2.5">
                  <Upload className="w-5 h-5" />
                </div>
                <p className="text-sm font-bold text-slate-800">
                  Tarik &amp; lepaskan file <span className="text-[#032F73] font-mono-data">DASHBOARD WS.xlsx</span> ke sini
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  atau klik untuk memilih file dari komputer &middot; Mendukung .xlsx &amp; .xls
                </p>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <button
                  onClick={handleExportExcel}
                  className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-4 rounded-xl text-xs transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Ekspor DASHBOARD WS.xlsx</span>
                </button>
              </div>
            </>
          )}

          {/* TAB 2: BACKUP LENGKAP */}
          {activeTab === 'backup' && (
            <div className="flex flex-col gap-4">
              <div className="p-3.5 rounded-xl bg-[#F4F7FB] border border-[#032F73]/15 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-[#032F73] flex-shrink-0 mt-0.5" />
                <div className="text-xs">
                  <div className="font-bold text-[#032F73]">
                    Sinkronisasi Lintas Perangkat &amp; Cadangan Portabel
                  </div>
                  <p className="text-slate-600 mt-1 leading-relaxed">
                    Data pekerjaan, arsip, logo perusahaan, logo Welding Shop, dan poster K3 tersimpan otomatis. Unduh file cadangan kapan saja atau pulihkan dari file sebelumnya.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Unduh Cadangan JSON */}
                <div className="p-4 rounded-xl bg-white border border-slate-200/90 flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-[#032F73] font-bold text-xs">
                    <FileJson className="w-4 h-4 text-[#EA7A2D]" />
                    <span>Unduh File Cadangan (.json)</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Menyimpan seluruh pekerjaan, arsip selesai/dihapus, serta logo &amp; poster ke dalam 1 file cadangan portabel.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (onExportBackupJson) {
                        onExportBackupJson();
                        setSuccessMessage('File cadangan lengkap (.json) berhasil diunduh!');
                      }
                    }}
                    className="mt-auto flex items-center justify-center gap-2 bg-[#EA7A2D] hover:bg-[#D96B1F] text-white font-semibold py-2 px-3 rounded-lg text-xs transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span>Unduh Cadangan</span>
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
                  className={`p-4 rounded-xl border-2 border-dashed flex flex-col gap-2 cursor-pointer transition-colors ${
                    dragOver
                      ? 'border-[#032F73] bg-blue-50/50'
                      : 'border-slate-300 bg-[#F8FAFC] hover:border-[#032F73]'
                  }`}
                >
                  <input
                    type="file"
                    ref={jsonFileInputRef}
                    onChange={handleJsonFileChange}
                    accept=".json"
                    className="hidden"
                  />
                  <div className="flex items-center gap-2 text-[#032F73] font-bold text-xs">
                    <Upload className="w-4 h-4 text-[#032F73]" />
                    <span>Pulihkan dari File (.json)</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Pilih atau seret file <span className="font-mono-data text-[#032F73]">.json</span> cadangan untuk memulihkan pekerjaan, arsip &amp; gambar.
                  </p>
                  <div className="mt-auto text-center py-2 px-2 rounded-lg bg-[#032F73] hover:bg-[#022154] text-white font-semibold text-xs transition-colors">
                    Pilih File Cadangan
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                <span className="text-[11px] text-slate-500">
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
                  className="flex items-center gap-1.5 bg-[#032F73] hover:bg-[#022154] text-white font-semibold py-2 px-3.5 rounded-lg text-xs transition-colors flex-shrink-0"
                >
                  <Cloud className="w-3.5 h-3.5" />
                  <span>Sinkronkan</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
