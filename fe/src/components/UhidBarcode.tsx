const CODE_128_PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213",
  "122312", "132212", "221213", "221312", "231212", "112232", "122132",
  "122231", "113222", "123122", "123221", "223211", "221132", "221231",
  "213212", "223112", "312131", "311222", "321122", "321221", "312212",
  "322112", "322211", "212123", "212321", "232121", "111323", "131123",
  "131321", "112313", "132113", "132311", "211313", "231113", "231311",
  "112133", "112331", "132131", "113123", "113321", "133121", "313121",
  "211331", "231131", "213113", "213311", "213131", "311123", "311321",
  "331121", "312113", "312311", "332111", "314111", "221411", "431111",
  "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114",
  "413111", "241112", "134111", "111242", "121142", "121241", "114212",
  "124112", "124211", "411212", "421112", "421211", "212141", "214121",
  "412121", "111143", "111341", "131141", "114113", "114311", "411113",
  "411311", "113141", "114131", "311141", "411131", "211412", "211214",
  "211232", "2331112",
] as const;

const code128B = (value: string) => {
  const normalized = Array.from(value.trim())
    .map((character) => {
      const code = character.charCodeAt(0);
      return code >= 32 && code <= 126 ? character : "?";
    })
    .join("");
  const values = Array.from(normalized, (character) =>
    character.charCodeAt(0) - 32,
  );
  const checksum =
    (104 + values.reduce((sum, code, index) => sum + code * (index + 1), 0)) %
    103;
  return [104, ...values, checksum, 106];
};

interface UhidBarcodeProps {
  value: string;
  className?: string;
}

export function UhidBarcode({ value, className = "" }: UhidBarcodeProps) {
  if (!value.trim()) return null;

  const quietZone = 10;
  let cursor = quietZone;
  const bars: { x: number; width: number }[] = [];
  code128B(value).forEach((code) => {
    CODE_128_PATTERNS[code].split("").forEach((moduleWidth, index) => {
      const width = Number(moduleWidth);
      if (index % 2 === 0) bars.push({ x: cursor, width });
      cursor += width;
    });
  });
  const totalWidth = cursor + quietZone;

  return (
    <svg
      viewBox={`0 0 ${totalWidth} 32`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Barcode for UHID ${value}`}
      className={`h-5 w-28 shrink-0 bg-white ${className}`}
      shapeRendering="crispEdges"
    >
      <rect width={totalWidth} height="32" fill="white" />
      {bars.map((bar, index) => (
        <rect
          key={`${bar.x}-${index}`}
          x={bar.x}
          y="0"
          width={bar.width}
          height="32"
          fill="black"
        />
      ))}
    </svg>
  );
}

interface UhidWithBarcodeProps {
  value: string;
  showBarcode: boolean;
  className?: string;
  barcodeClassName?: string;
}

export function UhidWithBarcode({
  value,
  showBarcode,
  className = "",
  barcodeClassName = "",
}: UhidWithBarcodeProps) {
  return (
    <span className={`inline-flex max-w-full items-center gap-2 ${className}`}>
      <span>{value}</span>
      {showBarcode && (
        <UhidBarcode value={value} className={barcodeClassName} />
      )}
    </span>
  );
}
