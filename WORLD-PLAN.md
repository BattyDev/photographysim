# Wooden world: floor plans

The subjects are wooden posing mannequins, and the furniture and props are
simple carved-wood models (`src/woodwork.ts`): dark walnut like their joints,
and paint, so the pale maple figures stand out. The world around them is the
same toy set, built in `src/dollworld.ts` from these plans: an open-front
dollhouse, a plain studio room and a model-railway style diorama. The HDRI
panoramas still light every scene; they are no longer drawn.

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
  z -1..0 |                                 | z = -1
          |  [======= sofa =======]  side   |
          |   x -1.05..1.05, z -0.69..0.21  | table (1.75,-0.35)
          |            subject (0,0)        |
          |                   coffee table  |
          |                   (1.55, 1.6)   |
          +- - - - - - - open front - - - - + z = +3.0
                        camera ->  +z
```

- **Floor:** matte walnut boards running side to side, x −3.6 to 3.6, z −3.4 to 3.0, on an 8 cm slab.
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
   trees ...  carved trees in clusters, z -8 .. -35 ...  trees
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
- **Trees:** carved toy trees: a walnut trunk under lumpy round crowns or stacked fir tiers
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
- No image files, no downloads. Every surface uses the woodwork.ts materials.
