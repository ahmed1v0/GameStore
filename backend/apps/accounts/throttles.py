import hashlib

from rest_framework.throttling import SimpleRateThrottle


class AuthThrottle(SimpleRateThrottle):
    scope = "auth"

    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}


class EmailIPThrottle(AuthThrottle):
    scope = "email_ip"


class EmailAddressThrottle(SimpleRateThrottle):
    scope = "email_address"

    def get_cache_key(self, request, view):
        email = str(request.data.get("email", "")).strip().lower()
        return self.cache_format % {
            "scope": self.scope,
            "ident": hashlib.sha256(email.encode()).hexdigest(),
        }
