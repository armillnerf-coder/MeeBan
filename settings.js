document.addEventListener("DOMContentLoaded", () => {
    initShared();
    if (!setupSharedPage("settings", "ตั้งค่า")) return;

    loadSettingsForm();
    renderMoveInFees();

    document.getElementById("dormInfoForm")?.addEventListener("submit", saveDormInfo);
    document.getElementById("settingsForm")?.addEventListener("submit", saveSettingsForm);

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

    document.getElementById("settingElectricRate").value = settings.electric_rate;
    document.getElementById("settingWaterRate").value = settings.water_rate;
    document.getElementById("settingGarbageRate").value = settings.garbage_rate;
    document.getElementById("settingDueDay").value = settings.due_day;
}

function saveDormInfo(event) {
    event.preventDefault();

    dormInfo = {
        name: document.getElementById("settingDormName")?.value.trim() || "หอNK",
        address: document.getElementById("settingDormAddress")?.value.trim() || "",
        phone: document.getElementById("settingDormPhone")?.value.trim() || ""
    };

    autoSave();
    applyDormBrand();

    const msg = document.getElementById("dormInfoMsg");
    msg?.classList.remove("hidden");
    setTimeout(() => msg?.classList.add("hidden"), 2000);
    showToast("บันทึกข้อมูลหอพักเรียบร้อย");
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
