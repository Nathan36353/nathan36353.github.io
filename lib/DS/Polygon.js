import PolygonIO from "../IO/PolygonIO.js";

export default class Polygon {
  constructor(vertices) {
    // vertices: Array<[x, y]>, may include duplicate last = first
    this._rawVertices = vertices.slice();
    this._vertices = this._normalize(vertices);
  }

  static async load(path) {
    const verts = await PolygonIO.load(path);
    return new Polygon(verts);
  }

  _normalize(vertices) {
    if (vertices.length < 3) {
      return new Float32Array(0);
    }
    const n = vertices.length;
    const lastIdx = (vertices[0][0] === vertices[n - 1][0] && vertices[0][1] === vertices[n - 1][1])
      ? n - 1
      : n;
    let area2 = 0;
    let cx = 0;
    let cy = 0;
    for (let i = 0; i < lastIdx; i++) {
      const [x0, y0] = vertices[i];
      const [x1, y1] = vertices[(i + 1) % lastIdx];
      const cross = x0 * y1 - x1 * y0;
      area2 += cross;
      cx += (x0 + x1) * cross;
      cy += (y0 + y1) * cross;
    }
    const area = area2 / 2;
    const sign = area >= 0 ? 1 : -1;
    const absArea = Math.abs(area) || 1;
    const scale = 1 / Math.sqrt(absArea);
    cx = cx / (3 * area2 || 1);
    cy = cy / (3 * area2 || 1);

    const out = [];
    for (let i = 0; i < lastIdx; i++) {
      const [x, y] = vertices[i];
      const nx = (x - cx) * scale * sign;
      const ny = (y - cy) * scale * sign;
      out.push(nx, ny);
    }
    // close the loop
    out.push(out[0], out[1]);
    return new Float32Array(out);
  }

  get vertexData() {
    return this._vertices;
  }

  get vertexCount() {
    return this._vertices.length / 2;
  }

  get edgeCount() {
    return Math.max(0, this.vertexCount - 1);
  }

  isInsideConvex(point) {
    const px = point[0];
    const py = point[1];
    const v = this._vertices;
    const n = this.vertexCount - 1;
    if (n < 3) return false;
    for (let i = 0; i < n; i++) {
      const x0 = v[2 * i];
      const y0 = v[2 * i + 1];
      const x1 = v[2 * ((i + 1) % n)];
      const y1 = v[2 * ((i + 1) % n) + 1];
      const cross = (x1 - x0) * (py - y0) - (y1 - y0) * (px - x0);
      if (cross < 0) return false;
    }
    return true;
  }

  isInsideWinding(point) {
    const px = point[0];
    const py = point[1];
    const v = this._vertices;
    const n = this.vertexCount;
    let wn = 0;
    for (let i = 0; i < n - 1; i++) {
      const x0 = v[2 * i];
      const y0 = v[2 * i + 1];
      const x1 = v[2 * (i + 1)];
      const y1 = v[2 * (i + 1) + 1];
      if (y0 <= py) {
        if (y1 > py) {
          const isLeft = (x1 - x0) * (py - y0) - (y1 - y0) * (px - x0);
          if (isLeft > 0) wn++;
        }
      } else {
        if (y1 <= py) {
          const isLeft = (x1 - x0) * (py - y0) - (y1 - y0) * (px - x0);
          if (isLeft < 0) wn--;
        }
      }
    }
    return wn !== 0;
  }
}

