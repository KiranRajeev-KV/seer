# Seer

Seer is an MCP application for transparent, CSV-based predictive analysis.
It helps non-technical users profile approved datasets, create and approve a
supervised-learning plan, and understand the resulting estimate or
classification.

## Phase 4: approved regression and classification analysis

Seer includes approved synthetic employee-compensation regression and
employee-attrition classification datasets. The MCP server exposes their
catalogue at `seer://datasets`, their CSV resources, and the `profile_dataset`
tool.

The profiler scans the full CSV in the Python service and returns column types,
missing values, duplicates, candidate targets and identifiers, distributions,
and data-quality warnings. `create_analysis_plan` then validates the selected
target, features, task type, and prediction inputs against the packaged CSV.
It returns a signed approval token valid for 15 minutes. Approving the plan
calls `run_analysis`, which verifies that token and the packaged CSV, then sends
the approved plan to the Python service. The service uses an 80/20, seed-42
split; classification splits are stratified. It fits numeric
median-imputation/scaling and categorical most-frequent-imputation/one-hot
encoding only on training data; compares linear regression against a
training-mean baseline; and compares logistic regression against a
most-frequent-class baseline. The results widget shows the appropriate
estimates or classifications, baseline comparison, probabilities and metrics,
diagnostics, coverage, and limitations.

The datasets are synthetic and committed as runtime resources.

### Local setup

1. Copy `.env.example` to `.env`, set a long shared `ML_SERVICE_API_KEY`, and
   set a different `ANALYSIS_PLAN_TOKEN_SECRET` of at least 32 characters.
2. In another terminal, install and start the ML service. The checked-in
   `ml-service/.python-version` constrains uv to Python 3.12.

   ```bash
   cd ml-service
   uv sync --extra dev
   ML_SERVICE_API_KEY=your-secret uv run uvicorn app.main:app --port 8080
   ```

3. Install Node dependencies and run the MCP server:

   ```bash
   npm install
   npm run dev
   ```

Run the TypeScript unit tests with `npm run test:unit`, build widgets with
`npm --prefix src/widgets run build`, and run Python tests with
`cd ml-service && uv run --extra dev pytest`.

### Profiling limits

The ML service rejects CSVs above these configurable limits before profiling:

| Environment variable | Default |
| --- | ---: |
| `ML_PROFILE_MAX_CSV_BYTES` | 5 MiB |
| `ML_PROFILE_MAX_CSV_ROWS` | 20,000 |
| `ML_PROFILE_MAX_CSV_COLUMNS` | 50 |
| `ML_PROFILE_MAX_CATEGORICAL_VALUES` | 50 |
| `ML_PROFILE_SAMPLE_ROWS` | 10 |

`ML_SERVICE_TIMEOUT_MS` defaults to 120,000 milliseconds for profile and
analysis requests. `run_analysis` supports optional MCP Tasks: ordinary calls
return synchronously, while task-capable clients receive progress updates and
can cancel before the ML-service call completes.

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

After each NitroCloud deployment, read `seer://datasets`, then profile and run
one approved regression plan and one approved classification plan. This
confirms that both CSV files were copied into the deployed server artifact,
NitroCloud can reach the Cloud Run ML endpoint, and the full approved-analysis
workflow succeeds.
