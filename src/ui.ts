// Tiny DOM control kit. Every control can re-read its value from state via refresh().

type Refresh = () => void;

export class Panel {
  private refreshers: Refresh[] = [];

  constructor(private onChange: () => void) {}

  refresh() {
    for (const r of this.refreshers) r();
  }

  changed() {
    this.onChange();
  }

  track(r: Refresh) {
    this.refreshers.push(r);
    r();
  }

  el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }

  section(parent: HTMLElement, title: string, open = true, icon = ''): HTMLElement {
    const det = this.el('details', 'section');
    det.open = open;
    const sum = this.el('summary');
    sum.innerHTML = `<span class="section-icon">${icon}</span><span>${title}</span>`;
    det.appendChild(sum);
    const body = this.el('div', 'section-body');
    det.appendChild(body);
    parent.appendChild(det);
    return body;
  }

  group(parent: HTMLElement, label?: string, cls = ''): HTMLElement {
    const g = this.el('div', `group ${cls}`);
    if (label) g.appendChild(this.el('div', 'group-label', label));
    parent.appendChild(g);
    return g;
  }

  hint(parent: HTMLElement, text: string | (() => string)): HTMLElement {
    const h = this.el('div', 'hint');
    parent.appendChild(h);
    if (typeof text === 'function') this.track(() => (h.textContent = text()));
    else h.textContent = text;
    return h;
  }

  readout(parent: HTMLElement, label: string, value: () => string, cls = ''): HTMLElement {
    const row = this.el('div', `readout ${cls}`);
    const l = this.el('span', 'readout-label', label);
    const v = this.el('span', 'readout-value');
    row.append(l, v);
    parent.appendChild(row);
    this.track(() => (v.innerHTML = value()));
    return row;
  }

  showIf(el: HTMLElement, cond: () => boolean) {
    this.track(() => (el.style.display = cond() ? '' : 'none'));
  }

  /**
   * Slider with an editable value field. Works on a continuous range or, when
   * `steps` is given, on a list of discrete photographic values.
   */
  slider(
    parent: HTMLElement,
    opts: {
      label: string;
      get: () => number;
      set: (v: number) => void;
      min?: number;
      max?: number;
      step?: number;
      steps?: number[];
      format?: (v: number) => string;
      parse?: (s: string) => number | null;
      hint?: string;
      disabled?: () => boolean;
    },
  ): HTMLElement {
    const row = this.el('div', 'control slider-row');
    const top = this.el('div', 'control-top');
    const label = this.el('label', 'control-label', opts.label);
    const field = this.el('input', 'value-field');
    field.type = 'text';
    field.spellcheck = false;
    top.append(label, field);
    const range = this.el('input', 'range');
    range.type = 'range';
    const steps = opts.steps;
    if (steps) {
      range.min = '0';
      range.max = String(steps.length - 1);
      range.step = '1';
    } else {
      range.min = String(opts.min ?? 0);
      range.max = String(opts.max ?? 1);
      range.step = String(opts.step ?? 0.01);
    }
    row.append(top, range);
    if (opts.hint) row.appendChild(this.el('div', 'hint', opts.hint));
    parent.appendChild(row);

    const fmt = opts.format ?? ((v: number) => String(Math.round(v * 100) / 100));
    const toIndex = (v: number) => {
      if (!steps) return v;
      let best = 0;
      for (let i = 0; i < steps.length; i++) if (Math.abs(steps[i] - v) < Math.abs(steps[best] - v)) best = i;
      return best;
    };
    const paint = () => {
      const v = opts.get();
      range.value = String(steps ? toIndex(v) : v);
      if (document.activeElement !== field) field.value = fmt(v);
      const lo = Number(range.min);
      const hi = Number(range.max);
      range.style.setProperty('--fill', `${((Number(range.value) - lo) / (hi - lo || 1)) * 100}%`);
      const dis = opts.disabled?.() ?? false;
      range.disabled = dis;
      field.disabled = dis;
      row.classList.toggle('disabled', dis);
    };
    range.addEventListener('input', () => {
      const raw = Number(range.value);
      opts.set(steps ? steps[raw] : raw);
      paint();
      this.changed();
    });
    const commit = () => {
      const parsed = opts.parse ? opts.parse(field.value) : parseFloat(field.value.replace(/[^\d.\-]/g, ''));
      if (parsed !== null && isFinite(parsed)) {
        let v = parsed;
        if (steps) v = steps[toIndex(v)];
        else v = Math.min(Number(range.max), Math.max(Number(range.min), v));
        opts.set(v);
        this.changed();
      }
      field.blur();
      paint();
    };
    field.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') commit();
      if (e.key === 'Escape') {
        field.blur();
        paint();
      }
    });
    field.addEventListener('blur', () => paint());
    field.addEventListener('change', commit);
    field.addEventListener('focus', () => field.select());
    this.track(paint);
    return row;
  }

  segmented<T extends string | number>(
    parent: HTMLElement,
    opts: { label?: string; options: { value: T; label: string; title?: string }[]; get: () => T; set: (v: T) => void; small?: boolean },
  ): HTMLElement {
    const row = this.el('div', 'control');
    if (opts.label) row.appendChild(this.el('div', 'control-label', opts.label));
    const seg = this.el('div', `segmented ${opts.small ? 'small' : ''}`);
    const buttons = opts.options.map((o) => {
      const b = this.el('button', 'seg', o.label);
      if (o.title) b.title = o.title;
      b.addEventListener('click', () => {
        opts.set(o.value);
        this.changed();
      });
      seg.appendChild(b);
      return b;
    });
    row.appendChild(seg);
    parent.appendChild(row);
    this.track(() => {
      const v = opts.get();
      buttons.forEach((b, i) => b.classList.toggle('active', opts.options[i].value === v));
    });
    return row;
  }

  select<T extends string>(
    parent: HTMLElement,
    opts: { label: string; options: { value: T; label: string }[]; get: () => T; set: (v: T) => void },
  ): HTMLElement {
    const row = this.el('div', 'control select-row');
    row.appendChild(this.el('label', 'control-label', opts.label));
    const sel = this.el('select');
    for (const o of opts.options) {
      const op = this.el('option', '', o.label);
      op.value = o.value;
      sel.appendChild(op);
    }
    sel.addEventListener('change', () => {
      opts.set(sel.value as T);
      this.changed();
    });
    row.appendChild(sel);
    parent.appendChild(row);
    this.track(() => (sel.value = opts.get()));
    return row;
  }

  toggle(parent: HTMLElement, opts: { label: string; get: () => boolean; set: (v: boolean) => void; hint?: string }): HTMLElement {
    const row = this.el('label', 'control toggle-row');
    const input = this.el('input');
    input.type = 'checkbox';
    const knob = this.el('span', 'switch');
    const text = this.el('span', 'toggle-label', opts.label);
    row.append(input, knob, text);
    input.addEventListener('change', () => {
      opts.set(input.checked);
      this.changed();
    });
    parent.appendChild(row);
    if (opts.hint) parent.appendChild(this.el('div', 'hint', opts.hint));
    this.track(() => (input.checked = opts.get()));
    return row;
  }

  color(parent: HTMLElement, opts: { label: string; get: () => string; set: (v: string) => void; swatches?: string[] }): HTMLElement {
    const row = this.el('div', 'control color-row');
    row.appendChild(this.el('label', 'control-label', opts.label));
    const wrap = this.el('div', 'swatches');
    const sw = (opts.swatches ?? []).map((c) => {
      const b = this.el('button', 'swatch');
      b.style.background = c;
      b.title = c;
      b.addEventListener('click', () => {
        opts.set(c);
        this.changed();
      });
      wrap.appendChild(b);
      return b;
    });
    const input = this.el('input', 'color-input');
    input.type = 'color';
    input.addEventListener('input', () => {
      opts.set(input.value);
      this.changed();
    });
    wrap.appendChild(input);
    row.appendChild(wrap);
    parent.appendChild(row);
    this.track(() => {
      const v = opts.get().toLowerCase();
      input.value = v;
      sw.forEach((b) => b.classList.toggle('active', b.title.toLowerCase() === v));
    });
    return row;
  }

  buttons(parent: HTMLElement, items: { label: string; title?: string; onClick: () => void; active?: () => boolean }[], cls = ''): HTMLElement {
    const grid = this.el('div', `button-grid ${cls}`);
    const btns = items.map((it) => {
      const b = this.el('button', 'chip', it.label);
      if (it.title) b.title = it.title;
      b.addEventListener('click', () => {
        it.onClick();
        this.changed();
      });
      grid.appendChild(b);
      return b;
    });
    parent.appendChild(grid);
    this.track(() => btns.forEach((b, i) => b.classList.toggle('active', items[i].active?.() ?? false)));
    return grid;
  }
}
