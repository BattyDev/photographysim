# UI Element Inventory — Photography Lighting Simulator

Every visible UI element in v1, with its CSS class, contents, and states. Source: `src/app.ts` (layout and sidebar contents), `src/ui.ts` (control kit), `src/diagram.ts` (top-view canvas), `src/style.css` (all styles).

> Updated for the restyle: the sidebar is now an **icon rail with one page per section** (Shoots, Lights, Camera, Subject, Scene, View) instead of folding sections. Sliders can carry **clickable tick labels**, a **log scale** (light distance, focus distance) and a **warm-to-cool Kelvin track**. Camera splits **Framing** and **Camera height** into two rows that highlight the last pick, and white balance has 5 presets. On phones the rail becomes a bottom tab bar.

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
| In-focus zone overlay | (shader) | Green diagonal stripes tinting everything inside the depth of field. Toggled from the Camera page. |
| Focus plane overlay | (shader) | Magenta contour line where the scene crosses the exact focus distance. Toggled from the Camera page. |
| WebGL fallback | `.fatal` | Centred message box, max-width 520px, shown if WebGL2 fails. |

---

## 4. Sidebar header

| Element | Class | Content |
|---|---|---|
| Header bar | `header.sidebar-header` | Flex row with a bottom border. |
| Title | `h1` | "Lighting Simulator" (16px, weight 650). |
| Subtitle | `p` | "Light, lens and location — see how they interact." (12px, muted). |
| Actions wrapper | `.header-actions` | Flex row, 8px gap. |
| Shortcuts button | `button.ghost.keys-btn` | 34px square with a keyboard icon, after the Tutorial button. Opens the shortcuts panel; `?` does the same. Hidden on phones and touch screens. |
| Tutorial button | `button.ghost.tutorial-btn` | Amber outline, a round "?" badge plus "Tutorial" (the word hides on phones). Pulses until the tour has been opened once (`photographysim.tourSeen` in localStorage). |
| Save button | `button.primary` | "Save photo": amber fill, dark ink. Renders a high-quality frame and downloads a PNG. |

---

### Tutorial overlay (`src/tour.ts`, steps in `src/tutorial.ts`)

| Element | Class | Content |
|---|---|---|
| Layer | `.tour` | Fixed, full screen, ignores the pointer so highlighted controls stay usable. |
| Spotlight | `.tour-spot` | Rounded cut-out around the current control: a 9999px dark box-shadow dims everything else, amber outline. Follows the control every frame. |
| Card | `.tour-card` | 340px dialog beside the control (left, right, above or below, whichever fits; centred when a step has no target). Step count, close ×, title, body, amber progress bar, Back and Next/Finish. |
| Try line | `.tour-try` | Amber-bordered "Try: …" suggestion inside a card. |

### Shortcuts panel (`src/shortcuts.ts`)

| Element | Class | Content |
|---|---|---|
| Overlay | `.keys-overlay` | Fixed, dims the app; click outside, ×, Esc or `?` closes it. |
| Card | `.keys-card` | "Keyboard shortcuts", then four groups (General, Lights, Camera, View) in a two-column grid (`.keys-grid`): amber group titles, `<kbd>` keys, muted descriptions. Footer note that shortcuts pause while typing. |

Shortcut feedback uses the existing viewport toast, e.g. "Rim light: 40° cam-right".

23 steps: welcome, view, top view, pages, then every group on Shoots, Lights and Camera, then Subject, Scene, View, Save photo and a closing card. Keys: ← → to move, Esc to close.

---

## 5. Sidebar pages

Below the header, `.sidebar-body` holds two parts:
- **Rail**: `nav.rail` (64px wide, `role="tablist"`), with one `button.rail-btn` per page. Each button has a 22px line icon (inline SVG, stroke `currentColor`) over a 10.5px label. The active button is amber with a tinted background and border.
- **Pages**: `div.pages` scrolls. It holds one `section.page` per rail button, with only the active one visible. Each page has a `header.page-header`, holding an `h2` title (17px) and a `p` subtitle (muted), followed by `.page-body`, a flex column with a 12px gap.

The last page opened is saved in `localStorage` (`photographysim.page`) and reopened on the next visit. Group labels (`.group-label`) are amber uppercase headings. Top-level groups on a page are separated by a hairline.

**Phones (≤ 820px):** the rail moves under the page as a bottom tab bar, with the safe-area inset respected. Subtitles are hidden.

### 5.1 Shoots page (star icon)
- **Group "Shoots"**: `.button-grid.cols-3` of `.chip` buttons, with the last one picked shown `.active`. The tooltip is the shoot's blurb.
  - Outdoor solo, Outdoor family, Indoor. The app opens on Outdoor solo.
  - **People**: segmented control, Solo | Group (a family of four). Switching re-runs the current shoot for the new group size: outdoor swaps between Outdoor solo and Outdoor family; Indoor stays Indoor and moves its lights back for the group.
  - **Pose** (solo only): `.button-grid.cols-3.small` of `.chip` buttons (15), with tooltips that say what each pose shows off: Relaxed, Three-quarter, Profile, Over shoulder, Chin up, Hand to chin, Hand on hip, Arms crossed, Hands clasped, Pockets, Hand in hair, Looking away, Walking, Seated, Leaning in. Picking one switches the subject to the person.
    - Standing, Three-quarter, Profile, Over shoulder, Chin up, Hand to chin, Hand on hip, Arms crossed, Seated (on an apple box).
  - **Group pose** (group only): segmented control, Standing | Casual | Seated. Each family member takes a different pose in each layout. Seated puts them on apple boxes in the studio, a park bench outdoors, or the sofa in the living room (the children sit too). Picking one reframes the camera.
- **Group "Lighting setups"**: `.button-grid`, 2 columns of `.chip` buttons. The tooltip on each button is a one-line description.
  - Rembrandt, Loop, Butterfly, Clamshell, Split, Rim / edge, High-key, Low-key.
- **Group "Scenarios"**: `.button-grid`, 2 columns of `.chip` buttons.
  - Studio portrait, Window light, Family at home, Golden hour, Overcast, Midday + fill flash, Open shade, Sunset + strobe, Night street + strobe, Night bokeh.
- **Preset note**: `.preset-note`, a panel with an amber left border.
  - Contains rich text (`<strong>` allowed) explaining the last preset picked.
  - Default text: "Pick a shoot or a setup to load it, then tweak anything in the other pages."

### 5.2 Lights page (bulb icon)
- Tabs read **Key, Fill, Rim, Back** (full name in the tooltip), with power shown as e.g. "1/16 +⅔". The active tab's power is amber.
- Ticks: Power 1/128 · 1/32 · 1/8 · 1/2 · 1/1. Around subject: behind · left · front · right · behind. Height: −45° · eye level · 45° · overhead. Distance (log scale): 0.5 · 1 · 2 · 4 m. Colour temperature (Kelvin track): 3200 tungsten · 5600 flash · 8000.
- **Key : Fill** is a `.readout.hero`: a large amber ratio with the stops underneath.
- Clicking a light in the 3D view opens this page.
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
- **Group "Framing"**: `.button-grid.cols-3`: Headshot, Half body, Full body.
- **Group "Camera height"**: `.button-grid.cols-3`: Eye level, High angle, Low angle, each with a tooltip.
  - In both rows, the last chip picked is `.active` until the user orbits the camera or a preset moves it.
- **Group "Lens"**:
- **Focal length**: slider from 14 to 200 mm, ticks 24 · 50 · 85 · 135 · 200 mm. Hint: "Longer lenses compress the background and flatter faces."
- **Aperture**: stepped slider from f/1.2 to f/22 in ⅓ stops, ticks f/1.4 · 2.8 · 5.6 · 11 · 22. Hint: "Lower f-number = wider opening = shallower depth of field."
- **Group "Focus"**:
- **Focus distance**: log-scale slider from 0.40 to 20 m, ticks 0.5 · 1 · 2 · 5 · 10 · 20 m. Moving it turns autofocus off.
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
  - **Camera white balance**: Kelvin-track slider from 2500 to 10000 K, ticks 3200 · 5600 · 7500 K.
  - 5 chips (`.cols-5.small`): Tungsten (3200 K), Fluoro (4000 K), Daylight (5600 K), Cloudy (6500 K), Shade (7500 K). The matching chip is `.active`.

### 5.4 Subject page (person icon)
- **Subject**: segmented control with Mannequin, Head scan, Marble bust. Each option has a tooltip. Solo only (the group is always the family of four mannequins). Poses are in Quick starts.
- **Turn**: slider from −90° to 90°, e.g. "facing camera" or "30° to cam-left". Hint about short vs broad lighting.
- **Subject to backdrop**: slider from 0.8 to 6 m, with a hint. Studio only.
- **Group "Depth props"**: toggles.
  - **Something in front**: a potted plant indoors, a tree stump outdoors. Hint says so.
  - **Boulder behind**: outdoor locations only.
  - **Picnic tables**: outdoor locations only, with a hint. One about 4 m behind, one about 8 m behind.
  - Second person behind, String lights (bokeh). Outside the studio, the string lights also bring in street lamps.

### 5.5 Scene page (landscape icon)
- **Mode**: segmented control with Studio and Location. Each option has a tooltip. (Open sky is hidden until it has realistic surroundings; its controls below still exist in code.)
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
  - **Location**: select with 13 options.
    - Photo studio loft, Artist workshop, Living room, Meadow (midday), Venice (sunset), Tiergarten park, Field (sunrise), City courtyard, Quadrangle (midday), Beach (under a bridge), Forest, Cobblestone street (night), City rooftop (night).
    - In the 3D view, the panorama is drawn on real surfaces: a ground disc and far dome outdoors, and the room's floor, walls and ceiling indoors. Flash lights them and they catch shadows. A sharp 8k (or 4k on phones) layer fades in once downloaded.
  - **Hint**: one-line description of the chosen location.
  - **Sun direction**: slider from −180° to 180°. Spins the whole panorama around the subject. Hint explains it.
  - **Subject in shade**: toggle, shown only for locations with a sun. Hint: a building blocks the sun from the subject; the background stays sunny.
  - **Readout box**:
    - **Sun**: "27° high", "no direct sun", or "loading…" while the panorama downloads.
    - **Light level**: the location's calibrated lux.
    - **Colour**: approximate colour temperature, e.g. "~3200 K".

### 5.6 View page (sliders icon)
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
| Slider | `.control.slider-row > .control-top(label.control-label + input.value-field) + input.range` + optional `.ticks > button.tick×N` + optional `.hint` | `.disabled` (40% opacity). The range fill comes from `--fill`. The value field is amber and bold, with a border on hover and on focus. Options: `ticks` (clickable labels; the one at the current value is `.tick.on`, amber), `log` (logarithmic track), `kelvin` (`.range.kelvin` warm-to-cool track, no fill). |
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
- There is no light theme.
- Diagram colours are hard-coded in `diagram.ts` rather than using CSS variables.
