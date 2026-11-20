import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { ArchivedJobItem } from '../types';
import {
  X,
  Archive,
  CheckCircle2,
  Trash2,
  RotateCcw,
  Search,
  Download,
  Calendar,
  Clock,
  User,
  MapPin,
  AlertTriangle,
  FolderArchive,
  FileSpreadsheet,
} from 'lucide-react';

interface ArchiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  archiveFinish: ArchivedJobItem[];
  archiveDeleted: ArchivedJobItem[];
  onRestoreJob: (item: ArchivedJobItem) => void;
  onPermanentDeleteJob: (item: ArchivedJobItem) => void;
  onClearArchive?: (type: 'FINISH' | 'DELETED' | 'ALL') => void;
  initialTab?: 'finish' | 'deleted';
}

export const ArchiveModal: React.FC<ArchiveModalProps> = ({
  isOpen,
  onClose,
  archiveFinish = [],
  archiveDeleted = [],
  onRestoreJob,
  onPermanentDeleteJob,
  onClearArchive,
  initialTab = 'finish',
}) => {
  const [activeTab, setActiveTab] = useState<'finish' | 'deleted'>(initialTab);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [itemToDeletePermanently, setItemToDeletePermanently] = useState<ArchivedJobItem | null>(null);

  const activeList = useMemo(() => {
    return activeTab === 'finish' ? archiveFinish : archiveDeleted;
  }, [activeTab, archiveFinish, archiveDeleted]);

  const filteredList = useMemo(() => {
    if (!searchQuery.trim()) return activeList;
    const q = searchQuery.toLowerCase();
    return activeList.filter(
      (item) =>
        item.deskripsi.toLowerCase().includes(q) ||
        item.area.toLowerCase().includes(q) ||
        (item.pic && item.pic.toLowerCase().includes(q))
    );
  }, [activeList, searchQuery]);

  if (!isOpen) return null;

  // Format date helper for archive timestamp
  const formatArchiveDate = (isoOrText: string) => {
    try {
      const d = new Date(isoOrText);
      if (isNaN(d.getTime())) return isoOrText;
      return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoOrText;
    }
  };

  // Export Archive to Excel
  const handleExportArchiveExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Finish Jobs
      const finishRows = archiveFinish.map((item, idx) => ({
        No: idx + 1,
        'Deskripsi Pekerjaan': item.deskripsi,
        'Area / Pabrik': item.area,
        'PIC (Nama)': item.pic || '-',
        'Tanggal Mulai': item.start,
        'Tanggal Selesai': item.finish,
        'Target (%)': item.progress_target,
        'Actual (%)': item.progress_actual,
        Status: item.status,
        'Waktu Selesai (Arsip)': formatArchiveDate(item.archivedAt),
      }));
      const wsFinish = XLSX.utils.json_to_sheet(finishRows);
      XLSX.utils.book_append_sheet(wb, wsFinish, 'Pekerjaan Selesai (Finish)');

      // Sheet 2: Deleted Jobs
      const deletedRows = archiveDeleted.map((item, idx) => ({
        No: idx + 1,
        'Deskripsi Pekerjaan': item.deskripsi,
        'Area / Pabrik': item.area,
        'PIC (Nama)': item.pic || '-',
        'Tanggal Mulai': item.start,
        'Tanggal Selesai': item.finish,
        'Target Terakhir (%)': item.progress_target,
        'Actual Terakhir (%)': item.progress_actual,
        'Waktu Dihapus': formatArchiveDate(item.archivedAt),
        Alasan: item.deleteReason || 'Dihapus dari dashboard',
      }));
      const wsDeleted = XLSX.utils.json_to_sheet(deletedRows);
      XLSX.utils.book_append_sheet(wb, wsDeleted, 'Pekerjaan Dihapus');

      const fileName = `arsip-welding-shop-${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (e) {
      console.error('Gagal mengekspor arsip:', e);
    }
  };

  return (
    <div
      id="archive-data-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-3 sm:p-5 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="archive-data-modal-container"
        className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl border-2 border-slate-200 overflow-hidden flex flex-col max-h-[92vh] h-[88vh]"
      >
        {/* Header Modal */}
        <div className="bg-[#032F73] text-white px-6 py-4 flex items-center justify-between border-b-2 border-blue-900 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md flex-shrink-0">
              <FolderArchive className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black tracking-wide font-inter">
                Arsip Data Pekerjaan
              </h2>
              <p className="text-xs text-blue-200 font-medium">
                Penyimpanan riwayat pekerjaan yang dipisahkan antara <strong>Selesai (Finish)</strong> dan <strong>Dihapus</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportArchiveExcel}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-xs transition-colors"
              title="Unduh Riwayat Arsip ke File Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Ekspor Excel</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
              title="Tutup Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Selection Bar: Selesai vs Dihapus */}
        <div className="flex items-center justify-between px-6 pt-3 pb-2 bg-slate-50 border-b border-slate-200 flex-shrink-0 gap-4 flex-wrap">
          {/* Dua Tab Utama yang Dipisahkan Jelas */}
          <div className="flex items-center gap-2 bg-slate-200/80 p-1 rounded-xl">
            <button
              type="button"
              id="tab-archive-finish"
              onClick={() => setActiveTab('finish')}
              className={`flex items-center gap-2 py-2 px-4 rounded-lg text-xs sm:text-sm font-black transition-all ${
                activeTab === 'finish'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Pekerjaan Selesai (Finish)</span>
              <span
                className={`ml-1 px-2 py-0.5 rounded-full text-xs font-black tabular-nums ${
                  activeTab === 'finish' ? 'bg-white/25 text-white' : 'bg-slate-300 text-slate-700'
                }`}
              >
                {archiveFinish.length}
              </span>
            </button>

            <button
              type="button"
              id="tab-archive-deleted"
              onClick={() => setActiveTab('deleted')}
              className={`flex items-center gap-2 py-2 px-4 rounded-lg text-xs sm:text-sm font-black transition-all ${
                activeTab === 'deleted'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Trash2 className="w-4 h-4" />
              <span>Pekerjaan Dihapus</span>
              <span
                className={`ml-1 px-2 py-0.5 rounded-full text-xs font-black tabular-nums ${
                  activeTab === 'deleted' ? 'bg-white/25 text-white' : 'bg-slate-300 text-slate-700'
                }`}
              >
                {archiveDeleted.length}
              </span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative min-w-[200px] sm:min-w-[260px] flex-1 sm:flex-initial">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari deskripsi, area, atau PIC..."
              className="w-full text-xs font-bold pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#032F73]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Content Table Area */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 bg-[#F8FAFC]">
          {filteredList.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-slate-300 rounded-2xl bg-white">
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 shadow-inner ${
                  activeTab === 'finish' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                }`}
              >
                {activeTab === 'finish' ? <CheckCircle2 className="w-7 h-7" /> : <Archive className="w-7 h-7" />}
              </div>
              <h3 className="text-base font-black text-slate-800 mb-1">
                {searchQuery
                  ? 'Tidak ada data arsip yang cocok'
                  : activeTab === 'finish'
                  ? 'Belum Ada Pekerjaan Selesai (Finish)'
                  : 'Belum Ada Pekerjaan yang Dihapus'}
              </h3>
              <p className="text-xs text-slate-500 max-w-md">
                {activeTab === 'finish'
                  ? 'Ketika Anda menandai pekerjaan FINISH di dashboard utama, data otomatis tersimpan rapi di sini dan tidak hilang.'
                  : 'Ketika pekerjaan dihapus dari dashboard, data dipindahkan ke tab ini sebagai cadangan keamanan.'}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#032F73] text-white text-[11px] sm:text-xs font-black uppercase tracking-wider">
                    <th className="py-2.5 px-3 w-12 text-center">No</th>
                    <th className="py-2.5 px-3">Deskripsi Pekerjaan</th>
                    <th className="py-2.5 px-3">Area & PIC</th>
                    <th className="py-2.5 px-3">Periode</th>
                    <th className="py-2.5 px-3 text-center">Progress</th>
                    <th className="py-2.5 px-3">
                      {activeTab === 'finish' ? 'Waktu Selesai' : 'Waktu Dihapus'}
                    </th>
                    <th className="py-2.5 px-3 text-center w-36">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs font-semibold text-slate-800">
                  {filteredList.map((item, idx) => (
                    <tr key={`${item.id}-${idx}`} className="hover:bg-blue-50/50 transition-colors">
                      <td className="py-3 px-3 text-center font-black text-slate-500 tabular-nums">
                        {idx + 1}
                      </td>

                      {/* Deskripsi */}
                      <td className="py-3 px-3 min-w-[200px] max-w-[280px]">
                        <p className="font-bold text-slate-900 leading-snug line-clamp-2">
                          {item.deskripsi}
                        </p>
                      </td>

                      {/* Area & PIC */}
                      <td className="py-3 px-3 min-w-[120px]">
                        <span className="inline-block px-2 py-0.5 rounded bg-blue-100 text-[#032F73] text-[11px] font-black uppercase mb-1">
                          {item.area}
                        </span>
                        <div className="flex items-center gap-1 text-[11px] text-slate-600 font-medium">
                          <User className="w-3 h-3 text-slate-400" />
                          <span>{item.pic || '-'}</span>
                        </div>
                      </td>

                      {/* Periode */}
                      <td className="py-3 px-3 min-w-[130px] text-[11px] text-slate-600">
                        <div>Mulai: {item.start}</div>
                        <div>Selesai: {item.finish}</div>
                      </td>

                      {/* Progress */}
                      <td className="py-3 px-3 text-center min-w-[90px]">
                        <span
                          className={`inline-block px-2 py-1 rounded-md text-[11px] font-black tabular-nums ${
                            activeTab === 'finish'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-slate-100 text-slate-800 border border-slate-300'
                          }`}
                        >
                          Actual: {item.progress_actual.toFixed(1)}%
                        </span>
                      </td>

                      {/* Waktu Arsip */}
                      <td className="py-3 px-3 min-w-[130px] text-[11px] text-slate-500">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{formatArchiveDate(item.archivedAt)}</span>
                        </div>
                        {item.deleteReason && (
                          <span className="text-[10px] text-rose-500 italic block mt-0.5">
                            {item.deleteReason}
                          </span>
                        )}
                      </td>

                      {/* Aksi */}
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onRestoreJob(item)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#032F73] hover:bg-blue-900 active:scale-95 text-white text-xs font-black shadow-2xs transition-all whitespace-nowrap"
                            title="Pulihkan pekerjaan ini kembali ke Dashboard Aktif"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Pulihkan</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setItemToDeletePermanently(item)}
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 transition-colors"
                            title="Hapus Permanen dari Arsip"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer Modal */}
        <div className="px-6 py-3 bg-slate-100 border-t border-slate-200 flex items-center justify-end flex-shrink-0 text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="py-1.5 px-4 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-200 font-bold"
            >
              Tutup
            </button>
          </div>
        </div>

        {/* Modal Konfirmasi Hapus Permanen */}
        {itemToDeletePermanently && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl border-2 border-rose-300">
              <div className="flex items-center gap-2.5 text-rose-600 mb-2">
                <AlertTriangle className="w-6 h-6" />
                <h4 className="font-black text-base">Hapus Permanen?</h4>
              </div>
              <p className="text-xs text-slate-600 mb-4">
                Pekerjaan <strong>"{itemToDeletePermanently.deskripsi}"</strong> akan dihapus permanen dari arsip dan tidak dapat dipulihkan kembali.
              </p>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setItemToDeletePermanently(null)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onPermanentDeleteJob(itemToDeletePermanently);
                    setItemToDeletePermanently(null);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-xs"
                >
                  Ya, Hapus Permanen
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
