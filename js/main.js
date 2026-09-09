/* =========================================================
   MEEBAN - Shared State, Utilities & Firebase Sync
   ========================================================= */
const STORAGE_KEYS = {
    rooms: "dorm_rooms",
    tenants: "dorm_tenants",
    bills: "dorm_bills",
    payments: "dorm_payments",
    settings: "dorm_settings",
    config: "dorm_config",
    auth: "dorm_logged_in",
    dormInfo: "dorm_info",
    moveInFees: "dorm_move_in_fees"
};

const FIRESTORE_COLLECTIONS = ["rooms", "tenants", "bills", "payments"];
const FIRESTORE_META_PATH = ["meta", "main"];

let settings = {
    electric_rate: 8,
    water_rate: 200,
    garbage_rate: 30,
    due_day: 5
};

const defaultConfig = {
    dorm_name: "หอNK",
    dorm_address: "ซักที่ในความฝันอันไกลโพ้นนนนนน",
    dorm_phone: "0123456789",
    background_color: "#f1f5f9",
    surface_color: "#ffffff",
    text_color: "#1e293b",
    primary_color: "#1e3a5f",
    accent_color: "#f59e0b",
    font_family: "Sarabun",
    font_size: 16
};

let rooms = [];
let tenants = [];
let bills = [];
let payments = [];
let dormInfo = {
    name: defaultConfig.dorm_name,
    address: defaultConfig.dorm_address,
    phone: defaultConfig.dorm_phone
};
let moveInFees = {};
let isLoggedIn = localStorage.getItem(STORAGE_KEYS.auth) === "true";

const firebaseState = {
    initialized: false,
    ready: false,
    error: null,
    saving: false,
    saveQueued: false
};

let firebaseSaveTimer = null;
let firebaseInitPromise = null;

function formatMoney(value) {
    return Number(value || 0).toLocaleString("th-TH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function formatDate(date) {
    if (!date) return "-";
    if (typeof date?.toDate === "function") return date.toDate().toLocaleDateString("th-TH");
    return new Date(date).toLocaleDateString("th-TH");
}

function generateId(prefix) {
    const timePart = Date.now().toString(36).toUpperCase();
    const randomPart = Math.random().toString(36).slice(2, 7).toUpperCase();
    return `${String(prefix).toUpperCase()}-${timePart}-${randomPart}`;
}

const RECORD_ID_PREFIXES = {
    rooms: "ROOM",
    tenants: "TENANT",
    bills: "BILL",
    payments: "PAY",
    items: "ITEM"
};

function ensureRecordId(record, prefix) {
    if (!record || typeof record !== "object") return record;
    const id = String(record.id || "").trim();
    return id ? record : { ...record, id: generateId(prefix) };
}

function normalizeAllRecordIds() {
    let changed = false;

    const normalizeCollection = (items, prefix) => items.map(item => {
        const next = ensureRecordId(item, prefix);
        if (next !== item) changed = true;
        return next;
    });

    rooms = normalizeCollection(rooms, RECORD_ID_PREFIXES.rooms);
    tenants = normalizeCollection(tenants, RECORD_ID_PREFIXES.tenants);
    bills = normalizeCollection(bills, RECORD_ID_PREFIXES.bills).map(bill => {
        const items = Array.isArray(bill.items)
            ? bill.items.map(item => {
                const next = ensureRecordId(item, RECORD_ID_PREFIXES.items);
                if (next !== item) changed = true;
                return next;
            })
            : bill.items;
        return items === bill.items ? bill : { ...bill, items };
    });
    payments = normalizeCollection(payments, RECORD_ID_PREFIXES.payments);

    if (changed) {
        saveLocalCacheOnly();
        console.info("[MEEBAN] Missing record IDs were generated and saved");
    }

    return changed;
}

function escapeHtmlShared(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function recordIdMarkup(id, label = "ID") {
    const safeId = escapeHtmlShared(id || "-");
    const rawId = String(id || "");
    return `
        <div class="record-id" title="รหัสเอกสาร / Document ID">
            <span class="record-id-label">${escapeHtmlShared(label)}</span>
            <code>${safeId}</code>
            ${rawId ? `<button type="button" class="record-id-copy" onclick="copyRecordId(${JSON.stringify(rawId)})" title="คัดลอก ID">คัดลอก</button>` : ""}
        </div>
    `;
}

async function copyRecordId(id) {
    const value = String(id || "");
    if (!value) return;

    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(value);
        } else {
            const area = document.createElement("textarea");
            area.value = value;
            area.style.position = "fixed";
            area.style.opacity = "0";
            document.body.appendChild(area);
            area.select();
            document.execCommand("copy");
            area.remove();
        }
        showToast(`คัดลอก ID ${value} แล้ว`, "info");
    } catch (error) {
        console.error("[MEEBAN] Copy ID failed:", error);
        showToast(`คัดลอกไม่สำเร็จ: ${value}`, "warning");
    }
}

function generateInvoiceNumber() {
    const d = new Date();
    return `INV${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${Date.now().toString().slice(-5)}`;
}

function showToast(message, type = "success") {
    const toast = document.getElementById("toast");
    const text = document.getElementById("toastMessage");
    if (!toast || !text) return;

    toast.className =
        `fixed bottom-5 right-5 z-50 text-white px-4 py-2 rounded shadow-lg transition-all ${
            type === "error" ? "bg-red-600" :
            type === "warning" ? "bg-yellow-500" :
            type === "info" ? "bg-blue-600" : "bg-green-600"
        }`;

    text.textContent = message;
    toast.classList.remove("hidden");

    clearTimeout(window.__toastTimer);
    window.__toastTimer = setTimeout(() => toast.classList.add("hidden"), 3000);
}

function showLoading(show) {
    const loading = document.getElementById("loadingScreen");
    if (!loading) return;
    if (show) {
        loading.classList.remove("hidden");
        loading.classList.add("flex");
    } else {
        loading.classList.add("hidden");
        loading.classList.remove("flex");
    }
}

function safeJsonParse(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
}

function autoSave(options = {}) {
    localStorage.setItem(STORAGE_KEYS.rooms, JSON.stringify(rooms));
    localStorage.setItem(STORAGE_KEYS.tenants, JSON.stringify(tenants));
    localStorage.setItem(STORAGE_KEYS.bills, JSON.stringify(bills));
    localStorage.setItem(STORAGE_KEYS.payments, JSON.stringify(payments));
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
    localStorage.setItem(STORAGE_KEYS.dormInfo, JSON.stringify(dormInfo));
    localStorage.setItem(STORAGE_KEYS.moveInFees, JSON.stringify(moveInFees));

    if (!options.skipFirebase) queueFirebaseSave();
}

function loadLocalData() {
    rooms = safeJsonParse(STORAGE_KEYS.rooms, []);
    tenants = safeJsonParse(STORAGE_KEYS.tenants, []);
    bills = safeJsonParse(STORAGE_KEYS.bills, []);
    payments = safeJsonParse(STORAGE_KEYS.payments, []);
    settings = { ...settings, ...safeJsonParse(STORAGE_KEYS.settings, {}) };
    dormInfo = { ...dormInfo, ...safeJsonParse(STORAGE_KEYS.dormInfo, {}) };
    moveInFees = safeJsonParse(STORAGE_KEYS.moveInFees, {});
}

function getCurrentPageFromPath() {
    const name = location.pathname.split("/").pop() || "index.html";
    return name.replace(".html", "") || "index";
}

function applyDormBrand() {
    const titleNodes = document.querySelectorAll("[data-dorm-name]");
    titleNodes.forEach(node => node.textContent = dormInfo.name || defaultConfig.dorm_name);

    const pageTitle = document.getElementById("pageTitle");
    if (pageTitle && pageTitle.dataset.baseTitle) {
        pageTitle.textContent = pageTitle.dataset.baseTitle;
    }

    document.title = `${dormInfo.name || defaultConfig.dorm_name} - ระบบบริหารจัดการหอพัก`;
}

function updateCurrentDate() {
    const dateEl = document.getElementById("currentDate");
    if (dateEl) {
        dateEl.textContent = new Date().toLocaleDateString("th-TH", {
            year: "numeric",
            month: "long",
            day: "numeric"
        });
    }
}

function setActiveNav(page) {
    document.querySelectorAll(".nav-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.page === page);
    });
}

function toggleSidebar() {
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("sidebarOverlay");
    if (!sidebar) return;

    sidebar.classList.toggle("sidebar-open");
    sidebar.classList.toggle("sidebar-closed");
    if (overlay) overlay.classList.toggle("hidden");
}

function logout() {
    localStorage.removeItem(STORAGE_KEYS.auth);
    isLoggedIn = false;
    location.href = "../index.html";
}

function requireLogin() {
    if (!isLoggedIn) {
        location.href = "../index.html";
        return false;
    }
    return true;
}

function goTo(page) {
    location.href = `${page}.html`;
}

function setupSharedPage(pageName, title) {
    if (!requireLogin()) return false;

    const pageTitle = document.getElementById("pageTitle");
    if (pageTitle) {
        pageTitle.textContent = title;
        pageTitle.dataset.baseTitle = title;
    }

    updateCurrentDate();
    setActiveNav(pageName);
    applyDormBrand();

    if (window.lucide?.createIcons) {
        window.lucide.createIcons();
    }

    return true;
}

function closeOnEscape() {
    document.addEventListener("keydown", event => {
        if (event.key !== "Escape") return;
        document.querySelectorAll(".modal:not(.hidden)").forEach(modal => modal.classList.add("hidden"));
    });
}

/* =========================================================
   Firebase helpers
   ========================================================= */

function getFirebaseDb() {
    return window.meeFirebase?.db || null;
}

function serializeForFirestore(value) {
    if (value === undefined) return null;
    if (value === null) return null;
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return value.map(serializeForFirestore);
    if (typeof value === "object") {
        const output = {};
        Object.entries(value).forEach(([key, child]) => {
            output[key] = serializeForFirestore(child);
        });
        return output;
    }
    return value;
}

// Firestore limits a document to 1 MiB. Images stored as base64 data URLs can
// easily exceed that limit, so room photos are compressed before upload.
function dataUrlByteLength(dataUrl) {
    if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) return 0;
    const base64 = dataUrl.split(",", 2)[1] || "";
    return Math.floor(base64.length * 3 / 4) - (base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0);
}

function loadImageFromDataUrl(dataUrl) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("ไม่สามารถอ่านรูปภาพได้"));
        image.src = dataUrl;
    });
}

function canvasToDataUrl(canvas, quality) {
    return canvas.toDataURL("image/jpeg", quality);
}

async function compressImageDataUrl(dataUrl, targetBytes = 700 * 1024) {
    if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) return dataUrl || "";
    if (dataUrlByteLength(dataUrl) <= targetBytes) return dataUrl;

    try {
        const image = await loadImageFromDataUrl(dataUrl);
        let maxSide = 1400;
        let best = dataUrl;

        for (let dimensionPass = 0; dimensionPass < 5; dimensionPass++) {
            const ratio = Math.min(1, maxSide / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
            const width = Math.max(1, Math.round((image.naturalWidth || image.width) * ratio));
            const height = Math.max(1, Math.round((image.naturalHeight || image.height) * ratio));

            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d", { alpha: false });
            ctx.drawImage(image, 0, 0, width, height);

            for (let quality = 0.82; quality >= 0.38; quality -= 0.08) {
                const candidate = canvasToDataUrl(canvas, quality);
                best = candidate;
                if (dataUrlByteLength(candidate) <= targetBytes) return candidate;
            }

            maxSide = Math.round(maxSide * 0.78);
        }

        return best;
    } catch (error) {
        console.warn("[MEEBAN] Image compression failed; keeping original image:", error);
        return dataUrl;
    }
}

async function prepareRoomsForFirebase() {
    let changed = false;
    const prepared = [];

    for (const room of rooms) {
        if (!room || !room.image || dataUrlByteLength(room.image) <= 700 * 1024) {
            prepared.push(room);
            continue;
        }

        const compressed = await compressImageDataUrl(room.image, 700 * 1024);
        if (compressed !== room.image) {
            changed = true;
            prepared.push({ ...room, image: compressed });
        } else {
            prepared.push(room);
        }
    }

    if (changed) {
        rooms = prepared;
        localStorage.setItem(STORAGE_KEYS.rooms, JSON.stringify(rooms));
        console.info("[MEEBAN] Oversized room images were compressed for Firestore");
    }
}

function getFirestoreCollectionsState() {
    return {
        rooms,
        tenants,
        bills,
        payments
    };
}

async function readFirestoreCollection(collectionName) {
    const db = getFirebaseDb();
    if (!db) throw new Error("Firestore ไม่พร้อมใช้งาน");

    try {
        const snapshot = await db.collection(collectionName).get();
        return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    } catch (error) {
        error.collection = collectionName;
        throw error;
    }
}

async function readFirestoreDoc(collectionName, docId = "main") {
    const db = getFirebaseDb();
    if (!db) throw new Error("Firestore ไม่พร้อมใช้งาน");

    try {
        const snapshot = await db.collection(collectionName).doc(docId).get();
        return snapshot.exists ? snapshot.data() : null;
    } catch (error) {
        error.collection = collectionName;
        error.docId = docId;
        throw error;
    }
}

async function writeFirestoreCollection(collectionName, items) {
    const db = getFirebaseDb();
    if (!db) throw new Error("Firestore ไม่พร้อมใช้งาน");

    const desired = new Map(
        items
            .filter(item => item && item.id)
            .map(item => [String(item.id), serializeForFirestore(item)])
    );

    const existingSnapshot = await db.collection(collectionName).get();
    const existingIds = existingSnapshot.docs.map(doc => doc.id);

    let operations = [];

    existingIds.forEach(id => {
        if (!desired.has(id)) {
            operations.push({ type: "delete", id });
        }
    });

    desired.forEach((data, id) => {
        operations.push({ type: "set", id, data });
    });

    while (operations.length) {
        const batch = db.batch();
        const chunk = operations.splice(0, 450);

        chunk.forEach(operation => {
            const ref = db.collection(collectionName).doc(operation.id);
            if (operation.type === "delete") {
                batch.delete(ref);
            } else {
                batch.set(ref, operation.data);
            }
        });

        await batch.commit();
    }
}

async function writeFirestoreDoc(collectionName, docId, data) {
    const db = getFirebaseDb();
    if (!db) throw new Error("Firestore ไม่พร้อมใช้งาน");
    await db.collection(collectionName).doc(docId).set(serializeForFirestore(data), { merge: true });
}

async function markFirebaseInitialized() {
    await writeFirestoreDoc("meta", "main", {
        initialized: true,
        schemaVersion: 1,
        updatedAt: new Date().toISOString()
    });
}

function firebaseErrorMessage(error) {
    if (!error) return "ไม่ทราบสาเหตุ";
    if (error.code === "permission-denied" || /Missing or insufficient permissions/i.test(error.message || "")) {
        return `Firestore ไม่อนุญาตให้อ่าน/เขียน (${error.collection || "ไม่ทราบ collection"})`;
    }
    if (error.code) return `${error.code}: ${error.message || "เกิดข้อผิดพลาด"}`;
    return error.message || String(error);
}

async function loadFirebaseData() {
    const db = getFirebaseDb();

    if (!db) {
        throw window.meeFirebase?.error || new Error("ไม่สามารถเริ่ม Firestore ได้");
    }

    const results = await Promise.allSettled([
        readFirestoreCollection("rooms"),
        readFirestoreCollection("tenants"),
        readFirestoreCollection("bills"),
        readFirestoreCollection("payments"),
        readFirestoreDoc("settings", "main"),
        readFirestoreDoc("dormInfo", "main"),
        readFirestoreDoc("moveInFees", "main"),
        readFirestoreDoc(...FIRESTORE_META_PATH)
    ]);

    const labels = [
        "rooms",
        "tenants",
        "bills",
        "payments",
        "settings/main",
        "dormInfo/main",
        "moveInFees/main",
        "meta/main"
    ];

    const failed = results
        .map((result, index) => ({ result, label: labels[index] }))
        .filter(item => item.result.status === "rejected");

    failed.forEach(item => console.error(`[MEEBAN] Firebase read failed: ${item.label}`, item.result.reason));

    const values = results.map(result => result.status === "fulfilled" ? result.value : null);
    const [remoteRooms, remoteTenants, remoteBills, remotePayments, remoteSettings, remoteDormInfo, remoteMoveInFees, meta] = values;

    // At least the main rooms collection must be readable for this app to regard
    // Firestore as available. Other resources may be absent on a brand-new database.
    if (failed.length) {
        // A partial read is unsafe for reconciliation because a failed
        // collection could otherwise be mistaken for an empty collection.
        throw failed[0]?.result?.reason || new Error("อ่าน Firestore ไม่สำเร็จ");
    }

    const successfulRemoteData = {
        rooms: remoteRooms,
        tenants: remoteTenants,
        bills: remoteBills,
        payments: remotePayments,
        settings: remoteSettings,
        dormInfo: remoteDormInfo,
        moveInFees: remoteMoveInFees
    };

    const hasInitializedRemote = meta?.initialized === true;
    const remoteHasData = Boolean(
        remoteRooms?.length || remoteTenants?.length || remoteBills?.length || remotePayments?.length ||
        remoteSettings || remoteDormInfo || remoteMoveInFees
    );

    if (hasInitializedRemote || remoteHasData) {
        if (remoteRooms) rooms = remoteRooms;
        if (remoteTenants) tenants = remoteTenants;
        if (remoteBills) bills = remoteBills;
        if (remotePayments) payments = remotePayments;
        normalizeAllRecordIds();
        if (remoteSettings) settings = { ...settings, ...remoteSettings };
        if (remoteDormInfo) dormInfo = { ...dormInfo, ...remoteDormInfo };
        if (remoteMoveInFees) moveInFees = remoteMoveInFees || {};
        saveLocalCacheOnly();
    } else {
        const localHasData = Boolean(
            rooms.length || tenants.length || bills.length || payments.length ||
            Object.keys(moveInFees).length || JSON.stringify(settings) !== JSON.stringify({
                electric_rate: 8, water_rate: 200, garbage_rate: 30, due_day: 5
            })
        );

        if (localHasData) {
            await saveAllToFirebase();
        }

        await markFirebaseInitialized();
    }

    return successfulRemoteData;
}

function loadLocalDataForCacheOnly() {
    localStorage.setItem(STORAGE_KEYS.rooms, JSON.stringify(rooms));
    localStorage.setItem(STORAGE_KEYS.tenants, JSON.stringify(tenants));
    localStorage.setItem(STORAGE_KEYS.bills, JSON.stringify(bills));
    localStorage.setItem(STORAGE_KEYS.payments, JSON.stringify(payments));
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
    localStorage.setItem(STORAGE_KEYS.dormInfo, JSON.stringify(dormInfo));
    localStorage.setItem(STORAGE_KEYS.moveInFees, JSON.stringify(moveInFees));
}

function saveLocalCacheOnly() {
    loadLocalDataForCacheOnly();
}

async function saveAllToFirebase() {
    if (!firebaseState.initialized || !getFirebaseDb()) {
        firebaseState.saveQueued = true;
        return;
    }

    if (firebaseState.saving) {
        firebaseState.saveQueued = true;
        return;
    }

    firebaseState.saving = true;
    firebaseState.saveQueued = false;
    try {
        await prepareRoomsForFirebase();
        const data = getFirestoreCollectionsState();

        await writeFirestoreCollection("rooms", data.rooms);
        await writeFirestoreCollection("tenants", data.tenants);
        await writeFirestoreCollection("bills", data.bills);
        await writeFirestoreCollection("payments", data.payments);
        await writeFirestoreDoc("settings", "main", settings);
        await writeFirestoreDoc("dormInfo", "main", dormInfo);
        await writeFirestoreDoc("moveInFees", "main", moveInFees);
        await markFirebaseInitialized();

        firebaseState.saveQueued = false;
        console.info("[MEEBAN] Firebase sync complete");
    } catch (error) {
        firebaseState.error = error;
        firebaseState.saveQueued = true;
        console.error("[MEEBAN] Firebase save failed:", error);
        showToast(`บันทึก Firebase ไม่สำเร็จ: ${firebaseErrorMessage(error)}`, "error");
    } finally {
        firebaseState.saving = false;
        if (firebaseState.saveQueued) {
            queueFirebaseSave();
        }
    }
}

async function syncFirebaseNow() {
    // Use this after important changes (especially deletes) so the local state
    // and Firestore are reconciled immediately instead of waiting for the
    // debounce timer.
    if (!firebaseState.initialized || !getFirebaseDb()) {
        firebaseState.saveQueued = true;
        return { ok: false, reason: "firebase-not-ready" };
    }

    clearTimeout(firebaseSaveTimer);
    await saveAllToFirebase();
    return { ok: !firebaseState.error };
}

function queueFirebaseSave() {
    firebaseState.saveQueued = true;

    clearTimeout(firebaseSaveTimer);
    firebaseSaveTimer = setTimeout(async () => {
        if (!firebaseState.initialized) return;
        await saveAllToFirebase();
    }, 300);
}

// Deletes the exact Firestore document IDs that were removed locally. The
// following full reconciliation also removes any stale/legacy documents.
async function deleteFirebaseRecords(collectionName, ids) {
    const db = getFirebaseDb();
    const uniqueIds = [...new Set((Array.isArray(ids) ? ids : [ids]).filter(Boolean).map(String))];
    if (!db || !uniqueIds.length) return;

    try {
        const batch = db.batch();
        uniqueIds.forEach(id => batch.delete(db.collection(collectionName).doc(id)));
        await batch.commit();
        console.info(`[MEEBAN] Deleted Firestore ${collectionName}:`, uniqueIds);
    } catch (error) {
        firebaseState.error = error;
        firebaseState.saveQueued = true;
        console.error(`[MEEBAN] Firebase delete failed: ${collectionName}`, error);
        showToast(`ลบใน Firebase ไม่สำเร็จ: ${firebaseErrorMessage(error)}`, "error");
    }
}

function startFirebase() {
    if (firebaseInitPromise) return firebaseInitPromise;

    firebaseInitPromise = (async () => {
        firebaseState.initialized = Boolean(getFirebaseDb());

        if (!firebaseState.initialized) {
            firebaseState.error = window.meeFirebase?.error || new Error("Firebase ไม่พร้อมใช้งาน");
            throw firebaseState.error;
        }

        try {
            await loadFirebaseData();
            firebaseState.ready = true;
            firebaseState.error = null;
            console.info("[MEEBAN] Firestore data is ready");

            window.dispatchEvent(new CustomEvent("mee-firebase-ready", {
                detail: { ok: true }
            }));

            if (firebaseState.saveQueued) {
                await saveAllToFirebase();
            }

            return { ok: true };
        } catch (error) {
            firebaseState.ready = false;
            firebaseState.error = error;
            console.error("[MEEBAN] Firebase load failed:", error);

            window.dispatchEvent(new CustomEvent("mee-firebase-ready", {
                detail: { ok: false, error }
            }));

            // Do not stop the app. Local data remains available.
            return { ok: false, error };
        }
    })();

    return firebaseInitPromise;
}

window.firebaseReady = startFirebase();

function initShared() {
    loadLocalData();
    normalizeAllRecordIds();
    applyDormBrand();
    updateCurrentDate();
    closeOnEscape();
}

/* =========================================================
   Public Firebase helper for optional debugging
   ========================================================= */
window.meeFirebaseStatus = function() {
    return {
        initialized: firebaseState.initialized,
        ready: firebaseState.ready,
        error: firebaseState.error ? firebaseErrorMessage(firebaseState.error) : null,
        projectId: window.meeFirebase?.config?.projectId || null
    };
};
