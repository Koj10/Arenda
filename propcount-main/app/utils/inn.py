def normalize_inn(value: str | None) -> str:
    return "".join(ch for ch in (value or "") if ch.isdigit())
