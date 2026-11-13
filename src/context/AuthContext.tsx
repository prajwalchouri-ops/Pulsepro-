import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  auth,
  db,
  googleAuthProvider,
  handleFirestoreError,
  OperationType,
} from '../lib/firebase';
import { SERVICE_PROS } from '../data/pulseData';
import { BookingRecord, BookingStatus, GameScoreEntry } from '../types/pulse';

interface AuthContextValue {
  user: User | null;
  authReady: boolean;
  signingIn: boolean;
  authError: string | null;
  firestoreBookings: BookingRecord[];
  firestoreScores: GameScoreEntry[];
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  getFreshToken: () => Promise<string | null>;
  saveBookingToFirestore: (booking: BookingRecord) => Promise<void>;
  updateBookingStatusInFirestore: (
    referenceCode: string,
    status: BookingStatus
  ) => Promise<void>;
  updateBookingSlotInFirestore: (
    referenceCode: string,
    timeSlot: string
  ) => Promise<void>;
  saveScoreToFirestore: (
    score: number,
    dispatchesCleared: number,
    durationSeconds: number
  ) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function clampStr(value: string, maxLen: number, fallback = ''): string {
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, maxLen);
}

function clampInt(value: number, min: number, max: number): number {
  const n = Math.round(Number(value) || 0);
  return Math.max(min, Math.min(max, n));
}

function sanitizeDocId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128) || 'doc';
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [firestoreBookings, setFirestoreBookings] = useState<BookingRecord[]>([]);
  const [firestoreScores, setFirestoreScores] = useState<GameScoreEntry[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      if (!nextUser) {
        setFirestoreBookings([]);
        setFirestoreScores([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Ensure split UserPublic + UserPrivate documents exist when authenticated
  useEffect(() => {
    if (!authReady || !user || !user.emailVerified) return;

    let cancelled = false;
    const syncUserProfileDocs = async () => {
      const publicPath = `users/${user.uid}`;
      const privatePath = `users/${user.uid}/private/info`;
      const publicRef = doc(db, 'users', user.uid);
      const privateRef = doc(db, 'users', user.uid, 'private', 'info');

      try {
        const publicSnap = await getDoc(publicRef);
        if (cancelled) return;
        const displayName = clampStr(user.displayName || 'PulsePro Member', 100, 'PulsePro Member');

        if (!publicSnap.exists()) {
          await setDoc(publicRef, {
            ownerId: user.uid,
            displayName,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else if (publicSnap.data().displayName !== displayName) {
          await updateDoc(publicRef, {
            displayName,
            updatedAt: serverTimestamp(),
          });
        }

        const privateSnap = await getDoc(privateRef);
        if (cancelled) return;
        const email = clampStr(user.email || `${user.uid}@pulsepro.local`, 254);

        if (!privateSnap.exists()) {
          await setDoc(privateRef, {
            ownerId: user.uid,
            email,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else if (privateSnap.data().email !== email) {
          await updateDoc(privateRef, {
            email,
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to sync profile docs:', err);
          if (err instanceof Error && err.message.includes('Missing or insufficient permissions')) {
            handleFirestoreError(err, OperationType.WRITE, publicPath || privatePath);
          }
        }
      }
    };

    void syncUserProfileDocs();
    return () => {
      cancelled = true;
    };
  }, [authReady, user]);

  // Attach onSnapshot listeners ONLY when authReady && user
  useEffect(() => {
    if (!authReady || !user) return;

    const bookingsPath = `users/${user.uid}/bookings`;
    const bookingsQuery = query(
      collection(db, 'users', user.uid, 'bookings'),
      where('ownerId', '==', user.uid)
    );

    const unsubBookings = onSnapshot(
      bookingsQuery,
      (snapshot) => {
        const rows: BookingRecord[] = snapshot.docs.map((d) => {
          const data = d.data();
          const pro = SERVICE_PROS.find((p) => p.id === data.proId);
          return {
            id: d.id,
            referenceCode: String(data.referenceCode ?? d.id),
            proId: String(data.proId ?? 'pro-marcus'),
            proName: String(data.proName ?? 'Specialist'),
            proRole: String(data.proRole ?? 'Residential Specialist'),
            proAvatar: pro?.avatarUrl ?? SERVICE_PROS[0].avatarUrl,
            serviceSummary: String(data.serviceSummary ?? ''),
            neighborhood: String(data.neighborhood ?? ''),
            address: String(data.address ?? ''),
            dateLabel: String(data.dateLabel ?? ''),
            timeSlot: String(data.timeSlot ?? ''),
            hours: Number(data.hours ?? 2),
            hourlyRate: Number(data.hourlyRate ?? 100),
            protectionFee: Number(data.protectionFee ?? 18),
            totalAmount: Number(data.totalAmount ?? 218),
            notes: String(data.notes ?? ''),
            status: (data.status as BookingStatus) ?? 'Confirmed',
            createdAt:
              data.createdAt && typeof data.createdAt.toDate === 'function'
                ? data.createdAt.toDate().toISOString()
                : new Date().toISOString(),
          };
        });
        rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
        setFirestoreBookings(rows);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, bookingsPath);
      }
    );

    const scoresPath = 'gameScores';
    const scoresQuery = query(
      collection(db, 'gameScores'),
      where('ownerId', '==', user.uid)
    );

    const unsubScores = onSnapshot(
      scoresQuery,
      (snapshot) => {
        const rows: GameScoreEntry[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            playerName: String(data.playerName ?? 'PulsePro Driver'),
            score: Number(data.score ?? 0),
            dispatchesCleared: Number(data.dispatchesCleared ?? 0),
            durationSeconds: Number(data.durationSeconds ?? 0),
            createdAt:
              data.createdAt && typeof data.createdAt.toDate === 'function'
                ? data.createdAt.toDate().toISOString()
                : new Date().toISOString(),
          };
        });
        rows.sort((a, b) => b.score - a.score);
        setFirestoreScores(rows.slice(0, 5));
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, scoresPath);
      }
    );

    return () => {
      unsubBookings();
      unsubScores();
    };
  }, [authReady, user]);

  const signInWithGoogle = useCallback(async () => {
    setSigningIn(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unable to complete Google Sign-In.';
      setAuthError(msg);
    } finally {
      setSigningIn(false);
    }
  }, []);

  const signOutUser = useCallback(async () => {
    setAuthError(null);
    await signOut(auth);
  }, []);

  const getFreshToken = useCallback(async () => {
    if (!auth.currentUser) return null;
    try {
      return await auth.currentUser.getIdToken();
    } catch {
      return null;
    }
  }, []);

  const saveBookingToFirestore = useCallback(async (booking: BookingRecord) => {
    const currentUser = auth.currentUser;
    if (!currentUser || !currentUser.emailVerified) return;

    const docId = sanitizeDocId(booking.referenceCode);
    const path = `users/${currentUser.uid}/bookings/${docId}`;
    const validRef = /^PP-[0-9]{4,8}$/.test(booking.referenceCode)
      ? booking.referenceCode
      : `PP-${String(Date.now()).slice(-6)}`;

    try {
      await setDoc(doc(db, 'users', currentUser.uid, 'bookings', docId), {
        ownerId: currentUser.uid,
        referenceCode: validRef,
        proId: clampStr(booking.proId, 64, 'pro-marcus'),
        proName: clampStr(booking.proName, 120, 'Specialist'),
        proRole: clampStr(booking.proRole, 120, 'Residential Specialist'),
        serviceSummary: clampStr(booking.serviceSummary, 180, 'Residential Service'),
        neighborhood: clampStr(booking.neighborhood, 120, 'Pacific Heights, SF'),
        address: clampStr(booking.address, 200, 'Bay Area Residence'),
        dateLabel: clampStr(booking.dateLabel, 60, 'Today'),
        timeSlot: clampStr(booking.timeSlot, 60, '02:00 PM'),
        hours: clampInt(booking.hours, 1, 24),
        hourlyRate: clampInt(booking.hourlyRate, 1, 5000),
        protectionFee: clampInt(booking.protectionFee, 0, 500),
        totalAmount: clampInt(booking.totalAmount, 1, 100000),
        notes: booking.notes.trim().slice(0, 500),
        status: booking.status,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }, []);

  const updateBookingStatusInFirestore = useCallback(
    async (referenceCode: string, status: BookingStatus) => {
      const currentUser = auth.currentUser;
      if (!currentUser || !currentUser.emailVerified) return;
      const docId = sanitizeDocId(referenceCode);
      const path = `users/${currentUser.uid}/bookings/${docId}`;
      try {
        await updateDoc(doc(db, 'users', currentUser.uid, 'bookings', docId), {
          status,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        if (error instanceof Error && error.message.includes('No document to update')) {
          return;
        }
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    },
    []
  );

  const updateBookingSlotInFirestore = useCallback(
    async (referenceCode: string, timeSlot: string) => {
      const currentUser = auth.currentUser;
      if (!currentUser || !currentUser.emailVerified) return;
      const docId = sanitizeDocId(referenceCode);
      const path = `users/${currentUser.uid}/bookings/${docId}`;
      try {
        await updateDoc(doc(db, 'users', currentUser.uid, 'bookings', docId), {
          timeSlot: clampStr(timeSlot, 60, '02:00 PM'),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        if (error instanceof Error && error.message.includes('No document to update')) {
          return;
        }
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    },
    []
  );

  const saveScoreToFirestore = useCallback(
    async (score: number, dispatchesCleared: number, durationSeconds: number) => {
      const currentUser = auth.currentUser;
      if (!currentUser || !currentUser.emailVerified) return;

      const docId = sanitizeDocId(`sc-${currentUser.uid.slice(0, 12)}-${Date.now()}`);
      const path = `gameScores/${docId}`;
      try {
        await setDoc(doc(db, 'gameScores', docId), {
          ownerId: currentUser.uid,
          playerName: clampStr(currentUser.displayName || 'PulsePro Driver', 100, 'PulsePro Driver'),
          score: clampInt(score, 0, 1000000),
          dispatchesCleared: clampInt(dispatchesCleared, 0, 10000),
          durationSeconds: clampInt(durationSeconds, 0, 86400),
          createdAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, path);
      }
    },
    []
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        authReady,
        signingIn,
        authError,
        firestoreBookings,
        firestoreScores,
        signInWithGoogle,
        signOutUser,
        getFreshToken,
        saveBookingToFirestore,
        updateBookingStatusInFirestore,
        updateBookingSlotInFirestore,
        saveScoreToFirestore,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
