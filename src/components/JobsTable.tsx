import React, { useState, useEffect } from 'react';
import { JobItem } from '../types';
import { JobRow } from './JobRow';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, Play, Pause, AlertCircle } from 'lucide-react';

interface JobsTableProps {
  jobs: JobItem[];
  autoCycle: boolean;
  onToggleAutoCycle: () => void;
  onEditJob?: (job: JobItem) => void;
  onDeleteJob?: (id: number) => void;
  onFinishJob?: (job: JobItem) => void;
  itemsPerPage?: number;
}

export const JobsTable: React.FC<JobsTableProps> = ({
  jobs,
  autoCycle,
  onToggleAutoCycle,
  onEditJob,
  onDeleteJob,
  onFinishJob,
  itemsPerPage = 7,
}) => {
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [countdown, setCountdown] = useState<number>(20);

  const totalPages = Math.max(1, Math.ceil(jobs.length / itemsPerPage));

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
  const currentJobs = jobs.slice(startIndex, startIndex + itemsPerPage);

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
      className="flex-1 min-w-0 min-h-0 flex flex-col justify-between h-full overflow-hidden p-2 bg-[#F8FAFC]"
    >
      {/* Table Sub-Header Bar */}
      <div className="w-full bg-[#032F73] text-white rounded-t-xl px-4 py-2 sm:py-2.5 relative flex items-center justify-between shadow-md select-none font-inter min-h-[44px] lg:min-h-[48px] flex-shrink-0">
        {/* Left info */}
        <div className="flex items-center gap-2 z-10">
          <span className="text-blue-100 text-xs sm:text-sm lg:text-base font-extrabold font-inter tabular-nums bg-blue-950/80 border border-blue-400/30 px-3 py-1 rounded-md shadow-xs">
            ({jobs.length} Pekerjaan)
          </span>
        </div>

        {/* Center: MONITORING AKTIVITAS WELDING SHOP */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-24">
          <span
            className="font-black text-sm sm:text-base lg:text-lg xl:text-[1.25rem] tracking-wider sm:tracking-widest uppercase font-inter text-center text-white drop-shadow-xs"
            style={{
              fontFamily: "'Inter', sans-serif",
              fontWeight: 900,
              letterSpacing: '0.04em',
            }}
          >
            MONITORING AKTIVITAS WELDING SHOP
          </span>
        </div>

        {/* Carousel controls if > 1 page */}
        <div className="flex items-center gap-2 z-10">
          {totalPages > 1 && (
            <>
              <div className="flex items-center gap-1.5 bg-blue-950/90 border border-blue-400/30 px-2.5 py-1 rounded text-xs font-inter tabular-nums">
                <span className="text-orange-300 font-bold">Rotasi: {autoCycle ? `${countdown}s` : 'Jeda'}</span>
              </div>

              <button
                onClick={handlePrev}
                className="p-1.5 rounded bg-blue-800 hover:bg-blue-700 text-white transition-colors"
                title="Halaman Sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs sm:text-sm font-bold text-white px-1.5 font-inter tabular-nums">
                {currentPage + 1}/{totalPages}
              </span>
              <button
                onClick={handleNext}
                className="p-1.5 rounded bg-blue-800 hover:bg-blue-700 text-white transition-colors"
                title="Halaman Selanjutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={onToggleAutoCycle}
                className="p-1.5 rounded bg-blue-800 hover:bg-blue-700 text-orange-300 transition-colors"
                title={autoCycle ? "Jeda Rotasi Otomatis" : "Jalankan Rotasi Otomatis"}
              >
                {autoCycle ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Jobs Cards List */}
      <div className="flex-1 min-h-0 w-full flex flex-col justify-start items-stretch py-2 overflow-y-auto overflow-x-hidden relative">
        {jobs.length === 0 ? (
          <div className="w-full flex-1 flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-slate-300 rounded-xl bg-white">
            <AlertCircle className="w-10 h-10 text-orange-500 mb-2" />
            <h4 className="text-slate-800 text-base font-bold">Tidak Ada Pekerjaan Aktif</h4>
            <p className="text-slate-500 text-xs mt-1">
              Silakan tambahkan pekerjaan baru atau muat data default.
            </p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPage}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="w-full"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-start',
                alignItems: 'stretch',
                gap: 'clamp(5px, 0.7vh, 8px)',
                height: 'auto',
              }}
            >
              {currentJobs.map((job, idx) => (
                <JobRow
                  key={job.id}
                  job={job}
                  index={startIndex + idx}
                  onEdit={onEditJob}
                  onDelete={onDeleteJob}
                  onFinish={onFinishJob}
                />
              ))}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* Footer Bar */}
      <div className="w-full bg-white border border-slate-200 rounded-b-lg px-3 py-1 flex items-center justify-end text-xs text-slate-700 select-none shadow-2xs font-inter flex-shrink-0 min-h-[26px] mt-auto">
        <div className="text-[11px] font-bold text-[#032F73] tracking-wide font-inter">
          PT PUPUK KALIMANTAN TIMUR • JASA PELAYANAN PABRIK (JPP)
        </div>
      </div>
    </div>
  );
};
