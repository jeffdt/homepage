if (window.matchMedia("(hover: hover)").matches) {
  const GAP = 16;

  document.querySelectorAll(".project").forEach((project) => {
    const preview = project.querySelector(".preview");
    if (!preview) return;

    const img = preview.querySelector("img");

    function position() {
      const cardRect = project.getBoundingClientRect();
      const previewRect = preview.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      let left;
      if (cardRect.right + GAP + previewRect.width <= vw) {
        left = cardRect.right + GAP;
      } else if (cardRect.left - GAP - previewRect.width >= 0) {
        left = cardRect.left - GAP - previewRect.width;
      } else {
        left = Math.max(GAP, (vw - previewRect.width) / 2);
      }

      let top = cardRect.top;
      if (top + previewRect.height > vh - GAP) {
        top = Math.max(GAP, vh - GAP - previewRect.height);
      }

      preview.style.left = `${left}px`;
      preview.style.top = `${top}px`;
    }

    project.addEventListener("mouseenter", () => {
      if (!img.src) img.src = img.dataset.src;
      preview.classList.add("visible");
      position();
    });

    project.addEventListener("mouseleave", () => {
      preview.classList.remove("visible");
    });

    img.addEventListener("load", () => {
      if (preview.classList.contains("visible")) position();
    });

    window.addEventListener(
      "scroll",
      () => {
        if (preview.classList.contains("visible")) position();
      },
      { passive: true },
    );
  });
}
