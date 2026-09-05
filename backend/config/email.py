GMAIL_SMTP_HOSTS = frozenset({"smtp.gmail.com", "smtp.googlemail.com"})


def normalize_smtp_password(host, password):
    """Normalize provider-specific presentation formatting without weakening secrets."""
    value = password.strip()
    if host.strip().lower() in GMAIL_SMTP_HOSTS:
        # Google displays 16-character App Passwords grouped with spaces.
        return "".join(value.split())
    return value


def default_from_email(host_user):
    if host_user:
        return f"Game Store <{host_user}>"
    return "Game Store <noreply@example.com>"
