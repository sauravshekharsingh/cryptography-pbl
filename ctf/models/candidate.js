const mongoose = require("mongoose");

const candidateSchema = new mongoose.Schema(
  {
    nominationID: {
      type: String,
      required: true,
      unique: true,
    },
    candidateName: {
      type: String,
      required: true,
    },
    votes: [
      {
        epic: {
          type: String,
        },
        validationNumber: {
          type: String,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

const Candidate = mongoose.model("Candidate", candidateSchema);

module.exports = Candidate;
