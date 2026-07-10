(function () {
  const scene = document.querySelector("#qpcr-interactive-scene");
  if (!scene) {
    return;
  }

  const stepButtons = Array.from(scene.querySelectorAll("[data-pcr-scene-step]"));
  const motionButton = scene.querySelector("#pcr-scene-motion-toggle");
  const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");

  function setActiveStep(step) {
    scene.dataset.activeStep = step;
    stepButtons.forEach((button) => {
      const isActive = button.dataset.pcrSceneStep === step;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  }

  function setMotionState(state) {
    scene.dataset.motionState = state;
    if (!motionButton) {
      return;
    }

    const isPaused = state !== "running";
    motionButton.setAttribute("aria-pressed", isPaused ? "true" : "false");
    motionButton.textContent = isPaused ? "Resume motion" : "Pause motion";
  }

  stepButtons.forEach((button, index) => {
    button.addEventListener("click", () => {
      setActiveStep(button.dataset.pcrSceneStep);
    });

    button.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight"].includes(event.key)) {
        return;
      }

      event.preventDefault();
      const direction = event.key === "ArrowRight" ? 1 : -1;
      const nextIndex = (index + direction + stepButtons.length) % stepButtons.length;
      stepButtons[nextIndex].focus();
      setActiveStep(stepButtons[nextIndex].dataset.pcrSceneStep);
    });
  });

  if (motionButton) {
    motionButton.addEventListener("click", () => {
      setMotionState(scene.dataset.motionState === "running" ? "paused" : "running");
    });
  }

  setActiveStep(scene.dataset.activeStep || "curve");
  setMotionState(motionPreference.matches ? "reduced" : scene.dataset.motionState || "running");
})();
