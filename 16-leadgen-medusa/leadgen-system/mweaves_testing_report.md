# M'Weaves Shopify Website Testing Report

**Date:** 2026-07-04  
**Site:** https://mweaves.com/  
**Test type:** Public-site smoke test / functional QA / basic SEO checks

## 1) Executive Summary

I reviewed the public storefront pages and tested core shopping flows on the live site.

**Overall status:** Pass with minor issues  
**High-severity defects found:** 0  
**Medium-severity defects found:** 0  
**Low-severity defects found:** 2

The storefront, collection pages, product pages, and cart flow are working. The main issues found are SEO/content related on a couple of collection pages.

---

## 2) Testing Performed

### Pages and flows tested
- Home page
- Collection pages
- Product page
- Add to cart flow
- Cart quantity update / remove flow
- Basic metadata checks (title, canonical URL, meta description, H1)
- Response verification for multiple internal links from the homepage

### Verified results
- Homepage loads successfully with HTTP 200
- Collection pages tested load successfully with HTTP 200
- Product page loads successfully with HTTP 200
- Add to cart works through Shopify AJAX cart endpoint
- Cart quantity update and remove actions work correctly
- Product structured data is present on product page
- Canonical URLs and H1 tags are present on the tested pages

---

## 3) Findings

### Issue 1: Missing meta description on some collection pages
**Severity:** Low  
**Category:** SEO / Content  
**Observed on:** `https://mweaves.com/collections/bed-linen`

**Details:**
- The collection page loads correctly and has a title tag, canonical URL, and H1.
- However, the meta description tag is missing on this page.

**Impact:**
- Search engine snippets may be weaker than expected.
- Sharing previews and SEO performance may be less consistent.

**Recommendation:**
- Add a unique meta description for the Bed Linen collection page.

---

### Issue 2: Empty meta description on Gift Sets collection page
**Severity:** Low  
**Category:** SEO / Content  
**Observed on:** `https://mweaves.com/collections/gift-sets`

**Details:**
- The page loads correctly and has a title, canonical URL, and H1.
- The meta description field is present but empty.

**Impact:**
- SEO snippet quality is reduced.
- This may affect click-through rates from search results.

**Recommendation:**
- Populate the Gift Sets collection meta description with a concise, unique summary.

---

## 4) Shop Flow Validation

### Add to cart test
**Product tested:** Mughal Meadow Block Print Quilted Cotton Laptop Sleeve with Front Pocket Blue 10"x15"  
**Result:** Passed

**What was verified:**
- Variant accepted by `/cart/add.js`
- Cart count updated correctly
- Quantity update worked
- Item removal worked

### Product page metadata test
**Result:** Passed

**What was verified:**
- Title tag present
- Canonical URL present
- H1 present
- Product JSON-LD structured data present

---

## 5) Checklist for Further Testing

Use this as a client-ready QA checklist for the full Shopify store:

### Storefront / UI
- [ ] Homepage loads correctly on desktop and mobile
- [ ] Header navigation works on all menu items
- [ ] Footer links work
- [ ] Search icon / search bar works
- [ ] Announcement bar links work
- [ ] Sticky header behavior is correct
- [ ] Cart icon updates after add-to-cart

### Collection pages
- [ ] Each collection page loads without errors
- [ ] Product cards display correctly
- [ ] Sorting works
- [ ] Filtering works
- [ ] Pagination / infinite scroll works
- [ ] Empty-state pages are handled correctly
- [ ] Meta title and meta description are unique

### Product pages
- [ ] Product images load and can be zoomed
- [ ] Variant selectors work
- [ ] Price updates when variant changes
- [ ] Compare-at / sale pricing is correct
- [ ] Add to cart works
- [ ] Quantity selector works
- [ ] Product description is readable
- [ ] Shipping / return info is visible
- [ ] Related products show correctly
- [ ] Product schema/JSON-LD is valid

### Cart
- [ ] Add to cart from product page
- [ ] Update quantity in cart
- [ ] Remove item from cart
- [ ] Discount code works
- [ ] Cart totals update correctly
- [ ] Shipping estimate, if present, works
- [ ] Proceed to checkout works

### Checkout
- [ ] Login / guest checkout works
- [ ] Shipping address validation works
- [ ] Shipping methods load correctly
- [ ] Payment methods load correctly
- [ ] Order confirmation page works
- [ ] Confirmation email is received

### Mobile / responsive
- [ ] Homepage layout is good on mobile
- [ ] Menu opens/closes properly on mobile
- [ ] Product page buttons are tappable
- [ ] Images scale correctly
- [ ] Cart and checkout are usable on small screens

### Performance / SEO / accessibility
- [ ] Page speed is acceptable
- [ ] Images are optimized and lazy-loaded
- [ ] Alt text exists for important images
- [ ] Headings are structured correctly
- [ ] Meta titles and descriptions are unique
- [ ] Canonical tags are correct
- [ ] No broken links or 404s
- [ ] No console JavaScript errors
- [ ] Contrast and keyboard navigation are acceptable

### Business / ecommerce
- [ ] Taxes are calculated correctly
- [ ] Shipping rules are correct
- [ ] Inventory / out-of-stock behavior is correct
- [ ] Order confirmation and emails are correct
- [ ] Refund / return policy pages are linked and accurate
- [ ] Currency formatting is correct

---

## 6) Suggested Next Step

Fix the two collection-page meta description issues first, then run a final mobile and checkout regression before sharing the site with the client.

---

## 7) Evidence of functional testing

- Homepage returned **HTTP 200**
- Collection pages returned **HTTP 200**
- Product page returned **HTTP 200**
- Add-to-cart returned **HTTP 200**
- Cart update/remove returned **HTTP 200**

