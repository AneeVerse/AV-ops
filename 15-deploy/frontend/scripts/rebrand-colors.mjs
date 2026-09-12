import fs from 'fs'
import path from 'path'

const srcDir = path.join(process.cwd(), 'src')

const replacements = [
  ['bg-[#FFFAFE]', 'bg-ivory-bg'],
  ['text-pink-500', 'text-gold-accent'],
  ['hover:text-pink-500', 'hover:text-gold-accent'],
  ['!bg-[#8B5AB1]', '!bg-royal-blue'],
  ['bg-[#8B5AB1]', 'bg-royal-blue'],
  ['text-[#8B5AB1]', 'text-gold-accent'],
  ['border-[#8B5AB1]', 'border-gold-accent'],
  ['ring-[#8B5AB1]', 'ring-gold-accent'],
  ['hover:bg-[#7a4a9a]', 'hover:bg-gold-accent'],
  ['hover:bg-[#7a4f9b]', 'hover:bg-gold-accent'],
  ['hover:!bg-[#7a4a9f]', 'hover:!bg-gold-accent'],
  ['hover:text-[#7a4f9b]', 'hover:text-gold-hover'],
  ['#8B5AB1/10', 'gold-accent/10'],
  ['#8B5AB1/20', 'gold-accent/20'],
  ['#8B5AB1/30', 'gold-accent/30'],
  ['border-purple-100', 'border-gold-accent/10'],
  ['bg-purple-100', 'bg-gold-accent/10'],
  ['shadow-purple-200/50', 'shadow-gold-accent/20'],
  ['to-purple-50/30', 'to-gold-accent/5'],
  ['text-purple-600', 'text-gold-accent'],
  ['#FE5FB7', '#D4AF37'],
  ['fill-purple-100', 'fill-gold-accent/10'],
  ['from-[#A879CF] to-[#8B5AB1]', 'from-royal-blue to-royal-blue'],
  ['from-[#8B5AB1] to-[#784ca1]', 'from-royal-blue to-royal-blue'],
  ['shadow-[#8B5AB1]/20', 'shadow-royal-blue/20'],
  ['shadow-[#8B5AB1]/30', 'shadow-royal-blue/30'],
  ['shadow-[0_4px_12px_rgba(139,90,177,0.3)]', 'shadow-md'],
  ['shadow-[0_12px_32px_rgba(139,90,177,0.25)]', 'shadow-lg'],
  ['shadow-[0_16px_40px_rgba(139,90,177,0.35)]', 'shadow-xl'],
  ['shadow-[0_20px_40px_-10px_rgba(139,90,177,0.6)]', 'shadow-xl'],
  ["style={{ color: '#8B5AB1' }}", 'className="text-gold-accent"'],
  ['style={{ color: "#8B5AB1" }}', 'className="text-gold-accent"'],
  ["style={{ backgroundColor: '#8B5AB1' }}", 'className="bg-royal-blue"'],
  ['style={{ backgroundColor: "#8B5AB1" }}', 'className="bg-royal-blue"'],
  ["backgroundColor: '#8B5AB1', borderColor: '#8B5AB1'", "className: 'bg-royal-blue border-royal-blue'"],
  ['backgroundColor: "#FFFAFE"', 'className="bg-ivory-bg"'],
  ["e.currentTarget.style.backgroundColor = '#8B5AB1'", "e.currentTarget.classList.remove('bg-gold-accent'); e.currentTarget.classList.add('bg-royal-blue')"],
  ["e.currentTarget.style.backgroundColor = '#7a4a9a'", "e.currentTarget.classList.remove('bg-royal-blue'); e.currentTarget.classList.add('bg-gold-accent')"],
  ['background: #8B5AB1;', 'background: #0A1D37;'],
  ['stroke="#8B5AB1"', 'stroke="#D4AF37"'],
  ["borderColor: '#8B5AB1'", "className: 'border-gold-accent'"],
  ["color: '#8B5AB1'", "className: 'text-gold-accent'"],
  ['from-[#8B5AB1] to-[#A885C9]', 'from-royal-blue to-gold-accent'],
  ['from-purple-50 to-[#FFFAFE]', 'from-ivory-bg to-ivory-bg'],
  ['3px solid #8B5AB1', '3px solid #D4AF37'],
  ['from-[#8B5AB1] via-[#D97706] to-[#8B5AB1]', 'from-royal-blue via-gold-accent to-royal-blue'],
  ['shadow-[0_20px_50px_rgba(139,90,177,0.2)]', 'shadow-xl'],
  ["backgroundColor: '#8B5AB1'", "backgroundColor: '#0A1D37'"],
  ['backgroundColor: "#8B5AB1"', 'backgroundColor: "#0A1D37"'],
  ["backgroundColor: '#8B5AB1', color: 'white'", "className: 'bg-royal-blue text-white'"],
  ["color: '#8B5AB1'", "color: '#D4AF37'"],
  ['color: "#8B5AB1"', 'color: "#D4AF37"'],
  ['border-color: #8B5AB1', 'border-color: #D4AF37'],
  ["border: '1px solid #8B5AB1'", "border: '1px solid #D4AF37'"],
  ["backgroundColor: '#8B5AB133'", "backgroundColor: 'rgba(212,175,55,0.2)'"],
  ["e.currentTarget.style.backgroundColor = '#8B5AB133'", "e.currentTarget.style.backgroundColor = 'rgba(212,175,55,0.2)'"],
  ['background: "#FFFAFE"', 'background: "#FCFBF7"'],
  ["style={{ backgroundColor: '#FFFAFE' }}", 'className="bg-ivory-bg"'],
  ['from-[#8B5AB1] to-purple-400', 'from-royal-blue to-gold-accent'],
  ['linear-gradient(135deg, #8B5AB1, #a855f7)', 'linear-gradient(135deg, #0A1D37, #D4AF37)'],
  ['linear-gradient(135deg, #8B5AB1 0%, #a855f7 50%, #8B5AB1 100%)', 'linear-gradient(135deg, #0A1D37 0%, #D4AF37 50%, #0A1D37 100%)'],
  ['rgba(139,90,177,0.2)', 'rgba(212,175,55,0.2)'],
  ['rgba(139,90,177,0.1)', 'rgba(212,175,55,0.1)'],
  ['rgba(139,90,177,0.08)', 'rgba(212,175,55,0.08)'],
  ['rgba(139,90,177,0.35)', 'rgba(10,29,55,0.2)'],
  ['rgba(139,90,177,0.3)', 'rgba(10,29,55,0.15)'],
  ['rgba(139,90,177,0.4)', 'rgba(10,29,55,0.25)'],
  ['#f3e8ff, #ede9fe', '#FCFBF7, #F5F0E8'],
  ['radial-gradient(circle, #8B5AB1', 'radial-gradient(circle, #D4AF37'],
  ['style={showPickupOptions === PICKUP_OPTION_ON ? { className: \'bg-royal-blue border-royal-blue\' } : { borderColor: \'#C0C0C0\' }}', 'className={`${showPickupOptions === PICKUP_OPTION_ON ? \'bg-royal-blue border-royal-blue\' : \'border-gray-300\'}`}'],
  ['style={isSelected && !isDisabled ? { className: \'bg-royal-blue border-royal-blue\' } : { borderColor: \'#C0C0C0\' }}', 'className={`${isSelected && !isDisabled ? \'bg-royal-blue border-royal-blue\' : \'border-gray-300\'}`}'],
  ['style={isSelected && !option.insufficient_inventory ? { className: \'bg-royal-blue border-royal-blue\' } : { borderColor: \'#C0C0C0\' }}', 'className={`${isSelected && !option.insufficient_inventory ? \'bg-royal-blue border-royal-blue\' : \'border-gray-300\'}`}'],
  ['style={{ className: \'bg-royal-blue border-royal-blue\' }}', 'className="bg-royal-blue border-royal-blue"'],
  ['style={addressType === "HOME" ? { className: \'bg-royal-blue border-royal-blue\' } : {}}', 'className={addressType === "HOME" ? "bg-royal-blue border-royal-blue text-white" : ""}'],
  ['style={addressType === "OFFICE" ? { className: \'bg-royal-blue border-royal-blue\' } : {}}', 'className={addressType === "OFFICE" ? "bg-royal-blue border-royal-blue text-white" : ""}'],
  ['#8B5AB1', '#D4AF37'],
  ['focus:ring-purple-500', 'focus:ring-gold-accent'],
  ['focus:ring-purple-200', 'focus:ring-gold-accent/30'],
  ['bg-purple-50/50', 'bg-gold-accent/10'],
  ['bg-purple-50/30', 'bg-gold-accent/10'],
  ['hover:bg-purple-50/50', 'hover:bg-gold-accent/10'],
  ['hover:bg-purple-50', 'hover:bg-gold-accent/10'],
  ['bg-purple-50', 'bg-gold-accent/10'],
  ['border-purple-200', 'border-gold-accent/20'],
  ['text-purple-800', 'text-royal-blue'],
  ['text-purple-900', 'text-royal-blue'],
  ['text-purple-400', 'text-gold-accent/70'],
  ['text-purple-700', 'text-royal-blue'],
  ['bg-purple-200', 'bg-gold-accent/20'],
  ['bg-purple-500', 'bg-royal-blue'],
  ['shadow-purple-100', 'shadow-gold-accent/10'],
  ['shadow-purple-200', 'shadow-gold-accent/10'],
  ['shadow-purple-900/20', 'shadow-royal-blue/20'],
  ['from-purple-200 to-pink-200', 'from-gold-accent/20 to-ivory-bg'],
  ['ring-purple-100', 'ring-gold-accent/20'],
  ['hover:border-purple-200', 'hover:border-gold-accent/30'],
  ['hover:shadow-purple-100/50', 'hover:shadow-gold-accent/10'],
  ['hover:bg-purple-600', 'hover:bg-royal-blue'],
  ['hover:bg-purple-700', 'hover:bg-gold-accent'],
  ['from-violet-500 to-purple-400', 'from-royal-blue to-gold-accent'],
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
        console.log('updated:', path.relative(srcDir, full))
      }
    }
  }
}

walk(srcDir)
console.log('done')
