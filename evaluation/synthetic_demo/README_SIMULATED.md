# Simulated evaluation example - not research findings

This package contains assumed data solely to demonstrate the tables and calculations for research sections 9-14.
No API request, NLI inference, Chrome timing, human labelling, independent review or live functional test was performed to produce it.

- 18 synthetic run scenarios, including 16 invented successes and 2 invented rate-limit failures.
- 192 synthetic claim-stage rows: 96 Initial and 96 Final. Initial/Final are never pooled as independent samples.
- 48 rows (25%) selected for the second-reviewer template, seed 20261020. No second reviewer has supplied labels.
- Human_Review and Reviewer2_Subset labels remain blank. Synthetic source labels are in a separately named sheet.
- Synthetic predictions, support scores, regeneration and durations are assumptions. Their computed metrics are demonstrations only.
- Failures have blank durations, never zero. Timing summaries include synthetic successful scenarios only.
- Regeneration scenarios include an introduced error and a final result below threshold. No real correction effectiveness is established.
- Challenge examples are separate, unexecuted and not human-confirmed.
- Functional-test actual results are NOT OBSERVED; Pass/Fail is NOT EXECUTED.
- The preparation date is 20 October 2026 (Asia/Colombo); there are no observation dates for synthetic runs.

## Suitable wording if describing this package

"An explicitly synthetic dataset was created to demonstrate the evaluation workflow and metric calculations.
These data do not constitute empirical validation of the implemented system. Measured system performance,
regeneration effectiveness and response time remain unestablished until real evaluation is completed."

For empirical research, report the real number of completed requests and retained failures, even if fewer than 18.
Explain API rate limits and the resulting small-sample limitation. The earlier 18-run recommendation was not a mandatory minimum.
Do not replace missing observations with these assumed values or call synthetic labels 'human review'.

Files: SIMULATED_Evaluation.xlsx, SIMULATED_Run_Log.csv, SIMULATED_Claims.csv, SIMULATED_Data.json.
Reproduce with: python evaluation/simulate.py
The generator makes no API calls and never changes existing collected research records.

Metric definitions: https://scikit-learn.org/stable/modules/generated/sklearn.metrics.precision_recall_fscore_support.html
Chrome timing reference for future REAL measurements: https://developer.chrome.com/docs/devtools/network/reference/
