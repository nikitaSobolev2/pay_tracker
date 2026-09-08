"use client";

import { useEffect, useState } from "react";

type TransferEvent = {
  readonly dataTransfer: DataTransfer | null;
  preventDefault(): void;
};

type ZoneDragEvent = TransferEvent & {
  readonly currentTarget: EventTarget;
};

const DROP_ZONE_ATTR = "data-calculator-drop";
const DROP_OVER_ATTR = "data-drop-over";
const PERSON_DRAG_PREFIX = "person:";

let dragActive = false;
let dragKind: "transaction" | "person" | null = null;
let activeHoverId: string | null = null;
const hoverSubscribers = new Set<(id: string | null, active: boolean) => void>();
let dragListenersBound = false;

export function readDragTransactionId(event: TransferEvent): string | null {
  const id = event.dataTransfer?.getData("text/plain")?.trim();
  if (!id || id.startsWith(PERSON_DRAG_PREFIX)) {
    return null;
  }
  return id;
}

export function readDragPersonId(event: TransferEvent): string | null {
  const id = event.dataTransfer?.getData("text/plain")?.trim();
  if (!id?.startsWith(PERSON_DRAG_PREFIX)) {
    return null;
  }
  return id.slice(PERSON_DRAG_PREFIX.length) || null;
}

export function setDragTransactionId(
  event: TransferEvent,
  transactionId: string,
): void {
  setDragPlainText(event, transactionId);
  beginCalculatorDrag("transaction");
}

export function setDragPersonId(event: TransferEvent, personId: string): void {
  setDragPlainText(event, `${PERSON_DRAG_PREFIX}${personId}`);
  beginCalculatorDrag("person");
}

function setDragPlainText(event: TransferEvent, value: string): void {
  event.dataTransfer?.setData("text/plain", value);
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
  }
}

export function allowCalculatorDrop(event: TransferEvent): void {
  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "move";
  }
}

export function beginCalculatorDrag(kind: "transaction" | "person"): void {
  dragActive = true;
  dragKind = kind;
  activeHoverId = null;
  clearDropOverMarks();
  notifyHover();
}

export function endCalculatorDrag(): void {
  dragActive = false;
  dragKind = null;
  activeHoverId = null;
  clearDropOverMarks();
  notifyHover();
}

export function useCalculatorDropHover(
  targetId: string,
  accepted: "transaction" | "person" | "any" = "any",
): {
  readonly isOver: boolean;
  onDragOver(event: ZoneDragEvent): void;
  resetHover(): void;
} {
  const [isOver, setIsOver] = useState(
    () => dragActive && activeHoverId === targetId,
  );

  useEffect(() => {
    bindDragListeners();
    const sync = (hoverId: string | null, active: boolean) => {
      setIsOver(active && hoverId === targetId);
    };
    hoverSubscribers.add(sync);
    sync(activeHoverId, dragActive);
    return () => {
      hoverSubscribers.delete(sync);
    };
  }, [targetId]);

  return {
    isOver,
    onDragOver(event: ZoneDragEvent) {
      if (!dragActive) {
        return;
      }
      if (accepted !== "any" && dragKind != null && dragKind !== accepted) {
        return;
      }
      allowCalculatorDrop(event);
      markDropOver(targetId, event.currentTarget);
    },
    resetHover: endCalculatorDrag,
  };
}

function publishHover(id: string | null) {
  if (activeHoverId === id) {
    return;
  }
  activeHoverId = id;
  notifyHover();
}

function notifyHover() {
  hoverSubscribers.forEach((notify) => notify(activeHoverId, dragActive));
}

function markDropOver(targetId: string, currentTarget: EventTarget) {
  publishHover(targetId);
  if (currentTarget instanceof Element) {
    setExclusiveDropOver(currentTarget);
  }
}

function setExclusiveDropOver(element: Element) {
  document.querySelectorAll(`[${DROP_OVER_ATTR}]`).forEach((node) => {
    if (node !== element) {
      node.removeAttribute(DROP_OVER_ATTR);
    }
  });
  element.setAttribute(DROP_OVER_ATTR, "");
}

function clearDropOverMarks() {
  document.querySelectorAll(`[${DROP_OVER_ATTR}]`).forEach((node) => {
    node.removeAttribute(DROP_OVER_ATTR);
  });
}

function dropZoneFromTarget(target: EventTarget | null): Element | null {
  if (target instanceof Element) {
    return target.closest(`[${DROP_ZONE_ATTR}]`);
  }
  if (target instanceof Text) {
    return target.parentElement?.closest(`[${DROP_ZONE_ATTR}]`) ?? null;
  }
  return null;
}

function onWindowDragOver(event: DragEvent) {
  if (!dragActive) {
    return;
  }
  if (dropZoneFromTarget(event.target)) {
    return;
  }
  publishHover(null);
  clearDropOverMarks();
}

function bindDragListeners() {
  if (dragListenersBound || typeof window === "undefined") {
    return;
  }
  dragListenersBound = true;
  window.addEventListener("dragend", endCalculatorDrag, true);
  window.addEventListener("drop", endCalculatorDrag, true);
  window.addEventListener("dragover", onWindowDragOver);
}
