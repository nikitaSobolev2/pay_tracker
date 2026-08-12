/**
 * pdf.js 5.x (modern build) calls Math.sumPrecise. Node and most browsers
 * still lack it, which breaks font metrics while rendering ticket PDFs.
 */
const mathWithSum = Math as typeof Math & {
  sumPrecise?: (values: Iterable<number>) => number;
};

if (typeof mathWithSum.sumPrecise !== "function") {
  mathWithSum.sumPrecise = (values) => {
    let total = 0;
    for (const value of values) {
      total += value;
    }
    return total;
  };
}
