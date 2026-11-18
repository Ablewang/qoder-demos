import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import '../styles/global.css';
import { createVelocityTracker, haptic, lockAxis, prefersReducedMotion, sheetDismissDistance, sheetOffset, shouldDismissSheet } from './gesture';
import styles from './ui.module.css';

const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(' ');

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, disabled, type = 'button', className, children, ...props },
  ref,
) {
  return (
    <button
      {...props}
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || props['aria-busy']}
      className={cx(styles.button, styles[`button_${variant}`], size === 'sm' && styles.buttonSm, loading && styles.buttonLoading, className)}
    >
      <span className={styles.buttonContent}>{children}</span>
      {loading && (
        <span className={styles.buttonSpinner}>
          <Spinner size={16} />
          <span className={styles.loadingText}>加载中</span>
        </span>
      )}
    </button>
  );
});

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  'aria-label': string;
  size?: 'sm' | 'md';
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { size = 'md', type = 'button', className, children, ...props },
  ref,
) {
  return (
    <button {...props} ref={ref} type={type} className={cx(styles.iconButton, size === 'sm' && styles.iconButtonSm, className)}>
      <span className={styles.iconContent} aria-hidden="true">{children}</span>
    </button>
  );
});

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
}

export const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  { selected = false, type = 'button', className, children, ...props },
  ref,
) {
  return (
    <button {...props} ref={ref} type={type} aria-pressed={selected} className={cx(styles.chip, selected && styles.chipSelected, className)}>
      {children}
    </button>
  );
});

export type CardProps = HTMLAttributes<HTMLDivElement>;

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, children, ...props },
  ref,
) {
  return <div {...props} ref={ref} className={cx(styles.card, className)}>{children}</div>;
});

export interface BadgeProps {
  children: ReactNode;
  tone?: 'neutral' | 'green' | 'orange';
}

export function Badge({ children, tone = 'neutral' }: BadgeProps) {
  return <span className={cx(styles.badge, styles[`badge_${tone}`])}>{children}</span>;
}

export interface SpinnerProps {
  size?: number;
  className?: string;
}

export function Spinner({ size = 20, className }: SpinnerProps) {
  return (
    <span className={cx(styles.spinner, className)} style={{ width: size, height: size }} aria-hidden="true">
      <svg className={styles.spinnerGraphic} viewBox="0 0 24 24" fill="none">
        <circle className={styles.spinnerTrack} cx="12" cy="12" r="9" strokeWidth="1.5" />
        <path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export interface SkeletonProps {
  className?: string;
  style?: CSSProperties;
}

export function Skeleton({ className, style }: SkeletonProps) {
  return <span className={cx(styles.skeleton, className)} style={style} aria-hidden="true" />;
}

export function LumiMark({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg className={cx(styles.lumiMark, className)} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <rect width="64" height="64" rx="16" />
      <path d="M22 17v30h25" fill="none" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="43" cy="21" r="5" />
    </svg>
  );
}

const modalStack: HTMLElement[] = [];
const inertLocks = new WeakMap<Element, { count: number; original: string | null }>();
let bodyLockCount = 0;
let savedBodyStyle = { overflow: '', paddingRight: '' };

function lockBodyScroll() {
  const body = document.body;
  if (bodyLockCount++ === 0) {
    savedBodyStyle = { overflow: body.style.overflow, paddingRight: body.style.paddingRight };
    const scrollbarWidth = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${parseFloat(window.getComputedStyle(body).paddingRight || '0') + scrollbarWidth}px`;
    }
    body.style.overflow = 'hidden';
  }
  return () => {
    if (--bodyLockCount === 0) {
      body.style.overflow = savedBodyStyle.overflow;
      body.style.paddingRight = savedBodyStyle.paddingRight;
    }
  };
}

function lockBackground(backdrop: HTMLElement) {
  const elements = Array.from(document.body.children).filter(
    (element) => element !== backdrop && !element.hasAttribute('data-lumi-toast'),
  );
  for (const element of elements) {
    const lock = inertLocks.get(element) ?? { count: 0, original: element.getAttribute('inert') };
    lock.count++;
    inertLocks.set(element, lock);
    element.setAttribute('inert', '');
  }
  return () => {
    for (const element of elements) {
      const lock = inertLocks.get(element);
      if (!lock || --lock.count > 0) continue;
      if (lock.original === null) element.removeAttribute('inert');
      else element.setAttribute('inert', lock.original);
      inertLocks.delete(element);
    }
  };
}

const focusableSelector = [
  'a[href]', 'area[href]', 'button', 'input', 'select', 'textarea',
  '[tabindex]', '[contenteditable="true"]', 'audio[controls]', 'video[controls]', 'summary',
].join(',');

function getFocusableElements(dialog: HTMLElement) {
  return Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector)).filter(
    (element) => element.tabIndex >= 0
      && !element.matches(':disabled')
      && !element.closest('[hidden], [inert], [aria-hidden="true"]')
      && element.getClientRects().length > 0
      && window.getComputedStyle(element).visibility !== 'hidden',
  );
}

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  heading?: ReactNode;
  variant?: 'sheet' | 'drawer';
  children: ReactNode;
}

const sheetQuery = '(max-width: 767px)';
const drawerQuery = '(max-width: 1023px)';
const noDragSelector = '[data-sheet-nodrag], input, textarea, select, [contenteditable="true"]';

export function Modal({ open, onClose, title, heading, variant = 'sheet', children }: ModalProps) {
  const drawer = variant === 'drawer';
  const titleId = useId();
  const backdropRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const closingRef = useRef(false);
  const [closing, setClosing] = useState(false);
  if (!open && closing) setClosing(false);

  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    if (!dialogRef.current || prefersReducedMotion()) {
      closeRef.current();
      return;
    }
    closingRef.current = true;
    dialogRef.current.style.removeProperty('transition');
    backdropRef.current?.style.removeProperty('--backdrop-transition');
    setClosing(true);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!closing || !dialog) return;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      closingRef.current = false;
      setClosing(false);
      closeRef.current();
    };
    const handleEnd = (event: AnimationEvent) => {
      if (event.target === dialog && /(sheet|modal|drawer)Out/.test(event.animationName)) finish();
    };
    const timer = window.setTimeout(finish, 400);
    dialog.addEventListener('animationend', handleEnd);
    return () => {
      window.clearTimeout(timer);
      dialog.removeEventListener('animationend', handleEnd);
    };
  }, [closing]);

  useEffect(() => {
    const dialog = dialogRef.current;
    const backdrop = backdropRef.current;
    const body = bodyRef.current;
    if (!open || !dialog || !backdrop || !body) return;
    const isTop = () => modalStack[modalStack.length - 1] === dialog;
    const velocity = createVelocityTracker();
    let start: { x: number; y: number; zone: 'header' | 'body'; target: Element } | null = null;
    let dragFrom: number | null = null;
    let offset = 0;
    let armed = false;

    const entering = () => dialog.getAnimations().some((animation) => animation.playState === 'running');
    const scrolledToTop = (target: Element) => {
      for (let node: Element | null = target; node && dialog.contains(node); node = node.parentElement) {
        if (node.scrollTop > 0) return false;
        if (node === body) return true;
      }
      return true;
    };
    const release = () => {
      const reduced = prefersReducedMotion();
      dialog.style.transition = reduced ? 'none' : 'transform var(--duration-slow) var(--ease-enter)';
      dialog.style.removeProperty('transform');
      if (reduced) backdrop.style.setProperty('--backdrop-transition', 'none');
      else backdrop.style.removeProperty('--backdrop-transition');
      backdrop.style.removeProperty('--backdrop-opacity');
    };
    const reset = () => {
      const dragged = dragFrom !== null;
      start = null;
      dragFrom = null;
      offset = 0;
      if (dragged) release();
    };

    const onTouchStart = (event: TouchEvent) => {
      start = null;
      if (event.touches.length !== 1) { reset(); return; }
      const target = event.target;
      if (closingRef.current || !isTop() || entering() || !matchMedia(drawer ? drawerQuery : sheetQuery).matches || !(target instanceof Element)) return;
      const zone = target.closest(`.${styles.sheetHandle}, .${styles.modalHeader}`) ? 'header' : body.contains(target) ? 'body' : null;
      if (!zone || ((drawer || zone === 'body') && target.closest(noDragSelector))) return;
      start = { x: event.touches[0].clientX, y: event.touches[0].clientY, zone, target };
      dragFrom = null;
      velocity.reset();
      velocity.add(0, event.timeStamp);
    };

    const onTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (closingRef.current) { start = null; dragFrom = null; return; }
      if (!start || !touch) return;
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      if (drawer) {
        if (dragFrom === null) {
          if (!event.cancelable) { start = null; return; }
          const axis = lockAxis(dx, dy);
          if (!axis) return;
          if (axis === 'y') { start = null; return; }
          dragFrom = 0;
          armed = false;
          dialog.style.transition = 'none';
          backdrop.style.setProperty('--backdrop-transition', 'none');
        }
        event.preventDefault();
        offset = sheetOffset(-dx);
        velocity.add(offset, event.timeStamp);
        const width = dialog.offsetWidth || 1;
        dialog.style.transform = `translateX(${-offset}px)`;
        backdrop.style.setProperty('--backdrop-opacity', String(1 - Math.min(1, Math.max(0, offset) / width) * 0.8));
        const crossed = offset >= sheetDismissDistance(width);
        if (crossed !== armed) {
          armed = crossed;
          if (crossed) haptic();
        }
        return;
      }
      if (dragFrom === null) {
        if (!event.cancelable) { start = null; return; }
        if (start.zone === 'body') {
          if (!scrolledToTop(start.target) || (dy < 0 && lockAxis(dx, dy))) { start = null; return; }
          if (dy <= 0) return;
          if (Math.abs(dx) > Math.abs(dy)) {
            if (lockAxis(dx, dy)) start = null;
            return;
          }
          event.preventDefault();
        }
        const axis = lockAxis(dx, dy);
        if (!axis) return;
        if (axis === 'x') { start = null; return; }
        dragFrom = 0;
        armed = false;
        dialog.style.transition = 'none';
        backdrop.style.setProperty('--backdrop-transition', 'none');
      }
      if (event.cancelable) event.preventDefault();
      offset = sheetOffset(dy - dragFrom);
      velocity.add(offset, event.timeStamp);
      const height = dialog.offsetHeight || 1;
      dialog.style.transform = `translateY(${offset}px)`;
      backdrop.style.setProperty('--backdrop-opacity', String(1 - Math.min(1, Math.max(0, offset) / height) * 0.8));
      const crossed = offset >= sheetDismissDistance(height);
      if (crossed !== armed) {
        armed = crossed;
        if (crossed) haptic();
      }
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (dragFrom === null) { start = null; return; }
      if (event.cancelable) event.preventDefault();
      velocity.add(offset, event.timeStamp);
      const dismiss = shouldDismissSheet(offset, velocity.velocity(), (drawer ? dialog.offsetWidth : dialog.offsetHeight) || 1);
      start = null;
      dragFrom = null;
      offset = 0;
      if (dismiss) requestClose();
      else release();
    };

    const onTransitionEnd = (event: TransitionEvent) => {
      if (event.target === dialog && dragFrom === null) dialog.style.removeProperty('transition');
    };

    dialog.addEventListener('touchstart', onTouchStart, { passive: true });
    dialog.addEventListener('touchmove', onTouchMove, { passive: false });
    dialog.addEventListener('touchend', onTouchEnd, { passive: false });
    dialog.addEventListener('touchcancel', reset);
    dialog.addEventListener('transitionend', onTransitionEnd);
    return () => {
      dialog.removeEventListener('touchstart', onTouchStart);
      dialog.removeEventListener('touchmove', onTouchMove);
      dialog.removeEventListener('touchend', onTouchEnd);
      dialog.removeEventListener('touchcancel', reset);
      dialog.removeEventListener('transitionend', onTransitionEnd);
      dialog.style.removeProperty('transform');
      dialog.style.removeProperty('transition');
      for (const name of ['--backdrop-opacity', '--backdrop-transition']) backdrop.style.removeProperty(name);
    };
  }, [open, requestClose, drawer]);

  useEffect(() => {
    const dialog = dialogRef.current;
    const backdrop = backdropRef.current;
    if (!open || !dialog || !backdrop) return;

    closingRef.current = false;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    modalStack.push(dialog);
    const unlockScroll = lockBodyScroll();
    const focusTitle = () => (titleRef.current ?? dialog).focus({ preventScroll: true });
    const isTop = () => modalStack[modalStack.length - 1] === dialog;
    focusTitle();
    const unlockBackground = lockBackground(backdrop);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isTop()) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        requestClose();
      } else if (event.key === 'Tab') {
        const elements = getFocusableElements(dialog);
        const index = elements.indexOf(document.activeElement as HTMLElement);
        if (elements.length === 0) {
          event.preventDefault();
          focusTitle();
        } else if (index < 0 || (event.shiftKey && index === 0) || (!event.shiftKey && index === elements.length - 1)) {
          event.preventDefault();
          elements[event.shiftKey ? elements.length - 1 : 0].focus();
        }
      }
    };
    const handleFocus = (event: FocusEvent) => {
      if (isTop() && event.target instanceof Node && !dialog.contains(event.target)) focusTitle();
    };

    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('focusin', handleFocus, true);
    return () => {
      const wasTop = isTop();
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('focusin', handleFocus, true);
      const index = modalStack.indexOf(dialog);
      if (index !== -1) modalStack.splice(index, 1);
      unlockBackground();
      unlockScroll();
      if (wasTop) {
        if (previousFocus?.isConnected && !previousFocus.closest('[inert]')) previousFocus.focus({ preventScroll: true });
        else modalStack[modalStack.length - 1]?.focus({ preventScroll: true });
      }
    };
  }, [open, requestClose]);

  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <div
      ref={backdropRef}
      className={cx(styles.modalBackdrop, drawer && styles.drawer, closing && styles.modalClosing)}
      onClick={(event) => {
        if (event.target === event.currentTarget && modalStack[modalStack.length - 1] === dialogRef.current) requestClose();
      }}
    >
      <section ref={dialogRef} className={styles.modal} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        onClickCapture={event => { if (closingRef.current) { event.preventDefault(); event.stopPropagation(); } }}>
        <div className={styles.sheetHandle} aria-hidden="true" />
        <header className={styles.modalHeader}>
          <h2 ref={titleRef} id={titleId} className={styles.modalTitle} tabIndex={-1} aria-label={heading ? title : undefined}>{heading ?? title}</h2>
          <IconButton aria-label="关闭弹窗" onClick={() => requestClose()}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </IconButton>
        </header>
        <div ref={bodyRef} className={styles.modalBody}>{children}</div>
      </section>
    </div>,
    document.body,
  );
}

interface ToastContextValue {
  toast: (text: string) => void;
  undo: (text: string, onUndo: () => void) => void;
}

type UndoMessage = { id: number; text: string; onUndo: () => void; expiresAt: number };

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<{ id: number; text: string } | null>(null);
  const [undoMessage, setUndoMessage] = useState<UndoMessage | null>(null);
  const undoRef = useRef<UndoMessage | null>(null);
  const nextId = useRef(0);
  const toast = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const id = ++nextId.current;
    setMessage((current) => current?.text === trimmed ? current : { id, text: trimmed });
  }, []);
  const undo = useCallback((text: string, onUndo: () => void) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const next = { id: ++nextId.current, text: trimmed, onUndo, expiresAt: Date.now() + 8000 };
    undoRef.current = next;
    setUndoMessage(next);
  }, []);
  const value = useMemo(() => ({ toast, undo }), [toast, undo]);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), 4000);
    return () => window.clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    if (!undoMessage) return;
    const timer = window.setTimeout(() => {
      if (undoRef.current?.id !== undoMessage.id) return;
      undoRef.current = null;
      setUndoMessage(null);
    }, Math.max(0, undoMessage.expiresAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [undoMessage]);

  const restore = useCallback((id: number) => {
    const current = undoRef.current;
    if (!current || current.id !== id) return;
    undoRef.current = null;
    setUndoMessage(null);
    if (Date.now() >= current.expiresAt) return;
    current.onUndo();
    toast('已恢复到本地清单');
  }, [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {typeof document !== 'undefined' && createPortal(
        <div className={styles.toastViewport} data-lumi-toast="" role="status" aria-live="polite" aria-atomic="true">
          {undoMessage && <div key={undoMessage.id} className={cx(styles.toast, styles.undoToast)}>
            <div className={styles.undoText}>{undoMessage.text}<span className={styles.undoHint}>8 秒内可撤销</span></div>
            <Button variant="secondary" size="sm" className={styles.undoButton} onClick={() => restore(undoMessage.id)}>撤销删除</Button>
          </div>}
          {message && <div key={message.id} className={styles.toast}>{message.text}</div>}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast 必须在 ToastProvider 内使用');
  return context;
}
