import https from "https";
import fs from "fs";

https.get("https://www.math.kth.se/matstat/gru/sf1915/oevning26.html", (res) => {
  const chunks: Buffer[] = [];
  res.on("data", (chunk) => {
    chunks.push(chunk);
  });
  res.on("end", () => {
    const buffer = Buffer.concat(chunks);
    fs.writeFileSync("scratch/raw_oevning.html", buffer);
    console.log("Saved raw_oevning.html successfully, length:", buffer.length);
  });
}).on("error", (err) => {
  console.error("Error fetching page:", err);
});
