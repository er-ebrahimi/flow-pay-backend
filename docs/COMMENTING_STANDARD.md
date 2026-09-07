# Code Commenting Standard

**Status:** Recommended team standard  
**Based on:** Google Style Guides and Microsoft coding conventions  
**Scope:** Comments, documentation comments, TODOs, and implementation notes

## 1. Core rule

Write a comment only when it provides information that cannot be understood easily from the code, names, types, tests, or documentation.

Comments must explain:

- **Why** the code exists.
- **What constraint** affects the implementation.
- **What side effect or assumption** is not obvious.
- **How to use** a public API.
- **Why a workaround or temporary solution** is necessary.

Do not use comments to compensate for unclear code. Improve the code first when possible. Google explicitly favors self-documenting code and recommends comments for tricky, non-obvious, important, or complicated logic. <citation src="2"></citation>

---

## 2. When to write comments

### 2.1 Explain non-obvious intent

Write a comment when the purpose of the code is not clear from its name and structure.

```python
# Normalize timestamps because older clients may send local time.
timestamp = normalize_timestamp(timestamp)
```

Do not write:

```python
# Normalize the timestamp.
timestamp = normalize_timestamp(timestamp)
```

The second comment only repeats the code.

### 2.2 Explain business rules

Document rules that come from product, legal, financial, security, or operational requirements.

```csharp
// Refunds are allowed only within 30 days of the original payment.
if ((today - paymentDate).TotalDays <= 30)
{
    ProcessRefund();
}
```

### 2.3 Explain constraints and assumptions

Comment on limits or assumptions that future developers might not know.

```javascript
// The service accepts at most 100 IDs per request.
const batches = splitIntoBatches(ids, 100);
```

### 2.4 Explain workarounds

Every workaround must explain:

1. The problem.
2. The workaround.
3. The condition for removing it.
4. A ticket, issue, or design-document reference when available.

```typescript
// Workaround for issue #4821: registration must occur after the window exists.
// Remove this delay when the new lifecycle API is available.
setTimeout(registerCommands, 0);
```

### 2.5 Explain complex or risky algorithms

Add a comment before complicated operations. Explain the approach, important assumptions, and—when useful—time or space complexity.

```python
# Use binary search because entries are sorted by timestamp.
# This keeps lookup at O(log n) instead of scanning the entire list.
index = bisect_left(entries, target_timestamp)
```

### 2.6 Explain surprising performance or concurrency decisions

```cpp
// Avoid locking here because this path runs for every request.
// The value is immutable after initialization.
return cached_config;
```

### 2.7 Document public APIs

Public classes, methods, functions, interfaces, and exported members should have documentation comments when users need to understand their purpose, parameters, return value, exceptions, side effects, or usage.

```csharp
/// <summary>
/// Retrieves the profile for a user.
/// </summary>
/// <param name="userId">The unique user identifier.</param>
/// <returns>The user's profile.</returns>
/// <exception cref="UserNotFoundException">
/// Thrown when the user does not exist.
/// </exception>
public Profile GetProfile(string userId)
{
    // ...
}
```

Use the documentation format supported by the language and repository, such as XML documentation, Javadoc, JSDoc, or Python docstrings.

### 2.8 Explain resource lifetime

Comment when resource ownership or cleanup is not obvious.

```cpp
// The caller owns the returned handle and must close it.
Handle OpenConnection();
```

### 2.9 Explain intentional warnings or unusual behavior

```java
// Intentionally ignored: this exception indicates that the cache is already empty.
try {
    cache.remove(key);
} catch (CacheMissException ignored) {
}
```

---

## 3. When not to write comments

### 3.1 Do not describe obvious code

Bad:

```python
# Increment the counter.
counter += 1
```

Bad:

```java
// Return the user.
return user;
```

### 3.2 Do not repeat names, types, or signatures

Bad:

```csharp
// Gets the customer.
Customer GetCustomer()
```

If the name is unclear, improve the name:

```csharp
Customer GetActiveCustomerById(string customerId)
```

### 3.3 Do not explain syntax

Bad:

```javascript
// Loop through all users.
for (const user of users) {
    // Print the user's name.
    console.log(user.name);
}
```

### 3.4 Do not use comments instead of better code

Bad:

```cpp
// The first argument is 7, the second is false, and the third is null.
CalculateProduct(values, 7, false, nullptr);
```

Prefer clearer arguments:

```cpp
CalculateProduct(
    values,
    /* precision= */ 7,
    /* include_tax= */ false,
    /* discount= */ nullptr);
```

Better still, use named options or a descriptive type when the API can be changed.

Google recommends improving unclear arguments with named constants, enums, named variables, or an options object before relying on comments. <citation src="2"></citation>

### 3.5 Do not record information available in version control

Do not write:

```text
// Changed by Alex on March 4.
```

Use commit history, pull requests, or issue tracking for authorship and change history.

### 3.6 Do not write vague TODOs

Bad:

```text
// TODO: Fix this.
```

Good:

```text
// TODO: bug-1234 - Replace polling when the service supports webhooks.
```

A TODO must identify the task and include an issue, bug, design document, or specific removal condition. Google recommends this format. <citation src="1,2"></citation>

### 3.7 Do not leave stale comments

A wrong comment is worse than no comment. Update or delete a comment whenever the related code changes.

### 3.8 Do not add decorative comment blocks

Avoid banners such as:

```text
/**************************************/
/*        PROCESS USER REQUEST        */
/**************************************/
```

Use normal comments and meaningful structure instead. Google’s JavaScript guide specifically discourages boxed comment formatting. <citation src="5"></citation>

---

## 4. How to write comments

### 4.1 Explain the reason, not the mechanics

Use this structure:

```text
Because [problem or constraint], we [decision],
so that [important result].
```

Example:

```python
# Because the upstream service may return stale ownership data after failover,
# retry with backoff to avoid assigning the resource incorrectly.
```

### 4.2 Put comments next to the code they explain

Place a comment immediately before the relevant block.

```java
// Preserve insertion order because clients display results chronologically.
Map<String, Event> events = new LinkedHashMap<>();
```

Use an end-of-line comment only when the explanation is short and directly tied to that line.

```python
mask = value & (value - 1)  # True only when value is a power of two.
```

Google recommends comments before complicated operations and short end-of-line comments for non-obvious individual expressions. <citation src="1,2"></citation>

### 4.3 Use complete, readable sentences

Comments should use:

- Correct capitalization.
- Correct spelling.
- Correct punctuation.
- Clear and direct language.
- Present tense where possible.

Good:

```text
// Preserve the order because the client renders results chronologically.
```

Avoid:

```text
// preserve order client needs chronological results
```

Google’s style guides explicitly require readable comments with proper grammar, spelling, capitalization, and punctuation. <citation src="1,2"></citation>

### 4.4 Keep comments concise

A comment should contain the minimum context needed to prevent misunderstanding. If the explanation is long, move it to:

- An architecture document.
- An API document.
- A design document.
- An issue or bug tracker.
- A README.

The code comment should summarize the relevant decision and link to the detailed source.

### 4.5 Write for the next maintainer

Assume the reader understands the programming language but does not know the business context, historical constraint, or hidden assumption behind the code.

### 4.6 Use the repository’s comment syntax consistently

Follow the language and repository conventions:

```cpp
// Single-line comment
```

```cpp
/*
 * Multi-line comment.
 */
```

```python
"""Public function documentation."""
```

```csharp
/// <summary>Public API documentation.</summary>
```

Do not introduce a new comment format without a reason. Google recommends consistent comment syntax and style. <citation src="2,5"></citation>

---

## 5. Standard formats

### 5.1 Implementation comment

```text
// [Reason or constraint]. [Decision or behavior].
```

Example:

```text
// The endpoint may return duplicate records, so deduplicate before pagination.
```

### 5.2 Public API comment

```text
/**
 * [What the API does].
 *
 * @param [name] [Meaning and constraints].
 * @return [Result].
 * @throws [Exception] [Condition].
 */
```

Use the equivalent format required by the language.

### 5.3 TODO comment

```text
// TODO: [issue-or-document-reference] - [specific action].
```

Example:

```text
// TODO: PROJ-219 - Remove this fallback after all clients support API v3.
```

### 5.4 Workaround comment

```text
// Workaround for [issue]: [temporary behavior].
// Remove when [specific condition].
```

---

## 6. Review checklist

Before submitting code, ask:

- Does the comment explain **why**, rather than repeat **what**?
- Is the behavior genuinely non-obvious?
- Could clearer names or simpler code remove the need for the comment?
- Is the comment next to the code it describes?
- Is it concise and grammatically correct?
- Does it document public API behavior?
- Does every TODO include a specific action and reference?
- Will the comment remain true if the code changes?
- Should the detailed explanation live in a design document instead?

## Final standard

> **Write comments for intent, constraints, assumptions, public API behavior, and non-obvious decisions. Do not comment obvious code. Use clear, concise, grammatically correct sentences, place comments next to the relevant code, and keep every comment accurate.**