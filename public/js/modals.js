const modalRegistry = new Map();
const modalStack = [];
let globalHandlersBound = false;

function bindGlobalHandlers() {
  if (globalHandlersBound) return;
  globalHandlersBound = true;

  document.addEventListener('pointerdown', (event) => {
    const modal = getTopModal();
    if (!modal || !modal.closeOnOutside) return;
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (modal.surface.contains(target)) return;
    if (modal.ignoreElements.some((element) => element && element.contains(target))) return;
    closeModal(modal.id);
  }, true);

  window.addEventListener('keydown', (event) => {
    const modal = getTopModal();
    if (!modal) return;

    if (event.key === 'Escape' && modal.closeOnEscape) {
      event.preventDefault();
      event.stopPropagation();
      closeModal(modal.id);
      return;
    }

    if (event.key !== 'Tab') return;

    const focusable = getFocusableElements(modal.surface);
    if (!focusable.length) {
      ensureFocusable(modal.surface);
      modal.surface.focus();
      event.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && (active === first || !modal.surface.contains(active))) {
      last.focus();
      event.preventDefault();
      return;
    }

    if (!event.shiftKey && (active === last || !modal.surface.contains(active))) {
      first.focus();
      event.preventDefault();
    }
  }, true);
}

function resolveElement(reference) {
  if (!reference) return null;
  if (typeof reference === 'string') return document.querySelector(reference);
  return reference;
}

function ensureFocusable(element) {
  if (!(element instanceof HTMLElement)) return;
  if (element.tabIndex >= 0) return;
  element.tabIndex = -1;
}

function getFocusableElements(container) {
  if (!(container instanceof HTMLElement)) return [];
  return [...container.querySelectorAll(
    'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )].filter((element) => {
    if (!(element instanceof HTMLElement)) return false;
    if (element.getAttribute('aria-hidden') === 'true') return false;
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden';
  });
}

function focusModal(modal, preferredSelector) {
  const preferred = preferredSelector
    ? modal.surface.querySelector(preferredSelector)
    : modal.initialFocusSelector
      ? modal.surface.querySelector(modal.initialFocusSelector)
      : null;

  const nextFocus = preferred instanceof HTMLElement
    ? preferred
    : getFocusableElements(modal.surface)[0] || modal.surface;

  ensureFocusable(modal.surface);
  if (nextFocus instanceof HTMLElement) nextFocus.focus();
}

function getModalRecord(id) {
  const modal = modalRegistry.get(id);
  if (!modal) {
    throw new Error(`Unknown modal: ${id}`);
  }
  return modal;
}

function getTopModal() {
  const topId = modalStack[modalStack.length - 1];
  return topId ? modalRegistry.get(topId) : null;
}

export function registerModal({
  id,
  root,
  surface,
  openClass = 'active',
  closeSelectors = [],
  initialFocusSelector = '',
  closeOnOutside = true,
  closeOnEscape = true,
  ignoreElements = [],
  onOpen = null,
  onClose = null
}) {
  bindGlobalHandlers();

  const rootElement = resolveElement(root);
  const surfaceElement = resolveElement(surface) || rootElement;
  if (!(rootElement instanceof HTMLElement) || !(surfaceElement instanceof HTMLElement)) {
    throw new Error(`Modal ${id} is missing a valid root or surface element.`);
  }

  const modal = {
    id,
    root: rootElement,
    surface: surfaceElement,
    openClass,
    initialFocusSelector,
    closeOnOutside,
    closeOnEscape,
    ignoreElements: ignoreElements.map(resolveElement).filter(Boolean),
    onOpen,
    onClose,
    restoreFocusElement: null
  };

  closeSelectors.forEach((selector) => {
    rootElement.querySelectorAll(selector).forEach((button) => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        closeModal(id);
      });
    });
  });

  rootElement.setAttribute('aria-hidden', rootElement.classList.contains(openClass) ? 'false' : 'true');
  modalRegistry.set(id, modal);
  return modal;
}

export function isModalOpen(id) {
  return getModalRecord(id).root.classList.contains(getModalRecord(id).openClass);
}

export function isModalRegistered(id) {
  return modalRegistry.has(id);
}

export function isAnyModalOpen() {
  return modalStack.length > 0;
}

export function isNodeInsideOpenModal(node) {
  if (!(node instanceof Node)) return false;
  return modalStack.some((id) => modalRegistry.get(id)?.root.contains(node));
}

export function openModal(id, options = {}) {
  const modal = getModalRecord(id);
  if (!isModalOpen(id)) {
    modal.restoreFocusElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    modal.root.classList.add(modal.openClass);
    modal.root.setAttribute('aria-hidden', 'false');
  } else {
    const existingIndex = modalStack.indexOf(id);
    if (existingIndex >= 0) modalStack.splice(existingIndex, 1);
  }

  modalStack.push(id);
  if (typeof modal.onOpen === 'function') modal.onOpen(options);
  window.setTimeout(() => focusModal(modal, options.initialFocusSelector), 0);
}

export function closeModal(id, options = {}) {
  const modal = getModalRecord(id);
  if (!isModalOpen(id)) return;

  const stackIndex = modalStack.lastIndexOf(id);
  if (stackIndex >= 0) modalStack.splice(stackIndex, 1);

  modal.root.classList.remove(modal.openClass);
  modal.root.setAttribute('aria-hidden', 'true');
  if (typeof modal.onClose === 'function') modal.onClose(options);

  if (options.restoreFocus === false) return;
  if (modal.restoreFocusElement instanceof HTMLElement && modal.restoreFocusElement.isConnected) {
    modal.restoreFocusElement.focus();
  }
}
