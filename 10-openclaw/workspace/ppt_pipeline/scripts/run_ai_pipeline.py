#!/usr/bin/env python3
"""PDF -> extraction -> AI planner -> PPTX builder."""
from __future__ import annotations
from pathlib import Path
import json, os, subprocess, sys, time

WORKSPACE=Path(os.getenv('PPT_WORKSPACE', '/root/.openclaw/workspace'))
BASE=Path(os.getenv('PPT_PIPELINE_BASE', str(WORKSPACE/'ppt_pipeline')))
SCRIPTS=BASE/'scripts'
LIBRARY=Path(os.getenv('PPT_LIBRARY_BASE', str(WORKSPACE/'ppt_library')))
BUILDER=LIBRARY/'pptx_builder_repeat.py'

def run(cmd):
    r=subprocess.run(cmd, check=True, capture_output=True, text=True)
    return r.stdout

def main():
    if len(sys.argv)!=2:
        print('Usage: run_ai_pipeline.py input.pdf', file=sys.stderr); sys.exit(2)
    pdf=Path(sys.argv[1]).resolve()
    run_id=f'ai_pipeline_{int(time.time())}'
    out=BASE/'outputs'/run_id; out.mkdir(parents=True, exist_ok=True)
    extraction=out/'extraction'; extraction.mkdir()
    extract_stdout=run([sys.executable, str(SCRIPTS/'extract_pdf_text.py'), str(pdf), str(extraction)])
    planner=out/'planner'; planner.mkdir()
    project_name = os.getenv('PPT_PROJECT_NAME', 'AI Pipeline Test')
    planner_stdout=run([sys.executable, str(SCRIPTS/'ai_slide_planner.py'), str(extraction/'chunks.json'), str(planner), project_name])
    images=out/'generated_images'; images.mkdir()
    image_stdout=run([sys.executable, str(SCRIPTS/'generate_slide_images.py'), str(planner/'build_payload.json'), str(images)])
    pptx=out/'ai_pipeline_output.pptx'
    builder_stdout=run([sys.executable, str(BUILDER), str(planner/'build_payload.json'), str(pptx)])
    summary={
        'success': True,
        'run_id': run_id,
        'input_pdf': str(pdf),
        'output_dir': str(out),
        'extraction': json.loads(extract_stdout),
        'planner': json.loads(planner_stdout),
        'images': json.loads(image_stdout),
        'validation': json.loads((planner/'validation_report.json').read_text()),
        'builder': json.loads(builder_stdout),
        'final_pptx': str(pptx),
    }
    (out/'run_summary.json').write_text(json.dumps(summary, indent=2), encoding='utf-8')
    print(json.dumps(summary, indent=2))

if __name__=='__main__':
    main()
