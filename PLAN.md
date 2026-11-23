# Photography Lighting Simulator — Planning Doc

## Goal
A browser-based 3D lighting simulator a photographer can use (alongside an e-book or on its own) to demonstrate how lighting, camera settings, and environment interact. Focus on teaching and quick experimentation rather than production rendering.

## What a Photographer Needs Control Over

Prioritized groups:

### 1. Lighting (most important)
- Multiple lights (key, fill, rim/hair, background, practicals)
- Position (direct drag in 3D + sliders for precision)
- Intensity / power
- Color temperature (Kelvin) + optional gel
- Softness / hardness (modifier size or falloff)
- Modifier type (bare, softbox, umbrella, beauty dish, grid, snoot, etc.)
- On/off and solo (isolate one light)

### 2. Camera (so aperture, focus, etc. are meaningful)
- Aperture (f-stop) → drives depth of field / bokeh
- Focus distance / focus plane (with visual indicator)
- Focal length / field of view
- Camera position and angle (orbit + height/distance presets)
- Optional later: shutter speed (motion blur) and ISO (noise)

### 3. Subject & Scene Depth
- Posable model (or several fixed poses + scale)
- Distance from camera
- Foreground and background elements at different depths so DOF is obvious
- Subject color / clothing tone

### 4. Environment
- Indoor studio: seamless cyclorama (white/gray/black), controlled ambient
- Outdoor: time of day / sun position, weather softness, ground/sky
- Background distance and tone

### 5. Quick Starts
- Named lighting setups (Rembrandt, butterfly, split, high-key, low-key, rim, clamshell, etc.)
- Named scenarios (studio portrait, window light, golden hour, overcast outdoor, night, etc.)

## UI Layout

A single dominant 3D viewport with a sidebar (right or left) works best.

**Recommended structure:**
- **Top of sidebar**: Preset buttons (lighting setups + indoor/outdoor scenarios). These are the main entry point.
- **Accordion or tabbed sections**:
  1. Lights
  2. Camera
  3. Subject & Scene
  4. Environment
- Keep advanced options collapsed by default.
- Direct manipulation in the viewport (drag lights, orbit camera) should feel primary. Sidebar is for precision and clear teaching labels.
- Optional later: a small setup diagram showing light positions relative to the subject.

## Control Types

| Control Need | Best Control Type | Why / Notes |
|--------------|-------------------|-------------|
| Intensity, position, softness, aperture, focus distance, Kelvin | Sliders with numeric readout | Continuous values, easy to scrub |
| Aperture, shutter, ISO (camera feel) | Sliders or simple dial-style | Photographers expect f/1.4, f/2.8… steps; either works if clearly labeled |
| Light on/off, solo, cast shadows | Toggles / checkboxes | Binary |
| Modifier type, pose, environment, weather, preset | Buttons or dropdown | Discrete choices; buttons for common items, dropdown for longer lists |
| Light color / gel | Color picker + Kelvin slider | Both are useful |
| Exact numbers | Slider + editable number field | Photographers sometimes want to type 5600K or f/4 |
| Moving lights in space | Direct drag in 3D view + helper spheres | Most intuitive; sliders as backup |
| Camera framing | Orbit + reset + a few height/distance presets | Avoid forcing everything into sliders |

**Rule of thumb:** Sliders + labels for almost everything continuous, buttons/dropdowns for categories, color picker for color, and direct manipulation in the viewport wherever possible.

## Indoor vs Outdoor Coverage

Make environment a top-level choice that changes available controls and defaults.

### Indoor
- Studio cyclorama (white / gray / black)
- Window light simulation (large soft source from one side)
- Mixed (window + artificial)
- Ambient level control (very low in pure studio)

### Outdoor
- Time of day presets: sunrise, golden hour, midday, blue hour, night
- Weather / sky softness: clear hard sun, hazy, overcast, open shade
- Sun direction (or time slider that moves the sun)
- Ground and distant background so outdoor scale feels right
- Optional fog / haze for softer light and depth

These modes should load different default light setups and change the sky/ground so the difference is immediately visible.

## Models, Objects, and Accurate Camera Simulation

To make aperture and focus meaningful:

- At least one humanoid model with a few poses (standing, slight turn, sitting, arms variation). Scale and distance-from-camera controls.
- Simple depth elements: a foreground object (plant, chair, or second figure) and a background element so bokeh is obvious when aperture or focus distance changes.
- Visual focus plane (thin transparent plane or highlight on the sharp zone) that moves with the focus distance control.
- Realistic-enough DOF: blur amount driven by aperture + subject distance + focal length. Even a simple approximation (sharper near the focus plane, progressively blurrier farther away) teaches the concept well.
- Optional later: a second model or prop set at a fixed different distance so users can see selective focus clearly.

## Suggested First Version Scope

Good coverage without boiling the ocean:

1. One simple posable mannequin + a couple of depth props.
2. Up to 4 lights with position, intensity, color temperature, softness, and on/off.
3. Camera: aperture, focus distance, FOV, orbit.
4. Environment switch: Studio / Outdoor (with 4–5 outdoor conditions).
5. 8–10 one-click presets covering classic portrait setups plus a few outdoor ones.
6. Clean sidebar with the sections above.

This already gives enough to demonstrate key light, fill, ratios, color temperature, depth of field, and the difference between controlled studio light and outdoor conditions.

## Next Steps (when ready to build)
- Wireframe the sidebar sections
- Decide on exact preset list
- Choose tech approach (Three.js is the natural fit for a browser tool)
- Implement core viewport + one light + one model first, then expand controls
