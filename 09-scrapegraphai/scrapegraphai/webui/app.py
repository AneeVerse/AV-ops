import os, json, traceback, html
from fastapi import FastAPI, Form, Depends, HTTPException, status
from fastapi.responses import HTMLResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials
import secrets

security = HTTPBasic()
app = FastAPI(title="Aneeverse ScrapeGraphAI")


def auth(credentials: HTTPBasicCredentials = Depends(security)):
    username = os.getenv("SCRAPEGRAPHAI_USERNAME", "ahmad")
    password = os.getenv("SCRAPEGRAPHAI_PASSWORD", "")
    ok_user = secrets.compare_digest(credentials.username, username)
    ok_pass = secrets.compare_digest(credentials.password, password)
    if not (ok_user and ok_pass):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Basic"},
        )
    return credentials.username


def page(body: str) -> HTMLResponse:
    return HTMLResponse(f"""
<!doctype html>
<html>
<head>
  <title>Aneeverse ScrapeGraphAI</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body {{ font-family: system-ui, -apple-system, Segoe UI, sans-serif; max-width: 920px; margin: 40px auto; padding: 0 18px; background:#fafafa; color:#111; }}
    .card {{ background:white; border:1px solid #e5e5e5; border-radius:14px; padding:22px; box-shadow:0 1px 3px #0001; }}
    input, textarea, select {{ width:100%; padding:10px; margin:8px 0 14px; border:1px solid #ddd; border-radius:8px; font:inherit; box-sizing:border-box; }}
    textarea {{ min-height:110px; }}
    button {{ background:#111; color:white; border:0; border-radius:8px; padding:11px 16px; cursor:pointer; font-weight:600; }}
    pre {{ white-space:pre-wrap; background:#111; color:#f6f6f6; padding:16px; border-radius:10px; overflow:auto; }}
    .muted {{ color:#666; font-size:14px; }}
  </style>
</head>
<body>
  <div class="card">
    <h1>Aneeverse ScrapeGraphAI</h1>
    <p class="muted">AI scraping interface for extracting structured data from webpages.</p>
    {body}
  </div>
</body>
</html>
""")


@app.get("/health")
def health():
    return {"ok": True, "provider": os.getenv("SCRAPEGRAPHAI_DEFAULT_PROVIDER", "openrouter"), "model": os.getenv("SCRAPEGRAPHAI_DEFAULT_MODEL", "deepseek/deepseek-v4-flash")}


@app.get("/", response_class=HTMLResponse)
def home(_: str = Depends(auth)):
    default_provider = os.getenv("SCRAPEGRAPHAI_DEFAULT_PROVIDER", "openrouter")
    default_model = os.getenv("SCRAPEGRAPHAI_DEFAULT_MODEL", "deepseek/deepseek-v4-flash")
    def selected(value: str) -> str:
        return " selected" if value == default_provider else ""
    return page(f"""
<form method="post" action="/scrape">
  <label>Website URL</label>
  <input name="url" placeholder="https://example.com" required />

  <label>What data do you want?</label>
  <textarea name="prompt" required>Extract the main company name, emails, phone numbers, services, and useful lead information. Return JSON.</textarea>

  <label>LLM Provider</label>
  <select name="provider">
    <option value="openrouter"{selected('openrouter')}>OpenRouter</option>
    <option value="openai"{selected('openai')}>OpenAI</option>
    <option value="gemini"{selected('gemini')}>Gemini</option>
  </select>

  <label>Model</label>
  <input name="model" value="{html.escape(default_model)}" />

  <button type="submit">Scrape</button>
</form>
<p class="muted">Default configured model: {html.escape(default_provider)} / {html.escape(default_model)}</p>
""")


@app.post("/scrape", response_class=HTMLResponse)
def scrape(
    url: str = Form(...),
    prompt: str = Form(...),
    provider: str = Form(None),
    model: str = Form(None),
    _: str = Depends(auth),
):
    try:
        from scrapegraphai.graphs import SmartScraperGraph

        provider = provider or os.getenv("SCRAPEGRAPHAI_DEFAULT_PROVIDER", "openrouter")
        model = model or os.getenv("SCRAPEGRAPHAI_DEFAULT_MODEL", "deepseek/deepseek-v4-flash")

        if provider == "openrouter":
            api_key = os.getenv("OPENROUTER_API_KEY")
            if not api_key:
                raise RuntimeError("OPENROUTER_API_KEY is not configured on the server.")
            from langchain_openai import ChatOpenAI
            llm = ChatOpenAI(
                model=model,
                api_key=api_key,
                base_url="https://openrouter.ai/api/v1",
                default_headers={
                    "HTTP-Referer": "https://scrape.aneeverse.com",
                    "X-Title": "Aneeverse ScrapeGraphAI",
                },
                temperature=0,
            )
            graph_config = {
                "llm": {"model_instance": llm, "model_tokens": 8192},
                "verbose": False,
                "headless": True,
            }
        elif provider == "gemini":
            if not os.getenv("GEMINI_API_KEY"):
                raise RuntimeError("GEMINI_API_KEY is not configured on the server.")
            llm_model = model if model.startswith("gemini") else "gemini-1.5-flash"
            graph_config = {"llm": {"model": llm_model}, "verbose": False, "headless": True}
        else:
            if not os.getenv("OPENAI_API_KEY"):
                raise RuntimeError("OPENAI_API_KEY is not configured on the server.")
            llm_model = f"openai/{model}" if not model.startswith("openai/") else model
            graph_config = {"llm": {"model": llm_model}, "verbose": False, "headless": True}

        graph = SmartScraperGraph(prompt=prompt, source=url, config=graph_config)
        result = graph.run()
        rendered = json.dumps(result, indent=2, ensure_ascii=False) if not isinstance(result, str) else result
        output = f"<h2>Result</h2><pre>{html.escape(rendered)}</pre><p><a href='/'>Run another scrape</a></p>"
        return page(output)
    except Exception as e:
        err = f"{type(e).__name__}: {e}\n\n{traceback.format_exc()}"
        return page(f"<h2>Error</h2><pre>{html.escape(err)}</pre><p><a href='/'>Back</a></p>")
