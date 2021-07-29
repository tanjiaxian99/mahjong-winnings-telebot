const mongoose = require("mongoose");
const fetch = require("node-fetch");
require("dotenv").config();

const uri =
  process.env.NODE_ENV === "development"
    ? "mongodb://localhost:27017/mahjong-winnings"
    : process.env.MONGODB_URI;

mongoose.connect(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true,
  useFindAndModify: false,
});

const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", () => {
  console.log("Database connected!");
});

const wrapper = (f) => {
  return async function () {
    try {
      return await f.apply(this, arguments);
    } catch (e) {
      console.log(e);
    }
  };
};

const createRoom = async (chatId, name) => {
  let res = await fetch("https://api.random.org/json-rpc/4/invoke", {
    method: "post",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "generateStrings",
      params: [
        "ce0c662c-ae13-4e37-a551-e2aacab7de2c",
        1,
        6,
        "abcdefghijklmnopqrstuvwxyz",
      ],
      id: 42,
    }),
  });
  res = await res.json();
  const [passcode] = res.result.random.data;

  const rooms = db.collection("rooms");
  const users = db.collection("users");
  const players = {};
  players[chatId] = 0;

  await rooms.insertOne({ passcode, hostId: chatId, players });
  await users.updateOne(
    { chatId },
    { $set: { chatId, name, passcode } },
    { upsert: true }
  );
  return passcode;
};

const joinRoom = async (chatId, name, passcode) => {
  const rooms = db.collection("rooms");
  const users = db.collection("users");
  const room = await rooms.findOne({ passcode });
  if (!room) {
    return { error: "No such room" };
  }

  const players = room.players;
  if (Object.keys(players).length >= 4) {
    return { error: "Room full" };
  }

  players[chatId] = 0;
  rooms.updateOne({ passcode }, { $set: { players } });
  await users.updateOne(
    { chatId },
    { $set: { chatId, name, passcode } },
    { upsert: true }
  );
  return { hostId: room.hostId };
};

const updateRoomMaster = async () => {};

module.exports = {
  createRoom: wrapper(createRoom),
  joinRoom: wrapper(joinRoom),
};
