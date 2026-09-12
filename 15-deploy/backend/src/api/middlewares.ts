import { defineMiddlewares } from "@medusajs/framework/http"

const UPLOAD_SIZE_LIMIT = "50mb"

export default defineMiddlewares({
  routes: [
    {
      matcher: "/admin/uploads*",
      method: ["POST"],
      bodyParser: {
        sizeLimit: UPLOAD_SIZE_LIMIT,
      },
    },
    {
      matcher: "/admin/custom/upload*",
      method: ["POST"],
      bodyParser: {
        sizeLimit: UPLOAD_SIZE_LIMIT,
      },
    },
  ],
})
