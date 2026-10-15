/** A page's browser-laid-out drawing commands, independent of export resolution. */
export type PdfDrawingCommand =
  | { kind: "set"; name: string; value: unknown }
  | { kind: "call"; name: string; args: unknown[] };

export interface PdfPattern {
  __pdfPattern: true;
  image: CanvasImageSource;
  repetition: string;
}

export interface PdfGradient {
  __pdfGradient: true;
  kind: "linear" | "radial" | "conic";
  args: number[];
  stops: [number, string][];
  addColorStop: (offset: number, color: string) => void;
}

const STATE_METHODS = new Set(["save", "restore", "scale", "rotate", "translate", "transform", "setTransform", "resetTransform", "setLineDash"]);
const READ_METHODS = new Set(["measureText", "getTransform", "getLineDash", "isPointInPath", "isPointInStroke", "getImageData", "createImageData", "getContextAttributes", "isContextLost"]);

export function createPdfDisplayList(ownerDocument: Document, width: number, height: number) {
  const measurementCanvas = ownerDocument.createElement("canvas");
  measurementCanvas.width = 1;
  measurementCanvas.height = 1;
  const measure = measurementCanvas.getContext("2d");
  if (!measure) throw new Error("Unable to measure the document for PDF export.");
  const commands: PdfDrawingCommand[] = [];
  const fonts = new Set<string>();
  const imageSources = new Set<string>();
  const snapshots: HTMLCanvasElement[] = [];

  const snapshot = (source: CanvasImageSource): CanvasImageSource => {
    // html2canvas releases temporary filter/shadow surfaces after drawing. Keep
    // only those small artwork surfaces alive until every quality is encoded.
    if ("getContext" in source && "width" in source && "height" in source) {
      const copy = ownerDocument.createElement("canvas");
      copy.width = source.width;
      copy.height = source.height;
      const context = copy.getContext("2d");
      if (!context) throw new Error("Unable to preserve PDF artwork.");
      context.drawImage(source, 0, 0);
      snapshots.push(copy);
      return copy;
    }
    if ("src" in source && typeof source.src === "string") imageSources.add(source.src);
    return source;
  };

  const context = new Proxy(measure, {
    get(target, key) {
      if (key === "canvas") return canvas;
      const name = String(key);
      if (name === "createPattern") return (image: CanvasImageSource, repetition: string): PdfPattern => ({ __pdfPattern: true, image: snapshot(image), repetition });
      if (["createLinearGradient", "createRadialGradient", "createConicGradient"].includes(name)) {
        return (...args: number[]): PdfGradient => {
          const gradient: PdfGradient = {
            __pdfGradient: true,
            kind: name === "createLinearGradient" ? "linear" : name === "createRadialGradient" ? "radial" : "conic",
            args,
            stops: [],
            addColorStop(offset, color) { gradient.stops.push([offset, color]); },
          };
          return gradient;
        };
      }
      const value = Reflect.get(target, key, target);
      if (typeof value !== "function") return value;
      if (READ_METHODS.has(name)) return value.bind(target);
      return (...args: unknown[]) => {
        if (name === "drawImage") args[0] = snapshot(args[0] as CanvasImageSource);
        commands.push({ kind: "call", name, args });
        if (STATE_METHODS.has(name)) return value.apply(target, args);
      };
    },
    set(target, key, value) {
      const name = String(key);
      commands.push({ kind: "set", name, value });
      if (name === "font") fonts.add(String(value));
      // Descriptors deliberately replace browser-only paint objects for replay.
      if (!value || typeof value !== "object" || !("__pdfPattern" in value || "__pdfGradient" in value)) Reflect.set(target, key, value, target);
      return true;
    },
  });

  // The logical canvas has page dimensions but no page-sized bitmap allocation.
  const canvas = { width, height, style: {}, ownerDocument, getContext: () => context } as unknown as HTMLCanvasElement;
  return {
    canvas, commands, fonts, imageSources,
    dispose() {
      for (const snapshot of snapshots) { snapshot.width = 1; snapshot.height = 1; }
      snapshots.length = 0;
      commands.length = 0;
      measurementCanvas.width = 1;
      measurementCanvas.height = 1;
    },
  };
}

export function replayPdfDisplayList(context: CanvasRenderingContext2D, commands: PdfDrawingCommand[]): void {
  const target = context as unknown as Record<string, unknown>;
  for (const command of commands) {
    if (command.kind === "set") target[command.name] = command.value;
    else {
      const method = target[command.name];
      if (typeof method !== "function") throw new Error(`The PDF renderer cannot draw ${command.name}.`);
      method.apply(context, command.args);
    }
  }
}
