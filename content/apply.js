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

  // Enable total counter to track all forms blocked across all sites over time
  const INCREMENT_TOTAL_ON_APPLY = true;
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
      
      // Add submit handler to restore original names before form submission
      if (!form.dataset.safSubmitHandler) {
        form.dataset.safSubmitHandler = "1";
        form.addEventListener("submit", (e) => {
          // Restore original field names right before submit
          const fields = form.querySelectorAll("input[data-original-name]");
          fields.forEach(field => {
            const originalName = field.getAttribute("data-original-name");
            if (originalName) {
              field.name = originalName;
            }
          });
        }, { capture: true });
      }
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

  function applyToField(field, opts, skipCounter = false) {
    if (!field || !inVisibleDom(field)) return 0;

    let touched = 0;

    // 1) Disable autofill
    if (opts.disableAutofill) {
      field.setAttribute("autocomplete", "off");
      
      // Extra aggressive: also try these
      field.setAttribute("autocorrect", "off");
      field.setAttribute("autocapitalize", "off");
      field.setAttribute("spellcheck", "false");
      
      // For Chrome which sometimes ignores autocomplete="off"
      if (field.name) {
        const randomSuffix = Math.random().toString(36).substring(7);
        field.setAttribute("data-original-name", field.name);
        field.name = field.name + "_saf_" + randomSuffix;
      }
      
      touched++;
    }

    // 2) Discourage password manager  
    if (opts.disablePasswordManager) {
      if (isPassword(field)) {
        field.setAttribute("autocomplete", "new-password");
        // Also try this for extra prevention
        field.setAttribute("data-lpignore", "true"); // LastPass
        field.setAttribute("data-form-type", "other"); // Some managers
        touched++;
      } else if (isTextLike(field)) {
        // Try to discourage username autofill
        field.setAttribute("autocomplete", "off");
        field.setAttribute("data-lpignore", "true");
        touched++;
      }
    }

    // 3) Optional readonly hack (enable for element rules)
    if (opts.disableAutofill && opts.useReadonlyHack) {
      installReadonlyHack(field);
      touched++;
    }

    // Count individual inputs (unless we're applying element rules which already counted)
    if (touched > 0 && !skipCounter && markInputCounted(field)) {
      // Already counted via form
    }

    return touched;
  }

  // ---- apply rules to page ----
  function applyRulesToPage() {
    if (!currentState || !currentState.data) return;

    const sync = currentState.data;
    const origin = getOrigin();
    const url = getUrl();

    // Global rule (site/page)
    const globalRule = effectiveGlobalRule(sync, origin, url);
    if (globalRule) {
      const opts = {
        disableAutofill: !!globalRule.rule.disableAutofill,
        disablePasswordManager: !!globalRule.rule.disablePasswordManager,
        useReadonlyHack: false // disabled by default for performance
      };

      // Apply to all forms
      const forms = safeQSAll("form");
      for (const form of forms) {
        applyToForm(form, opts);
      }

      // Apply to formless inputs
      const formlessInputs = safeQSAll("input:not(form input), textarea:not(form textarea)");
      for (const field of formlessInputs) {
        applyToField(field, opts);
      }
    }

    // Element rules
    const elemRules = enabledElementRules(sync, origin, url);
    console.log("[SAF] Checking element rules for", origin, "- Found:", elemRules.length);
    
    for (const rule of elemRules) {
      const ruleKey = `${rule.scope}:${rule.selector}:${rule.url || ""}`;
      if (matchedElementRuleKeys.has(ruleKey)) continue;

      console.log("[SAF] Applying element rule:", rule.selector);
      const matches = safeQSAll(rule.selector);
      console.log("[SAF] Found", matches.length, "matches for", rule.selector);
      
      if (matches.length === 0) continue;

      matchedElementRuleKeys.add(ruleKey);

      const opts = {
        disableAutofill: !!rule.disableAutofill,
        disablePasswordManager: !!rule.disablePasswordManager,
        useReadonlyHack: true  // Enable for element rules - user explicitly selected this field
      };

      for (const el of matches) {
        console.log("[SAF] Applying to element:", el);
        if (el instanceof HTMLFormElement) {
          applyToForm(el, opts);
        } else {
          // Skip counter for element rules - already incremented when rule was saved
          applyToField(el, opts, true);
        }
      }
    }
  }

  // ---- mutation observer ----
  function startObserver() {
    if (observer) return;

    observer = new MutationObserver(() => {
      applyRulesToPage();
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  function stopObserver() {
    if (!observer) return;
    observer.disconnect();
    observer = null;
  }

  // ---- initialization ----
  async function init() {
    if (!isEligiblePage()) {
      console.log("[SAF] Not eligible page:", location.protocol);
      return;
    }

    console.log("[SAF] Initializing on", location.href);
    currentState = await getState();
    if (!currentState) {
      console.log("[SAF] Failed to get state");
      return;
    }

    console.log("[SAF] Got state:", currentState);
    applyRulesToPage();
    startObserver();
  }

  // ---- reload on state update ----
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "STATE_UPDATED") {
      init();
    }
  });

  // ---- start ----
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
