import { Heading } from "@medusajs/ui"
import CheckboxWithLabel from "@modules/common/components/checkbox"
import React from "react"

type FilterCheckboxGroupProps = {
    title: string
    items: { value: string; label: string }[]
    values: string[]
    handleChange: (value: string) => void
    isColor?: boolean
    'data-testid'?: string
}

const FilterCheckboxGroup = ({
    title,
    items,
    values,
    handleChange,
    isColor,
    'data-testid': dataTestId,
}: FilterCheckboxGroupProps) => {
    const [isOpen, setIsOpen] = React.useState(true)
    const [showAll, setShowAll] = React.useState(false)

    // Optimistic local state — reflects clicks instantly without waiting for server
    const [optimisticValues, setOptimisticValues] = React.useState<string[]>(values)

    // Sync back when server props update (after navigation completes)
    React.useEffect(() => {
        setOptimisticValues(values)
    }, [values])

    const initialItemsCount = 6
    const hasMore = items?.length > initialItemsCount

    // Auto-expand if a selected item is hidden or if any item is selected
    React.useEffect(() => {
        if (values && values.length > 0) {
            setIsOpen(true)
            if (hasMore && items) {
                const hiddenItems = items.slice(initialItemsCount)
                const isAnyHiddenItemSelected = hiddenItems.some(item => values.includes(item.value))
                if (isAnyHiddenItemSelected) {
                    setShowAll(true)
                }
            }
        }
    }, [values, items, hasMore])

    const handleOptimisticChange = (value: string) => {
        // Immediately toggle locally — no flicker
        setOptimisticValues((prev) =>
            prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
        )
        // Trigger actual URL navigation in background
        handleChange(value)
    }

    const displayedItems = showAll ? items : items?.slice(0, initialItemsCount)

    return (
        <div className="flex flex-col border-b border-gray-100 pb-4 last:border-0 last:pb-0">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-between w-full group transition-all py-1"
            >
                <Heading
                    level="h3"
                    className="text-sm font-bold text-gray-900 uppercase tracking-wider group-hover:text-gold-accent transition-colors"
                >
                    {title}
                </Heading>
                <span
                    className={`transform transition-transform duration-300 text-gray-400 group-hover:text-gold-accent ${isOpen ? "" : "-rotate-180"}`}
                >
                    <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <polyline points="18 15 12 9 6 15"></polyline>
                    </svg>
                </span>
            </button>

            <div
                className={`flex flex-col gap-y-1 transition-all duration-300 ease-in-out ${isOpen ? "mt-3 opacity-100 px-0.5" : "max-h-0 opacity-0 invisible overflow-hidden"}`}
                style={isOpen ? { maxHeight: showAll ? '1000px' : '300px' } : {}}
            >
                {displayedItems?.map((i) => (
                    <CheckboxWithLabel
                        key={i.value}
                        label={i.label}
                        color={isColor ? i.value : undefined}
                        checked={optimisticValues.includes(i.value)}
                        onChange={() => handleOptimisticChange(i.value)}
                        data-testid={dataTestId}
                        data-ga-event="filter_checkbox_click"
                        data-ga-label={`${title} - ${i.label}`}
                    />
                ))}

                {hasMore && isOpen && (
                    <button
                        onClick={() => setShowAll(!showAll)}
                        className="text-xs font-bold text-gold-accent hover:underline mt-2 flex items-center gap-1 uppercase tracking-tight"
                    >
                        {showAll ? "View Less" : `View More (${items.length - initialItemsCount})`}
                        <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className={`transform transition-transform ${showAll ? "rotate-180" : ""}`}
                        >
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                    </button>
                )}
            </div>
        </div>
    )
}

export default FilterCheckboxGroup
