/* ============================================================
   Svalinn — "Et døgn med Svalinn" · chapter engine

   This script drives the whole "a day with Svalinn" story. It steps
   through a list of chapters (one per scene), and for each chapter it:
     - swaps the narrative text on the left,
     - dims the scene and lights up the relevant buildings,
     - turns the animated energy flows on/off,
     - moves the marker along the day timeline,
     - and shows the right side panel when needed.
   Everything is wrapped in an IIFE (the function that calls itself at
   the bottom) so none of these variables leak into the global scope.
   ============================================================ */
(function () {
  "use strict";
  // Tiny helper: look up an element by its id. Saves typing document.getElementById everywhere.
  const $ = (id) => document.getElementById(id);
  // Keep a number within a min/max range (e.g. clamp(value, 0, 1)).
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const stage = $("stage"), // the 1600×900 canvas everything lives inside
    world = $("world"); // the SVG scene (sky, buildings, flows)

  /* ---------- scaling ----------
     The scene is designed at a fixed 1600×900. fit() scales it down so it
     always fits the browser window (with a little margin), but never blows
     it up beyond 1.3×. Re-runs on every window resize. */
  function fit() {
    const s = Math.min((innerWidth - 40) / 1600, (innerHeight - 40) / 900, 1.3);
    stage.style.transform = "scale(" + s + ")";
  }
  addEventListener("resize", fit);
  fit();

  /* ---------- chapters ----------
     CH is the storyboard: each entry is one step of the story. The fields:
       clock       – the time label shown in the narrative (e.g. "KL 08:00")
       tx          – the hour (0–24); drives where the timeline marker sits
       kicker      – the small uppercase tag above the title
       title/body  – the narrative heading and paragraph
       sky         – time of day ("night/dawn/day/dusk"); sets sky colors
       highlighted – which scene components light up (the rest dim down)
       flows       – which energy flows animate ("grid"/"solar"/"charge")
       gridHot     – true = grid line turns red (power is expensive)
       level       – how full the cold store is, 0–1 (the thermal battery)
       spin        – whether the chiller fan spins
       svalinn     – whether Svalinn's dashed control links are shown
       panel       – which side panel to open ("brain"/"dash"/"value") */
  const CH = [
    {
      clock: "KL 00:00",
      tx: 0,
      kicker: "NATT",
      title: "Et anlegg som aldri sover",
      body: "Et kjøle- og frysebygg må holde temperaturen døgnet rundt. Også om natten kjøper det strøm fra nettet for å lage kulde.",
      sky: "night",
      highlighted: [
        "component-cold-store",
        "component-chiller",
        "component-grid",
      ],
      flows: ["grid"],
      level: 0.34,
      spin: true,
    },
    {
      clock: "KL 08:00",
      tx: 8,
      kicker: "MORGENRUSH",
      title: "De dyreste timene",
      body: "Om morgenen er strømmen på sitt dyreste.\nEt vanlig anlegg kjøper dyr effekt akkurat når prisen topper seg.",
      sky: "dawn",
      highlighted: ["component-grid", "component-chiller"],
      flows: ["grid"],
      gridHot: true,
      level: 0.3,
      spin: true,
    },
    {
      clock: "KL 12:00",
      tx: 12,
      kicker: "SOL",
      title: "Egen solstrøm",
      body: "Midt på dagen produserer solcellene mer enn anlegget trenger. Gratis, grønn strøm — som går tapt hvis den ikke brukes med en gang.",
      sky: "day",
      highlighted: ["component-solar", "component-chiller"],
      flows: ["solar"],
      level: 0.42,
      spin: true,
    },
    {
      clock: "KL 14:00",
      tx: 14,
      kicker: "LADING",
      title: "Bygget blir et termisk batteri",
      body: "Svalinn lar kuldemaskinen lage ekstra kulde mens strømmen er billig og solrik, og lagrer den i bygget — klar til bruk senere.",
      sky: "day",
      highlighted: [
        "component-svalinn",
        "component-solar",
        "component-chiller",
        "component-cold-store",
      ],
      flows: ["solar", "charge"],
      svalinn: true,
      level: 0.92,
      spin: true,
    },
    {
      clock: "KL 19:00",
      tx: 19,
      kicker: "KVELDSTOPP",
      title: "Bruker lagret kulde",
      body: "Når strømmen igjen blir dyr, henter Svalinn kulde fra lageret framfor å kjøpe effekt. Anlegget kjøper nesten ingenting fra nettet.",
      sky: "dusk",
      highlighted: ["component-svalinn", "component-cold-store"],
      flows: [],
      svalinn: true,
      level: 0.46,
      spin: false,
    },
    {
      clock: "HELE DØGNET",
      tx: 24,
      kicker: "HJERNEN",
      title: "Svalinn styrer kontinuerlig",
      body: "Svalinn ligger oppå dagens automasjon og tar beslutninger gjennom hele døgnet — fra datafangst til styringssignaler.",
      sky: "night",
      highlighted: [
        "component-svalinn",
        "component-cold-store",
        "component-chiller",
        "component-solar",
        "component-grid",
      ],
      flows: [],
      svalinn: true,
      level: 0.46,
      spin: true,
      panel: "brain",
    },
    {
      clock: "KUNDEPORTAL",
      tx: 24,
      kicker: "OVERSIKT & KONTROLL",
      title: "Full oversikt og kontroll",
      body: "Kunden får sin egen Svalinn-portal med sanntidsoversikt og styring av byggene — hvor som helst, når som helst.",
      sky: "night",
      highlighted: [
        "component-svalinn",
        "component-cold-store",
        "component-chiller",
        "component-solar",
        "component-grid",
      ],
      flows: [],
      svalinn: true,
      level: 0.5,
      spin: true,
      panel: "dash",
    },
    {
      clock: "RESULTATET",
      tx: 24,
      kicker: "VERDI",
      title: "Mer verdi, lavere kostnad",
      body: "Bedre utnyttelse av egen solstrøm, lavere kjøp i dyre timer og dokumentert effekt — uten å bytte ut det eksisterende anlegget.",
      sky: "night",
      highlighted: [
        "component-svalinn",
        "component-cold-store",
        "component-chiller",
        "component-solar",
        "component-grid",
      ],
      flows: [],
      svalinn: true,
      level: 0.46,
      spin: true,
      panel: "value",
    },
  ];
  // Live state: which chapter we're on, whether autoplay is running, and the autoplay timer handle.
  let idx = 0,
    playing = false,
    timer = null;

  /* ---------- refs ----------
     Look up every element we touch repeatedly, once, and keep them here.
     Cheaper and tidier than calling getElementById on every chapter change.
     `flows` groups each energy flow with its soft-blur glow path [line, glow]. */
  const els = {
    narrativeClock: $("narrativeClock"),
    narrativeKicker: $("narrativeKicker"),
    narrativeTitle: $("narrativeTitle"),
    narrativeBody: $("narrativeBody"),
    narrative: $("narrative"),
    brainPanel: $("brainPanel"),
    valuePanel: $("valuePanel"),
    dashPanel: $("dashPanel"),
    chapterIndex: $("chapterIndex"),
    chapterTotal: $("chapterTotal"),
    fillLine: $("fillLine"),
    marker: $("trackMarker"),
    dots: $("dots"),
    prev: $("prevButton"),
    next: $("nextButton"),
    play: $("playButton"),
    sky: $("skyTint"),
    stars: $("stars"),
    cel: $("celestial"), // the sun/moon disc
    halo: $("halo"), // the soft-blur glow around the sun
    storeFill: $("storeFill"), // the cold-level fill in the thermal battery
    svalinnLinks: $("svalinnLinks"), // the dashed lines from Svalinn to each component
    incidentBeam: document.querySelector("#solarBeams .incident"),
    specularBeam: document.querySelector("#solarBeams .specular"),
    flows: {
      grid: [$("flow-grid"), $("glow-grid")],
      solar: [$("flow-solar"), $("glow-solar")],
      charge: [$("flow-charge"), $("glow-charge")],
    },
  };
  // The "x / N" counter: N is just how many chapters we have.
  els.chapterTotal.textContent = CH.length;

  /* stars ----------
     Build the starfield once. Each pair below is an [x, y] position; we draw
     a small SVG circle there with a slightly random radius so the sky doesn't
     look too uniform. */
  (function () {
    const p = [
      [160, 90],
      [300, 150],
      [460, 70],
      [600, 170],
      [760, 110],
      [940, 80],
      [1120, 160],
      [1280, 90],
      [1420, 150],
      [220, 210],
      [1040, 210],
      [1360, 230],
    ];
    els.stars.innerHTML = p
      .map(
        (q) =>
          '<circle cx="' +
          q[0] +
          '" cy="' +
          q[1] +
          '" r="' +
          (Math.random() * 1.3 + 0.7).toFixed(1) +
          '" fill="#dbe8f5"/>',
      )
      .join("");
  })();

  /* dots ----------
     One little navigation dot per chapter; clicking a dot jumps to it. */
  CH.forEach((_, i) => {
    const b = document.createElement("button");
    b.addEventListener("click", () => go(i));
    els.dots.appendChild(b);
  });

  /* Aim the solar reflection at the sun: the incident beam runs from the sun's
     current position down to a fixed impact point on the panel, and the specular
     beam reflects off the (horizontal) roof at the mirror angle. Called whenever
     the sun moves, so the light lines up on every chapter (e.g. slide 3 and 4). */
  function aimSolarBeams(sunCx, sunCy) {
    if (!els.incidentBeam) return;
    const Rx = 780,
      Ry = 514; // impact point, in cmp-solar local coords
    // vector from the impact point to the sun (the group is translated +90 in x)
    const dx = sunCx - 90 - Rx,
      dy = sunCy - Ry;
    const len = Math.hypot(dx, dy) || 1;
    const nx = dx / len,
      ny = dy / len; // unit vector toward the sun
    // incident starts partway toward the sun and ends at the impact point
    const sx = Rx + nx * 205,
      sy = Ry + ny * 205;
    els.incidentBeam.setAttribute(
      "d",
      `M${sx.toFixed(1)},${sy.toFixed(1)} L${Rx},${Ry}`,
    );
    // specular reflection: mirror the incoming direction about the horizontal roof, kept short
    const lspec = 95;
    const ex = Rx - nx * lspec,
      ey = Ry + ny * lspec;
    els.specularBeam.setAttribute(
      "d",
      `M${Rx},${Ry} L${ex.toFixed(1)},${ey.toFixed(1)}`,
    );
  }

  /* Set the sky mood for the given time of day.
     - shows/hides the stars,
     - at night: parks a moon top-right and hides the sun glow,
     - otherwise: places the sun along an arc based on the hour (tx) so it
       rises and sets as the day progresses,
     - picks the sky gradient (dawn/dusk/day) and how strong the tint is. */
  function setSky(sky, tx) {
    const night = sky === "night";
    els.stars.setAttribute(
      "opacity",
      night ? "0.9" : sky === "dusk" || sky === "dawn" ? "0.35" : "0",
    );
    if (night) {
      els.cel.setAttribute("cx", 1466);
      els.cel.setAttribute("cy", 150);
      els.cel.setAttribute("r", 26);
      els.cel.setAttribute("fill", "url(#moon-gradient)");
      els.halo.setAttribute("opacity", "0");
    } else {
      // Map the hour onto a half-circle (sunrise → noon → sunset) and read
      // the sun's x/y off that arc.
      const ang = clamp((tx - 5.5) / 15.5, 0, 1) * Math.PI;
      const cx = 1100 - Math.cos(ang) * 440,
        cy = 600 - Math.sin(ang) * 440;
      els.cel.setAttribute("cx", cx);
      els.cel.setAttribute("cy", cy);
      els.cel.setAttribute("r", 32);
      els.cel.setAttribute("fill", "url(#sun-gradient)");
      els.halo.setAttribute("cx", cx);
      els.halo.setAttribute("cy", cy);
      els.halo.setAttribute("opacity", sky === "day" ? "0.55" : "0.32");
    }
    // How opaque the colored sky tint is for each time of day.
    const tintOp = { day: 0.62, dawn: 0.5, dusk: 0.5, night: 0 };
    els.sky.setAttribute(
      "fill",
      sky === "dawn"
        ? "url(#sky-dawn-gradient)"
        : sky === "dusk"
          ? "url(#sky-dusk-gradient)"
          : "url(#sky-day-gradient)",
    );
    els.sky.setAttribute("opacity", String(tintOp[sky] || 0));
    // Re-aim the reflection at the sun/moon's new position.
    aimSolarBeams(+els.cel.getAttribute("cx"), +els.cel.getAttribute("cy"));
  }

  /* The core function: take chapter i and apply it to the whole scene. */
  function apply(i) {
    const c = CH[i];

    // Narrative text: fade it out ("swap"), then after the fade swap in the
    // new chapter's words and fade it back in.
    els.narrative.classList.add("swap");
    setTimeout(() => {
      els.narrativeClock.textContent = c.clock;
      els.narrativeKicker.textContent = c.kicker;
      els.narrativeTitle.textContent = c.title;
      els.narrativeBody.textContent = c.body;
      els.narrative.classList.remove("swap");
    }, 220);

    // Dim the whole scene, then light up only the components this chapter
    // calls out (their id is in c.highlighted). The fan spins unless we're
    // showing a side panel.
    world.classList.add("focusing");
    document
      .querySelectorAll(".component")
      .forEach((e) =>
        e.classList.toggle("highlighted", c.highlighted.includes(e.id)),
      );
    world.classList.toggle("spin", !!c.spin && !c.panel);

    // Turn each energy flow (and its glow) on or off depending on whether
    // this chapter lists it in c.flows.
    Object.keys(els.flows).forEach((k) => {
      const on = c.flows.includes(k);
      els.flows[k].forEach((el) => el.classList.toggle("on", on));
    });
    // When power is expensive, recolor the grid line (and its glow) red.
    const gridHot = !!c.gridHot;
    $("flow-grid").setAttribute("stroke", gridHot ? "#ff6b4a" : "#3aa0d8");
    $("glow-grid").setAttribute("stroke", gridHot ? "#ff6b4a" : "#3aa0d8");

    // Show the dashed control links only once Svalinn is in the picture.
    els.svalinnLinks.setAttribute("opacity", c.svalinn ? "1" : "0");

    // Fill the thermal battery to this chapter's level (0–1). The fill grows
    // upward, so a taller fill means a lower starting y.
    const fillH = c.level * 96;
    els.storeFill.setAttribute("y", (596 - fillH).toFixed(1));
    els.storeFill.setAttribute("height", fillH.toFixed(1));

    // Time-of-day colors.
    setSky(c.sky, c.tx);

    // Side panels: show whichever one this chapter asks for (if any). When a
    // panel is up we switch to "focus" mode (scene fades back, content
    // centered) and make the narrative compact.
    els.brainPanel.classList.toggle("show", c.panel === "brain");
    els.valuePanel.classList.toggle("show", c.panel === "value");
    els.dashPanel.classList.toggle("show", c.panel === "dash");
    const hasPanel =
      c.panel === "brain" || c.panel === "value" || c.panel === "dash";
    els.narrative.classList.toggle("compact", hasPanel);
    stage.classList.toggle("focus", hasPanel);
    // when a panel shows, nudge narrative narrower handled by CSS max-width; keep.

    // Move the timeline marker and fill line to this chapter's hour (0–24 → 0–100%).
    const pct = (c.tx / 24) * 100;
    els.fillLine.style.width = pct + "%";
    els.marker.style.left = pct + "%";

    // Highlight the current dot, update the "x / N" counter, and enable/disable
    // the Prev button (you can't go before the first chapter).
    [...els.dots.children].forEach((d, k) =>
      d.classList.toggle("active", k === i),
    );
    els.chapterIndex.textContent = i + 1;
    els.prev.disabled = i === 0;
    els.next.disabled = false;
  }

  // Navigation helpers. go() jumps to a specific chapter (clamped to valid
  // range); next() wraps back to the start after the last chapter; prev()
  // steps one back.
  function go(i) {
    idx = clamp(i, 0, CH.length - 1);
    apply(idx);
  }
  function next() {
    go(idx >= CH.length - 1 ? 0 : idx + 1);
  }
  function prev() {
    go(idx - 1);
  }

  els.next.addEventListener("click", () => {
    next();
  });
  els.prev.addEventListener("click", prev);

  // Click anywhere on the day-track to jump to the chapter whose hour is
  // closest to where you clicked.
  document.querySelector(".track").addEventListener("click", (e) => {
    const t = e.currentTarget.getBoundingClientRect();
    // Where along the track we clicked, as a fraction (0–1), turned into an hour (0–24).
    const frac = clamp((e.clientX - t.left) / t.width, 0, 1),
      time = frac * 24;
    // Find the chapter whose tx (hour) is nearest that time.
    let best = 0,
      bd = 1e9;
    CH.forEach((c, i) => {
      const d = Math.abs(c.tx - time);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    go(best);
  });

  /* Autoplay. setPlay(true) starts a timer that advances one chapter every
     4.8s (looping at the end); setPlay(false) stops it. Either way it swaps
     the play/pause icon to match. */
  function setPlay(on) {
    playing = on;
    els.play.innerHTML =
      '<svg viewBox="0 0 24 24"><use href="#' +
      (on ? "icon-pause" : "icon-play") +
      '"/></svg>';
    clearInterval(timer);
    if (on)
      timer = setInterval(() => {
        go(idx >= CH.length - 1 ? 0 : idx + 1);
      }, 4800);
  }
  els.play.addEventListener("click", () => setPlay(!playing));

  // Left/right arrow keys also navigate.
  addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") next();
    else if (e.key === "ArrowLeft") prev();
  });

  // Kick things off by showing the first chapter.
  apply(0);
})();
