// ------------------------------------------------------------------
// Firebase setup for the Clydec Studio portal.
//
// Fill in the values below from your Firebase project settings
// (Project settings > General > Your apps > SDK setup and config),
// or better: put them in a .env file (see .env.example) and keep
// this file reading from import.meta.env so you never commit real
// keys to git.
// ------------------------------------------------------------------
import { initializeApp, getApps } from "firebase/app";
import {
  getAuth, signInWithEmailAndPassword, signOut as fbSignOut,
  onAuthStateChanged, createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import {
  getFirestore, doc, getDoc, setDoc, deleteDoc, collection,
  getDocs, addDoc, updateDoc, deleteField, query, where,
} from "firebase/firestore";
import {
  getStorage, ref, uploadBytes, getDownloadURL, deleteObject,
} from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

/* ---------------------------------------------------------------- */
/* Auth                                                               */
/* ---------------------------------------------------------------- */
export function watchAuth(cb) {
  return onAuthStateChanged(auth, cb);
}
export async function login(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}
export async function logout() {
  await fbSignOut(auth);
}
export async function requestPasswordReset(email) {
  await sendPasswordResetEmail(auth, email);
}

// Creating a new user must not sign the owner/admin out of their own
// session. We spin up a second, throwaway Firebase app instance just
// for the createUser call, then immediately discard it.
export async function createUserAccount(email, tempPassword) {
  const { initializeApp: initSecondary, deleteApp } = await import("firebase/app");
  const secondary = initSecondary(firebaseConfig, "secondary-" + Date.now());
  const secondaryAuth = getAuth(secondary);
  const cred = await createUserWithEmailAndPassword(secondaryAuth, email, tempPassword);
  const uid = cred.user.uid;
  await fbSignOut(secondaryAuth);
  await deleteApp(secondary);
  return uid;
}

/* ---------------------------------------------------------------- */
/* Firestore: generic settings documents (auth/notif/restrictions)   */
/* ---------------------------------------------------------------- */
export async function sget(key, fallback) {
  const snap = await getDoc(doc(db, "settings", key));
  return snap.exists() ? snap.data().value : fallback;
}
export async function sset(key, value) {
  await setDoc(doc(db, "settings", key), { value });
}

/* ---------------------------------------------------------------- */
/* Firestore: collections (users, groups, requests)                  */
/* ---------------------------------------------------------------- */
export async function listCollection(name) {
  const snap = await getDocs(collection(db, name));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
export async function listCollectionWhere(name, field, value) {
  const q = query(collection(db, name), where(field, "==", value));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
export async function setDocIn(collectionName, id, data) {
  await setDoc(doc(db, collectionName, id), data);
}
export async function addDocIn(collectionName, data) {
  const ref2 = await addDoc(collection(db, collectionName), data);
  return ref2.id;
}
export async function updateDocIn(collectionName, id, data) {
  await updateDoc(doc(db, collectionName, id), data);
}
export async function deleteDocFieldIn(collectionName, id, fieldPath) {
  await updateDoc(doc(db, collectionName, id), { [fieldPath]: deleteField() });
}
// Sets or clears several "attendanceOverrides.<date>" keys on one user doc
// in a single write. Pass status: null for a given date to clear that
// override instead of setting it.
export async function setUserAttendanceOverridesBulk(userId, dateStatusPairs) {
  const patch = {};
  dateStatusPairs.forEach(([dateStr, status]) => {
    patch[`attendanceOverrides.${dateStr}`] = status === null ? deleteField() : status;
  });
  await updateDoc(doc(db, "users", userId), patch);
}
export async function deleteDocIn(collectionName, id) {
  await deleteDoc(doc(db, collectionName, id));
}

/* ---------------------------------------------------------------- */
/* Storage: file uploads/downloads                                   */
/* ---------------------------------------------------------------- */
export async function uploadFile(path, file) {
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}
export async function deleteFileFromStorage(path) {
  try { await deleteObject(ref(storage, path)); } catch (e) { /* already gone */ }
}
