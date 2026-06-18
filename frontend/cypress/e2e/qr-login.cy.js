describe('QR Ordering System - OTP Login Flow', () => {
  beforeEach(() => {
    // Clear localStorage to prevent persisted logins
    cy.clearLocalStorage();
  });

  it('successfully logs in with OTP via QR code query parameters and enters the menu', () => {
    const testMobile = '+1234567890';
    const testOTP = '123456';

    // 1. Intercept the backend send-otp API request
    cy.intercept('POST', '**/api/auth/send-otp/', {
      statusCode: 200,
      body: { status: 'success', message: 'OTP sent successfully.' }
    }).as('sendOtp');

    // 2. Intercept the backend verify-otp API request
    cy.intercept('POST', '**/api/auth/verify-otp/', {
      statusCode: 200,
      body: {
        status: 'success',
        access: 'mock-access-token-xyz',
        refresh: 'mock-refresh-token-xyz'
      }
    }).as('verifyOtp');

    // 3. Visit the site with table context
    cy.visit('/?restaurant=1&table=12');

    // 4. Assert restaurant and table badge is displayed
    cy.get('#table-display').should('contain', 'Table 12');
    
    // 5. Fill and submit the mobile form
    cy.get('#mobile-input').type(testMobile);
    cy.get('#btn-send-otp').click();

    // 6. Wait for send-otp interception and verify OTP input appears
    cy.wait('@sendOtp');
    cy.get('#otp-input').should('be.visible');

    // 7. Enter mock OTP code and submit
    cy.get('#otp-input').type(testOTP);
    cy.get('#btn-verify-otp').click();

    // 8. Wait for verify-otp interception and assert login success
    cy.wait('@verifyOtp');
    
    // 9. Assert the menu catalog is displayed and the login container is gone
    cy.get('#menu-container').should('be.visible');
    cy.get('#login-container').should('not.exist');
    cy.get('.menu-item-card').should('have.length.at.least', 1);
  });
});
