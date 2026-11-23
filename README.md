# PhotographySim — Photography Lighting Simulator

A browser-based 3D lighting simulator for teaching how light, lens and location
interact. Live at [battydev.com/photographysim](https://battydev.com/photographysim/).

Built with Three.js + Vite + TypeScript. See [PLAN.md](PLAN.md) for the design brief.

## What's in v1

- **Four studio lights** (key, fill, rim/hair, background): position around the
  subject (angle, height, distance), flash power in stops (1/1 … 1/128),
  strobe vs continuous, colour temperature + gels, 10 modifiers (softbox,
  octabox, strip, umbrella, beauty dish, grid, snoot, window…), on/off and solo.
- **Physically based softness**: each light behaves like an area light of its
  real apparent size — bigger or closer sources wrap further around the face,
  spread specular highlights, and cast softer shadows. Shadow penumbrae grow
  with the gap between subject and backdrop.
- **Camera**: focal length (full-frame), aperture in third stops, focus
  distance with eye autofocus or double-click-to-focus, thin-lens depth of field
  with real bokeh, in-focus-zone and focus-plane overlays, DoF readout.
- **Exposure**: Auto (holds face brightness so aperture only changes DoF) or
  Manual (aperture, shutter, ISO). Strobes ignore shutter speed (and get cut
  above 1/250 sync); ambient and continuous light don't — so you can "drag the
  shutter". Incident meter at the face, per-light f-stop readouts, key:fill
  ratio, background vs face in EV. Camera white balance.
- **Shoots**: three ready-to-go shoots: Outdoor solo, Outdoor family (meadow,
  sun as a backlight, octabox key) and Indoor (window-lit workshop, softbox key).
  **People** swaps between one person and a family of four. Indoor moves its
  lights back and powers them up to cover the group. Group poses: standing,
  casual, or seated on a sofa or log.
- **Subject & scene**: three ready-made subjects:
  - a rigged wooden mannequin with 9 poses, set by rotating its bones. Several
    are there to show light off: three-quarter (short vs broad), profile (split),
    over the shoulder (rim), chin up (butterfly), hand to chin (hand shadows)
  - a scanned human head, for studying light patterns on a real face
  - a marble bust

  Turn control for all of them. Depth props: a foreground plant, a second
  mannequin, string lights and street lamps for bokeh. Subject-to-backdrop
  distance.
- **Environments**:
  - **Studio**: cyclorama in white, gray, black or a colour. Room light comes
    from a real studio HDRI.
  - **Open sky**: simulated sun and sky with time of day, sun direction,
    clear / hazy / overcast / open shade, haze, twilight and night. Kenney
    trees and hedges.
  - **Location**: six real HDRI panoramas (studio loft, artist workshop,
    meadow, Venice sunset, park, city rooftop at night). Each is projected onto
    the ground and calibrated to real lux, and its sun is extracted into a
    shadow-casting light that you can rotate around the subject.
- **Quick starts**: 8 lighting setups (Rembrandt, loop, butterfly, clamshell,
  split, rim, high-key, low-key) and 8 scenarios (studio, window light, golden
  hour, overcast, midday + fill flash, open shade, blue hour + strobe, night bokeh).
- Top-view setup diagram (drag lights), click lights in 3D to move them with a
  gizmo, and **Save photo** to download a PNG.

## Assets

Third-party models and HDRIs live in `public/assets/` and are listed in
[public/assets/CREDITS.md](public/assets/CREDITS.md). All are CC0 except the
head scan:

> *Infinite, 3D Head Scan* by Lee Perry-Smith is licensed under a Creative
> Commons Attribution 3.0 Unported License. Based on a work at
> www.triplegangers.com.

### Loading and hosting

Nothing heavy is in the JS bundle. Each model, HDRI and prop is fetched the
first time a view needs it, so the default Outdoor solo shoot loads only the
mannequin and the meadow HDRI. The family, seats, other locations, props and
alternate subjects load when picked.

Assets are served from `public/assets/` by default. To host them elsewhere
(a CDN or bucket), build with `VITE_ASSET_BASE=https://…/assets/`.

## Develop

```bash
npm install
npm run dev      # http://localhost:5174/photographysim/
npm run build    # type-check + production build into dist/
```

Pushing to `main` deploys to GitHub Pages via `.github/workflows/pages.yml`.

## Code map

| File | What it does |
| --- | --- |
| `src/state.ts` | State types, modifiers, defaults, presets |
| `src/photo.ts` | Kelvin colour, stop scales, metering, depth-of-field maths |
| `src/app.ts` | Scene wiring, exposure/meter, picking, sidebar |
| `src/lights.ts` | Studio light rigs and per-light illuminance |
| `src/softlight.ts` | Shader patch: area-light wrap, wider specular, soft PCF shadows |
| `src/world.ts` | Studio cyc, open-sky sun model, location mode, props |
| `src/hdri.ts` | HDRI locations: sun extraction, lux calibration, metering grid |
| `src/subject.ts` | Mannequin bone poses, family group poses and seats, head scan, bust |
| `src/assets.ts` | glTF / texture / HDR loading helpers |
| `src/pipeline.ts` | HDR render → thin-lens bokeh → white balance → tone map |
| `src/diagram.ts` | Top-down lighting diagram |
| `src/ui.ts` | Small DOM control kit |
