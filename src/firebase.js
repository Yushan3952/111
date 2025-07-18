// src/firebase.js
import { initializeApp } from "firebase/app";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAeX-tc-Rlr08KU8tPYZ4QcXDFdAx3LYHI",
  authDomain: "trashmap-d648e.firebaseapp.com",
  projectId: "trashmap-d648e",
  storageBucket: "trashmap-d648e.appspot.com",
  messagingSenderId: "527164483024",
  appId: "1:527164483024:web:a40043feb0e05672c085d5",
  measurementId: "G-MFJDX8XJML"
};

const app = initializeApp(firebaseConfig);
const storage = getStorage(app);

export { storage };
