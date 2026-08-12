"use client";

import "@/lib/math-sum-precise-polyfill";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

import { Button } from "@/components/ui/button";

/** Stable public URL — SW precaches this for offline PDF ticket viewing. */
const PDF_WORKER_URL = "/pdf.worker.min.mjs";

pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_URL;

/** Warm react-pdf + worker into the SW cache while online. */
export function warmupPdfViewerForOffline(): void {
  if (typeof window === "undefined") {
    return;
  }
  void fetch(PDF_WORKER_URL).catch(() => undefined);
}

type TravelTicketPdfViewerProps = {
  readonly file: Blob;
  readonly title: string;
  readonly onLoadError: () => void;
};

export function TravelTicketPdfViewer({
  file,
  title,
  onLoadError,
}: TravelTicketPdfViewerProps) {
  const t = useTranslations("travels");
  const [pageNumber, setPageNumber] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const pageWidth = useViewerPageWidth();

  return (
    <div className="flex h-full w-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-auto p-3 sm:p-6">
        <div className="flex justify-center">
          <Document
            file={file}
            loading={
              <p className="py-8 text-sm text-white/60">
                {t("ticketPreviewLoading")}
              </p>
            }
            onLoadSuccess={(pdf) => {
              setNumPages(pdf.numPages);
              setPageNumber(1);
            }}
            onLoadError={onLoadError}
          >
            <Page
              pageNumber={pageNumber}
              width={pageWidth}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              className="bg-white shadow-lg"
              aria-label={title}
            />
          </Document>
        </div>
      </div>

      {numPages > 0 ? (
        <PdfPagePager
          pageNumber={pageNumber}
          numPages={numPages}
          onPrevious={() => setPageNumber((page) => Math.max(1, page - 1))}
          onNext={() =>
            setPageNumber((page) => Math.min(numPages, page + 1))
          }
        />
      ) : null}
    </div>
  );
}

function PdfPagePager({
  pageNumber,
  numPages,
  onPrevious,
  onNext,
}: {
  readonly pageNumber: number;
  readonly numPages: number;
  readonly onPrevious: () => void;
  readonly onNext: () => void;
}) {
  const t = useTranslations("travels");

  return (
    <div className="flex shrink-0 items-center justify-center gap-3 border-t border-white/10 px-4 py-3">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-10 rounded-xl text-white hover:bg-white/10 disabled:opacity-40"
        aria-label={t("ticketPreviewPrev")}
        disabled={pageNumber <= 1}
        onClick={onPrevious}
      >
        <ChevronLeft className="size-5" />
      </Button>
      <p className="min-w-28 text-center text-sm text-white/80">
        {t("ticketPreviewPage", { current: pageNumber, total: numPages })}
      </p>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-10 rounded-xl text-white hover:bg-white/10 disabled:opacity-40"
        aria-label={t("ticketPreviewNext")}
        disabled={pageNumber >= numPages}
        onClick={onNext}
      >
        <ChevronRight className="size-5" />
      </Button>
    </div>
  );
}

function useViewerPageWidth(): number {
  const [width, setWidth] = useState(320);
  const frameRef = useRef(0);

  useEffect(() => {
    function measure() {
      const padding = window.innerWidth < 640 ? 24 : 48;
      setWidth(Math.min(window.innerWidth - padding, 900));
    }

    measure();
    const onResize = () => {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(measure);
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return width;
}
