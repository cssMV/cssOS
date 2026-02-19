import express from "express";

const app = express();
const PORT = 3000;

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "cssOS running 🚀" });
});

app.listen(PORT, () => {
  console.log(`cssOS API running on http://localhost:${PORT}`);
});

