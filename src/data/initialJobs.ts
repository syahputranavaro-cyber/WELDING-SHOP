import { JobItem } from '../types';
import { calculateJobTarget, formatToIndonesian } from '../utils/jobCalculations';

export const INITIAL_MOCK_JOBS: Omit<JobItem, 'progress_target'>[] = [
  {
    id: 1,
    deskripsi: 'Repair Tube Bundle 101C',
    area: 'PABRIK 2',
    start: '2026-08-19',
    finish: '2026-08-25',
    progress_actual: 34.00,
    status: 'AKTIF',
  },
  {
    id: 2,
    deskripsi: 'Pabrikasi Sand Loading Support',
    area: 'JPP',
    start: '2026-08-18',
    finish: '2026-08-25',
    progress_actual: 86.00,
    status: 'AKTIF',
  },
  {
    id: 3,
    deskripsi: 'Perbaikan Pipa Line N2',
    area: 'PABRIK 7',
    start: '2026-09-09',
    finish: '2026-09-15',
    progress_actual: 20.00,
    status: 'AKTIF',
  },
];

/**
 * Helper to compute jobs with target calculated based on reference date
 */
export function getInitialJobs(referenceDate = '2026-09-09'): JobItem[] {
  return INITIAL_MOCK_JOBS.map((job) => {
    const calc = calculateJobTarget(job.start, job.finish, referenceDate);
    return {
      ...job,
      // Format start and finish to Indonesian string for display: "19 Agustus 2026"
      start: formatToIndonesian(job.start),
      finish: formatToIndonesian(job.finish),
      progress_target: calc.targetProgressPct,
    };
  });
}

export const INITIAL_JOBS: JobItem[] = getInitialJobs('2026-09-09');

export const DEMO_EXTENDED_JOBS: JobItem[] = [
  ...INITIAL_JOBS,
  {
    id: 4,
    deskripsi: 'Pabrikasi Safety Cage For Ladder 2-S-101',
    area: 'PABRIK 3',
    start: '18 Agustus 2026',
    finish: '24 Agustus 2026',
    progress_target: 100.00,
    progress_actual: 37.00,
    status: 'AKTIF',
  },
  {
    id: 5,
    deskripsi: 'Penambahan Atap Compressor DP-18-K-101A',
    area: 'Pabrik 1A',
    start: '09 September 2026',
    finish: '16 September 2026',
    progress_target: 12.50,
    progress_actual: 15.00,
    status: 'AKTIF',
  },
  {
    id: 6,
    deskripsi: 'Supporting Job Scaffolding Support Kabel Tray Di Bawah Jembatan BSL-1',
    area: 'PABRIK 6',
    start: '05 September 2026',
    finish: '12 September 2026',
    progress_target: 62.50,
    progress_actual: 70.00,
    status: 'AKTIF',
  },
];
