import Standard2DVertexObject from "./Standard2DVertexObject.js";

export default class Triangle2 extends Standard2DVertexObject {
  constructor(device, canvasFormat) {
    const vertices = new Float32Array([
      0, 0.5,
      -0.5, 0,
      0.5, 0,
      0, 0.5
    ]);
    super(device, canvasFormat, vertices, './lib/Shaders/standard2d.wgsl', 'line-strip');
    this._vertices = vertices;
  }
}
