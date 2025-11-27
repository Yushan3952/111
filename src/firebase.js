import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
const firebaseConfig = {
  apiKey: "AIzaSyBqOaY9c3Uo6KkG8fD7Vx5L3X2P2x1H0q8",
  authDomain: "trashmap-d648e.firebaseapp.com",
  projectId: "trashmap-d648e",
  storageBucket: "trashmap-d648e.appspot.com",
  messagingSenderId: "1059384934230",
  appId: "1:1059384934230:web:abcdef1234567890"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
