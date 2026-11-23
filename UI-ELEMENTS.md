# UI Element Inventory — Photography Lighting Simulator

Every visible UI element in v1, with its CSS class, contents, and states. Source: `src/app.ts` (layout and sidebar contents), `src/ui.ts` (control kit), `src/diagram.ts` (top-view canvas), `src/style.css` (all styles).

> Updated for the focus shoots. Quick starts now opens with **Shoots**, **People** (Solo | Group), a **Pose** grid and **Group pose**. The pose control has moved out of Subject & scene. Environment has three modes, including **Location**.

---

## 1. Design tokens (`:root` in style.css)

| Token | Value | Used for |
|---|---|---|
| `--bg` | `#0e0f12` | Page background |
| `--panel` | `#15171b` | Sidebar background |
| `--panel-2` | `#1c1f24` | Chips, segmented controls, readout boxes, selects |
| `--line` | `#2a2e35` | Borders and dividers |
| `--text` | `#e9e7e3` | Primary text |
| `--muted` | `#8d939c` | Secondary text, labels, hints |
| `--accent` | `#f4b942` (amber) | Primary button, active chips, slider fill, toggle on, section icons |
| `--accent-ink` | `#1a1408` | Text on the accent colour |
| `--good` | `#4ade80` | "Correct exposure" style readout values |
| `--warn` | `#fb923c` | Over/under warnings in readouts |
| `--cool` | `#60a5fa` | Cool/blue info values |
| `--radius` | `8px` | Default corner radius |
| `--sidebar` | `360px` | Sidebar width (desktop) |

- **Font:** `'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`, 14px base. Inter is not loaded; it only applies if installed.
- **Colour scheme:** dark only.
- **Light identity colours** (tab dots, diagram markers): Key `#f4b942`, Fill `#5aa9e6`, Rim / Hair `#c084fc`, Background `#4ade80`.

---

## 2. Page layout

```
#app  (fixed, full window, flex row)
├── .viewport          (flex: 1, black)  — 3D view + overlays
└── aside.sidebar      (360px, flex column)
    ├── header.sidebar-header
    └── .sidebar-scroll   (scrolling list of collapsible sections)
```

**Mobile (≤ 820px):**
- `#app` becomes a column.
- The viewport takes the top 52% of the screen.
- The sidebar fills the rest, with a top border instead of a left border.
- The diagram shrinks to 112 × 112.
- The help text is hidden.

---

## 3. Viewport (3D view) and overlays

| Element | Class | Description |
|---|---|---|
| 3D canvas | `.viewport canvas:first-child` | WebGL render. Drag to orbit, scroll to zoom, click a light to select it, double-click to set focus. `touch-action: none`. |
| Top-view diagram | `canvas.diagram` | 230 × 230, bottom-left, 12px inset, 10px radius, 1px `rgba(255,255,255,.08)` border, drop shadow. Hidden by **View → Show top-view diagram**. See section 6. |
| Help text | `.viewport-help` | Bottom-right pill, 11px, 55% white on 35% black. Text: "Drag to orbit · scroll to zoom · click a light to move it · double-click to focus". Hidden on mobile. |
| Toast | `.toast` / `.toast.show` | Top-centre pill that fades and slides in for 2.2 s. Messages: "Key light selected — drag the arrows to move it", "Focused at 2.40 m". |
| Transform gizmo | (three.js TransformControls) | Red, green and blue move arrows drawn on top of the 3D view on the selected light. Not CSS-styled. |
| In-focus zone overlay | (shader) | Green diagonal stripes tinting everything inside the depth of field. Toggled from the Camera section. |
| Focus plane overlay | (shader) | Magenta contour line where the scene crosses the exact focus distance. Toggled from the Camera section. |
| WebGL fallback | `.fatal` | Centred message box, max-width 520px, shown if WebGL2 fails. |

---

## 4. Sidebar header

| Element | Class | Content |
|---|---|---|
| Header bar | `header.sidebar-header` | Flex row with a bottom border. |
| Title | `h1` | "Lighting Simulator" (16px, weight 650). |
| Subtitle | `p` | "Light, lens and location — see how they interact." (12px, muted). |
| Actions wrapper | `.header-actions` | No styles of its own yet. |
| Save button | `button.primary` | "Save photo": amber fill, dark ink. Renders a high-quality frame and downloads a PNG. |

---

## 5. Sidebar sections (top to bottom)

Each section is a `<details class="section">` with a `<summary>`. The summary holds an icon span (`.section-icon`, amber), the title, and a CSS chevron that rotates when open. The content sits in `.section-body`, a flex column with a 10px gap.

### 5.1 ★ Quick starts (open by default)
- **Group "Shoots"**: `.button-grid.cols-3` of `.chip` buttons, with the last one picked shown `.active`. The tooltip is the shoot's blurb.
  - Outdoor solo, Outdoor family, Indoor. The app opens on Outdoor solo.
  - **People**: segmented control, Solo | Group (a family of four). Switching re-runs the current shoot for the new group size: outdoor swaps between Outdoor solo and Outdoor family; Indoor stays Indoor and moves its lights back for the group.
  - **Pose** (solo only): `.button-grid.cols-3.small` of `.chip` buttons, with tooltips that say what each pose shows off. Picking one switches the subject to the mannequin.
    - Standing, Three-quarter, Profile, Over shoulder, Chin up, Hand to chin, Hand on hip, Arms crossed, Seated (adds a chair).
  - **Group pose** (group only): segmented control, Standing | Casual | Seated. Seated adds a sofa indoors or a log outdoors. Picking one reframes the camera.
- **Group "Lighting setups"**: `.button-grid`, 2 columns of `.chip` buttons. The tooltip on each button is a one-line description.
  - Rembrandt, Loop, Butterfly, Clamshell, Split, Rim / edge, High-key, Low-key.
- **Group "Scenarios"**: `.button-grid`, 2 columns of `.chip` buttons.
  - Studio portrait, Window light, Golden hour, Overcast, Midday + fill flash, Open shade, Blue hour + strobe, Night bokeh.
- **Preset note**: `.preset-note`, a panel with an amber left border.
  - Contains rich text (`<strong>` allowed) explaining the last preset picked.
  - Default text: "Pick a setup to load it, then tweak anything below."

### 5.2 💡 Lights (open)
- **Light tabs**: `.light-tabs`, a 4-column grid of `button.light-tab`. Each tab holds:
  - `.dot`: a 9px circle in the light's colour.
  - `.name`: Key, Fill, Rim / Hair, Background.
  - `.state`: 10.5px muted text showing the power (e.g. "1/8"), "off" or "solo".
  - States: `.active` (amber border, warm background) and `.off` (55% opacity).
- **On / Solo row**: `.row-2` (2-column grid) with two toggles, "On" and "Solo".
- **Selected-light body**, hidden when the light is off:
  - **Light type**: small segmented control, Strobe | Continuous. Each option has a tooltip.
  - **Power**: stepped slider from 1/128 to full in ⅓ stops. The value field accepts "1/16".
  - **Readout** "This light alone": aperture this light alone would need, e.g. "f/5.6 @ ISO 100". Shows "no light on the face side" in muted text when it doesn't reach the face.
  - **Modifier**: select with 10 options.
    - Bare bulb, Standard reflector, Softbox, Octabox, Strip box, Umbrella, Beauty dish, Grid spot, Snoot, Window.
  - **Size**: slider whose range depends on the modifier, shown in metres or cm.
  - **Hint**: modifier description plus "Apparent size: N°".
  - **Group "Position"**:
    - **Around subject**: slider from −180° to 180°. Readout reads "front", "45° cam-right" or "behind".
    - **Height**: slider from −60° to 85°, e.g. "30° above eyes".
    - **Distance**: slider from 0.4 to 6 m. Hint: "Inverse square law: double the distance → ¼ the light (−2 stops)."
    - **Aim at**: segmented control, Face | Background.
  - **Group "Colour"**:
    - **Colour temperature**: slider from 2000 to 10000 K.
    - **Gel**: colour row with 7 swatches (`#ffffff`, `#ffb070`, `#9cc3ff`, `#ff5a5a`, `#5a7dff`, `#ff6ad5`, `#7dff8a`) plus a custom colour picker.
  - **Casts shadows**: toggle.
- **Group "Ratios at the face"**: `.group.readouts`, a darker rounded box.
  - **Key : Fill**: e.g. "3:1 (1.6 stops)". Shows "key off" or "no fill" when either light is missing.
  - **Background vs face**: e.g. "−1.3 EV". Studio only.

### 5.3 ◉ Camera (open)
- **Group "Framing"**: `.button-grid` with 6 chips.
  - Headshot, Half body, Full body, Eye level, High angle, Low angle.
- **Focal length**: slider from 14 to 200 mm. Hint: "Longer lenses compress the background and flatter faces."
- **Aperture**: stepped slider from f/1.2 to f/22 in ⅓ stops. Hint: "Lower f-number = wider opening = shallower depth of field."
- **Focus distance**: slider from 0.40 to 20 m. Disabled while autofocus is on.
- **Autofocus on the eyes**: toggle. Hint: "Or double-click anything in the view to focus there."
- **Readout box** "Depth of field": e.g. "2.31 m – 2.52 m (21 cm)".
- **Overlay row**: `.row-2` with toggles "In-focus zone" and "Focus plane".
- **Group "Exposure"**:
  - **Mode**: segmented control, Auto | Manual, each with a tooltip.
  - Auto mode:
    - **Exposure compensation**: slider from −3 to +3 EV in ⅓ steps.
    - Hint: "Auto keeps the face correctly exposed so you can play with aperture freely."
  - Manual mode:
    - **Shutter speed**: stepped slider from 2″ to 1/8000. Hint about strobes and the 1/250 sync limit.
    - **ISO**: stepped slider from 50 to 12800.
  - **Readout box**:
    - **Meter at face**: in Auto, the metered aperture "@ ISO 100, 1/125". In Manual, the needed aperture plus a tag: `.good` "spot on", `.warn` "+1.0 EV over" or `.cool` "−1.0 EV under".
    - **Ambient share**: e.g. "35% of the face exposure". Shown outside the studio, or in the studio when room light is above 30 lux.
- **Group "White balance"**:
  - **Camera white balance**: slider from 2500 to 10000 K.
  - 4 chips: Tungsten (3200 K), Daylight (5600 K), Cloudy (6500 K), Shade (7500 K). The matching chip is `.active`.

### 5.4 ☺ Subject & scene (collapsed by default)
- **Subject**: segmented control with Mannequin, Head scan, Marble bust. Each option has a tooltip. Solo only (the group is always mannequins). Poses are in Quick starts.
- **Turn**: slider from −90° to 90°, e.g. "facing camera" or "30° to cam-left". Hint about short vs broad lighting.
- **Subject to backdrop**: slider from 0.8 to 6 m, with a hint. Studio only.
- **Group "Depth props"**: three toggles.
  - Foreground plant, Second person behind, String lights (bokeh). Outside the studio, the string lights also bring in street lamps.

### 5.5 ☀ Environment (open)
- **Mode**: segmented control with Studio, Open sky and Location. Each option has a tooltip.
- Studio mode:
  - **Backdrop**: colour row with swatches White, Gray, Black, Blue, Warm, plus a picker.
  - **Room light**: slider from 0 to 400 lux, with a hint.
- Open sky mode:
  - **Time presets**: `.button-grid.cols-3.small` with 6 chips.
    - Sunrise, Morning, Midday, Golden hour, Blue hour, Night.
  - **Time of day**: slider from 5:00 am to 10:00 pm.
  - **Sun direction**: slider from −180° to 180°, e.g. "behind camera" or "behind subject". Hint about backlight.
  - **Sky**: small segmented control, Clear | Hazy | Overcast | Open shade.
  - **Atmospheric haze**: toggle.
  - **Readout box**:
    - **Sun**: e.g. "42° high · 5400 K", or "−4° below horizon".
    - **Light level**: e.g. "85k lux" or "12 lux".
- Location mode:
  - **Location**: select with 6 options.
    - Photo studio loft, Artist workshop, Meadow (midday), Venice (sunset), Tiergarten park, City rooftop (night).
  - **Hint**: one-line description of the chosen location.
  - **Sun direction**: slider from −180° to 180°. Spins the whole panorama around the subject. Hint explains it.
  - **Readout box**:
    - **Sun**: "27° high", "no direct sun", or "loading…" while the panorama downloads.
    - **Light level**: the location's calibrated lux.
    - **Colour**: approximate colour temperature, e.g. "~3200 K".

### 5.6 ▣ View (collapsed)
- **Show stands & modifiers**: toggle.
- **Show top-view diagram**: toggle.
- **Reset everything**: single `.chip` button.
- **Credits**: `.hint.credits`. Small text crediting the models and HDRIs, with a CC BY 3.0 link for the head scan. This attribution is required, so keep it visible in any restyle.

---

## 6. Top-view diagram (canvas-drawn, not DOM)

All of the diagram is drawn on the canvas in `diagram.ts`, so restyling it means changing colours in that file, not CSS.

| Element | Current style |
|---|---|
| Background | `rgba(14,15,18,0.82)` |
| Grid lines | `rgba(255,255,255,0.05)` |
| Backdrop line | Studio backdrop colour, outlined `rgba(255,255,255,0.25)` |
| Depth-of-field band | Green fill `rgba(80,220,120,0.13)` |
| Camera view cone | `rgba(255,255,255,0.22)` |
| Focus line | Magenta `rgba(232,90,210,0.95)` |
| Camera icon | `#e8e8ea` |
| Sun direction | Amber `rgba(255,200,80,0.6)` line with a `#ffc850` dot |
| Subject | Tan `#d8b08c` |
| Lights | Gradient beam cone, a dot in the light's colour, a white ring when selected, and an 85% white 10px name label |
| Caption | "Top view · drag lights" at bottom-left, 10px, 45% white |

Interaction:
- Drag a light to change its angle and distance.
- Click a light to select it.

---

## 7. Control kit reference (`src/ui.ts`)

These are the reusable building blocks, so restyling one restyles every instance.

| Control | DOM structure | States |
|---|---|---|
| Section | `details.section > summary(.section-icon + title) + .section-body` | `[open]` rotates the chevron |
| Group | `.group` + optional `.group-label` (11px, uppercase, letter-spaced, muted). Variant `.group.readouts` is a dark box. | — |
| Hint | `.hint`: 11.5px, muted, line-height 1.4 | — |
| Readout | `.readout > .readout-label + .readout-value` (tabular numbers). Value spans may carry `.muted`, `.good`, `.warn` or `.cool`. | — |
| Slider | `.control.slider-row > .control-top(label.control-label + input.value-field) + input.range` + optional `.hint` | `.disabled` (40% opacity). The range fill comes from the `--fill` variable. The value field shows a border on hover and an amber border on focus. |
| Segmented | `.control > .control-label? + .segmented > button.seg×N`. Variant `.segmented.small`. | `.seg.active` |
| Select | `.control.select-row > label + select` (min-width 170px) | — |
| Toggle | `label.control.toggle-row > input(hidden) + span.switch + span.toggle-label` | Checked: amber track, knob slides 13px. Focus-visible: amber outline. |
| Colour row | `.control.color-row > label + .swatches > button.swatch×N + input.color-input` | `.swatch.active` gets an amber ring |
| Button grid | `.button-grid` (2 columns). Variants `.cols-3`, `.cols-4`, `.small`. Children are `button.chip`. | `.chip:hover`, `.chip.active` (amber border and text) |
| Primary button | `button.primary` | `:hover` brightens it |
| Two-up row | `.row-2`: 2-column grid with an 8px gap | — |

---

## 8. Known gaps a restyle could address

- `.header-actions` and `.toggle-label` have no styles.
- Inter is named in the font stack but never loaded.
- Section icons are emoji or Unicode glyphs (★ 💡 ◉ ☺ ☀ ▣), so they render inconsistently across platforms.
- There is no light theme.
- Diagram colours are hard-coded in `diagram.ts` rather than using CSS variables.
