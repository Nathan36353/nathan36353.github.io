import Camera2DVertexObject from "./Camera2DVertexObject.js";

const GRID_SIZE = 10;

export default class GridObject extends Camera2DVertexObject {
  constructor(device, canvasFormat, cameraPose, vertices, shaderFile, topology, numInstances) {
    super(device, canvasFormat, cameraPose, vertices, shaderFile, topology, numInstances);
  }

  async createGeometry() {
    await super.createGeometry();
    this._cellStatus = new Uint32Array(GRID_SIZE * GRID_SIZE);
    for (let i = 0; i < this._cellStatus.length; i++) {
      this._cellStatus[i] = Math.random() > 0.5 ? 1 : 0;
    }
    this._cellStateBuffers = [
      this._device.createBuffer({
        label: "Grid status Buffer 1 " + this.getName(),
        size: this._cellStatus.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      }),
      this._device.createBuffer({
        label: "Grid status Buffer 2 " + this.getName(),
        size: this._cellStatus.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      })
    ];
    this._device.queue.writeBuffer(this._cellStateBuffers[0], 0, this._cellStatus);
    this._device.queue.writeBuffer(this._cellStateBuffers[1], 0, this._cellStatus);
    this._step = 0;
  }

  async createRenderPipeline() {
    this._bindGroupLayout = this._device.createBindGroupLayout({
      label: "Grid Bind Group Layout " + this.getName(),
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: {} },
        { binding: 1, visibility: GPUShaderStage.VERTEX | GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } }
      ]
    });
    this._pipelineLayout = this._device.createPipelineLayout({
      label: "Grid Pipeline Layout",
      bindGroupLayouts: [this._bindGroupLayout]
    });
    this._renderPipeline = this._device.createRenderPipeline({
      label: "Grid Render Pipeline " + this.getName(),
      layout: this._pipelineLayout,
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
    this._bindGroups = [
      this._device.createBindGroup({
        label: "Grid Bind Group 1 " + this.getName(),
        layout: this._bindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: this._cameraPoseBuffer } },
          { binding: 1, resource: { buffer: this._cellStateBuffers[0] } },
          { binding: 2, resource: { buffer: this._cellStateBuffers[1] } }
        ]
      }),
      this._device.createBindGroup({
        label: "Grid Bind Group 2 " + this.getName(),
        layout: this._bindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: this._cameraPoseBuffer } },
          { binding: 1, resource: { buffer: this._cellStateBuffers[1] } },
          { binding: 2, resource: { buffer: this._cellStateBuffers[0] } }
        ]
      })
    ];
  }

  render(pass) {
    pass.setPipeline(this._renderPipeline);
    pass.setVertexBuffer(0, this._vertexBuffer);
    pass.setBindGroup(0, this._bindGroups[this._step % 2]);
    pass.draw(this._vertices.length / 2, this._numInstances);
  }

  async createComputePipeline() {
    this._computePipeline = this._device.createComputePipeline({
      label: "Grid update pipeline " + this.getName(),
      layout: this._pipelineLayout,
      compute: {
        module: this._shaderModule,
        entryPoint: "computeMain"
      }
    });
  }

  compute(pass) {
    const now = performance.now();
    this._lastComputeTime = this._lastComputeTime ?? now;
    if (now - this._lastComputeTime < 300) return;
    this._lastComputeTime = now;
    pass.setPipeline(this._computePipeline);
    pass.setBindGroup(0, this._bindGroups[this._step % 2]);
    pass.dispatchWorkgroups(Math.ceil(GRID_SIZE / 4), Math.ceil(GRID_SIZE / 4));
    ++this._step;
  }
}
