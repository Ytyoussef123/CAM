# CAM — VS-1 vision sensor

Prototype of an industrial vision sensor (OK / NG part inspection) built on a Raspberry Pi Compute Module 5.

| File | What it is |
|---|---|
| `inspection-console.html` | The sensor software (runs in a browser). The phone plays the sensor until the hardware arrives. |
| `vs1-carte.html` | Carrier board layout |
| `vs1-boitier.html` | Enclosure drawings |
| `bom3.py` → `VS-1_Estimation_Composants.xlsx` | Bill of materials and cost estimate |

## Inspection console

The **phone is only a live camera**; the **PC is the controller**, laid out like an industrial vision
sensor console (VS-1 look): toolbar with **▶ RUN / ⚙ PROGRAM** and the program selector, a big status
block (LIVE / MASTER / OK / NG), the image with its zoom bar, TIME / TRIGGER / OUT boxes under it and a
status bar. **⚙ PROGRAM** has five steps — **1 Image** (source, camera zoom), **2 Master** (master
image), **3 Tools** (＋ Add tool, Edit, Copy, Delete, settings of the selected tool), **4 Learn** (folders
of OK and NG pictures, optional), **5 Outputs** (what OUT1 / OUT2 signal) — and **Finish** goes to
**▶ RUN** (tool list, then tabs *Limit & histogram*, *Additional learning*, *Repeatability*, *Test a folder*).

**4 Learn** (PROGRAM): an **OK** block and an **NG** block, each with its count, the last learned pictures,
**📁 Add OK / NG folder(s)** and **🖼 pictures**. Each picture is triggered like a part on the line — one
every **1 / 3 / 5 s** or *fast* (3 s by default): it appears on the screen with its judgment, then it is
learned, and the image line says what happened ("learned as OK ✓ (Area 1)", "like pictures already
learned", "⚠ looks very different…"). ■ Stop keeps what was learned so far.
- *OK folders*: every picture is looked at quickly first; per area, pictures much farther from the
  typical one than the others are shown but **not learned** and listed (possible defects hidden in the
  folder — needs 8 pictures or more), and only pictures that bring something new are kept, at most 50 per
  area (farthest-first selection).
- *NG folders*: a picture is learned as NG only in the area(s) where the defect is seen (score below the
  limit), or in the area chosen in "Learn NG in"; when no area sees it, it is not learned and is listed.
  At most 50 NG pictures per area. Learning NG while an area knows fewer than 4 good pictures asks first.
- Pictures in folders named good are skipped when learning NG, and the other way round. Several folders
  wait in line (OK folders before NG folders); several folders can be dropped on a block at once.
- Single pictures are still taught in RUN → *Additional learning*.

**Test a folder** (RUN): choose or drop a folder of pictures; each one is triggered in turn — one every
1 / 3 / 5 s or *fast* — and shown with its judgment and ✓ / ✗ against the folder name (nothing learned,
counters untouched); the summary, chart and wrong results fill in while it runs and stay at the end.
The expected result is read from the folder names
(good / ok / normal → OK; defect / ng / anomaly, or any folder under `test/` → NG, as in MVTec, VisA and
the Kaggle casting set; mask folders are skipped), or set by hand. You get good parts accepted / false
alarms / defects caught / defects missed, scores by folder per tool (one thin bar per score point,
stacked green / red / grey by folder) with the limit line, the limit that
would work best on that folder, and the list of wrong results (show or teach each one). Pictures that
are practically identical to a taught picture or the master are not counted. Learn good pictures from
a dataset's `train/good` folder (PROGRAM → 4 Learn), test on its `test` folder.

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
     Click a line to see the **histogram** of that tool's results since the last reset — one thin bar per
     score point (0 … 100; 100 bars across the range for measures) — with the limit line, OK/NG counts
     and max / min / average, and adjust the limit right under it.
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
