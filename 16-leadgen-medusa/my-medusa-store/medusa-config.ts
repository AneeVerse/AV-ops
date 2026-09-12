import dns from "node:dns"
import { loadEnv, defineConfig, Modules, ContainerRegistrationKeys } from '@medusajs/framework/utils'
import path from "path"

dns.setDefaultResultOrder("ipv4first")

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

// Use real ImageKit when valid credentials are present.
const hasRealImageKit =
  !!process.env.IMAGEKIT_PUBLIC_KEY &&
  !!process.env.IMAGEKIT_PRIVATE_KEY &&
  !!process.env.IMAGEKIT_URL_ENDPOINT &&
  !process.env.IMAGEKIT_PUBLIC_KEY.toLowerCase().startsWith("dummy") &&
  !process.env.IMAGEKIT_URL_ENDPOINT.toLowerCase().startsWith("dummy")

// Use real S3 only when valid (non-dummy) AWS credentials are present.
// Otherwise fall back to local file provider so media uploads work out of the box.
const hasRealS3 =
  !!process.env.AWS_BUCKET &&
  !!process.env.AWS_ACCESS_KEY &&
  !!process.env.AWS_SECRET_ACCESS_KEY &&
  !process.env.AWS_ACCESS_KEY.toLowerCase().startsWith("dummy") &&
  !process.env.AWS_BUCKET.toLowerCase().startsWith("dummy")

const backendUrl =
  process.env.MEDUSA_BACKEND_URL ||
  process.env.BACKEND_URL ||
  "http://localhost:9000"

const fileProviders = hasRealImageKit
  ? [
      {
        resolve: "./src/providers/file-imagekit",
        id: "imagekit",
        options: {
          urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
          publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
          privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
          folder: process.env.IMAGEKIT_FOLDER || "/cultura-jewels",
        },
      },
    ]
  : hasRealS3
  ? [
      {
        resolve: "@medusajs/medusa/file-s3",
        id: "s3",
        options: {
          file_url: `https://${process.env.AWS_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com`,
          access_key_id: process.env.AWS_ACCESS_KEY,
          secret_access_key: process.env.AWS_SECRET_ACCESS_KEY,
          region: process.env.AWS_REGION,
          bucket: process.env.AWS_BUCKET,
          prefix: "uploads",
          cache_control: "max-age=31536000",
          acl: undefined,
        },
      },
    ]
  : [
      {
        resolve: "@medusajs/medusa/file-local",
        id: "local",
        options: {
          upload_dir: "static",
          backend_url: `${backendUrl}/static`,
        },
      },
    ]

const razorpayPaymentProviders = process.env.RAZORPAY_KEY_ID
  ? [
      {
        resolve: "@devx-commerce/razorpay/providers/payment-razorpay",
        id: "razorpay",
        options: {
          key_id: process.env.RAZORPAY_KEY_ID,
          key_secret: process.env.RAZORPAY_KEY_SECRET,
          webhook_secret: process.env.RAZORPAY_WEBHOOK_SECRET,
          auto_capture: true,
        },
      },
    ]
  : []

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
    },
    cookieOptions: {
      sameSite: "lax",
      secure: false,
    },

  },
  plugins: process.env.DISABLE_PLUGINS === "true" ? [] : [
    {
      resolve: "medusa-product-helper",
      options: {}
    },
    {
      resolve: "stock-monitoring",
      options: {
        low_stock_threshold: 10,
        slow_moving_days_threshold: 90,
      },
    },
    {
      resolve: "medusa-invoice-sbl",
      options: {
        template: "./templates/invoice-template.js",
        // Optional: Attach invoice to order creation emails
        attachInvoiceToEmail: true,
        // Optional: Default template path if no template provided
        //defaultTemplatePath: "./templates/default-invoice.js",
        guestJwtSecret: process.env.JWT_SECRET,
      },
    },
    {
      resolve: "medusa-dynamic-metadata",
      options: {
        entities: {
          products: {
            descriptors: [
              { key: "material", label: "Material", type: "text" },
              { key: "care_guide", label: "Care Guide", type: "text" },
              {
                key: "gender",
                label: "Gender",
                type: "select",
                filterable: true,
                options: [
                  { value: "boys", label: "Boys" },
                  { value: "girls", label: "Girls" },
                  { value: "both", label: "Both" },
                ],
              },
              {
                key: "occasion",
                label: "Occasion",
                type: "select",
                options: [
                  { value: "little_boys", label: "Little Boys" },
                  { value: "casuals", label: "Casuals" },
                  { value: "festive", label: "Festive" },
                  { value: "kids_wear", label: "Kids Wear" },
                  { value: "daily", label: "Daily" },
                  { value: "traditional", label: "Traditional" },
                  { value: "little_girls", label: "Little Girls" },
                  { value: "dresses", label: "Dresses" },
                  { value: "party", label: "Party" }
                ],
                filterable: true
              },
              { key: "product_type", label: "Product Type", type: "text" }
            ],
            expose_client_helpers: true,
            filterable: true
          },
          categories: {
            descriptors: [
              { key: "category_image", label: "Category Image", type: "file" },
              { key: "category_background_color", label: "Category Background Color", type: "text" },
              { key: "category_link", label: "Category Link", type: "text" }
            ]
          },
          collections: {
            descriptors: [
              { key: "collection_icon", label: "Collection Icon", type: "file" },
              { key: "collection_age", label: "Collection Age", type: "text" }
            ]
          },
          product_variants: {
            descriptors: [
              { key: "variant_image", label: "Variant Image", type: "file" }
            ]
          }
        }
      }
    },
    {
      resolve: "medusa-review-rating",
      options: {
        autoApprove: true,
        requireVerifiedPurchase: false,
        multiple_rating: true
      }
    },
    {
      resolve: "medusa-plugin-dynamic-config",
      options: {
        configs: {
          "homepage-config": {
            "id": "homepage-config",
            "title": "Homepage Experiments",
            "active": true,
            "structure": [
              {
                "id": "app-banner-array",
                "title": "App Banner Array",
                "type": "array",
                "children": [
                  {
                    "id": "app-banner",
                    "title": "App Banner",
                    "type": "object",
                    "children": [
                      {
                        "id": "app-banner-image",
                        "title": "Banner Image",
                        "type": "file",
                        "required": false
                      },
                      {
                        "id": "app-banner-title",
                        "title": "Banner Title",
                        "type": "short-text",
                        "required": false
                      },
                      {
                        "id": "app-banner-subtitle",
                        "title": "Banner Subtitle",
                        "type": "short-text",
                        "required": false
                      },
                      {
                        "id": "app-banner-description",
                        "title": "Banner Description",
                        "type": "long-text",
                        "required": false
                      },
                      {
                        "id": "app-banner-button-name",
                        "title": "Button Name",
                        "type": "short-text",
                        "required": false
                      },
                      {
                        "id": "app-banner-button-link",
                        "title": "Button Link",
                        "type": "short-text",
                        "required": false
                      }
                    ]
                  }
                ]
              },
              {
                "id": "homepage-banner-array",
                "title": "Homepage Banner Array",
                "type": "array",
                "children": [
                  {
                    "id": "homepage-banner",
                    "title": "Homepage Banner",
                    "type": "object",
                    "children": [
                      {
                        "id": "homepage-banner-image",
                        "title": "Banner Image",
                        "type": "file",
                        "required": false
                      },
                      {
                        "id": "homepage-banner-title",
                        "title": "Banner Title",
                        "type": "short-text",
                        "required": false
                      },
                      {
                        "id": "homepage-banner-subtitle",
                        "title": "Banner Subtitle",
                        "type": "short-text",
                        "required": false
                      },
                      {
                        "id": "homepage-banner-description",
                        "title": "Banner Description",
                        "type": "long-text",
                        "required": false
                      },
                      {
                        "id": "homepage-banner-button-name",
                        "title": "Button Name",
                        "type": "short-text",
                        "required": false
                      },
                      {
                        "id": "homepage-banner-button-link",
                        "title": "Button Link",
                        "type": "short-text",
                        "required": false
                      }
                    ]
                  }
                ]
              },
              {
                "id": "promo-bar",
                "title": "Promotion Bar",
                "type": "object",
                "children": [
                  {
                    "id": "promo-text",
                    "title": "Promotion Text",
                    "type": "short-text",
                    "required": false
                  },
                  {
                    "id": "promo-code",
                    "title": "Promo Code (for copying)",
                    "type": "short-text",
                    "required": false
                  },
                  {
                    "id": "promo-value",
                    "title": "Promo Value (e.g. 20% or ₹100)",
                    "type": "short-text",
                    "required": false
                  },
                  {
                    "id": "promo-active",
                    "title": "Show Promotion Bar",
                    "type": "boolean",
                    "required": false
                  }
                ]
              },
              {
                "id": "shop-by-stone-array",
                "title": "Shop By Stone Shape",
                "type": "array",
                "children": [
                  {
                    "id": "shop-by-stone",
                    "title": "Stone Shape",
                    "type": "object",
                    "children": [
                      {
                        "id": "shop-by-stone-image",
                        "title": "Shape Image",
                        "type": "file",
                        "required": false
                      },
                      {
                        "id": "shop-by-stone-name",
                        "title": "Name",
                        "type": "short-text",
                        "required": false
                      },
                      {
                        "id": "shop-by-stone-label",
                        "title": "Label",
                        "type": "short-text",
                        "required": false
                      },
                      {
                        "id": "shop-by-stone-vibe",
                        "title": "Vibe",
                        "type": "short-text",
                        "required": false
                      },
                      {
                        "id": "shop-by-stone-link",
                        "title": "Link",
                        "type": "short-text",
                        "required": false
                      }
                    ]
                  }
                ]
              },
              {
                "id": "logo",
                "title": "Company Logo",
                "type": "file",
                "required": false
              },
              {
                "id": "website-description",
                "title": "Website Description",
                "type": "long-text",
                "required": false
              },
              {
                "id": "contact-us",
                "title": "Contact Us",
                "type": "object",
                "children": [
                  {
                    "id": "contact-whatsapp",
                    "title": "WhatsApp Number",
                    "type": "short-text",
                    "required": false
                  },
                  {
                    "id": "contact-phone",
                    "title": "Phone Number",
                    "type": "short-text",
                    "required": false
                  },
                  {
                    "id": "contact-email",
                    "title": "Email Address",
                    "type": "short-text",
                    "required": false
                  },
                  {
                    "id": "contact-address",
                    "title": "Our Address",
                    "type": "long-text",
                    "required": false
                  }
                ]
              },
              {
                "id": "why-choose-us-title",
                "title": "Why Choose Us Title",
                "type": "short-text",
                "required": false
              },
              {
                "id": "why-choose-us-features",
                "title": "Why Choose Us Features",
                "type": "array",
                "children": [
                  {
                    "id": "feature",
                    "title": "Feature",
                    "type": "object",
                    "children": [
                      {
                        "id": "feature-name",
                        "title": "Feature Name",
                        "type": "short-text",
                        "required": false
                      },
                      {
                        "id": "feature-icon",
                        "title": "Feature Icon",
                        "type": "file",
                        "required": false
                      }
                    ]
                  }
                ]
              },
              {
                "id": "rating-title",
                "title": "Rating Title",
                "type": "short-text",
                "required": false
              },
              {
                "id": "ratings",
                "title": "Ratings",
                "type": "array",
                "children": [
                  {
                    "id": "review",
                    "title": "Review",
                    "type": "object",
                    "children": [
                      {
                        "id": "review-description",
                        "title": "Description",
                        "type": "long-text",
                        "required": false
                      },
                      {
                        "id": "review-user-name",
                        "title": "User Name",
                        "type": "short-text",
                        "required": false
                      },
                      {
                        "id": "review-rating",
                        "title": "Rating",
                        "type": "short-text",
                        "required": false
                      },
                      {
                        "id": "review-profile-image",
                        "title": "Profile Image",
                        "type": "file",
                        "required": false
                      }
                    ]
                  }
                ]
              },
              {
                "id": "faq-array",
                "title": "Help & FAQs",
                "type": "array",
                "children": [
                  {
                    "id": "faq",
                    "title": "FAQ Item",
                    "type": "object",
                    "children": [
                      {
                        "id": "faq-category",
                        "title": "Category Name (e.g. Orders & Shipping)",
                        "type": "short-text",
                        "required": false
                      },
                      {
                        "id": "faq-question",
                        "title": "Question",
                        "type": "short-text",
                        "required": true
                      },
                      {
                        "id": "faq-answer",
                        "title": "Answer",
                        "type": "long-text",
                        "required": true
                      }
                    ]
                  }
                ]
              },
              {
                "id": "social-links",
                "title": "Social Media Links",
                "type": "array",
                "children": [
                  {
                    "id": "social-link",
                    "title": "Social Link",
                    "type": "object",
                    "children": [
                      {
                        "id": "social-platform-name",
                        "title": "Platform Name",
                        "type": "short-text",
                        "required": true
                      },
                      {
                        "id": "social-platform-icon",
                        "title": "Icon",
                        "type": "file",
                        "required": false
                      },
                      {
                        "id": "social-platform-url",
                        "title": "Redirect URL",
                        "type": "short-text",
                        "required": true
                      }
                    ]
                  }
                ]
              }
            ]
          }
        }
      }
    },
    {
      resolve: "medusa-contact-us",
      options: {
        // Contact Request Configuration
        default_status: "pending",
        payload_fields: [
          {
            key: "full_name",
            type: "text",
            required: true,
            label: "Full Name",
            placeholder: "Enter your full name",
          },
          {
            key: "phone",
            type: "text",
            required: false,
            label: "Phone Number",
            placeholder: "+1 (555) 123-4567",
          },
          {
            key: "topic",
            type: "select",
            required: true,
            label: "Topic",
            options: [
              { value: "general_inquiry", label: "General Inquiry (Information)" },
              { value: "order_delivery_issue", label: "Order Issue / Delivery Issue (Order delay, tracking, delivery problem)" },
              { value: "returns_refunds", label: "Returns & Refunds (Return, exchange, refund related)" },
              { value: "product_inquiry", label: "Product Inquiry (Product details, size, availability)" },
              { value: "payment_billing", label: "Payment & Billing Issue (Payment failed, refund, invoice)" },
              { value: "account_login", label: "Account & Login Issue" },
            ],
          },
          {
            key: "message",
            type: "textarea",
            required: true,
            label: "Message",
            placeholder: "Enter your message",
          },
        ],
        allowed_statuses: ["pending", "in_progress", "resolved", "closed"],
        status_transitions: [
          {
            from: null,
            to: "pending",
            send_email: false,
          },
          {
            from: "pending",
            to: "in_progress",
            send_email: true,
            email_subject: "Your request is being processed",
          },
          {
            from: "in_progress",
            to: "resolved",
            send_email: true,
            email_subject: "Your request has been resolved",
          },
          {
            from: "resolved",
            to: "closed",
            send_email: false,
          },
        ],
        email: {
          enabled: true,
          default_subject: "Contact Request Status Update",
          default_template: null,
        },
      },
    },
    {
      resolve: "order-management",
      options: {
        jwtSecret: process.env.JWT_SECRET,
        storefrontUrl: process.env.STOREFRONT_URL,
        email: {
          orderConfirmTemplate: "templates/my-order-confirmation.html",  // Order confirmation email template
          otpTemplate: "templates/otp-template.html",
        },
        notifications: {
          enabled: true,
          statusConfig: {
            "pending": [

              {
                template: "templates/sms/order-placed.txt",
                channel: "sms",
                getRecipient: (order: any, _templateData: any) =>
                  order.shipping_address?.phone || order.billing_address?.phone
              },
              {
                template: "templates/push/order-placed.txt",
                channel: "push"
              }
            ],
            "shipped": [
              {
                template: "templates/emails/order-shipped.html",
                channel: "email",
                getRecipient: (order: any, _templateData: any) => order.email
              }
            ],
            "delivered": [
              {
                template: "templates/emails/order-delivered.html",
                channel: "email",
                getRecipient: (order: any, _templateData: any) => order.email
              },
              {
                template: "templates/sms/order-delivered.txt",
                channel: "sms",
                getRecipient: (order: any, _templateData: any) =>
                  order.shipping_address?.phone || order.billing_address?.phone
              }
            ],
            "canceled": [
              {
                template: "templates/emails/order-canceled.html",
                channel: "email",
                getRecipient: (order: any, _templateData: any) => order.email
              }
            ]
          }
        },
        // SMTP config for order-management plugin to send emails directly
        smtp: {
          enabled: true,
          host: process.env.SMTP_HOST || "smtp.gmail.com",
          port: Number(process.env.SMTP_PORT) || 465,
          secure: process.env.SMTP_SECURE === "true" || process.env.SMTP_PORT === "465",
          auth: {
            user: process.env.SMTP_USER || "",
            pass: process.env.SMTP_PASS || "",
          },
          from: process.env.SMTP_FROM || process.env.SMTP_USER,
        },
      }
    },
    {
      resolve: "customer-registration",
      options: {
        storefrontUrl: process.env.STOREFRONT_URL || "http://localhost:8000",
        registration: {
          identifier: "both", // "email" | "phone" | "both"
          require_verification: true,
        },
        login: {
          identifier: "both", // defaults to registration.identifier
        },
        email_verification: {
          channel: "email",
          subject: "Verify your email",
          // Minimum seconds to wait before sending another OTP email
          resendThrottleSeconds: 20,
          // Optional: path to HTML/text template that will receive {{otp}} and {{customer_name}}
          template: "templates/customer-otp-email.html",
        },
        phone_verification: {
          channel: "sms",
          template: "templates/customer-otp-sms.txt",
        },
        password_reset: {
          template: "templates/password-reset.html",
          sms_body: "Reset your password with code {{token}} or link: {{reset_url}}",
          subject: "Reset Your Password",
        },
        account_deletion_request: {
          channel: "email",
          template: "templates/account-deletion-request.html",
          subject: "Confirm your account deletion request",
          scheduled_days: 7,
        },
        account_deletion_cancel: {
          channel: "email",
          template: "templates/account-deletion-cancel.html",
          subject: "Confirm cancellation of account deletion",
        },
      },
    },
    {
      resolve: "medusa-shiprocket-fulfillment-sbl",
      options: {
        shiprocket: {
          email: process.env.SHIPROCKET_EMAIL,
          password: process.env.SHIPROCKET_PASSWORD,

          pickupLocation: process.env.SHIPROCKET_PICKUP_LOCATION || "Primary",
        },
        webhookSecret: process.env.SHIPROCKET_WEBHOOK_SECRET,
      },
    },
    {
      resolve: "medusa-notification-token-management",
      options: {},
    },
    {
      resolve: "medusa-customer-file-upload",
      options: {},
    },
    {
      resolve: path.dirname(require.resolve("medusa-analytics/package.json")),
      options: {},
    },
    {
      resolve: "medusa-export",
      options: {},
    }
  ],
  modules: {
    product: {
      scope: "internal",
    },
    customer: {
      scope: "internal",
    },
    order: {
      scope: "internal",
    },
    reviews: {
      resolve: path.join(path.dirname(require.resolve("medusa-review-rating/package.json")), ".medusa/server/src/modules/reviews"),
      dependencies: [Modules.PRODUCT],
    },
    cancel_order_reason: {
      resolve: path.join(path.dirname(require.resolve("order-management/package.json")), ".medusa/server/src/modules/cancel-order-reason"),
      dependencies: [Modules.ORDER],
    },
    customer_registration: {
      resolve: path.join(path.dirname(require.resolve("customer-registration/package.json")), ".medusa/server/src/modules/customer-registration"),
      dependencies: [Modules.CUSTOMER],
    },
    [Modules.PAYMENT]: {
      resolve: "@medusajs/medusa/payment",
      options: {
        providers: razorpayPaymentProviders,
      },
    },
    [Modules.AUTH]: {
      resolve: "@medusajs/medusa/auth",
      dependencies: [Modules.CACHE, ContainerRegistrationKeys.LOGGER],
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/auth-emailpass",
            id: "emailpass",
          },
          {
            resolve: "customer-registration/providers/phonepass",
            id: "phonepass",
          },
          {
            resolve: "@medusajs/auth-google",
            id: "google",
            options: {
              clientId: process.env.GOOGLE_CLIENT_ID,
              clientSecret: process.env.GOOGLE_CLIENT_SECRET,
              callbackUrl: process.env.GOOGLE_CALLBACK_URL,
            },
          },
        ],
      },
    },
    [Modules.FULFILLMENT]: {
      resolve: "@medusajs/medusa/fulfillment",
      options: {
        providers: [
          {
            resolve: "@medusajs/fulfillment-manual",
            id: "manual",
          },
          {
            resolve: "medusa-shiprocket-fulfillment-sbl",
            id: "shiprocket",
            options: {
              email: process.env.SHIPROCKET_EMAIL,
              password: process.env.SHIPROCKET_PASSWORD || "",
              // Must match the 'Nickname' of a pickup location in your Shiprocket dashboard
              pickup_location: process.env.SHIPROCKET_PICKUP_LOCATION || "",
              /**
               * Cash on Delivery support.
               * Accepts: 0, 1, "true", or "false"
               * Set to 1 or "true" to enable COD for rate calculations.
               */
              cod: "false",
            },
          },
        ],
      },
    },
    [Modules.NOTIFICATION]: {
      resolve: "@medusajs/medusa/notification",
      options: {
        providers: [
          {
            resolve: "@tsc_tech/medusa-plugin-smtp/providers/smtp",
            id: "smtp",
            options: {
              channels: ["email"],
              fromEmail: process.env.SMTP_FROM || process.env.SMTP_USER,
              transport: {
                host: process.env.SMTP_HOST || "smtp.gmail.com",
                port: Number(process.env.SMTP_PORT) || 465,
                secure: process.env.SMTP_SECURE === "true" || process.env.SMTP_PORT === "465",
                auth: {
                  user: process.env.SMTP_USER || "",
                  pass: process.env.SMTP_PASS || "",
                },
              },
            },
          },
          {
            resolve: "medusa-twilio-sms",
            id: "twilio-sms",
            options: {
              channels: ["sms"],
              account_sid: process.env.TWILIO_ACCOUNT_SID,
              auth_token: process.env.TWILIO_AUTH_TOKEN,
              // Note: Either from_number OR messaging_service_sid is required
              from_number: process.env.TWILIO_PHONE,
              // Alternative: Use messaging_service_sid instead of from_number
              // messaging_service_sid: process.env.TWILIO_MESSAGING_SERVICE_SID,
            },
          },
          {
            resolve: "medusa-notification-provider/providers/fcm",
            id: "fcm",
            options: {
              channels: ["push"],
              projectId: process.env.FCM_PROJECT_ID,
              clientEmail: process.env.FCM_CLIENT_EMAIL,
              privateKey: process.env.FCM_PRIVATE_KEY,
            },
          },
        ],
      },
    },
    // ✅ File service (S3 when real creds exist, otherwise local disk)
    file: {
      resolve: "@medusajs/medusa/file",
      options: {
        providers: fileProviders,
      },
    },
  },
})
