from decimal import Decimal


def exceeds_minor_unit(amount: Decimal, minor_unit: int) -> bool:
    """Return whether an amount has precision beyond the currency's minor unit."""
    quantum = Decimal(1).scaleb(-minor_unit)
    return amount != amount.quantize(quantum)


def precision_error(currency_code: str, minor_unit: int) -> str:
    unit_label = "decimal place" if minor_unit == 1 else "decimal places"
    return f"{currency_code} amounts support at most {minor_unit} {unit_label}."
