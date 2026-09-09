// =========================================================
// 1. FIREBASE CONFIGURATION
// =========================================================
// นำ Config จาก Firebase Console -> Project Settings มาวางตรงนี้
const firebaseConfig = {
  apiKey: "AIzaSyDx_7PZq_Xz49LXXlHAR06M-WvpTJQ-ag8",
  authDomain: "sm-student-council.firebaseapp.com",
  databaseURL: "https://sm-student-council-default-rtdb.firebaseio.com",
  projectId: "sm-student-council",
  storageBucket: "sm-student-council.firebasestorage.app",
  messagingSenderId: "445379179765",
  appId: "1:445379179765:web:69db77cd7b24c8530301bc",
  measurementId: "G-KGZSNERXWK"
};

// Initialize Firebase & Firestore
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// =========================================================
// 2. CONSTANTS & CONFIG
// =========================================================
const EVENT_LAT = 12.6085414;
const EVENT_LNG = 102.119025;

const GEO_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 5000
};

const DEVICE_STORAGE_KEY = "sch_device_id";
const STUDENT_STORAGE_KEY = "sch_current_student";
const SESSION_CHECK_INTERVAL = 120000;

let currentStudent = null;
let sessionTimer = null;

/* =========================================================
   DEVICE ID MANAGEMENT
========================================================= */
function getOrCreateDeviceId() {
  let deviceId = localStorage.getItem(DEVICE_STORAGE_KEY);

  if (!deviceId) {
    const oldKeys = [
      "sch_device_id_v3", "sch_device_id_v4", "sch_device_id_v5",
      "sch_device_id_v6", "sch_device_id_v7", "sch_device_id_v8"
    ];

    for (let i = 0; i < oldKeys.length; i++) {
      const oldId = localStorage.getItem(oldKeys[i]);
      if (oldId) {
        deviceId = oldId;
        localStorage.setItem(DEVICE_STORAGE_KEY, deviceId);
        break;
      }
    }
  }

  if (!deviceId) {
    deviceId = "DEV_" + Math.random().toString(36).substring(2, 12) + "_" + Date.now().toString(36);
    localStorage.setItem(DEVICE_STORAGE_KEY, deviceId);
  }

  return deviceId;
}

const deviceFingerprint = getOrCreateDeviceId();

/* =========================================================
   START / AUTO LOGIN
========================================================= */
window.addEventListener("load", startApplication);

async function startApplication() {
  let saved = localStorage.getItem(STUDENT_STORAGE_KEY);

  if (!saved) {
    const oldKeys = [
      "sch_current_student_v3", "sch_current_student_v4", "sch_current_student_v5",
      "sch_current_student_v6", "sch_current_student_v7", "sch_current_student_v8"
    ];

    for (let i = 0; i < oldKeys.length; i++) {
      const old = localStorage.getItem(oldKeys[i]);
      if (old) {
        saved = old;
        localStorage.setItem(STUDENT_STORAGE_KEY, old);
        break;
      }
    }
  }

  if (!saved) {
    showLogin();
    return;
  }

  try {
    currentStudent = JSON.parse(saved);

    if (!currentStudent || !currentStudent.studentId || !currentStudent.grade || !currentStudent.room) {
      clearSavedLogin();
      showLogin();
      return;
    }

    showDashboard();
    startSessionMonitor();
    validateCurrentSession(true);

  } catch (err) {
    console.error("AUTO LOGIN ERROR:", err);
    clearSavedLogin();
    showLogin();
  }
}

/* =========================================================
   SESSION MONITOR (FIRESTORE)
========================================================= */
async function validateCurrentSession(silent) {
  if (!currentStudent) return true;

  try {
    // ตรวจสอบ Device Binding จาก Document ID: {studentId} ใน Collection "students"
    const docRef = db.collection("students").doc(currentStudent.studentId);
    const docSnap = await docRef.get();

    if (docSnap.exists) {
      const studentData = docSnap.data();
      // ถ้าเครื่องนี้ Device ID ไม่ตรงกับที่ผูกไว้ในระบบ
      if (studentData.deviceId && studentData.deviceId !== deviceFingerprint) {
        clearSavedLogin();
        stopSessionMonitor();
        showLogin();

        if (!silent) {
          alert("สิทธิ์การใช้งานอุปกรณ์นี้ถูกยกเลิกเนื่องจากมีการเข้าสู่ระบบจากเครื่องอื่น");
        }
        return false;
      }
    }
    return true;

  } catch (err) {
    console.warn("SESSION ERROR:", err);
    return true;
  }
}

function startSessionMonitor() {
  stopSessionMonitor();
  sessionTimer = setInterval(() => {
    validateCurrentSession(true);
  }, SESSION_CHECK_INTERVAL);
}

function stopSessionMonitor() {
  if (sessionTimer) {
    clearInterval(sessionTimer);
    sessionTimer = null;
  }
}

/* =========================================================
   LOGIN (FIRESTORE)
========================================================= */
async function login() {
  const grade = document.getElementById("gradeInput")?.value.trim();
  const room = document.getElementById("roomInput")?.value.trim();
  const studentId = document.getElementById("studentIdInput")?.value.trim();
  const prefix = document.getElementById("prefixInput")?.value.trim() || "";
  const firstName = document.getElementById("firstNameInput")?.value.trim() || "";
  const lastName = document.getElementById("lastNameInput")?.value.trim() || "";

  const studentName = [prefix, firstName, lastName].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  const studentNo = document.getElementById("studentNoInput")?.value.trim() || "";

  if (!grade || !room || !studentId || !studentName) {
    alert("กรุณากรอกข้อมูลให้ครบถ้วน");
    return;
  }

  const btn = document.getElementById("loginBtn");
  btn.disabled = true;
  btn.innerText = "กำลังเข้าสู่ระบบ...";

  try {
    const studentRef = db.collection("students").doc(studentId);
    const docSnap = await studentRef.get();

    if (docSnap.exists) {
      const data = docSnap.data();
      // หากมีการผูก Device ID ไว้แล้ว และไม่ตรงกับเครื่องปัจจุบัน
      if (data.deviceId && data.deviceId !== deviceFingerprint) {
        alert("รหัสนักเรียนนี้ถูกผูกไว้กับอุปกรณ์อื่นแล้ว");
        return;
      }
    }

    // บันทึก/อัปเดตข้อมูลนักเรียนและผูก Device ID
    await studentRef.set({
      studentId: studentId,
      studentName: studentName,
      grade: grade,
      room: room,
      studentNo: studentNo || "-",
      deviceId: deviceFingerprint,
      lastLogin: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    currentStudent = {
      grade: grade,
      room: room,
      studentId: studentId,
      studentName: studentName,
      studentNo: studentNo || "-"
    };

    localStorage.setItem(STUDENT_STORAGE_KEY, JSON.stringify(currentStudent));

    showDashboard();
    startSessionMonitor();

  } catch (err) {
    console.error("LOGIN ERROR:", err);
    alert("ไม่สามารถเชื่อมต่อระบบได้: " + err.message);
  } finally {
    btn.disabled = false;
    btn.innerText = "เข้าสู่ระบบ";
  }
}

/* =========================================================
   UI MANAGEMENT
========================================================= */
function showLogin() {
  document.getElementById("loginSection")?.classList.remove("hidden");
  document.getElementById("dashboardSection")?.classList.add("hidden");
}

function showDashboard() {
  document.getElementById("loginSection")?.classList.add("hidden");
  document.getElementById("dashboardSection")?.classList.remove("hidden");

  const nameEl = document.getElementById("studentNameText");
  const detailEl = document.getElementById("studentDetailText");

  if (nameEl) nameEl.textContent = currentStudent.studentName;
  if (detailEl) detailEl.textContent = `ชั้น ${currentStudent.grade}/${currentStudent.room} | เลขที่ ${currentStudent.studentNo}`;

  loadStudentActivities();
}

/* =========================================================
   ACTIVITY STATUS (FIRESTORE)
========================================================= */
async function loadStudentActivities() {
  const container = document.getElementById("activityListContainer");
  if (!container || !currentStudent) return;

  container.innerHTML = `<p class="text-xs text-slate-400 text-center py-2">กำลังโหลดข้อมูลกิจกรรม...</p>`;

  try {
    // 1. ดึงรายการกิจกรรมทั้งหมดที่เปิดใช้งาน
    const activitiesSnap = await db.collection("activities").get();
    
    // 2. ดึงประวัติการเช็กอินของนักเรียนคนนี้
    const checkinsSnap = await db.collection("checkins")
      .where("studentId", "==", currentStudent.studentId)
      .get();

    const checkedActivityCodes = new Set();
    checkinsSnap.forEach(doc => {
      checkedActivityCodes.add(doc.data().activityCode);
    });

    if (activitiesSnap.empty) {
      container.innerHTML = `<p class="text-xs text-slate-400 text-center py-2">ยังไม่มีรายการกิจกรรมในระบบ</p>`;
      return;
    }

    container.innerHTML = "";

    activitiesSnap.forEach(doc => {
      const activity = doc.data();
      const isFinished = checkedActivityCodes.has(activity.code);

      const item = document.createElement("div");
      item.className = "flex items-center justify-between gap-2 p-2.5 rounded-xl border text-xs " +
        (isFinished ? "bg-emerald-50/60 border-emerald-200" : "bg-slate-50 border-slate-200");

      const left = document.createElement("div");
      left.className = "min-w-0 pr-2";

      const code = document.createElement("span");
      code.className = "font-bold text-slate-800";
      code.textContent = activity.code;

      const name = document.createElement("span");
      name.className = "text-slate-600";
      name.textContent = ": " + (activity.name || "");

      left.appendChild(code);
      left.appendChild(name);

      const status = document.createElement("span");
      if (isFinished) {
        status.className = "px-2 py-1 bg-emerald-600 text-white rounded-md font-semibold";
        status.textContent = "เช็กอินแล้ว ✓";
      } else {
        status.className = "px-2 py-1 bg-slate-200 text-slate-600 rounded-md";
        status.textContent = "ยังไม่ได้เข้า (ขาด)";
      }

      item.appendChild(left);
      item.appendChild(status);
      container.appendChild(item);
    });

  } catch (err) {
    console.error("LOAD ACTIVITIES ERROR:", err);
    container.innerHTML = `<p class="text-xs text-red-500 text-center py-2">ไม่สามารถโหลดสถานะได้</p>`;
  }
}

/* =========================================================
   CHECK-IN (FIRESTORE)
========================================================= */
async function submitCheckin() {
  if (!currentStudent) {
    alert("กรุณาเข้าสู่ระบบก่อน");
    return;
  }

  const input = document.getElementById("activityCodeInput");
  const activityCode = input?.value.trim().toUpperCase();

  if (!activityCode) {
    alert("กรุณากรอกรหัสกิจกรรม");
    return;
  }

  const btn = document.getElementById("checkinBtn");
  btn.disabled = true;
  btn.innerText = "กำลังตรวจสอบกิจกรรม...";

  try {
    // 1. ตรวจสอบว่ามีรหัสกิจกรรมนี้ใน Firestore หรือไม่
    const activityDoc = await db.collection("activities").doc(activityCode).get();

    if (!activityDoc.exists) {
      alert("ไม่พบรหัสกิจกรรมนี้ในระบบ");
      resetCheckinButton();
      return;
    }

    const activityData = activityDoc.data();
    const maxRadius = Number(activityData.maxRadius || 100);

    // 2. ตรวจสอบ GPS
    if (!navigator.geolocation) {
      alert("อุปกรณ์ไม่รองรับ GPS");
      resetCheckinButton();
      return;
    }

    btn.innerText = "กำลังระบุพิกัด GPS...";

    navigator.geolocation.getCurrentPosition(
      async function(position) {
        try {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;

          const distance = calculateDistance(EVENT_LAT, EVENT_LNG, lat, lng);

          if (distance > maxRadius) {
            alert(`เช็กอินไม่สำเร็จ\nคุณอยู่ห่างจากจุดกิจกรรม ${Math.round(distance)} เมตร (ระยะที่อนุญาต: ${maxRadius} เมตร)`);
            resetCheckinButton();
            return;
          }

          btn.innerText = "กำลังบันทึกเช็กอิน...";

          // 3. ตรวจสอบการเช็กอินซ้ำ
          const checkinRef = db.collection("checkins").doc(`${currentStudent.studentId}_${activityCode}`);
          const checkinSnap = await checkinRef.get();

          if (checkinSnap.exists) {
            alert("คุณได้เช็กอินกิจกรรมนี้ไปแล้ว");
            resetCheckinButton();
            return;
          }

          // 4. บันทึกข้อมูลเช็กอินลง Firestore
          await checkinRef.set({
            studentId: currentStudent.studentId,
            studentName: currentStudent.studentName,
            grade: currentStudent.grade,
            room: currentStudent.room,
            studentNo: currentStudent.studentNo,
            activityCode: activityCode,
            activityName: activityData.name || activityCode,
            latitude: lat,
            longitude: lng,
            deviceId: deviceFingerprint,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            formattedTime: new Date().toLocaleString("th-TH")
          });

          alert(`✅ เช็กอินกิจกรรมสำเร็จ!\n\n${activityData.name || activityCode}`);
          if (input) input.value = "";

          await loadStudentActivities();

        } catch (err) {
          console.error("CHECK-IN SAVE ERROR:", err);
          alert("เช็กอินไม่สำเร็จ: " + err.message);
        } finally {
          resetCheckinButton();
        }
      },
      function(error) {
        console.error("GPS ERROR:", error);
        alert("ไม่สามารถดึงตำแหน่ง GPS ได้ กรุณาเปิด Location");
        resetCheckinButton();
      },
      GEO_OPTIONS
    );

  } catch (err) {
    console.error("CHECK-IN ERROR:", err);
    alert("เกิดข้อผิดพลาด: " + err.message);
    resetCheckinButton();
  }
}

/* =========================================================
   BUTTON & UTILS
========================================================= */
function resetCheckinButton() {
  const btn = document.getElementById("checkinBtn");
  if (!btn) return;
  btn.disabled = false;
  btn.innerText = "📍 ยืนยันเช็กอินกิจกรรม";
}

function clearSavedLogin() {
  localStorage.removeItem(STUDENT_STORAGE_KEY);
  currentStudent = null;
}

/* =========================================================
   GPS CALCULATION
========================================================= */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // รัศมีโลก (เมตร)
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
