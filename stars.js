/**
 * Sets up the night sky: a sparse, faint starfield with a few stars that occasionally glimmer,
 * and an aurora that picks up mid-drift instead of starting from the same pose on every load.
 */
const STARS_PER_MEGAPIXEL = 100;
const MIN_STARS = 45;
const MAX_STARS = 150;
const TWINKLE_CHANCE = 0.04;
const TINTS = ["#ffffff", "#ffffff", "#ffffff", "#dfe6f0", "#7aa6da", "#c397d8", "#8abeb7"];

const random = (min, max) => min + Math.random() * (max - min);
const pick = (items) => items[Math.floor(Math.random() * items.length)];

/** Returns size and opacity for one star: mostly tiny and dim, some brighter, a few glowing ones. */
function starLook() {
  const roll = Math.random();
  if (roll < 0.08) return { size: 2, opacity: random(0.55, 0.75), bright: true };
  if (roll < 0.3) return { size: 1.5, opacity: random(0.4, 0.55), bright: false };
  return { size: 1, opacity: random(0.15, 0.35), bright: false };
}

const sky = document.createElement("div");
sky.className = "stars";
sky.setAttribute("aria-hidden", "true");

const megapixels = (window.innerWidth * window.innerHeight) / 1e6;
const count = Math.round(Math.min(MAX_STARS, Math.max(MIN_STARS, megapixels * STARS_PER_MEGAPIXEL)));

for (let i = 0; i < count; i++) {
  const { size, opacity, bright } = starLook();
  const star = document.createElement("span");
  star.className = bright ? "star bright" : "star";
  star.style.left = `${random(0, 100)}%`;
  star.style.top = `${random(0, 100)}%`;
  star.style.setProperty("--size", `${size}px`);
  star.style.setProperty("--o", opacity.toFixed(2));
  star.style.setProperty("--tint", pick(TINTS));
  if (Math.random() < TWINKLE_CHANCE) {
    star.classList.add("twinkle");
    const duration = random(12, 20);
    star.style.setProperty("--tw", `${duration.toFixed(1)}s`);
    star.style.setProperty("--tw-delay", `${(-random(0, duration)).toFixed(1)}s`);
  }
  sky.appendChild(star);
}

document.body.prepend(sky);

// Each aurora layer starts at a random point in its cycle; the CSS turns --phase into a negative delay.
document.querySelectorAll(".aurora, .aurora span").forEach((layer) => {
  layer.style.setProperty("--phase", Math.random().toFixed(3));
});
