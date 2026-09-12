import fs from 'fs'
import path from 'path'

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full)
    else if (/\.tsx?$/.test(entry.name)) {
      let content = fs.readFileSync(full, 'utf8')
      const original = content
      content = content.replace(/className="([^"]+)"\s+className="([^"]+)"/g, 'className="$1 $2"')
      if (content !== original) {
        fs.writeFileSync(full, content)
        console.log('fixed:', path.relative(process.cwd(), full))
      }
    }
  }
}

walk(path.join(process.cwd(), 'src'))
console.log('done')
