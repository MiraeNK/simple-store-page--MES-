import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyB7bB7KRDSTYAJx4l0Jp9pmXVkW96odXkQ",
  authDomain: "mes-simple-store.firebaseapp.com",
  databaseURL: "https://mes-simple-store-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "mes-simple-store",
  storageBucket: "mes-simple-store.firebasestorage.app",
  messagingSenderId: "1077175694210",
  appId: "1:1077175694210:web:f19b49c6954ee8382c159b",
  measurementId: "G-RJKX6LS3X9"
};
// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);