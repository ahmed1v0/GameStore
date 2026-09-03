import csv
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError, CommandParser
from django.db import transaction

from apps.catalog.models import Product

REQUIRED_COLUMNS = ("id", "title", "description", "price", "location")


class Command(BaseCommand):
    help = "Import or update products from a CSV file."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("csv_path", type=Path)

    def handle(self, *args: Any, **options: Any) -> None:
        csv_path: Path = options["csv_path"]
        products = self._read_and_validate(csv_path)

        created_count = 0
        with transaction.atomic():
            for product_data in products:
                _, created = Product.objects.update_or_create(
                    id=product_data.pop("id"),
                    defaults=product_data,
                )
                created_count += int(created)

        updated_count = len(products) - created_count
        self.stdout.write(
            self.style.SUCCESS(
                f"Imported {len(products)} products "
                f"({created_count} created, {updated_count} updated)."
            )
        )

    def _read_and_validate(self, csv_path: Path) -> list[dict[str, Any]]:
        try:
            with csv_path.open("r", encoding="utf-8-sig", newline="") as csv_file:
                reader = csv.DictReader(csv_file)
                self._validate_headers(reader.fieldnames)

                products: list[dict[str, Any]] = []
                seen_ids: set[int] = set()
                for line_number, row in enumerate(reader, start=2):
                    product = self._parse_row(row, line_number)
                    product_id = product["id"]
                    if product_id in seen_ids:
                        raise CommandError(
                            f"Row {line_number}: duplicate product id {product_id} in CSV."
                        )
                    seen_ids.add(product_id)
                    products.append(product)
        except (OSError, UnicodeError, csv.Error) as exc:
            raise CommandError(f"Could not read CSV file '{csv_path}': {exc}") from exc

        if not products:
            raise CommandError("CSV file contains no product rows.")
        return products

    @staticmethod
    def _validate_headers(fieldnames: list[str] | None) -> None:
        if fieldnames is None:
            raise CommandError("CSV file is missing a header row.")
        missing = [column for column in REQUIRED_COLUMNS if column not in fieldnames]
        if missing:
            raise CommandError(f"CSV file is missing required columns: {', '.join(missing)}.")

    @staticmethod
    def _parse_row(row: dict[str, str | None], line_number: int) -> dict[str, Any]:
        values: dict[str, str] = {}
        for field in REQUIRED_COLUMNS:
            raw_value = row.get(field)
            if raw_value is None or not raw_value.strip():
                raise CommandError(f"Row {line_number}: '{field}' is required.")
            values[field] = raw_value.strip()

        try:
            product_id = int(values["id"])
        except ValueError as exc:
            raise CommandError(f"Row {line_number}: id must be a positive integer.") from exc
        if product_id <= 0:
            raise CommandError(f"Row {line_number}: id must be a positive integer.")

        try:
            price = Decimal(values["price"])
        except InvalidOperation as exc:
            raise CommandError(f"Row {line_number}: price must be a decimal number.") from exc
        if not price.is_finite():
            raise CommandError(f"Row {line_number}: price must be a finite decimal number.")

        product = Product(
            id=product_id,
            title=values["title"],
            description=values["description"],
            price=price,
            location=values["location"].upper(),
        )
        try:
            product.full_clean(validate_unique=False)
        except ValidationError as exc:
            messages = "; ".join(exc.messages)
            raise CommandError(f"Row {line_number}: {messages}") from exc

        return {
            "id": product.id,
            "title": product.title,
            "description": product.description,
            "price": product.price,
            "location": product.location,
        }
