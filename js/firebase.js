/* =========================================================
   MEEBAN - Firebase / Cloud Firestore connection
   ========================================================= */

const firebaseConfig = {
    apiKey: "AIzaSyBRG1aQBb72o7zdLvU6SpWpqUTAe_n2av0",
    authDomain: "managing-a-dormitory-meeban.firebaseapp.com",
    projectId: "managing-a-dormitory-meeban",
    storageBucket: "managing-a-dormitory-meeban.firebasestorage.app",
    messagingSenderId: "190088461555",
    appId: "1:190088461555:web:00e182055ce6bb2d6acb86",
    measurementId: "G-L3GMDMJNXN"
};

(function connectFirebase() {
    try {
        if (!window.firebase) {
            throw new Error("Firebase SDK ไม่ได้ถูกโหลด");
        }

        const app = firebase.apps.length
            ? firebase.app()
            : firebase.initializeApp(firebaseConfig);

        const db = firebase.firestore();
        db.settings({ ignoreUndefinedProperties: true });

        window.meeFirebase = {
            app,
            db,
            config: firebaseConfig
        };

        console.info("[MEEBAN] Firebase initialized:", firebaseConfig.projectId);
    } catch (error) {
        window.meeFirebase = {
            app: null,
            db: null,
            config: firebaseConfig,
            error
        };

        console.error("[MEEBAN] Firebase initialization failed:", error);
    }
})();
