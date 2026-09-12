# PDF to PPT Automation System

This document explains the proposed automation system for turning long PDFs into clean PowerPoint presentations. The system should support large source documents, extract text from every page, and generate a concise presentation by selecting from an approved template library.

The main goal is to reduce manual presentation work while keeping strict control over brand assets, fonts, layout, and final PPTX quality. The output should remain editable in PowerPoint and should not depend on Google Slides because custom fonts may break there.

The workflow begins with a Next.js user interface. The user uploads a PDF, enters a project name, chooses a target slide count, and optionally provides tone, audience, or brand notes. The default target is ten slides, but the system can adjust if the content clearly requires fewer or more.

After upload, n8n saves the PDF to Google Drive and extracts all text from all pages. If the PDF is large, the extracted text is chunked for AI processing. The system then summarizes the content, identifies the main storyline, and creates a slide outline.

The template library JSON controls slide selection. Each template has a category, purpose, character limits, usage rules, and image requirements. The AI must choose templates based on the type of content and must write slide copy that fits the selected template.

Images should be generated only when needed. The first slide always requires a generated hero image with clean space on the left side and main visual detail on the right. Other images should be generated only when the selected template has an intended image area. Logos, icons, and brand assets must never be replaced.

The PPTX builder receives the final slide payload and assembles the presentation using approved PPTX templates. It replaces only mapped text placeholders and approved image placeholders. It must not change fonts, colors, shapes, logos, or layout.

The final PowerPoint file is saved to Google Drive and returned to the user through the UI. Logs, extracted text, generated content, images, and final outputs are stored in the same PDF to PPT project folder for easy review and debugging.
