document.querySelectorAll(".project:has(.preview img)").forEach((project) => {
  const img = project.querySelector(".preview img");
  project.addEventListener(
    "mouseenter",
    () => {
      img.src = img.dataset.src;
    },
    { once: true },
  );
});
