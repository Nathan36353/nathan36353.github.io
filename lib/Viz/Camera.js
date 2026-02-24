import PGA2D from "../PGA2D.js";

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
    this._pose[4] = Math.min(8, this._pose[4] * 1.1);
    this._pose[5] = Math.min(8, this._pose[5] * 1.1);
  }

  zoomOut() {
    this._pose[4] = Math.max(0.5, this._pose[4] / 1.1);
    this._pose[5] = Math.max(0.5, this._pose[5] / 1.1);
  }
}
