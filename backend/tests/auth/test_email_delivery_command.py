from io import StringIO

import pytest
from django.core import mail
from django.core.management import call_command
from django.core.management.base import CommandError


def test_email_delivery_command_sends_text_and_html():
    output = StringIO()
    call_command("test_email_delivery", "owner@example.com", stdout=output)
    assert "accepted" in output.getvalue()
    assert len(mail.outbox) == 1
    assert mail.outbox[0].to == ["owner@example.com"]
    assert mail.outbox[0].alternatives[0].mimetype == "text/html"


def test_email_delivery_command_validates_recipient():
    with pytest.raises(CommandError, match="valid email"):
        call_command("test_email_delivery", "not-an-address")
