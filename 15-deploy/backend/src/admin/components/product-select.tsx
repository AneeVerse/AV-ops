import { useState, useRef, useEffect } from "react"

interface ProductSelectProps {
  products: any[]
  value: string
  onChange: (value: string) => void
  noneValue: string
}

const ProductSelect = ({ products, value, onChange, noneValue }: ProductSelectProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selectedProduct = products.find((p) => p.id === value)
  const displayLabel =
    value === noneValue || !value
      ? "Select Product from Store"
      : selectedProduct
        ? `${selectedProduct.title.length > 35 ? selectedProduct.title.slice(0, 35) + "…" : selectedProduct.title}`
        : "Select Product from Store"

  const filtered = search.trim()
    ? products.filter(
        (p) =>
          p.title.toLowerCase().includes(search.toLowerCase()) ||
          p.handle?.toLowerCase().includes(search.toLowerCase())
      )
    : products

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setSearch("")
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleSelect = (val: string) => {
    onChange(val)
    setIsOpen(false)
    setSearch("")
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger — matches Medusa Admin input style */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen)
          if (!isOpen) setTimeout(() => inputRef.current?.focus(), 50)
        }}
        className={`
          w-full flex items-center justify-between
          bg-ui-bg-field border rounded-md
          px-2.5 py-1.5
          text-left text-[13px] leading-5
          transition-all
          ${isOpen
            ? "border-ui-border-interactive shadow-borders-interactive-with-active"
            : "border-ui-border-base hover:border-ui-border-strong shadow-borders-base"
          }
        `}
      >
        <span className={`truncate ${value === noneValue || !value ? "text-ui-fg-muted" : "text-ui-fg-base"}`}>
          {displayLabel}
        </span>
        <svg
          className={`w-4 h-4 text-ui-fg-muted ml-2 shrink-0 transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-ui-bg-base border border-ui-border-base rounded-lg shadow-elevation-flyout z-50 overflow-hidden">
          {/* Search input */}
          <div className="px-2 pt-2 pb-1.5">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products…"
              className="
                w-full bg-ui-bg-field border border-ui-border-base rounded-md
                text-[13px] px-2.5 py-1.5
                text-ui-fg-base placeholder:text-ui-fg-muted
                focus:outline-none focus:border-ui-border-interactive focus:shadow-borders-interactive-with-active
              "
            />
          </div>

          {/* Options list */}
          <div className="max-h-[200px] overflow-y-auto px-1 pb-1">
            {/* None option */}
            <button
              type="button"
              onClick={() => handleSelect(noneValue)}
              className={`
                w-full text-left rounded-md px-2.5 py-1.5 text-[13px]
                flex items-center gap-2 transition-colors
                ${value === noneValue
                  ? "bg-ui-bg-base-pressed text-ui-fg-base font-medium"
                  : "text-ui-fg-subtle hover:bg-ui-bg-base-hover"
                }
              `}
            >
              <span className={`
                w-4 h-4 rounded-full border-[1.5px] flex items-center justify-center shrink-0
                ${value === noneValue ? "border-ui-fg-interactive" : "border-ui-border-strong"}
              `}>
                {value === noneValue && (
                  <span className="w-2 h-2 rounded-full bg-ui-fg-interactive" />
                )}
              </span>
              <span className="text-ui-fg-muted italic">None / Display Only</span>
            </button>

            {/* Divider */}
            <div className="h-px bg-ui-border-base mx-1.5 my-1" />

            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-[13px] text-ui-fg-muted text-center">
                No products found
              </div>
            ) : (
              filtered.map((p) => {
                const isSelected = p.id === value
                const title = p.title.length > 50 ? p.title.slice(0, 50) + "…" : p.title
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelect(p.id)}
                    className={`
                      w-full text-left rounded-md px-2.5 py-1.5 text-[13px]
                      flex items-center gap-2 transition-colors
                      ${isSelected
                        ? "bg-ui-bg-base-pressed text-ui-fg-base font-medium"
                        : "text-ui-fg-subtle hover:bg-ui-bg-base-hover"
                      }
                    `}
                  >
                    <span className={`
                      w-4 h-4 rounded-full border-[1.5px] flex items-center justify-center shrink-0
                      ${isSelected ? "border-ui-fg-interactive" : "border-ui-border-strong"}
                    `}>
                      {isSelected && (
                        <span className="w-2 h-2 rounded-full bg-ui-fg-interactive" />
                      )}
                    </span>
                    <span className="truncate">
                      {title}
                      <span className="text-ui-fg-muted ml-1 text-[11px]">({p.handle})</span>
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default ProductSelect
