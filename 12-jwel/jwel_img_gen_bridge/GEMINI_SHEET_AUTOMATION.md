# Gemini Sheet Automation

This automation processes jewelry rows from Google Sheets using the live Gemini browser session and writes the final Google Drive link back to the sheet.

## What it does

For each row:
1. Reads the eBay listing URL from **column B**.
2. Resolves the **first listing image** from the eBay page.
3. Uploads that image into the already logged-in **Gemini browser**.
4. Sends the locked prompt **as-is**.
5. Captures the generated image.
6. Uploads the result to **Google Drive**.
7. Writes the Drive link to **column D** and status to **Done**.

## Credit-saving rules

- Skips rows that are already `Done`.
- Keeps the prompt fixed.
- Uses the first listing image only.
- Reuses the current Gemini browser session instead of launching another generator.

## Script

`/root/jwel_img_gen_bridge/gemini_sheet_automation.py`

## Run one row

```bash
python3 /root/jwel_img_gen_bridge/gemini_sheet_automation.py --serial IMG0001
```

## Run all pending rows

```bash
python3 /root/jwel_img_gen_bridge/gemini_sheet_automation.py --all-pending
```

## n8n usage

Use an **Execute Command** node and call the script above.

Recommended pattern:
- Trigger: manual, cron, webhook, or Google Sheets polling
- Command: `python3 /root/jwel_img_gen_bridge/gemini_sheet_automation.py --all-pending`
- Parse stdout JSON for result objects

## Notes

- The script expects the live Gemini browser to be reachable at `http://localhost:9244`.
- It uses `gog` for Google Sheets and Google Drive access.
- Rows already completed are skipped, so reruns are safe and cheap.
