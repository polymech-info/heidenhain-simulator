# 3d-wrapper — scan estimator

SIAT WS212 palette-wrapper sim with a SICK DT35-B15551 (1D ToF) on a Z rail.
The laser looks across the turntable; the table rotates; the carriage sweeps Z.
From `(angle, z, distance, valid)` we estimate **height**, **radius**, a **polar
footprint**, and **XZ / YZ section extents**.

This app is the host. The estimator is the firmware.

| Port to ESP32 (C17 / C++17) | Do not port |
| --- | --- |
| `src/algorithm/scanEstimate.ts` | React / Three / UI |
| `src/algorithm/scanKinematics.ts` | `src/algorithm/sensorNoise.ts` (DT35 already noisy) |
| `src/algorithm/scanEstimator.ts` | Object generators, theme, canvas |
| `src/algorithm/scanControl.ts` | Host sliders (sim only) |
| `src/sim/machine.ts` + `sensor.ts` constants | — |

No heap on the sample path. No STL. `float` + `libm` (`sqrtf`, `atan2f`, `cosf`, `sinf`).

---

## MVP implementation

First ship: **contactors only**. Speeds are the machine's (fixed). We switch
the table and the winder on/off; we do not command RPM or vz, and we have
**no encoder / index**. The DT35 rides the winder slide.

```
  [ turntable, fixed ω ]          [ winder Z slide, fixed vz ]
           │                                │
           └────────── ESP32 ───────────────┘
                         │
                    DT35 distance
                         │
              kin_fixed(t) → (θ, z)     ← swap later
                         │
              estimator.add(...)        ← swap later
                         │
              height, radius, polar, sections
```

### Hardware

- ESP32 + DT35 (UART / analog, 50 Hz).
- Laser body on the winder slide, looking −X through the turntable centre.
- I/O: START, two end-stops, pot, three contactors — see **Control design**.

### Pose without index

`scan_accum_add` still wants `(angle, z, distance, valid)`. MVP fills pose from
**time + two calibrated constants** (`scan_kin_fixed_*`):

```
θ(t) = ω (t − t0)          mod 2π
z(t) = z_start + vz (t − t0)   clamp to [z_min, z_max]
```

- `ω` from nameplate or a stopwatch on N revolutions. `omega = rpm * 2π / 60`.
- `vz` from nameplate or timing the carriage over a known height.
- `t0` = START (after home). Do not start pose on the first DT35 hit.
- Machine: `scan_kin_drive_step` — integrate θ only while `K_TABLE`, Z only
  while `K_UP` / `K_DOWN`. Host free-run demo still uses `bounce = 1`.
- Absolute `φ` is **undefined**. Object frame zero is `t0`. Height and radius
  do not care. Polar/sections are consistent in that frame, not aligned to the
  pallet forks.

Recalibrate `ω` / `vz` if the wrapper program changes. Drift in `ω` rotates the
polar plot; drift in `vz` scales height and smears the Z bins.

### Firmware loop

```c
/* 1 kHz control tick + 50 Hz DT35 */
scan_ctrl_tick(&ctrl, &in, dt, &out);
write_contactors(&out);
scan_kin_drive_step(&kin, out.k_table, out.k_up, out.k_down, dt, &angle, &z);
if (dt35_fresh) est.add(est.ctx, &geom, angle, z, distance_mm, valid);
```

Do not special-case the DT35 inside the estimator. Clear the accum on START
(leave IDLE → HOMING / SCAN_UP).

### What MVP must get right

1. Height (`max z` with a hit − `z_ref`) — film top.
2. Radius (AABB-corner of object-frame hits) — film stick-out.
3. Survive a full wrap without dropping extrema (accum, not a ring).

Polar + sections are free once pose is in. They are wrong in azimuth until an
index exists; still useful for a human check.

### Swap points (do not fork the loop)

| Slot | MVP | Later |
| --- | --- | --- |
| Kinematics | `scan_kin_drive` — contactors × `ω`, `vz` | Encoder / index + Z pot |
| Estimator | `scan_estimator_accum` | Occupancy / TSDF / full geom |
| Motion | `UP_DOWN_SCAN_GO` stop-and-go on the way up | Same contactors, other profiles |
| Report | `scan_estimate_t` (height, radius) | Extra buffers on the new ctx |

C vtable (one `.c` per algo, one table at link time):

```c
typedef struct {
  void *ctx;
  void (*clear)(void *ctx);
  void (*add)(void *ctx, const scan_geom_t *g,
              float angle_rad, float z_mm, float distance_mm, uint8_t valid);
  void (*estimate)(void *ctx, const scan_geom_t *g, scan_estimate_t *out);
} scan_estimator_t;
```

v2 full-geom implements the same three calls. It may keep a denser grid behind
`ctx`. The DT35 ISR and kin step do not change.

Kinematics swap the same way: anything that writes `(angle, z)` per `dt`.
Index pulse → reset `θ` to 0 once per rev (locks polar to the machine).
Z analog/encoder → overwrite `z` and ignore integrated `vz`.

### Out of scope for MVP

- VFD / analog speed, table reverse.
- Absolute pallet orientation.
- Concave / interior geom (1D near face only).
- Auto-cal of `ω` from the range period (load-dependent).

---

## Control design

Basic mode: **UP_DOWN_SCAN_GO**. One START. Home if needed. **Full sim**
(default on) measures first — continuous up then down with the laser — latches
`height_mm` from the estimate, then wraps. Off = wrap immediately (scan while
wrapping, plan height 2100 mm). Two host trails: cyan = scan hits, white = film
helix.

```
  Actions (fixed queue, chainable):

  AUTO     = SCAN → BAND → WRAP_UP → BAND
  HOME     = K_DOWN to ES_BOT
  SCAN     = SCAN_UP → SCAN_DOWN          (miss + 10%, latch height)
  WRAP_UP  = spiral to load top           (assumes scan)
  WRAP_DOWN= spiral to pallet
  ZIGZAG   = WRAP_UP → WRAP_DOWN
  BAND     = N table-only hoops at current Z   (start / end wraps)
  STOP     = clear queue, coils off

  STOPPED / FINISHED / ERROR ──act──► queue ──► FINISHED
```

### I/O

| Tag | Kind | Notes |
| --- | --- | --- |
| `START` | DI, momentary | Rising edge. Same button restarts from DONE. |
| `ES_BOT` | DI | Bottom end-stop. **Hard-wire NC in series with `K_DOWN` coil.** |
| `ES_TOP` | DI | Top end-stop. **Hard-wire NC in series with `K_UP` coil.** |
| `ESTOP` | DI | Optional. Drops all coils, `FAULT`. |
| `POT` | AI | Film **layers** (1…10), latched on the action. **1 = continuous**. |
| `K_TABLE` | DO → contactor | Table, fixed ω, **no reverse**. |
| `K_UP` | DO → contactor | Winder up, fixed vz. |
| `K_DOWN` | DO → contactor | Winder down, fixed vz. |

Software never asserts `K_UP` and `K_DOWN` together. Hardware should still be
an XOR / interlock on the coils. End-stops cut the opposing coil even if the
ESP32 hangs.

Table has no reverse contactor in this revision.

### Floor speeds

| Axis | Time | Implied |
| --- | --- | --- |
| Turntable | **5 s / rev** | 12 rpm, no reverse |
| Winder | **40 s** bottom → top | ~54 mm/s over the sim travel window |

Continuous (both contactors on) gives a fixed helix pitch:

```
native_wraps     = 40 / 5 = 8
native_pitch_mm  ≈ height / 8
```

Over a 2100 mm load that is ~262 mm/rev. Folie is **40 cm** (variable later),
so one continuous pass is only ~400/262 ≈ **1.5 layers**. Default is **at
least 3 layers** on the spiral:

```
pitch_mm ≤ film_mm / layers          // 400 / 3 ≈ 133 mm
W        = ceil(height_mm / pitch)   // ceil(2100 / 133) = 16
W        = max(W, 8)                 // cannot climb faster than 40 s
```

16 > 8 → stop-and-go is the default, not an extra. Change `film_mm` when the
roll width changes; the pot stays “layers”.

### Workflow (one button)

1. Operator sets the **pot** (layers, default 3). Film width is a setup
   constant (400 mm now).
2. Pallet on. **Full sim** on (default). Set **start/end wraps** (default 5,
   max 10) and layers. Press **START**.
3. If not on `ES_BOT`: **HOMING** — `K_DOWN` only, table off.
4. **Full sim on** — measure pass (table on, continuous winder, no film):
   - **MEASURE_UP** — `K_TABLE` + `K_UP` until first infinite (miss) + **10%**
     of load height. Pallet hits/misses are ignored (`z` must be above the
     pallet). `ES_TOP` is only a hard stop.
   - **MEASURE_DOWN** — `K_TABLE` + `K_DOWN` until `ES_BOT`
   - Latch `height_mm` from the estimate, recompute `W` / slices
5. **START_WRAPS** — `K_TABLE` only, winder stays on the pallet.
   `N × 5 s` (default 25 s). Ties the load to the palette before the spiral.
6. **SCAN_UP** stop-and-go up to the **load height**, not the rail top:
   - `t_climb = height_mm × 40 / rail_mm` — winder-on time to the object top
   - `W = max(ceil(t_climb / 5), ceil(H / pitch))`
   - **GO** — `K_UP` for `t_on = t_climb / W`
   - **STOP** — `K_UP` off for `t_off = 5 − t_on`
   - Exit when climb time is spent (or `ES_TOP` as a hard stop)
7. **END_WRAPS** — same `N × 5 s` as start, table only, at the object top.
8. **FINISHED** — all off. `WRAPPING_DOWN` is reserved for later.
9. START from `STOPPED` / `FINISHED` / `ERROR` = new job (clear accum).

Full sim off skips step 4 and scans during the wrap (same trail split: cyan
hits vs white film). After measure, `height_mm` replaces the 2100 mm plan so
pitch matches the real load.

No Z encoder: slices are **timed** from the 40 s / 5 s constants. Recalibrate
those two numbers if the machine changes. Watchdog counts **winder-on** time
only (`T_HEIGHT + 20 s`); stops do not count.

### Folie and the pot

| Setup | Value |
| --- | --- |
| `film_mm` | **400** now, change when the roll changes (not the pot) |
| `layers` | pot 0…1 → **1…10**, latch on the action. **1 = continuous** (no stop-and-go) |
| `start_wraps` | **0…10**, default **5** — same N at the pallet (**start**) and at the load top (**end**) |
| `full_sim` | **1** default — measure up/down, then wrap. `0` = wrap immediately |
| `height_mm` | 2100 (max load) until MEASURE_DOWN latches the estimate |

Spiral (helix), not stacked hoops: each rev the carriage rises `pitch`. A point
on the load sees another layer every `pitch` millimetres of Z. Coverage is
`film / pitch` layers.

```
pitch_mm = film_mm / layers
t_climb  = height_mm × 40 / rail_mm
W        = max(ceil(t_climb / 5), ceil(height_mm / pitch_mm))
t_on     = t_climb / W
t_off    = max(0, 5 − t_on)
```

Full sim latches `height_mm` at the end of `MEASURE_DOWN` and recomputes `W`.
Off uses 2100 mm for the first wrap (safe, slightly denser).

### State

| State | Meaning |
| --- | --- |
| `STOPPED` | Idle / reset. START begins a job. |
| `SCAN_UP` | Laser measure, climb to first infinite + 10%. |
| `SCAN_DOWN` | Laser measure, back to `ES_BOT`. Latch height. |
| `WRAPPING_UP` | Start wraps, spiral to load top, end wraps. |
| `WRAPPING_DOWN` | Reserved (later). |
| `FINISHED` | Job done. START again. |
| `ERROR` | Estop, timeout, or both end-stops. START retries. |

Internal `mode` is the coil / slice step inside a state (`START_WRAPS`,
`SCAN_UP_GO` / `STOP`, `END_WRAPS`, …).

| Mode (inside state) | `K_TABLE` | `K_UP` | `K_DOWN` | Exit |
| --- | --- | --- | --- | --- |
| `HOMING` | | | ● | `ES_BOT` |
| `MEASURE_UP` | ● | ● | | miss + 10%, or `ES_TOP` |
| `MEASURE_DOWN` | ● | | ● | `ES_BOT` → wrap |
| `START_WRAPS` | ● | | | `N × 5 s` |
| `SCAN_UP_GO` | ● | ● | | `t_on` or load top |
| `SCAN_UP_STOP` | ● | | | `t_off` or load top |
| `END_WRAPS` | ● | | | `N × 5 s` → `FINISHED` |

Estimator `add` in `SCAN_UP` / `SCAN_DOWN`. Full sim off: also during
`WRAPPING_UP`. Host: cyan trail while scanning, white film while wrapping.

Host: `src/algorithm/scanControl.ts`.

---

## Frames

Estimator is **Z-up**, millimetres, same as `tests/wrapper/siat_ws212_palette_wrapper_adjustable.scad`.

| Axis | Meaning |
| --- | --- |
| `+X` | turntable centre → mast |
| `+Y` | lateral |
| `+Z` | up |

Three.js remaps that to `(X, Z, Y)` → `(x, y-up, z)`. Do not carry that remap into firmware.

Sensor sits on the machine axis, looking at −X:

```
hit_xy = (sensor_x, sensor_y) + (look_x, look_y) * distance
```

Turntable angle `θ` is CCW about +Z. Inverse-rotate the hit into the **object frame**
(load as if the table were at 0):

```
ox =  wx * cosθ + wy * sinθ
oy = −wx * sinθ + wy * cosθ
```

All envelopes live in that frame. They do not shrink when the table keeps turning.

---

## Input

One sample, 50 Hz typical (DT35 fast mode). MVP measures only range; pose is
integrated (`scan_kin_fixed_step`):

```
angle_rad   from kinematics (time × ω) — not an encoder
z_mm        from kinematics (time × vz) — slide has no index
distance_mm DT35 range
valid       1 if in-range and not a dropout
```

`scan_geom_t` is constant after mount:

```
sensor_x_mm, sensor_y_mm, look_x, look_y
min_range_mm, max_range_mm     // DT35: 50 … 12000 (90 % rem.)
z_ref_mm                       // turntable top (73 mm on WS212A)
```

Z sweep window on the accum (`z0` … `z1`) is the rail travel used for section bins
(sim: turntable top → `Z_TRAVEL_MAX_MM`).

---

## Algorithm

`scan_accum_t` is expand-only. Clear only at the start of a job (or a new load).

On each valid in-range sample:

1. Reconstruct `hit_xy`, rotate into object `(ox, oy)`, `r = hypot(ox, oy)`.
2. Grow global extrema: `z_min/max`, `r_min/max`, `x_min/max`, `y_min/max`.
3. Polar: `φ = atan2(oy, ox)` → 72 bins, keep **max r** per bin.
4. Section: `z` → 48 bins in `[z0, z1]`, keep **min/max x** and **min/max y** per bin.

A 1D beam only sees the near face. After several table revolutions during a Z
sweep, each Z bin has hits from many `φ`, so the per-bin AABB lines up with an
offset / overhang load. Do not extrude the top-view meridians as a single
rectangle — that recentres everything.

### Outputs

| Field | Definition |
| --- | --- |
| `height_mm` | `max(z_hit) − z_ref` (clamp ≥ 0) |
| `radius_mm` | farthest **AABB corner** of all object-frame hits (`hypot` of `{x_min,x_max} × {y_min,y_max}`) |
| `polar[]` | max radius vs `φ` (top outline) |
| `x_min/max[z]`, `y_min/max[z]` | A–A (XZ) and B–B (YZ) extents vs height |
| `occ[z]` | 1 if that Z bin has at least one hit |

`radius_mm` matches mesh truth (AABB corners), not max single-hit `r`. A corner
that never crossed the beam still appears if its two extents were seen on
different samples.

`r_max_mm` is the largest actual hit radius (support). Use that if you need the
true silhouette, not the bounding-box diagonal.

---

## C17 surface

Keep the names. Compile as C17 or C++17 (`-std=c17` / `-std=c++17`). ESP-IDF: one
`.c` / `.cpp`, no Arduino String, no `new` on the sample path.

```c
#pragma once
#include <stdint.h>

#define SCAN_POLAR_BINS 72
#define SCAN_Z_BINS     48

typedef struct {
  float sensor_x_mm, sensor_y_mm, look_x, look_y;
  float min_range_mm, max_range_mm, z_ref_mm;
} scan_geom_t;

typedef struct {
  float height_mm, radius_mm;
  float z_min_mm, z_max_mm, r_min_mm, r_max_mm;
  uint32_t hit_count, sample_count;
} scan_estimate_t;

typedef struct {
  uint32_t sample_count, hit_count;
  uint8_t  has_hit;
  float    z_min_mm, z_max_mm, r_min_mm, r_max_mm;
  float    x_min_mm, x_max_mm, y_min_mm, y_max_mm;
  float    polar[SCAN_POLAR_BINS];
  float    x_min[SCAN_Z_BINS], x_max[SCAN_Z_BINS];
  float    y_min[SCAN_Z_BINS], y_max[SCAN_Z_BINS];
  uint8_t  occ[SCAN_Z_BINS];
  float    z0, z1;
} scan_accum_t;

void scan_accum_clear(scan_accum_t *a);
void scan_accum_add(scan_accum_t *a, const scan_geom_t *g,
                    float angle_rad, float z_mm, float distance_mm, uint8_t valid);
void scan_accum_estimate(const scan_accum_t *a, const scan_geom_t *g,
                         scan_estimate_t *out);
```

Helpers if you split them out (already inlined in `scan_accum_add` in TS):

```c
float   scan_hypot(float x, float y);                    /* sqrtf(x*x + y*y) */
int     scan_clamp_bin(int bin, int n);
int     scan_bin_u(float v, float v0, float span, int n);
int     scan_phi_bin(float phi, int n);
void    scan_hit_xy(const scan_geom_t *g, float d, float *x, float *y);
void    scan_world_to_object(float wx, float wy, float th, float *ox, float *oy);
uint8_t scan_range_ok(const scan_geom_t *g, float d);
```

Kinematics (MVP). Host: `src/algorithm/scanKinematics.ts`.

```c
typedef struct {
  float omega_rad_s, vz_mm_s, z_min_mm, z_max_mm;
  uint8_t bounce;
  float angle_rad, z_mm;
  int8_t z_dir;
} scan_kin_fixed_t;

void scan_kin_fixed_init(scan_kin_fixed_t *k, float omega, float vz,
                         float z0, float z1, uint8_t bounce);
void scan_kin_fixed_reset(scan_kin_fixed_t *k);
void scan_kin_fixed_set_rates(scan_kin_fixed_t *k, float omega, float vz);
void scan_kin_fixed_step(scan_kin_fixed_t *k, float dt_s,
                         float *angle_rad, float *z_mm);
void scan_kin_drive_step(scan_kin_fixed_t *k, uint8_t k_table,
                         uint8_t k_up, uint8_t k_down, float dt_s,
                         float *angle_rad, float *z_mm);
```

Control (`src/algorithm/scanControl.ts`):

```c
enum {
  SCAN_STATE_STOPPED = 0,
  SCAN_STATE_SCAN_UP,
  SCAN_STATE_SCAN_DOWN,
  SCAN_STATE_WRAPPING_UP,
  SCAN_STATE_WRAPPING_DOWN, /* later */
  SCAN_STATE_FINISHED,
  SCAN_STATE_ERROR
};

enum {
  SCAN_CTRL_MODE_IDLE = 0,
  SCAN_CTRL_MODE_HOMING,
  SCAN_CTRL_MODE_START_WRAPS,
  SCAN_CTRL_MODE_SCAN_UP_GO,
  SCAN_CTRL_MODE_SCAN_UP_STOP,
  SCAN_CTRL_MODE_END_WRAPS,
  SCAN_CTRL_MODE_SCAN_DOWN,
  SCAN_CTRL_MODE_DONE,
  SCAN_CTRL_MODE_FAULT,
  SCAN_CTRL_MODE_MEASURE_UP,
  SCAN_CTRL_MODE_MEASURE_DOWN
};

#define SCAN_CTRL_T_REV_S      5.f
#define SCAN_CTRL_T_HEIGHT_S   40.f
#define SCAN_CTRL_FILM_MM      400.f   /* variable; this is the first roll */
#define SCAN_CTRL_LAYERS_MIN   1   /* continuous */
#define SCAN_CTRL_LAYERS_MAX   10
#define SCAN_CTRL_HEIGHT_MM    2100.f
#define SCAN_CTRL_RAIL_MM      2172.f

typedef struct {
  uint8_t start, es_top, es_bot, estop, full_sim;
  float pot_01, start_wraps, height_mm;
} scan_ctrl_in_t;
typedef struct { uint8_t k_table, k_up, k_down; } scan_ctrl_out_t;
typedef struct {
  uint8_t state, mode, start_prev, fault, full_sim;
  float film_mm, height_mm, layers, start_wraps, wraps, t_climb_s, t_on_s, t_off_s, phase_s, winder_s;
} scan_ctrl_t;

void  scan_ctrl_init(scan_ctrl_t *c);
void  scan_ctrl_tick(scan_ctrl_t *c, const scan_ctrl_in_t *i,
                     float dt_s, scan_ctrl_out_t *o);
int   scan_ctrl_is_measure(uint8_t state);
int   scan_ctrl_is_wrap(uint8_t state);
int   scan_ctrl_is_idle(uint8_t state);
const char *scan_ctrl_state_name(uint8_t state);
int   scan_ctrl_pot_layers(float pot_01);
int   scan_ctrl_spiral_wraps(float height_mm, float film_mm, float layers);
float scan_ctrl_spiral_pitch_mm(float film_mm, float layers);
float scan_ctrl_climb_s(float height_mm);
void  scan_ctrl_slice_s(float wraps, float t_climb_s, float *t_on, float *t_off);
```

`scan_make_*` / `scan_empty_estimate` are host allocators. Device loop is under
**MVP implementation** (kin → estimator vtable, not a raw `scan_accum_add` from
an encoder).

---

## Memory

Static `scan_accum_t` is about **1.7 KiB**:

```
4 * 72          polar
4 * 48 * 4      x/y min/max
48              occ
+ scalars
```

Fits IRAM/DRAM on ESP32 with room for DT35 UART. Do not keep a sample ring for
the estimate — a sliding window drops the top of the load after ~80 s at 50 Hz /
4096 samples. The accum is the record.

---

## Limits

- Near-surface only. Cavities and the far side of a concavity are invisible.
- Polar bins are 5°. Thin spikes narrower than that can fall between bins.
- Section bins are ~`(z1 − z0) / 48` mm. The sim window is ~2.1 m → ~44 mm/bin.
- Height is last-seen max Z with a valid hit, not a fitted top face.
- MVP pose is time-integrated. `ω` / `vz` error is a slow smear, not a hard fail.
- DT35 timestamp and `dt` for kin must use the same clock (`esp_timer`).

Host sim (`src/scene/ScanRuntime.tsx`) is the reference caller: ray = DT35 beam,
`scan_kin_fixed_step` → `estimator.add` / `estimate`.
