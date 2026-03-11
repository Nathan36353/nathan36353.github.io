export default class PolygonIO {
  static load(path) {
    return new Promise((resolve, reject) => {
      const xhttp = new XMLHttpRequest();
      xhttp.open("GET", path);
      xhttp.setRequestHeader("Cache-Control", "no-cache, no-store, max-age=0");
      xhttp.onload = function () {
        if (xhttp.readyState === XMLHttpRequest.DONE && xhttp.status === 200) {
          const lines = xhttp.responseText.split(/\r?\n/);
          const vertices = [];
          for (const raw of lines) {
            const line = raw.trim();
            if (!line || line.startsWith("#")) continue;
            const parts = line.split(/\s+/);
            if (parts.length < 2) continue;
            const x = parseFloat(parts[0]);
            const y = parseFloat(parts[1]);
            if (!Number.isNaN(x) && !Number.isNaN(y)) {
              vertices.push([x, y]);
            }
          }
          resolve(vertices);
        } else {
          reject({ status: xhttp.status, statusText: xhttp.statusText });
        }
      };
      xhttp.onerror = function () {
        reject({ status: xhttp.status, statusText: xhttp.statusText });
      };
      xhttp.send();
    });
  }
}

