document.addEventListener("DOMContentLoaded", () => {
    initShared();

    if (isLoggedIn) {
        location.href = "pages/dashboard.html";
        return;
    }

    const form = document.getElementById("loginForm");
    form?.addEventListener("submit", event => {
        event.preventDefault();

        const username = document.getElementById("loginUser")?.value.trim() || "";
        const password = document.getElementById("loginPass")?.value || "";

        if (username === "admin" && password === "1234") {
            localStorage.setItem(STORAGE_KEYS.auth, "true");
            isLoggedIn = true;
            location.href = "pages/dashboard.html";
        } else {
            showToast("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง", "error");
        }
    });
});
