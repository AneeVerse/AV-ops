"use client"

import { Listbox, ListboxButton, ListboxOption, ListboxOptions, Transition } from "@headlessui/react"
import { Fragment, useMemo } from "react"
import ChevronDown from "@modules/common/icons/chevron-down"
import { clx } from "@medusajs/ui"

export type SortOptions = "price_asc" | "price_desc" | "created_at_desc" | "created_at_asc" | "bestsellers" | "created_at"

type SortProductsProps = {
  sortBy: SortOptions
  setQueryParams: (name: string, value: SortOptions) => void
  "data-testid"?: string
}

const sortOptions = [
  {
    value: "created_at_desc",
    label: "Latest Arrivals",
  },
  {
    value: "created_at_asc",
    label: "Oldest First",
  },
  {
    value: "price_asc",
    label: "Price: Low to High",
  },
  {
    value: "price_desc",
    label: "Price: High to Low",
  },
  {
    value: "bestsellers",
    label: "Bestsellers",
  },
]

const SortProducts = ({
  "data-testid": dataTestId,
  sortBy,
  setQueryParams,
}: SortProductsProps) => {
  const handleChange = (value: string) => {
    setQueryParams("sortBy", value as SortOptions)
  }

  const selectedOption = useMemo(() => {
    return sortOptions.find((o) => o.value === sortBy) || sortOptions[0]
  }, [sortBy])

  return (
    <div className="flex items-center w-full lg:w-auto">
      <Listbox value={sortBy} onChange={handleChange}>
        <div className="relative w-full">
          <ListboxButton
            className={clx(
              "relative cursor-pointer rounded-full bg-white py-1.5 px-8 border transition-all duration-300 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] hover:bg-gray-50 hover:border-gold-accent/40 focus:outline-none focus:ring-2 focus:ring-gold-accent/20 focus:border-gold-accent",
              "border-gray-200 w-full min-[450px]:w-auto flex items-center justify-center"
            )}
            data-testid={dataTestId}
          >
            <span className="flex items-center gap-1 truncate uppercase">
              <span className="font-bold text-gray-400 text-[10px] tracking-wider whitespace-nowrap">Sort:</span>
              <span className="text-sm font-bold text-gray-900 tracking-wider truncate">{selectedOption.label}</span>
            </span>
            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4">
              <ChevronDown
                className="w-4 h-4 text-gray-400 transition-transform duration-300 ui-open:rotate-180 ui-open:text-gold-accent"
                aria-hidden="true"
              />
            </span>
          </ListboxButton>
          <Transition
            as={Fragment}
            enter="transition ease-out duration-200"
            enterFrom="opacity-0 translate-y-1 scale-95"
            enterTo="opacity-100 translate-y-0 scale-100"
            leave="transition ease-in duration-150"
            leaveFrom="opacity-100 translate-y-0 scale-100"
            leaveTo="opacity-0 translate-y-1 scale-95"
          >
            <ListboxOptions className="absolute right-0 z-[100] mt-2 max-h-60 w-[200px] overflow-auto rounded-2xl bg-white py-2 text-base shadow-2xl ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm border border-gray-100">
              {sortOptions.map((option, idx) => (
                <ListboxOption
                  key={idx}
                  className={({ active, selected }) =>
                    clx(
                      "relative cursor-pointer select-none py-2.5 px-4 transition-colors mx-1.5 rounded-xl mb-0.5 last:mb-0",
                      active ? "bg-gold-accent/10 text-gold-accent" : "text-gray-900",
                      selected ? "bg-gold-accent/10" : ""
                    )
                  }
                  value={option.value}
                >
                  {({ selected }) => (
                    <div className="flex items-center justify-between">
                      <span className={clx("block truncate", selected ? "font-bold text-gold-accent" : "font-medium")}>
                        {option.label}
                      </span>
                      {selected && (
                        <span className="text-gold-accent">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                        </span>
                      )}
                    </div>
                  )}
                </ListboxOption>
              ))}
            </ListboxOptions>
          </Transition>
        </div>
      </Listbox>
    </div>
  )
}

export default SortProducts
