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
  itemsPerPage = 5,
}) => {
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [countdown, setCountdown] = useState<number>(10);

  const totalPages = Math.max(1, Math.ceil(jobs.length / itemsPerPage));

  useEffect(() => {
    if (currentPage >= totalPages) {
      setCurrentPage(0);
    }
  }, [totalPages, currentPage]);

  useEffect(() => {
    if (!autoCycle || totalPages <= 1) {
      setCountdown(10);
      return;
    }

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setCurrentPage((curr) => (curr + 1) % totalPages);
          return 10;
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
    setCountdown(10);
  };

  const handleNext = () => {
    setCurrentPage((curr) => (curr + 1) % totalPages);
    setCountdown(10);
  };

  return (
    <div
      id="jobs-table-container"
      className="flex-1 flex flex-col justify-between h-full overflow-hidden p-2.5 bg-[#F8FAFC]"
    >
      {/* Table Sub-Header Bar */}
      <div className="w-full bg-[#032F73] text-white rounded-t-lg px-4 py-2 relative flex items-center justify-between shadow-xs select-none font-inter min-h-[38px]">
        {/* Left info */}
        <div className="flex items-center gap-2 z-10">
          <span className="text-blue-200 text-xs font-bold font-inter tabular-nums">
            ({jobs.length} Pekerjaan)
          </span>
        </div>

        {/* Center: MONITORING AKTIVITAS WELDING SHOP */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-20">
          <span
            className="font-black text-xs lg:text-sm tracking-wider uppercase font-inter text-center text-white"
            style={{
              fontFamily: "'Inter', sans-serif",
              fontWeight: 800,
              letterSpacing: '0.015em',
            }}
          >
            MONITORING AKTIVITAS WELDING SHOP
          </span>
        </div>

        {/* Carousel controls if > 1 page */}
        <div className="flex items-center gap-2 z-10">
          {totalPages > 1 && (
            <>
              <div className="flex items-center gap-1.5 bg-blue-950 px-2.5 py-0.5 rounded text-[11px] font-inter tabular-nums">
                <span className="text-orange-300 font-bold">Rotasi: {autoCycle ? `${countdown}s` : 'Jeda'}</span>
              </div>

              <button
                onClick={handlePrev}
                className="p-1 rounded bg-blue-800 hover:bg-blue-700 text-white transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs font-bold text-white px-1 font-inter tabular-nums">
                {currentPage + 1}/{totalPages}
              </span>
              <button
                onClick={handleNext}
                className="p-1 rounded bg-blue-800 hover:bg-blue-700 text-white transition-colors"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onToggleAutoCycle}
                className="p-1 rounded bg-blue-800 hover:bg-blue-700 text-orange-300 transition-colors"
              >
                {autoCycle ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Jobs Cards List */}
      <div className="flex-1 w-full flex flex-col justify-evenly py-2 gap-2 overflow-hidden relative">
        {jobs.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-slate-300 rounded-xl bg-white">
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
              className="flex-1 flex flex-col justify-evenly gap-2"
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
      <div className="w-full bg-white border border-slate-200 rounded-b-lg px-4 py-1.5 flex items-center justify-end text-xs text-slate-700 select-none shadow-xs font-inter">
        <div className="text-[11px] font-bold text-[#032F73] tracking-wide font-inter">
          PT PUPUK KALIMANTAN TIMUR • JASA PELAYANAN PABRIK (JPP)
        </div>
      </div>
    </div>
  );
};
