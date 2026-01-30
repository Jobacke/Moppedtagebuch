import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyCU4b7reiVNHjqvuEM7cXSLGilCmZ5YYlM",
    authDomain: "moppedtagebuch.firebaseapp.com",
    projectId: "moppedtagebuch",
    storageBucket: "moppedtagebuch.firebasestorage.app",
    messagingSenderId: "456539319107",
    appId: "1:456539319107:web:1a32f14396c920a4c39df6"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
