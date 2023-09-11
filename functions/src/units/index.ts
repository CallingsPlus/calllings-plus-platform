import * as admin from "firebase-admin";
import { onCall } from "firebase-functions/v2/https";
import { getUserDocument } from "../users";
import { DocumentData, DocumentSnapshot } from "firebase-admin/firestore";

const db = admin.firestore();

interface Unit {
  name: string;
}

export const functions = {
  create: onCall(async (request) => {
    // if (context.app == undefined && isProduction) {
    //     throw new firebaseFunctions.https.HttpsError(
    //         "failed-precondition",
    //         "The function must be called from an App Check verified app.")
    // }

    // Get the user
    const userID = request.auth?.uid;
    if (userID == null) {
      throw new Error("Must be signed in to make units");
    }

    const { name } = request.data as Unit;
    const unit = await db.collection("units").add({ name });
    console.log(`Created Unit ${name} ${unit.id}`);

    (await getUserDocument(userID)).ref.update({ _unit: unit.id });
    console.log(`Updated user ${userID} unit with ${name} ${unit.id}`);

    return { id: unit.id };
  }),
  invite: onCall(async (request) => {
    // if (context.app == undefined && isProduction) {
    //     throw new firebaseFunctions.https.HttpsError(
    //         "failed-precondition",
    //         "The function must be called from an App Check verified app.")
    // }

    // Get the user's unit to invite to
    const unit = request.auth?.token?.unit;

    const invite = await db.collection("invites").add({
      unit: unit,
      createdBy: request.auth?.uid,
    });
    console.log(`Created Invite token for unit ${unit}`);

    return { token: invite.id };
  }),
  join: onCall(async (request) => {
    // if (context.app == undefined && isProduction) {
    //     throw new firebaseFunctions.https.HttpsError(
    //         "failed-precondition",
    //         "The function must be called from an App Check verified app.")
    // }

    const userID = request.auth?.uid;
    if (userID == null) {
      throw new Error("Must be signed in to join units");
    }

    const token = request.data.token as string;
    const invite = await db.doc(`invites/${token}`).get();
    if (!invite.exists) {
      throw new Error(`Invite token ${token} does not exist`);
    }

    const unit = invite.data()?.unit;
    if (!unit) {
      throw new Error(`Invalid invite token ${invite}. No unit found`);
    }

    await db.doc(`users/${userID}`).update({ _unit: unit });
    console.log(`Updated user ${userID} unit with ${unit}`);

    return { id: unit };
  }),
};

export const getUnitDocument = async (
  unitID: string | undefined
): Promise<DocumentSnapshot<DocumentData>> => {
  if (unitID == null) {
    throw new Error("Empty unit ID for unit lookup");
  }

  return await db.doc(`units/${unitID}`).get();
};

export const getUnit = async (
  unitID: string | undefined
): Promise<FirebaseFirestore.DocumentData> => {
  const unitDocument = await getUnitDocument(unitID);
  const unit = unitDocument.data();

  if (unit == null) {
    throw new Error(`Could not find unit record ${unitID}`);
  }

  return unit;
};
