#!/usr/bin/env python3
"""Local end-to-end backend skeleton: PDF -> text -> slide payload -> PPTX."""
from __future__ import annotations
from pathlib import Path
import json, subprocess, sys, time

BASE = Path('/root/.openclaw/workspace/ppt_pipeline')
SCRIPTS = BASE / 'scripts'
BUILDER = SCRIPTS / 'pptx_builder.py'
# Use latest brand-protected repeat-capable builder from ppt_library.
REPEAT_BUILDER = Path('/root/.openclaw/workspace/ppt_library/pptx_builder_repeat.py')


def run(cmd):
    r = subprocess.run(cmd, check=True, capture_output=True, text=True)
    return r.stdout


def main():
    if len(sys.argv) != 2:
        print('Usage: run_local_pipeline.py input.pdf', file=sys.stderr)
        sys.exit(2)
    pdf = Path(sys.argv[1]).resolve()
    run_id = f'local_pipeline_{int(time.time())}'
    out_dir = BASE / 'outputs' / run_id
    out_dir.mkdir(parents=True, exist_ok=True)

    extraction_dir = out_dir / 'extraction'
    extraction_dir.mkdir()
    extract_stdout = run([sys.executable, str(SCRIPTS / 'extract_pdf_text.py'), str(pdf), str(extraction_dir)])

    payload_path = out_dir / 'build_payload.json'
    plan_stdout = run([sys.executable, str(SCRIPTS / 'generate_slide_plan.py'), str(extraction_dir / 'extracted_text.txt'), str(payload_path)])

    pptx_path = out_dir / 'local_pipeline_output.pptx'
    builder_stdout = run([sys.executable, str(REPEAT_BUILDER), str(payload_path), str(pptx_path)])
    builder_result = json.loads(builder_stdout)

    summary = {
        'success': True,
        'run_id': run_id,
        'input_pdf': str(pdf),
        'output_dir': str(out_dir),
        'extraction': json.loads(extract_stdout),
        'planning': json.loads(plan_stdout),
        'builder': builder_result,
        'final_pptx': str(pptx_path),
    }
    (out_dir / 'run_summary.json').write_text(json.dumps(summary, indent=2), encoding='utf-8')
    print(json.dumps(summary, indent=2))

if __name__ == '__main__':
    main()
