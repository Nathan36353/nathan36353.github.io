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

@group(0) @binding(0) var<uniform> pose: Pose;

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

@vertex
fn vertexMain(@location(0) pos: vec2f) -> @builtin(position) vec4f {
  let transformed = applyMotorToPoint(pos, pose.motor);
  let scaled = transformed * pose.scale;
  return vec4f(scaled, 0.0, 1.0);
}

@fragment
fn fragmentMain() -> @location(0) vec4f {
  return vec4f(238.0/255.0, 118.0/255.0, 35.0/255.0, 1.0);
}
