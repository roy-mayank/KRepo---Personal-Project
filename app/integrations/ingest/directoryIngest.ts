const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function readTextFile(filePath: string) {
  return fs.readFileSync(filePath, { encoding: "utf8" });
}

function runPythonScript(scriptPath: string, args: string[]) {
  const python = process.env.PYTHON || "python";
  const res = spawnSync(python, [scriptPath, ...args], { encoding: "utf8" });
  if (res.error) throw res.error;
  if (res.status !== 0) {
    throw new Error(`Python script failed: ${res.stderr || res.stdout}`);
  }
  return res.stdout;
}

function writeKnowledgeItem(
  outputDir: string,
  sourcePath: string,
  content: string,
) {
  ensureDir(outputDir);
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const outFile = path.join(outputDir, `${id}.json`);
  const payload = {
    id,
    sourcePath,
    extractedAt: new Date().toISOString(),
    content,
  };
  fs.writeFileSync(outFile, JSON.stringify(payload, null, 2), "utf8");
  return outFile;
}

function walkDir(dir: string, recursive = true) {
  const results: string[] = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat && stat.isDirectory()) {
      if (recursive) results.push(...walkDir(full, true));
    } else {
      results.push(full);
    }
  }
  return results;
}

export async function ingestDirectory(
  dirPath: string,
  opts?: {
    recursive?: boolean;
    outputDir?: string;
    allowedExts?: string[];
  },
) {
  if (!dirPath) throw new Error("dirPath required");
  const recursive = opts?.recursive !== false;
  const outputDir =
    opts?.outputDir || path.join(process.cwd(), "output", "knowledge");
  const allowedExts = opts?.allowedExts || [".pdf", ".txt", ".md", ".mp3"];

  if (!fs.existsSync(dirPath))
    throw new Error(`Directory not found: ${dirPath}`);

  const files = walkDir(dirPath, recursive).filter((f) =>
    allowedExts.includes(path.extname(f).toLowerCase()),
  );
  const results: any[] = [];

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    let content = "";
    try {
      if (ext === ".pdf") {
        // Prefer existing Python pdf parser if present
        const script = path.join(
          process.cwd(),
          "app",
          "pdfparsing",
          "input",
          "llamaparse.py",
        );
        if (fs.existsSync(script)) {
          const raw = runPythonScript(script, [file]);
          const lines = raw.trim().split(/\r?\n/);
          try {
            content = JSON.parse(lines[lines.length - 1]);
          } catch {
            content = raw;
          }
        } else {
          content = `PDF file at ${file} (no parser available)`;
        }
      } else if (ext === ".mp3") {
        const script = path.join(
          process.cwd(),
          "app",
          "mp3extraction",
          "audiotranscriptor.py",
        );
        if (fs.existsSync(script)) {
          const raw = runPythonScript(script, [file]);
          const lines = raw.trim().split(/\r?\n/);
          try {
            content = JSON.parse(lines[lines.length - 1]);
          } catch {
            content = raw;
          }
        } else {
          content = `MP3 file at ${file} (no transcript parser available)`;
        }
      } else if (ext === ".txt" || ext === ".md") {
        content = readTextFile(file);
      } else {
        content = `Skipped unsupported file type: ${file}`;
      }

      const out = writeKnowledgeItem(outputDir, file, content);
      results.push({ file, out });
    } catch (e: any) {
      results.push({ file, error: e?.message || String(e) });
    }
  }

  return results;
}

if (require.main === module) {
  const target = process.argv[2];
  if (!target) {
    console.error("Usage: node directoryIngest.js <directory-path>");
    process.exit(2);
  }

  ingestDirectory(target)
    .then((r) => {
      console.log("Ingest results:", JSON.stringify(r, null, 2));
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
