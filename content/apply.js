// content/apply.js
// Applies Stop Autofill rules to the current page (global + element rules).
// Best-effort: some sites fight back, but this catches most normal pages.
//
// IMPORTANT: run this script at "document_start" in manifest.json.

(() => {
  const SAFE_PROTO = new Set(["http:", "https:"]);

  // Track what we've already counted/applied this page load
  const countedForms = new WeakSet();
  const countedInputs = new WeakSet();
  const matchedElementRuleKeys = new Set();

  let lastUrl = location.href;
  let currentState = null;
  let observer = null;

  // ---- small helpers ----
  const isEligiblePage = () => SAFE_PROTO.has(location.protocol);

  const isTextLike = (el) => {
    if (!(el instanceof HTMLInputElement)) return false;
    const t = (el.type || "text").toLowerCase();
    return ["text","email","search","tel","url","number","password"].includes(t);
  };

  const isPassword = (el) =>
    el instanceof HTMLInputElement && (el.type || "").toLowerCase() === "password";

  const inVisibleDom = (el) => !!(el && el.isConnected);

  const getOrigin = () => location.origin;
  const getUrl = () => location.href;

  function safeQSAll(sel, root = document) {
    try { return Array.from(root.querySelectorAll(sel)); } catch { return []; }
  }

  function closestForm(el) {
    if (!el) return null;
    return el.closest ? el.closest("form") : null;
  }

  // ---- messaging ----
  async function getState() {
    try {
      const resp = await chrome.runtime.sendMessage({ type: "GET_STATE", url: getUrl() });
      if (!resp?.ok) return null;
      return resp;
    } catch {
      return null;
    }
  }

  function incrPage(delta) {
    try { chrome.runtime.sendMessage({ type: "INCR_PAGE", delta }); } catch {}
  }

  // Optional: Only enable if you REALLY want totals to climb based on page-level application.
  // Otherwise keep totals incrementing only on Save in confirm.js (element rules), or by your own logic.
  const INCREMENT_TOTAL_ON_APPLY = false;
  function incrTotal(delta) {
    if (!INCREMENT_TOTAL_ON_APPLY) return;
    try { chrome.runtime.sendMessage({ type: "INCR_TOTAL", delta }); } catch {}
  }

  // ---- rule evaluation ----
  function effectiveGlobalRule(sync, origin, url) {
    // page overrides site if enabled; otherwise site; otherwise null.
    const page = sync?.rules?.page?.[url];
    const site = sync?.rules?.site?.[origin];

    if (page?.enabled) return { scope: "page", rule: page };
    if (site?.enabled) return { scope: "site", rule: site };
    return null;
  }

  function enabledElementRules(sync, origin, url) {
    const arr = sync?.rules?.element?.[origin];
    if (!Array.isArray(arr)) return [];

    return arr.filter(r =>
      r &&
      r.enabled &&
      typeof r.selector === "string" &&
      r.selector.trim().length > 0 &&
      (r.scope === "site" || (r.scope === "page" && r.url === url))
    );
  }

  // ---- actual suppression logic ----
  function markFormCounted(form) {
    if (!form || countedForms.has(form)) return false;
    countedForms.add(form);
    return true;
  }

  function markInputCounted(input) {
    if (!input || countedInputs.has(input)) return false;
    countedInputs.add(input);
    return true;
  }

  function applyToForm(form, opts) {
    if (!(form instanceof HTMLFormElement)) return 0;

    // form-level autocomplete off (best-effort)
    if (opts.disableAutofill) {
      form.setAttribute("autocomplete", "off");
    }

    // Apply to inputs inside this form
    let touched = 0;
    const inputs = safeQSAll("input, textarea, select", form);
    for (const el of inputs) {
      touched += applyToField(el, opts);
    }

    // Count once per form when we actually touch something
    if (touched > 0 && markFormCounted(form)) {
      incrPage(1);
      incrTotal(1);
    }

    return touched;
  }

  function installReadonlyHack(field) {

    if (!field || field.dataset?.safReadonlyHack === "1") return;

    // Avoid breaking fields that are already readonly/disabled
    if (field.readOnly || field.disabled) return;

    // Only apply to text-like inputs + textareas
    const isOk =
      (field instanceof HTMLInputElement && isTextLike(field)) ||
      (field instanceof HTMLTextAreaElement);

    if (!isOk) return;

    field.dataset.safReadonlyHack = "1";
    field.readOnly = true;

    const remove = () => {
      try { field.readOnly = false; } catch {}
    };

    // remove on interaction
    field.addEventListener("focus", remove, { once: true, capture: true });
    field.addEventListener("keydown", remove, { once: true, capture: true });
    field.addEventListener("pointerdown", remove, { once: true, capture: true });
  }

  function applyToField(
::contentReference[oaicite:0]{index=0}
