if (window.matchMedia("(hover: hover)").matches) {
  const GAP = 16;
  const MAX_WIDTH = 480;
  const MIN_SIDE_WIDTH = 240;

  document.querySelectorAll(".project").forEach((project) => {
    const preview = project.querySelector(".preview");
    if (!preview) return;

    const media = preview.querySelector("img, video");
    const isVideo = media.tagName === "VIDEO";
    // Cards tilt in 3D, and a transformed ancestor would trap this fixed-position preview.
    document.body.appendChild(preview);

    function position() {
      const cardRect = project.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      const spaceRight = vw - cardRect.right - GAP * 2;
      const spaceLeft = cardRect.left - GAP * 2;
      const sideSpace = Math.max(spaceRight, spaceLeft);

      let left;
      let top;

      if (sideSpace >= MIN_SIDE_WIDTH) {
        preview.style.width = `${Math.min(MAX_WIDTH, sideSpace)}px`;
        const previewRect = preview.getBoundingClientRect();
        left =
          spaceRight >= spaceLeft
            ? cardRect.right + GAP
            : cardRect.left - GAP - previewRect.width;
        top = Math.min(cardRect.top, vh - GAP - previewRect.height);
      } else {
        preview.style.width = `${Math.min(MAX_WIDTH, vw - GAP * 2)}px`;
        const previewRect = preview.getBoundingClientRect();
        left = Math.max(GAP, Math.min(cardRect.left, vw - GAP - previewRect.width));
        const below = cardRect.bottom + GAP;
        const above = cardRect.top - GAP - previewRect.height;
        top = below + previewRect.height <= vh - GAP || above < GAP ? below : above;
        top = Math.min(top, vh - GAP - previewRect.height);
      }

      preview.style.left = `${left}px`;
      preview.style.top = `${Math.max(GAP, top)}px`;
    }

    project.addEventListener("mouseenter", () => {
      if (!media.getAttribute("src")) media.src = media.dataset.src;
      preview.classList.add("visible");
      position();
      if (isVideo) {
        media.currentTime = 0;
        media.play().catch(() => {});
      }
    });

    project.addEventListener("mouseleave", () => {
      preview.classList.remove("visible");
      if (isVideo) media.pause();
    });

    media.addEventListener(isVideo ? "loadedmetadata" : "load", () => {
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
