document.addEventListener("DOMContentLoaded", () => {
    initShared();

    // ถ้าล็อกอินอยู่แล้วให้ข้ามไปหน้า dashboard
    window.meeAuthGuard?.then(user => {
        if (user) location.href = "pages/dashboard.html";
    });

    const form = document.getElementById("loginForm");
    const errorBox = document.getElementById("loginError");
    const submitButton = form?.querySelector("button[type='submit']");

    const showLoginError = message => {
        if (!errorBox) return;
        errorBox.textContent = message;
        errorBox.classList.remove("hidden");
    };

    form?.addEventListener("submit", async event => {
        event.preventDefault();
        errorBox?.classList.add("hidden");

        const email = document.getElementById("loginUser")?.value.trim() || "";
        const password = document.getElementById("loginPass")?.value || "";

        if (!email || !password) {
            showLoginError("กรุณากรอกอีเมลและรหัสผ่าน");
            return;
        }

        if (submitButton) submitButton.disabled = true;

        try {
            await meeSignIn(email, password);
            location.href = "pages/dashboard.html";
        } catch (error) {
            console.error("[MEEBAN] Sign-in failed:", error?.code || error);
            showLoginError(meeAuthErrorMessage(error));
            if (submitButton) submitButton.disabled = false;
        }
    });
});
