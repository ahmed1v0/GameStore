from modules.system.domain.health import DatabaseProbe, HealthStatus


class GetHealth:
    def __init__(self, database_probe: DatabaseProbe) -> None:
        self._database_probe = database_probe

    def execute(self) -> HealthStatus:
        database = "up" if self._database_probe.is_available() else "down"
        return HealthStatus(service="api", database=database)
