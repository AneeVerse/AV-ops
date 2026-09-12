#!/usr/bin/env node
/**
 * Medusa 2.12.x admin hardcodes 1MB uploads. Raise to 10MB before admin build.
 */
const { execSync } = require("child_process")
const fs = require("fs")
const path = require("path")

const dashRoot = path.join(process.cwd(), "node_modules", "@medusajs", "dashboard")
if (!fs.existsSync(dashRoot)) {
  process.exit(0)
}

const from = "DEFAULT_MAX_FILE_SIZE = 1024 * 1024"
const to = "DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024"

function patchFile(file) {
  const src = fs.readFileSync(file, "utf8")
  if (!src.includes(from)) return false
  fs.writeFileSync(file, src.split(from).join(to))
  return true
}

let count = 0
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(p)
    else if (/\.(tsx|js|mjs)$/.test(entry.name)) {
      if (patchFile(p)) count++
      const src = fs.readFileSync(p, "utf8")
      if (src.includes('size: "1MB"')) {
        fs.writeFileSync(p, src.split('size: "1MB"').join('size: "10MB"'))
      }
    }
  }
}

walk(dashRoot)
if (count > 0) {
  console.log(`[patch-upload-limit] updated ${count} dashboard file(s) to 10MB`)
}
