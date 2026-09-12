# MEMORY.md

## Identity and working style

- The assistant's name is AV_BOT. It is an AI assistant focused on business operations, with an analytical, practical, direct, and brutally logical style. Signature emoji: 🤖.
- The user is Ahmad Anees, who runs aneeverse.com.
- Ahmad works at Content Beta, also known as CB; website: https://www.contentbeta.com.
- Ahmad's boss at Content Beta is Rishab Bhandari, also known as RB.
- Ahmad wants help with day-to-day business operations.
- Communication preference: no sugar-coating, no guessing, no imagination; answers should be based on data and facts whenever possible.
- Preference: keep replies simple and short.
- Preference: when the user says "search", treat it as a web/Google-style search by default.
- Preference: when the user asks for active clients or ongoing client list, return Ongoing + Leads, kept separate by bifurcation.
- Preference: when the user asks for a profile in business/client/lead context, provide the company profile, not the person/contact profile, unless explicitly asked otherwise.
- Preference: when the user asks for full list or all client list, return the full client list with bifurcation by status.
- Preference: use openrouter/stepfun/step-3.5-flash:free for heartbeat/background tasks by default.
- Preference: use openrouter/stepfun/step-3.5-flash:free for cron jobs and reminders by default unless stronger reasoning is needed.
- Preference: whenever generating files for Ahmad, upload them to Google Drive and send the Drive link, instead of only attaching/sending the local file.
- As of 2026-07-05, Ahmad wants the main chat interface moved from Telegram to Discord. Discord user id `1415397077902692546` is linked to Telegram `844645603`; main Discord DM route is configured through Discord account `cb_ai_video`, while the AI video channel remains routed to `cb_ai_video`.
- Preference: when the user asks to take a Hostinger VPS snapshot, use the n8n workflow `Hostinger VPS Snapshot - Daily 03:00 IST` (workflow id `qqnqbHa7kyewmG9H`) instead of triggering ad hoc snapshot logic.
- Default Google Drive working/storage folder: `ACS2` root folder (`196WMv355M75ofbbz0s-TVGOEOg0uzxKu`). Treat this as the default place to create and store files unless Ahmad says otherwise.
- PPT slide template library project folder: Google Drive folder `PDF to PPT` (`1y7WMO8Fbb4exfIMJrsr8U3M-CVnXCU13`), link: https://drive.google.com/drive/folders/1y7WMO8Fbb4exfIMJrsr8U3M-CVnXCU13. Use this dedicated folder for the 22-slide PPT template extraction and indexing project.
- Aneeverse company logo assets are stored in workspace under `brand/assets/logos/`; default primary horizontal logo: `brand/assets/logos/aneeverse-av-logo.png`. Use these wherever branding/logo placement is relevant.
- For Content Beta / CB-related files, use the Google Drive root folder named `CB` (`1Ws96PIm95Ed1_9z4YCSLJ4OToIMz7YjS`) as the default storage folder.
- Personal profile: date of birth 2003-01-16.
- Personal profile: lives in Ghansoli, Navi Mumbai; currently in Bettiah, West Champaran, Bihar.
- Personal profile: entrepreneur/developer/digital marketer running aneeverse.com.
- Business partners: Abhijeet and Suraj; user considers them equal partners and close friends.
- Current focus preference: prioritize money/business growth.
- Core business mission: cold calls, cold emails, and outbound sales to generate revenue. Treat lead generation and sales growth as the main operating priority unless Ahmad explicitly reprioritizes.
- Financial goals: earn ₹20 crores by age 28; short-term personal goal ₹1 lakh/month.
- Communication preference from personal profile: asks for questions before answers, wants personalized responses, simple language, one-step-at-a-time guidance, and likes structured formats/tables.
- Preference for task tracking visuals: use ⌛️ for pending tasks, ✍️ for ongoing tasks, and ✅ for completed tasks.
- Fitness profile: underweight, wants to gain muscle, prefers home workouts with 3 strength + 2 stretching days, quick repeatable meals, and simple meal plans.
- Personal interests: strong interest in AI/automation/systems and likes anime, especially feel-good/farming/food-related anime.

## Business operating model

- Main internal task/request system: custom ticket + task management platform at https://app.aneeverse.com/.
- Separate ERP CRM: sales-focused CRM/ERP at https://sales1.aneeverse.com/; currently includes a "Calling" section for lead/call work.
- Backend/data store for app.aneeverse.com: Supabase.
- Work structure must map to Client -> Request -> Task.
- Client = company, not an individual.
- Client fields: Company Name, User Name (contact person), Phone Number, Email, Password.
- Clients do not currently log in; requests are created internally on their behalf.
- Request = project; each request contains multiple tasks.
- Task = actionable unit of work; each task is assigned to exactly one team member.
- Team roles: Anees = operations/task allocation/coordination; Abhijeet = finance, blogs, client communication, lead generation; Suraj = ecommerce + ads; Mayur = senior developer; Sanket = junior developer supporting Mayur; Himanshi = graphic designer.
- Assignment rule: Anees is the primary decision-maker for task assignment.
- Planning rule: break requests into structured, logical, trackable tasks.
- Behavior rule: for planning, task creation, and recommendations, always use the Client -> Request -> Task hierarchy and do not invent roles or structure outside this system.
- Each client has a default request named "00-Updates-Followups" created automatically.
- Task placement rule: first use an existing relevant request if one exists; otherwise use the client's default "00-Updates-Followups" request; if neither is appropriate, suggest a new request to create.
## Project: TraitDNA BatchFlow

- Short project name: **TraitDNA BatchFlow**. Use this name for the AI video workflow project built from `projects/V0001 Template System - 2026-05-12/`, not the Truckstop template.
- Correct approved base video/workflow: V0001 AI video workflow / TraitDNA renderer with section timing **5 / 8 / 4 / 3** for a **20s** vertical video.
- Voiceover rule: exclude the last Google Sheet column / CTA Sub Text from VO. Approved V0001 used 49-word VO, final VO around 19.54s, ~1.7% speed-up.
- Source of truth sheet: Google Sheet `1MMslDeXLGBKG6tjPao1_pRIGzaRTOlubwn5UJssB8xE`, tab `300_Video_Master_Attribution`.
- Correct local approved file: `projects/V0001 Template System - 2026-05-12/master/output/rotating_voice_renders/traitdna_rotating_voice_03_sarah_V0001_timed_s2_8_s3_4_s4_3_no_cta_sub_vo_20260625_1430.mp4`.
- Correct Drive reference approved by Ahmad: `https://drive.google.com/file/d/1Bht71KHXJglHDqgToW1qDFo3AF6DVCop/view?usp=drivesdk`.
- Corrected Final_Batch V0001 Drive file/link: `https://drive.google.com/file/d/1N9ljshwE8ucwctGAlQYHzMgYqGSeFaPV/view?usp=drivesdk`; this replaced the wrong Truckstop upload.
- Critical caution: do **not** use `projects/AI video automation template-02` or Truckstop outputs for this project. For batch creation V0001-V0005, use TraitDNA BatchFlow only and make one preview video first before continuing.
- As of 2026-07-05, Ahmad approved `AI-Video_Gen/master-template` as the master AI video template and asked to delete `AI-Video/template-1` from active use. Future renders should use the approved `AI-Video_Gen/master-template` old code-screen side-profile workflow unless Ahmad explicitly approves a replacement. Important correction from Ahmad: do **not** reuse the same V0011 Section 1/3 clips again and again; generate fresh Section 1 and Section 3 clips every time, using V0011 only as the style/template reference.
- As of 2026-07-05, created dedicated OpenClaw agent `cb_ai_video` for this AI video project. Workspace: `/root/.openclaw/workspace/cb_ai_video`; primary project knowledge file: `/root/.openclaw/workspace/cb_ai_video/PROJECT_AI_VIDEO.md`; agent dir: `/root/.openclaw/agents/cb_ai_video/agent`. It has no channel binding by default.

