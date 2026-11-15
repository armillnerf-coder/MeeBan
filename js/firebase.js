/* =========================================================
   MEEBAN - Firebase / Cloud Firestore / Authentication
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

        // ต้องโหลด firebase-auth-compat.js ก่อนไฟล์นี้ในทุกหน้า
        if (typeof firebase.auth !== "function") {
            throw new Error("Firebase Auth SDK ไม่ได้ถูกโหลด (firebase-auth-compat.js)");
        }

        const app = firebase.apps.length
            ? firebase.app()
            : firebase.initializeApp(firebaseConfig);

        const db = firebase.firestore();
        db.settings({ ignoreUndefinedProperties: true });

        const auth = firebase.auth();
        // เก็บ session ไว้ในแท็บนี้เท่านั้น ปิดแท็บ/เบราว์เซอร์แล้วต้องล็อกอินใหม่
        // (เหมาะกับเครื่องที่ใช้ร่วมกัน) ถ้าต้องการให้จำการล็อกอินให้เปลี่ยนเป็น LOCAL
        auth.setPersistence(firebase.auth.Auth.Persistence.SESSION).catch(error => {
            console.warn("[MEEBAN] Auth persistence setup failed:", error);
        });

        window.meeFirebase = {
            app,
            db,
            auth,
            config: firebaseConfig
        };

        console.info("[MEEBAN] Firebase initialized:", firebaseConfig.projectId);
    } catch (error) {
        window.meeFirebase = {
            app: null,
            db: null,
            auth: null,
            config: firebaseConfig,
            error
        };

        console.error("[MEEBAN] Firebase initialization failed:", error);
    }
})();

/* ---------------------------------------------------------
   Auth helpers (ใช้ใน login.js และ main.js)
   --------------------------------------------------------- */

// คืนค่า Promise<user | null> เมื่อ Firebase ตรวจสถานะล็อกอินเสร็จครั้งแรก
window.meeAuthReady = new Promise(resolve => {
    const auth = window.meeFirebase?.auth;
    if (!auth) {
        resolve(null);
        return;
    }
    const unsubscribe = auth.onAuthStateChanged(user => {
        unsubscribe();
        resolve(user || null);
    });
});

window.meeCurrentUser = function () {
    return window.meeFirebase?.auth?.currentUser || null;
};

window.meeSignIn = function (email, password) {
    const auth = window.meeFirebase?.auth;
    if (!auth) return Promise.reject(window.meeFirebase?.error || new Error("Firebase Auth ไม่พร้อมใช้งาน"));
    return auth.signInWithEmailAndPassword(email, password);
};

// สมัครสมาชิก: สร้างบัญชีใน Firebase Auth แล้วสร้างโปรไฟล์ role = "pending"
// (ยังเข้าข้อมูลหอพักไม่ได้จนกว่าเจ้าของจะอนุมัติ)
window.meeSignUp = async function (email, password) {
    const auth = window.meeFirebase?.auth;
    if (!auth) throw (window.meeFirebase?.error || new Error("Firebase Auth ไม่พร้อมใช้งาน"));
    const credential = await auth.createUserWithEmailAndPassword(email, password);
    await window.meeEnsureProfile(credential.user);
    return credential.user;
};

// อ่านโปรไฟล์ users/{uid} ถ้ายังไม่มีให้สร้างเป็น pending แล้วคืนค่าโปรไฟล์
window.meeEnsureProfile = async function (user) {
    const db = window.meeFirebase?.db;
    if (!db || !user) return null;

    const ref = db.collection("users").doc(user.uid);
    const snapshot = await ref.get();
    if (snapshot.exists) return snapshot.data();

    const profile = {
        email: user.email || "",
        role: "pending",
        createdAt: new Date().toISOString()
    };
    await ref.set(profile);
    return profile;
};

window.meeSignOut = function () {
    const auth = window.meeFirebase?.auth;
    return auth ? auth.signOut() : Promise.resolve();
};

// แปลงรหัสข้อผิดพลาดของ Firebase Auth เป็นข้อความภาษาไทย
window.meeAuthErrorMessage = function (error) {
    switch (error?.code) {
        case "auth/invalid-email":
            return "รูปแบบอีเมลไม่ถูกต้อง";
        case "auth/user-disabled":
            return "บัญชีนี้ถูกปิดใช้งาน";
        case "auth/user-not-found":
        case "auth/wrong-password":
        case "auth/invalid-credential":
        case "auth/invalid-login-credentials":
            return "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
        case "auth/email-already-in-use":
            return "อีเมลนี้ถูกใช้สมัครไปแล้ว";
        case "auth/weak-password":
            return "รหัสผ่านคาดเดาง่ายเกินไป กรุณาตั้งให้ยาวและซับซ้อนขึ้น";
        case "auth/operation-not-allowed":
            return "ยังไม่ได้เปิดการเข้าสู่ระบบด้วยอีเมล/รหัสผ่านใน Firebase";
        case "auth/too-many-requests":
            return "ลองผิดหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่";
        case "auth/network-request-failed":
            return "เชื่อมต่ออินเทอร์เน็ตไม่ได้";
        default:
            return "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่";
    }
};
