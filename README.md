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
- **Shoots**: three ready-to-go shoots: Outdoor solo, Outdoor family (a field
  at sunrise, the low sun as a backlight, octabox key) and Indoor (studio paper,
  softbox key). **People** swaps between one person and a family of four, and
  the lights move back and power up to cover the group. Group poses: standing,
  casual, or seated (on apple boxes in the studio, a park bench outdoors, the
  sofa in the living room, where the children sit too).
- **Subject & scene**: three ready-made subjects:
  - a real-looking person (Microsoft Rocketbox avatars) with 9 poses. Several
    are there to show light off: three-quarter (short vs broad), profile (split),
    over the shoulder (rim), chin up (butterfly), hand to chin (hand shadows).
    The family is a father, mother, son and daughter. Poses are set on an
    invisible rigged mannequin and copied joint by joint onto each person's
    skeleton (`src/person.ts`), so one set of poses drives everyone. A
    **Dog** switch adds the family beagle at their feet, its head turned to
    the camera (on in Family at home).
  - a scanned human head, for studying light patterns on a real face
  - a marble bust

  Turn control for all of them. Seated poses sit on apple boxes, the plywood
  boxes portrait studios use. Depth props: something in front (a potted plant
  indoors, a tree stump outdoors), a boulder a few metres behind (outdoors),
  picnic tables at about 4 m and 8 m behind (outdoors), a second person,
  string lights and street lamps for bokeh. The living room comes furnished:
  sofa, mid-century armchair, round coffee table, side table and a potted
  money tree, at near, middle and far distances. Subject-to-backdrop
  distance.
- **Environments**:
  - **Studio**: a seamless paper backdrop as it stands in a real studio: a
    2.72 m roll (3.55 m for groups) on a crossbar between two stands, hanging
    down and sweeping across the floor, in any colour. It stands inside the
    real Photo Studio Loft room, projected and relightable like the locations;
    **Room light** sets how much of the room's own light gets in. The room
    moves with the paper, so the subject can stand up to 4.5 m from it.
  - **Open sky** (simulated sun and sky) is hidden for now: without realistic
    surroundings it was a flat plane. Its code stays wired up for when real
    outdoor settings arrive.
  - **Location**: thirteen real HDRI panoramas, calibrated to real lux:
    - indoors: studio loft, artist workshop, living room
    - sun: meadow (midday), field at sunrise, city courtyard, quadrangle
      (midday), Venice sunset
    - soft light: Tiergarten park, beach under a bridge (overcast), forest
    - night: cobblestone street, city rooftop

    Each sun is extracted into a shadow-casting light you can rotate around the
    subject. **Subject in shade** (locations with a sun) blocks the sun from
    the subject and the ground around them, as a building would, while the
    background stays sunny: open shade. The panorama is projected from where it was shot onto real
    surfaces at real distances: a ground disc and far dome outdoors, and the
    measured room (floor, walls, ceiling) indoors. Those surfaces are
    relightable: flash brightens the floor and nearby walls by exactly what it
    adds, they catch every light's shadow, and depth of field blurs them by
    their true distance. A sharp 8k photo (4k on phones) adds fine detail on
    top of the 2k HDR, loaded only for the location on screen.
- **Quick starts**: 8 lighting setups (Rembrandt, loop, butterfly, clamshell,
  split, rim, high-key, low-key) and 10 scenarios (studio, window light, family
  at home, golden hour, overcast, midday + fill flash, open shade, sunset +
  strobe, night street + strobe, night bokeh).
- Top-view setup diagram (drag lights), click lights in 3D to move them with a
  gizmo, and **Save photo** to download a PNG.
- **Keyboard shortcuts**: press `?` or the keyboard button in the header for
  the list. Pages (1–6), pick and move lights (K F R B, arrows, Shift+arrows,
  + −, O, S), aperture ([ ]), lens (, .), framing (C), autofocus (A),
  exposure mode (E), focus zone (Z), stands (G), top view (D), save (P).
- **Link previews**: `public/og-image.jpg` (1200×630, rendered in the app) and
  Open Graph / Twitter tags in `index.html`, for Discord, iMessage and others.
- **Tutorial**: a 23-step guided tour from the header that opens each page,
  highlights each control and explains it. Controls stay usable while
  highlighted, and many steps suggest something to try.

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
solo person and the field-at-sunrise HDRI. The family, seats, other locations, props and
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
| `src/hdri.ts` | HDRI locations: sun extraction, lux calibration, metering grid, room measurements |
| `src/projection.ts` | Panorama projected onto relightable proxy surfaces, with the sharp detail layer |
| `src/subject.ts` | Bone poses (on the mannequin), family group poses and seats, head scan, bust |
| `src/person.ts` | Rocketbox people, posed by copying the mannequin's joint turns onto their skeletons |
| `src/assets.ts` | glTF / texture / HDR loading helpers |
| `src/pipeline.ts` | HDR render → thin-lens bokeh → white balance → tone map |
| `src/diagram.ts` | Top-down lighting diagram |
| `src/ui.ts` | Small DOM control kit |
| `src/tour.ts`, `src/tutorial.ts` | Guided tour overlay and its steps |
| `src/shortcuts.ts` | Keyboard shortcut list and panel (keys handled in `app.ts`) |
| `src/backdrop.ts` | Seamless paper backdrop, roll, crossbar and stands |
