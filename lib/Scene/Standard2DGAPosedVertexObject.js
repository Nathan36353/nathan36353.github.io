import Standard2DVertexObject from "./Standard2DVertexObject.js";

export default class Standard2DGAPosedVertexObject extends Standard2DVertexObject {
  constructor(device, canvasFormat, vertices, pose, shaderFile, topology) {
    super(device, canvasFormat, vertices, shaderFile, topology);
    this._pose = pose;
  }

  async createGeometry() {
    await super.createGeometry();
    this._poseBuffer = this._device.createBuffer({
      label: "Pose " + this.getName(),
      size: this._pose.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    this.updateGeometry();
  }

  updateGeometry() {
    if (this._poseBuffer) {
      this._device.queue.writeBuffer(this._poseBuffer, 0, this._pose);
    }
  }

  async createRenderPipeline() {
    await super.createRenderPipeline();
    this._bindGroup = this._device.createBindGroup({
      label: "Render Bind Group " + this.getName(),
      layout: this._renderPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this._poseBuffer } }
      ]
    });
  }

  render(pass) {
    pass.setBindGroup(0, this._bindGroup);
    super.render(pass);
  }
}
