const mongoose = require("mongoose");

const FingerprintSchema = new mongoose.Schema({
  fingerprint: { type: String, required: true, unique: true },
  ip: String,
  userAgent: String,
  firstSeen: { type: Date, default: Date.now },
  lastSeen: { type: Date, default: Date.now },
  hits: { type: Number, default: 1 }
});

module.exports = mongoose.model("Fingerprint", FingerprintSchema);

const Fingerprint = require("./models/Fingerprint");

app.post("/save_fingerprint", async (req, res) => {
  try {
    const { fingerprint } = req.body;

    if (!fingerprint) {
      return res.status(400).json({ error: "Missing fingerprint" });
    }

    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    const userAgent = req.headers["user-agent"];

    // Try to find existing fingerprint
    let record = await Fingerprint.findOne({ fingerprint });

    if (record) {
      record.lastSeen = new Date();
      record.hits += 1;
      await record.save();
      return res.json({
        status: "existing",
        hits: record.hits
      });
    }

    // Create new record if not found
    await Fingerprint.create({
      fingerprint,
      ip,
      userAgent
    });

    res.json({
      status: "new",
      hits: 1
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/use-credit", async (req, res) => {
  const { fingerprint } = req.body;

  const user = await Fingerprint.findOne({ fingerprint });
  if (!user) return res.status(403).json({ error: "Unknown user" });

  const limit = 3;  // <-- your credit limit

  if (user.hits > limit) {
    return res.json({ allowed: false, message: "Free credit limit reached" });
  }

  res.json({ allowed: true, remaining: limit - user.hits });
});
