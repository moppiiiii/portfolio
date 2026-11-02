const NUMERALS: [number, string][] = [
  [1000, 'M'],
  [900, 'CM'],
  [500, 'D'],
  [400, 'CD'],
  [100, 'C'],
  [90, 'XC'],
  [50, 'L'],
  [40, 'XL'],
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
]

/** Roman numeral for a positive whole number, as atlases number their plates (1 → I). */
export function toRoman(value: number): string {
  let rest = Math.floor(value)
  let result = ''
  for (const [amount, numeral] of NUMERALS) {
    while (rest >= amount) {
      result += numeral
      rest -= amount
    }
  }
  return result
}
