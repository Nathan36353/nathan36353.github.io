// Mass-spring system: particles + springs
// Particle: pos(2), vel(2), dv(2), mass(1), dummy(1) = 8 floats
struct Particle {
  p: vec2f,
  v: vec2f,
  dv: vec2f,
  mass: f32,
  dummy: f32
}

// Spring: ptA, ptB (indices as float), restLength, stiffness = 4 floats
struct Spring {
  ptA: f32,
  ptB: f32,
  restLength: f32,
  stiffness: f32
}

@group(0) @binding(0) var<storage, read> particlesIn: array<Particle>;
@group(0) @binding(1) var<storage, read_write> particlesOut: array<Particle>;
@group(0) @binding(2) var<storage, read> springsIn: array<Spring>;

@compute @workgroup_size(256)
fn computeMain(@builtin(global_invocation_id) id: vec3u) {
  let idx = id.x;
  if (idx >= arrayLength(&springsIn)) { return; }
  let s = springsIn[idx];
  let ptA = u32(s.ptA);
  let ptB = u32(s.ptB);
  let pa = particlesIn[ptA];
  let pb = particlesIn[ptB];
  let diff = pb.p - pa.p;
  let currLen = length(diff);
  let restLen = s.restLength;
  let stiffness = s.stiffness;
  let dt = 0.008;
  let force = -stiffness * (currLen - restLen) * dt;
  var dir = vec2f(0.0, 0.0);
  if (currLen > 0.0001) {
    dir = normalize(diff);
  }
  let massA = max(pa.mass * 1000.0, 0.001);
  let massB = max(pb.mass * 1000.0, 0.001);
  let dvA = (force * dir) / massA;
  let dvB = -(force * dir) / massB;
  particlesOut[ptA].dv += dvA;
  particlesOut[ptB].dv -= dvB;
}

@compute @workgroup_size(256)
fn copyMain(@builtin(global_invocation_id) id: vec3u) {
  let idx = id.x;
  if (idx >= arrayLength(&particlesIn)) { return; }
  let p = particlesIn[idx];
  particlesOut[idx].p = p.p;
  particlesOut[idx].v = p.v;
  particlesOut[idx].dv = vec2f(0.0, 0.0);
  particlesOut[idx].mass = p.mass;
  particlesOut[idx].dummy = p.dummy;
}

@compute @workgroup_size(256)
fn updateMain(@builtin(global_invocation_id) id: vec3u) {
  let idx = id.x;
  if (idx >= arrayLength(&particlesIn)) { return; }
  let particle = particlesIn[idx];
  if (particle.dummy >= 0.5) {
    particlesOut[idx] = particle;
    return;
  }
  let dt = 0.008;
  let gravity = vec2f(0.0, -0.0002);
  var p = particle.p;
  var v = particle.v + particle.dv + gravity;
  p += v * dt;
  v *= 0.99;
  particlesOut[idx].p = p;
  particlesOut[idx].v = v;
  particlesOut[idx].dv = vec2f(0.0, 0.0);
  particlesOut[idx].mass = particle.mass;
  particlesOut[idx].dummy = particle.dummy;
  if (idx == 20u) {
    particlesOut[idx].v += vec2f(0.0, -0.001);
  }
}

// Vertex: spring line (2 vertices per spring)
@vertex
fn springVertexMain(
  @location(0) seg: vec2f,
  @builtin(instance_index) idx: u32
) -> @builtin(position) vec4f {
  let s = springsIn[idx];
  let pa = particlesIn[u32(s.ptA)].p;
  let pb = particlesIn[u32(s.ptB)].p;
  let p = mix(pa, pb, seg.x);
  return vec4f(p, 0.0, 1.0);
}

@fragment
fn springFragmentMain() -> @location(0) vec4f {
  return vec4f(0.3, 0.3, 0.4, 1.0);
}

// Vertex: particle circle
@vertex
fn particleVertexMain(
  @location(0) corner: vec2f,
  @builtin(vertex_index) vIdx: u32,
  @builtin(instance_index) idx: u32
) -> @builtin(position) vec4f {
  let particle = particlesIn[idx].p;
  let size = 0.006;
  return vec4f(particle + corner * size, 0.0, 1.0);
}

@fragment
fn particleFragmentMain() -> @location(0) vec4f {
  return vec4f(1.0, 0.9, 0.5, 1.0);
}
