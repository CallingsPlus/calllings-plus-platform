import * as admin from "firebase-admin";
import { onCall } from "firebase-functions/v2/https";
import { DocumentData, DocumentSnapshot } from "firebase-admin/firestore";
import OpenAI from "openai";
import { defineSecret } from "firebase-functions/params";
import { v5 as uuidv5 } from "uuid";
import { onDocumentCreated } from "firebase-functions/v2/firestore";

const UUID_NAMESPACE = "c2feec3c-8d47-449b-af18-8640a28e916f";

const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");

const db = admin.firestore();
const aiChunkSize = 20;

interface ShortMember {
  f: string;
  ln: string;
  g: string;
  p: string;
  e: string;
}

export interface Member {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  gender: string;
  isHidden: boolean;
  notes: string;

  // Talks
  talkSuccessPercentage?: number;
  lastTalkGiven?: admin.firestore.Timestamp;

  // Prayers
  prayerSuccessPercentage?: number;
  lastPrayerGiven?: admin.firestore.Timestamp;
}

export const functions = {
  import: onCall(
    {
      timeoutSeconds: 540,
    },
    async (request) => {
      // if (context.app == undefined && isProduction) {
      //     throw new firebaseFunctions.https.HttpsError(
      //         "failed-precondition",
      //         "The function must be called from an App Check verified app.")
      // }

      // Get the user's unit to import to
      const unit = request.auth?.token?.unit;
      const data = request.data as string;

      await importMembers(unit, data);

      return true;
    }
  ),
  onCreate: onDocumentCreated(
    "units/{unitID}/members/{memberID}",
    async (event) => {
      const { unitID, memberID } = event.params;

      db.runTransaction(async (transaction) => {
        transaction.set(
          db.doc(`units/${unitID}/members/${memberID}`),
          {
            isHidden: false,
            notes: "",
            talkSuccessPercentage: 1,
            lastTalkGiven: undefined,
            prayerSuccessPercentage: 1,
            lastPrayerGiven: undefined,
          },
          { merge: true }
        );
      });
    }
  ),
  //   test_import: onRequest(
  //     {
  //       timeoutSeconds: 540,
  //     },
  //     async (request, response) => {
  //       response.send(await importMembers(request.body.unit, request.body.data));
  //     }
  //   ),
};

const importMembers = async (unitID: string, data: string) => {
  const chunks = splitByLines(data, aiChunkSize);
  const members: Member[] = [];
  const imports = [];
  for (const chunk of chunks) {
    imports.push(
      requestMembers(chunk)
        .then((result) => {
          members.push(...result);
        })
        .catch((error) => {
          console.error(error);
        })
    );
  }

  await Promise.all(imports);

  const sortedMembers = members.sort((a, b) => {
    const last = a.lastName.localeCompare(b.lastName);
    if (last != 0) {
      return last;
    }
    return a.firstName.localeCompare(b.firstName);
  });

  await db.runTransaction(async (transaction) => {
    const unitDoc = await transaction.get(db.doc(`units/${unitID}`));
    if (!unitDoc.exists) {
      throw new Error(`Could not find unit record ${unitID}`);
    }

    const membersToWrite: Member[] = [];
    for (const member of sortedMembers) {
      const memberID = memberIDFrom(member);
      const memberDoc = await transaction.get(
        db.doc(`units/${unitID}/members/${memberID}`)
      );
      if (!memberDoc.exists) {
        membersToWrite.push(member);
      } else {
        console.log(`Skipping existing member ${memberID}`);
        continue;
      }
    }

    for (const member of membersToWrite) {
      const memberID = memberIDFrom(member);
      console.log(`Adding new member ${memberID}`);
      transaction.set(db.doc(`units/${unitID}/members/${memberID}`), member);
    }
  });

  console.log("Members imported successfully");

  return sortedMembers;
};

const requestMembers = async (data: string) => {
  const openai = new OpenAI({
    apiKey: OPENAI_API_KEY.value(),
  });

  const message = `
      Parse out the following data into a list of objects with the following json format: 
      {
        "f": , // first name 
        "ln": , // last name
        "g", // gender
        "p", // phone
        "e", // email
      }
    
      Only return JSON
    
      ---
      ${data}
      ---
      `;

  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "user",
        content: message,
      },
    ],
    temperature: 0,
  });

  return JSON.parse(response.choices.shift()?.message.content ?? "").map(
    (member: ShortMember) => {
      return {
        firstName: member.f,
        lastName: member.ln,
        gender: member.g,
        phone: member.p,
        email: member.e,
      };
    }
  ) as Member[];
};

const splitByLines = (string: string, linesPerChunk = 100) => {
  const lines = string.split("\n");
  const chunks = [];
  let currentChunk = "";
  for (const line of lines) {
    if (currentChunk.length > 0) {
      currentChunk += "\n";
    }
    currentChunk += line;
    if (currentChunk.split("\n").length > linesPerChunk) {
      chunks.push(currentChunk);
      currentChunk = "";
    }
  }
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }
  return chunks;
};

export const getMemberDocument = async (
  unitID: string | undefined,
  memberID: string | undefined
): Promise<DocumentSnapshot<DocumentData>> => {
  if (unitID == null) {
    throw new Error("Empty unit ID for member lookup");
  }

  if (memberID == null) {
    throw new Error("Empty member ID for member lookup");
  }

  return await db.doc(`units/${unitID}/members/${memberID}`).get();
};

export const getMember = async (
  unitID: string | undefined,
  memberID: string | undefined
): Promise<FirebaseFirestore.DocumentData> => {
  const unitDocument = await getMemberDocument(unitID, memberID);
  const unit = unitDocument.data();

  if (unit == null) {
    throw new Error(`Could not find member record ${unitID}:${memberID}`);
  }

  return unit;
};

const memberIDFrom = (member: Member) => {
  return uuidv5(Object.values(member).join("-"), UUID_NAMESPACE); // ⇨ '630eb68f-e0fa-5ecc-887a-7c7a62614681'
};
