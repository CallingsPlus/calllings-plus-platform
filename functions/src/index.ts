/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

// import { onRequest } from "firebase-functions/v2/https";
// import * as logger from "firebase-functions/logger";

// The Firebase Admin SDK to access Firestore.
import * as admin from "firebase-admin";
admin.initializeApp();
admin.firestore().settings({ ignoreUndefinedProperties: true });

import * as onboardingFunctions from "./onboarding";
import * as membersFunctions from "./members";
import * as prayersFunctions from "./prayers";
import * as talksFunctions from "./talks";
import * as unitFunctions from "./units";
import * as userFunctions from "./users";

// Update config for emulator from the functions directory:
// firebase functions:config:get > .runtimeconfig.json

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

export const onboarding = onboardingFunctions.functions;
export const members = membersFunctions.functions;
export const prayers = prayersFunctions.functions;
export const talks = talksFunctions.functions;
export const units = unitFunctions.functions;
export const users = userFunctions.functions;
