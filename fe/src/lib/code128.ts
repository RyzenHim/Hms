/** Minimum quiet zone required by ISO/IEC 15417, measured in X modules. */
export const CODE128_QUIET_ZONE_MODULES = 10;

/** Keeps generated SVGs bounded while covering the bill's invoice/account limits. */
export const CODE128_B_MAX_LENGTH = 80;

export interface Code128BEncoding {
  /** Start B, one codeword per character, checksum, then stop. */
  codewords: readonly number[];
  checksum: number;
  /** One character per X module: `1` is a bar and `0` is a space. */
  modules: string;
  quietZoneModules: number;
}

// Code 128 symbol widths for values 0-106. Each digit is the width of the
// alternating bar/space element. Values 0-105 contain 11 modules; stop has 13.
const SYMBOL_WIDTHS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312",
  "132212", "221213", "221312", "231212", "112232", "122132", "122231", "113222",
  "123122", "123221", "223211", "221132", "221231", "213212", "223112", "312131",
  "311222", "321122", "321221", "312212", "322112", "322211", "212123", "212321",
  "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121",
  "313121", "211331", "231131", "213113", "213311", "213131", "311123", "311321",
  "331121", "312113", "312311", "332111", "314111", "221411", "431111", "111224",
  "111422", "121124", "121421", "141122", "141221", "112214", "112412", "122114",
  "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112",
  "421211", "212141", "214121", "412121", "111143", "111341", "131141", "114113",
  "114311", "411113", "411311", "113141", "114131", "311141", "411131", "211412",
  "211214", "211232", "2331112",
] as const;

const START_B = 104;
const STOP = 106;

function widthsToModules(widths: string): string {
  let modules = "";
  for (let index = 0; index < widths.length; index += 1) {
    modules += (index % 2 === 0 ? "1" : "0").repeat(Number(widths[index]));
  }
  return modules;
}

/**
 * Encode printable ASCII as a standards-correct Code 128 subset B symbol.
 * The returned binary sequence includes the required ten-module quiet zone on
 * both sides and can be mapped directly to SVG units (`viewBox` width = length).
 */
export function encodeCode128B(value: string): Code128BEncoding {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError("Code 128B requires a non-empty string.");
  }
  if (value.length > CODE128_B_MAX_LENGTH) {
    throw new RangeError(`Code 128B supports at most ${CODE128_B_MAX_LENGTH} characters.`);
  }

  const dataCodewords = Array.from(value, (character) => {
    const codePoint = character.codePointAt(0)!;
    if (codePoint < 32 || codePoint > 126) {
      throw new RangeError("Code 128B supports printable ASCII characters (space through ~) only.");
    }
    return codePoint - 32;
  });

  const weightedTotal = dataCodewords.reduce(
    (total, codeword, index) => total + codeword * (index + 1),
    START_B,
  );
  const checksum = weightedTotal % 103;
  const codewords = Object.freeze([START_B, ...dataCodewords, checksum, STOP]);
  const quietZone = "0".repeat(CODE128_QUIET_ZONE_MODULES);
  const symbol = codewords.map((codeword) => widthsToModules(SYMBOL_WIDTHS[codeword])).join("");

  return Object.freeze({
    codewords,
    checksum,
    modules: `${quietZone}${symbol}${quietZone}`,
    quietZoneModules: CODE128_QUIET_ZONE_MODULES,
  });
}
