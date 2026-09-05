import csv
from collections.abc import Iterator
from contextlib import suppress
from decimal import Decimal
from pathlib import Path
from uuid import uuid4

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import connection
from django.test.utils import CaptureQueriesContext

from apps.catalog.models import Product

pytestmark = pytest.mark.django_db


@pytest.fixture
def csv_path() -> Iterator[Path]:
    test_directory = Path(".test-files")
    test_directory.mkdir(exist_ok=True)
    path = test_directory / f"{uuid4()}.csv"
    yield path
    path.unlink(missing_ok=True)
    with suppress(OSError):
        test_directory.rmdir()


def write_csv(path: Path, rows: list[dict[str, str]], fieldnames: list[str] | None = None) -> None:
    columns = fieldnames or ["id", "title", "description", "price", "location"]
    with path.open("w", encoding="utf-8", newline="") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=columns)
        writer.writeheader()
        writer.writerows(rows)


def product_row(**overrides: str) -> dict[str, str]:
    row = {
        "id": "1",
        "title": "Starter Pack",
        "description": "A digital starter item.",
        "price": "9.99",
        "location": "JO",
    }
    return row | overrides


def test_imports_valid_products(csv_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    write_csv(csv_path, [product_row(), product_row(id="2", location="SA")])

    call_command("import_items", csv_path)

    assert Product.objects.count() == 2
    assert Product.objects.get(id=1).price == Decimal("9.990")
    assert "2 created, 0 updated" in capsys.readouterr().out


def test_import_uses_one_region_lookup_for_the_whole_file(csv_path: Path) -> None:
    write_csv(
        csv_path,
        [product_row(id=str(index), location="JO" if index % 2 else "SA") for index in range(1, 31)],
    )

    with CaptureQueriesContext(connection) as queries:
        call_command("import_items", csv_path)

    region_selects = [
        query["sql"]
        for query in queries
        if 'FROM "catalog_region"' in query["sql"] and query["sql"].lstrip().upper().startswith("SELECT")
    ]
    assert len(region_selects) == 1
    assert Product.objects.count() == 30


def test_second_import_updates_without_duplicates(csv_path: Path) -> None:
    write_csv(csv_path, [product_row()])
    call_command("import_items", csv_path)

    write_csv(csv_path, [product_row(title="Updated Pack", price="12.50")])
    call_command("import_items", csv_path)

    assert Product.objects.count() == 1
    product = Product.objects.get(id=1)
    assert product.title == "Updated Pack"
    assert product.price == Decimal("12.500")


@pytest.mark.parametrize(
    ("overrides", "message"),
    [
        ({"location": "US"}, "not a valid choice"),
        ({"price": "not-money"}, "price must be a decimal number"),
        ({"price": "-0.01"}, "price must be non-negative"),
        ({"id": "0"}, "id must be a positive integer"),
    ],
)
def test_rejects_invalid_rows(csv_path: Path, overrides: dict[str, str], message: str) -> None:
    write_csv(csv_path, [product_row(**overrides)])

    with pytest.raises(CommandError, match=message):
        call_command("import_items", csv_path)

    assert Product.objects.count() == 0


def test_rejects_currency_precision_beyond_minor_unit(csv_path: Path) -> None:
    write_csv(csv_path, [product_row(location="SA", price="1.234")])

    with pytest.raises(CommandError, match="SAR amounts support at most 2 decimal places"):
        call_command("import_items", csv_path)

    assert Product.objects.count() == 0


def test_rejects_missing_required_column(csv_path: Path) -> None:
    write_csv(csv_path, [{"id": "1", "title": "Incomplete"}], fieldnames=["id", "title"])

    with pytest.raises(CommandError, match="missing required columns"):
        call_command("import_items", csv_path)


def test_invalid_later_row_does_not_partially_import(csv_path: Path) -> None:
    write_csv(csv_path, [product_row(), product_row(id="2", price="broken")])

    with pytest.raises(CommandError, match="Row 3"):
        call_command("import_items", csv_path)

    assert Product.objects.count() == 0


def test_rejects_duplicate_ids_within_file(csv_path: Path) -> None:
    write_csv(csv_path, [product_row(), product_row(title="Ambiguous duplicate")])

    with pytest.raises(CommandError, match="duplicate product id 1"):
        call_command("import_items", csv_path)
