const express = require("express");
const app = express();
var http = require("http").createServer(app);
var io = require("socket.io")(http);
require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const fs = require("fs");
const NodeRSA = require("node-rsa");
const { customAlphabet } = require("nanoid");
const nanoid = customAlphabet("0123456789abcdef");
const { v4: uuidv4 } = require("uuid");
const CryptoJS = require("crypto-js");

const resultsPublished = true;

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

// Key
const privateKeyFile = fs.readFileSync("./private/private.pem", "utf8");
const privateKey = new NodeRSA(privateKeyFile);

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

// Encrypt the message using a generated key
function encrypt(message, key) {
  return CryptoJS.AES.encrypt(message, key).toString();
}

// Encode to base64
function encodeBase64(value) {
  return btoa(value);
}

// Decrypt the cipher using session key
function decrypt(cipher, key) {
  return CryptoJS.AES.decrypt(atob(cipher), key).toString(CryptoJS.enc.Utf8);
}

// CLA Admin Routes

// CLA Admin - Home Page
app.get("/admin", async (req, res) => {
  try {
    const candidates = await Candidate.find();

    return res.render("admin", {
      success: true,
      message: "Candidates fetched successfully.",
      data: {
        id: nanoid(10),
        candidates,
      },
    });
  } catch (err) {
    console.log(err);
  }
});

// CLA Admin - Add Candidate
app.post("/admin/add-candidate", async (req, res) => {
  try {
    const { nominationID, candidateName, candidateImageURL } = req.body;

    const candidate = new Candidate({
      nominationID,
      candidateName,
      candidateImageURL,
    });

    await candidate.save();

    return res.redirect("/admin");
  } catch (err) {
    console.log(err);
  }
});

// User Routes

// User - isLoggedIn middleware to check and validate JWTs
const isLoggedIn = (req, res, next) => {
  try {
    const { token } = req.cookies;

    if (token === undefined) {
      throw new Error("token undefined");
    }

    const user = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { epic: user.epic };

    if (req.route.path === "/login" || req.route.path === "/signup") {
      return res.redirect("/");
    }

    next();
  } catch (err) {
    console.log(err);

    return res.render("login", {
      success: false,
      message: "Your are not logged in or your session expired",
    });
  }
};

// Get session key
const getSessionKey = async (req, res, next) => {
  try {
    const key = await Key.findOne({ identity: req.cookies?.identity });

    console.log(io.sockets);

    if (!key) {
      req.sessionKey = null;
    } else {
      req.sessionKey = key.sessionKey;
    }

    console.log("GET_SESSION_KEY", req.sessionKey);

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

// User - Home page
app.get("/", getSessionKey, isLoggedIn, async (req, res) => {
  try {
    const user = await User.findOne({ epic: req.user.epic });

    let validationNumber = user?.validationNumber;
    if (validationNumber === "") {
      validationNumber = uuidv4();

      user.validationNumber = validationNumber;
      await user.save();
    }

    const candidates = await Candidate.find();

    const credentials = JSON.stringify({
      candidates,
      user: {
        epic: user?.epic,
        name: user?.name,
      },
      validationNumber,
    });

    const cipher = encrypt(credentials, req.sessionKey);
    const payload = encodeBase64(cipher);

    return res.render("index", {
      success: true,
      message:
        "All information fetched successfully. You can now cast your vote.",
      showMessage: false,
      data: {
        payload,
        resultsPublished,
      },
    });
  } catch (err) {
    console.log(err);
  }
});

// User - Voters list page
app.get("/voters", isLoggedIn, async (req, res) => {
  try {
    const user = await User.findOne({ epic: req.user.epic });
    console.log(user);

    const users = await User.find({});

    return res.render("voters", {
      success: true,
      showMessage: false,
      message: "Voters details fetched successfully",
      data: {
        voters: users,
        user: {
          epic: user?.epic,
          name: user?.name,
        },
        resultsPublished,
      },
    });
  } catch (err) {
    console.log(err);
  }
});

app.get("/results", isLoggedIn, async (req, res) => {
  try {
    const candidates = await Candidate.find().lean();
    const users = await User.find().lean();

    let votesCount = 0;
    for (let user of users) {
      if (user.voted === true) {
        votesCount++;
      }
    }

    let candidateVotedByUser = null;

    let payload = candidates.map((candidate) => {
      for (let vote of candidate.votes) {
        if (vote.epic === req.user.epic) {
          candidateVotedByUser = candidate.nominationID;
        }
      }

      candidate.votes = candidate.votes.length;

      return candidate;
    });

    payload = payload.sort((a, b) =>
      a.votes < b.votes ? 1 : b.votes < a.votes ? -1 : 0
    );

    return res.render("results", {
      success: true,
      message: "Results fetched successfully.",
      data: {
        resultsPublished,
        candidates: payload,
        candidateVotedByUser,
        registeredVoters: users.length,
        votesCount,
      },
    });
  } catch (err) {
    console.log(err);
  }
});

// User - Login page
app.get("/login", isLoggedIn, (req, res) => {
  return res.render("login");
});

// User - Login controller
app.post("/login", getSessionKey, decryptMiddleware, async (req, res) => {
  try {
    const { epic, password } = req.decrypted;

    console.log(epic, password);

    const user = await User.findOne({ epic });

    if (!user) {
      return res.json({
        success: false,
        message: "Wrong EPIC number entered",
      });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);

    if (isValidPassword === true) {
      const payload = {
        epic: user.epic,
      };

      const token = jwt.sign(payload, process.env.JWT_SECRET);

      res.cookie("token", token, { maxAge: 300000, httpOnly: false });

      return res.json({
        success: true,
        message: "Successful.",
      });
    }

    return res.json({
      success: false,
      message: "Wrong password.",
    });
  } catch (err) {
    console.log(err);
  }
});

// User - Signup page
app.get("/signup", (req, res) => {
  return res.render("signup");
});

// User - Signup controller
app.post("/signup", getSessionKey, decryptMiddleware, async (req, res) => {
  try {
    const { epic, name, password } = req.decrypted;

    const user = await User.findOne({ epic });

    if (user) {
      return res.json({
        success: false,
        message: "EPIC Number already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(
      password,
      parseInt(process.env.SALT_ROUNDS)
    );

    const newUser = new User({
      epic,
      name,
      password: hashedPassword,
    });

    await newUser.save();

    return res.json({
      success: true,
      message: "User signed up successfully.",
    });
  } catch (err) {
    console.log(err);
  }
});

app.get("/logout", (req, res) => {
  try {
    res.clearCookie("token");

    return res.redirect("/login");
  } catch (err) {
    console.log(err);
  }
});

// Web sockets
// Socket connect
io.on("connection", async function (socket) {
  console.log("SOCKET_ID", socket.id);
  console.log("IDENTITY", socket.handshake.query.identity);

  const key = await Key.findOne({ identity: socket.handshake.query.identity });

  if (!key) {
    // Emit socket event to synchronize key
    socket.emit("synchronize-key-from-server");
  } else {
    console.log("SESSION_KEY", key.sessionKey);
    console.log(
      "---------------------------------------------------------------------------"
    );
  }

  // Receive the encrypted session key and decrypt it
  socket.on("synchronize-key-from-client", async ({ encodedPayload }) => {
    const payload = atob(encodedPayload);

    const sessionKey = privateKey.decrypt(payload, "utf8");

    if (key) {
      key.sessionKey = sessionKey;

      await key.save();
    } else {
      const key = new Key({
        identity: socket.handshake.query.identity,
        sessionKey,
      });

      await key.save();
    }

    socket.emit("synchronize-complete");
  });

  // Socket disconnect
  socket.on("disconnect", () => {
    console.log("Client disconnected");

    console.log(
      "---------------------------------------------------------------------------"
    );
  });
});

// Server listens on a specific PORT
// app.listen(process.env.PORT, (err) => {
http.listen(process.env.PORT, (err) => {
  if (err) {
    console.log(`Error in running the server ${err}`);
  }

  console.log(`SERVER: CLA | PORT: ${process.env.PORT} | STATUS: Running`);

  // var host = http.address().address;
  // var port = http.address().port;
  // console.log("App listening at http://%s:%s", host, port);
});
