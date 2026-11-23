// Guided tutorial: steps through every page and control, highlighting each one.
//
// The highlight is a cut-out in a dimmed layer that ignores the pointer, so
// people can use the highlighted control while the step explains it.

export interface TourStep {
  title: string;
  /** HTML; keep it short. A "Try" line suggests something to do right now. */
  body: string;
  /** Sidebar page to open first. */
  page?: string;
  /** Element to highlight; none = a centred card. */
  target?: () => Element | null;
}

const KEY_SEEN = 'photographysim.tourSeen';

export class Tour {
  private root: HTMLElement;
  private spot: HTMLElement;
  private card: HTMLElement;
  private index = 0;
  private active = false;
  private raf = 0;
  private target: Element | null = null;

  constructor(
    private steps: TourStep[],
    private showPage: (id: string) => void,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'tour';
    this.root.hidden = true;
    this.spot = document.createElement('div');
    this.spot.className = 'tour-spot';
    this.card = document.createElement('div');
    this.card.className = 'tour-card';
    this.card.setAttribute('role', 'dialog');
    this.card.setAttribute('aria-live', 'polite');
    this.root.append(this.spot, this.card);
    document.body.appendChild(this.root);
    window.addEventListener('keydown', (e) => {
      if (!this.active) return;
      const typing = (e.target as HTMLElement | null)?.closest?.('input, select, textarea');
      if (e.key === 'Escape') this.end();
      else if (typing) return;
      else if (e.key === 'ArrowRight') this.go(this.index + 1);
      else if (e.key === 'ArrowLeft') this.go(this.index - 1);
    });
  }

  get isOpen(): boolean {
    return this.active;
  }

  /** True until someone has opened the tutorial once. */
  static get unseen(): boolean {
    try {
      return !localStorage.getItem(KEY_SEEN);
    } catch {
      return false;
    }
  }

  start(at = 0) {
    try {
      localStorage.setItem(KEY_SEEN, '1');
    } catch {
      /* storage blocked */
    }
    this.active = true;
    this.root.hidden = false;
    this.go(at);
    const tick = () => {
      if (!this.active) return;
      this.place();
      this.raf = requestAnimationFrame(tick);
    };
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(tick);
  }

  end() {
    this.active = false;
    this.root.hidden = true;
    cancelAnimationFrame(this.raf);
  }

  private go(i: number) {
    if (i < 0) return;
    if (i >= this.steps.length) return this.end();
    this.index = i;
    const step = this.steps[i];
    if (step.page) this.showPage(step.page);
    this.target = step.target?.() ?? null;
    // Bring the control into view inside the scrolling page.
    if (this.target instanceof HTMLElement && this.target.closest('.pages')) {
      this.target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    const last = i === this.steps.length - 1;
    this.card.innerHTML = `
      <div class="tour-top"><span class="tour-count">${i + 1} / ${this.steps.length}</span><button class="tour-close" title="Close (Esc)" aria-label="Close tutorial">×</button></div>
      <h3>${step.title}</h3>
      <div class="tour-body">${step.body}</div>
      <div class="tour-bar"><span style="width:${((i + 1) / this.steps.length) * 100}%"></span></div>
      <div class="tour-actions">
        <button class="tour-back" ${i === 0 ? 'disabled' : ''}>Back</button>
        <button class="primary tour-next">${last ? 'Finish' : 'Next'}</button>
      </div>`;
    this.card.querySelector('.tour-close')!.addEventListener('click', () => this.end());
    this.card.querySelector('.tour-back')!.addEventListener('click', () => this.go(this.index - 1));
    this.card.querySelector('.tour-next')!.addEventListener('click', () => this.go(this.index + 1));
    this.card.classList.toggle('centered', !this.target);
    this.spot.classList.toggle('none', !this.target);
    this.place();
    (this.card.querySelector('.tour-next') as HTMLElement).focus({ preventScroll: true });
  }

  /** Follow the target every frame: pages scroll, panels resize. */
  private place() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cw = this.card.offsetWidth;
    const ch = this.card.offsetHeight;
    const r0 = this.target?.getBoundingClientRect();
    // Missing or hidden (e.g. a light's controls while that light is off): centre the card.
    if (!this.target || !this.target.isConnected || !r0 || (r0.width === 0 && r0.height === 0)) {
      this.spot.style.cssText = 'left:50%;top:50%;width:0;height:0';
      this.card.style.left = `${Math.max(8, (vw - cw) / 2)}px`;
      this.card.style.top = `${Math.max(8, (vh - ch) / 2)}px`;
      return;
    }
    const r = this.target.getBoundingClientRect();
    const pad = 6;
    this.spot.style.left = `${r.left - pad}px`;
    this.spot.style.top = `${r.top - pad}px`;
    this.spot.style.width = `${r.width + pad * 2}px`;
    this.spot.style.height = `${r.height + pad * 2}px`;

    // Put the card beside the target, on whichever side has room.
    const gap = 14;
    let left: number;
    let top: number;
    if (r.left - gap - cw >= 8) {
      left = r.left - gap - cw;
      top = r.top + r.height / 2 - ch / 2;
    } else if (r.right + gap + cw <= vw - 8) {
      left = r.right + gap;
      top = r.top + r.height / 2 - ch / 2;
    } else if (r.top - gap - ch >= 8) {
      left = r.left + r.width / 2 - cw / 2;
      top = r.top - gap - ch;
    } else if (r.bottom + gap + ch <= vh - 8) {
      left = r.left + r.width / 2 - cw / 2;
      top = r.bottom + gap;
    } else {
      // No room anywhere (small phones): pin to whichever end is further from the target.
      left = (vw - cw) / 2;
      top = r.top + r.height / 2 > vh / 2 ? 8 : vh - ch - 8;
    }
    this.card.style.left = `${Math.min(Math.max(8, left), vw - cw - 8)}px`;
    this.card.style.top = `${Math.min(Math.max(8, top), vh - ch - 8)}px`;
  }
}

// ------------------------------------------------------------------ finding

/** The page currently showing. */
const page = () => document.querySelector('.page:not([hidden])');

/** A control or group in the visible page, by its label text. */
export function byLabel(text: string): Element | null {
  const p = page();
  if (!p) return null;
  for (const l of p.querySelectorAll('.control-label, .group-label')) {
    if (l.textContent?.trim() !== text) continue;
    return l.classList.contains('group-label') ? l.parentElement : l.closest('.control');
  }
  return null;
}

export const q = (sel: string) => () => document.querySelector(sel);
export const pageBody = () => page()?.querySelector('.page-body') ?? null;
export const label = (text: string) => () => byLabel(text);
