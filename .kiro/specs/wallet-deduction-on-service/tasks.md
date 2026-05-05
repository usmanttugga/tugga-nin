# Wallet Deduction on Service – Implementation Tasks

## Tasks

- [x] 1. Write exploratory bug-condition tests (run on unfixed code)
  - [x] 1.1 In `tests/bug-condition.test.js`, add a test that calls `submitService()` with a BVN service and sufficient balance and asserts that `syncWalletToFirebase` was called — expect this to FAIL on unfixed code
  - [x] 1.2 Add a test that calls `submitService()` with a NIN Validation service and asserts that `syncWalletToFirebase` was called — expect this to FAIL on unfixed code
  - [x] 1.3 Add a test that calls `submitWithStatus()` directly and asserts that `syncWalletToFirebase` was called — expect this to FAIL on unfixed code
  - [x] 1.4 Add a test that simulates `buyAirtime()` with sufficient balance and asserts that `syncWalletToFirebase` was called — expect this to FAIL on unfixed code
  - [x] 1.5 Run the exploratory tests and confirm they fail, validating the root cause hypothesis

- [x] 2. Apply the fix to `user/dashboard.html`
  - [x] 2.1 In `submitService()`, add `syncWalletToFirebase();` immediately after `walletBalance -= currentService.price;`
  - [x] 2.2 In `submitWithStatus()`, add `syncWalletToFirebase();` at the end of the function body, after the `fbSetDoc` call and before `return txn`

- [x] 3. Write fix-checking tests (verify bug condition is resolved)
  - [x] 3.1 In `tests/bug-condition.test.js`, update or re-run the tests from task 1 on the FIXED code and assert they now PASS
  - [x] 3.2 Add a test verifying that after `submitService()`, the Firestore `wallet` field equals `walletBalance_before - fee`
  - [x] 3.3 Add a test verifying that after `submitWithStatus()`, the Firestore `wallet` field equals `walletBalance_before - fee`

- [x] 4. Write preservation tests (verify unchanged behavior)
  - [x] 4.1 In `tests/preservation.test.js`, add a test verifying that the Paystack funding callback still calls `syncWalletToFirebase()` (Property 2)
  - [x] 4.2 Add a test verifying that the bio-data no-match refund path still calls `syncWalletToFirebase()` (Property 2)
  - [x] 4.3 Add a test verifying that insufficient-balance guards still reject submissions and do NOT call `syncWalletToFirebase()` (Property 2)
  - [x] 4.4 Add a test verifying that the NIN Verification slip flow still calls `syncWalletToFirebase()` (Property 2)
  - [x] 4.5 Add a property-based test that generates random valid service submissions and asserts `syncWalletToFirebase` is always called (Property 1)
  - [x] 4.6 Add a property-based test that generates random insufficient-balance scenarios and asserts `syncWalletToFirebase` is never called and `walletBalance` is unchanged (Property 2)

- [x] 5. Run the full test suite and verify all tests pass
  - [x] 5.1 Run `tests/bug-condition.test.js` and confirm all fix-checking tests pass
  - [x] 5.2 Run `tests/preservation.test.js` and confirm all preservation tests pass
  - [x] 5.3 Confirm no regressions in existing tests
