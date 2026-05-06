/* ============================================================
   RIFTVIEW — HERO GRAPH
   An animated infrastructure graph that IS the product demo.
   Canvas2D, no deps. Node layout is hand-placed for composition.
   ============================================================ */

/* Shared low-power heuristics. Older Android phones report saveData,
   coarse pointer, and low deviceMemory. We use this to throttle frame
   rate and to skip the most expensive paint paths entirely. */
window.__rvLowPower = (function () {
  try {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (conn && (conn.saveData || /(^|\b)(2g|slow-2g|3g)\b/.test(conn.effectiveType || ""))) return true;
    if (typeof navigator.deviceMemory === "number" && navigator.deviceMemory <= 2) return true;
    if (typeof navigator.hardwareConcurrency === "number" && navigator.hardwareConcurrency <= 4
        && window.matchMedia("(pointer: coarse)").matches) return true;
  } catch (_) { /* ignore */ }
  return false;
})();

(function () {
  "use strict";

  const canvas = document.getElementById("graph-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const lowPower = window.__rvLowPower;
  const PR = Math.min(window.devicePixelRatio || 1, lowPower ? 1 : 2);

  /* ---------- PALETTE (matches CSS tokens) ---------- */
  const COLOR = {
    bg: "transparent",
    dim: "oklch(0.32 0.010 30)",
    dimFill: "oklch(0.17 0.009 30)",
    node: "oklch(0.42 0.012 30)",
    nodeFill: "oklch(0.20 0.010 30)",
    edge: "oklch(0.30 0.010 30)",
    edgeHot: "oklch(0.73 0.170 50)",
    ember: "oklch(0.73 0.170 50)",
    emberSoft: "oklch(0.73 0.170 50 / 0.35)",
    emberGlow: "oklch(0.73 0.170 50 / 0.20)",
    bone: "oklch(0.95 0.013 75)",
    boneDim: "oklch(0.72 0.018 70)",
    fault: "oklch(0.60 0.200 28)",
  };

  /* ---------- DATA ----------
     Positions are normalized [0, 1] in graph space.
     Hand-placed for composition, not grid-uniform.
     The 'hot' node (source of blast radius) is center-right,
     with dense connections flowing outward. */
  const NODES = [
    // --- Core hot subgraph ---
    { id: "rds",       x: 0.54, y: 0.46, label: "prod-users-db",  type: "DB",     hot: true,  big: true },
    { id: "api",       x: 0.74, y: 0.32, label: "api-gateway",    type: "API",    size: 1 },
    { id: "lam1",      x: 0.84, y: 0.50, label: "users-fn",       type: "FN",     size: 1 },
    { id: "lam2",      x: 0.80, y: 0.68, label: "orders-fn",      type: "FN",     size: 1 },
    { id: "sqs1",      x: 0.64, y: 0.72, label: "order-intake",   type: "QUEUE",  size: 1 },
    { id: "lam3",      x: 0.44, y: 0.68, label: "orders-worker",  type: "FN",     size: 1 },
    { id: "cache",     x: 0.36, y: 0.40, label: "session-cache",  type: "CACHE",  size: 1 },

    // --- Secondary connected nodes ---
    { id: "cf",        x: 0.90, y: 0.22, label: "edge-cdn",       type: "CDN",    size: 0.9 },
    { id: "s3",        x: 0.92, y: 0.38, label: "user-assets",    type: "STORE",  size: 0.9 },
    { id: "dyn",       x: 0.66, y: 0.86, label: "sessions-kv",    type: "KV",     size: 0.9 },
    { id: "sns",       x: 0.30, y: 0.80, label: "notifications",  type: "PUBSUB", size: 0.9 },

    // --- Unrelated / dim ---
    { id: "ec2a",      x: 0.14, y: 0.22, label: "batch-worker",   type: "VM",     size: 0.85, dim: true },
    { id: "ec2b",      x: 0.08, y: 0.50, label: "ml-trainer",     type: "VM",     size: 0.85, dim: true },
    { id: "s3b",       x: 0.16, y: 0.72, label: "logs-archive",   type: "STORE",  size: 0.85, dim: true },
    { id: "glue",      x: 0.46, y: 0.18, label: "etl-crawler",    type: "ETL",    size: 0.8,  dim: true },
    { id: "kin",       x: 0.24, y: 0.08, label: "clickstream",    type: "STREAM", size: 0.8,  dim: true },
    { id: "elb",       x: 0.62, y: 0.10, label: "web-balancer",   type: "LB",     size: 0.85, dim: true },
    { id: "cw",        x: 0.08, y: 0.92, label: "alarms",         type: "LOGS",   size: 0.8,  dim: true },
    { id: "iam",       x: 0.48, y: 0.92, label: "fn-role",        type: "IAM",    size: 0.8,  dim: true },
    { id: "sec",       x: 0.92, y: 0.82, label: "db-secret",      type: "SECRET", size: 0.8,  dim: true },
  ];

  const EDGES = [
    // Hot edges (cascading blast radius)
    { a: "rds", b: "api",   hot: true },
    { a: "rds", b: "lam1",  hot: true },
    { a: "rds", b: "lam2",  hot: true },
    { a: "rds", b: "lam3",  hot: true },
    { a: "rds", b: "cache", hot: true },
    { a: "rds", b: "sqs1",  hot: true },
    { a: "api", b: "cf",    hot: true },
    { a: "api", b: "s3",    hot: true },
    { a: "sqs1", b: "dyn",  hot: true },
    { a: "lam3", b: "sns",  hot: true },

    // Cool edges
    { a: "ec2a", b: "glue" },
    { a: "ec2b", b: "glue" },
    { a: "glue", b: "kin" },
    { a: "ec2b", b: "s3b" },
    { a: "s3b", b: "cw" },
    { a: "kin", b: "elb" },
    { a: "ec2a", b: "ec2b" },
    { a: "iam", b: "cw" },
    { a: "sec", b: "dyn" },
  ];

  const nodeById = Object.fromEntries(NODES.map(n => [n.id, n]));

  /* ---------- SIZING ---------- */
  let W = 0, H = 0;
  // Cached gradient sprites — rebuilt only on resize, not per frame.
  let hotGlowSprite = null;     // pre-rendered radial glow for the hot node
  let hotNodeFill = null;       // linear gradient for hot node body
  let hotGlowSize = 0;          // px radius the sprite was rendered at

  function resize() {
    const r = canvas.getBoundingClientRect();
    // If we're in pre-layout state, fall back to parent/offsetParent or a
    // sane default so the first frame still lays out something useful.
    const parent = canvas.parentElement;
    W = r.width  || (parent && parent.clientWidth)  || 480;
    H = r.height || (parent && parent.clientHeight) || 540;
    canvas.width  = Math.round(W * PR);
    canvas.height = Math.round(H * PR);
    ctx.setTransform(PR, 0, 0, PR, 0, 0);
    rebuildSprites();
  }

  /* Pre-render the hot node glow once into an offscreen canvas. Drawing
     this as an image each frame is ~10x cheaper than radial gradient +
     shadowBlur on older Android GPUs. */
  function rebuildSprites() {
    const hot = nodeById["rds"];
    const baseSize = 18 * (hot.size || 1);
    const maxGlow = baseSize + 12 + 8; // matches glow upper bound below
    hotGlowSize = Math.ceil(maxGlow * 2 + 8);
    const off = document.createElement("canvas");
    off.width = hotGlowSize;
    off.height = hotGlowSize;
    const oc = off.getContext("2d");
    const cx = hotGlowSize / 2, cy = hotGlowSize / 2;
    const grad = oc.createRadialGradient(cx, cy, baseSize * 0.4, cx, cy, maxGlow);
    grad.addColorStop(0, COLOR.emberSoft);
    grad.addColorStop(1, "oklch(0.73 0.170 50 / 0)");
    oc.fillStyle = grad;
    oc.beginPath();
    oc.arc(cx, cy, maxGlow, 0, Math.PI * 2);
    oc.fill();
    hotGlowSprite = off;

    // Linear fill gradient for the hot node body — cached, normalized
    // (we'll redraw with a translate so this gradient always lines up).
    const hotPx = baseSize;
    const lg = ctx.createLinearGradient(-hotPx, -hotPx, hotPx, hotPx);
    lg.addColorStop(0, "oklch(0.80 0.14 55)");
    lg.addColorStop(1, "oklch(0.63 0.17 45)");
    hotNodeFill = lg;
  }

  function coord(n) {
    return { x: n.x * W, y: n.y * H };
  }

  /* ---------- ANIMATION STATE ---------- */
  let start = performance.now();
  let needsRedraw = true;
  let rafId = 0;
  let running = false;
  let visible = false;            // intersects viewport
  let pageVisible = !document.hidden;
  // Frame throttling on low-power: ~30fps instead of 60fps.
  const minFrameMs = lowPower ? 33 : 0;
  let lastFrameAt = 0;

  // Progress values for the reveal sequence
  const PHASE = {
    EDGES:   { start: 200,  dur: 1200 }, // edges draw in
    NODES:   { start: 400,  dur: 900  }, // nodes pop in
    PULSE:   { start: 1600, dur: 0    }, // continuous pulse starts
  };

  function phaseProgress(phase, now) {
    const t = now - start - phase.start;
    if (t <= 0) return 0;
    if (phase.dur === 0) return 1;
    return Math.min(1, t / phase.dur);
  }

  // Easing — quartic ease-out
  const ease = t => 1 - Math.pow(1 - t, 4);

  /* ---------- DRAWING HELPERS ---------- */

  function drawEdge(a, b, progress, isHot, pulsePhase) {
    const pa = coord(a), pb = coord(b);
    const dx = pb.x - pa.x, dy = pb.y - pa.y;
    const dist = Math.hypot(dx, dy);

    // Bezier curve — gentle arc perpendicular to direction
    const mx = (pa.x + pb.x) / 2;
    const my = (pa.y + pb.y) / 2;
    // Perpendicular offset — subtle arc
    const perp = { x: -dy / dist, y: dx / dist };
    const arcMag = Math.min(dist * 0.08, 18);
    const cx = mx + perp.x * arcMag;
    const cy = my + perp.y * arcMag;

    // Animate drawing along curve
    const drawTo = Math.max(0, Math.min(1, progress));

    if (drawTo <= 0) return;

    ctx.save();
    if (isHot) {
      ctx.strokeStyle = COLOR.edgeHot;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 1.35;
      // shadowBlur removed — pre-rendered glow sprite carries the warmth
    } else {
      ctx.strokeStyle = COLOR.edge;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 1;
    }

    // Compute partial curve endpoint (linear approximation along bezier)
    const t = drawTo;
    const bx = (1 - t) * (1 - t) * pa.x + 2 * (1 - t) * t * cx + t * t * pb.x;
    const by = (1 - t) * (1 - t) * pa.y + 2 * (1 - t) * t * cy + t * t * pb.y;

    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.quadraticCurveTo(cx, cy, bx, by);
    ctx.stroke();

    // Animated particle flowing along hot edges — skip on low-power
    if (isHot && drawTo >= 1 && pulsePhase !== undefined && !lowPower) {
      const flow = (pulsePhase + (Math.abs(a.x - 0.54) + Math.abs(a.y - 0.46)) * 0.4) % 1;
      const px = (1 - flow) * (1 - flow) * pa.x + 2 * (1 - flow) * flow * cx + flow * flow * pb.x;
      const py = (1 - flow) * (1 - flow) * pa.y + 2 * (1 - flow) * flow * cy + flow * flow * pb.y;
      ctx.globalAlpha = 0.85 * (1 - Math.abs(flow - 0.5) * 1.4);
      ctx.fillStyle = COLOR.ember;
      // shadowBlur removed; the cached glow sprite under the hot node
      // already provides the visual anchor for the flow particles.
      ctx.beginPath();
      ctx.arc(px, py, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawNode(n, progress, pulseAmt, highlight) {
    const p = coord(n);
    const baseSize = 18 * (n.size || 1);
    const size = baseSize * ease(progress);

    if (size < 0.5) return;

    ctx.save();

    const isHot = n.hot;
    const isNeighbor = highlight.has(n.id) && !isHot;
    const isFaded = n.dim && !highlight.has(n.id);

    // Outer glow for hot node — blit the pre-rendered sprite
    // instead of building a radial gradient + fill every frame.
    if (isHot && hotGlowSprite) {
      const half = hotGlowSize / 2;
      // Subtle pulse via globalAlpha so the sprite itself stays cached.
      ctx.globalAlpha = 0.85 + pulseAmt * 0.15;
      ctx.drawImage(hotGlowSprite, p.x - half, p.y - half);
    }

    // Rounded square card
    const r = size * 0.22;
    ctx.globalAlpha = isFaded ? 0.35 : 1;

    // Fill
    if (isHot) {
      // Translate so the cached gradient (centered at 0,0) aligns to the node.
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.fillStyle = hotNodeFill || "oklch(0.70 0.15 50)";
      roundRect(ctx, -size / 2, -size / 2, size, size, r);
      ctx.fill();
      ctx.restore();
    } else if (isNeighbor) {
      ctx.fillStyle = "oklch(0.22 0.04 45)";
      roundRect(ctx, p.x - size / 2, p.y - size / 2, size, size, r);
      ctx.fill();
    } else {
      ctx.fillStyle = COLOR.nodeFill;
      roundRect(ctx, p.x - size / 2, p.y - size / 2, size, size, r);
      ctx.fill();
    }

    // Border
    ctx.lineWidth = 1;
    if (isHot) {
      ctx.strokeStyle = "oklch(0.92 0.10 60)";
      ctx.lineWidth = 1.2;
    } else if (isNeighbor) {
      ctx.strokeStyle = COLOR.ember;
      ctx.lineWidth = 1.1;
    } else {
      ctx.strokeStyle = COLOR.node;
    }
    roundRect(ctx, p.x - size / 2, p.y - size / 2, size, size, r);
    ctx.stroke();

    // Type label inside the card
    ctx.font = `600 ${Math.round(size * 0.32)}px "Fragment Mono", ui-monospace, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = isHot ? "oklch(0.14 0.01 30)" :
                    isNeighbor ? COLOR.bone :
                    COLOR.boneDim;
    ctx.globalAlpha = (isFaded ? 0.5 : 1) * (size / baseSize);
    ctx.fillText(n.type, p.x, p.y + size * 0.02);

    // Resource label below
    if (progress > 0.7) {
      const labelAlpha = (progress - 0.7) / 0.3;
      ctx.font = `500 ${Math.max(9, Math.round(size * 0.36))}px "Libre Franklin", system-ui, sans-serif`;
      ctx.fillStyle = isHot ? COLOR.bone :
                      isNeighbor ? COLOR.bone :
                      COLOR.boneDim;
      ctx.globalAlpha = (isFaded ? 0.35 : 0.85) * labelAlpha;
      ctx.fillText(n.label, p.x, p.y + size / 2 + 12);
    }

    ctx.restore();
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y);
    c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r);
    c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r);
    c.quadraticCurveTo(x, y, x + r, y);
    c.closePath();
  }

  /* ---------- BLAST RADIUS COMPUTATION ---------- */
  // Returns a Set of node ids that are "hot" (connected to the hot node within N hops)
  function computeBlast(sourceId, hops = 2) {
    const visited = new Set([sourceId]);
    let frontier = new Set([sourceId]);
    for (let i = 0; i < hops; i++) {
      const next = new Set();
      for (const e of EDGES) {
        if (frontier.has(e.a) && !visited.has(e.b)) { next.add(e.b); visited.add(e.b); }
        if (frontier.has(e.b) && !visited.has(e.a)) { next.add(e.a); visited.add(e.a); }
      }
      frontier = next;
    }
    return visited;
  }

  const hotNodeId = "rds";
  let blastSet = computeBlast(hotNodeId, 2);

  /* ---------- MAIN LOOP ---------- */
  function draw(now) {
    rafId = 0;
    if (!running) return;

    // Frame throttle on low-power devices.
    if (minFrameMs && now - lastFrameAt < minFrameMs) {
      rafId = requestAnimationFrame(draw);
      return;
    }
    lastFrameAt = now;

    ctx.clearRect(0, 0, W, H);

    const flowCycle = ((now - start) / 3400) % 1;
    const pulseAmt = 0.5 + 0.5 * Math.sin((now - start) / 600);

    // Edges first, sorted so cool edges are drawn first (hot overlays them)
    const sortedEdges = [...EDGES].sort((a, b) => (a.hot ? 1 : 0) - (b.hot ? 1 : 0));
    for (const e of sortedEdges) {
      const a = nodeById[e.a], b = nodeById[e.b];
      if (!a || !b) continue;
      const edgeStart = e.hot ? PHASE.EDGES.start : PHASE.EDGES.start + 400;
      const progress = phaseProgress({ start: edgeStart, dur: PHASE.EDGES.dur }, now);
      drawEdge(a, b, progress, !!e.hot, flowCycle);
    }

    // Nodes — stagger by distance from hot node
    const hotPos = coord(nodeById[hotNodeId]);
    for (const n of NODES) {
      const p = coord(n);
      const distFromHot = Math.hypot(p.x - hotPos.x, p.y - hotPos.y);
      const delay = distFromHot * 1.2; // ms per px from hot node
      const progress = phaseProgress({ start: PHASE.NODES.start + delay, dur: PHASE.NODES.dur }, now);
      drawNode(n, progress, pulseAmt, blastSet);
    }

    rafId = requestAnimationFrame(draw);
  }

  function startLoop() {
    if (running) return;
    if (!visible || !pageVisible) return;
    running = true;
    lastFrameAt = 0;
    rafId = requestAnimationFrame(draw);
  }

  function stopLoop() {
    running = false;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  }

  /* ---------- INIT ---------- */
  let initialized = false;
  function init() {
    if (initialized) return;
    resize();
    if (W < 10 || H < 10) {
      // Container hasn't laid out yet — wait for it
      return;
    }
    initialized = true;
    start = performance.now();
    // Wire up visibility/page gating, then start.
    setupGating();
    if (visible && pageVisible) startLoop();
  }

  function setupGating() {
    if (typeof IntersectionObserver !== "undefined") {
      const io = new IntersectionObserver((entries) => {
        for (const e of entries) {
          visible = e.isIntersecting;
          if (visible) startLoop();
          else stopLoop();
        }
      }, { threshold: 0 });
      io.observe(canvas);
    } else {
      visible = true;
    }
    document.addEventListener("visibilitychange", () => {
      pageVisible = !document.hidden;
      if (pageVisible && visible) startLoop();
      else stopLoop();
    });
  }

  window.addEventListener("resize", () => {
    resize();
    if (!initialized) init();
  });

  // ResizeObserver keeps the canvas in sync as the container size settles
  // post-paint (e.g. headless browsers, late font metrics, media query flips)
  if (typeof ResizeObserver !== "undefined") {
    const ro = new ResizeObserver(() => {
      resize();
      if (!initialized) init();
    });
    ro.observe(canvas.parentElement || canvas);
  }

  // Respect reduced motion — skip the intro, go straight to final state
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    PHASE.EDGES.dur = 0;
    PHASE.NODES.dur = 0;
  }

  // Start when fonts load (so labels render correctly), with fallback
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(init).catch(init);
  } else {
    init();
  }
  // Also schedule an immediate init — if fonts are already cached
  requestAnimationFrame(init);
})();

/* ============================================================
   BLAST-RADIUS MINI GRAPH — Feature 01 demo
   Smaller, purpose-built: show a node, show its dependents lit up.
   ============================================================ */
(function () {
  "use strict";
  const canvas = document.getElementById("blast-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const lowPower = window.__rvLowPower;
  const PR = Math.min(window.devicePixelRatio || 1, lowPower ? 1 : 2);

  // Mini node set — 1 hot + concentric dependents
  const HOT = { x: 0.50, y: 0.52, label: "DB", r: 26 };
  const RING1 = [
    { x: 0.22, y: 0.30, label: "FN" },
    { x: 0.78, y: 0.30, label: "API" },
    { x: 0.18, y: 0.72, label: "FN" },
    { x: 0.50, y: 0.85, label: "QUE" },
    { x: 0.82, y: 0.72, label: "FN" },
  ];
  const RING2 = [
    { x: 0.08, y: 0.10, label: "IAM", dim: true },
    { x: 0.92, y: 0.10, label: "CDN", dim: true },
    { x: 0.05, y: 0.94, label: "STO", dim: true },
    { x: 0.95, y: 0.94, label: "KV",  dim: true },
  ];

  let W = 0, H = 0;
  let hotGlowSprite = null;
  let hotGlowSize = 0;
  let hotFill = null;

  function resize() {
    const r = canvas.getBoundingClientRect();
    const parent = canvas.parentElement;
    W = r.width || (parent && parent.clientWidth) || 480;
    H = Math.max(r.height, 280);
    canvas.style.height = "280px";
    canvas.width = W * PR;
    canvas.height = H * PR;
    ctx.setTransform(PR, 0, 0, PR, 0, 0);
    rebuildSprites();
  }

  function rebuildSprites() {
    const maxGlow = HOT.r + 22;
    hotGlowSize = Math.ceil(maxGlow * 2 + 8);
    const off = document.createElement("canvas");
    off.width = hotGlowSize;
    off.height = hotGlowSize;
    const oc = off.getContext("2d");
    const cx = hotGlowSize / 2, cy = hotGlowSize / 2;
    const grad = oc.createRadialGradient(cx, cy, HOT.r * 0.5, cx, cy, maxGlow);
    grad.addColorStop(0, "oklch(0.73 0.170 50 / 0.45)");
    grad.addColorStop(1, "oklch(0.73 0.170 50 / 0)");
    oc.fillStyle = grad;
    oc.beginPath();
    oc.arc(cx, cy, maxGlow, 0, Math.PI * 2);
    oc.fill();
    hotGlowSprite = off;

    const lg = ctx.createLinearGradient(-HOT.r, -HOT.r, HOT.r, HOT.r);
    lg.addColorStop(0, "oklch(0.80 0.14 55)");
    lg.addColorStop(1, "oklch(0.63 0.17 45)");
    hotFill = lg;
  }

  let start = performance.now();

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y);
    c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r);
    c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r);
    c.quadraticCurveTo(x, y, x + r, y);
    c.closePath();
  }

  function drawNode(n, size, style, alpha, pulseAmt) {
    const x = n.x * W, y = n.y * H;
    ctx.save();
    ctx.globalAlpha = alpha;
    if (style === "hot") {
      // Cached glow sprite — no per-frame radial gradient.
      if (hotGlowSprite) {
        const half = hotGlowSize / 2;
        ctx.globalAlpha = alpha * (0.85 + (pulseAmt || 0) * 0.15);
        ctx.drawImage(hotGlowSprite, x - half, y - half);
        ctx.globalAlpha = alpha;
      }

      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = hotFill || "oklch(0.70 0.15 50)";
      const r = size * 0.22;
      roundRect(ctx, -size / 2, -size / 2, size, size, r);
      ctx.fill();
      ctx.strokeStyle = "oklch(0.92 0.10 60)";
      ctx.lineWidth = 1.5;
      roundRect(ctx, -size / 2, -size / 2, size, size, r);
      ctx.stroke();
      ctx.restore();

      ctx.font = `600 ${Math.round(size * 0.36)}px "Fragment Mono", monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "oklch(0.14 0.01 30)";
      ctx.fillText(n.label, x, y);
      ctx.restore();
      return;
    }

    if (style === "on") {
      ctx.fillStyle = "oklch(0.24 0.04 45)";
      ctx.strokeStyle = "oklch(0.73 0.170 50)";
    } else {
      ctx.fillStyle = "oklch(0.17 0.009 30)";
      ctx.strokeStyle = "oklch(0.32 0.010 30)";
    }
    const r = size * 0.22;
    roundRect(ctx, x - size/2, y - size/2, size, size, r);
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.font = `600 ${Math.round(size * 0.36)}px "Fragment Mono", monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = style === "on"  ? "oklch(0.95 0.013 75)" : "oklch(0.58 0.018 65)";
    ctx.fillText(n.label, x, y);
    ctx.restore();
  }

  function drawEdge(a, b, hot, progress) {
    const ax = a.x * W, ay = a.y * H;
    const bx = b.x * W, by = b.y * H;
    ctx.save();
    if (hot) {
      ctx.strokeStyle = "oklch(0.73 0.170 50)";
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 1.3;
      // shadowBlur removed
    } else {
      ctx.strokeStyle = "oklch(0.32 0.010 30)";
      ctx.globalAlpha = 0.4;
      ctx.lineWidth = 1;
    }
    const t = Math.max(0, Math.min(1, progress));
    const ex = ax + (bx - ax) * t, ey = ay + (by - ay) * t;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.restore();
  }

  // The blast demo settles within ~2s. After that it's a static visual
  // with only a subtle DB pulse. We render the static frame, then run
  // the pulse only while visible — and we stop entirely on low-power.
  let rafId = 0;
  let running = false;
  let visible = false;
  let pageVisible = !document.hidden;
  let introComplete = false;
  const minFrameMs = lowPower ? 33 : 0;
  let lastFrameAt = 0;

  function renderFrame(now, withPulse) {
    ctx.clearRect(0, 0, W, H);
    const t = (now - start) / 1000;
    const progress = Math.min(1, t / 0.8);
    const pulse = withPulse ? (0.5 + 0.5 * Math.sin(t * 2)) : 0.5;

    // Ring2 edges first (cool)
    for (const r2 of RING2) {
      const nearest = RING1.reduce((best, r1) => {
        const d = Math.hypot((r1.x - r2.x) * W, (r1.y - r2.y) * H);
        return d < best.d ? { d, n: r1 } : best;
      }, { d: Infinity, n: null }).n;
      if (nearest) drawEdge(r2, nearest, false, progress);
    }
    for (const r1 of RING1) drawEdge(r1, HOT, true, progress);
    for (const n of RING2) drawNode(n, 24, "off", progress);
    for (const n of RING1) drawNode(n, 30, "on", progress);
    drawNode(HOT, HOT.r + pulse * 2, "hot", progress, pulse);

    if (progress >= 1) introComplete = true;
  }

  function loop(now) {
    rafId = 0;
    if (!running) return;
    if (minFrameMs && now - lastFrameAt < minFrameMs) {
      rafId = requestAnimationFrame(loop);
      return;
    }
    lastFrameAt = now;

    renderFrame(now, !lowPower);

    // On low-power, once the intro has completed, we do not need to keep
    // animating the subtle pulse — stop the loop entirely.
    if (lowPower && introComplete) {
      running = false;
      return;
    }
    rafId = requestAnimationFrame(loop);
  }

  function startLoop() {
    if (running) return;
    if (!visible || !pageVisible) return;
    running = true;
    lastFrameAt = 0;
    rafId = requestAnimationFrame(loop);
  }
  function stopLoop() {
    running = false;
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
  }

  function init() {
    resize();
    start = performance.now();
    if (visible && pageVisible) startLoop();
  }

  window.addEventListener("resize", resize);

  if (typeof ResizeObserver !== "undefined") {
    const ro = new ResizeObserver(() => resize());
    ro.observe(canvas.parentElement || canvas);
  }

  // Visibility gating: only animate when the canvas is on screen.
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const wasVisible = visible;
      visible = e.isIntersecting;
      if (visible && !wasVisible) {
        // Re-trigger intro from this point if we haven't already played it.
        if (!introComplete) start = performance.now();
        startLoop();
      } else if (!visible) {
        stopLoop();
      }
    }
  }, { threshold: 0.25 });
  io.observe(canvas);

  document.addEventListener("visibilitychange", () => {
    pageVisible = !document.hidden;
    if (pageVisible && visible) startLoop();
    else stopLoop();
  });

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(init).catch(init);
  } else {
    init();
  }
  requestAnimationFrame(init);
})();
