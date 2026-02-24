import SceneObject from "./SceneObject.js";

function makeEllipseVertices(a, b, segments) {
  const v = [];
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    v.push(a * Math.cos(t), b * Math.sin(t));
  }
  return new Float32Array(v);
}

export default class OrbitPathObject extends SceneObject {
  constructor(device, canvasFormat, radiusOrA, b, shaderFile = "./lib/Shaders/solidColor.wgsl") {
    super(device, canvasFormat, shaderFile);
    this._b = b ?? radiusOrA;
    this._a = radiusOrA;
    this._vertices = makeEllipseVertices(this._a, this._b, 64);
    this._color = new Float32Array([0.3, 0.35, 0.4, 0.6]);
  }

  setColor(r, g, b, a) {
    this._color[0] = r;
    this._color[1] = g;
    this._color[2] = b;
    this._color[3] = a ?? 1;
  }

  async createGeometry() {
    this._vertexBuffer = this._device.createBuffer({
      label: "Orbit " + this.getName(),
      size: this._vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });
    this._device.queue.writeBuffer(this._vertexBuffer, 0, this._vertices);
    this._vertexBufferLayout = {
      arrayStride: 8,
      attributes: [{ shaderLocation: 0, format: "float32x2", offset: 0 }]
    };
    this._colorBuffer = this._device.createBuffer({
      label: "Color " + this.getName(),
      size: this._color.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    this.updateGeometry();
  }

  updateGeometry() {
    if (this._colorBuffer)
      this._device.queue.writeBuffer(this._colorBuffer, 0, this._color);
  }

  async createRenderPipeline() {
    this._renderPipeline = this._device.createRenderPipeline({
      label: "Orbit " + this.getName(),
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
      primitive: { topology: "line-strip" }
    });
    this._bindGroup = this._device.createBindGroup({
      layout: this._renderPipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: this._colorBuffer } }]
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
