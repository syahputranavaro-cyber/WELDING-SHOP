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
  Calendar,
  User,
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
  isReadOnly?: boolean;
}

export const ArchiveModal: React.FC<ArchiveModalProps> = ({
  isOpen,
  onClose,
  archiveFinish = [],
  archiveDeleted = [],
  onRestoreJob,
  onPermanentDeleteJob,
  initialTab = 'finish',
  isReadOnly = false,
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

  const handleExportArchiveExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-3 sm:p-5 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="archive-data-modal-container"
        className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col max-h-[92vh] h-[88vh]"
      >
        {/* Header Modal */}
        <div className="bg-[#032F73] text-white px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 text-[#EA7A2D] flex items-center justify-center flex-shrink-0">
              <FolderArchive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight">
                Arsip Data Pekerjaan
              </h2>
              <p className="text-xs text-blue-200/90 font-normal">
                Riwayat pekerjaan yang telah selesai (Finish) dan yang dihapus dari dashboard
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportArchiveExcel}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors"
              title="Unduh Riwayat Arsip ke File Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Ekspor Excel</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="Tutup Modal"
              aria-label="Tutup modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Selection Bar & Search */}
        <div className="flex items-center justify-between px-6 py-3 bg-[#F8FAFC] border-b border-slate-200/80 flex-shrink-0 gap-4 flex-wrap">
          <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-xl">
            <button
              type="button"
              id="tab-archive-finish"
              onClick={() => setActiveTab('finish')}
              className={`flex items-center gap-2 py-1.5 px-3.5 rounded-lg text-xs sm:text-[13px] font-semibold transition-all whitespace-nowrap ${
                activeTab === 'finish'
                  ? 'bg-white text-[#032F73] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CheckCircle2 className={`w-4 h-4 ${activeTab === 'finish' ? 'text-emerald-600' : 'text-slate-400'}`} />
              <span>Selesai (Finish)</span>
              <span className="font-mono-data text-xs text-slate-400 tabular-nums">
                ({archiveFinish.length})
              </span>
            </button>

            <button
              type="button"
              id="tab-archive-deleted"
              onClick={() => setActiveTab('deleted')}
              className={`flex items-center gap-2 py-1.5 px-3.5 rounded-lg text-xs sm:text-[13px] font-semibold transition-all whitespace-nowrap ${
                activeTab === 'deleted'
                  ? 'bg-white text-[#032F73] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Trash2 className={`w-4 h-4 ${activeTab === 'deleted' ? 'text-rose-600' : 'text-slate-400'}`} />
              <span>Dihapus</span>
              <span className="font-mono-data text-xs text-slate-400 tabular-nums">
                ({archiveDeleted.length})
              </span>
            </button>
          </div>

          <div className="relative min-w-[200px] sm:min-w-[260px] flex-1 sm:flex-initial">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari deskripsi, area, atau PIC..."
              className="w-full text-xs font-medium pl-9 pr-7 py-2 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-[#032F73] focus:ring-2 focus:ring-[#032F73]/15 transition-all"
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
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 bg-[#EFF3F8]">
          {filteredList.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 border border-slate-200/90 rounded-xl bg-white">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${
                  activeTab === 'finish' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                }`}
              >
                {activeTab === 'finish' ? <CheckCircle2 className="w-6 h-6" /> : <Archive className="w-6 h-6" />}
              </div>
              <h3 className="text-sm font-bold text-slate-800 mb-1">
                {searchQuery
                  ? 'Tidak ada data arsip yang cocok'
                  : activeTab === 'finish'
                  ? 'Belum Ada Pekerjaan Selesai'
                  : 'Belum Ada Pekerjaan yang Dihapus'}
              </h3>
              <p className="text-xs text-slate-500 max-w-md leading-relaxed">
                {activeTab === 'finish'
                  ? 'Pekerjaan yang ditandai Finish di dashboard utama otomatis tersimpan rapi di sini.'
                  : 'Pekerjaan yang dihapus dari dashboard dipindahkan ke tab ini sebagai cadangan keamanan.'}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#032F73] text-white text-[11px] font-semibold uppercase tracking-wider">
                    <th className="py-2.5 px-3 w-12 text-center">No</th>
                    <th className="py-2.5 px-3">Deskripsi Pekerjaan</th>
                    <th className="py-2.5 px-3">Area &amp; PIC</th>
                    <th className="py-2.5 px-3">Periode</th>
                    <th className="py-2.5 px-3 text-right">Actual</th>
                    <th className="py-2.5 px-3">
                      {activeTab === 'finish' ? 'Waktu Selesai' : 'Waktu Dihapus'}
                    </th>
                    {!isReadOnly && <th className="py-2.5 px-3 text-center w-36">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {filteredList.map((item, idx) => (
                    <tr key={`${item.id}-${idx}`} className="hover:bg-[#F8FAFC] transition-colors">
                      <td className="py-3 px-3 text-center font-mono-data font-semibold text-slate-400 tabular-nums">
                        {idx + 1}
                      </td>

                      <td className="py-3 px-3 min-w-[200px] max-w-[280px]">
                        <p className="font-semibold text-slate-900 leading-snug line-clamp-2">
                          {item.deskripsi}
                        </p>
                      </td>

                      <td className="py-3 px-3 min-w-[120px]">
                        <div className="text-xs font-bold text-[#032F73] uppercase tracking-wide">
                          {item.area}
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5">
                          <User className="w-3 h-3 text-slate-400" />
                          <span>{item.pic || '-'}</span>
                        </div>
                      </td>

                      <td className="py-3 px-3 min-w-[140px] text-[11px] text-slate-600 tabular-nums">
                        <div>{item.start}</div>
                        <div className="text-slate-400">s/d {item.finish}</div>
                      </td>

                      <td className="py-3 px-3 text-right min-w-[80px] font-mono-data font-bold tabular-nums">
                        <span className={activeTab === 'finish' ? 'text-emerald-700' : 'text-slate-700'}>
                          {item.progress_actual.toFixed(1)}%
                        </span>
                      </td>

                      <td className="py-3 px-3 min-w-[140px] text-[11px] text-slate-500 tabular-nums">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400 flex-shrink-0" />
                          <span>{formatArchiveDate(item.archivedAt)}</span>
                        </div>
                        {item.deleteReason && (
                          <span className="text-[10.5px] text-rose-500 block mt-0.5">
                            {item.deleteReason}
                          </span>
                        )}
                      </td>

                      {!isReadOnly && (
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onRestoreJob(item)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#032F73] hover:bg-[#022154] text-white text-xs font-semibold transition-colors whitespace-nowrap"
                              title="Pulihkan pekerjaan ini kembali ke Dashboard Aktif"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Pulihkan</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setItemToDeletePermanently(item)}
                              className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white transition-colors"
                              title="Hapus Permanen dari Arsip"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer Modal */}
        <div className="px-6 py-3 bg-white border-t border-slate-200/80 flex items-center justify-end flex-shrink-0 text-xs">
          <button
            type="button"
            onClick={onClose}
            className="py-2 px-4 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold transition-colors"
          >
            Tutup
          </button>
        </div>

        {/* Modal Konfirmasi Hapus Permanen */}
        {itemToDeletePermanently && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/60 p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl border border-slate-200">
              <div className="flex items-center gap-2.5 text-rose-600 mb-2">
                <AlertTriangle className="w-5 h-5" />
                <h4 className="font-bold text-base text-slate-900">Hapus Permanen?</h4>
              </div>
              <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                Pekerjaan <strong className="text-slate-900">&ldquo;{itemToDeletePermanently.deskripsi}&rdquo;</strong> akan dihapus permanen dari arsip dan tidak dapat dipulihkan kembali.
              </p>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setItemToDeletePermanently(null)}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onPermanentDeleteJob(itemToDeletePermanently);
                    setItemToDeletePermanently(null);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors"
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
