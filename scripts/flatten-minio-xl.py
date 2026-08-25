#!/usr/bin/env python3
"""Turn leftover MinIO XL directories into plain files on /to."""

from __future__ import annotations

import shutil
from pathlib import Path

PNG = bytes([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
IEND = b"IEND"
JPEG_SOI = bytes([0xFF, 0xD8, 0xFF])
JPEG_EOI = bytes([0xFF, 0xD9])
ROOTS = [
    Path("/to/events"),
    Path("/to/travels"),
    Path("/to/paytracker/events"),
    Path("/to/paytracker/travels"),
]


def extract_payload(data: bytes) -> bytes | None:
    start = data.find(PNG)
    if start >= 0:
        marker = data.find(IEND, start)
        if marker >= 0:
            return data[start : marker + 8]
    start = data.find(JPEG_SOI)
    if start >= 0:
        end = data.rfind(JPEG_EOI)
        if end > start:
            return data[start : end + 2]
    start = data.find(b"%PDF")
    if start >= 0:
        end = data.rfind(b"%%EOF")
        if end > start:
            return data[start : end + 5]
    return None


def flatten_part_files() -> None:
    for root in ROOTS:
        if not root.is_dir():
            continue
        for part in list(root.rglob("part.1")):
            replace_dir_with_bytes(part.parent, part.read_bytes())


def flatten_xl_meta() -> None:
    for root in ROOTS:
        if not root.is_dir():
            continue
        for meta in list(root.rglob("xl.meta")):
            payload = extract_payload(meta.read_bytes())
            if payload:
                replace_dir_with_bytes(meta.parent, payload)


def replace_dir_with_bytes(directory: Path, payload: bytes) -> None:
    if not directory.is_dir():
        return
    tmp = directory.with_name(directory.name + ".flat")
    tmp.write_bytes(payload)
    shutil.rmtree(directory)
    tmp.rename(directory)
    print(f"Flattened {directory}")


def hoist_bucket_prefix() -> None:
    bucket = Path("/to/paytracker")
    if not bucket.is_dir():
        return
    for name in ("events", "travels"):
        nested = bucket / name
        dest = Path("/to") / name
        if not nested.exists():
            continue
        if dest.exists():
            shutil.copytree(nested, dest, dirs_exist_ok=True)
            shutil.rmtree(nested)
        else:
            shutil.move(str(nested), str(dest))
        print(f"Hoisted {nested} -> {dest}")


def main() -> None:
    flatten_part_files()
    flatten_xl_meta()
    hoist_bucket_prefix()
    print("MinIO flatten complete")


if __name__ == "__main__":
    main()
