# PDF to PPT Workflow

MVP: convert a PDF into an editable 10-slide PPTX.

## Local flow

1. Extract PDF content/assets.
2. Create structured deck plan JSON.
3. Generate editable PPTX.
4. Validate output.

## Future n8n flow

n8n will orchestrate this same workflow by calling the Python runner via Execute Command or HTTP API.
