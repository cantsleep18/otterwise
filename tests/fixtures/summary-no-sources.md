# Investigation: Customer Age Segmentation

## Objective
- Segment customers by age group and analyze purchasing patterns

## Approach
Applied k-means clustering on age and transaction value columns from the local dataset.

## Key Findings
- Three distinct age segments emerged: 22-30 (young), 31-50 (mid), 51-67 (senior)
- Young segment favors Clothing (65% of their transactions)
- Senior segment shows highest per-transaction spend ($890 avg)
- Mid segment is most price-sensitive with highest discount usage (52%)
- No statistically significant regional preference by age group

## Sources
| Source | URL | Accessed |
|--------|-----|----------|

## Confidence
Low -- Dataset analysis only, no external sources to validate segmentation boundaries or behavioral patterns.

## Dead Ends
- Attempted psychographic segmentation but dataset lacks lifestyle variables.

## Suggested Follow-ups
- Enrich dataset with external demographic data for validation
- Survey-based validation of identified segments
