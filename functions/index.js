const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();
const fcm = admin.messaging();
var interval;

exports.treadmillProcess = functions
  .region("asia-northeast1")
  .firestore.document("treadmill_status/{treadmillId}")
  .onUpdate(async (snapshot) => {
    if (
      snapshot.after.data().user !== "" &&
      snapshot.after.data().isAvailable === true &&
      snapshot.after.data().startTime === -1
    ) {
      await db
        .collection("treadmill_status")
        .doc(snapshot.after.id)
        .update({ startTime: Date.now() });
      const snapshotUserData = await db
        .collection("userdata")
        .doc(snapshot.after.data().user)
        .get();
      const fcmToken = snapshotUserData.data().fcmToken;
      const payload = {
        notification: {
          title: "Treadmill is ready!!!",
          body: "You have to play in 30 secs",
          clickAction: "FLUTTER_NOTIFICATION_CLICK",
          sound: "cool.mp3",
        },
        data: {
          type: "RunQueue",
          startTime: String(Date.now()),
        },
      };
      console.log("Run queue");
      await fcm.sendToDevice(fcmToken, payload);
      var count = 0;
      interval = setInterval(checkAccept, 1000);
      async function checkAccept() {
        count++;
        console.log(count);
        var snapshotCheckStatus = await db
          .collection("treadmill_status")
          .doc(snapshot.after.id)
          .get();
        if (count >= 30) {
          if (
            snapshotCheckStatus.data().isAvailable === true &&
            snapshotCheckStatus.data().user === snapshot.after.data().user
          ) {
            console.log("Queue is not accept before");
            await db
              .collection("treadmill_queue")
              .doc(snapshot.after.data().user)
              .delete();
            await db
              .collection("treadmill_status")
              .doc(snapshot.after.id)
              .update({ user: "", startTime: -1 });
            clearInterval(interval);
            return 0;
          } else if (
            snapshotCheckStatus.data().isAvailable === true &&
            snapshotCheckStatus.data().user === ""
          ) {
            console.log("Queue is not accept by user");
            clearInterval(interval);
            return 0;
          } else {
            console.log("Out of case 1");
            clearInterval(interval);
            return 0;
          }
        }
        if (
          snapshotCheckStatus.data().isAvailable === false &&
          snapshotCheckStatus.data().user === snapshot.after.data().user
        ) {
          await db
            .collection("treadmill_status")
            .doc(snapshot.after.id)
            .update({ startTime: -1 });
          console.log("Queue is accept by user before 30");
          clearInterval(interval);
          return 0;
        } else if (
          snapshotCheckStatus.data().isAvailable === true &&
          snapshotCheckStatus.data().user === ""
        ) {
          console.log("Queue is not accept by user before 30");
          clearInterval(interval);
          return 0;
        }
      }
    } else if (
      snapshot.after.data().user === "" &&
      snapshot.after.data().isAvailable === true
    ) {
      const snapshotQueue = await db
        .collection("treadmill_queue")
        .orderBy("queueNumber", "asc")
        .limit(1)
        .get();
      if (!snapshotQueue.empty) {
        console.log("Queue Up");
        return await db
          .collection("treadmill_status")
          .doc(snapshot.after.id)
          .update({ user: snapshotQueue.docs[0].id, startTime: -1 });
      } else {
        console.log("Queue is empty");
        return 0;
      }
    } else if (
      snapshot.after.data().user !== "" &&
      snapshot.after.data().isAvailable === false &&
      snapshot.after.data().startTime !== -1
    ) {
      await db
        .collection("treadmill_queue")
        .doc(snapshot.after.data().user)
        .delete();
      const snapshotUserData = await db
        .collection("userdata")
        .doc(snapshot.after.data().user)
        .get();
      const fcmToken = snapshotUserData.data().fcmToken;
      const payload = {
        notification: {
          title: "Treadmill is now using",
          body: "Please press done button after you finished.",
          clickAction: "FLUTTER_NOTIFICATION_CLICK",
          sound: "cool.mp3",
        },
        data: {
          type: "AcceptQueue",
          AcceptTime: String(Date.now()),
        },
      };
      console.log("Accept queue");
      return await fcm.sendToDevice(fcmToken, payload);
    } else {
      console.log("Do nothing");
      return 0;
    }
  });


exports.autoSendNotification = functions
.region("asia-northeast1")
.firestore.document('notification/{notificationId}')
.onCreate(async (snapshot) => {
  const payload = {
    notification: {
      title: snapshot.data().title,
      body: snapshot.data().detail,
      clickAction: "FLUTTER_NOTIFICATION_CLICK",
      sound: "default",
    },
    data: {
      type: snapshot.data().type,
    },
  };
  fcm.sendToTopic("notification",payload).then(function(response){
    console.log('Notification sent successfully:',response);
    
  }) 
  .catch(function(error){
      console.log('Notification sent failed:',error);
      return -1;
  });
  
})

exports.onCreatePost = functions
.region("asia-northeast1")
.firestore.document('post/{postId}')
.onCreate(async (snapshot) => {
  await db.collection('notification').add({
    title:'New Post !',
    detail: snapshot.data().title,
    type:'post',
    createdTime:admin.firestore.FieldValue.serverTimestamp(),
  });
  return 0;
})

exports.onCreateClass = functions
.region("asia-northeast1")
.firestore.document('class/{classId}')
.onCreate(async (snapshot) => {
  await db.collection('notification').add({
    title:'New Class !',
    detail: snapshot.data().title,
    type:'class',
    createdTime:admin.firestore.FieldValue.serverTimestamp(),
  });
  return 0;
})