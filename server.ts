import dotenv from 'dotenv';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createBookingAndDispatch,
  getOrCreateUser,
  getTopGameScores,
  getUserBookings,
  getUserDispatches,
  saveGameScore,
  updateBookingFields,
  updateDispatchFields,
} from './src/db/queries.ts';
import { AuthRequest, requireAuth } from './src/middleware/auth.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '64kb' }));

  // Authenticated bootstrap: synchronizes Firebase user to Cloud SQL and returns persisted records
  app.get('/api/bootstrap', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user?.uid;
      const email = req.user?.email ?? `${uid}@pulsepro.local`;
      const displayName = typeof req.user?.name === 'string' ? req.user.name : undefined;

      if (!uid) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const dbUser = await getOrCreateUser(uid, email, displayName);
      const [userBookings, userDispatches, topScores] = await Promise.all([
        getUserBookings(dbUser.id),
        getUserDispatches(dbUser.id),
        getTopGameScores(dbUser.id),
      ]);

      return res.json({
        user: {
          uid: dbUser.uid,
          email: dbUser.email,
          displayName: dbUser.displayName,
        },
        bookings: userBookings,
        dispatches: userDispatches,
        topScores,
      });
    } catch (error: unknown) {
      console.error('Failed to bootstrap Cloud SQL workspace:', error);
      const message =
        error instanceof Error ? error.message : 'Unable to load workspace data.';
      return res.status(500).json({ error: message });
    }
  });

  // Persist a new booking + matching pro dispatch row
  app.post('/api/bookings', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user?.uid;
      const email = req.user?.email ?? `${uid}@pulsepro.local`;
      const displayName = typeof req.user?.name === 'string' ? req.user.name : undefined;
      if (!uid) return res.status(401).json({ error: 'Unauthorized' });

      const body = req.body ?? {};
      if (
        typeof body.referenceCode !== 'string' ||
        typeof body.proId !== 'string' ||
        typeof body.proName !== 'string' ||
        typeof body.serviceSummary !== 'string' ||
        typeof body.neighborhood !== 'string' ||
        typeof body.address !== 'string'
      ) {
        return res.status(400).json({ error: 'Invalid booking payload.' });
      }

      const dbUser = await getOrCreateUser(uid, email, displayName);
      const created = await createBookingAndDispatch({
        userId: dbUser.id,
        referenceCode: body.referenceCode.slice(0, 32),
        proId: body.proId.slice(0, 64),
        proName: body.proName.slice(0, 120),
        proRole: String(body.proRole ?? '').slice(0, 120),
        serviceSummary: body.serviceSummary.slice(0, 180),
        neighborhood: body.neighborhood.slice(0, 120),
        address: body.address.slice(0, 200),
        dateLabel: String(body.dateLabel ?? '').slice(0, 60),
        timeSlot: String(body.timeSlot ?? '').slice(0, 60),
        hours: Math.max(1, Math.min(24, Number(body.hours) || 2)),
        hourlyRate: Math.max(1, Math.min(2000, Number(body.hourlyRate) || 100)),
        protectionFee: Math.max(0, Math.min(500, Number(body.protectionFee) || 18)),
        totalAmount: Math.max(1, Math.min(50000, Number(body.totalAmount) || 218)),
        notes: String(body.notes ?? '').slice(0, 500),
        status: String(body.status ?? 'Confirmed').slice(0, 32),
        category: String(body.category ?? 'Home Care').slice(0, 60),
        lat: String(body.lat ?? '37.7925').slice(0, 32),
        lng: String(body.lng ?? '-122.4382').slice(0, 32),
      });

      return res.status(201).json(created);
    } catch (error: unknown) {
      console.error('Failed to persist booking in Cloud SQL:', error);
      return res.status(500).json({ error: 'Failed to save booking.' });
    }
  });

  // Update booking status or arrival slot
  app.patch('/api/bookings/:refCode', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user?.uid;
      const email = req.user?.email ?? `${uid}@pulsepro.local`;
      if (!uid) return res.status(401).json({ error: 'Unauthorized' });

      const dbUser = await getOrCreateUser(uid, email);
      const refCode = String(req.params.refCode ?? '').slice(0, 32);
      const body = req.body ?? {};
      const updates: { status?: string; timeSlot?: string } = {};
      if (typeof body.status === 'string') updates.status = body.status.slice(0, 32);
      if (typeof body.timeSlot === 'string') updates.timeSlot = body.timeSlot.slice(0, 60);

      const updated = await updateBookingFields(dbUser.id, refCode, updates);
      if (body.dispatchStatus && typeof body.dispatchStatus === 'string') {
        await updateDispatchFields(dbUser.id, refCode, {
          status: body.dispatchStatus.slice(0, 32),
          ...(updates.timeSlot ? { scheduledWindow: updates.timeSlot } : {}),
        });
      }
      return res.json({ booking: updated });
    } catch (error: unknown) {
      console.error('Failed to update booking in Cloud SQL:', error);
      return res.status(500).json({ error: 'Failed to update booking.' });
    }
  });

  // Update dispatch job status from Pro Console / Map / Schedule
  app.patch('/api/dispatches/:refCode', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user?.uid;
      const email = req.user?.email ?? `${uid}@pulsepro.local`;
      if (!uid) return res.status(401).json({ error: 'Unauthorized' });

      const dbUser = await getOrCreateUser(uid, email);
      const refCode = String(req.params.refCode ?? '').slice(0, 32);
      const body = req.body ?? {};

      const updated = await updateDispatchFields(dbUser.id, refCode, {
        ...(typeof body.status === 'string' ? { status: body.status.slice(0, 32) } : {}),
        ...(typeof body.scheduledWindow === 'string'
          ? { scheduledWindow: body.scheduledWindow.slice(0, 60) }
          : {}),
      });

      if (typeof body.bookingStatus === 'string') {
        await updateBookingFields(dbUser.id, refCode, {
          status: body.bookingStatus.slice(0, 32),
        });
      }

      return res.json({ dispatch: updated });
    } catch (error: unknown) {
      console.error('Failed to update dispatch in Cloud SQL:', error);
      return res.status(500).json({ error: 'Failed to update dispatch.' });
    }
  });

  // Save 3D Dispatch Runner game score
  app.post('/api/game-scores', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user?.uid;
      const email = req.user?.email ?? `${uid}@pulsepro.local`;
      const displayName = typeof req.user?.name === 'string' ? req.user.name : undefined;
      if (!uid) return res.status(401).json({ error: 'Unauthorized' });

      const dbUser = await getOrCreateUser(uid, email, displayName);
      const body = req.body ?? {};
      const score = Math.max(0, Math.min(1000000, Math.round(Number(body.score) || 0)));
      const dispatchesCleared = Math.max(
        0,
        Math.min(10000, Math.round(Number(body.dispatchesCleared) || 0))
      );
      const durationSeconds = Math.max(
        0,
        Math.min(86400, Math.round(Number(body.durationSeconds) || 0))
      );

      const saved = await saveGameScore(dbUser.id, score, dispatchesCleared, durationSeconds);
      const topScores = await getTopGameScores(dbUser.id);
      return res.status(201).json({ saved, topScores });
    } catch (error: unknown) {
      console.error('Failed to save game score in Cloud SQL:', error);
      return res.status(500).json({ error: 'Failed to save score.' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`PulsePro server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start PulsePro server:', err);
  process.exit(1);
});
