/**
 * AcadArchive — script.js
 * Repo: mansoorXcoder/academic-records
 *
 * Real folder structure (fetched from GitHub API):
 *   Root/
 *     Doc/
 *       JLPT/        ← 3 PDF files
 *       pro_ideas/   ← 19 files (PDFs + PNG + README)
 *     Lab/           ← contents loaded live
 *
 * ── HOW TO CONFIGURE ─────────────────────────────────────────────────────
 *  1. ALLOWED_FOLDERS controls which ROOT-level folders appear on home.
 *     Set to null to show ALL root folders.
 *  2. Add a GITHUB_TOKEN to raise API rate limit (60 → 5,000 req/hr).
 * ─────────────────────────────────────────────────────────────────────────
 */

/* ═══════════════════════════════════════════
   ░░ CONFIGURATION  ░░
═══════════════════════════════════════════ */

const REPO = "mansoorXcoder/records";

/**
 * Define which specific paths (folders or subfolders) are allowed to be browsed.
 * - Set to null or [] to allow ALL folders in the repository.
 * - Supports deep paths, e.g., ["Doc", "Lab/CN"]
 * - Automatically hides other non-matching folders at any level.
 * @type {string[] | null}
 */
const ALLOWED_PATHS = ["Lab/PE_lab\Doc"]; 
//D:\LE03\git\records\Lab\PE_lab\Doc

/**
 * Set to true to exclude hidden files/folders starting with "." (like .vscode)
 * @type {boolean}
 */
const EXCLUDE_HIDDEN = true;

/**
 * Checks if a path is allowed based on ALLOWED_PATHS configuration.
 */
function isPathAllowed(itemPath, isDir) {
  if (!ALLOWED_PATHS || ALLOWED_PATHS.length === 0) return true;

  const normalizedItem = itemPath.toLowerCase().replace(/\/+$/, "");

  return ALLOWED_PATHS.some(allowed => {
    const normalizedAllowed = allowed.toLowerCase().replace(/\/+$/, "");

    // 1. Exact match
    if (normalizedItem === normalizedAllowed) return true;

    // 2. Parent directory of an allowed path (must show it so user can click to go deeper)
    if (isDir && normalizedAllowed.startsWith(normalizedItem + "/")) return true;

    // 3. Child/descendant of an allowed path
    if (normalizedItem.startsWith(normalizedAllowed + "/")) return true;

    return false;
  });
}

/**
 * Main filter function to decide if an item should be shown.
 */
function shouldShowItem(item) {
  // Case 2: Exclude files/folders starting with "." if configured
  if (EXCLUDE_HIDDEN && item.name.startsWith(".")) {
    return false; // True or false
  }

  // Case 1: Exclude paths not matching ALLOWED_PATHS
  return isPathAllowed(item.path, item.type === "dir");
}

/** Optional GitHub Personal Access Token — raises rate limit to 5,000/hr */
const GITHUB_TOKEN = "";

const API_BASE = `https://api.github.com/repos/${REPO}/contents`;

/* ═══════════════════════════════════════════
   ░░ ICON MAP  ░░
   Maps root folder names to display icons.
   Add entries here for new top-level folders.
═══════════════════════════════════════════ */
const FOLDER_ICONS = {
  "Doc":       "📂",
  "Lab":       "🧪",
  "JLPT":      "🏯",
  "pro_ideas": "💡",
  // fallback handled in code
};

/* ═══════════════════════════════════════════
   ░░ STATE  ░░
═══════════════════════════════════════════ */

let navStack    = [];   // { name, path }[]
let currentFiles      = [];
let currentSubfolders = [];

/* ═══════════════════════════════════════════
   ░░ DOM REFERENCES  ░░
═══════════════════════════════════════════ */

const $ = id => document.getElementById(id);

const loader           = $("loader");
const errorBox         = $("errorBox");
const errorMsg         = $("errorMsg");
const retryBtn         = $("retryBtn");

const hero             = $("hero");
const folderGrid       = $("folderGrid");
const cardGrid         = $("cardGrid");

const fileSection      = $("fileSection");
const fileSectionLabel = $("fileSectionLabel");
const folderTitle      = $("folderTitle");
const subfolderGrid    = $("subfolderGrid");
const fileList         = $("fileList");
const zipBtn           = $("zipBtn");

const searchWrap       = $("searchWrap");
const searchInput      = $("searchInput");
const searchNotice     = $("searchNotice");
const searchNoticeText = $("searchNoticeText");

const breadcrumbBar    = $("breadcrumbBar");
const breadcrumb       = $("breadcrumb");

const modalOverlay     = $("modalOverlay");
const modalFilename    = $("modalFilename");
const modalBody        = $("modalBody");
const modalClose       = $("modalClose");

const homeBtn          = $("homeBtn");
const themeToggle      = $("themeToggle");
const themeIcon        = $("themeIcon");

/* ═══════════════════════════════════════════
   ░░ GITHUB API  ░░
═══════════════════════════════════════════ */

async function fetchContents(path = "") {
  const url     = path ? `${API_BASE}/${encodeURIPath(path)}` : API_BASE;
  const headers = { "Accept": "application/vnd.github+json" };
  if (GITHUB_TOKEN) headers["Authorization"] = `Bearer ${GITHUB_TOKEN}`;

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `HTTP ${res.status}`);
  }
  return res.json();
}

function encodeURIPath(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}

/* ═══════════════════════════════════════════
   ░░ UI HELPERS  ░░
═══════════════════════════════════════════ */

function showLoader()  { loader.style.display = "flex"; }
function hideLoader()  { loader.style.display = "none"; }
function showError(m)  { errorMsg.textContent = m; errorBox.style.display = "flex"; }
function hideError()   { errorBox.style.display = "none"; }

function hideAll() {
  hideLoader(); hideError();
  folderGrid.style.display  = "none";
  fileSection.style.display = "none";
  hero.style.display        = "none";
}

/** Return icon for a file by extension */
function fileIcon(name) {
  const ext = name.split(".").pop().toLowerCase();
  return {
    pdf:"📄", png:"🖼️", jpg:"🖼", jpeg:"🖼", gif:"🖼", svg:"🎨",
    mp4:"🎬", mp3:"🎵", zip:"🗜", rar:"🗜", docx:"📝", doc:"📝",
    pptx:"📊", ppt:"📊", xlsx:"📊", xls:"📊", txt:"📃", md:"📃",
    py:"🐍", js:"⚡", html:"🌐", css:"🎨", json:"📦", xml:"📦",exe:"🤫" ,c:"©️",csv:"📋",
  }[ext] || "📁";
}

/** Return icon for a folder by name, with fallback */
function folderIcon(name) {
  return FOLDER_ICONS[name] || "🗂";
}

function formatSize(bytes) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024)     return `${bytes} B`;
  if (bytes < 1048576)  return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function previewType(name) {
  const ext = name.split(".").pop().toLowerCase();
  if (ext === "pdf") return "pdf";
  if (["png","jpg","jpeg","gif","webp","svg"].includes(ext)) return "image";
  return null;
}

/* ═══════════════════════════════════════════
   ░░ BREADCRUMB  ░░
═══════════════════════════════════════════ */

function renderBreadcrumb() {
  breadcrumb.innerHTML = "";
  if (navStack.length === 0) { breadcrumbBar.style.display = "none"; return; }

  breadcrumbBar.style.display = "block";

  // Home
  const homeLi  = document.createElement("li");
  const homeBtn2 = document.createElement("button");
  homeBtn2.textContent = "Home";
  homeBtn2.addEventListener("click", goHome);
  homeLi.appendChild(homeBtn2);
  breadcrumb.appendChild(homeLi);

  // Intermediate levels
  navStack.slice(0, -1).forEach((item, idx) => {
    const li  = document.createElement("li");
    const btn = document.createElement("button");
    btn.textContent = item.name;
    btn.addEventListener("click", () => navigateTo(idx + 1));
    li.appendChild(btn);
    breadcrumb.appendChild(li);
  });

  // Current (last)
  const curLi   = document.createElement("li");
  const curSpan = document.createElement("span");
  curSpan.textContent = navStack.at(-1).name;
  curLi.appendChild(curSpan);
  breadcrumb.appendChild(curLi);
}

/* ═══════════════════════════════════════════
   ░░ VIEWS  ░░
═══════════════════════════════════════════ */

async function goHome() {
  navStack = [];
  renderBreadcrumb();
  hideAll(); showLoader();
  searchWrap.style.display = "none";
  searchInput.value        = "";

  try {
    const items = await fetchContents();
    const folders = items.filter(i => i.type === "dir" && shouldShowItem(i));

    hideLoader();
    hero.style.display       = "block";
    folderGrid.style.display = "block";
    cardGrid.innerHTML       = "";

    if (folders.length === 0) {
      cardGrid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <div class="empty-icon">📂</div>
          <p>No matching folders found in this repository.</p>
        </div>`;
      return;
    }

    folders.forEach((folder, i) => {
      cardGrid.appendChild(createFolderCard(folder.name, folder.path, i));
    });

  } catch (err) {
    hideLoader(); showError(err.message);
    retryBtn.onclick = goHome;
  }
}

async function openFolder(name, path) {
  navStack.push({ name, path });
  renderBreadcrumb();
  hideAll(); showLoader();
  searchInput.value = "";

  try {
    const items = await fetchContents(path);
    const folders = items.filter(i => i.type === "dir" && shouldShowItem(i));
    const files = items.filter(i => i.type === "file" && shouldShowItem(i));
     

    currentFiles      = files;
    currentSubfolders = folders;

    hideLoader();
    fileSection.style.display    = "block";
    searchWrap.style.display     = "flex";
    folderTitle.textContent      = name;
    fileSectionLabel.textContent = `Contents of ${name}`;

    // Subfolders
    subfolderGrid.innerHTML = "";
    if (folders.length > 0) {
      subfolderGrid.style.display = "grid";
      folders.forEach((f, i) =>
        subfolderGrid.appendChild(createFolderCard(f.name, f.path, i, true))
      );
    } else {
      subfolderGrid.style.display = "none";
    }

    renderFileList(files);

  } catch (err) {
    hideLoader(); showError(err.message);
    retryBtn.onclick = () => { navStack.pop(); openFolder(name, path); };
  }
}

function navigateTo(depth) {
  navStack = navStack.slice(0, depth);
  const { name, path } = navStack.at(-1);
  navStack.pop();
  openFolder(name, path);
}

/* ═══════════════════════════════════════════
   ░░ CARD FACTORY  ░░
═══════════════════════════════════════════ */

function createFolderCard(name, path, index, isSubfolder = false) {
  const card = document.createElement("div");
  card.className = "folder-card";
  card.style.animationDelay = `${index * 60}ms`;
  card.style.animation = "fadeUp 0.4s ease both";
  card.setAttribute("role", "button");
  card.setAttribute("tabindex", "0");
  card.setAttribute("aria-label", `Open folder ${name}`);

  const icon = isSubfolder ? (folderIcon(name)) : folderIcon(name);

  card.innerHTML = `
    <div class="card-icon">${icon}</div>
    <div class="card-name">${escapeHtml(name)}</div>
    <div class="card-meta">Folder · Click to browse</div>
  `;

  card.addEventListener("click", () => openFolder(name, path));
  card.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openFolder(name, path); }
  });

  return card;
}

/* ═══════════════════════════════════════════
   ░░ FILE LIST  ░░
═══════════════════════════════════════════ */

function renderFileList(files) {
  fileList.innerHTML = "";
  searchNotice.style.display = "none";

  if (files.length === 0) {
    fileList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <p>No files here — check the subfolders above.</p>
      </div>`;
    return;
  }

  files.forEach((file, i) => fileList.appendChild(createFileItem(file, i)));
}

function createFileItem(file, index) {
  const li   = document.createElement("li");
  li.className = "file-item";
  li.style.animationDelay = `${index * 40}ms`;

  const pType       = previewType(file.name);
  const downloadUrl = file.download_url;

  li.innerHTML = `
    <span class="file-icon">${fileIcon(file.name)}</span>
    <div class="file-info">
      <div class="file-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</div>
      <div class="file-size">${formatSize(file.size)}</div>
    </div>
    <div class="file-actions">
      ${pType ? `<button class="action-btn preview-btn">👁 Preview</button>` : ""}
      <a class="action-btn" href="${escapeHtml(downloadUrl)}" download="${escapeHtml(file.name)}"
         target="_blank" rel="noopener noreferrer">⬇ Download</a>
    </div>
  `;

  const previewBtn = li.querySelector(".preview-btn");
  if (previewBtn) {
    previewBtn.addEventListener("click", () => openPreview(file.name, downloadUrl, pType));
  }
  return li;
}

/* ═══════════════════════════════════════════
   ░░ PREVIEW MODAL  ░░
═══════════════════════════════════════════ */

function openPreview(name, url, type) {
  modalFilename.textContent = name;
  modalBody.innerHTML       = "";

  if (type === "image") {
    const img      = document.createElement("img");
    img.src        = url;
    img.alt        = name;
    img.style.cssText = "max-width:100%;max-height:75vh;object-fit:contain;";
    modalBody.appendChild(img);
  } else if (type === "pdf") {
    const iframe   = document.createElement("iframe");
    // Use Google Docs viewer for in-browser PDF preview
    iframe.src     = `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`;
    iframe.title   = name;
    iframe.setAttribute("allowfullscreen", "");
    modalBody.appendChild(iframe);
  } else {
    modalBody.innerHTML = `<p class="modal-no-preview">Preview not available for this file type.</p>`;
  }

  modalOverlay.style.display   = "flex";
  document.body.style.overflow = "hidden";
}

function closePreview() {
  modalOverlay.style.display   = "none";
  document.body.style.overflow = "";
  modalBody.innerHTML          = "";
}

/* ═══════════════════════════════════════════
   ░░ SEARCH  ░░
═══════════════════════════════════════════ */

function handleSearch() {
  const q = searchInput.value.trim().toLowerCase();
  if (!q) { renderFileList(currentFiles); return; }

  const filtered = currentFiles.filter(f => f.name.toLowerCase().includes(q));
  searchNotice.style.display  = "flex";
  searchNoticeText.textContent = `${filtered.length} result${filtered.length !== 1 ? "s" : ""} for "${q}"`;
  renderFileList(filtered);
}

/* ═══════════════════════════════════════════
   ░░ DOWNLOAD ALL  ░░
═══════════════════════════════════════════ */

async function downloadAllFiles() {
  if (currentFiles.length === 0) return;
  zipBtn.innerHTML = "⏳ Preparing…";
  zipBtn.disabled  = true;

  for (const file of currentFiles) {
    if (!file.download_url) continue;
    const a    = document.createElement("a");
    a.href     = file.download_url;
    a.download = file.name;
    a.target   = "_blank";
    a.rel      = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    await new Promise(r => setTimeout(r, 600));
  }

  zipBtn.innerHTML = "<span>⬇</span> Download All";
  zipBtn.disabled  = false;
}

/* ═══════════════════════════════════════════
   ░░ THEME  ░░
═══════════════════════════════════════════ */

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  themeIcon.textContent = theme === "dark" ? "☀" : "🌙";
  localStorage.setItem("acadarchive-theme", theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme");
  applyTheme(current === "dark" ? "light" : "dark");
}

/* ═══════════════════════════════════════════
   ░░ UTILITIES  ░░
═══════════════════════════════════════════ */

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* ═══════════════════════════════════════════
   ░░ EVENT LISTENERS  ░░
═══════════════════════════════════════════ */

homeBtn.addEventListener("click", goHome);
themeToggle.addEventListener("click", toggleTheme);
zipBtn.addEventListener("click", downloadAllFiles);

retryBtn.addEventListener("click", () => {
  hideError();
  navStack.length === 0 ? goHome() : (() => {
    const { name, path } = navStack.at(-1);
    navStack.pop(); openFolder(name, path);
  })();
});

let searchTimer;
searchInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(handleSearch, 220);
});

modalOverlay.addEventListener("click", e => { if (e.target === modalOverlay) closePreview(); });
modalClose.addEventListener("click", closePreview);
document.addEventListener("keydown", e => { if (e.key === "Escape") closePreview(); });

/* ═══════════════════════════════════════════
   ░░ INIT  ░░
═══════════════════════════════════════════ */

(function init() {
  const savedTheme = localStorage.getItem("acadarchive-theme") || "dark";
  applyTheme(savedTheme);
  goHome();
})();
