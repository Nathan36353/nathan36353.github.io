import SceneObject from "/lib/Scene/SceneObject.js";

export default class Camera2DVertexObject extends SceneObject {
  constructor(device, canvasFormat, cameraPose, vertices, shaderFile, topology, numInstances = 1) {
    super(device, canvasFormat, shaderFile);
    this._cameraPose = cameraPose;
    this._vertices = vertices;
    this._topology = topology;
    this._numInstances = numInstances;
  }

  async createGeometry() {
    this._vertexBuffer = this._device.createBuffer({
      label: "Vertices " + this.getName(),
      size: this._vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });
    this._device.queue.writeBuffer(this._vertexBuffer, 0, this._vertices);
    this._vertexBufferLayout = {
      arrayStride: 2 * Float32Array.BYTES_PER_ELEMENT,
      attributes: [{ shaderLocation: 0, format: "float32x2", offset: 0 }]
    };
    this._cameraPoseBuffer = this._device.createBuffer({
      label: "Camera Pose " + this.getName(),
      size: this._cameraPose.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    this.updateCameraPose();
  }

  updateGeometry() {}

  updateCameraPose() {
    if (this._cameraPoseBuffer)
      this._device.queue.writeBuffer(this._cameraPoseBuffer, 0, this._cameraPose);
  }

  async createRenderPipeline() {
    this._renderPipeline = this._device.createRenderPipeline({
      label: "Render Pipeline " + this.getName(),
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
      primitive: { topology: this._topology }
    });
    this._bindGroup = this._device.createBindGroup({
      label: "Renderer Bind Group " + this.getName(),
      layout: this._renderPipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: this._cameraPoseBuffer } }]
    });
  }

  render(pass) {
    pass.setPipeline(this._renderPipeline);
    pass.setVertexBuffer(0, this._vertexBuffer);
    pass.setBindGroup(0, this._bindGroup);
    pass.draw(this._vertices.length / 2, this._numInstances);
  }

  async createComputePipeline() {}
  compute(pass) {}
}
