const mongoose = require("mongoose");

const keySchema = new mongoose.Schema(
  {
    identity: {
      type: String,
      required: true,
      unique: true,
    },
    sessionKey: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const Key = mongoose.model("Key", keySchema);

module.exports = Key;
