from django.test import SimpleTestCase

from modules.system.application.get_health import GetHealth


class StubDatabaseProbe:
    def __init__(self, available: bool) -> None:
        self.available = available

    def is_available(self) -> bool:
        return self.available


class GetHealthTests(SimpleTestCase):
    def test_reports_available_database(self) -> None:
        result = GetHealth(StubDatabaseProbe(True)).execute()

        self.assertTrue(result.is_healthy)
        self.assertEqual(result.database, "up")

    def test_reports_unavailable_database(self) -> None:
        result = GetHealth(StubDatabaseProbe(False)).execute()

        self.assertFalse(result.is_healthy)
        self.assertEqual(result.database, "down")
