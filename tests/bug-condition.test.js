/**
 * Bug Condition Exploration Tests — Wallet Deduction on Service
 *
 * These tests MUST FAIL on unfixed code — failure confirms the bug exists.
 * They encode the expected (correct) behavior and will PASS once the fix is applied.
 *
 * Strategy: spy on window.fbUpdateDoc (called by syncWalletToFirebase) to detect
 * whether syncWalletToFirebase was invoked after a service submission.
 *
 * Validates: Requirements 1.1, 1.2, 1.3
 */

const fs = require('fs');
const path = require('path');

// ── Script extraction helper ──────────────────────────────────────────────────

/**
 * Extract the inline <script> block from user/dashboard.html (the last script
 * before </body> that is NOT a module and NOT an external src) and evaluate it
 * in the current jsdom window with all required globals pre-set.
 */
function loadDashboardScript() {
  const html = fs.readFileSync(
    path.resolve(__dirname, '../user/dashboard.html'),
    'utf8'
  );

  // Find the last non-module, non-src <script> block
  const scriptRegex = /<script(?![^>]*\btype\s*=\s*["']module["'])(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  let lastMatch = null;
  while ((match = scriptRegex.exec(html)) !== null) {
    lastMatch = match;
  }

  if (!lastMatch) {
    throw new Error('Could not find inline script block in user/dashboard.html');
  }

  const scriptContent = lastMatch[1];

  // Evaluate in the global (window) scope so all function declarations land on window
  // eslint-disable-next-line no-eval
  (0, eval)(scriptContent);
}

// ── Minimal DOM setup ─────────────────────────────────────────────────────────

/**
 * Set up the minimal DOM elements required by submitService(), buyAirtime(),
 * updateStats(), and renderHistory().
 */
function setupDashboardDOM() {
  document.body.innerHTML = `
    <!-- Required by submitService() -->
    <div id="modalAlert"></div>
    <div id="serviceModal" class="modal-overlay"></div>
    <div id="modalTitle"></div>
    <div id="modalDesc"></div>
    <div id="modalPrice"></div>
    <div id="modalFields"></div>
    <div id="modalBtn"></div>

    <!-- Required by updateStats() -->
    <span id="walletBal">0</span>
    <span id="statNin">0</span>
    <span id="statBvn">0</span>
    <span id="statAirtime">0</span>
    <span id="statJamb">0</span>
    <span id="statWallet">0</span>
    <span id="greetName"></span>
    <span id="userName"></span>
    <div id="userAvatar"></div>

    <!-- Required by renderHistory() -->
    <table><tbody id="historyTable"></tbody></table>
    <table><tbody id="walletTxnTable"></tbody></table>

    <!-- Required by buyAirtime() -->
    <select id="airtimeNetwork"><option value="MTN">MTN</option></select>
    <input id="airtimePhone" value="08012345678"/>
    <input id="airtimeAmount" value="500"/>
    <div id="airtimeAlert"></div>

    <!-- Required by toast() -->
    <div id="toast"></div>

    <!-- Required by showLoader/hideLoader -->
    <div id="pageLoader"></div>
  `;
}

// ── Firebase mock setup ───────────────────────────────────────────────────────

/**
 * Install Firebase global mocks on window.
 * window.fbReady = true so syncWalletToFirebase() actually calls fbUpdateDoc.
 */
function setupFirebaseMocks() {
  window.fbReady = true;
  window.fbDB = {};
  window.fbDoc = jest.fn().mockReturnValue({ path: 'mock/doc' });
  window.fbUpdateDoc = jest.fn().mockResolvedValue(undefined);
  window.fbSetDoc = jest.fn().mockResolvedValue(undefined);
  window.fbCollection = jest.fn().mockReturnValue({});
  window.fbGetDoc = jest.fn().mockResolvedValue({ exists: () => false, data: () => ({}) });
  window.fbOnSnapshot = jest.fn().mockReturnValue(() => {});
  window.fbQuery = jest.fn().mockReturnValue({});
  window.fbWhere = jest.fn().mockReturnValue({});
  window.fbOrderBy = jest.fn().mockReturnValue({});
  window.fbLimit = jest.fn().mockReturnValue({});
  window.fbIncrement = jest.fn(v => v);
}

// ── Test user ─────────────────────────────────────────────────────────────────

const TEST_USER = {
  id: 'user123',
  uid: 'user123',
  name: 'Test User',
  email: 'test@example.com',
  wallet: 5000,
  role: 'user'
};

// ── beforeEach / afterEach ────────────────────────────────────────────────────

beforeEach(() => {
  // Clear localStorage and set up test user
  localStorage.clear();
  localStorage.setItem('tugga_user', JSON.stringify(TEST_USER));
  localStorage.setItem('tugga_txns', JSON.stringify([]));

  // Set up DOM
  setupDashboardDOM();

  // Install Firebase mocks BEFORE loading the script
  setupFirebaseMocks();

  // Mock requireAuth to return the test user (called at script top-level)
  window.requireAuth = jest.fn().mockReturnValue(TEST_USER);

  // Mock app.js functions that the script depends on
  window.showSection = jest.fn();
  window.openModal = jest.fn();
  window.closeModal = jest.fn();
  window.logout = jest.fn();
  window.toggleSidebar = jest.fn();
  window.toast = jest.fn();
  window.fmt = jest.fn(v => '₦' + v);
  window.checkAvailable = jest.fn().mockReturnValue(true);
  window.showLoader = jest.fn();
  window.hideLoader = jest.fn();
  window.addTransaction = jest.fn();
  window.isValidNIN = jest.fn().mockReturnValue(true);
  // getUserTransactions is defined in app.js — mock it to return empty array
  window.getUserTransactions = jest.fn().mockReturnValue([]);
  // transactions is a global declared in app.js — expose it on window
  window.transactions = [];

  // Load the dashboard script (evaluates in window scope)
  loadDashboardScript();
});

afterEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
});

// ── Test 1.1: submitService() BVN path calls syncWalletToFirebase ─────────────

/**
 * Bug Condition Test 1.1 — submitService() BVN path
 *
 * Calling submitService() with a BVN service and sufficient balance MUST call
 * syncWalletToFirebase() (detected via window.fbUpdateDoc being called with
 * { wallet: <number> }).
 *
 * FAILS on unfixed code (syncWalletToFirebase not called in submitService).
 * PASSES after fix.
 *
 * Validates: Requirements 1.1, 2.1
 */
test('1.1 — submitService() BVN: syncWalletToFirebase is called after deduction', () => {
  // Use fake timers so openServiceModal's setTimeout resolves synchronously
  jest.useFakeTimers();

  // Set up currentService via openServiceModal (the proper way)
  window.openServiceModal('BVN Verification', 'Verify BVN', 'bvn', 200);
  jest.runAllTimers();

  jest.useRealTimers();

  // Call submitService
  window.submitService();

  // syncWalletToFirebase calls fbUpdateDoc with { wallet: <number> }
  expect(window.fbUpdateDoc).toHaveBeenCalledWith(
    expect.anything(),
    { wallet: expect.any(Number) }
  );
});

// ── Test 1.2: submitService() NIN Validation path calls syncWalletToFirebase ──

/**
 * Bug Condition Test 1.2 — submitService() NIN Validation path
 *
 * Calling submitService() with a NIN Validation service MUST call
 * syncWalletToFirebase().
 *
 * FAILS on unfixed code.
 * PASSES after fix.
 *
 * Validates: Requirements 1.1, 2.1
 */
test('1.2 — submitService() NIN Validation: syncWalletToFirebase is called after deduction', () => {
  // Use fake timers so openServiceModal's setTimeout resolves synchronously
  jest.useFakeTimers();

  // Set up currentService via openServiceModal
  window.openServiceModal('NIN Validation', 'Validate NIN', 'nin', 300);
  jest.runAllTimers();

  jest.useRealTimers();

  window.submitService();

  expect(window.fbUpdateDoc).toHaveBeenCalledWith(
    expect.anything(),
    { wallet: expect.any(Number) }
  );
});

// ── Test 1.3: submitWithStatus() direct call triggers syncWalletToFirebase ────

/**
 * Bug Condition Test 1.3 — submitWithStatus() direct call
 *
 * Calling submitWithStatus() directly MUST call syncWalletToFirebase()
 * (detected via window.fbUpdateDoc being called with { wallet: <number> }).
 *
 * FAILS on unfixed code (syncWalletToFirebase not called in submitWithStatus).
 * PASSES after fix.
 *
 * Validates: Requirements 1.2, 2.2
 */
test('1.3 — submitWithStatus() direct call: syncWalletToFirebase is called', () => {
  window.submitWithStatus(
    'NIN Personalization',
    'Test details',
    500,
    'submitted',
    { 'NIN Number': '12345678901' }
  );

  expect(window.fbUpdateDoc).toHaveBeenCalledWith(
    expect.anything(),
    { wallet: expect.any(Number) }
  );
});

// ── Test 1.4: buyAirtime() path triggers syncWalletToFirebase ─────────────────

/**
 * Bug Condition Test 1.4 — buyAirtime() path
 *
 * buyAirtime() deducts walletBalance and calls submitWithStatus().
 * After the fix, submitWithStatus() calls syncWalletToFirebase().
 *
 * FAILS on unfixed code.
 * PASSES after fix.
 *
 * Validates: Requirements 1.2, 2.2
 */
test('1.4 — buyAirtime() with sufficient balance: syncWalletToFirebase is called', () => {
  // DOM elements are already set up in setupDashboardDOM()
  // airtimeNetwork=MTN, airtimePhone=08012345678, airtimeAmount=500

  window.buyAirtime();

  expect(window.fbUpdateDoc).toHaveBeenCalledWith(
    expect.anything(),
    { wallet: expect.any(Number) }
  );
});

// ── Test 3.2: submitService() persists correct wallet value ───────────────────

/**
 * Fix-Checking Test 3.2 — submitService() persists correct wallet value
 *
 * After submitService() with fee=200 and starting balance=5000,
 * fbUpdateDoc must be called with { wallet: 4800 }.
 *
 * FAILS on unfixed code (fbUpdateDoc not called at all).
 * PASSES after fix.
 *
 * Validates: Requirements 2.1
 */
test('3.2 — submitService() persists wallet = walletBalance_before - fee', () => {
  // Use fake timers so openServiceModal's setTimeout resolves synchronously
  jest.useFakeTimers();

  // Open the service modal to set currentService in the script's closure
  // Starting balance is 5000 (from TEST_USER.wallet), fee is 200
  window.openServiceModal('BVN Verification', 'Verify BVN', 'bvn', 200);
  jest.runAllTimers();

  // Now call submitService — currentService is set to { price: 200 }
  window.submitService();

  jest.useRealTimers();

  // fbUpdateDoc should have been called with the deducted balance: 5000 - 200 = 4800
  expect(window.fbUpdateDoc).toHaveBeenCalledWith(
    expect.anything(),
    { wallet: 4800 }
  );
});

// ── Test 3.3: submitWithStatus() persists correct wallet value ────────────────

/**
 * Fix-Checking Test 3.3 — submitWithStatus() persists correct wallet value
 *
 * After submitWithStatus() with fee=500 and starting balance=5000,
 * fbUpdateDoc must be called with { wallet: 4500 }.
 *
 * Note: submitWithStatus() itself does NOT deduct walletBalance — the caller
 * does. So we manually deduct before calling, as callers do.
 *
 * FAILS on unfixed code (fbUpdateDoc not called at all).
 * PASSES after fix.
 *
 * Validates: Requirements 2.2
 */
test('3.3 — submitWithStatus() persists wallet = walletBalance_before - fee', () => {
  // Simulate what a caller does: deduct walletBalance before calling submitWithStatus
  // walletBalance is a local var in the script; we simulate via buyAirtime which
  // deducts 500 (airtimeAmount=500) then calls submitWithStatus
  // Starting balance = 5000, after deduction = 4500

  window.buyAirtime(); // deducts 500, calls submitWithStatus

  expect(window.fbUpdateDoc).toHaveBeenCalledWith(
    expect.anything(),
    { wallet: 4500 }
  );
});
