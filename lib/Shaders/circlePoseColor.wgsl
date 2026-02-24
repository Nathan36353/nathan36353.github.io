struct Pose {
  rotor: vec2f,
  translator: vec2f,
  scale: vec2f,
  r_center: vec2f
}

struct PoseAndColor {
  pose: Pose,
  color: vec4f
}

@group(0) @binding(0) var<uniform> u: PoseAndColor;

fn geometricProduct(a: vec4f, b: vec4f) -> vec4f {
  return vec4f(
    a[0]*b[0]+a[1]*b[1]+a[2]*b[2]-a[3]*b[3],
    a[0]*b[1]+a[1]*b[0]-a[2]*b[3]+a[3]*b[2],
    a[0]*b[2]+a[1]*b[3]+a[2]*b[0]-a[3]*b[1],
    a[0]*b[3]+a[1]*b[2]-a[2]*b[1]+a[3]*b[0]
  );
}

fn reverse(a: vec4f) -> vec4f { return vec4f(a[0],a[1],a[2],-a[3]); }

fn applyRotorToPoint(p: vec2f, r: vec2f) -> vec2f {
  let rot = geometricProduct(vec4f(r[0],0.0,0.0,r[1]), geometricProduct(vec4f(0.0,p[0],p[1],0.0), reverse(vec4f(r[0],0.0,0.0,r[1]))));
  return vec2f(rot[1], rot[2]);
}

@vertex
fn vertexMain(@location(0) pos: vec2f) -> @builtin(position) vec4f {
  let p = u.pose;
  let rotated = applyRotorToPoint(pos - p.r_center, p.rotor) + p.r_center;
  let scaled = rotated * p.scale;
  let transformed = scaled + p.translator;
  return vec4f(transformed, 0.0, 1.0);
}

@fragment
fn fragmentMain() -> @location(0) vec4f {
  return u.color;
}
