import ImageFilterObject from "./ImageFilterObject.js";

export default class ImageNosifyFilterObject extends ImageFilterObject {
  async createGeometry() {
    this.updateGeometry();
  }

  updateGeometry() {
    if (this._imgWidth && this._imgHeight) {
      this._randomArray = new Float32Array(this._imgWidth * this._imgHeight);
      this._randomBuffer = this._device.createBuffer({
        label: "Random Buffer " + this.getName(),
        size: this._randomArray.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      });
      for (let i = 0; i < this._imgWidth * this._imgHeight; ++i) {
        this._randomArray[i] = Math.random() * 2 - 1;
      }
      this._device.queue.writeBuffer(this._randomBuffer, 0, this._randomArray);
    }
  }

  createBindGroup(inTexture, outTexture) {
    this._imgWidth = inTexture.width;
    this._imgHeight = inTexture.height;
    this.updateGeometry();

    this._bindGroup = this._device.createBindGroup({
      label: "Image Filter Bind Group",
      layout: this._computePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: inTexture.createView() },
        { binding: 1, resource: outTexture.createView() },
        { binding: 2, resource: { buffer: this._randomBuffer } }
      ]
    });
    this._wgWidth = Math.ceil(inTexture.width / 8);
    this._wgHeight = Math.ceil(inTexture.height / 8);
  }
}
