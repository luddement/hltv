#!/usr/bin/env python3
"""Rebuild missing GoldSrc demo directories without modifying the originals."""

from __future__ import annotations

import argparse
from dataclasses import dataclass
import math
import os
from pathlib import Path
import struct
import sys
import tempfile
from typing import BinaryIO


HEADER_SIZE = 544
DIRECTORY_ENTRY_SIZE = 92
MAX_NETWORK_MESSAGE = 65_536
MAX_DEMO_BUFFER = 32_768
MAX_SOUND = 255


@dataclass
class Section:
    entry_type: int
    offset: int
    end: int = 0
    playback_time: float = 0.0
    network_frames: int = 0


@dataclass
class ScanResult:
    sections: list[Section]
    data_end: int
    append_next_section: bool
    stopped_because: str


def cli_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Återskapa en saknad sektionskatalog i GoldSrc-demos. Originalet "
            "ändras aldrig; resultatet skrivs som *.repaired.dem."
        ),
    )
    parser.add_argument("files", nargs="*", type=Path, help="En eller flera .dem-filer")
    parser.add_argument("--root", type=Path, help="Sök rekursivt efter trasiga .dem-filer")
    parser.add_argument("--output", type=Path, help="Utdatafil; får bara användas med en fil")
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Skriv reparerade kopior. Utan flaggan görs bara en torrkörning.",
    )
    return parser.parse_args()


def read_exact(source: BinaryIO, length: int) -> bytes | None:
    data = source.read(length)
    return data if len(data) == length else None


def header_info(path: Path) -> tuple[bytes, int, int]:
    with path.open("rb") as source:
        header = source.read(HEADER_SIZE)
    if len(header) != HEADER_SIZE or header[:6] != b"HLDEMO":
        raise ValueError("inte en GoldSrc-demo med komplett header")
    protocol = struct.unpack_from("<i", header, 8)[0]
    if protocol != 5:
        raise ValueError(f"demoprotokoll {protocol} stöds inte")
    directory_offset = struct.unpack_from("<i", header, 540)[0]
    return header, directory_offset, path.stat().st_size


def has_valid_directory(path: Path, directory_offset: int, size: int) -> bool:
    if directory_offset < HEADER_SIZE or directory_offset + 4 > size:
        return False
    with path.open("rb") as source:
        source.seek(directory_offset)
        count_bytes = read_exact(source, 4)
        if count_bytes is None:
            return False
        count = struct.unpack("<i", count_bytes)[0]
        if count < 1 or count > 1024:
            return False
        directory = read_exact(source, count * DIRECTORY_ENTRY_SIZE)
    if directory is None:
        return False
    for index in range(count):
        offset = index * DIRECTORY_ENTRY_SIZE
        entry_offset, length = struct.unpack_from("<ii", directory, offset + 84)
        if (entry_offset < HEADER_SIZE or length < 0
                or entry_offset + length > directory_offset):
            return False
    return True


def variable_payload(source: BinaryIO, frame_type: int) -> tuple[bool, str]:
    if frame_type in (0, 1):
        fixed = read_exact(source, 472)
        if fixed is None:
            return False, "avklippt nätverksframe"
        length = struct.unpack_from("<I", fixed, 468)[0]
        if length > MAX_NETWORK_MESSAGE:
            return False, f"orimlig nätverkspaketstorlek {length}"
        return read_exact(source, length) is not None, "avklippt nätverkspaket"
    fixed_sizes = {2: 4, 3: 68, 4: 36, 5: 4, 6: 88, 7: 12}
    if frame_type in fixed_sizes:
        ok = read_exact(source, fixed_sizes[frame_type]) is not None
        return ok, f"avklippt frame av typ {frame_type}"
    if frame_type == 8:
        fixed = read_exact(source, 12)
        if fixed is None:
            return False, "avklippt ljudframe"
        length = struct.unpack_from("<I", fixed, 8)[0]
        if length > MAX_SOUND:
            return False, f"orimlig ljudstorlek {length}"
        return read_exact(source, 16 + length) is not None, "avklippt ljuddata"
    if frame_type == 9:
        fixed = read_exact(source, 8)
        if fixed is None:
            return False, "avklippt demobuffer"
        length = struct.unpack_from("<I", fixed, 4)[0]
        if length > MAX_DEMO_BUFFER:
            return False, f"orimlig demobufferstorlek {length}"
        return read_exact(source, length) is not None, "avklippt demobufferdata"
    return False, f"okänd frametyp {frame_type}"


def scan_frames(path: Path, input_end: int) -> ScanResult:
    sections = [Section(entry_type=0, offset=HEADER_SIZE)]
    pending_section = False
    valid_end = HEADER_SIZE
    reason = "filslut"
    found_final_next_section = False

    with path.open("rb") as source:
        source.seek(HEADER_SIZE)
        while source.tell() < input_end:
            frame_start = source.tell()
            command = read_exact(source, 5)
            if command is None:
                reason = "avklippt frameheader"
                break
            frame_type = command[0]
            frame_time = struct.unpack_from("<f", command, 1)[0]
            if not math.isfinite(frame_time) or frame_time < -1:
                reason = f"ogiltig frametid {frame_time} vid byte {frame_start}"
                break
            complete, failure = variable_payload(source, frame_type)
            if not complete or source.tell() > input_end:
                reason = f"{failure} vid byte {frame_start}"
                break

            if pending_section:
                sections[-1].end = frame_start
                sections.append(Section(entry_type=1, offset=frame_start))
                pending_section = False

            section = sections[-1]
            if section.entry_type == 1:
                section.playback_time = max(section.playback_time, frame_time)
                if frame_type in (0, 1):
                    section.network_frames += 1
            valid_end = source.tell()

            if frame_type == 5:
                if len(sections) == 2:
                    found_final_next_section = True
                    reason = "komplett avslutningsframe hittad"
                    break
                pending_section = True

    if len(sections) != 2:
        raise ValueError("kunde inte hitta gränsen mellan LOADING och Playback")
    append_next_section = not found_final_next_section
    data_end = valid_end + (9 if append_next_section else 0)
    sections[-1].end = data_end
    return ScanResult(sections, data_end, append_next_section, reason)


def directory_entry(section: Section) -> bytes:
    description = b"LOADING" if section.entry_type == 0 else b"Playback"
    description = description.ljust(64, b"\0")
    playback_time = 0.0 if section.entry_type == 0 else section.playback_time
    frame_count = 0 if section.entry_type == 0 else section.network_frames
    return b"".join([
        struct.pack("<i", section.entry_type),
        description,
        struct.pack(
            "<iifiii",
            0,
            0,
            playback_time,
            frame_count,
            section.offset,
            section.end - section.offset,
        ),
    ])


def default_output(path: Path) -> Path:
    return path.with_name(f"{path.stem}.repaired.dem")


def copy_prefix(source: BinaryIO, destination: BinaryIO, length: int) -> None:
    remaining = length
    while remaining:
        chunk = source.read(min(1024 * 1024, remaining))
        if not chunk:
            raise OSError("källfilen tog slut under kopieringen")
        destination.write(chunk)
        remaining -= len(chunk)


def write_repaired(path: Path, output: Path, scan: ScanResult) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    if output.exists():
        raise FileExistsError(f"utdatafilen finns redan: {output}")
    temporary: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            prefix=f".{output.name}.", suffix=".partial", dir=output.parent, delete=False,
        ) as destination, path.open("rb") as source:
            temporary = Path(destination.name)
            copy_prefix(source, destination, scan.data_end - (9 if scan.append_next_section else 0))
            if scan.append_next_section:
                destination.write(struct.pack("<Bfi", 5, 0.0, 0))
            directory_offset = destination.tell()
            destination.write(struct.pack("<i", len(scan.sections)))
            for section in scan.sections:
                destination.write(directory_entry(section))
            destination.seek(540)
            destination.write(struct.pack("<i", directory_offset))
            destination.flush()
            os.fsync(destination.fileno())

        _, repaired_offset, repaired_size = header_info(temporary)
        if repaired_offset != scan.data_end or not has_valid_directory(
            temporary, repaired_offset, repaired_size,
        ):
            raise OSError("den skrivna demon klarade inte katalogverifieringen")
        temporary.chmod(0o644)
        os.replace(temporary, output)
        temporary = None
    finally:
        if temporary is not None and temporary.exists():
            temporary.unlink()


def repair_one(path: Path, output: Path, execute: bool) -> tuple[str, str]:
    try:
        path = path.expanduser().resolve(strict=True)
        header, directory_offset, size = header_info(path)
        del header
        if has_valid_directory(path, directory_offset, size):
            return "SKIP", "har redan en giltig katalog"
        scan = scan_frames(path, size)
        detail = (
            f"{scan.sections[1].playback_time:.2f} s, "
            f"{scan.sections[1].network_frames} nätverksframes; {scan.stopped_because}"
        )
        if not execute:
            if output.exists():
                _, existing_offset, existing_size = header_info(output)
                if has_valid_directory(output, existing_offset, existing_size):
                    return "EXISTS", f"giltig reparerad kopia finns redan: {output.name}"
                return "KEPT", f"utdatafilen finns men är inte giltig: {output}"
            return "WOULD", f"kan repareras till {output.name} ({detail})"
        if output.exists():
            _, existing_offset, existing_size = header_info(output)
            if has_valid_directory(output, existing_offset, existing_size):
                return "EXISTS", f"giltig reparerad kopia finns redan: {output.name}"
            return "KEPT", f"utdatafilen finns men är inte giltig: {output}"
        write_repaired(path, output, scan)
        return "DONE", f"skrev {output.name} ({detail})"
    except (OSError, ValueError, struct.error) as error:
        return "KEPT", str(error)


def main() -> int:
    args = cli_args()
    if not args.files and args.root is None:
        raise SystemExit("Ange minst en .dem-fil eller --root MAPP")
    if args.output is not None and (len(args.files) != 1 or args.root is not None):
        raise SystemExit("--output kräver exakt en explicit fil och kan inte kombineras med --root")

    paths = [path.expanduser() for path in args.files]
    if args.root is not None:
        root = args.root.expanduser().resolve(strict=True)
        paths.extend(
            path for path in root.rglob("*.dem")
            if not path.name.lower().endswith(".repaired.dem")
        )
    paths = sorted(set(paths))
    mode = "KÖRNING" if args.execute else "TORRKÖRNING"
    print(f"{mode}: {len(paths)} demo(s)")
    if not args.execute:
        print("Originalen ändras aldrig. Lägg till --execute för att skriva reparerade kopior.\n")

    failures = 0
    for index, path in enumerate(paths, start=1):
        output = args.output.expanduser() if args.output is not None else default_output(path)
        status, detail = repair_one(path, output, args.execute)
        failures += status == "KEPT"
        print(f"[{index}/{len(paths)}] {status:5} {path} — {detail}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
