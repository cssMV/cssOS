use axum::response::Html;
use axum::routing::get;
use axum::Router;

use super::openapi::openapi_json;

const DOCS_HTML: &str = r##"<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>cssAPI Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
    <style>
      html, body { margin: 0; padding: 0; }
      #swagger-ui { min-height: 100vh; }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      (function () {
        var u = new URL(window.location.href);
        var lang = u.searchParams.get("lang");
        if (!lang) {
          var nav = (navigator.language || "en").toLowerCase();
          lang = nav.indexOf("zh") >= 0 ? "zh" : "en";
        }
        var title = lang.indexOf("zh") === 0 ? "cssAPI 文档" : "cssAPI Docs";
        document.title = title;
        var specUrl = "/cssapi/v1/openapi.json?lang=" + encodeURIComponent(lang);
        SwaggerUIBundle({
          url: specUrl,
          dom_id: "#swagger-ui",
          deepLinking: true,
          displayRequestDuration: true
        });
      })();
    </script>
  </body>
</html>
"##;

async fn docs_index() -> Html<&'static str> {
    Html(DOCS_HTML)
}

pub fn docs_router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
{
    Router::new()
        .route("/cssapi/v1/docs", get(docs_index))
        .route("/cssapi/v1/openapi.json", get(openapi_json))
}
