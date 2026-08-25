#!/usr/bin/env python3
"""Turn leftover MinIO XL directories into plain files on /to."""

from __future__ import annotations

import re
import shutil
from pathlib import Path

PNG = bytes([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
IEND = b"IEND"
JPEG_SOI = bytes([0xFF, 0xD8, 0xFF])
JPEG_EOI = bytes([0xFF, 0xD9])
BITROT_HASH_BYTES = 32
ROOTS = [
    Path("/to/events"),
    Path("/to/travels"),
    Path("/to/paytracker/events"),
    Path("/to/paytracker/travels"),
]
OBJECT_DIR_NAME = re.compile(r"^[0-9a-f-]{36}\.[a-z0-9]{1,8}$", re.I)


def looks_like_media(data: bytes) -> bool:
    if data.startswith(PNG) or data.startswith(JPEG_SOI) or data.startswith(b"%PDF"):
        return True
    if data.startswith(b"GIF8"):
        return True
    return data.startswith(b"RIFF") and data[8:12] == b"WEBP"


def extract_payload(data: bytes) -> bytes | None:
    start = data.find(PNG)
    if start >= 0:
        marker = data.find(IEND, start)
        if marker >= 0:
            return data[start : marker + 8]
    start = data.find(JPEG_SOI)
    if start >= 0:
        end = data.find(JPEG_EOI, start + len(JPEG_SOI))
        if end > start:
            return data[start : end + 2]
    start = data.find(b"%PDF")
    if start >= 0:
        end = data.rfind(b"%%EOF")
        if end > start:
            return data[start : end + 5]
    return None


def recover_payload(data: bytes) -> bytes | None:
    if looks_like_media(data):
        return data
    extracted = extract_payload(data)
    if extracted:
        return extracted
    if len(data) > BITROT_HASH_BYTES and looks_like_media(data[BITROT_HASH_BYTES:]):
        return data[BITROT_HASH_BYTES:]
    return None


def object_directory(path: Path) -> Path:
    for candidate in [path, *path.parents]:
        if OBJECT_DIR_NAME.match(candidate.name):
            return candidate
    return path


def flatten_part_files() -> None:
    for root in ROOTS:
        if not root.is_dir():
            continue
        for part in list(root.rglob("part.1")):
            payload = recover_payload(part.read_bytes())
            if payload:
                replace_dir_with_bytes(object_directory(part.parent), payload)


def flatten_orphan_payload_files() -> None:
    for root in ROOTS:
        if not root.is_dir():
            continue
        for directory in list(root.rglob("*")):
            if not directory.is_dir() or not OBJECT_DIR_NAME.match(directory.name):
                continue
            payloads = [
                child
                for child in directory.iterdir()
                if child.is_file() and child.name != "xl.meta"
            ]
            if len(payloads) != 1:
                continue
            payload = recover_payload(payloads[0].read_bytes())
            if payload:
                replace_dir_with_bytes(directory, payload)


def flatten_xl_meta() -> None:
    for root in ROOTS:
        if not root.is_dir():
            continue
        for meta in list(root.rglob("xl.meta")):
            payload = recover_payload(meta.read_bytes())
            if payload:
                replace_dir_with_bytes(meta.parent, payload)


def flatten_hash_prefixed_files() -> None:
    for root in ROOTS:
        if not root.is_dir():
            continue
        for path in list(root.rglob("*")):
            if not path.is_file() or not OBJECT_DIR_NAME.match(path.name):
                continue
            data = path.read_bytes()
            payload = recover_payload(data)
            if payload and payload != data:
                path.write_bytes(payload)
                print(f"Recovered {path}")


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
    flatten_orphan_payload_files()
    flatten_xl_meta()
    flatten_hash_prefixed_files()
    hoist_bucket_prefix()
    print("MinIO flatten complete")


if __name__ == "__main__":
    main()
