import { JobItem } from '../types';

export const INITIAL_MOCK_JOBS: Omit<JobItem, 'progress_target'>[] = [];

/**
 * Daftar pekerjaan awal kosong (tidak memuat data contoh/dummy).
 */
export function getInitialJobs(_referenceDate?: string): JobItem[] {
  return [];
}

export const INITIAL_JOBS: JobItem[] = [];

export const DEMO_EXTENDED_JOBS: JobItem[] = [];
