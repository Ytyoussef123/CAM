# CAM — VS-1 vision sensor

Prototype of an industrial vision sensor (OK / NG part inspection) built on a Raspberry Pi Compute Module 5.

| File | What it is |
|---|---|
| `inspection-console.html` | The sensor software (runs in a browser). The phone plays the sensor until the hardware arrives. |
| `vs1-carte.html` | Carrier board layout |
| `vs1-boitier.html` | Enclosure drawings |
| `bom3.py` → `VS-1_Estimation_Composants.xlsx` | Bill of materials and cost estimate |

## Inspection console

Program flow, like a commercial vision sensor:

1. **Reference image** — one good part in its exact position.
2. **Control areas** — draw boxes on the reference around what must be checked.
3. **More good parts** — 5–20 photos; thresholds are set automatically per area.
4. **Inspect** — each picture is OK or NG; one NG area makes the part NG.

### Phone = sensor, PC = monitor

Open the page on both devices. Choose **Sensor** on the phone and **Monitor** on the PC.

- **From GitHub Pages** (`https://ytyoussef123.github.io/CAM/inspection-console.html`):
  live camera on the phone. The phone shows a 6-letter code; type it on the PC to get
  live video, results, remote trigger and threshold control (peer-to-peer link via PeerJS).
- **From the claude.ai link**: no live video (the camera is blocked there); take pictures
  with the 📷 Phone photo buttons. Results reach the PC through the claude.ai data store.
