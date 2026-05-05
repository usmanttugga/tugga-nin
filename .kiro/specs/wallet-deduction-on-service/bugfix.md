# Bugfix Requirements Document

## Introduction

When a user submits any service request (BVN services, NIN Validation, VNIN Slip, Self Services, Modifications, IPE Clearance, NIN Personalization, FingerPrint Verification, etc.), the wallet balance is deducted in memory but the updated balance is **never persisted to Firestore**. As a result, on the next page load — or whenever the Firestore `onSnapshot` listener fires — the wallet reverts to the pre-deduction value, making it appear as though the user was never charged.

The root cause is that `submitService()` and every caller of `submitWithStatus()` in `user/dashboard.html` perform `walletBalance -= fee` but do not call `syncWalletToFirebase()` afterwards. The fix is to call `syncWalletToFirebase()` inside `submitService()` after the deduction, and inside `submitWithStatus()` so all callers are covered automatically.

---

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user submits a service via `submitService()` (BVN Verification, BVN Retrieval, BVN Modification, BVN User, NIN Validation types, VNIN Slip, Immigration Validation) THEN the system deducts `walletBalance` in memory but does NOT persist the new balance to Firestore

1.2 WHEN a user submits a service via any function that calls `submitWithStatus()` (Self Services, Modification Validation, Date of Birth Attestation, Name Modification, Phone Modification, Address Modification, DOB Modification, NIN Personalization, IPE Normal Clearance, Modification Clearance, Other Error, FingerPrint Verification, Buy Airtime, Buy Data) THEN the system deducts `walletBalance` in memory but does NOT persist the new balance to Firestore

1.3 WHEN the Firestore `onSnapshot` listener fires after a service submission (e.g., on page reload or any Firestore update) THEN the system overwrites the in-memory `walletBalance` with the un-deducted value from Firestore, effectively reversing the deduction

### Expected Behavior (Correct)

2.1 WHEN a user submits a service via `submitService()` THEN the system SHALL deduct the service fee from `walletBalance` AND immediately persist the updated balance to Firestore by calling `syncWalletToFirebase()`

2.2 WHEN a user submits a service via any function that calls `submitWithStatus()` THEN the system SHALL deduct the service fee from `walletBalance` AND immediately persist the updated balance to Firestore by calling `syncWalletToFirebase()` (either inside `submitWithStatus()` itself or at every call site)

2.3 WHEN the Firestore `onSnapshot` listener fires after a service submission THEN the system SHALL reflect the already-persisted deducted balance, so the displayed wallet balance remains consistent

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a user funds their wallet via Paystack THEN the system SHALL CONTINUE TO credit `walletBalance` and persist the updated balance to Firestore via `syncWalletToFirebase()`

3.2 WHEN a user's bio data does not match during NIN Verification and a refund is issued THEN the system SHALL CONTINUE TO refund `walletBalance` and persist the updated balance to Firestore via `syncWalletToFirebase()`

3.3 WHEN a user completes the NIN Verification slip flow (Verify with NIN / Phone / Bio Data) THEN the system SHALL CONTINUE TO deduct the slip fee and persist the updated balance to Firestore via `syncWalletToFirebase()`

3.4 WHEN a user has insufficient wallet balance for any service THEN the system SHALL CONTINUE TO reject the submission with an "Insufficient wallet balance" error and leave `walletBalance` unchanged

3.5 WHEN an admin funds a user wallet via `confirmFundWallet()` THEN the system SHALL CONTINUE TO increment the user's Firestore wallet balance using `fbIncrement()` independently of the user-side deduction logic

---

## Bug Condition (Pseudocode)

**Bug Condition Function** — identifies service submissions that trigger the bug:

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type ServiceSubmission
  OUTPUT: boolean

  // Returns true when a service deducts walletBalance but does NOT call syncWalletToFirebase
  RETURN X.deductsWalletBalance = true
     AND X.callsSyncWalletToFirebase = false
END FUNCTION
```

**Property: Fix Checking**

```pascal
// For every service submission that triggers the bug condition,
// the fixed code must persist the deducted balance to Firestore
FOR ALL X WHERE isBugCondition(X) DO
  result ← submitService'(X)   // or submitWithStatus'(X)
  ASSERT firestoreWallet(user) = walletBalance_before - X.fee
END FOR
```

**Property: Preservation Checking**

```pascal
// For all non-buggy paths (funding, refunds, already-correct slip flow),
// the fixed code must behave identically to the original
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT F(X) = F'(X)
END FOR
```
