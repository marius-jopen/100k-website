// Intro animation copied from https://concept.100k.studio/script.js
(() => {
  const introElement = document.querySelector(".intro");
  const textContainers = document.querySelectorAll(".text-container");

  if (
    !introElement ||
    !textContainers.length ||
    typeof window.anime !== "function"
  ) {
    introElement?.remove();
    return;
  }

  const timeline = window.anime.timeline({
    easing: "easeOutExpo",
    duration: 1000,
    complete: () => {
      const panels = introElement.querySelectorAll(".intro-top, .intro-bottom");
      let remainingPanels = panels.length;
      let hasFinished = false;

      const finishIntro = () => {
        if (hasFinished) return;
        hasFinished = true;
        introElement.remove();
      };

      const handlePanelTransitionEnd = (event) => {
        if (event.propertyName !== "transform") return;
        remainingPanels -= 1;
        if (remainingPanels <= 0) finishIntro();
      };

      panels.forEach((panel) => {
        panel.addEventListener("transitionend", handlePanelTransitionEnd, { once: true });
      });

      window.setTimeout(finishIntro, 1700);
    },
  });

  timeline.add(
    {
      targets: ".intro-text-1",
      opacity: [0, 1],
      duration: 1,
    },
    0,
  );

  timeline.add(
    {
      targets: ".intro-text-1",
      opacity: [1, 0],
      duration: 1,
    },
    "+=600",
  );

  timeline.add(
    {
      targets: ".intro-text-2",
      opacity: [0, 1],
      duration: 1,
    },
    "-=0",
  );

  timeline.add(
    {
      targets: ".intro-text-2",
      opacity: [1, 0],
      duration: 1,
    },
    "+=600",
  );

  timeline.add(
    {
      targets: textContainers,
      opacity: [0, 1],
      duration: 1,
      easing: "easeOutQuart",
    },
    "-=0",
  );

  timeline.add(
    {
      targets: ".intro-top",
      translateY: ["0%", "-100%"],
      duration: 200,
      easing: "easeOutQuart",
    },
    "+=1000",
  );

  timeline.add(
    {
      targets: ".intro-bottom",
      translateY: ["0%", "100%"],
      duration: 200,
      easing: "easeOutQuart",
    },
    "-=200",
  );

})();
