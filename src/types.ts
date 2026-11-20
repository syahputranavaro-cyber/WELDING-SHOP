export interface JobItem {
  id: number;
  deskripsi: string;
  area: string;
  pic?: string;
  start: string;
  finish: string;
  progress_target: number;
  progress_actual: number;
  status: 'AKTIF' | 'SELESAI' | 'TERTUNDA' | string;
}

export interface ArchivedJobItem extends JobItem {
  archivedAt: string;
  archiveType: 'FINISH' | 'DELETED';
  deleteReason?: string;
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

export type SyncStatusType = 'connected' | 'saving' | 'synced-cloud' | 'offline';

export interface ServerSyncState {
  version: number;
  jobs: JobItem[];
  archiveFinish?: ArchivedJobItem[];
  archiveDeleted?: ArchivedJobItem[];
  pinCode?: string;
  branding: BrandingImages;
  currentDateText: string;
  isAutoDate: boolean;
  updatedAt: string;
}
