/**
 * Kalkulasi otomatis untuk Dashboard Welding Shop sesuai spesifikasi:
 * 1. Total Hari = (Tanggal Finish - Tanggal Start) + 1 hari
 * 2. Target Schedule per Hari (%) = 100% / Total Hari
 * 3. Akumulasi Progress Target Berjalan (%):
 *    - Jika Tanggal Hari Ini < Tanggal Start -> 0.00%
 *    - Jika Tanggal Hari Ini > Tanggal Finish -> 100.00%
 *    - Jika berada di antara Start dan Finish:
 *      Hari Berjalan = (Tanggal Hari Ini - Tanggal Start) + 1 hari
 *      Progress Target (%) = (Hari Berjalan / Total Hari) * 100%
 */

const MONTH_MAP: Record<string, number> = {
  januari: 0, jan: 0,
  februari: 1, feb: 1,
  maret: 2, mar: 2,
  april: 3, apr: 3,
  mei: 4, may: 4,
  juni: 5, jun: 5,
  juli: 6, jul: 6,
  agustus: 7, agu: 7, ags: 7, aug: 7,
  september: 8, sep: 8,
  oktober: 9, okt: 9, oct: 9,
  november: 10, nov: 10,
  desember: 11, des: 11, dec: 11,
};

const INDO_MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

/**
 * Parsing tanggal dari string berbagai format (YYYY-MM-DD, DD Month YYYY, dll)
 * Mengembalikan objek Date dengan UTC midnight untuk kalkulasi hari akurat.
 */
export function parseDate(dateInput: string | Date | null | undefined): Date | null {
  if (!dateInput) return null;
  if (dateInput instanceof Date) {
    if (isNaN(dateInput.getTime())) return null;
    return new Date(Date.UTC(dateInput.getFullYear(), dateInput.getMonth(), dateInput.getDate()));
  }

  const trimmed = dateInput.trim();
  if (!trimmed) return null;

  // Format ISO: YYYY-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    return new Date(Date.UTC(year, month, day));
  }

  // Format Indo / English: "19 Agustus 2026" or "19-08-2026" or "19/08/2026"
  const dmyNumericMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyNumericMatch) {
    const day = parseInt(dmyNumericMatch[1], 10);
    const month = parseInt(dmyNumericMatch[2], 10) - 1;
    const year = parseInt(dmyNumericMatch[3], 10);
    return new Date(Date.UTC(year, month, day));
  }

  // Format Text: "19 Agustus 2026" or "9 Sep 2026"
  const textMatch = trimmed.match(/^(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})/);
  if (textMatch) {
    const day = parseInt(textMatch[1], 10);
    const monthKey = textMatch[2].toLowerCase();
    const year = parseInt(textMatch[3], 10);
    const month = MONTH_MAP[monthKey];
    if (month !== undefined) {
      return new Date(Date.UTC(year, month, day));
    }
  }

  // Fallback native Date
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()));
  }

  return null;
}

/**
 * Format tanggal ke format ISO (YYYY-MM-DD) untuk input type="date"
 */
export function formatToISO(dateInput: string | Date | null | undefined): string {
  const d = parseDate(dateInput);
  if (!d) {
    // Default to current date in ISO
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Format tanggal ke Bahasa Indonesia (contoh: "19 Agustus 2026")
 */
export function formatToIndonesian(dateInput: string | Date | null | undefined): string {
  const d = parseDate(dateInput);
  if (!d) return String(dateInput || '');
  const day = d.getUTCDate();
  const month = INDO_MONTHS[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  return `${day} ${month} ${year}`;
}

/**
 * Mengambil tanggal saat ini secara otomatis dari sistem komputer
 * dan memformatnya ke Bahasa Indonesia (contoh: "11 September 2026").
 * Menggunakan toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
 */
export function getSystemDateFormatted(dateInput?: Date): string {
  const date = dateInput || new Date();
  try {
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return formatToIndonesian(date);
  }
}

/**
 * Menghitung selisih hari kalender (end - start)
 */
export function diffInDays(start: Date, end: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((end.getTime() - start.getTime()) / msPerDay);
}

/**
 * Menghitung total hari durasi pekerjaan: (finish - start) + 1 hari
 */
export function getJobTotalDays(startInput: string | Date, finishInput: string | Date): number {
  const startDate = parseDate(startInput);
  const finishDate = parseDate(finishInput);
  if (!startDate || !finishDate) return 1;
  const rawDiff = diffInDays(startDate, finishDate);
  return Math.max(1, rawDiff + 1);
}

export interface JobCalculationResult {
  totalDays: number;            // Total hari durasi = (finish - start) + 1
  dailyTargetPct: number;       // Target harian = 100 / totalDays
  daysElapsed: number;          // Hari berjalan dari start s/d referensi
  targetProgressPct: number;    // Akumulasi target schedule berjalan (%)
  isBeforeStart: boolean;
  isAfterFinish: boolean;
  isOngoing: boolean;
}

/**
 * Fungsi kalkulasi otomatis sesuai spesifikasi Section 2:
 */
export function calculateJobTarget(
  startInput: string | Date,
  finishInput: string | Date,
  referenceInput: string | Date
): JobCalculationResult {
  const startDate = parseDate(startInput);
  const finishDate = parseDate(finishInput);
  const refDate = parseDate(referenceInput);

  if (!startDate || !finishDate || !refDate) {
    return {
      totalDays: 1,
      dailyTargetPct: 100,
      daysElapsed: 0,
      targetProgressPct: 0,
      isBeforeStart: false,
      isAfterFinish: false,
      isOngoing: false,
    };
  }

  // 1. Durasi Target (Hari): (Finish - Start) + 1 hari
  const rawDiff = diffInDays(startDate, finishDate);
  const totalDays = Math.max(1, rawDiff + 1);

  // 2. Target Schedule per Hari (%): 100% / Total Hari
  const dailyTargetPct = Number((100 / totalDays).toFixed(4));

  // 3. Akumulasi Progress Target Berjalan (%)
  const refTime = refDate.getTime();
  const startTime = startDate.getTime();
  const finishTime = finishDate.getTime();

  let targetProgressPct = 0;
  let daysElapsed = 0;
  let isBeforeStart = false;
  let isAfterFinish = false;
  let isOngoing = false;

  if (refTime < startTime) {
    // Tanggal Hari Ini < Tanggal Start -> 0.00%
    targetProgressPct = 0.0;
    daysElapsed = 0;
    isBeforeStart = true;
  } else if (refTime > finishTime) {
    // Tanggal Hari Ini > Tanggal Finish -> 100.00%
    targetProgressPct = 100.0;
    daysElapsed = totalDays;
    isAfterFinish = true;
  } else {
    // Di antara Start dan Finish (inklusif)
    // Hari Berjalan = (Tanggal Hari Ini - Tanggal Start) + 1 hari
    daysElapsed = diffInDays(startDate, refDate) + 1;
    targetProgressPct = Number(((daysElapsed / totalDays) * 100).toFixed(2));
    isOngoing = true;
  }

  return {
    totalDays,
    dailyTargetPct,
    daysElapsed,
    targetProgressPct: Math.min(Math.max(targetProgressPct, 0), 100),
    isBeforeStart,
    isAfterFinish,
    isOngoing,
  };
}
