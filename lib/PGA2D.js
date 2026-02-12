function geometricProduct(a, b) {
  return [
    a[0] * b[0] - a[1] * b[1],
    a[0] * b[1] + a[1] * b[0],
    a[0] * b[2] + a[1] * b[3] + a[2] * b[0] - a[3] * b[1],
    a[0] * b[3] - a[1] * b[2] + a[2] * b[1] + a[3] * b[0]
  ];
}

function reverse(a) {
  return [a[0], -a[1], -a[2], -a[3]];
}

function createPoint(p) {
  return [0, 1, p[1], -p[0]];
}

function extractPoint(m) {
  return [-m[3] / m[1], m[2] / m[1]];
}

function applyMotor(pMultivector, m) {
  const rev = reverse(m);
  const pRev = geometricProduct(pMultivector, rev);
  return geometricProduct(m, pRev);
}

export function applyMotorToPoint(p, motor) {
  const pt = createPoint(p);
  const transformed = applyMotor(pt, motor);
  return extractPoint(transformed);
}

export function normalizeMotor(m) {
  const n = Math.sqrt(m[0] * m[0] + m[1] * m[1] + m[2] * m[2] + m[3] * m[3]);
  if (n === 0) return [1, 0, 0, 0];
  return [m[0] / n, m[1] / n, m[2] / n, m[3] / n];
}

export function createTranslator(dx, dy) {
  return [1, 0, dx / 2, dy / 2];
}

export default {
  geometricProduct,
  reverse,
  createTranslator,
  normalizeMotor,
  applyMotorToPoint
};
