const MAX_TILT_DEG = 5;
const canTilt =
  window.matchMedia("(hover: hover)").matches &&
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

document.querySelectorAll(".project a").forEach((card) => {
  card.addEventListener("pointermove", (event) => {
    const rect = card.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    card.style.setProperty("--mx", `${x}px`);
    card.style.setProperty("--my", `${y}px`);

    if (!canTilt) return;
    const offsetX = x / rect.width - 0.5;
    const offsetY = y / rect.height - 0.5;
    card.classList.add("tilting");
    card.style.setProperty("--rx", `${-offsetY * 2 * MAX_TILT_DEG}deg`);
    card.style.setProperty("--ry", `${offsetX * 2 * MAX_TILT_DEG}deg`);
  });

  card.addEventListener("pointerleave", () => {
    card.classList.remove("tilting");
    card.style.removeProperty("--rx");
    card.style.removeProperty("--ry");
  });
});
