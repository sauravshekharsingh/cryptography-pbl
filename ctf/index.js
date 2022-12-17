const express = require("express");
const app = express();
require("dotenv").config();
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcrypt");
const NodeRSA = require("node-rsa");
const keypair = require("keypair");
const CryptoJS = require("crypto-js");
const fs = require("fs");
const cors = require("cors");

// Database Connection
mongoose.connect("mongodb://localhost/cla", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;

db.on("error", console.error.bind(console, "error connecting to MongoDB"));

db.once("open", function () {
  console.log("Connected to the database.");
});

// CORS
app.use(cors({ credentials: true, origin: "http://localhost:8000" }));

// Importing Models
const Candidate = require("./models/candidate");
const User = require("./models/user");
const Key = require("./models/key");

// Setting the EJS view engine for frontend
app.set("view engine", "ejs");
app.set("views", "./views");

// Set up public files access for the server
app.use("/public", express.static("./public"));

// Add parser middleware to parse form data
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Add parser middleware for cookies
app.use(cookieParser());

// Decrypt the cipher using session key
function decrypt(cipher, key) {
  return CryptoJS.AES.decrypt(atob(cipher), key).toString(CryptoJS.enc.Utf8);
}

// User Routes
// User - isLoggedIn middleware to check and validate JWTs
const validateToken = (token) => {
  if (token === undefined) {
    throw new Error("token undefined");
  }

  const user = jwt.verify(token, process.env.JWT_SECRET);

  if (user === undefined) {
    return { isTokenValid: false };
  }

  return { isTokenValid: true, epic: user.epic };
};

// Get session key
const getSessionKey = async (req, res, next) => {
  try {
    const key = await Key.findOne({ identity: req.cookies?.identity });

    req.sessionKey = key.sessionKey;

    next();
  } catch (err) {
    console.log(err);
  }
};

// Decrypt the payload
const decryptMiddleware = (req, res, next) => {
  try {
    const { payload } = req.body;

    const decrypted = decrypt(payload, req.sessionKey);

    req.decrypted = JSON.parse(decrypted);

    next();
  } catch (err) {
    console.log(err);
  }
};

// User - Vote
app.post("/vote", getSessionKey, decryptMiddleware, async (req, res) => {
  try {
    const { nominationID, validationNumber } = req.decrypted;

    const { isTokenValid, epic } = validateToken(req.cookies?.token);

    if (!isTokenValid) {
      return res.json({
        success: false,
        message:
          "The JWT Token provided is invalid. Please re-login and try again.",
      });
    }

    const user = await User.findOne({ epic });

    const isValidValidationNumber = validationNumber === user.validationNumber;

    if (!isValidValidationNumber) {
      return res.json({
        success: false,
        message:
          "The validation number provided is invalid. Please check and try again.",
      });
    }

    if (user.voted === false) {
      const candidate = await Candidate.findOne({ nominationID });
      candidate.votes.push({ epic: user.epic, validationNumber });

      await candidate.save();

      user.voted = true;

      await user.save();
    } else {
      return res.json({
        success: false,
        message: "You have already cast your vote. Thank you!",
      });
    }

    return res.json({
      success: true,
      message: "Your vote has been successfully registered. Thank you!",
    });
  } catch (err) {
    console.log(err);
  }
});

// Server listens on a specific PORT
app.listen(process.env.PORT, (err) => {
  if (err) {
    console.log(`Error in running the server ${err}`);
  }

  console.log(`SERVER: CTF | PORT: ${process.env.PORT} | STATUS: Running`);
});
