const DEFAULT_BG_IMAGE =
  "https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=2560&auto=format";
const DEFAULT_ICON =
  'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">⚡</text></svg>';

let currentSettings = {
  glassTheme: "dark",
  bgType: "default",
  bgValue: DEFAULT_BG_IMAGE,
  bgCoverStyle: "cover",
  bgVideoVersion: 0,
  accentColor: "#00d4ff",
  textColor: "#ffffff",
  blur: 15,
  opacity: 0.1,
  greeting: "Welcome Back",
  clockStyle: "digital",
  clockFormat: "12",
  showAmPm: true,
  showSeconds: true,
  tabTitle: "New Tab",
  tabIcon: "",
  pomoDurationSeconds: 25 * 60,
  showClock: true,
  showNotes: true,
  showPomodoro: true,
  showLinks: true,
  showTodo: true,
  notes: [],
  todos: [],
  links: [
    { name: "YouTube", url: "https://youtube.com" },
    { name: "GitHub", url: "https://github.com" },
    { name: "LinkedIn", url: "https://linkedin.com" },
    { name: "ChatGPT", url: "https://chat.openai.com" },
  ],
};
let positions = {
  "clock-widget": null,
  "clock-size": null,
  "settings-btn": null,
  "settings-panel": null,
  "notes-widget": null,
  "notes-size": null,
  "pomodoro-widget": null,
  "links-widget": null,
  "links-size": null,
  "todo-widget": null,
  "todo-size": null,
};
let isDragging = false;
let appliedBgHash = "";
let activeVideoObjectUrl = null;
let activeVideoPreviewObjectUrl = null;
let backgroundRenderToken = 0;
let backgroundLoadSequence = 0;
let pomoTimeLeft = 25 * 60;
let pomoTimer = null;
let isEditingPomo = false;
let currentEditingNoteIndex = null;
let activeCardRect = null;
// Smart Guides state
let _guideLayer = null;
let _guideLines = {};
let _guideRaf = null;

const root = document.documentElement;
const bgContainer = document.getElementById("media-background");
const settingsPanel = document.getElementById("settings-panel");
const settingsBtn = document.getElementById("settings-btn");
const closeBtn = document.getElementById("close-settings-btn");
const resetLayoutBtn = document.getElementById("reset-layout-btn");
const pomodoroWidget = document.getElementById("pomodoro-widget");
const linkModalOverlay = document.getElementById("link-modal-overlay");
const linkModal = document.getElementById("link-modal");
const closeLinkModalBtn = document.getElementById("close-link-modal");
const cancelLinkBtn = document.getElementById("cancel-link-btn");
const saveLinkBtn = document.getElementById("save-link-btn");
const linkNameInput = document.getElementById("link-name-input");
const linkUrlInput = document.getElementById("link-url-input");

const customSelectMap = new Map();

function closeCustomSelects() {
  document.querySelectorAll(".custom-select.open").forEach((el) => {
    el.classList.remove("open");
  });
}

function refreshCustomSelect(id) {
  const entry = customSelectMap.get(id);
  if (entry) entry.update();
}

function initCustomDropdowns() {
  ["glass-theme-select", "bg-type", "bg-cover-style", "clock-style"].forEach((id) => {
    const selectEl = document.getElementById(id);
    if (!selectEl || selectEl.dataset.customized === "true") return;

    const wrapper = document.createElement("div");
    wrapper.className = "custom-select";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "modern-input custom-select-btn";

    const menu = document.createElement("div");
    menu.className = "custom-select-menu";

    const update = () => {
      const activeOption = selectEl.options[selectEl.selectedIndex];
      button.textContent = activeOption ? activeOption.textContent : "Select";
      menu.querySelectorAll(".custom-select-option").forEach((optionBtn) => {
        optionBtn.classList.toggle(
          "selected",
          optionBtn.dataset.value === selectEl.value,
        );
      });
    };

    Array.from(selectEl.options).forEach((option) => {
      const optionBtn = document.createElement("button");
      optionBtn.type = "button";
      optionBtn.className = "custom-select-option";
      optionBtn.dataset.value = option.value;
      optionBtn.textContent = option.textContent;
      optionBtn.addEventListener("click", () => {
        selectEl.value = option.value;
        selectEl.dispatchEvent(new Event("change", { bubbles: true }));
        update();
        wrapper.classList.remove("open");
      });
      menu.appendChild(optionBtn);
    });

    button.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const willOpen = !wrapper.classList.contains("open");
      closeCustomSelects();
      if (willOpen) wrapper.classList.add("open");
    });

    selectEl.classList.add("native-select-hidden");
    selectEl.dataset.customized = "true";
    selectEl.parentNode.insertBefore(wrapper, selectEl);
    wrapper.appendChild(selectEl);
    wrapper.appendChild(button);
    wrapper.appendChild(menu);

    customSelectMap.set(id, { wrapper, button, menu, selectEl, update });
    selectEl.addEventListener("change", update);
    update();
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".custom-select")) closeCustomSelects();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeCustomSelects();
  });
}

function openLinkModal() {
  if (!linkModal || !linkModalOverlay) return;
  linkNameInput.value = "";
  linkUrlInput.value = "";
  linkModal.classList.remove("hidden");
  linkModalOverlay.classList.remove("hidden");
  requestAnimationFrame(() => {
    linkModal.classList.add("active");
    linkModalOverlay.classList.add("active");
  });
  setTimeout(() => linkNameInput?.focus(), 20);
}

function closeLinkModal() {
  if (!linkModal || !linkModalOverlay) return;
  linkModal.classList.remove("active");
  linkModalOverlay.classList.remove("active");
  window.setTimeout(() => {
    linkModal.classList.add("hidden");
    linkModalOverlay.classList.add("hidden");
  }, 280);
}

function saveLinkFromModal() {
  const name = linkNameInput?.value.trim();
  let url = linkUrlInput?.value.trim();
  if (!name || !url) return;
  if (!url.startsWith("http")) url = "https://" + url;
  currentSettings.links.push({ name, url });
  renderLinks();
  saveAll();
  closeLinkModal();
}

function init() {
  chrome.storage.local.get(
    ["customTabSettings", "customTabPositions"],
    (result) => {
      try {
        if (result.customTabSettings)
          currentSettings = { ...currentSettings, ...result.customTabSettings };
        if (result.customTabPositions)
          positions = { ...positions, ...result.customTabPositions };
        if (!currentSettings.links) currentSettings.links = [];
        if (!currentSettings.todos) currentSettings.todos = [];
        currentSettings.notes = currentSettings.notes.map((n) =>
          typeof n === "string" ? { title: "Note", text: n } : n,
        );
        pomoTimeLeft = currentSettings.pomoDurationSeconds || 25 * 60;
      } catch (error) {
      } finally {
        renderNotes();
        renderLinks();
        renderTodos();
        applyPositions();
        syncUIToSettings();
        applySettingsToDOM();
        updatePomoDisplay();

        const draggables = document.querySelectorAll(".draggable");
        draggables.forEach((el, index) => {
          el.style.animationDelay = `${index * 0.04}s`;
          el.classList.add("ready");
        });
        // ensure guide layer exists
        ensureGuideLayer();
      }
    },
  );
}
initCustomDropdowns();
init();

// --- Smart Luminance Calculator for Contrast ---
function getContrastYIQ(hexcolor) {
  hexcolor = hexcolor.replace("#", "");
  var r = parseInt(hexcolor.substr(0, 2), 16);
  var g = parseInt(hexcolor.substr(2, 2), 16);
  var b = parseInt(hexcolor.substr(4, 2), 16);
  var yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? "#121212" : "#ffffff";
}

// --- Smart Guides (alignment helpers) ---
function ensureGuideLayer() {
  if (_guideLayer) return;
  _guideLayer = document.createElement('div');
  _guideLayer.id = 'guide-layer';
  _guideLayer.style.position = 'fixed';
  _guideLayer.style.inset = '0';
  _guideLayer.style.pointerEvents = 'none';
  _guideLayer.style.zIndex = '2500';
  document.body.appendChild(_guideLayer);
  // create up to 6 reusable guides
  ['h-top','h-center','h-bottom','v-left','v-center','v-right'].forEach((key) => {
    const el = document.createElement('div');
    el.className = 'guide-line';
    el.dataset.key = key;
    el.style.position = 'fixed';
    el.style.pointerEvents = 'none';
    el.style.opacity = '0';
    el.style.transition = 'opacity 160ms var(--oxy-ease)';
    _guideLayer.appendChild(el);
    _guideLines[key] = el;
  });
}

function clearGuides() {
  if (!_guideLayer) return;
  Object.values(_guideLines).forEach((g) => {
    if (!g) return;
    g.style.opacity = '0';
  });
}

function updateGuides(activeEl) {
  if (!activeEl || !_guideLayer) return;
  const tol = 6; // pixels tolerance for 'perfect' alignment
  const a = activeEl.getBoundingClientRect();
  const others = Array.from(document.querySelectorAll('.draggable')).filter((el) => el !== activeEl && el.offsetParent !== null);

  // reset accumulators
  const hMatches = { top: null, center: null, bottom: null };
  const vMatches = { left: null, center: null, right: null };

  others.forEach((el) => {
    const r = el.getBoundingClientRect();
    // horizontal: top
    if (Math.abs(a.top - r.top) <= tol) {
      const left = Math.min(a.left, r.left) - 12;
      const right = Math.max(a.right, r.right) + 12;
      hMatches.top = hMatches.top ? { left: Math.min(hMatches.top.left, left), right: Math.max(hMatches.top.right, right), y: a.top } : { left, right, y: a.top };
    }
    // centerY
    const aCenterY = a.top + a.height / 2;
    const rCenterY = r.top + r.height / 2;
    if (Math.abs(aCenterY - rCenterY) <= tol) {
      const left = Math.min(a.left, r.left) - 12;
      const right = Math.max(a.right, r.right) + 12;
      hMatches.center = hMatches.center ? { left: Math.min(hMatches.center.left, left), right: Math.max(hMatches.center.right, right), y: aCenterY } : { left, right, y: aCenterY };
    }
    // bottom
    if (Math.abs(a.bottom - r.bottom) <= tol) {
      const left = Math.min(a.left, r.left) - 12;
      const right = Math.max(a.right, r.right) + 12;
      hMatches.bottom = hMatches.bottom ? { left: Math.min(hMatches.bottom.left, left), right: Math.max(hMatches.bottom.right, right), y: a.bottom } : { left, right, y: a.bottom };
    }

    // vertical: left
    if (Math.abs(a.left - r.left) <= tol) {
      const top = Math.min(a.top, r.top) - 12;
      const bottom = Math.max(a.bottom, r.bottom) + 12;
      vMatches.left = vMatches.left ? { top: Math.min(vMatches.left.top, top), bottom: Math.max(vMatches.left.bottom, bottom), x: a.left } : { top, bottom, x: a.left };
    }
    // centerX
    const aCenterX = a.left + a.width / 2;
    const rCenterX = r.left + r.width / 2;
    if (Math.abs(aCenterX - rCenterX) <= tol) {
      const top = Math.min(a.top, r.top) - 12;
      const bottom = Math.max(a.bottom, r.bottom) + 12;
      vMatches.center = vMatches.center ? { top: Math.min(vMatches.center.top, top), bottom: Math.max(vMatches.center.bottom, bottom), x: aCenterX } : { top, bottom, x: aCenterX };
    }
    // right
    if (Math.abs(a.right - r.right) <= tol) {
      const top = Math.min(a.top, r.top) - 12;
      const bottom = Math.max(a.bottom, r.bottom) + 12;
      vMatches.right = vMatches.right ? { top: Math.min(vMatches.right.top, top), bottom: Math.max(vMatches.right.bottom, bottom), x: a.right } : { top, bottom, x: a.right };
    }
  });

  // update horizontal guides
  [['top','h-top'],['center','h-center'],['bottom','h-bottom']].forEach(([k,key]) => {
    const node = _guideLines[key];
    const m = hMatches[k];
    if (m && node) {
      node.style.left = (m.left) + 'px';
      node.style.top = (m.y - 0.5) + 'px';
      node.style.width = (m.right - m.left) + 'px';
      node.style.height = '1px';
      node.style.background = `linear-gradient(90deg, transparent, var(--accent-color), transparent)`;
      node.style.boxShadow = `0 0 8px ${getComputedStyle(document.documentElement).getPropertyValue('--accent-color') || '#00d4ff'}`;
      node.style.opacity = '1';
    } else if (node) node.style.opacity = '0';
  });

  // update vertical guides
  [['left','v-left'],['center','v-center'],['right','v-right']].forEach(([k,key]) => {
    const node = _guideLines[key];
    const m = vMatches[k];
    if (m && node) {
      node.style.top = (m.top) + 'px';
      node.style.left = (m.x - 0.5) + 'px';
      node.style.height = (m.bottom - m.top) + 'px';
      node.style.width = '1px';
      node.style.background = `linear-gradient(180deg, transparent, var(--accent-color), transparent)`;
      node.style.boxShadow = `0 0 8px ${getComputedStyle(document.documentElement).getPropertyValue('--accent-color') || '#00d4ff'}`;
      node.style.opacity = '1';
    } else if (node) node.style.opacity = '0';
  });
}

resetLayoutBtn?.addEventListener("click", () => {
  if (confirm("Reset all widgets to their default positions?")) {
    chrome.storage.local.remove("customTabPositions");
    localStorage.removeItem("fastLoadPositions");
    location.reload();
  }
});

const DB_NAME = "NewTabDatabase";
function getDB(cb) {
  const req = indexedDB.open(DB_NAME, 1);
  req.onupgradeneeded = (e) => e.target.result.createObjectStore("media");
  req.onsuccess = (e) => cb(e.target.result);
}
function saveLocalVideo(blob) {
  getDB((db) =>
    db
      .transaction("media", "readwrite")
      .objectStore("media")
      .put(blob, "backgroundVideo"),
  );
}
function loadLocalVideo(cb) {
  getDB((db) => {
    try {
      const req = db
        .transaction("media", "readonly")
        .objectStore("media")
        .get("backgroundVideo");
      req.onsuccess = () => cb(req.result);
    } catch (e) {
      cb(null);
    }
  });
}

// --- Clock Logic ---
function updateClock() {
  const now = new Date();
  if (currentSettings.clockStyle === "analog") {
    const seconds = now.getSeconds();
    const minutes = now.getMinutes();
    const hours = now.getHours();
    const secondsDegrees = (seconds / 60) * 360;
    const minutesDegrees = (minutes / 60) * 360 + (seconds / 60) * 6;
    const hoursDegrees = (hours / 12) * 360 + (minutes / 60) * 30;
    const sHand = document.getElementById("second-hand");
    if (sHand) {
      sHand.style.transform = `translateX(-50%) rotate(${secondsDegrees}deg)`;
      sHand.style.display = currentSettings.showSeconds ? "block" : "none";
    }
    const mHand = document.getElementById("minute-hand");
    if (mHand)
      mHand.style.transform = `translateX(-50%) rotate(${minutesDegrees}deg)`;
    const hHand = document.getElementById("hour-hand");
    if (hHand)
      hHand.style.transform = `translateX(-50%) rotate(${hoursDegrees}deg)`;
  } else {
    const timeDisplay = document.getElementById("digital-clock");
    if (!timeDisplay) return;
    let options = {
      hour: "numeric",
      minute: "2-digit",
      second: currentSettings.showSeconds ? "2-digit" : undefined,
      hour12: currentSettings.clockFormat === "12",
    };
    let timeString = now.toLocaleTimeString([], options);
    if (!currentSettings.showAmPm)
      timeString = timeString.replace(/(AM|PM|am|pm)/g, "").trim();
    timeDisplay.textContent = timeString;
  }
}
setInterval(updateClock, 1000);

// --- Pomodoro UI/Logic ---
const pomoTimeDisplay = document.getElementById("pomo-time");
const pomoStartBtn = document.getElementById("pomo-start-btn");
const pomoResetBtn = document.getElementById("pomo-reset-btn");

function updatePomoDisplay() {
  let minutes = Math.floor(pomoTimeLeft / 60);
  let seconds = pomoTimeLeft % 60;
  pomoTimeDisplay.textContent = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function setFocusMode(active) {
  document.body.classList.toggle("focus-mode", active);
  pomodoroWidget?.classList.toggle("pomo-running", active);
}

pomoTimeDisplay.addEventListener("click", () => {
  if (isEditingPomo || pomoTimer) return;
  isEditingPomo = true;

  const input = document.createElement("input");
  input.type = "text";
  input.className = "pomo-edit-input";
  let m = Math.floor(pomoTimeLeft / 60)
    .toString()
    .padStart(2, "0");
  let s = (pomoTimeLeft % 60).toString().padStart(2, "0");
  input.value = `${m}:${s}`;

  pomoTimeDisplay.replaceWith(input);
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);

  const savePomo = () => {
    const parts = input.value.split(":");
    let newM = parseInt(parts[0]);
    let newS = parts.length > 1 ? parseInt(parts[1]) : 0;

    if (isNaN(newM)) newM = 25;
    if (isNaN(newS)) newS = 0;
    if (newM > 120) newM = 120;
    if (newS > 59) newS = 59;
    if (newM < 0) newM = 0;
    if (newS < 0) newS = 0;

    let newTime = newM * 60 + newS;
    if (newTime <= 0) newTime = 25 * 60;

    currentSettings.pomoDurationSeconds = newTime;
    pomoTimeLeft = newTime;

    input.replaceWith(pomoTimeDisplay);
    updatePomoDisplay();
    isEditingPomo = false;
    saveAll();
  };

  input.onblur = savePomo;
  input.onkeypress = (e) => {
    if (e.key === "Enter") input.blur();
  };
});

pomoStartBtn.addEventListener("click", () => {
  if (pomoTimer) {
    clearInterval(pomoTimer);
    pomoTimer = null;
    pomoStartBtn.textContent = "Start";
    setFocusMode(false);
  } else {
    pomoStartBtn.textContent = "Pause";
    setFocusMode(true);
    pomoTimer = setInterval(() => {
      pomoTimeLeft--;
      updatePomoDisplay();
      if (pomoTimeLeft <= 0) {
        clearInterval(pomoTimer);
        pomoTimer = null;
        pomoStartBtn.textContent = "Start";
        pomoTimeLeft = currentSettings.pomoDurationSeconds || 25 * 60;
        updatePomoDisplay();
        setFocusMode(false);
        alert("Focus session complete!");
      }
    }, 1000);
  }
});
pomoResetBtn.addEventListener("click", () => {
  clearInterval(pomoTimer);
  pomoTimer = null;
  pomoTimeLeft = currentSettings.pomoDurationSeconds || 25 * 60;
  updatePomoDisplay();
  pomoStartBtn.textContent = "Start";
  setFocusMode(false);
});

function syncUIToSettings() {
  const safeSet = (id, val, isCheckbox = false) => {
    const el = document.getElementById(id);
    if (el) {
      if (isCheckbox) el.checked = val;
      else el.value = val;
      if (!isCheckbox) refreshCustomSelect(id);
    }
  };
  safeSet("glass-theme-select", currentSettings.glassTheme || "dark");
  safeSet("bg-type", currentSettings.bgType);
  safeSet("bg-cover-style", currentSettings.bgCoverStyle || "cover");
  safeSet("accent-color-picker", currentSettings.accentColor);
  safeSet("text-color-picker", currentSettings.textColor);
  safeSet("blur-slider", currentSettings.blur);
  safeSet("opacity-slider", currentSettings.opacity);
  safeSet("greeting-input", currentSettings.greeting);
  safeSet("tab-title-input", currentSettings.tabTitle);
  safeSet("clock-style", currentSettings.clockStyle);
  safeSet("clock-format-toggle", currentSettings.clockFormat === "24", true);
  safeSet("seconds-toggle", currentSettings.showSeconds, true);
  safeSet("ampm-toggle", currentSettings.showAmPm, true);
  safeSet("show-clock-toggle", currentSettings.showClock, true);
  safeSet("show-notes-toggle", currentSettings.showNotes, true);
  safeSet("show-pomodoro-toggle", currentSettings.showPomodoro, true);
  safeSet("show-links-toggle", currentSettings.showLinks, true);
  safeSet("show-todo-toggle", currentSettings.showTodo, true);
  if (currentSettings.bgType === "url")
    safeSet("bg-url-input", currentSettings.bgValue);
  if (currentSettings.bgType === "solid")
    safeSet("bg-color-picker", currentSettings.bgValue);
  toggleInputVisibility();
}

function toggleInputVisibility() {
  const type = document.getElementById("bg-type")?.value;
  if (!type) return;
  document.getElementById("file-group").style.display =
    type === "file" ? "flex" : "none";
  document.getElementById("url-group").style.display =
    type === "url" ? "flex" : "none";
  document.getElementById("solid-group").style.display =
    type === "solid" ? "flex" : "none";
}

function applySettingsToDOM() {
  root.setAttribute("data-glass-theme", currentSettings.glassTheme || "dark");
  root.style.setProperty("--blur-amount", `${currentSettings.blur}px`);
  root.style.setProperty("--card-opacity", currentSettings.opacity);
  root.style.setProperty("--accent-color", currentSettings.accentColor);
  root.style.setProperty("--text-color", currentSettings.textColor);
  root.style.setProperty("--bg-cover-style", currentSettings.bgCoverStyle || "cover");

  // Dynamic Accent Text Color for Buttons
  const contrastColor = getContrastYIQ(currentSettings.accentColor);
  root.style.setProperty("--accent-text-color", contrastColor);

  const greetingEl = document.getElementById("greeting");
  if (greetingEl) greetingEl.textContent = currentSettings.greeting;
  const setDisplay = (id, show) => {
    const el = document.getElementById(id);
    if (el)
      el.style.display = show
        ? ["notes-widget", "links-widget", "todo-widget"].includes(id)
          ? "flex"
          : "block"
        : "none";
  };
  setDisplay("clock-widget", currentSettings.showClock);
  setDisplay("notes-widget", currentSettings.showNotes);
  setDisplay("pomodoro-widget", currentSettings.showPomodoro);
  setDisplay("links-widget", currentSettings.showLinks);
  setDisplay("todo-widget", currentSettings.showTodo);

  document.getElementById("digital-clock-container").style.display =
    currentSettings.clockStyle === "analog" ? "none" : "flex";
  document.getElementById("analog-clock").style.display =
    currentSettings.clockStyle === "analog" ? "flex" : "none";
  updateClock();

  document.title = currentSettings.tabTitle || "New Tab";
  let iconLink = document.querySelector("link[rel~='icon']");
  if (!iconLink) {
    iconLink = document.createElement("link");
    iconLink.rel = "icon";
    document.head.appendChild(iconLink);
  }
  iconLink.href = currentSettings.tabIcon || DEFAULT_ICON;

  const newHash = `${currentSettings.bgType}|${currentSettings.bgValue}|${currentSettings.bgCoverStyle || "cover"}|${currentSettings.bgVideoVersion || 0}`;
  if (appliedBgHash === newHash) return;
  appliedBgHash = newHash;

  const renderToken = ++backgroundRenderToken;
  const coverStyle = currentSettings.bgCoverStyle || "cover";
  bgContainer.innerHTML = "";
  bgContainer.style.backgroundImage = "none";
  bgContainer.style.backgroundColor = "transparent";
  if (currentSettings.bgValue !== "local-video-flag" && activeVideoPreviewObjectUrl) {
    URL.revokeObjectURL(activeVideoPreviewObjectUrl);
    activeVideoPreviewObjectUrl = null;
  }
  if (activeVideoObjectUrl) {
    URL.revokeObjectURL(activeVideoObjectUrl);
    activeVideoObjectUrl = null;
  }

  const renderMedia = (src, kind) => {
    if (renderToken !== backgroundRenderToken) return;
    bgContainer.innerHTML = "";
    bgContainer.style.backgroundImage = "none";
    bgContainer.style.backgroundColor = "transparent";
    const node = document.createElement(kind);
    node.className = "bg-media";
    if (kind === "video") {
      node.src = src;
      node.autoplay = true;
      node.loop = true;
      node.muted = true;
      node.playsInline = true;
    } else {
      node.src = src;
      node.alt = "Background wallpaper";
      node.draggable = false;
    }
    node.style.objectFit = coverStyle;
    bgContainer.appendChild(node);
  };

  if (currentSettings.bgType === "solid") {
    bgContainer.style.backgroundColor = currentSettings.bgValue;
    return;
  }

  if (currentSettings.bgValue === "local-video-flag") {
    if (activeVideoPreviewObjectUrl) {
      renderMedia(activeVideoPreviewObjectUrl, "video");
      return;
    }
    loadLocalVideo((blob) => {
      if (!blob || renderToken !== backgroundRenderToken) return;
      activeVideoObjectUrl = URL.createObjectURL(blob);
      renderMedia(activeVideoObjectUrl, "video");
    });
    return;
  }

  const url =
    currentSettings.bgType === "default"
      ? DEFAULT_BG_IMAGE
      : currentSettings.bgValue;
  if (!url) return;
  if (url.match(/\.(mp4|webm|ogg)$/i)) {
    renderMedia(url, "video");
  } else {
    renderMedia(url, "img");
  }
}

// --- Quick Links ---
function renderLinks() {
  const grid = document.getElementById("links-grid");
  if (!grid) return;
  grid.innerHTML = "";
  currentSettings.links.forEach((link, index) => {
    const a = document.createElement("a");
    a.className = "link-item";
    a.href = link.url;
    const textSpan = document.createElement("span");
    textSpan.textContent = link.name;
        const delBtn = document.createElement("button");
        delBtn.className = "delete-link";
        delBtn.dataset.index = index;
          delBtn.innerHTML =
            '<span class="material-symbols-outlined" style="font-size: 14px;">close</span>';
    delBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      currentSettings.links.splice(e.target.closest("button").dataset.index, 1);
      renderLinks();
      saveAll();
    });
    a.appendChild(textSpan);
    a.appendChild(delBtn);
    grid.appendChild(a);
  });
}
document.getElementById("add-link-btn")?.addEventListener("click", () => {
    openLinkModal();
  });
  closeLinkModalBtn?.addEventListener("click", closeLinkModal);
  cancelLinkBtn?.addEventListener("click", closeLinkModal);
  linkModalOverlay?.addEventListener("click", (e) => {
    if (e.target === linkModalOverlay) closeLinkModal();
  });
  saveLinkBtn?.addEventListener("click", saveLinkFromModal);
  linkNameInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") saveLinkFromModal();
  });
  linkUrlInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") saveLinkFromModal();
  });

// --- Tasks / To-Do ---
function renderTodos() {
  const list = document.getElementById("todo-list");
  if (!list) return;
  list.innerHTML = "";
  if (!currentSettings.todos) currentSettings.todos = [];
  currentSettings.todos.forEach((todo, index) => {
    const div = document.createElement("div");
    div.className = `todo-item ${todo.completed ? "completed" : ""}`;
    const chk = document.createElement("input");
    chk.type = "checkbox";
    chk.className = "todo-checkbox";
    chk.dataset.index = index;
    chk.checked = todo.completed;
    const txt = document.createElement("span");
    txt.className = "todo-text";
    txt.textContent = todo.text;
    const btn = document.createElement("button");
    btn.className = "delete-todo";
    btn.dataset.index = index;
    btn.innerHTML =
      '<span class="material-symbols-outlined" style="font-size: 12px;">close</span>';
    div.appendChild(chk);
    div.appendChild(txt);
    div.appendChild(btn);
    list.appendChild(div);
  });
  document.querySelectorAll(".todo-checkbox").forEach((chk) =>
    chk.addEventListener("change", (e) => {
      currentSettings.todos[e.target.dataset.index].completed =
        e.target.checked;
      renderTodos();
      saveAll();
    }),
  );
  document.querySelectorAll(".delete-todo").forEach((btn) =>
    btn.addEventListener("click", (e) => {
      currentSettings.todos.splice(e.target.closest("button").dataset.index, 1);
      renderTodos();
      saveAll();
    }),
  );
}
document.getElementById("add-todo-btn")?.addEventListener("click", () => {
  const input = document.getElementById("new-todo-input");
  const text = input.value.trim();
  if (text) {
    currentSettings.todos.push({ text, completed: false });
    input.value = "";
    renderTodos();
    saveAll();
  }
});
document.getElementById("new-todo-input")?.addEventListener("keypress", (e) => {
  if (e.key === "Enter") document.getElementById("add-todo-btn").click();
});

// --- Modals & FLIP Physics ---
const noteModalOverlay = document.getElementById("note-modal-overlay");
const noteModal = document.getElementById("note-modal");
const noteModalTitle = document.getElementById("note-modal-title");
const noteModalText = document.getElementById("note-modal-text");

function renderNotes() {
  const list = document.getElementById("notes-list");
  if (!list) return;
  list.innerHTML = "";
  if (!currentSettings.notes) currentSettings.notes = [];
  currentSettings.notes.forEach((note, index) => {
    const div = document.createElement("div");
    div.className = "note-card";
    div.dataset.index = index;
    const titleEl = document.createElement("div");
    titleEl.className = "note-title-display";
    titleEl.textContent = note.title || "Untitled";
    const textEl = document.createElement("div");
    textEl.className = "note-preview-display";
    textEl.textContent = note.text || "Empty...";
    const delBtn = document.createElement("button");
    delBtn.className = "delete-item-btn";
    delBtn.dataset.index = index;
        delBtn.innerHTML =
          '<span class="material-symbols-outlined" style="font-size: 12px;">close</span>';

    delBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      currentSettings.notes.splice(e.target.closest("button").dataset.index, 1);
      renderNotes();
      saveAll();
    });
    div.addEventListener("click", () => openNoteModal(index, div));

    div.appendChild(titleEl);
    div.appendChild(textEl);
    div.appendChild(delBtn);
    list.appendChild(div);
  });
}

function openNoteModal(index, cardEl) {
  currentEditingNoteIndex = index;
  const note = currentSettings.notes[index];
  noteModalTitle.value = note.title || "";
  noteModalText.value = note.text || "";

  activeCardRect = cardEl.getBoundingClientRect();

  noteModal.classList.remove("hidden");
  noteModalOverlay.classList.remove("hidden");
  noteModal.classList.remove("animating");
  noteModal.classList.remove("closing");
  noteModal.style.top = activeCardRect.top + "px";
  noteModal.style.left = activeCardRect.left + "px";
  noteModal.style.width = activeCardRect.width + "px";
  noteModal.style.height = activeCardRect.height + "px";
  noteModal.style.opacity = "0.82";
  noteModal.style.transform = "translate3d(0, 0, 0) scale(0.98)";

  noteModal.classList.add("active");
  noteModalOverlay.classList.add("active");
  cardEl.style.opacity = "0";

  void noteModal.offsetWidth;

  noteModal.classList.add("animating");
  noteModal.style.opacity = "1";
  // Exact center coordinate math (600w x 70vh)
  noteModal.style.top = "calc(50% - 35vh)";
  noteModal.style.left = "calc(50% - 300px)";
  noteModal.style.width = "600px";
  noteModal.style.height = "70vh";
  noteModal.style.transform = "translate3d(0, 0, 0) scale(1.03)";

  window.setTimeout(() => {
    if (noteModal.classList.contains("active")) {
      noteModal.style.transform = "translate3d(0, 0, 0) scale(1)";
    }
  }, 170);
}

function closeNoteModal() {
  if (currentEditingNoteIndex === null) return;
  currentSettings.notes[currentEditingNoteIndex] = {
    title: noteModalTitle.value,
    text: noteModalText.value,
  };
  saveAll();

  const cardEl = document.querySelector(
    `.note-card[data-index="${currentEditingNoteIndex}"]`,
  );
  if (cardEl) {
    cardEl.querySelector(".note-title-display").textContent =
      noteModalTitle.value || "Untitled";
    cardEl.querySelector(".note-preview-display").textContent =
      noteModalText.value || "Empty...";
    activeCardRect = cardEl.getBoundingClientRect();
  }

  noteModal.classList.remove("closing");

  if (activeCardRect) {
    noteModal.classList.add("closing");
    // ensure a compact morph preview exists inside the modal
    let morph = noteModal.querySelector('.note-morph');
    if (!morph) {
      // prefer the current modal input values so the morph matches what the user sees
      const noteFromModal = {
        title: (noteModalTitle && noteModalTitle.value) || (currentSettings.notes && currentSettings.notes[currentEditingNoteIndex] && currentSettings.notes[currentEditingNoteIndex].title) || '',
        text: (noteModalText && noteModalText.value) || (currentSettings.notes && currentSettings.notes[currentEditingNoteIndex] && currentSettings.notes[currentEditingNoteIndex].text) || '',
      };
      morph = createNoteMorph(noteFromModal);
      noteModal.appendChild(morph);
    }
    // hide the underlying card immediately to prevent duplicate text during animation
    if (cardEl) {
      cardEl.classList.add('card-hidden');
    }
    noteModal.style.top = activeCardRect.top + "px";
    noteModal.style.left = activeCardRect.left + "px";
    noteModal.style.width = activeCardRect.width + "px";
    noteModal.style.height = activeCardRect.height + "px";
    noteModal.style.opacity = "0.82";
    noteModal.style.transform = "translate3d(0, 12px, 0) scale(0.94)";

    let closed = false;
    let fallbackTimer = null;

    const finishClose = () => {
      if (closed) return;
      closed = true;
      if (fallbackTimer) window.clearTimeout(fallbackTimer);
      // hide modal and overlay, keep card hidden until next paint
      noteModal.classList.remove("active");
      noteModal.classList.remove("animating");
      noteModal.classList.remove("closing");
      noteModal.removeEventListener("transitionend", onTransitionEnd);
      noteModalOverlay.classList.remove("active");
      noteModal.classList.add("hidden");
      noteModalOverlay.classList.add("hidden");
      noteModal.style.opacity = "";
      noteModal.style.transform = "";

      if (cardEl) {
        // prevent layout reflow/jump by locking the notes list size
        const notesList = document.getElementById('notes-list');
        let notesListHeight = null;
        if (notesList) {
          notesListHeight = notesList.getBoundingClientRect().height;
          notesList.style.height = notesListHeight + 'px';
          notesList.style.overflow = 'hidden';
        }

        // remove instant-hide, then fade the card in (opacity-only) to avoid layout jumps
        cardEl.classList.remove('card-hidden');
        cardEl.classList.add('card-fade');
        cardEl.style.willChange = 'opacity';
        cardEl.style.opacity = '0';

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            // start notes-list height animation concurrently to mask reflow
            const notesWidget = document.getElementById('notes-widget');
            if (notesWidget) notesWidget.classList.add('widget-transition-mask');
            // create a temporary fixed-position clone of the card to animate visually
            let tempCard = null;
            try {
              const rect = cardEl.getBoundingClientRect();
              tempCard = cardEl.cloneNode(true);
              tempCard.classList.add('temp-card');
              // set inline positioning to match on-screen rect
              tempCard.style.left = rect.left + 'px';
              tempCard.style.top = rect.top + 'px';
              tempCard.style.width = rect.width + 'px';
              tempCard.style.height = rect.height + 'px';
              tempCard.style.margin = '0';
              document.body.appendChild(tempCard);
              // trigger fade-in of tempCard
              requestAnimationFrame(() => {
                tempCard.style.opacity = '1';
                tempCard.style.transform = 'none';
              });
            } catch (e) {
              tempCard = null;
            }
            if (notesList) {
              const prevH = notesListHeight || notesList.getBoundingClientRect().height;
              notesList.style.height = prevH + 'px';
              notesList.style.overflow = 'hidden';
              // add subtle translate for perceived smoothness
              notesList.classList.add('notes-list-anim');
              notesList.style.transform = 'translateY(6px)';
              requestAnimationFrame(() => {
                const targetH = notesList.scrollHeight;
                if (targetH !== prevH) {
                  const rootComputed = getComputedStyle(document.documentElement);
                  const ease = rootComputed.getPropertyValue('--morph-ease') || 'cubic-bezier(0.2,0.9,0.22,1)';
                  const duration = 420;
                  notesList.style.transition = `height ${duration}ms ${ease}`;
                  requestAnimationFrame(() => {
                    notesList.style.height = targetH + 'px';
                    // animate translate back to 0
                    notesList.style.transform = 'none';
                  });
                } else {
                  // still animate translate back
                  requestAnimationFrame(() => {
                    notesList.style.transform = 'none';
                  });
                }
              });
            }

            // fade the card in
            cardEl.style.opacity = '1';
            // fade in inner content with a small stagger
            try {
              const title = cardEl.querySelector('.note-title-display');
              const preview = cardEl.querySelector('.note-preview-display');
              if (title) {
                title.classList.add('content-fade');
                // force paint
                void title.offsetWidth;
                setTimeout(() => title.classList.add('show'), 80);
              }
              if (preview) {
                preview.classList.add('content-fade');
                void preview.offsetWidth;
                setTimeout(() => preview.classList.add('show'), 160);
              }
            } catch (e) {}

              // cleanup after animations
            setTimeout(() => {
              cardEl.classList.remove('card-fade');
              cardEl.style.willChange = '';
              const morph = noteModal.querySelector('.note-morph');
              if (morph) morph.remove();
              // remove tempCard and reveal original card in-flow
              if (tempCard) {
                tempCard.remove();
              }
              // unhide the real card (was kept hidden during animation)
              try {
                cardEl.classList.remove('card-hidden');
                cardEl.style.opacity = '';
              } catch (e) {}
              // finalize notes-list animation cleanup
              if (notesList) {
                const onEnd = () => {
                  notesList.style.transition = '';
                  notesList.style.height = '';
                  notesList.style.overflow = '';
                  notesList.style.transform = '';
                  notesList.classList.remove('notes-list-anim');
                  if (notesWidget) notesWidget.classList.remove('widget-transition-mask');
                  notesList.removeEventListener('transitionend', onEnd);
                };
                // if transition was applied, wait for it, else cleanup now
                if (notesList.style.transition) notesList.addEventListener('transitionend', onEnd);
                else onEnd();
              }
              // cleanup content-fade classes
              try {
                const title = cardEl.querySelector('.note-title-display');
                const preview = cardEl.querySelector('.note-preview-display');
                if (title) {
                  title.classList.remove('content-fade', 'show');
                }
                if (preview) {
                  preview.classList.remove('content-fade', 'show');
                }
              } catch (e) {}
            }, 380);
          });
        });
      }
      currentEditingNoteIndex = null;
    };

    const onTransitionEnd = (event) => {
      if (event.propertyName !== "transform") return;
      finishClose();
    };

    noteModal.addEventListener("transitionend", onTransitionEnd);

    fallbackTimer = window.setTimeout(() => {
      if (currentEditingNoteIndex !== null) finishClose();
    }, 560);
  } else {
    noteModal.classList.remove("active");
    noteModalOverlay.classList.remove("active");
    currentEditingNoteIndex = null;
  }
}

document.getElementById("add-note-btn")?.addEventListener("click", () => {
  currentSettings.notes.unshift({ title: "", text: "" });
  renderNotes();
  setTimeout(() => {
    openNoteModal(0, document.querySelector('.note-card[data-index="0"]'));
  }, 50);
});
document
  .getElementById("close-note-modal")
  ?.addEventListener("click", closeNoteModal);
noteModalOverlay?.addEventListener("click", (e) => {
  if (e.target === noteModalOverlay) closeNoteModal();
});

// --- Layouts & Dragging ---
function applyPositions() {
  Object.keys(positions).forEach((id) => {
    if (positions[id] && positions[id].left && positions[id].top) {
      const el = document.getElementById(id);
      if (el) {
        el.style.left = positions[id].left;
        el.style.top = positions[id].top;
        el.style.transform = "none";
        el.style.right = "auto";
        el.style.bottom = "auto";
      }
    }
  });
  ["notes-size", "todo-size", "links-size"].forEach((sizeId) => {
    if (positions[sizeId]) {
      const widgetId = sizeId.replace("-size", "-widget");
      const el = document.getElementById(widgetId);
      if (el && positions[sizeId].w) {
        el.style.width = positions[sizeId].w;
        el.style.height = positions[sizeId].h;
      }
    }
  });
  if (positions["clock-size"]) {
    const clockEl = document.getElementById("clock-widget");
    if (clockEl && positions["clock-size"].w) {
      clockEl.style.width = positions["clock-size"].w;
      clockEl.style.height = positions["clock-size"].h;
    }
  }
}

function makeDraggable(el) {
  if (!el) return;
  let pos1 = 0,
    pos2 = 0,
    pos3 = 0,
    pos4 = 0;
  el.onmousedown = dragMouseDown;

  function dragMouseDown(e) {
    if (!document.body.classList.contains("edit-mode")) return;
    if (
      ["BUTTON", "INPUT", "TEXTAREA", "SELECT", "A", "SPAN"].includes(
        e.target.tagName,
      ) &&
      !e.target.classList.contains("drag-handle") &&
      e.target.parentElement.tagName !== "BUTTON"
    )
      return;

    const rect = el.getBoundingClientRect();
    const isResizeArea =
      e.clientX >= rect.right - 20 && e.clientY >= rect.bottom - 20;
    if (isResizeArea) {
      // Start JS-driven resize (to enable smart guides during resize)
      e.preventDefault();
      pos3 = e.clientX;
      pos4 = e.clientY;
      const startW = rect.width;
      const startH = rect.height;
      document.onmousemove = resizeDrag;
      document.onmouseup = endResize;
      return;
    }

    e.preventDefault();
    pos3 = e.clientX;
    pos4 = e.clientY;
    el.style.left = rect.left + "px";
    el.style.top = rect.top + "px";
    el.style.transform = "none";
    el.style.right = "auto";
    el.style.bottom = "auto";
    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
  }
  function elementDrag(e) {
    e.preventDefault();
    isDragging = true;
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    el.style.top = el.offsetTop - pos2 + "px";
    el.style.left = el.offsetLeft - pos1 + "px";
    // throttle guide updates with rAF
    if (!_guideRaf) {
      _guideRaf = requestAnimationFrame(() => {
        _guideRaf = null;
        updateGuides(el);
      });
    }
  }
  function closeDragElement() {
    document.onmouseup = null;
    document.onmousemove = null;
    positions[el.id] = { left: el.style.left, top: el.style.top };
    chrome.storage.local.set({ customTabPositions: positions });
    try {
      localStorage.setItem("fastLoadPositions", JSON.stringify(positions));
    } catch (e) {}
    setTimeout(() => {
      isDragging = false;
      clearGuides();
    }, 50);
  }
  // resize helpers
  function resizeDrag(e) {
    e.preventDefault();
    isDragging = true;
    const rect = el.getBoundingClientRect();
    const dx = e.clientX - pos3;
    const dy = e.clientY - pos4;
    pos3 = e.clientX;
    pos4 = e.clientY;
    const newW = Math.max(100, rect.width + dx);
    const newH = Math.max(80, rect.height + dy);
    el.style.width = newW + "px";
    el.style.height = newH + "px";
    positions[el.id + "-size"] = { w: el.style.width, h: el.style.height };
    chrome.storage.local.set({ customTabPositions: positions });
    if (!_guideRaf) {
      _guideRaf = requestAnimationFrame(() => {
        _guideRaf = null;
        updateGuides(el);
      });
    }
  }
  function endResize() {
    document.onmouseup = null;
    document.onmousemove = null;
    try {
      localStorage.setItem("fastLoadPositions", JSON.stringify(positions));
    } catch (e) {}
    setTimeout(() => {
      isDragging = false;
      clearGuides();
    }, 50);
  }
}
[
  "clock-widget",
  "settings-btn",
  "settings-panel",
  "notes-widget",
  "pomodoro-widget",
  "links-widget",
  "todo-widget",
].forEach((id) => makeDraggable(document.getElementById(id)));

const attachResizer = (id, stateKey) => {
  const el = document.getElementById(id);
  if (el) {
    new ResizeObserver(() => {
      positions[stateKey] = { w: el.style.width, h: el.style.height };
      chrome.storage.local.set({ customTabPositions: positions });
    }).observe(el);
  }
};
attachResizer("notes-widget", "notes-size");
attachResizer("todo-widget", "todo-size");
attachResizer("links-widget", "links-size");
attachResizer("clock-widget", "clock-size");

// Create a reusable morph preview element for re-use during modal close animations
function createNoteMorph(note) {
  const morph = document.createElement('div');
  morph.className = 'note-morph';
  const t = document.createElement('div');
  t.className = 'morph-title';
  t.textContent = note.title || 'Untitled';
  const b = document.createElement('div');
  b.className = 'morph-text';
  b.textContent = (note.text || '').replace(/\n/g, ' ').slice(0, 400);
  morph.appendChild(t);
  morph.appendChild(b);
  return morph;
}

function saveAll() {
  chrome.storage.local.set({ customTabSettings: currentSettings });
  try {
    localStorage.setItem("fastLoadTab", JSON.stringify(currentSettings));
  } catch (e) {}
  applySettingsToDOM();
}

settingsBtn?.addEventListener("click", (e) => {
  if (isDragging) return;
  const isHidden = settingsPanel.classList.toggle("hidden");
  document.body.classList.toggle("edit-mode", !isHidden);
});
closeBtn?.addEventListener("click", () => {
  settingsPanel.classList.add("hidden");
  document.body.classList.remove("edit-mode");
});

const attachEvent = (id, eventType, callback) => {
  const el = document.getElementById(id);
  if (el) el.addEventListener(eventType, callback);
};
attachEvent("glass-theme-select", "change", (e) => {
  currentSettings.glassTheme = e.target.value;
  applySettingsToDOM();
  saveAll();
});
attachEvent("bg-type", "change", (e) => {
  currentSettings.bgType = e.target.value;
  toggleInputVisibility();
  if (currentSettings.bgType === "default")
    currentSettings.bgValue = DEFAULT_BG_IMAGE;
  applySettingsToDOM();
  saveAll();
});
attachEvent("bg-cover-style", "change", (e) => {
  currentSettings.bgCoverStyle = e.target.value;
  applySettingsToDOM();
  saveAll();
});
attachEvent("bg-file-input", "change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const input = e.target;
  const loadSequence = ++backgroundLoadSequence;
  if (file.type.startsWith("video/")) {
    if (activeVideoPreviewObjectUrl) {
      URL.revokeObjectURL(activeVideoPreviewObjectUrl);
      activeVideoPreviewObjectUrl = null;
    }
    activeVideoPreviewObjectUrl = URL.createObjectURL(file);
    saveLocalVideo(file);
    currentSettings.bgValue = "local-video-flag";
    currentSettings.bgVideoVersion = (currentSettings.bgVideoVersion || 0) + 1;
    applySettingsToDOM();
    saveAll();
    input.value = "";
    return;
  }
  const reader = new FileReader();
  reader.onload = (event) => {
    const img = new Image();
    img.onload = () => {
      if (loadSequence !== backgroundLoadSequence) return;
      const canvas = document.createElement("canvas");
      let width = img.width,
        height = img.height;
      if (width > height && width > 1920) {
        height *= 1920 / width;
        width = 1920;
      } else if (height > 1080) {
        width *= 1080 / height;
        height = 1080;
      }
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      currentSettings.bgValue = canvas.toDataURL("image/jpeg", 0.8);
      applySettingsToDOM();
      saveAll();
      input.value = "";
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
});
attachEvent("blur-slider", "input", (e) => {
  currentSettings.blur = e.target.value;
  applySettingsToDOM();
});
attachEvent("blur-slider", "change", () => saveAll());
attachEvent("opacity-slider", "input", (e) => {
  currentSettings.opacity = e.target.value;
  applySettingsToDOM();
});
attachEvent("opacity-slider", "change", () => saveAll());
attachEvent("accent-color-picker", "input", (e) => {
  currentSettings.accentColor = e.target.value;
  applySettingsToDOM();
});
attachEvent("accent-color-picker", "change", () => saveAll());
attachEvent("text-color-picker", "input", (e) => {
  currentSettings.textColor = e.target.value;
  applySettingsToDOM();
});
attachEvent("text-color-picker", "change", () => saveAll());
attachEvent("greeting-input", "input", (e) => {
  currentSettings.greeting = e.target.value;
  saveAll();
});
attachEvent("tab-title-input", "input", (e) => {
  currentSettings.tabTitle = e.target.value;
  saveAll();
});
attachEvent("clock-style", "change", (e) => {
  currentSettings.clockStyle = e.target.value;
  applySettingsToDOM();
  saveAll();
});
attachEvent("clock-format-toggle", "change", (e) => {
  currentSettings.clockFormat = e.target.checked ? "24" : "12";
  saveAll();
});
attachEvent("seconds-toggle", "change", (e) => {
  currentSettings.showSeconds = e.target.checked;
  saveAll();
});
attachEvent("ampm-toggle", "change", (e) => {
  currentSettings.showAmPm = e.target.checked;
  saveAll();
});
attachEvent("show-clock-toggle", "change", (e) => {
  currentSettings.showClock = e.target.checked;
  saveAll();
});
attachEvent("show-notes-toggle", "change", (e) => {
  currentSettings.showNotes = e.target.checked;
  saveAll();
});
attachEvent("show-pomodoro-toggle", "change", (e) => {
  currentSettings.showPomodoro = e.target.checked;
  saveAll();
});
attachEvent("show-links-toggle", "change", (e) => {
  currentSettings.showLinks = e.target.checked;
  saveAll();
});
attachEvent("show-todo-toggle", "change", (e) => {
  currentSettings.showTodo = e.target.checked;
  saveAll();
});
attachEvent("tab-icon-input", "change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    currentSettings.tabIcon = ev.target.result;
    saveAll();
  };
  reader.readAsDataURL(file);
});
