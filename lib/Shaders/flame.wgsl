// Flame particle: p, ip, v, iv, life (life 1.0 at spawn, decrease to 0 then respawn)
struct Particle {
  p: vec2f,
  ip: vec2f,
  v: vec2f,
  iv: vec2f,
  life: f32
}

@group(0) @binding(0) var<storage, read> particlesIn: array<Particle>;
@group(0) @binding(1) var<storage, read_write> particlesOut: array<Particle>;

// Buoyancy (upward), slight outward turbulence, tighter flame
const LIFT = vec2f(0.0, 0.006);
const LIFE_DECAY = 0.0009;

// Hash for turbulence (no built-in random in WGSL)
fn hash2(p: vec2f) -> vec2f {
  var q = vec2f(dot(p, vec2f(127.1, 311.7)), dot(p, vec2f(269.5, 183.3)));
  return fract(sin(q) * 43758.5453);
}

fn turbulence(pos: vec2f, t: f32) -> vec2f {
  let h = hash2(pos * 10.0 + t);
  return (h - 0.5) * 0.003;
}

struct VertexOutput {
  @builtin(position) pos: vec4f,
  @location(0) life: f32,
  @location(1) height: f32
}

@vertex
fn vertexMain(
  @location(0) corner: vec2f,
  @builtin(vertex_index) vIdx: u32,
  @builtin(instance_index) idx: u32
) -> VertexOutput {
  let particle = particlesIn[idx].p;
  let life = particlesIn[idx].life;
  let size = 0.025 * (life * life + 0.5);
  var out: VertexOutput;
  out.pos = vec4f(particle + corner * size, 0.0, 1.0);
  out.life = life;
  out.height = saturate((particle.y + 0.9) / 1.5);
  return out;
}

@fragment
fn fragmentMain(@location(0) life: f32, @location(1) height: f32) -> @location(0) vec4f {
  // Flame gradient by height: base = yellow/orange (hot), top = red (cooler)
  // Combined with life for fade at edges
  let h = height;
  var col: vec3f;
  if (h < 0.35) {
    col = mix(vec3f(1.0, 0.9, 0.4), vec3f(1.0, 0.65, 0.2), h / 0.35);
  } else if (h < 0.65) {
    col = mix(vec3f(1.0, 0.65, 0.2), vec3f(1.0, 0.35, 0.05), (h - 0.35) / 0.3);
  } else if (h < 0.9) {
    col = mix(vec3f(1.0, 0.35, 0.05), vec3f(0.9, 0.2, 0.02), (h - 0.65) / 0.25);
  } else {
    col = mix(vec3f(0.9, 0.2, 0.02), vec3f(0.5, 0.08, 0.0), (h - 0.9) / 0.1);
  }
  let alpha = life * life * 0.9;
  return vec4f(col, alpha);
}

@compute
@workgroup_size(64)
fn computeMain(@builtin(global_invocation_id) id: vec3u) {
  let idx = id.x;
  if (idx >= arrayLength(&particlesIn)) {
    return;
  }

  var p = particlesIn[idx].p;
  var v = particlesIn[idx].v;
  var life = particlesIn[idx].life;

  life -= LIFE_DECAY;
  if (life <= 0.0) {
    let r = hash2(vec2f(f32(idx), f32(id.y)));
    let rx = (r.x - 0.5) * 0.18;
    p = vec2f(rx, -0.88);
    v = vec2f((r.y - 0.5) * 0.001, 0.005 + r.x * 0.004);
    life = 1.0;
  } else {
    let t = f32(id.x) * 0.01;
    let turb = turbulence(p, t);
    v = v + LIFT + turb;
    p = p + v;
    // Inward drift as particles rise: tapered flame (wider base, narrower top)
    let inward = -p.x * 0.008 * (p.y + 0.9);
    v += vec2f(inward, 0.0);
    v *= 0.997;
  }

  particlesOut[idx].p = p;
  particlesOut[idx].ip = particlesIn[idx].ip;
  particlesOut[idx].v = v;
  particlesOut[idx].iv = particlesIn[idx].iv;
  particlesOut[idx].life = life;
}
