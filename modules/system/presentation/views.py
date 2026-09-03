from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from modules.system.application.get_health import GetHealth
from modules.system.infrastructure.database_probe import DjangoDatabaseProbe


class HealthView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request: Request) -> Response:
        health = GetHealth(DjangoDatabaseProbe()).execute()
        code = 200 if health.is_healthy else 503
        return Response(
            {"service": health.service, "database": health.database},
            status=code,
        )
