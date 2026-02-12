struct Particle {
  p: vec2f,
  ip: vec2f,
  v: vec2f,
  iv: vec2f
}

@group(0) @binding(0) var<storage, read> particlesIn: array<Particle>;
@group(0) @binding(1) var<storage, read_write> particlesOut: array<Particle>;

const GRAVITY = vec2f(0.0, -0.0005);

fn generateWind(time: f32, frequency: f32, strength: f32) -> vec2f {
  let angle = sin(time * frequency) * 3.14159265;
  return vec2f(cos(angle), sin(angle)) * strength;
}

@vertex
fn vertexMain(
  @location(0) _dummy: vec2f,
  @builtin(vertex_index) vIdx: u32,
  @builtin(instance_index) idx: u32
) -> @builtin(position) vec4f {
  let particle = particlesIn[idx].p;
  let size = 0.0125;
  let pi = 3.14159265;
  let theta = 2.0 * pi / 8.0 * f32(vIdx);
  let x = cos(theta) * size;
  let y = sin(theta) * size;
  return vec4f(vec2f(x + particle.x, y + particle.y), 0.0, 1.0);
}

@fragment
fn fragmentMain() -> @location(0) vec4f {
  return vec4f(1.0, 1.0, 1.0, 1.0);
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
  let ip = particlesIn[idx].ip;

  p = p + v;
  let wind = generateWind(p.y, 1.5, 0.00005);
  v = v + GRAVITY + wind;

  if (p.x < -1.0 || p.x > 1.0 || p.y < -1.0 || p.y > 1.0) {
    p = ip;
    v = particlesIn[idx].iv;
  }

  particlesOut[idx].p = p;
  particlesOut[idx].ip = ip;
  particlesOut[idx].v = v;
  particlesOut[idx].iv = particlesIn[idx].iv;
}
