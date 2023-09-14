import * as admin from "firebase-admin";
import {
  onDocumentCreated,
  onDocumentUpdated,
} from "firebase-functions/v2/firestore";

const db = admin.firestore();

interface PrayerStatistics {
  lastPrayerGiven?: admin.firestore.Timestamp;
  contacts: number;
  accepts: number;
  misses: number;
  declines: number;
  cancels: number;
}

interface Prayer {
  date: admin.firestore.Timestamp;
  topic: string;
}

export const functions = {
  createPrayerStatistics: onDocumentCreated(
    "units/{unitID}/members/{memberID}",
    async (event) => {
      const { unitID, memberID } = event.params;

      await db
        .doc(`units/${unitID}/members/${memberID}/information/prayerStatistics`)
        .set({
          lastPrayerGiven: undefined,
          contacts: 0,
          accepts: 0,
          misses: 0,
          declines: 0,
          cancels: 0,
        } as PrayerStatistics);
    }
  ),
  prayerStatisticsUpdated: onDocumentUpdated(
    "units/{unitID}/members/{memberID}/information/prayerStatistics",
    async (event) => {
      const { unitID, memberID } = event.params;
      const prayerStatistics = event.data?.after.data() as PrayerStatistics;

      let prayerSuccessPercentage = 1;
      if (
        prayerStatistics.cancels ||
        prayerStatistics.declines ||
        prayerStatistics.misses
      ) {
        prayerSuccessPercentage =
          (prayerStatistics.contacts + prayerStatistics.accepts) /
          (prayerStatistics.contacts +
            prayerStatistics.accepts +
            prayerStatistics.cancels +
            prayerStatistics.declines +
            prayerStatistics.misses);
      }

      await db.doc(`units/${unitID}/members/${memberID}`).set(
        {
          prayerSuccessPercentage: prayerSuccessPercentage,
          lastPrayerGiven: prayerStatistics.lastPrayerGiven,
        },
        { merge: true }
      );
    }
  ),
  handlePrayerAssignment: onDocumentCreated(
    "units/{unitID}/members/{memberID}/prayers/{prayerID}",
    async (event) => {
      const { unitID, memberID } = event.params;
      const prayer = event.data?.data() as Prayer;

      await db
        .doc(`units/${unitID}/members/${memberID}/information/prayerStatistics`)
        .update({
          lastPrayerGiven: prayer.date,
        });
    }
  ),
};
