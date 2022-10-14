import { promises as fs } from "fs";
import { join } from "path";
import { cwd } from "process";
import { authenticate } from "@google-cloud/local-auth";
import { google } from "googleapis";
import express from "express";
import dotenv from "dotenv";

dotenv.config();
// If modifying these scopes, delete token.json.
const SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events.readonly",
];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = join(cwd(), "token.json");
const CREDENTIALS_PATH = join(cwd(), "credentials.json");

/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null;
  }
}

/**
 * Serializes credentials to a file comptible with GoogleAUth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials(client) {
  const content = await fs.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: "authorized_user",
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload);
}

/**
 * Load or request or authorization to call APIs.
 *
 */
async function authorize() {
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    return client;
  }
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });
  if (client.credentials) {
    await saveCredentials(client);
  }
  return client;
}

const app = express();
const router = express.Router();
app.use("/", router);

let results = [];
router.get("/getSchedule", async (req, res) => {
  console.log(req.query, "req");
  if (results.length) {
    res.send(results);
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`app running on port: ${PORT}`));
/**
 * Lists the names and IDs of up to 10 files.
 * @param {OAuth2Client} authClient An authorized OAuth2 client.
 */

async function listFiles(authClient) {
  const calendar = google.calendar({ version: "v3", auth: authClient });
  const res = await calendar.events.list({
    calendarId:
      "c_4d94626a570135eb587da7a0a470321b22f29e51cc3a7cdadc001f673451432c@group.calendar.google.com",
  });

  const eventsFromCal = res.data.items;
  const eventsFromCal2 = eventsFromCal.filter((el) => {
    const date = new Date();
    return el.start.dateTime.split("T")[0] === date.toISOString().split("T")[0];
  });
  results = eventsFromCal2;
  console.log(eventsFromCal2, "eventsFromCal");
}

authorize().then(listFiles).catch(console.error);
