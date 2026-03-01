import SceneObject from "./SceneObject.js";

const FLOATS_PER_PARTICLE = 9; // p(2), ip(2), v(2), iv(2), life(1)

export default class FlameParticleObject extends SceneObject {
  constructor(device, canvasFormat, shaderFile, numParticles = 4096) {
    super(device, canvasFormat, shaderFile);
    this._numParticles = numParticles;
    this._step = 0;
  }

  resetParticles() {
    for (let i = 0; i < this._numParticles; i++) {
      const x = (Math.random() - 0.5) * 0.18;
      const y = -0.88;
      const vx = (Math.random() - 0.5) * 0.001;
      const vy = 0.005 + Math.random() * 0.004;
      const life = 0.3 + Math.random() * 0.7;
      const base = i * FLOATS_PER_PARTICLE;
      this._particles[base + 0] = x;
      this._particles[base + 1] = y;
      this._particles[base + 2] = x;
      this._particles[base + 3] = y;
      this._particles[base + 4] = vx;
      this._particles[base + 5] = vy;
      this._particles[base + 6] = vx;
      this._particles[base + 7] = vy;
      this._particles[base + 8] = life;
    }
  }

  async createGeometry() {
    this._particles = new Float32Array(this._numParticles * FLOATS_PER_PARTICLE);
    this.resetParticles();

    const quadVerts = new Float32Array([
      0, 0,
      1, 0, 0.707, 0.707, 0, 1, -0.707, 0.707, -1, 0, -0.707, -0.707, 0, -1, 0.707, -0.707
    ]);
    const quadIndices = new Uint16Array([
      0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 5, 0, 5, 6, 0, 6, 7, 0, 7, 8, 0, 8, 1
    ]);

    this._vertexBuffer = this._device.createBuffer({
      label: "Flame quad vertices " + this.getName(),
      size: quadVerts.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });
    this._device.queue.writeBuffer(this._vertexBuffer, 0, quadVerts);

    this._indexBuffer = this._device.createBuffer({
      label: "Flame quad indices " + this.getName(),
      size: quadIndices.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
    });
    this._device.queue.writeBuffer(this._indexBuffer, 0, quadIndices);

    const bufferSize = this._particles.byteLength;
    this._particleBuffers = [
      this._device.createBuffer({
        label: "Flame particles 1 " + this.getName(),
        size: bufferSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      }),
      this._device.createBuffer({
        label: "Flame particles 2 " + this.getName(),
        size: bufferSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      })
    ];
    this._device.queue.writeBuffer(this._particleBuffers[0], 0, this._particles);
    this._device.queue.writeBuffer(this._particleBuffers[1], 0, this._particles);
  }

  async createRenderPipeline() {
    this._bindGroupLayout = this._device.createBindGroupLayout({
      label: "Flame Bind Group Layout " + this.getName(),
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } }
      ]
    });
    this._pipelineLayout = this._device.createPipelineLayout({
      label: "Flame Pipeline Layout",
      bindGroupLayouts: [this._bindGroupLayout]
    });
    this._bindGroups = [
      this._device.createBindGroup({
        label: "Flame Bind 1 " + this.getName(),
        layout: this._bindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: this._particleBuffers[0] } },
          { binding: 1, resource: { buffer: this._particleBuffers[1] } }
        ]
      }),
      this._device.createBindGroup({
        label: "Flame Bind 2 " + this.getName(),
        layout: this._bindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: this._particleBuffers[1] } },
          { binding: 1, resource: { buffer: this._particleBuffers[0] } }
        ]
      })
    ];
    this._renderPipeline = this._device.createRenderPipeline({
      label: "Flame Render " + this.getName(),
      layout: this._pipelineLayout,
      vertex: {
        module: this._shaderModule,
        entryPoint: "vertexMain",
        buffers: [{
          arrayStride: 8,
          attributes: [{ shaderLocation: 0, format: "float32x2", offset: 0 }]
        }]
      },
      fragment: {
        module: this._shaderModule,
        entryPoint: "fragmentMain",
        targets: [{
          format: this._canvasFormat,
          blend: {
            color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" },
            alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" }
          }
        }]
      },
      primitive: { topology: "triangle-list" }
    });
  }

  render(pass) {
    pass.setPipeline(this._renderPipeline);
    pass.setVertexBuffer(0, this._vertexBuffer);
    pass.setIndexBuffer(this._indexBuffer, "uint16");
    pass.setBindGroup(0, this._bindGroups[this._step % 2]);
    pass.drawIndexed(24, this._numParticles);
  }

  async createComputePipeline() {
    this._computePipeline = this._device.createComputePipeline({
      label: "Flame Compute " + this.getName(),
      layout: this._pipelineLayout,
      compute: {
        module: this._shaderModule,
        entryPoint: "computeMain"
      }
    });
  }

  compute(pass) {
    pass.setPipeline(this._computePipeline);
    pass.setBindGroup(0, this._bindGroups[this._step % 2]);
    pass.dispatchWorkgroups(Math.ceil(this._numParticles / 64), 1, 1);
    ++this._step;
  }
}
