
// Google Sheet Integration Config
export const CLIENT_ID = '1034922920826-p03210cv43c0kgdp15fjgkq90hbjs6uq.apps.googleusercontent.com'; // Replace with actual Client ID
export const GOOGLE_SHEET_ID = '17iqYl2D9JOUM7RtkUr0M8cRFi_xVBPLzWxifiBMJH8I'; // Replace with actual Sheet ID
export const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz1SZU3FeZD1wRKa--versXJOd9VFfoDfGaDaDneP7zDOuDq4grzQV9lSiffx8o-RJ4pw/exec'; // Replace with deployed Web App URL

// Facebook Insights Config — values injected at runtime via Cloud Run env vars
const runtimeEnv = (window as any).__ENV__ || {};
export const FACEBOOK_ACCESS_TOKEN: string = runtimeEnv.FACEBOOK_ACCESS_TOKEN || '';
export const FACEBOOK_AD_ACCOUNT_ID: string = runtimeEnv.FACEBOOK_AD_ACCOUNT_ID || '10153679704478431';
