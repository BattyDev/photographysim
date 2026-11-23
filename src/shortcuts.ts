// Keyboard shortcuts: the list shown in the panel, and the panel itself.
// The keys are handled in app.ts (they need the app's state); this file is the
// one place they are described, so the panel and the help stay in step.

export interface Shortcut {
  keys: string[];
  /** Shown between keys: "/" for alternatives, "–" for a range. */
  join?: string;
  what: string;
}

export const SHORTCUT_GROUPS: { title: string; items: Shortcut[] }[] = [
  {
    title: 'General',
    items: [
      { keys: ['?'], what: 'Show or hide these shortcuts' },
      { keys: ['T'], what: 'Start the tutorial' },
      { keys: ['P', 'Ctrl S'], join: '/', what: 'Save photo' },
      { keys: ['1', '6'], join: '–', what: 'Open a page: Shoots, Lights, Camera, Subject, Scene, View' },
      { keys: ['Esc'], what: 'Close a panel, or let go of the selected light' },
    ],
  },
  {
    title: 'Lights',
    items: [
      { keys: ['K', 'F', 'R', 'B'], join: ' ', what: 'Select the key, fill, rim or background light' },
      { keys: ['O'], what: 'Turn the selected light on or off' },
      { keys: ['S'], what: 'Solo the selected light (see only what it does)' },
      { keys: ['←', '→'], join: ' ', what: 'Move it around the subject' },
      { keys: ['↑', '↓'], join: ' ', what: 'Raise or lower it' },
      { keys: ['Shift ↑', 'Shift ↓'], join: ' ', what: 'Bring it closer or move it back' },
      { keys: ['+', '−'], join: ' ', what: 'Power up or down ⅓ stop' },
    ],
  },
  {
    title: 'Camera',
    items: [
      { keys: ['[', ']'], join: ' ', what: 'Open or close the aperture ⅓ stop' },
      { keys: [',', '.'], join: ' ', what: 'Shorter or longer lens' },
      { keys: ['C'], what: 'Cycle framing: headshot, half body, full body' },
      { keys: ['A'], what: 'Eye autofocus on or off' },
      { keys: ['E'], what: 'Exposure: Auto or Manual' },
      { keys: ['Z'], what: 'Show the in-focus zone' },
    ],
  },
  {
    title: 'View',
    items: [
      { keys: ['G'], what: 'Show or hide light stands and modifiers' },
      { keys: ['D'], what: 'Show or hide the top view' },
      { keys: ['Drag'], what: 'Orbit the subject · scroll to zoom · double-click to focus' },
    ],
  },
];

const kbd = (k: string) => `<kbd>${k}</kbd>`;

export class ShortcutPanel {
  private root: HTMLElement;

  constructor() {
    this.root = document.createElement('div');
    this.root.className = 'keys-overlay';
    this.root.hidden = true;
    const groups = SHORTCUT_GROUPS.map(
      (g) => `<section><h4>${g.title}</h4><dl>${g.items
        .map((it) => `<dt>${it.keys.map(kbd).join(it.join === '–' ? '<span class="to">–</span>' : it.join === '/' ? '<span class="or">or</span>' : '')}</dt><dd>${it.what}</dd>`)
        .join('')}</dl></section>`,
    ).join('');
    this.root.innerHTML = `
      <div class="keys-card" role="dialog" aria-modal="true" aria-labelledby="keys-title">
        <div class="keys-top"><h3 id="keys-title">Keyboard shortcuts</h3><button class="tour-close" aria-label="Close">×</button></div>
        <div class="keys-grid">${groups}</div>
        <p class="keys-foot">Shortcuts pause while you are typing in a field. Arrow keys on a focused slider move that slider.</p>
      </div>`;
    this.root.addEventListener('click', (e) => {
      if (e.target === this.root || (e.target as HTMLElement).closest('.tour-close')) this.close();
    });
    document.body.appendChild(this.root);
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  open() {
    this.root.hidden = false;
    (this.root.querySelector('.tour-close') as HTMLElement).focus({ preventScroll: true });
  }

  close() {
    this.root.hidden = true;
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }
}
