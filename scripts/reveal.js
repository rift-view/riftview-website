/* ============================================================
   SCROLL REVEALS + nav state + answer-timer count up
   ============================================================ */

(function () {
  "use strict";

  /* ---------- SCROLL REVEALS ---------- */
  const revealEls = document.querySelectorAll("[data-reveal]");
  if (!revealEls.length) return;

  const revealAll = () => revealEls.forEach(el => el.classList.add("is-revealed"));

  // Respect reduced motion — reveal everything immediately.
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    revealAll();
  } else {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-revealed");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0, rootMargin: "0px 0px 0px 0px" }
    );
    revealEls.forEach(el => io.observe(el));

    // Failsafe: if anything hasn't been revealed after 2.5s (e.g. headless
    // browsers, print, content-visibility edge cases), reveal it anyway. Users
    // who scroll normally will never see this — it's a belt-and-suspenders
    // guarantee that content is never permanently hidden.
    setTimeout(revealAll, 2500);
  }

  /* ---------- NAV STATE (add border-bottom after scroll) ---------- */
  const nav = document.getElementById("nav");
  if (nav) {
    const syncNav = () => {
      if (window.scrollY > 24) nav.classList.add("is-scrolled");
      else nav.classList.remove("is-scrolled");
    };
    syncNav();
    window.addEventListener("scroll", syncNav, { passive: true });
  }

  /* ---------- ANSWER TIMER — count from 00 to target ---------- */
  const timer = document.querySelector("[data-count]");
  if (timer) {
    const target = parseInt(timer.dataset.count, 10) || 10;
    const run = () => {
      const start = performance.now();
      const dur = 1200;
      function step(now) {
        const t = Math.min(1, (now - start) / dur);
        const eased = 1 - Math.pow(1 - t, 3);
        const val = Math.round(eased * target);
        timer.textContent = String(val).padStart(2, "0");
        if (t < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    };
    const io2 = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          run();
          io2.disconnect();
        }
      });
    }, { threshold: 0.5 });
    io2.observe(timer);
  }
})();
