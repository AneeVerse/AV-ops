#!/usr/bin/env python3
"""AI slide planner for PDF -> PPTX pipeline.

Uses OpenRouter if OPENROUTER_API_KEY is available, otherwise Gemini if
GEMINI_API_KEY is available. Falls back to deterministic heuristic mode.

Outputs:
- ai_document_plan.json
- build_payload.json
- validation_report.json
"""
from __future__ import annotations
from pathlib import Path
import json, os, re, sys, time, urllib.request

WORKSPACE = Path(os.getenv('PPT_WORKSPACE', '/root/.openclaw/workspace'))

# Load local .env files for standalone/script execution.
_env_candidates = [
    Path(os.getenv('PPT_ENV_FILE', '')) if os.getenv('PPT_ENV_FILE') else None,
    WORKSPACE / '.env',
    Path('/root/.env'),
]
for _env_path in [p for p in _env_candidates if p]:
    try:
        _env_exists = _env_path.exists()
    except PermissionError:
        continue
    if _env_exists:
        try:
            _env_lines = _env_path.read_text(errors='ignore').splitlines()
        except PermissionError:
            continue
        for _line in _env_lines:
            if '=' in _line and not _line.strip().startswith('#'):
                _k, _v = _line.split('=', 1)
                os.environ.setdefault(_k.strip(), _v.strip().strip('"').strip("'"))

BASE = Path(os.getenv('PPT_PIPELINE_BASE', str(WORKSPACE / 'ppt_pipeline')))
LIBRARY = Path(os.getenv('PPT_LIBRARY_BASE', str(WORKSPACE / 'ppt_library')))
TEMPLATE_JSON = BASE / 'schemas/ppt_template_library.json'
PLACEHOLDER_JSON = BASE / 'schemas/pptx_placeholder_map.json'


def load_json(p: Path):
    return json.loads(p.read_text(encoding='utf-8'))


def save_json(p: Path, data):
    p.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding='utf-8')


def strip_json(text: str):
    text = text.strip()
    if text.startswith('```'):
        text = re.sub(r'^```(?:json)?\s*', '', text)
        text = re.sub(r'\s*```$', '', text)
    start = text.find('{')
    end = text.rfind('}')
    if start >= 0 and end > start:
        text = text[start:end+1]
    return json.loads(text)


def call_openrouter(prompt: str, model: str | None = None):
    key = (
        os.getenv('CB_openrouter_CB_bot_anees')
        or os.getenv('CB_OPENROUTER_CB_BOT_ANEES')
        or os.getenv('CB_OPENROUTER_API_KEY')
        or os.getenv('CB_OPENROUTER')
        or os.getenv('cb_openrouter')
        or os.getenv('OPENROUTER_API_KEY')
    )
    # Prefer project-specific CB OpenRouter vars when present; fallback to OPENROUTER_API_KEY.
    if not key:
        return None
    model = model or os.getenv('PPT_PLANNER_MODEL') or 'openai/gpt-4o-mini'
    payload = {
        'model': model,
        'messages': [
            {'role': 'system', 'content': 'Return valid JSON only. You are a precise PDF-to-PPT planning engine.'},
            {'role': 'user', 'content': prompt},
        ],
        'temperature': 0.2,
    }
    req = urllib.request.Request(
        'https://openrouter.ai/api/v1/chat/completions',
        data=json.dumps(payload).encode('utf-8'),
        headers={
            'Authorization': f'Bearer {key}',
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://aneeverse.com',
            'X-Title': 'PDF to PPT Automation',
        },
        method='POST',
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = json.loads(resp.read().decode('utf-8'))
    return data['choices'][0]['message']['content']


def call_gemini(prompt: str, model: str | None = None):
    key = os.getenv('GEMINI_API_KEY') or os.getenv('GOOGLE_API_KEY')
    if not key:
        return None
    model = model or os.getenv('PPT_PLANNER_GEMINI_MODEL') or 'gemini-2.5-flash'
    url = f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}'
    payload = {
        'contents': [{'parts': [{'text': 'Return valid JSON only.\n\n' + prompt}]}],
        'generationConfig': {'temperature': 0.1, 'responseMimeType': 'application/json'},
    }
    last_err = None
    for attempt in range(4):
        req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers={'Content-Type': 'application/json'}, method='POST')
        try:
            with urllib.request.urlopen(req, timeout=180) as resp:
                data = json.loads(resp.read().decode('utf-8'))
            return data['candidates'][0]['content']['parts'][0]['text']
        except Exception as e:
            last_err = e
            time.sleep(2 * (attempt + 1))
    raise last_err


def ai_call(prompt: str):
    # Prefer Gemini because current OpenRouter key is failing 401 in this environment.
    try:
        r = call_gemini(prompt)
        if r:
            return strip_json(r), 'gemini'
    except Exception as e:
        gemini_error = str(e)
    else:
        gemini_error = ''
    try:
        r = call_openrouter(prompt)
        if r:
            return strip_json(r), 'openrouter'
    except Exception as e:
        openrouter_error = str(e)
    else:
        openrouter_error = ''
    return None, f'fallback_no_ai openrouter={openrouter_error} gemini={gemini_error}'


def summarize_chunks(chunks):
    summaries=[]
    for ch in chunks[:20]:  # large docs still handled through chunking; cap first MVP calls
        prompt=f"""
Summarize this PDF chunk for a PPT generator.
Return JSON only with keys: chunk_index, main_points, important_facts, data_points, potential_slide_messages, risks_or_missing_context.
Chunk {ch['chunk_index']} text:
{ch['text'][:12000]}
"""
        data, provider = ai_call(prompt)
        if not data:
            pts = [s.strip() for s in re.split(r'(?<=[.!?])\s+', ch['text']) if len(s.strip()) > 50][:6]
            data = {'chunk_index': ch['chunk_index'], 'main_points': pts, 'important_facts': [], 'data_points': [], 'potential_slide_messages': pts[:4], 'risks_or_missing_context': []}
        data['_provider'] = provider
        summaries.append(data)
    return summaries


def create_document_plan(summaries, target_slide_count):
    prompt=f"""
Create a presentation storyline from these PDF chunk summaries.
Default target slides: {target_slide_count}. Prefer 10 unless content clearly needs fewer/more.
Return JSON only with keys: document_summary, recommended_slide_count, storyline, key_messages, content_risks, image_opportunities.
Summaries:
{json.dumps(summaries, ensure_ascii=False)[:50000]}
"""
    data, provider = ai_call(prompt)
    if not data:
        messages=[]
        for s in summaries:
            messages += s.get('potential_slide_messages') or s.get('main_points') or []
        data = {
            'document_summary': ' '.join(messages[:3])[:600],
            'recommended_slide_count': target_slide_count,
            'storyline': messages[:target_slide_count],
            'key_messages': messages[:target_slide_count],
            'content_risks': ['AI provider unavailable; fallback heuristic plan used.'],
            'image_opportunities': ['Hero image for slide 1.'],
        }
    data['_provider'] = provider
    return data


def template_roles(placeholder_map, template_id):
    for t in placeholder_map['templates']:
        if t['template_id'] == template_id:
            return [p['role'] for p in t.get('text_placeholders', [])], [p['role'] for p in t.get('image_placeholders', [])]
    return [], []



def normalize_ai_payload(payload, placeholder_map):
    """Normalize common AI schema variants into builder schema."""
    roles = {
        t['template_id']: {
            'text': {x['role'] for x in t.get('text_placeholders', [])},
            'images': {x['role'] for x in t.get('image_placeholders', [])},
        }
        for t in placeholder_map['templates']
    }
    for i, slide in enumerate(payload.get('slides', []), start=1):
        if 'order' not in slide:
            slide['order'] = slide.get('slide_number') or i
        if 'text' not in slide and 'text_content' in slide:
            slide['text'] = slide.get('text_content') or {}
        if 'images' not in slide:
            slide['images'] = {}
        tid = slide.get('template_id')
        allowed_img = roles.get(tid, {}).get('images', set())
        # Convert AI image prompt fields only for allowed image roles.
        image_content = slide.get('image_content') or {}
        if isinstance(image_content, dict):
            for role, prompt in image_content.items():
                normalized_role = 'hero_image' if tid == 'slide_01_hero_cover' else role
                if normalized_role in allowed_img and normalized_role not in slide['images']:
                    slide['images'][normalized_role] = {
                        'prompt': str(prompt),
                        'provider': 'replicate_or_chatgpt',
                        'required': True,
                    }
        # Drop unsupported image roles to avoid touching protected assets.
        slide['images'] = {k: v for k, v in (slide.get('images') or {}).items() if k in allowed_img}
    payload['actual_slide_count'] = len(payload.get('slides', []))
    return payload

def create_build_payload(plan, library, placeholder_map, run_id, project_name, target_slide_count):
    # Ask AI for final payload, but validate/fallback if bad.
    slim_templates=[]
    for t in library['templates']:
        txt_roles, img_roles = template_roles(placeholder_map, t['template_id'])
        slim_templates.append({
            'template_id': t['template_id'], 'name': t['template_name'], 'category': t['category'],
            'sub_category': t['sub_category'], 'quality': t['quality'], 'text_limits': t['text_limits'],
            'when_to_use': t['usage_rules']['when_to_use'], 'when_not_to_use': t['usage_rules']['when_not_to_use'],
            'text_roles': txt_roles, 'image_roles': img_roles,
        })
    prompt=f"""
Create final PPTX build payload JSON using only provided template IDs and text roles.
Target slides: {target_slide_count}. Default 10, flexible only if clearly needed.
Slide 1 must use slide_01_hero_cover and include hero_image prompt only, no local path.
Use text keys exactly matching text_roles.
Do not include image roles that are not listed.
Return JSON only with keys: run_id, project_name, output_file_name, target_slide_count, actual_slide_count, planner_mode, slides.

Document plan:
{json.dumps(plan, ensure_ascii=False)}

Templates:
{json.dumps(slim_templates, ensure_ascii=False)[:50000]}
"""
    data, provider = ai_call(prompt)
    if data and isinstance(data.get('slides'), list):
        data['run_id'] = run_id
        data['project_name'] = project_name
        data.setdefault('output_file_name', f'{project_name}.pptx')
        data.setdefault('target_slide_count', target_slide_count)
        data['planner_mode'] = 'ai'
        data['_provider'] = provider
        return normalize_ai_payload(data, placeholder_map)

    # Fallback deterministic payload that obeys current brand-protected image map.
    msgs = plan.get('key_messages') or plan.get('storyline') or [plan.get('document_summary','Generated from PDF')]
    def msg(i, n=380):
        return (msgs[i % len(msgs)] if msgs else 'Generated from PDF')[:n]
    payload = {
        'run_id': run_id,
        'project_name': project_name,
        'output_file_name': f'{project_name}.pptx',
        'target_slide_count': target_slide_count,
        'actual_slide_count': 10,
        'planner_mode': 'fallback_heuristic',
        '_provider': provider,
        'slides': [
            {'order':1,'template_id':'slide_01_hero_cover','text':{'heading':msg(0,48),'supporting_text':msg(1,130),'section_label':'GENERATED FROM PDF'},'images':{'hero_image':{'prompt':'Professional abstract visual, no text, clean empty darker left side, main detail on right, no logos.'}}},
            {'order':2,'template_id':'slide_14_section_divider_pattern','text':{'heading':'Key Findings','subheading':'A concise overview generated from the source PDF.'}},
            {'order':3,'template_id':'slide_08_text_heavy_insight','text':{'heading':'Main Insight','body':msg(0,560)}},
            {'order':4,'template_id':'slide_10_main_supporting_text','text':{'heading':'What This Means','body_left':msg(1,220),'body_right':msg(2,220)}},
            {'order':5,'template_id':'slide_13_standard_content','text':{'heading':'Supporting Context','body':msg(3,500)}},
            {'order':6,'template_id':'slide_03_metric_overview','text':{'heading':'Document Snapshot','subheading':'Generated summary of extracted content.','section_label':'CONTENT SUMMARY','metric_1_value':str(len(msgs)),'metric_1_label':'Key messages','metric_2_value':str(target_slide_count),'metric_2_label':'Target slides','metric_3_value':'PPTX','metric_3_label':'Output format','metric_4_value':'AI','metric_4_label':'Planning layer','metric_5_value':'JSON','metric_5_label':'Template rules'}},
            {'order':7,'template_id':'slide_08_text_heavy_insight','text':{'heading':'Additional Detail','body':msg(4,560)}},
            {'order':8,'template_id':'slide_10_main_supporting_text','text':{'heading':'Recommended Direction','body_left':msg(5,220),'body_right':msg(6,220)}},
            {'order':9,'template_id':'slide_18_image_only_slide','text':{}},
            {'order':10,'template_id':'slide_15_section_divider_diagonal','text':{'heading':'Next Steps','subheading':'Review, refine, and finalize the generated presentation.'}},
        ]
    }
    return payload


def validate_payload(payload, library, placeholder_map):
    by_template={t['template_id']:t for t in library['templates']}
    roles={t['template_id']:{'text':{p['role'] for p in t.get('text_placeholders',[])}, 'images':{p['role'] for p in t.get('image_placeholders',[])}} for t in placeholder_map['templates']}
    issues=[]
    for slide in payload.get('slides',[]):
        tid=slide.get('template_id')
        if tid not in by_template:
            issues.append({'order':slide.get('order'),'level':'error','message':f'Unknown template_id {tid}'})
            continue
        allowed_text=roles.get(tid,{}).get('text',set())
        allowed_img=roles.get(tid,{}).get('images',set())
        extra_text=set((slide.get('text') or {}).keys())-allowed_text
        extra_img=set((slide.get('images') or {}).keys())-allowed_img
        if extra_text:
            issues.append({'order':slide.get('order'),'level':'warning','message':f'Unsupported text roles ignored by builder: {sorted(extra_text)}'})
        if extra_img:
            issues.append({'order':slide.get('order'),'level':'warning','message':f'Unsupported/protected image roles ignored by builder: {sorted(extra_img)}'})
        limits=by_template[tid]['text_limits']
        combined=' '.join(str(v) for v in (slide.get('text') or {}).values())
        max_body=limits.get('max_body_characters') or 9999
        if len(combined)>max_body+120: # heading included; tolerance for multi-role templates
            issues.append({'order':slide.get('order'),'level':'warning','message':f'Text may exceed body limit: {len(combined)} chars'})
    return {'valid': not any(i['level']=='error' for i in issues), 'issues': issues, 'slide_count': len(payload.get('slides',[]))}


def main():
    if len(sys.argv) != 4:
        print('Usage: ai_slide_planner.py chunks.json output_dir project_name', file=sys.stderr)
        sys.exit(2)
    chunks = load_json(Path(sys.argv[1]))['chunks']
    out_dir = Path(sys.argv[2]); out_dir.mkdir(parents=True, exist_ok=True)
    project_name = sys.argv[3]
    run_id = f'ai_planner_{int(time.time())}'
    target = int(os.getenv('PPT_TARGET_SLIDE_COUNT','10'))
    library=load_json(TEMPLATE_JSON)
    placeholder_map=load_json(PLACEHOLDER_JSON)
    summaries=summarize_chunks(chunks)
    save_json(out_dir/'chunk_summaries.json', {'summaries':summaries})
    plan=create_document_plan(summaries, target)
    save_json(out_dir/'ai_document_plan.json', plan)
    payload=create_build_payload(plan, library, placeholder_map, run_id, project_name, target)
    # For local testing, convert image prompt to test image path for hero only.
    for slide in payload.get('slides',[]):
        if slide.get('template_id')=='slide_01_hero_cover':
            slide.setdefault('images',{})['hero_image']={'path':str(LIBRARY/'test_images/hero.png'),'prompt': slide.get('images',{}).get('hero_image',{}).get('prompt','') if isinstance(slide.get('images',{}).get('hero_image'),dict) else ''}
    validation=validate_payload(payload, library, placeholder_map)
    save_json(out_dir/'build_payload.json', payload)
    save_json(out_dir/'validation_report.json', validation)
    print(json.dumps({'status':'ok','provider':payload.get('_provider'), 'slides':len(payload.get('slides',[])), 'valid':validation['valid'], 'issues':len(validation['issues']), 'output':str(out_dir/'build_payload.json')}, indent=2))

if __name__=='__main__':
    main()
