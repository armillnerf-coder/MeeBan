document.addEventListener("DOMContentLoaded", () => {
    initShared();

    const $ = id => document.getElementById(id);
    const loginForm = $("loginForm");
    const signupForm = $("signupForm");
    const statusPanel = $("statusPanel");

    const SUBTITLES = {
        login: "กรุณาเข้าสู่ระบบ",
        signup: "สมัครสมาชิก (ต้องรอเจ้าของหอพักอนุมัติ)",
        status: "สถานะบัญชี"
    };

    function showMode(mode) {
        loginForm?.classList.toggle("hidden", mode !== "login");
        signupForm?.classList.toggle("hidden", mode !== "signup");
        statusPanel?.classList.toggle("hidden", mode !== "status");
        if ($("loginSubtitle")) $("loginSubtitle").textContent = SUBTITLES[mode];
    }

    function showError(id, message) {
        const box = $(id);
        if (!box) return;
        box.textContent = message;
        box.classList.remove("hidden");
    }

    function clearErrors() {
        ["loginError", "signupError"].forEach(id => $(id)?.classList.add("hidden"));
    }

    function showStatus(role) {
        const messages = {
            pending: [
                "บัญชีรอการอนุมัติ",
                "สมัครสมาชิกเรียบร้อยแล้ว กรุณารอเจ้าของหอพักอนุมัติ แล้วกลับมาเข้าสู่ระบบอีกครั้ง"
            ],
            rejected: [
                "บัญชีนี้ไม่ได้รับอนุมัติ",
                "เจ้าของหอพักไม่อนุมัติบัญชีนี้ หากคิดว่าเกิดความผิดพลาดกรุณาติดต่อเจ้าของหอพัก"
            ],
            unknown: [
                "ตรวจสอบสิทธิ์ไม่สำเร็จ",
                "ไม่สามารถอ่านข้อมูลบัญชีได้ กรุณาลองใหม่อีกครั้ง หรือติดต่อเจ้าของหอพัก"
            ]
        };
        const [title, text] = messages[role] || messages.unknown;
        $("statusTitle").textContent = title;
        $("statusText").textContent = text;
        showMode("status");
    }

    function goDashboard() {
        location.href = "pages/dashboard.html";
    }

    // ถ้าล็อกอินและได้รับอนุมัติแล้วให้ข้ามไปหน้า dashboard
    // ถ้าล็อกอินแล้วแต่ยังไม่ได้รับอนุมัติ ให้แสดงสถานะบัญชี
    window.meeAuthGuard?.then(user => {
        if (user) {
            goDashboard();
            return;
        }
        if (window.meeCurrentUser()) {
            showStatus(window.meeProfile?.role || "unknown");
        }
    });

    $("showSignup")?.addEventListener("click", () => { clearErrors(); showMode("signup"); });
    $("showLogin")?.addEventListener("click", () => { clearErrors(); showMode("login"); });

    $("statusLogout")?.addEventListener("click", async () => {
        await window.meeSignOut();
        clearLocalData();
        showMode("login");
    });

    /* ---------- เข้าสู่ระบบ ---------- */
    const loginButton = loginForm?.querySelector("button[type='submit']");

    loginForm?.addEventListener("submit", async event => {
        event.preventDefault();
        clearErrors();

        const email = $("loginUser")?.value.trim() || "";
        const password = $("loginPass")?.value || "";

        if (!email || !password) {
            showError("loginError", "กรุณากรอกอีเมลและรหัสผ่าน");
            return;
        }

        if (loginButton) loginButton.disabled = true;

        try {
            const credential = await meeSignIn(email, password);

            let profile = null;
            try {
                profile = await meeEnsureProfile(credential.user);
            } catch (error) {
                console.error("[MEEBAN] Profile load failed:", error);
            }

            if (isApprovedRole(profile?.role)) {
                goDashboard();
            } else {
                showStatus(profile?.role || "unknown");
            }
        } catch (error) {
            console.error("[MEEBAN] Sign-in failed:", error?.code || error);
            showError("loginError", meeAuthErrorMessage(error));
        } finally {
            if (loginButton) loginButton.disabled = false;
        }
    });

    /* ---------- สมัครสมาชิก ---------- */
    const signupButton = signupForm?.querySelector("button[type='submit']");

    signupForm?.addEventListener("submit", async event => {
        event.preventDefault();
        clearErrors();

        const email = $("signupEmail")?.value.trim() || "";
        const password = $("signupPass")?.value || "";
        const confirm = $("signupPass2")?.value || "";

        if (password.length < 8) {
            showError("signupError", "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
            return;
        }
        if (password !== confirm) {
            showError("signupError", "รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน");
            return;
        }

        if (signupButton) signupButton.disabled = true;

        try {
            await meeSignUp(email, password);
            signupForm.reset();
            showStatus("pending");
        } catch (error) {
            console.error("[MEEBAN] Sign-up failed:", error?.code || error);
            showError("signupError", meeAuthErrorMessage(error));
        } finally {
            if (signupButton) signupButton.disabled = false;
        }
    });
});
