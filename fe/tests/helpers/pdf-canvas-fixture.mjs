import { encode } from "fast-png";

const identity = () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
function multiply(left, right) {
  return {
    a: left.a * right.a + left.c * right.b, b: left.b * right.a + left.d * right.b,
    c: left.a * right.c + left.c * right.d, d: left.b * right.c + left.d * right.d,
    e: left.a * right.e + left.c * right.f + left.e, f: left.b * right.e + left.d * right.f + left.f,
  };
}

/** Small deterministic Canvas substitute for PDF commands; never substitutes jsPDF. */
export function createCanvasDocument() {
  const canvases = [];
  const encodes = [];
  const images = [];
  const document = {
    fonts: { ready: Promise.resolve() },
    createElement(tag) {
      if (tag !== "canvas") throw new Error(`Unexpected element ${tag}`);
      const canvas = {
        width: 1, height: 1, style: {}, ownerDocument: document,
        toDataURL(mimeType = "image/png", quality) {
          encodes.push({ width: canvas.width, height: canvas.height, mimeType, quality });
          // PNG pixels are real; browsers' JPEG encoder is outside this unit test.
          const data = new Uint8Array(canvas.width * canvas.height * 4).fill(255);
          if (canvas.transparent) for (let i = 3; i < data.length; i += 4) data[i] = 100;
          return `data:image/png;base64,${Buffer.from(encode({ width: canvas.width, height: canvas.height, data, channels: 4 })).toString("base64")}`;
        },
      };
      let transform = identity();
      let dash = [];
      const stack = [];
      const stateKeys = ["font", "fillStyle", "strokeStyle", "globalAlpha", "textAlign", "textBaseline", "direction", "lineWidth", "lineCap", "lineJoin", "lineDashOffset", "imageSmoothingEnabled", "imageSmoothingQuality"];
      const context = {
        canvas, font: "10px Arial", fillStyle: "#000000", strokeStyle: "#000000", globalAlpha: 1,
        textAlign: "left", textBaseline: "alphabetic", direction: "ltr", lineWidth: 1,
        lineCap: "butt", lineJoin: "miter", lineDashOffset: 0, imageSmoothingEnabled: true,
        imageSmoothingQuality: "high", shadowColor: "rgba(0,0,0,0)", shadowBlur: 0,
        save() { stack.push({ transform: { ...transform }, dash: [...dash], state: Object.fromEntries(stateKeys.map((key) => [key, context[key]])) }); },
        restore() { const saved = stack.pop(); if (saved) { transform = saved.transform; dash = saved.dash; Object.assign(context, saved.state); } },
        getTransform() { return { ...transform }; },
        setTransform(...values) { transform = typeof values[0] === "object" ? { ...values[0] } : Object.fromEntries(["a", "b", "c", "d", "e", "f"].map((key, index) => [key, values[index]])); },
        resetTransform() { transform = identity(); },
        transform(a, b, c, d, e, f) { transform = multiply(transform, { a, b, c, d, e, f }); },
        translate(x, y) { context.transform(1, 0, 0, 1, x, y); },
        scale(x, y) { context.transform(x, 0, 0, y, 0, 0); },
        rotate(angle) { context.transform(Math.cos(angle), Math.sin(angle), -Math.sin(angle), Math.cos(angle), 0, 0); },
        getLineDash() { return [...dash]; }, setLineDash(value) { dash = [...value]; },
        measureText(text) { const size = parseFloat(/([\d.]+)px/.exec(context.font)?.[1] || "10"); return { width: text.length * size * 0.55, actualBoundingBoxAscent: size * 0.8, actualBoundingBoxDescent: size * 0.2, fontBoundingBoxAscent: size * 0.8, fontBoundingBoxDescent: size * 0.2 }; },
        getImageData() { const pixels = new Uint8ClampedArray(canvas.width * canvas.height * 4).fill(255); if (canvas.transparent) for (let i = 3; i < pixels.length; i += 4) pixels[i] = 100; return { data: pixels }; },
        drawImage(image, ...args) { images.push({ image, args, canvas }); canvas.transparent = image.transparent || false; },
        createPattern(image, repetition) { return { image, repetition }; },
        createLinearGradient(...args) { return { args, stops: [], addColorStop(offset, color) { this.stops.push([offset, color]); } }; },
        createRadialGradient(...args) { return context.createLinearGradient(...args); },
        beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, bezierCurveTo() {}, quadraticCurveTo() {},
        rect() {}, arc() {}, ellipse() {}, fill() {}, stroke() {}, clip() {}, clearRect() {}, fillRect() {}, strokeRect() {},
        fillText() {}, strokeText() {},
      };
      canvas.getContext = () => context;
      canvases.push(canvas);
      return canvas;
    },
  };
  return { document, canvases, encodes, images };
}
