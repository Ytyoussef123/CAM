# CAM — VS-1 vision sensor

Prototype of an industrial vision sensor (OK / NG part inspection) built on a Raspberry Pi Compute Module 5.

| File | What it is |
|---|---|
| `inspection-console.html` | The sensor software (runs in a browser). The phone plays the sensor until the hardware arrives. |
| `vs1-carte.html` | Carrier board layout |
| `vs1-boitier.html` | Enclosure drawings |
| `bom3.py` → `VS-1_Estimation_Composants.xlsx` | Bill of materials and cost estimate |

## Inspection console

The **phone is only a live camera**; the **PC is the controller**, with two modes: **⚙ Program** (make and edit programs) and **▶ Run** (inspect, statistics, teach).

Open `https://ytyoussef123.github.io/CAM/inspection-console.html` on both devices
(GitHub Pages must be enabled for the branch).

- **Phone:** choose 📱 Camera, press Start camera. It shows a 6-letter code.
- **PC:** choose 🖥 PC · controller, Image source → Phone camera, type the code, Connect.

Program flow on the PC:

1. **Reference image** — set the **camera zoom** (digital, ×1–×4, with position), then take it from the live view; accept it (Valid) or retake. The zoom is saved in the program.
2. **Control areas** — rectangles or circles; move them (hand cursor), resize them by the corners, name them,
   set thresholds and the **detail** (zoom per area: each area is cut from the full-resolution picture and analysed
   on its own grid, Auto gives small areas more zoom). Turn an area with its round ↻ handle (snaps to
   0/90/180/270°, "⟲ → 0°" resets it); ⧉ copies a tool (Screw 1 → Screw 2). Validate the program;
   ✎ Edit tools reopens editing, and the ✎ on a tool edits that tool alone, zoomed on it.
   - **📏 Measure**: a line drawn across a gap; the two edges are found along it (first edge from each end,
     or the two strongest) and the distance is checked against a nominal ± tolerance.
     "Set from reference" takes the nominal from the reference; "Calibrate mm" converts pixels to mm.
   - **⌖ Position reference**: a distinctive part of the piece, searched in every picture (template matching
     within a search range). All other tools are moved by the offset found, so the part may shift.
     Shifts only for now, not rotation. If it is not found (below the minimum match) the part is NG.
3. **▶ Run** (validating switches to it) — Trigger takes a full-resolution picture and inspects it.
   - Every tool gets a **score from 0 to 100** (100 = like the good examples) and is OK at or above its
     **limit**, 50 by default. Measures show their value against nominal ± tolerance.
   - The run list shows one line per tool (number, OK/NG, score, bar with the limit mark).
     Click a line to see the **histogram** of that tool's results since the last reset, with the limit
     line, OK/NG counts and max / min / average, and adjust the limit right under it.
   - Processing time (last, max, min, average) is shown with the counters.
   - **Teach**: mark each area OK or NG and press Learn. Each area remembers its taught pictures and
     compares every new picture with the closest one: a taught OK picture scores **100**, a taught NG
     picture **0**, and a new picture of the same part in the same place scores the same (differences
     below the camera noise count as identical). Other parts score by how close they are to the
     examples; teaching OK examples never makes an area stricter. The Teach panel shows which learned
     picture each area matched ("same as learned 3", "closest: learned 2 (NG)").
   - **Safeguards against mismatches**
     - *Margin* per area: distance between the limit and the closest taught example (each judged
       without itself) — green ≥ 20 points, orange ≥ 10, red below. "⇔" puts the limit half way
       between the OK and the NG examples.
     - *Marginal results*: a tool within 10 points of its limit (or a measure near a tolerance edge)
       is marked ⚠ — a small change could flip it. Counted under the counters.
     - *Teaching protection*: teaching against the sensor by 20 points or more (OK on a part that
       scored very low, NG on one that scored very high) asks for a confirmation first.
     - *Audit*: learned pictures that disagree with their label when judged by the others are marked
       ⚠ (also a defective reference); open one to remove it.
     - *Repeatability test*: N pictures of the same part (optionally re-placed between pictures),
       no learning, counters untouched — spread, closest call to the limit and a verdict per tool;
       for measures 6σ as a % of the tolerance (good < 10 %, too much > 30 %).
     - *Sensitivity* per area: Low / Normal / High (High also finds faint differences; check it
       with the repeatability test). The normal variation is estimated with a median, so one odd
       or wrongly taught example cannot hide a defect.

Programs are saved in the PC browser (IndexedDB, with the full-resolution pictures). The PC screen can be zoomed with the mouse wheel (drag to pan, double-click or Fit to reset).
A **demo camera** (simulated parts) and **image files** can replace the phone for testing.
Inside claude.ai the phone link is not available (the camera is blocked there): use the demo camera.
