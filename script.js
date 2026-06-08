// ============================================================
//  STATE
// ============================================================
let entries = JSON.parse(localStorage.getItem("wr2_entries") || "[]");
let chipState = {
  "grp-size": "",
  "grp-cond": "",
  "grp-ka": "2",
  "grp-naoh-meas": "yes",
  "grp-dt": "no",
};
let dtType = "";

// ============================================================
//  INIT
// ============================================================
(function init() {
  const today = new Date();
  document.getElementById("hd-date").value = today.toISOString().split("T")[0];
  const hh = String(today.getHours()).padStart(2, "0");
  const timeVal = hh + ":00";
  const timeEl = document.getElementById("f-time");
  if ([...timeEl.options].some((o) => o.value === timeVal))
    timeEl.value = timeVal;
  document.getElementById("cur-time-badge").textContent = timeVal;

  updateSheetBadge();
  const savedUrl = localStorage.getItem("sheet_url_washer2");
  if (savedUrl) document.getElementById("sheet-url-input").value = savedUrl;

  fetchPrevHour();

  setInterval(() => {
    const n = new Date();
    document.getElementById("cur-time-badge").textContent =
      String(n.getHours()).padStart(2, "0") + ":00";
  }, 60000);
})();

// ============================================================
//  TABS
// ============================================================
function switchTab(name, btn) {
  document
    .querySelectorAll(".page")
    .forEach((p) => p.classList.remove("active"));
  document
    .querySelectorAll(".tab-btn")
    .forEach((b) => b.classList.remove("active"));
  document.getElementById("tab-" + name).classList.add("active");
  btn.classList.add("active");
  if (name === "log") loadDailyLog();
}

// ============================================================
//  CHIP SELECTORS
// ============================================================
function selectChip(groupId, el, val) {
  const parent = document.getElementById(groupId) || el.parentElement;
  parent.querySelectorAll(".chip").forEach((c) => c.classList.remove("on"));
  el.classList.add("on");
  chipState[groupId] = val;
  if (groupId === "grp-cond") {
    // Update CCP temp criterion label
    const isOld = val === "ขวดเก่า";
    document.getElementById("ccp-temp-crit").textContent = isOld
      ? "(ขวดเก่า: ≥ 80°C)"
      : "(ขวดใหม่: ตามที่กำหนด)";
    checkCCP();
  }
}

function selectDtType(el, val) {
  document
    .querySelectorAll("#grp-dt-type .dt-chip")
    .forEach((c) => c.classList.remove("on"));
  el.classList.add("on");
  dtType = val;
}

// ============================================================
//  COLLAPSIBLE
// ============================================================
function toggleColl(head) {
  head.classList.toggle("open");
  head.nextElementSibling.classList.toggle("open");
}

// ============================================================
//  AUTO-SYNC CCP2 FROM BATH 1
// ============================================================
function syncCCP() {
  const c1p = document.getElementById("b-c1-pres").value;
  const c1n = document.getElementById("b-c1-naoh").value;
  const c1t = document.getElementById("b-c1-temp").value;
  const ph = document.getElementById("f-ph").value;
  // Only auto-fill if empty
  if (c1p && !document.getElementById("ccp-pres").value)
    document.getElementById("ccp-pres").value = c1p;
  if (c1n && !document.getElementById("ccp-naoh").value)
    document.getElementById("ccp-naoh").value = c1n;
  if (c1t && !document.getElementById("ccp-temp").value)
    document.getElementById("ccp-temp").value = c1t;
  if (ph && !document.getElementById("ccp-ph").value)
    document.getElementById("ccp-ph").value = ph;
  checkCCP();
}

// ============================================================
//  CCP CHECK (real-time)
// ============================================================
function checkCCP() {
  const p = parseFloat(document.getElementById("ccp-pres").value);
  const n = parseFloat(document.getElementById("ccp-naoh").value);
  const ph = parseFloat(document.getElementById("ccp-ph").value);
  const t = parseFloat(document.getElementById("ccp-temp").value);
  const isOld = chipState["grp-cond"] === "ขวดเก่า";
  const measN = chipState["grp-naoh-meas"] === "yes";
  let anyFail = false;

  if (!isNaN(p)) {
    const ok = p >= 1.0;
    setBadge("badge-pres", ok);
    if (!ok) anyFail = true;
  } else hideBadge("badge-pres");

  if (!isNaN(n) && measN) {
    const ok = isOld ? n >= 1.8 && n <= 3.0 : n >= 0.2 && n <= 0.6;
    setBadge("badge-naoh", ok);
    if (!ok) anyFail = true;
  } else hideBadge("badge-naoh");

  if (!isNaN(ph)) {
    const ok = ph >= 6.5 && ph <= 8.5;
    setBadge("badge-ph", ok);
    if (!ok) anyFail = true;
  } else hideBadge("badge-ph");

  if (!isNaN(t)) {
    const ok = isOld ? t >= 80 : true;
    setBadge("badge-temp", ok);
    if (!ok) anyFail = true;
  } else hideBadge("badge-temp");

  document.getElementById("nc-wrap").style.display = anyFail ? "block" : "none";
}

function setBadge(id, pass) {
  const el = document.getElementById(id);

  if (!el) return;

  el.style.display = "inline-block";
  el.className = "ccp-badge " + (pass ? "pass" : "fail");
  el.textContent = pass ? "✅ ผ่าน" : "❌ ไม่ผ่าน";
}

function hideBadge(id) {
  const el = document.getElementById(id);

  if (!el) return;

  el.style.display = "none";
}

// ============================================================
//  WATER METER CALC
// ============================================================
function calcWater() {
  const b = parseFloat(document.getElementById("d-meter-before").value) || 0;
  const a = parseFloat(document.getElementById("d-meter-after").value) || 0;
  document.getElementById("d-meter-used").value = Math.max(0, a - b).toFixed(1);
}

// ============================================================
//  PREVIOUS HOUR DISPLAY
// ============================================================
function renderPrev(data) {
  const block = document.getElementById("prev-block");
  const prev =
    data || (entries.length > 0 ? entries[entries.length - 1] : null);
  if (!prev) {
    block.innerHTML =
      '<div class="no-prev">ยังไม่มีข้อมูลก่อนหน้า (ชั่วโมงนี้เป็นชั่วโมงแรก)</div>';
    return;
  }
  const dt = prev.hasDT
    ? `<div class="prev-chip" style="background:#fee2e2;border-color:#fca5a5;">DOWN แบบ${prev.dtType}</div>`
    : "";
  block.innerHTML = `
          <div class="prev-row">
            <div class="prev-row-label">📌 ข้อมูลเวลา ${prev.time} น.</div>
            <div class="prev-row-data">
              <div class="prev-chip">ขวด/ชม. <span>${Number(prev.bph || 0).toLocaleString()}</span></div>
              <div class="prev-chip">C1 Temp <span>${prev.c1Temp || "—"}°C</span></div>
              <div class="prev-chip">C1 Press <span>${prev.c1Pres || "—"} bar</span></div>
              <div class="prev-chip">C1 NaOH <span>${prev.c1Naoh || "—"}%</span></div>
              <div class="prev-chip">pH <span>${prev.ph || "—"}</span></div>
              <div class="prev-chip">CCP แรงดัน <span>${prev.ccpPres || "—"} bar</span></div>
              ${dt}
            </div>
          </div>`;
}

function fetchPrevHour() {
  const url = localStorage.getItem("sheet_url_washer2");
  const date = document.getElementById("hd-date").value;
  if (!url || !date) {
    renderPrev(null);
    return;
  }
  fetch(url + "?action=prevLog&date=" + encodeURIComponent(date))
    .then((r) => r.json())
    .then((res) => renderPrev(res.status === "ok" ? res.data : null))
    .catch(() => renderPrev(null));
}

async function loadDailyLog() {
  const url = localStorage.getItem("sheet_url_washer2");

  if (!url) {
    showToast("⚠️ ยังไม่ได้ตั้งค่า GAS URL");
    return;
  }

  const date = document.getElementById("hd-date").value;

  try {
    const res = await fetch(
      url + "?action=dailyLog&date=" + encodeURIComponent(date),
    );

    const resData = await res.json();

    renderLog(resData.data || []);
  } catch (err) {
    console.error(err);
    showToast("❌ โหลดข้อมูลไม่สำเร็จ");
  }
}

// ============================================================
//  SAVE ENTRY
// ============================================================
function saveEntry() {
  const time = document.getElementById("f-time").value;
  if (!time) {
    alert("กรุณาเลือกเวลา");
    return;
  }

  const hasDT = chipState["grp-dt"] === "yes";

  // Helper ป้องกัน Error เวลาหาช่องไม่เจอ
  const getVal = (id) =>
    document.getElementById(id) ? document.getElementById(id).value : "";

  const entry = {
    // header
    date: getVal("hd-date"),
    line: getVal("hd-line"),
    liquor: getVal("hd-liquor"),
    bottleSize: chipState["grp-size"],
    bottleCond: chipState["grp-cond"],
    ka: chipState["grp-ka"],
    startTime: getVal("hd-start"),
    stopTime: getVal("hd-stop"),
    // hourly production
    time,
    bph: getVal("f-bph"),
    // Caustic Bath 1
    c1Temp: getVal("b-c1-temp"),
    c1Pres: getVal("b-c1-pres"),
    c1Naoh: getVal("b-c1-naoh"),
    // Caustic Bath 2
    c2Temp: getVal("b-c2-temp"),
    c2Pres: getVal("b-c2-pres"),
    // Warm Water
    w1Temp: getVal("b-w1-temp"),
    w1Pres: getVal("b-w1-pres"),
    w2Temp: getVal("b-w2-temp"),
    w2Pres: getVal("b-w2-pres"),
    // Cold Water & Fresh Water (อัปเดต ID ใหม่แล้ว)
    cwTemp: getVal("b-cold-temp"),
    cwPres: getVal("b-cold-pres"),
    fwTemp: getVal("b-fresh-temp"),
    fwPres: getVal("b-fresh-pres"),
    // pH
    ph: getVal("f-ph") || "7.1",
    // CCP2
    ccpPres: getVal("ccp-pres"),
    ccpNaoh: chipState["grp-naoh-meas"] === "yes" ? getVal("ccp-naoh") : "",
    ccpPh: getVal("ccp-ph") || "7.1",
    ccpTemp: getVal("ccp-temp"),
    ccpNC: getVal("f-ccp-nc").trim(),
    // Downtime
    hasDT,
    dtType: hasDT ? dtType : "",
    dtStart: hasDT ? getVal("dt-start") : "",
    dtEnd: hasDT ? getVal("dt-end") : "",
    dtCause: hasDT ? getVal("dt-cause").trim() : "",
    // misc
    remark: getVal("f-remark").trim(),
    operator: getVal("sig-operator").trim(),
    checker: getVal("sig-checker").trim(),
    supervisor: getVal("sig-supervisor").trim(),
    ts: Date.now(),
  };

  entries.push(entry);
  // localStorage.setItem("wr2_entries", JSON.stringify(entries));

  // Reset per-hour fields
  const resetIds = [
    "f-bph",
    "b-c1-temp",
    "b-c1-naoh",
    "b-c2-temp",
    "b-w1-temp",
    "b-w2-temp",
    "b-cold-temp",
    "b-fresh-temp",
    "f-ph",
    "ccp-pres",
    "ccp-naoh",
    "ccp-ph",
    "ccp-temp",
    "f-ccp-nc",
    "f-remark",
    "dt-start",
    "dt-end",
    "dt-cause",
  ];

  resetIds.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset pressure fields to their defaults
  if (document.getElementById("b-c1-pres"))
    document.getElementById("b-c1-pres").value = "2.2";
  if (document.getElementById("b-c2-pres"))
    document.getElementById("b-c2-pres").value = "1.2";
  if (document.getElementById("b-w1-pres"))
    document.getElementById("b-w1-pres").value = "0.5";
  if (document.getElementById("b-w2-pres"))
    document.getElementById("b-w2-pres").value = "0.5";
  if (document.getElementById("b-cold-pres"))
    document.getElementById("b-cold-pres").value = "1.5";
  if (document.getElementById("b-fresh-pres"))
    document.getElementById("b-fresh-pres").value = "1.5";

  ["badge-pres", "badge-naoh", "badge-ph", "badge-temp"].forEach(hideBadge);
  if (document.getElementById("nc-wrap"))
    document.getElementById("nc-wrap").style.display = "none";

  // Reset DT
  const dtChip = document.querySelector("#grp-dt .chip");
  if (dtChip) selectChip("grp-dt", dtChip, "no");
  const dtSec = document.getElementById("dt-section");
  if (dtSec) dtSec.classList.remove("show");
  document
    .querySelectorAll("#grp-dt-type .dt-chip")
    .forEach((c) => c.classList.remove("on"));
  dtType = "";

  // Reset NaOH measurement toggle to 'วัด'
  const naohChips = document.querySelectorAll("#grp-naoh-meas .chip");
  if (naohChips.length > 0) {
    naohChips.forEach((c) => c.classList.remove("on"));
    naohChips[0].classList.add("on");
    chipState["grp-naoh-meas"] = "yes";
  }
  if (document.getElementById("naoh-input-wrap"))
    document.getElementById("naoh-input-wrap").style.display = "block";

  // Advance time +1h
  const [hh] = entry.time.split(":").map(Number);
  const nextH = String((hh + 1) % 24).padStart(2, "0") + ":00";
  const timeEl = document.getElementById("f-time");
  if ([...timeEl.options].some((o) => o.value === nextH)) timeEl.value = nextH;

  // Update previous display
  renderPrev(entry);

  // Send to Sheets
  const url = localStorage.getItem("sheet_url_washer2");
  if (!url) {
    showToast("✅ บันทึกในเครื่องสำเร็จ");
    return;
  }
  showToast("📤 กำลังส่งข้อมูล...");
  fetch(url, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry),
  })
    .then(() => showToast("✅ บันทึก " + entry.time + " น. สำเร็จ!"))
    .catch(() => showToast("⚠️ ส่ง Sheets ไม่สำเร็จ — บันทึกในเครื่องไว้แล้ว"));
}
// ============================================================
//  LOG TABLE
// ============================================================
function renderLog(data) {
  const tbody = document.getElementById("log-tbody");
  if (!data || !data.length) {
    tbody.innerHTML =
      '<tr><td colspan="21" style="color:var(--muted);padding:20px;font-style:italic;">ยังไม่มีข้อมูล</td></tr>';
    return;
  }
  tbody.innerHTML = "";
  data.forEach((e, i) => {
    const bg = i === data.length - 1 ? "background:#fff8e6;" : "";
    const dt = e.hasDT
      ? `<span style="background:#fee2e2;color:var(--red);padding:2px 6px;border-radius:4px;font-size:10px;font-weight:700;">แบบ${e.dtType}</span>`
      : "—";
    tbody.innerHTML += `
            <tr style="${bg}">
              <td class="mono">${e.time}</td>
              <td class="mono">${Number(e.bph || 0).toLocaleString()}</td>
              <td class="mono">${e.c1Temp || "—"}</td>
              <td class="mono">${e.c1Pres || "—"}</td>
              <td class="mono">${e.c1Naoh || "—"}</td>
              <td class="mono">${e.c2Temp || "—"}</td>
              <td class="mono">${e.c2Pres || "—"}</td>
              <td class="mono">${e.w1Temp || "—"}</td>
              <td class="mono">${e.w1Pres || "—"}</td>
              <td class="mono">${e.w2Temp || "—"}</td>
              <td class="mono">${e.w2Pres || "—"}</td>
              <td class="mono">${e.cwTemp || "—"}</td>
              <td class="mono">${e.cwPres || "—"}</td>
              <td class="mono">${e.fwTemp || "—"}</td>
              <td class="mono">${e.fwPres || "—"}</td>
              <td class="mono">${e.ph || "—"}</td>
              <td class="mono">${e.ccpPres || "—"}</td>
              <td class="mono">${e.ccpNaoh || "—"}</td>
              <td class="mono">${e.ccpTemp || "—"}</td>
              <td>${dt}</td>
              <td style="text-align:left;font-size:11px;max-width:100px;">${e.remark || "—"}</td>
            </tr>`;
  });
}

// ============================================================
//  SHEETS SETUP
// ============================================================
function saveSheetUrl() {
  const url = document.getElementById("sheet-url-input").value.trim();
  if (!url.startsWith("https://script.google.com")) {
    showToast("⚠️ URL ไม่ถูกต้อง");
    return;
  }
  localStorage.setItem("sheet_url_washer2", url);
  updateSheetBadge();
  showToast("✅ บันทึก URL สำเร็จ!");
}
function clearSheetUrl() {
  localStorage.removeItem("sheet_url_washer2");
  document.getElementById("sheet-url-input").value = "";
  updateSheetBadge();
  showToast("🗑️ ลบ URL แล้ว");
}
function updateSheetBadge() {
  const badge = document.getElementById("sheets-badge");
  const url = localStorage.getItem("sheet_url_washer2");
  if (url) {
    badge.textContent = "✅ เชื่อมต่อแล้ว";
    badge.style.background = "rgba(0,200,100,.3)";
    setBadge;
  } else {
    badge.textContent = "⚠️ ยังไม่ได้ตั้งค่า";
    badge.style.background = "rgba(255,200,0,.3)";
  }
}

// ============================================================
//  TOAST
// ============================================================
function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.style.display = "block";
  setTimeout(() => (t.style.display = "none"), 2500);
}
