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
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { nanoid } from 'nanoid';

// ── Events ───────────────────────────────────────────────────────────

export async function createEvent(uid, name, type = 'open_play', date = null, time = null, createdByName = '') {
  const shareToken = nanoid(10);
  const ref = await addDoc(collection(db, 'events'), {
    name, type, date, time,
    createdBy: uid,
    createdByName,
    shareToken,
    createdAt: serverTimestamp(),
  });
  return { id: ref.id, shareToken };
}

export async function searchUsers(term) {
  if (!term || term.length < 2) return [];
  const t = term.toLowerCase();
  const end = t + '';
  const [nameSnap, emailSnap] = await Promise.all([
    getDocs(query(collection(db, 'users'), where('displayNameLower', '>=', t), where('displayNameLower', '<=', end), limit(8))),
    getDocs(query(collection(db, 'users'), where('email', '>=', t), where('email', '<=', end), limit(8))),
  ]);
  const map = new Map();
  [...nameSnap.docs, ...emailSnap.docs].forEach((d) => {
    map.set(d.id, { uid: d.id, ...d.data() });
  });
  return [...map.values()].slice(0, 8);
}

export async function getUserDisplayName(uid) {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? snap.data().displayName || null : null;
  } catch {
    return null;
  }
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

export async function getUserEvents(uid) {
  // Events created by this user
  const createdSnap = await getDocs(
    query(collection(db, 'events'), where('createdBy', '==', uid))
  );
  const created = createdSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // Events where user is a player (via playerMemberships)
  const memberSnap = await getDocs(
    query(collection(db, 'playerMemberships'), where('uid', '==', uid))
  );
  const memberEventIds = [...new Set(memberSnap.docs.map((d) => d.data().eventId).filter(Boolean))];
  const memberEvents = (await Promise.all(memberEventIds.map((id) => getEvent(id)))).filter(Boolean);

  // Merge, deduplicate by id, sort newest first
  const all = [...created, ...memberEvents];
  const deduped = [...new Map(all.map((e) => [e.id, e])).values()];
  return deduped.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
}

// ── Tables ───────────────────────────────────────────────────────────

export async function createTable(eventId, players) {
  try {
    console.log('Creating table document...');
    const tableRef = await addDoc(collection(db, 'events', eventId, 'tables'), {
      eventId,
      players,
      createdAt: serverTimestamp(),
    });
    console.log('Table created:', tableRef.id);

    // Record membership for each player with an account so they can find this event
    const playerUids = players.map((p) => p.uid).filter(Boolean);
    if (playerUids.length > 0) {
      console.log('Creating playerMemberships for UIDs:', playerUids);
      await Promise.all(
        playerUids.map((uid) =>
          setDoc(doc(db, 'playerMemberships', `${uid}_${eventId}`), { uid, eventId })
        )
      );
      console.log('Memberships created');
    }

    console.log('Creating round document...');
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
    console.log('Round created:', roundRef.id);
    return { tableId: tableRef.id, roundId: roundRef.id };
  } catch (err) {
    console.error('createTable failed:', err.code, err.message);
    throw err;
  }
}

export async function deleteEvent(uid, eventId) {
  const tables = await getTables(eventId);
  await Promise.all(tables.map((t) => deleteTable(eventId, t.id)));

  // Clean up only the current user's own membership + history records — Firestore
  // rules prevent reading other users' docs, so we target by uid directly.
  const ownMembershipRef = doc(db, 'playerMemberships', `${uid}_${eventId}`);
  await deleteDoc(ownMembershipRef).catch(() => {});

  const historySnap = await getDocs(
    query(collection(db, 'history'), where('uid', '==', uid), where('eventId', '==', eventId))
  ).catch(() => null);
  if (historySnap) {
    await Promise.all(historySnap.docs.map((d) => deleteDoc(d.ref)));
  }

  await deleteDoc(doc(db, 'events', eventId));
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

export async function deleteRound(eventId, tableId, roundId) {
  const gamesSnap = await getDocs(
    collection(db, 'events', eventId, 'tables', tableId, 'rounds', roundId, 'games')
  );
  await Promise.all(gamesSnap.docs.map((g) => deleteDoc(g.ref)));
  await deleteDoc(doc(db, 'events', eventId, 'tables', tableId, 'rounds', roundId));
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
