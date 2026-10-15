import assert from "node:assert/strict";
import test from "node:test";
import { createCanvasDocument } from "./helpers/pdf-canvas-fixture.mjs";
import { createPdfDisplayList, replayPdfDisplayList } from "../src/lib/pdf-display-list.ts";

test("layout recording measures browser text and transforms without allocating a page bitmap", () => {
  const f = createCanvasDocument();
  const recording = createPdfDisplayList(f.document, 794, 1123);
  const ctx = recording.canvas.getContext("2d");
  ctx.font = "700 14px Arial";
  const width = ctx.measureText("Invoice").width;
  ctx.save();
  ctx.translate(20, 40);
  ctx.scale(2, 3);
  assert.deepEqual(ctx.getTransform(), { a: 2, b: 0, c: 0, d: 3, e: 20, f: 40 });
  ctx.fillText("Invoice", 0, 0);
  ctx.restore();
  assert.ok(width > 0);
  assert.ok(recording.fonts.has("700 14px Arial"));
  assert.ok(recording.commands.some((command) => command.name === "fillText"));
  assert.ok(recording.commands.every((command) => !["measureText", "getTransform"].includes(command.name)));
  assert.ok(f.canvases.every((canvas) => canvas.width === 1 && canvas.height === 1));
  recording.dispose();
});

test("temporary image surfaces survive browser renderer cleanup and release after all qualities", () => {
  const f = createCanvasDocument();
  const surface = f.document.createElement("canvas");
  surface.width = 60;
  surface.height = 30;
  const recording = createPdfDisplayList(f.document, 794, 1123);
  recording.canvas.getContext("2d").drawImage(surface, 10, 20);
  surface.width = surface.height = 1;
  const draw = recording.commands.find((command) => command.name === "drawImage");
  const preserved = draw.args[0];
  assert.notEqual(preserved, surface);
  assert.equal(preserved.width, 60);
  assert.equal(preserved.height, 30);
  recording.dispose();
  assert.equal(preserved.width, 1);
  assert.equal(preserved.height, 1);
});

test("gradient stops and image sources are preserved for native replay", () => {
  const f = createCanvasDocument();
  const recording = createPdfDisplayList(f.document, 794, 1123);
  const ctx = recording.canvas.getContext("2d");
  const gradient = ctx.createLinearGradient(0, 0, 100, 0);
  gradient.addColorStop(0, "#ff0000");
  gradient.addColorStop(1, "#ffffff");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 100, 50);
  const image = { src: "/wifi/airtel-logo.svg", width: 264, height: 66 };
  ctx.drawImage(image, 0, 0);
  const calls = [];
  const target = { fillRect: (...args) => calls.push(args), drawImage: () => {} };
  replayPdfDisplayList(target, recording.commands);
  assert.equal(target.fillStyle.__pdfGradient, true);
  assert.deepEqual(target.fillStyle.stops, [[0, "#ff0000"], [1, "#ffffff"]]);
  assert.deepEqual(calls, [[0, 0, 100, 50]]);
  assert.ok(recording.imageSources.has("/wifi/airtel-logo.svg"));
  recording.dispose();
});
