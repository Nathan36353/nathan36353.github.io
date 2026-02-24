import SceneObject from "./SceneObject.js";

function makeCircleVertices(segments) {
  const v = [];
  for (let i = 0; i < segments; i++) {
    const t0 = (i / segments) * Math.PI * 2;
    const t1 = ((i + 1) / segments) * Math.PI * 2;
    v.push(0, 0, Math.cos(t0), Math.sin(t0), Math.cos(t1), Math.sin(t1));
  }
  return new Float32Array(v);
}

export default class PosedCircleObject extends SceneObject {
  constructor(device, canvasFormat, radius, colorR, colorG, colorB, shaderFile = "./lib/Shaders/circlePoseColor.wgsl") {
    super(device, canvasFormat, shaderFile);
    this._radius = radius;
    this._segments = 32;
    this._vertices = makeCircleVertices(this._segments);
    this._uniform = new Float32Array(12);
    this.setPose(1, 0, 0, 0, radius, radius, 0, 0);
    this.setColor(colorR, colorG, colorB, 1);
  }

  setPose(rotorC, rotorS, tx, ty, scaleX, scaleY, rcx, rcy) {
    this._uniform[0] = rotorC;
    this._uniform[1] = rotorS;
    this._uniform[2] = tx;
    this._uniform[3] = ty;
    this._uniform[4] = scaleX;
    this._uniform[5] = scaleY;
    this._uniform[6] = rcx ?? 0;
    this._uniform[7] = rcy ?? 0;
  }

  setColor(r, g, b, a = 1) {
    this._uniform[8] = r;
    this._uniform[9] = g;
    this._uniform[10] = b;
    this._uniform[11] = a;
  }

  setTranslation(tx, ty) {
    this._uniform[2] = tx;
    this._uniform[3] = ty;
  }

  setRotation(angle) {
    this._uniform[0] = Math.cos(angle);
    this._uniform[1] = -Math.sin(angle);
  }

  setScale(sx, sy) {
    this._uniform[4] = sx;
    this._uniform[5] = sy ?? sx;
  }

  async createGeometry() {
    this._vertexBuffer = this._device.createBuffer({
      label: "Circle " + this.getName(),
      size: this._vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });
    this._device.queue.writeBuffer(this._vertexBuffer, 0, this._vertices);
    this._vertexBufferLayout = {
      arrayStride: 8,
      attributes: [{ shaderLocation: 0, format: "float32x2", offset: 0 }]
    };
    this._uniformBuffer = this._device.createBuffer({
      label: "Uniform " + this.getName(),
      size: this._uniform.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    this.updateGeometry();
  }

  updateGeometry() {
    if (this._uniformBuffer)
      this._device.queue.writeBuffer(this._uniformBuffer, 0, this._uniform);
  }

  async createRenderPipeline() {
    this._renderPipeline = this._device.createRenderPipeline({
      label: "Circle " + this.getName(),
      layout: "auto",
      vertex: {
        module: this._shaderModule,
        entryPoint: "vertexMain",
        buffers: [this._vertexBufferLayout]
      },
      fragment: {
        module: this._shaderModule,
        entryPoint: "fragmentMain",
        targets: [{ format: this._canvasFormat }]
      },
      primitive: { topology: "triangle-list" }
    });
    this._bindGroup = this._device.createBindGroup({
      layout: this._renderPipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: this._uniformBuffer } }]
    });
  }

  render(pass) {
    pass.setPipeline(this._renderPipeline);
    pass.setBindGroup(0, this._bindGroup);
    pass.setVertexBuffer(0, this._vertexBuffer);
    pass.draw(this._vertices.length / 2, 1, 0, 0);
  }

  async createComputePipeline() {}
  compute(pass) {}
}
