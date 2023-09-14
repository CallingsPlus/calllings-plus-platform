import * as admin from "firebase-admin";
import {
  onDocumentCreated,
  onDocumentUpdated,
} from "firebase-functions/v2/firestore";

const db = admin.firestore();

interface TalkStatistics {
  lastTalkGiven?: admin.firestore.Timestamp;
  contacts: number;
  accepts: number;
  misses: number;
  declines: number;
  cancels: number;
}

interface Talk {
  date: admin.firestore.Timestamp;
  topic: string;
}

export const functions = {
  createTalkStatistics: onDocumentCreated(
    "units/{unitID}/members/{memberID}",
    async (event) => {
      const { unitID, memberID } = event.params;

      await db
        .doc(`units/${unitID}/members/${memberID}/information/talkStatistics`)
        .set({
          lastTalkGiven: undefined,
          contacts: 0,
          accepts: 0,
          misses: 0,
          declines: 0,
          cancels: 0,
        } as TalkStatistics);
    }
  ),
  talkStatisticsUpdated: onDocumentUpdated(
    "units/{unitID}/members/{memberID}/information/talkStatistics",
    async (event) => {
      const { unitID, memberID } = event.params;
      const talkStatistics = event.data?.after.data() as TalkStatistics;

      let talkSuccessPercentage = 1;
      if (
        talkStatistics.cancels ||
        talkStatistics.declines ||
        talkStatistics.misses
      ) {
        talkSuccessPercentage =
          (talkStatistics.contacts + talkStatistics.accepts) /
          (talkStatistics.contacts +
            talkStatistics.accepts +
            talkStatistics.cancels +
            talkStatistics.declines +
            talkStatistics.misses);
      }

      await db.doc(`units/${unitID}/members/${memberID}`).set(
        {
          talkSuccessPercentage: talkSuccessPercentage,
          lastTalkGiven: talkStatistics.lastTalkGiven,
        },
        { merge: true }
      );
    }
  ),
  handleTalkAssignment: onDocumentCreated(
    "units/{unitID}/members/{memberID}/talks/{talkID}",
    async (event) => {
      const { unitID, memberID } = event.params;
      const talk = event.data?.data() as Talk;

      await db
        .doc(`units/${unitID}/members/${memberID}/information/talkStatistics`)
        .update({
          lastTalkGiven: talk.date,
        });
    }
  ),
};
