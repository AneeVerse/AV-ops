# ScrapeGraphAI system install

Installed for shared server use in an isolated Python virtual environment.

## Paths

- Environment: `/opt/scrapegraphai/.venv`
- Shared Playwright browsers: `/opt/scrapegraphai/ms-playwright`
- Python wrapper: `/usr/local/bin/scrapegraphai-python`
- Pip wrapper: `/usr/local/bin/scrapegraphai-pip`
- Playwright wrapper: `/usr/local/bin/scrapegraphai-playwright`

## Usage

Run Python scripts with:

```bash
scrapegraphai-python your_script.py
```

Install/update packages inside this isolated environment with:

```bash
scrapegraphai-pip install <package>
```

Use Playwright helper with:

```bash
scrapegraphai-playwright --version
```

## Notes

ScrapeGraphAI usually needs an LLM API key or local model config depending on provider, for example `OPENAI_API_KEY`, `GEMINI_API_KEY`, or Ollama/local model settings.
