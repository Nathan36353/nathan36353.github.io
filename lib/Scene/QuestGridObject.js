import Camera2DVertexObject from "/lib/Scene/Camera2DVertexObject.js";

const GRID_SIZE = 256;
const MAX_TOGGLES = 64;

export default class QuestGridObject extends Camera2DVertexObject {
  constructor(device, canvasFormat, cameraPose, vertices, shaderFile, topology, numInstances) {
    super(device, canvasFormat, cameraPose, vertices, shaderFile, topology, numInstances);
    this._paused = false;
    this._updateIntervalMs = 150;
    this._toggleCount = 0;
    this._toggles = new Uint32Array(MAX_TOGGLES);
  }

  async createGeometry() {
    await super.createGeometry();
    this._cellStatus = new Uint32Array(GRID_SIZE * GRID_SIZE);
    this._randomize();
    this._cellStateBuffers = [
      this._device.createBuffer({
        label: "Quest Grid Buffer 1 " + this.getName(),
        size: this._cellStatus.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      }),
      this._device.createBuffer({
        label: "Quest Grid Buffer 2 " + this.getName(),
        size: this._cellStatus.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      })
    ];
    this._device.queue.writeBuffer(this._cellStateBuffers[0], 0, this._cellStatus);
    this._device.queue.writeBuffer(this._cellStateBuffers[1], 0, this._cellStatus);
    this._paramsBuffer = this._device.createBuffer({
      label: "Params " + this.getName(),
      size: 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    this._togglesBuffer = this._device.createBuffer({
      label: "Toggles " + this.getName(),
      size: MAX_TOGGLES * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });
    this._step = 0;
  }

  _randomize() {
    for (let i = 0; i < this._cellStatus.length; i++) {
      this._cellStatus[i] = Math.random() > 0.5 ? 1 : 0;
    }
  }

  reset() {
    this._randomize();
    this._device.queue.writeBuffer(this._cellStateBuffers[0], 0, this._cellStatus);
    this._device.queue.writeBuffer(this._cellStateBuffers[1], 0, this._cellStatus);
  }

  setPaused(paused) {
    this._paused = paused;
  }

  setSpeed(deltaMs) {
    this._updateIntervalMs = Math.max(50, Math.min(500, this._updateIntervalMs + deltaMs));
  }

  addToggle(u, v) {
    if (u < 0 || u >= GRID_SIZE || v < 0 || v >= GRID_SIZE) return false;
    if (this._toggleCount >= MAX_TOGGLES) return false;
    this._toggles[this._toggleCount++] = v * GRID_SIZE + u;
    return true;
  }

  async createRenderPipeline() {
    this._bindGroupLayout = this._device.createBindGroupLayout({
      label: "Quest Grid Bind Group Layout " + this.getName(),
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: {} },
        { binding: 1, visibility: GPUShaderStage.VERTEX | GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: {} },
        { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } }
      ]
    });
    this._pipelineLayout = this._device.createPipelineLayout({
      label: "Quest Grid Pipeline Layout",
      bindGroupLayouts: [this._bindGroupLayout]
    });
    this._renderPipeline = this._device.createRenderPipeline({
      label: "Quest Grid Render Pipeline " + this.getName(),
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
    this._createBindGroups();
  }

  _createBindGroups() {
    this._bindGroups = [
      this._device.createBindGroup({
        label: "Quest Grid Bind Group 1 " + this.getName(),
        layout: this._bindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: this._cameraPoseBuffer } },
          { binding: 1, resource: { buffer: this._cellStateBuffers[0] } },
          { binding: 2, resource: { buffer: this._cellStateBuffers[1] } },
          { binding: 3, resource: { buffer: this._paramsBuffer } },
          { binding: 4, resource: { buffer: this._togglesBuffer } }
        ]
      }),
      this._device.createBindGroup({
        label: "Quest Grid Bind Group 2 " + this.getName(),
        layout: this._bindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: this._cameraPoseBuffer } },
          { binding: 1, resource: { buffer: this._cellStateBuffers[1] } },
          { binding: 2, resource: { buffer: this._cellStateBuffers[0] } },
          { binding: 3, resource: { buffer: this._paramsBuffer } },
          { binding: 4, resource: { buffer: this._togglesBuffer } }
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
      label: "Quest Grid update pipeline " + this.getName(),
      layout: this._pipelineLayout,
      compute: {
        module: this._shaderModule,
        entryPoint: "computeMain"
      }
    });
  }

  compute(pass) {
    if (this._paused) return;
    const now = performance.now();
    this._lastComputeTime = this._lastComputeTime ?? now;
    if (now - this._lastComputeTime < this._updateIntervalMs) return;
    this._lastComputeTime = now;
    const paramsView = new Uint32Array([this._toggleCount]);
    this._device.queue.writeBuffer(this._paramsBuffer, 0, paramsView);
    this._device.queue.writeBuffer(this._togglesBuffer, 0, this._toggles);
    pass.setPipeline(this._computePipeline);
    pass.setBindGroup(0, this._bindGroups[this._step % 2]);
    pass.dispatchWorkgroups(Math.ceil(GRID_SIZE / 8), Math.ceil(GRID_SIZE / 8));
    this._toggleCount = 0;
    ++this._step;
  }
}

export { GRID_SIZE };
