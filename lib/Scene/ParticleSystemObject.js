import SceneObject from "/lib/Scene/SceneObject.js";

export default class ParticleSystemObject extends SceneObject {
  constructor(device, canvasFormat, shaderFile, numParticles = 1024) {
    super(device, canvasFormat, shaderFile);
    this._numParticles = numParticles;
    this._step = 0;
  }

  resetParticles() {
    for (let i = 0; i < this._numParticles; i++) {
      const x = (Math.random() - 0.5) * 2;
      const y = (Math.random() - 0.5) * 2;
      const vx = (Math.random() - 0.5) * 0.01;
      const vy = (Math.random() - 0.5) * 0.01;
      this._particles[i * 8 + 0] = x;
      this._particles[i * 8 + 1] = y;
      this._particles[i * 8 + 2] = x;
      this._particles[i * 8 + 3] = y;
      this._particles[i * 8 + 4] = vx;
      this._particles[i * 8 + 5] = vy;
      this._particles[i * 8 + 6] = vx;
      this._particles[i * 8 + 7] = vy;
    }
  }

  async createGeometry() {
    this._particles = new Float32Array(this._numParticles * 8);
    this.resetParticles();

    const circleVertices = new Float32Array(9 * 2);
    for (let i = 0; i < 9; i++) {
      circleVertices[i * 2] = i;
      circleVertices[i * 2 + 1] = 0;
    }

    this._vertexBuffer = this._device.createBuffer({
      label: "Circle vertices " + this.getName(),
      size: circleVertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });
    this._device.queue.writeBuffer(this._vertexBuffer, 0, circleVertices);

    this._particleBuffers = [
      this._device.createBuffer({
        label: "Particles 1 " + this.getName(),
        size: this._particles.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      }),
      this._device.createBuffer({
        label: "Particles 2 " + this.getName(),
        size: this._particles.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      })
    ];
    this._device.queue.writeBuffer(this._particleBuffers[0], 0, this._particles);
    this._device.queue.writeBuffer(this._particleBuffers[1], 0, this._particles);
  }

  async createRenderPipeline() {
    this._bindGroupLayout = this._device.createBindGroupLayout({
      label: "Particle Bind Group Layout " + this.getName(),
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } }
      ]
    });
    this._pipelineLayout = this._device.createPipelineLayout({
      label: "Particle Pipeline Layout",
      bindGroupLayouts: [this._bindGroupLayout]
    });
    this._bindGroups = [
      this._device.createBindGroup({
        label: "Particle Bind 1 " + this.getName(),
        layout: this._bindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: this._particleBuffers[0] } },
          { binding: 1, resource: { buffer: this._particleBuffers[1] } }
        ]
      }),
      this._device.createBindGroup({
        label: "Particle Bind 2 " + this.getName(),
        layout: this._bindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: this._particleBuffers[1] } },
          { binding: 1, resource: { buffer: this._particleBuffers[0] } }
        ]
      })
    ];
    this._renderPipeline = this._device.createRenderPipeline({
      label: "Particle Render " + this.getName(),
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
        targets: [{ format: this._canvasFormat }]
      },
      primitive: { topology: "line-strip" }
    });
  }

  render(pass) {
    pass.setPipeline(this._renderPipeline);
    pass.setVertexBuffer(0, this._vertexBuffer);
    pass.setBindGroup(0, this._bindGroups[this._step % 2]);
    pass.draw(9, this._numParticles);
  }

  async createComputePipeline() {
    this._computePipeline = this._device.createComputePipeline({
      label: "Particle Compute " + this.getName(),
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
