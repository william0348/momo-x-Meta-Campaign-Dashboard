
// Google Sheet Integration Config
export const CLIENT_ID = '1034922920826-p03210cv43c0kgdp15fjgkq90hbjs6uq.apps.googleusercontent.com'; // Replace with actual Client ID
export const GOOGLE_SHEET_ID = '17iqYl2D9JOUM7RtkUr0M8cRFi_xVBPLzWxifiBMJH8I'; // Replace with actual Sheet ID
export const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz1SZU3FeZD1wRKa--versXJOd9VFfoDfGaDaDneP7zDOuDq4grzQV9lSiffx8o-RJ4pw/exec'; // Replace with deployed Web App URL

// Default admin — always authorized, can manage the allowed-account list from the Admin panel
export const ADMIN_EMAIL = 'william03480348@gmail.com';

// Seed/fallback list used until the "Authorized Users" sheet is fetched (or if the fetch fails)
export const AUTHORIZED_EMAILS: string[] = [
  ADMIN_EMAIL,
];

// Sheet name (in the same Google Sheet as Dashboard Data) used to persist the authorized account list
export const AUTHORIZED_USERS_SHEET = 'Authorized Users';

// Facebook Insights Config — values injected at runtime via Cloud Run env vars
const runtimeEnv = (window as any).__ENV__ || {};
export const FACEBOOK_ACCESS_TOKEN: string = runtimeEnv.FACEBOOK_ACCESS_TOKEN || '';
export const FACEBOOK_AD_ACCOUNT_ID: string = runtimeEnv.FACEBOOK_AD_ACCOUNT_ID || '10153679704478431';
