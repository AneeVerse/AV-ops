import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { DetailWidgetProps } from "@medusajs/framework/types"
import { Container, Heading, Input, Button, Label, toast } from "@medusajs/ui"
import { useState, useEffect } from "react"

interface SizeChartSection {
  title?: string
  headers: string[]
  rows: string[][]
}

interface SizeChartData {
  title: string
  tip?: string
  sections: SizeChartSection[]
}

const RING_PRESET: SizeChartData = {
  title: "Ring Size Guide",
  tip: "For the most accurate fit, measure the inside diameter of an existing ring that fits comfortably.",
  sections: [
    {
      title: "Standard Ring Sizes",
      headers: ["US Size", "Inside Diameter (mm)", "Inside Circumference (mm)"],
      rows: [
        ["4", "14.9 mm", "46.8 mm"],
        ["5", "15.7 mm", "49.3 mm"],
        ["6", "16.5 mm", "51.9 mm"],
        ["7", "17.3 mm", "54.4 mm"],
        ["8", "18.1 mm", "57.0 mm"],
        ["9", "18.9 mm", "59.5 mm"],
        ["10", "19.8 mm", "62.1 mm"],
      ],
    },
  ],
}

const BRACELET_PRESET: SizeChartData = {
  title: "Bracelet & Bangle Size Guide",
  tip: "To find your size, measure your wrist with a flexible tape measure just below the wrist bone.",
  sections: [
    {
      title: "Bracelet & Bangle Dimensions",
      headers: ["Size", "Wrist Circumference", "Bangle Diameter"],
      rows: [
        ["Small (S)", "15.0 - 16.5 cm", "6.0 cm"],
        ["Medium (M)", "16.5 - 18.0 cm", "6.5 cm"],
        ["Large (L)", "18.0 - 19.5 cm", "7.0 cm"],
      ],
    },
  ],
}

const NECKLACE_PRESET: SizeChartData = {
  title: "Necklace & Chain Length Guide",
  tip: "Standard necklace lengths sit differently depending on neck size.",
  sections: [
    {
      title: "Standard Chain Lengths",
      headers: ["Length", "Placement", "Recommended Style"],
      rows: [
        ["16 inches (40 cm)", "Base of Neck", "Sits just above collarbone"],
        ["18 inches (45 cm)", "On Collarbone", "Most popular standard pendant length"],
        ["20 inches (50 cm)", "Below Collarbone", "Great for low necklines & layering"],
      ],
    },
  ],
}

const CategorySizeChartWidget = ({ data }: DetailWidgetProps<any>) => {
  const entity = data
  const isCategory = !!(entity && ("name" in entity || "rank" in entity || "is_active" in entity))
  const endpoint = isCategory ? `/admin/product-categories/${entity.id}` : `/admin/products/${entity.id}`

  const rawMetaChart = entity?.metadata?.size_chart

  const getSmartPreset = (entity: any): SizeChartData => {
    const nameStr = `${entity?.name || ''} ${entity?.title || ''} ${entity?.handle || ''}`.toLowerCase()
    if (nameStr.includes("bracelet") || nameStr.includes("bangle") || nameStr.includes("wrist")) {
      return BRACELET_PRESET
    }
    if (nameStr.includes("necklace") || nameStr.includes("chain") || nameStr.includes("pendant")) {
      return NECKLACE_PRESET
    }
    return RING_PRESET
  }

  const [chartData, setChartData] = useState<SizeChartData>(() => {
    if (rawMetaChart) {
      try {
        const parsed = typeof rawMetaChart === "string" ? JSON.parse(rawMetaChart) : rawMetaChart
        if (parsed && parsed.sections) return parsed
      } catch (e) {
        // ignore
      }
    }
    return getSmartPreset(entity)
  })

  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (entity?.metadata?.size_chart) {
      try {
        const parsed = typeof entity.metadata.size_chart === "string" 
          ? JSON.parse(entity.metadata.size_chart) 
          : entity.metadata.size_chart
        if (parsed && parsed.sections) {
          setChartData(parsed)
        }
      } catch (e) {
        // ignore
      }
    }
  }, [entity?.metadata?.size_chart])

  const handleSave = async () => {
    if (!entity?.id) return
    setLoading(true)

    try {
      const updatedMetadata = {
        ...(entity.metadata || {}),
        size_chart: chartData,
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ metadata: updatedMetadata }),
      })

      if (response.ok) {
        toast.success("Success", {
          description: "Category Size Chart saved successfully!",
        })
      } else {
        toast.error("Error", { description: "Failed to save size chart." })
      }
    } catch (e: any) {
      toast.error("Error", { description: e.message || "An error occurred." })
    } finally {
      setLoading(false)
    }
  }

  const handleClear = async () => {
    if (!entity?.id) return
    setLoading(true)
    try {
      const updatedMetadata = { ...(entity.metadata || {}) }
      delete updatedMetadata.size_chart

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ metadata: updatedMetadata }),
      })

      if (response.ok) {
        setChartData(RING_PRESET)
        toast.success("Success", { description: "Size chart cleared." })
      } else {
        toast.error("Error", { description: "Failed to clear size chart." })
      }
    } catch (e: any) {
      toast.error("Error", { description: e.message || "An error occurred." })
    } finally {
      setLoading(false)
    }
  }

  const updateHeader = (sectionIdx: number, headerIdx: number, val: string) => {
    setChartData((prev) => {
      const newSections = [...prev.sections]
      const newHeaders = [...newSections[sectionIdx].headers]
      newHeaders[headerIdx] = val
      newSections[sectionIdx] = { ...newSections[sectionIdx], headers: newHeaders }
      return { ...prev, sections: newSections }
    })
  }

  const updateCell = (sectionIdx: number, rowIdx: number, cellIdx: number, val: string) => {
    setChartData((prev) => {
      const newSections = [...prev.sections]
      const newRows = prev.sections[sectionIdx].rows.map((r) => [...r])
      newRows[rowIdx][cellIdx] = val
      newSections[sectionIdx] = { ...newSections[sectionIdx], rows: newRows }
      return { ...prev, sections: newSections }
    })
  }

  const addRow = (sectionIdx: number) => {
    setChartData((prev) => {
      const newSections = [...prev.sections]
      const colsCount = newSections[sectionIdx].headers.length
      const emptyRow = new Array(colsCount).fill("")
      const newRows = [...newSections[sectionIdx].rows, emptyRow]
      newSections[sectionIdx] = { ...newSections[sectionIdx], rows: newRows }
      return { ...prev, sections: newSections }
    })
  }

  const deleteRow = (sectionIdx: number, rowIdx: number) => {
    setChartData((prev) => {
      const newSections = [...prev.sections]
      const newRows = newSections[sectionIdx].rows.filter((_, i) => i !== rowIdx)
      newSections[sectionIdx] = { ...newSections[sectionIdx], rows: newRows }
      return { ...prev, sections: newSections }
    })
  }

  return (
    <Container className="p-6 bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col gap-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <Heading level="h2" className="text-lg font-bold text-gray-900">
            {isCategory ? "Category Size Chart Configuration" : "Product Size Chart Configuration"}
          </Heading>
        </div>
      </div>

      {/* Basic Settings */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-semibold text-gray-700">Guide Title</Label>
          <Input
            value={chartData.title}
            onChange={(e) => setChartData({ ...chartData, title: e.target.value })}
            placeholder="e.g. Ring Size Guide"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-semibold text-gray-700">Pro Tip Note</Label>
          <Input
            value={chartData.tip || ""}
            onChange={(e) => setChartData({ ...chartData, tip: e.target.value })}
            placeholder="e.g. Measure inside diameter for best fit."
          />
        </div>
      </div>

      {/* Tabular Data Sections */}
      {chartData.sections.map((section, sIdx) => (
        <div key={sIdx} className="border border-gray-200 rounded-lg p-4 bg-gray-50/50 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-bold uppercase tracking-wider text-gray-800">
              Section Table: {section.title || `Section ${sIdx + 1}`}
            </Label>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold text-gray-600">Section Subtitle</Label>
            <Input
              value={section.title || ""}
              onChange={(e) => {
                const val = e.target.value
                setChartData((prev) => {
                  const newSec = [...prev.sections]
                  newSec[sIdx] = { ...newSec[sIdx], title: val }
                  return { ...prev, sections: newSec }
                })
              }}
              placeholder="e.g. Standard US Ring Sizes"
            />
          </div>

          {/* Table Preview & Inline Editor */}
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white mt-1">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-200">
                  {section.headers.map((head, hIdx) => (
                    <th key={hIdx} className="p-2 border-r border-gray-200 last:border-r-0">
                      <input
                        className="w-full bg-transparent font-bold text-gray-900 focus:outline-none focus:bg-white px-1 py-0.5 rounded"
                        value={head}
                        onChange={(e) => updateHeader(sIdx, hIdx, e.target.value)}
                      />
                    </th>
                  ))}
                  <th className="p-2 w-12 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {section.rows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-gray-50">
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="p-2 border-r border-gray-200 last:border-r-0">
                        <input
                          className="w-full bg-transparent text-gray-800 focus:outline-none focus:bg-amber-50 px-1 py-0.5 rounded"
                          value={cell}
                          onChange={(e) => updateCell(sIdx, rIdx, cIdx, e.target.value)}
                        />
                      </td>
                    ))}
                    <td className="p-2 text-center">
                      <button
                        type="button"
                        onClick={() => deleteRow(sIdx, rIdx)}
                        className="text-red-500 hover:text-red-700 font-bold px-1"
                        title="Delete Row"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-start mt-1">
            <Button size="small" variant="secondary" onClick={() => addRow(sIdx)}>
              + Add Row
            </Button>
          </div>
        </div>
      ))}

      {/* Save & Clear Actions */}
      <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
        <Button size="small" variant="secondary" onClick={handleClear} isLoading={loading}>
          Clear Size Chart
        </Button>
        <Button size="small" variant="primary" onClick={handleSave} isLoading={loading}>
          Save Size Chart
        </Button>
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: ["product_category.details.after", "product.details.after"],
})

export default CategorySizeChartWidget
