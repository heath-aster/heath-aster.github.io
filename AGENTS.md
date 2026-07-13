<!-- Repository-specific guidance derived from README.md, existing AGENTS.md/CLAUDE.md, and prior Codex task history. Shared defaults adapted from ../AGENTS baseline.md. -->

# AGENTS.md — Henry Zhang academic website

## Repository mission

This is the source for Henry Zhang's academic website and public CV. Accuracy, privacy, link integrity, reproducible generation, and a clean public presentation matter more than framework modernization. The site is based on the Academic Pages/Jekyll structure and includes generated presentation data shared across the website and CV.

## Content and source-of-truth rules

- Treat all committed content as public. Do not add private correspondence, non-public flyout labels, personal contact details, unpublished data, or sensitive project notes.
- Preserve the existing Jekyll structure and theme unless the user explicitly requests a redesign. Make narrow changes in `_pages/`, `_data/`, `_includes/`, `_sass/`, or `files/` as appropriate.
- `_data/presentations.json` is the structured source for presentations. `scripts/generate_cv_presentations.py` generates `_generated/cv_presentations.tex` for `files/CV.tex`, while `_includes/selected-presentations.html` renders the selected website subset. Update the source and regenerate rather than hand-editing both outputs.
- Keep public selection rules distinct from the full CV: do not separately label flyouts as flyouts, and exclude coauthor presentations from Henry's CV when the source data mark them as such.
- Verify dates, venue names, coauthor attribution, paper titles, PDF filenames, and internal/external links. Do not infer an upcoming talk has occurred.
- Preserve stable URLs and filenames for public papers/slides whenever possible. If renaming is necessary, update every reference and consider redirects.

## Build and generated files

- Use the existing Ruby/Jekyll toolchain (`Gemfile`, `_config.yml`) and inspect `CONTRIBUTING.md` before broad theme changes.
- After presentation-data edits, run `python3 scripts/generate_cv_presentations.py`, inspect the generated TeX diff, and compile `files/CV.tex` when a TeX engine is available.
- For site changes, run `bundle exec jekyll serve` or the repository's documented Docker workflow and inspect desktop/mobile rendering, navigation, asset paths, and console/build errors.
- Generated `.aux`, `.log`, and similar TeX artifacts are not source. Do not commit new build debris; update the final `files/CV.pdf` only when the task calls for it and the source compiles cleanly.
- The top-level `README.md` is empty, so repository behavior must be inferred from the current tree, configuration, generator scripts, and prior task history; do not invent deployment steps.

## Writing and design

- Public copy should be concise, factual, and professionally understated. Avoid inflated claims and internal jargon.
- Maintain accessible contrast, alt text, semantic headings, readable small text, and responsive layouts. Avoid styling that looks correct only at one viewport.
- When listing talks by paper on the website, keep the display compact and selected; the CV remains chronological by year. Both views should derive from the same structured records.

## Shared working defaults

This section is a repository-safe adaptation of `../AGENTS baseline.md`. The current user request takes precedence, followed by the repository-specific instructions above, then these defaults. Treat project status, estimates, affiliations, data access, and deadlines as time-sensitive; verify them against the current files and conversation. Do not copy personal or sensitive context into repository files or outputs unless it is directly required and explicitly authorized.

### How to collaborate

- Lead with the answer, preferred interpretation, or recommended action.
- If several options are plausible, rank them and recommend one under explicit assumptions. Do not hide behind an unstructured list.
- Be concrete and operational: give the estimating equation, fixed effects, clustering level, exact merge keys, run command, file path, or paste-ready prose when useful.
- Be candid. Triage fatal conceptual or identification problems before fixable issues, extensions, and cosmetic edits. Push back with a specific reason and a feasible alternative.
- Preserve earlier decisions, terminology, notation, and constraints. Incorporate corrections immediately and do not reintroduce rejected suggestions.
- Make reasonable, low-risk assumptions that keep work moving, but surface assumptions that materially affect the estimand, data, architecture, or external side effects. Stop and ask when a choice would substantially change the requested result.
- Keep changes surgical. Do not refactor adjacent systems, remove unfamiliar comments, or delete pre-existing code merely because it appears unused. Remove only dead code created by the current change; flag other dead code separately.
- Prefer the smallest clear solution. Add abstractions only when they reduce real repetition or prevent a documented class of errors.

### Research standard

- State the paper's proposed contribution in one or two sentences before evaluating whether the design identifies it.
- Separate identification from mechanism and correlation from causation. A significant coefficient or heterogeneous effect is not, by itself, evidence for the claimed mechanism.
- Pressure-test the counterfactual, treatment exogeneity, timing, anticipation, selection, matching, measurement error, spillovers, and general-equilibrium responses.
- Keep pledgeable value distinct from fundamental value. Test whether a result attributed to pledgeability or collateral capacity could instead reflect demand, risk, governance, selection, or accounting mechanics.
- Prefer high-return tests using variables already in the project. Label proposed work as essential for identification, high-return mechanism test, useful robustness check, or optional extension, and say what threat it addresses.
- Never invent citations, institutional facts, legal rules, datasets, variables, schemas, or estimates. Verify precise and time-sensitive claims from primary sources when possible, and state uncertainty plainly.
- For theory, use the smallest model that generates the economic tradeoff and an observable prediction. State agents, timing, information, constraints, equilibrium concept, and the mapping from parameters or wedges to empirical moments. Check signs, units, multipliers, and numerical stability.

### Empirical implementation

For a proposed or edited design, make the following explicit when relevant:

1. Unit of observation and sample.
2. Treatment or shock, exposure, outcomes, and pre/post timing.
3. Estimating equation and the variation that identifies the coefficient.
4. Fixed effects and the confounds each absorbs.
5. Clustering level and why it matches the variation or dependence.
6. Identifying assumption in plain language.
7. Main threat and the most informative diagnostic or falsification.
8. Units and economic magnitude of the coefficient.

For shift-share designs, inspect share construction, leave-one-out choices, concentration, predetermined networks, serial correlation, and aggregate-shock mechanical correlation. For IV, distinguish relevance from exclusion and state the complier interpretation. For staggered treatment or event studies, handle heterogeneity, anticipation, reversals, never-treated units, comparison groups, and simultaneous shocks rather than defaulting mechanically to two-way fixed effects. For lender-borrower or fund-firm panels, use within-borrower comparisons and predetermined relationships where feasible, and be precise about what is observed about investors, holdings, and trades.

### Code and data

- Inspect the repository before choosing a language, package, path, or naming convention. Preserve the existing ecosystem and style.
- Produce runnable, auditable code rather than disconnected pseudocode when implementation is requested. State required packages, inputs, outputs, and assumptions.
- Preserve raw data. Write derived outputs separately and do not commit restricted, licensed, or sensitive data.
- Use configured paths or environment variables. Do not introduce machine-specific absolute paths or hidden manual state.
- Use deterministic seeds for randomized work. Record data-generating parameters for simulations when they are part of the validation target.
- Before merges, normalize identifiers deliberately, specify keys, check uniqueness, and guard against accidental many-to-many joins. Report unmatched observations, row-count changes, and sample attrition.
- Add assertions for required files and columns, identifier granularity, date types, economically important ranges, and structural invariants. Fail with informative messages rather than silently coercing or dropping data.
- For large administrative data, consider memory, indexing, chunking, and computational cost before choosing an implementation.
- Diagnose the root cause before patching a bug. Explain whether it affects estimates, presentation, or reproducibility. Test on the smallest representative input, then verify proportionately to risk.
- For non-trivial logic, define the success check first; implement until it passes. Start with the obviously correct version, then optimize only if the cost matters.

### Writing, LaTeX, tables, and figures

- Write concise, precise prose. Preserve meaning and approximately the original length unless asked otherwise. Remove filler, repetition, vague transitions, inflated claims, and unsupported causal language.
- For revisions, provide polished text first and explain only substantive ambiguities or changes in meaning.
- Organize academic prose around the economic problem, the gap in existing evidence, the setting and identifying variation, economically interpretable findings, and a disciplined contribution.
- Preserve existing LaTeX commands, notation, labels, bibliography system, and themes. Return a compilable file or exact patch, check environments and references, and avoid unnecessary one-off macros.
- Use claim-driven slide titles and text that can be spoken naturally. Put secondary derivations and robustness material in the appendix when appropriate.
- Tables and figures must state units, sample, frequency, weighting, transformations, omitted categories, fixed effects, and clustering as relevant. Prefer informative labels and code-generated outputs. Do not truncate axes misleadingly or connect across missing event-time cells without making the gap visible.

### Completion standard

After modifying files, report:

1. Files changed and why.
2. A copy-pasteable verification command or the exact checks run.
3. Assumptions, unavailable inputs, and remaining risks.

For read-only reviews, distinguish verified facts from inferences and say what was not run. For RA validation, first identify the narrow requested test; prefer a focused diagnostic over a broad rebuild unless the user explicitly expands the scope.
