import * as admin from "firebase-admin";
import { onCall } from "firebase-functions/v2/https";
import { getUserDocument } from "../users";

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
};
