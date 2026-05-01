// CSSOS_PHASE2_INPUT_GUARDRAILS 20260420 #84
// ---------------------------------------------------------------------------
// Two small globally-installed UX guardrails:
//
//   (1) When the user right-clicks or long-presses on anything that wasn't
//       already a text selection, don't leave a random word highlighted.
//       Pre-existing selections are preserved so "select → right-click → copy"
//       still works.
//
//   (2) When the user right-clicks or long-presses on an interactive element
//       (button, checkbox, radio, role="button", opt-in via
//       data-no-context-menu), don't pop the native/OS context menu. Elements
//       that want a custom contextmenu can register their own listener +
//       call preventDefault() first — we only act when nobody else did.
//
// Non-module script; top-level IIFE, idempotent via __cssosInputGuardrails.
// ---------------------------------------------------------------------------
(function installInputGuardrails() {
  if (globalThis.__cssosInputGuardrails) return;
  globalThis.__cssosInputGuardrails = true;

  // Elements where we want long-press / right-click to be a no-op. Notably
  // omits <a>, <input type="text">, <textarea> — those have useful native
  // context menus (open-in-new-tab, paste, spellcheck) that we shouldn't
  // remove.
  const INTERACTIVE_SEL = [
    "button",
    '[role="button"]',
    'input[type="button"]',
    'input[type="submit"]',
    'input[type="reset"]',
    'input[type="checkbox"]',
    'input[type="radio"]',
    'input[type="image"]',
    'input[type="file"]',
    "select",
    "[data-no-context-menu]",
  ].join(",");

  function isEditableTarget(target) {
    if (!target) return false;
    if (target instanceof HTMLInputElement) {
      const t = String(target.type || "").toLowerCase();
      // Text-like inputs: let the browser do its thing (paste, etc.)
      if (
        t === "text" ||
        t === "search" ||
        t === "email" ||
        t === "tel" ||
        t === "url" ||
        t === "password" ||
        t === "number" ||
        t === ""
      )
        return true;
    }
    if (target instanceof HTMLTextAreaElement) return true;
    if (target.isContentEditable) return true;
    return false;
  }

  function clearTransientSelection() {
    try {
      const sel = globalThis.getSelection && globalThis.getSelection();
      if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
        sel.removeAllRanges();
      }
    } catch (_err) {}
  }

  function selectionCurrentlyEmpty() {
    try {
      const sel = globalThis.getSelection && globalThis.getSelection();
      return !sel || sel.rangeCount === 0 || sel.isCollapsed;
    } catch (_err) {
      return true;
    }
  }

  // Track whether a selection existed just before the right-click / long-press
  // so we can distinguish "user had text selected → right-click for copy"
  // (keep selection) from "user right-clicked empty space → browser auto-
  // selected a word" (clear selection).
  let priorSelectionWasEmpty = true;

  document.addEventListener(
    "mousedown",
    (ev) => {
      if (ev.button !== 2) return;
      priorSelectionWasEmpty = selectionCurrentlyEmpty();
    },
    true
  );

  document.addEventListener(
    "touchstart",
    () => {
      priorSelectionWasEmpty = selectionCurrentlyEmpty();
    },
    { passive: true, capture: true }
  );

  document.addEventListener(
    "contextmenu",
    (ev) => {
      const target = ev.target;

      // (2) Suppress native context menu on interactive elements — unless a
      // custom handler already called preventDefault() or the target is an
      // editable field (which deserves its browser-provided context menu).
      if (!ev.defaultPrevented && !isEditableTarget(target)) {
        const interactive =
          target && typeof target.closest === "function"
            ? target.closest(INTERACTIVE_SEL)
            : null;
        if (interactive) {
          ev.preventDefault();
        }
      }

      // (1) Clear any selection the right-click JUST created, but only if
      // the user didn't have one already. Skip editable fields entirely.
      if (!isEditableTarget(target) && priorSelectionWasEmpty) {
        // Next-tick so any contextmenu consumer that reads the selection
        // still sees it first.
        setTimeout(clearTransientSelection, 0);
      }
      priorSelectionWasEmpty = true;
    },
    false
  );
})();
