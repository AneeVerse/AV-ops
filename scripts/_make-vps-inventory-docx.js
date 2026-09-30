/**
 * Generate Aneeverse VPS Inventory as a Word (.docx) document with tables.
 */
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, WidthType, BorderStyle, ShadingType, AlignmentType,
  Header, Footer, PageNumber } = require('docx');
const fs = require('fs');
const path = require('path');

const BLUE = '1F4E79';
const HEADER_BG = '1F4E79';
const ALT_ROW = 'F2F2F2';
const WARN_BG = 'FFF2CC';
const DANGER_BG = 'FCE4D6';

const border = { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' };
const borders = { top: border, bottom: border, left: border, right: border };
const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

function cell(text, opts = {}) {
  const {
    bold = false, fill = null, width = 2000, color = '333333',
    align = AlignmentType.LEFT, fontSize = 18,
  } = opts;
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: fill ? { type: ShadingType.CLEAR, fill } : undefined,
    children: [
      new Paragraph({
        alignment: align,
        children: [
          new TextRun({
            text: String(text ?? ''),
            bold,
            color: fill === HEADER_BG ? 'FFFFFF' : color,
            size: fontSize,
            font: 'Calibri',
          }),
        ],
      }),
    ],
  });
}

function headerRow(cols, widths) {
  return new TableRow({
    tableHeader: true,
    children: cols.map((c, i) =>
      cell(c, { bold: true, fill: HEADER_BG, width: widths[i], align: AlignmentType.CENTER })
    ),
  });
}

function dataRow(cols, widths, fill = null) {
  return new TableRow({
    children: cols.map((c, i) => cell(c, { width: widths[i], fill })),
  });
}

function makeTable(headers, rows, widths) {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      headerRow(headers, widths),
      ...rows.map((r, idx) => dataRow(r, widths, idx % 2 === 1 ? ALT_ROW : null)),
    ],
  });
}

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 160 },
    children: [new TextRun({ text, bold: true, color: BLUE, size: 28, font: 'Calibri' })],
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 120 },
    children: [new TextRun({ text, bold: true, color: '2E75B6', size: 24, font: 'Calibri' })],
  });
}

function p(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text, size: 20, font: 'Calibri', ...opts })],
  });
}

function bullet(text) {
  return new Paragraph({
    spacing: { after: 60 },
    indent: { left: 360 },
    children: [new TextRun({ text: '•  ' + text, size: 20, font: 'Calibri' })],
  });
}

const w4 = [2200, 2800, 2200, 2160];
const w3 = [3120, 3120, 3120];
const w5 = [1800, 2200, 1800, 1800, 1760];
const w2 = [4000, 5360];

const doc = new Document({
  styles: {
    default: {
      document: {
        styles: [{ id: 'Normal', run: { font: 'Calibri', size: 20 } }],
      },
    },
  },
  sections: [
    {
      properties: {
        page: {
          margin: { top: 720, right: 720, bottom: 720, left: 720 },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Aneeverse VPS Inventory  ·  Confidential',
                  italics: true,
                  size: 16,
                  color: '888888',
                  font: 'Calibri',
                }),
              ],
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: 'Page ', size: 16, color: '888888', font: 'Calibri' }),
                new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '888888', font: 'Calibri' }),
                new TextRun({ text: '  ·  Generated 19 Sep 2026', size: 16, color: '888888', font: 'Calibri' }),
              ],
            }),
          ],
        }),
      },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 },
          children: [
            new TextRun({
              text: 'ANEEVERSE VPS INVENTORY & OPERATIONS GUIDE',
              bold: true,
              size: 36,
              color: BLUE,
              font: 'Calibri',
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [
            new TextRun({
              text: 'Shareable technical overview for ops / handover',
              size: 20,
              color: '666666',
              font: 'Calibri',
            }),
          ],
        }),

        h1('1. Host identity'),
        makeTable(
          ['Field', 'Value'],
          [
            ['Hostname', 'srv1474915'],
            ['Public IP', '148.230.67.132'],
            ['Provider', 'Hostinger VPS'],
            ['OS', 'Ubuntu'],
            ['vCPU', '2'],
            ['RAM', '8 GB'],
            ['Disk', '96 GB'],
            ['Document date', '19 Sep 2026 (live scan)'],
          ],
          w2
        ),

        h1('2. Health at scan time'),
        makeTable(
          ['Metric', 'Value', 'Notes'],
          [
            ['Disk used', '69 GB / 96 GB (72%)', '~28 GB free'],
            ['RAM used', '~5.5 GB / 7.8 GB', '~2.2 GB available'],
            ['Swap used', '~2.5 GB / 8 GB', 'Indicates memory pressure'],
            ['Load average', 'Elevated (e.g. 4 / 12 / 32)', 'Overloaded when all stacks on'],
            ['Uptime', '~39 days', ''],
          ],
          w3
        ),
        p('Running every stack at once on 2 vCPU / 8 GB is tight. Hermes (many agents) + Huly Docker drive most of the load.'),

        h1('3. Public URLs (nginx)'),
        makeTable(
          ['Domain', 'Upstream', 'Application'],
          [
            ['app.aneeverse.com', ':8087 / :3011', 'Huly'],
            ['bot.aneeverse.com', ':18789 (+ sales :3001/:8001)', 'OpenClaw + sales'],
            ['bots.aneeverse.com', ':9119 / :3024 / :6084', 'Hermes + jwel UI + VNC'],
            ['studio.aneeverse.com', ':3000', 'Contentbeta / Studio'],
            ['supabase.aneeverse.com', ':8010', 'Supabase (Studio stack)'],
            ['n8n.aneeverse.com', ':5678', 'n8n'],
            ['md.aneeverse.com', ':6080', 'Obsidian (noVNC)'],
            ['culturajewels.com / api.', ':8000 / :9000', 'Cultura Jewels (Medusa)'],
          ],
          w3
        ),

        h1('4. Applications — disk & RAM'),
        makeTable(
          ['App', 'What it is', 'Disk', 'RAM alone', 'Always-on'],
          [
            ['Huly', 'Work platform (Docker: Cockroach, Elastic, Redpanda, MinIO…)', '~15 GB Docker', '2.5–4 GB', 'High'],
            ['OpenClaw', 'Bot gateway + workspace + sales', '~16 GB', '400–600 MB', 'Medium'],
            ['Hermes', '~14 agent profiles + dashboard', '~3.2 GB', '2–2.5 GB (all agents)', 'Very high'],
            ['Cultura', 'Medusa store + jewelry image tools', '~5.1 GB', '300–500 MB', 'Medium*'],
            ['Studio', 'Contentbeta Next.js', '~909 MB', '70–150 MB', 'Low–Med'],
            ['Supabase', 'Kong/Auth/REST/DB for Studio', '~66 MB + Docker', '300–600 MB', 'Medium'],
            ['n8n', 'Workflow automation', '~5 MB', '~180 MB', 'Low–Med'],
            ['Obsidian', 'Vault via noVNC', '~119 MB + vault', '200–400 MB', 'Medium'],
            ['Tooling', '/root/.local + caches', '~6 GB .local', '0 idle', 'Disk only'],
          ],
          w5
        ),
        p('* Cultura Medusa backend had thousands of PM2 restarts at scan — may be unstable.', { italics: true, color: 'C65911' }),

        h2('4.1 Cultura disk breakdown'),
        makeTable(
          ['Path', 'Size'],
          [
            ['Cultura total', '5.1 GB'],
            ['deploy/ (Medusa)', '4.2 GB'],
            ['jwel_img_gen_ui', '745 MB'],
            ['jwel_img_gen_bridge', '235 MB'],
          ],
          w2
        ),

        h2('4.2 Docker breakdown'),
        makeTable(
          ['Type', 'Size (approx)'],
          [
            ['Images', '~13.5 GB'],
            ['Volumes', '~3 GB'],
            ['Containers', '~0.4 GB'],
            ['Total /var/lib/docker', '~15 GB'],
          ],
          w2
        ),

        h2('4.3 Hermes profiles seen running'),
        makeTable(
          ['Profile'],
          [
            ['aneerequest_operator'],
            ['cb-vidproject'],
            ['img_compress'],
            ['jwelimggen'],
            ['kakashi_tech_cource'],
            ['leadgen / leadgen2'],
            ['meta_ads_agent'],
            ['second_brain'],
            ['seedance_video_gen'],
            ['ugc_video1'],
            ['usopp-ga-ads-av'],
            ['(+ default gateway / dashboard)'],
          ],
          [9360]
        ),

        h1('5. Folder layout'),
        p('/root/projects/'),
        bullet('cultura/ — Medusa deploy + jewelry tools (real files)'),
        bullet('hermes/ — backups/scripts + symlink → /root/.hermes'),
        bullet('app.aneeverse/ — notes + symlink → /opt/huly-selfhost'),
        bullet('studio.aneeverse/ — symlinks → /opt/contentbeta + supabase'),
        bullet('md.aneeverse/ — Obsidian vault (second-brain)'),
        bullet('bot.aneeverse/ — symlink → /root/.openclaw'),
        bullet('n8n.aneeverse/ — symlink → /root/.n8n'),
        bullet('_keys/ — auth key JSON files'),
        bullet('_infra/ — nginx backups'),
        p('Live runtimes NOT moved (services depend on paths): .openclaw, .hermes, .n8n, .pm2, /opt/*, Docker.'),

        h1('6. Will Huly (Docker) + Hermes alone run well?'),
        makeTable(
          ['Setup', 'Verdict on 8 GB / 2 vCPU'],
          [
            ['Huly + Hermes (all ~14 agents)', 'Runs but TIGHT — little headroom'],
            ['Huly + Hermes (3–5 profiles)', 'Should feel GOOD'],
            ['Huly only', 'Comfortable'],
            ['Hermes only (few profiles)', 'Comfortable'],
            ['Everything (current style)', 'Overloaded / swap risk'],
          ],
          w2
        ),
        p('Rough RAM for Huly + full Hermes: ~5.5–7 GB of 8 GB. Prefer reduced Hermes agents.'),

        h1('7. Backups status'),
        new Paragraph({
          spacing: { after: 120 },
          shading: { type: ShadingType.CLEAR, fill: DANGER_BG },
          children: [
            new TextRun({
              text: '  CRITICAL: No full restore kit for a wiped VPS. Off-box copy or Hostinger snapshot required before wipe.',
              bold: true,
              size: 20,
              color: 'C00000',
              font: 'Calibri',
            }),
          ],
        }),
        makeTable(
          ['Data', 'Full backup?', 'On disk'],
          [
            ['Huly DB / workspaces', 'NO full dump found', 'Scripts exist; backups/ folder ~config snippets only'],
            ['Cultura / Medusa', 'NO', 'Live code under projects/cultura'],
            ['OpenClaw', 'NO full export', 'Live /root/.openclaw (~16 GB)'],
            ['Hermes', 'Partial tiny', 'projects/hermes/*-backup* (KB configs)'],
            ['n8n', 'NO', 'Live /root/.n8n'],
            ['Obsidian vault', 'NO offsite', 'projects/md.aneeverse/second-brain'],
            ['nginx', 'Tiny', 'projects/_infra/nginx-backups'],
            ['Hostinger snapshot', 'CHECK PANEL', 'Not visible from inside VM'],
          ],
          w3
        ),

        h1('8. Fresh-start checklist'),
        h2('Phase 0 — Before wipe'),
        bullet('Take Hostinger VPS snapshot'),
        bullet('Copy off-box: .openclaw, .hermes, .n8n, projects/cultura, md vault, contentbeta, supabase'),
        bullet('Huly: run backup-create.sh OR dump Docker volumes (Cockroach/MinIO)'),
        bullet('Copy nginx sites-enabled + letsencrypt + _keys + all .env files'),
        h2('Phase 1 — What to bring back on 8 GB'),
        bullet('Always-on: Huly + few Hermes profiles (or OpenClaw, not both maxed)'),
        bullet('Optional: n8n; Cultura when store must be live'),
        h2('Phase 2 — Rebuild'),
        bullet('Fresh Ubuntu → Docker → nginx → certbot'),
        bullet('Restore one stack at a time; check free -h and uptime after each'),
        h2('Phase 3 — DNS / TLS'),
        bullet('Point domains at VPS IP; restore/renew certificates'),

        h1('9. Known issues'),
        makeTable(
          ['Issue', 'Detail'],
          [
            ['High load', 'Hermes×14 + Huly + other apps together'],
            ['Cultura backend', 'Very high PM2 restart count (unstable)'],
            ['Redpanda unhealthy', 'Often healthcheck false positive if Huly works'],
            ['No disaster backups', 'Must create off-box / Hostinger snapshot first'],
            ['Restart required', 'May appear in Hostinger MOTD after updates'],
          ],
          w2
        ),

        h1('10. Quick commands'),
        p('uptime; free -h; df -h /'),
        p('ls /etc/nginx/sites-enabled/'),
        p('docker ps; docker system df'),
        p('pm2 list'),
        p("pgrep -af hermes_cli; pgrep -af 'openclaw.*gateway'"),
        p('du -sh /root/.openclaw /root/.hermes /root/projects/cultura /opt/contentbeta /var/lib/docker'),

        new Paragraph({ spacing: { before: 400 }, children: [] }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: '— End of document —',
              italics: true,
              size: 18,
              color: '888888',
              font: 'Calibri',
            }),
          ],
        }),
        p('Sizes and status change as data grows. Treat Hostinger snapshot + off-box copies as the real safety net until scheduled full app backups exist.', { italics: true, color: '666666' }),
      ],
    },
  ],
});

const outDir = 'e:\\Projects\\platform-develop\\docs';
const outFile = path.join(outDir, 'VPS-INVENTORY-ANEEVERSE.docx');

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(outFile, buffer);
  console.log('Wrote', outFile, buffer.length, 'bytes');
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
