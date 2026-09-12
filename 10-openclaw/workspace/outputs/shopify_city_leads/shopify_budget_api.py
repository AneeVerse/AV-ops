#!/usr/bin/env python3
import json, os, re, subprocess, time
from pathlib import Path
from fastapi import FastAPI
from pydantic import BaseModel, Field
from typing import Optional

ROOT = Path('/root/.openclaw/workspace')
RUNNER = ROOT / 'outputs/shopify_city_leads/ny_to_1000_runner.py'
STATE = ROOT / 'outputs/shopify_city_leads/automation_state.json'
LOG = ROOT / 'outputs/shopify_city_leads/n8n_budget_api.log'

app = FastAPI(title='Shopify Budget Lead API', version='0.1.0')

class BatchRequest(BaseModel):
    # If omitted, API reads/increments nextBudgetBatch from automation_state.json.
    batch: Optional[int] = Field(default=None, ge=0, le=10000)
    maxCandidates: int = Field(default=8, ge=1, le=25)
    maxQueries: int = Field(default=6, ge=1, le=12)
    resultsPerPage: int = Field(default=5, ge=1, le=10)
    verifyTimeout: int = Field(default=5, ge=3, le=10)
    targetShopifyNy: int = Field(default=500, ge=1, le=1000)
    dailyBudgetUsd: float = Field(default=0.50, ge=0.001, le=4.0)

@app.get('/health')
def health():
    return {'ok': True, 'service': 'shopify-budget-api'}

@app.post('/shopify-ny-budget-batch')
def run_batch(req: BatchRequest):
    state = json.loads(STATE.read_text()) if STATE.exists() else {}
    today = time.strftime('%Y-%m-%d', time.gmtime())
    history = state.get('budgetRunHistory') or []
    spent_today = sum(float(x.get('costUsd') or 0) for x in history if x.get('dateUtc') == today)
    if spent_today >= req.dailyBudgetUsd:
        return {
            'ok': True,
            'skipped': True,
            'reason': 'daily_budget_reached',
            'spentTodayUsd': spent_today,
            'dailyBudgetUsd': req.dailyBudgetUsd,
            'request': req.model_dump(),
        }
    batch = req.batch if req.batch is not None else int(state.get('nextBudgetBatch', 48))
    env = os.environ.copy()
    env.update({
        'START_BATCH': str(batch),
        'MAX_APIFY_RUNS': str(batch + 1),
        'MAX_CANDIDATES_PER_RUN': str(req.maxCandidates),
        'MAX_QUERIES_PER_RUN': str(req.maxQueries),
        'APIFY_RESULTS_PER_PAGE': str(req.resultsPerPage),
        'VERIFY_TIMEOUT': str(req.verifyTimeout),
        'TARGET_SHOPIFY_NY': str(req.targetShopifyNy),
        'SHOPIFY_FOCUSED': '1',
    })
    started = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    cmd = ['python3', str(RUNNER)]
    proc = subprocess.run(cmd, cwd=str(ROOT), env=env, capture_output=True, text=True, timeout=900)
    stdout = proc.stdout or ''
    stderr = proc.stderr or ''
    parsed = None
    # Runner prints a JSON object at the end. Parse from the last opening brace if possible.
    for idx in [stdout.rfind('\n{'), stdout.rfind('{')]:
        if idx >= 0:
            try:
                parsed = json.loads(stdout[idx:].strip())
                break
            except Exception:
                pass
    result = {
        'ok': proc.returncode == 0,
        'exitCode': proc.returncode,
        'startedAt': started,
        'finishedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        'request': {**req.model_dump(), 'resolvedBatch': batch},
        'parsed': parsed,
        'stdoutTail': stdout[-4000:],
        'stderrTail': stderr[-2000:],
    }
    LOG.write_text(json.dumps(result, indent=2), encoding='utf-8')
    try:
        state = json.loads(STATE.read_text()) if STATE.exists() else {}
        state['latestN8nBudgetBatch'] = result
        state['status'] = 'n8n_budget_batch_completed' if result['ok'] else 'n8n_budget_batch_failed'
        cost = 0.0
        try:
            parsed_runs = ((result.get('parsed') or {}).get('runs') or [])
            if isinstance(parsed_runs, list):
                cost = sum(float(x.get('cost') or 0) for x in parsed_runs)
        except Exception:
            cost = 0.0
        if not cost:
            matches = re.findall(r'cost=([0-9.]+)', stdout)
            cost = sum(float(x) for x in matches) if matches else 0.0
        history = state.get('budgetRunHistory') or []
        history.append({'dateUtc': today, 'batch': batch, 'costUsd': cost, 'ok': result['ok'], 'finishedAt': result['finishedAt']})
        state['budgetRunHistory'] = history[-500:]
        state['phase1TargetShopifyNy'] = req.targetShopifyNy
        state['dailyBudgetUsd'] = req.dailyBudgetUsd
        if result['ok']:
            used = state.get('usedBudgetBatches') or []
            if batch not in used:
                used.append(batch)
            state['usedBudgetBatches'] = used[-500:]
            state['nextBudgetBatch'] = batch + 1
        STATE.write_text(json.dumps(state, indent=2), encoding='utf-8')
    except Exception:
        pass
    return result
