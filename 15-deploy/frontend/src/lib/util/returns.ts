
import { HttpTypes } from "@medusajs/types"

export type ItemWithDeliveryStatus = HttpTypes.StoreOrderLineItem & {
    returnable_quantity: number
    delivered_quantity: number
    return_requested_quantity: number
    return_received_quantity: number
    written_off_quantity: number
}

export const calculateReturnableQuantity = (
    item: HttpTypes.StoreOrderLineItem
): number => {
    // In a real implementation, these would come from the item.detail or similar
    // For now, we'll assume we can calculate it from available data or default to quantity
    // Adjust this based on your actual data structure for item details

    // Note: The actual data structure depends on how Medusa returns order item details
    // Typically it's in item.detail associated with fulfillments/returns

    // For the purpose of this storefront implementation (assuming standard Medusa):
    // We strictly follow the logic: delivered - requested - received - written_off

    // Checking if properties exist on item (they might be on a 'detail' object or top level depending on version)
    const anyItem = item as any

    // Defaulting to item.quantity if details missing (safe fallback for initial dev)
    // BUT per requirements, we must implement the logic.

    // If the backend provides these fields on the item directly:
    const delivered = anyItem.delivered_quantity ?? anyItem.quantity ?? 0 // Fallback to quantity if assumed delivered
    const requested = anyItem.return_requested_quantity ?? 0
    const received = anyItem.return_received_quantity ?? 0
    const writtenOff = anyItem.written_off_quantity ?? 0

    // If fulfillment_status is not fulfilled/shipped/partially_shipped, returnable might be 0
    // But strict formula:
    const returnable = Math.max(0, delivered - requested - received - writtenOff)

    return returnable
}

export const isItemReturnable = (item: HttpTypes.StoreOrderLineItem): boolean => {
    return calculateReturnableQuantity(item) > 0
}

export const hasReturnableItems = (order: HttpTypes.StoreOrder): boolean => {
    if (!order || !order.items) return false

    // Simple check: if order is canceled, no returns
    if (order.status === "canceled") return false

    return order.items.some((item) => isItemReturnable(item))
}

export const enhanceItemsWithReturnStatus = (
    items: HttpTypes.StoreOrderLineItem[]
): ItemWithDeliveryStatus[] => {
    return items.map((item) => {
        const anyItem = item as any
        return {
            ...item,
            // Ensure these properties exist
            delivered_quantity: anyItem.delivered_quantity ?? item.quantity, // Optimistic default
            return_requested_quantity: anyItem.return_requested_quantity ?? 0,
            return_received_quantity: anyItem.return_received_quantity ?? 0,
            written_off_quantity: anyItem.written_off_quantity ?? 0,
            returnable_quantity: calculateReturnableQuantity(item),
        }
    })
}
