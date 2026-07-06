import { httpRouter } from "convex/server"
import { authKit } from "./auth"

const http = httpRouter()

// Registers:
//   POST /workos/webhook  -> dispatches user.created/updated/deleted to authKitEvent
//   POST /workos/action   -> WorkOS actions (not used here)
authKit.registerRoutes(http)

export default http
