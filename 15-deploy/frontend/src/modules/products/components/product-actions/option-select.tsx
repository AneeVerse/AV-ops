import { HttpTypes } from "@medusajs/types"
import { clx } from "@medusajs/ui"
import React from "react"

type OptionSelectProps = {
  option: HttpTypes.StoreProductOption
  current: string | undefined
  updateOption: (title: string, value: string) => void
  title: string
  disabled: boolean
  error?: boolean
  "data-testid"?: string
}

const OptionSelect: React.FC<OptionSelectProps> = ({
  option,
  current,
  updateOption,
  title,
  "data-testid": dataTestId,
  disabled,
  error,
}) => {
  const filteredOptions = (option.values ?? []).map((v) => v.value)

  const isSize = title.toLowerCase().includes('size')

  return (
    <div className="flex flex-col gap-y-3">
      <div
        className={clx("flex flex-wrap gap-2 transition-all duration-300", {
          "grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6": isSize,
        })}
        data-testid={dataTestId}
      >
        {filteredOptions.map((v) => {
          return (
            <button
              onClick={() => updateOption(option.id, v)}
              key={v}
              className={clx(
                "border text-sm font-medium h-10 transition-all",
                {
                  "border-gold-accent bg-gold-accent/10 text-royal-blue font-bold rounded-[30px] shadow-sm": v === current && isSize,
                  "border-gray-400 bg-white text-gray-900 font-bold hover:border-gold-accent rounded-[30px] hover:bg-gold-accent/10 transition-all": v !== current && isSize,
                  "border-gray-400 bg-white text-gray-900 font-bold rounded-[30px] p-2 flex-1 hover:border-gold-accent hover:bg-gold-accent/10 transition-all": !isSize,
                  "border-gold-accent bg-gold-accent/10 text-royal-blue font-bold rounded-[30px] p-2 flex-1 shadow-sm": v === current && !isSize,
                }
              )}
              disabled={disabled}
              data-testid="option-button"
            >
              {v}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default OptionSelect
