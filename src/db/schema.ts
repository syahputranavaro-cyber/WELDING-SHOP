import { relations } from 'drizzle-orm';
import {
  bigint,
  boolean,
  doublePrecision,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

// Authenticated Google / Firebase users
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  lastLoginAt: timestamp('last_login_at').defaultNow().notNull(),
});

// Active dashboard jobs
export const jobs = pgTable('jobs', {
  id: bigint('id', { mode: 'number' }).primaryKey(),
  deskripsi: text('deskripsi').notNull(),
  area: text('area').notNull(),
  pic: text('pic'),
  startDate: text('start_date').notNull(),
  finishDate: text('finish_date').notNull(),
  progressTarget: doublePrecision('progress_target').notNull().default(0),
  progressActual: doublePrecision('progress_actual').notNull().default(0),
  status: text('status').notNull().default('AKTIF'),
  sortOrder: integer('sort_order').notNull().default(0),
  updatedByUid: text('updated_by_uid').references(() => users.uid),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Archived jobs (FINISH and DELETED)
export const archivedJobs = pgTable('archived_jobs', {
  recordId: serial('record_id').primaryKey(),
  jobId: bigint('job_id', { mode: 'number' }).notNull(),
  deskripsi: text('deskripsi').notNull(),
  area: text('area').notNull(),
  pic: text('pic'),
  startDate: text('start_date').notNull(),
  finishDate: text('finish_date').notNull(),
  progressTarget: doublePrecision('progress_target').notNull().default(0),
  progressActual: doublePrecision('progress_actual').notNull().default(0),
  status: text('status').notNull().default('SELESAI'),
  archiveType: text('archive_type').notNull(), // 'FINISH' | 'DELETED'
  archivedAt: text('archived_at').notNull(),
  deleteReason: text('delete_reason'),
  updatedByUid: text('updated_by_uid').references(() => users.uid),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Singleton dashboard settings (version, PIN, branding, date mode)
export const dashboardSettings = pgTable('dashboard_settings', {
  id: integer('id').primaryKey().default(1),
  version: integer('version').notNull().default(1),
  pinCode: text('pin_code').notNull().default('1234'),
  companyLogoUrl: text('company_logo_url'),
  weldingLogoUrl: text('welding_logo_url'),
  k3PosterUrl: text('k3_poster_url'),
  useCustomK3Image: boolean('use_custom_k3_image').notNull().default(false),
  currentDateText: text('current_date_text').notNull().default('20 November 2026'),
  isAutoDate: boolean('is_auto_date').notNull().default(true),
  updatedByUid: text('updated_by_uid').references(() => users.uid),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  jobs: many(jobs),
  archivedJobs: many(archivedJobs),
  settings: many(dashboardSettings),
}));

export const jobsRelations = relations(jobs, ({ one }) => ({
  updatedBy: one(users, {
    fields: [jobs.updatedByUid],
    references: [users.uid],
  }),
}));

export const archivedJobsRelations = relations(archivedJobs, ({ one }) => ({
  updatedBy: one(users, {
    fields: [archivedJobs.updatedByUid],
    references: [users.uid],
  }),
}));

export const dashboardSettingsRelations = relations(dashboardSettings, ({ one }) => ({
  updatedBy: one(users, {
    fields: [dashboardSettings.updatedByUid],
    references: [users.uid],
  }),
}));
