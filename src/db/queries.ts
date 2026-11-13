import { and, desc, eq } from 'drizzle-orm';
import { db } from './index.ts';
import { bookings, dispatchJobs, gameScores, users } from './schema.ts';

export async function getOrCreateUser(uid: string, email: string, displayName?: string) {
  try {
    const result = await db
      .insert(users)
      .values({
        uid,
        email,
        displayName: displayName ?? null,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          displayName: displayName ?? null,
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database query failed in getOrCreateUser:', error);
    throw new Error('Failed to synchronize user profile.', { cause: error });
  }
}

export async function getUserBookings(userId: number) {
  try {
    return await db
      .select()
      .from(bookings)
      .where(eq(bookings.userId, userId))
      .orderBy(desc(bookings.createdAt));
  } catch (error) {
    console.error('Database query failed in getUserBookings:', error);
    throw new Error('Failed to load bookings.', { cause: error });
  }
}

export async function getUserDispatches(userId: number) {
  try {
    return await db
      .select()
      .from(dispatchJobs)
      .where(eq(dispatchJobs.userId, userId))
      .orderBy(desc(dispatchJobs.createdAt));
  } catch (error) {
    console.error('Database query failed in getUserDispatches:', error);
    throw new Error('Failed to load dispatches.', { cause: error });
  }
}

export interface CreateBookingPayload {
  userId: number;
  referenceCode: string;
  proId: string;
  proName: string;
  proRole: string;
  serviceSummary: string;
  neighborhood: string;
  address: string;
  dateLabel: string;
  timeSlot: string;
  hours: number;
  hourlyRate: number;
  protectionFee: number;
  totalAmount: number;
  notes: string;
  status: string;
  category: string;
  lat: string;
  lng: string;
}

export async function createBookingAndDispatch(payload: CreateBookingPayload) {
  try {
    const [createdBooking] = await db
      .insert(bookings)
      .values({
        userId: payload.userId,
        referenceCode: payload.referenceCode,
        proId: payload.proId,
        proName: payload.proName,
        proRole: payload.proRole,
        serviceSummary: payload.serviceSummary,
        neighborhood: payload.neighborhood,
        address: payload.address,
        dateLabel: payload.dateLabel,
        timeSlot: payload.timeSlot,
        hours: payload.hours,
        hourlyRate: payload.hourlyRate,
        protectionFee: payload.protectionFee,
        totalAmount: payload.totalAmount,
        notes: payload.notes,
        status: payload.status,
      })
      .returning();

    const [createdDispatch] = await db
      .insert(dispatchJobs)
      .values({
        userId: payload.userId,
        referenceCode: payload.referenceCode,
        clientName: 'Homeowner Residence',
        neighborhood: payload.neighborhood,
        address: payload.address,
        serviceTitle: payload.serviceSummary,
        category: payload.category,
        scheduledDate: payload.dateLabel,
        scheduledWindow: payload.timeSlot,
        durationHours: payload.hours,
        payout: payload.hourlyRate * payload.hours,
        priority: 'Priority',
        accessNotes: payload.notes,
        status: 'Pending',
        lat: payload.lat,
        lng: payload.lng,
      })
      .returning();

    return { booking: createdBooking, dispatch: createdDispatch };
  } catch (error) {
    console.error('Database query failed in createBookingAndDispatch:', error);
    throw new Error('Failed to persist booking.', { cause: error });
  }
}

export async function updateBookingFields(
  userId: number,
  referenceCode: string,
  updates: { status?: string; timeSlot?: string }
) {
  try {
    const [updated] = await db
      .update(bookings)
      .set(updates)
      .where(
        and(eq(bookings.userId, userId), eq(bookings.referenceCode, referenceCode))
      )
      .returning();

    return updated ?? null;
  } catch (error) {
    console.error('Database query failed in updateBookingFields:', error);
    throw new Error('Failed to update booking.', { cause: error });
  }
}

export async function updateDispatchFields(
  userId: number,
  referenceCode: string,
  updates: { status?: string; scheduledWindow?: string }
) {
  try {
    const [updated] = await db
      .update(dispatchJobs)
      .set(updates)
      .where(
        and(
          eq(dispatchJobs.userId, userId),
          eq(dispatchJobs.referenceCode, referenceCode)
        )
      )
      .returning();

    return updated ?? null;
  } catch (error) {
    console.error('Database query failed in updateDispatchFields:', error);
    throw new Error('Failed to update dispatch.', { cause: error });
  }
}

export async function saveGameScore(
  userId: number,
  score: number,
  dispatchesCleared: number,
  durationSeconds: number
) {
  try {
    const [saved] = await db
      .insert(gameScores)
      .values({
        userId,
        score,
        dispatchesCleared,
        durationSeconds,
      })
      .returning();

    return saved;
  } catch (error) {
    console.error('Database query failed in saveGameScore:', error);
    throw new Error('Failed to save game score.', { cause: error });
  }
}

export async function getTopGameScores(userId: number) {
  try {
    return await db
      .select()
      .from(gameScores)
      .where(eq(gameScores.userId, userId))
      .orderBy(desc(gameScores.score))
      .limit(5);
  } catch (error) {
    console.error('Database query failed in getTopGameScores:', error);
    throw new Error('Failed to load game scores.', { cause: error });
  }
}
