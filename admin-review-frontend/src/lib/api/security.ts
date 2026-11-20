/**
 * Request password reset
 */
export async function requestPasswordReset(): Promise<void> {
  try {
    // TODO: Replace with actual API call when backend is ready
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API delay
    console.log("Password reset requested");
  } catch (error: unknown) {
    console.error("Error requesting password reset:", error);
    throw error;
  }
}

/**
 * Disable two-factor authentication
 */
export async function disableTwoFactorAuth(): Promise<void> {
  try {
    // TODO: Replace with actual API call when backend is ready
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API delay
    console.log("Two-factor authentication disabled");
  } catch (error: unknown) {
    console.error("Error disabling two-factor authentication:", error);
    throw error;
  }
}
