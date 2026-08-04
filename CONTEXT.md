# FX Inline

FX Inline identifies prices on webpages and presents conversions in a preferred currency without requiring the user to leave the page.

## Language

**Activation Scan**:
The lightweight pre-worker search for evidence that a webpage contains a currency token paired with an amount. It determines whether FX Inline should load its full conversion worker.
_Avoid_: Currency scan, initial scan, price scan

**Activation Signal**:
Evidence that page text can contain a supported currency token near a numeric amount. It is sufficient to start the conversion worker, but it does not confirm a valid price.
_Avoid_: Price match, parsed price

**Currency Token**:
A supported ISO currency code or currency symbol that can identify a currency when it is near a numeric amount.
_Avoid_: Currency marker, currency label

**Ambiguous ISO Code**:
An ISO currency code that is also a common word or name. It remains valid for conversion, but it cannot create an Activation Signal by itself.
_Avoid_: Blocked currency, unsupported code

**Visited Text Node**:
A text node that the conversion DOM walker reaches during Candidate Discovery.
_Avoid_: Scanned node, candidate

**Accepted Candidate**:
A Visited Text Node that passes the cheap price-text check and the DOM eligibility rules. It can enter Generic Conversion.
_Avoid_: Scanned text node, price match

**Candidate Discovery**:
The phase that finds Accepted Candidates in a conversion root.
_Avoid_: Generic Conversion, Activation Scan

**Generic Conversion**:
The phase that checks Accepted Candidates for supported price forms and converts valid prices.
_Avoid_: Candidate Discovery, Activation Scan

**Conversion Coverage**:
The set of valid prices that FX Inline can find and convert. A performance change must not reduce this set.
_Avoid_: Conversion count, candidate yield

**Full Conversion Task**:
One complete FX Inline operation from the start of conversion through visible converted output.
_Avoid_: Parser task, extraction task

**Performance Fixture**:
A fixed offline webpage, conversion configuration, rate set, and expected output used to compare conversion behavior and CPU time across builds.
_Avoid_: Benchmark input, generated snapshot

**Setup Phase**:
The part of a Full Conversion Task that prepares pass state, configuration, caches, styles, and prior conversion output.
_Avoid_: Discovery Phase, Analysis Phase, Render Phase

**Discovery Phase**:
The part of a Full Conversion Task that reads the webpage and finds eligible conversion candidates.
_Avoid_: Setup Phase, Analysis Phase, Render Phase

**Analysis Phase**:
The part of a Full Conversion Task that parses candidates, resolves currencies, converts values, and formats output text.
_Avoid_: Setup Phase, Discovery Phase, Render Phase

**Render Phase**:
The part of a Full Conversion Task that writes converted output to the webpage.
_Avoid_: Setup Phase, Discovery Phase, Analysis Phase
