const mongoose = require("mongoose");
const fetch = require("node-fetch");
const {
  tenTwenty,
  twentyFourty,
  threeSixHalf,
  fiftyOne,
  threeSix,
  oneTwo,
} = require("./winningSystems");
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

const registerUser = async (chatId, name, username) => {
  const users = await db.collection("users");
  await users.updateOne(
    { chatId },
    { $set: { chatId, name, username } },
    { upsert: true }
  );
};

const createRoom = async (chatId, name, username) => {
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

  const users = db.collection("users");
  const rooms = db.collection("rooms");
  await users.updateOne(
    { chatId },
    { $set: { name, username, passcode, tally: 0 } },
    { upsert: true }
  );
  await rooms.insertOne({ passcode, hostId: chatId, isShooter: true });
  return passcode;
};

const updateMessageIdHistory = async (chatId, messageId) => {
  const users = db.collection("users");
  await users.updateOne({ chatId }, { $push: { messageIdHistory: messageId } });
};

const deleteMessageIdHistory = async (chatId) => {
  const users = db.collection("users");
  const user = await users.findOne({ chatId });
  if (user === null) {
    return undefined;
  }

  await users.updateOne({ chatId }, { $unset: { messageIdHistory: "" } });
  return user.messageIdHistory;
};

const joinRoom = async (chatId, name, username, passcode) => {
  const users = db.collection("users");
  const rooms = db.collection("rooms");

  let user = await users.findOne({ chatId });
  if (user === null) {
    return { error: "Unregistered user" };
  }

  const room = await rooms.findOne({ passcode });
  if (!room) {
    return { error: "No such room" };
  }

  const count = await users.countDocuments({ passcode });
  if (count >= 4) {
    return { error: "Room full" };
  }

  user = await users.findOne({ chatId, passcode });
  if (user !== null) {
    return { error: "Player exists" };
  }

  await users.updateOne(
    { chatId },
    { $set: { name, username, passcode, tally: 0 } }
  );
  return { hostId: room.hostId };
};

const leaveRoom = async (chatId) => {
  const users = db.collection("users");
  const rooms = db.collection("rooms");
  await users.updateOne({ chatId }, { $unset: { passcode: "" } });
  await rooms.deleteOne({ hostId: chatId });
};

const getHostId = async (chatId) => {
  const users = db.collection("users");
  const user = await users.findOne({ chatId });
  const passcode = user.passcode;
  const rooms = db.collection("rooms");
  const room = await rooms.findOne({ passcode });
  return room.hostId;
};

const getRoomPlayers = async (chatId) => {
  const users = db.collection("users");
  const user = await users.findOne({ chatId });
  const passcode = user.passcode;
  const players = await users.find({ passcode }).toArray();
  return players;
};

const bets = threeSix;

const updateTally = async (type, shooterId, winnerId) => {
  const users = db.collection("users");
  const players = await getRoomPlayers(winnerId);
  const isShooter = await getIsShooter(winnerId);

  // Resets tally for testing purposes
  for (const player of players) {
    await users.updateOne({ chatId: player.chatId }, { $set: { tally: 0 } });
  }

  switch (type) {
    case "1 Tai":
      isShooter
        ? updateShooterTally(
            shooterId,
            winnerId,
            bets.oneTai.base * 2 + bets.oneTai.zimo,
            0,
            bets.oneTai.base * 2 + bets.oneTai.zimo
          )
        : updateShooterTally(
            shooterId,
            winnerId,
            bets.oneTai.zimo,
            bets.oneTai.base,
            bets.oneTai.base * 2 + bets.oneTai.zimo
          );
      break;
    case "2 Tai":
      isShooter
        ? updateShooterTally(
            shooterId,
            winnerId,
            bets.twoTai.base * 2 + bets.twoTai.zimo,
            0,
            bets.twoTai.base * 2 + bets.twoTai.zimo
          )
        : updateShooterTally(
            shooterId,
            winnerId,
            bets.twoTai.zimo,
            bets.twoTai.base,
            bets.twoTai.base * 2 + bets.twoTai.zimo
          );
      break;
    case "3 Tai":
      isShooter
        ? updateShooterTally(
            shooterId,
            winnerId,
            bets.threeTai.base * 2 + bets.threeTai.zimo,
            0,
            bets.threeTai.base * 2 + bets.threeTai.zimo
          )
        : updateShooterTally(
            shooterId,
            winnerId,
            bets.threeTai.zimo,
            bets.threeTai.base,
            bets.threeTai.base * 2 + bets.threeTai.zimo
          );
      break;
    case "4 Tai":
      isShooter
        ? updateShooterTally(
            shooterId,
            winnerId,
            bets.fourTai.base * 2 + bets.fourTai.zimo,
            0,
            bets.fourTai.base * 2 + bets.fourTai.zimo
          )
        : updateShooterTally(
            shooterId,
            winnerId,
            bets.fourTai.zimo,
            bets.fourTai.base,
            bets.fourTai.base * 2 + bets.fourTai.zimo
          );
      break;
    case "5 Tai":
      isShooter
        ? updateShooterTally(
            shooterId,
            winnerId,
            bets.fiveTai.base * 2 + bets.fiveTai.zimo,
            0,
            bets.fiveTai.base * 2 + bets.fiveTai.zimo
          )
        : updateShooterTally(
            shooterId,
            winnerId,
            bets.fiveTai.zimo,
            bets.fiveTai.base,
            bets.fiveTai.base * 2 + bets.fiveTai.zimo
          );
      break;
    case "Zimo 1 Tai":
      updateZimoTally(winnerId, bets.oneTai.zimo, bets.oneTai.zimo * 3);
      break;
    case "Zimo 2 Tai":
      updateZimoTally(winnerId, bets.twoTai.zimo, bets.twoTai.zimo * 3);
      break;
    case "Zimo 3 Tai":
      updateZimoTally(winnerId, bets.threeTai.zimo, bets.threeTai.zimo * 3);
      break;
    case "Zimo 4 Tai":
      updateZimoTally(winnerId, bets.fourTai.zimo, bets.fourTai.zimo * 3);
      break;
    case "Zimo 5 Tai":
      updateZimoTally(winnerId, bets.fiveTai.zimo, bets.fiveTai.zimo * 3);
      break;
    case "Bite":
      updateZimoTally(winnerId, bets.oneTai.base, bets.oneTai.base * 3);
      break;
    case "Double Bite":
      updateZimoTally(winnerId, bets.oneTai.zimo, bets.oneTai.zimo * 3);
      break;
    case "Kong":
      isShooter
        ? updateShooterTally(
            shooterId,
            winnerId,
            bets.oneTai.base * 3,
            0,
            bets.oneTai.base * 3
          )
        : updateShooterTally(
            shooterId,
            winnerId,
            bets.oneTai.base,
            bets.oneTai.base,
            bets.oneTai.base * 3
          );
    case "Zimo Kong":
      updateZimoTally(winnerId, bets.oneTai.zimo, bets.oneTai.zimo * 3);
      break;
    case "Matching Flowers":
      updateShooterTally(
        shooterId,
        winnerId,
        bets.oneTai.base,
        0,
        bets.oneTai.base
      );
    case "Hidden Matching Flowers":
      updateShooterTally(
        shooterId,
        winnerId,
        bets.oneTai.zimo,
        0,
        bets.oneTai.zimo
      );
  }
};

const getIsShooter = async (chatId) => {
  const users = db.collection("users");
  const rooms = db.collection("rooms");
  const user = await users.findOne({ chatId });
  const passcode = user.passcode;
  const room = await rooms.findOne({ passcode });
  return room.isShooter;
};

const updateIsShooter = async (hostId, isShooter) => {
  const rooms = db.collection("rooms");
  await rooms.updateOne({ hostId }, { $set: { isShooter } });
};

const updateShooterTally = async (
  shooterId,
  winnerId,
  shooterLoss,
  othersLoss,
  winnerWins
) => {
  const users = db.collection("users");
  const players = await getRoomPlayers(winnerId);

  for (const player of players) {
    if (player.chatId === parseInt(shooterId)) {
      await users.updateOne(
        { chatId: player.chatId },
        { $inc: { tally: -shooterLoss } }
      );
    } else if (player.chatId === winnerId) {
      await users.updateOne(
        { chatId: player.chatId },
        { $inc: { tally: winnerWins } }
      );
    } else {
      await users.updateOne(
        { chatId: player.chatId },
        { $inc: { tally: -othersLoss } }
      );
    }
  }
};

const updateZimoTally = async (winnerId, othersLoss, winnerWins) => {
  const users = db.collection("users");
  const players = await getRoomPlayers(winnerId);

  for (const player of players) {
    if (player.chatId !== parseInt(winnerId)) {
      await users.updateOne(
        { chatId: player.chatId },
        { $inc: { tally: -othersLoss } }
      );
    } else {
      await users.updateOne(
        { chatId: player.chatId },
        { $inc: { tally: winnerWins } }
      );
    }
  }
};

const updateMenu = async (chatId, currentMenu) => {
  const users = db.collection("users");
  const user = await users.findOne({ chatId });

  let menus = user.menus;
  if (!menus || currentMenu === "Start") {
    menus = [currentMenu];
  } else if (menus.includes(currentMenu)) {
    if (menus[menus.length - 1] === currentMenu) {
      // Refreshed menu
      return;
    } else {
      const index = menus.findIndex((e) => e === currentMenu);
      menus = menus.slice(0, index + 1);
    }
  } else {
    menus.push(currentMenu);
  }

  await users.updateOne(
    { chatId },
    {
      $set: { menus },
    },
    { upsert: true }
  );
};

const previousMenu = async (chatId, skips) => {
  const users = db.collection("users");
  const user = await users.findOne({ chatId });

  if (!user) {
    return null;
  } else if (user.menus.length < 2) {
    return null;
  } else {
    return user.menus[user.menus.length - skips - 1];
  }
};

module.exports = {
  registerUser: wrapper(registerUser),
  createRoom: wrapper(createRoom),
  updateMessageIdHistory: wrapper(updateMessageIdHistory),
  deleteMessageIdHistory: wrapper(deleteMessageIdHistory),
  joinRoom: wrapper(joinRoom),
  leaveRoom: wrapper(leaveRoom),
  getHostId: wrapper(getHostId),
  getRoomPlayers: wrapper(getRoomPlayers),
  updateTally: wrapper(updateTally),
  updateIsShooter: wrapper(updateIsShooter),
  updateMenu: wrapper(updateMenu),
  previousMenu: wrapper(previousMenu),
};
