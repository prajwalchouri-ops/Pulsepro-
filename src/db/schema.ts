import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const bookings = pgTable('bookings', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  referenceCode: text('reference_code').notNull().unique(),
  proId: text('pro_id').notNull(),
  proName: text('pro_name').notNull(),
  proRole: text('pro_role').notNull(),
  serviceSummary: text('service_summary').notNull(),
  neighborhood: text('neighborhood').notNull(),
  address: text('address').notNull(),
  dateLabel: text('date_label').notNull(),
  timeSlot: text('time_slot').notNull(),
  hours: integer('hours').notNull(),
  hourlyRate: integer('hourly_rate').notNull(),
  protectionFee: integer('protection_fee').notNull(),
  totalAmount: integer('total_amount').notNull(),
  notes: text('notes').notNull(),
  status: text('status').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const dispatchJobs = pgTable('dispatch_jobs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  referenceCode: text('reference_code').notNull().unique(),
  clientName: text('client_name').notNull(),
  neighborhood: text('neighborhood').notNull(),
  address: text('address').notNull(),
  serviceTitle: text('service_title').notNull(),
  category: text('category').notNull(),
  scheduledDate: text('scheduled_date').notNull(),
  scheduledWindow: text('scheduled_window').notNull(),
  durationHours: integer('duration_hours').notNull(),
  payout: integer('payout').notNull(),
  priority: text('priority').notNull(),
  accessNotes: text('access_notes').notNull(),
  status: text('status').notNull(),
  lat: text('lat').notNull(),
  lng: text('lng').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const gameScores = pgTable('game_scores', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  score: integer('score').notNull(),
  dispatchesCleared: integer('dispatches_cleared').notNull(),
  durationSeconds: integer('duration_seconds').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  bookings: many(bookings),
  dispatchJobs: many(dispatchJobs),
  gameScores: many(gameScores),
}));

export const bookingsRelations = relations(bookings, ({ one }) => ({
  user: one(users, {
    fields: [bookings.userId],
    references: [users.id],
  }),
}));

export const dispatchJobsRelations = relations(dispatchJobs, ({ one }) => ({
  user: one(users, {
    fields: [dispatchJobs.userId],
    references: [users.id],
  }),
}));

export const gameScoresRelations = relations(gameScores, ({ one }) => ({
  user: one(users, {
    fields: [gameScores.userId],
    references: [users.id],
  }),
}));
