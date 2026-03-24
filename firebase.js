import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  orderBy,
  where,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBwv7z6-Inv3xde496zYZ8WoSl-Aqjzx5g",
  authDomain: "atas-reunioes-c8839.firebaseapp.com",
  projectId: "atas-reunioes-c8839",
  storageBucket: "atas-reunioes-c8839.firebasestorage.app",
  messagingSenderId: "373074745301",
  appId: "1:373074745301:web:9b1b834839e5c1ce260f5c"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Referências às coleções
const atasCollection = collection(db, "atas");
const participantesCollection = collection(db, "participantes");
const anotacoesCollection = collection(db, "anotacoes");

// Exportar funções e referências para uso em app.js
export {
  db,
  atasCollection,
  participantesCollection,
  anotacoesCollection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  orderBy,
  where,
  onSnapshot
};
