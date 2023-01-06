import { WebSocketServer } from "ws";
import User from "../Database/models/User";
import Room from "../Database/models/Room";
import Logger from "../utils/Logger";
import { API_BASE } from "../config/config.json";
// @ts-ignore
import parseQueryParameters from "parse-url-query-params";
let userMessageCache: any = {};
let clients: any = [];
const wss = new WebSocketServer({
  noServer: true,
  path: `${API_BASE}conversations`,
});

// For every connection attempt
wss.on("connection", (WebsocketConnection, req) => {
  // @ts-ignore
  // Polyfills
  // The request params
  req.params = parseQueryParameters(req.url);
  const ip = req.socket.remoteAddress;
  // Spec Violation
  function specViolation(error: any) {
    WebsocketConnection.send(JSON.stringify(serverMsg(-1, null)));
    Logger.WARN(error);
    return Logger.WARN("[WEBSOCKET] Spec Violation: Unsupported Format!");
  }
  // The broadcast function
  // @ts-ignore
  WebsocketConnection.broadcast = (data: any) => {
    wss.clients.forEach((client) => {
      if (
        client !== WebsocketConnection &&
        client.readyState === WebsocketConnection.OPEN
      ) {
        client.send(JSON.stringify(data));
      }
    });
  };

  Logger.INFO(
    // @ts-ignore
    `Client Connected to room ${req.params.RID} - GUILD = ${req.params.guild}`
  );
  let room: any = null;
  let LoggedIn: Boolean = false;
  let saveThread: any = null;
  // @ts-ignore
  let userIndex: Number = null;
  // For every message

  WebsocketConnection.on("close", async () => {
    Logger.WARN(ip + " disconnected.");
    // Try and remove the threads
    try {
      Logger.INFO("KILL THREAD SAVE");
      clearInterval(saveThread);
      Logger.INFO("KILL THREAD HEARTBEAT");
      clearInterval(heartbeat);
      Logger.INFO(`REMOVE USER ${userIndex}`);
      clients = clients.splice(userIndex, 1);
    } catch (error) {
      Logger.WARN(`No threads were ever assigned to ${ip}`);
    }
  });

  WebsocketConnection.on("message", async (msg) => {
    let data: any = {};
    try {
      // @ts-ignore
      data = JSON.parse(msg);
    } catch (error) {
      return specViolation(error);
    }
    // Extract Data
    // @ts-ignore
    const username: string = data.IAM; // @ts-ignore
    const auth: string = data.auth; // @ts-ignore
    const type: Number = data.type;
    // @ts-ignore
    let RID: string = req.params.RID; // @ts-ignore
    let guildType_ = null;
    try {
      // @ts-ignore
      guildType_ = JSON.parse(req.params.guild);
    } catch (error) {
      return specViolation(error);
    }
    const guildType: Boolean = guildType_;
    guildType_ = undefined; // Cleanup
    let user_ = null;
    try {
      user_ =
        (await User.findOne({ UID: username })) ||
        (await User.findOne({ email: username }));
    } catch (e) {
      // @ts-ignore
      Logger.WARN(e);
      Logger.WARN("TERMINATING CONNECTION");
      return WebsocketConnection.close();
    }

    const user = user_;
    user_ = undefined; // Cleanup
    // Looking for room...
    RID = createRID(username, RID);
    room = await Room.findOne({
      id: RID,
      participants: username,
      type: guildType ? "GUILD" : "CONVERSATION",
    });

    // If room doesnt exist and it's a Direct Message

    // We create an ID of it being the lowest ID first and then the highest ID
    // Example: Reciever ID: 2 and Sender ID: 1 -> 12
    console.log(room, guildType ? "GUILD" : "CONVERSATION");
    console.log(!room && !guildType);
    if (!room && !guildType) {
      room = await Room.create({
        id: RID,
        type: "CONVERSATION", // @ts-ignore
        participants: [username, req.params.RID],
        messages: [],
      });
      Logger.INFO(
        // @ts-ignore
        `NEW Room created with RID=${RID}; TYPE=CONVERSATION; PARTICIPANTS=[${username}, ${req.params.RID}]`
      );
      // @ts-ignore
      const reciever = await User.findOne({ UID: req.params.RID });
      if (!reciever) {
        // Add to recieving end too
        return WebsocketConnection.send(
          JSON.stringify(serverMsg(-1, "BAD_RECIEVING_END"))
        );
      }
      // @ts-ignore
      user?.conversations?.push(req.params.RID);
      reciever?.conversations?.push(username);
      console.log(room, guildType);
      user?.save();
      reciever?.save();
      room.save();
    } else {
      Logger.INFO(
        // @ts-ignore
        `USING Room created with RID=${RID}; TYPE=CONVERSATION; PARTICIPANTS=[${username}, ${req.params.RID}]`
      );
      // @ts-ignore
      userMessageCache[RID] = room?.messages;
      console.log(room?.messages);
    }

    // console.log(data, user); // Debug
    if (!LoggedIn) {
      if (
        auth === undefined ||
        !auth ||
        auth != user?.token ||
        type != 0 ||
        !user
      ) {
        Logger.WARN("Client login failed");
        return WebsocketConnection.send(
          JSON.stringify(serverMsg(-1, "BAD_AUTH"))
        );
      } else if (!LoggedIn) {
        WebsocketConnection.send(JSON.stringify(serverMsg(1, "SUCCESS")));
        Logger.INFO("Client logged in");
        WebsocketConnection.send(JSON.stringify(room?.messages));
        if (!clients[RID]) {
          clients[RID] = [];
        }
        if (!clients[RID][username]) {
          clients[RID].push(username); // Add to client list
        }
        userIndex = clients.length;
        console.log(clients);
        // Start the saveThread
        // Save the room every 5 seconds
        saveThread = setInterval(() => {
          // @ts-ignore
          room.messages = userMessageCache[RID] || []; // Empty array in case of bad message
          // @ts-ignore
          console.log("STORED MESSAGES", userMessageCache[RID] || []);
          room?.save();
        }, 5000);

        return (LoggedIn = true);
      } else {
        WebsocketConnection.send(JSON.stringify(serverMsg(-1, "FAILURE")));
      }
    }

    switch (type) {
      case 1:
        broadcastToPeer(data, WebsocketConnection, RID);
        break;
      case 2:
        break;
      case 3:
        break;
      default:
        WebsocketConnection.send(JSON.stringify(serverMsg(-1, "BAD_MESSAGE")));
    }
    // console.log(data);
    Logger.INFO("Logged IN: " + LoggedIn);
  });

  // Send a heartbeat to the client every 20s
  // We do this to prevent the socket from commiting suicide.

  const heartbeat = setInterval(() => {
    // @ts-ignore
    WebsocketConnection.broadcast(serverMsg(0, "HEARTBEAT"));
  }, 20000);
});

function serverMsg(status: Number, content: any) {
  return {
    // @ts-ignore
    type: 0,
    status: status,
    content: content,
  };
}

/**
 *
 * @param data Current Message
 * @param WebsocketConnection Websocket connection
 * @param RID RoomID
 */
// @ts-ignore
function broadcastToPeer(data, WebsocketConnection, RID) {
  wss.clients.forEach((client, index) => {
    if (
      client !== WebsocketConnection &&
      client.readyState === WebsocketConnection.OPEN &&
      // @ts-ignore
      clients[index].room === RID
    ) {
      userMessageCache[RID].push(data); // push the parsed data
      client.send(JSON.stringify(data));
      return Logger.INFO(`Stored Message ${data}`);
    } else if (userMessageCache[RID] === null) {
      return (userMessageCache[RID] = []);
    }
  });
}

// Create room ID
// @ts-ignore
function createRID(sender, reciever) {
  if (sender < reciever) {
    return `${sender}${reciever}`;
  } else {
    return `${reciever}${sender}`;
  }
}

export { wss };