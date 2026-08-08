// src/firebase.js
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, initializeAuth, browserLocalPersistence } from "firebase/auth"; // 🌟 تعديل هنا

const firebaseConfig = {
  apiKey: "AIzaSyBGyx3_5XZwjDO3kC_D1ROG4yHS7jamiBE",
  authDomain: "alrazi-opt.firebaseapp.com",
  databaseURL: "https://alrazi-opt-default-rtdb.firebaseio.com",
  projectId: "alrazi-opt",
  storageBucket: "alrazi-opt.firebasestorage.app",
  messagingSenderId: "773268300495",
  appId: "1:773268300495:web:15de0b3b8bb2db6d4f4dba",
  measurementId: "G-3YF6PZLGMH"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const db = getFirestore(app);

// 🌟 تهيئة المصادقة بشكل يضمن عملها محلياً داخل الإلكترون بدون مشاكل كاش
export const auth = getApps().length === 0 
  ? initializeAuth(app, { persistence: browserLocalPersistence }) 
  : getAuth(app);