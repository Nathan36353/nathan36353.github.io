import Standard2DVertexObject from "/lib/Scene/Standard2DVertexObject.js";

export default class Triangle1 extends Standard2DVertexObject {
  constructor(device, canvasFormat) {
    const vertices = new Float32Array([
      0, 0.5,
      -0.5, 0,
      0.5, 0
    ]);
    super(device, canvasFormat, vertices, '/lib/Shaders/standard2d.wgsl', 'triangle-list');
    this._vertices = vertices;
  }
}
