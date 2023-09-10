import * as admin from "firebase-admin";
import { DocumentData, DocumentSnapshot } from "firebase-admin/firestore";
import * as firebaseFunctions from "firebase-functions";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";

const auth = admin.auth();
const db = admin.firestore();

interface UserAdminData extends admin.firestore.DocumentData {
  _lastUpdated?: admin.firestore.Timestamp;
  _unit?: string;
  _role?: string;
}

interface UserClaims {
  _unit?: string;
  _role?: string;
}

export const functions = {
  authOnCreate: firebaseFunctions.auth.user().onCreate(async (user) => {
    const { uid, email, displayName, photoURL } = user;
    console.log(`Creating user ${uid} (${email})`);

    const userDoc = db.doc(`users/${uid}`);
    await userDoc.set({
      _lastUpdated: user.metadata.creationTime,
      _unit: null,
      _role: null,
      displayName,
      email,
      photoURL,
    });
  }),
  syncUserAdmin: onDocumentUpdated("users/{uid}", async (event) => {
    const beforeData: UserAdminData = event.data?.before.data() || {};
    const afterData: UserAdminData = event.data?.after.data() || {};

    // Skip updates where _lastUpdated field changed, to avoid infinite loops
    const skipUpdate =
      beforeData._lastUpdated &&
      afterData._lastUpdated &&
      beforeData._lastUpdated !== afterData._lastUpdated;
    if (skipUpdate) {
      console.log("No changes");
      return;
    }

    // Create a new JSON payload and check that it's under the 1000 character max
    const { _lastUpdated, _unit, _role } = afterData;
    const newClaims: UserClaims = { _unit: _unit, _role: _role };
    const stringifiedClaims = JSON.stringify(newClaims);
    if (stringifiedClaims.length > 1000) {
      console.error(
        "New custom claims object string > 1000 characters",
        stringifiedClaims
      );
      return;
    }

    const uid = event.params.uid;
    console.log(`Setting custom claims for ${uid}`, newClaims);
    await auth.setCustomUserClaims(uid, newClaims);

    console.log(`Updating document timestamp, last updated ${_lastUpdated}`);
    await event.data?.after.ref.update({
      _lastUpdated: event.time,
      ...newClaims,
    });
  }),
};

export const getUserDocument = async (
  userID: string | undefined
): Promise<DocumentSnapshot<DocumentData>> => {
  if (userID == null) {
    throw new Error("Empty user ID for user lookup");
  }

  return await db.doc(`users/${userID}`).get();
};

export const getUser = async (
  userID: string | undefined
): Promise<FirebaseFirestore.DocumentData> => {
  const userDocument = await getUserDocument(userID);
  const user = userDocument.data();

  if (user == null) {
    throw new Error(`Could not find user record ${userID}`);
  }

  return user;
};
