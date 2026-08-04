---
status: accepted
---

# Use one ordered currency extraction scan

Currency extraction will use one ordered scan that recognizes currency tokens, amounts, and ranges. At each input position, it will select the longest valid match, emit matches in input order, and move to the match end. This design removes repeated full-text scans, repeated parsing, global result sorting, and overlap cleanup while it keeps the public parser interface and output unchanged.
