"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type DropzoneProps = Omit<React.ComponentProps<"div">, "onDrop"> & {
  readonly accept?: string;
  readonly disabled?: boolean;
  readonly onFileSelected: (file: File) => void;
};

/** Click-or-drop file surface built on a hidden input, styled like the rest of the UI. */
function Dropzone({
  accept,
  disabled,
  className,
  children,
  onFileSelected,
  ...props
}: DropzoneProps) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = React.useState(false);

  function takeFirstFile(files: FileList | null) {
    const file = files?.[0];
    if (file) {
      onFileSelected(file);
    }
  }

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      data-slot="dropzone"
      data-dragging={dragging || undefined}
      aria-disabled={disabled}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/70 bg-card/40 px-4 py-6 text-center transition-colors outline-none hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50 data-[dragging]:border-primary data-[dragging]:bg-primary/5 aria-disabled:pointer-events-none aria-disabled:opacity-60",
        className,
      )}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        takeFirstFile(event.dataTransfer.files);
      }}
      {...props}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        disabled={disabled}
        className="hidden"
        onChange={(event) => {
          takeFirstFile(event.target.files);
          event.target.value = "";
        }}
      />
      {children}
    </div>
  );
}

export { Dropzone };
