from dataclasses import dataclass
from typing import Protocol


class DatabaseProbe(Protocol):
    def is_available(self) -> bool: ...


@dataclass(frozen=True)
class HealthStatus:
    service: str
    database: str

    @property
    def is_healthy(self) -> bool:
        return self.database == "up"
