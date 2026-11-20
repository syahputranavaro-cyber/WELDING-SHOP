-- ============================================================================
-- Skema Database Supabase untuk Dashboard Welding Shop (PT Pupuk Kaltim)
-- Jalankan seluruh skrip ini satu kali di Supabase -> SQL Editor -> New Query
-- ============================================================================

-- 1. Tabel Pekerjaan Aktif (Jobs)
create table if not exists public.welding_jobs (
  id bigint primary key,
  deskripsi text not null,
  area text not null default '',
  pic text,
  start_date text not null default '',
  finish_date text not null default '',
  progress_target double precision not null default 0,
  progress_actual double precision not null default 0,
  status text not null default 'AKTIF',
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

-- 2. Tabel Arsip Pekerjaan (Selesai & Dihapus)
create table if not exists public.welding_archives (
  id bigint not null,
  archive_type text not null check (archive_type in ('FINISH', 'DELETED')),
  deskripsi text not null,
  area text not null default '',
  pic text,
  start_date text not null default '',
  finish_date text not null default '',
  progress_target double precision not null default 0,
  progress_actual double precision not null default 0,
  status text not null default 'SELESAI',
  archived_at timestamptz not null default now(),
  delete_reason text,
  primary key (id, archive_type)
);

-- 3. Tabel Pengaturan, Branding (Logo & Poster K3), PIN, dan Versi Sinkronisasi
create table if not exists public.welding_settings (
  id text primary key default 'main',
  version integer not null default 1,
  pin_code text not null default '1234',
  branding jsonb not null default '{"companyLogoUrl":null,"weldingLogoUrl":null,"k3PosterUrl":null,"useCustomK3Image":false}'::jsonb,
  current_date_text text not null default '16 September 2026',
  is_auto_date boolean not null default true,
  updated_at timestamptz not null default now()
);

-- Index untuk performa query & pengurutan
create index if not exists idx_welding_jobs_sort_order on public.welding_jobs (sort_order asc, id asc);
create index if not exists idx_welding_archives_type_time on public.welding_archives (archive_type, archived_at desc);

-- Aktifkan Row Level Security (RLS)
-- Backend server memakai SUPABASE_SERVICE_ROLE_KEY sehingga akses server selalu terotorisasi aman
-- sementara akses publik langsung ke REST API Supabase tetap terlindungi.
alter table public.welding_jobs enable row level security;
alter table public.welding_archives enable row level security;
alter table public.welding_settings enable row level security;
