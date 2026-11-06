# CAM — VS-1 vision sensor

Prototype of an industrial vision sensor (OK / NG part inspection) built on a Raspberry Pi Compute Module 5.

| File | What it is |
|---|---|
| `inspection-console.html` | The sensor software (runs in a browser). The phone plays the sensor until the hardware arrives. |
| `vs1-carte.html` | Carrier board layout |
| `vs1-boitier.html` | Enclosure drawings |
| `bom3.py` → `VS-1_Estimation_Composants.xlsx` | Bill of materials and cost estimate |

## Inspection console

The **phone is only a live camera**; the **PC is the controller** where programs are made and run.

Open `https://ytyoussef123.github.io/CAM/inspection-console.html` on both devices
(GitHub Pages must be enabled for the branch).

- **Phone:** choose 📱 Camera, press Start camera. It shows a 6-letter code.
- **PC:** choose 🖥 PC · controller, Image source → Phone camera, type the code, Connect.

Program flow on the PC:

1. **Reference image** — set the **camera zoom** (digital, ×1–×4, with position), then take it from the live view; accept it (Valid) or retake. The zoom is saved in the program.
2. **Control areas** — rectangles or circles; move them (hand cursor), resize them by the corners, name them,
   set thresholds and the **detail** (zoom per area: each area is cut from the full-resolution picture and analysed
   on its own grid, Auto gives small areas more zoom). Validate the program; ✎ Edit areas reopens editing.
3. **Run & teach** — Trigger takes a full-resolution picture from the phone and inspects it.
   Mark each area OK or NG and press Learn: each area learns from its OK examples and
   its threshold is placed between the OK and NG examples.

Programs are saved in the PC browser (IndexedDB, with the full-resolution pictures). The PC screen can be zoomed with the mouse wheel (drag to pan, double-click or Fit to reset).
A **demo camera** (simulated parts) and **image files** can replace the phone for testing.
Inside claude.ai the phone link is not available (the camera is blocked there): use the demo camera.
