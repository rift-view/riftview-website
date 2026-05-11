/* ============================================================
   MINOR INTERACTIONS
   - Risk panel cycling highlight
   - Smooth-scroll anchors
   ============================================================ */
(function () {
  "use strict";

  /* ---------- RISK PANEL — gently rotate focus ---------- */
  const risks = document.querySelectorAll(".risks .risk");
  if (risks.length > 0) {
    let idx = 0;
    const cycle = () => {
      risks.forEach(r => r.style.outline = "");
      const r = risks[idx % risks.length];
      r.style.outline = "1px solid var(--ember-500)";
      r.style.outlineOffset = "-1px";
      idx++;
    };
    // Only start cycling when the panel is in view
    const panel = document.querySelector(".risks");
    if (panel) {
      const io = new IntersectionObserver(entries => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            cycle();
            setInterval(cycle, 2600);
            io.disconnect();
          }
        });
      }, { threshold: 0.3 });
      io.observe(panel);
    }
  }

  /* ---------- PLATFORM DETECTION — swap download CTAs to user's OS ---------- */
  // Windows builds aren't shipped yet; Windows visitors fall back to macOS so
  // the CTA still points at a real artifact.
  const detectOS = () => {
    const ua = (navigator.userAgent || "") + " " + (navigator.platform || "");
    if (/Mac|iPhone|iPad|iPod/i.test(ua)) return "macos";
    if (/Linux|X11|CrOS/i.test(ua)) return "linux";
    return "macos";
  };
  const os = detectOS();
  const osLabel = { macos: "macOS", linux: "Linux" }[os];

  const primary = document.querySelector("[data-dl-primary]");
  if (primary) {
    primary.setAttribute("data-platform", os);
    const text = primary.querySelector("[data-dl-text]");
    if (text) text.textContent = `Download · ${osLabel}`;
  }

  const heroText = document.querySelector("[data-hero-cta-text]");
  if (heroText) heroText.textContent = `Download for ${osLabel}`;

  document.querySelectorAll("[data-dl-also] .dl-alt").forEach(link => {
    link.hidden = link.dataset.platform === os;
  });

  /* ---------- SMOOTH ANCHOR SCROLL ---------- */
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener("click", e => {
      const href = a.getAttribute("href");
      if (!href || href === "#") return;
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start"
      });
    });
  });

  /* ---------- SUBTLE CURSOR TILT ON HERO GRAPH ---------- */
  // Reads mouse position near the graph and applies a tiny parallax transform.
  // Gated on a hover-capable, fine pointer so touch devices never run the
  // RAF loop (it was previously animating compositor work indefinitely on
  // phones, which never fire mousemove).
  const graph = document.querySelector(".hero-graph");
  const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (graph && canHover && !reducedMotion) {
    let rx = 0, ry = 0, tx = 0, ty = 0;
    let active = false;
    let rafId = 0;
    const maxTilt = 6;
    const EPS = 0.01;

    function frame() {
      rx += (tx - rx) * 0.08;
      ry += (ty - ry) * 0.08;
      graph.style.transform = `perspective(1200px) rotateX(${rx}deg) rotateY(${ry}deg)`;
      // Park the loop once we've settled and there's no active input.
      if (!active && Math.abs(rx - tx) < EPS && Math.abs(ry - ty) < EPS) {
        rafId = 0;
        return;
      }
      rafId = requestAnimationFrame(frame);
    }
    function ensureRunning() {
      if (!rafId) rafId = requestAnimationFrame(frame);
    }
    graph.addEventListener("mouseenter", () => { active = true; ensureRunning(); });
    graph.addEventListener("mousemove", (e) => {
      const r = graph.getBoundingClientRect();
      const mx = (e.clientX - r.left) / r.width - 0.5;
      const my = (e.clientY - r.top) / r.height - 0.5;
      tx = -my * maxTilt;
      ty =  mx * maxTilt;
      ensureRunning();
    });
    graph.addEventListener("mouseleave", () => {
      active = false;
      tx = 0; ty = 0;
      ensureRunning();
    });
  }
})();
