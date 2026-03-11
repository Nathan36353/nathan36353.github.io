import Standard2DVertexObject from "./Standard2DVertexObject.js";
import Polygon from "../DS/Polygon.js";

export default class PolygonObject extends Standard2DVertexObject {
  constructor(device, canvasFormat, polygon) {
    const vertices = polygon.vertexData;
    super(device, canvasFormat, vertices, "./lib/Shaders/standard2d.wgsl", "line-strip");
    this._polygon = polygon;
  }

  static async create(device, canvasFormat, path) {
    const poly = await Polygon.load(path);
    return new PolygonObject(device, canvasFormat, poly);
  }

  get polygon() {
    return this._polygon;
  }
}

