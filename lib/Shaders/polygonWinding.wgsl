struct Edge {
  a: vec2f,
  b: vec2f,
};

struct MousePoint {
  p: vec2f,
};

@group(0) @binding(0) var<storage, read> edges: array<Edge>;
@group(0) @binding(1) var<uniform> mouse: MousePoint;
@group(0) @binding(2) var<storage, read_write> winding: array<atomic<i32>>;

@compute @workgroup_size(64)
fn computeMain(@builtin(global_invocation_id) id: vec3u) {
  let idx = id.x;
  if (idx >= arrayLength(&edges)) {
    return;
  }

  let e = edges[idx];
  let px = mouse.p.x;
  let py = mouse.p.y;

  let x0 = e.a.x;
  let y0 = e.a.y;
  let x1 = e.b.x;
  let y1 = e.b.y;

  let isLeft = (x1 - x0) * (py - y0) - (y1 - y0) * (px - x0);

  // Winding number for a horizontal ray to +infinity
  if (y0 <= py && y1 > py && isLeft > 0.0) {
    atomicAdd(&winding[0], 1);
  } else if (y0 > py && y1 <= py && isLeft < 0.0) {
    atomicAdd(&winding[0], -1);
  }

  // Second winding number (mirror pass) – useful for robustness.
  if (y0 >= py && y1 < py && isLeft < 0.0) {
    atomicAdd(&winding[1], 1);
  } else if (y0 < py && y1 >= py && isLeft > 0.0) {
    atomicAdd(&winding[1], -1);
  }
}

