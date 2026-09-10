export interface JobItem {
  id: number;
  deskripsi: string;
  area: string;
  start: string;
  finish: string;
  progress_target: number;
  progress_actual: number;
  status: 'AKTIF' | 'SELESAI' | 'TERTUNDA' | string;
}

export interface DashboardSettings {
  autoCycle: boolean;
  cycleIntervalSeconds: number;
  itemsPerPage: number;
  showDeviations: boolean;
  useLiveDate: boolean;
  customDateText: string;
}

export interface BrandingImages {
  companyLogoUrl: string | null;
  weldingLogoUrl: string | null;
  k3PosterUrl: string | null;
  useCustomK3Image: boolean;
}
