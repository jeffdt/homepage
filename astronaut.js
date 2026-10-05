const astronaut = document.querySelector(".astronaut");
const SPEED_PX_PER_SEC = 22;
const MAX_SPIN_DEG_PER_SEC = 10;
const WAKE_RADIUS_PX = 110;
// Fraction per second of the gap between his velocity and the pointer's that the wake closes.
const WAKE_DRAG = 1.2;
// Degrees of spin per pixel of pointer travel swept past his side.
const WAKE_SPIN = 1.6;
// Pointer speed at which the wake reaches full strength; slower movement barely stirs it.
const WAKE_FULL_SPEED_PX_PER_SEC = 400;
// How quickly the pointer's wake dies out once it stops moving.
const POINTER_STILL_SEC = 0.08;
const MAX_POINTER_SPEED_PX_PER_SEC = 3000;
const MAX_SPEED_PX_PER_SEC = 150;
const MAX_SPIN_KICK_DEG_PER_SEC = 80;
// Seconds for speed and spin to ease back to a lazy drift after a shove.
const RELAX_SEC = 3;
// Each limb's random swing range in degrees around its drawn pose.
const LIMB_RANGES = {
  ".far-arm": [-35, 35],
  ".near-arm": [-35, 35],
  ".far-leg": [-16, 8],
  ".near-leg": [-8, 16],
};
const MIN_SWING_SEC = 0.9;
const MAX_SWING_SEC = 2.4;
// Each new target lands at least this fraction of the range away, so no move is a twitch.
const MIN_SWING_FRACTION = 0.4;
// How much faster limbs flail at peak excitement from a nudge (1 = normal tempo).
const MAX_FLAIL_RATE = 1.9;
// Extra speed (px/s) and spin (deg/s) from a nudge that each count as full excitement.
const EXCITED_SPEED_PX_PER_SEC = 70;
const EXCITED_SPIN_DEG_PER_SEC = 70;
// How far past the screen edge his frame drifts before the rubber band starts pulling him back.
const WALL_OVERLAP_PX = 24;
// Spring strength of the walls (1/s²); higher is a tighter rubber band.
const WALL_STIFFNESS = 14;
// Energy the walls soak up per second while compressed, so bounces aren't perfectly elastic.
const WALL_DAMPING = 1.2;
// How far past the screen edge he may ever sink, as a fraction of his size.
const MAX_OVERSHOOT_FRACTION = 0.75;
// Caps the step after a backgrounded tab resumes so he doesn't teleport.
const MAX_FRAME_SEC = 0.1;
// Launch speed for his entrance from offscreen; relax() eases it back to a drift.
const ENTRY_SPEED_PX_PER_SEC = 90;
// He aims for a random point within this centered fraction of the screen, so entrances vary.
const ENTRY_TARGET_FRACTION = 0.5;

const prefersStill = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (astronaut && !prefersStill) {
  // SVG elements have no offsetWidth, and a bounding box would include his rotation.
  const size = parseFloat(getComputedStyle(astronaut).width);
  const limbs = Object.entries(LIMB_RANGES).map(([selector, [min, max]]) => {
    const angle = min + Math.random() * (max - min);
    return { el: astronaut.querySelector(selector), min, max, from: angle, to: angle, elapsed: 0, duration: 0 };
  });
  const antennaSway = astronaut
    .getAnimations({ subtree: true })
    .find((animation) => animation.animationName === "sway-antenna");
  let flailRate = 1;
  let touchingWallX = false;
  let touchingWallY = false;
  let { x, y, vx, vy } = entryPath();
  // Walls and the overshoot clamp stay off until he has floated in, or they'd yank him onscreen.
  let entering = true;
  let angle = Math.random() * 360;
  let baseSpin = randomSpin();
  let spinKick = 0;
  let pointer = null;
  let last = performance.now();

  window.addEventListener("pointermove", (event) => {
    if (!pointer) {
      pointer = { x: event.clientX, y: event.clientY, vx: 0, vy: 0, time: event.timeStamp };
      return;
    }
    const elapsed = (event.timeStamp - pointer.time) / 1000;
    if (elapsed > 0.001) {
      const sampleVx = (event.clientX - pointer.x) / elapsed;
      const sampleVy = (event.clientY - pointer.y) / elapsed;
      const clamp = Math.min(1, MAX_POINTER_SPEED_PX_PER_SEC / (Math.hypot(sampleVx, sampleVy) || 1));
      // Averaging with the previous sample smooths out jittery mouse event timing.
      pointer.vx = (pointer.vx + sampleVx * clamp) / 2;
      pointer.vy = (pointer.vy + sampleVy * clamp) / 2;
    }
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.time = event.timeStamp;
  });

  document.documentElement.addEventListener("pointerleave", () => {
    pointer = null;
  });
  // A lifted finger has no hover position, so its wake shouldn't linger.
  window.addEventListener("pointerup", (event) => {
    if (event.pointerType !== "mouse") pointer = null;
  });
  window.addEventListener("pointercancel", () => {
    pointer = null;
  });

  /** Returns a start point just past a random screen edge and a velocity aimed at a spot near the middle. */
  function entryPath() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const margin = size * 0.5;
    const edge = Math.floor(Math.random() * 4);
    const along = Math.random();
    const start = [
      { x: -size - margin, y: along * (height - size) },
      { x: width + margin, y: along * (height - size) },
      { x: along * (width - size), y: -size - margin },
      { x: along * (width - size), y: height + margin },
    ][edge];
    const spread = (1 - ENTRY_TARGET_FRACTION) / 2;
    const targetX = (spread + Math.random() * ENTRY_TARGET_FRACTION) * width - size / 2;
    const targetY = (spread + Math.random() * ENTRY_TARGET_FRACTION) * height - size / 2;
    const distance = Math.hypot(targetX - start.x, targetY - start.y) || 1;
    return {
      x: start.x,
      y: start.y,
      vx: ((targetX - start.x) / distance) * ENTRY_SPEED_PX_PER_SEC,
      vy: ((targetY - start.y) / distance) * ENTRY_SPEED_PX_PER_SEC,
    };
  }

  /** Returns a gentle spin rate in deg/s, in either direction. */
  function randomSpin() {
    return (Math.random() * 2 - 1) * MAX_SPIN_DEG_PER_SEC;
  }

  /** Drags him along with a moving pointer's wake and spins him by which side it passes. */
  function applyWake(dt) {
    if (!pointer) return;
    const still = Math.exp(-dt / POINTER_STILL_SEC);
    pointer.vx *= still;
    pointer.vy *= still;

    const rx = pointer.x - (x + size / 2);
    const ry = pointer.y - (y + size / 2);
    const distance = Math.hypot(rx, ry) || 1;
    if (distance > WAKE_RADIUS_PX) return;

    const pointerSpeed = Math.hypot(pointer.vx, pointer.vy);
    const stir = Math.min(1, pointerSpeed / WAKE_FULL_SPEED_PX_PER_SEC);
    const strength = (1 - distance / WAKE_RADIUS_PX) ** 2 * stir;
    const drag = Math.min(1, WAKE_DRAG * strength * dt);
    vx += (pointer.vx - vx) * drag;
    vy += (pointer.vy - vy) * drag;
    // Cross product of offset and wake velocity: positive means clockwise on screen.
    const sweep = (rx * pointer.vy - ry * pointer.vx) / distance;
    spinKick += sweep * WAKE_SPIN * strength * dt;
    spinKick = Math.max(-MAX_SPIN_KICK_DEG_PER_SEC, Math.min(spinKick, MAX_SPIN_KICK_DEG_PER_SEC));
  }

  /** Eases speed back toward a cruise and lets any spin kick fade out. */
  function relax(dt) {
    const blend = 1 - Math.exp(-dt / RELAX_SEC);
    const speed = Math.hypot(vx, vy) || 1;
    const nextSpeed = Math.min(speed + (SPEED_PX_PER_SEC - speed) * blend, MAX_SPEED_PX_PER_SEC);
    vx *= nextSpeed / speed;
    vy *= nextSpeed / speed;
    spinKick -= spinKick * blend;
  }

  /** Sets how fast his limbs move, in proportion to how much a nudge has stirred him up. */
  function updateFlail() {
    const extraSpeed = Math.max(0, Math.hypot(vx, vy) - SPEED_PX_PER_SEC) / EXCITED_SPEED_PX_PER_SEC;
    const extraSpin = Math.abs(spinKick) / EXCITED_SPIN_DEG_PER_SEC;
    const excitement = Math.min(1, extraSpeed + extraSpin);
    flailRate = 1 + (MAX_FLAIL_RATE - 1) * excitement;
    // Changing playbackRate keeps the antenna's current pose, so the tempo shift is seamless.
    if (antennaSway && Math.abs(antennaSway.playbackRate - flailRate) > 0.02) antennaSway.playbackRate = flailRate;
  }

  /** Picks a fresh random angle and duration for a limb's next swing. */
  function startSwing(limb) {
    const span = limb.max - limb.min;
    let target;
    do {
      target = limb.min + Math.random() * span;
    } while (Math.abs(target - limb.to) < span * MIN_SWING_FRACTION);
    limb.from = limb.to;
    limb.to = target;
    limb.elapsed = 0;
    limb.duration = MIN_SWING_SEC + Math.random() * (MAX_SWING_SEC - MIN_SWING_SEC);
  }

  /** Eases every limb toward its current target, starting a new swing when it arrives. */
  function moveLimbs(dt) {
    limbs.forEach((limb) => {
      limb.elapsed += dt * flailRate;
      if (limb.elapsed >= limb.duration) startSwing(limb);
      const t = limb.elapsed / limb.duration;
      const eased = t * t * (3 - 2 * t);
      limb.el.style.transform = `rotate(${limb.from + (limb.to - limb.from) * eased}deg)`;
    });
  }

  /** Returns the rubber-band acceleration pulling him back once he drifts past an edge, or 0 otherwise. */
  function wallAccel(position, velocity, max) {
    const lowDepth = -WALL_OVERLAP_PX - position;
    const highDepth = position - (max + WALL_OVERLAP_PX);
    const depth = Math.max(lowDepth, highDepth);
    if (depth <= 0) return 0;
    const outward = lowDepth > highDepth ? 1 : -1;
    return outward * WALL_STIFFNESS * depth - velocity * WALL_DAMPING;
  }

  /** Advances position and rotation, springing back off the viewport edges. */
  function step(now) {
    const dt = Math.min((now - last) / 1000, MAX_FRAME_SEC);
    last = now;
    const maxX = Math.max(0, window.innerWidth - size);
    const maxY = Math.max(0, window.innerHeight - size);

    applyWake(dt);
    relax(dt);
    updateFlail();
    moveLimbs(dt);

    if (entering) {
      const insideX = x >= -WALL_OVERLAP_PX && x <= maxX + WALL_OVERLAP_PX;
      const insideY = y >= -WALL_OVERLAP_PX && y <= maxY + WALL_OVERLAP_PX;
      entering = !(insideX && insideY);
    }

    const ax = entering ? 0 : wallAccel(x, vx, maxX);
    const ay = entering ? 0 : wallAccel(y, vy, maxY);
    vx += ax * dt;
    vy += ay * dt;
    // A fresh contact with a wall knocks him into a new lazy spin.
    if (ax !== 0 && !touchingWallX) baseSpin = randomSpin();
    if (ay !== 0 && !touchingWallY) baseSpin = randomSpin();
    touchingWallX = ax !== 0;
    touchingWallY = ay !== 0;

    x += vx * dt;
    y += vy * dt;
    angle += (baseSpin + spinKick) * dt;

    if (!entering) {
      const overshoot = size * MAX_OVERSHOOT_FRACTION;
      x = Math.min(Math.max(x, -overshoot), maxX + overshoot);
      y = Math.min(Math.max(y, -overshoot), maxY + overshoot);
    }

    place();
    requestAnimationFrame(step);
  }

  /** Writes his current position and rotation to the page. */
  function place() {
    astronaut.style.transform = `translate(${x}px, ${y}px) rotate(${angle}deg)`;
  }

  // Positions him offscreen before the first paint so he never flashes at the CSS resting pose.
  place();
  requestAnimationFrame(step);
}
