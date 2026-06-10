/* ============================================================
   Svalinn — "Et døgn med Svalinn" · chapter engine

   Steps through the chapter storyboard and applies each scene.
   ============================================================ */
(function () {
  "use strict";
  // $ - getElementById shorthand
  const $ = (id) => document.getElementById(id);
  // clamp - bound v to [a, b]
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const stage = $("stage"),
    world = $("world");

  /* ---------- scaling ---------- */
  function fit() {
    const s = Math.min((innerWidth - 40) / 1600, (innerHeight - 40) / 900, 1.3);
    stage.style.transform = "scale(" + s + ")";
  }
  addEventListener("resize", fit);
  fit();

  /* ---------- chapters ----------
       clock       – narrative time label
       tx          – hour 0–24, timeline marker position
       kicker      – uppercase tag above title
       title/body  – narrative heading and paragraph
       sky         – time of day "night/dawn/day/dusk"
       highlighted – component ids that light up
       flows       – active energy flows "grid"/"solar"/"charge"
       gridHot     – grid line red
       level       – cold-store fill 0–1
       spin        – chiller fan spins
       svalinn     – dashed control links shown
       panel       – side panel "brain"/"dash"/"value" */
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
  /* ---------- state ---------- */
  let idx = 0,
    playing = false,
    timer = null;

  /* ---------- refs ----------
     flows - each energy flow paired with its glow path [line, glow] */
  const els = {
    narrativeClock: $("narrative-clock"),
    narrativeKicker: $("narrative-kicker"),
    narrativeTitle: $("narrative-title"),
    narrativeBody: $("narrative-body"),
    narrative: $("narrative"),
    brainPanel: $("brain-panel"),
    valuePanel: $("value-panel"),
    dashPanel: $("dashboard-panel"),
    chapterIndex: $("chapter-index"),
    chapterTotal: $("chapter-total"),
    fillLine: $("fill-line"),
    marker: $("track-marker"),
    dots: $("dots"),
    prev: $("previous-button"),
    next: $("next-button"),
    play: $("play-button"),
    sky: $("sky-tint"),
    stars: $("stars"),
    cel: $("celestial"),
    halo: $("halo"),
    storeFill: $("store-fill"),
    svalinnLinks: $("svalinn-links"),
    incidentBeam: document.querySelector("#solar-beams .beam-incoming"),
    specularBeam: document.querySelector("#solar-beams .beam-reflection"),
    flows: {
      grid: [$("flow-grid"), $("glow-grid")],
      solar: [$("flow-solar"), $("glow-solar")],
      charge: [$("flow-charge"), $("glow-charge")],
    },
  };
  els.chapterTotal.textContent = CH.length;

  /* ---------- stars ---------- */
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

  /* ---------- dots ---------- */
  CH.forEach((_, i) => {
    const b = document.createElement("button");
    b.addEventListener("click", () => go(i));
    els.dots.appendChild(b);
  });

  /* ---------- solar beams ---------- */
  function aimSolarBeams(sunCx, sunCy) {
    if (!els.incidentBeam) return;
    const Rx = 780,
      Ry = 514; // impact point, cmp-solar local coords
    const dx = sunCx - 90 - Rx,
      dy = sunCy - Ry;
    const len = Math.hypot(dx, dy) || 1;
    const nx = dx / len,
      ny = dy / len;
    const sx = Rx + nx * 205,
      sy = Ry + ny * 205;
    els.incidentBeam.setAttribute(
      "d",
      `M${sx.toFixed(1)},${sy.toFixed(1)} L${Rx},${Ry}`,
    );
    const lspec = 95;
    const ex = Rx - nx * lspec,
      ey = Ry + ny * lspec;
    els.specularBeam.setAttribute(
      "d",
      `M${Rx},${Ry} L${ex.toFixed(1)},${ey.toFixed(1)}`,
    );
  }

  /* ---------- sky ---------- */
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
    aimSolarBeams(+els.cel.getAttribute("cx"), +els.cel.getAttribute("cy"));
  }

  /* ---------- apply chapter ---------- */
  function apply(i) {
    const c = CH[i];

    // narrative swap
    els.narrative.classList.add("swap");
    setTimeout(() => {
      els.narrativeClock.textContent = c.clock;
      els.narrativeKicker.textContent = c.kicker;
      els.narrativeTitle.textContent = c.title;
      els.narrativeBody.textContent = c.body;
      els.narrative.classList.remove("swap");
    }, 220);

    // component highlight
    world.classList.add("focusing");
    document
      .querySelectorAll(".component")
      .forEach((e) =>
        e.classList.toggle("highlighted", c.highlighted.includes(e.id)),
      );
    world.classList.toggle("spin", !!c.spin && !c.panel);

    // energy flows
    Object.keys(els.flows).forEach((k) => {
      const on = c.flows.includes(k);
      els.flows[k].forEach((el) => el.classList.toggle("on", on));
    });
    // grid hot color
    const gridHot = !!c.gridHot;
    $("flow-grid").setAttribute("stroke", gridHot ? "#ff6b4a" : "#3aa0d8");
    $("glow-grid").setAttribute("stroke", gridHot ? "#ff6b4a" : "#3aa0d8");

    // svalinn control links
    els.svalinnLinks.setAttribute("opacity", c.svalinn ? "1" : "0");

    // cold-store fill
    const fillH = c.level * 96;
    els.storeFill.setAttribute("y", (596 - fillH).toFixed(1));
    els.storeFill.setAttribute("height", fillH.toFixed(1));

    setSky(c.sky, c.tx);

    // side panels
    els.brainPanel.classList.toggle("show", c.panel === "brain");
    els.valuePanel.classList.toggle("show", c.panel === "value");
    els.dashPanel.classList.toggle("show", c.panel === "dash");
    const hasPanel =
      c.panel === "brain" || c.panel === "value" || c.panel === "dash";
    els.narrative.classList.toggle("compact", hasPanel);
    stage.classList.toggle("focus", hasPanel);

    // timeline marker
    const pct = (c.tx / 24) * 100;
    els.fillLine.style.width = pct + "%";
    els.marker.style.left = pct + "%";

    // dots, counter, prev state
    [...els.dots.children].forEach((d, k) =>
      d.classList.toggle("active", k === i),
    );
    els.chapterIndex.textContent = i + 1;
    els.prev.disabled = i === 0;
    els.next.disabled = false;
  }

  /* ---------- navigation ---------- */
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

  // track click → nearest chapter
  document.querySelector(".track").addEventListener("click", (e) => {
    const t = e.currentTarget.getBoundingClientRect();
    const frac = clamp((e.clientX - t.left) / t.width, 0, 1),
      time = frac * 24;
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

  /* ---------- autoplay ---------- */
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

  // arrow key navigation
  addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") next();
    else if (e.key === "ArrowLeft") prev();
  });

  // init
  apply(0);
})();
