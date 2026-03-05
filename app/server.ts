import express from "express";
import { ingestDirectory } from "./integrations/ingest/directoryIngest";

const app = express();
app.use(express.json());

app.post("/ingest-directory", async (req, res) => {
  const { path, recursive, allowedExts } = req.body;
  if (!path) {
    return res.status(400).json({ error: "path required" });
  }

  try {
    const result = await ingestDirectory(path, {
      recursive,
      allowedExts,
    });
    return res.json({ result });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || String(e) });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server listening on ${port}`));
