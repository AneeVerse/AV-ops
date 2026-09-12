import fs from 'fs'
import path from 'path'

const replacements = [
  ['Chocomelon Baby', 'One Carat'],
  ['Chocomelon', 'One Carat'],
  ['ChocoMelon', 'One Carat'],
  ['chocomelonllp@gmail.com', 'support@onecarat.world'],
  ['NEXT_PUBLIC_SHOP_NAME ?? "One Carat"', 'NEXT_PUBLIC_SHOP_NAME ?? "One Carat"'], // noop safety
  ["kids' fashion", 'moissanite jewelry'],
  ['premium kids\' fashion', 'premium moissanite jewelry'],
  ['Why Choose One Carat?', 'The One Carat Promise'],
]

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full)
    else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
      let content = fs.readFileSync(full, 'utf8')
      const original = content
      for (const [from, to] of replacements) {
        content = content.split(from).join(to)
      }
      if (content !== original) {
        fs.writeFileSync(full, content)
        console.log('updated:', path.relative(process.cwd(), full))
      }
    }
  }
}

walk(path.join(process.cwd(), 'src'))
console.log('done')
