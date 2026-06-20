const INTERACTIVE_DIALOG_DRAG_TARGET_SELECTOR = [
  "a",
  "button",
  "input",
  "select",
  "textarea",
  "[contenteditable='true']",
  "[data-dialog-drag-exclude]",
  "[role='button']",
  "[role='radio']",
  "[role='switch']",
  "[role='tab']",
].join(",");

export function shouldStartDialogWindowDrag(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return false;
  }

  return target.closest(INTERACTIVE_DIALOG_DRAG_TARGET_SELECTOR) === null;
}
