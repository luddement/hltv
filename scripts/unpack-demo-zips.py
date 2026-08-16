#!/usr/bin/env python3
"""Safely unpack demo ZIP files into the right year's root, one archive at a time."""

from __future__ import annotations

import argparse
import datetime
import filecmp
import hashlib
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import stat
import sys
import tempfile
from zipfile import BadZipFile, ZipFile, ZipInfo


YEAR_PATTERN = re.compile(r"^\d{4}$")
# Demo names carry their date as -YYMMDDHHMM-, e.g. bboys_kips-0604172135-de_cpl_fire.dem
STAMP_PATTERN = re.compile(r"-(\d{10})-")
EARLIEST_YEAR = 1998
SPACE_RESERVE_BYTES = 256 * 1024 * 1024
TEMP_PREFIX = ".unpack-demo-"


def arguments() -> argparse.Namespace:
    default_root = Path(__file__).resolve().parents[2] / "demos"
    parser = argparse.ArgumentParser(
        description=(
            "Packa upp varje ZIP under demos/ till roten av rätt årsmapp (demos/ÅR/). "
            "Året tas från demons datumstämpel -ÅÅMMDDTTMM-. ZIP-filen tas bort "
            "först efter lyckad uppackning och verifiering."
        ),
    )
    parser.add_argument(
        "--root",
        type=Path,
        default=default_root,
        help=f"Demos-mapp (standard: {default_root})",
    )
    parser.add_argument(
        "--year",
        action="append",
        help="Begränsa till ZIP-filer för ett år; flaggan kan anges flera gånger.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        help="Behandla högst detta antal ZIP-filer (bra för ett första test).",
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Utför uppackning och ta bort varje verifierad ZIP. Utan flaggan görs torrkörning.",
    )
    return parser.parse_args()


def archive_identity(path: Path) -> tuple[int, int, int, int]:
    details = path.lstat()
    return details.st_dev, details.st_ino, details.st_size, details.st_mtime_ns


def year_from_name(name: str) -> str | None:
    """Read the year out of a -YYMMDDHHMM- stamp, or return None if there is none."""
    limit = datetime.date.today().year
    for match in STAMP_PATTERN.finditer(name):
        try:
            stamp = datetime.datetime.strptime(match.group(1), "%y%m%d%H%M")
        except ValueError:
            continue
        if EARLIEST_YEAR <= stamp.year <= limit:
            return str(stamp.year)
    return None


def target_year(root: Path, archive: Path, basename: str) -> str:
    """Pick the year folder for one demo: its own stamp, then the ZIP's, then the ZIP's folder."""
    year = year_from_name(basename) or year_from_name(archive.name)
    if year:
        return year
    parent = archive.parent
    if parent != root and parent.parent == root and YEAR_PATTERN.fullmatch(parent.name):
        return parent.name
    raise ValueError(f"kan inte avgöra år för {basename!r}")


def is_symlink(member: ZipInfo) -> bool:
    return stat.S_ISLNK((member.external_attr >> 16) & 0xFFFF)


def safe_members(archive: ZipFile) -> list[tuple[ZipInfo, str]]:
    members: list[tuple[ZipInfo, str]] = []
    basenames: set[str] = set()
    for member in archive.infolist():
        normalized = member.filename.replace("\\", "/")
        path = PurePosixPath(normalized)
        if member.is_dir():
            continue
        if (not normalized
                or normalized.startswith("/")
                or ".." in path.parts
                or is_symlink(member)):
            raise ValueError(f"osäker sökväg i arkivet: {member.filename!r}")
        basename = path.name
        if not basename or basename in basenames:
            raise ValueError(f"filnamnskrock inne i arkivet: {basename!r}")
        basenames.add(basename)
        members.append((member, basename))
    if not members:
        raise ValueError("arkivet innehåller inga vanliga filer")
    return members


def file_hash(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        while chunk := source.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def validate_archive_location(root: Path, archive: Path) -> None:
    if root not in archive.parents:
        raise ValueError("ZIP-filen ligger inte under demos-mappen")
    if archive.suffix.lower() != ".zip" or not archive.is_file() or archive.is_symlink():
        raise ValueError("sökvägen är inte en vanlig ZIP-fil")


def unpack_one(root: Path, archive_path: Path, execute: bool) -> tuple[str, str]:
    archive = archive_path.resolve(strict=True)
    validate_archive_location(root, archive)
    original_identity = archive_identity(archive)

    try:
        with ZipFile(archive) as zip_file:
            members = safe_members(zip_file)
            years = [target_year(root, archive, basename) for _, basename in members]
            destinations = [root / year / basename for year, (_, basename) in zip(years, members)]
            existing = [target.name for target in destinations if target.exists()]
            if not execute:
                detail = f"{len(members)} fil(er) till {'/'.join(sorted(set(years)))}"
                if existing:
                    detail += f"; {len(existing)} befintliga jämförs vid körning"
                return "WOULD", detail

            needed = sum(member.file_size for member, _ in members)
            free = shutil.disk_usage(root).free
            if free < needed + SPACE_RESERVE_BYTES:
                raise OSError(
                    f"för lite ledigt utrymme: behöver minst "
                    f"{(needed + SPACE_RESERVE_BYTES) / 1024**3:.2f} GiB"
                )

            for destination in destinations:
                destination.parent.mkdir(exist_ok=True)

            with tempfile.TemporaryDirectory(prefix=TEMP_PREFIX, dir=root) as temp_name:
                temp_dir = Path(temp_name)
                staged: list[tuple[Path, Path]] = []
                for index, ((member, basename), final) in enumerate(zip(members, destinations)):
                    staged_path = temp_dir / f"{index:04d}-{basename}"
                    with zip_file.open(member) as source, staged_path.open("xb") as destination:
                        shutil.copyfileobj(source, destination, length=1024 * 1024)
                        destination.flush()
                        os.fsync(destination.fileno())
                    staged.append((staged_path, final))

                # Preflight every destination before moving a single file.
                for staged_path, destination in staged:
                    if destination.exists():
                        if destination.is_symlink() or not destination.is_file() or not filecmp.cmp(
                            staged_path, destination, shallow=False,
                        ):
                            raise FileExistsError(
                                f"annan fil finns redan och skrivs INTE över: {destination.name}"
                            )

                expected: dict[Path, tuple[int, str]] = {}
                for staged_path, destination in staged:
                    expected[destination] = (staged_path.stat().st_size, file_hash(staged_path))
                    if destination.exists():
                        continue
                    staged_path.chmod(0o644)
                    os.replace(staged_path, destination)

                # Verify the final files before considering deletion of the ZIP.
                for destination, (size, digest) in expected.items():
                    if (not destination.is_file()
                            or destination.stat().st_size != size
                            or file_hash(destination) != digest):
                        raise OSError(f"verifieringen misslyckades för {destination.name}")

        # Refuse to delete if the archive path was replaced while it was processed.
        if archive_identity(archive) != original_identity:
            raise OSError("ZIP-filen ändrades under körningen och behålls därför")
        archive.unlink()
        return "DONE", (
            f"{len(members)} fil(er) till {'/'.join(sorted(set(years)))}; "
            "exakt denna ZIP togs bort"
        )
    except (BadZipFile, OSError, RuntimeError, ValueError) as error:
        return "KEPT", str(error)


def main() -> int:
    args = arguments()
    root = args.root.expanduser().resolve(strict=True)
    if not root.is_dir():
        raise SystemExit(f"Demos-mappen finns inte: {root}")
    if args.limit is not None and args.limit < 1:
        raise SystemExit("--limit måste vara minst 1")

    selected_years = set(args.year or [])
    invalid_years = sorted(year for year in selected_years if not YEAR_PATTERN.fullmatch(year))
    if invalid_years:
        raise SystemExit(f"Ogiltigt år: {', '.join(invalid_years)}")

    def planned_year(archive: Path) -> str | None:
        try:
            return target_year(root, archive, archive.name)
        except ValueError:
            return None

    archives = sorted(
        path
        for path in root.rglob("*")
        if path.suffix.lower() == ".zip"
        and path.is_file()
        and not path.is_symlink()
        and not any(part.startswith(TEMP_PREFIX) for part in path.relative_to(root).parts)
        and (not selected_years or planned_year(path) in selected_years)
    )
    if args.limit is not None:
        archives = archives[:args.limit]

    mode = "KÖRNING" if args.execute else "TORRKÖRNING"
    print(f"{mode}: {len(archives)} ZIP-fil(er) under {root}")
    if not args.execute:
        print("Ingenting packas upp eller tas bort. Lägg till --execute när listan ser rätt ut.\n")

    counts = {"WOULD": 0, "DONE": 0, "KEPT": 0}
    try:
        for index, archive in enumerate(archives, start=1):
            status, detail = unpack_one(root, archive, args.execute)
            counts[status] += 1
            print(f"[{index}/{len(archives)}] {status:5} {archive.relative_to(root)} — {detail}")
    except KeyboardInterrupt:
        print("\nAvbruten. Aktuell ZIP behölls om den inte redan hunnit verifieras och tas bort.")
        return 130

    print(
        f"\nKlart: {counts['DONE']} uppackade, {counts['WOULD']} planerade, "
        f"{counts['KEPT']} behållna på grund av fel/krock."
    )
    return 1 if counts["KEPT"] else 0


if __name__ == "__main__":
    sys.exit(main())
