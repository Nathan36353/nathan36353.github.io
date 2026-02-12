struct MultiVector {
  s: f32,
  exey: f32,
  eoex: f32,
  eoey: f32
}

struct Pose {
  motor: MultiVector,
  scale: vec2f
}

struct Params {
  toggleCount: u32
}

@group(0) @binding(0) var<uniform> pose: Pose;
@group(0) @binding(1) var<storage, read> cellStatusIn: array<u32>;
@group(0) @binding(2) var<storage, read_write> cellStatusOut: array<u32>;
@group(0) @binding(3) var<uniform> params: Params;
@group(0) @binding(4) var<storage, read> toggles: array<u32>;

const GRID_SIZE = 256u;
const MAX_TOGGLES = 64u;

fn geometricProduct(a: MultiVector, b: MultiVector) -> MultiVector {
  return MultiVector(
    a.s * b.s - a.exey * b.exey,
    a.s * b.exey + a.exey * b.s,
    a.s * b.eoex + a.exey * b.eoey + a.eoex * b.s - a.eoey * b.exey,
    a.s * b.eoey - a.exey * b.eoex + a.eoex * b.exey + a.eoey * b.s
  );
}

fn reverse(a: MultiVector) -> MultiVector {
  return MultiVector(a.s, -a.exey, -a.eoex, -a.eoey);
}

fn applyMotor(p: MultiVector, m: MultiVector) -> MultiVector {
  return geometricProduct(m, geometricProduct(p, reverse(m)));
}

fn createPoint(p: vec2f) -> MultiVector {
  return MultiVector(0.0, 1.0, p.y, -p.x);
}

fn extractPoint(p: MultiVector) -> vec2f {
  return vec2f(-p.eoey / p.exey, p.eoex / p.exey);
}

fn applyMotorToPoint(p: vec2f, m: MultiVector) -> vec2f {
  let new_p = applyMotor(createPoint(p), m);
  return extractPoint(new_p);
}

struct VertexOutput {
  @builtin(position) pos: vec4f,
  @location(0) cellStatus: f32
}

@vertex
fn vertexMain(@location(0) pos: vec2f, @builtin(instance_index) idx: u32) -> VertexOutput {
  let u = idx % GRID_SIZE;
  let v = idx / GRID_SIZE;
  let uv = vec2f(f32(u), f32(v)) / f32(GRID_SIZE);
  let halfLength = 1.0;
  let cellLength = halfLength * 2.0;
  let cell = pos / f32(GRID_SIZE);
  let offset = -halfLength + uv * cellLength + cellLength / f32(GRID_SIZE) * 0.5;
  let transformed = applyMotorToPoint(cell + offset, reverse(pose.motor));
  let scaled = transformed * pose.scale;
  var out: VertexOutput;
  out.pos = vec4f(scaled, 0.0, 1.0);
  out.cellStatus = f32(cellStatusIn[idx]);
  return out;
}

@fragment
fn fragmentMain(@location(0) cellStatus: f32) -> @location(0) vec4f {
  let aliveColor = vec4f(0.2, 0.9, 0.3, 1.0);
  let deadColor = vec4f(0.0, 56.0/255.0, 101.0/255.0, 1.0);
  return select(deadColor, aliveColor, cellStatus > 0.5);
}

@compute
@workgroup_size(8, 8)
fn computeMain(@builtin(global_invocation_id) cell: vec3u) {
  let x = cell.x;
  let y = cell.y;
  if (x >= GRID_SIZE || y >= GRID_SIZE) {
    return;
  }
  let i = y * GRID_SIZE + x;
  var shouldToggle = false;
  for (var k = 0u; k < params.toggleCount && k < MAX_TOGGLES; k++) {
    if (toggles[k] == i) {
      shouldToggle = true;
      break;
    }
  }
  if (shouldToggle) {
    cellStatusOut[i] = 1u - cellStatusIn[i];
    return;
  }
  let xp1 = (x + 1u) % GRID_SIZE;
  let xm1 = (x + GRID_SIZE - 1u) % GRID_SIZE;
  let yp1 = (y + 1u) % GRID_SIZE;
  let ym1 = (y + GRID_SIZE - 1u) % GRID_SIZE;
  let neighborsAlive = cellStatusIn[y * GRID_SIZE + xp1] + cellStatusIn[y * GRID_SIZE + xm1]
    + cellStatusIn[yp1 * GRID_SIZE + x] + cellStatusIn[ym1 * GRID_SIZE + x]
    + cellStatusIn[yp1 * GRID_SIZE + xp1] + cellStatusIn[yp1 * GRID_SIZE + xm1]
    + cellStatusIn[ym1 * GRID_SIZE + xp1] + cellStatusIn[ym1 * GRID_SIZE + xm1];
  let alive = cellStatusIn[i];
  if (alive == 1u && (neighborsAlive == 2u || neighborsAlive == 3u)) {
    cellStatusOut[i] = 1u;
  } else if (alive == 0u && neighborsAlive == 3u) {
    cellStatusOut[i] = 1u;
  } else {
    cellStatusOut[i] = 0u;
  }
}
