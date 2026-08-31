import calendar
import re
from datetime import date

from fastapi import HTTPException, status


def validate_period_format(period: str) -> str:
    if not re.fullmatch(r"\d{4}-\d{2}", period):
        raise ValueError("period must be in YYYY-MM format")

    year, month = map(int, period.split("-"))

    if month < 1 or month > 12:
        raise ValueError("period month must be between 01 and 12")

    return period


def parse_period(period: str) -> tuple[date, date]:
    try:
        validate_period_format(period)

        year, month = map(int, period.split("-"))
        last_day = calendar.monthrange(year, month)[1]

        return date(year, month, 1), date(year, month, last_day)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
