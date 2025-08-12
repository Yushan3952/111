// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCe9Ly8XscGgYkN_dRHyTkjOkL6JH2OeV8",
  authDomain: "trashmap-d648e.firebaseapp.com",
  projectId: "trashmap-d648e",
  storageBucket: "trashmap-d648e.appspot.com",
  messagingSenderId: "350494571080",
  appId: "1:350494571080:web:208e91c0633e859899fac8"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
