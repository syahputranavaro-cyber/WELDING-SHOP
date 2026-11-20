import React, { useState, useEffect, useMemo } from 'react';
import { JobItem, JobSortMode } from '../types';
import { JobRow } from './JobRow';
import { sortJobsByMode } from '../utils/jobCalculations';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  ClipboardList,
  ArrowUpDown,
} from 'lucide-react';

interface JobsTableProps {
  jobs: JobItem[];
  currentDateText: string;
  sortMode: JobSortMode;
  onChangeSortMode: (mode: JobSortMode) => void;
  autoCycle: boolean;
  onToggleAutoCycle: () => void;
  onEditJob?: (job: JobItem) => void;
  onDeleteJob?: (id: number) => void;
  onFinishJob?: (job: JobItem) => void;
  itemsPerPage?: number;
}

export const JobsTable: React.FC<JobsTableProps> = ({
  jobs,
  currentDateText,
  sortMode,
  onChangeSortMode,
  autoCycle,
  onToggleAutoCycle,
  onEditJob,
  onDeleteJob,
  onFinishJob,
  itemsPerPage = 7,
}) => {
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [countdown, setCountdown] = useState<number>(20);

  const sortedJobs = useMemo(
    () => sortJobsByMode(jobs, sortMode, currentDateText),
    [jobs, sortMode, currentDateText]
  );

  const totalPages = Math.max(1, Math.ceil(sortedJobs.length / itemsPerPage));

  useEffect(() => {
    if (currentPage >= totalPages) {
      setCurrentPage(0);
    }
  }, [totalPages, currentPage]);

  useEffect(() => {
    if (!autoCycle || totalPages <= 1) {
      setCountdown(20);
      return;
    }

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setCurrentPage((curr) => (curr + 1) % totalPages);
          return 20;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [autoCycle, totalPages, currentPage]);

  const startIndex = currentPage * itemsPerPage;
  const currentJobs = sortedJobs.slice(startIndex, startIndex + itemsPerPage);

  const handlePrev = () => {
    setCurrentPage((curr) => (curr > 0 ? curr - 1 : totalPages - 1));
    setCountdown(20);
  };

  const handleNext = () => {
    setCurrentPage((curr) => (curr + 1) % totalPages);
    setCountdown(20);
  };

  return (
    <div
      id="jobs-table-container"
      className="flex-1 min-w-0 min-h-0 flex flex-col justify-between h-full overflow-hidden p-2.5 pl-1.5 bg-transparent"
    >
      {/* Table Sub-Header Bar — Corporate Navy #032F73 */}
      <div className="w-full bg-[#032F73] text-white rounded-xl px-4 py-2 relative flex items-center justify-between shadow-[0_4px_14px_-4px_rgba(3,47,115,0.3)] ring-1 ring-inset ring-white/10 select-none min-h-[44px] lg:min-h-[46px] flex-shrink-0 gap-2">
        {/* Left: clean unboxed job count + sort selector */}
        <div className="flex items-center gap-3 z-10 min-w-0">
          <span className="text-blue-100/95 text-xs sm:text-[13px] font-semibold tabular-nums whitespace-nowrap">
            {sortedJobs.length} Pekerjaan
          </span>

          <div className="hidden sm:flex items-center gap-1.5 border-l border-white/15 pl-3">
            <ArrowUpDown className="w-3.5 h-3.5 text-[#EA7A2D] flex-shrink-0" />
            <label htmlFor="select-job-sort" className="sr-only">
              Urutkan Pekerjaan
            </label>
            <select
              id="select-job-sort"
              value={sortMode}
              onChange={(e) => {
                onChangeSortMode(e.target.value as JobSortMode);
                setCurrentPage(0);
              }}
              title="Urutkan daftar pekerjaan secara otomatis"
              className="bg-white/10 hover:bg-white/15 text-white text-xs font-semibold rounded-lg px-2 py-1 border border-white/15 focus:outline-none focus:ring-2 focus:ring-[#EA7A2D]/60 cursor-pointer transition-colors"
            >
              <option value="priority" className="text-slate-900">
                Prioritas (Delay Dulu)
              </option>
              <option value="deadline" className="text-slate-900">
                Deadline Terdekat
              </option>
              <option value="newest" className="text-slate-900">
                Urutan Input
              </option>
            </select>
          </div>
        </div>

        {/* Center: MONITORING AKTIVITAS WELDING SHOP */}
        <div className="hidden lg:flex absolute inset-0 items-center justify-center pointer-events-none px-56">
          <span className="font-extrabold text-sm lg:text-[1.08rem] tracking-[0.06em] uppercase text-center text-white truncate">
            Monitoring Aktivitas Welding Shop
          </span>
        </div>

        {/* Right: Carousel controls if > 1 page */}
        <div className="flex items-center gap-1.5 z-10">
          {totalPages > 1 && (
            <>
              <span className="text-xs font-medium text-blue-100/90 tabular-nums mr-1.5 whitespace-nowrap">
                Rotasi <strong className="text-[#EA7A2D] font-mono-data">{autoCycle ? `${countdown}s` : 'Jeda'}</strong>
              </span>

              <button
                onClick={handlePrev}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                title="Halaman Sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-semibold text-white px-1 font-mono-data tabular-nums">
                {currentPage + 1}/{totalPages}
              </span>
              <button
                onClick={handleNext}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                title="Halaman Selanjutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={onToggleAutoCycle}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-[#EA7A2D] transition-colors"
                title={autoCycle ? 'Jeda Rotasi Otomatis' : 'Jalankan Rotasi Otomatis'}
              >
                {autoCycle ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Jobs List */}
      <div className="flex-1 min-h-0 w-full flex flex-col justify-start items-stretch py-2 overflow-y-auto overflow-x-hidden relative">
        {sortedJobs.length === 0 ? (
          <div className="w-full flex-1 flex flex-col items-center justify-center text-center p-8 border border-slate-200/90 rounded-xl bg-white shadow-[0_1px_2px_rgba(3,47,115,0.04)]">
            <div className="w-12 h-12 rounded-xl bg-[#032F73]/8 text-[#032F73] flex items-center justify-center mb-3">
              <ClipboardList className="w-6 h-6" />
            </div>
            <h4 className="text-slate-900 text-base font-bold">Belum Ada Pekerjaan Aktif</h4>
            <p className="text-slate-500 text-xs mt-1 max-w-sm leading-relaxed">
              Tambahkan pekerjaan baru melalui tombol <span className="font-semibold text-[#EA7A2D]">Tambah Job</span> di atas atau impor file cadangan (.json / Excel).
            </p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={`${currentPage}-${sortMode}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="w-full flex flex-col justify-start items-stretch"
              style={{
                gap: 'clamp(6px, 0.8vh, 9px)',
              }}
            >
              {currentJobs.map((job, idx) => (
                <JobRow
                  key={job.id}
                  job={job}
                  index={startIndex + idx}
                  currentDateText={currentDateText}
                  onEdit={onEditJob}
                  onDelete={onDeleteJob}
                  onFinish={onFinishJob}
                />
              ))}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* Subtle Corporate Footer Strip */}
      <div className="w-full px-2 pt-1 pb-0.5 flex items-center justify-between text-[11px] text-slate-500 select-none flex-shrink-0 mt-auto">
        <span className="font-medium text-slate-400">
          Workshop &amp; Fabrication Monitoring
        </span>
        <span className="font-semibold text-[#032F73] tracking-wide">
          PT Pupuk Kalimantan Timur &middot; SBU Jasa Pelayanan Pabrik (JPP)
        </span>
      </div>
    </div>
  );
};
