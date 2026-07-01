import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { validateEnvironment } from "./lib/env-validator";

// Handle MSAL redirect before app renders
async function initializeApp() {
  // Validate environment variables at startup
  const envValidation = validateEnvironment();

  if (!envValidation.valid) {
    console.error("⚠️  Application starting with missing environment variables.");
    console.error("Some features may not work correctly.");
    // Continue loading the app - Supabase client will show its own error if connection fails
  }

  try {
    // Dynamically import to avoid issues if MSAL not configured
    const { handleMSALRedirect } = await import("./lib/azureAuth");
    await handleMSALRedirect();
  } catch (error) {
    // MSAL not configured or error handling redirect - continue with app
    console.log("MSAL redirect handling skipped:", error);
  }

  // Render the app
  createRoot(document.getElementById("root")!).render(<App />);
}

initializeApp();
