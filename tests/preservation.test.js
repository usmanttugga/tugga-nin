/**
 * Preservation Property Tests
 *
 * These tests verify that existing behaviors are UNCHANGED by the fix.
 * They MUST PASS on unfixed code (they document the baseline to preserve).
 *
 * Exceptions (fix-validation tests — will fail on unfixed code, pass after fix):
 *   - openAdminProfile population test: on unfixed code, openAdminProfile is
 *     undefined, so the modal does not open. This test checks post-fix behavior.
 *   - toggleSidebar parity test: toggleSidebar is not defined on unfixed code,
 *     so this test will fail on unfixed code. It validates the fix.
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5
 */

const fs = require('fs');
const path = require('path');

// ── Helpers ───────────────────────────────────────────────────────────────────

function loadAppJs() {
  const src = fs.readFileSync(path.resolve(__dirname, '../js/app.js'), 'utf8');
  const stripped = src.replace(/^\s*import\s+.*?;?\s*$/gm, '');
  // Use the global object's eval so function declarations land on window/global
  // eslint-disable-next-line no-eval
  global.eval(stripped);
}

/**
 * Set up a minimal DOM that mirrors the user dashboard structure:
 * sidebar with data-section links, content sections, profile modal, nav-links.
 */
function setupUserDOM(sectionIds) {
  const sections = sectionIds.map((id, i) =>
    `<section id="${id}" class="content-section${i === 0 ? '' : ' section-hidden'}"></section>`
  ).join('\n');

  const sidebarLinks = sectionIds.map((id, i) =>
    `<a href="#" data-section="${id}" class="${i === 0 ? 'active' : ''}" onclick="showSection('${id}')">${id}</a>`
  ).join('\n');

  document.body.innerHTML = `
    <nav>
      <button class="hamburger" onclick="toggleSidebar()"></button>
      <div class="nav-links">
        <a href="#" class="active">Dashboard</a>
        <a href="#" onclick="showSection('sec-history')">History</a>
        <a href="#" onclick="showSection('sec-wallet')">Wallet</a>
        <a href="#" onclick="logout()" class="nav-logout-link">Logout</a>
      </div>
      <div class="nav-user">
        <div class="avatar" id="userAvatar" onclick="openModal('profileModal')" style="cursor:pointer">U</div>
        <span id="userName">User</span>
        <button class="btn-logout" onclick="logout()">Logout</button>
      </div>
    </nav>
    <div class="sidebar-overlay" id="sidebarOverlay"></div>
    <div class="dashboard">
      <aside class="sidebar">
        ${sidebarLinks}
      </aside>
      <main class="main">
        ${sections}
      </main>
    </div>
    <div class="modal-overlay" id="profileModal">
      <div class="modal">
        <div id="profileAvatar">U</div>
        <h3 id="profileName"></h3>
        <span id="profileRole"></span>
        <span id="profileEmail"></span>
        <span id="profilePhone"></span>
        <span id="profileNin"></span>
        <span id="profileWallet"></span>
        <span id="profileTxns"></span>
        <span id="profileSince"></span>
      </div>
    </div>
  `;
}

/**
 * Set up a minimal admin DOM with sidebar, content sections, and adminProfileModal.
 */
function setupAdminDOM(sectionIds) {
  const sections = sectionIds.map((id, i) =>
    `<section id="${id}" class="content-section${i === 0 ? '' : ' section-hidden'}"></section>`
  ).join('\n');

  const sidebarLinks = sectionIds.map((id, i) =>
    `<a href="#" data-section="${id}" class="${i === 0 ? 'active' : ''}" onclick="showSection('${id}')">${id}</a>`
  ).join('\n');

  document.body.innerHTML = `
    <nav>
      <button class="hamburger" onclick="toggleSidebar()"></button>
      <div class="nav-links">
        <a href="#" class="active">Admin Panel</a>
      </div>
      <div class="nav-user">
        <div class="avatar" id="adminAvatar" onclick="openAdminProfile()">A</div>
        <span id="adminName">Admin</span>
        <button class="btn-logout" onclick="logout()">Logout</button>
      </div>
    </nav>
    <div class="sidebar-overlay" id="sidebarOverlay"></div>
    <div class="dashboard">
      <aside class="sidebar">
        ${sidebarLinks}
      </aside>
      <main class="main">
        ${sections}
      </main>
    </div>
    <div class="modal-overlay" id="adminProfileModal">
      <div class="modal">
        <span id="apName"></span>
        <span id="apEmail"></span>
        <span id="apRole"></span>
        <button onclick="closeModal('adminProfileModal')">✕</button>
      </div>
    </div>
  `;
}

// ── Section IDs used across tests ─────────────────────────────────────────────

const ADMIN_SECTIONS = [
  'sec-overview', 'sec-users', 'sec-transactions',
  'sec-nin-admin', 'sec-bvn-admin', 'sec-utility-admin',
  'sec-pricing', 'sec-availability', 'sec-settings'
];

const USER_SECTIONS = [
  'sec-home', 'sec-wallet', 'sec-history',
  'sec-nin', 'sec-nin-verify', 'sec-nin-validation',
  'sec-nin-modification', 'sec-ipe', 'sec-bvn',
  'sec-airtime', 'sec-data'
];

// ── Property 2a: showSection — exactly one visible section ────────────────────

/**
 * Property 2a — Preservation: showSection(id) always results in exactly one
 * .content-section without section-hidden, and the correct sidebar link is
 * marked active.
 *
 * This MUST PASS on unfixed code (showSection is already defined in app.js).
 *
 * Validates: Requirements 3.2
 */
describe('Property 2a — showSection preservation', () => {
  beforeEach(() => {
    setupAdminDOM(ADMIN_SECTIONS);
    loadAppJs();
  });

  afterEach(() => {
    localStorage.clear();
  });

  // Property: for any valid section id, exactly one section is visible
  test.each(ADMIN_SECTIONS)(
    'showSection("%s") leaves exactly one .content-section visible',
    (sectionId) => {
      window.showSection(sectionId);

      const allSections = document.querySelectorAll('.content-section');
      const visibleSections = Array.from(allSections).filter(
        s => !s.classList.contains('section-hidden')
      );

      // Exactly one section must be visible
      expect(visibleSections.length).toBe(1);
      // That section must be the one we requested
      expect(visibleSections[0].id).toBe(sectionId);
    }
  );

  // Property: for any valid section id, the correct sidebar link is marked active
  test.each(ADMIN_SECTIONS)(
    'showSection("%s") marks exactly one sidebar link active',
    (sectionId) => {
      window.showSection(sectionId);

      const activeLinks = document.querySelectorAll('.sidebar a.active');
      expect(activeLinks.length).toBe(1);
      expect(activeLinks[0].dataset.section).toBe(sectionId);
    }
  );

  // Property: calling showSection multiple times in sequence always leaves
  // exactly one section visible (no accumulation of visible sections)
  test('showSection called in sequence always leaves exactly one section visible', () => {
    const sequence = ['sec-users', 'sec-transactions', 'sec-overview', 'sec-settings'];
    for (const id of sequence) {
      window.showSection(id);
      const visible = Array.from(document.querySelectorAll('.content-section'))
        .filter(s => !s.classList.contains('section-hidden'));
      expect(visible.length).toBe(1);
      expect(visible[0].id).toBe(id);
    }
  });
});

// ── Property 2b: logout — removes tugga_user from localStorage ───────────────

/**
 * Property 2b — Preservation: logout() removes tugga_user from localStorage.
 *
 * This MUST PASS on unfixed code (logout is already defined in app.js).
 *
 * Validates: Requirements 3.3
 */
describe('Property 2b — logout preservation', () => {
  let originalLocation;

  beforeEach(() => {
    setupAdminDOM(ADMIN_SECTIONS);
    loadAppJs();
    // Stub window.location.href to prevent jsdom navigation errors
    originalLocation = window.location;
    delete window.location;
    window.location = { href: '', pathname: '/admin/dashboard.html' };
  });

  afterEach(() => {
    window.location = originalLocation;
    localStorage.clear();
  });

  test('logout() removes tugga_user from localStorage', () => {
    localStorage.setItem('tugga_user', JSON.stringify({
      id: 2, name: 'Admin User', email: 'admin@tugga.com', role: 'admin'
    }));

    window.logout();

    expect(localStorage.getItem('tugga_user')).toBeNull();
  });

  test('logout() redirects to ../index.html when on /admin/ path', () => {
    window.location.pathname = '/admin/dashboard.html';
    localStorage.setItem('tugga_user', JSON.stringify({ id: 2, role: 'admin' }));

    window.logout();

    expect(window.location.href).toBe('../index.html');
  });

  test('logout() removes tugga_user regardless of what user data was stored', () => {
    // Property: for any user object stored, logout always clears it
    const users = [
      { id: 1, name: 'John', role: 'user' },
      { id: 2, name: 'Admin', role: 'admin' },
      { id: 99, name: 'Test', role: 'user', wallet: 9999 }
    ];

    for (const user of users) {
      localStorage.setItem('tugga_user', JSON.stringify(user));
      window.logout();
      expect(localStorage.getItem('tugga_user')).toBeNull();
      // Re-stub location for next iteration
      window.location = { href: '', pathname: '/admin/dashboard.html' };
    }
  });
});

// ── Property 2c: user profile avatar opens #profileModal ─────────────────────

/**
 * Property 2c — Preservation: clicking #userAvatar calls openModal('profileModal')
 * and #profileModal gains class "open".
 *
 * This MUST PASS on unfixed code (openModal is already defined in app.js).
 *
 * Validates: Requirements 3.4
 */
describe('Property 2c — user profile modal preservation', () => {
  beforeEach(() => {
    setupUserDOM(USER_SECTIONS);
    loadAppJs();
  });

  afterEach(() => {
    localStorage.clear();
  });

  test('clicking #userAvatar opens #profileModal (adds class "open")', () => {
    const avatar = document.getElementById('userAvatar');
    expect(avatar).not.toBeNull();

    // Simulate click — the onclick calls openModal('profileModal')
    avatar.click();

    expect(document.getElementById('profileModal').classList.contains('open')).toBe(true);
  });

  test('openModal("profileModal") adds class "open" to #profileModal', () => {
    window.openModal('profileModal');
    expect(document.getElementById('profileModal').classList.contains('open')).toBe(true);
  });

  test('closeModal("profileModal") removes class "open" from #profileModal', () => {
    window.openModal('profileModal');
    window.closeModal('profileModal');
    expect(document.getElementById('profileModal').classList.contains('open')).toBe(false);
  });
});

// ── Property 2d: desktop nav-links visibility ─────────────────────────────────

/**
 * Property 2d — Preservation: at viewport > 768px, .nav-links is visible.
 *
 * CSS applies display:none to nav .nav-links only at max-width:768px.
 * In jsdom there is no real CSS rendering, so we verify the DOM structure:
 * .nav-links exists and contains the expected navigation links.
 *
 * This MUST PASS on unfixed code (the DOM structure is already correct).
 *
 * Validates: Requirements 3.1
 */
describe('Property 2d — desktop nav-links visibility', () => {
  test('admin dashboard .nav-links contains navigation links (not just logout)', () => {
    const html = fs.readFileSync(
      path.resolve(__dirname, '../admin/dashboard.html'),
      'utf8'
    );
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const navLinks = doc.querySelector('nav .nav-links');
    expect(navLinks).not.toBeNull();

    // .nav-links must contain at least one non-logout navigation anchor
    const allAnchors = navLinks.querySelectorAll('a');
    const navAnchors = Array.from(allAnchors).filter(
      a => !a.classList.contains('nav-logout-link')
    );
    expect(navAnchors.length).toBeGreaterThanOrEqual(1);
  });

  test('user dashboard .nav-links contains navigation links', () => {
    const html = fs.readFileSync(
      path.resolve(__dirname, '../user/dashboard.html'),
      'utf8'
    );
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const navLinks = doc.querySelector('nav .nav-links');
    expect(navLinks).not.toBeNull();

    const allAnchors = navLinks.querySelectorAll('a');
    // User nav-links has: Dashboard, History, Wallet, Logout — at least 3 non-logout links
    const navAnchors = Array.from(allAnchors).filter(
      a => !a.classList.contains('nav-logout-link')
    );
    expect(navAnchors.length).toBeGreaterThanOrEqual(3);
  });

  // Property: for any viewport width > 768px, .nav-links is not hidden by inline style
  // (CSS media query is not evaluated in jsdom, but we verify no inline display:none)
  test('.nav-links has no inline display:none that would hide it at desktop widths', () => {
    setupUserDOM(USER_SECTIONS);
    loadAppJs();

    const navLinks = document.querySelector('.nav-links');
    expect(navLinks).not.toBeNull();
    // No inline style should hide it (CSS media query handles mobile-only hiding)
    expect(navLinks.style.display).not.toBe('none');
  });
});

// ── Property 2e: openAdminProfile populates #adminProfileModal ────────────────

/**
 * Property 2e — Fix-validation test (will FAIL on unfixed code, PASS after fix).
 *
 * For any admin name/email/role object, openAdminProfile() always displays
 * those values in #adminProfileModal.
 *
 * On UNFIXED code: openAdminProfile is undefined → this test fails.
 * After fix: openAdminProfile populates and opens the modal → test passes.
 *
 * NOTE: This is intentionally a fix-validation test. It is expected to fail
 * on unfixed code. The baseline observation on unfixed code is "modal does not open".
 *
 * Validates: Requirements 2.2 (post-fix)
 */
describe('Property 2e — openAdminProfile population (fix-validation)', () => {
  const adminProfiles = [
    { id: 2, name: 'Admin User', email: 'admin@tugga.com', role: 'admin' },
    { id: 3, name: 'Super Admin', email: 'super@tugga.com', role: 'admin' },
    { id: 4, name: 'Test Admin', email: 'test@tugga.com', role: 'admin' }
  ];

  beforeEach(() => {
    setupAdminDOM(ADMIN_SECTIONS);
    loadAppJs();
  });

  afterEach(() => {
    localStorage.clear();
  });

  // Property: for any admin object, openAdminProfile always opens the modal
  test.each(adminProfiles)(
    'openAdminProfile() opens #adminProfileModal for admin "$name"',
    (admin) => {
      localStorage.setItem('tugga_user', JSON.stringify(admin));

      // On unfixed code: openAdminProfile is undefined → this throws/fails
      expect(typeof window.openAdminProfile).toBe('function');
      window.openAdminProfile();

      expect(document.getElementById('adminProfileModal').classList.contains('open')).toBe(true);
    }
  );

  // Property: for any admin object, openAdminProfile always displays the correct name
  test.each(adminProfiles)(
    'openAdminProfile() displays correct name "$name" in #apName',
    (admin) => {
      localStorage.setItem('tugga_user', JSON.stringify(admin));

      expect(typeof window.openAdminProfile).toBe('function');
      window.openAdminProfile();

      expect(document.getElementById('apName').textContent).toBe(admin.name);
    }
  );

  // Property: for any admin object, openAdminProfile always displays the correct role
  test.each(adminProfiles)(
    'openAdminProfile() displays correct role "$role" in #apRole',
    (admin) => {
      localStorage.setItem('tugga_user', JSON.stringify(admin));

      expect(typeof window.openAdminProfile).toBe('function');
      window.openAdminProfile();

      expect(document.getElementById('apRole').textContent).toBe(admin.role);
    }
  );
});

// ── Property 2f: toggleSidebar parity (fix-validation) ───────────────────────

/**
 * Property 2f — Fix-validation test (will FAIL on unfixed code, PASS after fix).
 *
 * For any even number of toggleSidebar() calls, .sidebar does NOT have class "open".
 * For any odd number of toggleSidebar() calls, .sidebar DOES have class "open".
 *
 * On UNFIXED code: toggleSidebar is not defined → this test fails.
 * After fix: toggleSidebar toggles .open correctly → test passes.
 *
 * NOTE: This is intentionally a fix-validation test. It is expected to fail
 * on unfixed code. Write it here so it can be re-run after the fix (task 3.6).
 *
 * Validates: Requirements 2.1, 2.4, 2.5 (post-fix)
 */
describe('Property 2f — toggleSidebar parity (fix-validation)', () => {
  beforeEach(() => {
    setupAdminDOM(ADMIN_SECTIONS);
    loadAppJs();
  });

  afterEach(() => {
    localStorage.clear();
  });

  // Property: after any odd number of calls, sidebar is open
  test.each([1, 3, 5, 7])(
    'after %i toggleSidebar() call(s), .sidebar HAS class "open"',
    (count) => {
      expect(typeof window.toggleSidebar).toBe('function');
      for (let i = 0; i < count; i++) {
        window.toggleSidebar();
      }
      expect(document.querySelector('.sidebar').classList.contains('open')).toBe(true);
    }
  );

  // Property: after any even number of calls, sidebar is closed
  test.each([2, 4, 6, 8])(
    'after %i toggleSidebar() call(s), .sidebar does NOT have class "open"',
    (count) => {
      expect(typeof window.toggleSidebar).toBe('function');
      for (let i = 0; i < count; i++) {
        window.toggleSidebar();
      }
      expect(document.querySelector('.sidebar').classList.contains('open')).toBe(false);
    }
  );

  // Property: sidebarOverlay mirrors sidebar state
  test('sidebarOverlay always mirrors .sidebar open state', () => {
    expect(typeof window.toggleSidebar).toBe('function');
    for (let i = 1; i <= 6; i++) {
      window.toggleSidebar();
      const sidebarOpen = document.querySelector('.sidebar').classList.contains('open');
      const overlayOpen = document.getElementById('sidebarOverlay').classList.contains('open');
      expect(overlayOpen).toBe(sidebarOpen);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Wallet Deduction Preservation Tests
//
// These tests verify that existing wallet-sync behaviors are UNCHANGED by the fix.
// They MUST PASS on both unfixed and fixed code (they document the baseline).
//
// Validates: Requirements 3.1, 3.2, 3.3, 3.4
// ═══════════════════════════════════════════════════════════════════════════════

const DASHBOARD_HTML_PATH = path.resolve(__dirname, '../user/dashboard.html');

/**
 * Extract and evaluate the inline script from user/dashboard.html in the
 * current jsdom window with all required globals pre-set.
 */
function loadDashboardScript() {
  const html = fs.readFileSync(DASHBOARD_HTML_PATH, 'utf8');

  // Find the last non-module, non-src <script> block
  const scriptRegex = /<script(?![^>]*\btype\s*=\s*["']module["'])(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  let lastMatch = null;
  while ((match = scriptRegex.exec(html)) !== null) {
    lastMatch = match;
  }
  if (!lastMatch) throw new Error('Could not find inline script in user/dashboard.html');

  // eslint-disable-next-line no-eval
  (0, eval)(lastMatch[1]);
}

/**
 * Set up the minimal DOM required by the dashboard script and wallet functions.
 */
function setupWalletDOM() {
  document.body.innerHTML = `
    <!-- updateStats / renderHistory -->
    <span id="walletBal">0</span>
    <span id="statNin">0</span>
    <span id="statBvn">0</span>
    <span id="statAirtime">0</span>
    <span id="statJamb">0</span>
    <span id="statWallet">0</span>
    <span id="greetName"></span>
    <span id="userName"></span>
    <div id="userAvatar"></div>
    <table><tbody id="historyTable"></tbody></table>
    <table><tbody id="walletTxnTable"></tbody></table>

    <!-- submitService / serviceModal -->
    <div id="modalAlert"></div>
    <div id="serviceModal" class="modal-overlay"></div>
    <div id="modalTitle"></div>
    <div id="modalDesc"></div>
    <div id="modalPrice"></div>
    <div id="modalFields"></div>
    <div id="modalBtn"></div>

    <!-- buyAirtime -->
    <select id="airtimeNetwork"><option value="MTN">MTN</option></select>
    <input id="airtimePhone" value="08012345678"/>
    <input id="airtimeAmount" value="500"/>
    <div id="airtimeAlert"></div>

    <!-- payWithPaystack -->
    <input id="fundAmount" value="1000"/>
    <div id="fundAlert"></div>
    <div id="fundModal" class="modal-overlay"></div>

    <!-- submitNinVerify / openNinVerifyModal -->
    <div id="ninVerifyAlert"></div>
    <div id="ninVerifyResult" style="display:none"></div>
    <div id="ninVerifyFields"></div>
    <div id="ninVerifyTitle"></div>
    <div id="ninVerifyDesc"></div>
    <div id="ninVerifyPrice"></div>
    <div id="ninVerifySlipBadge"></div>
    <div id="ninVerifyStep1" style="display:block"></div>
    <div id="ninVerifyStep2" style="display:none"></div>
    <div id="ninVerifyBtn"></div>
    <div id="slipChoiceErr"></div>
    <input id="nv_nin" value="12345678901"/>
    <span id="nv_nin_err"></span>
    <input id="nv_fname" value="John"/>
    <input id="nv_lname" value="Doe"/>
    <input id="nv_dob" value="1990-01-01"/>
    <select id="nv_gender"><option value="M" selected>Male</option></select>
    <span id="nv_fname_err"></span>
    <span id="nv_lname_err"></span>
    <span id="nv_dob_err"></span>
    <span id="nv_gender_err"></span>

    <!-- showLoader / hideLoader -->
    <div id="pageLoader"></div>

    <!-- toast -->
    <div id="toast"></div>
  `;
}

/**
 * Install Firebase global mocks on window.
 * window.fbReady = true so syncWalletToFirebase() actually calls fbUpdateDoc.
 */
function setupWalletFirebaseMocks() {
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

const WALLET_TEST_USER = {
  id: 'user123',
  uid: 'user123',
  name: 'Test User',
  email: 'test@example.com',
  wallet: 5000,
  role: 'user'
};

// ── Shared beforeEach / afterEach for wallet preservation tests ───────────────

function walletBeforeEach() {
  localStorage.clear();
  localStorage.setItem('tugga_user', JSON.stringify(WALLET_TEST_USER));
  localStorage.setItem('tugga_txns', JSON.stringify([]));

  setupWalletDOM();
  setupWalletFirebaseMocks();

  window.requireAuth = jest.fn().mockReturnValue(WALLET_TEST_USER);
  window.showSection = jest.fn();
  window.openModal = jest.fn();
  window.closeModal = jest.fn();
  window.logout = jest.fn();
  window.toggleSidebar = jest.fn();
  window.toast = jest.fn();
  window.fmt = jest.fn(v => '₦' + v);
  window.checkAvailable = jest.fn().mockReturnValue(true);
  window.addTransaction = jest.fn();
  window.isValidNIN = jest.fn().mockReturnValue(true);
  window.getUserTransactions = jest.fn().mockReturnValue([]);
  window.transactions = [];

  loadDashboardScript();
}

// ── Property 3a: Paystack funding still calls syncWalletToFirebase ────────────

/**
 * Property 3a — Preservation: Paystack funding callback still calls
 * syncWalletToFirebase() (detected via fbUpdateDoc being called with
 * { wallet: <number> }).
 *
 * This MUST PASS on both unfixed and fixed code.
 *
 * Validates: Requirements 3.1
 */
describe('Property 3a — Paystack funding preservation', () => {
  beforeEach(walletBeforeEach);
  afterEach(() => { localStorage.clear(); jest.clearAllMocks(); });

  test('4.1 — Paystack funding callback calls syncWalletToFirebase', () => {
    // Mock PaystackPop.setup to capture the callback and invoke it immediately
    let capturedCallback = null;
    window.PaystackPop = {
      setup: jest.fn(config => {
        capturedCallback = config.callback;
        return { openIframe: jest.fn() };
      })
    };

    // Trigger payWithPaystack
    window.payWithPaystack();

    // Invoke the Paystack success callback
    expect(capturedCallback).not.toBeNull();
    capturedCallback({ reference: 'REF123' });

    // syncWalletToFirebase should have been called (via fbUpdateDoc)
    expect(window.fbUpdateDoc).toHaveBeenCalledWith(
      expect.anything(),
      { wallet: expect.any(Number) }
    );
  });

  test('4.1b — Paystack funding credits walletBalance before syncing', () => {
    let capturedCallback = null;
    window.PaystackPop = {
      setup: jest.fn(config => {
        capturedCallback = config.callback;
        return { openIframe: jest.fn() };
      })
    };

    window.payWithPaystack(); // fundAmount = 1000
    capturedCallback({ reference: 'REF456' });

    // Starting balance 5000 + 1000 = 6000
    expect(window.fbUpdateDoc).toHaveBeenCalledWith(
      expect.anything(),
      { wallet: 6000 }
    );
  });
});

// ── Property 3b: Bio-data no-match refund still calls syncWalletToFirebase ────

/**
 * Property 3b — Preservation: bio-data no-match refund path still calls
 * syncWalletToFirebase() twice (once for deduction, once for refund).
 *
 * This MUST PASS on both unfixed and fixed code.
 *
 * Validates: Requirements 3.2
 */
describe('Property 3b — Bio-data refund preservation', () => {
  beforeEach(walletBeforeEach);
  afterEach(() => { localStorage.clear(); jest.clearAllMocks(); });

  test('4.2 — bio-data no-match refund calls syncWalletToFirebase twice', () => {
    // Use fake timers so openNinVerifyModal's setTimeout resolves synchronously
    jest.useFakeTimers();

    // Open the NIN verify modal for bio-data to set currentNinService in the script's closure
    window.openNinVerifyModal('bio-data');
    jest.runAllTimers();

    // Set _selectedSlip via chooseSlip (or directly via the script's closure)
    // chooseSlip also calls proceedToVerifyForm which needs more DOM — use fake timers
    // Instead, call proceedToVerifyForm after setting slip via chooseSlip
    // The simplest approach: call chooseSlip on a mock element
    const mockSlipEl = document.createElement('div');
    document.body.appendChild(mockSlipEl);
    window.chooseSlip(mockSlipEl, 'Normal Slip');
    jest.runAllTimers();

    jest.useRealTimers();

    // Mock ninMockLookup to return no-match result
    window.ninMockLookup = jest.fn().mockReturnValue({ match: false });

    window.submitNinVerify();

    // fbUpdateDoc should have been called twice:
    // 1. After deduction (walletBalance -= slipFee)
    // 2. After refund (walletBalance += slipFee)
    expect(window.fbUpdateDoc).toHaveBeenCalledTimes(2);
  });

  test('4.2b — bio-data no-match refund restores walletBalance to original', () => {
    jest.useFakeTimers();
    window.openNinVerifyModal('bio-data');
    jest.runAllTimers();

    const mockSlipEl = document.createElement('div');
    document.body.appendChild(mockSlipEl);
    window.chooseSlip(mockSlipEl, 'Normal Slip');
    jest.runAllTimers();

    jest.useRealTimers();

    window.ninMockLookup = jest.fn().mockReturnValue({ match: false });

    window.submitNinVerify();

    // The second call to fbUpdateDoc should restore the original balance (5000)
    const calls = window.fbUpdateDoc.mock.calls;
    expect(calls.length).toBe(2);
    // Second call restores balance: deduct then refund = net 0 change
    expect(calls[1][1]).toEqual({ wallet: 5000 });
  });
});

// ── Property 3c: Insufficient balance guard still rejects ─────────────────────

/**
 * Property 3c — Preservation: insufficient-balance guards still reject
 * submissions and do NOT call syncWalletToFirebase().
 *
 * This MUST PASS on both unfixed and fixed code.
 *
 * Validates: Requirements 3.4
 */
describe('Property 3c — Insufficient balance guard preservation', () => {
  beforeEach(walletBeforeEach);
  afterEach(() => { localStorage.clear(); jest.clearAllMocks(); });

  test('4.3 — submitService() with insufficient balance does NOT call syncWalletToFirebase', () => {
    jest.useFakeTimers();
    // Set price higher than walletBalance (5000)
    window.openServiceModal('BVN Verification', 'Verify BVN', 'bvn', 9999);
    jest.runAllTimers();
    jest.useRealTimers();

    window.submitService();

    // fbUpdateDoc must NOT have been called
    expect(window.fbUpdateDoc).not.toHaveBeenCalled();
  });

  test('4.3b — submitService() with insufficient balance leaves walletBalance unchanged', () => {
    jest.useFakeTimers();
    window.openServiceModal('BVN Verification', 'Verify BVN', 'bvn', 9999);
    jest.runAllTimers();
    jest.useRealTimers();

    window.submitService();

    // walletBalance should still be 5000 — check via updateStats DOM
    window.updateStats();
    expect(document.getElementById('statWallet').textContent).toBe('₦5000');
  });

  test('4.3c — buyAirtime() with insufficient balance does NOT call syncWalletToFirebase', () => {
    // Set airtimeAmount higher than walletBalance
    document.getElementById('airtimeAmount').value = '99999';

    window.buyAirtime();

    expect(window.fbUpdateDoc).not.toHaveBeenCalled();
  });
});

// ── Property 3d: NIN Verification slip flow still calls syncWalletToFirebase ──

/**
 * Property 3d — Preservation: NIN Verification slip flow (submitNinVerify)
 * still calls syncWalletToFirebase() after deducting the slip fee.
 *
 * This MUST PASS on both unfixed and fixed code.
 *
 * Validates: Requirements 3.3
 */
describe('Property 3d — NIN Verification slip flow preservation', () => {
  beforeEach(walletBeforeEach);
  afterEach(() => { localStorage.clear(); jest.clearAllMocks(); });

  test('4.4 — submitNinVerify() verify-nin path calls syncWalletToFirebase', () => {
    jest.useFakeTimers();

    // Open the NIN verify modal for verify-nin to set currentNinService
    window.openNinVerifyModal('verify-nin');
    jest.runAllTimers();

    // Set _selectedSlip via chooseSlip
    const mockSlipEl = document.createElement('div');
    document.body.appendChild(mockSlipEl);
    window.chooseSlip(mockSlipEl, 'Normal Slip');
    jest.runAllTimers();

    jest.useRealTimers();

    // Mock ninMockLookup to return a successful result
    window.ninMockLookup = jest.fn().mockReturnValue({
      match: true,
      nin: '12345678901',
      name: 'John Doe',
      dob: '1990-01-01',
      gender: 'Male',
      photo: '👤'
    });

    window.submitNinVerify();

    // syncWalletToFirebase should have been called (via fbUpdateDoc)
    expect(window.fbUpdateDoc).toHaveBeenCalledWith(
      expect.anything(),
      { wallet: expect.any(Number) }
    );
  });

  test('4.4b — submitNinVerify() deducts correct fee from walletBalance', () => {
    jest.useFakeTimers();

    window.openNinVerifyModal('verify-nin');
    jest.runAllTimers();

    const mockSlipEl = document.createElement('div');
    document.body.appendChild(mockSlipEl);
    window.chooseSlip(mockSlipEl, 'Normal Slip'); // fee = 200 (nin_normal default)
    jest.runAllTimers();

    jest.useRealTimers();

    window.ninMockLookup = jest.fn().mockReturnValue({
      match: true,
      nin: '12345678901',
      name: 'John Doe',
      dob: '1990-01-01',
      gender: 'Male',
      photo: '👤'
    });

    window.submitNinVerify();

    // Starting balance 5000 - 200 = 4800
    expect(window.fbUpdateDoc).toHaveBeenCalledWith(
      expect.anything(),
      { wallet: 4800 }
    );
  });
});

// ── Property 3e: PBT — random valid fees always trigger fbUpdateDoc ───────────

/**
 * Property 3e — Property-Based: for any random valid service fee (1 ≤ fee ≤ walletBalance),
 * submitWithStatus() always calls syncWalletToFirebase() (via fbUpdateDoc).
 *
 * **Validates: Requirements 2.2**
 */
describe('Property 3e — PBT: random valid fees always trigger syncWalletToFirebase', () => {
  beforeEach(walletBeforeEach);
  afterEach(() => { localStorage.clear(); jest.clearAllMocks(); });

  test('4.5 — PBT: submitWithStatus() always calls fbUpdateDoc for any valid fee', () => {
    // Generate 50 random valid fee values (1 to 5000)
    const STARTING_BALANCE = 5000;
    const NUM_SAMPLES = 50;

    // Use a seeded pseudo-random sequence for reproducibility
    let seed = 42;
    function nextRand() {
      seed = (seed * 1664525 + 1013904223) & 0xffffffff;
      return Math.abs(seed);
    }

    for (let i = 0; i < NUM_SAMPLES; i++) {
      // Reset mocks for each iteration
      window.fbUpdateDoc = jest.fn().mockResolvedValue(undefined);
      window.transactions = [];

      const fee = (nextRand() % STARTING_BALANCE) + 1; // 1 to 5000

      window.submitWithStatus(
        'Test Service',
        'Test details',
        fee,
        'submitted',
        { 'Test': 'data' }
      );

      // fbUpdateDoc must have been called with { wallet: <number> }
      expect(window.fbUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        { wallet: expect.any(Number) }
      );
    }
  });
});

// ── Property 3f: PBT — random insufficient balances never trigger fbUpdateDoc ─

/**
 * Property 3f — Property-Based: for any random fee > walletBalance,
 * submitService() never calls syncWalletToFirebase() and walletBalance is unchanged.
 *
 * **Validates: Requirements 3.4**
 */
describe('Property 3f — PBT: random insufficient balances never trigger syncWalletToFirebase', () => {
  beforeEach(walletBeforeEach);
  afterEach(() => { localStorage.clear(); jest.clearAllMocks(); });

  test('4.6 — PBT: submitService() never calls fbUpdateDoc when balance is insufficient', () => {
    const STARTING_BALANCE = 5000;
    const NUM_SAMPLES = 50;

    let seed = 99;
    function nextRand() {
      seed = (seed * 1664525 + 1013904223) & 0xffffffff;
      return Math.abs(seed);
    }

    jest.useFakeTimers();

    for (let i = 0; i < NUM_SAMPLES; i++) {
      window.fbUpdateDoc = jest.fn().mockResolvedValue(undefined);

      // Fee is always greater than walletBalance
      const fee = STARTING_BALANCE + (nextRand() % 10000) + 1; // 5001 to 15000

      window.openServiceModal('BVN Verification', 'Verify BVN', 'bvn', fee);
      jest.runAllTimers();

      window.submitService();

      // fbUpdateDoc must NOT have been called
      expect(window.fbUpdateDoc).not.toHaveBeenCalled();
    }

    jest.useRealTimers();
  });
});
