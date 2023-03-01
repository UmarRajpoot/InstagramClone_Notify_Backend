const bodyParser = require("body-parser");
const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const { cert } = require("firebase-admin/app");
const createHttpError = require("http-errors");

const ServiceAccountKey = require("./instagramappadminsdka0a89fd663.json");

// const loadJSON = (path) =>
//   JSON.parse(fs.readFileSync(new URL(path, import.meta.url)));

const app = express();

const PORT = process.env.PORT || 5000;
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(
  cors({
    origin: "*",
  })
);

admin.initializeApp({
  credential: cert(ServiceAccountKey),
});

app.get("/", (req, res) => {
  res.send("Server is live");
});
app.get("/api", (req, res) => {
  res.send("Server is live On Api");
});

app.post("/api/notify", async (req, res, next) => {
  try {
    const { authID } = req.body;
    console.log("Trigger", authID);

    let userToken = "";
    let userData = {};

    const SendLikeNotification = async (
      Post,
      whoAction,
      notificationId,
      Label
    ) => {
      const message = {
        data: {
          title: "Instagram Clone Notification",
          body: `${whoAction.displayName || "SomeOne"} ${
            Label === "Like"
              ? "Liked Your Post. 👍"
              : Label === "Comment"
              ? "Commented on Your Post. 💬"
              : Label === "Follow"
              ? "Send a request"
              : Label === "accept"
              ? "and You are now Friend"
              : "Something Happen"
          }`,
          photoURL:
            Label === "Follow"
              ? whoAction.photoURL
              : Label === "accept"
              ? whoAction.photoURL
              : Post.photoURL,
        },
        token: userToken,
      };

      const CheckToNotify = async (response) => {
        await admin
          .app()
          .firestore()
          .collection("Users")
          .doc(authID)
          .collection("Notifications")
          .doc(notificationId)
          .update({
            Notify: true,
          })
          .then(() => {
            console.log("Step 3 Completed. Response Sended");

            // Response is a message ID string.
            res.send({
              success: true,
              message: response,
              token: userToken,
              userData: userData,
            });
            res.end(() => {
              console.log("Finish.");
            });
          })
          .catch((error) => {
            return next(
              createHttpError(406, { success: false, message: error.message })
            );
          });
      };

      //  Send Notification
      await admin
        .messaging()
        .send(message)
        .then((response) => {
          CheckToNotify(response);
        })
        .catch((error) => {
          return next(
            createHttpError(406, { success: false, message: error.message })
          );
        });
    };

    const grabToken = await admin
      .app()
      .firestore()
      .collection("Users")
      .doc(authID?.trim())
      .get()
      .then((grabData) => {
        const { NotificationToken, displayName, photoURL } = grabData.data();
        userToken = NotificationToken;
        userData = {
          displayName: displayName,
          photoURL: photoURL,
        };
        console.log("Step 1 Completed. Gathered Info");
      })
      .catch((error) => {
        return next(
          createHttpError(406, { success: false, message: error.message })
        );
      });

    const Notificationdb = await admin
      .app()
      .firestore()
      .collection("Users")
      .doc(authID?.trim())
      .collection("Notifications")
      .get()
      .then((resp) => {
        if (!resp.empty) {
          return resp.docs.map((respNotify) => {
            const { Notify, Label, Post, whoAction } = respNotify.data();
            const notificationId = respNotify.id;
            if (!Notify) {
              SendLikeNotification(Post, whoAction, notificationId, Label);
              console.log("Step 2 Completed. Trigger Notifiaction Method.");
            }
          });
        }
      })
      .catch((error) => {
        return next(
          createHttpError(406, { success: false, message: error.message })
        );
      });
  } catch (error) {
    return next(
      createHttpError(406, { success: false, message: error.message })
    );
  }
});

app.use(async (req, res, next) => {
  next(createHttpError(404));
});

app.use((err, req, res, next) => {
  res.status(err.status || 500);
  res.send({
    error: {
      success: err.success,
      status: err.status || 500,
      message: err.message,
    },
  });
});

app.listen(PORT, () => {
  console.log("Notification Server is Up and Running.");
});
