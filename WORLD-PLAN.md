# Wooden world: floor plan and ChatGPT prompt

The subjects are wooden posing mannequins, and the furniture and props are
simple carved-wood models (`src/woodwork.ts`): pale maple like the mannequins'
bodies, dark walnut like their joints. This file plans the world around them so
that it looks like the same toy set: an open-front dollhouse and a
model-railway style diorama.

## Conventions (all scenes)

- Units are metres, y is up. The floor or ground top is at y = 0.
- The subject stands at the origin, facing +z. The camera is in front, on the
  +z side, usually 1.5 to 8 m away. "Behind the subject" means −z.
- Camera right is +x.
- Woods: maple `#d9c9ac`, walnut `#5a3a26`.
- Paint palette, used for walls, floors and ground (matte, over faint grain):
  - cream `#e8dcc4`
  - sage `#9aa58a`
  - dusty blue `#8fa3b0`
  - terracotta `#b8765a`
  - charcoal `#3a3a3a`
  - grass `#8a9a5b`
  - gravel `#b5aa96`
- Shapes are simple: rounded blocks, cylinders, spheres and cones, chunky like
  a toy. No fine detail and no realistic textures.
- Lights and sky come from the app, not from these files.

## 1. Living room: open-front dollhouse room

```
                    back wall z = -3.4  (height 2.7)
   x=-3.6 +---[ window ]------[ window ]---+ x=+3.6
          | bookshelf        tree (2.2,-2.6)|
          |    armchair (-2.15,-1.7)        |
     door |                                 | window
  z -1..0 |      kids stand  ~z -0.66       | z = -1
          |  [======= sofa =======]  side   |
          |   x -1.05..1.05, z -0.69..0.21  | table (1.75,-0.35)
          |            subject (0,0)        |
          |                   coffee table  |
          |                   (1.55, 1.6)   |
          +- - - - - - - open front - - - - + z = +3.0
                        camera ->  +z
```

- **Floor:** maple planks, x −3.6 to 3.6, z −3.4 to 3.0, on an 8 cm slab.
- **Walls:** 2.7 m high, cream paint, walnut skirting boards. The front is open.
- **Back wall:**
  - two windows, each 1.2 m wide and 1.6 m tall, with the sill at 0.7 m, centred at x = ±1.4
  - walnut frames and a cross mullion
  - the openings are real holes, so light and the view come through
  - a picture frame or two between the windows
- **Left wall:** a door opening, 0.9 × 2.1 m, at z −1 to 0.
- **Right wall:** one window centred at z = −1.
- **Ceiling:** a separate lid at 2.7 m, so it can be hidden.
- **Already placed by the app:**
  - the sofa
  - the armchair, side table, coffee table and potted tree, at the positions above
- **Keep clear:**
  - 1 m around the subject
  - the sofa's footprint
  - a corridor x −1.5 to 1.5, z 0 to 3.0 (the camera's view)
- **Room for decor:**
  - a bookshelf against the back wall at about x −2.6
  - a floor lamp (no real light)
  - a rug under the coffee table area (thin, flat)

## 2. Photo studio: a large plain room

- **Floor:** x −6 to 6, z −6 to 6. Charcoal-painted floor.
- **Walls:** 4.5 m high, charcoal. The front is open.
- **Ceiling:** a separate lid.
- **Keep clear:**
  - x −2.5 to 2.5, z −6 to 3. The app draws the backdrop paper and its stands there.
  - 1.5 m around the subject
- **Along the walls:**
  - two spare light stands (walnut tripods with a maple box head, unlit)
  - a stool
  - a rolling rack of backdrop rolls (maple, sage and dusty-blue cylinders)
  - one tall window on the left wall with walnut blinds

## 3. Park: a model-railway diorama

```
     houses (pastel blocks, gabled roofs) at z -30 .. -45
   trees ...  lollipop trees in clusters, z -8 .. -35 ...  trees
     picket fence across at z -12, a gap where the path runs
            lamps (-4.2,-11) (4.8,-15) (-1.5,-22)
      bistro set (1.7,-7.5)     path: 1.5 m wide gravel strip
   picnic table (-1.5,-3.3)       along x = 0.3, z +8 .. -40
                 boulder (1.7,-5.5)
                  subject (0,0)
          stump (-0.75, 1.45)
                    camera ->  +z
```

- **Ground:** a disc 45 m in radius, grass paint, with low rounded mounds near
  the edge, so the horizon isn't a hard line.
- **Path:** gravel, 1.5 m wide, along x = 0.3 from z +8 to −40, raised 4 mm.
- **Trees:** "lollipop" trees made of a walnut trunk and a sphere or cone crown
  in sage or grass paint, between 3 and 8 m tall. Put them in clusters from
  z −8 to −35 and out to the sides, never on the path.
- **Fence:** a low maple picket fence across at z −12, with a gap for the path.
- **Houses:** five or six simple houses 30 to 45 m behind:
  - block bodies in cream, sage, dusty blue or terracotta
  - walnut gabled roofs
  - painted-on dark windows
- **Already placed by the app:** the props at the positions in the map.
- **Keep clear:** x −3 to 3, z −8 to 8, except for the path.

## Budgets

- At most about 30,000 triangles and 150 meshes per scene.
- No image files, no downloads. Every surface uses the helpers below.

---

## Prompt to give ChatGPT

Copy everything inside the box.

````text
You are writing one TypeScript module for a three.js (r187) web app: a
photography lighting simulator whose subjects are wooden artist's posing
mannequins. Everything in the scene must look like one handmade wooden toy
set: an open-front dollhouse and a model-railway style diorama. Simple,
chunky shapes, consistent materials, no realism.

Write the file `src/dollworld.ts`. It must export exactly these three
functions, each returning a new THREE.Group:

  export function buildLivingRoom(): THREE.Group
  export function buildStudioRoom(): THREE.Group
  export function buildPark(): THREE.Group

Conventions
- Metres, y up, floor/ground top at y = 0. The subject stands at the origin
  facing +z; the camera is on the +z side, 1.5–8 m away. Camera right is +x.
- Do not add lights, sky, fog, cameras or animation. The app does lighting.
- Do not load any files or textures. Use only `three` and the helpers below.
- Give children clear names. Every group must have a child named "floor"
  (or "ground"), "walls" (rooms only), "ceiling" (rooms only; it must be a
  separate child so the app can hide it) and "decor".
- At most ~30,000 triangles and 150 meshes per scene. Use low segment counts
  (cylinders 12–20, spheres detail 1–2). Build openings (windows, doors) by
  placing wall blocks around them; no CSG.
- Every mesh casts and receives shadows (the `group` helper does that).

Helpers you must use, imported from './woodwork':

  import * as THREE from 'three';
  import { block, post, group, legs, paint, woodMaterial } from './woodwork';

  type Wood = 'maple' | 'walnut';
  // Rounded box centred at (x, y, z); r = edge radius (default 0.012).
  block(wood: Wood, w: number, h: number, d: number, x: number, y: number, z: number, r?: number): THREE.Mesh
  // Cylinder or cone centred at (x, y, z).
  post(wood: Wood, rTop: number, rBottom: number, h: number, x: number, y: number, z: number, seg?: number): THREE.Mesh
  // Groups parts and turns shadows on.
  group(...parts: THREE.Object3D[]): THREE.Group
  // Four square legs for a w × d footprint.
  legs(wood: Wood, w: number, d: number, h: number, size: number, inset?: number): THREE.Mesh[]
  // Matte paint over faint wood grain: walls, floors, ground, crowns, houses.
  paint(color: string, length?: number): THREE.MeshStandardMaterial
  // Plain wood material (for your own geometries, e.g. a sphere).
  woodMaterial(wood: Wood, length?: number): THREE.MeshStandardMaterial

`block`, `post` and `legs` also accept a paint colour in place of the wood,
as a '#rrggbb' string: `block('#e8dcc4', 2, 0.1, 2, 0, 0, 0)` is a cream-painted
block. Keep the mannequins' pale maple for small accents only, so the figures
stand out against the set. For spheres, discs and other shapes, make a
THREE.Mesh with your own geometry and one of these materials.

Palette (use nothing else): maple, walnut, and paints cream #e8dcc4,
sage #9aa58a, dusty blue #8fa3b0, terracotta #b8765a, charcoal #3a3a3a,
grass #8a9a5b, gravel #b5aa96.

Scene 1 — buildLivingRoom(): open-front dollhouse room
- Maple plank floor x −3.6..3.6, z −3.4..3.0 on an 8 cm slab (top at y 0).
- Walls 2.7 m high, cream, walnut skirting. Front (+z side) is open.
- Back wall at z = −3.4: two windows 1.2 m wide × 1.6 m tall, sill 0.7 m,
  centred at x = ±1.4, walnut frames with a cross mullion, real openings.
  One or two framed pictures between them.
- Left wall at x = −3.6: door opening 0.9 × 2.1 m spanning z −1..0.
- Right wall at x = +3.6: one window centred at z = −1.
- Ceiling: a separate lid at 2.7 m (child named "ceiling").
- The app already places: a sofa (footprint x −1.05..1.05, z −0.69..0.21),
  an armchair at (−2.15, −1.7), side table at (1.75, −0.35), coffee table at
  (1.55, 1.6), potted tree at (2.2, −2.6). Do not build these.
- Keep empty: 1 m around the origin, the sofa footprint, and the corridor
  x −1.5..1.5, z 0..3.0.
- Decor: a bookshelf against the back wall around x −2.6 with a few chunky
  painted "books", a floor lamp (no light), a thin flat rug under the coffee
  table area, maybe a wall clock.

Scene 2 — buildStudioRoom(): a large plain photo studio
- Charcoal floor x −6..6, z −6..6; charcoal walls 4.5 m high; open front;
  separate ceiling lid.
- Keep empty: x −2.5..2.5, z −6..3 (the app draws backdrop paper there) and
  1.5 m around the origin.
- Along the walls: two spare light stands (walnut tripods, maple box heads,
  unlit), a stool, a rolling rack holding backdrop rolls (maple, sage and
  dusty-blue cylinders), one tall window on the left wall with walnut blinds.

Scene 3 — buildPark(): model-railway diorama
- Ground: a disc of radius 45 m in grass paint, with low rounded mounds near
  the edge so the horizon is soft.
- Gravel path 1.5 m wide along x = 0.3 from z = +8 to −40, raised 4 mm.
- "Lollipop" trees: walnut trunk + sphere or cone crown in sage or grass,
  3–8 m tall, in clusters from z −8 to −35 and out to the sides, never on
  the path.
- Low maple picket fence across z = −12 with a gap for the path.
- Five or six simple houses 30–45 m behind: block bodies in cream, sage,
  dusty blue or terracotta, walnut gabled roofs, dark painted window blocks.
- The app already places: tree stump (−0.75, 1.45), boulder (1.7, −5.5),
  picnic table (−1.5, −3.3), bistro set (1.7, −7.5), street lamps at
  (−4.2, −11), (4.8, −15), (−1.5, −22). Do not build these, keep 1 m around them.
- Keep empty: x −3..3, z −8..8 except for the path.

Output: only the complete `src/dollworld.ts` file, strict TypeScript, no
`any`, with a short comment above each part saying what it is. Use small
local helper functions to avoid repetition, and a seeded random function
(no Math.random) so the layout is the same on every load.
````

When ChatGPT returns the file, give it to Claude to wire into the app, check
it in the browser and fix anything that doesn't line up.
