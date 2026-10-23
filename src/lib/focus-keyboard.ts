/**
 * Getting the on-screen keyboard up for a field that doesn't exist yet.
 *
 * iOS Safari only opens the keyboard for a `.focus()` made inside the tap
 * itself, but a sheet's amount box mounts a render later — so its own focus
 * call is ignored and the caret sits there with no keyboard. The way round it
 * is to focus a stand-in input synchronously in the tap handler (keyboard
 * opens), then move focus to the real field once it mounts: iOS keeps the
 * keyboard up when focus passes from one input to another.
 */

let proxy: HTMLInputElement | null = null;

/** Call from the click handler that opens a sheet with a text field in it. */
export function primeKeyboard(inputMode: "decimal" | "text" = "decimal") {
  if (typeof document === "undefined") return;
  releaseKeyboardProxy();
  const input = document.createElement("input");
  input.setAttribute("inputmode", inputMode);
  input.setAttribute("aria-hidden", "true");
  input.tabIndex = -1;
  // 16px stops iOS zooming in on focus; off-screen but still "visible", which
  // iOS requires before it will focus anything.
  Object.assign(input.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "1px",
    height: "1px",
    opacity: "0",
    fontSize: "16px",
    pointerEvents: "none",
  });
  document.body.appendChild(input);
  input.focus();
  proxy = input;
}

/** Call once the real field has taken focus. */
export function releaseKeyboardProxy() {
  proxy?.remove();
  proxy = null;
}
