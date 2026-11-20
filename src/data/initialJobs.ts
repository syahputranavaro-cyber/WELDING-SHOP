import { JobItem } from '../types';
import { calculateJobTarget, formatToIndonesian } from '../utils/jobCalculations';

export const INITIAL_MOCK_JOBS: Omit<JobItem, 'progress_target'>[] = [
  {
    id: 1,
    deskripsi: 'Pabrikasi Frame Carry Roller D2822-V Qty 13 Set',
    area: 'PABRIK 6 BB 1',
    pic: 'Sadrak AT',
    start: '2026-09-15',
    finish: '2026-09-27',
    progress_actual: 0.0,
    status: 'AKTIF',
  },
  {
    id: 2,
    deskripsi: 'Pabrikasi Frame Carry Roller D2880-V Qty 25 Set',
    area: 'PABRIK 6 BB 1',
    pic: 'Agus Adi & ...',
    start: '2026-09-15',
    finish: '2026-09-27',
    progress_actual: 0.0,
    status: 'AKTIF',
  },
  {
    id: 3,
    deskripsi: 'Roll dan Pabrikasi Pipa 16" Karbon D1-TS-402',
    area: 'PABRIK 3',
    pic: 'Eka',
    start: '2026-09-15',
    finish: '2026-09-24',
    progress_actual: 0.0,
    status: 'AKTIF',
  },
  {
    id: 4,
    deskripsi: 'Roll & Pabrikasi Pipe 24" Karbon D1-TS-402',
    area: 'PABRIK 3',
    pic: 'Amirullah',
    start: '2026-09-15',
    finish: '2026-09-25',
    progress_actual: 8.0,
    status: 'AKTIF',
  },
  {
    id: 5,
    deskripsi: 'Cutting Chain Link Bucket Elevator DL-1103',
    area: 'PABRIK 7',
    pic: 'Laser Cutting',
    start: '2026-09-14',
    finish: '2026-09-16',
    progress_actual: 8.0,
    status: 'AKTIF',
  },
  {
    id: 6,
    deskripsi: 'Rebabbit Ring Halft Trust 103-JT QTY 1 EA',
    area: 'PP&P',
    pic: 'Abdul R wld',
    start: '2026-09-14',
    finish: '2026-09-15',
    progress_actual: 50.0,
    status: 'AKTIF',
  },
  {
    id: 7,
    deskripsi: 'Supporting Job Perbantuan PPE QTY 4 Orang',
    area: 'PABRIK 3',
    pic: 'Muliadi CS',
    start: '2026-09-12',
    finish: '2026-10-02',
    progress_actual: 14.0,
    status: 'AKTIF',
  },
  {
    id: 8,
    deskripsi: 'Repair Support Bak Blank Tank PPE',
    area: 'PABRIK 2',
    pic: 'Irwan Musrad',
    start: '2026-09-11',
    finish: '2026-09-16',
    progress_actual: 85.0,
    status: 'AKTIF',
  },
  {
    id: 9,
    deskripsi: 'Pabrikasi Evacuation Ladder Steam Drum & Secondary Reformer Ammonia 1-R-102',
    area: 'PABRIK 3',
    pic: 'Purwono',
    start: '2026-09-03',
    finish: '2026-09-16',
    progress_actual: 100.0,
    status: 'AKTIF',
  },
  {
    id: 10,
    deskripsi: 'Supporting Job Perbantuan Operasi ALL Area Ammonia QTY 10 Orang',
    area: 'PABRIK 3',
    pic: 'Basir CS',
    start: '2026-09-09',
    finish: '2026-09-29',
    progress_actual: 28.5,
    status: 'AKTIF',
  },
];

/**
 * Helper to compute jobs with target calculated based on reference date
 */
export function getInitialJobs(referenceDate = '2026-09-16'): JobItem[] {
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

export const INITIAL_JOBS: JobItem[] = getInitialJobs('2026-09-16');

export const DEMO_EXTENDED_JOBS: JobItem[] = INITIAL_JOBS;
