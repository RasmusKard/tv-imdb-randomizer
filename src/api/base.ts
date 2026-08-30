/** Where the what-watch API lives. Own module so client.ts and auth.ts can
 * both import it without importing each other. */
export const BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:3000';
