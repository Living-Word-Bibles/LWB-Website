#!/usr/bin/env python3
from __future__ import annotations

import os
import re
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

README = Path("README.md")
EASTERN = ZoneInfo("America/New_York")
UTC = ZoneInfo("UTC")

PATTERN = re.compile(
    r"^\*\*README last updated:\*\*\s+\*\*.*?\*\*\s*$",
    re.MULTILINE,
)

MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]


def parse_manual_time(value: str) -> datetime:
    """
    Accepted manual input:
      09:44:00
      09:44
      2:30 PM
      2026-09-19T14:30:00-04:00

    Time-only input is interpreted as America/New_York on today's Eastern date.
    Full ISO input with an offset is converted to UTC.
    """
    value = value.strip()

    if "T" in value:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=EASTERN)
        return dt.astimezone(UTC)

    today_eastern = datetime.now(EASTERN).date()

    for fmt in ("%H:%M:%S", "%H:%M", "%I:%M:%S %p", "%I:%M %p"):
        try:
            parsed = datetime.strptime(value.upper(), fmt).time()
            local_dt = datetime.combine(today_eastern, parsed, tzinfo=EASTERN)
            return local_dt.astimezone(UTC)
        except ValueError:
            pass

    raise SystemExit(
        "Invalid manual_time. Use HH:MM[:SS], h:mm[:ss] AM/PM, "
        "or a full ISO timestamp such as 2026-09-19T14:30:00-04:00."
    )


def determine_timestamp() -> datetime:
    manual = os.environ.get("MANUAL_TIME", "").strip()
    event_name = os.environ.get("EVENT_NAME", "").strip()

    if manual:
        return parse_manual_time(manual)

    if event_name == "schedule":
        today_eastern = datetime.now(EASTERN).date()
        scheduled_local = datetime(
            today_eastern.year,
            today_eastern.month,
            today_eastern.day,
            9, 0, 0,
            tzinfo=EASTERN,
        )
        return scheduled_local.astimezone(UTC)

    return datetime.now(UTC)


def format_line(dt_utc: datetime) -> str:
    dt_utc = dt_utc.astimezone(UTC)
    month = MONTHS[dt_utc.month - 1]
    return (
        f"**README last updated:** "
        f"**{dt_utc.day:02d} {month} {dt_utc.year} "
        f"at {dt_utc:%H:%M:%S}Z UTC**"
    )


def main() -> None:
    if not README.exists():
        raise SystemExit("README.md was not found.")

    text = README.read_text(encoding="utf-8")
    replacement = format_line(determine_timestamp())

    updated, count = PATTERN.subn(replacement, text, count=1)

    if count != 1:
        raise SystemExit(
            "Could not find exactly one '**README last updated:** **...**' line."
        )

    README.write_text(updated, encoding="utf-8")
    print(replacement)


if __name__ == "__main__":
    main()
