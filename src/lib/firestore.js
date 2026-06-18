import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { nanoid } from 'nanoid';

// ── Events ───────────────────────────────────────────────────────────

export async function createEvent(uid, name, type = 'open_play', date = null, time = null) {
  const shareToken = nanoid(10);
  const editToken = nanoid(10);
  const ref = await addDoc(collection(db, 'events'), {
    name, type, date, time,
    createdBy: uid,
    shareToken,
    editToken,
    createdAt: serverTimestamp(),
  });
  return { id: ref.id, shareToken, editToken };
}

export async function getEvent(eventId) {
  const snap = await getDoc(doc(db, 'events', eventId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getEventByToken(token) {
  const q = query(collection(db, 'events'), where('shareToken', '==', token));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

export async function ensureEditToken(eventId) {
  const token = nanoid(10);
  await updateDoc(doc(db, 'events', eventId), { editToken: token });
  return token;
}

export async function getEventByEditToken(token) {
  const q = query(collection(db, 'events'), where('editToken', '==', token));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

export async function getUserEvents() {
  const snap = await getDocs(collection(db, 'events'));
  const events = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return events.sort((a, b) => {
    const aMs = a.createdAt?.toMillis?.() ?? 0;
    const bMs = b.createdAt?.toMillis?.() ?? 0;
    return bMs - aMs;
  });
}

export async function getEventsAsPlayer(uid) {
  try {
    const q = query(collection(db, 'playerMemberships'), where('uid', '==', uid));
    const snap = await getDocs(q);
    const eventIds = [...new Set(snap.docs.map((d) => d.data().eventId).filter(Boolean))];
    if (eventIds.length === 0) return [];
    const events = await Promise.all(eventIds.map((id) => getEvent(id)));
    return events.filter(Boolean);
  } catch (err) {
    console.error('[getEventsAsPlayer] error:', err.message);
    return [];
  }
}

// ── Tables ───────────────────────────────────────────────────────────

export async function createTable(eventId, players) {
  const tableRef = await addDoc(collection(db, 'events', eventId, 'tables'), {
    eventId,
    players,
    createdAt: serverTimestamp(),
  });
  // Record membership for each player with an account so they can find this event
  const playerUids = players.map((p) => p.uid).filter(Boolean);
  await Promise.all(
    playerUids.map((uid) =>
      setDoc(doc(db, 'playerMemberships', `${uid}_${eventId}`), { uid, eventId })
    )
  );
  const roundRef = await addDoc(
    collection(db, 'events', eventId, 'tables', tableRef.id, 'rounds'),
    {
      eventId,
      tableId: tableRef.id,
      status: 'open',
      createdAt: serverTimestamp(),
      completedAt: null,
    }
  );
  return { tableId: tableRef.id, roundId: roundRef.id };
}

export async function getTables(eventId) {
  const q = query(
    collection(db, 'events', eventId, 'tables'),
    orderBy('createdAt', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getTable(eventId, tableId) {
  const snap = await getDoc(doc(db, 'events', eventId, 'tables', tableId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function deleteTable(eventId, tableId) {
  const roundsSnap = await getDocs(collection(db, 'events', eventId, 'tables', tableId, 'rounds'));
  await Promise.all(
    roundsSnap.docs.map(async (roundDoc) => {
      const gamesSnap = await getDocs(
        collection(db, 'events', eventId, 'tables', tableId, 'rounds', roundDoc.id, 'games')
      );
      await Promise.all(gamesSnap.docs.map((g) => deleteDoc(g.ref)));
      await deleteDoc(roundDoc.ref);
    })
  );
  await deleteDoc(doc(db, 'events', eventId, 'tables', tableId));
}

// ── Rounds ───────────────────────────────────────────────────────────

export async function createRound(eventId, tableId) {
  const ref = await addDoc(
    collection(db, 'events', eventId, 'tables', tableId, 'rounds'),
    {
      eventId,
      tableId,
      status: 'open',
      createdAt: serverTimestamp(),
      completedAt: null,
    }
  );
  return ref.id;
}

export async function completeRound(eventId, tableId, roundId) {
  await updateDoc(
    doc(db, 'events', eventId, 'tables', tableId, 'rounds', roundId),
    { status: 'complete', completedAt: serverTimestamp() }
  );
}

export async function getRounds(eventId, tableId) {
  const q = query(
    collection(db, 'events', eventId, 'tables', tableId, 'rounds'),
    orderBy('createdAt', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ── Games ────────────────────────────────────────────────────────────

export async function saveGame(eventId, tableId, roundId, gameData) {
  const ref = await addDoc(
    collection(db, 'events', eventId, 'tables', tableId, 'rounds', roundId, 'games'),
    {
      eventId,
      tableId,
      roundId,
      ...gameData,
      createdAt: serverTimestamp(),
      completedAt: serverTimestamp(),
    }
  );
  return ref.id;
}

export async function getEventGames(eventId) {
  const tables = await getTables(eventId);
  const allGames = [];
  await Promise.all(tables.map(async (table) => {
    const rounds = await getRounds(eventId, table.id);
    await Promise.all(rounds.map(async (round) => {
      const games = await getGames(eventId, table.id, round.id);
      allGames.push(...games.map((g) => ({ ...g, tableId: table.id })));
    }));
  }));
  return allGames;
}

export async function getGames(eventId, tableId, roundId) {
  const q = query(
    collection(db, 'events', eventId, 'tables', tableId, 'rounds', roundId, 'games'),
    orderBy('createdAt', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ── History ──────────────────────────────────────────────────────────

export async function getUserHistory(uid) {
  const q = query(
    collection(db, 'history'),
    where('uid', '==', uid),
    orderBy('playedAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function recordHistory(uid, record) {
  await addDoc(collection(db, 'history'), {
    uid,
    ...record,
    playedAt: serverTimestamp(),
  });
}
