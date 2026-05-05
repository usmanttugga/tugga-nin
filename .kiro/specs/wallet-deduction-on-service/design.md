# Wallet Deduction on Service Bugfix Design

## Overview

Every service submission in `user/dashboard.html` deducts `walletBalance` in memory but never calls `syncWalletToFirebase()` to persist the new balance to Firestore. When the Firestore `onSnapshot` listener fires (on page reload or any Firestore update), it overwrites the in-memory balance with the un-deducted value, effectively reversing the charge.

The fix is minimal and targeted: add one `syncWalletToFirebase()` call inside `submitService()` (after the deduction) and one inside `submitWithStatus()` (at the end of the function body). This covers all service submission paths in a single change to `user/dashboard.html`.

---

## Glossary

- **Bug_Condition (C)**: A service submission that deducts `walletBalance` in memory but does NOT call `syncWalletToFirebase()` to persist the updated balance to Firestore.
- **Property (P)**: After any service submission, the Firestore `wallet` field for the user SHALL equal `walletBalance_before - fee`.
- **Preservation**: All existing `syncWalletToFirebase()` call sites (Paystack funding, bio-data refund, NIN Verification slip flow) and all insufficient-balance guards must remain unchanged.
- **`submitService()`**: The function in `user/dashboard.html` that handles BVN services, NIN Validation types, VNIN Slip, and Immigration Validation. It deducts `walletBalance` but currently does not call `syncWalletToFirebase()`.
- **`submitWithStatus(service, details, fee, status, formData)`**: The shared helper in `user/dashboard.html` called by all other service handlers (Self Services, Modification Validation, Date of Birth Attestation, Name/Phone/Address/DOB Modification, NIN Personalization, IPE Clearance, FingerPrint Verification, Buy Airtime, Buy Data). It saves the transaction to Firestore but currently does not sync the wallet balance.
- **`syncWalletToFirebase()`**: The function in `user/dashboard.html` that calls `fbUpdateDoc` to write the current `walletBalance` to the `users/{uid}` document in Firestore.
- **`walletBalance`**: The in-memory variable holding the user's current wallet balance. Updated by deductions and credits throughout the session.
- **`onSnapshot` listener**: The Firestore real-time listener that reads the user's wallet balance from Firestore and overwrites `walletBalance` in memory whenever the document changes or the page loads.

---

## Bug Details

### Bug Condition

The bug manifests when a user submits any service request. The `submitService()` function deducts `walletBalance` but does not call `syncWalletToFirebase()`. Similarly, every caller of `submitWithStatus()` deducts `walletBalance` before calling it, but `submitWithStatus()` itself does not call `syncWalletToFirebase()`. As a result, the Firestore `wallet` field is never updated, and the next `onSnapshot` event reverts the in-memory balance.

**Formal Specification:**
```
FUNCTION isBugCondition(X)
  INPUT: X of type ServiceSubmission
  OUTPUT: boolean

  // Returns true when a service deducts walletBalance but does NOT persist it
  RETURN X.deductsWalletBalance = true
     AND X.callsSyncWalletToFirebase = false
END FUNCTION
```

### Examples

- **BVN Verification (₦200)**: User submits → `walletBalance -= 200` in `submitService()` → no `syncWalletToFirebase()` → page reload → `onSnapshot` restores balance to pre-deduction value → user appears uncharged.
- **Buy Airtime (₦500)**: User submits → `walletBalance -= 500` before `submitWithStatus()` call → `submitWithStatus()` saves transaction to Firestore but never syncs wallet → Firestore update fires `onSnapshot` → balance reverts to ₦500 more than it should be.
- **NIN Personalization (₦1,000)**: User submits → `walletBalance -= 1000` → `submitWithStatus()` called → wallet not synced → user can reload and resubmit without losing balance.
- **Paystack funding (not a bug)**: `walletBalance += amt` → `syncWalletToFirebase()` called immediately → balance correctly persisted. This path is unaffected by the fix.

---

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- `syncWalletToFirebase()` in the NIN Verification slip flow (line ~2079 and ~2090) — already correct, must stay.
- `syncWalletToFirebase()` in the Paystack funding callback (line ~2970) — already correct, must stay.
- `syncWalletToFirebase()` in the bio-data no-match refund (line ~2090) — already correct, must stay.
- Insufficient-balance guards in all submission functions — must continue to reject submissions and leave `walletBalance` unchanged.
- Admin `confirmFundWallet()` in `admin/dashboard.html` — uses `fbIncrement()`, completely separate from user-side deduction logic, must stay unchanged.
- Self-service and modification-validation callers that already call `syncWalletToFirebase()` after `submitWithStatus()` (lines ~1595 and ~1680) — these will now call it twice (once at the call site, once inside `submitWithStatus()`). This is safe because `syncWalletToFirebase()` is idempotent — it simply writes the current `walletBalance` value.

**Scope:**
All inputs that do NOT involve a service fee deduction should be completely unaffected by this fix. This includes:
- Wallet funding via Paystack
- Bio-data refund path
- Navigation, UI interactions, and display updates
- Admin-side wallet operations

---

## Hypothesized Root Cause

Based on the bug description and code review, the root cause is:

1. **Missing `syncWalletToFirebase()` in `submitService()`**: The function deducts `walletBalance` (line ~1714) and saves the transaction to Firestore, but never calls `syncWalletToFirebase()`. The NIN Verification slip flow (a separate code path) correctly calls it, but `submitService()` does not.

2. **Missing `syncWalletToFirebase()` in `submitWithStatus()`**: The shared helper saves the transaction document to Firestore via `fbSetDoc` but returns without syncing the wallet. Every caller deducts `walletBalance` before calling it, so the deduction is always in memory but never persisted through this path.

3. **`onSnapshot` listener overwrites in-memory balance**: The Firestore real-time listener reads `users/{uid}.wallet` and sets `walletBalance` to whatever is in Firestore. Since the deduction was never written to Firestore, the listener always restores the pre-deduction value, making the bug visible on any page reload or Firestore document update.

4. **Inconsistent call-site pattern**: Two call sites (`submitSelfService` and `submitModVal`) already call `syncWalletToFirebase()` after `submitWithStatus()`, but the majority of callers do not. This inconsistency suggests the fix was applied partially in some places but not systematically.

---

## Correctness Properties

Property 1: Bug Condition - Service Submission Persists Wallet Deduction

_For any_ service submission where the bug condition holds (a fee is deducted from `walletBalance` via `submitService()` or a `submitWithStatus()` caller), the fixed code SHALL call `syncWalletToFirebase()` so that the Firestore `users/{uid}.wallet` field equals `walletBalance_before - fee` immediately after submission.

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - Non-Deduction Paths Unchanged

_For any_ code path where the bug condition does NOT hold (Paystack funding, bio-data refund, NIN Verification slip flow, insufficient-balance rejection, admin wallet operations), the fixed code SHALL produce exactly the same behavior as the original code, preserving all existing `syncWalletToFirebase()` calls and balance guards.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

---

## Fix Implementation

### Changes Required

**File**: `user/dashboard.html`

**Fix 1 — `submitService()`**

**Specific Change**: Add `syncWalletToFirebase();` immediately after `walletBalance -= currentService.price;` (before the `details` variable is computed).

```js
// BEFORE
walletBalance -= currentService.price;
const details = currentService.type === "nin" ...

// AFTER
walletBalance -= currentService.price;
syncWalletToFirebase();
const details = currentService.type === "nin" ...
```

**Fix 2 — `submitWithStatus()`**

**Specific Change**: Add `syncWalletToFirebase();` at the end of the function body, after the `fbSetDoc` call and before `return txn`.

```js
// BEFORE
    if (window.fbReady) {
      window.fbSetDoc(window.fbDoc(window.fbDB, 'transactions', txn.id), txn)
        .catch(e => console.error('Firebase txn error:', e));
    }
    return txn;
  }

// AFTER
    if (window.fbReady) {
      window.fbSetDoc(window.fbDoc(window.fbDB, 'transactions', txn.id), txn)
        .catch(e => console.error('Firebase txn error:', e));
    }
    syncWalletToFirebase();
    return txn;
  }
```

**Notes on idempotency**: The two call sites that already invoke `syncWalletToFirebase()` after `submitWithStatus()` (self-service and mod-val handlers) will now trigger two calls in quick succession. This is safe — both calls write the same `walletBalance` value to Firestore, and the second write is a no-op in practice.

---

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that mock `syncWalletToFirebase` and `fbSetDoc`, simulate a service submission through `submitService()` and `submitWithStatus()`, and assert that `syncWalletToFirebase` was called. Run these tests on the UNFIXED code to observe failures and confirm the root cause.

**Test Cases**:
1. **`submitService()` BVN path**: Call `submitService()` with a BVN service and sufficient balance — assert `syncWalletToFirebase` was called (will fail on unfixed code).
2. **`submitService()` NIN Validation path**: Call `submitService()` with a NIN Validation service — assert `syncWalletToFirebase` was called (will fail on unfixed code).
3. **`submitWithStatus()` direct call**: Call `submitWithStatus()` directly — assert `syncWalletToFirebase` was called (will fail on unfixed code).
4. **Buy Airtime path**: Simulate `buyAirtime()` with sufficient balance — assert `syncWalletToFirebase` was called (will fail on unfixed code).

**Expected Counterexamples**:
- `syncWalletToFirebase` is never called after `submitService()` or `submitWithStatus()` on unfixed code.
- Possible causes: missing call in `submitService()`, missing call in `submitWithStatus()`.

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function persists the wallet deduction to Firestore.

**Pseudocode:**
```
FOR ALL X WHERE isBugCondition(X) DO
  result := submitService_fixed(X)   // or submitWithStatus_fixed(X)
  ASSERT syncWalletToFirebase_called = true
  ASSERT firestoreWallet(user) = walletBalance_before - X.fee
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed code produces the same behavior as the original.

**Pseudocode:**
```
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT F(X) = F'(X)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for Paystack funding, bio-data refund, and insufficient-balance paths, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Paystack Funding Preservation**: Verify `syncWalletToFirebase` is still called after wallet funding — must work on both unfixed and fixed code.
2. **Bio-Data Refund Preservation**: Verify `syncWalletToFirebase` is still called after a no-match refund — must work on both unfixed and fixed code.
3. **Insufficient Balance Guard Preservation**: Verify that when `walletBalance < fee`, the submission is rejected and `walletBalance` is unchanged — must work on both unfixed and fixed code.
4. **NIN Slip Flow Preservation**: Verify `syncWalletToFirebase` is still called in the NIN Verification slip flow — must work on both unfixed and fixed code.

### Unit Tests

- Test that `submitService()` calls `syncWalletToFirebase()` after deducting the fee.
- Test that `submitWithStatus()` calls `syncWalletToFirebase()` at the end of its body.
- Test that insufficient-balance guards prevent deduction and do not call `syncWalletToFirebase()`.
- Test that the Paystack funding callback still calls `syncWalletToFirebase()`.
- Test that the bio-data refund path still calls `syncWalletToFirebase()`.

### Property-Based Tests

- Generate random valid service submissions (random fee, random starting balance above fee) and verify `syncWalletToFirebase` is always called exactly once per submission path.
- Generate random insufficient-balance scenarios and verify `syncWalletToFirebase` is never called and `walletBalance` is unchanged.
- Generate random non-service-submission events (funding, refund) and verify their `syncWalletToFirebase` call count is unchanged by the fix.

### Integration Tests

- Submit a BVN service, reload the page, and verify the displayed wallet balance reflects the deduction.
- Submit via `submitWithStatus()` (e.g., Buy Airtime), trigger an `onSnapshot` update, and verify the balance does not revert.
- Verify that the two call sites that already called `syncWalletToFirebase()` after `submitWithStatus()` (self-service, mod-val) continue to work correctly with the double-call pattern.
