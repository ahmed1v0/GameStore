SWAGGER_UI_SETTINGS = r"""
{
  deepLinking: true,
  persistAuthorization: true,
  withCredentials: true,
  requestInterceptor: async (request) => {
    const method = (request.method || "GET").toUpperCase();
    const url = new URL(request.url, window.location.origin);
    const requiresCsrf =
      ["POST", "PUT", "PATCH", "DELETE"].includes(method) &&
      url.origin === window.location.origin &&
      url.pathname.startsWith("/api/v1/");

    if (!requiresCsrf) {
      return request;
    }

    const response = await fetch("/api/v1/auth/csrf", {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: { Accept: "application/json" }
    });

    if (!response.ok) {
      throw new Error(`Unable to initialize CSRF protection (${response.status}).`);
    }

    const body = await response.json();
    const token = body.csrfToken;
    if (typeof token !== "string" || ![32, 64].includes(token.length)) {
      throw new Error("The API returned an invalid CSRF token.");
    }

    const headers = request.headers || {};
    if (typeof headers.delete === "function" && typeof headers.set === "function") {
      headers.delete("X-CSRFToken");
      headers.set("X-CSRFToken", token);
    } else {
      for (const name of Object.keys(headers)) {
        if (name.toLowerCase() === "x-csrftoken") {
          delete headers[name];
        }
      }
      headers["X-CSRFToken"] = token;
    }

    request.headers = headers;
    request.credentials = "same-origin";
    return request;
  }
}
"""
