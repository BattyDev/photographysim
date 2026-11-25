// The tutorial's steps: a walk through every page and control, in the order
// someone would actually use them.
import { label, pageBody, q, type TourStep } from './tour';

const tip = (t: string) => `<p class="tour-try"><strong>Try:</strong> ${t}</p>`;

export const TUTORIAL: TourStep[] = [
  {
    title: 'Welcome to the Lighting Simulator',
    body: `<p>A virtual photo shoot: real-world lights, a real lens and real places, all calculated physically. Whatever you learn here works the same with a camera.</p>
<p>This tour shows every control. You can use each one while it is highlighted. Use <kbd>←</kbd> <kbd>→</kbd> to move and <kbd>Esc</kbd> to close.</p>`,
  },
  {
    title: 'The view is your camera',
    target: q('.viewport'),
    body: `<p>What you see is the photo, with depth of field and exposure applied.</p>
<ul><li><strong>Drag</strong> to walk around the subject, <strong>scroll</strong> or pinch to zoom.</li>
<li><strong>Click a light</strong> to grab it and drag its arrows.</li>
<li><strong>Double-click</strong> anything to focus on it.</li></ul>`,
  },
  {
    title: 'Top view',
    target: q('.diagram'),
    body: `<p>The set from above: the subject, the camera, each light and its beam. Drag a light here to move it around the subject. Outdoors, the sun shows too.</p>`,
  },
  {
    title: 'Pages',
    target: q('.rail'),
    body: `<p>The controls are split into pages: <strong>Shoots</strong>, <strong>Lights</strong>, <strong>Camera</strong>, <strong>Subject</strong>, <strong>Scene</strong> and <strong>View</strong>. The tour visits them in that order.</p>`,
  },
  {
    title: 'Shoots: start here',
    page: 'shoot',
    target: label('Shoots'),
    body: `<p>Complete, ready-to-shoot setups: <strong>Outdoor solo</strong>, <strong>Outdoor family</strong> and <strong>Indoor</strong> (seamless paper in a real studio). Each sets the place, the lights and the lens.</p>
<p><strong>People</strong> swaps between one person and a family of four. The lights move back and get brighter to cover a group.</p>
${tip('switch People to Group and watch where the lights go in the top view.')}`,
  },
  {
    title: 'Poses',
    page: 'shoot',
    target: label('Pose'),
    body: `<p>Poses change how light lands on the face and body. <strong>Three-quarter</strong> shows short and broad lighting, <strong>Profile</strong> shows split light, and <strong>Over shoulder</strong> shows off a rim light.</p>
${tip('pick Profile, then Chin up, and watch the shadows under the nose and chin.')}`,
  },
  {
    title: 'Classic setups and scenarios',
    page: 'shoot',
    target: label('Lighting setups'),
    body: `<p>The named lighting patterns photographers use: <strong>Rembrandt</strong>, <strong>Loop</strong>, <strong>Butterfly</strong>, <strong>Split</strong> and more. Under them, <strong>Scenarios</strong> are whole situations, such as golden hour or midday sun with fill flash.</p>
<p>The note under the buttons explains whatever you last picked.</p>
${tip('click Rembrandt and look for the small triangle of light on the shadow-side cheek.')}`,
  },
  {
    title: 'Lights: pick one to edit',
    page: 'lights',
    target: q('.light-tabs'),
    body: `<p>Up to four lights: <strong>Key</strong> (the main light), <strong>Fill</strong> (softens shadows), <strong>Rim</strong> (outlines the subject from behind) and <strong>Back</strong> (lights the background). Each tab shows its power.</p>
<p><strong>On</strong> switches a light; <strong>Solo</strong> shows just that light, which is the best way to see what each one is doing.</p>`,
  },
  {
    title: 'Power and the light meter',
    page: 'lights',
    target: label('Power'),
    body: `<p>Flash power in stops, from full power (1/1) down to 1/128. Each mark is two stops. Under it, <strong>This light alone</strong> is what a light meter at the face would read for this light.</p>
<p><strong>Strobe</strong> fires in a flash that shutter speed can't change. <strong>Continuous</strong> stays on, so shutter speed matters.</p>`,
  },
  {
    title: 'Modifier and size: hard or soft light',
    page: 'lights',
    target: label('Modifier'),
    body: `<p>The modifier shapes the light. What makes light soft is how big the source looks from the subject: a big softbox close up gives gentle shadows, and a small bare reflector gives crisp ones.</p>
${tip('swap between Standard reflector and Octabox and watch the shadow edges.')}`,
  },
  {
    title: 'Position',
    page: 'lights',
    target: label('Position'),
    body: `<p><strong>Around subject</strong> and <strong>Height</strong> set where the light comes from. <strong>Distance</strong> is on a doubling scale: each mark is twice as far, which costs two stops. That's the inverse square law.</p>
<p><strong>Aim at</strong> points the light at the face or at the background.</p>
${tip('drag Distance from 1 m to 2 m and see the meter reading drop two stops.')}`,
  },
  {
    title: 'Colour and ratios',
    page: 'lights',
    target: label('Ratios at the face'),
    body: `<p>Above this, <strong>Colour</strong> sets the light's colour temperature and adds a gel.</p>
<p><strong>Key : Fill</strong> compares the key to the fill at the face. 2:1 looks open and gentle; 8:1 looks dramatic.</p>`,
  },
  {
    title: 'Camera: framing and height',
    page: 'camera',
    target: label('Framing'),
    body: `<p>Jump to a headshot, half body or full body, and put the camera at eye level, high or low.</p>
${tip('Low angle makes the subject loom larger; High angle shows more of the top light.')}`,
  },
  {
    title: 'Lens: focal length and aperture',
    page: 'camera',
    target: label('Lens'),
    body: `<p><strong>Focal length</strong> sets how much the background is compressed. 85 mm and longer flatters faces. <strong>Aperture</strong> sets how much is sharp: f/1.4 blurs the background away, f/11 keeps it all sharp.</p>
${tip('drop to f/1.4, then try f/8, and watch the background.')}`,
  },
  {
    title: 'Focus',
    page: 'camera',
    target: label('Focus'),
    body: `<p><strong>Autofocus</strong> follows the eyes. Turn it off to focus by distance, or double-click in the view. <strong>Depth of field</strong> says how deep the sharp zone is.</p>
<p><strong>In-focus zone</strong> tints everything that's sharp; <strong>Focus plane</strong> draws the exact focus distance.</p>`,
  },
  {
    title: 'Exposure',
    page: 'camera',
    target: label('Exposure'),
    body: `<p><strong>Auto</strong> keeps the face correctly exposed, so aperture only changes depth of field. <strong>Manual</strong> gives you the full exposure triangle: aperture, shutter speed and ISO.</p>
<p>In Manual, shutter speed changes daylight and continuous light but not flash. Slow it down to brighten the background while the flash keeps the face the same ("dragging the shutter"). Above 1/250 the flash gets cut off.</p>`,
  },
  {
    title: 'White balance',
    page: 'camera',
    target: label('White balance'),
    body: `<p>Tells the camera what "white" looks like. Match it to your light, or set it off to warm up or cool down the photo.</p>
${tip('on an outdoor shoot, try Tungsten for a blue, moody look.')}`,
  },
  {
    title: 'Subject',
    page: 'subject',
    target: pageBody,
    body: `<p>Choose who you're photographing: a wooden mannequin, a scanned real face (best for studying light on skin), or a marble bust.</p>
<p><strong>Turn</strong> angles them toward or away from the key. In the studio, <strong>Subject to backdrop</strong> controls how dark and blurred the paper gets. <strong>Depth props</strong> add things in front and behind to show off depth of field.</p>`,
  },
  {
    title: 'Scene: where you are',
    page: 'scene',
    target: pageBody,
    body: `<p><strong>Studio</strong>: seamless paper on stands in a wooden studio, in any colour. <strong>Room light</strong> sets how much of the room's own light gets in. <strong>Location</strong>: thirteen kinds of real light, captured as panoramas, around a wooden dollhouse room or a model park. Where there is sun, <strong>Subject in shade</strong> gives you open shade.</p>
<p>Both are real surfaces, so your flash lights up the floor and nearby walls, and the background blurs by its real distance. <strong>Sun direction</strong> turns a location around the subject.</p>`,
  },
  {
    title: 'View',
    page: 'view',
    target: pageBody,
    body: `<p>Show or hide the light stands and the top view, start over with <strong>Reset everything</strong>, and see the credits for the models and places.</p>
<p><strong>Export setup</strong> saves everything (lights, camera, subject, scene and where the camera stands) as a small file. Made a look you love? Export it and send the file over, and it can become a built-in preset. <strong>Import setup</strong> loads a file back in.</p>`,
  },
  {
    title: 'Save your photo',
    target: q('.sidebar-header .primary'),
    body: `<p>Renders a high-quality version of the view, with full depth of field, and downloads it as a PNG.</p>`,
  },
  {
    title: 'Keyboard shortcuts',
    target: q('.keys-btn'),
    body: `<p>With a keyboard, press <kbd>?</kbd> or this button for the full list. A few favourites: <kbd>K</kbd> <kbd>F</kbd> <kbd>R</kbd> <kbd>B</kbd> pick a light, the arrow keys move it, <kbd>S</kbd> solos it, and <kbd>[</kbd> <kbd>]</kbd> change the aperture.</p>`,
  },
  {
    title: "You're ready",
    page: 'shoot',
    body: `<p>A good way to start: load a shoot, <strong>Solo</strong> each light to see what it does, then change one thing at a time.</p>
<p>Open this tour again any time with the <strong>Tutorial</strong> button at the top.</p>`,
  },
];
