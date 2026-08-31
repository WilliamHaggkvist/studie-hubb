import fs from "fs";

const html = fs.readFileSync("scratch/raw_oevning.html", "latin1");
console.log("=== HTML HEAD 2000 CHARS ===");
console.log(html.slice(0, 2000));
