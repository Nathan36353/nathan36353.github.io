export default class StandardTextObject {
  constructor(inputText, spacing = 5, textFont = "18px Arial") {
    this._textFont = textFont;
    this._lineSpacing = spacing;
    this._textCanvas = document.createElement("canvas");
    this._textContext = this._textCanvas.getContext("2d");
    this.updateTextRegion(inputText);
    this.updateText(inputText);
    this._textCanvas.style.position = "absolute";
    this._textCanvas.style.top = "10px";
    this._textCanvas.style.left = "10px";
    this._textCanvas.style.border = "1px solid red";
    document.body.appendChild(this._textCanvas);
  }

  updateTextRegion(newText) {
    this._textContext.font = this._textFont;
    this._lines = newText.split("\n");
    this._width = Math.max(...this._lines.map((line) => this._textContext.measureText(line).width));
    const match = this._textFont.match(/(\d+)px/);
    if (match) {
      this._fontSize = parseInt(match[1], 10);
    } else {
      this._fontSize = 18;
      this._textFont = "18px Arial";
    }
    this._height = this._lines.length * (this._fontSize + this._lineSpacing);
    this._paddingx = 5;
    this._paddingtop = 3;
    this._canvasWidth = Math.ceil(this._width + this._paddingx * 2);
    this._canvasHeight = Math.ceil(this._height + this._paddingtop);
    this._textCanvas.width = this._canvasWidth;
    this._textCanvas.height = this._canvasHeight;
    this._textContext.font = this._textFont;
    this._textContext.textBaseline = "top";
  }

  updateText(newText) {
    this._lines = newText.split("\n");
    this._textContext.fillStyle = "rgba(1, 1, 1, 0.5)";
    this._textContext.clearRect(0, 0, this._canvasWidth, this._canvasHeight);
    this._textContext.fillRect(0, 0, this._canvasWidth, this._canvasHeight);
    this._textContext.fillStyle = "white";
    this._lines.forEach((line, idx) => {
      const x = this._paddingx;
      const y = this._paddingtop + idx * (this._fontSize + this._lineSpacing);
      this._textContext.fillText(line, x, y);
    });
  }

  toggleVisibility() {
    this._textCanvas.hidden = !this._textCanvas.hidden;
  }
}
