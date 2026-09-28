/* ============================================================
   SIM ENGINE — hands-on PC build / disassemble simulation
   Requires THREE r128 (global THREE) to be loaded first.

   SimEngine.init(containerEl, scenario, options)

   scenario: {
     title: 'Build a Basic PC',
     subtitle: 'Assemble mode',
     mode: 'assemble' | 'disassemble',
     parts: [{ id:'cpu-1', type:'cpu', label:'CPU' }, ...],
     slots: [{ id:'cpu-socket', accepts:'cpu', label:'CPU Socket', position:[0,0.08,-0.6] }, ...],
     order: ['cpu-1','cooler-1','ram-1','ram-2','gpu-1','storage-1','psu-1'], // optional, used by hint() and disassemble enforcement
   }

   options: {
     enforceOrder: undefined, // disassemble mode: defaults to true (blocks out-of-order removal);
                               // pass false explicitly to allow removing parts in any order
     onComplete: () => {}
   }

   Part types with built-in low-poly models: cpu, ram, gpu, psu, storage,
   cooler, case_panel, motherboard, cpu_power, psu_24pin, sata_cable,
   power_sw, reset_sw, power_led, hdd_led, front_audio, front_usb
   (cpu_power / psu_24pin are small PSU-to-motherboard power connectors;
   power_sw / reset_sw / power_led / hdd_led / front_audio / front_usb
   are the front-panel case connectors that plug into the motherboard's
   F_PANEL, AAFP, and USB headers)
   ============================================================ */

(function (global) {
  const NEON = { cyan: 0x55F1F8, pink: 0x3096C7, yellow: 0xF1F2F5, dark: 0x0a0a1a, darker: 0x050510 };

  const HIT_PROXY_RADIUS = {
    cpu_power: 0.22, psu_24pin: 0.24, sata_cable: 0.2,
    cpu: 0.28, ram: 0.24, cooler: 0.32, gpu: 0.4,
    storage: 0.32, psu: 0.4, motherboard: 0.5, case_panel: 0.5,
  };

  function edged(mesh, colorHex) {
    mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), new THREE.LineBasicMaterial({ color: colorHex })));
    return mesh;
  }
  function strip(w, h, d, colorHex) {
    return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color: colorHex }));
  }

  /* ---------------- PROCEDURAL PART BUILDERS ---------------- */
  const PART_BUILDERS = {
    cpu() {
      const g = new THREE.Group();
      const body = edged(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.08, 0.62), new THREE.MeshBasicMaterial({ color: NEON.darker })), NEON.cyan);
      g.add(body);
      const ihs = strip(0.42, 0.03, 0.42, 0x2a2a35);
      ihs.position.y = 0.055;
      g.add(ihs);
      const corner = strip(0.06, 0.02, 0.06, NEON.cyan);
      corner.position.set(-0.26, 0.075, -0.26);
      g.add(corner);
      return g;
    },
    ram() {
      const g = new THREE.Group();
      const body = edged(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.85), new THREE.MeshBasicMaterial({ color: NEON.darker })), NEON.cyan);
      g.add(body);
      for (let i = -1; i <= 1; i++) {
        const s = strip(0.17, 0.052, 0.09, NEON.pink);
        s.position.z = i * 0.24;
        g.add(s);
      }
      return g;
    },
    gpu() {
      const g = new THREE.Group();
      // card stands upright: length along x, height along y (up), thin along z (edge into the slot)
      const body = edged(new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.85, 0.32), new THREE.MeshBasicMaterial({ color: NEON.darker })), NEON.pink);
      g.add(body);
      [-0.55, 0.55].forEach(x => {
        const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.06, 16), new THREE.MeshBasicMaterial({ color: 0x111118 }));
        fan.rotation.x = Math.PI / 2; // face outward along Z instead of upward along Y
        fan.position.set(x, 0, 0.19);
        g.add(fan);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.015, 8, 24), new THREE.MeshBasicMaterial({ color: NEON.cyan }));
        // torus already faces Z by default now that the card stands upright — no extra rotation needed
        ring.position.set(x, 0, 0.19);
        g.add(ring);
      });
      const accent = strip(2.0, 0.02, 0.03, NEON.cyan);
      accent.position.set(0, 0.40, 0.17);
      g.add(accent);
      return g;
    },
    psu() {
      // ATX-style proportions: flat height, squarish footprint so it reads as
      // lying flush against the case wall from this top-down camera angle
      // (a long Z-depth would foreshorten into looking "tall" on screen).
      const g = new THREE.Group();
      const body = edged(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.9), new THREE.MeshBasicMaterial({ color: NEON.darker })), NEON.yellow);
      g.add(body);
      const grill = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.02, 8, 20), new THREE.MeshBasicMaterial({ color: NEON.yellow }));
      grill.rotation.x = Math.PI / 2;
      grill.position.set(0, -0.26, 0);
      g.add(grill);
      return g;
    },
    storage() {
      const g = new THREE.Group();
      const body = edged(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.05, 0.9), new THREE.MeshBasicMaterial({ color: NEON.darker })), NEON.cyan);
      g.add(body);
      const label = strip(0.4, 0.01, 0.3, 0x1c2440);
      label.position.y = 0.03;
      g.add(label);
      return g;
    },
    cooler() {
      const g = new THREE.Group();
      for (let i = 0; i < 6; i++) {
        const fin = strip(0.015, 0.5, 0.5, 0x2a2a35);
        fin.position.x = -0.15 + i * 0.06;
        edged(fin, NEON.pink);
        g.add(fin);
      }
      const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.08, 16), new THREE.MeshBasicMaterial({ color: 0x111118 }));
      fan.rotation.x = Math.PI / 2; // face the fan through the fin stack (Z), matching the ring below
      fan.position.set(0, 0, 0.32);
      g.add(fan);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.015, 8, 24), new THREE.MeshBasicMaterial({ color: NEON.cyan }));
      ring.position.set(0, 0, 0.32);
      g.add(ring);
      return g;
    },
    case_panel() {
      // The case is lying flat on the table (back of the board facing down), so the
      // side cover is really the TOP lid, viewed from above — a flat plate sized to
      // the case footprint, not an upright wall standing in front of it.
      const g = new THREE.Group();
      const body = edged(new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.05, 4.3), new THREE.MeshBasicMaterial({ color: NEON.dark, transparent: true, opacity: 0.5 })), NEON.cyan);
      g.add(body);
      // corner screws, purely decorative, so it still reads as a panel and not a slab
      [[-1.95, -1.95], [1.95, -1.95], [-1.95, 1.95], [1.95, 1.95]].forEach(([x, z]) => {
        const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.06, 10), new THREE.MeshBasicMaterial({ color: NEON.cyan }));
        screw.position.set(x, 0.03, z);
        g.add(screw);
      });
      return g;
    },
    motherboard() {
      // Represents a *finished* board (CPU + cooler + RAM + GPU already mounted) —
      // this is the part the player carries from the "build the board" stage into
      // the "mount it in the case" stage, so it reads as populated, not blank.
      // Portrait footprint: narrower left-right (x), longer front-back (z).
      const g = new THREE.Group();
      const body = edged(new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.04, 2.6), new THREE.MeshBasicMaterial({ color: 0x0d1a12 })), NEON.pink);
      g.add(body);

      // mini CPU + cooler stack
      const cpu = strip(0.5, 0.05, 0.5, NEON.darker);
      cpu.position.set(-0.3, 0.045, -0.65);
      g.add(cpu);
      for (let i = 0; i < 5; i++) {
        const fin = strip(0.012, 0.32, 0.32, 0x2a2a35);
        fin.position.set(-0.4 + i * 0.05, 0.24, -0.65);
        g.add(fin);
      }

      // mini RAM sticks
      [0.25, 0.5].forEach(x => {
        const ram = strip(0.1, 0.28, 0.62, NEON.cyan);
        ram.position.set(x, 0.17, -0.65);
        g.add(ram);
      });

      // mini GPU card
      const gpu = strip(0.8, 0.32, 0.16, NEON.pink);
      gpu.position.set(-0.25, 0.2, 0.15);
      g.add(gpu);

      // rear I/O block — tall strip along the left edge, matches the bare-board layout
      const rearIO = strip(0.05, 0.22, 1.8, 0x8a8a8a);
      rearIO.position.set(-1.15, 0.13, -0.1);
      g.add(rearIO);

      return g;
    },
    cpu_power() {
      // small 4/8-pin PSU-to-motherboard power plug
      const g = new THREE.Group();
      const body = edged(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.22), new THREE.MeshBasicMaterial({ color: NEON.darker })), NEON.yellow);
      g.add(body);
      const clip = strip(0.05, 0.16, 0.04, NEON.yellow);
      clip.position.set(0, 0, 0.13);
      g.add(clip);
      return g;
    },
    psu_24pin() {
      // wider main-power PSU-to-motherboard connector
      const g = new THREE.Group();
      const body = edged(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.42), new THREE.MeshBasicMaterial({ color: NEON.darker })), NEON.yellow);
      g.add(body);
      const clip = strip(0.06, 0.18, 0.05, NEON.yellow);
      clip.position.set(0, 0, 0.23);
      g.add(clip);
      return g;
    },
    sata_cable() {
      // flat L-shaped SATA data cable connector, storage drive to motherboard SATA port
      const g = new THREE.Group();
      const body = edged(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.3), new THREE.MeshBasicMaterial({ color: NEON.darker })), NEON.cyan);
      g.add(body);
      const clip = strip(0.05, 0.05, 0.06, NEON.cyan);
      clip.position.set(0, 0, 0.17);
      g.add(clip);
      return g;
    },
    /* ---- front-panel case connectors (F_PANEL 2-pin plugs + AAFP / USB header cables) ---- */
    power_sw() {
      const g = new THREE.Group();
      const body = edged(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.1), new THREE.MeshBasicMaterial({ color: NEON.darker })), 0xffffff);
      body.position.y = 0.02;
      g.add(body);
      [[-0.065, 0x222222], [0.065, 0xffffff]].forEach(([x, col]) => {
        const wire = strip(0.02, 0.02, 0.14, col);
        wire.position.set(x, -0.02, 0.1);
        wire.rotation.x = 0.55; // lays the wire back and down, away from the header
        g.add(wire);
      });
      return g;
    },
    reset_sw() {
      const g = new THREE.Group();
      const body = edged(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.1), new THREE.MeshBasicMaterial({ color: NEON.darker })), NEON.cyan);
      body.position.y = 0.02;
      g.add(body);
      [[-0.065, 0x0c4a4d], [0.065, NEON.cyan]].forEach(([x, col]) => {
        const wire = strip(0.02, 0.02, 0.14, col);
        wire.position.set(x, -0.02, 0.1);
        wire.rotation.x = 0.55;
        g.add(wire);
      });
      return g;
    },
    power_led() {
      const g = new THREE.Group();
      const body = edged(new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.11, 0.09), new THREE.MeshBasicMaterial({ color: NEON.darker })), 0x39ff6a);
      body.position.y = 0.015;
      g.add(body);
      [[-0.065, 0x1a5c2e], [0.065, 0x39ff6a]].forEach(([x, col]) => {
        const wire = strip(0.017, 0.017, 0.13, col);
        wire.position.set(x, -0.02, 0.09);
        wire.rotation.x = 0.55;
        g.add(wire);
      });
      return g;
    },
    hdd_led() {
      const g = new THREE.Group();
      const body = edged(new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.11, 0.09), new THREE.MeshBasicMaterial({ color: NEON.darker })), 0xff4d4d);
      body.position.y = 0.015;
      g.add(body);
      [[-0.065, 0x5c1a1a], [0.065, 0xff4d4d]].forEach(([x, col]) => {
        const wire = strip(0.017, 0.017, 0.13, col);
        wire.position.set(x, -0.02, 0.09);
        wire.rotation.x = 0.55;
        g.add(wire);
      });
      return g;
    },
    front_audio() {
      const g = new THREE.Group();
      const body = edged(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.14), new THREE.MeshBasicMaterial({ color: NEON.darker })), NEON.cyan);
      g.add(body);
      for (let i = -2; i <= 2; i++) {
        const pin = strip(0.025, 0.025, 0.025, NEON.cyan);
        pin.position.set(i * 0.075, 0.045, 0);
        g.add(pin);
      }
      return g;
    },
    front_usb() {
      const g = new THREE.Group();
      const body = edged(new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.07, 0.2), new THREE.MeshBasicMaterial({ color: NEON.darker })), NEON.pink);
      g.add(body);
      for (let i = -2; i <= 2; i++) {
        const pin = strip(0.032, 0.032, 0.032, NEON.pink);
        pin.position.set(i * 0.1, 0.05, 0);
        g.add(pin);
      }
      return g;
    },
  };

  function buildBaseTray() {
    const g = new THREE.Group();

    // PCB base — portrait: narrower left-right (x), longer front-back (z), matching the diagram
    const pcb = edged(new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.08, 3.4), new THREE.MeshBasicMaterial({ color: 0x0d2b1a })), NEON.pink);
    pcb.position.y = -0.04;
    g.add(pcb);
    const grid = new THREE.GridHelper(3.2, 12, NEON.pink, 0x143322);
    grid.position.y = 0.002;
    g.add(grid);

    // CPU socket outline (matches cpu-socket slot) — upper-left of the board, mirroring the diagram
    const socket = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.36, 4, 1), new THREE.MeshBasicMaterial({ color: NEON.cyan, side: THREE.DoubleSide, transparent: true, opacity: 0.7 }));
    socket.rotation.x = -Math.PI / 2;
    socket.rotation.z = Math.PI / 4;
    socket.position.set(-0.3, 0.005, -0.65);
    g.add(socket);

    // Scattered capacitors near the socket, for texture
    [[-0.55, -0.95], [-0.55, -0.75], [-0.05, -0.65], [-0.05, -0.95]].forEach(([x, z]) => {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.09, 10), new THREE.MeshBasicMaterial({ color: 0x111820 }));
      cap.position.set(x, 0.045, z);
      g.add(cap);
    });

    // CPU power header outline — small square right above the CPU, hugging the back panel
    const cpuPowerOutline = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(0.14, 0.03, 0.14)),
      new THREE.LineBasicMaterial({ color: NEON.yellow, transparent: true, opacity: 0.55 })
    );
    cpuPowerOutline.position.set(-0.55, 0.02, -1.05);
    g.add(cpuPowerOutline);

    // DIMM slot connectors (matches ram-a1 / ram-a2 slots) — same row as the CPU, to its right
    [[0.25, -0.65], [0.5, -0.65]].forEach(([x, z]) => {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.85), new THREE.MeshBasicMaterial({ color: 0x1a1a2a }));
      bar.position.set(x, 0.02, z);
      g.add(bar);
    });

    // PCIe slot connector (matches pcie-slot) — below the CPU, running horizontally
    const pcieBar = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.05, 0.14), new THREE.MeshBasicMaterial({ color: 0x1a1a2a }));
    pcieBar.position.set(-0.25, 0.025, 0.15);
    g.add(pcieBar);

    // SATA slots — small outline at the bottom-right corner of the board
    const sataOutline = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(0.42, 0.03, 0.16)),
      new THREE.LineBasicMaterial({ color: NEON.cyan, transparent: true, opacity: 0.5 })
    );
    sataOutline.position.set(0.5, 0.02, 1.0);
    g.add(sataOutline);

    // Rear I/O / back panel — tall strip running almost the full depth of the board's left edge
    const rearIO = edged(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 2.0), new THREE.MeshBasicMaterial({ color: 0x8a8a8a })), NEON.cyan);
    rearIO.position.set(-1.15, 0.15, -0.1);
    g.add(rearIO);

    // 24-pin connector notch — cosmetic only here (the actual plug happens once it's in the case),
    // marks where it seats on the right edge of the board
    const pinNotch = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(0.1, 0.16, 0.5)),
      new THREE.LineBasicMaterial({ color: NEON.yellow, transparent: true, opacity: 0.45 })
    );
    pinNotch.position.set(1.15, 0.08, 0.1);
    g.add(pinNotch);

    return g;
  }

  function buildCaseTray() {
    const g = new THREE.Group();

    // Case floor — sized to comfortably hold the taller portrait board plus the PSU and storage bays
    const floor = edged(new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.06, 4.6), new THREE.MeshBasicMaterial({ color: 0x111116 })), NEON.cyan);
    floor.position.y = -0.05;
    g.add(floor);
    const grid = new THREE.GridHelper(4.4, 16, NEON.pink, 0x1a1a26);
    grid.position.y = -0.015;
    g.add(grid);

    // Outer case shell (open-top box, walls only) so the bays read as "inside a case"
    const wallMat = new THREE.MeshBasicMaterial({ color: NEON.dark, transparent: true, opacity: 0.35 });
    const backWall = edged(new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.4, 0.05), wallMat.clone()), NEON.cyan);
    backWall.position.set(0, 0.65, -2.28);
    g.add(backWall);
    const leftWall = edged(new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.4, 4.6), wallMat.clone()), NEON.cyan);
    leftWall.position.set(-2.28, 0.65, 0);
    g.add(leftWall);
    const rightWall = edged(new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.4, 4.6), wallMat.clone()), NEON.cyan);
    rightWall.position.set(2.28, 0.65, 0);
    g.add(rightWall);

    // Rear I/O cutout, aligned with the board's own back-panel edge once it's mounted
    const rearIO = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3, 0.6), new THREE.MeshBasicMaterial({ color: 0x8a8a8a }));
    rearIO.position.set(-2.27, 0.15, -0.7);
    g.add(rearIO);

    // Ghost outline where the finished motherboard mounts (matches the 'mobo-bay' slot,
    // sized to the motherboard part's own portrait footprint) — upper-left of the case, so it's
    // obvious where it goes and the PSU/storage bays sit outside its footprint, per the diagram.
    const moboOutline = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.9, 0.03, 2.6)),
      new THREE.LineBasicMaterial({ color: NEON.pink, transparent: true, opacity: 0.45 })
    );
    moboOutline.position.set(-1.05, 0.03, -0.6);
    g.add(moboOutline);
    // standoff screw points under the outline, purely decorative
    [[-1.85, -1.75], [-0.25, -1.75], [-1.85, 0.55], [-0.25, 0.55]].forEach(([x, z]) => {
      const standoff = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.04, 8), new THREE.MeshBasicMaterial({ color: 0x555560 }));
      standoff.position.set(x, 0.02, z);
      g.add(standoff);
    });

    // PSU bay outline — directly below the mounted board, matches 'psu-bay' slot
    const psuOutline = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(0.95, 0.5, 0.95)),
      new THREE.LineBasicMaterial({ color: NEON.yellow, transparent: true, opacity: 0.4 })
    );
    psuOutline.position.set(-1.83, 0.25, 1.75);
    g.add(psuOutline);

    // Storage bay outline — to the right of the board, outside its footprint, matches 'storage-bay' slot
    const storageOutline = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(0.7, 0.5, 1.4)),
      new THREE.LineBasicMaterial({ color: NEON.cyan, transparent: true, opacity: 0.4 })
    );
    storageOutline.position.set(1.0, 0.15, 0.3);
    g.add(storageOutline);

    return g;
  }

  function buildFrontPanelTray() {
    // Reuse the case shell (floor, walls, bay outlines) so this scene reads
    // as "the same case from the Week 2 build" rather than a brand new room.
    const g = buildCaseTray();

    // Static, already-mounted motherboard — the same finished-board model
    // used once CPU/cooler/RAM/GPU are built and the board is placed in the
    // case (Week 2, stage 2). It's decorative here, not draggable; the
    // player only wires the front-panel headers on top of it.
    const board = PART_BUILDERS.motherboard();
    board.position.set(-1.05, 0.08, -0.6); // same spot as the w2 'mobo-bay' slot
    g.add(board);

    // ---- F_PANEL header: 2 rows x 5 columns, standard ATX layout ----
    // Col pair 1-2 = Power LED (row 1) / HDD LED (row 2)
    // Col pair 3-4 = Power Button (row 1) / Reset Button (row 2)
    // Col 5        = Empty pin, physically missing/keyed (row 1) / Unused pin (row 2)
    const fpX = -1.85, fpZ = 0.5, colGap = 0.13, rowGap = 0.13;
    for (let col = 0; col < 5; col++) {
      for (let row = 0; row < 2; row++) {
        if (col === 4 && row === 0) continue; // keyed/missing pin — nothing drawn
        const isUnused = col === 4 && row === 1;
        const pin = new THREE.Mesh(
          new THREE.CylinderGeometry(0.026, 0.026, 0.09, 8),
          new THREE.MeshBasicMaterial({ color: isUnused ? 0x444455 : NEON.yellow })
        );
        pin.position.set(fpX + col * colGap, 0.12, fpZ + row * rowGap);
        g.add(pin);
      }
    }
    const fpOutline = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(colGap * 4 + 0.1, 0.02, rowGap + 0.1)),
      new THREE.LineBasicMaterial({ color: NEON.yellow, transparent: true, opacity: 0.55 })
    );
    fpOutline.position.set(fpX + colGap * 2, 0.09, fpZ + rowGap / 2);
    g.add(fpOutline);

    // ---- AAFP (front audio) header ----
    const aafpOutline = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(0.42, 0.02, 0.16)),
      new THREE.LineBasicMaterial({ color: NEON.cyan, transparent: true, opacity: 0.5 })
    );
    aafpOutline.position.set(-1.0, 0.09, 0.6);
    g.add(aafpOutline);

    // ---- Front USB 3.0 header ----
    const usbOutline = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(0.6, 0.02, 0.28)),
      new THREE.LineBasicMaterial({ color: NEON.pink, transparent: true, opacity: 0.5 })
    );
    usbOutline.position.set(-0.4, 0.09, 0.63);
    g.add(usbOutline);

    return g;
  }

  const TRAY_BUILDERS = { motherboard: buildBaseTray, case: buildCaseTray, frontpanel: buildFrontPanelTray };

  function buildSlotMarker(colorHex, radius) {
    const r = radius || 0.32;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, Math.max(0.008, r * 0.04), 8, 32), new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.35 }));
    ring.rotation.x = Math.PI / 2;
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.12, r * 1.12, 0.1, 16), new THREE.MeshBasicMaterial({ visible: false }));
    const g = new THREE.Group();
    g.add(ring); g.add(hit);
    g.userData.ring = ring; g.userData.hit = hit;
    return g;
  }

  function sparkleBurst(scene, position, colorHex) {
    const COUNT = 40;
    const pos = new Float32Array(COUNT * 3);
    const vel = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      pos[i*3] = 0; pos[i*3+1] = 0; pos[i*3+2] = 0;
      const ang = Math.random() * Math.PI * 2;
      const spd = 0.6 + Math.random() * 1.6;
      vel[i*3] = Math.cos(ang) * spd;
      vel[i*3+1] = 0.4 + Math.random() * 1.4;
      vel[i*3+2] = Math.sin(ang) * spd;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: colorHex, size: 0.05, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    const points = new THREE.Points(geo, mat);
    points.position.copy(position);
    scene.add(points);
    return { points, vel, age: 0, life: 0.7 };
  }

  /* ---------------- ENGINE ---------------- */
  class SimEngine {
    constructor(container, scenario, options) {
      this.container = container;
      this.scenario = scenario;
      this.options = options || {};
      // Disassembly is a strict, physical process — you can't pull the PSU while its
      // power cables are still plugged in, or the board while the drive's still wired up.
      // Default to enforcing the given order unless the caller explicitly opts out.
      if (this.options.enforceOrder === undefined) {
        this.options.enforceOrder = scenario.mode === 'disassemble';
      }
      this.selectedPartId = null;
      this.placed = new Set();   // assemble: part ids placed | disassemble: part ids removed
      this.slotAssignment = {};  // assemble mode: slot id -> id of the part actually placed there
      this.tweens = [];
      this.bursts = [];
      this.partMeshes = {};      // id -> THREE.Object3D
      this.slotMeshes = {};      // slot id -> marker group
      this.mistakes = 0;
      this.startTime = performance.now();
      // Multi-stage scenarios (e.g. "build the board" then "mount it in the case")
      // are declared via scenario.stages: [{ id, title, subtitle, tray, parts, slots, order, camera }, ...].
      // Scenarios without .stages behave exactly as before (single implicit stage).
      this.stages = Array.isArray(scenario.stages) && scenario.stages.length ? scenario.stages : null;
      this.stageIndex = 0;
      this._buildDom();
      this._initThree();
      this._applyStageCamera();
      this._buildScene();
      this._bindEvents();
      this._renderTray();
      this._renderProgress();
      this._animate();
      new ResizeObserver(() => this._onResize()).observe(this.container);
    }

    /* ---- Stage-aware accessors ----
       With scenario.stages, everything (parts/slots/order/tray/title) is scoped
       to the current stage. Without it, these fall back to the flat scenario
       fields exactly as the engine behaved pre-stages. */
    _activeStage() { return this.stages ? this.stages[this.stageIndex] : null; }
    _parts() { const s = this._activeStage(); return (s ? s.parts : this.scenario.parts) || []; }
    _slots() { const s = this._activeStage(); return (s ? s.slots : this.scenario.slots) || []; }
    _order() { const s = this._activeStage(); const list = s ? s.order : this.scenario.order; return list || this._parts().map(p => p.id); }
    _tray() { const s = this._activeStage(); return (s && s.tray) || this.scenario.tray || 'motherboard'; }
    _title() { const s = this._activeStage(); return (s && s.title) || this.scenario.title; }
    _subtitle() {
      const s = this._activeStage();
      const base = (s && s.subtitle) || this.scenario.subtitle || '';
      return this.stages ? `Stage ${this.stageIndex + 1}/${this.stages.length} \u00B7 ${base}` : base;
    }
    _applyStageCamera() {
      const s = this._activeStage();
      const cam = (s && s.camera) || this.scenario.camera;
      this.orbit = {
        radius: (cam && cam.radius) || 5.4,
        theta: (cam && cam.theta) != null ? cam.theta : 0.6,
        phi: (cam && cam.phi) != null ? cam.phi : 1.05,
        target: new THREE.Vector3(...((cam && cam.target) || [-0.15, 0.1, 0.05])),
      };
      if (this.camera) this._updateCamera();
    }

    /* ---- DOM ---- */
    _buildDom() {
      this.container.classList.add('sim-shell');
      this.container.innerHTML = `
        <canvas class="sim-canvas"></canvas>
        <div class="sim-hud-top">
          <div class="sim-title">${this._title() || 'SIMULATION'}<span class="subtitle">${this._subtitle() || ''}</span></div>
          <div style="display:flex;gap:.5rem;">
            <button class="sim-icon-btn btn-neon" id="sim-checklist-btn" title="Checklist">&#9776;</button>
            <button class="sim-icon-btn btn-neon" id="sim-hint-btn" title="Hint">&#128161;</button>
            <button class="sim-icon-btn btn-neon" id="sim-reset-btn" title="Reset">&#8635;</button>
          </div>
        </div>
        <div class="sim-progress-panel" id="sim-progress-panel"><h3>Checklist</h3><div id="sim-steps"></div></div>
        <div class="sim-instructions" id="sim-instructions"></div>
        <div class="sim-toast" id="sim-toast"></div>
        <div class="sim-tray" id="sim-tray"></div>
      `;
      this.canvas = this.container.querySelector('.sim-canvas');
      this.container.querySelector('#sim-hint-btn').addEventListener('click', () => this.hint());
      this.container.querySelector('#sim-reset-btn').addEventListener('click', () => this.reset());
      this.container.querySelector('#sim-checklist-btn').addEventListener('click', () => this._toggleChecklist());
      // Start collapsed on narrow screens so the panel doesn't cover most of the model
      this._checklistCollapsed = this.container.getBoundingClientRect().width < 480;
      this._applyChecklistState();
      this._setInstructions(this.scenario.mode === 'disassemble'
        ? 'Click a placed part on the model to remove it.'
        : 'Tap a part below, then tap its glowing slot on the model.');
    }

    _toggleChecklist() {
      this._checklistCollapsed = !this._checklistCollapsed;
      this._applyChecklistState();
    }

    _applyChecklistState() {
      const panel = this.container.querySelector('#sim-progress-panel');
      if (panel) panel.classList.toggle('is-collapsed', this._checklistCollapsed);
    }

    _setInstructions(text) { this.container.querySelector('#sim-instructions').textContent = text; }

    /* ---- THREE setup ---- */
    _initThree() {
      this.scene = new THREE.Scene();
      const rect = this.container.getBoundingClientRect();
      this.camera = new THREE.PerspectiveCamera(45, rect.width / Math.max(1, rect.height), 0.1, 100);
      this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.renderer.setSize(rect.width, rect.height);
      this.renderer.setClearColor(0x000000, 0);

      // Manual orbit camera (spherical, no external controls dependency)
      this.orbit = { radius: 5.4, theta: 0.6, phi: 1.05, target: new THREE.Vector3(-0.15, 0.1, 0.05) };
      this._updateCamera();
    }

    _updateCamera() {
      const { radius, theta, phi, target } = this.orbit;
      this.camera.position.set(
        target.x + radius * Math.sin(phi) * Math.sin(theta),
        target.y + radius * Math.cos(phi),
        target.z + radius * Math.sin(phi) * Math.cos(theta)
      );
      this.camera.lookAt(target);
    }

    _bindEvents() {
      let dragging = false, lastX = 0, lastY = 0;
      const onDown = (e) => { dragging = true; const p = point(e); lastX = p.x; lastY = p.y; };
      const onMove = (e) => {
        if (!dragging) return;
        const p = point(e);
        const dx = p.x - lastX, dy = p.y - lastY;
        lastX = p.x; lastY = p.y;
        this.orbit.theta -= dx * 0.006;
        this.orbit.phi = AghiLib.clamp(this.orbit.phi - dy * 0.006, 0.35, 1.5);
        this._updateCamera();
      };
      const point = (e) => e.touches ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY };

      this.canvas.addEventListener('pointerdown', (e) => { onDown(e); this._downPos = point(e); });
      this.canvas.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', (e) => {
        const p = point(e);
        const moved = this._downPos && (Math.abs(p.x - this._downPos.x) > 5 || Math.abs(p.y - this._downPos.y) > 5);
        dragging = false;
        if (!moved) this._handleClick(e);
      });
      this.canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        this.orbit.radius = AghiLib.clamp(this.orbit.radius + e.deltaY * 0.0025, 2.2, 8);
        this._updateCamera();
      }, { passive: false });
    }

    _handleClick(e) {
      const rect = this.canvas.getBoundingClientRect();
      const x = (e.clientX ?? (e.changedTouches && e.changedTouches[0].clientX));
      const y = (e.clientY ?? (e.changedTouches && e.changedTouches[0].clientY));
      if (x === undefined) return;
      const ndc = new THREE.Vector2(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(ndc, this.camera);

      if (this.scenario.mode === 'disassemble') {
        // Try the parts that can actually be removed right now first — this keeps
        // clicks reliable regardless of camera angle, since locked parts (which may
        // have much larger hit spheres, e.g. the motherboard) never get to compete
        // for the ray until it's actually their turn.
        const removableIds = this._removableIds();
        const removableTargets = removableIds.map(id => this.partMeshes[id]).filter(Boolean);
        let hit = raycaster.intersectObjects(removableTargets, true)[0];
        let idPool = removableIds;
        if (!hit) {
          const allTargets = Object.values(this.partMeshes).filter(m => m.visible);
          hit = raycaster.intersectObjects(allTargets, true)[0];
          idPool = Object.keys(this.partMeshes);
        }
        if (hit) {
          let obj = hit.object;
          let id = null;
          while (obj && !id) {
            id = idPool.find(k => this.partMeshes[k] === obj) || null;
            obj = obj.parent;
          }
          if (id) this.removePart(id);
        }
        return;
      }

      const markers = Object.values(this.slotMeshes).map(g => g.userData.hit);
      const hit = raycaster.intersectObjects(markers, false)[0];
      if (hit) {
        const slotId = Object.keys(this.slotMeshes).find(k => this.slotMeshes[k].userData.hit === hit.object);
        if (slotId) this.attemptPlace(slotId);
      }
    }

    /* ---- Scene build ---- */
    _buildScene() {
      if (this.trayGroup) { this.scene.remove(this.trayGroup); this.trayGroup = null; }
      const trayBuilder = TRAY_BUILDERS[this._tray()] || buildBaseTray;
      this.trayGroup = trayBuilder();
      this.scene.add(this.trayGroup);

      const defaultMarkerRadius = this._tray() === 'frontpanel' ? 0.065 : 0.32;
      (this._slots() || []).forEach(slot => {
        const marker = buildSlotMarker(NEON.cyan, slot.markerRadius || defaultMarkerRadius);
        marker.position.set(...slot.position);
        this.scene.add(marker);
        this.slotMeshes[slot.id] = marker;
      });

      const usedSlotIds = new Set();
      (this._parts() || []).forEach(part => {
        const builder = PART_BUILDERS[part.type];
        if (!builder) return;
        const mesh = builder();
        mesh.visible = this.scenario.mode === 'disassemble'; // disassemble starts fully built
        this.scene.add(mesh);
        this.partMeshes[part.id] = mesh;

        if (this.scenario.mode === 'disassemble') {
          // Prefer an explicit part.slot binding (required when multiple parts share a
          // type, e.g. two RAM sticks) — otherwise fall back to the first matching,
          // not-yet-claimed slot so same-type parts never collide on one position.
          let slot = part.slot ? (this._slots() || []).find(s => s.id === part.slot) : null;
          if (!slot) slot = (this._slots() || []).find(s => s.accepts === part.type && !usedSlotIds.has(s.id));
          if (slot) {
            usedSlotIds.add(slot.id);
            mesh.position.set(...slot.position);
            if (slot.rotation) mesh.quaternion.setFromEuler(new THREE.Euler(...slot.rotation));
          }
          this._addHitProxy(part, mesh);
        } else {
          mesh.position.set(0, -1.4, 1.6); // parked below tray, off-screen-ish, until placed
        }
      });
    }

    /* A larger invisible sphere around each disassemble-mode part so small
       connectors (SATA cable, 24-pin, CPU power plug) are easy to click
       precisely instead of relying on their tiny literal geometry — this
       also prevents clicks near one small part from accidentally
       resolving to a different, further-away part. */
    _addHitProxy(part, mesh) {
      const radius = HIT_PROXY_RADIUS[part.type] || 0.26;
      const proxy = new THREE.Mesh(new THREE.SphereGeometry(radius, 10, 8), new THREE.MeshBasicMaterial({ visible: false }));
      mesh.add(proxy);
      mesh.userData.hitProxy = proxy;
    }

    /* ---- Tray / progress UI ---- */
    _renderTray() {
      const tray = this.container.querySelector('#sim-tray');
      tray.innerHTML = '';
      (this._parts() || []).forEach(part => {
        const isDone = this.placed.has(part.id);
        const card = document.createElement('div');
        card.className = 'sim-part-card btn-neon' + (this.selectedPartId === part.id ? ' is-selected' : '') + (isDone ? ' is-placed' : '');
        card.innerHTML = `<div class="swatch neon-border-subject" style="border-width:1px;border-style:solid;">${(part.label||part.type).slice(0,2).toUpperCase()}</div><div class="name">${part.label || part.type}</div>`;
        if (this.scenario.mode !== 'disassemble' && !isDone) {
          card.addEventListener('click', () => this.selectPart(part.id));
        }
        tray.appendChild(card);
      });
    }

    _renderProgress() {
      const stepsEl = this.container.querySelector('#sim-steps');
      const order = this._order() || (this._parts() || []).map(p => p.id);
      const removableSet = this.scenario.mode === 'disassemble' ? new Set(this._removableIds()) : null;
      stepsEl.innerHTML = order.map(id => {
        const part = (this._parts() || []).find(p => p.id === id);
        const done = this.placed.has(id);
        const isCurrent = !done && (removableSet ? removableSet.has(id) : order.filter(oid => !this.placed.has(oid))[0] === id);
        return `<div class="sim-step ${done ? 'done' : ''} ${isCurrent ? 'current' : ''}"><span class="dot"></span>${part ? (part.label || part.type) : id}</div>`;
      }).join('');
    }

    /* ---- Interactions ---- */
    selectPart(id) {
      if (this.placed.has(id)) return;
      this.selectedPartId = this.selectedPartId === id ? null : id;
      this._renderTray();
      const part = (this._parts() || []).find(p => p.id === id);
      Object.entries(this.slotMeshes).forEach(([slotId, marker]) => {
        const slot = (this._slots() || []).find(s => s.id === slotId);
        const match = part && slot && slot.accepts === part.type && !this.placed.has(this._partIdForSlot(slotId));
        marker.userData.ring.material.opacity = match ? 0.9 : 0.25;
        marker.userData.ring.material.color.set(match ? NEON.cyan : NEON.pink);
      });
    }

    _partIdForSlot(slotId) {
      return this.slotAssignment[slotId] || null;
    }

    attemptPlace(slotId) {
      if (!this.selectedPartId) { this.showToast('Select a part from the tray first', 'err'); return; }
      const part = (this._parts() || []).find(p => p.id === this.selectedPartId);
      const slot = (this._slots() || []).find(s => s.id === slotId);
      if (!part || !slot) return;

      if (this.scenario.mode !== 'disassemble' && Array.isArray(part.requires) && part.requires.length) {
        const missing = part.requires.find(reqId => !this.placed.has(reqId));
        if (missing) {
          this.mistakes++;
          this.showToast(`Place ${this._labelFor(missing)} first`, 'err');
          return;
        }
      }

      if (slot.accepts !== part.type) {
        this.mistakes++;
        this.showToast(`${part.label || part.type} doesn't go in ${slot.label || slotId}`, 'err');
        return;
      }
      if (this._partIdForSlot(slotId)) {
        this.showToast(`${slot.label || slotId} is already filled`, 'err');
        return;
      }

      const mesh = this.partMeshes[part.id];
      mesh.visible = true;
      const targetQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(...(slot.rotation || [0, 0, 0])));
      this._tween(mesh, { position: new THREE.Vector3(...slot.position), quaternion: targetQuat }, 0.45);
      this.placed.add(part.id);
      this.slotAssignment[slotId] = part.id;
      this.selectedPartId = null;
      this.bursts.push(sparkleBurst(this.scene, new THREE.Vector3(...slot.position), NEON.cyan));
      this.showToast(`${part.label || part.type} placed`, 'ok');
      Object.values(this.slotMeshes).forEach(m => { m.userData.ring.material.opacity = 0.15; });

      this._renderTray();
      this._renderProgress();
      this._checkComplete();
    }

    /* True if this stage's parts declare explicit `requires` — switches removal
       gating from "one strict single-file order" to "only genuine physical
       dependencies block you", e.g. RAM/GPU/cooler are all independent, but the
       CPU still requires the cooler off first and the PSU still requires its
       cables unplugged first. */
    _usesRequiresGating() {
      return (this._parts() || []).some(p => Array.isArray(p.requires));
    }

    /* Ids of parts that could be removed right now, given what's already gone. */
    _removableIds() {
      const remainingIds = (this._parts() || []).map(p => p.id).filter(pid => !this.placed.has(pid));
      if (!this.options.enforceOrder) return remainingIds;
      if (this._usesRequiresGating()) {
        return remainingIds.filter(pid => {
          const p = (this._parts() || []).find(x => x.id === pid);
          const requires = Array.isArray(p.requires) ? p.requires : [];
          return requires.every(reqId => this.placed.has(reqId));
        });
      }
      const remaining = (this._order() || remainingIds).filter(oid => !this.placed.has(oid));
      return remaining.length ? [remaining[0]] : [];
    }

    removePart(id) {
      const part = (this._parts() || []).find(p => p.id === id);
      if (!part) return;
      if (this.placed.has(id)) return; // already removed

      if (this.options.enforceOrder) {
        if (this._usesRequiresGating()) {
          const requires = Array.isArray(part.requires) ? part.requires : [];
          const missing = requires.filter(reqId => !this.placed.has(reqId));
          if (missing.length) {
            this.showToast(`Still connected — remove ${missing.map(m => this._labelFor(m)).join(', ')} first`, 'err');
            return;
          }
        } else if (this._order()) {
          const remaining = this._order().filter(oid => !this.placed.has(oid));
          if (remaining[0] !== id) {
            this.showToast(`Remove ${this._labelFor(remaining[0])} first`, 'err');
            return;
          }
        }
      }

      const mesh = this.partMeshes[id];
      const parked = new THREE.Vector3(0, -1.4, 1.6);
      this._tween(mesh, { position: parked }, 0.4, () => { mesh.visible = false; });
      this.placed.add(id);
      this.bursts.push(sparkleBurst(this.scene, mesh.position.clone(), NEON.pink));
      this.showToast(`${part.label || part.type} removed`, 'ok');

      this._renderTray();
      this._renderProgress();
      this._checkComplete();
    }

    _labelFor(id) {
      const p = (this._parts() || []).find(x => x.id === id);
      return p ? (p.label || p.type) : id;
    }

    hint() {
      const order = this._order() || (this._parts() || []).map(p => p.id);
      let nextId;
      if (this.scenario.mode === 'disassemble') {
        const removable = this._removableIds();
        nextId = order.find(id => removable.includes(id)) || removable[0];
      } else {
        nextId = order.find(id => !this.placed.has(id));
      }
      if (!nextId) return;
      this.showToast(`Next: ${this._labelFor(nextId)}`, 'ok');
      if (this.scenario.mode !== 'disassemble') this.selectPart(nextId);
    }

    _checkComplete() {
      const total = (this._parts() || []).length;
      if (this.placed.size >= total) {
        const hasNextStage = this.stages && this.stageIndex < this.stages.length - 1;
        setTimeout(() => hasNextStage ? this._showStageComplete() : this._showComplete(), 500);
      }
    }

    _showStageComplete() {
      const stage = this._activeStage();
      const overlay = document.createElement('div');
      overlay.className = 'sim-complete fade-up';
      overlay.innerHTML = `
        <h2 class="neon-subject font-display">${(stage && stage.completeTitle) || 'STAGE COMPLETE'}</h2>
        <div style="max-width:280px;color:rgba(255,255,255,.7);font-size:.85rem;margin:.25rem 0 .5rem;">${(stage && stage.completeMessage) || ''}</div>
        <div style="display:flex;gap:.75rem;">
          <button class="quiz-btn is-solid btn-neon" id="sim-stage-continue">CONTINUE &#8594;</button>
        </div>
      `;
      this.container.appendChild(overlay);
      overlay.querySelector('#sim-stage-continue').addEventListener('click', () => { overlay.remove(); this._advanceStage(); });
    }

    _advanceStage() {
      this.stageIndex++;
      this.placed.clear();
      this.slotAssignment = {};
      this.selectedPartId = null;
      Object.values(this.partMeshes).forEach(m => this.scene.remove(m));
      Object.values(this.slotMeshes).forEach(m => this.scene.remove(m));
      this.partMeshes = {}; this.slotMeshes = {};
      this._applyStageCamera();
      this._buildScene();
      this._refreshHud();
      this._renderTray();
      this._renderProgress();
      this._setInstructions(this.scenario.mode === 'disassemble'
        ? 'Click a placed part on the model to remove it.'
        : 'Tap a part below, then tap its glowing slot on the model.');
    }

    _refreshHud() {
      const titleEl = this.container.querySelector('.sim-title');
      if (titleEl) titleEl.innerHTML = `${this._title() || 'SIMULATION'}<span class="subtitle">${this._subtitle() || ''}</span>`;
    }

    _showComplete() {
      const seconds = Math.round((performance.now() - this.startTime) / 1000);
      const overlay = document.createElement('div');
      overlay.className = 'sim-complete fade-up';
      overlay.innerHTML = `
        <h2 class="neon-subject font-display">TASK COMPLETE</h2>
        <div class="stats">
          <div><span class="num">${seconds}s</span><span class="label">Time</span></div>
          <div><span class="num">${this.mistakes}</span><span class="label">Mistakes</span></div>
        </div>
        <div style="display:flex;gap:.75rem;">
          <button class="quiz-btn btn-neon" id="sim-complete-reset">RUN AGAIN</button>
          ${this.options.backHref ? `<a href="${this.options.backHref}" class="quiz-btn is-solid btn-neon" style="text-decoration:none;">BACK</a>` : ''}
        </div>
      `;
      this.container.appendChild(overlay);
      overlay.querySelector('#sim-complete-reset').addEventListener('click', () => { overlay.remove(); this.reset(); });
      if (typeof this.options.onComplete === 'function') this.options.onComplete({ seconds, mistakes: this.mistakes });
    }

    showToast(msg, type) {
      const toast = this.container.querySelector('#sim-toast');
      toast.textContent = msg;
      toast.className = 'sim-toast show ' + (type === 'ok' ? 'ok' : 'err');
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
    }

    reset() {
      this.stageIndex = 0;
      this.placed.clear();
      this.slotAssignment = {};
      this.selectedPartId = null;
      this.mistakes = 0;
      this.startTime = performance.now();
      Object.values(this.partMeshes).forEach(m => this.scene.remove(m));
      Object.values(this.slotMeshes).forEach(m => this.scene.remove(m));
      this.partMeshes = {}; this.slotMeshes = {};
      this._applyStageCamera();
      this._buildScene();
      this._refreshHud();
      this._renderTray();
      this._renderProgress();
      this._setInstructions(this.scenario.mode === 'disassemble'
        ? 'Click a placed part on the model to remove it.'
        : 'Tap a part below, then tap its glowing slot on the model.');
    }

    /* ---- animation loop ---- */
    _tween(obj, to, duration, onComplete) {
      const toQuat = to.quaternion || new THREE.Quaternion();
      this.tweens.push({ obj, from: obj.position.clone(), to: to.position, fromQuat: obj.quaternion.clone(), toQuat, elapsed: 0, duration, onComplete });
    }

    _animate() {
      requestAnimationFrame(() => this._animate());
      const dt = Math.min(0.05, (this._lastT ? (performance.now() - this._lastT) / 1000 : 0.016));
      this._lastT = performance.now();

      this.tweens = this.tweens.filter(tw => {
        tw.elapsed += dt;
        const p = Math.min(1, tw.elapsed / tw.duration);
        const ease = 1 - Math.pow(1 - p, 3);
        tw.obj.position.lerpVectors(tw.from, tw.to, ease);
        tw.obj.quaternion.slerpQuaternions(tw.fromQuat, tw.toQuat, ease);
        if (p >= 1) { if (tw.onComplete) tw.onComplete(); return false; }
        return true;
      });

      this.bursts = this.bursts.filter(b => {
        b.age += dt;
        const pos = b.points.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          pos.array[i*3]   += b.vel[i*3]   * dt;
          pos.array[i*3+1] += (b.vel[i*3+1] - 1.2 * b.age) * dt; // gravity
          pos.array[i*3+2] += b.vel[i*3+2] * dt;
        }
        pos.needsUpdate = true;
        b.points.material.opacity = Math.max(0, 0.9 * (1 - b.age / b.life));
        if (b.age >= b.life) { this.scene.remove(b.points); return false; }
        return true;
      });

      // gentle idle pulse on unfilled slot markers
      const t = performance.now() / 1000;
      Object.values(this.slotMeshes).forEach(m => {
        if (m.userData.ring.material.opacity > 0.5) {
          m.userData.ring.material.opacity = 0.6 + Math.sin(t * 4) * 0.25;
        }
      });

      this.renderer.render(this.scene, this.camera);
    }

    _onResize() {
      const rect = this.container.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      this.camera.aspect = rect.width / rect.height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(rect.width, rect.height);
    }
  }

  global.SimEngine = {
    init(container, scenario, options) { return new SimEngine(container, scenario, options); },
  };
})(window);