# Aura - Ready for Vercel

This is a unified deployment folder containing both the React frontend and the Node.js API serverless functions.

## 🚀 Deployment Instructions

1.  **Install Vercel CLI** (if not already installed):
    ```bash
    npm i -g vercel
    ```

2.  **Deploy**:
    From this directory (`ready-for-vercel`), run:
    ```bash
    vercel
    ```

3.  **Configure Environment Variables**:
    Ensure the following secrets are set in your Vercel project:
    - `NOTION_API_KEY`
    - `GOOGLE_GENERATIVE_AI_API_KEY` (if using Google models)
    - `GROQ_API_KEY` (if using Groq models)

## 📁 Structure

- `/api`: Vercel Serverless Functions (Node.js/TypeScript).
- `/src`: React Frontend (Vite).
- `vercel.json`: Handles routing for the SPA and API.
