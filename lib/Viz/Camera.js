const PGA2D = {
  geometricProduct(a, b) {
    return [
      a[0] * b[0] - a[1] * b[1],
      a[0] * b[1] + a[1] * b[0],
      a[0] * b[2] + a[1] * b[3] + a[2] * b[0] - a[3] * b[1],
      a[0] * b[3] - a[1] * b[2] + a[2] * b[1] + a[3] * b[0]
    ];
  },
  reverse(a) {
    return [a[0], -a[1], -a[2], -a[3]];
  },
  normalizeMotor(m) {
    const n = Math.sqrt(m[0] * m[0] + m[1] * m[1] + m[2] * m[2] + m[3] * m[3]);
    if (n === 0) return [1, 0, 0, 0];
    return [m[0] / n, m[1] / n, m[2] / n, m[3] / n];
  },
  createTranslator(dx, dy) {
    return [1, 0, dx / 2, dy / 2];
  }
};

export default class Camera {
  constructor() {
    this._pose = new Float32Array([1, 0, 0, 0, 1, 1]);
  }

  updatePose(motor) {
    this._pose[0] = motor[0];
    this._pose[1] = motor[1];
    this._pose[2] = motor[2];
    this._pose[3] = motor[3];
  }

  moveLeft(d) {
    const dt = PGA2D.createTranslator(-d, 0);
    const newpose = PGA2D.normalizeMotor(PGA2D.geometricProduct(dt, [this._pose[0], this._pose[1], this._pose[2], this._pose[3]]));
    this.updatePose(newpose);
  }

  moveRight(d) {
    const dt = PGA2D.createTranslator(d, 0);
    const newpose = PGA2D.normalizeMotor(PGA2D.geometricProduct(dt, [this._pose[0], this._pose[1], this._pose[2], this._pose[3]]));
    this.updatePose(newpose);
  }

  moveUp(d) {
    const dt = PGA2D.createTranslator(0, d);
    const newpose = PGA2D.normalizeMotor(PGA2D.geometricProduct(dt, [this._pose[0], this._pose[1], this._pose[2], this._pose[3]]));
    this.updatePose(newpose);
  }

  moveDown(d) {
    const dt = PGA2D.createTranslator(0, -d);
    const newpose = PGA2D.normalizeMotor(PGA2D.geometricProduct(dt, [this._pose[0], this._pose[1], this._pose[2], this._pose[3]]));
    this.updatePose(newpose);
  }

  zoomIn() {
    this._pose[4] *= 1.1;
    this._pose[5] *= 1.1;
  }

  zoomOut() {
    this._pose[4] /= 1.1;
    this._pose[5] /= 1.1;
  }
}
