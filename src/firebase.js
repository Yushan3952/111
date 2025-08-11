import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA0IH9BexS4RhRklbt9S_RFMgS37P5ewjo",
  authDomain: "trashmap-d648e.firebaseapp.com",
  projectId: "trashmap-d648e",
  storageBucket: "trashmap-d648e.appspot.com",
  messagingSenderId: "922843233736",
  appId: "1:922843233736:web:2d8ab1ef2ed1db65d808bc"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
