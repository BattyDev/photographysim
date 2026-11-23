// Simulator state, defaults and one-click presets.

export type LightId = 'key' | 'fill' | 'rim' | 'bg';

export type ModifierId =
  | 'bare'
  | 'reflector'
  | 'softbox'
  | 'octabox'
  | 'stripbox'
  | 'umbrella'
  | 'beautydish'
  | 'grid'
  | 'snoot'
  | 'window';

export interface ModifierSpec {
  label: string;
  /** Default size (m) — diameter or long edge. */
  size: number;
  minSize: number;
  maxSize: number;
  /** Half-angle of the beam (deg). */
  beam: number;
  /** 0..1 how gradually the beam edge falls off. */
  feather: number;
  /** On-axis output relative to a 90 cm softbox. */
  efficiency: number;
  /** Width / height of the emitting face (1 = round/square). */
  aspect: number;
  shape: 'round' | 'rect' | 'octa' | 'dish' | 'umbrella' | 'window' | 'cone';
  hint: string;
}

export const MODIFIERS: Record<ModifierId, ModifierSpec> = {
  bare: { label: 'Bare bulb', size: 0.08, minSize: 0.05, maxSize: 0.15, beam: 70, feather: 0.6, efficiency: 0.7, aspect: 1, shape: 'round', hint: 'Tiny source: crisp shadows, hard specular highlights.' },
  reflector: { label: 'Standard reflector', size: 0.18, minSize: 0.15, maxSize: 0.3, beam: 35, feather: 0.4, efficiency: 1.6, aspect: 1, shape: 'cone', hint: 'Small, punchy, fairly hard light with a defined spot.' },
  softbox: { label: 'Softbox', size: 0.9, minSize: 0.4, maxSize: 1.5, beam: 60, feather: 0.8, efficiency: 1, aspect: 1.33, shape: 'rect', hint: 'Large, even, soft light. Bring it closer for softer shadows.' },
  octabox: { label: 'Octabox', size: 1.2, minSize: 0.6, maxSize: 1.9, beam: 60, feather: 0.85, efficiency: 0.9, aspect: 1, shape: 'octa', hint: 'Big soft source with round catchlights.' },
  stripbox: { label: 'Strip box', size: 1.2, minSize: 0.6, maxSize: 1.8, beam: 55, feather: 0.8, efficiency: 0.7, aspect: 0.25, shape: 'rect', hint: 'Long, narrow source: great for rim and edge light.' },
  umbrella: { label: 'Umbrella', size: 1.0, minSize: 0.8, maxSize: 1.8, beam: 70, feather: 0.9, efficiency: 1.1, aspect: 1, shape: 'umbrella', hint: 'Soft and spills everywhere. Easy, forgiving fill.' },
  beautydish: { label: 'Beauty dish', size: 0.55, minSize: 0.4, maxSize: 0.7, beam: 45, feather: 0.6, efficiency: 1.4, aspect: 1, shape: 'dish', hint: 'Medium size with crisp-but-smooth falloff. Classic for butterfly.' },
  grid: { label: 'Grid spot', size: 0.2, minSize: 0.15, maxSize: 0.4, beam: 15, feather: 0.5, efficiency: 2.6, aspect: 1, shape: 'cone', hint: 'Narrow pool of light with little spill.' },
  snoot: { label: 'Snoot', size: 0.08, minSize: 0.05, maxSize: 0.12, beam: 8, feather: 0.35, efficiency: 3, aspect: 1, shape: 'cone', hint: 'Tight spot. Perfect for hair lights and accents.' },
  window: { label: 'Window', size: 1.6, minSize: 0.8, maxSize: 2.5, beam: 75, feather: 0.9, efficiency: 0.6, aspect: 0.75, shape: 'window', hint: 'Daylight through a window: huge, soft, directional.' },
};

export interface LightState {
  id: LightId;
  name: string;
  color: string; // UI accent colour
  enabled: boolean;
  solo: boolean;
  kind: 'strobe' | 'continuous';
  /** Stops below full power (0 = 1/1). */
  power: number;
  kelvin: number;
  gel: string; // hex tint multiplied into the light
  modifier: ModifierId;
  size: number;
  /** Degrees around the subject. 0 = from the camera side, + = camera right, 180 = behind. */
  azimuth: number;
  /** Degrees above the subject's eyes. */
  elevation: number;
  /** Metres from the subject's face. */
  distance: number;
  aim: 'face' | 'background';
  shadows: boolean;
}

export type PoseId = 'standing' | 'turned' | 'profile' | 'overshoulder' | 'chinup' | 'thinker' | 'hip' | 'crossed' | 'seated';
export type GroupPoseId = 'standing' | 'casual' | 'seated';
export type People = 'solo' | 'group';

/** Solo poses, in the order the UI lists them. Several are chosen to show lighting off. */
export const POSE_OPTIONS: { value: PoseId; label: string; title: string }[] = [
  { value: 'standing', label: 'Standing', title: 'Square to camera: a neutral reference' },
  { value: 'turned', label: 'Three-quarter', title: 'Body angled, face to camera: shows short vs broad lighting' },
  { value: 'profile', label: 'Profile', title: 'Side-on: try split light or a rim along the face' },
  { value: 'overshoulder', label: 'Over shoulder', title: 'Back to camera, looking back: shows off rim and hair light' },
  { value: 'chinup', label: 'Chin up', title: 'Face lifted into the light: catchlights and a butterfly shadow' },
  { value: 'thinker', label: 'Hand to chin', title: 'Hand near the face: watch its shadow and the light on the forearm' },
  { value: 'hip', label: 'Hand on hip', title: 'Classic fashion stance' },
  { value: 'crossed', label: 'Arms crossed', title: 'Closed, confident pose' },
  { value: 'seated', label: 'Seated', title: 'On an apple box' },
];
export type SubjectModel = 'mannequin' | 'headscan' | 'bust';
export type LocationId =
  | 'studio_loft'
  | 'workshop'
  | 'meadow'
  | 'sunset'
  | 'park_overcast'
  | 'rooftop_night'
  | 'field_sunrise'
  | 'courtyard'
  | 'quadrangle'
  | 'beach_overcast'
  | 'forest'
  | 'street_night';
export type EnvMode = 'studio' | 'outdoor' | 'location';
export type Weather = 'clear' | 'hazy' | 'overcast' | 'shade';

export interface CameraState {
  focalLength: number; // mm
  aperture: number; // f-number
  focusDistance: number; // m
  trackFocus: boolean; // keep focus on the eyes
  exposureMode: 'auto' | 'manual';
  exposureComp: number; // EV (auto)
  iso: number;
  shutter: number; // s
  whiteBalance: number; // K
  showFocusZone: boolean;
  showFocusPlane: boolean;
}

export interface SubjectState {
  pose: PoseId;
  turn: number; // deg, + turns subject toward camera right
  model: SubjectModel;
  /** One person, or a family of four (mannequins). */
  people: People;
  groupPose: GroupPoseId;
  backgroundDistance: number; // subject to backdrop (studio)
  /** A plant in the studio, a tree stump outdoors, close to the camera. */
  foregroundProp: boolean;
  backgroundFigure: boolean;
  /** A boulder a few metres behind the subject (outdoor locations). */
  backgroundProp: boolean;
  bokehLights: boolean;
}

export interface EnvState {
  mode: EnvMode;
  /** HDRI panorama used when mode is 'location'. */
  location: LocationId;
  backdrop: string;
  ambient: number; // studio room light, lux
  time: number; // hours, outdoor
  sunAzimuth: number; // deg, same convention as lights
  /** Location sun blocked from the subject, as by a building: open shade. */
  inShade: boolean;
  weather: Weather;
  haze: boolean;
}

export interface ViewState {
  showGear: boolean;
  showDiagram: boolean;
}

export interface SimState {
  lights: LightState[];
  camera: CameraState;
  subject: SubjectState;
  env: EnvState;
  view: ViewState;
  selectedLight: LightId;
}

export const BACKDROPS = [
  { label: 'White', color: '#f2f2f0' },
  { label: 'Gray', color: '#7a7a7a' },
  { label: 'Black', color: '#141414' },
  { label: 'Blue', color: '#3d5f8a' },
  { label: 'Warm', color: '#a3734f' },
];


export const TIME_PRESETS = [
  { label: 'Sunrise', time: 6.6 },
  { label: 'Morning', time: 9 },
  { label: 'Midday', time: 12.5 },
  { label: 'Golden hour', time: 17.7 },
  { label: 'Blue hour', time: 18.35 },
  { label: 'Night', time: 21.5 },
];

const LIGHT_META: Record<LightId, { name: string; color: string }> = {
  key: { name: 'Key', color: '#f4b942' },
  fill: { name: 'Fill', color: '#5aa9e6' },
  rim: { name: 'Rim / Hair', color: '#c084fc' },
  bg: { name: 'Background', color: '#4ade80' },
};

export function makeLight(id: LightId, over: Partial<LightState> = {}): LightState {
  const base: LightState = {
    id,
    ...LIGHT_META[id],
    enabled: false,
    solo: false,
    kind: 'strobe',
    power: -3,
    kelvin: 5600,
    gel: '#ffffff',
    modifier: 'softbox',
    size: MODIFIERS.softbox.size,
    azimuth: 0,
    elevation: 30,
    distance: 1.5,
    aim: id === 'bg' ? 'background' : 'face',
    shadows: true,
  };
  const merged = { ...base, ...over };
  if (over.modifier && over.size === undefined) merged.size = MODIFIERS[over.modifier].size;
  return merged;
}

export function defaultState(): SimState {
  return {
    lights: [
      makeLight('key', { enabled: true, azimuth: -40, elevation: 35, distance: 1.5, modifier: 'octabox', power: -3 }),
      makeLight('fill', { enabled: true, azimuth: 35, elevation: 5, distance: 2, modifier: 'umbrella', power: -5 }),
      makeLight('rim', { enabled: true, azimuth: 150, elevation: 35, distance: 1.6, modifier: 'stripbox', power: -4.33 }),
      makeLight('bg', { enabled: true, azimuth: 180, elevation: -25, distance: 0.9, modifier: 'reflector', power: -5, shadows: false }),
    ],
    camera: {
      focalLength: 85,
      aperture: 2.8,
      focusDistance: 2.6,
      trackFocus: true,
      exposureMode: 'auto',
      exposureComp: 0,
      iso: 100,
      shutter: 1 / 125,
      whiteBalance: 5600,
      showFocusZone: false,
      showFocusPlane: false,
    },
    subject: {
      pose: 'turned',
      turn: -15,
      model: 'mannequin',
      people: 'solo',
      groupPose: 'standing',
      backgroundDistance: 2.5,
      foregroundProp: true,
      backgroundFigure: false,
      backgroundProp: false,
      bokehLights: false,
    },
    env: {
      mode: 'studio',
      location: 'meadow',
      backdrop: BACKDROPS[1].color,
      ambient: 15,
      time: 12.5,
      sunAzimuth: -50,
      inShade: false,
      weather: 'clear',
      haze: false,
    },
    view: { showGear: true, showDiagram: true },
    selectedLight: 'key',
  };
}

// ---------------------------------------------------------------- presets

export interface CameraView {
  distance: number;
  height: number;
  azimuth: number; // deg around the subject
  targetHeight: number;
}

export interface Preset {
  id: string;
  label: string;
  blurb: string;
  apply: (s: SimState) => CameraView | void;
}

function setLights(s: SimState, lights: Partial<Record<LightId, Partial<LightState>>>) {
  s.lights = (['key', 'fill', 'rim', 'bg'] as LightId[]).map((id) => {
    const over = lights[id];
    return over ? makeLight(id, { enabled: true, ...over }) : makeLight(id, { enabled: false });
  });
  s.selectedLight = 'key';
}

/** Outdoor scenarios have nothing to sit on. */
function standUp(s: SimState) {
  if (s.subject.pose === 'seated') s.subject.pose = 'turned';
}

const HEADSHOT: CameraView = { distance: 1.45, height: 1.64, azimuth: 0, targetHeight: 1.56 };
const HALF: CameraView = { distance: 3.2, height: 1.55, azimuth: 0, targetHeight: 1.3 };
const FULL: CameraView = { distance: 6.3, height: 1.3, azimuth: 0, targetHeight: 0.92 };
export const FRAMINGS: { label: string; view: CameraView }[] = [
  { label: 'Headshot', view: HEADSHOT },
  { label: 'Half body', view: HALF },
  { label: 'Full body', view: FULL },
];

function studio(s: SimState, backdrop: string) {
  s.env.mode = 'studio';
  s.env.backdrop = backdrop;
  s.env.ambient = 10;
  s.subject.bokehLights = false;
  s.camera.whiteBalance = 5600;
}

export const LIGHTING_PRESETS: Preset[] = [
  {
    id: 'rembrandt',
    label: 'Rembrandt',
    blurb: 'Key high and to the side so the nose shadow meets the cheek shadow, leaving a small triangle of light under the far eye.',
    apply: (s) => {
      setLights(s, {
        key: { azimuth: -50, elevation: 40, distance: 1.4, modifier: 'softbox', power: -3 },
        fill: { azimuth: 30, elevation: 0, distance: 2.4, modifier: 'umbrella', power: -5.33 },
      });
      s.subject.turn = -10;
      s.subject.pose = 'standing';
    },
  },
  {
    id: 'loop',
    label: 'Loop',
    blurb: 'Key about 30° off camera, a little above the eyes. The nose casts a small loop-shaped shadow toward the corner of the mouth.',
    apply: (s) => {
      setLights(s, {
        key: { azimuth: -30, elevation: 30, distance: 1.5, modifier: 'octabox', power: -3 },
        fill: { azimuth: 25, elevation: 5, distance: 2, modifier: 'umbrella', power: -5 },
        rim: { azimuth: 145, elevation: 35, distance: 1.6, modifier: 'stripbox', power: -4.67 },
      });
      s.subject.turn = 0;
    },
  },
  {
    id: 'butterfly',
    label: 'Butterfly',
    blurb: 'Key straight in front and high (Paramount lighting). A butterfly-shaped shadow sits under the nose; cheekbones get sculpted.',
    apply: (s) => {
      setLights(s, {
        key: { azimuth: 0, elevation: 45, distance: 1.3, modifier: 'beautydish', power: -3.67 },
        bg: { azimuth: 180, elevation: -25, distance: 1.1, modifier: 'reflector', power: -6, shadows: false },
      });
      s.subject.turn = 0;
      s.subject.pose = 'standing';
    },
  },
  {
    id: 'clamshell',
    label: 'Clamshell',
    blurb: 'Butterfly key plus a fill from below, like an open clamshell. Very flattering beauty light with minimal shadows.',
    apply: (s) => {
      setLights(s, {
        key: { azimuth: 0, elevation: 40, distance: 1.2, modifier: 'beautydish', power: -3.67 },
        fill: { azimuth: 0, elevation: -25, distance: 1.1, modifier: 'stripbox', size: 0.9, power: -5.33 },
      });
      studio(s, '#f2f2f0');
      s.subject.turn = 0;
      s.subject.pose = 'standing';
    },
  },
  {
    id: 'split',
    label: 'Split',
    blurb: 'Key at 90° to the side splits the face exactly in half: one side lit, one side in shadow. Moody and dramatic.',
    apply: (s) => {
      setLights(s, {
        key: { azimuth: -90, elevation: 5, distance: 1.3, modifier: 'reflector', power: -4.33 },
      });
      studio(s, '#141414');
      s.subject.turn = 0;
      s.subject.pose = 'standing';
    },
  },
  {
    id: 'rim',
    label: 'Rim / edge',
    blurb: 'Two strip boxes behind the subject trace their outline. Little to no front light: shape comes from the edges.',
    apply: (s) => {
      setLights(s, {
        key: { azimuth: -125, elevation: 10, distance: 1.4, modifier: 'stripbox', power: -3.67 },
        rim: { azimuth: 125, elevation: 10, distance: 1.4, modifier: 'stripbox', power: -3.67 },
      });
      studio(s, '#141414');
      s.subject.turn = 0;
    },
  },
  {
    id: 'highkey',
    label: 'High-key',
    blurb: 'Bright, low-contrast: big soft key, plenty of fill, and a background lit a stop or more brighter than the subject.',
    apply: (s) => {
      setLights(s, {
        key: { azimuth: -20, elevation: 25, distance: 1.6, modifier: 'octabox', size: 1.6, power: -3 },
        fill: { azimuth: 25, elevation: 5, distance: 1.8, modifier: 'umbrella', power: -4 },
        bg: { azimuth: 180, elevation: -20, distance: 1, modifier: 'umbrella', power: -2.33, shadows: false },
      });
      studio(s, '#f2f2f0');
    },
  },
  {
    id: 'lowkey',
    label: 'Low-key',
    blurb: 'Mostly shadow: one gridded key, no fill, a snooted hair light and a black backdrop. Contrast does the work.',
    apply: (s) => {
      setLights(s, {
        key: { azimuth: -55, elevation: 35, distance: 1.3, modifier: 'grid', size: 0.3, power: -5 },
        rim: { azimuth: 160, elevation: 55, distance: 1.4, modifier: 'snoot', power: -5.67 },
      });
      studio(s, '#141414');
    },
  },
];

/**
 * Spread face lights out for a group: a source that works 1.5 m from one face
 * would sit inside a family of four. Power rises to cancel the inverse-square loss.
 */
export function fitLightsToGroup(s: SimState) {
  for (const l of s.lights) {
    if (!l.enabled || l.aim !== 'face' || l.distance >= 2.6) continue;
    const d = Math.max(2.6, l.distance * 1.7);
    l.power = Math.min(0, Math.round((l.power + 2 * Math.log2(d / l.distance)) * 3) / 3);
    l.distance = d;
  }
}

const GROUP_STANDING: CameraView = { distance: 6.2, height: 1.4, azimuth: 0, targetHeight: 1.0 };
const GROUP_SEATED: CameraView = { distance: 6.0, height: 1.25, azimuth: 0, targetHeight: 0.85 };

/** Camera for a group, scaled to the lens so the family fills the frame. */
export function groupView(s: SimState, k = 1): CameraView {
  const v = s.subject.groupPose === 'seated' ? GROUP_SEATED : GROUP_STANDING;
  return { ...v, distance: v.distance * k * (s.camera.focalLength / 70) };
}

const SHOWCASE_POSES: PoseId[] = ['turned', 'profile', 'overshoulder', 'chinup', 'thinker'];

/**
 * A field at sunrise: the sun on the horizon behind the subject as a hair
 * light, an off-camera octabox key about half a stop over the soft daylight on
 * the face. Reads `people`.
 */
function outdoorShoot(s: SimState): CameraView {
  s.env = { ...s.env, inShade: false, mode: 'location', location: 'field_sunrise', sunAzimuth: 150 };
  s.subject = { ...s.subject, model: 'mannequin', turn: 0, foregroundProp: false, backgroundFigure: false, bokehLights: false };
  s.camera = { ...s.camera, exposureMode: 'auto', exposureComp: 0, whiteBalance: 5600, trackFocus: true };
  if (s.subject.people === 'group') {
    setLights(s, {
      key: { azimuth: -32, elevation: 22, distance: 3.2, modifier: 'octabox', size: 1.8, power: -2.67 },
      fill: { azimuth: 25, elevation: 5, distance: 4, modifier: 'umbrella', size: 1.5, power: -4.67 },
    });
    s.camera.focalLength = 70;
    s.camera.aperture = 5.6;
    return groupView(s);
  }
  setLights(s, {
    key: { azimuth: -40, elevation: 28, distance: 1.7, modifier: 'octabox', size: 1.2, power: -4.33 },
  });
  if (!SHOWCASE_POSES.includes(s.subject.pose)) s.subject.pose = 'turned';
  s.camera.focalLength = 85;
  s.camera.aperture = 2.8;
  return HALF;
}

/**
 * A real studio: gray seamless paper on stands in a dark room, softbox key,
 * strip light rim and a light on the paper behind. Reads `people`: a group
 * gets the wide roll, stands closer to it, and the lights move back.
 */
function indoorShoot(s: SimState): CameraView {
  s.env = { ...s.env, inShade: false, mode: 'studio', backdrop: BACKDROPS[1].color, ambient: 12 };
  s.subject = { ...s.subject, model: 'mannequin', turn: 0, foregroundProp: false, backgroundFigure: false, bokehLights: false };
  s.camera = { ...s.camera, exposureMode: 'auto', exposureComp: 0, whiteBalance: 5600, trackFocus: true };
  if (s.subject.people === 'group') {
    s.subject.backgroundDistance = 1.7;
    setLights(s, {
      key: { azimuth: -40, elevation: 25, distance: 2.8, modifier: 'softbox', size: 1.5, power: -2.33 },
      fill: { azimuth: 30, elevation: 8, distance: 3.4, modifier: 'umbrella', size: 1.5, power: -4.33 },
      // No background light: its stand would stand between the family.
      rim: { azimuth: 125, elevation: 45, distance: 2.4, modifier: 'stripbox', power: -4 },
    });
    s.camera.focalLength = 70;
    s.camera.aperture = 5.6;
    return groupView(s, 0.85);
  }
  s.subject.backgroundDistance = 2.2;
  setLights(s, {
    key: { azimuth: -45, elevation: 30, distance: 1.5, modifier: 'softbox', size: 1.0, power: -4 },
    rim: { azimuth: 145, elevation: 35, distance: 1.6, modifier: 'stripbox', power: -5 },
    bg: { azimuth: 180, elevation: -25, distance: 1.1, modifier: 'reflector', power: -6, shadows: false },
  });
  if (!SHOWCASE_POSES.includes(s.subject.pose)) s.subject.pose = 'turned';
  s.camera.focalLength = 85;
  s.camera.aperture = 4;
  return HALF;
}

/** The three focus shoots. Solo ⇄ Group re-runs the current shoot for the new group size. */
export const SHOOT_PRESETS: Preset[] = [
  {
    id: 'outdoor-solo',
    label: 'Outdoor solo',
    blurb:
      'Sunrise over an open field, the low sun behind the subject as a hair light, an off-camera octabox as the key. Try Three-quarter, Profile and Over shoulder to see the rim light change.',
    apply: (s) => {
      s.subject.people = 'solo';
      return outdoorShoot(s);
    },
  },
  {
    id: 'outdoor-family',
    label: 'Outdoor family',
    blurb:
      'Backlit by the rising sun, with a big octabox set back far enough to light every face evenly. Stopped down to f/5.6 so the whole family is sharp. Try Seated: they sit on a park bench.',
    apply: (s) => {
      s.subject.people = 'group';
      return outdoorShoot(s);
    },
  },
  {
    id: 'indoor',
    label: 'Indoor',
    blurb:
      'A real studio: gray seamless paper on stands, a softbox key, a strip light for the rim and a light on the paper. Switch Solo ⇄ Group: the wide roll goes up and the lights move back to cover everyone.',
    apply: indoorShoot,
  },
];

export const SCENARIO_PRESETS: Preset[] = [
  {
    id: 'studio',
    label: 'Studio portrait',
    blurb: 'Classic three-light studio setup on a gray backdrop: key, fill, rim, plus a background light.',
    apply: (s) => {
      const fresh = defaultState();
      s.lights = fresh.lights;
      s.camera = { ...fresh.camera };
      s.subject = { ...fresh.subject, model: s.subject.model, people: s.subject.people, groupPose: s.subject.groupPose };
      s.env = fresh.env;
      s.selectedLight = 'key';
      return HALF;
    },
  },
  {
    id: 'window',
    label: 'Window light',
    blurb: 'A real workshop window to the side and no strobes at all. Notice how fast the light falls off across the face and the room.',
    apply: (s) => {
      setLights(s, {});
      s.env = { ...s.env, inShade: false, mode: 'location', location: 'workshop', sunAzimuth: -70 };
      s.camera = { ...s.camera, exposureMode: 'auto', exposureComp: 0, aperture: 2, whiteBalance: 5800 };
      s.subject.bokehLights = false;
      s.subject.turn = -20;
      s.subject.pose = 'seated';
      return { distance: 2.4, height: 1.25, azimuth: 0, targetHeight: 1.05 };
    },
  },
  {
    id: 'golden',
    label: 'Golden hour',
    blurb: 'Low sun behind the subject gives a warm rim; expose for the face and let the background glow.',
    apply: (s) => {
      setLights(s, {});
      s.env = { ...s.env, inShade: false, mode: 'location', location: 'field_sunrise', sunAzimuth: 150 };
      standUp(s);
      s.camera.aperture = 2;
      s.camera.exposureMode = 'auto';
      s.camera.exposureComp = 0;
      s.camera.whiteBalance = 5600;
      s.subject.bokehLights = false;
      s.subject.pose = 'turned';
      return HALF;
    },
  },
  {
    id: 'overcast',
    label: 'Overcast',
    blurb: 'The whole sky becomes one giant softbox. Soft, flat, even light with gentle shadows under the brow and chin.',
    apply: (s) => {
      setLights(s, {});
      s.env = { ...s.env, inShade: false, mode: 'location', location: 'park_overcast', sunAzimuth: -40 };
      standUp(s);
      s.camera.aperture = 2.8;
      s.camera.exposureMode = 'auto';
      s.camera.exposureComp = 0;
      s.camera.whiteBalance = 6500;
      s.subject.bokehLights = false;
      return HALF;
    },
  },
  {
    id: 'midday',
    label: 'Midday + fill flash',
    blurb: 'Harsh overhead sun makes raccoon eyes. A strobe near the camera fills the shadows back in.',
    apply: (s) => {
      setLights(s, {
        fill: { azimuth: 15, elevation: 10, distance: 1.8, modifier: 'umbrella', power: -1 },
      });
      s.env = { ...s.env, inShade: false, mode: 'location', location: 'quadrangle', sunAzimuth: -30 };
      standUp(s);
      s.camera.aperture = 5.6;
      s.camera.exposureMode = 'auto';
      s.camera.exposureComp = 0;
      s.camera.whiteBalance = 5600;
      s.subject.bokehLights = false;
      return HALF;
    },
  },
  {
    id: 'shade',
    label: 'Open shade',
    blurb: 'Step out of the sun into a building’s shadow: soft, even light on the face while the courtyard behind stays bright. The light is cool, so warm up the white balance.',
    apply: (s) => {
      setLights(s, {});
      s.env = { ...s.env, inShade: true, mode: 'location', location: 'courtyard', sunAzimuth: 140 };
      standUp(s);
      s.camera = { ...s.camera, exposureMode: 'auto', exposureComp: 0, aperture: 2.8, whiteBalance: 6800 };
      s.subject.bokehLights = false;
      return HALF;
    },
  },
  {
    id: 'sunset-strobe',
    label: 'Sunset + strobe',
    blurb: 'Manual exposure. The strobe lights the subject (aperture controls it); the shutter controls how bright the sunset behind is. Try 1/250 to deepen the sky, then 1/30.',
    apply: (s) => {
      setLights(s, {
        key: { azimuth: -40, elevation: 25, distance: 1.4, modifier: 'octabox', power: -4, kelvin: 5600 },
      });
      s.env = { ...s.env, inShade: false, mode: 'location', location: 'sunset', sunAzimuth: 160 };
      standUp(s);
      s.camera = { ...s.camera, exposureMode: 'manual', aperture: 4, iso: 100, shutter: 1 / 125, whiteBalance: 5600 };
      s.subject.bokehLights = false;
      return HALF;
    },
  },
  {
    id: 'street-strobe',
    label: 'Night street + strobe',
    blurb: 'Manual exposure on a lamp-lit street. The strobe sets the face (aperture and power); the shutter sets how much of the warm street glow comes through. Try 1/125, then 1/15.',
    apply: (s) => {
      setLights(s, {
        key: { azimuth: -40, elevation: 25, distance: 1.4, modifier: 'octabox', power: -6, kelvin: 5600, gel: '#ffc58a' },
      });
      s.env = { ...s.env, inShade: false, mode: 'location', location: 'street_night', sunAzimuth: 0 };
      standUp(s);
      s.camera = { ...s.camera, exposureMode: 'manual', aperture: 2.8, iso: 800, shutter: 1 / 30, whiteBalance: 3400 };
      s.subject.bokehLights = false;
      return HALF;
    },
  },
  {
    id: 'night',
    label: 'Night bokeh',
    blurb: 'Wide open at night: background string lights melt into bokeh balls while a gridded strobe lights the face.',
    apply: (s) => {
      setLights(s, {
        key: { azimuth: -35, elevation: 25, distance: 1.5, modifier: 'grid', size: 0.3, power: -7, kelvin: 4500 },
        rim: { azimuth: 150, elevation: 30, distance: 1.6, modifier: 'stripbox', power: -7, kelvin: 3200, gel: '#ffb070' },
      });
      s.env = { ...s.env, inShade: false, mode: 'location', location: 'rooftop_night', sunAzimuth: 0, time: 21.5, weather: 'clear', haze: false };
      s.camera = { ...s.camera, exposureMode: 'manual', aperture: 1.6, iso: 100, shutter: 1 / 30, whiteBalance: 4500 };
      s.subject.bokehLights = true;
      return HALF;
    },
  },
];
