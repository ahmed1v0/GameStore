import csv
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError, CommandParser
from django.db import transaction

from apps.catalog.models import Product, Region

REQUIRED_COLUMNS = ("id", "title", "description", "price", "location")


class Command(BaseCommand):
    help = "Import or update products from a CSV file."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("csv_path", type=Path)

    def handle(self, *args: Any, **options: Any) -> None:
        csv_path: Path = options["csv_path"]
        regions = Region.objects.filter(is_active=True).in_bulk()
        product_data = self._read_and_validate(csv_path, regions)
        products = [Product(**values) for values in product_data]
        product_ids = [product.id for product in products]

        with transaction.atomic():
            existing_ids = set(
                Product.objects.filter(pk__in=product_ids).values_list("id", flat=True)
            )
            Product.objects.bulk_create(
                products,
                update_conflicts=True,
                update_fields=["title", "description", "price", "location", "updated_at"],
                unique_fields=["id"],
            )

        created_count = len(products) - len(existing_ids)
        updated_count = len(existing_ids)
        self.stdout.write(
            self.style.SUCCESS(
                f"Imported {len(products)} products "
                f"({created_count} created, {updated_count} updated)."
            )
        )

    def _read_and_validate(
        self, csv_path: Path, regions: dict[str, Region]
    ) -> list[dict[str, Any]]:
        try:
            with csv_path.open("r", encoding="utf-8-sig", newline="") as csv_file:
                reader = csv.DictReader(csv_file)
                self._validate_headers(reader.fieldnames)

                products: list[dict[str, Any]] = []
                seen_ids: set[int] = set()
                for line_number, row in enumerate(reader, start=2):
                    product = self._parse_row(row, line_number, regions)
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
    def _parse_row(
        row: dict[str, str | None], line_number: int, regions: dict[str, Region]
    ) -> dict[str, Any]:
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
        if price < 0:
            raise CommandError(f"Row {line_number}: price must be non-negative.")

        location_code = values["location"].upper()
        region = regions.get(location_code)
        if region is None:
            raise CommandError(
                f"Row {line_number}: '{location_code}' is not a valid choice for location."
            )

        product = Product(
            id=product_id,
            title=values["title"],
            description=values["description"],
            price=price,
            location=region,
        )
        try:
            # Validate field shape and domain rules without running database-backed
            # uniqueness/constraint checks for every CSV row. The final bulk write is
            # still protected by database constraints inside one atomic transaction.
            product.clean_fields(exclude=["location"])
            product.clean()
        except ValidationError as exc:
            messages = "; ".join(exc.messages)
            raise CommandError(f"Row {line_number}: {messages}") from exc

        return {
            "id": product.id,
            "title": product.title,
            "description": product.description,
            "price": product.price,
            "location_id": product.location_id,
        }
