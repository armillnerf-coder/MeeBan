document.addEventListener("DOMContentLoaded", () => {
    initShared();
    if (!setupSharedPage("settings", "ตั้งค่า")) return;

    loadSettingsForm();
    renderMoveInFees();

    document.getElementById("dormInfoForm")?.addEventListener("submit", saveDormInfo);
    document.getElementById("settingsForm")?.addEventListener("submit", saveSettingsForm);
    document.getElementById("settingDormLogo")?.addEventListener("change", previewDormLogo);
    document.getElementById("removeDormLogo")?.addEventListener("click", markDormLogoForRemoval);

    window.firebaseReady?.then(() => {
        applyDormBrand();
        loadSettingsForm();
        renderMoveInFees();
    });
});

function loadSettingsForm() {
    document.getElementById("settingDormName").value = dormInfo.name || "";
    document.getElementById("settingDormAddress").value = dormInfo.address || "";
    document.getElementById("settingDormPhone").value = dormInfo.phone || "";
    setDormLogoPreview(dormInfo.logo || "");

    document.getElementById("settingElectricRate").value = settings.electric_rate;
    document.getElementById("settingWaterRate").value = settings.water_rate;
    document.getElementById("settingGarbageRate").value = settings.garbage_rate;
    document.getElementById("settingDueDay").value = settings.due_day;
}

async function saveDormInfo(event) {
    event.preventDefault();

    const logoInput = document.getElementById("settingDormLogo");
    let logo = dormInfo.logo || "";

    if (logoInput?.dataset.removeLogo === "true") {
        logo = "";
    } else if (logoInput?.files?.[0]) {
        try {
            const dataUrl = await readDormLogo(logoInput.files[0]);
            logo = await compressImageDataUrl(dataUrl, 180 * 1024);
        } catch (error) {
            console.error("[MEEBAN] Logo upload failed:", error);
            showToast("ไม่สามารถอ่านไฟล์โลโก้ได้", "error");
            return;
        }
    }

    dormInfo = {
        name: document.getElementById("settingDormName")?.value.trim() || "หอNK",
        address: document.getElementById("settingDormAddress")?.value.trim() || "",
        phone: document.getElementById("settingDormPhone")?.value.trim() || "",
        logo
    };

    autoSave();
    applyDormBrand();

    const msg = document.getElementById("dormInfoMsg");
    msg?.classList.remove("hidden");
    setTimeout(() => msg?.classList.add("hidden"), 2000);
    showToast("บันทึกข้อมูลหอพักเรียบร้อย");
}

function previewDormLogo(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
        showToast("กรุณาเลือกไฟล์รูปภาพ", "warning");
        event.target.value = "";
        return;
    }

    event.target.dataset.removeLogo = "false";
    const reader = new FileReader();
    reader.onload = () => setDormLogoPreview(reader.result);
    reader.onerror = () => showToast("ไม่สามารถอ่านไฟล์โลโก้ได้", "error");
    reader.readAsDataURL(file);
}

function markDormLogoForRemoval() {
    const input = document.getElementById("settingDormLogo");
    if (input) {
        input.value = "";
        input.dataset.removeLogo = "true";
    }
    setDormLogoPreview("");
}

function setDormLogoPreview(src) {
    const preview = document.getElementById("dormLogoPreview");
    const removeButton = document.getElementById("removeDormLogo");
    if (!preview) return;

    preview.src = src || "";
    preview.classList.toggle("hidden", !src);
    removeButton?.classList.toggle("hidden", !src);
}

function readDormLogo(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

function saveSettingsForm(event) {
    event.preventDefault();

    settings.electric_rate = Number(document.getElementById("settingElectricRate")?.value || 0);
    settings.water_rate = Number(document.getElementById("settingWaterRate")?.value || 0);
    settings.garbage_rate = Number(document.getElementById("settingGarbageRate")?.value || 0);
    settings.due_day = Number(document.getElementById("settingDueDay")?.value || 1);

    autoSave();
    const msg = document.getElementById("settingsMsg");
    msg?.classList.remove("hidden");
    setTimeout(() => msg?.classList.add("hidden"), 2000);
    showToast("บันทึกการตั้งค่าเรียบร้อย");
}

function renderMoveInFees() {
    const container = document.getElementById("moveInFeesContainer");
    if (!container) return;

    if (!rooms.length) {
        container.innerHTML = `<div class="empty-state">ยังไม่มีข้อมูลห้องพัก</div>`;
        return;
    }

    container.innerHTML = rooms.map(room => `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3 items-center border rounded-xl p-3">
            <div class="font-medium">ห้อง ${room.number}</div>
            <div class="md:col-span-2">
                <label class="text-sm text-gray-500 block mb-1">ค่าเข้าห้อง (บาท)</label>
                <input type="number" min="0" data-move-in-room="${room.id}" value="${Number(moveInFees[room.id] || 0)}">
            </div>
        </div>
    `).join("");
}

function saveMoveInFees() {
    document.querySelectorAll("[data-move-in-room]").forEach(input => {
        moveInFees[input.dataset.moveInRoom] = Number(input.value || 0);
    });

    autoSave();
    const msg = document.getElementById("moveInFeesMsg");
    msg?.classList.remove("hidden");
    setTimeout(() => msg?.classList.add("hidden"), 2000);
    showToast("บันทึกค่าเข้าห้องเรียบร้อย");
}
