const GAS_WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbwW4UNo_ly1DV9Pig639EBJywmlqLntDchMcTnEicgFi5O7amxA3TmQfiNpsqywgB2dpg/exec";

const EVENT_LAT = 12.6085414;
const EVENT_LNG = 102.119025;

const GEO_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 5000
};

/*
 * ห้ามเปลี่ยน key
 */
const DEVICE_STORAGE_KEY =
  "sch_device_id";

const STUDENT_STORAGE_KEY =
  "sch_current_student";

const SESSION_CHECK_INTERVAL =
  120000;

let currentStudent = null;
let sessionTimer = null;


/* =========================================================
   DEVICE ID MANAGEMENT
========================================================= */

function getOrCreateDeviceId() {
  let deviceId = localStorage.getItem(DEVICE_STORAGE_KEY);

  if (!deviceId) {
    const oldKeys = [
      "sch_device_id_v3",
      "sch_device_id_v4",
      "sch_device_id_v5",
      "sch_device_id_v6",
      "sch_device_id_v7",
      "sch_device_id_v8"
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
    deviceId =
      "DEV_" +
      Math.random().toString(36).substring(2, 12) +
      "_" +
      Date.now().toString(36);

    localStorage.setItem(DEVICE_STORAGE_KEY, deviceId);
  }

  return deviceId;
}

const deviceFingerprint = getOrCreateDeviceId();


/* =========================================================
   START / AUTO LOGIN
========================================================= */

window.addEventListener(
  "load",
  startApplication
);


async function startApplication() {
  let saved =
    localStorage.getItem(
      STUDENT_STORAGE_KEY
    );

  if (!saved) {
    const oldKeys = [
      "sch_current_student_v3",
      "sch_current_student_v4",
      "sch_current_student_v5",
      "sch_current_student_v6",
      "sch_current_student_v7",
      "sch_current_student_v8"
    ];

    for (
      let i = 0;
      i < oldKeys.length;
      i++
    ) {
      const old =
        localStorage.getItem(
          oldKeys[i]
        );

      if (old) {
        saved = old;
        localStorage.setItem(
          STUDENT_STORAGE_KEY,
          old
        );
        break;
      }
    }
  }

  if (!saved) {
    showLogin();
    return;
  }

  try {
    currentStudent =
      JSON.parse(
        saved
      );

    if (
      !currentStudent ||
      !currentStudent.studentId ||
      !currentStudent.grade ||
      !currentStudent.room
    ) {
      clearSavedLogin();
      showLogin();
      return;
    }

    showDashboard();
    startSessionMonitor();
    validateCurrentSession(true);

  } catch (err) {
    console.error(
      "AUTO LOGIN ERROR:",
      err
    );
    clearSavedLogin();
    showLogin();
  }
}


/* =========================================================
   SESSION
========================================================= */

async function validateCurrentSession(
  silent
) {
  if (!currentStudent) {
    return true;
  }

  try {
    const params =
      new URLSearchParams({
        action:
          "validateSession",
        grade:
          currentStudent.grade,
        room:
          currentStudent.room,
        studentId:
          currentStudent.studentId,
        deviceId:
          deviceFingerprint
      });

    const response =
      await fetch(
        GAS_WEB_APP_URL +
          "?" +
          params.toString() +
          "&_=" +
          Date.now(),
        {
          method: "GET",
          cache: "no-store"
        }
      );

    const result =
      await response.json();

    if (
      result.status ===
      "success"
    ) {
      return true;
    }

    if (
      result.forceLogout
    ) {
      clearSavedLogin();
      stopSessionMonitor();
      showLogin();

      if (!silent) {
        alert(
          result.message ||
          "Device ID ถูกยกเลิกแล้ว"
        );
      }

      return false;
    }

    return true;

  } catch (err) {
    console.warn(
      "SESSION ERROR:",
      err
    );
    return true;
  }
}


function startSessionMonitor() {
  stopSessionMonitor();

  sessionTimer =
    setInterval(
      function() {
        validateCurrentSession(
          true
        );
      },
      SESSION_CHECK_INTERVAL
    );
}


function stopSessionMonitor() {
  if (
    sessionTimer
  ) {
    clearInterval(
      sessionTimer
    );
    sessionTimer =
      null;
  }
}


/* =========================================================
   LOGIN
========================================================= */

async function login() {
  const grade =
    document
      .getElementById(
        "gradeInput"
      )
      .value
      .trim();

  const room =
    document
      .getElementById(
        "roomInput"
      )
      .value
      .trim();

  const studentId =
    document
      .getElementById(
        "studentIdInput"
      )
      .value
      .trim();

  const prefix =
    document
      .getElementById(
        "prefixInput"
      )
      ?.value
      .trim() ||
    "";

  const firstName =
    document
      .getElementById(
        "firstNameInput"
      )
      ?.value
      .trim() ||
    "";

  const lastName =
    document
      .getElementById(
        "lastNameInput"
      )
      ?.value
      .trim() ||
    "";

  const studentName =
    [
      prefix,
      firstName,
      lastName
    ]
      .filter(Boolean)
      .join(" ")
      .replace(
        /\s+/g,
        " "
      )
      .trim();

  const studentNo =
    document
      .getElementById(
        "studentNoInput"
      )
      ?.value
      .trim() ||
    "";

  if (
    !grade ||
    !room ||
    !studentId ||
    !studentName
  ) {
    alert(
      "กรุณากรอกข้อมูลให้ครบ"
    );
    return;
  }

  const btn =
    document.getElementById(
      "loginBtn"
    );

  btn.disabled =
    true;
  btn.innerText =
    "กำลังเข้าสู่ระบบ...";

  try {
    const params =
      new URLSearchParams({
        action:
          "login",
        grade:
          grade,
        room:
          room,
        studentId:
          studentId,
        studentName:
          studentName,
        deviceId:
          deviceFingerprint
      });

    const response =
      await fetch(
        GAS_WEB_APP_URL +
          "?" +
          params.toString() +
          "&_=" +
          Date.now(),
        {
          method: "GET",
          cache: "no-store"
        }
      );

    const result =
      await response.json();

    if (
      result.status !==
      "success"
    ) {
      alert(
        result.message ||
        "เข้าสู่ระบบไม่สำเร็จ"
      );
      return;
    }

    currentStudent = {
      grade:
        result.grade,
      room:
        result.room,
      studentId:
        studentId,
      studentName:
        result.studentName,
      studentNo:
        studentNo ||
        result.studentNo ||
        "-"
    };

    localStorage.setItem(
      STUDENT_STORAGE_KEY,
      JSON.stringify(
        currentStudent
      )
    );

    showDashboard();
    startSessionMonitor();

  } catch (err) {
    console.error(
      "LOGIN ERROR:",
      err
    );
    alert(
      "ไม่สามารถเชื่อมต่อระบบได้"
    );
  } finally {
    btn.disabled =
      false;
    btn.innerText =
      "เข้าสู่ระบบ";
  }
}


/* =========================================================
   UI
========================================================= */

function showLogin() {
  document
    .getElementById(
      "loginSection"
    )
    .classList.remove(
      "hidden"
    );

  document
    .getElementById(
      "dashboardSection"
    )
    .classList.add(
      "hidden"
    );
}


function showDashboard() {
  document
    .getElementById(
      "loginSection"
    )
    .classList.add(
      "hidden"
    );

  document
    .getElementById(
      "dashboardSection"
    )
    .classList.remove(
      "hidden"
    );

  document
    .getElementById(
      "studentNameText"
    )
    .textContent =
    currentStudent.studentName;

  document
    .getElementById(
      "studentDetailText"
    )
    .textContent =
    `ชั้น ${currentStudent.grade}/${currentStudent.room} | เลขที่ ${currentStudent.studentNo}`;

  loadStudentActivities();
}


/* =========================================================
   ACTIVITY STATUS
========================================================= */

async function loadStudentActivities() {
  const container =
    document.getElementById(
      "activityListContainer"
    );

  if (
    !container ||
    !currentStudent
  ) {
    return;
  }

  container.innerHTML =
    `<p class="text-xs text-slate-400 text-center py-2">
      กำลังโหลดข้อมูลกิจกรรม...
    </p>`;

  try {
    const params =
      new URLSearchParams({
        action:
          "getStudentActivities",
        studentId:
          currentStudent.studentId,
        grade:
          currentStudent.grade,
        room:
          currentStudent.room
      });

    const response =
      await fetch(
        GAS_WEB_APP_URL +
          "?" +
          params.toString() +
          "&_=" +
          Date.now(),
        {
          method: "GET",
          cache: "no-store"
        }
      );

    const data =
      await response.json();

    if (
      data.status !==
      "success"
    ) {
      container.innerHTML =
        `<p class="text-xs text-red-500 text-center py-2">
          ไม่สามารถโหลดสถานะได้
        </p>`;
      return;
    }

    container.innerHTML =
      "";

    data.activities.forEach(
      function(activity) {
        const item =
          document.createElement(
            "div"
          );

        item.className =
          "flex items-center justify-between gap-2 " +
          "p-2.5 rounded-xl border text-xs " +
          (
            activity.isFinished
              ? "bg-emerald-50/60 border-emerald-200"
              : "bg-slate-50 border-slate-200"
          );

        const left =
          document.createElement(
            "div"
          );

        left.className =
          "min-w-0 pr-2";

        const code =
          document.createElement(
            "span"
          );

        code.className =
          "font-bold text-slate-800";

        code.textContent =
          activity.code;

        const name =
          document.createElement(
            "span"
          );

        name.className =
          "text-slate-600";

        name.textContent =
          ": " +
          activity.name;

        left.appendChild(
          code
        );
        left.appendChild(
          name
        );

        const status =
          document.createElement(
            "span"
          );

        if (
          activity.isFinished
        ) {
          status.className =
            "px-2 py-1 bg-emerald-600 text-white rounded-md font-semibold";
          status.textContent =
            "เช็กอินแล้ว ✓";
        } else {
          status.className =
            "px-2 py-1 bg-slate-200 text-slate-600 rounded-md";
          status.textContent =
            "ยังไม่ได้เข้า (ขาด)";
        }

        item.appendChild(
          left
        );
        item.appendChild(
          status
        );

        container.appendChild(
          item
        );
      }
    );

  } catch (err) {
    console.error(
      err
    );
    container.innerHTML =
      `<p class="text-xs text-red-500 text-center py-2">
        ไม่สามารถโหลดสถานะได้
      </p>`;
  }
}


/* =========================================================
   CHECK-IN
========================================================= */

async function submitCheckin() {
  if (!currentStudent) {
    alert(
      "กรุณาเข้าสู่ระบบก่อน"
    );
    return;
  }

  const input =
    document.getElementById(
      "activityCodeInput"
    );

  const activityCode =
    input
      .value
      .trim()
      .toUpperCase();

  if (!activityCode) {
    alert(
      "กรุณากรอกรหัสกิจกรรม"
    );
    return;
  }

  const btn =
    document.getElementById(
      "checkinBtn"
    );

  btn.disabled =
    true;
  btn.innerText =
    "กำลังตรวจสอบกิจกรรม...";

  try {
    const params =
      new URLSearchParams({
        action:
          "checkActivity",
        activityCode:
          activityCode,
        studentId:
          currentStudent.studentId,
        grade:
          currentStudent.grade,
        room:
          currentStudent.room,
        deviceId:
          deviceFingerprint
      });

    const response =
      await fetch(
        GAS_WEB_APP_URL +
          "?" +
          params.toString() +
          "&_=" +
          Date.now(),
        {
          method: "GET",
          cache: "no-store"
        }
      );

    const result =
      await response.json();

    if (
      result.forceLogout
    ) {
      clearSavedLogin();
      stopSessionMonitor();
      showLogin();
      alert(
        result.message ||
        "Device ID ไม่ได้รับอนุญาต"
      );
      return;
    }

    if (
      result.status !==
      "success"
    ) {
      alert(
        result.message ||
        "ไม่สามารถเช็กอินได้"
      );
      return;
    }

    if (
      !navigator.geolocation
    ) {
      alert(
        "อุปกรณ์ไม่รองรับ GPS"
      );
      return;
    }

    btn.innerText =
      "กำลังระบุพิกัด GPS...";

    navigator.geolocation.getCurrentPosition(
      async function(position) {
        try {
          const lat =
            position.coords.latitude;
          const lng =
            position.coords.longitude;

          const distance =
            calculateDistance(
              EVENT_LAT,
              EVENT_LNG,
              lat,
              lng
            );

          if (
            distance >
            Number(
              result.maxRadius
            )
          ) {
            alert(
              "เช็กอินไม่สำเร็จ\n" +
              "คุณอยู่ห่างจากจุดกิจกรรม " +
              Math.round(
                distance
              ) +
              " เมตร"
            );
            return;
          }

          btn.innerText =
            "กำลังบันทึกเช็กอิน...";

          const payload = {
            grade:
              currentStudent.grade,
            room:
              currentStudent.room,
            studentId:
              currentStudent.studentId,
            activityCode:
              activityCode,
            activityName:
              result.activityName,
            latitude:
              lat,
            longitude:
              lng,
            deviceId:
              deviceFingerprint,
            timestamp:
              new Date()
                .toLocaleString(
                  "th-TH"
                )
          };

          const postResponse =
            await fetch(
              GAS_WEB_APP_URL,
              {
                method:
                  "POST",
                headers: {
                  "Content-Type":
                    "text/plain;charset=utf-8"
                },
                body:
                  JSON.stringify(
                    payload
                  )
              }
            );

          const postText =
            await postResponse.text();

          let postResult;

          try {
            postResult =
              JSON.parse(
                postText
              );
          } catch (err) {
            throw new Error(
              postText ||
              "Server ไม่ตอบ JSON"
            );
          }

          if (
            postResult.forceLogout
          ) {
            clearSavedLogin();
            stopSessionMonitor();
            showLogin();
            alert(
              postResult.message ||
              "Device ID ไม่ได้รับอนุญาต"
            );
            return;
          }

          if (
            postResult.status !==
            "success"
          ) {
            alert(
              postResult.message ||
              "เช็กอินไม่สำเร็จ"
            );
            return;
          }

          alert(
            "✅ เช็กอินกิจกรรมสำเร็จ!\n\n" +
            postResult.activityName
          );

          input.value =
            "";

          await loadStudentActivities();

        } catch (err) {
          console.error(
            "CHECK-IN ERROR:",
            err
          );
          alert(
            "เช็กอินไม่สำเร็จ: " +
            err.message
          );
        } finally {
          resetCheckinButton();
        }
      },

      function(error) {
        console.error(
          error
        );
        alert(
          "ไม่สามารถดึงตำแหน่ง GPS ได้ กรุณาเปิด Location"
        );
        resetCheckinButton();
      },

      GEO_OPTIONS
    );

  } catch (err) {
    console.error(
      err
    );
    alert(
      "เกิดข้อผิดพลาด: " +
      err.message
    );
    resetCheckinButton();
  }
}


/* =========================================================
   BUTTON
========================================================= */

function resetCheckinButton() {
  const btn =
    document.getElementById(
      "checkinBtn"
    );

  if (!btn) {
    return;
  }

  btn.disabled =
    false;
  btn.innerText =
    "📍 ยืนยันเช็กอินกิจกรรม";
}


/* =========================================================
   CLEAR LOGIN
========================================================= */

function clearSavedLogin() {
  localStorage.removeItem(
    STUDENT_STORAGE_KEY
  );
  currentStudent =
    null;
}


/* =========================================================
   GPS
========================================================= */

function calculateDistance(
  lat1,
  lon1,
  lat2,
  lon2
) {
  const R =
    6371000;

  const dLat =
    (
      lat2 -
      lat1
    ) *
    Math.PI /
    180;

  const dLon =
    (
      lon2 -
      lon1
    ) *
    Math.PI /
    180;

  const a =
    Math.sin(
      dLat / 2
    ) *
    Math.sin(
      dLat / 2
    ) +

    Math.cos(
      lat1 *
      Math.PI /
      180
    ) *

    Math.cos(
      lat2 *
      Math.PI /
      180
    ) *

    Math.sin(
      dLon / 2
    ) *
    Math.sin(
      dLon / 2
    );

  return (
    R *
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(
        1 - a
      )
    )
  );
}