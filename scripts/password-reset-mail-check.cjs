'use strict';
const path=require('node:path');
require('dotenv').config({path:path.join(__dirname,'..','.env')});
const {createZohoSender}=require('../routes/auth/password-reset.cjs');
const to=process.argv[2];
if(!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)){console.error('Usage: node scripts/password-reset-mail-check.cjs YOUR_OWN_TEST_EMAIL');process.exitCode=1;}
else if(!process.env.ZOHO_CLIENT_ID||!process.env.ZOHO_CLIENT_SECRET||!process.env.ZOHO_REFRESH_TOKEN||!/^\d+$/.test(process.env.ZOHO_MAIL_ACCOUNT_ID||'')||!process.env.PASSWORD_RESET_FROM){console.error('Missing Zoho email environment settings.');process.exitCode=1;}
else createZohoSender(process.env)({to,subject:'GalaxyBets password reset email test',text:'Your GalaxyBets password-reset sending configuration is working. This is a test email. No password was changed.'}).then(()=>console.log('Test accepted by Zoho. Confirm receipt in your inbox or spam folder.')).catch(()=>{console.error('Zoho delivery check failed. Verify the authorized mailbox, OAuth scopes, account ID and sending permissions.');process.exitCode=1;});
