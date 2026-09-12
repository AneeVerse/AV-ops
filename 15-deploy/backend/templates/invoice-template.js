const PDFDocument = require("pdfkit");

/**
 * Invoice Template for Medusa Invoice SBL Plugin
 * 
 * Note: The plugin expects a function that returns a Promise of a Buffer (PDF data).
 * Returning HTML string directly will result in a corrupt PDF file.
 */
const fs = require('fs');
const path = require('path');

module.exports = (order) => {
    return new Promise(async (resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 50, size: "A4" });
            const buffers = [];

            doc.on("data", buffers.push.bind(buffers));
            doc.on("end", () => resolve(Buffer.concat(buffers)));
            doc.on("error", (err) => reject(err));

            // Brand Colors
            const primaryColor = "#8B5AB1";
            const secondaryColor = "#F3E8FF";
            const textColor = "#1f2937";
            const grayColor = "#6b7280";

            // Helper to format currency dynamically based on order currency
            const formatCurrency = (amount, currencyCode) => {
                // User reported prices are coming as 4.00 instead of 400. 
                // This implies their data is stored in major units (e.g. Rupees), not minor units (cents/paise).
                // Removing / 100 division to match user expectation.
                const value = Number(amount || 0);
                return new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: currencyCode ? currencyCode.toUpperCase() : "USD",
                    currencyDisplay: "code",
                }).format(value);
            };

            const formatDate = (dateString) => {
                if (!dateString) return new Date().toLocaleDateString("en-US");
                return new Date(dateString).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                });
            };

            // --- PDF GENERATION LOGIC ---

            // 1. Header
            let y = 50;

            // Dynamic Company Logo/Name
            const logoPath = path.join(process.cwd(), "static", "1767864314994-checomelon.jpeg");
            if (fs.existsSync(logoPath)) {
                doc.image(logoPath, 50, y - 10, { height: 40 });
            } else {
                doc.font("Helvetica-Bold").fontSize(20).fillColor(primaryColor).text("ChocoMelon", 50, y);
            }

            doc.fontSize(24).font("Helvetica-Bold").text("INVOICE", { align: "right" });

            y += 35;
            doc.fontSize(10).font("Helvetica").fillColor(grayColor);
            // Dynamic Order Details
            doc.text(`Order ID: #${order.display_id || order.id}`, { align: "right" });
            doc.text(`Date: ${formatDate(order.created_at)}`, { align: "right" });

            // Dynamic Status
            const status = order.payment_status || order.status || "pending";
            doc.text(`Status: ${status.replace(/_/g, ' ').toUpperCase()}`, { align: "right" });

            y = doc.y + 20;

            // Divider
            doc.moveTo(50, y).lineTo(550, y).strokeColor(secondaryColor).lineWidth(2).stroke();
            y += 20;

            // 2. Addresses
            const addressY = y;

            // Billed To
            doc.fontSize(9).font("Helvetica-Bold").fillColor(grayColor).text("BILLED TO", 50, addressY);
            doc.rect(50, addressY + 12, 200, 1).fillColor("#e5e7eb").fill();

            doc.fillColor(textColor).fontSize(10).font("Helvetica");
            doc.x = 50;
            doc.y = addressY + 25;

            // Dynamic Billing Address
            const billing = order.billing_address || {};
            if (billing) {
                const name = `${billing.first_name || ''} ${billing.last_name || ''}`.trim();
                if (name) doc.text(name, { width: 200 });
                if (billing.company) doc.text(billing.company, { width: 200 });
                if (billing.address_1) doc.text(billing.address_1, { width: 200 });
                if (billing.address_2) doc.text(billing.address_2, { width: 200 });

                const cityStateZip = [billing.city, billing.province, billing.postal_code].filter(Boolean).join(', ');
                if (cityStateZip) doc.text(cityStateZip, { width: 200 });

                if (billing.country_code) doc.text(billing.country_code.toUpperCase(), { width: 200 });
                if (order.email) doc.text(order.email, { width: 200 });
                if (billing.phone) doc.text(billing.phone, { width: 200 });

                y = doc.y;
            }

            // Shipped To
            doc.fontSize(9).font("Helvetica-Bold").fillColor(grayColor).text("SHIPPED TO", 350, addressY);
            doc.rect(350, addressY + 12, 200, 1).fillColor("#e5e7eb").fill();

            // Dynamic Shipping Address
            const shipping = order.shipping_address || {};
            if (shipping) {
                doc.fillColor(textColor).fontSize(10).font("Helvetica");
                doc.x = 350;
                doc.y = addressY + 25;

                const name = `${shipping.first_name || ''} ${shipping.last_name || ''}`.trim();
                if (name) doc.text(name, { width: 200 });
                if (shipping.company) doc.text(shipping.company, { width: 200 });
                if (shipping.address_1) doc.text(shipping.address_1, { width: 200 });
                if (shipping.address_2) doc.text(shipping.address_2, { width: 200 });

                const cityStateZip = [shipping.city, shipping.province, shipping.postal_code].filter(Boolean).join(', ');
                if (cityStateZip) doc.text(cityStateZip, { width: 200 });

                if (shipping.country_code) doc.text(shipping.country_code.toUpperCase(), { width: 200 });
                if (shipping.phone) doc.text(shipping.phone, { width: 200 });

                // Update main Y to be the larger of the two columns
                y = Math.max(y, doc.y);
            }

            y = Math.max(y, addressY + 25) + 30;

            // 3. Items Table
            const tableTop = y;

            doc.rect(50, tableTop, 500, 25).fillColor(primaryColor).fill();
            doc.fillColor("white").font("Helvetica-Bold").fontSize(9);
            doc.text("ITEM DESCRIPTION", 60, tableTop + 8);
            doc.text("QTY", 300, tableTop + 8, { width: 40, align: "center" });
            doc.text("PRICE", 360, tableTop + 8, { width: 80, align: "right" });
            doc.text("TOTAL", 460, tableTop + 8, { width: 80, align: "right" });

            y = tableTop + 25;
            doc.fillColor(textColor).font("Helvetica").fontSize(10);
            doc.x = 50; // Reset X for table rows

            // --- DYNAMIC TOTAL CALCULATION ---
            // We calculate subtotal from items to ensure accuracy if top-level subtotal is missing
            let calculatedSubtotal = 0;
            const items = order.items || [];

            items.forEach((item, i) => {
                // Striped rows
                if (i % 2 === 0) {
                    doc.rect(50, y, 500, 30).fillColor(secondaryColor).fillOpacity(0.3).fill();
                    doc.fillOpacity(1);
                }

                doc.fillColor(textColor);
                const itemY = y + 8;

                // Title
                doc.text(item.title, 60, itemY, { width: 230, lineBreak: false, ellipsis: true });

                // Variant info
                if (item.variant && item.variant.title && item.variant.title !== 'Default Variant') {
                    doc.fontSize(8).fillColor(grayColor).text(item.variant.title, 60, itemY + 12);
                    doc.fontSize(10).fillColor(textColor);
                }

                // Values
                const quantity = item.quantity || 0;
                const unitPrice = item.unit_price || 0;
                const lineTotal = unitPrice * quantity;

                calculatedSubtotal += lineTotal;

                doc.text(quantity.toString(), 300, itemY, { width: 40, align: "center" });
                doc.text(formatCurrency(unitPrice, order.currency_code), 360, itemY, { width: 80, align: "right" });
                doc.font("Helvetica-Bold").text(formatCurrency(lineTotal, order.currency_code), 460, itemY, { width: 80, align: "right" });
                doc.font("Helvetica");

                y += 30;
            });

            y += 10;

            // 4. Totals Section
            const totalsX = 350;
            const amountX = 450;
            const amountWidth = 90;

            // Determine final totals dynamically
            const shippingTotal = order.shipping_total || 0;
            const taxTotal = order.tax_total || 0;
            // If the order object has a total, use it, otherwise sum our calculations
            const grandTotal = (order.total && order.total > 0) ? order.total : (calculatedSubtotal + shippingTotal + taxTotal);

            const drawTotalRow = (label, amount, isBold = false, isLast = false) => {
                if (isLast) {
                    doc.moveTo(totalsX, y).lineTo(550, y).strokeColor(primaryColor).lineWidth(1).stroke();
                    y += 10;
                }

                doc.fontSize(isLast ? 12 : 10)
                    .font(isBold || isLast ? "Helvetica-Bold" : "Helvetica")
                    .fillColor(isLast ? primaryColor : grayColor)
                    .text(label, totalsX, y);

                doc.text(formatCurrency(amount, order.currency_code), amountX, y, { width: amountWidth, align: "right" });

                y += 20;
            };

            // Always show Subtotal
            drawTotalRow("Subtotal", calculatedSubtotal);

            // Only show Shipping & Tax if they exist (are > 0)
            if (shippingTotal > 0) {
                drawTotalRow("Shipping", shippingTotal);
            }
            if (taxTotal > 0) {
                drawTotalRow("Tax", taxTotal);
            }

            // Always show Total
            drawTotalRow("Total Due", grandTotal, true, true);

            // 5. Footer
            const footerY = 660; // Moved up to ensure everything fits on one page
            doc.y = Math.max(y + 20, footerY);

            doc.rect(50, doc.y, 500, 1).fillColor("#eee").fill();
            doc.moveDown(1.5);

            doc.fontSize(11).font("Helvetica-Bold").fillColor(primaryColor).text("Thank you for your business!", { align: "center" });
            doc.moveDown(0.5);
            doc.fontSize(9).font("Helvetica").fillColor(grayColor).text("If you have any questions about this invoice, please contact support@chocomelon.in", { align: "center" });
            doc.text(`© ${new Date().getFullYear()} ChocoMelon. All rights reserved.`, { align: "center" });

            doc.end();

        } catch (error) {
            reject(error);
        }
    });
};
