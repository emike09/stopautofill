let picking = false;
let box, toast;

function ensureUI() {
  if (!box) {
    box = document.createElement("div");
    box.id = "saf-picker-box";
    document.documentElement.appendChild(box);
  }
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "saf-picker-toast";
    toast.textContent = "Stop Autofill: Click an element to block • ESC to cancel";
    document.documentElement.appendChild(toast);
  }
}

function cleanupUI() {
  box?.remove(); box = null;
  toast?.remove(); toast = null;
}

function cssEscape(s) {
  return CSS?.escape ? CSS.escape(s) : s.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}

// "Good enough" selector builder (we'll improve later)
function buildSelector(el) {
  if (!(el instanceof Element)) return null;

  if (el.id) return `#${cssEscape(el.id)}`;

  const attrs = ["data-testid", "data-test", "data-qa", "name"];
  for (const a of attrs) {
    const v = el.getAttribute(a);
    if (v) return `${el.tagName.toLowerCase()}[${a}="${v.replace(/"/g, '\\"')}"]`;
  }

  // fallback: short path
  const parts = [];
  let cur = el;
  for (let i = 0; i < 4 && cur && cur.tagName; i++) {
    const tag = cur.tagName.toLowerCase();
    let part = tag;
    const cls = (cur.className || "").toString().trim().split(/\s+/).filter(Boolean)[0];
    if (cls) part += "." + cssEscape(cls);
    parts.unshift(part);
    cur = cur.parentElement;
  }
  return parts.join(" > ");
}

function highlight(el) {
  if (!box || !(el instanceof Element)) return;
  const r = el.getBoundingClientRect();
  box.style.left = `${Math.max(0, r.left)}px`;
  box.style.top = `${Math.max(0, r.top)}px`;
  box.style.width = `${Math.max(0, r.width)}px`;
  box.style.height = `${Math.max(0, r.height)}px`;
}

function onMove(e) {
  const el = document.elementFromPoint(e.clientX, e.clientY);
  if (el) highlight(el);
}

function stopPicking() {
  picking = false;
  window.removeEventListener("mousemove", onMove, true);
  window.removeEventListener("click", onClick, true);
  window.removeEventListener("keydown", onKey, true);
  cleanupUI();
}

async function onClick(e) {
  e.preventDefault();
  e.stopPropagation();

  const el = document.elementFromPoint(e.clientX, e.clientY);
  if (!el) return stopPicking();

  const selector = buildSelector(el);
  const tag = el.tagName.toLowerCase();
  const isForm = tag === "form" || !!el.closest("form");

  await chrome.runtime.sendMessage({
    type: "PICKER_RESULT",
    pick: {
      url: location.href,
      origin: location.origin,
      selector,
      tag,
      isForm
    }
  });

  stopPicking();
}

function onKey(e) {
  if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    stopPicking();
  }
}

function startPicking() {
  if (picking) return;
  picking = true;
  ensureUI();

  window.addEventListener("mousemove", onMove, true);
  window.addEventListener("click", onClick, true);
  window.addEventListener("keydown", onKey, true);
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "PICKER_START") startPicking();
});
