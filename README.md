# Seer

Seer is an MCP application for transparent, CSV-based predictive analysis.
It will help non-technical users profile approved datasets, approve a
supervised-learning plan, and understand the resulting estimate or
classification.

## Phase 0: deployment spike

This phase contains one MCP tool, `python_health`. It verifies that the
NitroStack server can call the independently deployed FastAPI ML service.

### Local setup

1. Copy `.env.example` to `.env` and set a long shared `ML_SERVICE_API_KEY`.
2. In another terminal, install and start the ML service:

   ```bash
   cd ml-service
   python -m venv .venv
   .venv/bin/pip install -e ".[dev]"
   ML_SERVICE_API_KEY=your-secret .venv/bin/uvicorn app.main:app --port 8080
   ```

3. Install Node dependencies and run the MCP server:

   ```bash
   npm install
   npm run dev
   ```

Run the TypeScript unit tests with `npm run test:unit`, and the Python tests
with `cd ml-service && python -m pytest`.

### Deployment contract

Deploy `ml-service/` independently to Cloud Run in `asia-south1` and configure
the same `ML_SERVICE_API_KEY` as a Cloud Run secret and NitroCloud environment
variable. The Cloud Run endpoint may allow unauthenticated invocation because
the application requires the bearer secret for every request. Configure the
deployed NitroCloud server with the Cloud Run HTTPS URL, then invoke
`python_health`; a successful response is:

```json
{"status":"healthy","service":"seer-ml","version":"0.1.0"}
```
