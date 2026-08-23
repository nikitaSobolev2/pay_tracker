import {
  formatDebtReportHistory,
  formatDebtReportTotal,
  type DebtReportRow,
} from "@/lib/debt-report-text";

const SCALE = 2;
const CANVAS_WIDTH = 420;
const CARD_GAP = 10;
const PAGE_PAD = 16;
const CARD_RADIUS = 16;
const CARD_PAD_X = 16;
const CARD_PAD_Y = 14;
const NAME_ROW_HEIGHT = 24;
const HISTORY_LINE_HEIGHT = 16;
const HISTORY_GAP = 6;

type ReportTheme = {
  readonly page: string;
  readonly card: string;
  readonly border: string;
  readonly name: string;
  readonly muted: string;
  readonly owe: string;
  readonly owed: string;
};

type CardLayout = {
  readonly top: number;
  readonly height: number;
  readonly historyLines: readonly string[];
};

export async function renderDebtReportPng(
  rows: readonly DebtReportRow[],
): Promise<Blob> {
  const canvas = drawDebtReportCanvas(rows);
  return canvasToPngBlob(canvas);
}

export function downloadPngBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function copyPngBlob(blob: Blob): Promise<void> {
  await navigator.clipboard.write([
    new ClipboardItem({ "image/png": blob }),
  ]);
}

function drawDebtReportCanvas(rows: readonly DebtReportRow[]): HTMLCanvasElement {
  const measure = createMeasureContext();
  const layouts = layoutReportCards(rows, measure);
  const last = layouts.at(-1);
  const height = last ? last.top + last.height + PAGE_PAD : PAGE_PAD * 2;
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_WIDTH * SCALE;
  canvas.height = height * SCALE;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas is not available");
  }
  context.scale(SCALE, SCALE);
  const theme = readReportTheme();
  context.fillStyle = theme.page;
  context.fillRect(0, 0, CANVAS_WIDTH, height);
  rows.forEach((row, index) => {
    drawReportCard(context, row, layouts[index]!, theme);
  });
  return canvas;
}

function createMeasureContext(): CanvasRenderingContext2D {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas is not available");
  }
  return context;
}

function layoutReportCards(
  rows: readonly DebtReportRow[],
  measure: CanvasRenderingContext2D,
): CardLayout[] {
  const innerWidth = CANVAS_WIDTH - PAGE_PAD * 2 - CARD_PAD_X * 2;
  measure.font = historyFont();
  const layouts: CardLayout[] = [];
  let top = PAGE_PAD;
  for (const row of rows) {
    const history = formatDebtReportHistory(row);
    const historyLines = history
      ? wrapCanvasText(measure, history, innerWidth)
      : [];
    const height = cardHeight(historyLines.length);
    layouts.push({ top, height, historyLines });
    top += height + CARD_GAP;
  }
  return layouts;
}

function cardHeight(historyLineCount: number): number {
  const historyBlock =
    historyLineCount > 0
      ? HISTORY_GAP + historyLineCount * HISTORY_LINE_HEIGHT
      : 0;
  return CARD_PAD_Y * 2 + NAME_ROW_HEIGHT + historyBlock;
}

function drawReportCard(
  context: CanvasRenderingContext2D,
  row: DebtReportRow,
  layout: CardLayout,
  theme: ReportTheme,
): void {
  const left = PAGE_PAD;
  const width = CANVAS_WIDTH - PAGE_PAD * 2;
  context.beginPath();
  context.roundRect(left, layout.top, width, layout.height, CARD_RADIUS);
  context.fillStyle = theme.card;
  context.fill();
  context.strokeStyle = theme.border;
  context.lineWidth = 1;
  context.stroke();

  const total = formatDebtReportTotal(row);
  const nameTop = layout.top + CARD_PAD_Y + NAME_ROW_HEIGHT / 2;
  context.font = nameFont();
  context.textBaseline = "middle";
  context.fillStyle = row.tone === "owe" ? theme.owe : theme.owed;
  context.textAlign = "right";
  context.fillText(total, left + width - CARD_PAD_X, nameTop);

  const totalWidth = context.measureText(total).width;
  const nameMaxWidth = width - CARD_PAD_X * 2 - totalWidth - 12;
  context.fillStyle = theme.name;
  context.textAlign = "left";
  context.fillText(
    fitCanvasText(context, row.name, nameMaxWidth),
    left + CARD_PAD_X,
    nameTop,
  );

  if (layout.historyLines.length === 0) {
    return;
  }
  context.font = historyFont();
  context.fillStyle = theme.muted;
  context.textBaseline = "top";
  let lineTop = layout.top + CARD_PAD_Y + NAME_ROW_HEIGHT + HISTORY_GAP;
  for (const line of layout.historyLines) {
    context.fillText(line, left + CARD_PAD_X, lineTop);
    lineTop += HISTORY_LINE_HEIGHT;
  }
}

function wrapCanvasText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  let current = "";
  for (const token of text.split(" ")) {
    const next = current ? `${current} ${token}` : token;
    if (context.measureText(next).width <= maxWidth) {
      current = next;
      continue;
    }
    if (current) {
      lines.push(current);
    }
    current = token;
  }
  if (current) {
    lines.push(current);
  }
  return lines;
}

function fitCanvasText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (context.measureText(text).width <= maxWidth) {
    return text;
  }
  let clipped = text;
  while (clipped.length > 1 && context.measureText(`${clipped}…`).width > maxWidth) {
    clipped = clipped.slice(0, -1);
  }
  return `${clipped}…`;
}

function nameFont(): string {
  return "600 16px Geist, ui-sans-serif, system-ui, sans-serif";
}

function historyFont(): string {
  return "400 12px Geist, ui-sans-serif, system-ui, sans-serif";
}

function readReportTheme(): ReportTheme {
  return {
    page: readCssColor("--background", "#0f1117"),
    card: readCssColor("--card", "#1b1d24"),
    border: readCssColor("--border", "rgba(255,255,255,0.12)"),
    name: readCssColor("--foreground", "#f4f4f5"),
    muted: readCssColor("--muted-foreground", "#a1a1aa"),
    owe: "#fb7185",
    owed: "#34d399",
  };
}

function readCssColor(variableName: string, fallback: string): string {
  if (typeof document === "undefined") {
    return fallback;
  }
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(variableName)
    .trim();
  return value || fallback;
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }
      reject(new Error("Could not create image"));
    }, "image/png");
  });
}
